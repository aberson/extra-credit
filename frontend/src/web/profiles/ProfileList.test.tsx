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
import type { WorksheetType } from "../../shared/worksheet/types";
import { createWorksheetSessionForSeed } from "../generator/create-session";
import { PacketPanel } from "../packet/PacketPanel";
import { EMPTY_PACKET, packetReducer, type QueuedSheet } from "../packet/packet-session";
import { ProfileList } from "./ProfileList";

afterEach(cleanup);

/* Every child here is fictional. */
const ROWAN: ChildProfileV2 = {
  id: "a9000000-0000-4000-8000-000000000001",
  displayName: "Fictional Rowan",
  reviewedOn: "2026-09-01",
  interests: [],
};
const SAGE: ChildProfileV2 = {
  id: "a9000000-0000-4000-8000-000000000002",
  displayName: "Fictional Sage",
  reviewedOn: "2026-09-01",
  interests: [],
};

const ONE_SENTENCE =
  "1 sheet in the printable packet was made for this profile. It stays in the packet, labeled for a removed profile.";
const THREE_SENTENCE =
  "3 sheets in the printable packet were made for this profile. They stay in the packet, labeled for a removed profile.";

let nextWorksheet = 0;

function sheetFor(profile: ChildProfileV2, worksheetType: WorksheetType): QueuedSheet {
  nextWorksheet += 1;
  const selection: WorksheetSelectionV2 = {
    ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
    worksheetType,
  };
  const created = createWorksheetSessionForSeed({ profile, selection }, nextWorksheet, {
    worksheetIdSource: () => `ba000000-0000-4000-8000-${String(nextWorksheet).padStart(12, "0")}`,
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return { document: created.session.document, profileId: profile.id, selection };
}

function renderList(queuedSheetCount?: (profileId: string) => number) {
  return render(
    <ProfileList
      onAdd={vi.fn()}
      onDelete={vi.fn(async () => undefined)}
      onEdit={vi.fn()}
      profiles={[ROWAN, SAGE]}
      {...(queuedSheetCount === undefined ? {} : { queuedSheetCount })}
    />,
  );
}

async function openDelete(name: string): Promise<HTMLElement> {
  await userEvent.setup().click(screen.getByRole("button", { name: `Delete ${name}` }));
  return screen.getByRole("alertdialog");
}

/** App's wiring in miniature: one profile list and one packet over the same session. */
function Harness({ initial }: { readonly initial: readonly QueuedSheet[] }) {
  const [profiles, setProfiles] = useState<readonly ChildProfileV2[]>([ROWAN, SAGE]);
  const [packet, dispatchPacket] = useReducer(
    packetReducer,
    initial.reduce((state, sheet) => packetReducer(state, { type: "add", sheet }), EMPTY_PACKET),
  );
  return (
    <>
      <ProfileList
        onAdd={vi.fn()}
        onDelete={async (profileId) => {
          setProfiles((current) => current.filter((profile) => profile.id !== profileId));
          return Promise.resolve();
        }}
        onEdit={vi.fn()}
        profiles={profiles}
        queuedSheetCount={(profileId) =>
          packet.sheets.filter((sheet) => sheet.profileId === profileId).length
        }
      />
      <PacketPanel
        keyPlacement={packet.keyPlacement}
        onKeyPlacementChange={(keyPlacement) => dispatchPacket({ type: "setKeyPlacement", keyPlacement })}
        onMoveDown={(worksheetId) => dispatchPacket({ type: "moveDown", worksheetId })}
        onMoveUp={(worksheetId) => dispatchPacket({ type: "moveUp", worksheetId })}
        onPaperChange={(paperSize) => dispatchPacket({ type: "setPaper", paperSize })}
        onPreview={vi.fn()}
        onRemove={(worksheetId) => dispatchPacket({ type: "remove", worksheetId })}
        paperSize={packet.paperSize}
        profiles={profiles}
        sheets={packet.sheets}
      />
    </>
  );
}

describe("ProfileList delete dialog and the printable packet", () => {
  test("names one queued sheet for the profile and says it stays", async () => {
    renderList((profileId) => (profileId === ROWAN.id ? 1 : 0));
    const dialog = await openDelete("Fictional Rowan");
    expect(within(dialog).getByText(ONE_SENTENCE)).toBeVisible();
  });

  test("names three queued sheets for the profile and says they stay", async () => {
    renderList((profileId) => (profileId === SAGE.id ? 3 : 1));
    const dialog = await openDelete("Fictional Sage");
    expect(within(dialog).getByText(THREE_SENTENCE)).toBeVisible();
    expect(within(dialog).queryByText(ONE_SENTENCE)).toBeNull();
  });

  test("says nothing about the packet when no sheet was made for the profile, or without a count", async () => {
    const counted = renderList(() => 0);
    let dialog = await openDelete("Fictional Rowan");
    expect(dialog.querySelectorAll("[data-delete-queued-sheets]")).toHaveLength(0);
    expect(within(dialog).queryByText(/printable packet/u)).toBeNull();
    const zeroMarkup = dialog.innerHTML;
    counted.unmount();

    renderList();
    dialog = await openDelete("Fictional Rowan");
    expect(dialog.querySelectorAll("[data-delete-queued-sheets]")).toHaveLength(0);
    // With no queued sheet the dialog is exactly the one without a packet.
    expect(dialog.innerHTML).toBe(zeroMarkup);
  });

  test("after the profile is deleted its queued sheets stay, labeled for a removed profile", async () => {
    const user = userEvent.setup();
    const sheets = [
      sheetFor(ROWAN, "dry-math"),
      sheetFor(SAGE, "clock-explorer"),
      sheetFor(ROWAN, "tally-detective"),
      sheetFor(ROWAN, "operation-grid"),
    ];
    render(<Harness initial={sheets} />);
    const dialog = await openDelete("Fictional Rowan");
    expect(within(dialog).getByText(THREE_SENTENCE)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Confirm delete" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Fictional Rowan" })).toBeNull();

    const rows = [...document.querySelectorAll("[data-packet-row]")];
    expect(rows.map((row) => row.getAttribute("data-worksheet-id"))).toEqual(
      sheets.map((sheet) => sheet.document.worksheetId),
    );
    expect(rows.map((row) => row.querySelector("[data-packet-label]")?.textContent)).toEqual([
      "Sheet 1 · Dry Math · Addition and subtraction within 10 · for a removed profile · Standard",
      "Sheet 2 · Clock Explorer · for Fictional Sage",
      "Sheet 3 · Tally Detective · for a removed profile",
      expect.stringMatching(/^Sheet 4 · Operation Grid · .+ · for a removed profile$/u),
    ]);
    expect(screen.getByText("4 of 10 sheets")).toBeInTheDocument();
  });
});
