import { request as httpRequest } from "node:http";
import { appendFile } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { worksheetSelectionOf } from "../../src/shared/config/defaults.js";
import { PRACTICE_FOCUS_CATALOG } from "../../src/shared/config/practice-focus.js";
import { AppConfigV2Schema, type ChildProfileV2 } from "../../src/shared/config/schema.js";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.js";
import { generateDryMath } from "../../src/worksheets/dry-math/generator.js";
import {
  acceptanceConfig,
  childrenV1FixtureBytes,
  isIdentityOnlyProfile,
  migratedV1FixtureConfig,
} from "../fixtures/profiles.js";
import { judgeRenderedPage } from "../oracles/arithmetic-oracle.js";
import { expect, test } from "./fixtures/app-server.js";
import {
  chooseChild,
  chooseLength,
  choosePracticeFocus,
  chooseRegrouping,
  chooseVariant,
  chooseVocabulary,
  chooseWorksheet,
  controls,
  openMoreOptions,
  setAnswerKey,
} from "./fixtures/worksheet-controls.js";

const families = ["dry-math", "find-the-wow", "sentence-builder", "count-compare-make"] as const;

/**
 * The one explicit unavailable state (D34): a fictional child built here whose
 * earlier Dry Math setting is addition with operand and result maxima of 1.
 * Its three facts fill no length, so while seeding is on and its Dry Math
 * group is untouched, Create stays disabled with the practice-focus remedy.
 * No UI can create earlier settings, so this child is seeded.
 */
const shortfallChild: ChildProfileV2 = {
  id: "d3400000-0000-4000-8000-000000000034",
  displayName: "Fictional Shortfall",
  reviewedOn: "2026-09-01",
  interests: [],
  legacyChoices: {
    presentationBand: "preschool",
    writingMode: "label",
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
  },
};

async function createProfile(page: Page, profile: ChildProfileV2): Promise<void> {
  await page.getByRole("button", { name: /^(Create first profile|Add profile)$/u }).click();
  // The form holds only identity fields: no age, preset or writing mode.
  await expect(page.getByRole("spinbutton", { name: "Age in years" })).toHaveCount(0);
  await expect(page.getByLabel(/\bages?\b/iu)).toHaveCount(0);
  const form = page.locator('form[aria-labelledby="profile-editor-title"]');
  await expect(form.locator("input, select, textarea")).toHaveCount(3);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill(profile.displayName ?? "");
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

/** Appends saved profile values to the harness's private evidence file, never to output. */
async function recordPrivateValues(profiles: readonly ChildProfileV2[]): Promise<void> {
  const privacyEvidencePath = process.env.EXTRA_CREDIT_E2E_PRIVACY_EVIDENCE;
  if (!privacyEvidencePath) throw new Error("The smoke requires the private harness evidence channel.");
  const values = profiles.flatMap(({ id, displayName, interests }) => [id, displayName, ...interests])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  await appendFile(privacyEvidencePath, `${JSON.stringify(values)}\n`, "utf8");
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

  // Only the container and the one child no UI can create are seeded: the
  // shortfall child's earlier settings, with seeding on. Every other profile
  // and subsequent edit uses the real UI, session token, ETag routes, and
  // atomic temporary-file storage.
  await appServer.seedConfig({
    ...acceptanceConfig,
    profiles: [shortfallChild],
    defaults: { ...acceptanceConfig.defaults, useEarlierChildSettings: true },
  });
  await recordPrivateValues([shortfallChild]);
  await page.goto(appServer.origin);
  for (const profile of acceptanceConfig.profiles) await createProfile(page, profile);
  const saved = await appServer.readConfig();
  await recordPrivateValues(saved.profiles);
  expect(saved.profiles).toHaveLength(4);
  expect(saved.profiles[0]).toEqual(shortfallChild);
  const created = saved.profiles.slice(1);
  for (const [index, profile] of created.entries()) {
    // Production cryptographic IDs remain real; canonical fields are unchanged,
    // and a created profile is identity-only.
    expect({ ...profile, id: acceptanceConfig.profiles[index]?.id }).toEqual(acceptanceConfig.profiles[index]);
    expect(profile.id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/u);
    expect(isIdentityOnlyProfile(profile)).toBe(true);
  }
  expect(new Set(created.map(({ id }) => id)).size).toBe(3);
  await page.reload();
  const create = page.getByRole("button", { name: "Create worksheet", exact: true });

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
    if (family === "sentence-builder" || family === "find-the-wow") {
      await chooseVariant(page, variant as Parameters<typeof chooseVariant>[1]);
    }
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

  const [young, middle, oldest] = created;
  if (young === undefined || middle === undefined || oldest === undefined) throw new Error("Canonical fixture missing.");
  await expectAgeFreeRegions();

  // The one unavailable state: the seeded shortfall child's earlier Dry Math
  // setting cannot fill any length, so Create is disabled with the
  // practice-focus remedy, and no preview appears.
  await chooseChild(page, shortfallChild.id);
  await chooseWorksheet(page, "dry-math");
  await expect(create).toBeDisabled();
  await expect(page.locator("[data-capacity-conflict]")).toHaveText(
    /^This practice focus provides 3 unique facts, but this length needs \d+\. Choose a practice focus with a wider results range\.$/u,
  );
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);

  // An identity-only child starts from the saved defaults, so Dry Math
  // generates at the default practice focus.
  await generate(young, "dry-math");
  await expect(page.getByText(/Dry Math needs/)).toHaveCount(0);
  await generate(young, "count-compare-make");
  await generate(young, "find-the-wow", "quantity");
  for (const mode of ["draw-and-tell", "label", "copy-with-model"] as const) {
    await generate(young, "sentence-builder", mode);
  }
  await generate(middle, "sentence-builder", "sentence-frame");
  await generate(middle, "dry-math");
  await generate(middle, "find-the-wow", "quantity");
  await expect(page.getByText(/Two Whats and a Wow needs/)).toHaveCount(0);
  await generate(oldest, "dry-math");
  await generate(oldest, "count-compare-make");
  await generate(oldest, "sentence-builder", "independent");
  await generate(oldest, "find-the-wow", "equation");
  // No Difficulty control exists.
  await openMoreOptions(page);
  expect(await page.getByRole("region", { name: "Create a practice worksheet" }).innerText()).not.toMatch(
    /\bDifficulty\b|\bstretch\b/iu,
  );
  // None of these generations wrote the file.
  expect(await appServer.readConfig()).toEqual(saved);

  // A retained profile is identity-only, and nothing about it gates a family.
  await createProfile(page, { ...oldest, displayName: "Temporary" });
  const retained = (await appServer.readConfig()).profiles.find(({ displayName }) => displayName === "Temporary");
  expect(retained).toBeDefined();
  expect(retained).not.toHaveProperty("ageYears");
  expect(isIdentityOnlyProfile(retained)).toBe(true);
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

/** The keys an earlier version stored that version 2 never writes, found at any depth. */
function retiredKeysAnywhere(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(retiredKeysAnywhere);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(key === "ageYears" || key === "difficulty" ? [key] : []),
    ...retiredKeysAnywhere(child),
  ]);
}

const V1_BACKUP_NAME = /^children\.local\.json\.v1-\d{8}T\d{6}Z-[0-9a-f]{8}\.bak$/u;

test("compiled upgrade of an earlier-version file through every worksheet choice to print", async ({ appServer, page, context }) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const requests: string[] = [];
  const puts: string[] = [];
  context.on("request", (request) => {
    requests.push(request.url());
    if (request.method() === "PUT") puts.push(new URL(request.url()).pathname);
  });
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.message));

  /** One rendered Dry Math problem's operands and its recomputed answer. */
  function dryMathValues(text: string): { left: number; right: number; answer: number } {
    const match = /(\d+)\s*([+−])\s*(\d+)/u.exec(text);
    expect(match).not.toBeNull();
    const left = Number(match?.[1]);
    const right = Number(match?.[3]);
    return { left, right, answer: match?.[2] === "+" ? left + right : left - right };
  }

  await appServer.seedRaw(childrenV1FixtureBytes);
  await recordPrivateValues(migratedV1FixtureConfig.profiles);
  const upgradedProfiles = migratedV1FixtureConfig.profiles;
  const [, , withinTwenty] = upgradedProfiles;
  if (withinTwenty?.legacyChoices === undefined) throw new Error("The v1 fixture's third child carried no earlier settings.");

  // Reading the earlier-version file shows the notice and writes nothing.
  await page.goto(appServer.origin);
  const notice = page.locator("[data-upgrade-notice]");
  await expect(notice).toHaveText(/^This profile file was saved by an earlier version\./u);
  const create = page.getByRole("button", { name: "Create worksheet", exact: true });

  // The seeded panel starts from a migrated child's earlier settings: its
  // stored addition and subtraction within 20 becomes the Dry Math focus.
  await chooseChild(page, withinTwenty.id);
  await chooseWorksheet(page, "dry-math");
  await expect(page.locator("[data-earlier-settings-used]")).toBeVisible();
  await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
    "Addition and subtraction within 20",
  );
  await create.click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "dry-math");
  const earlierRows = await preview.locator("[data-item-id]").allTextContents();
  expect(earlierRows.length).toBeGreaterThan(0);
  const earlierValues = earlierRows.flatMap((row) => {
    const { left, right, answer } = dryMathValues(row);
    return [left, right, answer];
  });
  for (const value of earlierValues) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(20);
  }
  // The built-in default focus is within 10, so a value above 10 shows the
  // earlier setting reached the generator.
  expect(Math.max(...earlierValues)).toBeGreaterThan(10);
  expect((await appServer.readRaw()).equals(childrenV1FixtureBytes)).toBe(true);
  expect(await appServer.backupNames()).toEqual([]);

  // The first explicit save is the worksheet-defaults save: it upgrades the
  // file behind one byte-identical backup and ends seeding.
  const defaultsSaved = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/config",
  );
  await page.getByRole("button", { name: "Save these as worksheet defaults", exact: true }).click();
  expect((await defaultsSaved).status()).toBe(200);
  await expect(page.getByText("Worksheet defaults saved locally.", { exact: true })).toBeVisible();
  await expect(notice).toHaveText("");
  const backupNames = await appServer.backupNames();
  expect(backupNames).toHaveLength(1);
  expect(backupNames[0]).toMatch(V1_BACKUP_NAME);
  const backups = await appServer.backupContents();
  expect(backups).toHaveLength(1);
  expect(backups[0]?.equals(childrenV1FixtureBytes)).toBe(true);

  const raw: unknown = JSON.parse((await appServer.readRaw()).toString("utf8"));
  const live = AppConfigV2Schema.parse(raw);
  expect(retiredKeysAnywhere(raw)).toEqual([]);
  expect(live.profiles).toEqual(upgradedProfiles);
  expect(live.defaults.useEarlierChildSettings).toBe(false);
  expect(live.defaults.worksheetType).toBe("dry-math");
  expect(live.defaults.dryMath).toEqual({ operations: ["addition", "subtraction"], operandMax: 20, resultMax: 20 });
  expect([live.defaults.paperSize, live.defaults.printScale]).toEqual(["letter", "standard"]);

  // A restart reads version 2: no notice, no second backup, and the saved
  // defaults come back as the starting selection.
  await appServer.restart();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
  await expect(notice).toHaveText("");
  expect(await appServer.backupNames()).toEqual(backupNames);
  await expect(controls(page).worksheetCard("dry-math")).toBeChecked();
  await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
    "Addition and subtraction within 20",
  );
  await expect(page.locator("[data-earlier-settings-used]")).toHaveCount(0);
  expect((await appServer.readConfig()).defaults).toEqual(live.defaults);

  /** Prints the current surface at the saved Letter/standard layout and counts its pages. */
  async function printedPages(surface: "worksheet" | "answer"): Promise<number> {
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(`.print-surface[data-surface="${surface}"]`)).toBeVisible();
    const pages = (await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }))).getPageCount();
    await page.emulateMedia({ media: "screen" });
    return pages;
  }

  /** Creates the current selection and returns its preview. */
  async function createSheet(worksheetType: typeof families[number]) {
    await create.click();
    const sheet = page.getByLabel("Worksheet preview");
    await expect(sheet).toHaveAttribute("data-worksheet-type", worksheetType);
    return sheet;
  }

  // Every worksheet-first choice, made in the panel with no profile edit.
  await chooseChild(page, withinTwenty.id);
  await chooseWorksheet(page, "sentence-builder");
  await chooseVariant(page, "copy-with-model");
  for (const vocabulary of ["simpler-words", "all-words"] as const) {
    await chooseVocabulary(page, vocabulary);
    const sheet = await createSheet("sentence-builder");
    await expect(sheet.locator('[data-writing-mode="copy-with-model"]')).toHaveCount(1);
  }
  expect(await printedPages("worksheet")).toBe(1);
  await expect(page.getByRole("button", { name: "Parent answer key", exact: true })).toHaveCount(0);

  await chooseWorksheet(page, "dry-math");
  await choosePracticeFocus(page, "Addition and subtraction within 100");
  await setAnswerKey(page, true);
  const dryMath = await createSheet("dry-math");
  const answers = new Map<string, number>();
  const withinHundred: number[] = [];
  for (const { id, text } of await dryMath.locator("[data-item-id]").evaluateAll((nodes) =>
    nodes.map((node) => ({ id: node.getAttribute("data-item-id") ?? "", text: node.textContent ?? "" })),
  )) {
    const { left, right, answer } = dryMathValues(text);
    for (const value of [left, right, answer]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    withinHundred.push(left, right, answer);
    answers.set(id, answer);
  }
  expect(answers.size).toBeGreaterThan(0);
  // The saved focus is within 20, so a value above 20 shows the new focus
  // reached the generator.
  expect(Math.max(...withinHundred)).toBeGreaterThan(20);
  expect(await printedPages("worksheet")).toBe(1);
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  const keyed = await page.locator(".print-surface [data-item-id]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-item-id") ?? "",
      value: Number(node.querySelector("[data-answer-value]")?.getAttribute("data-answer-value")),
    })),
  );
  expect(keyed).toHaveLength(answers.size);
  for (const { id, value } of keyed) expect(value).toBe(answers.get(id));
  expect(await printedPages("answer")).toBe(1);

  await chooseWorksheet(page, "find-the-wow");
  for (const variant of ["quantity", "equation"] as const) {
    await chooseVariant(page, variant);
    const wow = await createSheet("find-the-wow");
    const groups = await wow.locator("[data-item-id]").count();
    expect(groups).toBeGreaterThan(0);
    expect(await wow.locator(`[data-wow-mode="${variant}"]`).count()).toBe(groups);
  }
  expect(await printedPages("worksheet")).toBe(1);
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  expect(await printedPages("answer")).toBe(1);

  await chooseWorksheet(page, "count-compare-make");
  const count = await createSheet("count-compare-make");
  expect(await count.locator("[data-item-id]").count()).toBeGreaterThan(0);
  expect(await printedPages("worksheet")).toBe(1);
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  expect(await printedPages("answer")).toBe(1);

  // Choosing and creating never wrote the file: the saved defaults and every
  // profile's identity fields and earlier settings are as the upgrade left them.
  expect(AppConfigV2Schema.parse(JSON.parse((await appServer.readRaw()).toString("utf8")))).toEqual(live);
  expect(await appServer.backupNames()).toEqual(backupNames);
  await expectPrivateBrowser(page, appServer.origin);
  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(appServer.serverErrors()).toEqual([]);
  // The defaults save was the only write request.
  expect(puts).toEqual(["/api/config"]);
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    const parsed = new URL(url);
    expect(parsed.origin).toBe(appServer.origin);
    expect(parsed.hostname).toBe("127.0.0.1");
  }
});

test("compiled Dry Math page on which every problem carries or borrows: create, key and print", async ({ appServer, page, context }) => {
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
  const focus = PRACTICE_FOCUS_CATALOG["dry-math"].find(({ id }) => id === "addition-and-subtraction-within-100");
  if (focus === undefined) throw new Error("The within-100 catalog focus is missing.");

  await page.goto(appServer.origin);
  await chooseChild(page, child.id);
  await chooseWorksheet(page, "dry-math");
  await choosePracticeFocus(page, focus.label);
  await chooseRegrouping(page, "required");
  await chooseLength(page, "long");
  await page.getByRole("button", { name: "Create worksheet", exact: true }).click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "dry-math");
  const seed = await preview.getAttribute("data-seed");
  expect(seed).toMatch(/^(?!00000000)[\da-f]{8}$/u);

  // The compiled page equals the source projection and generator for the same
  // selection and seed.
  const projected = projectGenerationRequest({
    profile: child,
    selection: {
      ...worksheetSelectionOf(acceptanceConfig.defaults),
      worksheetType: "dry-math",
      dryMath: focus.focus,
      dryMathRegrouping: "required",
      length: "long",
    },
    generatorVersion: 1,
    seed: seed ?? "",
  });
  if (!projected.ok) throw new Error(projected.message);
  const expected = generateDryMath(projected.request, { worksheetId: "11111111-1111-4111-8111-111111111111" });
  if (!expected.ok) throw new Error(expected.message);
  const rows = await preview.locator("[data-item-id]").evaluateAll((items) =>
    items.map((item) => ({ id: item.getAttribute("data-item-id") ?? "", text: item.textContent?.trim() ?? "" })),
  );
  expect(rows).toEqual(expected.document.items.map((item) => ({
    id: item.id,
    text: item.itemType === "dry-math" ? `${item.leftOperand} ${item.renderedSymbol} ${item.rightOperand} = ____` : "",
  })));

  for (const surface of ["worksheet", "answer"] as const) {
    if (surface === "answer") await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
    const printed = page.locator(`.print-surface[data-surface="${surface}"]`);
    await page.emulateMedia({ media: "print" });
    await expect(printed).toBeVisible();
    const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
    expect(pdf.getPageCount()).toBe(1);
    await page.emulateMedia({ media: "screen" });
  }
  const keyLines = await page.locator(".print-surface[data-surface='answer'] [data-item-id]").evaluateAll((items) =>
    items.map((item) => ({
      id: item.getAttribute("data-item-id") ?? "",
      source: item.querySelector("[data-source-expression]")?.getAttribute("data-source-expression") ?? "",
      answer: item.querySelector("[data-answer-value]")?.getAttribute("data-answer-value") ?? "",
      text: item.textContent?.trim() ?? "",
    })),
  );
  expect(judgeRenderedPage(rows, keyLines, {
    operations: ["addition", "subtraction"],
    operandMax: 100,
    resultMax: 100,
    regrouping: "required",
  })).toEqual([]);

  // Creating the page wrote nothing, and nothing left the local origin.
  expect((await appServer.readRaw()).equals(seeded)).toBe(true);
  await expectPrivateBrowser(page, appServer.origin);
  expect(consoleMessages).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const url of requests) expect(new URL(url).origin).toBe(appServer.origin);
});
