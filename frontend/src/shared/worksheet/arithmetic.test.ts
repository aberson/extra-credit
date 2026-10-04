import { describe, expect, test } from "vitest";

import {
  ORACLE_FACT_FACTOR_MAXIMUM,
  oracleFactKeys,
  oracleRegroups,
} from "../../../tests/oracles/arithmetic-oracle.js";
import {
  additionCarries,
  factKey,
  isInFactFamily,
  regroups,
  subtractionBorrows,
} from "./arithmetic.js";

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

const EVERY_FAMILY = Array.from(
  { length: ORACLE_FACT_FACTOR_MAXIMUM + 1 },
  (_, family) => family,
);

describe("fact families", () => {
  test("isInFactFamily agrees with the oracle's brute-force family of every fact", () => {
    const disagreements: string[] = [];
    for (let family = 0; family <= ORACLE_FACT_FACTOR_MAXIMUM; family += 1) {
      for (const operation of ["multiplication", "division"] as const) {
        const expected = oracleFactKeys([operation], [family]);
        const accepted = new Set<string>();
        for (const key of oracleFactKeys([operation], EVERY_FAMILY)) {
          const [, left, right] = key.split(":").map(Number) as [number, number, number];
          if (isInFactFamily(operation, left, right, family)) {
            accepted.add(key);
          }
        }
        if (accepted.size !== expected.size || [...accepted].some((key) => !expected.has(key))) {
          disagreements.push(`${operation} family ${family}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  test("zero belongs where the rules say, and a zero divisor belongs nowhere", () => {
    expect(isInFactFamily("multiplication", 7, 0, 7)).toBe(true);
    expect(isInFactFamily("multiplication", 0, 7, 0)).toBe(true);
    expect(isInFactFamily("division", 0, 5, 5)).toBe(true);
    expect(isInFactFamily("division", 0, 5, 0)).toBe(true);
    expect(isInFactFamily("division", 0, 5, 3)).toBe(false);
    expect(isInFactFamily("division", 0, 0, 0)).toBe(false);
  });

  test("factKey keeps both orders distinct", () => {
    expect(factKey("multiplication", 3, 4)).toBe("multiplication:3:4");
    expect(factKey("multiplication", 4, 3)).not.toBe(factKey("multiplication", 3, 4));
    expect(factKey("division", 12, 3)).not.toBe(factKey("multiplication", 12, 3));
  });
});
