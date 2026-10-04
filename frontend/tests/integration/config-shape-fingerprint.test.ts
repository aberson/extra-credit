import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  APP_CONFIG_TRANSPORT_SCHEMA,
  strictObjectSchema,
} from "../../src/server/transport-schemas.js";
import { emptyAppConfigV2 } from "../../src/shared/config/defaults.js";
import { MATH_OPERATIONS } from "../../src/shared/config/enums.js";
import {
  AppConfigV2Schema,
  PERSISTED_REFINEMENTS,
  WorksheetDefaultsV2Schema,
  type AppConfigV2,
} from "../../src/shared/config/schema.js";
import { transportShapeLines } from "../fixtures/config-shape.js";

/*
 * The persisted-shape fingerprint (DD3), additive-only since the blocked
 * classifier state. A build meeting a current-version file whose only
 * strict-parse failures are unknown keys or unknown value-list members
 * classifies it `blocked`, a non-destructive refusal. A newer build may
 * therefore add, at schemaVersion 2, a key that has a Zod default and that
 * `strictObjectSchema` in `transport-schemas.ts` lists as optional (so its
 * parent's `required` list is unchanged), or a member of a value list that no
 * array bound is derived from. A key without a Zod default is not additive:
 * this build classifies an older file that lacks it as `invalid`; on the
 * transport side the parent's `required` list must stay unchanged. Neither is
 * a member added to `MATH_OPERATIONS` or `REPRESENTATIONS`: the `operations`
 * and `representations` arrays are capped at those lists' lengths in both
 * schemas, so the new member also raises the array's `maxItems`, and an older
 * build meeting a full-length array reports it too big, which is `invalid`. Every non-additive change would make an
 * older build classify the file `invalid` and offer backup-and-replace, or
 * make this build refuse files an older build wrote, so it needs a new
 * version with a v2 read path (`CONTRIBUTING.md`, "Persisted shape").
 *
 * The pinned snapshot is the full accepted value domain at Step 15: every key
 * path of the composed transport JSON Schema with its constraints, the
 * registered refinement names, and the outcome of parsing each text field at
 * its maximum and one past it. `assertPersistedShape` requires every pinned
 * path to remain with identical constraints, except that a value list may
 * gain members; a path the snapshot does not list may appear; every pinned
 * refinement name must remain and a new one may appear; and every text-bound
 * outcome must stay the same. A new refinement name is accepted because a
 * refinement on a new optional key is additive; the snapshot pins names, not
 * logic, so a refinement added to an existing key, or a change inside a named
 * one, is left to review.
 */

const SHAPE_CHANGE_MESSAGE =
  "A persisted config change that is not additive requires schemaVersion 3 with a v2 read path. " +
  "Only a new key with a Zod default that strictObjectSchema lists as optional in transport-schemas.ts, " +
  "or a new member of a value list no array bound is derived from, is additive; a new required key is not";

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

/**
 * One transport line split into its key path and its constraints, keyed by
 * name. `transportShapeLines` writes `path name=value ...`, and every value
 * is either a bare word or JSON, so a space followed by `name=` starts the
 * next constraint.
 */
function parseTransportLine(line: string): {
  readonly path: string;
  readonly constraints: ReadonlyMap<string, string>;
} {
  const [path = "", ...parts] = line.split(/ (?=[A-Za-z]+=)/u);
  return {
    path,
    constraints: new Map(parts.map((part) => {
      const separator = part.indexOf("=");
      return [part.slice(0, separator), part.slice(separator + 1)] as const;
    })),
  };
}

/**
 * The transport differences that are not additive. A pinned path must remain
 * with the same set of constraints and the same value for each, except that
 * an `enum` may gain members as long as it keeps every pinned one. Paths the
 * snapshot does not list are additions; a new required key still shows up as
 * a changed `required` on its parent.
 */
function transportDifferences(actual: readonly string[]): string[] {
  const seen = new Map(actual.map((line) => {
    const parsed = parseTransportLine(line);
    return [parsed.path, parsed.constraints] as const;
  }));
  return PINNED_FINGERPRINT.transport.flatMap((line) => {
    const pinned = parseTransportLine(line);
    const current = seen.get(pinned.path);
    if (current === undefined) {
      return [`- transport: ${pinned.path} was removed`];
    }
    const names = [...new Set([...pinned.constraints.keys(), ...current.keys()])].sort();
    return names.flatMap((name) => {
      const before = pinned.constraints.get(name);
      const after = current.get(name);
      if (name === "enum" && before !== undefined && after !== undefined) {
        const members = new Set(JSON.parse(after) as unknown[]);
        return (JSON.parse(before) as unknown[])
          .filter((member) => !members.has(member))
          .map((member) => `- transport: ${pinned.path} enum member ${JSON.stringify(member)} was removed`);
      }
      return before === after
        ? []
        : [`~ transport: ${pinned.path} ${name} ${before ?? "(none)"} -> ${after ?? "(none)"}`];
    });
  });
}

/** The one comparison, whose failure names the rule a shape change must follow. */
function assertPersistedShape(actual: PersistedShapeFingerprint): void {
  const refinements = new Set(actual.refinements);
  const textBounds = new Set(actual.textBounds);
  const differences = [
    ...transportDifferences(actual.transport),
    ...PINNED_FINGERPRINT.refinements
      .filter((name) => !refinements.has(name))
      .map((name) => `- refinements: ${name}`),
    ...PINNED_FINGERPRINT.textBounds
      .filter((line) => !textBounds.has(line))
      .map((line) => `- textBounds: ${line}`),
    ...actual.textBounds
      .filter((line) => !PINNED_FINGERPRINT.textBounds.includes(line))
      .map((line) => `+ textBounds: ${line}`),
  ];
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

/**
 * Adds one member to every array whose items are the operation list, and
 * raises that array's `maxItems` with it, as the composer does: both schemas
 * cap `operations` at `MATH_OPERATIONS.length`.
 */
function widenOperations(node: unknown): void {
  if (typeof node !== "object" || node === null) {
    return;
  }
  const record = node as Record<string, unknown>;
  const items = record.items as { enum?: unknown } | undefined;
  if (
    record.type === "array" &&
    JSON.stringify(items?.enum) === JSON.stringify(MATH_OPERATIONS)
  ) {
    record.items = { ...items, enum: [...MATH_OPERATIONS, "multiplication"] };
    record.maxItems = MATH_OPERATIONS.length + 1;
  }
  for (const child of Object.values(record)) {
    widenOperations(child);
  }
}

/**
 * The transport schema with one boolean `defaults` key added through the
 * production composer, `strictObjectSchema`. The keys `defaults` already
 * leaves out of `required` stay optional; the new key is optional only when
 * `optionalNewKey` is true.
 */
function transportWithDefaultsKey(optionalNewKey: boolean): unknown {
  return editedTransport((schema) => {
    const defaults = schema.properties!.defaults! as unknown as {
      properties: Record<string, unknown>;
      required: readonly string[];
    };
    const alreadyOptional = Object.keys(defaults.properties).filter(
      (key) => !defaults.required.includes(key),
    );
    const properties: Record<string, unknown> = {
      ...defaults.properties,
      syntheticExtraKey: { type: "boolean" },
    };
    schema.properties!.defaults = strictObjectSchema(
      properties,
      optionalNewKey ? [...alreadyOptional, "syntheticExtraKey"] : alreadyOptional,
    ) as unknown as SchemaRecord;
  });
}

/** The v2 Zod schema with the same key added under a default. */
const parserWithDefaultedKey: ConfigParser = (input) =>
  z.strictObject({
    ...AppConfigV2Schema.shape,
    defaults: WorksheetDefaultsV2Schema.extend({
      syntheticExtraKey: z.boolean().default(false),
    }),
  }).safeParse(input).success;

describe("the persisted config shape fingerprint", () => {
  test("the current version 2 shape keeps everything the pinned snapshot accepts", () => {
    const actual = fingerprintOf(APP_CONFIG_TRANSPORT_SCHEMA, PERSISTED_REFINEMENTS, currentParser);
    expect(() => assertPersistedShape(actual)).not.toThrow();
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
      "worksheet.dry-math-facts.fact-families.ascending": (config) => {
        config.defaults.dryMathFacts.factFamilies = [5, 2];
      },
      "worksheet.dry-math-facts.operations.canonical-order": (config) => {
        config.defaults.dryMathFacts.operations = ["division", "multiplication"];
      },
    };
    expect(Object.keys(violations).sort()).toEqual([...PERSISTED_REFINEMENTS].sort());
    for (const [name, mutate] of Object.entries(violations)) {
      expect(refused(mutate), name).toBe(true);
    }
  });

  /*
   * Calibration. Each variant is a runtime copy of the transport schema, the
   * refinement list or the Zod parser with one edit; the pinned snapshot is
   * never edited.
   */
  test.each([
    [
      "one extra key with a Zod default, listed as optional by strictObjectSchema",
      () => fingerprintOf(
        transportWithDefaultsKey(true),
        PERSISTED_REFINEMENTS,
        parserWithDefaultedKey,
      ),
    ],
    [
      "one extra worksheet-type member",
      () => fingerprintOf(
        editedTransport((schema) => {
          const worksheetType = schema.properties!.defaults!.properties!.worksheetType as unknown as {
            enum: string[];
          };
          worksheetType.enum = [...worksheetType.enum, "synthetic-worksheet"];
        }),
        PERSISTED_REFINEMENTS,
        currentParser,
      ),
    ],
  ] as const)("calibration: %s is additive and passes", (_label, variant) => {
    const fingerprint = variant();
    expect(fingerprint).not.toEqual(PINNED_FINGERPRINT);
    expect(() => assertPersistedShape(fingerprint)).not.toThrow();
  });

  test.each([
    [
      "a removed key",
      "- transport: $.defaults.theme was removed",
      () => fingerprintOf(
        editedTransport((schema) => {
          const defaults = schema.properties!.defaults!;
          delete defaults.properties!.theme;
          (defaults as unknown as { required: string[] }).required = (
            defaults as unknown as { required: string[] }
          ).required.filter((key) => key !== "theme");
        }),
        PERSISTED_REFINEMENTS,
        currentParser,
      ),
    ],
    [
      "a removed enum member",
      '- transport: $.defaults.theme enum member "neutral" was removed',
      () => fingerprintOf(
        editedTransport((schema) => {
          const theme = schema.properties!.defaults!.properties!.theme as unknown as {
            enum: string[];
          };
          theme.enum = theme.enum.filter((member) => member !== "neutral");
        }),
        PERSISTED_REFINEMENTS,
        currentParser,
      ),
    ],
    [
      "a tightened bound",
      "~ transport: $.defaults.dryMath.operandMax maximum 100 -> 99",
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
      "the same extra key without strictObjectSchema's optional list",
      "~ transport: $.defaults required",
      () => fingerprintOf(transportWithDefaultsKey(false), PERSISTED_REFINEMENTS, parserWithDefaultedKey),
    ],
    [
      "one extra MATH_OPERATIONS member, which also raises the operations cap",
      "~ transport: $.defaults.dryMath.operations maxItems 2 -> 3",
      () => fingerprintOf(editedTransport(widenOperations), PERSISTED_REFINEMENTS, currentParser),
    ],
  ] as const)("calibration: %s fails with the version-bump rule", (_label, difference, variant) => {
    expect(() => assertPersistedShape(variant())).toThrow(SHAPE_CHANGE_MESSAGE);
    expect(() => assertPersistedShape(variant())).toThrow(difference);
  });
});
