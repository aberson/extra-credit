import { useMemo, useState } from "react";

import { themeFromInterests, worksheetSelectionOf } from "../../shared/config/defaults";
import {
  describeEarlierSettingDisclosure,
  selectionForChild,
} from "../../shared/config/earlier-settings";
import type {
  ChildProfileV2,
  WorksheetDefaultsV2,
  WorksheetSelectionV2,
} from "../../shared/config/schema";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetApplicableControlsV1,
  type WorksheetCapabilitySupportV1,
  type WorksheetControlContextV2,
  type WorksheetRegistrationV1,
} from "../../shared/worksheet/registry";
import { ConfigApiError, ConfigAuthorityChangedError } from "../api/client";
import { EARLY_PRIMARY_HELP_TEXT } from "../profiles/ProfileEditor";
import type { GenerationSelection } from "./create-session";

/**
 * The defaults fields this interim panel shows and saves (DD9's pre-panel
 * rule, D-save). The host passes every worksheet group and the seeding flag
 * through unchanged and derives `theme` from `useInterests` (D33).
 */
export type ShownWorksheetDefaults = Pick<
  WorksheetDefaultsV2,
  | "useDisplayName"
  | "useInterests"
  | "includeDecorativeGraphics"
  | "length"
  | "includeAnswerKey"
  | "paperSize"
  | "printScale"
>;

interface GeneratorControlsProps {
  readonly defaults: WorksheetDefaultsV2;
  readonly disabled?: boolean;
  readonly onGenerate: (selection: GenerationSelection) => void;
  readonly onInputsChanged: () => void;
  /**
   * Persists the parent's current option choices as the stored defaults.
   *
   * Required rather than optional so a host that renders these controls
   * without wiring the local configuration round trip fails to compile: a
   * silently unwired save would look exactly like a working one until a parent
   * reloaded and found nothing kept.
   */
  readonly onSaveDefaults: (defaults: ShownWorksheetDefaults) => Promise<void>;
  readonly profiles: readonly ChildProfileV2[];
}

const NO_APPLICABLE_CONTROLS: WorksheetApplicableControlsV1 = {
  useDisplayName: false,
  useInterests: false,
  includeDecorativeGraphics: false,
  practiceFocus: false,
  variant: false,
  vocabulary: false,
  length: false,
  includeAnswerKey: false,
  paperSize: false,
  printScale: false,
};

const WORKSHEET_OPTIONS = REGISTERED_WORKSHEET_IDS.map((worksheetId) => ({
  id: worksheetId,
  label: getWorksheetRegistration(worksheetId).displayName,
}));

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

export function GeneratorControls({
  defaults,
  disabled = false,
  onGenerate,
  onInputsChanged,
  onSaveDefaults,
  profiles,
}: GeneratorControlsProps) {
  const [requestedProfileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [worksheetType, setWorksheetType] = useState<RegisteredWorksheetType>(
    defaults.worksheetType,
  );
  const [useDisplayName, setUseDisplayName] = useState(defaults.useDisplayName);
  const [useInterests, setUseInterests] = useState(defaults.useInterests);
  const [includeDecorativeGraphics, setIncludeDecorativeGraphics] = useState(
    defaults.includeDecorativeGraphics,
  );
  const [length, setLength] = useState(defaults.length);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(
    defaults.includeAnswerKey,
  );
  const [paperSize, setPaperSize] = useState(defaults.paperSize);
  const [printScale, setPrintScale] = useState(defaults.printScale);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  /**
   * The parent's pick, falling back to the first profile when it is no longer
   * in the list.
   *
   * The panel outlives a defaults write and a stale-ETag refresh, either of
   * which can hand it a `profiles` array a concurrently-edited file changed
   * under it. Resolving the id here rather than resetting state on remount is
   * what lets the selection survive a write that changed no child profile,
   * while a genuinely deleted profile still degrades to a real option instead
   * of leaving the select bound to a value it has no `<option>` for.
   */
  const profileId = profiles.some(({ id }) => id === requestedProfileId)
    ? requestedProfileId
    : (profiles[0]?.id ?? "");
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId),
    [profileId, profiles],
  );
  const baseSelection = useMemo(() => worksheetSelectionOf(defaults), [defaults]);
  // Interim (Step 16): the saved defaults with the selected child's earlier
  // settings applied to every group they cover. The visible worksheet-level
  // choices, the seeding flag and touched-state logic arrive together with the
  // worksheet-first panel.
  const earlierSettings = useMemo(
    () => selectionForChild(selectedProfile, baseSelection),
    [baseSelection, selectedProfile],
  );
  // Memoized on its own values because the capacity verdict inside
  // `getCapabilitySupport` enumerates a family's whole candidate collection.
  // That is the right unit to measure in, and it is far too much work to redo
  // on every re-render.
  const selection: WorksheetSelectionV2 = useMemo(
    () => ({
      ...earlierSettings.selection,
      worksheetType,
      useDisplayName,
      useInterests,
      includeDecorativeGraphics,
      includeAnswerKey,
      length,
      paperSize,
      printScale,
      theme: themeFromInterests(useInterests),
    }),
    [
      earlierSettings,
      includeAnswerKey,
      includeDecorativeGraphics,
      length,
      paperSize,
      printScale,
      useDisplayName,
      useInterests,
      worksheetType,
    ],
  );
  const controlContext: WorksheetControlContextV2 = useMemo(
    () => ({ selection }),
    [selection],
  );
  const selectedRegistration = getWorksheetRegistration(worksheetType);
  const availability = useMemo(
    () =>
      worksheetAvailability(
        selectedProfile,
        getWorksheetRegistration(worksheetType),
        controlContext,
      ),
    [controlContext, selectedProfile, worksheetType],
  );
  const capacity = availability.available ? availability.capacity : undefined;
  const capacityShortfall =
    capacity !== undefined && !capacity.sufficient ? capacity.message : undefined;
  const producible = availability.available && capacityShortfall === undefined;
  const applicableControls =
    selectedProfile === undefined
      ? NO_APPLICABLE_CONTROLS
      : selectedRegistration.controls.getApplicableControls(controlContext);
  const effectiveUnit =
    selectedProfile === undefined
      ? undefined
      : selectedRegistration.controls.getEffectiveUnit(controlContext);
  const unitLabel =
    effectiveUnit?.count === 1
      ? effectiveUnit.singularLabel
      : effectiveUnit?.pluralLabel;
  // What the selected child's earlier settings store but this version clamps
  // or never uses. It describes the child's stored values, not this family's
  // page, so it shows whichever worksheet is chosen.
  const earlierSettingDisclosures = earlierSettings.disclosures.map(
    describeEarlierSettingDisclosure,
  );
  const hasMoreOptions =
    applicableControls.length ||
    applicableControls.includeAnswerKey ||
    applicableControls.paperSize ||
    applicableControls.printScale;

  function changed(change: () => void): void {
    change();
    setDefaultsError(null);
    // The confirmation describes the selection that was saved, so a changed
    // selection retires it: otherwise "saved" sits beside choices the parent
    // has since changed and not saved, with nothing telling the two apart.
    setDefaultsSaved(false);
    onInputsChanged();
  }

  function effectiveUnitForLength(
    nextLength: WorksheetSelectionV2["length"],
  ): number | undefined {
    return selectedProfile === undefined
      ? undefined
      : selectedRegistration.controls.getEffectiveUnit({
          selection: { ...selection, length: nextLength },
        }).count;
  }

  /**
   * The parent's own visible choices, before any family normalization.
   *
   * Stored defaults deliberately keep the RAW selections: the sole projection
   * boundary canonicalizes whatever a family hides at request time, so storing
   * a projected value here would let a stored default silently rewrite an
   * identical visible selection under a different family.
   */
  function shownDefaults(): ShownWorksheetDefaults {
    return {
      useDisplayName,
      useInterests,
      includeDecorativeGraphics,
      length,
      includeAnswerKey,
      paperSize,
      printScale,
    };
  }

  async function saveDefaults(): Promise<void> {
    if (disabled || savingDefaults) {
      return;
    }
    setSavingDefaults(true);
    setDefaultsError(null);
    setDefaultsSaved(false);
    try {
      await onSaveDefaults(shownDefaults());
      setDefaultsSaved(true);
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
    <section aria-labelledby="generator-title" style={{ marginTop: "1.5rem" }}>
      <h2 id="generator-title">Create a practice worksheet</h2>
      <p data-early-primary-help="true">{EARLY_PRIMARY_HELP_TEXT}</p>
      <p>
        Generation stays in this browser tab and uses only local deterministic
        code.
      </p>
      <div style={{ display: "grid", gap: "0.9rem", maxWidth: "42rem" }}>
        <label>
          Child profile
          <select
            aria-label="Child profile"
            disabled={disabled || profiles.length === 0}
            onChange={(event) =>
              changed(() => setProfileId(event.currentTarget.value))
            }
            value={profileId}
          >
            {profiles.length === 0 && <option value="">No saved profiles</option>}
            {profiles.map((profile, index) => (
              <option key={profile.id} value={profile.id}>
                {profileLabel(profile, index)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Worksheet type
          <select
            aria-describedby={!availability.available ? "generation-unavailable" : undefined}
            aria-label="Worksheet type"
            disabled={disabled}
            onChange={(event) =>
              changed(() =>
                setWorksheetType(
                  event.currentTarget.value as RegisteredWorksheetType,
                ),
              )
            }
            value={worksheetType}
          >
            {WORKSHEET_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {!availability.available && (
          <p id="generation-unavailable" aria-live="polite" style={{ background: "#fff5e8", padding: "0.75rem" }}>
            {availability.message}
          </p>
        )}

        {availability.available && availability.statusMessage !== undefined && (
          <p aria-live="polite">{availability.statusMessage}</p>
        )}

        {capacityShortfall !== undefined && (
          <p
            aria-live="polite"
            id="generation-capacity"
            data-capacity-conflict="true"
            style={{ background: "#fff5e8", padding: "0.75rem" }}
          >
            {capacityShortfall}
          </p>
        )}

        {applicableControls.useDisplayName &&
          selectedProfile?.displayName !== undefined && (
            <label>
              <input
                checked={useDisplayName}
                disabled={disabled}
                onChange={(event) =>
                  changed(() => setUseDisplayName(event.currentTarget.checked))
                }
                type="checkbox"
              />{" "}
              Put the nickname in the worksheet header
            </label>
          )}

        {applicableControls.useInterests && (
          <label>
            <input
              checked={useInterests}
              disabled={disabled}
              onChange={(event) =>
                changed(() => setUseInterests(event.currentTarget.checked))
              }
              type="checkbox"
            />{" "}
            Use reviewed interests in worksheet content
          </label>
        )}

        {applicableControls.includeDecorativeGraphics && (
          <label>
            <input
              checked={includeDecorativeGraphics}
              disabled={disabled}
              onChange={(event) =>
                changed(() =>
                  setIncludeDecorativeGraphics(event.currentTarget.checked),
                )
              }
              type="checkbox"
            />{" "}
            Include decorative graphics
          </label>
        )}

        {earlierSettingDisclosures.length > 0 && (
          <p data-earlier-settings-disclosure="true">
            Earlier settings this version adjusts or does not use:{" "}
            {earlierSettingDisclosures.join(" ")}
          </p>
        )}

        {hasMoreOptions && (
          <details>
            <summary>More options</summary>
            <div style={{ display: "grid", gap: "0.75rem", padding: "0.75rem 0" }}>
              {applicableControls.length && (
                <label>
                  Length
                  <select
                    aria-label="Length"
                    disabled={disabled}
                    onChange={(event) =>
                      changed(() =>
                        setLength(
                          event.currentTarget.value as WorksheetSelectionV2["length"],
                        ),
                      )
                    }
                    value={length}
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
                </label>
              )}

              {applicableControls.includeAnswerKey && (
                <label>
                  <input
                    checked={includeAnswerKey}
                    disabled={disabled}
                    onChange={(event) =>
                      changed(() =>
                        setIncludeAnswerKey(event.currentTarget.checked),
                      )
                    }
                    type="checkbox"
                  />{" "}
                  Include a parent answer key
                </label>
              )}

              <div role="group" aria-label="Print layout" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))", gap: "0.75rem" }}>
              {applicableControls.paperSize && (
                <label>
                  Paper size
                  <select
                    aria-label="Paper size"
                    disabled={disabled}
                    onChange={(event) =>
                      changed(() =>
                        setPaperSize(
                          event.currentTarget
                            .value as WorksheetSelectionV2["paperSize"],
                        ),
                      )
                    }
                    value={paperSize}
                  >
                    <option value="letter">US Letter</option>
                    <option value="a4">A4</option>
                  </select>
                </label>
              )}

              {applicableControls.printScale && (
                <label>
                  Print scale
                  <select
                    aria-label="Print scale"
                    disabled={disabled}
                    onChange={(event) =>
                      changed(() =>
                        setPrintScale(
                          event.currentTarget
                            .value as WorksheetSelectionV2["printScale"],
                        ),
                      )
                    }
                    value={printScale}
                  >
                    <option value="standard">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              )}
              </div>
            </div>
          </details>
        )}

        {producible && effectiveUnit !== undefined && unitLabel !== undefined && (
          <p aria-live="polite">
            This selection creates {effectiveUnit.count} unique {unitLabel} on
            one practice page.
          </p>
        )}

        <button
          aria-describedby={!availability.available ? "generation-unavailable" : capacityShortfall !== undefined ? "generation-capacity" : undefined}
          disabled={disabled || !producible}
          onClick={submit}
          type="button"
        >
          Create worksheet
        </button>

        {/*
          The save button, its explanation, its confirmation and its failure
          message are ONE slot. The confirmation used to render in the global
          profiles status line far above the button, so the click produced no
          visible change near the pointer; `data-defaults-slot` is the hook the
          unit test and `tests/e2e/options.spec.ts` assert that placement with,
          because "somewhere in this panel" is satisfied by the top of the page.
        */}
        <div data-defaults-slot="true">
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
          {defaultsSaved && (
            <p aria-live="polite" role="status">
              Worksheet defaults saved locally.
            </p>
          )}
          {defaultsError !== null && <p role="alert">{defaultsError}</p>}
        </div>
      </div>
    </section>
  );
}
