import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

/**
 * Parent copy follows the worksheet choice, never the profile (D45 in the
 * worksheet-first plan). Each source is handed to the TypeScript parser: its
 * identifiers are compared with the retired Difficulty names, and the text of
 * its string literals and template literals is matched against the phrases a
 * parent must no longer read. Import and export specifiers are skipped.
 */

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const RETIRED_IDENTIFIERS = ["DIFFICULTY_REMEDY", "applyDifficulty", "stretchConfirmed"] as const;

const FORBIDDEN_COPY: readonly RegExp[] = [/\bprofiles?\b/iu, /presentation band/iu, /\bages?\b/iu];

/** The shared worksheet modules whose strings reach a parent. */
const SHARED_COPY_SOURCES = [
  "src/shared/worksheet/registry.ts",
  "src/shared/worksheet/limit-labels.ts",
  "src/shared/worksheet/project-request.ts",
] as const;

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(resolve(frontendRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

function isTestFile(file: string): boolean {
  return /\.test\.tsx?$/u.test(file);
}

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    parent !== undefined &&
    ((ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) ||
      (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node) ||
      (ts.isExternalModuleReference(parent) && parent.expression === node) ||
      (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)))
  );
}

/** Every retired Difficulty identifier the source still names. */
function retiredIdentifiers(file: string, text: string): readonly string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isIdentifier(node) &&
      (RETIRED_IDENTIFIERS as readonly string[]).includes(node.text)
    ) {
      const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
      found.push(`${file}:${line + 1} ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return found;
}

/** Every string or template text in the source that names the profile, its band or age. */
function forbiddenCopy(file: string, text: string): readonly string[] {
  const found: string[] = [];
  const check = (node: ts.Node, value: string): void => {
    if (FORBIDDEN_COPY.some((pattern) => pattern.test(value))) {
      const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
      found.push(`${file}:${line + 1} ${JSON.stringify(value)}`);
    }
  };
  const visit = (node: ts.Node): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isModuleSpecifier(node)) {
      check(node, node.text);
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      check(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return found;
}

function read(file: string): string {
  return readFileSync(resolve(frontendRoot, file), "utf8");
}

describe("parent copy names the worksheet choice, never the profile (D45)", () => {
  test("no retired Difficulty identifier remains anywhere under frontend/src", () => {
    const files = sourceFiles("src");
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap((file) => retiredIdentifiers(file, read(file)))).toEqual([]);
  });

  test("no worksheet family, registry, limit-label or projection string names the profile, its band or age", () => {
    const files = [
      ...sourceFiles("src/worksheets").filter((file) => !isTestFile(file)),
      ...SHARED_COPY_SOURCES,
    ];
    expect(files).toContain("src/worksheets/sentence-builder/definition.ts");
    expect(files.flatMap((file) => forbiddenCopy(file, read(file)))).toEqual([]);
  });

  test("calibration: a synthetic source string containing the old advice fails the scan", () => {
    const planted = [
      'export const advice = "Choose a shorter worksheet or review the profile\'s counting limits.";',
      "export const band = `no prompt for this ${mode} presentation band`;",
      "export const age = `Ages ${low}-${high} only`;",
      'import { review } from "./profile.js";',
      "// review the profile in a comment is not parent copy",
      'export const fine = "Choose a practice focus with a wider counting range.";',
    ].join("\n");
    const hits = forbiddenCopy("planted.ts", planted);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toContain("review the profile");
    expect(forbiddenCopy("planted.ts", 'const text = "review the profile";')).toHaveLength(1);
    expect(forbiddenCopy("planted.ts", 'const text = "the page and its message";')).toEqual([]);
    expect(
      retiredIdentifiers("planted.ts", "const stretchConfirmed = true;\nexport { DIFFICULTY_REMEDY };"),
    ).toEqual(["planted.ts:1 stretchConfirmed", "planted.ts:2 DIFFICULTY_REMEDY"]);
    expect(retiredIdentifiers("planted.ts", 'const text = "stretchConfirmed";')).toEqual([]);
  });

  test("the scan reads a real template literal's text", () => {
    const file = "src/worksheets/find-the-wow/definition.ts";
    const templates: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isTemplateHead(node)) {
        templates.push(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(file, read(file)));
    expect(templates).toContain("This practice focus provides ");
    expect(relative(frontendRoot, resolve(frontendRoot, file)).replaceAll("\\", "/")).toBe(file);
  });
});
