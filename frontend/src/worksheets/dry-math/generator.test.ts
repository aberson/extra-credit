import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { expandMathPreset } from "../../shared/config/math-presets.js";
import { PRACTICE_FOCUS_CATALOG } from "../../shared/config/practice-focus.js";
import {
  ORACLE_FACT_DIVIDEND_MAXIMUM,
  ORACLE_FACT_FACTOR_MAXIMUM,
  judgeDocument,
  oracleFactClosedForm,
  oracleFactKeys,
  oracleRegroups,
} from "../../../tests/oracles/arithmetic-oracle.js";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults.js";
import {
  profileWithLegacyChoices,
  selectionFromEarlierSettings,
  type CapabilityProfileV1,
} from "../../shared/config/earlier-settings.js";
import type { WorksheetSelectionV2 } from "../../shared/config/schema.js";
import { recomputeObjectiveAnswer } from "../../shared/worksheet/answer-oracle.js";
import {
  objectiveAnswerEntries,
  validateWorksheetInvariants,
} from "../../shared/worksheet/invariants.js";
import {
  INACTIVE_MATH_FIELDS,
  projectGenerationRequest,
} from "../../shared/worksheet/project-request.js";
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
import { getDryMathCapabilitySupport, getDryMathItemCount } from "./definition.js";

/** The layout and personalization choices a selection carries beside its practice focus. */
type Layout = Pick<
  WorksheetSelectionV2,
  | "useDisplayName"
  | "useInterests"
  | "includeDecorativeGraphics"
  | "includeAnswerKey"
  | "length"
  | "paperSize"
  | "printScale"
>;

const defaults: Layout = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

function profile(
  operandMax = 10,
  resultMax = operandMax,
  operations: CapabilityProfileV1["mathSkills"]["operations"] = [
    "addition",
    "subtraction",
  ],
): CapabilityProfileV1 {
  return {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Morgan Private",
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

/**
 * The Dry Math selection a child's earlier settings describe: those settings
 * mapped over the built-in defaults with this layout, then projected.
 */
function request(
  sourceProfile = profile(),
  layout: Layout = defaults,
  seed = "00000001",
): GenerationRequestV1 {
  const stored = profileWithLegacyChoices(sourceProfile);
  if (stored.legacyChoices === undefined) {
    throw new Error("The fixture profile unexpectedly carried no earlier settings.");
  }
  const selection: WorksheetSelectionV2 = {
    ...selectionFromEarlierSettings(stored.legacyChoices, {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      ...layout,
    }).selection,
    worksheetType: "dry-math",
  };
  const projected = projectGenerationRequest({
    profile: stored,
    selection,
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
    expect(candidate.answer).toBeLessThanOrEqual(100);
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
  test.each([
    ["addition-within-20", 20, ["addition"]],
    ["subtraction-within-20", 20, ["subtraction"]],
    ["arithmetic-within-50", 50, ["addition", "subtraction"]],
    ["arithmetic-within-100", 100, ["addition", "subtraction"]],
  ] as const)("generates the actual %s range with matching answers", (preset, maximum, operations) => {
    const expanded = expandMathPreset(preset);
    const source = { ...profile(), ...expanded };
    const seen = new Set<number>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const document = generated(request(source, { ...defaults, length: "long" }, formatSeedHex(seed)));
      expect(validateWorksheetInvariants(document)).toBeUndefined();
      for (const item of document.items) {
        const fact = item as DryMathItemV1;
        expect(operations).toContain(fact.operation);
        for (const value of [fact.leftOperand, fact.rightOperand, fact.answer.value]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(maximum);
          seen.add(value);
        }
        expect(fact.answer).toEqual(recomputeObjectiveAnswer(fact));
      }
    }
    expect(Math.max(...seen)).toBeGreaterThan(maximum === 20 ? 10 : 20);
  });

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
      expect(fact.leftOperand).toBeLessThanOrEqual(100);
      expect(fact.rightOperand).toBeLessThanOrEqual(100);
      expect(fact.answer.value).toBeGreaterThanOrEqual(0);
      expect(fact.answer.value).toBeLessThanOrEqual(100);
      expect(fact.answer).toEqual(recomputeObjectiveAnswer(fact));
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
      operandMax: 100,
      resultMax: 100,
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

  test("a document carrying a decorative topic fails the shared invariants", () => {
    const document = generated(request(profile()));
    // Mirror: the projected document itself passes.
    expect(validateWorksheetInvariants(document)).toBeUndefined();
    const themed: GenerationRequestV1 = {
      ...document.request,
      options: { ...document.request.options, decorativeTopicId: "neutral" },
    };
    expect(validateWorksheetInvariants({ ...document, request: themed })).toEqual({
      ok: false,
      code: "GENERATION_INVARIANT_FAILED",
      message:
        "Worksheet decoration data named no declared topic or reached a family that prints no decoration.",
    });
    expect(
      generateDryMath(themed, { worksheetId: "11111111-1111-4111-8111-111111111111" }),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });

  test("rejects missing symbolic capability and detects a tampered duplicate", () => {
    const supported = request(profile());
    const quantitiesOnly: GenerationRequestV1 = {
      ...supported,
      capabilities: {
        ...supported.capabilities,
        mathSkills: {
          ...supported.capabilities.mathSkills,
          representations: ["quantities"],
        },
      },
    };
    expect(
      generateDryMath(quantitiesOnly, { worksheetId: "unsupported" }),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
    expect(
      generateDryMath(supported, {
        worksheetId: "44444444-4444-4444-8444-444444444444",
      }).ok,
    ).toBe(true);

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

  test("the leaf gate still refuses raw skills without equations or an operation", () => {
    const skills = request(profile()).capabilities.mathSkills;
    expect(getDryMathCapabilitySupport(skills)).toEqual({ available: true });
    expect(
      getDryMathCapabilitySupport({ ...skills, representations: ["quantities"] }),
    ).toEqual({
      available: false,
      reason:
        "Dry Math needs equations and an enabled operation. Choose a practice focus with addition or subtraction. Count, Compare & Make offers quantity practice.",
    });
    expect(getDryMathCapabilitySupport({ ...skills, operations: [] })).toEqual({
      available: false,
      reason:
        "Dry Math needs at least one symbolic operation. Choose a practice focus with addition or subtraction. Count, Compare & Make offers quantity practice.",
    });
  });

  test("a child whose earlier settings lack equations still gets the default Dry Math focus", () => {
    const quantitiesOnly = profile(5, 5, ["addition"]);
    quantitiesOnly.mathSkills.representations = ["quantities"];
    const projected = request(quantitiesOnly);
    const defaultFocus = DEFAULT_WORKSHEET_DEFAULTS_V2.dryMath;
    expect(projected.capabilities.mathSkills).toMatchObject({
      representations: ["equations"],
      operations: [...defaultFocus.operations],
      operandMax: defaultFocus.operandMax,
      resultMax: defaultFocus.resultMax,
    });
    // Mirror: the same child with equations carries its own narrower focus.
    const withEquations = request(profile(5, 5, ["addition"]));
    expect(withEquations.capabilities.mathSkills).toMatchObject({
      operations: ["addition"],
      operandMax: 5,
      resultMax: 5,
    });
    expect(generateDryMath(projected, {
      worksheetId: "55555555-5555-4555-8555-555555555555",
    }).ok).toBe(true);
    expect("difficulty" in projected.options).toBe(false);
  });

  test("fails closed when lifecycle metadata is not a lowercase UUID v4", () => {
    expect(
      generateDryMath(request(profile()), { worksheetId: "not-a-uuid" }),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });
});

describe("Every problem carries or borrows", () => {
  /** The projected request for one catalog focus with the given regrouping choice. */
  function regroupingRequest(
    focusId: string,
    dryMathRegrouping: WorksheetSelectionV2["dryMathRegrouping"],
    layout: Pick<WorksheetSelectionV2, "length" | "printScale">,
    seed: string,
  ): GenerationRequestV1 {
    const option = PRACTICE_FOCUS_CATALOG["dry-math"].find(({ id }) => id === focusId);
    if (option === undefined) {
      throw new Error(`No Dry Math catalog focus ${focusId}.`);
    }
    const projected = projectGenerationRequest({
      selection: {
        ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
        ...layout,
        worksheetType: "dry-math",
        dryMath: option.focus,
        dryMathRegrouping,
      },
      generatorVersion: 1,
      seed,
    });
    if (!projected.ok) {
      throw new Error(projected.message);
    }
    return projected.request;
  }

  function rows(document: ReturnType<typeof generated>): readonly string[] {
    return document.items.map(
      (item) =>
        `${item.leftOperand} ${item.renderedSymbol} ${item.rightOperand} = ${item.answer.value}`,
    );
  }

  test.each([
    [
      "addition-and-subtraction-within-10",
      "short",
      "standard",
      "00000001",
      ["10 − 6 = 4", "10 − 8 = 2", "10 − 4 = 6", "2 + 8 = 10", "8 + 2 = 10", "9 + 1 = 10", "7 + 3 = 10", "10 − 5 = 5"],
    ],
    [
      "addition-and-subtraction-within-100",
      "short",
      "standard",
      "9dcca8c5",
      ["59 + 11 = 70", "90 − 73 = 17", "18 + 75 = 93", "62 − 39 = 23", "68 + 22 = 90", "14 + 26 = 40", "28 + 5 = 33", "51 − 44 = 7"],
    ],
    [
      "addition-within-20",
      "standard",
      "large",
      "2c6f5bd0",
      ["16 + 4 = 20", "7 + 6 = 13", "18 + 2 = 20", "6 + 14 = 20", "1 + 9 = 10", "12 + 8 = 20", "3 + 9 = 12", "7 + 5 = 12"],
    ],
  ] as const)("known vector: %s %s/%s seed %s", (focusId, length, printScale, seed, expected) => {
    const document = generated(regroupingRequest(focusId, "required", { length, printScale }, seed));
    expect(rows(document)).toEqual(expected);
    expect(judgeDocument(document)).toEqual([]);
  });

  test("only the required choice projects a practice member, and without keeps the legacy request", () => {
    const layout = { length: "long", printScale: "standard" } as const;
    expect(regroupingRequest("addition-and-subtraction-within-20", "required", layout, "00000001").practice)
      .toEqual({ kind: "dry-math-add-subtract", regrouping: "required" });
    const without = regroupingRequest("addition-and-subtraction-within-20", "without", layout, "00000001");
    expect(without).not.toHaveProperty("practice");
    expect(without.capabilities.mathSkills.allowRegrouping).toBe(false);
  });

  test("property: every required page is judged clean, and the same seed without regrouping holds none", () => {
    const fillingFoci = PRACTICE_FOCUS_CATALOG["dry-math"]
      .map(({ id }) => id)
      .filter((id) => id !== "addition-within-5");
    fc.assert(
      fc.property(
        fc.constantFrom(...fillingFoci),
        fc.constantFrom("short", "standard", "long"),
        fc.constantFrom("standard", "large"),
        fc.integer({ min: 1, max: 0xffff_ffff }),
        (focusId, length, printScale, seedNumber) => {
          const seed = formatSeedHex(seedNumber);
          const required = generated(regroupingRequest(focusId, "required", { length, printScale }, seed));
          expect(judgeDocument(required)).toEqual([]);
          expect(
            required.items.every((item) =>
              oracleRegroups(item.operation, item.leftOperand, item.rightOperand),
            ),
          ).toBe(true);
          const without = generated(regroupingRequest(focusId, "without", { length, printScale }, seed));
          expect(judgeDocument(without)).toEqual([]);
          expect(
            without.items.some((item) =>
              oracleRegroups(item.operation, item.leftOperand, item.rightOperand),
            ),
          ).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("a required page with one problem that does not regroup fails, and the oracle names it", () => {
    const document = generated(
      regroupingRequest("addition-and-subtraction-within-100", "required", { length: "long", printScale: "standard" }, "00000001"),
    );
    expect(validateWorksheetInvariants(document)).toBeUndefined();
    const [first, ...rest] = document.items;
    if (first === undefined) {
      throw new Error("The required page had no items.");
    }
    const plain: DryMathItemV1 = {
      ...first,
      operation: "addition",
      leftOperand: 1,
      rightOperand: 2,
      renderedSymbol: "+",
      answer: { kind: "number", value: 3 },
    };
    const tampered = { ...document, items: [plain, ...rest] };
    expect(validateWorksheetInvariants(tampered)).toMatchObject({
      ok: false,
      code: "GENERATION_INVARIANT_FAILED",
    });
    expect(judgeDocument(tampered)).toEqual([{ itemId: first.id, code: "REGROUPING_MISMATCH" }]);
  });

  test("allowRegrouping stays false: a request turning it on fails with or without the practice member", () => {
    for (const regrouping of ["without", "required"] as const) {
      const supported = regroupingRequest(
        "addition-and-subtraction-within-100",
        regrouping,
        { length: "long", printScale: "standard" },
        "00000001",
      );
      const allowed: GenerationRequestV1 = {
        ...supported,
        capabilities: {
          ...supported.capabilities,
          mathSkills: {
            ...supported.capabilities.mathSkills,
            allowRegrouping: true as false,
          },
        },
      };
      expect(generateDryMath(supported, { worksheetId: "11111111-1111-4111-8111-111111111111" }).ok).toBe(true);
      expect(
        generateDryMath(allowed, { worksheetId: "11111111-1111-4111-8111-111111111111" }),
      ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
    }
  });

  test("a practice member Dry Math does not accept is refused", () => {
    const supported = regroupingRequest(
      "addition-and-subtraction-within-100",
      "without",
      { length: "long", printScale: "standard" },
      "00000001",
    );
    const unknown = {
      ...supported,
      practice: { kind: "dry-math-add-subtract", regrouping: "mixed" },
    } as unknown as GenerationRequestV1;
    expect(
      generateDryMath(unknown, { worksheetId: "11111111-1111-4111-8111-111111111111" }),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });
});

describe("Multiplication and division facts by fact family", () => {
  type FactOperations = WorksheetSelectionV2["dryMathFacts"]["operations"];

  const OPERATION_CHOICES: readonly FactOperations[] = [
    ["multiplication"],
    ["division"],
    ["multiplication", "division"],
  ];
  const EVERY_FAMILY = Array.from(
    { length: ORACLE_FACT_FACTOR_MAXIMUM + 1 },
    (_, family) => family,
  );
  const LONG = { length: "long", printScale: "standard" } as const;

  /** The projected request for one facts choice. */
  function factsRequest(
    operations: readonly FactOperations[number][],
    factFamilies: readonly number[],
    layout: Pick<WorksheetSelectionV2, "length" | "printScale">,
    seed: string,
  ): GenerationRequestV1 {
    const projected = projectGenerationRequest({
      selection: {
        ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
        ...layout,
        worksheetType: "dry-math",
        dryMathStrand: "multiply-divide",
        dryMathFacts: { operations: [...operations], factFamilies: [...factFamilies] },
      },
      generatorVersion: 1,
      seed,
    });
    if (!projected.ok) {
      throw new Error(projected.message);
    }
    return projected.request;
  }

  function keysOf(
    items: readonly { readonly operation: string; readonly leftOperand: number; readonly rightOperand: number }[],
  ): readonly string[] {
    return items.map(
      ({ operation, leftOperand, rightOperand }) => `${operation}:${leftOperand}:${rightOperand}`,
    );
  }

  function rows(document: ReturnType<typeof generated>): readonly string[] {
    return document.items.map(
      (item) =>
        `${item.leftOperand} ${item.renderedSymbol} ${item.rightOperand} = ${item.answer.value}`,
    );
  }

  test.each(OPERATION_CHOICES.map((operations) => [operations.join(" and "), operations] as const))(
    "%s: on singletons, pairs and every family the fact keys are the oracle's brute force and closed form",
    (_label, operations) => {
      const familySets = [
        ...EVERY_FAMILY.map((family) => [family]),
        [0, 1],
        [3, 7, 12],
        [2, 5, 10],
        [11, 12],
        EVERY_FAMILY,
      ];
      for (const families of familySets) {
        const keys = keysOf(
          enumerateDryMathCandidates(factsRequest(operations, families, LONG, "00000001")),
        );
        const where = `${operations.join("+")} {${families.join(",")}}`;
        expect(new Set(keys).size, where).toBe(keys.length);
        expect(new Set(keys), where).toEqual(oracleFactKeys(operations, families));
        expect(keys.length, where).toBe(oracleFactClosedForm(operations, families));
      }
    },
  );

  test("both orders count, division is exact with a nonzero divisor, and the largest dividend is the largest product", () => {
    const family3 = keysOf(
      enumerateDryMathCandidates(factsRequest(["multiplication"], [3], LONG, "00000001")),
    );
    expect(family3).toContain("multiplication:3:4");
    expect(family3).toContain("multiplication:4:3");
    const division = enumerateDryMathCandidates(
      factsRequest(["division"], EVERY_FAMILY, LONG, "00000001"),
    );
    expect(division.every(({ rightOperand }) => rightOperand !== 0)).toBe(true);
    expect(
      division.every(({ leftOperand, rightOperand }) => leftOperand % rightOperand === 0),
    ).toBe(true);
    expect(Math.max(...division.map(({ leftOperand }) => leftOperand))).toBe(
      ORACLE_FACT_DIVIDEND_MAXIMUM,
    );
    // Family 0 alone divides only zero: 0 ÷ 1 through 0 ÷ 12.
    expect(
      keysOf(enumerateDryMathCandidates(factsRequest(["division"], [0], LONG, "00000001"))),
    ).toEqual(EVERY_FAMILY.slice(1).map((divisor) => `division:0:${divisor}`));
  });

  test.each([
    [
      ["multiplication"],
      [2, 5, 10],
      "short",
      "standard",
      "00000001",
      ["10 × 9 = 90", "5 × 5 = 25", "10 × 11 = 110", "5 × 1 = 5", "0 × 2 = 0", "10 × 5 = 50", "12 × 2 = 24", "11 × 10 = 110"],
    ],
    [
      ["division"],
      [3, 7, 12],
      "standard",
      "large",
      "0000beef",
      ["63 ÷ 9 = 7", "96 ÷ 8 = 12", "70 ÷ 10 = 7", "63 ÷ 7 = 9", "132 ÷ 11 = 12", "14 ÷ 2 = 7", "24 ÷ 2 = 12", "0 ÷ 7 = 0"],
    ],
    [
      ["multiplication", "division"],
      EVERY_FAMILY,
      "short",
      "standard",
      "2c6f5bd0",
      ["36 ÷ 6 = 6", "9 × 8 = 72", "11 × 12 = 132", "0 ÷ 9 = 0", "4 ÷ 4 = 1", "9 × 3 = 27", "9 × 5 = 45", "12 × 8 = 96"],
    ],
  ] as const)(
    "known vector: %j %j %s/%s seed %s",
    (operations, families, length, printScale, seed, expected) => {
      const document = generated(factsRequest(operations, families, { length, printScale }, seed));
      expect(rows(document)).toEqual(expected);
      expect(judgeDocument(document)).toEqual([]);
    },
  );

  test("property: every facts page is judged clean, and other families with the same seed change the items", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OPERATION_CHOICES),
        fc.subarray(EVERY_FAMILY, { minLength: 1 }),
        fc.constantFrom("short", "standard", "long"),
        fc.constantFrom("standard", "large"),
        fc.integer({ min: 1, max: 0xffff_ffff }),
        (operations, families, length, printScale, seedNumber) => {
          const seed = formatSeedHex(seedNumber);
          const result = generateDryMath(
            factsRequest(operations, families, { length, printScale }, seed),
            { worksheetId: "11111111-1111-4111-8111-111111111111" },
          );
          const needed = getDryMathItemCount(length, printScale);
          if (!result.ok) {
            // Only a family set the oracle counts below this length is refused.
            expect(oracleFactKeys(operations, families).size).toBeLessThan(needed);
            return;
          }
          expect(result.document.items).toHaveLength(needed);
          expect(judgeDocument(result.document)).toEqual([]);
          const others = EVERY_FAMILY.filter((family) => !families.includes(family));
          const mirror = generateDryMath(
            factsRequest(operations, others.length === 0 ? [0] : others, { length, printScale }, seed),
            { worksheetId: "11111111-1111-4111-8111-111111111111" },
          );
          if (mirror.ok) {
            expect(keysOf(mirror.document.items)).not.toEqual(keysOf(result.document.items));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  test("the capability gate reads the facts kind: no addition or subtraction operation is needed", () => {
    const request = factsRequest(["division"], [7], LONG, "00000001");
    expect(request.capabilities.mathSkills.operations).toEqual(INACTIVE_MATH_FIELDS.operations);
    expect(
      getDryMathCapabilitySupport(request.capabilities.mathSkills, request.practice),
    ).toEqual({ available: true });
  });

  describe("the facts branch of the invariant checker (D60)", () => {
    const everyFamily = generated(
      factsRequest(["multiplication", "division"], EVERY_FAMILY, LONG, "00000001"),
    );

    function fact(
      id: string,
      operation: DryMathItemV1["operation"],
      leftOperand: number,
      rightOperand: number,
      value: number,
      renderedSymbol: DryMathItemV1["renderedSymbol"] = operation === "multiplication" ? "×" : "÷",
    ): DryMathItemV1 {
      return {
        id,
        itemType: "dry-math",
        answerability: "objective",
        operation,
        leftOperand,
        rightOperand,
        renderedSymbol,
        answer: { kind: "number", value },
      };
    }

    function withFirst(
      document: typeof everyFamily,
      replace: (first: DryMathItemV1) => DryMathItemV1,
    ): typeof everyFamily {
      const [first, ...rest] = document.items;
      if (first === undefined) {
        throw new Error("The facts page had no items.");
      }
      return { ...document, items: [replace(first), ...rest] };
    }

    test("a generated facts page passes", () => {
      expect(validateWorksheetInvariants(everyFamily)).toBeUndefined();
      expect(judgeDocument(everyFamily)).toEqual([]);
    });

    test.each([
      ["13 ÷ 4", (first: DryMathItemV1) => fact(first.id, "division", 13, 4, 3)],
      ["0 ÷ 0", (first: DryMathItemV1) => fact(first.id, "division", 0, 0, 0)],
      ["a factor 13", (first: DryMathItemV1) => fact(first.id, "multiplication", 13, 2, 26)],
      ["a dividend 156", (first: DryMathItemV1) => fact(first.id, "division", 156, 12, 13)],
      [
        "a wrong symbol",
        (first: DryMathItemV1): DryMathItemV1 => ({
          ...first,
          renderedSymbol: first.renderedSymbol === "×" ? "÷" : "×",
        }),
      ],
      [
        "a wrong answer",
        (first: DryMathItemV1): DryMathItemV1 => ({
          ...first,
          answer: { kind: "number", value: first.answer.value + 1 },
        }),
      ],
    ] as const)("%s fails", (_label, replace) => {
      expect(validateWorksheetInvariants(withFirst(everyFamily, replace))).toMatchObject({
        ok: false,
        code: "GENERATION_INVARIANT_FAILED",
      });
    });

    test("a duplicate fails", () => {
      const [first, second, ...rest] = everyFamily.items;
      if (first === undefined || second === undefined) {
        throw new Error("The facts page had too few items.");
      }
      expect(
        validateWorksheetInvariants({
          ...everyFamily,
          items: [first, { ...first, id: second.id }, ...rest],
        }),
      ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
    });

    test("a fact outside the requested families fails", () => {
      const twoFiveTen = generated(
        factsRequest(["multiplication"], [2, 5, 10], LONG, "00000001"),
      );
      const outside = withFirst(twoFiveTen, (first) =>
        fact(first.id, "multiplication", 3, 4, 12),
      );
      expect(validateWorksheetInvariants(outside)).toMatchObject({
        ok: false,
        code: "GENERATION_INVARIANT_FAILED",
      });
      expect(judgeDocument(outside).map(({ code }) => code)).toEqual(["OUT_OF_SET"]);
    });

    test("12 × 12 = 144 passes the facts branch, and the same page without the facts kind fails the addition and subtraction branch", () => {
      const request = factsRequest(["multiplication", "division"], [12], LONG, "00000001");
      const page: typeof everyFamily = {
        ...everyFamily,
        request,
        items: [
          fact("item-001", "multiplication", 12, 12, 144),
          fact("item-002", "division", 144, 12, 12),
        ],
      };
      expect(validateWorksheetInvariants(page)).toBeUndefined();
      const withoutPractice: GenerationRequestV1 = { ...request };
      delete (withoutPractice as { practice?: unknown }).practice;
      expect(withoutPractice).not.toHaveProperty("practice");
      expect(validateWorksheetInvariants({ ...page, request: withoutPractice })).toMatchObject({
        ok: false,
        code: "GENERATION_INVARIANT_FAILED",
      });
    });

    test("a facts member that is not well formed is refused", () => {
      for (const practice of [
        { kind: "dry-math-facts", operations: [], factFamilies: [2] },
        { kind: "dry-math-facts", operations: ["division", "multiplication"], factFamilies: [2] },
        { kind: "dry-math-facts", operations: ["multiplication"], factFamilies: [] },
        { kind: "dry-math-facts", operations: ["multiplication"], factFamilies: [5, 2] },
        { kind: "dry-math-facts", operations: ["multiplication"], factFamilies: [13] },
      ]) {
        const request = { ...everyFamily.request, practice } as unknown as GenerationRequestV1;
        expect(
          validateWorksheetInvariants({ ...everyFamily, request }),
          JSON.stringify(practice),
        ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
      }
    });
  });
});
