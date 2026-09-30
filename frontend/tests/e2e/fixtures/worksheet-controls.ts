import { expect, type Locator, type Page } from "@playwright/test";

import type {
  PaperSize,
  PrintScale,
  WorksheetLength,
  WorksheetType,
} from "../../../src/shared/worksheet/types.ts";

/**
 * The one Playwright helper for worksheet choices and for the nickname,
 * interests, graphics and answer-key toggles (D26 in the worksheet-first
 * plan). Specs make those choices through the functions below and assert on
 * those controls through `controls(page)`, so a change to where a control
 * lives edits this file rather than every spec.
 *
 * Each choice function opens More options when its control lives there,
 * performs the choice, and asserts its visible result.
 */

export interface WorksheetControls {
  readonly worksheetType: () => Locator;
  readonly child: () => Locator;
  readonly length: () => Locator;
  readonly paperSize: () => Locator;
  readonly printScale: () => Locator;
  readonly nickname: () => Locator;
  readonly interests: () => Locator;
  readonly graphics: () => Locator;
  readonly answerKey: () => Locator;
}

export function controls(page: Page): WorksheetControls {
  return {
    worksheetType: () => page.getByRole("combobox", { name: "Worksheet type" }),
    child: () => page.getByRole("combobox", { name: "Child profile" }),
    length: () => page.getByRole("combobox", { name: "Length", exact: true }),
    paperSize: () => page.getByRole("combobox", { name: "Paper size" }),
    printScale: () => page.getByRole("combobox", { name: "Print scale" }),
    nickname: () => page.getByLabel("Put the nickname in the worksheet header"),
    interests: () => page.getByLabel("Use reviewed interests in worksheet content"),
    graphics: () => page.getByLabel("Include decorative graphics"),
    answerKey: () => page.getByLabel("Include a parent answer key"),
  };
}

function moreOptions(page: Page): { readonly details: Locator; readonly summary: Locator } {
  const summary = page.locator("summary").filter({ hasText: /^More options$/u });
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

export async function chooseWorksheet(page: Page, worksheetType: WorksheetType): Promise<void> {
  const select = controls(page).worksheetType();
  await select.selectOption(worksheetType);
  await expect(select).toHaveValue(worksheetType);
}

export async function chooseChild(page: Page, profileId: string): Promise<void> {
  const select = controls(page).child();
  await select.selectOption(profileId);
  await expect(select).toHaveValue(profileId);
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

/** The personalization checkboxes, each only when given. */
export async function setPersonalization(
  page: Page,
  choices: { readonly nickname?: boolean; readonly interests?: boolean; readonly graphics?: boolean },
): Promise<void> {
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

export async function setAnswerKey(page: Page, included: boolean): Promise<void> {
  await openMoreOptions(page);
  await setToggle(controls(page).answerKey(), included);
}
