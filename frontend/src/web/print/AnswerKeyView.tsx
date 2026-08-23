import type {
  ObjectiveAnswerV1,
  WorksheetDocumentV1,
  WorksheetItemV1,
} from "../../shared/worksheet/types";

interface AnswerKeyViewProps {
  readonly document: WorksheetDocumentV1;
}

function sourceExpression(item: WorksheetItemV1): string | undefined {
  return item.itemType === "dry-math"
    ? `${item.leftOperand} ${item.renderedSymbol} ${item.rightOperand}`
    : undefined;
}

function answerText(answer: ObjectiveAnswerV1): string {
  switch (answer.kind) {
    case "number":
      return String(answer.value);
    case "choice":
      return `Choice ${answer.value + 1}`;
    case "comparison":
      return answer.value;
  }
}

export function AnswerKeyView({ document }: AnswerKeyViewProps) {
  const objectiveItems = document.items.filter(
    (item) => item.answerability === "objective",
  );
  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-answer-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-answer-title`}>
          Parent answer key
        </h2>
        <p>Answers match the numbered problems on the worksheet.</p>
      </header>
      <ol aria-label="Objective answers" style={{ listStyle: "none", padding: 0 }}>
        {objectiveItems.map((item, index) => {
          const answer = answerText(item.answer);
          const expression = sourceExpression(item);
          return (
            <li
              data-item-id={item.id}
              id={`worksheet-${document.worksheetId}-answer-${item.id}`}
              key={item.id}
            >
              <strong data-problem-number={index + 1}>{index + 1}.</strong>{" "}
              {expression === undefined ? (
                <>Answer: </>
              ) : (
                <>
                  <span data-source-expression={expression}>{expression}</span>{" "}
                  ={" "}
                </>
              )}
              <span data-answer-value={answer}>{answer}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
