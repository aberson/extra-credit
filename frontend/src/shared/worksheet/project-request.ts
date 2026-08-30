import { getV1ProfileSupport } from "../config/profile-support.js";
import { normalizedInterestKey } from "../config/normalize.js";
import type {
  ChildProfileV1,
  GenerationDefaultsV1,
  MathSkillsV1,
} from "../config/schema.js";
import { parseSeedHex } from "./seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  REVIEWED_TOPIC_IDS,
  type EffectiveMathSkillsV1,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type TopicId,
  type WorksheetGeneratorV1,
  type WorksheetType,
} from "./types.js";

const V1_NUMERIC_MAXIMUM = 20;

/**
 * The allowlist this boundary consults, re-exported so its own test can assert
 * with `toBe` that it is the SAME object as the leaf constant in `types.ts`
 * rather than a second copy that merely looks equal. Nothing should import
 * this instead of `types.ts`; it exists to be checked.
 */
export const PROJECTED_TOPIC_ALLOWLIST: readonly TopicId[] = REVIEWED_TOPIC_IDS;

/** Membership view of that one allowlist; never a second list. */
const REVIEWED_TOPIC_ID_SET: ReadonlySet<TopicId> = new Set(
  PROJECTED_TOPIC_ALLOWLIST,
);

export interface ProjectGenerationRequestInput {
  readonly profile: ChildProfileV1;
  readonly worksheetType: WorksheetType;
  readonly generatorVersion: number;
  readonly seed: string;
  readonly preferences: GenerationDefaultsV1;
  readonly stretchConfirmed?: boolean;
}

export type ProjectionFailure =
  | {
      readonly ok: false;
      readonly code: "GENERATION_AGE_UNSUPPORTED";
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly code: typeof GENERATION_CONSTRAINT_CONFLICT;
      readonly message: string;
    };

export type ProjectionResult =
  | { readonly ok: true; readonly request: GenerationRequestV1 }
  | ProjectionFailure;

export type ProjectAndGenerateResult = GenerationResult | ProjectionFailure;

function clampPositive(value: number): number {
  return value === 0 ? 0 : Math.min(value, V1_NUMERIC_MAXIMUM);
}

function relevantMaximumKeys(
  worksheetType: WorksheetType,
): readonly (keyof Pick<
  EffectiveMathSkillsV1,
  "countingMax" | "numeralMax" | "compareMax" | "operandMax" | "resultMax"
>)[] {
  switch (worksheetType) {
    case "dry-math":
      return ["operandMax", "resultMax"];
    case "find-the-wow":
      return ["countingMax", "numeralMax", "operandMax", "resultMax"];
    case "count-compare-make":
      return ["countingMax", "numeralMax", "compareMax"];
    case "sentence-builder":
      return [];
  }
}

function applyDifficulty(
  skills: MathSkillsV1,
  worksheetType: WorksheetType,
  requestedDifficulty: GenerationDefaultsV1["difficulty"],
  stretchConfirmed: boolean,
):
  | {
      readonly ok: true;
      readonly difficulty: GenerationDefaultsV1["difficulty"];
      readonly mathSkills: EffectiveMathSkillsV1;
    }
  | ProjectionFailure {
  const numeric = {
    countingMax: clampPositive(skills.countingMax),
    numeralMax: clampPositive(skills.numeralMax),
    compareMax: clampPositive(skills.compareMax),
    operandMax: clampPositive(skills.operandMax),
    resultMax: clampPositive(skills.resultMax),
  };
  const relevantKeys = relevantMaximumKeys(worksheetType).filter(
    (key) => numeric[key] > 0,
  );
  let effectiveDifficulty =
    worksheetType === "sentence-builder" ? "practice" : requestedDifficulty;

  if (
    effectiveDifficulty === "stretch" &&
    (relevantKeys.length === 0 ||
      relevantKeys.every((key) => numeric[key] === V1_NUMERIC_MAXIMUM))
  ) {
    effectiveDifficulty = "practice";
  } else if (effectiveDifficulty === "stretch" && !stretchConfirmed) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "Confirm the one-time stretch limits before generating this worksheet.",
    };
  }

  for (const key of relevantKeys) {
    const base = numeric[key];
    if (effectiveDifficulty === "confidence") {
      numeric[key] = Math.max(1, Math.floor(base * 0.75));
    } else if (effectiveDifficulty === "stretch") {
      numeric[key] = Math.min(
        V1_NUMERIC_MAXIMUM,
        base + Math.max(1, Math.ceil(base * 0.25)),
      );
    }
  }

  return {
    ok: true,
    difficulty: effectiveDifficulty,
    mathSkills: {
      ...numeric,
      representations: [...skills.representations],
      understandsEquality: skills.understandsEquality,
      operations: [...skills.operations],
      allowRegrouping: false,
      allowNegativeResults: false,
    },
  };
}

function projectTopics(profile: ChildProfileV1): readonly TopicId[] {
  const topics: TopicId[] = [];
  for (const interest of profile.interests) {
    const normalized = normalizedInterestKey(interest) as TopicId;
    if (REVIEWED_TOPIC_ID_SET.has(normalized) && !topics.includes(normalized)) {
      topics.push(normalized);
    }
  }
  return topics;
}

function worksheetUsesInterests(worksheetType: WorksheetType): boolean {
  return worksheetType === "sentence-builder" || worksheetType === "count-compare-make";
}

/** The only production boundary from a stored child profile to generation data. */
export function projectGenerationRequest(
  input: ProjectGenerationRequestInput,
): ProjectionResult {
  const support = getV1ProfileSupport(input.profile);
  if (!support.supported) {
    return {
      ok: false,
      code: support.code,
      message:
        "Version 1 worksheets support ages 4–8. This profile stays saved for a future skill pack.",
    };
  }

  if (!Number.isSafeInteger(input.generatorVersion) || input.generatorVersion < 1) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "The selected worksheet generator version is invalid.",
    };
  }
  try {
    parseSeedHex(input.seed);
  } catch {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "A valid nonzero worksheet seed could not be created.",
    };
  }

  const effective = applyDifficulty(
    input.profile.mathSkills,
    input.worksheetType,
    input.preferences.difficulty,
    input.stretchConfirmed === true,
  );
  if (!effective.ok) {
    return effective;
  }

  const topicIds =
    input.preferences.useInterests && worksheetUsesInterests(input.worksheetType)
      ? projectTopics(input.profile)
      : [];
  const displayName =
    input.preferences.useDisplayName && input.profile.displayName !== undefined
      ? input.profile.displayName
      : undefined;

  return {
    ok: true,
    request: {
      schemaVersion: 1,
      worksheetType: input.worksheetType,
      generatorVersion: input.generatorVersion,
      seed: input.seed,
      capabilities: {
        presentationBand: input.profile.presentationBand,
        writingMode: input.profile.writingMode,
        mathSkills: effective.mathSkills,
      },
      options: {
        difficulty: effective.difficulty,
        length:
          input.worksheetType === "sentence-builder" &&
          (input.profile.writingMode === "draw-and-tell" ||
            input.profile.writingMode === "copy-with-model")
            ? "standard"
            : input.preferences.length,
        includeDecorativeGraphics:
          input.worksheetType === "dry-math" ||
          input.worksheetType === "find-the-wow"
            ? false
            : input.preferences.includeDecorativeGraphics,
        includeAnswerKey:
          input.worksheetType === "sentence-builder"
            ? false
            : input.preferences.includeAnswerKey,
        paperSize: input.preferences.paperSize,
        printScale: input.preferences.printScale,
      },
      ...(displayName === undefined ? {} : { displayName }),
      ...(topicIds.length === 0 ? {} : { topicIds }),
    },
  };
}

export function projectAndGenerateWorksheet(
  input: ProjectGenerationRequestInput,
  generator: WorksheetGeneratorV1,
  context: GeneratorContextV1,
): ProjectAndGenerateResult {
  const projection = projectGenerationRequest(input);
  return projection.ok ? generator(projection.request, context) : projection;
}
