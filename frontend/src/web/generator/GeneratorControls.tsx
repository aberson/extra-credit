import { useMemo, useState } from "react";

import { getV1ProfileSupport } from "../../shared/config/profile-support";
import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetApplicableControlsV1,
  type WorksheetCapabilitySupportV1,
  type WorksheetControlContextV1,
  type WorksheetRegistrationV1,
} from "../../shared/worksheet/registry";
import type { GenerationSelection } from "./create-session";

interface GeneratorControlsProps {
  readonly defaults: GenerationDefaultsV1;
  readonly disabled?: boolean;
  readonly onGenerate: (selection: GenerationSelection) => void;
  readonly onInputsChanged: () => void;
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

function relevantLimits(
  registration: WorksheetRegistrationV1,
  context: WorksheetControlContextV1 | undefined,
): readonly RelevantLimit[] {
  if (context === undefined) {
    return [];
  }
  return registration.controls
    .getRelevantMaximums(context)
    .map(({ key, label }) => ({
      label,
      value: context.profile.mathSkills[key],
    }))
    .filter(({ value }) => value > 0);
}

/**
 * Mirrors the projection boundary's own stretch downgrade: an empty
 * relevant-limit list and an all-at-20 list both fall back to practice, so the
 * parent is never asked to confirm a stretch that cannot change the sheet.
 */
function stretchCannotApply(limits: readonly RelevantLimit[]): boolean {
  return limits.length === 0 || limits.every(({ value }) => value >= 20);
}

function stretchLimit(value: number): readonly [number, number] {
  const base = Math.min(value, 20);
  return [base, Math.min(20, base + Math.max(1, Math.ceil(base * 0.25)))];
}

export function GeneratorControls({
  defaults,
  disabled = false,
  onGenerate,
  onInputsChanged,
  profiles,
}: GeneratorControlsProps) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
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
  const limits = relevantLimits(selectedRegistration, requestedContext);
  const stretchUnavailable = stretchCannotApply(limits);
  const effectiveDifficulty =
    difficulty === "stretch" && stretchUnavailable ? "practice" : difficulty;
  const controlContext: WorksheetControlContextV1 | undefined =
    selectedProfile === undefined
      ? undefined
      : {
          profile: selectedProfile,
          difficulty: effectiveDifficulty,
          length,
          printScale,
        };
  const availability = worksheetAvailability(
    selectedProfile,
    selectedRegistration,
    controlContext,
  );
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
  const limitsAboveV1 = limits.filter(({ value }) => value > 20);
  const hasMoreOptions =
    applicableControls.difficulty ||
    applicableControls.length ||
    applicableControls.includeAnswerKey ||
    applicableControls.paperSize ||
    applicableControls.printScale;

  function changed(change: () => void): void {
    change();
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

  function submit(): void {
    if (
      selectedProfile === undefined ||
      controlContext === undefined ||
      !availability.available ||
      disabled
    ) {
      return;
    }
    const preferences = selectedRegistration.controls.projectPreferences(
      controlContext,
      {
        useDisplayName,
        useInterests,
        includeDecorativeGraphics,
        difficulty: effectiveDifficulty,
        length,
        includeAnswerKey,
        paperSize,
        printScale,
      },
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
            ; Version 1 uses at most 20.
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

        {availability.available &&
          effectiveUnit !== undefined &&
          unitLabel !== undefined && (
            <p aria-live="polite">
              This selection creates {effectiveUnit.count} unique {unitLabel} on
              one practice page.
            </p>
          )}

        <button
          disabled={
            disabled ||
            !availability.available ||
            (applicableControls.difficulty &&
              difficulty === "stretch" &&
              !stretchUnavailable &&
              !stretchConfirmed)
          }
          onClick={submit}
          type="button"
        >
          Create worksheet
        </button>
      </div>
    </section>
  );
}
