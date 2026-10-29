import type {
  ObjectiveAnswerV1,
  WorksheetDocumentV1,
  WorksheetItemV1,
} from "../../shared/worksheet/types";
import {
  clockHandsText,
  clockItemsOf,
  clockTimeText,
} from "../../worksheets/clock-explorer/definition";
import { COUNT_COMPARE_RELATION_WORDS } from "../../worksheets/count-compare-make/definition";
import { numberBondKeyExpression } from "../../worksheets/number-bonds/definition";
import {
  tallyDecompositionText,
  tallyItemsOf,
  tallyTotalOf,
} from "../../worksheets/tally-detective/definition";
import {
  OPERATION_GRID_KEY_NOTE,
  operationGridItemOf,
} from "../../worksheets/operation-grid/definition";
import { OperationGridTable } from "../worksheets/operation-grid/Renderer";

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
    case "grid":
      // A grid's key is the completed table itself; this line form is never
      // printed for one, and lists the cells row by row if it ever were.
      return answer.value.join(", ");
  }
}

export function AnswerKeyView({ document }: AnswerKeyViewProps) {
  if (document.worksheetType === "operation-grid") {
    return <OperationGridAnswerKey document={document} />;
  }
  if (document.worksheetType === "clock-explorer") {
    return <ClockExplorerAnswerKey document={document} />;
  }
  if (document.worksheetType === "tally-detective") {
    return <TallyDetectiveAnswerKey document={document} />;
  }
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
          if (item.itemType === "number-bond") {
            // The problem as printed, its blank written as ?, then its one
            // answer, so two mirrored sentences never share a key line.
            const problem = numberBondKeyExpression(item);
            return (
              <li
                data-item-id={item.id}
                id={`worksheet-${document.worksheetId}-answer-${item.id}`}
                key={item.id}
              >
                <strong data-problem-number={index + 1}>{index + 1}.</strong>{" "}
                <span data-source-expression={problem}>{problem}</span> (missing number:{" "}
                <span data-answer-value={answer}>{answer}</span>)
              </li>
            );
          }
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

/**
 * Clock Explorer's key: each clock's time, written with its ":00", and where
 * its two hands point, for example "3:00 — long hand at 12, short hand at 3".
 * The time is formatted from the clock's own hour, the same field the dial
 * is drawn from.
 */
function ClockExplorerAnswerKey({ document }: AnswerKeyViewProps) {
  const items = clockItemsOf(document);
  if (items === undefined) {
    return <p role="alert">This answer key could not be rendered safely.</p>;
  }
  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-answer-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-answer-title`}>
          Parent answer key
        </h2>
        <p>Answers match the numbered problems on the worksheet.</p>
      </header>
      <ol aria-label="Objective answers" style={{ listStyle: "none", padding: 0 }}>
        {items.map((item, index) => {
          const time = clockTimeText(item.hour);
          return (
            <li
              data-item-id={item.id}
              id={`worksheet-${document.worksheetId}-answer-${item.id}`}
              key={item.id}
            >
              <strong data-problem-number={index + 1}>{index + 1}.</strong>{" "}
              <span data-answer-value={time}>{time}</span> —{" "}
              <span data-clock-hands="true">{clockHandsText(item.hour)}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/**
 * Tally Detective's key: each tally's total and how its marks group, one
 * addend per drawn group, for example "8 = 5 + 3" or "20 = 5 + 5 + 5 + 5".
 * Both are formatted from the tally's own bundles and remainder, the same
 * fields its marks are drawn from.
 */
function TallyDetectiveAnswerKey({ document }: AnswerKeyViewProps) {
  const items = tallyItemsOf(document);
  if (items === undefined) {
    return <p role="alert">This answer key could not be rendered safely.</p>;
  }
  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-answer-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-answer-title`}>
          Parent answer key
        </h2>
        <p>Answers match the numbered problems on the worksheet.</p>
      </header>
      <ol aria-label="Objective answers" style={{ listStyle: "none", padding: 0 }}>
        {items.map((item, index) => {
          const total = String(tallyTotalOf(item));
          return (
            <li
              data-item-id={item.id}
              id={`worksheet-${document.worksheetId}-answer-${item.id}`}
              key={item.id}
            >
              <strong data-problem-number={index + 1}>{index + 1}.</strong>{" "}
              <span data-answer-value={total}>{total}</span> ={" "}
              <span data-tally-decomposition="true">{tallyDecompositionText(item)}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/**
 * Operation Grid's key: the same table as the worksheet, every cell completed
 * and the given cells still in their heavy border.
 */
function OperationGridAnswerKey({ document }: AnswerKeyViewProps) {
  const item = operationGridItemOf(document);
  if (item === undefined) {
    return <p role="alert">This answer key could not be rendered safely.</p>;
  }
  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-answer-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-answer-title`}>
          Parent answer key
        </h2>
        <p>{OPERATION_GRID_KEY_NOTE}</p>
      </header>
      <OperationGridTable
        completed
        idPrefix={`worksheet-${document.worksheetId}-answer`}
        item={item}
      />
    </article>
  );
}
