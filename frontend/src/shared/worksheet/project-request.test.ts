import { describe, expect, test, vi } from "vitest";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../config/schema.js";
import {
  PROJECTED_TOPIC_ALLOWLIST,
  projectAndGenerateWorksheet,
  projectGenerationRequest,
} from "./project-request.js";
import {
  REVIEWED_TOPIC_IDS,
  TOPIC_IDS,
  WORKSHEET_TYPE_IDS,
  type TopicId,
  type WorksheetGeneratorV1,
  type WorksheetType,
} from "./types.js";

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

/**
 * The reviewed-topic allowlist has exactly ONE declaration, and these tests
 * prove it in both directions for every ID `TOPIC_IDS` declares: identity
 * closes the substitution direction, the sweep closes the additive one. The
 * third test below records exactly what stays outside their reach, and which
 * guard covers that instead.
 *
 * `code-quality.md` requires identity rather than equality, because two lists
 * that are equal today drift tomorrow. Identity alone is not sufficient here
 * though: it cannot see a copy that bypasses the shared binding altogether. A
 * dropped topic is caught by the sweep's first branch (the projector stops
 * emitting one it must emit) and an ADDED topic by its second (the projector
 * emits one `count-compare-make/generator.ts` refuses, turning a worksheet
 * into a hard GENERATION_INVARIANT_FAILED).
 */
describe("reviewed-topic allowlist", () => {
  function topicsFor(
    interest: string,
    worksheetType: WorksheetType = "count-compare-make",
  ): readonly TopicId[] {
    const projection = projectGenerationRequest({
      ...input(equationProfile(6)),
      profile: { ...equationProfile(6), interests: [interest] },
      worksheetType,
    });
    if (!projection.ok) {
      throw new Error(projection.message);
    }
    return projection.request.topicIds ?? [];
  }

  test("the projector consults the leaf constant itself, not a copy of it", () => {
    expect(PROJECTED_TOPIC_ALLOWLIST).toBe(REVIEWED_TOPIC_IDS);
  });

  test("every declared topic is emitted exactly when it is reviewed", () => {
    // Both directions in one sweep: a dropped topic fails the first branch, an
    // added one fails the second. `TOPIC_IDS` is the full declared set, so
    // `neutral` - the unmatched fallback, deliberately not reviewed - is the
    // case that would go quietly wrong.
    for (const topicId of TOPIC_IDS) {
      const reviewed = (REVIEWED_TOPIC_IDS as readonly string[]).includes(
        topicId,
      );
      expect(topicsFor(topicId), topicId).toEqual(reviewed ? [topicId] : []);
    }
  });

  test("no interest string can produce a topic outside the allowlist", () => {
    // Whatever the projector emits, for any interest, must be a member of the
    // one allowlist. What this genuinely closes is a DECLARED id sneaking in -
    // `neutral` above all, which the `TopicId` type permits and which the
    // projector would emit for the interest "neutral".
    //
    // It does NOT close an id `TOPIC_IDS` never declared. The probes can only
    // reach the normalized images of their own strings, so an unreachable
    // extra member of the projector's membership set changes nothing this
    // block can observe: injecting `"dinosaurs" as TopicId` there leaves this
    // block - and the whole suite - green. The guard is the `TopicId` type on
    // that set: without the cast the same injection is a typecheck error,
    // which is where it is actually caught.
    const probes = [
      ...TOPIC_IDS,
      ...TOPIC_IDS.map((topicId) => topicId.toUpperCase()),
      "  Space  ",
      "Unreviewed Distinctive Topic",
      "",
      "neutral-ish",
    ];
    for (const probe of probes) {
      for (const topicId of topicsFor(probe)) {
        expect(
          (REVIEWED_TOPIC_IDS as readonly string[]).includes(topicId),
          `${JSON.stringify(probe)} produced ${topicId}`,
        ).toBe(true);
      }
    }
  });

  test("the allowlist stays a strict subset of the declared topics", () => {
    for (const topicId of REVIEWED_TOPIC_IDS) {
      expect(TOPIC_IDS, topicId).toContain(topicId);
    }
    expect(REVIEWED_TOPIC_IDS as readonly string[]).not.toContain("neutral");
  });

  test("the boundary carries topics for exactly the interest-using families", () => {
    // The sweeps above drive one family. This is what lets them speak for all
    // four: it runs the SAME boundary once per declared worksheet type with a
    // reviewed interest and pins, per family, whether topics travel at all.
    // Adding a family to `worksheetUsesInterests` or dropping one out of it
    // fails here, and so does declaring a fifth family without deciding.
    const carriesTopics = Object.fromEntries(
      WORKSHEET_TYPE_IDS.map((worksheetType) => [
        worksheetType,
        topicsFor("space", worksheetType),
      ]),
    );
    expect(carriesTopics).toEqual({
      "dry-math": [],
      "find-the-wow": [],
      "sentence-builder": ["space"],
      "count-compare-make": ["space"],
    });
  });
});
