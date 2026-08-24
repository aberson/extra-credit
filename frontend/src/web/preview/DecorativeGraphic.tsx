import { useCallback, useState, type CSSProperties } from "react";

import type { SeedHex } from "../../shared/worksheet/types";
import {
  selectDecorativeAsset,
  type LineArtAssetV1,
} from "../assets/line-art/manifest";

/**
 * The reserved decorative panel (plan.md:202).
 *
 * The panel is the SAME size in every state. With decorative graphics on and
 * a licensed match, it holds one reviewed monochrome SVG with an empty `alt`
 * attribute (plan.md:246). With graphics off, with no licensed match, or if a
 * bundled asset cannot be fetched, that same box becomes the optional doodle
 * box. Because the box is always rendered at the same size, nothing below it
 * can move: the prompt, word bank, item count, required response, and
 * response-panel geometry are identical in all three states.
 *
 * The panel belongs OUTSIDE the instructional response area (plan.md:195);
 * callers place it in the reserved header/side slot, never inside
 * `[data-response-panel]`.
 */

/** The reservation's natural size, shared by the art and the doodle box. */
const PANEL_SIZE_REM = 7.5;

/**
 * The reservation is container-aware, not merely fixed - in BOTH axes.
 *
 * `flex-basis` is the panel's size in every ordinary layout, so the three
 * decoration states keep the identical box they are asserted to keep. But a
 * reader at a very large base font turns 7.5rem into hundreds of physical
 * pixels, and a rigid `flex: 0 0` panel would then push a narrow page wider
 * than the viewport. Allowing the panel to shrink (and capping it at the
 * width of whatever holds it) makes overflow impossible without making the
 * three states differ: the used size is decided by the flex line, which is
 * the same in all three, and `min-width: 0` keeps that decision independent
 * of whether art or the doodle box is inside.
 *
 * Shrinking the width alone was not enough. A rigid `height: 7.5rem` stops
 * the reservation being square the moment the width gives way: measured in
 * the built app at a 320 px preview, 320 wide by 360 tall at a 300% root
 * font, which letterboxes the drawing into a 1:1.1 slot. In a standalone
 * Chromium reproduction of the same panel inside the app's two padding
 * layers, where the flex line squeezes it harder, it reached 192x480 at 400%
 * and the caption's min-content (141.3 px) no longer fitted its 136.8 px
 * content box, so `overflow: hidden` cut the words. `aspect-ratio` with
 * `height: auto` ties the height to the used width instead - measured in the
 * app: 120x120, 240x240, 320x320 at 100/200/300% - and it is still ONE box
 * shared by all three decoration states, because the width they already share
 * is what decides it. `align-self` keeps that true regardless of how a future
 * caller aligns its flex line.
 *
 * `container-type: size` is what lets the doodle box below scale WITH the
 * panel rather than with the root font, which is the other half of the same
 * fix; it also makes the panel's intrinsic contribution independent of its
 * contents, which is exactly the three-state guarantee restated in CSS.
 */
const panelStyle: CSSProperties = {
  alignSelf: "flex-start",
  aspectRatio: "1 / 1",
  boxSizing: "border-box",
  containerType: "size",
  flex: `0 1 ${PANEL_SIZE_REM}rem`,
  height: "auto",
  maxWidth: "100%",
  minWidth: 0,
  width: `${PANEL_SIZE_REM}rem`,
};

const artStyle: CSSProperties = {
  display: "block",
  height: "100%",
  objectFit: "contain",
  visibility: "visible",
  width: "100%",
};

/**
 * An undecoded decorative image paints NOTHING.
 *
 * Measured in Chromium, 120x120 `<img alt="">` elements over a real HTTP
 * origin, distinct painted colours counted off a screenshot:
 *
 * - request still in flight: 1 colour. A pending image paints nothing by
 *   itself, so `visibility: hidden` changes nothing in that state.
 * - request FAILED: 118 colours - the browser's broken-image glyph, drawn
 *   even with an empty `alt`.
 *
 * The failed case is the frame this style exists for: it is live from the
 * moment the request fails until `onError` re-renders the doodle box, and it
 * would otherwise put a coloured glyph on a monochrome child worksheet.
 * `visibility: hidden` reserves exactly the same box (so geometry is
 * untouched) while guaranteeing by CSS that the element paints nothing at all
 * until this component has seen the asset decode. `graphics.spec.ts` measures
 * the same panel with the same metric, against a deliberately broken visible
 * image as its known-garbage anchor.
 */
const pendingArtStyle: CSSProperties = { ...artStyle, visibility: "hidden" };

/**
 * The doodle box is a scaled drawing of itself, not a fixed one.
 *
 * Every internal length is a percentage of the panel's own smaller side
 * (`cqmin`, resolved against the `container-type: size` panel above) rather
 * than of the root font. That is what stops the caption being clipped when
 * the panel shrinks: a root-relative caption grows while its box shrinks,
 * which is how 141.3 px of min-content ended up in a 136.8 px box, whereas
 * a share of the box can never outgrow it. Measured in the built app at a
 * 320 px preview: 100% root font gives a 2 px border, 6 px padding, 9.6 px
 * radius and a 12 px caption - the box this panel has always drawn - and 300%
 * gives a 32 px caption whose min-content is 22.4 px inside a 276 px content
 * box.
 */
const doodleBoxStyle: CSSProperties = {
  alignItems: "flex-end",
  border: "2cqmin dashed #6b7686",
  borderRadius: "8cqmin",
  boxSizing: "border-box",
  display: "flex",
  height: "100%",
  justifyContent: "center",
  overflow: "hidden",
  padding: "5cqmin",
  width: "100%",
};

const doodleNoteStyle: CSSProperties = {
  fontSize: "10cqmin",
  margin: 0,
  // A caption that must never be cut breaks mid-word before it overflows.
  overflowWrap: "anywhere",
  textAlign: "center",
};

/**
 * `pending` until the browser says otherwise: art is shown only once it has
 * really decoded, and a failure becomes the doodle box.
 */
type ArtStatusV1 = "pending" | "ready" | "unavailable";

interface ArtStateV1 {
  readonly assetId: string | null;
  readonly status: ArtStatusV1;
}

const INITIAL_ART_STATE: ArtStateV1 = { assetId: null, status: "pending" };

export interface DecorativeGraphicProps {
  /** The parent decorative-graphics choice carried by the request. */
  readonly includeDecorativeGraphics: boolean;
  /** The generated page seed; selection is deterministic for it. */
  readonly seed: SeedHex;
  /** The item topic ID; only exact allowlisted IDs select art. */
  readonly topicId: string;
  /** Test seam for a missing-match or multi-asset catalog. */
  readonly catalog?: readonly LineArtAssetV1[];
}

export function DecorativeGraphic({
  catalog,
  includeDecorativeGraphics,
  seed,
  topicId,
}: DecorativeGraphicProps) {
  const [artState, setArtState] = useState<ArtStateV1>(INITIAL_ART_STATE);
  const selected = includeDecorativeGraphics
    ? selectDecorativeAsset(topicId, seed, catalog)
    : undefined;
  const selectedId = selected?.id ?? null;
  // A verdict belongs to the asset it was reached for. A different selection
  // starts over at `pending`, so one asset's failure can never hide another.
  const status: ArtStatusV1 =
    artState.assetId === selectedId ? artState.status : "pending";

  const settle = useCallback(
    (next: ArtStatusV1, assetId: string) => {
      setArtState((current) =>
        current.assetId === assetId && current.status === next
          ? current
          : { assetId, status: next },
      );
    },
    [setArtState],
  );

  /**
   * Every freshly attached `<img>` re-derives its OWN verdict, in the commit
   * phase, before the browser can paint it.
   *
   * Two holes close here. A decoded image may never fire `load` for a newly
   * created element, so reading `complete` with a real intrinsic width is the
   * only way it can ever leave `pending`. And a verdict kept in component
   * state outlives the element it was reached for: the same asset can be
   * unmounted (graphics off) and mounted again while `artState` still says
   * `ready`, which would put a visible, undecoded `<img>` on the page - the
   * exact frame `pendingArtStyle` exists to prevent. Demoting an incomplete
   * element back to `pending` makes the guarantee hold per ELEMENT rather
   * than per asset, so it no longer depends on any argument about which
   * callers happen to remount.
   */
  const readSettledImage = useCallback(
    (node: HTMLImageElement | null) => {
      if (node === null || selectedId === null) {
        return;
      }
      if (!node.complete) {
        settle("pending", selectedId);
        return;
      }
      settle(node.naturalWidth > 0 ? "ready" : "unavailable", selectedId);
    },
    [selectedId, settle],
  );

  const asset =
    selected !== undefined && status !== "unavailable" ? selected : undefined;

  return (
    <div
      data-decoration={asset === undefined ? "doodle" : "art"}
      data-decorative-panel="true"
      style={panelStyle}
    >
      {asset === undefined ? (
        <div data-doodle-box="true" style={doodleBoxStyle}>
          <p data-doodle-note="true" style={doodleNoteStyle}>
            Doodle here if you like.
          </p>
        </div>
      ) : (
        <img
          alt=""
          data-decorative-art={asset.id}
          data-decorative-art-status={status}
          onError={() => {
            settle("unavailable", asset.id);
          }}
          onLoad={() => {
            settle("ready", asset.id);
          }}
          ref={readSettledImage}
          src={asset.url}
          style={status === "ready" ? artStyle : pendingArtStyle}
        />
      )}
    </div>
  );
}
