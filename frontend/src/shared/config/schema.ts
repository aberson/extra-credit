import { z } from "zod";

import {
  hasUniqueNormalizedInterests,
  isCanonicalOrderedSubset,
  normalizeProfileText,
  unicodeCharacterLength,
} from "./normalize.js";

export const APP_CONFIG_SCHEMA_VERSION = 1 as const;

export const PRESENTATION_BANDS = ["preschool", "early-primary"] as const;
export const REPRESENTATIONS = ["quantities", "equations"] as const;
export const MATH_OPERATIONS = ["addition", "subtraction"] as const;
export const WRITING_MODES = [
  "draw-and-tell",
  "label",
  "copy-with-model",
  "sentence-frame",
  "independent",
] as const;
export const DIFFICULTIES = ["confidence", "practice", "stretch"] as const;
export const WORKSHEET_LENGTHS = ["short", "standard", "long"] as const;
export const PAPER_SIZES = ["letter", "a4"] as const;
export const PRINT_SCALES = ["standard", "large"] as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function isIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const normalizedBoundedText = (maximum: number) =>
  z
    .string()
    .transform(normalizeProfileText)
    .pipe(
      z.string().superRefine((value, context) => {
        const length = unicodeCharacterLength(value);
        if (length < 1) {
          context.addIssue({
            code: "custom",
            message: "Enter at least one character.",
          });
        } else if (length > maximum) {
          context.addIssue({
            code: "custom",
            message: `Enter no more than ${maximum} characters.`,
          });
        }
      }),
    );

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
    schemaVersion: z.literal(APP_CONFIG_SCHEMA_VERSION),
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
export type PresentationBand = (typeof PRESENTATION_BANDS)[number];
export type WritingMode = (typeof WRITING_MODES)[number];

export function parseAppConfigV1(input: unknown): AppConfigV1 {
  return AppConfigV1Schema.parse(input);
}
