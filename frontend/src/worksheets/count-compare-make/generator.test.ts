import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  type ChildProfileV1,
  type GenerationDefaultsV1,
} from "../../shared/config/schema.js";
import { objectiveAnswerEntries } from "../../shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../shared/worksheet/project-request.js";
import { formatSeedHex } from "../../shared/worksheet/seeded-random.js";
import {
  REVIEWED_TOPIC_IDS,
  TOPIC_IDS,
  type CountCompareItemV1,
  type GenerationRequestV1,
  type TopicId,
} from "../../shared/worksheet/types.js";
import {
  COUNT_COMPARE_MAKE_ALLOCATIONS,
  COUNT_COMPARE_MAKE_SUBTYPES,
  getCountCompareMakeAllocation,
  getCountCompareMakeCapabilitySupport,
  getCountCompareMakeComparisonLimit,
  getCountCompareMakeItemCount,
  getCountCompareMakeNumeralLimit,
  type CountCompareSubtypeV1,
} from "./definition.js";
import {
  countCompareCapacityFormula,
  countCompareRelation,
  enumerateCountCompareCandidates,
  generateCountCompareMake,
  measureCountCompareCapacity,
  recomputeCountCompareAnswer,
  validateCountCompareMakeDocument,
  type CountCompareCandidatePoolsV1,
  type CountCompareMakeDocumentV1,
} from "./generator.js";

const WORKSHEET_ID = "11111111-1111-4111-8111-111111111111";

const defaults: GenerationDefaultsV1 = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

interface ProfileShape {
  readonly compareMax?: number;
  readonly countingMax?: number;
  readonly numeralMax?: number;
  readonly representations?: ChildProfileV1["mathSkills"]["representations"];
}

function quantityProfile({
  compareMax,
  countingMax = 10,
  numeralMax,
  representations = ["quantities"],
}: ProfileShape = {}): ChildProfileV1 {
  return {
    id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
    displayName: "Private Riley",
    ageYears: 4,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax,
      numeralMax: numeralMax ?? countingMax,
      compareMax: compareMax ?? countingMax,
      representations,
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "draw-and-tell",
    interests: ["Distinctive Private Space"],
  };
}

function request(
  profile: ChildProfileV1,
  preferences: Partial<GenerationDefaultsV1> = {},
  seed = "00000001",
): GenerationRequestV1 {
  const projection = projectGenerationRequest({
    profile,
    preferences: { ...defaults, ...preferences },
    worksheetType: "count-compare-make",
    generatorVersion: 1,
    seed,
    stretchConfirmed: true,
  });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  return projection.request;
}

function generated(
  requestValue: GenerationRequestV1,
): CountCompareMakeDocumentV1 {
  const result = generateCountCompareMake(requestValue, {
    worksheetId: WORKSHEET_ID,
  });
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.document;
}

function subtypeCounts(
  items: readonly CountCompareItemV1[],
): Readonly<Record<CountCompareSubtypeV1, number>> {
  const counts = { compare: 0, complete: 0, draw: 0, match: 0 };
  for (const item of items) {
    counts[item.activity] += 1;
  }
  return counts;
}

/**
 * The stem key of one exercise, in the same shape for a pool candidate and a
 * generated item. Comparing generated stems against POOL stems is what proves
 * selection drew from the counted collection rather than from somewhere else.
 */
function poolStemKeys(
  pools: CountCompareCandidatePoolsV1,
): Readonly<Record<CountCompareSubtypeV1, ReadonlySet<string>>> {
  return {
    compare: new Set(
      pools.compare.map(
        ({ leftQuantity, rightQuantity }) =>
          `compare:${leftQuantity}:${rightQuantity}`,
      ),
    ),
    complete: new Set(
      pools.complete.map(({ partial, target }) => `complete:${target}:${partial}`),
    ),
    draw: new Set(pools.draw.map(({ target }) => `draw:${target}`)),
    match: new Set(pools.match.map(({ target }) => `match:${target}`)),
  };
}

function itemStemKey(item: CountCompareItemV1): string {
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

describe("Count, Compare & Make subtype budget", () => {
  test("prints the exact fixed mix and one-page budget for each length", () => {
    expect(COUNT_COMPARE_MAKE_ALLOCATIONS).toEqual({
      short: { match: 2, compare: 2, complete: 1, draw: 1 },
      standard: { match: 2, compare: 2, complete: 2, draw: 2 },
      long: { match: 3, compare: 3, complete: 2, draw: 2 },
    });
    expect(getCountCompareMakeItemCount("short", "standard")).toBe(6);
    expect(getCountCompareMakeItemCount("standard", "standard")).toBe(8);
    expect(getCountCompareMakeItemCount("long", "standard")).toBe(10);
  });

  test("large print steps one budget down without changing the mix shape", () => {
    expect(getCountCompareMakeAllocation("long", "large")).toEqual(
      COUNT_COMPARE_MAKE_ALLOCATIONS.standard,
    );
    expect(getCountCompareMakeAllocation("standard", "large")).toEqual(
      COUNT_COMPARE_MAKE_ALLOCATIONS.short,
    );
    expect(getCountCompareMakeAllocation("short", "large")).toEqual(
      COUNT_COMPARE_MAKE_ALLOCATIONS.short,
    );
  });

  test("a generated page holds exactly the allocated items per subtype", () => {
    for (const length of WORKSHEET_LENGTHS) {
      for (const printScale of PRINT_SCALES) {
        const document = generated(
          request(quantityProfile({ countingMax: 20 }), { length, printScale }),
        );
        const allocation = getCountCompareMakeAllocation(length, printScale);
        expect(subtypeCounts(document.items), `${length}/${printScale}`).toEqual(
          allocation,
        );
        expect(document.items).toHaveLength(
          getCountCompareMakeItemCount(length, printScale),
        );
      }
    }
  });
});

describe("Count, Compare & Make availability", () => {
  test("is unavailable without a confirmed quantities representation", () => {
    const support = getCountCompareMakeCapabilitySupport({
      representations: ["equations"],
    });
    expect(support.available).toBe(false);

    const result = generateCountCompareMake(
      request(quantityProfile({ representations: ["equations"] })),
      { worksheetId: WORKSHEET_ID },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
    });
  });

  test("high numeric maxima never authorize the representation on their own", () => {
    const result = generateCountCompareMake(
      request(
        quantityProfile({ countingMax: 20, representations: ["equations"] }),
      ),
      { worksheetId: WORKSHEET_ID },
    );
    expect(result.ok).toBe(false);
  });

  test("refuses a request built for another registered family", () => {
    const foreign = { ...request(quantityProfile()), worksheetType: "dry-math" as const };
    expect(
      generateCountCompareMake(foreign, { worksheetId: WORKSHEET_ID }),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });
});

describe("Count, Compare & Make candidate capacity", () => {
  /**
   * plan.md:209 states four closed forms. This proves each one against the
   * ACTUAL enumerated collection over the full cube of `countingMax` x
   * `numeralMax` x `compareMax` in `0..20` - the whole post-clamp range plus a
   * 0 sentinel, since `shared/config/schema.ts` stores each maximum as
   * `min(1).max(1_000)` and `project-request.ts` clamps it to 20 - so the
   * documented formula and the array a page draws from cannot drift apart.
   *
   * All three axes move INDEPENDENTLY on purpose. `MathSkillsV1Schema`
   * declares them as three unrelated integer fields with no cross-field
   * refinement, so a profile of 10 / 3 / 10 really does reach
   * `comparisonLimit > numeralLimit` - a regime an earlier version of this
   * sweep pinned `numeralMax` to `countingMax` and never enumerated. The
   * regime tally below is asserted rather than assumed: if a future clamp
   * makes one of the three orderings unreachable, this fails instead of
   * quietly narrowing.
   */
  test("the plan's closed forms equal the enumerated collections everywhere", () => {
    const regimes = { comparisonAbove: 0, equal: 0, numeralAbove: 0 };
    for (let countingMax = 0; countingMax <= 20; countingMax += 1) {
      for (let numeralMax = 0; numeralMax <= 20; numeralMax += 1) {
        for (let compareMax = 0; compareMax <= 20; compareMax += 1) {
          const requestValue = request(
            quantityProfile({ compareMax, countingMax, numeralMax }),
          );
          const skills = requestValue.capabilities.mathSkills;
          const numeralLimit = getCountCompareMakeNumeralLimit(skills);
          const comparisonLimit = getCountCompareMakeComparisonLimit(skills);
          if (comparisonLimit > numeralLimit) {
            regimes.comparisonAbove += 1;
          } else if (comparisonLimit < numeralLimit) {
            regimes.numeralAbove += 1;
          } else {
            regimes.equal += 1;
          }
          const pools = enumerateCountCompareCandidates(requestValue);
          expect(
            measureCountCompareCapacity(pools),
            `${countingMax}/${numeralMax}/${compareMax}`,
          ).toEqual(countCompareCapacityFormula(numeralLimit, comparisonLimit));
        }
      }
    }
    expect(regimes.comparisonAbove).toBeGreaterThan(0);
    expect(regimes.numeralAbove).toBeGreaterThan(0);
    expect(regimes.equal).toBeGreaterThan(0);
  });

  test("match capacity is L targets at L>=3 and zero below it", () => {
    for (let limit = 0; limit <= 6; limit += 1) {
      const pools = enumerateCountCompareCandidates(
        request(quantityProfile({ countingMax: limit })),
      );
      expect(pools.match.length, `L=${limit}`).toBe(limit >= 3 ? limit : 0);
      expect(new Set(pools.match.map(({ target }) => target)).size).toBe(
        pools.match.length,
      );
    }
  });

  test("every match candidate carries two distinct in-range distractors", () => {
    const limit = 12;
    const pools = enumerateCountCompareCandidates(
      request(quantityProfile({ countingMax: limit })),
    );
    for (const candidate of pools.match) {
      const [lower, higher] = candidate.distractors;
      const where = `target ${candidate.target}`;
      expect(new Set([candidate.target, lower, higher]).size, where).toBe(3);
      expect(lower, where).toBeLessThan(higher);
      for (const quantity of [lower, higher]) {
        expect(quantity, where).toBeGreaterThanOrEqual(1);
        expect(quantity, where).toBeLessThanOrEqual(limit);
      }
    }
  });

  test("a printed match item shows the target and both its distractors", () => {
    const limit = 12;
    const byTarget = new Map(
      enumerateCountCompareCandidates(
        request(quantityProfile({ countingMax: limit })),
      ).match.map((candidate) => [candidate.target, candidate]),
    );
    for (let seed = 1; seed <= 12; seed += 1) {
      const document = generated(
        request(
          quantityProfile({ countingMax: limit }),
          { length: "long" },
          formatSeedHex(seed),
        ),
      );
      for (const item of document.items) {
        if (item.activity !== "match") {
          continue;
        }
        const candidate = byTarget.get(item.target);
        if (candidate === undefined) {
          throw new Error(`${item.id} used a target outside the pool.`);
        }
        expect([...item.choices].sort((a, b) => a - b), item.id).toEqual(
          [item.target, ...candidate.distractors].sort((a, b) => a - b),
        );
        expect(item.choices[item.answer.value], item.id).toBe(item.target);
      }
    }
  });

  test("enumeration is a pure function of the normalized request", () => {
    const requestValue = request(quantityProfile({ countingMax: 9 }));
    expect(enumerateCountCompareCandidates(requestValue)).toEqual(
      enumerateCountCompareCandidates(requestValue),
    );
  });

  test("complete candidates cover targets 2..L with a smaller partial group", () => {
    const pools = enumerateCountCompareCandidates(
      request(quantityProfile({ countingMax: 5 })),
    );
    expect(pools.complete).toHaveLength(10);
    for (const { partial, target } of pools.complete) {
      expect(target).toBeGreaterThanOrEqual(2);
      expect(target).toBeLessThanOrEqual(5);
      expect(partial).toBeGreaterThanOrEqual(1);
      expect(partial).toBeLessThan(target);
    }
  });

  test("compare candidates are the ordered pairs, equal pairs included", () => {
    const pools = enumerateCountCompareCandidates(
      request(quantityProfile({ compareMax: 4, countingMax: 4 })),
    );
    expect(pools.compare).toHaveLength(16);
    expect(
      pools.compare.filter(
        ({ leftQuantity, rightQuantity }) => leftQuantity === rightQuantity,
      ),
    ).toHaveLength(4);
  });
});

/**
 * The defect shape this step exists to avoid.
 *
 * Steps 5 and 6 each hit it mid-iteration - a capacity counted in a DIFFERENT
 * collection than the one selection drew from, so a shortage failed by seed
 * lottery: some seeds produced a duplicate exercise while the capacity
 * arithmetic claimed there was room. Each was refactored to count its own
 * selection collection before merge, so neither shipped it. These properties
 * assert the invariant itself rather than one case: over many shapes and many
 * seeds, the verdict is a property of the REQUEST alone, and every exercise a
 * page prints is a member of the very collection whose length was compared
 * with the allocation.
 */
describe("capacity is counted in the collection selection draws from", () => {
  const SEEDS = [
    1, 2, 3, 7, 13, 42, 97, 255, 1024, 65_535, 999_983, 0xdead_beef,
  ] as const;

  const requestShape = fc.record({
    compareMax: fc.integer({ min: 0, max: 24 }),
    countingMax: fc.integer({ min: 0, max: 24 }),
    length: fc.constantFrom(...WORKSHEET_LENGTHS),
    numeralMax: fc.integer({ min: 0, max: 24 }),
    printScale: fc.constantFrom(...PRINT_SCALES),
  });

  test("the ok/conflict verdict is identical on every seed", () => {
    // A property that only ever saw feasible shapes would pass without
    // testing anything; the coverage assertions below fail the test if this
    // run never reached one of the two verdicts.
    const verdicts = new Set<boolean>();
    fc.assert(
      fc.property(requestShape, (shape) => {
        const profile = quantityProfile({
          compareMax: shape.compareMax,
          countingMax: shape.countingMax,
          numeralMax: shape.numeralMax,
        });
        const base = request(profile, {
          length: shape.length,
          printScale: shape.printScale,
        });
        const allocation = getCountCompareMakeAllocation(
          shape.length,
          shape.printScale,
        );
        const capacity = measureCountCompareCapacity(
          enumerateCountCompareCandidates(base),
        );
        const expectedOk = COUNT_COMPARE_MAKE_SUBTYPES.every(
          (subtype) => capacity[subtype] >= allocation[subtype],
        );
        verdicts.add(expectedOk);

        for (const seed of SEEDS) {
          const seeded = request(
            profile,
            { length: shape.length, printScale: shape.printScale },
            formatSeedHex(seed),
          );
          const result = generateCountCompareMake(seeded, {
            worksheetId: WORKSHEET_ID,
          });
          // A shortage must fail closed on EVERY seed, never on some.
          expect(result.ok, `seed ${seed}`).toBe(expectedOk);
          if (!result.ok) {
            expect(result.code).toBe("GENERATION_CONSTRAINT_CONFLICT");
          }
        }
        return true;
      }),
      { numRuns: 60, seed: 20_260_830 },
    );
    expect(verdicts).toEqual(new Set([false, true]));
  });

  test("every printed exercise is a member of the counted collection", () => {
    let printedPages = 0;
    fc.assert(
      fc.property(requestShape, fc.integer({ min: 1, max: 0x7fff_ffff }), (shape, seed) => {
        const profile = quantityProfile({
          compareMax: shape.compareMax,
          countingMax: shape.countingMax,
          numeralMax: shape.numeralMax,
        });
        const seeded = request(
          profile,
          { length: shape.length, printScale: shape.printScale },
          formatSeedHex(seed),
        );
        const result = generateCountCompareMake(seeded, {
          worksheetId: WORKSHEET_ID,
        });
        if (!result.ok) {
          return true;
        }
        printedPages += 1;
        const stems = poolStemKeys(enumerateCountCompareCandidates(seeded));
        const seen = new Set<string>();
        for (const item of result.document.items) {
          const key = itemStemKey(item);
          expect(stems[item.activity].has(key), key).toBe(true);
          // No exercise may fill two slots: distinctness is what the counted
          // length actually promises.
          expect(seen.has(key), key).toBe(false);
          seen.add(key);
        }
        expect(subtypeCounts(result.document.items)).toEqual(
          getCountCompareMakeAllocation(shape.length, shape.printScale),
        );
        return true;
      }),
      { numRuns: 80, seed: 20_260_830 },
    );
    expect(printedPages).toBeGreaterThan(10);
  });

  test("a subtype one short of its allocation fails closed before filling", () => {
    // L = 3 gives match 3, compare 9, complete 3, draw 3 - `long` needs
    // match 3 / compare 3 / complete 2 / draw 2, so it fits; L = 2 kills match
    // (needs L >= 3) while compare/complete/draw still look plausible.
    const feasible = generateCountCompareMake(
      request(quantityProfile({ countingMax: 3 }), { length: "long" }),
      { worksheetId: WORKSHEET_ID },
    );
    expect(feasible.ok).toBe(true);

    const short = generateCountCompareMake(
      request(quantityProfile({ countingMax: 2 }), { length: "short" }),
      { worksheetId: WORKSHEET_ID },
    );
    expect(short).toMatchObject({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
    });
    expect(short.ok ? "" : short.message).toMatch(/numeral-matching/u);
    expect(short).not.toHaveProperty("document");
  });

  test("a comparison shortage is reported in comparison units", () => {
    // counting 4 / compare 1 leaves exactly one ordered comparison pair while
    // every other subtype has room, so only the compare gate may fire.
    const result = generateCountCompareMake(
      request(quantityProfile({ compareMax: 1, countingMax: 4 }), {
        length: "short",
      }),
      { worksheetId: WORKSHEET_ID },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
    });
    expect(result.ok ? "" : result.message).toMatch(/group-comparison/u);
  });
});

/**
 * The correct match position must come from the SEED, not from the target.
 *
 * Rotating the sorted triple by `target % 3` cancelled against the target's
 * own rank in that triple, so the position was a pure function of the target:
 * at limit 3 every match item on every seed answered "Choice 3", and a child
 * could score full marks by always circling the third group. These assertions
 * are about the property that failed - one target reaching more than one
 * position - rather than about any particular page.
 */
describe("Count, Compare & Make match position", () => {
  function matchPositionsByTarget(
    limit: number,
    seeds: number,
  ): ReadonlyMap<number, Set<number>> {
    const byTarget = new Map<number, Set<number>>();
    for (let seed = 1; seed <= seeds; seed += 1) {
      const document = generated(
        request(
          quantityProfile({ countingMax: limit }),
          { length: "long" },
          formatSeedHex(seed),
        ),
      );
      for (const item of document.items) {
        if (item.activity !== "match") {
          continue;
        }
        const seen = byTarget.get(item.target) ?? new Set<number>();
        seen.add(item.answer.value);
        byTarget.set(item.target, seen);
      }
    }
    return byTarget;
  }

  test("no target is locked to one position, at the smallest usable limits", () => {
    // Limit 3 is the smallest limit that supports match items at all, and it
    // is reachable from an age-four profile at Practice.
    for (const limit of [3, 4, 10]) {
      const byTarget = matchPositionsByTarget(limit, 24);
      expect(byTarget.size, `L=${limit}`).toBeGreaterThan(0);
      for (const [target, positions] of byTarget) {
        expect(
          positions.size,
          `L=${limit} target ${target} only ever answered ${[...positions].join(",")}`,
        ).toBeGreaterThan(1);
      }
    }
  });

  test("all three positions are reachable, and none dominates the page", () => {
    for (const limit of [3, 4]) {
      const reached = new Set<number>();
      for (const positions of matchPositionsByTarget(limit, 24).values()) {
        for (const position of positions) {
          reached.add(position);
        }
      }
      expect(reached, `L=${limit}`).toEqual(new Set([0, 1, 2]));
    }

    // Page balance, the same property `find-the-wow` holds: across the match
    // items of ONE page the most- and least-used positions differ by at most
    // one, so a page never parks two answers in one column and none elsewhere.
    for (let seed = 1; seed <= 24; seed += 1) {
      const document = generated(
        request(
          quantityProfile({ countingMax: 10 }),
          { length: "long" },
          formatSeedHex(seed),
        ),
      );
      const counts = [0, 0, 0];
      for (const item of document.items) {
        if (item.activity === "match") {
          counts[item.answer.value] = (counts[item.answer.value] ?? 0) + 1;
        }
      }
      expect(Math.max(...counts) - Math.min(...counts), `seed ${seed}`)
        .toBeLessThanOrEqual(1);
    }
  });
});

describe("Count, Compare & Make bounds and determinism", () => {
  test("numeral work stays within min(countingMax, numeralMax, 20)", () => {
    const document = generated(
      request(quantityProfile({ compareMax: 20, countingMax: 20, numeralMax: 6 })),
    );
    const limit = 6;
    for (const item of document.items) {
      if (item.activity === "compare") {
        continue;
      }
      expect(item.target).toBeLessThanOrEqual(limit);
      if (item.activity === "match") {
        for (const choice of item.choices) {
          expect(choice).toBeLessThanOrEqual(limit);
        }
      }
      if (item.activity === "complete") {
        expect(item.partial).toBeLessThan(item.target);
      }
    }
  });

  test("comparison work stays within min(countingMax, compareMax, 20)", () => {
    const document = generated(
      request(quantityProfile({ compareMax: 3, countingMax: 20, numeralMax: 20 })),
    );
    const comparisons = document.items.filter(
      (item) => item.activity === "compare",
    );
    expect(comparisons.length).toBeGreaterThan(0);
    for (const item of comparisons) {
      expect(item.leftQuantity).toBeLessThanOrEqual(3);
      expect(item.rightQuantity).toBeLessThanOrEqual(3);
      expect(item.leftQuantity).toBeGreaterThanOrEqual(1);
    }
  });

  test("a stored maximum above 20 is clamped to the v1 envelope", () => {
    const requestValue = request(
      quantityProfile({ compareMax: 60, countingMax: 50, numeralMax: 40 }),
      { length: "long" },
    );
    expect(requestValue.capabilities.mathSkills.countingMax).toBe(20);
    const document = generated(requestValue);
    for (const item of document.items) {
      const quantities =
        item.activity === "compare"
          ? [item.leftQuantity, item.rightQuantity]
          : item.activity === "match"
            ? [item.target, ...item.choices]
            : item.activity === "complete"
              ? [item.target, item.partial]
              : [item.target];
      for (const quantity of quantities) {
        expect(quantity).toBeLessThanOrEqual(20);
        expect(quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("the same normalized request and seed yield identical content", () => {
    const requestValue = request(quantityProfile({ countingMax: 15 }), {
      length: "long",
    });
    const first = generated(requestValue);
    const second = generateCountCompareMake(requestValue, {
      worksheetId: "22222222-2222-4222-8222-222222222222",
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.document.items).toEqual(first.items);
      expect(second.document.worksheetId).not.toBe(first.worksheetId);
    }
  });

  test("a different seed reorders or re-draws the page", () => {
    const profile = quantityProfile({ countingMax: 15 });
    const first = generated(request(profile, { length: "long" }, "00000001"));
    const second = generated(request(profile, { length: "long" }, "0000002a"));
    expect(second.items).not.toEqual(first.items);
  });

  test("the seeded shuffle really interleaves the four subtypes", () => {
    const activities = new Set<string>();
    let interleaved = false;
    for (let seed = 1; seed <= 12; seed += 1) {
      const document = generated(
        request(quantityProfile({ countingMax: 20 }), { length: "long" }, formatSeedHex(seed)),
      );
      const order = document.items.map((item) => item.activity);
      for (const activity of order) {
        activities.add(activity);
      }
      // Grouped output would print every match, then every compare, and so on.
      const grouped = [...new Set(order)].flatMap((activity) =>
        order.filter((candidate) => candidate === activity),
      );
      if (order.join(",") !== grouped.join(",")) {
        interleaved = true;
      }
    }
    expect(activities).toEqual(
      new Set(["match", "compare", "complete", "draw"]),
    );
    expect(interleaved).toBe(true);
  });
});

describe("Count, Compare & Make answers", () => {
  test("every answer recomputes from its own immutable source item", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const document = generated(
        request(quantityProfile({ countingMax: 18 }), { length: "long" }, formatSeedHex(seed)),
      );
      for (const item of document.items) {
        expect(recomputeCountCompareAnswer(item), item.id).toEqual(item.answer);
        switch (item.activity) {
          case "match":
            expect(item.choices[item.answer.value]).toBe(item.target);
            break;
          case "compare":
            expect(item.answer.value).toBe(
              countCompareRelation(item.leftQuantity, item.rightQuantity),
            );
            break;
          case "complete":
            expect(item.answer.value).toBe(item.target - item.partial);
            break;
          case "draw":
            expect(item.answer.value).toBe(item.target);
            break;
        }
      }
    }
  });

  test("the parent key is the same document, in item order, with no open items", () => {
    const document = generated(
      request(quantityProfile({ countingMax: 18 }), { length: "long" }),
    );
    const entries = objectiveAnswerEntries(document);
    expect(entries).toHaveLength(document.items.length);
    expect(entries.map(({ itemId }) => itemId)).toEqual(
      document.items.map((item) => item.id),
    );
    expect(entries.map(({ answer }) => answer)).toEqual(
      document.items.map((item) => item.answer),
    );
    expect(
      document.items.every((item) => item.answerability === "objective"),
    ).toBe(true);
  });

  test("the relation covers fewer, the same, and more", () => {
    expect(countCompareRelation(2, 5)).toBe("less");
    expect(countCompareRelation(5, 5)).toBe("equal");
    expect(countCompareRelation(5, 2)).toBe("greater");
  });

  test("decoration never reaches the item model", () => {
    const withGraphics = generated(
      request(quantityProfile({ countingMax: 12 }), {
        includeDecorativeGraphics: true,
      }),
    );
    const withoutGraphics = generated(
      request(quantityProfile({ countingMax: 12 }), {
        includeDecorativeGraphics: false,
      }),
    );
    expect(withoutGraphics.items).toEqual(withGraphics.items);
  });

  test("interest personalization never reaches the item model", () => {
    const withInterests = generated(
      request(quantityProfile({ countingMax: 12 }), { useInterests: true }),
    );
    const withoutInterests = generated(
      request(quantityProfile({ countingMax: 12 }), { useInterests: false }),
    );
    expect(withoutInterests.items).toEqual(withInterests.items);
  });
});

/**
 * `validateCountCompareMakeDocument` is the last gate before a page is called
 * good: `shared/worksheet/registry.ts` wires this family's `generate` to
 * `generateCountCompareMake`, whose final act is to run this validator and
 * return a document only if it passes. Each case below tampers with ONE
 * property of an otherwise valid document and requires the validator to name
 * it, so the gate cannot be silently removed or weakened.
 */
describe("Count, Compare & Make document validation", () => {
  const validRequest = request(quantityProfile({ countingMax: 12 }), {
    length: "long",
  });

  function validDocument(): CountCompareMakeDocumentV1 {
    return generated(validRequest);
  }

  function withItems(
    mutate: (items: CountCompareItemV1[]) => CountCompareItemV1[],
  ): CountCompareMakeDocumentV1 {
    const document = validDocument();
    return { ...document, items: mutate([...document.items]) };
  }

  function withRequest(
    overrides: Partial<GenerationRequestV1>,
  ): CountCompareMakeDocumentV1 {
    const document = validDocument();
    const tampered = { ...document.request, ...overrides };
    return { ...document, request: tampered };
  }

  function indexOfActivity(
    items: readonly CountCompareItemV1[],
    activity: CountCompareItemV1["activity"],
    skip = 0,
  ): number {
    const matches = items
      .map((item, index) => (item.activity === activity ? index : -1))
      .filter((index) => index !== -1);
    const found = matches[skip];
    if (found === undefined) {
      throw new Error(`The fixture had no ${activity} item at offset ${skip}.`);
    }
    return found;
  }

  function expectRejected(
    document: CountCompareMakeDocumentV1,
    pattern: RegExp,
  ): void {
    const failure = validateCountCompareMakeDocument(document);
    expect(failure?.code).toBe("GENERATION_INVARIANT_FAILED");
    expect(failure?.message ?? "").toMatch(pattern);
  }

  test("accepts the document its own generator just produced", () => {
    expect(validateCountCompareMakeDocument(validDocument())).toBeUndefined();
  });

  test("rejects a page that lost an item", () => {
    expectRejected(
      withItems((items) => items.slice(0, -1)),
      /unsupported content or effective limits/u,
    );
  });

  test("rejects a page whose subtype mix drifted from its allocation", () => {
    expectRejected(
      withItems((items) => {
        const drawIndex = indexOfActivity(items, "draw");
        const compareIndex = indexOfActivity(items, "compare");
        const draw = items[drawIndex];
        const compare = items[compareIndex];
        if (draw?.activity !== "draw" || compare === undefined) {
          throw new Error("The fixture was missing a subtype.");
        }
        // A third draw item where a compare item belongs: same item count,
        // same sequential IDs, unused target, so only the mix is wrong.
        const unusedTarget = items.every(
          (item) => item.activity !== "draw" || item.target !== 1,
        )
          ? 1
          : 2;
        items[compareIndex] = {
          ...draw,
          answer: { kind: "number", value: unusedTarget },
          id: compare.id,
          target: unusedTarget,
        };
        return items;
      }),
      /declared subtype mix/u,
    );
  });

  test("rejects a match answer that points at the wrong group", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "match");
        const source = items[index];
        if (source?.activity !== "match") {
          throw new Error("The fixture had no match item.");
        }
        const wrongPosition: 0 | 1 = source.answer.value === 0 ? 1 : 0;
        items[index] = {
          ...source,
          answer: { kind: "choice", value: wrongPosition },
        };
        return items;
      }),
      /did not recompute/u,
    );
  });

  test("rejects a flipped comparison relation", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "compare");
        const source = items[index];
        if (source?.activity !== "compare") {
          throw new Error("The fixture had no compare item.");
        }
        items[index] = {
          ...source,
          answer: {
            kind: "comparison",
            value: source.answer.value === "less" ? "greater" : "less",
          },
        };
        return items;
      }),
      /did not recompute/u,
    );
  });

  test("rejects an off-by-one missing count", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "complete");
        const source = items[index];
        if (source?.activity !== "complete") {
          throw new Error("The fixture had no complete item.");
        }
        items[index] = {
          ...source,
          answer: { kind: "number", value: source.answer.value + 1 },
        };
        return items;
      }),
      /did not recompute/u,
    );
  });

  test("rejects a draw answer that is not the target count", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "draw");
        const source = items[index];
        if (source?.activity !== "draw") {
          throw new Error("The fixture had no draw item.");
        }
        items[index] = {
          ...source,
          answer: { kind: "number", value: source.target + 1 },
        };
        return items;
      }),
      /did not recompute/u,
    );
  });

  test("rejects the same exercise printed twice", () => {
    expectRejected(
      withItems((items) => {
        const firstIndex = indexOfActivity(items, "draw");
        const secondIndex = indexOfActivity(items, "draw", 1);
        const first = items[firstIndex];
        const second = items[secondIndex];
        if (first?.activity !== "draw" || second?.activity !== "draw") {
          throw new Error("The fixture had fewer than two draw items.");
        }
        items[secondIndex] = {
          ...second,
          answer: { kind: "number", value: first.target },
          target: first.target,
        };
        return items;
      }),
      /repeated on one page/u,
    );
  });

  test("rejects a match item whose groups are not three distinct quantities", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "match");
        const source = items[index];
        if (source?.activity !== "match") {
          throw new Error("The fixture had no match item.");
        }
        const [first, second] = source.choices;
        items[index] = {
          ...source,
          // Two identical distractor groups; the exact match stays put so the
          // answer still recomputes and only the distinctness rule can fire.
          answer: { kind: "choice", value: 0 },
          choices: [source.target, first === source.target ? second : first, first === source.target ? second : first],
          target: source.target,
        };
        return items;
      }),
      /distinct-choice or numeral-bound/u,
    );
  });

  test("rejects a match item drawn past the confirmed numeral bound", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "match");
        const source = items[index];
        if (source?.activity !== "match") {
          throw new Error("The fixture had no match item.");
        }
        // Self-consistent, so the answer recomputes; only the bound is wrong.
        items[index] = {
          ...source,
          answer: { kind: "choice", value: 0 },
          choices: [19, 17, 18],
          target: 19,
        };
        return items;
      }),
      /distinct-choice or numeral-bound/u,
    );
  });

  test("rejects a compared group past the confirmed comparison bound", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "compare");
        const source = items[index];
        if (source?.activity !== "compare") {
          throw new Error("The fixture had no compare item.");
        }
        items[index] = {
          ...source,
          answer: { kind: "comparison", value: "greater" },
          leftQuantity: 19,
          rightQuantity: 1,
        };
        return items;
      }),
      /outside the confirmed comparison bound/u,
    );
  });

  test("rejects a complete item whose partial group is not smaller than its target", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "complete");
        const source = items[index];
        if (source?.activity !== "complete") {
          throw new Error("The fixture had no complete item.");
        }
        // Nothing left to draw: partial equals target, so the answer is 0 and
        // still recomputes. Only the bound rule can reject this.
        items[index] = {
          ...source,
          answer: { kind: "number", value: 0 },
          partial: source.target,
        };
        return items;
      }),
      /target or partial-group bound/u,
    );
  });

  test("rejects a draw target outside the confirmed numeral bound", () => {
    expectRejected(
      withItems((items) => {
        const index = indexOfActivity(items, "draw");
        const source = items[index];
        if (source?.activity !== "draw") {
          throw new Error("The fixture had no draw item.");
        }
        items[index] = {
          ...source,
          answer: { kind: "number", value: 19 },
          target: 19,
        };
        return items;
      }),
      /outside the confirmed numeral bound/u,
    );
  });

  test("rejects a request that lost its quantities representation", () => {
    expectRejected(
      withRequest({
        capabilities: {
          ...validRequest.capabilities,
          mathSkills: {
            ...validRequest.capabilities.mathSkills,
            representations: ["equations"],
          },
        },
      }),
      /unsupported content or effective limits/u,
    );
  });

  test("rejects an effective limit above the v1 envelope", () => {
    expectRejected(
      withRequest({
        capabilities: {
          ...validRequest.capabilities,
          mathSkills: {
            ...validRequest.capabilities.mathSkills,
            compareMax: 21,
          },
        },
      }),
      /unsupported content or effective limits/u,
    );
  });

  test("rejects a future permission that v1 forces false", () => {
    // `EffectiveMathSkillsV1` types both future permissions as `false`, so a
    // deliberate cast is the only way to reach this runtime guard. The guard
    // still earns its keep: it is what fails loudly if a request ever arrives
    // from outside that type, and `invariants.ts` guards Dry Math the same way.
    const permissive = {
      ...validRequest.capabilities,
      mathSkills: {
        ...validRequest.capabilities.mathSkills,
        allowRegrouping: true,
      },
    } as unknown as GenerationRequestV1["capabilities"];
    expectRejected(
      withRequest({ capabilities: permissive }),
      /unsupported content or effective limits/u,
    );
  });
});

/**
 * The interest-data gate. The two math families that take no interests prove
 * it by refusing any request that carries `topicIds` at all; this family takes
 * interests, so the equivalent proof is that only exact reviewed topic IDs
 * reach a page.
 */
describe("Count, Compare & Make interest data", () => {
  const base = request(quantityProfile({ countingMax: 12 }), { length: "long" });

  function documentWithTopics(
    topicIds: readonly TopicId[] | undefined,
  ): CountCompareMakeDocumentV1 {
    const source = generated(base);
    const tampered =
      topicIds === undefined
        ? base
        : ({ ...base, topicIds } satisfies GenerationRequestV1);
    return { ...source, request: tampered };
  }

  test("accepts a reviewed topic list and an absent one", () => {
    expect(
      validateCountCompareMakeDocument(documentWithTopics(undefined)),
    ).toBeUndefined();
    expect(
      validateCountCompareMakeDocument(documentWithTopics(["space", "animals"])),
    ).toBeUndefined();
  });

  test("refuses every declared topic outside the reviewed allowlist", () => {
    // The CONSUMER direction: `reviewed` reads the leaf `REVIEWED_TOPIC_IDS`
    // while the validator reads its own `REVIEWED_TOPIC_ID_SET`, so a second,
    // drifted copy inside this generator fails here on any declared ID.
    // Sweeping the full declared set is what makes "exactly the reviewed ones"
    // checkable rather than asserted. That the projector can actually EMIT
    // each reviewed ID is a separate claim, proved by "the validator accepts
    // exactly what the sole projector can emit" below.
    for (const topicId of TOPIC_IDS) {
      const reviewed = (REVIEWED_TOPIC_IDS as readonly string[]).includes(
        topicId,
      );
      const failure = validateCountCompareMakeDocument(
        documentWithTopics([topicId]),
      );
      expect(failure === undefined, topicId).toBe(reviewed);
    }
  });

  test("refuses the neutral fallback, duplicates, and an empty list", () => {
    for (const topicIds of [
      ["neutral"],
      ["space", "space"],
      ["space", "neutral"],
      [],
    ] as const) {
      const failure = validateCountCompareMakeDocument(
        documentWithTopics(topicIds),
      );
      expect(failure?.code, JSON.stringify(topicIds)).toBe(
        "GENERATION_INVARIANT_FAILED",
      );
      expect(failure?.message ?? "", JSON.stringify(topicIds)).toMatch(
        /reviewed topic allowlist/u,
      );
    }
  });

  test("the generator refuses to build a page from unreviewed interest data", () => {
    expect(
      generateCountCompareMake(
        { ...base, topicIds: ["neutral"] },
        { worksheetId: WORKSHEET_ID },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });

  test("the validator accepts exactly what the sole projector can emit", () => {
    // Observational rather than a re-typed list: the allowlist now lives in
    // ONE leaf constant that the projector and this generator both import, and
    // the check that they agree is driven through the real projection boundary
    // so a future second copy of the list fails here.
    for (const topicId of REVIEWED_TOPIC_IDS) {
      const projection = projectGenerationRequest({
        profile: { ...quantityProfile({ countingMax: 12 }), interests: [topicId] },
        preferences: { ...defaults, length: "long", useInterests: true },
        worksheetType: "count-compare-make",
        generatorVersion: 1,
        seed: "00000001",
      });
      if (!projection.ok) {
        throw new Error(projection.message);
      }
      expect(projection.request.topicIds, topicId).toEqual([topicId]);
      expect(
        validateCountCompareMakeDocument(documentWithTopics([topicId])),
        topicId,
      ).toBeUndefined();
    }

    // An unmatched raw tag never becomes a topic, so the validator never has
    // to accept one.
    const unmatched = projectGenerationRequest({
      profile: {
        ...quantityProfile({ countingMax: 12 }),
        interests: ["Distinctive Private Nonsense"],
      },
      preferences: { ...defaults, length: "long", useInterests: true },
      worksheetType: "count-compare-make",
      generatorVersion: 1,
      seed: "00000001",
    });
    if (!unmatched.ok) {
      throw new Error(unmatched.message);
    }
    expect("topicIds" in unmatched.request).toBe(false);
  });
});
