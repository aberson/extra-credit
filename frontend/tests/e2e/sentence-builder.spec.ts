import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../src/shared/config/schema.ts";
import { expect, test } from "./fixtures/app-server.ts";

const defaults: GenerationDefaultsV1 = {
  useDisplayName: false,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

const sharedMathSkills: ChildProfileV1["mathSkills"] = {
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
};

const profiles = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Distinctive Private Avery",
    ageYears: 4,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: sharedMathSkills,
    writingMode: "draw-and-tell",
    interests: ["Distinctive Private Dinosaurs"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Distinctive Private Blake",
    ageYears: 5,
    presentationBand: "preschool",
    reviewedOn: "2026-08-22",
    mathSkills: sharedMathSkills,
    writingMode: "label",
    interests: ["Space"],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "Distinctive Private Casey",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: sharedMathSkills,
    writingMode: "copy-with-model",
    interests: ["Distinctive Private Unicorns"],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    displayName: "Distinctive Private Devon",
    ageYears: 7,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: sharedMathSkills,
    writingMode: "sentence-frame",
    interests: ["Animals"],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    displayName: "Distinctive Private Ellis",
    ageYears: 8,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: sharedMathSkills,
    writingMode: "independent",
    interests: ["Nature"],
  },
] as const satisfies readonly ChildProfileV1[];

interface DomSheet {
  readonly bankWords: readonly string[];
  readonly copyLines: number;
  readonly dictationNotes: number;
  readonly drawingBoxes: number;
  readonly items: number;
  readonly labelLines: number;
  readonly modelSentence: string | null;
  readonly prompt: string | null;
  readonly requiredResponse: string | null;
  readonly responsePanelSize: { readonly height: number; readonly width: number };
  readonly sentenceFrame: string | null;
  readonly topicId: string | null;
  readonly wordBanks: number;
  readonly writingLines: number;
  readonly writingMode: string | null;
}

interface ExpectedSheet {
  readonly bankWords: number;
  readonly copyLines: number;
  readonly dictationNotes: number;
  readonly drawingBoxes: number;
  readonly hasModelSentence: boolean;
  readonly hasSentenceFrame: boolean;
  readonly labelLines: number;
  readonly requiredResponse: string;
  readonly topicId: string;
  readonly writingLines: number;
}

const expectedByProfile: Readonly<Record<string, ExpectedSheet>> = {
  "draw-and-tell": {
    bankWords: 0,
    copyLines: 0,
    dictationNotes: 1,
    drawingBoxes: 1,
    hasModelSentence: false,
    hasSentenceFrame: false,
    labelLines: 0,
    requiredResponse: "drawing,dictation",
    topicId: "neutral",
    writingLines: 0,
  },
  label: {
    bankWords: 6,
    copyLines: 0,
    dictationNotes: 0,
    drawingBoxes: 1,
    hasModelSentence: false,
    hasSentenceFrame: false,
    labelLines: 4,
    requiredResponse: "drawing,labels",
    topicId: "space",
    writingLines: 0,
  },
  "copy-with-model": {
    bankWords: 0,
    copyLines: 3,
    dictationNotes: 0,
    drawingBoxes: 0,
    hasModelSentence: true,
    hasSentenceFrame: false,
    labelLines: 0,
    requiredResponse: "copying",
    topicId: "neutral",
    writingLines: 0,
  },
  "sentence-frame": {
    bankWords: 6,
    copyLines: 0,
    dictationNotes: 0,
    drawingBoxes: 0,
    hasModelSentence: false,
    hasSentenceFrame: true,
    labelLines: 0,
    requiredResponse: "writing",
    topicId: "animals",
    writingLines: 3,
  },
  independent: {
    bankWords: 8,
    copyLines: 0,
    dictationNotes: 0,
    drawingBoxes: 1,
    hasModelSentence: false,
    hasSentenceFrame: false,
    labelLines: 0,
    requiredResponse: "drawing,writing",
    topicId: "nature",
    writingLines: 5,
  },
};

const BANK_MODES = new Set(["label", "sentence-frame", "independent"]);

/** Mirrors SENTENCE_BUILDER_MODE_LABELS; asserted through the real UI string. */
const MODE_LABELS: Readonly<Record<string, string>> = {
  "copy-with-model": "copy with a model",
  "draw-and-tell": "draw and tell",
  independent: "independent writing",
  label: "label your drawing",
  "sentence-frame": "sentence frame",
};

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function readSheet(preview: Locator): Promise<DomSheet> {
  return await preview.evaluate((node) => {
    const item = node.querySelector("[data-sentence-item]");
    const panel = node.querySelector("[data-response-panel]");
    const panelBounds = panel?.getBoundingClientRect();
    const text = (selector: string): string | null =>
      node.querySelector(selector)?.textContent?.replace(/\s+/gu, " ").trim() ??
      null;
    return {
      bankWords: [...node.querySelectorAll("[data-bank-word]")].map(
        (word) => word.textContent?.trim() ?? "",
      ),
      copyLines: node.querySelectorAll('[data-response-line="copy"]').length,
      dictationNotes: node.querySelectorAll("[data-dictation-note]").length,
      drawingBoxes: node.querySelectorAll("[data-drawing-box]").length,
      items: node.querySelectorAll("[data-sentence-item]").length,
      labelLines: node.querySelectorAll('[data-response-line="label"]').length,
      modelSentence: text("[data-model-sentence]"),
      prompt: text("[data-sentence-prompt]"),
      requiredResponse: item?.getAttribute("data-required-response") ?? null,
      responsePanelSize: {
        height: Math.round(panelBounds?.height ?? 0),
        width: Math.round(panelBounds?.width ?? 0),
      },
      sentenceFrame: text("[data-sentence-frame]"),
      topicId: item?.getAttribute("data-topic-id") ?? null,
      wordBanks: node.querySelectorAll("[data-word-bank]").length,
      writingLines: node.querySelectorAll('[data-response-line="write"]').length,
      writingMode: item?.getAttribute("data-writing-mode") ?? null,
    };
  });
}

function expectSheetMatches(sheet: DomSheet, expected: ExpectedSheet): void {
  expect(sheet.items).toBe(1);
  expect(sheet.requiredResponse).toBe(expected.requiredResponse);
  expect(sheet.topicId).toBe(expected.topicId);
  expect(sheet.prompt?.length ?? 0).toBeGreaterThan(0);
  expect(sheet.bankWords).toHaveLength(expected.bankWords);
  expect(new Set(sheet.bankWords).size).toBe(expected.bankWords);
  expect(sheet.wordBanks).toBe(expected.bankWords === 0 ? 0 : 1);
  expect(sheet.drawingBoxes).toBe(expected.drawingBoxes);
  expect(sheet.dictationNotes).toBe(expected.dictationNotes);
  expect(sheet.labelLines).toBe(expected.labelLines);
  expect(sheet.copyLines).toBe(expected.copyLines);
  expect(sheet.writingLines).toBe(expected.writingLines);
  expect(sheet.modelSentence !== null).toBe(expected.hasModelSentence);
  expect(sheet.sentenceFrame !== null).toBe(expected.hasSentenceFrame);
  expect(sheet.responsePanelSize.height).toBeGreaterThan(0);
}

async function setFixedSeed(page: Page, seed: number): Promise<void> {
  await page.evaluate((nextSeed) => {
    const browser = globalThis as unknown as { __extraCreditFixedSeed?: number };
    browser.__extraCreditFixedSeed = nextSeed;
  }, seed);
}

test("renders every Sentence Builder writing mode through the compiled UI", async ({
  appServer,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [...profiles],
    defaults,
  });
  await page.addInitScript(() => {
    const browser = globalThis as unknown as { __extraCreditFixedSeed?: number };
    browser.__extraCreditFixedSeed = 1;
    const browserCrypto = (
      globalThis as unknown as {
        crypto: { getRandomValues: (array: ArrayBufferView) => ArrayBufferView };
      }
    ).crypto;
    const original = browserCrypto.getRandomValues.bind(browserCrypto);
    Object.defineProperty(Crypto.prototype, "getRandomValues", {
      configurable: true,
      value(array: ArrayBufferView | null): ArrayBufferView | null {
        if (array instanceof Uint32Array) {
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
  await expect(
    page.getByText("Saved profiles reloaded from the local file."),
  ).toBeVisible();

  const profileSelect = page.getByRole("combobox", { name: "Child profile" });
  const worksheetSelect = page.getByRole("combobox", { name: "Worksheet type" });
  const createButton = page.getByRole("button", { name: "Create worksheet" });
  const preview = page.getByLabel("Worksheet preview");

  await expect(
    worksheetSelect.locator('option[value="sentence-builder"]'),
  ).toHaveText("Sentence Builder");
  await worksheetSelect.selectOption("sentence-builder");
  await page.getByText("More options").click();

  for (const [index, profileFixture] of profiles.entries()) {
    const writingMode = profileFixture.writingMode;
    const expectedSheet = expectedByProfile[writingMode];
    if (expectedSheet === undefined) {
      throw new Error(`No expectation for writing mode ${writingMode}.`);
    }
    await profileSelect.selectOption(profileFixture.id);
    await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
    await expect(
      page.getByText(
        `This profile will use ${MODE_LABELS[writingMode]} mode for Sentence Builder.`,
      ),
    ).toBeVisible();

    // Hidden controls are hidden, not merely ignored.
    await expect(
      page.getByRole("combobox", { name: "Difficulty" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Include a parent answer key")).toHaveCount(0);
    await expect(
      page.getByLabel("Use reviewed interests in worksheet content"),
    ).toBeVisible();
    await expect(page.getByLabel("Include decorative graphics")).toBeVisible();

    const lengthSelect = page.getByRole("combobox", { name: "Length" });
    if (BANK_MODES.has(writingMode)) {
      await expect(lengthSelect).toHaveCount(1);
      await expect(
        page.getByText(
          `This selection creates ${expectedSheet.bankWords} unique word-bank words on one practice page.`,
        ),
      ).toBeVisible();
    } else {
      await expect(lengthSelect).toHaveCount(0);
      await expect(
        page.getByText(
          "This selection creates 1 unique writing prompt on one practice page.",
        ),
      ).toBeVisible();
    }

    await setFixedSeed(page, index + 1);
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(preview).toHaveAttribute("data-worksheet-type", "sentence-builder");
    await expect(preview.locator(`[data-writing-mode="${writingMode}"]`)).toHaveCount(1);
    await expect(
      page.getByText("Worksheet ready with 1 unique writing prompt."),
    ).toBeVisible();

    const sheet = await readSheet(preview);
    expectSheetMatches(sheet, expectedSheet);

    // The child page must not name a surface it does not print: the only
    // place to write a label is the ruled label lines.
    if (writingMode === "label") {
      expect(sheet.prompt?.toLowerCase()).toContain("on the lines");
    }

    // No objective key surface exists for an open writing page.
    await expect(
      page.getByRole("button", { name: "Parent answer key" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Worksheet" }),
    ).toBeVisible();

    await expect(preview).not.toContainText(profileFixture.displayName);
    for (const interest of profileFixture.interests) {
      if (expectedSheet.topicId === "neutral") {
        await expect(preview).not.toContainText(interest);
      }
    }

    // Same seed, same request: identical educational content.
    await setFixedSeed(page, index + 1);
    await createButton.click();
    expect(await readSheet(preview)).toEqual(sheet);
  }

  await expectAccessible(page);

  // Decoration is decoration: the prompt, bank, item count, required response,
  // and response-panel geometry survive the toggle unchanged.
  await profileSelect.selectOption(profiles[4].id);
  await setFixedSeed(page, 9);
  await createButton.click();
  const withGraphics = await readSheet(preview);
  await page.getByLabel("Include decorative graphics").uncheck();
  await setFixedSeed(page, 9);
  await createButton.click();
  expect(await readSheet(preview)).toEqual(withGraphics);
  await page.getByLabel("Include decorative graphics").check();

  // Length selects bank breadth, never prompt count.
  const lengthSelect = page.getByRole("combobox", { name: "Length" });
  await expect(lengthSelect.locator('option[value="short"]')).toHaveText(
    "Short · 6 word-bank words",
  );
  await expect(lengthSelect.locator('option[value="standard"]')).toHaveText(
    "Standard · 8 word-bank words",
  );
  await expect(lengthSelect.locator('option[value="long"]')).toHaveText(
    "Long · 10 word-bank words",
  );
  await lengthSelect.selectOption("long");
  await setFixedSeed(page, 11);
  await createButton.click();
  const longSheet = await readSheet(preview);
  expect(longSheet.items).toBe(1);
  expect(longSheet.bankWords).toHaveLength(10);
  // plan.md:236 - length changes word-bank breadth AND response space.
  expect(longSheet.writingLines).toBeGreaterThan(withGraphics.writingLines);

  // Large print steps a bank-bearing page down one budget on the same one page.
  const printScaleSelect = page.getByRole("combobox", { name: "Print scale" });
  await printScaleSelect.selectOption("large");
  await expect(lengthSelect.locator('option[value="long"]')).toHaveText(
    "Long · 8 word-bank words",
  );
  await setFixedSeed(page, 11);
  await createButton.click();
  const largeSheet = await readSheet(preview);
  expect(largeSheet.items).toBe(1);
  expect(largeSheet.bankWords).toHaveLength(8);
  // Response space follows the EFFECTIVE length, so the large-print step-down
  // takes the writing lines back to the standard budget with the bank.
  expect(largeSheet.writingLines).toBe(withGraphics.writingLines);
  await printScaleSelect.selectOption("standard");

  // Nickname personalization reaches only the header.
  await page.getByLabel("Put the nickname in the worksheet header").check();
  await setFixedSeed(page, 13);
  await createButton.click();
  await expect(
    page.getByRole("heading", {
      name: `${profiles[4].displayName}’s Sentence Builder practice`,
    }),
  ).toBeVisible();
  const namedSheet = await readSheet(preview);
  expect(namedSheet.prompt).not.toContain(profiles[4].displayName);
  expect(namedSheet.bankWords.join(" ")).not.toContain(
    profiles[4].displayName,
  );
  await expectAccessible(page);

  // Print media keeps the child page and drops the parent controls.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".profile-workspace")).toBeHidden();
  for (const control of await page.locator(".print-controls").all()) {
    await expect(control).toBeHidden();
  }
  await expect(preview.locator("[data-sentence-item]")).toHaveCount(1);
  await expect(preview.locator("[data-drawing-box]")).toHaveCount(1);
  await page.emulateMedia({ media: "screen" });
});
