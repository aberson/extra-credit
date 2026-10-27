import type { Page } from "@playwright/test";

import { acceptanceConfig } from "../fixtures/profiles.js";
import {
  judgeGridTable,
  oracleGrid,
  type OracleGridFocus,
  type OracleGridTable,
} from "../oracles/arithmetic-oracle.js";
import { expect, test } from "./fixtures/app-server.js";
import { readGridTable } from "./fixtures/grid-table.js";
import {
  chooseOperationGrid,
  choosePrintLayout,
  chooseWorksheet,
  controls,
  openMoreOptions,
} from "./fixtures/worksheet-controls.js";

/*
 * Operation Grid on the compiled app, judged only from what the browser
 * renders: the table's corner, headers and cells are read from the page and
 * from the key, and the independent oracle recomputes every cell.
 */

/** The worksheet table and the key table of the current preview. */
async function renderedGrids(page: Page): Promise<{ readonly worksheet: OracleGridTable; readonly key: OracleGridTable }> {
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
  const worksheet = await readGridTable(page.getByLabel("Worksheet preview"));
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  const key = await readGridTable(page.locator(".print-surface[data-surface='answer']"));
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
  return { worksheet, key };
}

const OPERATIONS: readonly OracleGridFocus[] = [
  { operation: "addition", rows: 12, columns: 12, prefilled: 14, placement: "random" },
  { operation: "multiplication", rows: 10, columns: 10, prefilled: 10, placement: "diagonal-first" },
  { operation: "powers", rows: 10, columns: 3, prefilled: 3, placement: "random" },
];

for (const focus of OPERATIONS) {
  test(`${focus.operation} grid creates, previews and keys every cell correctly`, async ({ appServer, page }) => {
    test.setTimeout(60_000);
    await appServer.seedConfig(acceptanceConfig);
    const seeded = await appServer.readRaw();
    await page.goto(appServer.origin);
    await chooseWorksheet(page, "operation-grid");
    await chooseOperationGrid(page, focus);
    await openMoreOptions(page);
    await expect(controls(page).length()).toHaveCount(0);
    await expect(controls(page).graphics()).toHaveCount(0);
    await controls(page).create().click();
    const { worksheet, key } = await renderedGrids(page);
    expect(judgeGridTable(worksheet, focus, false)).toEqual([]);
    expect(judgeGridTable(key, focus, true)).toEqual([]);
    expect(key.cells.flat()).toEqual(oracleGrid(focus.operation, focus.rows, focus.columns).flat());
    expect(key.given).toEqual(worksheet.given);
    // The corner symbol is the operation's.
    expect(worksheet.corner).toBe({ addition: "+", multiplication: "×", powers: "^" }[focus.operation]);
    // Every blank is an empty box.
    const blanks = page.getByLabel("Worksheet preview").locator("[data-grid-blank]");
    await expect(blanks).toHaveCount(focus.rows * focus.columns - focus.prefilled);
    expect(new Set(await blanks.allTextContents())).toEqual(new Set([""]));
    // Make another keeps the cells and moves the given ones under random placement.
    if (focus.placement === "random") {
      await page.getByRole("button", { name: "Make another", exact: true }).click();
      await expect(page.getByText("A different worksheet is ready.")).toBeVisible();
      const next = await renderedGrids(page);
      expect(judgeGridTable(next.worksheet, focus, false)).toEqual([]);
      expect(next.worksheet.given).not.toEqual(worksheet.given);
    }
    // Creating and varying grids never writes the file.
    expect((await appServer.readRaw()).equals(seeded)).toBe(true);
  });
}

test("presets update the pre-filled input and the next preview, and Diagonal chooses Diagonal first", async ({ appServer, page }) => {
  test.setTimeout(60_000);
  await appServer.seedConfig(acceptanceConfig);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "operation-grid");
  const named = controls(page);
  await expect(named.gridRows()).toHaveValue("10");
  await expect(named.gridColumns()).toHaveValue("10");
  await expect(named.gridPrefilled()).toHaveValue("10");
  await expect(
    named.gridOperation().getByRole("radio", { name: "Multiplication x × y", exact: true }),
  ).toBeChecked();
  const given = page.getByLabel("Worksheet preview").locator("[data-grid-given]");
  for (const [preset, count] of [
    ["Half (50%)", 50],
    ["Mostly filled (75%)", 75],
    ["Nearly blank (10%)", 10],
  ] as const) {
    await named.gridPresets().getByRole("button", { name: preset, exact: true }).click();
    await expect(named.gridPrefilled()).toHaveValue(String(count));
    await expect(
      named.gridPlacement().getByRole("radio", { name: "Random", exact: true }),
    ).toBeChecked();
    // The earlier preview is taken down until Create runs again.
    await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
    await named.create().click();
    await expect(given).toHaveCount(count);
  }
  await named.gridRows().fill("12");
  await named.gridColumns().fill("12");
  await named.gridPresets().getByRole("button", { name: "Diagonal", exact: true }).click();
  await expect(named.gridPrefilled()).toHaveValue("12");
  await expect(
    named.gridPlacement().getByRole("radio", { name: "Diagonal first", exact: true }),
  ).toBeChecked();
  await named.create().click();
  const table = await readGridTable(page.getByLabel("Worksheet preview"));
  expect(judgeGridTable(table, {
    operation: "multiplication",
    rows: 12,
    columns: 12,
    prefilled: 12,
    placement: "diagonal-first",
  }, false)).toEqual([]);
  expect(table.given.every((row, index) => row.every((cell, column) => cell === (column === index)))).toBe(true);
  // A 12 x 12 grid is refused at large print with its one remedy, and fits at standard.
  await choosePrintLayout(page, { printScale: "large" });
  await expect(page.locator("[data-blocking-message]")).toHaveText(
    "Large print fits at most 10 rows. Choose 10 or fewer rows, or Standard print scale under More options. Large print fits at most 10 columns. Choose 10 or fewer columns, or Standard print scale under More options.",
  );
  await expect(named.create()).toBeDisabled();
  await choosePrintLayout(page, { printScale: "standard" });
  await expect(named.create()).toBeEnabled();
});

test("refusals name only the binding limit and keep Create disabled until it is fixed", async ({ appServer, page }) => {
  await appServer.seedConfig(acceptanceConfig);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "operation-grid");
  const named = controls(page);
  const blocking = page.locator("[data-blocking-message]");
  await named.gridOperation().getByRole("radio", { name: "Powers x^y", exact: true }).check();
  await expect(blocking).toHaveText(
    "Powers use exponents from 1 to 3, so a powers grid has at most 3 columns. Choose 3 or fewer columns.",
  );
  await expect(named.create()).toBeDisabled();
  await named.gridColumns().fill("3");
  await expect(blocking).toHaveCount(0);
  await named.gridRows().fill("11");
  await expect(blocking).toHaveText(
    "Powers use bases from 1 to 10, so a powers grid has at most 10 rows. Choose 10 or fewer rows.",
  );
  await named.gridRows().fill("2");
  await named.gridColumns().fill("2");
  await named.gridPrefilled().fill("4");
  await expect(blocking).toHaveText(
    "This grid has 4 cells and at least one must stay blank. Choose 3 or fewer pre-filled cells.",
  );
  await named.gridPrefilled().fill("3");
  await named.gridOperation().getByRole("radio", { name: "Addition x + y", exact: true }).check();
  await named.gridColumns().fill("3");
  await named.gridPlacement().getByRole("radio", { name: "Diagonal first", exact: true }).check();
  await expect(blocking).toHaveText(
    "Diagonal first needs a square grid. Choose the same number of rows and columns, or Random placement.",
  );
  await named.gridColumns().fill("2");
  await expect(blocking).toHaveCount(0);
  await expect(named.create()).toBeEnabled();
});
