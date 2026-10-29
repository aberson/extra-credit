import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import { PRACTICE_FOCUS_CATALOG } from "../../shared/config/practice-focus";
import type {
  ArithmeticFocusV2,
  ChildProfileV2,
  WorksheetSelectionV2,
} from "../../shared/config/schema";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants";
import {
  V1_NUMERIC_MAXIMUM,
  type DryMathItemV1,
  type NumberBondItemV1,
  type OperationGridItemV1,
} from "../../shared/worksheet/types";
import {
  judgeDocument,
  judgeOperationGridDocument,
  oracleCandidateKeys,
  oracleGrid,
  oracleFactKeys,
  oracleNumberBondKeys,
  oracleRegroups,
} from "../../../tests/oracles/arithmetic-oracle";
import { judgeClockDocument } from "../../../tests/oracles/clock-oracle";
import { judgeTallyDocument } from "../../../tests/oracles/tally-oracle";
import {
  createWorksheetSessionForSeed,
  makeAnotherWorksheetSession,
  type GenerationSelection,
} from "./create-session";

/*
 * Math practice through the production generation caller: the same
 * `createWorksheetSessionForSeed` App calls, with a fictional child built here
 * at runtime, judged by the independent arithmetic oracle.
 */

const fictionalChild: ChildProfileV2 = {
  id: "0b1c2d3e-4f50-4a61-8b72-c3d4e5f60718",
  displayName: "Fictional Regrouper",
  reviewedOn: "2026-09-30",
  interests: [],
};

function focusOf(id: string): ArithmeticFocusV2 {
  const option = PRACTICE_FOCUS_CATALOG["dry-math"].find((entry) => entry.id === id);
  if (option === undefined) {
    throw new Error(`No Dry Math catalog focus ${id}.`);
  }
  return option.focus;
}

function generation(
  focusId: string,
  dryMathRegrouping: WorksheetSelectionV2["dryMathRegrouping"],
): GenerationSelection {
  return {
    profile: fictionalChild,
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "dry-math",
      dryMath: focusOf(focusId),
      dryMathRegrouping,
      length: "long",
    },
  };
}

function itemKeys(items: readonly unknown[]): readonly string[] {
  return (items as readonly DryMathItemV1[]).map(
    ({ operation, leftOperand, rightOperand }) => `${operation}:${leftOperand}:${rightOperand}`,
  );
}

const DEPENDENCIES = { worksheetIdSource: () => "77777777-7777-4777-8777-777777777777" };

describe("Dry Math carrying and borrowing through the production caller", () => {
  test("within 100, every problem carries or borrows: a validated document the oracle judges clean", () => {
    const created = createWorksheetSessionForSeed(
      generation("addition-and-subtraction-within-100", "required"),
      0x2024_0024,
      DEPENDENCIES,
    );
    if (!created.ok) {
      throw new Error(created.message);
    }
    const { document } = created.session;
    expect(document.request.practice).toEqual({
      kind: "dry-math-add-subtract",
      regrouping: "required",
    });
    expect(document.request.capabilities.mathSkills.allowRegrouping).toBe(false);
    expect(document.items).toHaveLength(18);
    expect(validateWorksheetInvariants(document)).toBeUndefined();
    expect(judgeDocument(document)).toEqual([]);
    for (const item of document.items as readonly DryMathItemV1[]) {
      expect(oracleRegroups(item.operation, item.leftOperand, item.rightOperand)).toBe(true);
    }
  });

  test("mirror: the same seed without carrying or borrowing has no regrouping problem", () => {
    const created = createWorksheetSessionForSeed(
      generation("addition-and-subtraction-within-100", "without"),
      0x2024_0024,
      DEPENDENCIES,
    );
    if (!created.ok) {
      throw new Error(created.message);
    }
    const { document } = created.session;
    expect(document.request).not.toHaveProperty("practice");
    expect(judgeDocument(document)).toEqual([]);
    expect(
      (document.items as readonly DryMathItemV1[]).some((item) =>
        oracleRegroups(item.operation, item.leftOperand, item.rightOperand),
      ),
    ).toBe(false);
  });

  test("within 10 fills Long exactly, so Make another reorders the same eighteen problems", () => {
    const selected = generation("addition-and-subtraction-within-10", "required");
    const created = createWorksheetSessionForSeed(selected, 0x0000_0001, DEPENDENCIES);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const first = itemKeys(created.session.document.items);
    expect(new Set(first)).toEqual(
      oracleCandidateKeys({ ...focusOf("addition-and-subtraction-within-10"), regrouping: "required" }),
    );
    const seeds = [0x0000_0002, 0x0000_0003, 0x0000_0004];
    const another = makeAnotherWorksheetSession(
      created.session,
      selected,
      () => seeds.shift() ?? 0x0000_0005,
      DEPENDENCIES,
    );
    expect(another.status).toBe("changed");
    if (another.status !== "changed") {
      return;
    }
    const second = itemKeys(another.session.document.items);
    expect(new Set(second)).toEqual(new Set(first));
    expect(second).not.toEqual(first);
    expect(judgeDocument(another.session.document)).toEqual([]);
  });
});

describe("Dry Math three-digit practice through the production caller", () => {
  test("returns a validated, oracle-equal page with the explicit fixed focus", () => {
    const selected: GenerationSelection = {
      profile: fictionalChild,
      selection: {
        ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
        worksheetType: "dry-math",
        dryMathStrand: "three-digit",
        dryMathThreeDigit: { operations: ["addition", "subtraction"] },
        dryMathRegrouping: "required",
        length: "long",
      },
    };
    const created = createWorksheetSessionForSeed(selected, 0x0000_abcd, DEPENDENCIES);
    if (!created.ok) throw new Error(created.message);
    expect(created.session.document.request.practice).toEqual({
      kind: "dry-math-three-digit",
      operations: ["addition", "subtraction"],
      regrouping: "required",
    });
    expect(validateWorksheetInvariants(created.session.document)).toBeUndefined();
    expect(judgeDocument(created.session.document)).toEqual([]);
  });
});

describe("Dry Math multiplication and division facts through the production caller", () => {
  function factsGeneration(
    operations: WorksheetSelectionV2["dryMathFacts"]["operations"],
    factFamilies: readonly number[],
    length: WorksheetSelectionV2["length"],
  ): GenerationSelection {
    return {
      profile: fictionalChild,
      selection: {
        ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
        worksheetType: "dry-math",
        dryMathStrand: "multiply-divide",
        dryMathFacts: { operations: [...operations], factFamilies: [...factFamilies] },
        length,
      },
    };
  }

  test("families 3, 7 and 12 with both operations: a validated document whose every fact the oracle finds in those families", () => {
    const created = createWorksheetSessionForSeed(
      factsGeneration(["multiplication", "division"], [3, 7, 12], "long"),
      0x2025_0025,
      DEPENDENCIES,
    );
    if (!created.ok) {
      throw new Error(created.message);
    }
    const { document } = created.session;
    expect(document.request.practice).toEqual({
      kind: "dry-math-facts",
      operations: ["multiplication", "division"],
      factFamilies: [3, 7, 12],
    });
    expect(document.items).toHaveLength(18);
    expect(validateWorksheetInvariants(document)).toBeUndefined();
    expect(judgeDocument(document)).toEqual([]);
    const allowed = oracleFactKeys(["multiplication", "division"], [3, 7, 12]);
    for (const key of itemKeys(document.items)) {
      expect(allowed.has(key), key).toBe(true);
    }
    // Mirror: the same seed with other families draws other facts.
    const other = createWorksheetSessionForSeed(
      factsGeneration(["multiplication", "division"], [4, 9], "long"),
      0x2025_0025,
      DEPENDENCIES,
    );
    expect(other.ok && itemKeys(other.session.document.items)).not.toEqual(itemKeys(document.items));
  });

  test("division with family 0 alone fills Standard exactly, so Make another reorders the same twelve facts", () => {
    const selected = factsGeneration(["division"], [0], "standard");
    const created = createWorksheetSessionForSeed(selected, 0x0000_0001, DEPENDENCIES);
    if (!created.ok) {
      throw new Error(created.message);
    }
    const first = itemKeys(created.session.document.items);
    expect(new Set(first)).toEqual(oracleFactKeys(["division"], [0]));
    const seeds = [0x0000_0002, 0x0000_0003, 0x0000_0004];
    const another = makeAnotherWorksheetSession(
      created.session,
      selected,
      () => seeds.shift() ?? 0x0000_0005,
      DEPENDENCIES,
    );
    expect(another.status).toBe("changed");
    if (another.status !== "changed") {
      return;
    }
    const second = itemKeys(another.session.document.items);
    expect(new Set(second)).toEqual(new Set(first));
    expect(second).not.toEqual(first);
    expect(judgeDocument(another.session.document)).toEqual([]);
  });
});

describe("Number Bonds missing number sentences through the production caller", () => {
  function bondsGeneration(
    numberBonds: WorksheetSelectionV2["numberBonds"],
  ): GenerationSelection {
    return {
      profile: fictionalChild,
      selection: {
        ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
        worksheetType: "number-bonds",
        numberBonds,
        length: "long",
      },
    };
  }

  /** The oracle's key for a printed sentence: `addition:8:?:15`. */
  function printedKey(item: NumberBondItemV1): string {
    const left = item.missing === "left" ? "?" : String(item.leftOperand);
    const right = item.missing === "right" ? "?" : String(item.rightOperand);
    return `${item.operation}:${left}:${right}:${item.result}`;
  }

  test("within 20, both operations, without carrying or borrowing: a validated document whose every sentence the oracle allows", () => {
    const numberBonds = {
      operations: ["addition", "subtraction"],
      wholeMax: V1_NUMERIC_MAXIMUM,
      regrouping: "without",
    } as const;
    const created = createWorksheetSessionForSeed(
      bondsGeneration({ ...numberBonds, operations: [...numberBonds.operations] }),
      0x2026_0026,
      DEPENDENCIES,
    );
    if (!created.ok) {
      throw new Error(created.message);
    }
    const { document } = created.session;
    expect(document.worksheetType).toBe("number-bonds");
    expect(document.request.practice).toEqual({ kind: "number-bonds", variant: "sentence", ...numberBonds });
    expect(document.request.displayName).toBe("Fictional Regrouper");
    expect(document.items).toHaveLength(18);
    expect(validateWorksheetInvariants(document)).toBeUndefined();
    expect(judgeDocument(document)).toEqual([]);
    const allowed = oracleNumberBondKeys(numberBonds);
    for (const item of document.items as readonly NumberBondItemV1[]) {
      expect(allowed.has(printedKey(item)), printedKey(item)).toBe(true);
    }
    // Mirror: the same seed with problems that carry or borrow included draws
    // other sentences, and the oracle still judges them clean.
    const included = createWorksheetSessionForSeed(
      bondsGeneration({ ...numberBonds, operations: [...numberBonds.operations], regrouping: "included" }),
      0x2026_0026,
      DEPENDENCIES,
    );
    if (!included.ok) {
      throw new Error(included.message);
    }
    expect((included.session.document.items as readonly NumberBondItemV1[]).map(printedKey)).not.toEqual(
      (document.items as readonly NumberBondItemV1[]).map(printedKey),
    );
    expect(judgeDocument(included.session.document)).toEqual([]);
  });
});

describe("Operation Grid through the production caller", () => {
  function gridGeneration(operationGrid: WorksheetSelectionV2["operationGrid"]): GenerationSelection {
    return {
      profile: fictionalChild,
      selection: {
        ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
        worksheetType: "operation-grid",
        operationGrid,
      },
    };
  }

  test.each(["addition", "multiplication", "powers"] as const)(
    "%s: createWorksheetSessionForSeed returns a validated document whose every cell equals the oracle",
    (operation) => {
      const operationGrid = {
        operation,
        rows: operation === "powers" ? 10 : 12,
        columns: operation === "powers" ? 3 : 12,
        prefilled: 7,
        placement: "random",
      } as const;
      const created = createWorksheetSessionForSeed(gridGeneration(operationGrid), 0x2026_0034, DEPENDENCIES);
      if (!created.ok) {
        throw new Error(created.message);
      }
      const { document } = created.session;
      expect(document.worksheetType).toBe("operation-grid");
      expect(document.request.practice).toEqual({ kind: "operation-grid", ...operationGrid });
      expect(document.request.displayName).toBe("Fictional Regrouper");
      expect(validateWorksheetInvariants(document)).toBeUndefined();
      expect(judgeOperationGridDocument(document)).toEqual([]);
      const item = document.items[0] as OperationGridItemV1;
      expect(item.cells.map(({ value }) => value)).toEqual(
        oracleGrid(operation, operationGrid.rows, operationGrid.columns).flat(),
      );
    },
  );

  test("Make another finds a different grid with random placement, and explains the one fixed Diagonal grid", () => {
    const random = gridGeneration({ operation: "multiplication", rows: 10, columns: 10, prefilled: 10, placement: "random" });
    const first = createWorksheetSessionForSeed(random, 1, DEPENDENCIES);
    if (!first.ok) {
      throw new Error(first.message);
    }
    let seed = 1;
    const another = makeAnotherWorksheetSession(first.session, random, () => (seed += 1), DEPENDENCIES);
    expect(another.status).toBe("changed");
    // Diagonal first with exactly the diagonal pre-filled has one arrangement.
    const diagonal = gridGeneration({
      operation: "multiplication",
      rows: 10,
      columns: 10,
      prefilled: 10,
      placement: "diagonal-first",
    });
    const fixed = createWorksheetSessionForSeed(diagonal, 1, DEPENDENCIES);
    if (!fixed.ok) {
      throw new Error(fixed.message);
    }
    seed = 1;
    const exhausted = makeAnotherWorksheetSession(fixed.session, diagonal, () => (seed += 1), DEPENDENCIES);
    expect(exhausted).toEqual({
      status: "exhausted",
      message:
        "No different worksheet was found in 16 attempts. Operation Grid varies only in which cells are pre-filled. Choose Random placement or a different number of pre-filled cells, or create a new worksheet later.",
    });
  });
});

describe("Clock Explorer through the production caller", () => {
  const clockGeneration: GenerationSelection = {
    profile: fictionalChild,
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "clock-explorer",
      // Stored choices the family never reads: they must not reach its page.
      length: "long",
      includeDecorativeGraphics: true,
      theme: "space",
    },
  };

  test("createWorksheetSessionForSeed returns a validated four-clock page the independent oracle accepts", () => {
    for (const seed of [1, 0x2026_0035, 0xffff_ffff]) {
      const created = createWorksheetSessionForSeed(clockGeneration, seed, DEPENDENCIES);
      if (!created.ok) {
        throw new Error(created.message);
      }
      const { document } = created.session;
      expect(document.worksheetType).toBe("clock-explorer");
      expect(document.request.options.length).toBe("standard");
      expect(document.request.options.includeDecorativeGraphics).toBe(false);
      expect(document.request.displayName).toBe("Fictional Regrouper");
      expect(validateWorksheetInvariants(document)).toBeUndefined();
      expect(judgeClockDocument(document)).toEqual([]);
    }
  });

  test("Make another finds a different page, and exhaustion names the fixed hours without recommending a control", () => {
    const first = createWorksheetSessionForSeed(clockGeneration, 1, DEPENDENCIES);
    if (!first.ok) {
      throw new Error(first.message);
    }
    let seed = 1;
    const another = makeAnotherWorksheetSession(first.session, clockGeneration, () => (seed += 1), DEPENDENCIES);
    expect(another.status).toBe("changed");
    if (another.status === "changed") {
      expect(another.session.contentKey).not.toBe(first.session.contentKey);
      expect(judgeClockDocument(another.session.document)).toEqual([]);
    }
    // A seed source that only ever offers the current seed finds nothing new
    // in the 16 attempts, and the message says so truthfully.
    const exhausted = makeAnotherWorksheetSession(first.session, clockGeneration, () => 1, DEPENDENCIES);
    expect(exhausted).toEqual({
      status: "exhausted",
      message:
        "No different worksheet was found in 16 attempts. Clock Explorer draws 4 clocks from a fixed set of 12 on-the-hour times, which no other choice changes. Create a new worksheet later.",
    });
    expect(exhausted.status === "exhausted" ? exhausted.message : "").not.toMatch(
      /practice focus|length|range|More options/u,
    );
  });
});

describe("Tally Detective through the production caller", () => {
  const tallyGeneration: GenerationSelection = {
    profile: fictionalChild,
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "tally-detective",
      // Stored choices the family never reads: they must not reach its page.
      length: "long",
      includeDecorativeGraphics: true,
      theme: "space",
    },
  };

  test("createWorksheetSessionForSeed returns a validated four-tally page the independent oracle accepts", () => {
    for (const seed of [1, 0x2026_0036, 0xffff_ffff]) {
      const created = createWorksheetSessionForSeed(tallyGeneration, seed, DEPENDENCIES);
      if (!created.ok) {
        throw new Error(created.message);
      }
      const { document } = created.session;
      expect(document.worksheetType).toBe("tally-detective");
      expect(document.request.options.length).toBe("standard");
      expect(document.request.options.includeDecorativeGraphics).toBe(false);
      expect(document.request.displayName).toBe("Fictional Regrouper");
      expect(validateWorksheetInvariants(document)).toBeUndefined();
      expect(judgeTallyDocument(document)).toEqual([]);
    }
  });

  test("Make another finds a different page, and exhaustion names the fixed totals without recommending a control", () => {
    const first = createWorksheetSessionForSeed(tallyGeneration, 1, DEPENDENCIES);
    if (!first.ok) {
      throw new Error(first.message);
    }
    let seed = 1;
    const another = makeAnotherWorksheetSession(first.session, tallyGeneration, () => (seed += 1), DEPENDENCIES);
    expect(another.status).toBe("changed");
    if (another.status === "changed") {
      expect(another.session.contentKey).not.toBe(first.session.contentKey);
      expect(judgeTallyDocument(another.session.document)).toEqual([]);
    }
    // A seed source that only ever offers the current seed finds nothing new
    // in the 16 attempts, and the message says so truthfully.
    const exhausted = makeAnotherWorksheetSession(first.session, tallyGeneration, () => 1, DEPENDENCIES);
    expect(exhausted).toEqual({
      status: "exhausted",
      message:
        "No different worksheet was found in 16 attempts. Tally Detective draws 4 tallies from a fixed set of 20 totals, which no other choice changes. Create a new worksheet later.",
    });
    expect(exhausted.status === "exhausted" ? exhausted.message : "").not.toMatch(
      /practice focus|length|range|More options/u,
    );
  });
});
