import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import {
  describeFactsFocus,
  describeNumberBonds,
  describePracticeFocus,
} from "../../shared/config/practice-focus";
import type { ChildProfileV2, WorksheetSelectionV2 } from "../../shared/config/schema";
import { getWorksheetRegistration } from "../../shared/worksheet/registry";
import type { WorksheetType } from "../../shared/worksheet/types";
import { describeOperationGrid } from "../../worksheets/operation-grid/definition";
import { SENTENCE_BUILDER_VARIANT_LABELS } from "../../worksheets/sentence-builder/definition";
import { WORKSHEET_LENGTH_LABELS } from "../generator/control-labels";
import { createWorksheetSessionForSeed } from "../generator/create-session";
import {
  EMPTY_PACKET,
  PACKET_REFUSAL_MESSAGES,
  PACKET_SHEET_LIMIT,
  REMOVED_PROFILE_LABEL,
  describeQueuedSheet,
  packetAddRefusal,
  packetCountText,
  packetReducer,
  queuedSheetLabel,
  type PacketState,
  type QueuedSheet,
} from "./packet-session";

/* Every child here is fictional. */
const FIRST_CHILD: ChildProfileV2 = {
  id: "a1000000-0000-4000-8000-000000000001",
  displayName: "Fictional Wren",
  reviewedOn: "2026-09-01",
  interests: ["animals"],
};
const SECOND_CHILD: ChildProfileV2 = {
  id: "a1000000-0000-4000-8000-000000000002",
  reviewedOn: "2026-09-01",
  interests: [],
};
const PROFILES = [FIRST_CHILD, SECOND_CHILD] as const;

const BASE_SELECTION = worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2);

let nextWorksheet = 0;

/** A real generated document for this child and selection, with a fresh worksheet id. */
function sheetFor(
  profile: ChildProfileV2,
  change: Partial<WorksheetSelectionV2> & { readonly worksheetType: WorksheetType },
): QueuedSheet {
  nextWorksheet += 1;
  const selection: WorksheetSelectionV2 = { ...BASE_SELECTION, ...change };
  const created = createWorksheetSessionForSeed({ profile, selection }, nextWorksheet, {
    worksheetIdSource: () =>
      `b2000000-0000-4000-8000-${String(nextWorksheet).padStart(12, "0")}`,
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return { document: created.session.document, profileId: profile.id, selection };
}

function packetOf(sheets: readonly QueuedSheet[]): PacketState {
  return sheets.reduce<PacketState>(
    (state, sheet) => packetReducer(state, { type: "add", sheet }),
    EMPTY_PACKET,
  );
}

function idsOf(state: PacketState): readonly string[] {
  return state.sheets.map((sheet) => sheet.document.worksheetId);
}

describe("packetReducer", () => {
  test("add stores the previewed document unchanged, for the child it was made for", () => {
    const sheet = sheetFor(FIRST_CHILD, { worksheetType: "dry-math" });
    const snapshot = structuredClone(sheet.document);
    const state = packetReducer(EMPTY_PACKET, { type: "add", sheet });

    expect(state.sheets).toHaveLength(1);
    expect(state.sheets[0]?.document).toBe(sheet.document);
    expect(state.sheets[0]?.document).toEqual(snapshot);
    expect(state.sheets[0]?.document.items.length).toBeGreaterThan(0);
    expect(state.sheets[0]?.profileId).toBe(FIRST_CHILD.id);
    expect(EMPTY_PACKET.sheets).toEqual([]);
  });

  test("a second add with the same worksheetId is refused and leaves the state unchanged", () => {
    const sheet = sheetFor(FIRST_CHILD, { worksheetType: "number-bonds" });
    const once = packetReducer(EMPTY_PACKET, { type: "add", sheet });
    // The same document queued again, even for another child or selection.
    const again: QueuedSheet = { ...sheet, profileId: SECOND_CHILD.id };

    expect(packetAddRefusal(once, again.document)).toBe("already-in-packet");
    expect(packetReducer(once, { type: "add", sheet: again })).toBe(once);
    expect(idsOf(once)).toEqual([sheet.document.worksheetId]);
    expect(PACKET_REFUSAL_MESSAGES["already-in-packet"]).toBe(
      "This worksheet is already in the packet.",
    );
  });

  test(`an add beyond ${PACKET_SHEET_LIMIT} sheets is refused and leaves the state unchanged`, () => {
    expect(PACKET_SHEET_LIMIT).toBe(10);
    const full = packetOf(
      Array.from({ length: PACKET_SHEET_LIMIT }, () =>
        sheetFor(FIRST_CHILD, { worksheetType: "clock-explorer" }),
      ),
    );
    expect(full.sheets).toHaveLength(PACKET_SHEET_LIMIT);
    expect(packetAddRefusal(full, full.sheets[0]!.document)).toBe("already-in-packet");

    const eleventh = sheetFor(SECOND_CHILD, { worksheetType: "tally-detective" });
    const before = idsOf(full);
    expect(packetAddRefusal(full, eleventh.document)).toBe("packet-full");
    expect(packetReducer(full, { type: "add", sheet: eleventh })).toBe(full);
    expect(idsOf(full)).toEqual(before);
    expect(PACKET_REFUSAL_MESSAGES["packet-full"]).toContain(String(PACKET_SHEET_LIMIT));
  });

  test("moveUp, moveDown and remove give the expected order, and neither end moves past itself", () => {
    const [a, b, c] = [
      sheetFor(FIRST_CHILD, { worksheetType: "dry-math" }),
      sheetFor(SECOND_CHILD, { worksheetType: "sentence-builder" }),
      sheetFor(FIRST_CHILD, { worksheetType: "operation-grid" }),
    ];
    const start = packetOf([a, b, c]);
    const id = (sheet: QueuedSheet) => sheet.document.worksheetId;
    expect(idsOf(start)).toEqual([id(a), id(b), id(c)]);

    const cUp = packetReducer(start, { type: "moveUp", worksheetId: id(c) });
    expect(idsOf(cUp)).toEqual([id(a), id(c), id(b)]);
    const aDown = packetReducer(start, { type: "moveDown", worksheetId: id(a) });
    expect(idsOf(aDown)).toEqual([id(b), id(a), id(c)]);
    const bUpThenADown = packetReducer(
      packetReducer(start, { type: "moveUp", worksheetId: id(b) }),
      { type: "moveDown", worksheetId: id(a) },
    );
    expect(idsOf(bUpThenADown)).toEqual([id(b), id(c), id(a)]);

    // The first sheet cannot move up and the last cannot move down.
    expect(packetReducer(start, { type: "moveUp", worksheetId: id(a) })).toBe(start);
    expect(packetReducer(start, { type: "moveDown", worksheetId: id(c) })).toBe(start);

    const withoutB = packetReducer(start, { type: "remove", worksheetId: id(b) });
    expect(idsOf(withoutB)).toEqual([id(a), id(c)]);
    expect(idsOf(packetReducer(withoutB, { type: "remove", worksheetId: id(a) }))).toEqual([id(c)]);

    // An id that is not queued changes nothing.
    for (const type of ["moveUp", "moveDown", "remove"] as const) {
      expect(packetReducer(start, { type, worksheetId: "not-queued" })).toBe(start);
    }
    // Every move or removal keeps each queued document the same object.
    expect(cUp.sheets.map((sheet) => sheet.document)).toEqual(
      expect.arrayContaining([a.document, b.document, c.document]),
    );
    expect(cUp.sheets[1]?.document).toBe(c.document);
  });

  test("sheets for two different profiles coexist in one packet", () => {
    const first = sheetFor(FIRST_CHILD, { worksheetType: "count-compare-make" });
    const second = sheetFor(SECOND_CHILD, { worksheetType: "count-compare-make" });
    const state = packetOf([first, second]);
    expect(state.sheets.map((sheet) => sheet.profileId)).toEqual([FIRST_CHILD.id, SECOND_CHILD.id]);
    expect(state.sheets.map((sheet) => sheet.document)).toEqual([first.document, second.document]);
  });
});

describe("describeQueuedSheet", () => {
  test("names the family, focus, child and length from the shipped owners", () => {
    const sheet = sheetFor(FIRST_CHILD, { worksheetType: "dry-math", length: "long" });
    const description = describeQueuedSheet(sheet, PROFILES);
    expect(description).toEqual({
      family: getWorksheetRegistration("dry-math").displayName,
      detail: describePracticeFocus("dry-math", sheet.selection.dryMath, "without"),
      child: FIRST_CHILD.displayName,
      length: WORKSHEET_LENGTH_LABELS.long,
    });
    expect(queuedSheetLabel(3, description)).toBe(
      "Sheet 3 · Dry Math · Addition and subtraction within 10 · for Fictional Wren · Long",
    );
  });

  test("a Dry Math facts sheet names its facts focus", () => {
    const sheet = sheetFor(FIRST_CHILD, {
      worksheetType: "dry-math",
      dryMathStrand: "multiply-divide",
      dryMathFacts: { operations: ["multiplication"], factFamilies: [2, 5] },
    });
    expect(describeQueuedSheet(sheet, PROFILES).detail).toBe(
      describeFactsFocus({ operations: ["multiplication"], factFamilies: [2, 5] }),
    );
    expect(describeQueuedSheet(sheet, PROFILES).detail).toBe("Multiplication facts for 2 and 5");
  });

  test("a child without a nickname is Profile N by list position, and a deleted one is a removed profile", () => {
    const sheet = sheetFor(SECOND_CHILD, { worksheetType: "find-the-wow" });
    expect(describeQueuedSheet(sheet, PROFILES).child).toBe("Profile 2");
    // The position follows the current list, not the list at add time.
    expect(describeQueuedSheet(sheet, [SECOND_CHILD]).child).toBe("Profile 1");
    expect(describeQueuedSheet(sheet, [FIRST_CHILD]).child).toBe(REMOVED_PROFILE_LABEL);
    expect(REMOVED_PROFILE_LABEL).toBe("a removed profile");
    // A renamed child is named by the current nickname.
    const renamed = { ...FIRST_CHILD, displayName: "Fictional Lark" };
    const firstSheet = sheetFor(FIRST_CHILD, { worksheetType: "find-the-wow" });
    expect(describeQueuedSheet(firstSheet, [renamed, SECOND_CHILD]).child).toBe("Fictional Lark");
    expect(queuedSheetLabel(1, describeQueuedSheet(sheet, []))).toBe(
      "Sheet 1 · Math — Two Whats and a Wow · Quantities to 10 · for a removed profile · Standard",
    );
  });

  test("a Number Bonds sheet names its sentence focus and its length", () => {
    const sheet = sheetFor(FIRST_CHILD, {
      worksheetType: "number-bonds",
      length: "short",
      numberBonds: { operations: ["addition", "subtraction"], wholeMax: 20, regrouping: "included" },
    });
    const description = describeQueuedSheet(sheet, PROFILES);
    expect(description).toEqual({
      family: "Number Bonds",
      detail: describeNumberBonds(sheet.selection.numberBonds),
      child: "Fictional Wren",
      length: "Short",
    });
    expect(description.detail).toBe(
      "Missing number sentences, Addition and subtraction within 20, including problems that carry or borrow",
    );
  });

  test("an Operation Grid sheet names its grid and has no length", () => {
    const operationGrid = {
      operation: "addition",
      rows: 4,
      columns: 6,
      prefilled: 1,
      placement: "random",
    } as const;
    const sheet = sheetFor(SECOND_CHILD, { worksheetType: "operation-grid", operationGrid });
    const description = describeQueuedSheet(sheet, PROFILES);
    expect(description).toEqual({
      family: "Operation Grid",
      detail: describeOperationGrid(operationGrid),
      child: "Profile 2",
    });
    expect(description).not.toHaveProperty("length");
    expect(description.detail).toMatch(/4 rows by 6 columns, 1 cell pre-filled/u);
  });

  test("Clock Explorer and Tally Detective sheets name only the family and the child", () => {
    for (const worksheetType of ["clock-explorer", "tally-detective"] as const) {
      const sheet = sheetFor(FIRST_CHILD, { worksheetType, length: "long" });
      const description = describeQueuedSheet(sheet, PROFILES);
      expect(description).toEqual({
        family: getWorksheetRegistration(worksheetType).displayName,
        child: "Fictional Wren",
      });
      expect(queuedSheetLabel(2, description)).toBe(
        `Sheet 2 · ${worksheetType === "clock-explorer" ? "Clock Explorer" : "Tally Detective"} · for Fictional Wren`,
      );
    }
  });

  test("a Sentence Builder sheet names its writing activity, and a no-bank activity has no length", () => {
    const labels = sheetFor(FIRST_CHILD, {
      worksheetType: "sentence-builder",
      sentenceBuilder: { variant: "label", vocabulary: "simpler-words" },
    });
    expect(describeQueuedSheet(labels, PROFILES)).toEqual({
      family: "Sentence Builder",
      detail: SENTENCE_BUILDER_VARIANT_LABELS.label,
      child: "Fictional Wren",
      length: "Standard",
    });
    const drawAndTell = sheetFor(FIRST_CHILD, {
      worksheetType: "sentence-builder",
      sentenceBuilder: { variant: "draw-and-tell", vocabulary: "simpler-words" },
    });
    expect(describeQueuedSheet(drawAndTell, PROFILES)).toEqual({
      family: "Sentence Builder",
      detail: "Draw & Tell",
      child: "Fictional Wren",
    });
  });

  test("the count copy reads the limit", () => {
    expect(packetCountText(0)).toBe(`0 of ${PACKET_SHEET_LIMIT} sheets`);
    expect(packetCountText(3)).toBe("3 of 10 sheets");
  });
});
