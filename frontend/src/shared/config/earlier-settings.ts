/**
 * A migrated child's earlier settings, read as worksheet choices (plan
 * Appendix B.3).
 *
 * `legacyChoices` keeps a version 1 child's writing mode, vocabulary band and
 * math values verbatim and read-only. This module maps them onto the worksheet
 * selection groups they cover, clamped to each family's own range, and reports
 * every clamp and every stored-but-unused permission flag so the parent sees
 * what was kept and what this version does not use. Nothing here is ever
 * written back: the mapping only supplies starting choices.
 */
import {
  WORKSHEET_MAXIMUM_LABELS,
  type WorksheetRelevantMaximumKey,
} from "../worksheet/limit-labels.js";
import {
  DRY_MATH_NUMERIC_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
} from "../worksheet/types.js";
import { vocabularyForPresentationBand } from "./practice-focus.js";
import {
  ChildProfileV1Schema,
  type ArithmeticFocusV2,
  type ChildProfileV1,
  type ChildProfileV2,
  type LegacyChoicesV2,
  type MathSkillsV1,
  type WorksheetSelectionV2,
} from "./schema.js";

/** The selection groups an earlier setting can cover. */
export const EARLIER_SETTINGS_GROUPS = [
  "dryMath",
  "findTheWow.variant",
  "findTheWow.quantity",
  "findTheWow.equation",
  "sentenceBuilder.variant",
  "sentenceBuilder.vocabulary",
  "countCompareMake",
] as const;

export type EarlierSettingsGroup = (typeof EARLIER_SETTINGS_GROUPS)[number];

/** The groups whose numeric values are clamped to a family range. */
export type ClampedEarlierSettingsGroup = Extract<
  EarlierSettingsGroup,
  "dryMath" | "findTheWow.quantity" | "findTheWow.equation" | "countCompareMake"
>;

/** The two stored permissions this version never applies. */
export type UnusedPermission = keyof Pick<
  MathSkillsV1,
  "allowRegrouping" | "allowNegativeResults"
>;

export type EarlierSettingDisclosure =
  | {
      readonly kind: "clamped";
      readonly group: ClampedEarlierSettingsGroup;
      readonly field: WorksheetRelevantMaximumKey;
      readonly stored: number;
      readonly using: number;
    }
  | { readonly kind: "unused-permission"; readonly field: UnusedPermission };

export interface EarlierSettingsSelection {
  /** The base selection with every covered group replaced by the earlier value. */
  readonly selection: WorksheetSelectionV2;
  /** The groups the earlier settings covered, in `EARLIER_SETTINGS_GROUPS` order. */
  readonly groups: readonly EarlierSettingsGroup[];
  /** One entry per clamped value and one per set permission flag. */
  readonly disclosures: readonly EarlierSettingDisclosure[];
}

const CLAMPED_GROUP_LABELS = {
  dryMath: "Dry Math",
  "findTheWow.quantity": "Two Whats and a Wow quantity pictures",
  "findTheWow.equation": "Two Whats and a Wow equations",
  countCompareMake: "Count, Compare & Make",
} as const satisfies Record<ClampedEarlierSettingsGroup, string>;

const UNUSED_PERMISSION_LABELS = {
  allowRegrouping: "Carrying and borrowing",
  allowNegativeResults: "Negative results",
} as const satisfies Record<UnusedPermission, string>;

const UNUSED_PERMISSIONS = Object.keys(
  UNUSED_PERMISSION_LABELS,
) as readonly UnusedPermission[];

/**
 * The equation gate of Appendix B.3: equations, equality understanding and at
 * least one operation. It selects the Equations statements for Two Whats and a
 * Wow exactly as the version 1 capability rule did at Practice.
 */
function hasEquationGate(skills: MathSkillsV1): boolean {
  return (
    skills.representations.includes("equations") &&
    skills.understandsEquality &&
    skills.operations.length > 0
  );
}

/** Equations with at least one operation: the source of both arithmetic focus groups. */
function hasArithmetic(skills: MathSkillsV1): boolean {
  return (
    skills.representations.includes("equations") && skills.operations.length > 0
  );
}

function hasQuantities(skills: MathSkillsV1): boolean {
  return skills.representations.includes("quantities");
}

/**
 * Maps a child's earlier settings onto the worksheet groups they cover
 * (Appendix B.3). A group without a source keeps its value from `base`, and a
 * clamp or a set permission flag is disclosed, never applied.
 */
export function selectionFromEarlierSettings(
  legacy: LegacyChoicesV2,
  base: WorksheetSelectionV2,
): EarlierSettingsSelection {
  const skills = legacy.mathSkills;
  const groups: EarlierSettingsGroup[] = [];
  const disclosures: EarlierSettingDisclosure[] = [];

  const clamp = (
    group: ClampedEarlierSettingsGroup,
    field: WorksheetRelevantMaximumKey,
    ceiling: number,
  ): number => {
    const stored = skills[field];
    const using = Math.min(Math.max(stored, 1), ceiling);
    if (using !== stored) {
      disclosures.push({ kind: "clamped", group, field, stored, using });
    }
    return using;
  };
  const arithmeticFocus = (
    group: "dryMath" | "findTheWow.equation",
    ceiling: number,
  ): ArithmeticFocusV2 => ({
    operations: [...skills.operations],
    operandMax: clamp(group, "operandMax", ceiling),
    resultMax: clamp(group, "resultMax", ceiling),
  });

  let dryMath = { ...base.dryMath, operations: [...base.dryMath.operations] };
  let equation = {
    ...base.findTheWow.equation,
    operations: [...base.findTheWow.equation.operations],
  };
  let quantity = { ...base.findTheWow.quantity };
  let countCompareMake = { ...base.countCompareMake };
  let variant = base.findTheWow.variant;

  if (hasArithmetic(skills)) {
    groups.push("dryMath");
    dryMath = arithmeticFocus("dryMath", DRY_MATH_NUMERIC_MAXIMUM);
  }
  if (hasEquationGate(skills)) {
    groups.push("findTheWow.variant");
    variant = "equation";
  } else if (hasQuantities(skills)) {
    groups.push("findTheWow.variant");
    variant = "quantity";
  }
  if (hasQuantities(skills)) {
    groups.push("findTheWow.quantity");
    quantity = {
      countingMax: clamp("findTheWow.quantity", "countingMax", V1_NUMERIC_MAXIMUM),
      numeralMax: clamp("findTheWow.quantity", "numeralMax", V1_NUMERIC_MAXIMUM),
    };
  }
  if (hasArithmetic(skills)) {
    groups.push("findTheWow.equation");
    equation = arithmeticFocus("findTheWow.equation", V1_NUMERIC_MAXIMUM);
  }
  groups.push("sentenceBuilder.variant", "sentenceBuilder.vocabulary");
  if (hasQuantities(skills)) {
    groups.push("countCompareMake");
    countCompareMake = {
      countingMax: clamp("countCompareMake", "countingMax", V1_NUMERIC_MAXIMUM),
      numeralMax: clamp("countCompareMake", "numeralMax", V1_NUMERIC_MAXIMUM),
      compareMax: clamp("countCompareMake", "compareMax", V1_NUMERIC_MAXIMUM),
    };
  }
  for (const field of UNUSED_PERMISSIONS) {
    if (skills[field]) {
      disclosures.push({ kind: "unused-permission", field });
    }
  }

  return {
    // Every field is named, so a defaults object passed as `base` never
    // carries its seeding flag into the selection.
    selection: {
      worksheetType: base.worksheetType,
      dryMath,
      findTheWow: { variant, quantity, equation },
      sentenceBuilder: {
        variant: legacy.writingMode,
        vocabulary: vocabularyForPresentationBand(legacy.presentationBand),
      },
      countCompareMake,
      theme: base.theme,
      useDisplayName: base.useDisplayName,
      useInterests: base.useInterests,
      includeDecorativeGraphics: base.includeDecorativeGraphics,
      includeAnswerKey: base.includeAnswerKey,
      length: base.length,
      paperSize: base.paperSize,
      printScale: base.printScale,
    },
    groups: EARLIER_SETTINGS_GROUPS.filter((group) => groups.includes(group)),
    disclosures,
  };
}

/**
 * The selection a child starts from before the worksheet-first panel exists
 * (Step 16's interim rule): the saved defaults with that child's earlier
 * settings applied to every group they cover, whatever the seeding flag says.
 * A child without earlier settings starts from the defaults unchanged.
 */
export function selectionForChild(
  profile: ChildProfileV2 | undefined,
  base: WorksheetSelectionV2,
): EarlierSettingsSelection {
  const legacy = profile?.legacyChoices;
  if (legacy === undefined) {
    return { selection: base, groups: [], disclosures: [] };
  }
  return selectionFromEarlierSettings(legacy, base);
}

/**
 * A version 1 child without its age: identity plus the flat writing and math
 * capabilities that a version 2 profile keeps as `legacyChoices`. Fixtures
 * that describe a child's earlier settings are written in this shape.
 */
export const CapabilityProfileV1Schema = ChildProfileV1Schema.omit({
  ageYears: true,
});

export type CapabilityProfileV1 = Omit<ChildProfileV1, "ageYears">;

/** The stored version 2 profile whose `legacyChoices` hold these capabilities. */
export function profileWithLegacyChoices(
  capabilities: CapabilityProfileV1,
): ChildProfileV2 {
  return {
    id: capabilities.id,
    ...(capabilities.displayName === undefined
      ? {}
      : { displayName: capabilities.displayName }),
    reviewedOn: capabilities.reviewedOn,
    interests: [...capabilities.interests],
    legacyChoices: {
      presentationBand: capabilities.presentationBand,
      writingMode: capabilities.writingMode,
      mathSkills: {
        ...capabilities.mathSkills,
        representations: [...capabilities.mathSkills.representations],
        operations: [...capabilities.mathSkills.operations],
      },
    },
  };
}

/** The one parent-facing sentence for a disclosure, for example "stored 50, using 20". */
export function describeEarlierSettingDisclosure(
  disclosure: EarlierSettingDisclosure,
): string {
  if (disclosure.kind === "unused-permission") {
    return `${UNUSED_PERMISSION_LABELS[disclosure.field]}: stored but not used.`;
  }
  return `${CLAMPED_GROUP_LABELS[disclosure.group]} ${
    WORKSHEET_MAXIMUM_LABELS[disclosure.field]
  }: stored ${disclosure.stored}, using ${disclosure.using}.`;
}
