import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { V1_NUMERIC_MAXIMUM } from "../../src/shared/worksheet/types.js";
import { COUNT_COMPARE_MAKE_V1_MAXIMUM } from "../../src/worksheets/count-compare-make/definition.js";
import { FIND_THE_WOW_V1_MAXIMUM } from "../../src/worksheets/find-the-wow/definition.js";

/**
 * One source of truth for the Version 1 numeric envelope.
 *
 * The envelope is the largest number any generated quantity, operand or result
 * may reach. It is read by the projection boundary that clamps to it, by the
 * invariant checker that re-verifies the clamp, by the families whose own limit
 * arithmetic repeats it, and by the controls that disclose it to a parent. A
 * previous round grew a THIRD independent `= 20` definition beside the other
 * two, and the deadness proofs in `shared/worksheet/limit-labels.test.ts` rest
 * on those numbers being the same one - an equality nothing executed.
 *
 * A runtime check alone cannot close that. `toBe` on a number is value
 * equality, so a family constant retyped as a fresh `20` satisfies it exactly
 * as a re-export does. This file therefore pairs the runtime identity with a
 * SOURCE check, and the source check is the half that fails on re-duplication:
 *
 * 1. The envelope has exactly one numeric-literal definition in the shipped
 *    tree, it is in the leaf module every consumer imports, and the number on
 *    that line is the number this test imported.
 * 2. Every other `*_V1_MAXIMUM` constant is defined as `V1_NUMERIC_MAXIMUM`
 *    and nothing else. A new family alias fails until it is declared here and
 *    given its own identity assertion; an existing one retyped as a literal
 *    fails immediately.
 *
 * Placement: beside the other repository-contract tests rather than under
 * `src/`, because nothing in the shipped application reads a source file.
 */

/* --------------------------------------------------------------------------
 * Paths - resolved from this module's own URL, never from the CWD
 * ----------------------------------------------------------------------- */

const testDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(testDirectory, "../..");
const sourceRoot = resolve(frontendRoot, "src");

const SCANNED_EXTENSIONS = [".ts", ".tsx"];
const TEST_SUFFIXES = [".test.ts", ".test.tsx"];

/**
 * The scan covers shipped modules only. A test file may hold whatever fixture
 * number it needs; what must not exist twice is a DEFINITION the application
 * runs on. Excluding tests also keeps this file out of its own scan, so the
 * patterns below can be written plainly instead of contorted to avoid matching
 * themselves.
 */
function shippedSourceFiles(directory: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...shippedSourceFiles(path));
    } else if (
      SCANNED_EXTENSIONS.some((suffix) => path.endsWith(suffix)) &&
      !TEST_SUFFIXES.some((suffix) => path.endsWith(suffix))
    ) {
      found.push(path);
    }
  }
  return found;
}

interface ConstantDefinition {
  readonly file: string;
  readonly name: string;
  readonly value: string;
}

const ENVELOPE_NAME = "V1_NUMERIC_MAXIMUM";

/** `[export] const NAME[: type] = VALUE;` on one line, which is how all of these are written. */
const DEFINITION_PATTERN =
  /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*([^;]+);\s*$/u;

function definitionsUnder(root: string): readonly ConstantDefinition[] {
  const definitions: ConstantDefinition[] = [];
  for (const path of shippedSourceFiles(root)) {
    const file = path.slice(frontendRoot.length + 1).replaceAll("\\", "/");
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = DEFINITION_PATTERN.exec(line);
      const name = match?.[1];
      const value = match?.[2];
      if (name === undefined || value === undefined) {
        continue;
      }
      if (name === ENVELOPE_NAME || name.endsWith("_V1_MAXIMUM")) {
        definitions.push({ file, name, value: value.trim() });
      }
    }
  }
  return definitions;
}

/**
 * The family aliases, each paired with the value that module really exports.
 *
 * Declared as a table so the source scan and the runtime identity assertions
 * cannot cover different sets: the scan's own findings are checked against
 * these keys, so an alias added without an entry here fails.
 */
const DECLARED_ALIASES: Readonly<Record<string, number>> = {
  COUNT_COMPARE_MAKE_V1_MAXIMUM,
  FIND_THE_WOW_V1_MAXIMUM,
};

describe("the Version 1 numeric envelope has one definition", () => {
  test("every family alias IS the leaf constant, not a number equal to it", () => {
    for (const [name, value] of Object.entries(DECLARED_ALIASES)) {
      expect(value, name).toBe(V1_NUMERIC_MAXIMUM);
    }
  });

  test("the shipped tree defines the envelope once, from one numeric literal", () => {
    const envelope = definitionsUnder(sourceRoot).filter(
      ({ name }) => name === ENVELOPE_NAME,
    );
    expect(envelope.map(({ file }) => file)).toEqual([
      "src/shared/worksheet/types.ts",
    ]);
    const value = envelope[0]?.value ?? "";
    expect(`${ENVELOPE_NAME} = ${value}`).toMatch(
      new RegExp(`^${ENVELOPE_NAME} = \\d+$`, "u"),
    );
    // The scanned line is the constant this test imported, so the one literal
    // found above is the one the application actually runs on.
    expect(Number(value)).toBe(V1_NUMERIC_MAXIMUM);
  });

  test("every other envelope constant is a re-export, never a second literal", () => {
    const aliases = definitionsUnder(sourceRoot).filter(
      ({ name }) => name !== ENVELOPE_NAME,
    );
    expect(
      aliases.map(({ name, value }) => `${name} = ${value}`).sort(),
    ).toEqual(
      Object.keys(DECLARED_ALIASES)
        .map((name) => `${name} = ${ENVELOPE_NAME}`)
        .sort(),
    );
  });
});
