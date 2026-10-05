import {
  FACT_OPERATIONS,
  MATH_OPERATIONS,
  NUMBER_BONDS_REGROUPING_MODES,
} from "../config/enums.js";
import { objectiveAnswerMatches } from "./answer-oracle.js";
import { factKey, isInFactFamily, regroups } from "./arithmetic.js";
import {
  FACT_DIVIDEND_MAXIMUM,
  FACT_FACTOR_MAXIMUM,
  GENERATION_INVARIANT_FAILED,
  NUMBER_BONDS_WHOLE_MINIMUM,
  TOPIC_IDS,
  V1_NUMERIC_MAXIMUM,
  DRY_MATH_NUMERIC_MAXIMUM,
  type DryMathItemV1,
  type EffectiveMathSkillsV1,
  type FactOperation,
  type GenerationFailure,
  type GenerationRequestV1,
  type NumberBondItemV1,
  type ObjectiveAnswerV1,
  type PracticeRequestV1,
  type WorksheetDocumentV1,
  type WorksheetItemV1,
} from "./types.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface ObjectiveAnswerEntryV1 {
  readonly itemId: string;
  readonly answer: ObjectiveAnswerV1;
}

function recursivelyCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(recursivelyCanonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, recursivelyCanonicalize(child)]),
    );
  }
  return value;
}

export function canonicalContentKey(items: readonly WorksheetItemV1[]): string {
  return JSON.stringify(recursivelyCanonicalize(items));
}

export function objectiveAnswerEntries(
  document: WorksheetDocumentV1,
): readonly ObjectiveAnswerEntryV1[] {
  return document.items
    .filter(
      (item): item is Exclude<WorksheetItemV1, { answerability: "open" }> =>
        item.answerability === "objective",
    )
    .map((item) => ({ itemId: item.id, answer: item.answer }));
}

/**
 * Which Dry Math item check a request's `practice` member selects
 * (math-activities plan, D60): the addition and subtraction branch, in which
 * every item carries or borrows or none does, or the facts branch with its
 * operations and families.
 */
type DryMathBranch =
  | { readonly kind: "add-subtract"; readonly regroupingRequired: boolean }
  | {
      readonly kind: "facts";
      readonly operations: readonly FactOperation[];
      readonly factFamilies: readonly number[];
    };

/** Whether a facts member names canonical operations and ascending families in range. */
function factsMemberIsWellFormed(
  practice: Extract<PracticeRequestV1, { readonly kind: "dry-math-facts" }>,
): boolean {
  const operationIndexes = practice.operations.map((operation) =>
    (FACT_OPERATIONS as readonly string[]).indexOf(operation),
  );
  return (
    operationIndexes.length > 0 &&
    operationIndexes.every(
      (index, position) =>
        index >= 0 && (position === 0 || index > (operationIndexes[position - 1] ?? index)),
    ) &&
    practice.factFamilies.length > 0 &&
    practice.factFamilies.every(
      (family, position) =>
        Number.isInteger(family) &&
        family >= 0 &&
        family <= FACT_FACTOR_MAXIMUM &&
        (position === 0 || family > (practice.factFamilies[position - 1] ?? family)),
    )
  );
}

/**
 * The Dry Math branch a request's `practice` member selects: absent means
 * today's regrouping-free page. `undefined` marks a member Dry Math does not
 * accept, including a facts member that is not well formed.
 */
function dryMathBranchOf(request: GenerationRequestV1): DryMathBranch | undefined {
  const practice = request.practice;
  if (practice === undefined) {
    return { kind: "add-subtract", regroupingRequired: false };
  }
  switch (practice.kind) {
    case "dry-math-add-subtract":
      return practice.regrouping === "required"
        ? { kind: "add-subtract", regroupingRequired: true }
        : undefined;
    case "dry-math-facts":
      return factsMemberIsWellFormed(practice)
        ? {
            kind: "facts",
            operations: practice.operations,
            factFamilies: practice.factFamilies,
          }
        : undefined;
    default:
      return undefined;
  }
}

/**
 * The addition and subtraction branch: today's operation membership, symbols
 * and bounds, and every item regrouping exactly when the page requires it.
 * A multiplication or division item never passes it.
 */
function addSubtractItemHolds(
  item: DryMathItemV1,
  skills: EffectiveMathSkillsV1,
  regroupingRequired: boolean,
): boolean {
  const operation = item.operation;
  if (operation !== "addition" && operation !== "subtraction") {
    return false;
  }
  const symbolMatches =
    (operation === "addition" && item.renderedSymbol === "+") ||
    (operation === "subtraction" && item.renderedSymbol === "−");
  const operandsInBounds =
    Number.isInteger(item.leftOperand) &&
    Number.isInteger(item.rightOperand) &&
    item.leftOperand >= 0 &&
    item.rightOperand >= 0 &&
    item.leftOperand <= Math.min(skills.operandMax, DRY_MATH_NUMERIC_MAXIMUM) &&
    item.rightOperand <= Math.min(skills.operandMax, DRY_MATH_NUMERIC_MAXIMUM);
  const resultInBounds =
    Number.isInteger(item.answer.value) &&
    item.answer.value >= 0 &&
    item.answer.value <= Math.min(skills.resultMax, DRY_MATH_NUMERIC_MAXIMUM);
  // Under "Every problem carries or borrows" every item regroups; without
  // a `practice` member none may.
  const regroupingMatches =
    regroups(operation, item.leftOperand, item.rightOperand) === regroupingRequired;
  return (
    symbolMatches &&
    skills.operations.includes(operation) &&
    operandsInBounds &&
    resultInBounds &&
    regroupingMatches
  );
}

/** The symbol each fact operation prints. */
const FACT_SYMBOLS = {
  multiplication: "×",
  division: "÷",
} as const satisfies Record<FactOperation, DryMathItemV1["renderedSymbol"]>;

/**
 * The facts branch, and only the fact rules: a requested fact operation and
 * its symbol, factors up to `FACT_FACTOR_MAXIMUM`, an exact division with a
 * divisor from 1 and a dividend up to `FACT_DIVIDEND_MAXIMUM`, and membership
 * in a requested family. The `mathSkills` focus is inactive here, and the
 * largest product exceeds the addition and subtraction ceiling by design, so
 * neither is read.
 */
function factItemHolds(
  item: DryMathItemV1,
  branch: Extract<DryMathBranch, { readonly kind: "facts" }>,
): boolean {
  const operation = item.operation;
  if (operation !== "multiplication" && operation !== "division") {
    return false;
  }
  const left = item.leftOperand;
  const right = item.rightOperand;
  if (
    !branch.operations.includes(operation) ||
    item.renderedSymbol !== FACT_SYMBOLS[operation] ||
    !Number.isInteger(left) ||
    !Number.isInteger(right) ||
    left < 0 ||
    right < 0
  ) {
    return false;
  }
  const inBounds =
    operation === "multiplication"
      ? left <= FACT_FACTOR_MAXIMUM && right <= FACT_FACTOR_MAXIMUM
      : right >= 1 &&
        right <= FACT_FACTOR_MAXIMUM &&
        left <= FACT_DIVIDEND_MAXIMUM &&
        left % right === 0 &&
        left / right <= FACT_FACTOR_MAXIMUM;
  return (
    inBounds &&
    branch.factFamilies.some((family) => isInFactFamily(operation, left, right, family))
  );
}

type NumberBondsPractice = Extract<PracticeRequestV1, { readonly kind: "number-bonds" }>;

/**
 * The Number Bonds member a request carries, or `undefined` when it carries
 * none Number Bonds accepts: missing number sentences, addition and
 * subtraction in canonical order, a largest whole from
 * `NUMBER_BONDS_WHOLE_MINIMUM` to `V1_NUMERIC_MAXIMUM`, and a known carrying
 * and borrowing choice.
 */
function numberBondsPracticeOf(request: GenerationRequestV1): NumberBondsPractice | undefined {
  const practice = request.practice;
  if (practice?.kind !== "number-bonds") {
    return undefined;
  }
  const operationIndexes = practice.operations.map((operation) =>
    (MATH_OPERATIONS as readonly string[]).indexOf(operation),
  );
  const wellFormed =
    practice.variant === "sentence" &&
    operationIndexes.length > 0 &&
    operationIndexes.every(
      (index, position) =>
        index >= 0 && (position === 0 || index > (operationIndexes[position - 1] ?? index)),
    ) &&
    Number.isInteger(practice.wholeMax) &&
    practice.wholeMax >= NUMBER_BONDS_WHOLE_MINIMUM &&
    practice.wholeMax <= V1_NUMERIC_MAXIMUM &&
    (NUMBER_BONDS_REGROUPING_MODES as readonly string[]).includes(practice.regrouping);
  return wellFormed ? practice : undefined;
}

/**
 * One Number Bonds missing number sentence: a requested operation and its
 * symbol, every number an integer of at least 1, two parts below a whole from
 * `NUMBER_BONDS_WHOLE_MINIMUM` to the requested largest whole that the
 * sentence's relation really makes, the answer equal to the one blank number,
 * and, without carrying or borrowing, a relation whose parts do not regroup
 * (`regroups` from `arithmetic.ts`, so no problem makes or crosses ten).
 */
function numberBondItemHolds(item: NumberBondItemV1, practice: NumberBondsPractice): boolean {
  const { leftOperand, operation, result, rightOperand } = item;
  if (
    item.form !== "sentence" ||
    (item.missing !== "left" && item.missing !== "right") ||
    (operation !== "addition" && operation !== "subtraction") ||
    ![leftOperand, rightOperand, result].every((value) => Number.isInteger(value) && value >= 1)
  ) {
    return false;
  }
  // Addition puts the whole after the equals sign; subtraction starts from it.
  const whole = operation === "addition" ? result : leftOperand;
  const [firstPart, secondPart] =
    operation === "addition" ? [leftOperand, rightOperand] : [rightOperand, result];
  const symbolMatches =
    (operation === "addition" && item.renderedSymbol === "+") ||
    (operation === "subtraction" && item.renderedSymbol === "−");
  const blankNumber = item.missing === "left" ? leftOperand : rightOperand;
  return (
    practice.operations.includes(operation) &&
    symbolMatches &&
    firstPart + secondPart === whole &&
    firstPart < whole &&
    secondPart < whole &&
    whole >= NUMBER_BONDS_WHOLE_MINIMUM &&
    whole <= practice.wholeMax &&
    item.answer.value === blankNumber &&
    (practice.regrouping === "included" || !regroups("addition", firstPart, secondPart))
  );
}

/** A sentence's identity: everything it prints, the blank's position included. */
function numberBondKey(item: NumberBondItemV1): string {
  return [
    item.form,
    item.operation,
    item.leftOperand,
    item.rightOperand,
    item.result,
    item.missing,
  ].join(":");
}

export function validateWorksheetInvariants(
  document: WorksheetDocumentV1,
): GenerationFailure | undefined {
  if (
    document.schemaVersion !== 1 ||
    document.worksheetType !== document.request.worksheetType ||
    document.generatorVersion !== document.request.generatorVersion ||
    document.seed !== document.request.seed ||
    !UUID_V4_PATTERN.test(document.worksheetId)
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "Worksheet metadata did not match its normalized generation request.",
    };
  }

  // A decorative topic is refused on the three families that print no
  // decoration, and anywhere as a value outside the declared topic IDs.
  const { options } = document.request;
  if (
    "decorativeTopicId" in options &&
    (document.worksheetType === "dry-math" ||
      document.worksheetType === "find-the-wow" ||
      document.worksheetType === "number-bonds" ||
      !(TOPIC_IDS as readonly unknown[]).includes(options.decorativeTopicId))
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "Worksheet decoration data named no declared topic or reached a family that prints no decoration.",
    };
  }

  // Dry Math reads a `practice` member only of the kinds it accepts, and
  // Number Bonds needs its own; a family that would ignore the member refuses
  // it instead.
  const numberBondsPractice =
    document.worksheetType === "number-bonds" ? numberBondsPracticeOf(document.request) : undefined;
  const dryMathBranch =
    document.worksheetType === "number-bonds" ? undefined : dryMathBranchOf(document.request);
  if (
    document.worksheetType === "number-bonds"
      ? numberBondsPractice === undefined
      : dryMathBranch === undefined ||
        ("practice" in document.request && document.worksheetType !== "dry-math")
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request carried a practice choice this worksheet family does not accept.",
    };
  }

  const ids = new Set<string>();
  const dryMathFacts = new Set<string>();
  const numberBonds = new Set<string>();
  for (const [index, item] of document.items.entries()) {
    const expectedId = `item-${String(index + 1).padStart(3, "0")}`;
    if (item.id !== expectedId || ids.has(item.id)) {
      return {
        ok: false,
        code: GENERATION_INVARIANT_FAILED,
        message: "Worksheet item identifiers were not unique and sequential.",
      };
    }
    ids.add(item.id);

    if (
      (item.answerability === "objective" &&
        (item.answer === null ||
          (item.answer.kind === "number" &&
            !Number.isSafeInteger(item.answer.value)))) ||
      (item.answerability === "open" && item.answer !== null)
    ) {
      return {
        ok: false,
        code: GENERATION_INVARIANT_FAILED,
        message: "Worksheet answerability did not match its embedded answer.",
      };
    }

    if (
      item.itemType === "dry-math" &&
      (item.answer.kind !== "number" || objectiveAnswerMatches(item) !== true)
    ) {
      return {
        ok: false,
        code: GENERATION_INVARIANT_FAILED,
        message: "A Dry Math answer did not recompute from its source item.",
      };
    }
    if (item.itemType === "number-bond") {
      const key = numberBondKey(item);
      if (
        numberBondsPractice === undefined ||
        item.answer.kind !== "number" ||
        objectiveAnswerMatches(item) !== true ||
        numberBonds.has(key) ||
        !numberBondItemHolds(item, numberBondsPractice)
      ) {
        return {
          ok: false,
          code: GENERATION_INVARIANT_FAILED,
          message:
            "A Number Bonds item violated its one blank, answer, uniqueness, operation, range, or carrying and borrowing invariants.",
        };
      }
      numberBonds.add(key);
    }
    if (item.itemType === "dry-math") {
      const key = factKey(item.operation, item.leftOperand, item.rightOperand);
      // A Dry Math item in a Number Bonds document has no branch to pass.
      const holds =
        dryMathBranch !== undefined &&
        (dryMathBranch.kind === "facts"
          ? factItemHolds(item, dryMathBranch)
          : addSubtractItemHolds(
              item,
              document.request.capabilities.mathSkills,
              dryMathBranch.regroupingRequired,
            ));
      if (dryMathFacts.has(key) || !holds) {
        return {
          ok: false,
          code: GENERATION_INVARIANT_FAILED,
          message:
            "A Dry Math item violated uniqueness, operation, bound, family, or regrouping invariants.",
        };
      }
      dryMathFacts.add(key);
    }
  }
  if (
    document.worksheetType === "dry-math" &&
    (document.items.some((item) => item.itemType !== "dry-math") ||
      "topicIds" in document.request ||
      document.request.options.includeDecorativeGraphics ||
      document.request.capabilities.mathSkills.allowRegrouping ||
      document.request.capabilities.mathSkills.allowNegativeResults ||
      [
        document.request.capabilities.mathSkills.countingMax,
        document.request.capabilities.mathSkills.numeralMax,
        document.request.capabilities.mathSkills.compareMax,
      ].some((maximum) => maximum < 0 || maximum > V1_NUMERIC_MAXIMUM) ||
      [document.request.capabilities.mathSkills.operandMax,
        document.request.capabilities.mathSkills.resultMax]
        .some((maximum) => maximum < 0 || maximum > DRY_MATH_NUMERIC_MAXIMUM))
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "Dry Math included unsupported interest or decorative data.",
    };
  }
  // Number Bonds prints numbers alone: no interests, no decoration, and none
  // of the dormant math permissions.
  if (
    document.worksheetType === "number-bonds" &&
    (document.items.some((item) => item.itemType !== "number-bond") ||
      "topicIds" in document.request ||
      document.request.options.includeDecorativeGraphics ||
      document.request.capabilities.mathSkills.allowRegrouping ||
      document.request.capabilities.mathSkills.allowNegativeResults)
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "Number Bonds included unsupported interest or decorative data.",
    };
  }
  return undefined;
}

export function containsPersonalizationValue(
  document: WorksheetDocumentV1,
  value: string,
): boolean {
  return value.length > 0 && JSON.stringify(document).includes(value);
}
