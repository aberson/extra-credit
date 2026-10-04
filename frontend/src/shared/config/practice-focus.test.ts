import { describe, expect, test } from "vitest";

import { DRY_MATH_NUMERIC_MAXIMUM, V1_NUMERIC_MAXIMUM } from "../worksheet/types.js";
import { MATH_PRESETS, MATH_PRESET_IDS } from "./math-presets.js";
import {
  EARLIER_SETTING_OPTION_ID,
  FACT_PRACTICE_ENTRIES,
  PRACTICE_FOCUS_CATALOG,
  PRACTICE_FOCUS_KINDS,
  SENTENCE_VOCABULARY_LABELS,
  VOCABULARY_PRESENTATION_BANDS,
  describeFactsFocus,
  describePracticeFocus,
  matchFactPracticeEntry,
  matchPracticeFocusOption,
  presentationBandForVocabulary,
  vocabularyForPresentationBand,
  type PracticeFocusKind,
} from "./practice-focus.js";
import {
  CountCompareFocusV2Schema,
  DryMathFactsV2Schema,
  DryMathFocusV2Schema,
  EquationFocusV2Schema,
  PRESENTATION_BANDS,
  QuantityFocusV2Schema,
  SENTENCE_VOCABULARY_OPTIONS,
} from "./schema.js";

const FOCUS_SCHEMAS = {
  "dry-math": DryMathFocusV2Schema,
  "find-the-wow-quantity": QuantityFocusV2Schema,
  "find-the-wow-equation": EquationFocusV2Schema,
  "count-compare-make": CountCompareFocusV2Schema,
} as const satisfies Record<PracticeFocusKind, unknown>;

describe("the practice-focus catalogs", () => {
  test("Dry Math offers exactly the reviewed arithmetic presets, in words", () => {
    expect(PRACTICE_FOCUS_CATALOG["dry-math"].map(({ label }) => label)).toEqual([
      "Addition within 5",
      "Addition and subtraction within 10",
      "Addition and subtraction within 20",
      "Addition within 20",
      "Subtraction within 20",
      "Addition and subtraction within 50",
      "Addition and subtraction within 100",
    ]);
  });

  test("Two Whats and a Wow Equations offers the subset within the Version 1 ceiling", () => {
    const labels = PRACTICE_FOCUS_CATALOG["find-the-wow-equation"].map(({ label }) => label);
    expect(labels).toEqual([
      "Addition within 5",
      "Addition and subtraction within 10",
      "Addition and subtraction within 20",
      "Addition within 20",
      "Subtraction within 20",
    ]);
    for (const { focus } of PRACTICE_FOCUS_CATALOG["find-the-wow-equation"]) {
      expect(Math.max(focus.operandMax, focus.resultMax)).toBeLessThanOrEqual(V1_NUMERIC_MAXIMUM);
    }
  });

  test("both quantity catalogs offer quantities to 10 and to 20", () => {
    for (const kind of ["find-the-wow-quantity", "count-compare-make"] as const) {
      expect(PRACTICE_FOCUS_CATALOG[kind].map(({ label }) => label), kind).toEqual([
        "Quantities to 10",
        `Quantities to ${V1_NUMERIC_MAXIMUM}`,
      ]);
    }
  });

  test.each(PRACTICE_FOCUS_KINDS)(
    "every %s option parses with its focus schema, fits its ceiling and is unique",
    (kind) => {
      const catalog = PRACTICE_FOCUS_CATALOG[kind];
      expect(catalog.length).toBeGreaterThan(0);
      for (const option of catalog) {
        expect(FOCUS_SCHEMAS[kind].safeParse(option.focus).success, option.id).toBe(true);
        expect(option.label).toBe(describePracticeFocus(kind, option.focus));
        expect(matchPracticeFocusOption(kind, option.focus)).toBe(option.id);
      }
      expect(new Set(catalog.map(({ id }) => id)).size).toBe(catalog.length);
      expect(new Set(catalog.map(({ focus }) => JSON.stringify(focus))).size).toBe(
        catalog.length,
      );
    },
  );

  test("every catalog value is read from a reviewed preset, never written as a new literal", () => {
    interface PresetValues {
      readonly operations: readonly string[];
      readonly operandMax: number;
      readonly resultMax: number;
      readonly countingMax: number;
      readonly numeralMax: number;
      readonly compareMax: number;
    }
    const presetValues: PresetValues[] = [];
    for (const presetId of MATH_PRESET_IDS) {
      const skills: PresetValues | null = MATH_PRESETS[presetId].mathSkills;
      if (skills !== null) {
        presetValues.push(skills);
      }
    }
    const fromPresets = (predicate: (skills: PresetValues) => boolean) =>
      presetValues.some(predicate);
    for (const { focus } of PRACTICE_FOCUS_CATALOG["dry-math"]) {
      expect(
        fromPresets(
          (skills) =>
            JSON.stringify(skills.operations) === JSON.stringify(focus.operations) &&
            skills.operandMax === focus.operandMax &&
            skills.resultMax === focus.resultMax,
        ),
        JSON.stringify(focus),
      ).toBe(true);
    }
    for (const { focus } of PRACTICE_FOCUS_CATALOG["count-compare-make"]) {
      expect(
        fromPresets(
          (skills) =>
            skills.countingMax === focus.countingMax &&
            skills.numeralMax === focus.numeralMax &&
            skills.compareMax === focus.compareMax,
        ),
        JSON.stringify(focus),
      ).toBe(true);
    }
    expect(
      Math.max(...PRACTICE_FOCUS_CATALOG["dry-math"].map(({ focus }) => focus.operandMax)),
    ).toBe(DRY_MATH_NUMERIC_MAXIMUM);
  });
});

describe("describing and matching a focus", () => {
  test("describes a focus outside the catalog in the same words", () => {
    expect(
      describePracticeFocus("dry-math", {
        operations: ["addition"],
        operandMax: 20,
        resultMax: 2,
      }),
    ).toBe("Addition with numbers to 20 and answers to 2");
    expect(
      describePracticeFocus("find-the-wow-quantity", { countingMax: 7, numeralMax: 5 }),
    ).toBe("Counting to 7 with numerals to 5");
    expect(
      describePracticeFocus("count-compare-make", {
        countingMax: 7,
        numeralMax: 7,
        compareMax: 7,
      }),
    ).toBe("Quantities to 7");
    expect(
      describePracticeFocus("count-compare-make", {
        countingMax: 6,
        numeralMax: 8,
        compareMax: 9,
      }),
    ).toBe("Counting to 6, numerals to 8 and comparisons to 9");
  });

  test("a value outside the catalog matches the earlier-setting option", () => {
    expect(
      matchPracticeFocusOption("dry-math", { operations: ["addition"], operandMax: 1, resultMax: 1 }),
    ).toBe(EARLIER_SETTING_OPTION_ID);
    expect(
      matchPracticeFocusOption("find-the-wow-quantity", { countingMax: 7, numeralMax: 7 }),
    ).toBe(EARLIER_SETTING_OPTION_ID);
    // The same values as a catalog entry, with the keys in another order.
    const [first] = PRACTICE_FOCUS_CATALOG["count-compare-make"];
    expect(
      matchPracticeFocusOption("count-compare-make", {
        compareMax: first!.focus.compareMax,
        numeralMax: first!.focus.numeralMax,
        countingMax: first!.focus.countingMax,
      }),
    ).toBe(first!.id);
  });
});

describe("Dry Math's fact entries", () => {
  test("three entries, one per nonempty canonical set of fact operations, labelled as the plan states", () => {
    expect(
      FACT_PRACTICE_ENTRIES.map(({ id, label, operations }) => [id, label, [...operations]]),
    ).toEqual([
      ["multiplication-facts", "Multiplication facts", ["multiplication"]],
      ["division-facts", "Division facts", ["division"]],
      ["multiplication-and-division-facts", "Multiplication and division facts", ["multiplication", "division"]],
    ]);
    for (const entry of FACT_PRACTICE_ENTRIES) {
      expect(matchFactPracticeEntry(entry.operations)).toBe(entry);
      expect(
        DryMathFactsV2Schema.safeParse({ operations: [...entry.operations], factFamilies: [2] }).success,
      ).toBe(true);
    }
    // No catalog id can be mistaken for a fact entry.
    const catalogIds = PRACTICE_FOCUS_CATALOG["dry-math"].map(({ id }) => id);
    expect(FACT_PRACTICE_ENTRIES.filter(({ id }) => catalogIds.includes(id))).toEqual([]);
    expect(() => matchFactPracticeEntry(["division", "multiplication"])).toThrow();
  });

  test("a facts summary names the entry and the families joined as 2, 5 and 10", () => {
    expect(describeFactsFocus({ operations: ["multiplication"], factFamilies: [2, 5, 10] })).toBe(
      "Multiplication facts for 2, 5 and 10",
    );
    expect(describeFactsFocus({ operations: ["division"], factFamilies: [0] })).toBe(
      "Division facts for 0",
    );
    expect(
      describeFactsFocus({ operations: ["multiplication", "division"], factFamilies: [3, 12] }),
    ).toBe("Multiplication and division facts for 3 and 12");
  });
});

describe("the vocabulary choice", () => {
  test("maps simpler-words to preschool and all-words to early-primary, and back", () => {
    expect(VOCABULARY_PRESENTATION_BANDS).toEqual({
      "simpler-words": "preschool",
      "all-words": "early-primary",
    });
    for (const vocabulary of SENTENCE_VOCABULARY_OPTIONS) {
      expect(vocabularyForPresentationBand(presentationBandForVocabulary(vocabulary))).toBe(
        vocabulary,
      );
    }
    expect(PRESENTATION_BANDS.map(vocabularyForPresentationBand)).toEqual([
      "simpler-words",
      "all-words",
    ]);
  });

  test("labels the two vocabulary options exactly as the plan states them", () => {
    expect(SENTENCE_VOCABULARY_LABELS).toEqual({
      "simpler-words": "Simpler words — for beginning readers",
      "all-words": "Include longer words",
    });
  });
});
