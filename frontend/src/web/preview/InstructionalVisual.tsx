import type { CSSProperties } from "react";

/**
 * Instructional visuals: dots, ten-frames, shapes, and writing guides.
 *
 * These are NOT decoration (plan.md:212). This module takes no graphics flag
 * at all, so there is no code path by which turning decoration off can remove
 * a counted group, a ten-frame, or the space a child has to draw into.
 *
 * Both exports satisfy the plan's "text alternative in accessible HTML"
 * clause, by two different mechanisms:
 *
 * - `InstructionalVisual` is the thing to be read, so it is one `role="img"`
 *   element carrying an `aria-label` that states the count; its marks are
 *   `aria-hidden`, which makes that label the whole of what a screen reader
 *   receives.
 * - `InstructionalWritingGuide` is a place to write, not a thing to read, so
 *   it prints a VISIBLE caption naming the required work and hides only the
 *   empty ruled grid, which has nothing to say. The caption is ordinary text
 *   in the document, not an attribute on the grid.
 *
 * Geometry is expressed in `em` so a visual scales with the print scale the
 * surrounding worksheet already chose, rather than being pinned to the root
 * font.
 */

export type InstructionalMarkShapeV1 = "circle" | "square" | "triangle";

/**
 * `group` prints the marks and nothing else - the child counts a loose pile.
 * `ten-frame` prints the full five-by-two structure with the unfilled cells
 * still visible, which is what makes "how many more" answerable by looking.
 */
export type InstructionalVisualVariantV1 = "group" | "ten-frame";

const TEN_FRAME_COLUMNS = 5;
const TEN_FRAME_CELLS = 10;

/** V1 clamps every quantity to 20, so a ten-frame never needs a third frame. */
const MAXIMUM_TEN_FRAME_CELLS = 20;

const MARK_GLYPHS = {
  circle: "●",
  square: "■",
  triangle: "▲",
} as const satisfies Record<InstructionalMarkShapeV1, string>;

const groupStyle: CSSProperties = {
  display: "inline-grid",
  gap: "0.15em 0.3em",
  gridTemplateColumns: `repeat(${TEN_FRAME_COLUMNS}, auto)`,
  lineHeight: 1,
  verticalAlign: "middle",
};

const tenFrameStyle: CSSProperties = {
  border: "2px solid #24324a",
  display: "inline-grid",
  gridTemplateColumns: `repeat(${TEN_FRAME_COLUMNS}, 1.6em)`,
  lineHeight: 1,
  verticalAlign: "middle",
};

const tenFrameCellStyle: CSSProperties = {
  alignItems: "center",
  border: "1px solid #24324a",
  boxSizing: "border-box",
  display: "flex",
  height: "1.6em",
  justifyContent: "center",
};

const guideGridStyle: CSSProperties = {
  ...tenFrameStyle,
  display: "grid",
  justifyContent: "start",
  width: "fit-content",
};

function boundedQuantity(quantity: number, maximum: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.min(Math.max(0, Math.trunc(quantity)), maximum);
}

/**
 * Whole ten-frames, enough to hold `minimumCells`.
 *
 * ONE derivation, used by both the ten-frame visual and the writing guide.
 * The two surfaces previously sized themselves independently, and the visual
 * sized itself from what was ALREADY drawn rather than from what the child has
 * to reach - so a "make this group 20" item over a group of 8 printed two
 * empty boxes for twelve missing marks, and a group of 10 printed none at all.
 * Every caller now states the count the child must be able to REACH and gets a
 * frame that can hold it.
 */
function tenFrameCells(minimumCells: number): number {
  const bounded = boundedQuantity(minimumCells, MAXIMUM_TEN_FRAME_CELLS);
  return Math.max(1, Math.ceil(bounded / TEN_FRAME_CELLS)) * TEN_FRAME_CELLS;
}

export interface InstructionalVisualProps {
  /**
   * `ten-frame` only: the total the child must be able to reach in this frame,
   * which decides how many boxes print. It defaults to `quantity` - a frame
   * that only has to hold what is already drawn - so a caller asking the child
   * to ADD marks must pass the target, not the partial count.
   */
  readonly capacity?: number;
  /** The text alternative every instructional visual must carry. */
  readonly label: string;
  readonly quantity: number;
  readonly shape?: InstructionalMarkShapeV1;
  readonly variant?: InstructionalVisualVariantV1;
}

export function InstructionalVisual({
  capacity,
  label,
  quantity,
  shape = "circle",
  variant = "group",
}: InstructionalVisualProps) {
  const shown = boundedQuantity(quantity, MAXIMUM_TEN_FRAME_CELLS);

  if (variant === "ten-frame") {
    // Never fewer boxes than marks already drawn, and never fewer than the
    // total the caller says the child has to reach.
    const cells = tenFrameCells(Math.max(shown, capacity ?? shown));
    return (
      <span
        aria-label={label}
        data-instructional-capacity={cells}
        data-instructional-quantity={shown}
        data-instructional-visual="ten-frame"
        role="img"
        style={tenFrameStyle}
      >
        {Array.from({ length: cells }, (_, index) => (
          <span
            aria-hidden="true"
            data-instructional-mark={index < shown ? "filled" : "empty"}
            key={index}
            style={tenFrameCellStyle}
          >
            {index < shown ? MARK_GLYPHS[shape] : ""}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      data-instructional-quantity={shown}
      data-instructional-visual="group"
      role="img"
      style={groupStyle}
    >
      {Array.from({ length: shown }, (_, index) => (
        <span
          aria-hidden="true"
          data-instructional-mark="filled"
          key={index}
          style={{ fontSize: "1.1em" }}
        >
          {MARK_GLYPHS[shape]}
        </span>
      ))}
    </span>
  );
}

export interface InstructionalWritingGuideProps {
  /**
   * The total the child must be able to draw here. The guide rounds up to
   * whole ten-frames, so it always prints at least this many boxes.
   */
  readonly capacity?: number;
  /** The visible caption naming the required work. */
  readonly label: string;
}

/**
 * The required-response surface for the `draw` subtype; its only call site is
 * `web/worksheets/count-compare-make/Renderer.tsx`. A `complete` item is drawn
 * into the empty cells of its ten-frame {@link InstructionalVisual} instead, so
 * both drawing subtypes get ruled boxes, from two different exports here.
 *
 * It is ruled structure, not ornament: without it a "draw six marks" item has
 * nowhere to put them, which is exactly why the decorative toggle must not
 * reach it.
 */
export function InstructionalWritingGuide({
  capacity = TEN_FRAME_CELLS,
  label,
}: InstructionalWritingGuideProps) {
  const cellCount = tenFrameCells(capacity);
  return (
    <div data-instructional-guide="true">
      <p style={{ margin: "0 0 0.35rem" }}>{label}</p>
      <div
        aria-hidden="true"
        data-instructional-guide-cells={cellCount}
        style={guideGridStyle}
      >
        {Array.from({ length: cellCount }, (_, index) => (
          <span
            data-instructional-guide-cell="true"
            key={index}
            style={tenFrameCellStyle}
          />
        ))}
      </div>
    </div>
  );
}
