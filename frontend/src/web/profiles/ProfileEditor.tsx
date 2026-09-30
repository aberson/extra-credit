import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";

import {
  expandMathPreset,
  MATH_PRESETS,
  MATH_PRESET_IDS,
  type ConcreteMathPresetId,
  type MathPresetId,
} from "../../shared/config/math-presets";
import {
  ChildProfileV2Schema,
  WRITING_MODES,
  type ChildProfileV2,
  type LegacyChoicesV2,
  type MathSkillsV1,
  type PresentationBand,
  type WritingMode,
} from "../../shared/config/schema";
import {
  ConfigApiError,
  ConfigAuthorityChangedError,
} from "../api/client";
import { MathSkillsEditor } from "./MathSkillsEditor";

/**
 * DD10's help text, shown by the profile editor and the generator
 * introduction. It names no age: the worksheets are designed for early
 * primary practice, and the parent chooses the work that fits.
 */
export const EARLY_PRIMARY_HELP_TEXT =
  "Extra Credit's worksheets are designed for early primary practice. Choose the worksheet and practice focus that fit your child.";

/**
 * Interim (D-interim, Steps 15-17): the form still edits a child's earlier
 * writing mode, vocabulary band and math values, and saves them as the
 * profile's read-only `legacyChoices`. A new profile, or one stored without
 * them, cannot be saved until a math preset is chosen explicitly.
 */
export interface ProfileEditorProps {
  readonly onCancel: () => void;
  readonly onDraftChange?: (profile: ChildProfileV2 | undefined) => void;
  readonly onResolveConflict?: () => Promise<void>;
  readonly onSubmit: (profile: ChildProfileV2) => Promise<void>;
  readonly operationPending?: boolean;
  readonly profile?: ChildProfileV2;
  readonly recoveryMode?: boolean;
}

const blankMathSkills: MathSkillsV1 = {
  countingMax: 10,
  numeralMax: 10,
  compareMax: 10,
  representations: ["quantities"],
  understandsEquality: false,
  operations: [],
  operandMax: 0,
  resultMax: 0,
  allowRegrouping: false,
  allowNegativeResults: false,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.25rem",
};

const inputStyle: CSSProperties = {
  border: "1px solid #9eabbc",
  borderRadius: "0.45rem",
  font: "inherit",
  padding: "0.5rem 0.6rem",
  width: "100%",
};

function todayIso(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function cloneMathSkills(mathSkills: MathSkillsV1): MathSkillsV1 {
  return {
    ...mathSkills,
    representations: [...mathSkills.representations],
    operations: [...mathSkills.operations],
  };
}

function sameMathSkills(left: MathSkillsV1, right: MathSkillsV1): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inferPreset(legacy: LegacyChoicesV2): MathPresetId {
  for (const presetId of MATH_PRESET_IDS) {
    if (presetId === "custom") continue;
    const definition = MATH_PRESETS[presetId];
    if (
      sameMathSkills(legacy.mathSkills, definition.mathSkills) &&
      (definition.presentationBand === null ||
        definition.presentationBand === legacy.presentationBand)
    ) {
      return presetId;
    }
  }
  return "custom";
}

function parseInterests(value: string): string[] {
  return value
    .split(",")
    .map((interest) => interest.trim())
    .filter((interest) => interest.length > 0);
}

function isReviewOverdue(reviewedOn: string): boolean {
  const reviewed = new Date(`${reviewedOn}T00:00:00Z`);
  if (Number.isNaN(reviewed.getTime())) {
    return false;
  }
  const unboundedMonth = reviewed.getUTCMonth() + 9;
  const reminderYear = reviewed.getUTCFullYear() + Math.floor(unboundedMonth / 12);
  const reminderMonth = unboundedMonth % 12;
  const lastReminderMonthDay = new Date(
    Date.UTC(reminderYear, reminderMonth + 1, 0),
  ).getUTCDate();
  const reminderDay = Math.min(reviewed.getUTCDate(), lastReminderMonthDay);
  const reminder = Date.UTC(reminderYear, reminderMonth, reminderDay);
  return reminder <= Date.now();
}

function formatIssues(issues: readonly { readonly message: string; readonly path: PropertyKey[] }[]): string {
  return issues
    .map((issue) => {
      const field = issue.path[0];
      return `${typeof field === "string" ? field : "Profile"}: ${issue.message}`;
    })
    .join(" ");
}

export function ProfileEditor({
  onCancel,
  onDraftChange,
  onResolveConflict,
  onSubmit,
  operationPending = false,
  profile,
  recoveryMode = false,
}: ProfileEditorProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const isEditing = profile !== undefined;
  const legacy = profile?.legacyChoices;
  const [id] = useState(() => profile?.id ?? crypto.randomUUID());
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [presentationBand, setPresentationBand] = useState<PresentationBand>(
    legacy?.presentationBand ?? "preschool",
  );
  const [presentationBandConfirmed, setPresentationBandConfirmed] = useState(
    legacy !== undefined,
  );
  const [mathSkills, setMathSkills] = useState<MathSkillsV1>(() =>
    cloneMathSkills(legacy?.mathSkills ?? blankMathSkills),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<MathPresetId | null>(
    legacy === undefined ? null : inferPreset(legacy),
  );
  const [presetConfirmed, setPresetConfirmed] = useState(legacy !== undefined);
  const [writingMode, setWritingMode] = useState<WritingMode>(
    legacy?.writingMode ?? "label",
  );
  const [reviewedOn, setReviewedOn] = useState(profile?.reviewedOn ?? todayIso());
  const [interestsText, setInterestsText] = useState(
    profile?.interests.join(", ") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (error !== null) errorRef.current?.focus(); }, [error]);
  const [saving, setSaving] = useState(false);
  const [conflictState, setConflictState] = useState<
    "none" | "needs-reload" | "reloading" | "reconciled"
  >("none");

  const draftInput = useMemo(
    () => ({
      id,
      ...(displayName.trim().length === 0 ? {} : { displayName }),
      reviewedOn,
      interests: parseInterests(interestsText),
      legacyChoices: {
        presentationBand,
        writingMode,
        mathSkills,
      },
    }),
    [
      displayName,
      id,
      interestsText,
      mathSkills,
      presentationBand,
      reviewedOn,
      writingMode,
    ],
  );
  const parsedDraft = useMemo(
    () => ChildProfileV2Schema.safeParse(draftInput),
    [draftInput],
  );
  const capabilitiesConfirmed = selectedPresetId !== null && presetConfirmed;

  useEffect(() => {
    onDraftChange?.(
      parsedDraft.success && capabilitiesConfirmed && presentationBandConfirmed
        ? parsedDraft.data
        : undefined,
    );
  }, [capabilitiesConfirmed, onDraftChange, parsedDraft, presentationBandConfirmed]);

  /** A preset is only ever applied by the parent's own explicit choice. */
  function applyPreset(presetId: ConcreteMathPresetId): void {
    const expanded = expandMathPreset(presetId, presentationBand);
    setSelectedPresetId(presetId);
    setMathSkills(cloneMathSkills(expanded.mathSkills));
    setPresentationBand(expanded.presentationBand);
    setPresetConfirmed(true);
    setPresentationBandConfirmed(MATH_PRESETS[presetId].presentationBand !== null);
  }

  function handlePresetSelection(presetId: MathPresetId): void {
    if (presetId === "custom") {
      setSelectedPresetId("custom");
      setPresetConfirmed(true);
      return;
    }
    applyPreset(presetId);
  }

  function handleBandChange(band: PresentationBand): void {
    setPresentationBand(band);
    setPresentationBandConfirmed(true);
    const fixedBand =
      selectedPresetId === null || selectedPresetId === "custom"
        ? null
        : MATH_PRESETS[selectedPresetId].presentationBand;
    if (fixedBand !== null && band !== fixedBand) {
      setSelectedPresetId("custom");
      setPresetConfirmed(true);
    } else if (selectedPresetId !== null) {
      setPresetConfirmed(true);
    }
  }

  function handleMathSkillsChange(next: MathSkillsV1): void {
    setMathSkills(next);
    setSelectedPresetId("custom");
    setPresetConfirmed(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (operationPending) {
      return;
    }

    if (!capabilitiesConfirmed || !presentationBandConfirmed) {
      setError("Review and confirm a capability preset and presentation band before saving.");
      return;
    }
    if (!parsedDraft.success) {
      setError(formatIssues(parsedDraft.error.issues));
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsedDraft.data);
    } catch (saveError) {
      if (saveError instanceof ConfigApiError) {
        if (saveError.code === "SESSION_TOKEN_INVALID") {
          setError(
            "The local server restarted. Your unsaved changes are still here. Press Save again to use the fresh local session.",
          );
        } else if (saveError instanceof ConfigAuthorityChangedError) {
          setConflictState("needs-reload");
          setError(
            recoveryMode || saveError.code === "CONFIG_RECOVERY_NOT_ALLOWED"
              ? "The live file is no longer the invalid revision this recovery started from. Your unsaved changes are still here and were not written. Load the latest profiles before trying again."
              : "Another tab saved newer profiles. Your unsaved changes are still here and were not written. Load the latest profiles before trying again.",
          );
        } else {
          setError(`${saveError.message} Your unsaved changes are still here.`);
        }
      } else {
        setError("The profile could not be saved. Your unsaved changes are still here.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConflictReload(): Promise<void> {
    if (onResolveConflict === undefined || operationPending) {
      return;
    }
    setConflictState("reloading");
    setError(null);
    try {
      await onResolveConflict();
      setConflictState("reconciled");
    } catch (reloadError) {
      setConflictState("needs-reload");
      const message =
        reloadError instanceof ConfigApiError
          ? reloadError.message
          : "The latest saved profiles could not be loaded safely.";
      setError(`${message} Your unsaved changes are still here.`);
    }
  }

  return (
    <form aria-describedby={error === null ? undefined : "profile-error"} aria-labelledby="profile-editor-title" onSubmit={(event) => void handleSubmit(event)}>
      <header style={{ marginBottom: "0.8rem" }}>
        <p style={{ color: "#a14d2c", fontSize: "0.76rem", fontWeight: 750, letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
          {recoveryMode ? "Recovery replacement" : isEditing ? "Edit profile" : "New profile"}
        </p>
        <h2 ref={headingRef} tabIndex={-1} id="profile-editor-title" style={{ margin: "0.15rem 0 0" }}>
          {isEditing ? "Update this profile" : "Set up a profile"}
        </h2>
        <p data-early-primary-help="true" style={{ color: "#566278", margin: "0.45rem 0 0" }}>
          {EARLY_PRIMARY_HELP_TEXT}
        </p>
      </header>

      <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))" }}>
        <label style={fieldStyle}>
          Nickname (optional)
          <input
            aria-describedby="profile-privacy"
            autoComplete="off"
            onChange={(event) => setDisplayName(event.target.value)}
            style={inputStyle}
            value={displayName}
          />
        </label>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend>Writing mode</legend>
          <select
            aria-describedby="writing-mode-help"
            aria-label="Writing mode"
            onChange={(event) => setWritingMode(event.target.value as WritingMode)}
            style={inputStyle}
            value={writingMode}
          >
            {WRITING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode.replaceAll("-", " ")}
              </option>
            ))}
          </select>
          <p id="writing-mode-help">
            Changes Sentence Builder only: draw and tell a grown-up, label a
            picture, copy a model sentence, finish a sentence frame, or write
            independently. It does not change math worksheets.
          </p>
        </fieldset>
        <label style={fieldStyle}>
          Reviewed on
          <input
            onChange={(event) => setReviewedOn(event.target.value)}
            required
            style={inputStyle}
            type="date"
            value={reviewedOn}
          />
        </label>
      </div>

      {profile !== undefined && isReviewOverdue(reviewedOn) && (
        <p role="status" style={{ background: "#fff7e7", borderRadius: "0.5rem", padding: "0.65rem" }}>
          Nine months have passed since this profile was reviewed.
          Check the capabilities when convenient; this reminder does not change them.
        </p>
      )}

      <div style={{ marginTop: "0.8rem" }}>
        <MathSkillsEditor
          mathSkills={mathSkills}
          onMathSkillsChange={handleMathSkillsChange}
          onPresentationBandChange={handleBandChange}
          onSelectPreset={handlePresetSelection}
          presentationBand={presentationBand}
          presentationBandConfirmed={presentationBandConfirmed}
          selectedPresetId={selectedPresetId}
        />
      </div>

      <label style={{ ...fieldStyle, marginTop: "0.8rem" }}>
        Broad interests (optional, separated by commas)
        <input
          aria-describedby="profile-privacy"
          autoComplete="off"
          onChange={(event) => setInterestsText(event.target.value)}
          placeholder="animals, space"
          style={inputStyle}
          value={interestsText}
        />
      </label>
      <p id="profile-privacy" style={{ color: "#5c6677", fontSize: "0.88rem", margin: "0.35rem 0 0" }}>
        Use a nickname and broad topics only. Do not enter a surname or legal name,
        exact birthdate, school, teacher, email, location, photo, voice, diagnosis,
        scores, behavioral details, or private history.
      </p>

      {error !== null && (
        <div ref={errorRef} tabIndex={-1} id="profile-error" role="alert" style={{ background: "#fff0ee", borderLeft: "0.25rem solid #b23a3a", marginTop: "0.8rem", padding: "0.7rem" }}>
          {error}
          {conflictState === "needs-reload" && onResolveConflict !== undefined && (
            <div style={{ marginTop: "0.6rem" }}>
              <button
                disabled={operationPending}
                onClick={() => void handleConflictReload()}
                type="button"
              >
                Load latest profiles and keep this draft
              </button>
            </div>
          )}
        </div>
      )}

      {conflictState === "reloading" && (
        <p aria-live="polite" role="status">
          Loading the latest saved profiles while keeping this draft…
        </p>
      )}
      {conflictState === "reconciled" && (
        <p role="status">
          Latest saved profiles loaded. Every draft field is still here. Review
          the draft, then press Save profile to write it explicitly.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "1rem" }}>
        <button
          disabled={
            saving ||
            operationPending ||
            conflictState === "needs-reload" ||
            conflictState === "reloading"
          }
          type="submit"
        >
          {saving
            ? "Saving…"
            : recoveryMode
              ? "Back up invalid file and replace"
              : "Save profile"}
        </button>
        {!recoveryMode && (
          <button
            disabled={saving || operationPending || conflictState === "reloading"}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
