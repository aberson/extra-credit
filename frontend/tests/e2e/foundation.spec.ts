import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  access,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Route } from "@playwright/test";

import {
  API_PORT,
  LOOPBACK_HOST,
  WEB_PORT,
} from "../../src/shared/runtime/ports.js";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = resolve(frontendRoot, "..");
const expectedLoopbackHost = "127.0.0.1";
const expectedApiPort = 4310;
const expectedWebPort = 4311;
const developmentWebURL = "http://127.0.0.1:4311";
const developmentApiURL = "http://127.0.0.1:4310";

type ProcessTerminationMode = "posix-process-group" | "windows-process-tree";

interface CapturedProcess {
  child: ChildProcess;
  close: Promise<ObservedProcessClose>;
  isClosed: () => boolean;
  output: () => string;
  stderr: () => string;
  stdout: () => string;
  terminationMode: ProcessTerminationMode;
}

interface CompletedProcessOutput {
  exitCode: number;
  output: string;
  stderr: string;
  stdout: string;
}

interface ObservedProcessClose extends CompletedProcessOutput {
  error: Error | undefined;
  signal: NodeJS.Signals | null;
}

interface PackageMetadata {
  version: string;
}

function captureChild(
  child: ChildProcess,
  terminationMode: ProcessTerminationMode,
): CapturedProcess {
  const combinedChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const stdoutChunks: Buffer[] = [];
  let closed = false;
  let spawnError: Error | undefined;

  const collectStdout = (chunk: Buffer): void => {
    const copy = Buffer.from(chunk);
    stdoutChunks.push(copy);
    combinedChunks.push(copy);
  };
  const collectStderr = (chunk: Buffer): void => {
    const copy = Buffer.from(chunk);
    stderrChunks.push(copy);
    combinedChunks.push(copy);
  };
  const render = (chunks: Buffer[]): string =>
    Buffer.concat(chunks).toString("utf8");

  child.stdout?.on("data", collectStdout);
  child.stderr?.on("data", collectStderr);
  child.once("error", (error) => {
    spawnError = error;
  });

  const close = new Promise<ObservedProcessClose>((resolveClose) => {
    child.once("close", (code, signal) => {
      closed = true;
      resolveClose({
        error: spawnError,
        exitCode: code ?? 1,
        output: render(combinedChunks),
        signal,
        stderr: render(stderrChunks),
        stdout: render(stdoutChunks),
      });
    });
  });

  return {
    child,
    close,
    isClosed: () => closed,
    output: () => render(combinedChunks),
    stderr: () => render(stderrChunks),
    stdout: () => render(stdoutChunks),
    terminationMode,
  };
}

function spawnCaptured(
  command: string,
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
): CapturedProcess {
  const terminationMode: ProcessTerminationMode =
    process.platform === "win32"
      ? "windows-process-tree"
      : "posix-process-group";
  const child = spawn(command, arguments_, {
    cwd: frontendRoot,
    detached: terminationMode === "posix-process-group",
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  return captureChild(child, terminationMode);
}

async function readPackageVersion(): Promise<string> {
  const metadata = JSON.parse(
    await readFile(resolve(frontendRoot, "package.json"), "utf8"),
  ) as Partial<PackageMetadata>;

  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("Package metadata is missing a version.");
  }

  return metadata.version;
}

function spawnNpm(
  arguments_: string[],
  environment: NodeJS.ProcessEnv = {},
): CapturedProcess {
  const npmCli = process.env.npm_execpath;
  if (npmCli === undefined || npmCli.length === 0) {
    throw new Error("npm_execpath is unavailable; cannot launch the development stack.");
  }

  return spawnCaptured(process.execPath, [npmCli, ...arguments_], {
    ...process.env,
    ...environment,
  });
}

function spawnCompiledLifecyclePrivacyProbe(
  configPath: string,
  securityMode: "ephemeral-test",
): CapturedProcess {
  return spawnCaptured(
    process.execPath,
    [
      resolve(frontendRoot, "tests/e2e/server-harness.mjs"),
      "--compiled-lifecycle-privacy-probe",
    ],
    {
      ...process.env,
      EXTRA_CREDIT_E2E_PRIVATE_CONFIG_PATH: configPath,
      EXTRA_CREDIT_E2E_PRIVATE_SECURITY_MODE: securityMode,
    },
  );
}

async function waitForObservedClose(
  processHandle: CapturedProcess,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (processHandle.isClosed()) {
    return true;
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      processHandle.close.then(() => true),
      new Promise<boolean>((resolveWait) => {
        timer = setTimeout(() => resolveWait(false), timeoutMilliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function signalPosixProcessGroup(
  processId: number,
  signal: NodeJS.Signals,
): boolean {
  try {
    process.kill(-processId, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

async function stopProcess(processHandle: CapturedProcess): Promise<void> {
  const { child } = processHandle;
  if (processHandle.isClosed()) {
    await processHandle.close;
    return;
  }

  if (child.pid === undefined) {
    if (!(await waitForObservedClose(processHandle, 5_000))) {
      throw new Error("The child process did not close after failing to spawn.");
    }
    await processHandle.close;
    return;
  }

  if (processHandle.terminationMode === "windows-process-tree") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T"], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (!(await waitForObservedClose(processHandle, 2_000))) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    }
  } else {
    const groupWasRunning = signalPosixProcessGroup(child.pid, "SIGTERM");
    if (
      groupWasRunning &&
      !(await waitForObservedClose(processHandle, 2_000))
    ) {
      signalPosixProcessGroup(child.pid, "SIGKILL");
    }
  }

  if (!(await waitForObservedClose(processHandle, 5_000))) {
    throw new Error("The development process tree did not terminate.");
  }

  await processHandle.close;
}

async function waitForProcessClose(
  processHandle: CapturedProcess,
  timeoutMilliseconds: number,
): Promise<CompletedProcessOutput> {
  if (!(await waitForObservedClose(processHandle, timeoutMilliseconds))) {
    let cleanupError: unknown;

    try {
      await stopProcess(processHandle);
    } catch (error) {
      cleanupError = error;
    }

    const cleanupDetail =
      cleanupError instanceof Error
        ? `\nCleanup failed: ${cleanupError.message}`
        : "";
    throw new Error(
      `Process did not close in time.${cleanupDetail}\n${processHandle.output()}`,
    );
  }

  const result = await processHandle.close;
  if (result.error !== undefined) {
    throw new Error(
      `Process failed to spawn: ${result.error.message}\n${result.output}`,
      { cause: result.error },
    );
  }
  if (result.signal !== null) {
    throw new Error(`Process ended with signal ${result.signal}.\n${result.output}`);
  }

  return {
    exitCode: result.exitCode,
    output: result.output,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

async function waitForResponse(url: string, processHandle: CapturedProcess): Promise<void> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (
      processHandle.isClosed() ||
      processHandle.child.exitCode !== null ||
      processHandle.child.signalCode !== null
    ) {
      const result = await waitForProcessClose(processHandle, 5_000);
      throw new Error(
        `Development process exited with code ${result.exitCode} before ${url} was ready.\n${result.output}`,
      );
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // Startup is expected to refuse connections until both processes bind.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  await stopProcess(processHandle);
  throw new Error(`Timed out waiting for ${url}.\n${processHandle.output()}`);
}

async function waitForOutputOccurrences(
  processHandle: CapturedProcess,
  expectedOutput: string,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const occurrenceCount = processHandle
      .output()
      .split(expectedOutput).length - 1;
    if (occurrenceCount >= expectedCount) {
      return;
    }
    if (
      processHandle.isClosed() ||
      processHandle.child.exitCode !== null ||
      processHandle.child.signalCode !== null
    ) {
      const result = await waitForProcessClose(processHandle, 5_000);
      throw new Error(
        `Development process exited with code ${result.exitCode} before producing the expected output.\n${result.output}`,
      );
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  await stopProcess(processHandle);
  throw new Error(
    `Timed out waiting for repeated development output.\n${processHandle.output()}`,
  );
}

async function occupyPort(port: number): Promise<Server> {
  const server = createServer();
  server.listen({ host: expectedLoopbackHost, port, exclusive: true });
  await once(server, "listening");
  return server;
}

async function assertPortReleased(port: number): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    try {
      const probe = await occupyPort(port);
      await closeServer(probe);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw error;
      }
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  throw new Error(`Port ${port} remained occupied after process cleanup.`);
}

async function assertFixedPortsReleased(): Promise<void> {
  await Promise.all([
    assertPortReleased(expectedApiPort),
    assertPortReleased(expectedWebPort),
  ]);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolveClose();
      } else {
        reject(error);
      }
    });
  });
}

test.describe.configure({ mode: "serial" });

test("runtime coordinates remain the independently approved literals", () => {
  expect(LOOPBACK_HOST).toBe("127.0.0.1");
  expect(API_PORT).toBe(4310);
  expect(WEB_PORT).toBe(4311);
});

test("compiled lifecycle keeps complete child output free of private bootstrap data", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "extra-credit-output-privacy-"),
  );
  const configPathToken = `unique-private-config-path-sentinel-${process.pid}-${Date.now()}.json`;
  const configPath = join(temporaryDirectory, configPathToken);
  const securityMode = "ephemeral-test" as const;
  let lifecycleProcess: CapturedProcess | undefined;

  try {
    lifecycleProcess = spawnCompiledLifecyclePrivacyProbe(
      configPath,
      securityMode,
    );
    const result = await waitForProcessClose(lifecycleProcess, 15_000);

    expect(result.exitCode, result.output).toBe(0);
    expect(result.stdout).not.toContain(configPath);
    expect(result.stdout).not.toContain(configPathToken);
    expect(result.stdout).not.toContain(securityMode);
    expect(result.stderr).not.toContain(configPath);
    expect(result.stderr).not.toContain(configPathToken);
    expect(result.stderr).not.toContain(securityMode);
    expect(result.output).not.toContain(configPath);
    expect(result.output).not.toContain(configPathToken);
    expect(result.output).not.toContain(securityMode);
  } finally {
    try {
      if (lifecycleProcess !== undefined) {
        await stopProcess(lifecycleProcess);
      }
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
});

test("compiled application retains one status owner through its real health transition", async ({
  page,
}) => {
  const packageVersion = await readPackageVersion();
  const requests: string[] = [];
  let healthAttempts = 0;
  let releaseFirstHealthRequest: () => void = () => undefined;
  const firstHealthRequestRelease = new Promise<void>((resolveRelease) => {
    releaseFirstHealthRequest = resolveRelease;
  });
  const healthRoute = async (route: Route): Promise<void> => {
    healthAttempts += 1;
    if (healthAttempts === 1) {
      await firstHealthRequestRelease;
      try {
        await route.abort("failed");
      } catch {
        // The per-attempt deadline may dispose a deliberately held first route.
      }
      return;
    }

    await route.continue();
  };

  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/api/health", healthRoute);

  try {
    const healthResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/health",
    );

    await page.goto("/");
    const checkingStatus = page.getByRole("status");
    await expect(checkingStatus).toHaveText("Checking the local server…");
    await expect(checkingStatus).toHaveAttribute("aria-atomic", "true");
    const checkingStatusOwner = await checkingStatus.elementHandle();
    if (checkingStatusOwner === null) {
      throw new Error("The checking status owner was not mounted.");
    }

    releaseFirstHealthRequest();
    const healthResponse = await healthResponsePromise;

    expect(healthResponse.ok()).toBe(true);
    expect(healthResponse.headers()["cache-control"]).toBe("no-store");
    expect(healthResponse.headers()["referrer-policy"]).toBe("no-referrer");
    expect(healthResponse.headers()["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(healthResponse.headers()["content-security-policy"]).not.toContain(
      "upgrade-insecure-requests",
    );
    await expect(page).toHaveTitle("Extra Credit Worksheet");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Extra Credit Worksheet",
    );
    const readyStatus = page.getByRole("status");
    await expect(readyStatus).toContainText("Ready on this computer.");
    await expect(readyStatus).toContainText(`Version ${packageVersion}`);
    const readyStatusOwner = await readyStatus.elementHandle();
    if (readyStatusOwner === null) {
      throw new Error("The ready status owner was not mounted.");
    }
    expect(
      await checkingStatusOwner.evaluate(
        (checkingOwner, readyOwner) => checkingOwner === readyOwner,
        readyStatusOwner,
      ),
    ).toBe(true);

    expect(await healthResponse.json()).toEqual({
      status: "ok",
      version: packageVersion,
    });
    expect(healthAttempts).toBe(2);

    for (const requestURL of requests) {
      const url = new URL(requestURL);
      if (url.protocol === "http:" || url.protocol === "https:") {
        expect(url.hostname).toBe("127.0.0.1");
        expect(url.origin).toBe(
          new URL(test.info().project.use.baseURL as string).origin,
        );
      }
    }

    await Promise.all([
      access(resolve(frontendRoot, "dist/web/index.html")),
      access(resolve(frontendRoot, "dist/server/app.js")),
      access(resolve(frontendRoot, "dist/server/index.js")),
    ]);
  } finally {
    releaseFirstHealthRequest();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("browser health recovery stops after its bounded retry budget", async ({
  page,
}) => {
  let healthAttempts = 0;
  await page.route("**/api/health", async (route) => {
    healthAttempts += 1;
    await route.abort("failed");
  });

  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "The local server is unavailable.",
  );
  expect(healthAttempts).toBe(4);
  await page.waitForTimeout(800);
  expect(healthAttempts).toBe(4);
});

test("stalled health requests reach the bounded unavailable state", async ({
  page,
}) => {
  const wallClockCeilingMilliseconds = 7_000;
  let healthAttempts = 0;
  let releaseHeldRoutes: () => void = () => undefined;
  const heldRouteRelease = new Promise<void>((resolveRelease) => {
    releaseHeldRoutes = resolveRelease;
  });
  const stallHealthRoute = async (route: Route): Promise<void> => {
    healthAttempts += 1;
    await heldRouteRelease;

    try {
      await route.abort("failed");
    } catch {
      // Per-attempt cancellation can dispose the route before test cleanup.
    }
  };

  await page.route("**/api/health", stallHealthRoute);
  const startedAt = Date.now();

  try {
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(
      "The local server is unavailable.",
      { timeout: wallClockCeilingMilliseconds },
    );
    expect(Date.now() - startedAt).toBeLessThan(wallClockCeilingMilliseconds);
    expect(healthAttempts).toBe(4);
    await page.waitForTimeout(800);
    expect(healthAttempts).toBe(4);
  } finally {
    releaseHeldRoutes();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("production startup fails safely before listening when the web index is absent", async () => {
  const webIndexPath = resolve(frontendRoot, "dist/web/index.html");
  const hiddenWebIndexPath = resolve(
    frontendRoot,
    "dist/web/index.html.static-missing-test",
  );
  let indexIsHidden = false;
  let productionProcess: CapturedProcess | undefined;

  try {
    await rename(webIndexPath, hiddenWebIndexPath);
    indexIsHidden = true;
    productionProcess = spawnNpm(["start"]);
    const result = await waitForProcessClose(productionProcess, 15_000);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("EXTRA_CREDIT_STATIC_MISSING");
    await assertPortReleased(expectedApiPort);
  } finally {
    try {
      if (productionProcess !== undefined) {
        await stopProcess(productionProcess);
      }
    } finally {
      try {
        if (indexIsHidden) {
          await rename(hiddenWebIndexPath, webIndexPath);
        }
      } finally {
        await assertFixedPortsReleased();
      }
    }
  }
});

test("production startup serves the built shell on the fixed authority without private logs", async ({
  request,
}) => {
  const packageVersion = await readPackageVersion();
  const privateConfigPath = resolve(repositoryRoot, "config/children.local.json");
  const privateSecurityMode = "ephemeral-test";
  let productionProcess: CapturedProcess | undefined;

  try {
    productionProcess = spawnNpm(["start"]);
    await waitForResponse(
      "http://127.0.0.1:4310/api/health",
      productionProcess,
    );

    const healthResponse = await request.get(
      "http://127.0.0.1:4310/api/health",
    );
    const pageResponse = await request.get("http://127.0.0.1:4310/");
    expect(healthResponse.status()).toBe(200);
    expect(await healthResponse.json()).toEqual({
      status: "ok",
      version: packageVersion,
    });
    expect(pageResponse.status()).toBe(200);
    expect(await pageResponse.text()).toContain("Extra Credit Worksheet");
  } finally {
    try {
      if (productionProcess !== undefined) {
        await stopProcess(productionProcess);
      }
    } finally {
      await assertFixedPortsReleased();
    }
  }

  if (productionProcess === undefined) {
    throw new Error("The production process was not launched.");
  }

  expect(productionProcess.stdout()).not.toContain(privateConfigPath);
  expect(productionProcess.stdout()).not.toContain(privateSecurityMode);
  expect(productionProcess.stderr()).not.toContain(privateConfigPath);
  expect(productionProcess.stderr()).not.toContain(privateSecurityMode);
  expect(productionProcess.output()).not.toContain(privateConfigPath);
  expect(productionProcess.output()).not.toContain(privateSecurityMode);
});

test("fixed development stack proxies health and rejects repository config through /@fs/", async ({
  page,
  request,
}) => {
  const secretProbeNames = [
    ".npmrc",
    ".yarnrc.yml",
    "harmless.key",
    "harmless.p12",
  ] as const;
  const allowedProbeName = "harmless.txt";
  const allowedProbeContent = "harmless-vite-allow-probe";
  const developmentEntryPath = resolve(frontendRoot, "src/server/dev.ts");
  let developmentProcess: CapturedProcess | undefined;
  let developmentEntryTimes:
    | { readonly access: Date; readonly modified: Date }
    | undefined;
  let secretProbeDirectory: string | undefined;

  try {
    const acquiredSecretProbeDirectory = await mkdtemp(
      resolve(frontendRoot, ".vite-secret-probe-"),
    );
    secretProbeDirectory = acquiredSecretProbeDirectory;
    await Promise.all([
      ...secretProbeNames.map(async (name) => {
        await writeFile(
          resolve(acquiredSecretProbeDirectory, name),
          "harmless-vite-deny-probe\n",
          { encoding: "utf8", flag: "wx" },
        );
      }),
      writeFile(
        resolve(acquiredSecretProbeDirectory, allowedProbeName),
        allowedProbeContent,
        { encoding: "utf8", flag: "wx" },
      ),
    ]);
    developmentProcess = spawnNpm(["run", "dev"]);
    const failedRequests: Array<{ error: string; url: string }> = [];
    const healthRequests: string[] = [];

    page.on("request", (request_) => {
      if (new URL(request_.url()).pathname === "/api/health") {
        healthRequests.push(request_.url());
      }
    });
    page.on("requestfailed", (request_) => {
      failedRequests.push({
        error: request_.failure()?.errorText ?? "unknown request failure",
        url: request_.url(),
      });
    });

    await Promise.all([
      waitForResponse(`${developmentApiURL}/api/health`, developmentProcess),
      waitForResponse(developmentWebURL, developmentProcess),
    ]);

    const healthResponsePromise = page.waitForResponse(
      (response) => response.url() === `${developmentWebURL}/api/health`,
    );
    await page.setViewportSize({ height: 1_080, width: 1_920 });
    await page.goto(developmentWebURL);
    expect((await healthResponsePromise).ok()).toBe(true);
    await expect(page.getByRole("status")).toContainText(
      "Ready on this computer.",
    );
    expect(failedRequests).toEqual([]);
    expect(healthRequests).toEqual([`${developmentWebURL}/api/health`]);

    const viewportMetrics = (await page.evaluate(`({
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
    })`)) as {
      clientHeight: number;
      clientWidth: number;
      scrollHeight: number;
      scrollWidth: number;
    };
    expect(viewportMetrics).toEqual({
      clientHeight: 1_080,
      clientWidth: 1_920,
      scrollHeight: 1_080,
      scrollWidth: 1_920,
    });

    const configPath = resolve(
      repositoryRoot,
      "config/children.example.json",
    ).replaceAll("\\", "/");
    const forbiddenResponse = await request.get(
      `${developmentWebURL}/@fs/${configPath}`,
    );
    expect(forbiddenResponse.status()).toBe(403);

    for (const name of secretProbeNames) {
      const secretPath = resolve(acquiredSecretProbeDirectory, name).replaceAll(
        "\\",
        "/",
      );
      const secretResponse = await request.get(
        `${developmentWebURL}/@fs/${secretPath}`,
      );
      expect(secretResponse.status(), name).toBe(403);
    }

    const allowedPath = resolve(
      acquiredSecretProbeDirectory,
      allowedProbeName,
    ).replaceAll("\\", "/");
    const allowedResponse = await request.get(
      `${developmentWebURL}/@fs/${allowedPath}`,
    );
    expect(allowedResponse.status()).toBe(200);
    expect(await allowedResponse.text()).toContain(allowedProbeContent);

    const developmentEntryMetadata = await stat(developmentEntryPath);
    developmentEntryTimes = {
      access: developmentEntryMetadata.atime,
      modified: developmentEntryMetadata.mtime,
    };
    const changedTimestamp = new Date(Date.now() + 2_000);
    await utimes(developmentEntryPath, changedTimestamp, changedTimestamp);
    await waitForOutputOccurrences(
      developmentProcess,
      `Extra Credit is ready at ${developmentApiURL}.`,
      2,
    );
    const restartedHealthResponse = await request.get(
      `${developmentWebURL}/api/health`,
    );
    expect(restartedHealthResponse.status()).toBe(200);
  } finally {
    try {
      if (developmentProcess !== undefined) {
        await stopProcess(developmentProcess);
      }
    } finally {
      try {
        if (developmentEntryTimes !== undefined) {
          await utimes(
            developmentEntryPath,
            developmentEntryTimes.access,
            developmentEntryTimes.modified,
          );
        }
      } finally {
        try {
          if (secretProbeDirectory !== undefined) {
            await rm(secretProbeDirectory, { force: true, recursive: true });
          }
        } finally {
          await assertFixedPortsReleased();
        }
      }
    }
  }
});

for (const [label, arguments_, extraPort] of [
  ["host", ["--host", "0.0.0.0"], undefined],
  ["port", ["--port", "54321"], 54_321],
  ["strict-port", ["--strictPort=false"], undefined],
] as const) {
  test(`Vite rejects a resolved ${label} override before listening`, async () => {
    let developmentProcess: CapturedProcess | undefined;

    try {
      developmentProcess = spawnNpm([
        "run",
        "dev:web",
        "--",
        ...arguments_,
      ]);
      const result = await waitForProcessClose(developmentProcess, 15_000);
      expect(result.exitCode).not.toBe(0);
      expect(result.output).toContain(
        "EXTRA_CREDIT_VITE_AUTHORITY_ERROR",
      );
    } finally {
      try {
        if (developmentProcess !== undefined) {
          await stopProcess(developmentProcess);
        }
      } finally {
        try {
          await assertFixedPortsReleased();
        } finally {
          if (extraPort !== undefined) {
            await assertPortReleased(extraPort);
          }
        }
      }
    }
  });
}

test("Vite preview package path is rejected before listening", async () => {
  const previewPort = 54_322;
  const unsafeHost = "0.0.0.0";
  const safeError =
    "EXTRA_CREDIT_VITE_AUTHORITY_ERROR: Vite preview is disabled; use npm run start.";
  let fixedWebHolder: Server | undefined;
  let previewHolder: Server | undefined;
  let previewProcess: CapturedProcess | undefined;

  await assertPortReleased(expectedApiPort);
  await assertPortReleased(expectedWebPort);
  await assertPortReleased(previewPort);

  try {
    fixedWebHolder = await occupyPort(expectedWebPort);
    previewHolder = await occupyPort(previewPort);
    previewProcess = spawnNpm(
      [
        "run",
        "dev:web",
        "--",
        "preview",
        "--host",
        unsafeHost,
        "--port",
        String(previewPort),
      ],
      { npm_config_loglevel: "silent" },
    );
    const result = await waitForProcessClose(previewProcess, 15_000);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain(safeError);
    expect(result.output).not.toContain(unsafeHost);
    expect(result.output).not.toContain(String(previewPort));
  } finally {
    try {
      if (previewProcess !== undefined) {
        await stopProcess(previewProcess);
      }
    } finally {
      try {
        if (previewHolder !== undefined) {
          await closeServer(previewHolder);
        }
      } finally {
        try {
          if (fixedWebHolder !== undefined) {
            await closeServer(fixedWebHolder);
          }
        } finally {
          try {
            await assertFixedPortsReleased();
          } finally {
            await assertPortReleased(previewPort);
          }
        }
      }
    }
  }
});

test("watched API startup failure reaches the supervisor and stops its peer", async () => {
  let apiPortHolder: Server | undefined;
  let developmentProcess: CapturedProcess | undefined;

  try {
    apiPortHolder = await occupyPort(expectedApiPort);
    developmentProcess = spawnNpm([
      "exec",
      "--",
      "concurrently",
      "--kill-others",
      "--success",
      "first",
      "npm:dev:web",
      "node tests/e2e/server-harness.mjs --delayed-development-server-probe",
    ]);
    const result = await waitForProcessClose(developmentProcess, 15_000);

    expect(result.exitCode, result.output).not.toBe(0);
    expect(result.output).toContain("EXTRA_CREDIT_E2E_DEV_WEB_READY");
    expect(result.output).toContain("EXTRA_CREDIT_PORT_UNAVAILABLE");
    expect(result.output).toContain("Sending SIGTERM to other processes");
    await assertPortReleased(expectedWebPort);
  } finally {
    try {
      if (developmentProcess !== undefined) {
        await stopProcess(developmentProcess);
      }
    } finally {
      try {
        if (apiPortHolder !== undefined) {
          await closeServer(apiPortHolder);
        }
      } finally {
        await assertFixedPortsReleased();
      }
    }
  }
});

for (const [label, port] of [
  ["API", expectedApiPort],
  ["web", expectedWebPort],
] as const) {
  test(`development startup exits nonzero when the fixed ${label} port is occupied`, async () => {
    let developmentProcess: CapturedProcess | undefined;
    let holder: Server | undefined;

    try {
      holder = await occupyPort(port);
      developmentProcess = spawnNpm(["run", "dev"]);
      const result = await waitForProcessClose(developmentProcess, 15_000);
      expect(result.exitCode).not.toBe(0);
    } finally {
      try {
        if (developmentProcess !== undefined) {
          await stopProcess(developmentProcess);
        }
      } finally {
        try {
          if (holder !== undefined) {
            await closeServer(holder);
          }
        } finally {
          await assertFixedPortsReleased();
        }
      }
    }
  });
}
