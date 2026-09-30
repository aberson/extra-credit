import { AppConfigV1Schema, type AppConfigV1 } from "./legacy-v1.js";
import type { PRESENTATION_BANDS, WRITING_MODES } from "./enums.js";

export const APP_CONFIG_SCHEMA_VERSION = 1 as const;

// The shared value lists live in the `enums.ts` leaf and the frozen Version 1
// schemas in `legacy-v1.ts`; every name this module exported before the move
// is re-exported here, so existing imports keep compiling unchanged.
export {
  MATH_OPERATIONS,
  PAPER_SIZES,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  REPRESENTATIONS,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "./enums.js";
export {
  AppConfigV1Schema,
  ChildProfileV1Schema,
  DIFFICULTIES,
  GenerationDefaultsV1Schema,
  MathSkillsV1Schema,
} from "./legacy-v1.js";
export type {
  AppConfigV1,
  ChildProfileV1,
  GenerationDefaultsV1,
  MathSkillsV1,
} from "./legacy-v1.js";

export type PresentationBand = (typeof PRESENTATION_BANDS)[number];
export type WritingMode = (typeof WRITING_MODES)[number];

export function parseAppConfigV1(input: unknown): AppConfigV1 {
  return AppConfigV1Schema.parse(input);
}
