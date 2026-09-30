import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { worksheetSelectionOf } from "../../src/shared/config/defaults.js";
import { selectionFromEarlierSettings } from "../../src/shared/config/earlier-settings.js";
import { classifyStoredConfig } from "../../src/shared/config/migrate.js";
import {
  EARLIER_SETTING_OPTION_ID,
  matchPracticeFocusOption,
} from "../../src/shared/config/practice-focus.js";

/*
 * Appendix B.3 over the three canonical fictional records, read from the
 * permanent version 1 fixture exactly as the store reads a version 1 file:
 * the classifier upgrades it in memory, and each migrated child's
 * `legacyChoices` is mapped over the file's own upgraded defaults.
 */

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PATH = resolve(frontendRoot, "tests/fixtures/config/children.v1.json");

const classified = classifyStoredConfig(JSON.parse(readFileSync(FIXTURE_PATH, "utf8")));
if (classified.kind !== "legacy") {
  throw new Error(`The version 1 fixture classified as ${classified.kind}, not legacy.`);
}
const config = classified.config;
const base = worksheetSelectionOf(config.defaults);

function mapped(position: number) {
  const profile = config.profiles[position];
  if (profile?.legacyChoices === undefined) {
    throw new Error(`Canonical record ${position + 1} carried no earlier settings.`);
  }
  return selectionFromEarlierSettings(profile.legacyChoices, base);
}

describe("the canonical records' earlier settings", () => {
  test("the fixture holds exactly three migrated records, each with earlier settings", () => {
    expect(config.profiles).toHaveLength(3);
    expect(config.profiles.every((profile) => profile.legacyChoices !== undefined)).toBe(true);
    expect(config.defaults.useEarlierChildSettings).toBe(true);
  });

  test("canonical 1, quantities only, keeps the base Dry Math focus and takes Quantity pictures", () => {
    const { selection, groups, disclosures } = mapped(0);
    expect(groups).toEqual([
      "findTheWow.variant",
      "findTheWow.quantity",
      "sentenceBuilder.variant",
      "sentenceBuilder.vocabulary",
      "countCompareMake",
    ]);
    expect(selection.dryMath).toEqual(base.dryMath);
    expect(selection.findTheWow.variant).toBe("quantity");
    expect(selection.findTheWow.quantity).toEqual({ countingMax: 10, numeralMax: 10 });
    expect(selection.countCompareMake).toEqual({ countingMax: 10, numeralMax: 10, compareMax: 10 });
    expect(selection.sentenceBuilder).toEqual({ variant: "label", vocabulary: "simpler-words" });
    expect(disclosures).toEqual([]);
    expect(matchPracticeFocusOption("find-the-wow-quantity", selection.findTheWow.quantity)).toBe(
      "quantities-to-10",
    );
  });

  test("canonical 2 seeds addition and subtraction within 10, Equations and all words", () => {
    const { selection, groups, disclosures } = mapped(1);
    expect(groups).toHaveLength(7);
    const withinTen = { operations: ["addition", "subtraction"], operandMax: 10, resultMax: 10 };
    expect(selection.dryMath).toEqual(withinTen);
    expect(selection.findTheWow).toEqual({
      variant: "equation",
      quantity: { countingMax: 20, numeralMax: 20 },
      equation: withinTen,
    });
    expect(selection.sentenceBuilder).toEqual({ variant: "sentence-frame", vocabulary: "all-words" });
    expect(disclosures).toEqual([]);
    expect(matchPracticeFocusOption("dry-math", selection.dryMath)).toBe(
      "addition-and-subtraction-within-10",
    );
  });

  test("canonical 3 seeds addition and subtraction within 20 and Independent Writing", () => {
    const { selection, disclosures } = mapped(2);
    const withinTwenty = { operations: ["addition", "subtraction"], operandMax: 20, resultMax: 20 };
    expect(selection.dryMath).toEqual(withinTwenty);
    expect(selection.findTheWow.equation).toEqual(withinTwenty);
    expect(selection.findTheWow.variant).toBe("equation");
    expect(selection.countCompareMake).toEqual({ countingMax: 20, numeralMax: 20, compareMax: 20 });
    expect(selection.sentenceBuilder).toEqual({ variant: "independent", vocabulary: "all-words" });
    expect(disclosures).toEqual([]);
  });

  test("every canonical focus is a catalog entry, never an earlier-setting option", () => {
    for (const position of [0, 1, 2]) {
      const { selection } = mapped(position);
      expect(matchPracticeFocusOption("dry-math", selection.dryMath)).not.toBe(EARLIER_SETTING_OPTION_ID);
      expect(matchPracticeFocusOption("find-the-wow-equation", selection.findTheWow.equation)).not.toBe(
        EARLIER_SETTING_OPTION_ID,
      );
      expect(matchPracticeFocusOption("find-the-wow-quantity", selection.findTheWow.quantity)).not.toBe(
        EARLIER_SETTING_OPTION_ID,
      );
      expect(matchPracticeFocusOption("count-compare-make", selection.countCompareMake)).not.toBe(
        EARLIER_SETTING_OPTION_ID,
      );
    }
  });
});
