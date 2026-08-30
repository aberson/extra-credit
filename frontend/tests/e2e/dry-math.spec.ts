import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import type {
  AppConfigV1,
  ChildProfileV1,
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

const profiles = [
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
      understandsEquality: false,
      operations: ["addition", "subtraction"],
      operandMax: 10,
      resultMax: 10,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["Distinctive Private Nature", "vehicles"],
  },
  {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Jordan",
    ageYears: 9,
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
    interests: ["sports"],
  },
] as const satisfies readonly ChildProfileV1[];

function hasCarry(left: number, right: number): boolean {
  while (left > 0 || right > 0) {
    if ((left % 10) + (right % 10) >= 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

function hasBorrow(left: number, right: number): boolean {
  while (left > 0 || right > 0) {
    if (left % 10 < right % 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

interface ProblemRow {
  readonly id: string | null;
  readonly text: string;
}

function validateProblemRows(rows: readonly ProblemRow[]): Map<string, number> {
  const answers = new Map<string, number>();
  for (const row of rows) {
    const match = row.text.match(/(\d+)\s*([+−])\s*(\d+)\s*=\s*_+/u);
    expect(match).not.toBeNull();
    if (match === null || row.id === null) {
      throw new Error("A Dry Math problem did not use the reviewed symbol model.");
    }
    const left = Number(match[1]);
    const right = Number(match[3]);
    const addition = match[2] === "+";
    const answer = addition ? left + right : left - right;
    expect(left).toBeLessThanOrEqual(10);
    expect(right).toBeLessThanOrEqual(10);
    expect(answer).toBeGreaterThanOrEqual(0);
    expect(answer).toBeLessThanOrEqual(10);
    expect(addition ? hasCarry(left, right) : hasBorrow(left, right)).toBe(false);
    answers.set(row.id, answer);
  }
  expect(new Set(rows.map(({ text }) => text)).size).toBe(rows.length);
  return answers;
}

test("creates, keys, varies, and prints Dry Math through the real local UI", async ({
  appServer,
  page,
}) => {
  test.setTimeout(60_000);
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  const requestUrls: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const downloads: string[] = [];
  page.on("request", (request) => requestUrls.push(request.url()));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.addInitScript(() => {
    const browser = globalThis as unknown as {
      __extraCreditFixedSeed?: number;
      __extraCreditSeedDraws?: number;
    };
    browser.__extraCreditFixedSeed = 1;
    browser.__extraCreditSeedDraws = 0;
    const browserCrypto = (globalThis as unknown as {
      crypto: {
        getRandomValues: (array: ArrayBufferView) => ArrayBufferView;
      };
    }).crypto;
    const original = browserCrypto.getRandomValues.bind(browserCrypto);
    Object.defineProperty(Crypto.prototype, "getRandomValues", {
      configurable: true,
      value(array: ArrayBufferView | null): ArrayBufferView | null {
        if (array instanceof Uint32Array) {
          browser.__extraCreditSeedDraws =
            (browser.__extraCreditSeedDraws ?? 0) + 1;
          array[0] = browser.__extraCreditFixedSeed ?? 1;
          return array;
        }
        if (array === null) {
          throw new TypeError("A random buffer is required.");
        }
        return original(array);
      },
    });
  });

  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Riley" })).toBeVisible();
  const reloadStatus = page.getByText(
    "Saved profiles reloaded from the local file.",
  );
  await expect(reloadStatus).toBeVisible();
  const profileSelect = page.getByRole("combobox", { name: "Child profile" });
  const createButton = page.getByRole("button", { name: "Create worksheet" });

  await expect(
    page.getByText(/Dry Math needs equations and an enabled operation/),
  ).toBeVisible();
  await expect(page.getByText(/Choose another supported profile/)).toBeVisible();
  await expect(
    page.getByText(/Count, Compare & Make offers quantity practice/),
  ).toBeVisible();
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);
  await expect(createButton).toBeDisabled();

  await profileSelect.selectOption(profiles[2].id);
  await expect(
    page.getByText(/Version 1 worksheets support ages 4–8/),
  ).toBeVisible();
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);
  await expect(createButton).toBeDisabled();

  await profileSelect.selectOption(profiles[1].id);
  await expect(createButton).toBeEnabled();
  await expect(
    page.getByText("This selection creates 12 unique problems on one practice page."),
  ).toBeVisible();
  await page.getByText("More options").click();
  const lengthSelect = page.getByRole("combobox", { name: "Length" });
  const printScaleSelect = page.getByRole("combobox", { name: "Print scale" });
  await printScaleSelect.selectOption("large");
  await expect(
    lengthSelect.locator('option[value="standard"]'),
  ).toHaveText("Standard · 8 problems");
  await expect(lengthSelect.locator('option[value="long"]')).toHaveText(
    "Long · 12 problems",
  );
  await expect(
    page.getByText("This selection creates 8 unique problems on one practice page."),
  ).toBeVisible();
  await printScaleSelect.selectOption("standard");
  await expect(
    page.getByText("This selection creates 12 unique problems on one practice page."),
  ).toBeVisible();
  await expect(page.getByLabel(/interest/i)).toHaveCount(0);
  await expect(page.getByLabel(/decorative/i)).toHaveCount(0);
  await page.getByLabel("Put the nickname in the worksheet header").uncheck();
  await createButton.click();
  await expect(page.getByText(/Worksheet ready with 12 unique problems/)).toBeVisible();

  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toBeVisible();
  const worksheetSurfaceButton = page.getByRole("button", {
    name: "Worksheet",
    exact: true,
  });
  const answerKeySurfaceButton = page.getByRole("button", {
    name: "Parent answer key",
  });
  await expect(worksheetSurfaceButton).toHaveAttribute("aria-pressed", "true");
  await expect(worksheetSurfaceButton).toHaveAttribute("data-selected", "true");
  await expect(worksheetSurfaceButton).toHaveCSS(
    "background-color",
    "rgb(36, 50, 74)",
  );
  await expect(worksheetSurfaceButton).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(answerKeySurfaceButton).toHaveAttribute("aria-pressed", "false");
  await expect(answerKeySurfaceButton).toHaveAttribute("data-selected", "false");
  const problemItems = preview.getByRole("listitem");
  await expect(problemItems).toHaveCount(12);
  const seed = await preview.getAttribute("data-seed");
  expect(seed).toBe("00000001");
  if (seed === null) {
    throw new Error("The generated worksheet seed was not exposed for reproduction.");
  }
  const problemRows = await problemItems.evaluateAll((items) =>
    items.map((item) => ({
      id: item.getAttribute("data-item-id"),
      text: item.textContent?.trim() ?? "",
    })),
  );
  validateProblemRows(problemRows);
  await expect(preview).not.toContainText("Morgan");
  await expect(preview).not.toContainText("Distinctive Private Nature");

  const originalProblems = problemRows.map(({ text }) => text);
  await page.evaluate(() => {
    const testWindow = globalThis as unknown as {
      __extraCreditFixedSeed?: number;
      __extraCreditSeedDraws?: number;
    };
    testWindow.__extraCreditFixedSeed = 2;
    testWindow.__extraCreditSeedDraws = 0;
  });
  const makeAnother = page.getByRole("button", { name: "Make another" });
  await makeAnother.click();
  await expect(page.getByText("A different worksheet is ready.")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { __extraCreditSeedDraws?: number })
          .__extraCreditSeedDraws,
    ),
  ).toBe(1);
  await expect(preview).toHaveAttribute("data-seed", "00000002");
  const changedProblemRows = await preview.getByRole("listitem").evaluateAll((items) =>
    items.map((item) => ({
      id: item.getAttribute("data-item-id"),
      text: item.textContent?.trim() ?? "",
    })),
  );
  expect(changedProblemRows).toHaveLength(12);
  expect(changedProblemRows.map(({ id }) => id)).toEqual(
    problemRows.map(({ id }) => id),
  );
  expect(changedProblemRows.map(({ text }) => text)).not.toEqual(originalProblems);
  const answers = validateProblemRows(changedProblemRows);

  await page.evaluate(() => {
    const testWindow = globalThis as unknown as {
      __extraCreditFixedSeed?: number;
      __extraCreditSeedDraws?: number;
    };
    testWindow.__extraCreditFixedSeed = 2;
    testWindow.__extraCreditSeedDraws = 0;
  });
  await makeAnother.click();
  await expect(page.getByText(/No different worksheet was found in 16 attempts/)).toBeVisible();
  await expect(makeAnother).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { __extraCreditSeedDraws?: number })
          .__extraCreditSeedDraws,
    ),
  ).toBe(16);
  expect(
    await preview.getByRole("listitem").evaluateAll((items) =>
      items.map((item) => item.textContent?.trim() ?? ""),
    ),
  ).toEqual(changedProblemRows.map(({ text }) => text));

  await answerKeySurfaceButton.click();
  await expect(answerKeySurfaceButton).toHaveAttribute("aria-pressed", "true");
  await expect(answerKeySurfaceButton).toHaveAttribute("data-selected", "true");
  await expect(answerKeySurfaceButton).toHaveCSS(
    "background-color",
    "rgb(36, 50, 74)",
  );
  await expect(worksheetSurfaceButton).toHaveAttribute("aria-pressed", "false");
  await expect(worksheetSurfaceButton).toHaveAttribute("data-selected", "false");
  const answerSurface = page.locator(".print-surface[data-surface='answer']");
  await expect(answerSurface).toBeVisible();
  await expect(
    answerSurface.getByText("Answers match the numbered problems on the worksheet."),
  ).toBeVisible();
  const sourceExpressions = new Map(
    changedProblemRows.map(({ id, text }) => [
      id,
      text.replace(/\s*=\s*_+\s*$/u, ""),
    ]),
  );
  const keyRows = await answerSurface.getByRole("listitem").evaluateAll((items) =>
    items.map((item) => ({
      answer: item
        .querySelector("[data-answer-value]")
        ?.getAttribute("data-answer-value"),
      id: item.getAttribute("data-item-id"),
      number: item
        .querySelector("[data-problem-number]")
        ?.getAttribute("data-problem-number"),
      source: item
        .querySelector("[data-source-expression]")
        ?.getAttribute("data-source-expression"),
      text: item.textContent?.trim() ?? "",
    })),
  );
  expect(keyRows.map(({ id }) => id)).toEqual(
    changedProblemRows.map(({ id }) => id),
  );
  for (const [index, keyRow] of keyRows.entries()) {
    if (keyRow.id === null) {
      throw new Error("An answer-key row had no source item ID.");
    }
    expect(keyRow.number).toBe(String(index + 1));
    expect(keyRow.source).toBe(sourceExpressions.get(keyRow.id));
    expect(keyRow.answer).toBe(String(answers.get(keyRow.id)));
    expect(keyRow.text).toBe(
      `${index + 1}. ${String(keyRow.source)} = ${keyRow.answer}`,
    );
    expect(keyRow.text).not.toContain(keyRow.id);
  }
  await expect(answerSurface).not.toContainText("Morgan");
  await expect(answerSurface).not.toContainText("Distinctive Private Nature");

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".profile-workspace")).toBeHidden();
  const printControls = page.locator(".print-controls");
  await expect(printControls).toHaveCount(3);
  await expect(printControls.nth(0)).toBeHidden();
  await expect(printControls.nth(1)).toBeHidden();
  await expect(printControls.nth(2)).toBeHidden();
  await expect(reloadStatus).toBeHidden();
  await expect(answerSurface).toBeVisible();
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await page.emulateMedia({ media: "screen" });
  await worksheetSurfaceButton.click();
  await expect(worksheetSurfaceButton).toHaveAttribute("data-selected", "true");
  await expect(answerKeySurfaceButton).toHaveAttribute("data-selected", "false");
  await expect(page.getByLabel("Worksheet preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parent answer key" })).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByLabel("Worksheet preview")).toBeVisible();
  await expect(printControls.nth(0)).toBeHidden();
  await expect(printControls.nth(1)).toBeHidden();
  await expect(printControls.nth(2)).toBeHidden();
  await expect(reloadStatus).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await answerKeySurfaceButton.click();

  await page.evaluate(() => {
    const testWindow = globalThis as unknown as {
      __extraCreditPrinted?: boolean;
      print: () => void;
    };
    testWindow.__extraCreditPrinted = false;
    testWindow.print = () => {
      testWindow.__extraCreditPrinted = true;
    };
  });
  await page.getByRole("button", { name: "Print current page" }).click();
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { __extraCreditPrinted?: boolean })
          .__extraCreditPrinted,
    ),
  ).toBe(true);

  await expectAccessible(page);
  expect(await page.title()).toBe("Extra Credit Worksheet");
  expect(page.url()).toBe(`${appServer.origin}/`);
  expect(
    await page.evaluate(async () => {
      const browser = globalThis as unknown as {
        localStorage: { readonly length: number };
        sessionStorage: { readonly length: number };
        indexedDB: { databases?: () => Promise<readonly unknown[]> };
        caches: { keys: () => Promise<readonly string[]> };
        navigator: {
          serviceWorker?: { getRegistrations: () => Promise<readonly unknown[]> };
        };
      };
      return {
        localStorage: browser.localStorage.length,
        sessionStorage: browser.sessionStorage.length,
        databases:
          browser.indexedDB.databases === undefined
            ? 0
            : (await browser.indexedDB.databases()).length,
        cacheKeys: await browser.caches.keys(),
        serviceWorkers:
          browser.navigator.serviceWorker === undefined
            ? 0
            : (await browser.navigator.serviceWorker.getRegistrations()).length,
      };
    }),
  ).toEqual({
    localStorage: 0,
    sessionStorage: 0,
    databases: 0,
    cacheKeys: [],
    serviceWorkers: 0,
  });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(downloads).toEqual([]);
  for (const requestUrl of requestUrls) {
    expect(new URL(requestUrl).origin).toBe(appServer.origin);
  }
});

test("clears generated output across profile selection and profile authority changes", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.goto(appServer.origin);
  await expect(page.getByRole("heading", { name: "Riley" })).toBeVisible();
  const profileSelect = page.getByRole("combobox", { name: "Child profile" });
  const createButton = page.getByRole("button", { name: "Create worksheet" });

  await profileSelect.selectOption(profiles[1].id);
  await createButton.click();
  await expect(page.getByText(/Worksheet ready with 12 unique problems/)).toBeVisible();
  await expect(page.getByLabel("Worksheet preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make another" })).toBeVisible();
  await page.getByRole("button", { name: "Parent answer key" }).click();
  await expect(page.getByRole("heading", { name: "Parent answer key" })).toBeVisible();

  await profileSelect.selectOption(profiles[0].id);
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Parent answer key" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make another" })).toHaveCount(0);
  await expect(page.getByText(/Worksheet ready with \d+ unique problems/)).toHaveCount(0);
  await expect(page.getByText("A different worksheet is ready.")).toHaveCount(0);
  await expect(page.getByText(/No different worksheet was found/)).toHaveCount(0);
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);

  await profileSelect.selectOption(profiles[1].id);
  await createButton.click();
  await expect(page.getByLabel("Worksheet preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make another" })).toBeVisible();
  const reloaded = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/config" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "Reload saved profiles" }).click();
  await reloaded;

  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Parent answer key" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make another" })).toHaveCount(0);
  await expect(page.getByText(/Worksheet ready with \d+ unique problems/)).toHaveCount(0);
  await expect(page.getByText("A different worksheet is ready.")).toHaveCount(0);
  await expect(page.getByText(/No different worksheet was found/)).toHaveCount(0);
  await expect(
    page.getByText("Saved profiles reloaded from the local file."),
  ).toBeVisible();
});
