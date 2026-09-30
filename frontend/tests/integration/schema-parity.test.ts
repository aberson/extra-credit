import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Fastify, { type FastifyInstance } from "fastify";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { z } from "zod";

import {
  APP_CONFIG_TRANSPORT_SCHEMA,
  PUBLIC_ERROR_CODES,
  zodIntegerBounds,
} from "../../src/server/transport-schemas.js";
import { emptyAppConfigV2 } from "../../src/shared/config/defaults.js";
import {
  FIND_THE_WOW_VARIANTS,
  MATH_OPERATIONS,
  PAPER_SIZES,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  REPRESENTATIONS,
  SENTENCE_VOCABULARY_OPTIONS,
  THEME_CHOICES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "../../src/shared/config/enums.js";
import { expandMathPreset } from "../../src/shared/config/math-presets.js";
import {
  AppConfigV1Schema,
  AppConfigV2Schema,
  MathSkillsV1Schema,
  type AppConfigV2,
} from "../../src/shared/config/schema.js";
import {
  DRY_MATH_NUMERIC_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
  WORKSHEET_TYPE_IDS,
} from "../../src/shared/worksheet/types.js";
import {
  transportKeyPaths,
  transportNodeAt,
  valueAt,
  withValueAt,
} from "../fixtures/config-shape.js";

/*
 * The version 2 transport schema is COMPOSED from the Zod sources (DD6). This
 * file proves the two layers classify every accepted key and value alike:
 * one parity row per key path the transport schema declares, every enum
 * member and one non-member, every integer bound at min-1/min/max/max+1, and
 * `ageYears`, `difficulty` and an unknown key refused at every object level.
 * Where Zod is deliberately the only authority (text normalization and
 * bounds, calendar dates, canonical order, uniqueness ignoring case, unique
 * ids), a probe names the divergence explicitly instead of hiding it.
 */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function validConfig(): AppConfigV2 {
  return {
    ...emptyAppConfigV2(),
    profiles: [
      {
        id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
        displayName: "Fictional Kit",
        reviewedOn: "2026-08-22",
        interests: ["space", "trains"],
        legacyChoices: {
          presentationBand: "early-primary",
          writingMode: "sentence-frame",
          mathSkills: {
            countingMax: 20,
            numeralMax: 20,
            compareMax: 20,
            representations: ["quantities", "equations"],
            understandsEquality: true,
            operations: ["addition", "subtraction"],
            operandMax: 10,
            resultMax: 10,
            allowRegrouping: false,
            allowNegativeResults: false,
          },
        },
      },
    ],
  };
}

type Expected = boolean | { readonly zod: boolean; readonly transport: boolean };

interface Probe {
  readonly label: string;
  /** The value to write at the row's path, from the value already there. */
  readonly value: (current: unknown) => unknown;
  /** Omitted: both layers must simply agree. */
  readonly expected?: Expected;
}

interface ParityRow {
  readonly probes: readonly Probe[];
  /** For an enum path: the one `as const` array both layers are built from. */
  readonly members?: readonly unknown[];
  /** For an array's item path: probe the whole array, so one item stands alone. */
  readonly wholeArray?: boolean;
}

const probe = (label: string, value: unknown, expected?: Expected): Probe => ({
  label,
  value: () => value,
  ...(expected === undefined ? {} : { expected }),
});

function objectRow(extra: readonly Probe[] = []): ParityRow {
  const added = (key: string, value: unknown): Probe => ({
    label: `with ${key}`,
    value: (current) => ({ ...(current as object), [key]: value }),
    expected: false,
  });
  return {
    probes: [
      { label: "unchanged", value: (current) => current, expected: true },
      added("ageYears", 6),
      added("difficulty", "practice"),
      added("syntheticUnknownKey", "fixture"),
      probe("an array instead", [], false),
      ...extra,
    ],
  };
}

function enumRow(members: readonly unknown[]): ParityRow {
  return {
    members,
    probes: [
      ...members.map((member) => probe(`member ${JSON.stringify(member)}`, member, true)),
      probe("a non-member", "synthetic-non-member", false),
      probe("a number", 1, false),
    ],
  };
}

/** The items of an enum-valued array, probed as one-element arrays. */
function enumItemsRow(members: readonly unknown[]): ParityRow {
  return {
    members,
    wholeArray: true,
    probes: [
      ...members.map((member) => probe(`[${JSON.stringify(member)}]`, [member], true)),
      probe("[a non-member]", ["synthetic-non-member"], false),
    ],
  };
}

function integerRow(
  minimum: number,
  maximum: number,
  options: { readonly crossFieldMinimum?: boolean } = {},
): ParityRow {
  return {
    probes: [
      probe(`min-1 (${minimum - 1})`, minimum - 1, false),
      // A cross-field minimum is refused by both layers' shared rule, so only
      // agreement is required there.
      probe(`min (${minimum})`, minimum, options.crossFieldMinimum === true ? undefined : true),
      probe(`max (${maximum})`, maximum, true),
      probe(`max+1 (${maximum + 1})`, maximum + 1, false),
      probe("a fraction", minimum + 0.5, false),
      probe("a numeric string", String(maximum), false),
    ],
  };
}

const booleanRow: ParityRow = {
  probes: [
    probe("true", true, true),
    probe("false", false, true),
    probe("the string true", "true", false),
    probe("1", 1, false),
  ],
};

const OPERATION_ARRAY_PROBES: readonly Probe[] = [
  probe("both operations", ["addition", "subtraction"], true),
  probe("three entries", ["addition", "subtraction", "addition"], false),
  probe("a duplicate", ["addition", "addition"], false),
  probe("reversed order", ["subtraction", "addition"], { zod: false, transport: true }),
];

const QUANTITY_BOUNDS = integerRow(1, V1_NUMERIC_MAXIMUM);

/** The legacy integer fields, whose bounds only the frozen v1 schema writes. */
const LEGACY_INTEGER_FIELDS = [
  "countingMax",
  "numeralMax",
  "compareMax",
  "operandMax",
  "resultMax",
] as const;

/** A frozen v1 field's bounds exactly as Zod reports them from the field. */
function frozenBounds(field: (typeof LEGACY_INTEGER_FIELDS)[number]): {
  readonly minimum: number;
  readonly maximum: number;
} {
  const { minValue, maxValue } = MathSkillsV1Schema.shape[field];
  if (minValue === null || maxValue === null) {
    throw new Error(`The frozen v1 ${field} field declares no bound.`);
  }
  return { minimum: minValue, maximum: maxValue };
}

const legacyRow = (field: (typeof LEGACY_INTEGER_FIELDS)[number]): ParityRow => {
  const { minimum, maximum } = frozenBounds(field);
  // operandMax/resultMax at 0 are refused by the shared cross-field rule
  // while operations are present, so only agreement is required there.
  return integerRow(minimum, maximum, { crossFieldMinimum: minimum === 0 });
};

const text = (length: number): string => "界".repeat(length);

const PARITY_ROWS: Readonly<Record<string, ParityRow>> = {
  $: objectRow(),
  "$.schemaVersion": {
    probes: [
      probe("2", 2, true),
      probe("1", 1, false),
      probe("3", 3, false),
      probe("the string 2", "2", false),
    ],
  },
  "$.defaults": objectRow([probe("missing", undefined, false)]),
  "$.defaults.worksheetType": enumRow(WORKSHEET_TYPE_IDS),
  "$.defaults.dryMath": objectRow(),
  "$.defaults.dryMath.operations": { probes: [...OPERATION_ARRAY_PROBES, probe("empty", [], false)] },
  "$.defaults.dryMath.operations[]": enumItemsRow(MATH_OPERATIONS),
  "$.defaults.dryMath.operandMax": integerRow(1, DRY_MATH_NUMERIC_MAXIMUM),
  "$.defaults.dryMath.resultMax": integerRow(1, DRY_MATH_NUMERIC_MAXIMUM),
  "$.defaults.findTheWow": objectRow(),
  "$.defaults.findTheWow.variant": enumRow(FIND_THE_WOW_VARIANTS),
  "$.defaults.findTheWow.quantity": objectRow(),
  "$.defaults.findTheWow.quantity.countingMax": QUANTITY_BOUNDS,
  "$.defaults.findTheWow.quantity.numeralMax": QUANTITY_BOUNDS,
  "$.defaults.findTheWow.equation": objectRow(),
  "$.defaults.findTheWow.equation.operations": { probes: [...OPERATION_ARRAY_PROBES, probe("empty", [], false)] },
  "$.defaults.findTheWow.equation.operations[]": enumItemsRow(MATH_OPERATIONS),
  "$.defaults.findTheWow.equation.operandMax": QUANTITY_BOUNDS,
  "$.defaults.findTheWow.equation.resultMax": QUANTITY_BOUNDS,
  "$.defaults.sentenceBuilder": objectRow(),
  "$.defaults.sentenceBuilder.variant": enumRow(WRITING_MODES),
  "$.defaults.sentenceBuilder.vocabulary": enumRow(SENTENCE_VOCABULARY_OPTIONS),
  "$.defaults.countCompareMake": objectRow(),
  "$.defaults.countCompareMake.countingMax": QUANTITY_BOUNDS,
  "$.defaults.countCompareMake.numeralMax": QUANTITY_BOUNDS,
  "$.defaults.countCompareMake.compareMax": QUANTITY_BOUNDS,
  "$.defaults.theme": enumRow(THEME_CHOICES),
  "$.defaults.useDisplayName": booleanRow,
  "$.defaults.useInterests": booleanRow,
  "$.defaults.includeDecorativeGraphics": booleanRow,
  "$.defaults.includeAnswerKey": booleanRow,
  "$.defaults.useEarlierChildSettings": booleanRow,
  "$.defaults.length": enumRow(WORKSHEET_LENGTHS),
  "$.defaults.paperSize": enumRow(PAPER_SIZES),
  "$.defaults.printScale": enumRow(PRINT_SCALES),
  "$.profiles": {
    probes: [
      probe("empty", [], true),
      probe("an object instead", {}, false),
      {
        label: "a duplicate id",
        value: (current) => [...(current as unknown[]), ...(current as unknown[])],
        expected: { zod: false, transport: true },
      },
    ],
  },
  "$.profiles[]": objectRow([
    probe("identity only", { id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940", reviewedOn: "2026-08-22", interests: [] }, true),
  ]),
  "$.profiles[].id": {
    probes: [
      probe("a lowercase UUID v4", "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", true),
      probe("uppercase hex", "0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D", false),
      probe("a UUID v1", "0a1b2c3d-4e5f-1a6b-8c7d-9e0f1a2b3c4d", false),
      probe("a number", 7, false),
    ],
  },
  "$.profiles[].displayName": {
    probes: [
      probe("absent", undefined, true),
      probe("padded to 40 code points", `  ${text(40)}  `, true),
      probe("41 code points", text(41), { zod: false, transport: true }),
      probe("only spaces", "   ", { zod: false, transport: true }),
      probe("a number", 5, false),
    ],
  },
  "$.profiles[].reviewedOn": {
    probes: [
      probe("a leap day", "2028-02-29", true),
      probe("an impossible calendar date", "2026-02-30", { zod: false, transport: true }),
      probe("a short month", "2026-8-22", false),
      probe("a number", 20_260_822, false),
    ],
  },
  "$.profiles[].interests": {
    probes: [
      probe("five interests", ["a", "b", "c", "d", "e"], true),
      probe("six interests", ["a", "b", "c", "d", "e", "f"], false),
      probe("unique only ignoring case", ["Space", "space"], { zod: false, transport: true }),
    ],
  },
  "$.profiles[].interests[]": {
    wholeArray: true,
    probes: [
      probe("32 code points", [text(32)], true),
      probe("33 code points", [text(33)], { zod: false, transport: true }),
      probe("a number", [5], false),
    ],
  },
  "$.profiles[].legacyChoices": objectRow([probe("absent", undefined, true)]),
  "$.profiles[].legacyChoices.presentationBand": enumRow(PRESENTATION_BANDS),
  "$.profiles[].legacyChoices.writingMode": enumRow(WRITING_MODES),
  "$.profiles[].legacyChoices.mathSkills": objectRow([
    {
      label: "limits without operations",
      value: (current) => ({ ...(current as object), operations: [] }),
      expected: false,
    },
    {
      label: "zero limits without operations",
      value: (current) => ({ ...(current as object), operations: [], operandMax: 0, resultMax: 0 }),
      expected: true,
    },
  ]),
  "$.profiles[].legacyChoices.mathSkills.countingMax": legacyRow("countingMax"),
  "$.profiles[].legacyChoices.mathSkills.numeralMax": legacyRow("numeralMax"),
  "$.profiles[].legacyChoices.mathSkills.compareMax": legacyRow("compareMax"),
  "$.profiles[].legacyChoices.mathSkills.representations": {
    probes: [
      probe("both", ["quantities", "equations"], true),
      probe("empty", [], false),
      probe("a duplicate", ["quantities", "quantities"], false),
      probe("reversed order", ["equations", "quantities"], { zod: false, transport: true }),
    ],
  },
  "$.profiles[].legacyChoices.mathSkills.representations[]": enumItemsRow(REPRESENTATIONS),
  "$.profiles[].legacyChoices.mathSkills.understandsEquality": booleanRow,
  "$.profiles[].legacyChoices.mathSkills.operations": {
    probes: [...OPERATION_ARRAY_PROBES],
  },
  "$.profiles[].legacyChoices.mathSkills.operations[]": enumItemsRow(MATH_OPERATIONS),
  "$.profiles[].legacyChoices.mathSkills.operandMax": legacyRow("operandMax"),
  "$.profiles[].legacyChoices.mathSkills.resultMax": legacyRow("resultMax"),
  "$.profiles[].legacyChoices.mathSkills.allowRegrouping": booleanRow,
  "$.profiles[].legacyChoices.mathSkills.allowNegativeResults": booleanRow,
};

let transport: FastifyInstance;

beforeAll(async () => {
  transport = Fastify({
    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false,
        useDefaults: false,
      },
    },
  });
  transport.post("/", { schema: { body: APP_CONFIG_TRANSPORT_SCHEMA } }, async () => ({}));
  await transport.ready();
});

afterAll(async () => {
  await transport.close();
});

async function transportAccepts(body: unknown): Promise<boolean> {
  const response = await transport.inject({
    method: "POST",
    url: "/",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(body),
  });
  return response.statusCode === 200;
}

function zodAccepts(body: unknown): boolean {
  return AppConfigV2Schema.safeParse(body).success;
}

/** The row identity check: an enum path's transport node IS the Zod source array. */
function enumIdentityHolds(schema: unknown, path: string, row: ParityRow): boolean {
  return row.members === undefined || transportNodeAt(schema, path).enum === row.members;
}

/** Every numeric literal written in a TypeScript source, read from its syntax tree. */
function numericLiterals(fileName: string, sourceText: string): readonly number[] {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, kind);
  const found: number[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isNumericLiteral(node)) {
      found.push(Number(node.text.replaceAll("_", "")));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("AppConfigV2 schema and composed transport parity", () => {
  test("the valid base is accepted by both layers", async () => {
    expect(zodAccepts(validConfig())).toBe(true);
    expect(await transportAccepts(validConfig())).toBe(true);
  });

  test("every key path the transport schema declares has exactly one parity row", () => {
    expect(Object.keys(PARITY_ROWS).sort()).toEqual([...transportKeyPaths(APP_CONFIG_TRANSPORT_SCHEMA)]);
  });

  test.each(Object.keys(PARITY_ROWS).sort())("%s: both layers classify every probe alike", async (path) => {
    const row = PARITY_ROWS[path]!;
    // One source of truth: the transport enum IS the Zod source array.
    expect(enumIdentityHolds(APP_CONFIG_TRANSPORT_SCHEMA, path, row), path).toBe(true);
    const base = validConfig();
    const target = row.wholeArray === true ? path.slice(0, -"[]".length) : path;
    const current = valueAt(base, target);
    for (const { label, value, expected } of row.probes) {
      const candidate = withValueAt(base, target, value(current));
      const verdict = { zod: zodAccepts(candidate), transport: await transportAccepts(candidate) };
      const where = `${path} ${label}`;
      if (expected === undefined) {
        expect(verdict.transport, where).toBe(verdict.zod);
      } else if (typeof expected === "boolean") {
        expect(verdict, where).toEqual({ zod: expected, transport: expected });
      } else {
        expect(verdict, where).toEqual(expected);
      }
    }
  });

  test("calibration: the row identity check rejects exactly the one enum restated as a copy", () => {
    // Every enum node is copied, then every one but $.defaults.theme is
    // pointed back at its Zod source array: the restated schema is equal
    // value for value, so no behavioral probe can tell it apart.
    const restated = structuredClone(APP_CONFIG_TRANSPORT_SCHEMA);
    const enumPaths: string[] = [];
    for (const path of Object.keys(PARITY_ROWS).sort()) {
      const members = PARITY_ROWS[path]!.members;
      if (members === undefined) continue;
      enumPaths.push(path);
      if (path !== "$.defaults.theme") {
        (transportNodeAt(restated, path) as { enum?: readonly unknown[] }).enum = members;
      }
    }
    expect(restated).toEqual(APP_CONFIG_TRANSPORT_SCHEMA);
    expect(enumPaths.length).toBeGreaterThan(1);
    expect(enumPaths.filter((path) => !enumIdentityHolds(restated, path, PARITY_ROWS[path]!))).toEqual([
      "$.defaults.theme",
    ]);
  });

  test("the legacy mathSkills transport bounds are the frozen v1 fields' own bounds", () => {
    for (const field of LEGACY_INTEGER_FIELDS) {
      const node = transportNodeAt(APP_CONFIG_TRANSPORT_SCHEMA, `$.profiles[].legacyChoices.mathSkills.${field}`);
      expect({ minimum: node.minimum, maximum: node.maximum }, field).toEqual(frozenBounds(field));
    }
  });

  test("calibration: the bound reader follows the field and refuses an unbounded one", () => {
    expect(zodIntegerBounds(z.number().int().min(3).max(997))).toEqual({
      type: "integer",
      minimum: 3,
      maximum: 997,
    });
    expect(() => zodIntegerBounds(z.number().int().max(997))).toThrow();
    expect(() => zodIntegerBounds(z.number().int().min(3))).toThrow();
    expect(() => zodIntegerBounds(z.number().min(3).max(997))).toThrow();
  });

  test.each([
    "frontend/src/server/transport-schemas.ts",
    "frontend/src/web/profiles/MathSkillsEditor.tsx",
  ])("%s never restates a frozen legacy ceiling as a literal", async (relativePath) => {
    const ceilings = new Set(LEGACY_INTEGER_FIELDS.map((field) => frozenBounds(field).maximum));
    const file = resolve(repositoryRoot, relativePath);
    const restated = numericLiterals(file, await readFile(file, "utf8")).filter((value) => ceilings.has(value));
    expect(restated).toEqual([]);

    // Calibration: the same scan finds a ceiling restated in either spelling
    // (plain digits, and with numeric separators as `1_000`).
    const [ceiling] = [...ceilings] as [number];
    const separated = ceiling.toLocaleString("en-US").replaceAll(",", "_");
    expect(separated).toContain("_");
    const planted = [
      `const LEGACY_MATH_MAXIMUM = ${String(ceiling)};`,
      `const node = <input max={${separated}} />;`,
    ].join("\n");
    expect(numericLiterals("planted.tsx", planted).filter((value) => ceilings.has(value))).toEqual([ceiling, ceiling]);
  });

  test("pins the complete public machine-code set at 20, without the retired age code", () => {
    expect(PUBLIC_ERROR_CODES).toEqual([
      "HOST_REJECTED",
      "ORIGIN_REJECTED",
      "CROSS_SITE_REJECTED",
      "SESSION_TOKEN_INVALID",
      "CONFIG_NOT_FOUND",
      "CONFIG_INVALID",
      "CONFIG_VERSION_UNSUPPORTED",
      "CONFIG_TOO_LARGE",
      "CONFIG_UNSAFE_FILE",
      "CONFIG_SERIALIZED_TOO_LARGE",
      "CONFIG_CONFLICT",
      "CONFIG_PRECONDITION_REQUIRED",
      "CONFIG_RECOVERY_NOT_ALLOWED",
      "CONFIG_IO_ERROR",
      "INVALID_JSON",
      "BODY_TOO_LARGE",
      "CONTENT_TYPE_REQUIRED",
      "VALIDATION_FAILED",
      "GENERATION_CONSTRAINT_CONFLICT",
      "GENERATION_INVARIANT_FAILED",
    ]);
    expect(PUBLIC_ERROR_CODES).toHaveLength(20);
    expect(PUBLIC_ERROR_CODES as readonly string[]).not.toContain("GENERATION_AGE_UNSUPPORTED");
  });

  test("keeps transport transform-free and Zod authoritative", async () => {
    const stringLimit = structuredClone(validConfig()) as unknown as {
      defaults: { countCompareMake: { countingMax: unknown } };
    };
    stringLimit.defaults.countCompareMake.countingMax = "6";
    expect(await transportAccepts(stringLimit)).toBe(false);
    expect(zodAccepts(stringLimit)).toBe(false);

    const trimmed = validConfig();
    trimmed.profiles[0]!.displayName = "  Morgan  ";
    trimmed.profiles[0]!.interests = ["  Nature  "];
    const parsed = AppConfigV2Schema.parse(trimmed);
    expect(parsed.profiles[0]!.displayName).toBe("Morgan");
    expect(parsed.profiles[0]!.interests).toEqual(["Nature"]);
  });
});

describe("the frozen version 1 read path", () => {
  test("parses the committed fictional example and pins exact presets", async () => {
    const example = JSON.parse(
      await readFile(resolve(repositoryRoot, "config/children.example.json"), "utf8"),
    ) as unknown;
    const parsed = AppConfigV1Schema.parse(example);
    expect(parsed.profiles).toEqual([
      {
        id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
        displayName: "Riley",
        ageYears: 4,
        presentationBand: "preschool",
        reviewedOn: "2026-08-22",
        mathSkills: {
          countingMax: 10,
          numeralMax: 10,
          compareMax: 10,
          representations: ["quantities"],
          understandsEquality: false,
          operations: [],
          operandMax: 0,
          resultMax: 0,
          allowRegrouping: false,
          allowNegativeResults: false,
        },
        writingMode: "label",
        interests: ["animals", "space"],
      },
      {
        id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
        displayName: "Morgan",
        ageYears: 6,
        presentationBand: "early-primary",
        reviewedOn: "2026-08-22",
        mathSkills: {
          countingMax: 20,
          numeralMax: 20,
          compareMax: 20,
          representations: ["quantities", "equations"],
          understandsEquality: true,
          operations: ["addition", "subtraction"],
          operandMax: 10,
          resultMax: 10,
          allowRegrouping: false,
          allowNegativeResults: false,
        },
        writingMode: "sentence-frame",
        interests: ["nature", "vehicles"],
      },
      {
        id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
        displayName: "Avery",
        ageYears: 8,
        presentationBand: "early-primary",
        reviewedOn: "2026-08-22",
        mathSkills: {
          countingMax: 20,
          numeralMax: 20,
          compareMax: 20,
          representations: ["quantities", "equations"],
          understandsEquality: true,
          operations: ["addition", "subtraction"],
          operandMax: 20,
          resultMax: 20,
          allowRegrouping: false,
          allowNegativeResults: false,
        },
        writingMode: "independent",
        interests: ["sports", "nature"],
      },
    ]);
    expect(parsed.defaults).toEqual({
      useDisplayName: true,
      useInterests: true,
      includeDecorativeGraphics: true,
      difficulty: "practice",
      length: "standard",
      includeAnswerKey: true,
      paperSize: "letter",
      printScale: "standard",
    });

    expect(expandMathPreset("quantities-to-10")).toEqual({
      presentationBand: "preschool",
      mathSkills: {
        countingMax: 10,
        numeralMax: 10,
        compareMax: 10,
        representations: ["quantities"],
        understandsEquality: false,
        operations: [],
        operandMax: 0,
        resultMax: 0,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
    });
    expect(
      expandMathPreset("emerging-equations-within-5", "preschool"),
    ).toEqual({
      presentationBand: "preschool",
      mathSkills: {
        countingMax: 10,
        numeralMax: 10,
        compareMax: 10,
        representations: ["quantities", "equations"],
        understandsEquality: false,
        operations: ["addition"],
        operandMax: 5,
        resultMax: 5,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
    });
    expect(expandMathPreset("early-primary-within-10")).toEqual({
      presentationBand: "early-primary",
      mathSkills: {
        countingMax: 20,
        numeralMax: 20,
        compareMax: 20,
        representations: ["quantities", "equations"],
        understandsEquality: true,
        operations: ["addition", "subtraction"],
        operandMax: 10,
        resultMax: 10,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
    });
    expect(expandMathPreset("early-primary-within-20")).toEqual({
      presentationBand: "early-primary",
      mathSkills: {
        countingMax: 20,
        numeralMax: 20,
        compareMax: 20,
        representations: ["quantities", "equations"],
        understandsEquality: true,
        operations: ["addition", "subtraction"],
        operandMax: 20,
        resultMax: 20,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
    });
  });

  test("the frozen v1 schema refuses a version 2 body, and the v2 schema a version 1 body", async () => {
    const v2 = validConfig();
    expect(AppConfigV1Schema.safeParse(v2).success).toBe(false);
    const example = JSON.parse(
      await readFile(resolve(repositoryRoot, "config/children.example.json"), "utf8"),
    ) as unknown;
    expect(zodAccepts(example)).toBe(false);
    expect(await transportAccepts(example)).toBe(false);
  });
});
