import { expect, type Locator, type Page } from "@playwright/test";

import {
  SENTENCE_VOCABULARY_LABELS,
  describePracticeFocus,
  matchFactPracticeEntry,
} from "../../../src/shared/config/practice-focus.ts";
import type {
  FindTheWowVariant,
  RegroupingMode,
  SentenceVocabulary,
  ThemeChoice,
  WorksheetSelectionV2,
  WritingMode,
} from "../../../src/shared/config/schema.ts";
import type {
  PaperSize,
  PrintScale,
  WorksheetLength,
  WorksheetType,
} from "../../../src/shared/worksheet/types.ts";
import {
  DRY_MATH_REGROUPING_LABELS,
  FACT_FAMILIES_LEGEND,
  factFamilyLabel,
} from "../../../src/worksheets/dry-math/definition.ts";
import { FIND_THE_WOW_VARIANT_LABELS } from "../../../src/worksheets/find-the-wow/definition.ts";
import { SENTENCE_BUILDER_VARIANT_LABELS } from "../../../src/worksheets/sentence-builder/definition.ts";

/**
 * The one Playwright helper for worksheet choices, for the nickname,
 * interests, graphics and answer-key toggles, and for the decorative Theme
 * (D26 in the worksheet-first plan). Specs make those choices through the
 * functions below and assert on those controls through `controls(page)`, so
 * a change to where a control lives edits this file rather than every spec.
 *
 * Each choice function opens More options when its control lives there,
 * performs the choice, and asserts its visible result.
 */

export interface WorksheetControls {
  /** The "Worksheet type" radio-card group. */
  readonly worksheetType: () => Locator;
  /** One worksheet-type radio card's input. */
  readonly worksheetCard: (worksheetType: WorksheetType) => Locator;
  /** One worksheet-type card's visible title. */
  readonly worksheetCardLabel: (worksheetType: WorksheetType) => Locator;
  /** The "Writing activity" radio group (Sentence Builder). */
  readonly writingActivity: () => Locator;
  /** The "Statements" radio group (Two Whats and a Wow). */
  readonly statements: () => Locator;
  readonly child: () => Locator;
  readonly practiceFocus: () => Locator;
  /** The "Carrying and borrowing" radio group (Dry Math). */
  readonly regrouping: () => Locator;
  /** The "Fact families" checkbox group (Dry Math multiplication and division facts). */
  readonly factFamilies: () => Locator;
  /** The "Vocabulary" radio group (Sentence Builder). */
  readonly vocabulary: () => Locator;
  readonly moreOptions: () => Locator;
  readonly length: () => Locator;
  readonly paperSize: () => Locator;
  readonly printScale: () => Locator;
  readonly nickname: () => Locator;
  readonly interests: () => Locator;
  readonly graphics: () => Locator;
  /** The decorative "Theme" select (Sentence Builder and Count, Compare & Make, graphics on). */
  readonly theme: () => Locator;
  readonly answerKey: () => Locator;
  readonly create: () => Locator;
}

export function controls(page: Page): WorksheetControls {
  const worksheetType = () => page.getByRole("group", { name: "Worksheet type", exact: true });
  return {
    worksheetType,
    worksheetCard: (type) => worksheetType().locator(`input[type="radio"][value="${type}"]`),
    worksheetCardLabel: (type) =>
      worksheetType().locator(`[id="worksheet-type-${type}-title"]`),
    writingActivity: () => page.getByRole("group", { name: "Writing activity", exact: true }),
    statements: () => page.getByRole("group", { name: "Statements", exact: true }),
    child: () => page.getByRole("combobox", { name: "Child profile" }),
    practiceFocus: () => page.getByRole("combobox", { name: "Practice focus", exact: true }),
    regrouping: () => page.getByRole("group", { name: "Carrying and borrowing", exact: true }),
    factFamilies: () => page.getByRole("group", { name: FACT_FAMILIES_LEGEND, exact: true }),
    vocabulary: () => page.getByRole("group", { name: "Vocabulary", exact: true }),
    moreOptions: () => page.locator("summary").filter({ hasText: /^More options$/u }),
    length: () => page.getByRole("combobox", { name: "Length", exact: true }),
    paperSize: () => page.getByRole("combobox", { name: "Paper size" }),
    printScale: () => page.getByRole("combobox", { name: "Print scale" }),
    nickname: () => page.getByLabel("Put the nickname in the worksheet header"),
    interests: () => page.getByLabel("Use reviewed interests in worksheet content"),
    graphics: () => page.getByLabel("Include decorative graphics"),
    theme: () => page.getByRole("combobox", { name: "Theme", exact: true }),
    answerKey: () => page.getByLabel("Include a parent answer key"),
    create: () => page.getByRole("button", { name: "Create worksheet", exact: true }),
  };
}

function moreOptions(page: Page): { readonly details: Locator; readonly summary: Locator } {
  const summary = controls(page).moreOptions();
  return { details: page.locator("details").filter({ has: summary }), summary };
}

/** Opens More options if it is closed; an open panel stays open. */
export async function openMoreOptions(page: Page): Promise<void> {
  const { details, summary } = moreOptions(page);
  if ((await details.getAttribute("open")) === null) {
    await summary.click();
  }
  await expect(details).toHaveAttribute("open", "");
}

/** Checks one worksheet-type radio card. */
export async function chooseWorksheet(page: Page, worksheetType: WorksheetType): Promise<void> {
  const card = controls(page).worksheetCard(worksheetType);
  await card.check();
  await expect(card).toBeChecked();
}

export async function chooseChild(page: Page, profileId: string): Promise<void> {
  const select = controls(page).child();
  await select.selectOption(profileId);
  await expect(select).toHaveValue(profileId);
}

/**
 * Checks one variant: a Sentence Builder writing activity or a Two Whats and
 * a Wow statements kind, by its visible label.
 */
export async function chooseVariant(
  page: Page,
  variant: WritingMode | FindTheWowVariant,
): Promise<void> {
  const radio =
    variant === "quantity" || variant === "equation"
      ? controls(page).statements().getByRole("radio", {
          name: FIND_THE_WOW_VARIANT_LABELS[variant],
          exact: true,
        })
      : controls(page).writingActivity().getByRole("radio", {
          name: SENTENCE_BUILDER_VARIANT_LABELS[variant],
          exact: true,
        });
  await radio.check();
  await expect(radio).toBeChecked();
}

/** Chooses a practice focus by its visible label, for example "Addition within 20". */
export async function choosePracticeFocus(page: Page, label: string): Promise<void> {
  const select = controls(page).practiceFocus();
  await select.selectOption({ label });
  await expect(select.locator("option:checked")).toHaveText(label);
}

/** Chooses Dry Math's Carrying and borrowing option, for example "required". */
export async function chooseRegrouping(page: Page, regrouping: RegroupingMode): Promise<void> {
  const radio = controls(page).regrouping().getByRole("radio", {
    name: DRY_MATH_REGROUPING_LABELS[regrouping],
    exact: true,
  });
  await radio.check();
  await expect(radio).toBeChecked();
}

/**
 * Checks exactly the given fact families, for example [3, 12]. Every wanted
 * box is checked before any other is cleared, so the last checked box, which
 * the panel keeps, is never the one being cleared.
 */
export async function chooseFactFamilies(page: Page, families: readonly number[]): Promise<void> {
  const group = controls(page).factFamilies();
  const boxes = group.getByRole("checkbox");
  const count = await boxes.count();
  const box = (family: number) =>
    group.getByRole("checkbox", { name: factFamilyLabel(family), exact: true });
  for (const family of families) {
    await box(family).check();
  }
  for (let family = 0; family < count; family += 1) {
    if (!families.includes(family)) {
      await box(family).uncheck();
    }
  }
  for (let family = 0; family < count; family += 1) {
    await expect(box(family)).toBeChecked({ checked: families.includes(family) });
  }
}

export async function chooseVocabulary(page: Page, vocabulary: SentenceVocabulary): Promise<void> {
  const radio = controls(page).vocabulary().getByRole("radio", {
    name: SENTENCE_VOCABULARY_LABELS[vocabulary],
    exact: true,
  });
  await radio.check();
  await expect(radio).toBeChecked();
}

/**
 * The practice choices of a whole worksheet selection, in panel order: the
 * worksheet type, its variant where one exists, then the practice focus (by
 * its `describePracticeFocus` label, or a Dry Math fact entry's label) and,
 * for Dry Math, Carrying and borrowing or the fact families, or, for
 * Sentence Builder, the vocabulary.
 * The selection's other fields are left to the functions below.
 */
export async function chooseWorksheetChoices(
  page: Page,
  selection: WorksheetSelectionV2,
): Promise<void> {
  await chooseWorksheet(page, selection.worksheetType);
  switch (selection.worksheetType) {
    case "dry-math":
      if (selection.dryMathStrand === "multiply-divide") {
        await choosePracticeFocus(page, matchFactPracticeEntry(selection.dryMathFacts.operations).label);
        await chooseFactFamilies(page, selection.dryMathFacts.factFamilies);
        return;
      }
      await choosePracticeFocus(page, describePracticeFocus("dry-math", selection.dryMath));
      await chooseRegrouping(page, selection.dryMathRegrouping);
      return;
    case "find-the-wow": {
      const { variant, quantity, equation } = selection.findTheWow;
      await chooseVariant(page, variant);
      await choosePracticeFocus(
        page,
        variant === "equation"
          ? describePracticeFocus("find-the-wow-equation", equation)
          : describePracticeFocus("find-the-wow-quantity", quantity),
      );
      return;
    }
    case "sentence-builder":
      await chooseVariant(page, selection.sentenceBuilder.variant);
      await chooseVocabulary(page, selection.sentenceBuilder.vocabulary);
      return;
    case "count-compare-make":
      await choosePracticeFocus(
        page,
        describePracticeFocus("count-compare-make", selection.countCompareMake),
      );
      return;
  }
}

export async function chooseLength(page: Page, length: WorksheetLength): Promise<void> {
  await openMoreOptions(page);
  const select = controls(page).length();
  await select.selectOption(length);
  await expect(select).toHaveValue(length);
}

/** Paper first, then scale, for whichever of the two is given. */
export async function choosePrintLayout(
  page: Page,
  layout: { readonly paperSize?: PaperSize; readonly printScale?: PrintScale },
): Promise<void> {
  await openMoreOptions(page);
  if (layout.paperSize !== undefined) {
    const select = controls(page).paperSize();
    await select.selectOption(layout.paperSize);
    await expect(select).toHaveValue(layout.paperSize);
  }
  if (layout.printScale !== undefined) {
    const select = controls(page).printScale();
    await select.selectOption(layout.printScale);
    await expect(select).toHaveValue(layout.printScale);
  }
}

async function setToggle(control: Locator, checked: boolean): Promise<void> {
  await control.setChecked(checked);
  await expect(control).toBeChecked({ checked });
}

/** The personalization checkboxes under More options, each only when given. */
export async function setPersonalization(
  page: Page,
  choices: { readonly nickname?: boolean; readonly interests?: boolean; readonly graphics?: boolean },
): Promise<void> {
  await openMoreOptions(page);
  const named = controls(page);
  if (choices.nickname !== undefined) {
    await setToggle(named.nickname(), choices.nickname);
  }
  if (choices.interests !== undefined) {
    await setToggle(named.interests(), choices.interests);
  }
  if (choices.graphics !== undefined) {
    await setToggle(named.graphics(), choices.graphics);
  }
}

/** Chooses the decorative Theme under More options by its value, for example "neutral". */
export async function chooseTheme(page: Page, theme: ThemeChoice): Promise<void> {
  await openMoreOptions(page);
  const select = controls(page).theme();
  await select.selectOption(theme);
  await expect(select).toHaveValue(theme);
}

export async function setAnswerKey(page: Page, included: boolean): Promise<void> {
  await openMoreOptions(page);
  await setToggle(controls(page).answerKey(), included);
}
