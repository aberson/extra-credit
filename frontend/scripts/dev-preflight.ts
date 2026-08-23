import { createServer } from "node:net";

import {
  API_PORT,
  LOOPBACK_HOST,
  WEB_PORT,
} from "../src/shared/runtime/ports.js";

const PREFLIGHT_ERROR_CODE = "EXTRA_CREDIT_DEV_PORT_UNAVAILABLE";

async function probePort(port: number): Promise<void> {
  const server = createServer();

  await new Promise<void>((resolveProbe, reject) => {
    server.once("error", reject);
    server.listen({ host: LOOPBACK_HOST, port, exclusive: true }, () => {
      server.close((error) => {
        if (error === undefined) {
          resolveProbe();
        } else {
          reject(error);
        }
      });
    });
  });
}

const results = await Promise.allSettled([
  probePort(API_PORT),
  probePort(WEB_PORT),
]);

if (results.some((result) => result.status === "rejected")) {
  process.stderr.write(
    `${PREFLIGHT_ERROR_CODE}: A required Extra Credit development port is unavailable.\n`,
  );
  process.exitCode = 1;
}
