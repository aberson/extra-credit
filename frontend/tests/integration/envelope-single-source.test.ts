import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
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
 * scans, and the source half is what fails on re-duplication.
 *
 * HOW THE SOURCE IS READ. Every scan below hands the file to the compiler this
 * repository already type-checks with - `ts.createSourceFile` from the
 * `typescript` dependency - and walks the syntax tree it returns. No scan here
 * matches source text against a pattern, so what counts as code is the
 * parser's answer and not a regular expression's:
 *
 *   - a `20` in a line or block comment, in a string literal, in the TEXT of a
 *     template literal, inside a regular-expression literal, or in JSX text is
 *     no numeric literal and is no finding;
 *   - a `20` inside a template literal's `${...}` substitution IS a finding,
 *     because a substitution is code;
 *   - `0x14`, `2_0`, `20.0` and `20e0` are the same numeric literal as `20` to
 *     the parser and are found too, while `120` and `0.20` are different
 *     literals and are not;
 *   - a declaration is one declaration however many LINES it is written
 *     across, so the two-line spelling a line-based reader could not see is
 *     read here like any other.
 *
 * The second test in this file runs that classification over a fixture holding
 * each of those shapes - a regular expression containing both a double quote
 * and an apostrophe among them - so the list above is an executed result and
 * not a description of intent.
 *
 * The tree read is `frontend/src`: regular files ending `.ts` or `.tsx`, minus
 * `.test.ts` and `.test.tsx`. Recursion is by real directory and reading is of
 * real files, so a symbolic link is skipped rather than followed and the scan
 * cannot leave the tree. This file lives under `tests/integration`, outside
 * that root, so the fixtures below can be written plainly rather than
 * contorted to avoid matching themselves.
 *
 * 1. Every file in that tree parses with no parse diagnostic, so no scan below
 *    is reading a tree the parser gave up on part way through.
 * 2. Exactly one `V1_NUMERIC_MAXIMUM` is declared in the tree; it is exported
 *    from the leaf module every consumer imports, and its whole initializer is
 *    the value this test imported at runtime, written in decimal.
 * 3. Every alias in `DECLARED_ALIASES` is declared in its stated file with
 *    `V1_NUMERIC_MAXIMUM` as its whole initializer and with the export
 *    visibility the table declares, and every declaration in the tree named
 *    `V1_NUMERIC_MAXIMUM`, ending `_V1_MAXIMUM`, or matching a declared alias
 *    name is in that table. The aliases their modules export are additionally
 *    asserted to equal the leaf constant at runtime, as a closed set that
 *    cannot quietly run empty; a module-private alias has no importable value
 *    and is held to the source half alone, which is the half a literal fails.
 * 4. Every numeric literal equal to the envelope anywhere in the tree is a
 *    reviewed entry of `REVIEWED_LITERAL_SITES` - one entry per literal
 *    OCCURRENCE, not per distinct line text, anchored to the file and the
 *    enclosing declaration rather than to a line number. So a second literal
 *    in an already-listed file is a finding, and an entry whose literal is
 *    gone is a finding in the other direction. This is the half that sees a
 *    literal under any name, including a module-private one, and an inline
 *    `Math.min(x, 20)` that declares nothing at all.
 *
 * What these still cannot see, stated so nobody trusts them further than they
 * reach: a second envelope written as ARITHMETIC (`4 * 5`, `10 + 10`) is not a
 * numeric literal equal to the envelope and passes test 4; a constant that
 * aliases the envelope BY NAME under a name test 3 does not recognise is a
 * name and not a literal, so it passes both source scans; and the runtime half
 * reaches only what a module exports.
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
 * runs on. Directories are recursed only when the entry really is a directory
 * and files are collected only when the entry really is a file, so a symbolic
 * link or a junction is skipped rather than read. The result is sorted, so the
 * scan order is the same on Windows and on CI's Ubuntu.
 */
function shippedSourceFiles(directory: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...shippedSourceFiles(path));
    } else if (
      entry.isFile() &&
      SCANNED_EXTENSIONS.some((suffix) => path.endsWith(suffix)) &&
      !TEST_SUFFIXES.some((suffix) => path.endsWith(suffix))
    ) {
      found.push(path);
    }
  }
  return [...found].sort();
}

/** A scanned path, relative to `frontend/` and with forward slashes. */
function frontendPath(path: string): string {
  return path.slice(frontendRoot.length + 1).replaceAll("\\", "/");
}

/* --------------------------------------------------------------------------
 * The parser
 * ----------------------------------------------------------------------- */

/**
 * A parsed module together with the parser's own syntax errors.
 *
 * `parseDiagnostics` is how a `SourceFile` carries them, but it is not part of
 * the published `typescript` type surface, so it is declared here as optional
 * and test 1 asserts it is actually PRESENT before it asserts it is empty: a
 * future compiler that stops exposing it turns that test red rather than
 * silently certifying every file as clean.
 */
interface ParsedModule extends ts.SourceFile {
  readonly parseDiagnostics?: readonly ts.Diagnostic[];
}

function parseModule(file: string, source: string): ParsedModule {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function eachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => {
    eachNode(child, visit);
  });
}

/** The name a declaration gives its subject, when it is a plain one. */
function declaredName(node: ts.Node): string | undefined {
  if (
    ts.isVariableDeclaration(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isParameter(node) ||
    ts.isEnumMember(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isModuleDeclaration(node)
  ) {
    const { name } = node;
    if (
      name !== undefined &&
      (ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name))
    ) {
      return name.text;
    }
  }
  return undefined;
}

const MODULE_SCOPE = "(module scope)";

/**
 * The dotted path of declaration names enclosing a node, outermost first, so a
 * finding is anchored to
 * `MATH_PRESETS.early-primary-within-20.mathSkills.countingMax` rather than to
 * a line number a later edit shifts. Two occurrences that really do share one
 * declaration share one anchor, and the reviewed list then holds one entry for
 * each of them.
 */
function enclosingDeclaration(node: ts.Node): string {
  const names: string[] = [];
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    const name = declaredName(current);
    if (name !== undefined) {
      names.push(name);
    }
    current = current.parent;
  }
  return names.length === 0 ? MODULE_SCOPE : [...names].reverse().join(".");
}

/* --------------------------------------------------------------------------
 * The declaration scan
 * ----------------------------------------------------------------------- */

interface ConstantDefinition {
  readonly file: string;
  readonly name: string;
  readonly exported: boolean;
  /** The whole initializer, with runs of whitespace collapsed to one space. */
  readonly value: string;
}

const ENVELOPE_NAME = "V1_NUMERIC_MAXIMUM";

/** The envelope as the parser spells it: the digits this test imported. */
const ENVELOPE_LITERAL_TEXT = String(V1_NUMERIC_MAXIMUM);

/**
 * One entry per constant that stands for the envelope somewhere in the shipped
 * tree, held as data so the source scan and the runtime identity assertions
 * cannot cover different sets: the scan's findings are compared against this
 * table, so an alias added without an entry fails, and an entry whose constant
 * moved, was retyped or changed export visibility fails too.
 */
interface DeclaredAlias {
  /** The name the shipped module declares. */
  readonly name: string;
  /** The file that must declare it, relative to `frontend/`. */
  readonly file: string;
  /**
   * The value the module exports, for the runtime identity assertion. Omitted
   * for a module-private alias, which no test can import: the source half is
   * the whole of its guard, and that is the half a literal fails. Whether an
   * entry may omit it is not a matter of taste - the source scan reads each
   * declaration's export visibility and requires it to match this field.
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

/**
 * A declaration this file is responsible for: the envelope itself, anything
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

function isExported(declaration: ts.VariableDeclaration): boolean {
  const statement = declaration.parent.parent;
  return (
    ts.isVariableStatement(statement) &&
    (statement.modifiers ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}

function envelopeDefinitionsIn(
  file: string,
  source: string,
): readonly ConstantDefinition[] {
  const parsed = parseModule(file, source);
  const definitions: ConstantDefinition[] = [];
  eachNode(parsed, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) {
      return;
    }
    if (!isEnvelopeConstantName(node.name.text)) {
      return;
    }
    const { initializer } = node;
    definitions.push({
      file,
      name: node.name.text,
      exported: isExported(node),
      value:
        initializer === undefined
          ? "(no initializer)"
          : initializer.getText(parsed).replace(/\s+/gu, " ").trim(),
    });
  });
  return definitions;
}

function definitionsUnder(root: string): readonly ConstantDefinition[] {
  return shippedSourceFiles(root).flatMap((path) =>
    envelopeDefinitionsIn(frontendPath(path), readFileSync(path, "utf8")),
  );
}

function renderDefinition({
  file,
  name,
  exported,
  value,
}: ConstantDefinition): string {
  return `${file}: ${exported ? "export " : ""}const ${name} = ${value}`;
}

/* --------------------------------------------------------------------------
 * The bare-literal scan
 * ----------------------------------------------------------------------- */

interface LiteralOccurrence {
  readonly file: string;
  readonly declaration: string;
  readonly line: number;
  /** The line the literal starts on, exactly as written, trimmed. */
  readonly text: string;
}

/**
 * Every numeric literal equal to the envelope in one module, one row per
 * occurrence. Takes its source as an argument rather than a path so the
 * classification test can run the real scan over a fixture.
 */
function envelopeLiteralsIn(
  file: string,
  source: string,
): readonly LiteralOccurrence[] {
  const parsed = parseModule(file, source);
  const lines = source.split("\n");
  const occurrences: LiteralOccurrence[] = [];
  eachNode(parsed, (node) => {
    if (!ts.isNumericLiteral(node) || node.text !== ENVELOPE_LITERAL_TEXT) {
      return;
    }
    const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
    occurrences.push({
      file,
      declaration: enclosingDeclaration(node),
      line: line + 1,
      text: (lines[line] ?? "").trim(),
    });
  });
  return occurrences;
}

function literalsUnder(root: string): readonly LiteralOccurrence[] {
  return shippedSourceFiles(root).flatMap((path) =>
    envelopeLiteralsIn(frontendPath(path), readFileSync(path, "utf8")),
  );
}

interface ReviewedLiteralSite {
  readonly file: string;
  /** The enclosing declaration path, as `enclosingDeclaration` renders it. */
  readonly declaration: string;
  /** The line exactly as it is written, trimmed. */
  readonly text: string;
  readonly reason: string;
}

/**
 * Every literal in shipped code allowed to spell the envelope as a number, one
 * entry per OCCURRENCE with the reason it is not a second definition.
 *
 * An occurrence is matched by file, enclosing declaration and line text
 * together, and the two sides are compared as multisets rather than as sets:
 * two occurrences under one declaration need two entries, the same payload
 * written into another module or another declaration is a finding, and an
 * entry whose occurrence is gone is a finding in the other direction.
 */
const REVIEWED_LITERAL_SITES: readonly ReviewedLiteralSite[] = [
  {
    file: "src/shared/worksheet/types.ts",
    declaration: "V1_NUMERIC_MAXIMUM",
    text: "export const V1_NUMERIC_MAXIMUM = 20;",
    reason:
      "the one definition; the test above pins it to this file and to the value this test imported",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-10.mathSkills.countingMax",
    text: "countingMax: 20,",
    reason:
      "a stored profile value in a reviewed preset payload, not a limit the code computes with: the projection clamps whatever a preset stores",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-10.mathSkills.numeralMax",
    text: "numeralMax: 20,",
    reason: "same preset payload as this preset's countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-10.mathSkills.compareMax",
    text: "compareMax: 20,",
    reason: "same preset payload as this preset's countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-20.mathSkills.countingMax",
    text: "countingMax: 20,",
    reason:
      "the within-20 preset's own payload: a separate reviewed occurrence from the within-10 preset's identically written line",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-20.mathSkills.numeralMax",
    text: "numeralMax: 20,",
    reason: "same preset payload as this preset's countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-20.mathSkills.compareMax",
    text: "compareMax: 20,",
    reason: "same preset payload as this preset's countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-20.mathSkills.operandMax",
    text: "operandMax: 20,",
    reason: "same preset payload as this preset's countingMax",
  },
  {
    file: "src/shared/config/math-presets.ts",
    declaration: "MATH_PRESETS.early-primary-within-20.mathSkills.resultMax",
    text: "resultMax: 20,",
    reason: "same preset payload as this preset's countingMax",
  },
];

function occurrenceKey({
  file,
  declaration,
  text,
}: {
  readonly file: string;
  readonly declaration: string;
  readonly text: string;
}): string {
  return `${file}: ${declaration}: ${text}`;
}

/**
 * The findings, in the shape the sibling plan-citation guard uses: each string
 * says where the literal is and what to do about it, so whoever trips this
 * test reads the repair rather than an array diff. Both directions are
 * covered - an occurrence with no reviewed entry left to spend, and a reviewed
 * entry no occurrence claimed - and the entries are a COUNTED budget, so a
 * second occurrence matching an entry already spent is a finding too.
 */
function envelopeLiteralFindings(root: string): readonly string[] {
  const budget = new Map<string, number>();
  for (const site of REVIEWED_LITERAL_SITES) {
    const key = occurrenceKey(site);
    budget.set(key, (budget.get(key) ?? 0) + 1);
  }
  const findings: string[] = [];
  for (const occurrence of literalsUnder(root)) {
    const key = occurrenceKey(occurrence);
    const remaining = budget.get(key) ?? 0;
    if (remaining > 0) {
      budget.set(key, remaining - 1);
      continue;
    }
    findings.push(
      `${occurrence.file}:${occurrence.line} spells the envelope as a number inside ${occurrence.declaration}; import ${ENVELOPE_NAME} instead, or add a reviewed entry naming that declaration and the reason it is not a second definition`,
    );
  }
  for (const [key, remaining] of budget) {
    for (let spare = 0; spare < remaining; spare += 1) {
      findings.push(
        `${key} is on the reviewed list but no such literal is in the tree; drop the entry`,
      );
    }
  }
  return [...findings].sort();
}

/* --------------------------------------------------------------------------
 * The fixture behind the classification claims in the header
 * ----------------------------------------------------------------------- */

const CLASSIFICATION_FIXTURE = [
  "// a line comment mentioning 20",
  "/* a block comment mentioning 20 */",
  'const pattern = /^https:\\/\\/[^\\s"\'<>]+$/u;',
  'const quoted = "a string holding 20";',
  "const templated = `template text holding 20`;",
  "const interpolated = `${WIDTH * 20}px`;",
  "const bare = 20;",
  "const hex = 0x14;",
  "const separated = 2_0;",
  "const trailing = 20.0;",
  "const exponent = 20e0;",
  "const bigger = 120;",
  "const fraction = 0.20;",
  "const markup = <p>Don't count to 20 here</p>;",
].join("\n");

describe("the Version 1 numeric envelope has one definition", () => {
  test("every shipped module parses, so no scan reads a fragment of one", () => {
    const unreadable: string[] = [];
    for (const path of shippedSourceFiles(sourceRoot)) {
      const file = frontendPath(path);
      const parsed = parseModule(file, readFileSync(path, "utf8"));
      const diagnostics = parsed.parseDiagnostics;
      if (diagnostics === undefined) {
        unreadable.push(
          `${file}: this compiler no longer reports parseDiagnostics, so the scans below cannot be shown to have read whole files`,
        );
        continue;
      }
      for (const diagnostic of diagnostics) {
        unreadable.push(
          `${file}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
        );
      }
    }
    expect(unreadable).toEqual([]);
  });

  test("the scan classifies by the parser, executed on a fixture not asserted in prose", () => {
    expect(
      envelopeLiteralsIn("fixture.tsx", CLASSIFICATION_FIXTURE).map(
        occurrenceKey,
      ),
    ).toEqual([
      // In source order: a substitution is code, the four spellings of the
      // envelope are one literal, and the comment, the string, the template
      // TEXT, the JSX text and the regular expression holding both a double
      // quote and an apostrophe are none of them findings - the regular
      // expression in particular does not carry the reader into the lines
      // after it.
      "fixture.tsx: interpolated: const interpolated = `${WIDTH * 20}px`;",
      "fixture.tsx: bare: const bare = 20;",
      "fixture.tsx: hex: const hex = 0x14;",
      "fixture.tsx: separated: const separated = 2_0;",
      "fixture.tsx: trailing: const trailing = 20.0;",
      "fixture.tsx: exponent: const exponent = 20e0;",
    ]);
  });

  test("every exported family alias IS the leaf constant, not a number equal to it", () => {
    expect(
      DECLARED_ALIASES.filter(({ exported }) => exported !== undefined)
        .map(({ name, exported }) => `${name} = ${String(exported)}`)
        .sort(),
    ).toEqual(
      [
        `COUNT_COMPARE_MAKE_V1_MAXIMUM = ${String(V1_NUMERIC_MAXIMUM)}`,
        `FIND_THE_WOW_V1_MAXIMUM = ${String(V1_NUMERIC_MAXIMUM)}`,
      ].sort(),
    );
  });

  test("the shipped tree defines the envelope once, from one numeric literal", () => {
    expect(
      definitionsUnder(sourceRoot)
        .filter(({ name }) => name === ENVELOPE_NAME)
        .map(renderDefinition),
    ).toEqual([
      `src/shared/worksheet/types.ts: export const ${ENVELOPE_NAME} = ${ENVELOPE_LITERAL_TEXT}`,
    ]);
  });

  test("every other envelope constant is a re-export, never a second literal", () => {
    expect(
      definitionsUnder(sourceRoot)
        .filter(({ name }) => name !== ENVELOPE_NAME)
        .map(renderDefinition)
        .sort(),
    ).toEqual(
      DECLARED_ALIASES.map(
        ({ file, name, exported }) =>
          `${file}: ${exported === undefined ? "" : "export "}const ${name} = ${ENVELOPE_NAME}`,
      ).sort(),
    );
  });

  test("no shipped module spells the envelope as a bare number off the reviewed list", () => {
    expect(envelopeLiteralFindings(sourceRoot)).toEqual([]);
  });
});
