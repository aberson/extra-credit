import { describe, expect, test } from "vitest";

import { dryMathBlank } from "./dry-math-blank.js";

describe("dryMathBlank", () => {
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
    expect("_".repeat(blank.underscores)).toBe("____");
  });
});
