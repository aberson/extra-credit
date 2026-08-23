import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance } from "fastify";

import { buildApp, type SecurityMode } from "./app.js";

export const CANONICAL_CONFIG_PATH = fileURLToPath(
  new URL("../../../config/children.local.json", import.meta.url),
);
export const PRODUCTION_STATIC_ROOT = fileURLToPath(
  new URL("../../dist/web", import.meta.url),
);

export const STARTUP_ERROR_CODES = {
  boundAuthority: "EXTRA_CREDIT_BOUND_AUTHORITY_ERROR",
  generic: "EXTRA_CREDIT_STARTUP_ERROR",
  portUnavailable: "EXTRA_CREDIT_PORT_UNAVAILABLE",
  staticMissing: "EXTRA_CREDIT_STATIC_MISSING",
} as const;

export type StartupErrorCode =
  (typeof STARTUP_ERROR_CODES)[keyof typeof STARTUP_ERROR_CODES];

export class StartupFailure extends Error {
  override readonly name = "StartupFailure";

  constructor(
    readonly code: StartupErrorCode,
    safeMessage: string,
  ) {
    super(`${code}: ${safeMessage}`);
  }
}

export type StaticFilesMode =
  | { readonly mode: "disabled" }
  | { readonly mode: "required"; readonly root: string };

export interface StartServerOptions {
  configPath: string;
  host: string;
  port: number;
  securityMode: SecurityMode;
  staticFiles: StaticFilesMode;
}

export interface StartedServer {
  app: FastifyInstance;
  origin: string;
}

export interface RunServerLifecycle {
  onFatalFailure?: () => void;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function classifyStartupFailure(
  error: unknown,
  port: number,
): StartupFailure {
  if (error instanceof StartupFailure) {
    return error;
  }

  if (isErrnoException(error) && error.code === "EADDRINUSE") {
    return new StartupFailure(
      STARTUP_ERROR_CODES.portUnavailable,
      `The fixed local API port ${port} is unavailable.`,
    );
  }

  return new StartupFailure(
    STARTUP_ERROR_CODES.generic,
    "The local application could not start.",
  );
}

async function requireProductionStaticRoot(root: string): Promise<string> {
  if (root.trim().length === 0) {
    throw new StartupFailure(
      STARTUP_ERROR_CODES.staticMissing,
      "The production web build is unavailable. Run the build command first.",
    );
  }

  try {
    const indexMetadata = await stat(resolve(root, "index.html"));
    if (!indexMetadata.isFile()) {
      throw new Error("The production index path is not a file.");
    }
  } catch {
    throw new StartupFailure(
      STARTUP_ERROR_CODES.staticMissing,
      "The production web build is unavailable. Run the build command first.",
    );
  }

  return root;
}

export async function listenOnValidatedSocket(
  app: FastifyInstance,
  host: string,
  port: number,
): Promise<string> {
  if (host !== "127.0.0.1") {
    throw new StartupFailure(
      STARTUP_ERROR_CODES.boundAuthority,
      "The server refused a non-loopback listener.",
    );
  }

  await app.listen({ host, port });
  const socket = app.server.address();

  if (
    socket === null ||
    typeof socket === "string" ||
    socket.address !== "127.0.0.1" ||
    socket.port <= 0 ||
    (port !== 0 && socket.port !== port)
  ) {
    throw new StartupFailure(
      STARTUP_ERROR_CODES.boundAuthority,
      "The server did not bind the required loopback authority.",
    );
  }

  return `http://127.0.0.1:${socket.port}`;
}

export async function startServer(
  options: StartServerOptions,
): Promise<StartedServer> {
  let app: FastifyInstance | undefined;

  try {
    const staticRoot =
      options.staticFiles.mode === "required"
        ? await requireProductionStaticRoot(options.staticFiles.root)
        : undefined;

    app = buildApp({
      configPath: options.configPath,
      securityMode: options.securityMode,
      ...(staticRoot === undefined ? {} : { staticRoot }),
    });
    const origin = await listenOnValidatedSocket(
      app,
      options.host,
      options.port,
    );

    return { app, origin };
  } catch (error) {
    if (app !== undefined) {
      try {
        await app.close();
      } catch {
        // Preserve the safe category for the original startup failure.
      }
    }

    throw classifyStartupFailure(error, options.port);
  }
}

export async function runServer(
  options: StartServerOptions,
  lifecycle: RunServerLifecycle = {},
): Promise<void> {
  let started: StartedServer;

  const reportFatalFailure = async (failure: StartupFailure): Promise<void> => {
    process.exitCode = 1;
    await new Promise<void>((resolveWrite) => {
      process.stderr.write(`${failure.message}\n`, () => resolveWrite());
    });
    lifecycle.onFatalFailure?.();
  };

  try {
    started = await startServer(options);
  } catch (error) {
    await reportFatalFailure(classifyStartupFailure(error, options.port));
    return;
  }

  process.stdout.write(`Extra Credit is ready at ${started.origin}.\n`);
  let closing = false;

  const close = async (): Promise<void> => {
    if (closing) {
      return;
    }

    closing = true;
    try {
      await started.app.close();
    } catch (error) {
      process.stderr.write(
        `${classifyStartupFailure(error, options.port).message}\n`,
      );
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });

  if (lifecycle.onFatalFailure !== undefined) {
    started.app.server.once("close", () => {
      if (!closing) {
        void reportFatalFailure(
          new StartupFailure(
            STARTUP_ERROR_CODES.generic,
            "The local application could not start.",
          ),
        );
      }
    });
  }
}
