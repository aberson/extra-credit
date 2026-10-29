// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";

import {
  oracleHourFromHands,
  type OracleHandVector,
} from "../../../../tests/oracles/clock-oracle";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../../shared/config/defaults";
import { projectGenerationRequest } from "../../../shared/worksheet/project-request";
import type {
  ClockExplorerItemV1,
  WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import { generateClockExplorer } from "../../../worksheets/clock-explorer/generator";
import { AnswerKeyView } from "../../print/AnswerKeyView";
import { WorksheetPreview } from "../../preview/WorksheetPreview";
import { ClockExplorerRenderer } from "./Renderer";

afterEach(cleanup);

const WORKSHEET_ID = "55555555-5555-4555-8555-555555555555";

function generatedDocument(seed: string): WorksheetDocumentV1<ClockExplorerItemV1> {
  const projected = projectGenerationRequest({
    profile: { displayName: "Fictional Clock Reader", interests: [] },
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "clock-explorer",
    },
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  const generated = generateClockExplorer(projected.request, { worksheetId: WORKSHEET_ID });
  if (!generated.ok) {
    throw new Error(generated.message);
  }
  return generated.document;
}

/** One real generated clock for every hour, found by walking seeds. */
function clockForEveryHour(): ReadonlyMap<number, { readonly document: WorksheetDocumentV1; readonly id: string }> {
  const found = new Map<number, { document: WorksheetDocumentV1; id: string }>();
  for (let seed = 1; found.size < 12; seed += 1) {
    const document = generatedDocument(seed.toString(16).padStart(8, "0"));
    for (const item of document.items) {
      if (!found.has(item.hour)) {
        found.set(item.hour, { document, id: item.id });
      }
    }
  }
  return found;
}

interface ReadHand {
  readonly length: number;
  readonly width: number;
  readonly stroke: string | null;
  /** Degrees clockwise from twelve, read from the drawn endpoints alone. */
  readonly degrees: number;
  readonly fromCentre: boolean;
  /** The hand as a vector from its start, in SVG axes (y grows downward). */
  readonly vector: OracleHandVector;
}

/** Reads one drawn hand from its SVG attributes; nothing comes from the document. */
function readHand(card: Element, which: "minute" | "hour"): ReadHand {
  const hands = card.querySelectorAll(`[data-clock-hand="${which}"]`);
  expect(hands).toHaveLength(1);
  const hand = hands[0] as Element;
  const number = (name: string) => Number(hand.getAttribute(name));
  const [x1, y1, x2, y2] = [number("x1"), number("y1"), number("x2"), number("y2")];
  const dx = x2 - x1;
  const up = y1 - y2;
  const degrees = (Math.round((Math.atan2(dx, up) * 180) / Math.PI) + 360) % 360;
  return {
    length: Math.hypot(dx, up),
    width: Number(hand.getAttribute("stroke-width")),
    stroke: hand.getAttribute("stroke"),
    degrees,
    fromCentre: x1 === 50 && y1 === 50,
    vector: { dx, dy: y2 - y1 },
  };
}

describe("the Clock Explorer worksheet", () => {
  test("draws every hour's hands at the angle the hour implies, read back from the SVG", () => {
    const clocks = clockForEveryHour();
    expect([...clocks.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Written out independently of the renderer: 30 degrees an hour from twelve.
    const expected = new Map([[1, 30], [2, 60], [3, 90], [4, 120], [5, 150], [6, 180],
      [7, 210], [8, 240], [9, 270], [10, 300], [11, 330], [12, 0]]);
    for (const [hour, { document, id }] of clocks) {
      const { container } = render(createElement(ClockExplorerRenderer, { document }));
      const card = container.querySelector(`[data-item-id="${id}"]`);
      expect(card, `${hour}:00`).not.toBeNull();
      const minute = readHand(card as Element, "minute");
      const hourHand = readHand(card as Element, "hour");
      expect(minute.degrees, `${hour}:00 minute`).toBe(0);
      expect(hourHand.degrees, `${hour}:00 hour`).toBe(expected.get(hour));
      // The independent oracle reads the same time back from the two vectors.
      expect(oracleHourFromHands(minute.vector, hourHand.vector), `${hour}:00 oracle`).toBe(hour);
      expect(minute.fromCentre && hourHand.fromCentre, `${hour}:00 centre`).toBe(true);
      // The long hand is clearly longer, the short hand clearly heavier.
      expect(minute.length, `${hour}:00 lengths`).toBeGreaterThan(hourHand.length * 1.4);
      expect(hourHand.width, `${hour}:00 widths`).toBeGreaterThan(minute.width * 1.5);
      for (const hand of [minute, hourHand]) {
        expect(hand.width).toBeGreaterThan(0);
        expect(hand.stroke).not.toBeNull();
        expect(hand.stroke).not.toBe("none");
      }
      // Every hand stays inside the outline and short of every label.
      const labelRadius = 38;
      expect(minute.length).toBeLessThan(labelRadius - 8);
      cleanup();
    }
  });

  test("3:00 has the long hand at twelve and the short hand at three; at 12:00 the long hand shows past the short one", () => {
    const clocks = clockForEveryHour();
    for (const [hour, degrees] of [[3, 90], [12, 0]] as const) {
      const { document, id } = clocks.get(hour) ?? { document: undefined, id: "" };
      if (document === undefined) {
        throw new Error(`No generated ${hour}:00 clock.`);
      }
      const { container } = render(createElement(ClockExplorerRenderer, { document }));
      const card = container.querySelector(`[data-item-id="${id}"]`) as Element;
      const minute = readHand(card, "minute");
      const short = readHand(card, "hour");
      expect([minute.degrees, short.degrees]).toEqual([0, degrees]);
      if (hour === 12) {
        // Overlapping: the minute hand is drawn after (over) the hour hand
        // and reaches beyond its tip.
        const order = [...card.querySelectorAll("[data-clock-hand]")].map((hand) =>
          hand.getAttribute("data-clock-hand"));
        expect(order).toEqual(["hour", "minute"]);
        expect(minute.length - short.length).toBeGreaterThan(8);
      }
      cleanup();
    }
  });

  test("each card prints all twelve labels, an empty writing line between Time: and :00, and no answer", () => {
    for (const seed of ["00000001", "5eed0035", "ffffffff"]) {
      const document = generatedDocument(seed);
      const { container } = render(createElement(WorksheetPreview, { document }));
      const cards = [...container.querySelectorAll("[data-item-id]")];
      expect(cards).toHaveLength(4);
      for (const [index, card] of cards.entries()) {
        expect(card.querySelector("[data-problem-number]")).toHaveTextContent(`${index + 1}.`);
        expect([...card.querySelectorAll("[data-clock-label]")].map((label) => label.textContent))
          .toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
        expect(card.querySelectorAll("[data-clock-outline]")).toHaveLength(1);
        const response = card.querySelector("[data-clock-response]");
        expect((response?.textContent ?? "").replace(/\s+/gu, " ").trim()).toBe("Time: :00");
        const blank = card.querySelector("[data-time-blank]");
        expect(blank?.textContent).toBe("");
        expect(blank?.childNodes).toHaveLength(0);
      }
      // No written time anywhere on the child's page, visible or spoken.
      const page = container.innerHTML;
      for (const item of document.items) {
        expect(page).not.toContain(`${item.hour}:00`);
        expect(page).not.toContain(`data-hour`);
      }
      expect(container.querySelector("h2")).toHaveTextContent(
        "Fictional Clock Reader’s Clock Explorer practice",
      );
      cleanup();
    }
  });

  test("the inline SVG names no URL, namespace or external resource", () => {
    const { container } = render(createElement(ClockExplorerRenderer, { document: generatedDocument("00000001") }));
    for (const element of container.querySelectorAll("svg, svg *")) {
      for (const attribute of element.attributes) {
        expect(`${attribute.name}=${attribute.value}`).not.toMatch(/xmlns|href|url\(|https?:/iu);
      }
    }
    expect(container.querySelectorAll("img, image, use, foreignObject")).toHaveLength(0);
  });

  test("a document that is not exactly a Clock Explorer page is refused", () => {
    const document = generatedDocument("00000001");
    const mixed = {
      ...document,
      items: [
        ...document.items.slice(0, 3),
        {
          id: "item-004",
          itemType: "dry-math",
          answerability: "objective",
          operation: "addition",
          leftOperand: 1,
          rightOperand: 1,
          renderedSymbol: "+",
          answer: { kind: "number", value: 2 },
        },
      ],
    } as WorksheetDocumentV1;
    // Mirror: the unmixed page renders its four clocks.
    const { container } = render(createElement(ClockExplorerRenderer, { document }));
    expect(container.querySelectorAll("[data-clock-dial]")).toHaveLength(4);
    cleanup();
    const { getByRole } = render(createElement(ClockExplorerRenderer, { document: mixed }));
    expect(getByRole("alert")).toHaveTextContent("This worksheet could not be rendered safely.");
    cleanup();
    const { getByRole: keyRole } = render(createElement(AnswerKeyView, { document: mixed }));
    expect(keyRole("alert")).toHaveTextContent("This answer key could not be rendered safely.");
  });
});

describe("the Clock Explorer key", () => {
  test("names each clock's time and both hands, matching the worksheet's numbering", () => {
    const document = generatedDocument("5eed0035");
    const { container } = render(createElement(AnswerKeyView, { document }));
    const lines = [...container.querySelectorAll("[data-item-id]")].map((line) => ({
      id: line.getAttribute("data-item-id"),
      answer: line.querySelector("[data-answer-value]")?.getAttribute("data-answer-value"),
      text: (line.textContent ?? "").replace(/\s+/gu, " ").trim(),
    }));
    // Seed 5eed0035 draws 3, 9, 1 and 7 o'clock.
    expect(lines).toEqual([
      { id: "item-001", answer: "3:00", text: "1. 3:00 — long hand at 12, short hand at 3" },
      { id: "item-002", answer: "9:00", text: "2. 9:00 — long hand at 12, short hand at 9" },
      { id: "item-003", answer: "1:00", text: "3. 1:00 — long hand at 12, short hand at 1" },
      { id: "item-004", answer: "7:00", text: "4. 7:00 — long hand at 12, short hand at 7" },
    ]);
  });

  test("12:00 keys both hands at twelve", () => {
    const document = generatedDocument("ffffffff");
    const { container } = render(createElement(AnswerKeyView, { document }));
    const twelve = [...container.querySelectorAll("[data-item-id]")].find((line) =>
      line.querySelector("[data-answer-value]")?.textContent === "12:00");
    expect((twelve?.textContent ?? "").replace(/\s+/gu, " ").trim()).toBe(
      "2. 12:00 — long hand at 12, short hand at 12",
    );
  });
});
