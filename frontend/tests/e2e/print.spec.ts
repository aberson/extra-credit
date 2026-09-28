import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import type { WorksheetDocumentV1 } from "../../src/shared/worksheet/types.ts";
import { countOrderBound, countSeedFixture, type CountActivity } from "../fixtures/print/count-layout.ts";
import {
  acceptanceConfig,
  boundaryNickname,
  createPrintFixture,
  printFixtures,
} from "../fixtures/print/matrix.ts";
import {
  requiredPrintContent,
  type RequiredPrintContent,
} from "../fixtures/print/required-content.ts";
import { expect, test } from "./fixtures/app-server.ts";

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

function expectSelectedPage(selectedPage: string | undefined, paper: keyof typeof paperMetrics) {
  expect(selectedPage, "computed selected print page").toBe(`extra-credit-${paper}`);
}

// Millimetres, independent of the stylesheet: collapsing work space must fail
// even when the resulting sheet fits the paper more easily.
const responseMetrics = {
  standard: { lineHeight: 7, drawingHeight: 33, tellingHeight: 100, cellSize: 5 },
  large: { lineHeight: 9, drawingHeight: 38, tellingHeight: 110, cellSize: 6 },
} as const;

const physicalSelectors = {
  line: "[data-response-line]",
  drawing: "[data-drawing-box]",
  guideCell: "[data-instructional-guide-cell]",
  frameCell: '[data-instructional-visual="ten-frame"] [data-instructional-mark]',
  circle: "[data-circle-target]",
  decoration: "[data-decorative-panel]",
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
      if (["line", "drawing", "guideCell", "frameCell"].includes(box.kind)) {
        expect(box.heightMm, `${box.kind}: large increases response height`)
          .toBeGreaterThan(smaller.heightMm + 0.5);
        if (["guideCell", "frameCell"].includes(box.kind)) {
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

async function readRequiredContent(page: Page, required: readonly RequiredPrintContent[]) {
  return await page.locator(".print-surface").evaluate((surface, manifest) => {
    const document = surface.ownerDocument;
    const view = document.defaultView;
    if (view === null) {
      throw new Error("Missing browser window.");
    }
    const violations: string[] = [];
    const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
    type BrowserElement = Parameters<typeof view.getComputedStyle>[0];
    const visible = (element: BrowserElement) => {
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || element.getClientRects().length === 0) {
        return false;
      }
      for (let node: BrowserElement | null = element; node !== null; node = node.parentElement) {
        const style = view.getComputedStyle(node);
        if (style.visibility !== "visible" || style.display === "none" ||
          Number(style.opacity) === 0) {
          return false;
        }
      }
      return true;
    };
    for (const entry of manifest) {
      const nodes = [...surface.querySelectorAll(entry.selector)];
      if (nodes.length !== entry.count) {
        violations.push(`required count: ${entry.selector}: ${nodes.length} != ${entry.count}`);
      }
      for (const [index, node] of nodes.entries()) {
        if (!visible(node)) {
          violations.push(`required hidden: ${entry.selector}`);
        }
        if (entry.texts !== undefined &&
          normalize(node.textContent ?? "") !== normalize(entry.texts[index] ?? "")) {
          violations.push(`required text: ${entry.selector}`);
        }
        // A visible parent can contain hidden prompt fragments or marks.
        for (const child of [node, ...node.querySelectorAll("*")]) {
          for (const text of child.childNodes) {
            if (text.nodeType !== 3 || normalize(text.textContent ?? "") === "") {
              continue;
            }
            const range = document.createRange();
            range.selectNodeContents(text);
            if (!visible(child) || ![...range.getClientRects()].some(
              (box) => box.width > 0 && box.height > 0,
            )) {
              violations.push(`required text hidden: ${entry.selector}`);
            }
          }
        }
        if (entry.shape !== undefined) {
          const style = view.getComputedStyle(node);
          const edges = entry.shape === "closed" ? ["top", "right", "bottom", "left"] : ["bottom"];
          for (const edge of edges) {
            const color = style.getPropertyValue(`border-${edge}-color`);
            if (["none", "hidden"].includes(style.getPropertyValue(`border-${edge}-style`)) ||
              !(Number.parseFloat(style.getPropertyValue(`border-${edge}-width`)) > 0) ||
              color === "transparent" || /^(?:rgba\([^)]*,|[^)]*\/)\s*0(?:\.0+)?\s*\)$/u.test(color)) {
              violations.push(`required ${edge} edge: ${entry.selector}`);
            }
          }
        }
      }
    }
    return { required: manifest, violations };
  }, required);
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

async function readPrintGeometry(page: Page, columnFlow = false) {
  return await page.locator(".print-surface").evaluate((surface, columns) => {
    const bounds = surface.getBoundingClientRect();
    const document = surface.ownerDocument;
    const view = document.defaultView;
    if (view === null) {
      throw new Error("Missing browser window.");
    }
    const getComputedStyle = view.getComputedStyle.bind(view);
    const style = getComputedStyle(surface);
    const probe = document.createElement("div");
    probe.style.height = style.getPropertyValue("--print-height");
    surface.append(probe);
    const printableHeight = probe.getBoundingClientRect().height;
    probe.remove();
    const violations: string[] = [];
    const visible = (element: Parameters<typeof getComputedStyle>[0]) =>
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    type Box = { left: number; right: number; top: number; bottom: number };
    const inside = (box: Box, outer: Box) =>
      box.left >= outer.left - 1 && box.right <= outer.right + 1 &&
      box.top >= outer.top - 1 && box.bottom <= outer.bottom + 1;
    const pageBox = {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.top + printableHeight,
    };
    for (const element of surface.querySelectorAll("*")) {
      if (!visible(element)) {
        continue;
      }
      const label = `${element.tagName}.${
        element.getAttribute("data-item-id") ?? element.getAttribute("data-activity") ??
        element.textContent?.slice(0, 35)
      }`;
      const box = element.getBoundingClientRect();
      if (!inside(box, pageBox)) {
        violations.push(`outside page: ${label}`);
      }
      const group = element.closest("[data-item-id]");
      if (group !== null && !inside(box, group.getBoundingClientRect())) {
        violations.push(`outside group: ${label}`);
      }
      for (const child of element.childNodes) {
        if (child.nodeType !== 3 || child.textContent?.trim() === "") {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(child);
        for (const textBox of range.getClientRects()) {
          if (!inside(textBox, pageBox)) {
            violations.push(`clipped text: ${label}`);
          }
          if (group !== null && !inside(textBox, group.getBoundingClientRect())) {
            violations.push(`text outside group: ${label}`);
          }
          for (
            let ancestor: typeof element | null = element;
            ancestor !== null && surface.contains(ancestor);
            ancestor = ancestor.parentElement
          ) {
            const ancestorStyle = getComputedStyle(ancestor);
            const clips = [ancestorStyle.overflowX, ancestorStyle.overflowY].some(
              (overflow) => ["hidden", "clip", "auto", "scroll"].includes(overflow),
            );
            if (clips && !inside(textBox, ancestor.getBoundingClientRect())) {
              violations.push(`clipping ancestor: ${label}`);
            }
          }
        }
        if (!element.closest(
          "[data-decorative-panel], [data-quantity-mark], [data-instructional-mark]",
        )) {
          const size = Number.parseFloat(getComputedStyle(element).fontSize);
          if (size + 0.01 < Number.parseFloat(style.fontSize)) {
            violations.push(`small instructional text: ${label}`);
          }
        }
      }
    }
    const groups = [...surface.querySelectorAll("[data-item-id]")].map((element) => ({
      id: element.getAttribute("data-item-id"),
      rect: element.getBoundingClientRect().toJSON() as Record<string, number>,
      fragments: [...element.getClientRects()].map((rect) => ({
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height,
      })),
      breakInside: getComputedStyle(element).breakInside,
    }));
    for (const [index, group] of groups.entries()) {
      if (group.fragments.length !== 1) {
        violations.push(`split group: ${group.id}: ${group.fragments.length} fragments`);
      }
      const box = group.fragments[0];
      if (box === undefined || box.width <= 0 || box.height <= 0) {
        violations.push(`empty group: ${group.id}`);
        continue;
      }
      for (const later of groups.slice(index + 1)) {
        for (const first of group.fragments) {
          for (const second of later.fragments) {
            if (Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
              Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1) {
              violations.push(`overlapping groups: ${group.id}, ${later.id}`);
            }
          }
        }
        const next = later.fragments[0];
        if (next === undefined) {
          continue;
        }
        // Count/Compare flows down each column, then right. Grids (including
        // every key) flow across each row, then down. Check DOM reading order
        // against physical positions, not the declared CSS order/break hints.
        const ordered = columns
          ? Math.abs(box.left - next.left) <= 1
            ? box.bottom <= next.top + 1
            : box.right <= next.left + 1
          : Math.abs(box.top - next.top) <= 1
            ? box.right <= next.left + 1
            : box.bottom <= next.top + 1;
        if (!ordered) {
          violations.push(`group reading order: ${group.id}, ${later.id}`);
        }
      }
    }
    const visuals = [...surface.querySelectorAll(
      "[role=img], [data-instructional-guide-cells], [data-response-line], [data-drawing-box]",
    )].map((element) => ({
      visible: visible(element),
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
    return {
      bounds: bounds.toJSON() as Record<string, number>,
      printableHeight,
      fontSize: style.fontSize,
      violations,
      groups,
      visuals,
      groupFlow: columns ? "columns" : "rows",
    };
  }, columnFlow);
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
        defaults: fixture.preferences,
      });
      await page.addInitScript(() => {
        const scope = globalThis as unknown as {
          crypto: { getRandomValues: (array: ArrayBufferView) => ArrayBufferView };
          document: { documentElement: { dataset: { printSeed?: string } } };
        };
        const original = scope.crypto.getRandomValues.bind(scope.crypto);
        Object.defineProperty(Crypto.prototype, "getRandomValues", {
          configurable: true,
          value(array: ArrayBufferView | null) {
            if (array instanceof Uint32Array) {
              array[0] = Number(scope.document.documentElement.dataset.printSeed ?? "5");
              return array;
            }
            if (array === null) throw new TypeError("A random buffer is required.");
            return original(array);
          },
        });
      });
      await page.goto(appServer.origin);
      await page.getByRole("combobox", { name: "Child profile" }).selectOption(fixture.profile.id);
      await page.getByRole("combobox", { name: "Worksheet type" }).selectOption("count-compare-make");
      await page.emulateMedia({ media: "print" });
      const bound = countOrderBound(paper, scale);
      expect(bound.permutations).toBe(scale === "standard" ? 25_200 : 2_520);
      const headerBound = scale === "standard" ? 134 : 174;
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

for (const fixture of printFixtures) {
  const decorationApplicable = ["sentence-builder", "count-compare-make"]
    .includes(fixture.worksheetType);
  for (const scale of ["standard", "large"] as const) {
    const boundary = createPrintFixture(fixture, scale);
    for (const paper of ["letter", "a4"] as const) {
      for (const decoration of decorationApplicable ? [false, true] : [false]) {
        const name = `${fixture.id}-${paper}-${scale}-decoration-${decoration}`;
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
          await page.getByRole("button", { name: `Edit ${original.displayName}` }).click();
          await page.getByRole("textbox", { name: "Nickname (optional)" }).fill(boundaryNickname);
          if (fixture.writingMode !== undefined) {
            await page.getByRole("combobox", { name: "Writing mode" })
              .selectOption(fixture.writingMode);
            await page.getByRole("textbox", { name: /Broad interests/ })
              .fill(boundary.profile.interests.join(", "));
          }
          await page.getByRole("button", { name: "Save profile" }).click();
          await page.getByRole("combobox", { name: "Child profile" }).selectOption(original.id);
          await page.getByRole("combobox", { name: "Worksheet type" })
            .selectOption(fixture.worksheetType);
          await page.getByText("More options", { exact: true }).click();
          await page.getByRole("combobox", { name: "Print scale" }).selectOption(scale);
          await page.getByRole("combobox", { name: "Paper size" }).selectOption(paper);
          const length = page.getByRole("combobox", { name: "Length", exact: true });
          if (await length.count()) {
            await length.selectOption("long");
          }
          const graphics = page.getByLabel("Include decorative graphics");
          await expect(graphics).toHaveCount(decorationApplicable ? 1 : 0);
          if (decorationApplicable) {
            await graphics.setChecked(decoration);
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
          if (!decoration && boundary.document.request.options.includeAnswerKey) {
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
    await page.getByRole("combobox", { name: "Child profile" }).selectOption(profile.id);
    await page.getByRole("combobox", { name: "Worksheet type" }).selectOption("dry-math");
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
    expect(await config.json()).toEqual({ config: acceptanceConfig });
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
