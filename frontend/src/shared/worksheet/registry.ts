import { presentationBandForVocabulary } from "../config/practice-focus.js";
import type { WorksheetSelectionV2 } from "../config/schema.js";
import {
  COUNT_COMPARE_MAKE_DEFINITION,
  getCountCompareMakeCapabilitySupport,
  getCountCompareMakeItemCount,
} from "../../worksheets/count-compare-make/definition.js";
import {
  countCompareMakeCapacityVerdict,
  generateCountCompareMake,
} from "../../worksheets/count-compare-make/generator.js";
import {
  DRY_MATH_DEFINITION,
  getDryMathCapabilitySupport,
  getDryMathItemCount,
} from "../../worksheets/dry-math/definition.js";
import {
  dryMathCapacityVerdict,
  generateDryMath,
} from "../../worksheets/dry-math/generator.js";
import {
  FIND_THE_WOW_DEFINITION,
  FIND_THE_WOW_VARIANT_LABELS,
  getFindTheWowCapabilitySupport,
  getFindTheWowGroupCount,
} from "../../worksheets/find-the-wow/definition.js";
import {
  findTheWowCapacityVerdict,
  generateFindTheWow,
} from "../../worksheets/find-the-wow/generator.js";
import {
  SENTENCE_BUILDER_DEFINITION,
  SENTENCE_BUILDER_ITEM_COUNT,
  SENTENCE_BUILDER_VARIANT_LABELS,
  getSentenceBuilderBankSize,
  getSentenceBuilderCapabilitySupport,
} from "../../worksheets/sentence-builder/definition.js";
import { generateSentenceBuilder } from "../../worksheets/sentence-builder/generator.js";
import { isBankWritingMode } from "../../worksheets/sentence-builder/vocabulary.js";
import {
  COUNTING_NUMERAL_COMPARE_MAXIMUMS,
  COUNTING_NUMERAL_MAXIMUMS,
  NO_MAXIMUMS,
  OPERAND_RESULT_MAXIMUMS,
  joinLabels,
  type WorksheetRelevantMaximumV1,
} from "./limit-labels.js";
import {
  projectGenerationRequest,
  projectWorksheetCapabilities,
} from "./project-request.js";
import type {
  GenerationRequestV1,
  WorksheetGeneratorV1,
  WorksheetType,
} from "./types.js";

export type {
  WorksheetRelevantMaximumKey,
  WorksheetRelevantMaximumV1,
} from "./limit-labels.js";

/**
 * What every family control reads: the worksheet selection alone. No child
 * field reaches availability, capacity or advice; the selected child only
 * personalizes the page at projection time.
 */
export interface WorksheetControlContextV2 {
  readonly selection: WorksheetSelectionV2;
}

/**
 * Whether the effective limits behind an AVAILABLE selection can actually
 * supply the distinct exercises its length asks for.
 *
 * Availability and capacity are two different questions and issue #14 was born
 * of answering only the first: `getFindTheWowCapabilitySupport` resolved a
 * mode, the control said "Create", and the generator then refused the click
 * because the practice focus held fewer distinct stems than the length
 * needed. Every registration now answers both.
 */
export type WorksheetCapacityVerdictV1 =
  | { readonly sufficient: true }
  | { readonly sufficient: false; readonly message: string };

export type WorksheetCapabilitySupportV1 =
  | {
      readonly available: true;
      readonly capacity: WorksheetCapacityVerdictV1;
      readonly statusMessage?: string;
    }
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
  /** The decorative Theme, which applies only while decorative graphics are on. */
  readonly theme: boolean;
  /** A practice focus: the operations and range a math family practices. */
  readonly practiceFocus: boolean;
  /** Statements (Two Whats and a Wow) or Writing activity (Sentence Builder). */
  readonly variant: boolean;
  /** Sentence Builder's plain-language vocabulary choice. */
  readonly vocabulary: boolean;
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
 * allows missing keys. The exhaustive `projectWorksheetCapabilities` switch in
 * `project-request.ts` is what then fails to compile.
 */
export interface WorksheetControlContractV1 {
  readonly getCapabilitySupport: (
    context: WorksheetControlContextV2,
  ) => WorksheetCapabilitySupportV1;
  /**
   * One sentence naming the resource that actually bounds this family's
   * variety, for the shared generation session to append to its exhaustion
   * message.
   *
   * The shared message used to end with one piece of numeric advice for every
   * family. That is true of the three math families, whose variety really is
   * bounded by the practice focus, and false of Sentence Builder, whose
   * variety is bounded by the reviewed vocabulary for a writing activity - a
   * parent following that advice would change numbers that cannot change the
   * outcome (issue #16). The families that DO name numeric maxima derive this
   * sentence from `getRelevantMaximums`, so one list feeds both.
   */
  readonly getLimitingResourceAdvice: (
    context: WorksheetControlContextV2,
  ) => string;
  /**
   * The practice-focus maxima this family actually reads for the given
   * selection. It must never claim a key the sole projection boundary would
   * not carry from the focus into the request.
   */
  readonly getRelevantMaximums: (
    context: WorksheetControlContextV2,
  ) => readonly WorksheetRelevantMaximumV1[];
  readonly getEffectiveUnit: (
    context: WorksheetControlContextV2,
  ) => WorksheetEffectiveUnitV1;
  readonly getApplicableControls: (
    context: WorksheetControlContextV2,
  ) => WorksheetApplicableControlsV1;
}

const SUFFICIENT_CAPACITY: WorksheetCapacityVerdictV1 = Object.freeze({
  sufficient: true,
});

/**
 * The seed the capacity probe below projects with.
 *
 * Capacity is a property of the practice focus and the length budget, never
 * of the seed: every family counts the whole candidate collection before it
 * draws from it, so a shortage fails closed on every seed rather than on some.
 * A fixed nonzero seed therefore measures the same capacity the parent's real
 * draw will meet, and keeps the control free of a random source.
 */
export const CAPACITY_PROBE_SEED = "00000001";

/**
 * The selection fields that cannot move any family's capacity, pinned so the
 * probe varies only what the worksheet choices really decide.
 *
 * Nickname, interests, decoration, answer key and paper size change what a
 * page SAYS, never how many distinct exercises a practice focus can supply.
 * Sentence Builder is the one family whose vocabulary breadth does follow the
 * reviewed interests, and it does not use this probe: its own gate measures
 * the leanest reviewed topic, which bounds every interest set the parent could
 * enable.
 */
export const CAPACITY_PROBE_PREFERENCES = Object.freeze({
  useDisplayName: false,
  useInterests: false,
  includeDecorativeGraphics: false,
  includeAnswerKey: false,
  paperSize: "letter",
} as const satisfies Pick<
  WorksheetSelectionV2,
  | "useDisplayName"
  | "useInterests"
  | "includeDecorativeGraphics"
  | "includeAnswerKey"
  | "paperSize"
>);

/**
 * Runs a family's own capacity verdict on the request that selection projects.
 *
 * The request is built by the sole projection boundary rather than assembled
 * here, so the maxima the verdict counts against are exactly the ones the
 * generator will really see. The probe projects the selection with no child
 * at all and with `CAPACITY_PROBE_PREFERENCES`: none of the pinned fields can
 * move any family's candidate count, which is why pinning them is safe.
 *
 * A projection that fails reports its own message: the control must never
 * offer a selection it could not even project.
 */
function probeCapacity(
  definition: {
    readonly generatorVersion: number;
    readonly id: WorksheetType;
  },
  context: WorksheetControlContextV2,
  verdictOf: (request: GenerationRequestV1) => string | undefined,
): WorksheetCapacityVerdictV1 {
  const projection = projectGenerationRequest({
    selection: {
      ...context.selection,
      ...CAPACITY_PROBE_PREFERENCES,
      worksheetType: definition.id,
    },
    generatorVersion: definition.generatorVersion,
    seed: CAPACITY_PROBE_SEED,
  });
  const shortfall = projection.ok
    ? verdictOf(projection.request)
    : projection.message;
  return shortfall === undefined
    ? SUFFICIENT_CAPACITY
    : { sufficient: false, message: shortfall };
}

/**
 * The limiting-resource sentence for a family whose variety really is bounded
 * by its practice focus, DERIVED from the same `getRelevantMaximums` list the
 * shortage sentences name. A family that reads no focus maximum must never be
 * given this sentence (issue #16).
 */
function numericLimitAdvice(
  displayName: string,
  maximums: readonly WorksheetRelevantMaximumV1[],
): string {
  return maximums.length === 0
    ? `${displayName} has no further variation to offer for this selection. Create a new worksheet later.`
    : `${displayName} varies within the ${joinLabels(
        maximums.map(({ label }) => label),
      )} range of this practice focus. Choose a practice focus with a wider range, or create a new worksheet later.`;
}

/** The capabilities this selection projects for one family. */
function projectedSkills(
  context: WorksheetControlContextV2,
  worksheetType: WorksheetType,
) {
  return projectWorksheetCapabilities(context.selection, worksheetType)
    .mathSkills;
}

/**
 * The maxima Two Whats and a Wow reads, which follow the mode its projected
 * capabilities resolve to - the Statements variant. One owner for both the
 * declared list and the limiting-resource sentence keeps a quantity page from
 * being explained in terms of operands.
 */
function findTheWowRelevantMaximums(
  context: WorksheetControlContextV2,
): readonly WorksheetRelevantMaximumV1[] {
  const support = getFindTheWowCapabilitySupport(
    projectedSkills(context, FIND_THE_WOW_DEFINITION.id),
  );
  if (!support.available) {
    return NO_MAXIMUMS;
  }
  return support.mode === "equation"
    ? OPERAND_RESULT_MAXIMUMS
    : COUNTING_NUMERAL_MAXIMUMS;
}

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
      getCapabilitySupport: (context) => {
        const support = getDryMathCapabilitySupport(
          projectedSkills(context, DRY_MATH_DEFINITION.id),
        );
        return support.available
          ? {
              available: true,
              capacity: probeCapacity(
                DRY_MATH_DEFINITION,
                context,
                dryMathCapacityVerdict,
              ),
            }
          : { available: false, message: support.reason };
      },
      getLimitingResourceAdvice: () =>
        numericLimitAdvice(
          DRY_MATH_DEFINITION.displayName,
          OPERAND_RESULT_MAXIMUMS,
        ),
      getRelevantMaximums: () => OPERAND_RESULT_MAXIMUMS,
      getEffectiveUnit: ({ selection }) => ({
        count: getDryMathItemCount(selection.length, selection.printScale),
        singularLabel: "problem",
        pluralLabel: "problems",
      }),
      getApplicableControls: () => ({
        useDisplayName: true,
        useInterests: false,
        includeDecorativeGraphics: false,
        theme: false,
        practiceFocus: true,
        variant: false,
        vocabulary: false,
        length: true,
        includeAnswerKey: true,
        paperSize: true,
        printScale: true,
      }),
    },
  },
  "find-the-wow": {
    ...FIND_THE_WOW_DEFINITION,
    generate: generateFindTheWow,
    controls: {
      getCapabilitySupport: (context) => {
        const support = getFindTheWowCapabilitySupport(
          projectedSkills(context, FIND_THE_WOW_DEFINITION.id),
        );
        return support.available
          ? {
              available: true,
              capacity: probeCapacity(
                FIND_THE_WOW_DEFINITION,
                context,
                findTheWowCapacityVerdict,
              ),
              statusMessage: `Statements for Two Whats and a Wow: ${FIND_THE_WOW_VARIANT_LABELS[support.mode]}.`,
            }
          : { available: false, message: support.reason };
      },
      getLimitingResourceAdvice: (context) =>
        numericLimitAdvice(
          FIND_THE_WOW_DEFINITION.displayName,
          findTheWowRelevantMaximums(context),
        ),
      getRelevantMaximums: findTheWowRelevantMaximums,
      getEffectiveUnit: ({ selection }) => ({
        count: getFindTheWowGroupCount(selection.length, selection.printScale),
        singularLabel: "group",
        pluralLabel: "groups",
      }),
      getApplicableControls: () => ({
        useDisplayName: true,
        useInterests: false,
        includeDecorativeGraphics: false,
        theme: false,
        practiceFocus: true,
        variant: true,
        vocabulary: false,
        length: true,
        includeAnswerKey: true,
        paperSize: true,
        printScale: true,
      }),
    },
  },
  "sentence-builder": {
    ...SENTENCE_BUILDER_DEFINITION,
    generate: generateSentenceBuilder,
    controls: {
      getCapabilitySupport: ({ selection }) => {
        const { variant, vocabulary } = selection.sentenceBuilder;
        const support = getSentenceBuilderCapabilitySupport(
          variant,
          presentationBandForVocabulary(vocabulary),
          selection.length,
          selection.printScale,
        );
        const statusMessage = `Writing activity for Sentence Builder: ${SENTENCE_BUILDER_VARIANT_LABELS[variant]}.`;
        // Sentence Builder needs none of the numeric probing the math
        // families do: `getSentenceBuilderCapabilitySupport` already measures
        // the leanest reviewed topic against this length's bank budget, which
        // bounds every interest set the parent could enable. Whether the
        // SHIPPED vocabulary can ever fall short of that budget is pinned
        // exhaustively by `web/generator/options.test.tsx`, so a starved pool
        // added later fails CI rather than reaching a parent as an
        // unexplained refusal.
        return support.available
          ? { available: true, capacity: SUFFICIENT_CAPACITY, statusMessage }
          : { available: false, message: support.reason };
      },
      // Sentence Builder's variety is the reviewed vocabulary, so the numeric
      // advice the math families derive would send a parent to change numbers
      // that cannot change this page (issue #16).
      getLimitingResourceAdvice: ({ selection }) =>
        `Sentence Builder varies within the reviewed vocabulary for ${SENTENCE_BUILDER_VARIANT_LABELS[selection.sentenceBuilder.variant]}, which no practice focus can widen. Choose a different Writing activity, or create a new worksheet later.`,
      // Sentence Builder reads no numeric maximum, exactly as the sole
      // projection boundary carries none into its request.
      getRelevantMaximums: () => NO_MAXIMUMS,
      getEffectiveUnit: ({ selection }) => {
        const bankSize = getSentenceBuilderBankSize(
          selection.sentenceBuilder.variant,
          selection.length,
          selection.printScale,
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
      getApplicableControls: ({ selection }) => ({
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
        // The projection boundary carries no decorative topic while
        // decoration is off, so the Theme applies only while it is on.
        theme: selection.includeDecorativeGraphics,
        practiceFocus: false,
        variant: true,
        vocabulary: true,
        length: isBankWritingMode(selection.sentenceBuilder.variant),
        includeAnswerKey: false,
        paperSize: true,
        printScale: true,
      }),
    },
  },
  "count-compare-make": {
    ...COUNT_COMPARE_MAKE_DEFINITION,
    generate: generateCountCompareMake,
    controls: {
      getCapabilitySupport: (context) => {
        const support = getCountCompareMakeCapabilitySupport(
          projectedSkills(context, COUNT_COMPARE_MAKE_DEFINITION.id),
        );
        return support.available
          ? {
              available: true,
              capacity: probeCapacity(
                COUNT_COMPARE_MAKE_DEFINITION,
                context,
                countCompareMakeCapacityVerdict,
              ),
            }
          : { available: false, message: support.reason };
      },
      getLimitingResourceAdvice: () =>
        numericLimitAdvice(
          COUNT_COMPARE_MAKE_DEFINITION.displayName,
          COUNTING_NUMERAL_COMPARE_MAXIMUMS,
        ),
      // The three focus maxima the sole projection boundary carries for this
      // family: counting and numerals bound match/complete/draw work,
      // comparisons bound the two compared groups (plan.md:207).
      getRelevantMaximums: () => COUNTING_NUMERAL_COMPARE_MAXIMUMS,
      getEffectiveUnit: ({ selection }) => ({
        count: getCountCompareMakeItemCount(selection.length, selection.printScale),
        singularLabel: "item",
        pluralLabel: "items",
      }),
      getApplicableControls: ({ selection }) => ({
        useDisplayName: true,
        // This family's interests only ever chose its artwork; the Theme
        // decides that now, so its requests carry no `topicIds`.
        useInterests: false,
        includeDecorativeGraphics: true,
        theme: selection.includeDecorativeGraphics,
        practiceFocus: true,
        variant: false,
        vocabulary: false,
        length: true,
        includeAnswerKey: true,
        paperSize: true,
        printScale: true,
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
