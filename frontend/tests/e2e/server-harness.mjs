import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const frontendRoot = fileURLToPath(new URL("../..", import.meta.url));
const appModuleUrl = pathToFileURL(resolve(frontendRoot, "dist/server/app.js"));
const startupModuleUrl = pathToFileURL(
  resolve(frontendRoot, "dist/server/startup.js"),
);
const portsModuleUrl = pathToFileURL(
  resolve(frontendRoot, "dist/shared/runtime/ports.js"),
);
const lifecyclePrivacyProbeArgument = "--compiled-lifecycle-privacy-probe";
const delayedDevelopmentServerProbeArgument =
  "--delayed-development-server-probe";
const developmentWebReadyMarker = "EXTRA_CREDIT_E2E_DEV_WEB_READY";
const lifecyclePrivacyConfigEnvironment =
  "EXTRA_CREDIT_E2E_PRIVATE_CONFIG_PATH";
const lifecyclePrivacyModeEnvironment =
  "EXTRA_CREDIT_E2E_PRIVATE_SECURITY_MODE";

function writeHarnessStatus(message, sensitiveValues) {
  if (
    sensitiveValues.some(
      (value) => typeof value === "string" && message.includes(value),
    )
  ) {
    throw new Error(
      "EXTRA_CREDIT_E2E_PRIVATE_LOG_ERROR: Harness status contained private bootstrap data.",
    );
  }

  console.log(message);
}

function runPlaywright(baseURL) {
  const playwrightCli = require.resolve("@playwright/test/cli");

  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [playwrightCli, "test"], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        EXTRA_CREDIT_E2E_BASE_URL: baseURL,
      },
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Playwright terminated with signal ${signal}.`));
        return;
      }

      resolveExit(code ?? 1);
    });
  });
}

async function waitForDevelopmentWeb() {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:4311", {
        signal: AbortSignal.timeout(500),
      });
      const body = await response.text();

      if (response.ok && body.includes("<title>Extra Credit Worksheet</title>")) {
        console.log(developmentWebReadyMarker);
        return;
      }
    } catch {
      // The real Vite peer may still be acquiring its fixed development port.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  throw new Error("The development web peer did not become ready.");
}

function runNpmScript(scriptName) {
  const npmCli = process.env.npm_execpath;
  if (npmCli === undefined || npmCli.length === 0) {
    throw new Error("npm_execpath is unavailable.");
  }

  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [npmCli, "run", scriptName], {
      cwd: frontendRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`npm script terminated with signal ${signal}.`));
        return;
      }

      resolveExit(code ?? 1);
    });
  });
}

async function runDelayedDevelopmentServerProbe() {
  await waitForDevelopmentWeb();
  process.exitCode = await runNpmScript("dev:server");
}

async function runCompiledLifecyclePrivacyProbe() {
  const configPath = process.env[lifecyclePrivacyConfigEnvironment];
  const securityMode = process.env[lifecyclePrivacyModeEnvironment];

  if (configPath === undefined || securityMode !== "ephemeral-test") {
    throw new Error(
      "EXTRA_CREDIT_E2E_LIFECYCLE_INPUT_ERROR: The lifecycle probe input is invalid.",
    );
  }

  const [
    { assertPrivateBootstrapContext, buildApp },
    { listenOnValidatedSocket },
    { LOOPBACK_HOST },
  ] = await Promise.all([
    import(appModuleUrl.href),
    import(startupModuleUrl.href),
    import(portsModuleUrl.href),
  ]);
  let app;

  try {
    app = buildApp({ configPath, securityMode });
    assertPrivateBootstrapContext(app, { configPath, securityMode });
    const origin = await listenOnValidatedSocket(app, LOOPBACK_HOST, 0);
    const response = await fetch(`${origin}/api/health`, {
      headers: { accept: "application/json" },
    });
    const health = await response.json();

    if (
      response.status !== 200 ||
      response.headers.get("cache-control") !== "no-store" ||
      health?.status !== "ok" ||
      typeof health.version !== "string"
    ) {
      throw new Error(
        "EXTRA_CREDIT_E2E_LIFECYCLE_HEALTH_ERROR: The compiled health route was invalid.",
      );
    }
  } finally {
    if (app !== undefined) {
      await app.close();
    }
  }
}

async function main() {
  let app;
  let configPath;
  let playwrightExitCode;
  let temporaryDirectory;

  try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "extra-credit-e2e-"));
    configPath = join(temporaryDirectory, "children.local.json");
    const [
      { assertPrivateBootstrapContext, buildApp },
      { listenOnValidatedSocket, PRODUCTION_STATIC_ROOT },
      { LOOPBACK_HOST },
    ] = await Promise.all([
      import(appModuleUrl.href),
      import(startupModuleUrl.href),
      import(portsModuleUrl.href),
    ]);

    if (LOOPBACK_HOST !== "127.0.0.1") {
      throw new Error("The compiled loopback host drifted from 127.0.0.1.");
    }

    app = buildApp({
      configPath,
      securityMode: "ephemeral-test",
      staticRoot: PRODUCTION_STATIC_ROOT,
    });
    assertPrivateBootstrapContext(app, {
      configPath,
      securityMode: "ephemeral-test",
    });

    const address = await listenOnValidatedSocket(app, "127.0.0.1", 0);
    const socket = app.server.address();

    if (socket === null || typeof socket === "string") {
      throw new Error("The E2E server did not report a TCP socket address.");
    }

    const baseURL = `http://127.0.0.1:${socket.port}`;
    if (address !== baseURL) {
      throw new Error(`Fastify reported an unexpected address: ${address}`);
    }

    writeHarnessStatus(`Extra Credit E2E server: ${baseURL}`, [
      configPath,
      "ephemeral-test",
    ]);
    playwrightExitCode = await runPlaywright(baseURL);
  } finally {
    try {
      if (app !== undefined) {
        await app.close();
        writeHarnessStatus("Extra Credit E2E server closed cleanly.", [
          configPath,
          "ephemeral-test",
        ]);
      }
    } finally {
      if (temporaryDirectory !== undefined) {
        await rm(temporaryDirectory, { force: true, recursive: true });
      }
    }
  }

  process.exitCode = playwrightExitCode;
}

if (process.argv.includes(delayedDevelopmentServerProbeArgument)) {
  runDelayedDevelopmentServerProbe().catch(() => {
    console.error(
      "EXTRA_CREDIT_E2E_DEV_SUPERVISOR_PROBE_ERROR: The development supervisor probe failed.",
    );
    process.exitCode = 1;
  });
} else if (process.argv.includes(lifecyclePrivacyProbeArgument)) {
  runCompiledLifecyclePrivacyProbe().catch(() => {
    console.error(
      "EXTRA_CREDIT_E2E_LIFECYCLE_ERROR: The compiled lifecycle probe failed.",
    );
    process.exitCode = 1;
  });
} else {
  main().catch(() => {
    console.error(
      "EXTRA_CREDIT_E2E_HARNESS_ERROR: The compiled browser gate failed.",
    );
    process.exitCode = 1;
  });
}
