import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";
import { resolveConfig } from "vite";

import {
  assertPrivateBootstrapContext,
  BOOTSTRAP_CONTEXT_ERROR_CODE,
  buildApp,
} from "../../src/server/app.js";
import {
  CANONICAL_CONFIG_PATH,
  classifyStartupFailure,
  PRODUCTION_STATIC_ROOT,
  STARTUP_ERROR_CODES,
  startServer,
  type StartedServer,
} from "../../src/server/startup.js";
import {
  API_PORT,
  LOOPBACK_HOST,
  WEB_PORT,
} from "../../src/shared/runtime/ports.js";

const frontendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const viteConfigPath = resolve(frontendRoot, "vite.config.ts");
const packagePath = resolve(frontendRoot, "package.json");
const temporaryDirectories: string[] = [];
const startedServers: StartedServer[] = [];
const heldSockets: Server[] = [];

interface PackageMetadata {
  version: string;
}

async function readPackageVersion(): Promise<string> {
  const metadata = JSON.parse(
    await readFile(packagePath, "utf8"),
  ) as Partial<PackageMetadata>;

  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("Package metadata is missing a version.");
  }

  return metadata.version;
}

async function createTemporaryConfigPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "extra-credit-bootstrap-"));
  temporaryDirectories.push(directory);
  return join(directory, "children.local.json");
}

async function holdEphemeralPort(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  server.listen({ host: "127.0.0.1", port: 0, exclusive: true });
  await once(server, "listening");
  const socket = server.address();

  if (socket === null || typeof socket === "string") {
    throw new Error("The port holder did not report a TCP socket.");
  }

  heldSockets.push(server);
  return { port: socket.port, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolveClose();
      } else {
        reject(error);
      }
    });
  });
}

afterEach(async () => {
  await Promise.all(startedServers.splice(0).map(async ({ app }) => app.close()));
  await Promise.all(
    heldSockets.splice(0).map(async (server) => await closeServer(server)),
  );
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("application bootstrap", () => {
  test("pins production and Vite authorities to independent literals", async () => {
    expect(LOOPBACK_HOST).toBe("127.0.0.1");
    expect(API_PORT).toBe(4310);
    expect(WEB_PORT).toBe(4311);
    expect(CANONICAL_CONFIG_PATH).toBe(
      resolve(frontendRoot, "../config/children.local.json"),
    );
    expect(PRODUCTION_STATIC_ROOT).toBe(resolve(frontendRoot, "dist/web"));

    const config = await resolveConfig({ configFile: viteConfigPath }, "serve");
    expect(config.server.host).toBe("127.0.0.1");
    expect(config.server.port).toBe(4311);
    expect(config.server.strictPort).toBe(true);
    expect(config.server.fs.deny).toEqual([
      ".env",
      ".env.*",
      "*.{crt,pem,key,p12,pfx,cer,der}",
      ".npmrc",
      ".yarnrc.yml",
      "**/.git/**",
      "config/**",
      "**/config/**",
    ]);
  });

  test("rejects every resolved Vite authority override with one safe code", async () => {
    await expect(
      resolveConfig(
        { configFile: viteConfigPath, server: { host: "0.0.0.0" } },
        "serve",
      ),
    ).rejects.toThrow("EXTRA_CREDIT_VITE_AUTHORITY_ERROR");
    await expect(
      resolveConfig(
        { configFile: viteConfigPath, server: { port: 54_321 } },
        "serve",
      ),
    ).rejects.toThrow("EXTRA_CREDIT_VITE_AUTHORITY_ERROR");
    await expect(
      resolveConfig(
        { configFile: viteConfigPath, server: { strictPort: false } },
        "serve",
      ),
    ).rejects.toThrow("EXTRA_CREDIT_VITE_AUTHORITY_ERROR");
  });

  test("retains an exact frozen private test context without exposing it", async () => {
    const configPath = await createTemporaryConfigPath();
    const packageVersion = await readPackageVersion();
    const app = buildApp({ configPath, securityMode: "ephemeral-test" });

    try {
      assertPrivateBootstrapContext(app, {
        configPath,
        securityMode: "ephemeral-test",
      });
      await app.ready();
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json()).toEqual({ status: "ok", version: packageVersion });
      expect(response.payload).not.toContain(configPath);
      expect(response.payload).not.toContain("ephemeral-test");
    } finally {
      await app.close();
    }

    expect(() =>
      buildApp({ configPath: "  ", securityMode: "ephemeral-test" }),
    ).toThrow("EXTRA_CREDIT_BOOTSTRAP_CONTEXT_ERROR");
    expect(() =>
      buildApp({
        configPath: resolve(frontendRoot, "not-a-temporary-config.json"),
        securityMode: "ephemeral-test",
      }),
    ).toThrow(BOOTSTRAP_CONTEXT_ERROR_CODE);
    expect(() =>
      buildApp({
        configPath,
        securityMode: "invalid-runtime-mode" as never,
      }),
    ).toThrow(BOOTSTRAP_CONTEXT_ERROR_CODE);
  });

  test("validates the actual ephemeral loopback socket", async () => {
    const configPath = await createTemporaryConfigPath();
    const started = await startServer({
      configPath,
      host: "127.0.0.1",
      port: 0,
      securityMode: "ephemeral-test",
      staticFiles: { mode: "disabled" },
    });
    startedServers.push(started);
    const socket = started.app.server.address();

    expect(socket).not.toBeNull();
    expect(typeof socket).not.toBe("string");
    if (socket !== null && typeof socket !== "string") {
      expect(socket.address).toBe("127.0.0.1");
      expect(socket.port).toBeGreaterThan(0);
      expect(started.origin).toBe(`http://127.0.0.1:${socket.port}`);
    }
    assertPrivateBootstrapContext(started.app, {
      configPath,
      securityMode: "ephemeral-test",
    });
  });

  test("fails a missing production web build before opening a listener", async () => {
    const configPath = await createTemporaryConfigPath();
    const missingRoot = resolve(frontendRoot, "dist/definitely-missing-web-root");
    const { port, server: portHolder } = await holdEphemeralPort();
    let startupError: unknown;

    try {
      try {
        const unexpectedlyStarted = await startServer({
          configPath,
          host: "127.0.0.1",
          port,
          securityMode: "fixed",
          staticFiles: { mode: "required", root: missingRoot },
        });
        startedServers.push(unexpectedlyStarted);
      } catch (error) {
        startupError = error;
      }

      expect(startupError).toMatchObject({
        code: STARTUP_ERROR_CODES.staticMissing,
      });
      expect(String(startupError)).not.toContain(missingRoot);
    } finally {
      await closeServer(portHolder);
      const holderIndex = heldSockets.indexOf(portHolder);
      if (holderIndex !== -1) {
        heldSockets.splice(holderIndex, 1);
      }
    }
  });

  test("categorizes a real port collision separately from generic failures", async () => {
    const configPath = await createTemporaryConfigPath();
    const { port } = await holdEphemeralPort();
    let startupError: unknown;

    try {
      await startServer({
        configPath,
        host: "127.0.0.1",
        port,
        securityMode: "ephemeral-test",
        staticFiles: { mode: "disabled" },
      });
    } catch (error) {
      startupError = error;
    }

    expect(startupError).toMatchObject({
      code: "EXTRA_CREDIT_PORT_UNAVAILABLE",
    });

    const privateFailure = new Error(
      `private detail: ${configPath} ephemeral-test`,
    );
    const safeFailure = classifyStartupFailure(privateFailure, 4310);
    expect(safeFailure.code).toBe(STARTUP_ERROR_CODES.generic);
    expect(safeFailure.message).toBe(
      "EXTRA_CREDIT_STARTUP_ERROR: The local application could not start.",
    );
    expect(safeFailure.message).not.toContain(configPath);
    expect(safeFailure.message).not.toContain("ephemeral-test");
  });
});
