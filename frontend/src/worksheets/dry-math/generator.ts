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
  DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM,
  DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM,
  DRY_MATH_TWO_DIGIT_MINIMUM,
  DRY_MATH_TWO_DIGIT_MAXIMUM,
  DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM,
  DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM,
  DRY_MATH_REMAINDER_DIVIDEND_MINIMUM,
  DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM,
  DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM,
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
  DRY_MATH_FIXED_POOL_ADVICE,
  DRY_MATH_SAMPLE_ATTEMPTS,
  DRY_MATH_THREE_DIGIT_CAPACITY,
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
  readonly answer: DryMathItemV1["answer"];
}

type FactsPractice = Extract<PracticeRequestV1, { readonly kind: "dry-math-facts" }>;
type ThreeDigitPractice = Extract<PracticeRequestV1, { readonly kind: "dry-math-three-digit" }>;
type MultiDigitPractice = Extract<PracticeRequestV1, { readonly kind: "dry-math-multi-digit" }>;

function threeDigitPracticeIsWellFormed(practice: ThreeDigitPractice): boolean {
  const operations = practice.operations as readonly string[];
  return (
    (practice.regrouping === "without" || practice.regrouping === "required") &&
    operations.length > 0 &&
    operations.length <= 2 &&
    operations.every(
      (operation, index) =>
        (operation === "addition" || operation === "subtraction") &&
        (index === 0 || (operations[index - 1] === "addition" && operation === "subtraction")),
    )
  );
}

/** The facts this request asks for, or `undefined` for an addition and subtraction page. */
function factsPractice(request: GenerationRequestV1): FactsPractice | undefined {
  const practice = request.practice;
  switch (practice?.kind) {
    case "dry-math-facts":
      return practice;
    case "dry-math-three-digit":
    case "dry-math-multi-digit":
    case "dry-math-remainders":
    case undefined:
    case "dry-math-add-subtract":
    case "number-bonds":
    case "operation-grid":
      return undefined;
    default: {
      const unreachable: never = practice;
      return unreachable;
    }
  }
}

export type DryMathDocumentV1 = WorksheetDocumentV1<DryMathItemV1>;

/**
 * Whether this request asks for "Every problem carries or borrows". A request
 * without a `practice` member is today's regrouping-free page.
 */
function regroupingRequired(request: GenerationRequestV1): boolean {
  const practice = request.practice;
  switch (practice?.kind) {
    case "dry-math-add-subtract":
      return practice.regrouping === "required";
    case "dry-math-three-digit":
      return practice.regrouping === "required";
    case undefined:
    case "dry-math-facts":
    case "dry-math-multi-digit":
    case "dry-math-remainders":
    case "number-bonds":
    case "operation-grid":
      return false;
    default: {
      const unreachable: never = practice;
      return unreachable;
    }
  }
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
  const practice = request.practice;
  switch (practice?.kind) {
    case "dry-math-three-digit":
      throw new Error("The three-digit pool is never enumerated.");
    case "dry-math-multi-digit":
      return enumerateMultiDigitCandidates(practice);
    case "dry-math-remainders":
      return enumerateRemainderCandidates();
    case "dry-math-facts":
      return enumerateFactCandidates(factsPractice(request) ?? practice);
    case undefined:
    case "dry-math-add-subtract":
    case "number-bonds":
    case "operation-grid":
      return enumerateArithmeticCandidates(
        request.capabilities.mathSkills,
        regroupingRequired(request),
      );
    default: {
      const unreachable: never = practice;
      return unreachable;
    }
  }
}

function enumerateRemainderCandidates(): readonly ArithmeticCandidate[] {
  const candidates: ArithmeticCandidate[] = [];
  for (let divisor = DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM; divisor <= DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM; divisor += 1) {
    for (let dividend = DRY_MATH_REMAINDER_DIVIDEND_MINIMUM; dividend <= DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM; dividend += 1) {
      const remainder = dividend % divisor;
      if (remainder === 0) continue;
      candidates.push({
        operation: "division",
        leftOperand: dividend,
        rightOperand: divisor,
        renderedSymbol: "÷",
        answer: { kind: "quotient-remainder", quotient: Math.floor(dividend / divisor), remainder },
      });
    }
  }
  return candidates;
}

function enumerateMultiDigitCandidates(practice: MultiDigitPractice): readonly ArithmeticCandidate[] {
  const candidates: ArithmeticCandidate[] = [];
  for (const operation of FACT_OPERATIONS) {
    if (!practice.operations.includes(operation)) continue;
    if (operation === "multiplication") {
      for (let left = DRY_MATH_TWO_DIGIT_MINIMUM; left <= DRY_MATH_TWO_DIGIT_MAXIMUM; left += 1) {
        for (let right = DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM; right <= DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM; right += 1) {
          candidates.push({ operation, leftOperand: left, rightOperand: right, renderedSymbol: "×", answer: { kind: "number", value: left * right } });
        }
      }
    } else {
      for (let divisor = DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM; divisor <= DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM; divisor += 1) {
        for (let quotient = Math.ceil(DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM / divisor); quotient <= Math.floor(DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM / divisor); quotient += 1) {
          candidates.push({ operation, leftOperand: divisor * quotient, rightOperand: divisor, renderedSymbol: "÷", answer: { kind: "number", value: quotient } });
        }
      }
    }
  }
  return candidates;
}

/**
 * Draw one operation per item, retrying only operands until a unique fact in
 * the requested regrouping partition is found. A failed page is never
 * returned partially.
 */
export function sampleThreeDigitItems(
  practice: ThreeDigitPractice,
  count: number,
  random: Pick<ReturnType<typeof createSeededRandom>, "nextBounded">,
): readonly ArithmeticCandidate[] | undefined {
  if (!threeDigitPracticeIsWellFormed(practice)) {
    return undefined;
  }
  const items: ArithmeticCandidate[] = [];
  const facts = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const operation = practice.operations[random.nextBounded(practice.operations.length)];
    if (operation === undefined) {
      return undefined;
    }
    let accepted: ArithmeticCandidate | undefined;
    for (let attempt = 0; attempt < DRY_MATH_SAMPLE_ATTEMPTS; attempt += 1) {
      const leftOperand =
        DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM +
        random.nextBounded(operation === "addition" ? 900 : 901);
      const rightOperand =
        DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM + random.nextBounded(900);
      const answer =
        operation === "addition" ? leftOperand + rightOperand : leftOperand - rightOperand;
      const key = `${operation}:${leftOperand}:${rightOperand}`;
      if (
        answer < 0 ||
        answer > DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM ||
        regroups(operation, leftOperand, rightOperand) !== (practice.regrouping === "required") ||
        facts.has(key)
      ) {
        continue;
      }
      accepted = {
        operation,
        leftOperand,
        rightOperand,
        renderedSymbol: operation === "addition" ? "+" : "−",
        answer: { kind: "number", value: answer },
      };
      facts.add(key);
      break;
    }
    if (accepted === undefined) {
      return undefined;
    }
    items.push(accepted);
  }
  return items;
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
              answer: { kind: "number", value: left * right },
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
            answer: { kind: "number", value: quotient },
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
          answer: { kind: "number", value: answer },
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
  const practice = request.practice;
  switch (practice?.kind) {
    case "dry-math-facts":
      return dryMathFactsShortfall(
        capacity,
        request.options.length,
        request.options.printScale,
      );
    case "dry-math-three-digit":
      return capacity >= getDryMathItemCount(request.options.length, request.options.printScale)
        ? undefined
        : DRY_MATH_FIXED_POOL_ADVICE;
    case "dry-math-multi-digit":
    case "dry-math-remainders":
      return capacity >= getDryMathItemCount(request.options.length, request.options.printScale)
        ? undefined : DRY_MATH_FIXED_POOL_ADVICE;
    case undefined:
    case "dry-math-add-subtract":
    case "number-bonds":
    case "operation-grid":
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
    default: {
      const unreachable: never = practice;
      return unreachable;
    }
  }
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

  if (
    request.practice?.kind === "dry-math-three-digit" &&
    !threeDigitPracticeIsWellFormed(request.practice)
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The three-digit practice choice is malformed.",
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
  const capacity = measureDryMathCapacity(request);
  const shortfall = dryMathShortfallFor(request, capacity);
  if (shortfall !== undefined) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: shortfall,
    };
  }

  const random = createSeededRandom(request.seed);
  const candidates =
    request.practice?.kind === "dry-math-three-digit"
      ? sampleThreeDigitItems(request.practice, itemCount, random)
      : seededShuffle(enumerateDryMathCandidates(request), random).slice(0, itemCount);
  if (candidates === undefined) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "Dry Math could not sample a complete valid three-digit page.",
    };
  }
  const items: DryMathItemV1[] = candidates
    .slice(0, itemCount)
    .map((candidate, index) => ({
      id: `item-${String(index + 1).padStart(3, "0")}`,
      itemType: "dry-math",
      answerability: "objective",
      operation: candidate.operation,
      leftOperand: candidate.leftOperand,
      rightOperand: candidate.rightOperand,
      renderedSymbol: candidate.renderedSymbol,
      answer: candidate.answer,
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
 * The distinct facts these confirmed limits provide. Existing finite-pool
 * kinds count the exact collection `generateDryMath` shuffles; the
 * three-digit kind returns the exact table sum and is never enumerated.
 * This remains the shared owner for the pre-click verdict and generator gate.
 */
export function measureDryMathCapacity(request: GenerationRequestV1): number {
  if (request.practice?.kind === "dry-math-three-digit") {
    const practice = request.practice;
    if (!threeDigitPracticeIsWellFormed(practice)) {
      return 0;
    }
    return practice.operations.reduce(
      (total, operation) =>
        total + DRY_MATH_THREE_DIGIT_CAPACITY[operation][practice.regrouping],
      0,
    );
  }
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
