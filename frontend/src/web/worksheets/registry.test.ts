// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../shared/config/schema";
import {
  REGISTERED_WORKSHEET_IDS,
  WORKSHEET_REGISTRY,
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

afterEach(cleanup);

describe("worksheet renderer registry", () => {
  test("has exactly the same keys as the shared generator registry", () => {
    expect(Object.keys(WEB_WORKSHEET_RENDERERS).sort()).toEqual(
      Object.keys(WORKSHEET_REGISTRY).sort(),
    );
    expect(REGISTERED_WORKSHEET_IDS).toEqual(["dry-math"]);
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
