import type { Locator, Page } from "@playwright/test";

import type { RequiredPrintContent } from "../../fixtures/print/required-content.ts";

/*
 * The print readers `print.spec.ts` and `packet-print.spec.ts` share: the
 * required-content reader, the containment reader and the seed stub, moved
 * from `print.spec.ts` with their bodies unchanged. Each reader measures the
 * page's one `.print-surface`, or the one packet surface a locator names.
 */

/** The page's one `.print-surface`, or the surface the locator already names. */
function surfaceOf(target: Page | Locator): Locator {
  return "goto" in target ? target.locator(".print-surface") : target;
}

/**
 * Fixes every worksheet seed the app draws: the first word of each
 * `Uint32Array` it fills is the page's `data-print-seed` value, 5 until a test
 * sets one with `setPrintSeed`. Every other random buffer is the browser's own.
 */
export async function installPrintSeedStub(page: Page): Promise<void> {
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
}

/** The seed the stub gives the next worksheet the page creates. */
export async function setPrintSeed(page: Page, seed: number): Promise<void> {
  await page.locator("html").evaluate((html, value) => {
    html.setAttribute("data-print-seed", String(value));
  }, seed);
}

export async function readRequiredContent(
  target: Page | Locator,
  required: readonly RequiredPrintContent[],
) {
  return await surfaceOf(target).evaluate((surface, manifest) => {
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

export async function readPrintGeometry(target: Page | Locator, columnFlow = false) {
  return await surfaceOf(target).evaluate((surface, columns) => {
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
