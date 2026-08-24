import type { WritingMode } from "../../../shared/config/schema";
import type {
  SentenceItemV1,
  WorksheetDocumentV1,
  WorksheetLength,
} from "../../../shared/worksheet/types";
import {
  SENTENCE_BUILDER_DEFINITION,
  SENTENCE_BUILDER_MODE_LABELS,
  getSentenceBuilderEffectiveLength,
} from "../../../worksheets/sentence-builder/definition";
import type { WorksheetRendererProps } from "../registry";

interface ResponseLineCountsV1 {
  readonly copyLines: number;
  readonly labelLines: number;
  readonly writingLines: number;
}

/**
 * Response-surface geometry only. WHICH surfaces appear is decided by the
 * generated item's own `requiredResponse`; this table only says how much room
 * each surface prints. Decorative graphics never reach this renderer, so the
 * prompt, bank, item count, and required response cannot change with them.
 *
 * Keyed by effective length because plan.md:236 makes the length control
 * change response space as well as word-bank breadth. The two no-bank modes
 * always normalize to `standard`, so only their print scale can move them.
 */
const RESPONSE_LINE_COUNTS = {
  "draw-and-tell": {
    short: { copyLines: 0, labelLines: 0, writingLines: 0 },
    standard: { copyLines: 0, labelLines: 0, writingLines: 0 },
    long: { copyLines: 0, labelLines: 0, writingLines: 0 },
  },
  label: {
    short: { copyLines: 0, labelLines: 3, writingLines: 0 },
    standard: { copyLines: 0, labelLines: 4, writingLines: 0 },
    long: { copyLines: 0, labelLines: 5, writingLines: 0 },
  },
  "copy-with-model": {
    short: { copyLines: 2, labelLines: 0, writingLines: 0 },
    standard: { copyLines: 3, labelLines: 0, writingLines: 0 },
    long: { copyLines: 4, labelLines: 0, writingLines: 0 },
  },
  "sentence-frame": {
    short: { copyLines: 0, labelLines: 0, writingLines: 2 },
    standard: { copyLines: 0, labelLines: 0, writingLines: 3 },
    long: { copyLines: 0, labelLines: 0, writingLines: 4 },
  },
  independent: {
    short: { copyLines: 0, labelLines: 0, writingLines: 4 },
    standard: { copyLines: 0, labelLines: 0, writingLines: 5 },
    long: { copyLines: 0, labelLines: 0, writingLines: 6 },
  },
} as const satisfies Record<
  WritingMode,
  Record<WorksheetLength, ResponseLineCountsV1>
>;

/** Drawing-box height in rem per effective length. */
const DRAWING_BOX_REM = {
  short: 12,
  standard: 14,
  long: 16,
} as const satisfies Record<WorksheetLength, number>;

const LARGE_PRINT_DRAWING_EXTRA_REM = 4;

/**
 * Every child-facing string this renderer owns, per writing mode, in one
 * place. The page must not contradict the prompt it is printing: the bank
 * heading has to be the name the prompts use for that bank (plan.md:196 calls
 * the `independent` pool an idea word bank), the writing caption has to match
 * how many sentences that mode's prompts ask for, and the dictation note must
 * complement its prompt rather than repeat the prompt's own closing sentence.
 */
const MODE_COPY = {
  "draw-and-tell": {
    bankTitle: "Word bank",
    instruction: "Draw your picture, then tell a grown-up about it.",
    writingCaption: "Write your sentence here.",
  },
  label: {
    bankTitle: "Word bank",
    instruction: "Draw your picture, then write labels on the lines.",
    writingCaption: "Write your sentence here.",
  },
  "copy-with-model": {
    bankTitle: "Word bank",
    instruction: "Read the model sentence, then copy it on the lines.",
    writingCaption: "Write your sentence here.",
  },
  "sentence-frame": {
    bankTitle: "Word bank",
    instruction: "Finish the sentence frame on the writing lines.",
    writingCaption: "Write your sentence here.",
  },
  independent: {
    bankTitle: "Idea words",
    instruction: "Draw your picture, then write about it on the lines.",
    writingCaption: "Write your sentences here.",
  },
} as const satisfies Record<
  WritingMode,
  { bankTitle: string; instruction: string; writingCaption: string }
>;

/**
 * The dictation surface marks itself as a talking surface. The prompt already
 * tells the child to tell a grown-up, so repeating that sentence here printed
 * it twice on the same page.
 */
const DICTATION_NOTE = "This part is for talking, not writing.";

function isSentenceBuilderDocument(
  document: WorksheetDocumentV1,
): document is WorksheetDocumentV1<SentenceItemV1> {
  return (
    document.worksheetType === SENTENCE_BUILDER_DEFINITION.id &&
    document.items.length === 1 &&
    document.items.every((item) => item.itemType === "sentence")
  );
}

function ResponseLines({
  count,
  kind,
  label,
  lineHeight,
}: {
  readonly count: number;
  readonly kind: "label" | "copy" | "write";
  readonly label: string;
  readonly lineHeight: string;
}) {
  return (
    <div data-response-lines={kind}>
      <p style={{ margin: "0 0 0.35rem" }}>{label}</p>
      {Array.from({ length: count }, (_, index) => (
        <div
          aria-hidden="true"
          data-response-line={kind}
          key={index}
          style={{
            borderBottom: "1px solid #24324a",
            height: lineHeight,
          }}
        />
      ))}
    </div>
  );
}

export function SentenceBuilderRenderer({ document }: WorksheetRendererProps) {
  if (!isSentenceBuilderDocument(document)) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }
  const item = document.items[0];
  if (item === undefined) {
    return <p role="alert">This worksheet could not be rendered safely.</p>;
  }

  const familyTitle = `${SENTENCE_BUILDER_DEFINITION.displayName} practice`;
  const { displayName } = document.request;
  const largePrint = document.request.options.printScale === "large";
  const lineHeight = largePrint ? "2.6rem" : "2rem";
  const effectiveLength = getSentenceBuilderEffectiveLength(
    item.writingMode,
    document.request.options.length,
    document.request.options.printScale,
  );
  const drawingHeight = `${
    DRAWING_BOX_REM[effectiveLength] +
    (largePrint ? LARGE_PRINT_DRAWING_EXTRA_REM : 0)
  }rem`;
  const lines = RESPONSE_LINE_COUNTS[item.writingMode][effectiveLength];
  const copy = MODE_COPY[item.writingMode];
  const response = item.requiredResponse;
  const requiredResponseSummary = (
    ["drawing", "dictation", "labels", "copying", "writing"] as const
  )
    .filter((key) => response[key])
    .join(",");
  const wordBank = item.wordBank;
  const bankTitleId = `worksheet-${document.worksheetId}-word-bank`;

  return (
    <article aria-labelledby={`worksheet-${document.worksheetId}-title`}>
      <header style={{ borderBottom: "2px solid #24324a", marginBottom: "1rem" }}>
        <h2 id={`worksheet-${document.worksheetId}-title`}>
          {displayName === undefined
            ? familyTitle
            : `${displayName}’s ${familyTitle}`}
        </h2>
        <p data-mode-instruction={SENTENCE_BUILDER_MODE_LABELS[item.writingMode]}>
          {copy.instruction}
        </p>
      </header>
      <ol
        aria-label="Sentence Builder prompt"
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        <li
          data-item-id={item.id}
          data-required-response={requiredResponseSummary}
          data-sentence-item="true"
          data-topic-id={item.topicId}
          data-writing-mode={item.writingMode}
          id={`worksheet-${document.worksheetId}-worksheet-${item.id}`}
        >
          <p
            data-sentence-prompt="true"
            style={{ fontSize: "1.2rem", fontWeight: 650, marginTop: 0 }}
          >
            {item.prompt}
          </p>

          {wordBank !== undefined && (
            <section
              aria-labelledby={bankTitleId}
              data-word-bank="true"
              style={{
                border: "1px solid #aeb8c5",
                borderRadius: "0.65rem",
                marginBottom: "0.9rem",
                padding: "0.7rem",
              }}
            >
              <h3 id={bankTitleId} style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
                {copy.bankTitle}
              </h3>
              <ul
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.45rem 0.8rem",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                {wordBank.map((word) => (
                  <li
                    data-bank-word={word}
                    key={word}
                    style={{
                      border: "1px solid #24324a",
                      borderRadius: "0.4rem",
                      padding: "0.15rem 0.55rem",
                    }}
                  >
                    {word}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {item.modelSentence !== undefined && (
            <p
              data-model-sentence="true"
              style={{
                border: "1px solid #24324a",
                borderRadius: "0.5rem",
                fontSize: "1.35rem",
                margin: "0 0 0.9rem",
                padding: "0.6rem 0.8rem",
              }}
            >
              {item.modelSentence}
            </p>
          )}

          {item.sentenceFrame !== undefined && (
            <p
              data-sentence-frame="true"
              style={{ fontSize: "1.35rem", margin: "0 0 0.9rem" }}
            >
              {item.sentenceFrame}
            </p>
          )}

          <div data-response-panel="true" style={{ display: "grid", gap: "0.9rem" }}>
            {response.drawing && (
              <div data-drawing-area="true">
                <p style={{ margin: "0 0 0.35rem" }}>Draw your picture here.</p>
                <div
                  aria-hidden="true"
                  data-drawing-box="true"
                  style={{
                    border: "2px solid #24324a",
                    borderRadius: "0.65rem",
                    height: drawingHeight,
                  }}
                />
              </div>
            )}

            {response.dictation && (
              <p data-dictation-note="true" style={{ margin: 0 }}>
                {DICTATION_NOTE}
              </p>
            )}

            {response.labels && (
              <ResponseLines
                count={lines.labelLines}
                kind="label"
                label="Write your labels here."
                lineHeight={lineHeight}
              />
            )}

            {response.copying && (
              <ResponseLines
                count={lines.copyLines}
                kind="copy"
                label="Copy the sentence here."
                lineHeight={lineHeight}
              />
            )}

            {response.writing && (
              <ResponseLines
                count={lines.writingLines}
                kind="write"
                label={copy.writingCaption}
                lineHeight={lineHeight}
              />
            )}
          </div>
        </li>
      </ol>
    </article>
  );
}
