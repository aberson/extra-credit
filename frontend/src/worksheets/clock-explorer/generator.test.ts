import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults.js";
import type { WorksheetSelectionV2 } from "../../shared/config/schema.js";
import { recomputeObjectiveAnswer } from "../../shared/worksheet/answer-oracle.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import { projectGenerationRequest } from "../../shared/worksheet/project-request.js";
import { getWorksheetRegistration } from "../../shared/worksheet/registry.js";
import type {
  ClockExplorerItemV1,
  DryMathItemV1,
  GenerationRequestV1,
  WorksheetDocumentV1,
  WorksheetItemV1,
} from "../../shared/worksheet/types.js";
import { generateDryMath } from "../dry-math/generator.js";
import {
  CLOCK_EXPLORER_DEFINITION,
  CLOCK_MINUTE_HAND_DEGREES,
  clockHandsText,
  clockHourHandDegrees,
  clockKeyText,
  clockTimeText,
} from "./definition.js";
import {
  CLOCK_EXPLORER_HOURS,
  generateClockExplorer,
  validateClockExplorerDocument,
  type ClockExplorerDocumentV1,
} from "./generator.js";

const WORKSHEET_ID = "44444444-4444-4444-8444-444444444444";

const baseSelection: WorksheetSelectionV2 = {
  ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
  worksheetType: "clock-explorer",
};

/** The request the sole projection boundary builds for a Clock Explorer page. */
function clockRequest(seed: string, selection: WorksheetSelectionV2 = baseSelection): GenerationRequestV1 {
  const projected = projectGenerationRequest({
    selection,
    generatorVersion: CLOCK_EXPLORER_DEFINITION.generatorVersion,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  return projected.request;
}

function generated(seed: string): ClockExplorerDocumentV1 {
  const result = generateClockExplorer(clockRequest(seed), { worksheetId: WORKSHEET_ID });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.document;
}

function hoursOf(document: WorksheetDocumentV1): readonly number[] {
  return document.items.map((item) => (item.itemType === "clock-explorer" ? item.hour : Number.NaN));
}

/** A document with its items replaced, for the malformed-input cases. */
function withItems(
  document: ClockExplorerDocumentV1,
  items: readonly WorksheetItemV1[],
): ClockExplorerDocumentV1 {
  return { ...document, items } as unknown as ClockExplorerDocumentV1;
}

function clock(id: string, hour: number, answer = hour): ClockExplorerItemV1 {
  return {
    id,
    itemType: "clock-explorer",
    answerability: "objective",
    hour,
    answer: { kind: "number", value: answer },
  };
}

describe("Clock Explorer registration", () => {
  test("is version 1, keyed, uses no interests and is the registered generator", () => {
    expect(CLOCK_EXPLORER_DEFINITION).toEqual({
      id: "clock-explorer",
      displayName: "Clock Explorer",
      generatorVersion: 1,
      usesInterests: false,
      hasAnswerKey: true,
    });
    expect(getWorksheetRegistration("clock-explorer").generate).toBe(generateClockExplorer);
    expect(CLOCK_EXPLORER_HOURS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("generateClockExplorer", () => {
  // Pinned from the seeded shuffle: a change to the stream or the domain
  // order fails here instead of silently changing every printed page.
  test.each([
    ["00000001", [7, 3, 4, 8]],
    ["00000002", [6, 4, 10, 8]],
    ["5eed0035", [3, 9, 1, 7]],
    ["a1b2c3d4", [7, 11, 1, 6]],
    ["ffffffff", [11, 12, 10, 7]],
  ] as const)("seed %s draws the hours %j", (seed, hours) => {
    const document = generated(seed);
    expect(hoursOf(document)).toEqual(hours);
    expect(document.items.map(({ id }) => id)).toEqual(["item-001", "item-002", "item-003", "item-004"]);
    expect(document.items).toEqual(hours.map((hour, index) => clock(`item-00${index + 1}`, hour)));
  });

  test("the same request and seed reproduce the same document", () => {
    for (const seed of ["00000001", "5eed0035", "ffffffff"]) {
      expect(generated(seed)).toEqual(generated(seed));
      expect(generateClockExplorer(clockRequest(seed), { worksheetId: WORKSHEET_ID }))
        .toEqual(getWorksheetRegistration("clock-explorer").generate(clockRequest(seed), {
          worksheetId: WORKSHEET_ID,
        }));
    }
  });

  test("every seed draws four distinct hours from 1 to 12, and the seeds together reach all twelve in every position", () => {
    const seen = Array.from({ length: 4 }, () => new Set<number>());
    for (let seed = 1; seed <= 400; seed += 1) {
      const document = generated(seed.toString(16).padStart(8, "0"));
      const hours = hoursOf(document);
      expect(hours).toHaveLength(4);
      expect(new Set(hours).size).toBe(4);
      for (const [position, hour] of hours.entries()) {
        expect(Number.isInteger(hour) && hour >= 1 && hour <= 12).toBe(true);
        seen[position]?.add(hour);
      }
      expect(validateClockExplorerDocument(document)).toBeUndefined();
    }
    for (const positions of seen) {
      expect([...positions].sort((a, b) => a - b)).toEqual(CLOCK_EXPLORER_HOURS);
    }
  });

  test("a different seed changes the clocks", () => {
    expect(hoursOf(generated("00000001"))).not.toEqual(hoursOf(generated("00000002")));
  });

  test("refuses a request for another family or generator version", () => {
    const request = clockRequest("00000001");
    for (const wrong of [
      { ...request, worksheetType: "dry-math" },
      { ...request, generatorVersion: 2 },
    ] as const) {
      const result = generateClockExplorer(wrong, { worksheetId: WORKSHEET_ID });
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.code).toBe("GENERATION_INVARIANT_FAILED");
    }
  });
});

describe("every hour's hands and key text", () => {
  // Written out, not derived: 30 degrees per hour clockwise from twelve, and
  // twelve itself back at zero, under the minute hand.
  const HOUR_HAND_DEGREES = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 0];

  test.each(CLOCK_EXPLORER_HOURS)("%i:00 has its hour hand, its minute hand at twelve, and its key line", (hour) => {
    expect(clockHourHandDegrees(hour)).toBe(HOUR_HAND_DEGREES[hour - 1]);
    expect(CLOCK_MINUTE_HAND_DEGREES).toBe(0);
    expect(clockTimeText(hour)).toBe(`${hour}:00`);
    expect(clockHandsText(hour)).toBe(`long hand at 12, short hand at ${hour}`);
    expect(clockKeyText(hour)).toBe(`${hour}:00 — long hand at 12, short hand at ${hour}`);
    expect(recomputeObjectiveAnswer(clock("item-001", hour))).toEqual({ kind: "number", value: hour });
  });

  test("3:00 keys the long hand at twelve and the short hand at three; 12:00 overlaps them at twelve", () => {
    expect(clockKeyText(3)).toBe("3:00 — long hand at 12, short hand at 3");
    expect(clockHourHandDegrees(3)).toBe(90);
    expect(clockKeyText(12)).toBe("12:00 — long hand at 12, short hand at 12");
    expect(clockHourHandDegrees(12)).toBe(CLOCK_MINUTE_HAND_DEGREES);
  });

  test.each([0, 13, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "a clock showing %s has no on-the-hour answer",
    (hour) => {
      expect(recomputeObjectiveAnswer(clock("item-001", hour))).toBeUndefined();
    },
  );
});

describe("validateClockExplorerDocument refuses malformed pages", () => {
  const document = generated("00000001");
  const [first, second, third, fourth] = document.items as readonly ClockExplorerItemV1[];
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    throw new Error("A Clock Explorer page holds four clocks.");
  }

  test("the generated page passes, and so does every clock order of the same hours", () => {
    expect(validateClockExplorerDocument(document)).toBeUndefined();
    const reversed = [fourth, third, second, first].map((item, index) =>
      clock(`item-00${index + 1}`, item.hour),
    );
    expect(validateClockExplorerDocument(withItems(document, reversed))).toBeUndefined();
  });

  const dryMathItem: DryMathItemV1 = {
    id: "item-004",
    itemType: "dry-math",
    answerability: "objective",
    operation: "addition",
    leftOperand: 1,
    rightOperand: 2,
    renderedSymbol: "+",
    answer: { kind: "number", value: 3 },
  };

  test.each([
    ["an hour of 0", () => [clock("item-001", 0), second, third, fourth]],
    ["an hour of 13", () => [clock("item-001", 13), second, third, fourth]],
    ["a fractional hour", () => [clock("item-001", 2.5), second, third, fourth]],
    ["a wrong answer", () => [clock("item-001", first.hour, first.hour === 12 ? 1 : first.hour + 1), second, third, fourth]],
    ["a choice answer", () => [{ ...first, answer: { kind: "choice", value: 0 } }, second, third, fourth]],
    ["a repeated hour", () => [first, clock("item-002", first.hour), third, fourth]],
    ["three clocks", () => [first, second, third]],
    ["five clocks", () => [first, second, third, fourth, clock("item-005", fourth.hour === 12 ? 1 : 12)]],
    ["no clocks", () => []],
    ["out-of-order identifiers", () => [second, first, third, fourth]],
    ["a Dry Math item among the clocks", () => [first, second, third, dryMathItem]],
  ] as const)("%s", (_label, items) => {
    const failure = validateClockExplorerDocument(withItems(document, items() as readonly WorksheetItemV1[]));
    expect(failure?.code).toBe("GENERATION_INVARIANT_FAILED");
  });

  test.each([
    ["a stored length", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, options: { ...request.options, length: "short" } })],
    ["decoration", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, options: { ...request.options, includeDecorativeGraphics: true } })],
    ["a decorative topic", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, options: { ...request.options, decorativeTopicId: "space" } })],
    ["interests", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, topicIds: ["animals"] })],
    ["a practice member", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, practice: { kind: "dry-math-add-subtract", regrouping: "required" } })],
    ["a writing mode", (request: GenerationRequestV1): GenerationRequestV1 => ({ ...request, capabilities: { ...request.capabilities, writingMode: "independent" } })],
    ["a math operation", (request: GenerationRequestV1): GenerationRequestV1 => ({
      ...request,
      capabilities: {
        ...request.capabilities,
        mathSkills: { ...request.capabilities.mathSkills, operations: ["addition", "subtraction"] },
      },
    })],
  ] as const)("a request carrying %s", (_label, edit) => {
    const request = edit(document.request);
    expect(validateClockExplorerDocument({ ...document, request })?.code).toBe("GENERATION_INVARIANT_FAILED");
    // The generator itself refuses the same request rather than draw from it.
    expect(generateClockExplorer(request, { worksheetId: WORKSHEET_ID }).ok).toBe(false);
  });

  test("a clock is refused on another family's page", () => {
    const dryMath = generateDryMath(
      (() => {
        const projected = projectGenerationRequest({
          selection: { ...baseSelection, worksheetType: "dry-math" },
          generatorVersion: 1,
          seed: "00000001",
        });
        if (!projected.ok) {
          throw new Error(projected.message);
        }
        return projected.request;
      })(),
      { worksheetId: WORKSHEET_ID },
    );
    if (!dryMath.ok) {
      throw new Error(dryMath.message);
    }
    expect(validateWorksheetInvariants(dryMath.document)).toBeUndefined();
    const items = dryMath.document.items.map((item, index) =>
      index === 0 ? clock(item.id, 3) : item,
    );
    expect(validateWorksheetInvariants({ ...dryMath.document, items })?.code).toBe(
      "GENERATION_INVARIANT_FAILED",
    );
  });
});
