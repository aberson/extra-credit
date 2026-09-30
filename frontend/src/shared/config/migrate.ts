/**
 * Reading a stored config of any version this build knows, and upgrading an
 * earlier one in memory (plan Appendix B).
 *
 * `classifyStoredConfig` is the store's only classifier. A current file is
 * returned as parsed; a version 1 file is parsed with the frozen v1 schema and
 * carried through `CONFIG_MIGRATIONS` to the current shape, without any write:
 * the store writes the upgraded bytes only on the first explicit save, behind
 * a byte-identical backup of the earlier file. An integer version above the
 * current one is `future` and never rewritten; anything else is `invalid`.
 */
import {
  cloneWorksheetDefaults,
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  themeFromInterests,
} from "./defaults.js";
import {
  AppConfigV1Schema,
  type AppConfigV1,
  type ChildProfileV1,
} from "./legacy-v1.js";
import {
  APP_CONFIG_SCHEMA_VERSION,
  AppConfigV2Schema,
  type AppConfigV2,
  type ChildProfileV2,
} from "./schema.js";

function migrateProfileV1ToV2(profile: ChildProfileV1): ChildProfileV2 {
  return {
    id: profile.id,
    ...(profile.displayName === undefined
      ? {}
      : { displayName: profile.displayName }),
    reviewedOn: profile.reviewedOn,
    interests: [...profile.interests],
    // Kept verbatim and read-only: custom values, maxima above an activity
    // ceiling and both stored-but-unused permission flags all survive.
    legacyChoices: {
      presentationBand: profile.presentationBand,
      writingMode: profile.writingMode,
      mathSkills: {
        ...profile.mathSkills,
        representations: [...profile.mathSkills.representations],
        operations: [...profile.mathSkills.operations],
      },
    },
  };
}

/**
 * Appendix B.1. Profile order, ids, nicknames, review dates and interests
 * are unchanged; `ageYears` and `defaults.difficulty` have no version 2
 * meaning and stay only in the upgrade backup; the seven layout fields keep
 * their names; `theme` follows `useInterests`; seeding from earlier settings
 * is on exactly when the file had profiles; every other new field is the
 * built-in default. Returns the bare config, which the golden upgraded
 * digest is defined over.
 */
export function migrateConfigV1ToV2(v1: AppConfigV1): AppConfigV2 {
  const earlier = v1.defaults;
  return {
    schemaVersion: APP_CONFIG_SCHEMA_VERSION,
    profiles: v1.profiles.map(migrateProfileV1ToV2),
    defaults: {
      ...cloneWorksheetDefaults(DEFAULT_WORKSHEET_DEFAULTS_V2),
      theme: themeFromInterests(earlier.useInterests),
      useDisplayName: earlier.useDisplayName,
      useInterests: earlier.useInterests,
      includeDecorativeGraphics: earlier.includeDecorativeGraphics,
      includeAnswerKey: earlier.includeAnswerKey,
      length: earlier.length,
      paperSize: earlier.paperSize,
      printScale: earlier.printScale,
      useEarlierChildSettings: v1.profiles.length > 0,
    },
  };
}

/**
 * The upgrade chain, keyed by the stored version each step reads. A later
 * version adds its own step here (and its own frozen read schema) without
 * touching the version 1 logic.
 */
export const CONFIG_MIGRATIONS = { 1: migrateConfigV1ToV2 } as const;

export type LegacySchemaVersion = keyof typeof CONFIG_MIGRATIONS;

/**
 * What an in-memory upgrade did, as counts only: never an id, nickname,
 * interest, date or setting value.
 */
export interface ConfigMigrationReport {
  /** The stored `schemaVersion`, a key of `CONFIG_MIGRATIONS`. */
  readonly fromVersion: LegacySchemaVersion;
  readonly toVersion: typeof APP_CONFIG_SCHEMA_VERSION;
  /** The migrated `profiles.length`, equal to the stored count. */
  readonly profilesUpgraded: number;
  /** Migrated profiles carrying `legacyChoices`; every v1 profile gets one. */
  readonly legacyChoicesCarried: number;
  /** False as the classifier returns it, because a read never writes. */
  readonly backupWritten: boolean;
}

export type StoredConfigClassification =
  | { readonly kind: "current"; readonly config: AppConfigV2 }
  | {
      readonly kind: "legacy";
      readonly fromVersion: LegacySchemaVersion;
      readonly config: AppConfigV2;
      readonly report: ConfigMigrationReport;
    }
  | { readonly kind: "future" }
  | { readonly kind: "invalid" };

const INVALID: StoredConfigClassification = Object.freeze({ kind: "invalid" });
const FUTURE: StoredConfigClassification = Object.freeze({ kind: "future" });

/**
 * Classifies an already JSON-parsed stored value. Only an integer
 * `schemaVersion` names a version: 1.5, the string "2", a missing version, an
 * array and `null` are all invalid, and a body that fails its own version's
 * strict schema (a v1 body labelled 2, a v2 body labelled 1) is invalid too.
 */
export function classifyStoredConfig(parsed: unknown): StoredConfigClassification {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return INVALID;
  }
  const version = (parsed as { readonly schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    return INVALID;
  }
  if (version > APP_CONFIG_SCHEMA_VERSION) {
    return FUTURE;
  }
  if (version === APP_CONFIG_SCHEMA_VERSION) {
    const current = AppConfigV2Schema.safeParse(parsed);
    return current.success ? { kind: "current", config: current.data } : INVALID;
  }
  if (version === 1) {
    const stored = AppConfigV1Schema.safeParse(parsed);
    if (!stored.success) {
      return INVALID;
    }
    const upgraded = AppConfigV2Schema.safeParse(
      CONFIG_MIGRATIONS[version](stored.data),
    );
    if (!upgraded.success) {
      return INVALID;
    }
    return {
      kind: "legacy",
      fromVersion: version,
      config: upgraded.data,
      report: {
        fromVersion: version,
        toVersion: APP_CONFIG_SCHEMA_VERSION,
        profilesUpgraded: upgraded.data.profiles.length,
        legacyChoicesCarried: upgraded.data.profiles.filter(
          (profile) => profile.legacyChoices !== undefined,
        ).length,
        backupWritten: false,
      },
    };
  }
  return INVALID;
}
