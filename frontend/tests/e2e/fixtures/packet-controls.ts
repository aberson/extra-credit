import { expect, type Locator, type Page } from "@playwright/test";

import type { WorksheetSelectionV2 } from "../../../src/shared/config/schema.ts";
import type { PacketKeyPlacement } from "../../../src/shared/packet/compose.ts";
import type { PaperSize } from "../../../src/shared/worksheet/types.ts";
import { setPrintSeed } from "./print-checks.ts";
import { chooseChild, chooseWorksheetChoices, controls } from "./worksheet-controls.ts";

/**
 * The one Playwright helper for the printable packet (master plan Steps 31
 * and 33). Specs add, read, move and remove packet sheets, choose its paper
 * and key placement, and preview and print it through these functions, so a
 * change to where a packet control lives edits this file rather than every
 * spec.
 */

/** The "Printable packet" panel. */
export function packetPanel(page: Page): Locator {
  return page.getByRole("region", { name: "Printable packet", exact: true });
}

/** The "Add to packet" button beside Make another. */
export function addButton(page: Page): Locator {
  return page.getByRole("button", { name: "Add to packet", exact: true });
}

/** The Add outcome's polite live region. */
export function addMessage(page: Page): Locator {
  return page.locator("[data-packet-add-message]");
}

function rows(page: Page): Locator {
  return packetPanel(page).locator("[data-packet-row]");
}

/** Every row's visible label, in packet order. */
export async function packetRows(page: Page): Promise<readonly string[]> {
  return await rows(page).locator("[data-packet-label]").allInnerTexts();
}

/** Every row's queued worksheet id, in packet order. */
export async function packetWorksheetIds(page: Page): Promise<readonly string[]> {
  return await rows(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-worksheet-id") ?? ""),
  );
}

/**
 * Adds the visible preview and asserts it became the last row: the count
 * rises by one and the new row carries the preview's worksheet id.
 */
export async function addToPacket(page: Page): Promise<void> {
  const before = await rows(page).count();
  const previewId = await page
    .locator("section.print-workspace")
    .getAttribute("aria-labelledby");
  await addButton(page).click();
  await expect(rows(page)).toHaveCount(before + 1);
  await expect(rows(page).last()).toHaveAttribute(
    "data-worksheet-id",
    (previewId ?? "").replace(/^preview-/u, ""),
  );
  await expect(addMessage(page)).toHaveText(`Sheet ${before + 1} added to the packet.`);
}

/** Moves the sheet at 1-based `position` up or down one place. */
export async function moveSheet(
  page: Page,
  position: number,
  direction: "up" | "down",
): Promise<void> {
  const id = (await packetWorksheetIds(page))[position - 1];
  await packetPanel(page)
    .getByRole("button", { name: `Move ${direction} sheet ${position}`, exact: true })
    .click();
  const expectedPosition = direction === "up" ? position - 1 : position + 1;
  await expect(rows(page).nth(expectedPosition - 1)).toHaveAttribute("data-worksheet-id", id ?? "");
}

/** Removes the sheet at 1-based `position`. */
export async function removeSheet(page: Page, position: number): Promise<void> {
  const before = await rows(page).count();
  const id = (await packetWorksheetIds(page))[position - 1] ?? "";
  await packetPanel(page)
    .getByRole("button", { name: `Remove sheet ${position}`, exact: true })
    .click();
  await expect(rows(page)).toHaveCount(before - 1);
  await expect(packetPanel(page).locator(`[data-worksheet-id="${id}"]`)).toHaveCount(0);
}

/** One sheet `queueSheets` creates and adds. */
export interface PacketSheetPlan {
  readonly profileId: string;
  /** The worksheet choices made through the worksheet controls. */
  readonly selection: WorksheetSelectionV2;
  /** With the print seed stub installed, the seed the sheet is created with. */
  readonly seed?: number;
}

/**
 * Creates each planned sheet through the worksheet controls and adds it to
 * the packet, in order. A sheet with a seed is created with it and its
 * preview must show it. Length, print scale and the other More options
 * choices are the session's own, for example from seeded defaults.
 */
export async function queueSheets(page: Page, sheets: readonly PacketSheetPlan[]): Promise<void> {
  for (const sheet of sheets) {
    if (sheet.seed !== undefined) {
      await setPrintSeed(page, sheet.seed);
    }
    await chooseChild(page, sheet.profileId);
    await chooseWorksheetChoices(page, sheet.selection);
    await controls(page).create().click();
    await expect(page.getByRole("heading", { name: "Preview and print", exact: true })).toBeFocused();
    if (sheet.seed !== undefined) {
      await expect(page.locator(".print-surface [data-seed]")).toHaveAttribute(
        "data-seed",
        sheet.seed.toString(16).padStart(8, "0"),
      );
    }
    await addToPacket(page);
  }
}

/** The packet's Paper choice: one radio per paper size. */
export async function choosePacketPaper(page: Page, paperSize: PaperSize): Promise<void> {
  const radio = packetPanel(page)
    .getByRole("group", { name: "Paper", exact: true })
    .locator(`input[type="radio"][value="${paperSize}"]`);
  await radio.check();
  await expect(radio).toBeChecked();
}

/** The packet's "Answer keys" choice. */
export async function chooseKeyPlacement(page: Page, placement: PacketKeyPlacement): Promise<void> {
  const radio = packetPanel(page)
    .getByRole("group", { name: "Answer keys", exact: true })
    .locator(`input[type="radio"][value="${placement}"]`);
  await radio.check();
  await expect(radio).toBeChecked();
}

/** "Preview packet" in the panel. */
export function previewPacketButton(page: Page): Locator {
  return packetPanel(page).getByRole("button", { name: "Preview packet", exact: true });
}

/** Opens the packet preview; its heading takes focus. */
export async function openPacketPreview(page: Page): Promise<void> {
  await previewPacketButton(page).click();
  await expect(page.getByRole("heading", { name: "Packet preview", exact: true })).toBeFocused();
}

/** Every packet page's surface, in DOM order. */
export function packetSurfaces(page: Page): Locator {
  return page.locator(".print-surface[data-packet-page]");
}

/** "Print packet (N pages)" in the packet preview. */
export function printPacketButton(page: Page): Locator {
  return page.getByRole("button", { name: /^Print packet \(\d+ pages?\)$/u });
}

/** The "Random packet" form beside the packet panel. */
export function randomPacketForm(page: Page): Locator {
  return page.getByRole("region", { name: "Random packet", exact: true });
}

/** One Make random packet: exactly these families ticked, the pages and the difficulty. */
export interface RandomPacketPlan {
  readonly families: readonly string[];
  readonly pages: number;
  readonly level: "easier" | "medium" | "harder";
}

/**
 * Ticks exactly the planned families (by worksheet id), chooses the pages and
 * difficulty, and presses Make random packet; the packet preview opens.
 */
export async function makeRandomPacket(page: Page, plan: RandomPacketPlan): Promise<void> {
  const form = randomPacketForm(page);
  for (const box of await form.locator('input[type="checkbox"]').all()) {
    await box.setChecked(plan.families.includes((await box.getAttribute("value")) ?? ""));
  }
  await form.getByRole("combobox", { name: "Pages", exact: true }).selectOption(String(plan.pages));
  await form.locator(`input[type="radio"][value="${plan.level}"]`).check();
  await form.getByRole("button", { name: "Make random packet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Packet preview", exact: true })).toBeFocused();
}
