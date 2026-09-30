import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * Import direction of the shared config modules (D30 in the worksheet-first
 * plan). `schema.ts` imports the `enums.ts` and `fields.ts` leaves and the
 * frozen `legacy-v1.ts`; none of those may import `schema.ts` back, or a
 * module cycle could read a binding in its temporal dead zone. Each module is
 * handed to the TypeScript parser and its import and export-from declarations,
 * dynamic imports and import types are read from the syntax tree, never
 * matched as text.
 */

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SCHEMA = "src/shared/config/schema.ts";
const LEGACY_V1 = "src/shared/config/legacy-v1.ts";
const ENUMS = "src/shared/config/enums.ts";
const FIELDS = "src/shared/config/fields.ts";
const NORMALIZE = "src/shared/config/normalize.ts";
const WORKSHEET_TYPES = "src/shared/worksheet/types.ts";

interface ModuleImport {
  /** A frontend-relative `.ts` path for a relative specifier, else the package name. */
  readonly target: string;
  /** False only for an import the compiler erases (`import type`, `export type`, an import type). */
  readonly runtime: boolean;
}

interface ModuleRule {
  readonly file: string;
  /** Targets this module must never import, by any kind of import. */
  readonly forbidden: readonly string[];
  /** The only targets this module may import, by any kind of import. */
  readonly allowed: readonly string[];
}

const RULES: readonly ModuleRule[] = [
  { file: ENUMS, forbidden: [SCHEMA, LEGACY_V1], allowed: [WORKSHEET_TYPES] },
  { file: FIELDS, forbidden: [SCHEMA, LEGACY_V1], allowed: ["zod", NORMALIZE, ENUMS] },
  { file: LEGACY_V1, forbidden: [SCHEMA], allowed: ["zod", NORMALIZE, ENUMS, FIELDS] },
];

function importTarget(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }
  const absolute = resolve(frontendRoot, dirname(file), specifier);
  return relative(frontendRoot, absolute)
    .replaceAll("\\", "/")
    .replace(/\.js$/u, ".ts");
}

/** Every module this source names, read from its syntax tree. */
function moduleImports(file: string, sourceText: string): readonly ModuleImport[] {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: ModuleImport[] = [];
  const add = (specifier: ts.Expression | undefined, runtime: boolean): void => {
    if (specifier !== undefined && ts.isStringLiteralLike(specifier)) {
      found.push({ target: importTarget(file, specifier.text), runtime });
    } else if (specifier !== undefined) {
      // A computed specifier cannot be checked, so it is reported as unknown.
      found.push({ target: "<computed specifier>", runtime });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      // Under verbatimModuleSyntax only `import type` is erased; an import
      // whose every binding is `type` still loads the module.
      add(node.moduleSpecifier, node.importClause?.isTypeOnly !== true);
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, !node.isTypeOnly);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression, !node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      add(node.arguments[0], true);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, false);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function violations(rule: ModuleRule, imports: readonly ModuleImport[]): readonly string[] {
  return imports.flatMap(({ target, runtime }) => {
    const kind = runtime ? "imports" : "type-imports";
    if (rule.forbidden.includes(target)) {
      return [`${rule.file} ${kind} ${target}, which must never be imported from it`];
    }
    if (!rule.allowed.includes(target)) {
      return [`${rule.file} ${kind} ${target}, outside its allowed imports ${rule.allowed.join(", ")}`];
    }
    return [];
  });
}

function readModule(file: string): string {
  return readFileSync(resolve(frontendRoot, file), "utf8");
}

describe("shared config import direction", () => {
  test.each(RULES)("$file imports nothing from schema.ts and only its allowed modules", (rule) => {
    expect(violations(rule, moduleImports(rule.file, readModule(rule.file)))).toEqual([]);
  });

  test("the scan reads real imports: the frozen v1 module names exactly its four sources", () => {
    const targets = moduleImports(LEGACY_V1, readModule(LEGACY_V1)).map(({ target }) => target);
    expect([...new Set(targets)].sort()).toEqual([ENUMS, FIELDS, NORMALIZE, "zod"].sort());
  });

  test("schema.ts builds on the leaves rather than the reverse", () => {
    const targets = moduleImports(SCHEMA, readModule(SCHEMA)).map(({ target }) => target);
    expect(targets).toContain(LEGACY_V1);
    expect(targets).toContain(ENUMS);
  });

  test("calibration: a value import from schema.ts fails the rule", () => {
    const [enumsRule, fieldsRule, legacyRule] = RULES;
    const valueImport = 'import { APP_CONFIG_SCHEMA_VERSION } from "./schema.js";\n';
    for (const rule of [enumsRule!, fieldsRule!, legacyRule!]) {
      const imports = moduleImports(rule.file, valueImport);
      expect(imports).toEqual([{ target: SCHEMA, runtime: true }]);
      expect(violations(rule, imports)).toHaveLength(1);
    }
    const typeOnly = 'import type { AppConfigV1 } from "./schema.js";\nexport type Alias = import("./schema.js").WritingMode;\n';
    expect(moduleImports(LEGACY_V1, typeOnly)).toEqual([
      { target: SCHEMA, runtime: false },
      { target: SCHEMA, runtime: false },
    ]);
    expect(violations(legacyRule!, moduleImports(LEGACY_V1, typeOnly))).toHaveLength(2);
    const reExport = 'export { WRITING_MODES } from "./schema.js";\n';
    expect(violations(fieldsRule!, moduleImports(FIELDS, reExport))).toHaveLength(1);
    const outsideAllowed = 'import { normalizeProfileText } from "./normalize.js";\n';
    expect(violations(enumsRule!, moduleImports(ENUMS, outsideAllowed))).toHaveLength(1);
    const allowedTopicImport = 'import { TOPIC_IDS } from "../worksheet/types.js";\n';
    expect(violations(enumsRule!, moduleImports(ENUMS, allowedTopicImport))).toEqual([]);
  });
});
