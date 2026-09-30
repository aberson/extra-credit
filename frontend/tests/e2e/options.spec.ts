import { worksheetSelectionOf } from "../../src/shared/config/defaults.ts";
import { selectionFromEarlierSettings } from "../../src/shared/config/earlier-settings.ts";
import { classifyStoredConfig } from "../../src/shared/config/migrate.ts";
import type {
  AppConfigV1,
  AppConfigV2,
  ChildProfileV1,
  GenerationDefaultsV1,
  WorksheetDefaultsV2,
  WorksheetSelectionV2,
} from "../../src/shared/config/schema.ts";
import { expect, test } from "./fixtures/app-server.ts";
import {
  chooseChild,
  chooseLength,
  choosePrintLayout,
  chooseWorksheet,
  controls,
  openMoreOptions,
  setAnswerKey,
} from "./fixtures/worksheet-controls.ts";

/*
 * Step 9's worksheet-option contract, proved where only the compiled
 * application can prove it.
 *
 * Three claims live here rather than in a jsdom suite:
 *
 * 1. Capacity-aware availability (issue #14). A control that promises a page
 *    the generator then refuses is a browser-visible defect: the button is
 *    enabled, the page states a budget, and the click fails. The check is that
 *    the real button is really disabled and the real explanation is on screen
 *    BEFORE the click.
 *
 * 2. Stored defaults. They travel through the real loopback config API into
 *    the real local file and must come back after a real reload, with every
 *    child profile untouched. A mocked save cannot see a wiring failure here.
 *    Nor can a mocked save see what the write does to the REST of the page:
 *    saving defaults changes no child profile, so the generated worksheet the
 *    parent is about to print - whose seed came from `crypto.getRandomValues`
 *    and is not reproducible - and the child and family they selected must all
 *    still be there afterwards.
 *
 * 3. Stored-but-unused capabilities. Quantity limits above 20 and both future
 *    permissions remain disclosed; Dry Math can use the stored arithmetic
 *    limits while still excluding carrying, borrowing and negative answers.
 *
 * The defaults claim carries a geometry assertion for the same reason: where a
 * confirmation lands is a layout fact, and jsdom has no layout.
 */

const defaults: GenerationDefaultsV1 = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

/**
 * The version 2 config the app holds for an in-spec version 1 fixture: the
 * store's classifier upgrades it in memory, and the first explicit save
 * writes exactly that shape.
 */
function upgraded(profiles: readonly ChildProfileV1[]): AppConfigV2 {
  const stored: AppConfigV1 = { schemaVersion: 1, profiles: [...profiles], defaults };
  const classified = classifyStoredConfig(stored);
  if (classified.kind !== "legacy") {
    throw new Error("The in-spec version 1 fixture did not classify as legacy.");
  }
  return classified.config;
}

/**
 * What "Save these as worksheet defaults" writes while nothing but `changes`
 * has been touched: the visible selection, which is the selected child's
 * earlier settings over the saved defaults, with seeding turned off (D-save).
 */
function savedVisibleSelection(
  config: AppConfigV2,
  childIndex: number,
  changes: Partial<WorksheetSelectionV2>,
): WorksheetDefaultsV2 {
  const legacy = config.profiles[childIndex]?.legacyChoices;
  if (legacy === undefined) {
    throw new Error("The in-spec child carries no earlier settings.");
  }
  return {
    ...selectionFromEarlierSettings(legacy, worksheetSelectionOf(config.defaults)).selection,
    ...changes,
    useEarlierChildSettings: false,
  };
}

const profiles = [
  {
    id: "9f6c1f1a-1c2d-4e3f-8a4b-5c6d7e8f9a0b",
    displayName: "Distinctive Private Jordan",
    ageYears: 6,
    presentationBand: "early-primary",
    reviewedOn: "2026-08-22",
    mathSkills: {
      countingMax: 25,
      numeralMax: 25,
      compareMax: 25,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 25,
      resultMax: 25,
      allowRegrouping: true,
      allowNegativeResults: true,
    },
    writingMode: "sentence-frame",
    interests: ["Distinctive Private Nature"],
  },
  {
    id: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
    displayName: "Distinctive Private Riley",
    ageYears: 4,
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
    interests: ["Distinctive Private Space"],
  },
] as const satisfies readonly ChildProfileV1[];

/**
 * D36: a fictional child built at runtime whose earlier settings are
 * quantities to 7, so its Two Whats and a Wow focus holds seven stems - one
 * short of Long at standard scale, enough for Standard's six.
 */
const narrowQuantityChild = {
  ...profiles[1],
  id: "4e5f6a7b-8c9d-4e0f-8a1b-2c3d4e5f6a7b",
  displayName: "Distinctive Private Narrow",
  mathSkills: { ...profiles[1].mathSkills, countingMax: 7, numeralMax: 7, compareMax: 7 },
} satisfies ChildProfileV1;

test("refuses a length the confirmed limits cannot fill before the click", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({
    schemaVersion: 1,
    profiles: [...profiles, narrowQuantityChild],
    defaults,
  });
  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Narrow" }),
  ).toBeVisible();

  await chooseChild(page, narrowQuantityChild.id);
  await chooseWorksheet(page, "find-the-wow");
  await openMoreOptions(page);
  // Difficulty and its stretch confirmation are gone; the practice focus alone
  // decides the range.
  await expect(page.getByRole("combobox", { name: "Difficulty" })).toHaveCount(0);
  // The upgrade notice outside the panel names the retired Stretch on purpose.
  await expect(
    page.getByRole("region", { name: "Create a practice worksheet" }).getByText(/stretch/iu),
  ).toHaveCount(0);

  const createButton = page.getByRole("button", { name: "Create worksheet" });
  const conflict = page.locator("[data-capacity-conflict]");
  await expect(createButton).toBeEnabled();
  await expect(conflict).toHaveCount(0);

  await chooseLength(page, "long");

  // The earlier setting holds seven distinct quantity stems for a length that
  // needs eight, so the page must say so instead of offering the click.
  await expect(conflict).toHaveText(
    "This practice focus provides 7 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider counting and numerals range.",
  );
  await expect(createButton).toBeDisabled();
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);

  await chooseLength(page, "standard");
  await expect(conflict).toHaveCount(0);
  await expect(
    page.getByText("This selection creates 6 unique groups on one practice page."),
  ).toBeVisible();
  await expect(createButton).toBeEnabled();

  await createButton.click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "find-the-wow");
  await expect(preview.locator("[data-wow-group]")).toHaveCount(6);
});

test("saved worksheet defaults reload without changing a child profile", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  const seededProfiles = JSON.stringify((await appServer.readConfig()).profiles);

  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Jordan" }),
  ).toBeVisible();
  await openMoreOptions(page);
  await chooseLength(page, "long");
  await choosePrintLayout(page, { printScale: "large" });
  await choosePrintLayout(page, { paperSize: "a4" });
  await setAnswerKey(page, false);

  const saveButton = page.getByRole("button", {
    name: "Save these as worksheet defaults",
  });
  await saveButton.click();
  const confirmation = page.getByText("Worksheet defaults saved locally.");
  await expect(confirmation).toBeVisible();

  // Placement, not just presence. The confirmation used to render in the global
  // profiles status line near the top of the page, so the click produced no
  // visible change anywhere near the pointer; "somewhere in the panel" is
  // satisfied by that position too, and jsdom has no layout to tell them apart.
  const slot = page.locator("[data-defaults-slot]");
  const buttonBox = await saveButton.boundingBox();
  const confirmationBox = await confirmation.boundingBox();
  const slotBox = await slot.boundingBox();
  if (buttonBox === null || confirmationBox === null || slotBox === null) {
    throw new Error(
      "The defaults slot, the save button and its confirmation must all be laid out.",
    );
  }
  // Containment in the component's own slot rather than a pixel budget: the
  // slot is the hook the component names for this placement, so "inside it" is
  // the claim, and a rendered-distance ceiling would only be a proxy for it
  // that a copy change or a font swap can trip.
  //
  // The slack is for sub-pixel layout only. Chromium reports fractional CSS
  // pixels, so an exactly-contained box can report an edge a hair outside its
  // container's; one pixel cannot hide a confirmation that left the slot,
  // because leaving it moves the box by at least the slot's own padding.
  const SUBPIXEL_SLACK = 1;
  expect(
    {
      top: confirmationBox.y >= slotBox.y - SUBPIXEL_SLACK,
      left: confirmationBox.x >= slotBox.x - SUBPIXEL_SLACK,
      bottom:
        confirmationBox.y + confirmationBox.height <=
        slotBox.y + slotBox.height + SUBPIXEL_SLACK,
      right:
        confirmationBox.x + confirmationBox.width <=
        slotBox.x + slotBox.width + SUBPIXEL_SLACK,
    },
    `the confirmation must be laid out inside [data-defaults-slot]: confirmation ${JSON.stringify(
      confirmationBox,
    )} slot ${JSON.stringify(slotBox)}`,
  ).toEqual({ top: true, left: true, bottom: true, right: true });
  const gap = confirmationBox.y - (buttonBox.y + buttonBox.height);
  expect(gap, "the confirmation must sit below the button").toBeGreaterThanOrEqual(0);
  // Twice the slack, because this compares two independently laid-out boxes
  // rather than a box against the container it sits in: each of the two left
  // edges carries its own sub-pixel rounding.
  expect(
    Math.abs(confirmationBox.x - buttonBox.x),
    "the confirmation must share the button's left edge",
  ).toBeLessThanOrEqual(SUBPIXEL_SLACK * 2);

  // The save writes what the parent sees: the first child's earlier settings,
  // seeded into every untouched group, plus the four changes, with seeding off.
  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual(
    savedVisibleSelection(upgraded(profiles), 0, {
      length: "long",
      printScale: "large",
      paperSize: "a4",
      includeAnswerKey: false,
    }),
  );
  expect(saved.defaults.useEarlierChildSettings).toBe(false);
  expect(JSON.stringify(saved.profiles)).toBe(seededProfiles);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Jordan" }),
  ).toBeVisible();
  await openMoreOptions(page);
  await expect(controls(page).length()).toHaveValue("long");
  await expect(controls(page).printScale()).toHaveValue(
    "large",
  );
  await expect(controls(page).paperSize()).toHaveValue("a4");
  await expect(controls(page).answerKey()).not.toBeChecked();
  // The Dry Math focus the save wrote, the first child's earlier setting,
  // comes back after the reload.
  await expect(controls(page).practiceFocus().locator("option:checked")).toHaveText(
    "Earlier setting: Addition and subtraction within 25",
  );
});

test("saving defaults keeps the generated page and the parent's selection", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Riley" }),
  ).toBeVisible();

  // The second child is not the session's starting child, so a session reset
  // by the save would show as a silent switch back to the first child. After
  // the save the stored worksheet type is this one, so only the child tells a
  // reset apart.
  const childSelect = controls(page).child();
  const familyCard = controls(page).worksheetCard("count-compare-make");
  await chooseChild(page, profiles[1].id);
  await chooseWorksheet(page, "count-compare-make");

  await page.getByRole("button", { name: "Create worksheet" }).click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute(
    "data-worksheet-type",
    "count-compare-make",
  );
  const printedBefore = await preview.innerText();

  await page
    .getByRole("button", { name: "Save these as worksheet defaults" })
    .click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();

  // The exact page is still on screen: this seed is unrecoverable, so losing
  // it to a preference write is losing the sheet the parent was printing.
  await expect(preview).toBeVisible();
  expect(await preview.innerText()).toBe(printedBefore);
  await expect(page.getByRole("button", { name: "Make another" })).toBeVisible();
  await expect(childSelect).toHaveValue(profiles[1].id);
  await expect(familyCard).toBeChecked();

  const saved = await appServer.readConfig();
  expect(saved.profiles).toEqual(upgraded(profiles).profiles);
});

test("a superseded defaults save refreshes instead of stranding the control", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Jordan" }),
  ).toBeVisible();
  await openMoreOptions(page);
  await choosePrintLayout(page, { printScale: "large" });

  // Another writer changes the same file, so the ETag the open page holds is
  // no longer the current one - the situation that used to leave every later
  // click repeating the identical precondition failure.
  const renamed = [
    { ...profiles[0], displayName: "Distinctive Private Renamed" },
    profiles[1],
  ];
  await appServer.seedConfig({ schemaVersion: 1, profiles: renamed, defaults });

  const save = page.getByRole("button", {
    name: "Save these as worksheet defaults",
  });
  await save.click();
  await expect(
    page.getByText(
      "Saved profiles changed on this computer, so no worksheet defaults were changed. The latest file has been reloaded - press save again to keep these choices.",
    ),
  ).toBeVisible();
  // The refresh adopted the other writer's CONFIG, not just their ETag: a
  // page that carried only the new ETag forward would overwrite their edit.
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Renamed" }),
  ).toBeVisible();
  await expect(controls(page).printScale()).toHaveValue(
    "large",
  );

  await save.click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();
  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual(
    savedVisibleSelection(upgraded(renamed), 0, { printScale: "large" }),
  );
  expect(saved.profiles).toEqual(upgraded(renamed).profiles);
});

test("shows stored capabilities Version 1 keeps but never prints", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Jordan" }),
  ).toBeVisible();

  // The first child stores 25 everywhere and both future permissions. Dry
  // Math's own range reaches 100, so only the ceilings of the other families
  // clamp; each clamp and each flag is disclosed once, from earlier-settings.ts.
  await expect(page.locator("[data-earlier-settings-disclosure]")).toHaveText(
    "Earlier settings this version adjusts or does not use: Two Whats and a Wow quantity pictures counting: stored 25, using 20. Two Whats and a Wow quantity pictures numerals: stored 25, using 20. Two Whats and a Wow equations operands: stored 25, using 20. Two Whats and a Wow equations results: stored 25, using 20. Count, Compare & Make counting: stored 25, using 20. Count, Compare & Make numerals: stored 25, using 20. Count, Compare & Make comparisons: stored 25, using 20. Carrying and borrowing: stored but not used. Negative results: stored but not used.",
  );
  await page.getByRole("button", { name: "Create worksheet" }).click();
  const preview = page.getByLabel("Worksheet preview");
  await expect(preview).toHaveAttribute("data-worksheet-type", "dry-math");

  const statements = await preview
    .locator("[data-item-id] span")
    .allInnerTexts();
  expect(statements.length).toBeGreaterThan(0);
  for (const statement of statements) {
    const match = /^(\d+)\s*([+−])\s*(\d+)\s*=/u.exec(statement.trim());
    expect(match, `unparsed Dry Math statement: ${statement}`).not.toBeNull();
    const left = Number(match?.[1]);
    const right = Number(match?.[3]);
    const result = match?.[2] === "+" ? left + right : left - right;
    expect(Math.max(left, right, result)).toBeLessThanOrEqual(25);
    expect(result).toBeGreaterThanOrEqual(0);
  }
});

test("a superseded defaults save takes the stale worksheet down with it", async ({
  appServer,
  page,
}) => {
  // The existing conflict test above never creates a worksheet, and the
  // keep-the-page test above has no second writer, so the cell where a rendered
  // sheet meets a superseded save is covered by neither. That cell is where a
  // page built against limits the file no longer holds stayed on screen - and
  // stayed printable - with nothing marking it stale.
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Riley" }),
  ).toBeVisible();

  const childSelect = controls(page).child();
  const familyCard = controls(page).worksheetCard("count-compare-make");
  await chooseChild(page, profiles[1].id);
  await chooseWorksheet(page, "count-compare-make");
  await openMoreOptions(page);
  await choosePrintLayout(page, { printScale: "large" });

  await page.getByRole("button", { name: "Create worksheet" }).click();
  const preview = page.getByLabel("Worksheet preview");
  // NON-VACUITY: the sheet must really be on screen before the save, or the
  // absence asserted below proves nothing.
  await expect(preview).toHaveAttribute(
    "data-worksheet-type",
    "count-compare-make",
  );

  // Another writer renames Riley AND drops her numeral limit below what any
  // length can fill. Untied on purpose: every other quantity fixture in this
  // file is 25/25/25 or 10/10/10, so a tied triple here could not tell a
  // numeral-bounded refusal from a counting-bounded one.
  const superseded = [
    profiles[0],
    {
      ...profiles[1],
      displayName: "Distinctive Private Renamed Riley",
      mathSkills: {
        ...profiles[1].mathSkills,
        countingMax: 20,
        numeralMax: 2,
        compareMax: 20,
      },
    },
  ];
  await appServer.seedConfig({ schemaVersion: 1, profiles: superseded, defaults });

  const save = page.getByRole("button", {
    name: "Save these as worksheet defaults",
  });
  await save.click();
  await expect(
    page.getByText(
      "Saved profiles changed on this computer, so no worksheet defaults were changed. The latest file has been reloaded - press save again to keep these choices.",
    ),
  ).toBeVisible();

  // The other writer's config was adopted, and the sheet built from the
  // profiles it replaced is gone rather than left printable.
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Renamed Riley" }),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make another" })).toHaveCount(0);

  // The session is not reset: the selections and the retry survive the drop.
  await expect(childSelect).toHaveValue(profiles[1].id);
  await expect(familyCard).toBeChecked();
  await expect(controls(page).printScale()).toHaveValue(
    "large",
  );
  await expect(page.locator("[data-capacity-conflict]")).toHaveText(
    "This practice focus provides 0 unique numeral-matching exercises, but this length needs 2. Choose a practice focus with a wider numerals range.",
  );

  await save.click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();
  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual(
    savedVisibleSelection(upgraded(superseded), 1, {
      worksheetType: "count-compare-make",
      printScale: "large",
    }),
  );
  expect(saved.profiles).toEqual(upgraded(superseded).profiles);
});
