import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import { DRY_MATH_STRANDS, WORKSHEET_LENGTHS, PRINT_SCALES } from "../../shared/config/enums";
import type {
  ChildProfileV2,
  DryMathStrand,
  WorksheetSelectionV2,
} from "../../shared/config/schema";
import {
  FACT_FACTOR_MAXIMUM,
  DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM,
  DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM,
  DRY_MATH_TWO_DIGIT_MAXIMUM,
  DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM,
  DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM,
  type OperationGridItemV1,
  WORKSHEET_TYPE_IDS,
  type WorksheetType,
} from "../../shared/worksheet/types";
import { createInitialWorksheetSession, type SeedSource } from "../generator/create-session";
import { EMPTY_PACKET, PACKET_SHEET_LIMIT, packetReducer } from "./packet-session";
import {
  RANDOM_PACKET_FOCUS,
  RANDOM_PACKET_LEVELS,
  RANDOM_PACKET_LEVEL_LABELS,
  makeRandomPacket,
  randomPacketMessage,
  type RandomPacketLevel,
} from "./random-packet";

/* Every child here is fictional. */
const PROFILE: ChildProfileV2 = {
  id: "c5000000-0000-4000-8000-000000000001",
  displayName: "Fictional Robin",
  reviewedOn: "2026-09-01",
  interests: [],
};

const BASE: WorksheetSelectionV2 = worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2);

/** A deterministic xorshift32 source that never returns zero. */
function source(seed: number): SeedSource {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

function make(
  families: readonly WorksheetType[],
  pages: number,
  level: RandomPacketLevel,
  seed = 7,
  selection: WorksheetSelectionV2 = BASE,
) {
  return makeRandomPacket({ families, pages, level, profile: PROFILE, selection }, source(seed));
}

type FocusScore =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "facts"; readonly value: number }
  | { readonly kind: "writing" }
  | { readonly kind: "not-scored" };

/** Exhaustively scores the claim each candidate contributes to its level label. */
function largestNumber(selection: WorksheetSelectionV2): FocusScore {
  switch (selection.worksheetType) {
    case "dry-math": {
      const strand: DryMathStrand = selection.dryMathStrand;
      switch (strand) {
        case "add-subtract":
          return { kind: "number", value: selection.dryMath.resultMax };
        case "multiply-divide":
          return {
            kind: "facts",
            value: Math.max(...selection.dryMathFacts.factFamilies) * FACT_FACTOR_MAXIMUM,
          };
        case "three-digit":
          return { kind: "number", value: DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM };
        case "multi-digit":
          return {
            kind: "number",
            value: selection.dryMathMultiDigit.operations.includes("division")
              ? DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM
              : DRY_MATH_TWO_DIGIT_MAXIMUM * DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM,
          };
        case "remainders":
          return { kind: "number", value: DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM };
        default: {
          const unreachable: never = strand;
          return unreachable;
        }
      }
    }
    case "find-the-wow":
      return {
        kind: "number",
        value:
          selection.findTheWow.variant === "equation"
            ? selection.findTheWow.equation.resultMax
            : selection.findTheWow.quantity.countingMax,
      };
    case "sentence-builder":
      return { kind: "writing" };
    case "count-compare-make":
      return { kind: "number", value: selection.countCompareMake.compareMax };
    case "number-bonds":
      return { kind: "number", value: selection.numberBonds.wholeMax };
    case "operation-grid": {
      const { columns, operation, rows } = selection.operationGrid;
      switch (operation) {
        case "addition":
          return { kind: "number", value: rows + columns };
        case "multiplication":
          return { kind: "number", value: rows * columns };
        case "powers":
          return { kind: "number", value: rows ** columns };
        default: {
          const unreachable: never = operation;
          return unreachable;
        }
      }
    }
    case "clock-explorer":
    case "tally-detective":
      return { kind: "not-scored" };
    default: {
      const unreachable: never = selection.worksheetType;
      return unreachable;
    }
  }
}

function candidateSelections(family: WorksheetType, level: RandomPacketLevel, selection = BASE) {
  return RANDOM_PACKET_FOCUS[family][level].map((choose) => ({
    ...choose(selection),
    worksheetType: family,
  }));
}

const challengeSelections = {
  "dry-math": [
    {
      ...BASE,
      worksheetType: "dry-math",
      dryMathStrand: "add-subtract",
      dryMath: { operations: ["addition", "subtraction"], operandMax: 100, resultMax: 100 },
      dryMathRegrouping: "required",
    },
    {
      ...BASE,
      worksheetType: "dry-math",
      dryMathStrand: "multiply-divide",
      dryMathFacts: {
        operations: ["multiplication", "division"],
        factFamilies: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
    },
  ],
  "find-the-wow": [
    {
      ...BASE,
      worksheetType: "find-the-wow",
      findTheWow: {
        ...BASE.findTheWow,
        variant: "equation",
        equation: { operations: ["addition", "subtraction"], operandMax: 20, resultMax: 20 },
      },
    },
    {
      ...BASE,
      worksheetType: "find-the-wow",
      findTheWow: {
        ...BASE.findTheWow,
        variant: "equation",
        equation: { operations: ["addition"], operandMax: 20, resultMax: 20 },
      },
    },
    {
      ...BASE,
      worksheetType: "find-the-wow",
      findTheWow: {
        ...BASE.findTheWow,
        variant: "equation",
        equation: { operations: ["subtraction"], operandMax: 20, resultMax: 20 },
      },
    },
  ],
  "sentence-builder": [
    { ...BASE, worksheetType: "sentence-builder", sentenceBuilder: { variant: "independent", vocabulary: "all-words" } },
  ],
  "count-compare-make": [
    {
      ...BASE,
      worksheetType: "count-compare-make",
      countCompareMake: { countingMax: 20, numeralMax: 20, compareMax: 20 },
    },
  ],
  "number-bonds": [
    {
      ...BASE,
      worksheetType: "number-bonds",
      numberBonds: { operations: ["addition", "subtraction"], wholeMax: 20, regrouping: "included" },
    },
    {
      ...BASE,
      worksheetType: "number-bonds",
      numberBonds: { operations: ["subtraction"], wholeMax: 20, regrouping: "included" },
    },
  ],
  "operation-grid": [
    {
      ...BASE,
      worksheetType: "operation-grid",
      operationGrid: {
        ...BASE.operationGrid,
        rows: 12,
        columns: 12,
        prefilled: 14,
      },
    },
    {
      ...BASE,
      worksheetType: "operation-grid",
      operationGrid: {
        ...BASE.operationGrid,
        prefilled: 0,
      },
    },
  ],
  "clock-explorer": [{ ...BASE, worksheetType: "clock-explorer" }],
  "tally-detective": [{ ...BASE, worksheetType: "tally-detective" }],
} as const satisfies Record<WorksheetType, readonly WorksheetSelectionV2[]>;

const expertSelections = {
  ...challengeSelections,
  "dry-math": [
    challengeSelections["dry-math"][0],
    {
      ...BASE,
      worksheetType: "dry-math",
      dryMathStrand: "multiply-divide",
      dryMathFacts: {
        operations: ["multiplication", "division"],
        factFamilies: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
    },
  ],
  "operation-grid": [
    {
      ...BASE,
      worksheetType: "operation-grid",
      operationGrid: {
        ...BASE.operationGrid,
        operation: "powers",
        columns: 3,
      },
    },
    challengeSelections["operation-grid"][1],
  ],
} as const satisfies Record<WorksheetType, readonly WorksheetSelectionV2[]>;

describe("the difficulty table", () => {
  test.each(WORKSHEET_TYPE_IDS.flatMap((family) => RANDOM_PACKET_LEVELS.map((level) => [family, level] as const)))(
    "every %s candidate at %s makes a sheet at every length in standard print",
    (family, level) => {
      for (const length of WORKSHEET_LENGTHS) {
        for (const selection of candidateSelections(family, level, { ...BASE, length })) {
          const created = createInitialWorksheetSession({ profile: PROFILE, selection }, source(3));
          expect(created.ok, JSON.stringify(created)).toBe(true);
        }
      }
    },
  );

  test("large print refuses exactly the two named 12 by 12 grids and every family keeps a candidate", () => {
    const refused: string[] = [];
    for (const family of WORKSHEET_TYPE_IDS) {
      for (const level of RANDOM_PACKET_LEVELS) {
        for (const length of WORKSHEET_LENGTHS) {
          const outcomes = candidateSelections(family, level, { ...BASE, length, printScale: "large" }).map(
            (selection) => ({
              selection,
              created: createInitialWorksheetSession({ profile: PROFILE, selection }, source(3)),
            }),
          );
          expect(outcomes.some(({ created }) => created.ok), `${family}/${level}/${length}`).toBe(true);
          for (const { selection, created } of outcomes) {
            if (!created.ok) {
              refused.push(
                `${level} ${selection.operationGrid.operation} ${selection.operationGrid.rows}x${selection.operationGrid.columns}`,
              );
              expect(created.message).toContain("Large print fits at most 10 rows");
            }
          }
        }
      }
    }
    expect(new Set(refused)).toEqual(
      new Set(["harder addition 12x12", "challenge multiplication 12x12"]),
    );
  });

  test.each(
    WORKSHEET_LENGTHS.flatMap((length) => PRINT_SCALES.map((printScale) => [length, printScale] as const)),
  )("every family and level makes a packet sheet at %s length and %s print", (length, printScale) => {
    for (const level of RANDOM_PACKET_LEVELS) {
      const result = make(WORKSHEET_TYPE_IDS, WORKSHEET_TYPE_IDS.length, level, 11, {
        ...BASE,
        length,
        printScale,
      });
      expect(result.ok && result.leftOut).toEqual([]);
      expect(result.ok && result.sheets.length).toBe(WORKSHEET_TYPE_IDS.length);
    }
  });

  test("the level ceilings are exact, strictly rising, and hints name facts exactly when present", () => {
    const maxima: number[] = [];
    for (const level of RANDOM_PACKET_LEVELS) {
      const scores = WORKSHEET_TYPE_IDS.flatMap((family) =>
        candidateSelections(family, level).map(largestNumber),
      );
      const maximum = Math.max(
        ...scores.filter((score) => score.kind === "number").map((score) => score.value),
      );
      maxima.push(maximum);
      expect(maximum).toBe(RANDOM_PACKET_LEVEL_LABELS[level].ceiling);
      expect(RANDOM_PACKET_LEVEL_LABELS[level].hint.includes("times tables")).toBe(
        scores.some((score) => score.kind === "facts"),
      );
    }
    expect(maxima.every((value, index) => index === 0 || value > (maxima[index - 1] ?? value))).toBe(true);
  });

  test("only Clock Explorer and Tally Detective are not scored", () => {
    const families = WORKSHEET_TYPE_IDS.filter((family) =>
      RANDOM_PACKET_LEVELS.some((level) =>
        candidateSelections(family, level).some((selection) => largestNumber(selection).kind === "not-scored"),
      ),
    );
    expect(families).toEqual(["clock-explorer", "tally-detective"]);
  });

  test("Challenge and Expert apply every recipe exactly and in order", () => {
    const choices = (family: WorksheetType, level: RandomPacketLevel) => candidateSelections(family, level);
    for (const family of WORKSHEET_TYPE_IDS) {
      expect(choices(family, "challenge"), `${family}/challenge`).toEqual(challengeSelections[family]);
      expect(choices(family, "expert"), `${family}/expert`).toEqual(expertSelections[family]);
    }

    // These equality pins are intentional product rules, not consequences of
    // the literal recipe assertions above.
    for (const family of ["dry-math", "operation-grid", "sentence-builder"] as const) {
      expect(choices(family, "challenge")).not.toEqual(choices(family, "harder"));
    }
    for (const family of ["find-the-wow", "count-compare-make", "number-bonds"] as const) {
      expect(choices(family, "challenge")).toEqual(choices(family, "harder"));
      expect(choices(family, "expert")).toEqual(choices(family, "harder"));
    }
    expect(choices("dry-math", "expert")).not.toEqual(choices("dry-math", "challenge"));
    expect(choices("operation-grid", "expert")).not.toEqual(choices("operation-grid", "challenge"));
    expect(choices("sentence-builder", "expert")).toEqual(choices("sentence-builder", "challenge"));
  });
});

describe("defaults-first packet focus", () => {
  const PARENT: WorksheetSelectionV2 = {
    ...BASE,
    worksheetType: "operation-grid",
    dryMath: { operations: ["subtraction"], operandMax: 73, resultMax: 91 },
    dryMathRegrouping: "required",
    dryMathStrand: "multiply-divide",
    dryMathFacts: { operations: ["division"], factFamilies: [0, 1, 11, 12] },
    numberBonds: { operations: ["subtraction"], wholeMax: 19, regrouping: "included" },
    operationGrid: {
      ...BASE.operationGrid,
      operation: "powers",
      rows: 9,
      columns: 3,
      prefilled: 3,
      placement: "diagonal-first",
    },
    findTheWow: {
      variant: "equation",
      quantity: { countingMax: 19, numeralMax: 18 },
      equation: { operations: ["subtraction"], operandMax: 17, resultMax: 16 },
    },
    sentenceBuilder: { variant: "copy-with-model", vocabulary: "all-words" },
    countCompareMake: { countingMax: 19, numeralMax: 18, compareMax: 17 },
    theme: "neutral",
    useDisplayName: false,
    useInterests: false,
    includeDecorativeGraphics: false,
    includeAnswerKey: false,
    length: "long",
    paperSize: "a4",
    printScale: "large",
  };

  const kept = (selection: WorksheetSelectionV2) => ({
    theme: selection.theme,
    useDisplayName: selection.useDisplayName,
    useInterests: selection.useInterests,
    includeDecorativeGraphics: selection.includeDecorativeGraphics,
    includeAnswerKey: selection.includeAnswerKey,
    length: selection.length,
    paperSize: selection.paperSize,
    printScale: selection.printScale,
  });

  test("no saved family choice leaks and every kept choice does", () => {
    const before = structuredClone(PARENT);
    for (const family of WORKSHEET_TYPE_IDS) {
      for (const level of RANDOM_PACKET_LEVELS) {
        for (const choose of RANDOM_PACKET_FOCUS[family][level]) {
          const chosen = choose(PARENT);
          expect({ ...chosen, ...kept(BASE) }).toEqual(choose(BASE));
          expect(kept(chosen)).toEqual(kept(PARENT));
        }
      }
    }
    expect(PARENT).toEqual(before);
  });

  test("every saved Dry Math strand is ignored until a level recipe explicitly deals it", () => {
    for (const strand of DRY_MATH_STRANDS) {
      const parent: WorksheetSelectionV2 = { ...PARENT, dryMathStrand: strand };
      const before = structuredClone(parent);
      for (const level of RANDOM_PACKET_LEVELS) {
        const extreme = make(["dry-math"], PACKET_SHEET_LIMIT, level, 0x4152, parent);
        const baseline = make(
          ["dry-math"],
          PACKET_SHEET_LIMIT,
          level,
          0x4152,
          { ...parent, dryMathStrand: DEFAULT_WORKSHEET_DEFAULTS_V2.dryMathStrand },
        );
        expect(extreme.ok, `${strand}/${level}`).toBe(true);
        expect(baseline.ok, `baseline/${level}`).toBe(true);
        if (!extreme.ok || !baseline.ok) continue;
        expect(extreme.sheets.map(({ selection }) => selection.dryMathStrand)).toEqual(
          baseline.sheets.map(({ selection }) => selection.dryMathStrand),
        );
        expect(extreme.sheets.every(({ selection }) =>
          selection.dryMathStrand === "add-subtract" ||
          selection.dryMathStrand === "multiply-divide",
        )).toBe(true);
      }
      expect(parent).toEqual(before);
    }
  });
});

describe("makeRandomPacket", () => {
  test("makes the pages asked for, only from the ticked families, each family once before any repeats", () => {
    const families = ["dry-math", "number-bonds", "clock-explorer"] as const;
    const result = make(families, 7, "harder");
    if (!result.ok) {
      throw new Error(result.message);
    }
    const types = result.sheets.map(({ document }) => document.worksheetType);
    expect(types).toHaveLength(7);
    expect(new Set(types.slice(0, 3))).toEqual(new Set(families));
    expect(new Set(types.slice(3, 6))).toEqual(new Set(families));
    expect(types.every((type) => (families as readonly string[]).includes(type))).toBe(true);
    for (const sheet of result.sheets) {
      expect(sheet.profileId).toBe(PROFILE.id);
      expect(sheet.selection.worksheetType).toBe(sheet.document.worksheetType);
    }
    expect(new Set(result.sheets.map(({ document }) => document.worksheetId)).size).toBe(7);
  });

  test("keeps every choice difficulty does not set", () => {
    const selection: WorksheetSelectionV2 = {
      ...BASE,
      length: "short",
      printScale: "large",
      paperSize: "a4",
      includeAnswerKey: false,
      useDisplayName: false,
    };
    const result = make(WORKSHEET_TYPE_IDS, PACKET_SHEET_LIMIT, "easier", 5, selection);
    if (!result.ok) {
      throw new Error(result.message);
    }
    for (const { document, selection: used } of result.sheets) {
      expect(used.length).toBe("short");
      expect(used.printScale).toBe("large");
      expect(used.paperSize).toBe("a4");
      expect(used.includeAnswerKey).toBe(false);
      expect(document.request.displayName).toBeUndefined();
    }
  });

  test("picks the sheet's focus from the level's candidates", () => {
    const result = make(["dry-math"], 6, "harder");
    if (!result.ok) {
      throw new Error(result.message);
    }
    const allowed = RANDOM_PACKET_FOCUS["dry-math"].harder.map((choose) =>
      JSON.stringify({ ...choose(BASE), worksheetType: "dry-math" }),
    );
    for (const { selection } of result.sheets) {
      expect(allowed).toContain(JSON.stringify(selection));
    }
  });

  test("the same seed source makes the same packet", () => {
    const seeds = (seed: number) => {
      const result = make(WORKSHEET_TYPE_IDS, 9, "medium", seed);
      return result.ok ? result.sheets.map(({ document }) => `${document.worksheetType}:${document.seed}`) : [];
    };
    expect(seeds(21)).toEqual(seeds(21));
    expect(seeds(21)).not.toEqual(seeds(22));
  });

  test("refuses no ticked family and no pages", () => {
    expect(make([], 3, "medium")).toEqual({ ok: false, message: "Tick at least one worksheet to include." });
    expect(make(["dry-math"], 0, "medium")).toEqual({ ok: false, message: "Choose at least one page." });
  });

  test("leaves out and names a family that cannot be made, and fills the pages from the rest", () => {
    const failing: typeof createInitialWorksheetSession = (generation, seeds) =>
      generation.selection.worksheetType === "operation-grid"
        ? { ok: false, code: "GENERATION_CONSTRAINT_CONFLICT", message: "No grid." }
        : createInitialWorksheetSession(generation, seeds);
    const result = makeRandomPacket(
      { families: ["operation-grid", "tally-detective"], pages: 3, level: "medium", profile: PROFILE, selection: BASE },
      source(9),
      failing,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.sheets.map(({ document }) => document.worksheetType)).toEqual([
      "tally-detective",
      "tally-detective",
      "tally-detective",
    ]);
    expect(result.leftOut).toEqual(["operation-grid"]);
    expect(randomPacketMessage(result)).toBe(
      "Added 3 random sheets to the packet. Operation Grid could not be made with the current choices and was left out.",
    );
    const none = makeRandomPacket(
      { families: ["operation-grid"], pages: 2, level: "medium", profile: PROFILE, selection: BASE },
      source(9),
      failing,
    );
    expect(none).toEqual({
      ok: false,
      message:
        "Operation Grid cannot be made with the current choices. Try a shorter length, standard print size or other worksheets.",
    });
  });

  test("stops dealing a family once no different page is left", () => {
    const constant: SeedSource = () => 42;
    const result = makeRandomPacket(
      { families: ["clock-explorer"], pages: 3, level: "easier", profile: PROFILE, selection: BASE },
      constant,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.sheets).toHaveLength(1);
    expect(result.leftOut).toEqual([]);
    expect(randomPacketMessage(result)).toBe(
      "Added 1 random sheet to the packet. Only 1 different worksheet could be made with these choices.",
    );
  });

  test("every made sheet is accepted by the packet reducer", () => {
    const result = make(WORKSHEET_TYPE_IDS, PACKET_SHEET_LIMIT, "medium", 13);
    if (!result.ok) {
      throw new Error(result.message);
    }
    const packet = result.sheets.reduce((state, sheet) => packetReducer(state, { type: "add", sheet }), EMPTY_PACKET);
    expect(packet.sheets).toEqual(result.sheets);
    expect(randomPacketMessage(result)).toBe(`Added ${PACKET_SHEET_LIMIT} random sheets to the packet.`);
  });

  test("a saved mixed header order never leaks into any random-packet Operation Grid level", () => {
    const parent: WorksheetSelectionV2 = {
      ...BASE,
      operationGrid: { ...BASE.operationGrid, headerOrder: "mixed" },
    };
    for (const level of RANDOM_PACKET_LEVELS) {
      const result = make(["operation-grid"], PACKET_SHEET_LIMIT, level, 0x4400, parent);
      if (!result.ok) {
        throw new Error(`${level}: ${result.message}`);
      }
      for (const { document } of result.sheets) {
        expect(document.request.practice).not.toHaveProperty("headerOrder");
        expect(document.worksheetType).toBe("operation-grid");
        const item = document.items[0] as OperationGridItemV1;
        expect(item.rowHeaders).toEqual(Array.from({ length: item.rowHeaders.length }, (_, index) => index + 1));
        expect(item.columnHeaders).toEqual(Array.from({ length: item.columnHeaders.length }, (_, index) => index + 1));
      }
    }
  });
});
