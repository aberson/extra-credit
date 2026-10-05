import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../src/shared/config/defaults.js";
import {
  NUMBER_BONDS_REGROUPING_MODES,
  REGROUPING_MODES,
} from "../../src/shared/config/enums.js";
import { PRACTICE_FOCUS_CATALOG } from "../../src/shared/config/practice-focus.js";
import type {
  ArithmeticFocusV2,
  RegroupingMode,
  WorksheetSelectionV2,
} from "../../src/shared/config/schema.js";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.js";
import {
  V1_NUMERIC_MAXIMUM,
  type DryMathItemV1,
  type GenerationRequestV1,
  type NumberBondItemV1,
  type WorksheetDocumentV1,
} from "../../src/shared/worksheet/types.js";
import {
  enumerateDryMathCandidates,
  generateDryMath,
} from "../../src/worksheets/dry-math/generator.js";
import {
  enumerateNumberBondsCandidates,
  generateNumberBonds,
} from "../../src/worksheets/number-bonds/generator.js";
import {
  ORACLE_FACT_DIVIDEND_MAXIMUM,
  ORACLE_FACT_FACTOR_MAXIMUM,
  ORACLE_NUMBER_BONDS_CEILING,
  ORACLE_NUMBER_BONDS_WHOLE_MINIMUM,
  columnAdd,
  columnSubtract,
  judgeDocument,
  judgeRenderedPage,
  judgeRenderedSentencesPage,
  oracleCandidateKeys,
  oracleDivide,
  oracleFactClosedForm,
  oracleFactKeys,
  oracleNumberBondKeys,
  oracleProduct,
  oracleSolveMissing,
  type OracleCode,
  type RenderedKeyLine,
  type RenderedRow,
} from "../oracles/arithmetic-oracle.js";

const BASE: WorksheetSelectionV2 = worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2);

function dryMathRequest(
  focus: ArithmeticFocusV2,
  regrouping: RegroupingMode,
  seed = "00000001",
  length: WorksheetSelectionV2["length"] = "long",
): GenerationRequestV1 {
  const projection = projectGenerationRequest({
    selection: { ...BASE, worksheetType: "dry-math", dryMath: focus, dryMathRegrouping: regrouping, length },
    generatorVersion: 1,
    seed,
  });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  return projection.request;
}

function dryMathDocument(
  focus: ArithmeticFocusV2,
  regrouping: RegroupingMode,
): WorksheetDocumentV1<DryMathItemV1> {
  const generated = generateDryMath(dryMathRequest(focus, regrouping), {
    worksheetId: "11111111-1111-4111-8111-111111111111",
  });
  if (!generated.ok) {
    throw new Error(generated.message);
  }
  return generated.document;
}

function focusOf(id: string): ArithmeticFocusV2 {
  const option = PRACTICE_FOCUS_CATALOG["dry-math"].find((entry) => entry.id === id);
  if (option === undefined) {
    throw new Error(`No Dry Math catalog focus ${id}.`);
  }
  return option.focus;
}

function item(
  id: string,
  operation: DryMathItemV1["operation"],
  leftOperand: number,
  rightOperand: number,
  value: number,
  renderedSymbol: DryMathItemV1["renderedSymbol"] = operation === "addition" ? "+" : "−",
): DryMathItemV1 {
  return {
    id,
    itemType: "dry-math",
    answerability: "objective",
    operation,
    leftOperand,
    rightOperand,
    renderedSymbol,
    answer: { kind: "number", value },
  };
}

/** The document with its first item replaced. */
function withFirst(
  document: WorksheetDocumentV1<DryMathItemV1>,
  replace: (first: DryMathItemV1) => DryMathItemV1,
): WorksheetDocumentV1<DryMathItemV1> {
  const [first, ...rest] = document.items;
  if (first === undefined) {
    throw new Error("A calibration document had no items.");
  }
  return { ...document, items: [replace(first), ...rest] };
}

function codes(violations: readonly { readonly code: OracleCode }[]): readonly OracleCode[] {
  return violations.map(({ code }) => code);
}

describe("the oracle's own column arithmetic", () => {
  test("column addition and subtraction reproduce every sum and difference in 0..100", () => {
    for (let left = 0; left <= 100; left += 1) {
      for (let right = 0; right <= 100; right += 1) {
        expect(columnAdd(left, right).sum).toBe(left + right);
        if (left >= right) {
          expect(columnSubtract(left, right).difference).toBe(left - right);
        }
      }
    }
    expect(() => columnSubtract(3, 5)).toThrow(RangeError);
  });
});

describe("Appendix B.4 regrouping anchors", () => {
  const anchors = [
    ["addition-within-5", 21, 0],
    ["addition-and-subtraction-within-10", 114, 18],
    ["addition-within-20", 168, 63],
    ["subtraction-within-20", 168, 63],
    ["addition-and-subtraction-within-20", 336, 126],
    ["addition-and-subtraction-within-50", 1_662, 990],
    ["addition-and-subtraction-within-100", 6_054, 4_248],
  ] as const;

  test.each(anchors)("%s holds %i without and %i required", (id, without, required) => {
    const focus = focusOf(id);
    expect(oracleCandidateKeys({ ...focus, regrouping: "without" }).size).toBe(without);
    expect(oracleCandidateKeys({ ...focus, regrouping: "required" }).size).toBe(required);
  });

  test("the anchors cover the whole Dry Math catalog", () => {
    expect(PRACTICE_FOCUS_CATALOG["dry-math"].map(({ id }) => id).sort()).toEqual(
      anchors.map(([id]) => id).sort(),
    );
  });

  test("within 100 every required subtraction from 100 borrows: 99 of them", () => {
    const keys = oracleCandidateKeys({ ...focusOf("addition-and-subtraction-within-100"), regrouping: "required" });
    expect([...keys].filter((key) => key.startsWith("subtraction:100:"))).toHaveLength(99);
  });

  test("addition with operand and result maximum 1 holds 3 without and none required", () => {
    const focus = { operations: ["addition"], operandMax: 1, resultMax: 1 } as const;
    expect(oracleCandidateKeys({ ...focus, regrouping: "without" }).size).toBe(3);
    expect(oracleCandidateKeys({ ...focus, regrouping: "required" }).size).toBe(0);
  });
});

describe("the generator agrees with the oracle", () => {
  test.each(PRACTICE_FOCUS_CATALOG["dry-math"].flatMap((option) =>
    REGROUPING_MODES.map((regrouping) => [option.id, regrouping] as const),
  ))("%s %s: the generator's fact keys are the oracle's", (id, regrouping) => {
    const focus = focusOf(id);
    const generated = enumerateDryMathCandidates(dryMathRequest(focus, regrouping)).map(
      ({ operation, leftOperand, rightOperand }) => `${operation}:${leftOperand}:${rightOperand}`,
    );
    expect(new Set(generated).size).toBe(generated.length);
    expect(new Set(generated)).toEqual(oracleCandidateKeys({ ...focus, regrouping }));
  });
});

describe("Appendix B.5 judge calibration", () => {
  const within10 = focusOf("addition-and-subtraction-within-10");
  const within100 = focusOf("addition-and-subtraction-within-100");
  const additionWithin20 = focusOf("addition-within-20");

  test("a known-good document of each kind scores zero violations", () => {
    for (const regrouping of REGROUPING_MODES) {
      const document = dryMathDocument(within100, regrouping);
      expect(document.items.length).toBeGreaterThan(0);
      expect(judgeDocument(document), regrouping).toEqual([]);
    }
  });

  test("each known-garbage document scores exactly its one named code", () => {
    const without = dryMathDocument(within10, "without");
    const required = dryMathDocument(within100, "required");
    const additionOnly = dryMathDocument(additionWithin20, "without");
    const cases: readonly (readonly [OracleCode, WorksheetDocumentV1<DryMathItemV1>])[] = [
      ["WRONG_ANSWER", withFirst(required, (first) => ({
        ...first,
        answer: { kind: "number", value: first.answer.value + 1 },
      }))],
      ["DUPLICATE_FACT", {
        ...required,
        items: required.items.map((entry, index) => {
          const first = required.items[0];
          return index === 1 && first !== undefined ? { ...first, id: entry.id } : entry;
        }),
      }],
      ["OUT_OF_SET", withFirst(additionOnly, (first) => item(first.id, "subtraction", 5, 3, 2))],
      ["NEGATIVE", withFirst(without, (first) => item(first.id, "subtraction", 3, 5, -2))],
      ["OVER_CEILING", withFirst(required, (first) => item(first.id, "addition", 51, 50, 101))],
      ["REGROUPING_MISMATCH", withFirst(without, (first) => item(first.id, "addition", 5, 5, 10))],
      ["REGROUPING_MISMATCH", withFirst(required, (first) => item(first.id, "addition", 1, 2, 3))],
      ["SYMBOL_MISMATCH", withFirst(required, (first) => ({
        ...first,
        renderedSymbol: first.renderedSymbol === "+" ? "−" : "+",
      }))],
    ];
    for (const [code, document] of cases) {
      expect(codes(judgeDocument(document)), code).toEqual([code]);
    }
  });

  test("a rendered key is judged against the oracle's own solution of each rendered row", () => {
    const document = dryMathDocument(within100, "required");
    const rows: RenderedRow[] = document.items.map((entry) => ({
      id: entry.id,
      text: `${entry.leftOperand} ${entry.renderedSymbol} ${entry.rightOperand} = ____`,
    }));
    const keyLines: RenderedKeyLine[] = document.items.map((entry, index) => {
      const source = `${entry.leftOperand} ${entry.renderedSymbol} ${entry.rightOperand}`;
      const answer = String(entry.answer.value);
      return { id: entry.id, source, answer, text: `${index + 1}. ${source} = ${answer}` };
    });
    const focus = { ...within100, regrouping: "required" } as const;
    expect(judgeRenderedPage(rows, keyLines, focus)).toEqual([]);

    const [first, ...rest] = keyLines;
    if (first === undefined) {
      throw new Error("The calibration key had no lines.");
    }
    const offByOne = String(Number(first.answer) + 1);
    expect(codes(judgeRenderedPage(rows, [
      { ...first, answer: offByOne, text: `1. ${first.source} = ${offByOne}` },
      ...rest,
    ], focus))).toEqual(["KEY_MISMATCH"]);
    // A key line whose source restates the completed sentence is not the row.
    expect(codes(judgeRenderedPage(rows, [
      { ...first, source: `${first.source} = ${first.answer}` },
      ...rest,
    ], focus))).toEqual(["KEY_MISMATCH"]);
    // Mirror: the same rows judged as a page without carrying or borrowing
    // name every row, because every row regroups.
    expect(new Set(codes(judgeRenderedPage(rows, keyLines, { ...within100, regrouping: "without" }))))
      .toEqual(new Set(["REGROUPING_MISMATCH"]));
  });
});

describe("the oracle's own fact arithmetic", () => {
  test("repeated column addition and subtraction reproduce every product and quotient of the fact range", () => {
    for (let left = 0; left <= ORACLE_FACT_FACTOR_MAXIMUM; left += 1) {
      for (let right = 0; right <= ORACLE_FACT_FACTOR_MAXIMUM; right += 1) {
        expect(oracleProduct(left, right)).toBe(left * right);
      }
    }
    for (let dividend = 0; dividend <= ORACLE_FACT_DIVIDEND_MAXIMUM; dividend += 1) {
      for (let divisor = 1; divisor <= ORACLE_FACT_FACTOR_MAXIMUM; divisor += 1) {
        expect(oracleDivide(dividend, divisor)).toEqual({
          quotient: Math.floor(dividend / divisor),
          remainder: dividend % divisor,
        });
      }
    }
    expect(oracleDivide(5, 0)).toBeUndefined();
  });
});

describe("Appendix B.4 fact anchors", () => {
  const EVERY_FAMILY = Array.from({ length: ORACLE_FACT_FACTOR_MAXIMUM + 1 }, (_, family) => family);

  test.each([
    ["multiplication, one family", ["multiplication"], [7], 25],
    ["multiplication, all thirteen", ["multiplication"], EVERY_FAMILY, 169],
    ["division, family 0 only", ["division"], [0], 12],
    ["division, one family 1..12", ["division"], [7], 24],
    ["division, all thirteen", ["division"], EVERY_FAMILY, 156],
    ["multiplication {0, 1}", ["multiplication"], [0, 1], 48],
    ["division {0, 1}", ["division"], [0, 1], 35],
    ["both operations {0}", ["multiplication", "division"], [0], 37],
  ] as const)("%s holds %i facts by brute force and by the closed form", (_label, operations, families, count) => {
    expect(oracleFactKeys(operations, families).size).toBe(count);
    expect(oracleFactClosedForm(operations, families)).toBe(count);
  });

  test("every family from 1 to 12 alone holds 24 divisions, and the largest dividend is 144", () => {
    for (const family of EVERY_FAMILY.slice(1)) {
      expect(oracleFactKeys(["division"], [family]).size, String(family)).toBe(24);
      expect(oracleFactKeys(["multiplication"], [family]).size, String(family)).toBe(25);
    }
    const dividends = [...oracleFactKeys(["division"], EVERY_FAMILY)].map(
      (key) => Number(key.split(":")[1]),
    );
    expect(Math.max(...dividends)).toBe(144);
    expect(oracleFactKeys(["division"], [0])).toEqual(
      new Set(EVERY_FAMILY.slice(1).map((divisor) => `division:0:${divisor}`)),
    );
  });

  test("over every nonempty family set and operation choice the generator counts the closed form, whose minimum is 12", () => {
    const base = dryMathRequest(focusOf("addition-and-subtraction-within-10"), "without");
    const choices = [["multiplication"], ["division"], ["multiplication", "division"]] as const;
    let minimum = Number.POSITIVE_INFINITY;
    const disagreements: string[] = [];
    for (let mask = 1; mask < 2 ** EVERY_FAMILY.length; mask += 1) {
      const families = EVERY_FAMILY.filter((family) => (mask & (1 << family)) !== 0);
      for (const operations of choices) {
        const expected = oracleFactClosedForm(operations, families);
        const counted = enumerateDryMathCandidates({
          ...base,
          practice: { kind: "dry-math-facts", operations: [...operations], factFamilies: families },
        }).length;
        if (counted !== expected) {
          disagreements.push(`${operations.join("+")} {${families.join(",")}}: ${counted} != ${expected}`);
        }
        minimum = Math.min(minimum, expected);
      }
    }
    expect(disagreements).toEqual([]);
    expect(minimum).toBe(12);
  });
});

describe("Appendix B.5 judge calibration for facts", () => {
  const EVERY_FAMILY = Array.from({ length: ORACLE_FACT_FACTOR_MAXIMUM + 1 }, (_, family) => family);

  function factsDocument(
    operations: readonly ("multiplication" | "division")[],
    factFamilies: readonly number[],
  ): WorksheetDocumentV1<DryMathItemV1> {
    const projection = projectGenerationRequest({
      selection: {
        ...BASE,
        worksheetType: "dry-math",
        dryMathStrand: "multiply-divide",
        dryMathFacts: { operations: [...operations], factFamilies: [...factFamilies] },
        length: "long",
      },
      generatorVersion: 1,
      seed: "00000001",
    });
    if (!projection.ok) {
      throw new Error(projection.message);
    }
    const generated = generateDryMath(projection.request, {
      worksheetId: "11111111-1111-4111-8111-111111111111",
    });
    if (!generated.ok) {
      throw new Error(generated.message);
    }
    return generated.document;
  }

  test("a known-good multiplication page and a known-good division page score zero violations", () => {
    expect(judgeDocument(factsDocument(["multiplication"], [2, 5, 10]))).toEqual([]);
    expect(judgeDocument(factsDocument(["division"], [3, 7, 12]))).toEqual([]);
  });

  test("each known-garbage facts page scores exactly its one named code", () => {
    const multiplication = factsDocument(["multiplication"], [2, 5, 10]);
    const division = factsDocument(["division"], EVERY_FAMILY);
    const cases: readonly (readonly [OracleCode, WorksheetDocumentV1<DryMathItemV1>])[] = [
      ["WRONG_ANSWER", withFirst(multiplication, (first) => ({
        ...first,
        answer: { kind: "number", value: first.answer.value + 1 },
      }))],
      ["DUPLICATE_FACT", {
        ...multiplication,
        items: multiplication.items.map((entry, index) => {
          const first = multiplication.items[0];
          return index === 1 && first !== undefined ? { ...first, id: entry.id } : entry;
        }),
      }],
      ["OUT_OF_SET", withFirst(multiplication, (first) => item(first.id, "multiplication", 3, 4, 12, "×"))],
      ["OUT_OF_SET", withFirst(multiplication, (first) => item(first.id, "division", 10, 2, 5, "÷"))],
      ["NEGATIVE", withFirst(division, (first) => item(first.id, "division", -6, 3, -2, "÷"))],
      ["REMAINDER", withFirst(division, (first) => item(first.id, "division", 13, 4, 3, "÷"))],
      ["ZERO_DIVISOR", withFirst(division, (first) => item(first.id, "division", 0, 0, 0, "÷"))],
      ["OVER_CEILING", withFirst(multiplication, (first) => item(first.id, "multiplication", 13, 2, 26, "×"))],
      ["OVER_CEILING", withFirst(division, (first) => item(first.id, "division", 156, 12, 13, "÷"))],
      ["SYMBOL_MISMATCH", withFirst(division, (first) => ({ ...first, renderedSymbol: "×" }))],
    ];
    for (const [code, document] of cases) {
      expect(codes(judgeDocument(document)), code).toEqual([code]);
    }
  });

  test("a rendered facts page and key are judged against the oracle's own solution of each row", () => {
    const document = factsDocument(["multiplication", "division"], [3, 12]);
    const rows: RenderedRow[] = document.items.map((entry) => ({
      id: entry.id,
      text: `${entry.leftOperand} ${entry.renderedSymbol} ${entry.rightOperand} = ____`,
    }));
    const keyLines: RenderedKeyLine[] = document.items.map((entry, index) => {
      const source = `${entry.leftOperand} ${entry.renderedSymbol} ${entry.rightOperand}`;
      const answer = String(entry.answer.value);
      return { id: entry.id, source, answer, text: `${index + 1}. ${source} = ${answer}` };
    });
    const focus = { kind: "facts", operations: ["multiplication", "division"], families: [3, 12] } as const;
    expect(judgeRenderedPage(rows, keyLines, focus)).toEqual([]);
    const [first, ...rest] = keyLines;
    if (first === undefined) {
      throw new Error("The calibration key had no lines.");
    }
    const offByOne = String(Number(first.answer) + 1);
    expect(codes(judgeRenderedPage(rows, [
      { ...first, answer: offByOne, text: `1. ${first.source} = ${offByOne}` },
      ...rest,
    ], focus))).toEqual(["KEY_MISMATCH"]);
    // Mirror: judged as a multiplication-only page, exactly the division rows
    // are outside the set.
    const divisions = rows.filter(({ text }) => text.includes("÷"));
    expect(divisions.length).toBeGreaterThan(0);
    expect(judgeRenderedPage(rows, keyLines, { ...focus, operations: ["multiplication"] }))
      .toEqual(divisions.map(({ id }) => ({ itemId: id, code: "OUT_OF_SET" })));
  });
});

describe("Number Bonds missing number sentences (Appendix B.3 and B.4)", () => {
  const OPERATION_CHOICES = [["addition"], ["subtraction"], ["addition", "subtraction"]] as const;
  const WHOLE_MAXIMA = Array.from(
    { length: ORACLE_NUMBER_BONDS_CEILING - ORACLE_NUMBER_BONDS_WHOLE_MINIMUM + 1 },
    (_, index) => ORACLE_NUMBER_BONDS_WHOLE_MINIMUM + index,
  );

  function bondsRequest(
    numberBonds: WorksheetSelectionV2["numberBonds"],
    seed = "00000001",
    length: WorksheetSelectionV2["length"] = "long",
  ): GenerationRequestV1 {
    const projection = projectGenerationRequest({
      selection: { ...BASE, worksheetType: "number-bonds", numberBonds, length },
      generatorVersion: 1,
      seed,
    });
    if (!projection.ok) {
      throw new Error(projection.message);
    }
    return projection.request;
  }

  function bondsDocument(
    numberBonds: WorksheetSelectionV2["numberBonds"],
    seed = "00000001",
  ): WorksheetDocumentV1<NumberBondItemV1> {
    const generated = generateNumberBonds(bondsRequest(numberBonds, seed), {
      worksheetId: "11111111-1111-4111-8111-111111111111",
    });
    if (!generated.ok) {
      throw new Error(generated.message);
    }
    return generated.document;
  }

  /** A generated sentence as printed: its blank as `?`. */
  function printedKey(item: Pick<NumberBondItemV1, "operation" | "leftOperand" | "rightOperand" | "result" | "missing">): string {
    const left = item.missing === "left" ? "?" : String(item.leftOperand);
    const right = item.missing === "right" ? "?" : String(item.rightOperand);
    return `${item.operation}:${left}:${right}:${item.result}`;
  }

  test("the solver finds the one completing number of every sentence, and none or many where a sentence has no single blank", () => {
    expect(oracleSolveMissing({ symbol: "+", left: 8, right: null, result: 15 })).toEqual([7]);
    expect(oracleSolveMissing({ symbol: "+", left: null, right: 7, result: 15 })).toEqual([8]);
    expect(oracleSolveMissing({ symbol: "−", left: null, right: 3, result: 5 })).toEqual([8]);
    expect(oracleSolveMissing({ symbol: "−", left: 9, right: null, result: 4 })).toEqual([5]);
    expect(oracleSolveMissing({ symbol: "+", left: 8, right: 7, result: 15 })).toEqual([]);
    expect(oracleSolveMissing({ symbol: "+", left: null, right: null, result: 15 })).toHaveLength(16);
    // A blank that no number from 0 to 40 completes.
    expect(oracleSolveMissing({ symbol: "−", left: 3, right: null, result: 5 })).toEqual([]);
  });

  test.each([
    [2, 2],
    [3, 6],
    [4, 12],
    [5, 20],
    [10, 90],
    [20, 380],
  ] as const)("within %i one operation holds %i sentences with problems that carry or borrow included", (wholeMax, count) => {
    for (const operations of [["addition"], ["subtraction"]] as const) {
      expect(oracleNumberBondKeys({ operations, wholeMax, regrouping: "included" }).size).toBe(count);
    }
  });

  test("by default the pools are equal through 9, and 72 and 254 per operation at 10 and 20 (508 for both)", () => {
    for (const wholeMax of WHOLE_MAXIMA.filter((value) => value <= 9)) {
      for (const operations of OPERATION_CHOICES) {
        expect(oracleNumberBondKeys({ operations, wholeMax, regrouping: "without" }))
          .toEqual(oracleNumberBondKeys({ operations, wholeMax, regrouping: "included" }));
      }
    }
    for (const operations of [["addition"], ["subtraction"]] as const) {
      expect(oracleNumberBondKeys({ operations, wholeMax: 10, regrouping: "without" }).size).toBe(72);
      expect(oracleNumberBondKeys({ operations, wholeMax: 20, regrouping: "without" }).size).toBe(254);
    }
    const both = ["addition", "subtraction"] as const;
    expect(oracleNumberBondKeys({ operations: both, wholeMax: 20, regrouping: "without" }).size).toBe(508);
    expect(oracleNumberBondKeys({ operations: both, wholeMax: 20, regrouping: "included" }).size).toBe(760);
    // Make-ten and crossing-ten problems are exactly the ones left out.
    const without = oracleNumberBondKeys({ operations: ["addition"], wholeMax: 20, regrouping: "without" });
    expect(without.has("addition:3:?:10")).toBe(false);
    expect(without.has("addition:8:?:15")).toBe(false);
    expect(without.has("addition:10:?:19")).toBe(true);
  });

  test("for every largest whole, operation choice and carrying and borrowing choice the generator's problem-key set is the oracle's", () => {
    const disagreements: string[] = [];
    for (const operations of OPERATION_CHOICES) {
      for (const wholeMax of WHOLE_MAXIMA) {
        for (const regrouping of NUMBER_BONDS_REGROUPING_MODES) {
          const focus = { operations: [...operations], wholeMax, regrouping };
          const generated = enumerateNumberBondsCandidates(bondsRequest(focus)).map(printedKey);
          const expected = oracleNumberBondKeys(focus);
          if (new Set(generated).size !== generated.length || !setsEqual(new Set(generated), expected)) {
            disagreements.push(`${operations.join("+")} ${wholeMax} ${regrouping}`);
          }
          if (regrouping === "included") {
            expect(expected.size).toBe(operations.length * wholeMax * (wholeMax - 1));
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  test("every candidate has exactly one completing number from 0 to 40, equal to its answer, and every number lies from 1 to the largest whole", () => {
    for (const wholeMax of WHOLE_MAXIMA) {
      const candidates = enumerateNumberBondsCandidates(
        bondsRequest({ operations: ["addition", "subtraction"], wholeMax, regrouping: "included" }),
      );
      for (const candidate of candidates) {
        const solutions = oracleSolveMissing({
          symbol: candidate.renderedSymbol,
          left: candidate.missing === "left" ? null : candidate.leftOperand,
          right: candidate.missing === "right" ? null : candidate.rightOperand,
          result: candidate.result,
        });
        expect(solutions).toEqual([candidate.answer.value]);
        for (const value of [candidate.leftOperand, candidate.rightOperand, candidate.result]) {
          expect(value >= 1 && value <= wholeMax, `${wholeMax}: ${value}`).toBe(true);
        }
      }
    }
  });

  describe("Appendix B.5 judge calibration for sentences", () => {
    const within20 = {
      operations: ["addition", "subtraction"],
      wholeMax: V1_NUMERIC_MAXIMUM,
      regrouping: "without",
    } as const satisfies WorksheetSelectionV2["numberBonds"];
    const included20 = { ...within20, regrouping: "included" } as const;

    function withFirstSentence(
      document: WorksheetDocumentV1<NumberBondItemV1>,
      replace: (first: NumberBondItemV1) => NumberBondItemV1,
    ): WorksheetDocumentV1<NumberBondItemV1> {
      const [first, ...rest] = document.items;
      if (first === undefined) {
        throw new Error("A calibration document had no items.");
      }
      return { ...document, items: [replace(first), ...rest] };
    }

    function sentence(
      id: string,
      operation: "addition" | "subtraction",
      leftOperand: number,
      rightOperand: number,
      result: number,
      missing: "left" | "right",
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

    test("a known-good sentences page in each carrying and borrowing choice scores zero violations", () => {
      expect(judgeDocument(bondsDocument(within20))).toEqual([]);
      expect(judgeDocument(bondsDocument(included20))).toEqual([]);
    });

    test("each known-garbage sentences page scores exactly its one named code", () => {
      const without = bondsDocument(within20);
      const included = bondsDocument(included20);
      const cases: readonly (readonly [OracleCode, WorksheetDocumentV1<NumberBondItemV1>])[] = [
        ["WRONG_ANSWER", withFirstSentence(without, (first) => ({
          ...first,
          answer: { kind: "number", value: first.answer.value + 1 },
        }))],
        ["DUPLICATE_FACT", {
          ...without,
          items: without.items.map((entry, index) => {
            const first = without.items[0];
            return index === 1 && first !== undefined ? { ...first, id: entry.id } : entry;
          }),
        }],
        ["OUT_OF_SET", withFirstSentence(
          bondsDocument({ ...within20, operations: ["addition"] }),
          (first) => sentence(first.id, "subtraction", 9, 4, 5, "right"),
        )],
        ["BELOW_ONE", withFirstSentence(without, (first) => sentence(first.id, "addition", 0, 5, 5, "right"))],
        ["NOT_UNIQUE_SOLUTION", withFirstSentence(without, (first) => ({
          ...first,
          missing: "both" as unknown as "left",
        }))],
        ["OVER_CEILING", withFirstSentence(included, (first) => sentence(first.id, "addition", 11, 10, 21, "right"))],
        ["REGROUPING_MISMATCH", withFirstSentence(without, (first) => sentence(first.id, "addition", 8, 7, 15, "right"))],
      ];
      for (const [code, document] of cases) {
        expect(codes(judgeDocument(document)), code).toEqual([code]);
      }
      // Mirror: the same carrying problem is clean once such problems are included.
      expect(judgeDocument(withFirstSentence(included, (first) => sentence(first.id, "addition", 8, 7, 15, "right"))))
        .toEqual([]);
    });

    test("a rendered page and key are judged against the oracle's own solution of each row", () => {
      const document = bondsDocument(within20);
      const printed = (entry: NumberBondItemV1): string => {
        const left = entry.missing === "left" ? "?" : String(entry.leftOperand);
        const right = entry.missing === "right" ? "?" : String(entry.rightOperand);
        return `${left} ${entry.renderedSymbol} ${right} = ${entry.result}`;
      };
      const rows: RenderedRow[] = document.items.map((entry) => ({ id: entry.id, text: printed(entry) }));
      const keyLines: RenderedKeyLine[] = document.items.map((entry, index) => {
        const answer = String(entry.answer.value);
        return {
          id: entry.id,
          source: printed(entry),
          answer,
          text: `${index + 1}. ${printed(entry)} (missing number: ${answer})`,
        };
      });
      expect(judgeRenderedSentencesPage(rows, keyLines, within20)).toEqual([]);
      const [first, ...rest] = keyLines;
      if (first === undefined) {
        throw new Error("The calibration key had no lines.");
      }
      const offByOne = String(Number(first.answer) + 1);
      expect(codes(judgeRenderedSentencesPage(rows, [
        { ...first, answer: offByOne, text: `1. ${first.source} (missing number: ${offByOne})` },
        ...rest,
      ], within20))).toEqual(["KEY_MISMATCH"]);
      // A key line that prints the completed sentence does not show the blank.
      const completed = first.source.replace("?", first.answer);
      expect(codes(judgeRenderedSentencesPage(rows, [
        { ...first, source: completed, text: `1. ${completed} (missing number: ${first.answer})` },
        ...rest,
      ], within20))).toEqual(["KEY_MISMATCH"]);
    });
  });
});

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
