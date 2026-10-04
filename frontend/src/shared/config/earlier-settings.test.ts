import { describe, expect, test } from "vitest";

import { getWorksheetRegistration } from "../worksheet/registry.js";
import { DRY_MATH_NUMERIC_MAXIMUM, V1_NUMERIC_MAXIMUM } from "../worksheet/types.js";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "./defaults.js";
import {
  CapabilityProfileV1Schema,
  describeEarlierSettingDisclosure,
  profileWithLegacyChoices,
  selectionForChild,
  selectionFromEarlierSettings,
  type EarlierSettingDisclosure,
} from "./earlier-settings.js";
import {
  ChildProfileV2Schema,
  WorksheetSelectionV2Schema,
  type LegacyChoicesV2,
  type MathSkillsV1,
  type WorksheetSelectionV2,
} from "./schema.js";

/*
 * Appendix B.3, reproduced over fictional earlier settings built at runtime.
 * Each case names the groups it expects the mapping to cover and the exact
 * disclosures it expects, so a mapping that seeds an extra group, misses one,
 * or clamps silently fails here.
 */

const BASE: WorksheetSelectionV2 = worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2);

const NO_SKILLS: MathSkillsV1 = {
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
};

function legacy(
  mathSkills: Partial<MathSkillsV1>,
  presentationBand: LegacyChoicesV2["presentationBand"] = "early-primary",
  writingMode: LegacyChoicesV2["writingMode"] = "sentence-frame",
): LegacyChoicesV2 {
  return { presentationBand, writingMode, mathSkills: { ...NO_SKILLS, ...mathSkills } };
}

function uniform(maximum: number): Partial<MathSkillsV1> {
  return {
    countingMax: maximum,
    numeralMax: maximum,
    compareMax: maximum,
    representations: ["quantities", "equations"],
    understandsEquality: true,
    operations: ["addition", "subtraction"],
    operandMax: maximum,
    resultMax: maximum,
  };
}

function clamped(
  group: Extract<EarlierSettingDisclosure, { kind: "clamped" }>["group"],
  field: Extract<EarlierSettingDisclosure, { kind: "clamped" }>["field"],
  stored: number,
  using: number,
): EarlierSettingDisclosure {
  return { kind: "clamped", group, field, stored, using };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

describe("selectionFromEarlierSettings (Appendix B.3)", () => {
  test("maxima of 50 keep Dry Math's range and clamp every other group to the Version 1 ceiling", () => {
    const result = selectionFromEarlierSettings(legacy(uniform(50)), BASE);
    const ceiling = V1_NUMERIC_MAXIMUM;
    expect(result.selection.dryMath).toEqual({
      operations: ["addition", "subtraction"],
      operandMax: 50,
      resultMax: 50,
    });
    expect(result.selection.findTheWow).toEqual({
      variant: "equation",
      quantity: { countingMax: ceiling, numeralMax: ceiling },
      equation: { operations: ["addition", "subtraction"], operandMax: ceiling, resultMax: ceiling },
    });
    expect(result.selection.countCompareMake).toEqual({
      countingMax: ceiling,
      numeralMax: ceiling,
      compareMax: ceiling,
    });
    expect(result.groups).toEqual([
      "dryMath",
      "findTheWow.variant",
      "findTheWow.quantity",
      "findTheWow.equation",
      "sentenceBuilder.variant",
      "sentenceBuilder.vocabulary",
      "countCompareMake",
    ]);
    expect(result.disclosures).toEqual([
      clamped("findTheWow.quantity", "countingMax", 50, ceiling),
      clamped("findTheWow.quantity", "numeralMax", 50, ceiling),
      clamped("findTheWow.equation", "operandMax", 50, ceiling),
      clamped("findTheWow.equation", "resultMax", 50, ceiling),
      clamped("countCompareMake", "countingMax", 50, ceiling),
      clamped("countCompareMake", "numeralMax", 50, ceiling),
      clamped("countCompareMake", "compareMax", 50, ceiling),
    ]);
  });

  test("maxima of 1,000 clamp Dry Math to its own ceiling as well", () => {
    const result = selectionFromEarlierSettings(legacy(uniform(1_000)), BASE);
    expect(result.selection.dryMath).toEqual({
      operations: ["addition", "subtraction"],
      operandMax: DRY_MATH_NUMERIC_MAXIMUM,
      resultMax: DRY_MATH_NUMERIC_MAXIMUM,
    });
    const clampedFields = result.disclosures.flatMap((disclosure) =>
      disclosure.kind === "clamped"
        ? [`${disclosure.group}.${disclosure.field} ${disclosure.stored}->${disclosure.using}`]
        : [],
    );
    expect(clampedFields).toEqual([
      `dryMath.operandMax 1000->${DRY_MATH_NUMERIC_MAXIMUM}`,
      `dryMath.resultMax 1000->${DRY_MATH_NUMERIC_MAXIMUM}`,
      `findTheWow.quantity.countingMax 1000->${V1_NUMERIC_MAXIMUM}`,
      `findTheWow.quantity.numeralMax 1000->${V1_NUMERIC_MAXIMUM}`,
      `findTheWow.equation.operandMax 1000->${V1_NUMERIC_MAXIMUM}`,
      `findTheWow.equation.resultMax 1000->${V1_NUMERIC_MAXIMUM}`,
      `countCompareMake.countingMax 1000->${V1_NUMERIC_MAXIMUM}`,
      `countCompareMake.numeralMax 1000->${V1_NUMERIC_MAXIMUM}`,
      `countCompareMake.compareMax 1000->${V1_NUMERIC_MAXIMUM}`,
    ]);
    expect(WorksheetSelectionV2Schema.safeParse(result.selection).success).toBe(true);
  });

  test("both permission flags are disclosed once each and never applied", () => {
    const result = selectionFromEarlierSettings(
      legacy({ ...uniform(10), allowRegrouping: true, allowNegativeResults: true }),
      BASE,
    );
    expect(result.disclosures).toEqual([
      { kind: "unused-permission", field: "allowRegrouping" },
      { kind: "unused-permission", field: "allowNegativeResults" },
    ]);
    expect(JSON.stringify(result.selection)).not.toMatch(/allowRegrouping|allowNegativeResults/u);
    // Mirror: without the flags nothing is disclosed.
    expect(selectionFromEarlierSettings(legacy(uniform(10)), BASE).disclosures).toEqual([]);
  });

  test("a stored allowRegrouping never turns on carrying and borrowing", () => {
    const result = selectionFromEarlierSettings(
      legacy({ ...uniform(100), allowRegrouping: true }),
      BASE,
    );
    expect(BASE.dryMathRegrouping).toBe("without");
    expect(result.selection.dryMathRegrouping).toBe("without");
    expect(result.groups).not.toContain("dryMathRegrouping");
    expect(result.disclosures).toContainEqual({
      kind: "unused-permission",
      field: "allowRegrouping",
    });
    // The choice belongs to the parent: a base that already holds it keeps it,
    // whatever the earlier settings store.
    const chosen = selectionFromEarlierSettings(
      legacy({ ...uniform(100), allowRegrouping: false }),
      { ...BASE, dryMathRegrouping: "required" },
    );
    expect(chosen.selection.dryMathRegrouping).toBe("required");
  });

  test("earlier settings never set the Dry Math strand or the fact families", () => {
    const base = {
      ...BASE,
      dryMathStrand: "multiply-divide" as const,
      dryMathFacts: { operations: ["division" as const], factFamilies: [0, 12] },
    };
    const result = selectionFromEarlierSettings(legacy(uniform(100)), base);
    expect(result.selection.dryMathStrand).toBe("multiply-divide");
    expect(result.selection.dryMathFacts).toEqual({ operations: ["division"], factFamilies: [0, 12] });
    expect(result.groups).not.toContain("dryMathStrand");
    expect(result.groups).not.toContain("dryMathFacts");
    // Mirror: the add-subtract focus those same settings describe is seeded.
    expect(result.groups).toContain("dryMath");
  });

  test("emerging within 5 with the preschool band seeds addition within 5, Quantity pictures and simpler words", () => {
    const result = selectionFromEarlierSettings(
      legacy(
        {
          representations: ["quantities", "equations"],
          understandsEquality: false,
          operations: ["addition"],
          operandMax: 5,
          resultMax: 5,
        },
        "preschool",
        "label",
      ),
      BASE,
    );
    const withinFive = { operations: ["addition"], operandMax: 5, resultMax: 5 };
    expect(result.selection.dryMath).toEqual(withinFive);
    expect(result.selection.findTheWow).toEqual({
      variant: "quantity",
      quantity: { countingMax: 10, numeralMax: 10 },
      equation: withinFive,
    });
    expect(result.selection.sentenceBuilder).toEqual({
      variant: "label",
      vocabulary: "simpler-words",
    });
    expect(result.disclosures).toEqual([]);
  });

  test("equations only seed the arithmetic groups and Equations, and leave the quantity groups at the base", () => {
    const result = selectionFromEarlierSettings(
      legacy({ ...uniform(10), representations: ["equations"], countingMax: 3 }),
      BASE,
    );
    expect(result.selection.findTheWow.variant).toBe("equation");
    expect(result.selection.findTheWow.quantity).toEqual(BASE.findTheWow.quantity);
    expect(result.selection.countCompareMake).toEqual(BASE.countCompareMake);
    expect(result.groups).toEqual([
      "dryMath",
      "findTheWow.variant",
      "findTheWow.equation",
      "sentenceBuilder.variant",
      "sentenceBuilder.vocabulary",
    ]);
  });

  test("equations with operations but without equality understanding take the base Wow variant, and Wow stays available", () => {
    const result = selectionFromEarlierSettings(
      legacy({
        representations: ["equations"],
        understandsEquality: false,
        operations: ["subtraction"],
        operandMax: 7,
        resultMax: 7,
      }),
      BASE,
    );
    // Neither the equation gate nor quantities: the saved default's variant.
    expect(result.groups).not.toContain("findTheWow.variant");
    expect(result.selection.findTheWow.variant).toBe(BASE.findTheWow.variant);
    expect(result.selection.findTheWow.equation).toEqual({
      operations: ["subtraction"],
      operandMax: 7,
      resultMax: 7,
    });
    // Version 1 refused Two Whats and a Wow for this child; now it is offered
    // through the Statements choice, under either variant.
    for (const variant of ["quantity", "equation"] as const) {
      const support = getWorksheetRegistration("find-the-wow").controls.getCapabilitySupport({
        selection: {
          ...result.selection,
          worksheetType: "find-the-wow",
          findTheWow: { ...result.selection.findTheWow, variant },
        },
      });
      expect(support.available, variant).toBe(true);
    }
  });

  test("a group without a source keeps the base value, and neither input is mutated", () => {
    const frozenBase = deepFreeze(worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2));
    const frozenLegacy = deepFreeze(legacy({}, "preschool", "draw-and-tell"));
    const result = selectionFromEarlierSettings(frozenLegacy, frozenBase);
    expect(result.selection.dryMath).toEqual(frozenBase.dryMath);
    expect(result.selection.dryMath).not.toBe(frozenBase.dryMath);
    expect(result.selection.findTheWow.equation).toEqual(frozenBase.findTheWow.equation);
    expect(result.selection.findTheWow.variant).toBe("quantity");
    expect(result.selection.sentenceBuilder).toEqual({
      variant: "draw-and-tell",
      vocabulary: "simpler-words",
    });
  });

  test("a defaults object as the base never carries its seeding flag into the selection", () => {
    const result = selectionFromEarlierSettings(legacy(uniform(10)), {
      ...DEFAULT_WORKSHEET_DEFAULTS_V2,
    });
    expect(result.selection).not.toHaveProperty("useEarlierChildSettings");
    expect(WorksheetSelectionV2Schema.safeParse(result.selection).success).toBe(true);
  });
});

describe("the disclosure sentences", () => {
  test("say what was stored and what is used", () => {
    expect(
      describeEarlierSettingDisclosure(clamped("dryMath", "operandMax", 150, DRY_MATH_NUMERIC_MAXIMUM)),
    ).toBe(`Dry Math operands: stored 150, using ${DRY_MATH_NUMERIC_MAXIMUM}.`);
    expect(
      describeEarlierSettingDisclosure(clamped("findTheWow.quantity", "numeralMax", 50, V1_NUMERIC_MAXIMUM)),
    ).toBe(`Two Whats and a Wow quantity pictures numerals: stored 50, using ${V1_NUMERIC_MAXIMUM}.`);
    expect(
      describeEarlierSettingDisclosure({ kind: "unused-permission", field: "allowRegrouping" }),
    ).toBe("Carrying and borrowing: stored but not used.");
    expect(
      describeEarlierSettingDisclosure({ kind: "unused-permission", field: "allowNegativeResults" }),
    ).toBe("Negative results: stored but not used.");
  });
});

describe("a child's starting selection", () => {
  const capabilities = CapabilityProfileV1Schema.parse({
    id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    displayName: "Fictional Kit",
    presentationBand: "preschool",
    reviewedOn: "2026-09-01",
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
    writingMode: "draw-and-tell",
    interests: ["trains", "Space"],
  });

  test("a child with earlier settings starts from their mapping, a child without them from the defaults", () => {
    const stored = profileWithLegacyChoices(capabilities);
    expect(selectionForChild(stored, BASE)).toEqual(
      selectionFromEarlierSettings(stored.legacyChoices!, BASE),
    );
    const { legacyChoices: _unused, ...identityOnly } = stored;
    void _unused;
    expect(selectionForChild(identityOnly, BASE)).toEqual({
      selection: BASE,
      groups: [],
      disclosures: [],
    });
    expect(selectionForChild(undefined, BASE).selection).toBe(BASE);
  });

  test("profileWithLegacyChoices keeps every capability verbatim and shares no array with its input", () => {
    const stored = profileWithLegacyChoices(capabilities);
    expect(ChildProfileV2Schema.parse(stored)).toEqual(stored);
    expect(stored.legacyChoices).toEqual({
      presentationBand: "preschool",
      writingMode: "draw-and-tell",
      mathSkills: capabilities.mathSkills,
    });
    capabilities.mathSkills.operations.push("addition");
    capabilities.interests.pop();
    expect(stored.legacyChoices?.mathSkills.operations).toEqual(["subtraction"]);
    expect(stored.interests).toEqual(["trains", "Space"]);
  });

  test("the capability schema refuses an age key", () => {
    expect(
      CapabilityProfileV1Schema.safeParse({ ...profileWithLegacyChoices(capabilities), ageYears: 6 })
        .success,
    ).toBe(false);
    expect(Object.keys(CapabilityProfileV1Schema.shape)).not.toContain("ageYears");
  });
});
