import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import { AppConfigV1Schema } from "../../src/shared/config/legacy-v1.js";

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
