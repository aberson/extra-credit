import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { acceptanceConfig } from "../fixtures/print/matrix.js";
import { expect, test } from "./fixtures/app-server.js";
import { chooseChild, chooseWorksheet } from "./fixtures/worksheet-controls.js";

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
      await chooseChild(page, acceptanceConfig.profiles[state === "unavailable" ? 0 : 1]!.id);
      if (state === "unavailable") await expect(page.getByRole("button", { name: "Create worksheet", exact: true })).toBeDisabled();
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

async function tabTo(page: Page, target: Locator): Promise<void> {
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
    await page.keyboard.press("Tab");
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
  await tabTo(page, page.getByRole("spinbutton", { name: "Age in years" }));
  await page.keyboard.type("6");
  await tabTo(page, page.getByRole("button", { name: "Confirm suggested capabilities" }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("button", { name: "Save profile", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Choose a profile to update" })).toBeFocused();
  expect((await appServer.readConfig()).profiles[0]?.displayName).toBe("Keyboard Morgan");
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
    await chooseWorksheet(page, family);
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
