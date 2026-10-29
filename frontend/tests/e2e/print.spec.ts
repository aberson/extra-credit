import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { runnerImport } from "vite";

import {
  REVIEWED_TOPIC_IDS,
  type WorksheetDocumentV1,
} from "../../src/shared/worksheet/types.ts";
import { countOrderBound, countSeedFixture, type CountActivity } from "../fixtures/print/count-layout.ts";
import { oracleHourFromHands, type OracleHandVector } from "../oracles/clock-oracle.ts";
import { oracleReadTally, type OracleSegment } from "../oracles/tally-oracle.ts";
import {
  acceptanceConfig,
  boundaryNickname,
  createPrintFixture,
  printFixtures,
} from "../fixtures/print/matrix.ts";
import { requiredPrintContent } from "../fixtures/print/required-content.ts";
import { isIdentityOnlyProfile } from "../fixtures/profiles.ts";
import { expect, test } from "./fixtures/app-server.ts";
import {
  installPrintSeedStub,
  readPrintGeometry,
  readRequiredContent,
} from "./fixtures/print-checks.ts";
import {
  chooseChild,
  chooseLength,
  choosePrintLayout,
  chooseWorksheet,
  chooseWorksheetChoices,
  controls,
  openMoreOptions,
  setPersonalization,
} from "./fixtures/worksheet-controls.ts";

const evidenceRoot = fileURLToPath(
  new URL("../../../.build-step/print-evidence/", import.meta.url),
);

// Independent physical contract, deliberately not read from the app's CSS.
const paperMetrics = {
  letter: {
    page: { width: 612, height: 792 },
    printable: { width: 7.7 * 96, height: 10.2 * 96 },
    margin: "0.4in",
  },
  a4: {
    page: { width: 595.28, height: 841.89 },
    printable: { width: 190 * 96 / 25.4, height: 277 * 96 / 25.4 },
    margin: "10mm",
  },
} as const;

/** The one export of the production line-art module these tests call. */
interface LineArtSelectorModule {
  selectDecorativeAsset(topicId: string, seed: string): { readonly id: string } | undefined;
}

let lineArtModule: Promise<LineArtSelectorModule> | undefined;

/**
 * The production `selectDecorativeAsset` over the bundled catalog. The module
 * imports bundler-only asset queries, so it is loaded through Vite's own
 * module runner rather than Node's loader; the runner binds no port.
 */
function productionLineArt(): Promise<LineArtSelectorModule> {
  lineArtModule ??= runnerImport<LineArtSelectorModule>(
    fileURLToPath(new URL("../../src/web/assets/line-art/manifest.ts", import.meta.url)),
    { root: fileURLToPath(new URL("../../", import.meta.url)), logLevel: "silent" },
  ).then(({ module }) => module);
  return lineArtModule;
}

function expectSelectedPage(selectedPage: string | undefined, paper: keyof typeof paperMetrics) {
  expect(selectedPage, "computed selected print page").toBe(`extra-credit-${paper}`);
}

// Millimetres, independent of the stylesheet: collapsing work space must fail
// even when the resulting sheet fits the paper more easily.
const responseMetrics = {
  // An Operation Grid cell holds four handwritten digits: 14.5 mm square,
  // 17 mm at large scale. A Clock Explorer dial is 40 mm across, 45 mm at
  // large scale, and its hour line is 18 mm (22 mm) long at the line height.
  // A Tally Detective strip is 72 x 20 mm, 81 x 22.5 mm at large scale, and
  // its count line is 18 mm (22 mm) long at the line height.
  standard: {
    lineHeight: 7, drawingHeight: 33, tellingHeight: 100, cellSize: 5,
    missingBoxWidth: 14, missingBoxHeight: 9, gridCell: 14.5,
    clockDial: 40, timeBlankWidth: 18,
    tallyWidth: 72, tallyHeight: 20, countBlankWidth: 18,
  },
  large: {
    lineHeight: 9, drawingHeight: 38, tellingHeight: 110, cellSize: 6,
    missingBoxWidth: 16, missingBoxHeight: 11, gridCell: 17,
    clockDial: 45, timeBlankWidth: 22,
    tallyWidth: 81, tallyHeight: 22.5, countBlankWidth: 22,
  },
} as const;

const physicalSelectors = {
  line: "[data-response-line]",
  drawing: "[data-drawing-box]",
  guideCell: "[data-instructional-guide-cell]",
  frameCell: '[data-instructional-visual="ten-frame"] [data-instructional-mark]',
  circle: "[data-circle-target]",
  decoration: "[data-decorative-panel]",
  missingBox: "[data-missing-box]",
  gridCell: "[data-grid-cell]",
  clockDial: "[data-clock-dial]",
  timeBlank: "[data-time-blank]",
  tallyMarks: "[data-tally-marks]",
  countBlank: "[data-tally-blank]",
} as const;

async function readPhysicalGeometry(page: Page) {
  return await page.locator(".print-surface").evaluate((surface, selectors) => {
    return Object.entries(selectors).flatMap(([kind, selector]) =>
      [...surface.querySelectorAll(selector)].map((element, index) => {
        const box = element.getBoundingClientRect();
        const style = element.ownerDocument.defaultView?.getComputedStyle(element);
        const round = kind !== "circle" || ["top-left", "top-right", "bottom-left", "bottom-right"]
          .every((corner) => {
            const radius = style?.getPropertyValue(`border-${corner}-radius`) ?? "0";
            const axes = radius.split(" ");
            return [box.width, box.height].every((size, axis) => {
              const value = axes[axis] ?? axes[0] ?? "0";
              return Number.parseFloat(value) * (value.endsWith("%") ? size / 100 : 1) >= size / 2 - 0.1;
            });
          });
        return {
          kind,
          index,
          round,
          drawingMode: element.closest("[data-writing-mode]")
            ?.getAttribute("data-writing-mode") ?? null,
          widthMm: box.width * 25.4 / 96,
          heightMm: box.height * 25.4 / 96,
        };
      }),
    );
  }, physicalSelectors);
}

function physicalViolations(
  geometry: Awaited<ReturnType<typeof readPhysicalGeometry>>,
  scale: "standard" | "large",
) {
  const expected = responseMetrics[scale];
  const violations: string[] = [];
  for (const box of geometry) {
    const label = `${box.kind}[${box.index}]`;
    const exact = (dimension: "widthMm" | "heightMm", target: number) => {
      // Chromium rounds layout to subpixels; 0.15 mm is less than one pixel.
      if (Math.abs(box[dimension] - target) > 0.15) {
        violations.push(`${label}: ${dimension} ${box[dimension]} != ${target}`);
      }
    };
    switch (box.kind) {
      case "line":
      case "drawing":
        if (box.widthMm < 150) {
          violations.push(`${label}: usable width ${box.widthMm} < 150 mm`);
        }
        exact("heightMm", box.kind === "line"
          ? expected.lineHeight
          : box.drawingMode === "draw-and-tell"
            ? expected.tellingHeight
            : expected.drawingHeight);
        break;
      case "guideCell":
      case "frameCell":
        exact("widthMm", expected.cellSize);
        exact("heightMm", expected.cellSize);
        break;
      case "circle":
        exact("widthMm", 4);
        exact("heightMm", 4);
        if (!box.round) violations.push(`${label}: circle must be round`);
        break;
      case "decoration":
        exact("widthMm", 24);
        exact("heightMm", 24);
        break;
      case "missingBox":
        exact("widthMm", expected.missingBoxWidth);
        exact("heightMm", expected.missingBoxHeight);
        break;
      case "gridCell":
        exact("widthMm", expected.gridCell);
        exact("heightMm", expected.gridCell);
        break;
      case "clockDial":
        exact("widthMm", expected.clockDial);
        exact("heightMm", expected.clockDial);
        break;
      case "timeBlank":
        exact("widthMm", expected.timeBlankWidth);
        exact("heightMm", expected.lineHeight);
        break;
      case "tallyMarks":
        exact("widthMm", expected.tallyWidth);
        exact("heightMm", expected.tallyHeight);
        break;
      case "countBlank":
        exact("widthMm", expected.countBlankWidth);
        exact("heightMm", expected.lineHeight);
        break;
      default:
        throw new Error(`Unspecified physical contract: ${box.kind}`);
    }
  }
  return violations;
}

async function comparePrintScales(
  page: Page,
  large: Awaited<ReturnType<typeof readPhysicalGeometry>>,
) {
  const surface = page.locator(".print-surface");
  await expect(surface).toHaveAttribute("data-print-scale", "large");
  let standard: typeof large;
  try {
    await surface.evaluate((element) => element.setAttribute("data-print-scale", "standard"));
    standard = await readPhysicalGeometry(page);
    expect(physicalViolations(standard, "standard"), "standard response dimensions").toEqual([]);
    expect(standard.map(({ kind, index }) => ({ kind, index })))
      .toEqual(large.map(({ kind, index }) => ({ kind, index })));
    for (const [index, box] of large.entries()) {
      const smaller = standard[index];
      if (smaller === undefined) {
        throw new Error("Missing matching standard response box.");
      }
      if (["line", "drawing", "guideCell", "frameCell", "missingBox", "gridCell", "clockDial", "timeBlank", "tallyMarks", "countBlank"].includes(box.kind)) {
        expect(box.heightMm, `${box.kind}: large increases response height`)
          .toBeGreaterThan(smaller.heightMm + 0.5);
        if (["guideCell", "frameCell", "missingBox", "gridCell", "clockDial", "timeBlank", "tallyMarks", "countBlank"].includes(box.kind)) {
          expect(box.widthMm, `${box.kind}: large increases response width`)
            .toBeGreaterThan(smaller.widthMm + 0.5);
        }
      } else {
        expect(box, `${box.kind}: the fixed reservation survives scale changes`)
          .toEqual(smaller);
      }
    }
  } finally {
    await surface.evaluate((element) => element.setAttribute("data-print-scale", "large"));
  }
  expect(await readPhysicalGeometry(page), "large geometry restored").toEqual(large);
  return { standard, large };
}

type DecorationState = "art" | "doodle" | "absent";

async function readDecoration(page: Page, expected: DecorationState) {
  const panel = page.locator(".print-surface [data-decorative-panel]");
  await expect(panel).toHaveCount(expected === "absent" ? 0 : 1);
  const art = page.locator(".print-surface img[data-decorative-art]");
  const doodle = page.locator(".print-surface [data-doodle-box]");
  await expect(art).toHaveCount(expected === "art" ? 1 : 0);
  await expect(doodle).toHaveCount(expected === "doodle" ? 1 : 0);
  if (expected === "absent") {
    return { expected, state: "absent" as const };
  }
  await expect(panel).toHaveAttribute("data-decoration", expected);
  await expect(panel).toBeVisible();
  if (expected === "art") {
    await expect(art).toHaveAttribute("data-decorative-art-status", "ready");
  }
  const painted = await (expected === "art" ? art : doodle).evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    if (view === null) {
      throw new Error("Missing browser window.");
    }
    for (let node: typeof element | null = element; node !== null; node = node.parentElement) {
      const style = view.getComputedStyle(node);
      if (style.visibility !== "visible" || style.display === "none" ||
        Number(style.opacity) === 0) {
        return false;
      }
    }
    return true;
  });
  expect(painted, "print decoration and its ancestors must be visible").toBe(true);
  if (expected === "doodle") {
    await expect(doodle).toBeVisible();
    await expect(doodle).toHaveCSS("opacity", "1");
    return { expected, state: "doodle" as const, visible: true };
  }
  await expect(art).toBeVisible();
  await expect(art).toHaveCSS("opacity", "1");
  const decoded = await art.evaluate(async (element) => {
    const view = element.ownerDocument.defaultView;
    if (view === null || !(element instanceof view.HTMLImageElement)) {
      throw new Error("Decorative art must be an image.");
    }
    await element.decode();
    return {
      asset: element.getAttribute("data-decorative-art"),
      status: element.getAttribute("data-decorative-art-status"),
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    };
  });
  expect(decoded.complete).toBe(true);
  expect(decoded.naturalWidth).toBeGreaterThan(0);
  expect(decoded.naturalHeight).toBeGreaterThan(0);
  return { expected, state: "art" as const, visible: true, decoded };
}

/**
 * Every printed operator sign narrower than 2 mm, measured from its rendered
 * box rather than read from the stylesheet, plus a violation when no sign
 * printed at all.
 */
async function operatorViolations(page: Page): Promise<readonly string[]> {
  return await page.locator(".print-surface").evaluate((surface) => {
    const operators = [...surface.querySelectorAll("[data-operator]")];
    const narrow = operators.flatMap((operator, index) => {
      const widthMm = operator.getBoundingClientRect().width * 25.4 / 96;
      return widthMm >= 2 ? [] : [`operator[${index}] ${operator.textContent ?? ""}: ${widthMm} mm`];
    });
    return operators.length === 0 ? ["no operator printed"] : narrow;
  });
}

/** The screen transform an SVG element reports, read without the DOM library's types. */
interface ScreenMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/** One clock's drawn hands as the browser painted them, plus every ink violation. */
interface ClockInkReading {
  readonly id: string;
  readonly violations: readonly string[];
  readonly minute?: OracleHandVector;
  readonly hour?: OracleHandVector;
  readonly dial?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

/**
 * Reads every dial's outline and hands under the current media, from the
 * rendered SVG alone: each must exist once, paint real ink (a stroke that is
 * neither none nor transparent, positive width and opacity, every ancestor
 * visible), start at the dial's centre, stay inside its outline and touch no
 * label. Each hand's painted vector is returned for the independent oracle.
 */
async function readClockInk(page: Page): Promise<readonly ClockInkReading[]> {
  return await page.locator(".print-surface").evaluate((surface) => {
    const view = surface.ownerDocument.defaultView;
    if (view === null) {
      throw new Error("Missing browser window.");
    }
    type BrowserElement = Parameters<typeof view.getComputedStyle>[0];
    const transparent = (color: string) =>
      color === "" || color === "none" || color === "transparent" ||
      /^(?:rgba\([^)]*,|[^)]*\/)\s*0(?:\.0+)?\s*\)$/u.test(color);
    const shown = (element: BrowserElement) => {
      for (let node: BrowserElement | null = element; node !== null; node = node.parentElement) {
        const style = view.getComputedStyle(node);
        if (style.visibility !== "visible" || style.display === "none" || Number(style.opacity) === 0) {
          return false;
        }
      }
      return true;
    };
    return [...surface.querySelectorAll("[data-item-id]")].map((card) => {
      const id = card.getAttribute("data-item-id") ?? "";
      const violations: string[] = [];
      const dial = card.querySelector("[data-clock-dial]");
      const svg = dial?.querySelector("svg");
      if (dial === null || dial === undefined || svg === null || svg === undefined) {
        return { id, violations: ["missing dial"] };
      }
      const dialBox = dial.getBoundingClientRect();
      const centre = { x: dialBox.left + dialBox.width / 2, y: dialBox.top + dialBox.height / 2 };
      const labels = [...dial.querySelectorAll("[data-clock-label]")].map((label) => label.getBoundingClientRect());
      // Twelve labels, each inside the dial and clear of every other one.
      if (labels.length !== 12) violations.push(`${labels.length} labels`);
      for (const [index, box] of labels.entries()) {
        if (box.left < dialBox.left - 1 || box.right > dialBox.right + 1 ||
          box.top < dialBox.top - 1 || box.bottom > dialBox.bottom + 1) {
          violations.push(`label ${index + 1} leaves the dial`);
        }
        for (const other of labels.slice(index + 1)) {
          if (Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0.5 &&
            Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0.5) {
            violations.push(`label ${index + 1} overlaps another label`);
          }
        }
      }
      const ink = (selector: string) => {
        const found = [...svg.querySelectorAll(selector)];
        if (found.length !== 1) {
          violations.push(`${selector}: ${found.length} drawn`);
          return undefined;
        }
        const element = found[0] as BrowserElement;
        const style = view.getComputedStyle(element);
        const matrix = (element as unknown as { getScreenCTM(): ScreenMatrix | null }).getScreenCTM();
        const scale = matrix === null ? 0 : Math.hypot(matrix.a, matrix.b);
        const width = Number.parseFloat(style.strokeWidth) * scale;
        if (transparent(style.stroke)) violations.push(`${selector}: no stroke`);
        if (!(width > 0.5)) violations.push(`${selector}: stroke width ${width}`);
        if (!(Number(style.strokeOpacity) > 0)) violations.push(`${selector}: stroke opacity`);
        if (!shown(element)) violations.push(`${selector}: hidden`);
        return { element, matrix, width };
      };
      // A point in an element's own coordinates, on the screen.
      const onScreen = (matrix: ScreenMatrix, x: number, y: number) => ({
        x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f,
      });
      const attribute = (element: BrowserElement, name: string) => Number(element.getAttribute(name));
      const outline = ink("[data-clock-outline]");
      if (outline !== undefined && outline.matrix !== null) {
        const circle = outline.element;
        const at = onScreen(outline.matrix, attribute(circle, "cx"), attribute(circle, "cy"));
        const radius = attribute(circle, "r") * Math.hypot(outline.matrix.a, outline.matrix.b);
        if (Math.hypot(at.x - centre.x, at.y - centre.y) > 1) violations.push("outline off centre");
        if (!(radius > dialBox.width * 0.4) || radius + outline.width / 2 > dialBox.width / 2 + 1) {
          violations.push(`outline radius ${radius}`);
        }
      }
      const outlineRadius = dialBox.width / 2;
      const hand = (which: "minute" | "hour") => {
        const drawn = ink(`[data-clock-hand="${which}"]`);
        if (drawn === undefined || drawn.matrix === null) {
          return undefined;
        }
        const line = drawn.element;
        const start = onScreen(drawn.matrix, attribute(line, "x1"), attribute(line, "y1"));
        const end = onScreen(drawn.matrix, attribute(line, "x2"), attribute(line, "y2"));
        const vector = { dx: end.x - start.x, dy: end.y - start.y };
        const length = Math.hypot(vector.dx, vector.dy);
        if (!(length > 5)) violations.push(`${which} hand length ${length}`);
        if (Math.hypot(start.x - centre.x, start.y - centre.y) > 1) violations.push(`${which} hand off centre`);
        if (Math.hypot(end.x - centre.x, end.y - centre.y) + drawn.width / 2 > outlineRadius) {
          violations.push(`${which} hand leaves the dial`);
        }
        // No point of the stroked hand may fall inside a label's box.
        for (let step = 0; step <= 40; step += 1) {
          const x = start.x + (vector.dx * step) / 40;
          const y = start.y + (vector.dy * step) / 40;
          const margin = drawn.width / 2;
          if (labels.some((box) =>
            x > box.left - margin && x < box.right + margin && y > box.top - margin && y < box.bottom + margin)) {
            violations.push(`${which} hand meets a label`);
            break;
          }
        }
        return vector;
      };
      const minute = hand("minute");
      const hour = hand("hour");
      return {
        id,
        violations,
        ...(minute === undefined ? {} : { minute }),
        ...(hour === undefined ? {} : { hour }),
        dial: { left: dialBox.left, top: dialBox.top, width: dialBox.width, height: dialBox.height },
      };
    });
  });
}

/**
 * The family print oracle for Clock Explorer: every ink violation, plus a
 * violation for each clock whose painted hands do not read back, through the
 * independent oracle, as the hour the generated document gave that clock.
 */
async function clockInkViolations(page: Page, document: WorksheetDocumentV1): Promise<readonly string[]> {
  const readings = await readClockInk(page);
  const violations = readings.flatMap(({ id, violations: found }) => found.map((violation) => `${id}: ${violation}`));
  if (readings.length !== document.items.length) {
    violations.push(`clocks: ${readings.length} != ${document.items.length}`);
  }
  for (const item of document.items) {
    if (item.itemType !== "clock-explorer") {
      violations.push(`${item.id}: not a clock`);
      continue;
    }
    const reading = readings.find(({ id }) => id === item.id);
    const read = reading?.minute === undefined || reading.hour === undefined
      ? undefined
      : oracleHourFromHands(reading.minute, reading.hour);
    if (read !== item.hour) {
      violations.push(`${item.id}: hands read ${String(read)}, expected ${item.hour}`);
    }
  }
  return violations;
}

/** One tally's inked marks as the browser painted them, plus every ink violation. */
interface TallyInkReading {
  readonly id: string;
  readonly violations: readonly string[];
  readonly segments: readonly OracleSegment[];
  readonly strip?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

/**
 * Reads every tally's marks under the current media, from the rendered SVG
 * alone: every `line` it draws must paint real ink (a stroke that is neither
 * none nor transparent, positive width and opacity, every ancestor visible)
 * and stay inside the printed strip. Only inked marks are returned, as screen
 * segments, so a hidden or zero-width mark is both a violation and a mark the
 * independent oracle never sees.
 */
async function readTallyInk(page: Page): Promise<readonly TallyInkReading[]> {
  return await page.locator(".print-surface").evaluate((surface) => {
    const view = surface.ownerDocument.defaultView;
    if (view === null) {
      throw new Error("Missing browser window.");
    }
    type BrowserElement = Parameters<typeof view.getComputedStyle>[0];
    const transparent = (color: string) =>
      color === "" || color === "none" || color === "transparent" ||
      /^(?:rgba\([^)]*,|[^)]*\/)\s*0(?:\.0+)?\s*\)$/u.test(color);
    const shown = (element: BrowserElement) => {
      for (let node: BrowserElement | null = element; node !== null; node = node.parentElement) {
        const style = view.getComputedStyle(node);
        if (style.visibility !== "visible" || style.display === "none" || Number(style.opacity) === 0) {
          return false;
        }
      }
      return true;
    };
    return [...surface.querySelectorAll("[data-item-id]")].map((card) => {
      const id = card.getAttribute("data-item-id") ?? "";
      const violations: string[] = [];
      const strip = card.querySelector("[data-tally-marks]");
      const svg = strip?.querySelector("svg");
      if (strip === null || strip === undefined || svg === null || svg === undefined) {
        return { id, violations: ["missing tally"], segments: [] };
      }
      const box = strip.getBoundingClientRect();
      const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
      for (const [index, element] of [...svg.querySelectorAll("line")].entries()) {
        const line = element as BrowserElement;
        const style = view.getComputedStyle(line);
        const matrix = (line as unknown as { getScreenCTM(): ScreenMatrix | null }).getScreenCTM();
        const scale = matrix === null ? 0 : Math.hypot(matrix.a, matrix.b);
        const width = Number.parseFloat(style.strokeWidth) * scale;
        const inked = !transparent(style.stroke) && width > 0.5 &&
          Number(style.strokeOpacity) > 0 && shown(line) && matrix !== null;
        if (!inked || matrix === null) {
          violations.push(`mark ${index + 1}: no ink (stroke ${style.stroke}, width ${width})`);
          continue;
        }
        const point = (x: string, y: string) => {
          const [px, py] = [Number(line.getAttribute(x)), Number(line.getAttribute(y))];
          return { x: matrix.a * px + matrix.c * py + matrix.e, y: matrix.b * px + matrix.d * py + matrix.f };
        };
        const start = point("x1", "y1");
        const end = point("x2", "y2");
        for (const { x, y } of [start, end]) {
          if (x - width / 2 < box.left - 0.5 || x + width / 2 > box.right + 0.5 ||
            y - width / 2 < box.top - 0.5 || y + width / 2 > box.bottom + 0.5) {
            violations.push(`mark ${index + 1} leaves the strip`);
            break;
          }
        }
        segments.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
      }
      return {
        id,
        violations,
        segments,
        strip: { left: box.left, top: box.top, width: box.width, height: box.height },
      };
    });
  });
}

/**
 * The family print oracle for Tally Detective: every ink violation, plus a
 * violation for each tally whose painted marks do not read back, through the
 * independent oracle, as the bundles, loose marks and total the generated
 * document gave that tally.
 */
async function tallyInkViolations(page: Page, document: WorksheetDocumentV1): Promise<readonly string[]> {
  const readings = await readTallyInk(page);
  const violations = readings.flatMap(({ id, violations: found }) => found.map((violation) => `${id}: ${violation}`));
  if (readings.length !== document.items.length) {
    violations.push(`tallies: ${readings.length} != ${document.items.length}`);
  }
  for (const item of document.items) {
    if (item.itemType !== "tally-detective") {
      violations.push(`${item.id}: not a tally`);
      continue;
    }
    const read = oracleReadTally(readings.find(({ id }) => id === item.id)?.segments ?? []);
    const expected = { ok: true, total: 5 * item.bundles + item.remainder, bundles: item.bundles, loose: item.remainder };
    if (JSON.stringify(read) !== JSON.stringify(expected)) {
      violations.push(`${item.id}: marks read ${JSON.stringify(read)}, expected ${expected.total}`);
    }
  }
  return violations;
}

async function withPrintStyle(page: Page, content: string, check: () => Promise<void>) {
  const style = await page.addStyleTag({ content });
  try {
    await check();
  } finally {
    await style.evaluate((element) => element.remove());
  }
}

function fitsPaper(bounds: Record<string, number>, paper: "letter" | "a4"): boolean {
  const printable = paperMetrics[paper].printable;
  return bounds.left !== undefined && bounds.top !== undefined &&
    bounds.right !== undefined && bounds.bottom !== undefined &&
    Math.abs(bounds.left) <= 1 && Math.abs(bounds.top) <= 1 &&
    bounds.right <= printable.width + 1 && bounds.bottom <= printable.height + 1;
}

async function expectCountBoundary(page: Page, document: WorksheetDocumentV1) {
  const actual = await page.locator(".print-surface [data-item-id]").evaluateAll(
    (items) => items.map((item) => ({
      id: item.getAttribute("data-item-id"),
      activity: item.getAttribute("data-activity"),
      target: item.querySelector("[data-visible-numeral]")?.textContent ?? null,
      quantities: [...item.querySelectorAll("[data-instructional-visual]")].map(
        (visual) => Number(visual.getAttribute("data-instructional-quantity")),
      ),
    })),
  );
  const expected = document.items.map((item) => {
    if (item.itemType !== "count-compare") {
      throw new Error("Expected the Count/Compare fixture.");
    }
    return {
      id: item.id,
      activity: item.activity,
      target: item.activity === "compare" ? null : String(item.target),
      quantities: item.activity === "match"
        ? item.choices
        : item.activity === "compare"
          ? [item.leftQuantity, item.rightQuantity]
          : item.activity === "complete" ? [item.partial] : [],
    };
  });
  expect(actual, "rendered Count/Compare items reproduce the boundary seed").toEqual(expected);
}

async function measurePrint(
  page: Page,
  name: string,
  paper: "letter" | "a4",
  scale: "standard" | "large",
  document: WorksheetDocumentV1,
  surface: "worksheet" | "answer",
  decoration: DecorationState,
  outputRoot = evidenceRoot,
) {
  await page.emulateMedia({ media: "print" });
  await page.locator("html").evaluate(async (html) => {
    await html.ownerDocument.fonts.ready;
    html.ownerDocument.defaultView?.scrollTo(0, 0);
  });
  await expect(page.locator(".profile-workspace")).toBeHidden();
  for (const control of await page.locator(".print-controls").all()) {
    await expect(control).toBeHidden();
  }
  const content = await readRequiredContent(page, requiredPrintContent(document, surface));
  expect(content.violations, `${name}: required print content`).toEqual([]);
  if (surface === "worksheet" && document.worksheetType === "count-compare-make") {
    await expectCountBoundary(page, document);
  }
  const decorationState = await readDecoration(page, decoration);
  const physical = await readPhysicalGeometry(page);
  expect(physicalViolations(physical, scale), `${name}: physical response contract`).toEqual([]);
  const scaleComparison = surface === "worksheet" && scale === "large"
    ? await comparePrintScales(page, physical)
    : undefined;
  const geometry = await readPrintGeometry(page,
    surface === "worksheet" && document.worksheetType === "count-compare-make");
  const metrics = paperMetrics[paper];
  const selectedPage = await page.locator(".print-surface").evaluate((surface) =>
    surface.ownerDocument.defaultView?.getComputedStyle(surface).getPropertyValue("page"),
  );
  expectSelectedPage(selectedPage, paper);
  const pageRules = await page.locator("html").evaluate((html) =>
    [...html.ownerDocument.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
      .filter((rule) => rule.startsWith("@page")),
  );
  await mkdir(outputRoot, { recursive: true });
  const bytes = await page.pdf({
    preferCSSPageSize: true,
    printBackground: false,
    displayHeaderFooter: false,
  });
  const pdf = await PDFDocument.load(bytes);
  const pageSizes = pdf.getPages().map((sheet) => sheet.getSize());
  await writeFile(`${outputRoot}/${name}.pdf`, bytes);
  await writeFile(`${outputRoot}/${name}.json`, JSON.stringify({
    expected: metrics,
    fixtureSeed: document.seed,
    content,
    pageRules,
    selectedPage,
    geometry,
    physical,
    scaleComparison,
    decoration: decorationState,
    pageCount: pdf.getPageCount(),
    pageSizes,
  }, null, 2));
  expect(pdf.getPageCount(), `${name}: PDF page count`).toBe(1);
  expect(pageSizes[0]?.width).toBeCloseTo(metrics.page.width, 0);
  expect(pageSizes[0]?.height).toBeCloseTo(metrics.page.height, 0);
  expect(pageRules.find((rule) => rule.startsWith(`@page extra-credit-${paper}`)))
    .toContain(`margin: ${metrics.margin};`);
  expect(geometry.printableHeight).toBeCloseTo(metrics.printable.height, 0);
  expect(geometry.bounds.width).toBeCloseTo(metrics.printable.width, 0);
  expect(fitsPaper(geometry.bounds, paper), `${name}: independent printable extent`).toBe(true);
  expect(geometry.fontSize).toBe(scale === "large" ? "24px" : "21.3333px");
  expect(geometry.violations, name).toEqual([]);
  expect(geometry.groups.length).toBeGreaterThan(0);
  expect(geometry.groups.every((group) => group.breakInside === "avoid")).toBe(true);
  expect(geometry.visuals.every(
    (visual) => visual.visible && visual.width > 0 && visual.height > 0,
  )).toBe(true);
  await page.screenshot({ path: `${outputRoot}/${name}.png`, fullPage: true });
}

for (const paper of ["letter", "a4"] as const) {
  for (const scale of ["standard", "large"] as const) {
    test(`count ordering and frame bounds ${paper} ${scale}`, async ({ appServer, page }) => {
      test.setTimeout(120_000);
      const root = `${evidenceRoot}/../count-order-evidence/${paper}-${scale}`;
      const fixture = countSeedFixture(5, paper, scale);
      await appServer.seedConfig({
        ...acceptanceConfig,
        profiles: acceptanceConfig.profiles.map((profile, index) => index === 2 ? fixture.profile : profile),
        defaults: fixture.defaults,
      });
      await installPrintSeedStub(page);
      await page.goto(appServer.origin);
      await chooseChild(page, fixture.profile.id);
      await chooseWorksheet(page, "count-compare-make");
      await page.emulateMedia({ media: "print" });
      const bound = countOrderBound(paper, scale);
      expect(bound.permutations).toBe(scale === "standard" ? 25_200 : 2_520);
      // Title/art only: each problem carries its own directions. These bounds
      // retain the worst-case nickname and the reserved decorative panel.
      const headerBound = scale === "standard" ? 112 : 120;
      expect(headerBound + bound.maximum).toBeLessThan(paperMetrics[paper].printable.height);
      const observations = [];
      async function generate(seed: number) {
        await page.locator("html").evaluate((html, value) => {
          const document = html.ownerDocument;
          html.setAttribute("data-print-seed", String(value));
          const button = [...document.querySelectorAll("button")]
            .find((candidate) => candidate.textContent === "Create worksheet");
          button?.click();
        }, seed);
        await expect(page.locator(".print-surface [data-seed]")).toHaveAttribute("data-seed", seed.toString(16).padStart(8, "0"));
      }
      // Bounded real-generator sweep: varying quantities, 1/2 frames, the
      // tenth problem number, and shuffled subtype orders. No DOM injection.
      for (let seed = 1; seed <= 240; seed += 1) {
        await generate(seed);
        const observed = await page.locator(".print-surface").evaluate((surface) => ({
          bottom: surface.getBoundingClientRect().bottom,
          top: surface.querySelector("[data-item-id]")?.getBoundingClientRect().top ?? Infinity,
          cards: [...surface.querySelectorAll("[data-item-id]")].map((item) => ({
            activity: item.getAttribute("data-activity") as CountActivity,
            height: item.getBoundingClientRect().height,
            target: Number(item.querySelector("[data-visible-numeral]")?.textContent),
          })),
          markRows: [...surface.querySelectorAll('[data-instructional-visual="group"]')]
            .map((group) => new Set([...group.children].map((mark) => mark.getBoundingClientRect().top)).size),
          frames: [...surface.querySelectorAll("[data-instructional-capacity], [data-instructional-guide-cells]")]
            .map((element) => Number(element.getAttribute("data-instructional-capacity") ??
              element.getAttribute("data-instructional-guide-cells"))),
        }));
        expect(observed.top).toBeLessThanOrEqual(headerBound);
        expect(observed.bottom).toBeLessThanOrEqual(paperMetrics[paper].printable.height);
        for (const card of observed.cards) {
          expect(card.height, `${seed}: ${card.activity}`).toBeLessThanOrEqual(bound.heights[card.activity]);
        }
        observations.push({ seed, ...observed });
        // Isolate order-dependent text: the maximum legal problem prefix.
        // Large has eight items, so a two-digit prefix is not reachable there.
        // Restore text immediately; this does not replace a generated item.
        const widePrefix = await page.locator(".print-surface [data-item-id]").evaluateAll((items, prefix) =>
          items.map((item) => {
            const number = item.querySelector("[data-problem-number]");
            if (number === null) throw new Error("Missing problem prefix.");
            const original = number.textContent;
            number.textContent = prefix;
            const height = item.getBoundingClientRect().height;
            number.textContent = original;
            return height;
          }), scale === "standard" ? "10." : "8.",
        );
        for (const [index, card] of observed.cards.entries()) {
          expect(widePrefix[index], `${seed}: wide prefix ${card.activity}`)
            .toBeLessThanOrEqual(bound.heights[card.activity]);
        }
      }
      expect(new Set(observations.flatMap((row) => row.frames))).toEqual(new Set([10, 20]));
      expect(new Set(observations.flatMap((row) => row.markRows))).toEqual(new Set([1, 2, 3, 4]));
      for (const activity of ["match", "complete", "draw"] as const) {
        const first = activity === "complete" ? 2 : 1;
        expect(new Set(observations.flatMap((row) => row.cards)
          .filter((card) => card.activity === activity).map((card) => card.target)))
          .toEqual(new Set(Array.from({ length: 21 - first }, (_, index) => index + first)));
      }
      const worstSeeds = [...observations].sort((a, b) => b.bottom - a.bottom).slice(0, 2).map((row) => row.seed);
      for (const seed of new Set([5, 237, ...worstSeeds])) {
        await generate(seed);
        await measurePrint(page, `seed-${seed}`, paper, scale,
          countSeedFixture(seed, paper, scale).document, "worksheet", "doodle", root);
        const frames = await page.locator(".print-surface [data-ten-frame]").evaluateAll((elements) =>
          elements.map((frame) => {
            const cells = [...frame.children].map((cell) => cell.getBoundingClientRect());
            return { count: cells.length, rows: new Set(cells.map((cell) => cell.top)).size,
              columns: new Set(cells.map((cell) => cell.left)).size };
          }),
        );
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.every((frame) => frame.count === 10 && frame.rows === 2 && frame.columns === 5)).toBe(true);
        if (paper === "letter" && scale === "standard" && seed === 5) {
          await withPrintStyle(page,
            '.print-surface [data-instructional-visual="ten-frame"], ' +
            '.print-surface [data-instructional-guide-cells] { flex-direction: column; gap: 0; } ' +
            '.print-surface [data-activity] { margin-bottom: 2mm; } ' +
            '.print-surface [data-activity] p { margin-bottom: 1mm !important; }',
            async () => {
              const geometry = await readPrintGeometry(page, true);
              expect(fitsPaper(geometry.bounds, paper)).toBe(false);
              const bytes = await page.pdf({ preferCSSPageSize: true });
              expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
              await writeFile(`${root}/old-layout-negative.pdf`, bytes);
              await writeFile(`${root}/old-layout-negative.json`, JSON.stringify(geometry, null, 2));
            });
        }
      }
      // Stress the two worst contiguous orders using REAL rendered content,
      // expanded (never shrunk) to independent maximum card-height budgets.
      // This is explicitly a DOM layout stress, separate from the real seed PDFs.
      await generate(237);
      for (const [index, order] of [bound.worst, [...bound.worst].reverse()].entries()) {
        await page.locator('.print-surface article > ol').evaluate((list, args) => {
          const remaining = [...list.children];
          for (const [index, activity] of args.order.entries()) {
            const position = remaining.findIndex((item) => item.getAttribute("data-activity") === activity);
            const item = remaining.splice(position, 1)[0];
            if (item === undefined) throw new Error("Missing stress subtype.");
            item.setAttribute("style", `${item.getAttribute("style") ?? ""};min-height:${args.heights[activity]}px`);
            const number = item.querySelector("[data-problem-number]");
            if (number === null) throw new Error("Missing stress problem prefix.");
            number.setAttribute("data-problem-number", String(index + 1));
            number.textContent = `${index + 1}.`;
            list.append(item);
          }
        }, { order, heights: bound.heights });
        const geometry = await readPrintGeometry(page, true);
        expect(geometry.violations).toEqual([]);
        expect(fitsPaper(geometry.bounds, paper)).toBe(true);
        expect(physicalViolations(await readPhysicalGeometry(page), scale)).toEqual([]);
        const bytes = await page.pdf({ preferCSSPageSize: true });
        expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
        await mkdir(root, { recursive: true });
        await writeFile(`${root}/worst-order-${index}.pdf`, bytes);
        await writeFile(`${root}/worst-order-${index}.json`, JSON.stringify({ order, geometry }, null, 2));
        await page.screenshot({ path: `${root}/worst-order-${index}.png`, fullPage: true });
      }
      await writeFile(`${root}/sweep.json`, JSON.stringify({ bound, headerBound, observations }, null, 2));
    });
  }
}

/**
 * Every worksheet case the loop below defines, and whether it also measures a
 * key PDF, recorded as each test is defined so the counts are read from the
 * same expansion the tests use.
 */
const matrixCases: { readonly name: string; readonly keyPdf: boolean }[] = [];

for (const fixture of printFixtures) {
  const decorationApplicable = ["sentence-builder", "count-compare-make"]
    .includes(fixture.selection.worksheetType);
  for (const scale of ["standard", "large"] as const) {
    if (
      (fixture.letterStandardOnly === true && scale !== "standard") ||
      (fixture.printedOn !== undefined && !fixture.printedOn.some((only) => only.scale === scale))
    ) {
      continue;
    }
    const boundary = createPrintFixture(fixture, scale);
    for (const paper of ["letter", "a4"] as const) {
      if (
        (fixture.letterStandardOnly === true && paper !== "letter") ||
        (fixture.printedOn !== undefined &&
          !fixture.printedOn.some((only) => only.paper === paper && only.scale === scale))
      ) {
        continue;
      }
      for (const decoration of decorationApplicable ? [false, true] : [false]) {
        const name = `${fixture.id}-${paper}-${scale}-decoration-${decoration}`;
        const keyPdf = !decoration && boundary.document.request.options.includeAnswerKey;
        matrixCases.push({ name, keyPdf });
        test(name, async ({ appServer, page }) => {
          test.setTimeout(60_000);
          await appServer.seedConfig({
            ...acceptanceConfig,
            defaults: { ...acceptanceConfig.defaults, includeDecorativeGraphics: decoration },
          });
          await page.addInitScript((seed) => {
            const crypto = (globalThis as unknown as {
              crypto: { getRandomValues: (array: ArrayBufferView) => ArrayBufferView };
            }).crypto;
            const original = crypto.getRandomValues.bind(crypto);
            Object.defineProperty(Crypto.prototype, "getRandomValues", {
              configurable: true,
              value(array: ArrayBufferView | null) {
                if (array instanceof Uint32Array) {
                  array[0] = seed;
                  return array;
                }
                if (array === null) {
                  throw new TypeError("A random buffer is required.");
                }
                return original(array);
              },
            });
          }, boundary.seed);
          await page.goto(appServer.origin);
          const original = acceptanceConfig.profiles[fixture.profileIndex];
          if (original === undefined) {
            throw new Error("Missing canonical profile.");
          }
          // The profile editor holds only identity fields: the case edits the
          // nickname and, for Sentence Builder, the interests, and makes every
          // worksheet choice through the worksheet controls.
          await page.getByRole("button", { name: `Edit ${original.displayName}` }).click();
          await page.getByRole("textbox", { name: "Nickname (optional)" }).fill(boundaryNickname);
          if (fixture.selection.worksheetType === "sentence-builder") {
            await page.getByRole("textbox", { name: /Broad interests/ })
              .fill(boundary.profile.interests.join(", "));
          }
          const saved = page.waitForResponse((response) =>
            response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/config",
          );
          await page.getByRole("button", { name: "Save profile" }).click();
          expect((await saved).status()).toBe(200);
          const stored = await appServer.readConfig();
          expect(stored.profiles).toHaveLength(acceptanceConfig.profiles.length);
          expect(stored.profiles.filter((profile) => !isIdentityOnlyProfile(profile))).toEqual([]);
          await chooseChild(page, original.id);
          await chooseWorksheetChoices(page, fixture.selection);
          await openMoreOptions(page);
          await choosePrintLayout(page, { printScale: scale });
          await choosePrintLayout(page, { paperSize: paper });
          const length = controls(page).length();
          if (await length.count()) {
            await chooseLength(page, "long");
          }
          const graphics = controls(page).graphics();
          await expect(graphics).toHaveCount(decorationApplicable ? 1 : 0);
          if (decorationApplicable) {
            await setPersonalization(page, { graphics: decoration });
          }
          await page.getByRole("button", { name: "Create worksheet" }).click();
          const preview = page.getByLabel("Worksheet preview");
          await expect(preview).toBeVisible();
          await expect(preview.locator("h2")).toContainText(boundaryNickname);
          await expect(preview.locator("[data-item-id]"))
            .toHaveCount(boundary.document.items.length);
          const sentence = boundary.document.items[0];
          if (sentence?.itemType === "sentence") {
            await expect(preview.locator("[data-sentence-prompt]"))
              .toHaveText(sentence.prompt);
            expect(await preview.locator("[data-bank-word]").allTextContents())
              .toEqual(sentence.wordBank ?? []);
          }
          expect(await page.locator("[id]").evaluateAll((elements) =>
            elements.map((element) => element.id)
              .filter((id, index, ids) => ids.indexOf(id) !== index),
          )).toEqual([]);
          await measurePrint(page, `${name}-worksheet`, paper, scale,
            boundary.document, "worksheet",
            decorationApplicable ? decoration ? "art" : "doodle" : "absent");
          if (decorationApplicable && decoration) {
            // The saved From interests Theme keeps the art a version 1 page
            // drew: the prompt's topic for Sentence Builder, the first reviewed
            // interest for Count, Compare & Make.
            const first = boundary.document.items[0];
            const artTopic = first?.itemType === "sentence"
              ? first.topicId
              : boundary.profile.interests.find((interest) =>
                (REVIEWED_TOPIC_IDS as readonly string[]).includes(interest)) ?? "neutral";
            const asset = (await productionLineArt())
              .selectDecorativeAsset(artTopic, boundary.document.seed);
            expect(asset, "the fixture's art topic selects a reviewed asset").toBeDefined();
            await expect(page.locator(".print-surface img[data-decorative-art]"))
              .toHaveAttribute("data-decorative-art", asset?.id ?? "");
          }
          if (fixture.id === "dry-math-regrouping-100") {
            // The boundary row, a subtraction from 100, is on the printed page;
            // the required-content and geometry checks above prove it present
            // and contained like every other row.
            const widest = boundary.document.items.find((item) =>
              item.itemType === "dry-math" && item.operation === "subtraction" &&
              item.leftOperand === 100);
            expect(widest, "a subtraction from 100").toBeDefined();
            await expect(page.locator(`.print-surface [data-item-id="${widest?.id ?? ""}"]`))
              .toHaveText(/^100 − \d+ = _+$/u);
          }
          if (fixture.id === "dry-math-facts-144") {
            // The widest facts, a three-digit dividend over a two-digit divisor
            // and a product of two two-digit factors, are on the printed page,
            // and the required-content and geometry checks above prove them
            // present and contained like every other row.
            const widestDivision = boundary.document.items.find((item) =>
              item.itemType === "dry-math" && item.operation === "division" &&
              item.leftOperand >= 100 && item.rightOperand >= 10);
            const widestProduct = boundary.document.items.find((item) =>
              item.itemType === "dry-math" && item.operation === "multiplication" &&
              item.leftOperand >= 10 && item.rightOperand >= 10);
            expect(widestDivision, "a three-digit dividend over a two-digit divisor").toBeDefined();
            expect(widestProduct, "a product of two two-digit factors").toBeDefined();
            await expect(page.locator(`.print-surface [data-item-id="${widestDivision?.id ?? ""}"]`))
              .toHaveText(/^\d{3} ÷ \d{2} = _+$/u);
            await expect(page.locator(`.print-surface [data-item-id="${widestProduct?.id ?? ""}"]`))
              .toHaveText(/^\d{2} × \d{2} = _+$/u);
            // Every times and division sign prints at least 2 mm wide; a
            // 1 px sign must fail that measurement, and it restores clean.
            expect(await operatorViolations(page), "operator signs").toEqual([]);
            await withPrintStyle(page, "[data-operator] { font-size: 1px !important; }", async () => {
              expect((await operatorViolations(page)).length, "a 1 px operator must fail")
                .toBeGreaterThan(0);
            });
            expect(await operatorViolations(page), "operator size restored").toEqual([]);
          }
          if (fixture.id === "bonds-missing-20") {
            // The widest sentence, two printed two-digit numbers beside its
            // drawn box, is on the printed page; the required-content and
            // geometry checks above prove it present and contained.
            const widest = boundary.document.items.find((item) =>
              item.itemType === "number-bond" &&
              [
                ...(item.missing === "left" ? [] : [item.leftOperand]),
                ...(item.missing === "right" ? [] : [item.rightOperand]),
                item.result,
              ].every((value) => value >= 10));
            expect(widest, "a sentence printing two two-digit numbers").toBeDefined();
            await expect(page.locator(`.print-surface [data-item-id="${widest?.id ?? ""}"]`))
              .toHaveText(/^\s*(?:\d{2}\s*[+−]\s*=\s*\d{2}|[+−]\s*\d{2}\s*=\s*\d{2})\s*$/u);
            // Every drawn box prints at its physical size, the same check
            // measurePrint ran above; a 1 px box must fail it, and it restores
            // clean.
            const boxes = (await readPhysicalGeometry(page)).filter(({ kind }) => kind === "missingBox");
            expect(boxes).toHaveLength(boundary.document.items.length);
            await withPrintStyle(page,
              ".print-surface [data-missing-box] { width: 1px !important; height: 1px !important; }",
              async () => {
                const collapsed = physicalViolations(await readPhysicalGeometry(page), scale);
                expect(collapsed.some((violation) => violation.startsWith("missingBox[0]: widthMm")),
                  "a 1 px box must fail its width").toBe(true);
                expect(collapsed.some((violation) => violation.startsWith("missingBox[0]: heightMm")),
                  "a 1 px box must fail its height").toBe(true);
              });
            expect(physicalViolations(await readPhysicalGeometry(page), scale), "missing box restored")
              .toEqual([]);
          }
          if (boundary.document.worksheetType === "clock-explorer") {
            // Every dial's outline and both hands are real ink under print
            // media, start at its centre, stay inside it, touch no label, and
            // read back through the independent oracle as their own hour.
            expect(await clockInkViolations(page, boundary.document), "clock ink").toEqual([]);
            const twelve = boundary.document.items.find((item) =>
              item.itemType === "clock-explorer" && item.hour === 12);
            expect(twelve, "the boundary seed draws 12:00").toBeDefined();
            const before = await readClockInk(page);
            // Hiding either hand, or the outline, or zeroing a hand's width
            // must fail the oracle while the dial box and its labels stay
            // intact; each restores clean.
            for (const target of [
              `[data-item-id="${twelve?.id ?? ""}"] [data-clock-hand="minute"]`,
              `[data-item-id="${twelve?.id ?? ""}"] [data-clock-hand="hour"]`,
              '[data-item-id="item-001"] [data-clock-outline]',
            ]) {
              for (const broken of ["stroke: none !important;", "stroke-width: 0 !important;"]) {
                await withPrintStyle(page, `@media print { .print-surface ${target} { ${broken} } }`, async () => {
                  expect((await clockInkViolations(page, boundary.document)).length,
                    `${target} ${broken} must fail`).toBeGreaterThan(0);
                  expect((await readClockInk(page)).map(({ dial }) => dial), "the dial boxes stay intact")
                    .toEqual(before.map(({ dial }) => dial));
                  expect((await readRequiredContent(page, requiredPrintContent(boundary.document, "worksheet")))
                    .violations, "labels and lines stay intact").toEqual([]);
                });
                expect(await clockInkViolations(page, boundary.document), `${target} restored`).toEqual([]);
              }
            }
            // A hand turned to the wrong hour keeps its ink and fails the
            // oracle's reading.
            await page.locator(`.print-surface [data-item-id="${twelve?.id ?? ""}"] [data-clock-hand="hour"]`)
              .evaluate((line) => {
                line.setAttribute("data-original-x2", line.getAttribute("x2") ?? "");
                line.setAttribute("x2", "66");
              });
            expect((await clockInkViolations(page, boundary.document)).some((violation) =>
              violation.includes("hands read")), "a turned hand must fail").toBe(true);
            await page.locator(`.print-surface [data-item-id="${twelve?.id ?? ""}"] [data-clock-hand="hour"]`)
              .evaluate((line) => {
                line.setAttribute("x2", line.getAttribute("data-original-x2") ?? "");
                line.removeAttribute("data-original-x2");
              });
            expect(await clockInkViolations(page, boundary.document), "clock ink restored").toEqual([]);
            // A collapsed dial fails its physical size, then restores clean.
            await withPrintStyle(page,
              ".print-surface [data-clock-dial] { width: 10mm !important; height: 10mm !important; }",
              async () => {
                expect(physicalViolations(await readPhysicalGeometry(page), scale).some((violation) =>
                  violation.startsWith("clockDial[0]: widthMm")), "a shrunken dial must fail").toBe(true);
              });
            expect(physicalViolations(await readPhysicalGeometry(page), scale), "dial restored").toEqual([]);
          }
          if (boundary.document.worksheetType === "tally-detective") {
            // Every mark is real ink under print media, stays inside its
            // strip, and the painted marks read back through the independent
            // oracle as their own bundles, loose marks and total.
            expect(await tallyInkViolations(page, boundary.document), "tally ink").toEqual([]);
            const twenty = boundary.document.items.find((item) =>
              item.itemType === "tally-detective" && item.bundles === 4 && item.remainder === 0);
            const nineteen = boundary.document.items.find((item) =>
              item.itemType === "tally-detective" && item.bundles === 3 && item.remainder === 4);
            expect(twenty, "the boundary seed draws 20").toBeDefined();
            expect(nineteen, "the boundary seed draws 19").toBeDefined();
            const before = await readTallyInk(page);
            // Hiding a crossing fifth or an upright, or zeroing its width, must
            // fail the oracle while every strip box and the lines stay intact;
            // each restores clean.
            for (const target of [
              `[data-item-id="${twenty?.id ?? ""}"] [data-tally-group="bundle"]:last-child [data-tally-stroke="crossing"]`,
              `[data-item-id="${nineteen?.id ?? ""}"] [data-tally-group="bundle"]:first-child [data-tally-stroke="crossing"]`,
              `[data-item-id="${nineteen?.id ?? ""}"] [data-tally-group="loose"] [data-tally-stroke="upright"]:last-child`,
            ]) {
              await expect(page.locator(`.print-surface ${target}`), target).toHaveCount(1);
              for (const broken of ["stroke: none !important;", "stroke-width: 0 !important;"]) {
                await withPrintStyle(page, `@media print { .print-surface ${target} { ${broken} } }`, async () => {
                  expect((await tallyInkViolations(page, boundary.document)).length,
                    `${target} ${broken} must fail`).toBeGreaterThan(0);
                  expect((await readTallyInk(page)).map(({ strip }) => strip), "the strip boxes stay intact")
                    .toEqual(before.map(({ strip }) => strip));
                  expect((await readRequiredContent(page, requiredPrintContent(boundary.document, "worksheet")))
                    .violations, "numbers and lines stay intact").toEqual([]);
                });
                expect(await tallyInkViolations(page, boundary.document), `${target} restored`).toEqual([]);
              }
            }
            // A crossing shortened to cross only three uprights keeps its ink
            // and fails the oracle's reading, then restores clean.
            const crossing = page.locator(
              `.print-surface [data-item-id="${twenty?.id ?? ""}"] [data-tally-stroke="crossing"]`).first();
            await crossing.evaluate((line) => {
              line.setAttribute("data-original-x2", line.getAttribute("x2") ?? "");
              line.setAttribute("x2", String(Number(line.getAttribute("x1")) + 26));
            });
            expect((await tallyInkViolations(page, boundary.document)).some((violation) =>
              violation.includes("marks read")), "a short crossing must fail").toBe(true);
            await crossing.evaluate((line) => {
              line.setAttribute("x2", line.getAttribute("data-original-x2") ?? "");
              line.removeAttribute("data-original-x2");
            });
            expect(await tallyInkViolations(page, boundary.document), "tally ink restored").toEqual([]);
            // A collapsed strip fails its physical size, then restores clean.
            await withPrintStyle(page,
              ".print-surface [data-tally-marks] { width: 10mm !important; height: 10mm !important; }",
              async () => {
                expect(physicalViolations(await readPhysicalGeometry(page), scale).some((violation) =>
                  violation.startsWith("tallyMarks[0]: widthMm")), "a shrunken strip must fail").toBe(true);
              });
            expect(physicalViolations(await readPhysicalGeometry(page), scale), "strip restored").toEqual([]);
          }
          if (boundary.document.worksheetType === "operation-grid") {
            // The whole table prints on this one page: every cell is the
            // handwriting size, measured above, and the grid is one uncut
            // group. A collapsed cell must fail that measurement, a table cut
            // short must fail the containment check, and both restore clean.
            const item = boundary.document.items[0];
            const cells = (await readPhysicalGeometry(page)).filter(({ kind }) => kind === "gridCell");
            expect(item?.itemType).toBe("operation-grid");
            if (item?.itemType === "operation-grid") {
              expect(cells).toHaveLength((item.rowHeaders.length + 1) * (item.columnHeaders.length + 1));
            }
            await withPrintStyle(page,
              ".print-surface [data-grid-cell] { width: 1px !important; min-width: 1px !important; " +
              "max-width: 1px !important; height: 1px !important; }",
              async () => {
                const collapsed = physicalViolations(await readPhysicalGeometry(page), scale);
                expect(collapsed.some((violation) => violation.startsWith("gridCell[0]: widthMm")),
                  "a collapsed cell must fail its width").toBe(true);
                expect(collapsed.some((violation) => /^gridCell\[\d+\]: heightMm/u.test(violation)),
                  "a collapsed cell must fail its height").toBe(true);
              });
            await withPrintStyle(page,
              ".print-surface [data-operation-grid] { height: 40mm !important; overflow: hidden !important; }",
              async () => {
                expect((await readPrintGeometry(page)).violations.some((violation) =>
                  violation.startsWith("outside group:") || violation.startsWith("clipping ancestor:")),
                "a table cut short must fail").toBe(true);
              });
            expect(physicalViolations(await readPhysicalGeometry(page), scale), "grid cells restored")
              .toEqual([]);
            expect((await readPrintGeometry(page)).violations, "grid restored").toEqual([]);
          }
          if (name === "dry-math-letter-standard-decoration-false") {
            await withPrintStyle(page, ".print-surface { page: auto !important; }", async () => {
              const fallback = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
              expect(fallback.getPage(0).getSize()).toEqual(paperMetrics.letter.page);
              const selected = await page.locator(".print-surface").evaluate((surface) =>
                surface.ownerDocument.defaultView?.getComputedStyle(surface).getPropertyValue("page"),
              );
              expect(() => expectSelectedPage(selected, paper)).toThrow("computed selected print page");
            });
            await withPrintStyle(page,
              ".print-surface [data-item-id]:first-child span " +
              "{ display: block; width: 1mm; overflow: hidden; }",
              async () => {
                expect((await readPrintGeometry(page)).violations.some(
                  (violation) => violation.startsWith("clipping ancestor:"),
                )).toBe(true);
              });
            await withPrintStyle(page, ".print-surface { width: 300mm !important; }",
              async () => {
                expect(fitsPaper((await readPrintGeometry(page)).bounds, paper)).toBe(false);
              });
            await withPrintStyle(page,
              "@media print { .print-surface header { display: none !important; } }",
              async () => {
                const broken = await readRequiredContent(page,
                  requiredPrintContent(boundary.document, "worksheet"));
                expect(broken.violations).toContain("required hidden: header h2");
                expect(broken.violations)
                  .toContain("required hidden: header p:not([data-doodle-note])");
              });
            await withPrintStyle(page,
              ".print-surface article > ol { position: relative; } " +
              ".print-surface [data-item-id] " +
              "{ position: absolute; top: 0; left: 0; width: 45%; }",
              async () => {
                const stacked = await readPrintGeometry(page);
                expect(stacked.groups.every((group) => group.fragments.length === 1)).toBe(true);
                expect(stacked.violations.some(
                  (violation) => violation.startsWith("overlapping groups:"),
                ), "stacked items fail even when each has one fragment").toBe(true);
              });
            await withPrintStyle(page,
              ".print-surface [data-item-id]:first-child { order: 1; }",
              async () => {
                const reordered = await readPrintGeometry(page);
                expect(reordered.violations.some(
                  (violation) => violation.startsWith("overlapping groups:"),
                )).toBe(false);
                expect(reordered.violations.some(
                  (violation) => violation.startsWith("group reading order:"),
                ), "reordered items fail without requiring overlap").toBe(true);
              });
            expect((await readPrintGeometry(page)).violations, "geometry restored").toEqual([]);
            expect((await readRequiredContent(page,
              requiredPrintContent(boundary.document, "worksheet"))).violations,
            "required content restored").toEqual([]);
          }
          // Two rows cover all shape families without repeating the matrix.
          if (name === "count-all-four-subtypes-letter-standard-decoration-false" ||
            name === "sentence-label-prompt-letter-standard-decoration-false") {
            const shapes = requiredPrintContent(boundary.document, "worksheet")
              .filter((entry) => entry.shape !== undefined && entry.count > 0);
            const selectors = [...new Set(shapes.map((entry) => entry.selector.replace(/\[data-item-id="[^"]+"\]/u, "[data-item-id]")))];
            for (const selector of selectors) {
              const shape = shapes.find((entry) => entry.selector.replace(/\[data-item-id="[^"]+"\]/u, "[data-item-id]") === selector)?.shape;
              for (const edge of shape === "closed" ? ["top", "right", "bottom", "left"] : ["bottom"]) {
                await withPrintStyle(page, `.print-surface ${selector} { border-${edge}-style: none !important; }`, async () => {
                  expect((await readRequiredContent(page, requiredPrintContent(boundary.document, "worksheet"))).violations
                    .some((violation) => violation.startsWith(`required ${edge} edge:`)), `${selector}: missing ${edge}`).toBe(true);
                });
              }
            }
            expect((await readRequiredContent(page,
              requiredPrintContent(boundary.document, "worksheet"))).violations).toEqual([]);
          }
          if (name === "count-all-four-subtypes-letter-standard-decoration-false") {
            await withPrintStyle(page, "[data-circle-target] { border-radius: 0 !important; }", async () => {
              expect(physicalViolations(await readPhysicalGeometry(page), scale))
                .toContain("circle[0]: circle must be round");
            });
          }
          if (name === "sentence-label-prompt-letter-standard-decoration-false") {
            for (const selector of ["[data-response-line]", "[data-drawing-box]"]) {
              await withPrintStyle(page,
                `.print-surface ${selector} { height: 1px !important; }`,
                async () => {
                  const collapsed = await readPhysicalGeometry(page);
                  expect(physicalViolations(collapsed, scale).some(
                    (violation) => violation.includes("heightMm"),
                  ), `${selector}: collapsed response must fail`).toBe(true);
                });
            }
            expect(physicalViolations(await readPhysicalGeometry(page), scale),
              "response geometry restored").toEqual([]);
          }
          if (name === "count-all-four-subtypes-letter-standard-decoration-true") {
            await withPrintStyle(page,
              "@media print { [data-decorative-art] { display: none !important; } }",
              async () => {
                await expect(readDecoration(page, "art"), "print-hidden art must fail")
                  .rejects.toThrow();
              });
            expect((await readDecoration(page, "art")).state, "print art restored").toBe("art");
          }
          if (name === "count-all-four-subtypes-letter-standard-decoration-false") {
            for (const selector of [physicalSelectors.guideCell, physicalSelectors.frameCell]) {
              await withPrintStyle(page,
                `.print-surface ${selector} { height: 1px !important; }`,
                async () => {
                  expect(physicalViolations(await readPhysicalGeometry(page), scale).some(
                    (violation) => violation.includes("heightMm"),
                  ), `${selector}: collapsed cells must fail`).toBe(true);
                });
            }
            await withPrintStyle(page,
              ".print-surface [data-worksheet-type] article > ol " +
              "{ height: 100mm !important; column-fill: auto; } " +
              ".print-surface [data-activity]:first-child " +
              "{ display: block !important; min-height: 150mm; break-inside: auto; }",
              async () => {
                const fragmented = await readPrintGeometry(page, true);
                expect(fragmented.groups[0]?.fragments.length,
                  "forced column split produces actual browser fragments").toBeGreaterThan(1);
                expect(fragmented.violations.some(
                  (violation) => violation.startsWith("split group:"),
                )).toBe(true);
              });
            expect(physicalViolations(await readPhysicalGeometry(page), scale),
              "cell geometry restored").toEqual([]);
            expect((await readPrintGeometry(page, true)).violations,
              "column flow restored").toEqual([]);
          }
          if (keyPdf) {
            await page.emulateMedia({ media: "screen" });
            await page.getByRole("button", { name: "Parent answer key" }).click();
            await measurePrint(page, `${name}-key`, paper, scale,
              boundary.document, "answer", "absent");
            if (name === "dry-math-letter-standard-decoration-false") {
              await withPrintStyle(page,
                "@media print { [data-answer-value] { display: none !important; } }",
                async () => {
                  const broken = await readRequiredContent(page,
                    requiredPrintContent(boundary.document, "answer"));
                  expect(broken.violations.some((violation) =>
                    violation.startsWith("required hidden:") &&
                    violation.endsWith("[data-answer-value]"),
                  )).toBe(true);
                });
              expect((await readRequiredContent(page,
                requiredPrintContent(boundary.document, "answer"))).violations,
              "answers restored").toEqual([]);
            }
          }
          if (name === "count-all-four-subtypes-letter-standard-decoration-false") {
            await page.emulateMedia({ media: "screen" });
            const randomDescriptor = await page.evaluateHandle(() =>
              Object.getOwnPropertyDescriptor(Crypto.prototype, "getRandomValues"),
            );
            try {
              await page.evaluate(() => {
                const original = Crypto.prototype.getRandomValues;
                Object.defineProperty(Crypto.prototype, "getRandomValues", {
                  value(array: Parameters<typeof original>[0]) {
                    if (array instanceof Uint32Array) {
                      array[0] = 1;
                      return array;
                    }
                    return original.call(globalThis.crypto, array);
                  },
                });
              });
              await page.getByRole("button", { name: "Create worksheet" }).click();
              await page.emulateMedia({ media: "print" });
              await expect(expectCountBoundary(page, boundary.document)).rejects.toThrow();
            } finally {
              await page.evaluate((descriptor) => {
                if (descriptor === undefined) {
                  throw new Error("Missing original random-source descriptor.");
                }
                Object.defineProperty(Crypto.prototype, "getRandomValues", descriptor);
              }, randomDescriptor);
              await randomDescriptor.dispose();
            }
            await page.emulateMedia({ media: "screen" });
            await page.getByRole("button", { name: "Create worksheet" }).click();
            await page.emulateMedia({ media: "print" });
            await expectCountBoundary(page, boundary.document);
          }
        });
      }
    }
  }
}

test("delayed startup CSS is ready for the earliest print click on either paper", async ({
  appServer,
  page,
}) => {
  for (const paper of ["letter", "a4"] as const) {
    await appServer.seedConfig({
      ...acceptanceConfig,
      defaults: { ...acceptanceConfig.defaults, paperSize: paper },
    });
    let releaseCss: () => void = () => {};
    let cssGate = new Promise<void>((resolve) => {
      releaseCss = resolve;
    });
    let cssRequested = false;
    await page.route("**/assets/*.css", async (route) => {
      cssRequested = true;
      await cssGate;
      await route.continue();
    });
    try {
      await page.goto(appServer.origin, { waitUntil: "commit" });
      await expect.poll(() => cssRequested).toBe(true);
      // The real stylesheet response is held until this assertion completes;
      // there is no timing sleep or fast-loopback assumption in this boundary.
      await expect(page.getByRole("button", { name: "Create worksheet" })).toHaveCount(0);
    } finally {
      releaseCss();
    }
    const profile = acceptanceConfig.profiles[2];
    if (profile === undefined) {
      throw new Error("Missing canonical profile.");
    }
    await chooseChild(page, profile.id);
    await chooseWorksheet(page, "dry-math");
    // Hold any CSS requested by preview mounting as well. Moving the paper
    // rules back to dynamic links must fail even on an otherwise warm page.
    cssGate = new Promise<void>((resolve) => {
      releaseCss = resolve;
    });
    await page.emulateMedia({ media: "print" });
    await page.locator("html").evaluate((html) => {
      const document = html.ownerDocument;
      const view = document.defaultView;
      if (view === null) {
        throw new Error("Missing browser window.");
      }
      const browser = globalThis as unknown as {
        __immediatePrint?: { rules: string[]; width: string; height: string; selectedPage: string };
      };
      view.print = () => {
        const surface = document.querySelector(".print-surface");
        if (surface === null) {
          throw new Error("Print called without a surface.");
        }
        const style = view.getComputedStyle(surface);
        browser.__immediatePrint = {
          selectedPage: style.getPropertyValue("page"),
          rules: [...document.styleSheets]
            .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
            .filter((rule) => rule.startsWith("@page")),
          width: style.getPropertyValue("--print-width").trim(),
          height: style.getPropertyValue("--print-height").trim(),
        };
      };
      const observer = new view.MutationObserver(() => {
        const button = [...document.querySelectorAll("button")].find(
          (candidate) => candidate.textContent === "Print current page" && !candidate.disabled,
        );
        if (button !== undefined) {
          observer.disconnect();
          button.click();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    try {
      await page.getByRole("button", { name: "Create worksheet", includeHidden: true })
        .evaluate((button) => button.click());
      const invocation = await page.evaluate(() => (
        globalThis as unknown as {
          __immediatePrint?: { rules: string[]; width: string; height: string; selectedPage: string };
        }
      ).__immediatePrint);
      expect(invocation).toBeDefined();
      expectSelectedPage(invocation?.selectedPage, paper);
      expect(invocation?.rules.find((rule) => rule.startsWith(`@page extra-credit-${paper}`)))
        .toContain(`margin: ${paperMetrics[paper].margin};`);
      expect(invocation?.width).toBe(paper === "letter" ? "7.7in" : "190mm");
      expect(invocation?.height).toBe(paper === "letter" ? "10.2in" : "277mm");
    } finally {
      releaseCss();
      await page.unrouteAll({ behavior: "wait" });
      await page.emulateMedia({ media: "screen" });
    }
  }
});

test("manual print uses the compiled app with canonical temporary profiles and cleans up", async ({
  request,
}) => {
  // The worksheet-choice matrix built from the committed example expands to
  // 99 distinct worksheet cases, 31 of which also measure a key PDF.
  expect(new Set(matrixCases.map(({ name }) => name)).size).toBe(matrixCases.length);
  expect(matrixCases).toHaveLength(99);
  expect(matrixCases.filter(({ keyPdf }) => keyPdf)).toHaveLength(31);
  const moduleUrl = new URL("../manual/print-harness.mjs", import.meta.url);
  const { startManualPrintHarness } = await import(moduleUrl.href);
  const harness = await startManualPrintHarness() as {
    origin: string;
    temporaryDirectory: string;
    close(): Promise<void>;
  };
  try {
    expect(harness.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
    const session = await request.get(`${harness.origin}/api/session`);
    const { token } = await session.json() as { token: string };
    const config = await request.get(`${harness.origin}/api/config`, {
      headers: { "X-Extra-Credit-Token": token },
    });
    // The harness writes the committed example's own identity-only version 2
    // bytes, so the app reads them as the current version.
    expect(await config.json()).toEqual({ config: acceptanceConfig, storedSchemaVersion: 2 });
    expect((await request.get(`${harness.origin}/api/health`, {
      headers: { Host: "127.0.0.1:1" },
    })).status()).toBe(403);
    expect((await request.get(harness.origin)).status()).toBe(200);
  } finally {
    await harness.close();
  }
  await expect(access(harness.temporaryDirectory)).rejects.toThrow();
  await expect(request.get(`${harness.origin}/api/health`, { timeout: 1000 }))
    .rejects.toThrow();

  const child = spawn(process.execPath, [fileURLToPath(moduleUrl)], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  let output = "";
  const stopped = new Promise<number | null>((resolveStop, reject) => {
    child.once("error", reject);
    child.once("exit", resolveStop);
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  try {
    await expect.poll(() => output)
      .toMatch(/fictional print harness: http:\/\/127\.0\.0\.1:\d+/u);
    const origin = /http:\/\/127\.0\.0\.1:\d+/u.exec(output)?.[0];
    expect(origin).toBeDefined();
    child.disconnect();
    expect(await stopped).toBe(0);
    expect(output).toContain("temporary profiles removed");
    await expect(request.get(`${origin}/api/health`, { timeout: 1000 }))
      .rejects.toThrow();
  } finally {
    if (child.exitCode === null) {
      child.kill();
    }
  }
});

for (const stage of ["imports", "allocated", "listen", "before-entry"] as const) {
  const stops = stage === "before-entry" ? ["disconnect"] : ["disconnect", "SIGINT", "SIGTERM"];
  if (stage === "allocated") stops.push("startup-cleanup-failure", "cleanup-failure");
  for (const stop of stops) {
    test(`manual print remembers ${stop} at ${stage}`, async ({ request }) => {
      const failure = stop.endsWith("failure") ? stop : undefined;
      const childEnvironment: NodeJS.ProcessEnv = {
        ...process.env, EXTRA_CREDIT_LIFECYCLE_STAGE: stage,
        EXTRA_CREDIT_LIFECYCLE_FAILURE: failure,
      };
      delete childEnvironment.FORCE_COLOR;
      const child = spawn(process.execPath, [
        "--import", new URL("../manual/lifecycle-loader.mjs", import.meta.url).href,
        fileURLToPath(new URL("../manual/print-harness.mjs", import.meta.url)),
      ], {
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        windowsHide: true,
      });
      let output = "";
      let errors = "";
      let barrier: { stage: string; directory: string | null } | undefined;
      const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr?.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
      child.on("message", (message: typeof barrier) => { barrier = message; });
      try {
        await expect.poll(() => barrier?.stage).toBe(stage);
        if (stop === "disconnect" || failure !== undefined) {
          child.disconnect();
        } else {
          // Windows kill() forcibly terminates Node. Dispatch the signal event
          // in the real CLI to exercise its handlers and cleanup deterministically.
          child.send({ stop });
        }
        await expect.poll(() => child.exitCode, { timeout: 10_000 }).toBe(failure === undefined ? 0 : 1);
        await exited;
        const category = failure === "startup-cleanup-failure" ? "TEMPORARY_STORAGE" : "CLEANUP";
        expect(errors.trim()).toBe(failure === undefined ? "" : `EXTRA_CREDIT_MANUAL_PRINT_ERROR: ${category}`);
        if (failure === undefined) expect(output).toContain("temporary profiles removed");
        expect(output).not.toContain("fictional print harness: http");
        const directory = /OWNED_DIRECTORY:([^\r\n]+)/u.exec(output)?.[1];
        expect(directory).toBeDefined();
        if (failure !== "startup-cleanup-failure") {
          await expect(access(directory!)).rejects.toThrow();
        }
        const origin = /OWNED_ORIGIN:(http:\/\/127\.0\.0\.1:\d+)/u.exec(output)?.[1];
        if (failure !== "startup-cleanup-failure") {
          expect(origin).toBeDefined();
          await expect(request.get(`${origin}/api/health`, { timeout: 1000 })).rejects.toThrow();
        }
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await exited;
        }
        const directory = /OWNED_DIRECTORY:([^\r\n]+)/u.exec(output)?.[1];
        if (directory !== undefined) {
          await rm(directory, { recursive: true, force: true });
        }
      }
    });
  }
}
