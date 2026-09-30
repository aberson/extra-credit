import type { PrintScale } from "../../../src/shared/worksheet/types.ts";
import { projectGenerationRequest } from "../../../src/shared/worksheet/project-request.ts";
import { getWorksheetRegistration } from "../../../src/shared/worksheet/registry.ts";
import type { WorksheetDefaultsV2 } from "../../../src/shared/config/schema.ts";
import {
  acceptanceConfig,
  boundaryNickname,
  capabilitiesOf,
  practicePreferences,
} from "./matrix.ts";

// Independent upper budgets in CSS px, rounded UP from the physical layout.
// A4's narrower columns wrap the comparison sentence once more at 16 pt.
// All text remains 16/18 pt, quantities are at most 20 (four mark rows), and
// one or two five-by-two frames occupy the same height in print.
// UAT spacing adds 1 mm total vertical padding, while replacing two 1 px
// borders with a 0.3 mm rule: round the net increase up to 3 px per card.
export function countCardBounds(paper: "letter" | "a4", scale: PrintScale) {
  return scale === "large"
    ? { match: 143, compare: 260, complete: 146, draw: 120 }
    : { match: 111, compare: paper === "letter" ? 211 : 240, complete: 130, draw: 107 };
}

export type CountActivity = keyof ReturnType<typeof countCardBounds>;

export function countOrderBound(paper: "letter" | "a4", scale: PrintScale) {
  const heights = countCardBounds(paper, scale);
  const remaining = scale === "large"
    ? { match: 2, compare: 2, complete: 2, draw: 2 }
    : { match: 3, compare: 3, complete: 2, draw: 2 };
  const length = scale === "large" ? 8 : 10;
  let permutations = 0;
  let maximum = 0;
  let worst: CountActivity[] = [];
  function visit(order: CountActivity[]) {
    if (order.length === length) {
      permutations += 1;
      // Each card includes an upward-rounded 2.5 mm trailing gap. For each
      // legal reading order, choose the best contiguous two-column split.
      const sizes = order.map((activity) => heights[activity] + 10);
      const total = sizes.reduce((sum, height) => sum + height, 0);
      let prefix = 0;
      let best = Number.POSITIVE_INFINITY;
      for (const height of sizes.slice(0, -1)) {
        prefix += height;
        best = Math.min(best, Math.max(prefix, total - prefix));
      }
      if (best > maximum) {
        maximum = best;
        worst = [...order];
      }
      return;
    }
    for (const activity of Object.keys(remaining) as CountActivity[]) {
      if (remaining[activity] > 0) {
        remaining[activity] -= 1;
        visit([...order, activity]);
        remaining[activity] += 1;
      }
    }
  }
  visit([]);
  return { heights, permutations, maximum, worst };
}

export function countSeedFixture(seed: number, paper: "letter" | "a4", scale: PrintScale) {
  const original = acceptanceConfig.profiles[2];
  if (original === undefined) throw new Error("Missing canonical Avery.");
  const profile = { ...original, displayName: boundaryNickname };
  // The stored defaults the spec seeds, and the projection preferences the
  // panel builds from them at Practice.
  const defaults: WorksheetDefaultsV2 = {
    ...acceptanceConfig.defaults,
    length: "long",
    printScale: scale,
    paperSize: paper,
    includeDecorativeGraphics: false,
  };
  const preferences = practicePreferences(defaults);
  const registration = getWorksheetRegistration("count-compare-make");
  const projected = projectGenerationRequest({
    profile: capabilitiesOf(profile), preferences, worksheetType: "count-compare-make",
    generatorVersion: registration.generatorVersion,
    seed: seed.toString(16).padStart(8, "0"),
  });
  if (!projected.ok) throw new Error(projected.message);
  const result = registration.generate(projected.request, {
    worksheetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  if (!result.ok) throw new Error(result.message);
  return { profile, defaults, preferences, document: result.document };
}
