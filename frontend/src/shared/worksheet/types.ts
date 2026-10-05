import type {
  FACT_OPERATIONS,
  NUMBER_BONDS_REGROUPING_MODES,
  PAPER_SIZES,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
} from "../config/enums.js";
import type {
  MathSkillsV1,
  PresentationBand,
  WritingMode,
} from "../config/schema.js";

export const WORKSHEET_TYPE_IDS = [
  "dry-math",
  "find-the-wow",
  "sentence-builder",
  "count-compare-make",
  "number-bonds",
] as const;

/**
 * The quantity and unexpanded-family numeric envelope. Symbolic Dry Math
 * has its own higher operand/result ceiling below; dot/frame tasks stay small.
 *
 * Defined in this leaf module because the projection boundary that clamps to
 * it, the invariant checker that re-verifies the clamp, the families whose own
 * limit arithmetic repeats it, the ten-frame ceiling in the preview, and the
 * parent-facing controls that disclose it all import from here.
 *
 * `tests/integration/envelope-single-source.test.ts` guards that. Value
 * equality cannot tell a re-export from a constant retyped as a fresh literal,
 * so it pairs the runtime identity with source scans that hand the shipped
 * modules under `frontend/src` (`.ts` and `.tsx`, `*.test.*` excluded) to the
 * TypeScript compiler and walk the syntax tree.
 *
 * What that guard covers is defined by the tests and the fixtures in that
 * file: a claim about its reach arrives there as a fixture row plus a test,
 * never as a sentence in this comment. Known escapes are tracked on
 * issue #23.
 */
export const V1_NUMERIC_MAXIMUM = 20;

/** Symbolic Dry Math supports larger facts without enlarging dot/frame tasks. */
export const DRY_MATH_NUMERIC_MAXIMUM = 100;

/**
 * The largest factor, divisor and quotient of a Dry Math multiplication or
 * division fact, and so the largest fact family (math-activities plan, P3 and
 * DD9). Every reader imports it rather than restating the number.
 */
export const FACT_FACTOR_MAXIMUM = 12;

/** The largest dividend of a Dry Math division fact: the largest product of two factors. */
export const FACT_DIVIDEND_MAXIMUM = FACT_FACTOR_MAXIMUM * FACT_FACTOR_MAXIMUM;

/**
 * The smallest whole a Number Bonds problem may have: two parts of at least 1
 * each (math-activities plan, DD10). The largest is `V1_NUMERIC_MAXIMUM`.
 */
export const NUMBER_BONDS_WHOLE_MINIMUM = 2;

export function worksheetMaximum(
  worksheetType: WorksheetType,
  key: "countingMax" | "numeralMax" | "compareMax" | "operandMax" | "resultMax",
): number {
  return worksheetType === "dry-math" && (key === "operandMax" || key === "resultMax")
    ? DRY_MATH_NUMERIC_MAXIMUM
    : V1_NUMERIC_MAXIMUM;
}

export const TOPIC_IDS = [
  "animals",
  "space",
  "nature",
  "sports",
  "vehicles",
  "neutral",
] as const;

/**
 * The topics an interest may actually MATCH. `neutral` is the fallback a
 * consumer substitutes when nothing matched; it is never the result of
 * matching an interest, so it is deliberately absent here.
 *
 * The sole projection boundary (`project-request.ts`) reads this one
 * declaration for both things a reviewed interest can decide: the `topicIds`
 * a Sentence Builder request carries, and the first reviewed interest a
 * "From interests" Theme resolves to for Count, Compare & Make's
 * `options.decorativeTopicId`. An interest outside this list reaches neither.
 *
 * Only Sentence Builder requests carry `topicIds`. Its generator keeps the IDs
 * its own vocabulary knows and otherwise falls back to `neutral`; every other
 * family's validator refuses a request that carries `topicIds` at all.
 */
export const REVIEWED_TOPIC_IDS = [
  "animals",
  "space",
  "nature",
  "sports",
  "vehicles",
] as const satisfies readonly (typeof TOPIC_IDS)[number][];

export const GENERATION_CONSTRAINT_CONFLICT =
  "GENERATION_CONSTRAINT_CONFLICT" as const;
export const GENERATION_INVARIANT_FAILED =
  "GENERATION_INVARIANT_FAILED" as const;

export type WorksheetType = (typeof WORKSHEET_TYPE_IDS)[number];
export type TopicId = (typeof TOPIC_IDS)[number];
export type SeedHex = string;

export type MathOperation = MathSkillsV1["operations"][number];
/** Dry Math's multiplication and division facts, which never reach `mathSkills`. */
export type FactOperation = (typeof FACT_OPERATIONS)[number];
/** Every operation a Dry Math item can hold: the two arithmetic ones and the two fact ones. */
export type DryMathOperation = MathOperation | FactOperation;
/** Number Bonds' carrying and borrowing choice. */
export type NumberBondsRegrouping = (typeof NUMBER_BONDS_REGROUPING_MODES)[number];
export type MathRepresentation = MathSkillsV1["representations"][number];
// `enums.ts` imports `TOPIC_IDS` from this module as a value, so these three
// derive from its arrays through `import type` only (D30).
export type WorksheetLength = (typeof WORKSHEET_LENGTHS)[number];
export type PaperSize = (typeof PAPER_SIZES)[number];
export type PrintScale = (typeof PRINT_SCALES)[number];

export interface EffectiveMathSkillsV1 {
  readonly countingMax: number;
  readonly numeralMax: number;
  readonly compareMax: number;
  readonly representations: readonly MathRepresentation[];
  readonly understandsEquality: boolean;
  readonly operations: readonly MathOperation[];
  readonly operandMax: number;
  readonly resultMax: number;
  readonly allowRegrouping: false;
  readonly allowNegativeResults: false;
}

export interface EffectiveCapabilitiesV1 {
  readonly presentationBand: PresentationBand;
  readonly writingMode: WritingMode;
  readonly mathSkills: EffectiveMathSkillsV1;
}

export interface GenerationOptionsV1 {
  readonly length: WorksheetLength;
  readonly includeDecorativeGraphics: boolean;
  readonly includeAnswerKey: boolean;
  readonly paperSize: PaperSize;
  readonly printScale: PrintScale;
  /**
   * The topic the reserved decorative panel draws from. The projector carries
   * it only while decorative graphics are on, and only for the two decorating
   * families; it never reaches items or answers.
   */
  readonly decorativeTopicId?: TopicId;
}

/**
 * What a math family practises beyond its `mathSkills` focus (math-activities
 * plan, Appendix A.3). Dry Math's "Every problem carries or borrows" is the
 * add-subtract kind; "Without carrying or borrowing" is no `practice` member at
 * all, so every request an earlier build produced keeps its exact shape. Dry
 * Math's multiplication and division facts are the facts kind: its operations
 * in canonical order and its fact families in ascending order. Every Number
 * Bonds request carries the Number Bonds kind: missing number sentences, their
 * operations in canonical order, the largest whole and the carrying and
 * borrowing choice.
 */
export type PracticeRequestV1 =
  | {
      readonly kind: "dry-math-add-subtract";
      readonly regrouping: "required";
    }
  | {
      readonly kind: "dry-math-facts";
      readonly operations: readonly FactOperation[];
      readonly factFamilies: readonly number[];
    }
  | {
      readonly kind: "number-bonds";
      readonly variant: "sentence";
      readonly operations: readonly MathOperation[];
      readonly wholeMax: number;
      readonly regrouping: NumberBondsRegrouping;
    };

export interface GenerationRequestV1 {
  readonly schemaVersion: 1;
  readonly worksheetType: WorksheetType;
  readonly generatorVersion: number;
  readonly seed: SeedHex;
  readonly capabilities: EffectiveCapabilitiesV1;
  readonly options: GenerationOptionsV1;
  readonly displayName?: string;
  readonly topicIds?: readonly TopicId[];
  /** Absent unless the selection asks for more than its focus states. */
  readonly practice?: PracticeRequestV1;
}

export type ObjectiveAnswerV1 =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "choice"; readonly value: 0 | 1 | 2 }
  | {
      readonly kind: "comparison";
      readonly value: "less" | "equal" | "greater";
    };

interface ObjectiveItemBaseV1 {
  readonly id: string;
  readonly answerability: "objective";
  readonly answer: ObjectiveAnswerV1;
}

interface OpenItemBaseV1 {
  readonly id: string;
  readonly answerability: "open";
  readonly answer: null;
}

/**
 * One Dry Math problem. A division keeps the dividend as `leftOperand` and the
 * divisor as `rightOperand`, so every item reads left to right as printed.
 */
export interface DryMathItemV1 extends ObjectiveItemBaseV1 {
  readonly itemType: "dry-math";
  readonly operation: DryMathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly renderedSymbol: "+" | "−" | "×" | "÷";
  readonly answer: { readonly kind: "number"; readonly value: number };
}

export interface QuantityWowChoiceV1 {
  readonly kind: "quantity";
  readonly numeral: number;
  readonly quantity: number;
}

export interface EquationWowChoiceV1 {
  readonly kind: "equation";
  readonly operation: MathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly renderedSymbol: "+" | "−";
  readonly displayedResult: number;
}

interface WowGroupItemBaseV1 extends ObjectiveItemBaseV1 {
  readonly itemType: "wow-group";
  readonly correctPosition: 0 | 1 | 2;
  readonly answer: { readonly kind: "choice"; readonly value: 0 | 1 | 2 };
}

export interface QuantityWowGroupItemV1 extends WowGroupItemBaseV1 {
  readonly mode: "quantity";
  readonly choices: readonly [
    QuantityWowChoiceV1,
    QuantityWowChoiceV1,
    QuantityWowChoiceV1,
  ];
}

export interface EquationWowGroupItemV1 extends WowGroupItemBaseV1 {
  readonly mode: "equation";
  readonly choices: readonly [
    EquationWowChoiceV1,
    EquationWowChoiceV1,
    EquationWowChoiceV1,
  ];
}

export type WowGroupItemV1 =
  | QuantityWowGroupItemV1
  | EquationWowGroupItemV1;

export interface RequiredResponseV1 {
  readonly drawing: boolean;
  readonly dictation: boolean;
  readonly labels: boolean;
  readonly copying: boolean;
  readonly writing: boolean;
}

interface SentenceItemBaseV1 extends OpenItemBaseV1 {
  readonly itemType: "sentence";
  readonly prompt: string;
  readonly topicId: TopicId;
}

export interface DrawAndTellSentenceItemV1 extends SentenceItemBaseV1 {
  readonly writingMode: "draw-and-tell";
  readonly wordBank?: never;
  readonly modelSentence?: never;
  readonly sentenceFrame?: never;
  readonly requiredResponse: {
    readonly drawing: true;
    readonly dictation: true;
    readonly labels: false;
    readonly copying: false;
    readonly writing: false;
  };
}

export interface LabelSentenceItemV1 extends SentenceItemBaseV1 {
  readonly writingMode: "label";
  readonly wordBank: readonly string[];
  readonly modelSentence?: never;
  readonly sentenceFrame?: never;
  readonly requiredResponse: {
    readonly drawing: true;
    readonly dictation: false;
    readonly labels: true;
    readonly copying: false;
    readonly writing: false;
  };
}

export interface CopyWithModelSentenceItemV1 extends SentenceItemBaseV1 {
  readonly writingMode: "copy-with-model";
  readonly wordBank?: never;
  readonly modelSentence: string;
  readonly sentenceFrame?: never;
  readonly requiredResponse: {
    readonly drawing: false;
    readonly dictation: false;
    readonly labels: false;
    readonly copying: true;
    readonly writing: false;
  };
}

export interface SentenceFrameItemV1 extends SentenceItemBaseV1 {
  readonly writingMode: "sentence-frame";
  readonly wordBank: readonly string[];
  readonly modelSentence?: never;
  readonly sentenceFrame: string;
  readonly requiredResponse: {
    readonly drawing: false;
    readonly dictation: false;
    readonly labels: false;
    readonly copying: false;
    readonly writing: true;
  };
}

export interface IndependentSentenceItemV1 extends SentenceItemBaseV1 {
  readonly writingMode: "independent";
  readonly wordBank: readonly string[];
  readonly modelSentence?: never;
  readonly sentenceFrame?: never;
  readonly requiredResponse: {
    readonly drawing: true;
    readonly dictation: false;
    readonly labels: false;
    readonly copying: false;
    readonly writing: true;
  };
}

export type SentenceItemV1 =
  | DrawAndTellSentenceItemV1
  | LabelSentenceItemV1
  | CopyWithModelSentenceItemV1
  | SentenceFrameItemV1
  | IndependentSentenceItemV1;

interface CountCompareItemBaseV1 extends ObjectiveItemBaseV1 {
  readonly itemType: "count-compare";
}

export interface CountCompareMatchItemV1 extends CountCompareItemBaseV1 {
  readonly activity: "match";
  readonly target: number;
  readonly choices: readonly [number, number, number];
  readonly answer: { readonly kind: "choice"; readonly value: 0 | 1 | 2 };
  readonly partial?: never;
  readonly leftQuantity?: never;
  readonly rightQuantity?: never;
}

export interface CountCompareComparisonItemV1 extends CountCompareItemBaseV1 {
  readonly activity: "compare";
  readonly leftQuantity: number;
  readonly rightQuantity: number;
  readonly answer: {
    readonly kind: "comparison";
    readonly value: "less" | "equal" | "greater";
  };
  readonly target?: never;
  readonly partial?: never;
  readonly choices?: never;
}

export interface CountCompareCompleteItemV1 extends CountCompareItemBaseV1 {
  readonly activity: "complete";
  readonly target: number;
  readonly partial: number;
  readonly answer: { readonly kind: "number"; readonly value: number };
  readonly leftQuantity?: never;
  readonly rightQuantity?: never;
  readonly choices?: never;
}

export interface CountCompareDrawItemV1 extends CountCompareItemBaseV1 {
  readonly activity: "draw";
  readonly target: number;
  readonly answer: { readonly kind: "number"; readonly value: number };
  readonly partial?: never;
  readonly leftQuantity?: never;
  readonly rightQuantity?: never;
  readonly choices?: never;
}

export type CountCompareItemV1 =
  | CountCompareMatchItemV1
  | CountCompareComparisonItemV1
  | CountCompareCompleteItemV1
  | CountCompareDrawItemV1;

/**
 * One Number Bonds missing number sentence. The item keeps the whole relation
 * `leftOperand renderedSymbol rightOperand = result`, with every number at
 * least 1, and `missing` names the one number printed as a blank: an addend
 * for addition, the minuend or the subtrahend for subtraction. The result is
 * always shown, and the answer is the missing number.
 */
export interface NumberBondSentenceItemV1 extends ObjectiveItemBaseV1 {
  readonly itemType: "number-bond";
  readonly form: "sentence";
  readonly operation: MathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly result: number;
  readonly renderedSymbol: "+" | "−";
  readonly missing: "left" | "right";
  readonly answer: { readonly kind: "number"; readonly value: number };
}

export type NumberBondItemV1 = NumberBondSentenceItemV1;

export type WorksheetItemV1 =
  | DryMathItemV1
  | WowGroupItemV1
  | SentenceItemV1
  | CountCompareItemV1
  | NumberBondItemV1;

export interface WorksheetDocumentV1<
  TItem extends WorksheetItemV1 = WorksheetItemV1,
> {
  readonly schemaVersion: 1;
  readonly worksheetType: WorksheetType;
  readonly generatorVersion: number;
  readonly seed: SeedHex;
  readonly worksheetId: string;
  readonly request: GenerationRequestV1;
  readonly items: readonly TItem[];
}

export interface GenerationFailure {
  readonly ok: false;
  readonly code:
    | typeof GENERATION_CONSTRAINT_CONFLICT
    | typeof GENERATION_INVARIANT_FAILED;
  readonly message: string;
}

export interface GenerationSuccess<TDocument extends WorksheetDocumentV1> {
  readonly ok: true;
  readonly document: TDocument;
}

export type GenerationResult<
  TDocument extends WorksheetDocumentV1 = WorksheetDocumentV1,
> = GenerationSuccess<TDocument> | GenerationFailure;

export interface GeneratorContextV1 {
  readonly worksheetId: string;
}

export type WorksheetGeneratorV1 = (
  request: GenerationRequestV1,
  context: GeneratorContextV1,
) => GenerationResult;
