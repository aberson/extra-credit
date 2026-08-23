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
