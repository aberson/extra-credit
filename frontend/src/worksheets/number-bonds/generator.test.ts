import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  columnAdd,
  judgeDocument,
  oracleNumberBondKeys,
} from "../../../tests/oracles/arithmetic-oracle.js";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults.js";
import type { WorksheetSelectionV2 } from "../../shared/config/schema.js";
import { recomputeObjectiveAnswer } from "../../shared/worksheet/answer-oracle.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  INACTIVE_MATH_FIELDS,
  INACTIVE_WRITING_CAPABILITIES,
  projectGenerationRequest,
} from "../../shared/worksheet/project-request.js";
import { formatSeedHex } from "../../shared/worksheet/seeded-random.js";
import {
  V1_NUMERIC_MAXIMUM,
  type GenerationRequestV1,
  type NumberBondItemV1,
} from "../../shared/worksheet/types.js";
import { getNumberBondsItemCount } from "./definition.js";
import {
  enumerateNumberBondsCandidates,
  generateNumberBonds,
  validateNumberBondsDocument,
  type NumberBondsDocumentV1,
} from "./generator.js";

type NumberBondsChoice = WorksheetSelectionV2["numberBonds"];

const WORKSHEET_ID = "11111111-1111-4111-8111-111111111111";

/** The projected request for one Number Bonds choice and layout. */
function bondsRequest(
  numberBonds: NumberBondsChoice,
  layout: Pick<WorksheetSelectionV2, "length" | "printScale"> = {
    length: "long",
    printScale: "standard",
  },
  seed = "00000001",
): GenerationRequestV1 {
  const projected = projectGenerationRequest({
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      ...layout,
      worksheetType: "number-bonds",
      numberBonds,
    },
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  return projected.request;
}

function generated(request: GenerationRequestV1): NumberBondsDocumentV1 {
  const result = generateNumberBonds(request, { worksheetId: WORKSHEET_ID });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.document;
}

/** One sentence as printed, its blank as `?`, then its answer. */
function printed(item: Pick<NumberBondItemV1, "leftOperand" | "rightOperand" | "result" | "missing" | "renderedSymbol">): string {
  const left = item.missing === "left" ? "?" : String(item.leftOperand);
  const right = item.missing === "right" ? "?" : String(item.rightOperand);
  return `${left} ${item.renderedSymbol} ${right} = ${item.result}`;
}

/** The oracle's key for a printed sentence: `addition:8:?:15`. */
function printedKey(item: NumberBondItemV1): string {
  const left = item.missing === "left" ? "?" : String(item.leftOperand);
  const right = item.missing === "right" ? "?" : String(item.rightOperand);
  return `${item.operation}:${left}:${right}:${item.result}`;
}

function rows(document: NumberBondsDocumentV1): readonly string[] {
  return document.items.map((item) => `${printed(item)} (${item.answer.value})`);
}

/** The relation's two parts: the addends, or the subtrahend and the result. */
function parts(item: NumberBondItemV1): readonly [number, number] {
  return item.operation === "addition"
    ? [item.leftOperand, item.rightOperand]
    : [item.rightOperand, item.result];
}

const WITHIN_20: NumberBondsChoice = {
  operations: ["addition", "subtraction"],
  wholeMax: V1_NUMERIC_MAXIMUM,
  regrouping: "without",
};

describe("Number Bonds candidates", () => {
  test("follow Appendix B.3's canonical order: operation, the relation, then the blank left before right", () => {
    const candidates = enumerateNumberBondsCandidates(
      bondsRequest({ operations: ["addition", "subtraction"], wholeMax: 3, regrouping: "included" }),
    );
    expect(candidates.map(printed)).toEqual([
      "? + 1 = 2", "1 + ? = 2",
      "? + 2 = 3", "1 + ? = 3", "? + 1 = 3", "2 + ? = 3",
      "? − 1 = 1", "2 − ? = 1",
      "? − 1 = 2", "3 − ? = 2", "? − 2 = 1", "3 − ? = 1",
    ]);
    // Each candidate keeps its whole relation and its answer is the blank number.
    for (const candidate of candidates) {
      expect(candidate.answer.value).toBe(
        candidate.missing === "left" ? candidate.leftOperand : candidate.rightOperand,
      );
    }
  });

  test("without carrying or borrowing leaves out exactly the problems whose parts regroup, in the same order", () => {
    const included = enumerateNumberBondsCandidates(bondsRequest({ ...WITHIN_20, regrouping: "included" }));
    const without = enumerateNumberBondsCandidates(bondsRequest(WITHIN_20));
    expect(without.map(printed)).toEqual(
      included
        .filter((candidate) => {
          const [first, second] = parts({ ...candidate, id: "item-001", itemType: "number-bond", answerability: "objective" });
          return !columnAdd(first, second).carried;
        })
        .map(printed),
    );
    expect(without).toHaveLength(508);
  });

  test("use the Dry Math budgets: 8, 12 and 18, and 8, 8 and 12 at large scale", () => {
    expect((["short", "standard", "long"] as const).map((length) => getNumberBondsItemCount(length, "standard")))
      .toEqual([8, 12, 18]);
    expect((["short", "standard", "long"] as const).map((length) => getNumberBondsItemCount(length, "large")))
      .toEqual([8, 8, 12]);
  });
});

describe("Number Bonds documents", () => {
  test.each([
    [
      { operations: ["addition"], wholeMax: 10, regrouping: "without" },
      "short",
      "standard",
      "00000001",
      ["? + 3 = 4 (1)", "3 + ? = 4 (1)", "? + 7 = 8 (1)", "7 + ? = 8 (1)", "1 + ? = 8 (7)", "8 + ? = 9 (1)", "1 + ? = 3 (2)", "1 + ? = 7 (6)"],
    ],
    [
      { operations: ["addition", "subtraction"], wholeMax: V1_NUMERIC_MAXIMUM, regrouping: "without" },
      "standard",
      "large",
      "9dcca8c5",
      ["? − 4 = 4 (8)", "? − 5 = 11 (16)", "16 − ? = 13 (3)", "5 − ? = 4 (1)", "11 − ? = 1 (10)", "6 + ? = 8 (2)", "? − 7 = 11 (18)", "15 − ? = 5 (10)"],
    ],
    [
      { operations: ["subtraction"], wholeMax: V1_NUMERIC_MAXIMUM, regrouping: "included" },
      "short",
      "standard",
      "2c6f5bd0",
      ["? − 18 = 2 (20)", "14 − ? = 12 (2)", "11 − ? = 2 (9)", "9 − ? = 6 (3)", "14 − ? = 3 (11)", "? − 2 = 4 (6)", "? − 1 = 9 (10)", "7 − ? = 2 (5)"],
    ],
  ] as const)("known vector: %j %s/%s seed %s", (choice, length, printScale, seed, expected) => {
    const document = generated(
      bondsRequest({ ...choice, operations: [...choice.operations] }, { length, printScale }, seed),
    );
    expect(rows(document)).toEqual(expected);
    expect(judgeDocument(document)).toEqual([]);
  });

  test("project the Number Bonds kind with every other capability inactive and no personalization beyond the nickname", () => {
    const request = bondsRequest(WITHIN_20);
    expect(request.practice).toEqual({
      kind: "number-bonds",
      variant: "sentence",
      operations: ["addition", "subtraction"],
      wholeMax: V1_NUMERIC_MAXIMUM,
      regrouping: "without",
    });
    expect(request.capabilities.mathSkills).toEqual(INACTIVE_MATH_FIELDS);
    expect(request.capabilities.presentationBand).toBe(INACTIVE_WRITING_CAPABILITIES.presentationBand);
    expect(request.capabilities.writingMode).toBe(INACTIVE_WRITING_CAPABILITIES.writingMode);
    expect(request).not.toHaveProperty("topicIds");
    expect(request.options.includeDecorativeGraphics).toBe(false);
    expect(request.options).not.toHaveProperty("decorativeTopicId");
  });

  test("a range too narrow for the length fails closed with the shared shortage sentence", () => {
    const result = generateNumberBonds(
      bondsRequest({ operations: ["addition"], wholeMax: 3, regrouping: "without" }, { length: "short", printScale: "standard" }),
      { worksheetId: WORKSHEET_ID },
    );
    expect(result).toEqual({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
      message:
        "This practice focus has 6 unique problems, but this length needs 8. Choose a practice focus with a wider range.",
    });
  });

  test("property: every document is judged clean, every number is at least 1, and without carrying or borrowing no relation regroups", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<NumberBondsChoice["operations"]>(["addition"], ["subtraction"], ["addition", "subtraction"]),
        fc.integer({ min: 5, max: V1_NUMERIC_MAXIMUM }),
        fc.constantFrom("without", "included"),
        fc.constantFrom("short", "standard", "long"),
        fc.constantFrom("standard", "large"),
        fc.integer({ min: 1, max: 0xffff_ffff }),
        (operations, wholeMax, regrouping, length, printScale, seedNumber) => {
          const document = generated(
            bondsRequest(
              { operations: [...operations], wholeMax, regrouping },
              { length, printScale },
              formatSeedHex(seedNumber),
            ),
          );
          expect(document.items).toHaveLength(getNumberBondsItemCount(length, printScale));
          expect(judgeDocument(document)).toEqual([]);
          const allowed = oracleNumberBondKeys({ operations, wholeMax, regrouping });
          for (const item of document.items) {
            expect(allowed.has(printedKey(item)), printed(item)).toBe(true);
            expect(Math.min(item.leftOperand, item.rightOperand, item.result)).toBeGreaterThanOrEqual(1);
            if (regrouping === "without") {
              const [first, second] = parts(item);
              expect(columnAdd(first, second).carried).toBe(false);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("mirror: including problems that carry or borrow within 20 changes the items for the same seed", () => {
    const layout = { length: "long", printScale: "standard" } as const;
    const without = generated(bondsRequest(WITHIN_20, layout, "00000001"));
    const included = generated(bondsRequest({ ...WITHIN_20, regrouping: "included" }, layout, "00000001"));
    expect(rows(included)).not.toEqual(rows(without));
    expect(judgeDocument(included)).toEqual([]);
    expect(
      included.items.some((item) => {
        const [first, second] = parts(item);
        return columnAdd(first, second).carried;
      }),
    ).toBe(true);
  });

  test("the answer dispatch recomputes every missing number from the numbers each sentence shows", () => {
    for (const item of generated(bondsRequest({ ...WITHIN_20, regrouping: "included" })).items) {
      expect(recomputeObjectiveAnswer(item)).toEqual(item.answer);
    }
  });
});

describe("the Number Bonds invariants", () => {
  const document = generated(bondsRequest(WITHIN_20));

  function withFirst(replace: (first: NumberBondItemV1) => NumberBondItemV1): NumberBondsDocumentV1 {
    const [first, ...rest] = document.items;
    if (first === undefined) {
      throw new Error("The document had no items.");
    }
    return { ...document, items: [replace(first), ...rest] };
  }

  function sentence(
    id: string,
    operation: "addition" | "subtraction",
    leftOperand: number,
    rightOperand: number,
    result: number,
    missing: "left" | "right" = "right",
  ): NumberBondItemV1 {
    return {
      id,
      itemType: "number-bond",
      answerability: "objective",
      form: "sentence",
      operation,
      leftOperand,
      rightOperand,
      result,
      renderedSymbol: operation === "addition" ? "+" : "−",
      missing,
      answer: { kind: "number", value: missing === "left" ? leftOperand : rightOperand },
    };
  }

  const failed = { ok: false, code: "GENERATION_INVARIANT_FAILED" } as const;

  test("a generated document passes", () => {
    expect(validateNumberBondsDocument(document)).toBeUndefined();
  });

  test.each([
    ["two blanks", (first: NumberBondItemV1) => ({ ...first, missing: "both" as unknown as "left" })],
    ["a zero number", (first: NumberBondItemV1) => sentence(first.id, "addition", 0, 5, 5)],
    ["a negative number", (first: NumberBondItemV1) => sentence(first.id, "subtraction", 3, 5, -2)],
    ["a part not below its whole", (first: NumberBondItemV1) => sentence(first.id, "addition", 9, 1, 9)],
    ["an answer that does not satisfy the sentence", (first: NumberBondItemV1) => ({
      ...first,
      answer: { kind: "number" as const, value: first.answer.value + 1 },
    })],
    ["a hidden number that is not the answer", (first: NumberBondItemV1) => ({
      ...first,
      ...(first.missing === "left"
        ? { leftOperand: first.leftOperand + 1 }
        : { rightOperand: first.rightOperand + 1 }),
    })],
    ["a whole above the requested range", (first: NumberBondItemV1) => sentence(first.id, "addition", 11, 10, 21)],
    ["the wrong symbol", (first: NumberBondItemV1): NumberBondItemV1 => ({
      ...first,
      renderedSymbol: first.renderedSymbol === "+" ? "−" : "+",
    })],
  ] as const)("%s fails", (_label, replace) => {
    expect(validateNumberBondsDocument(withFirst(replace))).toMatchObject(failed);
  });

  test("a duplicate fails", () => {
    const [first, second, ...rest] = document.items;
    if (first === undefined || second === undefined) {
      throw new Error("The document had too few items.");
    }
    expect(validateNumberBondsDocument({ ...document, items: [first, { ...first, id: second.id }, ...rest] }))
      .toMatchObject(failed);
  });

  test.each([
    ["a largest whole of 21", (request: GenerationRequestV1): GenerationRequestV1 => ({
      ...request,
      practice: { ...WITHIN_20, kind: "number-bonds", variant: "sentence", wholeMax: V1_NUMERIC_MAXIMUM + 1 },
    })],
    ["interest topics", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, topicIds: ["space"] })],
    ["a decorative topic", (request: GenerationRequestV1): GenerationRequestV1 => ({
      ...request,
      options: { ...request.options, decorativeTopicId: "space" },
    })],
    ["decoration", (request: GenerationRequestV1): GenerationRequestV1 => ({
      ...request,
      options: { ...request.options, includeDecorativeGraphics: true },
    })],
    ["number bond pictures, not yet accepted", (request: GenerationRequestV1): GenerationRequestV1 => ({
      ...request,
      practice: { ...WITHIN_20, kind: "number-bonds", variant: "bond" as unknown as "sentence" },
    })],
    ["no practice member", (request: GenerationRequestV1): GenerationRequestV1 => {
      const { practice: _unused, ...rest } = request;
      void _unused;
      return rest;
    }],
  ] as const)("a request with %s fails", (_label, edit) => {
    const request = bondsRequest(WITHIN_20);
    expect(generateNumberBonds(request, { worksheetId: WORKSHEET_ID }).ok).toBe(true);
    expect(generateNumberBonds(edit(request), { worksheetId: WORKSHEET_ID })).toMatchObject(failed);
  });

  test("a default page holding one problem whose relation regroups fails and the oracle names it, while the same page with such problems included passes", () => {
    const carrying = withFirst((first) => sentence(first.id, "addition", 8, 7, 15));
    expect(validateWorksheetInvariants(carrying)).toMatchObject(failed);
    expect(judgeDocument(carrying)).toEqual([{ itemId: "item-001", code: "REGROUPING_MISMATCH" }]);
    const included: NumberBondsDocumentV1 = {
      ...carrying,
      request: {
        ...carrying.request,
        practice: { ...WITHIN_20, kind: "number-bonds", variant: "sentence", regrouping: "included" },
      },
    };
    expect(validateWorksheetInvariants(included)).toBeUndefined();
    expect(judgeDocument(included)).toEqual([]);
  });

  test("another family refuses the Number Bonds practice member", () => {
    const projected = projectGenerationRequest({
      selection: { ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2), worksheetType: "dry-math" },
      generatorVersion: 1,
      seed: "00000001",
    });
    if (!projected.ok) {
      throw new Error(projected.message);
    }
    const dryMath = generateNumberBonds(projected.request, { worksheetId: WORKSHEET_ID });
    expect(dryMath).toMatchObject(failed);
    const result = validateWorksheetInvariants({
      ...document,
      worksheetType: "dry-math",
      request: { ...document.request, worksheetType: "dry-math" },
    });
    expect(result).toMatchObject(failed);
  });
});
