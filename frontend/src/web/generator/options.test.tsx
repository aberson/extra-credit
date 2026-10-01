// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createElement,
  useEffect,
  useReducer,
  type Dispatch,
} from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  emptyAppConfigV2,
  themeFromInterests,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import {
  CapabilityProfileV1Schema,
  describeEarlierSettingDisclosure,
  profileWithLegacyChoices,
  selectionFromEarlierSettings,
  type CapabilityProfileV1,
} from "../../shared/config/earlier-settings";
import {
  PRACTICE_FOCUS_CATALOG,
  SENTENCE_VOCABULARY_LABELS,
  describePracticeFocus,
  presentationBandForVocabulary,
  type PracticeFocusKind,
} from "../../shared/config/practice-focus";
import {
  PRINT_SCALES,
  SENTENCE_VOCABULARY_OPTIONS,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
  type ChildProfileV2,
  type WorksheetDefaultsV2,
  type WorksheetSelectionV2,
} from "../../shared/config/schema";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetControlContextV2,
} from "../../shared/worksheet/registry";
import type { WorksheetGeneratorV1 } from "../../shared/worksheet/types";
import {
  SENTENCE_BUILDER_VARIANT_LABELS,
  getSentenceBuilderBankSize,
  getSentenceBuilderCapabilitySupport,
} from "../../worksheets/sentence-builder/definition";
import { BANK_WRITING_MODES } from "../../worksheets/sentence-builder/vocabulary";
import {
  createWorksheetSessionForSeed,
  makeAnotherWorksheetSession,
  type GenerationSelection,
} from "./create-session";
import { EARLY_PRIMARY_HELP_TEXT } from "../profiles/ProfileEditor";
import { FIND_THE_WOW_VARIANT_LABELS } from "../../worksheets/find-the-wow/definition";
import { GeneratorControls, THEME_HELP_TEXT } from "./GeneratorControls";
import {
  worksheetSessionReducer,
  type WorksheetPanelAction,
  type WorksheetSessionAction,
} from "./worksheet-session";

/*
 * Step 9 owns the worksheet-option contract, and two accepted findings that
 * only a control-level test can settle.
 *
 * Issue #14: availability resolved a MODE and never a BUDGET, so the control
 * could enable Create, state how many groups the selection would produce, and
 * then have the generator refuse the click. The sweeps below are the standing
 * guard: "offered as available" must mean "really producible", and a refusal
 * must carry the generator's own sentence. The same sweep over the profiles a
 * parent is actually shipped lives in
 * `tests/integration/shipped-profile-options.test.ts`, which can read the
 * example configuration file this web-project suite has no file access for.
 *
 * A sweep can only prove a family's verdict while that family is actually seen
 * REFUSING something, so the tallies are per family and each probing family
 * is starved in its own way.
 *
 * Every fixture below is a child's EARLIER settings in the version 1
 * capability shape. It reaches the controls the way the panel reaches them:
 * stored as `legacyChoices`, then mapped over the saved defaults by
 * `selectionFromEarlierSettings`.
 *
 * Issue #16: a shortage or exhaustion sentence must send the parent to a
 * choice that can change the answer - the length, the practice focus or the
 * writing activity - never to a number that cannot move.
 */

type WorksheetLengthChoice = WorksheetSelectionV2["length"];
type PrintScaleChoice = WorksheetSelectionV2["printScale"];

interface LayoutChoice {
  readonly length?: WorksheetLengthChoice;
  readonly printScale?: PrintScaleChoice;
}

/** The saved defaults every mapped fixture starts from. */
const BASE_SELECTION: WorksheetSelectionV2 = worksheetSelectionOf(
  DEFAULT_WORKSHEET_DEFAULTS_V2,
);

/**
 * The three quantity maxima, independently settable.
 *
 * Tying them is what kept three of Count, Compare & Make's four subtype arms
 * and the `[countingMax, numeralMax]` branch of its binding-key selector
 * unreached while this suite stayed green: with counting == numeral == compare
 * no derived focus can drive that selector to a strict winner, so a selector
 * that named the wrong maximum would look right here.
 */
interface QuantityMaximums {
  readonly countingMax: number;
  readonly numeralMax: number;
  readonly compareMax: number;
}

function tiedQuantityMaximums(limit: number): QuantityMaximums {
  return { countingMax: limit, numeralMax: limit, compareMax: limit };
}

/** Quantities only, exactly the shape the issue-#14 report names. */
function quantityProfile(
  id: string,
  maximums: QuantityMaximums,
): CapabilityProfileV1 {
  return {
    id,
    displayName: "Private Quantity Child",
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
function quantityProfileWithLimit(limit: number, id: string): CapabilityProfileV1 {
  return quantityProfile(id, tiedQuantityMaximums(limit));
}

/** Equations only, so both math families resolve to symbolic work. */
function equationProfile(
  id: string,
  operandMax: number,
  resultMax: number,
  operations: CapabilityProfileV1["mathSkills"]["operations"],
): CapabilityProfileV1 {
  return {
    id,
    displayName: "Private Equation Child",
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
const independentProfile: CapabilityProfileV1 = {
  id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
  displayName: "Private Avery",
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
const beyondV1Profile: CapabilityProfileV1 = {
  id: "9f6c1f1a-1c2d-4e3f-8a4b-5c6d7e8f9a0b",
  displayName: "Private Jordan",
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
const starvedComparisonProfile: CapabilityProfileV1 = {
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
 * so each of these starves it through a different maximum while the OTHER one
 * sits at the Version 1 ceiling of 20 - where naming it would be advice about
 * a number that cannot move (issue #16), and where a selector that named both,
 * or always named the same one, still reads as correct against a tied fixture.
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
 * Confirms equations without the equality understanding or an operation.
 * Neither arithmetic group nor the Statements variant has a source here, so
 * every family falls back to the saved defaults' own focus.
 */
const unusableEquationProfile: CapabilityProfileV1 = {
  id: "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f",
  displayName: "Private Unusable Child",
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
 * D34: an Earlier Dry Math setting of addition with operand and result
 * maximum 1 - three facts, below every length's budget at both scales.
 */
const d34DryMathProfile = equationProfile(
  "0d34d34d-0000-4000-8000-000000000034",
  1,
  1,
  ["addition"],
);

/**
 * D36: an Earlier Two Whats and a Wow quantity focus with counting and numeral
 * maximum 7 - seven stems, which fill every length but Long at standard scale.
 */
const d36QuantityProfile = quantityProfileWithLimit(
  7,
  "0d36d36d-0000-4000-8000-000000000036",
);

/**
 * Parsed through the production schema on the way in. A fixture a parent could
 * never store proves a contract over profiles that do not exist.
 */
const SWEEP_PROFILES: readonly CapabilityProfileV1[] = [
  preschoolQuantityProfile,
  independentProfile,
  beyondV1Profile,
  starvedEquationProfile,
  starvedComparisonProfile,
  starvedCountingMatchProfile,
  starvedNumeralMatchProfile,
  unusableEquationProfile,
  d34DryMathProfile,
  d36QuantityProfile,
].map((profile) => CapabilityProfileV1Schema.parse(profile));

interface SweepCell {
  readonly worksheetType: RegisteredWorksheetType;
  readonly profileId: string;
  readonly length: WorksheetLengthChoice;
  readonly printScale: PrintScaleChoice;
}

function emptyFamilyTally(): Record<RegisteredWorksheetType, number> {
  return {
    "dry-math": 0,
    "find-the-wow": 0,
    "sentence-builder": 0,
    "count-compare-make": 0,
  };
}

/** The selection the panel builds for this child's earlier settings. */
function selectionFor(
  worksheetType: RegisteredWorksheetType,
  profile: CapabilityProfileV1,
  layout: LayoutChoice = {},
): WorksheetSelectionV2 {
  const stored = profileWithLegacyChoices(profile);
  if (stored.legacyChoices === undefined) {
    throw new Error("A capability fixture always stores earlier settings.");
  }
  return {
    ...selectionFromEarlierSettings(stored.legacyChoices, {
      ...BASE_SELECTION,
      ...layout,
    }).selection,
    worksheetType,
  };
}

function contextFor(
  worksheetType: RegisteredWorksheetType,
  profile: CapabilityProfileV1,
  layout: LayoutChoice = {},
): WorksheetControlContextV2 {
  return { selection: selectionFor(worksheetType, profile, layout) };
}

function generationFor(
  worksheetType: RegisteredWorksheetType,
  profile: CapabilityProfileV1,
  layout: LayoutChoice = {},
): GenerationSelection {
  return {
    profile: profileWithLegacyChoices(profile),
    selection: selectionFor(worksheetType, profile, layout),
  };
}

/** Runs the production session creator exactly as `App` would. */
function generate(generation: GenerationSelection) {
  return createWorksheetSessionForSeed(generation, 0x1234_abcd, {
    worksheetIdSource: () => "77777777-7777-4777-8777-777777777777",
  });
}

/**
 * What the control says about a selection, in the generator's own terms:
 * "produced" when it is offered, otherwise the sentence the parent reads.
 */
function controlVerdict(generation: GenerationSelection): string {
  const support = getWorksheetRegistration(
    generation.selection.worksheetType,
  ).controls.getCapabilitySupport({ selection: generation.selection });
  if (!support.available) {
    return support.message;
  }
  return support.capacity.sufficient ? "produced" : support.capacity.message;
}

function generatorVerdict(generation: GenerationSelection): string {
  const result = generate(generation);
  return result.ok ? "produced" : result.message;
}

function capacityMessage(context: WorksheetControlContextV2): string {
  const support = getWorksheetRegistration(
    context.selection.worksheetType,
  ).controls.getCapabilitySupport(context);
  expect(support.available).toBe(true);
  if (!support.available || support.capacity.sufficient) {
    return "";
  }
  return support.capacity.message;
}

/** The layout and personalization fields a fixture may preset in the saved defaults. */
type ShownDefaults = Pick<
  WorksheetDefaultsV2,
  | "useDisplayName"
  | "useInterests"
  | "includeDecorativeGraphics"
  | "length"
  | "includeAnswerKey"
  | "paperSize"
  | "printScale"
>;

/**
 * The stored version 2 defaults the panel starts from, carrying the given
 * shown fields, with `theme` set from `useInterests` as the upgrade sets it.
 * Seeding is on, as a migrated file has it, so each fixture child's earlier
 * settings reach the panel.
 */
function storedDefaults(
  shown: Partial<ShownDefaults> = {},
  useEarlierChildSettings = true,
): WorksheetDefaultsV2 {
  const base = emptyAppConfigV2().defaults;
  const merged = { ...base, ...shown };
  return {
    ...merged,
    theme: themeFromInterests(merged.useInterests),
    useEarlierChildSettings,
  };
}

interface PanelHarnessProps {
  readonly defaults: WorksheetDefaultsV2;
  readonly profiles: readonly ChildProfileV2[];
  readonly onChange?: (action: WorksheetPanelAction) => void;
  readonly onDispatch?: (dispatch: Dispatch<WorksheetSessionAction>) => void;
  readonly onGenerate?: (generation: GenerationSelection) => void;
  readonly onSaveDefaults?: () => Promise<void>;
}

/**
 * The controlled panel over the production session reducer, as App holds it:
 * one `loaded` builds the session and every panel change is dispatched.
 */
function PanelHarness({
  defaults,
  onChange,
  onDispatch,
  onGenerate,
  onSaveDefaults,
  profiles,
}: PanelHarnessProps) {
  const [session, dispatch] = useReducer(worksheetSessionReducer, null, () =>
    worksheetSessionReducer(null, { type: "loaded", defaults, profiles }),
  );
  useEffect(() => {
    onDispatch?.(dispatch);
  }, [dispatch, onDispatch]);
  if (session === null) {
    return null;
  }
  return createElement(GeneratorControls, {
    session,
    onChange: (action) => {
      onChange?.(action);
      dispatch(action);
    },
    onGenerate: onGenerate ?? (() => undefined),
    onSaveDefaults: onSaveDefaults ?? (async () => undefined),
  });
}

function renderPanel(props: PanelHarnessProps): void {
  render(createElement(PanelHarness, props));
}

/** The worksheet-type radio card for one family, by its visible title. */
function worksheetCard(worksheetType: RegisteredWorksheetType): HTMLElement {
  return screen.getByRole("radio", {
    name: getWorksheetRegistration(worksheetType).displayName,
  });
}

function chooseWorksheet(worksheetType: RegisteredWorksheetType): void {
  const card = worksheetCard(worksheetType);
  if (!(card as HTMLInputElement).checked) {
    fireEvent.click(card);
  }
  expect(card).toBeChecked();
}

function openMoreOptions(): void {
  for (const details of document.querySelectorAll("details")) {
    details.open = true;
  }
}

function renderControls(
  profile: CapabilityProfileV1,
  worksheetType: RegisteredWorksheetType,
  shown: Partial<ShownDefaults> = {},
  onSaveDefaults: () => Promise<void> = async () => {},
): { readonly onGenerate: ReturnType<typeof vi.fn> } {
  const onGenerate = vi.fn();
  renderPanel({
    defaults: storedDefaults(shown),
    onGenerate,
    onSaveDefaults,
    profiles: [profileWithLegacyChoices(profile)],
  });
  chooseWorksheet(worksheetType);
  openMoreOptions();
  return { onGenerate };
}

/** The four remedy forms a shortage sentence may end with, and nothing else. */
const SHORTAGE_SENTENCE =
  /^This practice focus provides \d+ unique [a-z -]+, but this length needs \d+\. (?:Choose a shorter length under More options, or a practice focus with a wider [a-z, ]+ range\.|Choose a practice focus with a wider [a-z, ]+ range\.|Choose a shorter length under More options\.|No practice focus can widen this selection\.)$/u;

afterEach(cleanup);

describe("capacity-aware availability (issue #14)", () => {
  test("no selection the generator will reject is offered as available", () => {
    const offeredBy = emptyFamilyTally();
    const refusedBy = emptyFamilyTally();
    const refusals: SweepCell[] = [];
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const profile of SWEEP_PROFILES) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const printScale of PRINT_SCALES) {
            const generation = generationFor(worksheetType, profile, {
              length,
              printScale,
            });
            const where = `${worksheetType} ${profile.id} ${length}/${printScale}`;
            const control = controlVerdict(generation);
            // One assertion covers both directions: an offered selection must
            // produce, and a refused one must be refused with the very
            // sentence the parent was already shown.
            expect(`${where}: ${control}`).toBe(
              `${where}: ${generatorVerdict(generation)}`,
            );
            if (control === "produced") {
              offeredBy[worksheetType] += 1;
            } else {
              refusedBy[worksheetType] += 1;
              refusals.push({
                worksheetType,
                profileId: profile.id,
                length,
                printScale,
              });
            }
          }
        }
      }
    }

    // Every family must still be seen answering BOTH ways. A single global
    // counter let one family's refusal vouch for all four.
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
      profileId: d36QuantityProfile.id,
      length: "long",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "dry-math",
      profileId: d34DryMathProfile.id,
      length: "short",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "dry-math",
      profileId: starvedEquationProfile.id,
      length: "long",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "count-compare-make",
      profileId: starvedComparisonProfile.id,
      length: "short",
      printScale: "standard",
    });
    // The two untied numeral-matching regimes, one per binding maximum.
    expect(refusals).toContainEqual({
      worksheetType: "count-compare-make",
      profileId: starvedCountingMatchProfile.id,
      length: "short",
      printScale: "standard",
    });
    expect(refusals).toContainEqual({
      worksheetType: "count-compare-make",
      profileId: starvedNumeralMatchProfile.id,
      length: "short",
      printScale: "standard",
    });
  });

  test("the D36 Earlier-setting shortfall: a quantities-to-7 long Wow is refused before the click and Standard fills six groups", () => {
    const expected =
      "This practice focus provides 7 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider counting and numerals range.";

    // Only Long at standard scale starves; large print pulls Long down to the
    // six-group budget, and every shorter length fills.
    for (const length of WORKSHEET_LENGTHS) {
      for (const printScale of PRINT_SCALES) {
        const generation = generationFor("find-the-wow", d36QuantityProfile, {
          length,
          printScale,
        });
        const starves = length === "long" && printScale === "standard";
        expect(`${length}/${printScale}: ${controlVerdict(generation)}`).toBe(
          `${length}/${printScale}: ${starves ? expected : "produced"}`,
        );
        expect(`${length}/${printScale}: ${generatorVerdict(generation)}`).toBe(
          `${length}/${printScale}: ${starves ? expected : "produced"}`,
        );
      }
    }

    // The same verdict reaches the parent BEFORE the click: the seeded session
    // applies the child's earlier settings and the panel disables Create.
    const { onGenerate } = renderControls(d36QuantityProfile, "find-the-wow", {
      length: "long",
    });
    expect(screen.getByRole("button", { name: "Create worksheet" })).toBeDisabled();
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/This selection creates/u)).toBeNull();

    // Standard fills six groups, and the click hands over exactly the
    // selection the earlier settings map to, which the generator produces.
    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), {
      target: { value: "standard" },
    });
    expect(screen.queryByText(expected)).toBeNull();
    expect(
      screen.getByText("This selection creates 6 unique groups on one practice page."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create worksheet" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const handed = onGenerate.mock.calls[0]?.[0] as GenerationSelection;
    expect(handed.selection).toEqual(
      selectionFor("find-the-wow", d36QuantityProfile, { length: "standard" }),
    );
    const produced = generate(handed);
    expect(produced.ok).toBe(true);
    expect(produced.ok ? produced.session.document.items : []).toHaveLength(6);
  });

  test("the D34 Earlier-setting shortfall: Dry Math addition within 1 is refused at every length and scale with the practice-focus remedy only", () => {
    // Three facts can fill no Dry Math page, so a shorter length is never a
    // remedy that changes the answer; only a wider practice focus is.
    const required: Readonly<
      Record<`${WorksheetLengthChoice}/${PrintScaleChoice}`, number>
    > = {
      "short/standard": 8,
      "standard/standard": 12,
      "long/standard": 18,
      "short/large": 8,
      "standard/large": 8,
      "long/large": 12,
    };
    const observed: string[] = [];
    const wanted: string[] = [];
    for (const length of WORKSHEET_LENGTHS) {
      for (const printScale of PRINT_SCALES) {
        const cell = `${length}/${printScale}` as const;
        const generation = generationFor("dry-math", d34DryMathProfile, {
          length,
          printScale,
        });
        const control = controlVerdict(generation);
        expect(`${cell}: ${generatorVerdict(generation)}`).toBe(
          `${cell}: ${control}`,
        );
        observed.push(`${cell}: ${control}`);
        wanted.push(
          `${cell}: This practice focus provides 3 unique facts, but this length needs ${required[cell]}. Choose a practice focus with a wider results range.`,
        );
      }
    }
    expect(observed).toEqual(wanted);

    // The panel shows the refusal above a disabled Create.
    renderControls(d34DryMathProfile, "dry-math");
    expect(screen.getByRole("button", { name: "Create worksheet" })).toBeDisabled();
    expect(
      screen.getByText(/^This practice focus provides 3 unique facts/u),
    ).toBeInTheDocument();
  });

  test("quantity capacity edges disable exactly the lengths the limits cannot fill", () => {
    const expectations: readonly {
      readonly limit: number;
      readonly sufficient: Readonly<Record<WorksheetLengthChoice, boolean>>;
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
        const context = contextFor("find-the-wow", profile, { length });
        const support = registration.controls.getCapabilitySupport(context);
        expect(support.available).toBe(true);
        const verdict = support.available && support.capacity.sufficient;
        expect(`limit ${limit} ${length}: ${verdict}`).toBe(
          `limit ${limit} ${length}: ${sufficient[length]}`,
        );
        expect(
          generate(generationFor("find-the-wow", profile, { length })).ok,
        ).toBe(sufficient[length]);
      }
    }
  });

  test("equation capacity edges are measured in stems, not candidate pairs", () => {
    // Equation mode counts DISTINCT STEMS while each stem carries many
    // distractor pairs, so an arm that counted candidates would read as
    // hugely sufficient and reproduce issue #14 for every equation focus.
    // The rows below bracket the strict comparison: 6 stems against a
    // standard page needing exactly 6 must pass, 7 against a long page
    // needing 8 must fail.
    const expectations: readonly {
      readonly label: string;
      readonly profile: CapabilityProfileV1;
      readonly sufficient: Readonly<Record<WorksheetLengthChoice, boolean>>;
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
        const context = contextFor("find-the-wow", profile, { length });
        const support = registration.controls.getCapabilitySupport(context);
        expect(support.available).toBe(true);
        const verdict = support.available && support.capacity.sufficient;
        expect(`${label} ${length}: ${verdict}`).toBe(
          `${label} ${length}: ${sufficient[length]}`,
        );
        expect(
          generate(generationFor("find-the-wow", profile, { length })).ok,
        ).toBe(sufficient[length]);
      }
    }

    // The mode is named in the sentence, and the remedy names the maxima this
    // mode really reads rather than the counting range it ignores.
    const message = capacityMessage(
      contextFor(
        "find-the-wow",
        equationProfile("2222222c-2222-4222-8222-222222222222", 1, 2, [
          "addition",
          "subtraction",
        ]),
        { length: "long" },
      ),
    );
    // Only OPERANDS are named: at operands 1 / results 2 the addition and
    // subtraction pools are held down by the operand limit, and lifting the
    // result limit alone adds no stem at all.
    expect(message).toBe(
      "This practice focus provides 7 unique equation groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider operands range.",
    );
  });

  test("every probing family reaches the DOM with its own shortage sentence", () => {
    // The verdict being right is not the same as the verdict being SHOWN. A
    // registration that computed the shortage correctly and never surfaced it
    // would ship silently, so each family's own sentence is read off a node.
    const cases: readonly {
      readonly profile: CapabilityProfileV1;
      readonly worksheetType: RegisteredWorksheetType;
      readonly shown: Partial<ShownDefaults>;
      readonly message: string;
    }[] = [
      {
        profile: starvedEquationProfile,
        worksheetType: "dry-math",
        shown: { length: "long" },
        message:
          "This practice focus provides 6 unique facts, but this length needs 18. Choose a practice focus with a wider results range.",
      },
      {
        profile: starvedComparisonProfile,
        worksheetType: "count-compare-make",
        shown: { length: "short" },
        message:
          "This practice focus provides 1 unique group-comparison exercises, but this length needs 2. Choose a practice focus with a wider comparisons range.",
      },
      {
        profile: d36QuantityProfile,
        worksheetType: "find-the-wow",
        shown: { length: "long" },
        message:
          "This practice focus provides 7 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider counting and numerals range.",
      },
      // The same family, the same subtype, two different binding maxima. A
      // selector that named both, or always named counting, passes the tied
      // fixture above and fails exactly one of these two.
      {
        profile: starvedCountingMatchProfile,
        worksheetType: "count-compare-make",
        shown: { length: "short" },
        message:
          "This practice focus provides 0 unique numeral-matching exercises, but this length needs 2. Choose a practice focus with a wider counting range.",
      },
      {
        profile: starvedNumeralMatchProfile,
        worksheetType: "count-compare-make",
        shown: { length: "short" },
        message:
          "This practice focus provides 0 unique numeral-matching exercises, but this length needs 2. Choose a practice focus with a wider numerals range.",
      },
    ];
    for (const { profile, worksheetType, shown, message } of cases) {
      renderControls(profile, worksheetType, shown);
      expect(
        screen.getByRole("button", { name: "Create worksheet" }),
      ).toBeDisabled();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.queryByText(/This selection creates/u)).toBeNull();
      cleanup();
    }
  });

  test("every catalog focus, variant, vocabulary, length and scale is offered exactly when the generator produces it", () => {
    // Each catalog value is a choice a parent can make directly, so each one
    // is swept through the control and the real generator; any refusal must
    // carry the generator's own sentence. The starving cells are recorded and
    // pinned per source, so a catalog value that starts to starve fails here
    // and must be declared as a further source.
    const catalogSelections: {
      readonly source: string;
      readonly selection: WorksheetSelectionV2;
    }[] = [];
    for (const option of PRACTICE_FOCUS_CATALOG["dry-math"]) {
      catalogSelections.push({
        source: `dry-math ${option.id}`,
        selection: { ...BASE_SELECTION, worksheetType: "dry-math", dryMath: option.focus },
      });
    }
    for (const option of PRACTICE_FOCUS_CATALOG["find-the-wow-quantity"]) {
      catalogSelections.push({
        source: `find-the-wow quantity ${option.id}`,
        selection: {
          ...BASE_SELECTION,
          worksheetType: "find-the-wow",
          findTheWow: { ...BASE_SELECTION.findTheWow, variant: "quantity", quantity: option.focus },
        },
      });
    }
    for (const option of PRACTICE_FOCUS_CATALOG["find-the-wow-equation"]) {
      catalogSelections.push({
        source: `find-the-wow equation ${option.id}`,
        selection: {
          ...BASE_SELECTION,
          worksheetType: "find-the-wow",
          findTheWow: { ...BASE_SELECTION.findTheWow, variant: "equation", equation: option.focus },
        },
      });
    }
    for (const option of PRACTICE_FOCUS_CATALOG["count-compare-make"]) {
      catalogSelections.push({
        source: `count-compare-make ${option.id}`,
        selection: {
          ...BASE_SELECTION,
          worksheetType: "count-compare-make",
          countCompareMake: option.focus,
        },
      });
    }
    for (const variant of WRITING_MODES) {
      for (const vocabulary of SENTENCE_VOCABULARY_OPTIONS) {
        catalogSelections.push({
          source: `sentence-builder ${variant} ${vocabulary}`,
          selection: {
            ...BASE_SELECTION,
            worksheetType: "sentence-builder",
            sentenceBuilder: { variant, vocabulary },
          },
        });
      }
    }
    expect(catalogSelections).toHaveLength(
      PRACTICE_FOCUS_CATALOG["dry-math"].length +
        PRACTICE_FOCUS_CATALOG["find-the-wow-quantity"].length +
        PRACTICE_FOCUS_CATALOG["find-the-wow-equation"].length +
        PRACTICE_FOCUS_CATALOG["count-compare-make"].length +
        WRITING_MODES.length * SENTENCE_VOCABULARY_OPTIONS.length,
    );

    // Two children: one whose reviewed interests reach the interest-reading
    // families, and one with none, so the Sentence Builder pool is measured
    // both with and without topics.
    const children: readonly ChildProfileV2[] = [
      profileWithLegacyChoices(preschoolQuantityProfile),
      { ...profileWithLegacyChoices(independentProfile), interests: [] },
    ];
    const starving = new Map<string, string[]>();
    const observe = (source: string, generation: GenerationSelection): void => {
      const { length, printScale } = generation.selection;
      const where = `${source} ${length}/${printScale}`;
      const control = controlVerdict(generation);
      expect(`${where}: ${control}`).toBe(
        `${where}: ${generatorVerdict(generation)}`,
      );
      if (control !== "produced") {
        const cells = starving.get(source) ?? [];
        if (!cells.includes(`${length}/${printScale}`)) {
          cells.push(`${length}/${printScale}`);
        }
        starving.set(source, cells);
      }
    };
    let cells = 0;
    for (const { source, selection } of catalogSelections) {
      for (const length of WORKSHEET_LENGTHS) {
        for (const printScale of PRINT_SCALES) {
          cells += 1;
          for (const profile of children) {
            observe(source, {
              profile,
              selection: { ...selection, length, printScale },
            });
          }
        }
      }
    }
    expect(cells).toBe(
      catalogSelections.length * WORKSHEET_LENGTHS.length * PRINT_SCALES.length,
    );
    // No catalog value starves any cell.
    expect([...starving]).toEqual([]);

    // The two declared Earlier-setting sources, swept the same way.
    for (const length of WORKSHEET_LENGTHS) {
      for (const printScale of PRINT_SCALES) {
        observe(
          "D34",
          generationFor("dry-math", d34DryMathProfile, { length, printScale }),
        );
        observe(
          "D36",
          generationFor("find-the-wow", d36QuantityProfile, { length, printScale }),
        );
      }
    }
    expect(Object.fromEntries(starving)).toEqual({
      D34: [
        "short/standard",
        "short/large",
        "standard/standard",
        "standard/large",
        "long/standard",
        "long/large",
      ],
      D36: ["long/standard"],
    });
  });
});

describe("shortage remedies a parent can actually take (issue #16)", () => {
  test("a comparison shortage names comparisons and offers no length that helps", () => {
    // `compare` is drawn from min(countingMax, compareMax) while the other
    // three subtypes follow numerals, and short and standard both ask for two
    // comparisons. Naming counting, or offering a shorter length, would be
    // two remedies that cannot change this answer.
    const message = capacityMessage(
      contextFor("count-compare-make", starvedComparisonProfile, {
        length: "short",
      }),
    );
    expect(message).toBe(
      "This practice focus provides 1 unique group-comparison exercises, but this length needs 2. Choose a practice focus with a wider comparisons range.",
    );

    // Standard asks for the same two comparisons, so a shorter length is
    // still not offered there either.
    expect(
      capacityMessage(
        contextFor("count-compare-make", starvedComparisonProfile, {
          length: "standard",
        }),
      ),
    ).not.toContain("shorter length");

    // Long asks for three, and a shorter length would lower that to two - but
    // one comparison fills neither, so a shorter length is still no remedy.
    expect(
      capacityMessage(
        contextFor("count-compare-make", starvedComparisonProfile, {
          length: "long",
        }),
      ),
    ).toBe(
      "This practice focus provides 1 unique group-comparison exercises, but this length needs 3. Choose a practice focus with a wider comparisons range.",
    );
  });

  test("a maximum already at the Version 1 ceiling is never the remedy", () => {
    // In each case one of the two maxima the family reads is already at 20 -
    // the ceiling its focus cannot exceed - so naming it sends the parent to a
    // range that cannot widen.
    const quantitiesAtCeiling = quantityProfile(
      "9a8b7c6d-5e4f-4302-8110-fedcba987654",
      { countingMax: 20, numeralMax: 6, compareMax: 20 },
    );
    expect(
      capacityMessage(
        contextFor("find-the-wow", quantitiesAtCeiling, { length: "long" }),
      ),
    ).toBe(
      "This practice focus provides 6 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider numerals range.",
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
        contextFor("dry-math", operandsAtCeiling, { length: "standard" }),
      ),
    ).toBe(
      "This practice focus provides 6 unique facts, but this length needs 12. Choose a practice focus with a wider results range.",
    );
  });

  test("a shortage at the shortest page never offers a shorter page", () => {
    const message = capacityMessage(
      contextFor("dry-math", starvedEquationProfile, { length: "short" }),
    );
    // Operands are NOT named: at operands 2 / results 2 an addition pool is
    // bounded by the result limit alone, so widening the operand range adds no
    // fact and sending the parent there is advice that cannot work.
    expect(message).toBe(
      "This practice focus provides 6 unique facts, but this length needs 8. Choose a practice focus with a wider results range.",
    );

    // Large print already pulls standard down to the short budget, so the
    // shorter option cannot lower the requirement there either.
    expect(
      capacityMessage(
        contextFor("dry-math", starvedEquationProfile, {
          length: "standard",
          printScale: "large",
        }),
      ),
    ).not.toContain("shorter length");
  });

  test("no shortage sentence mentions Difficulty and every remedy names the length or the practice focus", () => {
    // Calibration: the retired Difficulty remedy and the retired profile
    // remedy are both rejected by the pattern every live sentence must match.
    expect(
      "The confirmed limits provide 7 unique quantity groups, but this length needs 8. Choose a shorter worksheet or review the profile's counting and numerals limits. Setting Difficulty to Practice also fills this selection, without changing the profile.",
    ).not.toMatch(SHORTAGE_SENTENCE);
    expect(
      "This practice focus provides 7 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider counting and numerals range. Setting Difficulty to Practice also fills this selection.",
    ).not.toMatch(SHORTAGE_SENTENCE);

    const messages = new Set<string>();
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const profile of SWEEP_PROFILES) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const printScale of PRINT_SCALES) {
            const verdict = controlVerdict(
              generationFor(worksheetType, profile, { length, printScale }),
            );
            if (verdict !== "produced") {
              messages.add(verdict);
            }
          }
        }
      }
    }
    for (const message of messages) {
      expect(message).not.toMatch(/difficulty|stretch|confidence/iu);
      expect(message).not.toMatch(/\bprofile\b/iu);
      expect(message).toMatch(SHORTAGE_SENTENCE);
    }
    // Both live remedy forms are observed, so the loop above is not vacuous
    // over one shape.
    const remedies = new Set(
      [...messages].map((message) =>
        message.includes("Choose a shorter length under More options, or")
          ? "length-or-focus"
          : "focus-only",
      ),
    );
    expect([...remedies].sort()).toEqual(["focus-only", "length-or-focus"]);
  });
});

describe("family-aware limiting-resource copy (issue #16)", () => {
  test("advice names exactly the resources the family really reads", () => {
    // Pinned literally rather than derived from `getRelevantMaximums`: an
    // advice sentence built from a swapped list agrees with a swapped list.
    const expected: Readonly<Record<RegisteredWorksheetType, string>> = {
      "dry-math":
        "Dry Math varies within the operands and results range of this practice focus. Choose a practice focus with a wider range, or create a new worksheet later.",
      "count-compare-make":
        "Count, Compare & Make varies within the counting, numerals, and comparisons range of this practice focus. Choose a practice focus with a wider range, or create a new worksheet later.",
      // Quantity pictures: the same family, a different pair of maxima.
      "find-the-wow":
        "Math — Two Whats and a Wow varies within the counting and numerals range of this practice focus. Choose a practice focus with a wider range, or create a new worksheet later.",
      "sentence-builder":
        "Sentence Builder varies within the reviewed vocabulary for Picture Labels, which no practice focus can widen. Choose a different Writing activity, or create a new worksheet later.",
    };
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      expect(
        getWorksheetRegistration(
          worksheetType,
        ).controls.getLimitingResourceAdvice(
          contextFor(worksheetType, preschoolQuantityProfile),
        ),
      ).toBe(expected[worksheetType]);
    }

    // Equations must not be explained in counting terms, and a quantity page
    // must not be explained in operand terms.
    const equationAdvice = getWorksheetRegistration(
      "find-the-wow",
    ).controls.getLimitingResourceAdvice(
      contextFor("find-the-wow", independentProfile),
    );
    expect(equationAdvice).toContain("operands and results range");
    expect(equationAdvice).not.toContain("counting");
  });

  test("the declared maximums and the advice sentence stay one list", () => {
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const registration = getWorksheetRegistration(worksheetType);
      for (const profile of SWEEP_PROFILES) {
        const context = contextFor(worksheetType, profile);
        const maximums = registration.controls.getRelevantMaximums(context);
        const advice = registration.controls.getLimitingResourceAdvice(context);
        if (maximums.length === 0) {
          // Nothing numeric bounds this page, so nothing may send the parent
          // to a numeric range.
          expect(`${worksheetType}: ${advice}`).not.toMatch(/range/iu);
        } else {
          for (const { label } of maximums) {
            expect(advice).toContain(label);
          }
          expect(advice).toMatch(/range of this practice focus/u);
        }
      }
    }
  });

  test("the shared exhaustion message derives its explanation from the registration", () => {
    const exhaust = (
      worksheetType: RegisteredWorksheetType,
      profile: CapabilityProfileV1,
    ): string => {
      const generation = generationFor(worksheetType, profile);
      const current = generate(generation);
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
        generation,
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
    expect(sentenceBuilder).toContain("reviewed vocabulary for Independent Writing");
    expect(sentenceBuilder).not.toMatch(/range|limits/iu);

    const dryMath = exhaust("dry-math", independentProfile);
    expect(dryMath).toContain("No different worksheet was found in 16 attempts.");
    expect(dryMath).toContain("operands and results range");

    // Quantity pictures is the variant-dependent case: its advice must follow
    // the variant the selection really holds, not the family's whole key set.
    const quantityWow = exhaust("find-the-wow", preschoolQuantityProfile);
    expect(quantityWow).toContain("counting and numerals range");
    expect(quantityWow).not.toContain("operands");

    const countCompare = exhaust(
      "count-compare-make",
      preschoolQuantityProfile,
    );
    expect(countCompare).toContain("counting, numerals, and comparisons range");
  });
});

describe("Sentence Builder word banks against the shipped vocabulary", () => {
  test("no reviewed mode, band, length or print scale can starve a bank", () => {
    // This is what lets the registration answer `SUFFICIENT_CAPACITY` for
    // Sentence Builder without a numeric probe, and it is the guard that must
    // fail if a later step adds a thinner reviewed topic: a bank shortfall
    // would then reach a parent as a plain unavailable message with no
    // capacity explanation behind it. Each vocabulary choice selects one
    // presentation band, so the Writing activity x Vocabulary grid reaches
    // every mode and band.
    let bankCells = 0;
    for (const variant of WRITING_MODES) {
      for (const vocabulary of SENTENCE_VOCABULARY_OPTIONS) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const printScale of PRINT_SCALES) {
            const support = getSentenceBuilderCapabilitySupport(
              variant,
              presentationBandForVocabulary(vocabulary),
              length,
              printScale,
            );
            const where = `${variant}/${vocabulary}/${length}/${printScale}`;
            const reason = support.available ? "" : support.reason;
            expect(`${where}: ${reason}`).not.toContain("word-bank words");
            if (
              support.available &&
              getSentenceBuilderBankSize(variant, length, printScale) > 0
            ) {
              bankCells += 1;
            }
          }
        }
      }
    }
    // Counting AVAILABLE cells alone was vacuous: the two activities that
    // print no bank are available too, so a bank size stuck at zero still
    // satisfied a "greater than zero" tally. The bank-bearing subset is every
    // (bank activity, vocabulary, length, print scale) cell - derived from the
    // code-owned lists rather than multiplied out here.
    expect(bankCells).toBe(
      BANK_WRITING_MODES.length *
        SENTENCE_VOCABULARY_OPTIONS.length *
        WORKSHEET_LENGTHS.length *
        PRINT_SCALES.length,
    );
    // Both vocabulary choices reach distinct bands, so the grid is not one
    // band measured twice.
    expect(
      new Set(SENTENCE_VOCABULARY_OPTIONS.map(presentationBandForVocabulary)).size,
    ).toBe(SENTENCE_VOCABULARY_OPTIONS.length);
  });
});

describe("stored capabilities Version 1 keeps but never uses", () => {
  // Every earlier setting this child stores above a family's range, in the
  // order the mapping reports them, then both stored permissions. Written out
  // rather than derived so a reordered or renamed label is a visible diff here.
  // Dry Math's range reaches 100, so its 25s are used as stored.
  const BEYOND_V1_DISCLOSURE =
    "Earlier settings this version adjusts or does not use: " +
    "Two Whats and a Wow quantity pictures counting: stored 25, using 20. " +
    "Two Whats and a Wow quantity pictures numerals: stored 25, using 20. " +
    "Two Whats and a Wow equations operands: stored 25, using 20. " +
    "Two Whats and a Wow equations results: stored 25, using 20. " +
    "Count, Compare & Make counting: stored 25, using 20. " +
    "Count, Compare & Make numerals: stored 25, using 20. " +
    "Count, Compare & Make comparisons: stored 25, using 20. " +
    "Carrying and borrowing: stored but not used. " +
    "Negative results: stored but not used.";

  function disclosureText(): string | null {
    return (
      document.querySelector("[data-earlier-settings-disclosure]")?.textContent ??
      null
    );
  }

  test("a maximum above 20 and both future permissions are shown", () => {
    // The literal is the production sentence builder's own output.
    const { legacyChoices } = profileWithLegacyChoices(beyondV1Profile);
    if (legacyChoices === undefined) {
      throw new Error("A capability fixture always stores earlier settings.");
    }
    const mapped = selectionFromEarlierSettings(legacyChoices, BASE_SELECTION);
    expect(
      `Earlier settings this version adjusts or does not use: ${mapped.disclosures
        .map(describeEarlierSettingDisclosure)
        .join(" ")}`,
    ).toBe(BEYOND_V1_DISCLOSURE);

    renderControls(beyondV1Profile, "dry-math");
    expect(disclosureText()).toBe(BEYOND_V1_DISCLOSURE);
    expect(disclosureText()).not.toContain("Dry Math");
    cleanup();

    // Mirror: above Dry Math's own range of 100, Dry Math IS disclosed, so
    // its absence above is the range at work rather than a missing group.
    renderControls(
      {
        ...beyondV1Profile,
        id: "9f6c1f1a-1c2d-4e3f-8a4b-5c6d7e8f9a0c",
        mathSkills: { ...beyondV1Profile.mathSkills, operandMax: 101, resultMax: 101 },
      },
      "dry-math",
    );
    expect(disclosureText()).toContain(
      "Dry Math operands: stored 101, using 100. Dry Math results: stored 101, using 100.",
    );
  });

  test("both stored disclosures are announced on selections that print no arithmetic", () => {
    // Both disclosures are about what the child's earlier settings store and
    // what this version will not do with them, so both belong on every
    // selection - including the two families that read no operand or result.
    for (const worksheetType of [
      "count-compare-make",
      "sentence-builder",
    ] as const) {
      renderControls(beyondV1Profile, worksheetType);
      expect(`${worksheetType}: ${disclosureText()}`).toBe(
        `${worksheetType}: ${BEYOND_V1_DISCLOSURE}`,
      );
      cleanup();
    }
  });

  test("a profile storing nothing above the envelope and neither permission is told nothing", () => {
    // The other half of both contracts: the notice reports what is stored, so
    // a child at the ceiling with both flags false must produce no sentence at
    // all. Without this an always-rendered notice would satisfy the two tests
    // above.
    renderControls(independentProfile, "count-compare-make");
    expect(disclosureText()).toBeNull();
    expect(screen.queryByText(/stored but not used/u)).toBeNull();
    expect(screen.queryByText(/Earlier settings this version/u)).toBeNull();
  });
});

describe("stored generation defaults", () => {
  test("the save button asks the host once and passes nothing", async () => {
    // The host builds the save body from its own session state
    // (`defaultsForSave`, pinned in worksheet-session.test.ts); the panel only
    // asks for the save.
    const onSaveDefaults = vi.fn(async (...args: unknown[]) => {
      void args;
    });
    renderControls(independentProfile, "sentence-builder", {}, onSaveDefaults);
    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    await screen.findByText("Worksheet defaults saved locally.");

    expect(onSaveDefaults).toHaveBeenCalledTimes(1);
    expect(onSaveDefaults.mock.calls[0]).toEqual([]);
  });

  test("the save confirmation lands in this panel and retires when a choice changes", async () => {
    // It used to render in the global profiles status line far above the
    // button, so the click produced no visible change anywhere near the
    // pointer - and it then sat there beside selections the parent had since
    // changed and not saved, with nothing telling saved from unsaved apart.
    renderControls(independentProfile, "count-compare-make");
    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    const confirmation = await screen.findByText(
      "Worksheet defaults saved locally.",
    );
    // The panel's own <section> is the whole component, so `closest` on it is
    // satisfied by anything this component renders - including the top of the
    // panel, far above the button, which is the defect being fixed. The slot
    // holding the button is the smallest node that means "beside it".
    const saveButton = screen.getByRole("button", {
      name: "Save these as worksheet defaults",
    });
    const slot = saveButton.closest("[data-defaults-slot]");
    expect(slot).not.toBeNull();
    expect(confirmation.parentElement).toBe(slot);
    const slotChildren = [...(slot?.children ?? [])];
    expect(slotChildren.indexOf(confirmation)).toBeGreaterThan(
      slotChildren.indexOf(saveButton),
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), {
      target: { value: "long" },
    });
    expect(
      screen.queryByText("Worksheet defaults saved locally."),
    ).toBeNull();
  });

  test("an in-app reload keeps the parent's child and worksheet type", () => {
    // The panel's half of an in-app reload: reloaded defaults arriving
    // through the session must not reset the child or the family, and they do
    // move a group the parent has not changed.
    const second: CapabilityProfileV1 = {
      ...preschoolQuantityProfile,
      id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      displayName: "Private Second Child",
    };
    let dispatch: Dispatch<WorksheetSessionAction> | undefined;
    const profiles = [independentProfile, second].map(profileWithLegacyChoices);
    renderPanel({
      defaults: storedDefaults(),
      onDispatch: (next) => {
        dispatch = next;
      },
      profiles,
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
      target: { value: second.id },
    });
    chooseWorksheet("count-compare-make");

    act(() => {
      dispatch?.({
        type: "reloaded",
        defaults: storedDefaults({ length: "long" }),
        profiles,
      });
    });
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      second.id,
    );
    expect(worksheetCard("count-compare-make")).toBeChecked();
    openMoreOptions();
    expect(screen.getByRole("combobox", { name: "Length" })).toHaveValue("long");
  });

  test("a profile removed under the panel falls back to a real option", () => {
    const second: CapabilityProfileV1 = {
      ...preschoolQuantityProfile,
      id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      displayName: "Private Second Child",
    };
    let dispatch: Dispatch<WorksheetSessionAction> | undefined;
    renderPanel({
      defaults: storedDefaults(),
      onDispatch: (next) => {
        dispatch = next;
      },
      profiles: [independentProfile, second].map(profileWithLegacyChoices),
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
      target: { value: second.id },
    });
    act(() => {
      dispatch?.({
        type: "profilesChanged",
        profiles: [independentProfile].map(profileWithLegacyChoices),
      });
    });
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      independentProfile.id,
    );
  });

  test("a failed save shows its alert in the slot and keeps the selection", async () => {
    renderControls(independentProfile, "dry-math", {}, async () => {
      throw new Error("fixture failure");
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), {
      target: { value: "short" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The worksheet defaults could not be saved. Nothing was changed.",
    );
    expect(alert.closest("[data-defaults-slot]")).not.toBeNull();
    expect(screen.queryByText("Worksheet defaults saved locally.")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Length" })).toHaveValue("short");
  });
});

/*
 * Age is gone from the generator (P2, DD10), and Difficulty with it (DD11):
 * a child's earlier settings only supply starting choices, and a child
 * without them starts from the saved defaults.
 */
describe("age-free generator introduction and child choice", () => {
  test("no age input or age label exists in the panel", () => {
    renderControls(independentProfile, "dry-math");
    expect(screen.queryByRole("spinbutton", { name: /\bages?\b/iu })).toBeNull();
    expect(screen.queryByLabelText(/\bages?\b/iu)).toBeNull();
    const panel = screen.getByRole("region", { name: "Create a practice worksheet" });
    expect(panel.textContent ?? "").not.toMatch(/\bages?\b/iu);
  });

  test("the generator introduction shows the early-primary help text verbatim", () => {
    renderControls(independentProfile, "count-compare-make");
    const help = screen.getByText(EARLY_PRIMARY_HELP_TEXT);
    expect(help).toBeVisible();
    expect(help.textContent).toBe(
      "Extra Credit's worksheets are designed for early primary practice. Choose the worksheet and practice focus that fit your child.",
    );
    expect(EARLY_PRIMARY_HELP_TEXT).not.toMatch(/\bages?\b/iu);
  });

  test("each child is listed by nickname, or as Profile N without one", () => {
    const { displayName: _unused, ...unnamed } = independentProfile;
    void _unused;
    renderPanel({
      defaults: storedDefaults(),
      profiles: [
        profileWithLegacyChoices(preschoolQuantityProfile),
        profileWithLegacyChoices(unnamed),
      ],
    });
    const options = [...screen.getByRole("combobox", { name: "Child profile" }).querySelectorAll("option")];
    expect(options.map((option) => option.textContent)).toEqual([
      "Private Quantity Child",
      "Profile 2",
    ]);
  });

  test("a profile without earlier settings is available and uses the saved defaults", () => {
    const { legacyChoices: _unused, ...identityOnly }: ChildProfileV2 =
      profileWithLegacyChoices(independentProfile);
    void _unused;
    const createFor = (
      profile: ChildProfileV2,
      worksheetType: RegisteredWorksheetType,
    ): GenerationSelection => {
      const onGenerate = vi.fn();
      renderPanel({ defaults: storedDefaults(), onGenerate, profiles: [profile] });
      chooseWorksheet(worksheetType);
      const create = screen.getByRole("button", { name: "Create worksheet" });
      expect(create, worksheetType).toBeEnabled();
      expect(document.getElementById("generation-unavailable")).toBeNull();
      expect(document.getElementById("generation-capacity")).toBeNull();
      fireEvent.click(create);
      expect(onGenerate).toHaveBeenCalledTimes(1);
      cleanup();
      return onGenerate.mock.calls[0]?.[0] as GenerationSelection;
    };

    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const handed = createFor(identityOnly, worksheetType);
      expect(handed.selection, worksheetType).toEqual({
        ...worksheetSelectionOf(storedDefaults()),
        worksheetType,
      });
      expect(generate(handed).ok, worksheetType).toBe(true);
    }

    // Mirror: the same child WITH earlier settings starts from them instead,
    // so the equality above is the absent settings at work.
    const seeded = createFor(profileWithLegacyChoices(independentProfile), "dry-math");
    expect(seeded.selection.dryMath).toEqual(
      selectionFor("dry-math", independentProfile).dryMath,
    );
    expect(seeded.selection.dryMath).not.toEqual(
      worksheetSelectionOf(storedDefaults()).dryMath,
    );
  });

  test("no Difficulty control or stretch wording exists in the panel", () => {
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      renderControls(independentProfile, worksheetType, { length: "long" });
      expect(
        screen.queryByRole("combobox", { name: /difficulty/iu }),
        worksheetType,
      ).toBeNull();
      expect(screen.queryByLabelText(/difficulty|stretch/iu)).toBeNull();
      const panel = screen.getByRole("region", {
        name: "Create a practice worksheet",
      });
      const text = panel.textContent ?? "";
      // Non-vacuity: the panel's own controls rendered, More options included.
      expect(text).toContain("Create worksheet");
      expect(text).toContain("More options");
      expect(`${worksheetType}: ${text}`).not.toMatch(
        /difficulty|stretch|confidence/iu,
      );
      // The stored length still reaches the panel without a Difficulty step.
      expect(
        screen.getByRole("combobox", { name: "Length" }),
        worksheetType,
      ).toHaveValue("long");
      cleanup();
    }
  });
});

/* Controlled-panel contract tests, rendered over the production session reducer. */
describe("worksheet-first panel", () => {
  /** A child with a nickname and equations, so every control can appear. */
  const nicknamed = profileWithLegacyChoices(independentProfile);

  /** Asserts that each element precedes the next in document order. */
  function expectDocumentOrder(elements: readonly (Element | null)[]): void {
    for (const [index, element] of elements.entries()) {
      expect(element, `element ${index}`).not.toBeNull();
      const next = elements[index + 1];
      if (element !== null && next !== undefined && next !== null) {
        expect(
          element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
          `element ${index} precedes element ${index + 1}`,
        ).toBeTruthy();
      }
    }
  }

  function panelControl(name: string): Element | null {
    return document.querySelector(`[data-panel-control="${name}"]`);
  }

  test("the choices run worksheet type, variant, child, focus or vocabulary, summary, then Create", () => {
    const create = (): HTMLElement =>
      screen.getByRole("button", { name: "Create worksheet" });
    const summary = (): Element | null =>
      document.querySelector("[data-selection-summary]");

    renderPanel({ defaults: storedDefaults(), profiles: [nicknamed] });
    chooseWorksheet("find-the-wow");
    expectDocumentOrder([
      panelControl("worksheet-type"),
      screen.getByRole("group", { name: "Statements" }),
      screen.getByRole("combobox", { name: "Child profile" }),
      screen.getByRole("combobox", { name: "Practice focus" }),
      summary(),
      create(),
    ]);
    expect(summary()?.textContent).toMatch(/This selection creates/u);

    chooseWorksheet("sentence-builder");
    expectDocumentOrder([
      panelControl("worksheet-type"),
      screen.getByRole("group", { name: "Writing activity" }),
      screen.getByRole("combobox", { name: "Child profile" }),
      screen.getByRole("group", { name: "Vocabulary" }),
      summary(),
      create(),
    ]);
    expect(screen.queryByRole("combobox", { name: "Practice focus" })).toBeNull();

    // A family without a variant goes straight from the cards to the child.
    chooseWorksheet("dry-math");
    expect(screen.queryByRole("group", { name: "Statements" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Writing activity" })).toBeNull();
    expectDocumentOrder([
      panelControl("worksheet-type"),
      screen.getByRole("combobox", { name: "Child profile" }),
      screen.getByRole("combobox", { name: "Practice focus" }),
      summary(),
      create(),
    ]);
  });

  test("the four worksheet types are radio cards with a one-line description", () => {
    renderPanel({ defaults: storedDefaults(), profiles: [nicknamed] });
    const cards = screen.getAllByRole("radio").filter(
      (radio) => radio.getAttribute("name") === "worksheet-type",
    );
    expect(cards.map((card) => card.getAttribute("value"))).toEqual([
      ...REGISTERED_WORKSHEET_IDS,
    ]);
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const card = worksheetCard(worksheetType);
      const description = document.getElementById(
        card.getAttribute("aria-describedby") ?? "",
      );
      expect(description?.textContent ?? "", worksheetType).not.toBe("");
      expect(card.closest("fieldset")?.querySelector("legend")?.textContent).toBe(
        "Worksheet type",
      );
    }
  });

  test("More options holds exactly Length, the answer key, Personalization and Print layout", () => {
    renderPanel({ defaults: storedDefaults(), profiles: [nicknamed] });
    chooseWorksheet("count-compare-make");
    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    const groups = [...(details?.querySelectorAll("[data-more-options-group]") ?? [])];
    expect(groups.map((group) => group.querySelector("legend")?.textContent)).toEqual([
      "Length",
      "Answer key",
      "Personalization",
      "Print layout",
    ]);
    // Every control inside More options belongs to one of those groups, and
    // they are exactly these controls.
    const controlsInside = [
      ...(details?.querySelectorAll("input, select, textarea, button") ?? []),
    ];
    expect(
      controlsInside.every((control) => control.closest("[data-more-options-group]") !== null),
    ).toBe(true);
    expect(
      controlsInside.map(
        (control) =>
          control.getAttribute("aria-label") ??
          control.closest("label")?.textContent?.trim() ??
          "",
      ),
    ).toEqual([
      "Length",
      "Include a parent answer key",
      "Put the nickname in the worksheet header",
      "Include decorative graphics",
      "Theme",
      "Paper size",
      "Print scale",
    ]);
    // Nothing that belongs to the primary block is hidden in there.
    for (const name of ["Child profile", "Practice focus"]) {
      expect(screen.getByRole("combobox", { name }).closest("details")).toBeNull();
    }
    expect(worksheetCard("dry-math").closest("details")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create worksheet" }).closest("details"),
    ).toBeNull();
  });

  test("every blocking message sits outside More options and describes Create", () => {
    const expectBlocking = (): void => {
      const messages = [...document.querySelectorAll("[data-blocking-message]")];
      expect(messages.length).toBeGreaterThan(0);
      const create = screen.getByRole("button", { name: "Create worksheet" });
      expect(create).toBeDisabled();
      const describedBy = (create.getAttribute("aria-describedby") ?? "").split(/\s+/u);
      for (const message of messages) {
        expect(message.closest("details")).toBeNull();
        expect(describedBy).toContain(message.id);
        // Visible while More options stays collapsed.
        expect(message).toBeVisible();
      }
      expect(document.querySelector("details")?.open).toBe(false);
    };

    // No saved child yet.
    renderPanel({ defaults: storedDefaults(), profiles: [] });
    expectBlocking();
    expect(screen.getByText("Add and save a profile before creating a worksheet.")).toBeVisible();
    cleanup();

    // A capacity shortfall (the D34 earlier setting).
    renderPanel({
      defaults: storedDefaults(),
      profiles: [profileWithLegacyChoices(d34DryMathProfile)],
    });
    expectBlocking();
    expect(document.querySelector("[data-capacity-conflict]")?.textContent).toMatch(
      /^This practice focus provides 3 unique facts/u,
    );
    cleanup();

    // Calibration: a producible selection has no blocking message and no
    // description on Create.
    renderPanel({ defaults: storedDefaults(), profiles: [nicknamed] });
    expect(document.querySelector("[data-blocking-message]")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create worksheet" }),
    ).not.toHaveAttribute("aria-describedby");
  });

  test("practice-focus option labels are describePracticeFocus, plus one Earlier setting option when needed", () => {
    const optionLabels = (): string[] =>
      [
        ...screen
          .getByRole("combobox", { name: "Practice focus" })
          .querySelectorAll("option"),
      ].map((option) => option.textContent ?? "");
    const catalogLabels = (kind: PracticeFocusKind): string[] =>
      PRACTICE_FOCUS_CATALOG[kind].map((option) =>
        describePracticeFocus(kind, option.focus),
      );

    // The saved defaults match catalog entries, so no extra option shows.
    renderPanel({ defaults: storedDefaults({}, false), profiles: [nicknamed] });
    expect(optionLabels()).toEqual(catalogLabels("dry-math"));
    chooseWorksheet("count-compare-make");
    expect(optionLabels()).toEqual(catalogLabels("count-compare-make"));
    chooseWorksheet("find-the-wow");
    expect(optionLabels()).toEqual(catalogLabels("find-the-wow-quantity"));
    fireEvent.click(screen.getByRole("radio", { name: "Equations" }));
    expect(optionLabels()).toEqual(catalogLabels("find-the-wow-equation"));
    cleanup();

    // A seeded value outside the catalog adds exactly one Earlier setting
    // option, selected and worded by the same function.
    renderPanel({ defaults: storedDefaults(), profiles: [profileWithLegacyChoices(beyondV1Profile)] });
    const seededDryMath = selectionFor("dry-math", beyondV1Profile).dryMath;
    expect(optionLabels()).toEqual([
      `Earlier setting: ${describePracticeFocus("dry-math", seededDryMath)}`,
      ...catalogLabels("dry-math"),
    ]);
    expect(screen.getByRole("combobox", { name: "Practice focus" })).toHaveValue(
      "earlier-setting",
    );
  });

  test("each control change dispatches exactly one session action", () => {
    const onChange = vi.fn<(action: WorksheetPanelAction) => void>();
    const second = profileWithLegacyChoices({
      ...preschoolQuantityProfile,
      id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      displayName: "Private Second Child",
    });
    renderPanel({ defaults: storedDefaults(), onChange, profiles: [nicknamed, second] });
    openMoreOptions();

    const expectOne = (expected: WorksheetPanelAction, perform: () => void): void => {
      onChange.mockClear();
      perform();
      expect(onChange.mock.calls).toEqual([[expected]]);
    };
    const choose = (name: string, value: string): void => {
      fireEvent.change(screen.getByRole("combobox", { name }), { target: { value } });
    };

    expectOne({ type: "changed", group: "worksheetType", value: "find-the-wow" }, () =>
      fireEvent.click(worksheetCard("find-the-wow")),
    );
    expectOne({ type: "changed", group: "findTheWow.variant", value: "quantity" }, () =>
      fireEvent.click(screen.getByRole("radio", { name: FIND_THE_WOW_VARIANT_LABELS.quantity })),
    );
    const quantityFocus = PRACTICE_FOCUS_CATALOG["find-the-wow-quantity"][0]!;
    expectOne(
      { type: "changed", group: "findTheWow.quantity", value: quantityFocus.focus },
      () => choose("Practice focus", quantityFocus.id),
    );
    expectOne({ type: "childSelected", childId: second.id }, () =>
      choose("Child profile", second.id),
    );
    expectOne({ type: "changed", group: "worksheetType", value: "sentence-builder" }, () =>
      fireEvent.click(worksheetCard("sentence-builder")),
    );
    expectOne(
      { type: "changed", group: "sentenceBuilder.variant", value: "independent" },
      () =>
        fireEvent.click(
          screen.getByRole("radio", { name: SENTENCE_BUILDER_VARIANT_LABELS.independent }),
        ),
    );
    expectOne(
      { type: "changed", group: "sentenceBuilder.vocabulary", value: "all-words" },
      () =>
        fireEvent.click(
          screen.getByRole("radio", { name: SENTENCE_VOCABULARY_LABELS["all-words"] }),
        ),
    );
    expectOne({ type: "changed", group: "useInterests", value: false }, () =>
      fireEvent.click(screen.getByLabelText("Use reviewed interests in worksheet content")),
    );
    expectOne({ type: "changed", group: "worksheetType", value: "dry-math" }, () =>
      fireEvent.click(worksheetCard("dry-math")),
    );
    const dryMathFocus = PRACTICE_FOCUS_CATALOG["dry-math"][0]!;
    expectOne({ type: "changed", group: "dryMath", value: dryMathFocus.focus }, () =>
      choose("Practice focus", dryMathFocus.id),
    );
    expectOne({ type: "changed", group: "worksheetType", value: "count-compare-make" }, () =>
      fireEvent.click(worksheetCard("count-compare-make")),
    );
    const countFocus = PRACTICE_FOCUS_CATALOG["count-compare-make"][1]!;
    expectOne({ type: "changed", group: "countCompareMake", value: countFocus.focus }, () =>
      choose("Practice focus", countFocus.id),
    );
    expectOne({ type: "changed", group: "length", value: "short" }, () =>
      choose("Length", "short"),
    );
    expectOne({ type: "changed", group: "includeAnswerKey", value: false }, () =>
      fireEvent.click(screen.getByLabelText("Include a parent answer key")),
    );
    expectOne({ type: "changed", group: "theme", value: "sports" }, () =>
      choose("Theme", "sports"),
    );
    expectOne({ type: "changed", group: "includeDecorativeGraphics", value: false }, () =>
      fireEvent.click(screen.getByLabelText("Include decorative graphics")),
    );
    expectOne({ type: "changed", group: "useDisplayName", value: false }, () =>
      fireEvent.click(screen.getByLabelText("Put the nickname in the worksheet header")),
    );
    expectOne({ type: "changed", group: "paperSize", value: "a4" }, () =>
      choose("Paper size", "a4"),
    );
    expectOne({ type: "changed", group: "printScale", value: "large" }, () =>
      choose("Print scale", "large"),
    );
  });

  test("the Theme select shows only for the two decorating families with graphics on and keeps its value across the interests toggle", () => {
    renderPanel({ defaults: storedDefaults(), profiles: [nicknamed] });
    openMoreOptions();
    const theme = (): HTMLElement | null =>
      screen.queryByRole("combobox", { name: "Theme" });
    const interests = (): HTMLElement =>
      screen.getByLabelText("Use reviewed interests in worksheet content");
    const graphics = (): HTMLElement =>
      screen.getByLabelText("Include decorative graphics");

    // The families that print no decoration offer no Theme.
    expect(worksheetCard("dry-math")).toBeChecked();
    expect(theme()).toBeNull();
    chooseWorksheet("find-the-wow");
    expect(theme()).toBeNull();

    chooseWorksheet("count-compare-make");
    const select = theme();
    expect(select).not.toBeNull();
    expect(
      [...(select?.querySelectorAll("option") ?? [])].map((option) => [
        option.value,
        option.textContent,
      ]),
    ).toEqual([
      ["from-interests", "From interests"],
      ["animals", "Animals"],
      ["space", "Space"],
      ["nature", "Nature"],
      ["sports", "Sports"],
      ["vehicles", "Vehicles"],
      ["neutral", "Neutral"],
    ]);
    expect(select).toHaveValue("from-interests");
    expect(select?.closest("[data-more-options-group]")?.querySelector("legend")?.textContent).toBe(
      "Personalization",
    );
    const help = document.getElementById(select?.getAttribute("aria-describedby") ?? "");
    expect(help?.textContent).toBe(THEME_HELP_TEXT);
    expect(THEME_HELP_TEXT).toMatch(/^Neutral, and interests with no matching artwork, use the simple star\./u);
    expect(THEME_HELP_TEXT).toMatch(/never the work or the answers\.$/u);
    // Count, Compare & Make's art comes from the Theme, not an interests toggle.
    expect(
      screen.queryByLabelText("Use reviewed interests in worksheet content"),
    ).toBeNull();

    fireEvent.change(select!, { target: { value: "vehicles" } });
    expect(theme()).toHaveValue("vehicles");

    // Sentence Builder shows both; the interests toggle leaves the Theme alone.
    chooseWorksheet("sentence-builder");
    expect(theme()).toHaveValue("vehicles");
    expect(interests()).toBeChecked();
    fireEvent.click(interests());
    expect(interests()).not.toBeChecked();
    expect(theme()).toHaveValue("vehicles");
    fireEvent.click(interests());
    expect(interests()).toBeChecked();
    expect(theme()).toHaveValue("vehicles");

    // With graphics off the Theme is inapplicable and hidden; it comes back
    // with its value.
    fireEvent.click(graphics());
    expect(graphics()).not.toBeChecked();
    expect(theme()).toBeNull();
    fireEvent.click(graphics());
    expect(theme()).toHaveValue("vehicles");
  });

  test("the save slot holds no control but the save button and explains the end of seeding", () => {
    renderControls(independentProfile, "dry-math");
    const slot = screen
      .getByRole("button", { name: "Save these as worksheet defaults" })
      .closest("[data-defaults-slot]");
    expect(slot).not.toBeNull();
    const interactive = [
      ...(slot?.querySelectorAll(
        "button, input, select, textarea, a[href], summary, [tabindex]",
      ) ?? []),
    ];
    expect(interactive.map((element) => element.textContent)).toEqual([
      "Save these as worksheet defaults",
    ]);
    expect(slot?.textContent).toContain(
      "Saving makes these the starting choices for every child. Children's earlier settings stay in the file but will no longer be used as starting points.",
    );
    cleanup();

    // With seeding already off, there is nothing to end and no note.
    renderPanel({
      defaults: storedDefaults({}, false),
      profiles: [profileWithLegacyChoices(independentProfile)],
    });
    expect(document.querySelector("[data-earlier-settings-save-note]")).toBeNull();
  });

  test("a polite line names the earlier settings in use, and only while they are in use", () => {
    renderControls(independentProfile, "find-the-wow");
    const region = document.querySelector("[data-earlier-settings-status]");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).not.toHaveAttribute("role");
    const seeded = selectionFor("find-the-wow", independentProfile);
    expect(document.querySelector("[data-earlier-settings-used]")?.textContent).toBe(
      `Starting from ${independentProfile.displayName}'s earlier settings: Statements: Equations; Practice focus: ${describePracticeFocus(
        "find-the-wow-equation",
        seeded.findTheWow.equation,
      )}.`,
    );
    // Changing one of those groups takes it off the line.
    fireEvent.click(screen.getByRole("radio", { name: "Quantity pictures" }));
    expect(document.querySelector("[data-earlier-settings-used]")?.textContent).toBe(
      `Starting from ${independentProfile.displayName}'s earlier settings: Practice focus: ${describePracticeFocus(
        "find-the-wow-quantity",
        seeded.findTheWow.quantity,
      )}.`,
    );
    cleanup();

    // Seeding off: the same child supplies nothing and the line is empty.
    renderPanel({
      defaults: storedDefaults({}, false),
      profiles: [profileWithLegacyChoices(independentProfile)],
    });
    expect(document.querySelector("[data-earlier-settings-used]")).toBeNull();
    expect(document.querySelector("[data-earlier-settings-status]")?.textContent).toBe("");
  });
});
