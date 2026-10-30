import { objectiveAnswerMatches } from "../../shared/worksheet/answer-oracle.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type OperationGridItemV1,
  type PracticeRequestV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import {
  OPERATION_GRID_DEFINITION,
  operationGridCellValue,
  operationGridRefusal,
} from "./definition.js";

/*
 * Operation Grid (master plan Step 34): one table per document. Every cell is
 * computed from its two headers; the seeded stream decides which cells print
 * pre-filled and, when requested, the mixed header order. Random placement picks all of them by seed. Diagonal first
 * gives the `i = j` cells first, picking among them by seed when fewer than
 * the diagonal are asked for, and then seeded extras off the diagonal.
 */

type OperationGridPractice = Extract<PracticeRequestV1, { readonly kind: "operation-grid" }>;

export type OperationGridDocumentV1 = WorksheetDocumentV1<OperationGridItemV1>;

/** The Operation Grid member this request carries, or `undefined` when it carries none. */
function operationGridPractice(request: GenerationRequestV1): OperationGridPractice | undefined {
  return request.practice?.kind === "operation-grid" ? request.practice : undefined;
}

/** `count` consecutive headers beginning at `start`. */
function headersFrom(start: number, count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => start + index);
}

/**
 * The row-major indexes of the cells that print pre-filled, as a set. The
 * seed is the only source of variation; the operation and size never move it.
 */
export function chooseGivenCells(
  practice: OperationGridPractice,
  random: Pick<ReturnType<typeof createSeededRandom>, "nextBounded">,
): ReadonlySet<number> {
  const { columns, placement, prefilled, rows } = practice;
  const indexes = Array.from({ length: rows * columns }, (_, index) => index);
  if (placement === "random") {
    return new Set(seededShuffle(indexes, random).slice(0, prefilled));
  }
  const isDiagonal = (index: number) => Math.floor(index / columns) === index % columns;
  const diagonal = seededShuffle(indexes.filter(isDiagonal), random);
  const others = seededShuffle(
    indexes.filter((index) => !isDiagonal(index)),
    random,
  );
  return new Set([...diagonal, ...others].slice(0, prefilled));
}

function mixedHeaders(
  ascending: readonly number[],
  random: Pick<ReturnType<typeof createSeededRandom>, "nextBounded">,
): readonly number[] {
  const shuffled = [...seededShuffle(ascending, random)];
  if (shuffled.every((value, index) => value === ascending[index])) {
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  }
  return shuffled;
}

/**
 * The family's own check of a finished document: the shared invariants, whose
 * Operation Grid rules and family guard refuse a wrong cell, a wrong given
 * count, a grid with no blank, a powers cell above its bound and a diagonal
 * placement on a grid that cannot have one, then a local recomputation of the
 * completed grid from its headers.
 */
export function validateOperationGridDocument(
  document: OperationGridDocumentV1,
): ReturnType<typeof validateWorksheetInvariants> {
  const invariantFailure = validateWorksheetInvariants(document);
  if (invariantFailure !== undefined) {
    return invariantFailure;
  }
  if (document.items.some((item) => objectiveAnswerMatches(item) !== true)) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "A generated Operation Grid failed local recomputation.",
    };
  }
  return undefined;
}

export function generateOperationGrid(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<OperationGridDocumentV1> {
  const practice = operationGridPractice(request);
  if (
    request.worksheetType !== OPERATION_GRID_DEFINITION.id ||
    request.generatorVersion !== OPERATION_GRID_DEFINITION.generatorVersion ||
    practice === undefined
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request does not match the registered Operation Grid generator.",
    };
  }

  const refusal = operationGridRefusal(practice, request.options.printScale);
  if (refusal !== undefined) {
    return { ok: false, code: GENERATION_CONSTRAINT_CONFLICT, message: refusal };
  }

  const random = createSeededRandom(request.seed);
  const given = chooseGivenCells(practice, random);
  const ascendingRows = headersFrom(practice.rowStart ?? 1, practice.rows);
  const ascendingColumns = headersFrom(practice.columnStart ?? 1, practice.columns);
  const rowHeaders = practice.headerOrder === "mixed"
    ? mixedHeaders(ascendingRows, random)
    : ascendingRows;
  const columnHeaders = practice.headerOrder === "mixed"
    ? mixedHeaders(ascendingColumns, random)
    : ascendingColumns;
  const values = rowHeaders.flatMap((row) =>
    columnHeaders.map((column) => operationGridCellValue(practice.operation, row, column)),
  );
  const item: OperationGridItemV1 = {
    id: "item-001",
    itemType: "operation-grid",
    answerability: "objective",
    operation: practice.operation,
    rowHeaders,
    columnHeaders,
    cells: values.map((value, index) => ({ value, given: given.has(index) })),
    answer: { kind: "grid", value: values },
  };
  const document: OperationGridDocumentV1 = {
    schemaVersion: 1,
    worksheetType: OPERATION_GRID_DEFINITION.id,
    generatorVersion: OPERATION_GRID_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items: [item],
  };
  const failure = validateOperationGridDocument(document);
  return failure === undefined ? { ok: true, document } : failure;
}
