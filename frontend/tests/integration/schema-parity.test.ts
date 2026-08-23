import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Fastify from "fastify";
import { describe, expect, test } from "vitest";

import {
  AppConfigV1Schema,
  type AppConfigV1,
} from "../../src/shared/config/schema.js";
import {
  expandMathPreset,
  getAgePresetSuggestion,
} from "../../src/shared/config/math-presets.js";
import {
  APP_CONFIG_TRANSPORT_SCHEMA,
  PUBLIC_ERROR_CODES,
} from "../../src/server/transport-schemas.js";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function fixture(ageYears = 6): AppConfigV1 {
  return {
    schemaVersion: 1,
    profiles: [
      {
        id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
        displayName: "Morgan",
        ageYears,
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
    ],
    defaults: {
      useDisplayName: true,
      useInterests: true,
      includeDecorativeGraphics: true,
      difficulty: "practice",
      length: "standard",
      includeAnswerKey: true,
      paperSize: "letter",
      printScale: "standard",
    },
  };
}

async function transportAccepts(body: unknown): Promise<boolean> {
  const app = Fastify({
    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false,
        useDefaults: false,
      },
    },
  });
  app.post("/", { schema: { body: APP_CONFIG_TRANSPORT_SCHEMA } }, async () => ({}));
  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(body),
    });
    return response.statusCode === 200;
  } finally {
    await app.close();
  }
}

describe("AppConfigV1 schema and transform-free transport parity", () => {
  test("pins the complete v1 public machine-code set", () => {
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
      "GENERATION_AGE_UNSUPPORTED",
      "GENERATION_CONSTRAINT_CONFLICT",
      "GENERATION_INVARIANT_FAILED",
    ]);
  });

  test.each([
    [3, false],
    [4, true],
    [5, true],
    [6, true],
    [7, true],
    [8, true],
    [9, true],
    [18, true],
    [19, false],
  ] as const)("classifies age %i identically", async (ageYears, accepted) => {
    const input = fixture(ageYears);
    expect(AppConfigV1Schema.safeParse(input).success).toBe(accepted);
    expect(await transportAccepts(input)).toBe(accepted);
  });

  test.each([
    ["top-level unknown", (value: Record<string, unknown>) => (value.avoidTopics = [])],
    [
      "profile unknown",
      (value: Record<string, unknown>) => {
        const profiles = value.profiles as Record<string, unknown>[];
        profiles[0]!.avoidTopics = ["school"];
      },
    ],
    [
      "nested unknown",
      (value: Record<string, unknown>) => {
        const profiles = value.profiles as Array<{ mathSkills: Record<string, unknown> }>;
        profiles[0]!.mathSkills.gradeLevel = 1;
      },
    ],
  ])("rejects %s at both validation layers", async (_label, mutate) => {
    const input = structuredClone(fixture()) as unknown as Record<string, unknown>;
    mutate(input);
    expect(AppConfigV1Schema.safeParse(input).success).toBe(false);
    expect(await transportAccepts(input)).toBe(false);
  });

  test("keeps transport transform-free and Zod authoritative", async () => {
    const stringAge = structuredClone(fixture()) as unknown as {
      profiles: Array<{ ageYears: unknown }>;
    };
    stringAge.profiles[0]!.ageYears = "6";
    expect(await transportAccepts(stringAge)).toBe(false);
    expect(AppConfigV1Schema.safeParse(stringAge).success).toBe(false);

    const missingDefault = structuredClone(fixture()) as unknown as {
      defaults: Record<string, unknown>;
    };
    delete missingDefault.defaults.paperSize;
    expect(await transportAccepts(missingDefault)).toBe(false);
    expect(AppConfigV1Schema.safeParse(missingDefault).success).toBe(false);

    const trimmed = structuredClone(fixture());
    trimmed.profiles[0]!.displayName = "  Morgan  ";
    trimmed.profiles[0]!.interests = ["  Nature  "];
    const parsed = AppConfigV1Schema.parse(trimmed);
    expect(parsed.profiles[0]!.displayName).toBe("Morgan");
    expect(parsed.profiles[0]!.interests).toEqual(["Nature"]);

    const paddedBoundary = structuredClone(fixture());
    paddedBoundary.profiles[0]!.displayName = `  ${"x".repeat(40)}  `;
    expect(await transportAccepts(paddedBoundary)).toBe(true);
    expect(
      AppConfigV1Schema.parse(paddedBoundary).profiles[0]!.displayName,
    ).toHaveLength(40);

    const normalizedOverflow = structuredClone(fixture());
    normalizedOverflow.profiles[0]!.displayName = ` ${"x".repeat(41)} `;
    expect(await transportAccepts(normalizedOverflow)).toBe(true);
    expect(AppConfigV1Schema.safeParse(normalizedOverflow).success).toBe(false);
  });

  test("rejects duplicate identities/tags and invalid capability ordering", () => {
    const duplicateId = fixture();
    duplicateId.profiles.push(structuredClone(duplicateId.profiles[0]!));
    expect(AppConfigV1Schema.safeParse(duplicateId).success).toBe(false);

    const duplicateTag = fixture();
    duplicateTag.profiles[0]!.interests = [" Nature ", "nature"];
    expect(AppConfigV1Schema.safeParse(duplicateTag).success).toBe(false);

    const reversed = fixture();
    reversed.profiles[0]!.mathSkills.operations = ["subtraction", "addition"];
    expect(AppConfigV1Schema.safeParse(reversed).success).toBe(false);

    const noOperationWithLimits = fixture();
    noOperationWithLimits.profiles[0]!.mathSkills.operations = [];
    expect(AppConfigV1Schema.safeParse(noOperationWithLimits).success).toBe(false);
  });

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
    expect(parsed.defaults).toEqual(fixture().defaults);

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

  test("pins every age suggestion without silently advancing a profile", () => {
    expect(getAgePresetSuggestion(4)).toEqual({
      status: "selected",
      presetId: "quantities-to-10",
    });
    expect(getAgePresetSuggestion(5)).toEqual({
      status: "choice",
      presetIds: ["quantities-to-10", "emerging-equations-within-5"],
    });
    expect(getAgePresetSuggestion(6)).toEqual({
      status: "selected",
      presetId: "early-primary-within-10",
    });
    expect(getAgePresetSuggestion(7)).toEqual(getAgePresetSuggestion(6));
    expect(getAgePresetSuggestion(8)).toEqual({
      status: "selected",
      presetId: "early-primary-within-20",
    });
    for (let age = 9; age <= 18; age += 1) {
      expect(getAgePresetSuggestion(age)).toEqual({ status: "unsupported" });
    }
  });
});
