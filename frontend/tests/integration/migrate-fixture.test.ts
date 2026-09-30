import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import { serializeAppConfig } from "../../src/server/config-store.js";
import {
  AppConfigV1Schema,
  type AppConfigV1,
} from "../../src/shared/config/legacy-v1.js";
import {
  classifyStoredConfig,
  migrateConfigV1ToV2,
} from "../../src/shared/config/migrate.js";
import { AppConfigV2Schema } from "../../src/shared/config/schema.js";
import {
  GOLDEN_UPGRADED_V1_FIXTURE_SHA256,
  acceptanceConfig,
  childrenV1FixtureBytes,
} from "../fixtures/profiles.js";

/**
 * The permanent fictional Version 1 fixture. Its bytes are the committed LF
 * blob of `config/children.example.json` at 5c22159; the root
 * `.gitattributes` keeps it LF on every checkout, so one digest holds on a
 * Windows worktree, in CI and in the release clean room. Nothing here calls
 * git, because the clean room has no repository.
 */

const FIXTURE_URL = new URL("../fixtures/config/children.v1.json", import.meta.url);
const EXAMPLE_URL = new URL("../../../config/children.example.json", import.meta.url);

const V1_FIXTURE_SHA256 =
  "bea454916bfa6383d07662f9b97fa8ac7dd2ab1cfbbeb3eebc8b41dbe22bd359";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("the fictional v1 fixture", () => {
  test("its bytes as read keep the pinned LF digest", async () => {
    const bytes = await readFile(FIXTURE_URL);
    expect(bytes.includes(0x0d)).toBe(false);
    expect(sha256(bytes)).toBe(V1_FIXTURE_SHA256);
  });

  test("it parses with the frozen v1 schema", async () => {
    const parsed = AppConfigV1Schema.parse(
      JSON.parse(await readFile(FIXTURE_URL, "utf8")),
    );
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.profiles).toHaveLength(3);
  });

  test("its parsed value equals the parsed committed example", async () => {
    // Compared only after parsing: the example is CRLF in a Windows worktree.
    const fixture: unknown = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
    const example: unknown = JSON.parse(await readFile(EXAMPLE_URL, "utf8"));
    expect(fixture).toEqual(example);
    expect(AppConfigV1Schema.parse(fixture)).toEqual(
      AppConfigV1Schema.parse(example),
    );
  });

  test("calibration: a one-byte change moves the digest", async () => {
    const bytes = Buffer.from(await readFile(FIXTURE_URL));
    const changed = Buffer.from(bytes);
    changed[changed.length - 1] = changed[changed.length - 1] === 0x0a ? 0x20 : 0x0a;
    expect(sha256(changed)).not.toBe(V1_FIXTURE_SHA256);
    const crlf = Buffer.from(bytes.toString("utf8").replaceAll("\n", "\r\n"), "utf8");
    expect(sha256(crlf)).not.toBe(V1_FIXTURE_SHA256);
  });
});

/**
 * The golden upgraded digest: the version 2 bytes the store writes when it
 * upgrades the v1 fixture unchanged. Its formula is the migration's bare
 * output parsed by the v2 schema and serialized as the store serializes, and
 * the classifier must hand back exactly that parsed object.
 */
describe("the golden upgraded digest of the v1 fixture", () => {
  function upgradedBytes(v1: AppConfigV1): Buffer {
    return serializeAppConfig(AppConfigV2Schema.parse(migrateConfigV1ToV2(v1)));
  }

  test("equals the pinned SHA-256, and the classifier returns that parsed object", async () => {
    const raw: unknown = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
    const v1 = AppConfigV1Schema.parse(raw);
    const expected = AppConfigV2Schema.parse(migrateConfigV1ToV2(v1));
    expect(sha256(upgradedBytes(v1))).toBe(GOLDEN_UPGRADED_V1_FIXTURE_SHA256);
    const classified = classifyStoredConfig(raw);
    expect(classified.kind).toBe("legacy");
    expect(classified.kind === "legacy" ? classified.config : undefined).toEqual(expected);
    expect(sha256(serializeAppConfig(
      classified.kind === "legacy" ? classified.config : expected,
    ))).toBe(GOLDEN_UPGRADED_V1_FIXTURE_SHA256);
  });

  test("the shared fixture exports are the fixture bytes and the example's classifier output", async () => {
    expect(Buffer.compare(childrenV1FixtureBytes, await readFile(FIXTURE_URL))).toBe(0);
    const example: unknown = JSON.parse(await readFile(EXAMPLE_URL, "utf8"));
    const classified = classifyStoredConfig(example);
    expect(classified.kind === "legacy" ? classified.config : undefined).toEqual(acceptanceConfig);
  });

  test("calibration: mutating one field of a runtime copy changes the upgraded digest", async () => {
    const v1 = AppConfigV1Schema.parse(JSON.parse(await readFile(FIXTURE_URL, "utf8")));
    expect(sha256(upgradedBytes(v1))).toBe(GOLDEN_UPGRADED_V1_FIXTURE_SHA256);
    const copy = structuredClone(v1);
    copy.profiles[1]!.mathSkills.resultMax -= 1;
    expect(sha256(upgradedBytes(copy))).not.toBe(GOLDEN_UPGRADED_V1_FIXTURE_SHA256);
    const layout = structuredClone(v1);
    layout.defaults.useInterests = !layout.defaults.useInterests;
    expect(sha256(upgradedBytes(layout))).not.toBe(GOLDEN_UPGRADED_V1_FIXTURE_SHA256);
  });
});
