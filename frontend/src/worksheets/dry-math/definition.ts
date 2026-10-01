import type { REGROUPING_MODES } from "../../shared/config/enums.js";
import {
  OPERAND_RESULT_MAXIMUM_KEYS,
  bindingMaximumKeysByProbe,
  capacityRemedySentence,
  shorterLengthFills,
  type WorksheetMaximumValues,
} from "../../shared/worksheet/limit-labels.js";
import type {
  EffectiveMathSkillsV1,
  PrintScale,
  WorksheetLength,
} from "../../shared/worksheet/types.js";

export const DRY_MATH_DEFINITION = {
  id: "dry-math",
  displayName: "Dry Math",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

export const DRY_MATH_ITEM_BUDGETS = {
  short: 8,
  standard: 12,
  long: 18,
} as const satisfies Record<WorksheetLength, number>;

export function getDryMathItemCount(
  length: WorksheetLength,
  printScale: PrintScale,
): number {
  if (printScale !== "large") {
    return DRY_MATH_ITEM_BUDGETS[length];
  }
  return length === "long"
    ? DRY_MATH_ITEM_BUDGETS.standard
    : DRY_MATH_ITEM_BUDGETS.short;
}

/** The two Dry Math addition and subtraction regrouping choices, as a parent reads them. */
export const DRY_MATH_REGROUPING_LABELS = {
  without: "Without carrying or borrowing",
  required: "Every problem carries or borrows",
} as const satisfies Record<(typeof REGROUPING_MODES)[number], string>;

/** The legend of the "Carrying and borrowing" group. */
export const DRY_MATH_REGROUPING_LEGEND = "Carrying and borrowing";

/** The help under that group. */
export const DRY_MATH_REGROUPING_HELP =
  "Every problem carries or borrows: each addition carries at least once and each subtraction borrows at least once. Answers are never negative.";

/** Appended to a shortage only when the same focus without regrouping fills the length. */
export const WITHOUT_REGROUPING_FILLS_SENTENCE =
  "Choosing Without carrying or borrowing also fills this length.";

export type DryMathCapabilitySupport =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

export function getDryMathCapabilitySupport(
  mathSkills: Pick<
    EffectiveMathSkillsV1,
    "representations" | "operations" | "operandMax" | "resultMax"
  >,
): DryMathCapabilitySupport {
  if (!mathSkills.representations.includes("equations")) {
    return {
      available: false,
      reason:
        "Dry Math needs equations and an enabled operation. Choose a practice focus with addition or subtraction. Count, Compare & Make offers quantity practice.",
    };
  }
  if (
    mathSkills.operations.length === 0 ||
    mathSkills.operandMax < 1 ||
    mathSkills.resultMax < 1
  ) {
    return {
      available: false,
      reason:
        "Dry Math needs at least one symbolic operation. Choose a practice focus with addition or subtraction. Count, Compare & Make offers quantity practice.",
    };
  }
  return { available: true };
}

/**
 * The one shortage sentence Dry Math prints, whoever asks.
 *
 * Both the pre-click control (through the registration's capacity verdict) and
 * the generator's own fail-closed branch call this. Issue #14 was exactly the
 * gap between those two moments; keeping one owner for the wording means they
 * cannot drift into two different explanations of the same shortage. The
 * required count is derived HERE from the length and print scale rather than
 * passed in, so a caller cannot measure capacity against a budget the
 * generator never uses.
 *
 * The remedy names only the maxima that are really binding. The candidate
 * enumeration filters on operands AND on the result, so the smaller of the two
 * numbers is not necessarily the one holding the count down: at operands 20 and
 * results 2 an addition pool grows only when the RESULT limit rises, while
 * operands 20 is already at the Version 1 ceiling. Naming it
 * would send the parent to a knob that cannot move, so `measureCapacity`
 * re-runs the caller's own enumeration with each maximum lifted instead.
 */
export function dryMathCapacityShortfall(
  capacity: number,
  maximums: WorksheetMaximumValues,
  measureCapacity: (maximums: WorksheetMaximumValues) => number,
  length: WorksheetLength,
  printScale: PrintScale,
  measureWithoutRegrouping?: () => number,
): string | undefined {
  const required = getDryMathItemCount(length, printScale);
  if (capacity >= required) {
    return undefined;
  }
  const remedy = capacityRemedySentence(
    shorterLengthFills(length, capacity, (shorter) =>
      getDryMathItemCount(shorter, printScale),
    ),
    bindingMaximumKeysByProbe(
      maximums,
      OPERAND_RESULT_MAXIMUM_KEYS,
      capacity,
      measureCapacity,
    ),
  );
  // A page that requires carrying or borrowing names the other choice only
  // when the same focus without it really fills this length.
  const withoutRemedy =
    measureWithoutRegrouping !== undefined &&
    measureWithoutRegrouping() >= required
      ? ` ${WITHOUT_REGROUPING_FILLS_SENTENCE}`
      : "";
  return `This practice focus provides ${capacity} unique facts, but this length needs ${required}. ${remedy}${withoutRemedy}`;
}
