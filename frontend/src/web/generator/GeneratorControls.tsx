import { useMemo, useState } from "react";

import { getV1ProfileSupport } from "../../shared/config/profile-support";
import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema";
import {
  getDryMathCapabilitySupport,
  getDryMathItemCount,
} from "../../worksheets/dry-math/definition";
import type { GenerationSelection } from "./create-session";

interface GeneratorControlsProps {
  readonly defaults: GenerationDefaultsV1;
  readonly disabled?: boolean;
  readonly onGenerate: (selection: GenerationSelection) => void;
  readonly onInputsChanged: () => void;
  readonly profiles: readonly ChildProfileV1[];
}

function profileLabel(profile: ChildProfileV1, index: number): string {
  return `Profile ${index + 1} · ${profile.displayName ?? "No nickname"} · age ${profile.ageYears}`;
}

function dryMathAvailability(profile: ChildProfileV1 | undefined): {
  readonly available: boolean;
  readonly message?: string;
} {
  if (profile === undefined) {
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
  const capability = getDryMathCapabilitySupport(profile.mathSkills);
  return capability.available
    ? capability
    : { available: false, message: capability.reason };
}

function limitsAlreadyAtV1Maximum(profile: ChildProfileV1 | undefined): boolean {
  return (
    profile !== undefined &&
    profile.mathSkills.operandMax >= 20 &&
    profile.mathSkills.resultMax >= 20
  );
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
  const [useDisplayName, setUseDisplayName] = useState(defaults.useDisplayName);
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
  const availability = dryMathAvailability(selectedProfile);
  const alreadyAtMaximum = limitsAlreadyAtV1Maximum(selectedProfile);
  const effectiveDifficulty =
    difficulty === "stretch" && alreadyAtMaximum ? "practice" : difficulty;

  function changed(change: () => void): void {
    change();
    onInputsChanged();
  }

  function submit(): void {
    if (selectedProfile === undefined || !availability.available || disabled) {
      return;
    }
    onGenerate({
      profile: selectedProfile,
      worksheetType: "dry-math",
      stretchConfirmed,
      preferences: {
        useDisplayName,
        useInterests: false,
        includeDecorativeGraphics: false,
        difficulty: effectiveDifficulty,
        length,
        includeAnswerKey,
        paperSize,
        printScale,
      },
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
          <select aria-label="Worksheet type" disabled value="dry-math">
            <option value="dry-math">Dry Math</option>
          </select>
        </label>

        {!availability.available && availability.message !== undefined && (
          <p aria-live="polite" style={{ background: "#fff5e8", padding: "0.75rem" }}>
            {availability.message}
          </p>
        )}

        {selectedProfile?.displayName !== undefined && (
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

        {selectedProfile !== undefined &&
          (selectedProfile.mathSkills.operandMax > 20 ||
            selectedProfile.mathSkills.resultMax > 20) && (
            <p>
              Stored operation limits reach {selectedProfile.mathSkills.operandMax}
              /{selectedProfile.mathSkills.resultMax}; Version 1 uses at most 20.
            </p>
          )}

        <details>
          <summary>More options</summary>
          <div style={{ display: "grid", gap: "0.75rem", padding: "0.75rem 0" }}>
            <label>
              Difficulty
              <select
                aria-label="Difficulty"
                disabled={disabled}
                onChange={(event) =>
                  changed(() => {
                    setDifficulty(
                      event.currentTarget.value as GenerationDefaultsV1["difficulty"],
                    );
                    setStretchConfirmed(false);
                  })
                }
                value={difficulty}
              >
                <option value="confidence">Confidence</option>
                <option value="practice">Practice</option>
                <option disabled={alreadyAtMaximum} value="stretch">
                  Stretch
                </option>
              </select>
            </label>
            {difficulty === "stretch" && alreadyAtMaximum && (
              <p role="status">Already at the V1 maximum; practice limits will be used.</p>
            )}
            {difficulty === "stretch" && !alreadyAtMaximum && (
              <>
                {selectedProfile !== undefined && (
                  <p>
                    One-time stretch preview: operands{" "}
                    {stretchLimit(selectedProfile.mathSkills.operandMax).join(" → ")};
                    results{" "}
                    {stretchLimit(selectedProfile.mathSkills.resultMax).join(" → ")}.
                  </p>
                )}
                <label>
                  <input
                    checked={stretchConfirmed}
                    disabled={disabled}
                    onChange={(event) =>
                      changed(() => setStretchConfirmed(event.currentTarget.checked))
                    }
                    type="checkbox"
                  />{" "}
                  Confirm these one-time stretch limits
                </label>
              </>
            )}
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
                  Short · {getDryMathItemCount("short", printScale)} problems
                </option>
                <option value="standard">
                  Standard · {getDryMathItemCount("standard", printScale)} problems
                </option>
                <option value="long">
                  Long · {getDryMathItemCount("long", printScale)} problems
                </option>
              </select>
            </label>
            <label>
              <input
                checked={includeAnswerKey}
                disabled={disabled}
                onChange={(event) =>
                  changed(() => setIncludeAnswerKey(event.currentTarget.checked))
                }
                type="checkbox"
              />{" "}
              Include a parent answer key
            </label>
            <label>
              Paper size
              <select
                aria-label="Paper size"
                disabled={disabled}
                onChange={(event) =>
                  changed(() =>
                    setPaperSize(
                      event.currentTarget.value as GenerationDefaultsV1["paperSize"],
                    ),
                  )
                }
                value={paperSize}
              >
                <option value="letter">US Letter</option>
                <option value="a4">A4</option>
              </select>
            </label>
            <label>
              Print scale
              <select
                aria-label="Print scale"
                disabled={disabled}
                onChange={(event) =>
                  changed(() =>
                    setPrintScale(
                      event.currentTarget.value as GenerationDefaultsV1["printScale"],
                    ),
                  )
                }
                value={printScale}
              >
                <option value="standard">Standard</option>
                <option value="large">Large</option>
              </select>
            </label>
          </div>
        </details>

        {availability.available && (
          <p aria-live="polite">
            This selection creates {getDryMathItemCount(length, printScale)} unique
            problems on one practice page.
          </p>
        )}

        <button
          disabled={
            disabled ||
            !availability.available ||
            (difficulty === "stretch" && !alreadyAtMaximum && !stretchConfirmed)
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
