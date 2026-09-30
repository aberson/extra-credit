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

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  cloneWorksheetDefaults,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import { selectionFromEarlierSettings } from "../../shared/config/earlier-settings";
import {
  MathSkillsV1Schema,
  type AppConfigV2,
  type ChildProfileV2,
  type StoredSchemaVersion,
  type WorksheetDefaultsV2,
} from "../../shared/config/schema";
import { App } from "../App";
import { ConfigApiError, resetSessionForTests } from "../api/client";
import { EARLY_PRIMARY_HELP_TEXT, ProfileEditor } from "./ProfileEditor";
import { RECOVERY_DISCLOSURE_TEXT } from "./RecoveryPanel";
import { UPGRADE_NOTICE_TEXT } from "./UpgradeNotice";

/*
 * Every child here is fictional and stored as a version 2 profile. Its earlier
 * writing mode, vocabulary band and math values sit in the read-only
 * `legacyChoices` that migration writes, which the interim editor still edits
 * (D-interim). No profile carries an age.
 */

const canonicalMorgan: ChildProfileV2 = {
  id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
  displayName: "Morgan",
  reviewedOn: "2026-08-22",
  interests: ["nature", "vehicles"],
  legacyChoices: {
    presentationBand: "early-primary",
    writingMode: "sentence-frame",
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
  },
};

const canonicalAvery: ChildProfileV2 = {
  id: "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
  displayName: "Avery",
  reviewedOn: "2026-08-22",
  interests: ["sports", "nature"],
  legacyChoices: {
    presentationBand: "early-primary",
    writingMode: "independent",
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
  },
};

const defaults: WorksheetDefaultsV2 = cloneWorksheetDefaults(
  DEFAULT_WORKSHEET_DEFAULTS_V2,
);

function configWithProfiles(profiles: readonly ChildProfileV2[]): AppConfigV2 {
  return { schemaVersion: 2, profiles: [...profiles], defaults };
}

function configResponse(
  config: AppConfigV2,
  etag: string,
  storedSchemaVersion: StoredSchemaVersion = 2,
): Response {
  return new Response(JSON.stringify({ config, storedSchemaVersion }), {
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
  onSubmit = vi.fn(async (profile: ChildProfileV2) => {
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

async function choosePreset(name: string): Promise<void> {
  await userEvent.setup().click(screen.getByRole("radio", { name }));
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
      preset: "Quantities to 10",
      counts: "10 / 10 / 10",
      operandResult: "0 / 0",
      vocabulary: "Preschool",
    },
    {
      preset: "Early primary within 10",
      counts: "20 / 20 / 20",
      operandResult: "10 / 10",
      vocabulary: "Early primary",
    },
    {
      preset: "Early primary within 20",
      counts: "20 / 20 / 20",
      operandResult: "20 / 20",
      vocabulary: "Early primary",
    },
    {
      preset: "Addition and subtraction within 100",
      counts: "20 / 20 / 20",
      operandResult: "100 / 100",
      vocabulary: "Early primary",
    },
  ] as const) {
    test(`shows the complete expansion of ${fixture.preset} once the parent chooses it`, async () => {
      renderNew();
      await choosePreset(fixture.preset);

      expect(screen.getByRole("radio", { name: fixture.preset })).toBeChecked();
      expect(expandedValue("Counting / numeral / compare")).toBe(fixture.counts);
      expect(expandedValue("Operand / result maximum")).toBe(fixture.operandResult);
      expect(expandedValue("Sentence vocabulary")).toBe(fixture.vocabulary);
    });
  }

  test("no age input exists and a new profile starts with no preset chosen", () => {
    renderNew();
    expect(screen.queryByRole("spinbutton", { name: /\bages?\b/iu })).toBeNull();
    expect(screen.queryByLabelText(/\bages?\b/iu)).toBeNull();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
    expect(
      screen.queryByRole("button", { name: /Confirm suggested capabilities/u }),
    ).toBeNull();
  });

  test("shows the early-primary help text verbatim, with no age word", () => {
    renderNew();
    const help = screen.getByText(EARLY_PRIMARY_HELP_TEXT);
    expect(help).toBeVisible();
    expect(help.textContent).toBe(
      "Extra Credit's worksheets are designed for early primary practice. Choose the worksheet and practice focus that fit your child.",
    );
    expect(help.textContent).not.toMatch(/\bages?\b/iu);
  });

  test("a new profile cannot be saved until a preset is chosen, then saves legacyChoices and no age", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "Kit");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("confirm a capability preset");

    await choosePreset("Early primary within 10");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0];
    expect(submitted).not.toHaveProperty("ageYears");
    expect(submitted).toMatchObject({
      displayName: "Kit",
      interests: [],
      legacyChoices: {
        presentationBand: "early-primary",
        writingMode: "label",
        mathSkills: canonicalMorgan.legacyChoices?.mathSkills,
      },
    });
    expect(Object.keys(submitted ?? {}).sort()).toEqual(
      ["displayName", "id", "interests", "legacyChoices", "reviewedOn"],
    );
  });

  test("a preset with an open vocabulary needs an explicit vocabulary before saving", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await choosePreset("Emerging equations within 5");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("presentation band");

    await user.click(screen.getByRole("radio", { name: "Preschool" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].legacyChoices).toEqual({
      presentationBand: "preschool",
      writingMode: "label",
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

  test("submits the exact expanded Quantities to 10 preset chosen explicitly", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await choosePreset("Quantities to 10");
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "  Riley  ");
    await user.type(
      screen.getByRole("textbox", { name: /Broad interests/ }),
      " animals, space ",
    );
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      displayName: "Riley",
      interests: ["animals", "space"],
      legacyChoices: {
        presentationBand: "preschool",
        writingMode: "label",
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
      },
    });
  });

  test("a migrated profile opens on its stored preset and vocabulary", () => {
    render(
      <ProfileEditor
        onCancel={() => undefined}
        onSubmit={vi.fn(async () => undefined)}
        profile={canonicalMorgan}
      />,
    );
    expect(screen.getByRole("radio", { name: "Early primary within 10" })).toBeChecked();
    expect(expandedValue("Operand / result maximum")).toBe("10 / 10");
    expect(expandedValue("Sentence vocabulary")).toBe("Early primary");
    expect(screen.queryByRole("radio", { name: "Early primary" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Writing mode" })).toHaveValue("sentence-frame");
  });

  test("editing only a migrated profile's nickname preserves its legacyChoices deep-equal", async () => {
    // Custom values above every activity ceiling and both stored-but-unused
    // permission flags: nothing a preset could produce.
    const migrated: ChildProfileV2 = {
      ...canonicalMorgan,
      legacyChoices: {
        presentationBand: "preschool",
        writingMode: "copy-with-model",
        mathSkills: {
          countingMax: 1_000,
          numeralMax: 45,
          compareMax: 3,
          representations: ["equations"],
          understandsEquality: false,
          operations: ["subtraction"],
          operandMax: 700,
          resultMax: 9,
          allowRegrouping: true,
          allowNegativeResults: true,
        },
      },
    };
    const onSubmit = vi.fn(async (profile: ChildProfileV2) => {
      void profile;
    });
    render(
      <ProfileEditor onCancel={() => undefined} onSubmit={onSubmit} profile={migrated} />,
    );
    const user = userEvent.setup();
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    await user.clear(nickname);
    await user.type(nickname, "Morgan renamed");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...migrated,
      displayName: "Morgan renamed",
    });
    expect(onSubmit.mock.calls[0]?.[0].legacyChoices).toEqual(migrated.legacyChoices);
  });

  test("a profile stored without earlier settings must choose a preset before it saves", async () => {
    const { legacyChoices: _unused, ...identityOnly } = canonicalMorgan;
    void _unused;
    const onSubmit = vi.fn(async (profile: ChildProfileV2) => {
      void profile;
    });
    render(
      <ProfileEditor onCancel={() => undefined} onSubmit={onSubmit} profile={identityOnly} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await choosePreset("Early primary within 20");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...identityOnly,
      legacyChoices: {
        presentationBand: "early-primary",
        writingMode: "label",
        mathSkills: canonicalAvery.legacyChoices?.mathSkills,
      },
    });
  });

  test("turns edited advanced fields into a canonical custom capability set", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await choosePreset("Early primary within 10");
    await user.click(screen.getByRole("radio", { name: "Custom capabilities" }));
    const operations = within(screen.getByRole("group", { name: "Operations" }));
    await user.click(operations.getByRole("checkbox", { name: "subtraction" }));

    expect(screen.getByRole("radio", { name: "Custom capabilities" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].legacyChoices?.mathSkills.operations).toEqual(["addition"]);
  });

  test("each advanced capability field carries its frozen v1 bounds", async () => {
    renderNew();
    await choosePreset("Early primary within 10");
    await userEvent.setup().click(screen.getByRole("radio", { name: "Custom capabilities" }));
    for (const [label, key] of [
      ["Counting maximum", "countingMax"],
      ["Numeral maximum", "numeralMax"],
      ["Comparison maximum", "compareMax"],
      ["Operand maximum", "operandMax"],
      ["Result maximum", "resultMax"],
    ] as const) {
      const field = MathSkillsV1Schema.shape[key];
      const input = screen.getByRole("spinbutton", { name: label });
      expect(input, label).toHaveAttribute("min", String(field.minValue));
      expect(input, label).toHaveAttribute("max", String(field.maxValue));
    }
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
    await choosePreset("Early primary within 10");
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "Preserved Draft");
    await user.selectOptions(screen.getByRole("combobox", { name: "Writing mode" }), "sentence-frame");
    await user.type(screen.getByRole("textbox", { name: /Broad interests/ }), "nature, vehicles");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("unsaved changes are still here");
    expect(screen.getByRole("textbox", { name: "Nickname (optional)" })).toHaveValue("Preserved Draft");
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
          profile={{ ...canonicalMorgan, reviewedOn: fixture.reviewedOn }}
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
        ...canonicalMorgan,
        reviewedOn: fixture.reviewedOn,
      });
    });
  }
});

describe("App profile authority behavior", () => {

  test("keeps a deferred delete authoritative and blocks a competing reload", async () => {
    const initialConfig = configWithProfiles([
      canonicalMorgan,
      canonicalAvery,
    ]);
    const deletedConfig = configWithProfiles([
      { ...canonicalAvery, displayName: "Avery from another tab" },
    ]);
    const pendingDelete = deferred<Response>();
    let configReads = 0;
    const putRequests: Array<{ config: AppConfigV2; ifMatch: string | null }> = [];

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
          const config = JSON.parse(String(init?.body)) as AppConfigV2;
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
      configWithProfiles([canonicalAvery]),
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
      canonicalMorgan,
      canonicalAvery,
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
    const morganLegacy = canonicalMorgan.legacyChoices!;
    const initialConfig = configWithProfiles([
      { ...canonicalMorgan, legacyChoices: { ...morganLegacy, mathSkills: {
        ...morganLegacy.mathSkills, allowRegrouping: true, allowNegativeResults: true,
      } } },
      canonicalAvery,
    ]);
    const externalSibling = {
      ...canonicalAvery,
      displayName: "Avery from another tab",
      interests: ["nature", "music"],
    } satisfies ChildProfileV2;
    const latestConfig = configWithProfiles([
      {
        ...canonicalMorgan,
        displayName: "Morgan from another tab",
        interests: ["music"],
      },
      externalSibling,
    ]);
    const pendingReconciliation = deferred<Response>();
    const putRequests: Array<{ config: AppConfigV2; ifMatch: string | null }> = [];
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
          const config = JSON.parse(String(init?.body)) as AppConfigV2;
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
    const reviewed = screen.getByLabelText("Reviewed on");
    const interests = screen.getByRole("textbox", { name: /Broad interests/ });
    await user.clear(nickname);
    await user.type(nickname, "Morgan Unsaved Draft");
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
    expect(screen.queryByRole("checkbox", { name: /future permission/ })).not.toBeInTheDocument();

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
    expect(screen.queryByRole("checkbox", { name: /future permission/ })).not.toBeInTheDocument();

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
      ...canonicalMorgan,
      displayName: "Morgan Unsaved Draft",
      reviewedOn: "2026-01-15",
      interests: ["art", "music"],
      legacyChoices: {
        presentationBand: "preschool",
        writingMode: "independent",
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
      },
    });
    expect(putRequests[1]?.config.profiles[1]).toEqual(externalSibling);
  });

  test("refreshes a stale session without replaying the failed mutation", async () => {
    const initialConfig = configWithProfiles([canonicalMorgan]);
    const freshSession = deferred<Response>();
    const putRequests: Array<{
      config: AppConfigV2;
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
          const config = JSON.parse(String(init?.body)) as AppConfigV2;
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
      const latestDefaults: AppConfigV2["defaults"] = {
        ...defaults,
        worksheetType: "count-compare-make",
        includeAnswerKey: false,
        paperSize: "a4",
      };
      const latestConfig: AppConfigV2 = {
        schemaVersion: 2,
        profiles: [canonicalAvery],
        defaults: latestDefaults,
      };
      const putRequests: Array<{
        config: AppConfigV2;
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
            const config = JSON.parse(String(init?.body)) as AppConfigV2;
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
      const reviewed = screen.getByLabelText("Reviewed on");
      const interests = screen.getByRole("textbox", { name: /Broad interests/ });
      await user.type(nickname, `Recovery draft ${readOutcome}`);
      await user.click(screen.getByRole("radio", { name: "Quantities to 10" }));
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
      expect(reviewed).toHaveValue("2026-01-31");
      expect(interests).toHaveValue("art, music");
      expect(screen.getByRole("combobox", { name: "Writing mode" })).toHaveValue(
        "copy-with-model",
      );
      expect(screen.getByRole("radio", { name: "Quantities to 10" })).toBeChecked();
      expect(expandedValue("Sentence vocabulary")).toBe("Preschool");
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
        reviewedOn: "2026-01-31",
        interests: ["art", "music"],
        legacyChoices: {
          presentationBand: "preschool",
          writingMode: "copy-with-model",
          mathSkills: {
            representations: ["quantities"],
            operations: [],
            operandMax: 0,
            resultMax: 0,
          },
        },
      });
      expect(
        explicitSave?.config.profiles.find(
          ({ displayName }) => displayName === `Recovery draft ${readOutcome}`,
        ),
      ).not.toHaveProperty("ageYears");
      if (readOutcome === "valid") {
        expect(explicitSave?.config.profiles[0]).toEqual(canonicalAvery);
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
    const confirmation = screen.getByRole("checkbox", {
      name: /I understand that Back up invalid file and replace/,
    });
    await user.type(nickname, "Invalid revision draft");
    await user.click(screen.getByRole("radio", { name: "Quantities to 10" }));
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

/**
 * The two halves of ONE discriminator, kept in one block on purpose.
 *
 * A defaults WRITE claims the config file under the `defaults` operation kind,
 * which is the one kind that does not invalidate the rendered worksheet: the
 * write passes the `profiles` array through untouched under `If-Match`, so a
 * 200 proves the document's inputs are unchanged and the page - whose seed came
 * from `crypto.getRandomValues` and is not reproducible - must survive.
 *
 * A 409 withdraws exactly that proof, and the re-read that follows adopts
 * ANOTHER writer's whole config. So the re-read claims the file as a `read`,
 * which invalidates, and the stale page goes down with it.
 *
 * Proving one arm alone is not proving the discriminator: "always invalidate"
 * satisfies the drop arm and re-breaks the seed loss, "never invalidate"
 * satisfies the keep arm and is the stale-page defect. Deleting either test
 * below should be visible as deleting half of a pair.
 */
describe("App worksheet authority across a defaults save", () => {
  /** Enough operand and result room to fill any Dry Math length. */
  const generatableProfile: ChildProfileV2 = {
    ...canonicalMorgan,
    legacyChoices: {
      ...canonicalMorgan.legacyChoices!,
      mathSkills: {
        ...canonicalMorgan.legacyChoices!.mathSkills,
        operandMax: 20,
        resultMax: 20,
      },
    },
  };

  /**
   * The same profile id, a withdrawn nickname and operand/result limits far too
   * low for any Dry Math page: a worksheet built against the first config is
   * not merely stale here, it is a page the current file could not produce.
   */
  const supersededProfile: ChildProfileV2 = {
    id: generatableProfile.id,
    reviewedOn: generatableProfile.reviewedOn,
    interests: [...generatableProfile.interests],
    legacyChoices: {
      ...generatableProfile.legacyChoices!,
      mathSkills: {
        ...generatableProfile.legacyChoices!.mathSkills,
        operandMax: 1,
        resultMax: 1,
      },
    },
  };

  function stubDefaultsSave(putStatus: "saved" | "conflict"): {
    readonly configReads: () => number;
  } {
    let configReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/health")) {
          return new Response(
            JSON.stringify({ status: "ok", version: "0.1.0" }),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          );
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
            ? configResponse(
                configWithProfiles([generatableProfile]),
                '"etag-initial"',
              )
            : configResponse(
                configWithProfiles([supersededProfile]),
                '"etag-other-writer"',
              );
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          const config = JSON.parse(String(init?.body)) as AppConfigV2;
          return putStatus === "saved"
            ? configResponse(config, '"etag-saved"')
            : new Response(
                JSON.stringify({
                  error: {
                    code: "CONFIG_CONFLICT",
                    message: "The profile file changed after it was loaded.",
                  },
                }),
                {
                  headers: { "Content-Type": "application/json" },
                  status: 409,
                },
              );
        }
        throw new Error("Unexpected request in the defaults-save test.");
      }),
    );
    return { configReads: () => configReads };
  }

  async function renderWithWorksheet(): Promise<void> {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    // A value the panel does NOT initialise to, so a remount is visible.
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create worksheet" }));
    // NON-VACUITY: without this the drop assertion below could pass on a test
    // that never rendered a worksheet at all - the exact shape the stop-and-
    // audit was called for.
    expect(screen.getByLabelText("Worksheet preview")).toHaveAttribute(
      "data-worksheet-type",
      "dry-math",
    );
  }

  test("a defaults save that changes no profile keeps the rendered worksheet", async () => {
    stubDefaultsSave("saved");
    await renderWithWorksheet();
    const printedBefore = screen.getByLabelText("Worksheet preview").textContent;

    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    expect(
      await screen.findByText("Worksheet defaults saved locally."),
    ).toBeVisible();

    expect(screen.getByLabelText("Worksheet preview").textContent).toBe(
      printedBefore,
    );
    expect(screen.getByRole("button", { name: "Make another" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue(
      "large",
    );
  });

  test("a superseded defaults save drops the worksheet built from the superseded profiles", async () => {
    const { configReads } = stubDefaultsSave("conflict");
    await renderWithWorksheet();

    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    expect(
      await screen.findByText(
        "Saved profiles changed on this computer, so no worksheet defaults were changed. The latest file has been reloaded - press save again to keep these choices.",
      ),
    ).toBeVisible();

    // The re-read really happened, and it adopted the other writer's config.
    expect(configReads()).toBe(2);
    expect(screen.queryByRole("heading", { name: "Morgan" })).toBeNull();
    // The document is gone: it was built from profiles the 409 proved are no
    // longer on disk, and nothing on the page marks it stale.
    expect(screen.queryByLabelText("Worksheet preview")).toBeNull();
    expect(screen.queryByRole("button", { name: "Make another" })).toBeNull();
    // The PANEL is not remounted, which is the other half of the fix: the
    // parent's selection and the retry message survive the drop.
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue(
      "large",
    );
    expect(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    ).toBeEnabled();
  });
});

/**
 * Stubs the local API for the App-level cases below: health, a session token,
 * one config read and a PUT that echoes the saved body back at version 2.
 */
function stubConfigApi(
  loaded: AppConfigV2,
  storedSchemaVersion: StoredSchemaVersion,
): { readonly puts: AppConfigV2[] } {
  const puts: AppConfigV2[] = [];
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
        return configResponse(loaded, '"etag-loaded"', storedSchemaVersion);
      }
      if (url.endsWith("/api/config") && method === "PUT") {
        const config = JSON.parse(String(init?.body)) as AppConfigV2;
        puts.push(config);
        return configResponse(config, `"etag-saved-${puts.length}"`, 2);
      }
      throw new Error("Unexpected request in the App-level upgrade test.");
    }),
  );
  return { puts };
}

/** A migrated v1 file: both children carry `legacyChoices`, seeding is on. */
function migratedConfig(): AppConfigV2 {
  return {
    schemaVersion: 2,
    profiles: [canonicalMorgan, canonicalAvery],
    defaults: { ...cloneWorksheetDefaults(defaults), useEarlierChildSettings: true },
  };
}

describe("App over a file an earlier version saved", () => {
  test("the interim defaults save passes every worksheet group and the seeding flag through", async () => {
    // Worksheet groups a built-in rebuild could never produce, so writing
    // DEFAULT values, or anything derived from a child's earlier settings,
    // instead of passing them through is visible in the PUT body.
    const loaded = migratedConfig();
    loaded.defaults = {
      ...loaded.defaults,
      worksheetType: "find-the-wow",
      dryMath: { operations: ["addition"], operandMax: 7, resultMax: 9 },
      findTheWow: {
        variant: "equation",
        quantity: { countingMax: 4, numeralMax: 6 },
        equation: { operations: ["subtraction"], operandMax: 11, resultMax: 3 },
      },
      sentenceBuilder: { variant: "draw-and-tell", vocabulary: "simpler-words" },
      countCompareMake: { countingMax: 5, numeralMax: 6, compareMax: 7 },
    };
    const before = structuredClone(loaded);
    // The child the parent selects covers every worksheet group with earlier
    // settings that differ from the saved defaults, so a save that wrote the
    // selected child's values instead of passing the defaults through would
    // change every group below.
    const selectedChild = canonicalAvery;
    const childSelection = selectionFromEarlierSettings(
      selectedChild.legacyChoices!,
      worksheetSelectionOf(loaded.defaults),
    ).selection;
    for (const group of [
      "dryMath",
      "findTheWow",
      "sentenceBuilder",
      "countCompareMake",
    ] as const) {
      expect(childSelection[group], group).not.toEqual(loaded.defaults[group]);
    }
    const { puts } = stubConfigApi(loaded, 1);

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Worksheet type" }), {
      target: { value: "sentence-builder" },
    });
    // The first child's earlier writing activity is on the panel, and
    // selecting the second child replaces it with hers: the panel really
    // follows the selected child rather than the saved Draw & Tell default.
    expect(
      screen.getByText("Writing activity for Sentence Builder: Finish a Sentence."),
    ).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
      target: { value: selectedChild.id },
    });
    expect(
      screen.getByText("Writing activity for Sentence Builder: Independent Writing."),
    ).toBeVisible();
    expect(
      screen.queryByText("Writing activity for Sentence Builder: Draw & Tell."),
    ).toBeNull();
    fireEvent.click(screen.getByLabelText("Use reviewed interests in worksheet content"));
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save these as worksheet defaults" }),
    );
    expect(await screen.findByText("Worksheet defaults saved locally.")).toBeVisible();

    expect(puts).toHaveLength(1);
    const saved = puts[0]!;
    for (const group of [
      "worksheetType",
      "dryMath",
      "findTheWow",
      "sentenceBuilder",
      "countCompareMake",
    ] as const) {
      expect(saved.defaults[group], group).toEqual(before.defaults[group]);
    }
    expect(saved.defaults.useEarlierChildSettings).toBe(true);
    expect(saved.defaults.useInterests).toBe(false);
    // Until the Theme control exists, the saved theme follows interests (D33).
    expect(saved.defaults.theme).toBe("neutral");
    expect(saved.defaults.printScale).toBe("large");
    expect(saved.defaults).not.toHaveProperty("difficulty");
    expect(saved.profiles).toEqual(before.profiles);
    expect(saved.schemaVersion).toBe(2);
  });

  test("shows the upgrade notice for a version 1 file until the first save upgrades it", async () => {
    stubConfigApi(migratedConfig(), 1);
    render(<App />);
    const notice = await screen.findByText(UPGRADE_NOTICE_TEXT);
    expect(notice.textContent).toBe(
      "This profile file was saved by an earlier version. Your profiles are shown unchanged; the next save updates the file and keeps a copy of the earlier file beside it. Age is no longer used, and Practice focus replaces Difficulty. A saved Difficulty of Confidence or Stretch no longer applies; each practice focus uses exactly its stated range.",
    );
    const region = notice.closest("[aria-live]");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).not.toHaveAttribute("role");
    expect(notice.closest('[role="status"]')).toBeNull();
    // Outside both the profile list and the generator panel (U3).
    expect(notice.closest(".profile-workspace")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit Morgan" }));
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    await user.clear(nickname);
    await user.type(nickname, "Morgan renamed");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("heading", { name: "Morgan renamed" })).toBeVisible();
    expect(screen.queryByText(UPGRADE_NOTICE_TEXT)).toBeNull();
  });

  test("a version 2 file shows no upgrade notice", async () => {
    stubConfigApi(migratedConfig(), 2);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    expect(screen.queryByText(UPGRADE_NOTICE_TEXT)).toBeNull();
  });

  test("the recovery panel states what stays only in the backup before confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
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
            headers: { "Content-Type": "application/json", ETag: '"sha256-fixture"' },
            status: 409,
          },
        );
      }),
    );
    render(<App />);
    const heading = await screen.findByRole("heading", {
      name: "The saved profile file needs attention",
    });
    const panel = heading.closest("section")!;
    expect(within(panel).getByText(RECOVERY_DISCLOSURE_TEXT).textContent).toBe(
      "The replacement file keeps only the one profile entered below, with the built-in worksheet defaults. Every other profile, the saved worksheet defaults and all earlier settings stay only in the backup file.",
    );
    expect(
      within(panel).getByText(/Optional draft download/u).textContent,
    ).not.toMatch(/\bages?\b/iu);
    expect(
      within(panel).getByRole("checkbox", {
        name: /I understand that Back up invalid file and replace/u,
      }),
    ).not.toBeChecked();
  });
});
