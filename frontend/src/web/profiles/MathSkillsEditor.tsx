import type { CSSProperties } from "react";

import {
  MATH_PRESETS,
  type ConcreteMathPresetId,
  type MathPresetId,
} from "../../shared/config/math-presets";
import {
  MATH_OPERATIONS,
  MathSkillsV1Schema,
  PRESENTATION_BANDS,
  REPRESENTATIONS,
  type MathSkillsV1,
  type PresentationBand,
} from "../../shared/config/schema";

export interface MathSkillsEditorProps {
  readonly mathSkills: MathSkillsV1;
  readonly onMathSkillsChange: (mathSkills: MathSkillsV1) => void;
  readonly onPresentationBandChange: (band: PresentationBand) => void;
  readonly onSelectPreset: (presetId: MathPresetId) => void;
  readonly presentationBand: PresentationBand;
  readonly presentationBandConfirmed: boolean;
  readonly selectedPresetId: MathPresetId | null;
}

const presetLabels: Record<ConcreteMathPresetId, string> = {
  "quantities-to-10": "Quantities to 10",
  "emerging-equations-within-5": "Emerging equations within 5",
  "early-primary-within-10": "Early primary within 10",
  "early-primary-within-20": "Early primary within 20",
  "addition-within-20": "Addition within 20",
  "subtraction-within-20": "Subtraction within 20",
  "arithmetic-within-50": "Addition and subtraction within 50",
  "arithmetic-within-100": "Addition and subtraction within 100",
};

const fieldsetStyle: CSSProperties = {
  border: "1px solid #ccd4df",
  borderRadius: "0.8rem",
  margin: 0,
  padding: "0.8rem",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: "0.7rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr))",
};

function replaceArrayValue<T extends string>(
  current: readonly T[],
  value: T,
  enabled: boolean,
  canonicalOrder: readonly T[],
): T[] {
  const values = enabled
    ? [...current, value]
    : current.filter((candidate) => candidate !== value);
  return canonicalOrder.filter((candidate) => values.includes(candidate));
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function MathSkillsEditor({
  mathSkills,
  onMathSkillsChange,
  onPresentationBandChange,
  onSelectPreset,
  presentationBand,
  presentationBandConfirmed,
  selectedPresetId,
}: MathSkillsEditorProps) {
  const selectedDefinition =
    selectedPresetId === null ? null : MATH_PRESETS[selectedPresetId];
  const showCustom = selectedPresetId === "custom";

  return (
    <fieldset style={fieldsetStyle}>
      <legend style={{ fontWeight: 750 }}>Math capabilities</legend>
      <p style={{ marginTop: 0 }}>
        Choose the preset that matches what you have seen your child do. No
        preset is chosen for you.
      </p>

      <fieldset style={{ ...fieldsetStyle, marginTop: "0.6rem" }}>
        <legend>Math preset</legend>
        <p>Dry Math supports facts through 100 without carrying or borrowing. Counting pictures and Wow activities stay within 20.</p>
        <div style={gridStyle}>
          {(Object.keys(presetLabels) as ConcreteMathPresetId[]).map((presetId) => (
            <label key={presetId} style={{ alignItems: "start", display: "flex", gap: "0.45rem" }}>
              <input
                checked={selectedPresetId === presetId}
                name="math-preset"
                onChange={() => onSelectPreset(presetId)}
                type="radio"
              />
              <span>{presetLabels[presetId]}</span>
            </label>
          ))}
          <label style={{ alignItems: "start", display: "flex", gap: "0.45rem" }}>
            <input
              checked={selectedPresetId === "custom"}
              name="math-preset"
              onChange={() => onSelectPreset("custom")}
              type="radio"
            />
            <span>Custom capabilities</span>
          </label>
        </div>
      </fieldset>

      {(selectedDefinition?.presentationBand == null || selectedPresetId === "custom") && (
      <fieldset style={{ ...fieldsetStyle, marginTop: "0.8rem" }}>
        <legend>Sentence vocabulary</legend>
        <p>Chooses the prompt vocabulary for Sentence Builder. Math difficulty comes from the math preset.</p>
        {!presentationBandConfirmed && selectedDefinition?.presentationBand === null && (
          <p style={{ color: "#784a14", marginTop: 0 }}>
            Choose the presentation band explicitly for this capability set.
          </p>
        )}
        {PRESENTATION_BANDS.map((band) => (
          <label key={band} style={{ marginRight: "1rem" }}>
            <input
              checked={
                presentationBand === band &&
                (presentationBandConfirmed || selectedDefinition?.presentationBand === band)
              }
              name="presentation-band"
              onChange={() => onPresentationBandChange(band)}
              type="radio"
            />{" "}
            {band === "preschool" ? "Preschool" : "Early primary"}
          </label>
        ))}
      </fieldset>
      )}

      {selectedDefinition !== null && selectedDefinition.mathSkills !== null && !showCustom && (
        <dl
          aria-label="Expanded capability values"
          style={{
            background: "#f5f7fa",
            display: "grid",
            gap: "0.3rem 0.8rem",
            gridTemplateColumns: "minmax(0, 1fr)",
            margin: "0.8rem 0 0",
            padding: "0.7rem",
          }}
        >
          <dt>Counting / numeral / compare</dt>
          <dd style={{ margin: 0 }}>
            {mathSkills.countingMax} / {mathSkills.numeralMax} / {mathSkills.compareMax}
          </dd>
          <dt>Representations</dt>
          <dd style={{ margin: 0 }}>{mathSkills.representations.join(", ")}</dd>
          <dt>Equality</dt>
          <dd style={{ margin: 0 }}>{mathSkills.understandsEquality ? "understood" : "not assumed"}</dd>
          <dt>Operations</dt>
          <dd style={{ margin: 0 }}>{mathSkills.operations.join(", ") || "none"}</dd>
          <dt>Operand / result maximum</dt>
          <dd style={{ margin: 0 }}>{mathSkills.operandMax} / {mathSkills.resultMax}</dd>
          <dt>Sentence vocabulary</dt>
          <dd style={{ margin: 0 }}>{presentationBand === "preschool" ? "Preschool" : "Early primary"}</dd>
        </dl>
      )}

      <details open={showCustom} style={{ marginTop: "0.8rem" }}>
        <summary>Advanced capability fields</summary>
        <div style={{ ...gridStyle, marginTop: "0.7rem" }}>
          {([
            ["Counting maximum", "countingMax"],
            ["Numeral maximum", "numeralMax"],
            ["Comparison maximum", "compareMax"],
            ["Operand maximum", "operandMax"],
            ["Result maximum", "resultMax"],
          ] as const).map(([label, key]) => (
            <label key={key} style={{ display: "grid", gap: "0.2rem" }}>
              {label}
              <input
                disabled={!showCustom}
                // The frozen v1 field is the only place these bounds are written.
                max={MathSkillsV1Schema.shape[key].maxValue ?? undefined}
                min={MathSkillsV1Schema.shape[key].minValue ?? undefined}
                onChange={(event) =>
                  onMathSkillsChange({
                    ...mathSkills,
                    [key]: numericValue(event.target.value, mathSkills[key]),
                  })
                }
                type="number"
                value={mathSkills[key]}
              />
            </label>
          ))}
        </div>

        <fieldset disabled={!showCustom} style={{ ...fieldsetStyle, marginTop: "0.7rem" }}>
          <legend>Representations</legend>
          {REPRESENTATIONS.map((representation) => (
            <label key={representation} style={{ marginRight: "1rem" }}>
              <input
                checked={mathSkills.representations.includes(representation)}
                onChange={(event) =>
                  onMathSkillsChange({
                    ...mathSkills,
                    representations: replaceArrayValue(
                      mathSkills.representations,
                      representation,
                      event.target.checked,
                      REPRESENTATIONS,
                    ),
                  })
                }
                type="checkbox"
              />{" "}
              {representation}
            </label>
          ))}
        </fieldset>

        <fieldset disabled={!showCustom} style={{ ...fieldsetStyle, marginTop: "0.7rem" }}>
          <legend>Operations</legend>
          {MATH_OPERATIONS.map((operation) => (
            <label key={operation} style={{ marginRight: "1rem" }}>
              <input
                checked={mathSkills.operations.includes(operation)}
                onChange={(event) => {
                  const operations = replaceArrayValue(
                    mathSkills.operations,
                    operation,
                    event.target.checked,
                    MATH_OPERATIONS,
                  );
                  onMathSkillsChange({
                    ...mathSkills,
                    operations,
                    ...(operations.length === 0
                      ? { operandMax: 0, resultMax: 0 }
                      : mathSkills.operandMax === 0 || mathSkills.resultMax === 0
                        ? { operandMax: 5, resultMax: 5 }
                        : {}),
                  });
                }}
                type="checkbox"
              />{" "}
              {operation}
            </label>
          ))}
        </fieldset>

        {([
          ["Parent confirms understanding of equality", "understandsEquality"],
        ] as const).map(([label, key]) => (
          <label key={key} style={{ display: "block", marginTop: "0.55rem" }}>
            <input
              checked={mathSkills[key]}
              disabled={!showCustom}
              onChange={(event) =>
                onMathSkillsChange({ ...mathSkills, [key]: event.target.checked })
              }
              type="checkbox"
            />{" "}
            {label}
          </label>
        ))}
      </details>
    </fieldset>
  );
}
