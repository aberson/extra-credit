// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";

import {
  oracleReadTally,
  oracleTallyKeyLine,
  type OracleSegment,
} from "../../../../tests/oracles/tally-oracle";
import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../../shared/config/defaults";
import { projectGenerationRequest } from "../../../shared/worksheet/project-request";
import type {
  TallyDetectiveItemV1,
  WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import { generateTallyDetective } from "../../../worksheets/tally-detective/generator";
import { AnswerKeyView } from "../../print/AnswerKeyView";
import { WorksheetPreview } from "../../preview/WorksheetPreview";
import { TallyDetectiveRenderer } from "./Renderer";

afterEach(cleanup);

const WORKSHEET_ID = "77777777-7777-4777-8777-777777777777";

function generatedDocument(seed: string): WorksheetDocumentV1<TallyDetectiveItemV1> {
  const projected = projectGenerationRequest({
    profile: { displayName: "Fictional Tally Counter", interests: [] },
    selection: {
      ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
      worksheetType: "tally-detective",
    },
    generatorVersion: 1,
    seed,
  });
  if (!projected.ok) {
    throw new Error(projected.message);
  }
  const generated = generateTallyDetective(projected.request, { worksheetId: WORKSHEET_ID });
  if (!generated.ok) {
    throw new Error(generated.message);
  }
  return generated.document;
}

/** One real generated tally for every total, found by walking seeds. */
function tallyForEveryTotal(): ReadonlyMap<number, { readonly document: WorksheetDocumentV1; readonly id: string }> {
  const found = new Map<number, { document: WorksheetDocumentV1; id: string }>();
  for (let seed = 1; found.size < 20; seed += 1) {
    const document = generatedDocument(seed.toString(16).padStart(8, "0"));
    for (const item of document.items) {
      const total = item.answer.value;
      if (!found.has(total)) {
        found.set(total, { document, id: item.id });
      }
    }
  }
  return found;
}

/** Every line one card draws, read from its SVG attributes; nothing comes from the document. */
function drawnSegments(card: Element): readonly OracleSegment[] {
  return [...card.querySelectorAll("svg line")].map((line) => {
    const number = (name: string) => Number(line.getAttribute(name));
    return { x1: number("x1"), y1: number("y1"), x2: number("x2"), y2: number("y2") };
  });
}

/** Written out independently of the renderer: each total as full fives and loose marks. */
const EXPECTED_GROUPS = new Map<number, readonly [number, number]>([
  [1, [0, 1]], [2, [0, 2]], [3, [0, 3]], [4, [0, 4]], [5, [1, 0]], [6, [1, 1]], [7, [1, 2]],
  [8, [1, 3]], [9, [1, 4]], [10, [2, 0]], [11, [2, 1]], [12, [2, 2]], [13, [2, 3]], [14, [2, 4]],
  [15, [3, 0]], [16, [3, 1]], [17, [3, 2]], [18, [3, 3]], [19, [3, 4]], [20, [4, 0]],
]);

describe("the Tally Detective worksheet", () => {
  test("every total 1 to 20 draws marks the independent oracle counts back to that total", () => {
    const tallies = tallyForEveryTotal();
    expect([...tallies.keys()].sort((a, b) => a - b)).toEqual([...EXPECTED_GROUPS.keys()]);
    for (const [total, { document, id }] of tallies) {
      const { container } = render(createElement(TallyDetectiveRenderer, { document }));
      const card = container.querySelector(`[data-item-id="${id}"]`);
      expect(card, `${total}`).not.toBeNull();
      const segments = drawnSegments(card as Element);
      const [bundles, loose] = EXPECTED_GROUPS.get(total) ?? [-1, -1];
      expect(oracleReadTally(segments), `${total}`).toEqual({ ok: true, total, bundles, loose });
      // One line per mark: every bundle's four uprights and its crossing, then the loose marks.
      expect(segments, `${total} marks`).toHaveLength(5 * bundles + loose);
      for (const line of card?.querySelectorAll("svg line") ?? []) {
        expect(Number(line.getAttribute("stroke-width"))).toBeGreaterThan(0);
        expect(line.getAttribute("stroke")).not.toBeNull();
        expect(line.getAttribute("stroke")).not.toBe("none");
      }
      cleanup();
    }
  });

  test("each bundle is four parallel uprights and a fifth that crosses all four; loose marks follow", () => {
    const tallies = tallyForEveryTotal();
    for (const total of [4, 5, 6, 10, 19, 20]) {
      const { document, id } = tallies.get(total) ?? { document: undefined, id: "" };
      if (document === undefined) {
        throw new Error(`No generated tally of ${total}.`);
      }
      const { container } = render(createElement(TallyDetectiveRenderer, { document }));
      const card = container.querySelector(`[data-item-id="${id}"]`) as Element;
      const [bundles, loose] = EXPECTED_GROUPS.get(total) ?? [-1, -1];
      const groups = [...card.querySelectorAll("svg g")];
      expect(groups.map((group) => group.querySelectorAll("line").length), `${total}`)
        .toEqual([...Array.from({ length: bundles }, () => 5), ...(loose > 0 ? [loose] : [])]);
      for (const group of groups.slice(0, bundles)) {
        const segments = drawnSegments(group);
        // Four vertical uprights, and a slanted fifth drawn last, over them.
        expect(segments.slice(0, 4).every(({ x1, x2 }) => x1 === x2), `${total} uprights`).toBe(true);
        const crossing = segments[4] as OracleSegment;
        expect(crossing.x1 !== crossing.x2 && crossing.y1 !== crossing.y2, `${total} crossing`).toBe(true);
        expect(oracleReadTally(segments)).toEqual({ ok: true, total: 5, bundles: 1, loose: 0 });
      }
      cleanup();
    }
  });

  test("the reference 8 draws one bundle and three loose marks; 20 draws four full bundles", () => {
    const tallies = tallyForEveryTotal();
    for (const [total, bundles, loose] of [[8, 1, 3], [20, 4, 0]] as const) {
      const { document, id } = tallies.get(total) ?? { document: undefined, id: "" };
      if (document === undefined) {
        throw new Error(`No generated tally of ${total}.`);
      }
      const { container } = render(createElement(TallyDetectiveRenderer, { document }));
      const card = container.querySelector(`[data-item-id="${id}"]`) as Element;
      expect(oracleReadTally(drawnSegments(card))).toEqual({ ok: true, total, bundles, loose });
      cleanup();
    }
  });

  test("each card prints its number, the marks, an empty writing line after How many?, and no answer", () => {
    for (const seed of ["00000001", "5eed0036", "ffffffff"]) {
      const document = generatedDocument(seed);
      const { container } = render(createElement(WorksheetPreview, { document }));
      const cards = [...container.querySelectorAll("[data-item-id]")];
      expect(cards).toHaveLength(4);
      for (const [index, card] of cards.entries()) {
        expect(card.querySelector("[data-problem-number]")).toHaveTextContent(`${index + 1}.`);
        expect(card.querySelectorAll("[data-tally-marks]")).toHaveLength(1);
        const response = card.querySelector("[data-tally-response]");
        expect((response?.textContent ?? "").replace(/\s+/gu, " ").trim()).toBe("How many?");
        const blank = card.querySelector("[data-tally-blank]");
        expect(blank?.textContent).toBe("");
        expect(blank?.childNodes).toHaveLength(0);
      }
      // No key text anywhere on the child's page, visible or spoken.
      const page = container.innerHTML;
      for (const item of document.items) {
        expect(page).not.toContain(oracleTallyKeyLine(item.answer.value));
        expect(page).not.toContain("data-answer-value");
      }
      expect(container.querySelector("h2")).toHaveTextContent(
        "Fictional Tally Counter’s Tally Detective practice",
      );
      expect(container.querySelector("header p")).toHaveTextContent(
        "How many tally marks? Count each set and write the number on its line.",
      );
      cleanup();
    }
  });

  test("the inline SVG names no URL, namespace or external resource", () => {
    const { container } = render(createElement(TallyDetectiveRenderer, { document: generatedDocument("00000001") }));
    for (const element of container.querySelectorAll("svg, svg *")) {
      for (const attribute of element.attributes) {
        expect(`${attribute.name}=${attribute.value}`).not.toMatch(/xmlns|href|url\(|https?:/iu);
      }
    }
    expect(container.querySelectorAll("img, image, use, foreignObject")).toHaveLength(0);
  });

  test("a document that is not exactly a Tally Detective page is refused", () => {
    const document = generatedDocument("00000001");
    const mixed = {
      ...document,
      items: [
        ...document.items.slice(0, 3),
        {
          id: "item-004",
          itemType: "clock-explorer",
          answerability: "objective",
          hour: 3,
          answer: { kind: "number", value: 3 },
        },
      ],
    } as WorksheetDocumentV1;
    // Mirror: the unmixed page renders its four tallies.
    const { container } = render(createElement(TallyDetectiveRenderer, { document }));
    expect(container.querySelectorAll("[data-tally-marks]")).toHaveLength(4);
    cleanup();
    const { getByRole } = render(createElement(TallyDetectiveRenderer, { document: mixed }));
    expect(getByRole("alert")).toHaveTextContent("This worksheet could not be rendered safely.");
    cleanup();
    const { getByRole: keyRole } = render(createElement(AnswerKeyView, { document: mixed }));
    expect(keyRole("alert")).toHaveTextContent("This answer key could not be rendered safely.");
  });
});

describe("the tally oracle is calibrated against garbage", () => {
  const upright = (x: number): OracleSegment => ({ x1: x, y1: 44, x2: x, y2: 6 });
  const crossing = (left: number, right: number): OracleSegment => ({ x1: left, y1: 35, x2: right, y2: 15 });
  const bundle = (left: number) => [upright(left + 7), upright(left + 15), upright(left + 23), upright(left + 31), crossing(left + 2, left + 36)];

  test.each([
    ["five parallel uprights", [0, 8, 16, 24, 32].map(upright)],
    ["a crossing over three uprights", [upright(7), upright(15), upright(23), crossing(2, 28)]],
    ["a crossing over five uprights", [...[7, 15, 23, 31, 39].map(upright), crossing(2, 44)]],
    ["loose marks before a bundle", [upright(2), ...bundle(45)]],
    ["two bundles run together", [...bundle(0), ...bundle(33)]],
    ["a zero-length mark", [{ x1: 5, y1: 5, x2: 5, y2: 5 }]],
    ["a horizontal mark", [{ x1: 0, y1: 20, x2: 30, y2: 20 }]],
    ["no marks", []],
  ] as const)("refuses %s", (_label, segments) => {
    expect(oracleReadTally(segments).ok).toBe(false);
  });

  test("reads a well-formed tally of 8 and of 20", () => {
    expect(oracleReadTally([...bundle(0), upright(52), upright(60), upright(68)]))
      .toEqual({ ok: true, total: 8, bundles: 1, loose: 3 });
    expect(oracleReadTally([0, 45, 90, 135].flatMap(bundle)))
      .toEqual({ ok: true, total: 20, bundles: 4, loose: 0 });
  });
});

describe("the Tally Detective key", () => {
  test("names each tally's total and its grouping, matching the worksheet's numbering", () => {
    const document = generatedDocument("00000001");
    const { container } = render(createElement(AnswerKeyView, { document }));
    const lines = [...container.querySelectorAll("[data-item-id]")].map((line) => ({
      id: line.getAttribute("data-item-id"),
      answer: line.querySelector("[data-answer-value]")?.getAttribute("data-answer-value"),
      text: (line.textContent ?? "").replace(/\s+/gu, " ").trim(),
    }));
    // Seed 00000001 draws 8, 18, 15 and 17: the reference 8 keys as 5 + 3.
    expect(lines).toEqual([
      { id: "item-001", answer: "8", text: "1. 8 = 5 + 3" },
      { id: "item-002", answer: "18", text: "2. 18 = 5 + 5 + 5 + 3" },
      { id: "item-003", answer: "15", text: "3. 15 = 5 + 5 + 5" },
      { id: "item-004", answer: "17", text: "4. 17 = 5 + 5 + 5 + 2" },
    ]);
  });

  test("four full bundles key 20", () => {
    // Seed 0000000a draws 20 first.
    const document = generatedDocument("0000000a");
    const { container } = render(createElement(AnswerKeyView, { document }));
    const twenty = [...container.querySelectorAll("[data-item-id]")].find((line) =>
      line.querySelector("[data-answer-value]")?.textContent === "20");
    expect((twenty?.textContent ?? "").replace(/\s+/gu, " ").trim()).toBe("1. 20 = 5 + 5 + 5 + 5");
  });
});
