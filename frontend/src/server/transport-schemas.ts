import type { FastifySchemaValidationError } from "fastify/types/schema.js";
import type { z } from "zod";

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
} from "../shared/config/enums.js";
import { ISO_DATE_PATTERN, UUID_V4_PATTERN } from "../shared/config/fields.js";
import {
  APP_CONFIG_SCHEMA_VERSION,
  INTEREST_MAXIMUM_COUNT,
  MathSkillsV1Schema,
} from "../shared/config/schema.js";
import {
  DRY_MATH_NUMERIC_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
  WORKSHEET_TYPE_IDS,
} from "../shared/worksheet/types.js";

export const PUBLIC_ERROR_CODES = [
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
] as const;

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number];

export const SAFE_ERROR_MESSAGES = {
  BODY_TOO_LARGE: "The request is too large.",
  CONFIG_CONFLICT:
    "The saved profiles changed. Reload them before trying again.",
  CONFIG_INVALID:
    "The saved profile file is invalid. It was left unchanged.",
  CONFIG_IO_ERROR:
    "The local profile file could not be accessed safely. It was left unchanged.",
  CONFIG_NOT_FOUND: "No saved profile configuration exists yet.",
  CONFIG_PRECONDITION_REQUIRED:
    "Reload the saved profiles before trying to save.",
  CONFIG_RECOVERY_NOT_ALLOWED:
    "This profile file cannot be replaced with the requested recovery action.",
  CONFIG_SERIALIZED_TOO_LARGE:
    "The normalized profile configuration is too large to save.",
  CONFIG_TOO_LARGE:
    "The saved profile file is too large and was left unchanged.",
  CONFIG_UNSAFE_FILE:
    "The saved profile target is not a safe regular file and was left unchanged.",
  CONFIG_VERSION_UNSUPPORTED:
    "The saved profile file was created by a newer unsupported version and was left unchanged.",
  CONTENT_TYPE_REQUIRED: "Send profile configuration as application/json.",
  CROSS_SITE_REJECTED: "A cross-site request was rejected.",
  HOST_REJECTED: "The request did not use the expected local address.",
  INVALID_JSON: "The request body is not valid JSON.",
  ORIGIN_REJECTED: "The request did not come from the expected local page.",
  SESSION_TOKEN_INVALID: "The local session expired. Reload before continuing.",
  VALIDATION_FAILED: "The profile configuration is not valid.",
} as const satisfies Partial<Record<PublicErrorCode, string>>;

export interface ApiErrorBody {
  readonly error: {
    readonly code: PublicErrorCode;
    readonly message: string;
    readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  };
}

export function apiError(
  code: PublicErrorCode,
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): ApiErrorBody {
  const message =
    SAFE_ERROR_MESSAGES[code as keyof typeof SAFE_ERROR_MESSAGES] ??
    "The request could not be completed.";

  return {
    error: {
      code,
      message,
      ...(fieldErrors === undefined ? {} : { fieldErrors }),
    },
  };
}

/**
 * The transform-free JSON Schema AJV applies to a `PUT /api/config` body before
 * Zod sees it (DD6). It is COMPOSED from the same `as const` value lists and
 * numeric ceilings the Zod schema in `shared/config/schema.ts` is built from,
 * never restated by hand, so the two layers cannot drift; Zod stays
 * authoritative for text normalization, text bounds, calendar dates, canonical
 * order and every other cross-field rule. The legacy `mathSkills` integer
 * bounds are read from the frozen `MathSkillsV1Schema` fields themselves, so
 * the frozen module stays the only place they are written.
 */

/**
 * The `{ type, minimum, maximum }` a bounded Zod integer field declares, read
 * from the field (Zod reports `minValue` and `maxValue`). A field that is not
 * an integer, or that leaves either side at the safe-integer default, is a
 * composition defect and throws when this module loads.
 */
export function zodIntegerBounds(field: z.ZodNumber): {
  readonly type: "integer";
  readonly minimum: number;
  readonly maximum: number;
} {
  const { isInt, minValue, maxValue } = field;
  if (
    !isInt ||
    minValue === null ||
    maxValue === null ||
    minValue <= Number.MIN_SAFE_INTEGER ||
    maxValue >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("A transport integer bound must come from a bounded Zod integer field.");
  }
  return { type: "integer", minimum: minValue, maximum: maxValue };
}

const legacyMathFields = MathSkillsV1Schema.shape;

const legacyMathSkillsProperties = {
  countingMax: zodIntegerBounds(legacyMathFields.countingMax),
  numeralMax: zodIntegerBounds(legacyMathFields.numeralMax),
  compareMax: zodIntegerBounds(legacyMathFields.compareMax),
  representations: {
    type: "array",
    minItems: 1,
    maxItems: REPRESENTATIONS.length,
    uniqueItems: true,
    items: { enum: REPRESENTATIONS },
  },
  understandsEquality: { type: "boolean" },
  operations: {
    type: "array",
    maxItems: MATH_OPERATIONS.length,
    uniqueItems: true,
    items: { enum: MATH_OPERATIONS },
  },
  operandMax: zodIntegerBounds(legacyMathFields.operandMax),
  resultMax: zodIntegerBounds(legacyMathFields.resultMax),
  allowRegrouping: { type: "boolean" },
  allowNegativeResults: { type: "boolean" },
} as const;

/**
 * A closed object schema (`additionalProperties: false`) whose `required`
 * list is every property key not named in `optional`.
 */
export function strictObjectSchema<const TProperties extends Record<string, unknown>>(
  properties: TProperties,
  optional: readonly (keyof TProperties & string)[] = [],
) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties).filter(
      (key) => !(optional as readonly string[]).includes(key),
    ),
    properties,
  } as const;
}

function arithmeticFocusSchema(ceiling: number) {
  return strictObjectSchema({
    operations: {
      type: "array",
      minItems: 1,
      maxItems: MATH_OPERATIONS.length,
      uniqueItems: true,
      items: { enum: MATH_OPERATIONS },
    },
    operandMax: { type: "integer", minimum: 1, maximum: ceiling },
    resultMax: { type: "integer", minimum: 1, maximum: ceiling },
  });
}

const quantityMaximumSchema = {
  type: "integer",
  minimum: 1,
  maximum: V1_NUMERIC_MAXIMUM,
} as const;

const worksheetDefaultsProperties = {
  worksheetType: { enum: WORKSHEET_TYPE_IDS },
  dryMath: arithmeticFocusSchema(DRY_MATH_NUMERIC_MAXIMUM),
  findTheWow: strictObjectSchema({
    variant: { enum: FIND_THE_WOW_VARIANTS },
    quantity: strictObjectSchema({
      countingMax: quantityMaximumSchema,
      numeralMax: quantityMaximumSchema,
    }),
    equation: arithmeticFocusSchema(V1_NUMERIC_MAXIMUM),
  }),
  sentenceBuilder: strictObjectSchema({
    variant: { enum: WRITING_MODES },
    vocabulary: { enum: SENTENCE_VOCABULARY_OPTIONS },
  }),
  countCompareMake: strictObjectSchema({
    countingMax: quantityMaximumSchema,
    numeralMax: quantityMaximumSchema,
    compareMax: quantityMaximumSchema,
  }),
  theme: { enum: THEME_CHOICES },
  useDisplayName: { type: "boolean" },
  useInterests: { type: "boolean" },
  includeDecorativeGraphics: { type: "boolean" },
  includeAnswerKey: { type: "boolean" },
  length: { enum: WORKSHEET_LENGTHS },
  paperSize: { enum: PAPER_SIZES },
  printScale: { enum: PRINT_SCALES },
  useEarlierChildSettings: { type: "boolean" },
} as const;

const legacyChoicesSchema = strictObjectSchema({
  presentationBand: { enum: PRESENTATION_BANDS },
  writingMode: { enum: WRITING_MODES },
  mathSkills: {
    ...strictObjectSchema(legacyMathSkillsProperties),
    allOf: [
      {
        if: {
          properties: {
            operations: { type: "array", maxItems: 0 },
          },
          required: ["operations"],
        },
        then: {
          properties: {
            operandMax: { const: 0 },
            resultMax: { const: 0 },
          },
        },
        else: {
          properties: {
            operandMax: { type: "integer", minimum: 1 },
            resultMax: { type: "integer", minimum: 1 },
          },
        },
      },
    ],
  },
});

const childProfileSchema = strictObjectSchema(
  {
    id: {
      type: "string",
      pattern: UUID_V4_PATTERN.source,
    },
    // Text bounds apply after trim/code-point normalization in Zod.
    displayName: { type: "string" },
    reviewedOn: {
      type: "string",
      pattern: ISO_DATE_PATTERN.source,
    },
    interests: {
      type: "array",
      maxItems: INTEREST_MAXIMUM_COUNT,
      // Text bounds apply after trim/code-point normalization in Zod.
      items: { type: "string" },
    },
    legacyChoices: legacyChoicesSchema,
  },
  ["displayName", "legacyChoices"],
);

/** The composed version 2 body schema, also the fingerprint's source. */
export const APP_CONFIG_TRANSPORT_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  ...strictObjectSchema({
    schemaVersion: { const: APP_CONFIG_SCHEMA_VERSION },
    profiles: {
      type: "array",
      items: childProfileSchema,
    },
    defaults: strictObjectSchema(worksheetDefaultsProperties),
  }),
} as const;

export function zodFieldErrors(
  issues: readonly z.core.$ZodIssue[],
): Readonly<Record<string, readonly string[]>> {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.length === 0 ? "config" : issue.path.join(".");
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}

function ajvPath(error: FastifySchemaValidationError): string {
  let path = error.instancePath
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .join(".");

  if (
    error.keyword === "additionalProperties" &&
    typeof error.params.additionalProperty === "string"
  ) {
    path = [path, error.params.additionalProperty].filter(Boolean).join(".");
  } else if (
    error.keyword === "required" &&
    typeof error.params.missingProperty === "string"
  ) {
    path = [path, error.params.missingProperty].filter(Boolean).join(".");
  }

  return path.length === 0 ? "config" : path;
}

export function ajvFieldErrors(
  issues: readonly FastifySchemaValidationError[],
): Readonly<Record<string, readonly string[]>> {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    (errors[ajvPath(issue)] ??= []).push("This value is not valid.");
  }
  return errors;
}
