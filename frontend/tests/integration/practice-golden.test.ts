import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  GOLDEN_SEEDS,
  TEMPORARY_PREFIX,
  buildGoldenRuntimeRecords,
  compareCaptureBytes,
  compareDependencyManifests,
  runBounded,
  type BoundedRunError,
} from "../../scripts/capture-practice-golden.mjs";
import {
  PRESENTATION_BANDS,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "../../src/shared/config/enums.js";
import {
  ChildProfileV1Schema,
  type GenerationDefaultsV1,
} from "../../src/shared/config/legacy-v1.js";
import { MATH_PRESETS } from "../../src/shared/config/math-presets.js";
import { classifyStoredConfig } from "../../src/shared/config/migrate.js";
import { canonicalContentKey } from "../../src/shared/worksheet/invariants.js";
import {
  capabilityProfileOf,
  projectGenerationRequest,
  type CapabilityProfileV1,
} from "../../src/shared/worksheet/project-request.js";
import { getWorksheetRegistration } from "../../src/shared/worksheet/registry.js";
import {
  WORKSHEET_TYPE_IDS,
  type PrintScale,
  type WorksheetLength,
  type WorksheetType,
} from "../../src/shared/worksheet/types.js";

/**
 * The enforced content-equivalence proof. `practice-content-keys.json` is the
 * Practice content-key grid that `scripts/capture-practice-golden.mjs`
 * captured from 5c22159's exported tree. Every committed key is parsed back
 * into its record, family, length, scale and seed, and that cell is generated
 * again through the current path: each record is read as a stored version 1
 * file through the store's own classifier, flattened back to capabilities by
 * `capabilityProfileOf` and projected at Practice. The pinned file digest
 * keeps the grid itself frozen. Nothing here calls git, so the suite also runs in the release
 * clean room and in a shallow CI checkout.
 */

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GRID_PATH = resolve(frontendRoot, "tests/fixtures/golden/practice-content-keys.json");
const FIXTURE_PATH = resolve(frontendRoot, "tests/fixtures/config/children.v1.json");
const SCRIPT_PATH = resolve(frontendRoot, "scripts/capture-practice-golden.mjs");

const GRID_SHA256 = "49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41";

interface GoldenCell {
  readonly record: string;
  readonly family: WorksheetType;
  readonly length: WorksheetLength;
  readonly scale: PrintScale;
  readonly seed: string;
}

const sha256 = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/** Runs a file with Node and settles with its exit code (nonzero or -1 on any failure) and stdout. */
function runNode(
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ exit: number; stdout: string }> {
  return new Promise((accept) => {
    execFile(process.execPath, [...args], { ...options, windowsHide: true }, (error, stdout) => {
      accept({
        exit: error === null ? 0 : typeof error.code === "number" ? error.code : -1,
        stdout: String(stdout),
      });
    });
  });
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/** Polls until the process is gone, for at most ten seconds. */
async function exitsWithin(pid: number): Promise<boolean> {
  const deadline = Date.now() + 10_000;
  while (isRunning(pid)) {
    if (Date.now() > deadline) {
      return false;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  return true;
}

function forceKill(pid: number | undefined): void {
  if (pid !== undefined && Number.isInteger(pid) && pid > 0 && isRunning(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
}

async function rejectionOf(run: Promise<unknown>): Promise<BoundedRunError> {
  const outcome = await run.then(
    () => undefined,
    (error: unknown) => error as BoundedRunError,
  );
  if (outcome === undefined) {
    throw new Error("runBounded resolved where a rejection was expected.");
  }
  return outcome;
}

const gridBytes = readFileSync(GRID_PATH);
const committedGrid = JSON.parse(gridBytes.toString("utf8")) as Record<string, string>;
const committedKeys = Object.keys(committedGrid);

/**
 * The capability view of every profile a stored version 1 file holds, read
 * exactly as the store reads one: the classifier upgrades it in memory, and
 * `capabilityProfileOf` flattens each profile's `legacyChoices`.
 */
function capabilitiesThroughClassifier(stored: unknown): readonly CapabilityProfileV1[] {
  const classified = classifyStoredConfig(stored);
  if (classified.kind !== "legacy") {
    throw new Error(`A golden source classified as ${classified.kind}, not legacy.`);
  }
  return classified.config.profiles.map((profile) => {
    const capabilities = capabilityProfileOf(profile);
    if (capabilities === undefined) {
      throw new Error("A migrated golden profile carried no earlier settings.");
    }
    return capabilities;
  });
}

const runtimeRecords = buildGoldenRuntimeRecords(MATH_PRESETS, WRITING_MODES, PRESENTATION_BANDS);
const runtimeProfiles = capabilitiesThroughClassifier({
  schemaVersion: 1,
  profiles: runtimeRecords.map(({ profile }) => ChildProfileV1Schema.parse(profile)),
  defaults: {
    useDisplayName: false,
    useInterests: true,
    includeDecorativeGraphics: true,
    difficulty: "practice",
    length: "standard",
    includeAnswerKey: true,
    paperSize: "letter",
    printScale: "standard",
  },
});
const records: ReadonlyMap<string, CapabilityProfileV1> = new Map([
  ...capabilitiesThroughClassifier(JSON.parse(readFileSync(FIXTURE_PATH, "utf8"))).map(
    (profile, index) => [`canonical-${index + 1}`, profile] as const,
  ),
  ...runtimeRecords.map(({ record }, index) => [record, runtimeProfiles[index]!] as const),
]);

function isMember<T extends string>(values: readonly T[], value: string | undefined): value is T {
  return value !== undefined && (values as readonly string[]).includes(value);
}

/** DD13's case-id rule: `<record>/<family>/<length>/<scale>/<seed>`, every segment known. */
function parseCaseId(key: string, knownRecords: ReadonlySet<string>): GoldenCell {
  const [record, family, length, scale, seed, ...extra] = key.split("/");
  if (
    extra.length > 0 ||
    record === undefined ||
    !knownRecords.has(record) ||
    !isMember(WORKSHEET_TYPE_IDS, family) ||
    !isMember(WORKSHEET_LENGTHS, length) ||
    !isMember(PRINT_SCALES, scale) ||
    !isMember(GOLDEN_SEEDS, seed) ||
    !/^[0-9a-f]{8}$/u.test(seed)
  ) {
    throw new Error(`The golden key ${key} does not parse into five known segments.`);
  }
  return { record, family, length, scale, seed };
}

/**
 * The current path for one cell: the unchanged Version 1 projection at
 * Practice, then the registered generator, exactly as the app creates a
 * worksheet. A refused cell yields `undefined`.
 */
function currentCellHash(profile: CapabilityProfileV1, cell: GoldenCell): string | undefined {
  const registration = getWorksheetRegistration(cell.family);
  const preferences: GenerationDefaultsV1 = {
    useDisplayName: false,
    useInterests: true,
    includeDecorativeGraphics: true,
    difficulty: "practice",
    length: cell.length,
    includeAnswerKey: true,
    paperSize: "letter",
    printScale: cell.scale,
  };
  const projection = projectGenerationRequest({
    profile,
    worksheetType: cell.family,
    generatorVersion: registration.generatorVersion,
    seed: cell.seed,
    preferences,
  });
  if (!projection.ok) {
    return undefined;
  }
  const result = registration.generate(projection.request, {
    worksheetId: "11111111-1111-4111-8111-111111111111",
  });
  return result.ok ? sha256(canonicalContentKey(result.document.items)) : undefined;
}

function recordProfile(record: string): CapabilityProfileV1 {
  const profile = records.get(record);
  if (profile === undefined) {
    throw new Error(`Unknown golden record ${record}.`);
  }
  return profile;
}

const knownRecords = new Set(records.keys());
const cellsByRecord = new Map<string, { key: string; cell: GoldenCell }[]>();
for (const key of committedKeys) {
  const cell = parseCaseId(key, knownRecords);
  cellsByRecord.set(cell.record, [...(cellsByRecord.get(cell.record) ?? []), { key, cell }]);
}

describe("the committed Practice content-key grid", () => {
  test("keeps its pinned file digest", () => {
    expect(sha256(gridBytes)).toBe(GRID_SHA256);
  });

  test("is sorted two-space JSON with one trailing LF and holds only hashes", () => {
    const sortedKeys = [...committedKeys].sort();
    expect(committedKeys).toEqual(sortedKeys);
    expect(gridBytes.toString("utf8")).toBe(`${JSON.stringify(committedGrid, null, 2)}\n`);
    for (const value of Object.values(committedGrid)) {
      expect(value).toMatch(/^[0-9a-f]{64}$/u);
    }
  });

  test("names every record, and every key parses into five known segments", () => {
    expect([...cellsByRecord.keys()].sort()).toEqual([...knownRecords].sort());
    expect(committedKeys.length).toBeGreaterThan(0);
  });

  test("calibration: a key that does not parse into five known segments fails", () => {
    const valid = committedKeys[0]!;
    const [record, family, length, scale, seed] = valid.split("/");
    for (const broken of [
      [record, family, length, scale].join("/"),
      [record, family, length, scale, seed, "extra"].join("/"),
      ["unknown-record", family, length, scale, seed].join("/"),
      [record, "unknown-family", length, scale, seed].join("/"),
      [record, family, "medium", scale, seed].join("/"),
      [record, family, length, "huge", seed].join("/"),
      [record, family, length, scale, "00000005"].join("/"),
    ]) {
      expect(() => parseCaseId(broken, knownRecords), broken).toThrow();
    }
    expect(parseCaseId(valid, knownRecords).record).toBe(record);
  });
});

describe("the current path reproduces every committed hash", () => {
  test.each([...knownRecords].sort())("%s", (record) => {
    const profile = recordProfile(record);
    const cells = cellsByRecord.get(record) ?? [];
    expect(cells.length).toBeGreaterThan(0);
    const mismatched = cells
      .filter(({ key, cell }) => currentCellHash(profile, cell) !== committedGrid[key])
      .map(({ key }) => key);
    expect(mismatched).toEqual([]);
  });

  test("the current path generates no cell the grid lacks", () => {
    const generated: string[] = [];
    for (const [record, profile] of records) {
      for (const family of WORKSHEET_TYPE_IDS) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const scale of PRINT_SCALES) {
            for (const seed of GOLDEN_SEEDS) {
              const cell = { record, family, length, scale, seed };
              if (currentCellHash(profile, cell) !== undefined) {
                generated.push([record, family, length, scale, seed].join("/"));
              }
            }
          }
        }
      }
    }
    expect(generated.sort()).toEqual(committedKeys);
  });

  test("calibration: operandMax minus one changes at least one hash", () => {
    let perturbedCells = 0;
    let changed = 0;
    for (const [record, cells] of cellsByRecord) {
      const profile = recordProfile(record);
      if (profile.mathSkills.operandMax <= 1) {
        continue;
      }
      const perturbed: CapabilityProfileV1 = {
        ...profile,
        mathSkills: { ...profile.mathSkills, operandMax: profile.mathSkills.operandMax - 1 },
      };
      for (const { key, cell } of cells) {
        perturbedCells += 1;
        if (currentCellHash(perturbed, cell) !== committedGrid[key]) {
          changed += 1;
        }
      }
    }
    expect(perturbedCells).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(0);
  });
});

describe("the capture tool's pure comparisons", () => {
  test("compareCaptureBytes accepts identical bytes and rejects a one-byte difference", () => {
    const same = compareCaptureBytes(gridBytes, Buffer.from(gridBytes));
    expect(same).toEqual({ equal: true, actualSha256: GRID_SHA256, expectedSha256: GRID_SHA256 });
    const changed = Buffer.from(gridBytes);
    changed[changed.length - 2] = changed[changed.length - 2] === 0x7d ? 0x20 : 0x7d;
    const different = compareCaptureBytes(gridBytes, changed);
    expect(different.equal).toBe(false);
    expect(different.actualSha256).toBe(GRID_SHA256);
    expect(different.expectedSha256).not.toBe(GRID_SHA256);
  });

  test("compareDependencyManifests accepts CRLF and scripts differences and refuses a dependency change", async () => {
    const working = {
      packageJson: await readFile(resolve(frontendRoot, "package.json"), "utf8"),
      packageLock: await readFile(resolve(frontendRoot, "package-lock.json"), "utf8"),
    };
    const manifest = JSON.parse(working.packageJson) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(compareDependencyManifests(working, working)).toEqual({ compatible: true, differences: [] });

    const lfLock = working.packageLock.replaceAll("\r\n", "\n");
    const crlfLock = lfLock.replaceAll("\n", "\r\n");
    expect(crlfLock).not.toBe(lfLock);
    expect(
      compareDependencyManifests({ ...working, packageLock: crlfLock }, { ...working, packageLock: lfLock }),
    ).toEqual({ compatible: true, differences: [] });

    const changedScripts = {
      ...working,
      packageJson: JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, test: "vitest run --changed" } }),
    };
    expect(compareDependencyManifests(changedScripts, working)).toEqual({ compatible: true, differences: [] });

    const changedDependency = {
      ...working,
      packageJson: JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, zod: "4.0.0" } }),
    };
    expect(compareDependencyManifests(changedDependency, working)).toEqual({
      compatible: false,
      differences: ["package.json dependencies"],
    });
  });

  test("the script exits nonzero for a nonexistent ref and leaves no temporary export", async () => {
    // The script runs with its temporary directory redirected to one this test
    // owns, so a concurrent real capture elsewhere on the machine cannot interfere.
    const ownedTemporary = await mkdtemp(join(tmpdir(), "extra-credit-negative-ref-"));
    try {
      const env = { ...process.env, TEMP: ownedTemporary, TMP: ownedTemporary, TMPDIR: ownedTemporary };
      // Calibration: a child with this environment resolves os.tmpdir() to the owned directory.
      const probe = await runNode(["-e", "process.stdout.write(require('node:os').tmpdir())"], { env });
      expect(probe.exit).toBe(0);
      expect(resolve(probe.stdout)).toBe(resolve(ownedTemporary));

      const run = await runNode([SCRIPT_PATH, "extra-credit-nonexistent-golden-ref"], { cwd: frontendRoot, env });
      expect(run.exit).not.toBe(0);
      expect((await readdir(ownedTemporary)).filter((name) => name.startsWith(TEMPORARY_PREFIX))).toEqual([]);
    } finally {
      await rm(ownedTemporary, { recursive: true, force: true });
    }
  });
});

describe("the capture tool's bounded child process", () => {
  // The child starts a grandchild that shares its output pipes, prints the
  // grandchild's pid and then never exits; neither process ends on its own. On
  // Windows the grandchild starts detached, which keeps it out of the child's
  // kill-on-close job object, so killing the child alone would leave it
  // running; elsewhere it stays in the child's process group, and the child's
  // death does not end it either.
  const treeSource = [
    'const { spawn } = require("node:child_process");',
    'const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: process.platform === "win32", stdio: ["ignore", "inherit", "inherit"], windowsHide: true });',
    'process.stdout.write("grandchild " + grandchild.pid + "\\n");',
    "setInterval(() => {}, 1000);",
  ].join("\n");

  test("resolves with the output on exit 0 and rejects on any other exit", async () => {
    await expect(
      runBounded(process.execPath, ["-e", 'process.stdout.write("done")'], { timeoutMs: 20_000 }),
    ).resolves.toEqual({ output: "done" });
    const failed = await rejectionOf(
      runBounded(process.execPath, ["-e", 'process.stderr.write("broken"); process.exit(3)'], { timeoutMs: 20_000 }),
    );
    expect(failed.message).toMatch(/failed \(exit 3, signal null\)/u);
    expect(failed.output).toBe("broken");
    await expect(runBounded(process.execPath, ["-e", ""], { timeoutMs: 0 })).rejects.toThrow(/positive finite/u);
  });

  test("kills the whole process tree when the bound expires, then rejects", async () => {
    let grandchild: number | undefined;
    let child: number | undefined;
    try {
      const expired = await rejectionOf(runBounded(process.execPath, ["-e", treeSource], { timeoutMs: 4_000 }));
      child = expired.pid;
      grandchild = Number(/grandchild (\d+)/u.exec(expired.output)?.[1]);
      expect(expired.message).toMatch(/did not finish within 4000 ms; its process tree was killed/u);
      expect(child).toBeTypeOf("number");
      expect(Number.isInteger(grandchild) && grandchild > 0).toBe(true);
      expect(await exitsWithin(child!)).toBe(true);
      expect(await exitsWithin(grandchild)).toBe(true);
    } finally {
      forceKill(grandchild);
      forceKill(child);
    }
  });

  test("kills the child and rejects at once when its signal aborts, long before the bound", async () => {
    const controller = new AbortController();
    const started = Date.now();
    const run = runBounded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      timeoutMs: 120_000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(new Error("interrupted by SIGINT")), 200);
    let child: number | undefined;
    try {
      const stopped = await rejectionOf(run);
      child = stopped.pid;
      expect(stopped.message).toMatch(/was stopped \(interrupted by SIGINT\); its process tree was killed/u);
      expect(Date.now() - started).toBeLessThan(60_000);
      expect(child).toBeTypeOf("number");
      expect(await exitsWithin(child!)).toBe(true);
    } finally {
      forceKill(child);
    }
  });
});
