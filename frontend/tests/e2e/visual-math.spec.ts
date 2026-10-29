import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { worksheetSelectionOf } from "../../src/shared/config/defaults.js";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.js";
import { generateClockExplorer } from "../../src/worksheets/clock-explorer/generator.js";
import { generateTallyDetective } from "../../src/worksheets/tally-detective/generator.js";
import { acceptanceConfig } from "../fixtures/profiles.js";
import {
  judgeClockDocument,
  oracleClockKeyLine,
  oracleHourFromHands,
  type OracleHandVector,
} from "../oracles/clock-oracle.js";
import {
  judgeTallyDocument,
  oracleReadTally,
  oracleTallyGrouping,
  oracleTallyKeyLine,
  type OracleTallyReading,
} from "../oracles/tally-oracle.js";
import { expect, test } from "./fixtures/app-server.js";
import {
  chooseChild,
  chooseLength,
  choosePrintLayout,
  chooseWorksheet,
  controls,
  openMoreOptions,
} from "./fixtures/worksheet-controls.js";

/*
 * Clock Explorer and Tally Detective on the compiled app (visual math
 * specification, Phase V). Clock Explorer is
 * judged from what the browser paints: each dial's hands are read from the
 * rendered SVG's screen geometry and turned back into a time by the
 * independent oracle, and the key is read from its rendered lines.
 */

/** The screen transform an SVG element reports, read without the DOM library's types. */
interface ScreenMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
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

/** Each rendered clock's time as the oracle reads it from the painted hands, in page order. */
async function renderedHours(page: Page): Promise<readonly (number | undefined)[]> {
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
  const hands = await page.getByLabel("Worksheet preview").locator("[data-item-id]").evaluateAll((cards) =>
    cards.map((card) => {
      const vector = (which: string): OracleHandVector | null => {
        const line = card.querySelector(`[data-clock-hand="${which}"]`);
        const matrix = line === null
          ? null
          : (line as unknown as { getScreenCTM(): ScreenMatrix | null }).getScreenCTM();
        if (line === null || matrix === null) {
          return null;
        }
        const point = (x: string, y: string) => {
          const [px, py] = [Number(line.getAttribute(x)), Number(line.getAttribute(y))];
          return { x: matrix.a * px + matrix.c * py + matrix.e, y: matrix.b * px + matrix.d * py + matrix.f };
        };
        const start = point("x1", "y1");
        const end = point("x2", "y2");
        return { dx: end.x - start.x, dy: end.y - start.y };
      };
      return { minute: vector("minute"), hour: vector("hour") };
    }),
  );
  return hands.map(({ minute, hour }) =>
    minute === null || hour === null ? undefined : oracleHourFromHands(minute, hour));
}

/** The rendered key lines' text, in order. */
async function renderedKey(page: Page): Promise<readonly string[]> {
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  const lines = await page.locator(".print-surface[data-surface='answer'] [data-item-id]").allTextContents();
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
  return lines.map((line) => line.replace(/\s+/gu, " ").trim());
}

/** The page the source projection and generator produce for this seed, as the compiled app should. */
function expectedHours(seed: string, profile = acceptanceConfig.profiles[0]): readonly number[] {
  const projected = projectGenerationRequest({
    ...(profile === undefined ? {} : { profile }),
    selection: { ...worksheetSelectionOf(acceptanceConfig.defaults), worksheetType: "clock-explorer" },
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) throw new Error(projected.message);
  const generated = generateClockExplorer(projected.request, { worksheetId: "11111111-1111-4111-8111-111111111111" });
  if (!generated.ok) throw new Error(generated.message);
  expect(judgeClockDocument(generated.document)).toEqual([]);
  return generated.document.items.map(({ hour }) => hour);
}

test("Clock Explorer creates four clocks whose painted hands, key and Make another all agree", async ({ appServer, page, context }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const requests: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await appServer.seedConfig(acceptanceConfig);
  const seeded = await appServer.readRaw();
  const [child] = acceptanceConfig.profiles;
  if (child === undefined) throw new Error("Canonical fixture missing.");

  await page.goto(appServer.origin);
  await chooseChild(page, child.id);
  await chooseWorksheet(page, "clock-explorer");
  await openMoreOptions(page);
  // Only the nickname, the key, the paper and the scale apply.
  for (const hidden of [controls(page).length(), controls(page).graphics(), controls(page).theme(), controls(page).practiceFocus()]) {
    await expect(hidden).toHaveCount(0);
  }
  await controls(page).create().click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "clock-explorer");
  await expect(page.getByText("ready with 4 unique clocks", { exact: false })).toBeVisible();
  const seed = await preview.getAttribute("data-seed");
  expect(seed).toMatch(/^(?!00000000)[\da-f]{8}$/u);
  const hours = expectedHours(seed ?? "");

  // The painted hands read back, clock by clock, as the generator's hours.
  expect(await renderedHours(page)).toEqual(hours);
  expect(await renderedKey(page)).toEqual(hours.map((hour, index) => `${index + 1}. ${oracleClockKeyLine(hour)}`));
  // The child's page holds every label, empty lines and no written time.
  await expect(preview.locator("[data-clock-label]")).toHaveCount(48);
  expect(new Set(await preview.locator("[data-time-blank]").allTextContents())).toEqual(new Set([""]));
  const childText = await preview.innerText();
  for (const hour of hours) expect(childText).not.toContain(`${hour}:00`);

  await page.getByRole("button", { name: "Make another", exact: true }).click();
  await expect(page.getByText("A different worksheet is ready.")).toBeVisible();
  const nextSeed = await preview.getAttribute("data-seed");
  expect(nextSeed).not.toBe(seed);
  const nextHours = expectedHours(nextSeed ?? "");
  expect(await renderedHours(page)).toEqual(nextHours);
  expect(nextHours).not.toEqual(hours);

  // Creating and varying pages never writes the file, and nothing left the origin.
  expect((await appServer.readRaw()).equals(seeded)).toBe(true);
  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const url of requests) expect(new URL(url).origin).toBe(appServer.origin);
});

test("Clock Explorer's child page and key each print one page on Letter and A4 at both scales", async ({ appServer, page }) => {
  test.setTimeout(90_000);
  await appServer.seedConfig(acceptanceConfig);
  await pinSeed(page, 0x2026_0035);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "clock-explorer");
  const hours = expectedHours("20260035");
  for (const paperSize of ["letter", "a4"] as const) {
    for (const printScale of ["standard", "large"] as const) {
      await page.emulateMedia({ media: "screen" });
      await choosePrintLayout(page, { paperSize, printScale });
      await controls(page).create().click();
      expect(await renderedHours(page), `${paperSize} ${printScale}`).toEqual(hours);
      for (const surface of ["worksheet", "answer"] as const) {
        await page.getByRole("button", { name: surface === "answer" ? "Parent answer key" : "Worksheet", exact: true }).click();
        await page.emulateMedia({ media: "print" });
        await expect(page.locator(`.print-surface[data-surface="${surface}"]`)).toBeVisible();
        const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
        expect(pdf.getPageCount(), `${paperSize} ${printScale} ${surface}`).toBe(1);
        await page.emulateMedia({ media: "screen" });
      }
    }
  }
});

test("stored choices of other families never change the clocks, survive switching back, and an explicit save keeps Clock Explorer without touching profiles", async ({ appServer, page }) => {
  test.setTimeout(60_000);
  await appServer.seedConfig({
    ...acceptanceConfig,
    defaults: {
      ...acceptanceConfig.defaults,
      length: "long",
      includeDecorativeGraphics: true,
      theme: "space",
      dryMathRegrouping: "required",
    },
  });
  await pinSeed(page, 0x2026_0035);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "clock-explorer");
  await controls(page).create().click();
  // The same clocks as the plain defaults draw for this seed, and the
  // decorative panel never appears: the dials are the whole diagram.
  expect(await renderedHours(page)).toEqual(expectedHours("20260035"));
  await expect(page.locator(".print-surface [data-decorative-panel]")).toHaveCount(0);
  await expect(page.locator(".print-surface [data-clock-dial]")).toHaveCount(4);

  // Switching back restores the hidden stored choices.
  await chooseWorksheet(page, "dry-math");
  await openMoreOptions(page);
  await expect(controls(page).length()).toHaveValue("long");
  await chooseLength(page, "long");
  await chooseWorksheet(page, "clock-explorer");
  await expect(controls(page).length()).toHaveCount(0);

  // An explicit save writes the family and nothing else changes.
  const before = await appServer.readConfig();
  await page.getByRole("button", { name: "Save these as worksheet defaults" }).click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();
  const after = await appServer.readConfig();
  expect(after.defaults).toEqual({ ...before.defaults, worksheetType: "clock-explorer" });
  expect(after.profiles).toEqual(before.profiles);
  await page.reload();
  await expect(controls(page).worksheetCard("clock-explorer")).toBeChecked();
  await controls(page).create().click();
  expect(await renderedHours(page)).toEqual(expectedHours("20260035"));
});

/*
 * Tally Detective on the compiled app: each tally's marks are read from the
 * rendered SVG's screen geometry and counted back into a total by the
 * independent oracle, and the key is read from its rendered lines.
 */

/** Each rendered tally as the oracle reads it from the painted marks, in page order. */
async function renderedTallies(page: Page): Promise<readonly OracleTallyReading[]> {
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
  return await paintedTallies(page);
}

/** The worksheet surface's tallies as the oracle reads them, under the current media. */
async function paintedTallies(page: Page): Promise<readonly OracleTallyReading[]> {
  const cards = await page.locator('.print-surface[data-surface="worksheet"]').locator("[data-item-id]").evaluateAll((elements) =>
    elements.map((card) =>
      [...card.querySelectorAll("[data-tally-marks] svg line")].flatMap((line) => {
        const matrix = (line as unknown as { getScreenCTM(): ScreenMatrix | null }).getScreenCTM();
        if (matrix === null) {
          return [];
        }
        const point = (x: string, y: string) => {
          const [px, py] = [Number(line.getAttribute(x)), Number(line.getAttribute(y))];
          return { x: matrix.a * px + matrix.c * py + matrix.e, y: matrix.b * px + matrix.d * py + matrix.f };
        };
        const start = point("x1", "y1");
        const end = point("x2", "y2");
        return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
      })),
  );
  return cards.map((segments) => oracleReadTally(segments));
}

/** The page the source projection and generator produce for this seed, as the compiled app should. */
function expectedTotals(seed: string, profile = acceptanceConfig.profiles[0]): readonly number[] {
  const projected = projectGenerationRequest({
    ...(profile === undefined ? {} : { profile }),
    selection: { ...worksheetSelectionOf(acceptanceConfig.defaults), worksheetType: "tally-detective" },
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) throw new Error(projected.message);
  const generated = generateTallyDetective(projected.request, { worksheetId: "11111111-1111-4111-8111-111111111111" });
  if (!generated.ok) throw new Error(generated.message);
  expect(judgeTallyDocument(generated.document)).toEqual([]);
  return generated.document.items.map(({ answer }) => answer.value);
}

/** The oracle's reading of a well-formed tally of this total. */
function readingOf(total: number): OracleTallyReading {
  const { bundles, loose } = oracleTallyGrouping(total);
  return { ok: true, total, bundles, loose };
}

test("Tally Detective creates four tallies whose painted marks, key and Make another all agree", async ({ appServer, page, context }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const requests: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await appServer.seedConfig(acceptanceConfig);
  const seeded = await appServer.readRaw();
  const [child] = acceptanceConfig.profiles;
  if (child === undefined) throw new Error("Canonical fixture missing.");

  await page.goto(appServer.origin);
  await chooseChild(page, child.id);
  await chooseWorksheet(page, "tally-detective");
  await openMoreOptions(page);
  // Only the nickname, the key, the paper and the scale apply.
  for (const hidden of [controls(page).length(), controls(page).graphics(), controls(page).theme(), controls(page).practiceFocus()]) {
    await expect(hidden).toHaveCount(0);
  }
  await controls(page).create().click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "tally-detective");
  await expect(page.getByText("ready with 4 unique tallies", { exact: false })).toBeVisible();
  const seed = await preview.getAttribute("data-seed");
  expect(seed).toMatch(/^(?!00000000)[\da-f]{8}$/u);
  const totals = expectedTotals(seed ?? "");

  // The painted marks count back, tally by tally, as the generator's totals.
  expect(await renderedTallies(page)).toEqual(totals.map(readingOf));
  expect(await renderedKey(page)).toEqual(totals.map((total, index) => `${index + 1}. ${oracleTallyKeyLine(total)}`));
  // The child's page holds empty lines and no key text.
  expect(new Set(await preview.locator("[data-tally-blank]").allTextContents())).toEqual(new Set([""]));
  const childText = await preview.innerText();
  for (const total of totals) expect(childText).not.toContain(oracleTallyKeyLine(total));

  await page.getByRole("button", { name: "Make another", exact: true }).click();
  await expect(page.getByText("A different worksheet is ready.")).toBeVisible();
  const nextSeed = await preview.getAttribute("data-seed");
  expect(nextSeed).not.toBe(seed);
  const nextTotals = expectedTotals(nextSeed ?? "");
  expect(await renderedTallies(page)).toEqual(nextTotals.map(readingOf));
  expect(nextTotals).not.toEqual(totals);

  // Creating and varying pages never writes the file, and nothing left the origin.
  expect((await appServer.readRaw()).equals(seeded)).toBe(true);
  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const url of requests) expect(new URL(url).origin).toBe(appServer.origin);
});

test("Tally Detective's compiled marks count back as every total from 1 to 20", async ({ appServer, context }) => {
  test.setTimeout(90_000);
  await appServer.seedConfig(acceptanceConfig);
  // Six seeds whose pages together draw every total, 4, 5, 6, 10, 19 and 20
  // among them; the union is checked below rather than assumed.
  const seeds = [0x1, 0x2, 0x3, 0x8, 0xb, 0xcc];
  const seen = new Set<number>();
  for (const seedNumber of seeds) {
    const seed = seedNumber.toString(16).padStart(8, "0");
    const page = await context.newPage();
    await pinSeed(page, seedNumber);
    await page.goto(appServer.origin);
    await chooseWorksheet(page, "tally-detective");
    await controls(page).create().click();
    await expect(page.getByLabel("Worksheet preview")).toHaveAttribute("data-seed", seed);
    const totals = expectedTotals(seed);
    expect(await renderedTallies(page), seed).toEqual(totals.map(readingOf));
    for (const total of totals) seen.add(total);
    await page.close();
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
});

test("Tally Detective's child page and key each print one page on Letter and A4 at both scales", async ({ appServer, page }) => {
  test.setTimeout(90_000);
  await appServer.seedConfig(acceptanceConfig);
  // This seed draws 20, four full bundles, and the reference 8.
  await pinSeed(page, 0x2026_0050);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "tally-detective");
  const totals = expectedTotals("20260050");
  expect(totals).toContain(20);
  expect(totals).toContain(8);
  for (const paperSize of ["letter", "a4"] as const) {
    for (const printScale of ["standard", "large"] as const) {
      await page.emulateMedia({ media: "screen" });
      await choosePrintLayout(page, { paperSize, printScale });
      await controls(page).create().click();
      expect(await renderedTallies(page), `${paperSize} ${printScale}`).toEqual(totals.map(readingOf));
      for (const surface of ["worksheet", "answer"] as const) {
        await page.getByRole("button", { name: surface === "answer" ? "Parent answer key" : "Worksheet", exact: true }).click();
        await page.emulateMedia({ media: "print" });
        await expect(page.locator(`.print-surface[data-surface="${surface}"]`)).toBeVisible();
        if (surface === "worksheet") {
          // The printed marks still count back under print media.
          expect(await paintedTallies(page), `${paperSize} ${printScale} print`).toEqual(totals.map(readingOf));
        }
        const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
        expect(pdf.getPageCount(), `${paperSize} ${printScale} ${surface}`).toBe(1);
        await page.emulateMedia({ media: "screen" });
      }
    }
  }
  expect(await renderedKey(page)).toContain(`${totals.indexOf(8) + 1}. 8 = 5 + 3`);
  expect(await renderedKey(page)).toContain(`${totals.indexOf(20) + 1}. 20 = 5 + 5 + 5 + 5`);
});

test("stored choices of other families never change the tallies, survive switching back, and an explicit save keeps Tally Detective without touching profiles", async ({ appServer, page }) => {
  test.setTimeout(60_000);
  await appServer.seedConfig({
    ...acceptanceConfig,
    defaults: {
      ...acceptanceConfig.defaults,
      length: "long",
      includeDecorativeGraphics: true,
      theme: "space",
      dryMathRegrouping: "required",
    },
  });
  await pinSeed(page, 0x2026_0050);
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "tally-detective");
  await controls(page).create().click();
  // The same tallies as the plain defaults draw for this seed, and the
  // decorative panel never appears: the marks are the whole diagram.
  expect(await renderedTallies(page)).toEqual(expectedTotals("20260050").map(readingOf));
  await expect(page.locator(".print-surface [data-decorative-panel]")).toHaveCount(0);
  await expect(page.locator(".print-surface [data-tally-marks]")).toHaveCount(4);

  // Switching back restores the hidden stored choices.
  await chooseWorksheet(page, "dry-math");
  await openMoreOptions(page);
  await expect(controls(page).length()).toHaveValue("long");
  await chooseLength(page, "long");
  await chooseWorksheet(page, "tally-detective");
  await expect(controls(page).length()).toHaveCount(0);

  // An explicit save writes the family and nothing else changes.
  const before = await appServer.readConfig();
  await page.getByRole("button", { name: "Save these as worksheet defaults" }).click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();
  const after = await appServer.readConfig();
  expect(after.defaults).toEqual({ ...before.defaults, worksheetType: "tally-detective" });
  expect(after.profiles).toEqual(before.profiles);
  await page.reload();
  await expect(controls(page).worksheetCard("tally-detective")).toBeChecked();
  await controls(page).create().click();
  expect(await renderedTallies(page)).toEqual(expectedTotals("20260050").map(readingOf));
});
