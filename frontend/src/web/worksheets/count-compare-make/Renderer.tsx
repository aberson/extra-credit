import type { CSSProperties } from "react";

import type {
  CountCompareComparisonItemV1,
  CountCompareCompleteItemV1,
  CountCompareDrawItemV1,
  CountCompareItemV1,
  CountCompareMatchItemV1,
  WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import {
  COUNT_COMPARE_MAKE_DEFINITION,
  COUNT_COMPARE_RELATIONS,
  COUNT_COMPARE_RELATION_WORDS,
} from "../../../worksheets/count-compare-make/definition";
import { DecorativeGraphic } from "../../preview/DecorativeGraphic";
import {
  InstructionalVisual,
  InstructionalWritingGuide,
} from "../../preview/InstructionalVisual";
import type { WorksheetRendererProps } from "../registry";

/**
 * Count, Compare & Make prints four subtypes on one page (plan.md:208).
 *
 * Every counted group, ten-frame, and drawing grid comes from
 * `preview/InstructionalVisual.tsx`; the item prompts are written here.
 * Neither takes a graphics flag, and the only consumer of the parent's
 * decorative choice on this page is the reserved header panel
 * (plan.md:202, :212). That separation is what makes
 * "graphics off changes decoration only" a structural fact rather than a
 * promise: `tests/e2e/count-compare-make.spec.ts` reads every ITEM's rendered
 * text, visual counts, and guide cells in both states and requires them to be
 * equal. The header sits outside that reading.
 */

const itemStyle: CSSProperties = {
  border: "1px solid #aeb8c5",
  borderRadius: "0.65rem",
  breakInside: "avoid",
  padding: "0.8rem",
};

const numeralStyle: CSSProperties = {
  fontSize: "2.1em",
  lineHeight: 1,
};

const circleTargetStyle: CSSProperties = {
  border: "2px solid currentColor",
  borderRadius: "50%",
  display: "inline-block",
  height: "1.05rem",
  width: "1.05rem",
};

/**
 * This family's OWN response vocabulary, deliberately not Sentence Builder's.
 *
 * `RequiredResponseV1` (drawing / dictation / labels / copying / writing) has
 * no circling form, so these two values are not a subset of it and this
 * attribute is not `data-required-response`. Reusing that attribute name with
 * different values would have made a selector mean two things across two
 * families.
 */
const RESPONSE_MODE = {
  match: "circle",
  compare: "circle",
  complete: "draw",
  draw: "draw",
} as const;

function isCountCompareMakeDocument(
  document: WorksheetDocumentV1,
): document is WorksheetDocumentV1<CountCompareItemV1> {
  return (
    document.worksheetType === COUNT_COMPARE_MAKE_DEFINITION.id &&
    document.items.length > 0 &&
    document.items.every((item) => item.itemType === "count-compare")
  );
}

/**
 * `6 marks` / `1 mark`, for the spoken label on an instructional visual.
 * `DrawItem` below pluralizes its own prompt noun independently.
 */
function quantityLabel(quantity: number): string {
  return `${quantity} ${quantity === 1 ? "mark" : "marks"}`;
}

function MatchItem({ item }: { readonly item: CountCompareMatchItemV1 }) {
  return (
    <>
      <p data-item-prompt="true" style={{ margin: "0 0 0.6rem" }}>
        Circle the group that shows{" "}
        <strong data-visible-numeral={item.target} style={numeralStyle}>
          {item.target}
        </strong>
        .
      </p>
      <ol
        aria-label={`Groups for ${item.id}`}
        style={{
          display: "grid",
          gap: "0.55rem",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {item.choices.map((choice, choiceIndex) => (
          <li
            data-match-choice={choiceIndex + 1}
            key={choiceIndex}
            style={{
              alignItems: "center",
              display: "grid",
              gap: "0.65rem",
              gridTemplateColumns: "1.4rem 1.2rem 1fr",
              minHeight: "2.5rem",
            }}
          >
            <strong>{choiceIndex + 1}.</strong>
            <span
              aria-hidden="true"
              data-circle-target="true"
              style={circleTargetStyle}
            />
            <InstructionalVisual
              label={quantityLabel(choice)}
              quantity={choice}
              shape="square"
            />
          </li>
        ))}
      </ol>
    </>
  );
}

function ComparisonItem({
  item,
}: {
  readonly item: CountCompareComparisonItemV1;
}) {
  return (
    <>
      <p data-item-prompt="true" style={{ margin: "0 0 0.6rem" }}>
        Count both groups. Circle the words that finish the sentence.
      </p>
      <div
        style={{
          display: "grid",
          gap: "0.6rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))",
        }}
      >
        <div data-compare-group="first">
          <p style={{ margin: "0 0 0.25rem" }}>First group</p>
          <InstructionalVisual
            label={quantityLabel(item.leftQuantity)}
            quantity={item.leftQuantity}
          />
        </div>
        <div data-compare-group="second">
          <p style={{ margin: "0 0 0.25rem" }}>Second group</p>
          <InstructionalVisual
            label={quantityLabel(item.rightQuantity)}
            quantity={item.rightQuantity}
            shape="triangle"
          />
        </div>
      </div>
      <p style={{ marginBottom: 0 }}>The first group has</p>
      <ul
        aria-label={`Comparison words for ${item.id}`}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem 0.9rem",
          listStyle: "none",
          margin: "0.35rem 0 0",
          padding: 0,
        }}
      >
        {COUNT_COMPARE_RELATIONS.map((relation) => (
          <li
            data-relation-word={relation}
            key={relation}
            style={{
              border: "1px solid #24324a",
              borderRadius: "0.4rem",
              padding: "0.15rem 0.55rem",
            }}
          >
            {COUNT_COMPARE_RELATION_WORDS[relation]}
          </li>
        ))}
      </ul>
      <p style={{ margin: "0.35rem 0 0" }}>the second group.</p>
    </>
  );
}

function CompleteItem({ item }: { readonly item: CountCompareCompleteItemV1 }) {
  return (
    <>
      <p data-item-prompt="true" style={{ margin: "0 0 0.6rem" }}>
        This group needs{" "}
        <strong data-visible-numeral={item.target} style={numeralStyle}>
          {item.target}
        </strong>{" "}
        in all. Draw the missing marks in the empty boxes.
      </p>
      <div data-complete-group="true">
        {/*
          The frame is sized by the TARGET, so there are always at least
          `target - partial` empty boxes for the marks this item asks for.
          Sizing it by `partial` printed a frame that could not hold the
          answer: at target 20 over a group of 8 the child had two boxes for
          twelve marks, and at partial 10 there were no boxes at all.
        */}
        <InstructionalVisual
          capacity={item.target}
          label={`${quantityLabel(item.partial)} already drawn, in a ten-frame`}
          quantity={item.partial}
          variant="ten-frame"
        />
      </div>
    </>
  );
}

function DrawItem({ item }: { readonly item: CountCompareDrawItemV1 }) {
  return (
    <>
      <p data-item-prompt="true" style={{ margin: "0 0 0.6rem" }}>
        Draw{" "}
        <strong data-visible-numeral={item.target} style={numeralStyle}>
          {item.target}
        </strong>{" "}
        {item.target === 1 ? "mark" : "marks"} in the boxes.
      </p>
      {/* The guide rounds up to whole ten-frames, so it always holds `target`. */}
      <InstructionalWritingGuide
        capacity={item.target}
        label="Draw your marks here."
      />
    </>
  );
}

function CountCompareItem({ item }: { readonly item: CountCompareItemV1 }) {
  switch (item.activity) {
    case "match":
      return <MatchItem item={item} />;
    case "compare":
      return <ComparisonItem item={item} />;
    case "complete":
      return <CompleteItem item={item} />;
    case "draw":
      return <DrawItem item={item} />;
  }
}

export function CountCompareMakeRenderer({ document }: WorksheetRendererProps) {
  if (!isCountCompareMakeDocument(document)) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  const familyTitle = `${COUNT_COMPARE_MAKE_DEFINITION.displayName} practice`;
  const { displayName } = document.request;
  // Interests reach decoration only: the counted work is the same whichever
  // reviewed topic the panel draws from, and an unmatched tag never arrives
  // here because the sole projection boundary drops it before the request.
  const decorativeTopicId = document.request.topicIds?.[0] ?? "neutral";

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header
        style={{
          alignItems: "flex-start",
          borderBottom: "2px solid #24324a",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
          <h2 id={`worksheet-${document.worksheetId}-title`}>
            {displayName === undefined
              ? familyTitle
              : `${displayName}’s ${familyTitle}`}
          </h2>
          <p>Count the groups, compare them, and make the ones that are asked for.</p>
        </div>
        <DecorativeGraphic
          includeDecorativeGraphics={
            document.request.options.includeDecorativeGraphics
          }
          seed={document.seed}
          topicId={decorativeTopicId}
        />
      </header>
      <ol
        aria-label="Count, Compare and Make items"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 17rem), 1fr))",
          listStyle: "none",
          padding: 0,
        }}
      >
        {document.items.map((item, index) => (
          <li
            data-activity={item.activity}
            data-item-id={item.id}
            data-response-mode={RESPONSE_MODE[item.activity]}
            id={`worksheet-${document.worksheetId}-worksheet-${item.id}`}
            key={item.id}
            style={itemStyle}
          >
            <strong data-problem-number={index + 1}>{index + 1}.</strong>
            <CountCompareItem item={item} />
          </li>
        ))}
      </ol>
    </article>
  );
}
