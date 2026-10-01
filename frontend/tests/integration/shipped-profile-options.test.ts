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
import { PRACTICE_FOCUS_CATALOG } from "../../src/shared/config/practice-focus.js";
import {
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
import type { WorksheetType } from "../../src/shared/worksheet/types.js";
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
