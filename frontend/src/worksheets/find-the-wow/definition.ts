import {
  OPERAND_RESULT_MAXIMUM_KEYS,
  bindingMaximumKeys,
  bindingMaximumKeysByProbe,
  capacityRemedySentence,
  shorterLengthLowersRequirement,
  type WorksheetMaximumValues,
} from "../../shared/worksheet/limit-labels.js";
import type {
  Difficulty,
  EffectiveMathSkillsV1,
  PrintScale,
  WorksheetLength,
} from "../../shared/worksheet/types.js";

export const FIND_THE_WOW_DEFINITION = {
  id: "find-the-wow",
  displayName: "Math — Two Whats and a Wow",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

export const FIND_THE_WOW_GROUP_BUDGETS = {
  short: 4,
  standard: 6,
  long: 8,
} as const satisfies Record<WorksheetLength, number>;

export function getFindTheWowGroupCount(
  length: WorksheetLength,
  printScale: PrintScale,
): number {
  if (printScale !== "large") {
    return FIND_THE_WOW_GROUP_BUDGETS[length];
  }
  return length === "long"
    ? FIND_THE_WOW_GROUP_BUDGETS.standard
    : FIND_THE_WOW_GROUP_BUDGETS.short;
}

export type FindTheWowMode = "equation" | "quantity";

export type FindTheWowCapabilitySupport =
  | { readonly available: true; readonly mode: FindTheWowMode }
  | { readonly available: false; readonly reason: string };

export function getFindTheWowCapabilitySupport(
  mathSkills: Pick<
    EffectiveMathSkillsV1,
    "representations" | "understandsEquality" | "operations"
  >,
  difficulty: Difficulty = "practice",
): FindTheWowCapabilitySupport {
  const hasQuantities = mathSkills.representations.includes("quantities");
  const hasEquationGate =
    mathSkills.representations.includes("equations") &&
    mathSkills.understandsEquality &&
    mathSkills.operations.length > 0;

  if (difficulty === "confidence" && hasQuantities) {
    return { available: true, mode: "quantity" };
  }
  if (hasEquationGate) {
    return { available: true, mode: "equation" };
  }
  if (hasQuantities) {
    return { available: true, mode: "quantity" };
  }
  return {
    available: false,
    reason:
      "Two Whats and a Wow needs confirmed quantities, or equations with equality understanding and an enabled operation. Choose another supported profile or edit this profile to confirm one of those capability paths.",
  };
}

/**
 * The one shortage sentence Two Whats and a Wow prints, whoever asks.
 *
 * `getFindTheWowCapabilitySupport` above resolves a MODE and nothing else, so
 * before issue #14 the control could promise a page the generator then refused
 * - reachable with the shipped preschool profile at confidence/long, where the
 * confidence downgrade drops the effective counting limit to 7 while the length
 * needs 8 distinct stems. The registration now asks for a capacity verdict
 * beside the mode and both sides render this sentence.
 *
 * The remedy names the maxima THIS MODE reads, and within the mode only the
 * ones that are really binding: a quantity page explained in terms of operands
 * would be advice the parent cannot act on, and so is a quantity page whose
 * counting limit already sits at the Version 1 ceiling while its numeral limit
 * is what the pool ran out of.
 *
 * The two modes need two different discriminators. A quantity pool is
 * `Math.min(countingMax, numeralMax, 20)` (`generator.ts`), so the lowest
 * candidate IS the bound and a tie must name both. An equation pool bounds
 * operands and results independently through a filter, so its binding maxima
 * are found by re-measuring with each one lifted; `measureCapacity` re-runs the
 * caller's own enumeration for that.
 */
export function findTheWowCapacityShortfall(
  mode: FindTheWowMode,
  capacity: number,
  maximums: WorksheetMaximumValues,
  measureCapacity: (maximums: WorksheetMaximumValues) => number,
  length: WorksheetLength,
  printScale: PrintScale,
): string | undefined {
  const required = getFindTheWowGroupCount(length, printScale);
  if (capacity >= required) {
    return undefined;
  }
  const remedy = capacityRemedySentence(
    shorterLengthLowersRequirement(length, required, (shorter) =>
      getFindTheWowGroupCount(shorter, printScale),
    ),
    mode === "equation"
      ? bindingMaximumKeysByProbe(
          maximums,
          OPERAND_RESULT_MAXIMUM_KEYS,
          capacity,
          measureCapacity,
        )
      : bindingMaximumKeys([
          ["countingMax", maximums.countingMax],
          ["numeralMax", maximums.numeralMax],
        ]),
  );
  return `The confirmed limits provide ${capacity} unique ${mode} groups, but this length needs ${required}. ${remedy}`;
}
