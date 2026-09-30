import { createHash } from "node:crypto";
import { open, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";

import { buildApp } from "../../src/server/app.js";
import {
  serializeAppConfig,
  type ConfigFileHandle,
  type ConfigStoreDependencies,
} from "../../src/server/config-store.js";
import { emptyAppConfigV2 } from "../../src/shared/config/defaults.js";
import {
  AppConfigV1Schema,
  ConfigResponseV2Schema,
  type AppConfigV2,
  type ChildProfileV2,
} from "../../src/shared/config/schema.js";
import {
  GOLDEN_UPGRADED_V1_FIXTURE_SHA256,
  childrenV1FixtureBytes,
} from "../fixtures/profiles.js";

/*
 * The real upgrade round trip: `buildApp` and its `ConfigStore` on a temporary
 * path holding the fictional version 1 fixture, driven through Fastify
 * inject. Reads never write; the first explicit save writes a byte-identical
 * `.v1-` backup and then the version 2 bytes whose digest is pinned in
 * `migrate-fixture.test.ts`; newer files stay blocked and untouched.
 */

const HOST = "127.0.0.1:4310";
const ORIGIN = "http://127.0.0.1:4310";
const V1_BACKUP_NAME = /^children\.local\.json\.v1-\d{8}T\d{6}Z-[0-9a-f]{8}\.bak$/u;
const temporaryDirectories: string[] = [];
const apps: FastifyInstance[] = [];

interface InjectedResponse {
  readonly statusCode: number;
  readonly headers: Record<string, unknown>;
  readonly payload: string;
  json(): unknown;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function rawEtag(bytes: Uint8Array): string {
  return `"sha256-${sha256(bytes)}"`;
}

async function temporaryConfigPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "extra-credit-upgrade-"));
  temporaryDirectories.push(directory);
  return join(directory, "children.local.json");
}

async function startApp(
  configPath: string,
  configStoreDependencies?: ConfigStoreDependencies,
): Promise<{ readonly app: FastifyInstance; readonly token: string }> {
  const app = buildApp({
    configPath,
    securityMode: "fixed",
    ...(configStoreDependencies === undefined ? {} : { configStoreDependencies }),
  });
  apps.push(app);
  await app.ready();
  const session = await app.inject({
    method: "GET",
    url: "/api/session",
    headers: { host: HOST },
  });
  expect(session.statusCode).toBe(200);
  return { app, token: (session.json() as { token: string }).token };
}

async function getConfig(app: FastifyInstance, token: string): Promise<InjectedResponse> {
  const response = await app.inject({
    method: "GET",
    url: "/api/config",
    headers: { host: HOST, "x-extra-credit-token": token },
  });
  expect(response.headers["cache-control"]).toBe("no-store");
  return response;
}

async function putConfig(
  app: FastifyInstance,
  token: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<InjectedResponse> {
  const response = await app.inject({
    method: "PUT",
    url: "/api/config",
    headers: {
      host: HOST,
      origin: ORIGIN,
      "content-type": "application/json",
      "x-extra-credit-token": token,
      ...headers,
    },
    payload: typeof body === "string" ? body : JSON.stringify(body),
  });
  expect(response.headers["cache-control"]).toBe("no-store");
  return response;
}

function errorCode(response: InjectedResponse): string {
  return (response.json() as { error: { code: string } }).error.code;
}

async function backupNames(configPath: string): Promise<readonly string[]> {
  return (await readdir(dirname(configPath))).filter((name) => name.endsWith(".bak"));
}

async function seedV1(): Promise<string> {
  const configPath = await temporaryConfigPath();
  await writeFile(configPath, childrenV1FixtureBytes);
  return configPath;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("the real-Fastify version 1 upgrade round trip", () => {
  test("reads never write; the first save backs up, upgrades and survives a restart; the next save backs up nothing", async () => {
    const configPath = await seedV1();
    const before = await stat(configPath);
    const { app, token } = await startApp(configPath);

    let loaded: AppConfigV2 | undefined;
    for (let read = 0; read < 3; read += 1) {
      const response = await getConfig(app, token);
      expect(response.statusCode).toBe(200);
      expect(response.headers.etag).toBe(rawEtag(childrenV1FixtureBytes));
      const body = ConfigResponseV2Schema.parse(response.json());
      expect(body.storedSchemaVersion).toBe(1);
      loaded ??= body.config;
      expect(body.config).toEqual(loaded);
    }
    expect((await readFile(configPath)).equals(childrenV1FixtureBytes)).toBe(true);
    expect((await stat(configPath)).mtimeMs).toBe(before.mtimeMs);
    expect(await backupNames(configPath)).toEqual([]);

    // The parent's first explicit save sends the config it was shown, unchanged.
    const upgraded = await putConfig(app, token, loaded, {
      "if-match": rawEtag(childrenV1FixtureBytes),
    });
    expect(upgraded.statusCode).toBe(200);
    const upgradedBody = upgraded.json() as Record<string, unknown>;
    expect(Object.keys(upgradedBody).sort()).toEqual(["config", "storedSchemaVersion"]);
    expect(upgradedBody.storedSchemaVersion).toBe(2);
    expect(upgradedBody.config).toEqual(loaded);
    expect(upgraded.payload).not.toMatch(/profilesUpgraded|legacyChoicesCarried|backupWritten/u);

    const backups = await backupNames(configPath);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(V1_BACKUP_NAME);
    expect(
      (await readFile(join(dirname(configPath), backups[0]!))).equals(childrenV1FixtureBytes),
    ).toBe(true);
    const written = await readFile(configPath);
    expect(sha256(written)).toBe(GOLDEN_UPGRADED_V1_FIXTURE_SHA256);
    expect(upgraded.headers.etag).toBe(rawEtag(written));

    // A restart reads the upgraded file back at version 2.
    const restarted = await startApp(configPath);
    const reread = await getConfig(restarted.app, restarted.token);
    expect(reread.statusCode).toBe(200);
    expect(reread.headers.etag).toBe(upgraded.headers.etag);
    expect(ConfigResponseV2Schema.parse(reread.json())).toEqual({
      config: loaded,
      storedSchemaVersion: 2,
    });

    const second = await putConfig(
      restarted.app,
      restarted.token,
      { ...loaded, profiles: loaded!.profiles.slice(1) },
      { "if-match": String(reread.headers.etag) },
    );
    expect(second.statusCode).toBe(200);
    expect((second.json() as { storedSchemaVersion: number }).storedSchemaVersion).toBe(2);
    expect(await backupNames(configPath)).toEqual(backups);
  });
});

describe("the upgrade's refusals leave every file untouched", () => {
  test("schemaVersion 3 is blocked on GET and on PUT, with and without the recovery header", async () => {
    const configPath = await temporaryConfigPath();
    const futureRaw = Buffer.from('{"schemaVersion":3,"profiles":[],"future":true}\n');
    await writeFile(configPath, futureRaw);
    const { app, token } = await startApp(configPath);

    const read = await getConfig(app, token);
    expect(read.statusCode).toBe(409);
    expect(errorCode(read)).toBe("CONFIG_VERSION_UNSUPPORTED");
    expect(read.headers.etag).toBe(rawEtag(futureRaw));
    for (const recovery of [undefined, "backup-and-replace"] as const) {
      const write = await putConfig(app, token, emptyAppConfigV2(), {
        "if-match": rawEtag(futureRaw),
        ...(recovery === undefined ? {} : { "x-extra-credit-recovery": recovery }),
      });
      expect(write.statusCode).toBe(409);
      expect(errorCode(write)).toBe("CONFIG_VERSION_UNSUPPORTED");
    }
    expect((await readFile(configPath)).equals(futureRaw)).toBe(true);
    expect(await backupNames(configPath)).toEqual([]);
  });

  test("a valid v1 file refuses the recovery header, a stale ETag and a v1-shaped body", async () => {
    const configPath = await seedV1();
    const { app, token } = await startApp(configPath);
    const loaded = ConfigResponseV2Schema.parse((await getConfig(app, token)).json()).config;

    const recovery = await putConfig(app, token, loaded, {
      "if-match": rawEtag(childrenV1FixtureBytes),
      "x-extra-credit-recovery": "backup-and-replace",
    });
    expect(recovery.statusCode).toBe(409);
    expect(errorCode(recovery)).toBe("CONFIG_RECOVERY_NOT_ALLOWED");

    const stale = await putConfig(app, token, loaded, { "if-match": '"sha256-stale"' });
    expect(stale.statusCode).toBe(409);
    expect(errorCode(stale)).toBe("CONFIG_CONFLICT");

    // A stale tab running an older bundle sends the version 1 shape.
    const v1Body = AppConfigV1Schema.parse(JSON.parse(childrenV1FixtureBytes.toString("utf8")));
    const staleTab = await putConfig(app, token, v1Body, {
      "if-match": rawEtag(childrenV1FixtureBytes),
    });
    expect(staleTab.statusCode).toBe(422);
    expect(errorCode(staleTab)).toBe("VALIDATION_FAILED");

    expect((await readFile(configPath)).equals(childrenV1FixtureBytes)).toBe(true);
    expect(await backupNames(configPath)).toEqual([]);
  });

  test.each([
    ["a schema-invalid v1 file", '{"schemaVersion":1,"profiles":[],"defaults":{"difficulty":"hard"}}\n'],
    ["a schema-invalid v2 file", '{"schemaVersion":2,"profiles":[],"defaults":{"theme":"ocean"}}\n'],
  ])("%s is CONFIG_INVALID and recovers backup-first to the empty config plus one profile", async (_label, text) => {
    const configPath = await temporaryConfigPath();
    const invalidRaw = Buffer.from(text, "utf8");
    await writeFile(configPath, invalidRaw);
    const { app, token } = await startApp(configPath);

    const read = await getConfig(app, token);
    expect(read.statusCode).toBe(409);
    expect(errorCode(read)).toBe("CONFIG_INVALID");
    expect(read.headers.etag).toBe(rawEtag(invalidRaw));

    const draft: ChildProfileV2 = {
      id: "0a0b0c0d-1e1f-4a2b-8c3d-4e5f6a7b8c9d",
      displayName: "Fictional Recovery",
      reviewedOn: "2026-09-29",
      interests: ["trains"],
      legacyChoices: {
        presentationBand: "preschool",
        writingMode: "label",
        mathSkills: {
          countingMax: 10,
          numeralMax: 10,
          compareMax: 10,
          representations: ["quantities"],
          understandsEquality: false,
          operations: [],
          operandMax: 0,
          resultMax: 0,
          allowRegrouping: false,
          allowNegativeResults: false,
        },
      },
    };
    const replacement: AppConfigV2 = { ...emptyAppConfigV2(), profiles: [draft] };
    const recovered = await putConfig(app, token, replacement, {
      "if-match": rawEtag(invalidRaw),
      "x-extra-credit-recovery": "backup-and-replace",
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toEqual({ config: replacement, storedSchemaVersion: 2 });
    const backups = await backupNames(configPath);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^children\.local\.json\.invalid-\d{8}T\d{6}Z-[0-9a-f]{8}\.bak$/u);
    expect((await readFile(join(dirname(configPath), backups[0]!))).equals(invalidRaw)).toBe(true);
    expect((await readFile(configPath)).equals(serializeAppConfig(replacement))).toBe(true);
  });

  test("an upgrade backup that cannot be opened is CONFIG_IO_ERROR with the v1 bytes unchanged", async () => {
    const configPath = await seedV1();
    const { app, token } = await startApp(configPath, {
      io: {
        async open(path, flags, mode) {
          if (flags === "wx") {
            const error = new Error("private backup canary") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
          return (await open(path, flags, mode)) as ConfigFileHandle;
        },
      },
    });
    const loaded = ConfigResponseV2Schema.parse((await getConfig(app, token)).json()).config;
    const failed = await putConfig(app, token, loaded, {
      "if-match": rawEtag(childrenV1FixtureBytes),
    });
    expect(failed.statusCode).toBe(503);
    expect(errorCode(failed)).toBe("CONFIG_IO_ERROR");
    expect(failed.payload).not.toContain("private backup canary");
    expect((await readFile(configPath)).equals(childrenV1FixtureBytes)).toBe(true);
    expect(await backupNames(configPath)).toEqual([]);
  });

  test("an oversize upgrade is refused with 413 and no backup", async () => {
    const configPath = await seedV1();
    const { app, token } = await startApp(configPath);
    const loaded = ConfigResponseV2Schema.parse((await getConfig(app, token)).json()).config;
    const template = loaded.profiles[1]!;
    const profiles: ChildProfileV2[] = [];
    let index = 1;
    const oversized = (): AppConfigV2 => ({ ...loaded, profiles });
    while (serializeAppConfig(oversized()).byteLength <= 65_536) {
      profiles.push({
        ...template,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        displayName: `Fictional ${index}`,
      });
      index += 1;
    }
    // The compact request body stays inside Fastify's body limit, so the
    // store's own serialized-size check is what refuses it.
    expect(Buffer.byteLength(JSON.stringify(oversized()), "utf8")).toBeLessThanOrEqual(65_536);
    const refused = await putConfig(app, token, oversized(), {
      "if-match": rawEtag(childrenV1FixtureBytes),
    });
    expect(refused.statusCode).toBe(413);
    expect(["BODY_TOO_LARGE", "CONFIG_SERIALIZED_TOO_LARGE"]).toContain(errorCode(refused));
    expect((await readFile(configPath)).equals(childrenV1FixtureBytes)).toBe(true);
    expect(await backupNames(configPath)).toEqual([]);
  });
});
