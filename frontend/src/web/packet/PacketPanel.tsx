import { useLayoutEffect, useRef, useState } from "react";

import type { ChildProfileV2 } from "../../shared/config/schema";
import {
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
  readonly onMoveUp: (worksheetId: string) => void;
  readonly onMoveDown: (worksheetId: string) => void;
  readonly onRemove: (worksheetId: string) => void;
}

/** Where keyboard focus goes once the panel re-renders after a row action. */
type PendingFocus =
  | { readonly kind: "row"; readonly worksheetId: string; readonly action: "up" | "down" }
  | { readonly kind: "after-remove"; readonly position: number };

/**
 * The printable packet: its count against the limit, the session-only
 * sentence and one row per queued sheet in packet order, each with Move up,
 * Move down and Remove. Focus stays with the sheet a parent moves, moving to
 * its other button when the one pressed reaches an end, and after a removal
 * lands on the next row's Remove, the previous row's, or the panel heading.
 */
export function PacketPanel({ onMoveDown, onMoveUp, onRemove, profiles, sheets }: PacketPanelProps) {
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
      <p aria-live="polite" data-packet-announcement="true">
        {announcement}
      </p>
    </section>
  );
}
