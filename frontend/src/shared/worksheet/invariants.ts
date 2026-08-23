import {
  GENERATION_INVARIANT_FAILED,
  type DryMathItemV1,
  type GenerationFailure,
  type ObjectiveAnswerV1,
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

export function recomputeDryMathAnswer(item: DryMathItemV1): number {
  return item.operation === "addition"
    ? item.leftOperand + item.rightOperand
    : item.leftOperand - item.rightOperand;
}

function additionHasNoCarrying(left: number, right: number): boolean {
  let leftDigits = left;
  let rightDigits = right;
  do {
    if ((leftDigits % 10) + (rightDigits % 10) >= 10) {
      return false;
    }
    leftDigits = Math.floor(leftDigits / 10);
    rightDigits = Math.floor(rightDigits / 10);
  } while (leftDigits > 0 || rightDigits > 0);
  return true;
}

function subtractionHasNoBorrowing(left: number, right: number): boolean {
  let leftDigits = left;
  let rightDigits = right;
  do {
    if (leftDigits % 10 < rightDigits % 10) {
      return false;
    }
    leftDigits = Math.floor(leftDigits / 10);
    rightDigits = Math.floor(rightDigits / 10);
  } while (leftDigits > 0 || rightDigits > 0);
  return true;
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

  const ids = new Set<string>();
  const dryMathFacts = new Set<string>();
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
      (item.answer.kind !== "number" ||
        item.answer.value !== recomputeDryMathAnswer(item))
    ) {
      return {
        ok: false,
        code: GENERATION_INVARIANT_FAILED,
        message: "A Dry Math answer did not recompute from its source item.",
      };
    }
    if (item.itemType === "dry-math") {
      const skills = document.request.capabilities.mathSkills;
      const factKey = `${item.operation}:${item.leftOperand}:${item.rightOperand}`;
      const symbolMatches =
        (item.operation === "addition" && item.renderedSymbol === "+") ||
        (item.operation === "subtraction" && item.renderedSymbol === "−");
      const operandsInBounds =
        Number.isInteger(item.leftOperand) &&
        Number.isInteger(item.rightOperand) &&
        item.leftOperand >= 0 &&
        item.rightOperand >= 0 &&
        item.leftOperand <= Math.min(skills.operandMax, 20) &&
        item.rightOperand <= Math.min(skills.operandMax, 20);
      const resultInBounds =
        Number.isInteger(item.answer.value) &&
        item.answer.value >= 0 &&
        item.answer.value <= Math.min(skills.resultMax, 20);
      const regroupingFree =
        item.operation === "addition"
          ? additionHasNoCarrying(item.leftOperand, item.rightOperand)
          : subtractionHasNoBorrowing(item.leftOperand, item.rightOperand);
      if (
        dryMathFacts.has(factKey) ||
        !symbolMatches ||
        !skills.operations.includes(item.operation) ||
        !operandsInBounds ||
        !resultInBounds ||
        !regroupingFree
      ) {
        return {
          ok: false,
          code: GENERATION_INVARIANT_FAILED,
          message:
            "A Dry Math item violated uniqueness, operation, bound, or regrouping invariants.",
        };
      }
      dryMathFacts.add(factKey);
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
        document.request.capabilities.mathSkills.operandMax,
        document.request.capabilities.mathSkills.resultMax,
      ].some((maximum) => maximum < 0 || maximum > 20))
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "Dry Math included unsupported interest or decorative data.",
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
