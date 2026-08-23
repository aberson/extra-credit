import type {
  MathSkillsV1,
  PresentationBand,
} from "./schema.js";

export const MATH_PRESET_IDS = [
  "quantities-to-10",
  "emerging-equations-within-5",
  "early-primary-within-10",
  "early-primary-within-20",
  "custom",
] as const;

export type MathPresetId = (typeof MATH_PRESET_IDS)[number];
export type ConcreteMathPresetId = Exclude<MathPresetId, "custom">;

export interface ExpandedMathPreset {
  readonly presentationBand: PresentationBand;
  readonly mathSkills: MathSkillsV1;
}

interface MathPresetDefinition {
  readonly presentationBand: PresentationBand | null;
  readonly mathSkills: MathSkillsV1 | null;
}

export const MATH_PRESETS = {
  "quantities-to-10": {
    presentationBand: "preschool",
    mathSkills: {
      countingMax: 10,
      numeralMax: 10,
      compareMax: 10,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
  },
  "emerging-equations-within-5": {
    presentationBand: null,
    mathSkills: {
      countingMax: 10,
      numeralMax: 10,
      compareMax: 10,
      representations: ["quantities", "equations"],
      understandsEquality: false,
      operations: ["addition"],
      operandMax: 5,
      resultMax: 5,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
  },
  "early-primary-within-10": {
    presentationBand: "early-primary",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 10,
      resultMax: 10,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
  },
  "early-primary-within-20": {
    presentationBand: "early-primary",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 20,
      resultMax: 20,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
  },
  custom: {
    presentationBand: null,
    mathSkills: null,
  },
} as const satisfies Record<MathPresetId, MathPresetDefinition>;

export function expandMathPreset(
  presetId: ConcreteMathPresetId,
  parentConfirmedBand?: PresentationBand,
): ExpandedMathPreset {
  const preset = MATH_PRESETS[presetId];
  const presentationBand = preset.presentationBand ?? parentConfirmedBand;

  if (presentationBand === undefined) {
    throw new Error("A parent-confirmed presentation band is required.");
  }

  const mathSkills: MathSkillsV1 = preset.mathSkills;

  return {
    presentationBand,
    mathSkills: {
      ...mathSkills,
      representations: [...mathSkills.representations],
      operations: [...mathSkills.operations],
    },
  };
}

export type AgePresetSuggestion =
  | { readonly status: "selected"; readonly presetId: ConcreteMathPresetId }
  | {
      readonly status: "choice";
      readonly presetIds: readonly [
        "quantities-to-10",
        "emerging-equations-within-5",
      ];
    }
  | { readonly status: "unsupported" };

export function getAgePresetSuggestion(ageYears: number): AgePresetSuggestion {
  if (ageYears === 4) {
    return { status: "selected", presetId: "quantities-to-10" };
  }
  if (ageYears === 5) {
    return {
      status: "choice",
      presetIds: [
        "quantities-to-10",
        "emerging-equations-within-5",
      ],
    };
  }
  if (ageYears === 6 || ageYears === 7) {
    return { status: "selected", presetId: "early-primary-within-10" };
  }
  if (ageYears === 8) {
    return { status: "selected", presetId: "early-primary-within-20" };
  }
  return { status: "unsupported" };
}
