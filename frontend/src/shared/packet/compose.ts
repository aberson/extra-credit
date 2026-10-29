/**
 * The printed order of a session packet's pages (master plan Step 33, packet
 * contract Appendix C). Composition is pure and reads only each queued
 * document's family and its request's answer-key option, so it never changes
 * a stored document and the same queue always prints the same pages.
 */
import { getWorksheetRegistration } from "../worksheet/registry.js";
import type { WorksheetDocumentV1 } from "../worksheet/types.js";

/** The most sheets one packet holds. */
export const PACKET_SHEET_LIMIT = 10;

/** Where a packet prints its answer keys. */
export const PACKET_KEY_PLACEMENTS = ["grouped-end", "after-each-sheet", "none"] as const;

export type PacketKeyPlacement = (typeof PACKET_KEY_PLACEMENTS)[number];

/** Keys print together after every worksheet unless the parent chooses otherwise. */
export const DEFAULT_PACKET_KEY_PLACEMENT: PacketKeyPlacement = "grouped-end";

/** A page is one sheet's worksheet or its parent answer key. */
export type PacketSurface = "worksheet" | "answer";

/** What composition reads from one queued sheet. */
export interface PacketSheetInput {
  readonly document: WorksheetDocumentV1;
}

export interface PacketPage<TSheet extends PacketSheetInput = PacketSheetInput> {
  readonly sheet: TSheet;
  /** The sheet's 1-based place in the packet. */
  readonly position: number;
  readonly surface: PacketSurface;
}

/**
 * Whether a sheet prints a key page: its family's registration has an answer
 * key and its request asked for one.
 */
export function sheetHasAnswerKey(document: WorksheetDocumentV1): boolean {
  return (
    getWorksheetRegistration(document.worksheetType).hasAnswerKey &&
    document.request.options.includeAnswerKey
  );
}

/**
 * The packet's pages in print order. `grouped-end` prints every worksheet in
 * sheet order and then each key in sheet order, `after-each-sheet` prints each
 * key straight after its worksheet, and `none` prints no key.
 */
export function composePacketPages<TSheet extends PacketSheetInput>(
  sheets: readonly TSheet[],
  placement: PacketKeyPlacement,
): readonly PacketPage<TSheet>[] {
  const worksheet = (sheet: TSheet, index: number): PacketPage<TSheet> => ({
    sheet,
    position: index + 1,
    surface: "worksheet",
  });
  const keys = (sheet: TSheet, index: number): readonly PacketPage<TSheet>[] =>
    sheetHasAnswerKey(sheet.document)
      ? [{ sheet, position: index + 1, surface: "answer" }]
      : [];
  switch (placement) {
    case "grouped-end":
      return [...sheets.map(worksheet), ...sheets.flatMap(keys)];
    case "after-each-sheet":
      return sheets.flatMap((sheet, index) => [worksheet(sheet, index), ...keys(sheet, index)]);
    case "none":
      return sheets.map(worksheet);
  }
}
