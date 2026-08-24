import { describe, expect, test } from "vitest";

import {
  PRESENTATION_BANDS,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
  type ChildProfileV1,
  type GenerationDefaultsV1,
  type PresentationBand,
  type WritingMode,
} from "../../shared/config/schema.js";
import {
  canonicalContentKey,
  containsPersonalizationValue,
  objectiveAnswerEntries,
} from "../../shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../shared/worksheet/project-request.js";
import type {
  GenerationRequestV1,
  SentenceItemV1,
} from "../../shared/worksheet/types.js";
import {
  SENTENCE_BUILDER_BANK_BUDGETS,
  SENTENCE_BUILDER_DEFINITION,
  SENTENCE_BUILDER_REQUIRED_RESPONSES,
  getSentenceBuilderBankSize,
  getSentenceBuilderCanonicalLength,
  getSentenceBuilderCapabilitySupport,
  getSentenceBuilderEffectiveLength,
} from "./definition.js";
import {
  eligibleSentenceTopicIds,
  generateSentenceBuilder,
  measureSentenceBuilderCapacity,
  validateSentenceBuilderDocument,
  type SentenceBuilderDocumentV1,
} from "./generator.js";
import {
  BANK_WRITING_MODES,
  FALLBACK_TOPIC_ID,
  SENTENCE_BUILDER_VOCABULARY,
  bankWordPool,
  distinctBankWordPool,
  eligibleSentencePrompts,
  findTopicWordPools,
  isBankWritingMode,
  type BankWritingMode,
  type SentencePromptRecordV1,
  type SentenceVocabularyV1,
  type TopicWordPoolsV1,
} from "./vocabulary.js";

const WORKSHEET_ID = "11111111-1111-4111-8111-111111111111";

const defaults: GenerationDefaultsV1 = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

function profileFor(
  writingMode: WritingMode,
  presentationBand: PresentationBand = "early-primary",
  interests: readonly string[] = ["Distinctive Private Nonsense"],
): ChildProfileV1 {
  return {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Private Morgan",
    ageYears: presentationBand === "preschool" ? 4 : 6,
    presentationBand,
    reviewedOn: "2026-08-22",
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
    writingMode,
    interests: [...interests],
  };
}

function requestFor(
  profile: ChildProfileV1,
  preferences: Partial<GenerationDefaultsV1> = {},
  seed = "00000001",
): GenerationRequestV1 {
  const merged = { ...defaults, ...preferences };
  const projection = projectGenerationRequest({
    profile,
    preferences: merged,
    worksheetType: SENTENCE_BUILDER_DEFINITION.id,
    generatorVersion: SENTENCE_BUILDER_DEFINITION.generatorVersion,
    seed,
  });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  return projection.request;
}

function generated(
  request: GenerationRequestV1,
  vocabulary: SentenceVocabularyV1 = SENTENCE_BUILDER_VOCABULARY,
): SentenceBuilderDocumentV1 {
  const result = generateSentenceBuilder(
    request,
    { worksheetId: WORKSHEET_ID },
    vocabulary,
  );
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.document;
}

function soleItem(document: SentenceBuilderDocumentV1): SentenceItemV1 {
  const item = document.items[0];
  if (item === undefined) {
    throw new Error("A Sentence Builder document had no item.");
  }
  return item;
}

/** Replace exactly the reviewed records a shortage test wants to break. */
function vocabularyWith(
  prompts: readonly SentencePromptRecordV1[],
  bankWords: Readonly<Record<BankWritingMode, readonly string[]>>,
): SentenceVocabularyV1 {
  return {
    prompts,
    wordPools: [{ bankWords, topicId: FALLBACK_TOPIC_ID }],
  };
}

/** A vocabulary with more than one reviewed topic, for reachability tests. */
function vocabularyWithTopics(
  prompts: readonly SentencePromptRecordV1[],
  wordPools: readonly TopicWordPoolsV1[],
): SentenceVocabularyV1 {
  return { prompts, wordPools };
}

function seedHex(seed: number): string {
  return seed.toString(16).padStart(8, "0");
}

/** The reviewed interest tag that reaches a given topic; unknown for neutral. */
function interestReaching(topicId: string): readonly string[] {
  return topicId === FALLBACK_TOPIC_ID
    ? ["Distinctive Private Nonsense"]
    : [topicId];
}

const ALL_MODES: readonly WritingMode[] = WRITING_MODES;

describe("reviewed Sentence Builder vocabulary", () => {
  test("keeps unique prompt IDs and reviewed-topic word pools", () => {
    const ids = SENTENCE_BUILDER_VOCABULARY.prompts.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SENTENCE_BUILDER_VOCABULARY.wordPools.map(({ topicId }) => topicId)).toEqual([
      "animals",
      "space",
      "nature",
      "sports",
      "vehicles",
      "neutral",
    ]);
  });

  test("shares one picture-word array between label and sentence-frame", () => {
    for (const pools of SENTENCE_BUILDER_VOCABULARY.wordPools) {
      // Identity, not equality: a future copy-paste duplicate must fail here.
      expect(pools.bankWords.label).toBe(pools.bankWords["sentence-frame"]);
      expect(pools.bankWords.independent).not.toBe(pools.bankWords.label);
    }
  });

  test("supplies the widest bank width without duplicates for every topic and bank mode", () => {
    for (const pools of SENTENCE_BUILDER_VOCABULARY.wordPools) {
      for (const mode of BANK_WRITING_MODES) {
        const words = bankWordPool(SENTENCE_BUILDER_VOCABULARY, pools.topicId, mode);
        expect(new Set(words).size).toBe(words.length);
        expect(words.length).toBeGreaterThanOrEqual(
          SENTENCE_BUILDER_BANK_BUDGETS[mode].long,
        );
        expect(words.every((word) => word.trim().length > 0)).toBe(true);
      }
    }
    expect(bankWordPool(SENTENCE_BUILDER_VOCABULARY, "neutral", "draw-and-tell")).toEqual([]);
    expect(bankWordPool(SENTENCE_BUILDER_VOCABULARY, "neutral", "copy-with-model")).toEqual([]);
  });

  test("offers at least one complete prompt for every topic, mode, and band", () => {
    for (const pools of SENTENCE_BUILDER_VOCABULARY.wordPools) {
      for (const writingMode of ALL_MODES) {
        for (const presentationBand of PRESENTATION_BANDS) {
          const eligible = eligibleSentencePrompts(SENTENCE_BUILDER_VOCABULARY, {
            presentationBand,
            topicId: pools.topicId,
            writingMode,
          });
          expect(eligible.length).toBeGreaterThanOrEqual(1);
          for (const candidate of eligible) {
            expect(candidate.writingMode).toBe(writingMode);
            expect(candidate.prompt.trim().length).toBeGreaterThan(0);
            if (candidate.writingMode === "copy-with-model") {
              expect(candidate.modelSentence.trim().length).toBeGreaterThan(0);
            }
            if (candidate.writingMode === "sentence-frame") {
              expect(candidate.sentenceFrame).toContain("______");
            }
          }
        }
      }
    }
  });

  test("never directs writing onto a surface the page does not print", () => {
    // The page offers ruled lines and an aria-hidden drawing box: there is no
    // writable region inside the picture, so no prompt may send the child
    // there. The label header ("write labels on the lines") and every label
    // prompt must name the same surface.
    const WRITE_ONTO_THE_PICTURE =
      /next to|on(?:to)? (?:the|your) (?:picture|drawing)|in (?:the|your) (?:picture|drawing)/iu;
    for (const record of SENTENCE_BUILDER_VOCABULARY.prompts) {
      expect(WRITE_ONTO_THE_PICTURE.test(record.prompt), record.id).toBe(false);
    }
    for (const record of SENTENCE_BUILDER_VOCABULARY.prompts) {
      if (record.writingMode === "label" || record.writingMode === "copy-with-model") {
        expect(/\bon the lines\b/iu.test(record.prompt), record.id).toBe(true);
      }
    }
  });

  test("offers a second reachable prompt for every no-bank mode, topic, and band", () => {
    // A no-bank document has no seed-varying field other than its prompt
    // record, so one eligible record means one possible worksheet forever and
    // a permanently dead "Make another" (plan.md:240).
    for (const pools of SENTENCE_BUILDER_VOCABULARY.wordPools) {
      for (const writingMode of ["draw-and-tell", "copy-with-model"] as const) {
        for (const presentationBand of PRESENTATION_BANDS) {
          const eligible = eligibleSentencePrompts(SENTENCE_BUILDER_VOCABULARY, {
            presentationBand,
            topicId: pools.topicId,
            writingMode,
          });
          const label = `${pools.topicId}/${writingMode}/${presentationBand}`;
          expect(eligible.length, label).toBeGreaterThanOrEqual(2);
          expect(new Set(eligible.map(({ prompt }) => prompt)).size, label).toBe(
            eligible.length,
          );
        }
      }
    }
  });

  test("makes the presentation band load-bearing without starving preschool", () => {
    const preschool = eligibleSentencePrompts(SENTENCE_BUILDER_VOCABULARY, {
      presentationBand: "preschool",
      topicId: FALLBACK_TOPIC_ID,
      writingMode: "independent",
    });
    const earlyPrimary = eligibleSentencePrompts(SENTENCE_BUILDER_VOCABULARY, {
      presentationBand: "early-primary",
      topicId: FALLBACK_TOPIC_ID,
      writingMode: "independent",
    });
    expect(preschool.length).toBeGreaterThanOrEqual(1);
    expect(earlyPrimary.length).toBeGreaterThan(preschool.length);
    const preschoolIds = new Set(preschool.map(({ id }) => id));
    expect(
      earlyPrimary.some((candidate) => !preschoolIds.has(candidate.id)),
    ).toBe(true);
  });
});

describe("Sentence Builder length budget", () => {
  test("matches the plan's exact per-mode bank widths", () => {
    const expected: Record<string, readonly [number, number, number]> = {
      label: [4, 6, 8],
      "sentence-frame": [4, 6, 8],
      independent: [6, 8, 10],
    };
    for (const mode of BANK_WRITING_MODES) {
      expect(
        WORKSHEET_LENGTHS.map((length) =>
          getSentenceBuilderBankSize(mode, length, "standard"),
        ),
      ).toEqual(expected[mode]);
    }
    for (const mode of ["draw-and-tell", "copy-with-model"] as const) {
      for (const length of WORKSHEET_LENGTHS) {
        expect(getSentenceBuilderBankSize(mode, length, "standard")).toBe(0);
        expect(getSentenceBuilderCanonicalLength(mode, length)).toBe("standard");
      }
    }
  });

  test("large print steps a bank mode down one budget and leaves no-bank canonical length alone", () => {
    expect(getSentenceBuilderEffectiveLength("label", "long", "large")).toBe("standard");
    expect(getSentenceBuilderEffectiveLength("label", "standard", "large")).toBe("short");
    expect(getSentenceBuilderEffectiveLength("label", "short", "large")).toBe("short");
    expect(getSentenceBuilderBankSize("independent", "long", "large")).toBe(8);
    expect(getSentenceBuilderBankSize("independent", "short", "large")).toBe(6);
    for (const mode of ["draw-and-tell", "copy-with-model"] as const) {
      expect(getSentenceBuilderEffectiveLength(mode, "long", "large")).toBe("standard");
    }
  });

  test("classifies exactly the three bank-bearing modes", () => {
    expect(ALL_MODES.filter(isBankWritingMode)).toEqual([
      "label",
      "sentence-frame",
      "independent",
    ]);
  });
});

describe("hidden control normalization", () => {
  test("every projected request is practice, key-free, and canonical in length", () => {
    for (const writingMode of ALL_MODES) {
      for (const length of WORKSHEET_LENGTHS) {
        const request = requestFor(profileFor(writingMode), {
          difficulty: "stretch",
          includeAnswerKey: true,
          length,
        });
        expect(request.options.difficulty).toBe("practice");
        expect(request.options.includeAnswerKey).toBe(false);
        expect(request.options.length).toBe(
          getSentenceBuilderCanonicalLength(writingMode, length),
        );
      }
    }
  });

  test("rejects a hand-built request that skipped the canonical normalization", () => {
    const canonical = requestFor(profileFor("draw-and-tell"));
    const drifted: readonly GenerationRequestV1[] = [
      { ...canonical, options: { ...canonical.options, difficulty: "stretch" } },
      { ...canonical, options: { ...canonical.options, includeAnswerKey: true } },
      { ...canonical, options: { ...canonical.options, length: "long" } },
    ];
    for (const request of drifted) {
      const result = generateSentenceBuilder(request, { worksheetId: WORKSHEET_ID });
      expect(result).toMatchObject({
        code: "GENERATION_INVARIANT_FAILED",
        ok: false,
      });
      expect("document" in result).toBe(false);
    }
  });

  test("a bank mode keeps the parent's length because it selects bank width", () => {
    const request = requestFor(profileFor("independent"), { length: "long" });
    expect(request.options.length).toBe("long");
    expect(soleItem(generated(request)).wordBank).toHaveLength(10);
  });
});

describe("Sentence Builder generation", () => {
  test("produces exactly one open item with the mode's required response", () => {
    for (const writingMode of ALL_MODES) {
      const document = generated(requestFor(profileFor(writingMode)));
      expect(document.items).toHaveLength(1);
      const item = soleItem(document);
      expect(item.itemType).toBe("sentence");
      expect(item.id).toBe("item-001");
      expect(item.answerability).toBe("open");
      expect(item.answer).toBeNull();
      expect(item.writingMode).toBe(writingMode);
      expect(item.requiredResponse).toEqual(
        SENTENCE_BUILDER_REQUIRED_RESPONSES[writingMode],
      );
      expect(objectiveAnswerEntries(document)).toEqual([]);
    }
  });

  test("gives bank modes their exact unique width and no-bank modes no bank", () => {
    for (const writingMode of ALL_MODES) {
      for (const length of WORKSHEET_LENGTHS) {
        for (const printScale of PRINT_SCALES) {
          const request = requestFor(profileFor(writingMode), { length, printScale });
          const item = soleItem(generated(request));
          const width = getSentenceBuilderBankSize(
            writingMode,
            request.options.length,
            printScale,
          );
          if (width === 0) {
            expect(item.wordBank).toBeUndefined();
            continue;
          }
          const bank = item.wordBank ?? [];
          expect(bank).toHaveLength(width);
          expect(new Set(bank).size).toBe(width);
          const pool = new Set(
            bankWordPool(SENTENCE_BUILDER_VOCABULARY, item.topicId, writingMode),
          );
          expect(bank.every((word) => pool.has(word))).toBe(true);
        }
      }
    }
  });

  test("supplies a model sentence or frame exactly where its mode defines one", () => {
    const copy = soleItem(generated(requestFor(profileFor("copy-with-model"))));
    expect(copy.modelSentence).toBeTypeOf("string");
    expect(copy.sentenceFrame).toBeUndefined();
    expect(copy.wordBank).toBeUndefined();

    const frame = soleItem(generated(requestFor(profileFor("sentence-frame"))));
    expect(frame.sentenceFrame).toContain("______");
    expect(frame.modelSentence).toBeUndefined();
    expect(frame.wordBank).toHaveLength(6);

    for (const writingMode of ["draw-and-tell", "label", "independent"] as const) {
      const item = soleItem(generated(requestFor(profileFor(writingMode))));
      expect(item.modelSentence).toBeUndefined();
      expect(item.sentenceFrame).toBeUndefined();
    }
  });

  test("reproduces identical educational content for the same request, seed, and version", () => {
    for (const writingMode of ALL_MODES) {
      const request = requestFor(profileFor(writingMode), {}, "0a1b2c3d");
      const first = generated(request);
      const second = generateSentenceBuilder(request, {
        worksheetId: "22222222-2222-4222-8222-222222222222",
      });
      if (!second.ok) {
        throw new Error(second.message);
      }
      expect(canonicalContentKey(second.document.items)).toBe(
        canonicalContentKey(first.items),
      );
      expect(second.document.worksheetId).not.toBe(first.worksheetId);
    }
  });

  test("keeps prompts, banks, item count, and required response graphics-independent", () => {
    for (const writingMode of ALL_MODES) {
      const withGraphics = generated(
        requestFor(profileFor(writingMode), { includeDecorativeGraphics: true }),
      );
      const withoutGraphics = generated(
        requestFor(profileFor(writingMode), { includeDecorativeGraphics: false }),
      );
      expect(withGraphics.request.options.includeDecorativeGraphics).toBe(true);
      expect(withoutGraphics.request.options.includeDecorativeGraphics).toBe(false);
      expect(canonicalContentKey(withoutGraphics.items)).toBe(
        canonicalContentKey(withGraphics.items),
      );
    }
  });

  test("rejects a request built for a different family or generator version", () => {
    const request = requestFor(profileFor("label"));
    for (const drifted of [
      { ...request, worksheetType: "dry-math" as const },
      { ...request, generatorVersion: 99 },
    ]) {
      expect(
        generateSentenceBuilder(drifted, { worksheetId: WORKSHEET_ID }),
      ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
    }
  });
});

describe("interest personalization", () => {
  test("an exact known interest selects its reviewed topic and vocabulary", () => {
    const request = requestFor(profileFor("label", "early-primary", ["Space"]));
    expect(request.topicIds).toEqual(["space"]);
    const item = soleItem(generated(request));
    expect(item.topicId).toBe("space");
    const pool = new Set(bankWordPool(SENTENCE_BUILDER_VOCABULARY, "space", "label"));
    expect((item.wordBank ?? []).every((word) => pool.has(word))).toBe(true);
  });

  test("an unknown raw tag never enters the request, the document, or the sheet", () => {
    const rawTag = "Distinctive Private Dinosaurs";
    const request = requestFor(profileFor("independent", "early-primary", [rawTag]));
    expect(request.topicIds).toBeUndefined();
    expect(JSON.stringify(request)).not.toContain(rawTag);
    const document = generated(request);
    expect(soleItem(document).topicId).toBe(FALLBACK_TOPIC_ID);
    expect(containsPersonalizationValue(document, rawTag)).toBe(false);
    expect(eligibleSentenceTopicIds(request)).toEqual([FALLBACK_TOPIC_ID]);
  });

  test("disabled interest personalization falls back to neutral content", () => {
    const request = requestFor(profileFor("label", "early-primary", ["Animals"]), {
      useInterests: false,
    });
    expect(request.topicIds).toBeUndefined();
    expect(soleItem(generated(request)).topicId).toBe(FALLBACK_TOPIC_ID);
  });

  test("multiple reviewed interests all stay inside the request's topic set", () => {
    const request = requestFor(
      profileFor("sentence-frame", "early-primary", ["Nature", "vehicles"]),
    );
    expect(request.topicIds).toEqual(["nature", "vehicles"]);
    const capacity = measureSentenceBuilderCapacity(request);
    expect(capacity.topicIds).toEqual(["nature", "vehicles"]);
    for (let seed = 1; seed <= 24; seed += 1) {
      const seeded = requestFor(
        profileFor("sentence-frame", "early-primary", ["Nature", "vehicles"]),
        {},
        seed.toString(16).padStart(8, "0"),
      );
      expect(["nature", "vehicles"]).toContain(soleItem(generated(seeded)).topicId);
    }
  });
});

describe("fail-closed capacity", () => {
  const neutralWords = {
    independent: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
    label: ["one", "two", "three", "four", "five", "six", "seven", "eight"],
    "sentence-frame": ["one", "two", "three", "four", "five", "six", "seven", "eight"],
  } as const;

  function conflictFor(
    writingMode: WritingMode,
    vocabulary: SentenceVocabularyV1,
    preferences: Partial<GenerationDefaultsV1> = {},
  ) {
    const request = requestFor(profileFor(writingMode), preferences);
    return generateSentenceBuilder(request, { worksheetId: WORKSHEET_ID }, vocabulary);
  }

  test("an injected prompt shortage fails before any output", () => {
    const result = conflictFor(
      "draw-and-tell",
      vocabularyWith([], neutralWords),
    );
    expect(result).toMatchObject({ code: "GENERATION_CONSTRAINT_CONFLICT", ok: false });
    expect("document" in result).toBe(false);
  });

  test("a copy-with-model record without a model sentence is a shortage, not a blank sheet", () => {
    const vocabulary = vocabularyWith(
      [
        {
          bands: ["preschool", "early-primary"],
          id: "neutral-copy-with-model-broken",
          prompt: "Copy this sentence on the lines.",
          topicId: FALLBACK_TOPIC_ID,
          writingMode: "copy-with-model",
        },
      ],
      neutralWords,
    );
    expect(measureSentenceBuilderCapacity(
      requestFor(profileFor("copy-with-model")),
      vocabulary,
    ).promptCapacity).toBe(0);
    const result = conflictFor("copy-with-model", vocabulary);
    expect(result).toMatchObject({ code: "GENERATION_CONSTRAINT_CONFLICT", ok: false });
    expect("document" in result).toBe(false);
  });

  test("a sentence-frame record without a frame is a shortage, not a blank sheet", () => {
    const vocabulary = vocabularyWith(
      [
        {
          bands: ["preschool", "early-primary"],
          id: "neutral-sentence-frame-broken",
          prompt: "Finish the sentence.",
          topicId: FALLBACK_TOPIC_ID,
          writingMode: "sentence-frame",
        },
      ],
      neutralWords,
    );
    const result = conflictFor("sentence-frame", vocabulary);
    expect(result).toMatchObject({ code: "GENERATION_CONSTRAINT_CONFLICT", ok: false });
    expect("document" in result).toBe(false);
  });

  test("a short bank pool fails closed instead of repeating or narrowing the bank", () => {
    const vocabulary = vocabularyWith(
      [
        {
          bands: ["preschool", "early-primary"],
          id: "neutral-independent-short",
          prompt: "Draw a picture. Then write about it.",
          topicId: FALLBACK_TOPIC_ID,
          writingMode: "independent",
        },
      ],
      { ...neutralWords, independent: ["one", "two", "three", "four", "five"] },
    );
    const request = requestFor(profileFor("independent"), { length: "long" });
    const capacity = measureSentenceBuilderCapacity(request, vocabulary);
    expect(capacity).toMatchObject({ bankCapacity: 5, bankWidth: 10, promptCapacity: 1 });
    const result = generateSentenceBuilder(
      request,
      { worksheetId: WORKSHEET_ID },
      vocabulary,
    );
    expect(result).toMatchObject({ code: "GENERATION_CONSTRAINT_CONFLICT", ok: false });
    expect("document" in result).toBe(false);
    expect(result.ok ? "" : result.message).toContain("10 unique reviewed word-bank words");
  });

});

/**
 * The stop-and-audit regression suite for the capacity-unit / selection-unit
 * split (`.claude/rules/code-quality.md`). Step 5 counted stem x distractor
 * permutations while drawing pages per stem; Step 6 counted DISTINCT bank
 * words while slicing a RAW shuffled pool. These tests assert the shared
 * invariant both bugs violated rather than either individual symptom: the
 * collection the gate counts IS the collection the selection draws from, so a
 * gate verdict is the outcome on every seed.
 */
describe("bank capacity and bank selection are one collection", () => {
  const SEEDS = Array.from({ length: 24 }, (_, index) => seedHex(index + 1));

  test("the gate counts exactly the pool the bank is sliced from", () => {
    for (const pools of SENTENCE_BUILDER_VOCABULARY.wordPools) {
      for (const writingMode of BANK_WRITING_MODES) {
        const request = requestFor(
          profileFor(writingMode, "early-primary", interestReaching(pools.topicId)),
        );
        const capacity = measureSentenceBuilderCapacity(request);
        const drawnFrom = distinctBankWordPool(
          SENTENCE_BUILDER_VOCABULARY,
          pools.topicId,
          writingMode,
        );
        const label = `${pools.topicId}/${writingMode}`;
        expect(capacity.topicIds, label).toEqual([pools.topicId]);
        expect(capacity.bankCapacity, label).toBe(drawnFrom.length);
        const bank = soleItem(generated(request)).wordBank ?? [];
        expect(bank.length, label).toBe(capacity.bankWidth);
        expect(new Set(bank).size, label).toBe(bank.length);
        expect(bank.every((word) => drawnFrom.includes(word)), label).toBe(true);
      }
    }
  });

  test("the capacity verdict is the outcome on every seed, duplicates or not", () => {
    // label/standard promises exactly 6 unique words.
    const cases = [
      { distinct: 8, pool: ["a", "b", "c", "d", "e", "f", "g", "h"] },
      { distinct: 6, pool: ["a", "a", "b", "b", "c", "d", "e", "f"] },
      { distinct: 3, pool: ["a", "a", "b", "b", "c", "c"] },
    ] as const;
    for (const { distinct, pool } of cases) {
      const vocabulary = vocabularyWith(
        [
          {
            bands: ["preschool", "early-primary"],
            id: "neutral-label-pool",
            prompt: "Draw a picture. Write a word on the lines for each thing you can name.",
            topicId: FALLBACK_TOPIC_ID,
            writingMode: "label",
          },
        ],
        {
          independent: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
          label: pool,
          "sentence-frame": pool,
        },
      );
      const request = requestFor(profileFor("label"), { length: "standard" });
      const capacity = measureSentenceBuilderCapacity(request, vocabulary);
      const label = `pool of ${pool.length} with ${distinct} distinct`;
      expect(capacity.bankCapacity, label).toBe(distinct);
      expect(capacity.bankWidth, label).toBe(6);
      const gatePasses = capacity.bankCapacity >= capacity.bankWidth;
      for (const seed of SEEDS) {
        const outcome = generateSentenceBuilder(
          { ...request, seed },
          { worksheetId: WORKSHEET_ID },
          vocabulary,
        );
        expect(outcome.ok, `${label} @ ${seed}`).toBe(gatePasses);
        if (outcome.ok) {
          const bank = soleItem(outcome.document).wordBank ?? [];
          expect(new Set(bank).size, `${label} @ ${seed}`).toBe(6);
        } else {
          // Never a seed-dependent GENERATION_INVARIANT_FAILED: a pool the
          // gate rejected fails the same, deterministic, explainable way.
          expect(outcome.code, `${label} @ ${seed}`).toBe(
            "GENERATION_CONSTRAINT_CONFLICT",
          );
          expect("document" in outcome, `${label} @ ${seed}`).toBe(false);
        }
      }
    }
  });

  test("every shipped mode and band can reach more than one document", () => {
    // The neutral fallback is the leanest reachable configuration; if even it
    // yields two content keys, "Make another" is never dead on first press.
    for (const writingMode of ALL_MODES) {
      for (const presentationBand of PRESENTATION_BANDS) {
        const keys = new Set<string>();
        for (let seed = 1; seed <= 24; seed += 1) {
          keys.add(
            canonicalContentKey(
              generated(
                requestFor(
                  profileFor(writingMode, presentationBand),
                  {},
                  seedHex(seed),
                ),
              ).items,
            ),
          );
        }
        expect(keys.size, `${writingMode}/${presentationBand}`).toBeGreaterThan(1);
      }
    }
  });
});

describe("document invariants are reachable", () => {
  function failureFor(mutate: (document: SentenceBuilderDocumentV1) => SentenceBuilderDocumentV1) {
    const document = generated(requestFor(profileFor("sentence-frame")));
    return validateSentenceBuilderDocument(mutate(document));
  }

  test("accepts the generator's own document", () => {
    expect(
      validateSentenceBuilderDocument(generated(requestFor(profileFor("label")))),
    ).toBeUndefined();
  });

  test("rejects a word bank with a duplicate entry", () => {
    expect(
      failureFor((document) => {
        const item = soleItem(document);
        const bank = item.wordBank ?? [];
        return {
          ...document,
          items: [
            {
              ...item,
              wordBank: [bank[0] ?? "", ...bank.slice(0, bank.length - 1)],
            } as unknown as SentenceItemV1,
          ],
        };
      }),
    ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects a word bank word outside the reviewed pool", () => {
    expect(
      failureFor((document) => {
        const item = soleItem(document);
        const bank = [...(item.wordBank ?? [])];
        bank[0] = "unreviewedword";
        return {
          ...document,
          items: [{ ...item, wordBank: bank } as unknown as SentenceItemV1],
        };
      }),
    ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects prompt text outside the reviewed local vocabulary", () => {
    expect(
      failureFor((document) => ({
        ...document,
        items: [{ ...soleItem(document), prompt: "Write about anything at all." }],
      })),
    ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects an item whose writing mode drifted from the request", () => {
    expect(
      failureFor((document) => ({
        ...document,
        items: [
          {
            ...soleItem(document),
            requiredResponse: SENTENCE_BUILDER_REQUIRED_RESPONSES["draw-and-tell"],
            sentenceFrame: undefined,
            wordBank: undefined,
            writingMode: "draw-and-tell",
          } as unknown as SentenceItemV1,
        ],
      })),
    ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects a tampered required response", () => {
    expect(
      failureFor((document) => ({
        ...document,
        items: [
          {
            ...soleItem(document),
            requiredResponse: {
              copying: false,
              dictation: false,
              drawing: false,
              labels: false,
              writing: false,
            },
          } as unknown as SentenceItemV1,
        ],
      })),
    ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects a topic the request may not draw from", () => {
    expect(
      failureFor((document) => ({
        ...document,
        items: [{ ...soleItem(document), topicId: "sports" }],
      })),
    ).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects a word bank printed by a no-bank mode", () => {
    const document = generated(requestFor(profileFor("draw-and-tell")));
    const failure = validateSentenceBuilderDocument({
      ...document,
      items: [
        { ...soleItem(document), wordBank: ["sun", "tree"] } as unknown as SentenceItemV1,
      ],
    });
    expect(failure).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });

  test("rejects a second item on a one-prompt page", () => {
    const document = generated(requestFor(profileFor("label")));
    const failure = validateSentenceBuilderDocument({
      ...document,
      items: [soleItem(document), { ...soleItem(document), id: "item-002" }],
    });
    expect(failure).toMatchObject({ code: "GENERATION_INVARIANT_FAILED", ok: false });
  });
});

describe("capability support agrees with the generator", () => {
  test("every available combination really generates, and pools cover it", () => {
    let generatedCount = 0;
    for (const writingMode of ALL_MODES) {
      for (const presentationBand of PRESENTATION_BANDS) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const printScale of PRINT_SCALES) {
            for (const interests of [["Distinctive Private Nonsense"], ["Sports"]]) {
              const support = getSentenceBuilderCapabilitySupport(
                writingMode,
                presentationBand,
                length,
                printScale,
              );
              expect(support.available).toBe(true);
              const request = requestFor(
                profileFor(writingMode, presentationBand, interests),
                { length, printScale },
              );
              const result = generateSentenceBuilder(request, {
                worksheetId: WORKSHEET_ID,
              });
              expect(result.ok).toBe(true);
              generatedCount += 1;
            }
          }
        }
      }
    }
    // The literal, not the product of the same arrays the loop iterates: an
    // emptied or filtered schema array must fail here, not read 0 === 0.
    expect(generatedCount).toBe(120);
  });

  test("reports unavailable when the reviewed pool cannot cover the promised bank width", () => {
    const starved: SentenceVocabularyV1 = vocabularyWith(
      SENTENCE_BUILDER_VOCABULARY.prompts.filter(
        (record) => record.topicId === FALLBACK_TOPIC_ID,
      ),
      { independent: ["one", "two"], label: ["one"], "sentence-frame": ["one"] },
    );
    const support = getSentenceBuilderCapabilitySupport(
      "label",
      "early-primary",
      "standard",
      "standard",
      starved,
    );
    expect(support).toMatchObject({ available: false });
    expect(support.available ? "" : support.reason).toContain("6 unique reviewed word-bank words");
  });

  test("answers for the leanest reviewed topic, not just the neutral fallback", () => {
    const neutralPools = findTopicWordPools(
      SENTENCE_BUILDER_VOCABULARY,
      FALLBACK_TOPIC_ID,
    );
    if (neutralPools === undefined) {
      throw new Error("The reviewed vocabulary lost its neutral fallback pool.");
    }
    // Neutral is fat; a matched interest reaches a topic that is not. A gate
    // that measured only neutral would say "available" and the generator
    // would then conflict on the parent's click.
    const thin = vocabularyWithTopics(
      SENTENCE_BUILDER_VOCABULARY.prompts.filter(
        (record) =>
          record.topicId === FALLBACK_TOPIC_ID || record.topicId === "space",
      ),
      [
        neutralPools,
        {
          bankWords: {
            independent: ["one", "two", "three"],
            label: ["one", "two", "three"],
            "sentence-frame": ["one", "two", "three"],
          },
          topicId: "space",
        },
      ],
    );
    const support = getSentenceBuilderCapabilitySupport(
      "label",
      "early-primary",
      "standard",
      "standard",
      thin,
    );
    expect(support).toMatchObject({ available: false });
    expect(support.available ? "" : support.reason).toContain(
      "6 unique reviewed word-bank words",
    );
    // The generator agrees for the profile that actually reaches that topic.
    const request = requestFor(profileFor("label", "early-primary", ["Space"]));
    expect(request.topicIds).toEqual(["space"]);
    expect(
      generateSentenceBuilder(request, { worksheetId: WORKSHEET_ID }, thin),
    ).toMatchObject({ code: "GENERATION_CONSTRAINT_CONFLICT", ok: false });
  });

  test("reports unavailable when no reviewed prompt matches the band", () => {
    const bandless = vocabularyWith(
      SENTENCE_BUILDER_VOCABULARY.prompts.filter(
        (record) =>
          record.topicId === FALLBACK_TOPIC_ID &&
          record.writingMode !== "copy-with-model",
      ),
      {
        independent: [...(findTopicWordPools(SENTENCE_BUILDER_VOCABULARY, "neutral")?.bankWords.independent ?? [])],
        label: [...(findTopicWordPools(SENTENCE_BUILDER_VOCABULARY, "neutral")?.bankWords.label ?? [])],
        "sentence-frame": [...(findTopicWordPools(SENTENCE_BUILDER_VOCABULARY, "neutral")?.bankWords["sentence-frame"] ?? [])],
      },
    );
    const support = getSentenceBuilderCapabilitySupport(
      "copy-with-model",
      "preschool",
      "standard",
      "standard",
      bandless,
    );
    expect(support).toMatchObject({ available: false });
    expect(support.available ? "" : support.reason).toContain("copy with a model");
  });
});

describe("effective length and print scale reach the sheet", () => {
  test("large print narrows a long independent bank to the standard budget", () => {
    const long = soleItem(
      generated(requestFor(profileFor("independent"), { length: "long" })),
    );
    const largeLong = soleItem(
      generated(
        requestFor(profileFor("independent"), { length: "long", printScale: "large" }),
      ),
    );
    expect(long.wordBank).toHaveLength(10);
    expect(largeLong.wordBank).toHaveLength(8);
  });

  test("large print never changes a no-bank mode's canonical length", () => {
    for (const writingMode of ["draw-and-tell", "copy-with-model"] as const) {
      for (const printScale of PRINT_SCALES) {
        const request = requestFor(profileFor(writingMode), {
          length: "long",
          printScale,
        });
        expect(request.options.length).toBe("standard");
        expect(soleItem(generated(request)).wordBank).toBeUndefined();
      }
    }
  });
});
