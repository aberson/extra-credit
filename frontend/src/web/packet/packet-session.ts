/**
 * The printable packet as App session state (master plan Steps 31 and 33, P9).
 *
 * A packet is an ordered list of queued sheets, each the generated document
 * exactly as it was previewed (its items and answers) plus the profile id and
 * worksheet selection it was made from, and the packet's one paper size and
 * answer-key placement. The reducer is pure and App holds it in `useReducer`
 * beside the worksheet session: nothing here reaches the server or browser
 * storage, so the packet is lost on close or reload by design. Later control,
 * child or profile changes never touch a queued sheet, and neither the paper
 * nor the placement changes a stored document; only the label's child segment
 * reads the current profiles.
 */
import { describeFactsFocus, describeNumberBonds, describePracticeFocus } from "../../shared/config/practice-focus";
import type { ChildProfileV2, WorksheetSelectionV2 } from "../../shared/config/schema";
import {
  DEFAULT_PACKET_KEY_PLACEMENT,
  PACKET_SHEET_LIMIT,
  type PacketKeyPlacement,
  type PacketPage,
} from "../../shared/packet/compose";
import { getWorksheetRegistration } from "../../shared/worksheet/registry";
import type { PaperSize, WorksheetDocumentV1 } from "../../shared/worksheet/types";
import { describeOperationGrid } from "../../worksheets/operation-grid/definition";
import { SENTENCE_BUILDER_VARIANT_LABELS } from "../../worksheets/sentence-builder/definition";
import { WORKSHEET_LENGTH_LABELS, profileLabel } from "../generator/control-labels";

export { PACKET_SHEET_LIMIT };

export interface QueuedSheet {
  /** The child the sheet was made for; the profile may later be edited or removed. */
  readonly profileId: string;
  /** The worksheet selection the document was generated from. */
  readonly selection: WorksheetSelectionV2;
  /** The generated document, items and answers, exactly as previewed. */
  readonly document: WorksheetDocumentV1;
}

export interface PacketState {
  /** In packet order: the first entry is sheet 1. */
  readonly sheets: readonly QueuedSheet[];
  /** The one paper every page prints on; an empty packet adopts its first sheet's. */
  readonly paperSize: PaperSize;
  /** Where the packet prints its answer keys. */
  readonly keyPlacement: PacketKeyPlacement;
}

export const EMPTY_PACKET: PacketState = Object.freeze({
  sheets: Object.freeze([]),
  paperSize: "letter",
  keyPlacement: DEFAULT_PACKET_KEY_PLACEMENT,
});

export type PacketAction =
  | { readonly type: "add"; readonly sheet: QueuedSheet }
  | { readonly type: "moveUp"; readonly worksheetId: string }
  | { readonly type: "moveDown"; readonly worksheetId: string }
  | { readonly type: "remove"; readonly worksheetId: string }
  | { readonly type: "setPaper"; readonly paperSize: PaperSize }
  | { readonly type: "setKeyPlacement"; readonly keyPlacement: PacketKeyPlacement };

/** The "Answer keys" choice's labels (packet contract Appendix C). */
export const PACKET_KEY_PLACEMENT_LABELS = {
  "grouped-end": "All answer keys at the end",
  "after-each-sheet": "Each key after its worksheet",
  none: "Leave out answer keys",
} as const satisfies Record<PacketKeyPlacement, string>;

/** "N of 10 sheets", from `PACKET_SHEET_LIMIT`. */
export function packetCountText(count: number): string {
  return `${count} of ${PACKET_SHEET_LIMIT} sheets`;
}

/** Why `add` would leave the packet unchanged. */
export type PacketAddRefusal = "already-in-packet" | "packet-full";

/** What the parent is told for each refusal. */
export const PACKET_REFUSAL_MESSAGES = {
  "already-in-packet": "This worksheet is already in the packet.",
  "packet-full": `The packet holds at most ${PACKET_SHEET_LIMIT} sheets. Remove a sheet to add another.`,
} as const satisfies Record<PacketAddRefusal, string>;

/**
 * Whether `add` would refuse this document, and why: a document whose
 * `worksheetId` is already queued, else a packet already at the limit.
 */
export function packetAddRefusal(
  state: PacketState,
  document: WorksheetDocumentV1,
): PacketAddRefusal | undefined {
  if (state.sheets.some((sheet) => sheet.document.worksheetId === document.worksheetId)) {
    return "already-in-packet";
  }
  return state.sheets.length >= PACKET_SHEET_LIMIT ? "packet-full" : undefined;
}

/** The sheets with the one at `from` swapped with its neighbour at `to`, or `undefined` past an end. */
function swapped(
  sheets: readonly QueuedSheet[],
  from: number,
  to: number,
): readonly QueuedSheet[] | undefined {
  const moving = sheets[from];
  const neighbour = sheets[to];
  if (from === -1 || moving === undefined || neighbour === undefined) {
    return undefined;
  }
  const next = [...sheets];
  next[to] = moving;
  next[from] = neighbour;
  return next;
}

/**
 * Every refused or impossible action returns `state` itself, so a caller can
 * tell "nothing changed" by identity.
 */
export function packetReducer(state: PacketState, action: PacketAction): PacketState {
  switch (action.type) {
    case "add":
      if (packetAddRefusal(state, action.sheet.document) !== undefined) {
        return state;
      }
      return {
        ...state,
        sheets: [...state.sheets, action.sheet],
        paperSize:
          state.sheets.length === 0
            ? action.sheet.document.request.options.paperSize
            : state.paperSize,
      };
    case "moveUp":
    case "moveDown": {
      const from = state.sheets.findIndex(
        (sheet) => sheet.document.worksheetId === action.worksheetId,
      );
      const next = swapped(state.sheets, from, action.type === "moveUp" ? from - 1 : from + 1);
      return next === undefined ? state : { ...state, sheets: next };
    }
    case "remove": {
      const next = state.sheets.filter(
        (sheet) => sheet.document.worksheetId !== action.worksheetId,
      );
      return next.length === state.sheets.length ? state : { ...state, sheets: next };
    }
    case "setPaper":
      return action.paperSize === state.paperSize ? state : { ...state, paperSize: action.paperSize };
    case "setKeyPlacement":
      return action.keyPlacement === state.keyPlacement
        ? state
        : { ...state, keyPlacement: action.keyPlacement };
  }
}

/**
 * The document a packet page renders: the stored document with the packet
 * paper in place of its own, for display only (D21's paper-only tweak). No
 * generator reads `paperSize`, so the items and answers, and the stored scale,
 * are the stored document's own; the stored document itself is never changed.
 */
export function onPacketPaper(document: WorksheetDocumentV1, paperSize: PaperSize): WorksheetDocumentV1 {
  return document.request.options.paperSize === paperSize
    ? document
    : {
        ...document,
        request: { ...document.request, options: { ...document.request.options, paperSize } },
      };
}

/**
 * A key page's sheet label: "Sheet N · family", then "for nickname" when the
 * worksheet prints one. The nickname is the one the immutable document
 * printed, not the profile's current one.
 */
export function packetKeyLabel(page: PacketPage<QueuedSheet>): string {
  const { document } = page.sheet;
  const nickname = document.request.displayName;
  return [
    `Sheet ${page.position}`,
    getWorksheetRegistration(document.worksheetType).displayName,
    ...(nickname === undefined ? [] : [`for ${nickname}`]),
  ].join(" · ");
}

/** The child segment when the profile a sheet was made for no longer exists. */
export const REMOVED_PROFILE_LABEL = "a removed profile";

/** The parts of one queued sheet's label; an absent part does not apply to it. */
export interface QueuedSheetDescription {
  readonly family: string;
  /** The variant or practice focus; absent for a family with neither. */
  readonly detail?: string;
  readonly child: string;
  /** Absent when the family has no length choice for this selection. */
  readonly length?: string;
}

/** The variant or practice focus a selection names, in its owner's words. */
function detailOf(selection: WorksheetSelectionV2): string | undefined {
  switch (selection.worksheetType) {
    case "dry-math":
      return selection.dryMathStrand === "multiply-divide"
        ? describeFactsFocus(selection.dryMathFacts)
        : describePracticeFocus("dry-math", selection.dryMath, selection.dryMathRegrouping);
    case "find-the-wow":
      return selection.findTheWow.variant === "equation"
        ? describePracticeFocus("find-the-wow-equation", selection.findTheWow.equation)
        : describePracticeFocus("find-the-wow-quantity", selection.findTheWow.quantity);
    case "sentence-builder":
      return SENTENCE_BUILDER_VARIANT_LABELS[selection.sentenceBuilder.variant];
    case "count-compare-make":
      return describePracticeFocus("count-compare-make", selection.countCompareMake);
    case "number-bonds":
      return describeNumberBonds(selection.numberBonds);
    case "operation-grid":
      return describeOperationGrid(selection.operationGrid);
    case "clock-explorer":
    case "tally-detective":
      return undefined;
  }
}

/**
 * One queued sheet's label parts, composed from the shipped label owners: the
 * family's registered display name, its variant or focus, the child it was
 * made for and its length. The child is the profile's current nickname,
 * "Profile N" by its current list position, or `REMOVED_PROFILE_LABEL`.
 */
export function describeQueuedSheet(
  sheet: QueuedSheet,
  profiles: readonly ChildProfileV2[],
): QueuedSheetDescription {
  const { selection } = sheet;
  const registration = getWorksheetRegistration(selection.worksheetType);
  const detail = detailOf(selection);
  const index = profiles.findIndex((profile) => profile.id === sheet.profileId);
  const profile = profiles[index];
  const lengthApplies = registration.controls.getApplicableControls({ selection }).length;
  return {
    family: registration.displayName,
    ...(detail === undefined ? {} : { detail }),
    child: profile === undefined ? REMOVED_PROFILE_LABEL : profileLabel(profile, index),
    ...(lengthApplies ? { length: WORKSHEET_LENGTH_LABELS[selection.length] } : {}),
  };
}

/** "Sheet N · family · detail · for child · length", leaving out absent parts. */
export function queuedSheetLabel(position: number, description: QueuedSheetDescription): string {
  return [
    `Sheet ${position}`,
    description.family,
    description.detail,
    `for ${description.child}`,
    description.length,
  ]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
}
