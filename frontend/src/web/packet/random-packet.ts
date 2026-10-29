/**
 * A random printable packet: the parent ticks the families to include, picks
 * how many pages and a difficulty, and each page is one newly generated
 * worksheet for the selected child, queued exactly like an added preview.
 *
 * Difficulty only picks each sheet's practice focus from the shipped catalogs
 * (and Operation Grid's own choices); it never asserts a grade level. Every
 * other choice (nickname and interests, Theme, decoration, answer key,
 * length, paper and print scale) is the parent's current selection. Families
 * are dealt from a shuffled deck, so every ticked family appears once before
 * any family repeats. A family that cannot be made with the current choices
 * is left out and named, never widened.
 */
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import {
  NUMBER_BONDS_FOCUS_CATALOG,
  PRACTICE_FOCUS_CATALOG,
  type PracticeFocusKind,
  type PracticeFocusValues,
} from "../../shared/config/practice-focus";
import {
  DEFAULT_FACT_FAMILIES,
  DEFAULT_OPERATION_GRID_PREFILLED,
  type ChildProfileV2,
  type NumberBondsV2,
  type OperationGridV2,
  type WorksheetSelectionV2,
} from "../../shared/config/schema";
import { getWorksheetRegistration } from "../../shared/worksheet/registry";
import {
  FACT_FACTOR_MAXIMUM,
  OPERATION_GRID_POWERS_BASE_MAXIMUM,
  OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
  OPERATION_GRID_SIZE_MAXIMUM,
  V1_NUMERIC_MAXIMUM,
  WORKSHEET_TYPE_IDS,
  type WorksheetType,
} from "../../shared/worksheet/types";
import {
  MAX_ALTERNATIVE_SEED_ATTEMPTS,
  createInitialWorksheetSession,
  productionSeedSource,
  type SeedSource,
} from "../generator/create-session";
import type { QueuedSheet } from "./packet-session";

export const RANDOM_PACKET_LEVELS = ["easier", "medium", "harder", "challenge", "expert"] as const;

export type RandomPacketLevel = (typeof RANDOM_PACKET_LEVELS)[number];

export const DEFAULT_RANDOM_PACKET_LEVEL: RandomPacketLevel = "medium";

/** Each level's label and what it practices, in words a parent can check against the table below. */
function levelLabel(label: string, ceiling: number, rest: string) {
  return { label, ceiling, hint: `Numbers to ${ceiling.toLocaleString("en-US")}, ${rest}` } as const;
}

export const RANDOM_PACKET_LEVEL_LABELS = {
  easier: levelLabel("Easier", 10, "drawing and labeling"),
  medium: levelLabel("Medium", V1_NUMERIC_MAXIMUM, "copying and sentence frames"),
  harder: levelLabel("Harder", 100, "plus times tables and longer words"),
  challenge: levelLabel(
    "Challenge",
    144,
    "plus carrying and borrowing, times tables to 10 and independent writing",
  ),
  expert: levelLabel(
    "Expert",
    1_000,
    "plus powers, carrying and borrowing, times tables to 12 and independent writing",
  ),
} as const satisfies Record<
  RandomPacketLevel,
  { readonly label: string; readonly ceiling: number; readonly hint: string }
>;

type FocusChoice = (selection: WorksheetSelectionV2) => WorksheetSelectionV2;

/** The presentation choices a Random packet deliberately inherits from its parent selection. */
function keptChoices(selection: WorksheetSelectionV2) {
  const {
    theme,
    useDisplayName,
    useInterests,
    includeDecorativeGraphics,
    includeAnswerKey,
    length,
    paperSize,
    printScale,
  } = selection;
  return {
    theme,
    useDisplayName,
    useInterests,
    includeDecorativeGraphics,
    includeAnswerKey,
    length,
    paperSize,
    printScale,
  };
}

/** Every candidate starts from shipped defaults so no saved family choice can leak into a packet. */
function defaultsFirst(selection: WorksheetSelectionV2): WorksheetSelectionV2 {
  return { ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2), ...keptChoices(selection) };
}

function catalogFocus<TKind extends PracticeFocusKind>(
  kind: TKind,
  id: string,
): PracticeFocusValues[TKind] {
  const catalog: readonly { readonly id: string; readonly focus: PracticeFocusValues[TKind] }[] =
    PRACTICE_FOCUS_CATALOG[kind];
  const option = catalog.find((candidate) => candidate.id === id);
  if (option === undefined) {
    throw new Error(`The ${kind} practice focus catalog has no ${id}.`);
  }
  return structuredClone(option.focus);
}

function dryMath(id: string, regrouping: WorksheetSelectionV2["dryMathRegrouping"] = "without"): FocusChoice {
  const focus = catalogFocus("dry-math", id);
  return (selection) => ({
    ...defaultsFirst(selection),
    dryMathStrand: "add-subtract",
    dryMath: structuredClone(focus),
    dryMathRegrouping: regrouping,
  });
}

function facts(
  operations: readonly WorksheetSelectionV2["dryMathFacts"]["operations"][number][],
  families: readonly number[],
): FocusChoice {
  return (selection) => ({
    ...defaultsFirst(selection),
    dryMathStrand: "multiply-divide",
    dryMathFacts: { operations: [...operations], factFamilies: [...families] },
  });
}

function wowQuantity(id: string): FocusChoice {
  const quantity = catalogFocus("find-the-wow-quantity", id);
  return (selection) => ({
    ...defaultsFirst(selection),
    findTheWow: {
      ...DEFAULT_WORKSHEET_DEFAULTS_V2.findTheWow,
      variant: "quantity",
      quantity: structuredClone(quantity),
    },
  });
}

function wowEquation(id: string): FocusChoice {
  const equation = catalogFocus("find-the-wow-equation", id);
  return (selection) => ({
    ...defaultsFirst(selection),
    findTheWow: {
      ...DEFAULT_WORKSHEET_DEFAULTS_V2.findTheWow,
      variant: "equation",
      equation: structuredClone(equation),
    },
  });
}

function sentence(
  variant: WorksheetSelectionV2["sentenceBuilder"]["variant"],
  vocabulary: WorksheetSelectionV2["sentenceBuilder"]["vocabulary"],
): FocusChoice {
  return (selection) => ({ ...defaultsFirst(selection), sentenceBuilder: { variant, vocabulary } });
}

function countCompare(id: string): FocusChoice {
  const focus = catalogFocus("count-compare-make", id);
  return (selection) => ({ ...defaultsFirst(selection), countCompareMake: structuredClone(focus) });
}

function bonds(id: string, regrouping: NumberBondsV2["regrouping"] = "without"): FocusChoice {
  const option = NUMBER_BONDS_FOCUS_CATALOG.find((candidate) => candidate.id === id);
  if (option === undefined) {
    throw new Error(`The Number Bonds focus catalog has no ${id}.`);
  }
  const { operations, wholeMax } = option.focus;
  return (selection) => ({
    ...defaultsFirst(selection),
    numberBonds: { operations: [...operations], wholeMax, regrouping },
  });
}

function grid(fields: Pick<OperationGridV2, "operation" | "rows" | "columns" | "prefilled">): FocusChoice {
  return (selection) => ({
    ...defaultsFirst(selection),
    operationGrid: {
      ...DEFAULT_WORKSHEET_DEFAULTS_V2.operationGrid,
      ...fields,
    },
  });
}

const seedOnly: FocusChoice = (selection) => defaultsFirst(selection);

const HARDER_WOW = [
  wowEquation("addition-and-subtraction-within-20"),
  wowEquation("addition-within-20"),
  wowEquation("subtraction-within-20"),
] as const;
const HARDER_COUNT_COMPARE = [countCompare("quantities-to-20")] as const;
const HARDER_BONDS = [
  bonds("addition-and-subtraction-within-20", "included"),
  bonds("subtraction-within-20", "included"),
] as const;
const CHALLENGE_SENTENCE = [sentence("independent", "all-words")] as const;

/**
 * Every family's candidate focuses at each level; each sheet picks one at
 * random. Every candidate starts from the shipped defaults and then keeps
 * only the parent's presentation choices. Clock Explorer and Tally Detective
 * are therefore seed-only at every level. Challenge's ceiling comes from its
 * 12 x 12 grid; its large-print sibling reaches only 100.
 */
export const RANDOM_PACKET_FOCUS: {
  readonly [TType in WorksheetType]: { readonly [TLevel in RandomPacketLevel]: readonly FocusChoice[] };
} = {
  "dry-math": {
    easier: [dryMath("addition-within-5"), dryMath("addition-and-subtraction-within-10")],
    medium: [
      dryMath("addition-and-subtraction-within-20"),
      dryMath("addition-within-20"),
      dryMath("subtraction-within-20"),
    ],
    harder: [
      dryMath("addition-and-subtraction-within-50"),
      dryMath("addition-and-subtraction-within-100"),
      facts(["multiplication"], DEFAULT_FACT_FAMILIES),
    ],
    challenge: [
      dryMath("addition-and-subtraction-within-100", "required"),
      facts(["multiplication", "division"], [2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ],
    expert: [
      dryMath("addition-and-subtraction-within-100", "required"),
      facts(
        ["multiplication", "division"],
        Array.from({ length: FACT_FACTOR_MAXIMUM + 1 }, (_, family) => family),
      ),
    ],
  },
  "find-the-wow": {
    easier: [wowQuantity("quantities-to-10"), wowEquation("addition-within-5")],
    medium: [wowQuantity("quantities-to-20"), wowEquation("addition-and-subtraction-within-10")],
    harder: HARDER_WOW,
    challenge: HARDER_WOW,
    expert: HARDER_WOW,
  },
  "sentence-builder": {
    easier: [sentence("draw-and-tell", "simpler-words"), sentence("label", "simpler-words")],
    medium: [sentence("copy-with-model", "simpler-words"), sentence("sentence-frame", "simpler-words")],
    harder: [sentence("sentence-frame", "all-words"), sentence("independent", "all-words")],
    challenge: CHALLENGE_SENTENCE,
    expert: CHALLENGE_SENTENCE,
  },
  "count-compare-make": {
    easier: [countCompare("quantities-to-10")],
    medium: [countCompare("quantities-to-20")],
    harder: HARDER_COUNT_COMPARE,
    challenge: HARDER_COUNT_COMPARE,
    expert: HARDER_COUNT_COMPARE,
  },
  "number-bonds": {
    easier: [bonds("addition-within-5"), bonds("addition-within-10")],
    medium: [bonds("addition-and-subtraction-within-10"), bonds("addition-within-20")],
    harder: HARDER_BONDS,
    challenge: HARDER_BONDS,
    expert: HARDER_BONDS,
  },
  "operation-grid": {
    easier: [grid({ operation: "addition", rows: 5, columns: 5, prefilled: 5 })],
    medium: [grid({ operation: "addition", rows: 10, columns: 10, prefilled: 10 })],
    harder: [
      grid({ operation: "multiplication", rows: 10, columns: 10, prefilled: 10 }),
      grid({ operation: "addition", rows: OPERATION_GRID_SIZE_MAXIMUM, columns: OPERATION_GRID_SIZE_MAXIMUM, prefilled: 10 }),
    ],
    challenge: [
      grid({
        operation: "multiplication",
        rows: OPERATION_GRID_SIZE_MAXIMUM,
        columns: OPERATION_GRID_SIZE_MAXIMUM,
        prefilled: 14,
      }),
      grid({ operation: "multiplication", rows: 10, columns: 10, prefilled: 0 }),
    ],
    expert: [
      grid({
        operation: "powers",
        rows: OPERATION_GRID_POWERS_BASE_MAXIMUM,
        columns: OPERATION_GRID_POWERS_EXPONENT_MAXIMUM,
        prefilled: DEFAULT_OPERATION_GRID_PREFILLED,
      }),
      grid({ operation: "multiplication", rows: 10, columns: 10, prefilled: 0 }),
    ],
  },
  "clock-explorer": {
    easier: [seedOnly],
    medium: [seedOnly],
    harder: [seedOnly],
    challenge: [seedOnly],
    expert: [seedOnly],
  },
  "tally-detective": {
    easier: [seedOnly],
    medium: [seedOnly],
    harder: [seedOnly],
    challenge: [seedOnly],
    expert: [seedOnly],
  },
};

export interface RandomPacketChoice {
  /** The ticked families; their order does not matter. */
  readonly families: readonly WorksheetType[];
  /** How many worksheets, one printed page each. */
  readonly pages: number;
  readonly level: RandomPacketLevel;
}

export interface RandomPacketRequest extends RandomPacketChoice {
  readonly profile: ChildProfileV2;
  /** The parent's current selection, which supplies every choice difficulty does not. */
  readonly selection: WorksheetSelectionV2;
}

export type RandomPacketResult =
  | {
      readonly ok: true;
      readonly sheets: readonly QueuedSheet[];
      /** The pages asked for; more than `sheets.length` once no different page was left. */
      readonly requested: number;
      /** Ticked families that could not be made with the current choices, in registry order. */
      readonly leftOut: readonly WorksheetType[];
    }
  | { readonly ok: false; readonly message: string };

/** How one sheet is created; tests replace it to make a family fail. */
export type CreateSheetSession = typeof createInitialWorksheetSession;

/** A Fisher-Yates shuffle driven by the seed source. */
function shuffled<TValue>(values: readonly TValue[], random: SeedSource): TValue[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = (random() >>> 0) % (index + 1);
    const value = result[index] as TValue;
    result[index] = result[other] as TValue;
    result[other] = value;
  }
  return result;
}

/** "Dry Math", "Dry Math and Number Bonds" or "Dry Math, Number Bonds and Operation Grid". */
export function familyNames(families: readonly WorksheetType[]): string {
  const names = families.map((family) => getWorksheetRegistration(family).displayName);
  const last = names[names.length - 1] ?? "";
  return names.length <= 1 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * Generates the random packet's sheets, or says why none could be made. The
 * seed source drives the deck, each sheet's focus and each seed, so a fixed
 * source makes the same packet. A sheet whose content repeats an earlier
 * sheet's is generated again with a new seed; a family with no different
 * page left stops being dealt.
 */
export function makeRandomPacket(
  request: RandomPacketRequest,
  random: SeedSource = productionSeedSource,
  create: CreateSheetSession = createInitialWorksheetSession,
): RandomPacketResult {
  if (!Number.isInteger(request.pages) || request.pages < 1) {
    return { ok: false, message: "Choose at least one page." };
  }
  let usable: WorksheetType[] = WORKSHEET_TYPE_IDS.filter((family) => request.families.includes(family));
  if (usable.length === 0) {
    return { ok: false, message: "Tick at least one worksheet to include." };
  }
  const leftOut: WorksheetType[] = [];
  const seen = new Set<string>();
  const sheets: QueuedSheet[] = [];
  let deck: WorksheetType[] = [];

  function sheetFor(family: WorksheetType): QueuedSheet | undefined {
    for (const choose of shuffled(RANDOM_PACKET_FOCUS[family][request.level], random)) {
      const selection: WorksheetSelectionV2 = { ...choose(request.selection), worksheetType: family };
      for (let attempt = 0; attempt < MAX_ALTERNATIVE_SEED_ATTEMPTS; attempt += 1) {
        const created = create({ profile: request.profile, selection }, random);
        if (!created.ok) {
          break;
        }
        const key = `${family}:${created.session.contentKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          return { document: created.session.document, profileId: request.profile.id, selection };
        }
      }
    }
    return undefined;
  }

  while (sheets.length < request.pages && usable.length > 0) {
    if (deck.length === 0) {
      deck = shuffled(usable, random);
    }
    const family = deck.shift() as WorksheetType;
    const sheet = sheetFor(family);
    if (sheet === undefined) {
      usable = usable.filter((candidate) => candidate !== family);
      deck = deck.filter((candidate) => candidate !== family);
      if (!sheets.some(({ selection }) => selection.worksheetType === family)) {
        leftOut.push(family);
      }
    } else {
      sheets.push(sheet);
    }
  }
  if (sheets.length === 0) {
    return {
      ok: false,
      message: `${familyNames(leftOut)} cannot be made with the current choices. Try a shorter length, standard print size or other worksheets.`,
    };
  }
  return {
    ok: true,
    sheets,
    requested: request.pages,
    leftOut: WORKSHEET_TYPE_IDS.filter((family) => leftOut.includes(family)),
  };
}

/** What the parent is told once the sheets are queued. */
export function randomPacketMessage(result: Extract<RandomPacketResult, { ok: true }>): string {
  const count = result.sheets.length;
  const parts = [`Added ${count} random ${count === 1 ? "sheet" : "sheets"} to the packet.`];
  if (count < result.requested) {
    parts.push(`Only ${count} different ${count === 1 ? "worksheet" : "worksheets"} could be made with these choices.`);
  }
  if (result.leftOut.length > 0) {
    parts.push(
      `${familyNames(result.leftOut)} could not be made with the current choices and ${
        result.leftOut.length === 1 ? "was" : "were"
      } left out.`,
    );
  }
  return parts.join(" ");
}
