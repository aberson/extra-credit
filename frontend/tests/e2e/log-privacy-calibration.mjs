// Run after `npm run build`, with no other gate using this compiled tree.
// Inject only into disposable compiled output; restore its exact bytes in finally.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const frontendRoot = fileURLToPath(new URL("../..", import.meta.url));
const routePath = new URL("../../dist/server/routes/config.js", import.meta.url);
const original = await readFile(routePath);
const anchor = '            reply.header("ETag", stored.etag);';
const source = original.toString("utf8");
assert.equal(source.split(anchor).length, 3, "Expected GET and PUT response anchors.");
// The profile ids the harness already holds from the committed example, as
// fixed private values independent of the evidence channel.
const exampleIds = JSON.parse(
  await readFile(new URL("../../../config/children.example.json", import.meta.url), "utf8"),
).profiles.map(({ id }) => id);
const evidenceDirectory = await mkdtemp(join(tmpdir(), "extra-credit-log-calibration-"));
console.log(`Privacy calibration evidence: ${evidenceDirectory}`);

/**
 * How many tests Playwright lists for a gate's own selector arguments, so the
 * pass oracle below follows the release-smoke project as tests are added. The
 * listing runs no test and starts no server; only its total is read.
 */
async function listedCount(args) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--list", ...args], {
      cwd: frontendRoot,
      env: { ...process.env, EXTRA_CREDIT_E2E_BASE_URL: "http://127.0.0.1:1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        output += chunk.toString();
      });
    }
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
  assert.equal(result.code, 0, "Playwright could not list the gate's tests.");
  const total = /^Total: (\d+) tests? in \d+ files?$/mu.exec(result.output);
  assert.ok(total, "The Playwright listing reported no total.");
  const count = Number(total[1]);
  assert.ok(count > 0, "The gate's selector lists no test.");
  return count;
}

async function gate(label, args, expectLeak) {
  const listed = await listedCount(args);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["tests/e2e/server-harness.mjs", ...args], {
      cwd: frontendRoot,
      env: { ...process.env, CI: "true" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        output += chunk.toString();
      });
    }
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, output }));
  });
  // Intentionally leaky output stays in private temporary evidence, never CI logs.
  await writeFile(join(evidenceDirectory, `${label}.log`), result.output, { mode: 0o600 });
  await writeFile(join(evidenceDirectory, `${label}.exitcode`), String(result.code), { mode: 0o600 });
  console.log(`Privacy calibration ${label}: listed ${listed}, actual exit ${result.code}.`);
  assert.equal(result.signal, null);
  assert.ok(
    new RegExp(`(?<![0-9])${listed} passed`, "u").test(result.output),
    "Every listed browser test must pass before the harness oracle rejects logs.",
  );
  assert.equal(result.code, expectLeak ? 1 : 0);
  if (expectLeak) {
    assert.ok(/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}/u.test(result.output), "The compiled route must emit a generated UUID.");
    assert.ok(/EXTRA_CREDIT_E2E_HARNESS_ERROR/u.test(result.output), "The log oracle must reject the leak.");
  } else {
    assert.ok(!/EXTRA_CREDIT_E2E_HARNESS_ERROR/u.test(result.output), "The clean compiled app must pass.");
  }
}

try {
  // Every stored profile ID except the example IDs reaches stdout, so the
  // only leaked values are the ones the release smoke creates or seeds at
  // runtime, which the harness knows only through the evidence channel. Only
  // the compiled server logs.
  await writeFile(routePath, source.replaceAll(anchor,
    `            for (const profile of stored.config.profiles) if (!${JSON.stringify(exampleIds)}.includes(profile.id)) process.stdout.write(profile.id + "\\n");\n` + anchor));
  await gate("dedicated stdout leak", ["--project=release-smoke"], true);

  // The retained profile, nicknamed "Temporary", is deleted before exit. This
  // also proves the evidence retains deleted IDs and the default/full-check
  // selector checks stderr.
  await writeFile(routePath, source.replaceAll(anchor,
    '            for (const profile of stored.config.profiles) if (profile.displayName === "Temporary") process.stderr.write(profile.id + "\\n");\n' + anchor));
  await gate("default-selector deleted-ID stderr leak", ["--grep=compiled release profile-to-print and privacy gate"], true);
} finally {
  await writeFile(routePath, original);
}

await gate("restored clean compiled app", ["--project=release-smoke"], false);
