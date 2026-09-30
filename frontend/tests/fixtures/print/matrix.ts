import { worksheetSelectionOf } from "../../../src/shared/config/defaults.ts";
import { selectionFromEarlierSettings } from "../../../src/shared/config/earlier-settings.ts";
import type {
  ChildProfileV2,
  WorksheetDefaultsV2,
  WorksheetSelectionV2,
  WritingMode,
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
import { acceptanceConfig } from "../profiles.ts";

// The manual harness, this matrix, and the plan use the committed example,
// read once through the store's classifier in `tests/fixtures/profiles.ts`.
export { acceptanceConfig };
export const boundaryNickname = "界".repeat(40);

/**
 * The worksheet selection the generator panel builds for a stored canonical
 * child: the stored defaults' selection with that child's earlier settings
 * mapped onto the groups they cover, then the panel's own choices.
 */
export function selectionFor(
  profile: ChildProfileV2,
  defaults: WorksheetDefaultsV2,
  overrides: Partial<WorksheetSelectionV2>,
): WorksheetSelectionV2 {
  const legacy = profile.legacyChoices;
  if (legacy === undefined) {
    throw new Error("A canonical profile carried no earlier settings.");
  }
  return {
    ...selectionFromEarlierSettings(legacy, worksheetSelectionOf(defaults)).selection,
    ...overrides,
  };
}

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
  let profile: ChildProfileV2 = { ...original, displayName: boundaryNickname };
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
    const legacyChoices = profile.legacyChoices;
    if (legacyChoices === undefined) {
      throw new Error("A canonical profile carried no earlier settings.");
    }
    profile = {
      ...profile,
      interests: [topic],
      legacyChoices: { ...legacyChoices, writingMode: mode },
    };
  }
  const selection = selectionFor(profile, acceptanceConfig.defaults, {
    worksheetType: fixture.worksheetType,
    length: "long",
    printScale,
  });
  const registration = getWorksheetRegistration(fixture.worksheetType);
  // Search only real generator outputs. The browser receives this seed, never a
  // fabricated document, and must reproduce its exact prompts, bank and items.
  for (let seed = 1; seed <= 50_000; seed += 1) {
    const projected = projectGenerationRequest({
      profile,
      selection,
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
    return { profile, selection, seed, document: generated.document };
  }
  throw new Error(`No deterministic boundary seed found for ${fixture.id}.`);
}
