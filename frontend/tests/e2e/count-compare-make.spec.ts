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

const profiles = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Distinctive Private Avery",
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
    writingMode: "draw-and-tell",
    interests: ["Space"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Distinctive Private Blake",
    ageYears: 7,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 50,
      numeralMax: 50,
      compareMax: 50,
      representations: ["quantities"],
      understandsEquality: false,
      operations: [],
      operandMax: 0,
      resultMax: 0,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "label",
    interests: ["Distinctive Private Dinosaurs"],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "Distinctive Private Casey",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 10,
      numeralMax: 10,
      compareMax: 10,
      representations: ["equations"],
      understandsEquality: true,
      operations: ["addition"],
      operandMax: 10,
      resultMax: 10,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["Animals"],
  },
] as const satisfies readonly ChildProfileV1[];

interface DomItem {
  readonly activity: string | null;
  readonly emptyMarks: readonly number[];
  readonly filledMarks: readonly number[];
  readonly guideCells: readonly number[];
  readonly id: string | null;
  readonly numeral: number | null;
  readonly partial: number | null;
  readonly prompt: string | null;
  readonly quantities: readonly number[];
  readonly relationWords: readonly string[];
  readonly responseMode: string | null;
  readonly text: string;
  readonly visualLabels: readonly string[];
}

interface DomSheet {
  readonly decoration: string | null;
  readonly decorativePanels: number;
  readonly items: readonly DomItem[];
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function readSheet(preview: Locator): Promise<DomSheet> {
  return await preview.evaluate((node) => ({
    decoration:
      node.querySelector("[data-decorative-panel]")?.getAttribute(
        "data-decoration",
      ) ?? null,
    decorativePanels: node.querySelectorAll("[data-decorative-panel]").length,
    items: [...node.querySelectorAll("[data-item-id]")].map((item) => ({
      activity: item.getAttribute("data-activity"),
      emptyMarks: [...item.querySelectorAll("[data-instructional-visual]")].map(
        (visual) =>
          visual.querySelectorAll('[data-instructional-mark="empty"]').length,
      ),
      filledMarks: [...item.querySelectorAll("[data-instructional-visual]")].map(
        (visual) =>
          visual.querySelectorAll('[data-instructional-mark="filled"]').length,
      ),
      guideCells: [
        ...item.querySelectorAll("[data-instructional-guide-cells]"),
      ].map((guide) =>
        Number(guide.getAttribute("data-instructional-guide-cells")),
      ),
      id: item.getAttribute("data-item-id"),
      numeral:
        item.querySelector("[data-visible-numeral]") === null
          ? null
          : Number(item.querySelector("[data-visible-numeral]")?.textContent),
      partial:
        item.querySelector('[data-instructional-visual="ten-frame"]') === null
          ? null
          : Number(
              item
                .querySelector('[data-instructional-visual="ten-frame"]')
                ?.getAttribute("data-instructional-quantity"),
            ),
      prompt:
        item
          .querySelector("[data-item-prompt]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim() ?? null,
      quantities: [...item.querySelectorAll("[data-instructional-visual]")].map(
        (visual) => Number(visual.getAttribute("data-instructional-quantity")),
      ),
      relationWords: [...item.querySelectorAll("[data-relation-word]")].map(
        (word) => word.getAttribute("data-relation-word") ?? "",
      ),
      responseMode: item.getAttribute("data-response-mode"),
      text: item.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      visualLabels: [
        ...item.querySelectorAll("[data-instructional-visual]"),
      ].map((visual) => visual.getAttribute("aria-label") ?? ""),
    })),
  }));
}

/**
 * Every per-item child-facing surface. The header - title, intro line, and
 * decorative panel - sits outside `[data-item-id]` and is not compared here.
 */
function instructionalReading(sheet: DomSheet): string {
  return JSON.stringify(sheet.items);
}

function activityCounts(sheet: DomSheet): Record<string, number> {
  const counts: Record<string, number> = {
    compare: 0,
    complete: 0,
    draw: 0,
    match: 0,
  };
  for (const item of sheet.items) {
    const activity = item.activity ?? "unknown";
    counts[activity] = (counts[activity] ?? 0) + 1;
  }
  return counts;
}

/** Recomputes each answer from what the CHILD can see, in DOM order. */
function recomputeFromPage(sheet: DomSheet): readonly string[] {
  return sheet.items.map((item) => {
    const numeral = item.numeral ?? 0;
    switch (item.activity) {
      case "match":
        return `Choice ${item.quantities.indexOf(numeral) + 1}`;
      case "compare": {
        const left = item.quantities[0] ?? 0;
        const right = item.quantities[1] ?? 0;
        // Independently restated here rather than imported, so this oracle
        // stays a real check on the words the key prints.
        return left < right
          ? "fewer than"
          : left > right
            ? "more than"
            : "the same as";
      }
      case "complete":
        return String(numeral - (item.quantities[0] ?? 0));
      default:
        return String(numeral);
    }
  });
}

async function readAnswerKey(page: Page): Promise<readonly string[]> {
  return await page
    .locator('[data-surface="answer"]')
    .evaluate((node) =>
      [...node.querySelectorAll("[data-answer-value]")].map(
        (value) => value.getAttribute("data-answer-value") ?? "",
      ),
    );
}

async function setFixedSeed(page: Page, seed: number): Promise<void> {
  await page.evaluate((nextSeed) => {
    const browser = globalThis as unknown as { __extraCreditFixedSeed?: number };
    browser.__extraCreditFixedSeed = nextSeed;
  }, seed);
}

test("renders Count, Compare & Make through the compiled UI", async ({
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
    worksheetSelect.locator('option[value="count-compare-make"]'),
  ).toHaveText("Count, Compare & Make");
  await worksheetSelect.selectOption("count-compare-make");
  await page.getByText("More options").click();

  // Without a confirmed quantities representation the activity is unavailable,
  // and no numeric maximum can authorize it on its own.
  await profileSelect.selectOption(profiles[2].id);
  await expect(
    page.getByText(/Count, Compare & Make needs confirmed quantities/),
  ).toBeVisible();
  await expect(createButton).toBeDisabled();
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);

  await profileSelect.selectOption(profiles[0].id);
  await expect(
    page.getByText(
      "This selection creates 8 unique items on one practice page.",
    ),
  ).toBeVisible();
  await expect(createButton).toBeEnabled();

  await setFixedSeed(page, 0x0004_2021);
  await createButton.click();
  await expect(preview).toHaveAttribute(
    "data-worksheet-type",
    "count-compare-make",
  );
  await expect(
    page.getByText("Worksheet ready with 8 unique items."),
  ).toBeVisible();

  const standard = await readSheet(preview);
  expect(standard.items).toHaveLength(8);
  // plan.md:208 - the fixed standard mix. This checks the COUNTS only; the
  // seeded interleave is proved in `src/worksheets/count-compare-make/
  // generator.test.ts` ("the seeded shuffle really interleaves the four
  // subtypes"), because an all-match-then-all-compare page would satisfy the
  // equality below unchanged.
  expect(activityCounts(standard)).toEqual({
    compare: 2,
    complete: 2,
    draw: 2,
    match: 2,
  });
  expect(standard.items.map((item) => item.id)).toEqual([
    "item-001",
    "item-002",
    "item-003",
    "item-004",
    "item-005",
    "item-006",
    "item-007",
    "item-008",
  ]);
  for (const item of standard.items) {
    expect(item.responseMode, item.id ?? "").toBe(
      item.activity === "complete" || item.activity === "draw"
        ? "draw"
        : "circle",
    );
    for (const [index, label] of item.visualLabels.entries()) {
      // The marks are aria-hidden, so this label is the whole content a
      // screen reader gets: it must state the number really drawn, correctly
      // pluralized, not merely look like a count.
      const spoken = Number(/^(\d+)\b/u.exec(label)?.[1]);
      expect(spoken, `${item.id ?? ""}: ${label}`).toBe(item.filledMarks[index]);
      expect(spoken, `${item.id ?? ""}: ${label}`).toBe(item.quantities[index]);
      expect(label, item.id ?? "").toMatch(
        spoken === 1 ? /^1 mark\b/u : /^\d+ marks\b/u,
      );
    }
    if (item.activity === "complete" && item.numeral !== null) {
      // The child must have somewhere to put every mark this item asks for.
      const missing = item.numeral - (item.partial ?? 0);
      expect(item.emptyMarks[0] ?? 0, `${item.id ?? ""}: needs ${missing}`)
        .toBeGreaterThanOrEqual(missing);
    }
    if (item.activity === "draw" && item.numeral !== null) {
      expect(item.guideCells[0] ?? 0, item.id ?? "").toBeGreaterThanOrEqual(
        item.numeral,
      );
      expect(item.prompt, item.id ?? "").toBe(
        `Draw ${item.numeral} ${item.numeral === 1 ? "mark" : "marks"} in the boxes.`,
      );
    }
    if (item.activity === "compare") {
      expect(item.relationWords).toEqual(["less", "equal", "greater"]);
      expect(item.quantities).toHaveLength(2);
    }
    if (item.activity === "draw") {
      expect(item.guideCells.length).toBeGreaterThan(0);
    }
    if (item.activity === "match") {
      expect(item.quantities).toHaveLength(3);
      expect(new Set(item.quantities).size).toBe(3);
    }
    // No equation is required anywhere on an age-four-friendly page.
    expect(item.text).not.toMatch(/[+−=]/u);
  }
  await expectAccessible(page);

  // The parent key is the same document: every visible item recomputes to it.
  await page.getByRole("button", { name: "Parent answer key" }).click();
  const printedKey = await readAnswerKey(page);
  expect(printedKey).toEqual(recomputeFromPage(standard));
  // One document, one vocabulary: no key row may leak the stored relation
  // enum instead of the phrase printed on the child's page.
  const circledWords = new Set(
    standard.items.flatMap((item) =>
      item.activity === "compare" ? ["fewer than", "the same as", "more than"] : [],
    ),
  );
  for (const [index, row] of printedKey.entries()) {
    if (standard.items[index]?.activity === "compare") {
      expect(circledWords.has(row), row).toBe(true);
    }
    expect(["less", "equal", "greater"]).not.toContain(row);
  }
  await page.getByRole("button", { exact: true, name: "Worksheet" }).click();

  // Same seed, same request: identical educational content.
  await setFixedSeed(page, 0x0004_2021);
  await createButton.click();
  expect(await readSheet(preview)).toEqual(standard);

  // Decoration is decoration: turning it off changes the panel and nothing a
  // child must look at, count, or draw into.
  await page.getByLabel("Include decorative graphics").uncheck();
  await setFixedSeed(page, 0x0004_2021);
  await createButton.click();
  const undecorated = await readSheet(preview);
  expect(undecorated.decorativePanels).toBe(standard.decorativePanels);
  expect(undecorated.decoration).toBe("doodle");
  expect(instructionalReading(undecorated)).toBe(
    instructionalReading(standard),
  );
  await page.getByLabel("Include decorative graphics").check();

  // Length changes the item count AND the subtype mix, and this checks
  // both: the standard page above is 2/2/2/2 over 8 items, the long page
  // below is 3/3/2/2 over 10 - the two mixes plan.md:208 fixes.
  const lengthSelect = page.getByRole("combobox", { name: "Length" });
  await expect(lengthSelect.locator('option[value="short"]')).toHaveText(
    "Short · 6 items",
  );
  await expect(lengthSelect.locator('option[value="long"]')).toHaveText(
    "Long · 10 items",
  );
  await lengthSelect.selectOption("long");
  await setFixedSeed(page, 0x0408_0601);
  await createButton.click();
  const long = await readSheet(preview);
  expect(long.items).toHaveLength(10);
  expect(activityCounts(long)).toEqual({
    compare: 3,
    complete: 2,
    draw: 2,
    match: 3,
  });
  await lengthSelect.selectOption("standard");

  // A stored maximum above 20 is shown but can never widen v1 generation.
  await profileSelect.selectOption(profiles[1].id);
  await expect(
    page.getByText(/Version 1 uses at most 20/),
  ).toBeVisible();
  await setFixedSeed(page, 0x9dcc_a8c5);
  await createButton.click();
  const clamped = await readSheet(preview);
  for (const item of clamped.items) {
    for (const quantity of [...item.quantities, item.numeral ?? 1]) {
      expect(quantity).toBeGreaterThanOrEqual(1);
      expect(quantity).toBeLessThanOrEqual(20);
    }
    // Every `complete` item must leave room for its missing marks. A large
    // target over a small partial group is where the frame used to be too
    // small to hold the answer; this asserts the invariant for whatever
    // targets this seed produces rather than pinning a target of 20.
    if (item.activity === "complete" && item.numeral !== null) {
      expect(
        item.emptyMarks[0] ?? 0,
        `${item.id ?? ""}: ${item.partial ?? 0} of ${item.numeral}`,
      ).toBeGreaterThanOrEqual(item.numeral - (item.partial ?? 0));
    }
  }
  await expect(preview).not.toContainText(profiles[1].displayName);
  await expect(preview).not.toContainText(profiles[1].interests[0]);

  // Nickname personalization reaches only the header.
  await page.getByLabel("Put the nickname in the worksheet header").check();
  await setFixedSeed(page, 0x1255_994f);
  await createButton.click();
  await expect(
    page.getByRole("heading", {
      name: `${profiles[1].displayName}’s Count, Compare & Make practice`,
    }),
  ).toBeVisible();
  await expectAccessible(page);

  // Print media keeps the child page and drops the parent controls.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".profile-workspace")).toBeHidden();
  for (const control of await page.locator(".print-controls").all()) {
    await expect(control).toBeHidden();
  }
  await expect(preview.locator("[data-activity]")).toHaveCount(8);
  await expect(
    preview.locator("[data-instructional-visual]").first(),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
});
