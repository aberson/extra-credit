/**
 * A Tally Detective oracle written from the visual math specification
 * (section 6), not from production code. It reads a total back from drawn
 * line segments alone: a near-vertical segment is an upright mark, a slanted
 * one a crossing mark, and a bundle is one crossing that crosses exactly four
 * neighbouring uprights. Uprights no crossing claims are loose marks; there
 * may be at most four, and they must follow every bundle. Every group must
 * stand clearly apart from the next. It judges a generated page by its own
 * rules: exactly four tallies numbered item-001 to item-004, a whole number
 * of bundles and 0 to 4 loose marks totalling 1 to 20, no total repeated, and
 * each answer equal to its total. Its only `src/` import is `import type`, so
 * it adds nothing to any production bundle.
 */
import type { WorksheetDocumentV1 } from "../../src/shared/worksheet/types.js";

/** The twenty totals the specification allows, 1 through 20. */
export const ORACLE_TALLY_TOTALS: readonly number[] = Array.from({ length: 20 }, (_, index) => index + 1);

/** How many tallies one page holds. */
export const ORACLE_TALLY_COUNT = 4;

/** A drawn line segment, in screen axes (y grows downward). */
export interface OracleSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export type OracleTallyReading =
  | {
    readonly ok: true;
    readonly total: number;
    readonly bundles: number;
    readonly loose: number;
  }
  | { readonly ok: false; readonly reason: string };

/** The specification's grouping of a total: full fives, then 0 to 4 loose marks. */
export function oracleTallyGrouping(total: number): { readonly bundles: number; readonly loose: number } {
  let bundles = 0;
  let rest = total;
  while (rest >= 5) {
    bundles += 1;
    rest -= 5;
  }
  return { bundles, loose: rest };
}

/** The key line the specification asks for, for example "8 = 5 + 3". */
export function oracleTallyKeyLine(total: number): string {
  const { bundles, loose } = oracleTallyGrouping(total);
  const parts = [...Array.from({ length: bundles }, () => "5"), ...(loose > 0 ? [String(loose)] : [])];
  return `${total} = ${parts.join(" + ")}`;
}

/** Degrees a segment leans away from vertical, in [0, 90]. */
function leanFromVertical({ x1, y1, x2, y2 }: OracleSegment): number {
  return (Math.atan2(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 180) / Math.PI;
}

function centreX({ x1, x2 }: OracleSegment): number {
  return (x1 + x2) / 2;
}

/** Whether two segments cross at a point strictly inside both. */
function segmentsCross(a: OracleSegment, b: OracleSegment): boolean {
  const side = (ox: number, oy: number, px: number, py: number, qx: number, qy: number) =>
    (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
  const d1 = side(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d2 = side(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  const d3 = side(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d4 = side(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * The total that drawn segments show, or why they show none. Uprights lean
 * at most 10 degrees from vertical and crossings 20 to 70 degrees; anything
 * else, a zero-length segment, a crossing over other than four neighbouring
 * uprights, more than four loose marks (five parallel strokes are never a
 * bundle), loose marks before a bundle, or two groups no further apart than
 * the marks inside one, is refused.
 */
export function oracleReadTally(segments: readonly OracleSegment[]): OracleTallyReading {
  const uprights: OracleSegment[] = [];
  const crossings: OracleSegment[] = [];
  for (const segment of segments) {
    if (!(Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > 0)) {
      return { ok: false, reason: "a zero-length mark" };
    }
    const lean = leanFromVertical(segment);
    if (lean <= 10) {
      uprights.push(segment);
    } else if (lean >= 20 && lean <= 70) {
      crossings.push(segment);
    } else {
      return { ok: false, reason: `a mark leaning ${lean.toFixed(1)} degrees` };
    }
  }
  uprights.sort((left, right) => centreX(left) - centreX(right));
  const claimed = new Set<number>();
  const groups: { readonly first: number; readonly last: number }[] = [];
  for (const crossing of crossings) {
    const crossed = uprights.flatMap((upright, index) => (segmentsCross(crossing, upright) ? [index] : []));
    const first = crossed[0] ?? -1;
    if (
      crossed.length !== 4 ||
      crossed.some((index, position) => index !== first + position || claimed.has(index))
    ) {
      return { ok: false, reason: `a crossing over ${crossed.length} marks` };
    }
    for (const index of crossed) claimed.add(index);
    groups.push({ first, last: first + 3 });
  }
  const loose = uprights.flatMap((_, index) => (claimed.has(index) ? [] : [index]));
  if (loose.length > 4) {
    return { ok: false, reason: `${loose.length} loose marks` };
  }
  const firstLoose = loose[0];
  if (firstLoose !== undefined) {
    if (loose.some((index, position) => index !== firstLoose + position) ||
      groups.some(({ last }) => last > firstLoose)) {
      return { ok: false, reason: "loose marks before a bundle" };
    }
    groups.push({ first: firstLoose, last: firstLoose + loose.length - 1 });
  }
  groups.sort((left, right) => left.first - right.first);
  const at = (index: number) => centreX(uprights[index] as OracleSegment);
  // Inside a group marks sit close; between groups the gap must be clearly wider.
  let widestInside = 0;
  for (const { first, last } of groups) {
    for (let index = first; index < last; index += 1) {
      widestInside = Math.max(widestInside, at(index + 1) - at(index));
    }
  }
  for (const [position, group] of groups.entries()) {
    const next = groups[position + 1];
    if (next !== undefined && !(at(next.first) - at(group.last) > widestInside * 1.5)) {
      return { ok: false, reason: "two groups run together" };
    }
  }
  const total = 5 * crossings.length + loose.length;
  return total > 0
    ? { ok: true, total, bundles: crossings.length, loose: loose.length }
    : { ok: false, reason: "no marks" };
}

export type TallyOracleCode =
  | "WRONG_COUNT"
  | "MIXED_FAMILY"
  | "BAD_ID"
  | "MALFORMED_GROUPING"
  | "OUT_OF_SET"
  | "DUPLICATE_TOTAL"
  | "WRONG_ANSWER";

export interface TallyOracleViolation {
  readonly itemId: string;
  readonly code: TallyOracleCode;
}

/** Every rule a generated Tally Detective page breaks, judged from its items alone. */
export function judgeTallyDocument(document: WorksheetDocumentV1): readonly TallyOracleViolation[] {
  const violations: TallyOracleViolation[] = [];
  if (document.items.length !== ORACLE_TALLY_COUNT) {
    violations.push({ itemId: "*", code: "WRONG_COUNT" });
  }
  const seen = new Set<number>();
  for (const [index, item] of document.items.entries()) {
    if (item.id !== `item-00${index + 1}`) {
      violations.push({ itemId: item.id, code: "BAD_ID" });
    }
    if (item.itemType !== "tally-detective") {
      violations.push({ itemId: item.id, code: "MIXED_FAMILY" });
      continue;
    }
    const { bundles, remainder } = item;
    if (
      !Number.isInteger(bundles) || !Number.isInteger(remainder) ||
      bundles < 0 || remainder < 0 || remainder > 4
    ) {
      violations.push({ itemId: item.id, code: "MALFORMED_GROUPING" });
      continue;
    }
    const total = 5 * bundles + remainder;
    if (!ORACLE_TALLY_TOTALS.includes(total)) {
      violations.push({ itemId: item.id, code: "OUT_OF_SET" });
    }
    if (seen.has(total)) {
      violations.push({ itemId: item.id, code: "DUPLICATE_TOTAL" });
    }
    seen.add(total);
    if (item.answer.kind !== "number" || item.answer.value !== total) {
      violations.push({ itemId: item.id, code: "WRONG_ANSWER" });
    }
  }
  return violations;
}
