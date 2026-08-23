import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
  type SeededRandom,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  type EquationWowChoiceV1,
  type EquationWowGroupItemV1,
  type GenerationFailure,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type MathOperation,
  type QuantityWowChoiceV1,
  type QuantityWowGroupItemV1,
  type WorksheetDocumentV1,
  type WowGroupItemV1,
} from "../../shared/worksheet/types.js";
import {
  FIND_THE_WOW_DEFINITION,
  getFindTheWowCapabilitySupport,
  getFindTheWowGroupCount,
  type FindTheWowMode,
} from "./definition.js";

export interface QuantityWowCandidate {
  readonly target: number;
  readonly distractors: readonly [number, number];
}

export interface EquationWowCandidate {
  readonly operation: MathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly renderedSymbol: "+" | "−";
  readonly trueResult: number;
  readonly falseResults: readonly [number, number];
}

export type FindTheWowDocumentV1 = WorksheetDocumentV1<WowGroupItemV1>;

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

function arithmeticResult(
  operation: MathOperation,
  left: number,
  right: number,
): number {
  return operation === "addition" ? left + right : left - right;
}

function regroupingFree(
  operation: MathOperation,
  left: number,
  right: number,
): boolean {
  return operation === "addition"
    ? additionHasNoCarrying(left, right)
    : subtractionHasNoBorrowing(left, right);
}

export function effectiveFindTheWowGroupCount(
  request: GenerationRequestV1,
): number {
  return getFindTheWowGroupCount(
    request.options.length,
    request.options.printScale,
  );
}

export function enumerateQuantityWowCandidates(
  request: GenerationRequestV1,
): readonly QuantityWowCandidate[] {
  const skills = request.capabilities.mathSkills;
  const limit = Math.min(skills.countingMax, skills.numeralMax, 20);
  if (limit < 3) {
    return [];
  }

  const candidates: QuantityWowCandidate[] = [];
  for (let target = 1; target <= limit; target += 1) {
    for (let first = 1; first <= limit; first += 1) {
      if (first === target) {
        continue;
      }
      for (let second = first + 1; second <= limit; second += 1) {
        if (second === target) {
          continue;
        }
        candidates.push({ target, distractors: [first, second] });
      }
    }
  }
  return candidates;
}

export function enumerateEquationWowCandidates(
  request: GenerationRequestV1,
): readonly EquationWowCandidate[] {
  const skills = request.capabilities.mathSkills;
  const operandLimit = Math.min(skills.operandMax, 20);
  const resultLimit = Math.min(skills.resultMax, 20);
  const candidates: EquationWowCandidate[] = [];

  for (const operation of skills.operations) {
    for (let leftOperand = 0; leftOperand <= operandLimit; leftOperand += 1) {
      for (let rightOperand = 0; rightOperand <= operandLimit; rightOperand += 1) {
        const trueResult = arithmeticResult(operation, leftOperand, rightOperand);
        if (
          trueResult < 0 ||
          trueResult > resultLimit ||
          !regroupingFree(operation, leftOperand, rightOperand)
        ) {
          continue;
        }

        for (let first = 0; first <= resultLimit; first += 1) {
          if (first === trueResult) {
            continue;
          }
          for (let second = first + 1; second <= resultLimit; second += 1) {
            if (second === trueResult) {
              continue;
            }
            candidates.push({
              operation,
              leftOperand,
              rightOperand,
              renderedSymbol: operation === "addition" ? "+" : "−",
              trueResult,
              falseResults: [first, second],
            });
          }
        }
      }
    }
  }
  return candidates;
}

export interface WowStemGroupV1<TCandidate> {
  /** Stable identity of the one distinct exercise these candidates share. */
  readonly key: string;
  /** Every distractor choice available for that exercise; always nonempty. */
  readonly candidates: readonly TCandidate[];
}

function quantityStemKey(target: number): string {
  return `quantity:${target}`;
}

function equationStemKey(
  operation: MathOperation,
  leftOperand: number,
  rightOperand: number,
): string {
  return `equation:${operation}:${leftOperand}:${rightOperand}`;
}

/**
 * Collapses (stem x distractor-pair) candidates into the distinct exercises a
 * page can actually show. Capacity, selection, and the duplicate-group
 * invariant all count stems, so one exercise can never fill two groups and the
 * parent-facing "N unique groups" count stays true.
 */
export function groupCandidatesByStem<TCandidate>(
  candidates: readonly TCandidate[],
  keyOf: (candidate: TCandidate) => string,
): readonly WowStemGroupV1<TCandidate>[] {
  const byKey = new Map<string, TCandidate[]>();
  for (const candidate of candidates) {
    const key = keyOf(candidate);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, [candidate]);
    } else {
      existing.push(candidate);
    }
  }
  return [...byKey].map(([key, grouped]) => ({ key, candidates: grouped }));
}

export function enumerateQuantityWowStems(
  request: GenerationRequestV1,
): readonly WowStemGroupV1<QuantityWowCandidate>[] {
  return groupCandidatesByStem(
    enumerateQuantityWowCandidates(request),
    ({ target }) => quantityStemKey(target),
  );
}

export function enumerateEquationWowStems(
  request: GenerationRequestV1,
): readonly WowStemGroupV1<EquationWowCandidate>[] {
  return groupCandidatesByStem(
    enumerateEquationWowCandidates(request),
    ({ operation, leftOperand, rightOperand }) =>
      equationStemKey(operation, leftOperand, rightOperand),
  );
}

function balancedCorrectPositions(
  count: number,
  random: Pick<SeededRandom, "nextBounded">,
): readonly (0 | 1 | 2)[] {
  const positions = Array.from(
    { length: count },
    (_, index) => (index % 3) as 0 | 1 | 2,
  );
  return seededShuffle(positions, random);
}

function positionChoices<T>(
  correct: T,
  distractors: readonly [T, T],
  correctPosition: 0 | 1 | 2,
  random: Pick<SeededRandom, "nextBounded">,
): readonly [T, T, T] {
  const shuffledDistractors = seededShuffle(distractors, random) as [T, T];
  switch (correctPosition) {
    case 0:
      return [correct, shuffledDistractors[0], shuffledDistractors[1]];
    case 1:
      return [shuffledDistractors[0], correct, shuffledDistractors[1]];
    case 2:
      return [shuffledDistractors[0], shuffledDistractors[1], correct];
  }
}

function constructItems<TCandidate>(
  stems: readonly WowStemGroupV1<TCandidate>[],
  count: number,
  random: Pick<SeededRandom, "nextBounded">,
  construct: (
    candidate: TCandidate,
    index: number,
    correctPosition: 0 | 1 | 2,
    random: Pick<SeededRandom, "nextBounded">,
  ) => WowGroupItemV1,
): readonly WowGroupItemV1[] | undefined {
  const selected = seededShuffle(stems, random).slice(0, count);
  const positions = balancedCorrectPositions(count, random);
  const items: WowGroupItemV1[] = [];
  for (const [index, stem] of selected.entries()) {
    const position = positions[index];
    const pool = stem.candidates;
    if (position === undefined || pool.length === 0) {
      return undefined;
    }
    const candidate = pool[random.nextBounded(pool.length)];
    if (candidate === undefined) {
      return undefined;
    }
    items.push(construct(candidate, index, position, random));
  }
  return items;
}

function quantityItem(
  candidate: QuantityWowCandidate,
  index: number,
  correctPosition: 0 | 1 | 2,
  random: Pick<SeededRandom, "nextBounded">,
): QuantityWowGroupItemV1 {
  const choice = (quantity: number): QuantityWowChoiceV1 => ({
    kind: "quantity",
    numeral: candidate.target,
    quantity,
  });
  return {
    id: `item-${String(index + 1).padStart(3, "0")}`,
    itemType: "wow-group",
    answerability: "objective",
    mode: "quantity",
    choices: positionChoices(
      choice(candidate.target),
      [choice(candidate.distractors[0]), choice(candidate.distractors[1])],
      correctPosition,
      random,
    ),
    correctPosition,
    answer: { kind: "choice", value: correctPosition },
  };
}

function equationItem(
  candidate: EquationWowCandidate,
  index: number,
  correctPosition: 0 | 1 | 2,
  random: Pick<SeededRandom, "nextBounded">,
): EquationWowGroupItemV1 {
  const choice = (displayedResult: number): EquationWowChoiceV1 => ({
    kind: "equation",
    operation: candidate.operation,
    leftOperand: candidate.leftOperand,
    rightOperand: candidate.rightOperand,
    renderedSymbol: candidate.renderedSymbol,
    displayedResult,
  });
  return {
    id: `item-${String(index + 1).padStart(3, "0")}`,
    itemType: "wow-group",
    answerability: "objective",
    mode: "equation",
    choices: positionChoices(
      choice(candidate.trueResult),
      [choice(candidate.falseResults[0]), choice(candidate.falseResults[1])],
      correctPosition,
      random,
    ),
    correctPosition,
    answer: { kind: "choice", value: correctPosition },
  };
}

function invariantFailure(message: string): GenerationFailure {
  return { ok: false, code: GENERATION_INVARIANT_FAILED, message };
}

function validateWowDocument(
  document: FindTheWowDocumentV1,
  mode: FindTheWowMode,
): GenerationFailure | undefined {
  const sharedFailure = validateWorksheetInvariants(document);
  if (sharedFailure !== undefined) {
    return sharedFailure;
  }
  const request = document.request;
  const skills = request.capabilities.mathSkills;
  if (
    document.items.length !== effectiveFindTheWowGroupCount(request) ||
    document.items.some((item) => item.itemType !== "wow-group") ||
    "topicIds" in request ||
    request.options.includeDecorativeGraphics ||
    skills.allowNegativeResults ||
    skills.allowRegrouping ||
    [
      skills.countingMax,
      skills.numeralMax,
      skills.compareMax,
      skills.operandMax,
      skills.resultMax,
    ].some((maximum) => maximum < 0 || maximum > 20)
  ) {
    return invariantFailure(
      "Two Whats and a Wow included unsupported content or effective limits.",
    );
  }

  const quantityLimit = Math.min(skills.countingMax, skills.numeralMax, 20);
  const operandLimit = Math.min(skills.operandMax, 20);
  const resultLimit = Math.min(skills.resultMax, 20);
  const groupKeys = new Set<string>();
  const positionCounts = [0, 0, 0];

  for (const item of document.items) {
    if (
      item.mode !== mode ||
      item.answer.kind !== "choice" ||
      item.answer.value !== item.correctPosition ||
      item.choices.length !== 3 ||
      new Set(item.choices.map((choice) => JSON.stringify(choice))).size !== 3
    ) {
      return invariantFailure(
        "A Two Whats and a Wow group violated its mode, answer, or distinct-choice contract.",
      );
    }
    positionCounts[item.correctPosition] =
      (positionCounts[item.correctPosition] ?? 0) + 1;

    if (item.mode === "quantity") {
      const target = item.choices[0].numeral;
      const truePositions = item.choices
        .map((choice, index) => (choice.quantity === choice.numeral ? index : -1))
        .filter((index) => index !== -1);
      if (
        item.choices.some(
          (choice) =>
            choice.kind !== "quantity" ||
            choice.numeral !== target ||
            !Number.isInteger(choice.numeral) ||
            !Number.isInteger(choice.quantity) ||
            choice.numeral < 1 ||
            choice.quantity < 1 ||
            choice.numeral > quantityLimit ||
            choice.quantity > quantityLimit,
        ) ||
        truePositions.length !== 1 ||
        truePositions[0] !== item.correctPosition
      ) {
        return invariantFailure(
          "A quantity Wow group violated its numeral, quantity, bound, or truth contract.",
        );
      }
      const key = quantityStemKey(target);
      if (groupKeys.has(key)) {
        return invariantFailure("A Two Whats and a Wow group was duplicated.");
      }
      groupKeys.add(key);
    } else {
      const first = item.choices[0];
      const truePositions = item.choices
        .map((choice, index) => {
          const result = arithmeticResult(
            choice.operation,
            choice.leftOperand,
            choice.rightOperand,
          );
          return choice.displayedResult === result ? index : -1;
        })
        .filter((index) => index !== -1);
      if (
        item.choices.some(
          (choice) =>
            choice.kind !== "equation" ||
            choice.operation !== first.operation ||
            choice.leftOperand !== first.leftOperand ||
            choice.rightOperand !== first.rightOperand ||
            choice.renderedSymbol !== first.renderedSymbol ||
            !skills.operations.includes(choice.operation) ||
            !Number.isInteger(choice.leftOperand) ||
            !Number.isInteger(choice.rightOperand) ||
            !Number.isInteger(choice.displayedResult) ||
            choice.leftOperand < 0 ||
            choice.rightOperand < 0 ||
            choice.displayedResult < 0 ||
            choice.leftOperand > operandLimit ||
            choice.rightOperand > operandLimit ||
            choice.displayedResult > resultLimit ||
            (choice.operation === "addition" && choice.renderedSymbol !== "+") ||
            (choice.operation === "subtraction" && choice.renderedSymbol !== "−") ||
            !regroupingFree(
              choice.operation,
              choice.leftOperand,
              choice.rightOperand,
            ),
        ) ||
        truePositions.length !== 1 ||
        truePositions[0] !== item.correctPosition
      ) {
        return invariantFailure(
          "An equation Wow group violated its operation, bound, regrouping, or truth contract.",
        );
      }
      const key = equationStemKey(
        first.operation,
        first.leftOperand,
        first.rightOperand,
      );
      if (groupKeys.has(key)) {
        return invariantFailure("A Two Whats and a Wow group was duplicated.");
      }
      groupKeys.add(key);
    }
  }

  if (Math.max(...positionCounts) - Math.min(...positionCounts) > 1) {
    return invariantFailure(
      "The correct Wow positions were not balanced across the page.",
    );
  }
  return undefined;
}

export function generateFindTheWow(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<FindTheWowDocumentV1> {
  if (
    request.worksheetType !== FIND_THE_WOW_DEFINITION.id ||
    request.generatorVersion !== FIND_THE_WOW_DEFINITION.generatorVersion
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message:
        "The request does not match the registered Two Whats and a Wow generator.",
    };
  }

  const support = getFindTheWowCapabilitySupport(
    request.capabilities.mathSkills,
    request.options.difficulty,
  );
  if (!support.available) {
    return {
      ok: false,
      code: GENERATION_CONSTRAINT_CONFLICT,
      message: support.reason,
    };
  }

  const groupCount = effectiveFindTheWowGroupCount(request);
  let items: readonly WowGroupItemV1[] | undefined;
  if (support.mode === "equation") {
    const stems = enumerateEquationWowStems(request);
    if (stems.length < groupCount) {
      return {
        ok: false,
        code: GENERATION_CONSTRAINT_CONFLICT,
        message: `The confirmed limits provide ${stems.length} unique equation groups, but this length needs ${groupCount}. Choose a shorter worksheet or review the profile limits.`,
      };
    }
    items = constructItems(
      stems,
      groupCount,
      createSeededRandom(request.seed),
      equationItem,
    );
  } else {
    const stems = enumerateQuantityWowStems(request);
    if (stems.length < groupCount) {
      return {
        ok: false,
        code: GENERATION_CONSTRAINT_CONFLICT,
        message: `The confirmed limits provide ${stems.length} unique quantity groups, but this length needs ${groupCount}. Choose a shorter worksheet or review the profile limits.`,
      };
    }
    items = constructItems(
      stems,
      groupCount,
      createSeededRandom(request.seed),
      quantityItem,
    );
  }
  if (items === undefined || items.length !== groupCount) {
    return invariantFailure(
      "A complete balanced Two Whats and a Wow page could not be constructed.",
    );
  }
  const document: FindTheWowDocumentV1 = {
    schemaVersion: 1,
    worksheetType: FIND_THE_WOW_DEFINITION.id,
    generatorVersion: FIND_THE_WOW_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items,
  };
  const invariantFailureResult = validateWowDocument(document, support.mode);
  return invariantFailureResult === undefined
    ? { ok: true, document }
    : invariantFailureResult;
}
