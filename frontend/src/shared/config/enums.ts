/**
 * The shared config value lists, as a leaf module. It imports nothing from
 * `schema.ts` or `legacy-v1.ts`, so both of those (and anything that later
 * builds on them) can import these arrays without a module cycle;
 * `tests/integration/config-module-graph.test.ts` enforces the direction.
 *
 * Its one value import is `TOPIC_IDS` from `worksheet/types.ts`, which in
 * turn may import from the config modules only with `import type`.
 */
import { TOPIC_IDS } from "../worksheet/types.js";

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

/** Two Whats and a Wow's two statement kinds (schema version 2). */
export const FIND_THE_WOW_VARIANTS = ["quantity", "equation"] as const;
/** Sentence Builder's plain-language vocabulary choice (schema version 2). */
export const SENTENCE_VOCABULARY_OPTIONS = ["simpler-words", "all-words"] as const;
/**
 * Dry Math addition and subtraction: no problem carries or borrows, or every
 * problem does at least once (math-activities plan, DD8). An additive schema
 * version 2 field whose default is `without`.
 */
export const REGROUPING_MODES = ["without", "required"] as const;
/**
 * Dry Math's two strands: addition and subtraction, or multiplication and
 * division facts (math-activities plan, DD9). An additive schema version 2
 * field whose default is `add-subtract`.
 */
export const DRY_MATH_STRANDS = ["add-subtract", "multiply-divide"] as const;
/** The fact operations of the multiply-divide strand, in canonical order. */
export const FACT_OPERATIONS = ["multiplication", "division"] as const;
/**
 * Number Bonds' own carrying and borrowing choice (math-activities plan, DD10
 * and D-bonds-ten): leave out every problem whose missing number needs
 * carrying or borrowing, or include those problems. Part of the additive
 * schema version 2 `numberBonds` group, whose default is `without`.
 */
export const NUMBER_BONDS_REGROUPING_MODES = ["without", "included"] as const;
/** The decorative theme: art from interests, one reviewed topic, or neutral. */
export const THEME_CHOICES = ["from-interests", ...TOPIC_IDS] as const;
