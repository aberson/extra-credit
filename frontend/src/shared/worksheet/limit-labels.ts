import type { ChildProfileV1 } from "../config/schema.js";
import type { WorksheetLength } from "./types.js";

export type WorksheetRelevantMaximumKey = keyof Pick<
  ChildProfileV1["mathSkills"],
  "countingMax" | "numeralMax" | "compareMax" | "operandMax" | "resultMax"
>;

/**
 * The one parent-facing noun for each stored maximum.
 *
 * Two different surfaces name these numbers: the registration's declared
 * relevant-maximum lists (which drive the stretch preview, the above-20
 * notice, and the issue #16 exhaustion advice) and a family's own capacity
 * shortage sentence. A second copy of "comparisons" would let a rename fix one
 * surface and leave the other saying something else about the same field, so
 * both derive from this record.
 */
export const WORKSHEET_MAXIMUM_LABELS = {
  countingMax: "counting",
  numeralMax: "numerals",
  compareMax: "comparisons",
  operandMax: "operands",
  resultMax: "results",
} as const satisfies Record<WorksheetRelevantMaximumKey, string>;

export interface WorksheetRelevantMaximumV1 {
  readonly key: WorksheetRelevantMaximumKey;
  readonly label: string;
}

function maximumList(
  keys: readonly WorksheetRelevantMaximumKey[],
): readonly WorksheetRelevantMaximumV1[] {
  return Object.freeze(
    keys.map((key) => ({ key, label: WORKSHEET_MAXIMUM_LABELS[key] })),
  );
}

export const OPERAND_RESULT_MAXIMUM_KEYS = Object.freeze([
  "operandMax",
  "resultMax",
] as const satisfies readonly WorksheetRelevantMaximumKey[]);

export const COUNTING_NUMERAL_MAXIMUM_KEYS = Object.freeze([
  "countingMax",
  "numeralMax",
] as const satisfies readonly WorksheetRelevantMaximumKey[]);

export const COUNTING_NUMERAL_COMPARE_MAXIMUM_KEYS = Object.freeze([
  "countingMax",
  "numeralMax",
  "compareMax",
] as const satisfies readonly WorksheetRelevantMaximumKey[]);

export const OPERAND_RESULT_MAXIMUMS = maximumList(OPERAND_RESULT_MAXIMUM_KEYS);

export const COUNTING_NUMERAL_MAXIMUMS = maximumList(
  COUNTING_NUMERAL_MAXIMUM_KEYS,
);

export const COUNTING_NUMERAL_COMPARE_MAXIMUMS = maximumList(
  COUNTING_NUMERAL_COMPARE_MAXIMUM_KEYS,
);

export const NO_MAXIMUMS: readonly WorksheetRelevantMaximumV1[] = Object.freeze(
  [],
);

/** The one list joiner every parent-facing sentence in this layer uses. */
export function joinLabels(labels: readonly string[]): string {
  const last = labels[labels.length - 1];
  if (last === undefined) {
    return "";
  }
  if (labels.length === 1) {
    return last;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${last}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${last}`;
}

/** The lengths a parent could switch to that are shorter than the given one. */
const SHORTER_WORKSHEET_LENGTHS = {
  short: [],
  standard: ["short"],
  long: ["standard", "short"],
} as const satisfies Record<WorksheetLength, readonly WorksheetLength[]>;

/**
 * Whether "choose a shorter worksheet" is a REAL remedy for this shortage.
 *
 * Length is not the same thing as required work: large print already pulls an
 * activity down to the next shorter budget, and Count, Compare & Make asks for
 * the same two comparisons at short and at standard. Offering the remedy
 * anyway is the issue #16 failure mode inside a single family - advice a
 * parent can follow that cannot change the answer - so the caller proves the
 * shorter option really needs fewer of the resource that fell short.
 */
export function shorterLengthLowersRequirement(
  length: WorksheetLength,
  required: number,
  requirementFor: (length: WorksheetLength) => number,
): boolean {
  return SHORTER_WORKSHEET_LENGTHS[length].some(
    (shorter) => requirementFor(shorter) < required,
  );
}

/**
 * The remedy clause of a capacity shortage sentence.
 *
 * `limitKeys` names the stored maxima that actually bound the resource that
 * fell short, never every maximum the family reads: for a group-comparison
 * shortage bounded by `compareMax`, sending the parent to the counting limit
 * is advice that cannot change the outcome.
 */
export function capacityRemedySentence(
  shorterLengthHelps: boolean,
  limitKeys: readonly WorksheetRelevantMaximumKey[],
): string {
  if (limitKeys.length === 0) {
    // No stored maximum can move this shortage, so naming one would be the
    // issue #16 failure mode again - and an empty list would otherwise print
    // "review the profile's  limits" with no noun at all.
    return shorterLengthHelps
      ? "Choose a shorter worksheet."
      : "No profile limit can widen this selection.";
  }
  const limits = joinLabels(
    limitKeys.map((key) => WORKSHEET_MAXIMUM_LABELS[key]),
  );
  return shorterLengthHelps
    ? `Choose a shorter worksheet or review the profile's ${limits} limits.`
    : `Review the profile's ${limits} limits.`;
}

/**
 * The subset of `candidates` holding the lowest value, i.e. the stored maxima
 * a `Math.min` over them actually selected. Ties name every tied field because
 * raising only one of them would not move the minimum.
 */
export function bindingMaximumKeys(
  candidates: readonly (readonly [WorksheetRelevantMaximumKey, number])[],
): readonly WorksheetRelevantMaximumKey[] {
  const lowest = Math.min(...candidates.map(([, value]) => value));
  return candidates
    .filter(([, value]) => value === lowest)
    .map(([key]) => key);
}

/** The five stored maxima a counterfactual probe reads and rewrites. */
export type WorksheetMaximumValues = Readonly<
  Record<WorksheetRelevantMaximumKey, number>
>;

/**
 * The value a probe substitutes for the maximum it lifts out of the way.
 *
 * Every family clamps its own limits to the Version 1 envelope before it
 * enumerates, so a maximum above that envelope is measured at the family's own
 * ceiling. Asking for "no bound at all" therefore needs no second copy of the
 * envelope number here.
 */
export const UNBOUNDED_MAXIMUM = Number.MAX_SAFE_INTEGER;

/**
 * The subset of `keys` a parent could really move, decided by re-measuring
 * capacity with each one lifted.
 *
 * `bindingMaximumKeys` above models a `Math.min`, where the lowest candidate IS
 * the bound. Operands and results do not compose that way: they bound a
 * candidate collection INDEPENDENTLY through a filter, so the lower of the two
 * is not necessarily the one that is holding the count down - at operands 20
 * and results 2 an addition pool is bounded by the results alone, and at
 * operands 2 and results 20 a subtraction pool is bounded by the operands
 * alone. A `Math.min` would name a number already at the ceiling `clampPositive`
 * enforces, which is issue #16's failure mode: advice the parent cannot act on.
 * This asks the family's own enumeration instead, and names a maximum only when
 * lifting it really does enlarge the collection.
 */
export function bindingMaximumKeysByProbe(
  maximums: WorksheetMaximumValues,
  keys: readonly WorksheetRelevantMaximumKey[],
  capacity: number,
  measureCapacity: (maximums: WorksheetMaximumValues) => number,
): readonly WorksheetRelevantMaximumKey[] {
  return keys.filter((key) => {
    const lifted: Record<WorksheetRelevantMaximumKey, number> = { ...maximums };
    lifted[key] = UNBOUNDED_MAXIMUM;
    return measureCapacity(lifted) > capacity;
  });
}
