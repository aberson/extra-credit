/**
 * The frozen Version 1 config read path. These schemas describe exactly what a
 * `schemaVersion: 1` file may contain, so they never widen: a later change to
 * the current schema lands beside this module, not in it. It imports only
 * `zod`, `normalize.ts` and the `enums.ts` and `fields.ts` leaves, never
 * `schema.ts`, which re-exports these names;
 * `tests/integration/config-module-graph.test.ts` enforces the direction and
 * `legacy-v1.test.ts` pins the key sets and member lists.
 */
import { z } from "zod";

import {
  MATH_OPERATIONS,
  PAPER_SIZES,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  REPRESENTATIONS,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "./enums.js";
import {
  UUID_V4_PATTERN,
  isIsoCalendarDate,
  normalizedBoundedText,
} from "./fields.js";
import {
  hasUniqueNormalizedInterests,
  isCanonicalOrderedSubset,
} from "./normalize.js";

export const DIFFICULTIES = ["confidence", "practice", "stretch"] as const;

export const MathSkillsV1Schema = z
  .strictObject({
    countingMax: z.number().int().min(1).max(1_000),
    numeralMax: z.number().int().min(1).max(1_000),
    compareMax: z.number().int().min(1).max(1_000),
    representations: z
      .array(z.enum(REPRESENTATIONS))
      .min(1)
      .max(REPRESENTATIONS.length)
      .refine(
        (values) => isCanonicalOrderedSubset(values, REPRESENTATIONS),
        "Representations must be unique and use canonical order.",
      ),
    understandsEquality: z.boolean(),
    operations: z
      .array(z.enum(MATH_OPERATIONS))
      .max(MATH_OPERATIONS.length)
      .refine(
        (values) => isCanonicalOrderedSubset(values, MATH_OPERATIONS),
        "Operations must be unique and use canonical order.",
      ),
    operandMax: z.number().int().min(0).max(1_000),
    resultMax: z.number().int().min(0).max(1_000),
    allowRegrouping: z.boolean(),
    allowNegativeResults: z.boolean(),
  })
  .superRefine((skills, context) => {
    const hasOperations = skills.operations.length > 0;
    const limitsMatchOperations = hasOperations
      ? skills.operandMax > 0 && skills.resultMax > 0
      : skills.operandMax === 0 && skills.resultMax === 0;

    if (!limitsMatchOperations) {
      context.addIssue({
        code: "custom",
        path: ["operations"],
        message:
          "Operand and result limits must be zero without operations and positive with operations.",
      });
    }
  });

export const ChildProfileV1Schema = z
  .strictObject({
    id: z.string().regex(UUID_V4_PATTERN, "Use a lowercase UUID version 4."),
    displayName: normalizedBoundedText(40).optional(),
    ageYears: z.number().int().min(4).max(18),
    presentationBand: z.enum(PRESENTATION_BANDS),
    reviewedOn: z
      .string()
      .refine(isIsoCalendarDate, "Use a valid ISO calendar date."),
    mathSkills: MathSkillsV1Schema,
    writingMode: z.enum(WRITING_MODES),
    interests: z
      .array(normalizedBoundedText(32))
      .max(5)
      .refine(
        hasUniqueNormalizedInterests,
        "Interest tags must be unique ignoring case.",
      ),
  });

export const GenerationDefaultsV1Schema = z.strictObject({
  useDisplayName: z.boolean(),
  useInterests: z.boolean(),
  includeDecorativeGraphics: z.boolean(),
  difficulty: z.enum(DIFFICULTIES),
  length: z.enum(WORKSHEET_LENGTHS),
  includeAnswerKey: z.boolean(),
  paperSize: z.enum(PAPER_SIZES),
  printScale: z.enum(PRINT_SCALES),
});

export const AppConfigV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    profiles: z.array(ChildProfileV1Schema),
    defaults: GenerationDefaultsV1Schema,
  })
  .superRefine((config, context) => {
    const seenIds = new Set<string>();
    config.profiles.forEach((profile, index) => {
      if (seenIds.has(profile.id)) {
        context.addIssue({
          code: "custom",
          path: ["profiles", index, "id"],
          message: "Profile IDs must be unique.",
        });
      }
      seenIds.add(profile.id);
    });
  });

export type MathSkillsV1 = z.infer<typeof MathSkillsV1Schema>;
export type ChildProfileV1 = z.infer<typeof ChildProfileV1Schema>;
export type GenerationDefaultsV1 = z.infer<
  typeof GenerationDefaultsV1Schema
>;
export type AppConfigV1 = z.infer<typeof AppConfigV1Schema>;
