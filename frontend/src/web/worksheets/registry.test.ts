// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  WRITING_MODES,
  type ChildProfileV1,
  type GenerationDefaultsV1,
} from "../../shared/config/schema";
import { projectGenerationRequest } from "../../shared/worksheet/project-request";
import {
  REGISTERED_WORKSHEET_IDS,
  WORKSHEET_REGISTRY,
  getWorksheetRegistration,
  type RegisteredWorksheetType,
  type WorksheetApplicableControlsV1,
  type WorksheetControlContextV1,
  type WorksheetRelevantMaximumKey,
} from "../../shared/worksheet/registry";
import type {
  GenerationRequestV1,
  SentenceItemV1,
  WorksheetGeneratorV1,
} from "../../shared/worksheet/types";
import {
  SENTENCE_BUILDER_BANK_BUDGETS,
  SENTENCE_BUILDER_ITEM_COUNT,
} from "../../worksheets/sentence-builder/definition";
import {
  BANK_WRITING_MODES,
  SENTENCE_BUILDER_VOCABULARY,
} from "../../worksheets/sentence-builder/vocabulary";
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

const BANK_MODES: readonly ChildProfileV1["writingMode"][] =
  BANK_WRITING_MODES;

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
    expect(REGISTERED_WORKSHEET_IDS).toEqual([
      "dry-math",
      "find-the-wow",
      "sentence-builder",
    ]);
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
      if (
        !getWorksheetRegistration(worksheetType).controls.getApplicableControls(
          controlContextFor(equationsAtMaximumProfile),
        ).difficulty
      ) {
        continue;
      }
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

/**
 * Every parent control the registry can expose, paired with two preference
 * values and the canonical value a family that HIDES the control must project.
 * `undefined` means the allowlisted request must omit the property entirely.
 */
const CONTROL_PROBES = [
  {
    canonicalWhenHidden: "practice",
    key: "difficulty",
    observe: (request: GenerationRequestV1) => request.options.difficulty,
    values: [{ difficulty: "practice" }, { difficulty: "confidence" }],
  },
  {
    canonicalWhenHidden: "standard",
    key: "length",
    observe: (request: GenerationRequestV1) => request.options.length,
    values: [{ length: "standard" }, { length: "long" }],
  },
  {
    canonicalWhenHidden: false,
    key: "includeAnswerKey",
    observe: (request: GenerationRequestV1) => request.options.includeAnswerKey,
    values: [{ includeAnswerKey: true }, { includeAnswerKey: false }],
  },
  {
    canonicalWhenHidden: false,
    key: "includeDecorativeGraphics",
    observe: (request: GenerationRequestV1) =>
      request.options.includeDecorativeGraphics,
    values: [
      { includeDecorativeGraphics: true },
      { includeDecorativeGraphics: false },
    ],
  },
  {
    canonicalWhenHidden: "letter",
    key: "paperSize",
    observe: (request: GenerationRequestV1) => request.options.paperSize,
    values: [{ paperSize: "letter" }, { paperSize: "a4" }],
  },
  {
    canonicalWhenHidden: "standard",
    key: "printScale",
    observe: (request: GenerationRequestV1) => request.options.printScale,
    values: [{ printScale: "standard" }, { printScale: "large" }],
  },
  {
    canonicalWhenHidden: undefined,
    key: "useDisplayName",
    observe: (request: GenerationRequestV1) => request.displayName,
    values: [{ useDisplayName: true }, { useDisplayName: false }],
  },
  {
    canonicalWhenHidden: undefined,
    key: "useInterests",
    observe: (request: GenerationRequestV1) => request.topicIds,
    values: [{ useInterests: true }, { useInterests: false }],
  },
] as const satisfies readonly {
  readonly canonicalWhenHidden: unknown;
  readonly key: keyof WorksheetApplicableControlsV1;
  readonly observe: (request: GenerationRequestV1) => unknown;
  readonly values: readonly [
    Partial<GenerationDefaultsV1>,
    Partial<GenerationDefaultsV1>,
  ];
}[];

const contractPreferences: GenerationDefaultsV1 = {
  ...preferences,
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  includeAnswerKey: true,
};

/** Reviewed interest so `useInterests` can actually change a request. */
function contractProfile(
  overrides: Partial<ChildProfileV1> = {},
): ChildProfileV1 {
  return { ...profile, interests: ["Space"], ...overrides };
}

const CONTRACT_PROFILES: Readonly<
  Record<RegisteredWorksheetType, readonly ChildProfileV1[]>
> = {
  "dry-math": [contractProfile()],
  "find-the-wow": [
    contractProfile(),
    contractProfile({ ...quantityProfile, interests: ["Space"] }),
  ],
  "sentence-builder": WRITING_MODES.map((writingMode) =>
    contractProfile({ writingMode }),
  ),
};

/**
 * Mirrors exactly what `GeneratorControls.submit` does: run the registration's
 * own `projectPreferences`, then hand the result to the sole projection
 * boundary. Any disagreement between the two shows up here.
 */
function contractRequest(
  worksheetType: RegisteredWorksheetType,
  sourceProfile: ChildProfileV1,
  overrides: Partial<GenerationDefaultsV1>,
): GenerationRequestV1 {
  const registration = getWorksheetRegistration(worksheetType);
  const merged: GenerationDefaultsV1 = { ...contractPreferences, ...overrides };
  const context: WorksheetControlContextV1 = {
    difficulty: merged.difficulty,
    length: merged.length,
    printScale: merged.printScale,
    profile: sourceProfile,
  };
  const projection = projectGenerationRequest({
    generatorVersion: registration.generatorVersion,
    preferences: registration.controls.projectPreferences(context, merged),
    profile: sourceProfile,
    seed: "00000001",
    stretchConfirmed: true,
    worksheetType,
  });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  return projection.request;
}

describe("worksheet control contract matches the projection boundary", () => {
  test("a hidden control never reaches the request, and a shown control always does", () => {
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const sourceProfile of CONTRACT_PROFILES[worksheetType]) {
        const applicable = getWorksheetRegistration(
          worksheetType,
        ).controls.getApplicableControls(controlContextFor(sourceProfile));
        for (const probe of CONTROL_PROBES) {
          const first = probe.observe(
            contractRequest(worksheetType, sourceProfile, probe.values[0]),
          );
          const second = probe.observe(
            contractRequest(worksheetType, sourceProfile, probe.values[1]),
          );
          const label = `${worksheetType}/${sourceProfile.writingMode}/${probe.key}`;
          if (applicable[probe.key]) {
            expect(first, label).not.toEqual(second);
          } else {
            expect(first, label).toEqual(second);
            expect(first, label).toEqual(probe.canonicalWhenHidden);
          }
        }
      }
    }
  });

  test("Sentence Builder hides difficulty and the answer key for every writing mode", () => {
    for (const writingMode of WRITING_MODES) {
      const sourceProfile = contractProfile({ writingMode });
      const applicable = getWorksheetRegistration(
        "sentence-builder",
      ).controls.getApplicableControls(controlContextFor(sourceProfile));
      expect(applicable.difficulty).toBe(false);
      expect(applicable.includeAnswerKey).toBe(false);
      expect(applicable.length).toBe(BANK_MODES.includes(writingMode));
      expect(applicable.useInterests).toBe(true);
      expect(applicable.includeDecorativeGraphics).toBe(true);
      const request = contractRequest("sentence-builder", sourceProfile, {
        difficulty: "stretch",
        includeAnswerKey: true,
        length: "long",
      });
      expect(request.options.difficulty).toBe("practice");
      expect(request.options.includeAnswerKey).toBe(false);
      expect(request.options.length).toBe(
        applicable.length ? "long" : "standard",
      );
    }
  });

  test("declared relevant maximums stay empty for the age-free writing family", () => {
    for (const writingMode of WRITING_MODES) {
      expect(
        registryMaximumKeys(
          "sentence-builder",
          controlContextFor(contractProfile({ writingMode })),
        ),
      ).toEqual([]);
    }
  });

  test("the effective unit reads true in both consumer sentences", () => {
    const bankContext = controlContextFor(
      contractProfile({ writingMode: "independent" }),
    );
    const bankUnit = getWorksheetRegistration(
      "sentence-builder",
    ).controls.getEffectiveUnit(bankContext);
    expect(bankUnit.count).toBe(8);
    // GeneratorControls says "This selection creates {count} unique {plural}".
    expect(bankUnit.pluralLabel).toBe("word-bank words");
    // App says "Worksheet ready with {items.length} unique {singular}", and a
    // Sentence Builder page always holds exactly one item.
    expect(bankUnit.singularLabel).toBe("writing prompt");

    expect(
      getWorksheetRegistration("sentence-builder").controls.getEffectiveUnit(
        controlContextFor(contractProfile({ writingMode: "copy-with-model" })),
      ),
    ).toEqual({
      count: 1,
      pluralLabel: "writing prompts",
      singularLabel: "writing prompt",
    });

    expect(
      getWorksheetRegistration("sentence-builder").controls.getEffectiveUnit({
        ...bankContext,
        length: "long",
        printScale: "large",
      }).count,
    ).toBe(8);
  });

  test("the label a count selects always reads true for that count", () => {
    // `WorksheetEffectiveUnitV1` lets sentence-builder name two different
    // nouns only while the singular branch stays unreachable for a bank mode.
    // Both numeric preconditions that keep it unreachable are pinned here, so
    // a one-entry bank budget or a multi-item page fails CI instead of
    // printing "creates 1 unique writing prompt" over a one-word bank.
    for (const writingMode of BANK_WRITING_MODES) {
      for (const length of WORKSHEET_LENGTHS) {
        expect(
          SENTENCE_BUILDER_BANK_BUDGETS[writingMode][length],
          `${writingMode}/${length}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
    expect(SENTENCE_BUILDER_ITEM_COUNT).toBe(1);
    for (const writingMode of WRITING_MODES) {
      expect(
        sentenceSessionFor(writingMode).document.items,
        writingMode,
      ).toHaveLength(SENTENCE_BUILDER_ITEM_COUNT);
    }

    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const sourceProfile of CONTRACT_PROFILES[worksheetType]) {
        for (const length of WORKSHEET_LENGTHS) {
          for (const printScale of PRINT_SCALES) {
            const unit = getWorksheetRegistration(
              worksheetType,
            ).controls.getEffectiveUnit({
              ...controlContextFor(sourceProfile),
              length,
              printScale,
            });
            const selected =
              unit.count === 1 ? unit.singularLabel : unit.pluralLabel;
            const sentence = `${worksheetType}/${sourceProfile.writingMode}/${length}/${printScale}: "${unit.count} unique ${selected}"`;
            expect(unit.count, sentence).toBeGreaterThanOrEqual(1);
            expect(selected.length, sentence).toBeGreaterThan(0);
            // Grammatical number of the printed label must match the number
            // printed beside it: plural noun iff the count is not one.
            expect(selected.endsWith("s"), sentence).toBe(unit.count !== 1);
          }
        }
      }
    }
  });
});

const SENTENCE_SURFACES = {
  "draw-and-tell": {
    bankWords: 0,
    copyLines: 0,
    dictationNotes: 1,
    drawingAreas: 1,
    labelLines: 0,
    modelSentences: 0,
    requiredResponse: "drawing,dictation",
    sentenceFrames: 0,
    writingLines: 0,
  },
  label: {
    bankWords: 6,
    copyLines: 0,
    dictationNotes: 0,
    drawingAreas: 1,
    labelLines: 4,
    modelSentences: 0,
    requiredResponse: "drawing,labels",
    sentenceFrames: 0,
    writingLines: 0,
  },
  "copy-with-model": {
    bankWords: 0,
    copyLines: 3,
    dictationNotes: 0,
    drawingAreas: 0,
    labelLines: 0,
    modelSentences: 1,
    requiredResponse: "copying",
    sentenceFrames: 0,
    writingLines: 0,
  },
  "sentence-frame": {
    bankWords: 6,
    copyLines: 0,
    dictationNotes: 0,
    drawingAreas: 0,
    labelLines: 0,
    modelSentences: 0,
    requiredResponse: "writing",
    sentenceFrames: 1,
    writingLines: 3,
  },
  independent: {
    bankWords: 8,
    copyLines: 0,
    dictationNotes: 0,
    drawingAreas: 1,
    labelLines: 0,
    modelSentences: 0,
    requiredResponse: "drawing,writing",
    sentenceFrames: 0,
    writingLines: 5,
  },
} as const;

function sentenceSessionFor(
  writingMode: ChildProfileV1["writingMode"],
  seed = 1,
  overrides: Partial<GenerationDefaultsV1> = {},
  interests: readonly string[] = ["Private Topic"],
) {
  const sourceProfile: ChildProfileV1 = {
    ...profile,
    interests: [...interests],
    writingMode,
  };
  const registration = getWorksheetRegistration("sentence-builder");
  const merged: GenerationDefaultsV1 = {
    ...preferences,
    includeDecorativeGraphics: true,
    useDisplayName: false,
    useInterests: true,
    ...overrides,
  };
  const result = createWorksheetSessionForSeed(
    {
      preferences: registration.controls.projectPreferences(
        {
          difficulty: merged.difficulty,
          length: merged.length,
          printScale: merged.printScale,
          profile: sourceProfile,
        },
        merged,
      ),
      profile: sourceProfile,
      stretchConfirmed: false,
      worksheetType: "sentence-builder",
    },
    seed,
    { worksheetIdSource: () => "66666666-6666-4666-8666-666666666666" },
  );
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.session;
}

function countOf(selector: string): number {
  return document.querySelectorAll(selector).length;
}

interface InstructionalSurfaceV1 {
  readonly bankHeading: string | null;
  readonly bankWords: readonly string[];
  readonly captions: readonly string[];
  readonly dictationNote: string | null;
  readonly drawingBoxRem: number | null;
  readonly instruction: string | null;
  readonly items: number;
  readonly modelSentence: string | null;
  readonly prompt: string | null;
  readonly requiredResponse: string | null;
  readonly responseLines: number;
  readonly sentenceFrame: string | null;
}

/**
 * Everything the Step 6 Done-when clause calls a prompt or a response
 * requirement, read off the rendered child page. Decorative markup is
 * deliberately excluded: Step 7's panel and its doodle-box fallback are
 * allowed to differ between graphics states, while every value here is not.
 */
function instructionalSurfaceOf(
  worksheetDocument: Parameters<typeof WorksheetPreview>[0]["document"],
): InstructionalSurfaceV1 {
  const { unmount } = render(
    createElement(WorksheetPreview, { document: worksheetDocument }),
  );
  const text = (selector: string): string | null =>
    document.querySelector(selector)?.textContent?.replace(/\s+/gu, " ").trim() ??
    null;
  const drawingBox = document.querySelector<HTMLElement>("[data-drawing-box]");
  const surface: InstructionalSurfaceV1 = {
    bankHeading: text("[data-word-bank] h3"),
    bankWords: [...document.querySelectorAll("[data-bank-word]")].map(
      (word) => word.textContent?.trim() ?? "",
    ),
    captions: [...document.querySelectorAll("[data-response-lines] p")].map(
      (caption) => caption.textContent?.trim() ?? "",
    ),
    dictationNote: text("[data-dictation-note]"),
    drawingBoxRem:
      drawingBox === null
        ? null
        : Number.parseFloat(drawingBox.style.height.replace("rem", "")),
    instruction: text("[data-mode-instruction]"),
    items: countOf("[data-sentence-item]"),
    modelSentence: text("[data-model-sentence]"),
    prompt: text("[data-sentence-prompt]"),
    requiredResponse:
      document
        .querySelector("[data-sentence-item]")
        ?.getAttribute("data-required-response") ?? null,
    responseLines: countOf("[data-response-line]"),
    sentenceFrame: text("[data-sentence-frame]"),
  };
  unmount();
  return surface;
}

describe("Sentence Builder reaches paper through the registered renderer", () => {
  test("every writing mode renders its own response surface", () => {
    for (const writingMode of WRITING_MODES) {
      const expected = SENTENCE_SURFACES[writingMode];
      const session = sentenceSessionFor(writingMode);
      const { unmount } = render(
        createElement(WorksheetPreview, { document: session.document }),
      );
      expect(screen.getByLabelText("Worksheet preview")).toHaveAttribute(
        "data-worksheet-type",
        "sentence-builder",
      );
      expect(
        screen.getByRole("heading", { name: "Sentence Builder practice" }),
      ).toBeVisible();
      const item = document.querySelector("[data-sentence-item]");
      expect(countOf("[data-sentence-item]")).toBe(1);
      expect(item).toHaveAttribute("data-writing-mode", writingMode);
      expect(item).toHaveAttribute(
        "data-required-response",
        expected.requiredResponse,
      );
      expect(
        document.querySelector("[data-sentence-prompt]")?.textContent?.trim(),
      ).not.toBe("");
      expect(countOf("[data-bank-word]")).toBe(expected.bankWords);
      expect(countOf("[data-word-bank]")).toBe(expected.bankWords === 0 ? 0 : 1);
      expect(countOf("[data-drawing-area]")).toBe(expected.drawingAreas);
      expect(countOf("[data-dictation-note]")).toBe(expected.dictationNotes);
      expect(countOf("[data-model-sentence]")).toBe(expected.modelSentences);
      expect(countOf("[data-sentence-frame]")).toBe(expected.sentenceFrames);
      expect(countOf('[data-response-line="label"]')).toBe(expected.labelLines);
      expect(countOf('[data-response-line="copy"]')).toBe(expected.copyLines);
      expect(countOf('[data-response-line="write"]')).toBe(
        expected.writingLines,
      );
      expect(
        new Set(
          [...document.querySelectorAll("[data-bank-word]")].map(
            (word) => word.textContent?.trim() ?? "",
          ),
        ).size,
      ).toBe(expected.bankWords);
      expect(document.body).not.toHaveTextContent("Private Morgan");
      expect(document.body).not.toHaveTextContent("Private Topic");
      unmount();
    }
  });

  test("the open item never appears in the parent answer key", () => {
    for (const writingMode of WRITING_MODES) {
      const session = sentenceSessionFor(writingMode);
      const item = session.document.items[0];
      expect(item?.answerability).toBe("open");
      expect(item?.answer).toBeNull();
      expect(session.document.request.options.includeAnswerKey).toBe(false);
      const { unmount } = render(
        createElement(AnswerKeyView, { document: session.document }),
      );
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      unmount();

      render(createElement(PrintView, { document: session.document }));
      expect(
        screen.getByRole("button", { name: "Worksheet" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Parent answer key" }),
      ).toBeNull();
      cleanup();
    }
  });

  test("toggling decorative graphics changes no prompt, bank, or response", () => {
    for (const writingMode of WRITING_MODES) {
      const on = sentenceSessionFor(writingMode, 7, {
        includeDecorativeGraphics: true,
      });
      const off = sentenceSessionFor(writingMode, 7, {
        includeDecorativeGraphics: false,
      });
      expect(on.document.request.options.includeDecorativeGraphics).toBe(true);
      expect(off.document.request.options.includeDecorativeGraphics).toBe(false);
      expect(off.contentKey).toBe(on.contentKey);
      // Not only the content key: the instructional surface the child holds.
      // Deliberately scoped to prompt, bank and response geometry, so Step 7's
      // decorative panel and its same-size doodle-box fallback may differ
      // between the two states while this assertion still fails the moment
      // decoration moves a line, a word, or the drawing box.
      expect(instructionalSurfaceOf(off.document), writingMode).toEqual(
        instructionalSurfaceOf(on.document),
      );
    }
  });

  test("length changes response space as well as word-bank breadth", () => {
    // plan.md:236 - "its length setting changes word-bank breadth and
    // response space rather than adding prompts".
    for (const writingMode of BANK_WRITING_MODES) {
      const byLength = WORKSHEET_LENGTHS.map((length) =>
        instructionalSurfaceOf(
          sentenceSessionFor(writingMode, 4, { length }).document,
        ),
      );
      const [short, standard, long] = byLength;
      if (short === undefined || standard === undefined || long === undefined) {
        throw new Error("The length sweep lost a length.");
      }
      expect(short.bankWords.length, writingMode).toBeLessThan(
        standard.bankWords.length,
      );
      expect(standard.bankWords.length, writingMode).toBeLessThan(
        long.bankWords.length,
      );
      expect(short.responseLines, writingMode).toBeLessThan(
        standard.responseLines,
      );
      expect(standard.responseLines, writingMode).toBeLessThan(
        long.responseLines,
      );
      expect(short.items, writingMode).toBe(1);
      expect(long.items, writingMode).toBe(1);
      if (short.drawingBoxRem !== null && long.drawingBoxRem !== null) {
        expect(short.drawingBoxRem, writingMode).toBeLessThan(
          long.drawingBoxRem,
        );
      }
      // Large print steps a bank mode down one budget, and the response space
      // steps down with it: geometry follows the EFFECTIVE length.
      const longLarge = instructionalSurfaceOf(
        sentenceSessionFor(writingMode, 4, {
          length: "long",
          printScale: "large",
        }).document,
      );
      expect(longLarge.bankWords.length, writingMode).toBe(
        standard.bankWords.length,
      );
      expect(longLarge.responseLines, writingMode).toBe(
        standard.responseLines,
      );
    }
  });

  test("every label prompt names the surface the label page prints", () => {
    const labelPrompts = SENTENCE_BUILDER_VOCABULARY.prompts.filter(
      (record) => record.writingMode === "label",
    );
    expect(labelPrompts.length).toBeGreaterThan(0);
    for (const record of labelPrompts) {
      // The only writable surface is the ruled label lines, so a prompt may
      // not send the child to write on the drawing instead.
      expect(/\bon the lines\b/iu.test(record.prompt), record.id).toBe(true);
      expect(/next to|on(?:to)? (?:the|your) (?:picture|drawing)/iu.test(record.prompt), record.id).toBe(false);
    }

    const session = sentenceSessionFor("label");
    render(createElement(WorksheetPreview, { document: session.document }));
    const header =
      document.querySelector("[data-mode-instruction]")?.textContent ?? "";
    const prompt =
      document.querySelector("[data-sentence-prompt]")?.textContent ?? "";
    expect(/\bon the lines\b/iu.test(header)).toBe(true);
    expect(/\bon the lines\b/iu.test(prompt)).toBe(true);
    expect(countOf('[data-response-line="label"]')).toBeGreaterThan(0);
    expect(document.querySelector("[data-drawing-box]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    cleanup();
  });

  test("the page never contradicts the prompt it is printing", () => {
    const normalize = (text: string): string =>
      text.replace(/\s+/gu, " ").trim().toLowerCase();

    // The independent prompts point at "the idea words" and several ask for
    // two sentences; the page must use those names and that number.
    const independent = sentenceSessionFor("independent");
    render(createElement(WorksheetPreview, { document: independent.document }));
    expect(
      document.querySelector("[data-word-bank] h3")?.textContent?.trim(),
    ).toBe("Idea words");
    expect(
      document
        .querySelector('[data-response-lines="write"] p')
        ?.textContent?.trim(),
    ).toBe("Write your sentences here.");
    cleanup();

    for (const writingMode of ["label", "sentence-frame"] as const) {
      const session = sentenceSessionFor(writingMode);
      render(createElement(WorksheetPreview, { document: session.document }));
      expect(
        document.querySelector("[data-word-bank] h3")?.textContent?.trim(),
        writingMode,
      ).toBe("Word bank");
      cleanup();
    }
    for (const record of SENTENCE_BUILDER_VOCABULARY.prompts) {
      if (/idea words/iu.test(record.prompt)) {
        expect(record.writingMode, record.id).toBe("independent");
      }
    }

    // The draw-and-tell prompt already tells the child to tell a grown-up, so
    // the dictation note must not print that same sentence a second time.
    const drawAndTell = sentenceSessionFor("draw-and-tell");
    render(createElement(WorksheetPreview, { document: drawAndTell.document }));
    const note = normalize(
      document.querySelector("[data-dictation-note]")?.textContent ?? "",
    );
    expect(note.length).toBeGreaterThan(0);
    cleanup();
    for (const record of SENTENCE_BUILDER_VOCABULARY.prompts) {
      if (record.writingMode !== "draw-and-tell") {
        continue;
      }
      expect(normalize(record.prompt).includes(note), record.id).toBe(false);
    }
  });

  test("Make another finds a second real document for a preschool no-bank profile", () => {
    // Not a mocked generator: the registered Sentence Builder generator, the
    // leanest shipped configuration (preschool band, unknown interest, no word
    // bank to vary). One reviewed prompt per topic and mode made this
    // permanently exhausted on first press (plan.md:240).
    for (const writingMode of ["draw-and-tell", "copy-with-model"] as const) {
      const sourceProfile: ChildProfileV1 = {
        ...profile,
        ageYears: 4,
        interests: ["Distinctive Private Dinosaurs"],
        presentationBand: "preschool",
        writingMode,
      };
      const registration = getWorksheetRegistration("sentence-builder");
      const merged: GenerationDefaultsV1 = { ...preferences, useInterests: true };
      const selectionForMode: GenerationSelection = {
        preferences: registration.controls.projectPreferences(
          {
            difficulty: merged.difficulty,
            length: merged.length,
            printScale: merged.printScale,
            profile: sourceProfile,
          },
          merged,
        ),
        profile: sourceProfile,
        stretchConfirmed: false,
        worksheetType: "sentence-builder",
      };
      const worksheetIdSource = (): string =>
        "77777777-7777-4777-8777-777777777777";
      const first = createWorksheetSessionForSeed(selectionForMode, 1, {
        worksheetIdSource,
      });
      if (!first.ok) {
        throw new Error(first.message);
      }
      expect(
        (first.session.document.items[0] as SentenceItemV1 | undefined)?.topicId,
        writingMode,
      ).toBe("neutral");
      let seed = 1;
      const result = makeAnotherWorksheetSession(
        first.session,
        selectionForMode,
        () => {
          seed += 1;
          return seed;
        },
        { worksheetIdSource },
      );
      expect(result.status, writingMode).toBe("changed");
      if (result.status === "changed") {
        expect(result.session.contentKey, writingMode).not.toBe(
          first.session.contentKey,
        );
      }
    }
  });

  test("an exact known interest reaches the sheet and an unknown tag never does", () => {
    const known = sentenceSessionFor("label", 3, {}, ["Space"]);
    expect(known.document.request.topicIds).toEqual(["space"]);
    render(createElement(WorksheetPreview, { document: known.document }));
    expect(document.querySelector("[data-sentence-item]")).toHaveAttribute(
      "data-topic-id",
      "space",
    );
    cleanup();

    const unknown = sentenceSessionFor("label", 3, {}, [
      "Distinctive Private Dinosaurs",
    ]);
    expect(unknown.document.request.topicIds).toBeUndefined();
    render(createElement(WorksheetPreview, { document: unknown.document }));
    expect(document.querySelector("[data-sentence-item]")).toHaveAttribute(
      "data-topic-id",
      "neutral",
    );
    expect(document.body).not.toHaveTextContent("Distinctive Private Dinosaurs");
  });

  test("large print narrows a long bank without adding prompts", () => {
    const session = sentenceSessionFor("independent", 5, {
      length: "long",
      printScale: "large",
    });
    render(createElement(WorksheetPreview, { document: session.document }));
    expect(countOf("[data-sentence-item]")).toBe(1);
    expect(countOf("[data-bank-word]")).toBe(8);
  });
});

describe("Sentence Builder controls render what the contract declares", () => {
  test("hides difficulty and the answer key and shows length only for bank modes", () => {
    for (const writingMode of WRITING_MODES) {
      renderControls(
        { ...profile, interests: ["Space"], writingMode },
        "sentence-builder",
      );
      expect(screen.queryByRole("combobox", { name: "Difficulty" })).toBeNull();
      expect(screen.queryByLabelText("Include a parent answer key")).toBeNull();
      expect(
        screen.getByLabelText("Use reviewed interests in worksheet content"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Include decorative graphics"),
      ).toBeInTheDocument();
      if (BANK_MODES.includes(writingMode)) {
        expect(
          screen.getByRole("combobox", { name: "Length" }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /This selection creates \d+ unique word-bank words on one practice page\./u,
          ),
        ).toBeInTheDocument();
      } else {
        expect(screen.queryByRole("combobox", { name: "Length" })).toBeNull();
        expect(
          screen.getByText(
            "This selection creates 1 unique writing prompt on one practice page.",
          ),
        ).toBeInTheDocument();
      }
      cleanup();
    }
  });

  test("states the exact bank width each length would print", () => {
    renderControls(
      { ...profile, interests: ["Space"], writingMode: "label" },
      "sentence-builder",
    );
    const length = screen.getByRole("combobox", { name: "Length" });
    expect(length.querySelector('option[value="short"]')?.textContent).toBe(
      "Short · 4 word-bank words",
    );
    expect(length.querySelector('option[value="standard"]')?.textContent).toBe(
      "Standard · 6 word-bank words",
    );
    expect(length.querySelector('option[value="long"]')?.textContent).toBe(
      "Long · 8 word-bank words",
    );
  });
});

describe("registration metadata cannot drift from the control contract", () => {
  test("declared usesInterests and hasAnswerKey match the applicable controls", () => {
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      for (const sourceProfile of CONTRACT_PROFILES[worksheetType]) {
        const registration = getWorksheetRegistration(worksheetType);
        const applicable = registration.controls.getApplicableControls(
          controlContextFor(sourceProfile),
        );
        expect(registration.usesInterests, worksheetType).toBe(
          applicable.useInterests,
        );
        expect(registration.hasAnswerKey, worksheetType).toBe(
          applicable.includeAnswerKey,
        );
      }
    }
  });

  test("a stored stretch default never blocks a family that hides difficulty", () => {
    renderControls(
      { ...profile, interests: ["Space"], writingMode: "copy-with-model" },
      "sentence-builder",
      { difficulty: "stretch" },
    );
    expect(screen.queryByRole("combobox", { name: "Difficulty" })).toBeNull();
    expect(screen.queryByText(/One-time stretch preview/u)).toBeNull();
    expect(
      screen.queryByLabelText(/Confirm these one-time stretch limits/u),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Create worksheet" })).toBeEnabled();
    expect(
      contractRequest(
        "sentence-builder",
        { ...profile, interests: ["Space"], writingMode: "copy-with-model" },
        { difficulty: "stretch" },
      ).options.difficulty,
    ).toBe("practice");
  });
});
