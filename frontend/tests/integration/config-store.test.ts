import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  CONFIG_BYTE_LIMIT,
  CONFIG_FILE_MODE,
  CONFIG_STORE_ERROR_CODES,
  ConfigStore,
  ConfigStoreFailure,
  computeConfigEtag,
  serializeAppConfig,
  serializeAppConfigV1,
  type ConfigFileHandle,
} from "../../src/server/config-store.js";
import { emptyAppConfigV2 } from "../../src/shared/config/defaults.js";
import { classifyStoredConfig } from "../../src/shared/config/migrate.js";
import type {
  AppConfigV1,
  AppConfigV2,
  ChildProfileV1,
  ChildProfileV2,
} from "../../src/shared/config/schema.js";

const temporaryDirectories: string[] = [];
const CONFIG_SPEC_BYTE_LIMIT = 65_536;
const V1_BACKUP_NAME = /^children\.local\.json\.v1-\d{8}T\d{6}Z-[0-9a-f]{8}\.bak$/u;

function specPrettyBytes(config: AppConfigV1 | AppConfigV2): Buffer {
  return Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function fixture(displayName = "Morgan"): AppConfigV2 {
  return {
    ...emptyAppConfigV2(),
    profiles: [profile(1, displayName)],
  };
}

function profile(index: number, displayName = "A"): ChildProfileV2 {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    displayName,
    reviewedOn: "2026-08-22",
    interests: [],
    legacyChoices: {
      presentationBand: "early-primary",
      writingMode: "sentence-frame",
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
    },
  };
}

/** A fictional version 1 file as an earlier build wrote it. */
function v1Profile(index: number, displayName = "A"): ChildProfileV1 {
  const current = profile(index, displayName);
  return {
    id: current.id,
    displayName,
    ageYears: 6,
    presentationBand: current.legacyChoices!.presentationBand,
    reviewedOn: current.reviewedOn,
    mathSkills: current.legacyChoices!.mathSkills,
    writingMode: current.legacyChoices!.writingMode,
    interests: [],
  };
}

function v1Fixture(profileCount = 2): AppConfigV1 {
  return {
    schemaVersion: 1,
    profiles: Array.from({ length: profileCount }, (_, index) =>
      v1Profile(index + 1, `Fictional ${index + 1}`),
    ),
    defaults: {
      useDisplayName: true,
      useInterests: false,
      includeDecorativeGraphics: true,
      difficulty: "confidence",
      length: "long",
      includeAnswerKey: true,
      paperSize: "a4",
      printScale: "standard",
    },
  };
}

/** What an unchanged client sends back after reading a v1 file: its migrated form. */
function migratedOf(v1: AppConfigV1): AppConfigV2 {
  const classified = classifyStoredConfig(v1);
  if (classified.kind !== "legacy") {
    throw new Error("The v1 test fixture did not classify as legacy.");
  }
  return classified.config;
}

async function seededV1(profileCount = 2): Promise<{
  readonly target: string;
  readonly raw: Buffer;
  readonly v1: AppConfigV1;
}> {
  const target = await temporaryPath();
  const v1 = v1Fixture(profileCount);
  const raw = serializeAppConfigV1(v1);
  await writeFile(target, raw);
  return { target, raw, v1 };
}

async function backupNames(target: string): Promise<readonly string[]> {
  return (await readdir(dirname(target))).filter((name) => name.endsWith(".bak"));
}

async function temporaryPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "extra-credit-store-"));
  temporaryDirectories.push(directory);
  return join(directory, "children.local.json");
}

function failureCode(error: unknown): string | undefined {
  return error instanceof ConfigStoreFailure ? error.code : undefined;
}

function independentEtag(bytes: Uint8Array): string {
  return `"sha256-${createHash("sha256").update(bytes).digest("hex")}"`;
}

function exactSizedConfig(): AppConfigV2 {
  const config = fixture("A");
  config.profiles = [];
  let index = 1;
  while (true) {
    const candidate = [...config.profiles, profile(index)];
    const next = { ...config, profiles: candidate };
    if (specPrettyBytes(next).byteLength > CONFIG_SPEC_BYTE_LIMIT) {
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
    throw new Error("The exact-limit test fixture could not be constructed.");
  }
  return config;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("ConfigStore", () => {
  test("creates, reads, normalizes, updates, and hashes exact raw bytes", async () => {
    const target = await temporaryPath();
    const modeCalls: Array<[string, number]> = [];
    const store = new ConfigStore(target, {
      applyMode: async (path, mode) => {
        modeCalls.push([path, mode]);
        await chmod(path, mode);
      },
    });
    const untrimmed = fixture("  Morgan  ");
    const created = await store.save(untrimmed, { ifNoneMatch: "*" });
    const raw = await readFile(target);
    const expectedNormalizedBytes = specPrettyBytes(created.config);
    const independentlyHashed = `"sha256-${createHash("sha256").update(raw).digest("hex")}"`;

    expect(created.config.profiles[0]!.displayName).toBe("Morgan");
    expect(created.storedSchemaVersion).toBe(2);
    expect(created).not.toHaveProperty("upgrade");
    expect(serializeAppConfig(created.config).equals(expectedNormalizedBytes)).toBe(
      true,
    );
    expect(raw.equals(expectedNormalizedBytes)).toBe(true);
    expect(raw.at(-1)).toBe(10);
    expect(created.etag).toBe(independentlyHashed);
    expect((await store.load()).etag).toBe(independentlyHashed);
    expect(modeCalls).toEqual([[target, CONFIG_FILE_MODE]]);
    if (process.platform !== "win32") {
      expect((await stat(target)).mode & 0o777).toBe(0o600);
    }

    const updatedConfig = fixture("Avery");
    const updated = await store.save(updatedConfig, { ifMatch: created.etag });
    expect(updated.etag).not.toBe(created.etag);
    expect((await store.load()).config).toEqual(updatedConfig);
    expect((await store.load()).storedSchemaVersion).toBe(2);
    expect(await backupNames(target)).toEqual([]);
  });

  test("allows exactly 65,536 pretty UTF-8 bytes and rejects one byte more", async () => {
    expect(CONFIG_BYTE_LIMIT).toBe(CONFIG_SPEC_BYTE_LIMIT);
    const exact = exactSizedConfig();
    const exactBytes = specPrettyBytes(exact);
    expect(exactBytes.byteLength).toBe(CONFIG_SPEC_BYTE_LIMIT);
    expect(Buffer.byteLength(JSON.stringify(exact), "utf8")).toBeLessThan(
      CONFIG_SPEC_BYTE_LIMIT,
    );

    const exactTarget = await temporaryPath();
    const exactStore = new ConfigStore(exactTarget);
    const saved = await exactStore.save(exact, { ifNoneMatch: "*" });
    const writtenExactBytes = await readFile(exactTarget);
    expect(writtenExactBytes.equals(exactBytes)).toBe(true);
    expect(saved.etag).toBe(independentEtag(exactBytes));

    const oversized = structuredClone(exact);
    const extendable = oversized.profiles.find(
      ({ displayName }) => (displayName?.length ?? 0) < 40,
    );
    if (extendable === undefined || extendable.displayName === undefined) {
      throw new Error("The over-limit fixture had no extendable field.");
    }
    extendable.displayName += "z";
    expect(specPrettyBytes(oversized).byteLength).toBe(
      CONFIG_SPEC_BYTE_LIMIT + 1,
    );

    const absentTarget = await temporaryPath();
    await expect(
      new ConfigStore(absentTarget).save(oversized, { ifNoneMatch: "*" }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        failureCode(error) === CONFIG_STORE_ERROR_CODES.serializedTooLarge,
    );
    await expect(lstat(absentTarget)).rejects.toMatchObject({ code: "ENOENT" });

    const oldRaw = await readFile(exactTarget);
    await expect(
      exactStore.save(oversized, { ifMatch: saved.etag }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        failureCode(error) === CONFIG_STORE_ERROR_CODES.serializedTooLarge,
    );
    expect((await readFile(exactTarget)).equals(oldRaw)).toBe(true);
  });

  test("uses the overflow probe when a bounded lstat becomes 65,537 bytes", async () => {
    expect(CONFIG_BYTE_LIMIT).toBe(CONFIG_SPEC_BYTE_LIMIT);
    const target = await temporaryPath();
    const overflow = Buffer.alloc(CONFIG_SPEC_BYTE_LIMIT + 1, 0x61);
    let atomicWrites = 0;
    const openedFlags: Array<string | number> = [];
    const store = new ConfigStore(target, {
      io: {
        async lstat() {
          return { size: 1, isFile: () => true };
        },
        async open(_path, flags) {
          openedFlags.push(flags);
          return {
            async close() {},
            async read(buffer, offset, length) {
              const bytesRead = Math.min(length, overflow.byteLength);
              overflow.copy(buffer, offset, 0, bytesRead);
              return { bytesRead };
            },
            async stat() {
              return { size: 1, isFile: () => true };
            },
            async sync() {},
            async writeFile() {},
          };
        },
        async writeAtomic() {
          atomicWrites += 1;
        },
      },
    });

    await expect(store.load()).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.tooLarge,
      etag: undefined,
    });
    await expect(
      store.save(fixture(), {
        ifMatch: '"sha256-not-computed"',
        recovery: "backup-and-replace",
      }),
    ).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.tooLarge,
      etag: undefined,
    });
    expect(openedFlags.every((flags) => typeof flags === "number")).toBe(true);
    expect(atomicWrites).toBe(0);
  });

  test("rejects a target swapped between lstat and the no-follow open", async () => {
    const target = await temporaryPath();
    let reads = 0;
    const store = new ConfigStore(target, {
      io: {
        async lstat() {
          return { dev: 1, ino: 10, size: 1, isFile: () => true };
        },
        async open() {
          return {
            async close() {},
            async read() {
              reads += 1;
              return { bytesRead: 0 };
            },
            async stat() {
              return { dev: 1, ino: 11, size: 1, isFile: () => true };
            },
            async sync() {},
            async writeFile() {},
          };
        },
      },
    });
    await expect(store.load()).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.unsafeFile,
      etag: undefined,
    });
    expect(reads).toBe(0);
  });

  test("serializes simultaneous stale updates so exactly one wins", async () => {
    const target = await temporaryPath();
    const store = new ConfigStore(target);
    const initial = await store.save(fixture("Initial"), { ifNoneMatch: "*" });

    const results = await Promise.allSettled([
      store.save(fixture("First"), { ifMatch: initial.etag }),
      store.save(fixture("Second"), { ifMatch: initial.etag }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejection = results.find(({ status }) => status === "rejected");
    expect(rejection).toMatchObject({
      reason: { code: CONFIG_STORE_ERROR_CODES.conflict },
    });
    const finalName = (await store.load()).config.profiles[0]!.displayName;
    expect(["First", "Second"]).toContain(finalName);
  });

  test("classifies malformed UTF-8 with a raw ETag and recovers byte-identically", async () => {
    const target = await temporaryPath();
    const raw = Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d]);
    await writeFile(target, raw);
    const firstSuffix = "01020304";
    const secondSuffix = "05060708";
    const fixedDate = new Date("2026-08-23T01:02:03.456Z");
    const collision = `${target}.invalid-20260823T010203Z-${firstSuffix}.bak`;
    await writeFile(collision, "sentinel");
    const randomSizes: number[] = [];
    const suffixes = [firstSuffix, secondSuffix];
    const modeCalls: Array<[string, number]> = [];
    const store = new ConfigStore(target, {
      now: () => fixedDate,
      randomBytes: (size) => {
        randomSizes.push(size);
        return Buffer.from(suffixes.shift()!, "hex");
      },
      applyMode: async (path, mode) => {
        modeCalls.push([path, mode]);
      },
    });

    let invalidFailure: unknown;
    try {
      await store.load();
    } catch (error) {
      invalidFailure = error;
    }
    expect(invalidFailure).toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.invalid,
      etag: independentEtag(raw),
    });

    const etag = (invalidFailure as ConfigStoreFailure).etag!;
    await store.save(fixture("Recovered"), {
      ifMatch: etag,
      recovery: "backup-and-replace",
    });
    const backup = `${target}.invalid-20260823T010203Z-${secondSuffix}.bak`;
    expect((await readFile(collision, "utf8"))).toBe("sentinel");
    expect((await readFile(backup)).equals(raw)).toBe(true);
    expect(randomSizes).toEqual([4, 4]);
    expect(modeCalls).toEqual([
      [backup, CONFIG_FILE_MODE],
      [target, CONFIG_FILE_MODE],
    ]);
  });

  test("caps recovery at eight EEXIST collisions and never replaces the target", async () => {
    const target = await temporaryPath();
    const raw = Buffer.from("{ invalid", "utf8");
    await writeFile(target, raw);
    const suffix = "11111111";
    const backup = `${target}.invalid-20260823T010203Z-${suffix}.bak`;
    await writeFile(backup, "occupied");
    let randomCalls = 0;
    const store = new ConfigStore(target, {
      now: () => new Date("2026-08-23T01:02:03Z"),
      randomBytes: () => {
        randomCalls += 1;
        return Buffer.from(suffix, "hex");
      },
    });

    await expect(
      store.save(fixture(), {
        ifMatch: computeConfigEtag(raw),
        recovery: "backup-and-replace",
      }),
    ).rejects.toSatisfy(
      (error: unknown) => failureCode(error) === CONFIG_STORE_ERROR_CODES.io,
    );
    expect(randomCalls).toBe(8);
    expect((await readFile(target)).equals(raw)).toBe(true);
  });

  test("does not retry non-EEXIST backup failures and preserves the target", async () => {
    const target = await temporaryPath();
    const raw = Buffer.from("not json", "utf8");
    await writeFile(target, raw);
    let randomCalls = 0;
    const store = new ConfigStore(target, {
      randomBytes: () => {
        randomCalls += 1;
        return Buffer.from("22222222", "hex");
      },
      io: {
        async open(path, flags, mode) {
          if (flags === "wx") {
            const error = new Error("private I/O canary") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
          return (await open(path, flags, mode)) as ConfigFileHandle;
        },
      },
    });
    await expect(
      store.save(fixture(), {
        ifMatch: computeConfigEtag(raw),
        recovery: "backup-and-replace",
      }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.io });
    expect(randomCalls).toBe(1);
    expect((await readFile(target)).equals(raw)).toBe(true);
  });

  test("maps lstat/open/stat/read/close faults to safe I/O failures", async () => {
    const stages = ["lstat", "open", "stat", "read", "close"] as const;

    for (const stage of stages) {
      const target = await temporaryPath();
      await writeFile(target, serializeAppConfig(fixture()));
      const fault = (): never => {
        throw new Error(`private-${stage}-canary`);
      };
      const store = new ConfigStore(target, {
        io:
          stage === "lstat"
            ? { lstat: async () => fault() }
            : {
                async open(path, flags, mode) {
                  if (stage === "open") {
                    fault();
                  }
                  const handle = await open(path, flags, mode);
                  return {
                    async close() {
                      if (stage === "close") {
                        await handle.close();
                        fault();
                      }
                      await handle.close();
                    },
                    async read(buffer, offset, length, position) {
                      if (stage === "read") {
                        fault();
                      }
                      return await handle.read(buffer, offset, length, position);
                    },
                    async stat() {
                      if (stage === "stat") {
                        fault();
                      }
                      return await handle.stat();
                    },
                    async sync() {
                      await handle.sync();
                    },
                    async writeFile(data) {
                      await handle.writeFile(data);
                    },
                  } satisfies ConfigFileHandle;
                },
              },
      });

      await expect(store.load()).rejects.toMatchObject({
        code: CONFIG_STORE_ERROR_CODES.io,
        message: "The local profile configuration operation failed.",
      });
    }
  });

  test.each(["write", "sync", "close"] as const)(
    "never replaces the invalid target when backup %s fails",
    async (stage) => {
      const target = await temporaryPath();
      const raw = Buffer.from("{broken", "utf8");
      await writeFile(target, raw);
      let replacements = 0;
      const fault = (): never => {
        throw new Error(`private-backup-${stage}-canary`);
      };
      const store = new ConfigStore(target, {
        randomBytes: () => Buffer.from("33333333", "hex"),
        io: {
          async open(path, flags, mode) {
            if (flags !== "wx") {
              return (await open(path, flags, mode)) as ConfigFileHandle;
            }
            return {
              async close() {
                if (stage === "close") {
                  fault();
                }
              },
              async read() {
                return { bytesRead: 0 };
              },
              async stat() {
                return { size: 0, isFile: () => true };
              },
              async sync() {
                if (stage === "sync") {
                  fault();
                }
              },
              async writeFile() {
                if (stage === "write") {
                  fault();
                }
              },
            };
          },
          async writeAtomic() {
            replacements += 1;
          },
        },
      });

      await expect(
        store.save(fixture(), {
          ifMatch: computeConfigEtag(raw),
          recovery: "backup-and-replace",
        }),
      ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.io });
      expect(replacements).toBe(0);
      expect((await readFile(target)).equals(raw)).toBe(true);
    },
  );

  test("treats mode reapplication as best effort on save and recovery", async () => {
    const createTarget = await temporaryPath();
    const throwingMode = async (): Promise<void> => {
      throw new Error("private-mode-canary");
    };
    await expect(
      new ConfigStore(createTarget, { applyMode: throwingMode }).save(fixture(), {
        ifNoneMatch: "*",
      }),
    ).resolves.toMatchObject({ config: fixture() });

    const recoveryTarget = await temporaryPath();
    const raw = Buffer.from("invalid", "utf8");
    await writeFile(recoveryTarget, raw);
    await expect(
      new ConfigStore(recoveryTarget, {
        applyMode: throwingMode,
        randomBytes: () => Buffer.from("44444444", "hex"),
      }).save(fixture(), {
        ifMatch: computeConfigEtag(raw),
        recovery: "backup-and-replace",
      }),
    ).resolves.toMatchObject({ config: fixture() });
  });

  test("preserves future, oversized, unsafe, and atomically failed targets", async () => {
    const futureTarget = await temporaryPath();
    const futureRaw = Buffer.from('{"schemaVersion":3,"private":"canary"}\n');
    await writeFile(futureTarget, futureRaw);
    const futureStore = new ConfigStore(futureTarget);
    await expect(futureStore.load()).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.versionUnsupported,
      etag: computeConfigEtag(futureRaw),
    });
    await expect(
      futureStore.save(fixture(), {
        ifMatch: computeConfigEtag(futureRaw),
        recovery: "backup-and-replace",
      }),
    ).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.versionUnsupported,
      etag: independentEtag(futureRaw),
    });
    const oversizedFutureRequest = exactSizedConfig();
    const extendableFutureField = oversizedFutureRequest.profiles.find(
      ({ displayName }) => (displayName?.length ?? 0) < 40,
    );
    if (
      extendableFutureField === undefined ||
      extendableFutureField.displayName === undefined
    ) {
      throw new Error("The future precedence fixture had no extendable field.");
    }
    extendableFutureField.displayName += "é";
    await expect(
      futureStore.save(oversizedFutureRequest, {
        ifMatch: independentEtag(futureRaw),
      }),
    ).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.versionUnsupported,
      etag: independentEtag(futureRaw),
    });
    expect((await readFile(futureTarget)).equals(futureRaw)).toBe(true);

    const largeTarget = await temporaryPath();
    await writeFile(
      largeTarget,
      Buffer.alloc(CONFIG_SPEC_BYTE_LIMIT + 1, 0x61),
    );
    const largeStore = new ConfigStore(largeTarget);
    await expect(largeStore.load()).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.tooLarge,
      etag: undefined,
    });
    await expect(
      largeStore.save(fixture(), {
        ifMatch: '"sha256-not-computed"',
        recovery: "backup-and-replace",
      }),
    ).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.tooLarge,
      etag: undefined,
    });
    expect((await readdir(dirname(largeTarget))).some((name) => name.endsWith(".bak"))).toBe(false);

    const directoryTarget = await temporaryPath();
    await rm(directoryTarget, { force: true });
    await (await import("node:fs/promises")).mkdir(directoryTarget);
    const directoryStore = new ConfigStore(directoryTarget);
    await expect(directoryStore.load()).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.unsafeFile,
      etag: undefined,
    });
    await expect(
      directoryStore.save(fixture(), {
        ifMatch: '"sha256-not-computed"',
        recovery: "backup-and-replace",
      }),
    ).rejects.toMatchObject({
      code: CONFIG_STORE_ERROR_CODES.unsafeFile,
      etag: undefined,
    });
    expect((await readdir(dirname(directoryTarget))).some((name) => name.endsWith(".bak"))).toBe(false);

    const symlinkTarget = await temporaryPath();
    const referent = `${symlinkTarget}.referent`;
    await writeFile(referent, serializeAppConfig(fixture()));
    try {
      await symlink(referent, symlinkTarget, "file");
      await expect(new ConfigStore(symlinkTarget).load()).rejects.toMatchObject({
        code: CONFIG_STORE_ERROR_CODES.unsafeFile,
      });
      await expect(
        new ConfigStore(symlinkTarget).save(fixture(), {
          ifMatch: '"sha256-not-computed"',
          recovery: "backup-and-replace",
        }),
      ).rejects.toMatchObject({
        code: CONFIG_STORE_ERROR_CODES.unsafeFile,
        etag: undefined,
      });
      expect((await readFile(referent)).equals(serializeAppConfig(fixture()))).toBe(true);
      expect((await readdir(dirname(symlinkTarget))).some((name) => name.endsWith(".bak"))).toBe(false);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EPERM")) {
        throw error;
      }
    }

    const validTarget = await temporaryPath();
    const validRaw = serializeAppConfig(fixture("Prior"));
    await writeFile(validTarget, validRaw);
    const failingStore = new ConfigStore(validTarget, {
      io: {
        async writeAtomic() {
          throw new Error("private replacement canary");
        },
      },
    });
    await expect(
      failingStore.save(fixture("New"), {
        ifMatch: computeConfigEtag(validRaw),
      }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.io });
    expect((await readFile(validTarget)).equals(validRaw)).toBe(true);
  });
});

/**
 * The first explicit save upgrades a version 1 file (plan Appendix B.2): the
 * serialized-size check, then a byte-identical `.v1-` backup through the
 * exclusive routine, then the atomic version 2 replace. Reads never write.
 */
describe("ConfigStore version 1 upgrade", () => {
  test("three loads of v1 bytes report version 1 with the raw ETag and change nothing on disk", async () => {
    const { target, raw, v1 } = await seededV1();
    const before = await stat(target);
    const listing = await readdir(dirname(target));
    const store = new ConfigStore(target);
    for (let read = 0; read < 3; read += 1) {
      const loaded = await store.load();
      expect(loaded.storedSchemaVersion).toBe(1);
      expect(loaded.etag).toBe(independentEtag(raw));
      expect(loaded.config).toEqual(migratedOf(v1));
      expect(loaded).not.toHaveProperty("upgrade");
    }
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect((await stat(target)).mtimeMs).toBe(before.mtimeMs);
    expect(await readdir(dirname(target))).toEqual(listing);
  });

  test("the first save writes one byte-identical v1 backup, opened wx 0600 and synced before the replace", async () => {
    const { target, raw, v1 } = await seededV1(3);
    const events: string[] = [];
    const store = new ConfigStore(target, {
      now: () => new Date("2026-09-29T08:07:06.543Z"),
      randomBytes: () => Buffer.from("0a1b2c3d", "hex"),
      io: {
        async open(path, flags, mode) {
          const handle = (await open(path, flags, mode)) as ConfigFileHandle;
          if (flags !== "wx") {
            return handle;
          }
          events.push(`open ${String(flags)} ${String(mode)}`);
          return {
            close: async () => {
              events.push("close");
              await handle.close();
            },
            read: async (buffer, offset, length, position) =>
              await handle.read(buffer, offset, length, position),
            stat: async () => await handle.stat(),
            sync: async () => {
              events.push("sync");
              await handle.sync();
            },
            writeFile: async (data) => {
              events.push("write");
              await handle.writeFile(data);
            },
          };
        },
        async writeAtomic(path, data) {
          events.push("writeAtomic");
          await writeFile(path, data);
        },
      },
    });

    const saved = await store.save(migratedOf(v1), { ifMatch: independentEtag(raw) });
    expect(events).toEqual([
      `open wx ${CONFIG_FILE_MODE}`,
      "write",
      "sync",
      "close",
      "writeAtomic",
    ]);
    const backups = await backupNames(target);
    expect(backups).toEqual(["children.local.json.v1-20260929T080706Z-0a1b2c3d.bak"]);
    expect(backups[0]).toMatch(V1_BACKUP_NAME);
    expect((await readFile(join(dirname(target), backups[0]!))).equals(raw)).toBe(true);
    expect((await readFile(target)).equals(serializeAppConfig(migratedOf(v1)))).toBe(true);
    expect(saved.storedSchemaVersion).toBe(2);
    expect(saved.upgrade).toEqual({
      fromVersion: 1,
      toVersion: 2,
      profilesUpgraded: 3,
      legacyChoicesCarried: 3,
      backupWritten: true,
    });
    const classified = classifyStoredConfig(v1);
    expect(saved.upgrade).toEqual(
      classified.kind === "legacy" ? { ...classified.report, backupWritten: true } : undefined,
    );
    const reloaded = await store.load();
    expect(reloaded.storedSchemaVersion).toBe(2);
    expect(reloaded.etag).toBe(saved.etag);
  });

  test("a second save writes no further backup and resolves without upgrade", async () => {
    const { target, raw, v1 } = await seededV1();
    const store = new ConfigStore(target);
    const first = await store.save(migratedOf(v1), { ifMatch: independentEtag(raw) });
    expect(first.upgrade?.backupWritten).toBe(true);
    const second = await store.save(
      { ...migratedOf(v1), profiles: [profile(9, "Added")] },
      { ifMatch: first.etag },
    );
    expect(second).not.toHaveProperty("upgrade");
    expect(second.storedSchemaVersion).toBe(2);
    expect(await backupNames(target)).toHaveLength(1);
  });

  test("a create on a missing file and a recovery save resolve without upgrade", async () => {
    const created = await new ConfigStore(await temporaryPath()).save(fixture(), {
      ifNoneMatch: "*",
    });
    expect(created).not.toHaveProperty("upgrade");

    const recoveryTarget = await temporaryPath();
    const invalidRaw = Buffer.from('{"schemaVersion":1,"profiles":"broken"}', "utf8");
    await writeFile(recoveryTarget, invalidRaw);
    const recovered = await new ConfigStore(recoveryTarget, {
      randomBytes: () => Buffer.from("55555555", "hex"),
    }).save(fixture("Recovered"), {
      ifMatch: independentEtag(invalidRaw),
      recovery: "backup-and-replace",
    });
    expect(recovered).not.toHaveProperty("upgrade");
    expect(recovered.storedSchemaVersion).toBe(2);
    const backups = await backupNames(recoveryTarget);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/\.invalid-\d{8}T\d{6}Z-55555555\.bak$/u);
  });

  test("an EEXIST collision succeeds within eight attempts", async () => {
    const { target, raw, v1 } = await seededV1();
    const timestamp = "20260929T010203Z";
    const suffixes = Array.from({ length: 8 }, (_, index) => `${index + 1}`.repeat(8));
    for (const suffix of suffixes.slice(0, 7)) {
      await writeFile(`${target}.v1-${timestamp}-${suffix}.bak`, "occupied");
    }
    const drawn = [...suffixes];
    const store = new ConfigStore(target, {
      now: () => new Date("2026-09-29T01:02:03Z"),
      randomBytes: () => Buffer.from(drawn.shift()!, "hex"),
    });
    const saved = await store.save(migratedOf(v1), { ifMatch: independentEtag(raw) });
    expect(saved.upgrade?.backupWritten).toBe(true);
    expect(drawn).toEqual([]);
    expect(
      (await readFile(`${target}.v1-${timestamp}-${suffixes[7]}.bak`)).equals(raw),
    ).toBe(true);
    for (const suffix of suffixes.slice(0, 7)) {
      expect(await readFile(`${target}.v1-${timestamp}-${suffix}.bak`, "utf8")).toBe("occupied");
    }
  });

  test("the eighth collision returns CONFIG_IO_ERROR with the v1 target byte-identical", async () => {
    const { target, raw, v1 } = await seededV1();
    await writeFile(`${target}.v1-20260929T010203Z-77777777.bak`, "occupied");
    let draws = 0;
    const store = new ConfigStore(target, {
      now: () => new Date("2026-09-29T01:02:03Z"),
      randomBytes: () => {
        draws += 1;
        return Buffer.from("77777777", "hex");
      },
    });
    await expect(
      store.save(migratedOf(v1), { ifMatch: independentEtag(raw) }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.io });
    expect(draws).toBe(8);
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect(await backupNames(target)).toEqual(["children.local.json.v1-20260929T010203Z-77777777.bak"]);
  });

  test("a non-EEXIST backup failure returns CONFIG_IO_ERROR with the v1 target byte-identical", async () => {
    const { target, raw, v1 } = await seededV1();
    let atomicWrites = 0;
    const store = new ConfigStore(target, {
      io: {
        async open(path, flags, mode) {
          if (flags === "wx") {
            const error = new Error("private backup canary") as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
          return (await open(path, flags, mode)) as ConfigFileHandle;
        },
        async writeAtomic() {
          atomicWrites += 1;
        },
      },
    });
    await expect(
      store.save(migratedOf(v1), { ifMatch: independentEtag(raw) }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.io });
    expect(atomicWrites).toBe(0);
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect(await backupNames(target)).toEqual([]);
  });

  test("a stale ETag against v1 returns CONFIG_CONFLICT and writes no backup", async () => {
    const { target, raw, v1 } = await seededV1();
    await expect(
      new ConfigStore(target).save(migratedOf(v1), { ifMatch: '"sha256-stale"' }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.conflict });
    await expect(
      new ConfigStore(target).save(migratedOf(v1), {
        ifMatch: independentEtag(raw),
        recovery: "backup-and-replace",
      }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.recoveryNotAllowed });
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect(await backupNames(target)).toEqual([]);
  });

  test("an upgrade whose v2 bytes exceed 65,536 returns CONFIG_SERIALIZED_TOO_LARGE with no backup and no change", async () => {
    const { target, raw } = await seededV1(1);
    const oversized = exactSizedConfig();
    const extendable = oversized.profiles.find(
      ({ displayName }) => (displayName?.length ?? 0) < 40,
    );
    if (extendable === undefined || extendable.displayName === undefined) {
      throw new Error("The oversized upgrade fixture had no extendable field.");
    }
    extendable.displayName += "z";
    expect(specPrettyBytes(oversized).byteLength).toBe(CONFIG_SPEC_BYTE_LIMIT + 1);
    await expect(
      new ConfigStore(target).save(oversized, { ifMatch: independentEtag(raw) }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.serializedTooLarge });
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect(await backupNames(target)).toEqual([]);
  });

  test("a failed replace after the backup keeps the v1 target and the backup; the next save backs up again", async () => {
    const { target, raw, v1 } = await seededV1();
    const suffixes = ["abababab", "cdcdcdcd"];
    let failReplace = true;
    const store = new ConfigStore(target, {
      randomBytes: () => Buffer.from(suffixes.shift()!, "hex"),
      io: {
        async writeAtomic(path, data) {
          if (failReplace) {
            throw new Error("private replace canary");
          }
          await writeFile(path, data);
        },
      },
    });
    await expect(
      store.save(migratedOf(v1), { ifMatch: independentEtag(raw) }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.io });
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect(await backupNames(target)).toHaveLength(1);

    failReplace = false;
    const saved = await store.save(migratedOf(v1), { ifMatch: independentEtag(raw) });
    expect(saved.upgrade?.backupWritten).toBe(true);
    const backups = await backupNames(target);
    expect(backups).toHaveLength(2);
    for (const name of backups) {
      expect(name).toMatch(V1_BACKUP_NAME);
      expect((await readFile(join(dirname(target), name))).equals(raw)).toBe(true);
    }
  });

  test("a version 1 PUT body is refused before it can touch a v1 file", async () => {
    const { target, raw, v1 } = await seededV1();
    await expect(
      new ConfigStore(target).save(v1 as unknown as AppConfigV2, {
        ifMatch: independentEtag(raw),
      }),
    ).rejects.toMatchObject({ code: CONFIG_STORE_ERROR_CODES.invalid });
    expect((await readFile(target)).equals(raw)).toBe(true);
    expect(await backupNames(target)).toEqual([]);
  });
});
