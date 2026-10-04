/**
 * An arithmetic oracle written from the math-activities plan's Appendix B, not
 * from production code (DD1). It judges Dry Math addition and subtraction by
 * a different method than the shipped generator: answers and regrouping come
 * from column arithmetic on decimal digit strings with explicit carry and
 * borrow propagation, and candidate sets come from brute force over the
 * focus. Multiplication and division facts are judged the same way: products
 * by repeated column addition, quotients and remainders by repeated column
 * subtraction, fact sets by brute force over every dividend and divisor, and
 * their sizes also by the closed forms of Appendix B.2. Its only `src/`
 * imports are `import type`, so it compiles under every TypeScript project
 * and adds nothing to any production bundle.
 */
import type {
  GenerationRequestV1,
  WorksheetDocumentV1,
} from "../../src/shared/worksheet/types.js";

/** The Dry Math operand and result ceiling Appendix B.1 states. */
export const ORACLE_DRY_MATH_CEILING = 100;

/** Appendix B.2: the largest factor, divisor and quotient, and the largest dividend. */
export const ORACLE_FACT_FACTOR_MAXIMUM = 12;
export const ORACLE_FACT_DIVIDEND_MAXIMUM = 144;

export type OracleOperation = "addition" | "subtraction";
export type OracleFactOperation = "multiplication" | "division";
export type OracleRegrouping = "without" | "required";

/** The Appendix B.5 codes the addition, subtraction and fact slices judge. */
export type OracleCode =
  | "WRONG_ANSWER"
  | "DUPLICATE_FACT"
  | "OUT_OF_SET"
  | "NEGATIVE"
  | "REMAINDER"
  | "ZERO_DIVISOR"
  | "OVER_CEILING"
  | "REGROUPING_MISMATCH"
  | "SYMBOL_MISMATCH"
  | "KEY_MISMATCH";

export interface OracleViolation {
  readonly itemId: string;
  readonly code: OracleCode;
}

/** The addition and subtraction focus a page was asked for. */
export interface OracleAddSubtractFocus {
  readonly kind?: "add-subtract";
  readonly operations: readonly string[];
  readonly operandMax: number;
  readonly resultMax: number;
  readonly regrouping: OracleRegrouping;
}

/** The fact operations and families a facts page was asked for. */
export interface OracleFactsFocus {
  readonly kind: "facts";
  readonly operations: readonly string[];
  readonly families: readonly number[];
}

export type OracleFocus = OracleAddSubtractFocus | OracleFactsFocus;

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

const SYMBOLS: Readonly<Record<OracleOperation | OracleFactOperation, string>> = {
  addition: "+",
  subtraction: "−",
  multiplication: "×",
  division: "÷",
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
export function oracleRegroups(operation: string, left: number, right: number): boolean {
  if (!isOracleOperation(operation)) {
    throw new Error(`Only addition and subtraction regroup, not ${operation}.`);
  }
  return operation === "addition"
    ? columnAdd(left, right).carried
    : columnSubtract(left, right).borrowed;
}

function isOracleOperation(value: string): value is OracleOperation {
  return value === "addition" || value === "subtraction";
}

function isOracleFactOperation(value: string): value is OracleFactOperation {
  return value === "multiplication" || value === "division";
}

/** A product as repeated column addition. */
export function oracleProduct(left: number, right: number): number {
  let product = 0;
  for (let step = 0; step < right; step += 1) {
    product = columnAdd(product, left).sum;
  }
  return product;
}

/**
 * Long division as repeated column subtraction: the quotient and remainder of
 * `dividend ÷ divisor`, or `undefined` for a zero divisor.
 */
export function oracleDivide(
  dividend: number,
  divisor: number,
): { readonly quotient: number; readonly remainder: number } | undefined {
  if (divisor === 0) {
    return undefined;
  }
  let quotient = 0;
  let remainder = dividend;
  while (remainder >= divisor) {
    remainder = columnSubtract(remainder, divisor).difference;
    quotient += 1;
  }
  return { quotient, remainder };
}

/**
 * Appendix B.2 by brute force: the `operation:left:right` key of every
 * multiplication of two factors to 12 with a factor in a family, and of every
 * exact division of a dividend to 144 by a divisor from 1 to 12 with a
 * quotient to 12 whose divisor or quotient is in a family.
 */
export function oracleFactKeys(
  operations: readonly string[],
  families: readonly number[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  const inFamilies = (value: number) => families.includes(value);
  if (operations.includes("multiplication")) {
    for (let left = 0; left <= ORACLE_FACT_FACTOR_MAXIMUM; left += 1) {
      for (let right = 0; right <= ORACLE_FACT_FACTOR_MAXIMUM; right += 1) {
        if (inFamilies(left) || inFamilies(right)) {
          keys.add(`multiplication:${left}:${right}`);
        }
      }
    }
  }
  if (operations.includes("division")) {
    for (let dividend = 0; dividend <= ORACLE_FACT_DIVIDEND_MAXIMUM; dividend += 1) {
      for (let divisor = 1; divisor <= ORACLE_FACT_FACTOR_MAXIMUM; divisor += 1) {
        const division = oracleDivide(dividend, divisor);
        if (
          division !== undefined &&
          division.remainder === 0 &&
          division.quotient <= ORACLE_FACT_FACTOR_MAXIMUM &&
          (inFamilies(divisor) || inFamilies(division.quotient))
        ) {
          keys.add(`division:${dividend}:${divisor}`);
        }
      }
    }
  }
  return keys;
}

/**
 * Appendix B.2's closed forms for a family set: multiplication
 * 169 − (13 − |F|)², division 156 − (12 − |F without 0|) × (13 − |F|), and
 * both operations their sum.
 */
export function oracleFactClosedForm(
  operations: readonly string[],
  families: readonly number[],
): number {
  const size = new Set(families).size;
  const nonzero = new Set(families.filter((family) => family !== 0)).size;
  return (
    (operations.includes("multiplication") ? 169 - (13 - size) ** 2 : 0) +
    (operations.includes("division") ? 156 - (12 - nonzero) * (13 - size) : 0)
  );
}

/** The `operation:left:right` key of every problem a focus allows, by brute force. */
export function oracleCandidateKeys(focus: OracleFocus): ReadonlySet<string> {
  if (focus.kind === "facts") {
    return oracleFactKeys(focus.operations, focus.families);
  }
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
  if (practice?.kind === "dry-math-facts") {
    return { kind: "facts", operations: [...practice.operations], families: [...practice.factFamilies] };
  }
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

/** The first violation of one multiplication or division fact, or `undefined` when it is clean. */
function judgeFactsFact(fact: OracleFact, focus: OracleFactsFocus): OracleCode | undefined {
  if (!isOracleFactOperation(fact.operation)) {
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
    (fact.answer !== undefined && fact.answer < 0)
  ) {
    return "NEGATIVE";
  }
  let value: number;
  if (fact.operation === "multiplication") {
    if (fact.left > ORACLE_FACT_FACTOR_MAXIMUM || fact.right > ORACLE_FACT_FACTOR_MAXIMUM) {
      return "OVER_CEILING";
    }
    value = oracleProduct(fact.left, fact.right);
  } else {
    const division = oracleDivide(fact.left, fact.right);
    if (division === undefined) {
      return "ZERO_DIVISOR";
    }
    if (
      fact.left > ORACLE_FACT_DIVIDEND_MAXIMUM ||
      fact.right > ORACLE_FACT_FACTOR_MAXIMUM ||
      division.quotient > ORACLE_FACT_FACTOR_MAXIMUM
    ) {
      return "OVER_CEILING";
    }
    if (division.remainder !== 0) {
      return "REMAINDER";
    }
    value = division.quotient;
  }
  if (fact.answer !== value) {
    return "WRONG_ANSWER";
  }
  const inFamilies =
    fact.operation === "multiplication"
      ? focus.families.includes(fact.left) || focus.families.includes(fact.right)
      : focus.families.includes(fact.right) || focus.families.includes(value);
  if (!focus.operations.includes(fact.operation) || !inFamilies) {
    return "OUT_OF_SET";
  }
  return undefined;
}

/** The first violation of one problem, or `undefined` when it is clean. */
function judgeFact(fact: OracleFact, focus: OracleFocus): OracleCode | undefined {
  if (focus.kind === "facts") {
    return judgeFactsFact(fact, focus);
  }
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

/** The operation each printed sign names. */
const OPERATIONS_BY_SYMBOL: Readonly<Record<string, OracleOperation | OracleFactOperation>> = {
  "+": "addition",
  "−": "subtraction",
  "×": "multiplication",
  "÷": "division",
};

/** The expression of a rendered Dry Math row, or `undefined` when it is not one. */
export function parseRenderedRow(
  text: string,
): {
  readonly operation: OracleOperation | OracleFactOperation;
  readonly left: number;
  readonly right: number;
  readonly symbol: string;
} | undefined {
  const match = /^\s*(\d+)\s*([+−×÷])\s*(\d+)\s*=\s*_+\s*$/u.exec(text);
  const symbol = match?.[2] ?? "";
  const operation = OPERATIONS_BY_SYMBOL[symbol];
  if (match === null || operation === undefined) {
    return undefined;
  }
  return {
    operation,
    left: Number(match[1]),
    right: Number(match[3]),
    symbol,
  };
}

/** The oracle's own solution of one parsed row, or `undefined` when it has none. */
function solveRow(row: NonNullable<ReturnType<typeof parseRenderedRow>>): number | undefined {
  switch (row.operation) {
    case "addition":
    case "subtraction":
      return row.operation === "subtraction" && row.left < row.right
        ? undefined
        : oracleValue(row.operation, row.left, row.right);
    case "multiplication":
      return oracleProduct(row.left, row.right);
    case "division": {
      const division = oracleDivide(row.left, row.right);
      return division === undefined || division.remainder !== 0 ? undefined : division.quotient;
    }
  }
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
    const solution = solveRow(parsed);
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
    facts.push({ id: row.id, operation: parsed.operation, left: parsed.left, right: parsed.right, symbol: parsed.symbol, answer: solution });
  }
  return [...violations, ...judgeFacts(facts, focus)];
}
