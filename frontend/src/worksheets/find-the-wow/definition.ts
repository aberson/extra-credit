import {
  OPERAND_RESULT_MAXIMUM_KEYS,
  bindingMaximumKeys,
  bindingMaximumKeysByProbe,
  capacityRemedySentence,
  shorterLengthFills,
  type WorksheetMaximumValues,
} from "../../shared/worksheet/limit-labels.js";
import type { FIND_THE_WOW_VARIANTS } from "../../shared/config/enums.js";
import {
  V1_NUMERIC_MAXIMUM,
  type EffectiveMathSkillsV1,
  type PrintScale,
  type WorksheetLength,
} from "../../shared/worksheet/types.js";

export const FIND_THE_WOW_DEFINITION = {
  id: "find-the-wow",
  displayName: "Math — Two Whats and a Wow",
  generatorVersion: 1,
  usesInterests: false,
  hasAnswerKey: true,
} as const;

export const FIND_THE_WOW_GROUP_BUDGETS = {
  short: 4,
  standard: 6,
  long: 8,
} as const satisfies Record<WorksheetLength, number>;

/**
 * The Version 1 source envelope this family enumerates within.
 *
 * The selection schema already bounds every Wow focus to it, and the
 * earlier-settings mapping clamps a stored value into that range; the family
 * repeats the clamp so its own limit arithmetic cannot widen past the
 * envelope, and names it once so the enumeration and the tests that assert
 * which maximum bound a pool read the same number.
 *
 * A re-export of the one envelope constant, never a second literal: the two
 * are the same number by construction rather than by agreement.
 */
export const FIND_THE_WOW_V1_MAXIMUM = V1_NUMERIC_MAXIMUM;

/**
 * `min(countingMax, numeralMax, FIND_THE_WOW_V1_MAXIMUM)`: the distinct
 * quantity stems this family can draw from.
 *
 * Exported because the quantity pool IS a `Math.min` over those two stored
 * maxima, so which one is binding can be read off this value - and reading it
 * off a second copy of the formula is how a limit change stops being visible
 * to the surface that explains it to a parent.
 */
export function getQuantityWowLimit(
  mathSkills: Pick<EffectiveMathSkillsV1, "countingMax" | "numeralMax">,
): number {
  return Math.min(
    mathSkills.countingMax,
    mathSkills.numeralMax,
    FIND_THE_WOW_V1_MAXIMUM,
  );
}

export function getFindTheWowGroupCount(
  length: WorksheetLength,
  printScale: PrintScale,
): number {
  if (printScale !== "large") {
    return FIND_THE_WOW_GROUP_BUDGETS[length];
  }
  return length === "long"
    ? FIND_THE_WOW_GROUP_BUDGETS.standard
    : FIND_THE_WOW_GROUP_BUDGETS.short;
}

/** The two statement kinds: the Statements variant a parent chooses. */
export type FindTheWowMode = (typeof FIND_THE_WOW_VARIANTS)[number];

/** The parent-visible name of each Statements variant (U2). */
export const FIND_THE_WOW_VARIANT_LABELS = {
  quantity: "Quantity pictures",
  equation: "Equations",
} as const satisfies Record<FindTheWowMode, string>;

export type FindTheWowCapabilitySupport =
  | { readonly available: true; readonly mode: FindTheWowMode }
  | { readonly available: false; readonly reason: string };

export function getFindTheWowCapabilitySupport(
  mathSkills: Pick<
    EffectiveMathSkillsV1,
    "representations" | "understandsEquality" | "operations"
  >,
): FindTheWowCapabilitySupport {
  const hasQuantities = mathSkills.representations.includes("quantities");
  const hasEquationGate =
    mathSkills.representations.includes("equations") &&
    mathSkills.understandsEquality &&
    mathSkills.operations.length > 0;

  if (hasEquationGate) {
    return { available: true, mode: "equation" };
  }
  if (hasQuantities) {
    return { available: true, mode: "quantity" };
  }
  return {
    available: false,
    reason:
      "Two Whats and a Wow needs quantities, or equations with equality understanding and an enabled operation. Choose Quantity pictures or Equations under Statements, with a practice focus that includes an operation for Equations.",
  };
}

/**
 * The one shortage sentence Two Whats and a Wow prints, whoever asks.
 *
 * `getFindTheWowCapabilitySupport` above resolves a MODE and nothing else, so
 * before issue #14 the control could promise a page the generator then refused
 * - reachable whenever a practice focus holds fewer distinct stems than the
 * length needs, for example quantities to 7 on a long page that needs 8. The
 * registration now asks for a capacity verdict beside the mode and both sides
 * render this sentence.
 *
 * The remedy names the maxima THIS MODE reads, and within the mode only the
 * ones that are really binding: a quantity page explained in terms of operands
 * would be advice the parent cannot act on, and so is a quantity page whose
 * counting limit already sits at the Version 1 ceiling while its numeral limit
 * is what the pool ran out of.
 *
 * The two modes need two different discriminators. A quantity pool is
 * `getQuantityWowLimit` above, so the lowest candidate IS the bound and a tie
 * must name both. An equation pool bounds
 * operands and results independently through a filter, so its binding maxima
 * are found by re-measuring with each one lifted; `measureCapacity` re-runs the
 * caller's own enumeration for that.
 */
export function findTheWowCapacityShortfall(
  mode: FindTheWowMode,
  capacity: number,
  maximums: WorksheetMaximumValues,
  measureCapacity: (maximums: WorksheetMaximumValues) => number,
  length: WorksheetLength,
  printScale: PrintScale,
): string | undefined {
  const required = getFindTheWowGroupCount(length, printScale);
  if (capacity >= required) {
    return undefined;
  }
  const remedy = capacityRemedySentence(
    shorterLengthFills(length, capacity, (shorter) =>
      getFindTheWowGroupCount(shorter, printScale),
    ),
    mode === "equation"
      ? bindingMaximumKeysByProbe(
          maximums,
          OPERAND_RESULT_MAXIMUM_KEYS,
          capacity,
          measureCapacity,
        )
      : bindingMaximumKeys([
          ["countingMax", maximums.countingMax],
          ["numeralMax", maximums.numeralMax],
        ]),
  );
  return `This practice focus provides ${capacity} unique ${mode} groups, but this length needs ${required}. ${remedy}`;
}
