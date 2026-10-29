import {
  CLOCK_EXPLORER_HOUR_MAXIMUM,
  CLOCK_EXPLORER_ITEM_COUNT,
  type ClockExplorerItemV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";

/*
 * Clock Explorer (master plan Step 35, visual math specification section 6):
 * four distinct on-the-hour clocks per page. Each clock is drawn from its hour
 * alone: every label from 1 to 12, the long minute hand at twelve and the
 * shorter, heavier hour hand `30 × (hour mod 12)` degrees clockwise from
 * twelve. The child writes the hour before a printed `:00`; the separate key
 * names the time and where each hand points. The domain is fixed, so no
 * parent choice widens or narrows it.
 */

export const CLOCK_EXPLORER_DEFINITION = {
  id: "clock-explorer",
  displayName: "Clock Explorer",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

/** The worksheet-type card's one line. */
export const CLOCK_EXPLORER_CARD_DESCRIPTION =
  "Read four on-the-hour clocks and write each time.";

/** The page instruction under the title. */
export const CLOCK_EXPLORER_INSTRUCTION =
  "Read each clock. Write the hour on the line.";

/** The text before and after each clock's drawn writing line. */
export const CLOCK_EXPLORER_RESPONSE_PREFIX = "Time:";
export const CLOCK_EXPLORER_RESPONSE_SUFFIX = ":00";

/**
 * What bounds a Clock Explorer page's variety, for the shared exhaustion
 * message. The twelve hours are the whole domain and no control widens it, so
 * the sentence names no practice focus, range or length.
 */
export const CLOCK_EXPLORER_LIMITING_RESOURCE_ADVICE = `Clock Explorer draws ${CLOCK_EXPLORER_ITEM_COUNT} clocks from a fixed set of ${CLOCK_EXPLORER_HOUR_MAXIMUM} on-the-hour times, which no other choice changes. Create a new worksheet later.`;

/** Where the hour hand points: `30 × (hour mod 12)` degrees clockwise from twelve. */
export function clockHourHandDegrees(hour: number): number {
  return 30 * (hour % 12);
}

/** Where the minute hand of an on-the-hour time points: at twelve. */
export const CLOCK_MINUTE_HAND_DEGREES = 0;

/** The time as the key writes it, for example "3:00". */
export function clockTimeText(hour: number): string {
  return `${hour}${CLOCK_EXPLORER_RESPONSE_SUFFIX}`;
}

/**
 * Where the hands point as the key and the clock's spoken label say it, for
 * example "long hand at 12, short hand at 3".
 */
export function clockHandsText(hour: number): string {
  return `long hand at 12, short hand at ${hour}`;
}

/** One key line's text after its number, for example "3:00 — long hand at 12, short hand at 3". */
export function clockKeyText(hour: number): string {
  return `${clockTimeText(hour)} — ${clockHandsText(hour)}`;
}

/**
 * A document's clocks, or `undefined` when it is not exactly a Clock Explorer
 * page of clock items: the renderer and the key refuse to draw anything else.
 */
export function clockItemsOf(
  document: WorksheetDocumentV1,
): readonly ClockExplorerItemV1[] | undefined {
  const items = document.items;
  return document.worksheetType === "clock-explorer" &&
    items.every((item) => item.itemType === "clock-explorer")
    ? (items as readonly ClockExplorerItemV1[])
    : undefined;
}
