import {
  CLOCK_EXPLORER_HOUR_MAXIMUM,
  CLOCK_EXPLORER_HOUR_MINIMUM,
  TALLY_DETECTIVE_BUNDLE_SIZE,
  TALLY_DETECTIVE_TOTAL_MAXIMUM,
  TALLY_DETECTIVE_TOTAL_MINIMUM,
  type ClockExplorerItemV1,
  type DryMathItemV1,
  type NumberBondItemV1,
  type ObjectiveAnswerV1,
  type OperationGridItemV1,
  type TallyDetectiveItemV1,
  type WorksheetItemV1,
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
 * A Dry Math answer from the item's own operands and stored answer kind.
 * Number-kind division must be exact; quotient-remainder division recomputes
 * both values for any nonzero divisor.
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
      if (rightOperand === 0) return undefined;
      return item.answer.kind === "quotient-remainder"
        ? { kind: "quotient-remainder", quotient: Math.floor(leftOperand / rightOperand), remainder: leftOperand % rightOperand }
        : leftOperand % rightOperand === 0
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

/**
 * An Operation Grid's completed cells, recomputed from its headers alone: row
 * by row, each row header combined with each column header by the grid's
 * operation (for powers, the row header raised to the column header). A grid
 * whose operation is unknown, or whose headers are not positive integers, has
 * none.
 */
function operationGridAnswer(item: OperationGridItemV1): ObjectiveAnswerV1 | undefined {
  const headers = [...item.rowHeaders, ...item.columnHeaders];
  if (!headers.every((header) => Number.isSafeInteger(header) && header >= 1)) {
    return undefined;
  }
  const combine = (row: number, column: number): number | undefined => {
    switch (item.operation) {
      case "addition":
        return row + column;
      case "multiplication":
        return row * column;
      case "powers":
        return row ** column;
      default:
        return undefined;
    }
  };
  const value: number[] = [];
  for (const row of item.rowHeaders) {
    for (const column of item.columnHeaders) {
      const cell = combine(row, column);
      if (cell === undefined) {
        return undefined;
      }
      value.push(cell);
    }
  }
  return { kind: "grid", value };
}

/**
 * A Clock Explorer clock's answer: the hour it shows, which the child writes
 * before the printed `:00`. A clock whose hour is not an integer from 1 to 12
 * shows no on-the-hour time and has none.
 */
function clockExplorerAnswer(item: ClockExplorerItemV1): ObjectiveAnswerV1 | undefined {
  const { hour } = item;
  return Number.isInteger(hour) &&
    hour >= CLOCK_EXPLORER_HOUR_MINIMUM &&
    hour <= CLOCK_EXPLORER_HOUR_MAXIMUM
    ? { kind: "number", value: hour }
    : undefined;
}

/**
 * A Tally Detective tally's answer: five for every bundle plus the loose
 * marks. A tally whose bundle count is not a whole number of bundles, whose
 * loose marks are not 0 to 4 (a fifth loose mark would make another bundle),
 * or whose total is not from 1 to 20 is malformed and has none.
 */
function tallyDetectiveAnswer(item: TallyDetectiveItemV1): ObjectiveAnswerV1 | undefined {
  const { bundles, remainder } = item;
  if (
    !Number.isInteger(bundles) ||
    !Number.isInteger(remainder) ||
    bundles < 0 ||
    remainder < 0 ||
    remainder >= TALLY_DETECTIVE_BUNDLE_SIZE
  ) {
    return undefined;
  }
  const total = TALLY_DETECTIVE_BUNDLE_SIZE * bundles + remainder;
  return total >= TALLY_DETECTIVE_TOTAL_MINIMUM && total <= TALLY_DETECTIVE_TOTAL_MAXIMUM
    ? { kind: "number", value: total }
    : undefined;
}

const OBJECTIVE_ANSWER_RECOMPUTATIONS = {
  "dry-math": dryMathAnswer,
  "clock-explorer": clockExplorerAnswer,
  "tally-detective": tallyDetectiveAnswer,
  "number-bond": numberBondAnswer,
  "operation-grid": operationGridAnswer,
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
 * answer at all (a division with a remainder or by zero, a Number Bonds
 * sentence with no one missing number, an Operation Grid with an unknown
 * operation or a header that is not a positive integer, a clock whose hour
 * is not from 1 to 12, or a tally whose grouping is malformed or totals
 * outside 1 to 20).
 */
export function recomputeObjectiveAnswer(
  item: ObjectiveItemV1,
): ObjectiveAnswerV1 | typeof FAMILY_VALIDATED | undefined {
  switch (item.itemType) {
    case "dry-math":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["dry-math"](item);
    case "number-bond":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["number-bond"](item);
    case "operation-grid":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["operation-grid"](item);
    case "clock-explorer":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["clock-explorer"](item);
    case "tally-detective":
      return OBJECTIVE_ANSWER_RECOMPUTATIONS["tally-detective"](item);
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
  if (expected === undefined) {
    return false;
  }
  const actual: ObjectiveAnswerV1 = item.answer;
  if (expected.kind === "quotient-remainder" || actual.kind === "quotient-remainder") {
    return expected.kind === "quotient-remainder" && actual.kind === "quotient-remainder" &&
      expected.quotient === actual.quotient && expected.remainder === actual.remainder;
  }
  if (expected.kind === "grid" || actual.kind === "grid") {
    // A grid matches only cell for cell, in the same row-by-row order.
    if (expected.kind !== "grid" || actual.kind !== "grid") {
      return false;
    }
    const cells = actual.value;
    return (
      expected.value.length === cells.length &&
      expected.value.every((value, index) => cells[index] === value)
    );
  }
  return expected.kind === actual.kind && expected.value === actual.value;
}
