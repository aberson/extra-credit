import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";

import { healthRoutes } from "./routes/health.js";

export interface BuildAppOptions {
  /** Retained for the fixed-path config store introduced in Step 2. */
  configPath: string;
  /** Required explicitly; only in-repository harnesses may select ephemeral. */
  securityMode: SecurityMode;
  /** Omit only when Vite owns the web UI during source development. */
  staticRoot?: string;
}

export type SecurityMode = "ephemeral-test" | "fixed";

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

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
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

  void app.register(healthRoutes, { version: readPackageVersion() });

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
