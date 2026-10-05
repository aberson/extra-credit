import type { NUMBER_BONDS_REGROUPING_MODES } from "../../shared/config/enums.js";
import { shorterLengthFills } from "../../shared/worksheet/limit-labels.js";
import type {
  NumberBondItemV1,
  PrintScale,
  WorksheetLength,
} from "../../shared/worksheet/types.js";

/*
 * Number Bonds (math-activities plan, DD10): missing number sentences in which
 * exactly one addend, minuend or subtrahend is a drawn blank, every number is
 * at least 1 and every whole lies within the chosen range. Its ceiling is
 * `V1_NUMERIC_MAXIMUM` itself, read directly where a range is bounded; the
 * family declares no alias of its own.
 */

export const NUMBER_BONDS_DEFINITION = {
  id: "number-bonds",
  displayName: "Number Bonds",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

export const NUMBER_BONDS_ITEM_BUDGETS = {
  short: 8,
  standard: 12,
  long: 18,
} as const satisfies Record<WorksheetLength, number>;

/** Large print pulls each length down to the next shorter budget, as Dry Math does. */
export function getNumberBondsItemCount(
  length: WorksheetLength,
  printScale: PrintScale,
): number {
  if (printScale !== "large") {
    return NUMBER_BONDS_ITEM_BUDGETS[length];
  }
  return length === "long"
    ? NUMBER_BONDS_ITEM_BUDGETS.standard
    : NUMBER_BONDS_ITEM_BUDGETS.short;
}

/** The worksheet-type card's one line (math-activities plan, Appendix F). */
export const NUMBER_BONDS_CARD_DESCRIPTION = "Find the one missing number in each problem.";

/** The page instruction under the title. */
export const NUMBER_BONDS_INSTRUCTION = "Write the missing number in each box.";

/** The help under the practice focus. */
export const NUMBER_BONDS_FOCUS_HELP =
  "Each problem has exactly one missing number, and every number is at least 1. The missing number can be a number being added, the number you start with, or the number taken away.";

/** The legend of Number Bonds' own "Carrying and borrowing" group. */
export const NUMBER_BONDS_REGROUPING_LEGEND = "Carrying and borrowing";

/** Number Bonds' two carrying and borrowing choices, as a parent reads them. */
export const NUMBER_BONDS_REGROUPING_LABELS = {
  without: "Without carrying or borrowing",
  included: "Include problems that carry or borrow",
} as const satisfies Record<(typeof NUMBER_BONDS_REGROUPING_MODES)[number], string>;

/** The help under that group (D-bonds-ten). */
export const NUMBER_BONDS_REGROUPING_HELP =
  "Without carrying or borrowing, no problem needs carrying or borrowing, so none makes or crosses ten. Include problems that carry or borrow adds problems such as 3 + ? = 10 and 8 + ? = 15.";

/** The blank as a key line writes it: ASCII, so no print font lacks it (D52). */
export const KEY_BLANK = "?";

/**
 * A sentence as its key line restates it: the problem as printed, with its
 * blank written as `KEY_BLANK`, for example "8 + ? = 15".
 */
export function numberBondKeyExpression(item: NumberBondItemV1): string {
  const left = item.missing === "left" ? KEY_BLANK : String(item.leftOperand);
  const right = item.missing === "right" ? KEY_BLANK : String(item.rightOperand);
  return `${left} ${item.renderedSymbol} ${right} = ${item.result}`;
}

/**
 * What bounds a Number Bonds page's variety, for the shared exhaustion
 * message: the range of its practice focus.
 */
export const NUMBER_BONDS_LIMITING_RESOURCE_ADVICE =
  "Number Bonds varies within the range of this practice focus. Choose a practice focus with a wider range, or create a new worksheet later.";

/**
 * The one shortage sentence Number Bonds prints, whoever asks: the pre-click
 * control, through the registration's capacity verdict, and the generator's
 * own fail-closed branch. A wider range always helps, because the count of
 * problems never falls as the range grows and the widest range fills every
 * length; a shorter length is named only when one really fills
 * (`shorterLengthFills`).
 */
export function numberBondsCapacityShortfall(
  capacity: number,
  length: WorksheetLength,
  printScale: PrintScale,
): string | undefined {
  const required = getNumberBondsItemCount(length, printScale);
  if (capacity >= required) {
    return undefined;
  }
  const shorter = shorterLengthFills(length, capacity, (candidate) =>
    getNumberBondsItemCount(candidate, printScale),
  )
    ? " Or choose a shorter length under More options."
    : "";
  return `This practice focus has ${capacity} unique problems, but this length needs ${required}. Choose a practice focus with a wider range.${shorter}`;
}
