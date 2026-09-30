import { describe, expect, test } from "vitest";
import { z } from "zod";

import { APP_CONFIG_TRANSPORT_SCHEMA } from "../../src/server/transport-schemas.js";
import { emptyAppConfigV2 } from "../../src/shared/config/defaults.js";
import { MATH_OPERATIONS } from "../../src/shared/config/enums.js";
import { normalizedBoundedText } from "../../src/shared/config/fields.js";
import {
  AppConfigV2Schema,
  ChildProfileV2Schema,
  PERSISTED_REFINEMENTS,
  type AppConfigV2,
} from "../../src/shared/config/schema.js";
import { transportShapeLines } from "../fixtures/config-shape.js";

/*
 * The persisted-shape fingerprint (DD3). Version 2 landed whole in
 * worksheet-first Step 15, and this literal snapshot pins its full accepted
 * value domain: every key path, `required` list, `enum` member, `const`,
 * numeric and item bound, `pattern`, `uniqueItems` and `additionalProperties:
 * false` of the composed transport JSON Schema; the sorted names of every
 * refinement on a persisted object; and, because the text bounds live only in
 * Zod, the outcome of parsing each text field at its maximum and at maximum +
 * 1 code points. It must pass unchanged at every later step: a change to any
 * accepted key or value needs schemaVersion 3 with a v2 read path
 * (`CONTRIBUTING.md`, "Persisted shape"). The snapshot pins refinement NAMES,
 * not their logic, so a refinement added without registering it, or a change
 * inside a named one, is left to review.
 */

const SHAPE_CHANGE_MESSAGE =
  "Changing the persisted config shape requires schemaVersion 3 with a v2 read path";

interface PersistedShapeFingerprint {
  readonly transport: readonly string[];
  readonly refinements: readonly string[];
  readonly textBounds: readonly string[];
}

const PINNED_FINGERPRINT: PersistedShapeFingerprint = {
  transport: [
    "$ type=object additionalProperties=false required=[\"defaults\",\"profiles\",\"schemaVersion\"]",
    "$.defaults type=object additionalProperties=false required=[\"countCompareMake\",\"dryMath\",\"findTheWow\",\"includeAnswerKey\",\"includeDecorativeGraphics\",\"length\",\"paperSize\",\"printScale\",\"sentenceBuilder\",\"theme\",\"useDisplayName\",\"useEarlierChildSettings\",\"useInterests\",\"worksheetType\"]",
    "$.defaults.countCompareMake type=object additionalProperties=false required=[\"compareMax\",\"countingMax\",\"numeralMax\"]",
    "$.defaults.countCompareMake.compareMax type=integer minimum=1 maximum=20",
    "$.defaults.countCompareMake.countingMax type=integer minimum=1 maximum=20",
    "$.defaults.countCompareMake.numeralMax type=integer minimum=1 maximum=20",
    "$.defaults.dryMath type=object additionalProperties=false required=[\"operandMax\",\"operations\",\"resultMax\"]",
    "$.defaults.dryMath.operandMax type=integer minimum=1 maximum=100",
    "$.defaults.dryMath.operations type=array minItems=1 maxItems=2 uniqueItems=true",
    "$.defaults.dryMath.operations[] enum=[\"addition\",\"subtraction\"]",
    "$.defaults.dryMath.resultMax type=integer minimum=1 maximum=100",
    "$.defaults.findTheWow type=object additionalProperties=false required=[\"equation\",\"quantity\",\"variant\"]",
    "$.defaults.findTheWow.equation type=object additionalProperties=false required=[\"operandMax\",\"operations\",\"resultMax\"]",
    "$.defaults.findTheWow.equation.operandMax type=integer minimum=1 maximum=20",
    "$.defaults.findTheWow.equation.operations type=array minItems=1 maxItems=2 uniqueItems=true",
    "$.defaults.findTheWow.equation.operations[] enum=[\"addition\",\"subtraction\"]",
    "$.defaults.findTheWow.equation.resultMax type=integer minimum=1 maximum=20",
    "$.defaults.findTheWow.quantity type=object additionalProperties=false required=[\"countingMax\",\"numeralMax\"]",
    "$.defaults.findTheWow.quantity.countingMax type=integer minimum=1 maximum=20",
    "$.defaults.findTheWow.quantity.numeralMax type=integer minimum=1 maximum=20",
    "$.defaults.findTheWow.variant enum=[\"quantity\",\"equation\"]",
    "$.defaults.includeAnswerKey type=boolean",
    "$.defaults.includeDecorativeGraphics type=boolean",
    "$.defaults.length enum=[\"short\",\"standard\",\"long\"]",
    "$.defaults.paperSize enum=[\"letter\",\"a4\"]",
    "$.defaults.printScale enum=[\"standard\",\"large\"]",
    "$.defaults.sentenceBuilder type=object additionalProperties=false required=[\"variant\",\"vocabulary\"]",
    "$.defaults.sentenceBuilder.variant enum=[\"draw-and-tell\",\"label\",\"copy-with-model\",\"sentence-frame\",\"independent\"]",
    "$.defaults.sentenceBuilder.vocabulary enum=[\"simpler-words\",\"all-words\"]",
    "$.defaults.theme enum=[\"from-interests\",\"animals\",\"space\",\"nature\",\"sports\",\"vehicles\",\"neutral\"]",
    "$.defaults.useDisplayName type=boolean",
    "$.defaults.useEarlierChildSettings type=boolean",
    "$.defaults.useInterests type=boolean",
    "$.defaults.worksheetType enum=[\"dry-math\",\"find-the-wow\",\"sentence-builder\",\"count-compare-make\"]",
    "$.profiles type=array",
    "$.profiles[] type=object additionalProperties=false required=[\"id\",\"interests\",\"reviewedOn\"]",
    "$.profiles[].displayName type=string",
    "$.profiles[].id type=string pattern=\"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$\"",
    "$.profiles[].interests type=array maxItems=5",
    "$.profiles[].interests[] type=string",
    "$.profiles[].legacyChoices type=object additionalProperties=false required=[\"mathSkills\",\"presentationBand\",\"writingMode\"]",
    "$.profiles[].legacyChoices.mathSkills type=object additionalProperties=false required=[\"allowNegativeResults\",\"allowRegrouping\",\"compareMax\",\"countingMax\",\"numeralMax\",\"operandMax\",\"operations\",\"representations\",\"resultMax\",\"understandsEquality\"] allOf=[{\"if\":{\"properties\":{\"operations\":{\"type\":\"array\",\"maxItems\":0}},\"required\":[\"operations\"]},\"then\":{\"properties\":{\"operandMax\":{\"const\":0},\"resultMax\":{\"const\":0}}},\"else\":{\"properties\":{\"operandMax\":{\"type\":\"integer\",\"minimum\":1},\"resultMax\":{\"type\":\"integer\",\"minimum\":1}}}}]",
    "$.profiles[].legacyChoices.mathSkills.allowNegativeResults type=boolean",
    "$.profiles[].legacyChoices.mathSkills.allowRegrouping type=boolean",
    "$.profiles[].legacyChoices.mathSkills.compareMax type=integer minimum=1 maximum=1000",
    "$.profiles[].legacyChoices.mathSkills.countingMax type=integer minimum=1 maximum=1000",
    "$.profiles[].legacyChoices.mathSkills.numeralMax type=integer minimum=1 maximum=1000",
    "$.profiles[].legacyChoices.mathSkills.operandMax type=integer minimum=0 maximum=1000",
    "$.profiles[].legacyChoices.mathSkills.operations type=array maxItems=2 uniqueItems=true",
    "$.profiles[].legacyChoices.mathSkills.operations[] enum=[\"addition\",\"subtraction\"]",
    "$.profiles[].legacyChoices.mathSkills.representations type=array minItems=1 maxItems=2 uniqueItems=true",
    "$.profiles[].legacyChoices.mathSkills.representations[] enum=[\"quantities\",\"equations\"]",
    "$.profiles[].legacyChoices.mathSkills.resultMax type=integer minimum=0 maximum=1000",
    "$.profiles[].legacyChoices.mathSkills.understandsEquality type=boolean",
    "$.profiles[].legacyChoices.presentationBand enum=[\"preschool\",\"early-primary\"]",
    "$.profiles[].legacyChoices.writingMode enum=[\"draw-and-tell\",\"label\",\"copy-with-model\",\"sentence-frame\",\"independent\"]",
    "$.profiles[].reviewedOn type=string pattern=\"^\\\\d{4}-\\\\d{2}-\\\\d{2}$\"",
    "$.schemaVersion const=2",
  ],
  refinements: [
    "config.profiles.unique-ids",
    "profile.displayName.normalized-length",
    "profile.interests.item.normalized-length",
    "profile.interests.unique-ignoring-case",
    "profile.legacyChoices.mathSkills.limits-match-operations",
    "profile.legacyChoices.mathSkills.operations.canonical-order",
    "profile.legacyChoices.mathSkills.representations.canonical-order",
    "profile.reviewedOn.calendar-date",
    "worksheet.arithmetic-focus.operations.canonical-order",
  ],
  textBounds: [
    "profiles[].displayName 40 code points padded with spaces: accepted",
    "profiles[].displayName 40 code points: accepted",
    "profiles[].displayName 41 code points: rejected",
    "profiles[].interests[] 32 code points padded with spaces: accepted",
    "profiles[].interests[] 32 code points: accepted",
    "profiles[].interests[] 33 code points: rejected",
  ],
};

/** A multi-byte character, so a byte count and a code-point count differ. */
const text = (length: number): string => "界".repeat(length);

function baseConfig(): AppConfigV2 {
  return {
    ...emptyAppConfigV2(),
    profiles: [
      {
        id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
        displayName: "Fictional Kit",
        reviewedOn: "2026-08-22",
        interests: ["space"],
      },
    ],
  };
}

type ConfigParser = (input: unknown) => boolean;

const currentParser: ConfigParser = (input) => AppConfigV2Schema.safeParse(input).success;

function textBoundOutcomes(parse: ConfigParser): readonly string[] {
  const outcome = (accepted: boolean): string => (accepted ? "accepted" : "rejected");
  const withName = (displayName: string): unknown => {
    const config = baseConfig();
    config.profiles[0]!.displayName = displayName;
    return config;
  };
  const withInterest = (interest: string): unknown => {
    const config = baseConfig();
    config.profiles[0]!.interests = [interest];
    return config;
  };
  return [
    `profiles[].displayName 40 code points: ${outcome(parse(withName(text(40))))}`,
    `profiles[].displayName 40 code points padded with spaces: ${outcome(parse(withName(`  ${text(40)}  `)))}`,
    `profiles[].displayName 41 code points: ${outcome(parse(withName(text(41))))}`,
    `profiles[].interests[] 32 code points: ${outcome(parse(withInterest(text(32))))}`,
    `profiles[].interests[] 32 code points padded with spaces: ${outcome(parse(withInterest(` ${text(32)} `)))}`,
    `profiles[].interests[] 33 code points: ${outcome(parse(withInterest(text(33))))}`,
  ].sort();
}

function fingerprintOf(
  transportSchema: unknown,
  refinements: readonly string[],
  parse: ConfigParser,
): PersistedShapeFingerprint {
  return {
    transport: transportShapeLines(transportSchema),
    refinements: [...refinements].sort(),
    textBounds: textBoundOutcomes(parse),
  };
}

/** The one comparison, whose failure names the rule a shape change must follow. */
function assertPersistedShape(actual: PersistedShapeFingerprint): void {
  const differences = (["transport", "refinements", "textBounds"] as const).flatMap((part) => {
    const pinned = new Set(PINNED_FINGERPRINT[part]);
    const seen = new Set(actual[part]);
    return [
      ...actual[part].filter((line) => !pinned.has(line)).map((line) => `+ ${part}: ${line}`),
      ...PINNED_FINGERPRINT[part].filter((line) => !seen.has(line)).map((line) => `- ${part}: ${line}`),
    ];
  });
  if (differences.length > 0) {
    throw new Error(`${SHAPE_CHANGE_MESSAGE}.\n${differences.join("\n")}`);
  }
}

type SchemaRecord = { [key: string]: SchemaRecord };

/** A deep copy of the transport schema with one edit applied. */
function editedTransport(edit: (schema: SchemaRecord) => void): unknown {
  const copy = structuredClone(APP_CONFIG_TRANSPORT_SCHEMA) as unknown as SchemaRecord;
  edit(copy);
  return copy;
}

/** Widens every `enum` equal to the operation list, wherever it appears. */
function widenOperations(node: unknown): void {
  if (typeof node !== "object" || node === null) {
    return;
  }
  const record = node as Record<string, unknown>;
  if (
    Array.isArray(record.enum) &&
    JSON.stringify(record.enum) === JSON.stringify(MATH_OPERATIONS)
  ) {
    record.enum = [...MATH_OPERATIONS, "multiplication"];
  }
  for (const child of Object.values(record)) {
    widenOperations(child);
  }
}

describe("the persisted config shape fingerprint", () => {
  test("the current version 2 shape equals the pinned snapshot", () => {
    const actual = fingerprintOf(APP_CONFIG_TRANSPORT_SCHEMA, PERSISTED_REFINEMENTS, currentParser);
    expect(() => assertPersistedShape(actual)).not.toThrow();
    expect(actual).toEqual(PINNED_FINGERPRINT);
  });

  test("every registered refinement names a live check on a persisted object", () => {
    const refused = (mutate: (config: AppConfigV2) => void): boolean => {
      const config = baseConfig();
      config.profiles[0]!.legacyChoices = {
        presentationBand: "preschool",
        writingMode: "label",
        mathSkills: {
          countingMax: 10,
          numeralMax: 10,
          compareMax: 10,
          representations: ["quantities", "equations"],
          understandsEquality: false,
          operations: ["addition", "subtraction"],
          operandMax: 5,
          resultMax: 5,
          allowRegrouping: false,
          allowNegativeResults: false,
        },
      };
      expect(AppConfigV2Schema.safeParse(config).success).toBe(true);
      mutate(config);
      const parsed = AppConfigV2Schema.safeParse(config);
      return !parsed.success && parsed.error.issues.some(({ code }) => code === "custom");
    };
    const violations: Readonly<Record<string, (config: AppConfigV2) => void>> = {
      "config.profiles.unique-ids": (config) => {
        config.profiles.push({ ...config.profiles[0]! });
      },
      "profile.displayName.normalized-length": (config) => {
        config.profiles[0]!.displayName = text(41);
      },
      "profile.interests.item.normalized-length": (config) => {
        config.profiles[0]!.interests = ["   "];
      },
      "profile.interests.unique-ignoring-case": (config) => {
        config.profiles[0]!.interests = ["Space", "space"];
      },
      "profile.legacyChoices.mathSkills.limits-match-operations": (config) => {
        config.profiles[0]!.legacyChoices!.mathSkills.operations = [];
      },
      "profile.legacyChoices.mathSkills.operations.canonical-order": (config) => {
        config.profiles[0]!.legacyChoices!.mathSkills.operations = ["subtraction", "addition"];
      },
      "profile.legacyChoices.mathSkills.representations.canonical-order": (config) => {
        config.profiles[0]!.legacyChoices!.mathSkills.representations = ["equations", "quantities"];
      },
      "profile.reviewedOn.calendar-date": (config) => {
        config.profiles[0]!.reviewedOn = "2026-02-30";
      },
      "worksheet.arithmetic-focus.operations.canonical-order": (config) => {
        config.defaults.dryMath.operations = ["subtraction", "addition"];
      },
    };
    expect(Object.keys(violations).sort()).toEqual([...PERSISTED_REFINEMENTS].sort());
    for (const [name, mutate] of Object.entries(violations)) {
      expect(refused(mutate), name).toBe(true);
    }
  });

  test.each([
    [
      "one extra key",
      "+ transport: $.defaults.syntheticExtraKey",
      () => fingerprintOf(
        editedTransport((schema) => {
          schema.properties!.defaults!.properties!.syntheticExtraKey = { type: {} } as SchemaRecord;
        }),
        PERSISTED_REFINEMENTS,
        currentParser,
      ),
    ],
    [
      "one extra MATH_OPERATIONS member",
      "multiplication",
      () => fingerprintOf(editedTransport(widenOperations), PERSISTED_REFINEMENTS, currentParser),
    ],
    [
      "one moved maximum",
      "+ transport: $.defaults.dryMath.operandMax type=integer minimum=1 maximum=99",
      () => fingerprintOf(
        editedTransport((schema) => {
          (schema.properties!.defaults!.properties!.dryMath!.properties!.operandMax as unknown as {
            maximum: number;
          }).maximum = 99;
        }),
        PERSISTED_REFINEMENTS,
        currentParser,
      ),
    ],
    [
      "one added refinement name",
      "+ refinements: profile.synthetic.added-refinement",
      () => fingerprintOf(
        APP_CONFIG_TRANSPORT_SCHEMA,
        [...PERSISTED_REFINEMENTS, "profile.synthetic.added-refinement"],
        currentParser,
      ),
    ],
    [
      "a displayName bound of 41 code points",
      "+ textBounds: profiles[].displayName 41 code points: accepted",
      () => {
        const widenedProfile = ChildProfileV2Schema.extend({
          displayName: normalizedBoundedText(41).optional(),
        });
        const widened = z.strictObject({
          ...AppConfigV2Schema.shape,
          profiles: z.array(widenedProfile),
        });
        return fingerprintOf(
          APP_CONFIG_TRANSPORT_SCHEMA,
          PERSISTED_REFINEMENTS,
          (input) => widened.safeParse(input).success,
        );
      },
    ],
  ] as const)("calibration: %s fails with the version-bump rule", (_label, difference, variant) => {
    expect(() => assertPersistedShape(variant())).toThrow(SHAPE_CHANGE_MESSAGE);
    expect(() => assertPersistedShape(variant())).toThrow(difference);
  });
});
