// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DIFFICULTIES,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
  ChildProfileV1Schema,
  type ChildProfileV1,
  type GenerationDefaultsV1,
} from "../../shared/config/schema";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetControlContextV1,
} from "../../shared/worksheet/registry";
import type { WorksheetGeneratorV1 } from "../../shared/worksheet/types";
import {
  getSentenceBuilderBankSize,
  getSentenceBuilderCapabilitySupport,
} from "../../worksheets/sentence-builder/definition";
import {
  createWorksheetSessionForSeed,
  makeAnotherWorksheetSession,
  type GenerationSelection,
} from "./create-session";
import { GeneratorControls } from "./GeneratorControls";

/*
 * Step 9 owns the worksheet-option contract, and two accepted findings that
 * only a control-level test can settle.
 *
 * Issue #14: availability resolved a MODE and never a BUDGET, so the control
 * could enable Create, state how many groups the selection would produce, and
 * then have the generator refuse the click. The sweep below is the standing
 * guard: every family, every fixture, every difficulty x length x print scale,
 * "offered as available" must mean "really producible". The same sweep over
 * the profiles a parent is actually shipped lives in
 * `tests/integration/shipped-profile-options.test.ts`, which can read the
 * example configuration file this web-project suite has no file access for.
 *
 * A sweep can only prove a family's verdict while that family is actually seen
 * REFUSING something. Iteration 1 counted refusals globally, so `find-the-wow`
 * alone satisfied the counter and the other three families' capacity probes
 * could have been replaced by a hardcoded "sufficient" with every test still
 * green. The fixtures below therefore starve each probing family in its own
 * way, and the tallies are per family.
 *
 * Issue #16: the shared exhaustion sentence told every parent to review the
 * profile limits, which is wrong for the one family whose limiting resource is
 * curated vocabulary rather than a stored number - and wrong again inside
 * Count, Compare & Make, whose group-comparison pool follows `compareMax`
 * while the sentence named counting.
 */

const basePreferences: GenerationDefaultsV1 = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

/**
 * The three quantity maxima, independently settable.
 *
 * Tying them is what kept three of Count, Compare & Make's four subtype arms
 * and the `[countingMax, numeralMax]` branch of its binding-key selector
 * unreached while this suite stayed green: with counting == numeral == compare
 * no derived profile can drive that selector to a strict winner, so a selector
 * that named the wrong maximum would look right here.
 */
interface QuantityMaximumsV1 {
  readonly countingMax: number;
  readonly numeralMax: number;
  readonly compareMax: number;
}

function tiedQuantityMaximums(limit: number): QuantityMaximumsV1 {
  return { countingMax: limit, numeralMax: limit, compareMax: limit };
}

/** Quantities only, exactly the shape the issue-#14 report names. */
function quantityProfile(
  id: string,
  maximums: QuantityMaximumsV1,
): ChildProfileV1 {
  return {
    id,
    displayName: "Private Quantity Child",
    ageYears: 4,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: {
      ...maximums,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "label",
    interests: ["animals"],
  };
}

/** The tied shorthand the length-edge tables want; one number, three maxima. */
function quantityProfileWithLimit(limit: number, id: string): ChildProfileV1 {
  return quantityProfile(id, tiedQuantityMaximums(limit));
}

/** Equations only, so both math families resolve to symbolic work. */
function equationProfile(
  id: string,
  operandMax: number,
  resultMax: number,
  operations: ChildProfileV1["mathSkills"]["operations"],
): ChildProfileV1 {
  return {
    id,
    displayName: "Private Equation Child",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      // 1, not 0: `MathSkillsV1Schema` floors the three quantity maxima at 1,
      // so a 0 here would describe a profile a parent can never store. Both
      // symbolic families read only `operandMax`/`resultMax`, so the floor
      // changes no verdict in this file.
      countingMax: 1,
      numeralMax: 1,
      compareMax: 1,
      representations: ["equations"],
      understandsEquality: true,
      operations,
      operandMax,
      resultMax,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["space"],
  };
}

/** The shipped preschool profile's confirmed limits: quantities only, 10. */
const preschoolQuantityProfile = quantityProfileWithLimit(
  10,
  "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
);

/** Every v1 capability confirmed at the ceiling, as the oldest band allows. */
const independentProfile: ChildProfileV1 = {
  id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
  displayName: "Private Avery",
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
};

/** Stores more than Version 1 can use, in every direction at once. */
const beyondV1Profile: ChildProfileV1 = {
  id: "9f6c1f1a-1c2d-4e3f-8a4b-5c6d7e8f9a0b",
  displayName: "Private Jordan",
  ageYears: 6,
  presentationBand: "early-primary",
  reviewedOn: "2026-08-22",
  mathSkills: {
    countingMax: 25,
    numeralMax: 25,
    compareMax: 25,
    representations: ["quantities", "equations"],
    understandsEquality: true,
    operations: ["addition", "subtraction"],
    operandMax: 25,
    resultMax: 25,
    allowRegrouping: true,
    allowNegativeResults: true,
  },
  writingMode: "sentence-frame",
  interests: ["space"],
};

/**
 * The issue-#14 shape for the two symbolic families: schema-valid, confirmed
 * for equations, and holding far fewer distinct facts than any length asks
 * for. Without it a hardcoded "capacity is always sufficient" for Dry Math
 * passes the whole suite.
 */
const starvedEquationProfile = equationProfile(
  "5f0e1d2c-3b4a-4958-8677-8695a4b3c2d1",
  2,
  2,
  ["addition"],
);

/**
 * The issue-#16 shape INSIDE Count, Compare & Make: counting and numerals at
 * the v1 ceiling while `compareMax` alone starves the group-comparison pool,
 * so a message naming counting would be advice that cannot change the answer.
 * `compareMax: 1` is the schema minimum, not an impossible value.
 */
const starvedComparisonProfile: ChildProfileV1 = {
  ...quantityProfileWithLimit(20, "6a1b2c3d-4e5f-4061-8273-8495a6b7c8d9"),
  displayName: "Private Comparison Child",
  mathSkills: {
    ...quantityProfileWithLimit(20, "unused").mathSkills,
    compareMax: 1,
  },
};

/**
 * The two UNTIED numeral-matching shapes, one per binding maximum.
 *
 * `match` is drawn from min(countingMax, numeralMax) and needs three numerals,
 * so each of these starves it through a different stored maximum while the
 * OTHER one sits at the Version 1 ceiling of 20 - where "review the counting
 * limits" would be advice about a number that cannot move (issue #16), and
 * where a selector that named both, or always named the same one, still reads
 * as correct against a tied fixture.
 */
const starvedCountingMatchProfile = quantityProfile(
  "3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d",
  { countingMax: 2, numeralMax: 20, compareMax: 20 },
);

const starvedNumeralMatchProfile = quantityProfile(
  "4b3c2d1e-0f9a-4b8c-9d7e-6f5a4b3c2d1e",
  { countingMax: 20, numeralMax: 2, compareMax: 20 },
);

/**
 * Confirms equations without the equality understanding or the operation that
 * would make them usable: the one shape that makes BOTH symbolic families
 * unavailable through their REGISTRATIONS rather than through a capacity
 * shortage, and the only fixture here whose Two Whats and a Wow relevant-maximum
 * list is empty. Schema-valid: `MathSkillsV1Schema` requires operand and result
 * maxima of exactly 0 when `operations` is empty, and floors the three quantity
 * maxima at 1.
 */
const unusableEquationProfile: ChildProfileV1 = {
  id: "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f",
  displayName: "Private Unusable Child",
  ageYears: 6,
  presentationBand: "early-primary",
  reviewedOn: "2026-08-22",
  mathSkills: {
    countingMax: 1,
    numeralMax: 1,
    compareMax: 1,
    representations: ["equations"],
    understandsEquality: false,
    operations: [],
    operandMax: 0,
    resultMax: 0,
    allowRegrouping: false,
    allowNegativeResults: false,
  },
  writingMode: "label",
  interests: ["animals"],
};

/**
 * Parsed through the production schema on the way in. A fixture a parent could
 * never store proves a contract over profiles that do not exist, and five of
 * these previously set the three quantity maxima to 0 against
 * `MathSkillsV1Schema`'s floor of 1.
 */
const SWEEP_PROFILES: readonly ChildProfileV1[] = [
  preschoolQuantityProfile,
  independentProfile,
  beyondV1Profile,
  starvedEquationProfile,
  starvedComparisonProfile,
  starvedCountingMatchProfile,
  starvedNumeralMatchProfile,
  unusableEquationProfile,
].map((profile) => ChildProfileV1Schema.parse(profile));

interface SweepCell {
  readonly worksheetType: RegisteredWorksheetType;
  readonly profileId: string;
  readonly difficulty: GenerationDefaultsV1["difficulty"];
  readonly length: GenerationDefaultsV1["length"];
  readonly printScale: GenerationDefaultsV1["printScale"];
}

function emptyFamilyTally(): Record<RegisteredWorksheetType, number> {
  return {
    "dry-math": 0,
    "find-the-wow": 0,
    "sentence-builder": 0,
    "count-compare-make": 0,
  };
}

function contextFor(
  profile: ChildProfileV1,
  overrides: Partial<Omit<WorksheetControlContextV1, "profile">> = {},
): WorksheetControlContextV1 {
  return {
    profile,
    difficulty: "practice",
    length: "standard",
    printScale: "standard",
    ...overrides,
  };
}

function selectionFor(
  worksheetType: RegisteredWorksheetType,
  context: WorksheetControlContextV1,
): GenerationSelection {
  const registration = getWorksheetRegistration(worksheetType);
  return {
    profile: context.profile,
    worksheetType,
    stretchConfirmed: true,
    preferences: registration.controls.projectPreferences(context, {
      ...basePreferences,
      difficulty: context.difficulty,
      length: context.length,
      printScale: context.printScale,
    }),
  };
}

/** Runs the production session creator exactly as `App` would. */
function generate(selection: GenerationSelection) {
  return createWorksheetSessionForSeed(selection, 0x1234_abcd, {
    worksheetIdSource: () => "77777777-7777-4777-8777-777777777777",
  });
}

function capacityMessage(
  worksheetType: RegisteredWorksheetType,
  context: WorksheetControlContextV1,
): string {
  const support =
    getWorksheetRegistration(worksheetType).controls.getCapabilitySupport(
      context,
    );
  expect(support.available).toBe(true);
  if (!support.available || support.capacity.sufficient) {
    return "";
  }
  return support.capacity.message;
}

function renderControls(
  profile: ChildProfileV1,
  worksheetType: RegisteredWorksheetType,
  overrides: Partial<GenerationDefaultsV1> = {},
  onSaveDefaults: (
    defaults: GenerationDefaultsV1,
  ) => Promise<void> = async () => {},
): void {
  render(
    createElement(GeneratorControls, {
      defaults: { ...basePreferences, ...overrides },
      onGenerate: vi.fn(),
      onInputsChanged: vi.fn(),
      onSaveDefaults,
      profiles: [profile],
    }),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Worksheet type" }), {
    target: { value: worksheetType },
  });
  for (const details of document.querySelectorAll("details")) {
    details.open = true;
  }
}

afterEach(cleanup);

describe("capacity-aware availability (issue #14)", () => {
  test("no selection the generator will reject is offered as available", () => {
    const offeredBy = emptyFamilyTally();
    const refusedBy = emptyFamilyTally();
    const refusals: SweepCell[] = [];
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const registration = getWorksheetRegistration(worksheetType);
      for (const profile of SWEEP_PROFILES) {
        for (const difficulty of DIFFICULTIES) {
          for (const length of WORKSHEET_LENGTHS) {
            for (const printScale of PRINT_SCALES) {
              const context = contextFor(profile, {
                difficulty,
                length,
                printScale,
              });
              const support =
                registration.controls.getCapabilitySupport(context);
              if (!support.available) {
                continue;
              }
              const result = generate(selectionFor(worksheetType, context));
              const where = `${worksheetType} ${profile.id} ${difficulty}/${length}/${printScale}`;
              if (support.capacity.sufficient) {
                expect(
                  result.ok ? "produced" : `${where}: ${result.message}`,
                ).toBe("produced");
                offeredBy[worksheetType] += 1;
              } else {
                // The control refused it, so the generator must too: a
                // conservative verdict is allowed, a false alarm is not.
                expect(`${where}: ${result.ok ? "produced" : "refused"}`).toBe(
                  `${where}: refused`,
                );
                refusedBy[worksheetType] += 1;
                refusals.push({
                  worksheetType,
                  profileId: profile.id,
                  difficulty,
                  length,
                  printScale,
                });
              }
            }
          }
        }
      }
    }

    // Every family must still be seen answering BOTH ways. A single global
    // counter let one family's refusal vouch for all four, which is how three
    // of the four capacity probes could have been reverted unnoticed.
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      expect(`${worksheetType} offered ${offeredBy[worksheetType] > 0}`).toBe(
        `${worksheetType} offered true`,
      );
    }
    for (const worksheetType of [
      "dry-math",
      "find-the-wow",
      "count-compare-make",
    ] as const) {
      expect(`${worksheetType} refused ${refusedBy[worksheetType] > 0}`).toBe(
        `${worksheetType} refused true`,
      );
    }
    // Sentence Builder has no numeric capacity gate to refuse with: its own
    // availability gate already measures the leanest reviewed topic against
    // the bank budget, and "the shipped vocabulary can always fill it" is
    // pinned exhaustively below rather than assumed here.
    expect(refusedBy["sentence-builder"]).toBe(0);

    // The exact combinations each family is guarded at, so a later fixture or
    // limit edit that quietly removes a refusal regime fails HERE rather than
    // leaving a global counter satisfied by some other family.
    expect(refusals).toContainEqual({
      worksheetType: "find-the-wow",
      profileId: preschoolQuantityProfile.id,
      difficulty: "confidence",
      length: "long",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "dry-math",
      profileId: starvedEquationProfile.id,
      difficulty: "practice",
      length: "long",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "count-compare-make",
      profileId: starvedComparisonProfile.id,
      difficulty: "practice",
      length: "short",
      printScale: "standard",
    });
    // The two untied numeral-matching regimes, one per binding maximum.
    expect(refusals).toContainEqual({
      worksheetType: "count-compare-make",
      profileId: starvedCountingMatchProfile.id,
      difficulty: "practice",
      length: "short",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "count-compare-make",
      profileId: starvedNumeralMatchProfile.id,
      difficulty: "practice",
      length: "short",
      printScale: "standard",
    });
  });

  test("a confidence long Wow on a counting-10 profile is refused before the click", () => {
    const registration = getWorksheetRegistration("find-the-wow");
    const context = contextFor(preschoolQuantityProfile, {
      difficulty: "confidence",
      length: "long",
    });
    const support = registration.controls.getCapabilitySupport(context);
    expect(support.available).toBe(true);
    if (!support.available) {
      return;
    }
    expect(support.capacity.sufficient).toBe(false);
    const message = support.capacity.sufficient ? "" : support.capacity.message;

    // The shortage half of the sentence is the generator's own sentence, not a
    // paraphrase; the control only ADDS the remedy it can prove and the
    // generator cannot (the raw stored limits are gone by then).
    const refused = generate(selectionFor("find-the-wow", context));
    expect(refused.ok).toBe(false);
    const generatorMessage = refused.ok ? "" : refused.message;
    expect(generatorMessage).toBe(
      "The confirmed limits provide 7 unique quantity groups, but this length needs 8. Choose a shorter worksheet or review the profile's counting and numerals limits.",
    );
    expect(message).toBe(
      `${generatorMessage} Setting Difficulty to Practice also fills this selection, without changing the profile.`,
    );

    // The same profile at the standard length stays offered and producible.
    const shorter = registration.controls.getCapabilitySupport(
      contextFor(preschoolQuantityProfile, {
        difficulty: "confidence",
        length: "standard",
      }),
    );
    expect(shorter.available && shorter.capacity.sufficient).toBe(true);
  });

  test("quantity capacity edges disable exactly the lengths the limits cannot fill", () => {
    const expectations: readonly {
      readonly limit: number;
      readonly sufficient: Readonly<
        Record<GenerationDefaultsV1["length"], boolean>
      >;
    }[] = [
      { limit: 4, sufficient: { short: true, standard: false, long: false } },
      { limit: 6, sufficient: { short: true, standard: true, long: false } },
      { limit: 7, sufficient: { short: true, standard: true, long: false } },
      { limit: 8, sufficient: { short: true, standard: true, long: true } },
    ];
    const registration = getWorksheetRegistration("find-the-wow");
    for (const [index, { limit, sufficient }] of expectations.entries()) {
      const profile = quantityProfileWithLimit(
        limit,
        `1111111${index}-1111-4111-8111-111111111111`,
      );
      for (const length of WORKSHEET_LENGTHS) {
        const context = contextFor(profile, { length });
        const support = registration.controls.getCapabilitySupport(context);
        expect(support.available).toBe(true);
        const verdict = support.available && support.capacity.sufficient;
        expect(`limit ${limit} ${length}: ${verdict}`).toBe(
          `limit ${limit} ${length}: ${sufficient[length]}`,
        );
        expect(generate(selectionFor("find-the-wow", context)).ok).toBe(
          sufficient[length],
        );
      }
    }
  });

  test("equation capacity edges are measured in stems, not candidate pairs", () => {
    // Equation mode counts DISTINCT STEMS while each stem carries many
    // distractor pairs, so an arm that counted candidates would read as
    // hugely sufficient and reproduce issue #14 for every equation parent.
    // The rows below bracket the strict comparison: 6 stems against a
    // standard page needing exactly 6 must pass, 7 against a long page
    // needing 8 must fail.
    const expectations: readonly {
      readonly label: string;
      readonly profile: ChildProfileV1;
      readonly sufficient: Readonly<
        Record<GenerationDefaultsV1["length"], boolean>
      >;
    }[] = [
      {
        label: "0 stems",
        profile: equationProfile(
          "2222222a-2222-4222-8222-222222222222",
          1,
          1,
          ["addition"],
        ),
        sufficient: { short: false, standard: false, long: false },
      },
      {
        label: "6 stems (standard needs exactly 6)",
        profile: equationProfile(
          "2222222b-2222-4222-8222-222222222222",
          2,
          2,
          ["addition"],
        ),
        sufficient: { short: true, standard: true, long: false },
      },
      {
        label: "7 stems (long needs one more)",
        profile: equationProfile(
          "2222222c-2222-4222-8222-222222222222",
          1,
          2,
          ["addition", "subtraction"],
        ),
        sufficient: { short: true, standard: true, long: false },
      },
      {
        label: "10 stems",
        profile: equationProfile(
          "2222222d-2222-4222-8222-222222222222",
          3,
          3,
          ["addition"],
        ),
        sufficient: { short: true, standard: true, long: true },
      },
    ];
    const registration = getWorksheetRegistration("find-the-wow");
    for (const { label, profile, sufficient } of expectations) {
      for (const length of WORKSHEET_LENGTHS) {
        const context = contextFor(profile, { length });
        const support = registration.controls.getCapabilitySupport(context);
        expect(support.available).toBe(true);
        const verdict = support.available && support.capacity.sufficient;
        expect(`${label} ${length}: ${verdict}`).toBe(
          `${label} ${length}: ${sufficient[length]}`,
        );
        expect(generate(selectionFor("find-the-wow", context)).ok).toBe(
          sufficient[length],
        );
      }
    }

    // The mode is named in the sentence, and the remedy names the maxima this
    // mode really reads rather than the counting limits it ignores.
    const message = capacityMessage(
      "find-the-wow",
      contextFor(equationProfile("2222222c-2222-4222-8222-222222222222", 1, 2, [
        "addition",
        "subtraction",
      ]), { length: "long" }),
    );
    // Only OPERANDS are named: at operands 1 / results 2 the addition and
    // subtraction pools are held down by the operand limit, and lifting the
    // result limit alone adds no stem at all.
    expect(message).toBe(
      "The confirmed limits provide 7 unique equation groups, but this length needs 8. Choose a shorter worksheet or review the profile's operands limits.",
    );
  });

  test("the control disables Create and promises no budget when capacity is short", () => {
    renderControls(preschoolQuantityProfile, "find-the-wow", {
      difficulty: "confidence",
      length: "long",
    });
    const create = screen.getByRole("button", { name: "Create worksheet" });
    expect(create).toBeDisabled();
    expect(
      screen.getByText(
        /provide 7 unique quantity groups, but this length needs 8/u,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/This selection creates/u)).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), {
      target: { value: "standard" },
    });
    expect(create).toBeEnabled();
    expect(
      screen.getByText(
        "This selection creates 6 unique groups on one practice page.",
      ),
    ).toBeInTheDocument();
  });

  test("every probing family reaches the DOM with its own shortage sentence", () => {
    // The verdict being right is not the same as the verdict being SHOWN. A
    // registration that computed the shortage correctly and never surfaced it
    // would ship silently, so each family's own sentence is read off a node.
    const cases: readonly {
      readonly profile: ChildProfileV1;
      readonly worksheetType: RegisteredWorksheetType;
      readonly overrides: Partial<GenerationDefaultsV1>;
      readonly message: string;
    }[] = [
      {
        profile: starvedEquationProfile,
        worksheetType: "dry-math",
        overrides: { difficulty: "practice", length: "long" },
        message:
          "The confirmed limits provide 6 unique facts, but this length needs 18. Choose a shorter worksheet or review the profile's results limits.",
      },
      {
        profile: starvedComparisonProfile,
        worksheetType: "count-compare-make",
        overrides: { difficulty: "practice", length: "short" },
        message:
          "The confirmed limits provide 1 unique group-comparison exercises, but this length needs 2. Review the profile's comparisons limits.",
      },
      {
        profile: preschoolQuantityProfile,
        worksheetType: "find-the-wow",
        overrides: { difficulty: "confidence", length: "long" },
        message:
          "The confirmed limits provide 7 unique quantity groups, but this length needs 8. Choose a shorter worksheet or review the profile's counting and numerals limits. Setting Difficulty to Practice also fills this selection, without changing the profile.",
      },
      // The same family, the same subtype, two different binding maxima. A
      // selector that named both, or always named counting, passes the tied
      // fixture above and fails exactly one of these two.
      {
        profile: starvedCountingMatchProfile,
        worksheetType: "count-compare-make",
        overrides: { difficulty: "practice", length: "short" },
        message:
          "The confirmed limits provide 0 unique numeral-matching exercises, but this length needs 2. Review the profile's counting limits.",
      },
      {
        profile: starvedNumeralMatchProfile,
        worksheetType: "count-compare-make",
        overrides: { difficulty: "practice", length: "short" },
        message:
          "The confirmed limits provide 0 unique numeral-matching exercises, but this length needs 2. Review the profile's numerals limits.",
      },
    ];
    for (const { profile, worksheetType, overrides, message } of cases) {
      renderControls(profile, worksheetType, overrides);
      expect(
        screen.getByRole("button", { name: "Create worksheet" }),
      ).toBeDisabled();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.queryByText(/This selection creates/u)).toBeNull();
      cleanup();
    }
  });
});

describe("shortage remedies a parent can actually take (issue #16)", () => {
  test("a comparison shortage names comparisons and offers no length that helps", () => {
    // `compare` is drawn from min(countingMax, compareMax) while the other
    // three subtypes follow numerals, and short and standard both ask for two
    // comparisons. Naming counting, or offering a shorter worksheet, would be
    // two remedies that cannot change this answer.
    const message = capacityMessage(
      "count-compare-make",
      contextFor(starvedComparisonProfile, { length: "short" }),
    );
    expect(message).toBe(
      "The confirmed limits provide 1 unique group-comparison exercises, but this length needs 2. Review the profile's comparisons limits.",
    );

    // Standard asks for the same two comparisons, so a shorter worksheet is
    // still not offered there either.
    expect(
      capacityMessage(
        "count-compare-make",
        contextFor(starvedComparisonProfile, { length: "standard" }),
      ),
    ).not.toContain("shorter worksheet");

    // Long really does ask for three, so there the remedy is live.
    expect(
      capacityMessage(
        "count-compare-make",
        contextFor(starvedComparisonProfile, { length: "long" }),
      ),
    ).toBe(
      "The confirmed limits provide 1 unique group-comparison exercises, but this length needs 3. Choose a shorter worksheet or review the profile's comparisons limits.",
    );
  });

  test("a maximum already at the Version 1 ceiling is never the remedy", () => {
    // The two parent-facing cases the stop-and-audit named. In each of them one
    // of the two maxima the family reads is already at 20 - the ceiling
    // `clampPositive` enforces at the sole projection boundary - so naming it
    // sends the parent to a knob that cannot move. Before the shortfall
    // functions accepted the skills there was no arm to reach here: they named
    // both maxima unconditionally, whatever the numbers were.
    const quantitiesAtCeiling = quantityProfile(
      "9a8b7c6d-5e4f-4302-8110-fedcba987654",
      { countingMax: 20, numeralMax: 6, compareMax: 20 },
    );
    expect(
      capacityMessage(
        "find-the-wow",
        contextFor(quantitiesAtCeiling, { length: "long" }),
      ),
    ).toBe(
      "The confirmed limits provide 6 unique quantity groups, but this length needs 8. Choose a shorter worksheet or review the profile's numerals limits.",
    );

    // Dry Math's twin: 20 operands can never widen an addition pool a result
    // limit of 2 already caps at six facts.
    const operandsAtCeiling = equationProfile(
      "8b7c6d5e-4f30-4211-8fed-cba987654321",
      20,
      2,
      ["addition"],
    );
    expect(
      capacityMessage(
        "dry-math",
        contextFor(operandsAtCeiling, { length: "standard" }),
      ),
    ).toBe(
      "The confirmed limits provide 6 unique facts, but this length needs 12. Choose a shorter worksheet or review the profile's results limits.",
    );
  });

  test("a shortage at the shortest page never offers a shorter page", () => {
    const message = capacityMessage(
      "dry-math",
      contextFor(starvedEquationProfile, { length: "short" }),
    );
    // Operands are NOT named: at operands 2 / results 2 an addition pool is
    // bounded by the result limit alone, so lifting the operand limit adds no
    // fact and sending the parent there is advice that cannot work.
    expect(message).toBe(
      "The confirmed limits provide 6 unique facts, but this length needs 8. Review the profile's results limits.",
    );

    // Large print already pulls standard down to the short budget, so the
    // shorter option cannot lower the requirement there either.
    expect(
      capacityMessage(
        "dry-math",
        contextFor(starvedEquationProfile, {
          length: "standard",
          printScale: "large",
        }),
      ),
    ).not.toContain("shorter worksheet");
  });

  test("the difficulty remedy appears only when practice really fills the page", () => {
    const remedy =
      "Setting Difficulty to Practice also fills this selection, without changing the profile.";

    // Confidence is the whole reason this one fell short: practice produces it.
    expect(
      capacityMessage(
        "find-the-wow",
        contextFor(preschoolQuantityProfile, {
          difficulty: "confidence",
          length: "long",
        }),
      ),
    ).toContain(remedy);
    expect(
      getWorksheetRegistration("find-the-wow").controls.getCapabilitySupport(
        contextFor(preschoolQuantityProfile, {
          difficulty: "practice",
          length: "long",
        }),
      ),
    ).toMatchObject({ available: true, capacity: { sufficient: true } });

    // Practice cannot fill this one, so the remedy is not offered.
    expect(
      capacityMessage(
        "count-compare-make",
        contextFor(starvedComparisonProfile, {
          difficulty: "confidence",
          length: "short",
        }),
      ),
    ).not.toContain(remedy);

    // Nor is it offered when the parent is not on confidence at all.
    expect(
      capacityMessage(
        "dry-math",
        contextFor(starvedEquationProfile, {
          difficulty: "practice",
          length: "long",
        }),
      ),
    ).not.toContain(remedy);
  });
});

describe("family-aware limiting-resource copy (issue #16)", () => {
  test("advice names exactly the resources the family really reads", () => {
    // Pinned literally rather than derived from `getRelevantMaximums`: an
    // advice sentence built from a swapped list agrees with a swapped list.
    const expected: Readonly<Record<string, string>> = {
      "dry-math|practice":
        "Dry Math varies within the profile's operands and results limits. Review those limits in the profile or create a new worksheet later.",
      "count-compare-make|practice":
        "Count, Compare & Make varies within the profile's counting, numerals, and comparisons limits. Review those limits in the profile or create a new worksheet later.",
      // Quantity mode: the same family, a different pair of maxima.
      "find-the-wow|practice":
        "Math — Two Whats and a Wow varies within the profile's counting and numerals limits. Review those limits in the profile or create a new worksheet later.",
      "sentence-builder|practice":
        "Sentence Builder varies within the reviewed vocabulary for label your drawing mode, which no stored number can widen. Choose a different writing mode in the profile, or create a new worksheet later.",
    };
    for (const [key, sentence] of Object.entries(expected)) {
      const worksheetType = key.split("|")[0] as RegisteredWorksheetType;
      expect(
        getWorksheetRegistration(
          worksheetType,
        ).controls.getLimitingResourceAdvice(
          contextFor(preschoolQuantityProfile),
        ),
      ).toBe(sentence);
    }

    // Equation mode must not be explained in counting terms, and a quantity
    // page must not be explained in operand terms.
    expect(
      getWorksheetRegistration(
        "find-the-wow",
      ).controls.getLimitingResourceAdvice(contextFor(independentProfile)),
    ).toContain("operands and results limits");
    expect(
      getWorksheetRegistration(
        "find-the-wow",
      ).controls.getLimitingResourceAdvice(contextFor(independentProfile)),
    ).not.toContain("counting");
  });

  test("the declared maximums and the advice sentence stay one list", () => {
    let numericFamilies = 0;
    let vocabularyFamilies = 0;
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const registration = getWorksheetRegistration(worksheetType);
      for (const profile of SWEEP_PROFILES) {
        for (const difficulty of DIFFICULTIES) {
          const context = contextFor(profile, { difficulty });
          const maximums = registration.controls.getRelevantMaximums(context);
          const advice =
            registration.controls.getLimitingResourceAdvice(context);
          if (maximums.length === 0) {
            // Nothing numeric bounds this page, so nothing may send the
            // parent to the profile's numbers.
            expect(`${worksheetType}: ${advice}`).not.toMatch(/limits/iu);
            vocabularyFamilies += 1;
          } else {
            for (const { label } of maximums) {
              expect(advice).toContain(label);
            }
            expect(advice).toMatch(/limits/u);
            numericFamilies += 1;
          }
        }
      }
    }
    expect(numericFamilies).toBeGreaterThan(0);
    expect(vocabularyFamilies).toBeGreaterThan(0);
  });

  test("the shared exhaustion message derives its explanation from the registration", () => {
    const exhaust = (
      worksheetType: RegisteredWorksheetType,
      profile: ChildProfileV1,
    ): string => {
      const selection = selectionFor(worksheetType, contextFor(profile));
      const current = generate(selection);
      if (!current.ok) {
        throw new Error(`${worksheetType}: ${current.message}`);
      }
      // Every draw reproduces the first document's items, so the real session
      // runs its 16 attempts out and reaches the exhaustion sentence.
      const duplicateGenerator: WorksheetGeneratorV1 = (request, context) => ({
        ok: true,
        document: {
          ...current.session.document,
          request,
          seed: request.seed,
          worksheetId: context.worksheetId,
        },
      });
      const repeated = makeAnotherWorksheetSession(
        current.session,
        selection,
        () => 0x0bad_c0de,
        {
          generator: duplicateGenerator,
          worksheetIdSource: () => "88888888-8888-4888-8888-888888888888",
        },
      );
      expect(repeated.status).toBe("exhausted");
      return repeated.status === "exhausted" ? repeated.message : "";
    };

    const sentenceBuilder = exhaust("sentence-builder", independentProfile);
    expect(sentenceBuilder).toContain(
      "No different worksheet was found in 16 attempts.",
    );
    expect(sentenceBuilder).toContain("reviewed vocabulary");
    expect(sentenceBuilder).not.toMatch(/limits/iu);

    const dryMath = exhaust("dry-math", independentProfile);
    expect(dryMath).toContain("No different worksheet was found in 16 attempts.");
    expect(dryMath).toContain("operands and results limits");

    // Quantity mode is the mode-dependent case: its advice must follow the
    // mode the profile really resolves to, not the family's whole key set.
    const quantityWow = exhaust("find-the-wow", preschoolQuantityProfile);
    expect(quantityWow).toContain("counting and numerals limits");
    expect(quantityWow).not.toContain("operands");

    const countCompare = exhaust(
      "count-compare-make",
      preschoolQuantityProfile,
    );
    expect(countCompare).toContain("counting, numerals, and comparisons limits");
  });
});

describe("Sentence Builder word banks against the shipped vocabulary", () => {
  test("no reviewed mode, band, length or print scale can starve a bank", () => {
    // This is what lets the registration answer `SUFFICIENT_CAPACITY` for
    // Sentence Builder without a numeric probe, and it is the guard that must
    // fail if a later step adds a thinner reviewed topic: a bank shortfall
    // would then reach a parent as a plain unavailable message with no
    // capacity explanation behind it.
    let bankCells = 0;
    for (const writingMode of WRITING_MODES) {
      for (const presentationBand of PRESENTATION_BANDS) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const printScale of PRINT_SCALES) {
            const support = getSentenceBuilderCapabilitySupport(
              writingMode,
              presentationBand,
              length,
              printScale,
            );
            const where = `${writingMode}/${presentationBand}/${length}/${printScale}`;
            const reason = support.available ? "" : support.reason;
            expect(`${where}: ${reason}`).not.toContain("word-bank words");
            if (
              support.available &&
              getSentenceBuilderBankSize(writingMode, length, printScale) > 0
            ) {
              bankCells += 1;
            }
          }
        }
      }
    }
    // Counting AVAILABLE cells alone was vacuous: the two modes that print no
    // bank are available too, so a bank size stuck at zero still satisfied a
    // "greater than zero" tally over all 60 cells. Three of the five reviewed
    // writing modes print a bank, over 2 presentation bands x 3 lengths x 2
    // print scales, so the bank-bearing subset is exactly 36 cells - and a bank
    // size that stopped being positive fails here instead of passing silently.
    expect(bankCells).toBe(36);
  });
});

describe("stored capabilities Version 1 keeps but never uses", () => {
  test("a maximum above 20 and both future permissions are shown", () => {
    renderControls(beyondV1Profile, "dry-math");
    expect(
      screen.getByText(
        /Stored limits reach operands 25, results 25; Version 1 uses at most 20\./u,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This profile also allows carrying and borrowing, and negative results; Version 1 never uses them\./u,
      ),
    ).toBeInTheDocument();
  });

  test("the arithmetic permissions are not announced on a page with no arithmetic", () => {
    // Carrying and negative results are symbolic-arithmetic concepts, so on a
    // counted-groups page they would describe work that page cannot contain.
    renderControls(beyondV1Profile, "count-compare-make");
    expect(screen.queryByText(/carrying and borrowing/u)).toBeNull();
  });
});

describe("stored generation defaults", () => {
  test("saving stores the parent's raw choices and mutates no child profile", async () => {
    const before = structuredClone(independentProfile);
    const saved: GenerationDefaultsV1[] = [];
    renderControls(
      independentProfile,
      "sentence-builder",
      { difficulty: "stretch", includeAnswerKey: true, printScale: "standard" },
      async (defaults) => {
        saved.push(defaults);
      },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    await screen.findByRole("button", {
      name: "Save these as worksheet defaults",
    });

    expect(saved).toHaveLength(1);
    // Sentence Builder normalizes difficulty and the answer key away at
    // request time; the STORED default keeps the parent's visible choice, so
    // reselecting a family that shows those controls finds them unchanged.
    expect(saved[0]).toEqual({
      ...basePreferences,
      difficulty: "stretch",
      includeAnswerKey: true,
      printScale: "large",
    });
    expect(independentProfile).toEqual(before);
  });

  test("a save that changes no child profile keeps the parent's selection", async () => {
    // The panel must survive a defaults write. `App` proves the real thing in
    // `tests/e2e/options.spec.ts`; this pins the control's half of it - a
    // fresh `defaults` object arriving as a prop must not reset the child or
    // the family, neither of which is a stored default.
    const second: ChildProfileV1 = {
      ...preschoolQuantityProfile,
      id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      displayName: "Private Second Child",
    };
    const { rerender } = render(
      createElement(GeneratorControls, {
        defaults: { ...basePreferences },
        onGenerate: vi.fn(),
        onInputsChanged: vi.fn(),
        onSaveDefaults: async () => {},
        profiles: [independentProfile, second],
      }),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
      target: { value: second.id },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Worksheet type" }), {
      target: { value: "count-compare-make" },
    });

    rerender(
      createElement(GeneratorControls, {
        defaults: { ...basePreferences, length: "long" },
        onGenerate: vi.fn(),
        onInputsChanged: vi.fn(),
        onSaveDefaults: async () => {},
        profiles: [independentProfile, second],
      }),
    );
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      second.id,
    );
    expect(
      screen.getByRole("combobox", { name: "Worksheet type" }),
    ).toHaveValue("count-compare-make");
  });

  test("a profile removed under the panel falls back to a real option", () => {
    const second: ChildProfileV1 = {
      ...preschoolQuantityProfile,
      id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      displayName: "Private Second Child",
    };
    const { rerender } = render(
      createElement(GeneratorControls, {
        defaults: { ...basePreferences },
        onGenerate: vi.fn(),
        onInputsChanged: vi.fn(),
        onSaveDefaults: async () => {},
        profiles: [independentProfile, second],
      }),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
      target: { value: second.id },
    });
    rerender(
      createElement(GeneratorControls, {
        defaults: { ...basePreferences },
        onGenerate: vi.fn(),
        onInputsChanged: vi.fn(),
        onSaveDefaults: async () => {},
        profiles: [independentProfile],
      }),
    );
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      independentProfile.id,
    );
  });
});
