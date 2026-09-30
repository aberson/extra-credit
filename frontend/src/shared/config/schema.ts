/**
 * The current persisted config shape: schema version 2.
 *
 * Every key, value list, numeric bound and named refinement a version 2 file
 * may contain is defined here, on the `enums.ts` and `fields.ts` leaves. The
 * frozen version 1 read path lives in `legacy-v1.ts` and is re-exported below
 * so its consumers keep compiling; `migrate.ts` turns a v1 file into this
 * shape in memory. `tests/integration/config-shape-fingerprint.test.ts` pins
 * the accepted value domain additive-only: a new optional key with a default
 * or a new member of a value list no array bound is derived from may land at
 * version 2, and any other change requires `schemaVersion: 3` with a version 2
 * read path (`CONTRIBUTING.md`).
 */
import { z } from "zod";

import {
  DRY_MATH_NUMERIC_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
  WORKSHEET_TYPE_IDS,
} from "../worksheet/types.js";
import {
  FIND_THE_WOW_VARIANTS,
  MATH_OPERATIONS,
  PAPER_SIZES,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  SENTENCE_VOCABULARY_OPTIONS,
  THEME_CHOICES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "./enums.js";
import {
  UUID_V4_PATTERN,
  isIsoCalendarDate,
  normalizedBoundedText,
} from "./fields.js";
import {
  AppConfigV1Schema,
  MathSkillsV1Schema,
  type AppConfigV1,
} from "./legacy-v1.js";
import {
  hasUniqueNormalizedInterests,
  isCanonicalOrderedSubset,
} from "./normalize.js";

export const APP_CONFIG_SCHEMA_VERSION = 2 as const;

/** The stored versions this build reads: the frozen v1 path and the current one. */
export const STORED_SCHEMA_VERSIONS = [1, APP_CONFIG_SCHEMA_VERSION] as const;
export type StoredSchemaVersion = (typeof STORED_SCHEMA_VERSIONS)[number];

/** The longest nickname, in code points after normalization. */
export const DISPLAY_NAME_MAXIMUM_LENGTH = 40;
/** The longest single interest, in code points after normalization. */
export const INTEREST_MAXIMUM_LENGTH = 32;
/** The most interests one profile keeps. */
export const INTEREST_MAXIMUM_COUNT = 5;

/**
 * The stable name of every refinement on a persisted object (DD3).
 *
 * A hand-kept list: it pins names, not logic. Every new refinement on any
 * object reachable from `AppConfigV2Schema` must be registered here; the
 * fingerprint test fails when a registered name disappears. The three
 * `legacyChoices.mathSkills` names belong to the frozen `MathSkillsV1Schema`,
 * which a v2 profile carries verbatim.
 */
export const PERSISTED_REFINEMENTS = [
  "config.profiles.unique-ids",
  "profile.displayName.normalized-length",
  "profile.interests.item.normalized-length",
  "profile.interests.unique-ignoring-case",
  "profile.legacyChoices.mathSkills.limits-match-operations",
  "profile.legacyChoices.mathSkills.operations.canonical-order",
  "profile.legacyChoices.mathSkills.representations.canonical-order",
  "profile.reviewedOn.calendar-date",
  "worksheet.arithmetic-focus.operations.canonical-order",
] as const;

export type PersistedRefinement = (typeof PERSISTED_REFINEMENTS)[number];

/** Addition and/or subtraction up to one ceiling, the Dry Math and Wow-equation focus. */
function arithmeticFocusV2Schema(ceiling: number) {
  return z.strictObject({
    operations: z
      .array(z.enum(MATH_OPERATIONS))
      .min(1)
      .max(MATH_OPERATIONS.length)
      .refine(
        (values) => isCanonicalOrderedSubset(values, MATH_OPERATIONS),
        "Operations must be unique and use canonical order.",
      ),
    operandMax: z.number().int().min(1).max(ceiling),
    resultMax: z.number().int().min(1).max(ceiling),
  });
}

const quantityMaximum = () => z.number().int().min(1).max(V1_NUMERIC_MAXIMUM);

export const DryMathFocusV2Schema = arithmeticFocusV2Schema(
  DRY_MATH_NUMERIC_MAXIMUM,
);
export const EquationFocusV2Schema = arithmeticFocusV2Schema(V1_NUMERIC_MAXIMUM);

export const QuantityFocusV2Schema = z.strictObject({
  countingMax: quantityMaximum(),
  numeralMax: quantityMaximum(),
});

export const CountCompareFocusV2Schema = z.strictObject({
  countingMax: quantityMaximum(),
  numeralMax: quantityMaximum(),
  compareMax: quantityMaximum(),
});

const worksheetSelectionShape = {
  worksheetType: z.enum(WORKSHEET_TYPE_IDS),
  dryMath: DryMathFocusV2Schema,
  findTheWow: z.strictObject({
    variant: z.enum(FIND_THE_WOW_VARIANTS),
    quantity: QuantityFocusV2Schema,
    equation: EquationFocusV2Schema,
  }),
  sentenceBuilder: z.strictObject({
    variant: z.enum(WRITING_MODES),
    vocabulary: z.enum(SENTENCE_VOCABULARY_OPTIONS),
  }),
  countCompareMake: CountCompareFocusV2Schema,
  theme: z.enum(THEME_CHOICES),
  useDisplayName: z.boolean(),
  useInterests: z.boolean(),
  includeDecorativeGraphics: z.boolean(),
  includeAnswerKey: z.boolean(),
  length: z.enum(WORKSHEET_LENGTHS),
  paperSize: z.enum(PAPER_SIZES),
  printScale: z.enum(PRINT_SCALES),
};

export const WorksheetSelectionV2Schema = z.strictObject(worksheetSelectionShape);

export const WorksheetDefaultsV2Schema = z.strictObject({
  ...worksheetSelectionShape,
  useEarlierChildSettings: z.boolean(),
});

/**
 * A migrated child's earlier writing mode, vocabulary band and math values,
 * kept verbatim and read-only. The math block is the frozen v1 object, so its
 * 0..1000 bounds and both stored-but-unused permission flags survive.
 */
export const LegacyChoicesV2Schema = z.strictObject({
  presentationBand: z.enum(PRESENTATION_BANDS),
  writingMode: z.enum(WRITING_MODES),
  mathSkills: MathSkillsV1Schema,
});

export const ChildProfileV2Schema = z.strictObject({
  id: z.string().regex(UUID_V4_PATTERN, "Use a lowercase UUID version 4."),
  displayName: normalizedBoundedText(DISPLAY_NAME_MAXIMUM_LENGTH).optional(),
  reviewedOn: z
    .string()
    .refine(isIsoCalendarDate, "Use a valid ISO calendar date."),
  interests: z
    .array(normalizedBoundedText(INTEREST_MAXIMUM_LENGTH))
    .max(INTEREST_MAXIMUM_COUNT)
    .refine(
      hasUniqueNormalizedInterests,
      "Interest tags must be unique ignoring case.",
    ),
  legacyChoices: LegacyChoicesV2Schema.optional(),
});

export const AppConfigV2Schema = z
  .strictObject({
    schemaVersion: z.literal(APP_CONFIG_SCHEMA_VERSION),
    profiles: z.array(ChildProfileV2Schema),
    defaults: WorksheetDefaultsV2Schema,
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

/** What `GET` and `PUT /api/config` return: the config and the version stored on disk. */
export const ConfigResponseV2Schema = z.strictObject({
  config: AppConfigV2Schema,
  storedSchemaVersion: z.union([z.literal(1), z.literal(APP_CONFIG_SCHEMA_VERSION)]),
});

export type ArithmeticFocusV2 = z.infer<typeof DryMathFocusV2Schema>;
export type QuantityFocusV2 = z.infer<typeof QuantityFocusV2Schema>;
export type CountCompareFocusV2 = z.infer<typeof CountCompareFocusV2Schema>;
export type WorksheetSelectionV2 = z.infer<typeof WorksheetSelectionV2Schema>;
export type WorksheetDefaultsV2 = z.infer<typeof WorksheetDefaultsV2Schema>;
export type LegacyChoicesV2 = z.infer<typeof LegacyChoicesV2Schema>;
export type ChildProfileV2 = z.infer<typeof ChildProfileV2Schema>;
export type AppConfigV2 = z.infer<typeof AppConfigV2Schema>;
export type ConfigResponseV2 = z.infer<typeof ConfigResponseV2Schema>;
export type FindTheWowVariant = (typeof FIND_THE_WOW_VARIANTS)[number];
export type SentenceVocabulary = (typeof SENTENCE_VOCABULARY_OPTIONS)[number];
export type ThemeChoice = (typeof THEME_CHOICES)[number];

// The shared value lists live in the `enums.ts` leaf and the frozen Version 1
// schemas in `legacy-v1.ts`; every name this module exported before the move
// is re-exported here, so existing imports keep compiling unchanged.
export {
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
} from "./enums.js";
export {
  AppConfigV1Schema,
  ChildProfileV1Schema,
  DIFFICULTIES,
  GenerationDefaultsV1Schema,
  MathSkillsV1Schema,
} from "./legacy-v1.js";
export type {
  AppConfigV1,
  ChildProfileV1,
  GenerationDefaultsV1,
  MathSkillsV1,
} from "./legacy-v1.js";

export type PresentationBand = (typeof PRESENTATION_BANDS)[number];
export type WritingMode = (typeof WRITING_MODES)[number];

export function parseAppConfigV1(input: unknown): AppConfigV1 {
  return AppConfigV1Schema.parse(input);
}

export function parseAppConfigV2(input: unknown): AppConfigV2 {
  return AppConfigV2Schema.parse(input);
}
