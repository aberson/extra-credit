import type { FastifySchemaValidationError } from "fastify/types/schema.js";
import type { z } from "zod";

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
  "GENERATION_AGE_UNSUPPORTED",
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

const mathSkillsProperties = {
  countingMax: { type: "integer", minimum: 1, maximum: 1_000 },
  numeralMax: { type: "integer", minimum: 1, maximum: 1_000 },
  compareMax: { type: "integer", minimum: 1, maximum: 1_000 },
  representations: {
    type: "array",
    minItems: 1,
    maxItems: 2,
    uniqueItems: true,
    items: { enum: ["quantities", "equations"] },
  },
  understandsEquality: { type: "boolean" },
  operations: {
    type: "array",
    maxItems: 2,
    uniqueItems: true,
    items: { enum: ["addition", "subtraction"] },
  },
  operandMax: { type: "integer", minimum: 0, maximum: 1_000 },
  resultMax: { type: "integer", minimum: 0, maximum: 1_000 },
  allowRegrouping: { type: "boolean" },
  allowNegativeResults: { type: "boolean" },
} as const;

export const APP_CONFIG_TRANSPORT_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "profiles", "defaults"],
  properties: {
    schemaVersion: { const: 1 },
    profiles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "ageYears",
          "presentationBand",
          "reviewedOn",
          "mathSkills",
          "writingMode",
          "interests",
        ],
        properties: {
          id: {
            type: "string",
            pattern:
              "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
          },
          // Text bounds apply after trim/code-point normalization in Zod.
          displayName: { type: "string" },
          ageYears: { type: "integer", minimum: 4, maximum: 18 },
          presentationBand: { enum: ["preschool", "early-primary"] },
          reviewedOn: {
            type: "string",
            pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
          },
          mathSkills: {
            type: "object",
            additionalProperties: false,
            required: Object.keys(mathSkillsProperties),
            properties: mathSkillsProperties,
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
          writingMode: {
            enum: [
              "draw-and-tell",
              "label",
              "copy-with-model",
              "sentence-frame",
              "independent",
            ],
          },
          interests: {
            type: "array",
            maxItems: 5,
            // Text bounds apply after trim/code-point normalization in Zod.
            items: { type: "string" },
          },
        },
      },
    },
    defaults: {
      type: "object",
      additionalProperties: false,
      required: [
        "useDisplayName",
        "useInterests",
        "includeDecorativeGraphics",
        "difficulty",
        "length",
        "includeAnswerKey",
        "paperSize",
        "printScale",
      ],
      properties: {
        useDisplayName: { type: "boolean" },
        useInterests: { type: "boolean" },
        includeDecorativeGraphics: { type: "boolean" },
        difficulty: { enum: ["confidence", "practice", "stretch"] },
        length: { enum: ["short", "standard", "long"] },
        includeAnswerKey: { type: "boolean" },
        paperSize: { enum: ["letter", "a4"] },
        printScale: { enum: ["standard", "large"] },
      },
    },
  },
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
