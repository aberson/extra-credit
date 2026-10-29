import type { PracticeRequestV1 } from "./types.js";

/** The four underscore glyphs every shipped Dry Math practice kind uses. */
export const LEGACY_DRY_MATH_BLANK_UNDERSCORES = 4;

export interface SingleDryMathBlank {
  readonly kind: "single";
  readonly underscores: number;
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
): SingleDryMathBlank {
  switch (practice?.kind) {
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
