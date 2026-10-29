import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The one Playwright helper for the printable packet (master plan Step 31).
 * Specs add, read, move and remove packet sheets through these functions, so a
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
