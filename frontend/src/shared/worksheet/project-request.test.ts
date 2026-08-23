import { describe, expect, test, vi } from "vitest";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../config/schema.js";
import {
  projectAndGenerateWorksheet,
  projectGenerationRequest,
} from "./project-request.js";
import type { WorksheetGeneratorV1 } from "./types.js";

const preferences: GenerationDefaultsV1 = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

function equationProfile(ageYears: number): ChildProfileV1 {
  return {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Distinctive Nickname",
    ageYears,
    presentationBand: ageYears <= 5 ? "preschool" : "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 1_000,
      numeralMax: 1_000,
      compareMax: 1_000,
      representations: ["quantities", "equations"],
      understandsEquality: false,
      operations: ["addition", "subtraction"],
      operandMax: 1_000,
      resultMax: 1_000,
      allowRegrouping: true,
      allowNegativeResults: true,
    },
    writingMode: "sentence-frame",
    interests: ["space", "Unreviewed Distinctive Topic"],
  };
}

function input(profile: ChildProfileV1) {
  return {
    profile,
    preferences,
    worksheetType: "dry-math" as const,
    generatorVersion: 1,
    seed: "00000001",
  };
}

describe("projectGenerationRequest", () => {
  test.each([4, 8])(
    "accepts an equation-capable profile at the age-%i boundary",
    (ageYears) => {
      const result = projectGenerationRequest(input(equationProfile(ageYears)));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.request.capabilities.mathSkills.operations).toEqual([
          "addition",
          "subtraction",
        ]);
      }
    },
  );

  test.each([9, 10, 11, 12, 13, 14, 15, 16, 17, 18])(
    "rejects age %i before constructing a request or invoking a generator",
    (ageYears) => {
      const generator = vi.fn<WorksheetGeneratorV1>();
      const result = projectAndGenerateWorksheet(
        {
          ...input(equationProfile(ageYears)),
          seed: "not-a-seed",
        },
        generator,
        { worksheetId: "11111111-1111-4111-8111-111111111111" },
      );
      expect(result).toEqual({
        ok: false,
        code: "GENERATION_AGE_UNSUPPORTED",
        message:
          "Version 1 worksheets support ages 4–8. This profile stays saved for a future skill pack.",
      });
      expect(generator).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty("request");
    },
  );

  test("projects an exact age-free allowlist and clamps future capabilities", () => {
    const result = projectGenerationRequest(input(equationProfile(8)));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Object.keys(result.request).sort()).toEqual([
      "capabilities",
      "displayName",
      "generatorVersion",
      "options",
      "schemaVersion",
      "seed",
      "worksheetType",
    ]);
    expect(result.request).not.toHaveProperty("ageYears");
    expect(result.request).not.toHaveProperty("id");
    expect(result.request).not.toHaveProperty("reviewedOn");
    expect(result.request).not.toHaveProperty("interests");
    expect(result.request).not.toHaveProperty("topicIds");
    expect(result.request.options.includeDecorativeGraphics).toBe(false);
    expect(result.request.capabilities.mathSkills).toMatchObject({
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      operandMax: 20,
      resultMax: 20,
      allowRegrouping: false,
      allowNegativeResults: false,
    });
    expect(JSON.stringify(result.request)).not.toContain(
      "Unreviewed Distinctive Topic",
    );
  });

  test("omits a disabled nickname instead of copying an empty value", () => {
    const result = projectGenerationRequest({
      ...input(equationProfile(6)),
      preferences: { ...preferences, useDisplayName: false },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request).not.toHaveProperty("displayName");
      expect(JSON.stringify(result.request)).not.toContain("Distinctive Nickname");
    }
  });

  test("difficulty changes only activity-relevant maxima after the V1 clamp", () => {
    const confidence = projectGenerationRequest({
      ...input(equationProfile(6)),
      preferences: { ...preferences, difficulty: "confidence" },
    });
    expect(confidence.ok).toBe(true);
    if (confidence.ok) {
      expect(confidence.request.capabilities.mathSkills).toMatchObject({
        countingMax: 20,
        numeralMax: 20,
        compareMax: 20,
        operandMax: 15,
        resultMax: 15,
      });
    }

    const base = equationProfile(6);
    base.mathSkills.operandMax = 8;
    base.mathSkills.resultMax = 12;
    const unconfirmed = projectGenerationRequest({
      ...input(base),
      preferences: { ...preferences, difficulty: "stretch" },
    });
    expect(unconfirmed).toMatchObject({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
    });
    const confirmed = projectGenerationRequest({
      ...input(base),
      preferences: { ...preferences, difficulty: "stretch" },
      stretchConfirmed: true,
    });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.request.capabilities.mathSkills).toMatchObject({
        operandMax: 10,
        resultMax: 15,
      });
      expect(confirmed.request.options.difficulty).toBe("stretch");
    }
  });

  test("normalizes ineffective maximum stretch to practice", () => {
    const result = projectGenerationRequest({
      ...input(equationProfile(8)),
      preferences: { ...preferences, difficulty: "stretch" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.options.difficulty).toBe("practice");
      expect(result.request.capabilities.mathSkills.operandMax).toBe(20);
    }
  });

  test("canonicalizes Sentence Builder controls that are hidden by writing mode", () => {
    const source = equationProfile(6);
    source.writingMode = "copy-with-model";
    const result = projectGenerationRequest({
      profile: source,
      preferences: {
        ...preferences,
        difficulty: "confidence",
        length: "long",
        includeAnswerKey: true,
      },
      worksheetType: "sentence-builder",
      generatorVersion: 1,
      seed: "00000001",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.options).toMatchObject({
        difficulty: "practice",
        length: "standard",
        includeAnswerKey: false,
        includeDecorativeGraphics: true,
      });
      expect(result.request.topicIds).toEqual(["space"]);
    }
  });
});
