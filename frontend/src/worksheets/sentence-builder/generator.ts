import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  type GenerationFailure,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type SentenceItemV1,
  type TopicId,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import {
  SENTENCE_BUILDER_DEFINITION,
  SENTENCE_BUILDER_ITEM_COUNT,
  SENTENCE_BUILDER_MODE_LABELS,
  SENTENCE_BUILDER_REQUIRED_RESPONSES,
  getSentenceBuilderBankSize,
  getSentenceBuilderCanonicalLength,
} from "./definition.js";
import {
  FALLBACK_TOPIC_ID,
  SENTENCE_BUILDER_VOCABULARY,
  distinctBankWordPool,
  eligibleSentencePrompts,
  knownVocabularyTopicIds,
  type EligibleSentencePromptV1,
  type SentenceVocabularyV1,
} from "./vocabulary.js";

export type SentenceBuilderDocumentV1 = WorksheetDocumentV1<SentenceItemV1>;

const SENTENCE_ITEM_ID = "item-001";

export interface SentenceBuilderCapacityV1 {
  /** Exact unique word-bank entries this selection promises the parent. */
  readonly bankWidth: number;
  /** Topics this request may draw from, already reduced to reviewed IDs. */
  readonly topicIds: readonly TopicId[];
  /** Fewest eligible prompt/model/frame records across those topics. */
  readonly promptCapacity: number;
  /**
   * Fewest candidates in the deduplicated pool across those topics. This is
   * the size of the very collection the bank is later sliced from, not a
   * separately derived count, so the gate cannot promise a width the selection
   * then fails to honor.
   */
  readonly bankCapacity: number;
}

function invariantFailure(message: string): GenerationFailure {
  return { ok: false, code: GENERATION_INVARIANT_FAILED, message };
}

function constraintConflict(message: string): GenerationFailure {
  return { ok: false, code: GENERATION_CONSTRAINT_CONFLICT, message };
}

/**
 * The reviewed topics this request may use. Exact known interests arrive here
 * already matched by the sole projection boundary; anything unmatched leaves
 * `topicIds` absent, which falls back to the neutral curated pool.
 */
export function eligibleSentenceTopicIds(
  request: GenerationRequestV1,
  vocabulary: SentenceVocabularyV1 = SENTENCE_BUILDER_VOCABULARY,
): readonly TopicId[] {
  const known = new Set(knownVocabularyTopicIds(vocabulary));
  const selected: TopicId[] = [];
  for (const topicId of request.topicIds ?? []) {
    if (known.has(topicId) && !selected.includes(topicId)) {
      selected.push(topicId);
    }
  }
  return selected.length === 0 ? [FALLBACK_TOPIC_ID] : selected;
}

/**
 * Capacity in the units the parent UI promises: eligible prompts, and the
 * deduplicated bank pool. It is measured across every topic the request may
 * land on, so the answer never depends on the seed and a shortage always fails
 * closed.
 *
 * `bankCapacity` counts `distinctBankWordPool(...)` and the generator slices
 * `distinctBankWordPool(...)` - ONE collection, one unit. Measuring distinct
 * words while slicing the raw pool is what turned a duplicate-bearing pool
 * into a per-seed lottery between a valid page and
 * `GENERATION_INVARIANT_FAILED`; with one collection the gate's verdict is the
 * outcome on every seed.
 */
export function measureSentenceBuilderCapacity(
  request: GenerationRequestV1,
  vocabulary: SentenceVocabularyV1 = SENTENCE_BUILDER_VOCABULARY,
): SentenceBuilderCapacityV1 {
  const { presentationBand, writingMode } = request.capabilities;
  const topicIds = eligibleSentenceTopicIds(request, vocabulary);
  const bankWidth = getSentenceBuilderBankSize(
    writingMode,
    request.options.length,
    request.options.printScale,
  );
  let promptCapacity = Number.POSITIVE_INFINITY;
  let bankCapacity = Number.POSITIVE_INFINITY;
  for (const topicId of topicIds) {
    promptCapacity = Math.min(
      promptCapacity,
      eligibleSentencePrompts(vocabulary, {
        presentationBand,
        topicId,
        writingMode,
      }).length,
    );
    bankCapacity = Math.min(
      bankCapacity,
      distinctBankWordPool(vocabulary, topicId, writingMode).length,
    );
  }
  return { bankCapacity, bankWidth, promptCapacity, topicIds };
}

/**
 * Sentence Builder hides difficulty and the answer key for every mode, and
 * hides length for the two no-bank modes. A request that carries a different
 * hidden value never reached the canonical normalization (plan.md:131).
 */
function hiddenControlFailure(
  request: GenerationRequestV1,
): GenerationFailure | undefined {
  const { options } = request;
  const canonicalLength = getSentenceBuilderCanonicalLength(
    request.capabilities.writingMode,
    options.length,
  );
  if (
    options.difficulty !== "practice" ||
    options.includeAnswerKey !== false ||
    options.length !== canonicalLength
  ) {
    return invariantFailure(
      "Sentence Builder received a hidden control value outside its canonical normalization.",
    );
  }
  return undefined;
}

function buildSentenceItem(
  selected: EligibleSentencePromptV1,
  wordBank: readonly string[],
): SentenceItemV1 {
  const base = {
    id: SENTENCE_ITEM_ID,
    itemType: "sentence",
    answerability: "open",
    answer: null,
    prompt: selected.prompt,
    topicId: selected.topicId,
  } as const;

  switch (selected.writingMode) {
    case "draw-and-tell":
      return {
        ...base,
        requiredResponse: SENTENCE_BUILDER_REQUIRED_RESPONSES["draw-and-tell"],
        writingMode: "draw-and-tell",
      };
    case "label":
      return {
        ...base,
        requiredResponse: SENTENCE_BUILDER_REQUIRED_RESPONSES.label,
        wordBank,
        writingMode: "label",
      };
    case "copy-with-model":
      return {
        ...base,
        modelSentence: selected.modelSentence,
        requiredResponse:
          SENTENCE_BUILDER_REQUIRED_RESPONSES["copy-with-model"],
        writingMode: "copy-with-model",
      };
    case "sentence-frame":
      return {
        ...base,
        requiredResponse: SENTENCE_BUILDER_REQUIRED_RESPONSES["sentence-frame"],
        sentenceFrame: selected.sentenceFrame,
        wordBank,
        writingMode: "sentence-frame",
      };
    case "independent":
      return {
        ...base,
        requiredResponse: SENTENCE_BUILDER_REQUIRED_RESPONSES.independent,
        wordBank,
        writingMode: "independent",
      };
  }
}

function sameRequiredResponse(
  item: SentenceItemV1,
): boolean {
  const expected = SENTENCE_BUILDER_REQUIRED_RESPONSES[item.writingMode];
  const actual = item.requiredResponse;
  return (
    expected.drawing === actual.drawing &&
    expected.dictation === actual.dictation &&
    expected.labels === actual.labels &&
    expected.copying === actual.copying &&
    expected.writing === actual.writing
  );
}

/**
 * Post-construction proof that the single open item matches the request, the
 * reviewed vocabulary, and the exact promised bank width with no duplicates.
 */
export function validateSentenceBuilderDocument(
  document: SentenceBuilderDocumentV1,
  vocabulary: SentenceVocabularyV1 = SENTENCE_BUILDER_VOCABULARY,
): GenerationFailure | undefined {
  const sharedFailure = validateWorksheetInvariants(document);
  if (sharedFailure !== undefined) {
    return sharedFailure;
  }
  const hidden = hiddenControlFailure(document.request);
  if (hidden !== undefined) {
    return hidden;
  }
  if (
    document.items.length !== SENTENCE_BUILDER_ITEM_COUNT ||
    document.items.some((item) => item.itemType !== "sentence")
  ) {
    return invariantFailure(
      "A Sentence Builder page must contain exactly one open sentence item.",
    );
  }
  const item = document.items[0];
  if (item === undefined) {
    return invariantFailure("The Sentence Builder page had no item to check.");
  }
  const { presentationBand, writingMode } = document.request.capabilities;
  if (
    item.writingMode !== writingMode ||
    item.answerability !== "open" ||
    item.answer !== null ||
    !sameRequiredResponse(item)
  ) {
    return invariantFailure(
      "The Sentence Builder item did not match its requested writing mode, open answerability, or required response.",
    );
  }
  if (!eligibleSentenceTopicIds(document.request, vocabulary).includes(item.topicId)) {
    return invariantFailure(
      "The Sentence Builder item used a topic this request may not draw from.",
    );
  }

  const eligible = eligibleSentencePrompts(vocabulary, {
    presentationBand,
    topicId: item.topicId,
    writingMode,
  });
  const source = eligible.find(
    (candidate) =>
      candidate.prompt === item.prompt &&
      (candidate.writingMode !== "copy-with-model" ||
        candidate.modelSentence === item.modelSentence) &&
      (candidate.writingMode !== "sentence-frame" ||
        candidate.sentenceFrame === item.sentenceFrame),
  );
  if (source === undefined) {
    return invariantFailure(
      "The Sentence Builder item used text outside the reviewed local vocabulary.",
    );
  }
  if (
    (writingMode === "copy-with-model") !== (item.modelSentence !== undefined) ||
    (writingMode === "sentence-frame") !== (item.sentenceFrame !== undefined)
  ) {
    return invariantFailure(
      "The Sentence Builder item carried a model sentence or frame its mode does not define.",
    );
  }

  const bankWidth = getSentenceBuilderBankSize(
    writingMode,
    document.request.options.length,
    document.request.options.printScale,
  );
  const wordBank = item.wordBank;
  if (bankWidth === 0) {
    return wordBank === undefined
      ? undefined
      : invariantFailure(
          "A no-bank Sentence Builder mode must not print a word bank.",
        );
  }
  const pool = new Set(
    distinctBankWordPool(vocabulary, item.topicId, writingMode),
  );
  if (
    wordBank === undefined ||
    wordBank.length !== bankWidth ||
    new Set(wordBank).size !== bankWidth ||
    wordBank.some((word) => !pool.has(word))
  ) {
    return invariantFailure(
      `The Sentence Builder word bank did not hold exactly ${bankWidth} unique reviewed words.`,
    );
  }
  return undefined;
}

export function generateSentenceBuilder(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
  vocabulary: SentenceVocabularyV1 = SENTENCE_BUILDER_VOCABULARY,
): GenerationResult<SentenceBuilderDocumentV1> {
  if (
    request.worksheetType !== SENTENCE_BUILDER_DEFINITION.id ||
    request.generatorVersion !== SENTENCE_BUILDER_DEFINITION.generatorVersion
  ) {
    return invariantFailure(
      "The request does not match the registered Sentence Builder generator.",
    );
  }
  const hidden = hiddenControlFailure(request);
  if (hidden !== undefined) {
    return hidden;
  }

  const { writingMode } = request.capabilities;
  const capacity = measureSentenceBuilderCapacity(request, vocabulary);
  if (capacity.promptCapacity < 1) {
    return constraintConflict(
      `No reviewed ${SENTENCE_BUILDER_MODE_LABELS[writingMode]} prompt is available for this profile's presentation band and interests. Review the profile's writing mode or interests.`,
    );
  }
  if (capacity.bankCapacity < capacity.bankWidth) {
    return constraintConflict(
      `This length needs ${capacity.bankWidth} unique reviewed word-bank words, but only ${capacity.bankCapacity} are available. Choose a shorter worksheet or review the profile's interests.`,
    );
  }

  const random = createSeededRandom(request.seed);
  const topicId = capacity.topicIds[random.nextBounded(capacity.topicIds.length)];
  if (topicId === undefined) {
    return invariantFailure("A Sentence Builder topic could not be selected.");
  }
  const eligible = eligibleSentencePrompts(vocabulary, {
    presentationBand: request.capabilities.presentationBand,
    topicId,
    writingMode,
  });
  const selected = eligible[random.nextBounded(eligible.length)];
  if (selected === undefined) {
    return invariantFailure("A Sentence Builder prompt could not be selected.");
  }
  const wordBank =
    capacity.bankWidth === 0
      ? []
      : seededShuffle(
          distinctBankWordPool(vocabulary, topicId, writingMode),
          random,
        ).slice(0, capacity.bankWidth);

  const document: SentenceBuilderDocumentV1 = {
    schemaVersion: 1,
    worksheetType: SENTENCE_BUILDER_DEFINITION.id,
    generatorVersion: SENTENCE_BUILDER_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items: [buildSentenceItem(selected, wordBank)],
  };
  const failure = validateSentenceBuilderDocument(document, vocabulary);
  return failure === undefined ? { ok: true, document } : failure;
}
