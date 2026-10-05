import { useMemo, useState, type ReactNode } from "react";

import {
  describeEarlierSettingDisclosure,
  type EarlierSettingsGroup,
} from "../../shared/config/earlier-settings";
import {
  EARLIER_SETTING_OPTION_ID,
  FACT_PRACTICE_ENTRIES,
  NUMBER_BONDS_FOCUS_CATALOG,
  PRACTICE_FOCUS_CATALOG,
  SAVED_SETTING_OPTION_ID,
  SENTENCE_VOCABULARY_LABELS,
  describePracticeFocus,
  matchFactPracticeEntry,
  matchNumberBondsFocusOption,
  matchPracticeFocusOption,
  savedSettingOptionLabel,
  type PracticeFocusKind,
  type PracticeFocusOption,
  type PracticeFocusValues,
} from "../../shared/config/practice-focus";
import {
  FIND_THE_WOW_VARIANTS,
  NUMBER_BONDS_REGROUPING_MODES,
  REGROUPING_MODES,
  SENTENCE_VOCABULARY_OPTIONS,
  THEME_CHOICES,
  WRITING_MODES,
  type ChildProfileV2,
  type ThemeChoice,
  type WorksheetSelectionV2,
} from "../../shared/config/schema";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetCapabilitySupportV1,
  type WorksheetControlContextV2,
  type WorksheetRegistrationV1,
} from "../../shared/worksheet/registry";
import { FACT_FACTOR_MAXIMUM } from "../../shared/worksheet/types";
import {
  DRY_MATH_REGROUPING_HELP,
  DRY_MATH_REGROUPING_LABELS,
  DRY_MATH_REGROUPING_LEGEND,
  FACT_FAMILIES_HELP,
  FACT_FAMILIES_LEGEND,
  FACT_FAMILY_KEEP_ONE_NOTE,
  factFamilyLabel,
} from "../../worksheets/dry-math/definition";
import { FIND_THE_WOW_VARIANT_LABELS } from "../../worksheets/find-the-wow/definition";
import {
  NUMBER_BONDS_CARD_DESCRIPTION,
  NUMBER_BONDS_FOCUS_HELP,
  NUMBER_BONDS_REGROUPING_HELP,
  NUMBER_BONDS_REGROUPING_LABELS,
  NUMBER_BONDS_REGROUPING_LEGEND,
} from "../../worksheets/number-bonds/definition";
import { SENTENCE_BUILDER_VARIANT_LABELS } from "../../worksheets/sentence-builder/definition";
import { ConfigApiError, ConfigAuthorityChangedError } from "../api/client";
import { EARLY_PRIMARY_HELP_TEXT } from "../profiles/ProfileEditor";
import type { GenerationSelection } from "./create-session";
import {
  earlierSettingsInUse,
  groupChanged,
  selectedChild,
  type WorksheetGroupKey,
  type WorksheetGroupValue,
  type WorksheetPanelAction,
  type WorksheetSessionState,
} from "./worksheet-session";

interface GeneratorControlsProps {
  /** The App-held session: the visible selection and what it was seeded from. */
  readonly session: WorksheetSessionState;
  readonly disabled?: boolean;
  /**
   * Receives exactly one `childSelected`, `changed` or `dryMathPracticeChosen`
   * action per control change.
   */
  readonly onChange: (action: WorksheetPanelAction) => void;
  readonly onGenerate: (generation: GenerationSelection) => void;
  /**
   * Saves the visible selection as the worksheet defaults. The host builds the
   * body from its own session state (`defaultsForSave`).
   *
   * Required rather than optional so a host that renders these controls
   * without wiring the local configuration round trip fails to compile: a
   * silently unwired save would look exactly like a working one until a parent
   * reloaded and found nothing kept.
   */
  readonly onSaveDefaults: () => Promise<void>;
}

/** One line under each worksheet-type card title. */
const WORKSHEET_DESCRIPTIONS = {
  "dry-math": "Addition, subtraction, multiplication and division facts written with numbers and symbols.",
  "find-the-wow": "Three statements per group; the child circles the one that is true.",
  "sentence-builder": "One prompt to draw, label, copy or write about.",
  "count-compare-make": "Match, compare, complete and draw quantities without symbols.",
  "number-bonds": NUMBER_BONDS_CARD_DESCRIPTION,
} as const satisfies Record<RegisteredWorksheetType, string>;

const WORKSHEET_CARDS = REGISTERED_WORKSHEET_IDS.map((worksheetId) => ({
  id: worksheetId,
  label: getWorksheetRegistration(worksheetId).displayName,
  description: WORKSHEET_DESCRIPTIONS[worksheetId],
}));

/** The ids the unavailable and capacity messages carry; Create names whichever shows. */
const UNAVAILABLE_MESSAGE_ID = "generation-unavailable";
const CAPACITY_MESSAGE_ID = "generation-capacity";

/** The Theme options, in the order the select lists them. */
const THEME_LABELS = {
  "from-interests": "From interests",
  animals: "Animals",
  space: "Space",
  nature: "Nature",
  sports: "Sports",
  vehicles: "Vehicles",
  neutral: "Neutral",
} as const satisfies Record<ThemeChoice, string>;

const THEME_HELP_ID = "worksheet-theme-help";

const REGROUPING_HELP_ID = "worksheet-regrouping-help";

const NUMBER_BONDS_FOCUS_HELP_ID = "worksheet-number-bonds-focus-help";
const NUMBER_BONDS_REGROUPING_HELP_ID = "worksheet-number-bonds-regrouping-help";

const FACT_FAMILIES_HELP_ID = "worksheet-fact-families-help";
const FACT_FAMILY_NOTE_ID = "worksheet-fact-families-note";

/** Every fact family a parent can check, 0 through `FACT_FACTOR_MAXIMUM`. */
const FACT_FAMILIES: readonly number[] = Array.from(
  { length: FACT_FACTOR_MAXIMUM + 1 },
  (_, family) => family,
);

/** The help text under the Theme select. It never names a child's interest. */
export const THEME_HELP_TEXT =
  "Neutral, and interests with no matching artwork, use the simple star. A theme changes only the decoration, never the work or the answers.";

/** Each child by nickname, or as "Profile N" when it has none (U3). */
function profileLabel(profile: ChildProfileV2, index: number): string {
  return profile.displayName ?? `Profile ${index + 1}`;
}

function worksheetAvailability(
  profile: ChildProfileV2 | undefined,
  registration: WorksheetRegistrationV1,
  context: WorksheetControlContextV2,
): WorksheetCapabilitySupportV1 {
  if (profile === undefined) {
    return {
      available: false,
      message: "Add and save a profile before creating a worksheet.",
    };
  }
  return registration.controls.getCapabilitySupport(context);
}

/** The practice focus the chosen family and variant read, and the group it lives in. */
type FocusControl = {
  readonly [TKind in PracticeFocusKind]: {
    readonly kind: TKind;
    readonly group: FocusGroupOf[TKind];
    readonly value: PracticeFocusValues[TKind];
  };
}[PracticeFocusKind];

interface FocusGroupOf {
  readonly "dry-math": "dryMath";
  readonly "find-the-wow-quantity": "findTheWow.quantity";
  readonly "find-the-wow-equation": "findTheWow.equation";
  readonly "count-compare-make": "countCompareMake";
}

function focusControlFor(selection: WorksheetSelectionV2): FocusControl | undefined {
  switch (selection.worksheetType) {
    case "dry-math":
      return { kind: "dry-math", group: "dryMath", value: selection.dryMath };
    case "find-the-wow":
      return selection.findTheWow.variant === "equation"
        ? {
            kind: "find-the-wow-equation",
            group: "findTheWow.equation",
            value: selection.findTheWow.equation,
          }
        : {
            kind: "find-the-wow-quantity",
            group: "findTheWow.quantity",
            value: selection.findTheWow.quantity,
          };
    case "count-compare-make":
      return {
        kind: "count-compare-make",
        group: "countCompareMake",
        value: selection.countCompareMake,
      };
    case "sentence-builder":
    case "number-bonds":
      return undefined;
  }
}

function focusCatalog(
  kind: PracticeFocusKind,
): readonly PracticeFocusOption<PracticeFocusKind>[] {
  return PRACTICE_FOCUS_CATALOG[kind];
}

/**
 * The option the practice-focus select shows as chosen: Dry Math's fact entry
 * on its multiply-divide strand, else the catalog option the focus matches or
 * the Earlier setting option.
 */
function focusOptionIdFor(
  control: FocusControl,
  selection: WorksheetSelectionV2,
): string {
  return control.kind === "dry-math" && selection.dryMathStrand === "multiply-divide"
    ? matchFactPracticeEntry(selection.dryMathFacts.operations).id
    : matchPracticeFocusOption(control.kind, control.value);
}

/**
 * Whether the select offers the Earlier setting option: whenever the stored
 * focus matches no catalog option, so a Dry Math focus kept while facts are
 * chosen can still be chosen again.
 */
function earlierSettingOffered(control: FocusControl): boolean {
  return matchPracticeFocusOption(control.kind, control.value) === EARLIER_SETTING_OPTION_ID;
}

/** The label of the extra option a focus outside the catalog shows. */
function earlierSettingOptionLabel(control: FocusControl): string {
  return `Earlier setting: ${describePracticeFocus(control.kind, control.value)}`;
}

/** The earlier-settings groups this worksheet type shows, in panel order. */
function groupsShownFor(
  selection: WorksheetSelectionV2,
): readonly EarlierSettingsGroup[] {
  switch (selection.worksheetType) {
    case "dry-math":
      // A facts page shows no addition and subtraction focus to start from.
      return selection.dryMathStrand === "add-subtract" ? ["dryMath"] : [];
    case "find-the-wow":
      return [
        "findTheWow.variant",
        selection.findTheWow.variant === "equation"
          ? "findTheWow.equation"
          : "findTheWow.quantity",
      ];
    case "sentence-builder":
      return ["sentenceBuilder.variant", "sentenceBuilder.vocabulary"];
    case "count-compare-make":
      return ["countCompareMake"];
    case "number-bonds":
      // No earlier setting describes Number Bonds.
      return [];
  }
}

/** How the status line names one seeded group's visible value. */
function describeSeededGroup(
  group: EarlierSettingsGroup,
  selection: WorksheetSelectionV2,
): string {
  switch (group) {
    case "dryMath":
      return `Practice focus: ${describePracticeFocus("dry-math", selection.dryMath)}`;
    case "findTheWow.variant":
      return `Statements: ${FIND_THE_WOW_VARIANT_LABELS[selection.findTheWow.variant]}`;
    case "findTheWow.quantity":
      return `Practice focus: ${describePracticeFocus("find-the-wow-quantity", selection.findTheWow.quantity)}`;
    case "findTheWow.equation":
      return `Practice focus: ${describePracticeFocus("find-the-wow-equation", selection.findTheWow.equation)}`;
    case "sentenceBuilder.variant":
      return `Writing activity: ${SENTENCE_BUILDER_VARIANT_LABELS[selection.sentenceBuilder.variant]}`;
    case "sentenceBuilder.vocabulary":
      return `Vocabulary: ${SENTENCE_VOCABULARY_LABELS[selection.sentenceBuilder.vocabulary]}`;
    case "countCompareMake":
      return `Practice focus: ${describePracticeFocus("count-compare-make", selection.countCompareMake)}`;
  }
}

/**
 * A native radio group in a fieldset, so arrow keys work with no extra script.
 * Optional help text follows the options and describes the whole group.
 */
function RadioGroup<TValue extends string>({
  disabled,
  help,
  legend,
  name,
  onSelect,
  options,
  value,
}: {
  readonly disabled: boolean;
  readonly help?: { readonly id: string; readonly text: string };
  readonly legend: string;
  readonly name: string;
  readonly onSelect: (value: TValue) => void;
  readonly options: readonly { readonly value: TValue; readonly label: string }[];
  readonly value: TValue;
}) {
  return (
    <fieldset
      aria-describedby={help?.id}
      className="worksheet-choice-group"
      data-panel-control={name}
    >
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            checked={value === option.value}
            disabled={disabled}
            name={name}
            onChange={() => onSelect(option.value)}
            type="radio"
            value={option.value}
          />{" "}
          {option.label}
        </label>
      ))}
      {help !== undefined && <p id={help.id}>{help.text}</p>}
    </fieldset>
  );
}

function Checkbox({
  checked,
  disabled,
  label,
  onToggle,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onToggle: (checked: boolean) => void;
}) {
  return (
    <label>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(event.currentTarget.checked)}
        type="checkbox"
      />{" "}
      {label}
    </label>
  );
}

function OptionGroup({
  children,
  legend,
  name,
}: {
  readonly children: ReactNode;
  readonly legend: string;
  readonly name: string;
}) {
  return (
    <fieldset className="worksheet-choice-group" data-more-options-group={name}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The worksheet-first panel: worksheet type, its variant, the child and the
 * practice focus (with Dry Math's Carrying and borrowing or Fact families
 * choice, or Number Bonds' own Carrying and borrowing choice, after it),
 * then the summary, any blocking guidance and Create. More options holds only Length, the answer key, Personalization and
 * Print layout. The panel is controlled: every choice lives in the App
 * session, so it survives profile edits, saves and in-app reloads.
 */
export function GeneratorControls({
  disabled = false,
  onChange,
  onGenerate,
  onSaveDefaults,
  session,
}: GeneratorControlsProps) {
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  // The preview epoch the last successful save confirmed. A defaults save never
  // raises the epoch and every other selection change does, so the
  // confirmation retires as soon as the visible choices move past what was
  // saved.
  const [savedAtEpoch, setSavedAtEpoch] = useState<number | null>(null);

  const { profiles, selection } = session;
  const selectedProfile = selectedChild(session);
  // Memoized on the selection because the capacity verdict inside
  // `getCapabilitySupport` enumerates a family's whole candidate collection.
  const controlContext: WorksheetControlContextV2 = useMemo(
    () => ({ selection }),
    [selection],
  );
  const worksheetType = selection.worksheetType;
  const registration = getWorksheetRegistration(worksheetType);
  const availability = useMemo(
    () =>
      worksheetAvailability(
        selectedProfile,
        getWorksheetRegistration(controlContext.selection.worksheetType),
        controlContext,
      ),
    [controlContext, selectedProfile],
  );
  const capacity = availability.available ? availability.capacity : undefined;
  const capacityShortfall =
    capacity !== undefined && !capacity.sufficient ? capacity.message : undefined;
  const producible = availability.available && capacityShortfall === undefined;
  const blockingMessageId = !availability.available
    ? UNAVAILABLE_MESSAGE_ID
    : capacityShortfall !== undefined
      ? CAPACITY_MESSAGE_ID
      : undefined;
  const applicable = registration.controls.getApplicableControls(controlContext);
  const effectiveUnit = registration.controls.getEffectiveUnit(controlContext);
  const unitLabel =
    effectiveUnit.count === 1 ? effectiveUnit.singularLabel : effectiveUnit.pluralLabel;
  const focusControl = applicable.practiceFocus
    ? focusControlFor(selection)
    : undefined;
  const focusOptionId =
    focusControl === undefined ? undefined : focusOptionIdFor(focusControl, selection);
  const factFamilies = selection.dryMathFacts.factFamilies;
  const numberBondsFocusId = matchNumberBondsFocusOption(selection.numberBonds);

  const inUse = earlierSettingsInUse(session);
  const shownGroups = groupsShownFor(selection);
  const seededShown =
    inUse === undefined
      ? []
      : inUse.groups.filter((group) => shownGroups.includes(group));
  const earlierSettingDisclosures = (inUse?.disclosures ?? []).map(
    describeEarlierSettingDisclosure,
  );
  const seededChildLabel =
    inUse === undefined
      ? undefined
      : profileLabel(inUse.child, profiles.indexOf(inUse.child));
  const seedingNoteShown =
    session.base.useEarlierChildSettings &&
    profiles.some(({ legacyChoices }) => legacyChoices !== undefined);

  const showNickname =
    applicable.useDisplayName && selectedProfile?.displayName !== undefined;
  const hasPersonalization =
    showNickname ||
    applicable.useInterests ||
    applicable.includeDecorativeGraphics ||
    applicable.theme;
  const hasPrintLayout = applicable.paperSize || applicable.printScale;
  const hasMoreOptions =
    applicable.length ||
    applicable.includeAnswerKey ||
    hasPersonalization ||
    hasPrintLayout;

  function dispatch(action: WorksheetPanelAction): void {
    if (disabled) {
      return;
    }
    setDefaultsError(null);
    onChange(action);
  }

  function change<K extends WorksheetGroupKey>(
    group: K,
    value: WorksheetGroupValue[K],
  ): void {
    dispatch(groupChanged(group, value));
  }

  function selectChild(childId: string): void {
    if (disabled) {
      return;
    }
    setDefaultsError(null);
    onChange({ type: "childSelected", childId });
  }

  /**
   * Dry Math's select dispatches one `dryMathPracticeChosen` action for every
   * entry it offers, because each entry sets the strand and one other group.
   */
  function chooseDryMathPractice(optionId: string): void {
    const factEntry = FACT_PRACTICE_ENTRIES.find(({ id }) => id === optionId);
    if (factEntry !== undefined) {
      dispatch({
        type: "dryMathPracticeChosen",
        strand: "multiply-divide",
        dryMathFacts: {
          operations: [...factEntry.operations],
          factFamilies: [...factFamilies],
        },
      });
      return;
    }
    const focus =
      optionId === EARLIER_SETTING_OPTION_ID
        ? selection.dryMath
        : PRACTICE_FOCUS_CATALOG["dry-math"].find(({ id }) => id === optionId)?.focus;
    if (focus !== undefined) {
      dispatch({ type: "dryMathPracticeChosen", strand: "add-subtract", dryMath: focus });
    }
  }

  function chooseFocus(optionId: string): void {
    if (focusControl?.kind === "dry-math") {
      chooseDryMathPractice(optionId);
      return;
    }
    if (focusControl === undefined || optionId === EARLIER_SETTING_OPTION_ID) {
      return;
    }
    const option = focusCatalog(focusControl.kind).find(({ id }) => id === optionId);
    if (option === undefined) {
      return;
    }
    // The option belongs to the same kind as the control, so its focus has
    // exactly the shape of the group it replaces.
    change(
      focusControl.group,
      option.focus as WorksheetGroupValue[typeof focusControl.group],
    );
  }

  /**
   * One Number Bonds focus entry: its operations and range, keeping the
   * carrying and borrowing choice. The Saved setting option is the value
   * already chosen, so choosing it changes nothing.
   */
  function chooseNumberBondsFocus(optionId: string): void {
    const option = NUMBER_BONDS_FOCUS_CATALOG.find(({ id }) => id === optionId);
    if (option === undefined) {
      return;
    }
    change("numberBonds", {
      ...selection.numberBonds,
      operations: [...option.focus.operations],
      wholeMax: option.focus.wholeMax,
    });
  }

  /** Checks or clears one fact family; the last checked family stays. */
  function toggleFactFamily(family: number, checked: boolean): void {
    const next = checked
      ? FACT_FAMILIES.filter((candidate) => candidate === family || factFamilies.includes(candidate))
      : factFamilies.filter((candidate) => candidate !== family);
    if (next.length === 0) {
      return;
    }
    change("dryMathFacts", {
      operations: [...selection.dryMathFacts.operations],
      factFamilies: next,
    });
  }

  function effectiveUnitForLength(
    nextLength: WorksheetSelectionV2["length"],
  ): number {
    return registration.controls.getEffectiveUnit({
      selection: { ...selection, length: nextLength },
    }).count;
  }

  async function saveDefaults(): Promise<void> {
    if (disabled || savingDefaults) {
      return;
    }
    const epochAtSave = session.previewEpoch;
    setSavingDefaults(true);
    setDefaultsError(null);
    setSavedAtEpoch(null);
    try {
      await onSaveDefaults();
      setSavedAtEpoch(epochAtSave);
    } catch (error) {
      setDefaultsError(
        // A superseded write is the one failure with a next step: the host has
        // already re-read the file, so the very next click carries a current
        // precondition instead of repeating the one that just failed.
        error instanceof ConfigAuthorityChangedError
          ? "Saved profiles changed on this computer, so no worksheet defaults were changed. The latest file has been reloaded - press save again to keep these choices."
          : error instanceof ConfigApiError
            ? `${error.message} No worksheet defaults were changed.`
            : "The worksheet defaults could not be saved. Nothing was changed.",
      );
    } finally {
      setSavingDefaults(false);
    }
  }

  function submit(): void {
    if (selectedProfile === undefined || !producible || disabled) {
      return;
    }
    onGenerate({ profile: selectedProfile, selection });
  }

  return (
    <section aria-labelledby="generator-title" className="worksheet-panel">
      <h2 id="generator-title">Create a practice worksheet</h2>
      <p data-early-primary-help="true">{EARLY_PRIMARY_HELP_TEXT}</p>
      <p>
        Generation stays in this browser tab and uses only local deterministic
        code.
      </p>

      <fieldset className="worksheet-type-cards" data-panel-control="worksheet-type">
        <legend>Worksheet type</legend>
        {WORKSHEET_CARDS.map(({ id, label, description }) => (
          <label className="worksheet-type-card" key={id}>
            <input
              aria-describedby={`worksheet-type-${id}-description`}
              aria-labelledby={`worksheet-type-${id}-title`}
              checked={worksheetType === id}
              disabled={disabled}
              name="worksheet-type"
              onChange={() => change("worksheetType", id)}
              type="radio"
              value={id}
            />
            <span className="worksheet-type-card__title" id={`worksheet-type-${id}-title`}>
              {label}
            </span>
            <span
              className="worksheet-type-card__description"
              id={`worksheet-type-${id}-description`}
            >
              {description}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="worksheet-panel__columns">
        <div className="worksheet-panel__primary">
          {applicable.variant && worksheetType === "find-the-wow" && (
            <RadioGroup
              disabled={disabled}
              legend="Statements"
              name="find-the-wow-variant"
              onSelect={(variant) => change("findTheWow.variant", variant)}
              options={FIND_THE_WOW_VARIANTS.map((variant) => ({
                value: variant,
                label: FIND_THE_WOW_VARIANT_LABELS[variant],
              }))}
              value={selection.findTheWow.variant}
            />
          )}
          {applicable.variant && worksheetType === "sentence-builder" && (
            <RadioGroup
              disabled={disabled}
              legend="Writing activity"
              name="sentence-builder-variant"
              onSelect={(variant) => change("sentenceBuilder.variant", variant)}
              options={WRITING_MODES.map((variant) => ({
                value: variant,
                label: SENTENCE_BUILDER_VARIANT_LABELS[variant],
              }))}
              value={selection.sentenceBuilder.variant}
            />
          )}

          <label className="worksheet-field" data-panel-control="child">
            Child profile
            <select
              aria-label="Child profile"
              disabled={disabled || profiles.length === 0}
              onChange={(event) => selectChild(event.currentTarget.value)}
              value={selectedProfile?.id ?? ""}
            >
              {profiles.length === 0 && <option value="">No saved profiles</option>}
              {profiles.map((profile, index) => (
                <option key={profile.id} value={profile.id}>
                  {profileLabel(profile, index)}
                </option>
              ))}
            </select>
          </label>

          {focusControl !== undefined && focusOptionId !== undefined && (
            <label className="worksheet-field" data-panel-control="practice-focus">
              Practice focus
              <select
                aria-label="Practice focus"
                disabled={disabled}
                onChange={(event) => chooseFocus(event.currentTarget.value)}
                value={focusOptionId}
              >
                {earlierSettingOffered(focusControl) && (
                  <option value={EARLIER_SETTING_OPTION_ID}>
                    {earlierSettingOptionLabel(focusControl)}
                  </option>
                )}
                {focusCatalog(focusControl.kind).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
                {focusControl.kind === "dry-math" &&
                  FACT_PRACTICE_ENTRIES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {applicable.practiceFocus && worksheetType === "number-bonds" && (
            <>
              <label className="worksheet-field" data-panel-control="practice-focus">
                Practice focus
                <select
                  aria-describedby={NUMBER_BONDS_FOCUS_HELP_ID}
                  aria-label="Practice focus"
                  disabled={disabled}
                  onChange={(event) => chooseNumberBondsFocus(event.currentTarget.value)}
                  value={numberBondsFocusId}
                >
                  {numberBondsFocusId === SAVED_SETTING_OPTION_ID && (
                    <option value={SAVED_SETTING_OPTION_ID}>
                      {savedSettingOptionLabel(selection.numberBonds)}
                    </option>
                  )}
                  {NUMBER_BONDS_FOCUS_CATALOG.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p data-number-bonds-focus-help="true" id={NUMBER_BONDS_FOCUS_HELP_ID}>
                {NUMBER_BONDS_FOCUS_HELP}
              </p>
            </>
          )}
          {applicable.regrouping && worksheetType === "number-bonds" && (
            <RadioGroup
              disabled={disabled}
              help={{ id: NUMBER_BONDS_REGROUPING_HELP_ID, text: NUMBER_BONDS_REGROUPING_HELP }}
              legend={NUMBER_BONDS_REGROUPING_LEGEND}
              name="number-bonds-regrouping"
              onSelect={(regrouping) =>
                change("numberBonds", { ...selection.numberBonds, regrouping })
              }
              options={NUMBER_BONDS_REGROUPING_MODES.map((regrouping) => ({
                value: regrouping,
                label: NUMBER_BONDS_REGROUPING_LABELS[regrouping],
              }))}
              value={selection.numberBonds.regrouping}
            />
          )}
          {applicable.factFamilies && worksheetType === "dry-math" && (
            <fieldset
              aria-describedby={FACT_FAMILIES_HELP_ID}
              className="worksheet-choice-group"
              data-panel-control="fact-families"
            >
              <legend>{FACT_FAMILIES_LEGEND}</legend>
              <div className="worksheet-fact-families">
                {FACT_FAMILIES.map((family) => {
                  const checked = factFamilies.includes(family);
                  const keptLast = checked && factFamilies.length === 1;
                  return (
                    <label key={family}>
                      <input
                        aria-describedby={keptLast ? FACT_FAMILY_NOTE_ID : undefined}
                        checked={checked}
                        disabled={disabled || keptLast}
                        onChange={(event) =>
                          toggleFactFamily(family, event.currentTarget.checked)
                        }
                        type="checkbox"
                      />{" "}
                      {factFamilyLabel(family)}
                    </label>
                  );
                })}
              </div>
              {factFamilies.length === 1 && (
                <p data-fact-family-note="true" id={FACT_FAMILY_NOTE_ID}>
                  {FACT_FAMILY_KEEP_ONE_NOTE}
                </p>
              )}
              <p id={FACT_FAMILIES_HELP_ID}>{FACT_FAMILIES_HELP}</p>
            </fieldset>
          )}
          {applicable.regrouping && worksheetType === "dry-math" && (
            <RadioGroup
              disabled={disabled}
              help={{ id: REGROUPING_HELP_ID, text: DRY_MATH_REGROUPING_HELP }}
              legend={DRY_MATH_REGROUPING_LEGEND}
              name="dry-math-regrouping"
              onSelect={(regrouping) => change("dryMathRegrouping", regrouping)}
              options={REGROUPING_MODES.map((regrouping) => ({
                value: regrouping,
                label: DRY_MATH_REGROUPING_LABELS[regrouping],
              }))}
              value={selection.dryMathRegrouping}
            />
          )}
          {applicable.vocabulary && (
            <RadioGroup
              disabled={disabled}
              legend="Vocabulary"
              name="sentence-builder-vocabulary"
              onSelect={(vocabulary) => change("sentenceBuilder.vocabulary", vocabulary)}
              options={SENTENCE_VOCABULARY_OPTIONS.map((vocabulary) => ({
                value: vocabulary,
                label: SENTENCE_VOCABULARY_LABELS[vocabulary],
              }))}
              value={selection.sentenceBuilder.vocabulary}
            />
          )}

          {/*
            A polite live region deliberately without role="status" (DD17), so
            it adds no status region beside the health line. It stays mounted
            so a change in what the earlier settings supply is announced.
          */}
          <div aria-live="polite" data-earlier-settings-status="true">
            {seededChildLabel !== undefined && seededShown.length > 0 && (
              <p data-earlier-settings-used="true">
                {`Starting from ${seededChildLabel}'s earlier settings: ${seededShown
                  .map((group) => describeSeededGroup(group, selection))
                  .join("; ")}.`}
              </p>
            )}
            {earlierSettingDisclosures.length > 0 && (
              <p data-earlier-settings-disclosure="true">
                Earlier settings this version adjusts or does not use:{" "}
                {earlierSettingDisclosures.join(" ")}
              </p>
            )}
          </div>

          <div data-selection-summary="true">
            {availability.available && availability.statusMessage !== undefined && (
              <p aria-live="polite">{availability.statusMessage}</p>
            )}
            {producible && (
              <p aria-live="polite">
                This selection creates {effectiveUnit.count} unique {unitLabel} on
                one practice page.
              </p>
            )}
          </div>

          {!availability.available && (
            <p
              aria-live="polite"
              className="worksheet-blocking"
              data-blocking-message="true"
              id={UNAVAILABLE_MESSAGE_ID}
            >
              {availability.message}
            </p>
          )}
          {capacityShortfall !== undefined && (
            <p
              aria-live="polite"
              className="worksheet-blocking"
              data-blocking-message="true"
              data-capacity-conflict="true"
              id={CAPACITY_MESSAGE_ID}
            >
              {capacityShortfall}
            </p>
          )}

          <button
            aria-describedby={blockingMessageId}
            disabled={disabled || !producible}
            onClick={submit}
            type="button"
          >
            Create worksheet
          </button>
        </div>

        <div className="worksheet-panel__secondary">
          {hasMoreOptions && (
            <details>
              <summary>More options</summary>
              <div className="worksheet-more-options__groups">
                {applicable.length && (
                  <OptionGroup legend="Length" name="length">
                    <select
                      aria-label="Length"
                      disabled={disabled}
                      onChange={(event) =>
                        change(
                          "length",
                          event.currentTarget.value as WorksheetSelectionV2["length"],
                        )
                      }
                      value={selection.length}
                    >
                      <option value="short">
                        Short · {effectiveUnitForLength("short")} {unitLabel}
                      </option>
                      <option value="standard">
                        Standard · {effectiveUnitForLength("standard")} {unitLabel}
                      </option>
                      <option value="long">
                        Long · {effectiveUnitForLength("long")} {unitLabel}
                      </option>
                    </select>
                  </OptionGroup>
                )}

                {applicable.includeAnswerKey && (
                  <OptionGroup legend="Answer key" name="answer-key">
                    <Checkbox
                      checked={selection.includeAnswerKey}
                      disabled={disabled}
                      label="Include a parent answer key"
                      onToggle={(checked) => change("includeAnswerKey", checked)}
                    />
                  </OptionGroup>
                )}

                {hasPersonalization && (
                  <OptionGroup legend="Personalization" name="personalization">
                    {showNickname && (
                      <Checkbox
                        checked={selection.useDisplayName}
                        disabled={disabled}
                        label="Put the nickname in the worksheet header"
                        onToggle={(checked) => change("useDisplayName", checked)}
                      />
                    )}
                    {applicable.useInterests && (
                      <Checkbox
                        checked={selection.useInterests}
                        disabled={disabled}
                        label="Use reviewed interests in worksheet content"
                        onToggle={(checked) => change("useInterests", checked)}
                      />
                    )}
                    {applicable.includeDecorativeGraphics && (
                      <Checkbox
                        checked={selection.includeDecorativeGraphics}
                        disabled={disabled}
                        label="Include decorative graphics"
                        onToggle={(checked) =>
                          change("includeDecorativeGraphics", checked)
                        }
                      />
                    )}
                    {applicable.theme && (
                      <>
                        <label className="worksheet-field">
                          Theme
                          <select
                            aria-describedby={THEME_HELP_ID}
                            aria-label="Theme"
                            disabled={disabled}
                            onChange={(event) =>
                              change(
                                "theme",
                                event.currentTarget.value as ThemeChoice,
                              )
                            }
                            value={selection.theme}
                          >
                            {THEME_CHOICES.map((theme) => (
                              <option key={theme} value={theme}>
                                {THEME_LABELS[theme]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p data-theme-help="true" id={THEME_HELP_ID}>
                          {THEME_HELP_TEXT}
                        </p>
                      </>
                    )}
                  </OptionGroup>
                )}

                {hasPrintLayout && (
                  <OptionGroup legend="Print layout" name="print-layout">
                    {applicable.paperSize && (
                      <label className="worksheet-field">
                        Paper size
                        <select
                          aria-label="Paper size"
                          disabled={disabled}
                          onChange={(event) =>
                            change(
                              "paperSize",
                              event.currentTarget
                                .value as WorksheetSelectionV2["paperSize"],
                            )
                          }
                          value={selection.paperSize}
                        >
                          <option value="letter">US Letter</option>
                          <option value="a4">A4</option>
                        </select>
                      </label>
                    )}
                    {applicable.printScale && (
                      <label className="worksheet-field">
                        Print scale
                        <select
                          aria-label="Print scale"
                          disabled={disabled}
                          onChange={(event) =>
                            change(
                              "printScale",
                              event.currentTarget
                                .value as WorksheetSelectionV2["printScale"],
                            )
                          }
                          value={selection.printScale}
                        >
                          <option value="standard">Standard</option>
                          <option value="large">Large</option>
                        </select>
                      </label>
                    )}
                  </OptionGroup>
                )}
              </div>
            </details>
          )}

          {/*
            The save button, its explanation, its confirmation and its failure
            message are ONE slot, so the confirmation lands beside the button
            that produced it; `data-defaults-slot` is the hook the unit test
            and `tests/e2e/options.spec.ts` assert that placement with. The
            slot holds no other control: seeding has no re-enable (D10).
          */}
          <div className="worksheet-defaults-slot" data-defaults-slot="true">
            <button
              disabled={disabled || savingDefaults}
              onClick={() => void saveDefaults()}
              type="button"
            >
              {savingDefaults
                ? "Saving worksheet defaults…"
                : "Save these as worksheet defaults"}
            </button>
            <p>
              Worksheet defaults are stored beside the profiles in the same local
              file and change no child profile.
            </p>
            {seedingNoteShown && (
              <p data-earlier-settings-save-note="true">
                Saving makes these the starting choices for every child.
                Children&apos;s earlier settings stay in the file but will no
                longer be used as starting points.
              </p>
            )}
            {savedAtEpoch !== null && savedAtEpoch === session.previewEpoch && (
              <p aria-live="polite" role="status">
                Worksheet defaults saved locally.
              </p>
            )}
            {defaultsError !== null && <p role="alert">{defaultsError}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
