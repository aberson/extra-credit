import { describe, expect, test } from "vitest";

import {
  DIFFICULTIES,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  ChildProfileV1Schema,
  type ChildProfileV1,
  type GenerationDefaultsV1,
} from "../config/schema.js";
import {
  COUNT_COMPARE_MAKE_LABELS,
  COUNT_COMPARE_MAKE_SUBTYPES,
  countCompareCapacityShortfall,
  getCountCompareMakeComparisonLimit,
  getCountCompareMakeNumeralLimit,
  type CountCompareSubtypeV1,
} from "../../worksheets/count-compare-make/definition.js";
import { countCompareCapacityFormula } from "../../worksheets/count-compare-make/generator.js";
import { getDryMathCapabilitySupport } from "../../worksheets/dry-math/definition.js";
import { dryMathCapacityVerdict } from "../../worksheets/dry-math/generator.js";
import { getFindTheWowCapabilitySupport } from "../../worksheets/find-the-wow/definition.js";
import { findTheWowCapacityVerdict } from "../../worksheets/find-the-wow/generator.js";
import { getSentenceBuilderBankSize } from "../../worksheets/sentence-builder/definition.js";
import {
  UNBOUNDED_MAXIMUM,
  WORKSHEET_MAXIMUM_LABELS,
  bindingMaximumKeys,
  bindingMaximumKeysByProbe,
  capacityRemedySentence,
  joinLabels,
  shorterLengthLowersRequirement,
  type WorksheetMaximumValues,
  type WorksheetRelevantMaximumKey,
} from "./limit-labels.js";
import { projectGenerationRequest } from "./project-request.js";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetControlContextV1,
} from "./registry.js";

/*
 * The capacity/advice surface, tested where its discriminators live.
 *
 * Step 9 halted under the stop-and-audit rule on the third instance of one
 * shape: a fixture set whose values COLLAPSE the distinction the code
 * discriminates on, leaving an arm unreachable while the suite stays green. All
 * three instances were found by neutralizing production code by hand and
 * watching the suite stay green - which is not a process that scales.
 *
 * This file is the standing replacement for that hand process, in three parts.
 *
 * 1. Direct table tests for every exported discriminator in `limit-labels.ts`,
 *    where the inputs are literals rather than the output of a fixture builder
 *    that might tie them.
 * 2. A declared-arm catalogue for the whole surface, an observation sweep that
 *    records which arm every dispatch really took, and an assertion that the
 *    OBSERVED set equals the DECLARED reachable set exactly. Equality, not
 *    containment: an arm that is provably unreachable must be declared dead,
 *    and an arm that stops being reachable fails here.
 * 3. A bounded cube over the three quantity maxima that re-derives the four
 *    structurally-dead Count, Compare & Make arms mechanically, instead of
 *    trusting anyone's arithmetic about why they cannot fire.
 */

// ---------------------------------------------------------------------------
// 1. Direct discriminator tables
// ---------------------------------------------------------------------------

describe("limit label joining", () => {
  test("joins nothing, one, two and three labels", () => {
    expect(joinLabels([])).toBe("");
    expect(joinLabels(["counting"])).toBe("counting");
    expect(joinLabels(["counting", "numerals"])).toBe("counting and numerals");
    expect(joinLabels(["counting", "numerals", "comparisons"])).toBe(
      "counting, numerals, and comparisons",
    );
  });
});

describe("the remedy clause of a capacity shortage sentence", () => {
  test("names exactly the keys it is given, in both length arms", () => {
    const rows: readonly {
      readonly shorter: boolean;
      readonly keys: readonly WorksheetRelevantMaximumKey[];
      readonly sentence: string;
    }[] = [
      {
        shorter: false,
        keys: ["compareMax"],
        sentence: "Review the profile's comparisons limits.",
      },
      {
        shorter: true,
        keys: ["compareMax"],
        sentence:
          "Choose a shorter worksheet or review the profile's comparisons limits.",
      },
      {
        shorter: false,
        keys: ["countingMax", "numeralMax"],
        sentence: "Review the profile's counting and numerals limits.",
      },
      {
        shorter: true,
        keys: ["countingMax", "numeralMax", "compareMax"],
        sentence:
          "Choose a shorter worksheet or review the profile's counting, numerals, and comparisons limits.",
      },
      {
        shorter: true,
        keys: ["operandMax"],
        sentence:
          "Choose a shorter worksheet or review the profile's operands limits.",
      },
      {
        shorter: false,
        keys: ["resultMax"],
        sentence: "Review the profile's results limits.",
      },
    ];
    for (const { shorter, keys, sentence } of rows) {
      expect(capacityRemedySentence(shorter, keys)).toBe(sentence);
    }
  });

  test("an empty key list never prints a limit with no noun", () => {
    // Unreachable from any registration today, which is exactly why it needs a
    // test: the string it used to build was "Review the profile's  limits."
    expect(capacityRemedySentence(false, [])).toBe(
      "No profile limit can widen this selection.",
    );
    expect(capacityRemedySentence(true, [])).toBe("Choose a shorter worksheet.");
  });
});

describe("whether a shorter worksheet is a real remedy", () => {
  test("offers a shorter length only when one really asks for less", () => {
    const budgets: Record<GenerationDefaultsV1["length"], number> = {
      short: 8,
      standard: 12,
      long: 18,
    };
    const flat: Record<GenerationDefaultsV1["length"], number> = {
      short: 2,
      standard: 2,
      long: 3,
    };
    expect(
      shorterLengthLowersRequirement("short", 8, (length) => budgets[length]),
    ).toBe(false);
    expect(
      shorterLengthLowersRequirement("standard", 12, (length) => budgets[length]),
    ).toBe(true);
    expect(
      shorterLengthLowersRequirement("long", 18, (length) => budgets[length]),
    ).toBe(true);
    // Count, Compare & Make asks for the same two comparisons at short and at
    // standard, so at standard the shorter option cannot change the answer.
    expect(
      shorterLengthLowersRequirement("standard", 2, (length) => flat[length]),
    ).toBe(false);
    expect(shorterLengthLowersRequirement("long", 3, (length) => flat[length])).toBe(
      true,
    );
  });
});

describe("the Math.min binding-maximum selector", () => {
  test("names the strictly lowest candidate, or every tied one", () => {
    expect(
      bindingMaximumKeys([
        ["countingMax", 2],
        ["numeralMax", 20],
      ]),
    ).toEqual(["countingMax"]);
    expect(
      bindingMaximumKeys([
        ["countingMax", 20],
        ["numeralMax", 2],
      ]),
    ).toEqual(["numeralMax"]);
    // A tie names both on purpose: raising one of them alone cannot move a
    // minimum the other still holds down.
    expect(
      bindingMaximumKeys([
        ["countingMax", 7],
        ["numeralMax", 7],
      ]),
    ).toEqual(["countingMax", "numeralMax"]);
    expect(
      bindingMaximumKeys([
        ["countingMax", 20],
        ["compareMax", 1],
      ]),
    ).toEqual(["compareMax"]);
  });
});

describe("the counterfactual binding-maximum probe", () => {
  const maximums: WorksheetMaximumValues = {
    countingMax: 5,
    numeralMax: 5,
    compareMax: 5,
    operandMax: 5,
    resultMax: 5,
  };
  const keys: readonly WorksheetRelevantMaximumKey[] = [
    "operandMax",
    "resultMax",
  ];

  test("names a maximum only when lifting it really enlarges the pool", () => {
    // The whole reason this exists instead of a Math.min: operands and results
    // are equal here, so a min would name both, while only one of them is
    // holding the count down.
    expect(
      bindingMaximumKeysByProbe(maximums, keys, 10, (lifted) =>
        lifted.resultMax === UNBOUNDED_MAXIMUM ? 99 : 10,
      ),
    ).toEqual(["resultMax"]);
    expect(
      bindingMaximumKeysByProbe(maximums, keys, 10, (lifted) =>
        lifted.operandMax === UNBOUNDED_MAXIMUM ? 99 : 10,
      ),
    ).toEqual(["operandMax"]);
    expect(
      bindingMaximumKeysByProbe(maximums, keys, 10, () => 99),
    ).toEqual(["operandMax", "resultMax"]);
    expect(bindingMaximumKeysByProbe(maximums, keys, 10, () => 10)).toEqual([]);
  });

  test("lifts exactly one maximum per probe and leaves the rest alone", () => {
    const seen: WorksheetMaximumValues[] = [];
    bindingMaximumKeysByProbe(maximums, keys, 0, (lifted) => {
      seen.push(lifted);
      return 0;
    });
    expect(seen).toEqual([
      { ...maximums, operandMax: UNBOUNDED_MAXIMUM },
      { ...maximums, resultMax: UNBOUNDED_MAXIMUM },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. The declared-arm catalogue and its observation sweep
// ---------------------------------------------------------------------------

type ArmStatus = "reachable" | "dead";

interface DeclaredArm {
  readonly id: string;
  readonly status: ArmStatus;
  /** What a reachable arm discriminates, or why a dead one cannot be entered. */
  readonly note: string;
}

const PROBING_WORKSHEET_TYPES: readonly RegisteredWorksheetType[] = [
  "dry-math",
  "find-the-wow",
  "count-compare-make",
];

/** Pinned in `registry.ts`; asserted here so the arm labels stay anchored. */
const DIFFICULTY_REMEDY =
  "Setting Difficulty to Practice also fills this selection, without changing the profile.";

const registrationArms: readonly DeclaredArm[] = REGISTERED_WORKSHEET_IDS.flatMap(
  (worksheetType): DeclaredArm[] => [
    {
      id: `REG-${worksheetType}-AVAIL`,
      status: "reachable",
      note: "the registration answered available and attached a capacity verdict",
    },
    {
      id: `REG-${worksheetType}-UNAVAIL`,
      status: worksheetType === "sentence-builder" ? "dead" : "reachable",
      note:
        worksheetType === "sentence-builder"
          ? "dead from the registry: the registration always passes the shipped vocabulary, which options.test.tsx proves can starve no (mode, band, length, scale) cell"
          : "the capability gate refused before any capacity question",
    },
  ],
);

const subtypeShortageArms: readonly DeclaredArm[] =
  COUNT_COMPARE_MAKE_SUBTYPES.map((subtype): DeclaredArm => {
    const dead = subtype === "complete" || subtype === "draw";
    return {
      id: `CS-${subtype}`,
      status: dead ? "dead" : "reachable",
      note: dead
        ? "structurally dead: `match` is walked first and passes only when the numeral limit is at least 3, at which point this subtype's capacity is already above its maximum requirement of 2"
        : "the first subtype whose pool fell short",
    };
  });

const DECLARED_ARMS: readonly DeclaredArm[] = [
  ...registrationArms,
  ...subtypeShortageArms,
  {
    id: "CS-none",
    status: "reachable",
    note: "every subtype pool filled its allocation",
  },
  {
    id: "BK-compare",
    status: "reachable",
    note: "the compare pair (countingMax, compareMax) was consulted",
  },
  {
    id: "BK-other",
    status: "reachable",
    note: "the numeral pair (countingMax, numeralMax) was consulted",
  },
  {
    id: "BM-CMP-comparisons",
    status: "reachable",
    note: "a comparison shortage named compareMax alone",
  },
  {
    id: "BM-CMP-counting",
    status: "dead",
    note: "a compare shortage needs a comparison limit of at most 1, and match having passed forces countingMax at least 3, so countingMax can never be the lower of that pair",
  },
  {
    id: "BM-CMP-tie",
    status: "dead",
    note: "same proof as BM-CMP-counting: compareMax is strictly below countingMax whenever this pair is consulted",
  },
  {
    id: "BM-NUM-counting",
    status: "reachable",
    note: "a numeral-bounded shortage named countingMax alone",
  },
  {
    id: "BM-NUM-numerals",
    status: "reachable",
    note: "a numeral-bounded shortage named numeralMax alone - the case where countingMax is already at the Version 1 ceiling",
  },
  {
    id: "BM-NUM-tie",
    status: "reachable",
    note: "counting and numerals tied, so both were named",
  },
  {
    id: "RM-shorter",
    status: "reachable",
    note: "the remedy offered a shorter worksheet",
  },
  {
    id: "RM-noshorter",
    status: "reachable",
    note: "no shorter length asks for less of the resource that fell short",
  },
  {
    id: "RM-empty",
    status: "dead",
    note: "no schema-valid profile makes both binding selectors return an empty list; the arm is covered by the direct table above",
  },
  {
    id: "SL-short-false",
    status: "reachable",
    note: "the shortest page has no shorter page to offer",
  },
  {
    id: "SL-short-true",
    status: "dead",
    note: "`short` has no shorter length, so the requirement can never drop",
  },
  { id: "SL-standard-true", status: "reachable", note: "short really asks less" },
  {
    id: "SL-standard-false",
    status: "reachable",
    note: "short asks for the same amount of the resource that fell short",
  },
  { id: "SL-long-true", status: "reachable", note: "a shorter page asks less" },
  {
    id: "SL-long-false",
    status: "reachable",
    note: "large print already pulled long down, so no shorter page helps",
  },
  {
    id: "NA-empty",
    status: "reachable",
    note: "a family that reads no stored maximum for this selection",
  },
  {
    id: "NA-nonempty",
    status: "reachable",
    note: "advice derived from a non-empty declared maximum list",
  },
  { id: "FRM-none", status: "reachable", note: "Two Whats and a Wow unavailable" },
  { id: "FRM-equation", status: "reachable", note: "equation mode maxima" },
  { id: "FRM-quantity", status: "reachable", note: "quantity mode maxima" },
  {
    id: "PC-sufficient",
    status: "reachable",
    note: "the probe found no shortage",
  },
  {
    id: "PC-conf-practice-fills",
    status: "reachable",
    note: "confidence caused the shortage and practice would fill it",
  },
  {
    id: "PC-conf-practice-short",
    status: "reachable",
    note: "confidence, but practice falls short too, so no difficulty remedy",
  },
  {
    id: "PC-nonconf",
    status: "reachable",
    note: "not on confidence, so the practice re-probe is skipped",
  },
  { id: "PS-ok", status: "reachable", note: "the probe projection succeeded" },
  {
    id: "PS-projection-fail",
    status: "reachable",
    note: "the projection refused and the control surfaced its message rather than a capacity sentence",
  },
  {
    id: "FCS-conf-quantity",
    status: "reachable",
    note: "confidence with confirmed quantities resolves quantity mode first",
  },
  { id: "FCS-equation", status: "reachable", note: "the equation gate" },
  {
    id: "FCS-quantity-fallback",
    status: "reachable",
    note: "quantities without the equation gate",
  },
  { id: "FCS-unavailable", status: "reachable", note: "neither capability path" },
  { id: "FSF-suff", status: "reachable", note: "enough stems for this length" },
  {
    id: "FSF-quantity-counting",
    status: "reachable",
    note: "quantity shortage bounded by countingMax alone",
  },
  {
    id: "FSF-quantity-numerals",
    status: "reachable",
    note: "quantity shortage bounded by numeralMax alone",
  },
  {
    id: "FSF-quantity-tie",
    status: "reachable",
    note: "quantity shortage with the two maxima tied",
  },
  {
    id: "FSF-equation-operands",
    status: "reachable",
    note: "equation shortage that only a higher operand limit can widen",
  },
  {
    id: "FSF-equation-results",
    status: "reachable",
    note: "equation shortage that only a higher result limit can widen",
  },
  {
    id: "FSF-equation-both",
    status: "dead",
    note: "a Two Whats and a Wow group needs two distinct false results, so a pool small enough to fall short of any length budget is always bounded by exactly one of the two maxima; the equation cube below re-derives this over the whole clamped range",
  },
  {
    id: "FSF-equation-none",
    status: "dead",
    note: "no schema-valid equation profile leaves the probe with nothing to name; the empty case is covered by the direct table above",
  },
  {
    id: "DSF-none",
    status: "dead",
    note: "same proof as FSF-equation-none",
  },
  { id: "DSF-suff", status: "reachable", note: "enough facts for this length" },
  {
    id: "DSF-operands",
    status: "reachable",
    note: "fact shortage that only a higher operand limit can widen",
  },
  {
    id: "DSF-results",
    status: "reachable",
    note: "fact shortage that only a higher result limit can widen",
  },
  {
    id: "DSF-both",
    status: "reachable",
    note: "fact shortage both maxima independently bound",
  },
  {
    id: "DCS-no-equations",
    status: "reachable",
    note: "Dry Math refused for want of the equations representation",
  },
  {
    id: "DCS-no-operation",
    status: "reachable",
    note: "equations confirmed but no operation or no positive operand/result limit",
  },
  { id: "DCS-available", status: "reachable", note: "Dry Math capability gate open" },
  {
    id: "CCS-no-quantities",
    status: "reachable",
    note: "Count, Compare & Make refused for want of the quantities representation",
  },
  {
    id: "CCS-available",
    status: "reachable",
    note: "Count, Compare & Make capability gate open",
  },
  {
    id: "NL-counting",
    status: "reachable",
    note: "the numeral limit is bounded by countingMax alone",
  },
  {
    id: "NL-numerals",
    status: "reachable",
    note: "the numeral limit is bounded by numeralMax alone",
  },
  {
    id: "NL-tie",
    status: "reachable",
    note: "two or more terms of the numeral-limit minimum are tied",
  },
  {
    id: "NL-v1clamp",
    status: "dead",
    note: "the sole projection boundary clamps every maximum to 20 first, so the family's own clamp term can only tie, never win outright",
  },
  {
    id: "CL-counting",
    status: "reachable",
    note: "the comparison limit is bounded by countingMax alone",
  },
  {
    id: "CL-comparisons",
    status: "reachable",
    note: "the comparison limit is bounded by compareMax alone",
  },
  {
    id: "CL-tie",
    status: "reachable",
    note: "two or more terms of the comparison-limit minimum are tied",
  },
  {
    id: "CL-v1clamp",
    status: "dead",
    note: "same pre-clamp argument as NL-v1clamp",
  },
  {
    id: "QL-counting",
    status: "reachable",
    note: "the quantity stem limit is bounded by countingMax alone",
  },
  {
    id: "QL-numerals",
    status: "reachable",
    note: "the quantity stem limit is bounded by numeralMax alone",
  },
  {
    id: "QL-tie",
    status: "reachable",
    note: "counting and numerals tie in the quantity stem minimum",
  },
  {
    id: "SBU-no-bank",
    status: "reachable",
    note: "a writing mode that prints no bank previews one writing prompt",
  },
  {
    id: "SBU-bank",
    status: "reachable",
    note: "a bank-bearing mode previews its word-bank width",
  },
];

const DECLARED_ARM_IDS = new Set(DECLARED_ARMS.map(({ id }) => id));

const REACHABLE_ARM_IDS = DECLARED_ARMS.filter(
  ({ status }) => status === "reachable",
)
  .map(({ id }) => id)
  .sort();

const DEAD_ARM_IDS = DECLARED_ARMS.filter(({ status }) => status === "dead")
  .map(({ id }) => id)
  .sort();

// --- fixtures --------------------------------------------------------------

interface QuantityMaximumsV1 {
  readonly countingMax: number;
  readonly numeralMax: number;
  readonly compareMax: number;
}

function quantityProfile(
  id: string,
  maximums: QuantityMaximumsV1,
  writingMode: ChildProfileV1["writingMode"] = "label",
): ChildProfileV1 {
  return {
    id,
    displayName: "Private Quantity Child",
    ageYears: 5,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: {
      ...maximums,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode,
    interests: ["animals"],
  };
}

function equationProfile(
  id: string,
  operandMax: number,
  resultMax: number,
  operations: ChildProfileV1["mathSkills"]["operations"],
  writingMode: ChildProfileV1["writingMode"] = "sentence-frame",
): ChildProfileV1 {
  return {
    id,
    displayName: "Private Equation Child",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 1,
      numeralMax: 1,
      compareMax: 1,
      representations: ["equations"],
      understandsEquality: operations.length > 0,
      operations,
      operandMax,
      resultMax,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode,
    interests: ["space"],
  };
}

const bothCapabilitiesProfile: ChildProfileV1 = {
  id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
  displayName: "Private Avery",
  ageYears: 8,
  presentationBand: "early-primary",
  reviewedOn: "2026-08-22",
  mathSkills: {
    countingMax: 20,
    numeralMax: 20,
    compareMax: 20,
    representations: ["quantities", "equations"],
    understandsEquality: true,
    operations: ["addition", "subtraction"],
    operandMax: 20,
    resultMax: 20,
    allowRegrouping: false,
    allowNegativeResults: false,
  },
  writingMode: "independent",
  interests: ["sports", "nature"],
};

/** Version 1 supports ages 4-8; a stored 9 is the projection's own refusal. */
const beyondV1AgeProfile: ChildProfileV1 = {
  ...bothCapabilitiesProfile,
  id: "8d7c6b5a-4938-4271-8605-4f3e2d1c0b9a",
  ageYears: 9,
};

const PROBE_PROFILES: readonly ChildProfileV1[] = [
  // Quantities, tied at 10: the confidence downgrade takes both to 7 together.
  quantityProfile("d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321", {
    countingMax: 10,
    numeralMax: 10,
    compareMax: 10,
  }),
  // Counting strictly lowest, then numerals strictly lowest, with the other at
  // the Version 1 ceiling where "review that limit" would be unactionable.
  quantityProfile("1a2b3c4d-5e6f-4708-8912-a3b4c5d6e7f8", {
    countingMax: 6,
    numeralMax: 20,
    compareMax: 20,
  }),
  quantityProfile("2b3c4d5e-6f70-4819-8a23-b4c5d6e7f8a9", {
    countingMax: 20,
    numeralMax: 6,
    compareMax: 20,
  }),
  quantityProfile("3c4d5e6f-7081-4920-8b34-c5d6e7f8a9b0", {
    countingMax: 2,
    numeralMax: 20,
    compareMax: 20,
  }),
  quantityProfile("4d5e6f70-8192-4a31-8c45-d6e7f8a9b0c1", {
    countingMax: 20,
    numeralMax: 2,
    compareMax: 20,
  }),
  quantityProfile("5e6f7081-92a3-4b42-8d56-e7f8a9b0c1d2", {
    countingMax: 2,
    numeralMax: 2,
    compareMax: 20,
  }),
  quantityProfile("6f708192-a3b4-4c53-8e67-f8a9b0c1d2e3", {
    countingMax: 20,
    numeralMax: 20,
    compareMax: 1,
  }),
  quantityProfile("708192a3-b4c5-4d64-8f78-a9b0c1d2e3f4", {
    countingMax: 3,
    numeralMax: 20,
    compareMax: 20,
  }),
  // A no-bank writing mode, so the Sentence Builder unit arm is entered too.
  quantityProfile(
    "8192a3b4-c5d6-4e75-8089-b0c1d2e3f4a5",
    { countingMax: 20, numeralMax: 20, compareMax: 20 },
    "draw-and-tell",
  ),
  // Addition with the operands already at the ceiling: only the result limit
  // can widen this pool, which is the issue #16 defect this catalogue watches.
  equationProfile("92a3b4c5-d6e7-4f86-819a-c1d2e3f4a5b6", 20, 2, ["addition"]),
  // Subtraction with room on the result: only the operand limit can widen it.
  equationProfile("a3b4c5d6-e7f8-4097-82ab-d2e3f4a5b6c7", 2, 5, ["subtraction"]),
  // Subtraction with the result below the operands: BOTH maxima bind.
  equationProfile("b4c5d6e7-f8a9-41a8-83bc-e3f4a5b6c7d8", 3, 1, ["subtraction"]),
  // Equations confirmed with nothing usable behind them.
  equationProfile("c5d6e7f8-a9b0-42b9-84cd-f4a5b6c7d8e9", 0, 0, []),
  bothCapabilitiesProfile,
  beyondV1AgeProfile,
].map((profile) => ChildProfileV1Schema.parse(profile));

// --- observation -----------------------------------------------------------

const PROBE_SEED = "00000001";

const PROBE_PREFERENCES = {
  useDisplayName: false,
  useInterests: false,
  includeDecorativeGraphics: false,
  includeAnswerKey: false,
  paperSize: "letter",
} as const satisfies Omit<
  GenerationDefaultsV1,
  "difficulty" | "length" | "printScale"
>;

const LABELLED_KEYS = Object.entries(WORKSHEET_MAXIMUM_LABELS) as readonly [
  WorksheetRelevantMaximumKey,
  string,
][];

/** The maxima a shortage sentence really told the parent to review. */
function namedLimitLabels(message: string): readonly string[] {
  const match = /review the profile's (.+?) limits\./iu.exec(message);
  if (match === null) {
    return [];
  }
  const phrase = match[1] ?? "";
  return LABELLED_KEYS.map(([, label]) => label)
    .filter((label) => new RegExp(`(^|[ ,])${label}([ ,.]|$)`, "u").test(phrase))
    .sort();
}

/** A `Math.min` selector's outcome: one winner, or a tie that names them all. */
function armSuffix(labels: readonly string[]): string {
  return labels.length === 1 ? (labels[0] ?? "none") : "tie";
}

/**
 * A counterfactual probe's outcome. "both" rather than "tie" on purpose: the
 * two maxima are not equal there, they each independently bound the pool.
 */
function probeSuffix(labels: readonly string[]): string {
  if (labels.length === 0) {
    return "none";
  }
  return labels.length === 1 ? (labels[0] ?? "none") : "both";
}

/** Which terms of a `Math.min` were strictly lowest. */
function lowestTerms(
  candidates: readonly (readonly [string, number])[],
): readonly string[] {
  const lowest = Math.min(...candidates.map(([, value]) => value));
  return candidates.filter(([, value]) => value === lowest).map(([name]) => name);
}

function minimumArm(prefix: string, candidates: readonly (readonly [string, number])[]): string {
  const winners = lowestTerms(candidates);
  return `${prefix}-${winners.length === 1 ? (winners[0] ?? "none") : "tie"}`;
}

function shortageSubtype(message: string): CountCompareSubtypeV1 | undefined {
  return COUNT_COMPARE_MAKE_SUBTYPES.find((subtype) =>
    message.includes(`unique ${COUNT_COMPARE_MAKE_LABELS[subtype]} exercises`),
  );
}

describe("every declared arm of the capacity and advice surface", () => {
  test("the observed arm set equals the declared reachable set exactly", () => {
    const observed = new Set<string>();
    const observe = (arm: string): void => {
      if (!DECLARED_ARM_IDS.has(arm)) {
        // An arm nobody declared is the same defect as an arm nobody reached:
        // it means this catalogue no longer describes the surface.
        expect(`undeclared arm reached: ${arm}`).toBe("");
      }
      observed.add(arm);
    };

    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const registration = getWorksheetRegistration(worksheetType);
      for (const profile of PROBE_PROFILES) {
        for (const difficulty of DIFFICULTIES) {
          for (const length of WORKSHEET_LENGTHS) {
            for (const printScale of PRINT_SCALES) {
              const context: WorksheetControlContextV1 = {
                profile,
                difficulty,
                length,
                printScale,
              };
              const where = `${worksheetType} ${profile.id} ${difficulty}/${length}/${printScale}`;
              const support =
                registration.controls.getCapabilitySupport(context);
              observe(
                `REG-${worksheetType}-${support.available ? "AVAIL" : "UNAVAIL"}`,
              );

              // The effective-unit noun arms, which follow the writing mode.
              if (worksheetType === "sentence-builder") {
                observe(
                  getSentenceBuilderBankSize(
                    profile.writingMode,
                    length,
                    printScale,
                  ) === 0
                    ? "SBU-no-bank"
                    : "SBU-bank",
                );
              }

              // The declared-maximum list and the advice derived from it.
              const maximums = registration.controls.getRelevantMaximums(context);
              if (worksheetType !== "sentence-builder") {
                const advice =
                  registration.controls.getLimitingResourceAdvice(context);
                observe(maximums.length === 0 ? "NA-empty" : "NA-nonempty");
                expect(`${where}: ${advice}`).toContain(
                  maximums.length === 0
                    ? "has no further variation to offer"
                    : "varies within the profile's",
                );
              }
              if (worksheetType === "find-the-wow") {
                observe(
                  maximums.length === 0
                    ? "FRM-none"
                    : maximums[0]?.key === "operandMax"
                      ? "FRM-equation"
                      : "FRM-quantity",
                );
              }

              if (!PROBING_WORKSHEET_TYPES.includes(worksheetType)) {
                continue;
              }

              // The probe's own projection, built from exactly the inputs
              // `probeShortfall` pins.
              const projection = projectGenerationRequest({
                profile,
                worksheetType,
                generatorVersion: registration.generatorVersion,
                seed: PROBE_SEED,
                preferences: {
                  ...PROBE_PREFERENCES,
                  difficulty,
                  length,
                  printScale,
                },
                stretchConfirmed: true,
              });
              observe(projection.ok ? "PS-ok" : "PS-projection-fail");
              if (!projection.ok && support.available) {
                // A projection that failed must surface its OWN message, not a
                // capacity sentence about limits it never computed.
                expect(`${where}: ${JSON.stringify(support.capacity)}`).toBe(
                  `${where}: ${JSON.stringify({
                    sufficient: false,
                    message: projection.message,
                  })}`,
                );
              }
              if (!support.available || !projection.ok) {
                continue;
              }

              const skills = projection.request.capabilities.mathSkills;
              const message = support.capacity.sufficient
                ? ""
                : support.capacity.message;

              // probeCapacity's four arms.
              if (support.capacity.sufficient) {
                observe("PC-sufficient");
              } else if (difficulty !== "confidence") {
                observe("PC-nonconf");
              } else {
                observe(
                  message.endsWith(DIFFICULTY_REMEDY)
                    ? "PC-conf-practice-fills"
                    : "PC-conf-practice-short",
                );
              }

              const labels = namedLimitLabels(message);
              if (message !== "") {
                observe(
                  message.includes("Choose a shorter worksheet")
                    ? "RM-shorter"
                    : "RM-noshorter",
                );
                observe(
                  `SL-${length}-${message.includes("Choose a shorter worksheet")}`,
                );
                expect(`${where}: ${labels.length > 0}`).toBe(`${where}: true`);
              }

              if (worksheetType === "dry-math") {
                observe(
                  support.capacity.sufficient
                    ? "DSF-suff"
                    : `DSF-${probeSuffix(labels)}`,
                );
              }

              if (worksheetType === "find-the-wow") {
                const mode = getFindTheWowCapabilitySupport(skills, difficulty);
                expect(`${where}: ${mode.available}`).toBe(`${where}: true`);
                if (mode.available && mode.mode === "quantity") {
                  observe(
                    minimumArm("QL", [
                      ["counting", skills.countingMax],
                      ["numerals", skills.numeralMax],
                    ]),
                  );
                }
                if (support.capacity.sufficient) {
                  observe("FSF-suff");
                } else if (mode.available && mode.mode === "equation") {
                  observe(`FSF-equation-${probeSuffix(labels)}`);
                } else {
                  observe(`FSF-quantity-${armSuffix(labels)}`);
                }
              }

              if (worksheetType === "count-compare-make") {
                observe(
                  minimumArm("NL", [
                    ["counting", skills.countingMax],
                    ["numerals", skills.numeralMax],
                    ["v1clamp", 20],
                  ]),
                );
                observe(
                  minimumArm("CL", [
                    ["counting", skills.countingMax],
                    ["comparisons", skills.compareMax],
                    ["v1clamp", 20],
                  ]),
                );
                const subtype = shortageSubtype(message);
                observe(subtype === undefined ? "CS-none" : `CS-${subtype}`);
                if (subtype !== undefined) {
                  observe(subtype === "compare" ? "BK-compare" : "BK-other");
                  observe(
                    `BM-${subtype === "compare" ? "CMP" : "NUM"}-${armSuffix(labels)}`,
                  );
                }
              }
            }
          }
        }
      }
    }

    // The leaf capability gates, whose arms are decided by the STORED profile
    // rather than by any (length, print scale) cell.
    for (const profile of PROBE_PROFILES) {
      const skills = profile.mathSkills;
      const hasQuantities = skills.representations.includes("quantities");
      const hasEquations = skills.representations.includes("equations");
      const hasEquationGate =
        hasEquations && skills.understandsEquality && skills.operations.length > 0;

      for (const difficulty of DIFFICULTIES) {
        const findTheWow = getFindTheWowCapabilitySupport(skills, difficulty);
        const arm =
          difficulty === "confidence" && hasQuantities
            ? "FCS-conf-quantity"
            : hasEquationGate
              ? "FCS-equation"
              : hasQuantities
                ? "FCS-quantity-fallback"
                : "FCS-unavailable";
        const outcome = findTheWow.available ? findTheWow.mode : "unavailable";
        expect(`${profile.id} ${difficulty}: ${arm} -> ${outcome}`).toBe(
          `${profile.id} ${difficulty}: ${arm} -> ${
            arm === "FCS-equation"
              ? "equation"
              : arm === "FCS-unavailable"
                ? "unavailable"
                : "quantity"
          }`,
        );
        observe(arm);
      }

      const dryMath = getDryMathCapabilitySupport(skills);
      const dryArm = !hasEquations
        ? "DCS-no-equations"
        : skills.operations.length === 0 ||
            skills.operandMax < 1 ||
            skills.resultMax < 1
          ? "DCS-no-operation"
          : "DCS-available";
      expect(`${profile.id}: ${dryArm} -> ${dryMath.available}`).toBe(
        `${profile.id}: ${dryArm} -> ${dryArm === "DCS-available"}`,
      );
      if (!dryMath.available) {
        // The two refusals must stay two different sentences; a shared one
        // would let either gate stand in for the other.
        expect(dryMath.reason).toContain(
          dryArm === "DCS-no-equations"
            ? "needs equations and an enabled operation"
            : "needs at least one confirmed symbolic operation",
        );
      }
      observe(dryArm);

      observe(hasQuantities ? "CCS-available" : "CCS-no-quantities");
    }

    expect([...observed].sort()).toEqual(REACHABLE_ARM_IDS);
    for (const dead of DEAD_ARM_IDS) {
      expect(`${dead} observed ${observed.has(dead)}`).toBe(
        `${dead} observed false`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The bounded cube behind the four dead Count, Compare & Make arms
// ---------------------------------------------------------------------------

describe("the structurally dead Count, Compare & Make arms", () => {
  test("no schema-valid maxima cube ever reaches them", () => {
    // Re-derives the deadness proof mechanically rather than trusting the
    // arithmetic in a comment: every schema-valid triple of quantity maxima,
    // every length, every print scale. If a future allocation change makes one
    // of these arms live, the declared set below stops matching and the arm has
    // to be re-declared as reachable rather than silently entered.
    const observed = new Set<string>();
    let shortages = 0;
    for (let countingMax = 1; countingMax <= 20; countingMax += 1) {
      for (let numeralMax = 1; numeralMax <= 20; numeralMax += 1) {
        for (let compareMax = 1; compareMax <= 20; compareMax += 1) {
          const mathSkills = { countingMax, numeralMax, compareMax };
          const capacity = countCompareCapacityFormula(
            getCountCompareMakeNumeralLimit(mathSkills),
            getCountCompareMakeComparisonLimit(mathSkills),
          );
          for (const length of WORKSHEET_LENGTHS) {
            for (const printScale of PRINT_SCALES) {
              const message = countCompareCapacityShortfall(
                capacity,
                mathSkills,
                length,
                printScale,
              );
              if (message === undefined) {
                continue;
              }
              shortages += 1;
              const subtype = shortageSubtype(message);
              const where = `${countingMax}/${numeralMax}/${compareMax} ${length}/${printScale}`;
              expect(`${where}: ${subtype}`).not.toContain("undefined");
              observed.add(
                `${subtype}:${namedLimitLabels(message).join("+")}`,
              );
            }
          }
        }
      }
    }
    expect(shortages).toBeGreaterThan(0);
    // "group-completion" and "draw-a-quantity" never appear, and a comparison
    // shortage never names counting: those are the four dead arms.
    expect([...observed].sort()).toEqual([
      "compare:comparisons",
      "match:counting",
      "match:counting+numerals",
      "match:numerals",
    ]);
  });
});

describe("the equation families' binding-maximum arms", () => {
  test("the observed binding sets over the whole clamped range are the declared ones", () => {
    // Both families bound operands and results INDEPENDENTLY through a filter,
    // so which one is really holding the pool down cannot be read off a
    // Math.min. This sweeps every schema-valid pair the projection can hand
    // them, at the longest page - the largest requirement, so a shortage at any
    // shorter length is a shortage here too, with the same binding set, because
    // binding depends on the maxima and the operations and not on the budget.
    const OPERATION_SETS = [
      ["addition"],
      ["subtraction"],
      ["addition", "subtraction"],
    ] as const satisfies readonly ChildProfileV1["mathSkills"]["operations"][];
    const dryMathArms = new Set<string>();
    const findTheWowArms = new Set<string>();
    let shortages = 0;

    for (const operations of OPERATION_SETS) {
      for (let operandMax = 1; operandMax <= 20; operandMax += 1) {
        for (let resultMax = 1; resultMax <= 20; resultMax += 1) {
          const profile = ChildProfileV1Schema.parse(
            equationProfile(
              "e1d2c3b4-a596-4877-8968-5a4b3c2d1e0f",
              operandMax,
              resultMax,
              [...operations],
            ),
          );
          const where = `${operations.join("+")} ${operandMax}/${resultMax}`;
          for (const worksheetType of ["dry-math", "find-the-wow"] as const) {
            const registration = getWorksheetRegistration(worksheetType);
            const projection = projectGenerationRequest({
              profile,
              worksheetType,
              generatorVersion: registration.generatorVersion,
              seed: PROBE_SEED,
              preferences: {
                ...PROBE_PREFERENCES,
                difficulty: "practice",
                length: "long",
                printScale: "standard",
              },
              stretchConfirmed: true,
            });
            expect(`${where}: ${projection.ok}`).toBe(`${where}: true`);
            if (!projection.ok) {
              continue;
            }
            const message =
              worksheetType === "dry-math"
                ? dryMathCapacityVerdict(projection.request)
                : findTheWowCapacityVerdict(projection.request);
            if (message === undefined) {
              continue;
            }
            shortages += 1;
            const arm = probeSuffix(namedLimitLabels(message));
            expect(`${where} ${worksheetType}: ${arm}`).not.toContain("none");
            if (worksheetType === "dry-math") {
              dryMathArms.add(arm);
            } else {
              findTheWowArms.add(arm);
            }
          }
        }
      }
    }

    expect(shortages).toBeGreaterThan(0);
    expect([...dryMathArms].sort()).toEqual(["both", "operands", "results"]);
    // No "both": this is the mechanical form of the FSF-equation-both deadness
    // note in the catalogue above, and it flips the moment the group budget or
    // the distractor rule changes.
    expect([...findTheWowArms].sort()).toEqual(["operands", "results"]);
  });
});
