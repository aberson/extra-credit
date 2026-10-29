import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import { WORKSHEET_LENGTHS, PRINT_SCALES } from "../../shared/config/enums";
import type { ChildProfileV2, WorksheetSelectionV2 } from "../../shared/config/schema";
import { WORKSHEET_TYPE_IDS, type WorksheetType } from "../../shared/worksheet/types";
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

/** The largest number each level's focus may reach, as its label says. */
const LEVEL_CEILING = { easier: 10, medium: 20, harder: 100 } as const;

/** The largest number a selection's own family practices, apart from times-table facts. */
function largestNumber(selection: WorksheetSelectionV2): number | undefined {
  switch (selection.worksheetType) {
    case "dry-math":
      return selection.dryMathStrand === "add-subtract" ? selection.dryMath.resultMax : undefined;
    case "find-the-wow":
      return selection.findTheWow.variant === "equation"
        ? selection.findTheWow.equation.resultMax
        : selection.findTheWow.quantity.countingMax;
    case "count-compare-make":
      return selection.countCompareMake.compareMax;
    case "number-bonds":
      return selection.numberBonds.wholeMax;
    case "operation-grid": {
      const { columns, operation, rows } = selection.operationGrid;
      return operation === "addition" ? rows + columns : rows * columns;
    }
    default:
      return undefined;
  }
}

describe("the difficulty table", () => {
  test.each(WORKSHEET_TYPE_IDS.flatMap((family) => RANDOM_PACKET_LEVELS.map((level) => [family, level] as const)))(
    "every %s candidate at %s makes a sheet with the default choices and stays within the level",
    (family, level) => {
      for (const choose of RANDOM_PACKET_FOCUS[family][level]) {
        const selection = { ...choose(BASE), worksheetType: family };
        const created = createInitialWorksheetSession({ profile: PROFILE, selection }, source(3));
        expect(created.ok, JSON.stringify(created)).toBe(true);
        const largest = largestNumber(selection);
        if (largest !== undefined) {
          expect(largest).toBeLessThanOrEqual(LEVEL_CEILING[level]);
        }
      }
    },
  );

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

  test("only Harder practices times tables, and its hint says so", () => {
    for (const level of RANDOM_PACKET_LEVELS) {
      const facts = RANDOM_PACKET_FOCUS["dry-math"][level].some(
        (choose) => choose(BASE).dryMathStrand === "multiply-divide",
      );
      expect(facts).toBe(level === "harder");
      expect(RANDOM_PACKET_LEVEL_LABELS[level].hint.includes("times tables")).toBe(level === "harder");
    }
  });

  test("harder levels practice larger numbers than easier ones somewhere in every numeric family", () => {
    for (const family of ["dry-math", "find-the-wow", "count-compare-make", "number-bonds", "operation-grid"] as const) {
      const largestAt = (level: RandomPacketLevel) =>
        Math.max(
          ...RANDOM_PACKET_FOCUS[family][level].map(
            (choose) => largestNumber({ ...choose(BASE), worksheetType: family }) ?? 0,
          ),
        );
      expect(largestAt("easier")).toBeLessThan(largestAt("medium"));
      expect(largestAt("medium")).toBeLessThanOrEqual(largestAt("harder"));
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
});
