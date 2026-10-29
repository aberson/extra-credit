// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import type { ChildProfileV2, WorksheetSelectionV2 } from "../../shared/config/schema";
import { composePacketPages, type PacketKeyPlacement } from "../../shared/packet/compose";
import { getWorksheetRegistration } from "../../shared/worksheet/registry";
import type { PaperSize, WorksheetDocumentV1, WorksheetType } from "../../shared/worksheet/types";
import { createWorksheetSessionForSeed } from "../generator/create-session";
import { AnswerKeyView } from "../print/AnswerKeyView";
import { PacketPanel } from "./PacketPanel";
import { PacketPrintView } from "./PacketPrintView";
import {
  EMPTY_PACKET,
  packetReducer,
  type PacketAction,
  type PacketState,
  type QueuedSheet,
} from "./packet-session";

afterEach(cleanup);

/* Every child here is fictional. */
const NAMED: ChildProfileV2 = {
  id: "a7000000-0000-4000-8000-000000000001",
  displayName: "Fictional Juniper",
  reviewedOn: "2026-09-01",
  interests: ["animals"],
};
const UNNAMED: ChildProfileV2 = {
  id: "a7000000-0000-4000-8000-000000000002",
  reviewedOn: "2026-09-01",
  interests: [],
};
const PROFILES = [NAMED, UNNAMED] as const;

let nextWorksheet = 0;

function sheetFor(
  profile: ChildProfileV2,
  change: Partial<WorksheetSelectionV2> & { readonly worksheetType: WorksheetType },
): QueuedSheet {
  nextWorksheet += 1;
  const selection: WorksheetSelectionV2 = {
    ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
    ...change,
  };
  const created = createWorksheetSessionForSeed({ profile, selection }, nextWorksheet, {
    worksheetIdSource: () => `b8000000-0000-4000-8000-${String(nextWorksheet).padStart(12, "0")}`,
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return { document: created.session.document, profileId: profile.id, selection };
}

/**
 * Six sheets on mixed stored papers and scales: a keyless Sentence Builder,
 * a sheet that asked for no key, and three keyed families with their own key
 * renderers.
 */
function mixedSheets(): readonly QueuedSheet[] {
  return [
    sheetFor(NAMED, { worksheetType: "dry-math", paperSize: "letter", printScale: "large" }),
    sheetFor(UNNAMED, { worksheetType: "sentence-builder", paperSize: "a4" }),
    sheetFor(NAMED, { worksheetType: "operation-grid", paperSize: "a4", printScale: "large" }),
    sheetFor(NAMED, { worksheetType: "number-bonds", includeAnswerKey: false }),
    sheetFor(UNNAMED, { worksheetType: "clock-explorer", printScale: "large" }),
    sheetFor(NAMED, { worksheetType: "tally-detective", paperSize: "a4" }),
  ];
}

function surfaces(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-packet-page]")];
}

function pageCodes(container: HTMLElement): readonly string[] {
  return surfaces(container).map(
    (surface) => `${surface.dataset.surface}:${surface.dataset.sheetId ?? ""}`,
  );
}

function composedCodes(sheets: readonly QueuedSheet[], placement: PacketKeyPlacement): readonly string[] {
  return composePacketPages(sheets, placement).map(
    (page) => `${page.surface}:${page.sheet.document.worksheetId}`,
  );
}

/** App's wiring in miniature: the real reducer behind the real panel and the packet preview. */
function Harness({
  initial,
  onAction,
}: {
  readonly initial: readonly QueuedSheet[];
  readonly onAction: (action: PacketAction, state: PacketState) => void;
}) {
  const [packet, dispatchPacket] = useReducer(
    (state: PacketState, action: PacketAction) => {
      const next = packetReducer(state, action);
      onAction(action, next);
      return next;
    },
    initial.reduce((state, sheet) => packetReducer(state, { type: "add", sheet }), EMPTY_PACKET),
  );
  const [open, setOpen] = useState(true);
  return (
    <>
      <PacketPanel
        keyPlacement={packet.keyPlacement}
        onKeyPlacementChange={(keyPlacement) => dispatchPacket({ type: "setKeyPlacement", keyPlacement })}
        onMoveDown={(worksheetId) => dispatchPacket({ type: "moveDown", worksheetId })}
        onMoveUp={(worksheetId) => dispatchPacket({ type: "moveUp", worksheetId })}
        onPaperChange={(paperSize) => dispatchPacket({ type: "setPaper", paperSize })}
        onPreview={() => setOpen(true)}
        onRemove={(worksheetId) => dispatchPacket({ type: "remove", worksheetId })}
        paperSize={packet.paperSize}
        profiles={PROFILES}
        sheets={packet.sheets}
      />
      {open && (
        <PacketPrintView
          keyPlacement={packet.keyPlacement}
          onBack={() => setOpen(false)}
          paperSize={packet.paperSize}
          sheets={packet.sheets}
        />
      )}
    </>
  );
}

function view(sheets: readonly QueuedSheet[], paperSize: PaperSize, keyPlacement: PacketKeyPlacement = "grouped-end") {
  return (
    <PacketPrintView keyPlacement={keyPlacement} onBack={vi.fn()} paperSize={paperSize} sheets={sheets} />
  );
}

describe("PacketPrintView", () => {
  test("pages render in composed order, on the packet paper, at each sheet's stored scale", () => {
    const sheets = mixedSheets();
    for (const placement of ["grouped-end", "after-each-sheet", "none"] as const) {
      for (const paperSize of ["letter", "a4"] as const) {
        const { container, unmount } = render(view(sheets, paperSize, placement));
        expect(pageCodes(container)).toEqual(composedCodes(sheets, placement));
        const pages = composePacketPages(sheets, placement);
        surfaces(container).forEach((surface, index) => {
          const stored = pages[index]?.sheet.document;
          expect(surface).toHaveClass("print-surface");
          expect(surface).toHaveAttribute("data-packet-page", String(index + 1));
          expect(surface).toHaveAttribute("data-paper-size", paperSize);
          expect(surface).toHaveAttribute("data-print-scale", stored?.request.options.printScale);
        });
        expect(container.querySelectorAll(".print-workspace")).toHaveLength(1);
        expect(
          screen.getByRole("button", { name: `Print packet (${pages.length} pages)` }),
        ).toBeInTheDocument();
        unmount();
      }
    }
    // Grouped-end, the default: six worksheets, then the four keyed sheets' keys in sheet order.
    const { container } = render(view(sheets, "letter"));
    const ids = sheets.map((sheet) => sheet.document.worksheetId);
    expect(pageCodes(container)).toEqual([
      ...ids.map((id) => `worksheet:${id}`),
      ...[ids[0], ids[2], ids[4], ids[5]].map((id) => `answer:${id ?? ""}`),
    ]);
    // Each worksheet page shows its stored items.
    surfaces(container).slice(0, sheets.length).forEach((surface, index) => {
      const document = sheets[index]?.document as WorksheetDocumentV1;
      expect(surface.querySelector("[data-seed]")).toHaveAttribute("data-seed", document.seed);
      expect(surface.querySelectorAll(":scope [data-item-id]").length).toBeGreaterThanOrEqual(
        document.items.length,
      );
    });
    // Worksheet and key surfaces of one sheet share no element id.
    const elementIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(elementIds).size).toBe(elementIds.length);
  });

  test("the heading takes focus and every key heading names its sheet", () => {
    const sheets = mixedSheets();
    const { container } = render(view(sheets, "a4"));
    expect(screen.getByRole("heading", { name: "Packet preview" })).toHaveFocus();
    const keys = surfaces(container).filter((surface) => surface.dataset.surface === "answer");
    expect(keys.map((surface) => surface.querySelector("h2")?.textContent)).toEqual([
      "Parent answer key — Sheet 1 · Dry Math · for Fictional Juniper",
      "Parent answer key — Sheet 3 · Operation Grid · for Fictional Juniper",
      "Parent answer key — Sheet 5 · Clock Explorer",
      "Parent answer key — Sheet 6 · Tally Detective · for Fictional Juniper",
    ]);
    for (const key of keys) {
      expect(key.querySelectorAll("h2 > span[data-packet-sheet-label]")).toHaveLength(1);
    }
    // No worksheet page carries a sheet label.
    expect(
      surfaces(container)
        .filter((surface) => surface.dataset.surface === "worksheet")
        .flatMap((surface) => [...surface.querySelectorAll("[data-packet-sheet-label]")]),
    ).toEqual([]);
  });

  test("a random packet's notice shows under the heading on screen only, and no notice shows nothing", () => {
    const sheets = mixedSheets();
    const { container, rerender } = render(view(sheets, "letter"));
    expect(container.querySelector("[data-packet-preview-notice]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Packet preview" })).not.toHaveAttribute("aria-describedby");
    rerender(
      <PacketPrintView
        keyPlacement="grouped-end"
        notice="Added 6 random sheets to the packet."
        onBack={vi.fn()}
        paperSize="letter"
        sheets={sheets}
      />,
    );
    const notice = container.querySelector("[data-packet-preview-notice]");
    expect(notice).toHaveTextContent("Added 6 random sheets to the packet.");
    expect(notice?.closest(".print-controls")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Packet preview" })).toHaveAccessibleDescription(
      "Added 6 random sheets to the packet.",
    );
  });

  test("changing the packet paper re-renders every page and leaves every stored document deep-equal", async () => {
    const user = userEvent.setup();
    const sheets = mixedSheets();
    const snapshots = sheets.map((sheet) => structuredClone(sheet.document));
    const actions: PacketAction[] = [];
    let latest: PacketState | undefined;
    const { container } = render(
      <Harness
        initial={sheets}
        onAction={(action, state) => {
          actions.push(action);
          latest = state;
        }}
      />,
    );
    // The packet adopted its first sheet's paper.
    expect(surfaces(container).every((surface) => surface.dataset.paperSize === "letter")).toBe(true);
    const before = surfaces(container).map((surface) => surface.querySelector("[data-item-id]")?.textContent);
    await user.click(within(screen.getByRole("group", { name: "Paper" })).getByRole("radio", { name: "A4" }));
    expect(actions).toEqual([{ type: "setPaper", paperSize: "a4" }]);
    expect(surfaces(container).every((surface) => surface.dataset.paperSize === "a4")).toBe(true);
    expect(surfaces(container).map((surface) => surface.dataset.printScale)).toEqual(
      composePacketPages(sheets, "grouped-end").map((page) => page.sheet.document.request.options.printScale),
    );
    // The same problems print on the new paper.
    expect(surfaces(container).map((surface) => surface.querySelector("[data-item-id]")?.textContent)).toEqual(before);
    expect(latest?.sheets.map((sheet) => sheet.document)).toEqual(snapshots);
    latest?.sheets.forEach((sheet, index) => expect(sheet.document).toBe(sheets[index]?.document));
    expect(sheets.map((sheet) => sheet.document)).toEqual(snapshots);
  });

  test("Print packet calls window.print once and Back returns without changing the queue", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const sheets = mixedSheets();
    const actions: PacketAction[] = [];
    render(<Harness initial={sheets} onAction={(action) => actions.push(action)} />);
    const ids = () =>
      [...document.querySelectorAll("[data-packet-row]")].map((row) => row.getAttribute("data-worksheet-id"));
    const queued = ids();

    await user.click(screen.getByRole("button", { name: "Print packet (10 pages)" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([]);
    expect(ids()).toEqual(queued);
    expect(screen.getByText("6 of 10 sheets")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to worksheets" }));
    expect(screen.queryByRole("heading", { name: "Packet preview" })).toBeNull();
    expect(print).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([]);
    expect(ids()).toEqual(queued);
    expect(queued).toEqual(sheets.map((sheet) => sheet.document.worksheetId));
  });
});

describe("AnswerKeyView sheetLabel", () => {
  const keyed = [
    "dry-math",
    "find-the-wow",
    "count-compare-make",
    "number-bonds",
    "operation-grid",
    "clock-explorer",
    "tally-detective",
  ] as const satisfies readonly WorksheetType[];

  test("every keyed family is listed, and only Sentence Builder has no key", () => {
    const withKeys = (
      ["dry-math", "find-the-wow", "sentence-builder", "count-compare-make", "number-bonds",
        "operation-grid", "clock-explorer", "tally-detective"] as const
    ).filter((type) => getWorksheetRegistration(type).hasAnswerKey);
    expect(withKeys).toEqual(keyed);
  });

  test.each(keyed)("a %s key heading carries the label only with sheetLabel, and is otherwise unchanged", (worksheetType) => {
    const { document } = sheetFor(NAMED, { worksheetType });
    const label = `Sheet 4 · ${getWorksheetRegistration(worksheetType).displayName} · for Fictional Juniper`;
    const plain = render(<AnswerKeyView document={document} />);
    const plainMarkup = plain.container.innerHTML;
    const plainHeading = plain.container.querySelector("h2");
    expect(plainHeading?.outerHTML).toBe(
      `<h2 id="worksheet-${document.worksheetId}-answer-title">Parent answer key</h2>`,
    );
    expect(plain.container.querySelectorAll("[data-packet-sheet-label]")).toHaveLength(0);
    plain.unmount();

    const labeled = render(<AnswerKeyView document={document} sheetLabel={label} />);
    const heading = labeled.container.querySelector("h2");
    const spans = labeled.container.querySelectorAll("span[data-packet-sheet-label]");
    expect(spans).toHaveLength(1);
    expect(spans[0]?.parentElement).toBe(heading);
    expect(spans[0]).toHaveTextContent(label);
    expect(heading).toHaveTextContent(`Parent answer key — ${label}`);
    expect(screen.getByRole("heading", { name: `Parent answer key — ${label}` })).toBe(heading);
    // Remove the label and its separator and the markup is the plain key's.
    expect(spans[0]?.previousSibling?.textContent).toBe(" — ");
    spans[0]?.previousSibling?.remove();
    spans[0]?.remove();
    heading?.normalize();
    expect(labeled.container.innerHTML).toBe(plainMarkup);
  });
});
