import {
  API_PORT,
  LOOPBACK_HOST,
} from "../shared/runtime/ports.js";
import { CANONICAL_CONFIG_PATH, runServer } from "./startup.js";

const WATCH_FAILURE_EXIT_CODE = 1;
const WATCH_FAILURE_RELAY_TIMEOUT_MS = 1_000;
const WATCH_LIFECYCLE_EVENT = "dev:server";
const watchSupervisorPid = process.ppid;
let watchFailureIsPropagating = false;

function exitWithWatchFailure(): never {
  process.exit(WATCH_FAILURE_EXIT_CODE);
}

function propagateFailureToWatchSupervisor(): void {
  if (watchFailureIsPropagating) {
    return;
  }

  watchFailureIsPropagating = true;
  process.exitCode = WATCH_FAILURE_EXIT_CODE;
  process.once("SIGINT", exitWithWatchFailure);
  process.once("SIGTERM", exitWithWatchFailure);

  if (
    process.env.npm_lifecycle_event !== WATCH_LIFECYCLE_EVENT ||
    process.ppid !== watchSupervisorPid ||
    watchSupervisorPid <= 1
  ) {
    exitWithWatchFailure();
  }

  try {
    process.kill(watchSupervisorPid, "SIGTERM");
  } catch {
    exitWithWatchFailure();
  }

  setTimeout(exitWithWatchFailure, WATCH_FAILURE_RELAY_TIMEOUT_MS);
}

await runServer(
  {
    configPath: CANONICAL_CONFIG_PATH,
    host: LOOPBACK_HOST,
    port: API_PORT,
    securityMode: "fixed",
    staticFiles: { mode: "disabled" },
  },
  { onFatalFailure: propagateFailureToWatchSupervisor },
);
