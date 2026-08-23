import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import type {
  AppConfigV1,
  ChildProfileV1,
  WritingMode,
} from "../../src/shared/config/schema.js";
import { expect, test } from "./fixtures/app-server.js";

const defaults: AppConfigV1["defaults"] = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

const canonicalProfiles = [
  {
    id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
    displayName: "Riley",
    ageYears: 4,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 10,
      numeralMax: 10,
      compareMax: 10,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "label",
    interests: ["animals", "space"],
  },
  {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Morgan",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 10,
      resultMax: 10,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["nature", "vehicles"],
  },
  {
    id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
    displayName: "Avery",
    ageYears: 8,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 20,
      resultMax: 20,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "independent",
    interests: ["sports", "nature"],
  },
] as const satisfies readonly ChildProfileV1[];

const disposableId = "11111111-1111-4111-8111-111111111111";

interface BrowserConsoleEntry {
  location: {
    columnNumber: number;
    lineNumber: number;
    url: string;
  };
  text: string;
  type: string;
}

async function installCanonicalUuids(page: Page): Promise<void> {
  await page.addInitScript(
    (ids: readonly string[]) => {
      let next = 0;
      Object.defineProperty(Crypto.prototype, "randomUUID", {
        configurable: true,
        value: () => ids[next++] ?? "22222222-2222-4222-8222-222222222222",
      });
    },
    [...canonicalProfiles.map(({ id }) => id), disposableId],
  );
}

async function createProfile(
  page: Page,
  profile: ChildProfileV1,
  first: boolean,
): Promise<void> {
  await page.getByRole("button", {
    name: first ? "Create first profile" : "Add profile",
  }).click();
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill(profile.displayName ?? "");
  await page.getByRole("spinbutton", { name: "Age in years" }).fill(String(profile.ageYears));
  await page.getByRole("button", { name: "Confirm suggested capabilities" }).click();
  await page.getByRole("combobox", { name: "Writing mode" }).selectOption(profile.writingMode);
  await page.getByLabel("Reviewed on").fill(profile.reviewedOn);
  await page.getByRole("textbox", { name: /Broad interests/ }).fill(profile.interests.join(", "));
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("heading", { name: profile.displayName ?? `Profile age ${profile.ageYears}` }),
  ).toBeVisible();
}

async function expectNoBrowserPersistence(page: Page): Promise<void> {
  const state = (await page.evaluate(`(async () => ({
    cacheKeys: await caches.keys(),
    indexedDatabases: await indexedDB.databases(),
    localStorageLength: localStorage.length,
    serviceWorkers: await navigator.serviceWorker.getRegistrations(),
    sessionStorageLength: sessionStorage.length,
  }))()`)) as {
    cacheKeys: unknown[];
    indexedDatabases: unknown[];
    localStorageLength: number;
    serviceWorkers: unknown[];
    sessionStorageLength: number;
  };
  expect(state).toEqual({
    cacheKeys: [],
    indexedDatabases: [],
    localStorageLength: 0,
    serviceWorkers: [],
    sessionStorageLength: 0,
  });
}

async function expectAccessible(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22a",
      "wcag22aa",
    ])
    .analyze();
  expect(result.violations).toEqual([]);
}

test("creates, reloads, edits, deletes, and conflict-protects canonical profiles", async ({
  appServer,
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedMissing();
  await installCanonicalUuids(page);
  const consoleMessages: BrowserConsoleEntry[] = [];
  const pageErrors: string[] = [];
  const downloads: string[] = [];
  const requestUrls: string[] = [];
  const configPutHeaders: Array<Record<string, string>> = [];
  page.on("console", (message) => {
    const { columnNumber, lineNumber, url } = message.location();
    consoleMessages.push({
      location: { columnNumber, lineNumber, url },
      text: message.text(),
      type: message.type(),
    });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  page.on("request", (request) => {
    requestUrls.push(request.url());
    if (new URL(request.url()).pathname === "/api/config" && request.method() === "PUT") {
      configPutHeaders.push(request.headers());
    }
  });

  await page.goto(appServer.origin);
  await expect(page.getByText("Ready on this computer.", { exact: true })).toBeVisible();
  await expectAccessible(page);

  for (const [index, profile] of canonicalProfiles.entries()) {
    await createProfile(page, profile, index === 0);
  }
  await expectNoBrowserPersistence(page);
  expect(await appServer.readConfig()).toEqual({
    schemaVersion: 1,
    profiles: canonicalProfiles,
    defaults,
  });
  expect(configPutHeaders[0]?.["if-none-match"]).toBe("*");
  expect(configPutHeaders[0]?.["if-match"]).toBeUndefined();
  expect(configPutHeaders.slice(1, 3).every((headers) => /^"sha256-[0-9a-f]{64}"$/u.test(headers["if-match"] ?? ""))).toBe(true);

  const externallyChangedProfiles: ChildProfileV1[] = canonicalProfiles.map(
    (profile, index) =>
      index === 0
        ? { ...profile, displayName: "Riley from external file" }
        : { ...profile },
  );
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: externallyChangedProfiles,
    defaults,
  });
  const externalReload = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/config",
  );
  await page.getByRole("button", { name: "Reload saved profiles" }).click();
  expect((await externalReload).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Riley from external file" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Riley", exact: true })).toHaveCount(0);

  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: canonicalProfiles.map((profile) => ({ ...profile })),
    defaults,
  });
  const canonicalReload = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/config",
  );
  await page.getByRole("button", { name: "Reload saved profiles" }).click();
  expect((await canonicalReload).status()).toBe(200);
  await expect(page.getByText(/reloaded from the local file/i)).toBeVisible();
  for (const profile of canonicalProfiles) {
    await expect(page.getByRole("heading", { name: profile.displayName })).toBeVisible();
  }
  await expectNoBrowserPersistence(page);

  await page.getByRole("button", { name: "Edit Morgan" }).click();
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Morgan Updated");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Morgan Updated" })).toBeVisible();
  const edited = await appServer.readConfig();
  expect(edited.profiles[1]?.id).toBe(canonicalProfiles[1].id);
  expect(edited.profiles[1]?.displayName).toBe("Morgan Updated");
  await expectNoBrowserPersistence(page);

  await page.getByRole("button", { name: "Add profile" }).click();
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Disposable");
  await page.getByRole("spinbutton", { name: "Age in years" }).fill("5");
  await page.getByRole("radio", { name: "Emerging equations within 5" }).click();
  await expect(page.getByRole("radio", { name: "Preschool", exact: true })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Early primary", exact: true })).not.toBeChecked();
  await page.getByRole("radio", { name: "Preschool", exact: true }).click();
  await page.getByRole("combobox", { name: "Writing mode" }).selectOption("copy-with-model" satisfies WritingMode);
  await page.getByLabel("Reviewed on").fill("2026-08-22");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Disposable" })).toBeVisible();
  const withDisposable = await appServer.readConfig();
  expect(withDisposable.profiles[3]).toMatchObject({
    id: disposableId,
    ageYears: 5,
    presentationBand: "preschool",
    mathSkills: {
      countingMax: 10,
      numeralMax: 10,
      compareMax: 10,
      representations: ["quantities", "equations"],
      understandsEquality: false,
      operations: ["addition"],
      operandMax: 5,
      resultMax: 5,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
  });
  expect(JSON.stringify(withDisposable)).not.toContain("grade");

  const siblingBytes = Buffer.from("existing sibling backup remains byte-identical\n", "utf8");
  await appServer.writeSiblingBackup(siblingBytes);
  await page.getByRole("button", { name: "Delete Disposable" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toContainText("Recovery backups");
  await expect(deleteDialog).toContainText("downloads");
  await expect(deleteDialog).toContainText("saved PDFs");
  await expect(deleteDialog).toContainText("paper copies");
  await deleteDialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("heading", { name: "Disposable" })).toHaveCount(0);
  expect(await appServer.readSiblingBackup()).toEqual(siblingBytes);
  expect((await appServer.readConfig()).profiles).toHaveLength(3);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await secondPage.goto(appServer.origin);
    await expect(secondPage.getByRole("heading", { name: "Morgan Updated" })).toBeVisible();
    await page.getByRole("button", { name: "Edit Morgan Updated" }).click();
    await secondPage.getByRole("button", { name: "Edit Morgan Updated" }).click();
    await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Morgan Winner");
    await secondPage.getByRole("textbox", { name: "Nickname (optional)" }).fill("Morgan Unsaved Draft");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("heading", { name: "Morgan Winner" })).toBeVisible();

    const losingStatuses: number[] = [];
    const losingPutHeaders: Array<Record<string, string>> = [];
    secondPage.on("request", (request) => {
      if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/config") {
        losingPutHeaders.push(request.headers());
      }
    });
    secondPage.on("response", (response) => {
      if (response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/config") {
        losingStatuses.push(response.status());
      }
    });
    await secondPage.getByRole("button", { name: "Save profile" }).click();
    await expect(secondPage.getByRole("alert")).toContainText("Another tab saved newer profiles");
    await expect(secondPage.getByRole("textbox", { name: "Nickname (optional)" })).toHaveValue("Morgan Unsaved Draft");
    expect(losingStatuses).toEqual([409]);
    expect((await appServer.readConfig()).profiles[1]?.displayName).toBe("Morgan Winner");
    const winnerRaw = await appServer.readRaw();
    const winnerEtag = `"sha256-${createHash("sha256").update(winnerRaw).digest("hex")}"`;

    await secondPage.getByRole("button", {
      name: "Load latest profiles and keep this draft",
    }).click();
    await expect(secondPage.getByText(/Latest saved profiles loaded/)).toBeVisible();
    await expect(secondPage.getByRole("textbox", { name: "Nickname (optional)" })).toHaveValue("Morgan Unsaved Draft");
    expect(losingStatuses).toEqual([409]);
    expect(losingPutHeaders).toHaveLength(1);
    expect(await appServer.readRaw()).toEqual(winnerRaw);

    await secondPage.getByRole("button", { name: "Save profile" }).click();
    await expect(secondPage.getByRole("heading", { name: "Morgan Unsaved Draft" })).toBeVisible();
    expect(losingStatuses).toEqual([409, 200]);
    expect(losingPutHeaders[1]?.["if-match"]).toBe(winnerEtag);
    const reconciled = await appServer.readConfig();
    expect(reconciled.profiles).toEqual([
      canonicalProfiles[0],
      { ...canonicalProfiles[1], displayName: "Morgan Unsaved Draft" },
      canonicalProfiles[2],
    ]);
  } finally {
    await secondContext.close();
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "Morgan Unsaved Draft" })).toBeVisible();
  await expectNoBrowserPersistence(page);
  await page.setViewportSize({ width: 320, height: 900 });
  const reflow = (await page.evaluate(`({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`)) as { clientWidth: number; scrollWidth: number };
  expect(reflow.scrollWidth).toBe(reflow.clientWidth);
  await expectAccessible(page);

  expect(await page.title()).toBe("Extra Credit Worksheet");
  const finalUrl = new URL(page.url());
  expect(finalUrl.origin).toBe(appServer.origin);
  expect(finalUrl.pathname).toBe("/");
  expect(finalUrl.search).toBe("");
  expect(finalUrl.hash).toBe("");
  expect(downloads).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const message of consoleMessages) {
    expect(message).toEqual({
      location: {
        columnNumber: 0,
        lineNumber: 0,
        url: `${appServer.origin}/api/config`,
      },
      text: "Failed to load resource: the server responded with a status of 404 (Not Found)",
      type: "error",
    });
    for (const sensitiveValue of [
      ...canonicalProfiles.flatMap(({ displayName, id, interests }) => [
        displayName,
        id,
        ...interests,
      ]),
      "Morgan Winner",
      "Morgan Unsaved Draft",
      "children.local.json",
    ]) {
      expect(JSON.stringify(message)).not.toContain(sensitiveValue);
    }
  }
  expect(consoleMessages.length).toBeLessThanOrEqual(1);
  for (const requestUrl of requestUrls) {
    const url = new URL(requestUrl);
    expect(url.origin).toBe(appServer.origin);
  }
});

test("keeps an unsaved draft through a same-origin process restart and never replays a stale mutation", async ({
  appServer,
  page,
}) => {
  test.setTimeout(60_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [canonicalProfiles[1]],
    defaults,
  });
  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Morgan" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Morgan" }).click();
  const nickname = page.getByRole("textbox", { name: "Nickname (optional)" });
  await nickname.fill("Unsaved Restart Draft");
  const before = await appServer.readRaw();
  const originalUrl = page.url();
  const mutationStatuses: number[] = [];
  let sessionReads = 0;
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path === "/api/config" && response.request().method() === "PUT") {
      mutationStatuses.push(response.status());
    }
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/session" && request.method() === "GET") {
      sessionReads += 1;
    }
  });

  await appServer.restart();
  expect(page.url()).toBe(originalUrl);
  await expect(nickname).toHaveValue("Unsaved Restart Draft");
  const restartRouteStatus = await page.evaluate(async () =>
    (await fetch("/api/restart", { cache: "no-store", method: "POST" })).status,
  );
  expect(restartRouteStatus).toBe(404);

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("alert")).toContainText("server restarted");
  await expect(nickname).toHaveValue("Unsaved Restart Draft");
  expect(mutationStatuses).toEqual([401]);
  expect(sessionReads).toBe(1);
  expect(await appServer.readRaw()).toEqual(before);
  expect(mutationStatuses).toEqual([401]);

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Unsaved Restart Draft" })).toBeVisible();
  expect(mutationStatuses).toEqual([401, 200]);
  expect((await appServer.readConfig()).profiles[0]?.displayName).toBe("Unsaved Restart Draft");
  expect(page.url()).toBe(originalUrl);
});

test("requires explicit invalid-file recovery and offers only the warned generic draft download", async ({
  appServer,
  page,
}) => {
  test.setTimeout(60_000);
  const invalidRawA = Buffer.from("{invalid-profile-e2e-a", "utf8");
  const invalidRawB = Buffer.from("{invalid-profile-e2e-b", "utf8");
  await appServer.seedRaw(invalidRawA);
  const putHeaders: Array<Record<string, string>> = [];
  const putStatuses: number[] = [];
  const downloads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/config" && request.method() === "PUT") {
      putHeaders.push(request.headers());
    }
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname === "/api/config" &&
      response.request().method() === "PUT"
    ) {
      putStatuses.push(response.status());
    }
  });
  page.on("download", (download) => downloads.push(download.suggestedFilename()));

  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "The saved profile file needs attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set up a profile" })).toBeVisible();
  expect(putHeaders).toEqual([]);
  expect(downloads).toEqual([]);
  await expectAccessible(page);

  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Recovery Riley");
  await page.getByRole("spinbutton", { name: "Age in years" }).fill("4");
  await page.getByRole("button", { name: "Confirm suggested capabilities" }).click();
  await page.getByRole("combobox", { name: "Writing mode" }).selectOption("copy-with-model");
  await page.getByLabel("Reviewed on").fill("2026-08-22");
  await page.getByRole("textbox", { name: /Broad interests/ }).fill("animals, space");
  await page.getByRole("button", { name: "Back up invalid file and replace" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Confirm the backup-and-replace recovery action" }),
  ).toBeVisible();
  expect(putHeaders).toEqual([]);
  expect(await appServer.readRaw()).toEqual(invalidRawA);

  const downloadButton = page.getByRole("button", { name: "Download unsaved form" });
  await expect(downloadButton).toBeDisabled();
  await page.getByLabel(/separate local copy containing the unsaved profile/i).check();
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("extra-credit-profile-backup.json");
  const downloadedPath = await download.path();
  if (downloadedPath === null) {
    throw new Error("The explicit draft download was unavailable.");
  }
  const downloaded = JSON.parse(await readFile(downloadedPath, "utf8")) as AppConfigV1;
  expect(downloaded.profiles[0]?.displayName).toBe("Recovery Riley");
  expect((await readFile(downloadedPath)).equals(invalidRawA)).toBe(false);

  const recoveryConfirmation = page.getByLabel(
    /I understand that Back up invalid file and replace changes the live file/i,
  );
  await recoveryConfirmation.check();
  await appServer.seedRaw(invalidRawB);
  await page.getByRole("button", { name: "Back up invalid file and replace" }).click();
  await expect(
    page.getByText(/The live file is no longer the invalid revision/),
  ).toBeVisible();
  expect(putStatuses).toEqual([409]);
  expect(putHeaders).toHaveLength(1);
  expect(putHeaders[0]?.["if-match"]).toBe(
    `"sha256-${createHash("sha256").update(invalidRawA).digest("hex")}"`,
  );
  expect(putHeaders[0]?.["x-extra-credit-recovery"]).toBe("backup-and-replace");
  expect(await appServer.readRaw()).toEqual(invalidRawB);
  expect(await appServer.backupContents()).toEqual([]);

  await page.getByRole("button", {
    name: "Load latest profiles and keep this draft",
  }).click();
  await expect(page.getByText(/Latest saved profiles loaded/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nickname (optional)" })).toHaveValue(
    "Recovery Riley",
  );
  await expect(page.getByRole("spinbutton", { name: "Age in years" })).toHaveValue("4");
  await expect(page.getByRole("combobox", { name: "Writing mode" })).toHaveValue(
    "copy-with-model",
  );
  await expect(page.getByLabel("Reviewed on")).toHaveValue("2026-08-22");
  await expect(page.getByRole("textbox", { name: /Broad interests/ })).toHaveValue(
    "animals, space",
  );
  await expect(page.getByRole("radio", { name: "Quantities to 10" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Preschool", exact: true })).toBeChecked();
  await expect(recoveryConfirmation).not.toBeChecked();
  await expect(downloadButton).toBeEnabled();
  expect(putStatuses).toEqual([409]);
  expect(putHeaders).toHaveLength(1);
  expect(await appServer.readRaw()).toEqual(invalidRawB);

  await recoveryConfirmation.check();
  await page.getByRole("button", { name: "Back up invalid file and replace" }).click();
  await expect(page.getByRole("heading", { name: "Recovery Riley" })).toBeVisible();
  expect(putStatuses).toEqual([409, 200]);
  expect(putHeaders).toHaveLength(2);
  expect(putHeaders[1]?.["if-match"]).toBe(
    `"sha256-${createHash("sha256").update(invalidRawB).digest("hex")}"`,
  );
  expect(putHeaders[1]?.["x-extra-credit-recovery"]).toBe("backup-and-replace");
  const backups = await appServer.backupContents();
  expect(backups).toHaveLength(1);
  expect(backups[0]).toEqual(invalidRawB);
  expect((await appServer.readConfig()).profiles[0]?.displayName).toBe("Recovery Riley");
  expect(downloads).toEqual(["extra-credit-profile-backup.json"]);
});

test("real Vite development routing proxies only the three exact API endpoints", async ({
  developmentStack,
  request,
}) => {
  test.setTimeout(60_000);
  const markerHeader = "x-extra-credit-proxy-probe";

  const health = await request.get(`${developmentStack.origin}/api/health?probe=1`);
  expect(health.status()).toBe(200);
  expect(health.headers()[markerHeader]).toBe("fastify");

  const session = await request.get(`${developmentStack.origin}/api/session?probe=1`);
  expect(session.status()).toBe(200);
  expect(session.headers()[markerHeader]).toBe("fastify");
  const sessionBody = (await session.json()) as { readonly token?: unknown };
  expect(typeof sessionBody.token).toBe("string");

  const config = await request.get(`${developmentStack.origin}/api/config?probe=1`, {
    headers: { "X-Extra-Credit-Token": String(sessionBody.token) },
  });
  expect(config.status()).toBe(404);
  expect(config.headers()[markerHeader]).toBe("fastify");
  expect(await config.json()).toMatchObject({
    error: { code: "CONFIG_NOT_FOUND" },
  });

  const exactBackendRequests = developmentStack.backendRequests();
  expect(exactBackendRequests).toEqual([
    { method: "GET", url: "/api/health?probe=1" },
    { method: "GET", url: "/api/session?probe=1" },
    { method: "GET", url: "/api/config?probe=1" },
  ]);

  for (const suffixPath of [
    "/api/healthcheck",
    "/api/session/extra",
    "/api/config/extra",
    "/api/config-client.ts",
  ]) {
    const response = await request.get(`${developmentStack.origin}${suffixPath}`);
    expect(response.headers()[markerHeader]).toBeUndefined();
  }
  expect(developmentStack.backendRequests()).toEqual(exactBackendRequests);

  const source = await request.get(`${developmentStack.origin}/api/client.ts?probe=1`);
  expect(source.status()).toBe(200);
  expect(source.headers()[markerHeader]).toBeUndefined();
  expect(source.headers()["content-type"]).toContain("javascript");
  expect(await source.text()).toContain("loadConfig");
  expect(developmentStack.backendRequests()).toEqual(exactBackendRequests);
});
