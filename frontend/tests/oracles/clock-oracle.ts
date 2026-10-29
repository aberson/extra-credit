/**
 * A Clock Explorer oracle written from the visual math specification
 * (section 6), not from production code. It reads a time back from where two
 * drawn hands point: the long hand must point at twelve, and the short hand's
 * angle, a whole number of 30-degree steps clockwise from twelve, names the
 * hour, twelve itself being zero steps. It judges a generated page by its own
 * rules: exactly four clocks numbered item-001 to item-004, hours from 1 to
 * 12 with none repeated, and each answer equal to its hour. Its only `src/`
 * import is `import type`, so it adds nothing to any production bundle.
 */
import type { WorksheetDocumentV1 } from "../../src/shared/worksheet/types.js";

/** The twelve on-the-hour times the specification allows, 1 through 12. */
export const ORACLE_CLOCK_HOURS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** How many clocks one page holds. */
export const ORACLE_CLOCK_COUNT = 4;

/** How far, in degrees, a drawn hand may sit from its exact direction. */
export const ORACLE_ANGLE_TOLERANCE = 1.5;

export type ClockOracleCode =
  | "WRONG_COUNT"
  | "MIXED_FAMILY"
  | "BAD_ID"
  | "OUT_OF_SET"
  | "DUPLICATE_HOUR"
  | "WRONG_ANSWER";

export interface ClockOracleViolation {
  readonly itemId: string;
  readonly code: ClockOracleCode;
}

/** A drawn hand as a vector from the dial's centre, in screen axes (y grows downward). */
export interface OracleHandVector {
  readonly dx: number;
  readonly dy: number;
}

/** Degrees clockwise from twelve, in [0, 360). */
export function oracleHandDegrees({ dx, dy }: OracleHandVector): number {
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** Where each hand of an on-the-hour time points, by the specification's rule. */
export function oracleClockFace(hour: number): { readonly minuteDegrees: number; readonly hourDegrees: number } {
  return { minuteDegrees: 0, hourDegrees: hour === 12 ? 0 : hour * 30 };
}

/** The smallest angle between two directions, in degrees. */
export function oracleAngleBetween(left: number, right: number): number {
  const difference = Math.abs(left - right) % 360;
  return Math.min(difference, 360 - difference);
}

/**
 * The on-the-hour time two drawn hands show, or `undefined` when they show
 * none: the long hand must be the longer one and point at twelve, and the
 * short hand must point at a whole hour.
 */
export function oracleHourFromHands(
  minute: OracleHandVector,
  hour: OracleHandVector,
): number | undefined {
  const minuteLength = Math.hypot(minute.dx, minute.dy);
  const hourLength = Math.hypot(hour.dx, hour.dy);
  if (!(minuteLength > hourLength && hourLength > 0)) {
    return undefined;
  }
  if (oracleAngleBetween(oracleHandDegrees(minute), 0) > ORACLE_ANGLE_TOLERANCE) {
    return undefined;
  }
  const hourDegrees = oracleHandDegrees(hour);
  const steps = Math.round(hourDegrees / 30) % 12;
  if (oracleAngleBetween(hourDegrees, steps * 30) > ORACLE_ANGLE_TOLERANCE) {
    return undefined;
  }
  return steps === 0 ? 12 : steps;
}

/** The key line the specification asks for, for example "3:00 — long hand at 12, short hand at 3". */
export function oracleClockKeyLine(hour: number): string {
  return `${hour}:00 — long hand at 12, short hand at ${hour}`;
}

/** Every rule a generated Clock Explorer page breaks, judged from its items alone. */
export function judgeClockDocument(document: WorksheetDocumentV1): readonly ClockOracleViolation[] {
  const violations: ClockOracleViolation[] = [];
  if (document.items.length !== ORACLE_CLOCK_COUNT) {
    violations.push({ itemId: "*", code: "WRONG_COUNT" });
  }
  const seen = new Set<number>();
  for (const [index, item] of document.items.entries()) {
    if (item.id !== `item-00${index + 1}`) {
      violations.push({ itemId: item.id, code: "BAD_ID" });
    }
    if (item.itemType !== "clock-explorer") {
      violations.push({ itemId: item.id, code: "MIXED_FAMILY" });
      continue;
    }
    if (!ORACLE_CLOCK_HOURS.includes(item.hour)) {
      violations.push({ itemId: item.id, code: "OUT_OF_SET" });
    }
    if (seen.has(item.hour)) {
      violations.push({ itemId: item.id, code: "DUPLICATE_HOUR" });
    }
    seen.add(item.hour);
    if (item.answer.kind !== "number" || item.answer.value !== item.hour) {
      violations.push({ itemId: item.id, code: "WRONG_ANSWER" });
    }
  }
  return violations;
}
