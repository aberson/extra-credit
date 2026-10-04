import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../src/shared/config/defaults.js";
import { REGROUPING_MODES } from "../../src/shared/config/enums.js";
import { PRACTICE_FOCUS_CATALOG } from "../../src/shared/config/practice-focus.js";
import type {
  ArithmeticFocusV2,
  RegroupingMode,
  WorksheetSelectionV2,
} from "../../src/shared/config/schema.js";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.js";
import type {
  DryMathItemV1,
  GenerationRequestV1,
  WorksheetDocumentV1,
} from "../../src/shared/worksheet/types.js";
import {
  enumerateDryMathCandidates,
  generateDryMath,
} from "../../src/worksheets/dry-math/generator.js";
import {
  ORACLE_FACT_DIVIDEND_MAXIMUM,
  ORACLE_FACT_FACTOR_MAXIMUM,
  columnAdd,
  columnSubtract,
  judgeDocument,
  judgeRenderedPage,
  oracleCandidateKeys,
  oracleDivide,
  oracleFactClosedForm,
  oracleFactKeys,
  oracleProduct,
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
