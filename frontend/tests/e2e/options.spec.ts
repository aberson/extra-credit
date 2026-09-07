import type {
  ChildProfileV1,
  GenerationDefaultsV1,
} from "../../src/shared/config/schema.ts";
import { expect, test } from "./fixtures/app-server.ts";

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
 * 3. Stored-but-unused capabilities. A profile may record a maximum above 20
 *    and both future permissions; the compiled page must show them and must
 *    still print only within-20 work.
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

test("refuses a length the confirmed limits cannot fill before the click", async ({
  appServer,
  page,
}) => {
  await appServer.seedConfig({ schemaVersion: 1, profiles: [...profiles], defaults });
  await page.goto(appServer.origin);
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Riley" }),
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Child profile" })
    .selectOption(profiles[1].id);
  await page
    .getByRole("combobox", { name: "Worksheet type" })
    .selectOption("find-the-wow");
  await page.getByText("More options").click();

  const createButton = page.getByRole("button", { name: "Create worksheet" });
  const conflict = page.locator("[data-capacity-conflict]");
  await expect(createButton).toBeEnabled();
  await expect(conflict).toHaveCount(0);

  await page
    .getByRole("combobox", { name: "Difficulty" })
    .selectOption("confidence");
  await page.getByRole("combobox", { name: "Length" }).selectOption("long");

  // The confidence downgrade leaves seven distinct quantity stems for a length
  // that needs eight, so the page must say so instead of offering the click.
  await expect(conflict).toHaveText(
    "The confirmed limits provide 7 unique quantity groups, but this length needs 8. Choose a shorter worksheet or review the profile's counting and numerals limits. Setting Difficulty to Practice also fills this selection, without changing the profile.",
  );
  await expect(createButton).toBeDisabled();
  await expect(page.getByText(/This selection creates/)).toHaveCount(0);

  await page.getByRole("combobox", { name: "Length" }).selectOption("standard");
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
  await page.getByText("More options").click();
  await page.getByRole("combobox", { name: "Length" }).selectOption("long");
  await page.getByRole("combobox", { name: "Print scale" }).selectOption("large");
  await page.getByRole("combobox", { name: "Paper size" }).selectOption("a4");
  await page.getByLabel("Include a parent answer key").uncheck();

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
  expect(
    Math.abs(confirmationBox.x - buttonBox.x),
    "the confirmation must share the button's left edge",
  ).toBeLessThanOrEqual(SUBPIXEL_SLACK * 2);

  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual({
    ...defaults,
    length: "long",
    printScale: "large",
    paperSize: "a4",
    includeAnswerKey: false,
  });
  expect(JSON.stringify(saved.profiles)).toBe(seededProfiles);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Distinctive Private Jordan" }),
  ).toBeVisible();
  await page.getByText("More options").click();
  await expect(page.getByRole("combobox", { name: "Length" })).toHaveValue("long");
  await expect(page.getByRole("combobox", { name: "Print scale" })).toHaveValue(
    "large",
  );
  await expect(page.getByRole("combobox", { name: "Paper size" })).toHaveValue("a4");
  await expect(page.getByLabel("Include a parent answer key")).not.toBeChecked();
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

  // Neither of these two is the value the panel initialises to, so a remount
  // is visible as a silent switch back to Jordan and Dry Math - which is what
  // a parent would then press Create on.
  const childSelect = page.getByRole("combobox", { name: "Child profile" });
  const familySelect = page.getByRole("combobox", { name: "Worksheet type" });
  await childSelect.selectOption(profiles[1].id);
  await familySelect.selectOption("count-compare-make");

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
  await expect(familySelect).toHaveValue("count-compare-make");

  const saved = await appServer.readConfig();
  expect(saved.profiles).toEqual([...profiles]);
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
  await page.getByText("More options").click();
  await page.getByRole("combobox", { name: "Print scale" }).selectOption("large");

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
  await expect(page.getByRole("combobox", { name: "Print scale" })).toHaveValue(
    "large",
  );

  await save.click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();
  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual({ ...defaults, printScale: "large" });
  expect(saved.profiles).toEqual(renamed);
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

  await expect(
    page.getByText(
      "Stored limits reach counting 25, numerals 25, comparisons 25, operands 25, results 25; Version 1 uses at most 20.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This profile also allows carrying and borrowing, and negative results; Version 1 never uses them.",
    ),
  ).toBeVisible();
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
    expect(Math.max(left, right, result)).toBeLessThanOrEqual(20);
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

  const childSelect = page.getByRole("combobox", { name: "Child profile" });
  const familySelect = page.getByRole("combobox", { name: "Worksheet type" });
  await childSelect.selectOption(profiles[1].id);
  await familySelect.selectOption("count-compare-make");
  await page.getByText("More options").click();
  await page.getByRole("combobox", { name: "Print scale" }).selectOption("large");

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

  // The panel is not remounted: the selections and the retry survive the drop.
  await expect(childSelect).toHaveValue(profiles[1].id);
  await expect(familySelect).toHaveValue("count-compare-make");
  await expect(page.getByRole("combobox", { name: "Print scale" })).toHaveValue(
    "large",
  );
  await expect(page.locator("[data-capacity-conflict]")).toHaveText(
    "The confirmed limits provide 0 unique numeral-matching exercises, but this length needs 2. Review the profile's numerals limits.",
  );

  await save.click();
  await expect(page.getByText("Worksheet defaults saved locally.")).toBeVisible();
  const saved = await appServer.readConfig();
  expect(saved.defaults).toEqual({ ...defaults, printScale: "large" });
  expect(saved.profiles).toEqual(superseded);
});
