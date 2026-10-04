import { FACT_OPERATIONS } from "../../shared/config/enums.js";
import { objectiveAnswerMatches } from "../../shared/worksheet/answer-oracle.js";
import { isInFactFamily, regroups } from "../../shared/worksheet/arithmetic.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  FACT_FACTOR_MAXIMUM,
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  DRY_MATH_NUMERIC_MAXIMUM,
  type DryMathItemV1,
  type DryMathOperation,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type PracticeRequestV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import {
  DRY_MATH_DEFINITION,
  dryMathCapacityShortfall,
  dryMathFactsShortfall,
  getDryMathItemCount,
  getDryMathCapabilitySupport,
} from "./definition.js";

interface ArithmeticCandidate {
  readonly operation: DryMathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly renderedSymbol: DryMathItemV1["renderedSymbol"];
  readonly answer: number;
}

type FactsPractice = Extract<PracticeRequestV1, { readonly kind: "dry-math-facts" }>;

/** The facts this request asks for, or `undefined` for an addition and subtraction page. */
function factsPractice(request: GenerationRequestV1): FactsPractice | undefined {
  return request.practice?.kind === "dry-math-facts" ? request.practice : undefined;
}

export type DryMathDocumentV1 = WorksheetDocumentV1<DryMathItemV1>;

/**
 * Whether this request asks for "Every problem carries or borrows". A request
 * without a `practice` member is today's regrouping-free page.
 */
function regroupingRequired(request: GenerationRequestV1): boolean {
  return (
    request.practice?.kind === "dry-math-add-subtract" &&
    request.practice.regrouping === "required"
  );
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
  const facts = factsPractice(request);
  return facts === undefined
    ? enumerateArithmeticCandidates(
        request.capabilities.mathSkills,
        regroupingRequired(request),
      )
    : enumerateFactCandidates(facts);
}

/**
 * Every multiplication and exact division fact in the requested families, in
 * the canonical order of the math-activities plan's Appendix B.2: operations
 * in `FACT_OPERATIONS` order; multiplication by left factor, then right
 * factor; division by divisor, then quotient. Each factor, divisor and
 * quotient runs to `FACT_FACTOR_MAXIMUM`, so no divisor is 0, every division
 * is exact and no dividend exceeds their product.
 */
function enumerateFactCandidates(facts: FactsPractice): readonly ArithmeticCandidate[] {
  const inFamilies = (operation: FactsPractice["operations"][number], left: number, right: number) =>
    facts.factFamilies.some((family) => isInFactFamily(operation, left, right, family));
  const candidates: ArithmeticCandidate[] = [];
  for (const operation of FACT_OPERATIONS) {
    if (!facts.operations.includes(operation)) {
      continue;
    }
    if (operation === "multiplication") {
      for (let left = 0; left <= FACT_FACTOR_MAXIMUM; left += 1) {
        for (let right = 0; right <= FACT_FACTOR_MAXIMUM; right += 1) {
          if (inFamilies(operation, left, right)) {
            candidates.push({
              operation,
              leftOperand: left,
              rightOperand: right,
              renderedSymbol: "×",
              answer: left * right,
            });
          }
        }
      }
      continue;
    }
    for (let divisor = 1; divisor <= FACT_FACTOR_MAXIMUM; divisor += 1) {
      for (let quotient = 0; quotient <= FACT_FACTOR_MAXIMUM; quotient += 1) {
        const dividend = divisor * quotient;
        if (inFamilies(operation, dividend, divisor)) {
          candidates.push({
            operation,
            leftOperand: dividend,
            rightOperand: divisor,
            renderedSymbol: "÷",
            answer: quotient,
          });
        }
      }
    }
  }
  return candidates;
}

/**
 * Every (operation, left, right) a focus allows, in operation, left operand,
 * then right operand order. The same walk keeps exactly the regrouping
 * candidates when `required` is true and exactly the others when it is false,
 * so both choices share one iteration order.
 */
function enumerateArithmeticCandidates(
  skills: GenerationRequestV1["capabilities"]["mathSkills"],
  required: boolean,
): readonly ArithmeticCandidate[] {
  const operandLimit = Math.min(skills.operandMax, DRY_MATH_NUMERIC_MAXIMUM);
  const resultLimit = Math.min(skills.resultMax, DRY_MATH_NUMERIC_MAXIMUM);
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
        if (regroups(operation, leftOperand, rightOperand) !== required) {
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
 * enumeration the shortfall's binding-maximum probe re-runs, so the
 * generator's fail-closed branch and the pre-click verdict cannot be wired to
 * two different enumerations.
 */
function dryMathShortfallFor(
  request: GenerationRequestV1,
  capacity: number,
): string | undefined {
  if (factsPractice(request) !== undefined) {
    return dryMathFactsShortfall(
      capacity,
      request.options.length,
      request.options.printScale,
    );
  }
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
    // The same focus without carrying or borrowing, measured only for a page
    // that requires it, so the remedy can say when that choice would fill.
    regroupingRequired(request)
      ? () =>
          enumerateArithmeticCandidates(request.capabilities.mathSkills, false)
            .length
      : undefined,
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

  const support = getDryMathCapabilitySupport(
    request.capabilities.mathSkills,
    request.practice,
  );
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
    if (objectiveAnswerMatches(item) !== true) {
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
