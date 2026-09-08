import {
  OPERAND_RESULT_MAXIMUM_KEYS,
  bindingMaximumKeysByProbe,
  capacityRemedySentence,
  shorterLengthLowersRequirement,
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
        "Dry Math needs equations and an enabled operation. Choose another supported profile with those confirmed capabilities, or edit this profile to confirm them. Count, Compare & Make offers quantity practice for a profile that confirms quantities.",
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
        "Dry Math needs at least one confirmed symbolic operation. Choose another supported profile with an enabled operation, or edit this profile to confirm one. Count, Compare & Make offers quantity practice for a profile that confirms quantities.",
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
 * operands 20 is already at the ceiling `clampPositive` enforces. Naming it
 * would send the parent to a knob that cannot move, so `measureCapacity`
 * re-runs the caller's own enumeration with each maximum lifted instead.
 */
export function dryMathCapacityShortfall(
  capacity: number,
  maximums: WorksheetMaximumValues,
  measureCapacity: (maximums: WorksheetMaximumValues) => number,
  length: WorksheetLength,
  printScale: PrintScale,
): string | undefined {
  const required = getDryMathItemCount(length, printScale);
  if (capacity >= required) {
    return undefined;
  }
  const remedy = capacityRemedySentence(
    shorterLengthLowersRequirement(length, required, (shorter) =>
      getDryMathItemCount(shorter, printScale),
    ),
    bindingMaximumKeysByProbe(
      maximums,
      OPERAND_RESULT_MAXIMUM_KEYS,
      capacity,
      measureCapacity,
    ),
  );
  return `The confirmed limits provide ${capacity} unique facts, but this length needs ${required}. ${remedy}`;
}
