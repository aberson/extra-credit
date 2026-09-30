import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { emptyAppConfigV2 } from "../../src/shared/config/defaults.js";
import type {
  AppConfigV2,
  ChildProfileV2,
} from "../../src/shared/config/schema.js";
import {
  childrenV1FixtureBytes,
  isIdentityOnlyProfile,
} from "../fixtures/profiles.js";
import { expect, test } from "./fixtures/app-server.js";
import {
  chooseVariant,
  chooseWorksheet,
  choosePracticeFocus,
  controls,
} from "./fixtures/worksheet-controls.js";

/** The three canonical fictional children, identity-only as the example stores them. */
const canonicalProfiles = [
  {
    id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
    displayName: "Riley",
    reviewedOn: "2026-08-22",
    interests: ["animals", "space"],
  },
  {
    id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
    displayName: "Morgan",
    reviewedOn: "2026-08-22",
    interests: ["nature", "vehicles"],
  },
  {
    id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
    displayName: "Avery",
    reviewedOn: "2026-08-22",
    interests: ["sports", "nature"],
  },
] as const satisfies readonly ChildProfileV2[];

/** A stored copy of a canonical child: identity fields only, arrays unshared. */
function storedProfile(profile: ChildProfileV2): ChildProfileV2 {
  return { ...profile, interests: [...profile.interests] };
}

/** The config a missing file's first saves create: built-in defaults, version 2. */
function createdConfig(profiles: readonly ChildProfileV2[]): AppConfigV2 {
  return { ...emptyAppConfigV2(), profiles: profiles.map(storedProfile) };
}

const disposableId = "11111111-1111-4111-8111-111111111111";

/** The upgrade notice, verbatim (U11); the only parent-visible text naming age. */
const UPGRADE_NOTICE_TEXT =
  "This profile file was saved by an earlier version. Your profiles are shown unchanged; the next save updates the file and keeps a copy of the earlier file beside it. Age is no longer used, and Practice focus replaces Difficulty. A saved Difficulty of Confidence or Stretch no longer applies; each practice focus uses exactly its stated range.";

const V1_BACKUP_NAME = /^children\.local\.json\.v1-\d{8}T\d{6}Z-[0-9a-f]{8}\.bak$/u;

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

/**
 * The open profile form holds exactly the three identity fields, with no age,
 * preset, writing-mode, vocabulary or math control.
 */
async function expectIdentityFieldsOnly(page: Page): Promise<void> {
  const form = page.locator('form[aria-labelledby="profile-editor-title"]');
  await expect(form).toHaveCount(1);
  expect(await form.locator("input, select, textarea").evaluateAll((controls) =>
    controls.map((control) => control.closest("label")?.firstChild?.textContent?.trim() ?? ""),
  )).toEqual([
    "Nickname (optional)",
    "Reviewed on",
    "Broad interests (optional, separated by commas)",
  ]);
  for (const role of ["radio", "combobox", "spinbutton", "checkbox"] as const) {
    await expect(form.getByRole(role)).toHaveCount(0);
  }
}

async function createProfile(
  page: Page,
  profile: ChildProfileV2,
  first: boolean,
): Promise<void> {
  await page.getByRole("button", {
    name: first ? "Create first profile" : "Add profile",
  }).click();
  await expectIdentityFieldsOnly(page);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill(profile.displayName ?? "");
  await expect(page.getByRole("spinbutton", { name: /\bages?\b/iu })).toHaveCount(0);
  await page.getByLabel("Reviewed on").fill(profile.reviewedOn);
  await page.getByRole("textbox", { name: /Broad interests/ }).fill(profile.interests.join(", "));
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("heading", { name: profile.displayName ?? "Profile" }),
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
  expect(await appServer.readConfig()).toEqual(createdConfig(canonicalProfiles));
  expect(JSON.parse((await appServer.readRaw()).toString("utf8"))).toEqual(
    createdConfig(canonicalProfiles),
  );
  expect(configPutHeaders[0]?.["if-none-match"]).toBe("*");
  expect(configPutHeaders[0]?.["if-match"]).toBeUndefined();
  expect(configPutHeaders.slice(1, 3).every((headers) => /^"sha256-[0-9a-f]{64}"$/u.test(headers["if-match"] ?? ""))).toBe(true);

  const externallyChangedProfiles: ChildProfileV2[] = canonicalProfiles.map(
    (profile, index) =>
      index === 0
        ? { ...profile, displayName: "Riley from external file" }
        : { ...profile },
  );
  await appServer.seedConfig(createdConfig(externallyChangedProfiles));
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

  await appServer.seedConfig(createdConfig(canonicalProfiles));
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
  await expectIdentityFieldsOnly(page);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Morgan Updated");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Morgan Updated" })).toBeVisible();
  const edited = await appServer.readConfig();
  expect(edited.profiles[1]?.id).toBe(canonicalProfiles[1].id);
  expect(edited.profiles[1]?.displayName).toBe("Morgan Updated");
  await expectNoBrowserPersistence(page);

  await page.getByRole("button", { name: "Add profile" }).click();
  await expectIdentityFieldsOnly(page);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Disposable");
  await page.getByLabel("Reviewed on").fill("2026-08-22");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Disposable" })).toBeVisible();
  const withDisposable = await appServer.readConfig();
  expect(withDisposable.profiles[3]).toEqual({
    id: disposableId,
    displayName: "Disposable",
    reviewedOn: "2026-08-22",
    interests: [],
  });
  expect(withDisposable.profiles.every(isIdentityOnlyProfile)).toBe(true);
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
      storedProfile(canonicalProfiles[0]),
      { ...storedProfile(canonicalProfiles[1]), displayName: "Morgan Unsaved Draft" },
      storedProfile(canonicalProfiles[2]),
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
  await appServer.seedConfig(createdConfig([canonicalProfiles[1]]));
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

  // Before any confirmation, the panel states what stays only in the backup.
  // The client never receives the invalid bytes, so the text names no profile.
  const disclosure = page.locator("[data-recovery-disclosure]");
  await expect(disclosure).toHaveText(
    "The replacement file keeps only the one profile entered below, with the built-in worksheet defaults. Every other profile, the saved worksheet defaults and all earlier settings stay only in the backup file.",
  );
  const downloadCopy = await page.getByText(/Optional draft download/u).textContent();
  expect(downloadCopy ?? "").not.toMatch(/\bages?\b/iu);
  expect(downloadCopy ?? "").not.toMatch(/capabilit/iu);

  await expectIdentityFieldsOnly(page);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Recovery Riley");
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
  const downloaded = JSON.parse(await readFile(downloadedPath, "utf8")) as AppConfigV2;
  expect(downloaded.schemaVersion).toBe(2);
  expect(downloaded.profiles).toHaveLength(1);
  expect(downloaded.profiles[0]?.displayName).toBe("Recovery Riley");
  expect(downloaded.profiles[0]).not.toHaveProperty("ageYears");
  expect(downloaded.profiles[0]).not.toHaveProperty("legacyChoices");
  expect(isIdentityOnlyProfile(downloaded.profiles[0])).toBe(true);
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
  await expect(page.getByLabel("Reviewed on")).toHaveValue("2026-08-22");
  await expect(page.getByRole("textbox", { name: /Broad interests/ })).toHaveValue(
    "animals, space",
  );
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
  expect((await appServer.readConfig()).profiles.every(isIdentityOnlyProfile)).toBe(true);
  expect(downloads).toEqual(["extra-credit-profile-backup.json"]);
});

test("upgrades a version 1 file only on the first explicit save, behind one byte-identical backup", async ({
  appServer,
  page,
}) => {
  test.setTimeout(60_000);
  const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
  await appServer.seedRaw(childrenV1FixtureBytes);
  const seededDigest = sha256(childrenV1FixtureBytes);
  const seeded = await appServer.readConfig();
  const identity = (config: AppConfigV2) =>
    config.profiles.map(({ id, displayName, interests, reviewedOn }) => ({
      id,
      displayName,
      interests,
      reviewedOn,
    }));

  await page.goto(appServer.origin);
  const notice = page.locator("[data-upgrade-notice]");
  await expect(notice).toHaveText(UPGRADE_NOTICE_TEXT);
  await expect(notice).toHaveAttribute("aria-live", "polite");
  await expect(notice).not.toHaveAttribute("role");

  // Reading never writes, however often the page loads the file.
  await page.reload();
  await expect(notice).toHaveText(UPGRADE_NOTICE_TEXT);
  expect(sha256(await appServer.readRaw())).toBe(seededDigest);
  expect(await appServer.backupContents()).toEqual([]);

  // One explicit save upgrades the file and ends the notice.
  const [first] = seeded.profiles;
  if (first?.displayName === undefined) {
    throw new Error("The v1 fixture's first profile has no nickname.");
  }
  await page.getByRole("button", { name: `Edit ${first.displayName}`, exact: true }).click();
  // A migrated child shows its earlier settings read-only beside the three
  // identity fields.
  await expectIdentityFieldsOnly(page);
  const summary = page.getByRole("region", { name: "Earlier settings" });
  await expect(summary).toBeVisible();
  await expect(summary.locator("dt")).toHaveText(["Writing activity", "Vocabulary", "Two Whats and a Wow", "Count, Compare & Make"]);
  await expect(summary.locator("dd").first()).toHaveText("Picture Labels");
  for (const role of ["textbox", "radio", "combobox", "spinbutton", "checkbox", "button"] as const) {
    await expect(summary.getByRole(role)).toHaveCount(0);
  }
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Upgraded Nickname");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("heading", { name: "Upgraded Nickname" })).toBeVisible();
  await expect(notice).toHaveText("");
  const backupNames = await appServer.backupNames();
  expect(backupNames).toHaveLength(1);
  expect(backupNames[0]).toMatch(V1_BACKUP_NAME);
  const backups = await appServer.backupContents();
  expect(backups).toHaveLength(1);
  expect(backups[0]?.equals(childrenV1FixtureBytes)).toBe(true);
  const upgraded = await appServer.readConfig();
  expect(JSON.parse((await appServer.readRaw()).toString("utf8")).schemaVersion).toBe(2);
  expect(identity(upgraded)).toEqual(
    identity({
      ...seeded,
      profiles: seeded.profiles.map((profile, index) =>
        index === 0 ? { ...profile, displayName: "Upgraded Nickname" } : profile,
      ),
    }),
  );
  expect(upgraded.profiles.map(({ legacyChoices }) => legacyChoices)).toEqual(
    seeded.profiles.map(({ legacyChoices }) => legacyChoices),
  );

  // A restart reads version 2: no notice, the same profiles, still one backup.
  await appServer.restart();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Upgraded Nickname" })).toBeVisible();
  await expect(notice).toHaveText("");
  expect(identity(await appServer.readConfig())).toEqual(identity(upgraded));
  expect(await appServer.backupNames()).toEqual(backupNames);
});

test("keeps the chosen writing activity and practice focus across a profile save", async ({
  appServer,
  page,
}) => {
  test.setTimeout(60_000);
  await appServer.seedConfig(createdConfig(canonicalProfiles));
  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Create a practice worksheet" })).toBeVisible();
  await chooseWorksheet(page, "sentence-builder");
  await chooseVariant(page, "copy-with-model");
  await chooseWorksheet(page, "dry-math");
  await choosePracticeFocus(page, "Addition and subtraction within 100");
  const before = await appServer.readRaw();

  const [edited] = canonicalProfiles;
  await page.getByRole("button", { name: `Edit ${edited.displayName}`, exact: true }).click();
  await expectIdentityFieldsOnly(page);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Renamed Child");
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/config",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Renamed Child" })).toBeVisible();

  // The save wrote only the renamed identity-only profile; the worksheet
  // choices stayed session state and are still the ones chosen.
  const stored = await appServer.readConfig();
  expect(stored.profiles.every(isIdentityOnlyProfile)).toBe(true);
  expect(stored.defaults).toEqual(JSON.parse(before.toString("utf8")).defaults);
  await expect(controls(page).worksheetCard("dry-math")).toBeChecked();
  await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
    "Addition and subtraction within 100",
  );
  await chooseWorksheet(page, "sentence-builder");
  await expect(
    controls(page).writingActivity().getByRole("radio", { name: "Copy a Sentence", exact: true }),
  ).toBeChecked();
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
