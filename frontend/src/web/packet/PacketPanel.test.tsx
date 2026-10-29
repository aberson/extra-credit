// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import type { ChildProfileV2, WorksheetSelectionV2 } from "../../shared/config/schema";
import type { WorksheetType } from "../../shared/worksheet/types";
import { createWorksheetSessionForSeed } from "../generator/create-session";
import { AddToPacket, PACKET_SESSION_ONLY_TEXT, PacketPanel } from "./PacketPanel";
import {
  EMPTY_PACKET,
  PACKET_REFUSAL_MESSAGES,
  PACKET_SHEET_LIMIT,
  REMOVED_PROFILE_LABEL,
  packetReducer,
  type QueuedSheet,
} from "./packet-session";

afterEach(cleanup);

/* Every child here is fictional. */
const PROFILES: readonly ChildProfileV2[] = [
  {
    id: "c3000000-0000-4000-8000-000000000001",
    displayName: "Fictional Robin",
    reviewedOn: "2026-09-01",
    interests: [],
  },
  { id: "c3000000-0000-4000-8000-000000000002", reviewedOn: "2026-09-01", interests: [] },
];

let nextWorksheet = 0;

function sheetFor(profile: ChildProfileV2, worksheetType: WorksheetType): QueuedSheet {
  nextWorksheet += 1;
  const selection: WorksheetSelectionV2 = {
    ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
    worksheetType,
  };
  const created = createWorksheetSessionForSeed({ profile, selection }, nextWorksheet, {
    worksheetIdSource: () => `d4000000-0000-4000-8000-${String(nextWorksheet).padStart(12, "0")}`,
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return { document: created.session.document, profileId: profile.id, selection };
}

function threeSheets(): readonly QueuedSheet[] {
  const [first, second] = PROFILES as [ChildProfileV2, ChildProfileV2];
  return [
    sheetFor(first, "dry-math"),
    sheetFor(second, "number-bonds"),
    sheetFor(first, "clock-explorer"),
  ];
}

const THREE_LABELS = [
  "Sheet 1 · Dry Math · Addition and subtraction within 10 · for Fictional Robin · Standard",
  "Sheet 2 · Number Bonds · Missing number sentences, Addition within 10 · for Profile 2 · Standard",
  "Sheet 3 · Clock Explorer · for Fictional Robin",
];

function rowLabels(): readonly string[] {
  return screen
    .getAllByRole("listitem")
    .map((row) => row.querySelector("[data-packet-label]")?.textContent ?? "");
}

/** The panel's packet print props, with fresh handlers, for tests about its rows. */
function printProps() {
  return {
    keyPlacement: "grouped-end",
    onKeyPlacementChange: vi.fn(),
    onPaperChange: vi.fn(),
    onPreview: vi.fn(),
    paperSize: "letter",
  } as const;
}

/** The App's wiring in miniature: the real reducer behind the real panel. */
function Harness({
  initial,
  onPreview = () => undefined,
  profiles = PROFILES,
}: {
  readonly initial: readonly QueuedSheet[];
  readonly onPreview?: () => void;
  readonly profiles?: readonly ChildProfileV2[];
}) {
  const [packet, dispatch] = useReducer(
    packetReducer,
    initial.reduce((state, sheet) => packetReducer(state, { type: "add", sheet }), EMPTY_PACKET),
  );
  return (
    <>
      <PacketPanel
        keyPlacement={packet.keyPlacement}
        onKeyPlacementChange={(keyPlacement) => dispatch({ type: "setKeyPlacement", keyPlacement })}
        onMoveDown={(worksheetId) => dispatch({ type: "moveDown", worksheetId })}
        onMoveUp={(worksheetId) => dispatch({ type: "moveUp", worksheetId })}
        onPaperChange={(paperSize) => dispatch({ type: "setPaper", paperSize })}
        onPreview={onPreview}
        onRemove={(worksheetId) => dispatch({ type: "remove", worksheetId })}
        paperSize={packet.paperSize}
        profiles={profiles}
        sheets={packet.sheets}
      />
      <output data-state-paper={packet.paperSize} data-state-placement={packet.keyPlacement} />
    </>
  );
}

describe("PacketPanel", () => {
  test("rows render in queue order with their labels and named Move up, Move down and Remove", () => {
    const sheets = threeSheets();
    render(
      <PacketPanel
        onMoveDown={vi.fn()}
        onMoveUp={vi.fn()}
        onRemove={vi.fn()}
        profiles={PROFILES}
        sheets={sheets}
        {...printProps()}
      />,
    );
    const panel = screen.getByRole("region", { name: "Printable packet" });
    expect(rowLabels()).toEqual(THREE_LABELS);
    const rows = within(panel).getAllByRole("listitem");
    rows.forEach((row, index) => {
      const position = index + 1;
      expect(row).toHaveAttribute("data-worksheet-id", sheets[index]?.document.worksheetId);
      const up = within(row).getByRole("button", { name: `Move up sheet ${position}` });
      const down = within(row).getByRole("button", { name: `Move down sheet ${position}` });
      const remove = within(row).getByRole("button", { name: `Remove sheet ${position}` });
      expect(up).toHaveTextContent("Move up");
      expect(down).toHaveTextContent("Move down");
      expect(remove).toHaveTextContent("Remove");
      expect(up).toHaveProperty("disabled", index === 0);
      expect(down).toHaveProperty("disabled", index === rows.length - 1);
      expect(remove).toBeEnabled();
    });
  });

  test("the count and the session-only sentence come from their owners", () => {
    const { rerender } = render(
      <PacketPanel
        onMoveDown={vi.fn()}
        onMoveUp={vi.fn()}
        onRemove={vi.fn()}
        profiles={PROFILES}
        sheets={[]}
        {...printProps()}
      />,
    );
    expect(screen.getByText(`0 of ${PACKET_SHEET_LIMIT} sheets`)).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(PACKET_SESSION_ONLY_TEXT)).toBeInTheDocument();
    expect(PACKET_SESSION_ONLY_TEXT).toBe(
      "This packet is kept only until you close or reload this page.",
    );
    rerender(
      <PacketPanel
        onMoveDown={vi.fn()}
        onMoveUp={vi.fn()}
        onRemove={vi.fn()}
        profiles={PROFILES}
        sheets={threeSheets()}
        {...printProps()}
      />,
    );
    expect(screen.getByText(`3 of ${PACKET_SHEET_LIMIT} sheets`)).toBeInTheDocument();
    expect(screen.getByText(PACKET_SESSION_ONLY_TEXT)).toBeInTheDocument();
  });

  test("moving and removing reorder the rows and keep focus on the panel", async () => {
    const user = userEvent.setup();
    render(<Harness initial={threeSheets()} />);

    await user.click(screen.getByRole("button", { name: "Move up sheet 3" }));
    expect(rowLabels()).toEqual([
      THREE_LABELS[0],
      "Sheet 2 · Clock Explorer · for Fictional Robin",
      "Sheet 3 · Number Bonds · Missing number sentences, Addition within 10 · for Profile 2 · Standard",
    ]);
    // Focus stays with the moved sheet's Move up, now named for its new place.
    expect(screen.getByRole("button", { name: "Move up sheet 2" })).toHaveFocus();
    expect(screen.getByText("Sheet 3 moved to position 2.")).toHaveAttribute("aria-live", "polite");

    // At the top its Move up is disabled, so focus moves to its Move down.
    await user.click(screen.getByRole("button", { name: "Move up sheet 2" }));
    expect(rowLabels()[0]).toBe("Sheet 1 · Clock Explorer · for Fictional Robin");
    expect(screen.getByRole("button", { name: "Move down sheet 1" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Remove sheet 1" }));
    expect(rowLabels()).toEqual([
      THREE_LABELS[0],
      "Sheet 2 · Number Bonds · Missing number sentences, Addition within 10 · for Profile 2 · Standard",
    ]);
    expect(screen.getByRole("button", { name: "Remove sheet 1" })).toHaveFocus();
    expect(screen.getByText(`2 of ${PACKET_SHEET_LIMIT} sheets`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove sheet 2" }));
    expect(screen.getByRole("button", { name: "Remove sheet 1" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Remove sheet 1" }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Printable packet" })).toHaveFocus();
  });

  test("Paper and Answer keys choices drive the packet, and Preview packet is disabled while it is empty", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const empty = render(<Harness initial={[]} onPreview={onPreview} />);
    const preview = screen.getByRole("button", { name: "Preview packet" });
    expect(preview).toBeDisabled();
    // An empty packet offers no paper or key choice: its first sheet's paper is adopted.
    expect(screen.queryByRole("group", { name: "Paper" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Answer keys" })).toBeNull();

    empty.unmount();
    const { container } = render(<Harness initial={threeSheets()} onPreview={onPreview} />);
    const state = () => container.querySelector("output");
    const paper = screen.getByRole("group", { name: "Paper" });
    expect(within(paper).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "letter",
      "a4",
    ]);
    expect(within(paper).getByRole("radio", { name: "US Letter" })).toBeChecked();
    const keys = screen.getByRole("group", { name: "Answer keys" });
    expect(within(keys).getAllByRole("radio").map((radio) => radio.parentElement?.textContent)).toEqual([
      " All answer keys at the end",
      " Each key after its worksheet",
      " Leave out answer keys",
    ]);
    expect(within(keys).getByRole("radio", { name: "All answer keys at the end" })).toBeChecked();

    await user.click(within(paper).getByRole("radio", { name: "A4" }));
    expect(state()).toHaveAttribute("data-state-paper", "a4");
    expect(within(paper).getByRole("radio", { name: "A4" })).toBeChecked();
    await user.click(within(keys).getByRole("radio", { name: "Each key after its worksheet" }));
    expect(state()).toHaveAttribute("data-state-placement", "after-each-sheet");
    await user.click(within(keys).getByRole("radio", { name: "Leave out answer keys" }));
    expect(state()).toHaveAttribute("data-state-placement", "none");
    // Neither choice changes the rows.
    expect(rowLabels()).toEqual(THREE_LABELS);

    await user.click(screen.getByRole("button", { name: "Preview packet" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  test("after a profile is removed its queued sheets stay, labeled for a removed profile", () => {
    const sheets = threeSheets();
    const { rerender } = render(<Harness initial={sheets} />);
    expect(rowLabels()).toEqual(THREE_LABELS);
    const remaining = PROFILES.filter((profile) => profile.id !== PROFILES[0]?.id);
    rerender(<Harness initial={sheets} profiles={remaining} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(rowLabels()).toEqual([
      `Sheet 1 · Dry Math · Addition and subtraction within 10 · for ${REMOVED_PROFILE_LABEL} · Standard`,
      // The other child is now first in the list.
      "Sheet 2 · Number Bonds · Missing number sentences, Addition within 10 · for Profile 1 · Standard",
      `Sheet 3 · Clock Explorer · for ${REMOVED_PROFILE_LABEL}`,
    ]);
    expect(
      screen.getAllByRole("listitem").map((row) => row.getAttribute("data-worksheet-id")),
    ).toEqual(sheets.map((sheet) => sheet.document.worksheetId));
  });

  test("the panel adds no role=status element", () => {
    const { container } = render(<Harness initial={threeSheets()} />);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
  });
});

describe("AddToPacket", () => {
  test("Add is enabled below the limit and calls its handler", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddToPacket full={false} message={null} onAdd={onAdd} />);
    const add = screen.getByRole("button", { name: "Add to packet" });
    expect(add).toBeEnabled();
    expect(add).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(PACKET_REFUSAL_MESSAGES["packet-full"])).toBeNull();
    await user.click(add);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  test("Add is disabled with its visible reason at the limit", () => {
    render(<AddToPacket full message={null} onAdd={vi.fn()} />);
    const add = screen.getByRole("button", { name: "Add to packet" });
    expect(add).toBeDisabled();
    const reason = screen.getByText(PACKET_REFUSAL_MESSAGES["packet-full"]);
    expect(reason).toBeVisible();
    expect(add).toHaveAccessibleDescription(PACKET_REFUSAL_MESSAGES["packet-full"]);
    expect(reason.textContent).toBe(
      `The packet holds at most ${PACKET_SHEET_LIMIT} sheets. Remove a sheet to add another.`,
    );
  });

  test("the duplicate message is announced politely, without role=status", () => {
    const { container, rerender } = render(<AddToPacket full={false} message={null} onAdd={vi.fn()} />);
    const region = container.querySelector("[data-packet-add-message]");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
    rerender(
      <AddToPacket full={false} message={PACKET_REFUSAL_MESSAGES["already-in-packet"]} onAdd={vi.fn()} />,
    );
    // The same live region, mounted before the message, now holds it.
    expect(container.querySelector("[data-packet-add-message]")).toBe(region);
    expect(region).toHaveTextContent("This worksheet is already in the packet.");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
  });

  test("a full packet built by the reducer disables Add", () => {
    const sheets = Array.from({ length: PACKET_SHEET_LIMIT }, () =>
      sheetFor(PROFILES[0]!, "tally-detective"),
    );
    const packet = sheets.reduce(
      (state, sheet) => packetReducer(state, { type: "add", sheet }),
      EMPTY_PACKET,
    );
    render(
      <AddToPacket full={packet.sheets.length >= PACKET_SHEET_LIMIT} message={null} onAdd={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Add to packet" })).toBeDisabled();
  });
});
