import { normalizedInterestKey } from "../config/normalize.js";
import {
  ChildProfileV1Schema,
  type ChildProfileV1,
  type ChildProfileV2,
  type GenerationDefaultsV1,
  type MathSkillsV1,
} from "../config/schema.js";
import { parseSeedHex } from "./seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  REVIEWED_TOPIC_IDS,
  worksheetMaximum,
  type EffectiveMathSkillsV1,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type TopicId,
  type WorksheetGeneratorV1,
  type WorksheetType,
} from "./types.js";

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

/**
 * Interim (plan D-interim; Step 16 replaces this input with the worksheet
 * selection): the capabilities the unchanged projection and the registry read,
 * which is a version 1 profile without its age. A version 2 profile carries
 * them only as the read-only `legacyChoices` that migration or the interim
 * profile editor wrote.
 */
export const CapabilityProfileV1Schema = ChildProfileV1Schema.omit({
  ageYears: true,
});

export type CapabilityProfileV1 = Omit<ChildProfileV1, "ageYears">;

/**
 * Flattens a stored profile's `legacyChoices` into the capability shape, or
 * `undefined` when the profile carries none: such a profile has nothing the
 * interim projection could read, and the controls say so explicitly.
 */
export function capabilityProfileOf(
  profile: ChildProfileV2,
): CapabilityProfileV1 | undefined {
  const legacy = profile.legacyChoices;
  if (legacy === undefined) {
    return undefined;
  }
  return {
    id: profile.id,
    ...(profile.displayName === undefined
      ? {}
      : { displayName: profile.displayName }),
    presentationBand: legacy.presentationBand,
    reviewedOn: profile.reviewedOn,
    mathSkills: {
      ...legacy.mathSkills,
      representations: [...legacy.mathSkills.representations],
      operations: [...legacy.mathSkills.operations],
    },
    writingMode: legacy.writingMode,
    interests: [...profile.interests],
  };
}

/**
 * The inverse of `capabilityProfileOf`: the stored version 2 profile whose
 * `legacyChoices` hold these capabilities. The interim profile editor saves
 * through it (D-interim).
 */
export function profileWithLegacyChoices(
  capabilities: CapabilityProfileV1,
): ChildProfileV2 {
  return {
    id: capabilities.id,
    ...(capabilities.displayName === undefined
      ? {}
      : { displayName: capabilities.displayName }),
    reviewedOn: capabilities.reviewedOn,
    interests: [...capabilities.interests],
    legacyChoices: {
      presentationBand: capabilities.presentationBand,
      writingMode: capabilities.writingMode,
      mathSkills: {
        ...capabilities.mathSkills,
        representations: [...capabilities.mathSkills.representations],
        operations: [...capabilities.mathSkills.operations],
      },
    },
  };
}

/**
 * The explicit unavailable message for a profile with no earlier worksheet
 * settings (D-interim), shared by the controls and the session creator.
 */
export const NO_EARLIER_SETTINGS_MESSAGE =
  "This profile has no saved worksheet settings yet. Edit it and choose a math preset before creating a worksheet for it.";

export interface ProjectGenerationRequestInput {
  readonly profile: CapabilityProfileV1;
  readonly worksheetType: WorksheetType;
  readonly generatorVersion: number;
  readonly seed: string;
  readonly preferences: GenerationDefaultsV1;
  readonly stretchConfirmed?: boolean;
}

export type ProjectionFailure = {
  readonly ok: false;
  readonly code: typeof GENERATION_CONSTRAINT_CONFLICT;
  readonly message: string;
};

export type ProjectionResult =
  | { readonly ok: true; readonly request: GenerationRequestV1 }
  | ProjectionFailure;

export type ProjectAndGenerateResult = GenerationResult | ProjectionFailure;

function clampPositive(value: number, maximum: number): number {
  return value === 0 ? 0 : Math.min(value, maximum);
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
    countingMax: clampPositive(skills.countingMax, worksheetMaximum(worksheetType, "countingMax")),
    numeralMax: clampPositive(skills.numeralMax, worksheetMaximum(worksheetType, "numeralMax")),
    compareMax: clampPositive(skills.compareMax, worksheetMaximum(worksheetType, "compareMax")),
    operandMax: clampPositive(skills.operandMax, worksheetMaximum(worksheetType, "operandMax")),
    resultMax: clampPositive(skills.resultMax, worksheetMaximum(worksheetType, "resultMax")),
  };
  const relevantKeys = relevantMaximumKeys(worksheetType).filter(
    (key) => numeric[key] > 0,
  );
  let effectiveDifficulty =
    worksheetType === "sentence-builder" ? "practice" : requestedDifficulty;

  if (
    effectiveDifficulty === "stretch" &&
    (relevantKeys.length === 0 ||
      relevantKeys.every((key) => numeric[key] === worksheetMaximum(worksheetType, key)))
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
        worksheetMaximum(worksheetType, key),
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

function projectTopics(profile: CapabilityProfileV1): readonly TopicId[] {
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
