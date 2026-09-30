import { describe, expect, test, vi } from "vitest";

import { MATH_PRESETS, MATH_PRESET_IDS } from "../config/math-presets.js";
import { migrateConfigV1ToV2 } from "../config/migrate.js";
import {
  ChildProfileV2Schema,
  type ChildProfileV1,
  type ChildProfileV2,
  type GenerationDefaultsV1,
  type PresentationBand,
} from "../config/schema.js";
import {
  CapabilityProfileV1Schema,
  PROJECTED_TOPIC_ALLOWLIST,
  capabilityProfileOf,
  profileWithLegacyChoices,
  projectAndGenerateWorksheet,
  projectGenerationRequest,
  type CapabilityProfileV1,
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

function equationProfile(
  presentationBand: PresentationBand = "early-primary",
): CapabilityProfileV1 {
  return {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Distinctive Nickname",
    presentationBand,
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

function input(profile: CapabilityProfileV1) {
  return {
    profile,
    preferences,
    worksheetType: "dry-math" as const,
    generatorVersion: 1,
    seed: "00000001",
  };
}

describe("projectGenerationRequest", () => {
  test.each(WORKSHEET_TYPE_IDS)(
    "projects %s from a capability profile with no age, identity or review field in the request",
    (worksheetType) => {
      const result = projectGenerationRequest({
        ...input(equationProfile()),
        worksheetType,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const serialized = JSON.stringify(result.request);
      expect(serialized).not.toMatch(/ageYears|reviewedOn|legacyChoices/u);
      expect(serialized).not.toContain(equationProfile().id);
      expect(serialized).not.toContain(equationProfile().reviewedOn);
      expect(result.request.capabilities.writingMode).toBe("sentence-frame");
    },
  );

  test("a malformed seed is refused before any generator runs, with no age gate ahead of it", () => {
    const generator = vi.fn<WorksheetGeneratorV1>();
    const result = projectAndGenerateWorksheet(
      { ...input(equationProfile()), seed: "not-a-seed" },
      generator,
      { worksheetId: "11111111-1111-4111-8111-111111111111" },
    );
    expect(result).toEqual({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
      message: "A valid nonzero worksheet seed could not be created.",
    });
    expect(generator).not.toHaveBeenCalled();
  });

  test("projects an exact age-free allowlist and clamps future capabilities", () => {
    const result = projectGenerationRequest(input(equationProfile()));
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
      operandMax: 100,
      resultMax: 100,
      allowRegrouping: false,
      allowNegativeResults: false,
    });
    expect(JSON.stringify(result.request)).not.toContain(
      "Unreviewed Distinctive Topic",
    );
  });

  test("omits a disabled nickname instead of copying an empty value", () => {
    const result = projectGenerationRequest({
      ...input(equationProfile()),
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
      ...input(equationProfile()),
      preferences: { ...preferences, difficulty: "confidence" },
    });
    expect(confidence.ok).toBe(true);
    if (confidence.ok) {
      expect(confidence.request.capabilities.mathSkills).toMatchObject({
        countingMax: 20,
        numeralMax: 20,
        compareMax: 20,
        operandMax: 75,
        resultMax: 75,
      });
    }

    const base = equationProfile();
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
      ...input(equationProfile()),
      preferences: { ...preferences, difficulty: "stretch" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.options.difficulty).toBe("practice");
      expect(result.request.capabilities.mathSkills.operandMax).toBe(100);
    }
  });

  test("canonicalizes Sentence Builder controls that are hidden by writing mode", () => {
    const source = equationProfile();
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
      ...input(equationProfile()),
      profile: { ...equationProfile(), interests: [interest] },
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

/**
 * Interim (D-interim): the capability view the unchanged projection reads is
 * flattened from a stored profile's `legacyChoices`. Its whole contract is that
 * nothing is lost or invented on the way, which is what lets Steps 15 and 16
 * reproduce the golden content grid unchanged.
 */
describe("capabilityProfileOf", () => {
  const stored: ChildProfileV2 = ChildProfileV2Schema.parse({
    id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    displayName: "Fictional Kit",
    reviewedOn: "2026-09-01",
    interests: ["trains", "Space"],
    legacyChoices: {
      presentationBand: "preschool",
      writingMode: "draw-and-tell",
      mathSkills: {
        countingMax: 1_000,
        numeralMax: 30,
        compareMax: 2,
        representations: ["quantities", "equations"],
        understandsEquality: true,
        operations: ["subtraction"],
        operandMax: 55,
        resultMax: 1_000,
        allowRegrouping: true,
        allowNegativeResults: true,
      },
    },
  });

  test("flattens legacyChoices verbatim beside the identity fields", () => {
    expect(capabilityProfileOf(stored)).toEqual({
      id: stored.id,
      displayName: stored.displayName,
      presentationBand: "preschool",
      reviewedOn: stored.reviewedOn,
      mathSkills: stored.legacyChoices?.mathSkills,
      writingMode: "draw-and-tell",
      interests: stored.interests,
    });
    expect(CapabilityProfileV1Schema.safeParse(capabilityProfileOf(stored)).success).toBe(true);
  });

  test("returns undefined for a profile stored without legacyChoices", () => {
    const { legacyChoices: _unused, ...identityOnly } = stored;
    void _unused;
    expect(capabilityProfileOf(identityOnly)).toBeUndefined();
  });

  test("round-trips through profileWithLegacyChoices and shares no array with its input", () => {
    const capabilities = capabilityProfileOf(stored)!;
    const restored = profileWithLegacyChoices(capabilities);
    expect(restored).toEqual(stored);
    expect(ChildProfileV2Schema.parse(restored)).toEqual(stored);
    capabilities.mathSkills.operations.push("addition");
    capabilities.interests.pop();
    expect(stored.legacyChoices?.mathSkills.operations).toEqual(["subtraction"]);
    expect(stored.interests).toEqual(["trains", "Space"]);
  });

  test("the capability schema refuses an age key", () => {
    const withAge = { ...capabilityProfileOf(stored)!, ageYears: 6 };
    expect(CapabilityProfileV1Schema.safeParse(withAge).success).toBe(false);
    expect(Object.keys(CapabilityProfileV1Schema.shape)).not.toContain("ageYears");
  });

  const CONCRETE_PRESETS = MATH_PRESET_IDS.filter(
    (presetId): presetId is Exclude<typeof presetId, "custom"> => presetId !== "custom",
  );

  test.each(CONCRETE_PRESETS)(
    "a migrated v1 profile at preset %s projects exactly as the v1 original",
    (presetId) => {
      const preset = MATH_PRESETS[presetId];
      const v1Profile: ChildProfileV1 = {
        id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
        displayName: "Fictional Lee",
        ageYears: 7,
        presentationBand: preset.presentationBand ?? "preschool",
        reviewedOn: "2026-08-22",
        mathSkills: {
          ...preset.mathSkills,
          representations: [...preset.mathSkills.representations],
          operations: [...preset.mathSkills.operations],
        },
        writingMode: "label",
        interests: ["space"],
      };
      const migrated = migrateConfigV1ToV2({
        schemaVersion: 1,
        profiles: [v1Profile],
        defaults: { ...preferences },
      }).profiles[0]!;
      const { ageYears: _unused, ...withoutAge } = v1Profile;
      void _unused;
      for (const worksheetType of WORKSHEET_TYPE_IDS) {
        expect(
          projectGenerationRequest({
            ...input(capabilityProfileOf(migrated)!),
            worksheetType,
          }),
          worksheetType,
        ).toEqual(projectGenerationRequest({ ...input(withoutAge), worksheetType }));
      }
    },
  );
});
