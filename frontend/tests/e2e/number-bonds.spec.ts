import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { acceptanceConfig } from "../fixtures/profiles.js";
import {
  columnAdd,
  judgeRenderedSentencesPage,
  oracleSolveMissing,
  parseRenderedSentence,
  type RenderedKeyLine,
  type RenderedRow,
} from "../oracles/arithmetic-oracle.js";
import { expect, test } from "./fixtures/app-server.js";
import {
  chooseLength,
  chooseNumberBondsRegrouping,
  choosePracticeFocus,
  choosePrintLayout,
  chooseWorksheet,
  controls,
  openMoreOptions,
} from "./fixtures/worksheet-controls.js";

/*
 * Number Bonds missing number sentences on the compiled app, judged only from
 * what the browser renders: each worksheet row is read with its drawn box as
 * `?` and solved by the independent oracle, and the key is read from its
 * rendered lines.
 */

/** The rendered rows, each blank read as `?`, and the rendered key lines. */
async function renderedPage(page: Page): Promise<{
  readonly rows: readonly RenderedRow[];
  readonly keyLines: readonly RenderedKeyLine[];
  readonly emptyBoxes: readonly number[];
}> {
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
  const read = await page.getByLabel("Worksheet preview").locator("[data-item-id]").evaluateAll((items) =>
    items.map((item) => {
      const boxes = [...item.querySelectorAll("[data-missing-box]")];
      const copy = item.cloneNode(true) as typeof item;
      for (const box of copy.querySelectorAll("[data-missing-box]")) {
        box.textContent = "?";
      }
      return {
        row: {
          id: item.getAttribute("data-item-id") ?? "",
          text: (copy.textContent ?? "").replace(/\s+/gu, " ").trim(),
        },
        emptyBoxes: boxes.filter((box) => box.textContent === "" && box.childNodes.length === 0).length,
      };
    }),
  );
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  const keyLines = await page.locator(".print-surface[data-surface='answer'] [data-item-id]").evaluateAll((items) =>
    items.map((item) => ({
      id: item.getAttribute("data-item-id") ?? "",
      source: item.querySelector("[data-source-expression]")?.getAttribute("data-source-expression") ?? "",
      answer: item.querySelector("[data-answer-value]")?.getAttribute("data-answer-value") ?? "",
      text: (item.textContent ?? "").replace(/\s+/gu, " ").trim(),
    })),
  );
  return { rows: read.map(({ row }) => row), keyLines, emptyBoxes: read.map(({ emptyBoxes }) => emptyBoxes) };
}

/** Pins every worksheet seed to one value, so a check sees a fixed page. */
async function pinSeed(page: Page, seed: number): Promise<void> {
  await page.addInitScript((value) => {
    const browserCrypto = globalThis.crypto as unknown as {
      getRandomValues: (array: ArrayBufferView) => ArrayBufferView;
    };
    const original = browserCrypto.getRandomValues.bind(browserCrypto);
    Object.defineProperty(Crypto.prototype, "getRandomValues", {
      configurable: true,
      value(array: ArrayBufferView | null): ArrayBufferView | null {
        if (array instanceof Uint32Array) {
          array[0] = value;
          return array;
        }
        return array === null ? null : original(array);
      },
    });
  }, seed);
}

/** Whether a rendered row's relation carries, read from the row and its oracle solution alone. */
function rowRegroups(row: RenderedRow): boolean {
  const parsed = parseRenderedSentence(row.text);
  const [solution] = parsed === undefined ? [] : oracleSolveMissing(parsed);
  if (parsed === undefined || solution === undefined || parsed.result === null) {
    throw new Error(`An unreadable row: ${row.text}`);
  }
  const left = parsed.left ?? solution;
  const right = parsed.right ?? solution;
  const [first, second] = parsed.symbol === "+" ? [left, right] : [right, parsed.result];
  return columnAdd(first, second).carried;
}

test("missing sentences within twenty match the key", async ({ appServer, page }) => {
  test.setTimeout(60_000);
  await appServer.seedConfig(acceptanceConfig);
  const seeded = await appServer.readRaw();
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "number-bonds");
  await expect(controls(page).regrouping().getByRole("radio", {
    name: "Without carrying or borrowing",
    exact: true,
  })).toBeChecked();
  await choosePracticeFocus(page, "Addition and subtraction within 20");
  await expect(page.locator("[data-selection-summary]")).toContainText(
    "Practice focus for Number Bonds: Missing number sentences, Addition and subtraction within 20.",
  );
  const focus = { operations: ["addition", "subtraction"], wholeMax: 20, regrouping: "without" } as const;
  for (const printScale of ["standard", "large"] as const) {
    await openMoreOptions(page);
    await chooseLength(page, "long");
    await choosePrintLayout(page, { printScale });
    await page.getByRole("button", { name: "Create worksheet", exact: true }).click();
    for (const attempt of ["created", "another"] as const) {
      if (attempt === "another") {
        await page.getByRole("button", { name: "Make another", exact: true }).click();
        await expect(page.getByText("A different worksheet is ready.")).toBeVisible();
      }
      const { rows, keyLines, emptyBoxes } = await renderedPage(page);
      const where = `${printScale} ${attempt}`;
      expect(rows, where).toHaveLength(printScale === "large" ? 12 : 18);
      // Every blank is one empty drawn box, and nothing prints in it.
      expect(emptyBoxes, where).toEqual(rows.map(() => 1));
      // The oracle solves every row itself; the key restates each row with
      // its blank as ? and that one answer.
      expect(judgeRenderedSentencesPage(rows, keyLines, focus), where).toEqual([]);
      // By default no problem needs carrying or borrowing.
      expect(rows.filter(rowRegroups).map(({ text }) => text), where).toEqual([]);
    }
  }
  // Creating and varying pages never writes the file.
  expect((await appServer.readRaw()).equals(seeded)).toBe(true);
});

test("including problems that carry or borrow within twenty adds them, and the page and key print one page each", async ({ appServer, page }) => {
  test.setTimeout(60_000);
  await appServer.seedConfig(acceptanceConfig);
  await pinSeed(page, 0x2026);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "number-bonds");
  await choosePracticeFocus(page, "Addition within 20");
  await chooseNumberBondsRegrouping(page, "included");
  await expect(page.locator("[data-selection-summary]")).toContainText(
    "Practice focus for Number Bonds: Missing number sentences, Addition within 20, including problems that carry or borrow.",
  );
  await chooseLength(page, "long");
  await page.getByRole("button", { name: "Create worksheet", exact: true }).click();
  const focus = { operations: ["addition"], wholeMax: 20, regrouping: "included" } as const;
  const { rows, keyLines } = await renderedPage(page);
  expect(rows).toHaveLength(18);
  expect(judgeRenderedSentencesPage(rows, keyLines, focus)).toEqual([]);
  // Mirror: the same rows judged without carrying or borrowing name exactly
  // the rows that carry, and the pinned seed draws at least one.
  const carrying = rows.filter(rowRegroups);
  expect(carrying.length).toBeGreaterThan(0);
  expect(judgeRenderedSentencesPage(rows, keyLines, { ...focus, regrouping: "without" }))
    .toEqual(carrying.map(({ id }) => ({ itemId: id, code: "REGROUPING_MISMATCH" })));

  for (const surface of ["worksheet", "answer"] as const) {
    await page.getByRole("button", { name: surface === "answer" ? "Parent answer key" : "Worksheet", exact: true }).click();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(`.print-surface[data-surface="${surface}"]`)).toBeVisible();
    const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
    expect(pdf.getPageCount(), surface).toBe(1);
    await page.emulateMedia({ media: "screen" });
  }
});
