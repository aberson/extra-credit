// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { AppConfigV1, ChildProfileV1 } from "../../shared/config/schema";
import { App } from "../App";
import { ConfigApiError, resetSessionForTests } from "../api/client";
import { ProfileEditor } from "./ProfileEditor";

const canonicalSixYearOld: ChildProfileV1 = {
  id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
  displayName: "Morgan",
  ageYears: 6,
  presentationBand: "early-primary",
  reviewedOn: "2026-08-22",
  mathSkills: {
    countingMax: 20,
    numeralMax: 20,
    compareMax: 20,
    representations: ["quantities", "equations"],
    understandsEquality: true,
    operations: ["addition", "subtraction"],
    operandMax: 10,
    resultMax: 10,
    allowRegrouping: false,
    allowNegativeResults: false,
  },
  writingMode: "sentence-frame",
  interests: ["nature", "vehicles"],
};

const canonicalEightYearOld: ChildProfileV1 = {
  id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
  displayName: "Avery",
  ageYears: 8,
  presentationBand: "early-primary",
  reviewedOn: "2026-08-22",
  mathSkills: {
    countingMax: 20,
    numeralMax: 20,
    compareMax: 20,
    representations: ["quantities", "equations"],
    understandsEquality: true,
    operations: ["addition", "subtraction"],
    operandMax: 20,
    resultMax: 20,
    allowRegrouping: false,
    allowNegativeResults: false,
  },
  writingMode: "independent",
  interests: ["sports", "nature"],
};

const defaults: AppConfigV1["defaults"] = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

function configWithProfiles(profiles: readonly ChildProfileV1[]): AppConfigV1 {
  return { schemaVersion: 1, profiles: [...profiles], defaults };
}

function configResponse(config: AppConfigV1, etag: string): Response {
  return new Response(JSON.stringify({ config }), {
    headers: { "Content-Type": "application/json", ETag: etag },
    status: 200,
  });
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

async function drainScheduledWork(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  resetSessionForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderNew(
  onSubmit = vi.fn(async (profile: ChildProfileV1) => {
    void profile;
  }),
) {
  render(
    <ProfileEditor
      onCancel={() => undefined}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

async function enterAge(age: number): Promise<void> {
  const user = userEvent.setup();
  const ageInput = screen.getByRole("spinbutton", { name: "Age in years" });
  await user.clear(ageInput);
  await user.type(ageInput, String(age));
}

function expandedValue(term: string): string {
  const label = screen.getByText(term);
  const value = label.nextElementSibling;
  if (value === null) {
    throw new Error("The expanded capability value was missing.");
  }
  return value.textContent ?? "";
}

describe("ProfileEditor form behavior", () => {
  for (const fixture of [
    {
      age: 4,
      checked: "Quantities to 10",
      counts: "10 / 10 / 10",
      operandResult: "0 / 0",
    },
    {
      age: 6,
      checked: "Early primary within 10",
      counts: "20 / 20 / 20",
      operandResult: "10 / 10",
    },
    {
      age: 7,
      checked: "Early primary within 10",
      counts: "20 / 20 / 20",
      operandResult: "10 / 10",
    },
    {
      age: 8,
      checked: "Early primary within 20",
      counts: "20 / 20 / 20",
      operandResult: "20 / 20",
    },
  ] as const) {
    test(`shows the complete exact age-${fixture.age} suggestion`, async () => {
      renderNew();
      await enterAge(fixture.age);

      expect(screen.getByRole("radio", { name: fixture.checked })).toBeChecked();
      expect(expandedValue("Counting / numeral / compare")).toBe(fixture.counts);
      expect(expandedValue("Operand / result maximum")).toBe(fixture.operandResult);
      expect(screen.getByRole("button", { name: "Confirm suggested capabilities" })).toBeEnabled();
    });
  }

  test("leaves both age-five suggestions unselected until the parent chooses", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await enterAge(5);

    expect(screen.getByRole("radio", { name: "Quantities to 10" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Emerging equations within 5" })).not.toBeChecked();
    expect(screen.getByText(/neither is selected for you/i)).toBeVisible();

    await user.click(screen.getByRole("radio", { name: "Preschool" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("confirm a capability preset");

    await user.click(screen.getByRole("radio", { name: "Emerging equations within 5" }));
    await user.click(screen.getByRole("radio", { name: "Preschool" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      ageYears: 5,
      presentationBand: "preschool",
      mathSkills: {
        countingMax: 10,
        numeralMax: 10,
        compareMax: 10,
        representations: ["quantities", "equations"],
        understandsEquality: false,
        operations: ["addition"],
        operandMax: 5,
        resultMax: 5,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
    });
  });

  test("submits the exact expanded age-four preset after explicit confirmation", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await enterAge(4);
    await user.click(screen.getByRole("button", { name: "Confirm suggested capabilities" }));
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "  Riley  ");
    await user.type(
      screen.getByRole("textbox", { name: /Broad interests/ }),
      " animals, space ",
    );
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0];
    expect(submitted).toMatchObject({
      displayName: "Riley",
      ageYears: 4,
      presentationBand: "preschool",
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
      interests: ["animals", "space"],
    });
  });

  test("retains age nine as unsupported after a parent chooses capabilities", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await enterAge(9);
    expect(screen.getByText(/generation is not yet supported for age 9/i)).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Quantities to 10" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      ageYears: 9,
      presentationBand: "preschool",
      mathSkills: { operandMax: 0, resultMax: 0 },
    });
  });

  for (const age of [3, 19]) {
    test(`rejects age ${age} without submitting`, async () => {
      const onSubmit = renderNew();
      await enterAge(age);
      const ageInput = screen.getByRole("spinbutton", { name: "Age in years" });
      expect(ageInput).toBeInvalid();
      await userEvent.setup().click(screen.getByRole("button", { name: "Save profile" }));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  }

  test("age changes never alter capabilities loaded as parent-confirmed", async () => {
    const onSubmit = vi.fn(async (profile: ChildProfileV1) => {
      void profile;
    });
    render(
      <ProfileEditor
        onCancel={() => undefined}
        onSubmit={onSubmit}
        profile={canonicalSixYearOld}
      />,
    );
    const user = userEvent.setup();
    const ageInput = screen.getByRole("spinbutton", { name: "Age in years" });
    await user.clear(ageInput);
    await user.type(ageInput, "8");
    await user.clear(ageInput);
    await user.type(ageInput, "9");

    expect(screen.getByRole("radio", { name: "Early primary within 10" })).toBeChecked();
    expect(expandedValue("Operand / result maximum")).toBe("10 / 10");
    expect(screen.getByRole("radio", { name: "Early primary" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...canonicalSixYearOld,
      ageYears: 9,
    });
  });

  test("turns edited advanced fields into a canonical custom capability set", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await enterAge(6);
    await user.click(screen.getByRole("button", { name: "Confirm suggested capabilities" }));
    await user.click(screen.getByRole("radio", { name: "Custom capabilities" }));
    const operations = within(screen.getByRole("group", { name: "Operations" }));
    await user.click(operations.getByRole("checkbox", { name: "subtraction" }));

    expect(screen.getByRole("radio", { name: "Custom capabilities" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].mathSkills.operations).toEqual(["addition"]);
  });

  test("disables browser autocomplete for every free-text profile field", () => {
    renderNew();
    expect(screen.getByRole("textbox", { name: "Nickname (optional)" })).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("textbox", { name: /Broad interests/ })).toHaveAttribute("autocomplete", "off");
  });

  test("keeps every draft field after a non-conflict write failure", async () => {
    const onSubmit = vi.fn(async () => {
      throw new ConfigApiError(
        "CONFIG_IO_ERROR",
        "The local profile file could not be accessed safely.",
        503,
      );
    });
    renderNew(onSubmit);
    const user = userEvent.setup();
    await enterAge(6);
    await user.click(screen.getByRole("button", { name: "Confirm suggested capabilities" }));
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "Preserved Draft");
    await user.selectOptions(screen.getByRole("combobox", { name: "Writing mode" }), "sentence-frame");
    await user.type(screen.getByRole("textbox", { name: /Broad interests/ }), "nature, vehicles");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("unsaved changes are still here");
    expect(screen.getByRole("textbox", { name: "Nickname (optional)" })).toHaveValue("Preserved Draft");
    expect(screen.getByRole("spinbutton", { name: "Age in years" })).toHaveValue(6);
    expect(screen.getByRole("combobox", { name: "Writing mode" })).toHaveValue("sentence-frame");
    expect(screen.getByRole("textbox", { name: /Broad interests/ })).toHaveValue("nature, vehicles");
    expect(screen.getByRole("radio", { name: "Early primary within 10" })).toBeChecked();
  });

  for (const fixture of [
    {
      label: "just before an ordinary nine-month anniversary",
      now: "2026-08-22T23:59:59.999Z",
      reviewedOn: "2025-11-23",
      visible: false,
    },
    {
      label: "exactly at an ordinary nine-month anniversary",
      now: "2026-08-23T00:00:00.000Z",
      reviewedOn: "2025-11-23",
      visible: true,
    },
    {
      label: "just after an ordinary nine-month anniversary",
      now: "2026-08-23T00:00:00.001Z",
      reviewedOn: "2025-11-23",
      visible: true,
    },
    {
      label: "just before a clamped month-end anniversary",
      now: "2026-02-27T23:59:59.999Z",
      reviewedOn: "2025-05-31",
      visible: false,
    },
    {
      label: "exactly at a clamped month-end anniversary",
      now: "2026-02-28T00:00:00.000Z",
      reviewedOn: "2025-05-31",
      visible: true,
    },
    {
      label: "just after a clamped month-end anniversary",
      now: "2026-02-28T00:00:00.001Z",
      reviewedOn: "2025-05-31",
      visible: true,
    },
  ] as const) {
    test(`handles the review reminder ${fixture.label}`, async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(fixture.now));
      const onSubmit = vi.fn(async () => undefined);
      render(
        <ProfileEditor
          onCancel={() => undefined}
          onSubmit={onSubmit}
          profile={{ ...canonicalSixYearOld, reviewedOn: fixture.reviewedOn }}
        />,
      );

      const reminder = screen.queryByText(/Nine months have passed/);
      if (fixture.visible) {
        expect(reminder).toBeVisible();
      } else {
        expect(reminder).not.toBeInTheDocument();
      }
      expect(screen.getByRole("radio", { name: "Early primary within 10" })).toBeChecked();
      expect(expandedValue("Operand / result maximum")).toBe("10 / 10");
      const save = screen.getByRole("button", { name: "Save profile" });
      expect(save).toBeEnabled();
      fireEvent.click(save);
      await drainScheduledWork();
      expect(onSubmit).toHaveBeenCalledWith({
        ...canonicalSixYearOld,
        reviewedOn: fixture.reviewedOn,
      });
    });
  }
});

describe("App profile authority behavior", () => {

  test("keeps a deferred delete authoritative and blocks a competing reload", async () => {
    const initialConfig = configWithProfiles([
      canonicalSixYearOld,
      canonicalEightYearOld,
    ]);
    const deletedConfig = configWithProfiles([
      { ...canonicalEightYearOld, displayName: "Avery from another tab" },
    ]);
    const pendingDelete = deferred<Response>();
    let configReads = 0;
    const putRequests: Array<{ config: AppConfigV1; ifMatch: string | null }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/health")) {
          return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify({ token: "fixture-token" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/config") && method === "GET") {
          configReads += 1;
          return configResponse(initialConfig, '"etag-initial"');
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          const config = JSON.parse(String(init?.body)) as AppConfigV1;
          putRequests.push({
            config,
            ifMatch: new Headers(init?.headers).get("If-Match"),
          });
          return putRequests.length === 1
            ? await pendingDelete.promise
            : configResponse(config, '"etag-after-explicit-save"');
        }
        throw new Error("Unexpected profile API request in deferred delete test.");
      }),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete Morgan" }));
    const addButton = screen.getByRole("button", { name: "Add profile" });
    const editButton = screen.getByRole("button", { name: "Edit Morgan" });
    const deleteButton = screen.getByRole("button", { name: "Delete Morgan" });
    const reloadButton = screen.getByRole("button", { name: "Reload saved profiles" });
    const confirmDelete = screen.getByRole("button", { name: "Confirm delete" });
    const keepProfile = screen.getByRole("button", { name: "Keep profile" });
    fireEvent.click(confirmDelete);
    await waitFor(() => expect(putRequests).toHaveLength(1));

    expect(addButton).toBeDisabled();
    expect(editButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(reloadButton).toBeDisabled();
    expect(confirmDelete).toBeDisabled();
    expect(keepProfile).toBeDisabled();
    fireEvent.click(reloadButton);
    fireEvent.click(editButton);
    fireEvent.click(confirmDelete);
    expect(screen.queryByRole("heading", { name: "Update this profile" })).not.toBeInTheDocument();
    expect(configReads).toBe(1);
    expect(putRequests).toHaveLength(1);

    await act(async () => {
      pendingDelete.resolve(configResponse(deletedConfig, '"etag-deleted"'));
      await pendingDelete.promise;
    });
    expect(
      await screen.findByRole("heading", { name: "Avery from another tab" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Morgan" })).not.toBeInTheDocument();
    expect(configReads).toBe(1);
    expect(putRequests).toHaveLength(1);
    expect(putRequests[0]?.config).toEqual(
      configWithProfiles([canonicalEightYearOld]),
    );
    expect(putRequests[0]?.ifMatch).toBe('"etag-initial"');

    await user.click(
      screen.getByRole("button", { name: "Edit Avery from another tab" }),
    );
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(
      await screen.findByRole("heading", { name: "Avery from another tab" }),
    ).toBeVisible();
    expect(putRequests).toHaveLength(2);
    expect(putRequests[1]?.ifMatch).toBe('"etag-deleted"');
  });

  test("blocks a confirmed delete while a deferred read owns the config authority", async () => {
    const initialConfig = configWithProfiles([
      canonicalSixYearOld,
      canonicalEightYearOld,
    ]);
    const pendingReload = deferred<Response>();
    let configReads = 0;
    let configPuts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/health")) {
          return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify({ token: "fixture-token" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/config") && method === "GET") {
          configReads += 1;
          return configReads === 1
            ? configResponse(initialConfig, '"etag-initial"')
            : await pendingReload.promise;
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          configPuts += 1;
        }
        throw new Error("Unexpected profile API request in read ownership test.");
      }),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete Morgan" }));
    const confirmDelete = screen.getByRole("button", { name: "Confirm delete" });
    fireEvent.click(screen.getByRole("button", { name: "Reload saved profiles" }));
    await waitFor(() => expect(configReads).toBe(2));
    expect(confirmDelete).toBeDisabled();
    fireEvent.click(confirmDelete);
    expect(configReads).toBe(2);
    expect(configPuts).toBe(0);

    await act(async () => {
      pendingReload.resolve(configResponse(initialConfig, '"etag-reloaded"'));
      await pendingReload.promise;
    });
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(configPuts).toBe(0);
  });

  test("reconciles a conflict onto the fresh revision without losing or auto-saving the draft", async () => {
    const initialConfig = configWithProfiles([
      canonicalSixYearOld,
      canonicalEightYearOld,
    ]);
    const externalSibling = {
      ...canonicalEightYearOld,
      displayName: "Avery from another tab",
      interests: ["nature", "music"],
    } satisfies ChildProfileV1;
    const latestConfig = configWithProfiles([
      {
        ...canonicalSixYearOld,
        displayName: "Morgan from another tab",
        interests: ["music"],
      },
      externalSibling,
    ]);
    const pendingReconciliation = deferred<Response>();
    const putRequests: Array<{ config: AppConfigV1; ifMatch: string | null }> = [];
    let configReads = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/health")) {
          return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify({ token: "fixture-token" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/config") && method === "GET") {
          configReads += 1;
          return configReads === 1
            ? configResponse(initialConfig, '"etag-initial"')
            : await pendingReconciliation.promise;
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          const config = JSON.parse(String(init?.body)) as AppConfigV1;
          putRequests.push({
            config,
            ifMatch: new Headers(init?.headers).get("If-Match"),
          });
          if (putRequests.length === 1) {
            return new Response(
              JSON.stringify({
                error: {
                  code: "CONFIG_CONFLICT",
                  message: "The profile file changed after it was loaded.",
                },
              }),
              { headers: { "Content-Type": "application/json" }, status: 409 },
            );
          }
          return configResponse(config, '"etag-saved"');
        }
        throw new Error("Unexpected profile API request in conflict test.");
      }),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit Morgan" }));
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    const age = screen.getByRole("spinbutton", { name: "Age in years" });
    const reviewed = screen.getByLabelText("Reviewed on");
    const interests = screen.getByRole("textbox", { name: /Broad interests/ });
    await user.clear(nickname);
    await user.type(nickname, "Morgan Unsaved Draft");
    await user.clear(age);
    await user.type(age, "7");
    await user.selectOptions(screen.getByRole("combobox", { name: "Writing mode" }), "independent");
    await user.clear(reviewed);
    await user.type(reviewed, "2026-01-15");
    await user.clear(interests);
    await user.type(interests, "art, music");
    await user.click(screen.getByRole("radio", { name: "Custom capabilities" }));
    await user.click(screen.getByRole("radio", { name: "Preschool" }));
    for (const [label, value] of [
      ["Counting maximum", "33"],
      ["Numeral maximum", "34"],
      ["Comparison maximum", "35"],
      ["Operand maximum", "9"],
      ["Result maximum", "12"],
    ] as const) {
      const input = screen.getByRole("spinbutton", { name: label });
      await user.clear(input);
      await user.type(input, value);
    }
    await user.click(screen.getByRole("checkbox", { name: "quantities" }));
    await user.click(screen.getByRole("checkbox", { name: "subtraction" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Parent confirms understanding of equality" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Retain future permission for regrouping" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Retain future permission for negative results" }),
    );

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await drainScheduledWork();
    expect(screen.getByRole("alert")).toHaveTextContent("Another tab saved newer profiles");
    expect(putRequests).toHaveLength(1);
    const reloadLatest = screen.getByRole("button", {
      name: "Load latest profiles and keep this draft",
    });
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    fireEvent.click(reloadLatest);
    await drainScheduledWork();
    expect(configReads).toBe(2);
    expect(putRequests).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();

    pendingReconciliation.resolve(configResponse(latestConfig, '"etag-latest"'));
    await drainScheduledWork();

    expect(screen.getByText(/Latest saved profiles loaded/)).toBeVisible();
    expect(putRequests).toHaveLength(1);
    expect(configReads).toBe(2);
    expect(nickname).toHaveValue("Morgan Unsaved Draft");
    expect(age).toHaveValue(7);
    expect(screen.getByRole("combobox", { name: "Writing mode" })).toHaveValue("independent");
    expect(reviewed).toHaveValue("2026-01-15");
    expect(interests).toHaveValue("art, music");
    expect(screen.getByRole("radio", { name: "Custom capabilities" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Preschool" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Counting maximum" })).toHaveValue(33);
    expect(screen.getByRole("spinbutton", { name: "Numeral maximum" })).toHaveValue(34);
    expect(screen.getByRole("spinbutton", { name: "Comparison maximum" })).toHaveValue(35);
    expect(screen.getByRole("spinbutton", { name: "Operand maximum" })).toHaveValue(9);
    expect(screen.getByRole("spinbutton", { name: "Result maximum" })).toHaveValue(12);
    expect(screen.getByRole("checkbox", { name: "quantities" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "equations" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "addition" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "subtraction" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Parent confirms understanding of equality" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Retain future permission for regrouping" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Retain future permission for negative results" }),
    ).toBeChecked();

    await drainScheduledWork();
    expect(putRequests).toHaveLength(1);

    const explicitSave = screen.getByRole("button", { name: "Save profile" });
    expect(explicitSave).toBeEnabled();
    fireEvent.click(explicitSave);
    await drainScheduledWork();
    expect(screen.getByRole("heading", { name: "Morgan Unsaved Draft" })).toBeVisible();
    expect(putRequests).toHaveLength(2);
    expect(putRequests[1]?.ifMatch).toBe('"etag-latest"');
    expect(putRequests[1]?.config.profiles[0]).toEqual({
      ...canonicalSixYearOld,
      displayName: "Morgan Unsaved Draft",
      ageYears: 7,
      presentationBand: "preschool",
      reviewedOn: "2026-01-15",
      mathSkills: {
        countingMax: 33,
        numeralMax: 34,
        compareMax: 35,
        representations: ["equations"],
        understandsEquality: false,
        operations: ["addition"],
        operandMax: 9,
        resultMax: 12,
        allowRegrouping: true,
        allowNegativeResults: true,
      },
      writingMode: "independent",
      interests: ["art", "music"],
    });
    expect(putRequests[1]?.config.profiles[1]).toEqual(externalSibling);
  });

  test("refreshes a stale session without replaying the failed mutation", async () => {
    const initialConfig = configWithProfiles([canonicalSixYearOld]);
    const freshSession = deferred<Response>();
    const putRequests: Array<{
      config: AppConfigV1;
      ifMatch: string | null;
      token: string | null;
    }> = [];
    let configReads = 0;
    let sessionReads = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/health")) {
          return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/session")) {
          sessionReads += 1;
          return sessionReads === 1
            ? new Response(JSON.stringify({ token: "stale-token" }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
              })
            : await freshSession.promise;
        }
        if (url.endsWith("/api/config") && method === "GET") {
          configReads += 1;
          return configResponse(initialConfig, '"etag-initial"');
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          const headers = new Headers(init?.headers);
          const config = JSON.parse(String(init?.body)) as AppConfigV1;
          putRequests.push({
            config,
            ifMatch: headers.get("If-Match"),
            token: headers.get("X-Extra-Credit-Token"),
          });
          if (putRequests.length === 1) {
            return new Response(
              JSON.stringify({
                error: {
                  code: "SESSION_TOKEN_INVALID",
                  message: "The local session token is invalid or expired.",
                },
              }),
              { headers: { "Content-Type": "application/json" }, status: 401 },
            );
          }
          return configResponse(config, '"etag-saved"');
        }
        throw new Error("Unexpected profile API request in session replay test.");
      }),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit Morgan" }));
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    await user.clear(nickname);
    await user.type(nickname, "Morgan after restart");

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await drainScheduledWork();
    expect(putRequests).toHaveLength(1);
    expect(sessionReads).toBe(2);
    expect(configReads).toBe(1);
    expect(nickname).toHaveValue("Morgan after restart");

    freshSession.resolve(
      new Response(JSON.stringify({ token: "fresh-token" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    await drainScheduledWork();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The local server restarted. Your unsaved changes are still here",
    );
    expect(putRequests).toHaveLength(1);
    expect(putRequests[0]).toMatchObject({
      ifMatch: '"etag-initial"',
      token: "stale-token",
    });

    await drainScheduledWork();
    expect(putRequests).toHaveLength(1);
    expect(configReads).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await drainScheduledWork();
    expect(putRequests).toHaveLength(2);
    expect(putRequests[1]).toMatchObject({
      ifMatch: '"etag-initial"',
      token: "fresh-token",
    });
    expect(screen.getByRole("heading", { name: "Morgan after restart" })).toBeVisible();
  });

  for (const readOutcome of ["valid", "missing"] as const) {
    test(`re-adopts ${readOutcome} authority after stale recovery without losing the draft`, async () => {
      const latestDefaults: AppConfigV1["defaults"] = {
        ...defaults,
        difficulty: "stretch",
        includeAnswerKey: false,
        paperSize: "a4",
      };
      const latestConfig: AppConfigV1 = {
        schemaVersion: 1,
        profiles: [canonicalEightYearOld],
        defaults: latestDefaults,
      };
      const putRequests: Array<{
        config: AppConfigV1;
        ifMatch: string | null;
        ifNoneMatch: string | null;
        recovery: string | null;
      }> = [];
      let configReads = 0;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const method = init?.method ?? "GET";
          if (url.endsWith("/api/health")) {
            return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
              headers: { "Content-Type": "application/json" },
              status: 200,
            });
          }
          if (url.endsWith("/api/session")) {
            return new Response(JSON.stringify({ token: "fixture-token" }), {
              headers: { "Content-Type": "application/json" },
              status: 200,
            });
          }
          if (url.endsWith("/api/config") && method === "GET") {
            configReads += 1;
            if (configReads === 1) {
              return new Response(
                JSON.stringify({
                  error: {
                    code: "CONFIG_INVALID",
                    message: "Invalid revision A was left unchanged.",
                  },
                }),
                {
                  headers: {
                    "Content-Type": "application/json",
                    ETag: '"invalid-a"',
                  },
                  status: 409,
                },
              );
            }
            if (readOutcome === "valid") {
              return configResponse(latestConfig, '"etag-latest-valid"');
            }
            return new Response(
              JSON.stringify({
                error: {
                  code: "CONFIG_NOT_FOUND",
                  message: "No saved profile file exists yet.",
                },
              }),
              { headers: { "Content-Type": "application/json" }, status: 404 },
            );
          }
          if (url.endsWith("/api/config") && method === "PUT") {
            const headers = new Headers(init?.headers);
            const config = JSON.parse(String(init?.body)) as AppConfigV1;
            putRequests.push({
              config,
              ifMatch: headers.get("If-Match"),
              ifNoneMatch: headers.get("If-None-Match"),
              recovery: headers.get("X-Extra-Credit-Recovery"),
            });
            if (putRequests.length === 1) {
              return new Response(
                JSON.stringify({
                  error: {
                    code: "CONFIG_RECOVERY_NOT_ALLOWED",
                    message: "The invalid file changed after recovery began.",
                  },
                }),
                { headers: { "Content-Type": "application/json" }, status: 409 },
              );
            }
            return configResponse(config, '"etag-saved"');
          }
          throw new Error("Unexpected profile API request in recovery re-adoption test.");
        }),
      );

      render(<App />);
      expect(
        await screen.findByRole("heading", {
          name: "The saved profile file needs attention",
        }),
      ).toBeVisible();
      const user = userEvent.setup();
      const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
      const age = screen.getByRole("spinbutton", { name: "Age in years" });
      const reviewed = screen.getByLabelText("Reviewed on");
      const interests = screen.getByRole("textbox", { name: /Broad interests/ });
      await user.type(nickname, `Recovery draft ${readOutcome}`);
      await user.type(age, "4");
      await user.click(
        screen.getByRole("button", { name: "Confirm suggested capabilities" }),
      );
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Writing mode" }),
        "copy-with-model",
      );
      await user.clear(reviewed);
      await user.type(reviewed, "2026-01-31");
      await user.type(interests, "art, music");
      await user.click(
        screen.getByRole("checkbox", {
          name: /I understand that Back up invalid file and replace/,
        }),
      );
      await user.click(
        screen.getByRole("button", { name: "Back up invalid file and replace" }),
      );

      expect(
        await screen.findByText(/The live file is no longer the invalid revision/),
      ).toBeVisible();
      expect(putRequests).toHaveLength(1);
      expect(putRequests[0]).toMatchObject({
        ifMatch: '"invalid-a"',
        ifNoneMatch: null,
        recovery: "backup-and-replace",
      });
      await user.click(
        screen.getByRole("button", {
          name: "Load latest profiles and keep this draft",
        }),
      );

      expect(await screen.findByText(/Latest saved profiles loaded/)).toBeVisible();
      expect(configReads).toBe(2);
      expect(putRequests).toHaveLength(1);
      expect(
        screen.queryByRole("heading", {
          name: "The saved profile file needs attention",
        }),
      ).not.toBeInTheDocument();
      expect(nickname).toHaveValue(`Recovery draft ${readOutcome}`);
      expect(age).toHaveValue(4);
      expect(reviewed).toHaveValue("2026-01-31");
      expect(interests).toHaveValue("art, music");
      expect(screen.getByRole("combobox", { name: "Writing mode" })).toHaveValue(
        "copy-with-model",
      );
      expect(screen.getByRole("radio", { name: "Quantities to 10" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Preschool" })).toBeChecked();
      expect(expandedValue("Counting / numeral / compare")).toBe("10 / 10 / 10");
      expect(expandedValue("Operand / result maximum")).toBe("0 / 0");

      await user.click(screen.getByRole("button", { name: "Save profile" }));
      await waitFor(() => expect(putRequests).toHaveLength(2));
      const explicitSave = putRequests[1];
      expect(explicitSave).toMatchObject(
        readOutcome === "valid"
          ? {
              ifMatch: '"etag-latest-valid"',
              ifNoneMatch: null,
              recovery: null,
            }
          : { ifMatch: null, ifNoneMatch: "*", recovery: null },
      );
      expect(
        explicitSave?.config.profiles.find(
          ({ displayName }) => displayName === `Recovery draft ${readOutcome}`,
        ),
      ).toMatchObject({
        ageYears: 4,
        presentationBand: "preschool",
        reviewedOn: "2026-01-31",
        writingMode: "copy-with-model",
        interests: ["art", "music"],
        mathSkills: {
          representations: ["quantities"],
          operations: [],
          operandMax: 0,
          resultMax: 0,
        },
      });
      if (readOutcome === "valid") {
        expect(explicitSave?.config.profiles[0]).toEqual(canonicalEightYearOld);
        expect(explicitSave?.config.defaults).toEqual(latestDefaults);
      } else {
        expect(explicitSave?.config.profiles).toHaveLength(1);
        expect(explicitSave?.config.defaults).toEqual(defaults);
      }
    });
  }

  test("revision-locks recovery confirmation during deferred invalid re-adoption", async () => {
    const pendingInvalidRead = deferred<Response>();
    let configReads = 0;
    let configPuts = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/health")) {
          return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify({ token: "fixture-token" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/config") && method === "GET") {
          configReads += 1;
          if (configReads === 1) {
            return new Response(
              JSON.stringify({
                error: {
                  code: "CONFIG_INVALID",
                  message: "Invalid revision A was left unchanged.",
                },
              }),
              {
                headers: {
                  "Content-Type": "application/json",
                  ETag: '"invalid-a"',
                },
                status: 409,
              },
            );
          }
          return await pendingInvalidRead.promise;
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          configPuts += 1;
          return new Response(
            JSON.stringify({
              error: {
                code: "CONFIG_CONFLICT",
                message: "The invalid file changed after recovery began.",
              },
            }),
            { headers: { "Content-Type": "application/json" }, status: 409 },
          );
        }
        throw new Error("Unexpected profile API request in invalid re-adoption test.");
      }),
    );

    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "The saved profile file needs attention",
      }),
    ).toBeVisible();
    const user = userEvent.setup();
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    const age = screen.getByRole("spinbutton", { name: "Age in years" });
    const confirmation = screen.getByRole("checkbox", {
      name: /I understand that Back up invalid file and replace/,
    });
    await user.type(nickname, "Invalid revision draft");
    await user.type(age, "4");
    await user.click(
      screen.getByRole("button", { name: "Confirm suggested capabilities" }),
    );
    await user.click(confirmation);
    await user.click(
      screen.getByRole("button", { name: "Back up invalid file and replace" }),
    );
    expect(
      await screen.findByText(/The live file is no longer the invalid revision/),
    ).toBeVisible();
    expect(configPuts).toBe(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Load latest profiles and keep this draft",
      }),
    );
    await waitFor(() => expect(configReads).toBe(2));
    expect(confirmation).toBeDisabled();
    expect(confirmation).toBeChecked();
    fireEvent.click(confirmation);
    expect(confirmation).toBeChecked();
    expect(configPuts).toBe(1);

    await act(async () => {
      pendingInvalidRead.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: "CONFIG_INVALID",
              message: "Invalid revision B must be replaced explicitly.",
            },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ETag: '"invalid-b"',
            },
            status: 409,
          },
        ),
      );
      await pendingInvalidRead.promise;
    });

    expect(await screen.findByText(/Latest saved profiles loaded/)).toBeVisible();
    expect(
      screen.getByText("Invalid revision B must be replaced explicitly."),
    ).toBeVisible();
    expect(confirmation).toBeEnabled();
    expect(confirmation).not.toBeChecked();
    expect(nickname).toHaveValue("Invalid revision draft");
    expect(age).toHaveValue(4);
    expect(screen.getByRole("radio", { name: "Quantities to 10" })).toBeChecked();
    expect(configPuts).toBe(1);
  });

  test("renders invalid-file recovery without a callback-driven update loop", async () => {
    const fetchCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        fetchCalls.push(url);
        if (url.endsWith("/api/health")) {
          return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify({ token: "fixture-token" }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            error: {
              code: "CONFIG_INVALID",
              message: "The saved profile file is invalid. It was left unchanged.",
            },
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ETag: '"sha256-fixture"',
            },
            status: 409,
          },
        );
      }),
    );

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "The saved profile file needs attention" }),
    ).toBeVisible();
    vi.useFakeTimers();
    await drainScheduledWork();
    expect(fetchCalls).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Set up a profile" })).toBeVisible();
  });
});
