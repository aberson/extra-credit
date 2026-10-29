import {
  TALLY_DETECTIVE_INSTRUCTION,
  TALLY_DETECTIVE_RESPONSE_PREFIX,
  tallyItemsOf,
} from "../../../worksheets/tally-detective/definition";
import type { WorksheetRendererProps } from "../registry";

/*
 * Tally Detective's page: four cards, each an inline SVG tally drawn from the
 * item's bundles and remainder alone and a writing line after "How many?".
 * The view box is a fixed 180 × 50 strip of four 45-unit slots, the most any
 * total up to 20 needs (four bundles, or three bundles and four loose marks),
 * so every mark prints at the same size whatever the total. A bundle is four
 * upright marks crossed by a fifth drawn over them; loose marks fill the next
 * slot. The gap between slots is wider than the gap between marks, so the
 * groups of five stay apart. No asset, URL or colour is needed to read it.
 */

/** The view box's size and one group's slot, in view-box units. */
export const TALLY_VIEW_WIDTH = 180;
export const TALLY_VIEW_HEIGHT = 50;
export const TALLY_SLOT_WIDTH = 45;
/** Where a slot's four uprights stand, from the slot's left edge. */
const TALLY_UPRIGHT_OFFSETS = [7, 15, 23, 31] as const;
export const TALLY_UPRIGHT_TOP = 6;
export const TALLY_UPRIGHT_BOTTOM = 44;
/** The crossing fifth mark runs up from the slot's lower left to its upper right. */
const TALLY_CROSSING_START = { x: 2, y: 35 } as const;
const TALLY_CROSSING_END = { x: 36, y: 15 } as const;
export const TALLY_STROKE_WIDTH = 2.5;

const INK = "#24324a";

/** What a screen reader says for one tally: its groups, never the written total. */
function spokenTally(bundles: number, remainder: number): string {
  const parts: string[] = [];
  if (bundles > 0) {
    parts.push(`${bundles} ${bundles === 1 ? "bundle" : "bundles"} of five`);
  }
  if (remainder > 0) {
    parts.push(`${remainder} single ${remainder === 1 ? "mark" : "marks"}`);
  }
  return `Tally marks: ${parts.join(" and ")}.`;
}

function Upright({ x }: { readonly x: number }) {
  return (
    <line
      data-tally-stroke="upright"
      stroke={INK}
      strokeLinecap="round"
      strokeWidth={TALLY_STROKE_WIDTH}
      x1={x}
      x2={x}
      y1={TALLY_UPRIGHT_BOTTOM}
      y2={TALLY_UPRIGHT_TOP}
    />
  );
}

/** One tally: its bundles of five, each crossed, then its loose marks. */
export function TallyMarks({
  bundles,
  remainder,
}: {
  readonly bundles: number;
  readonly remainder: number;
}) {
  return (
    <div
      aria-label={spokenTally(bundles, remainder)}
      data-tally-marks="true"
      role="img"
      style={{
        aspectRatio: `${TALLY_VIEW_WIDTH} / ${TALLY_VIEW_HEIGHT}`,
        flex: "0 0 auto",
        maxWidth: "100%",
        width: "18rem",
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        height="100%"
        style={{ display: "block" }}
        viewBox={`0 0 ${TALLY_VIEW_WIDTH} ${TALLY_VIEW_HEIGHT}`}
        width="100%"
      >
        {Array.from({ length: bundles }, (_, bundle) => {
          const left = bundle * TALLY_SLOT_WIDTH;
          return (
            <g data-tally-group="bundle" key={`bundle-${bundle}`}>
              {TALLY_UPRIGHT_OFFSETS.map((offset) => (
                <Upright key={offset} x={left + offset} />
              ))}
              {/* Drawn last, so the crossing fifth lies over its four uprights. */}
              <line
                data-tally-stroke="crossing"
                stroke={INK}
                strokeLinecap="round"
                strokeWidth={TALLY_STROKE_WIDTH}
                x1={left + TALLY_CROSSING_START.x}
                x2={left + TALLY_CROSSING_END.x}
                y1={TALLY_CROSSING_START.y}
                y2={TALLY_CROSSING_END.y}
              />
            </g>
          );
        })}
        {remainder > 0 ? (
          <g data-tally-group="loose">
            {TALLY_UPRIGHT_OFFSETS.slice(0, remainder).map((offset) => (
              <Upright key={offset} x={bundles * TALLY_SLOT_WIDTH + offset} />
            ))}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export function TallyDetectiveRenderer({ document }: WorksheetRendererProps) {
  const items = tallyItemsOf(document);
  if (items === undefined) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {document.request.displayName === undefined
            ? "Tally Detective practice"
            : `${document.request.displayName}’s Tally Detective practice`}
        </h2>
        <p>{TALLY_DETECTIVE_INSTRUCTION}</p>
      </header>
      <ol
        aria-label="Tally Detective tallies"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {items.map((item, index) => (
          <li
            data-item-id={item.id}
            data-tally-card="true"
            id={`worksheet-${document.worksheetId}-worksheet-${item.id}`}
            key={item.id}
            style={{
              alignItems: "center",
              border: "1px solid #aeb8c5",
              borderRadius: "0.65rem",
              display: "flex",
              flexDirection: "column",
              fontSize: "1.25rem",
              gap: "0.6rem",
              padding: "0.9rem",
            }}
          >
            <strong data-problem-number={index + 1} style={{ alignSelf: "flex-start" }}>
              {index + 1}.
            </strong>
            <TallyMarks bundles={item.bundles} remainder={item.remainder} />
            <p data-tally-response="true" style={{ margin: 0 }}>
              {TALLY_DETECTIVE_RESPONSE_PREFIX}{" "}
              <span
                aria-label="blank for the number of tally marks"
                data-tally-blank="true"
                role="img"
                style={{
                  borderBottom: "2px solid #24324a",
                  display: "inline-block",
                  height: "1.6em",
                  verticalAlign: "bottom",
                  width: "3.2em",
                }}
              />
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}
