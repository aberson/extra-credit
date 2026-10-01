import { DEFAULT_WORKSHEET_DEFAULTS_V2 } from "../config/defaults.js";
import { MATH_PRESETS } from "../config/math-presets.js";
import { normalizedInterestKey } from "../config/normalize.js";
import { presentationBandForVocabulary } from "../config/practice-focus.js";
import type {
  ArithmeticFocusV2,
  ChildProfileV2,
  WorksheetSelectionV2,
} from "../config/schema.js";
import { parseSeedHex } from "./seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  REVIEWED_TOPIC_IDS,
  type EffectiveCapabilitiesV1,
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

const INACTIVE_MATH_SOURCE = MATH_PRESETS["quantities-to-10"].mathSkills;

/**
 * The value of every math capability a family does not read (DD13): the
 * proven-valid `quantities-to-10` shape, so another family's focus or an
 * inapplicable control can never change a request.
 */
export const INACTIVE_MATH_FIELDS: EffectiveMathSkillsV1 = Object.freeze({
  countingMax: INACTIVE_MATH_SOURCE.countingMax,
  numeralMax: INACTIVE_MATH_SOURCE.numeralMax,
  compareMax: INACTIVE_MATH_SOURCE.compareMax,
  representations: Object.freeze([...INACTIVE_MATH_SOURCE.representations]),
  understandsEquality: INACTIVE_MATH_SOURCE.understandsEquality,
  operations: Object.freeze([...INACTIVE_MATH_SOURCE.operations]),
  operandMax: INACTIVE_MATH_SOURCE.operandMax,
  resultMax: INACTIVE_MATH_SOURCE.resultMax,
  allowRegrouping: false,
  allowNegativeResults: false,
});

/**
 * The writing capabilities of every family other than Sentence Builder
 * (D40): the default Sentence choices read through the vocabulary mapping, so
 * neither the Sentence choices nor a child's earlier settings reach another
 * family's request.
 */
export const INACTIVE_WRITING_CAPABILITIES: Pick<
  EffectiveCapabilitiesV1,
  "presentationBand" | "writingMode"
> = Object.freeze({
  presentationBand: presentationBandForVocabulary(
    DEFAULT_WORKSHEET_DEFAULTS_V2.sentenceBuilder.vocabulary,
  ),
  writingMode: DEFAULT_WORKSHEET_DEFAULTS_V2.sentenceBuilder.variant,
});

/** The child fields a request may carry: the nickname and the reviewed interests. */
export type ProjectionChild = Pick<ChildProfileV2, "displayName" | "interests">;

export interface ProjectGenerationRequestInput {
  /**
   * The selected child, whose nickname and reviewed interests personalize the
   * page. Absent for a child-free probe, which projects no personalization.
   */
  readonly profile?: ProjectionChild;
  readonly selection: WorksheetSelectionV2;
  readonly generatorVersion: number;
  readonly seed: string;
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

function inactiveMath(): EffectiveMathSkillsV1 {
  return {
    ...INACTIVE_MATH_FIELDS,
    representations: [...INACTIVE_MATH_FIELDS.representations],
    operations: [...INACTIVE_MATH_FIELDS.operations],
  };
}

function arithmeticMath(
  focus: ArithmeticFocusV2,
  understandsEquality: boolean,
): EffectiveMathSkillsV1 {
  return {
    ...inactiveMath(),
    representations: ["equations"],
    understandsEquality,
    operations: [...focus.operations],
    operandMax: focus.operandMax,
    resultMax: focus.resultMax,
  };
}

/**
 * The exact capabilities one selection projects for one family (DD13's
 * table). Each family reads only its own focus; every field it does not read
 * is pinned to `INACTIVE_MATH_FIELDS` or `INACTIVE_WRITING_CAPABILITIES`, and
 * the representation is implied by the family and, for Two Whats and a Wow,
 * by its Statements variant, so the variant is the only mode the family's
 * capability rule can resolve.
 */
export function projectWorksheetCapabilities(
  selection: WorksheetSelectionV2,
  worksheetType: WorksheetType,
): EffectiveCapabilitiesV1 {
  switch (worksheetType) {
    case "dry-math":
      return {
        ...INACTIVE_WRITING_CAPABILITIES,
        mathSkills: arithmeticMath(selection.dryMath, false),
      };
    case "find-the-wow":
      return {
        ...INACTIVE_WRITING_CAPABILITIES,
        mathSkills:
          selection.findTheWow.variant === "equation"
            ? arithmeticMath(selection.findTheWow.equation, true)
            : {
                ...inactiveMath(),
                representations: ["quantities"],
                countingMax: selection.findTheWow.quantity.countingMax,
                numeralMax: selection.findTheWow.quantity.numeralMax,
              },
      };
    case "count-compare-make":
      return {
        ...INACTIVE_WRITING_CAPABILITIES,
        mathSkills: {
          ...inactiveMath(),
          representations: ["quantities"],
          countingMax: selection.countCompareMake.countingMax,
          numeralMax: selection.countCompareMake.numeralMax,
          compareMax: selection.countCompareMake.compareMax,
        },
      };
    case "sentence-builder":
      return {
        presentationBand: presentationBandForVocabulary(
          selection.sentenceBuilder.vocabulary,
        ),
        writingMode: selection.sentenceBuilder.variant,
        mathSkills: inactiveMath(),
      };
  }
}

function projectTopics(child: ProjectionChild): readonly TopicId[] {
  const topics: TopicId[] = [];
  for (const interest of child.interests) {
    const normalized = normalizedInterestKey(interest) as TopicId;
    if (REVIEWED_TOPIC_ID_SET.has(normalized) && !topics.includes(normalized)) {
      topics.push(normalized);
    }
  }
  return topics;
}

/**
 * The one family whose request carries `topicIds`: Sentence Builder's prompts
 * and word banks follow the reviewed interests. Count, Compare & Make's
 * interests only ever chose its artwork, which the Theme now decides.
 */
function worksheetUsesInterests(worksheetType: WorksheetType): boolean {
  return worksheetType === "sentence-builder";
}

/**
 * The decorative topic a selection's Theme resolves to, or `undefined` when
 * the request carries none.
 *
 * Nothing is carried while decorative graphics are off, nor for the two
 * families that print no decoration, so the Theme cannot change their
 * requests. An explicit topic or Neutral resolves to itself. "From interests"
 * means the child's first reviewed interest in profile order for Count,
 * Compare & Make, else Neutral; for Sentence Builder it carries nothing, so
 * the art keeps following the generated prompt's topic.
 */
function projectDecorativeTopicId(
  selection: WorksheetSelectionV2,
  profile: ProjectionChild | undefined,
): TopicId | undefined {
  if (!selection.includeDecorativeGraphics) {
    return undefined;
  }
  switch (selection.worksheetType) {
    case "dry-math":
    case "find-the-wow":
      return undefined;
    case "sentence-builder":
      return selection.theme === "from-interests" ? undefined : selection.theme;
    case "count-compare-make":
      if (selection.theme !== "from-interests") {
        return selection.theme;
      }
      return (profile === undefined ? undefined : projectTopics(profile)[0]) ?? "neutral";
  }
}

/** The canonical length: the two no-bank Sentence activities always print standard. */
function projectedLength(selection: WorksheetSelectionV2): WorksheetSelectionV2["length"] {
  return selection.worksheetType === "sentence-builder" &&
    (selection.sentenceBuilder.variant === "draw-and-tell" ||
      selection.sentenceBuilder.variant === "copy-with-model")
    ? "standard"
    : selection.length;
}

/**
 * The only production boundary from a worksheet selection (and the selected
 * child's personalization) to generation data. The request carries exactly
 * the stated practice focus: nothing is scaled, and no child capability is
 * read.
 */
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

  const { selection } = input;
  const worksheetType = selection.worksheetType;
  const topicIds =
    input.profile !== undefined &&
    selection.useInterests &&
    worksheetUsesInterests(worksheetType)
      ? projectTopics(input.profile)
      : [];
  const displayName =
    selection.useDisplayName && input.profile?.displayName !== undefined
      ? input.profile.displayName
      : undefined;
  const decorativeTopicId = projectDecorativeTopicId(selection, input.profile);

  return {
    ok: true,
    request: {
      schemaVersion: 1,
      worksheetType,
      generatorVersion: input.generatorVersion,
      seed: input.seed,
      capabilities: projectWorksheetCapabilities(selection, worksheetType),
      options: {
        length: projectedLength(selection),
        includeDecorativeGraphics:
          worksheetType === "dry-math" || worksheetType === "find-the-wow"
            ? false
            : selection.includeDecorativeGraphics,
        includeAnswerKey:
          worksheetType === "sentence-builder" ? false : selection.includeAnswerKey,
        paperSize: selection.paperSize,
        printScale: selection.printScale,
        ...(decorativeTopicId === undefined ? {} : { decorativeTopicId }),
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
