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
  NUMBER_BONDS_FOCUS_CATALOG,
  PRACTICE_FOCUS_CATALOG,
  type PracticeFocusKind,
  type PracticeFocusValues,
} from "../../shared/config/practice-focus";
import {
  DEFAULT_FACT_FAMILIES,
  DEFAULT_OPERATION_GRID_PLACEMENT,
  type ChildProfileV2,
  type NumberBondsV2,
  type OperationGridV2,
  type WorksheetSelectionV2,
} from "../../shared/config/schema";
import { getWorksheetRegistration } from "../../shared/worksheet/registry";
import { WORKSHEET_TYPE_IDS, type WorksheetType } from "../../shared/worksheet/types";
import {
  MAX_ALTERNATIVE_SEED_ATTEMPTS,
  createInitialWorksheetSession,
  productionSeedSource,
  type SeedSource,
} from "../generator/create-session";
import type { QueuedSheet } from "./packet-session";

export const RANDOM_PACKET_LEVELS = ["easier", "medium", "harder"] as const;

export type RandomPacketLevel = (typeof RANDOM_PACKET_LEVELS)[number];

export const DEFAULT_RANDOM_PACKET_LEVEL: RandomPacketLevel = "medium";

/** Each level's label and what it practices, in words a parent can check against the table below. */
export const RANDOM_PACKET_LEVEL_LABELS = {
  easier: { label: "Easier", hint: "Numbers to 10, drawing and labeling" },
  medium: { label: "Medium", hint: "Numbers to 20, copying and sentence frames" },
  harder: { label: "Harder", hint: "Numbers to 100, plus times tables and longer words" },
} as const satisfies Record<RandomPacketLevel, { readonly label: string; readonly hint: string }>;

type FocusChoice = (selection: WorksheetSelectionV2) => WorksheetSelectionV2;

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

function dryMath(id: string): FocusChoice {
  const focus = catalogFocus("dry-math", id);
  return (selection) => ({
    ...selection,
    dryMathStrand: "add-subtract",
    dryMath: structuredClone(focus),
    dryMathRegrouping: "without",
  });
}

function multiplicationFacts(): FocusChoice {
  return (selection) => ({
    ...selection,
    dryMathStrand: "multiply-divide",
    dryMathFacts: { operations: ["multiplication"], factFamilies: [...DEFAULT_FACT_FAMILIES] },
  });
}

function wowQuantity(id: string): FocusChoice {
  const quantity = catalogFocus("find-the-wow-quantity", id);
  return (selection) => ({
    ...selection,
    findTheWow: { ...selection.findTheWow, variant: "quantity", quantity: structuredClone(quantity) },
  });
}

function wowEquation(id: string): FocusChoice {
  const equation = catalogFocus("find-the-wow-equation", id);
  return (selection) => ({
    ...selection,
    findTheWow: { ...selection.findTheWow, variant: "equation", equation: structuredClone(equation) },
  });
}

function sentence(
  variant: WorksheetSelectionV2["sentenceBuilder"]["variant"],
  vocabulary: WorksheetSelectionV2["sentenceBuilder"]["vocabulary"],
): FocusChoice {
  return (selection) => ({ ...selection, sentenceBuilder: { variant, vocabulary } });
}

function countCompare(id: string): FocusChoice {
  const focus = catalogFocus("count-compare-make", id);
  return (selection) => ({ ...selection, countCompareMake: structuredClone(focus) });
}

function bonds(id: string, regrouping: NumberBondsV2["regrouping"] = "without"): FocusChoice {
  const option = NUMBER_BONDS_FOCUS_CATALOG.find((candidate) => candidate.id === id);
  if (option === undefined) {
    throw new Error(`The Number Bonds focus catalog has no ${id}.`);
  }
  const { operations, wholeMax } = option.focus;
  return (selection) => ({
    ...selection,
    numberBonds: { operations: [...operations], wholeMax, regrouping },
  });
}

function grid(operation: OperationGridV2["operation"], size: number, prefilled: number): FocusChoice {
  return (selection) => ({
    ...selection,
    operationGrid: {
      operation,
      rows: size,
      columns: size,
      prefilled,
      placement: DEFAULT_OPERATION_GRID_PLACEMENT,
    },
  });
}

const UNCHANGED: FocusChoice = (selection) => selection;

/**
 * Every family's candidate focuses at each level; each sheet picks one at
 * random. Clock Explorer and Tally Detective have no practice choice, so
 * every level prints them the same way.
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
      multiplicationFacts(),
    ],
  },
  "find-the-wow": {
    easier: [wowQuantity("quantities-to-10"), wowEquation("addition-within-5")],
    medium: [wowQuantity("quantities-to-20"), wowEquation("addition-and-subtraction-within-10")],
    harder: [
      wowEquation("addition-and-subtraction-within-20"),
      wowEquation("addition-within-20"),
      wowEquation("subtraction-within-20"),
    ],
  },
  "sentence-builder": {
    easier: [sentence("draw-and-tell", "simpler-words"), sentence("label", "simpler-words")],
    medium: [sentence("copy-with-model", "simpler-words"), sentence("sentence-frame", "simpler-words")],
    harder: [sentence("sentence-frame", "all-words"), sentence("independent", "all-words")],
  },
  "count-compare-make": {
    easier: [countCompare("quantities-to-10")],
    medium: [countCompare("quantities-to-20")],
    harder: [countCompare("quantities-to-20")],
  },
  "number-bonds": {
    easier: [bonds("addition-within-5"), bonds("addition-within-10")],
    medium: [bonds("addition-and-subtraction-within-10"), bonds("addition-within-20")],
    harder: [
      bonds("addition-and-subtraction-within-20", "included"),
      bonds("subtraction-within-20", "included"),
    ],
  },
  "operation-grid": {
    easier: [grid("addition", 5, 5)],
    medium: [grid("addition", 10, 10)],
    harder: [grid("multiplication", 10, 10), grid("addition", 12, 12)],
  },
  "clock-explorer": { easier: [UNCHANGED], medium: [UNCHANGED], harder: [UNCHANGED] },
  "tally-detective": { easier: [UNCHANGED], medium: [UNCHANGED], harder: [UNCHANGED] },
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
