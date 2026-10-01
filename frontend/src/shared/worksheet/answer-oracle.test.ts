import { describe, expect, test } from "vitest";

import {
  FAMILY_VALIDATED,
  objectiveAnswerMatches,
  recomputeObjectiveAnswer,
} from "./answer-oracle.js";
import type {
  CountCompareComparisonItemV1,
  DryMathItemV1,
  QuantityWowGroupItemV1,
} from "./types.js";

function dryMathItem(
  operation: DryMathItemV1["operation"],
  leftOperand: number,
  rightOperand: number,
  answer: number,
): DryMathItemV1 {
  return {
    id: "item-001",
    itemType: "dry-math",
    answerability: "objective",
    operation,
    leftOperand,
    rightOperand,
    renderedSymbol: operation === "addition" ? "+" : "−",
    answer: { kind: "number", value: answer },
  };
}

describe("the one objective-answer dispatch", () => {
  test("recomputes Dry Math addition and subtraction from the item's own operands", () => {
    expect(recomputeObjectiveAnswer(dryMathItem("addition", 37, 48, 0))).toEqual({
      kind: "number",
      value: 85,
    });
    expect(recomputeObjectiveAnswer(dryMathItem("subtraction", 100, 1, 0))).toEqual({
      kind: "number",
      value: 99,
    });
    expect(objectiveAnswerMatches(dryMathItem("addition", 9, 1, 10))).toBe(true);
    // Mirror: an answer off by one is caught.
    expect(objectiveAnswerMatches(dryMathItem("addition", 9, 1, 11))).toBe(false);
    expect(objectiveAnswerMatches(dryMathItem("subtraction", 52, 7, 45))).toBe(true);
    expect(objectiveAnswerMatches(dryMathItem("subtraction", 52, 7, 44))).toBe(false);
  });

  test("Two Whats and a Wow and Count, Compare & Make are validated by their own families", () => {
    const wow: QuantityWowGroupItemV1 = {
      id: "item-001",
      itemType: "wow-group",
      answerability: "objective",
      mode: "quantity",
      correctPosition: 1,
      answer: { kind: "choice", value: 1 },
      choices: [
        { kind: "quantity", numeral: 3, quantity: 4 },
        { kind: "quantity", numeral: 5, quantity: 5 },
        { kind: "quantity", numeral: 2, quantity: 6 },
      ],
    };
    const comparison: CountCompareComparisonItemV1 = {
      id: "item-002",
      itemType: "count-compare",
      answerability: "objective",
      activity: "compare",
      leftQuantity: 3,
      rightQuantity: 7,
      answer: { kind: "comparison", value: "less" },
    };
    expect(recomputeObjectiveAnswer(wow)).toBe(FAMILY_VALIDATED);
    expect(recomputeObjectiveAnswer(comparison)).toBe(FAMILY_VALIDATED);
    expect(objectiveAnswerMatches(wow)).toBe(FAMILY_VALIDATED);
    expect(objectiveAnswerMatches(comparison)).toBe(FAMILY_VALIDATED);
  });
});
