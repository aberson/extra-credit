import { describe, expect, test } from "vitest";

import { dryMathBlank } from "./dry-math-blank.js";

describe("dryMathBlank", () => {
  test("uses eight underscores for an answer that can reach 1,000", () => {
    const blank = dryMathBlank({
      kind: "dry-math-three-digit",
      operations: ["addition", "subtraction"],
      regrouping: "required",
    });
    expect(blank).toEqual({ kind: "single", underscores: 8 });
  });
  test("uses six underscores for multi-digit answers", () => {
    const blank = dryMathBlank({ kind: "dry-math-multi-digit", operations: ["multiplication", "division"] });
    expect(blank).toEqual({ kind: "single", underscores: 6 });
  });
  test("derives quotient and remainder blanks", () => {
    expect(dryMathBlank({ kind: "dry-math-remainders" })).toEqual({ kind: "remainder", quotient: 4, remainder: 2 });
  });

  test.each([
    ["an absent practice member", undefined],
    [
      "addition and subtraction",
      { kind: "dry-math-add-subtract", regrouping: "required" } as const,
    ],
    [
      "multiplication and division facts",
      {
        kind: "dry-math-facts",
        operations: ["multiplication"],
        factFamilies: [2],
      } as const,
    ],
  ])("keeps the legacy literal for %s", (_name, practice) => {
    const blank = dryMathBlank(practice);
    expect(blank).toEqual({ kind: "single", underscores: 4 });
  });
});
