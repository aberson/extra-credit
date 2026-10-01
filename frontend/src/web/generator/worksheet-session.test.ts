import { describe, expect, test } from "vitest";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  cloneWorksheetDefaults,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import {
  EARLIER_SETTINGS_GROUPS,
  selectionFromEarlierSettings,
} from "../../shared/config/earlier-settings";
import {
  WorksheetDefaultsV2Schema,
  type ChildProfileV2,
  type LegacyChoicesV2,
  type MathSkillsV1,
  type WorksheetDefaultsV2,
  type WorksheetSelectionV2,
} from "../../shared/config/schema";
import {
  WORKSHEET_GROUP_KEYS,
  defaultsForSave,
  earlierSettingsInUse,
  groupChanged,
  readGroup,
  worksheetSessionReducer,
  type WorksheetSessionAction,
  type WorksheetSessionState,
} from "./worksheet-session";

/*
 * Every child here is fictional and built at runtime. The two children with
 * earlier settings differ from the saved defaults in every group they cover,
 * so a group that silently fell back to the defaults is visible as a changed
 * value. They also differ from each other in every covered group except the
 * two-valued Statements and Vocabulary choices, where both differ from the
 * defaults and so must hold the same value.
 */

function skills(overrides: Partial<MathSkillsV1>): MathSkillsV1 {
  return {
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
    ...overrides,
  };
}

function child(
  index: number,
  legacyChoices?: LegacyChoicesV2,
  displayName?: string,
): ChildProfileV2 {
  return {
    id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    ...(displayName === undefined ? {} : { displayName }),
    reviewedOn: "2026-09-01",
    interests: [],
    ...(legacyChoices === undefined ? {} : { legacyChoices }),
  };
}

/** Equations with both operations at 15, quantities at 15, independent writing. */
const equationChild = child(
  1,
  {
    presentationBand: "early-primary",
    writingMode: "independent",
    mathSkills: skills({
      countingMax: 15,
      numeralMax: 15,
      compareMax: 15,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition", "subtraction"],
      operandMax: 15,
      resultMax: 15,
    }),
  },
  "Fictional First",
);

/** Addition to 5 with equality, quantities to 7, copy with a model, longer words. */
const secondChild = child(
  2,
  {
    presentationBand: "early-primary",
    writingMode: "copy-with-model",
    mathSkills: skills({
      countingMax: 7,
      numeralMax: 7,
      compareMax: 7,
      representations: ["quantities", "equations"],
      understandsEquality: true,
      operations: ["addition"],
      operandMax: 5,
      resultMax: 5,
    }),
  },
  "Fictional Second",
);

/** A child stored without earlier settings. */
const identityChild = child(3, undefined, "Fictional Third");

function defaults(
  overrides: Partial<WorksheetDefaultsV2> = {},
): WorksheetDefaultsV2 {
  return { ...cloneWorksheetDefaults(DEFAULT_WORKSHEET_DEFAULTS_V2), ...overrides };
}

const seedingDefaults = defaults({ useEarlierChildSettings: true });

function loaded(
  savedDefaults: WorksheetDefaultsV2,
  profiles: readonly ChildProfileV2[],
  state: WorksheetSessionState | null = null,
): WorksheetSessionState {
  const next = worksheetSessionReducer(state, {
    type: "loaded",
    defaults: savedDefaults,
    profiles,
  });
  if (next === null) {
    throw new Error("A loaded action always builds a session.");
  }
  return next;
}

function apply(
  state: WorksheetSessionState,
  ...actions: readonly WorksheetSessionAction[]
): WorksheetSessionState {
  let current: WorksheetSessionState | null = state;
  for (const action of actions) {
    current = worksheetSessionReducer(current, action);
  }
  if (current === null) {
    throw new Error("A started session never returns to null.");
  }
  return current;
}

/** The selection the child's earlier settings describe over the saved defaults. */
function seededFrom(
  savedDefaults: WorksheetDefaultsV2,
  profile: ChildProfileV2,
): WorksheetSelectionV2 {
  if (profile.legacyChoices === undefined) {
    throw new Error("The fixture child carries no earlier settings.");
  }
  return selectionFromEarlierSettings(
    profile.legacyChoices,
    worksheetSelectionOf(savedDefaults),
  ).selection;
}

describe("the initial selection", () => {
  test("equals the saved defaults while seeding is off, even for a child with earlier settings", () => {
    const saved = defaults({ worksheetType: "count-compare-make", length: "long" });
    const state = loaded(saved, [equationChild, secondChild]);
    expect(state.selection).toEqual(worksheetSelectionOf(saved));
    expect(state.selectedChildId).toBe(equationChild.id);
    expect(Object.values(state.touched).every((touched) => !touched)).toBe(true);
    expect(state.previewEpoch).toBe(0);
    // Every selection field is a group, or is split into groups field by field.
    for (const [field, value] of Object.entries(state.selection)) {
      const nested = WORKSHEET_GROUP_KEYS.filter((key) => key.startsWith(`${field}.`)).map(
        (key) => key.slice(field.length + 1),
      );
      if (nested.length > 0) {
        expect(nested.sort(), field).toEqual(Object.keys(value as object).sort());
      } else {
        expect(WORKSHEET_GROUP_KEYS as readonly string[], field).toContain(field);
      }
    }
  });

  test("equals the saved defaults while seeding is on for a child without earlier settings", () => {
    const state = loaded(seedingDefaults, [identityChild, equationChild]);
    expect(state.selection).toEqual(worksheetSelectionOf(seedingDefaults));
    expect(earlierSettingsInUse(state)).toBeUndefined();
  });

  test("follows the first child's earlier settings while seeding is on", () => {
    const state = loaded(seedingDefaults, [equationChild, secondChild]);
    expect(state.selection).toEqual(seededFrom(seedingDefaults, equationChild));
    // Non-vacuity: the seeded selection really differs from the defaults.
    expect(state.selection.dryMath).not.toEqual(seedingDefaults.dryMath);
    expect(state.selection.sentenceBuilder).not.toEqual(seedingDefaults.sentenceBuilder);
  });

  test("an empty profile list selects no child and shows the saved defaults", () => {
    const state = loaded(seedingDefaults, []);
    expect(state.selectedChildId).toBeNull();
    expect(state.selection).toEqual(worksheetSelectionOf(seedingDefaults));
  });

  test("any action before the first load changes nothing", () => {
    const actions: readonly WorksheetSessionAction[] = [
      { type: "reloaded", defaults: seedingDefaults, profiles: [equationChild] },
      { type: "childSelected", childId: equationChild.id },
      groupChanged("length", "long"),
      { type: "defaultsSaved", defaults: seedingDefaults },
      { type: "profilesChanged", profiles: [equationChild] },
    ];
    for (const action of actions) {
      expect(worksheetSessionReducer(null, action), action.type).toBeNull();
    }
  });
});

describe("two children with different earlier settings", () => {
  test("each gives its own values to every untouched group (mirror case)", () => {
    const first = loaded(seedingDefaults, [equationChild, secondChild]);
    const second = apply(first, { type: "childSelected", childId: secondChild.id });
    expect(first.selection).toEqual(seededFrom(seedingDefaults, equationChild));
    expect(second.selection).toEqual(seededFrom(seedingDefaults, secondChild));
    const saved = worksheetSelectionOf(seedingDefaults);
    // Neither child falls back to the saved defaults in any group it covers.
    for (const key of EARLIER_SETTINGS_GROUPS) {
      expect(readGroup(first.selection, key), key).not.toEqual(readGroup(saved, key));
      expect(readGroup(second.selection, key), key).not.toEqual(readGroup(saved, key));
    }
    // The two children differ wherever a group has more than two values.
    for (const key of [
      "dryMath",
      "findTheWow.quantity",
      "findTheWow.equation",
      "sentenceBuilder.variant",
      "countCompareMake",
    ] as const) {
      expect(readGroup(second.selection, key), key).not.toEqual(
        readGroup(first.selection, key),
      );
    }
  });
});

describe("touched groups", () => {
  const changedFocus = { operations: ["addition"], operandMax: 20, resultMax: 20 } as const;

  function touchedState(): WorksheetSessionState {
    return apply(
      loaded(seedingDefaults, [equationChild, secondChild]),
      groupChanged("dryMath", { ...changedFocus, operations: [...changedFocus.operations] }),
      groupChanged("sentenceBuilder.variant", "draw-and-tell"),
      groupChanged("printScale", "large"),
    );
  }

  function expectTouchedKept(state: WorksheetSessionState): void {
    expect(state.selection.dryMath).toEqual(changedFocus);
    expect(state.selection.sentenceBuilder.variant).toBe("draw-and-tell");
    expect(state.selection.printScale).toBe("large");
  }

  test("a change marks only its own group touched", () => {
    const state = touchedState();
    expect(
      WORKSHEET_GROUP_KEYS.filter((key) => state.touched[key]).sort(),
    ).toEqual(["dryMath", "printScale", "sentenceBuilder.variant"]);
    expectTouchedKept(state);
  });

  test("survive a child switch while untouched groups follow the new child", () => {
    const state = apply(touchedState(), {
      type: "childSelected",
      childId: secondChild.id,
    });
    expectTouchedKept(state);
    const seeded = seededFrom(seedingDefaults, secondChild);
    expect(state.selection.sentenceBuilder.vocabulary).toBe(
      seeded.sentenceBuilder.vocabulary,
    );
    expect(state.selection.countCompareMake).toEqual(seeded.countCompareMake);
  });

  test("survive a profile save while untouched groups follow the saved child", () => {
    const edited: ChildProfileV2 = {
      ...equationChild,
      legacyChoices: {
        ...equationChild.legacyChoices!,
        writingMode: "label",
        mathSkills: { ...equationChild.legacyChoices!.mathSkills, countingMax: 12 },
      },
    };
    const state = apply(touchedState(), {
      type: "profilesChanged",
      profiles: [edited, secondChild],
    });
    expectTouchedKept(state);
    expect(state.selection.countCompareMake.countingMax).toBe(12);
    expect(state.selectedChildId).toBe(equationChild.id);
  });

  test("survive an in-app reload while untouched groups follow the reloaded defaults", () => {
    const reloadedDefaults = defaults({
      useEarlierChildSettings: true,
      length: "short",
      paperSize: "a4",
      printScale: "standard",
    });
    const state = apply(touchedState(), {
      type: "reloaded",
      defaults: reloadedDefaults,
      profiles: [equationChild, secondChild],
    });
    expectTouchedKept(state);
    expect(state.selection.length).toBe("short");
    expect(state.selection.paperSize).toBe("a4");
  });

  test("survive a defaults save", () => {
    const before = touchedState();
    const state = apply(before, {
      type: "defaultsSaved",
      defaults: defaultsForSave(before),
    });
    expectTouchedKept(state);
    expect(state.selection).toEqual(before.selection);
    expect(state.touched).toEqual(before.touched);
    // A later reload with other defaults still leaves the changed groups alone.
    expectTouchedKept(
      apply(state, {
        type: "reloaded",
        defaults: defaults({
          printScale: "standard",
          sentenceBuilder: { variant: "label", vocabulary: "simpler-words" },
        }),
        profiles: state.profiles,
      }),
    );
  });

  test("start over on a later load", () => {
    const state = loaded(seedingDefaults, [equationChild], touchedState());
    expect(Object.values(state.touched).every((touched) => !touched)).toBe(true);
    expect(state.selection).toEqual(seededFrom(seedingDefaults, equationChild));
  });
});

describe("the worksheet-defaults save", () => {
  test("defaultsForSave is the visible selection with seeding off, seeded groups included", () => {
    const state = apply(
      loaded(seedingDefaults, [equationChild, secondChild]),
      groupChanged("length", "long"),
    );
    const saved = defaultsForSave(state);
    expect(saved).toEqual({ ...state.selection, useEarlierChildSettings: false });
    // The untouched seeded groups are part of it, not the saved defaults.
    expect(saved.dryMath).toEqual(seededFrom(seedingDefaults, equationChild).dryMath);
    expect(saved.dryMath).not.toEqual(seedingDefaults.dryMath);
    expect(WorksheetDefaultsV2Schema.parse(saved)).toEqual(saved);
  });

  test("defaultsSaved turns seeding off and nothing visible changes", () => {
    const before = loaded(seedingDefaults, [equationChild, secondChild]);
    const saved = defaultsForSave(before);
    const after = apply(before, { type: "defaultsSaved", defaults: saved });
    expect(after.base).toEqual(saved);
    expect(after.base.useEarlierChildSettings).toBe(false);
    expect(after.selection).toEqual(before.selection);
    // From now on a child switch shows the saved values, not the child's.
    const switched = apply(after, { type: "childSelected", childId: secondChild.id });
    expect(switched.selection).toEqual(worksheetSelectionOf(saved));
    expect(earlierSettingsInUse(switched)).toBeUndefined();
  });

  test("no action turns seeding back on once it is off", () => {
    const off = apply(loaded(seedingDefaults, [equationChild, secondChild]), {
      type: "defaultsSaved",
      defaults: defaultsForSave(loaded(seedingDefaults, [equationChild])),
    });
    const actions: readonly WorksheetSessionAction[] = [
      { type: "reloaded", defaults: seedingDefaults, profiles: [equationChild, secondChild] },
      { type: "loaded", defaults: seedingDefaults, profiles: [equationChild, secondChild] },
      { type: "childSelected", childId: secondChild.id },
      groupChanged("useInterests", false),
      { type: "profilesChanged", profiles: [secondChild, equationChild] },
      { type: "defaultsSaved", defaults: seedingDefaults },
    ];
    let state = off;
    for (const action of actions) {
      state = apply(state, action);
      expect(state.base.useEarlierChildSettings, action.type).toBe(false);
    }
    // Calibration: a session that never had seeding off keeps a reloaded `true`.
    expect(
      apply(loaded(seedingDefaults, [equationChild]), {
        type: "reloaded",
        defaults: seedingDefaults,
        profiles: [equationChild],
      }).base.useEarlierChildSettings,
    ).toBe(true);
  });
});

describe("the selected child", () => {
  test("deleting the selected child selects the first remaining profile", () => {
    const state = apply(loaded(seedingDefaults, [equationChild, secondChild, identityChild]), {
      type: "childSelected",
      childId: secondChild.id,
    });
    const afterDelete = apply(state, {
      type: "profilesChanged",
      profiles: [equationChild, identityChild],
    });
    expect(afterDelete.selectedChildId).toBe(equationChild.id);
    expect(afterDelete.selection).toEqual(seededFrom(seedingDefaults, equationChild));
    const lastDeleted = apply(afterDelete, { type: "profilesChanged", profiles: [] });
    expect(lastDeleted.selectedChildId).toBeNull();
  });

  test("a reload keeps the selected child while it still exists", () => {
    const state = apply(loaded(seedingDefaults, [equationChild, secondChild]), {
      type: "childSelected",
      childId: secondChild.id,
    });
    expect(
      apply(state, {
        type: "reloaded",
        defaults: seedingDefaults,
        profiles: [identityChild, secondChild],
      }).selectedChildId,
    ).toBe(secondChild.id);
    expect(
      apply(state, {
        type: "reloaded",
        defaults: seedingDefaults,
        profiles: [identityChild, equationChild],
      }).selectedChildId,
    ).toBe(identityChild.id);
  });

  test("an id that names no profile changes nothing", () => {
    const state = loaded(seedingDefaults, [equationChild]);
    expect(
      worksheetSessionReducer(state, {
        type: "childSelected",
        childId: identityChild.id,
      }),
    ).toBe(state);
  });
});

describe("the preview epoch", () => {
  test("rises once on each preview-invalidating action and never on a defaults save", () => {
    const start = loaded(seedingDefaults, [equationChild, secondChild]);
    const steps: readonly [WorksheetSessionAction, number][] = [
      [{ type: "reloaded", defaults: seedingDefaults, profiles: [equationChild, secondChild] }, 1],
      [groupChanged("worksheetType", "sentence-builder"), 1],
      [{ type: "profilesChanged", profiles: [equationChild, secondChild] }, 1],
      [{ type: "childSelected", childId: secondChild.id }, 1],
      [{ type: "defaultsSaved", defaults: defaultsForSave(start) }, 0],
      [{ type: "loaded", defaults: seedingDefaults, profiles: [equationChild] }, 1],
    ];
    let state = start;
    for (const [action, rise] of steps) {
      const next = apply(state, action);
      expect(`${action.type}: ${next.previewEpoch - state.previewEpoch}`).toBe(
        `${action.type}: ${rise}`,
      );
      state = next;
    }
  });
});

describe("the theme is its own choice", () => {
  test("the saved theme shows as saved, whatever the interests choice", () => {
    const state = loaded(defaults({ theme: "neutral", useInterests: true }), [identityChild]);
    expect(state.selection.theme).toBe("neutral");
    // Mirror: another saved theme beside interests off shows as saved too.
    const other = loaded(defaults({ theme: "space", useInterests: false }), [identityChild]);
    expect(other.selection.theme).toBe("space");
  });

  test("the interests toggle never moves the theme, and the save writes the chosen theme", () => {
    const state = loaded(defaults(), [identityChild, equationChild]);
    const chosen = apply(state, groupChanged("theme", "vehicles"));
    expect(chosen.selection.theme).toBe("vehicles");
    const interestsOff = apply(
      chosen,
      groupChanged("useInterests", false),
      { type: "childSelected", childId: equationChild.id },
      { type: "profilesChanged", profiles: [identityChild, equationChild] },
    );
    expect(interestsOff.selection.useInterests).toBe(false);
    expect(interestsOff.selection.theme).toBe("vehicles");
    expect(defaultsForSave(interestsOff)).toMatchObject({
      theme: "vehicles",
      useInterests: false,
    });
    // An untouched theme follows the saved defaults across a reload.
    const reloaded = apply(state, {
      type: "reloaded",
      defaults: defaults({ theme: "sports", useInterests: false }),
      profiles: [identityChild],
    });
    expect(reloaded.selection.theme).toBe("sports");
  });
});

describe("what the earlier settings supply", () => {
  test("names only untouched seeded groups and keeps clamps of those groups", () => {
    const beyond = child(9, {
      presentationBand: "early-primary",
      writingMode: "label",
      mathSkills: skills({
        countingMax: 25,
        numeralMax: 25,
        compareMax: 25,
        representations: ["quantities"],
        allowRegrouping: true,
      }),
    });
    const state = loaded(seedingDefaults, [beyond]);
    const before = earlierSettingsInUse(state);
    expect(before?.groups).toContain("countCompareMake");
    expect(
      before?.disclosures.filter(
        (disclosure) => disclosure.kind === "clamped" && disclosure.group === "countCompareMake",
      ),
    ).toHaveLength(3);
    const touched = apply(
      state,
      groupChanged("countCompareMake", { countingMax: 10, numeralMax: 10, compareMax: 10 }),
    );
    const after = earlierSettingsInUse(touched);
    expect(after?.groups).not.toContain("countCompareMake");
    expect(
      after?.disclosures.some(
        (disclosure) => disclosure.kind === "clamped" && disclosure.group === "countCompareMake",
      ),
    ).toBe(false);
    expect(after?.disclosures).toContainEqual({
      kind: "unused-permission",
      field: "allowRegrouping",
    });
  });
});
