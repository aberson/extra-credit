import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../config/schema.js";
import {
  COUNT_COMPARE_MAKE_DEFINITION,
  getCountCompareMakeCapabilitySupport,
  getCountCompareMakeItemCount,
} from "../../worksheets/count-compare-make/definition.js";
import { generateCountCompareMake } from "../../worksheets/count-compare-make/generator.js";
import {
  DRY_MATH_DEFINITION,
  getDryMathCapabilitySupport,
  getDryMathItemCount,
} from "../../worksheets/dry-math/definition.js";
import { generateDryMath } from "../../worksheets/dry-math/generator.js";
import {
  FIND_THE_WOW_DEFINITION,
  getFindTheWowCapabilitySupport,
  getFindTheWowGroupCount,
} from "../../worksheets/find-the-wow/definition.js";
import { generateFindTheWow } from "../../worksheets/find-the-wow/generator.js";
import {
  SENTENCE_BUILDER_DEFINITION,
  SENTENCE_BUILDER_ITEM_COUNT,
  SENTENCE_BUILDER_MODE_LABELS,
  getSentenceBuilderBankSize,
  getSentenceBuilderCanonicalLength,
  getSentenceBuilderCapabilitySupport,
} from "../../worksheets/sentence-builder/definition.js";
import { generateSentenceBuilder } from "../../worksheets/sentence-builder/generator.js";
import { isBankWritingMode } from "../../worksheets/sentence-builder/vocabulary.js";
import type {
  Difficulty,
  WorksheetGeneratorV1,
  WorksheetType,
} from "./types.js";

export type WorksheetRelevantMaximumKey = keyof Pick<
  ChildProfileV1["mathSkills"],
  "countingMax" | "numeralMax" | "compareMax" | "operandMax" | "resultMax"
>;

export interface WorksheetRelevantMaximumV1 {
  readonly key: WorksheetRelevantMaximumKey;
  readonly label: string;
}

export interface WorksheetControlContextV1 {
  readonly profile: ChildProfileV1;
  readonly difficulty: Difficulty;
  readonly length: GenerationDefaultsV1["length"];
  readonly printScale: GenerationDefaultsV1["printScale"];
}

export type WorksheetCapabilitySupportV1 =
  | { readonly available: true; readonly statusMessage?: string }
  | { readonly available: false; readonly message: string };

/**
 * How much work this selection will produce, plus the noun its consumers
 * print. `App` writes "ready with {items.length} unique {label}" and
 * `GeneratorControls` writes "creates {count} unique {label}", each choosing
 * `singularLabel` when ITS OWN number is 1 and `pluralLabel` otherwise.
 *
 * `GeneratorControls` also prints the noun beside each length option ("Short -
 * {that length's count} {label}"). There the noun comes from the
 * CURRENTLY selected length's count rather than the number printed beside it,
 * which is correct only while no length can yield a count of 1. The
 * `getEffectiveUnit` sweep in `web/worksheets/registry.test.ts` exercises the
 * same-call shape only, so those three rows are not covered by it.
 *
 * INVARIANT: whichever label a count can actually select must read true for
 * that count. A registration may therefore name two different nouns (as
 * `sentence-builder` does below: one page always holds one prompt, while the
 * count it previews is bank breadth) ONLY while the other branch stays
 * unreachable. Two numeric preconditions keep it unreachable here, and both
 * are asserted in `web/worksheets/registry.test.ts` so a future edit that
 * makes the dead branch reachable fails CI instead of printing "creates 1
 * unique writing prompt" over a one-word bank: every
 * `SENTENCE_BUILDER_BANK_BUDGETS` entry is at least 2, and a Sentence Builder
 * document always holds exactly `SENTENCE_BUILDER_ITEM_COUNT` (1) item.
 *
 * Splitting this into a document unit and a budget unit is the clean fix, but
 * it is a shared-contract change that also rewrites `App.tsx` and the length
 * rows in `GeneratorControls.tsx`. No step through Step 8 has owned it.
 */
export interface WorksheetEffectiveUnitV1 {
  readonly count: number;
  readonly singularLabel: string;
  readonly pluralLabel: string;
}

export interface WorksheetApplicableControlsV1 {
  readonly useDisplayName: boolean;
  readonly useInterests: boolean;
  readonly includeDecorativeGraphics: boolean;
  readonly difficulty: boolean;
  readonly length: boolean;
  readonly includeAnswerKey: boolean;
  readonly paperSize: boolean;
  readonly printScale: boolean;
}

/**
 * Complete parent-control behavior for one registered worksheet family.
 * Keeping every member required makes an INCOMPLETE registration fail
 * compilation until its capability, budget, and option behavior is explicit.
 *
 * Declaring a new `WORKSHEET_TYPE_IDS` entry without registering it does NOT
 * fail here: `WORKSHEET_REGISTRY` is `satisfies Record<string, ...>`, which
 * allows missing keys. The exhaustive `relevantMaximumKeys` switch in
 * `project-request.ts` is what then fails to compile.
 */
export interface WorksheetControlContractV1 {
  readonly getCapabilitySupport: (
    context: WorksheetControlContextV1,
  ) => WorksheetCapabilitySupportV1;
  /**
   * The stored maxima this family actually reads for the given context. It must
   * never claim a key the sole projection boundary would not scale, because the
   * parent's stretch gate and preview are derived from exactly this list.
   */
  readonly getRelevantMaximums: (
    context: WorksheetControlContextV1,
  ) => readonly WorksheetRelevantMaximumV1[];
  readonly getEffectiveUnit: (
    context: WorksheetControlContextV1,
  ) => WorksheetEffectiveUnitV1;
  readonly getApplicableControls: (
    context: WorksheetControlContextV1,
  ) => WorksheetApplicableControlsV1;
  readonly projectPreferences: (
    context: WorksheetControlContextV1,
    preferences: GenerationDefaultsV1,
  ) => GenerationDefaultsV1;
}

const OPERAND_RESULT_MAXIMUMS: readonly WorksheetRelevantMaximumV1[] =
  Object.freeze([
    { key: "operandMax", label: "operands" },
    { key: "resultMax", label: "results" },
  ]);

const COUNTING_NUMERAL_MAXIMUMS: readonly WorksheetRelevantMaximumV1[] =
  Object.freeze([
    { key: "countingMax", label: "counting" },
    { key: "numeralMax", label: "numerals" },
  ]);

const COUNTING_NUMERAL_COMPARE_MAXIMUMS: readonly WorksheetRelevantMaximumV1[] =
  Object.freeze([
    { key: "countingMax", label: "counting" },
    { key: "numeralMax", label: "numerals" },
    { key: "compareMax", label: "comparisons" },
  ]);

const NO_MAXIMUMS: readonly WorksheetRelevantMaximumV1[] = Object.freeze([]);

export interface WorksheetRegistrationV1 {
  readonly id: WorksheetType;
  readonly displayName: string;
  readonly generatorVersion: number;
  readonly generate: WorksheetGeneratorV1;
  readonly hasAnswerKey: boolean;
  readonly usesInterests: boolean;
  readonly controls: WorksheetControlContractV1;
}

export const WORKSHEET_REGISTRY = {
  "dry-math": {
    ...DRY_MATH_DEFINITION,
    generate: generateDryMath,
    controls: {
      getCapabilitySupport: ({ profile }) => {
        const support = getDryMathCapabilitySupport(profile.mathSkills);
        return support.available
          ? { available: true }
          : { available: false, message: support.reason };
      },
      getRelevantMaximums: () => OPERAND_RESULT_MAXIMUMS,
      getEffectiveUnit: ({ length, printScale }) => ({
        count: getDryMathItemCount(length, printScale),
        singularLabel: "problem",
        pluralLabel: "problems",
      }),
      getApplicableControls: () => ({
        useDisplayName: true,
        useInterests: false,
        includeDecorativeGraphics: false,
        difficulty: true,
        length: true,
        includeAnswerKey: true,
        paperSize: true,
        printScale: true,
      }),
      projectPreferences: (_context, preferences) => ({
        ...preferences,
        useInterests: false,
        includeDecorativeGraphics: false,
      }),
    },
  },
  "find-the-wow": {
    ...FIND_THE_WOW_DEFINITION,
    generate: generateFindTheWow,
    controls: {
      getCapabilitySupport: ({ difficulty, profile }) => {
        const support = getFindTheWowCapabilitySupport(
          profile.mathSkills,
          difficulty,
        );
        return support.available
          ? {
              available: true,
              statusMessage: `This profile will use ${support.mode} mode for Two Whats and a Wow.`,
            }
          : { available: false, message: support.reason };
      },
      getRelevantMaximums: ({ difficulty, profile }) => {
        const support = getFindTheWowCapabilitySupport(
          profile.mathSkills,
          difficulty,
        );
        if (!support.available) {
          return [];
        }
        return support.mode === "equation"
          ? OPERAND_RESULT_MAXIMUMS
          : COUNTING_NUMERAL_MAXIMUMS;
      },
      getEffectiveUnit: ({ length, printScale }) => ({
        count: getFindTheWowGroupCount(length, printScale),
        singularLabel: "group",
        pluralLabel: "groups",
      }),
      getApplicableControls: () => ({
        useDisplayName: true,
        useInterests: false,
        includeDecorativeGraphics: false,
        difficulty: true,
        length: true,
        includeAnswerKey: true,
        paperSize: true,
        printScale: true,
      }),
      projectPreferences: (_context, preferences) => ({
        ...preferences,
        useInterests: false,
        includeDecorativeGraphics: false,
      }),
    },
  },
  "sentence-builder": {
    ...SENTENCE_BUILDER_DEFINITION,
    generate: generateSentenceBuilder,
    controls: {
      getCapabilitySupport: ({ length, printScale, profile }) => {
        const support = getSentenceBuilderCapabilitySupport(
          profile.writingMode,
          profile.presentationBand,
          length,
          printScale,
        );
        return support.available
          ? {
              available: true,
              statusMessage: `This profile will use ${SENTENCE_BUILDER_MODE_LABELS[profile.writingMode]} mode for Sentence Builder.`,
            }
          : { available: false, message: support.reason };
      },
      // Sentence Builder reads no stored numeric maximum, exactly as the sole
      // projection boundary scales none for it.
      getRelevantMaximums: () => NO_MAXIMUMS,
      getEffectiveUnit: ({ length, printScale, profile }) => {
        const bankSize = getSentenceBuilderBankSize(
          profile.writingMode,
          length,
          printScale,
        );
        // A Sentence Builder page always holds exactly one prompt, so the
        // per-document singular names that prompt. Length scales bank breadth
        // instead of prompt count, so the plural — the only form a bank-bearing
        // count of 4 or more can select — names the word-bank entries the
        // preview must state before generation (plan.md:238).
        return bankSize === 0
          ? {
              count: SENTENCE_BUILDER_ITEM_COUNT,
              singularLabel: "writing prompt",
              pluralLabel: "writing prompts",
            }
          : {
              count: bankSize,
              singularLabel: "writing prompt",
              pluralLabel: "word-bank words",
            };
      },
      getApplicableControls: ({ profile }) => ({
        useDisplayName: true,
        useInterests: true,
        // Sentence Builder and Count, Compare & Make are the two families
        // whose parent-chosen decorative value reaches `GenerationRequestV1`
        // (plan.md:202 for the reserved panel, plan.md:217 for the control);
        // the sole projection boundary forces `false` for Dry Math and Two
        // Whats and a Wow and passes these two through. The reserved panel
        // and its same-size doodle-box fallback landed in Step 7, so the
        // graphics-independence assertions run against a non-vacuous baseline
        // rather than a toggle nothing renders from.
        includeDecorativeGraphics: true,
        difficulty: false,
        length: isBankWritingMode(profile.writingMode),
        includeAnswerKey: false,
        paperSize: true,
        printScale: true,
      }),
      projectPreferences: ({ profile }, preferences) => ({
        ...preferences,
        difficulty: "practice",
        includeAnswerKey: false,
        length: getSentenceBuilderCanonicalLength(
          profile.writingMode,
          preferences.length,
        ),
      }),
    },
  },
  "count-compare-make": {
    ...COUNT_COMPARE_MAKE_DEFINITION,
    generate: generateCountCompareMake,
    controls: {
      getCapabilitySupport: ({ profile }) => {
        const support = getCountCompareMakeCapabilitySupport(profile.mathSkills);
        return support.available
          ? { available: true }
          : { available: false, message: support.reason };
      },
      // The three maxima the sole projection boundary scales for this family:
      // counting and numerals bound match/complete/draw work, comparisons
      // bound the two compared groups (plan.md:207).
      getRelevantMaximums: () => COUNTING_NUMERAL_COMPARE_MAXIMUMS,
      getEffectiveUnit: ({ length, printScale }) => ({
        count: getCountCompareMakeItemCount(length, printScale),
        singularLabel: "item",
        pluralLabel: "items",
      }),
      getApplicableControls: () => ({
        useDisplayName: true,
        useInterests: true,
        includeDecorativeGraphics: true,
        difficulty: true,
        length: true,
        includeAnswerKey: true,
        paperSize: true,
        printScale: true,
      }),
      // Every control this family exposes is honored as chosen, so this
      // registration itself normalizes nothing away. The sole projection
      // boundary still applies its family-independent rules - most visibly
      // the stretch-to-practice downgrade when every relevant maximum is
      // already 20 (plan.md:227).
      projectPreferences: (_context, preferences) => preferences,
    },
  },
} as const satisfies Record<string, WorksheetRegistrationV1>;

export type RegisteredWorksheetType = keyof typeof WORKSHEET_REGISTRY;

export const REGISTERED_WORKSHEET_IDS = Object.freeze(
  Object.keys(WORKSHEET_REGISTRY) as RegisteredWorksheetType[],
);

export function getWorksheetRegistration(
  worksheetType: RegisteredWorksheetType,
): WorksheetRegistrationV1 {
  return WORKSHEET_REGISTRY[worksheetType];
}
