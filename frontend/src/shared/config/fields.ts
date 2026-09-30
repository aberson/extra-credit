/**
 * Field building blocks every config schema version shares, as a leaf module.
 * It imports nothing from `schema.ts` or `legacy-v1.ts`;
 * `tests/integration/config-module-graph.test.ts` enforces the direction.
 */
import { z } from "zod";

import {
  normalizeProfileText,
  unicodeCharacterLength,
} from "./normalize.js";

export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function isIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const normalizedBoundedText = (maximum: number) =>
  z
    .string()
    .transform(normalizeProfileText)
    .pipe(
      z.string().superRefine((value, context) => {
        const length = unicodeCharacterLength(value);
        if (length < 1) {
          context.addIssue({
            code: "custom",
            message: "Enter at least one character.",
          });
        } else if (length > maximum) {
          context.addIssue({
            code: "custom",
            message: `Enter no more than ${maximum} characters.`,
          });
        }
      }),
    );
