import type {
  OPERATION_GRID_OPERATIONS,
  OPERATION_GRID_PLACEMENTS,
  OPERATION_GRID_HEADER_ORDERS,
} from "../../shared/config/enums.js";
import {
  OPERATION_GRID_POWERS_BASE_MAXIMUM,
  OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
  OPERATION_GRID_SIZE_MAXIMUM,
  OPERATION_GRID_SIZE_MINIMUM,
  type OperationGridItemV1,
  type OperationGridOperation,
  type OperationGridPlacement,
  type OperationGridHeaderOrder,
  type PrintScale,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";

/*
 * Operation Grid: one fill-in table per page. Row headers run down the side
 * and column headers across the top, each from 1; every cell is its row
 * header combined with its column header by the chosen operation, a few cells
 * print pre-filled as anchors and the child completes the rest. A selection
 * the family cannot print is refused with the remedy that names only the
 * limit that binds; nothing is narrowed or widened.
 */

export const OPERATION_GRID_DEFINITION = {
  id: "operation-grid",
  displayName: "Operation Grid",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

/** The symbol the corner cell prints for each operation. */
export const OPERATION_GRID_SYMBOLS = {
  addition: "+",
  multiplication: "×",
  powers: "^",
} as const satisfies Record<(typeof OPERATION_GRID_OPERATIONS)[number], string>;

/** What a screen reader says for the corner symbol. */
export const OPERATION_GRID_SPOKEN_SYMBOLS = {
  addition: "plus",
  multiplication: "times",
  powers: "to the power of",
} as const satisfies Record<(typeof OPERATION_GRID_OPERATIONS)[number], string>;

/** The Operation radio group's labels, as the parent reads them. */
export const OPERATION_GRID_OPERATION_LABELS = {
  addition: "Addition x + y",
  multiplication: "Multiplication x × y",
  powers: "Powers x^y",
} as const satisfies Record<(typeof OPERATION_GRID_OPERATIONS)[number], string>;

/** The Placement radio group's labels. */
export const OPERATION_GRID_PLACEMENT_LABELS = {
  random: "Random",
  "diagonal-first": "Diagonal first",
} as const satisfies Record<(typeof OPERATION_GRID_PLACEMENTS)[number], string>;

export const OPERATION_GRID_HEADER_ORDER_LABELS = {
  "in-order": "In order",
  mixed: "Mixed up",
} as const satisfies Record<(typeof OPERATION_GRID_HEADER_ORDERS)[number], string>;

export const OPERATION_GRID_OPERATION_LEGEND = "Operation";
export const OPERATION_GRID_PLACEMENT_LEGEND = "Placement";
export const OPERATION_GRID_HEADER_ORDER_LEGEND = "Header order";
export const OPERATION_GRID_SIZE_LEGEND = "Grid size";
export const OPERATION_GRID_ROWS_LABEL = "Rows";
export const OPERATION_GRID_COLUMNS_LABEL = "Columns";
export const OPERATION_GRID_PREFILLED_LABEL = "Pre-filled cells";
export const OPERATION_GRID_PRESETS_LABEL = "Pre-filled cells presets";

/** The worksheet-type card's one line. */
export const OPERATION_GRID_CARD_DESCRIPTION =
  "Fill in a table from its row and column numbers, with a few cells given.";

/** The help under the size and pre-filled controls. */
export const OPERATION_GRID_SIZE_HELP = `Rows and columns each run from ${OPERATION_GRID_SIZE_MINIMUM} to ${OPERATION_GRID_SIZE_MAXIMUM}, and at least one cell always stays blank. Powers use the row number as the base and the column number as the exponent, so a powers grid has at most ${OPERATION_GRID_POWERS_EXPONENT_MAXIMUM} columns and ${OPERATION_GRID_POWERS_BASE_MAXIMUM} rows.`;

/** The help under the pre-filled presets. */
export const OPERATION_GRID_PRESET_HELP =
  "A preset only fills in the number of pre-filled cells, rounding down and keeping at least one blank. Diagonal also chooses Diagonal first.";

/** The page instruction under the title, one per operation. */
export const OPERATION_GRID_INSTRUCTIONS = {
  addition: "Fill in each empty box: add its row number and its column number.",
  multiplication: "Fill in each empty box: multiply its row number by its column number.",
  powers: "Fill in each empty box: raise its row number to the power of its column number.",
} as const satisfies Record<(typeof OPERATION_GRID_OPERATIONS)[number], string>;

/** The answer key's line under its heading. */
export const OPERATION_GRID_KEY_NOTE =
  "The completed grid. Pre-filled cells keep their heavy border.";

/**
 * The largest row or column count large print offers: a larger grid would not
 * fit one page without shrinking its cells below the handwriting size.
 */
export const OPERATION_GRID_LARGE_PRINT_SIZE_MAXIMUM = 10;

/** One cell's exact result: for powers, the row header raised to the column header. */
export function operationGridCellValue(
  operation: OperationGridOperation,
  rowHeader: number,
  columnHeader: number,
): number {
  switch (operation) {
    case "addition":
      return rowHeader + columnHeader;
    case "multiplication":
      return rowHeader * columnHeader;
    case "powers":
      return rowHeader ** columnHeader;
  }
}

/** The choices one refusal reads: the `operationGrid` group's fields. */
export interface OperationGridChoices {
  readonly operation: OperationGridOperation;
  readonly rows: number;
  readonly columns: number;
  readonly prefilled: number;
  readonly placement: OperationGridPlacement;
  readonly headerOrder?: OperationGridHeaderOrder;
}

/**
 * Why this grid cannot print, or `undefined` when it can. Each sentence
 * names only the limit that binds, and every binding limit gets its own
 * sentence: the pre-click control and the generator's fail-closed branch both
 * read this one function.
 */
export function operationGridRefusal(
  choices: OperationGridChoices,
  printScale: PrintScale,
): string | undefined {
  const { columns, operation, placement, prefilled, rows, headerOrder } = choices;
  const sentences: string[] = [];
  if (operation === "powers" && columns > OPERATION_GRID_POWERS_EXPONENT_MAXIMUM) {
    sentences.push(
      `Powers use exponents from 1 to ${OPERATION_GRID_POWERS_EXPONENT_MAXIMUM}, so a powers grid has at most ${OPERATION_GRID_POWERS_EXPONENT_MAXIMUM} columns. Choose ${OPERATION_GRID_POWERS_EXPONENT_MAXIMUM} or fewer columns.`,
    );
  }
  if (operation === "powers" && rows > OPERATION_GRID_POWERS_BASE_MAXIMUM) {
    sentences.push(
      `Powers use bases from 1 to ${OPERATION_GRID_POWERS_BASE_MAXIMUM}, so a powers grid has at most ${OPERATION_GRID_POWERS_BASE_MAXIMUM} rows. Choose ${OPERATION_GRID_POWERS_BASE_MAXIMUM} or fewer rows.`,
    );
  }
  if (printScale === "large") {
    const limit = OPERATION_GRID_LARGE_PRINT_SIZE_MAXIMUM;
    if (rows > limit) {
      sentences.push(
        `Large print fits at most ${limit} rows. Choose ${limit} or fewer rows, or Standard print scale under More options.`,
      );
    }
    if (columns > limit) {
      sentences.push(
        `Large print fits at most ${limit} columns. Choose ${limit} or fewer columns, or Standard print scale under More options.`,
      );
    }
  }
  const cells = rows * columns;
  if (prefilled > cells - 1) {
    sentences.push(
      `This grid has ${cells} cells and at least one must stay blank. Choose ${cells - 1} or fewer pre-filled cells.`,
    );
  }
  if (placement === "diagonal-first" && operation === "powers") {
    sentences.push("Diagonal first works with addition and multiplication grids. Choose Random placement.");
  } else if (placement === "diagonal-first" && rows !== columns) {
    sentences.push(
      "Diagonal first needs a square grid. Choose the same number of rows and columns, or Random placement.",
    );
  } else if (placement === "diagonal-first" && headerOrder === "mixed") {
    sentences.push("Diagonal first needs row and column numbers in order. Choose In order, or Random placement.");
  }
  return sentences.length === 0 ? undefined : sentences.join(" ");
}

/**
 * The Pre-filled cells presets: three densities of the whole grid, and the
 * diagonal, which also chooses Diagonal first.
 */
export const OPERATION_GRID_PREFILL_PRESETS = [
  { id: "nearly-blank", label: "Nearly blank (10%)", percent: 10 },
  { id: "half", label: "Half (50%)", percent: 50 },
  { id: "mostly-filled", label: "Mostly filled (75%)", percent: 75 },
  { id: "diagonal", label: "Diagonal", percent: undefined },
] as const;

export type OperationGridPrefillPresetId =
  (typeof OPERATION_GRID_PREFILL_PRESETS)[number]["id"];

/**
 * The count a preset writes into the Pre-filled cells input: its share of the
 * grid rounded down, or the diagonal's length, and never more than leaves one
 * blank cell.
 */
export function operationGridPresetCount(
  presetId: OperationGridPrefillPresetId,
  rows: number,
  columns: number,
): number {
  const cells = rows * columns;
  const preset = OPERATION_GRID_PREFILL_PRESETS.find(({ id }) => id === presetId);
  const wanted =
    preset?.percent === undefined
      ? Math.min(rows, columns)
      : Math.floor((cells * preset.percent) / 100);
  return Math.max(0, Math.min(wanted, cells - 1));
}

/**
 * What bounds an Operation Grid page's variety: the one grid is fixed by its
 * operation and size, so only which cells print pre-filled can change.
 */
export const OPERATION_GRID_LIMITING_RESOURCE_ADVICE =
  "Operation Grid varies only in which cells are pre-filled. Choose Random placement or a different number of pre-filled cells, or create a new worksheet later.";

export const OPERATION_GRID_MIXED_LIMITING_RESOURCE_ADVICE =
  "Operation Grid varies in its header order and in which cells are pre-filled. Choose Random placement or a different number of pre-filled cells, or create a new worksheet later.";

export function operationGridLimitingResourceAdvice(choices: OperationGridChoices): string {
  return choices.headerOrder === "mixed"
    ? OPERATION_GRID_MIXED_LIMITING_RESOURCE_ADVICE
    : OPERATION_GRID_LIMITING_RESOURCE_ADVICE;
}

export const OPERATION_GRID_MIXED_SUMMARY_PHRASE = ", row and column numbers mixed up";

/**
 * The one parent-facing summary of an Operation Grid choice, for example
 * "Multiplication x × y, 10 rows by 10 columns, 10 cells pre-filled, Random".
 */
export function describeOperationGrid(choices: OperationGridChoices): string {
  const cells = choices.prefilled === 1 ? "cell" : "cells";
  return `${OPERATION_GRID_OPERATION_LABELS[choices.operation]}, ${choices.rows} rows by ${choices.columns} columns, ${choices.prefilled} ${cells} pre-filled, ${OPERATION_GRID_PLACEMENT_LABELS[choices.placement]}${choices.headerOrder === "mixed" ? OPERATION_GRID_MIXED_SUMMARY_PHRASE : ""}`;
}

/**
 * A document's one grid, or `undefined` when it is not exactly one Operation
 * Grid: the renderer and the key refuse to draw anything else.
 */
export function operationGridItemOf(document: WorksheetDocumentV1): OperationGridItemV1 | undefined {
  const [item] = document.items;
  return document.worksheetType === "operation-grid" &&
    document.items.length === 1 &&
    item?.itemType === "operation-grid"
    ? item
    : undefined;
}
