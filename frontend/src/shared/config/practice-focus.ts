/**
 * Practice focus: the explicit operations and range a worksheet practices,
 * which replaces Difficulty and its hidden multiplier (worksheet-first plan
 * DD11 and D13).
 *
 * Each family's catalog is derived from the unchanged `MATH_PRESETS`, filtered
 * to the values that family can use and deduplicated by value, so this module
 * adds no numeric literal of its own. A stored value that matches no catalog
 * entry (a migrated child's earlier setting) is still a valid focus; it is
 * reported as `EARLIER_SETTING_OPTION_ID` and described in the same words.
 */
import {
  DRY_MATH_NUMERIC_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
} from "../worksheet/types.js";
import { MATH_PRESETS, MATH_PRESET_IDS } from "./math-presets.js";
import type {
  ArithmeticFocusV2,
  CountCompareFocusV2,
  DryMathFactsV2,
  MathSkillsV1,
  PresentationBand,
  QuantityFocusV2,
  RegroupingMode,
  SentenceVocabulary,
} from "./schema.js";

/** The four focus shapes: Dry Math, the two Wow variants, and Count, Compare & Make. */
export const PRACTICE_FOCUS_KINDS = [
  "dry-math",
  "find-the-wow-quantity",
  "find-the-wow-equation",
  "count-compare-make",
] as const;

export type PracticeFocusKind = (typeof PRACTICE_FOCUS_KINDS)[number];

export interface PracticeFocusValues {
  readonly "dry-math": ArithmeticFocusV2;
  readonly "find-the-wow-quantity": QuantityFocusV2;
  readonly "find-the-wow-equation": ArithmeticFocusV2;
  readonly "count-compare-make": CountCompareFocusV2;
}

export interface PracticeFocusOption<TKind extends PracticeFocusKind> {
  readonly id: string;
  readonly label: string;
  readonly focus: PracticeFocusValues[TKind];
}

/** The option id a stored focus outside the catalog reports. */
export const EARLIER_SETTING_OPTION_ID = "earlier-setting";

/** The internal band each plain-language vocabulary choice selects (D19). */
export const VOCABULARY_PRESENTATION_BANDS = {
  "simpler-words": "preschool",
  "all-words": "early-primary",
} as const satisfies Record<SentenceVocabulary, PresentationBand>;

/** The two vocabulary labels, exactly as DD12 states them. */
export const SENTENCE_VOCABULARY_LABELS = {
  "simpler-words": "Simpler words — for beginning readers",
  "all-words": "Include longer words",
} as const satisfies Record<SentenceVocabulary, string>;

export function presentationBandForVocabulary(
  vocabulary: SentenceVocabulary,
): PresentationBand {
  return VOCABULARY_PRESENTATION_BANDS[vocabulary];
}

/** The inverse of `presentationBandForVocabulary`, used to read a migrated band. */
export function vocabularyForPresentationBand(
  band: PresentationBand,
): SentenceVocabulary {
  return band === VOCABULARY_PRESENTATION_BANDS["all-words"]
    ? "all-words"
    : "simpler-words";
}

type ConcretePresetSkills = MathSkillsV1;

function concretePresetSkills(): readonly ConcretePresetSkills[] {
  const skills: ConcretePresetSkills[] = [];
  for (const presetId of MATH_PRESET_IDS) {
    const preset: { readonly mathSkills: MathSkillsV1 | null } =
      MATH_PRESETS[presetId];
    if (preset.mathSkills !== null) {
      skills.push(preset.mathSkills);
    }
  }
  return skills;
}

/** "Addition", "Subtraction" or "Addition and subtraction", in canonical order. */
function operationWords(operations: ArithmeticFocusV2["operations"]): string {
  return capitalized(operations.join(" and "));
}

function capitalized(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function describeArithmetic(focus: ArithmeticFocusV2): string {
  const operations = operationWords(focus.operations);
  return focus.operandMax === focus.resultMax
    ? `${operations} within ${focus.operandMax}`
    : `${operations} with numbers to ${focus.operandMax} and answers to ${focus.resultMax}`;
}

function describeQuantity(focus: QuantityFocusV2): string {
  return focus.countingMax === focus.numeralMax
    ? `Quantities to ${focus.countingMax}`
    : `Counting to ${focus.countingMax} with numerals to ${focus.numeralMax}`;
}

function describeCountCompare(focus: CountCompareFocusV2): string {
  return focus.countingMax === focus.numeralMax &&
    focus.countingMax === focus.compareMax
    ? `Quantities to ${focus.countingMax}`
    : `Counting to ${focus.countingMax}, numerals to ${focus.numeralMax} and comparisons to ${focus.compareMax}`;
}

/** What a Dry Math summary adds when every problem must carry or borrow. */
export const REGROUPING_SUMMARY_PHRASE = ", every problem carries or borrows";

/**
 * The one parent-facing description of a focus, in words: its operations and
 * range, for example "Addition and subtraction within 20" or "Quantities to 10".
 * For Dry Math a `regrouping` of `required` appends
 * `REGROUPING_SUMMARY_PHRASE`; catalog labels pass none.
 */
export function describePracticeFocus<TKind extends PracticeFocusKind>(
  kind: TKind,
  focus: PracticeFocusValues[TKind],
  regrouping: RegroupingMode = "without",
): string {
  switch (kind) {
    case "dry-math":
      return `${describeArithmetic(focus as ArithmeticFocusV2)}${
        regrouping === "required" ? REGROUPING_SUMMARY_PHRASE : ""
      }`;
    case "find-the-wow-equation":
      return describeArithmetic(focus as ArithmeticFocusV2);
    case "find-the-wow-quantity":
      return describeQuantity(focus as QuantityFocusV2);
    case "count-compare-make":
      return describeCountCompare(focus as CountCompareFocusV2);
    default:
      return unreachable(kind);
  }
}

/** One Dry Math fact entry of the practice-focus select (math-activities plan, MU2). */
export interface FactPracticeEntry {
  readonly id: string;
  readonly label: string;
  readonly operations: readonly FactOperationName[];
}

type FactOperationName = DryMathFactsV2["operations"][number];

/**
 * The three fact entries Dry Math's practice focus offers after its addition
 * and subtraction catalog, one per nonempty set of fact operations in
 * canonical order. Choosing one keeps the chosen fact families.
 */
export const FACT_PRACTICE_ENTRIES: readonly FactPracticeEntry[] = Object.freeze([
  Object.freeze({
    id: "multiplication-facts",
    label: "Multiplication facts",
    operations: Object.freeze(["multiplication"] as const),
  }),
  Object.freeze({
    id: "division-facts",
    label: "Division facts",
    operations: Object.freeze(["division"] as const),
  }),
  Object.freeze({
    id: "multiplication-and-division-facts",
    label: "Multiplication and division facts",
    operations: Object.freeze(["multiplication", "division"] as const),
  }),
]);

/** The fact entry whose operations equal these, in canonical order. */
export function matchFactPracticeEntry(
  operations: readonly FactOperationName[],
): FactPracticeEntry {
  const entry = FACT_PRACTICE_ENTRIES.find(
    (candidate) =>
      candidate.operations.length === operations.length &&
      candidate.operations.every((operation, index) => operations[index] === operation),
  );
  if (entry === undefined) {
    throw new Error("Fact operations must be a nonempty canonical subset.");
  }
  return entry;
}

/** "2", "2 and 5" or "2, 5 and 10": the families in the order given. */
function familyList(families: readonly number[]): string {
  const words = families.map(String);
  const last = words[words.length - 1] ?? "";
  return words.length <= 1 ? last : `${words.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * The one parent-facing description of a facts choice: its entry and its
 * families, for example "Multiplication facts for 2, 5 and 10".
 */
export function describeFactsFocus(facts: DryMathFactsV2): string {
  return `${matchFactPracticeEntry(facts.operations).label} for ${familyList(facts.factFamilies)}`;
}

function unreachable(value: never): never {
  throw new Error(`Unknown practice focus kind ${String(value)}.`);
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
}

function arithmeticCatalog<TKind extends "dry-math" | "find-the-wow-equation">(
  kind: TKind,
  ceiling: number,
): readonly PracticeFocusOption<TKind>[] {
  const options: PracticeFocusOption<TKind>[] = [];
  for (const skills of concretePresetSkills()) {
    if (
      skills.operations.length === 0 ||
      skills.operandMax > ceiling ||
      skills.resultMax > ceiling
    ) {
      continue;
    }
    const focus: PracticeFocusValues[TKind] = {
      operations: [...skills.operations],
      operandMax: skills.operandMax,
      resultMax: skills.resultMax,
    };
    const label = describePracticeFocus(kind, focus);
    if (!options.some((option) => option.label === label)) {
      options.push(Object.freeze({ id: slug(label), label, focus }));
    }
  }
  return Object.freeze(options);
}

function quantityCatalog(): readonly PracticeFocusOption<"find-the-wow-quantity">[] {
  const options: PracticeFocusOption<"find-the-wow-quantity">[] = [];
  for (const skills of concretePresetSkills()) {
    if (
      !skills.representations.includes("quantities") ||
      skills.countingMax > V1_NUMERIC_MAXIMUM ||
      skills.numeralMax > V1_NUMERIC_MAXIMUM
    ) {
      continue;
    }
    const focus: QuantityFocusV2 = {
      countingMax: skills.countingMax,
      numeralMax: skills.numeralMax,
    };
    const label = describePracticeFocus("find-the-wow-quantity", focus);
    if (!options.some((option) => option.label === label)) {
      options.push(Object.freeze({ id: slug(label), label, focus }));
    }
  }
  return Object.freeze(options);
}

function countCompareCatalog(): readonly PracticeFocusOption<"count-compare-make">[] {
  const options: PracticeFocusOption<"count-compare-make">[] = [];
  for (const skills of concretePresetSkills()) {
    if (
      !skills.representations.includes("quantities") ||
      skills.countingMax > V1_NUMERIC_MAXIMUM ||
      skills.numeralMax > V1_NUMERIC_MAXIMUM ||
      skills.compareMax > V1_NUMERIC_MAXIMUM
    ) {
      continue;
    }
    const focus: CountCompareFocusV2 = {
      countingMax: skills.countingMax,
      numeralMax: skills.numeralMax,
      compareMax: skills.compareMax,
    };
    const label = describePracticeFocus("count-compare-make", focus);
    if (!options.some((option) => option.label === label)) {
      options.push(Object.freeze({ id: slug(label), label, focus }));
    }
  }
  return Object.freeze(options);
}

/**
 * The closed per-family catalogs (D13). Every value fits its family's ceiling,
 * so the projection never clamps a catalog focus.
 */
export const PRACTICE_FOCUS_CATALOG: {
  readonly [TKind in PracticeFocusKind]: readonly PracticeFocusOption<TKind>[];
} = Object.freeze({
  "dry-math": arithmeticCatalog("dry-math", DRY_MATH_NUMERIC_MAXIMUM),
  "find-the-wow-quantity": quantityCatalog(),
  "find-the-wow-equation": arithmeticCatalog(
    "find-the-wow-equation",
    V1_NUMERIC_MAXIMUM,
  ),
  "count-compare-make": countCompareCatalog(),
});

function sameFocus(left: object, right: object): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** The catalog option id a stored focus equals, or `EARLIER_SETTING_OPTION_ID`. */
export function matchPracticeFocusOption<TKind extends PracticeFocusKind>(
  kind: TKind,
  focus: PracticeFocusValues[TKind],
): string {
  const catalog: readonly PracticeFocusOption<PracticeFocusKind>[] =
    PRACTICE_FOCUS_CATALOG[kind];
  const canonical = canonicalFocus(kind, focus);
  return (
    catalog.find((option) => sameFocus(canonicalFocus(kind, option.focus), canonical))
      ?.id ?? EARLIER_SETTING_OPTION_ID
  );
}

/** A key-ordered copy, so value equality ignores property order. */
function canonicalFocus(
  kind: PracticeFocusKind,
  focus: PracticeFocusValues[PracticeFocusKind],
): object {
  switch (kind) {
    case "dry-math":
    case "find-the-wow-equation": {
      const arithmetic = focus as ArithmeticFocusV2;
      return {
        operations: [...arithmetic.operations],
        operandMax: arithmetic.operandMax,
        resultMax: arithmetic.resultMax,
      };
    }
    case "find-the-wow-quantity": {
      const quantity = focus as QuantityFocusV2;
      return { countingMax: quantity.countingMax, numeralMax: quantity.numeralMax };
    }
    case "count-compare-make": {
      const countCompare = focus as CountCompareFocusV2;
      return {
        countingMax: countCompare.countingMax,
        numeralMax: countCompare.numeralMax,
        compareMax: countCompare.compareMax,
      };
    }
    default:
      return unreachable(kind);
  }
}
