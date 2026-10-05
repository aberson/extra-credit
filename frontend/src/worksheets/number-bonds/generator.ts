import { MATH_OPERATIONS } from "../../shared/config/enums.js";
import { objectiveAnswerMatches } from "../../shared/worksheet/answer-oracle.js";
import { regroups } from "../../shared/worksheet/arithmetic.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  NUMBER_BONDS_WHOLE_MINIMUM,
  V1_NUMERIC_MAXIMUM,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type NumberBondItemV1,
  type PracticeRequestV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import {
  NUMBER_BONDS_DEFINITION,
  getNumberBondsItemCount,
  numberBondsCapacityShortfall,
} from "./definition.js";

/*
 * Number Bonds missing number sentences (math-activities plan, DD10 and
 * Appendix B.3). Every candidate comes from one enumeration in canonical
 * order; the capacity verdict counts that same enumeration, and a page is a
 * seeded shuffle of it cut to the length's budget, so the pre-click verdict
 * and the generator cannot disagree (issue #14).
 */

type NumberBondsPractice = Extract<PracticeRequestV1, { readonly kind: "number-bonds" }>;

/** One missing number sentence before it is numbered. */
type NumberBondCandidate = Omit<NumberBondItemV1, "id" | "itemType" | "answerability">;

export type NumberBondsDocumentV1 = WorksheetDocumentV1<NumberBondItemV1>;

/** The Number Bonds member this request carries, or `undefined` when it carries none. */
function numberBondsPractice(request: GenerationRequestV1): NumberBondsPractice | undefined {
  return request.practice?.kind === "number-bonds" ? request.practice : undefined;
}

/**
 * Whether a relation `whole = firstPart + secondPart` may appear: always when
 * problems that carry or borrow are included, and otherwise only when its
 * parts do not regroup, which is exactly the carrying or borrowing its missing
 * number needs, so no problem makes or crosses ten.
 */
function relationAllowed(
  practice: NumberBondsPractice,
  firstPart: number,
  secondPart: number,
): boolean {
  return practice.regrouping === "included" || !regroups("addition", firstPart, secondPart);
}

/** Both blank positions of one relation, `left` before `right`. */
function withEachBlank(
  sentence: Omit<NumberBondCandidate, "missing" | "answer">,
): readonly NumberBondCandidate[] {
  return (["left", "right"] as const).map((missing) => ({
    ...sentence,
    missing,
    answer: {
      kind: "number",
      value: missing === "left" ? sentence.leftOperand : sentence.rightOperand,
    },
  }));
}

/**
 * Every sentence the request allows, in Appendix B.3's canonical order:
 * operations in `MATH_OPERATIONS` order; addition by result, then left
 * addend; subtraction by minuend, then subtrahend; then the blank, left
 * before right. The loops run over the relation whichever number is blank,
 * and the regrouping choice only filters, so the order never depends on it.
 */
export function enumerateNumberBondsCandidates(
  request: GenerationRequestV1,
): readonly NumberBondCandidate[] {
  const practice = numberBondsPractice(request);
  if (practice === undefined) {
    return [];
  }
  const wholeMax = Math.min(practice.wholeMax, V1_NUMERIC_MAXIMUM);
  const candidates: NumberBondCandidate[] = [];
  for (const operation of MATH_OPERATIONS) {
    if (!practice.operations.includes(operation)) {
      continue;
    }
    for (let whole = NUMBER_BONDS_WHOLE_MINIMUM; whole <= wholeMax; whole += 1) {
      for (let part = 1; part < whole; part += 1) {
        const otherPart = whole - part;
        if (!relationAllowed(practice, part, otherPart)) {
          continue;
        }
        candidates.push(
          ...withEachBlank(
            operation === "addition"
              ? {
                  form: "sentence",
                  operation,
                  leftOperand: part,
                  rightOperand: otherPart,
                  result: whole,
                  renderedSymbol: "+",
                }
              : {
                  form: "sentence",
                  operation,
                  leftOperand: whole,
                  rightOperand: part,
                  result: otherPart,
                  renderedSymbol: "−",
                },
          ),
        );
      }
    }
  }
  return candidates;
}

/** The distinct problems this request allows, counted from the enumeration the generator draws from. */
export function measureNumberBondsCapacity(request: GenerationRequestV1): number {
  return enumerateNumberBondsCandidates(request).length;
}

/**
 * The whole capacity answer for one request, measured and judged by the same
 * pair of functions `generateNumberBonds` uses, for the registration's
 * pre-click verdict.
 */
export function numberBondsCapacityVerdict(request: GenerationRequestV1): string | undefined {
  return numberBondsCapacityShortfall(
    measureNumberBondsCapacity(request),
    request.options.length,
    request.options.printScale,
  );
}

/**
 * The family's own check of a finished document: the shared invariants, whose
 * Number Bonds rules and family guard refuse a malformed sentence, a second
 * blank, a number below 1, a whole outside the range, a duplicate, a relation
 * that regroups without the parent including it, interests and decoration,
 * then a local recomputation of every answer from the numbers each sentence
 * shows.
 */
export function validateNumberBondsDocument(
  document: NumberBondsDocumentV1,
): ReturnType<typeof validateWorksheetInvariants> {
  const invariantFailure = validateWorksheetInvariants(document);
  if (invariantFailure !== undefined) {
    return invariantFailure;
  }
  if (document.items.some((item) => objectiveAnswerMatches(item) !== true)) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "A generated Number Bonds answer failed local recomputation.",
    };
  }
  return undefined;
}

export function generateNumberBonds(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<NumberBondsDocumentV1> {
  if (
    request.worksheetType !== NUMBER_BONDS_DEFINITION.id ||
    request.generatorVersion !== NUMBER_BONDS_DEFINITION.generatorVersion ||
    numberBondsPractice(request) === undefined
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request does not match the registered Number Bonds generator.",
    };
  }

  const candidates = enumerateNumberBondsCandidates(request);
  const shortfall = numberBondsCapacityShortfall(
    candidates.length,
    request.options.length,
    request.options.printScale,
  );
  if (shortfall !== undefined) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: shortfall,
    };
  }

  const itemCount = getNumberBondsItemCount(
    request.options.length,
    request.options.printScale,
  );
  const items: NumberBondItemV1[] = seededShuffle(candidates, createSeededRandom(request.seed))
    .slice(0, itemCount)
    .map((candidate, index) => ({
      id: `item-${String(index + 1).padStart(3, "0")}`,
      itemType: "number-bond",
      answerability: "objective",
      ...candidate,
    }));
  const document: NumberBondsDocumentV1 = {
    schemaVersion: 1,
    worksheetType: NUMBER_BONDS_DEFINITION.id,
    generatorVersion: NUMBER_BONDS_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items,
  };
  const failure = validateNumberBondsDocument(document);
  return failure === undefined ? { ok: true, document } : failure;
}
