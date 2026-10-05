import type {
  DryMathItemV1,
  NumberBondItemV1,
  ObjectiveAnswerV1,
  WorksheetItemV1,
} from "./types.js";

/*
 * The one dispatch that recomputes an objective item's answer from the item
 * itself (math-activities plan, DD12).
 *
 * The record below is keyed by every objective item type, and its
 * `satisfies` clause makes a new objective item type fail to compile until it
 * decides how its answer is recomputed. A family whose answer is a choice or a
 * comparison that only its own validator can judge is marked
 * `FAMILY_VALIDATED`: that validator remains the owner of its answer.
 */
export const FAMILY_VALIDATED = "FAMILY_VALIDATED" as const;

/** Every item that carries an objective answer. */
export type ObjectiveItemV1 = Extract<WorksheetItemV1, { readonly answerability: "objective" }>;

/** The item types whose answers are objective. */
export type ObjectiveItemType = ObjectiveItemV1["itemType"];

type ObjectiveItemOf<TItemType extends ObjectiveItemType> = Extract<
  ObjectiveItemV1,
  { readonly itemType: TItemType }
>;

type AnswerRecomputation<TItem> =
  | ((item: TItem) => ObjectiveAnswerV1 | undefined)
  | typeof FAMILY_VALIDATED;

/**
 * A Dry Math answer from the item's own operands. A division has an answer
 * only when it is exact with a nonzero divisor; any other division has none.
 */
function dryMathAnswer(item: DryMathItemV1): ObjectiveAnswerV1 | undefined {
  const { leftOperand, rightOperand } = item;
  switch (item.operation) {
    case "addition":
      return { kind: "number", value: leftOperand + rightOperand };
    case "subtraction":
      return { kind: "number", value: leftOperand - rightOperand };
    case "multiplication":
      return { kind: "number", value: leftOperand * rightOperand };
    case "division":
      return rightOperand !== 0 && leftOperand % rightOperand === 0
        ? { kind: "number", value: leftOperand / rightOperand }
        : undefined;
  }
}

/**
 * A Number Bonds sentence's missing number, solved from the numbers it shows:
 * a missing addend is the result minus the shown addend, a missing minuend is
 * the result plus the subtrahend, and a missing subtrahend is the minuend
 * minus the result. A sentence whose `missing` names neither number has none.
 */
function numberBondAnswer(item: NumberBondItemV1): ObjectiveAnswerV1 | undefined {
  const { leftOperand, rightOperand, result } = item;
  if (item.missing !== "left" && item.missing !== "right") {
    return undefined;
  }
  switch (item.operation) {
    case "addition":
      return {
        kind: "number",
        value: item.missing === "left" ? result - rightOperand : result - leftOperand,
      };
    case "subtraction":
      return {
        kind: "number",
        value: item.missing === "left" ? result + rightOperand : leftOperand - result,
      };
  }
}

const OBJECTIVE_ANSWER_RECOMPUTATIONS = {
  "dry-math": dryMathAnswer,
  "number-bond": numberBondAnswer,
  "wow-group": FAMILY_VALIDATED,
  "count-compare": FAMILY_VALIDATED,
} as const satisfies {
  readonly [TItemType in ObjectiveItemType]: AnswerRecomputation<
    ObjectiveItemOf<TItemType>
  >;
};

/**
 * The answer an objective item's own fields imply, `FAMILY_VALIDATED` when its
 * family's validator owns that answer, or `undefined` when its fields imply no
 * answer at all (a division with a remainder or by zero, or a Number Bonds
 * sentence with no one missing number).
 */
export function recomputeObjectiveAnswer(
  item: ObjectiveItemV1,
): ObjectiveAnswerV1 | typeof FAMILY_VALIDATED | undefined {
  switch (item.itemType) {
    case "dry-math":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["dry-math"](item);
    case "number-bond":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["number-bond"](item);
    case "wow-group":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["wow-group"];
    case "count-compare":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["count-compare"];
  }
}

/**
 * Whether an item's stored answer equals the one its fields imply. A
 * family-validated item reports `FAMILY_VALIDATED`, never a verdict, and an
 * item whose fields imply no answer never matches.
 */
export function objectiveAnswerMatches(
  item: ObjectiveItemV1,
): boolean | typeof FAMILY_VALIDATED {
  const expected = recomputeObjectiveAnswer(item);
  if (expected === FAMILY_VALIDATED) {
    return FAMILY_VALIDATED;
  }
  return (
    expected !== undefined &&
    expected.kind === item.answer.kind &&
    expected.value === item.answer.value
  );
}
