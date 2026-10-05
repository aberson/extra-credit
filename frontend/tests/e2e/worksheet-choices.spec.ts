import type { Page } from "@playwright/test";

import { worksheetSelectionOf } from "../../src/shared/config/defaults.ts";
import { selectionFromEarlierSettings } from "../../src/shared/config/earlier-settings.ts";
import { classifyStoredConfig } from "../../src/shared/config/migrate.ts";
import {
  WRITING_MODES,
  type AppConfigV1,
  type AppConfigV2,
  type WorksheetDefaultsV2,
  type WorksheetSelectionV2,
} from "../../src/shared/config/schema.ts";
import { expect, test } from "./fixtures/app-server.ts";
import {
  chooseChild,
  chooseLength,
  chooseNumberBondsRegrouping,
  choosePracticeFocus,
  choosePrintLayout,
  chooseRegrouping,
  chooseVariant,
  chooseVocabulary,
  chooseWorksheet,
  controls,
  openMoreOptions,
  setAnswerKey,
} from "./fixtures/worksheet-controls.ts";

/*
 * Worksheet choices made through the panel on the compiled app, over a
 * fictional version 1 file whose two children carry different earlier
 * settings.
 */

const FIRST_NAME = "Fictional Kestrel";

const firstChild = {
  id: "7e1f0c2a-5b3d-4c8e-9a6f-0d2b4c6e8a10",
} as const;

const secondChild = {
  id: "3c9a7e5b-1d2f-4a6c-8e0b-2f4a6c8e0b21",
} as const;

const fictionalConfig: AppConfigV1 = {
  schemaVersion: 1,
  profiles: [
    {
      id: firstChild.id,
      displayName: FIRST_NAME,
      ageYears: 7,
      presentationBand: "early-primary",
      reviewedOn: "2026-09-01",
      mathSkills: {
        countingMax: 10,
        numeralMax: 10,
        compareMax: 10,
        representations: ["quantities", "equations"],
        understandsEquality: true,
        operations: ["addition", "subtraction"],
        operandMax: 10,
        resultMax: 10,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
      writingMode: "sentence-frame",
      interests: [],
    },
    {
      id: secondChild.id,
      displayName: "Fictional Wren",
      ageYears: 5,
      presentationBand: "preschool",
      reviewedOn: "2026-09-02",
      mathSkills: {
        countingMax: 7,
        numeralMax: 7,
        compareMax: 7,
        representations: ["quantities"],
        understandsEquality: false,
        operations: [],
        operandMax: 0,
        resultMax: 0,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
      writingMode: "draw-and-tell",
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

/** The version 2 config the app holds for the fictional version 1 file. */
function upgradedConfig(): AppConfigV2 {
  const classified = classifyStoredConfig(fictionalConfig);
  if (classified.kind !== "legacy") {
    throw new Error("The fictional version 1 file did not classify as legacy.");
  }
  return classified.config;
}

/** Records every config write the page makes. */
function recordConfigWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/config") {
      writes.push(request.url());
    }
  });
  return writes;
}

/** Pins every worksheet seed to one value, so a range check sees a fixed page. */
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

async function openApp(page: Page, origin: string): Promise<void> {
  await page.goto(origin);
  await expect(
    page.getByRole("heading", { name: "Create a practice worksheet" }),
  ).toBeVisible();
  await expect(controls(page).child()).toHaveValue(firstChild.id);
}

async function create(page: Page): Promise<void> {
  await controls(page).create().click();
  await expect(page.getByLabel("Worksheet preview")).toBeVisible();
}

interface ParsedProblem {
  readonly id: string;
  readonly left: number;
  readonly right: number;
  readonly operation: "+" | "−";
  readonly answer: number;
}

async function readDryMathProblems(page: Page): Promise<ParsedProblem[]> {
  const rows = await page
    .getByLabel("Worksheet preview")
    .locator("[data-item-id]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute("data-item-id") ?? "",
        text: element.textContent ?? "",
      })),
    );
  expect(rows.length).toBeGreaterThan(0);
  return rows.map(({ id, text }) => {
    const match = /(\d+)\s*([+−])\s*(\d+)\s*=/u.exec(text);
    if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
      throw new Error("A Dry Math problem could not be parsed.");
    }
    const left = Number(match[1]);
    const right = Number(match[3]);
    const operation = match[2] as "+" | "−";
    return {
      id,
      left,
      right,
      operation,
      answer: operation === "+" ? left + right : left - right,
    };
  });
}

/** Opens the parent answer key and checks every keyed answer against the recomputed one. */
async function expectKeyMatches(page: Page, problems: readonly ParsedProblem[]): Promise<void> {
  await page.getByRole("button", { name: "Parent answer key", exact: true }).click();
  const keyed = await page
    .locator(".print-surface [data-item-id]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute("data-item-id") ?? "",
        value: Number(
          element.querySelector("[data-answer-value]")?.getAttribute("data-answer-value"),
        ),
      })),
    );
  expect(keyed).toHaveLength(problems.length);
  const answers = new Map(problems.map(({ id, answer }) => [id, answer]));
  for (const { id, value } of keyed) {
    expect(answers.has(id)).toBe(true);
    expect(value).toBe(answers.get(id));
  }
  await page.getByRole("button", { name: "Worksheet", exact: true }).click();
}

test("every writing activity generates for one child with its own writing mode", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig(fictionalConfig);
  const writes = recordConfigWrites(page);
  await openApp(page, appServer.origin);
  await chooseWorksheet(page, "sentence-builder");
  const preview = page.getByLabel("Worksheet preview");
  for (const writingMode of WRITING_MODES) {
    await chooseVariant(page, writingMode);
    await expect(preview).toHaveCount(0);
    await create(page);
    await expect(preview).toHaveAttribute("data-worksheet-type", "sentence-builder");
    await expect(preview.locator("[data-writing-mode]")).toHaveCount(1);
    await expect(preview.locator(`[data-writing-mode="${writingMode}"]`)).toHaveCount(1);
  }
  // The child never changed and neither did the file.
  await expect(controls(page).child()).toHaveValue(firstChild.id);
  expect(writes).toEqual([]);
});

test("practice focus sets the Dry Math range and the answer key recomputes it", async ({
  appServer,
  page,
}) => {
  await pinSeed(page, 1);
  await appServer.seedConfig(fictionalConfig);
  await openApp(page, appServer.origin);
  await chooseWorksheet(page, "dry-math");
  await chooseLength(page, "long");

  await choosePracticeFocus(page, "Addition within 20");
  await create(page);
  const withinTwenty = await readDryMathProblems(page);
  expect(withinTwenty).toHaveLength(18);
  for (const problem of withinTwenty) {
    expect(problem.operation).toBe("+");
    expect(Math.max(problem.left, problem.right, problem.answer)).toBeLessThanOrEqual(20);
    expect(problem.answer).toBeGreaterThanOrEqual(0);
  }
  await expectKeyMatches(page, withinTwenty);

  await choosePracticeFocus(page, "Addition and subtraction within 100");
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await create(page);
  const withinHundred = await readDryMathProblems(page);
  expect(withinHundred).toHaveLength(18);
  for (const problem of withinHundred) {
    expect(Math.max(problem.left, problem.right, problem.answer)).toBeLessThanOrEqual(100);
    expect(problem.answer).toBeGreaterThanOrEqual(0);
  }
  // Non-vacuity: the wider focus really reaches past the narrower one.
  expect(
    withinHundred.some(({ left, right, answer }) => Math.max(left, right, answer) > 20),
  ).toBe(true);
  expect(new Set(withinHundred.map(({ operation }) => operation))).toEqual(new Set(["+", "−"]));
  await expectKeyMatches(page, withinHundred);
});

test("the statements choice sets the Two Whats and a Wow mode", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig(fictionalConfig);
  await openApp(page, appServer.origin);
  await chooseWorksheet(page, "find-the-wow");
  const preview = page.getByLabel("Worksheet preview");
  for (const variant of ["quantity", "equation"] as const) {
    await chooseVariant(page, variant);
    await expect(preview).toHaveCount(0);
    await create(page);
    const items = await preview.locator("[data-item-id]").count();
    expect(items).toBeGreaterThan(0);
    await expect(preview.locator(`[data-wow-mode="${variant}"]`)).toHaveCount(items);
  }
});

test("Create and Make another never write the config file", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig(fictionalConfig);
  const before = await appServer.readRaw();
  const writes = recordConfigWrites(page);
  await openApp(page, appServer.origin);
  for (const worksheetType of ["dry-math", "count-compare-make", "find-the-wow"] as const) {
    await chooseWorksheet(page, worksheetType);
    await create(page);
    await page.getByRole("button", { name: "Make another" }).click();
    await expect(page.getByText("A different worksheet is ready.")).toBeVisible();
  }
  expect(writes).toEqual([]);
  expect((await appServer.readRaw()).equals(before)).toBe(true);
});

test("switching to Number Bonds and back keeps each family's choices", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig(fictionalConfig);
  const before = await appServer.readRaw();
  const writes = recordConfigWrites(page);
  await openApp(page, appServer.origin);
  const regroupingRadio = (name: string) =>
    controls(page).regrouping().getByRole("radio", { name, exact: true });

  await chooseWorksheet(page, "dry-math");
  await choosePracticeFocus(page, "Addition within 20");
  await chooseRegrouping(page, "required");
  await chooseWorksheet(page, "number-bonds");
  // Number Bonds starts from its own defaults, untouched by Dry Math's choices.
  await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText("Addition within 10");
  await expect(regroupingRadio("Without carrying or borrowing")).toBeChecked();
  await choosePracticeFocus(page, "Subtraction within 5");
  await chooseNumberBondsRegrouping(page, "included");

  for (const away of ["dry-math", "find-the-wow"] as const) {
    await chooseWorksheet(page, away);
    if (away === "dry-math") {
      await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText("Addition within 20");
      await expect(regroupingRadio("Every problem carries or borrows")).toBeChecked();
    }
    await chooseWorksheet(page, "number-bonds");
    await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText("Subtraction within 5");
    await expect(regroupingRadio("Include problems that carry or borrow")).toBeChecked();
  }

  // The page Number Bonds creates reads only its own choices.
  await create(page);
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "number-bonds");
  await expect(preview.locator("[data-item-id]")).toHaveCount(12);
  await expect(preview.locator('[data-operator="subtraction"]')).toHaveCount(12);
  expect(writes).toEqual([]);
  expect((await appServer.readRaw()).equals(before)).toBe(true);
});

test("saving a nickname keeps the selection and clears the preview, and a cancelled edit writes nothing", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig(fictionalConfig);
  await openApp(page, appServer.origin);
  await chooseWorksheet(page, "find-the-wow");
  await chooseVariant(page, "quantity");
  await choosePracticeFocus(page, "Quantities to 20");
  await chooseLength(page, "short");

  async function expectSelectionKept(): Promise<void> {
    await expect(controls(page).worksheetCard("find-the-wow")).toBeChecked();
    await expect(
      controls(page).statements().getByRole("radio", { name: "Quantity pictures", exact: true }),
    ).toBeChecked();
    await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
      "Quantities to 20",
    );
    await openMoreOptions(page);
    await expect(controls(page).length()).toHaveValue("short");
  }

  // A cancelled edit writes nothing and keeps the selection.
  const rawBefore = await appServer.readRaw();
  const reviewedBefore = (await appServer.readConfig()).profiles[0]?.reviewedOn;
  await page.getByRole("button", { name: `Edit ${FIRST_NAME}` }).click();
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Fictional Draft");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: FIRST_NAME, exact: true })).toBeVisible();
  expect((await appServer.readRaw()).equals(rawBefore)).toBe(true);
  expect((await appServer.readConfig()).profiles[0]?.reviewedOn).toBe(reviewedBefore);
  await expectSelectionKept();

  // Opening the editor takes the page down, and the save's adoption raises the
  // preview epoch; this records the end state after a saved nickname.
  await create(page);
  await page.getByRole("button", { name: `Edit ${FIRST_NAME}` }).click();
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Nickname (optional)" }).fill("Fictional Renamed");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fictional Renamed", exact: true })).toBeVisible();
  expect((await appServer.readConfig()).profiles[0]?.displayName).toBe("Fictional Renamed");
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make another" })).toHaveCount(0);
  await expectSelectionKept();
  await expect(controls(page).child()).toHaveValue(firstChild.id);
  await expect(controls(page).child().locator("option:checked")).toHaveText("Fictional Renamed");
});

test("saved defaults restore the whole selection after a reload and end seeding for every child", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig(fictionalConfig);
  await openApp(page, appServer.origin);

  await chooseWorksheet(page, "sentence-builder");
  await chooseVariant(page, "copy-with-model");
  await chooseVocabulary(page, "simpler-words");
  await chooseWorksheet(page, "dry-math");
  await choosePracticeFocus(page, "Addition within 20");
  await chooseWorksheet(page, "find-the-wow");
  await chooseVariant(page, "quantity");
  await choosePracticeFocus(page, "Quantities to 20");
  await chooseLength(page, "long");
  await choosePrintLayout(page, { paperSize: "a4" });
  await setAnswerKey(page, false);

  await page.getByRole("button", { name: "Save these as worksheet defaults" }).click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();

  // The file holds exactly the visible selection with seeding off: the
  // changed groups plus the first child's earlier settings in every other
  // group.
  const upgraded = upgradedConfig();
  const legacy = upgraded.profiles[0]?.legacyChoices;
  if (legacy === undefined) {
    throw new Error("The first fictional child lost its earlier settings.");
  }
  const changes: Partial<WorksheetSelectionV2> = {
    worksheetType: "find-the-wow",
    sentenceBuilder: { variant: "copy-with-model", vocabulary: "simpler-words" },
    dryMath: { operations: ["addition"], operandMax: 20, resultMax: 20 },
    length: "long",
    paperSize: "a4",
    includeAnswerKey: false,
  };
  const seeded = selectionFromEarlierSettings(legacy, worksheetSelectionOf(upgraded.defaults))
    .selection;
  const expected: WorksheetDefaultsV2 = {
    ...seeded,
    ...changes,
    findTheWow: { ...seeded.findTheWow, variant: "quantity", quantity: { countingMax: 20, numeralMax: 20 } },
    useEarlierChildSettings: false,
  };
  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual(expected);
  expect(JSON.parse((await appServer.readRaw()).toString("utf8")).defaults.useEarlierChildSettings).toBe(false);
  expect(saved.profiles).toEqual(upgraded.profiles);

  async function expectSavedSelection(): Promise<void> {
    await expect(controls(page).worksheetCard("find-the-wow")).toBeChecked();
    await expect(
      controls(page).statements().getByRole("radio", { name: "Quantity pictures", exact: true }),
    ).toBeChecked();
    await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
      "Quantities to 20",
    );
    await openMoreOptions(page);
    await expect(controls(page).length()).toHaveValue("long");
    await expect(controls(page).paperSize()).toHaveValue("a4");
    await expect(controls(page).printScale()).toHaveValue("standard");
    await expect(controls(page).answerKey()).not.toBeChecked();
    await chooseWorksheet(page, "dry-math");
    await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
      "Addition within 20",
    );
    await chooseWorksheet(page, "sentence-builder");
    await expect(
      controls(page).writingActivity().getByRole("radio", { name: "Copy a Sentence", exact: true }),
    ).toBeChecked();
    await expect(
      controls(page).vocabulary().getByRole("radio", { name: "Simpler words — for beginning readers", exact: true }),
    ).toBeChecked();
    await chooseWorksheet(page, "find-the-wow");
  }

  await page.reload();
  await openApp(page, appServer.origin);
  await expectSavedSelection();
  await expect(page.locator("[data-earlier-settings-used]")).toHaveCount(0);

  // The second child's earlier settings (Draw & Tell, quantities to 7) no
  // longer seed anything: it shows the saved defaults.
  await chooseChild(page, secondChild.id);
  await expectSavedSelection();
  await expect(page.locator("[data-earlier-settings-used]")).toHaveCount(0);

  // No browser persistence surface holds anything.
  expect(await page.evaluate(`(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: await indexedDB.databases(),
    caches: await caches.keys(),
    workers: (await navigator.serviceWorker.getRegistrations()).length,
  }))()`)).toEqual({ local: 0, session: 0, databases: [], caches: [], workers: 0 });
});
