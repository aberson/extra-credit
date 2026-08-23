import type {
  GenerationDefaultsV1,
  MathSkillsV1,
  PresentationBand,
  WritingMode,
} from "../config/schema.js";

export const WORKSHEET_TYPE_IDS = [
  "dry-math",
  "find-the-wow",
  "sentence-builder",
  "count-compare-make",
] as const;

export const TOPIC_IDS = [
  "animals",
  "space",
  "nature",
  "sports",
  "vehicles",
  "neutral",
] as const;

export const GENERATION_CONSTRAINT_CONFLICT =
  "GENERATION_CONSTRAINT_CONFLICT" as const;
export const GENERATION_INVARIANT_FAILED =
  "GENERATION_INVARIANT_FAILED" as const;

export type WorksheetType = (typeof WORKSHEET_TYPE_IDS)[number];
export type TopicId = (typeof TOPIC_IDS)[number];
export type SeedHex = string;

export type MathOperation = MathSkillsV1["operations"][number];
export type MathRepresentation = MathSkillsV1["representations"][number];
export type Difficulty = GenerationDefaultsV1["difficulty"];
export type WorksheetLength = GenerationDefaultsV1["length"];
export type PaperSize = GenerationDefaultsV1["paperSize"];
export type PrintScale = GenerationDefaultsV1["printScale"];

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
  readonly difficulty: Difficulty;
  readonly length: WorksheetLength;
  readonly includeDecorativeGraphics: boolean;
  readonly includeAnswerKey: boolean;
  readonly paperSize: PaperSize;
  readonly printScale: PrintScale;
}

export interface GenerationRequestV1 {
  readonly schemaVersion: 1;
  readonly worksheetType: WorksheetType;
  readonly generatorVersion: number;
  readonly seed: SeedHex;
  readonly capabilities: EffectiveCapabilitiesV1;
  readonly options: GenerationOptionsV1;
  readonly displayName?: string;
  readonly topicIds?: readonly TopicId[];
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

export interface DryMathItemV1 extends ObjectiveItemBaseV1 {
  readonly itemType: "dry-math";
  readonly operation: MathOperation;
  readonly leftOperand: number;
  readonly rightOperand: number;
  readonly renderedSymbol: "+" | "−";
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

export type WorksheetItemV1 =
  | DryMathItemV1
  | WowGroupItemV1
  | SentenceItemV1
  | CountCompareItemV1;

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
