import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page, Response } from "@playwright/test";

import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../src/shared/config/schema.ts";
import { expect, test } from "./fixtures/app-server.ts";

/*
 * Step 7 owns two claims that only a real environment can settle.
 *
 * 1. Geometry. Step 6 proved the decorative toggle changed no COUNT and no
 *    declared height, but it compared zero decorations against zero, and it
 *    never compared POSITIONS. Now that the reserved panel really draws art,
 *    this file measures laid-out bounding boxes in the compiled browser for
 *    graphics-on, graphics-off, and an unavailable-art fallback, and requires
 *    every instructional box - prompt, word bank, each bank word, each
 *    response line, the drawing box, and the response panel itself - to keep
 *    the same position AND the same size in all three states.
 *
 * 2. The release contract. `ASSET_PROVENANCE.md`, `CONTRIBUTING.md`, and the
 *    single root `LICENSE` live above `frontend/`, so the repository-root
 *    contract is checked here, from Node, with `readFileSync`. These are the
 *    same contracts Step 13's release audit re-checks over an exported source
 *    tree (plan.md:739), which also re-runs this suite in its clean room. That
 *    includes being the ledger/manifest drift gate the ledger names.
 */

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const LINE_ART_DIRECTORY = "frontend/src/web/assets/line-art/";
const BUILT_ASSET_DIRECTORY = "frontend/dist/web/assets";

function repositoryText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, "utf8");
}

/**
 * Every committed `.svg` under a directory, at ANY depth.
 *
 * plan.md:740 gives Step 13's release audit a `**\/*.svg` walk of the line-art
 * directory. This step's unmanifested-file guard has to be at least that wide
 * or a nested asset would ship unseen until release, so the scan recurses and
 * a fixture test below proves it really does.
 */
function committedSvgPaths(directory: string): readonly string[] {
  return readdirSync(directory, { recursive: true })
    .map((entry) => String(entry).replaceAll("\\", "/"))
    .filter((name) => name.endsWith(".svg"))
    .sort();
}

const defaults: GenerationDefaultsV1 = {
  useDisplayName: false,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

const profile: ChildProfileV1 = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "Distinctive Private Blake",
  ageYears: 5,
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
  interests: ["Space"],
};

interface BoxV1 {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/**
 * Minimal structural DOM shapes. The browser type library is deliberately out
 * of scope for this Node-side project, so in-page callbacks name only what
 * they actually use.
 */
interface MeasurableV1 {
  getBoundingClientRect(): {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
  };
}

interface LoadableImageV1 {
  readonly complete: boolean;
  readonly naturalWidth: number;
}

interface StyledV1 {
  readonly visibility: string;
}

interface DecoratedSheetV1 {
  readonly artAlt: string | null;
  readonly artIds: readonly string[];
  readonly artLoaded: readonly boolean[];
  readonly bankWordBoxes: readonly BoxV1[];
  readonly bankWords: readonly string[];
  readonly decorationState: string | null;
  readonly decorativePanelBox: BoxV1 | null;
  readonly decorativePanelsInsideResponse: number;
  readonly doodleBoxes: number;
  readonly drawingBoxBox: BoxV1 | null;
  readonly items: number;
  readonly prompt: string | null;
  readonly promptBox: BoxV1 | null;
  readonly requiredResponse: string | null;
  readonly responseLineBoxes: readonly BoxV1[];
  readonly responsePanelBox: BoxV1 | null;
  readonly wordBankBox: BoxV1 | null;
}

/**
 * Everything the child must do, measured relative to the preview root so a
 * different scroll offset can never masquerade as stable geometry.
 */
async function readDecoratedSheet(preview: Locator): Promise<DecoratedSheetV1> {
  return await preview.evaluate((node) => {
    const origin = node.getBoundingClientRect();
    const boxOf = (element: MeasurableV1 | null | undefined): BoxV1 | null => {
      if (element === null || element === undefined) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      const round = (value: number): number => Number(value.toFixed(2));
      return {
        height: round(rect.height),
        left: round(rect.left - origin.left),
        top: round(rect.top - origin.top),
        width: round(rect.width),
      };
    };
    const boxesOf = (selector: string): BoxV1[] =>
      [...node.querySelectorAll(selector)].flatMap((element) => {
        const box = boxOf(element);
        return box === null ? [] : [box];
      });
    const images = [...node.querySelectorAll("img[data-decorative-art]")];
    const item = node.querySelector("[data-sentence-item]");

    return {
      artAlt: images[0]?.getAttribute("alt") ?? null,
      artIds: images.map(
        (image) => image.getAttribute("data-decorative-art") ?? "",
      ),
      artLoaded: images.map(
        (image: LoadableImageV1) => image.naturalWidth > 0,
      ),
      bankWordBoxes: boxesOf("[data-bank-word]"),
      bankWords: [...node.querySelectorAll("[data-bank-word]")].map(
        (word) => word.textContent?.trim() ?? "",
      ),
      decorationState:
        node
          .querySelector("[data-decorative-panel]")
          ?.getAttribute("data-decoration") ?? null,
      decorativePanelBox: boxOf(node.querySelector("[data-decorative-panel]")),
      decorativePanelsInsideResponse: node.querySelectorAll(
        "[data-response-panel] [data-decorative-panel]",
      ).length,
      doodleBoxes: node.querySelectorAll("[data-doodle-box]").length,
      drawingBoxBox: boxOf(node.querySelector("[data-drawing-box]")),
      items: node.querySelectorAll("[data-sentence-item]").length,
      prompt:
        node
          .querySelector("[data-sentence-prompt]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim() ?? null,
      promptBox: boxOf(node.querySelector("[data-sentence-prompt]")),
      requiredResponse: item?.getAttribute("data-required-response") ?? null,
      responseLineBoxes: boxesOf("[data-response-line]"),
      responsePanelBox: boxOf(node.querySelector("[data-response-panel]")),
      wordBankBox: boxOf(node.querySelector("[data-word-bank]")),
    };
  });
}

/** Exactly the surface that may not move when decoration changes. */
function instructionalSurfaceOf(sheet: DecoratedSheetV1) {
  return {
    bankWordBoxes: sheet.bankWordBoxes,
    bankWords: sheet.bankWords,
    drawingBoxBox: sheet.drawingBoxBox,
    items: sheet.items,
    prompt: sheet.prompt,
    promptBox: sheet.promptBox,
    requiredResponse: sheet.requiredResponse,
    responseLineBoxes: sheet.responseLineBoxes,
    responsePanelBox: sheet.responsePanelBox,
    wordBankBox: sheet.wordBankBox,
  };
}

/**
 * How far the reserved panel sticks out of the flex line that holds it, and
 * how wide that line actually is. Both are read from laid-out rectangles, so
 * the answer is the browser's, not a restatement of the declared style.
 */
interface PanelFitV1 {
  readonly headerWidth: number;
  readonly overhang: number;
  readonly panelHeight: number;
  readonly panelWidth: number;
}

async function readPanelFit(preview: Locator): Promise<PanelFitV1> {
  return await preview.evaluate((node) => {
    const panel = node.querySelector("[data-decorative-panel]");
    const header = node.querySelector("header");
    if (panel === null || header === null) {
      throw new Error("The reserved panel or its header slot was missing.");
    }
    const panelRect = (panel as unknown as MeasurableV1).getBoundingClientRect();
    const headerRect = (
      header as unknown as MeasurableV1
    ).getBoundingClientRect();
    return {
      headerWidth: Number(headerRect.width.toFixed(2)),
      overhang: Number((panelRect.right - headerRect.right).toFixed(2)),
      panelHeight: Number(panelRect.height.toFixed(2)),
      panelWidth: Number(panelRect.width.toFixed(2)),
    };
  });
}

/**
 * How far the doodle caption sticks out of the box that clips it.
 *
 * `overflow: hidden` cuts silently, so a caption that no longer fits looks
 * like a slightly odd drawing rather than a failure. These are the four
 * distances from the caption's laid-out rectangle to the box's padding edges,
 * read from the browser: any positive value is a glyph that has been cut off.
 */
interface CaptionFitV1 {
  readonly boxHeight: number;
  readonly boxWidth: number;
  readonly captionFontSize: string;
  readonly captionHeight: number;
  readonly captionWidth: number;
  readonly overflow: readonly number[];
}

async function readCaptionFit(preview: Locator): Promise<CaptionFitV1> {
  return await preview.evaluate((node) => {
    const view = globalThis as unknown as {
      getComputedStyle(element: unknown): Record<string, string>;
    };
    const box = node.querySelector("[data-doodle-box]");
    const caption = node.querySelector("[data-doodle-note]");
    if (box === null || caption === null) {
      throw new Error("The doodle box or its caption was missing.");
    }
    const boxRect = (box as unknown as MeasurableV1).getBoundingClientRect();
    const captionRect = (
      caption as unknown as MeasurableV1
    ).getBoundingClientRect();
    const style = view.getComputedStyle(box);
    const edge = (...names: readonly string[]): number =>
      names.reduce(
        (total, name) => total + Number.parseFloat(style[name] ?? "0"),
        0,
      );
    const round = (value: number): number => Number(value.toFixed(2));
    return {
      boxHeight: round(boxRect.height),
      boxWidth: round(boxRect.width),
      captionFontSize: view.getComputedStyle(caption).fontSize ?? "",
      captionHeight: round(captionRect.height),
      captionWidth: round(captionRect.width),
      overflow: [
        round(
          boxRect.left +
            edge("borderLeftWidth", "paddingLeft") -
            captionRect.left,
        ),
        round(
          captionRect.right -
            (boxRect.right - edge("borderRightWidth", "paddingRight")),
        ),
        round(
          boxRect.top + edge("borderTopWidth", "paddingTop") - captionRect.top,
        ),
        round(
          captionRect.bottom -
            (boxRect.bottom - edge("borderBottomWidth", "paddingBottom")),
        ),
      ],
    };
  });
}

/**
 * Every distinct colour actually painted inside an element.
 *
 * The element is screenshotted and the PNG decoded back inside the page, so
 * the answer is what Chromium really put on the glass - the only way to prove
 * a browser placeholder glyph is not being drawn. The decode round-trips
 * through a `data:` URL, which the production policy permits: see the
 * `img-src` assertion below.
 *
 * A metric that has only ever returned 1 has not been shown to measure
 * anything, so every use of this helper is paired with a known-garbage anchor
 * ({@link addBrokenImageAnchor}) that must return more than 1.
 */
async function paintedColorsOf(
  page: Page,
  target: Locator,
): Promise<readonly string[]> {
  // Inset a few pixels so a border on a neighbouring element that lands on
  // the shared edge is not mistaken for something the panel painted. A
  // placeholder glyph is drawn well inside the box it belongs to, so the
  // inset cannot hide one.
  const inset = 3;
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box === null) {
    throw new Error("The measured element is not visible.");
  }
  const encoded = (
    await page.screenshot({
      clip: {
        height: box.height - 2 * inset,
        width: box.width - 2 * inset,
        x: box.x + inset,
        y: box.y + inset,
      },
    })
  ).toString("base64");
  return await page.evaluate(async (png: string) => {
    const view = globalThis as unknown as {
      Image: new () => {
        decode(): Promise<void>;
        naturalHeight: number;
        naturalWidth: number;
        src: string;
      };
      document: {
        createElement(tag: string): {
          height: number;
          width: number;
          getContext(kind: string): {
            drawImage(image: unknown, x: number, y: number): void;
            getImageData(
              x: number,
              y: number,
              width: number,
              height: number,
            ): { data: Uint8ClampedArray };
          } | null;
        };
      };
    };
    const image = new view.Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = view.document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("The page could not open a 2D drawing context.");
    }
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set<string>();
    for (let index = 0; index < data.length; index += 4) {
      colors.add(
        `${String(data[index] ?? 0)},${String(data[index + 1] ?? 0)},${String(
          data[index + 2] ?? 0,
        )}`,
      );
    }
    return [...colors];
  }, encoded);
}

/**
 * A deliberately broken decorative image, pinned to a corner of the viewport.
 *
 * The known-garbage anchor for {@link paintedColorsOf}. It is the same thing
 * the reserved panel must never become: an `<img alt="">` whose request
 * failed. Chromium paints its broken-image glyph for one of these even with
 * an empty `alt`, so `visible` must measure MORE than one colour and `hidden`
 * exactly one - which is what makes the panel's own "exactly one colour" a
 * result rather than a metric that cannot tell anything apart.
 */
async function addBrokenImageAnchor(
  page: Page,
  visibility: "hidden" | "visible",
): Promise<Locator> {
  await page.evaluate((mode: string) => {
    const view = globalThis as unknown as {
      document: {
        body: { appendChild(child: unknown): void };
        createElement(tag: string): {
          alt: string;
          appendChild(child: unknown): void;
          dataset: Record<string, string>;
          src: string;
          style: { cssText: string };
        };
        querySelector(selector: string): { remove(): void } | null;
      };
    };
    view.document.querySelector("[data-paint-anchor]")?.remove();
    // The opaque wrapper is what gets measured, so the reading is the anchor's
    // own paint rather than whatever the page's background happens to be
    // showing through a hidden element.
    const backdrop = view.document.createElement("div");
    backdrop.dataset.paintAnchor = "true";
    backdrop.style.cssText = [
      "position:fixed",
      "right:0",
      "bottom:0",
      "width:120px",
      "height:120px",
      "background:#ffffff",
      "z-index:2147483647",
    ].join(";");
    const image = view.document.createElement("img");
    image.alt = "";
    image.dataset.paintAnchorImage = "true";
    image.src = "/extra-credit-missing-paint-anchor.png";
    image.style.cssText = [
      "display:block",
      "width:100%",
      "height:100%",
      `visibility:${mode}`,
    ].join(";");
    backdrop.appendChild(image);
    view.document.body.appendChild(backdrop);
  }, visibility);
  // The glyph appears only once the request has actually failed.
  await expect
    .poll(
      async () =>
        await page
          .locator("[data-paint-anchor-image]")
          .evaluate(
            (image: LoadableImageV1) =>
              image.complete && image.naturalWidth === 0,
          ),
    )
    .toBe(true);
  return page.locator("[data-paint-anchor]");
}

async function pinSeed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browserCrypto = (
      globalThis as unknown as {
        crypto: { getRandomValues: (array: ArrayBufferView) => ArrayBufferView };
      }
    ).crypto;
    const original = browserCrypto.getRandomValues.bind(browserCrypto);
    Object.defineProperty(Crypto.prototype, "getRandomValues", {
      configurable: true,
      value(array: ArrayBufferView | null): ArrayBufferView | null {
        if (array instanceof Uint32Array) {
          array[0] = 42;
          return array;
        }
        if (array === null) {
          throw new TypeError("A random buffer is required.");
        }
        return original(array);
      },
    });
  });
}

async function openGenerator(
  page: Page,
  origin: string,
): Promise<Response | null> {
  const response = await page.goto(origin);
  await expect(
    page.getByRole("combobox", { name: "Child profile" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Worksheet type" })
    .selectOption("sentence-builder");
  await page.getByRole("combobox", { name: "Child profile" }).selectOption(
    profile.id,
  );
  return response;
}

async function createSheet(
  page: Page,
  expectedDecoration: "art" | "doodle",
): Promise<DecoratedSheetV1> {
  await page.getByRole("button", { name: "Create worksheet" }).click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "sentence-builder");
  const panel = preview.locator("[data-decorative-panel]");
  await expect(panel).toHaveCount(1);
  // The unavailable-art fallback is a real transition, so settle on the
  // final decoration state before measuring anything.
  await expect(panel).toHaveAttribute("data-decoration", expectedDecoration);
  if (expectedDecoration === "art") {
    const art = preview.locator("img[data-decorative-art]");
    await expect(art).toHaveCount(1);
    await expect
      .poll(
        async () =>
          await art.evaluate(
            (image: LoadableImageV1) => image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    // Art starts unpaintable and must END paintable: `pending` is a hidden
    // element, so a bug that never reached `ready` would ship a blank panel
    // instead of the reviewed drawing.
    await expect(art).toHaveAttribute("data-decorative-art-status", "ready");
  } else {
    await expect(preview.locator("[data-doodle-box]")).toHaveCount(1);
  }
  return await readDecoratedSheet(preview);
}

test("decoration changes only decoration, in the compiled browser", async ({
  appServer,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [profile],
    defaults,
  });
  await pinSeed(page);

  const requestUrls: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => requestUrls.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  // State 1 first, while nothing is cached: reviewed art exists and IS
  // selected, but the bundled file cannot be fetched. That is the
  // art-unavailable branch, not the no-licensed-match branch - selection
  // succeeded here. The two are different causes that converge on the same
  // same-size doodle box; the empty-catalog unit test covers the other one
  // directly, because every allowlisted topic legitimately has art in v1 and
  // there is no production hook for faking a missing match in the browser.
  await page.route("**/*.svg", async (route) => {
    await route.abort();
  });
  await openGenerator(page, appServer.origin);
  const unavailableArt = await createSheet(page, "doodle");
  expect(unavailableArt.decorationState).toBe("doodle");
  expect(unavailableArt.doodleBoxes).toBe(1);
  expect(unavailableArt.artIds).toEqual([]);

  // State 2: decorative graphics on, art really rendered. `unrouteAll` is the
  // complete teardown - a pattern-scoped `unroute` would drop only the one
  // pattern - so the asset request that was aborted above is a real request
  // again.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const documentResponse = await openGenerator(page, appServer.origin);

  // The REAL production policy, read off the document that carries the app.
  // An earlier revision of this file claimed CSP blocked `data:` images and
  // that `?no-inline` was therefore load-bearing for the browser. It is not:
  // helmet's merged defaults ship `img-src 'self' data:`, so an inlined asset
  // would have rendered perfectly well. `?no-inline` is kept for the build
  // reason the manifest module documents - one inspectable, byte-identical
  // file per row - and this assertion pins the policy the claim was wrong
  // about, so any future tightening has to revisit that rationale rather than
  // silently resurrect the old story.
  const policy = documentResponse?.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("default-src 'self'");
  expect(policy).toMatch(/(?:^|;)\s*img-src\s[^;]*\bdata:/u);

  await expect(page.getByLabel("Include decorative graphics")).toBeChecked();
  const withArt = await createSheet(page, "art");
  expect(withArt.decorationState).toBe("art");
  expect(withArt.artIds).toEqual(["space-rocket"]);
  // Non-vacuity: the graphics-on state carries a decoration that actually
  // loaded and decoded, so the equality assertions below are no longer zero
  // against zero.
  expect(withArt.artLoaded).toEqual([true]);
  expect(withArt.artAlt).toBe("");
  expect(withArt.doodleBoxes).toBe(0);
  expect(withArt.decorativePanelsInsideResponse).toBe(0);

  // State 3: the parent turns decoration off; the panel becomes a doodle box.
  await page.getByLabel("Include decorative graphics").uncheck();
  const withoutGraphics = await createSheet(page, "doodle");
  expect(withoutGraphics.decorationState).toBe("doodle");
  expect(withoutGraphics.doodleBoxes).toBe(1);
  expect(withoutGraphics.artIds).toEqual([]);

  // The reserved panel is the SAME box in all three states...
  expect(withoutGraphics.decorativePanelBox).toEqual(withArt.decorativePanelBox);
  expect(unavailableArt.decorativePanelBox).toEqual(withArt.decorativePanelBox);
  expect(withArt.decorativePanelBox?.width ?? 0).toBeGreaterThan(0);
  expect(withArt.decorativePanelBox?.height ?? 0).toBeGreaterThan(0);

  // ...and therefore nothing the child must do moves or resizes.
  const expected = instructionalSurfaceOf(withArt);
  expect(expected.responsePanelBox?.height ?? 0).toBeGreaterThan(0);
  expect(expected.bankWordBoxes.length).toBe(6);
  expect(expected.responseLineBoxes.length).toBeGreaterThan(0);
  expect(instructionalSurfaceOf(withoutGraphics)).toEqual(expected);
  expect(instructionalSurfaceOf(unavailableArt)).toEqual(expected);

  // Decoration never becomes a network dependency or a policy violation.
  for (const requestUrl of requestUrls) {
    expect(new URL(requestUrl).origin).toBe(appServer.origin);
  }
  expect(
    consoleErrors.filter((message) => /content security policy/iu.test(message)),
  ).toEqual([]);

  // Print keeps the child page, decoration included, without parent controls.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-decorative-panel]")).toHaveCount(1);
  await expect(page.locator(".profile-workspace")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
});

test("a decorative image never paints a browser placeholder", async ({
  appServer,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [profile],
    defaults,
  });
  await pinSeed(page);

  // Hold the asset request open rather than failing it, so the not-yet-ready
  // state can be inspected instead of raced against. Measured separately: a
  // request still IN FLIGHT paints nothing by itself, and a FAILED one paints
  // the browser's broken-image glyph even with an empty `alt`. The failed
  // frame is the one the CSS guarantee exists for and the one no test can
  // hold still, because `onError` ends it; so this test proves the guarantee
  // on the element that is live for both - the `<img>` is `visibility:
  // hidden` for every state that is not `ready` - and the anchors below prove
  // the glyph is real and that hiding it is what suppresses it.
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*.svg", async (route) => {
    await held;
    await route.abort();
  });

  await openGenerator(page, appServer.origin);
  await page.getByRole("button", { name: "Create worksheet" }).click();
  const preview = page.getByLabel("Worksheet preview");
  const panel = preview.locator("[data-decorative-panel]");
  await expect(panel).toHaveCount(1);
  const art = preview.locator("img[data-decorative-art]");
  await expect(art).toHaveCount(1);
  await expect(art).toHaveAttribute("data-decorative-art-status", "pending");

  // A `visibility: hidden` element paints nothing at all, by definition,
  // while still reserving its box.
  const visibility = await art.evaluate((node: unknown) => {
    const view = globalThis as unknown as {
      getComputedStyle(element: unknown): StyledV1;
    };
    return view.getComputedStyle(node).visibility;
  });
  expect(visibility).toBe("hidden");

  // Calibrate the metric before trusting a reading from it. The anchor is a
  // broken decorative image of the same size: visible it must show the glyph
  // this panel may never show, hidden it must show nothing. A metric that
  // could not tell those apart could not tell anything apart.
  const glyphAnchor = await addBrokenImageAnchor(page, "visible");
  const glyphColors = await paintedColorsOf(page, glyphAnchor);
  expect(glyphColors.length).toBeGreaterThan(1);
  const suppressedAnchor = await addBrokenImageAnchor(page, "hidden");
  expect(await paintedColorsOf(page, suppressedAnchor)).toHaveLength(1);
  await suppressedAnchor.evaluate((node: { remove(): void }) => {
    node.remove();
  });

  // And the panel really is blank: exactly one colour on the glass, so no
  // glyph, no placeholder outline, nothing coloured.
  const pendingColors = await paintedColorsOf(page, panel);
  expect(pendingColors).toHaveLength(1);

  // Letting the request fail lands on the doodle box, never on a glyph.
  release?.();
  await expect(panel).toHaveAttribute("data-decoration", "doodle");
  await expect(preview.locator("[data-doodle-box]")).toHaveCount(1);
  await expect(art).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the reserved panel cannot overflow a narrow page at a large base font", async ({
  appServer,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [profile],
    defaults,
  });
  await pinSeed(page);
  await openGenerator(page, appServer.origin);

  const roomy = await createSheet(page, "art");
  const roomyFit = await readPanelFit(page.getByLabel("Worksheet preview"));
  expect(roomyFit.panelWidth).toBeGreaterThan(0);
  expect(roomyFit.overhang).toBeLessThanOrEqual(0.5);
  // The reservation is square, and stays square when it shrinks: a panel that
  // kept a rigid 7.5rem height while its width gave way measured 224x360 at a
  // 300% root font here, letterboxing the art and squeezing the caption until
  // `overflow: hidden` cut it.
  expect(Math.abs(roomyFit.panelHeight - roomyFit.panelWidth)).toBeLessThanOrEqual(
    0.5,
  );

  // The reservation must be able to give way. A rigid `flex: 0 0` panel also
  // contributes its whole width to the min-content size of everything above
  // it, which is how one decoration slot widens a page.
  const panelStyle = await page
    .locator("[data-decorative-panel]")
    .evaluate((node: unknown) => {
      const view = globalThis as unknown as {
        getComputedStyle(element: unknown): {
          flexShrink: string;
          maxWidth: string;
          minWidth: string;
        };
      };
      const computed = view.getComputedStyle(node);
      return {
        flexShrink: computed.flexShrink,
        maxWidth: computed.maxWidth,
        minWidth: computed.minWidth,
      };
    });
  expect(panelStyle.flexShrink).not.toBe("0");
  expect(panelStyle.minWidth).toBe("0px");
  expect(panelStyle.maxWidth).not.toBe("none");

  // The hostile condition: a 320 px page whose reader has set a very large
  // base font, so the 7.5rem reservation wants 360 physical px - wider than
  // the page that has to hold it.
  await page.addStyleTag({
    content:
      "html { font-size: 48px } [aria-label='Worksheet preview'] { box-sizing: border-box; width: 320px; max-width: 320px; }",
  });
  const narrow = await readDecoratedSheet(page.getByLabel("Worksheet preview"));
  const narrowFit = await readPanelFit(page.getByLabel("Worksheet preview"));

  // Non-vacuity, read from the page itself: every rem really did grow, and
  // the line holding the panel really is narrower than an unshrunk panel.
  expect(narrow.drawingBoxBox?.height ?? 0).toBeGreaterThan(
    2 * (roomy.drawingBoxBox?.height ?? 0),
  );
  expect(narrowFit.headerWidth).toBeLessThan(360);

  expect(narrowFit.panelWidth).toBeGreaterThan(0);
  expect(narrowFit.panelWidth).toBeLessThanOrEqual(narrowFit.headerWidth + 0.5);
  expect(narrowFit.overhang).toBeLessThanOrEqual(0.5);
  // Both axes gave way together. A rigid `height: 7.5rem` would be 360 px at
  // this root font no matter how far the width shrank.
  expect(
    Math.abs(narrowFit.panelHeight - narrowFit.panelWidth),
  ).toBeLessThanOrEqual(0.5);
  expect(narrowFit.panelHeight).toBeLessThan(360);

  // Container-awareness must not buy itself out of the three-state equality:
  // the panel is still the same box with graphics off, at this size too.
  await page.getByLabel("Include decorative graphics").uncheck();
  const narrowDoodle = await createSheet(page, "doodle");
  expect(narrowDoodle.decorationState).toBe("doodle");
  expect(narrowDoodle.decorativePanelBox).toEqual(narrow.decorativePanelBox);
  expect(instructionalSurfaceOf(narrowDoodle)).toEqual(
    instructionalSurfaceOf(narrow),
  );
});

test("the doodle caption is never cut off, at any text size", async ({
  appServer,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [profile],
    defaults,
  });
  await pinSeed(page);
  await openGenerator(page, appServer.origin);
  await page.getByLabel("Include decorative graphics").uncheck();
  await createSheet(page, "doodle");

  const preview = page.getByLabel("Worksheet preview");
  await page.addStyleTag({
    content:
      "[aria-label='Worksheet preview'] { box-sizing: border-box; width: 320px; max-width: 320px; }",
  });

  // 100%, 200% (the resize bar plan.md:255 declares) and 300%, on a 320 CSS
  // pixel page. The caption is sized as a share of the panel rather than of
  // the root font, so it shrinks with the box that clips it; with the panel's
  // previous root-relative metrics the caption's own rectangle grew past the
  // box's padding edges and `overflow: hidden` cut the words silently.
  const sizes: readonly number[] = [16, 32, 48];
  const seen: number[] = [];
  for (const rootFont of sizes) {
    await page.addStyleTag({ content: `html { font-size: ${rootFont}px }` });
    const fit = await readCaptionFit(preview);
    const panel = await readPanelFit(preview);
    seen.push(panel.panelWidth);

    expect(fit.boxWidth, `${rootFont}px box width`).toBeGreaterThan(0);
    expect(fit.captionWidth, `${rootFont}px caption width`).toBeGreaterThan(0);
    for (const overflow of fit.overflow) {
      expect(overflow, `${rootFont}px root font: ${fit.captionFontSize}`).
        toBeLessThanOrEqual(0.5);
    }
    // The panel stays square at every one of them.
    expect(
      Math.abs(panel.panelHeight - panel.panelWidth),
      `${rootFont}px squareness`,
    ).toBeLessThanOrEqual(0.5);
  }

  // Non-vacuity: the page really was put under pressure - the panel is not
  // the same size at 300% as at 100%, so the caption above was re-measured in
  // genuinely different boxes rather than three times in one.
  expect(new Set(seen).size).toBeGreaterThan(1);
});

/**
 * The accessibility scan runs on its own page, with no request interception:
 * that is the state a parent's browser is actually in, so the scan is of the
 * shipped page rather than of a test-shaped one. (An earlier revision claimed
 * an axe run never returns on a context that has had routing enabled. It was
 * not reproducible: measured against the built app, axe returned
 * with an aborting `**\/*.svg` route still active, after a pattern-scoped
 * `unroute`, and after `unrouteAll`. The claim is gone rather than restated.)
 */
test("both decoration states pass the accessibility scan", async ({
  appServer,
  page,
}) => {
  test.setTimeout(120_000);
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [profile],
    defaults,
  });
  // Pinned before navigating: this test names the asset it expects, and that
  // name is a function of the page seed.
  await pinSeed(page);
  await openGenerator(page, appServer.origin);

  const withArt = await createSheet(page, "art");
  expect(withArt.artAlt).toBe("");
  expect(withArt.artIds).toEqual(["space-rocket"]);
  const artResults = await new AxeBuilder({ page }).analyze();
  expect(artResults.violations).toEqual([]);

  await page.getByLabel("Include decorative graphics").uncheck();
  const withoutGraphics = await createSheet(page, "doodle");
  expect(withoutGraphics.doodleBoxes).toBe(1);
  const doodleResults = await new AxeBuilder({ page }).analyze();
  expect(doodleResults.violations).toEqual([]);
});

/* -------------------------------------------------------------------------
 * The committed provenance contract, checked from Node
 * ---------------------------------------------------------------------- */

interface ManifestRowV1 {
  readonly [field: string]: unknown;
  readonly id: string;
  readonly origin: string;
}

function readManifestRows(): ReadonlyMap<string, ManifestRowV1> {
  const parsed: unknown = JSON.parse(
    repositoryText(`${LINE_ART_DIRECTORY}manifest.json`),
  );
  const assets = (parsed as { assets?: Record<string, ManifestRowV1> }).assets;
  expect(assets).toBeDefined();
  return new Map(Object.entries(assets ?? {}));
}

function parseProvenanceLedger(
  markdown: string,
): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const rows = new Map<string, Map<string, string>>();
  for (const block of markdown.split(/^### /mu).slice(1)) {
    const lines = block.split(/\r?\n/u);
    const path = (lines[0] ?? "").trim().replace(/^`|`$/gu, "");
    const fields = new Map<string, string>();
    for (const line of lines.slice(1)) {
      const match = /^- ([A-Za-z ]+): (.+)$/u.exec(line.trim());
      const label = match?.[1];
      const value = match?.[2];
      if (label !== undefined && value !== undefined) {
        fields.set(label, value.trim());
      }
    }
    rows.set(path, fields);
  }
  return rows;
}

/**
 * The ledger label that mirrors each manifest field.
 *
 * The comparison below is driven by the ROW's own keys, not by a fixed list
 * of labels. An earlier revision compared ten hard-coded labels, so `notice` -
 * the field every third-party row depends on, and the only one the ledger
 * promises to carry verbatim - was never compared at all, while the ledger
 * claimed a single disagreeing field would fail. Anything in a manifest row
 * with no entry here is reported as drift too, so a new schema field cannot
 * be added without deciding how the ledger mirrors it.
 */
const LEDGER_LABELS: Readonly<Record<string, string>> = {
  aiAssistance: "AI assistance",
  creator: "Creator",
  description: "Description",
  id: "Asset ID",
  license: "License",
  licenseFile: "License file",
  notice: "Notice",
  origin: "Origin",
  reviewedOn: "Reviewed on",
  source: "Source",
  topics: "Topics",
};

function ledgerTextFor(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value);
}

/** Every way the manifest and the ledger disagree. Empty means they agree. */
function provenanceDrift(
  manifest: ReadonlyMap<string, ManifestRowV1>,
  ledger: ReadonlyMap<string, ReadonlyMap<string, string>>,
): readonly string[] {
  const drift: string[] = [];

  for (const path of manifest.keys()) {
    if (!ledger.has(path)) {
      drift.push(`${path}: in the manifest, missing from the ledger.`);
    }
  }
  for (const path of ledger.keys()) {
    if (!manifest.has(path)) {
      drift.push(`${path}: in the ledger, missing from the manifest.`);
    }
  }

  for (const [path, row] of manifest) {
    const fields = ledger.get(path);
    if (fields === undefined) {
      continue;
    }
    const mirrored = new Set<string>();
    for (const [field, value] of Object.entries(row)) {
      const label = LEDGER_LABELS[field];
      if (label === undefined) {
        drift.push(`${path}: manifest field "${field}" has no ledger label.`);
        continue;
      }
      mirrored.add(label);
      const expected = ledgerTextFor(value);
      const recorded = fields.get(label);
      if (recorded !== expected) {
        drift.push(
          `${path}: ${label} is "${recorded ?? "(absent)"}" in the ledger and "${expected}" in the manifest.`,
        );
      }
    }
    for (const label of fields.keys()) {
      if (!mirrored.has(label)) {
        drift.push(`${path}: ledger field "${label}" is not in the manifest.`);
      }
    }
  }

  return drift;
}

/** The ledger block `ASSET_PROVENANCE.md` commits for one manifest row. */
function ledgerBlockFor(path: string, row: ManifestRowV1): string {
  const lines = Object.entries(row).map(
    ([field, value]) =>
      `- ${LEDGER_LABELS[field] ?? field}: ${ledgerTextFor(value)}`,
  );
  return `### \`${path}\`\n\n${lines.join("\n")}\n`;
}

test("manifest.json and ASSET_PROVENANCE.md carry the same rows", () => {
  const manifest = readManifestRows();
  const ledger = parseProvenanceLedger(repositoryText("ASSET_PROVENANCE.md"));

  expect(manifest.size).toBeGreaterThan(0);
  expect(ledger.size).toBe(manifest.size);
  expect(provenanceDrift(manifest, ledger)).toEqual([]);
});

test("the drift gate really fails on ONE disagreeing field, `notice` included", () => {
  // The assertion above only proves the two files agree today. What the
  // ledger CLAIMS is that a single disagreeing field fails the gate, and a
  // comparator that quietly skipped a field would satisfy the assertion while
  // making that claim false - which is exactly what a fixed ten-label compare
  // did to `notice`. So the comparator is run against deliberate one-field
  // disagreements here, on a synthetic third-party row that carries every
  // field the schema allows.
  const path = `${LINE_ART_DIRECTORY}future-borrowed-mark.svg`;
  const row: ManifestRowV1 = {
    id: "future-borrowed-mark",
    topics: ["neutral", "space"],
    description: "A hypothetical future third-party mark.",
    creator: "Upstream Example Studio",
    source: "https://example.invalid/line-art/borrowed-mark.svg",
    reviewedOn: "2026-08-24",
    aiAssistance: "No AI assistance; received as-is from the upstream project.",
    origin: "third-party",
    license: "CC-BY-4.0",
    licenseFile: "third-party-licenses/borrowed-mark.LICENSE",
    notice: "Borrowed Mark (c) Upstream Example Studio, used under CC BY 4.0.",
  };
  const manifest = new Map([[path, row]]);
  const ledger = parseProvenanceLedger(ledgerBlockFor(path, row));

  // Calibration: the comparator must accept a faithful mirror, or every
  // rejection below would only be proving that it rejects everything.
  expect(provenanceDrift(manifest, ledger)).toEqual([]);
  expect(ledger.get(path)?.get("Notice")).toBe(row.notice);

  // One field at a time, in the manifest, with the ledger left alone.
  for (const field of Object.keys(row)) {
    const value = row[field];
    const changed = Array.isArray(value)
      ? [...value.map(String), "vehicles"]
      : `${String(value)} (changed)`;
    const drift = provenanceDrift(
      new Map([[path, { ...row, [field]: changed }]]),
      ledger,
    );
    expect(drift, field).not.toEqual([]);
    expect(drift.join("\n"), field).toContain(LEDGER_LABELS[field] ?? field);
  }

  // ...and in the ledger, with the manifest left alone.
  for (const field of Object.keys(row)) {
    const trimmed = Object.fromEntries(
      Object.entries(row).filter(([name]) => name !== field),
    ) as unknown as ManifestRowV1;
    const drift = provenanceDrift(
      manifest,
      parseProvenanceLedger(ledgerBlockFor(path, trimmed)),
    );
    expect(drift, `ledger missing ${field}`).not.toEqual([]);
  }

  // A field the schema could gain but the ledger has no label for is drift,
  // not silence.
  const extended = { ...row, embargoedUntil: "2027-01-01" } as ManifestRowV1;
  expect(provenanceDrift(new Map([[path, extended]]), ledger)).toContain(
    `${path}: manifest field "embargoedUntil" has no ledger label.`,
  );

  // And a whole row on one side only.
  expect(provenanceDrift(manifest, new Map())).not.toEqual([]);
  expect(provenanceDrift(new Map(), ledger)).not.toEqual([]);
});

test("ASSET_PROVENANCE.md names the file that really gates its own drift", () => {
  // A ledger that points a reader at the wrong gate is the same class of
  // defect as a wrong provenance row: a committed statement that is false.
  // The declared path is compared against THIS module's own location, so the
  // check cannot be satisfied by a file that merely mentions the ledger - the
  // way a `toMatch` over the gate's own source text could be, and was.
  const ledger = repositoryText("ASSET_PROVENANCE.md");
  const declared = /^- Drift gate: `([^`]+)`$/mu.exec(ledger)?.[1] ?? "";
  const own = fileURLToPath(import.meta.url)
    .replaceAll("\\", "/")
    .slice(REPOSITORY_ROOT.replaceAll("\\", "/").length);
  expect(declared).toBe(own);
  expect(repositoryText(declared).length).toBeGreaterThan(0);

  // The ledger may promise only what the comparator above is proven to do.
  expect(ledger).toMatch(/fails if they disagree\s+on a single mirrored field/u);
});

test("every committed line-art file has one original manifest row", () => {
  const manifest = readManifestRows();
  const committed = committedSvgPaths(
    `${REPOSITORY_ROOT}${LINE_ART_DIRECTORY}`,
  ).map((name) => `${LINE_ART_DIRECTORY}${name}`);

  expect(committed.length).toBeGreaterThan(0);
  expect([...manifest.keys()].sort()).toEqual(committed);

  for (const [path, row] of manifest) {
    expect(row.origin, path).toBe("original");
    expect(row.license, path).toBe("MIT");
    expect(row.licenseFile, path).toBe("LICENSE");
    expect(path).toBe(`${LINE_ART_DIRECTORY}${row.id}.svg`);
  }

  // TSX renderers are project code covered globally; they get no asset rows.
  for (const path of manifest.keys()) {
    expect(path.endsWith(".svg")).toBe(true);
  }
});

test("the committed-asset scan reaches nested files, as Step 13 will", () => {
  // The guard above is only as wide as this scan. plan.md:740 audits
  // `**\/*.svg`, so a flat scan would let a nested asset through here and
  // meet it for the first time at release.
  const root = mkdtempSync(`${tmpdir()}/extra-credit-line-art-scan-`);
  try {
    writeFileSync(`${root}/top.svg`, "<svg />", "utf8");
    writeFileSync(`${root}/notes.txt`, "not art", "utf8");
    mkdirSync(`${root}/nested/deeper`, { recursive: true });
    writeFileSync(`${root}/nested/deeper/rogue-mark.svg`, "<svg />", "utf8");
    expect(committedSvgPaths(root)).toEqual([
      "nested/deeper/rogue-mark.svg",
      "top.svg",
    ]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("the repository keeps exactly one project license", () => {
  const rootLicenses = readdirSync(REPOSITORY_ROOT)
    .filter((name) => /^(?:licen[cs]e|copying)/iu.test(name))
    .sort();
  expect(rootLicenses).toEqual(["LICENSE"]);
  expect(repositoryText("LICENSE")).toContain("MIT License");
});

test("CONTRIBUTING.md states the license and provenance rules", () => {
  const contributing = repositoryText("CONTRIBUTING.md");
  expect(contributing).toMatch(
    /every project-original contribution[\s\S]{0,240}root[\s\S]{0,40}MIT/iu,
  );
  expect(contributing).toMatch(/do not add\s*\n?\s*a second project license/iu);
  expect(contributing).toMatch(/complete\s*\n?\s*provenance and upstream terms/iu);
  expect(contributing).toMatch(/never\s+relicensed/iu);
  expect(contributing).toMatch(/never the root `LICENSE`/u);
});

test("the build emits each reviewed asset as its own byte-identical file", () => {
  // `?no-inline` is a build property, not a browser guard: the production
  // policy permits `data:` images (asserted against the live response above).
  // What it buys is this - every reviewed drawing survives the build as a
  // separate file whose bytes are exactly the committed bytes the SVG safety
  // check ran over. Dropping it was measured: `vite build` then emits zero
  // `.svg` files and six `data:image/svg+xml,%3csvg...` payloads inside the
  // bundle - percent-encoded, not base64, and not the committed bytes - which
  // is the payload prefix the last assertion here rejects. Step 13's
  // release audit walks an exported SOURCE tree with build output absent
  // (plan.md:740), so this test, re-run in its clean room, is what inspects
  // what actually shipped.
  const builtDirectory = `${REPOSITORY_ROOT}${BUILT_ASSET_DIRECTORY}`;
  const builtAssets = readdirSync(builtDirectory);
  const builtSvgs = builtAssets.filter((name) => name.endsWith(".svg"));
  const rows = readManifestRows();
  expect(builtSvgs.length).toBe(rows.size);

  const builtByContent = new Map(
    builtSvgs.map((name) => [
      readFileSync(`${builtDirectory}/${name}`, "utf8"),
      name,
    ]),
  );
  expect(builtByContent.size).toBe(builtSvgs.length);
  for (const path of rows.keys()) {
    const committed = repositoryText(path);
    expect(builtByContent.get(committed), path).toBeDefined();
  }

  const bundles = builtAssets.filter((name) => name.endsWith(".js"));
  expect(bundles.length).toBeGreaterThan(0);
  for (const bundle of bundles) {
    const code = readFileSync(`${builtDirectory}/${bundle}`, "utf8");
    expect(code).not.toContain("data:image/svg+xml");
  }
});
