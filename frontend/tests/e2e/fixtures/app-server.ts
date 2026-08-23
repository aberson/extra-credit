import { createServer, type Server } from "node:net";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { test as base, expect } from "@playwright/test";
import type { FastifyInstance } from "fastify";
import { createServer as createViteServer, type ViteDevServer } from "vite";

import type { AppConfigV1 } from "../../../src/shared/config/schema.ts";

interface AppServerFixture {
  readonly origin: string;
  backupContents(): Promise<readonly Buffer[]>;
  readConfig(): Promise<AppConfigV1>;
  readRaw(): Promise<Buffer>;
  readSiblingBackup(): Promise<Buffer>;
  restart(): Promise<void>;
  seedConfig(config: AppConfigV1): Promise<void>;
  seedMissing(): Promise<void>;
  seedRaw(raw: Uint8Array): Promise<void>;
  writeSiblingBackup(raw: Uint8Array): Promise<void>;
}

interface BackendRequestRecord {
  readonly method: string;
  readonly url: string;
}

interface DevelopmentStackFixture {
  readonly origin: string;
  backendRequests(): readonly BackendRequestRecord[];
}

type ProfileFixtures = {
  appServer: AppServerFixture;
  developmentStack: DevelopmentStackFixture;
};

const appModuleUrl = new URL("../../../dist/server/app.js", import.meta.url);
const startupModuleUrl = new URL("../../../dist/server/startup.js", import.meta.url);
const viteConfigPath = fileURLToPath(new URL("../../../vite.config.ts", import.meta.url));
const siblingFixtureName = "children.local.json.invalid-e2e-existing.bak";
const fixedApiPort = 4310;
const fixedWebPort = 4311;
const proxyProbeHeader = "x-extra-credit-proxy-probe";

function closeProbe(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolveClose();
      } else {
        reject(new Error("The profile fixture release probe could not close."));
      }
    });
  });
}

async function assertPortReleased(port: number): Promise<void> {
  const probe = createServer();
  await new Promise<void>((resolveListen, reject) => {
    probe.once("error", () => {
      reject(new Error("The profile fixture did not release its application port."));
    });
    probe.listen({ exclusive: true, host: "127.0.0.1", port }, () => {
      probe.removeAllListeners("error");
      resolveListen();
    });
  });
  await closeProbe(probe);
}

export const test = base.extend<ProfileFixtures>({
  appServer: async ({ browserName }, use) => {
    void browserName;
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "extra-credit-profile-e2e-"));
    const configPath = join(temporaryDirectory, "children.local.json");
    const siblingBackupPath = join(temporaryDirectory, siblingFixtureName);
    const [{ assertPrivateBootstrapContext, buildApp }, { listenOnValidatedSocket, PRODUCTION_STATIC_ROOT }] =
      await Promise.all([import(appModuleUrl.href), import(startupModuleUrl.href)]);
    let app: FastifyInstance | undefined;
    let appPort: number | undefined;

    const start = async (port: number): Promise<FastifyInstance> => {
      const next = buildApp({
        configPath,
        securityMode: "ephemeral-test",
        staticRoot: PRODUCTION_STATIC_ROOT,
      });
      assertPrivateBootstrapContext(next, {
        configPath,
        securityMode: "ephemeral-test",
      });
      await listenOnValidatedSocket(next, "127.0.0.1", port);
      return next;
    };

    try {
      app = await start(0);
      const address = app.server.address();
      if (address === null || typeof address === "string") {
        throw new Error("The profile fixture did not bind a TCP socket.");
      }
      appPort = address.port;
      const origin = `http://127.0.0.1:${appPort}`;

      await use({
        origin,
        async backupContents() {
          const names = (await readdir(temporaryDirectory)).filter(
            (name) => name.endsWith(".bak") && name !== siblingFixtureName,
          );
          return await Promise.all(names.map(async (name) => await readFile(join(temporaryDirectory, name))));
        },
        async readConfig() {
          const value: unknown = JSON.parse(await readFile(configPath, "utf8"));
          return value as AppConfigV1;
        },
        async readRaw() {
          return await readFile(configPath);
        },
        async readSiblingBackup() {
          return await readFile(siblingBackupPath);
        },
        async restart() {
          if (app === undefined || appPort === undefined) {
            throw new Error("The profile fixture was not ready to restart.");
          }
          const originalOrigin = origin;
          await app.close();
          app = undefined;
          app = await start(appPort);
          const rebound = app.server.address();
          if (
            rebound === null ||
            typeof rebound === "string" ||
            `http://127.0.0.1:${rebound.port}` !== originalOrigin
          ) {
            throw new Error("The profile fixture did not preserve its browser origin.");
          }
        },
        async seedConfig(config) {
          await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
        },
        async seedMissing() {
          await rm(configPath, { force: true });
        },
        async seedRaw(raw) {
          await writeFile(configPath, raw);
        },
        async writeSiblingBackup(raw) {
          await writeFile(siblingBackupPath, raw, { flag: "wx" });
        },
      });
    } finally {
      try {
        if (app !== undefined) {
          await app.close();
        }
        if (appPort !== undefined) {
          await assertPortReleased(appPort);
        }
      } finally {
        await rm(temporaryDirectory, { force: true, recursive: true });
      }
    }
  },
  developmentStack: async ({ browserName }, use) => {
    void browserName;
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "extra-credit-vite-e2e-"));
    const configPath = join(temporaryDirectory, "children.local.json");
    const backendRequests: BackendRequestRecord[] = [];
    let app: FastifyInstance | undefined;
    let vite: ViteDevServer | undefined;

    try {
      await assertPortReleased(fixedApiPort);
      await assertPortReleased(fixedWebPort);
      const [
        { assertPrivateBootstrapContext, buildApp },
        { listenOnValidatedSocket },
      ] = await Promise.all([import(appModuleUrl.href), import(startupModuleUrl.href)]);
      const nextApp: FastifyInstance = buildApp({
        configPath,
        securityMode: "fixed",
      });
      app = nextApp;
      assertPrivateBootstrapContext(nextApp, { configPath, securityMode: "fixed" });
      nextApp.addHook("onRequest", async (request, reply) => {
        backendRequests.push({
          method: request.method,
          url: request.raw.url ?? "",
        });
        void reply.header(proxyProbeHeader, "fastify");
      });
      await listenOnValidatedSocket(nextApp, "127.0.0.1", fixedApiPort);

      vite = await createViteServer({
        cacheDir: join(temporaryDirectory, "vite-cache"),
        clearScreen: false,
        configFile: viteConfigPath,
        logLevel: "silent",
      });
      await vite.listen();
      const address = vite.httpServer?.address();
      if (
        address === null ||
        address === undefined ||
        typeof address === "string" ||
        address.port !== fixedWebPort
      ) {
        throw new Error("The Vite development fixture did not bind its expected authority.");
      }

      await use({
        origin: `http://127.0.0.1:${fixedWebPort}`,
        backendRequests: () => [...backendRequests],
      });
    } finally {
      try {
        if (vite !== undefined) {
          await vite.close();
        }
      } finally {
        try {
          if (app !== undefined) {
            await app.close();
          }
        } finally {
          try {
            await assertPortReleased(fixedApiPort);
            await assertPortReleased(fixedWebPort);
          } finally {
            await rm(temporaryDirectory, { force: true, recursive: true });
          }
        }
      }
    }
  },
});

export { expect };
