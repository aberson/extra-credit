/**
 * An arithmetic oracle written from the math-activities plan's Appendix B, not
 * from production code (DD1). It judges Dry Math addition and subtraction by
 * a different method than the shipped generator: answers and regrouping come
 * from column arithmetic on decimal digit strings with explicit carry and
 * borrow propagation, and candidate sets come from brute force over the
 * focus. Its only `src/` imports are `import type`, so it compiles under every
 * TypeScript project and adds nothing to any production bundle.
 */
import type {
  GenerationRequestV1,
  WorksheetDocumentV1,
} from "../../src/shared/worksheet/types.js";

/** The Dry Math operand and result ceiling Appendix B.1 states. */
export const ORACLE_DRY_MATH_CEILING = 100;

export type OracleOperation = "addition" | "subtraction";
export type OracleRegrouping = "without" | "required";

/** The Appendix B.5 codes the addition and subtraction slice judges. */
export type OracleCode =
  | "WRONG_ANSWER"
  | "DUPLICATE_FACT"
  | "OUT_OF_SET"
  | "NEGATIVE"
  | "OVER_CEILING"
  | "REGROUPING_MISMATCH"
  | "SYMBOL_MISMATCH"
  | "KEY_MISMATCH";

export interface OracleViolation {
  readonly itemId: string;
  readonly code: OracleCode;
}

/** The addition and subtraction focus a page was asked for. */
export interface OracleFocus {
  readonly operations: readonly string[];
  readonly operandMax: number;
  readonly resultMax: number;
  readonly regrouping: OracleRegrouping;
}

/** One problem as the judge reads it, from a document item or a rendered row. */
export interface OracleFact {
  readonly id: string;
  readonly operation: string;
  readonly left: number;
  readonly right: number;
  readonly symbol: string;
  /** The stated answer; `undefined` when it is not a number. */
  readonly answer: number | undefined;
}

const SYMBOLS: Readonly<Record<OracleOperation, string>> = {
  addition: "+",
  subtraction: "−",
};

function digitColumns(left: number, right: number): readonly (readonly [number, number])[] {
  const width = Math.max(String(left).length, String(right).length);
  const leftText = String(left).padStart(width, "0");
  const rightText = String(right).padStart(width, "0");
  const columns: [number, number][] = [];
  for (let index = width - 1; index >= 0; index -= 1) {
    columns.push([Number(leftText[index]), Number(rightText[index])]);
  }
  return columns;
}

/** Column addition, ones first, carrying into the next column. */
export function columnAdd(
  left: number,
  right: number,
): { readonly sum: number; readonly carried: boolean } {
  let carry = 0;
  let carried = false;
  let digits = "";
  for (const [top, bottom] of digitColumns(left, right)) {
    const column = top + bottom + carry;
    carry = column >= 10 ? 1 : 0;
    carried ||= carry === 1;
    digits = String(column % 10) + digits;
  }
  if (carry === 1) {
    digits = `1${digits}`;
  }
  return { sum: Number(digits), carried };
}

/** Column subtraction, ones first, borrowing from the next column. Needs `minuend >= subtrahend`. */
export function columnSubtract(
  minuend: number,
  subtrahend: number,
): { readonly difference: number; readonly borrowed: boolean } {
  if (minuend < subtrahend) {
    throw new RangeError("Column subtraction is defined only when the minuend is at least the subtrahend.");
  }
  let borrow = 0;
  let borrowed = false;
  let digits = "";
  for (const [top, bottom] of digitColumns(minuend, subtrahend)) {
    let column = top - borrow - bottom;
    borrow = 0;
    if (column < 0) {
      column += 10;
      borrow = 1;
      borrowed = true;
    }
    digits = String(column) + digits;
  }
  return { difference: Number(digits), borrowed };
}

/** The value of one problem by column arithmetic; a subtraction below zero is negative. */
export function oracleValue(operation: OracleOperation, left: number, right: number): number {
  if (operation === "addition") {
    return columnAdd(left, right).sum;
  }
  return left < right ? -columnSubtract(right, left).difference : columnSubtract(left, right).difference;
}

/** Appendix B.1: whether one problem carries or borrows. Subtraction needs `left >= right`. */
export function oracleRegroups(operation: OracleOperation, left: number, right: number): boolean {
  return operation === "addition"
    ? columnAdd(left, right).carried
    : columnSubtract(left, right).borrowed;
}

function isOracleOperation(value: string): value is OracleOperation {
  return value === "addition" || value === "subtraction";
}

/** The `operation:left:right` key of every problem a focus allows, by brute force. */
export function oracleCandidateKeys(focus: OracleFocus): ReadonlySet<string> {
  const keys = new Set<string>();
  const operandLimit = Math.min(focus.operandMax, ORACLE_DRY_MATH_CEILING);
  const resultLimit = Math.min(focus.resultMax, ORACLE_DRY_MATH_CEILING);
  for (const operation of focus.operations) {
    if (!isOracleOperation(operation)) {
      continue;
    }
    for (let left = 0; left <= operandLimit; left += 1) {
      for (let right = 0; right <= operandLimit; right += 1) {
        if (operation === "subtraction" && left < right) {
          continue;
        }
        const value = oracleValue(operation, left, right);
        if (value > resultLimit) {
          continue;
        }
        if (oracleRegroups(operation, left, right) === (focus.regrouping === "required")) {
          keys.add(`${operation}:${left}:${right}`);
        }
      }
    }
  }
  return keys;
}

/** The focus a Dry Math request asks for, read from its own fields. */
export function oracleFocusOf(request: GenerationRequestV1): OracleFocus {
  if (request.worksheetType !== "dry-math") {
    throw new Error(`The arithmetic oracle does not judge ${request.worksheetType}.`);
  }
  const practice = request.practice;
  let regrouping: OracleRegrouping = "without";
  if (practice !== undefined) {
    if (practice.kind !== "dry-math-add-subtract" || practice.regrouping !== "required") {
      throw new Error("The arithmetic oracle met a practice choice it does not know.");
    }
    regrouping = "required";
  }
  const skills = request.capabilities.mathSkills;
  return {
    operations: [...skills.operations],
    operandMax: skills.operandMax,
    resultMax: skills.resultMax,
    regrouping,
  };
}

/** The first violation of one problem, or `undefined` when it is clean. */
function judgeFact(fact: OracleFact, focus: OracleFocus): OracleCode | undefined {
  if (!isOracleOperation(fact.operation)) {
    return "OUT_OF_SET";
  }
  if (fact.symbol !== SYMBOLS[fact.operation]) {
    return "SYMBOL_MISMATCH";
  }
  if (
    !Number.isInteger(fact.left) ||
    !Number.isInteger(fact.right) ||
    fact.left < 0 ||
    fact.right < 0 ||
    (fact.answer !== undefined && fact.answer < 0) ||
    (fact.operation === "subtraction" && fact.left < fact.right)
  ) {
    return "NEGATIVE";
  }
  const value = oracleValue(fact.operation, fact.left, fact.right);
  if (
    fact.left > ORACLE_DRY_MATH_CEILING ||
    fact.right > ORACLE_DRY_MATH_CEILING ||
    value > ORACLE_DRY_MATH_CEILING
  ) {
    return "OVER_CEILING";
  }
  if (fact.answer !== value) {
    return "WRONG_ANSWER";
  }
  if (
    !focus.operations.includes(fact.operation) ||
    fact.left > focus.operandMax ||
    fact.right > focus.operandMax ||
    value > focus.resultMax
  ) {
    return "OUT_OF_SET";
  }
  if (oracleRegroups(fact.operation, fact.left, fact.right) !== (focus.regrouping === "required")) {
    return "REGROUPING_MISMATCH";
  }
  return undefined;
}

/** Every problem's first violation, plus a repeated `operation:left:right` as a duplicate. */
export function judgeFacts(facts: readonly OracleFact[], focus: OracleFocus): readonly OracleViolation[] {
  const violations: OracleViolation[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    const code = judgeFact(fact, focus);
    if (code !== undefined) {
      violations.push({ itemId: fact.id, code });
      continue;
    }
    const key = `${fact.operation}:${fact.left}:${fact.right}`;
    if (seen.has(key)) {
      violations.push({ itemId: fact.id, code: "DUPLICATE_FACT" });
    }
    seen.add(key);
  }
  return violations;
}

/** Judges a generated Dry Math document against the focus its own request states. */
export function judgeDocument(document: WorksheetDocumentV1): readonly OracleViolation[] {
  const focus = oracleFocusOf(document.request);
  return judgeFacts(
    document.items.map((item): OracleFact => {
      if (item.itemType !== "dry-math") {
        return { id: item.id, operation: item.itemType, left: 0, right: 0, symbol: "", answer: undefined };
      }
      return {
        id: item.id,
        operation: item.operation,
        left: item.leftOperand,
        right: item.rightOperand,
        symbol: item.renderedSymbol,
        answer: item.answer.kind === "number" ? item.answer.value : undefined,
      };
    }),
    focus,
  );
}

/** One worksheet row as rendered: `37 + 48 = ____`. */
export interface RenderedRow {
  readonly id: string;
  readonly text: string;
}

/** One answer-key line as rendered, with its two data attributes. */
export interface RenderedKeyLine {
  readonly id: string;
  readonly source: string;
  readonly answer: string;
  readonly text: string;
}

/** The expression of a rendered Dry Math row, or `undefined` when it is not one. */
export function parseRenderedRow(
  text: string,
): { readonly operation: OracleOperation; readonly left: number; readonly right: number; readonly symbol: string } | undefined {
  const match = /^\s*(\d+)\s*([+−])\s*(\d+)\s*=\s*_+\s*$/u.exec(text);
  if (match === null) {
    return undefined;
  }
  const symbol = match[2] ?? "";
  return {
    operation: symbol === "+" ? "addition" : "subtraction",
    left: Number(match[1]),
    right: Number(match[3]),
    symbol,
  };
}

/**
 * Judges a rendered worksheet and its rendered key together: every row is
 * solved here by column arithmetic, and a key line whose answer differs from
 * that solution, or whose visible text does not restate the row with it, is
 * `KEY_MISMATCH`. The rows are then judged as problems against `focus`.
 */
export function judgeRenderedPage(
  rows: readonly RenderedRow[],
  keyLines: readonly RenderedKeyLine[],
  focus: OracleFocus,
): readonly OracleViolation[] {
  const violations: OracleViolation[] = [];
  const facts: OracleFact[] = [];
  if (keyLines.length !== rows.length) {
    violations.push({ itemId: "key", code: "KEY_MISMATCH" });
  }
  for (const [index, row] of rows.entries()) {
    const parsed = parseRenderedRow(row.text);
    if (parsed === undefined) {
      violations.push({ itemId: row.id, code: "SYMBOL_MISMATCH" });
      continue;
    }
    const solution =
      parsed.operation === "subtraction" && parsed.left < parsed.right
        ? undefined
        : oracleValue(parsed.operation, parsed.left, parsed.right);
    const expression = `${parsed.left} ${parsed.symbol} ${parsed.right}`;
    const keyLine = keyLines.find(({ id }) => id === row.id);
    if (
      keyLine === undefined ||
      keyLine.source !== expression ||
      keyLine.answer !== String(solution) ||
      keyLine.text !== `${index + 1}. ${expression} = ${keyLine.answer}`
    ) {
      violations.push({ itemId: row.id, code: "KEY_MISMATCH" });
    }
    facts.push({ id: row.id, operation: parsed.operation, left: parsed.left, right: parsed.right, symbol: parsed.symbol, answer: solution ?? -1 });
  }
  return [...violations, ...judgeFacts(facts, focus)];
}
