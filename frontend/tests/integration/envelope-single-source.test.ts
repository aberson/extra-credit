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
 * arithmetic repeats it, by the ten-frame ceiling in the preview, and by the
 * controls that disclose it to a parent. A previous round grew a THIRD
 * independent `= 20` definition beside the other two, and the deadness proofs
 * in `shared/worksheet/limit-labels.test.ts` rest on those numbers being the
 * same one - an equality nothing executed.
 *
 * A runtime check alone cannot close that. `toBe` on a number is value
 * equality, so a constant retyped as a fresh `20` satisfies it exactly as a
 * re-export does. This file therefore pairs the runtime identity with SOURCE
 * scans, and the source half is what fails on re-duplication. All three tests
 * read the same tree: `frontend/src`, files ending `.ts` or `.tsx`, minus
 * `.test.ts` and `.test.tsx`.
 *
 * 1. Exactly one single-line `const V1_NUMERIC_MAXIMUM = <digits>;` exists in
 *    that tree, it is in the leaf module every consumer imports, and the number
 *    on that line is the number this test imported.
 * 2. Every alias in `DECLARED_ALIASES` is defined in its declared file as the
 *    identifier `V1_NUMERIC_MAXIMUM` and nothing else, and every single-line
 *    definition whose name ends `_V1_MAXIMUM` or matches a declared alias is in
 *    that table. The aliases their modules export are additionally asserted
 *    `toBe` the leaf constant at runtime; a module-private alias has no
 *    importable value and is held to the source half alone, which is the half
 *    that catches a literal.
 * 3. No shipped module carries the standalone token `20` in code - comments,
 *    string literals and template literals blanked first - unless that exact
 *    line is a reviewed entry in `REVIEWED_LITERAL_SITES`. This is the half
 *    that sees a literal under ANY name, including a module-private one, and an
 *    inline `Math.min(x, 20)` that defines nothing at all.
 *
 * What these still cannot see, stated so nobody trusts them further than they
 * reach: a declaration written ACROSS TWO LINES escapes the one-line pattern
 * behind (1) and (2), and `eslint --max-warnings 0` accepts that formatting.
 * Test (3) reads lines rather than declarations, so a two-line declaration
 * whose value is a bare `20` still fails there; a two-line declaration that
 * aliases the constant by NAME is invisible to all three. Test (3) also reads a
 * regular-expression literal as code, so a `20` inside one would have to be
 * reviewed like any other site.
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
 * runs on. The scan root is `src` and this file lives under `tests/integration`,
 * so it is outside the scan whatever the suffix filter does, and the patterns
 * below can be written plainly rather than contorted to avoid matching
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

/** A scanned path, relative to `frontend/` and with forward slashes. */
function repositoryPath(path: string): string {
  return path.slice(frontendRoot.length + 1).replaceAll("\\", "/");
}

interface ConstantDefinition {
  readonly file: string;
  readonly name: string;
  readonly value: string;
}

const ENVELOPE_NAME = "V1_NUMERIC_MAXIMUM";

/**
 * One entry per constant that stands for the envelope somewhere in the shipped
 * tree, held as data so the source scan and the runtime identity assertions
 * cannot cover different sets: the scan's findings are compared against this
 * table, so an alias added without an entry fails, and an entry whose constant
 * moved or was retyped fails too.
 */
interface DeclaredAlias {
  /** The name the shipped module declares. */
  readonly name: string;
  /** The file that must declare it, relative to `frontend/`. */
  readonly file: string;
  /**
   * The value the module exports, for the runtime identity assertion. Omitted
   * for a module-private alias, which no test can import: the source half is
   * the whole of its guard, and that is the half a literal fails.
   */
  readonly exported?: number;
}

const DECLARED_ALIASES: readonly DeclaredAlias[] = [
  {
    name: "COUNT_COMPARE_MAKE_V1_MAXIMUM",
    file: "src/worksheets/count-compare-make/definition.ts",
    exported: COUNT_COMPARE_MAKE_V1_MAXIMUM,
  },
  {
    name: "FIND_THE_WOW_V1_MAXIMUM",
    file: "src/worksheets/find-the-wow/definition.ts",
    exported: FIND_THE_WOW_V1_MAXIMUM,
  },
  {
    // Module-private: the ten-frame ceiling the preview draws to.
    name: "MAXIMUM_TEN_FRAME_CELLS",
    file: "src/web/preview/InstructionalVisual.tsx",
  },
];

const DECLARED_ALIAS_NAMES = new Set(DECLARED_ALIASES.map(({ name }) => name));

/** `[export] const NAME[: type] = VALUE;` on one line, which is how all of these are written. */
const DEFINITION_PATTERN =
  /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*([^;]+);\s*$/u;

/**
 * A definition this file is responsible for: the envelope itself, anything
 * named like a family alias, and every name the table above declares. The
 * `_V1_MAXIMUM` suffix is what catches an alias nobody declared; the declared
 * names are what catch a declared alias that stopped being one.
 */
function isEnvelopeConstantName(name: string): boolean {
  return (
    name === ENVELOPE_NAME ||
    name.endsWith("_V1_MAXIMUM") ||
    DECLARED_ALIAS_NAMES.has(name)
  );
}

function definitionsUnder(root: string): readonly ConstantDefinition[] {
  const definitions: ConstantDefinition[] = [];
  for (const path of shippedSourceFiles(root)) {
    const file = repositoryPath(path);
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = DEFINITION_PATTERN.exec(line);
      const name = match?.[1];
      const value = match?.[2];
      if (name === undefined || value === undefined) {
        continue;
      }
      if (isEnvelopeConstantName(name)) {
        definitions.push({ file, name, value: value.trim() });
      }
    }
  }
  return definitions;
}

/* --------------------------------------------------------------------------
 * The bare-literal scan
 * ----------------------------------------------------------------------- */

/**
 * The source with comments, string literals and template literals blanked out,
 * so the token scan reads code and not prose: `"early-primary-within-20"` is an
 * identifier a parent never sees as arithmetic, and a docblock discussing the
 * number 20 is not a second definition of it. Newlines survive the blanking, so
 * a finding still names the line it is on.
 *
 * Proved on the whole shipped tree rather than argued: appending
 * `const scanProbe = 20;` to each of the scanned files in turn is detected in
 * every one, so no quote or comment in the tree desynchronises this reader.
 */
function codeOnly(source: string): string {
  let out = "";
  let index = 0;
  let mode = "code";
  while (index < source.length) {
    const character = source[index] ?? "";
    const pair = source.slice(index, index + 2);
    if (mode === "code") {
      if (pair === "/*" || pair === "//") {
        mode = pair === "/*" ? "block" : "line";
        out += "  ";
        index += 2;
      } else if (character === '"' || character === "'" || character === "`") {
        mode = character;
        out += " ";
        index += 1;
      } else {
        out += character;
        index += 1;
      }
    } else if (mode === "block" && pair === "*/") {
      mode = "code";
      out += "  ";
      index += 2;
    } else if (mode === "line" || mode === "block") {
      if (character === "\n" && mode === "line") {
        mode = "code";
      }
      out += character === "\n" ? "\n" : " ";
      index += 1;
    } else if (character === "\\") {
      // An escape, including a line continuation: consume both characters but
      // keep the newline so line numbers do not drift.
      out += " ";
      out += source[index + 1] === "\n" ? "\n" : " ";
      index += 2;
    } else {
      if (character === mode) {
        mode = "code";
      }
      out += character === "\n" ? "\n" : " ";
      index += 1;
    }
  }
  return out;
}

/**
 * The envelope written as a number rather than named. Bounded so a longer
 * number that merely contains it (`120`, `20.5`, `0.20`) is not a finding.
 */
const BARE_LITERAL_PATTERN = /(?<![\w.$])20(?![\w.$])/u;

interface ReviewedLiteralSite {
  readonly file: string;
  /** The line exactly as it is written, trimmed. */
  readonly text: string;
  readonly reason: string;
}

/**
 * Every line of shipped code allowed to spell the envelope as a number, one
 * entry per reviewed line with the reason it is not a second definition.
 *
 * A reviewed line is matched by file AND text, so the same payload written into
 * a different module is a finding, and a stale entry whose line is gone is a
 * finding in the other direction.
 */
const REVIEWED_LITERAL_SITES: readonly ReviewedLiteralSite[] = [
  {
    file: "src/shared/worksheet/types.ts",
    text: "export const V1_NUMERIC_MAXIMUM = 20;",
    reason:
      "the one definition; the test above pins it to this file and to the value this test imported",
  },
  {
    file: "src/shared/config/math-presets.ts",
    text: "countingMax: 20,",
    reason:
      "a stored profile value in a reviewed preset payload, not a limit the code computes with: the projection clamps whatever a preset stores",
  },
  {
    file: "src/shared/config/math-presets.ts",
    text: "numeralMax: 20,",
    reason: "same preset payload as countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    text: "compareMax: 20,",
    reason: "same preset payload as countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    text: "operandMax: 20,",
    reason: "same preset payload as countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    text: "resultMax: 20,",
    reason: "same preset payload as countingMax",
  },
];

function reviewedKey({ file, text }: { file: string; text: string }): string {
  return `${file}: ${text}`;
}

function bareLiteralSites(root: string): readonly string[] {
  const sites = new Set<string>();
  for (const path of shippedSourceFiles(root)) {
    const file = repositoryPath(path);
    const source = readFileSync(path, "utf8");
    const lines = source.split("\n");
    codeOnly(source)
      .split("\n")
      .forEach((code, index) => {
        if (BARE_LITERAL_PATTERN.test(code)) {
          sites.add(reviewedKey({ file, text: (lines[index] ?? "").trim() }));
        }
      });
  }
  return [...sites].sort();
}

describe("the Version 1 numeric envelope has one definition", () => {
  test("every exported family alias IS the leaf constant, not a number equal to it", () => {
    for (const { name, exported } of DECLARED_ALIASES) {
      if (exported === undefined) {
        continue;
      }
      expect(exported, name).toBe(V1_NUMERIC_MAXIMUM);
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
      aliases.map(({ file, name, value }) => `${file}: ${name} = ${value}`).sort(),
    ).toEqual(
      DECLARED_ALIASES.map(
        ({ file, name }) => `${file}: ${name} = ${ENVELOPE_NAME}`,
      ).sort(),
    );
  });

  test("no shipped module spells the envelope as a bare number off the reviewed list", () => {
    expect(bareLiteralSites(sourceRoot)).toEqual(
      REVIEWED_LITERAL_SITES.map(reviewedKey).sort(),
    );
  });
});
