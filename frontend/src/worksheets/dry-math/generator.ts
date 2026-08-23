import {
  recomputeDryMathAnswer,
  validateWorksheetInvariants,
} from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  type DryMathItemV1,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type MathOperation,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import {
  DRY_MATH_DEFINITION,
  getDryMathItemCount,
  getDryMathCapabilitySupport,
} from "./definition.js";

interface ArithmeticCandidate {
  readonly operation: MathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly renderedSymbol: "+" | "−";
  readonly answer: number;
}

export type DryMathDocumentV1 = WorksheetDocumentV1<DryMathItemV1>;

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

export function effectiveDryMathItemCount(request: GenerationRequestV1): number {
  return getDryMathItemCount(
    request.options.length,
    request.options.printScale,
  );
}

export function enumerateDryMathCandidates(
  request: GenerationRequestV1,
): readonly ArithmeticCandidate[] {
  const skills = request.capabilities.mathSkills;
  const operandLimit = Math.min(skills.operandMax, 20);
  const resultLimit = Math.min(skills.resultMax, 20);
  const candidates: ArithmeticCandidate[] = [];

  for (const operation of skills.operations) {
    for (let leftOperand = 0; leftOperand <= operandLimit; leftOperand += 1) {
      for (let rightOperand = 0; rightOperand <= operandLimit; rightOperand += 1) {
        const answer =
          operation === "addition"
            ? leftOperand + rightOperand
            : leftOperand - rightOperand;
        if (answer < 0 || answer > resultLimit) {
          continue;
        }
        const regroupingFree =
          operation === "addition"
            ? additionHasNoCarrying(leftOperand, rightOperand)
            : subtractionHasNoBorrowing(leftOperand, rightOperand);
        if (!regroupingFree) {
          continue;
        }
        candidates.push({
          operation,
          leftOperand,
          rightOperand,
          renderedSymbol: operation === "addition" ? "+" : "−",
          answer,
        });
      }
    }
  }
  return candidates;
}

export function generateDryMath(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<DryMathDocumentV1> {
  if (
    request.worksheetType !== DRY_MATH_DEFINITION.id ||
    request.generatorVersion !== DRY_MATH_DEFINITION.generatorVersion
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request does not match the registered Dry Math generator.",
    };
  }

  const support = getDryMathCapabilitySupport(request.capabilities.mathSkills);
  if (!support.available) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: support.reason,
    };
  }

  const itemCount = effectiveDryMathItemCount(request);
  const candidates = enumerateDryMathCandidates(request);
  if (candidates.length < itemCount) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: `The confirmed limits provide ${candidates.length} unique facts, but this length needs ${itemCount}. Choose a shorter worksheet or review the profile limits.`,
    };
  }

  const random = createSeededRandom(request.seed);
  const items: DryMathItemV1[] = seededShuffle(candidates, random)
    .slice(0, itemCount)
    .map((candidate, index) => ({
      id: `item-${String(index + 1).padStart(3, "0")}`,
      itemType: "dry-math",
      answerability: "objective",
      operation: candidate.operation,
      leftOperand: candidate.leftOperand,
      rightOperand: candidate.rightOperand,
      renderedSymbol: candidate.renderedSymbol,
      answer: { kind: "number", value: candidate.answer },
    }));
  const document: DryMathDocumentV1 = {
    schemaVersion: 1,
    worksheetType: DRY_MATH_DEFINITION.id,
    generatorVersion: DRY_MATH_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items,
  };
  const invariantFailure = validateWorksheetInvariants(document);
  if (invariantFailure !== undefined) {
    return invariantFailure;
  }
  for (const item of items) {
    if (item.answer.value !== recomputeDryMathAnswer(item)) {
      return {
        ok: false,
        code: GENERATION_INVARIANT_FAILED,
        message: "A generated Dry Math answer failed local recomputation.",
      };
    }
  }
  return { ok: true, document };
}
