import type {
  EquationWowChoiceV1,
  QuantityWowChoiceV1,
  WorksheetDocumentV1,
  WowGroupItemV1,
} from "../../../shared/worksheet/types";
import { FIND_THE_WOW_DEFINITION } from "../../../worksheets/find-the-wow/definition";
import type { WorksheetRendererProps } from "../registry";

function isFindTheWowDocument(
  document: WorksheetDocumentV1,
): document is WorksheetDocumentV1<WowGroupItemV1> {
  const firstMode =
    document.items[0]?.itemType === "wow-group"
      ? document.items[0].mode
      : undefined;
  return (
    document.worksheetType === FIND_THE_WOW_DEFINITION.id &&
    firstMode !== undefined &&
    document.items.every(
      (item) => item.itemType === "wow-group" && item.mode === firstMode,
    )
  );
}

function QuantityStatement({
  choice,
}: {
  readonly choice: QuantityWowChoiceV1;
}) {
  return (
    <span>
      <strong data-visible-numeral="true" style={{ fontSize: "1.55em" }}>
        {choice.numeral}
      </strong>
      <span aria-hidden="true" style={{ margin: "0 0.65rem" }}>
        ↔
      </span>
      <span
        aria-label={`${choice.quantity} ${choice.quantity === 1 ? "dot" : "dots"}`}
        role="img"
        style={{
          display: "inline-grid",
          gap: "0.1rem 0.35rem",
          gridTemplateColumns: "repeat(5, auto)",
          verticalAlign: "middle",
        }}
      >
        {Array.from({ length: choice.quantity }, (_, index) => (
          <span aria-hidden="true" data-quantity-mark="true" key={index}>
            ●
          </span>
        ))}
      </span>
    </span>
  );
}

function EquationStatement({
  choice,
}: {
  readonly choice: EquationWowChoiceV1;
}) {
  return (
    <span
      aria-label={`${choice.leftOperand} ${
        choice.renderedSymbol === "+" ? "plus" : "minus"
      } ${choice.rightOperand} equals ${choice.displayedResult}`}
      data-visible-equation="true"
    >
      {choice.leftOperand} {choice.renderedSymbol} {choice.rightOperand} ={" "}
      {choice.displayedResult}
    </span>
  );
}

export function FindTheWowRenderer({ document }: WorksheetRendererProps) {
  if (!isFindTheWowDocument(document)) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }
  const mode = document.items[0]?.mode;
  const familyTitle = `${FIND_THE_WOW_DEFINITION.displayName} practice`;
  const { displayName } = document.request;

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {displayName === undefined
            ? familyTitle
            : `${displayName}’s ${familyTitle}`}
        </h2>
        <p>
          {mode === "quantity"
            ? "Circle the wow in each group: the one numeral-and-dot pair that matches."
            : "Circle the wow in each group: the one equation that is true."}
        </p>
      </header>
      <ol
        aria-label="Two Whats and a Wow groups"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 17rem), 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {document.items.map((item, groupIndex) => (
          <li
            data-item-id={item.id}
            data-wow-group="true"
            data-wow-mode={item.mode}
            id={`worksheet-${document.worksheetId}-worksheet-${item.id}`}
            key={item.id}
            style={{
              border: "1px solid #aeb8c5",
              borderRadius: "0.65rem",
              breakInside: "avoid",
              padding: "0.8rem",
            }}
          >
            <strong>Group {groupIndex + 1}</strong>
            <ol
              aria-label={`Choices for group ${groupIndex + 1}`}
              style={{
                display: "grid",
                gap: "0.55rem",
                listStyle: "none",
                marginTop: "0.55rem",
                padding: 0,
              }}
            >
              {item.choices.map((choice, choiceIndex) => (
                <li
                  data-statement-kind={choice.kind}
                  data-wow-choice="true"
                  key={`${choiceIndex}-${JSON.stringify(choice)}`}
                  style={{
                    alignItems: "center",
                    display: "grid",
                    fontSize: "1.15rem",
                    gap: "0.65rem",
                    gridTemplateColumns: "1.2rem 1.5rem 1fr",
                    minHeight: "2.5rem",
                  }}
                >
                  <strong data-choice-number={choiceIndex + 1}>
                    {choiceIndex + 1}.
                  </strong>
                  <span
                    aria-hidden="true"
                    data-circle-target="true"
                    style={{
                      border: "2px solid currentColor",
                      borderRadius: "50%",
                      display: "inline-block",
                      height: "1.05rem",
                      width: "1.05rem",
                    }}
                  />
                  {choice.kind === "quantity" ? (
                    <QuantityStatement choice={choice} />
                  ) : (
                    <EquationStatement choice={choice} />
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </article>
  );
}
