import type { WorksheetDocumentV1 } from "../../shared/worksheet/types";
import { WEB_WORKSHEET_RENDERERS } from "../worksheets/registry";

interface WorksheetPreviewProps {
  readonly document: WorksheetDocumentV1;
}

export function WorksheetPreview({ document }: WorksheetPreviewProps) {
  const Renderer = WEB_WORKSHEET_RENDERERS[document.worksheetType as keyof typeof WEB_WORKSHEET_RENDERERS];
  if (Renderer === undefined) {
    return <p role="alert">No reviewed renderer is registered for this worksheet.</p>;
  }
  return (
    <section
      aria-label="Worksheet preview"
      data-seed={document.seed}
      data-worksheet-type={document.worksheetType}
    >
      <Renderer document={document} />
    </section>
  );
}
