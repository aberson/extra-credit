import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  judgeOperationGridDocument,
  oracleGrid,
} from "../../../tests/oracles/arithmetic-oracle.js";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults.js";
import type { OperationGridV2, WorksheetSelectionV2 } from "../../shared/config/schema.js";
import { recomputeObjectiveAnswer } from "../../shared/worksheet/answer-oracle.js";
import { operationGridCellWithinCeiling } from "../../shared/worksheet/invariants.js";
import {
  INACTIVE_MATH_FIELDS,
  INACTIVE_WRITING_CAPABILITIES,
  projectGenerationRequest,
} from "../../shared/worksheet/project-request.js";
import { formatSeedHex } from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  OPERATION_GRID_POWERS_BASE_MAXIMUM,
  OPERATION_GRID_POWERS_CELL_MAXIMUM,
  OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
  OPERATION_GRID_SIZE_MAXIMUM,
  OPERATION_GRID_SIZE_MINIMUM,
  type GenerationRequestV1,
  type OperationGridItemV1,
  type PrintScale,
} from "../../shared/worksheet/types.js";
import {
  OPERATION_GRID_DEFINITION,
  operationGridPresetCount,
} from "./definition.js";
import {
  generateOperationGrid,
  validateOperationGridDocument,
  type OperationGridDocumentV1,
} from "./generator.js";

const WORKSHEET_ID = "11111111-1111-4111-8111-111111111111";

/** The projected request for one Operation Grid choice. */
function gridRequest(
  operationGrid: OperationGridV2,
  seed = "00000001",
  printScale: PrintScale = "standard",
): GenerationRequestV1 {
  const selection: WorksheetSelectionV2 = {
    ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
    worksheetType: "operation-grid",
    printScale,
    operationGrid,
  };
  const projected = projectGenerationRequest({
    selection,
    generatorVersion: OPERATION_GRID_DEFINITION.generatorVersion,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  return projected.request;
}

function generated(request: GenerationRequestV1): OperationGridDocumentV1 {
  const result = generateOperationGrid(request, { worksheetId: WORKSHEET_ID });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.document;
}

function gridOf(document: OperationGridDocumentV1): OperationGridItemV1 {
  const item = document.items[0];
  if (item === undefined) {
    throw new Error("A grid document holds one grid.");
  }
  return item;
}

/** The row-major indexes of the given cells. */
function givenIndexes(item: OperationGridItemV1): readonly number[] {
  return item.cells.flatMap((cell, index) => (cell.given ? [index] : []));
}

function grid(choices: Partial<OperationGridV2>): OperationGridV2 {
  return {
    operation: "multiplication",
    rows: 10,
    columns: 10,
    prefilled: 10,
    placement: "random",
    headerOrder: "in-order",
    ...choices,
  };
}

/** Every legal size of one operation. */
function legalSizes(operation: OperationGridV2["operation"]): readonly (readonly [number, number])[] {
  const rowMaximum = operation === "powers" ? OPERATION_GRID_POWERS_BASE_MAXIMUM : OPERATION_GRID_SIZE_MAXIMUM;
  const columnMaximum =
    operation === "powers" ? OPERATION_GRID_POWERS_EXPONENT_MAXIMUM : OPERATION_GRID_SIZE_MAXIMUM;
  const sizes: [number, number][] = [];
  for (let rows = OPERATION_GRID_SIZE_MINIMUM; rows <= rowMaximum; rows += 1) {
    for (let columns = OPERATION_GRID_SIZE_MINIMUM; columns <= columnMaximum; columns += 1) {
      sizes.push([rows, columns]);
    }
  }
  return sizes;
}

/** Mutates one copy of a document for a negative case. */
function mutated(
  document: OperationGridDocumentV1,
  edit: (item: { -readonly [K in keyof OperationGridItemV1]: OperationGridItemV1[K] }) => void,
): OperationGridDocumentV1 {
  const copy = JSON.parse(JSON.stringify(document)) as OperationGridDocumentV1;
  edit(copy.items[0] as { -readonly [K in keyof OperationGridItemV1]: OperationGridItemV1[K] });
  return copy;
}

describe("Operation Grid generator", () => {
  test.each(["addition", "multiplication", "powers"] as const)(
    "%s: for every legal size every cell equals the oracle, exactly prefilled cells are given and one is blank",
    (operation) => {
      let checked = 0;
      for (const [rows, columns] of legalSizes(operation)) {
        const cells = rows * columns;
        for (const prefilled of new Set([0, 1, Math.floor(cells / 2), cells - 1])) {
          const document = generated(gridRequest(grid({ operation, rows, columns, prefilled })));
          const item = gridOf(document);
          const where = `${operation} ${rows}x${columns} prefilled ${prefilled}`;
          expect(item.rowHeaders, where).toEqual(Array.from({ length: rows }, (_, index) => index + 1));
          expect(item.columnHeaders, where).toEqual(Array.from({ length: columns }, (_, index) => index + 1));
          expect(item.cells.map(({ value }) => value), where).toEqual(oracleGrid(operation, rows, columns).flat());
          expect(item.answer, where).toEqual({ kind: "grid", value: oracleGrid(operation, rows, columns).flat() });
          expect(givenIndexes(item), where).toHaveLength(prefilled);
          expect(item.cells.some((cell) => !cell.given), where).toBe(true);
          expect(judgeOperationGridDocument(document), where).toEqual([]);
          expect(validateOperationGridDocument(document), where).toBeUndefined();
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(operation === "powers" ? 60 : 400);
    },
  );

  test.each(["addition", "multiplication", "powers"] as const)(
    "%s: every legal size supports a non-ascending permutation on both axes",
    (operation) => {
      for (const [rows, columns] of legalSizes(operation)) {
        const document = generated(gridRequest(grid({
          operation, rows, columns, prefilled: 1, placement: "random", headerOrder: "mixed",
        })));
        const item = gridOf(document);
        expect([...item.rowHeaders].sort((left, right) => left - right)).toEqual(
          Array.from({ length: rows }, (_, index) => index + 1),
        );
        expect([...item.columnHeaders].sort((left, right) => left - right)).toEqual(
          Array.from({ length: columns }, (_, index) => index + 1),
        );
        expect(item.rowHeaders).not.toEqual(Array.from({ length: rows }, (_, index) => index + 1));
        expect(item.columnHeaders).not.toEqual(Array.from({ length: columns }, (_, index) => index + 1));
        expect(item.cells.map(({ value }) => value)).toEqual(item.rowHeaders.flatMap((row) =>
          item.columnHeaders.map((column) => operation === "addition" ? row + column : operation === "multiplication" ? row * column : row ** column)));
        expect(validateOperationGridDocument(document)).toBeUndefined();
      }
    },
  );

  test("mixing headers preserves the given indexes and recomputes cells from the printed axes", () => {
    const base = { operation: "multiplication" as const, rows: 10, columns: 10, prefilled: 17, placement: "random" as const };
    const inOrder = gridOf(generated(gridRequest(grid({ ...base, headerOrder: "in-order" }), "0000abcd")));
    const mixed = gridOf(generated(gridRequest(grid({ ...base, headerOrder: "mixed" }), "0000abcd")));
    expect(givenIndexes(mixed)).toEqual(givenIndexes(inOrder));
    expect(mixed.rowHeaders).not.toEqual(inOrder.rowHeaders);
    expect(mixed.columnHeaders).not.toEqual(inOrder.columnHeaders);
    expect(mixed.cells.map(({ value }) => value)).toEqual(mixed.rowHeaders.flatMap((row) =>
      mixed.columnHeaders.map((column) => row * column)));
  });

  test("property: every mixed-header document validates", () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 12 }),
      fc.integer({ min: 2, max: 12 }),
      fc.integer({ min: 1, max: 0xffff_ffff }),
      (rows, columns, seed) => {
        const document = generated(gridRequest(grid({
          operation: "multiplication", rows, columns, prefilled: 1,
          placement: "random", headerOrder: "mixed",
        }), formatSeedHex(seed)));
        expect(validateOperationGridDocument(document)).toBeUndefined();
        expect(judgeOperationGridDocument(document)).toEqual([]);
      },
    ), { numRuns: 200 });
  });

  test("pins one mixed-header vector", () => {
    const item = gridOf(generated(gridRequest(grid({
      rows: 3, columns: 4, prefilled: 3, headerOrder: "mixed",
    }), "00000001")));
    expect({ rows: item.rowHeaders, columns: item.columnHeaders, given: givenIndexes(item) }).toEqual({
      rows: [2, 1, 3], columns: [1, 2, 4, 3], given: [2, 3, 6],
    });
  });

  test("powers cells never exceed the powers bound, and the largest powers grid reaches it", () => {
    const item = gridOf(
      generated(
        gridRequest(
          grid({
            operation: "powers",
            rows: OPERATION_GRID_POWERS_BASE_MAXIMUM,
            columns: OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
            prefilled: 1,
          }),
        ),
      ),
    );
    const values = item.cells.map(({ value }) => value);
    expect(Math.max(...values)).toBe(OPERATION_GRID_POWERS_CELL_MAXIMUM);
    // Row 10 reads 10, 100, 1000: the base raised to each exponent.
    expect(values.slice(-3)).toEqual([10, 100, 1000]);
  });

  test("Diagonal first gives every diagonal cell before any other", () => {
    for (const operation of ["addition", "multiplication"] as const) {
      for (let size = OPERATION_GRID_SIZE_MINIMUM; size <= OPERATION_GRID_SIZE_MAXIMUM; size += 1) {
        for (const prefilled of new Set([1, size - 1, size, size + 1, size * size - 1])) {
          const item = gridOf(
            generated(
              gridRequest(
                grid({ operation, rows: size, columns: size, prefilled, placement: "diagonal-first" }),
                "0000abcd",
              ),
            ),
          );
          const given = givenIndexes(item);
          const diagonal = given.filter((index) => Math.floor(index / size) === index % size);
          const where = `${operation} ${size} prefilled ${prefilled}`;
          expect(given, where).toHaveLength(prefilled);
          // Up to the diagonal's length every given cell is on it; beyond it
          // the whole diagonal is given.
          expect(diagonal, where).toHaveLength(Math.min(prefilled, size));
        }
      }
    }
  });

  test("the Diagonal preset on a 10 x 10 grid prints exactly the diagonal, matching the reference shape", () => {
    const prefilled = operationGridPresetCount("diagonal", 10, 10);
    expect(prefilled).toBe(10);
    const item = gridOf(
      generated(gridRequest(grid({ prefilled, placement: "diagonal-first" }))),
    );
    expect(givenIndexes(item)).toEqual(Array.from({ length: 10 }, (_, index) => index * 11));
    expect(givenIndexes(item).map((index) => item.cells[index]?.value)).toEqual([
      1, 4, 9, 16, 25, 36, 49, 64, 81, 100,
    ]);
  });

  test("property: every document validates, and the same seed with the other placement changes the given set", () => {
    const legal = fc
      .record({
        operation: fc.constantFrom("addition" as const, "multiplication" as const),
        size: fc.integer({ min: 6, max: OPERATION_GRID_SIZE_MAXIMUM }),
        extra: fc.integer({ min: 0, max: 6 }),
        seed: fc.integer({ min: 1, max: 0xffff_ffff }),
      });
    fc.assert(
      fc.property(legal, ({ operation, size, extra, seed }) => {
        const seedHex = formatSeedHex(seed);
        const prefilled = size + extra;
        const choices = { operation, rows: size, columns: size, prefilled };
        const random = generated(gridRequest(grid({ ...choices, placement: "random" }), seedHex));
        const diagonal = generated(gridRequest(grid({ ...choices, placement: "diagonal-first" }), seedHex));
        for (const document of [random, diagonal]) {
          expect(validateOperationGridDocument(document)).toBeUndefined();
          expect(judgeOperationGridDocument(document)).toEqual([]);
          expect(recomputeObjectiveAnswer(gridOf(document))).toEqual(gridOf(document).answer);
        }
        expect(givenIndexes(gridOf(diagonal))).not.toEqual(givenIndexes(gridOf(random)));
        // The cells themselves never depend on the placement.
        expect(gridOf(diagonal).cells.map(({ value }) => value)).toEqual(
          gridOf(random).cells.map(({ value }) => value),
        );
      }),
      { numRuns: 200 },
    );
  });

  test("the same request always yields the same grid, and another seed moves only the given cells", () => {
    const request = gridRequest(grid({}), "00000001");
    expect(generated(request)).toEqual(generated(request));
    const other = gridOf(generated(gridRequest(grid({}), "00000002")));
    expect(givenIndexes(other)).not.toEqual(givenIndexes(gridOf(generated(request))));
    expect(other.cells.map(({ value }) => value)).toEqual(gridOf(generated(request)).cells.map(({ value }) => value));
  });

  test("known vectors pin a few pages", () => {
    const multiplication = gridOf(generated(gridRequest(grid({ rows: 3, columns: 4, prefilled: 3 }), "00000001")));
    expect(multiplication.cells.map(({ value }) => value)).toEqual([1, 2, 3, 4, 2, 4, 6, 8, 3, 6, 9, 12]);
    expect(givenIndexes(multiplication)).toEqual(KNOWN_GIVEN.multiplication);
    const addition = gridOf(
      generated(gridRequest(grid({ operation: "addition", rows: 2, columns: 3, prefilled: 2 }), "0000beef")),
    );
    expect(addition.cells.map(({ value }) => value)).toEqual([2, 3, 4, 3, 4, 5]);
    expect(givenIndexes(addition)).toEqual(KNOWN_GIVEN.addition);
    const powers = gridOf(
      generated(gridRequest(grid({ operation: "powers", rows: 4, columns: 3, prefilled: 4 }), "12345678")),
    );
    expect(powers.cells.map(({ value }) => value)).toEqual([1, 1, 1, 2, 4, 8, 3, 9, 27, 4, 16, 64]);
    expect(givenIndexes(powers)).toEqual(KNOWN_GIVEN.powers);
    const diagonal = gridOf(
      generated(
        gridRequest(grid({ rows: 4, columns: 4, prefilled: 6, placement: "diagonal-first" }), "00000001"),
      ),
    );
    expect(givenIndexes(diagonal)).toEqual(KNOWN_GIVEN.diagonal);
  });

  test("its request carries no decoration, interests or math focus, and one grid per page", () => {
    const document = generated(gridRequest(grid({})));
    expect(document.request.capabilities).toEqual({
      ...INACTIVE_WRITING_CAPABILITIES,
      mathSkills: INACTIVE_MATH_FIELDS,
    });
    expect(document.request.options.includeDecorativeGraphics).toBe(false);
    expect(document.request.options.length).toBe("standard");
    expect(document.items).toHaveLength(1);
    expect(document.items[0]?.id).toBe("item-001");
  });
});

/** The given cells the known-vector pages pin, row-major indexes. */
const KNOWN_GIVEN = {
  multiplication: [2, 3, 6],
  addition: [4, 5],
  powers: [1, 6, 9, 11],
  diagonal: [0, 1, 5, 9, 10, 15],
};

describe("Operation Grid negatives", () => {
  const base = () => generated(gridRequest(grid({ rows: 4, columns: 4, prefilled: 5 })));

  test("rejects repeated, out-of-range, or ascending mixed headers and an explicit in-order request member", () => {
    const mixed = generated(gridRequest(grid({ rows: 4, columns: 4, prefilled: 5, headerOrder: "mixed" })));
    for (const headers of [[1, 1, 3, 4], [1, 2, 3, 5], [1, 2, 3, 4]] as const) {
      const wrong = mutated(mixed, (item) => { item.rowHeaders = [...headers]; });
      expect(validateOperationGridDocument(wrong)?.code).toBe(GENERATION_INVARIANT_FAILED);
    }
    const request = gridRequest(grid({ headerOrder: "in-order" }));
    const noncanonical = {
      ...request,
      practice: { ...(request.practice as object), headerOrder: "in-order" },
    } as unknown as GenerationRequestV1;
    expect(generateOperationGrid(noncanonical, { worksheetId: WORKSHEET_ID })).toMatchObject({
      ok: false, code: GENERATION_INVARIANT_FAILED,
    });
  });

  test("a wrong cell value fails with GENERATION_INVARIANT_FAILED", () => {
    const wrong = mutated(base(), (item) => {
      item.cells = item.cells.map((cell, index) => (index === 5 ? { ...cell, value: cell.value + 1 } : cell));
    });
    expect(validateOperationGridDocument(wrong)?.code).toBe(GENERATION_INVARIANT_FAILED);
    // Mirror: the oracle flags the same cell.
    expect(judgeOperationGridDocument(wrong).some(({ code }) => code === "WRONG_CELL")).toBe(true);
    // A wrong stored answer fails too, even with every cell right.
    const wrongAnswer = mutated(base(), (item) => {
      item.answer = { kind: "grid", value: item.answer.value.map((value, index) => (index === 0 ? value + 1 : value)) };
    });
    expect(validateOperationGridDocument(wrongAnswer)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message:
        "An Operation Grid violated its operation, header, cell value, cell ceiling, answer, pre-filled count, or diagonal invariants.",
    });
    expect(judgeOperationGridDocument(wrongAnswer).map(({ code }) => code)).toContain("KEY_MISMATCH");
    // A wrong cell whose stored answer agrees with it is refused by recomputing
    // the grid from its headers inside the shared invariants.
    const agreeing = mutated(base(), (item) => {
      item.cells = item.cells.map((cell, index) => (index === 5 ? { ...cell, value: cell.value + 1 } : cell));
      item.answer = { kind: "grid", value: item.cells.map(({ value }) => value) };
    });
    expect(validateOperationGridDocument(agreeing)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message:
        "An Operation Grid violated its operation, header, cell value, cell ceiling, answer, pre-filled count, or diagonal invariants.",
    });
    expect(judgeOperationGridDocument(agreeing).some(({ code }) => code === "WRONG_CELL")).toBe(true);
  });

  test("a given count that differs from prefilled fails", () => {
    for (const change of [-1, 1]) {
      const document = base();
      const target = change > 0
        ? gridOf(document).cells.findIndex((cell) => !cell.given)
        : gridOf(document).cells.findIndex((cell) => cell.given);
      const wrong = mutated(document, (item) => {
        item.cells = item.cells.map((cell, index) => (index === target ? { ...cell, given: !cell.given } : cell));
      });
      expect(validateOperationGridDocument(wrong)?.code).toBe(GENERATION_INVARIANT_FAILED);
      expect(judgeOperationGridDocument(wrong).map(({ code }) => code)).toContain("GIVEN_COUNT_MISMATCH");
    }
  });

  test("zero blanks fails at the request guard, which owns at least one blank", () => {
    // The only violation: every cell given, with the request asking for exactly
    // that many, so the given count matches `prefilled` and every cell is right.
    const full = mutated(base(), (item) => {
      item.cells = item.cells.map((cell) => ({ ...cell, given: true }));
    });
    const asked = {
      ...full,
      request: { ...full.request, practice: { ...(full.request.practice as object), prefilled: 16 } },
    } as OperationGridDocumentV1;
    expect(validateOperationGridDocument(asked)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request carried a practice choice this worksheet family does not accept.",
    });
    expect(judgeOperationGridDocument(asked).map(({ code }) => code)).toContain("NO_BLANK");
    // Mirror: one fewer given cell and pre-filled cell is a valid document.
    const oneBlank = mutated(base(), (item) => {
      item.cells = item.cells.map((cell, index) => ({ ...cell, given: index !== 7 }));
    });
    const oneBlankAsked = {
      ...oneBlank,
      request: { ...oneBlank.request, practice: { ...(oneBlank.request.practice as object), prefilled: 15 } },
    } as OperationGridDocumentV1;
    expect(validateOperationGridDocument(oneBlankAsked)).toBeUndefined();
    // And the generator refuses the zero-blank request by name.
    expect(generateOperationGrid(asked.request, { worksheetId: WORKSHEET_ID })).toEqual({
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "This grid has 16 cells and at least one must stay blank. Choose 15 or fewer pre-filled cells.",
    });
  });

  test("the powers cell ceiling refuses only a powers value above 1,000", () => {
    expect(operationGridCellWithinCeiling("powers", OPERATION_GRID_POWERS_CELL_MAXIMUM)).toBe(true);
    expect(operationGridCellWithinCeiling("powers", OPERATION_GRID_POWERS_CELL_MAXIMUM + 1)).toBe(false);
    expect(operationGridCellWithinCeiling("multiplication", OPERATION_GRID_POWERS_CELL_MAXIMUM + 1)).toBe(true);
    expect(operationGridCellWithinCeiling("addition", OPERATION_GRID_POWERS_CELL_MAXIMUM + 1)).toBe(true);
  });

  test("a powers cell above 1,000 fails", () => {
    const document = generated(gridRequest(grid({ operation: "powers", rows: 10, columns: 3, prefilled: 2 })));
    // With valid 1..10 headers, a cell and its answer entry raised to 1,001 fails.
    // (Such a cell is also not its headers' power, so recomputation refuses it too.)
    const raised = mutated(document, (item) => {
      item.cells = item.cells.map((cell, index) =>
        index === 29 ? { ...cell, value: OPERATION_GRID_POWERS_CELL_MAXIMUM + 1 } : cell,
      );
      item.answer = { kind: "grid", value: item.cells.map(({ value }) => value) };
    });
    expect(validateOperationGridDocument(raised)?.code).toBe(GENERATION_INVARIANT_FAILED);
    expect(judgeOperationGridDocument(raised).map(({ code }) => code)).toContain("OVER_CEILING");
    // An 11-row powers document whose cells are its headers' exact powers is
    // refused by the request guard's base bound.
    const elevenRows = {
      ...mutated(document, (item) => {
        item.rowHeaders = [...item.rowHeaders, 11];
        const cells = item.rowHeaders.flatMap((row) =>
          item.columnHeaders.map((column) => ({ value: row ** column, given: false })),
        );
        item.cells = cells.map((cell, index) => ({ ...cell, given: index < 2 }));
        item.answer = { kind: "grid", value: item.cells.map(({ value }) => value) };
      }),
    };
    const elevenRowsAsked = {
      ...elevenRows,
      request: { ...elevenRows.request, practice: { ...(elevenRows.request.practice as object), rows: 11 } },
    } as OperationGridDocumentV1;
    expect(validateOperationGridDocument(elevenRowsAsked)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request carried a practice choice this worksheet family does not accept.",
    });
    expect(judgeOperationGridDocument(elevenRowsAsked).map(({ code }) => code)).toContain("OVER_CEILING");
    // An 11-row powers request is refused by name before any cell is made.
    const refused = generateOperationGrid(elevenRowsAsked.request, { worksheetId: WORKSHEET_ID });
    expect(refused).toEqual({
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "Powers use bases from 1 to 10, so a powers grid has at most 10 rows. Choose 10 or fewer rows.",
    });
  });

  test("a diagonal request on a non-square or powers grid is refused by name, and such a document fails", () => {
    const nonSquare = generateOperationGrid(gridRequest(grid({ rows: 4, columns: 5, prefilled: 4, placement: "diagonal-first" })), {
      worksheetId: WORKSHEET_ID,
    });
    expect(nonSquare).toEqual({
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "Diagonal first needs a square grid. Choose the same number of rows and columns, or Random placement.",
    });
    const powers = generateOperationGrid(
      gridRequest(grid({ operation: "powers", rows: 3, columns: 3, prefilled: 3, placement: "diagonal-first" })),
      { worksheetId: WORKSHEET_ID },
    );
    expect(powers).toEqual({
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "Diagonal first works with addition and multiplication grids. Choose Random placement.",
    });
    const mixed = generateOperationGrid(
      gridRequest(grid({ rows: 4, columns: 4, prefilled: 4, placement: "diagonal-first", headerOrder: "mixed" })),
      { worksheetId: WORKSHEET_ID },
    );
    expect(mixed).toEqual({
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: "Diagonal first needs row and column numbers in order. Choose In order, or Random placement.",
    });
    const mixedRandom = generated(gridRequest(grid({
      rows: 4,
      columns: 4,
      prefilled: 4,
      headerOrder: "mixed",
    })));
    const mixedClaimed = {
      ...mixedRandom,
      request: {
        ...mixedRandom.request,
        practice: { ...(mixedRandom.request.practice as object), placement: "diagonal-first" },
      },
    } as OperationGridDocumentV1;
    expect(validateOperationGridDocument(mixedClaimed)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request carried a practice choice this worksheet family does not accept.",
    });
    expect(validateOperationGridDocument(mixedRandom)).toBeUndefined();
    // A document claiming Diagonal first on a non-square grid fails the invariants.
    const random = generated(gridRequest(grid({ rows: 4, columns: 5, prefilled: 4 })));
    const claimed = {
      ...random,
      request: { ...random.request, practice: { ...(random.request.practice as object), placement: "diagonal-first" } },
    } as OperationGridDocumentV1;
    expect(validateOperationGridDocument(claimed)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request carried a practice choice this worksheet family does not accept.",
    });
    // Mirror: the same document under its true Random placement passes.
    expect(validateOperationGridDocument(random)).toBeUndefined();
    // A powers document whose given cells are exactly its diagonal satisfies the
    // diagonal order, so only the request guard refuses its Diagonal first claim.
    const powersRandom = mutated(
      generated(gridRequest(grid({ operation: "powers", rows: 3, columns: 3, prefilled: 3 }))),
      (item) => {
        item.cells = item.cells.map((cell, index) => ({ ...cell, given: index % 4 === 0 }));
      },
    );
    expect(validateOperationGridDocument(powersRandom)).toBeUndefined();
    const powersClaimed = {
      ...powersRandom,
      request: {
        ...powersRandom.request,
        practice: { ...(powersRandom.request.practice as object), placement: "diagonal-first" },
      },
    } as OperationGridDocumentV1;
    expect(validateOperationGridDocument(powersClaimed)).toEqual({
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request carried a practice choice this worksheet family does not accept.",
    });
  });

  test("Diagonal first with an off-diagonal cell before the whole diagonal fails", () => {
    const document = generated(gridRequest(grid({ rows: 4, columns: 4, prefilled: 5, placement: "diagonal-first" })));
    // Take one diagonal cell back and give one more off-diagonal cell instead.
    const extra = gridOf(document).cells.findIndex(
      (cell, index) => !cell.given && Math.floor(index / 4) !== index % 4,
    );
    const swapped = mutated(document, (item) => {
      item.cells = item.cells.map((cell, index) =>
        index === 0 || index === extra ? { ...cell, given: !cell.given } : cell,
      );
    });
    const given = givenIndexes(gridOf(swapped));
    expect(given).toHaveLength(5);
    expect(validateOperationGridDocument(swapped)?.code).toBe(GENERATION_INVARIANT_FAILED);
    expect(judgeOperationGridDocument(swapped).map(({ code }) => code)).toContain("DIAGONAL_ORDER");
  });

  test("a request for another family, version or member is refused as an invariant failure", () => {
    const request = gridRequest(grid({}));
    for (const wrong of [
      { ...request, worksheetType: "number-bonds" },
      { ...request, generatorVersion: 2 },
      { ...request, practice: undefined },
    ] as GenerationRequestV1[]) {
      const result = generateOperationGrid(wrong, { worksheetId: WORKSHEET_ID });
      expect(result.ok ? undefined : result.code).toBe(GENERATION_INVARIANT_FAILED);
    }
  });
});
