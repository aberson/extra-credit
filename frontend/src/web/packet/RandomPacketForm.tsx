import { useState } from "react";

import { getWorksheetRegistration } from "../../shared/worksheet/registry";
import { WORKSHEET_TYPE_IDS, type WorksheetType } from "../../shared/worksheet/types";
import { PACKET_SHEET_LIMIT } from "./packet-session";
import {
  DEFAULT_RANDOM_PACKET_LEVEL,
  RANDOM_PACKET_LEVELS,
  RANDOM_PACKET_LEVEL_LABELS,
  type RandomPacketChoice,
  type RandomPacketLevel,
} from "./random-packet";

/** The Pages choice a fresh form starts at, before the packet's room bounds it. */
export const DEFAULT_RANDOM_PACKET_PAGES = 5;

const RANDOM_PACKET_REASON_ID = "random-packet-reason";

interface RandomPacketFormProps {
  /** How many more sheets the packet can hold. */
  readonly room: number;
  /** Whether the worksheet panel has a child selected to make the sheets for. */
  readonly childChosen: boolean;
  readonly disabled: boolean;
  /** The outcome of the last Make random packet, if any. */
  readonly message: string | null;
  readonly onMake: (choice: RandomPacketChoice) => void;
}

/**
 * "Random packet": a checkbox per family, how many pages (one worksheet
 * each, at most the packet's room) and a difficulty. Make random packet is
 * disabled, with its reason, while no child is chosen, the packet is full or
 * no family is ticked. Why a press added nothing is a polite live region
 * without role="status", like Add to packet's; what it added shows in the
 * packet preview it opens.
 */
export function RandomPacketForm({ childChosen, disabled, message, onMake, room }: RandomPacketFormProps) {
  const [families, setFamilies] = useState<readonly WorksheetType[]>(WORKSHEET_TYPE_IDS);
  const [pages, setPages] = useState(DEFAULT_RANDOM_PACKET_PAGES);
  const [level, setLevel] = useState<RandomPacketLevel>(DEFAULT_RANDOM_PACKET_LEVEL);
  const shownPages = Math.max(1, Math.min(pages, room));
  const reason = !childChosen
    ? "Add a child profile first."
    : room === 0
      ? `The packet already holds ${PACKET_SHEET_LIMIT} sheets. Remove a sheet to add more.`
      : families.length === 0
        ? "Tick at least one worksheet to include."
        : null;

  function toggle(family: WorksheetType, checked: boolean): void {
    setFamilies((current) =>
      WORKSHEET_TYPE_IDS.filter((candidate) =>
        candidate === family ? checked : current.includes(candidate),
      ),
    );
  }

  return (
    <section
      aria-labelledby="random-packet-title"
      className="random-packet"
      data-random-packet="true"
    >
      <h2 id="random-packet-title">Random packet</h2>
      <p>
        Adds new worksheets for the child chosen above. Difficulty sets each
        worksheet's practice; length, print size, answer key, Theme and the
        other choices above stay as they are.
      </p>
      <fieldset className="random-packet__choice" data-random-packet-families="true">
        <legend>Include</legend>
        {WORKSHEET_TYPE_IDS.map((family) => (
          <label key={family}>
            <input
              checked={families.includes(family)}
              name="random-packet-family"
              onChange={(event) => toggle(family, event.currentTarget.checked)}
              type="checkbox"
              value={family}
            />{" "}
            {getWorksheetRegistration(family).displayName}
          </label>
        ))}
      </fieldset>
      <label className="random-packet__pages">
        Pages{" "}
        <select
          disabled={room === 0}
          onChange={(event) => setPages(Number(event.currentTarget.value))}
          value={shownPages}
        >
          {Array.from({ length: Math.max(1, room) }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
      <p className="random-packet__hint">One worksheet per page; any answer keys print on their own pages.</p>
      <fieldset className="random-packet__choice" data-random-packet-level="true">
        <legend>Difficulty</legend>
        {RANDOM_PACKET_LEVELS.map((choice) => (
          <label key={choice}>
            <input
              checked={level === choice}
              name="random-packet-level"
              onChange={() => setLevel(choice)}
              type="radio"
              value={choice}
            />{" "}
            {RANDOM_PACKET_LEVEL_LABELS[choice].label}
            <span className="random-packet__hint"> — {RANDOM_PACKET_LEVEL_LABELS[choice].hint}</span>
          </label>
        ))}
      </fieldset>
      <p className="random-packet__hint">Difficulty picks each worksheet's practice focus; it is not a grade level.</p>
      <button
        aria-describedby={reason === null ? undefined : RANDOM_PACKET_REASON_ID}
        disabled={disabled || reason !== null}
        onClick={() => onMake({ families, pages: shownPages, level })}
        type="button"
      >
        Make random packet
      </button>
      {reason !== null && (
        <p data-random-packet-reason="true" id={RANDOM_PACKET_REASON_ID}>
          {reason}
        </p>
      )}
      <p aria-live="polite" data-random-packet-message="true">
        {message}
      </p>
    </section>
  );
}
