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
  FACT_FACTOR_MAXIMUM,
  OPERATION_GRID_POWERS_BASE_MAXIMUM,
  OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
  OPERATION_GRID_CELL_MAXIMUM,
  OPERATION_GRID_SIZE_MAXIMUM,
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
  /** Printed only on these papers and scales: one worksheet row and its key each. */
  readonly printedOn?: readonly { readonly paper: "letter" | "a4"; readonly scale: PrintScale }[];
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
    id: "dry-math-facts-144",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "dry-math",
      dryMathStrand: "multiply-divide",
      dryMathFacts: {
        operations: ["multiplication", "division"],
        factFamilies: Array.from({ length: FACT_FACTOR_MAXIMUM + 1 }, (_, family) => family),
      },
    },
    letterStandardOnly: true,
  },
  {
    id: "dry-math-three-digit-1000",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "dry-math",
      dryMathStrand: "three-digit",
      dryMathThreeDigit: { operations: ["addition", "subtraction"] },
      dryMathRegrouping: "required",
    },
    printedOn: [
      { paper: "letter", scale: "standard" },
      { paper: "a4", scale: "large" },
    ],
  },
  {
    id: "dry-math-multi-digit",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "dry-math",
      dryMathStrand: "multi-digit",
      dryMathMultiDigit: { operations: ["multiplication", "division"] },
    },
    letterStandardOnly: true,
  },
  {
    id: "dry-math-remainders",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "dry-math",
      dryMathStrand: "remainders",
    },
    printedOn: [
      { paper: "letter", scale: "standard" },
      { paper: "a4", scale: "large" },
    ],
  },
  {
    id: "bonds-missing-20",
    profileIndex: 1,
    selection: {
      ...shippedSelection,
      worksheetType: "number-bonds",
      numberBonds: {
        operations: ["addition", "subtraction"],
        wholeMax: V1_NUMERIC_MAXIMUM,
        regrouping: "without",
      },
    },
    letterStandardOnly: true,
  },
  // Operation Grid: the reference screenshot's shape (a 10 x 10
  // multiplication grid with its diagonal given), the largest grid on Letter and A4, and
  // the largest powers grid at large scale, whose last cell is 1,000.
  {
    id: "grid-multiplication-10",
    profileIndex: 0,
    selection: {
      ...shippedSelection,
      worksheetType: "operation-grid",
      operationGrid: {
        ...shippedSelection.operationGrid,
        operation: "multiplication",
        rows: 10,
        columns: 10,
        prefilled: 10,
        placement: "diagonal-first",
      },
    },
    printedOn: [{ paper: "letter", scale: "standard" }],
  },
  {
    id: "grid-addition-12",
    profileIndex: 1,
    selection: {
      ...shippedSelection,
      worksheetType: "operation-grid",
      operationGrid: {
        ...shippedSelection.operationGrid,
        operation: "addition",
        rows: OPERATION_GRID_SIZE_MAXIMUM,
        columns: OPERATION_GRID_SIZE_MAXIMUM,
        prefilled: 14,
        placement: "random",
      },
    },
    printedOn: [
      { paper: "letter", scale: "standard" },
      { paper: "a4", scale: "standard" },
    ],
  },
  {
    id: "grid-powers-10x3",
    profileIndex: 2,
    selection: {
      ...shippedSelection,
      worksheetType: "operation-grid",
      operationGrid: {
        ...shippedSelection.operationGrid,
        operation: "powers",
        rows: OPERATION_GRID_POWERS_BASE_MAXIMUM,
        columns: OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
        prefilled: 3,
        placement: "random",
      },
    },
    printedOn: [{ paper: "letter", scale: "large" }],
  },
  {
    id: "grid-multiplication-offset-mixed",
    profileIndex: 0,
    selection: {
      ...shippedSelection,
      worksheetType: "operation-grid",
      operationGrid: {
        ...shippedSelection.operationGrid,
        operation: "multiplication",
        rows: OPERATION_GRID_SIZE_MAXIMUM,
        columns: OPERATION_GRID_SIZE_MAXIMUM,
        rowStart: Math.floor(Math.sqrt(OPERATION_GRID_CELL_MAXIMUM)) - OPERATION_GRID_SIZE_MAXIMUM + 1,
        columnStart: Math.floor(Math.sqrt(OPERATION_GRID_CELL_MAXIMUM)) - OPERATION_GRID_SIZE_MAXIMUM + 1,
        prefilled: 72,
        placement: "random",
        headerOrder: "mixed",
      },
    },
    printedOn: [
      { paper: "letter", scale: "standard" },
      { paper: "a4", scale: "standard" },
    ],
  },
  // Clock Explorer: four clocks on every paper and scale, the boundary seed
  // holding 12:00, whose hands overlap, and 10:00 or 11:00, the widest hour
  // hand angles beside two-digit labels.
  {
    id: "clock-hours-12",
    profileIndex: 0,
    selection: { ...shippedSelection, worksheetType: "clock-explorer" },
  },
  // Tally Detective: four tallies on every paper and scale, the boundary seed
  // holding 20, four full bundles, and 19, three bundles and four loose
  // marks: the two widest tallies.
  {
    id: "tally-totals-20",
    profileIndex: 0,
    selection: { ...shippedSelection, worksheetType: "tally-detective" },
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
    let addSubtractRegroupingBoundary: boolean;
    let factsBoundary: boolean;
    let threeDigitBoundary: boolean;
    let multiDigitBoundary: boolean;
    switch (selection.dryMathStrand) {
      case "add-subtract":
        addSubtractRegroupingBoundary = selection.dryMathRegrouping === "required";
        factsBoundary = false;
        threeDigitBoundary = false;
        multiDigitBoundary = false;
        break;
      case "multiply-divide":
        addSubtractRegroupingBoundary = false;
        factsBoundary = true;
        threeDigitBoundary = false;
        multiDigitBoundary = false;
        break;
      case "three-digit":
        addSubtractRegroupingBoundary = false;
        factsBoundary = false;
        threeDigitBoundary = true;
        multiDigitBoundary = false;
        break;
      case "multi-digit":
        addSubtractRegroupingBoundary = false;
        factsBoundary = false;
        threeDigitBoundary = false;
        multiDigitBoundary = true;
        break;
      case "remainders":
        addSubtractRegroupingBoundary = false;
        factsBoundary = false;
        threeDigitBoundary = false;
        multiDigitBoundary = false;
        break;
      default: {
        const unreachable: never = selection.dryMathStrand;
        throw new Error(`Unsupported Dry Math strand: ${String(unreachable)}`);
      }
    }
    if (
      selection.worksheetType === "dry-math" && multiDigitBoundary &&
      !(generated.document.items.some((item) => item.itemType === "dry-math" && item.operation === "multiplication" && item.answer.kind === "number" && item.answer.value >= 800) &&
        generated.document.items.some((item) => item.itemType === "dry-math" && item.operation === "division" && item.answer.kind === "number" && item.answer.value >= 100))
    ) continue;
    if (
      selection.worksheetType === "dry-math" &&
      threeDigitBoundary &&
      !generated.document.items.some(
        (item) =>
          item.itemType === "dry-math" &&
          item.operation === "subtraction" &&
          item.leftOperand === 1000,
      )
    ) {
      continue;
    }
    // Every problem carries or borrows: search for the widest row, a
    // subtraction from the Dry Math ceiling.
    if (
      selection.worksheetType === "dry-math" &&
      addSubtractRegroupingBoundary &&
      !generated.document.items.some(
        (item) =>
          item.itemType === "dry-math" &&
          item.operation === "subtraction" &&
          item.leftOperand === DRY_MATH_NUMERIC_MAXIMUM,
      )
    ) {
      continue;
    }
    // Multiplication and division facts: search for the widest rows, a
    // three-digit dividend over a two-digit divisor and a product of two
    // two-digit factors.
    if (
      selection.worksheetType === "dry-math" &&
      factsBoundary &&
      !(
        generated.document.items.some(
          (item) =>
            item.itemType === "dry-math" &&
            item.operation === "division" &&
            item.leftOperand >= 100 &&
            item.rightOperand >= 10,
        ) &&
        generated.document.items.some(
          (item) =>
            item.itemType === "dry-math" &&
            item.operation === "multiplication" &&
            item.leftOperand >= 10 &&
            item.rightOperand >= 10,
        )
      )
    ) {
      continue;
    }
    // Number Bonds: search for the widest sentence, one whose two printed
    // numbers both have two digits.
    if (
      selection.worksheetType === "number-bonds" &&
      !generated.document.items.some(
        (item) =>
          item.itemType === "number-bond" &&
          [
            ...(item.missing === "left" ? [] : [item.leftOperand]),
            ...(item.missing === "right" ? [] : [item.rightOperand]),
            item.result,
          ].every((value) => value >= 10),
      )
    ) {
      continue;
    }
    if (
      selection.worksheetType === "clock-explorer" &&
      !(
        generated.document.items.some((item) => item.itemType === "clock-explorer" && item.hour === 12) &&
        generated.document.items.some(
          (item) => item.itemType === "clock-explorer" && (item.hour === 10 || item.hour === 11),
        )
      )
    ) {
      continue;
    }
    if (
      selection.worksheetType === "tally-detective" &&
      ![19, 20].every((total) =>
        generated.document.items.some(
          (item) => item.itemType === "tally-detective" && item.answer.value === total,
        ),
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
