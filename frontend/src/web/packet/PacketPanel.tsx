import { useLayoutEffect, useRef, useState } from "react";

import type { ChildProfileV2 } from "../../shared/config/schema";
import { PAPER_SIZES } from "../../shared/config/enums";
import { PACKET_KEY_PLACEMENTS, type PacketKeyPlacement } from "../../shared/packet/compose";
import type { PaperSize } from "../../shared/worksheet/types";
import { PAPER_SIZE_LABELS } from "../generator/control-labels";
import {
  PACKET_KEY_PLACEMENT_LABELS,
  PACKET_REFUSAL_MESSAGES,
  describeQueuedSheet,
  packetCountText,
  queuedSheetLabel,
  type QueuedSheet,
} from "./packet-session";

/** The sentence that says where the packet lives (P9). */
export const PACKET_SESSION_ONLY_TEXT =
  "This packet is kept only until you close or reload this page.";

const PACKET_FULL_REASON_ID = "packet-full-reason";

/** Preview packet's id, where focus returns from the packet preview when no single preview is open. */
export const PACKET_PREVIEW_BUTTON_ID = "packet-preview-button";

interface AddToPacketProps {
  /** Whether the packet already holds `PACKET_SHEET_LIMIT` sheets. */
  readonly full: boolean;
  /** The outcome of the last Add for the visible preview, if any. */
  readonly message: string | null;
  readonly onAdd: () => void;
}

/**
 * "Add to packet", shown beside Make another while a preview is visible. At
 * the limit it is disabled and its visible reason names the remedy. Its
 * outcome is a polite live region deliberately without role="status", so it
 * adds no status region beside the generation message.
 */
export function AddToPacket({ full, message, onAdd }: AddToPacketProps) {
  return (
    <div className="packet-add" data-packet-add="true">
      <button
        aria-describedby={full ? PACKET_FULL_REASON_ID : undefined}
        disabled={full}
        onClick={onAdd}
        type="button"
      >
        Add to packet
      </button>
      {full && (
        <p data-packet-full-reason="true" id={PACKET_FULL_REASON_ID}>
          {PACKET_REFUSAL_MESSAGES["packet-full"]}
        </p>
      )}
      <p aria-live="polite" data-packet-add-message="true">
        {message}
      </p>
    </div>
  );
}

interface PacketPanelProps {
  readonly sheets: readonly QueuedSheet[];
  /** The current saved profiles, which name each sheet's child. */
  readonly profiles: readonly ChildProfileV2[];
  /** The packet's one paper size and where it prints its keys. */
  readonly paperSize: PaperSize;
  readonly keyPlacement: PacketKeyPlacement;
  readonly onMoveUp: (worksheetId: string) => void;
  readonly onMoveDown: (worksheetId: string) => void;
  readonly onRemove: (worksheetId: string) => void;
  readonly onPaperChange: (paperSize: PaperSize) => void;
  readonly onKeyPlacementChange: (keyPlacement: PacketKeyPlacement) => void;
  /** Shows every packet page in print order in place of the single preview. */
  readonly onPreview: () => void;
}

/** Where keyboard focus goes once the panel re-renders after a row action. */
type PendingFocus =
  | { readonly kind: "row"; readonly worksheetId: string; readonly action: "up" | "down" }
  | { readonly kind: "after-remove"; readonly position: number };

/**
 * The printable packet: its count against the limit, the session-only
 * sentence and one row per queued sheet in packet order, each with Move up,
 * Move down and Remove, then the packet's Paper and Answer keys choices and
 * Preview packet, which is disabled while the packet is empty. Focus stays
 * with the sheet a parent moves, moving to its other button when the one
 * pressed reaches an end, and after a removal lands on the next row's Remove,
 * the previous row's, or the panel heading.
 */
export function PacketPanel({
  keyPlacement,
  onKeyPlacementChange,
  onMoveDown,
  onMoveUp,
  onPaperChange,
  onPreview,
  onRemove,
  paperSize,
  profiles,
  sheets,
}: PacketPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    const panel = panelRef.current;
    if (pending === null || panel === null) {
      return;
    }
    pendingFocus.current = null;
    if (pending.kind === "row") {
      const row = panel.querySelector(`[data-worksheet-id="${pending.worksheetId}"]`);
      const pressed = row?.querySelector<HTMLButtonElement>(`[data-packet-move="${pending.action}"]`);
      const other = row?.querySelector<HTMLButtonElement>(
        `[data-packet-move="${pending.action === "up" ? "down" : "up"}"]`,
      );
      (pressed?.disabled === false ? pressed : other)?.focus();
      return;
    }
    const removes = panel.querySelectorAll<HTMLButtonElement>("[data-packet-remove]");
    const target = removes[pending.position] ?? removes[pending.position - 1];
    if (target === undefined) {
      panel.querySelector<HTMLElement>("#packet-title")?.focus();
    } else {
      target.focus();
    }
  }, [sheets]);

  function move(sheet: QueuedSheet, position: number, action: "up" | "down"): void {
    pendingFocus.current = { kind: "row", worksheetId: sheet.document.worksheetId, action };
    setAnnouncement(`Sheet ${position} moved to position ${action === "up" ? position - 1 : position + 1}.`);
    (action === "up" ? onMoveUp : onMoveDown)(sheet.document.worksheetId);
  }

  function remove(sheet: QueuedSheet, position: number): void {
    pendingFocus.current = { kind: "after-remove", position: position - 1 };
    setAnnouncement(`Sheet ${position} removed. ${packetCountText(sheets.length - 1)} in the packet.`);
    onRemove(sheet.document.worksheetId);
  }

  return (
    <section aria-labelledby="packet-title" className="packet-panel" data-packet-panel="true" ref={panelRef}>
      <h2 id="packet-title" tabIndex={-1}>Printable packet</h2>
      <p data-packet-count="true">{packetCountText(sheets.length)}</p>
      <p data-packet-session-only="true">{PACKET_SESSION_ONLY_TEXT}</p>
      {sheets.length === 0 ? (
        <p data-packet-empty="true">
          No sheets yet. Create a worksheet, then choose Add to packet.
        </p>
      ) : (
        <ol className="packet-panel__rows">
          {sheets.map((sheet, index) => {
            const position = index + 1;
            const label = queuedSheetLabel(position, describeQueuedSheet(sheet, profiles));
            return (
              <li
                className="packet-panel__row"
                data-packet-row="true"
                data-seed={sheet.document.seed}
                data-worksheet-id={sheet.document.worksheetId}
                key={sheet.document.worksheetId}
              >
                <span data-packet-label="true">{label}</span>
                <span className="packet-panel__actions">
                  <button
                    aria-label={`Move up sheet ${position}`}
                    data-packet-move="up"
                    disabled={index === 0}
                    onClick={() => move(sheet, position, "up")}
                    type="button"
                  >
                    Move up
                  </button>
                  <button
                    aria-label={`Move down sheet ${position}`}
                    data-packet-move="down"
                    disabled={index === sheets.length - 1}
                    onClick={() => move(sheet, position, "down")}
                    type="button"
                  >
                    Move down
                  </button>
                  <button
                    aria-label={`Remove sheet ${position}`}
                    data-packet-remove="true"
                    onClick={() => remove(sheet, position)}
                    type="button"
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {sheets.length > 0 && (
        <div className="packet-panel__print">
          <fieldset className="packet-panel__choice" data-packet-paper="true">
            <legend>Paper</legend>
            {PAPER_SIZES.map((paper) => (
              <label key={paper}>
                <input
                  checked={paperSize === paper}
                  name="packet-paper"
                  onChange={() => onPaperChange(paper)}
                  type="radio"
                  value={paper}
                />{" "}
                {PAPER_SIZE_LABELS[paper]}
              </label>
            ))}
          </fieldset>
          <fieldset className="packet-panel__choice" data-packet-key-placement="true">
            <legend>Answer keys</legend>
            {PACKET_KEY_PLACEMENTS.map((placement) => (
              <label key={placement}>
                <input
                  checked={keyPlacement === placement}
                  name="packet-key-placement"
                  onChange={() => onKeyPlacementChange(placement)}
                  type="radio"
                  value={placement}
                />{" "}
                {PACKET_KEY_PLACEMENT_LABELS[placement]}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      <button
        data-packet-preview="true"
        disabled={sheets.length === 0}
        id={PACKET_PREVIEW_BUTTON_ID}
        onClick={onPreview}
        type="button"
      >
        Preview packet
      </button>
      <p aria-live="polite" data-packet-announcement="true">
        {announcement}
      </p>
    </section>
  );
}
