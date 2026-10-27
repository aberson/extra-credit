import type { CSSProperties } from "react";

import type { OperationGridItemV1 } from "../../../shared/worksheet/types";
import {
  OPERATION_GRID_INSTRUCTIONS,
  OPERATION_GRID_OPERATION_LABELS,
  OPERATION_GRID_SPOKEN_SYMBOLS,
  OPERATION_GRID_SYMBOLS,
  operationGridItemOf,
} from "../../../worksheets/operation-grid/definition";
import type { WorksheetRendererProps } from "../registry";

/** The spoken name of an empty box. */
const BLANK_CELL_LABEL = "blank";

const CELL_STYLE: CSSProperties = {
  boxSizing: "border-box",
  height: "2.4em",
  minWidth: "2.9em",
  padding: "0 0.2em",
  textAlign: "center",
  verticalAlign: "middle",
};

const HEADER_STYLE: CSSProperties = {
  ...CELL_STYLE,
  background: "#eef1f5",
  border: "2px solid #24324a",
  fontWeight: 750,
};

const BLANK_STYLE: CSSProperties = {
  ...CELL_STYLE,
  border: "1px solid #24324a",
};

/** A given cell keeps a heavy double border and bold digits, so it survives monochrome print. */
const GIVEN_STYLE: CSSProperties = {
  ...CELL_STYLE,
  border: "4px double #24324a",
  fontWeight: 750,
};

/**
 * The semantic table both surfaces print: the operator in the corner, column
 * headers across the top and row headers down the side. On the worksheet a
 * blank cell is an empty box; the key (`completed`) fills every cell, and a
 * given cell keeps its heavy border on both.
 */
export function OperationGridTable({
  completed,
  idPrefix,
  item,
}: {
  readonly completed: boolean;
  readonly idPrefix: string;
  readonly item: OperationGridItemV1;
}) {
  const columns = item.columnHeaders.length;
  const label = `${OPERATION_GRID_OPERATION_LABELS[item.operation]} grid, ${item.rowHeaders.length} rows by ${columns} columns`;
  return (
    <div
      aria-label={label}
      data-item-id={item.id}
      data-operation-grid={item.operation}
      id={`${idPrefix}-${item.id}`}
      role="region"
      style={{ maxWidth: "100%", overflowX: "auto" }}
      // The table may be wider than a narrow screen; the region scrolls on
      // its own and must be reachable by keyboard to do so.
      tabIndex={0}
    >
      <table
        aria-label={label}
        style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: "1.15rem" }}
      >
        <thead>
          <tr>
            <td
              aria-label={`Operation: ${OPERATION_GRID_SPOKEN_SYMBOLS[item.operation]}`}
              data-grid-cell="corner"
              data-grid-corner={item.operation}
              style={HEADER_STYLE}
            >
              {OPERATION_GRID_SYMBOLS[item.operation]}
            </td>
            {item.columnHeaders.map((header) => (
              <th data-grid-cell="header" data-grid-column-header={header} key={header} scope="col" style={HEADER_STYLE}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rowHeaders.map((rowHeader, rowIndex) => (
            <tr key={rowHeader}>
              <th data-grid-cell="header" data-grid-row-header={rowHeader} scope="row" style={HEADER_STYLE}>
                {rowHeader}
              </th>
              {item.columnHeaders.map((columnHeader, columnIndex) => {
                const cell = item.cells[rowIndex * columns + columnIndex];
                if (cell === undefined) {
                  return null;
                }
                const shown = cell.given || completed;
                return (
                  <td
                    aria-label={shown ? undefined : BLANK_CELL_LABEL}
                    data-grid-blank={cell.given || completed ? undefined : "true"}
                    data-grid-cell={cell.given ? "given" : completed ? "answer" : "blank"}
                    data-grid-given={cell.given ? "true" : undefined}
                    data-grid-value={shown ? cell.value : undefined}
                    key={columnHeader}
                    style={cell.given ? GIVEN_STYLE : BLANK_STYLE}
                  >
                    {shown ? cell.value : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OperationGridRenderer({ document }: WorksheetRendererProps) {
  const item = operationGridItemOf(document);
  if (item === undefined) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {document.request.displayName === undefined
            ? "Operation Grid practice"
            : `${document.request.displayName}’s Operation Grid practice`}
        </h2>
        <p>{OPERATION_GRID_INSTRUCTIONS[item.operation]}</p>
      </header>
      <OperationGridTable
        completed={false}
        idPrefix={`worksheet-${document.worksheetId}-worksheet`}
        item={item}
      />
    </article>
  );
}
