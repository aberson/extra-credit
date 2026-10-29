import {
  TALLY_DETECTIVE_BUNDLE_SIZE,
  TALLY_DETECTIVE_ITEM_COUNT,
  TALLY_DETECTIVE_TOTAL_MAXIMUM,
  type TallyDetectiveItemV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";

/*
 * Tally Detective (master plan Step 36, visual math specification section 6):
 * four distinct tallies per page, totals 1 to 20. Each tally is drawn from its
 * bundle count and remainder alone: every full five is four upright marks
 * crossed by a fifth, then 0 to 4 loose upright marks follow, so 8 reads as
 * 5 + 3 and 20 as four full bundles. The child writes the total on a line;
 * the separate key writes it as its bundles and loose marks, for example
 * "8 = 5 + 3". The domain is fixed, so no parent choice widens or narrows it.
 */

export const TALLY_DETECTIVE_DEFINITION = {
  id: "tally-detective",
  displayName: "Tally Detective",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

/** The worksheet-type card's one line. */
export const TALLY_DETECTIVE_CARD_DESCRIPTION =
  "Count four sets of tally marks grouped in fives and write each total.";

/** The page instruction under the title: the question, then what to write. */
export const TALLY_DETECTIVE_INSTRUCTION =
  "How many tally marks? Count each set and write the number on its line.";

/** The text before each tally's drawn writing line. */
export const TALLY_DETECTIVE_RESPONSE_PREFIX = "How many?";

/**
 * What bounds a Tally Detective page's variety, for the shared exhaustion
 * message. The twenty totals are the whole domain and no control widens it,
 * so the sentence names no practice focus, range or length.
 */
export const TALLY_DETECTIVE_LIMITING_RESOURCE_ADVICE = `Tally Detective draws ${TALLY_DETECTIVE_ITEM_COUNT} tallies from a fixed set of ${TALLY_DETECTIVE_TOTAL_MAXIMUM} totals, which no other choice changes. Create a new worksheet later.`;

/** A total's grouping: its full bundles of five and the loose marks after them. */
export function tallyGroupingOf(total: number): {
  readonly bundles: number;
  readonly remainder: number;
} {
  return {
    bundles: Math.floor(total / TALLY_DETECTIVE_BUNDLE_SIZE),
    remainder: total % TALLY_DETECTIVE_BUNDLE_SIZE,
  };
}

/** The total a grouping shows: five for every bundle, plus the loose marks. */
export function tallyTotalOf(item: Pick<TallyDetectiveItemV1, "bundles" | "remainder">): number {
  return TALLY_DETECTIVE_BUNDLE_SIZE * item.bundles + item.remainder;
}

/**
 * The tally as the key writes it, one addend per drawn group: a 5 for every
 * bundle, then the loose marks, for example "5 + 3", "5 + 5 + 5 + 5" or "4".
 */
export function tallyDecompositionText(
  item: Pick<TallyDetectiveItemV1, "bundles" | "remainder">,
): string {
  const parts: number[] = Array.from({ length: item.bundles }, () => TALLY_DETECTIVE_BUNDLE_SIZE);
  if (item.remainder > 0) {
    parts.push(item.remainder);
  }
  return parts.join(" + ");
}

/** One key line's text after its number, for example "8 = 5 + 3". */
export function tallyKeyText(item: Pick<TallyDetectiveItemV1, "bundles" | "remainder">): string {
  return `${tallyTotalOf(item)} = ${tallyDecompositionText(item)}`;
}

/**
 * A document's tallies, or `undefined` when it is not exactly a Tally
 * Detective page of tally items: the renderer and the key refuse to draw
 * anything else.
 */
export function tallyItemsOf(
  document: WorksheetDocumentV1,
): readonly TallyDetectiveItemV1[] | undefined {
  const items = document.items;
  return document.worksheetType === "tally-detective" &&
    items.every((item) => item.itemType === "tally-detective")
    ? (items as readonly TallyDetectiveItemV1[])
    : undefined;
}
