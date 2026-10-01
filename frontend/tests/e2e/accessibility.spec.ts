import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import type { AppConfigV1 } from "../../src/shared/config/schema.js";
import { acceptanceConfig, formerChoices } from "../fixtures/print/matrix.js";
import { expect, test } from "./fixtures/app-server.js";
import {
  chooseChild,
  chooseWorksheet,
  chooseWorksheetChoices,
  controls,
  openMoreOptions,
} from "./fixtures/worksheet-controls.js";

const evidenceRoot = fileURLToPath(new URL("../../../.build-step/accessibility-evidence/", import.meta.url));
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "getRandomValues", {
      configurable: true,
      value: (values: Uint32Array) => { values.fill(5); return values; },
    });
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      configurable: true,
      value: () => "22222222-2222-4222-8222-222222222222",
    });
  });
});

/**
 * The "unavailable" state's source (D34): a fictional version 1 child built
 * here, whose earlier Dry Math setting is addition with operand and result
 * maxima of 1. Its three facts fill no length at either scale, so Create stays
 * disabled with the practice-focus remedy. Migration turns seeding on.
 */
const narrowDryMathConfig: AppConfigV1 = {
  schemaVersion: 1,
  profiles: [
    {
      id: "5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c",
      displayName: "Fictional Narrow",
      ageYears: 6,
      presentationBand: "preschool",
      reviewedOn: "2026-09-01",
      mathSkills: {
        countingMax: 10,
        numeralMax: 10,
        compareMax: 10,
        representations: ["quantities", "equations"],
        understandsEquality: false,
        operations: ["addition"],
        operandMax: 1,
        resultMax: 1,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
      writingMode: "label",
      interests: [],
    },
  ],
  defaults: {
    useDisplayName: true,
    useInterests: true,
    includeDecorativeGraphics: true,
    difficulty: "practice",
    length: "standard",
    includeAnswerKey: true,
    paperSize: "letter",
    printScale: "standard",
  },
};

const states = ["setup", "generator", "preview", "invalid-file-recovery", "stale-conflict", "unavailable", "server-unavailable", "invariant-error"] as const;

async function recordSurface(page: Page, name: string): Promise<void> {
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: `${evidenceRoot}/${name}.png`, fullPage: true });
  await writeFile(`${evidenceRoot}/${name}.json`, JSON.stringify({
    lang: await page.locator("html").getAttribute("lang"),
    viewport: page.viewportSize(),
    text: await page.locator("main").innerText(),
    accessibility: await page.locator("main").ariaSnapshot(),
  }, null, 2));
}

async function assertLayout(page: Page, name: string): Promise<void> {
  const originalText = await page.locator("main").innerText();
  const originalSize = await page.locator("body").evaluate((el) => parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).fontSize));
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.locator("body").evaluate((el) => parseFloat(el.ownerDocument.defaultView!.getComputedStyle(el).fontSize))).toBe(originalSize * 2);
  expect(await page.locator("main").innerText()).toBe(originalText);
  await assertNoOverflow(page);
  await recordSurface(page, `${name}-text-200`);
  await page.addStyleTag({ content: "html { font-size: 100% !important; }" });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.locator("main").innerText()).toBe(originalText);
  await assertNoOverflow(page);
  await recordSurface(page, `${name}-reflow-320`);
}

async function assertNoOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate<{ width: number; scroll: number; clipped: string[] }>(`(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    clipped: [...document.querySelectorAll("button, input, select, summary, p, h1, h2, h3, label")]
      .filter((el) => el.getClientRects().length > 0)
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1 ||
          (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY === "hidden");
      }).map((el) => el.textContent?.trim().slice(0, 80)),
  }))()`);
  expect(geometry.clipped).toEqual([]);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
}

for (const state of states) {
  test(`accessibility: ${state}`, async ({ appServer, page, browser }) => {
    test.setTimeout(90_000);
    const network: { method: string; path: string; status: number }[] = [];
    const errors: string[] = [];
    const consoleKinds: string[] = [];
    page.on("response", (response) => network.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() }));
    page.on("pageerror", (error) => errors.push(error.name));
    page.on("console", (message) => { if (message.type() === "error") consoleKinds.push(message.type()); });
    if (state === "invalid-file-recovery") await appServer.seedRaw(Buffer.from("{fictional-invalid"));
    else if (state === "unavailable") await appServer.seedConfig(narrowDryMathConfig);
    else if (state !== "setup") await appServer.seedConfig(acceptanceConfig);
    // A transport failure, not a replacement UI, drives the production unavailable state.
    if (state === "server-unavailable") await page.route("**/api/health", (route) => route.abort("connectionfailed"));
    await page.goto(appServer.origin);
    if (state === "server-unavailable") {
      await expect(page.getByRole("alert")).toContainText("local server is unavailable");
    } else if (state === "invalid-file-recovery") {
      await expect(page.getByRole("heading", { name: "The saved profile file needs attention" })).toBeVisible();
    } else if (state === "setup") {
      await page.getByRole("button", { name: "Create first profile" }).click();
    } else {
      await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
      if (state === "unavailable") {
        await chooseChild(page, narrowDryMathConfig.profiles[0]!.id);
        await expect(page.getByRole("button", { name: "Create worksheet", exact: true })).toBeDisabled();
        await expect(page.locator("[data-capacity-conflict]")).toHaveText(
          /^This practice focus provides 3 unique facts, but this length needs \d+\. Choose a practice focus with a wider results range\.$/u,
        );
      } else {
        await chooseChild(page, acceptanceConfig.profiles[1]!.id);
      }
      if (state === "preview" || state === "invariant-error") {
        if (state === "invariant-error") await page.evaluate(() => {
          Object.defineProperty(Crypto.prototype, "randomUUID", { configurable: true, value: () => "invalid-worksheet-id" });
        });
        await page.getByRole("button", { name: "Create worksheet", exact: true }).click();
        if (state === "preview") await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
        else {
          await expect(page.getByRole("alert").filter({ hasText: "Worksheet metadata did not match" })).toBeVisible();
          await expect(page.getByRole("region", { name: "Worksheet preview" })).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Create worksheet", exact: true })).toBeEnabled();
        }
      } else if (state === "stale-conflict") {
        const context = await browser.newContext();
        try {
          const other = await context.newPage();
          await other.goto(appServer.origin);
          await page.getByRole("button", { name: "Edit Morgan", exact: true }).click();
          await other.getByRole("button", { name: "Edit Morgan", exact: true }).click();
          await other.getByRole("textbox", { name: "Nickname (optional)" }).fill("Fictional Winner");
          await other.getByRole("button", { name: "Save profile", exact: true }).click();
          await expect(other.getByRole("heading", { name: "Fictional Winner" })).toBeVisible();
          await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Fictional Draft");
          await page.getByRole("button", { name: "Save profile", exact: true }).click();
          await expect(page.getByRole("alert")).toContainText("Another tab saved newer profiles");
          await expect(page.getByRole("alert")).toBeFocused();
        } finally { await context.close(); }
      }
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    const axe = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(axe.violations).toEqual([]);
    await recordSurface(page, state);
    await assertLayout(page, state);
    expect(errors).toEqual([]);
    await writeFile(`${evidenceRoot}/${state}-runtime.json`, JSON.stringify({ tags, violations: axe.violations, network, errors, consoleKinds }, null, 2));
  });
}

async function tabTo(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab"): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await target.evaluate((el) => el === el.ownerDocument.activeElement)) {
      const focus = await target.evaluate((el) => {
        const style = el.ownerDocument.defaultView!.getComputedStyle(el);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      expect(focus.style).not.toBe("none");
      expect(focus.width).toBeGreaterThanOrEqual(2);
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error("Keyboard could not reach the named control.");
}

test("keyboard-only profile creation reaches preview with visible focus", async ({ appServer, page }) => {
  await page.goto(appServer.origin);
  const first = page.getByRole("button", { name: "Create first profile" });
  await expect(first).toBeVisible();
  await tabTo(page, first);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Set up a profile" })).toBeFocused();
  await tabTo(page, page.getByRole("textbox", { name: "Nickname (optional)" }));
  await page.keyboard.type("Keyboard Morgan");
  // Identity fields only: no age, preset or writing-mode control to pass.
  await expect(page.getByRole("spinbutton", { name: /\bages?\b/iu })).toHaveCount(0);
  const form = page.getByRole("form", { name: "Set up a profile" });
  await expect(form.getByRole("radio")).toHaveCount(0);
  await expect(form.getByRole("combobox")).toHaveCount(0);
  await tabTo(page, page.getByRole("button", { name: "Save profile", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Choose a profile to update" })).toBeFocused();
  expect((await appServer.readConfig()).profiles[0]?.displayName).toBe("Keyboard Morgan");
  // The practice focus is a worksheet choice, changed by keyboard in the panel.
  const practiceFocus = controls(page).practiceFocus();
  const startingFocus = await practiceFocus.inputValue();
  await tabTo(page, practiceFocus);
  await page.keyboard.press("ArrowDown");
  await expect(practiceFocus).not.toHaveValue(startingFocus);
  await expect(practiceFocus).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: "Create worksheet", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: "Parent answer key", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Parent answer key", exact: true })).toHaveAttribute("aria-pressed", "true");
  await tabTo(page, page.getByRole("button", { name: "Print current page" }));
  await recordSurface(page, "keyboard-preview");
});

for (const family of ["find-the-wow", "sentence-builder", "count-compare-make"] as const) {
  test(`accessible responsive preview: ${family}`, async ({ appServer, page }) => {
    await appServer.seedConfig(acceptanceConfig);
    await page.goto(appServer.origin);
    await chooseChild(page, acceptanceConfig.profiles[1]!.id);
    // The choices this child's earlier settings supplied before the example
    // became identity-only, now made through the worksheet controls.
    await chooseWorksheetChoices(page, { ...formerChoices(1), worksheetType: family });
    await page.getByRole("button", { name: "Create worksheet", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    await assertLayout(page, `preview-${family}`);
    const key = page.getByRole("button", { name: "Parent answer key", exact: true });
    if (family === "sentence-builder") {
      await expect(key).toHaveCount(0);
      return;
    }
    await key.click();
    await expect(key).toHaveAttribute("aria-pressed", "true");
    await assertNoOverflow(page);
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    await recordSurface(page, `key-${family}-reflow-320`);
  });
}

test("accessibility measurements reject visible overflow and missing control labels", async ({ appServer, page }) => {
  await appServer.seedConfig(acceptanceConfig);
  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
  await assertNoOverflow(page);
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Create worksheet", exact: true }).evaluate((el) => {
    el.style.width = "2000px";
    el.style.maxWidth = "none";
    el.textContent = "";
  });
  await expect(assertNoOverflow(page)).rejects.toThrow();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(({ id }) => id)).toContain("button-name");
});

interface ViewportMetrics { clientHeight: number; clientWidth: number; scrollWidth: number; scrollY: number }
async function viewportMetrics(page: Page): Promise<ViewportMetrics> {
  return await page.evaluate<ViewportMetrics>(`({
    clientHeight: document.documentElement.clientHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollY: window.scrollY,
  })`);
}

// Relocated from the fixed development-stack test in foundation.spec.ts, which
// serves whatever file sits at the canonical config path. This one runs on the
// ephemeral compiled fixture over a temporary config. It deliberately pins no
// document height: the empty state renders the generator panel with little
// vertical headroom, and the canonical fictional profiles scroll vertically.
test("compiled 1920×1080 layout: empty first screen fits and no state scrolls horizontally", async ({ appServer, page }) => {
  await page.setViewportSize({ width: 1_920, height: 1_080 });

  await appServer.seedMissing();
  await page.goto(appServer.origin);
  const readyStatus = page.locator(".health").getByRole("status");
  const firstProfile = page.getByRole("button", { name: "Create first profile" });
  const worksheetHeading = page.getByRole("heading", { name: "Create a practice worksheet" });
  await expect(readyStatus).toContainText("Ready on this computer.");
  await expect(firstProfile).toBeVisible();
  await expect(worksheetHeading).toBeVisible();
  expect(await viewportMetrics(page)).toEqual({ clientHeight: 1_080, clientWidth: 1_920, scrollWidth: 1_920, scrollY: 0 });
  for (const element of [readyStatus, firstProfile, worksheetHeading]) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(1_080);
  }

  await appServer.seedConfig(acceptanceConfig);
  await page.goto(appServer.origin);
  await expect(worksheetHeading).toBeVisible();
  const canonical = await viewportMetrics(page);
  expect({ clientHeight: canonical.clientHeight, clientWidth: canonical.clientWidth, scrollWidth: canonical.scrollWidth })
    .toEqual({ clientHeight: 1_080, clientWidth: 1_920, scrollWidth: 1_920 });

  // Calibration: a synthetic wide element must break the horizontal check, and
  // removing it must restore it.
  await page.evaluate(`(() => {
    const wide = document.createElement("div");
    wide.id = "synthetic-wide-calibration";
    wide.style.width = "2400px";
    wide.style.height = "1px";
    document.body.append(wide);
  })()`);
  const widened = await viewportMetrics(page);
  expect(widened.scrollWidth).toBeGreaterThan(widened.clientWidth);
  await page.evaluate(`document.getElementById("synthetic-wide-calibration").remove()`);
  const restored = await viewportMetrics(page);
  expect(restored.scrollWidth).toBe(restored.clientWidth);
  expect(restored.clientWidth).toBe(1_920);
});

/**
 * A fictional version 1 file whose one child can create every family, so the
 * upgrade notice shows above a producible worksheet-first panel. Migration
 * turns seeding on.
 */
const upgradeNoticeConfig: AppConfigV1 = {
  ...narrowDryMathConfig,
  profiles: narrowDryMathConfig.profiles.map((profile) => ({
    ...profile,
    displayName: "Fictional Upgrade",
    mathSkills: {
      ...profile.mathSkills,
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 10,
      resultMax: 10,
    },
  })),
};

async function expectAxeClean(page: Page): Promise<void> {
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
}

test("worksheet-first panel: axe is clean with More options closed and open, beside the upgrade notice", async ({ appServer, page }) => {
  test.setTimeout(60_000);
  await appServer.seedConfig(upgradeNoticeConfig);
  await page.goto(appServer.origin);
  await expect(page.locator("[data-upgrade-notice] p")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
  const details = page.locator("details").filter({ has: controls(page).moreOptions() });
  await expect(details).not.toHaveAttribute("open", "");
  await expectAxeClean(page);

  await openMoreOptions(page);
  await expectAxeClean(page);
  for (const family of ["find-the-wow", "sentence-builder", "count-compare-make"] as const) {
    await chooseWorksheet(page, family);
    // The decorative Theme shows, with its help text, for the two decorating
    // families while graphics are on, so the scan covers it.
    if (family === "find-the-wow") {
      await expect(controls(page).theme()).toHaveCount(0);
    } else {
      await expect(controls(page).graphics()).toBeChecked();
      await expect(controls(page).theme()).toBeVisible();
      await expect(page.locator("[data-theme-help]")).toBeVisible();
    }
    await expectAxeClean(page);
  }
});

test("worksheet-first panel: keyboard reaches the cards, variant, child, focus, More options and Create with visible focus", async ({ appServer, page }) => {
  await appServer.seedConfig(upgradeNoticeConfig);
  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
  const panel = controls(page);

  // The checked card is the group's one tab stop; arrow keys move the choice.
  await tabTo(page, panel.worksheetCard("dry-math"));
  await page.keyboard.press("ArrowRight");
  await expect(panel.worksheetCard("find-the-wow")).toBeChecked();
  await expect(panel.worksheetCard("find-the-wow")).toBeFocused();

  const equations = panel.statements().getByRole("radio", { name: "Equations", exact: true });
  const quantities = panel.statements().getByRole("radio", { name: "Quantity pictures", exact: true });
  await tabTo(page, equations);
  await page.keyboard.press("ArrowLeft");
  await expect(quantities).toBeChecked();
  await expect(quantities).toBeFocused();

  await tabTo(page, panel.child());
  await tabTo(page, panel.practiceFocus());
  await tabTo(page, panel.create());
  await tabTo(page, panel.moreOptions());
  await page.keyboard.press("Enter");
  await expect(page.locator("details").filter({ has: panel.moreOptions() })).toHaveAttribute("open", "");
  await tabTo(page, panel.length());

  await tabTo(page, panel.create(), "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Preview and print" })).toBeFocused();
  await expect(page.getByLabel("Worksheet preview").locator('[data-wow-mode="quantity"]')).not.toHaveCount(0);
});

test("worksheet-first panel: the four cards share a row at 1280 px and stack at 320 px without horizontal scroll", async ({ appServer, page }) => {
  await appServer.seedConfig(upgradeNoticeConfig);
  await page.setViewportSize({ width: 1_280, height: 900 });
  await page.goto(appServer.origin);
  const cards = page.locator(".worksheet-type-card");
  await expect(cards).toHaveCount(4);
  const wide = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect()).map(({ top, left }) => ({ top, left })),
  );
  expect(new Set(wide.map(({ top }) => Math.round(top))).size).toBe(1);
  expect(wide.map(({ left }) => left)).toEqual([...wide.map(({ left }) => left)].sort((a, b) => a - b));
  await assertNoOverflow(page);

  await page.setViewportSize({ width: 320, height: 900 });
  const narrow = await cards.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect()).map(({ top, bottom, left }) => ({ top, bottom, left })),
  );
  expect(new Set(narrow.map(({ left }) => Math.round(left))).size).toBe(1);
  for (let index = 1; index < narrow.length; index++) {
    expect(narrow[index]!.top).toBeGreaterThanOrEqual(narrow[index - 1]!.bottom);
  }
  await openMoreOptions(page);
  await assertNoOverflow(page);
});

test("worksheet-first panel: 200% text keeps every label and blocking guidance stays outside collapsed More options", async ({ appServer, page }) => {
  await appServer.seedConfig(upgradeNoticeConfig);
  await page.setViewportSize({ width: 1_280, height: 900 });
  await page.goto(appServer.origin);
  await chooseWorksheet(page, "sentence-builder");
  await openMoreOptions(page);
  // Text-only labels: legends, card titles, the summary and the buttons.
  const labels = [
    "Worksheet type", "Dry Math", "Math — Two Whats and a Wow", "Sentence Builder", "Count, Compare & Make",
    "Writing activity", "Vocabulary", "Create worksheet", "More options", "Length",
    "Personalization", "Print layout", "Save these as worksheet defaults",
  ];
  const panel = page.getByRole("region", { name: "Create a practice worksheet" });
  const before = await panel.innerText();
  for (const label of [...labels, "Child profile", "Paper size", "Print scale"]) expect(before).toContain(label);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  for (const label of labels) {
    await expect(panel.getByText(label, { exact: true }).first()).toBeVisible();
  }
  for (const control of [controls(page).child(), controls(page).length(), controls(page).paperSize(), controls(page).printScale()]) {
    await expect(control).toBeVisible();
  }
  await assertNoOverflow(page);

  // A shortfall's guidance sits above Create, outside the collapsed More options.
  await appServer.seedConfig(narrowDryMathConfig);
  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
  const details = page.locator("details").filter({ has: controls(page).moreOptions() });
  await expect(details).not.toHaveAttribute("open", "");
  const conflict = page.locator("[data-capacity-conflict]");
  await expect(conflict).toBeVisible();
  await expect(conflict.locator("xpath=ancestor::details")).toHaveCount(0);
  const conflictId = await conflict.getAttribute("id");
  expect(conflictId).not.toBeNull();
  await expect(controls(page).create()).toHaveAttribute("aria-describedby", conflictId!);
  await expect(controls(page).create()).toBeDisabled();
  await expectAxeClean(page);
});
