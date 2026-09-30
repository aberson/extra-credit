// Capture the Practice content-key grid of a fixed git ref.
//
//   node frontend/scripts/capture-practice-golden.mjs <ref>
//   node frontend/scripts/capture-practice-golden.mjs <ref> --compare <file>
//
// The first form prints the grid JSON on stdout. The second byte-compares that
// output with a committed file, prints both SHA-256 values and exits nonzero
// on any difference. Diagnostics go to stderr, so stdout stays the grid.
//
// The ref's tracked frontend/ tree is exported with `git archive` into a fresh
// temporary directory; no git worktree is registered. The checkout's installed
// frontend/node_modules is linked in (a directory junction on Windows), so the
// ref must declare the same dependencies: the guard below runs before anything
// is created. The capture form is Vitest source written against the ref's own
// modules and embedded here as text, so no tsconfig project, ESLint target or
// Vitest include of this repository compiles it. It needs the ref in local
// history, so it is a recorded Done-when command and never part of `check`.
//
// Every child process is bounded. The capture form's whole process tree is
// killed when its wall-clock bound expires, and SIGINT, SIGTERM or SIGHUP stops
// the run the same way, so the `finally` removal (link first, then export)
// always runs before the script exits.
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

const execFileAsync = promisify(execFile);

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(frontendRoot, "..");
const checkoutDependencies = join(frontendRoot, "node_modules");
const dependencySentinel = join(checkoutDependencies, "vitest", "package.json");

/** Every temporary export directory starts with this, under the OS temporary directory. */
export const TEMPORARY_PREFIX = "extra-credit-golden-";

/** The seeds of every grid cell, as eight lowercase hex digits. */
export const GOLDEN_SEEDS = Object.freeze(["00000001", "00000002", "00000003", "00000004"]);

const FIXTURE_RELATIVE = "tests/fixtures/config/children.v1.json";
const CAPTURE_FORM_RELATIVE = "tests/integration/golden-capture-form.test.ts";
const GIT_OUTPUT_LIMIT = 64 * 1024 * 1024;
/** The bound on each git or tar call. */
const TOOL_TIMEOUT_MS = 5 * 60 * 1000;
/** The capture form's wall-clock bound, above the form's own 600-second Vitest test timeout. */
const CAPTURE_FORM_TIMEOUT_MS = 12 * 60 * 1000;
/** How long a killed process tree may take to exit before the run rejects anyway. */
const KILL_WAIT_MS = 30 * 1000;
const INTERRUPT_SIGNALS = Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * The runtime-built fictional records of the grid, beside the three canonical
 * records of children.v1.json. Ten writing records cover every writing mode in
 * both presentation bands, and three arithmetic records carry the Dry Math
 * capabilities of MATH_PRESETS entries. Each is a Version 1 profile built as
 * object literals from the caller's own MATH_PRESETS, WRITING_MODES and
 * PRESENTATION_BANDS, with an in-gate age because the Version 1 projection
 * requires one.
 *
 * The capture form embeds this function's source text and `practice-golden`
 * imports it, so both sides build the same records. It must therefore stay
 * self-contained: it reads nothing but its parameters.
 */
export function buildGoldenRuntimeRecords(mathPresets, writingModes, presentationBands) {
  const bandPresets = { preschool: "quantities-to-10", "early-primary": "early-primary-within-10" };
  const arithmeticPresets = ["addition-within-20", "subtraction-within-20", "arithmetic-within-100"];
  const records = [];
  const profile = (presentationBand, writingMode, mathSkills) => ({
    id: `00000000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`,
    ageYears: 6,
    presentationBand,
    reviewedOn: "2026-09-29",
    mathSkills: {
      ...mathSkills,
      representations: [...mathSkills.representations],
      operations: [...mathSkills.operations],
    },
    writingMode,
    interests: ["vehicles", "animals"],
  });
  for (const writingMode of writingModes) {
    for (const band of presentationBands) {
      records.push({
        record: `writing-${writingMode}-${band}`,
        profile: profile(band, writingMode, mathPresets[bandPresets[band]].mathSkills),
      });
    }
  }
  for (const key of arithmeticPresets) {
    records.push({
      record: `preset-${key}`,
      profile: profile(mathPresets[key].presentationBand, "sentence-frame", mathPresets[key].mathSkills),
    });
  }
  return records;
}

/** Byte comparison of a capture with a committed grid, with both digests. */
export function compareCaptureBytes(actual, expected) {
  const actualBytes = typeof actual === "string" ? Buffer.from(actual, "utf8") : Buffer.from(actual);
  const expectedBytes = typeof expected === "string" ? Buffer.from(expected, "utf8") : Buffer.from(expected);
  return {
    equal: actualBytes.equals(expectedBytes),
    actualSha256: sha256(actualBytes),
    expectedSha256: sha256(expectedBytes),
  };
}

/**
 * Whether a ref declares the dependencies the checkout has installed. Both
 * sides are compared as parsed JSON, never as bytes, because `core.autocrlf`
 * checks text out as CRLF in a Windows worktree. The whole lockfile and the
 * package manifest's `dependencies`, `devDependencies` and `engines` must be
 * equal; `scripts` and every other manifest field may differ.
 */
export function compareDependencyManifests(reference, working) {
  const parse = (text) => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false };
    }
  };
  const differences = [];
  const referenceLock = parse(reference.packageLock);
  const workingLock = parse(working.packageLock);
  if (!referenceLock.ok || !workingLock.ok || !isDeepStrictEqual(referenceLock.value, workingLock.value)) {
    differences.push("package-lock.json");
  }
  const referenceManifest = parse(reference.packageJson);
  const workingManifest = parse(working.packageJson);
  for (const field of ["dependencies", "devDependencies", "engines"]) {
    if (
      !referenceManifest.ok ||
      !workingManifest.ok ||
      !isDeepStrictEqual(referenceManifest.value?.[field], workingManifest.value?.[field])
    ) {
      differences.push(`package.json ${field}`);
    }
  }
  return { compatible: differences.length === 0, differences };
}

/**
 * The capture form: Vitest source against the ref's own modules. It builds
 * every record, projects each cell at Practice exactly as the ref's app does
 * (the only projection boundary, then the registered generator) and writes the
 * sorted grid to `outputPath`. A cell the ref's path refuses is absent.
 */
function captureForm(outputPath) {
  return `import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import {
  AppConfigV1Schema,
  ChildProfileV1Schema,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "../../src/shared/config/schema.js";
import { MATH_PRESETS } from "../../src/shared/config/math-presets.js";
import { canonicalContentKey } from "../../src/shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.js";
import { getWorksheetRegistration } from "../../src/shared/worksheet/registry.js";
import { WORKSHEET_TYPE_IDS } from "../../src/shared/worksheet/types.js";

const buildGoldenRuntimeRecords = ${buildGoldenRuntimeRecords.toString()};
const SEEDS = ${JSON.stringify(GOLDEN_SEEDS)};
const OUTPUT_PATH = ${JSON.stringify(outputPath)};

test("capture the Practice content-key grid", () => {
  const fixture = AppConfigV1Schema.parse(
    JSON.parse(readFileSync(new URL("../fixtures/config/children.v1.json", import.meta.url), "utf8")),
  );
  const records = [
    ...fixture.profiles.map((profile, index) => ({ record: "canonical-" + (index + 1), profile })),
    ...buildGoldenRuntimeRecords(MATH_PRESETS, WRITING_MODES, PRESENTATION_BANDS).map(
      ({ record, profile }) => ({ record, profile: ChildProfileV1Schema.parse(profile) }),
    ),
  ];
  const grid = {};
  for (const { record, profile } of records) {
    for (const family of WORKSHEET_TYPE_IDS) {
      const registration = getWorksheetRegistration(family);
      for (const length of WORKSHEET_LENGTHS) {
        for (const scale of PRINT_SCALES) {
          for (const seed of SEEDS) {
            const projection = projectGenerationRequest({
              profile,
              worksheetType: family,
              generatorVersion: registration.generatorVersion,
              seed,
              preferences: {
                useDisplayName: false,
                useInterests: true,
                includeDecorativeGraphics: true,
                difficulty: "practice",
                length,
                includeAnswerKey: true,
                paperSize: "letter",
                printScale: scale,
              },
            });
            if (!projection.ok) continue;
            const result = registration.generate(projection.request, {
              worksheetId: "11111111-1111-4111-8111-111111111111",
            });
            if (!result.ok) continue;
            grid[[record, family, length, scale, seed].join("/")] = createHash("sha256")
              .update(canonicalContentKey(result.document.items), "utf8")
              .digest("hex");
          }
        }
      }
    }
  }
  const sorted = {};
  for (const key of Object.keys(grid).sort()) sorted[key] = grid[key];
  writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + "\\n", "utf8");
}, 600_000);
`;
}

async function git(args, signal) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: GIT_OUTPUT_LIMIT,
    signal,
    timeout: TOOL_TIMEOUT_MS,
    windowsHide: true,
  });
  return stdout;
}

const pause = (milliseconds) =>
  new Promise((done) => {
    setTimeout(done, milliseconds).unref();
  });

/**
 * Kills a child and every process it started: `taskkill /T /F` on Windows, and
 * elsewhere the child's own process group, which runBounded creates by
 * starting it detached. The direct child is killed as well in case the tree
 * kill could not run.
 */
async function killProcessTree(child) {
  if (child.pid === undefined) {
    return;
  }
  if (process.platform === "win32") {
    const taskkill = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    await execFileAsync(taskkill, ["/pid", String(child.pid), "/T", "/F"], {
      timeout: KILL_WAIT_MS,
      windowsHide: true,
    }).catch(() => undefined);
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The group has already exited.
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

/**
 * Runs a command with a wall-clock bound and an optional AbortSignal. It
 * resolves with the combined stdout and stderr on exit 0 and rejects on any
 * other exit. When the bound expires or the signal aborts, it kills the whole
 * process tree, waits a bounded time for the child to exit and rejects, so a
 * caller's `finally` always runs. A rejection carries `output` and `pid`.
 */
export function runBounded(command, args, { cwd, env = process.env, timeoutMs, signal } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error("runBounded needs a positive finite timeoutMs."));
  }
  return new Promise((accept, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const exited = new Promise((done) => {
      child.once("exit", done);
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        output += chunk.toString();
      });
    }
    let settled = false;
    let stopping = false;
    const settle = (message) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (message === undefined) {
        accept({ output });
      } else {
        reject(Object.assign(new Error(message), { output, pid: child.pid }));
      }
    };
    const stop = async (message) => {
      if (settled || stopping) {
        return;
      }
      stopping = true;
      await killProcessTree(child);
      await Promise.race([exited, pause(KILL_WAIT_MS)]);
      child.stdout.destroy();
      child.stderr.destroy();
      settle(message);
    };
    const timer = setTimeout(() => {
      void stop(`${basename(command)} did not finish within ${timeoutMs} ms; its process tree was killed.`);
    }, timeoutMs);
    const onAbort = () => {
      const reason = signal.reason instanceof Error ? signal.reason.message : String(signal.reason);
      void stop(`${basename(command)} was stopped (${reason}); its process tree was killed.`);
    };
    child.once("error", (error) => {
      settle(`${basename(command)} could not run: ${error.message}`);
    });
    child.once("close", (code, exitSignal) => {
      if (!stopping) {
        settle(code === 0 && exitSignal === null ? undefined : `${basename(command)} failed (exit ${code}, signal ${exitSignal}).`);
      }
    });
    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function runCaptureForm(exportFrontend, signal) {
  const vitest = join(exportFrontend, "node_modules", "vitest", "vitest.mjs");
  try {
    await runBounded(process.execPath, [vitest, "run", CAPTURE_FORM_RELATIVE, "--reporter=dot"], {
      cwd: exportFrontend,
      env: { ...process.env, CI: "true" },
      timeoutMs: CAPTURE_FORM_TIMEOUT_MS,
      signal,
    });
  } catch (error) {
    process.stderr.write(error?.output ?? "");
    throw new Error(`The capture form failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/** Removes the link first, so a recursive removal can never reach the checkout's dependencies. */
async function removeExport(temporaryDirectory, link) {
  const linkState = await lstat(link).catch(() => undefined);
  if (linkState !== undefined) {
    await unlink(link);
  }
  if (existsSync(link)) {
    throw new Error(`The dependency link ${link} could not be removed; the export was left in place.`);
  }
  if (dirname(temporaryDirectory) !== resolve(tmpdir()) || !basename(temporaryDirectory).startsWith(TEMPORARY_PREFIX)) {
    throw new Error(`Refusing to remove ${temporaryDirectory}: it is not a capture export.`);
  }
  // A just-killed process tree can hold files open for a moment on Windows.
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

async function capture(ref, signal) {
  if (typeof ref !== "string" || ref.length === 0 || ref.startsWith("-")) {
    throw new Error("Usage: node frontend/scripts/capture-practice-golden.mjs <ref> [--compare <file>]");
  }
  const commit = (await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], signal)).trim();

  // The dependency guard runs before anything is created.
  const guard = compareDependencyManifests(
    {
      packageJson: await git(["show", `${commit}:frontend/package.json`], signal),
      packageLock: await git(["show", `${commit}:frontend/package-lock.json`], signal),
    },
    {
      packageJson: await readFile(join(frontendRoot, "package.json"), "utf8"),
      packageLock: await readFile(join(frontendRoot, "package-lock.json"), "utf8"),
    },
  );
  if (!guard.compatible) {
    throw new Error(`Refusing ${ref}: its ${guard.differences.join(", ")} differ from the installed checkout.`);
  }
  signal?.throwIfAborted();

  const temporaryDirectory = await mkdtemp(join(tmpdir(), TEMPORARY_PREFIX));
  const exportFrontend = join(temporaryDirectory, "frontend");
  const link = join(exportFrontend, "node_modules");
  const outputPath = join(temporaryDirectory, "practice-content-keys.json");
  let captured;
  let failure;
  try {
    const archive = join(temporaryDirectory, "export.tar");
    await git(["archive", "--format=tar", `--output=${archive}`, commit, "frontend"], signal);
    await execFileAsync("tar", ["-x", "-f", "export.tar"], {
      cwd: temporaryDirectory,
      signal,
      timeout: TOOL_TIMEOUT_MS,
      windowsHide: true,
    });
    await unlink(archive);
    signal?.throwIfAborted();
    await symlink(checkoutDependencies, link, process.platform === "win32" ? "junction" : "dir");
    const fixture = join(exportFrontend, FIXTURE_RELATIVE);
    await mkdir(dirname(fixture), { recursive: true });
    await copyFile(join(frontendRoot, FIXTURE_RELATIVE), fixture);
    await writeFile(join(exportFrontend, CAPTURE_FORM_RELATIVE), captureForm(outputPath), { encoding: "utf8", flag: "wx" });
    signal?.throwIfAborted();
    await runCaptureForm(exportFrontend, signal);
    captured = await readFile(outputPath);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await removeExport(temporaryDirectory, link);
    } catch (error) {
      failure ??= error;
    }
    const exportRemoved = !existsSync(temporaryDirectory);
    const dependenciesIntact = existsSync(dependencySentinel);
    process.stderr.write(
      `temporary export ${exportRemoved ? "removed" : "STILL PRESENT"}: ${temporaryDirectory}\n` +
        `checkout dependencies ${dependenciesIntact ? "intact" : "MISSING"}: frontend/node_modules/vitest/package.json\n`,
    );
    if (!exportRemoved) {
      failure ??= new Error(`The temporary export ${temporaryDirectory} still exists.`);
    }
    if (!dependenciesIntact) {
      failure ??= new Error("The checkout's frontend/node_modules/vitest/package.json no longer exists.");
    }
  }
  if (failure !== undefined) {
    throw failure;
  }
  return { commit, captured };
}

async function main(argv, signal) {
  const [ref, ...rest] = argv;
  let compareFile;
  if (rest.length === 2 && rest[0] === "--compare") {
    compareFile = resolve(rest[1]);
  } else if (rest.length !== 0) {
    throw new Error("Usage: node frontend/scripts/capture-practice-golden.mjs <ref> [--compare <file>]");
  }
  const { commit, captured } = await capture(ref, signal);
  process.stderr.write(`captured ${ref} (${commit})\n`);
  if (compareFile === undefined) {
    process.stdout.write(captured);
    return 0;
  }
  const comparison = compareCaptureBytes(captured, await readFile(compareFile));
  process.stdout.write(
    `capture sha256:   ${comparison.actualSha256}\n` +
      `committed sha256: ${comparison.expectedSha256}\n` +
      `${comparison.equal ? "MATCH" : "MISMATCH"}\n`,
  );
  return comparison.equal ? 0 : 1;
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);
const invokedDirectly =
  invokedPath !== undefined &&
  (process.platform === "win32" ? invokedPath.toLowerCase() === modulePath.toLowerCase() : invokedPath === modulePath);

if (invokedDirectly) {
  // An interrupt aborts the run instead of exiting at once, so the capture
  // form's process tree is killed and `finally` removes the link and then the
  // export before the script exits nonzero.
  const controller = new AbortController();
  const interrupt = (name) => {
    process.stderr.write(
      controller.signal.aborted
        ? `${name} received again; still removing the temporary export.\n`
        : `${name} received; stopping the capture and removing the temporary export.\n`,
    );
    controller.abort(new Error(`interrupted by ${name}`));
  };
  for (const name of INTERRUPT_SIGNALS) {
    process.on(name, interrupt);
  }
  try {
    process.exitCode = await main(process.argv.slice(2), controller.signal);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    for (const name of INTERRUPT_SIGNALS) {
      process.off(name, interrupt);
    }
  }
}
