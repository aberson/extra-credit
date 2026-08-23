import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";

import { buildApp } from "../../src/server/app.js";
import {
  CONFIG_BYTE_LIMIT,
  computeConfigEtag,
  type ConfigStoreDependencies,
} from "../../src/server/config-store.js";
import type {
  AppConfigV1,
  ChildProfileV1,
} from "../../src/shared/config/schema.js";

const HOST = "127.0.0.1:4310";
const ORIGIN = "http://127.0.0.1:4310";
const temporaryDirectories: string[] = [];
const apps: FastifyInstance[] = [];
const CONFIG_SPEC_BYTE_LIMIT = 65_536;

function specPrettyBytes(config: AppConfigV1): Buffer {
  return Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function fixture(displayName = "Morgan"): AppConfigV1 {
  return {
    schemaVersion: 1,
    profiles: [
      {
        id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
        displayName,
        ageYears: 6,
        presentationBand: "early-primary",
        reviewedOn: "2026-08-22",
        mathSkills: {
          countingMax: 20,
          numeralMax: 20,
          compareMax: 20,
          representations: ["quantities", "equations"],
          understandsEquality: true,
          operations: ["addition", "subtraction"],
          operandMax: 10,
          resultMax: 10,
          allowRegrouping: false,
          allowNegativeResults: false,
        },
        writingMode: "sentence-frame",
        interests: ["nature", "vehicles"],
      },
    ],
    defaults: {
      useDisplayName: true,
      useInterests: true,
      includeDecorativeGraphics: true,
      difficulty: "practice",
      length: "standard",
      includeAnswerKey: true,
      paperSize: "letter",
      printScale: "standard",
    },
  };
}

function sizingProfile(index: number, displayName = "A"): ChildProfileV1 {
  const child = structuredClone(fixture(displayName).profiles[0]!);
  child.id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  child.interests = [];
  return child;
}

function exactSizedConfig(): AppConfigV1 {
  const config = fixture();
  config.profiles = [];
  let index = 1;
  while (true) {
    const candidate = [...config.profiles, sizingProfile(index)];
    if (
      specPrettyBytes({ ...config, profiles: candidate }).byteLength >
      CONFIG_SPEC_BYTE_LIMIT
    ) {
      break;
    }
    config.profiles = candidate;
    index += 1;
  }

  let remaining = CONFIG_SPEC_BYTE_LIMIT - specPrettyBytes(config).byteLength;
  for (const child of config.profiles) {
    const increment = Math.min(39, remaining);
    child.displayName = `A${"x".repeat(increment)}`;
    remaining -= increment;
    if (remaining === 0) {
      break;
    }
  }
  if (remaining !== 0) {
    throw new Error("The exact-limit API fixture could not be constructed.");
  }
  return config;
}

async function setup(
  configStoreDependencies?: ConfigStoreDependencies,
): Promise<{
  app: FastifyInstance;
  configPath: string;
  token: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "extra-credit-api-"));
  temporaryDirectories.push(directory);
  const configPath = join(directory, "children.local.json");
  const app = buildApp({
    configPath,
    securityMode: "fixed",
    ...(configStoreDependencies === undefined
      ? {}
      : { configStoreDependencies }),
  });
  apps.push(app);
  await app.ready();
  const response = await app.inject({
    method: "GET",
    url: "/api/session",
    headers: { host: HOST },
  });
  expect(response.statusCode).toBe(200);
  return {
    app,
    configPath,
    token: (response.json() as { token: string }).token,
  };
}

function putHeaders(token: string): Record<string, string> {
  return {
    host: HOST,
    origin: ORIGIN,
    "content-type": "application/json",
    "x-extra-credit-token": token,
  };
}

function expectSafeError(
  response: {
    headers: Record<string, unknown>;
    json(): unknown;
    payload: string;
    statusCode: number;
  },
  code: string,
  status: number,
): void {
  const body = response.json() as {
    error: { code: string; message: string; fieldErrors?: unknown };
  };
  expect(body.error.code).toBe(code);
  expect(body.error.message).toEqual(expect.any(String));
  expect("fieldErrors" in body.error).toBe(code === "VALIDATION_FAILED");
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers["referrer-policy"]).toBe("no-referrer");
  expect(response.headers["strict-transport-security"]).toBeUndefined();
  expect(response.statusCode).toBe(status);
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("profile config API", () => {
  test("creates, reads, normalizes, and updates one complete configuration", async () => {
    const { app, configPath, token } = await setup();
    const input = fixture("  Morgan  ");
    input.profiles[0]!.interests = ["  Nature  ", "vehicles"];

    const created = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: input,
    });
    expect(created.statusCode).toBe(200);
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(created.headers.etag).toMatch(/^"sha256-[0-9a-f]{64}"$/u);
    const createdConfig = (created.json() as { config: AppConfigV1 }).config;
    expect(createdConfig.profiles[0]!.displayName).toBe("Morgan");
    expect(createdConfig.profiles[0]!.interests).toEqual(["Nature", "vehicles"]);
    expect(computeConfigEtag(await readFile(configPath))).toBe(created.headers.etag);

    const read = await app.inject({
      method: "GET",
      url: "/api/config",
      headers: { host: HOST, "x-extra-credit-token": token },
    });
    expect(read.statusCode).toBe(200);
    expect(read.headers.etag).toBe(created.headers.etag);
    expect(read.json()).toEqual({ config: createdConfig });

    const update = fixture("Avery");
    const updated = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": String(read.headers.etag),
      },
      payload: update,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.headers.etag).not.toBe(read.headers.etag);
    expect((updated.json() as { config: AppConfigV1 }).config).toEqual(update);
  });

  test("maps token, parser, validation, and precondition failures exactly", async () => {
    const { app, token } = await setup();

    const missingToken = await app.inject({
      method: "GET",
      url: "/api/config",
      headers: { host: HOST },
    });
    expect(missingToken.statusCode).toBe(401);
    expectSafeError(missingToken, "SESSION_TOKEN_INVALID", 401);

    const notFound = await app.inject({
      method: "GET",
      url: "/api/config",
      headers: { host: HOST, "x-extra-credit-token": token },
    });
    expectSafeError(notFound, "CONFIG_NOT_FOUND", 404);

    const noContentType = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        host: HOST,
        origin: ORIGIN,
        "x-extra-credit-token": token,
        "if-none-match": "*",
      },
      payload: "{}",
    });
    expect(noContentType.statusCode).toBe(415);
    expectSafeError(noContentType, "CONTENT_TYPE_REQUIRED", 415);

    const malformed = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: "{not-json",
    });
    expect(malformed.statusCode).toBe(400);
    expectSafeError(malformed, "INVALID_JSON", 400);

    const bodyTooLarge = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: `"${"x".repeat(CONFIG_SPEC_BYTE_LIMIT)}"`,
    });
    expect(bodyTooLarge.statusCode).toBe(413);
    expectSafeError(bodyTooLarge, "BODY_TOO_LARGE", 413);

    const unknown = structuredClone(fixture()) as unknown as {
      profiles: Array<Record<string, unknown>>;
    };
    unknown.profiles[0]!.avoidTopics = ["private-canary"];
    const invalid = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: unknown,
    });
    expect(invalid.statusCode).toBe(422);
    expectSafeError(invalid, "VALIDATION_FAILED", 422);
    expect(invalid.payload).not.toContain("private-canary");

    const noPrecondition = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: putHeaders(token),
      payload: fixture(),
    });
    expect(noPrecondition.statusCode).toBe(428);
    expectSafeError(noPrecondition, "CONFIG_PRECONDITION_REQUIRED", 428);
  });

  test("serializes simultaneous API updates and preserves the winner", async () => {
    const { app, configPath, token } = await setup();
    const created = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: fixture("Initial"),
    });
    const etag = String(created.headers.etag);
    const simultaneous = await Promise.all([
      app.inject({
        method: "PUT",
        url: "/api/config",
        headers: { ...putHeaders(token), "if-match": etag },
        payload: fixture("First"),
      }),
      app.inject({
        method: "PUT",
        url: "/api/config",
        headers: { ...putHeaders(token), "if-match": etag },
        payload: fixture("Second"),
      }),
    ]);
    expect(simultaneous.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect(
      simultaneous.map(({ statusCode }) => statusCode === 409),
    ).toContain(true);
    const winnerRaw = await readFile(configPath);

    for (const headers of [
      { ...putHeaders(token), "if-match": etag },
      { ...putHeaders(token), "if-none-match": "*" },
    ]) {
      const conflict = await app.inject({
        method: "PUT",
        url: "/api/config",
        headers,
        payload: fixture("Loser"),
      });
      expect(conflict.statusCode).toBe(409);
      expectSafeError(conflict, "CONFIG_CONFLICT", 409);
      expect((await readFile(configPath)).equals(winnerRaw)).toBe(true);
    }
  });

  test("maps replacement I/O faults safely without leaking causes or paths", async () => {
    const ioCanary = "PRIVATE_OS_ERROR_CANARY";
    const { app, configPath, token } = await setup({
      io: {
        async writeAtomic() {
          throw new Error(ioCanary);
        },
      },
    });
    const failed = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: fixture("Private Value Canary"),
    });
    expectSafeError(failed, "CONFIG_IO_ERROR", 503);
    expect(failed.payload).not.toContain(ioCanary);
    expect(failed.payload).not.toContain(configPath);
    expect(failed.payload).not.toContain("Private Value Canary");
    await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("round-trips an exact-limit pretty body and rejects pretty UTF-8 overflow", async () => {
    expect(CONFIG_BYTE_LIMIT).toBe(CONFIG_SPEC_BYTE_LIMIT);
    const { app, configPath, token } = await setup();
    const exact = exactSizedConfig();
    const exactPrettyBytes = specPrettyBytes(exact);
    const compact = JSON.stringify(exact);
    expect(Buffer.byteLength(compact, "utf8")).toBeLessThan(
      CONFIG_SPEC_BYTE_LIMIT,
    );
    expect(exactPrettyBytes.byteLength).toBe(CONFIG_SPEC_BYTE_LIMIT);

    const created = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: compact,
    });
    expect(created.statusCode).toBe(200);
    expect((await readFile(configPath)).equals(exactPrettyBytes)).toBe(true);

    const oversized = structuredClone(exact);
    const extendable = oversized.profiles.find(
      ({ displayName }) => (displayName?.length ?? 0) < 40,
    );
    if (extendable === undefined || extendable.displayName === undefined) {
      throw new Error("The overflow API fixture had no extendable field.");
    }
    extendable.displayName += "z";
    expect(specPrettyBytes(oversized).byteLength).toBe(
      CONFIG_SPEC_BYTE_LIMIT + 1,
    );
    const before = await readFile(configPath);
    const rejected = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": String(created.headers.etag),
      },
      payload: JSON.stringify(oversized),
    });
    expect(rejected.statusCode).toBe(413);
    expectSafeError(rejected, "CONFIG_SERIALIZED_TOO_LARGE", 413);
    expect((await readFile(configPath)).equals(before)).toBe(true);
  });

  test("distinguishes invalid/future files with ETags from large/unsafe files", async () => {
    const { app, configPath, token } = await setup();
    const headers = { host: HOST, "x-extra-credit-token": token };

    const invalidRaw = Buffer.from([0x7b, 0xc3, 0x28, 0x7d]);
    await writeFile(configPath, invalidRaw);
    const invalid = await app.inject({ method: "GET", url: "/api/config", headers });
    expect(invalid.statusCode).toBe(409);
    expect(invalid.headers.etag).toBe(computeConfigEtag(invalidRaw));
    expectSafeError(invalid, "CONFIG_INVALID", 409);
    expect(invalid.payload).not.toContain("�");

    const futureRaw = Buffer.from('{"schemaVersion":2,"secret":"canary"}\n');
    await writeFile(configPath, futureRaw);
    const future = await app.inject({ method: "GET", url: "/api/config", headers });
    expect(future.statusCode).toBe(409);
    expect(future.headers.etag).toBe(computeConfigEtag(futureRaw));
    expectSafeError(future, "CONFIG_VERSION_UNSUPPORTED", 409);
    expect(future.payload).not.toContain("secret");
    expect(future.payload).not.toContain(configPath);

    for (const recovery of [undefined, "backup-and-replace"] as const) {
      const futureMutation = await app.inject({
        method: "PUT",
        url: "/api/config",
        headers: {
          ...putHeaders(token),
          "if-match": computeConfigEtag(futureRaw),
          ...(recovery === undefined
            ? {}
            : { "x-extra-credit-recovery": recovery }),
        },
        payload: fixture(),
      });
      expect(futureMutation.statusCode).toBe(409);
      expect(futureMutation.headers.etag).toBe(computeConfigEtag(futureRaw));
      expectSafeError(
        futureMutation,
        "CONFIG_VERSION_UNSUPPORTED",
        409,
      );
      expect((await readFile(configPath)).equals(futureRaw)).toBe(true);
    }
    expect(
      (await readdir(dirname(configPath))).some((name) => name.endsWith(".bak")),
    ).toBe(false);

    const largeRaw = Buffer.alloc(CONFIG_SPEC_BYTE_LIMIT + 1);
    await writeFile(configPath, largeRaw);
    const large = await app.inject({ method: "GET", url: "/api/config", headers });
    expect(large.statusCode).toBe(409);
    expect(large.headers.etag).toBeUndefined();
    expectSafeError(large, "CONFIG_TOO_LARGE", 409);
    const largeRecovery = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": '"sha256-not-computed"',
        "x-extra-credit-recovery": "backup-and-replace",
      },
      payload: fixture(),
    });
    expect(largeRecovery.statusCode).toBe(409);
    expect(largeRecovery.headers.etag).toBeUndefined();
    expectSafeError(largeRecovery, "CONFIG_TOO_LARGE", 409);
    expect((await readFile(configPath)).equals(largeRaw)).toBe(true);

    await rm(configPath);
    await mkdir(configPath);
    const unsafe = await app.inject({ method: "GET", url: "/api/config", headers });
    expect(unsafe.statusCode).toBe(409);
    expect(unsafe.headers.etag).toBeUndefined();
    expectSafeError(unsafe, "CONFIG_UNSAFE_FILE", 409);
    const unsafeRecovery = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": '"sha256-not-computed"',
        "x-extra-credit-recovery": "backup-and-replace",
      },
      payload: fixture(),
    });
    expect(unsafeRecovery.statusCode).toBe(409);
    expect(unsafeRecovery.headers.etag).toBeUndefined();
    expectSafeError(unsafeRecovery, "CONFIG_UNSAFE_FILE", 409);
    expect(
      (await readdir(dirname(configPath))).some((name) => name.endsWith(".bak")),
    ).toBe(false);
  });

  test("backs up an eligible invalid file before explicit API recovery", async () => {
    const { app, configPath, token } = await setup();
    const raw = Buffer.from("{broken-json", "utf8");
    await writeFile(configPath, raw);
    const etag = computeConfigEtag(raw);

    const noRecovery = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-match": etag },
      payload: fixture(),
    });
    expect(noRecovery.statusCode).toBe(409);
    expectSafeError(noRecovery, "CONFIG_RECOVERY_NOT_ALLOWED", 409);
    expect((await readFile(configPath)).equals(raw)).toBe(true);

    const recovered = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": etag,
        "x-extra-credit-recovery": "backup-and-replace",
      },
      payload: fixture("Recovered"),
    });
    expect(recovered.statusCode).toBe(200);
    const directory = configPath.slice(0, configPath.lastIndexOf("\\") + 1) ||
      configPath.slice(0, configPath.lastIndexOf("/") + 1);
    const names = (await import("node:fs/promises")).readdir(directory);
    const backupNames = (await names).filter((name) => name.endsWith(".bak"));
    expect(backupNames).toHaveLength(1);
    expect(
      (await readFile(join(directory, backupNames[0]!))).equals(raw),
    ).toBe(true);
  });

  test("rejects ineligible recovery and allows a schema-invalid backup", async () => {
    const { app, configPath, token } = await setup();
    const recoveryHeaders = {
      ...putHeaders(token),
      "if-match": '"sha256-missing"',
      "x-extra-credit-recovery": "backup-and-replace",
    };
    const missing = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: recoveryHeaders,
      payload: fixture(),
    });
    expectSafeError(missing, "CONFIG_RECOVERY_NOT_ALLOWED", 409);

    const created = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: { ...putHeaders(token), "if-none-match": "*" },
      payload: fixture(),
    });
    const validRecovery = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": String(created.headers.etag),
        "x-extra-credit-recovery": "backup-and-replace",
      },
      payload: fixture("Replacement"),
    });
    expectSafeError(validRecovery, "CONFIG_RECOVERY_NOT_ALLOWED", 409);

    const schemaInvalidRaw = Buffer.from(
      '{"schemaVersion":1,"profiles":[],"defaults":{"avoidTopics":[]}}\n',
    );
    await writeFile(configPath, schemaInvalidRaw);
    const schemaInvalidEtag = computeConfigEtag(schemaInvalidRaw);
    const wrongHeader = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": schemaInvalidEtag,
        "x-extra-credit-recovery": "replace-without-backup",
      },
      payload: fixture(),
    });
    expectSafeError(wrongHeader, "CONFIG_RECOVERY_NOT_ALLOWED", 409);
    expect((await readFile(configPath)).equals(schemaInvalidRaw)).toBe(true);

    const recovered = await app.inject({
      method: "PUT",
      url: "/api/config",
      headers: {
        ...putHeaders(token),
        "if-match": schemaInvalidEtag,
        "x-extra-credit-recovery": "backup-and-replace",
      },
      payload: fixture("Recovered Schema"),
    });
    expect(recovered.statusCode).toBe(200);
    const backups = (await readdir(dirname(configPath))).filter((name) =>
      name.endsWith(".bak"),
    );
    expect(backups).toHaveLength(1);
    expect((await readFile(join(dirname(configPath), backups[0]!))).equals(schemaInvalidRaw)).toBe(true);
  });
});
