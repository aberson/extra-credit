import { useState, type CSSProperties } from "react";

import type { WorksheetDocumentV1 } from "../../shared/worksheet/types";
import { WorksheetPreview } from "../preview/WorksheetPreview";
import { AnswerKeyView } from "./AnswerKeyView";

interface PrintViewProps {
  readonly document: WorksheetDocumentV1;
}

function surfaceButtonStyle(selected: boolean): CSSProperties {
  return {
    background: selected ? "#24324a" : "#ffffff",
    border: "2px solid #24324a",
    borderRadius: "0.45rem",
    color: selected ? "#ffffff" : "#24324a",
    fontWeight: selected ? 750 : 600,
    padding: "0.5rem 0.75rem",
  };
}

export function PrintView({ document }: PrintViewProps) {
  const [surface, setSurface] = useState<"worksheet" | "answer">("worksheet");
  const answerKeyAvailable = document.request.options.includeAnswerKey;
  const effectiveSurface = answerKeyAvailable ? surface : "worksheet";

  return (
    <section aria-labelledby="preview-title" style={{ marginTop: "1.5rem" }}>
      <style>{`@media print { .print-controls, .profile-workspace { display: none !important; } .print-surface { border: 0 !important; box-shadow: none !important; } }`}</style>
      <div className="print-controls">
        <h2 id="preview-title">Preview and print</h2>
        <p>
          Preview the child page or the separate parent key. Browser print settings
          control the final paper output.
        </p>
        <div aria-label="Print surface" role="group">
          <button
            aria-pressed={effectiveSurface === "worksheet"}
            data-selected={effectiveSurface === "worksheet"}
            onClick={() => setSurface("worksheet")}
            style={surfaceButtonStyle(effectiveSurface === "worksheet")}
            type="button"
          >
            Worksheet
          </button>{" "}
          {answerKeyAvailable && (
            <button
              aria-pressed={effectiveSurface === "answer"}
              data-selected={effectiveSurface === "answer"}
              onClick={() => setSurface("answer")}
              style={surfaceButtonStyle(effectiveSurface === "answer")}
              type="button"
            >
              Parent answer key
            </button>
          )}{" "}
          <button onClick={() => window.print()} type="button">
            Print current page
          </button>
        </div>
      </div>
      <div
        className="print-surface"
        data-paper-size={document.request.options.paperSize}
        data-print-scale={document.request.options.printScale}
        data-surface={effectiveSurface}
        style={{
          background: "white",
          border: "1px solid #c7ced8",
          borderRadius: "0.5rem",
          boxShadow: "0 0.75rem 2rem rgb(36 50 74 / 10%)",
          marginTop: "1rem",
          padding: "clamp(1rem, 3vw, 2rem)",
        }}
      >
        {effectiveSurface === "worksheet" ? (
          <WorksheetPreview document={document} />
        ) : (
          <AnswerKeyView document={document} />
        )}
      </div>
    </section>
  );
}
