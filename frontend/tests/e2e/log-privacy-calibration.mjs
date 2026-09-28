// Run after `npm run build`, with no other gate using this compiled tree.
// Inject only into disposable compiled output; restore its exact bytes in finally.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../..", import.meta.url));
const routePath = new URL("../../dist/server/routes/config.js", import.meta.url);
const original = await readFile(routePath);
const anchor = '            reply.header("ETag", stored.etag);';
const source = original.toString("utf8");
assert.equal(source.split(anchor).length, 3, "Expected GET and PUT response anchors.");
const evidenceDirectory = await mkdtemp(join(tmpdir(), "extra-credit-log-calibration-"));
console.log(`Privacy calibration evidence: ${evidenceDirectory}`);

async function gate(label, args, expectLeak) {
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
  console.log(`Privacy calibration ${label}: actual exit ${result.code}.`);
  assert.equal(result.signal, null);
  assert.ok(/1 passed/u.test(result.output), "The browser flow must pass before the harness oracle rejects logs.");
  assert.equal(result.code, expectLeak ? 1 : 0);
  if (expectLeak) {
    assert.ok(/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}/u.test(result.output), "The compiled route must emit a generated UUID.");
    assert.ok(/EXTRA_CREDIT_E2E_HARNESS_ERROR/u.test(result.output), "The log oracle must reject the leak.");
  } else {
    assert.ok(!/EXTRA_CREDIT_E2E_HARNESS_ERROR/u.test(result.output), "The clean compiled app must pass.");
  }
}

try {
  // Every canonical profile gets a real random UUID. None of the example IDs
  // can satisfy this negative calibration, and only the compiled server logs.
  await writeFile(routePath, source.replaceAll(anchor,
    '            for (const profile of stored.config.profiles) process.stdout.write(profile.id + "\\n");\n' + anchor));
  await gate("dedicated stdout leak", ["--project=release-smoke"], true);

  // The fourth profile is deleted before exit. This also proves the evidence
  // retains deleted IDs and the default/full-check selector checks stderr.
  await writeFile(routePath, source.replaceAll(anchor,
    '            for (const profile of stored.config.profiles) if (profile.ageYears === 9) process.stderr.write(profile.id + "\\n");\n' + anchor));
  await gate("default-selector deleted-ID stderr leak", ["--grep=compiled release profile-to-print and privacy gate"], true);
} finally {
  await writeFile(routePath, original);
}

await gate("restored clean compiled app", ["--project=release-smoke"], false);
