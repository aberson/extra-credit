import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

class HarnessError extends Error {
  constructor(category, cause) {
    super(category, { cause });
    this.category = category;
  }
}

export async function startManualPrintHarness() {
  let category = "BUILD_IMPORT";
  let temporaryDirectory;
  let app;
  const close = async () => {
    let failure;
    try {
      await app?.close();
    } catch (error) {
      failure = error;
    }
    try {
      if (temporaryDirectory !== undefined) {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    } catch (error) {
      failure ??= error;
    }
    if (failure !== undefined) {
      throw new HarnessError("CLEANUP", failure);
    }
  };
  try {
    const [
      { assertPrivateBootstrapContext, buildApp },
      { listenOnValidatedSocket, PRODUCTION_STATIC_ROOT },
      { classifyStoredConfig },
    ] = await Promise.all([
      import("../../dist/server/app.js"),
      import("../../dist/server/startup.js"),
      import("../../dist/shared/config/migrate.js"),
    ]);
    category = "FIXTURE";
    // The committed example's own identity-only version 2 bytes, validated by
    // the compiled store classifier: the app reads them as the current version,
    // with no upgrade notice and no upgrade backup on the first save.
    const exampleBytes = await readFile(
      new URL("../../../config/children.example.json", import.meta.url),
    );
    const classified = classifyStoredConfig(JSON.parse(exampleBytes.toString("utf8")));
    if (classified.kind !== "current") {
      throw new Error("The committed example is not a current-version profile file.");
    }
    category = "TEMPORARY_STORAGE";
    temporaryDirectory = await mkdtemp(join(tmpdir(), "extra-credit-manual-print-"));
    const configPath = join(temporaryDirectory, "children.local.json");
    await writeFile(configPath, exampleBytes, { flag: "wx" });
    category = "APP_INITIALIZATION";
    app = buildApp({ configPath, securityMode: "ephemeral-test", staticRoot: PRODUCTION_STATIC_ROOT });
    assertPrivateBootstrapContext(app, { configPath, securityMode: "ephemeral-test" });
    category = "LISTEN";
    const origin = await listenOnValidatedSocket(app, "127.0.0.1", 0);
    return { origin, close, temporaryDirectory };
  } catch (error) {
    const primary = new HarnessError(category, error);
    try {
      await close();
    } catch (cleanupError) {
      primary.cleanupError = cleanupError;
    }
    throw primary;
  }
}

async function main() {
  let resolveStop;
  let stopping = false;
  const stopped = new Promise((resolve) => { resolveStop = resolve; });
  const stop = () => {
    stopping = true;
    resolveStop();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("disconnect", stop);
  // IPC can disconnect before this entry point begins executing.
  if (typeof process.send === "function" && !process.connected) {
    stop();
  }
  let harness;
  try {
    harness = await startManualPrintHarness();
    if (!stopping) {
      console.log(`Extra Credit fictional print harness: ${harness.origin}`);
      console.log("Fictional profiles: Riley, Morgan, Avery. Stop with Ctrl+C.");
    }
    await stopped;
  } finally {
    try {
      await harness?.close();
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      process.off("disconnect", stop);
    }
  }
  console.log("Extra Credit print harness closed; temporary profiles removed.");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const category = error instanceof HarnessError ? error.category : "UNEXPECTED";
    console.error(`EXTRA_CREDIT_MANUAL_PRINT_ERROR: ${category}`);
    process.exitCode = 1;
  });
}
