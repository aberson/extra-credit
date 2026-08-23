import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../src/shared/config/schema.ts";
import { expect, test } from "./fixtures/app-server.ts";

const defaults: GenerationDefaultsV1 = {
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
    interests: ["Distinctive Private Space"],
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
    interests: ["Distinctive Private Nature"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Taylor",
    ageYears: 7,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 20,
      numeralMax: 20,
      compareMax: 20,
      representations: ["equations"],
      understandsEquality: false,
      operations: ["addition", "subtraction"],
      operandMax: 10,
      resultMax: 10,
      allowRegrouping: false,
      allowNegativeResults: false,
    },
    writingMode: "sentence-frame",
    interests: ["Distinctive Private Vehicles"],
  },
] as const satisfies readonly ChildProfileV1[];

interface DomChoice {
  readonly choiceNumberText: string | null;
  readonly circleCount: number;
  readonly equationText: string | null;
  readonly equationVisible: boolean;
  readonly imgLabel: string | null;
  readonly marksVisible: boolean;
  readonly markTexts: readonly string[];
  readonly numeralText: string | null;
  readonly numeralVisible: boolean;
}

interface DomGroup {
  readonly choices: readonly DomChoice[];
  readonly id: string | null;
  readonly mode: string | null;
}

interface KeyRow {
  readonly answer: string | null;
  readonly id: string | null;
  readonly number: string | null;
  readonly text: string;
}

interface VisibleEquation {
  readonly displayed: number;
  readonly left: number;
  readonly right: number;
  readonly symbol: "+" | "−";
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function readGroups(preview: Locator): Promise<readonly DomGroup[]> {
  return await preview.locator("[data-wow-group]").evaluateAll((groups) => {
    return groups.map((group) => ({
      id: group.getAttribute("data-item-id"),
      mode: group.getAttribute("data-wow-mode"),
      choices: [...group.querySelectorAll("[data-wow-choice]")].map((choice) => {
        const equation = choice.querySelector("[data-visible-equation]");
        const marks = [...choice.querySelectorAll("[data-quantity-mark]")];
        const numeral = choice.querySelector("[data-visible-numeral]");
        const equationStyle =
          equation?.ownerDocument.defaultView?.getComputedStyle(equation);
        const equationBounds = equation?.getBoundingClientRect();
        const numeralStyle =
          numeral?.ownerDocument.defaultView?.getComputedStyle(numeral);
        const numeralBounds = numeral?.getBoundingClientRect();
        return {
          choiceNumberText:
            choice
              .querySelector("[data-choice-number]")
              ?.textContent?.trim() ?? null,
          circleCount: choice.querySelectorAll("[data-circle-target]").length,
          equationText:
            equation?.textContent?.replace(/\s+/gu, " ").trim() ?? null,
          equationVisible:
            equationStyle?.display !== "none" &&
            equationStyle?.visibility !== "hidden" &&
            (equationBounds?.width ?? 0) > 0 &&
            (equationBounds?.height ?? 0) > 0,
          imgLabel:
            choice
              .querySelector('[role="img"]')
              ?.getAttribute("aria-label") ?? null,
          marksVisible:
            marks.length > 0 &&
            marks.every((mark) => {
              const style =
                mark.ownerDocument.defaultView?.getComputedStyle(mark);
              const bounds = mark.getBoundingClientRect();
              return (
                style?.display !== "none" &&
                style?.visibility !== "hidden" &&
                bounds.width > 0 &&
                bounds.height > 0
              );
            }),
          markTexts: marks.map((mark) => mark.textContent ?? ""),
          numeralText: numeral?.textContent?.trim() ?? null,
          numeralVisible:
            numeralStyle?.display !== "none" &&
            numeralStyle?.visibility !== "hidden" &&
            (numeralBounds?.width ?? 0) > 0 &&
            (numeralBounds?.height ?? 0) > 0,
        };
      }),
    }));
  });
}

function balanced(answers: ReadonlyMap<string, number>): void {
  const counts = [0, 0, 0];
  for (const position of answers.values()) {
    counts[position] = (counts[position] ?? 0) + 1;
  }
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
}

function visibleChoiceNumbers(group: DomGroup): readonly number[] {
  return group.choices.map(({ choiceNumberText }) => {
    const match = choiceNumberText?.match(/^(\d+)\.$/u);
    if (match?.[1] === undefined) {
      throw new Error(`A visible choice number was missing: ${choiceNumberText}`);
    }
    return Number(match[1]);
  });
}

function visibleNumeral(choice: DomChoice): number {
  if (choice.numeralText?.match(/^\d+$/u) === null || choice.numeralText === null) {
    throw new Error(`A visible numeral was missing: ${choice.numeralText}`);
  }
  return Number(choice.numeralText);
}

function quantityOracle(
  groups: readonly DomGroup[],
  effectiveLimit: number,
): Map<string, number> {
  expect(groups).toHaveLength(6);
  const answers = new Map<string, number>();
  for (const group of groups) {
    expect(group.mode).toBe("quantity");
    expect(visibleChoiceNumbers(group)).toEqual([1, 2, 3]);
    expect(group.choices.every(({ circleCount }) => circleCount === 1)).toBe(true);
    const numerals = group.choices.map(visibleNumeral);
    const quantities = group.choices.map(({ markTexts }) => markTexts.length);
    expect(new Set(numerals).size).toBe(1);
    expect(new Set(quantities).size).toBe(3);
    expect(
      new Set(
        group.choices.map(
          (choice) => `${visibleNumeral(choice)}:${choice.markTexts.length}`,
        ),
      ).size,
    ).toBe(3);
    for (const choice of group.choices) {
      const numeral = visibleNumeral(choice);
      const quantity = choice.markTexts.length;
      expect(choice.equationText).toBeNull();
      expect(choice.equationVisible).toBe(false);
      expect(choice.numeralVisible).toBe(true);
      expect(choice.marksVisible).toBe(true);
      expect(choice.markTexts.every((mark) => mark === "●")).toBe(true);
      expect(numeral).toBeGreaterThanOrEqual(1);
      expect(numeral).toBeLessThanOrEqual(effectiveLimit);
      expect(quantity).toBeGreaterThanOrEqual(1);
      expect(quantity).toBeLessThanOrEqual(effectiveLimit);
      expect(choice.imgLabel).toBe(
        `${quantity} ${quantity === 1 ? "dot" : "dots"}`,
      );
    }
    const truePositions = group.choices
      .map((choice, position) =>
        visibleNumeral(choice) === choice.markTexts.length ? position : -1,
      )
      .filter((position) => position !== -1);
    expect(truePositions).toHaveLength(1);
    if (group.id === null || truePositions[0] === undefined) {
      throw new Error("A quantity group had no independently visible answer.");
    }
    for (const [position, choice] of group.choices.entries()) {
      if (position !== truePositions[0]) {
        expect(choice.markTexts.length - visibleNumeral(choice)).not.toBe(0);
      }
    }
    answers.set(group.id, truePositions[0]);
  }
  balanced(answers);
  return answers;
}

function carries(left: number, right: number): boolean {
  while (left > 0 || right > 0) {
    if ((left % 10) + (right % 10) >= 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

function borrows(left: number, right: number): boolean {
  while (left > 0 || right > 0) {
    if (left % 10 < right % 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

function parseVisibleEquation(choice: DomChoice): VisibleEquation {
  const match = choice.equationText?.match(
    /^(\d+)\s*([+−])\s*(\d+)\s*=\s*(\d+)$/u,
  );
  if (
    match?.[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined ||
    match[4] === undefined
  ) {
    throw new Error(
      `A child-visible equation could not be parsed: ${choice.equationText ?? "missing"}`,
    );
  }
  return {
    left: Number(match[1]),
    symbol: match[2] as "+" | "−",
    right: Number(match[3]),
    displayed: Number(match[4]),
  };
}

function equationOracle(groups: readonly DomGroup[]): Map<string, number> {
  expect(groups).toHaveLength(6);
  const answers = new Map<string, number>();
  for (const group of groups) {
    expect(group.mode).toBe("equation");
    expect(visibleChoiceNumbers(group)).toEqual([1, 2, 3]);
    expect(group.choices.every(({ circleCount }) => circleCount === 1)).toBe(true);
    expect(group.choices.every(({ markTexts }) => markTexts.length === 0)).toBe(
      true,
    );
    expect(
      new Set(group.choices.map(({ equationText }) => equationText)).size,
    ).toBe(3);
    const truePositions: number[] = [];
    for (const [position, choice] of group.choices.entries()) {
      expect(choice.numeralText).toBeNull();
      expect(choice.numeralVisible).toBe(false);
      expect(choice.equationVisible).toBe(true);
      const equation = parseVisibleEquation(choice);
      expect(equation.left).toBeGreaterThanOrEqual(0);
      expect(equation.right).toBeGreaterThanOrEqual(0);
      expect(equation.left).toBeLessThanOrEqual(10);
      expect(equation.right).toBeLessThanOrEqual(10);
      expect(equation.displayed).toBeGreaterThanOrEqual(0);
      expect(equation.displayed).toBeLessThanOrEqual(10);
      const computed =
        equation.symbol === "+"
          ? equation.left + equation.right
          : equation.left - equation.right;
      expect(computed).toBeGreaterThanOrEqual(0);
      expect(computed).toBeLessThanOrEqual(10);
      expect(
        equation.symbol === "+"
          ? carries(equation.left, equation.right)
          : borrows(equation.left, equation.right),
      ).toBe(false);
      if (equation.displayed === computed) {
        truePositions.push(position);
      } else {
        expect(equation.displayed - computed).not.toBe(0);
      }
    }
    expect(truePositions).toHaveLength(1);
    if (group.id === null || truePositions[0] === undefined) {
      throw new Error("An equation group had no independently visible answer.");
    }
    answers.set(group.id, truePositions[0]);
  }
  balanced(answers);
  expect([...answers.values()].sort()).toEqual([0, 0, 1, 1, 2, 2]);
  return answers;
}

function spokenEquation(choice: DomChoice): string {
  const { displayed, left, right, symbol } = parseVisibleEquation(choice);
  return `${left} ${symbol === "+" ? "plus" : "minus"} ${right} equals ${displayed}`;
}

/**
 * The equation a screen reader announces must match the equation the child
 * reads, derived independently from the visible statement.
 */
async function expectEquationAccessibleNames(
  preview: Locator,
  groups: readonly DomGroup[],
): Promise<void> {
  const spoken = groups.flatMap((group) => group.choices.map(spokenEquation));
  const equations = preview.locator("[data-visible-equation]");
  await expect(equations).toHaveCount(spoken.length);
  for (const [index, name] of spoken.entries()) {
    await expect(equations.nth(index)).toHaveAccessibleName(name);
  }
}

/** plan.md:255 makes 320 CSS pixels an explicit reflow target. */
async function expectNarrowReflow(
  page: Page,
  preview: Locator,
  expectedGroups: number,
): Promise<void> {
  const original = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(preview.locator("[data-wow-group]")).toHaveCount(expectedGroups);
  const metrics = await preview.evaluate((node) => {
    const root = node.ownerDocument.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      groups: [...node.querySelectorAll("[data-wow-group]")].map((group) => {
        const bounds = group.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: bounds.width };
      }),
    };
  });
  expect(metrics.clientWidth).toBeGreaterThan(280);
  expect(metrics.clientWidth).toBeLessThanOrEqual(320);
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(metrics.groups).toHaveLength(expectedGroups);
  for (const group of metrics.groups) {
    expect(group.width).toBeGreaterThan(0);
    expect(group.left).toBeGreaterThanOrEqual(-0.5);
    expect(group.right).toBeLessThanOrEqual(metrics.clientWidth + 0.5);
  }
  if (original !== null) {
    await page.setViewportSize(original);
  }
}

async function readAndVerifyKey(
  answerSurface: Locator,
  worksheetAnswers: ReadonlyMap<string, number>,
): Promise<void> {
  const rows = await answerSurface
    .locator('ol[aria-label="Objective answers"] > li')
    .evaluateAll((items) =>
      items.map((item) => ({
        answer:
          item
            .querySelector("[data-answer-value]")
            ?.getAttribute("data-answer-value") ?? null,
        id: item.getAttribute("data-item-id"),
        number:
          item
            .querySelector("[data-problem-number]")
            ?.getAttribute("data-problem-number") ?? null,
        text: item.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      })),
    );
  expect(rows).toHaveLength(6);
  expect(rows.map(({ id }) => id)).toEqual([...worksheetAnswers.keys()]);
  for (const [index, row] of (rows as readonly KeyRow[]).entries()) {
    const position = row.id === null ? undefined : worksheetAnswers.get(row.id);
    if (position === undefined) {
      throw new Error("A parent-key row did not map to a worksheet group.");
    }
    const expectedAnswer = `Choice ${position + 1}`;
    expect(row.number).toBe(String(index + 1));
    expect(row.answer).toBe(expectedAnswer);
    expect(row.text).toBe(`${index + 1}. Answer: ${expectedAnswer}`);
    expect(row.text).not.toContain(row.id);
  }
}

async function setFixedSeed(page: Page, seed: number): Promise<void> {
  await page.evaluate((nextSeed) => {
    const browser = globalThis as unknown as {
      __extraCreditFixedSeed?: number;
      __extraCreditSeedDraws?: number;
    };
    browser.__extraCreditFixedSeed = nextSeed;
    browser.__extraCreditSeedDraws = 0;
  }, seed);
}

test("renders quantity, unavailable, equation, and confidence Wow through the compiled UI", async ({
  appServer,
  page,
}) => {
  test.setTimeout(75_000);
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.addInitScript(() => {
    const browser = globalThis as unknown as {
      __extraCreditFixedSeed?: number;
      __extraCreditSeedDraws?: number;
    };
    browser.__extraCreditFixedSeed = 1;
    browser.__extraCreditSeedDraws = 0;
    const browserCrypto = (globalThis as unknown as {
      crypto: { getRandomValues: (array: ArrayBufferView) => ArrayBufferView };
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
  await expect(
    page.getByText("Saved profiles reloaded from the local file."),
  ).toBeVisible();
  const profileSelect = page.getByRole("combobox", { name: "Child profile" });
  const worksheetSelect = page.getByRole("combobox", {
    name: "Worksheet type",
  });
  const createButton = page.getByRole("button", { name: "Create worksheet" });
  await expect(worksheetSelect).toBeEnabled();
  await expect(
    worksheetSelect.locator('option[value="find-the-wow"]'),
  ).toHaveText("Math — Two Whats and a Wow");
  await worksheetSelect.selectOption("find-the-wow");

  await expect(page.getByText(/use quantity mode for Two Whats and a Wow/)).toBeVisible();
  await expect(createButton).toBeEnabled();
  await expect(
    page.getByText("This selection creates 6 unique groups on one practice page."),
  ).toBeVisible();
  await page.getByText("More options").click();
  const difficultySelect = page.getByRole("combobox", { name: "Difficulty" });
  const lengthSelect = page.getByRole("combobox", { name: "Length" });
  const printScaleSelect = page.getByRole("combobox", { name: "Print scale" });
  await printScaleSelect.selectOption("large");
  await expect(
    lengthSelect.locator('option[value="standard"]'),
  ).toHaveText("Standard · 4 groups");
  await expect(
    page.getByText("This selection creates 4 unique groups on one practice page."),
  ).toBeVisible();
  await printScaleSelect.selectOption("standard");
  await expect(
    page.getByText("This selection creates 6 unique groups on one practice page."),
  ).toBeVisible();
  await expect(page.getByLabel(/interest/i)).toHaveCount(0);
  await expect(page.getByLabel(/decorative/i)).toHaveCount(0);
  await page.getByLabel("Put the nickname in the worksheet header").uncheck();

  await setFixedSeed(page, 1);
  await createButton.click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "find-the-wow");
  await expect(preview).toHaveAttribute("data-seed", "00000001");
  await expect(preview.locator('[data-wow-mode="quantity"]')).toHaveCount(6);
  const quantityGroups = await readGroups(preview);
  const quantityAnswers = quantityOracle(quantityGroups, 10);
  await expect(
    page.getByText("Worksheet ready with 6 unique groups."),
  ).toBeVisible();
  await expectNarrowReflow(page, preview, 6);
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { __extraCreditSeedDraws?: number })
          .__extraCreditSeedDraws,
    ),
  ).toBe(1);
  await expect(preview.locator("[data-correct], [data-correct-position]")).toHaveCount(
    0,
  );
  await expect(preview).not.toContainText("Riley");
  await expect(preview).not.toContainText("Distinctive Private Space");
  await expectAccessible(page);

  await setFixedSeed(page, 1);
  await createButton.click();
  await expect(preview).toHaveAttribute("data-seed", "00000001");
  expect(await readGroups(preview)).toEqual(quantityGroups);
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { __extraCreditSeedDraws?: number })
          .__extraCreditSeedDraws,
    ),
  ).toBe(1);

  const worksheetSurfaceButton = page.getByRole("button", {
    name: "Worksheet",
    exact: true,
  });
  const answerKeySurfaceButton = page.getByRole("button", {
    name: "Parent answer key",
  });
  await answerKeySurfaceButton.click();
  const answerSurface = page.locator(".print-surface[data-surface='answer']");
  await expect(answerSurface).toBeVisible();
  await readAndVerifyKey(answerSurface, quantityAnswers);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".profile-workspace")).toBeHidden();
  for (const control of await page.locator(".print-controls").all()) {
    await expect(control).toBeHidden();
  }
  await expect(answerSurface).toBeVisible();
  await expect(page.locator("[data-circle-target]")).toHaveCount(0);
  await page.emulateMedia({ media: "screen" });
  await worksheetSurfaceButton.click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-circle-target]")).toHaveCount(18);
  const circleStyles = await page.locator("[data-circle-target]").evaluateAll(
    (circles) =>
      circles.map((circle) => {
        const style = circle.ownerDocument.defaultView?.getComputedStyle(circle);
        const bounds = circle.getBoundingClientRect();
        return {
          borderStyle: style?.borderTopStyle ?? "",
          borderWidth: Number.parseFloat(style?.borderTopWidth ?? "0"),
          height: bounds.height,
          radius: style?.borderTopLeftRadius ?? "0px",
          width: bounds.width,
        };
      }),
  );
  for (const circle of circleStyles) {
    expect(circle.borderStyle).toBe("solid");
    expect(circle.borderWidth).toBeGreaterThan(0);
    expect(circle.width).toBeGreaterThan(0);
    expect(circle.height).toBeGreaterThan(0);
    expect(Math.abs(circle.width - circle.height)).toBeLessThan(1);
    expect(circle.radius).not.toBe("0px");
  }
  await expect(page.locator("[data-quantity-mark]")).not.toHaveCount(0);
  await page.emulateMedia({ media: "screen" });

  await profileSelect.selectOption(profiles[2].id);
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Parent answer key" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make another" })).toHaveCount(0);
  await expect(page.getByText(/Worksheet ready with/)).toHaveCount(0);
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);
  await expect(createButton).toBeDisabled();
  await expect(
    page.getByText(
      /needs confirmed quantities, or equations with equality understanding and an enabled operation/,
    ),
  ).toBeVisible();
  await expectAccessible(page);

  await profileSelect.selectOption(profiles[1].id);
  await expect(page.getByText(/use equation mode for Two Whats and a Wow/)).toBeVisible();
  await expect(createButton).toBeEnabled();
  await setFixedSeed(page, 2);
  await createButton.click();
  await expect(preview).toHaveAttribute("data-seed", "00000002");
  await expect(preview.locator('[data-wow-mode="equation"]')).toHaveCount(6);
  const equationGroups = await readGroups(preview);
  const equationAnswers = equationOracle(equationGroups);
  await expectEquationAccessibleNames(preview, equationGroups);
  await expect(
    page.getByText("Worksheet ready with 6 unique groups."),
  ).toBeVisible();
  await expectNarrowReflow(page, preview, 6);
  await expect(preview.locator("[data-quantity-mark]")).toHaveCount(0);
  await expect(preview).not.toContainText("Morgan");
  await expect(preview).not.toContainText("Distinctive Private Nature");
  await expectAccessible(page);

  await setFixedSeed(page, 2);
  await createButton.click();
  await expect(preview).toHaveAttribute("data-seed", "00000002");
  expect(await readGroups(preview)).toEqual(equationGroups);
  expect(
    await page.evaluate(
      () =>
        (globalThis as unknown as { __extraCreditSeedDraws?: number })
          .__extraCreditSeedDraws,
    ),
  ).toBe(1);

  await answerKeySurfaceButton.click();
  await expect(answerSurface).toBeVisible();
  await readAndVerifyKey(answerSurface, equationAnswers);
  await page.emulateMedia({ media: "print" });
  await expect(answerSurface).toBeVisible();
  await expect(page.locator("[data-circle-target]")).toHaveCount(0);
  await page.emulateMedia({ media: "screen" });
  await worksheetSurfaceButton.click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator('[data-wow-mode="equation"]')).toHaveCount(6);
  await expect(page.locator("[data-circle-target]")).toHaveCount(18);
  await page.emulateMedia({ media: "screen" });
  await answerKeySurfaceButton.click();
  await expectAccessible(page);

  await difficultySelect.selectOption("confidence");
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await expect(page.getByText(/use quantity mode for Two Whats and a Wow/)).toBeVisible();
  await setFixedSeed(page, 3);
  await createButton.click();
  await expect(preview).toHaveAttribute("data-seed", "00000003");
  await expect(preview.locator('[data-wow-mode="quantity"]')).toHaveCount(6);
  const confidenceGroups = await readGroups(preview);
  const confidenceAnswers = quantityOracle(confidenceGroups, 15);
  await expect(preview.locator("[data-visible-equation]")).toHaveCount(0);
  await answerKeySurfaceButton.click();
  await readAndVerifyKey(answerSurface, confidenceAnswers);

  await worksheetSelect.selectOption("dry-math");
  await expect(page.getByLabel("Worksheet preview")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Parent answer key" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make another" })).toHaveCount(0);
});
