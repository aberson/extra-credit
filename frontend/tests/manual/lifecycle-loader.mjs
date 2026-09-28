// Test-only synchronization around the real executable and compiled server.
// No production hook or alternate server implementation participates.
import { registerHooks } from "node:module";

const stage = process.env.EXTRA_CREDIT_LIFECYCLE_STAGE;
const barrier = (directory) => `
  process.send({ stage: ${JSON.stringify(stage)}, directory: ${directory} });
  await new Promise((release) => {
    const finish = () => {
      process.off("message", proceed);
      process.off("disconnect", finish);
      release();
    };
    const proceed = (message) => {
      if (message.stop === "SIGINT" || message.stop === "SIGTERM") {
        process.emit(message.stop);
      }
      finish();
    };
    process.once("message", proceed);
    process.once("disconnect", finish);
  });
`;

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.endsWith("/tests/manual/print-harness.mjs")) return result;
    let source = String(result.source);
    let anchor;
    let replacement;
    if (stage === "imports") {
      anchor = "export async function startManualPrintHarness() {";
      replacement = anchor + barrier("null");
    } else if (stage === "allocated") {
      anchor = 'const configPath = join(temporaryDirectory, "children.local.json");';
      replacement = barrier("temporaryDirectory") + anchor;
    } else if (stage === "listen") {
      anchor = 'const origin = await listenOnValidatedSocket(app, "127.0.0.1", 0);';
      replacement = 'const listening = listenOnValidatedSocket(app, "127.0.0.1", 0);' +
        barrier("temporaryDirectory") + "const origin = await listening;";
    } else if (stage === "before-entry") {
      anchor = "if (process.argv[1] !== undefined";
      replacement = barrier("null") + anchor;
    } else {
      throw new Error("Unknown lifecycle test barrier.");
    }
    if (!source.includes(anchor)) throw new Error("Lifecycle test barrier missing.");
    source = source.replace(anchor, replacement);
    // Observe ownership, including a directory acquired after an early stop.
    const allocation = 'await mkdtemp(join(tmpdir(), "extra-credit-manual-print-"))';
    source = source.replace(allocation,
      `(await (async () => { const directory = ${allocation}; console.log("OWNED_DIRECTORY:" + directory); return directory; })())`);
    source = source.replace("return { origin, close, temporaryDirectory };",
      'console.log("OWNED_ORIGIN:" + origin); return { origin, close, temporaryDirectory };');
    const failure = process.env.EXTRA_CREDIT_LIFECYCLE_FAILURE;
    if (failure === "startup-cleanup-failure") {
      source = source.replace('await writeFile(configPath,',
        'throw new Error("PRIVATE_STARTUP_DETAIL"); await writeFile(configPath,');
      source = source.replace("await rm(temporaryDirectory,",
        'throw new Error("PRIVATE_CLEANUP_DETAIL"); await rm(temporaryDirectory,');
    } else if (failure === "cleanup-failure") {
      source = source.replace("await app?.close();",
        'await app?.close(); throw new Error("PRIVATE_CLEANUP_DETAIL");');
    }
    return { ...result, source };
  },
});
