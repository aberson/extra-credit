import type {
  PresentationBand,
  WritingMode,
} from "../../shared/config/schema.js";
import type { TopicId } from "../../shared/worksheet/types.js";

/**
 * Curated, reviewed, project-local Sentence Builder content.
 *
 * Every prompt, model sentence, sentence frame, and word-bank entry in this
 * file is authored and reviewed in-repository. Nothing here is fetched,
 * templated from parent input, or produced at runtime: unknown interest tags
 * never reach this module, they only fail to match a reviewed topic ID and
 * fall back to {@link FALLBACK_TOPIC_ID}.
 */

/** Topic used whenever no reviewed interest matched. */
export const FALLBACK_TOPIC_ID = "neutral" as const satisfies TopicId;

/**
 * The writing modes that print a word bank. One source of truth: the bank
 * budgets, the applicable-length control, the capacity gate, and the per-topic
 * pool record are all keyed by this list.
 */
export const BANK_WRITING_MODES = [
  "label",
  "sentence-frame",
  "independent",
] as const;

export type BankWritingMode = (typeof BANK_WRITING_MODES)[number];

export function isBankWritingMode(mode: WritingMode): mode is BankWritingMode {
  return (BANK_WRITING_MODES as readonly WritingMode[]).includes(mode);
}

export interface SentencePromptRecordV1 {
  /** Stable lowercase kebab-case identifier, unique across the vocabulary. */
  readonly id: string;
  readonly topicId: TopicId;
  readonly writingMode: WritingMode;
  /** Presentation bands this reviewed record is written for. */
  readonly bands: readonly PresentationBand[];
  readonly prompt: string;
  /** Present only on reviewed `copy-with-model` records. */
  readonly modelSentence?: string;
  /** Present only on reviewed `sentence-frame` records. */
  readonly sentenceFrame?: string;
}

export interface TopicWordPoolsV1 {
  readonly topicId: TopicId;
  /** Curated bank pool per bank-bearing writing mode. */
  readonly bankWords: Readonly<Record<BankWritingMode, readonly string[]>>;
}

export interface SentenceVocabularyV1 {
  readonly prompts: readonly SentencePromptRecordV1[];
  readonly wordPools: readonly TopicWordPoolsV1[];
}

/**
 * One eligible, fully resolved prompt. The union is keyed by writing mode so a
 * consumer that has selected a record cannot reach a "model sentence missing"
 * branch: eligibility and resolution happen together, once, here.
 */
export type EligibleSentencePromptV1 =
  | {
      readonly writingMode: "draw-and-tell" | "label" | "independent";
      readonly id: string;
      readonly topicId: TopicId;
      readonly prompt: string;
    }
  | {
      readonly writingMode: "copy-with-model";
      readonly id: string;
      readonly topicId: TopicId;
      readonly prompt: string;
      readonly modelSentence: string;
    }
  | {
      readonly writingMode: "sentence-frame";
      readonly id: string;
      readonly topicId: TopicId;
      readonly prompt: string;
      readonly sentenceFrame: string;
    };

export interface SentencePromptCriteriaV1 {
  readonly presentationBand: PresentationBand;
  readonly topicId: TopicId;
  readonly writingMode: WritingMode;
}

const BOTH_BANDS = ["preschool", "early-primary"] as const;
const EARLY_PRIMARY_ONLY = ["early-primary"] as const;

function plain(
  topicId: TopicId,
  writingMode: "draw-and-tell" | "label" | "independent",
  suffix: string,
  bands: readonly PresentationBand[],
  prompt: string,
): SentencePromptRecordV1 {
  return { bands, id: `${topicId}-${writingMode}-${suffix}`, prompt, topicId, writingMode };
}

function model(
  topicId: TopicId,
  suffix: string,
  bands: readonly PresentationBand[],
  prompt: string,
  modelSentence: string,
): SentencePromptRecordV1 {
  return {
    bands,
    id: `${topicId}-copy-with-model-${suffix}`,
    modelSentence,
    prompt,
    topicId,
    writingMode: "copy-with-model",
  };
}

function frame(
  topicId: TopicId,
  suffix: string,
  bands: readonly PresentationBand[],
  prompt: string,
  sentenceFrame: string,
): SentencePromptRecordV1 {
  return {
    bands,
    id: `${topicId}-sentence-frame-${suffix}`,
    prompt,
    sentenceFrame,
    topicId,
    writingMode: "sentence-frame",
  };
}

const ANIMALS_PICTURE_WORDS = [
  "cat",
  "dog",
  "bird",
  "fish",
  "tail",
  "wing",
  "nest",
  "paw",
  "fur",
  "beak",
] as const;

const ANIMALS_IDEA_WORDS = [
  "run",
  "jump",
  "sleep",
  "eat",
  "hide",
  "swim",
  "climb",
  "sing",
  "soft",
  "fast",
  "friend",
  "home",
] as const;

const SPACE_PICTURE_WORDS = [
  "star",
  "moon",
  "sun",
  "rocket",
  "planet",
  "comet",
  "orbit",
  "crater",
  "helmet",
  "launch",
] as const;

const SPACE_IDEA_WORDS = [
  "fly",
  "land",
  "float",
  "glow",
  "explore",
  "count",
  "night",
  "bright",
  "far",
  "quiet",
  "dream",
  "ship",
] as const;

const NATURE_PICTURE_WORDS = [
  "tree",
  "leaf",
  "rock",
  "river",
  "flower",
  "seed",
  "cloud",
  "root",
  "hill",
  "rain",
] as const;

const NATURE_IDEA_WORDS = [
  "grow",
  "dig",
  "walk",
  "listen",
  "collect",
  "splash",
  "green",
  "tall",
  "wet",
  "warm",
  "garden",
  "path",
] as const;

const SPORTS_PICTURE_WORDS = [
  "ball",
  "net",
  "bat",
  "glove",
  "field",
  "goal",
  "shoe",
  "hoop",
  "jersey",
  "whistle",
] as const;

const SPORTS_IDEA_WORDS = [
  "run",
  "kick",
  "throw",
  "catch",
  "cheer",
  "practice",
  "team",
  "fast",
  "strong",
  "fun",
  "win",
  "play",
] as const;

const VEHICLES_PICTURE_WORDS = [
  "car",
  "bus",
  "truck",
  "train",
  "wheel",
  "boat",
  "plane",
  "road",
  "horn",
  "seat",
] as const;

const VEHICLES_IDEA_WORDS = [
  "drive",
  "ride",
  "stop",
  "go",
  "honk",
  "travel",
  "loud",
  "fast",
  "safe",
  "busy",
  "trip",
  "park",
] as const;

const NEUTRAL_PICTURE_WORDS = [
  "sun",
  "house",
  "tree",
  "box",
  "cup",
  "ball",
  "door",
  "hat",
  "book",
  "chair",
] as const;

const NEUTRAL_IDEA_WORDS = [
  "happy",
  "big",
  "small",
  "play",
  "help",
  "make",
  "look",
  "find",
  "walk",
  "smile",
  "today",
  "friend",
] as const;

/**
 * `label` and `sentence-frame` deliberately share one picture-word array per
 * topic by reference, so the two banks can never drift apart.
 */
function topicPools(
  topicId: TopicId,
  pictureWords: readonly string[],
  ideaWords: readonly string[],
): TopicWordPoolsV1 {
  return {
    bankWords: {
      independent: ideaWords,
      label: pictureWords,
      "sentence-frame": pictureWords,
    },
    topicId,
  };
}

const WORD_POOLS: readonly TopicWordPoolsV1[] = [
  topicPools("animals", ANIMALS_PICTURE_WORDS, ANIMALS_IDEA_WORDS),
  topicPools("space", SPACE_PICTURE_WORDS, SPACE_IDEA_WORDS),
  topicPools("nature", NATURE_PICTURE_WORDS, NATURE_IDEA_WORDS),
  topicPools("sports", SPORTS_PICTURE_WORDS, SPORTS_IDEA_WORDS),
  topicPools("vehicles", VEHICLES_PICTURE_WORDS, VEHICLES_IDEA_WORDS),
  topicPools(FALLBACK_TOPIC_ID, NEUTRAL_PICTURE_WORDS, NEUTRAL_IDEA_WORDS),
];

const PROMPT_RECORDS: readonly SentencePromptRecordV1[] = [
  // animals
  plain("animals", "draw-and-tell", "a", BOTH_BANDS, "Draw an animal you like. Tell a grown-up what your animal is doing."),
  plain("animals", "draw-and-tell", "b", EARLY_PRIMARY_ONLY, "Draw an animal at home in its nest or den. Tell a grown-up how it stays safe."),
  plain("animals", "label", "a", BOTH_BANDS, "Draw one animal. Write a word on the lines for each part you can name."),
  plain("animals", "label", "b", EARLY_PRIMARY_ONLY, "Draw an animal and the place it lives. On the lines, write labels for the animal and what is around it."),
  plain("animals", "independent", "a", BOTH_BANDS, "Draw an animal. Then write about your animal. Use the idea words or your own."),
  plain("animals", "independent", "b", EARLY_PRIMARY_ONLY, "Draw an animal doing something. Then write two sentences about what happens next."),
  model("animals", "a", BOTH_BANDS, "Copy this animal sentence on the lines.", "The cat has soft fur."),
  model("animals", "b", EARLY_PRIMARY_ONLY, "Copy this animal sentence carefully on the lines.", "A small bird built a nest in the tall tree."),
  frame("animals", "a", BOTH_BANDS, "Finish the sentence about an animal. A word bank word can help.", "My animal is a ______."),
  frame("animals", "b", EARLY_PRIMARY_ONLY, "Finish the sentence about an animal and what it does.", "The ______ likes to ______."),
  plain("animals", "draw-and-tell", "c", BOTH_BANDS, "Draw two animals that could be friends. Tell a grown-up what they do together."),
  model("animals", "c", BOTH_BANDS, "Copy this sentence about a pet on the lines.", "A dog can run fast."),

  // space
  plain("space", "draw-and-tell", "a", BOTH_BANDS, "Draw something you would see in space. Tell a grown-up about your picture."),
  plain("space", "draw-and-tell", "b", EARLY_PRIMARY_ONLY, "Draw a trip to the moon. Tell a grown-up what you would pack and why."),
  plain("space", "label", "a", BOTH_BANDS, "Draw a space picture. Write a word on the lines for each thing you can name."),
  plain("space", "label", "b", EARLY_PRIMARY_ONLY, "Draw a rocket on its launch day. On the lines, write labels for the rocket and what you see."),
  plain("space", "independent", "a", BOTH_BANDS, "Draw a space picture. Then write about it. Use the idea words or your own."),
  plain("space", "independent", "b", EARLY_PRIMARY_ONLY, "Draw where your spaceship lands. Then write two sentences about what you find."),
  model("space", "a", BOTH_BANDS, "Copy this space sentence on the lines.", "The moon is bright."),
  model("space", "b", EARLY_PRIMARY_ONLY, "Copy this space sentence carefully on the lines.", "A rocket left the ground and flew past the clouds."),
  frame("space", "a", BOTH_BANDS, "Finish the sentence about space. A word bank word can help.", "In space I see a ______."),
  frame("space", "b", EARLY_PRIMARY_ONLY, "Finish the sentence about a space trip.", "The ______ can ______."),
  plain("space", "draw-and-tell", "c", BOTH_BANDS, "Draw the night sky. Tell a grown-up what you can see up there."),
  model("space", "c", BOTH_BANDS, "Copy this sentence about the sky on the lines.", "I see one star."),

  // nature
  plain("nature", "draw-and-tell", "a", BOTH_BANDS, "Draw something you like outside. Tell a grown-up about your picture."),
  plain("nature", "draw-and-tell", "b", EARLY_PRIMARY_ONLY, "Draw a walk on a rainy day. Tell a grown-up what you would hear."),
  plain("nature", "label", "a", BOTH_BANDS, "Draw an outdoor picture. Write a word on the lines for each thing you can name."),
  plain("nature", "label", "b", EARLY_PRIMARY_ONLY, "Draw a tree in one season. On the lines, write labels for the tree and what is near it."),
  plain("nature", "independent", "a", BOTH_BANDS, "Draw an outdoor picture. Then write about it. Use the idea words or your own."),
  plain("nature", "independent", "b", EARLY_PRIMARY_ONLY, "Draw a place outside you would like to visit. Then write two sentences about it."),
  model("nature", "a", BOTH_BANDS, "Copy this nature sentence on the lines.", "The tree is tall."),
  model("nature", "b", EARLY_PRIMARY_ONLY, "Copy this nature sentence carefully on the lines.", "Warm rain helped the small seed grow into a plant."),
  frame("nature", "a", BOTH_BANDS, "Finish the sentence about outside. A word bank word can help.", "Outside I see a ______."),
  frame("nature", "b", EARLY_PRIMARY_ONLY, "Finish the sentence about something growing.", "The ______ needs ______."),
  plain("nature", "draw-and-tell", "c", BOTH_BANDS, "Draw a plant you have seen. Tell a grown-up where it was growing."),
  model("nature", "c", BOTH_BANDS, "Copy this sentence about a plant on the lines.", "The seed is small."),

  // sports
  plain("sports", "draw-and-tell", "a", BOTH_BANDS, "Draw a game you like to play. Tell a grown-up how it works."),
  plain("sports", "draw-and-tell", "b", EARLY_PRIMARY_ONLY, "Draw your team before a big game. Tell a grown-up how everyone helps."),
  plain("sports", "label", "a", BOTH_BANDS, "Draw a game picture. Write a word on the lines for each thing you can name."),
  plain("sports", "label", "b", EARLY_PRIMARY_ONLY, "Draw a game with the field and the gear. On the lines, write labels for the things you would need."),
  plain("sports", "independent", "a", BOTH_BANDS, "Draw a game you like. Then write about it. Use the idea words or your own."),
  plain("sports", "independent", "b", EARLY_PRIMARY_ONLY, "Draw the best part of a game. Then write two sentences about what happened."),
  model("sports", "a", BOTH_BANDS, "Copy this game sentence on the lines.", "I can kick the ball."),
  model("sports", "b", EARLY_PRIMARY_ONLY, "Copy this game sentence carefully on the lines.", "Our team practiced together before the long game."),
  frame("sports", "a", BOTH_BANDS, "Finish the sentence about a game. A word bank word can help.", "I like to play with a ______."),
  frame("sports", "b", EARLY_PRIMARY_ONLY, "Finish the sentence about your team.", "My team can ______ with a ______."),
  plain("sports", "draw-and-tell", "c", BOTH_BANDS, "Draw yourself playing outside. Tell a grown-up what you are doing."),
  model("sports", "c", BOTH_BANDS, "Copy this sentence about playing on the lines.", "We play with a ball."),

  // vehicles
  plain("vehicles", "draw-and-tell", "a", BOTH_BANDS, "Draw a way to go somewhere. Tell a grown-up where you would go."),
  plain("vehicles", "draw-and-tell", "b", EARLY_PRIMARY_ONLY, "Draw a busy road. Tell a grown-up how everyone stays safe."),
  plain("vehicles", "label", "a", BOTH_BANDS, "Draw a vehicle. Write a word on the lines for each part you can name."),
  plain("vehicles", "label", "b", EARLY_PRIMARY_ONLY, "Draw a vehicle on a trip. On the lines, write labels for the vehicle and what you pass."),
  plain("vehicles", "independent", "a", BOTH_BANDS, "Draw a vehicle. Then write about it. Use the idea words or your own."),
  plain("vehicles", "independent", "b", EARLY_PRIMARY_ONLY, "Draw a trip you would like to take. Then write two sentences about it."),
  model("vehicles", "a", BOTH_BANDS, "Copy this vehicle sentence on the lines.", "The bus is big."),
  model("vehicles", "b", EARLY_PRIMARY_ONLY, "Copy this vehicle sentence carefully on the lines.", "The train stopped at the station and let people off."),
  frame("vehicles", "a", BOTH_BANDS, "Finish the sentence about going somewhere. A word bank word can help.", "I would ride in a ______."),
  frame("vehicles", "b", EARLY_PRIMARY_ONLY, "Finish the sentence about a trip.", "The ______ can ______."),
  plain("vehicles", "draw-and-tell", "c", BOTH_BANDS, "Draw a truck or a boat. Tell a grown-up what it is carrying."),
  model("vehicles", "c", BOTH_BANDS, "Copy this sentence about a ride on the lines.", "The car can stop."),

  // neutral fallback
  plain(FALLBACK_TOPIC_ID, "draw-and-tell", "a", BOTH_BANDS, "Draw something you like. Tell a grown-up about your picture."),
  plain(FALLBACK_TOPIC_ID, "draw-and-tell", "b", EARLY_PRIMARY_ONLY, "Draw a part of your day. Tell a grown-up what happened first and next."),
  plain(FALLBACK_TOPIC_ID, "label", "a", BOTH_BANDS, "Draw a picture. Write a word on the lines for each thing you can name."),
  plain(FALLBACK_TOPIC_ID, "label", "b", EARLY_PRIMARY_ONLY, "Draw a place you know well. On the lines, write labels for the things you can see."),
  plain(FALLBACK_TOPIC_ID, "independent", "a", BOTH_BANDS, "Draw a picture. Then write about it. Use the idea words or your own."),
  plain(FALLBACK_TOPIC_ID, "independent", "b", EARLY_PRIMARY_ONLY, "Draw something you did today. Then write two sentences about it."),
  model(FALLBACK_TOPIC_ID, "a", BOTH_BANDS, "Copy this sentence on the lines.", "The sun is warm."),
  model(FALLBACK_TOPIC_ID, "b", EARLY_PRIMARY_ONLY, "Copy this sentence carefully on the lines.", "We opened the door and walked into the bright room."),
  frame(FALLBACK_TOPIC_ID, "a", BOTH_BANDS, "Finish the sentence about your picture. A word bank word can help.", "I see a ______."),
  frame(FALLBACK_TOPIC_ID, "b", EARLY_PRIMARY_ONLY, "Finish the sentence about something you like.", "I like the ______ because ______."),
  plain(FALLBACK_TOPIC_ID, "draw-and-tell", "c", BOTH_BANDS, "Draw a place you like to be. Tell a grown-up why you like it."),
  model(FALLBACK_TOPIC_ID, "c", BOTH_BANDS, "Copy this short sentence on the lines.", "My hat is red."),
];

export const SENTENCE_BUILDER_VOCABULARY: SentenceVocabularyV1 = Object.freeze({
  prompts: Object.freeze(PROMPT_RECORDS),
  wordPools: Object.freeze(WORD_POOLS),
});

export function findTopicWordPools(
  vocabulary: SentenceVocabularyV1,
  topicId: TopicId,
): TopicWordPoolsV1 | undefined {
  return vocabulary.wordPools.find((pools) => pools.topicId === topicId);
}

export function knownVocabularyTopicIds(
  vocabulary: SentenceVocabularyV1,
): readonly TopicId[] {
  return vocabulary.wordPools.map(({ topicId }) => topicId);
}

/** Curated bank pool for one topic and mode; empty for the no-bank modes. */
export function bankWordPool(
  vocabulary: SentenceVocabularyV1,
  topicId: TopicId,
  writingMode: WritingMode,
): readonly string[] {
  if (!isBankWritingMode(writingMode)) {
    return [];
  }
  return findTopicWordPools(vocabulary, topicId)?.bankWords[writingMode] ?? [];
}

/**
 * THE bank collection, in one unit: the curated pool with repeats removed and
 * original order preserved.
 *
 * The capacity gate counts this collection and the generator shuffles and
 * slices THIS SAME collection, so "the gate promised N unique words" and "the
 * page drew from N candidates" cannot be two different numbers. Counting
 * capacity in distinct words while slicing a raw duplicate-bearing pool is the
 * defect this function exists to make unrepresentable (see
 * `.claude/rules/code-quality.md`, one source of truth for data-shape
 * constants: this was the second instance of a capacity unit and a selection
 * unit drifting apart in this project).
 */
export function distinctBankWordPool(
  vocabulary: SentenceVocabularyV1,
  topicId: TopicId,
  writingMode: WritingMode,
): readonly string[] {
  return [...new Set(bankWordPool(vocabulary, topicId, writingMode))];
}

/**
 * Every reviewed record that is eligible AND complete for the requested mode.
 * A `copy-with-model` record without a model sentence, or a `sentence-frame`
 * record without a frame, is a shortage: it is filtered out here so the
 * capacity gate sees it before any document is constructed.
 */
export function eligibleSentencePrompts(
  vocabulary: SentenceVocabularyV1,
  criteria: SentencePromptCriteriaV1,
): readonly EligibleSentencePromptV1[] {
  const eligible: EligibleSentencePromptV1[] = [];
  for (const record of vocabulary.prompts) {
    if (
      record.topicId !== criteria.topicId ||
      record.writingMode !== criteria.writingMode ||
      !record.bands.includes(criteria.presentationBand) ||
      record.prompt.trim().length === 0
    ) {
      continue;
    }
    const base = { id: record.id, prompt: record.prompt, topicId: record.topicId };
    switch (record.writingMode) {
      case "copy-with-model": {
        const modelSentence = record.modelSentence;
        if (modelSentence !== undefined && modelSentence.trim().length > 0) {
          eligible.push({ ...base, modelSentence, writingMode: "copy-with-model" });
        }
        break;
      }
      case "sentence-frame": {
        const sentenceFrame = record.sentenceFrame;
        if (sentenceFrame !== undefined && sentenceFrame.trim().length > 0) {
          eligible.push({ ...base, sentenceFrame, writingMode: "sentence-frame" });
        }
        break;
      }
      default:
        eligible.push({ ...base, writingMode: record.writingMode });
        break;
    }
  }
  return eligible;
}
