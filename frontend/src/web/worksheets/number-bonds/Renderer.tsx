import type {
  MathOperation,
  NumberBondItemV1,
  WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import { NUMBER_BONDS_INSTRUCTION } from "../../../worksheets/number-bonds/definition";
import type { WorksheetRendererProps } from "../registry";

/** What a screen reader says for each operator, as Dry Math says it. */
const SPOKEN_OPERATORS = {
  addition: "plus",
  subtraction: "minus",
} as const satisfies Record<MathOperation, string>;

/** The spoken name of the blank, in the box's label and in the row's. */
const MISSING_NUMBER_LABEL = "missing number";

function isNumberBondsDocument(
  document: WorksheetDocumentV1,
): document is WorksheetDocumentV1<NumberBondItemV1> {
  return (
    document.worksheetType === "number-bonds" &&
    document.items.every((item) => item.itemType === "number-bond")
  );
}

/** The row's spoken form, for example "8 plus missing number equals 15". */
function spokenSentence(item: NumberBondItemV1): string {
  const left = item.missing === "left" ? MISSING_NUMBER_LABEL : String(item.leftOperand);
  const right = item.missing === "right" ? MISSING_NUMBER_LABEL : String(item.rightOperand);
  return `${left} ${SPOKEN_OPERATORS[item.operation]} ${right} equals ${item.result}`;
}

/** One number of the sentence, or the drawn box the child writes it in. */
function SentenceNumber({ blank, value }: { readonly blank: boolean; readonly value: number }) {
  return blank ? (
    <span
      aria-label={MISSING_NUMBER_LABEL}
      data-missing-box="true"
      role="img"
      style={{
        border: "2px solid #24324a",
        borderRadius: "0.2rem",
        display: "inline-block",
        height: "1.6em",
        verticalAlign: "middle",
        width: "2.4em",
      }}
    />
  ) : (
    <span data-sentence-number="true">{value}</span>
  );
}

export function NumberBondsRenderer({ document }: WorksheetRendererProps) {
  if (!isNumberBondsDocument(document)) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {document.request.displayName === undefined
            ? "Number Bonds practice"
            : `${document.request.displayName}’s Number Bonds practice`}
        </h2>
        <p>{NUMBER_BONDS_INSTRUCTION}</p>
      </header>
      <ol
        aria-label="Number Bonds problems"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
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
            <span aria-label={spokenSentence(item)} data-number-bond-sentence="true">
              <SentenceNumber blank={item.missing === "left"} value={item.leftOperand} />{" "}
              <span data-operator={item.operation}>{item.renderedSymbol}</span>{" "}
              <SentenceNumber blank={item.missing === "right"} value={item.rightOperand} /> ={" "}
              <span data-sentence-number="true">{item.result}</span>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
