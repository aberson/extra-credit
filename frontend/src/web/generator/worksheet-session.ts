/**
 * The parent's worksheet selection as App session state (worksheet-first plan
 * section 5, DD8 and DD9).
 *
 * The selection starts from the saved `defaults`. While
 * `defaults.useEarlierChildSettings` is on, every group the parent has not
 * changed this session follows the selected child's earlier settings
 * (`selectionFromEarlierSettings`); a group the parent has changed keeps its
 * value until a later `loaded` starts the session over. Saving worksheet
 * defaults writes exactly the visible selection with the seeding flag off, and
 * once the flag is off no action turns it back on (D10).
 *
 * The reducer is pure: App holds it in `useReducer` above the profile editor,
 * so profile edits, profile saves, cancelled edits and in-app config reloads
 * keep the selection. Nothing here reads or writes browser storage.
 */
import {
  cloneWorksheetDefaults,
  themeFromInterests,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import {
  selectionFromEarlierSettings,
  type EarlierSettingDisclosure,
  type EarlierSettingsGroup,
} from "../../shared/config/earlier-settings";
import type {
  ChildProfileV2,
  WorksheetDefaultsV2,
  WorksheetSelectionV2,
} from "../../shared/config/schema";

/**
 * Every selection group the panel can change: the earlier-settings groups of
 * Appendix B.3 plus every other `WorksheetSelectionV2` field. A dotted key
 * names one field inside a family object.
 */
export const WORKSHEET_GROUP_KEYS = [
  "worksheetType",
  "dryMath",
  "findTheWow.variant",
  "findTheWow.quantity",
  "findTheWow.equation",
  "sentenceBuilder.variant",
  "sentenceBuilder.vocabulary",
  "countCompareMake",
  "theme",
  "useDisplayName",
  "useInterests",
  "includeDecorativeGraphics",
  "includeAnswerKey",
  "length",
  "paperSize",
  "printScale",
] as const;

export type WorksheetGroupKey = (typeof WORKSHEET_GROUP_KEYS)[number];

type PathValue<TValue, TPath extends string> =
  TPath extends `${infer THead}.${infer TRest}`
    ? THead extends keyof TValue
      ? PathValue<TValue[THead], TRest>
      : never
    : TPath extends keyof TValue
      ? TValue[TPath]
      : never;

/** The value type at path `K` of `WorksheetSelectionV2`. */
export type WorksheetGroupValue = {
  readonly [K in WorksheetGroupKey]: PathValue<WorksheetSelectionV2, K>;
};

export interface WorksheetSessionState {
  /** The saved defaults; `base.useEarlierChildSettings` is the seeding flag. */
  readonly base: WorksheetDefaultsV2;
  /** The seeding source, in config order. */
  readonly profiles: readonly ChildProfileV2[];
  /** An id in `profiles`, or `null` when there are none. */
  readonly selectedChildId: string | null;
  /** What the panel shows and Create projects. */
  readonly selection: WorksheetSelectionV2;
  /** Every key present; false until the parent changes that group this session. */
  readonly touched: Readonly<Record<WorksheetGroupKey, boolean>>;
  /** Rises by one on each action that invalidates the preview. */
  readonly previewEpoch: number;
}

/** One panel control change: exactly one group and its new value. */
export type WorksheetGroupChange = {
  readonly [K in WorksheetGroupKey]: {
    readonly type: "changed";
    readonly group: K;
    readonly value: WorksheetGroupValue[K];
  };
}[WorksheetGroupKey];

export type WorksheetSessionAction =
  | {
      readonly type: "loaded";
      readonly defaults: WorksheetDefaultsV2;
      readonly profiles: readonly ChildProfileV2[];
    }
  | {
      readonly type: "reloaded";
      readonly defaults: WorksheetDefaultsV2;
      readonly profiles: readonly ChildProfileV2[];
    }
  | { readonly type: "childSelected"; readonly childId: string }
  | WorksheetGroupChange
  | { readonly type: "defaultsSaved"; readonly defaults: WorksheetDefaultsV2 }
  | {
      readonly type: "profilesChanged";
      readonly profiles: readonly ChildProfileV2[];
    };

/** The two actions a panel control dispatches. */
export type WorksheetPanelAction = Extract<
  WorksheetSessionAction,
  { readonly type: "childSelected" | "changed" }
>;

/** Builds the `changed` action for one group, typed by that group's value. */
export function groupChanged<K extends WorksheetGroupKey>(
  group: K,
  value: WorksheetGroupValue[K],
): WorksheetGroupChange {
  return { type: "changed", group, value } as WorksheetGroupChange;
}

const UNTOUCHED: Readonly<Record<WorksheetGroupKey, boolean>> = Object.freeze(
  Object.fromEntries(WORKSHEET_GROUP_KEYS.map((key) => [key, false])) as Record<
    WorksheetGroupKey,
    boolean
  >,
);

function copied<TValue>(value: TValue): TValue {
  return typeof value === "object" && value !== null
    ? structuredClone(value)
    : value;
}

/** The value at one group's path. */
export function readGroup<K extends WorksheetGroupKey>(
  selection: WorksheetSelectionV2,
  key: K,
): WorksheetGroupValue[K] {
  const [head, tail] = key.split(".") as [keyof WorksheetSelectionV2, string?];
  const outer: unknown = selection[head];
  const value =
    tail === undefined ? outer : (outer as Record<string, unknown>)[tail];
  return copied(value) as WorksheetGroupValue[K];
}

/** A copy of `selection` with one group replaced. */
function withGroup<K extends WorksheetGroupKey>(
  selection: WorksheetSelectionV2,
  key: K,
  value: WorksheetGroupValue[K],
): WorksheetSelectionV2 {
  const [head, tail] = key.split(".") as [keyof WorksheetSelectionV2, string?];
  if (tail === undefined) {
    return { ...selection, [head]: copied(value) };
  }
  return {
    ...selection,
    [head]: { ...(selection[head] as object), [tail]: copied(value) },
  };
}

function firstProfileId(profiles: readonly ChildProfileV2[]): string | null {
  return profiles[0]?.id ?? null;
}

function namesProfile(
  profiles: readonly ChildProfileV2[],
  childId: string | null,
): childId is string {
  return childId !== null && profiles.some(({ id }) => id === childId);
}

/** The selected child, or `undefined` when none is selected. */
export function selectedChild(
  state: Pick<WorksheetSessionState, "profiles" | "selectedChildId">,
): ChildProfileV2 | undefined {
  return state.profiles.find(({ id }) => id === state.selectedChildId);
}

/**
 * The incoming defaults as the session stores them: a fresh copy, with the
 * seeding flag held off once the current state has it off (D10).
 */
function storedBase(
  current: WorksheetDefaultsV2 | undefined,
  incoming: WorksheetDefaultsV2,
): WorksheetDefaultsV2 {
  const base = cloneWorksheetDefaults(incoming);
  return current !== undefined && !current.useEarlierChildSettings
    ? { ...base, useEarlierChildSettings: false }
    : base;
}

/** The selection an untouched group follows: the child's earlier settings or the saved defaults. */
function seededSelection(
  base: WorksheetDefaultsV2,
  child: ChildProfileV2 | undefined,
): WorksheetSelectionV2 {
  const defaults = worksheetSelectionOf(base);
  const legacy = child?.legacyChoices;
  return base.useEarlierChildSettings && legacy !== undefined
    ? selectionFromEarlierSettings(legacy, defaults).selection
    : defaults;
}

/**
 * Re-applies the seeding invariant: untouched groups take their seeded value,
 * touched groups keep the current one, and (until the Theme control exists,
 * D33) `theme` follows `useInterests`.
 */
function settled(state: WorksheetSessionState): WorksheetSessionState {
  let selection = seededSelection(state.base, selectedChild(state));
  for (const key of WORKSHEET_GROUP_KEYS) {
    if (state.touched[key]) {
      selection = withGroup(selection, key, readGroup(state.selection, key));
    }
  }
  return {
    ...state,
    selection: { ...selection, theme: themeFromInterests(selection.useInterests) },
  };
}

export function worksheetSessionReducer(
  state: WorksheetSessionState | null,
  action: WorksheetSessionAction,
): WorksheetSessionState | null {
  if (action.type === "loaded") {
    const base = storedBase(state?.base, action.defaults);
    const loadedState: WorksheetSessionState = {
      base,
      profiles: action.profiles,
      selectedChildId: firstProfileId(action.profiles),
      selection: worksheetSelectionOf(base),
      touched: UNTOUCHED,
      previewEpoch: state === null ? 0 : state.previewEpoch + 1,
    };
    return settled(loadedState);
  }
  if (state === null) {
    return null;
  }
  switch (action.type) {
    case "reloaded":
      return settled({
        ...state,
        base: storedBase(state.base, action.defaults),
        profiles: action.profiles,
        selectedChildId: namesProfile(action.profiles, state.selectedChildId)
          ? state.selectedChildId
          : firstProfileId(action.profiles),
        previewEpoch: state.previewEpoch + 1,
      });
    case "childSelected":
      return namesProfile(state.profiles, action.childId)
        ? settled({
            ...state,
            selectedChildId: action.childId,
            previewEpoch: state.previewEpoch + 1,
          })
        : state;
    case "changed":
      return settled({
        ...state,
        selection: withGroup(state.selection, action.group, action.value),
        touched: { ...state.touched, [action.group]: true },
        previewEpoch: state.previewEpoch + 1,
      });
    case "defaultsSaved":
      return { ...state, base: storedBase(state.base, action.defaults) };
    case "profilesChanged":
      return settled({
        ...state,
        profiles: action.profiles,
        selectedChildId: namesProfile(action.profiles, state.selectedChildId)
          ? state.selectedChildId
          : firstProfileId(action.profiles),
        previewEpoch: state.previewEpoch + 1,
      });
  }
}

/**
 * The one worksheet-defaults save body (D-save): exactly the visible
 * selection, seeded groups included, with seeding turned off.
 */
export function defaultsForSave(state: WorksheetSessionState): WorksheetDefaultsV2 {
  return {
    ...worksheetSelectionOf(state.selection),
    useEarlierChildSettings: false,
  };
}

/** What the selected child's earlier settings currently supply, for the status line. */
export interface EarlierSettingsInUse {
  readonly child: ChildProfileV2;
  /** Seeded groups the parent has not changed, in Appendix B.3 order. */
  readonly groups: readonly EarlierSettingsGroup[];
  /** Clamps of those groups, then every stored-but-unused permission. */
  readonly disclosures: readonly EarlierSettingDisclosure[];
}

/**
 * The selected child's earlier settings as they reach the visible selection,
 * or `undefined` while seeding is off or the child has none.
 */
export function earlierSettingsInUse(
  state: WorksheetSessionState,
): EarlierSettingsInUse | undefined {
  const child = selectedChild(state);
  const legacy = child?.legacyChoices;
  if (child === undefined || legacy === undefined || !state.base.useEarlierChildSettings) {
    return undefined;
  }
  const mapped = selectionFromEarlierSettings(legacy, worksheetSelectionOf(state.base));
  const groups = mapped.groups.filter((group) => !state.touched[group]);
  return {
    child,
    groups,
    disclosures: mapped.disclosures.filter(
      (disclosure) => disclosure.kind !== "clamped" || groups.includes(disclosure.group),
    ),
  };
}
