import { objectiveAnswerMatches } from "../../shared/worksheet/answer-oracle.js";
import { validateWorksheetInvariants } from "../../shared/worksheet/invariants.js";
import {
  createSeededRandom,
  seededShuffle,
} from "../../shared/worksheet/seeded-random.js";
import {
  GENERATION_INVARIANT_FAILED,
  TALLY_DETECTIVE_ITEM_COUNT,
  TALLY_DETECTIVE_TOTAL_MAXIMUM,
  TALLY_DETECTIVE_TOTAL_MINIMUM,
  type GenerationRequestV1,
  type GenerationResult,
  type GeneratorContextV1,
  type TallyDetectiveItemV1,
  type WorksheetDocumentV1,
} from "../../shared/worksheet/types.js";
import { TALLY_DETECTIVE_DEFINITION, tallyGroupingOf } from "./definition.js";

/*
 * Tally Detective (master plan Step 36): four distinct tallies. The
 * candidates are the totals 1 to 20 in ascending order; a page is a seeded
 * shuffle of them cut to four, so the seed is the only source of variation and
 * the same request always reproduces the same tallies.
 */

export type TallyDetectiveDocumentV1 = WorksheetDocumentV1<TallyDetectiveItemV1>;

/** Every total a tally may show, 1 through 20, in ascending order. */
export const TALLY_DETECTIVE_TOTALS: readonly number[] = Object.freeze(
  Array.from(
    { length: TALLY_DETECTIVE_TOTAL_MAXIMUM - TALLY_DETECTIVE_TOTAL_MINIMUM + 1 },
    (_, index) => TALLY_DETECTIVE_TOTAL_MINIMUM + index,
  ),
);

/**
 * The family's own check of a finished document: the shared invariants, whose
 * Tally Detective rules refuse a wrong item count, a mixed-family item, a
 * malformed grouping, a total outside 1 to 20, a repeated total, a wrong
 * answer and a request carrying anything beyond the canonical choices, then a
 * local recomputation of every answer from its bundles and remainder.
 */
export function validateTallyDetectiveDocument(
  document: TallyDetectiveDocumentV1,
): ReturnType<typeof validateWorksheetInvariants> {
  const invariantFailure = validateWorksheetInvariants(document);
  if (invariantFailure !== undefined) {
    return invariantFailure;
  }
  if (document.items.some((item) => objectiveAnswerMatches(item) !== true)) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "A generated Tally Detective answer failed local recomputation.",
    };
  }
  return undefined;
}

export function generateTallyDetective(
  request: GenerationRequestV1,
  context: GeneratorContextV1,
): GenerationResult<TallyDetectiveDocumentV1> {
  if (
    request.worksheetType !== TALLY_DETECTIVE_DEFINITION.id ||
    request.generatorVersion !== TALLY_DETECTIVE_DEFINITION.generatorVersion
  ) {
    return {
      ok: false,
      code: GENERATION_INVARIANT_FAILED,
      message: "The request does not match the registered Tally Detective generator.",
    };
  }

  const items: TallyDetectiveItemV1[] = seededShuffle(
    TALLY_DETECTIVE_TOTALS,
    createSeededRandom(request.seed),
  )
    .slice(0, TALLY_DETECTIVE_ITEM_COUNT)
    .map((total, index) => {
      const { bundles, remainder } = tallyGroupingOf(total);
      return {
        id: `item-${String(index + 1).padStart(3, "0")}`,
        itemType: "tally-detective",
        answerability: "objective",
        bundles,
        remainder,
        answer: { kind: "number", value: total },
      };
    });
  const document: TallyDetectiveDocumentV1 = {
    schemaVersion: 1,
    worksheetType: TALLY_DETECTIVE_DEFINITION.id,
    generatorVersion: TALLY_DETECTIVE_DEFINITION.generatorVersion,
    seed: request.seed,
    worksheetId: context.worksheetId,
    request,
    items,
  };
  const failure = validateTallyDetectiveDocument(document);
  return failure === undefined ? { ok: true, document } : failure;
}
