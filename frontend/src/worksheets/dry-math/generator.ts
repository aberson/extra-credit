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
  dryMathCapacityShortfall,
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

/**
 * The shortage sentence for one already-measured request, wired to the same
 * enumeration the shortfall's binding-maximum probe re-runs. Every caller in
 * this file goes through here so the probe cannot be wired one way for the
 * generator's fail-closed branch and another way for the pre-click verdict.
 */
function dryMathShortfallFor(
  request: GenerationRequestV1,
  capacity: number,
): string | undefined {
  return dryMathCapacityShortfall(
    capacity,
    request.capabilities.mathSkills,
    (maximums) =>
      enumerateDryMathCandidates({
        ...request,
        capabilities: {
          ...request.capabilities,
          mathSkills: { ...request.capabilities.mathSkills, ...maximums },
        },
      }).length,
    request.options.length,
    request.options.printScale,
  );
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
  const shortfall = dryMathShortfallFor(request, candidates.length);
  if (shortfall !== undefined) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: shortfall,
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

/**
 * The distinct facts these confirmed limits provide, counted by enumerating
 * the very collection `generateDryMath` shuffles. Sharing one enumeration is
 * what keeps the control's pre-click capacity verdict from drifting away from
 * the generator's own fail-closed branch (issue #14).
 */
export function measureDryMathCapacity(request: GenerationRequestV1): number {
  return enumerateDryMathCandidates(request).length;
}

/**
 * The whole capacity answer for one request: measured and judged by the same
 * pair of functions `generateDryMath` uses above. The registration calls this
 * rather than re-composing the measurement with a separately-derived budget,
 * so a second constraint added inside this file cannot be missed by the
 * pre-click gate (issue #14).
 */
export function dryMathCapacityVerdict(
  request: GenerationRequestV1,
): string | undefined {
  return dryMathShortfallFor(request, measureDryMathCapacity(request));
}
