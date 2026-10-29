import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import type { AppConfigV2, ChildProfileV2, WorksheetSelectionV2 } from "../../src/shared/config/schema.ts";
import { composePacketPages } from "../../src/shared/packet/compose.ts";
import { projectGenerationRequest } from "../../src/shared/worksheet/project-request.ts";
import { getWorksheetRegistration } from "../../src/shared/worksheet/registry.ts";
import type { PrintScale, WorksheetDocumentV1 } from "../../src/shared/worksheet/types.ts";
import {
  acceptanceConfig,
  boundaryNickname,
  createPrintFixture,
  printFixtures,
} from "../fixtures/print/matrix.ts";
import { requiredPrintContent } from "../fixtures/print/required-content.ts";
import { expect, test } from "./fixtures/app-server.ts";
import {
  choosePacketPaper,
  openPacketPreview,
  packetSurfaces,
  packetWorksheetIds,
  printPacketButton,
  queueSheets,
  type PacketSheetPlan,
} from "./fixtures/packet-controls.ts";
import {
  installPrintSeedStub,
  readPrintGeometry,
  readRequiredContent,
} from "./fixtures/print-checks.ts";

/*
 * The whole packet printed once through the compiled app (master plan Step
 * 33). Each sheet is a print-matrix boundary fixture: the real generator's
 * seed for the widest content at Long length, the 40-character boundary
 * nickname, created with the print seed stub through the worksheet controls.
 * Every child is the canonical fictional example under that nickname.
 */

const evidenceRoot = fileURLToPath(
  new URL("../../../.build-step/print-evidence/packet/", import.meta.url),
);

// Independent physical page sizes in PDF points, deliberately not read from the app's CSS.
const pdfPageSizes = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
} as const;

interface PacketCase {
  readonly document: WorksheetDocumentV1;
  readonly plan: PacketSheetPlan;
  readonly profile: ChildProfileV2;
  readonly profileIndex: number;
  /** The fixture's whole selection at Long length and this scale. */
  readonly selection: WorksheetSelectionV2;
}

/** The boundary fixtures by id, each created at this scale. */
function packetCases(ids: readonly string[], scale: PrintScale): readonly PacketCase[] {
  return ids.map((id) => {
    const fixture = printFixtures.find((candidate) => candidate.id === id);
    if (fixture === undefined) {
      throw new Error(`Missing print fixture ${id}.`);
    }
    const boundary = createPrintFixture(fixture, scale);
    return {
      document: boundary.document,
      plan: { profileId: boundary.profile.id, selection: fixture.selection, seed: boundary.seed },
      profile: boundary.profile,
      profileIndex: fixture.profileIndex,
      selection: boundary.selection,
    };
  });
}

/**
 * The canonical fictional profiles, each under the boundary nickname and, for
 * a Sentence Builder fixture, with the interests it was generated for, and the
 * shipped defaults at Long length and this scale. Every fixture's request must
 * project unchanged from the seeded profile, so the browser reproduces it.
 */
function packetConfig(cases: readonly PacketCase[], scale: PrintScale): AppConfigV2 {
  const profiles = acceptanceConfig.profiles.map((original, index) => {
    const used = cases.filter((entry) => entry.profileIndex === index);
    const chosen =
      used.find((entry) => entry.selection.worksheetType === "sentence-builder")?.profile ??
      used[0]?.profile ??
      { ...original, displayName: boundaryNickname };
    for (const entry of used) {
      const projected = projectGenerationRequest({
        profile: chosen,
        selection: entry.selection,
        generatorVersion: entry.document.generatorVersion,
        seed: entry.document.seed,
      });
      if (!projected.ok || JSON.stringify(projected.request) !== JSON.stringify(entry.document.request)) {
        throw new Error("A fixture's request does not project from the seeded profile.");
      }
    }
    return chosen;
  });
  return {
    ...acceptanceConfig,
    profiles,
    defaults: { ...acceptanceConfig.defaults, length: "long", printScale: scale },
  };
}

/** The label each key heading must carry, written from the contract rather than read from the page. */
function expectedKeyLabel(position: number, document: WorksheetDocumentV1): string {
  return `Sheet ${position} · ${getWorksheetRegistration(document.worksheetType).displayName} · for ${boundaryNickname}`;
}

async function startPacket(page: Page, cases: readonly PacketCase[], scale: PrintScale, seedConfig: (config: AppConfigV2) => Promise<void>, origin: string) {
  await seedConfig(packetConfig(cases, scale));
  await installPrintSeedStub(page);
  await page.goto(origin);
  await queueSheets(page, cases.map((entry) => entry.plan));
}

async function printToPdf(page: Page): Promise<{ readonly bytes: Uint8Array; readonly pdf: PDFDocument }> {
  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: false, displayHeaderFooter: false });
  return { bytes, pdf: await PDFDocument.load(bytes) };
}

const cells = [
  {
    name: "letter-standard",
    paper: "letter",
    scale: "standard",
    // Eight families; Sentence Builder has no key.
    ids: [
      "dry-math",
      "dry-math-facts-144",
      "dry-math-regrouping-100",
      "wow-quantity",
      "sentence-independent-prompt",
      "count-all-four-subtypes",
      "bonds-missing-20",
      "grid-addition-12",
      "clock-hours-12",
      "tally-totals-20",
    ],
  },
  {
    name: "a4-large",
    paper: "a4",
    scale: "large",
    ids: [
      "dry-math",
      "wow-quantity",
      "wow-equation",
      "sentence-draw-and-tell-prompt",
      "count-all-four-subtypes",
      "bonds-missing-20",
      "grid-powers-10x3",
      "clock-hours-12",
      "tally-totals-20",
      "dry-math-facts-144",
    ],
  },
] as const;

for (const cell of cells) {
  test(`packet ${cell.name}: ten maximum-length sheets with every key at the end`, async ({ appServer, page }) => {
    test.setTimeout(240_000);
    const cases = packetCases(cell.ids, cell.scale);
    expect(cases).toHaveLength(10);
    await startPacket(page, cases, cell.scale, (config) => appServer.seedConfig(config), appServer.origin);
    const queued = await packetWorksheetIds(page);
    expect(queued).toHaveLength(10);
    // The A4 cell's sheets were made on the stored Letter paper: the packet
    // paper re-renders them without regenerating.
    if (cell.paper === "a4") {
      await choosePacketPaper(page, "a4");
    }
    await openPacketPreview(page);
    expect(await page.locator(".print-workspace").count()).toBe(1);

    const composed = composePacketPages(
      cases.map((entry, index) => ({ ...entry, id: queued[index] ?? "" })),
      "grouped-end",
    );
    expect(composed).toHaveLength(19);
    await expect(printPacketButton(page)).toHaveText(`Print packet (${composed.length} pages)`);
    const surfaces = packetSurfaces(page);
    await expect(surfaces).toHaveCount(composed.length);
    // DOM order is the queued order: every worksheet, then every key.
    expect(await surfaces.evaluateAll((nodes) =>
      nodes.map((node) => `${node.getAttribute("data-surface")}:${node.getAttribute("data-sheet-id")}`),
    )).toEqual(composed.map((entry) => `${entry.surface}:${entry.sheet.id}`));
    expect(await page.locator("[id]").evaluateAll((elements) =>
      elements.map((element) => element.id).filter((id, index, ids) => ids.indexOf(id) !== index),
    )).toEqual([]);

    await page.emulateMedia({ media: "print" });
    await page.locator("html").evaluate(async (html) => {
      await html.ownerDocument.fonts.ready;
      html.ownerDocument.defaultView?.scrollTo(0, 0);
    });
    await expect(page.locator(".profile-workspace")).toBeHidden();
    for (const control of await page.locator(".print-controls").all()) {
      await expect(control).toBeHidden();
    }
    const evidence = [];
    for (const [index, entry] of composed.entries()) {
      const surface = surfaces.nth(index);
      const name = `page ${index + 1} (${entry.surface} ${entry.sheet.document.worksheetType})`;
      await expect(surface).toHaveAttribute("data-packet-page", String(index + 1));
      await expect(surface).toHaveAttribute("data-paper-size", cell.paper);
      await expect(surface).toHaveAttribute("data-print-scale", cell.scale);
      if (entry.surface === "worksheet") {
        await expect(surface.locator("[data-seed]")).toHaveAttribute("data-seed", entry.sheet.document.seed);
      }
      // The required content is derived from the fixture, never from the page;
      // a key's heading also names its sheet.
      const label = expectedKeyLabel(entry.position, entry.sheet.document);
      const required = requiredPrintContent(entry.sheet.document, entry.surface).map((requirement) =>
        entry.surface === "answer" && requirement.selector === "header h2"
          ? { ...requirement, texts: [`Parent answer key — ${label}`] }
          : requirement,
      );
      const content = await readRequiredContent(surface, required);
      expect(content.violations, `${name}: required content`).toEqual([]);
      const geometry = await readPrintGeometry(surface,
        entry.surface === "worksheet" && entry.sheet.document.worksheetType === "count-compare-make");
      expect(geometry.violations, `${name}: containment`).toEqual([]);
      expect(geometry.violations.filter((violation) => violation.startsWith("clipped"))).toEqual([]);
      expect(await surface.evaluate((node) =>
        node.ownerDocument.defaultView?.getComputedStyle(node).getPropertyValue("page"),
      ), `${name}: named page`).toBe(`extra-credit-${cell.paper}`);
      if (entry.surface === "answer") {
        await expect(surface.locator("h2 > span[data-packet-sheet-label]")).toHaveText(label);
      } else {
        await expect(surface.locator("[data-packet-sheet-label]")).toHaveCount(0);
      }
      evidence.push({ name, content, geometry });
    }

    const { bytes, pdf } = await printToPdf(page);
    await mkdir(evidenceRoot, { recursive: true });
    await writeFile(`${evidenceRoot}/${cell.name}.pdf`, bytes);
    await writeFile(`${evidenceRoot}/${cell.name}.json`, JSON.stringify({
      pageCount: pdf.getPageCount(),
      composed: composed.map((entry) => `${entry.surface}:${entry.position}`),
      evidence,
    }, null, 2));
    expect(pdf.getPageCount(), "PDF page count").toBe(composed.length);
    for (const size of pdf.getPages().map((sheet) => sheet.getSize())) {
      expect(size.width).toBeCloseTo(pdfPageSizes[cell.paper].width, 0);
      expect(size.height).toBeCloseTo(pdfPageSizes[cell.paper].height, 0);
    }
    // Printing changed nothing in the queue.
    await page.emulateMedia({ media: "screen" });
    expect(await packetWorksheetIds(page)).toEqual(queued);
  });
}

test("packet calibration: break-before auto on packet surfaces lowers the PDF page count", async ({ appServer, page }) => {
  test.setTimeout(120_000);
  // Four short keyed sheets: without the page breaks their keys share pages.
  const cases = packetCases(["clock-hours-12", "tally-totals-20", "clock-hours-12", "tally-totals-20"], "standard");
  await startPacket(page, cases, "standard", (config) => appServer.seedConfig(config), appServer.origin);
  await openPacketPreview(page);
  const composed = composePacketPages(cases, "grouped-end");
  expect(composed).toHaveLength(8);
  await expect(packetSurfaces(page)).toHaveCount(8);
  await page.emulateMedia({ media: "print" });

  expect((await printToPdf(page)).pdf.getPageCount()).toBe(composed.length);
  const style = await page.addStyleTag({
    content: ".print-surface[data-packet-page] { break-before: auto !important; }",
  });
  const broken = await printToPdf(page);
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(`${evidenceRoot}/calibration-break-before-auto.pdf`, broken.bytes);
  expect(broken.pdf.getPageCount(), "pages without the packet page breaks").toBeLessThan(composed.length);
  await style.evaluate((element) => element.remove());
  // Restored, the packet prints one page per surface again.
  expect((await printToPdf(page)).pdf.getPageCount()).toBe(composed.length);
});
