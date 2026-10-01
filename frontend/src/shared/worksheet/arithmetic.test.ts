import { describe, expect, test } from "vitest";

import { oracleRegroups } from "../../../tests/oracles/arithmetic-oracle.js";
import { additionCarries, regroups, subtractionBorrows } from "./arithmetic.js";

const LIMIT = 100;

describe("the one carry and borrow rule", () => {
  test("additionCarries equals the column oracle over every pair in 0..100", () => {
    const disagreements: string[] = [];
    for (let left = 0; left <= LIMIT; left += 1) {
      for (let right = 0; right <= LIMIT; right += 1) {
        if (additionCarries(left, right) !== oracleRegroups("addition", left, right)) {
          disagreements.push(`${left} + ${right}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  test("subtractionBorrows equals the column oracle wherever the left operand is at least the right", () => {
    const disagreements: string[] = [];
    for (let left = 0; left <= LIMIT; left += 1) {
      for (let right = 0; right <= left; right += 1) {
        if (subtractionBorrows(left, right) !== oracleRegroups("subtraction", left, right)) {
          disagreements.push(`${left} − ${right}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  test("a subtraction whose left operand is below its right always borrows", () => {
    expect(subtractionBorrows(3, 5)).toBe(true);
    const notBorrowing: string[] = [];
    for (let left = 0; left <= LIMIT; left += 1) {
      for (let right = left + 1; right <= LIMIT; right += 1) {
        if (!subtractionBorrows(left, right)) {
          notBorrowing.push(`${left} − ${right}`);
        }
      }
    }
    expect(notBorrowing).toEqual([]);
  });

  test("named boundary pairs", () => {
    expect(regroups("addition", 9, 1)).toBe(true);
    expect(regroups("subtraction", 100, 1)).toBe(true);
    expect(regroups("addition", 10, 0)).toBe(false);
    expect(regroups("subtraction", 100, 100)).toBe(false);
  });
});
