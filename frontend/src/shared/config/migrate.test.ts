import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  emptyAppConfigV2,
  themeFromInterests,
} from "./defaults.js";
import {
  MATH_OPERATIONS,
  PAPER_SIZES,
  PRESENTATION_BANDS,
  PRINT_SCALES,
  REPRESENTATIONS,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
} from "./enums.js";
import {
  AppConfigV1Schema,
  DIFFICULTIES,
  type AppConfigV1,
  type ChildProfileV1,
} from "./legacy-v1.js";
import { MATH_PRESETS } from "./math-presets.js";
import {
  CONFIG_MIGRATIONS,
  classifyStoredConfig,
  migrateConfigV1ToV2,
  type ConfigMigrationReport,
} from "./migrate.js";
import {
  APP_CONFIG_SCHEMA_VERSION,
  AppConfigV2Schema,
  type AppConfigV2,
} from "./schema.js";

/*
 * The in-memory v1 -> v2 upgrade (plan Appendix B.1) and the store's only
 * classifier. Every record here is fictional and built at runtime; the digest
 * pins over the committed v1 fixture live in
 * `tests/integration/migrate-fixture.test.ts`, because this project compiles
 * without Node types.
 */

const LAYOUT_FIELDS = [
  "useDisplayName",
  "useInterests",
  "includeDecorativeGraphics",
  "length",
  "includeAnswerKey",
  "paperSize",
  "printScale",
] as const;

const reviewedOnArbitrary = fc
  .date({
    min: new Date("2020-01-01T00:00:00.000Z"),
    max: new Date("2030-12-31T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((date) => date.toISOString().slice(0, 10));

const mathSkillsArbitrary = fc
  .record({
    countingMax: fc.integer({ min: 1, max: 1_000 }),
    numeralMax: fc.integer({ min: 1, max: 1_000 }),
    compareMax: fc.integer({ min: 1, max: 1_000 }),
    representations: fc.subarray([...REPRESENTATIONS], { minLength: 1 }),
    understandsEquality: fc.boolean(),
    operations: fc.subarray([...MATH_OPERATIONS]),
    operandMax: fc.integer({ min: 1, max: 1_000 }),
    resultMax: fc.integer({ min: 1, max: 1_000 }),
    allowRegrouping: fc.boolean(),
    allowNegativeResults: fc.boolean(),
  })
  .map((skills) =>
    skills.operations.length === 0
      ? { ...skills, operandMax: 0, resultMax: 0 }
      : skills,
  );

const interestArbitrary = fc.constantFrom(
  "animals",
  "Space",
  "nature",
  "trains",
  "Dinosaurs",
  "music",
  "  sports  ",
);

const profileArbitrary = fc.record(
  {
    id: fc.uuid({ version: 4 }),
    displayName: fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,30}[A-Za-z]$/u),
    ageYears: fc.integer({ min: 4, max: 18 }),
    presentationBand: fc.constantFrom(...PRESENTATION_BANDS),
    reviewedOn: reviewedOnArbitrary,
    mathSkills: mathSkillsArbitrary,
    writingMode: fc.constantFrom(...WRITING_MODES),
    interests: fc.uniqueArray(interestArbitrary, {
      maxLength: 5,
      selector: (interest) => interest.trim().toLowerCase(),
    }),
  },
  { requiredKeys: ["id", "ageYears", "presentationBand", "reviewedOn", "mathSkills", "writingMode", "interests"] },
);

const v1ConfigArbitrary = fc.record({
  schemaVersion: fc.constant(1 as const),
  profiles: fc.uniqueArray(profileArbitrary, {
    maxLength: 5,
    selector: (profile) => profile.id,
  }),
  defaults: fc.record({
    useDisplayName: fc.boolean(),
    useInterests: fc.boolean(),
    includeDecorativeGraphics: fc.boolean(),
    difficulty: fc.constantFrom(...DIFFICULTIES),
    length: fc.constantFrom(...WORKSHEET_LENGTHS),
    includeAnswerKey: fc.boolean(),
    paperSize: fc.constantFrom(...PAPER_SIZES),
    printScale: fc.constantFrom(...PRINT_SCALES),
  }),
});

function fictionalProfile(index: number, overrides: Partial<ChildProfileV1> = {}): ChildProfileV1 {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    displayName: `Fictional ${index}`,
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 1_000,
      numeralMax: 25,
      compareMax: 3,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 1_000,
      resultMax: 7,
      allowRegrouping: true,
      allowNegativeResults: true,
    },
    writingMode: "copy-with-model",
    interests: ["trains", "Space"],
    ...overrides,
  };
}

function fictionalV1(profiles: readonly ChildProfileV1[]): AppConfigV1 {
  return {
    schemaVersion: 1,
    profiles: [...profiles],
    defaults: {
      useDisplayName: false,
      useInterests: false,
      includeDecorativeGraphics: true,
      difficulty: "stretch",
      length: "long",
      includeAnswerKey: false,
      paperSize: "a4",
      printScale: "large",
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function expectLegacy(input: unknown): {
  readonly config: AppConfigV2;
  readonly report: ConfigMigrationReport;
} {
  const classified = classifyStoredConfig(input);
  if (classified.kind !== "legacy") {
    throw new Error(`Expected a legacy classification, got ${classified.kind}.`);
  }
  expect(classified.fromVersion).toBe(1);
  return classified;
}

describe("the v1 -> v2 migration over generated v1 configs", () => {
  test("classifies at least 200 valid v1 configs as legacy with a v2 output that keeps every carried value", () => {
    let runs = 0;
    fc.assert(
      fc.property(v1ConfigArbitrary, (generated) => {
        runs += 1;
        const stored = AppConfigV1Schema.parse(generated);
        const { config, report } = expectLegacy(generated);

        expect(AppConfigV2Schema.safeParse(config).success).toBe(true);
        expect(config.schemaVersion).toBe(APP_CONFIG_SCHEMA_VERSION);

        // Order, ids and identity fields are kept exactly.
        expect(config.profiles.map(({ id }) => id)).toEqual(
          stored.profiles.map(({ id }) => id),
        );
        config.profiles.forEach((profile, index) => {
          const source = stored.profiles[index]!;
          expect(profile.displayName).toBe(source.displayName);
          expect(profile.reviewedOn).toBe(source.reviewedOn);
          expect(profile.interests).toEqual(source.interests);
          // Earlier settings verbatim, including maxima up to 1,000 and both
          // stored-but-unused permission flags.
          expect(profile.legacyChoices).toEqual({
            presentationBand: source.presentationBand,
            writingMode: source.writingMode,
            mathSkills: source.mathSkills,
          });
          // Age is dropped, and nothing else is added to a profile.
          expect(Object.keys(profile).sort()).toEqual(
            [
              "id",
              ...(source.displayName === undefined ? [] : ["displayName"]),
              "reviewedOn",
              "interests",
              "legacyChoices",
            ].sort(),
          );
          expect(profile).not.toHaveProperty("ageYears");
        });

        // The seven layout fields keep their names; difficulty is dropped.
        for (const field of LAYOUT_FIELDS) {
          expect(config.defaults[field]).toBe(stored.defaults[field]);
        }
        expect(config.defaults).not.toHaveProperty("difficulty");
        expect(config.defaults.theme).toBe(
          stored.defaults.useInterests ? "from-interests" : "neutral",
        );
        expect(config.defaults.useEarlierChildSettings).toBe(
          stored.profiles.length > 0,
        );

        expect(report).toEqual({
          fromVersion: 1,
          toVersion: 2,
          profilesUpgraded: stored.profiles.length,
          legacyChoicesCarried: stored.profiles.length,
          backupWritten: false,
        });
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
  });

  test("every other new field comes from the built-in defaults", () => {
    const { config } = expectLegacy(fictionalV1([fictionalProfile(1)]));
    const carried = new Set<string>([...LAYOUT_FIELDS, "theme", "useEarlierChildSettings"]);
    for (const [key, value] of Object.entries(DEFAULT_WORKSHEET_DEFAULTS_V2)) {
      if (!carried.has(key)) {
        expect(config.defaults[key as keyof AppConfigV2["defaults"]], key).toEqual(value);
      }
    }
    expect(Object.keys(config.defaults).sort()).toEqual(
      Object.keys(DEFAULT_WORKSHEET_DEFAULTS_V2).sort(),
    );
  });

  test("the classifier returns the migration output parsed by the v2 schema", () => {
    const input = fictionalV1([fictionalProfile(1), fictionalProfile(2)]);
    const { config } = expectLegacy(input);
    expect(config).toEqual(AppConfigV2Schema.parse(migrateConfigV1ToV2(AppConfigV1Schema.parse(input))));
    expect(CONFIG_MIGRATIONS[1]).toBe(migrateConfigV1ToV2);
  });

  test("an empty v1 file upgrades with seeding off and a zero-count report", () => {
    const { config, report } = expectLegacy(fictionalV1([]));
    expect(config.profiles).toEqual([]);
    expect(config.defaults.useEarlierChildSettings).toBe(false);
    expect(report).toEqual({
      fromVersion: 1,
      toVersion: 2,
      profilesUpgraded: 0,
      legacyChoicesCarried: 0,
      backupWritten: false,
    });
    for (const value of Object.values(report)) {
      expect(["number", "boolean"]).toContain(typeof value);
    }
  });

  test("a profile without a nickname stays without one", () => {
    const { displayName: _unused, ...unnamed } = fictionalProfile(3);
    void _unused;
    const { config } = expectLegacy(fictionalV1([unnamed]));
    expect(config.profiles[0]).not.toHaveProperty("displayName");
  });

  test("interests on, the theme follows interests; interests off, it is neutral", () => {
    const on = fictionalV1([fictionalProfile(1)]);
    on.defaults.useInterests = true;
    expect(expectLegacy(on).config.defaults.theme).toBe("from-interests");
    const off = fictionalV1([fictionalProfile(1)]);
    off.defaults.useInterests = false;
    expect(expectLegacy(off).config.defaults.theme).toBe("neutral");
    expect(themeFromInterests(true)).toBe("from-interests");
    expect(themeFromInterests(false)).toBe("neutral");
  });

  test("a deep-frozen input is not mutated", () => {
    const input = deepFreeze(fictionalV1([fictionalProfile(1), fictionalProfile(2)]));
    const snapshot = JSON.stringify(input);
    const { config } = expectLegacy(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    const migrated = migrateConfigV1ToV2(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    // The output shares no array with the frozen input.
    migrated.profiles[0]!.interests.push("new");
    migrated.profiles[0]!.legacyChoices!.mathSkills.operations.pop();
    config.defaults.dryMath.operations.pop();
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("a valid v2 input is returned unchanged as current", () => {
    const { config: upgraded } = expectLegacy(fictionalV1([fictionalProfile(1)]));
    const current = deepFreeze(structuredCloneJson(upgraded));
    const classified = classifyStoredConfig(current);
    expect(classified).toEqual({ kind: "current", config: current });
  });
});

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("stored-version classification", () => {
  const v1 = fictionalV1([fictionalProfile(1)]);
  const v2 = migrateConfigV1ToV2(AppConfigV1Schema.parse(v1));

  test.each([3, 99])("integer schemaVersion %i classifies as future", (schemaVersion) => {
    expect(classifyStoredConfig({ ...v2, schemaVersion })).toEqual({ kind: "future" });
    expect(classifyStoredConfig({ schemaVersion })).toEqual({ kind: "future" });
  });

  test.each([
    ["schemaVersion 1.5", { ...v2, schemaVersion: 1.5 }],
    ["the string \"2\"", { ...v2, schemaVersion: "2" }],
    ["a missing version", (() => {
      const { schemaVersion: _unused, ...rest } = v2;
      void _unused;
      return rest;
    })()],
    ["an array", [v2]],
    ["null", null],
    ["a v1 body labelled 2", { ...v1, schemaVersion: 2 }],
    ["a v2 body labelled 1", { ...v2, schemaVersion: 1 }],
    ["schemaVersion 0", { ...v2, schemaVersion: 0 }],
  ] as const)("%s classifies as invalid", (_label, value) => {
    expect(classifyStoredConfig(value)).toEqual({ kind: "invalid" });
  });

  test("a schema-invalid v1 file is invalid, never migrated", () => {
    const broken = structuredCloneJson(v1) as unknown as { profiles: Record<string, unknown>[] };
    broken.profiles[0]!.ageYears = 19;
    expect(classifyStoredConfig(broken)).toEqual({ kind: "invalid" });
  });
});

/*
 * A current-version file a newer build wrote after adding a key or a value-list
 * member at the same version. Each input is a runtime copy of a valid v2
 * config with one edit, so the edit alone decides the result.
 */
describe("the blocked classification of additive current-version changes", () => {
  type Editable = {
    [key: string]: unknown;
    profiles: Record<string, unknown>[];
    defaults: Record<string, unknown> & {
      dryMath: Record<string, unknown> & { operations: unknown[] };
    };
  };
  const base = migrateConfigV1ToV2(
    AppConfigV1Schema.parse(fictionalV1([fictionalProfile(1), fictionalProfile(2)])),
  );
  const edited = (edit: (config: Editable) => void): unknown => {
    const copy = structuredCloneJson(base) as unknown as Editable;
    edit(copy);
    return copy;
  };

  test("the unedited copy is current, so each edit below is the only change", () => {
    expect(classifyStoredConfig(edited(() => undefined)).kind).toBe("current");
  });

  test.each([
    ["an unknown top-level key", (config: Editable) => {
      config.packets = [];
    }],
    ["an unknown profile key", (config: Editable) => {
      config.profiles[1]!.favoriteColor = "green";
    }],
    ["an unknown key inside a profile's earlier math values", (config: Editable) => {
      const legacy = config.profiles[0]!.legacyChoices as { mathSkills: Record<string, unknown> };
      legacy.mathSkills.allowRemainders = false;
    }],
    ["an unknown enum member in defaults", (config: Editable) => {
      config.defaults.worksheetType = "number-bonds";
    }],
    ["an unknown enum member inside a defaults array", (config: Editable) => {
      config.defaults.dryMath.operations = ["addition", "multiplication"];
    }],
    ["an unknown key beside an unknown member", (config: Editable) => {
      config.defaults.numberBonds = { wholeMax: 10 };
      config.defaults.worksheetType = "number-bonds";
    }],
  ] as const)("%s classifies as blocked", (_label, edit) => {
    expect(classifyStoredConfig(edited(edit))).toEqual({ kind: "blocked" });
  });

  test.each([
    ["a wrong type for a known key", (config: Editable) => {
      config.defaults.useInterests = "yes";
    }],
    ["a number where a value-list member belongs", (config: Editable) => {
      config.defaults.worksheetType = 5;
    }],
    ["a missing required key", (config: Editable) => {
      delete config.defaults.theme;
    }],
    ["a value above a known bound", (config: Editable) => {
      config.defaults.dryMath = { operations: ["addition"], operandMax: 101, resultMax: 10 };
    }],
    ["an unknown key beside a wrong type", (config: Editable) => {
      config.packets = [];
      config.defaults.useInterests = "yes";
    }],
    ["an unknown key beside a failing field refinement", (config: Editable) => {
      config.profiles[0]!.favoriteColor = "green";
      config.profiles[0]!.reviewedOn = "2026-02-30";
    }],
    ["an unknown member that fills an operations array past its cap", (config: Editable) => {
      config.defaults.dryMath.operations = ["addition", "subtraction", "multiplication"];
    }],
    ["an unknown top-level key hiding duplicate profile ids", (config: Editable) => {
      config.packets = [];
      config.profiles[1]!.id = config.profiles[0]!.id;
    }],
  ] as const)("%s still classifies as invalid", (_label, edit) => {
    expect(classifyStoredConfig(edited(edit))).toEqual({ kind: "invalid" });
  });

  test("mirror: duplicate profile ids alone are invalid, and an unknown key alone is blocked", () => {
    expect(classifyStoredConfig(edited((config) => {
      config.profiles[1]!.id = config.profiles[0]!.id;
    }))).toEqual({ kind: "invalid" });
    expect(classifyStoredConfig(edited((config) => {
      config.packets = [];
    }))).toEqual({ kind: "blocked" });
  });

  test("an unknown key or member at version 1 stays invalid, never blocked", () => {
    const withKey = structuredCloneJson(v1ForBlocked()) as unknown as Record<string, unknown>;
    withKey.packets = [];
    expect(classifyStoredConfig(withKey)).toEqual({ kind: "invalid" });
    const withMember = structuredCloneJson(v1ForBlocked()) as unknown as {
      defaults: Record<string, unknown>;
    };
    withMember.defaults.difficulty = "extra-stretch";
    expect(classifyStoredConfig(withMember)).toEqual({ kind: "invalid" });
  });
});

function v1ForBlocked(): AppConfigV1 {
  return fictionalV1([fictionalProfile(3)]);
}

describe("the built-in version 2 defaults", () => {
  test("take every practice focus from MATH_PRESETS", () => {
    const within10 = MATH_PRESETS["early-primary-within-10"].mathSkills;
    const quantities = MATH_PRESETS["quantities-to-10"].mathSkills;
    expect(DEFAULT_WORKSHEET_DEFAULTS_V2).toEqual({
      worksheetType: "dry-math",
      dryMath: {
        operations: [...within10.operations],
        operandMax: within10.operandMax,
        resultMax: within10.resultMax,
      },
      findTheWow: {
        variant: "quantity",
        quantity: { countingMax: quantities.countingMax, numeralMax: quantities.numeralMax },
        equation: {
          operations: [...within10.operations],
          operandMax: within10.operandMax,
          resultMax: within10.resultMax,
        },
      },
      sentenceBuilder: { variant: "label", vocabulary: "simpler-words" },
      countCompareMake: {
        countingMax: quantities.countingMax,
        numeralMax: quantities.numeralMax,
        compareMax: quantities.compareMax,
      },
      theme: "from-interests",
      useDisplayName: true,
      useInterests: true,
      includeDecorativeGraphics: true,
      includeAnswerKey: true,
      length: "standard",
      paperSize: "letter",
      printScale: "standard",
      useEarlierChildSettings: false,
    });
    expect(Object.isFrozen(DEFAULT_WORKSHEET_DEFAULTS_V2)).toBe(true);
    expect(Object.isFrozen(DEFAULT_WORKSHEET_DEFAULTS_V2.dryMath.operations)).toBe(true);
  });

  test("emptyAppConfigV2 is a valid, fresh copy on every call", () => {
    const first = emptyAppConfigV2();
    expect(AppConfigV2Schema.parse(first)).toEqual(first);
    expect(first).toEqual({
      schemaVersion: 2,
      profiles: [],
      defaults: DEFAULT_WORKSHEET_DEFAULTS_V2,
    });
    first.defaults.dryMath.operations.pop();
    first.defaults.findTheWow.quantity.countingMax = 1;
    first.profiles.push(migrateConfigV1ToV2(fictionalV1([fictionalProfile(1)])).profiles[0]!);
    expect(emptyAppConfigV2()).toEqual({
      schemaVersion: 2,
      profiles: [],
      defaults: DEFAULT_WORKSHEET_DEFAULTS_V2,
    });
  });
});
