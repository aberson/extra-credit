import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { auditRelease } from "./audit-release.mjs";
import { exportTree } from "./release-tree.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidence = await mkdtemp(join(await mkdir(resolve(source, ".build-step"), { recursive: true }).then(() => resolve(source, ".build-step")), "release-"));
const room = await mkdtemp(join(tmpdir(), "extra-credit-release-"));
const report = { source, room, evidence, commands: [], cleanup: false, status: "FAIL" };

async function run(args, name) {
  const log = createWriteStream(join(evidence, name));
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run through npm run release:verify");
  const command = { command: `npm ${args.join(" ")}`, cwd: join(room, "frontend"), exit: null, signal: null, error: null };
  report.commands.push(command);
  console.log(command.command);
  await new Promise((accept) => {
    const child = spawn(process.execPath, [npm, ...args], {
      cwd: command.cwd, env: { ...process.env, CI: "1" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => { log.write(bytes); process.stdout.write(bytes); });
    child.once("error", (error) => { command.error = error.message; });
    child.once("close", (code, signal) => { command.exit = code; command.signal = signal; accept(); });
  });
  await new Promise((accept) => log.end(accept));
  if (command.exit !== 0 || command.signal || command.error) throw new Error(`COMMAND_FAILED: ${command.command} exit ${command.exit}`);
}

try {
  const manifest = await exportTree(source, room);
  await writeFile(join(evidence, "01-export-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  report.audit = await auditRelease(room);
  await writeFile(join(evidence, "02-audit.json"), `${JSON.stringify(report.audit, null, 2)}\n`);
  await run(["ci"], "03-install.log");
  await run(["exec", "--", "playwright", "install", ...(process.platform === "linux" ? ["--with-deps"] : []), "chromium"], "04-browser.log");
  await run(["run", "check"], "05-check.log");
  const relativeRoom = relative(resolve(tmpdir()), resolve(room));
  if (isAbsolute(relativeRoom) || relativeRoom.startsWith("..") || !relativeRoom.startsWith("extra-credit-release-") || dirname(resolve(room)) !== resolve(tmpdir())) throw new Error("UNSAFE_CLEANUP_PATH");
  await rm(room, { recursive: true, force: true });
  report.cleanup = true;
  report.status = "PASS";
} catch (error) {
  // Keep the failed clean room, including browser evidence, for diagnosis.
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(join(evidence, "06-result.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
