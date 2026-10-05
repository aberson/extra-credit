import { describe, expect, test } from "vitest";

import {
  FAMILY_VALIDATED,
  objectiveAnswerMatches,
  recomputeObjectiveAnswer,
} from "./answer-oracle.js";
import type {
  CountCompareComparisonItemV1,
  DryMathItemV1,
  NumberBondItemV1,
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
    renderedSymbol: { addition: "+", subtraction: "−", multiplication: "×", division: "÷" }[
      operation
    ] as DryMathItemV1["renderedSymbol"],
    answer: { kind: "number", value: answer },
  };
}

/** A missing number sentence whose stated answer is `answer`. */
function sentenceItem(
  operation: NumberBondItemV1["operation"],
  leftOperand: number,
  rightOperand: number,
  result: number,
  missing: NumberBondItemV1["missing"],
  answer: number,
): NumberBondItemV1 {
  return {
    id: "item-001",
    itemType: "number-bond",
    answerability: "objective",
    form: "sentence",
    operation,
    leftOperand,
    rightOperand,
    result,
    renderedSymbol: operation === "addition" ? "+" : "−",
    missing,
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

  test("recomputes multiplication and exact division, and gives no answer for a remainder or a zero divisor", () => {
    expect(recomputeObjectiveAnswer(dryMathItem("multiplication", 12, 12, 0))).toEqual({
      kind: "number",
      value: 144,
    });
    expect(recomputeObjectiveAnswer(dryMathItem("division", 144, 12, 0))).toEqual({
      kind: "number",
      value: 12,
    });
    expect(recomputeObjectiveAnswer(dryMathItem("division", 0, 5, 9))).toEqual({
      kind: "number",
      value: 0,
    });
    expect(recomputeObjectiveAnswer(dryMathItem("division", 7, 2, 3))).toBeUndefined();
    expect(recomputeObjectiveAnswer(dryMathItem("division", 5, 0, 0))).toBeUndefined();
    expect(objectiveAnswerMatches(dryMathItem("multiplication", 3, 4, 12))).toBe(true);
    expect(objectiveAnswerMatches(dryMathItem("multiplication", 3, 4, 13))).toBe(false);
    expect(objectiveAnswerMatches(dryMathItem("division", 7, 2, 3))).toBe(false);
    expect(objectiveAnswerMatches(dryMathItem("division", 0, 0, 0))).toBe(false);
  });

  test("solves a Number Bonds sentence's missing number from the numbers it shows", () => {
    // 8 + ? = 15, ? + 7 = 15, ? − 3 = 5 and 9 − ? = 4. The hidden operand is
    // deliberately wrong in each, so only the shown numbers can give these.
    expect(recomputeObjectiveAnswer(sentenceItem("addition", 8, 99, 15, "right", 0))).toEqual({ kind: "number", value: 7 });
    expect(recomputeObjectiveAnswer(sentenceItem("addition", 99, 7, 15, "left", 0))).toEqual({ kind: "number", value: 8 });
    expect(recomputeObjectiveAnswer(sentenceItem("subtraction", 99, 3, 5, "left", 0))).toEqual({ kind: "number", value: 8 });
    expect(recomputeObjectiveAnswer(sentenceItem("subtraction", 9, 99, 4, "right", 0))).toEqual({ kind: "number", value: 5 });
    expect(objectiveAnswerMatches(sentenceItem("addition", 8, 7, 15, "right", 7))).toBe(true);
    // Mirror: an answer off by one, and a sentence with no one blank, never match.
    expect(objectiveAnswerMatches(sentenceItem("addition", 8, 7, 15, "right", 8))).toBe(false);
    expect(
      recomputeObjectiveAnswer(sentenceItem("addition", 8, 7, 15, "both" as unknown as "left", 7)),
    ).toBeUndefined();
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
