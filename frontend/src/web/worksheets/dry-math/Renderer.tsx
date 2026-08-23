import type {
  DryMathItemV1,
  WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import type { WorksheetRendererProps } from "../registry";

function isDryMathDocument(
  document: WorksheetDocumentV1,
): document is WorksheetDocumentV1<DryMathItemV1> {
  return (
    document.worksheetType === "dry-math" &&
    document.items.every((item) => item.itemType === "dry-math")
  );
}

export function DryMathRenderer({ document }: WorksheetRendererProps) {
  if (!isDryMathDocument(document)) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {document.request.displayName === undefined
            ? "Dry Math practice"
            : `${document.request.displayName}’s Dry Math practice`}
        </h2>
        <p>Practice page · solve each equation.</p>
      </header>
      <ol
        aria-label="Dry Math problems"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          listStylePosition: "inside",
          padding: 0,
        }}
      >
        {document.items.map((item) => (
          <li
            data-item-id={item.id}
            id={`worksheet-${document.worksheetId}-worksheet-${item.id}`}
            key={item.id}
            style={{
              border: "1px solid #aeb8c5",
              borderRadius: "0.65rem",
              fontSize: "1.45rem",
              padding: "0.9rem",
            }}
          >
            <span aria-label={`${item.leftOperand} ${item.operation} ${item.rightOperand}`}>
              {item.leftOperand} {item.renderedSymbol} {item.rightOperand} = ____
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
