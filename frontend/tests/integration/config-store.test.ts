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
  serializeAppConfigV1,
  type ConfigFileHandle,
} from "../../src/server/config-store.js";
import type { AppConfigV1, ChildProfileV1 } from "../../src/shared/config/schema.js";

const temporaryDirectories: string[] = [];
const CONFIG_SPEC_BYTE_LIMIT = 65_536;

function specPrettyBytes(config: AppConfigV1): Buffer {
  return Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function fixture(displayName = "Morgan"): AppConfigV1 {
  return {
    schemaVersion: 1,
    profiles: [profile(1, displayName)],
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

function profile(index: number, displayName = "A"): ChildProfileV1 {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
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
    interests: [],
  };
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

function exactSizedConfig(): AppConfigV1 {
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
    expect(serializeAppConfigV1(created.config).equals(expectedNormalizedBytes)).toBe(
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
      await writeFile(target, serializeAppConfigV1(fixture()));
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
    const futureRaw = Buffer.from('{"schemaVersion":2,"private":"canary"}\n');
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
    await writeFile(referent, serializeAppConfigV1(fixture()));
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
      expect((await readFile(referent)).equals(serializeAppConfigV1(fixture()))).toBe(true);
      expect((await readdir(dirname(symlinkTarget))).some((name) => name.endsWith(".bak"))).toBe(false);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EPERM")) {
        throw error;
      }
    }

    const validTarget = await temporaryPath();
    const validRaw = serializeAppConfigV1(fixture("Prior"));
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
