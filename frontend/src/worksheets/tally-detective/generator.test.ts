import { describe, expect, test } from "vitest";

import { judgeTallyDocument } from "../../../tests/oracles/tally-oracle.js";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults.js";
import type { WorksheetSelectionV2 } from "../../shared/config/schema.js";
import { recomputeObjectiveAnswer } from "../../shared/worksheet/answer-oracle.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../shared/worksheet/project-request.js";
import { getWorksheetRegistration } from "../../shared/worksheet/registry.js";
import type {
  ClockExplorerItemV1,
  DryMathItemV1,
  GenerationRequestV1,
  TallyDetectiveItemV1,
  WorksheetDocumentV1,
  WorksheetItemV1,
} from "../../shared/worksheet/types.js";
import { generateDryMath } from "../dry-math/generator.js";
import {
  TALLY_DETECTIVE_DEFINITION,
  tallyDecompositionText,
  tallyGroupingOf,
  tallyKeyText,
  tallyTotalOf,
} from "./definition.js";
import {
  TALLY_DETECTIVE_TOTALS,
  generateTallyDetective,
  validateTallyDetectiveDocument,
  type TallyDetectiveDocumentV1,
} from "./generator.js";

const WORKSHEET_ID = "66666666-6666-4666-8666-666666666666";

const baseSelection: WorksheetSelectionV2 = {
  ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
  worksheetType: "tally-detective",
};

/** The request the sole projection boundary builds for a Tally Detective page. */
function tallyRequest(seed: string, selection: WorksheetSelectionV2 = baseSelection): GenerationRequestV1 {
  const projected = projectGenerationRequest({
    selection,
    generatorVersion: TALLY_DETECTIVE_DEFINITION.generatorVersion,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  return projected.request;
}

function generated(seed: string): TallyDetectiveDocumentV1 {
  const result = generateTallyDetective(tallyRequest(seed), { worksheetId: WORKSHEET_ID });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.document;
}

function totalsOf(document: WorksheetDocumentV1): readonly number[] {
  return document.items.map((item) =>
    item.itemType === "tally-detective" ? 5 * item.bundles + item.remainder : Number.NaN);
}

/** A document with its items replaced, for the malformed-input cases. */
function withItems(
  document: TallyDetectiveDocumentV1,
  items: readonly WorksheetItemV1[],
): TallyDetectiveDocumentV1 {
  return { ...document, items } as unknown as TallyDetectiveDocumentV1;
}

/** A tally item written out by hand: its grouping, and its answer (the total unless given). */
function tally(id: string, bundles: number, remainder: number, answer = 5 * bundles + remainder): TallyDetectiveItemV1 {
  return {
    id,
    itemType: "tally-detective",
    answerability: "objective",
    bundles,
    remainder,
    answer: { kind: "number", value: answer },
  };
}

describe("Tally Detective registration", () => {
  test("is version 1, keyed, uses no interests and is the registered generator", () => {
    expect(TALLY_DETECTIVE_DEFINITION).toEqual({
      id: "tally-detective",
      displayName: "Tally Detective",
      generatorVersion: 1,
      usesInterests: false,
      hasAnswerKey: true,
    });
    expect(getWorksheetRegistration("tally-detective").generate).toBe(generateTallyDetective);
    expect(TALLY_DETECTIVE_TOTALS).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });
});

describe("generateTallyDetective", () => {
  // Pinned from the seeded shuffle: a change to the stream or the domain
  // order fails here instead of silently changing every printed page.
  test.each([
    ["00000001", [8, 18, 15, 17]],
    ["00000002", [17, 6, 16, 4]],
    ["5eed0036", [19, 2, 13, 1]],
    ["a1b2c3d4", [17, 18, 1, 15]],
    ["ffffffff", [16, 6, 9, 12]],
  ] as const)("seed %s draws the totals %j", (seed, totals) => {
    const document = generated(seed);
    expect(totalsOf(document)).toEqual(totals);
    expect(document.items.map(({ id }) => id)).toEqual(["item-001", "item-002", "item-003", "item-004"]);
    // Written out: full fives, then the loose marks.
    expect(document.items).toEqual(totals.map((total, index) =>
      tally(`item-00${index + 1}`, Math.floor(total / 5), total % 5)));
  });

  test("the same request and seed reproduce the same document", () => {
    for (const seed of ["00000001", "5eed0036", "ffffffff"]) {
      expect(generated(seed)).toEqual(generated(seed));
      expect(generateTallyDetective(tallyRequest(seed), { worksheetId: WORKSHEET_ID }))
        .toEqual(getWorksheetRegistration("tally-detective").generate(tallyRequest(seed), {
          worksheetId: WORKSHEET_ID,
        }));
    }
  });

  test("every seed draws four distinct totals from 1 to 20, and the seeds together reach all twenty in every position", () => {
    const seen = Array.from({ length: 4 }, () => new Set<number>());
    for (let seed = 1; seed <= 600; seed += 1) {
      const document = generated(seed.toString(16).padStart(8, "0"));
      const totals = totalsOf(document);
      expect(totals).toHaveLength(4);
      expect(new Set(totals).size).toBe(4);
      for (const [position, total] of totals.entries()) {
        expect(Number.isInteger(total) && total >= 1 && total <= 20).toBe(true);
        seen[position]?.add(total);
      }
      expect(validateTallyDetectiveDocument(document)).toBeUndefined();
      expect(judgeTallyDocument(document)).toEqual([]);
    }
    for (const positions of seen) {
      expect([...positions].sort((a, b) => a - b)).toEqual(TALLY_DETECTIVE_TOTALS);
    }
  });

  test("a different seed changes the tallies", () => {
    expect(totalsOf(generated("00000001"))).not.toEqual(totalsOf(generated("00000002")));
  });

  test("refuses a request for another family or generator version", () => {
    const request = tallyRequest("00000001");
    for (const wrong of [
      { ...request, worksheetType: "clock-explorer" },
      { ...request, generatorVersion: 2 },
    ] as const) {
      const result = generateTallyDetective(wrong, { worksheetId: WORKSHEET_ID });
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.code).toBe("GENERATION_INVARIANT_FAILED");
    }
  });
});

describe("every total's grouping and key text", () => {
  // Written out, not derived: each total as its full fives and loose marks.
  const GROUPINGS: readonly (readonly [number, number, number, string])[] = [
    [1, 0, 1, "1"], [2, 0, 2, "2"], [3, 0, 3, "3"], [4, 0, 4, "4"],
    [5, 1, 0, "5"], [6, 1, 1, "5 + 1"], [7, 1, 2, "5 + 2"], [8, 1, 3, "5 + 3"],
    [9, 1, 4, "5 + 4"], [10, 2, 0, "5 + 5"], [11, 2, 1, "5 + 5 + 1"], [12, 2, 2, "5 + 5 + 2"],
    [13, 2, 3, "5 + 5 + 3"], [14, 2, 4, "5 + 5 + 4"], [15, 3, 0, "5 + 5 + 5"], [16, 3, 1, "5 + 5 + 5 + 1"],
    [17, 3, 2, "5 + 5 + 5 + 2"], [18, 3, 3, "5 + 5 + 5 + 3"], [19, 3, 4, "5 + 5 + 5 + 4"],
    [20, 4, 0, "5 + 5 + 5 + 5"],
  ];

  test("the table covers every total once", () => {
    expect(GROUPINGS.map(([total]) => total)).toEqual(TALLY_DETECTIVE_TOTALS);
  });

  test.each(GROUPINGS)("%i is %i bundles and %i loose marks, keyed %s", (total, bundles, remainder, parts) => {
    expect(tallyGroupingOf(total)).toEqual({ bundles, remainder });
    expect(tallyTotalOf({ bundles, remainder })).toBe(total);
    expect(tallyDecompositionText({ bundles, remainder })).toBe(parts);
    expect(tallyKeyText({ bundles, remainder })).toBe(`${total} = ${parts}`);
    expect(recomputeObjectiveAnswer(tally("item-001", bundles, remainder))).toEqual({ kind: "number", value: total });
  });

  test("the reference 8 is 5 + 3 and keys 8; four full bundles key 20", () => {
    expect(tallyGroupingOf(8)).toEqual({ bundles: 1, remainder: 3 });
    expect(tallyKeyText({ bundles: 1, remainder: 3 })).toBe("8 = 5 + 3");
    expect(tallyGroupingOf(20)).toEqual({ bundles: 4, remainder: 0 });
    expect(tallyKeyText({ bundles: 4, remainder: 0 })).toBe("20 = 5 + 5 + 5 + 5");
  });

  test.each([
    ["no marks at all", 0, 0],
    ["five loose marks instead of a bundle", 0, 5],
    ["a negative remainder", 2, -1],
    ["a fractional bundle", 1.5, 0],
    ["a fractional remainder", 1, 2.5],
    ["a negative bundle count", -1, 3],
    ["a total of 21", 4, 1],
    ["five bundles", 5, 0],
    ["a NaN grouping", Number.NaN, 0],
  ] as const)("a tally with %s has no answer", (_label, bundles, remainder) => {
    expect(recomputeObjectiveAnswer(tally("item-001", bundles, remainder))).toBeUndefined();
  });
});

describe("validateTallyDetectiveDocument refuses malformed pages", () => {
  const document = generated("00000001");
  const [first, second, third, fourth] = document.items as readonly TallyDetectiveItemV1[];
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    throw new Error("A Tally Detective page holds four tallies.");
  }

  test("the generated page passes, and so does every tally order of the same totals", () => {
    expect(validateTallyDetectiveDocument(document)).toBeUndefined();
    const reversed = [fourth, third, second, first].map((item, index) =>
      tally(`item-00${index + 1}`, item.bundles, item.remainder));
    expect(validateTallyDetectiveDocument(withItems(document, reversed))).toBeUndefined();
  });

  const dryMathItem: DryMathItemV1 = {
    id: "item-004",
    itemType: "dry-math",
    answerability: "objective",
    operation: "addition",
    leftOperand: 1,
    rightOperand: 2,
    renderedSymbol: "+",
    answer: { kind: "number", value: 3 },
  };
  const clockItem: ClockExplorerItemV1 = {
    id: "item-004",
    itemType: "clock-explorer",
    answerability: "objective",
    hour: 3,
    answer: { kind: "number", value: 3 },
  };

  // Seed 00000001 draws 8 (1 + 3), 18 (3 + 3), 15 (3 + 0) and 17 (3 + 2).
  const CORRUPTIONS: readonly (readonly [string, () => readonly unknown[]])[] = [
    ["a total of 0", () => [tally("item-001", 0, 0), second, third, fourth]],
    ["a total of 21", () => [tally("item-001", 4, 1), second, third, fourth]],
    ["five loose marks", () => [tally("item-001", 0, 5), second, third, fourth]],
    ["a regrouped remainder (8 as 0 bundles and 8 loose)", () => [tally("item-001", 0, 8), second, third, fourth]],
    ["a negative remainder", () => [tally("item-001", 2, -2), second, third, fourth]],
    ["a fractional bundle count", () => [tally("item-001", 1.5, 0), second, third, fourth]],
    ["a wrong answer", () => [tally("item-001", 1, 3, 9), second, third, fourth]],
    ["a choice answer", () => [{ ...first, answer: { kind: "choice", value: 0 } }, second, third, fourth]],
    ["a repeated total", () => [first, tally("item-002", 1, 3), third, fourth]],
    ["three tallies", () => [first, second, third]],
    ["five tallies", () => [first, second, third, fourth, tally("item-005", 0, 1)]],
    ["no tallies", () => []],
    ["out-of-order identifiers", () => [second, first, third, fourth]],
    ["a Dry Math item among the tallies", () => [first, second, third, dryMathItem]],
    ["a clock among the tallies", () => [first, second, third, clockItem]],
  ];

  test.each(CORRUPTIONS)("%s", (_label, items) => {
    const corrupted = withItems(document, items() as readonly WorksheetItemV1[]);
    expect(validateTallyDetectiveDocument(corrupted)?.code).toBe("GENERATION_INVARIANT_FAILED");
    // The independent oracle refuses the same page.
    expect(judgeTallyDocument(corrupted)).not.toEqual([]);
  });

  test.each([
    ["a stored length", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, options: { ...request.options, length: "short" } })],
    ["decoration", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, options: { ...request.options, includeDecorativeGraphics: true } })],
    ["a decorative topic", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, options: { ...request.options, decorativeTopicId: "space" } })],
    ["interests", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, topicIds: ["animals"] })],
    ["a practice member", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, practice: { kind: "dry-math-add-subtract", regrouping: "required" } })],
    ["a writing mode", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, capabilities: { ...request.capabilities, writingMode: "independent" } })],
    ["a math operation", (request: GenerationRequestV1): GenerationRequestV1 => ({
      ...request,
      capabilities: {
        ...request.capabilities,
        mathSkills: { ...request.capabilities.mathSkills, operations: ["addition", "subtraction"] },
      },
    })],
  ] as const)("a request carrying %s", (_label, edit) => {
    const request = edit(document.request);
    expect(validateTallyDetectiveDocument({ ...document, request })?.code).toBe("GENERATION_INVARIANT_FAILED");
    // The generator itself refuses the same request rather than draw from it.
    expect(generateTallyDetective(request, { worksheetId: WORKSHEET_ID }).ok).toBe(false);
  });

  test("a tally is refused on another family's page", () => {
    const projected = projectGenerationRequest({
      selection: { ...baseSelection, worksheetType: "dry-math" },
      generatorVersion: 1,
      seed: "00000001",
    });
    if (!projected.ok) {
      throw new Error(projected.message);
    }
    const dryMath = generateDryMath(projected.request, { worksheetId: WORKSHEET_ID });
    if (!dryMath.ok) {
      throw new Error(dryMath.message);
    }
    expect(validateWorksheetInvariants(dryMath.document)).toBeUndefined();
    const items = dryMath.document.items.map((item, index) =>
      index === 0 ? tally(item.id, 1, 3) : item,
    );
    expect(validateWorksheetInvariants({ ...dryMath.document, items })?.code).toBe(
      "GENERATION_INVARIANT_FAILED",
    );
  });
});
