// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WORKSHEET_TYPE_IDS } from "../../shared/worksheet/types";
import { PACKET_SHEET_LIMIT } from "./packet-session";
import { DEFAULT_RANDOM_PACKET_PAGES, RandomPacketForm } from "./RandomPacketForm";

afterEach(cleanup);

function renderForm(room: number = PACKET_SHEET_LIMIT, disabled = false, childChosen = true) {
  const onMake = vi.fn();
  render(
    <RandomPacketForm childChosen={childChosen} disabled={disabled} message={null} onMake={onMake} room={room} />,
  );
  return { onMake, region: screen.getByRole("region", { name: "Random packet" }) };
}

const makeButton = () => screen.getByRole("button", { name: "Make random packet" });

describe("RandomPacketForm", () => {
  test("starts with every family ticked, five pages and Medium, and makes that packet", async () => {
    const { onMake, region } = renderForm();
    const boxes = within(region).getAllByRole("checkbox");
    expect(boxes).toHaveLength(WORKSHEET_TYPE_IDS.length);
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("combobox", { name: "Pages" })).toHaveValue(String(DEFAULT_RANDOM_PACKET_PAGES));
    expect(screen.getByRole("radio", { name: /^Medium/u })).toBeChecked();
    await userEvent.click(makeButton());
    expect(onMake).toHaveBeenCalledWith({
      families: WORKSHEET_TYPE_IDS,
      pages: DEFAULT_RANDOM_PACKET_PAGES,
      level: "medium",
    });
  });

  test("passes the ticked families in registry order, the chosen pages and difficulty", async () => {
    const { onMake } = renderForm();
    for (const name of ["Dry Math", "Sentence Builder", "Operation Grid", "Clock Explorer", "Tally Detective"]) {
      await userEvent.click(screen.getByRole("checkbox", { name }));
    }
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pages" }), "8");
    await userEvent.click(screen.getByRole("radio", { name: /^Harder/u }));
    await userEvent.click(makeButton());
    expect(onMake).toHaveBeenCalledWith({
      families: ["find-the-wow", "count-compare-make", "number-bonds"],
      pages: 8,
      level: "harder",
    });
  });

  test("offers at most the packet's room and is disabled, with its reason, when nothing can be added", async () => {
    const { onMake } = renderForm(3);
    const pages = screen.getByRole("combobox", { name: "Pages" });
    expect(within(pages).getAllByRole("option").map((option) => option.textContent)).toEqual(["1", "2", "3"]);
    expect(pages).toHaveValue("3");
    for (const box of screen.getAllByRole("checkbox")) {
      await userEvent.click(box);
    }
    expect(makeButton()).toBeDisabled();
    expect(makeButton()).toHaveAccessibleDescription("Tick at least one worksheet to include.");
    cleanup();

    renderForm(0);
    expect(makeButton()).toBeDisabled();
    expect(makeButton()).toHaveAccessibleDescription(
      `The packet already holds ${PACKET_SHEET_LIMIT} sheets. Remove a sheet to add more.`,
    );
    expect(onMake).not.toHaveBeenCalled();
  });

  test("is disabled while the app is busy", () => {
    renderForm(PACKET_SHEET_LIMIT, true);
    expect(makeButton()).toBeDisabled();
  });

  test("is disabled, with its reason, while no child is chosen", () => {
    renderForm(PACKET_SHEET_LIMIT, false, false);
    expect(makeButton()).toBeDisabled();
    expect(makeButton()).toHaveAccessibleDescription("Add a child profile first.");
  });

  test("shows the last outcome in a polite live region", () => {
    const text = "Operation Grid cannot be made with the current choices.";
    render(<RandomPacketForm childChosen disabled={false} message={text} onMake={vi.fn()} room={5} />);
    const message = screen.getByText(text);
    expect(message).toHaveAttribute("aria-live", "polite");
    expect(message).not.toHaveAttribute("role");
  });
});
