import {
  CLOCK_EXPLORER_INSTRUCTION,
  CLOCK_EXPLORER_RESPONSE_PREFIX,
  CLOCK_EXPLORER_RESPONSE_SUFFIX,
  CLOCK_MINUTE_HAND_DEGREES,
  clockHourHandDegrees,
  clockItemsOf,
} from "../../../worksheets/clock-explorer/definition";
import type { WorksheetRendererProps } from "../registry";

/*
 * Clock Explorer's page: four cards, each an inline SVG dial drawn from the
 * clock's hour alone and a writing line before a printed ":00". The dial is a
 * square in a 100-unit view box centred on (50, 50); its twelve labels are
 * HTML text placed over it, so they print at the instruction size and their
 * own boxes can be measured. No asset, URL or colour is needed to read it.
 */

/** The dial's centre and outline radius, in view-box units. */
export const CLOCK_DIAL_CENTRE = 50;
export const CLOCK_OUTLINE_RADIUS = 48;
/** How far from the centre each label sits, as a share of the dial's width. */
export const CLOCK_LABEL_RADIUS = 38;
/**
 * The long minute hand stops short of the 12 label and the short hour hand
 * well short of every label, so no hand meets a number; the hour hand is also
 * heavier, so the two never read alike, even when they overlap at 12:00.
 */
export const CLOCK_MINUTE_HAND_LENGTH = 27;
export const CLOCK_HOUR_HAND_LENGTH = 16;
export const CLOCK_MINUTE_HAND_WIDTH = 2.5;
export const CLOCK_HOUR_HAND_WIDTH = 5.5;

const INK = "#24324a";
const CLOCK_LABELS = Array.from({ length: 12 }, (_, index) => index + 1);

/** The end of a hand `length` units from the centre, `degrees` clockwise from twelve. */
function handEnd(degrees: number, length: number): { readonly x: number; readonly y: number } {
  const radians = (degrees * Math.PI) / 180;
  // Rounded to a thousandth so the markup stays stable across engines.
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    x: round(CLOCK_DIAL_CENTRE + length * Math.sin(radians)),
    y: round(CLOCK_DIAL_CENTRE - length * Math.cos(radians)),
  };
}

/** What a screen reader says for one dial: where each hand points, never the written time. */
function spokenDial(hour: number): string {
  return `Clock face. The long hand points to 12 and the short hand points to ${hour}.`;
}

/** One dial: outline, twelve labels, the hour hand and the minute hand drawn over it. */
export function ClockFace({ hour }: { readonly hour: number }) {
  const minute = handEnd(CLOCK_MINUTE_HAND_DEGREES, CLOCK_MINUTE_HAND_LENGTH);
  const hourEnd = handEnd(clockHourHandDegrees(hour), CLOCK_HOUR_HAND_LENGTH);
  return (
    <div
      aria-label={spokenDial(hour)}
      data-clock-dial="true"
      role="img"
      style={{
        flex: "0 0 auto",
        height: "10rem",
        position: "relative",
        width: "10rem",
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        height="100%"
        style={{ display: "block", inset: 0, position: "absolute" }}
        viewBox="0 0 100 100"
        width="100%"
      >
        <circle
          cx={CLOCK_DIAL_CENTRE}
          cy={CLOCK_DIAL_CENTRE}
          data-clock-outline="true"
          fill="none"
          r={CLOCK_OUTLINE_RADIUS}
          stroke={INK}
          strokeWidth={2}
        />
        {/* The hour hand first, so the thinner minute hand stays visible over it at 12:00. */}
        <line
          data-clock-hand="hour"
          stroke={INK}
          strokeLinecap="round"
          strokeWidth={CLOCK_HOUR_HAND_WIDTH}
          x1={CLOCK_DIAL_CENTRE}
          x2={hourEnd.x}
          y1={CLOCK_DIAL_CENTRE}
          y2={hourEnd.y}
        />
        <line
          data-clock-hand="minute"
          stroke={INK}
          strokeLinecap="round"
          strokeWidth={CLOCK_MINUTE_HAND_WIDTH}
          x1={CLOCK_DIAL_CENTRE}
          x2={minute.x}
          y1={CLOCK_DIAL_CENTRE}
          y2={minute.y}
        />
        <circle
          cx={CLOCK_DIAL_CENTRE}
          cy={CLOCK_DIAL_CENTRE}
          data-clock-centre="true"
          fill={INK}
          r={3}
        />
      </svg>
      {CLOCK_LABELS.map((label) => {
        const position = handEnd(30 * label, CLOCK_LABEL_RADIUS);
        return (
          <span
            aria-hidden="true"
            data-clock-label={label}
            key={label}
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              left: `${position.x}%`,
              lineHeight: 1,
              position: "absolute",
              top: `${position.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function ClockExplorerRenderer({ document }: WorksheetRendererProps) {
  const items = clockItemsOf(document);
  if (items === undefined) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {document.request.displayName === undefined
            ? "Clock Explorer practice"
            : `${document.request.displayName}’s Clock Explorer practice`}
        </h2>
        <p>{CLOCK_EXPLORER_INSTRUCTION}</p>
      </header>
      <ol
        aria-label="Clock Explorer clocks"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {items.map((item, index) => (
          <li
            data-clock-card="true"
            data-item-id={item.id}
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
            <ClockFace hour={item.hour} />
            <p data-clock-response="true" style={{ margin: 0 }}>
              {CLOCK_EXPLORER_RESPONSE_PREFIX}{" "}
              <span
                aria-label="blank for the hour"
                data-time-blank="true"
                role="img"
                style={{
                  borderBottom: "2px solid #24324a",
                  display: "inline-block",
                  height: "1.6em",
                  verticalAlign: "bottom",
                  width: "3.2em",
                }}
              />{" "}
              {CLOCK_EXPLORER_RESPONSE_SUFFIX}
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}
