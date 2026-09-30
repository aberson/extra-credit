import { describe, expect, test } from "vitest";

import * as enums from "./enums.js";
import {
  ISO_DATE_PATTERN,
  UUID_V4_PATTERN,
  isIsoCalendarDate,
  normalizedBoundedText,
} from "./fields.js";
import * as legacy from "./legacy-v1.js";
import * as schema from "./schema.js";

/**
 * The frozen Version 1 read path, pinned as the 5c22159 literals below. A
 * shared value list or a v1 schema that later widens fails these comparisons
 * instead of silently changing what a `schemaVersion: 1` file may contain.
 */

const FROZEN_V1_KEYS = {
  config: ["schemaVersion", "profiles", "defaults"],
  profile: [
    "id",
    "displayName",
    "ageYears",
    "presentationBand",
    "reviewedOn",
    "mathSkills",
    "writingMode",
    "interests",
  ],
  mathSkills: [
    "countingMax",
    "numeralMax",
    "compareMax",
    "representations",
    "understandsEquality",
    "operations",
    "operandMax",
    "resultMax",
    "allowRegrouping",
    "allowNegativeResults",
  ],
  defaults: [
    "useDisplayName",
    "useInterests",
    "includeDecorativeGraphics",
    "difficulty",
    "length",
    "includeAnswerKey",
    "paperSize",
    "printScale",
  ],
} as const;

const FROZEN_V1_MEMBERS = {
  presentationBands: ["preschool", "early-primary"],
  representations: ["quantities", "equations"],
  mathOperations: ["addition", "subtraction"],
  writingModes: [
    "draw-and-tell",
    "label",
    "copy-with-model",
    "sentence-frame",
    "independent",
  ],
  difficulties: ["confidence", "practice", "stretch"],
  worksheetLengths: ["short", "standard", "long"],
  paperSizes: ["letter", "a4"],
  printScales: ["standard", "large"],
} as const;

/** The one comparison every pin below uses, so the calibration exercises it. */
function expectFrozen(
  label: string,
  actual: readonly unknown[],
  frozen: readonly unknown[],
): void {
  expect([...actual], label).toEqual([...frozen]);
}

const configShape = legacy.AppConfigV1Schema.shape;
const profileShape = legacy.ChildProfileV1Schema.shape;
const mathShape = legacy.MathSkillsV1Schema.shape;
const defaultsShape = legacy.GenerationDefaultsV1Schema.shape;

describe("schema.ts re-exports keep one source of truth", () => {
  test.each([
    ["PRESENTATION_BANDS", schema.PRESENTATION_BANDS, enums.PRESENTATION_BANDS],
    ["REPRESENTATIONS", schema.REPRESENTATIONS, enums.REPRESENTATIONS],
    ["MATH_OPERATIONS", schema.MATH_OPERATIONS, enums.MATH_OPERATIONS],
    ["WRITING_MODES", schema.WRITING_MODES, enums.WRITING_MODES],
    ["WORKSHEET_LENGTHS", schema.WORKSHEET_LENGTHS, enums.WORKSHEET_LENGTHS],
    ["PAPER_SIZES", schema.PAPER_SIZES, enums.PAPER_SIZES],
    ["PRINT_SCALES", schema.PRINT_SCALES, enums.PRINT_SCALES],
    ["DIFFICULTIES", schema.DIFFICULTIES, legacy.DIFFICULTIES],
    ["MathSkillsV1Schema", schema.MathSkillsV1Schema, legacy.MathSkillsV1Schema],
    ["ChildProfileV1Schema", schema.ChildProfileV1Schema, legacy.ChildProfileV1Schema],
    [
      "GenerationDefaultsV1Schema",
      schema.GenerationDefaultsV1Schema,
      legacy.GenerationDefaultsV1Schema,
    ],
    ["AppConfigV1Schema", schema.AppConfigV1Schema, legacy.AppConfigV1Schema],
  ] as const)("%s is the moved export itself", (_name, reExported, moved) => {
    expect(reExported).toBe(moved);
  });

  test("the field helpers stay unexported from schema.ts", () => {
    const schemaExports = Object.keys(schema);
    for (const name of [
      "UUID_V4_PATTERN",
      "ISO_DATE_PATTERN",
      "isIsoCalendarDate",
      "normalizedBoundedText",
    ]) {
      expect(schemaExports, name).not.toContain(name);
    }
  });

  test("the field helpers behave as they did inside schema.ts", () => {
    expect(UUID_V4_PATTERN.test("22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(UUID_V4_PATTERN.test("2222222A-2222-4222-8222-222222222222")).toBe(false);
    expect(ISO_DATE_PATTERN.test("2026-02-30")).toBe(true);
    expect(isIsoCalendarDate("2026-02-30")).toBe(false);
    expect(isIsoCalendarDate("2028-02-29")).toBe(true);
    expect(normalizedBoundedText(3).parse("  abc  ")).toBe("abc");
    expect(normalizedBoundedText(3).safeParse("abcd").success).toBe(false);
    expect(normalizedBoundedText(3).safeParse("   ").success).toBe(false);
  });
});

describe("the frozen v1 read path keeps its 5c22159 shape", () => {
  test("APP_CONFIG_SCHEMA_VERSION is 2 while the frozen v1 schema still accepts only 1", () => {
    expect(schema.APP_CONFIG_SCHEMA_VERSION).toBe(2);
    expectFrozen("schemaVersion literal", [...configShape.schemaVersion.values], [1]);
  });

  test("every object level keeps its key set", () => {
    expectFrozen("config keys", Object.keys(configShape), FROZEN_V1_KEYS.config);
    expect(configShape.profiles.element).toBe(legacy.ChildProfileV1Schema);
    expect(configShape.defaults).toBe(legacy.GenerationDefaultsV1Schema);
    expectFrozen("profile keys", Object.keys(profileShape), FROZEN_V1_KEYS.profile);
    expect(profileShape.mathSkills).toBe(legacy.MathSkillsV1Schema);
    expectFrozen("mathSkills keys", Object.keys(mathShape), FROZEN_V1_KEYS.mathSkills);
    expectFrozen("defaults keys", Object.keys(defaultsShape), FROZEN_V1_KEYS.defaults);
  });

  test("the shared value lists keep their members", () => {
    expectFrozen("PRESENTATION_BANDS", enums.PRESENTATION_BANDS, FROZEN_V1_MEMBERS.presentationBands);
    expectFrozen("REPRESENTATIONS", enums.REPRESENTATIONS, FROZEN_V1_MEMBERS.representations);
    expectFrozen("MATH_OPERATIONS", enums.MATH_OPERATIONS, FROZEN_V1_MEMBERS.mathOperations);
    expectFrozen("WRITING_MODES", enums.WRITING_MODES, FROZEN_V1_MEMBERS.writingModes);
    expectFrozen("DIFFICULTIES", legacy.DIFFICULTIES, FROZEN_V1_MEMBERS.difficulties);
    expectFrozen("WORKSHEET_LENGTHS", enums.WORKSHEET_LENGTHS, FROZEN_V1_MEMBERS.worksheetLengths);
    expectFrozen("PAPER_SIZES", enums.PAPER_SIZES, FROZEN_V1_MEMBERS.paperSizes);
    expectFrozen("PRINT_SCALES", enums.PRINT_SCALES, FROZEN_V1_MEMBERS.printScales);
  });

  test("the v1 schemas accept exactly those members", () => {
    expectFrozen("presentationBand", profileShape.presentationBand.options, FROZEN_V1_MEMBERS.presentationBands);
    expectFrozen("writingMode", profileShape.writingMode.options, FROZEN_V1_MEMBERS.writingModes);
    expectFrozen("representations", mathShape.representations.element.options, FROZEN_V1_MEMBERS.representations);
    expectFrozen("operations", mathShape.operations.element.options, FROZEN_V1_MEMBERS.mathOperations);
    expectFrozen("difficulty", defaultsShape.difficulty.options, FROZEN_V1_MEMBERS.difficulties);
    expectFrozen("length", defaultsShape.length.options, FROZEN_V1_MEMBERS.worksheetLengths);
    expectFrozen("paperSize", defaultsShape.paperSize.options, FROZEN_V1_MEMBERS.paperSizes);
    expectFrozen("printScale", defaultsShape.printScale.options, FROZEN_V1_MEMBERS.printScales);
  });

  test("calibration: one extra member or key fails the same comparison", () => {
    expect(() =>
      expectFrozen(
        "synthetic widened list",
        [...enums.WRITING_MODES, "synthetic-extra-mode"],
        FROZEN_V1_MEMBERS.writingModes,
      ),
    ).toThrow();
    expect(() =>
      expectFrozen(
        "synthetic widened keys",
        [...Object.keys(defaultsShape), "syntheticExtraKey"],
        FROZEN_V1_KEYS.defaults,
      ),
    ).toThrow();
  });
});
