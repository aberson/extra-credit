// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";

import {
  judgeGridTable,
  type OracleGridFocus,
  type OracleGridTable,
} from "../../../../tests/oracles/arithmetic-oracle";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../../shared/config/defaults";
import type { OperationGridV2 } from "../../../shared/config/schema";
import { projectGenerationRequest } from "../../../shared/worksheet/project-request";
import type {
  OperationGridItemV1,
  WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import { generateOperationGrid } from "../../../worksheets/operation-grid/generator";
import { AnswerKeyView } from "../../print/AnswerKeyView";
import { OperationGridRenderer } from "./Renderer";

afterEach(cleanup);

const WORKSHEET_ID = "44444444-4444-4444-8444-444444444444";

function gridDocument(
  operationGrid: OperationGridV2,
  seed = "00000007",
  displayName?: string,
): WorksheetDocumentV1<OperationGridItemV1> {
  const projected = projectGenerationRequest({
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "operation-grid",
      operationGrid,
    },
    ...(displayName === undefined
      ? {}
      : { profile: { displayName, interests: [] } }),
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  const generated = generateOperationGrid(projected.request, { worksheetId: WORKSHEET_ID });
  if (!generated.ok) {
    throw new Error(generated.message);
  }
  return generated.document;
}

/**
 * The rendered table as its DOM reads: the corner, the header cells, every
 * body cell's visible number or `null` for an empty one, and which cells carry
 * the given mark. Nothing is read from the document.
 */
function readRenderedTable(root: HTMLElement): OracleGridTable {
  const table = root.querySelector("table");
  if (table === null) {
    throw new Error("No table rendered.");
  }
  const headRow = table.querySelector("thead tr");
  const number = (cell: Element) => {
    const text = (cell.textContent ?? "").trim();
    return text === "" ? null : Number(text);
  };
  const bodyRows = [...table.querySelectorAll("tbody tr")];
  return {
    corner: (headRow?.querySelector("td")?.textContent ?? "").trim(),
    columnHeaders: [...(headRow?.querySelectorAll("th") ?? [])].map((cell) => Number(cell.textContent)),
    rowHeaders: bodyRows.map((row) => Number(row.querySelector("th")?.textContent)),
    cells: bodyRows.map((row) => [...row.querySelectorAll("td")].map(number)),
    given: bodyRows.map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.hasAttribute("data-grid-given")),
    ),
  };
}

function focusOf(choices: OperationGridV2): OracleGridFocus {
  return choices;
}

const CASES: readonly OperationGridV2[] = [
  { operation: "addition", rows: 12, columns: 12, prefilled: 14, placement: "random", headerOrder: "in-order" },
  { operation: "multiplication", rows: 10, columns: 10, prefilled: 10, placement: "diagonal-first", headerOrder: "in-order" },
  { operation: "multiplication", rows: 4, columns: 7, prefilled: 20, placement: "random", headerOrder: "in-order" },
  { operation: "multiplication", rows: 10, columns: 10, prefilled: 10, placement: "random", headerOrder: "mixed" },
  { operation: "powers", rows: 10, columns: 3, prefilled: 4, placement: "random", headerOrder: "in-order" },
];

describe("Operation Grid renderer and key", () => {
  test.each(CASES)(
    "$operation $rows x $columns: headers, corner, blanks and given cells match the oracle on the page and in the key",
    (choices) => {
      const document = gridDocument(choices);
      const focus = focusOf(choices);
      const page = render(createElement(OperationGridRenderer, { document }));
      const worksheet = readRenderedTable(page.container);
      expect(worksheet.corner).toBe({ addition: "+", multiplication: "×", powers: "^" }[choices.operation]);
      expect(judgeGridTable(worksheet, focus, false)).toEqual([]);
      // Every blank is an empty box, and there is at least one.
      const blanks = [...page.container.querySelectorAll("[data-grid-blank]")];
      expect(blanks.length).toBe(choices.rows * choices.columns - choices.prefilled);
      expect(blanks.length).toBeGreaterThan(0);
      expect(blanks.every((cell) => cell.textContent === "" && cell.tagName === "TD")).toBe(true);
      page.unmount();

      const key = render(createElement(AnswerKeyView, { document }));
      const keyed = readRenderedTable(key.container);
      expect(judgeGridTable(keyed, focus, true)).toEqual([]);
      expect(keyed.cells.flat()).toEqual(
        keyed.rowHeaders.flatMap((row) =>
          keyed.columnHeaders.map((column) =>
            choices.operation === "addition"
              ? row + column
              : choices.operation === "multiplication"
                ? row * column
                : row ** column,
          ),
        ),
      );
      // The given cells are still the same cells, still marked.
      expect(keyed.given).toEqual(worksheet.given);
      expect(key.container.querySelectorAll("[data-grid-blank]")).toHaveLength(0);
      key.unmount();
    },
  );

  test("calibration: a rendered wrong cell or a filled blank fails the judge", () => {
    const choices = CASES[1]!;
    const document = gridDocument(choices);
    const item = document.items[0]!;
    const firstGiven = item.cells.findIndex((cell) => cell.given);
    const firstBlank = item.cells.findIndex((cell) => !cell.given);
    const wrongGiven = {
      ...document,
      items: [{ ...item, cells: item.cells.map((cell, index) => (index === firstGiven ? { ...cell, value: cell.value + 1 } : cell)) }],
    };
    const page = render(createElement(OperationGridRenderer, { document: wrongGiven }));
    expect(judgeGridTable(readRenderedTable(page.container), choices, false).map(({ code }) => code)).toContain("WRONG_CELL");
    page.unmount();
    const filledBlank = {
      ...document,
      items: [{ ...item, cells: item.cells.map((cell, index) => (index === firstBlank ? { ...cell, given: true } : cell)) }],
    };
    const filled = render(createElement(OperationGridRenderer, { document: filledBlank }));
    expect(judgeGridTable(readRenderedTable(filled.container), choices, false).map(({ code }) => code)).toContain(
      "GIVEN_COUNT_MISMATCH",
    );
  });

  test("the table is semantic: scoped headers, a named table and a spoken corner", () => {
    const document = gridDocument({ operation: "multiplication", rows: 3, columns: 4, prefilled: 2, placement: "random", headerOrder: "in-order" });
    render(createElement(OperationGridRenderer, { document }));
    const table = screen.getByRole("table", { name: "Multiplication x × y grid, 3 rows by 4 columns" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["1", "2", "3"]);
    expect(within(table).getAllByRole("columnheader").every((cell) => cell.getAttribute("scope") === "col")).toBe(true);
    expect(within(table).getAllByRole("rowheader").every((cell) => cell.getAttribute("scope") === "row")).toBe(true);
    expect(within(table).getByRole("cell", { name: "Operation: times" })).toHaveTextContent("×");
    expect(within(table).getAllByRole("cell", { name: "blank" })).toHaveLength(10);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Operation Grid practice");
    expect(
      screen.getByText("Fill in each empty box: multiply its row number by its column number."),
    ).toBeInTheDocument();
  });

  test("the nickname heads the page, and the key keeps its own heading", () => {
    const document = gridDocument(
      { operation: "addition", rows: 2, columns: 2, prefilled: 1, placement: "random", headerOrder: "in-order" },
      "00000001",
      "Fictional Gridder",
    );
    render(createElement(OperationGridRenderer, { document }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Fictional Gridder’s Operation Grid practice",
    );
    cleanup();
    render(createElement(AnswerKeyView, { document }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Parent answer key");
    expect(screen.getByRole("article", { name: "Parent answer key" })).toHaveTextContent(
      "The completed grid. Pre-filled cells keep their heavy border.",
    );
  });

  test("a document that is not one Operation Grid is refused rather than drawn", () => {
    const document = gridDocument({ operation: "addition", rows: 2, columns: 2, prefilled: 1, placement: "random", headerOrder: "in-order" });
    render(createElement(OperationGridRenderer, { document: { ...document, items: [...document.items, ...document.items] } }));
    expect(screen.getByRole("alert")).toHaveTextContent("This worksheet could not be rendered safely.");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
