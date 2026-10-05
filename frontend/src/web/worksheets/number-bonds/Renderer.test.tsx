// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";

import {
  judgeRenderedSentencesPage,
  oracleSolveMissing,
  parseRenderedSentence,
  type RenderedKeyLine,
  type RenderedRow,
} from "../../../../tests/oracles/arithmetic-oracle";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../../shared/config/defaults";
import type { WorksheetSelectionV2 } from "../../../shared/config/schema";
import { validateWorksheetInvariants } from "../../../shared/worksheet/invariants";
import { projectGenerationRequest } from "../../../shared/worksheet/project-request";
import {
  V1_NUMERIC_MAXIMUM,
  type GenerationRequestV1,
  type NumberBondItemV1,
  type WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import { generateNumberBonds } from "../../../worksheets/number-bonds/generator";
import { AnswerKeyView } from "../../print/AnswerKeyView";
import { NumberBondsRenderer } from "./Renderer";

afterEach(cleanup);

const WORKSHEET_ID = "33333333-3333-4333-8333-333333333333";

function bondsRequest(numberBonds: WorksheetSelectionV2["numberBonds"], seed: string): GenerationRequestV1 {
  const projected = projectGenerationRequest({
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "number-bonds",
      numberBonds,
      length: "long",
    },
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  return projected.request;
}

function generatedDocument(
  numberBonds: WorksheetSelectionV2["numberBonds"],
  seed: string,
): WorksheetDocumentV1<NumberBondItemV1> {
  const generated = generateNumberBonds(bondsRequest(numberBonds, seed), { worksheetId: WORKSHEET_ID });
  if (!generated.ok) {
    throw new Error(generated.message);
  }
  return generated.document;
}

/**
 * Each rendered worksheet row as its DOM tokens read: the visible text with
 * every drawn box read as `?`. Nothing is read from the document.
 */
function renderedRows(document: WorksheetDocumentV1): readonly RenderedRow[] {
  const { container } = render(createElement(NumberBondsRenderer, { document }));
  const rows = [...container.querySelectorAll<HTMLElement>("[data-item-id]")].map((row) => {
    const copy = row.cloneNode(true) as HTMLElement;
    for (const box of copy.querySelectorAll("[data-missing-box]")) {
      box.textContent = "?";
    }
    return {
      id: row.getAttribute("data-item-id") ?? "",
      text: (copy.textContent ?? "").replace(/\s+/gu, " ").trim(),
    };
  });
  cleanup();
  return rows;
}

/** Each rendered key line: its two data attributes and its visible text. */
function renderedKey(document: WorksheetDocumentV1): readonly RenderedKeyLine[] {
  const { container } = render(createElement(AnswerKeyView, { document }));
  const lines = [...container.querySelectorAll<HTMLElement>("[data-item-id]")].map((line) => ({
    id: line.getAttribute("data-item-id") ?? "",
    source: line.querySelector("[data-source-expression]")?.getAttribute("data-source-expression") ?? "",
    answer: line.querySelector("[data-answer-value]")?.getAttribute("data-answer-value") ?? "",
    text: (line.textContent ?? "").replace(/\s+/gu, " ").trim(),
  }));
  cleanup();
  return lines;
}

const WITHIN_20 = {
  operations: ["addition", "subtraction"],
  wholeMax: V1_NUMERIC_MAXIMUM,
  regrouping: "without",
} as const satisfies WorksheetSelectionV2["numberBonds"];

describe("the Number Bonds worksheet and key render one document", () => {
  test.each(["00000001", "5eed0026", "a1b2c3d4"])(
    "seed %s: each rendered row has exactly one solution, equal to the answer the key renders",
    (seed) => {
      const document = generatedDocument({ ...WITHIN_20, operations: [...WITHIN_20.operations] }, seed);
      const rows = renderedRows(document);
      const key = renderedKey(document);
      expect(rows).toHaveLength(document.items.length);
      for (const row of rows) {
        const parsed = parseRenderedSentence(row.text);
        expect(parsed, row.text).toBeDefined();
        const solutions = parsed === undefined ? [] : oracleSolveMissing(parsed);
        expect(solutions, row.text).toHaveLength(1);
        expect(key.find(({ id }) => id === row.id)?.answer, row.text).toBe(String(solutions[0]));
      }
      expect(judgeRenderedSentencesPage(rows, key, WITHIN_20)).toEqual([]);
    },
  );

  test("every item draws exactly one empty, labelled box and prints no ? on the worksheet", () => {
    const document = generatedDocument({ ...WITHIN_20, operations: [...WITHIN_20.operations] }, "00000001");
    const { container } = render(createElement(NumberBondsRenderer, { document }));
    const items = [...container.querySelectorAll("[data-item-id]")];
    expect(items).toHaveLength(18);
    for (const item of items) {
      const boxes = item.querySelectorAll("[data-missing-box]");
      expect(boxes).toHaveLength(1);
      expect(boxes[0]?.textContent).toBe("");
      expect(boxes[0]?.childNodes).toHaveLength(0);
      expect(boxes[0]).toHaveAttribute("aria-label", "missing number");
      expect(item.textContent).not.toContain("?");
      expect(item.querySelector("[data-operator]")?.textContent).toMatch(/^[+−]$/u);
    }
    expect(container.querySelector("h2")?.textContent).toBe("Number Bonds practice");
    expect(container.textContent).toContain("Write the missing number in each box.");
  });

  test("a row's spoken label names the missing number in its position", () => {
    const document = generatedDocument({ ...WITHIN_20, operations: [...WITHIN_20.operations] }, "00000001");
    const { container } = render(createElement(NumberBondsRenderer, { document }));
    for (const item of document.items) {
      const left = item.missing === "left" ? "missing number" : String(item.leftOperand);
      const right = item.missing === "right" ? "missing number" : String(item.rightOperand);
      const spoken = `${left} ${item.operation === "addition" ? "plus" : "minus"} ${right} equals ${item.result}`;
      expect(
        container.querySelector(`[data-item-id="${item.id}"] [data-number-bond-sentence]`),
      ).toHaveAttribute("aria-label", spoken);
    }
  });

  test("calibration: a key tampered by one, and a key that prints the completed sentence, fail the rendered judge", () => {
    const document = generatedDocument({ ...WITHIN_20, operations: [...WITHIN_20.operations] }, "00000001");
    const rows = renderedRows(document);
    const [first, ...rest] = document.items;
    if (first === undefined) {
      throw new Error("The document had no items.");
    }
    const tampered = renderedKey({
      ...document,
      items: [{ ...first, answer: { kind: "number", value: first.answer.value + 1 } }, ...rest],
    });
    expect(judgeRenderedSentencesPage(rows, tampered, WITHIN_20).map(({ code }) => code)).toContain(
      "KEY_MISMATCH",
    );
    const completed = renderedKey(document).map((line, index) =>
      index === 0 ? { ...line, source: line.source.replace("?", line.answer) } : line,
    );
    expect(judgeRenderedSentencesPage(rows, completed, WITHIN_20).map(({ code }) => code)).toEqual([
      "KEY_MISMATCH",
    ]);
  });

  test("mirrored sentences ? + 7 = 15 and 8 + ? = 15 print two different key lines", () => {
    const request = bondsRequest({ operations: ["addition"], wholeMax: V1_NUMERIC_MAXIMUM, regrouping: "included" }, "00000001");
    const sentence = (id: string, missing: "left" | "right"): NumberBondItemV1 => ({
      id,
      itemType: "number-bond",
      answerability: "objective",
      form: "sentence",
      operation: "addition",
      leftOperand: 8,
      rightOperand: 7,
      result: 15,
      renderedSymbol: "+",
      missing,
      answer: { kind: "number", value: missing === "left" ? 8 : 7 },
    });
    const document: WorksheetDocumentV1<NumberBondItemV1> = {
      schemaVersion: 1,
      worksheetType: "number-bonds",
      generatorVersion: 1,
      seed: request.seed,
      worksheetId: WORKSHEET_ID,
      request,
      items: [sentence("item-001", "left"), sentence("item-002", "right")],
    };
    expect(validateWorksheetInvariants(document)).toBeUndefined();
    const key = renderedKey(document);
    expect(key.map(({ text }) => text)).toEqual([
      "1. ? + 7 = 15 (missing number: 8)",
      "2. 8 + ? = 15 (missing number: 7)",
    ]);
    expect(key.map(({ source, answer }) => [source, answer])).toEqual([
      ["? + 7 = 15", "8"],
      ["8 + ? = 15", "7"],
    ]);
  });
});
