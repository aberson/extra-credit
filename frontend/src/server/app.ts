import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";

import {
  ConfigStore,
  type ConfigStoreDependencies,
} from "./config-store.js";
import { configRoutes } from "./routes/config.js";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/session.js";
import {
  registerSecurityBoundary,
  type SecurityMode,
} from "./security.js";
import {
  ajvFieldErrors,
  apiError,
} from "./transport-schemas.js";

export interface BuildAppOptions {
  /** Retained for the fixed-path config store introduced in Step 2. */
  configPath: string;
  /** Required explicitly; only in-repository harnesses may select ephemeral. */
  securityMode: SecurityMode;
  /** Omit only when Vite owns the web UI during source development. */
  staticRoot?: string;
  /** Fault adapters are accepted only by direct in-repository tests. */
  configStoreDependencies?: ConfigStoreDependencies;
  /** Direct test seam; production always uses cryptographic randomness. */
  sessionRandomBytes?: (size: number) => Buffer;
}

export type { SecurityMode } from "./security.js";

export const BOOTSTRAP_CONTEXT_ERROR_CODE =
  "EXTRA_CREDIT_BOOTSTRAP_CONTEXT_ERROR";

interface BootstrapContext {
  readonly configPath: string;
  readonly securityMode: SecurityMode;
}

interface PackageMetadata {
  version: string;
}

const require = createRequire(import.meta.url);
const bootstrapContexts = new WeakMap<FastifyInstance, BootstrapContext>();

function createBootstrapContextFailure(safeMessage: string): Error {
  return new Error(`${BOOTSTRAP_CONTEXT_ERROR_CODE}: ${safeMessage}`);
}

function createBootstrapContext(options: BuildAppOptions): BootstrapContext {
  if (typeof options.configPath !== "string" || options.configPath.trim().length === 0) {
    throw createBootstrapContextFailure("A nonblank config path is required.");
  }

  if (
    options.securityMode !== "fixed" &&
    options.securityMode !== "ephemeral-test"
  ) {
    throw createBootstrapContextFailure("The security mode is invalid.");
  }

  const configPath = resolve(options.configPath);
  if (options.securityMode === "ephemeral-test") {
    const relativeToTemporaryRoot = relative(resolve(tmpdir()), configPath);
    if (
      relativeToTemporaryRoot.length === 0 ||
      relativeToTemporaryRoot === ".." ||
      relativeToTemporaryRoot.startsWith(`..${sep}`) ||
      isAbsolute(relativeToTemporaryRoot)
    ) {
      throw createBootstrapContextFailure(
        "Ephemeral mode requires a temporary config path.",
      );
    }
  }

  return Object.freeze({
    configPath,
    securityMode: options.securityMode,
  });
}

/**
 * Test-only assertion that verifies the retained private context without
 * returning it or decorating the request-visible Fastify instance.
 */
export function assertPrivateBootstrapContext(
  app: FastifyInstance,
  expected: Pick<BuildAppOptions, "configPath" | "securityMode">,
): void {
  const actual = bootstrapContexts.get(app);
  if (
    actual === undefined ||
    !Object.isFrozen(actual) ||
    actual.configPath !== resolve(expected.configPath) ||
    actual.securityMode !== expected.securityMode
  ) {
    throw new Error("The private application bootstrap context did not match.");
  }
}

function readPackageVersion(): string {
  const metadata = require("../../package.json") as Partial<PackageMetadata>;

  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("Package metadata is missing a version.");
  }

  return metadata.version;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const bootstrapContext = createBootstrapContext(options);
  const app = Fastify({
    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false,
        useDefaults: false,
      },
    },
    bodyLimit: 65_536,
    connectionTimeout: 10_000,
    logger: false,
    requestTimeout: 10_000,
    trustProxy: false,
  });
  bootstrapContexts.set(app, bootstrapContext);

  const security = registerSecurityBoundary(app, {
    allowDevelopmentOrigin: options.staticRoot === undefined,
    mode: bootstrapContext.securityMode,
    ...(options.sessionRandomBytes === undefined
      ? {}
      : { randomBytes: options.sessionRandomBytes }),
  });
  const configStore = new ConfigStore(
    bootstrapContext.configPath,
    options.configStoreDependencies,
  );

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
      reply.header(
        "Content-Security-Policy",
        "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      );
      reply.header("Cross-Origin-Opener-Policy", "same-origin");
      reply.header("Cross-Origin-Resource-Policy", "same-origin");
      reply.header("Origin-Agent-Cluster", "?1");
      reply.header("Referrer-Policy", "no-referrer");
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.removeHeader("Strict-Transport-Security");
    }

    return payload;
  });

  void app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        baseUri: ["'none'"],
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: null,
      },
    },
    hsts: false,
    referrerPolicy: { policy: "no-referrer" },
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (!request.url.startsWith("/api/")) {
      await reply.code(500).send("Internal Server Error");
      return;
    }

    const errorRecord =
      typeof error === "object" && error !== null
        ? (error as {
            readonly code?: unknown;
            readonly validation?: unknown;
          })
        : {};

    if (Array.isArray(errorRecord.validation)) {
      await reply
        .code(422)
        .send(
          apiError(
            "VALIDATION_FAILED",
            ajvFieldErrors(errorRecord.validation),
          ),
        );
      return;
    }

    if (errorRecord.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      await reply.code(413).send(apiError("BODY_TOO_LARGE"));
      return;
    }
    if (
      errorRecord.code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
      errorRecord.code === "FST_ERR_CTP_EMPTY_JSON_BODY"
    ) {
      await reply.code(400).send(apiError("INVALID_JSON"));
      return;
    }
    if (errorRecord.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      await reply.code(415).send(apiError("CONTENT_TYPE_REQUIRED"));
      return;
    }

    await reply.code(503).send(apiError("CONFIG_IO_ERROR"));
  });

  void app.register(healthRoutes, { version: readPackageVersion() });
  void app.register(sessionRoutes, { token: security.sessionToken });
  void app.register(configRoutes, {
    requireSessionToken: security.requireSessionToken,
    store: configStore,
  });

  if (options.staticRoot !== undefined) {
    void app.register(fastifyStatic, {
      dotfiles: "deny",
      index: ["index.html"],
      redirect: false,
      root: resolve(options.staticRoot),
      wildcard: false,
    });
  }

  return app;
}
