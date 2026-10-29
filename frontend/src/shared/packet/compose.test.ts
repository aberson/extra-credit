import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../config/defaults.js";
import type { ChildProfileV2 } from "../config/schema.js";
import { projectGenerationRequest } from "../worksheet/project-request.js";
import { getWorksheetRegistration } from "../worksheet/registry.js";
import {
  WORKSHEET_TYPE_IDS,
  type WorksheetDocumentV1,
  type WorksheetType,
} from "../worksheet/types.js";
import {
  DEFAULT_PACKET_KEY_PLACEMENT,
  PACKET_KEY_PLACEMENTS,
  PACKET_SHEET_LIMIT,
  composePacketPages,
  sheetHasAnswerKey,
  type PacketKeyPlacement,
  type PacketSheetInput,
} from "./compose.js";

/* The child is fictional. */
const CHILD: ChildProfileV2 = {
  id: "e5000000-0000-4000-8000-000000000001",
  displayName: "Fictional Kit",
  reviewedOn: "2026-09-01",
  interests: ["animals"],
};

/** A real generated document for this family, with or without its answer key. */
function generated(worksheetType: WorksheetType, includeAnswerKey: boolean): WorksheetDocumentV1 {
  const registration = getWorksheetRegistration(worksheetType);
  const projected = projectGenerationRequest({
    profile: CHILD,
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType,
      includeAnswerKey,
    },
    generatorVersion: registration.generatorVersion,
    seed: "0000002a",
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  const result = registration.generate(projected.request, {
    worksheetId: "f6000000-0000-4000-8000-000000000000",
  });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.document;
}

/**
 * Every family with and without its key. Sentence Builder's projection never
 * asks for a key, so the pool adds one Sentence Builder document whose request
 * option is set by hand: only its registration's `hasAnswerKey` keeps it
 * keyless, so the registration arm is exercised on its own.
 */
const POOL: readonly WorksheetDocumentV1[] = [
  ...WORKSHEET_TYPE_IDS.flatMap((worksheetType) => [
    generated(worksheetType, true),
    generated(worksheetType, false),
  ]),
  (() => {
    const document = generated("sentence-builder", true);
    return {
      ...document,
      request: {
        ...document.request,
        options: { ...document.request.options, includeAnswerKey: true },
      },
    };
  })(),
];

interface TestSheet extends PacketSheetInput {
  readonly id: string;
}

/** Sheets drawn from the pool, each with its own worksheet id. */
function sheetsFrom(picks: readonly number[]): readonly TestSheet[] {
  return picks.map((pick, index) => {
    const document = POOL[pick];
    if (document === undefined) {
      throw new Error("Pick outside the pool.");
    }
    const id = `f6000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    return { id, document: { ...document, worksheetId: id } };
  });
}

/** One page as "W1" or "K1": surface letter and sheet position. */
function pageCodes(sheets: readonly TestSheet[], placement: PacketKeyPlacement): readonly string[] {
  return composePacketPages(sheets, placement).map((page) => {
    expect(page.sheet).toBe(sheets[page.position - 1]);
    return `${page.surface === "worksheet" ? "W" : "K"}${page.position}`;
  });
}

/** The expected order, written out from the contract's table rather than from the code. */
function expectedCodes(keyed: readonly boolean[], placement: PacketKeyPlacement): readonly string[] {
  const worksheets = keyed.map((_, index) => `W${index + 1}`);
  const keys = keyed.flatMap((hasKey, index) => (hasKey ? [`K${index + 1}`] : []));
  switch (placement) {
    case "grouped-end":
      return [...worksheets, ...keys];
    case "after-each-sheet":
      return keyed.flatMap((hasKey, index) =>
        hasKey ? [`W${index + 1}`, `K${index + 1}`] : [`W${index + 1}`],
      );
    case "none":
      return worksheets;
  }
}

/** Whether a document has a key, read from the family and the request, not through `sheetHasAnswerKey`. */
function keyedByContract(document: WorksheetDocumentV1): boolean {
  return document.worksheetType !== "sentence-builder" && document.request.options.includeAnswerKey;
}

describe("composePacketPages", () => {
  test("the pool covers every family with a key, without one, and a keyed request for a keyless family", () => {
    expect(POOL.filter(keyedByContract)).toHaveLength(WORKSHEET_TYPE_IDS.length - 1);
    expect(POOL.filter((document) => !keyedByContract(document)).length).toBeGreaterThan(
      WORKSHEET_TYPE_IDS.length,
    );
    expect(
      POOL.some(
        (document) =>
          document.worksheetType === "sentence-builder" && document.request.options.includeAnswerKey,
      ),
    ).toBe(true);
    for (const document of POOL) {
      expect(sheetHasAnswerKey(document), document.worksheetType).toBe(keyedByContract(document));
    }
  });

  test(`page count and order hold for 0 to ${PACKET_SHEET_LIMIT} sheets under every placement`, () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: POOL.length - 1 }), { minLength: 0, maxLength: PACKET_SHEET_LIMIT }),
        (picks) => {
          const sheets = sheetsFrom(picks);
          const keyed = sheets.map((sheet) => keyedByContract(sheet.document));
          const keyCount = keyed.filter(Boolean).length;
          for (const placement of PACKET_KEY_PLACEMENTS) {
            const codes = pageCodes(sheets, placement);
            expect(codes).toEqual(expectedCodes(keyed, placement));
            expect(codes).toHaveLength(sheets.length + (placement === "none" ? 0 : keyCount));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("grouped-end prints every key after every worksheet, in sheet order", () => {
    // Sheet 2 is keyless (Sentence Builder) and sheet 4 asked for no key.
    const sheets = sheetsFrom([0, 4, 6, 3, 14]);
    expect(sheets.map((sheet) => keyedByContract(sheet.document))).toEqual([
      true, false, true, false, true,
    ]);
    expect(DEFAULT_PACKET_KEY_PLACEMENT).toBe("grouped-end");
    expect(pageCodes(sheets, "grouped-end")).toEqual(["W1", "W2", "W3", "W4", "W5", "K1", "K3", "K5"]);
    const pages = composePacketPages(sheets, "grouped-end");
    const lastWorksheet = pages.map((page) => page.surface).lastIndexOf("worksheet");
    const firstKey = pages.map((page) => page.surface).indexOf("answer");
    expect(lastWorksheet).toBeLessThan(firstKey);
  });

  test("after-each-sheet puts each key straight after its worksheet", () => {
    const sheets = sheetsFrom([0, 4, 6, 3, 14]);
    expect(pageCodes(sheets, "after-each-sheet")).toEqual([
      "W1", "K1", "W2", "W3", "K3", "W4", "W5", "K5",
    ]);
  });

  test("none prints no key page", () => {
    const sheets = sheetsFrom([0, 6, 14, 16]);
    const pages = composePacketPages(sheets, "none");
    expect(pages.map((page) => page.surface)).toEqual(["worksheet", "worksheet", "worksheet", "worksheet"]);
    expect(pageCodes(sheets, "none")).toEqual(["W1", "W2", "W3", "W4"]);
  });

  test("an empty packet has no pages", () => {
    for (const placement of PACKET_KEY_PLACEMENTS) {
      expect(composePacketPages([], placement)).toEqual([]);
    }
  });

  test("composition leaves every document unchanged", () => {
    const sheets = sheetsFrom([0, 2, 4, 6, 8, 10, 12, 14, 16]);
    const snapshot: unknown = JSON.parse(JSON.stringify(sheets));
    for (const placement of PACKET_KEY_PLACEMENTS) {
      composePacketPages(sheets, placement);
    }
    expect(sheets).toEqual(snapshot);
  });
});
