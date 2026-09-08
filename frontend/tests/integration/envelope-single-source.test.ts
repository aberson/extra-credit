import { lstatSync, readdirSync, readFileSync } from "node:fs";
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
 * Value equality cannot tell a re-export from a constant retyped as a fresh
 * `20`, so the tests below pair the runtime identity with source scans: each
 * tree-level scan hands the shipped modules under `frontend/src` (`.ts` and
 * `.tsx`, `*.test.*` excluded) to the compiler this repository already
 * type-checks with and walks the syntax tree it returns, instead of matching
 * source text against a pattern.
 *
 * What this guard covers is defined by the tests and the fixtures below: a
 * claim about its reach arrives here as a fixture row plus a test, never as a
 * sentence in this comment. Known escapes are tracked on issue #23.
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
 * The shipped modules the scans read. A test file may hold whatever fixture
 * number it needs; what must not exist twice is a DEFINITION the application
 * runs on.
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

/**
 * The same tree walked a second time by a different route: a level-by-level
 * worklist rather than the recursion above, `lstat` rather than the `Dirent`
 * kind, and the suffixes written out here rather than `SCANNED_EXTENSIONS`
 * and `TEST_SUFFIXES`.
 */
function independentSourceWalk(root: string): readonly string[] {
  const walked: string[] = [];
  let pending: readonly string[] = [root];
  while (pending.length > 0) {
    const deeper: string[] = [];
    for (const directory of pending) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(entry.parentPath, entry.name);
        const kind = lstatSync(path);
        if (kind.isDirectory()) {
          deeper.push(path);
          continue;
        }
        const file = frontendPath(path);
        if (
          kind.isFile() &&
          (file.endsWith(".ts") || file.endsWith(".tsx")) &&
          !file.endsWith(".test.ts") &&
          !file.endsWith(".test.tsx")
        ) {
          walked.push(file);
        }
      }
    }
    pending = deeper;
  }
  return [...walked].sort();
}

/* --------------------------------------------------------------------------
 * The parser
 * ----------------------------------------------------------------------- */

/**
 * A parsed module together with the parser's own syntax errors.
 *
 * `parseDiagnostics` is how a `SourceFile` carries them, but it is not part of
 * the published `typescript` type surface, so it is declared here as optional
 * and the test "every shipped module parses, so no scan reads a fragment of
 * one" asserts it is actually PRESENT before it asserts it is empty: a future
 * compiler that stops exposing it turns that test red rather than silently
 * certifying every file as clean.
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
 * finding names
 * `MATH_PRESETS.early-primary-within-20.mathSkills.countingMax`. Two
 * occurrences under one declaration share one anchor.
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
  /**
   * A name taken out of a binding pattern records the expression it
   * destructures - or `(no initializer)` where the declaration has none -
   * marked as such: that render cannot be read as a direct initializer.
   */
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

/**
 * The identifiers a variable declaration binds, in source order. Which binding
 * shapes that covers is stated by the fixture rows below and the expectations
 * beside them, never here.
 */
function boundNames(name: ts.BindingName): readonly ts.Identifier[] {
  if (ts.isIdentifier(name)) {
    return [name];
  }
  const bound: ts.Identifier[] = [];
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      bound.push(...boundNames(element.name));
    }
  }
  return bound;
}

function envelopeDefinitionsIn(
  file: string,
  source: string,
): readonly ConstantDefinition[] {
  const parsed = parseModule(file, source);
  const definitions: ConstantDefinition[] = [];
  eachNode(parsed, (node) => {
    if (!ts.isVariableDeclaration(node)) {
      return;
    }
    const { initializer } = node;
    const written =
      initializer === undefined
        ? "(no initializer)"
        : initializer.getText(parsed).replace(/\s+/gu, " ").trim();
    const destructured = !ts.isIdentifier(node.name);
    for (const bound of boundNames(node.name)) {
      if (!isEnvelopeConstantName(bound.text)) {
        continue;
      }
      definitions.push({
        file,
        name: bound.text,
        exported: isExported(node),
        value: destructured ? `(destructured from ${written})` : written,
      });
    }
  });
  return definitions;
}

/**
 * The names a module's variable declarations bind, in source order, whatever
 * the name filter makes of them.
 */
function variableNamesIn(file: string, source: string): readonly string[] {
  const parsed = parseModule(file, source);
  const names: string[] = [];
  eachNode(parsed, (node) => {
    if (ts.isVariableDeclaration(node)) {
      names.push(...boundNames(node.name).map(({ text }) => text));
    }
  });
  return names;
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
 * The literals in shipped code allowed to spell the envelope as a number, one
 * entry per OCCURRENCE with the reason it is not a second definition. An
 * occurrence is matched by file, enclosing declaration and line text together.
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
 * test reads the repair rather than an array diff. Reviewed entries are a
 * COUNTED budget an occurrence spends. Takes both sides as arguments, so the
 * test below runs the real matching over a fixture.
 */
function findingsAgainst(
  occurrences: readonly LiteralOccurrence[],
  reviewed: readonly ReviewedLiteralSite[],
): readonly string[] {
  const budget = new Map<string, number>();
  for (const site of reviewed) {
    const key = occurrenceKey(site);
    budget.set(key, (budget.get(key) ?? 0) + 1);
  }
  const findings: string[] = [];
  for (const occurrence of occurrences) {
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

function envelopeLiteralFindings(root: string): readonly string[] {
  return findingsAgainst(literalsUnder(root), REVIEWED_LITERAL_SITES);
}

/* --------------------------------------------------------------------------
 * The fixtures the scans are executed over
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

/**
 * The declaration scan's own fixture. The tests below classify these rows by
 * running the real `envelopeDefinitionsIn`, `envelopeLiteralsIn` and
 * `isEnvelopeConstantName` over this text - both scans take their source as an
 * argument for that. This file sits outside the scanned tree, so the rows stay
 * fixture text rather than becoming definitions the scan of `src` reaches.
 */
const DECLARATION_FIXTURE = [
  "export const PROBE_V1_MAXIMUM =",
  "  20;",
  "const OTHER_V1_MAXIMUM =",
  "  V1_NUMERIC_MAXIMUM;",
  "const { V1_NUMERIC_MAXIMUM } = scanProbeLimits;",
  "const { resultMax: RESULT_V1_MAXIMUM } = scanProbeSkills;",
  "const { limits: { NESTED_V1_MAXIMUM } } = scanProbeNest;",
  "const [, , ELIDED_V1_MAXIMUM] = scanProbeRow;",
  "const [...REST_V1_MAXIMUM] = scanProbeRow;",
  "for (const { FOR_OF_V1_MAXIMUM } of scanProbeRows) {}",
  "const SAFE_CEILING = V1_NUMERIC_MAXIMUM;",
  "class ScanProbeLimits {",
  "  static readonly CLASS_V1_MAXIMUM = V1_NUMERIC_MAXIMUM;",
  "  static readonly CLASS_LITERAL_V1_MAXIMUM = 20;",
  "}",
  "const scanProbeTable = { OBJECT_V1_MAXIMUM: V1_NUMERIC_MAXIMUM };",
].join("\n");

/**
 * The reviewed-budget fixture: one declaration holding two identical
 * occurrences, so what one reviewed entry does and does not pay for is run
 * rather than described.
 */
const REVIEWED_BUDGET_FIXTURE = [
  "const scanProbeBudget = [",
  "  20,",
  "  20,",
  "];",
].join("\n");

describe("the Version 1 numeric envelope has one definition", () => {
  test("the scan itself reached the tree", () => {
    const scanned = shippedSourceFiles(sourceRoot).map(frontendPath);
    const walked = independentSourceWalk(sourceRoot);
    const oneSided = [
      ...scanned
        .filter((file) => !walked.includes(file))
        .map((file) => `${file}: scanned, not walked`),
      ...walked
        .filter((file) => !scanned.includes(file))
        .map((file) => `${file}: walked, not scanned`),
    ];
    expect(oneSided).toEqual([]);
    expect(walked).toContain("src/shared/worksheet/types.ts");
    expect(scanned).toEqual(walked);
  });

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
      // In source order: a substitution is code, the four alternative
      // spellings of the envelope are the same literal as `20`, and the
      // comment, the string, the template TEXT, the JSX text and the regular
      // expression holding both a double quote and an apostrophe are none of
      // them findings - the regular expression in particular does not carry
      // the reader into the lines after it.
      "fixture.tsx: interpolated: const interpolated = `${WIDTH * 20}px`;",
      "fixture.tsx: bare: const bare = 20;",
      "fixture.tsx: hex: const hex = 0x14;",
      "fixture.tsx: separated: const separated = 2_0;",
      "fixture.tsx: trailing: const trailing = 20.0;",
      "fixture.tsx: exponent: const exponent = 20e0;",
    ]);
  });

  test("the declaration scan reads a two-line declaration as one, and takes a destructured name out of its binding pattern", () => {
    expect(
      envelopeDefinitionsIn("fixture.ts", DECLARATION_FIXTURE).map(
        renderDefinition,
      ),
    ).toEqual([
      // Each two-line form renders as ONE definition, in the two shapes the
      // definition tests below compare: `= 20`, which those tests require of
      // the one definition, and `= V1_NUMERIC_MAXIMUM`, which they require of
      // an alias. A name taken out of a binding pattern is inventoried under
      // the name it binds and renders with what the declaration destructures,
      // or `(no initializer)` where it has none, marked so it reads as
      // neither shape.
      `fixture.ts: export const PROBE_V1_MAXIMUM = ${ENVELOPE_LITERAL_TEXT}`,
      `fixture.ts: const OTHER_V1_MAXIMUM = ${ENVELOPE_NAME}`,
      `fixture.ts: const ${ENVELOPE_NAME} = (destructured from scanProbeLimits)`,
      "fixture.ts: const RESULT_V1_MAXIMUM = (destructured from scanProbeSkills)",
      "fixture.ts: const NESTED_V1_MAXIMUM = (destructured from scanProbeNest)",
      "fixture.ts: const ELIDED_V1_MAXIMUM = (destructured from scanProbeRow)",
      "fixture.ts: const REST_V1_MAXIMUM = (destructured from scanProbeRow)",
      "fixture.ts: const FOR_OF_V1_MAXIMUM = (destructured from (no initializer))",
    ]);
  });

  test("the name filter, executed over the fixture's own variable names", () => {
    expect(
      variableNamesIn("fixture.ts", DECLARATION_FIXTURE).map(
        (name) =>
          `${name}: ${isEnvelopeConstantName(name) ? "inventoried" : "passed over"}`,
      ),
    ).toEqual([
      // In source order, each name run through `isEnvelopeConstantName` - the
      // same predicate the declaration scan filters on. `SAFE_CEILING` holds
      // the envelope under a name that predicate does not recognise, so the
      // escape is executed here rather than asserted by its absence from the
      // list above. `scanProbeTable` is the same case.
      "PROBE_V1_MAXIMUM: inventoried",
      "OTHER_V1_MAXIMUM: inventoried",
      `${ENVELOPE_NAME}: inventoried`,
      "RESULT_V1_MAXIMUM: inventoried",
      "NESTED_V1_MAXIMUM: inventoried",
      "ELIDED_V1_MAXIMUM: inventoried",
      "REST_V1_MAXIMUM: inventoried",
      "FOR_OF_V1_MAXIMUM: inventoried",
      "SAFE_CEILING: passed over",
      "scanProbeTable: passed over",
    ]);
  });

  test("a name alias off a variable declaration escapes that scan, the number at the same place does not", () => {
    expect(
      envelopeLiteralsIn("fixture.ts", DECLARATION_FIXTURE).map(occurrenceKey),
    ).toEqual([
      // The aliases BY NAME are gone - a name is no numeric literal - while
      // the two places that spell the envelope as a number are both here, the
      // class property among them.
      `fixture.ts: PROBE_V1_MAXIMUM: ${ENVELOPE_LITERAL_TEXT};`,
      `fixture.ts: ScanProbeLimits.CLASS_LITERAL_V1_MAXIMUM: static readonly CLASS_LITERAL_V1_MAXIMUM = ${ENVELOPE_LITERAL_TEXT};`,
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

  test("a reviewed entry is spent by one occurrence, so an identical second one is still a finding", () => {
    const occurrences = envelopeLiteralsIn(
      "fixture.ts",
      REVIEWED_BUDGET_FIXTURE,
    );
    const entry: ReviewedLiteralSite = {
      file: "fixture.ts",
      declaration: "scanProbeBudget",
      text: `${ENVELOPE_LITERAL_TEXT},`,
      reason: "the fixture's one reviewed entry",
    };
    // Two occurrences under one declaration, written identically, so they
    // share one key: what separates a counted budget from a set is whether the
    // second one is still a finding once the first has spent the entry.
    expect(occurrences.map(occurrenceKey)).toEqual([
      `fixture.ts: scanProbeBudget: ${ENVELOPE_LITERAL_TEXT},`,
      `fixture.ts: scanProbeBudget: ${ENVELOPE_LITERAL_TEXT},`,
    ]);
    expect(findingsAgainst(occurrences, [entry])).toEqual([
      `fixture.ts:3 spells the envelope as a number inside scanProbeBudget; import ${ENVELOPE_NAME} instead, or add a reviewed entry naming that declaration and the reason it is not a second definition`,
    ]);
    expect(findingsAgainst(occurrences, [entry, entry])).toEqual([]);
  });

  test("a reviewed entry no occurrence claimed is a finding in the other direction", () => {
    const entry: ReviewedLiteralSite = {
      file: "fixture.ts",
      declaration: "scanProbeBudget",
      text: `${ENVELOPE_LITERAL_TEXT},`,
      reason: "the fixture's one reviewed entry",
    };
    const stale = `fixture.ts: scanProbeBudget: ${ENVELOPE_LITERAL_TEXT}, is on the reviewed list but no such literal is in the tree; drop the entry`;
    // The budget counts on this side too: two entries at one key with nothing
    // in the tree spending either are two entries to drop, not one.
    expect(findingsAgainst([], [entry])).toEqual([stale]);
    expect(findingsAgainst([], [entry, entry])).toEqual([stale, stale]);
  });

  test("findings from both directions come back sorted, not in the order they are pushed", () => {
    const occurrences = envelopeLiteralsIn(
      "fixture.ts",
      REVIEWED_BUDGET_FIXTURE,
    );
    const unclaimed: ReviewedLiteralSite = {
      file: "fixture.ts",
      declaration: "scanProbeSpare",
      text: `${ENVELOPE_LITERAL_TEXT},`,
      reason: "an entry naming a declaration the fixture does not hold",
    };
    // The unclaimed entry is pushed after both occurrences and comes back
    // ahead of them.
    expect(findingsAgainst(occurrences, [unclaimed])).toEqual([
      `fixture.ts: scanProbeSpare: ${ENVELOPE_LITERAL_TEXT}, is on the reviewed list but no such literal is in the tree; drop the entry`,
      `fixture.ts:2 spells the envelope as a number inside scanProbeBudget; import ${ENVELOPE_NAME} instead, or add a reviewed entry naming that declaration and the reason it is not a second definition`,
      `fixture.ts:3 spells the envelope as a number inside scanProbeBudget; import ${ENVELOPE_NAME} instead, or add a reviewed entry naming that declaration and the reason it is not a second definition`,
    ]);
  });

  test("no shipped module spells the envelope as a bare number off the reviewed list", () => {
    expect(envelopeLiteralFindings(sourceRoot)).toEqual([]);
  });
});
