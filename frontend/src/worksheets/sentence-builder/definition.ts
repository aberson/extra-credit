import type {
  PresentationBand,
  WritingMode,
} from "../../shared/config/schema.js";
import type {
  PrintScale,
  RequiredResponseV1,
  WorksheetLength,
} from "../../shared/worksheet/types.js";
import {
  SENTENCE_BUILDER_VOCABULARY,
  distinctBankWordPool,
  eligibleSentencePrompts,
  isBankWritingMode,
  knownVocabularyTopicIds,
  type BankWritingMode,
  type SentenceVocabularyV1,
} from "./vocabulary.js";

export const SENTENCE_BUILDER_DEFINITION = {
  id: "sentence-builder",
  displayName: "Sentence Builder",
  generatorVersion: 1,
  usesInterests: true,
  hasAnswerKey: false,
} as const;

/** Every Sentence Builder page carries exactly one open prompt (plan.md:198). */
export const SENTENCE_BUILDER_ITEM_COUNT = 1;

/**
 * Unique word-bank entries per bank-bearing mode and length (plan.md:234).
 * `label`/`sentence-frame` take 4/6/8; `independent` takes 6/8/10.
 */
export const SENTENCE_BUILDER_BANK_BUDGETS = {
  label: { short: 4, standard: 6, long: 8 },
  "sentence-frame": { short: 4, standard: 6, long: 8 },
  independent: { short: 6, standard: 8, long: 10 },
} as const satisfies Record<BankWritingMode, Record<WorksheetLength, number>>;

/**
 * The response each writing mode requires. Renderers read the generated item's
 * own `requiredResponse`; this constant is the single place that decides what
 * the generator writes there, so the domain and the paper stay in step.
 */
export const SENTENCE_BUILDER_REQUIRED_RESPONSES = {
  "draw-and-tell": {
    drawing: true,
    dictation: true,
    labels: false,
    copying: false,
    writing: false,
  },
  label: {
    drawing: true,
    dictation: false,
    labels: true,
    copying: false,
    writing: false,
  },
  "copy-with-model": {
    drawing: false,
    dictation: false,
    labels: false,
    copying: true,
    writing: false,
  },
  "sentence-frame": {
    drawing: false,
    dictation: false,
    labels: false,
    copying: false,
    writing: true,
  },
  independent: {
    drawing: true,
    dictation: false,
    labels: false,
    copying: false,
    writing: true,
  },
} as const satisfies Record<WritingMode, RequiredResponseV1>;

export const SENTENCE_BUILDER_MODE_LABELS = {
  "draw-and-tell": "draw and tell",
  label: "label your drawing",
  "copy-with-model": "copy with a model",
  "sentence-frame": "sentence frame",
  independent: "independent writing",
} as const satisfies Record<WritingMode, string>;

function shorterLength(length: WorksheetLength): WorksheetLength {
  return length === "long" ? "standard" : "short";
}

/**
 * The canonical stored length for a writing mode. `draw-and-tell` and
 * `copy-with-model` hide the control and normalize to `standard` (plan.md:131);
 * the three bank modes keep the parent's choice because it selects bank width.
 */
export function getSentenceBuilderCanonicalLength(
  writingMode: WritingMode,
  length: WorksheetLength,
): WorksheetLength {
  return isBankWritingMode(writingMode) ? length : "standard";
}

/**
 * Large print may pull a bank-bearing mode down to the next shorter budget to
 * keep the one-page contract; the two no-bank modes only change response
 * geometry, never their canonical length (plan.md:238).
 */
export function getSentenceBuilderEffectiveLength(
  writingMode: WritingMode,
  length: WorksheetLength,
  printScale: PrintScale,
): WorksheetLength {
  const canonical = getSentenceBuilderCanonicalLength(writingMode, length);
  return isBankWritingMode(writingMode) && printScale === "large"
    ? shorterLength(canonical)
    : canonical;
}

/** Exact unique bank width; zero for the two modes that print no bank. */
export function getSentenceBuilderBankSize(
  writingMode: WritingMode,
  length: WorksheetLength,
  printScale: PrintScale,
): number {
  if (!isBankWritingMode(writingMode)) {
    return 0;
  }
  return SENTENCE_BUILDER_BANK_BUDGETS[writingMode][
    getSentenceBuilderEffectiveLength(writingMode, length, printScale)
  ];
}

export type SentenceBuilderCapabilitySupport =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

/**
 * Parent-facing availability, proved over EVERY reviewed topic in the
 * vocabulary rather than only the neutral fallback.
 *
 * Which topics a generation actually reaches depends on the profile's matched
 * interests, so a gate that measured one topic would be answering about a pool
 * the generator may never touch: adding a topic thinner than that one would
 * make this say "available" and the generator answer
 * `GENERATION_CONSTRAINT_CONFLICT` on the parent's click. Taking the leanest
 * topic makes "available" mean "available for every reachable topic set",
 * whatever the interests are and whether or not they are enabled. It counts
 * the same deduplicated pool the generator slices, so the gate and the
 * selection are measured in one unit.
 */
export function getSentenceBuilderCapabilitySupport(
  writingMode: WritingMode,
  presentationBand: PresentationBand,
  length: WorksheetLength,
  printScale: PrintScale,
  vocabulary: SentenceVocabularyV1 = SENTENCE_BUILDER_VOCABULARY,
): SentenceBuilderCapabilitySupport {
  const bankSize = getSentenceBuilderBankSize(writingMode, length, printScale);
  const topicIds = knownVocabularyTopicIds(vocabulary);
  const unavailablePrompt = {
    available: false,
    reason: `Sentence Builder has no reviewed ${SENTENCE_BUILDER_MODE_LABELS[writingMode]} prompt for this profile's presentation band. Choose a different writing mode in the profile.`,
  } as const;
  if (topicIds.length === 0) {
    return unavailablePrompt;
  }
  let leanestPromptCount = Number.POSITIVE_INFINITY;
  let leanestPoolSize = Number.POSITIVE_INFINITY;
  for (const topicId of topicIds) {
    leanestPromptCount = Math.min(
      leanestPromptCount,
      eligibleSentencePrompts(vocabulary, {
        presentationBand,
        topicId,
        writingMode,
      }).length,
    );
    leanestPoolSize = Math.min(
      leanestPoolSize,
      distinctBankWordPool(vocabulary, topicId, writingMode).length,
    );
  }
  if (leanestPromptCount < 1) {
    return unavailablePrompt;
  }
  if (bankSize > leanestPoolSize) {
    return {
      available: false,
      reason: `Sentence Builder needs ${bankSize} unique reviewed word-bank words for this length, but only ${leanestPoolSize} are available. Choose a shorter worksheet.`,
    };
  }
  return { available: true };
}
