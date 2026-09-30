import { request as httpRequest } from "node:http";
import { appendFile } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { MATH_PRESETS } from "../../src/shared/config/math-presets.js";
import type { ChildProfileV2, WritingMode } from "../../src/shared/config/schema.js";
import { acceptanceConfig } from "../fixtures/profiles.js";
import { expect, test } from "./fixtures/app-server.js";
import { chooseChild, chooseWorksheet, openMoreOptions } from "./fixtures/worksheet-controls.js";

const families = ["dry-math", "find-the-wow", "sentence-builder", "count-compare-make"] as const;

/** The preset radio whose expansion equals a canonical child's earlier settings. */
const PRESET_LABELS = {
  "quantities-to-10": "Quantities to 10",
  "early-primary-within-10": "Early primary within 10",
  "early-primary-within-20": "Early primary within 20",
} as const;

function presetLabel(profile: ChildProfileV2): string {
  const legacy = profile.legacyChoices;
  const match = (Object.keys(PRESET_LABELS) as (keyof typeof PRESET_LABELS)[]).find(
    (key) =>
      JSON.stringify(MATH_PRESETS[key].mathSkills) === JSON.stringify(legacy?.mathSkills) &&
      MATH_PRESETS[key].presentationBand === legacy?.presentationBand,
  );
  if (match === undefined) throw new Error("No preset matches the canonical earlier settings.");
  return PRESET_LABELS[match];
}

/** The earlier writing mode a stored profile carries in its `legacyChoices`. */
function writingModeOf(profile: ChildProfileV2): WritingMode {
  const mode = profile.legacyChoices?.writingMode;
  if (mode === undefined) throw new Error("A canonical profile carried no earlier writing mode.");
  return mode;
}

async function createProfile(page: Page, profile: ChildProfileV2): Promise<void> {
  await page.getByRole("button", { name: /^(Create first profile|Add profile)$/u }).click();
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill(profile.displayName ?? "");
  // No age field exists: the parent chooses the preset explicitly.
  await expect(page.getByRole("spinbutton", { name: "Age in years" })).toHaveCount(0);
  await expect(page.getByLabel(/\bages?\b/iu)).toHaveCount(0);
  await page.getByRole("radio", { name: presetLabel(profile), exact: true }).check();
  await page.getByRole("combobox", { name: "Writing mode" }).selectOption(writingModeOf(profile));
  await page.getByLabel("Reviewed on").fill(profile.reviewedOn);
  await page.getByRole("textbox", { name: /Broad interests/ }).fill(profile.interests.join(", "));
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/config",
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("heading", { name: profile.displayName ?? "", exact: true })).toBeVisible();
}

async function expectPrivateBrowser(page: Page, origin: string): Promise<void> {
  expect(await page.title()).toBe("Extra Credit Worksheet");
  expect(page.url()).toBe(`${origin}/`);
  expect(await page.evaluate(`(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: await indexedDB.databases(),
    caches: await caches.keys(),
    workers: (await navigator.serviceWorker.getRegistrations()).length,
    controlled: navigator.serviceWorker.controller !== null,
  }))()`)).toEqual({ local: 0, session: 0, databases: [], caches: [], workers: 0, controlled: false });
}

// node:http preserves the exact encoded request target, unlike URL-normalizing clients.
async function staticProbe(origin: string, path: string): Promise<{ status: number; body: string }> {
  return await new Promise((resolve, reject) => {
    const request = httpRequest(origin, { path }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.setTimeout(5_000, () => request.destroy(new Error("Static probe timed out.")));
    request.end();
  });
}

test("compiled release profile-to-print and privacy gate", async ({ appServer, page, context }, testInfo) => {
  const started = performance.now();
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const requests: string[] = [];
  const badResponses: number[] = [];
  const downloads: string[] = [];
  const sockets: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  context.on("requestfailed", (request) => failedRequests.push(request.url()));
  context.on("response", (response) => { if (response.status() >= 400) badResponses.push(response.status()); });
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  page.on("websocket", (socket) => sockets.push(socket.url()));

  // Only the empty container is seeded. Every profile and subsequent edit uses
  // the real UI, session token, ETag routes, and atomic temporary-file storage.
  await appServer.seedConfig({ ...acceptanceConfig, profiles: [] });
  await page.goto(appServer.origin);
  for (const profile of acceptanceConfig.profiles) await createProfile(page, profile);
  const saved = await appServer.readConfig();
  const privacyEvidencePath = process.env.EXTRA_CREDIT_E2E_PRIVACY_EVIDENCE;
  if (!privacyEvidencePath) throw new Error("The smoke requires the private harness evidence channel.");
  async function recordPrivateValues(profiles: readonly ChildProfileV2[]): Promise<void> {
    const values = profiles.flatMap(({ id, displayName, interests }) => [id, displayName, ...interests])
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    await appendFile(privacyEvidencePath!, `${JSON.stringify(values)}\n`, "utf8");
  }
  await recordPrivateValues(saved.profiles);
  expect(saved.profiles).toHaveLength(3);
  for (const [index, profile] of saved.profiles.entries()) {
    // Production cryptographic IDs remain real; canonical fields are unchanged.
    expect({ ...profile, id: acceptanceConfig.profiles[index]?.id }).toEqual(acceptanceConfig.profiles[index]);
    expect(profile.id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/u);
  }
  expect(new Set(saved.profiles.map(({ id }) => id)).size).toBe(3);
  await page.reload();
  const create = page.getByRole("button", { name: "Create worksheet", exact: true });

  async function editWriting(profile: ChildProfileV2, mode: WritingMode): Promise<void> {
    await page.getByRole("button", { name: `Edit ${profile.displayName}` }).click();
    await page.getByRole("combobox", { name: "Writing mode" }).selectOption(mode);
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByRole("heading", { name: profile.displayName ?? "", exact: true })).toBeVisible();
    // Earlier capabilities are read from the stored `legacyChoices`.
    expect((await appServer.readConfig()).profiles.find(({ id }) => id === profile.id)?.legacyChoices?.writingMode).toBe(mode);
  }

  /** The profile list and the generator panel never name age (U3). */
  async function expectAgeFreeRegions(): Promise<void> {
    const regions = [
      page.locator('section[aria-labelledby="profiles-title"]'),
      page.getByRole("region", { name: "Create a practice worksheet" }),
    ];
    for (const region of regions) {
      await expect(region).toHaveCount(1);
      expect(await region.innerText()).not.toMatch(/\bages?\b/iu);
    }
  }

  async function generate(profile: ChildProfileV2, family: typeof families[number], variant?: string): Promise<void> {
    await chooseChild(page, profile.id);
    await chooseWorksheet(page, family);
    await create.click();
    const preview = page.getByLabel("Worksheet preview");
    await expect(preview).toHaveAttribute("data-worksheet-type", family);
    await expect(preview).toContainText(profile.displayName ?? "");
    await expect(preview).toHaveAttribute("data-seed", /^(?!00000000)[\da-f]{8}$/u);
    const items = preview.locator("[data-item-id]");
    expect(await items.count()).toBeGreaterThan(0);
    if (family === "sentence-builder") {
      await expect(preview.locator(`[data-writing-mode="${variant}"]`)).toHaveCount(1);
      await expect(preview.locator("[data-response-panel]")).toBeVisible();
    }
    if (family === "find-the-wow") {
      expect(await preview.locator(`[data-wow-mode="${variant}"]`).count()).toBe(await items.count());
    }
    if (family !== "sentence-builder") {
      const quantities = await preview.locator("[data-instructional-quantity]").evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute("data-instructional-quantity"))),
      );
      const textNodes = await items.evaluateAll((nodes) => nodes.flatMap((node) => {
        const walker = node.ownerDocument.createTreeWalker(node, 4);
        const texts: string[] = [];
        while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? "");
        return texts;
      }));
      const numbers = textNodes.flatMap((text) => [...text.matchAll(/\d+/gu)].map(([value]) => Number(value)));
      expect(numbers.length + quantities.length).toBeGreaterThan(0);
      for (const number of [...numbers, ...quantities]) {
        expect(number).toBeGreaterThanOrEqual(0);
        expect(number).toBeLessThanOrEqual(20);
      }
    }
    const ids = await items.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-item-id")));
    for (const surface of family === "sentence-builder" ? ["worksheet"] : ["worksheet", "answer"]) {
      if (surface === "answer") await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
      const printed = page.locator(`.print-surface[data-surface="${surface}"]`);
      await page.emulateMedia({ media: "print" });
      await expect(printed).toBeVisible();
      await expect(page.locator(".profile-workspace")).toBeHidden();
      expect(await printed.locator("[data-item-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-item-id")))).toEqual(ids);
      await expectPrivateBrowser(page, appServer.origin);
      // Chromium's actual PDF metadata uses the generic title that supplies the
      // browser's Save as PDF suggestion, even with a personalized printed page.
      const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
      expect(pdf.getTitle()).toBe("Extra Credit Worksheet");
      expect(pdf.getPageCount()).toBe(1);
      await page.emulateMedia({ media: "screen" });
    }
    if (family === "sentence-builder") {
      await expect(page.getByRole("button", { name: "Parent answer key", exact: true })).toHaveCount(0);
    }
  }

  const [young, middle, oldest] = saved.profiles;
  if (young === undefined || middle === undefined || oldest === undefined) throw new Error("Canonical fixture missing.");
  await expectAgeFreeRegions();
  // Dry Math implies its equations representation, so the quantities-only
  // child generates it at the saved default's practice focus.
  await generate(young, "dry-math");
  await expect(page.getByText(/Dry Math needs/)).toHaveCount(0);
  await generate(young, "count-compare-make");
  await generate(young, "find-the-wow", "quantity");
  for (const mode of ["draw-and-tell", "label", "copy-with-model"] as const) {
    await editWriting(young, mode);
    await generate(young, "sentence-builder", mode);
  }
  await editWriting(young, writingModeOf(young));
  await generate(middle, "sentence-builder", "sentence-frame");
  await generate(middle, "dry-math");
  // Equation-only earlier settings without confirmed equality seed no
  // Statements variant, so Two Whats and a Wow keeps the saved default,
  // Quantity pictures, and never generates symbolic statements.
  await page.getByRole("button", { name: `Edit ${middle.displayName}` }).click();
  await page.getByRole("radio", { name: "Custom capabilities", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "quantities", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "quantities", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Parent confirms understanding of equality", exact: true }).uncheck();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await chooseChild(page, middle.id);
  expect((await appServer.readConfig()).profiles.find(({ id }) => id === middle.id)?.legacyChoices?.mathSkills).toMatchObject({
    representations: ["equations"], understandsEquality: false,
  });
  await generate(middle, "find-the-wow", "quantity");
  await expect(page.getByText(/Two Whats and a Wow needs/)).toHaveCount(0);
  await page.getByRole("button", { name: `Edit ${middle.displayName}` }).click();
  await page.getByRole("radio", { name: "Early primary within 10", exact: true }).check();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await generate(oldest, "dry-math");
  await generate(oldest, "count-compare-make");
  await generate(oldest, "sentence-builder", "independent");
  await generate(oldest, "find-the-wow", "equation");
  // No Difficulty control exists; the quantities-only canonical child gets the
  // quantity page that Confidence used to force on the oldest child.
  await openMoreOptions(page);
  expect(await page.getByRole("region", { name: "Create a practice worksheet" }).innerText()).not.toMatch(
    /\bDifficulty\b|\bstretch\b/iu,
  );
  await generate(young, "find-the-wow", "quantity");

  // A retained profile with no age: its capabilities copy the oldest canonical
  // child's into `legacyChoices`, and age no longer gates any family.
  await createProfile(page, { ...oldest, displayName: "Temporary" });
  const retained = (await appServer.readConfig()).profiles.find(({ displayName }) => displayName === "Temporary");
  expect(retained).toBeDefined();
  expect(retained).not.toHaveProperty("ageYears");
  expect(retained?.legacyChoices).toEqual(oldest.legacyChoices);
  if (retained !== undefined) await recordPrivateValues([retained]);
  await page.reload();
  await chooseChild(page, retained?.id ?? "missing");
  for (const family of families) {
    await chooseWorksheet(page, family);
    await expect(create).toBeEnabled();
    await expect(page.getByText(/support ages|\bages? \d/iu)).toHaveCount(0);
    await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  }
  await expectAgeFreeRegions();
  expect((await appServer.readConfig()).profiles.find(({ id }) => id === retained?.id)).toEqual(retained);
  await page.getByRole("button", { name: "Delete Temporary", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("heading", { name: "Temporary", exact: true })).toHaveCount(0);
  expect((await appServer.readConfig()).profiles).toEqual(saved.profiles);

  for (const path of ["/.env", "/.git/config", "/assets/", "/config/", "/config/children.example.json", "/config/children.local.json", "/%2e%2e/config/children.example.json", "/assets/%2e%2e/%2e%2e/config/children.example.json", "/%2e%2e%2fconfig%2fchildren.example.json"]) {
    const response = await staticProbe(appServer.origin, path);
    expect([400, 403, 404]).toContain(response.status);
    expect(response.body).not.toContain("<html");
    expect(response.body).not.toContain("schemaVersion");
  }
  await expectPrivateBrowser(page, appServer.origin);
  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(badResponses).toEqual([]);
  expect(appServer.serverErrors()).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(downloads).toEqual([]);
  expect(sockets).toEqual([]);
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    const parsed = new URL(url);
    expect(parsed.origin).toBe(appServer.origin);
    expect(parsed.search).toBe("");
    expect(parsed.hash).toBe("");
    expect(parsed.pathname).toMatch(/^\/(?:api\/(?:health|session|config)|assets\/[^/]+)?$/u);
    for (const profile of saved.profiles) {
      expect(url).not.toContain(profile.id);
      expect(url).not.toContain(profile.displayName);
    }
  }
  const durationMs = Math.round(performance.now() - started);
  expect(durationMs).toBeLessThan(60_000);
  await testInfo.attach("release-smoke-timing", { body: JSON.stringify({ durationMs }), contentType: "application/json" });
});
