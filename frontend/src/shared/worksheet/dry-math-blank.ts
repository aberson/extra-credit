import {
  DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM,
  DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM,
  DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM,
  DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM,
  DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM,
  DRY_MATH_TWO_DIGIT_MAXIMUM,
  type PracticeRequestV1,
} from "./types.js";

/** The four underscore glyphs every shipped Dry Math practice kind uses. */
export const LEGACY_DRY_MATH_BLANK_UNDERSCORES = 4;

export interface SingleDryMathBlank {
  readonly kind: "single";
  readonly underscores: number;
}

export interface RemainderDryMathBlank {
  readonly kind: "remainder";
  readonly quotient: number;
  readonly remainder: number;
}

/**
 * The answer blank owned by one Dry Math practice request.
 *
 * Non-Dry-Math practice members can only arrive on a malformed request. They
 * keep the legacy blank so rendering remains as defensive as it was when the
 * four underscores were a literal in the renderer.
 */
export function dryMathBlank(
  practice: PracticeRequestV1 | undefined,
): SingleDryMathBlank | RemainderDryMathBlank {
  switch (practice?.kind) {
    case "dry-math-three-digit":
      return {
        kind: "single",
        underscores: String(DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM).length * 2,
      };
    case "dry-math-multi-digit": {
      const largest = Math.max(
        DRY_MATH_TWO_DIGIT_MAXIMUM * DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM,
        Math.floor(DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM / DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM),
      );
      return { kind: "single", underscores: String(largest).length * 2 };
    }
    case "dry-math-remainders":
      return {
        kind: "remainder",
        quotient: String(Math.floor(DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM / DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM)).length * 2,
        remainder: String(DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM - 1).length * 2,
      };
    case undefined:
    case "dry-math-add-subtract":
    case "dry-math-facts":
    case "number-bonds":
    case "operation-grid":
      return { kind: "single", underscores: LEGACY_DRY_MATH_BLANK_UNDERSCORES };
    default: {
      const unreachable: never = practice;
      return unreachable;
    }
  }
}
