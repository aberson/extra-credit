import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
  type SeededRandom,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_CONSTRAINT_CONFLICT,
  GENERATION_INVARIANT_FAILED,
  REVIEWED_TOPIC_IDS,
  type CountCompareItemV1,
  type GenerationFailure,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type ObjectiveAnswerV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import {
  COUNT_COMPARE_MAKE_DEFINITION,
  COUNT_COMPARE_MAKE_MATCH_CHOICE_COUNT,
  COUNT_COMPARE_MAKE_SUBTYPES,
  COUNT_COMPARE_MAKE_V1_MAXIMUM,
  getCountCompareMakeAllocation,
  getCountCompareMakeCapabilitySupport,
  getCountCompareMakeComparisonLimit,
  getCountCompareMakeItemCount,
  getCountCompareMakeNumeralLimit,
  type CountCompareRelationV1,
  type CountCompareSubtypeCountsV1,
  type CountCompareSubtypeV1,
} from "./definition.js";

export type CountCompareMakeDocumentV1 =
  WorksheetDocumentV1<CountCompareItemV1>;

/**
 * One drawable match exercise: a target numeral and the two distinct in-range
 * distractors it deterministically receives (plan.md:209).
 *
 * The pool holds ONE candidate per target numeral - never a
 * target-by-distractor product - which is what keeps the counted collection
 * and the drawn collection the same. Where the exact match PRINTS is decided
 * per page from the seed and is deliberately not stored here: making it a
 * property of the candidate made it a pure function of the target, which is
 * how every match item at limit 3 came to answer "Choice 3".
 */
export interface CountCompareMatchCandidateV1 {
  readonly target: number;
  readonly distractors: readonly [number, number];
}

export interface CountCompareComparisonCandidateV1 {
  readonly leftQuantity: number;
  readonly rightQuantity: number;
}

export interface CountCompareCompleteCandidateV1 {
  readonly target: number;
  readonly partial: number;
}

export interface CountCompareDrawCandidateV1 {
  readonly target: number;
}

/**
 * THE four collections. Capacity counts these arrays and selection shuffles
 * these same arrays; nothing else in this module enumerates a candidate.
 */
export interface CountCompareCandidatePoolsV1 {
  readonly match: readonly CountCompareMatchCandidateV1[];
  readonly compare: readonly CountCompareComparisonCandidateV1[];
  readonly complete: readonly CountCompareCompleteCandidateV1[];
  readonly draw: readonly CountCompareDrawCandidateV1[];
}

type CountCompareDraftV1 =
  | {
      readonly subtype: "match";
      readonly candidate: CountCompareMatchCandidateV1;
      readonly correctPosition: 0 | 1 | 2;
    }
  | {
      readonly subtype: "compare";
      readonly candidate: CountCompareComparisonCandidateV1;
    }
  | {
      readonly subtype: "complete";
      readonly candidate: CountCompareCompleteCandidateV1;
    }
  | {
      readonly subtype: "draw";
      readonly candidate: CountCompareDrawCandidateV1;
    };

/** Parent-facing subtype names used only in the shortage explanation. */
const COUNT_COMPARE_MAKE_LABELS = {
  match: "numeral-matching",
  compare: "group-comparison",
  complete: "group-completion",
  draw: "draw-a-quantity",
} as const satisfies Record<CountCompareSubtypeV1, string>;

function invariantFailure(message: string): GenerationFailure {
  return { ok: false, code: GENERATION_INVARIANT_FAILED, message };
}

function constraintConflict(message: string): GenerationFailure {
  return { ok: false, code: GENERATION_CONSTRAINT_CONFLICT, message };
}

function itemId(index: number): string {
  return `item-${String(index + 1).padStart(3, "0")}`;
}

/**
 * The comparison a compare item asks for, stated left-relative: the left group
 * has fewer than, the same as, or more than the right group.
 */
export function countCompareRelation(
  leftQuantity: number,
  rightQuantity: number,
): CountCompareRelationV1 {
  if (leftQuantity < rightQuantity) {
    return "less";
  }
  return leftQuantity > rightQuantity ? "greater" : "equal";
}

/**
 * The two in-range distractors a target deterministically receives: the two
 * closest other quantities, RETURNED IN ASCENDING ORDER. The comparator below
 * ranks nearest-first (lower value on a distance tie) only to pick WHICH two;
 * the pair is then ordered by value, so target 20 at limit 20 yields
 * `[18, 19]`, not `[19, 18]`. `placeMatchChoices` destructures the result as
 * `[lower, higher]`, and `generator.test.ts` asserts `lower < higher` for
 * every candidate its limit-12 pool holds. Nearby groups are what make the
 * child count rather than eyeball, and deriving them from the target (instead
 * of enumerating every distractor pair) is what keeps a match candidate
 * one-per-target.
 *
 * Returns `undefined` below three in-range quantities, which is precisely the
 * `L >= 3` condition in plan.md:209.
 */
function nearestDistractors(
  target: number,
  limit: number,
): readonly [number, number] | undefined {
  const others: number[] = [];
  for (let value = 1; value <= limit; value += 1) {
    if (value !== target) {
      others.push(value);
    }
  }
  const ranked = others.sort((left, right) => {
    const byDistance = Math.abs(left - target) - Math.abs(right - target);
    return byDistance === 0 ? left - right : byDistance;
  });
  const [first, second] = ranked;
  if (first === undefined || second === undefined) {
    return undefined;
  }
  return first < second ? [first, second] : [second, first];
}

const MATCH_POSITIONS = [0, 1, 2] as const;

/**
 * Where each match item prints its exact match, drawn from the seed.
 *
 * Sorting the three quantities and rotating by `target % 3` looked varied and
 * was not: the target's rank inside the sorted triple is itself a function of
 * the target, so the rotation cancelled it and the position collapsed to
 * `(rank(target) - target) mod 3` - a constant 2 at limit 3, i.e. every match
 * item on every seed answered "Choice 3", on exactly the age-four profile this
 * family exists to serve. Before the fix each target had exactly ONE reachable
 * position at every limit measured. The committed guard - the one that is
 * actually re-run - is "no target is locked to one position, at the smallest
 * usable limits" in `generator.test.ts`, which sweeps 24 seeds at limits 3, 4
 * and 10.
 *
 * Reading a seeded permutation of the three positions makes the position
 * depend on the seed and NOT on the target, while keeping the page balanced
 * the way `find-the-wow` is: with three match items every position is used
 * once, and with two they are two different positions, so the most- and
 * least-used differ by at most one.
 */
function seededMatchPositions(
  count: number,
  random: Pick<SeededRandom, "nextBounded">,
): readonly (0 | 1 | 2)[] {
  const wheel = seededShuffle(MATCH_POSITIONS, random);
  return Array.from({ length: count }, (_, index) => {
    const position = wheel[index % wheel.length];
    // `wheel` always holds all three positions, so the fallback is
    // unreachable; it keeps the function total without an assertion.
    return position ?? 0;
  });
}

/**
 * Prints the exact match at `correctPosition`, with the two distractors in
 * ascending order around it. The child compares COUNTED GROUPS rather than
 * numerals, so the distractors' relative order reveals nothing; the answer's
 * position is what has to vary, and that comes from the seed.
 */
function placeMatchChoices(
  target: number,
  distractors: readonly [number, number],
  correctPosition: 0 | 1 | 2,
): readonly [number, number, number] {
  const [lower, higher] = distractors;
  switch (correctPosition) {
    case 0:
      return [target, lower, higher];
    case 1:
      return [lower, target, higher];
    case 2:
      return [lower, higher, target];
  }
}

/**
 * Enumerates the four candidate collections for one normalized request.
 *
 * The counted units are exactly the drawn units, per subtype:
 * - `match`: one candidate per target numeral in `1..L`, present only when
 *   `L >= 3` because that is when two distinct distractors exist.
 * - `compare`: every ordered `(left, right)` pair in `1..Lc`.
 * - `complete`: every `(target, partial)` pair with `2 <= target <= L` and
 *   `1 <= partial < target`.
 * - `draw`: one candidate per target in `1..L`.
 */
export function enumerateCountCompareCandidates(
  request: GenerationRequestV1,
): CountCompareCandidatePoolsV1 {
  const skills = request.capabilities.mathSkills;
  const numeralLimit = getCountCompareMakeNumeralLimit(skills);
  const comparisonLimit = getCountCompareMakeComparisonLimit(skills);

  const match: CountCompareMatchCandidateV1[] = [];
  for (let target = 1; target <= numeralLimit; target += 1) {
    const distractors = nearestDistractors(target, numeralLimit);
    if (distractors === undefined) {
      continue;
    }
    match.push({ distractors, target });
  }

  const compare: CountCompareComparisonCandidateV1[] = [];
  for (let leftQuantity = 1; leftQuantity <= comparisonLimit; leftQuantity += 1) {
    for (
      let rightQuantity = 1;
      rightQuantity <= comparisonLimit;
      rightQuantity += 1
    ) {
      compare.push({ leftQuantity, rightQuantity });
    }
  }

  const complete: CountCompareCompleteCandidateV1[] = [];
  for (let target = 2; target <= numeralLimit; target += 1) {
    for (let partial = 1; partial < target; partial += 1) {
      complete.push({ target, partial });
    }
  }

  const draw: CountCompareDrawCandidateV1[] = [];
  for (let target = 1; target <= numeralLimit; target += 1) {
    draw.push({ target });
  }

  return { compare, complete, draw, match };
}

/**
 * Capacity, measured in the collections themselves.
 *
 * This takes the pools rather than the request ON PURPOSE. Steps 5 and 6 each
 * hit this shape mid-iteration - a capacity derived separately from the
 * collection selection sliced, so a shortage failed by seed lottery rather
 * than deterministically - and each was refactored before merge:
 * `find-the-wow` counts the stems it slices, `sentence-builder` counts the
 * bank pool it slices. This family is built that way from the start. A
 * capacity function that can only see the arrays `generateCountCompareMake`
 * shuffles cannot drift from them: there is no second enumeration for it to
 * count.
 */
export function measureCountCompareCapacity(
  pools: CountCompareCandidatePoolsV1,
): CountCompareSubtypeCountsV1 {
  return {
    compare: pools.compare.length,
    complete: pools.complete.length,
    draw: pools.draw.length,
    match: pools.match.length,
  };
}

/**
 * The closed forms plan.md:209 states, kept beside the enumeration so
 * `generator.test.ts` can prove the two agree instead of trusting either
 * alone. The two limits are INDEPENDENT: `MathSkillsV1Schema` declares
 * `countingMax`, `numeralMax` and `compareMax` as three unrelated integer
 * fields with no cross-field refinement, so `comparisonLimit > numeralLimit`
 * is reachable in production (10 / 3 / 10 gives numeral 3, comparison 10).
 * The sweep in `generator.test.ts` therefore varies all three maxima
 * independently over `0..20` and asserts it reached that regime.
 */
export function countCompareCapacityFormula(
  numeralLimit: number,
  comparisonLimit: number,
): CountCompareSubtypeCountsV1 {
  return {
    compare: comparisonLimit * comparisonLimit,
    // `Math.max` keeps L = 0 at +0 rather than the -0 that 0 * -1 produces.
    complete: (numeralLimit * Math.max(0, numeralLimit - 1)) / 2,
    draw: numeralLimit,
    match: numeralLimit >= COUNT_COMPARE_MAKE_MATCH_CHOICE_COUNT ? numeralLimit : 0,
  };
}

/**
 * The INDEPENDENT re-derivation of every Count, Compare & Make answer. There
 * are two derivations BY DESIGN: `buildItem` writes the answer into the
 * immutable item from its draft, and this recomputes it from that same item's
 * own printed sources. Validation refuses any document where the two disagree,
 * so the worksheet and the parent key can never describe different work.
 */
export function recomputeCountCompareAnswer(
  item: CountCompareItemV1,
): ObjectiveAnswerV1 | undefined {
  switch (item.activity) {
    case "match": {
      const positions = item.choices
        .map((choice, index) => (choice === item.target ? index : -1))
        .filter((index) => index !== -1);
      const only = positions[0];
      if (positions.length !== 1 || only === undefined) {
        return undefined;
      }
      return { kind: "choice", value: only === 0 ? 0 : only === 1 ? 1 : 2 };
    }
    case "compare":
      return {
        kind: "comparison",
        value: countCompareRelation(item.leftQuantity, item.rightQuantity),
      };
    case "complete":
      return { kind: "number", value: item.target - item.partial };
    case "draw":
      return { kind: "number", value: item.target };
  }
}

function buildItem(draft: CountCompareDraftV1, index: number): CountCompareItemV1 {
  const base = {
    id: itemId(index),
    itemType: "count-compare",
    answerability: "objective",
  } as const;

  switch (draft.subtype) {
    case "match":
      return {
        ...base,
        activity: "match",
        answer: { kind: "choice", value: draft.correctPosition },
        choices: placeMatchChoices(
          draft.candidate.target,
          draft.candidate.distractors,
          draft.correctPosition,
        ),
        target: draft.candidate.target,
      };
    case "compare":
      return {
        ...base,
        activity: "compare",
        answer: {
          kind: "comparison",
          value: countCompareRelation(
            draft.candidate.leftQuantity,
            draft.candidate.rightQuantity,
          ),
        },
        leftQuantity: draft.candidate.leftQuantity,
        rightQuantity: draft.candidate.rightQuantity,
      };
    case "complete":
      return {
        ...base,
        activity: "complete",
        answer: {
          kind: "number",
          value: draft.candidate.target - draft.candidate.partial,
        },
        partial: draft.candidate.partial,
        target: draft.candidate.target,
      };
    case "draw":
      return {
        ...base,
        activity: "draw",
        answer: { kind: "number", value: draft.candidate.target },
        target: draft.candidate.target,
      };
  }
}

/** Stable identity of the one distinct exercise an item occupies. */
function stemKey(item: CountCompareItemV1): string {
  switch (item.activity) {
    case "match":
      return `match:${item.target}`;
    case "compare":
      return `compare:${item.leftQuantity}:${item.rightQuantity}`;
    case "complete":
      return `complete:${item.target}:${item.partial}`;
    case "draw":
      return `draw:${item.target}`;
  }
}

function sameAnswer(
  actual: ObjectiveAnswerV1,
  expected: ObjectiveAnswerV1 | undefined,
): boolean {
  return (
    expected !== undefined &&
    actual.kind === expected.kind &&
    actual.value === expected.value
  );
}

function withinRange(value: number, low: number, high: number): boolean {
  return Number.isInteger(value) && value >= low && value <= high;
}

const REVIEWED_TOPIC_ID_SET: ReadonlySet<string> = new Set(REVIEWED_TOPIC_IDS);

/**
 * The interest data allowed to reach a page.
 *
 * The two math families that take no interests prove it by refusing any
 * request carrying `topicIds` at all, in two different places: Dry Math's
 * refusal lives in the shared `invariants.ts`, gated on
 * `worksheetType === "dry-math"`, while Two Whats and a Wow's lives in its own
 * `find-the-wow/generator.ts` validator. This family DOES take interests, so
 * the equivalent proof is that the list holds only exact
 * reviewed topic IDs, with no duplicates and no empty list: an unmatched raw
 * interest tag is dropped by the sole projection boundary, and a request that
 * still carries one never reached that boundary. `neutral` is never the result
 * of matching an interest either - it is only the fallback a CONSUMER
 * substitutes when no topic arrived (`sentence-builder/generator.ts`, and this
 * family's own renderer at `web/worksheets/count-compare-make/Renderer.tsx`) -
 * so a request carrying it is refused here too.
 */
function topicIdFailure(
  request: GenerationRequestV1,
): GenerationFailure | undefined {
  if (!("topicIds" in request) || request.topicIds === undefined) {
    return undefined;
  }
  const topicIds = request.topicIds;
  if (
    topicIds.length === 0 ||
    new Set(topicIds).size !== topicIds.length ||
    topicIds.some((topicId) => !REVIEWED_TOPIC_ID_SET.has(topicId))
  ) {
    return invariantFailure(
      "Count, Compare & Make received interest data outside the reviewed topic allowlist.",
    );
  }
  return undefined;
}

export function validateCountCompareMakeDocument(
  document: CountCompareMakeDocumentV1,
): GenerationFailure | undefined {
  const sharedFailure = validateWorksheetInvariants(document);
  if (sharedFailure !== undefined) {
    return sharedFailure;
  }

  const { request } = document;
  const topicFailure = topicIdFailure(request);
  if (topicFailure !== undefined) {
    return topicFailure;
  }
  const skills = request.capabilities.mathSkills;
  const allocation = getCountCompareMakeAllocation(
    request.options.length,
    request.options.printScale,
  );
  const expectedItemCount = getCountCompareMakeItemCount(
    request.options.length,
    request.options.printScale,
  );
  if (
    document.items.length !== expectedItemCount ||
    document.items.some((item) => item.itemType !== "count-compare") ||
    !skills.representations.includes("quantities") ||
    skills.allowRegrouping ||
    skills.allowNegativeResults ||
    [
      skills.countingMax,
      skills.numeralMax,
      skills.compareMax,
      skills.operandMax,
      skills.resultMax,
    ].some((maximum) => maximum < 0 || maximum > COUNT_COMPARE_MAKE_V1_MAXIMUM)
  ) {
    return invariantFailure(
      "Count, Compare & Make included unsupported content or effective limits.",
    );
  }

  const numeralLimit = getCountCompareMakeNumeralLimit(skills);
  const comparisonLimit = getCountCompareMakeComparisonLimit(skills);
  const observed: Record<CountCompareSubtypeV1, number> = {
    compare: 0,
    complete: 0,
    draw: 0,
    match: 0,
  };
  const stems = new Set<string>();

  for (const item of document.items) {
    if (!sameAnswer(item.answer, recomputeCountCompareAnswer(item))) {
      return invariantFailure(
        "A Count, Compare & Make answer did not recompute from its source item.",
      );
    }
    const key = stemKey(item);
    if (stems.has(key)) {
      return invariantFailure(
        "A Count, Compare & Make exercise was repeated on one page.",
      );
    }
    stems.add(key);
    observed[item.activity] += 1;

    switch (item.activity) {
      case "match": {
        if (
          item.choices.length !== COUNT_COMPARE_MAKE_MATCH_CHOICE_COUNT ||
          new Set(item.choices).size !== COUNT_COMPARE_MAKE_MATCH_CHOICE_COUNT ||
          !withinRange(item.target, 1, numeralLimit) ||
          item.choices.some((choice) => !withinRange(choice, 1, numeralLimit))
        ) {
          return invariantFailure(
            "A match item violated its distinct-choice or numeral-bound contract.",
          );
        }
        break;
      }
      case "compare": {
        if (
          !withinRange(item.leftQuantity, 1, comparisonLimit) ||
          !withinRange(item.rightQuantity, 1, comparisonLimit)
        ) {
          return invariantFailure(
            "A compare item used a group outside the confirmed comparison bound.",
          );
        }
        break;
      }
      case "complete": {
        if (
          !withinRange(item.target, 2, numeralLimit) ||
          !withinRange(item.partial, 1, item.target - 1)
        ) {
          return invariantFailure(
            "A complete item violated its target or partial-group bound.",
          );
        }
        break;
      }
      case "draw": {
        if (!withinRange(item.target, 1, numeralLimit)) {
          return invariantFailure(
            "A draw item used a target outside the confirmed numeral bound.",
          );
        }
        break;
      }
    }
  }

  for (const subtype of COUNT_COMPARE_MAKE_SUBTYPES) {
    if (observed[subtype] !== allocation[subtype]) {
      return invariantFailure(
        "Count, Compare & Make did not print its declared subtype mix.",
      );
    }
  }
  return undefined;
}

export function generateCountCompareMake(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<CountCompareMakeDocumentV1> {
  if (
    request.worksheetType !== COUNT_COMPARE_MAKE_DEFINITION.id ||
    request.generatorVersion !== COUNT_COMPARE_MAKE_DEFINITION.generatorVersion
  ) {
    return invariantFailure(
      "The request does not match the registered Count, Compare & Make generator.",
    );
  }

  const support = getCountCompareMakeCapabilitySupport(
    request.capabilities.mathSkills,
  );
  if (!support.available) {
    return constraintConflict(support.reason);
  }

  const allocation = getCountCompareMakeAllocation(
    request.options.length,
    request.options.printScale,
  );
  // ONE enumeration. `capacity` counts these arrays and the selection below
  // shuffles these same arrays, so a shortage fails closed here on EVERY seed
  // rather than surfacing on some seeds as a repeated exercise.
  const pools = enumerateCountCompareCandidates(request);
  const capacity = measureCountCompareCapacity(pools);
  for (const subtype of COUNT_COMPARE_MAKE_SUBTYPES) {
    if (capacity[subtype] < allocation[subtype]) {
      return constraintConflict(
        `The confirmed limits provide ${capacity[subtype]} unique ${COUNT_COMPARE_MAKE_LABELS[subtype]} exercises, but this length needs ${allocation[subtype]}. Choose a shorter worksheet or review the profile's counting limits.`,
      );
    }
  }

  const random = createSeededRandom(request.seed);
  const drafts: CountCompareDraftV1[] = [];
  const selectedMatch = seededShuffle(pools.match, random).slice(
    0,
    allocation.match,
  );
  const matchPositions = seededMatchPositions(selectedMatch.length, random);
  for (const [index, candidate] of selectedMatch.entries()) {
    drafts.push({
      candidate,
      correctPosition: matchPositions[index] ?? 0,
      subtype: "match",
    });
  }
  for (const candidate of seededShuffle(pools.compare, random).slice(
    0,
    allocation.compare,
  )) {
    drafts.push({ candidate, subtype: "compare" });
  }
  for (const candidate of seededShuffle(pools.complete, random).slice(
    0,
    allocation.complete,
  )) {
    drafts.push({ candidate, subtype: "complete" });
  }
  for (const candidate of seededShuffle(pools.draw, random).slice(
    0,
    allocation.draw,
  )) {
    drafts.push({ candidate, subtype: "draw" });
  }

  // The seeded shuffle that interleaves the four subtypes (plan.md:208). Item
  // IDs are assigned after it, so they stay sequential in printed order.
  const items = seededShuffle(drafts, random).map((draft, index) =>
    buildItem(draft, index),
  );

  const document: CountCompareMakeDocumentV1 = {
    schemaVersion: 1,
    worksheetType: COUNT_COMPARE_MAKE_DEFINITION.id,
    generatorVersion: COUNT_COMPARE_MAKE_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items,
  };
  const failure = validateCountCompareMakeDocument(document);
  return failure === undefined ? { ok: true, document } : failure;
}
