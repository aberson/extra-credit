import { readFileSync } from "node:fs";

import { classifyStoredConfig } from "../../src/shared/config/migrate.js";
import {
  ChildProfileV2Schema,
  type AppConfigV2,
} from "../../src/shared/config/schema.js";

/**
 * The version 2 config every test that needs the canonical fictional profiles
 * uses: the store's own classifier applied to the committed example, an
 * identity-only version 2 file. Read only the committed fictional example,
 * never the local family config.
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
 * The v1 fixture read through the store's classifier: the same three
 * fictional children, each carrying its earlier settings in `legacyChoices`.
 * Tests that need a migrated child, or the canonical children's former
 * choices, read them here.
 */
export const migratedV1FixtureConfig: AppConfigV2 = classifiedConfig(
  JSON.parse(childrenV1FixtureBytes.toString("utf8")),
);

/** The keys an identity-only version 2 profile may carry. */
const IDENTITY_KEYS: ReadonlySet<string> = new Set([
  "id",
  "displayName",
  "reviewedOn",
  "interests",
]);

/**
 * Whether a stored record is a valid version 2 profile holding only the
 * parent's identity fields: no `legacyChoices`, no age and no version 1
 * capability field.
 */
export function isIdentityOnlyProfile(record: unknown): boolean {
  return (
    ChildProfileV2Schema.safeParse(record).success &&
    Object.keys(record as object).every((key) => IDENTITY_KEYS.has(key))
  );
}

/**
 * SHA-256 of the version 2 bytes the store writes when it upgrades the v1
 * fixture unchanged: `serializeAppConfig(AppConfigV2Schema.parse(
 * migrateConfigV1ToV2(v1)))`. `tests/integration/migrate-fixture.test.ts`
 * derives and pins it; the upgrade round trips compare the file they wrote.
 */
export const GOLDEN_UPGRADED_V1_FIXTURE_SHA256 =
  "47d842e5f33065e4cca7172aa516a7a191f82acfa9c1a621acba7da371f3f620";

function classifiedConfig(stored: unknown): AppConfigV2 {
  const classified = classifyStoredConfig(stored);
  if (classified.kind !== "legacy" && classified.kind !== "current") {
    throw new Error(`The committed example classified as ${classified.kind}.`);
  }
  return classified.config;
}
