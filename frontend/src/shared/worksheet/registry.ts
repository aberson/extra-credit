import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../config/schema.js";
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
 * Keeping this required on every registration makes later worksheet IDs fail
 * compilation until their capability, budget, and option behavior is explicit.
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
