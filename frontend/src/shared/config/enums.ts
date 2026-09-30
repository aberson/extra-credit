/**
 * The shared config value lists, as a leaf module. It imports nothing from
 * `schema.ts` or `legacy-v1.ts`, so both of those (and anything that later
 * builds on them) can import these arrays without a module cycle;
 * `tests/integration/config-module-graph.test.ts` enforces the direction.
 */
export const PRESENTATION_BANDS = ["preschool", "early-primary"] as const;
export const REPRESENTATIONS = ["quantities", "equations"] as const;
export const MATH_OPERATIONS = ["addition", "subtraction"] as const;
export const WRITING_MODES = [
  "draw-and-tell",
  "label",
  "copy-with-model",
  "sentence-frame",
  "independent",
] as const;
export const WORKSHEET_LENGTHS = ["short", "standard", "long"] as const;
export const PAPER_SIZES = ["letter", "a4"] as const;
export const PRINT_SCALES = ["standard", "large"] as const;
