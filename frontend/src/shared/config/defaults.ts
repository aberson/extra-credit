/**
 * The built-in worksheet defaults of schema version 2, and the one empty
 * config every path that starts from nothing uses: App's missing-file state,
 * the fill-ins of a v1 migration and the recovery replacement.
 *
 * Every practice focus is read from `MATH_PRESETS`, so this module adds no
 * numeric literal of its own.
 */
import { MATH_PRESETS } from "./math-presets.js";
import {
  APP_CONFIG_SCHEMA_VERSION,
  type AppConfigV2,
  type ArithmeticFocusV2,
  type ThemeChoice,
  type WorksheetDefaultsV2,
  type WorksheetSelectionV2,
} from "./schema.js";

type PresetId = keyof typeof MATH_PRESETS;

function arithmeticFocusFrom(presetId: PresetId): ArithmeticFocusV2 {
  const skills = MATH_PRESETS[presetId].mathSkills;
  if (skills === null) {
    throw new Error("An arithmetic focus needs a concrete math preset.");
  }
  return {
    operations: [...skills.operations],
    operandMax: skills.operandMax,
    resultMax: skills.resultMax,
  };
}

const QUANTITY_PRESET = MATH_PRESETS["quantities-to-10"].mathSkills;

/**
 * `DEFAULT_WORKSHEET_DEFAULTS_V2` (plan Appendix A): Dry Math first, the
 * arithmetic focus of early primary within 10, quantities to 10, Picture
 * Labels with simpler words, art from interests, and today's layout. A fresh
 * install starts with seeding off.
 */
export const DEFAULT_WORKSHEET_DEFAULTS_V2: Readonly<WorksheetDefaultsV2> =
  deepFreeze({
    worksheetType: "dry-math",
    dryMath: arithmeticFocusFrom("early-primary-within-10"),
    findTheWow: {
      variant: "quantity",
      quantity: {
        countingMax: QUANTITY_PRESET.countingMax,
        numeralMax: QUANTITY_PRESET.numeralMax,
      },
      equation: arithmeticFocusFrom("early-primary-within-10"),
    },
    sentenceBuilder: { variant: "label", vocabulary: "simpler-words" },
    countCompareMake: {
      countingMax: QUANTITY_PRESET.countingMax,
      numeralMax: QUANTITY_PRESET.numeralMax,
      compareMax: QUANTITY_PRESET.compareMax,
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

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/** A fresh, mutable deep copy of worksheet defaults. */
export function cloneWorksheetDefaults(
  defaults: Readonly<WorksheetDefaultsV2>,
): WorksheetDefaultsV2 {
  return {
    ...defaults,
    dryMath: { ...defaults.dryMath, operations: [...defaults.dryMath.operations] },
    findTheWow: {
      variant: defaults.findTheWow.variant,
      quantity: { ...defaults.findTheWow.quantity },
      equation: {
        ...defaults.findTheWow.equation,
        operations: [...defaults.findTheWow.equation.operations],
      },
    },
    sentenceBuilder: { ...defaults.sentenceBuilder },
    countCompareMake: { ...defaults.countCompareMake },
  };
}

/**
 * The worksheet selection stored defaults describe: a fresh deep copy of every
 * selection field, without the seeding flag.
 */
export function worksheetSelectionOf(
  defaults: Readonly<WorksheetSelectionV2>,
): WorksheetSelectionV2 {
  const copy = cloneWorksheetDefaults({
    ...defaults,
    useEarlierChildSettings: false,
  });
  return {
    worksheetType: copy.worksheetType,
    dryMath: copy.dryMath,
    findTheWow: copy.findTheWow,
    sentenceBuilder: copy.sentenceBuilder,
    countCompareMake: copy.countCompareMake,
    theme: copy.theme,
    useDisplayName: copy.useDisplayName,
    useInterests: copy.useInterests,
    includeDecorativeGraphics: copy.includeDecorativeGraphics,
    includeAnswerKey: copy.includeAnswerKey,
    length: copy.length,
    paperSize: copy.paperSize,
    printScale: copy.printScale,
  };
}

/** A new empty config: no profiles, the built-in defaults, the current version. */
export function emptyAppConfigV2(): AppConfigV2 {
  return {
    schemaVersion: APP_CONFIG_SCHEMA_VERSION,
    profiles: [],
    defaults: cloneWorksheetDefaults(DEFAULT_WORKSHEET_DEFAULTS_V2),
  };
}

/**
 * The theme a version 1 "use reviewed interests" choice implies (D16). The
 * migration applies it once, so a parent who turned interests off keeps the
 * neutral art. After that the Theme is its own saved choice.
 */
export function themeFromInterests(useInterests: boolean): ThemeChoice {
  return useInterests ? "from-interests" : "neutral";
}
