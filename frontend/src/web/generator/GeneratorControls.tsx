import { useMemo, useState } from "react";

import { getV1ProfileSupport } from "../../shared/config/profile-support";
import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema";
import { WORKSHEET_MAXIMUM_LABELS } from "../../shared/worksheet/limit-labels";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetApplicableControlsV1,
  type WorksheetCapabilitySupportV1,
  type WorksheetControlContextV1,
  type WorksheetRegistrationV1,
  type WorksheetRelevantMaximumKey,
  type WorksheetRelevantMaximumV1,
} from "../../shared/worksheet/registry";
import { V1_NUMERIC_MAXIMUM } from "../../shared/worksheet/types";
import { ConfigApiError, ConfigAuthorityChangedError } from "../api/client";
import type { GenerationSelection } from "./create-session";

interface GeneratorControlsProps {
  readonly defaults: GenerationDefaultsV1;
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
  readonly onSaveDefaults: (defaults: GenerationDefaultsV1) => Promise<void>;
  readonly profiles: readonly ChildProfileV1[];
}

interface RelevantLimit {
  readonly label: string;
  readonly value: number;
}

const NO_APPLICABLE_CONTROLS: WorksheetApplicableControlsV1 = {
  useDisplayName: false,
  useInterests: false,
  includeDecorativeGraphics: false,
  difficulty: false,
  length: false,
  includeAnswerKey: false,
  paperSize: false,
  printScale: false,
};

/**
 * The two stored permissions Version 1 never exercises.
 *
 * The sole projection boundary forces both to `false` in every effective
 * request, so a profile may record them for a later sourced pack without any
 * v1 page ever carrying a regrouped column or a negative result. They are
 * shown here for the same reason a stored maximum above 20 is: a parent who
 * confirmed a capability should see that it is kept and that this version does
 * not use it, rather than wonder why the worksheets ignore it. Keying the
 * labels off the stored field names makes a schema rename a compile error.
 */
const FUTURE_PERMISSION_LABELS = {
  allowRegrouping: "carrying and borrowing",
  allowNegativeResults: "negative results",
} as const satisfies Record<
  keyof Pick<
    ChildProfileV1["mathSkills"],
    "allowRegrouping" | "allowNegativeResults"
  >,
  string
>;

const FUTURE_PERMISSION_KEYS = Object.freeze(
  Object.keys(FUTURE_PERMISSION_LABELS) as (keyof typeof FUTURE_PERMISSION_LABELS)[],
);

/**
 * Every stored numeric maximum, in the order the disclosure below lists them.
 *
 * Read off the label table rather than off the selection's own relevant
 * maxima: like the permission notice beside it, this reports what the PROFILE
 * stores, so a family that reads none of these maxima must still disclose a
 * stored value Version 1 will not use. Keying off the label table makes a new
 * maximum a compile-time addition here rather than a silent omission.
 */
const STORED_MAXIMUM_KEYS = Object.freeze(
  Object.keys(WORKSHEET_MAXIMUM_LABELS) as WorksheetRelevantMaximumKey[],
);

const WORKSHEET_OPTIONS = REGISTERED_WORKSHEET_IDS.map((worksheetId) => ({
  id: worksheetId,
  label: getWorksheetRegistration(worksheetId).displayName,
}));

function profileLabel(profile: ChildProfileV1, index: number): string {
  return `Profile ${index + 1} · ${profile.displayName ?? "No nickname"} · age ${profile.ageYears}`;
}

function worksheetAvailability(
  profile: ChildProfileV1 | undefined,
  registration: WorksheetRegistrationV1,
  context: WorksheetControlContextV1 | undefined,
): WorksheetCapabilitySupportV1 {
  if (profile === undefined || context === undefined) {
    return {
      available: false,
      message: "Add and save a profile before creating a worksheet.",
    };
  }
  const ageSupport = getV1ProfileSupport(profile);
  if (!ageSupport.supported) {
    return {
      available: false,
      message:
        "Version 1 worksheets support ages 4–8. This profile remains saved for a future skill pack.",
    };
  }
  return registration.controls.getCapabilitySupport(context);
}

function relevantMaximums(
  registration: WorksheetRegistrationV1,
  context: WorksheetControlContextV1 | undefined,
): readonly WorksheetRelevantMaximumV1[] {
  return context === undefined
    ? []
    : registration.controls.getRelevantMaximums(context);
}

function relevantLimits(
  maximums: readonly WorksheetRelevantMaximumV1[],
  context: WorksheetControlContextV1 | undefined,
): readonly RelevantLimit[] {
  if (context === undefined) {
    return [];
  }
  return maximums
    .map(({ key, label }) => ({ label, value: context.profile.mathSkills[key] }))
    .filter(({ value }) => value > 0);
}

/**
 * Mirrors the projection boundary's own stretch downgrade: an empty
 * relevant-limit list and an all-at-20 list both fall back to practice, so the
 * parent is never asked to confirm a stretch that cannot change the sheet.
 */
function stretchCannotApply(limits: readonly RelevantLimit[]): boolean {
  return (
    limits.length === 0 ||
    limits.every(({ value }) => value >= V1_NUMERIC_MAXIMUM)
  );
}

function stretchLimit(value: number): readonly [number, number] {
  const base = Math.min(value, V1_NUMERIC_MAXIMUM);
  return [
    base,
    Math.min(V1_NUMERIC_MAXIMUM, base + Math.max(1, Math.ceil(base * 0.25))),
  ];
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
  const [worksheetType, setWorksheetType] =
    useState<RegisteredWorksheetType>("dry-math");
  const [useDisplayName, setUseDisplayName] = useState(defaults.useDisplayName);
  const [useInterests, setUseInterests] = useState(defaults.useInterests);
  const [includeDecorativeGraphics, setIncludeDecorativeGraphics] = useState(
    defaults.includeDecorativeGraphics,
  );
  const [difficulty, setDifficulty] = useState(defaults.difficulty);
  const [length, setLength] = useState(defaults.length);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(
    defaults.includeAnswerKey,
  );
  const [paperSize, setPaperSize] = useState(defaults.paperSize);
  const [printScale, setPrintScale] = useState(defaults.printScale);
  const [stretchConfirmed, setStretchConfirmed] = useState(false);
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
  const selectedRegistration = getWorksheetRegistration(worksheetType);
  // The requested difficulty is used here on purpose: only "confidence" can
  // change which maxima a family reads, and the stretch downgrade below never
  // produces "confidence", so this stays free of a circular dependency.
  const requestedContext: WorksheetControlContextV1 | undefined =
    selectedProfile === undefined
      ? undefined
      : { profile: selectedProfile, difficulty, length, printScale };
  const maximums = relevantMaximums(selectedRegistration, requestedContext);
  const limits = relevantLimits(maximums, requestedContext);
  const stretchUnavailable = stretchCannotApply(limits);
  const effectiveDifficulty =
    difficulty === "stretch" && stretchUnavailable ? "practice" : difficulty;
  // Memoized on its own values because the capacity verdict inside
  // `getCapabilitySupport` enumerates a family's whole candidate collection.
  // That is the right unit to measure in, and it is far too much work to redo
  // on every re-render.
  const controlContext: WorksheetControlContextV1 | undefined = useMemo(
    () =>
      selectedProfile === undefined
        ? undefined
        : {
            profile: selectedProfile,
            difficulty: effectiveDifficulty,
            length,
            printScale,
          },
    [effectiveDifficulty, length, printScale, selectedProfile],
  );
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
    controlContext === undefined
      ? NO_APPLICABLE_CONTROLS
      : selectedRegistration.controls.getApplicableControls(controlContext);
  const effectiveUnit =
    controlContext === undefined
      ? undefined
      : selectedRegistration.controls.getEffectiveUnit(controlContext);
  const unitLabel =
    effectiveUnit?.count === 1
      ? effectiveUnit.singularLabel
      : effectiveUnit?.pluralLabel;
  // Both disclosures below are about what the PROFILE stores, not about what
  // this selection prints. The sole projection boundary clamps every stored
  // maximum to the envelope and pins both flags false in the request every
  // family receives, which `shared/worksheet/project-request.test.ts` asserts
  // directly, so a parent choosing a counted-groups page still needs to be
  // told which stored values are kept and dormant. Scoping either list to the
  // selection's own maxima hides the disclosure on exactly the families a
  // parent of a young child is most likely to pick.
  const limitsAboveV1: readonly RelevantLimit[] =
    selectedProfile === undefined
      ? []
      : STORED_MAXIMUM_KEYS.filter(
          (key) => selectedProfile.mathSkills[key] > V1_NUMERIC_MAXIMUM,
        ).map((key) => ({
          label: WORKSHEET_MAXIMUM_LABELS[key],
          value: selectedProfile.mathSkills[key],
        }));
  const futurePermissions =
    selectedProfile === undefined
      ? []
      : FUTURE_PERMISSION_KEYS.filter(
          (key) => selectedProfile.mathSkills[key],
        ).map((key) => FUTURE_PERMISSION_LABELS[key]);
  const hasMoreOptions =
    applicableControls.difficulty ||
    applicableControls.length ||
    applicableControls.includeAnswerKey ||
    applicableControls.paperSize ||
    applicableControls.printScale;
  const stretchNeedsConfirmation =
    applicableControls.difficulty &&
    difficulty === "stretch" &&
    !stretchUnavailable &&
    !stretchConfirmed;

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
    nextLength: GenerationDefaultsV1["length"],
  ): number | undefined {
    return controlContext === undefined
      ? undefined
      : selectedRegistration.controls.getEffectiveUnit({
          ...controlContext,
          length: nextLength,
        }).count;
  }

  /**
   * The parent's own visible choices, before any family normalization.
   *
   * Stored defaults deliberately keep the RAW selections: the registration and
   * the sole projection boundary canonicalize whatever a family hides at
   * request time, so storing a projected value here would let a stored default
   * silently rewrite an identical visible selection under a different family.
   */
  function currentPreferences(): GenerationDefaultsV1 {
    return {
      useDisplayName,
      useInterests,
      includeDecorativeGraphics,
      difficulty,
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
      await onSaveDefaults(currentPreferences());
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
    if (
      selectedProfile === undefined ||
      controlContext === undefined ||
      !producible ||
      disabled
    ) {
      return;
    }
    const preferences = selectedRegistration.controls.projectPreferences(
      controlContext,
      { ...currentPreferences(), difficulty: effectiveDifficulty },
    );
    onGenerate({
      profile: selectedProfile,
      worksheetType,
      stretchConfirmed: applicableControls.difficulty && stretchConfirmed,
      preferences,
    });
  }

  return (
    <section aria-labelledby="generator-title" style={{ marginTop: "1.5rem" }}>
      <h2 id="generator-title">Create a practice worksheet</h2>
      <p>
        Choose a saved capability profile. Generation stays in this browser tab
        and uses only local deterministic code.
      </p>
      <div style={{ display: "grid", gap: "0.9rem", maxWidth: "42rem" }}>
        <label>
          Child profile
          <select
            aria-label="Child profile"
            disabled={disabled || profiles.length === 0}
            onChange={(event) =>
              changed(() => {
                setProfileId(event.currentTarget.value);
                setStretchConfirmed(false);
              })
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
            aria-label="Worksheet type"
            disabled={disabled}
            onChange={(event) =>
              changed(() => {
                setWorksheetType(
                  event.currentTarget.value as RegisteredWorksheetType,
                );
                setStretchConfirmed(false);
              })
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
          <p aria-live="polite" style={{ background: "#fff5e8", padding: "0.75rem" }}>
            {availability.message}
          </p>
        )}

        {availability.available && availability.statusMessage !== undefined && (
          <p aria-live="polite">{availability.statusMessage}</p>
        )}

        {capacityShortfall !== undefined && (
          <p
            aria-live="polite"
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

        {limitsAboveV1.length > 0 && (
          <p>
            Stored limits reach{" "}
            {limitsAboveV1
              .map(({ label, value }) => `${label} ${value}`)
              .join(", ")}
            {`; Version 1 uses at most ${V1_NUMERIC_MAXIMUM}.`}
          </p>
        )}

        {futurePermissions.length > 0 && (
          <p>
            This profile also allows {futurePermissions.join(", and ")}; Version
            1 never uses {futurePermissions.length === 1 ? "it" : "them"}.
          </p>
        )}

        {hasMoreOptions && (
          <details>
            <summary>More options</summary>
            <div style={{ display: "grid", gap: "0.75rem", padding: "0.75rem 0" }}>
              {applicableControls.difficulty && (
                <>
                  <label>
                    Difficulty
                    <select
                      aria-label="Difficulty"
                      disabled={disabled}
                      onChange={(event) =>
                        changed(() => {
                          setDifficulty(
                            event.currentTarget
                              .value as GenerationDefaultsV1["difficulty"],
                          );
                          setStretchConfirmed(false);
                        })
                      }
                      value={difficulty}
                    >
                      <option value="confidence">Confidence</option>
                      <option value="practice">Practice</option>
                      <option disabled={stretchUnavailable} value="stretch">
                        Stretch
                      </option>
                    </select>
                  </label>
                  {difficulty === "stretch" && stretchUnavailable && (
                    <p role="status">
                      {limits.length === 0
                        ? "This worksheet has no stretchable limits for this profile; practice limits will be used."
                        : "Already at the V1 maximum; practice limits will be used."}
                    </p>
                  )}
                  {difficulty === "stretch" && !stretchUnavailable && (
                    <>
                      {limits.length > 0 && (
                        <p>
                          One-time stretch preview:{" "}
                          {limits
                            .map(
                              ({ label, value }) =>
                                `${label} ${stretchLimit(value).join(" → ")}`,
                            )
                            .join("; ")}
                          .
                        </p>
                      )}
                      <label>
                        <input
                          checked={stretchConfirmed}
                          disabled={disabled}
                          onChange={(event) =>
                            changed(() =>
                              setStretchConfirmed(event.currentTarget.checked),
                            )
                          }
                          type="checkbox"
                        />{" "}
                        Confirm these one-time stretch limits
                      </label>
                    </>
                  )}
                </>
              )}

              {applicableControls.length && (
                <label>
                  Length
                  <select
                    aria-label="Length"
                    disabled={disabled}
                    onChange={(event) =>
                      changed(() =>
                        setLength(
                          event.currentTarget.value as GenerationDefaultsV1["length"],
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
                            .value as GenerationDefaultsV1["paperSize"],
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
                            .value as GenerationDefaultsV1["printScale"],
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
          </details>
        )}

        {producible && effectiveUnit !== undefined && unitLabel !== undefined && (
          <p aria-live="polite">
            This selection creates {effectiveUnit.count} unique {unitLabel} on
            one practice page.
          </p>
        )}

        <button
          disabled={disabled || !producible || stretchNeedsConfirmation}
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
