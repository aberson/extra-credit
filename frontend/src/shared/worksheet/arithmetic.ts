import type { MathOperation } from "./types.js";

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
