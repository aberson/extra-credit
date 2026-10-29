import { objectiveAnswerMatches } from "../../shared/worksheet/answer-oracle.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  CLOCK_EXPLORER_HOUR_MAXIMUM,
  CLOCK_EXPLORER_HOUR_MINIMUM,
  CLOCK_EXPLORER_ITEM_COUNT,
  GENERATION_INVARIANT_FAILED,
  type ClockExplorerItemV1,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import { CLOCK_EXPLORER_DEFINITION } from "./definition.js";

/*
 * Clock Explorer (master plan Step 35): four distinct on-the-hour clocks. The
 * candidates are the twelve hours in ascending order; a page is a seeded
 * shuffle of them cut to four, so the seed is the only source of variation and
 * the same request always reproduces the same clocks.
 */

export type ClockExplorerDocumentV1 = WorksheetDocumentV1<ClockExplorerItemV1>;

/** Every hour a clock may show, 1 through 12, in ascending order. */
export const CLOCK_EXPLORER_HOURS: readonly number[] = Object.freeze(
  Array.from(
    { length: CLOCK_EXPLORER_HOUR_MAXIMUM - CLOCK_EXPLORER_HOUR_MINIMUM + 1 },
    (_, index) => CLOCK_EXPLORER_HOUR_MINIMUM + index,
  ),
);

/**
 * The family's own check of a finished document: the shared invariants, whose
 * Clock Explorer rules refuse a wrong item count, a mixed-family item, an hour
 * outside 1 to 12, a repeated hour, a wrong answer and a request carrying
 * anything beyond the canonical choices, then a local recomputation of every
 * answer from its hour.
 */
export function validateClockExplorerDocument(
  document: ClockExplorerDocumentV1,
): ReturnType<typeof validateWorksheetInvariants> {
  const invariantFailure = validateWorksheetInvariants(document);
  if (invariantFailure !== undefined) {
    return invariantFailure;
  }
  if (document.items.some((item) => objectiveAnswerMatches(item) !== true)) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "A generated Clock Explorer answer failed local recomputation.",
    };
  }
  return undefined;
}

export function generateClockExplorer(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<ClockExplorerDocumentV1> {
  if (
    request.worksheetType !== CLOCK_EXPLORER_DEFINITION.id ||
    request.generatorVersion !== CLOCK_EXPLORER_DEFINITION.generatorVersion
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request does not match the registered Clock Explorer generator.",
    };
  }

  const items: ClockExplorerItemV1[] = seededShuffle(
    CLOCK_EXPLORER_HOURS,
    createSeededRandom(request.seed),
  )
    .slice(0, CLOCK_EXPLORER_ITEM_COUNT)
    .map((hour, index) => ({
      id: `item-${String(index + 1).padStart(3, "0")}`,
      itemType: "clock-explorer",
      answerability: "objective",
      hour,
      answer: { kind: "number", value: hour },
    }));
  const document: ClockExplorerDocumentV1 = {
    schemaVersion: 1,
    worksheetType: CLOCK_EXPLORER_DEFINITION.id,
    generatorVersion: CLOCK_EXPLORER_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items,
  };
  const failure = validateClockExplorerDocument(document);
  return failure === undefined ? { ok: true, document } : failure;
}
