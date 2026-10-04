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
import type { DryMathItemV1 } from "../../shared/worksheet/types";
import {
  judgeDocument,
  oracleCandidateKeys,
  oracleFactKeys,
  oracleRegroups,
} from "../../../tests/oracles/arithmetic-oracle";
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
