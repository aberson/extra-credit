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
  CountCompareItemV1,
  GenerationRequestV1,
  SentenceItemV1,
  WorksheetDocumentV1,
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

/** The mirror image: counting limits at the ceiling, equation limits below. */
const countingAtMaximumProfile: ChildProfileV1 = {
  ...profile,
  id: "d1b2c3d4-4444-4444-8444-444444444444",
  mathSkills: {
    ...profile.mathSkills,
    countingMax: 20,
    numeralMax: 20,
    compareMax: 20,
    operandMax: 10,
    resultMax: 10,
  },
};

/**
 * A profile whose limits for THAT family are all at the V1 ceiling while its
 * other limits are not. Using one profile for every family would prove only
 * that an all-20 profile disables stretch; pairing each family with the
 * profile that maxes exactly its own maxima is what proves the gate reads the
 * active mode's limits and no others.
 */
const AT_V1_MAXIMUM_PROFILES: Readonly<
  Record<RegisteredWorksheetType, ChildProfileV1>
> = {
  "dry-math": equationsAtMaximumProfile,
  "find-the-wow": equationsAtMaximumProfile,
  "sentence-builder": equationsAtMaximumProfile,
  "count-compare-make": countingAtMaximumProfile,
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
      "count-compare-make",
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
    expect(
      registryMaximumKeys(
        "count-compare-make",
        controlContextFor(quantityProfile),
      ),
    ).toEqual(["countingMax", "numeralMax", "compareMax"]);
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
      new Set([
        "countingMax",
        "numeralMax",
        "compareMax",
        "operandMax",
        "resultMax",
      ]),
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
      const atMaximumProfile = AT_V1_MAXIMUM_PROFILES[worksheetType];
      if (
        !getWorksheetRegistration(worksheetType).controls.getApplicableControls(
          controlContextFor(atMaximumProfile),
        ).difficulty
      ) {
        continue;
      }
      renderControls(atMaximumProfile, worksheetType, {
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
  "count-compare-make": [
    contractProfile(),
    contractProfile({ ...quantityProfile, interests: ["Space"] }),
  ],
};

/**
 * Mirrors the ORDER `GeneratorControls.submit` uses - the registration's own
 * `projectPreferences` first, then the sole projection boundary - so a
 * disagreement between those two shows up here.
 *
 * It deliberately skips submit's stretch handling: submit downgrades a
 * requested `stretch` that cannot apply to `practice` before it builds its
 * control context, and passes `applicableControls.difficulty &&
 * stretchConfirmed`, while this uses the raw merged difficulty and a hardcoded
 * `stretchConfirmed: true`. Other tests in this file cover that handling.
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
 * The prompt, bank, and response geometry this suite holds stable across
 * graphics states, per Step 6's "graphics-independent prompts and response
 * requirements are stable". That clause enumerates no fields, so this list is
 * that phrase read out rather than a quotation of it.
 *
 * Decorative markup is deliberately excluded: Step 7's panel and its
 * doodle-box fallback are allowed to differ between graphics states, while
 * every value here is not.
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
    // plan.md:238 - "its length setting changes word-bank breadth and
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
      // The only surface for WRITTEN WORDS is the ruled label lines - the
      // drawing box beside them is where the picture goes - so a prompt may
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

/**
 * Count, Compare & Make through its PRODUCTION callers.
 *
 * Every document here starts at `createWorksheetSessionForSeed` (what `App`
 * calls) and renders through `WorksheetPreview`/`AnswerKeyView` (what
 * `PrintView` mounts), so a renderer that is written but never registered, or
 * a registration whose generator is never reached, fails here rather than
 * silently printing nothing.
 *
 * The two "pinned" tests are the one exception, and a deliberate one: each
 * takes a GENERATED item from such a session as its template, substitutes the
 * two or three fields that name a worst case, and re-renders the session
 * document with that single item. That is how a case no seed is guaranteed to
 * reach still gets covered. Nothing is fabricated from scratch, and for each
 * of those cases a seed sweep in this file proves real pages reach it: the
 * worst-case complete items by the `fullFrameItems` assertion in "a complete
 * item always prints room for every mark it asks for", and the one-mark draw
 * target by the `singleMarkItems` assertion in the narrow-profile draw sweep.
 */
const countCompareProfile: ChildProfileV1 = {
  ...quantityProfile,
  id: "e1b2c3d4-5555-4555-8555-555555555555",
  interests: ["Space"],
  mathSkills: {
    ...quantityProfile.mathSkills,
    compareMax: 10,
    countingMax: 10,
    numeralMax: 10,
  },
};

function countCompareSessionFor(
  seed: number,
  overrides: Partial<GenerationDefaultsV1> = {},
  sourceProfile: ChildProfileV1 = countCompareProfile,
) {
  const result = createWorksheetSessionForSeed(
    {
      profile: sourceProfile,
      preferences: { ...preferences, useInterests: true, ...overrides },
      stretchConfirmed: false,
      worksheetType: "count-compare-make",
    },
    seed,
    { worksheetIdSource: () => "66666666-6666-4666-8666-666666666666" },
  );
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.session;
}

/** Narrows a generated page to the family's own item union, or fails loudly. */
function countCompareItems(
  document: WorksheetDocumentV1,
): readonly CountCompareItemV1[] {
  const items = document.items.filter(
    (item): item is CountCompareItemV1 => item.itemType === "count-compare",
  );
  if (items.length !== document.items.length) {
    throw new Error(
      "A Count, Compare & Make page contained a foreign item type.",
    );
  }
  return items;
}

function instructionalQuantities(node: Element): readonly number[] {
  return [...node.querySelectorAll("[data-instructional-visual]")].map((visual) =>
    Number(visual.getAttribute("data-instructional-quantity")),
  );
}

/**
 * Every ITEM's text, visual counts, and guide cells, read straight off the
 * DOM. The page header and the decorative panel sit outside `[data-item-id]`
 * and are deliberately excluded: the point of the toggle assertion is that
 * this reading is identical in both graphics states.
 */
function readInstructionalDom(): string {
  return [...document.querySelectorAll("[data-item-id]")]
    .map((item) =>
      [
        item.getAttribute("data-item-id"),
        item.getAttribute("data-activity"),
        item.getAttribute("data-response-mode"),
        item.textContent?.replace(/\s+/gu, " ").trim() ?? "",
        [...item.querySelectorAll("[data-instructional-visual]")]
          .map((visual) =>
            [
              visual.getAttribute("data-instructional-visual"),
              visual.getAttribute("data-instructional-quantity"),
              visual.getAttribute("aria-label"),
              visual.querySelectorAll('[data-instructional-mark="filled"]').length,
              visual.querySelectorAll('[data-instructional-mark="empty"]').length,
            ].join(":"),
          )
          .join("|"),
        [...item.querySelectorAll("[data-instructional-guide-cells]")]
          .map((guide) => guide.getAttribute("data-instructional-guide-cells"))
          .join("|"),
      ].join("~"),
    )
    .join("\n");
}

describe("Count, Compare & Make reaches paper through the registered renderer", () => {
  test("WorksheetPreview reaches the registered Count, Compare & Make renderer", () => {
    const session = countCompareSessionFor(1, { length: "long" });
    render(createElement(WorksheetPreview, { document: session.document }));
    expect(screen.getByLabelText("Worksheet preview")).toHaveAttribute(
      "data-worksheet-type",
      "count-compare-make",
    );
    expect(
      screen.getByRole("heading", { name: "Count, Compare & Make practice" }),
    ).toBeVisible();
    expect(session.document.items).toHaveLength(10);
    expect(document.querySelectorAll("[data-activity]")).toHaveLength(
      session.document.items.length,
    );
    expect(document.body).not.toHaveTextContent("Private Riley");
    expect(document.body).not.toHaveTextContent("Private Visual Topic");
  });

  test("every subtype prints its own instructional surface", () => {
    const session = countCompareSessionFor(0x0004_2021, { length: "long" });
    render(createElement(WorksheetPreview, { document: session.document }));
    for (const item of countCompareItems(session.document)) {
      const node = document.querySelector(`[data-item-id="${item.id}"]`);
      if (node === null) {
        throw new Error(`${item.id} never reached the page.`);
      }
      expect(node.getAttribute("data-activity"), item.id).toBe(item.activity);
      switch (item.activity) {
        case "match":
          expect(
            node.querySelectorAll("[data-match-choice]"),
            item.id,
          ).toHaveLength(3);
          expect(instructionalQuantities(node), item.id).toEqual([
            ...item.choices,
          ]);
          break;
        case "compare":
          expect(instructionalQuantities(node), item.id).toEqual([
            item.leftQuantity,
            item.rightQuantity,
          ]);
          expect(
            node.querySelectorAll("[data-relation-word]"),
            item.id,
          ).toHaveLength(3);
          break;
        case "complete": {
          const frame = node.querySelector(
            '[data-instructional-visual="ten-frame"]',
          );
          expect(
            frame?.getAttribute("data-instructional-quantity"),
            item.id,
          ).toBe(String(item.partial));
          expect(
            frame?.querySelectorAll('[data-instructional-mark="filled"]').length,
            item.id,
          ).toBe(item.partial);
          // The empty cells ARE the missing count made visible - which is a
          // claim about the EMPTY cells, and used to be asserted only about
          // the filled ones. The child must have somewhere to put every mark
          // this item asks for.
          expect(
            frame?.querySelectorAll('[data-instructional-mark="empty"]').length,
            item.id,
          ).toBeGreaterThanOrEqual(item.target - item.partial);
          break;
        }
        case "draw":
          expect(
            node.querySelector("[data-instructional-guide]"),
            item.id,
          ).not.toBeNull();
          expect(
            node.querySelector("[data-visible-numeral]")?.textContent,
            item.id,
          ).toBe(String(item.target));
          break;
      }
    }
  });

  test("visible work recomputes to exactly the parent key", () => {
    const session = countCompareSessionFor(0x0408_0601, { length: "long" });
    const { unmount } = render(
      createElement(WorksheetPreview, { document: session.document }),
    );
    const worksheetIds = [...document.querySelectorAll("[data-item-id]")].map(
      (item) => item.getAttribute("data-item-id"),
    );
    // Independently recompute each answer from what the CHILD sees, then hold
    // the parent key to it.
    const recomputed = new Map<string, string>();
    for (const node of document.querySelectorAll("[data-item-id]")) {
      const id = node.getAttribute("data-item-id") ?? "";
      const activity = node.getAttribute("data-activity");
      const quantities = instructionalQuantities(node);
      const numeral = Number(
        node.querySelector("[data-visible-numeral]")?.textContent,
      );
      if (activity === "match") {
        recomputed.set(id, `Choice ${quantities.indexOf(numeral) + 1}`);
      } else if (activity === "compare") {
        const left = quantities[0] ?? 0;
        const right = quantities[1] ?? 0;
        // A deliberately independent restatement of the phrases the child
        // circles: the key must print the same words the page does, so this
        // oracle names them rather than importing the constant under test.
        recomputed.set(
          id,
          left < right
            ? "fewer than"
            : left > right
              ? "more than"
              : "the same as",
        );
      } else if (activity === "complete") {
        recomputed.set(id, String(numeral - (quantities[0] ?? 0)));
      } else {
        recomputed.set(id, String(numeral));
      }
    }
    unmount();

    render(createElement(AnswerKeyView, { document: session.document }));
    const keyItems = screen.getAllByRole("listitem");
    expect(keyItems.map((item) => item.getAttribute("data-item-id"))).toEqual(
      worksheetIds,
    );
    expect(new Set(recomputed.values()).size).toBeGreaterThan(1);
    for (const [index, keyItem] of keyItems.entries()) {
      const id = keyItem.getAttribute("data-item-id") ?? "";
      expect(
        keyItem
          .querySelector("[data-answer-value]")
          ?.getAttribute("data-answer-value"),
        id,
      ).toBe(recomputed.get(id));
      expect(
        keyItem
          .querySelector("[data-problem-number]")
          ?.getAttribute("data-problem-number"),
      ).toBe(String(index + 1));
      expect(keyItem).not.toHaveTextContent(id);
    }
  });

  test("turning decorative graphics off leaves every instructional visual intact", () => {
    const withGraphics = countCompareSessionFor(0x9dcc_a8c5, {
      includeDecorativeGraphics: true,
      length: "long",
    });
    const first = render(
      createElement(WorksheetPreview, { document: withGraphics.document }),
    );
    const decorated = readInstructionalDom();
    expect(document.querySelectorAll("[data-decorative-panel]")).toHaveLength(1);
    expect(
      document.querySelectorAll("[data-instructional-visual]").length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll("[data-instructional-guide]").length,
    ).toBeGreaterThan(0);
    first.unmount();

    const withoutGraphics = countCompareSessionFor(0x9dcc_a8c5, {
      includeDecorativeGraphics: false,
      length: "long",
    });
    render(
      createElement(WorksheetPreview, { document: withoutGraphics.document }),
    );
    // The reserved panel keeps its box and falls back to the doodle box; every
    // learning-essential visual and required response is untouched.
    expect(
      document
        .querySelector("[data-decorative-panel]")
        ?.getAttribute("data-decoration"),
    ).toBe("doodle");
    expect(readInstructionalDom()).toBe(decorated);
    expect(withoutGraphics.document.items).toEqual(withGraphics.document.items);
  });

  test("the activity is unavailable to a profile without quantities", () => {
    const equationsOnly: ChildProfileV1 = {
      ...profile,
      mathSkills: { ...profile.mathSkills, representations: ["equations"] },
    };
    const support = getWorksheetRegistration(
      "count-compare-make",
    ).controls.getCapabilitySupport(controlContextFor(equationsOnly));
    expect(support.available).toBe(false);

    renderControls(equationsOnly, "count-compare-make");
    expect(
      screen.getByText(/Count, Compare & Make needs confirmed quantities/u),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create worksheet" }),
    ).toBeDisabled();
  });

  test("the control states the exact item count each length would print", () => {
    renderControls(countCompareProfile, "count-compare-make");
    expect(
      screen.getByText(
        "This selection creates 8 unique items on one practice page.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: "Short · 6 items" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Long · 10 items" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Include decorative graphics")).toBeVisible();
    expect(
      screen.getByLabelText("Use reviewed interests in worksheet content"),
    ).toBeVisible();
    expect(screen.getByLabelText("Include a parent answer key")).toBeVisible();
  });
});

/**
 * Every COUNTING ceiling this family reads, at the v1 maximum of 20, so a
 * complete target can reach 20 over a small group.
 */
const countCompareWideProfile: ChildProfileV1 = {
  ...countCompareProfile,
  id: "f1b2c3d4-6666-4666-8666-666666666666",
  mathSkills: {
    ...countCompareProfile.mathSkills,
    compareMax: 20,
    countingMax: 20,
    numeralMax: 20,
  },
};

/** Narrow enough that a one-mark draw item is reachable. */
const countCompareNarrowProfile: ChildProfileV1 = {
  ...countCompareProfile,
  id: "a2b2c3d4-7777-4777-8777-777777777777",
  mathSkills: {
    ...countCompareProfile.mathSkills,
    compareMax: 3,
    countingMax: 3,
    numeralMax: 3,
  },
};

function markCounts(visual: Element): {
  readonly empty: number;
  readonly filled: number;
} {
  return {
    empty: visual.querySelectorAll('[data-instructional-mark="empty"]').length,
    filled: visual.querySelectorAll('[data-instructional-mark="filled"]').length,
  };
}

describe("Count, Compare & Make prints a performable page", () => {
  /**
   * The required response has to be physically possible.
   *
   * The ten-frame used to be sized from the marks ALREADY drawn, so a "make
   * this group 20" item over a group of 8 printed two empty boxes for twelve
   * missing marks, and a partial group of exactly 10 printed none at all. The
   * whole suite missed it because every complete-item fixture pinned the
   * limits at 10, where `ceil(partial/10)*10 >= target` happens to hold.
   * This sweeps the ceiling, where it does not.
   */
  test("a complete item always prints room for every mark it asks for", () => {
    let completeItems = 0;
    let widestGap = 0;
    let fullFrameItems = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = countCompareSessionFor(
        seed,
        { length: "long" },
        countCompareWideProfile,
      );
      const { unmount } = render(
        createElement(WorksheetPreview, { document: session.document }),
      );
      for (const item of countCompareItems(session.document)) {
        if (item.activity !== "complete") {
          continue;
        }
        completeItems += 1;
        const missing = item.target - item.partial;
        widestGap = Math.max(widestGap, missing);
        if (item.partial % 10 === 0) {
          fullFrameItems += 1;
        }
        const frame = document.querySelector(
          `[data-item-id="${item.id}"] [data-instructional-visual="ten-frame"]`,
        );
        if (frame === null) {
          throw new Error(`${item.id} printed no ten-frame.`);
        }
        const marks = markCounts(frame);
        const where = `seed ${seed} ${item.id}: ${item.partial} drawn, needs ${missing} more`;
        expect(marks.filled, where).toBe(item.partial);
        expect(marks.empty, where).toBeGreaterThanOrEqual(missing);
      }
      unmount();
    }
    expect(completeItems).toBeGreaterThan(50);
    // The regression only appears when the gap outgrows the partial group's
    // own frame, so the sweep has to have reached such a case.
    expect(widestGap).toBeGreaterThan(10);
    // ...and specifically the worst variant, a partial group that exactly
    // fills its frame with more still to draw, which is where the child used
    // to get NO boxes at all.
    expect(fullFrameItems).toBeGreaterThan(0);
  });

  /**
   * The same worst cases, pinned rather than sampled.
   *
   * The sweep above proves real pages reach them, but which pairs it reaches
   * depends on the seeds. These four are named outright, so the case this
   * family's worst defect lived in is covered by construction: a partial group
   * that exactly fills one frame (10 of 11, 10 of 20) is where the old sizing
   * printed zero empty boxes.
   */
  test("the named worst-case complete items each print room for the answer", () => {
    const session = countCompareSessionFor(
      1,
      { length: "long" },
      countCompareWideProfile,
    );
    const template = countCompareItems(session.document).find(
      (item) => item.activity === "complete",
    );
    if (template?.activity !== "complete") {
      throw new Error("The fixture page held no complete item.");
    }

    for (const [partial, target] of [
      [10, 11],
      [10, 20],
      [1, 20],
      [9, 10],
    ] as const) {
      const item = {
        ...template,
        answer: { kind: "number", value: target - partial },
        partial,
        target,
      } as const;
      const { unmount } = render(
        createElement(WorksheetPreview, {
          document: { ...session.document, items: [item] },
        }),
      );
      const frame = document.querySelector(
        '[data-instructional-visual="ten-frame"]',
      );
      if (frame === null) {
        throw new Error(`${partial} of ${target} printed no ten-frame.`);
      }
      const marks = markCounts(frame);
      const where = `${partial} of ${target}`;
      expect(marks.filled, where).toBe(partial);
      expect(marks.empty, where).toBeGreaterThanOrEqual(target - partial);
      unmount();
    }
  });

  /**
   * LOW-4: the singular prompt, pinned rather than sampled. The narrow-profile
   * draw sweep further below - the one whose `singleMarkItems` count must
   * exceed zero - is what proves generated pages reach a one-mark target; this
   * pins the wording without depending on any seed.
   */
  test("a pinned one-mark draw item prints the singular noun", () => {
    const session = countCompareSessionFor(
      1,
      { length: "long" },
      countCompareWideProfile,
    );
    const template = countCompareItems(session.document).find(
      (item) => item.activity === "draw",
    );
    if (template?.activity !== "draw") {
      throw new Error("The fixture page held no draw item.");
    }

    for (const target of [1, 2] as const) {
      const item = {
        ...template,
        answer: { kind: "number", value: target },
        target,
      } as const;
      const { unmount } = render(
        createElement(WorksheetPreview, {
          document: { ...session.document, items: [item] },
        }),
      );
      expect(
        document
          .querySelector("[data-item-prompt]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim(),
        `target ${target}`,
      ).toBe(`Draw ${target} ${target === 1 ? "mark" : "marks"} in the boxes.`);
      expect(
        Number(
          document
            .querySelector("[data-instructional-guide-cells]")
            ?.getAttribute("data-instructional-guide-cells"),
        ),
        `target ${target}`,
      ).toBeGreaterThanOrEqual(target);
      unmount();
    }
  });

  test("a draw item always prints room for its whole target", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const session = countCompareSessionFor(
        seed,
        { length: "long" },
        countCompareWideProfile,
      );
      const { unmount } = render(
        createElement(WorksheetPreview, { document: session.document }),
      );
      for (const item of countCompareItems(session.document)) {
        if (item.activity !== "draw") {
          continue;
        }
        const cells = Number(
          document
            .querySelector(
              `[data-item-id="${item.id}"] [data-instructional-guide-cells]`,
            )
            ?.getAttribute("data-instructional-guide-cells"),
        );
        expect(cells, `seed ${seed} ${item.id}`).toBeGreaterThanOrEqual(
          item.target,
        );
      }
      unmount();
    }
  });

  /**
   * The marks are `aria-hidden`, so this label is the ENTIRE content a screen
   * reader receives for a visual. A label that states the wrong number is not
   * a cosmetic defect - it is the only number that reader hears for THAT
   * VISUAL. The previous assertion checked the label's SHAPE, so returning
   * `quantity + 1` left the suite green.
   */
  test("every visual's spoken label states the quantity really drawn", () => {
    const spokenNumber = (visual: Element): number =>
      Number(/^(\d+)\b/u.exec(visual.getAttribute("aria-label") ?? "")?.[1]);
    let visualsChecked = 0;
    let singulars = 0;

    // Both a page at the v1 ceiling and narrow pages, so the singular branch
    // is genuinely reached rather than left to one seed's luck.
    const cases: readonly (readonly [ChildProfileV1, number])[] = [
      [countCompareWideProfile, 0x0004_2021],
      ...Array.from(
        { length: 12 },
        (_, index) => [countCompareNarrowProfile, index + 1] as const,
      ),
    ];

    for (const [sourceProfile, seed] of cases) {
      const session = countCompareSessionFor(
        seed,
        {
          length:
            sourceProfile === countCompareWideProfile ? "long" : "short",
        },
        sourceProfile,
      );
      const { unmount } = render(
        createElement(WorksheetPreview, { document: session.document }),
      );

      for (const visual of document.querySelectorAll(
        "[data-instructional-visual]",
      )) {
        const label = visual.getAttribute("aria-label") ?? "";
        const spoken = spokenNumber(visual);
        const marks = markCounts(visual);
        visualsChecked += 1;
        expect(spoken, label).toBe(marks.filled);
        expect(spoken, label).toBe(
          Number(visual.getAttribute("data-instructional-quantity")),
        );
        expect(label, label).toMatch(
          spoken === 1 ? /^1 mark\b/u : /^\d+ marks\b/u,
        );
        if (spoken === 1) {
          singulars += 1;
        }
      }

      // Bind the spoken numbers to the ITEM MODEL too, not only to each other.
      for (const item of countCompareItems(session.document)) {
        const spokenHere = [
          ...(document
            .querySelector(`[data-item-id="${item.id}"]`)
            ?.querySelectorAll("[data-instructional-visual]") ?? []),
        ].map(spokenNumber);
        if (item.activity === "match") {
          expect(spokenHere, item.id).toEqual([...item.choices]);
        } else if (item.activity === "compare") {
          expect(spokenHere, item.id).toEqual([
            item.leftQuantity,
            item.rightQuantity,
          ]);
        } else if (item.activity === "complete") {
          expect(spokenHere, item.id).toEqual([item.partial]);
        }
      }
      unmount();
    }

    expect(visualsChecked).toBeGreaterThan(50);
    // A run that never spoke "1 mark" could not prove the singular branch.
    expect(singulars).toBeGreaterThan(0);
  });

  test("a one-mark draw item reads “1 mark”, never “1 marks”", () => {
    let singleMarkItems = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const session = countCompareSessionFor(
        seed,
        { length: "short" },
        countCompareNarrowProfile,
      );
      const { unmount } = render(
        createElement(WorksheetPreview, { document: session.document }),
      );
      for (const item of countCompareItems(session.document)) {
        if (item.activity !== "draw") {
          continue;
        }
        const prompt = document
          .querySelector(`[data-item-id="${item.id}"] [data-item-prompt]`)
          ?.textContent?.replace(/\s+/gu, " ")
          .trim();
        expect(prompt, `seed ${seed} ${item.id}`).toBe(
          `Draw ${item.target} ${item.target === 1 ? "mark" : "marks"} in the boxes.`,
        );
        if (item.target === 1) {
          singleMarkItems += 1;
        }
      }
      unmount();
    }
    expect(singleMarkItems).toBeGreaterThan(0);
  });

  test("the parent key prints the very words the child circles", () => {
    const session = countCompareSessionFor(
      0x0408_0601,
      { length: "long" },
      countCompareWideProfile,
    );
    const { unmount } = render(
      createElement(WorksheetPreview, { document: session.document }),
    );
    const pageWords = new Set(
      [...document.querySelectorAll("[data-relation-word]")].map(
        (word) => word.textContent?.trim() ?? "",
      ),
    );
    expect(pageWords).toEqual(
      new Set(["fewer than", "the same as", "more than"]),
    );
    unmount();

    render(createElement(AnswerKeyView, { document: session.document }));
    const comparisons = countCompareItems(session.document).filter(
      (item) => item.activity === "compare",
    );
    expect(comparisons.length).toBeGreaterThan(0);
    for (const item of comparisons) {
      const printed =
        document
          .querySelector(`[data-item-id="${item.id}"] [data-answer-value]`)
          ?.getAttribute("data-answer-value") ?? "";
      // One document, one vocabulary: the key may not leak the stored enum.
      expect(pageWords.has(printed), `${item.id}: ${printed}`).toBe(true);
      expect(printed, item.id).not.toBe(item.answer.value);
    }
  });

  test("the response-mode attribute is this family's own, not Sentence Builder's", () => {
    const session = countCompareSessionFor(
      1,
      { length: "long" },
      countCompareWideProfile,
    );
    render(createElement(WorksheetPreview, { document: session.document }));
    for (const item of countCompareItems(session.document)) {
      const node = document.querySelector(`[data-item-id="${item.id}"]`);
      expect(node?.getAttribute("data-response-mode"), item.id).toBe(
        item.activity === "complete" || item.activity === "draw"
          ? "draw"
          : "circle",
      );
      // `RequiredResponseV1` has no circling form, so this family must not
      // reuse the attribute that carries those field names.
      expect(node?.getAttribute("data-required-response"), item.id).toBeNull();
    }
  });
});
