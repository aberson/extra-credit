import { readFileSync } from "node:fs";

import { classifyStoredConfig } from "../../src/shared/config/migrate.js";
import type { AppConfigV2 } from "../../src/shared/config/schema.js";

/**
 * The version 2 config every test that needs the canonical fictional profiles
 * uses: the store's own classifier applied to the committed example, which
 * stays a byte-identical version 1 file until Step 18. Read only the committed
 * fictional example, never the local family config.
 */
export const acceptanceConfig: AppConfigV2 = classifiedConfig(
  JSON.parse(
    readFileSync(new URL("../../../config/children.example.json", import.meta.url), "utf8"),
  ),
);

/**
 * The permanent fictional version 1 fixture's bytes (the example's committed
 * LF blob at 5c22159), for tests that seed or compare a real v1 file.
 */
export const childrenV1FixtureBytes: Buffer = readFileSync(
  new URL("./config/children.v1.json", import.meta.url),
);

/**
 * SHA-256 of the version 2 bytes the store writes when it upgrades the v1
 * fixture unchanged: `serializeAppConfig(AppConfigV2Schema.parse(
 * migrateConfigV1ToV2(v1)))`. `tests/integration/migrate-fixture.test.ts`
 * derives and pins it; the upgrade round trips compare the file they wrote.
 */
export const GOLDEN_UPGRADED_V1_FIXTURE_SHA256 =
  "2bf677155c66df8c302c868bec35a8144bd2f7564a506a3ba44d21a2c2136528";

function classifiedConfig(stored: unknown): AppConfigV2 {
  const classified = classifyStoredConfig(stored);
  if (classified.kind !== "legacy" && classified.kind !== "current") {
    throw new Error(`The committed example classified as ${classified.kind}.`);
  }
  return classified.config;
}
