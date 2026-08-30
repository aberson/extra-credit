import type {
  EffectiveMathSkillsV1,
  ObjectiveAnswerV1,
  PrintScale,
  WorksheetLength,
} from "../../shared/worksheet/types.js";

export const COUNT_COMPARE_MAKE_DEFINITION = {
  id: "count-compare-make",
  displayName: "Count, Compare & Make",
  generatorVersion: 1,
  usesInterests: true,
  hasAnswerKey: true,
} as const;

/**
 * Every rendered quantity is clamped to the v1 source envelope even when the
 * stored profile records a higher capability (plan.md:211). The sole
 * projection boundary already clamps the request; this constant keeps the
 * family's own limit arithmetic from being able to widen past it.
 */
export const COUNT_COMPARE_MAKE_V1_MAXIMUM = 20;

/** Three group choices per match item, one of them the exact match. */
export const COUNT_COMPARE_MAKE_MATCH_CHOICE_COUNT = 3;

export const COUNT_COMPARE_MAKE_SUBTYPES = [
  "match",
  "compare",
  "complete",
  "draw",
] as const;

export type CountCompareSubtypeV1 =
  (typeof COUNT_COMPARE_MAKE_SUBTYPES)[number];

/** Derived from the stored answer shape so the two can never disagree. */
export type CountCompareRelationV1 = Extract<
  ObjectiveAnswerV1,
  { readonly kind: "comparison" }
>["value"];

/** The order the three comparison words print in, smallest relation first. */
export const COUNT_COMPARE_RELATIONS = [
  "less",
  "equal",
  "greater",
] as const satisfies readonly CountCompareRelationV1[];

/**
 * The ONE parent- and child-facing wording of each stored relation.
 *
 * The child circles one of these phrases and the parent key prints the same
 * phrase back, so one document cannot end up with two vocabularies - a page
 * saying "more than" beside a key saying "greater". `AnswerKeyView` and the
 * family renderer both read this constant; neither owns a copy.
 */
export const COUNT_COMPARE_RELATION_WORDS = {
  less: "fewer than",
  equal: "the same as",
  greater: "more than",
} as const satisfies Record<CountCompareRelationV1, string>;

/** One number per subtype: an allocation when required, a capacity when counted. */
export type CountCompareSubtypeCountsV1 = Readonly<
  Record<CountCompareSubtypeV1, number>
>;

/**
 * The fixed subtype mix (plan.md:208). The sums are the family's one-page
 * budgets from plan.md:236 - 6 short, 8 standard, 10 long - and
 * `count-compare-make.spec.ts` plus `generator.test.ts` pin both readings.
 */
export const COUNT_COMPARE_MAKE_ALLOCATIONS = {
  short: { match: 2, compare: 2, complete: 1, draw: 1 },
  standard: { match: 2, compare: 2, complete: 2, draw: 2 },
  long: { match: 3, compare: 3, complete: 2, draw: 2 },
} as const satisfies Record<WorksheetLength, CountCompareSubtypeCountsV1>;

/**
 * Large print may pull an item-bearing activity down to the next shorter
 * effective budget to keep the one-page contract (plan.md:238), exactly as
 * Dry Math and Two Whats and a Wow already do.
 */
export function getCountCompareMakeEffectiveLength(
  length: WorksheetLength,
  printScale: PrintScale,
): WorksheetLength {
  if (printScale !== "large") {
    return length;
  }
  return length === "long" ? "standard" : "short";
}

export function getCountCompareMakeAllocation(
  length: WorksheetLength,
  printScale: PrintScale,
): CountCompareSubtypeCountsV1 {
  return COUNT_COMPARE_MAKE_ALLOCATIONS[
    getCountCompareMakeEffectiveLength(length, printScale)
  ];
}

export function getCountCompareMakeItemCount(
  length: WorksheetLength,
  printScale: PrintScale,
): number {
  const allocation = getCountCompareMakeAllocation(length, printScale);
  return COUNT_COMPARE_MAKE_SUBTYPES.reduce(
    (total, subtype) => total + allocation[subtype],
    0,
  );
}

type CountCompareRelevantSkills = Pick<
  EffectiveMathSkillsV1,
  "countingMax" | "numeralMax" | "compareMax"
>;

/** `min(countingMax, numeralMax, 20)`: numeral, complete, and make work (plan.md:207). */
export function getCountCompareMakeNumeralLimit(
  mathSkills: CountCompareRelevantSkills,
): number {
  return Math.min(
    mathSkills.countingMax,
    mathSkills.numeralMax,
    COUNT_COMPARE_MAKE_V1_MAXIMUM,
  );
}

/** `min(countingMax, compareMax, 20)`: comparison work only (plan.md:207). */
export function getCountCompareMakeComparisonLimit(
  mathSkills: CountCompareRelevantSkills,
): number {
  return Math.min(
    mathSkills.countingMax,
    mathSkills.compareMax,
    COUNT_COMPARE_MAKE_V1_MAXIMUM,
  );
}

export type CountCompareMakeCapabilitySupport =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

/**
 * Availability is the representation gate and nothing else (plan.md:206):
 * numeric maxima do not independently authorize a representation. Whether the
 * confirmed limits can actually fill the chosen length is a capacity question
 * the generator answers with `GENERATION_CONSTRAINT_CONFLICT`; surfacing that
 * verdict in the control before the click is issue #14, owned by Step 9.
 */
export function getCountCompareMakeCapabilitySupport(
  mathSkills: Pick<EffectiveMathSkillsV1, "representations">,
): CountCompareMakeCapabilitySupport {
  if (!mathSkills.representations.includes("quantities")) {
    return {
      available: false,
      reason:
        "Count, Compare & Make needs confirmed quantities. Choose another supported profile, or edit this profile to confirm that the child works with counted groups.",
    };
  }
  return { available: true };
}
