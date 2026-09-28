import { readFileSync } from "node:fs";

import {
  AppConfigV1Schema,
  type ChildProfileV1,
  type GenerationDefaultsV1,
  type WritingMode,
} from "../../../src/shared/config/schema.ts";
import { projectGenerationRequest } from "../../../src/shared/worksheet/project-request.ts";
import { getWorksheetRegistration } from "../../../src/shared/worksheet/registry.ts";
import {
  V1_NUMERIC_MAXIMUM,
  type PrintScale,
  type WorksheetType,
} from "../../../src/shared/worksheet/types.ts";
import { getSentenceBuilderBankSize } from "../../../src/worksheets/sentence-builder/definition.ts";
import {
  SENTENCE_BUILDER_VOCABULARY,
  isBankWritingMode,
} from "../../../src/worksheets/sentence-builder/vocabulary.ts";

// The manual harness, this matrix, and the plan use the committed example.
export const acceptanceConfig = AppConfigV1Schema.parse(JSON.parse(
  readFileSync(
    new URL("../../../../config/children.example.json", import.meta.url),
    "utf8",
  ),
));
export const boundaryNickname = "界".repeat(40);

export interface PrintFixture {
  readonly id: string;
  readonly worksheetType: WorksheetType;
  readonly profileIndex: number;
  readonly writingMode?: WritingMode;
  readonly boundary?: "prompt" | "bank";
}

export const printFixtures: readonly PrintFixture[] = [
  { id: "dry-math", worksheetType: "dry-math", profileIndex: 2 },
  { id: "wow-quantity", worksheetType: "find-the-wow", profileIndex: 0 },
  { id: "wow-equation", worksheetType: "find-the-wow", profileIndex: 2 },
  {
    id: "count-all-four-subtypes",
    worksheetType: "count-compare-make",
    profileIndex: 2,
  },
  ...([
    "draw-and-tell", "label", "copy-with-model", "sentence-frame", "independent",
  ] as const).flatMap((writingMode) => [
    {
      id: `sentence-${writingMode}-prompt`,
      worksheetType: "sentence-builder" as const,
      profileIndex: 1,
      writingMode,
      boundary: "prompt" as const,
    },
    ...(isBankWritingMode(writingMode) ? [{
      id: `sentence-${writingMode}-bank`,
      worksheetType: "sentence-builder" as const,
      profileIndex: 1,
      writingMode,
      boundary: "bank" as const,
    }] : []),
  ]),
];

export function createPrintFixture(fixture: PrintFixture, printScale: PrintScale) {
  const original = acceptanceConfig.profiles[fixture.profileIndex];
  if (original === undefined) {
    throw new Error("Missing canonical acceptance profile.");
  }
  let profile: ChildProfileV1 = { ...original, displayName: boundaryNickname };
  let requiredPrompt: string | undefined;
  let requiredWords: readonly string[] = [];
  if (fixture.writingMode !== undefined) {
    const mode = fixture.writingMode;
    const records = SENTENCE_BUILDER_VOCABULARY.prompts.filter(
      (record) => record.writingMode === mode,
    );
    const longest = [...records].sort(
      (left, right) => right.prompt.length - left.prompt.length,
    )[0];
    if (longest === undefined) {
      throw new Error("Missing curated writing mode.");
    }
    let topic = longest.topicId;
    requiredPrompt = longest.prompt;
    if (fixture.boundary === "bank" && isBankWritingMode(mode)) {
      const count = getSentenceBuilderBankSize(mode, "long", printScale);
      const pools = SENTENCE_BUILDER_VOCABULARY.wordPools.map((pool) => ({
        topic: pool.topicId,
        words: [...pool.bankWords[mode]]
          .sort((a, b) => b.length - a.length || a.localeCompare(b))
          .slice(0, count),
      })).sort((a, b) => b.words.join("").length - a.words.join("").length);
      const widest = pools[0];
      if (widest === undefined) {
        throw new Error("Missing curated bank.");
      }
      topic = widest.topic;
      requiredWords = widest.words;
      requiredPrompt = undefined;
    }
    profile = { ...profile, writingMode: mode, interests: [topic] };
  }
  const preferences: GenerationDefaultsV1 = {
    ...acceptanceConfig.defaults,
    length: "long",
    printScale,
  };
  const registration = getWorksheetRegistration(fixture.worksheetType);
  // Search only real generator outputs. The browser receives this seed, never a
  // fabricated document, and must reproduce its exact prompts, bank and items.
  for (let seed = 1; seed <= 50_000; seed += 1) {
    const projected = projectGenerationRequest({
      profile,
      preferences,
      worksheetType: fixture.worksheetType,
      generatorVersion: registration.generatorVersion,
      seed: seed.toString(16).padStart(8, "0"),
    });
    if (!projected.ok) {
      throw new Error(projected.message);
    }
    const generated = registration.generate(projected.request, {
      worksheetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    if (!generated.ok) {
      throw new Error(generated.message);
    }
    const first = generated.document.items[0];
    if (
      fixture.worksheetType === "count-compare-make" &&
      !["match", "compare", "complete", "draw"].every((activity) =>
        generated.document.items.some((item) => {
          if (item.itemType !== "count-compare" || item.activity !== activity) {
            return false;
          }
          switch (item.activity) {
            case "match":
              return item.choices.includes(V1_NUMERIC_MAXIMUM);
            case "compare":
              return Math.max(item.leftQuantity, item.rightQuantity) === V1_NUMERIC_MAXIMUM;
            default:
              return item.target === V1_NUMERIC_MAXIMUM;
          }
        }),
      )
    ) {
      continue;
    }
    if (
      fixture.writingMode !== undefined &&
      (first?.itemType !== "sentence" ||
        (requiredPrompt !== undefined && first.prompt !== requiredPrompt) ||
        !requiredWords.every((word) => first.wordBank?.includes(word)))
    ) {
      continue;
    }
    return { profile, preferences, seed, document: generated.document };
  }
  throw new Error(`No deterministic boundary seed found for ${fixture.id}.`);
}
