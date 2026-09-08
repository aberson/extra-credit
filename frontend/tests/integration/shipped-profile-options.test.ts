import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  DIFFICULTIES,
  PRINT_SCALES,
  WORKSHEET_LENGTHS,
  parseAppConfigV1,
  type ChildProfileV1,
  type GenerationDefaultsV1,
} from "../../src/shared/config/schema.js";
import { projectAndGenerateWorksheet } from "../../src/shared/worksheet/project-request.js";
import {
  REGISTERED_WORKSHEET_IDS,
  getWorksheetRegistration,
  type WorksheetControlContextV1,
} from "../../src/shared/worksheet/registry.js";

/*
 * The capacity guard for issue #14, run over the profiles a parent is really
 * shipped rather than over fixtures written to pass.
 *
 * The reported defect was reachable with the example configuration: the
 * age-four profile at confidence/long. That file is repository data, so the
 * check that it never offers an unproducible selection belongs here, where a
 * test may read it - the web project builds without Node type or file access.
 * `src/web/generator/options.test.tsx` runs the same shape over its own
 * fixtures, adds a starved fixture per family, and adds the control-level
 * assertions.
 */

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const shippedProfiles: readonly ChildProfileV1[] = parseAppConfigV1(
  JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "config/children.example.json"),
      "utf8",
    ),
  ),
).profiles;

const basePreferences: GenerationDefaultsV1 = {
  useDisplayName: true,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: true,
  paperSize: "letter",
  printScale: "standard",
};

/** The age-four profile and combination the issue #14 report was filed against. */
const REPORTED_REFUSAL = {
  worksheetType: "find-the-wow",
  profileId: "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
  difficulty: "confidence",
  length: "long",
  printScale: "standard",
} as const;

describe("shipped example profiles", () => {
  test("never offer a selection the generator would reject", () => {
    const offered: string[] = [];
    const refusals: {
      worksheetType: string;
      profileId: string;
      difficulty: string;
      length: string;
      printScale: string;
    }[] = [];
    for (const worksheetType of REGISTERED_WORKSHEET_IDS) {
      const registration = getWorksheetRegistration(worksheetType);
      for (const profile of shippedProfiles) {
        for (const difficulty of DIFFICULTIES) {
          for (const length of WORKSHEET_LENGTHS) {
            for (const printScale of PRINT_SCALES) {
              const context: WorksheetControlContextV1 = {
                profile,
                difficulty,
                length,
                printScale,
              };
              const support =
                registration.controls.getCapabilitySupport(context);
              if (!support.available) {
                continue;
              }
              const generated = projectAndGenerateWorksheet(
                {
                  profile,
                  worksheetType,
                  generatorVersion: registration.generatorVersion,
                  seed: "1234abcd",
                  stretchConfirmed: true,
                  preferences: registration.controls.projectPreferences(
                    context,
                    { ...basePreferences, difficulty, length, printScale },
                  ),
                },
                registration.generate,
                {
                  worksheetId: "77777777-7777-4777-8777-777777777777",
                },
              );
              const where = `${worksheetType} ${profile.id} ${difficulty}/${length}/${printScale}`;
              if (support.capacity.sufficient) {
                expect(
                  generated.ok ? "produced" : `${where}: ${generated.message}`,
                ).toBe("produced");
                offered.push(where);
              } else {
                expect(
                  `${where}: ${generated.ok ? "produced" : "refused"}`,
                ).toBe(`${where}: refused`);
                refusals.push({
                  worksheetType,
                  profileId: profile.id,
                  difficulty,
                  length,
                  printScale,
                });
              }
            }
          }
        }
      }
    }

    // A sweep that offers nothing proves nothing.
    expect(offered.length).toBeGreaterThan(0);
    // `refusals.length > 0` would let ANY refusal stand in for the reported
    // one: a shipped-data edit that made the age-four case producible while
    // some unrelated combination started refusing would keep the counter
    // positive and quietly retire the regime this file exists to watch.
    expect(refusals).toContainEqual(REPORTED_REFUSAL);
    // Every profile in the shipped file must still reach the offered side, so
    // a data edit cannot leave one silently unusable in every family.
    for (const { id } of shippedProfiles) {
      expect(`${id} offered ${offered.some((where) => where.includes(id))}`).toBe(
        `${id} offered true`,
      );
    }
  });
});
