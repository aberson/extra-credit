/**
 * Labels the worksheet panel prints that the printable packet's rows also
 * print. They live in this leaf so both import one owner; a component module
 * may export only components.
 */
import type { ChildProfileV2 } from "../../shared/config/schema";
import type { WorksheetLength } from "../../shared/worksheet/types";

/** The Length options' names. */
export const WORKSHEET_LENGTH_LABELS = {
  short: "Short",
  standard: "Standard",
  long: "Long",
} as const satisfies Record<WorksheetLength, string>;

/** Each child by nickname, or as "Profile N" when it has none (U3). */
export function profileLabel(profile: ChildProfileV2, index: number): string {
  return profile.displayName ?? `Profile ${index + 1}`;
}
