import { worksheetSelectionOf } from "../../../src/shared/config/defaults.ts";
import { selectionFromEarlierSettings } from "../../../src/shared/config/earlier-settings.ts";
import type {
  ChildProfileV2,
  WorksheetSelectionV2,
} from "../../../src/shared/config/schema.ts";
import { projectGenerationRequest } from "../../../src/shared/worksheet/project-request.ts";
import { getWorksheetRegistration } from "../../../src/shared/worksheet/registry.ts";
import { PRACTICE_FOCUS_CATALOG } from "../../../src/shared/config/practice-focus.ts";
import {
  DRY_MATH_NUMERIC_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
  type PrintScale,
} from "../../../src/shared/worksheet/types.ts";
import { getSentenceBuilderBankSize } from "../../../src/worksheets/sentence-builder/definition.ts";
import {
  SENTENCE_BUILDER_VOCABULARY,
  isBankWritingMode,
} from "../../../src/worksheets/sentence-builder/vocabulary.ts";
import { acceptanceConfig, migratedV1FixtureConfig } from "../profiles.ts";

// The manual harness, this matrix, and the plan use the committed example,
// read once through the store's classifier in `tests/fixtures/profiles.ts`.
export { acceptanceConfig };
export const boundaryNickname = "界".repeat(40);

/** The worksheet selection the committed example's saved defaults start from. */
export const shippedSelection: WorksheetSelectionV2 = worksheetSelectionOf(
  acceptanceConfig.defaults,
);

/**
 * The choices a canonical child's earlier settings supplied before the example
 * became identity-only: the permanent v1 fixture's `legacyChoices` for the
 * child at `profileIndex`, mapped onto the shipped selection.
 */
export function formerChoices(profileIndex: number): WorksheetSelectionV2 {
  const legacy = migratedV1FixtureConfig.profiles[profileIndex]?.legacyChoices;
  if (legacy === undefined) {
    throw new Error("A canonical v1 fixture profile carried no earlier settings.");
  }
  return selectionFromEarlierSettings(legacy, shippedSelection).selection;
}

export interface PrintFixture {
  readonly id: string;
  /** The identity-only example child whose nickname (and interests) the case edits. */
  readonly profileIndex: number;
  /** Every worksheet choice the case makes through the worksheet controls. */
  readonly selection: WorksheetSelectionV2;
  readonly boundary?: "prompt" | "bank";
  /** Printed only at Letter and standard scale: one worksheet row and its key. */
  readonly letterStandardOnly?: true;
}

/** The Dry Math catalog focus "Addition and subtraction within 100". */
function dryMathFocusWithin100(): WorksheetSelectionV2["dryMath"] {
  const option = PRACTICE_FOCUS_CATALOG["dry-math"].find(
    ({ focus }) =>
      focus.operations.length === 2 &&
      focus.operandMax === DRY_MATH_NUMERIC_MAXIMUM &&
      focus.resultMax === DRY_MATH_NUMERIC_MAXIMUM,
  );
  if (option === undefined) {
    throw new Error("The Dry Math catalog lost its within-100 focus.");
  }
  return option.focus;
}

export const printFixtures: readonly PrintFixture[] = [
  {
    id: "dry-math",
    profileIndex: 2,
    selection: { ...shippedSelection, worksheetType: "dry-math", dryMath: formerChoices(2).dryMath },
  },
  {
    id: "dry-math-regrouping-100",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "dry-math",
      dryMath: dryMathFocusWithin100(),
      dryMathRegrouping: "required",
    },
    letterStandardOnly: true,
  },
  {
    id: "wow-quantity",
    profileIndex: 0,
    selection: {
      ...shippedSelection,
      worksheetType: "find-the-wow",
      findTheWow: {
        ...shippedSelection.findTheWow,
        variant: "quantity",
        quantity: formerChoices(0).findTheWow.quantity,
      },
    },
  },
  {
    id: "wow-equation",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "find-the-wow",
      findTheWow: {
        ...shippedSelection.findTheWow,
        variant: "equation",
        equation: formerChoices(2).findTheWow.equation,
      },
    },
  },
  {
    id: "count-all-four-subtypes",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "count-compare-make",
      countCompareMake: formerChoices(2).countCompareMake,
    },
  },
  ...([
    "draw-and-tell", "label", "copy-with-model", "sentence-frame", "independent",
  ] as const).flatMap((writingMode) => {
    const selection: WorksheetSelectionV2 = {
      ...shippedSelection,
      worksheetType: "sentence-builder",
      sentenceBuilder: { variant: writingMode, vocabulary: "all-words" },
    };
    return [
      {
        id: `sentence-${writingMode}-prompt`,
        profileIndex: 1,
        selection,
        boundary: "prompt" as const,
      },
      ...(isBankWritingMode(writingMode) ? [{
        id: `sentence-${writingMode}-bank`,
        profileIndex: 1,
        selection,
        boundary: "bank" as const,
      }] : []),
    ];
  }),
];

export function createPrintFixture(fixture: PrintFixture, printScale: PrintScale) {
  const original = acceptanceConfig.profiles[fixture.profileIndex];
  if (original === undefined) {
    throw new Error("Missing canonical acceptance profile.");
  }
  let profile: ChildProfileV2 = { ...original, displayName: boundaryNickname };
  let requiredPrompt: string | undefined;
  let requiredWords: readonly string[] = [];
  const sentence = fixture.selection.worksheetType === "sentence-builder";
  if (sentence) {
    const mode = fixture.selection.sentenceBuilder.variant;
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
    profile = { ...profile, interests: [topic] };
  }
  const selection: WorksheetSelectionV2 = { ...fixture.selection, length: "long", printScale };
  const registration = getWorksheetRegistration(selection.worksheetType);
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
    // Every problem carries or borrows: search for the widest row, a
    // subtraction from the Dry Math ceiling.
    if (
      selection.worksheetType === "dry-math" &&
      selection.dryMathRegrouping === "required" &&
      !generated.document.items.some(
        (item) =>
          item.itemType === "dry-math" &&
          item.operation === "subtraction" &&
          item.leftOperand === DRY_MATH_NUMERIC_MAXIMUM,
      )
    ) {
      continue;
    }
    if (
      selection.worksheetType === "count-compare-make" &&
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
      sentence &&
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
