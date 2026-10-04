import type { DryMathOperation, FactOperation, MathOperation } from "./types.js";

/**
 * The one owner of the carry and borrow rule (math-activities plan, DD3 and
 * Appendix B.1). The Dry Math generator, the Two Whats and a Wow generator and
 * the shared invariant checker all decide regrouping here, so the generator
 * that builds a page and the validator that checks it cannot disagree.
 *
 * The rule is digit-wise: walk the decimal columns from the ones upward while
 * either number still has a digit.
 */

/** Whether `left + right` carries: some decimal column's digits sum to 10 or more. */
export function additionCarries(left: number, right: number): boolean {
  let leftDigits = left;
  let rightDigits = right;
  do {
    if ((leftDigits % 10) + (rightDigits % 10) >= 10) {
      return true;
    }
    leftDigits = Math.floor(leftDigits / 10);
    rightDigits = Math.floor(rightDigits / 10);
  } while (leftDigits > 0 || rightDigits > 0);
  return false;
}

/**
 * Whether `left − right` borrows: some decimal column's minuend digit is
 * smaller than its subtrahend digit.
 *
 * Borrowing is defined for `left >= right`. For a pair with `left < right` the
 * highest column in which the two numbers differ always holds the smaller
 * minuend digit, so this returns true there too; Two Whats and a Wow's
 * validator relies on that to keep refusing such a false equation choice.
 */
export function subtractionBorrows(left: number, right: number): boolean {
  let leftDigits = left;
  let rightDigits = right;
  do {
    if (leftDigits % 10 < rightDigits % 10) {
      return true;
    }
    leftDigits = Math.floor(leftDigits / 10);
    rightDigits = Math.floor(rightDigits / 10);
  } while (leftDigits > 0 || rightDigits > 0);
  return false;
}

/** Whether one addition or subtraction carries or borrows at least once. */
export function regroups(
  operation: MathOperation,
  left: number,
  right: number,
): boolean {
  switch (operation) {
    case "addition":
      return additionCarries(left, right);
    case "subtraction":
      return subtractionBorrows(left, right);
  }
}

/*
 * Fact families (math-activities plan, DD9 and Appendix B.2), shared by the
 * Dry Math generator that enumerates the facts and the invariant checker that
 * re-verifies them. A multiplication `left × right` belongs to family `family`
 * when either factor is `family`; a division `left ÷ right` (dividend ÷
 * divisor) when the divisor or the quotient is `family`. Zero is a factor
 * inside every family, and `0 ÷ d` belongs to family `d` and to family 0.
 */

/** Whether one exact multiplication or division fact belongs to one family. */
export function isInFactFamily(
  operation: FactOperation,
  left: number,
  right: number,
  family: number,
): boolean {
  switch (operation) {
    case "multiplication":
      return left === family || right === family;
    case "division":
      return right !== 0 && (right === family || left / right === family);
  }
}

/**
 * The identity of one Dry Math problem: its operation and both operands in
 * printed order, so `3 × 4` and `4 × 3` are two different facts.
 */
export function factKey(operation: DryMathOperation, left: number, right: number): string {
  return `${operation}:${left}:${right}`;
}
