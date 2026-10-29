import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import { acceptanceConfig } from "../fixtures/profiles.js";
import { expect, test } from "./fixtures/app-server.js";
import {
  addButton,
  addMessage,
  addToPacket,
  moveSheet,
  packetPanel,
  packetRows,
  packetWorksheetIds,
  removeSheet,
} from "./fixtures/packet-controls.js";
import {
  chooseChild,
  chooseFactFamilies,
  chooseLength,
  chooseNumberBondsRegrouping,
  chooseOperationGrid,
  choosePracticeFocus,
  choosePrintLayout,
  chooseRegrouping,
  chooseTheme,
  chooseVariant,
  chooseVocabulary,
  chooseWorksheet,
  controls,
  setAnswerKey,
  setPersonalization,
} from "./fixtures/worksheet-controls.js";

/*
 * The printable packet through the compiled app, with the canonical fictional
 * profiles seeded through the appServer fixture. The packet lives only in App
 * session state (P9), so every packet action must leave the config file, its
 * write route and every browser store untouched.
 */

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

const [first, second, third] = acceptanceConfig.profiles;
if (first === undefined || second === undefined || third === undefined) {
  throw new Error("The canonical fictional profiles are missing.");
}

/** Counts every PUT /api/config the page sends. */
function trackConfigWrites(page: Page): () => number {
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/config") {
      writes += 1;
    }
  });
  return () => writes;
}

/** Runs one packet action and asserts it sent no config write. */
async function withoutConfigWrite(writes: () => number, action: () => Promise<void>): Promise<void> {
  const before = writes();
  await action();
  expect(writes()).toBe(before);
}

async function expectEmptyBrowserStores(page: Page): Promise<void> {
  expect(await page.evaluate(`(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: await indexedDB.databases(),
    caches: await caches.keys(),
    workers: (await navigator.serviceWorker.getRegistrations()).length,
    controlled: navigator.serviceWorker.controller !== null,
  }))()`)).toEqual({ local: 0, session: 0, databases: [], caches: [], workers: 0, controlled: false });
}

async function create(page: Page): Promise<void> {
  await controls(page).create().click();
  await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
}

async function expectCount(page: Page, count: number): Promise<void> {
  await expect(packetPanel(page).locator("[data-packet-count]")).toHaveText(`${count} of 10 sheets`);
}

test("packet: add three families for two children, reorder, remove, refuse a duplicate and stop at ten", async ({ appServer, page }) => {
  test.setTimeout(90_000);
  await appServer.seedConfig(acceptanceConfig);
  const seeded = await appServer.readRaw();
  const writes = trackConfigWrites(page);
  await page.goto(appServer.origin);
  await expectCount(page, 0);
  await expect(packetPanel(page)).toContainText("This packet is kept only until you close or reload this page.");
  // Add appears only beside a current preview.
  await expect(addButton(page)).toHaveCount(0);

  await chooseChild(page, first.id);
  await chooseWorksheet(page, "dry-math");
  await create(page);
  await withoutConfigWrite(writes, () => addToPacket(page));
  await chooseChild(page, second.id);
  await chooseWorksheet(page, "number-bonds");
  // A changed control takes the preview, and Add with it, down.
  await expect(addButton(page)).toHaveCount(0);
  await create(page);
  await withoutConfigWrite(writes, () => addToPacket(page));
  await chooseWorksheet(page, "clock-explorer");
  await create(page);
  await withoutConfigWrite(writes, () => addToPacket(page));

  const dryMath = "Dry Math · Addition and subtraction within 10 · for Riley · Standard";
  const numberBonds = "Number Bonds · Missing number sentences, Addition within 10 · for Morgan · Standard";
  const clocks = "Clock Explorer · for Morgan";
  expect(await packetRows(page)).toEqual([
    `Sheet 1 · ${dryMath}`,
    `Sheet 2 · ${numberBonds}`,
    `Sheet 3 · ${clocks}`,
  ]);
  await expectCount(page, 3);

  // A second Add of the same preview is refused and changes nothing.
  const queued = await packetWorksheetIds(page);
  await withoutConfigWrite(writes, () => addButton(page).click());
  await expect(addMessage(page)).toHaveText("This worksheet is already in the packet.");
  await expect(addMessage(page)).toHaveAttribute("aria-live", "polite");
  expect(await packetWorksheetIds(page)).toEqual(queued);
  await expectCount(page, 3);

  await withoutConfigWrite(writes, () => moveSheet(page, 3, "up"));
  expect(await packetRows(page)).toEqual([`Sheet 1 · ${dryMath}`, `Sheet 2 · ${clocks}`, `Sheet 3 · ${numberBonds}`]);
  await withoutConfigWrite(writes, () => moveSheet(page, 1, "down"));
  expect(await packetRows(page)).toEqual([`Sheet 1 · ${clocks}`, `Sheet 2 · ${dryMath}`, `Sheet 3 · ${numberBonds}`]);
  // Neither end moves past itself.
  await expect(packetPanel(page).getByRole("button", { name: "Move up sheet 1", exact: true })).toBeDisabled();
  await expect(packetPanel(page).getByRole("button", { name: "Move down sheet 3", exact: true })).toBeDisabled();
  await withoutConfigWrite(writes, () => removeSheet(page, 2));
  expect(await packetRows(page)).toEqual([`Sheet 1 · ${clocks}`, `Sheet 2 · ${numberBonds}`]);
  await expectCount(page, 2);

  // Eight more distinct pages reach the limit; Add is then disabled with its reason.
  await chooseWorksheet(page, "tally-detective");
  for (let count = 3; count <= 10; count += 1) {
    await create(page);
    await withoutConfigWrite(writes, () => addToPacket(page));
  }
  await expectCount(page, 10);
  expect(await packetRows(page)).toHaveLength(10);
  expect((await packetRows(page))[9]).toBe("Sheet 10 · Tally Detective · for Morgan");
  await create(page);
  const reason = "The packet holds at most 10 sheets. Remove a sheet to add another.";
  await expect(addButton(page)).toBeDisabled();
  await expect(page.locator("[data-packet-full-reason]")).toHaveText(reason);
  await expect(page.locator("[data-packet-full-reason]")).toBeVisible();
  await expect(addButton(page)).toHaveAccessibleDescription(reason);
  // Removing one sheet enables Add again.
  await withoutConfigWrite(writes, () => removeSheet(page, 10));
  await expect(addButton(page)).toBeEnabled();
  await expect(page.locator("[data-packet-full-reason]")).toHaveCount(0);

  expect(writes()).toBe(0);
  expect((await appServer.readRaw()).equals(seeded)).toBe(true);
  await expectEmptyBrowserStores(page);
});

test("packet: rows survive every worksheet control, a child switch and a profile edit; a reload empties it", async ({ appServer, page }) => {
  test.setTimeout(90_000);
  await appServer.seedConfig(acceptanceConfig);
  const writes = trackConfigWrites(page);
  await page.goto(appServer.origin);

  await chooseChild(page, first.id);
  await chooseWorksheet(page, "operation-grid");
  await create(page);
  await withoutConfigWrite(writes, () => addToPacket(page));
  await chooseChild(page, second.id);
  await chooseWorksheet(page, "sentence-builder");
  await chooseVariant(page, "draw-and-tell");
  await create(page);
  await withoutConfigWrite(writes, () => addToPacket(page));
  const rows = await packetRows(page);
  const ids = await packetWorksheetIds(page);
  const seeds = await packetPanel(page).locator("[data-packet-row]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-seed")),
  );
  expect(rows).toEqual([
    "Sheet 1 · Operation Grid · Multiplication x × y, 10 rows by 10 columns, 10 cells pre-filled, Random · for Riley",
    "Sheet 2 · Sentence Builder · Draw & Tell · for Morgan",
  ]);

  async function expectRowsUnchanged(): Promise<void> {
    expect(await packetRows(page)).toEqual(rows);
    expect(await packetWorksheetIds(page)).toEqual(ids);
    expect(
      await packetPanel(page).locator("[data-packet-row]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-seed")),
      ),
    ).toEqual(seeds);
  }

  // Every worksheet control, family by family, then More options.
  await chooseWorksheet(page, "dry-math");
  await choosePracticeFocus(page, "Addition within 20");
  await chooseRegrouping(page, "required");
  await choosePracticeFocus(page, "Multiplication facts");
  await chooseFactFamilies(page, [3, 4]);
  await chooseWorksheet(page, "find-the-wow");
  await chooseVariant(page, "equation");
  await choosePracticeFocus(page, "Addition within 20");
  await chooseWorksheet(page, "sentence-builder");
  await chooseVariant(page, "independent");
  await chooseVocabulary(page, "all-words");
  await chooseWorksheet(page, "count-compare-make");
  await choosePracticeFocus(page, "Quantities to 20");
  await chooseWorksheet(page, "number-bonds");
  await choosePracticeFocus(page, "Subtraction within 20");
  await chooseNumberBondsRegrouping(page, "included");
  await chooseWorksheet(page, "operation-grid");
  await chooseOperationGrid(page, { operation: "addition", rows: 5, columns: 4, prefilled: 2, placement: "random" });
  await chooseWorksheet(page, "tally-detective");
  await chooseWorksheet(page, "clock-explorer");
  await chooseWorksheet(page, "count-compare-make");
  await chooseLength(page, "long");
  await setAnswerKey(page, false);
  await setPersonalization(page, { nickname: false, graphics: true });
  await chooseTheme(page, "space");
  await choosePrintLayout(page, { paperSize: "a4", printScale: "large" });
  await chooseWorksheet(page, "sentence-builder");
  await setPersonalization(page, { interests: false });
  await expectRowsUnchanged();

  // Switching the child.
  await chooseChild(page, third.id);
  await expectRowsUnchanged();

  // Editing a profile: a real save, but not a packet action, and no row moves.
  await page.getByRole("button", { name: `Edit ${first.displayName ?? ""}`, exact: true }).click();
  await page.getByRole("textbox", { name: /Broad interests/u }).fill("vehicles");
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/config",
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect((await saved).status()).toBe(200);
  expect(writes()).toBe(1);
  await expect(packetPanel(page)).toBeVisible();
  await expectRowsUnchanged();
  await expectEmptyBrowserStores(page);

  // The packet is session-only: a reload shows it empty.
  await page.reload();
  await expectCount(page, 0);
  await expect(packetPanel(page).locator("[data-packet-row]")).toHaveCount(0);
  await expect(packetPanel(page)).toContainText("This packet is kept only until you close or reload this page.");
  await expectEmptyBrowserStores(page);
  expect(writes()).toBe(1);
});

/** Presses `key` until `target` holds focus, then asserts its focus ring is visible. */
async function tabTo(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab"): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await target.evaluate((element) => element === element.ownerDocument.activeElement)) {
      await expectVisibleFocus(target);
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error("Keyboard could not reach the named control.");
}

async function expectVisibleFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  const ring = await target.evaluate((element) => {
    const style = element.ownerDocument.defaultView!.getComputedStyle(element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThanOrEqual(2);
}

test("packet panel: axe, keyboard-only Add, Move up, Move down and Remove, and 320 px reflow", async ({ appServer, page }) => {
  test.setTimeout(90_000);
  await appServer.seedConfig(acceptanceConfig);
  const writes = trackConfigWrites(page);
  await page.goto(appServer.origin);
  await chooseChild(page, first.id);

  // Keyboard only from here: create, add, make another, add.
  await tabTo(page, controls(page).create());
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
  await tabTo(page, addButton(page), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(addMessage(page)).toHaveText("Sheet 1 added to the packet.");
  await tabTo(page, page.getByRole("button", { name: "Make another", exact: true }), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
  await tabTo(page, addButton(page), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(addMessage(page)).toHaveText("Sheet 2 added to the packet.");
  const ids = await packetWorksheetIds(page);
  expect(ids).toHaveLength(2);

  const panel = packetPanel(page);
  await tabTo(page, panel.getByRole("button", { name: "Move down sheet 1", exact: true }));
  await page.keyboard.press("Enter");
  expect(await packetWorksheetIds(page)).toEqual([ids[1], ids[0]]);
  // The moved sheet is last, so focus goes to its Move up.
  await expectVisibleFocus(panel.getByRole("button", { name: "Move up sheet 2", exact: true }));
  await page.keyboard.press("Enter");
  expect(await packetWorksheetIds(page)).toEqual(ids);
  await expectVisibleFocus(panel.getByRole("button", { name: "Move down sheet 1", exact: true }));
  await tabTo(page, panel.getByRole("button", { name: "Remove sheet 1", exact: true }));
  await page.keyboard.press("Enter");
  expect(await packetWorksheetIds(page)).toEqual([ids[1]]);
  await expectVisibleFocus(panel.getByRole("button", { name: "Remove sheet 1", exact: true }));
  expect(writes()).toBe(0);

  // The visible preview is the remaining sheet, so Add is refused; then axe
  // on the panel and the Add control.
  await addButton(page).click();
  await expect(addMessage(page)).toHaveText("This worksheet is already in the packet.");
  const axe = await new AxeBuilder({ page })
    .include("[data-packet-panel]")
    .include("[data-packet-add]")
    .withTags(tags)
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(axe.passes.length).toBeGreaterThan(0);
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  // The packet adds no status region.
  expect(await page.locator('[data-packet-panel] [role="status"], [data-packet-add] [role="status"]').count()).toBe(0);

  // Reflow with two rows, one of them Operation Grid's long label.
  await chooseWorksheet(page, "operation-grid");
  await create(page);
  await addToPacket(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(panel.locator("[data-packet-row]")).toHaveCount(2);
  const geometry = await page.evaluate(`(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    clipped: [...document.querySelectorAll("[data-packet-panel] *, [data-packet-add] *")]
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      })
      .map((element) => element.textContent?.trim().slice(0, 80)),
  }))()`) as { width: number; scroll: number; clipped: string[] };
  expect(geometry.width).toBe(320);
  expect(geometry.clipped).toEqual([]);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
  expect(writes()).toBe(0);
  await expectEmptyBrowserStores(page);
});
