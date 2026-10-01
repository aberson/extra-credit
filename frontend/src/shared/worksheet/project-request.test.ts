import fc from "fast-check";
import { describe, expect, test, vi } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../config/defaults.js";
import { profileWithLegacyChoices } from "../config/earlier-settings.js";
import {
  FIND_THE_WOW_VARIANTS,
  MATH_OPERATIONS,
  PAPER_SIZES,
  PRINT_SCALES,
  SENTENCE_VOCABULARY_OPTIONS,
  THEME_CHOICES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "../config/enums.js";
import { MATH_PRESETS, MATH_PRESET_IDS } from "../config/math-presets.js";
import { migrateConfigV1ToV2 } from "../config/migrate.js";
import {
  PRACTICE_FOCUS_CATALOG,
  VOCABULARY_PRESENTATION_BANDS,
} from "../config/practice-focus.js";
import { selectionFromEarlierSettings } from "../config/earlier-settings.js";
import type {
  ArithmeticFocusV2,
  ChildProfileV1,
  ChildProfileV2,
  WorksheetSelectionV2,
} from "../config/schema.js";
import {
  INACTIVE_MATH_FIELDS,
  INACTIVE_WRITING_CAPABILITIES,
  PROJECTED_TOPIC_ALLOWLIST,
  projectAndGenerateWorksheet,
  projectGenerationRequest,
  projectWorksheetCapabilities,
  type ProjectionChild,
} from "./project-request.js";
import { canonicalContentKey } from "./invariants.js";
import { getWorksheetRegistration } from "./registry.js";
import {
  DRY_MATH_NUMERIC_MAXIMUM,
  REVIEWED_TOPIC_IDS,
  TOPIC_IDS,
  V1_NUMERIC_MAXIMUM,
  WORKSHEET_TYPE_IDS,
  type GenerationRequestV1,
  type TopicId,
  type WorksheetGeneratorV1,
  type WorksheetType,
} from "./types.js";

/** A fictional child: a nickname and one reviewed and one unreviewed interest. */
const child: ChildProfileV2 = profileWithLegacyChoices({
  id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
  displayName: "Distinctive Nickname",
  presentationBand: "early-primary",
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
});

const baseSelection: WorksheetSelectionV2 = worksheetSelectionOf(
  DEFAULT_WORKSHEET_DEFAULTS_V2,
);

function selectionFor(
  worksheetType: WorksheetType,
  overrides: Partial<WorksheetSelectionV2> = {},
): WorksheetSelectionV2 {
  return { ...baseSelection, ...overrides, worksheetType };
}

function input(selection: WorksheetSelectionV2, profile: ProjectionChild = child) {
  return {
    profile,
    selection,
    generatorVersion: 1,
    seed: "00000001",
  };
}

function requestFor(
  selection: WorksheetSelectionV2,
  profile: ProjectionChild = child,
  seed = "00000001",
): GenerationRequestV1 {
  const projection = projectGenerationRequest({ ...input(selection, profile), seed });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  return projection.request;
}

/** The real registered generator's items, or its refusal message. */
function itemsFor(request: GenerationRequestV1): unknown {
  const result = getWorksheetRegistration(request.worksheetType).generate(request, {
    worksheetId: "11111111-1111-4111-8111-111111111111",
  });
  return result.ok ? result.document.items : { refused: result.message };
}

describe("projectGenerationRequest", () => {
  test.each(WORKSHEET_TYPE_IDS)(
    "projects %s from a worksheet selection with no age, identity or review field in the request",
    (worksheetType) => {
      const result = projectGenerationRequest(input(selectionFor(worksheetType)));
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const serialized = JSON.stringify(result.request);
      expect(serialized).not.toMatch(/ageYears|reviewedOn|legacyChoices|difficulty/u);
      expect(serialized).not.toContain(child.id);
      expect(serialized).not.toContain(child.reviewedOn);
      expect(result.request.worksheetType).toBe(worksheetType);
    },
  );

  test("a malformed seed is refused before any generator runs, with no age gate ahead of it", () => {
    const generator = vi.fn<WorksheetGeneratorV1>();
    const result = projectAndGenerateWorksheet(
      { ...input(selectionFor("dry-math")), seed: "not-a-seed" },
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

  test("an invalid generator version is refused before any generator runs", () => {
    const generator = vi.fn<WorksheetGeneratorV1>();
    const result = projectAndGenerateWorksheet(
      { ...input(selectionFor("dry-math")), generatorVersion: 0 },
      generator,
      { worksheetId: "11111111-1111-4111-8111-111111111111" },
    );
    expect(result).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
    expect(generator).not.toHaveBeenCalled();
  });

  test("projects an exact age-free allowlist with both permission flags false", () => {
    const request = requestFor(selectionFor("dry-math"));
    expect(Object.keys(request).sort()).toEqual([
      "capabilities",
      "displayName",
      "generatorVersion",
      "options",
      "schemaVersion",
      "seed",
      "worksheetType",
    ]);
    expect(Object.keys(request.options).sort()).toEqual([
      "includeAnswerKey",
      "includeDecorativeGraphics",
      "length",
      "paperSize",
      "printScale",
    ]);
    expect(request).not.toHaveProperty("topicIds");
    expect(request.options.includeDecorativeGraphics).toBe(false);
    expect(request.capabilities.mathSkills.allowRegrouping).toBe(false);
    expect(request.capabilities.mathSkills.allowNegativeResults).toBe(false);
    expect(JSON.stringify(request)).not.toContain("Unreviewed Distinctive Topic");
  });

  test("omits a disabled nickname instead of copying an empty value", () => {
    const request = requestFor(selectionFor("dry-math", { useDisplayName: false }));
    expect(request).not.toHaveProperty("displayName");
    expect(JSON.stringify(request)).not.toContain("Distinctive Nickname");
  });

  test("a child-free probe projects no nickname and no topics", () => {
    const selection = selectionFor("sentence-builder", {
      useDisplayName: true,
      useInterests: true,
    });
    const probe = projectGenerationRequest({ selection, generatorVersion: 1, seed: "00000001" });
    expect(probe.ok).toBe(true);
    if (!probe.ok) {
      return;
    }
    expect(probe.request).not.toHaveProperty("displayName");
    expect(probe.request).not.toHaveProperty("topicIds");
    // Mirror: the same selection with the child carries both.
    expect(requestFor(selection)).toMatchObject({
      displayName: "Distinctive Nickname",
      topicIds: ["space"],
    });
  });

  test("canonicalizes Sentence Builder controls that are hidden by writing activity", () => {
    const request = requestFor(
      selectionFor("sentence-builder", {
        sentenceBuilder: { variant: "copy-with-model", vocabulary: "all-words" },
        length: "long",
        includeAnswerKey: true,
      }),
    );
    expect(request.options).toMatchObject({
      length: "standard",
      includeAnswerKey: false,
      includeDecorativeGraphics: true,
    });
    expect(request.topicIds).toEqual(["space"]);
  });

  test.each(WORKSHEET_TYPE_IDS)(
    '"difficulty" is absent from the %s request options',
    (worksheetType) => {
      const request = requestFor(selectionFor(worksheetType));
      expect("difficulty" in request.options).toBe(false);
    },
  );
});

describe("the practice focus reaches the request exactly", () => {
  test.each(PRACTICE_FOCUS_CATALOG["dry-math"].map((option) => [option.label, option.focus] as const))(
    "Dry Math %s projects its exact operations, operand and result maxima",
    (_label, focus) => {
      const skills = requestFor(selectionFor("dry-math", { dryMath: focus })).capabilities
        .mathSkills;
      expect({
        operations: skills.operations,
        operandMax: skills.operandMax,
        resultMax: skills.resultMax,
      }).toEqual(focus);
    },
  );

  test.each(
    PRACTICE_FOCUS_CATALOG["find-the-wow-equation"].map(
      (option) => [option.label, option.focus] as const,
    ),
  )("Two Whats and a Wow Equations %s projects its exact focus", (_label, focus) => {
    const skills = requestFor(
      selectionFor("find-the-wow", {
        findTheWow: { ...baseSelection.findTheWow, variant: "equation", equation: focus },
      }),
    ).capabilities.mathSkills;
    expect({
      operations: skills.operations,
      operandMax: skills.operandMax,
      resultMax: skills.resultMax,
    }).toEqual(focus);
  });

  test.each(
    PRACTICE_FOCUS_CATALOG["find-the-wow-quantity"].map(
      (option) => [option.label, option.focus] as const,
    ),
  )("Two Whats and a Wow Quantity pictures %s projects its exact counting and numerals", (_label, focus) => {
    const skills = requestFor(
      selectionFor("find-the-wow", {
        findTheWow: { ...baseSelection.findTheWow, variant: "quantity", quantity: focus },
      }),
    ).capabilities.mathSkills;
    expect({ countingMax: skills.countingMax, numeralMax: skills.numeralMax }).toEqual(focus);
  });

  test.each(
    PRACTICE_FOCUS_CATALOG["count-compare-make"].map(
      (option) => [option.label, option.focus] as const,
    ),
  )("Count, Compare & Make %s projects its exact counting, numeral and compare maxima", (_label, focus) => {
    const skills = requestFor(
      selectionFor("count-compare-make", { countCompareMake: focus }),
    ).capabilities.mathSkills;
    expect({
      countingMax: skills.countingMax,
      numeralMax: skills.numeralMax,
      compareMax: skills.compareMax,
    }).toEqual(focus);
  });

  test("within 100 projects 100 and 100, with no value scaled", () => {
    const within100 = PRACTICE_FOCUS_CATALOG["dry-math"].find(
      (option) => option.focus.operandMax === DRY_MATH_NUMERIC_MAXIMUM,
    );
    expect(within100?.label).toBe(`Addition and subtraction within ${DRY_MATH_NUMERIC_MAXIMUM}`);
    const skills = requestFor(selectionFor("dry-math", { dryMath: within100!.focus }))
      .capabilities.mathSkills;
    expect([skills.operandMax, skills.resultMax]).toEqual([
      DRY_MATH_NUMERIC_MAXIMUM,
      DRY_MATH_NUMERIC_MAXIMUM,
    ]);
  });

  test("each family's capabilities follow the exact projected-capability table", () => {
    const equation: ArithmeticFocusV2 = { operations: ["subtraction"], operandMax: 7, resultMax: 5 };
    const selection: WorksheetSelectionV2 = {
      ...baseSelection,
      dryMath: { operations: ["addition"], operandMax: 30, resultMax: 40 },
      findTheWow: { variant: "equation", quantity: { countingMax: 3, numeralMax: 4 }, equation },
      countCompareMake: { countingMax: 6, numeralMax: 8, compareMax: 9 },
      sentenceBuilder: { variant: "independent", vocabulary: "all-words" },
    };
    const inactive = { ...INACTIVE_MATH_FIELDS };
    expect(projectWorksheetCapabilities(selection, "dry-math")).toEqual({
      ...INACTIVE_WRITING_CAPABILITIES,
      mathSkills: {
        ...inactive,
        representations: ["equations"],
        understandsEquality: false,
        operations: ["addition"],
        operandMax: 30,
        resultMax: 40,
      },
    });
    expect(projectWorksheetCapabilities(selection, "find-the-wow")).toEqual({
      ...INACTIVE_WRITING_CAPABILITIES,
      mathSkills: {
        ...inactive,
        representations: ["equations"],
        understandsEquality: true,
        ...equation,
      },
    });
    expect(
      projectWorksheetCapabilities(
        { ...selection, findTheWow: { ...selection.findTheWow, variant: "quantity" } },
        "find-the-wow",
      ),
    ).toEqual({
      ...INACTIVE_WRITING_CAPABILITIES,
      mathSkills: {
        ...inactive,
        representations: ["quantities"],
        understandsEquality: false,
        countingMax: 3,
        numeralMax: 4,
      },
    });
    expect(projectWorksheetCapabilities(selection, "count-compare-make")).toEqual({
      ...INACTIVE_WRITING_CAPABILITIES,
      mathSkills: {
        ...inactive,
        representations: ["quantities"],
        countingMax: 6,
        numeralMax: 8,
        compareMax: 9,
      },
    });
    expect(projectWorksheetCapabilities(selection, "sentence-builder")).toEqual({
      presentationBand: "early-primary",
      writingMode: "independent",
      mathSkills: inactive,
    });
  });

  test("the inactive pins are the quantities-to-10 shape and the default Sentence choices", () => {
    const source = MATH_PRESETS["quantities-to-10"].mathSkills;
    expect(INACTIVE_MATH_FIELDS).toEqual({ ...source });
    expect(INACTIVE_WRITING_CAPABILITIES).toEqual({
      presentationBand:
        VOCABULARY_PRESENTATION_BANDS[DEFAULT_WORKSHEET_DEFAULTS_V2.sentenceBuilder.vocabulary],
      writingMode: DEFAULT_WORKSHEET_DEFAULTS_V2.sentenceBuilder.variant,
    });
    expect(INACTIVE_WRITING_CAPABILITIES).toEqual({
      presentationBand: "preschool",
      writingMode: "label",
    });
  });
});

describe("the Statements variant and the Sentence choices", () => {
  test("for the same child, Quantity pictures yields only quantity items and Equations only equation items", () => {
    for (const variant of FIND_THE_WOW_VARIANTS) {
      const request = requestFor(
        selectionFor("find-the-wow", {
          findTheWow: { ...baseSelection.findTheWow, variant },
        }),
      );
      const items = itemsFor(request) as readonly { readonly mode: string }[];
      expect(Array.isArray(items), variant).toBe(true);
      expect(items.length, variant).toBeGreaterThan(0);
      expect(new Set(items.map((item) => item.mode)), variant).toEqual(new Set([variant]));
    }
  });

  test("the five Sentence variants differ only in writingMode and canonical length", () => {
    const requests = WRITING_MODES.map((variant) =>
      requestFor(
        selectionFor("sentence-builder", {
          sentenceBuilder: { variant, vocabulary: "simpler-words" },
          length: "long",
        }),
      ),
    );
    const normalized = requests.map((request) => ({
      ...request,
      capabilities: { ...request.capabilities, writingMode: "label" },
      options: { ...request.options, length: "long" },
    }));
    for (const request of normalized) {
      expect(request).toEqual(normalized[0]);
    }
    expect(requests.map((request) => request.capabilities.writingMode)).toEqual([
      ...WRITING_MODES,
    ]);
    expect(requests.map((request) => request.options.length)).toEqual([
      "standard",
      "long",
      "standard",
      "long",
      "long",
    ]);
  });

  test("simpler-words maps to the preschool band and all-words to early-primary", () => {
    const bands = SENTENCE_VOCABULARY_OPTIONS.map(
      (vocabulary) =>
        requestFor(
          selectionFor("sentence-builder", {
            sentenceBuilder: { variant: "label", vocabulary },
          }),
        ).capabilities.presentationBand,
    );
    expect(bands).toEqual(["preschool", "early-primary"]);
  });
});

/** Any schema-valid arithmetic focus up to a ceiling. */
function arithmeticFocusArbitrary(ceiling: number): fc.Arbitrary<ArithmeticFocusV2> {
  return fc.record({
    operations: fc.constantFrom<ArithmeticFocusV2["operations"]>(
      ["addition"],
      ["subtraction"],
      [...MATH_OPERATIONS],
    ),
    operandMax: fc.integer({ min: 1, max: ceiling }),
    resultMax: fc.integer({ min: 1, max: ceiling }),
  });
}

const quantityMaximum = fc.integer({ min: 1, max: V1_NUMERIC_MAXIMUM });

/** Any schema-valid worksheet selection. */
const selectionArbitrary: fc.Arbitrary<WorksheetSelectionV2> = fc.record({
  worksheetType: fc.constantFrom(...WORKSHEET_TYPE_IDS),
  dryMath: arithmeticFocusArbitrary(DRY_MATH_NUMERIC_MAXIMUM),
  findTheWow: fc.record({
    variant: fc.constantFrom(...FIND_THE_WOW_VARIANTS),
    quantity: fc.record({ countingMax: quantityMaximum, numeralMax: quantityMaximum }),
    equation: arithmeticFocusArbitrary(V1_NUMERIC_MAXIMUM),
  }),
  sentenceBuilder: fc.record({
    variant: fc.constantFrom(...WRITING_MODES),
    vocabulary: fc.constantFrom(...SENTENCE_VOCABULARY_OPTIONS),
  }),
  countCompareMake: fc.record({
    countingMax: quantityMaximum,
    numeralMax: quantityMaximum,
    compareMax: quantityMaximum,
  }),
  theme: fc.constantFrom(...THEME_CHOICES),
  useDisplayName: fc.boolean(),
  useInterests: fc.boolean(),
  includeDecorativeGraphics: fc.boolean(),
  includeAnswerKey: fc.boolean(),
  length: fc.constantFrom(...WORKSHEET_LENGTHS),
  paperSize: fc.constantFrom(...PAPER_SIZES),
  printScale: fc.constantFrom(...PRINT_SCALES),
});

/**
 * `target` with every field family `worksheetType` reads copied from
 * `source`: its own focus (and variant), the layout and the personalization
 * its request carries. Every other field keeps `target`'s value.
 */
function withOwnFields(
  worksheetType: Exclude<WorksheetType, "sentence-builder">,
  source: WorksheetSelectionV2,
  target: WorksheetSelectionV2,
): WorksheetSelectionV2 {
  const shared = {
    worksheetType,
    useDisplayName: source.useDisplayName,
    includeAnswerKey: source.includeAnswerKey,
    length: source.length,
    paperSize: source.paperSize,
    printScale: source.printScale,
  };
  switch (worksheetType) {
    case "dry-math":
      return { ...target, ...shared, dryMath: source.dryMath };
    case "find-the-wow":
      return {
        ...target,
        ...shared,
        findTheWow: {
          ...target.findTheWow,
          variant: source.findTheWow.variant,
          ...(source.findTheWow.variant === "equation"
            ? { equation: source.findTheWow.equation }
            : { quantity: source.findTheWow.quantity }),
        },
      };
    case "count-compare-make":
      // The Theme is read only while decoration is on; with it off the
      // target's theme stays, so the property also varies it there.
      return {
        ...target,
        ...shared,
        countCompareMake: source.countCompareMake,
        includeDecorativeGraphics: source.includeDecorativeGraphics,
        ...(source.includeDecorativeGraphics ? { theme: source.theme } : {}),
      };
  }
}

const NON_SENTENCE_FAMILIES = ["dry-math", "find-the-wow", "count-compare-make"] as const;

describe("another family's choices never change a request (U7)", () => {
  test("varying inactive fields, other families' focus, inapplicable controls and the Sentence choices leaves every non-Sentence request and its items unchanged", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_SENTENCE_FAMILIES),
        selectionArbitrary,
        selectionArbitrary,
        fc.constantFrom(...WRITING_MODES),
        fc.constantFrom(...SENTENCE_VOCABULARY_OPTIONS),
        (family, source, noise, sentenceVariant, vocabulary) => {
          const chosen = withOwnFields(family, source, source);
          const varied = withOwnFields(family, source, {
            ...noise,
            sentenceBuilder: { variant: sentenceVariant, vocabulary },
          });
          const left = requestFor(chosen);
          const right = requestFor(varied);
          expect(right).toEqual(left);
          expect(left.capabilities.presentationBand).toBe(
            INACTIVE_WRITING_CAPABILITIES.presentationBand,
          );
          expect(left.capabilities.writingMode).toBe(INACTIVE_WRITING_CAPABILITIES.writingMode);
          expect(itemsFor(right)).toEqual(itemsFor(left));
        },
      ),
      { numRuns: 200 },
    );
  });

  test.each(NON_SENTENCE_FAMILIES)(
    "mirror: a different %s focus with the same seed changes the items",
    (family) => {
      const narrow = withOwnFields(family, {
        ...baseSelection,
        dryMath: PRACTICE_FOCUS_CATALOG["dry-math"][1]!.focus,
        findTheWow: {
          ...baseSelection.findTheWow,
          variant: "equation",
          equation: PRACTICE_FOCUS_CATALOG["find-the-wow-equation"][1]!.focus,
        },
        countCompareMake: PRACTICE_FOCUS_CATALOG["count-compare-make"][0]!.focus,
      }, baseSelection);
      const wide = withOwnFields(family, {
        ...baseSelection,
        dryMath: PRACTICE_FOCUS_CATALOG["dry-math"][2]!.focus,
        findTheWow: {
          ...baseSelection.findTheWow,
          variant: "equation",
          equation: PRACTICE_FOCUS_CATALOG["find-the-wow-equation"][2]!.focus,
        },
        countCompareMake: PRACTICE_FOCUS_CATALOG["count-compare-make"][1]!.focus,
      }, baseSelection);
      expect(requestFor(wide)).not.toEqual(requestFor(narrow));
      expect(itemsFor(requestFor(wide))).not.toEqual(itemsFor(requestFor(narrow)));
    },
  );
});

describe("the child only personalizes", () => {
  const otherChild: ChildProfileV2 = profileWithLegacyChoices({
    id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    displayName: "Distinctive Nickname",
    presentationBand: "preschool",
    reviewedOn: "2026-09-01",
    mathSkills: {
      countingMax: 3,
      numeralMax: 3,
      compareMax: 3,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "draw-and-tell",
    interests: ["space", "Unreviewed Distinctive Topic"],
  });

  test.each(WORKSHEET_TYPE_IDS)(
    "two children with different earlier settings but the same nickname and interests project the same %s request",
    (worksheetType) => {
      expect(requestFor(selectionFor(worksheetType), otherChild)).toEqual(
        requestFor(selectionFor(worksheetType), child),
      );
    },
  );

  test("a child without earlier settings projects the same request as one with them", () => {
    const { legacyChoices: _unused, ...identityOnly } = child;
    void _unused;
    for (const worksheetType of WORKSHEET_TYPE_IDS) {
      expect(requestFor(selectionFor(worksheetType), identityOnly), worksheetType).toEqual(
        requestFor(selectionFor(worksheetType), child),
      );
    }
  });

  const CONCRETE_PRESETS = MATH_PRESET_IDS.filter(
    (presetId): presetId is Exclude<typeof presetId, "custom"> => presetId !== "custom",
  );

  test.each(CONCRETE_PRESETS)(
    "a migrated v1 child at preset %s projects its preset values through its earlier settings",
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
      }).profiles[0]!;
      const seeded = selectionFromEarlierSettings(migrated.legacyChoices!, baseSelection).selection;
      const skills = v1Profile.mathSkills;
      const hasEquations = skills.representations.includes("equations") && skills.operations.length > 0;
      const dryMath = requestFor({ ...seeded, worksheetType: "dry-math" }, migrated).capabilities
        .mathSkills;
      expect([dryMath.operations, dryMath.operandMax, dryMath.resultMax]).toEqual(
        hasEquations
          ? [skills.operations, skills.operandMax, skills.resultMax]
          : [baseSelection.dryMath.operations, baseSelection.dryMath.operandMax, baseSelection.dryMath.resultMax],
      );
      const countCompare = requestFor({ ...seeded, worksheetType: "count-compare-make" }, migrated)
        .capabilities.mathSkills;
      expect([countCompare.countingMax, countCompare.numeralMax, countCompare.compareMax]).toEqual([
        Math.min(skills.countingMax, V1_NUMERIC_MAXIMUM),
        Math.min(skills.numeralMax, V1_NUMERIC_MAXIMUM),
        Math.min(skills.compareMax, V1_NUMERIC_MAXIMUM),
      ]);
      const sentence = requestFor({ ...seeded, worksheetType: "sentence-builder" }, migrated)
        .capabilities;
      expect([sentence.presentationBand, sentence.writingMode]).toEqual([
        v1Profile.presentationBand,
        v1Profile.writingMode,
      ]);
    },
  );
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
 * emits one that was never reviewed). The sweeps drive Sentence Builder, the
 * one family whose request carries `topicIds`.
 */
describe("reviewed-topic allowlist", () => {
  function topicsFor(
    interest: string,
    worksheetType: WorksheetType = "sentence-builder",
  ): readonly TopicId[] {
    return requestFor(selectionFor(worksheetType), { ...child, interests: [interest] })
      .topicIds ?? [];
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
    // The sweeps above drive Sentence Builder only. This runs the SAME
    // boundary once per declared worksheet type with a reviewed interest and
    // pins, per family, whether `topicIds` travel at all. Adding a family to
    // `worksheetUsesInterests` or dropping one out of it fails here, and so
    // does declaring a fifth family without deciding.
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
      "count-compare-make": [],
    });
  });
});

/** The three Theme kinds the resolution table crosses: one of each. */
const THEME_KINDS = ["from-interests", "space", "neutral"] as const;

/**
 * The three interest shapes: reviewed matches after an unmatched tag, only
 * unmatched free text, none. The first reviewed match is declared and sorts
 * after the second, so only profile order picks it.
 */
const INTEREST_CASES = {
  firstMatching: ["dinosaurs", "vehicles", "Nature"],
  onlyUnmatched: ["dinosaurs"],
  none: [],
} as const satisfies Record<string, readonly string[]>;

type InterestCase = keyof typeof INTEREST_CASES;

/**
 * The decorative topic each family's request carries with decoration on, per
 * Theme and interest shape, whether "Use reviewed interests" is on or off;
 * `undefined` means the field is absent. Written out rather than derived, so
 * it states the resolution independently of the projector.
 */
const DECORATED_TOPIC: Readonly<
  Record<
    WorksheetType,
    Readonly<Record<(typeof THEME_KINDS)[number], Readonly<Record<InterestCase, TopicId | undefined>>>>
  >
> = {
  "dry-math": {
    "from-interests": { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
    space: { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
    neutral: { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
  },
  "find-the-wow": {
    "from-interests": { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
    space: { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
    neutral: { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
  },
  "sentence-builder": {
    "from-interests": { firstMatching: undefined, onlyUnmatched: undefined, none: undefined },
    space: { firstMatching: "space", onlyUnmatched: "space", none: "space" },
    neutral: { firstMatching: "neutral", onlyUnmatched: "neutral", none: "neutral" },
  },
  "count-compare-make": {
    "from-interests": { firstMatching: "vehicles", onlyUnmatched: "neutral", none: "neutral" },
    space: { firstMatching: "space", onlyUnmatched: "space", none: "space" },
    neutral: { firstMatching: "neutral", onlyUnmatched: "neutral", none: "neutral" },
  },
};

function themedRequest(
  worksheetType: WorksheetType,
  theme: WorksheetSelectionV2["theme"],
  interests: readonly string[],
  includeDecorativeGraphics: boolean,
  useInterests = true,
  seed = "00000001",
): GenerationRequestV1 {
  return requestFor(
    selectionFor(worksheetType, { theme, includeDecorativeGraphics, useInterests }),
    { ...child, interests: [...interests] },
    seed,
  );
}

describe("the decorative Theme", () => {
  test("resolves to the exact decorative topic, or none, for every family, Theme, interest shape, interests choice and decoration state", () => {
    let carried = 0;
    for (const worksheetType of WORKSHEET_TYPE_IDS) {
      for (const theme of THEME_KINDS) {
        for (const interestCase of Object.keys(INTEREST_CASES) as InterestCase[]) {
          for (const useInterests of [true, false]) {
            for (const decoration of [true, false]) {
              const label = `${worksheetType}/${theme}/${interestCase}/interests ${String(useInterests)}/decoration ${String(decoration)}`;
              const request = themedRequest(
                worksheetType,
                theme,
                INTEREST_CASES[interestCase],
                decoration,
                useInterests,
              );
              // The interests choice never moves the decorative topic.
              const expected = decoration
                ? DECORATED_TOPIC[worksheetType][theme][interestCase]
                : undefined;
              if (expected === undefined) {
                expect(request.options, label).not.toHaveProperty("decorativeTopicId");
              } else {
                carried += 1;
                expect(request.options.decorativeTopicId, label).toBe(expected);
              }
              // Only Sentence Builder's instructional topics follow the interests choice.
              if (
                worksheetType === "sentence-builder" &&
                useInterests &&
                interestCase === "firstMatching"
              ) {
                expect(request.topicIds, label).toEqual(["vehicles", "nature"]);
              } else {
                expect(request, label).not.toHaveProperty("topicIds");
              }
              // Unmatched free text never enters any request, in any field.
              expect(JSON.stringify(request).toLowerCase(), label).not.toContain("dinosaurs");
            }
          }
        }
      }
    }
    // Non-vacuity: the table really sends a decorative topic somewhere.
    expect(carried).toBe(30);
  });

  test("with decoration off, no Theme changes any family's request", () => {
    for (const worksheetType of WORKSHEET_TYPE_IDS) {
      const requests = THEME_CHOICES.map((theme) =>
        themedRequest(worksheetType, theme, INTEREST_CASES.firstMatching, false),
      );
      for (const [index, request] of requests.entries()) {
        expect(request.options, `${worksheetType}/${THEME_CHOICES[index]}`).not.toHaveProperty(
          "decorativeTopicId",
        );
        expect(request, `${worksheetType}/${THEME_CHOICES[index]}`).toEqual(requests[0]);
      }
    }
    // Mirror: with decoration on, the same Theme sweep does move a decorating
    // family's request.
    const decorated = THEME_CHOICES.map(
      (theme) =>
        themedRequest("count-compare-make", theme, INTEREST_CASES.firstMatching, true).options
          .decorativeTopicId,
    );
    expect(new Set(decorated).size).toBeGreaterThan(1);
  });

  test("Dry Math and Two Whats and a Wow never carry a decorative topic under any Theme", () => {
    for (const worksheetType of ["dry-math", "find-the-wow"] as const) {
      for (const theme of THEME_CHOICES) {
        for (const decoration of [true, false]) {
          const request = themedRequest(
            worksheetType,
            theme,
            INTEREST_CASES.firstMatching,
            decoration,
          );
          expect(request.options, `${worksheetType}/${theme}`).not.toHaveProperty(
            "decorativeTopicId",
          );
        }
      }
    }
  });

  test.each(["sentence-builder", "count-compare-make"] as const)(
    "%s: for a fixed seed every Theme yields the same content key, and another seed changes it",
    (worksheetType) => {
      const keysFor = (seed: string): readonly string[] =>
        THEME_CHOICES.map((theme) => {
          const request = themedRequest(
            worksheetType,
            theme,
            INTEREST_CASES.firstMatching,
            true,
            true,
            seed,
          );
          const result = getWorksheetRegistration(worksheetType).generate(request, {
            worksheetId: "11111111-1111-4111-8111-111111111111",
          });
          if (!result.ok) {
            throw new Error(result.message);
          }
          return canonicalContentKey(result.document.items);
        });
      const fixed = keysFor("00000001");
      expect(fixed).toHaveLength(THEME_CHOICES.length);
      expect(new Set(fixed).size).toBe(1);
      // Non-vacuity: the Themes really produced different requests.
      expect(
        new Set(
          THEME_CHOICES.map(
            (theme) =>
              themedRequest(worksheetType, theme, INTEREST_CASES.firstMatching, true).options
                .decorativeTopicId,
          ),
        ).size,
      ).toBeGreaterThan(1);
      // Mirror: a different seed changes the content.
      const other = keysFor("0000002a");
      expect(new Set(other).size).toBe(1);
      expect(other[0]).not.toBe(fixed[0]);
    },
  );
});
