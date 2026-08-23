import {
  API_PORT,
  LOOPBACK_HOST,
} from "../shared/runtime/ports.js";
import {
  CANONICAL_CONFIG_PATH,
  PRODUCTION_STATIC_ROOT,
  runServer,
} from "./startup.js";

await runServer({
  configPath: CANONICAL_CONFIG_PATH,
  host: LOOPBACK_HOST,
  port: API_PORT,
  securityMode: "fixed",
  staticFiles: { mode: "required", root: PRODUCTION_STATIC_ROOT },
});
