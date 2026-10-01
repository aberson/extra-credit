import type {
  DryMathItemV1,
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
  | ((item: TItem) => ObjectiveAnswerV1)
  | typeof FAMILY_VALIDATED;

function dryMathAnswer(item: DryMathItemV1): ObjectiveAnswerV1 {
  switch (item.operation) {
    case "addition":
      return { kind: "number", value: item.leftOperand + item.rightOperand };
    case "subtraction":
      return { kind: "number", value: item.leftOperand - item.rightOperand };
  }
}

const OBJECTIVE_ANSWER_RECOMPUTATIONS = {
  "dry-math": dryMathAnswer,
  "wow-group": FAMILY_VALIDATED,
  "count-compare": FAMILY_VALIDATED,
} as const satisfies {
  readonly [TItemType in ObjectiveItemType]: AnswerRecomputation<
    ObjectiveItemOf<TItemType>
  >;
};

/**
 * The answer an objective item's own fields imply, or `FAMILY_VALIDATED` when
 * its family's validator owns that answer.
 */
export function recomputeObjectiveAnswer(
  item: ObjectiveItemV1,
): ObjectiveAnswerV1 | typeof FAMILY_VALIDATED {
  switch (item.itemType) {
    case "dry-math":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["dry-math"](item);
    case "wow-group":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["wow-group"];
    case "count-compare":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["count-compare"];
  }
}

/**
 * Whether an item's stored answer equals the one its fields imply. A
 * family-validated item reports `FAMILY_VALIDATED`, never a verdict.
 */
export function objectiveAnswerMatches(
  item: ObjectiveItemV1,
): boolean | typeof FAMILY_VALIDATED {
  const expected = recomputeObjectiveAnswer(item);
  if (expected === FAMILY_VALIDATED) {
    return FAMILY_VALIDATED;
  }
  return expected.kind === item.answer.kind && expected.value === item.answer.value;
}
