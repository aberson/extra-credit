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
import { describePracticeFocus } from "../../shared/config/practice-focus";
import {
  type AppConfigV2,
  type ChildProfileV2,
  type StoredSchemaVersion,
  type WorksheetDefaultsV2,
} from "../../shared/config/schema";
import { App, NEWER_VERSION_MESSAGE } from "../App";
import { ConfigApiError, resetSessionForTests } from "../api/client";
import { EARLY_PRIMARY_HELP_TEXT, ProfileEditor } from "./ProfileEditor";
import { RECOVERY_DISCLOSURE_TEXT } from "./RecoveryPanel";
import { UPGRADE_NOTICE_TEXT } from "./UpgradeNotice";

/*
 * Every child here is fictional and stored as a version 2 profile. Its earlier
 * writing mode, vocabulary band and math values sit in the read-only
 * `legacyChoices` that migration writes; the profile editor shows them through
 * `EarlierSettingsSummary` and saves them back unchanged. No profile carries
 * an age.
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

/** The read-only earlier-settings region the editor renders for a profile carrying them. */
function earlierSettings(): HTMLElement {
  return screen.getByRole("region", { name: "Earlier settings" });
}

/** Each term of the earlier-settings summary with its value, in order. */
function summaryRows(): readonly (readonly [string, string])[] {
  return within(earlierSettings())
    .getAllByRole("term")
    .map((term) => [term.textContent ?? "", term.nextElementSibling?.textContent ?? ""] as const);
}

/** The form's every input, select and textarea, by accessible label text. */
function formControlLabels(): readonly string[] {
  const form = screen.getByRole("form", { name: /profile/u });
  return [...form.querySelectorAll("input, select, textarea")].map(
    (control) => control.closest("label")?.firstChild?.textContent?.trim() ?? control.tagName,
  );
}

/**
 * A fictional migrated child whose stored values sit above every activity
 * ceiling and carry both stored-but-unused permission flags: nothing the
 * worksheet catalog could produce.
 */
const customMigrated: ChildProfileV2 = {
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

describe("ProfileEditor form behavior", () => {
  test("the form exposes only nickname, reviewed-on and interests", () => {
    renderNew();
    expect(formControlLabels()).toEqual([
      "Nickname (optional)",
      "Reviewed on",
      "Broad interests (optional, separated by commas)",
    ]);
    for (const role of ["radio", "combobox", "spinbutton", "checkbox"] as const) {
      expect(screen.queryAllByRole(role), role).toEqual([]);
    }
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Save profile",
      "Cancel",
    ]);
    expect(screen.queryByRole("region", { name: "Earlier settings" })).toBeNull();
  });

  test("no age input exists and nothing asks for a preset, writing mode or vocabulary", () => {
    renderNew();
    expect(screen.queryByRole("spinbutton", { name: /\bages?\b/iu })).toBeNull();
    expect(screen.queryByLabelText(/\bages?\b/iu)).toBeNull();
    expect(screen.queryByText(/preset|writing mode|presentation band|vocabulary|capabilit/iu)).toBeNull();
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

  test("a new profile saves without legacyChoices", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "Kit");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0];
    expect(submitted).not.toHaveProperty("legacyChoices");
    expect(submitted).not.toHaveProperty("ageYears");
    expect(Object.keys(submitted ?? {}).sort()).toEqual(
      ["displayName", "id", "interests", "reviewedOn"],
    );
    expect(submitted).toMatchObject({ displayName: "Kit", interests: [] });
  });

  test("submits a new profile's trimmed nickname and interests", async () => {
    const onSubmit = renderNew();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "  Riley  ");
    await user.type(
      screen.getByRole("textbox", { name: /Broad interests/ }),
      " animals, space ",
    );
    const reviewed = screen.getByLabelText("Reviewed on");
    await user.clear(reviewed);
    await user.type(reviewed, "2026-09-30");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      id: expect.any(String),
      displayName: "Riley",
      reviewedOn: "2026-09-30",
      interests: ["animals", "space"],
    });
  });

  test("a new profile's valid draft reaches onDraftChange identity-only", async () => {
    const onDraftChange = vi.fn();
    render(
      <ProfileEditor
        onCancel={() => undefined}
        onDraftChange={onDraftChange}
        onSubmit={vi.fn(async () => undefined)}
        recoveryMode
      />,
    );
    await userEvent.setup().type(
      screen.getByRole("textbox", { name: "Nickname (optional)" }),
      "Draft",
    );
    const latest = onDraftChange.mock.calls.at(-1)?.[0] as ChildProfileV2 | undefined;
    expect(latest).toMatchObject({ displayName: "Draft", interests: [] });
    expect(latest).not.toHaveProperty("legacyChoices");
  });

  test("a migrated profile shows its earlier settings read-only, in the worksheet panel's words", () => {
    render(
      <ProfileEditor
        onCancel={() => undefined}
        onSubmit={vi.fn(async () => undefined)}
        profile={canonicalMorgan}
      />,
    );
    expect(summaryRows()).toEqual([
      ["Writing activity", "Finish a Sentence"],
      ["Vocabulary", "Include longer words"],
      ["Dry Math", "Addition and subtraction within 10"],
      ["Two Whats and a Wow", "Equations: Addition and subtraction within 10"],
      ["Count, Compare & Make", "Quantities to 20"],
    ]);
    const region = earlierSettings();
    for (const role of ["textbox", "radio", "combobox", "spinbutton", "checkbox", "button"] as const) {
      expect(within(region).queryAllByRole(role), role).toEqual([]);
    }
    // The summary adds no form control: the form still holds three.
    expect(formControlLabels()).toHaveLength(3);
  });

  test("mirror: a different child's earlier settings read differently", () => {
    render(
      <ProfileEditor
        onCancel={() => undefined}
        onSubmit={vi.fn(async () => undefined)}
        profile={canonicalAvery}
      />,
    );
    expect(summaryRows()).toEqual([
      ["Writing activity", "Independent Writing"],
      ["Vocabulary", "Include longer words"],
      ["Dry Math", "Addition and subtraction within 20"],
      ["Two Whats and a Wow", "Equations: Addition and subtraction within 20"],
      ["Count, Compare & Make", "Quantities to 20"],
    ]);
  });

  test("the summary names each clamped value and each stored-but-unused permission", () => {
    render(
      <ProfileEditor
        onCancel={() => undefined}
        onSubmit={vi.fn(async () => undefined)}
        profile={customMigrated}
      />,
    );
    // Equations without confirmed equality and without quantities seed no
    // Statements variant and no quantity groups, so those rows are absent.
    expect(summaryRows()).toEqual([
      ["Writing activity", "Copy a Sentence"],
      ["Vocabulary", "Simpler words — for beginning readers"],
      ["Dry Math", "Subtraction with numbers to 100 and answers to 9"],
    ]);
    const notes = within(earlierSettings()).getAllByRole("listitem").map((item) => item.textContent);
    expect(notes).toEqual([
      "Dry Math operands: stored 700, using 100.",
      "Two Whats and a Wow equations operands: stored 700, using 20.",
      "Carrying and borrowing: stored but not used.",
      "Negative results: stored but not used.",
    ]);
  });

  test("editing only a migrated profile's nickname preserves its legacyChoices deep-equal", async () => {
    const onSubmit = vi.fn(async (profile: ChildProfileV2) => {
      void profile;
    });
    render(
      <ProfileEditor onCancel={() => undefined} onSubmit={onSubmit} profile={customMigrated} />,
    );
    expect(earlierSettings()).toBeVisible();
    const user = userEvent.setup();
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    await user.clear(nickname);
    await user.type(nickname, "Morgan renamed");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...customMigrated,
      displayName: "Morgan renamed",
    });
    expect(onSubmit.mock.calls[0]?.[0].legacyChoices).toEqual(customMigrated.legacyChoices);
  });

  test("an identity-only profile shows no summary and saves without gaining legacyChoices", async () => {
    const { legacyChoices: _unused, ...identityOnly } = canonicalMorgan;
    void _unused;
    const onSubmit = vi.fn(async (profile: ChildProfileV2) => {
      void profile;
    });
    render(
      <ProfileEditor onCancel={() => undefined} onSubmit={onSubmit} profile={identityOnly} />,
    );
    expect(screen.queryByRole("region", { name: "Earlier settings" })).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: /Broad interests/ }), ", trains");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...identityOnly,
      interests: [...identityOnly.interests, "trains"],
    });
  });

  test("cancelling an edit emits nothing", async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <ProfileEditor onCancel={onCancel} onSubmit={onSubmit} profile={canonicalMorgan} />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), " draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
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
    await user.type(screen.getByRole("textbox", { name: "Nickname (optional)" }), "Preserved Draft");
    const reviewed = screen.getByLabelText("Reviewed on");
    await user.clear(reviewed);
    await user.type(reviewed, "2026-02-14");
    await user.type(screen.getByRole("textbox", { name: /Broad interests/ }), "nature, vehicles");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("unsaved changes are still here");
    expect(screen.getByRole("textbox", { name: "Nickname (optional)" })).toHaveValue("Preserved Draft");
    expect(reviewed).toHaveValue("2026-02-14");
    expect(screen.getByRole("textbox", { name: /Broad interests/ })).toHaveValue("nature, vehicles");
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
        expect(reminder?.textContent).not.toMatch(/capabilit/iu);
      } else {
        expect(reminder).not.toBeInTheDocument();
      }
      expect(earlierSettings()).toBeVisible();
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
    await user.clear(reviewed);
    await user.type(reviewed, "2026-01-15");
    await user.clear(interests);
    await user.type(interests, "art, music");

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
    expect(reviewed).toHaveValue("2026-01-15");
    expect(interests).toHaveValue("art, music");
    expect(screen.getByRole("region", { name: "Earlier settings" })).toBeVisible();

    await drainScheduledWork();
    expect(putRequests).toHaveLength(1);

    const explicitSave = screen.getByRole("button", { name: "Save profile" });
    expect(explicitSave).toBeEnabled();
    fireEvent.click(explicitSave);
    await drainScheduledWork();
    expect(screen.getByRole("heading", { name: "Morgan Unsaved Draft" })).toBeVisible();
    expect(putRequests).toHaveLength(2);
    expect(putRequests[1]?.ifMatch).toBe('"etag-latest"');
    // The draft's identity fields win; the earlier settings the editor opened
    // with are saved back exactly as stored.
    expect(putRequests[1]?.config.profiles[0]).toEqual({
      ...initialConfig.profiles[0],
      displayName: "Morgan Unsaved Draft",
      reviewedOn: "2026-01-15",
      interests: ["art", "music"],
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
      ).toEqual({
        id: expect.any(String),
        displayName: `Recovery draft ${readOutcome}`,
        reviewedOn: "2026-01-31",
        interests: ["art", "music"],
      });
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
 * config reads and a PUT that echoes the saved body back at version 2. The
 * first read returns `loaded`; each later read returns the next of `reloads`,
 * and the last one again once they run out.
 */
function stubConfigApi(
  loaded: AppConfigV2,
  storedSchemaVersion: StoredSchemaVersion,
  reloads: readonly AppConfigV2[] = [],
): { readonly puts: AppConfigV2[] } {
  const puts: AppConfigV2[] = [];
  let reads = 0;
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
        reads += 1;
        const config =
          reads === 1 ? loaded : (reloads[Math.min(reads, reloads.length + 1) - 2] ?? loaded);
        return configResponse(config, `"etag-read-${reads}"`, storedSchemaVersion);
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
  test("saving defaults writes the visible selection, seeded groups included, and ends seeding", async () => {
    // Saved worksheet groups a child's earlier settings never produce, so a
    // save that passed the stored groups through, instead of writing what the
    // parent sees, is visible in the PUT body.
    const loaded = migratedConfig();
    loaded.defaults = {
      ...loaded.defaults,
      dryMath: { operations: ["addition"], operandMax: 7, resultMax: 9 },
      countCompareMake: { countingMax: 5, numeralMax: 6, compareMax: 7 },
    };
    const before = structuredClone(loaded);
    const selectedChild = canonicalMorgan;
    const seeded = selectionFromEarlierSettings(
      selectedChild.legacyChoices!,
      worksheetSelectionOf(loaded.defaults),
    ).selection;
    // Non-vacuity: the untouched Dry Math group the parent sees is the
    // child's earlier setting, not the saved default.
    expect(seeded.dryMath).not.toEqual(loaded.defaults.dryMath);
    const { puts } = stubConfigApi(loaded, 1);

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    const shownFocus = (): string | undefined =>
      (screen.getByRole("combobox", { name: "Practice focus" }) as HTMLSelectElement)
        .selectedOptions[0]?.textContent ?? undefined;
    expect(shownFocus()).toBe(describePracticeFocus("dry-math", seeded.dryMath));
    expect(
      screen.getByText(
        "Saving makes these the starting choices for every child. Children's earlier settings stay in the file but will no longer be used as starting points.",
      ),
    ).toBeVisible();
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
    expect(saved.defaults).toEqual({
      ...seeded,
      printScale: "large",
      useEarlierChildSettings: false,
    });
    expect(saved.defaults).not.toHaveProperty("difficulty");
    expect(saved.profiles).toEqual(before.profiles);
    expect(saved.schemaVersion).toBe(2);
    // Nothing visible changed at the save, and there is no seeding left to end.
    expect(shownFocus()).toBe(describePracticeFocus("dry-math", seeded.dryMath));
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue("large");
    expect(
      window.document.querySelector("[data-earlier-settings-save-note]"),
    ).toBeNull();
  });

  test("a profile save or a cancelled edit after a control change keeps the selection", async () => {
    const { puts } = stubConfigApi(migratedConfig(), 2);
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "Sentence Builder" }));
    fireEvent.click(screen.getByRole("radio", { name: "Draw & Tell" }));
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });

    const expectSelectionKept = (): void => {
      expect(screen.getByRole("radio", { name: "Sentence Builder" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Draw & Tell" })).toBeChecked();
      for (const details of window.document.querySelectorAll("details")) {
        details.open = true;
      }
      expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue("large");
    };

    // A cancelled edit writes nothing and keeps every choice.
    await user.click(screen.getByRole("button", { name: "Edit Morgan" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expectSelectionKept();
    expect(puts).toHaveLength(0);

    // A saved edit keeps every changed choice, and the panel lists the saved
    // profile.
    await user.click(screen.getByRole("button", { name: "Edit Morgan" }));
    const nickname = screen.getByRole("textbox", { name: "Nickname (optional)" });
    await user.clear(nickname);
    await user.type(nickname, "Morgan renamed");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("heading", { name: "Morgan renamed" })).toBeVisible();
    expect(puts).toHaveLength(1);
    expectSelectionKept();
    expect(screen.getByRole("radio", { name: "Include longer words" })).toBeChecked();
    const child = screen.getByRole("combobox", { name: "Child profile" }) as HTMLSelectElement;
    expect(child.selectedOptions[0]?.textContent).toBe("Morgan renamed");
  });

  test("a profile delete clears the preview and keeps the selection", async () => {
    const { puts } = stubConfigApi(configWithProfiles([canonicalMorgan, canonicalAvery]), 2);
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create worksheet" }));
    expect(screen.getByLabelText("Worksheet preview")).toBeVisible();

    // A mutation that never opens the editor: the other child is deleted.
    await user.click(screen.getByRole("button", { name: "Delete Avery" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm delete" }),
    );
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Avery" })).toBeNull());
    expect(puts).toHaveLength(1);
    expect(puts[0]?.profiles.map(({ id }) => id)).toEqual([canonicalMorgan.id]);
    expect(screen.queryByLabelText("Worksheet preview")).toBeNull();
    expect(screen.queryByRole("button", { name: "Make another" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      canonicalMorgan.id,
    );
    expect(
      [
        ...screen.getByRole("combobox", { name: "Child profile" }).querySelectorAll("option"),
      ].map((option) => option.textContent),
    ).toEqual(["Morgan"]);
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue("large");
  });

  test("Reload saved profiles keeps changed choices and the chosen child while untouched ones follow the reloaded defaults", async () => {
    const first = configWithProfiles([canonicalMorgan, canonicalAvery]);
    const reloaded: AppConfigV2 = {
      ...first,
      defaults: { ...first.defaults, length: "long", printScale: "standard", paperSize: "a4" },
    };
    const { puts } = stubConfigApi(first, 2, [reloaded]);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
      target: { value: canonicalAvery.id },
    });
    expect(screen.getByRole("combobox", { name: "Length" })).toHaveValue("standard");

    fireEvent.click(screen.getByRole("button", { name: "Reload saved profiles" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Paper size" })).toHaveValue("a4"),
    );
    // The untouched groups moved to the reloaded defaults...
    expect(screen.getByRole("combobox", { name: "Length" })).toHaveValue("long");
    // ...while the changed choice and the chosen child stayed.
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue("large");
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      canonicalAvery.id,
    );
    expect(puts).toHaveLength(0);
  });

  test("an invalid-file recovery save on a fresh session builds the worksheet panel over the replacement file", async () => {
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
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          const config = JSON.parse(String(init?.body)) as AppConfigV2;
          puts.push(config);
          return configResponse(config, '"etag-recovered"');
        }
        throw new Error("Unexpected request in the recovery-save test.");
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "The saved profile file needs attention" }),
    ).toBeVisible();
    // No panel while the file needs recovery.
    expect(screen.queryByRole("button", { name: "Create worksheet" })).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: "Nickname (optional)" }),
      "Recovered child",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /I understand that Back up invalid file and replace/ }),
    );
    await user.click(screen.getByRole("button", { name: "Back up invalid file and replace" }));

    expect(await screen.findByRole("heading", { name: "Recovered child" })).toBeVisible();
    expect(puts).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Create worksheet" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      puts[0]?.profiles[0]?.id,
    );
  });

  test("an invalid-file recovery save after a started session starts the selection over", async () => {
    const puts: AppConfigV2[] = [];
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
            return configResponse(
              configWithProfiles([canonicalMorgan, canonicalAvery]),
              '"etag-valid"',
            );
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
        }
        if (url.endsWith("/api/config") && method === "PUT") {
          const config = JSON.parse(String(init?.body)) as AppConfigV2;
          puts.push(config);
          return configResponse(config, '"etag-recovered"');
        }
        throw new Error("Unexpected request in the started-session recovery test.");
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();
    // A touched group away from the replacement file's default.
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
      target: { value: "large" },
    });
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue("large");

    fireEvent.click(screen.getByRole("button", { name: "Reload saved profiles" }));
    expect(
      await screen.findByRole("heading", { name: "The saved profile file needs attention" }),
    ).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "Nickname (optional)" }),
      "Recovered child",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /I understand that Back up invalid file and replace/ }),
    );
    await user.click(screen.getByRole("button", { name: "Back up invalid file and replace" }));

    expect(await screen.findByRole("heading", { name: "Recovered child" })).toBeVisible();
    expect(puts).toHaveLength(1);
    expect(puts[0]?.defaults.printScale).toBe("standard");
    expect(screen.getByRole("combobox", { name: "Child profile" })).toHaveValue(
      puts[0]?.profiles[0]?.id,
    );
    for (const details of window.document.querySelectorAll("details")) {
      details.open = true;
    }
    // The recovery save starts the session over, so the touched group is back
    // to the replacement file's default.
    expect(screen.getByRole("combobox", { name: "Print scale" })).toHaveValue("standard");
  });

  test("each control change clears the preview and Create writes nothing", async () => {
    const { puts } = stubConfigApi(configWithProfiles([canonicalMorgan, canonicalAvery]), 2);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Morgan" })).toBeVisible();

    const preview = (): HTMLElement | null => screen.queryByLabelText("Worksheet preview");
    const createAndExpectPreview = (): void => {
      fireEvent.click(screen.getByRole("button", { name: "Create worksheet" }));
      expect(preview()).not.toBeNull();
      expect(screen.getByRole("button", { name: "Make another" })).toBeVisible();
    };
    const openMoreOptions = (): void => {
      for (const details of window.document.querySelectorAll("details")) {
        details.open = true;
      }
    };
    const changes: readonly [string, () => void][] = [
      ["worksheet type", () => fireEvent.click(screen.getByRole("radio", { name: "Math — Two Whats and a Wow" }))],
      ["statements", () => fireEvent.click(screen.getByRole("radio", { name: "Equations" }))],
      [
        "practice focus",
        () =>
          fireEvent.change(screen.getByRole("combobox", { name: "Practice focus" }), {
            target: { value: "addition-within-20" },
          }),
      ],
      [
        "child",
        () =>
          fireEvent.change(screen.getByRole("combobox", { name: "Child profile" }), {
            target: { value: canonicalAvery.id },
          }),
      ],
      ["writing worksheet type", () => fireEvent.click(screen.getByRole("radio", { name: "Sentence Builder" }))],
      ["writing activity", () => fireEvent.click(screen.getByRole("radio", { name: "Independent Writing" }))],
      ["vocabulary", () => fireEvent.click(screen.getByRole("radio", { name: "Include longer words" }))],
      ["quantity worksheet type", () => fireEvent.click(screen.getByRole("radio", { name: "Count, Compare & Make" }))],
      [
        "length",
        () => {
          openMoreOptions();
          fireEvent.change(screen.getByRole("combobox", { name: "Length" }), {
            target: { value: "short" },
          });
        },
      ],
      ["answer key", () => fireEvent.click(screen.getByLabelText("Include a parent answer key"))],
      ["nickname", () => fireEvent.click(screen.getByLabelText("Put the nickname in the worksheet header"))],
      ["interests", () => fireEvent.click(screen.getByLabelText("Use reviewed interests in worksheet content"))],
      ["graphics", () => fireEvent.click(screen.getByLabelText("Include decorative graphics"))],
      [
        "paper",
        () =>
          fireEvent.change(screen.getByRole("combobox", { name: "Paper size" }), {
            target: { value: "a4" },
          }),
      ],
      [
        "scale",
        () =>
          fireEvent.change(screen.getByRole("combobox", { name: "Print scale" }), {
            target: { value: "large" },
          }),
      ],
    ];
    createAndExpectPreview();
    for (const [control, change] of changes) {
      openMoreOptions();
      change();
      expect(preview(), control).toBeNull();
      expect(screen.queryByRole("button", { name: "Make another" }), control).toBeNull();
      expect(screen.queryByText(/^Worksheet ready with/u), control).toBeNull();
      // A page created after the change stays on screen.
      createAndExpectPreview();
    }
    fireEvent.click(screen.getByRole("button", { name: "Make another" }));
    expect(preview()).not.toBeNull();
    // Create and Make another never write the config file.
    expect(puts).toHaveLength(0);
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
    const downloadCopy = within(panel).getByText(/Optional draft download/u);
    expect(downloadCopy).toHaveAttribute("data-draft-download-copy", "true");
    expect(downloadCopy.textContent).toContain("nickname, review date, and broad interests");
    expect(downloadCopy.textContent).not.toMatch(/capabilit/iu);
    expect(downloadCopy.textContent).not.toMatch(/\bages?\b/iu);
    expect(
      within(panel).getByRole("checkbox", {
        name: /I understand that Back up invalid file and replace/u,
      }),
    ).not.toBeChecked();
  });
});

/** A health, session and config API whose config read fails with one error. */
function stubConfigFailure(code: string, message: string, etag?: string): { readonly puts: number } {
  const counts = { puts: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if ((init?.method ?? "GET") === "PUT") {
        counts.puts += 1;
      }
      return new Response(JSON.stringify({ error: { code, message } }), {
        headers: {
          "Content-Type": "application/json",
          ...(etag === undefined ? {} : { ETag: etag }),
        },
        status: code === "CONFIG_NOT_FOUND" ? 404 : 409,
      });
    }),
  );
  return counts;
}

describe("App copy and the blocked state", () => {
  test("the first-profile copy and the page header name no capability and no age", async () => {
    stubConfigFailure("CONFIG_NOT_FOUND", "No saved profile configuration exists yet.");
    render(<App />);
    const firstProfile = await screen.findByRole("heading", {
      name: "Start with one reusable profile",
    });
    const copy = firstProfile.closest("section")!.querySelector("[data-first-profile-copy]");
    expect(copy?.textContent).toMatch(/nickname, a review date, and broad interests/u);
    const header = screen.getByRole("heading", { level: 1 }).closest("header")!;
    const intro = header.querySelector("[data-page-intro]");
    expect(intro?.textContent).toMatch(/printable worksheet/u);
    for (const text of [copy?.textContent ?? "", header.textContent ?? ""]) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/capabilit/iu);
      expect(text).not.toMatch(/\bages?\b/iu);
    }
  });

  test("a file a newer version saved shows the newer-version message and offers no recovery or editing", async () => {
    const counts = stubConfigFailure(
      "CONFIG_VERSION_UNSUPPORTED",
      "The saved profile file was created by a newer unsupported version and was left unchanged.",
      '"sha256-newer"',
    );
    render(<App />);
    const heading = await screen.findByRole("heading", {
      name: "Saved profiles could not be opened",
    });
    const section = heading.closest("section")!;
    expect(within(section).getByRole("alert").textContent).toBe(NEWER_VERSION_MESSAGE);
    expect(NEWER_VERSION_MESSAGE).toMatch(/saved by a newer version of this app/u);
    expect(section.textContent).toMatch(/offers no\s+recovery/u);
    expect(
      screen.queryByRole("heading", { name: "The saved profile file needs attention" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Back up invalid file and replace" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Nickname (optional)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create worksheet" })).toBeNull();
    expect(counts.puts).toBe(0);
  });

  test("mirror: any other blocked read keeps the server's own message", async () => {
    stubConfigFailure(
      "CONFIG_UNSAFE_FILE",
      "The saved profile target is not a safe regular file and was left unchanged.",
    );
    render(<App />);
    const heading = await screen.findByRole("heading", {
      name: "Saved profiles could not be opened",
    });
    const alert = within(heading.closest("section")!).getByRole("alert");
    expect(alert.textContent).toBe(
      "The saved profile target is not a safe regular file and was left unchanged.",
    );
    expect(alert.textContent).not.toBe(NEWER_VERSION_MESSAGE);
  });
});
