// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema";
import { projectGenerationRequest } from "../../shared/worksheet/project-request";
import {
  REGISTERED_WORKSHEET_IDS,
  WORKSHEET_REGISTRY,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetControlContextV1,
  type WorksheetRelevantMaximumKey,
} from "../../shared/worksheet/registry";
import type {
  SentenceItemV1,
  WorksheetGeneratorV1,
} from "../../shared/worksheet/types";
import {
  MAX_ALTERNATIVE_SEED_ATTEMPTS,
  createWorksheetSessionForSeed,
  makeAnotherWorksheetSession,
  type GenerationSelection,
} from "../generator/create-session";
import { GeneratorControls } from "../generator/GeneratorControls";
import { WorksheetPreview } from "../preview/WorksheetPreview";
import { AnswerKeyView } from "../print/AnswerKeyView";
import { PrintView } from "../print/PrintView";
import { WEB_WORKSHEET_RENDERERS } from "./registry";

const profile: ChildProfileV1 = {
  id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
  displayName: "Private Morgan",
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
  interests: ["Private Topic"],
};

const quantityProfile: ChildProfileV1 = {
  id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
  displayName: "Private Riley",
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
  interests: ["Private Visual Topic"],
};

const preferences: GenerationDefaultsV1 = {
  useDisplayName: false,
  useInterests: false,
  includeDecorativeGraphics: false,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

const selection: GenerationSelection = {
  profile,
  preferences,
  stretchConfirmed: false,
  worksheetType: "dry-math",
};

function sessionFor(seed: number) {
  const result = createWorksheetSessionForSeed(selection, seed, {
    worksheetIdSource: () => "11111111-1111-4111-8111-111111111111",
  });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.session;
}

/** Quantities-only profile whose page must contain a one-dot statement. */
const smallQuantityProfile: ChildProfileV1 = {
  ...quantityProfile,
  id: "a1b2c3d4-1111-4111-8111-111111111111",
  mathSkills: {
    ...quantityProfile.mathSkills,
    countingMax: 4,
    numeralMax: 4,
    compareMax: 4,
  },
};

/** Every relevant maximum is stretchable: positive and below the V1 ceiling. */
const stretchProbeProfile: ChildProfileV1 = {
  ...profile,
  id: "b1b2c3d4-2222-4222-8222-222222222222",
  mathSkills: {
    ...profile.mathSkills,
    countingMax: 8,
    numeralMax: 8,
    compareMax: 8,
    operandMax: 8,
    resultMax: 8,
  },
};

/** Equation limits already at the V1 ceiling; counting limits below it. */
const equationsAtMaximumProfile: ChildProfileV1 = {
  ...profile,
  id: "c1b2c3d4-3333-4333-8333-333333333333",
  mathSkills: {
    ...profile.mathSkills,
    countingMax: 10,
    numeralMax: 10,
    operandMax: 20,
    resultMax: 20,
  },
};

const MAXIMUM_KEYS = [
  "countingMax",
  "numeralMax",
  "compareMax",
  "operandMax",
  "resultMax",
] as const satisfies readonly WorksheetRelevantMaximumKey[];

function wowSessionFor(
  sourceProfile: ChildProfileV1,
  seed: number,
  overrides: Partial<GenerationDefaultsV1> = {},
) {
  const result = createWorksheetSessionForSeed(
    {
      profile: sourceProfile,
      preferences: { ...preferences, ...overrides },
      stretchConfirmed: false,
      worksheetType: "find-the-wow",
    },
    seed,
    {
      worksheetIdSource: () => "55555555-5555-4555-8555-555555555555",
    },
  );
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.session;
}

function controlContextFor(
  sourceProfile: ChildProfileV1,
  difficulty: GenerationDefaultsV1["difficulty"] = "practice",
): WorksheetControlContextV1 {
  return {
    profile: sourceProfile,
    difficulty,
    length: "standard",
    printScale: "standard",
  };
}

function registryMaximumKeys(
  worksheetType: RegisteredWorksheetType,
  context: WorksheetControlContextV1,
): readonly WorksheetRelevantMaximumKey[] {
  return getWorksheetRegistration(worksheetType)
    .controls.getRelevantMaximums(context)
    .map(({ key }) => key);
}

/**
 * Observes which stored maxima the sole projection boundary actually scales,
 * instead of re-typing its private per-worksheet key list.
 */
function projectorStretchedKeys(
  worksheetType: RegisteredWorksheetType,
  sourceProfile: ChildProfileV1,
): readonly WorksheetRelevantMaximumKey[] {
  const project = (difficulty: GenerationDefaultsV1["difficulty"]) => {
    const projection = projectGenerationRequest({
      profile: sourceProfile,
      preferences: { ...preferences, difficulty },
      worksheetType,
      generatorVersion: getWorksheetRegistration(worksheetType).generatorVersion,
      seed: "00000001",
      stretchConfirmed: true,
    });
    if (!projection.ok) {
      throw new Error(projection.message);
    }
    return projection.request.capabilities.mathSkills;
  };
  const practice = project("practice");
  const stretch = project("stretch");
  return MAXIMUM_KEYS.filter((key) => stretch[key] !== practice[key]);
}

function renderControls(
  sourceProfile: ChildProfileV1,
  worksheetType: RegisteredWorksheetType,
  overrides: Partial<GenerationDefaultsV1> = {},
): void {
  render(
    createElement(GeneratorControls, {
      defaults: { ...preferences, ...overrides },
      onGenerate: vi.fn(),
      onInputsChanged: vi.fn(),
      profiles: [sourceProfile],
    }),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Worksheet type" }), {
    target: { value: worksheetType },
  });
  for (const details of document.querySelectorAll("details")) {
    details.open = true;
  }
}

function quantityImageLabels(): readonly string[] {
  return [...document.querySelectorAll('[role="img"]')].map((image) => {
    const marks = image.querySelectorAll("[data-quantity-mark]").length;
    const label = image.getAttribute("aria-label");
    expect(label).toBe(`${marks} ${marks === 1 ? "dot" : "dots"}`);
    return label ?? "";
  });
}

function parseVisibleEquation(choice: Element): {
  readonly displayed: number;
  readonly left: number;
  readonly right: number;
  readonly symbol: "+" | "−";
} {
  const statement = choice
    .querySelector("[data-visible-equation]")
    ?.textContent?.replace(/\s+/gu, " ")
    .trim();
  const match = statement?.match(/^(\d+)\s*([+−])\s*(\d+)\s*=\s*(\d+)$/u);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined || match[4] === undefined) {
    throw new Error(`A visible Wow equation could not be parsed: ${statement ?? "missing"}`);
  }
  return {
    left: Number(match[1]),
    symbol: match[2] as "+" | "−",
    right: Number(match[3]),
    displayed: Number(match[4]),
  };
}

afterEach(cleanup);

describe("worksheet renderer registry", () => {
  test("has exactly the same keys as the shared generator registry", () => {
    expect(Object.keys(WEB_WORKSHEET_RENDERERS).sort()).toEqual(
      Object.keys(WORKSHEET_REGISTRY).sort(),
    );
    expect(REGISTERED_WORKSHEET_IDS).toEqual(["dry-math", "find-the-wow"]);
  });

  test("relevant maximums follow the mode each family actually reads", () => {
    expect(registryMaximumKeys("dry-math", controlContextFor(profile))).toEqual([
      "operandMax",
      "resultMax",
    ]);
    expect(
      registryMaximumKeys("find-the-wow", controlContextFor(profile)),
    ).toEqual(["operandMax", "resultMax"]);
    expect(
      registryMaximumKeys(
        "find-the-wow",
        controlContextFor(profile, "confidence"),
      ),
    ).toEqual(["countingMax", "numeralMax"]);
    expect(
      registryMaximumKeys("find-the-wow", controlContextFor(quantityProfile)),
    ).toEqual(["countingMax", "numeralMax"]);
  });

  test("every declared relevant maximum is one the projector really stretches", () => {
    const observed: string[] = [];
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const sourceProfile of [
        stretchProbeProfile,
        quantityProfile,
        equationsAtMaximumProfile,
      ]) {
        for (const difficulty of ["confidence", "practice"] as const) {
          const declared = registryMaximumKeys(
            worksheetType,
            controlContextFor(sourceProfile, difficulty),
          ).filter(
            (key) =>
              sourceProfile.mathSkills[key] > 0 &&
              sourceProfile.mathSkills[key] < 20,
          );
          const stretched = projectorStretchedKeys(worksheetType, sourceProfile);
          for (const key of declared) {
            expect(
              stretched,
              `${worksheetType}/${sourceProfile.id}/${difficulty}/${key}`,
            ).toContain(key);
          }
          observed.push(...declared);
        }
      }
    }
    expect(new Set(observed)).toEqual(
      new Set(["countingMax", "numeralMax", "operandMax", "resultMax"]),
    );
  });

  test("WorksheetPreview reaches the registered Dry Math renderer", () => {
    const session = sessionFor(1);
    render(createElement(WorksheetPreview, { document: session.document }));
    expect(
      screen.getByRole("heading", { name: "Dry Math practice" }),
    ).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByLabelText("Worksheet preview")).toHaveAttribute(
      "data-worksheet-type",
      "dry-math",
    );
    expect(document.body).not.toHaveTextContent("Private Morgan");
    expect(document.body).not.toHaveTextContent("Private Topic");
  });

  test("WorksheetPreview reaches both registered Wow renderer variants", () => {
    for (const [sourceProfile, expectedMode] of [
      [quantityProfile, "quantity"],
      [profile, "equation"],
    ] as const) {
      const session = wowSessionFor(sourceProfile, 1);
      const { unmount } = render(
        createElement(WorksheetPreview, { document: session.document }),
      );
      expect(
        screen.getByRole("heading", {
          name: "Math — Two Whats and a Wow practice",
        }),
      ).toBeVisible();
      expect(screen.getByLabelText("Worksheet preview")).toHaveAttribute(
        "data-worksheet-type",
        "find-the-wow",
      );
      const groups = document.querySelectorAll(
        `[data-wow-group][data-wow-mode="${expectedMode}"]`,
      );
      expect(groups).toHaveLength(6);
      expect(document.querySelectorAll("[data-wow-choice]")).toHaveLength(18);
      expect(document.querySelectorAll("[data-circle-target]")).toHaveLength(18);
      expect(
        [...groups].every(
          (group) =>
            group.querySelectorAll("[data-choice-number]").length === 3 &&
            [...group.querySelectorAll("[data-choice-number]")]
              .map((node) => node.textContent?.trim())
              .join("") === "1.2.3.",
        ),
      ).toBe(true);
      expect(document.querySelector("[data-correct], [data-correct-position]")).toBeNull();
      if (expectedMode === "quantity") {
        for (const group of groups) {
          const choices = [...group.querySelectorAll("[data-wow-choice]")];
          const truths = choices.filter((choice) => {
            const numeralNode = choice.querySelector("[data-visible-numeral]");
            expect(numeralNode).toBeVisible();
            const numeralText = numeralNode?.textContent?.trim();
            expect(numeralText).toMatch(/^\d+$/u);
            const numeral = Number(numeralText);
            const visibleMarks = choice.querySelectorAll("[data-quantity-mark]");
            for (const mark of visibleMarks) {
              expect(mark).toBeVisible();
            }
            expect([...visibleMarks].every((mark) => mark.textContent === "●")).toBe(
              true,
            );
            expect(choice.querySelector('[role="img"]')).toHaveAttribute(
              "aria-label",
              `${visibleMarks.length} ${visibleMarks.length === 1 ? "dot" : "dots"}`,
            );
            return numeral === visibleMarks.length;
          });
          expect(truths).toHaveLength(1);
        }
      } else {
        expect(document.querySelectorAll("[data-quantity-mark]")).toHaveLength(0);
        for (const group of groups) {
          const choices = [...group.querySelectorAll("[data-wow-choice]")];
          for (const choice of choices) {
            expect(choice.querySelector("[data-visible-equation]")).toBeVisible();
          }
          for (const choice of choices) {
            const spoken = parseVisibleEquation(choice);
            expect(
              choice.querySelector("[data-visible-equation]"),
            ).toHaveAttribute(
              "aria-label",
              `${spoken.left} ${spoken.symbol === "+" ? "plus" : "minus"} ${spoken.right} equals ${spoken.displayed}`,
            );
          }
          const equations = choices.map(parseVisibleEquation);
          expect(
            equations.filter(({ displayed, left, right, symbol }) =>
              displayed === (symbol === "+" ? left + right : left - right),
            ),
          ).toHaveLength(1);
          expect(
            new Set(
              equations.map(
                ({ displayed, left, right, symbol }) =>
                  `${left}:${symbol}:${right}:${displayed}`,
              ),
            ).size,
          ).toBe(3);
        }
      }
      expect(document.body).not.toHaveTextContent(sourceProfile.displayName ?? "");
      expect(document.body).not.toHaveTextContent(sourceProfile.interests[0] ?? "");
      unmount();
    }
  });

  test("visible Wow numbering and independently recomputed truth map exactly to the parent key", () => {
    const session = wowSessionFor(profile, 0x9dcc_a8c5);
    const { unmount } = render(
      createElement(WorksheetPreview, { document: session.document }),
    );
    const worksheetAnswers = new Map<string, number>();
    for (const group of document.querySelectorAll("[data-wow-group]")) {
      const itemId = group.getAttribute("data-item-id");
      const truePositions = [...group.querySelectorAll("[data-wow-choice]")]
        .map((choice, position) => {
          const { displayed, left, right, symbol } = parseVisibleEquation(choice);
          const computed = symbol === "+" ? left + right : left - right;
          return displayed === computed ? position : -1;
        })
        .filter((position) => position !== -1);
      expect(truePositions).toHaveLength(1);
      if (itemId === null || truePositions[0] === undefined) {
        throw new Error("A rendered Wow group could not be keyed.");
      }
      worksheetAnswers.set(itemId, truePositions[0]);
    }
    unmount();

    render(createElement(AnswerKeyView, { document: session.document }));
    const keyItems = screen.getAllByRole("listitem");
    expect(keyItems).toHaveLength(6);
    for (const [index, keyItem] of keyItems.entries()) {
      const itemId = keyItem.getAttribute("data-item-id");
      const position = itemId === null ? undefined : worksheetAnswers.get(itemId);
      if (position === undefined) {
        throw new Error("A parent-key row had no worksheet truth match.");
      }
      const answer = `Choice ${position + 1}`;
      expect(
        keyItem.querySelector("[data-problem-number]")?.getAttribute(
          "data-problem-number",
        ),
      ).toBe(String(index + 1));
      expect(keyItem.querySelector("[data-answer-value]")).toHaveAttribute(
        "data-answer-value",
        answer,
      );
      expect(keyItem.textContent?.trim()).toBe(`${index + 1}. Answer: ${answer}`);
      expect(keyItem).not.toHaveTextContent(itemId ?? "missing-id");
    }
  });

  test("worksheet and answer key preserve exact item-ID and answer parity", () => {
    const session = sessionFor(0x9dcc_a8c5);
    const { unmount } = render(
      createElement(WorksheetPreview, { document: session.document }),
    );
    const worksheetIds = screen
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-item-id"));
    unmount();
    render(createElement(AnswerKeyView, { document: session.document }));
    expect(
      screen.getByText("Answers match the numbered problems on the worksheet."),
    ).toBeVisible();
    const keyItems = screen.getAllByRole("listitem");
    expect(keyItems.map((item) => item.getAttribute("data-item-id"))).toEqual(
      worksheetIds,
    );
    for (const [index, sourceItem] of session.document.items.entries()) {
      const keyItem = keyItems[index];
      if (keyItem === undefined || sourceItem.answerability !== "objective") {
        throw new Error("An objective answer-key entry was missing.");
      }
      if (sourceItem.itemType !== "dry-math") {
        throw new Error("The Dry Math fixture contained a different item type.");
      }
      const expectedExpression = `${sourceItem.leftOperand} ${sourceItem.renderedSymbol} ${sourceItem.rightOperand}`;
      expect(keyItem).not.toHaveTextContent(sourceItem.id);
      expect(
        keyItem.querySelector("[data-problem-number]")?.getAttribute(
          "data-problem-number",
        ),
      ).toBe(String(index + 1));
      expect(
        keyItem.querySelector("[data-source-expression]")?.getAttribute(
          "data-source-expression",
        ),
      ).toBe(expectedExpression);
      expect(
        keyItem.querySelector("[data-answer-value]")?.getAttribute(
          "data-answer-value",
        ),
      ).toBe(String(sourceItem.answer.value));
      expect(keyItem.querySelector("[data-answer-value]")?.textContent).toBe(
        String(sourceItem.answer.value),
      );
      expect(keyItem.textContent?.trim()).toBe(
        `${index + 1}. ${expectedExpression} = ${String(sourceItem.answer.value)}`,
      );
    }
    expect(document.body).not.toHaveTextContent("Private Morgan");
    expect(document.body).not.toHaveTextContent("Private Topic");
  });

  test("filters open items from the parent key", () => {
    const session = sessionFor(1);
    const openItem: SentenceItemV1 = {
      id: "item-013",
      itemType: "sentence",
      answerability: "open",
      answer: null,
      writingMode: "draw-and-tell",
      prompt: "Draw a private-free practice idea.",
      topicId: "neutral",
      requiredResponse: {
        drawing: true,
        dictation: true,
        labels: false,
        copying: false,
        writing: false,
      },
    };
    render(
      createElement(AnswerKeyView, {
        document: {
          ...session.document,
          items: [...session.document.items, openItem],
        },
      }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(document.querySelector('[data-item-id="item-013"]')).toBeNull();
  });

  test("makes the selected output surface visually and semantically explicit", () => {
    const session = sessionFor(1);
    render(createElement(PrintView, { document: session.document }));
    const worksheet = screen.getByRole("button", { name: "Worksheet" });
    const answerKey = screen.getByRole("button", { name: "Parent answer key" });
    expect(worksheet).toHaveAttribute("aria-pressed", "true");
    expect(worksheet).toHaveAttribute("data-selected", "true");
    expect(worksheet).toHaveStyle({ background: "#24324a", color: "#ffffff" });
    expect(answerKey).toHaveAttribute("aria-pressed", "false");
    expect(answerKey).toHaveAttribute("data-selected", "false");

    fireEvent.click(answerKey);
    expect(answerKey).toHaveAttribute("aria-pressed", "true");
    expect(answerKey).toHaveAttribute("data-selected", "true");
    expect(answerKey).toHaveStyle({ background: "#24324a", color: "#ffffff" });
    expect(worksheet).toHaveAttribute("aria-pressed", "false");
    expect(worksheet).toHaveAttribute("data-selected", "false");
  });
  test("names every dot image with a correctly pluralized accessible label", () => {
    const session = wowSessionFor(smallQuantityProfile, 1, { length: "short" });
    render(createElement(WorksheetPreview, { document: session.document }));
    const labels = quantityImageLabels();
    expect(labels).toHaveLength(12);
    expect(labels).toContain("1 dot");
    expect(labels.some((label) => /^(?!1 )\d+ dots$/u.test(label))).toBe(true);
    expect(labels).not.toContain("1 dots");
  });
});

describe("stretch controls", () => {
  test("never offers a stretch the active mode's limits cannot change", () => {
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      renderControls(equationsAtMaximumProfile, worksheetType, {
        difficulty: "stretch",
      });
      expect(screen.getByRole("option", { name: "Stretch" })).toBeDisabled();
      expect(
        screen.getByText(
          "Already at the V1 maximum; practice limits will be used.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/One-time stretch preview/u)).toBeNull();
      expect(
        screen.queryByLabelText(/Confirm these one-time stretch limits/u),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Create worksheet" }),
      ).toBeEnabled();
      cleanup();
    }
  });

  test("never renders an empty stretch preview beside a live confirmation", () => {
    renderControls(quantityProfile, "dry-math", { difficulty: "stretch" });
    expect(screen.queryByText(/One-time stretch preview/u)).toBeNull();
    expect(
      screen.queryByLabelText(/Confirm these one-time stretch limits/u),
    ).toBeNull();
    expect(
      screen.getByText(
        "This worksheet has no stretchable limits for this profile; practice limits will be used.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Stretch" })).toBeDisabled();
    cleanup();

    renderControls(quantityProfile, "find-the-wow", { difficulty: "stretch" });
    expect(
      screen.getByText(
        "One-time stretch preview: counting 10 \u2192 13; numerals 10 \u2192 13.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Confirm these one-time stretch limits/u),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Stretch" })).toBeEnabled();
  });
});

describe("Make another", () => {
  test("accepts the first seed that changes the canonical item content", () => {
    const current = sessionFor(1);
    const seedSource = vi.fn(() => 2);
    const result = makeAnotherWorksheetSession(current, selection, seedSource, {
      worksheetIdSource: () => "22222222-2222-4222-8222-222222222222",
    });
    expect(result.status).toBe("changed");
    expect(seedSource).toHaveBeenCalledTimes(1);
    if (result.status === "changed") {
      expect(result.session.contentKey).not.toBe(current.contentKey);
      expect(result.session.document.seed).toBe("00000002");
    }
  });

  test("counts zero, current, and duplicate-content draws inside the 16-attempt cap", () => {
    const current = sessionFor(1);
    const candidateValues = [0, 1, ...Array.from({ length: 14 }, (_, index) => index + 2)];
    const seedSource = vi.fn(() => candidateValues.shift() ?? 99);
    const duplicateGenerator = vi.fn<WorksheetGeneratorV1>(
      (request, context) => ({
        ok: true,
        document: {
          ...current.document,
          request,
          seed: request.seed,
          worksheetId: context.worksheetId,
        },
      }),
    );
    const result = makeAnotherWorksheetSession(current, selection, seedSource, {
      generator: duplicateGenerator,
      worksheetIdSource: () => "33333333-3333-4333-8333-333333333333",
    });
    expect(result).toMatchObject({ status: "exhausted" });
    expect(seedSource).toHaveBeenCalledTimes(MAX_ALTERNATIVE_SEED_ATTEMPTS);
    expect(duplicateGenerator).toHaveBeenCalledTimes(14);
    expect(current.document.seed).toBe("00000001");
  });

  test("age support fails before a lifecycle ID or injected generator is called", () => {
    const worksheetIdSource = vi.fn(
      () => "44444444-4444-4444-8444-444444444444",
    );
    const generator = vi.fn<WorksheetGeneratorV1>();
    const result = createWorksheetSessionForSeed(
      {
        ...selection,
        profile: { ...profile, ageYears: 9 },
      },
      1,
      { generator, worksheetIdSource },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "GENERATION_AGE_UNSUPPORTED",
    });
    expect(worksheetIdSource).not.toHaveBeenCalled();
    expect(generator).not.toHaveBeenCalled();
  });
});
