import type {
  ObjectiveAnswerV1,
  WorksheetDocumentV1,
  WorksheetItemV1,
} from "../../shared/worksheet/types";
import { COUNT_COMPARE_RELATION_WORDS } from "../../worksheets/count-compare-make/definition";

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
      // The key prints the exact phrase the child circles, from the same
      // constant the worksheet renderer prints. Returning `answer.value` here
      // leaked the stored enum, so one document showed the parent "greater"
      // beside a page that said "more than".
      //
      // The constant covers the whole relation union - its `satisfies` clause
      // is what enforces that - so the lookup is total today. The fallback is
      // here because this is a PRINT sink: an unmapped relation must still put
      // something a parent can read on the page rather than "undefined".
      return COUNT_COMPARE_RELATION_WORDS[answer.value] ?? answer.value;
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
