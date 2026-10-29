import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { worksheetSelectionOf } from "../../src/shared/config/defaults.js";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.js";
import { generateClockExplorer } from "../../src/worksheets/clock-explorer/generator.js";
import { acceptanceConfig } from "../fixtures/profiles.js";
import {
  judgeClockDocument,
  oracleClockKeyLine,
  oracleHourFromHands,
  type OracleHandVector,
} from "../oracles/clock-oracle.js";
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
 * Clock Explorer on the compiled app (visual math specification, Phase V),
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
