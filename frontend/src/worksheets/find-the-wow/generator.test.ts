import { describe, expect, test, vi } from "vitest";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema.js";
import { objectiveAnswerEntries } from "../../shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../shared/worksheet/project-request.js";
import { formatSeedHex } from "../../shared/worksheet/seeded-random.js";
import type {
  EquationWowGroupItemV1,
  GenerationRequestV1,
  QuantityWowGroupItemV1,
  WorksheetDocumentV1,
  WowGroupItemV1,
} from "../../shared/worksheet/types.js";
import {
  getFindTheWowCapabilitySupport,
  getFindTheWowGroupCount,
} from "./definition.js";
import {
  effectiveFindTheWowGroupCount,
  enumerateEquationWowCandidates,
  enumerateEquationWowStems,
  enumerateQuantityWowCandidates,
  enumerateQuantityWowStems,
  generateFindTheWow,
  type FindTheWowDocumentV1,
} from "./generator.js";

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

function equationProfile(
  operandMax = 10,
  resultMax = operandMax,
  operations: ChildProfileV1["mathSkills"]["operations"] = [
    "addition",
    "subtraction",
  ],
): ChildProfileV1 {
  return {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Private Morgan",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations,
      operandMax,
      resultMax,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["Distinctive Private Nature"],
  };
}

function quantityProfile(limit = 10): ChildProfileV1 {
  return {
    id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
    displayName: "Private Riley",
    ageYears: 4,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: limit,
      numeralMax: limit,
      compareMax: limit,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "label",
    interests: ["Distinctive Private Space"],
  };
}

function request(
  profile: ChildProfileV1,
  preferences: GenerationDefaultsV1 = defaults,
  seed = "00000001",
): GenerationRequestV1 {
  const projection = projectGenerationRequest({
    profile,
    preferences,
    worksheetType: "find-the-wow",
    generatorVersion: 1,
    seed,
  });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  return projection.request;
}

function generated(
  requestValue: GenerationRequestV1,
  worksheetId = "11111111-1111-4111-8111-111111111111",
): FindTheWowDocumentV1 {
  const result = generateFindTheWow(requestValue, { worksheetId });
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

/**
 * The distinct exercise each printed group asks. Two groups sharing one of
 * these is the duplicate a parent would see, whatever the distractors are.
 */
function pageStems(document: WorksheetDocumentV1<WowGroupItemV1>): readonly string[] {
  return document.items.map((item) => {
    if (item.mode === "quantity") {
      return `quantity:${item.choices[0].numeral}`;
    }
    const first = item.choices[0];
    return `equation:${first.operation}:${first.leftOperand}:${first.rightOperand}`;
  });
}

function assertBalanced(items: readonly WowGroupItemV1[]): void {
  const counts = [0, 0, 0];
  for (const item of items) {
    counts[item.correctPosition] = (counts[item.correctPosition] ?? 0) + 1;
  }
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
}

function assertQuantityDocument(
  document: WorksheetDocumentV1<WowGroupItemV1>,
): void {
  const limit = Math.min(
    document.request.capabilities.mathSkills.countingMax,
    document.request.capabilities.mathSkills.numeralMax,
    20,
  );
  const groupKeys = new Set<string>();
  for (const [index, sourceItem] of document.items.entries()) {
    expect(sourceItem.id).toBe(
      `item-${String(index + 1).padStart(3, "0")}`,
    );
    expect(sourceItem.mode).toBe("quantity");
    const item = sourceItem as QuantityWowGroupItemV1;
    expect(item.choices).toHaveLength(3);
    expect(new Set(item.choices.map((choice) => JSON.stringify(choice))).size).toBe(
      3,
    );
    const numerals = new Set(item.choices.map((choice) => choice.numeral));
    const quantities = item.choices.map((choice) => choice.quantity);
    expect(numerals.size).toBe(1);
    expect(new Set(quantities).size).toBe(3);
    for (const choice of item.choices) {
      expect(choice.kind).toBe("quantity");
      expect(Number.isInteger(choice.numeral)).toBe(true);
      expect(Number.isInteger(choice.quantity)).toBe(true);
      expect(choice.numeral).toBeGreaterThanOrEqual(1);
      expect(choice.quantity).toBeGreaterThanOrEqual(1);
      expect(choice.numeral).toBeLessThanOrEqual(limit);
      expect(choice.quantity).toBeLessThanOrEqual(limit);
    }
    const truePositions = item.choices
      .map((choice, position) =>
        choice.quantity === choice.numeral ? position : -1,
      )
      .filter((position) => position !== -1);
    expect(truePositions).toEqual([item.correctPosition]);
    expect(item.answer).toEqual({
      kind: "choice",
      value: item.correctPosition,
    });
    for (const [position, choice] of item.choices.entries()) {
      if (position !== item.correctPosition) {
        expect(choice.quantity - choice.numeral).not.toBe(0);
      }
    }
    const key = `${item.choices[0].numeral}`;
    expect(groupKeys.has(key), key).toBe(false);
    groupKeys.add(key);
  }
  assertBalanced(document.items);
}

function assertEquationDocument(
  document: WorksheetDocumentV1<WowGroupItemV1>,
): void {
  const skills = document.request.capabilities.mathSkills;
  const operandLimit = Math.min(skills.operandMax, 20);
  const resultLimit = Math.min(skills.resultMax, 20);
  const groupKeys = new Set<string>();
  for (const [index, sourceItem] of document.items.entries()) {
    expect(sourceItem.id).toBe(
      `item-${String(index + 1).padStart(3, "0")}`,
    );
    expect(sourceItem.mode).toBe("equation");
    const item = sourceItem as EquationWowGroupItemV1;
    expect(item.choices).toHaveLength(3);
    expect(new Set(item.choices.map((choice) => JSON.stringify(choice))).size).toBe(
      3,
    );
    const first = item.choices[0];
    const truePositions: number[] = [];
    for (const [position, choice] of item.choices.entries()) {
      expect(choice.kind).toBe("equation");
      expect(choice.operation).toBe(first.operation);
      expect(choice.leftOperand).toBe(first.leftOperand);
      expect(choice.rightOperand).toBe(first.rightOperand);
      expect(choice.renderedSymbol).toBe(first.renderedSymbol);
      expect(skills.operations).toContain(choice.operation);
      expect(choice.renderedSymbol).toBe(
        choice.operation === "addition" ? "+" : "−",
      );
      expect(choice.leftOperand).toBeGreaterThanOrEqual(0);
      expect(choice.rightOperand).toBeGreaterThanOrEqual(0);
      expect(choice.leftOperand).toBeLessThanOrEqual(operandLimit);
      expect(choice.rightOperand).toBeLessThanOrEqual(operandLimit);
      expect(choice.displayedResult).toBeGreaterThanOrEqual(0);
      expect(choice.displayedResult).toBeLessThanOrEqual(resultLimit);
      const recomputed =
        choice.operation === "addition"
          ? choice.leftOperand + choice.rightOperand
          : choice.leftOperand - choice.rightOperand;
      expect(recomputed).toBeGreaterThanOrEqual(0);
      expect(recomputed).toBeLessThanOrEqual(resultLimit);
      expect(
        choice.operation === "addition"
          ? carries(choice.leftOperand, choice.rightOperand)
          : borrows(choice.leftOperand, choice.rightOperand),
      ).toBe(false);
      if (choice.displayedResult === recomputed) {
        truePositions.push(position);
      } else {
        expect(choice.displayedResult - recomputed).not.toBe(0);
      }
    }
    expect(truePositions).toEqual([item.correctPosition]);
    expect(item.answer).toEqual({
      kind: "choice",
      value: item.correctPosition,
    });
    const key = `${first.operation}:${first.leftOperand}:${first.rightOperand}`;
    expect(groupKeys.has(key), key).toBe(false);
    groupKeys.add(key);
  }
  assertBalanced(document.items);
}

describe("Two Whats and a Wow definition", () => {
  test("uses the exact normal and large-print group budgets", () => {
    expect(
      (["short", "standard", "long"] as const).map((length) =>
        getFindTheWowGroupCount(length, "standard"),
      ),
    ).toEqual([4, 6, 8]);
    expect(
      (["short", "standard", "long"] as const).map((length) =>
        getFindTheWowGroupCount(length, "large"),
      ),
    ).toEqual([4, 4, 6]);
  });

  test("locks equation-first, confidence scaffolding, fallback, and unavailable gates", () => {
    const both = equationProfile().mathSkills;
    expect(getFindTheWowCapabilitySupport(both, "practice")).toEqual({
      available: true,
      mode: "equation",
    });
    expect(getFindTheWowCapabilitySupport(both, "stretch")).toEqual({
      available: true,
      mode: "equation",
    });
    expect(getFindTheWowCapabilitySupport(both, "confidence")).toEqual({
      available: true,
      mode: "quantity",
    });

    const noEquality = equationProfile().mathSkills;
    noEquality.understandsEquality = false;
    expect(getFindTheWowCapabilitySupport(noEquality)).toEqual({
      available: true,
      mode: "quantity",
    });
    noEquality.representations = ["equations"];
    expect(getFindTheWowCapabilitySupport(noEquality)).toMatchObject({
      available: false,
    });

    const equationOnly = equationProfile().mathSkills;
    equationOnly.representations = ["equations"];
    expect(getFindTheWowCapabilitySupport(equationOnly, "confidence")).toEqual({
      available: true,
      mode: "equation",
    });
    const quantities = quantityProfile().mathSkills;
    expect(getFindTheWowCapabilitySupport(quantities)).toEqual({
      available: true,
      mode: "quantity",
    });
  });
});

describe("Two Whats and a Wow finite candidate models", () => {
  test.each([
    [2, 0],
    [3, 3],
    [4, 12],
    [5, 30],
    [10, 360],
    [20, 3420],
  ])("enumerates exact quantity capacity at L=%i", (limit, capacity) => {
    const candidates = enumerateQuantityWowCandidates(
      request(quantityProfile(limit)),
    );
    expect(candidates).toHaveLength(capacity);
    expect(
      new Set(
        candidates.map(
          ({ target, distractors }) => `${target}:${distractors.join(",")}`,
        ),
      ).size,
    ).toBe(capacity);
    for (const candidate of candidates) {
      expect(candidate.distractors[0]).toBeLessThan(candidate.distractors[1]);
      expect(candidate.distractors).not.toContain(candidate.target);
    }
  });

  test.each([
    [1, 2, ["addition"], 4],
    [1, 2, ["subtraction"], 3],
    [1, 2, ["addition", "subtraction"], 7],
    [2, 2, ["addition", "subtraction"], 12],
    [5, 2, ["addition", "subtraction"], 21],
    [2, 5, ["addition", "subtraction"], 150],
    [5, 5, ["addition", "subtraction"], 420],
    [10, 10, ["addition", "subtraction"], 5130],
    [20, 20, ["addition", "subtraction"], 63840],
  ] as const)(
    "enumerates exact equation capacity for O=%i R=%i %j",
    (operandMax, resultMax, operations, capacity) => {
      const candidates = enumerateEquationWowCandidates(
        request(equationProfile(operandMax, resultMax, [...operations])),
      );
      expect(candidates).toHaveLength(capacity);
      for (const candidate of candidates) {
        expect(candidate.falseResults[0]).toBeLessThan(
          candidate.falseResults[1],
        );
        expect(candidate.falseResults).not.toContain(candidate.trueResult);
      }
    },
  );

  test("includes legal boundaries while excluding carry, borrow, and negative facts", () => {
    const facts = new Set(
      enumerateEquationWowCandidates(request(equationProfile(20, 20))).map(
        ({ operation, leftOperand, rightOperand }) =>
          `${operation}:${leftOperand}:${rightOperand}`,
      ),
    );
    for (const rejected of [
      "addition:1:9",
      "addition:19:1",
      "subtraction:1:2",
      "subtraction:10:1",
      "subtraction:20:1",
    ]) {
      expect(facts.has(rejected), rejected).toBe(false);
    }
    for (const included of [
      "addition:0:20",
      "addition:20:0",
      "addition:10:10",
      "subtraction:20:20",
      "subtraction:20:10",
      "subtraction:0:0",
    ]) {
      expect(facts.has(included), included).toBe(true);
    }
  });

  test("counts distinct exercises rather than distractor permutations", () => {
    expect(enumerateQuantityWowStems(request(quantityProfile(2)))).toHaveLength(0);
    expect(enumerateQuantityWowStems(request(quantityProfile(4)))).toHaveLength(4);
    expect(enumerateQuantityWowStems(request(quantityProfile(10)))).toHaveLength(
      10,
    );

    const equationRequest = request(equationProfile());
    const equationStems = enumerateEquationWowStems(equationRequest);
    expect(equationStems).toHaveLength(114);
    expect(new Set(equationStems.map(({ key }) => key)).size).toBe(114);
    expect(
      equationStems.every(({ candidates }) => candidates.length === 45),
    ).toBe(true);
    expect(
      equationStems.reduce((total, { candidates }) => total + candidates.length, 0),
    ).toBe(enumerateEquationWowCandidates(equationRequest).length);
  });

  test("fails at exact capacity cliffs without switching mode or partially filling", () => {
    const quantityShortage = generateFindTheWow(request(quantityProfile(3)), {
      worksheetId: "11111111-1111-4111-8111-111111111111",
    });
    expect(quantityShortage).toMatchObject({
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
    });
    expect(quantityShortage).not.toHaveProperty("document");
    expect(
      generated(
        request(quantityProfile(4), { ...defaults, length: "short" }),
      ).items,
    ).toHaveLength(4);
    expect(
      generateFindTheWow(
        request(quantityProfile(4), { ...defaults, length: "long" }),
        { worksheetId: "55555555-5555-4555-8555-555555555555" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
    expect(
      generated(
        request(quantityProfile(8), { ...defaults, length: "long" }),
      ).items,
    ).toHaveLength(8);
    expect(
      generateFindTheWow(
        request(quantityProfile(7), { ...defaults, length: "long" }),
        { worksheetId: "66666666-6666-4666-8666-666666666666" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });

    expect(
      generated(
        request(
          equationProfile(1, 2, ["addition"]),
          { ...defaults, length: "short" },
        ),
      ).items,
    ).toHaveLength(4);
    expect(
      generateFindTheWow(
        request(equationProfile(1, 2, ["addition"])),
        { worksheetId: "22222222-2222-4222-8222-222222222222" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
    expect(
      generateFindTheWow(
        request(
          equationProfile(1, 2),
          { ...defaults, length: "long" },
        ),
        { worksheetId: "33333333-3333-4333-8333-333333333333" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
    expect(
      generated(
        request(
          equationProfile(2, 2),
          { ...defaults, length: "long" },
        ),
      ).items,
    ).toHaveLength(8);
    expect(
      generateFindTheWow(
        request(
          equationProfile(2, 1),
          { ...defaults, length: "short" },
        ),
        { worksheetId: "44444444-4444-4444-8444-444444444444" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });
  });
});

describe("Two Whats and a Wow documents", () => {
  test("generates the quantity variant for a dual-capability confidence request", () => {
    const confidenceRequest = request(equationProfile(), {
      ...defaults,
      difficulty: "confidence",
    });
    const document = generated(confidenceRequest);
    expect(document.request.options.difficulty).toBe("confidence");
    expect(document.items.every((item) => item.mode === "quantity")).toBe(true);
    assertQuantityDocument(document);
  });

  test("proves truth, bounds, uniqueness, answers, and balance over fixed seed ranges", () => {
    const settings = [
      { length: "short", printScale: "standard" },
      { length: "standard", printScale: "standard" },
      { length: "long", printScale: "standard" },
      { length: "short", printScale: "large" },
      { length: "standard", printScale: "large" },
      { length: "long", printScale: "large" },
    ] as const;
    for (const setting of settings) {
      for (let seed = 1; seed <= 64; seed += 1) {
        const preferences = { ...defaults, ...setting };
        const quantityRequest = request(
          quantityProfile(10),
          preferences,
          formatSeedHex(seed),
        );
        const equationRequest = request(
          equationProfile(),
          preferences,
          formatSeedHex(seed),
        );
        const quantity = generated(quantityRequest);
        const equation = generated(equationRequest);
        expect(quantity.items).toHaveLength(
          effectiveFindTheWowGroupCount(quantityRequest),
        );
        expect(equation.items).toHaveLength(
          effectiveFindTheWowGroupCount(equationRequest),
        );
        assertQuantityDocument(quantity);
        assertEquationDocument(equation);
        expect(objectiveAnswerEntries(quantity).map(({ itemId }) => itemId)).toEqual(
          quantity.items.map(({ id }) => id),
        );
        expect(objectiveAnswerEntries(equation).map(({ itemId }) => itemId)).toEqual(
          equation.items.map(({ id }) => id),
        );
      }
    }
  });

  test("never repeats an exercise on one page across a wide seed range", () => {
    const cases = [
      {
        label: "quantity limit 10 / standard",
        build: (seed: string) =>
          request(
            quantityProfile(10),
            { ...defaults, length: "standard" },
            seed,
          ),
      },
      {
        label: "quantity limit 10 / long",
        build: (seed: string) =>
          request(quantityProfile(10), { ...defaults, length: "long" }, seed),
      },
      {
        label: "equation operands 10 / standard",
        build: (seed: string) =>
          request(equationProfile(), { ...defaults, length: "standard" }, seed),
      },
    ];
    // Seeds 0x6b (quantity) and 0x88 (equation) repeated a stem before the
    // capacity model counted exercises instead of distractor permutations.
    for (const { label, build } of cases) {
      for (let seed = 1; seed <= 0x1f4; seed += 1) {
        const seedHex = formatSeedHex(seed);
        const document = generated(build(seedHex));
        const stems = pageStems(document);
        expect(
          new Set(stems).size,
          `${label} @ ${seedHex}: ${stems.join("|")}`,
        ).toBe(stems.length);
        if (seed === 1) {
          expect(pageStems(generated(build(seedHex)))).toEqual(stems);
        }
      }
    }
  });

  test("fails closed when the budget cannot supply distinct exercises", () => {
    for (let seed = 1; seed <= 32; seed += 1) {
      const seedHex = formatSeedHex(seed);
      const quantity = generateFindTheWow(
        request(quantityProfile(4), { ...defaults, length: "long" }, seedHex),
        { worksheetId: "77777777-7777-4777-8777-777777777777" },
      );
      expect(quantity, seedHex).toMatchObject({
        ok: false,
        code: "GENERATION_CONSTRAINT_CONFLICT",
      });
      expect(quantity).not.toHaveProperty("document");

      const equation = generateFindTheWow(
        request(
          equationProfile(1, 2, ["addition"]),
          { ...defaults, length: "standard" },
          seedHex,
        ),
        { worksheetId: "88888888-8888-4888-8888-888888888888" },
      );
      expect(equation, seedHex).toMatchObject({
        ok: false,
        code: "GENERATION_CONSTRAINT_CONFLICT",
      });
      expect(equation).not.toHaveProperty("document");
    }
  });

  test("is deterministic by request/seed/version and pins seed-one ordering", () => {
    const projected = request(
      equationProfile(),
      { ...defaults, length: "short" },
      "00000001",
    );
    const first = generated(
      projected,
      "11111111-1111-4111-8111-111111111111",
    );
    const second = generated(
      projected,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(first.items).toEqual(second.items);
    expect(first.worksheetId).not.toBe(second.worksheetId);
    expect(first.items.map(({ correctPosition }) => correctPosition)).toEqual([
      0, 0, 2, 1,
    ]);
    expect(first.items[0]).toEqual({
      id: "item-001",
      itemType: "wow-group",
      answerability: "objective",
      mode: "equation",
      choices: [
        {
          kind: "equation",
          operation: "addition",
          leftOperand: 1,
          rightOperand: 4,
          renderedSymbol: "+",
          displayedResult: 5,
        },
        {
          kind: "equation",
          operation: "addition",
          leftOperand: 1,
          rightOperand: 4,
          renderedSymbol: "+",
          displayedResult: 10,
        },
        {
          kind: "equation",
          operation: "addition",
          leftOperand: 1,
          rightOperand: 4,
          renderedSymbol: "+",
          displayedResult: 1,
        },
      ],
      correctPosition: 0,
      answer: { kind: "choice", value: 0 },
    });
  });

  test("projects extreme stored capabilities into a safe equation-Wow envelope", () => {
    const future = equationProfile(1_000, 1_000);
    future.mathSkills.countingMax = 1_000;
    future.mathSkills.numeralMax = 1_000;
    future.mathSkills.compareMax = 1_000;
    future.mathSkills.allowRegrouping = true;
    future.mathSkills.allowNegativeResults = true;
    const document = generated(
      request(future, { ...defaults, length: "long" }, "2c6f5bd0"),
    );
    expect(document.request.capabilities.mathSkills).toMatchObject({
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      operandMax: 20,
      resultMax: 20,
      allowRegrouping: false,
      allowNegativeResults: false,
    });
    expect(document.items.every((item) => item.mode === "equation")).toBe(true);
    assertEquationDocument(document);
  });

  test("keeps disabled personalization and decorative data out of the document", () => {
    const document = generated(
      request(quantityProfile(), {
        ...defaults,
        useDisplayName: false,
        useInterests: true,
        includeDecorativeGraphics: true,
      }),
    );
    const serialized = JSON.stringify(document);
    expect(serialized).not.toContain("Private Riley");
    expect(serialized).not.toContain("Distinctive Private Space");
    expect(document.request).not.toHaveProperty("displayName");
    expect(document.request).not.toHaveProperty("topicIds");
    expect(document.request.options.includeDecorativeGraphics).toBe(false);
  });

  test("fails closed for capability, metadata, and non-normalized request violations", () => {
    const unavailable = equationProfile();
    unavailable.mathSkills.representations = ["equations"];
    unavailable.mathSkills.understandsEquality = false;
    expect(
      generateFindTheWow(request(unavailable), {
        worksheetId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toMatchObject({ ok: false, code: "GENERATION_CONSTRAINT_CONFLICT" });

    const validRequest = request(equationProfile());
    expect(
      generateFindTheWow(
        { ...validRequest, worksheetType: "dry-math" },
        { worksheetId: "11111111-1111-4111-8111-111111111111" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
    expect(
      generateFindTheWow(
        { ...validRequest, generatorVersion: 2 },
        { worksheetId: "11111111-1111-4111-8111-111111111111" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
    expect(
      generateFindTheWow(validRequest, { worksheetId: "not-a-uuid" }),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
    expect(
      generateFindTheWow(
        {
          ...validRequest,
          capabilities: {
            ...validRequest.capabilities,
            mathSkills: {
              ...validRequest.capabilities.mathSkills,
              allowRegrouping: true as unknown as false,
            },
          },
        },
        { worksheetId: "11111111-1111-4111-8111-111111111111" },
      ),
    ).toMatchObject({ ok: false, code: "GENERATION_INVARIANT_FAILED" });
  });

  test("does not consult ambient randomness on success or capacity failure", () => {
    const ambientRandom = vi.spyOn(Math, "random");
    expect(
      generateFindTheWow(request(quantityProfile(3)), {
        worksheetId: "11111111-1111-4111-8111-111111111111",
      }).ok,
    ).toBe(false);
    expect(
      generateFindTheWow(request(quantityProfile(10)), {
        worksheetId: "22222222-2222-4222-8222-222222222222",
      }).ok,
    ).toBe(true);
    expect(ambientRandom).not.toHaveBeenCalled();
  });
});
