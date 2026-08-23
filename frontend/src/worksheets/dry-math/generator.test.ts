import { describe, expect, test } from "vitest";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema.js";
import {
  objectiveAnswerEntries,
  recomputeDryMathAnswer,
  validateWorksheetInvariants,
} from "../../shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../shared/worksheet/project-request.js";
import {
  createSeededRandom,
  formatSeedHex,
  seededShuffle,
  unbiasedBoundedSelection,
} from "../../shared/worksheet/seeded-random.js";
import type {
  DryMathItemV1,
  GenerationRequestV1,
} from "../../shared/worksheet/types.js";
import {
  effectiveDryMathItemCount,
  enumerateDryMathCandidates,
  generateDryMath,
} from "./generator.js";
import { getDryMathItemCount } from "./definition.js";

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

function profile(
  operandMax = 10,
  resultMax = operandMax,
  operations: ChildProfileV1["mathSkills"]["operations"] = [
    "addition",
    "subtraction",
  ],
): ChildProfileV1 {
  return {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Morgan Private",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["quantities", "equations"],
      understandsEquality: false,
      operations,
      operandMax,
      resultMax,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["Distinctive Secret Interest"],
  };
}

function request(
  sourceProfile = profile(),
  preferences: GenerationDefaultsV1 = defaults,
  seed = "00000001",
): GenerationRequestV1 {
  const projected = projectGenerationRequest({
    profile: sourceProfile,
    preferences,
    worksheetType: "dry-math",
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  return projected.request;
}

function generated(requestValue: GenerationRequestV1, worksheetId = "11111111-1111-4111-8111-111111111111") {
  const result = generateDryMath(requestValue, { worksheetId });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.document;
}

function carries(left: number, right: number): boolean {
  while (left > 0 || right > 0) {
    if ((left % 10) + (right % 10) >= 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

function borrows(left: number, right: number): boolean {
  while (left > 0 || right > 0) {
    if (left % 10 < right % 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

function assertExhaustiveCandidateOracle(
  requestValue: GenerationRequestV1,
): void {
  const candidates = enumerateDryMathCandidates(requestValue);
  const skills = requestValue.capabilities.mathSkills;
  const tuples = new Set<string>();
  for (const candidate of candidates) {
    const tuple = `${candidate.operation}:${candidate.leftOperand}:${candidate.rightOperand}`;
    expect(tuples.has(tuple), tuple).toBe(false);
    tuples.add(tuple);
    expect(skills.operations).toContain(candidate.operation);
    expect(candidate.renderedSymbol).toBe(
      candidate.operation === "addition" ? "+" : "−",
    );
    expect(Number.isInteger(candidate.leftOperand)).toBe(true);
    expect(Number.isInteger(candidate.rightOperand)).toBe(true);
    expect(Number.isInteger(candidate.answer)).toBe(true);
    expect(candidate.leftOperand).toBeGreaterThanOrEqual(0);
    expect(candidate.rightOperand).toBeGreaterThanOrEqual(0);
    expect(candidate.leftOperand).toBeLessThanOrEqual(skills.operandMax);
    expect(candidate.rightOperand).toBeLessThanOrEqual(skills.operandMax);
    const recomputed =
      candidate.operation === "addition"
        ? candidate.leftOperand + candidate.rightOperand
        : candidate.leftOperand - candidate.rightOperand;
    expect(candidate.answer).toBe(recomputed);
    expect(candidate.answer).toBeGreaterThanOrEqual(0);
    expect(candidate.answer).toBeLessThanOrEqual(skills.resultMax);
    expect(candidate.answer).toBeLessThanOrEqual(20);
    expect(
      candidate.operation === "addition"
        ? carries(candidate.leftOperand, candidate.rightOperand)
        : borrows(candidate.leftOperand, candidate.rightOperand),
    ).toBe(false);
  }
  expect(tuples.size).toBe(candidates.length);
}

describe("xorshift32", () => {
  test("matches all six locked seed-one vectors", () => {
    const random = createSeededRandom("00000001");
    expect(
      Array.from({ length: 6 }, () =>
        random.nextUint32().toString(16).padStart(8, "0"),
      ),
    ).toEqual([
      "00042021",
      "04080601",
      "9dcca8c5",
      "1255994f",
      "8ef917d1",
      "2c6f5bd0",
    ]);
  });

  test("rejects the biased tail and accepts both legal bound edges", () => {
    const draws = [0xffff_ffff, 5];
    expect(
      unbiasedBoundedSelection(() => draws.shift() as number, 3),
    ).toBe(2);
    expect(draws).toEqual([]);
    expect(unbiasedBoundedSelection(() => 0xffff_ffff, 1)).toBe(0);
    expect(
      unbiasedBoundedSelection(() => 0xffff_ffff, 0x1_0000_0000),
    ).toBe(0xffff_ffff);
    expect(() => unbiasedBoundedSelection(() => 0, 0)).toThrow(RangeError);
    expect(() =>
      unbiasedBoundedSelection(() => -1, 2),
    ).toThrow(RangeError);
  });

  test.each([0, -1, 1.5, 0x1_0000_0000])(
    "rejects invalid numeric seed %s instead of wrapping it",
    (seed) => {
      expect(() => createSeededRandom(seed)).toThrow(RangeError);
      expect(() => formatSeedHex(seed)).toThrow(RangeError);
    },
  );

  test("shuffle uses bounded draws and can reach every three-item permutation", () => {
    const input = ["a", "b", "c"] as const;
    const permutations = new Set<string>();
    const observedBounds: number[] = [];
    for (let first = 0; first < 3; first += 1) {
      for (let second = 0; second < 2; second += 1) {
        const choices = [first, second];
        permutations.add(
          seededShuffle(input, {
            nextBounded(bound) {
              observedBounds.push(bound);
              return choices.shift() as number;
            },
          }).join(""),
        );
      }
    }
    expect(permutations.size).toBe(6);
    expect(new Set(observedBounds)).toEqual(new Set([2, 3]));
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("Dry Math candidate model", () => {
  test.each([
    [5, 21],
    [10, 57],
    [20, 168],
  ])("enumerates the exact ordered addition capacity at limit %i", (limit, capacity) => {
    expect(enumerateDryMathCandidates(request(profile(limit, limit, ["addition"])))).toHaveLength(
      capacity,
    );
  });

  test.each([
    [5, 21],
    [10, 57],
    [20, 168],
  ])("enumerates the exact ordered subtraction capacity at limit %i", (limit, capacity) => {
    expect(
      enumerateDryMathCandidates(request(profile(limit, limit, ["subtraction"]))),
    ).toHaveLength(capacity);
  });

  test.each([
    [5, 2, "addition", 6],
    [5, 2, "subtraction", 15],
    [2, 5, "addition", 9],
    [2, 5, "subtraction", 6],
  ] as const)(
    "separately respects operand %i and result %i for %s",
    (operandMax, resultMax, operation, capacity) => {
      expect(
        enumerateDryMathCandidates(
          request(profile(operandMax, resultMax, [operation])),
        ),
      ).toHaveLength(capacity);
    },
  );

  test("pins carrying, borrowing, zero, and within-20 boundary facts", () => {
    const facts = new Set(
      enumerateDryMathCandidates(request(profile(20))).map(
        ({ operation, leftOperand, rightOperand }) =>
          `${operation}:${leftOperand}:${rightOperand}`,
      ),
    );
    for (const rejected of [
      "addition:1:9",
      "addition:9:1",
      "subtraction:10:1",
      "addition:11:9",
      "addition:19:1",
      "subtraction:20:1",
    ]) {
      expect(facts.has(rejected), rejected).toBe(false);
    }
    for (const included of [
      "addition:0:20",
      "addition:20:0",
      "subtraction:20:0",
      "subtraction:20:20",
      "addition:10:10",
      "subtraction:20:10",
    ]) {
      expect(facts.has(included), included).toBe(true);
    }
  });

  test("uses the exact normal and large-print length budgets", () => {
    expect(
      (["short", "standard", "long"] as const).map((length) =>
        effectiveDryMathItemCount(request(profile(), { ...defaults, length })),
      ),
    ).toEqual([8, 12, 18]);
    expect(
      (["short", "standard", "long"] as const).map((length) =>
        effectiveDryMathItemCount(
          request(profile(), { ...defaults, length, printScale: "large" }),
        ),
      ),
    ).toEqual([8, 8, 12]);
    expect(
      (["short", "standard", "long"] as const).map((length) =>
        getDryMathItemCount(length, "standard"),
      ),
    ).toEqual([8, 12, 18]);
    expect(
      (["short", "standard", "long"] as const).map((length) =>
        getDryMathItemCount(length, "large"),
      ),
    ).toEqual([8, 8, 12]);
  });

  test("exhaustively validates every asymmetric and V1-maximum candidate", () => {
    for (const requestValue of [
      request(profile(5, 2)),
      request(profile(2, 5)),
      request(profile(1_000, 1_000)),
    ]) {
      assertExhaustiveCandidateOracle(requestValue);
    }
  });

  test("preflights the exact capacity cliff before generation", () => {
    const exactTwelve = profile(2, 2);
    expect(
      generateDryMath(request(exactTwelve), {
        worksheetId: "11111111-1111-4111-8111-111111111111",
      }).ok,
    ).toBe(true);
    expect(
      generateDryMath(
        request(exactTwelve, { ...defaults, length: "long" }),
        { worksheetId: "22222222-2222-4222-8222-222222222222" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
    const largeLong = generateDryMath(
      request(exactTwelve, {
        ...defaults,
        length: "long",
        printScale: "large",
      }),
      { worksheetId: "33333333-3333-4333-8333-333333333333" },
    );
    expect(largeLong.ok).toBe(true);
    if (largeLong.ok) {
      expect(largeLong.document.items).toHaveLength(12);
    }
  });
});

describe("Dry Math documents", () => {
  test("is deterministic by request, seed, and version but not lifecycle UUID", () => {
    const projected = request(profile(), defaults, "9dcca8c5");
    const first = generated(projected, "11111111-1111-4111-8111-111111111111");
    const second = generated(projected, "22222222-2222-4222-8222-222222222222");
    expect(first.items).toEqual(second.items);
    expect(first.worksheetId).not.toBe(second.worksheetId);
  });

  test("emits unique, bounded, nonnegative, regrouping-free facts and keyed answers", () => {
    const futureProfile = profile(1_000, 1_000);
    futureProfile.mathSkills.allowRegrouping = true;
    futureProfile.mathSkills.allowNegativeResults = true;
    const document = generated(
      request(futureProfile, { ...defaults, length: "long" }, "2c6f5bd0"),
    );
    const tupleKeys = new Set<string>();
    for (const item of document.items) {
      const fact = item as DryMathItemV1;
      const tuple = `${fact.operation}:${fact.leftOperand}:${fact.rightOperand}`;
      expect(tupleKeys.has(tuple)).toBe(false);
      tupleKeys.add(tuple);
      expect(fact.leftOperand).toBeGreaterThanOrEqual(0);
      expect(fact.rightOperand).toBeGreaterThanOrEqual(0);
      expect(fact.leftOperand).toBeLessThanOrEqual(20);
      expect(fact.rightOperand).toBeLessThanOrEqual(20);
      expect(fact.answer.value).toBeGreaterThanOrEqual(0);
      expect(fact.answer.value).toBeLessThanOrEqual(20);
      expect(fact.answer.value).toBe(recomputeDryMathAnswer(fact));
      expect(
        fact.operation === "addition"
          ? carries(fact.leftOperand, fact.rightOperand)
          : borrows(fact.leftOperand, fact.rightOperand),
      ).toBe(false);
    }
    expect(objectiveAnswerEntries(document).map(({ itemId }) => itemId)).toEqual(
      document.items.map(({ id }) => id),
    );
    expect(document.request.capabilities.mathSkills).toMatchObject({
      operandMax: 20,
      resultMax: 20,
      allowRegrouping: false,
      allowNegativeResults: false,
    });
    expect(document.request.options.includeDecorativeGraphics).toBe(false);
    expect(document.request).not.toHaveProperty("topicIds");
  });

  test("keeps disabled personalization out of the request and document", () => {
    const document = generated(
      request(profile(), {
        ...defaults,
        useDisplayName: false,
        useInterests: false,
        includeDecorativeGraphics: false,
      }),
    );
    const serialized = JSON.stringify(document);
    expect(serialized).not.toContain("Morgan Private");
    expect(serialized).not.toContain("Distinctive Secret Interest");
    expect(document.request).not.toHaveProperty("displayName");
    expect(document.request).not.toHaveProperty("topicIds");
  });

  test("rejects missing symbolic capability and detects a tampered duplicate", () => {
    const quantitiesOnly = profile();
    quantitiesOnly.mathSkills.representations = ["quantities"];
    expect(
      generateDryMath(request(quantitiesOnly), { worksheetId: "unsupported" }),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });

    const document = generated(request(profile()));
    const firstItem = document.items[0];
    if (firstItem === undefined) {
      throw new Error("The generated worksheet unexpectedly had no items.");
    }
    const tampered = {
      ...document,
      items: [firstItem, firstItem],
    };
    expect(validateWorksheetInvariants(tampered)).toMatchObject({
      ok: false,
      code: "GENERATION_INVARIANT_FAILED",
    });
  });

  test("fails closed when lifecycle metadata is not a lowercase UUID v4", () => {
    expect(
      generateDryMath(request(profile()), { worksheetId: "not-a-uuid" }),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });
});
