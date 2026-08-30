import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";
import { z } from "zod";

/**
 * Mechanical guard for every plan.md line citation in this repository.
 *
 * A `plan.md:NNN` reference in a comment is a claim about a line of a LIVING
 * document. Nothing about it is checked by the compiler, the linter, or any
 * other test, and every edit to plan.md silently rots every citation below the
 * edit. Step 8 was gated three consecutive times on exactly that shape - one
 * round fixed a wrong citation and introduced another two lines away - which is
 * this workspace's stop-and-audit signal: stop hand-verifying named lines and
 * make the invariant mechanical instead.
 *
 * The contract has two halves and fails in BOTH directions:
 *
 * 1. UNREGISTERED SITE. Every `(citing file, cited plan line)` pair found by
 *    scanning the tree must have an entry in `plan-citations.json`, and that
 *    entry's `siteCount` must equal how many sites the scan found for it.
 *    Adding a citation without registering its anchor fails here, and so does
 *    a SECOND citation of a line that file already cites.
 * 2. DRIFTED LINE. Every registered anchor must still sit on the plan.md line
 *    the citation names, and on no other line. Editing plan.md so a cited
 *    clause moves fails here, and the failure message names the line the clause
 *    moved TO, so the repair is mechanical rather than another hand re-read.
 *
 * A third check keeps the manifest honest in the other direction: an entry
 * whose citations have all been deleted is reported as stale.
 *
 * The manifest deliberately keys on `(file, plan line)` and NOT on the citing
 * file's own line number. A citing line number is the same rotting reference
 * one level up: it would break on every unrelated edit to the citing file and
 * would need exactly the hand-maintenance this guard exists to remove.
 * `siteCount` closes what that key alone would miss - a second, unreviewed
 * citation of a line the file already cites - without putting a citing line
 * number in the manifest.
 *
 * Placement: this lives beside the other real-filesystem contract tests rather
 * than under `src/`, because nothing in the shipped application reads it. It is
 * a repository contract, like `ci-contract.test.ts`, not runtime data.
 */

/* --------------------------------------------------------------------------
 * Paths - resolved from this module's own URL, never from the CWD
 * ----------------------------------------------------------------------- */

const testDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(testDirectory, "../..");
const repositoryRoot = resolve(frontendRoot, "..");
const manifestPath = resolve(testDirectory, "plan-citations.json");

/**
 * The plan file, named once. The fixtures below build their sample citations
 * from this constant instead of writing the literal text, so this module's own
 * source carries no scannable citation and the scan can therefore cover this
 * file like any other rather than needing a self-exemption.
 */
const PLAN_FILE = "plan.md";

/**
 * Places scanned for citations, repository-relative. `recursive: false` reads
 * one directory's own files and none of its subdirectories: the repository
 * root is covered that way, so the scan never descends into gitignored output
 * such as `frontend/dist`, whose compiled copies of these comments would
 * otherwise be scanned as citations of their own.
 */
const SCANNED_ROOTS = [
  { path: ".", recursive: false },
  { path: "frontend/src", recursive: true },
  { path: "frontend/scripts", recursive: true },
  { path: "frontend/tests", recursive: true },
  { path: "documentation", recursive: true },
] as const;

const SCANNED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".md",
  ".json",
  ".html",
];

/**
 * The single form, plus the continuation form several comments use for a second
 * line. Written as a literal, this pattern does not match itself: the source
 * text here reads a backslash before the dot, which is not the character the
 * pattern requires there.
 */
const CITATION_PATTERN = /plan\.md:(\d+)((?:\s*,\s*:\d+)*)/gu;
const CONTINUATION_PATTERN = /:(\d+)/gu;

/* --------------------------------------------------------------------------
 * The committed manifest
 * ----------------------------------------------------------------------- */

/**
 * The same validated-JSON-manifest shape `web/assets/line-art/manifest.json`
 * uses: a dependency-free JSON source of truth, parsed and validated by a
 * strict schema, so a malformed or half-edited manifest fails loudly instead of
 * silently weakening the guard it feeds.
 */
const PlanCitationManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  planFile: z.literal(PLAN_FILE),
  citations: z
    .array(
      z.strictObject({
        file: z.string().min(1),
        planLine: z.number().int().positive(),
        // How many sites in `file` cite `planLine`. Counting them is what
        // makes a second citation of an already-registered line fail
        // registration, with no citing line number in the manifest.
        siteCount: z.number().int().positive(),
        // Long enough to be distinctive. A short anchor could sit on many
        // lines, and a drifted citation would then still find a match.
        anchors: z.array(z.string().min(16)).min(1),
      }),
    )
    .min(1),
});

type PlanCitationManifest = z.infer<typeof PlanCitationManifestSchema>;

function readManifest(): PlanCitationManifest {
  return PlanCitationManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")),
  );
}

/* --------------------------------------------------------------------------
 * Pure helpers - every rule is a function, so the negative cases at the end can
 * EXECUTE it on synthetic input instead of asserting in prose that it would
 * fail. A guard nobody has watched fail is a guard nobody has tested.
 * ----------------------------------------------------------------------- */

interface CitationSite {
  readonly file: string;
  readonly line: number;
  readonly planLine: number;
}

function lineNumberAt(text: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text[cursor] === "\n") {
      line += 1;
    }
  }
  return line;
}

/** Every citation in one file's source text, including continuation forms. */
export function extractCitations(
  file: string,
  text: string,
): readonly CitationSite[] {
  const sites: CitationSite[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const line = lineNumberAt(text, match.index);
    const planLines = [
      Number(match[1]),
      ...[...(match[2] ?? "").matchAll(CONTINUATION_PATTERN)].map(
        (continuation) => Number(continuation[1]),
      ),
    ];
    for (const planLine of planLines) {
      sites.push({ file, line, planLine });
    }
  }
  return sites;
}

function directoryOf(root: (typeof SCANNED_ROOTS)[number]): string {
  return root.path === "." ? repositoryRoot : `${repositoryRoot}/${root.path}`;
}

function filesUnder(directory: string, recursive: boolean): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (recursive) {
        found.push(...filesUnder(path, true));
      }
    } else if (SCANNED_EXTENSIONS.some((suffix) => path.endsWith(suffix))) {
      found.push(path);
    }
  }
  return found;
}

function scanRepository(): readonly CitationSite[] {
  const sites: CitationSite[] = [];
  for (const root of SCANNED_ROOTS) {
    for (const path of filesUnder(directoryOf(root), root.recursive)) {
      const file = path.slice(repositoryRoot.length + 1).replaceAll("\\", "/");
      sites.push(...extractCitations(file, readFileSync(path, "utf8")));
    }
  }
  return sites;
}

function keyOf(file: string, planLine: number): string {
  return `${file} -> ${String(planLine)}`;
}

/**
 * Direction 1: a citation the manifest does not register, counting sites so a
 * second citation of an already-registered line is reported rather than
 * absorbed by the entry that already exists.
 */
export function unregisteredSites(
  sites: readonly CitationSite[],
  manifest: PlanCitationManifest,
): readonly string[] {
  const declared = new Map(
    manifest.citations.map((entry) => [
      keyOf(entry.file, entry.planLine),
      entry.siteCount,
    ]),
  );
  const found = new Map<string, CitationSite[]>();
  for (const site of sites) {
    const key = keyOf(site.file, site.planLine);
    const group = found.get(key);
    if (group === undefined) {
      found.set(key, [site]);
    } else {
      group.push(site);
    }
  }

  const failures: string[] = [];
  for (const [key, group] of found) {
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    const lines = [...group]
      .sort((left, right) => left.line - right.line)
      .map((site) => String(site.line))
      .join(", ");
    const where = `${first.file}:${lines} cites ${PLAN_FILE} line ${String(first.planLine)}`;
    const declaredCount = declared.get(key);
    if (declaredCount === undefined) {
      failures.push(`${where} with no manifest entry`);
    } else if (declaredCount !== group.length) {
      failures.push(
        `${where} at ${String(group.length)} sites, but its manifest entry declares siteCount ${String(declaredCount)}; register every site`,
      );
    }
  }
  return failures.sort();
}

/** The other half of the same bookkeeping: an entry nothing cites any more. */
export function staleEntries(
  sites: readonly CitationSite[],
  manifest: PlanCitationManifest,
): readonly string[] {
  const cited = new Set(sites.map((site) => keyOf(site.file, site.planLine)));
  return manifest.citations
    .filter((entry) => !cited.has(keyOf(entry.file, entry.planLine)))
    .map(
      (entry) =>
        `${entry.file} no longer cites ${PLAN_FILE} line ${String(entry.planLine)}; drop the manifest entry`,
    )
    .sort();
}

/**
 * Direction 2: an anchor that no longer sits on the line its citation names.
 *
 * The anchor must appear on EXACTLY ONE plan line. That uniqueness is what
 * turns a failure into a repair instruction: when plan.md gains or loses lines
 * above a cited clause, the clause itself is still unique, so the message can
 * name the line it moved to.
 */
export function driftedAnchors(
  manifest: PlanCitationManifest,
  planLines: readonly string[],
): readonly string[] {
  const failures: string[] = [];
  for (const entry of manifest.citations) {
    for (const anchor of entry.anchors) {
      const matches: number[] = [];
      planLines.forEach((text, index) => {
        if (text.includes(anchor)) {
          matches.push(index + 1);
        }
      });
      const where = `${entry.file} -> ${PLAN_FILE} line ${String(entry.planLine)}`;
      const quoted = JSON.stringify(anchor);
      if (matches.length === 0) {
        failures.push(
          `${where}: anchor ${quoted} is no longer anywhere in ${PLAN_FILE}; re-read the clause, then fix both the citation and the anchor`,
        );
      } else if (matches.length > 1) {
        failures.push(
          `${where}: anchor ${quoted} is not distinctive - it appears on lines ${matches.join(", ")}; choose a longer anchor`,
        );
      } else if (matches[0] !== entry.planLine) {
        failures.push(
          `${where}: anchor ${quoted} has moved to line ${String(matches[0])}; update every citation of line ${String(entry.planLine)} in that file, and this entry`,
        );
      }
    }
  }
  return failures.sort();
}

/* --------------------------------------------------------------------------
 * The gate
 * ----------------------------------------------------------------------- */

describe("plan citations are mechanically checked", () => {
  const planLines = readFileSync(
    resolve(repositoryRoot, PLAN_FILE),
    "utf8",
  ).split(/\r?\n/u);
  const manifest = readManifest();
  const sites = scanRepository();

  test("the scan itself reached the tree", () => {
    expect(planLines.length).toBeGreaterThan(500);
    expect(sites.length).toBeGreaterThan(50);
    expect(new Set(sites.map((site) => site.file)).size).toBeGreaterThan(10);
    for (const root of SCANNED_ROOTS) {
      expect(
        filesUnder(directoryOf(root), root.recursive).length,
        root.path,
      ).toBeGreaterThan(0);
    }
  });

  test("every citation in the repository is registered", () => {
    expect(unregisteredSites(sites, manifest)).toEqual([]);
  });

  test("the manifest registers nothing the repository stopped citing", () => {
    expect(staleEntries(sites, manifest)).toEqual([]);
  });

  test("every registered anchor still sits on the line its citation names", () => {
    expect(driftedAnchors(manifest, planLines)).toEqual([]);
  });

  test("the extractor reads both citation forms, and only real ones", () => {
    // The pattern IS the guard. This pins it against a fixture assembled from
    // PLAN_FILE, so the fixture is never itself a citation in this file.
    const fixture = [
      `// ${PLAN_FILE}:208 - the single form.`,
      ` * (${PLAN_FILE}:202, :212) - the continuation form.`,
      ` * A range, ${PLAN_FILE}:493-501, keeps only its first line.`,
      ` * Not citations: other-${PLAN_FILE}, a bare ${PLAN_FILE}, ${PLAN_FILE}:NNN.`,
    ].join("\n");

    expect(extractCitations("fixture.ts", fixture)).toEqual([
      { file: "fixture.ts", line: 1, planLine: 208 },
      { file: "fixture.ts", line: 2, planLine: 202 },
      { file: "fixture.ts", line: 2, planLine: 212 },
      { file: "fixture.ts", line: 3, planLine: 493 },
    ]);
  });

  test("the guard fails in both directions, executed rather than asserted", () => {
    const entry = manifest.citations[0];
    if (entry === undefined) {
      throw new Error("The manifest declares no citations.");
    }
    const anchor = entry.anchors[0];
    if (anchor === undefined) {
      throw new Error("The first manifest entry declares no anchor.");
    }

    // Direction 1: a citation site with no manifest entry. Measured as a
    // DELTA against the real tree, so this negative proof stays valid (and
    // stays a clean diagnostic) even on a run where the gate above is red.
    const registeredBaseline = unregisteredSites(sites, manifest).length;
    const unregistered = unregisteredSites(
      [...sites, { file: "frontend/src/invented.ts", line: 7, planLine: 208 }],
      manifest,
    );
    expect(unregistered).toHaveLength(registeredBaseline + 1);
    expect(
      unregistered.filter((failure) =>
        failure.includes("frontend/src/invented.ts:7"),
      ),
    ).toHaveLength(1);

    // Direction 1b: a SECOND citation of a plan line this file already cites.
    // The entry that already exists does NOT absorb it - `siteCount` counts.
    const duplicated = unregisteredSites(
      [...sites, { file: entry.file, line: 1, planLine: entry.planLine }],
      manifest,
    );
    expect(duplicated).toHaveLength(registeredBaseline + 1);
    expect(
      duplicated.filter(
        (failure) =>
          failure.includes(entry.file) && failure.includes("siteCount"),
      ),
    ).toHaveLength(1);

    // Direction 2a: the cited clause moved. Inserting one line above it is
    // exactly what an edit to plan.md does to every citation below the edit.
    const shifted = ["<an inserted heading>", ...planLines];
    const drifted = driftedAnchors({ ...manifest, citations: [entry] }, shifted);
    expect(drifted).toHaveLength(entry.anchors.length);
    expect(drifted[0]).toContain(
      `has moved to line ${String(entry.planLine + 1)}`,
    );

    // Direction 2b: the cited clause left plan.md altogether.
    const removed = planLines.map((text) => text.replaceAll(anchor, ""));
    expect(
      driftedAnchors(
        { ...manifest, citations: [{ ...entry, anchors: [anchor] }] },
        removed,
      ),
    ).toHaveLength(1);

    // Direction 3: a manifest entry nothing cites any more, measured as the
    // same kind of delta.
    const staleBaseline = staleEntries(sites, manifest).length;
    const stale = staleEntries(sites, {
      ...manifest,
      citations: [
        ...manifest.citations,
        {
          anchors: [anchor],
          file: "frontend/src/deleted.ts",
          planLine: 208,
          siteCount: 1,
        },
      ],
    });
    expect(stale).toHaveLength(staleBaseline + 1);
    expect(
      stale.filter((failure) => failure.includes("frontend/src/deleted.ts")),
    ).toHaveLength(1);
  });
});
