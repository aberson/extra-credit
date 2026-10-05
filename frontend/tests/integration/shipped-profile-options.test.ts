import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../src/shared/config/defaults.js";
import {
  profileWithLegacyChoices,
  selectionForChild,
  type CapabilityProfileV1,
} from "../../src/shared/config/earlier-settings.js";
import {
  NUMBER_BONDS_FOCUS_CATALOG,
  PRACTICE_FOCUS_CATALOG,
} from "../../src/shared/config/practice-focus.js";
import {
  NUMBER_BONDS_REGROUPING_MODES,
  PRINT_SCALES,
  SENTENCE_VOCABULARY_OPTIONS,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
  type ChildProfileV2,
  type WorksheetSelectionV2,
} from "../../src/shared/config/schema.js";
import { projectAndGenerateWorksheet } from "../../src/shared/worksheet/project-request.js";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
} from "../../src/shared/worksheet/registry.js";
import {
  FACT_FACTOR_MAXIMUM,
  NUMBER_BONDS_WHOLE_MINIMUM,
  V1_NUMERIC_MAXIMUM,
  type WorksheetType,
} from "../../src/shared/worksheet/types.js";
import {
  acceptanceConfig,
  isIdentityOnlyProfile,
  migratedV1FixtureConfig,
} from "../fixtures/profiles.js";

/*
 * The capacity guard for issue #14, run over the choices a parent is really
 * shipped rather than over fixtures written to pass: every catalog practice
 * focus and variant on the shipped defaults, the canonical children's earlier
 * settings from the permanent v1 fixture, and the two declared Earlier-setting
 * shortfall sources. In every cell the control's verdict and
 * the real generator must agree: offered exactly when it produces, and a
 * refusal's message exactly the generator's. The shipped example is repository
 * data, so this lives where a test may read it - the web project builds without
 * Node type or file access. `src/web/generator/options.test.tsx` runs the
 * control-level assertions.
 */

type Verdict =
  | { readonly offered: true }
  | { readonly offered: false; readonly message: string };

interface Cell {
  readonly where: string;
  readonly verdict: Verdict;
}

/**
 * The registration's verdict for one selection, checked against the real
 * generator on the same selection and child.
 */
function agreedVerdict(
  where: string,
  selection: WorksheetSelectionV2,
  profile: ChildProfileV2 | undefined,
): Verdict {
  const registration = getWorksheetRegistration(selection.worksheetType);
  const support = registration.controls.getCapabilitySupport({ selection });
  const generated = projectAndGenerateWorksheet(
    {
      ...(profile === undefined ? {} : { profile }),
      selection,
      generatorVersion: registration.generatorVersion,
      seed: "1234abcd",
    },
    registration.generate,
    { worksheetId: "77777777-7777-4777-8777-777777777777" },
  );
  const refusal = !support.available
    ? support.message
    : support.capacity.sufficient
      ? undefined
      : support.capacity.message;
  if (refusal === undefined) {
    expect(generated.ok ? "produced" : `${where}: ${generated.message}`).toBe("produced");
    return { offered: true };
  }
  expect(`${where}: ${generated.ok ? "produced" : generated.message}`).toBe(
    `${where}: ${refusal}`,
  );
  return { offered: false, message: refusal };
}

/** Every length and scale of one selection. */
function sweepLayouts(
  name: string,
  selection: WorksheetSelectionV2,
  profile: ChildProfileV2 | undefined,
): readonly Cell[] {
  return WORKSHEET_LENGTHS.flatMap((length) =>
    PRINT_SCALES.map((printScale) => {
      const where = `${name} ${length}/${printScale}`;
      return {
        where,
        verdict: agreedVerdict(where, { ...selection, length, printScale }, profile),
      };
    }),
  );
}

const base: WorksheetSelectionV2 = worksheetSelectionOf(acceptanceConfig.defaults);

/** One selection per catalog cell: focus x family x variant x vocabulary. */
const CATALOG_CELLS: readonly { readonly name: string; readonly selection: WorksheetSelectionV2 }[] = [
  ...PRACTICE_FOCUS_CATALOG["dry-math"].map((option) => ({
    name: `dry-math ${option.id}`,
    selection: { ...base, worksheetType: "dry-math" as const, dryMath: option.focus },
  })),
  ...PRACTICE_FOCUS_CATALOG["find-the-wow-quantity"].map((option) => ({
    name: `find-the-wow quantity ${option.id}`,
    selection: {
      ...base,
      worksheetType: "find-the-wow" as const,
      findTheWow: { ...base.findTheWow, variant: "quantity" as const, quantity: option.focus },
    },
  })),
  ...PRACTICE_FOCUS_CATALOG["find-the-wow-equation"].map((option) => ({
    name: `find-the-wow equation ${option.id}`,
    selection: {
      ...base,
      worksheetType: "find-the-wow" as const,
      findTheWow: { ...base.findTheWow, variant: "equation" as const, equation: option.focus },
    },
  })),
  ...PRACTICE_FOCUS_CATALOG["count-compare-make"].map((option) => ({
    name: `count-compare-make ${option.id}`,
    selection: {
      ...base,
      worksheetType: "count-compare-make" as const,
      countCompareMake: option.focus,
    },
  })),
  ...WRITING_MODES.flatMap((variant) =>
    SENTENCE_VOCABULARY_OPTIONS.map((vocabulary) => ({
      name: `sentence-builder ${variant} ${vocabulary}`,
      selection: {
        ...base,
        worksheetType: "sentence-builder" as const,
        sentenceBuilder: { variant, vocabulary },
      },
    })),
  ),
  ...NUMBER_BONDS_FOCUS_CATALOG.flatMap((option) =>
    NUMBER_BONDS_REGROUPING_MODES.map((regrouping) => ({
      name: `number-bonds ${option.id} ${regrouping}`,
      selection: {
        ...base,
        worksheetType: "number-bonds" as const,
        numberBonds: { ...option.focus, regrouping },
      },
    })),
  ),
];

/** A fictional child built at runtime, carrying only the given earlier settings. */
function earlierSettingsChild(
  id: string,
  mathSkills: CapabilityProfileV1["mathSkills"],
): ChildProfileV2 {
  return profileWithLegacyChoices({
    id,
    displayName: "Fictional Shortfall Child",
    presentationBand: "preschool",
    reviewedOn: "2026-09-01",
    mathSkills,
    writingMode: "label",
    interests: [],
  });
}

/** D34: addition with operand and result maxima of 1 - three facts. */
const D34_CHILD = earlierSettingsChild("d3400000-0000-4000-8000-000000000034", {
  countingMax: 10,
  numeralMax: 10,
  compareMax: 10,
  representations: ["quantities", "equations"],
  understandsEquality: false,
  operations: ["addition"],
  operandMax: 1,
  resultMax: 1,
  allowRegrouping: false,
  allowNegativeResults: false,
});

/** D36: quantities to 7 - seven Two Whats and a Wow stems. */
const D36_CHILD = earlierSettingsChild("d3600000-0000-4000-8000-000000000036", {
  countingMax: 7,
  numeralMax: 7,
  compareMax: 7,
  representations: ["quantities"],
  understandsEquality: false,
  operations: [],
  operandMax: 0,
  resultMax: 0,
  allowRegrouping: false,
  allowNegativeResults: false,
});

function childSelection(profile: ChildProfileV2, worksheetType: WorksheetType): WorksheetSelectionV2 {
  return { ...selectionForChild(profile, base).selection, worksheetType };
}

describe("the practice-focus catalog", () => {
  test("every catalog cell is offered exactly when the generator produces it, and none starves", () => {
    const cells = CATALOG_CELLS.flatMap(({ name, selection }) =>
      sweepLayouts(name, selection, acceptanceConfig.profiles[0]),
    );
    // Every catalog family, variant and vocabulary reached the sweep.
    expect(cells.length).toBe(CATALOG_CELLS.length * WORKSHEET_LENGTHS.length * PRINT_SCALES.length);
    expect(new Set(CATALOG_CELLS.map(({ selection }) => selection.worksheetType))).toEqual(
      new Set(REGISTERED_WORKSHEET_IDS),
    );
    // The pinned set of starving catalog cells. It is empty: every catalog
    // focus fills every length and scale, so the two shortfall sources below
    // are Earlier-setting values only (D34, D36).
    expect(cells.filter(({ verdict }) => !verdict.offered).map(({ where }) => where)).toEqual([]);
  });
});

describe("the declared Earlier-setting shortfall sources", () => {
  test("D34 starves Dry Math at every length and scale with the practice-focus remedy only, and the generator refuses", () => {
    const cells = sweepLayouts("D34 dry-math", childSelection(D34_CHILD, "dry-math"), D34_CHILD);
    expect(cells).toHaveLength(WORKSHEET_LENGTHS.length * PRINT_SCALES.length);
    for (const { where, verdict } of cells) {
      expect(`${where}: ${verdict.offered}`).toBe(`${where}: false`);
      if (!verdict.offered) {
        expect(verdict.message).toMatch(
          /^This practice focus provides 3 unique facts, but this length needs \d+\. Choose a practice focus with a wider results range\.$/u,
        );
        expect(verdict.message).not.toContain("shorter");
      }
    }
  });

  test("D36 refuses only Long at standard scale with the shorter-length remedy, and Standard fills six groups", () => {
    const selection = childSelection(D36_CHILD, "find-the-wow");
    expect(selection.findTheWow.variant).toBe("quantity");
    const cells = sweepLayouts("D36 find-the-wow", selection, D36_CHILD);
    expect(
      cells.filter(({ verdict }) => !verdict.offered).map(({ where, verdict }) => [
        where,
        verdict.offered ? "" : verdict.message,
      ]),
    ).toEqual([
      [
        "D36 find-the-wow long/standard",
        "This practice focus provides 7 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider counting and numerals range.",
      ],
    ]);
    const registration = getWorksheetRegistration("find-the-wow");
    const standard = projectAndGenerateWorksheet(
      {
        profile: D36_CHILD,
        selection: { ...selection, length: "standard", printScale: "standard" },
        generatorVersion: registration.generatorVersion,
        seed: "1234abcd",
      },
      registration.generate,
      { worksheetId: "77777777-7777-4777-8777-777777777777" },
    );
    expect(standard.ok && standard.document.items.length).toBe(6);
  });
});

describe("Every problem carries or borrows", () => {
  /** One cell per Dry Math catalog focus with carrying and borrowing required. */
  const requiredCells = PRACTICE_FOCUS_CATALOG["dry-math"].map((option) => ({
    name: `dry-math ${option.id} required`,
    selection: {
      ...base,
      worksheetType: "dry-math" as const,
      dryMath: option.focus,
      dryMathRegrouping: "required" as const,
    },
  }));

  test("availability equals generation for every catalog focus, and only addition within 5 starves", () => {
    const cells = requiredCells.flatMap(({ name, selection }) =>
      sweepLayouts(name, selection, acceptanceConfig.profiles[0]),
    );
    const refused = cells.filter(({ verdict }) => !verdict.offered);
    expect(refused.map(({ where }) => where)).toEqual(
      WORKSHEET_LENGTHS.flatMap((length) =>
        PRINT_SCALES.map((printScale) => `dry-math addition-within-5 required ${length}/${printScale}`),
      ),
    );
    for (const { where, verdict } of refused) {
      // No addition within 5 carries, lifting the result maximum is the one
      // widening that helps, no shorter length holds zero facts, and the same
      // focus without carrying or borrowing holds 21, which fills every length.
      expect(verdict.offered ? where : verdict.message).toMatch(
        /^This practice focus provides 0 unique facts, but this length needs \d+\. Choose a practice focus with a wider results range\. Choosing Without carrying or borrowing also fills this length\.$/u,
      );
    }
  });

  test("within 10 fills Long exactly at standard scale (18) and at large scale (12)", () => {
    const within10 = requiredCells.find(({ name }) =>
      name === "dry-math addition-and-subtraction-within-10 required",
    );
    if (within10 === undefined) {
      throw new Error("The within-10 catalog focus is missing.");
    }
    const registration = getWorksheetRegistration("dry-math");
    for (const [printScale, count] of [["standard", 18], ["large", 12]] as const) {
      const selection = { ...within10.selection, length: "long" as const, printScale };
      expect(agreedVerdict(`within 10 long/${printScale}`, selection, undefined)).toEqual({ offered: true });
      const generated = projectAndGenerateWorksheet(
        { selection, generatorVersion: registration.generatorVersion, seed: "1234abcd" },
        registration.generate,
        { worksheetId: "77777777-7777-4777-8777-777777777777" },
      );
      expect(generated.ok && generated.document.items.length).toBe(count);
    }
  });

  test("the D34 earlier setting under required names both maxima and no Without sentence", () => {
    const selection = { ...childSelection(D34_CHILD, "dry-math"), dryMathRegrouping: "required" as const };
    for (const { where, verdict } of sweepLayouts("D34 dry-math required", selection, D34_CHILD)) {
      // Three facts without carrying or borrowing fill no length, so that
      // choice is not offered as a remedy.
      expect(verdict.offered ? where : verdict.message).toMatch(
        /^This practice focus provides 0 unique facts, but this length needs \d+\. Choose a practice focus with a wider operands and results range\.$/u,
      );
    }
  });
});

describe("Multiplication and division facts", () => {
  /** One selection per fact entry and family set, on the shipped defaults. */
  const factsCell = (
    operations: readonly WorksheetSelectionV2["dryMathFacts"]["operations"][number][],
    factFamilies: readonly number[],
  ): WorksheetSelectionV2 => ({
    ...base,
    worksheetType: "dry-math",
    dryMathStrand: "multiply-divide",
    dryMathFacts: { operations: [...operations], factFamilies: [...factFamilies] },
  });

  test("availability equals generation for every fact entry with family 0 alone, the defaults and every family", () => {
    const everyFamily = Array.from({ length: FACT_FACTOR_MAXIMUM + 1 }, (_, family) => family);
    const cells = (
      [["multiplication"], ["division"], ["multiplication", "division"]] as const
    ).flatMap((operations) =>
      [[0], [2, 5, 10], everyFamily].flatMap((families) =>
        sweepLayouts(
          `facts ${operations.join("+")} {${families.join(",")}}`,
          factsCell(operations, families),
          acceptanceConfig.profiles[0],
        ),
      ),
    );
    // Division with family 0 alone is the only cell that falls short.
    expect(cells.filter(({ verdict }) => !verdict.offered).map(({ where }) => where)).toEqual([
      "facts division {0} long/standard",
    ]);
  });

  test("division with family 0 alone refuses Long at standard with the families-or-shorter remedy, and fills Standard and large Long exactly", () => {
    const registration = getWorksheetRegistration("dry-math");
    const refused = agreedVerdict(
      "division {0} long/standard",
      { ...factsCell(["division"], [0]), length: "long", printScale: "standard" },
      undefined,
    );
    expect(refused).toEqual({
      offered: false,
      message:
        "The chosen fact families give 12 unique facts, but this length needs 18. Choose more fact families, or a shorter length under More options.",
    });
    for (const [length, printScale] of [["standard", "standard"], ["long", "large"]] as const) {
      const selection = { ...factsCell(["division"], [0]), length, printScale };
      expect(agreedVerdict(`division {0} ${length}/${printScale}`, selection, undefined)).toEqual({
        offered: true,
      });
      const generated = projectAndGenerateWorksheet(
        { selection, generatorVersion: registration.generatorVersion, seed: "1234abcd" },
        registration.generate,
        { worksheetId: "77777777-7777-4777-8777-777777777777" },
      );
      // Exactly 0 ÷ 1 through 0 ÷ 12: the page holds every candidate.
      expect(generated.ok && generated.document.items.length).toBe(12);
    }
  });
});

describe("Number Bonds missing number sentences", () => {
  const OPERATION_CHOICES = [["addition"], ["subtraction"], ["addition", "subtraction"]] as const;

  /** One Number Bonds selection on the shipped defaults. */
  const bondsCell = (
    operations: readonly ("addition" | "subtraction")[],
    wholeMax: number,
    regrouping: WorksheetSelectionV2["numberBonds"]["regrouping"],
  ): WorksheetSelectionV2 => ({
    ...base,
    worksheetType: "number-bonds",
    numberBonds: { operations: [...operations], wholeMax, regrouping },
  });

  const RANGE_ONLY =
    /^This practice focus has \d+ unique problems, but this length needs \d+\. Choose a practice focus with a wider range\.$/u;

  test("availability equals generation for every largest whole, operation choice and carrying and borrowing choice", () => {
    const refused: string[] = [];
    for (const operations of OPERATION_CHOICES) {
      for (let wholeMax = NUMBER_BONDS_WHOLE_MINIMUM; wholeMax <= V1_NUMERIC_MAXIMUM; wholeMax += 1) {
        for (const regrouping of NUMBER_BONDS_REGROUPING_MODES) {
          const name = `${operations.join("+")} ${wholeMax} ${regrouping}`;
          for (const { where, verdict } of sweepLayouts(name, bondsCell(operations, wholeMax, regrouping), acceptanceConfig.profiles[0])) {
            if (!verdict.offered) {
              refused.push(where);
            }
          }
        }
      }
    }
    // Every shortfall lies at a largest whole of 4 or below, where both
    // carrying and borrowing choices hold the same problems.
    const expected = OPERATION_CHOICES.flatMap((operations) =>
      NUMBER_BONDS_REGROUPING_MODES.flatMap((regrouping) => {
        const name = (wholeMax: number) => `${operations.join("+")} ${wholeMax} ${regrouping}`;
        const everyLayout = (wholeMax: number) =>
          WORKSHEET_LENGTHS.flatMap((length) =>
            PRINT_SCALES.map((printScale) => `${name(wholeMax)} ${length}/${printScale}`),
          );
        return operations.length === 2
          ? [...everyLayout(2), `${name(3)} long/standard`]
          : [...everyLayout(2), ...everyLayout(3), `${name(4)} long/standard`];
      }),
    );
    expect(refused.sort()).toEqual(expected.sort());
  });

  test("one operation within 2 or 3 is refused at every length and scale with the range remedy only", () => {
    for (const operations of [["addition"], ["subtraction"]] as const) {
      for (const wholeMax of [2, 3]) {
        for (const regrouping of NUMBER_BONDS_REGROUPING_MODES) {
          const name = `${operations[0]} ${wholeMax} ${regrouping}`;
          const cells = sweepLayouts(name, bondsCell(operations, wholeMax, regrouping), undefined);
          expect(cells).toHaveLength(WORKSHEET_LENGTHS.length * PRINT_SCALES.length);
          for (const { where, verdict } of cells) {
            expect(verdict.offered ? `${where}: offered` : verdict.message).toMatch(RANGE_ONLY);
          }
        }
      }
    }
  });

  test("addition within 4 fills Short, fills Standard exactly, refuses Long at standard with the range-or-shorter remedy and fills large Long exactly", () => {
    const registration = getWorksheetRegistration("number-bonds");
    const items = (selection: WorksheetSelectionV2): number | false => {
      const generated = projectAndGenerateWorksheet(
        { selection, generatorVersion: registration.generatorVersion, seed: "1234abcd" },
        registration.generate,
        { worksheetId: "77777777-7777-4777-8777-777777777777" },
      );
      return generated.ok && generated.document.items.length;
    };
    for (const regrouping of NUMBER_BONDS_REGROUPING_MODES) {
      const within4 = bondsCell(["addition"], 4, regrouping);
      for (const [length, printScale, count] of [
        ["short", "standard", 8],
        ["standard", "standard", 12],
        ["long", "large", 12],
      ] as const) {
        const selection = { ...within4, length, printScale };
        expect(agreedVerdict(`within 4 ${length}/${printScale}`, selection, undefined)).toEqual({ offered: true });
        expect(items(selection)).toBe(count);
      }
      expect(
        agreedVerdict(
          "within 4 long/standard",
          { ...within4, length: "long", printScale: "standard" },
          undefined,
        ),
      ).toEqual({
        offered: false,
        message:
          "This practice focus has 12 unique problems, but this length needs 18. Choose a practice focus with a wider range. Or choose a shorter length under More options.",
      });
    }
  });
});

describe("shipped example profiles", () => {
  /** Every family's shipped-default selection, one per variant and vocabulary. */
  function shippedDefaultSelections(): readonly { readonly name: string; readonly selection: WorksheetSelectionV2 }[] {
    return [
      { name: "dry-math", selection: { ...base, worksheetType: "dry-math" } },
      ...(["quantity", "equation"] as const).map((variant) => ({
        name: `find-the-wow ${variant}`,
        selection: {
          ...base,
          worksheetType: "find-the-wow" as const,
          findTheWow: { ...base.findTheWow, variant },
        },
      })),
      ...WRITING_MODES.flatMap((variant) =>
        SENTENCE_VOCABULARY_OPTIONS.map((vocabulary) => ({
          name: `sentence-builder ${variant} ${vocabulary}`,
          selection: {
            ...base,
            worksheetType: "sentence-builder" as const,
            sentenceBuilder: { variant, vocabulary },
          },
        })),
      ),
      { name: "count-compare-make", selection: { ...base, worksheetType: "count-compare-make" } },
      { name: "number-bonds", selection: { ...base, worksheetType: "number-bonds" } },
    ];
  }

  test("the shipped defaults never offer a selection the generator would reject, for every example child", () => {
    // The example ships identity-only children and the built-in defaults, so
    // the defaults alone decide every child's first selection.
    expect(acceptanceConfig.defaults).toEqual(DEFAULT_WORKSHEET_DEFAULTS_V2);
    expect(acceptanceConfig.profiles.every(isIdentityOnlyProfile)).toBe(true);
    const offered: string[] = [];
    const refusals: string[] = [];
    for (const { name, selection } of shippedDefaultSelections()) {
      for (const profile of acceptanceConfig.profiles) {
        expect(childSelection(profile, selection.worksheetType)).toEqual({
          ...base,
          worksheetType: selection.worksheetType,
        });
        for (const { where, verdict } of sweepLayouts(`${name} ${profile.id}`, selection, profile)) {
          (verdict.offered ? offered : refusals).push(where);
        }
      }
    }
    expect(new Set(shippedDefaultSelections().map(({ selection }) => selection.worksheetType))).toEqual(
      new Set(REGISTERED_WORKSHEET_IDS),
    );
    expect(offered.length).toBeGreaterThan(0);
    expect(refusals).toEqual([]);
  });

  test("the canonical children's earlier settings never offer a selection the generator would reject", () => {
    const offered: string[] = [];
    const refusals: string[] = [];
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const profile of migratedV1FixtureConfig.profiles) {
        expect(profile.legacyChoices).toBeDefined();
        const selection = childSelection(profile, worksheetType);
        for (const { where, verdict } of sweepLayouts(
          `${worksheetType} ${profile.id}`,
          selection,
          profile,
        )) {
          (verdict.offered ? offered : refusals).push(where);
        }
      }
    }

    // A sweep that offers nothing proves nothing.
    expect(offered.length).toBeGreaterThan(0);
    // The canonical children's earlier settings starve no cell: the Step 9
    // confidence refusal this file used to pin was produced by Difficulty,
    // which no longer exists.
    expect(refusals).toEqual([]);
    // Every canonical child must still reach the offered side, so a data edit
    // cannot leave one silently unusable in every family.
    for (const { id } of migratedV1FixtureConfig.profiles) {
      expect(`${id} offered ${offered.some((where) => where.includes(id))}`).toBe(
        `${id} offered true`,
      );
    }
  });

  test("mirror: quantities to 8 fill the Long page the D36 source refuses", () => {
    const eight = earlierSettingsChild("d3600000-0000-4000-8000-000000000038", {
      ...D36_CHILD.legacyChoices!.mathSkills,
      countingMax: 8,
      numeralMax: 8,
      compareMax: 8,
    });
    const [longStandard] = sweepLayouts(
      "eight find-the-wow",
      { ...childSelection(eight, "find-the-wow"), length: "long" },
      eight,
    ).filter(({ where }) => where.endsWith("long/standard"));
    expect(longStandard?.verdict).toEqual({ offered: true });
  });
});
