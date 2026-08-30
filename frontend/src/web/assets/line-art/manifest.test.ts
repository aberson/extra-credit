// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";

import {
  ChildProfileV1Schema,
  type ChildProfileV1,
  type GenerationDefaultsV1,
} from "../../../shared/config/schema";
import { projectGenerationRequest } from "../../../shared/worksheet/project-request";
import {
  TOPIC_IDS,
  type TopicId,
  type WorksheetDocumentV1,
} from "../../../shared/worksheet/types";
import { SENTENCE_BUILDER_DEFINITION } from "../../../worksheets/sentence-builder/definition";
import { generateSentenceBuilder } from "../../../worksheets/sentence-builder/generator";
import { DecorativeGraphic } from "../../preview/DecorativeGraphic";
import { WorksheetPreview } from "../../preview/WorksheetPreview";
import {
  LINE_ART_ASSETS,
  LINE_ART_CATALOG_DEFECTS,
  LINE_ART_DIRECTORY,
  LINE_ART_MANIFEST,
  LINE_ART_TOPIC_IDS,
  SVG_SAFETY_RULES,
  buildLineArtCatalog,
  decorativeAssetsForTopic,
  isSafeSvgMarkup,
  parseLineArtManifest,
  selectDecorativeAsset,
  svgSafetyViolations,
  type LineArtAssetV1,
  type SvgSafetyRule,
} from "./manifest";

import manifestJsonText from "./manifest.json?raw";
import manifestSourceText from "./manifest.ts?raw";

/**
 * An independent directory scan, resolved by the bundler over the real
 * working tree, so it sees a committed SVG whether or not any module already
 * references it. RECURSIVE, matching the module's own discovery glob and the
 * `**\/*.svg` walk plan.md:740 gives the release audit.
 *
 * Repository-root files (`ASSET_PROVENANCE.md`, `CONTRIBUTING.md`, `LICENSE`)
 * are deliberately NOT read here. This file cannot IMPORT one: it runs under
 * `// @vitest-environment jsdom` (line 1), and from there Vite denies a module
 * ID outside `frontend/`, measured as `Denied ID .../ASSET_PROVENANCE.md?raw`.
 * That is a fact about THIS file's environment, not about the unit suite -
 * `vitest.config.ts` sets `environment: "node"` for everything that does not
 * override it. Either way `node:fs` would work from here, so the reason the
 * contract is not checked here is ownership, not capability:
 * `tests/e2e/graphics.spec.ts` already owns the whole repository-root contract
 * from Node and is the ledger/manifest drift gate the ledger itself names.
 */
const committedSvgMarkup = import.meta.glob<string>("./**/*.svg", {
  eager: true,
  import: "default",
  query: "?raw",
});

const committedSvgUrls = import.meta.glob<string>("./**/*.svg", {
  eager: true,
  import: "default",
  query: "?no-inline",
});

function committedMarkupFor(repositoryRelativePath: string): string | undefined {
  return committedSvgMarkup[
    `./${repositoryRelativePath.slice(LINE_ART_DIRECTORY.length)}`
  ];
}

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------
 * manifest.json is the single machine-readable source
 * ---------------------------------------------------------------------- */

describe("the reviewed line-art manifest", () => {
  test("loads every committed asset with complete original provenance", () => {
    expect(LINE_ART_CATALOG_DEFECTS).toEqual([]);
    expect(LINE_ART_MANIFEST.length).toBeGreaterThan(0);
    expect(LINE_ART_ASSETS).toHaveLength(LINE_ART_MANIFEST.length);

    for (const entry of LINE_ART_MANIFEST) {
      expect(entry.path, entry.id).toBe(
        `${LINE_ART_DIRECTORY}${entry.id}.svg`,
      );
      expect(entry.path, entry.id).not.toContain("\\");
      expect(entry.path, entry.id).not.toMatch(/:\/\//u);
      expect(entry.id, entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
      expect(entry.topics.length, entry.id).toBeGreaterThan(0);
      for (const topic of entry.topics) {
        expect(LINE_ART_TOPIC_IDS as readonly string[], entry.id).toContain(
          topic,
        );
      }
      expect(entry.creator.length, entry.id).toBeGreaterThan(0);
      expect(entry.source.length, entry.id).toBeGreaterThan(0);
      expect(entry.description.length, entry.id).toBeGreaterThan(0);
      expect(entry.reviewedOn, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      // plan.md:244 permits AI-assisted asset creation and requires the note
      // to record it. A row that hid the assistance would be a false ledger.
      expect(entry.aiAssistance, entry.id).toMatch(/ai[- ]assist/iu);
      expect(entry.origin, entry.id).toBe("original");
      expect(entry.license, entry.id).toBe("MIT");
      expect(entry.licenseFile, entry.id).toBe("LICENSE");
    }

    const ids = LINE_ART_MANIFEST.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = LINE_ART_MANIFEST.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("is the only copy of the data the runtime uses", () => {
    // manifest.ts must import the same JSON, not restate it. Re-validating
    // that exact file text has to reproduce the runtime rows precisely.
    expect(parseLineArtManifest(manifestJsonText)).toEqual(LINE_ART_MANIFEST);
  });

  test("covers every committed SVG and every allowlisted topic", () => {
    const committed = Object.keys(committedSvgMarkup)
      .map((key) => `${LINE_ART_DIRECTORY}${key.replace(/^\.\//u, "")}`)
      .sort();
    expect(committed.length).toBeGreaterThan(0);
    expect(committed).toEqual(
      LINE_ART_MANIFEST.map((entry) => entry.path).sort(),
    );

    for (const topicId of TOPIC_IDS) {
      expect(decorativeAssetsForTopic(topicId).length, topicId).toBeGreaterThan(
        0,
      );
    }
  });

  test("bundles the exact bytes the manifest path names", () => {
    for (const asset of LINE_ART_ASSETS) {
      expect(asset.markup, asset.id).toBe(committedMarkupFor(asset.path));
      expect(asset.url, asset.id).toContain(asset.id);
      expect(asset.url, asset.id).not.toMatch(/^[a-z][a-z0-9+.-]*:\/\//iu);
      expect(asset.url, asset.id).not.toMatch(/^data:/iu);
    }
  });
});

/* -------------------------------------------------------------------------
 * The validator rejects malformed and incomplete rows
 * ---------------------------------------------------------------------- */

const ORIGINAL_ROW = {
  id: "neutral-star",
  topics: ["neutral"],
  description: "A five-pointed star drawn as a single plain outline.",
  creator: "Extra Credit contributors",
  source: "This repository (frontend/src/web/assets/line-art/)",
  reviewedOn: "2026-08-24",
  aiAssistance:
    "AI-assisted during development, then reviewed and committed under the root MIT license.",
  origin: "original",
  license: "MIT",
  licenseFile: "LICENSE",
} as const;

const COMPLETE_THIRD_PARTY_ROW = {
  id: "future-borrowed-mark",
  topics: ["neutral"],
  description: "A hypothetical future third-party mark.",
  creator: "Upstream Example Studio",
  source: "https://example.invalid/line-art/borrowed-mark.svg",
  reviewedOn: "2026-08-24",
  aiAssistance: "No AI assistance; received as-is from the upstream project.",
  origin: "third-party",
  license: "CC-BY-4.0",
  licenseFile: "third-party-licenses/borrowed-mark.LICENSE",
  notice: "Borrowed Mark (c) Upstream Example Studio, used under CC BY 4.0.",
} as const;

function manifestTextFor(
  row: Record<string, unknown>,
  overridePath?: string,
): string {
  const path = overridePath ?? `${LINE_ART_DIRECTORY}${String(row.id)}.svg`;
  return JSON.stringify({ schemaVersion: 1, assets: { [path]: row } });
}

/**
 * A manifest that is complete and valid EXCEPT for its schema version, so a
 * rejection is attributable to the version alone. The empty-assets manifest
 * used previously was rejected for two independent reasons at once, which
 * meant a regressed `z.literal(1)` would still have looked rejected.
 */
function manifestTextAtVersion(schemaVersion: unknown): string {
  return JSON.stringify({
    schemaVersion,
    assets: {
      [`${LINE_ART_DIRECTORY}${ORIGINAL_ROW.id}.svg`]: ORIGINAL_ROW,
    },
  });
}

function withoutField(
  row: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const copy = { ...row };
  delete copy[field];
  return copy;
}

describe("the manifest validator", () => {
  test("accepts the canonical original row", () => {
    const rows = parseLineArtManifest(manifestTextFor({ ...ORIGINAL_ROW }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.path).toBe(`${LINE_ART_DIRECTORY}neutral-star.svg`);
  });

  test("accepts version 1 and rejects every other schema version", () => {
    // The positive control is what makes the rejections below attributable:
    // this manifest differs from the accepted one ONLY in its version, so a
    // version literal that regressed to 2 turns this test red rather than
    // sliding through on an unrelated defect.
    expect(parseLineArtManifest(manifestTextAtVersion(1))).toHaveLength(1);
    for (const version of [0, 2, "1", 1.5, null, true]) {
      expect(() =>
        parseLineArtManifest(manifestTextAtVersion(version)),
      ).toThrow(/LINE_ART_MANIFEST_INVALID/u);
    }
  });

  test("validates a review date exactly like a profile review date", () => {
    // `manifest.ts` cannot import `schema.ts`'s private calendar helper, so
    // the two are pinned to the same verdict here. Shape-only validation
    // would accept the impossible dates in this table.
    const profile = ChildProfileV1Schema.parse({
      id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
      ageYears: 6,
      presentationBand: "early-primary",
      reviewedOn: "2026-08-22",
      mathSkills: {
        countingMax: 20,
        numeralMax: 20,
        compareMax: 20,
        representations: ["quantities"],
        understandsEquality: false,
        operations: [],
        operandMax: 0,
        resultMax: 0,
        allowRegrouping: false,
        allowNegativeResults: false,
      },
      writingMode: "label",
      interests: [],
    });

    for (const candidate of [
      "2026-08-24",
      "2024-02-29",
      "2026-02-29",
      "2026-13-01",
      "2026-00-10",
      "2026-04-31",
      "2026-8-4",
      "24 August 2026",
      "",
    ]) {
      const manifestAccepts = ((): boolean => {
        try {
          parseLineArtManifest(
            manifestTextFor({ ...ORIGINAL_ROW, reviewedOn: candidate }),
          );
          return true;
        } catch {
          return false;
        }
      })();
      const profileAccepts = ChildProfileV1Schema.safeParse({
        ...profile,
        reviewedOn: candidate,
      }).success;
      expect(manifestAccepts, candidate).toBe(profileAccepts);
    }
  });

  test("accepts a COMPLETE future third-party row", () => {
    // The third-party branch must be genuinely reachable, otherwise the
    // rejection tests below would only be proving that everything fails.
    const rows = parseLineArtManifest(
      manifestTextFor({ ...COMPLETE_THIRD_PARTY_ROW }),
    );
    expect(rows[0]?.origin).toBe("third-party");
  });

  const rejected: ReadonlyArray<{ label: string; text: string }> = [
    { label: "text that is not JSON", text: "{not json" },
    {
      // Every unknown schema version is covered by the dedicated test above,
      // which pairs the rejections with a positive control. This row used to
      // repeat `manifestTextAtVersion(2)` byte for byte - two tests, one
      // input, one fact - so it now covers a class nothing else did.
      label: "a manifest with no assets field at all",
      text: JSON.stringify({ schemaVersion: 1 }),
    },
    {
      label: "an unknown extra field",
      text: manifestTextFor({ ...ORIGINAL_ROW, artist: "someone else" }),
    },
    {
      label: "an original row with a non-MIT license",
      text: manifestTextFor({ ...ORIGINAL_ROW, license: "CC-BY-4.0" }),
    },
    {
      label: "an original row pointing at a second license file",
      text: manifestTextFor({
        ...ORIGINAL_ROW,
        licenseFile: "LICENSE-LINE-ART",
      }),
    },
    {
      label: "a row with no AI-assistance note",
      text: manifestTextFor(withoutField({ ...ORIGINAL_ROW }, "aiAssistance")),
    },
    {
      label: "a row with no creator",
      text: manifestTextFor(withoutField({ ...ORIGINAL_ROW }, "creator")),
    },
    {
      label: "a row with no source",
      text: manifestTextFor(withoutField({ ...ORIGINAL_ROW }, "source")),
    },
    {
      label: "a row with no review date",
      text: manifestTextFor(withoutField({ ...ORIGINAL_ROW }, "reviewedOn")),
    },
    {
      label: "a row with a malformed review date",
      text: manifestTextFor({ ...ORIGINAL_ROW, reviewedOn: "24 August 2026" }),
    },
    {
      label: "a row reviewed on a date that never happened",
      text: manifestTextFor({ ...ORIGINAL_ROW, reviewedOn: "2026-02-29" }),
    },
    {
      label: "a row with a blank creator",
      text: manifestTextFor({ ...ORIGINAL_ROW, creator: "   " }),
    },
    {
      label: "a topic outside the allowlist",
      text: manifestTextFor({ ...ORIGINAL_ROW, topics: ["dinosaurs"] }),
    },
    {
      label: "an empty topic list",
      text: manifestTextFor({ ...ORIGINAL_ROW, topics: [] }),
    },
    {
      label: "an asset ID that is not kebab-case",
      text: manifestTextFor({ ...ORIGINAL_ROW, id: "Neutral_Star" }),
    },
    {
      label: "a path key that does not match its asset ID",
      text: manifestTextFor(
        { ...ORIGINAL_ROW },
        `${LINE_ART_DIRECTORY}some-other-file.svg`,
      ),
    },
    {
      label: "a Windows-style path key",
      text: manifestTextFor(
        { ...ORIGINAL_ROW },
        "frontend\\src\\web\\assets\\line-art\\neutral-star.svg",
      ),
    },
    {
      label: "a path key that escapes the line-art directory",
      text: manifestTextFor(
        { ...ORIGINAL_ROW },
        "../../../../etc/neutral-star.svg",
      ),
    },
    {
      label: "a remote URL as the path key",
      text: manifestTextFor(
        { ...ORIGINAL_ROW },
        "https://example.invalid/neutral-star.svg",
      ),
    },
    {
      label: "a duplicated path key",
      text: `{"schemaVersion":1,"assets":{"${LINE_ART_DIRECTORY}neutral-star.svg":${JSON.stringify(
        ORIGINAL_ROW,
      )},"${LINE_ART_DIRECTORY}neutral-star.svg":${JSON.stringify(
        ORIGINAL_ROW,
      )}}}`,
    },
    {
      label: "a manifest with no assets at all",
      text: JSON.stringify({ schemaVersion: 1, assets: {} }),
    },
    {
      label: "a third-party row with no required notice",
      text: manifestTextFor(
        withoutField({ ...COMPLETE_THIRD_PARTY_ROW }, "notice"),
      ),
    },
    {
      label: "a third-party row with no upstream license",
      text: manifestTextFor(
        withoutField({ ...COMPLETE_THIRD_PARTY_ROW }, "license"),
      ),
    },
    {
      label: "a third-party row with no separate license file",
      text: manifestTextFor(
        withoutField({ ...COMPLETE_THIRD_PARTY_ROW }, "licenseFile"),
      ),
    },
    {
      label: "a third-party row relicensed under the root MIT license",
      text: manifestTextFor({
        ...COMPLETE_THIRD_PARTY_ROW,
        licenseFile: "LICENSE",
      }),
    },
    {
      label: "a third-party row with no upstream source URL",
      text: manifestTextFor({
        ...COMPLETE_THIRD_PARTY_ROW,
        source: "someone sent it to me",
      }),
    },
    {
      label: "an unknown origin",
      text: manifestTextFor({ ...ORIGINAL_ROW, origin: "public-domain" }),
    },
  ];

  for (const { label, text } of rejected) {
    test(`rejects ${label}`, () => {
      expect(() => parseLineArtManifest(text)).toThrow(
        /LINE_ART_MANIFEST_INVALID/u,
      );
    });
  }
});

/* -------------------------------------------------------------------------
 * SVG safety is enforced, not merely asserted
 * ---------------------------------------------------------------------- */

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"';

const HOSTILE_MARKUP: ReadonlyArray<{
  label: string;
  markup: string;
  rule: SvgSafetyRule;
}> = [
  {
    label: "a script element",
    markup: `${SVG_OPEN}><script>alert(1)</script></svg>`,
    rule: "script-element",
  },
  {
    label: "a foreignObject",
    markup: `${SVG_OPEN}><foreignObject><b>x</b></foreignObject></svg>`,
    rule: "foreign-object",
  },
  {
    label: "an on* event-handler attribute",
    markup: `${SVG_OPEN} onload="alert(1)"><path d="M0 0" /></svg>`,
    rule: "event-handler-attribute",
  },
  {
    label: "a javascript: URI",
    markup: `${SVG_OPEN}><a href="javascript:alert(1)"><path d="M0 0" /></a></svg>`,
    rule: "javascript-uri",
  },
  {
    label: "a remote reference",
    markup: `${SVG_OPEN}><path fill="https://example.invalid/x" d="M0 0" /></svg>`,
    rule: "remote-reference",
  },
  {
    label: "a use element pointing at another document",
    markup: `${SVG_OPEN}><use href="other-file.svg#icon" /></svg>`,
    rule: "external-reference",
  },
  {
    label: "an image element with a remote href",
    markup: `${SVG_OPEN}><image xlink:href="https://example.invalid/x.png" /></svg>`,
    rule: "embedded-document-element",
  },
  {
    label: "a DOCTYPE and entity declaration",
    markup: `<!DOCTYPE svg [<!ENTITY x "y">]>${SVG_OPEN}></svg>`,
    rule: "doctype-or-entity",
  },
  {
    label: "a processing instruction",
    markup: `<?xml-stylesheet href="theme.css"?>${SVG_OPEN}></svg>`,
    rule: "processing-instruction",
  },
  {
    label: "an off-document url() reference",
    markup: `${SVG_OPEN}><path d="M0 0" fill="url(http://example.invalid/g.svg#g)" /></svg>`,
    rule: "external-style-reference",
  },
  {
    label: "an @import stylesheet",
    markup: `${SVG_OPEN}><style>@import "theme.css";</style></svg>`,
    rule: "style-import",
  },
  {
    label: "an embedded data: URI",
    markup: `${SVG_OPEN}><desc>data:text/html;base64,PHNjcmlwdD4=</desc></svg>`,
    rule: "data-uri",
  },
  {
    label: "markup that is not an SVG at all",
    markup: "<html><body>not art</body></html>",
    rule: "not-an-svg-root",
  },
];

describe("SVG safety", () => {
  test("proves EVERY rule the validator declares, and no phantom rule", () => {
    // Without this, `SVG_SAFETY_RULES` is a list nothing consumes and the
    // hostile table is free to drift away from it: a rule could be added
    // with no case that proves it fires, or deleted while its case kept
    // passing against some other rule. Binding the two makes either a
    // build failure.
    //
    // Bound by SET rather than by count. A second hostile case for a rule
    // that already has one is strictly more coverage, and a length assertion
    // would have turned that red - punishing the only change to this table
    // that can never weaken it. Removal is still caught from both sides: a
    // declared rule with no case leaves the sets unequal, and a case for a
    // rule that has been deleted leaves them unequal too.
    const provenBy = new Map<SvgSafetyRule, number>();
    for (const entry of HOSTILE_MARKUP) {
      provenBy.set(entry.rule, (provenBy.get(entry.rule) ?? 0) + 1);
    }
    expect([...provenBy.keys()].sort()).toEqual([...SVG_SAFETY_RULES].sort());
    for (const rule of SVG_SAFETY_RULES) {
      expect(provenBy.get(rule) ?? 0, rule).toBeGreaterThan(0);
    }
    expect(new Set(SVG_SAFETY_RULES).size).toBe(SVG_SAFETY_RULES.length);
  });

  test("passes every committed asset", () => {
    for (const asset of LINE_ART_ASSETS) {
      expect(svgSafetyViolations(asset.markup), asset.id).toEqual([]);
      expect(isSafeSvgMarkup(asset.markup), asset.id).toBe(true);
    }
  });

  test("passes plain art that only references its own document", () => {
    // The calibration anchor: a validator that rejected everything would
    // make every rejection below meaningless.
    const safe = `${SVG_OPEN}><defs><path id="a" d="M0 0 L10 10" /></defs><use href="#a" /><path d="M0 0" fill="url(#a)" /></svg>`;
    expect(svgSafetyViolations(safe)).toEqual([]);
  });

  for (const { label, markup, rule } of HOSTILE_MARKUP) {
    test(`rejects ${label}`, () => {
      expect(svgSafetyViolations(markup)).toContain(rule);
      expect(isSafeSvgMarkup(markup)).toBe(false);
    });
  }
});

/* -------------------------------------------------------------------------
 * Selection: exact topic allowlist, deterministic, neutral-safe fallback
 * ---------------------------------------------------------------------- */

function fakeAsset(id: string, topics: readonly TopicId[]): LineArtAssetV1 {
  return {
    id,
    topics: [...topics],
    description: `Synthetic ${id}.`,
    creator: "Extra Credit contributors",
    source: "This repository (frontend/src/web/assets/line-art/)",
    reviewedOn: "2026-08-24",
    aiAssistance: "AI-assisted synthetic fixture.",
    origin: "original",
    license: "MIT",
    licenseFile: "LICENSE",
    path: `${LINE_ART_DIRECTORY}${id}.svg`,
    markup: `${SVG_OPEN}><path d="M0 0" /></svg>`,
    url: `/assets/${id}.svg`,
  };
}

describe("decorative selection", () => {
  test("selects only through exact allowlisted topic IDs", () => {
    for (const topicId of TOPIC_IDS) {
      const asset = selectDecorativeAsset(topicId, "0000002a");
      expect(asset, topicId).toBeDefined();
      expect(asset?.topics as readonly string[], topicId).toContain(topicId);
    }

    for (const unknownTopic of [
      "dinosaurs",
      "Neutral",
      " neutral",
      "neutral ",
      "NEUTRAL",
      "",
      "space-rocket",
      "Distinctive Private Unicorns",
    ]) {
      expect(
        selectDecorativeAsset(unknownTopic, "0000002a"),
        unknownTopic,
      ).toBeUndefined();
      expect(decorativeAssetsForTopic(unknownTopic), unknownTopic).toEqual([]);
    }
  });

  test("is deterministic for a request and seed, and does consult the seed", () => {
    const catalog = [
      fakeAsset("alpha-mark", ["neutral"]),
      fakeAsset("beta-mark", ["neutral"]),
      fakeAsset("gamma-mark", ["neutral"]),
      fakeAsset("delta-mark", ["space"]),
    ];
    const picks = new Set<string>();
    for (let seed = 1; seed <= 64; seed += 1) {
      const seedHex = seed.toString(16).padStart(8, "0");
      const first = selectDecorativeAsset("neutral", seedHex, catalog);
      const second = selectDecorativeAsset("neutral", seedHex, catalog);
      expect(first, seedHex).toBeDefined();
      expect(second, seedHex).toBe(first);
      expect(first?.topics as readonly string[], seedHex).toContain("neutral");
      if (first !== undefined) {
        picks.add(first.id);
      }
    }
    // The seed is genuinely consulted rather than always taking index zero.
    expect(picks.size).toBeGreaterThan(1);
    expect(picks.has("delta-mark")).toBe(false);
  });

  test("falls back rather than widening when nothing matches", () => {
    expect(selectDecorativeAsset("neutral", "0000002a", [])).toBeUndefined();
    expect(
      selectDecorativeAsset("sports", "0000002a", [
        fakeAsset("alpha-mark", ["neutral"]),
      ]),
    ).toBeUndefined();
  });

  test("never throws a page down over a malformed seed", () => {
    for (const seed of ["00000000", "zzzzzzzz", "", "1", "0000002A"]) {
      expect(selectDecorativeAsset("neutral", seed), seed).toBeUndefined();
    }
  });
});

/* -------------------------------------------------------------------------
 * Reached from production: the registered Sentence Builder renderer
 * ---------------------------------------------------------------------- */

const WORKSHEET_ID = "77777777-7777-4777-8777-777777777777";

const defaults: GenerationDefaultsV1 = {
  useDisplayName: false,
  useInterests: true,
  includeDecorativeGraphics: true,
  difficulty: "practice",
  length: "standard",
  includeAnswerKey: false,
  paperSize: "letter",
  printScale: "standard",
};

const profile: ChildProfileV1 = {
  id: "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
  displayName: "Private Morgan",
  ageYears: 6,
  presentationBand: "early-primary",
  reviewedOn: "2026-08-22",
  mathSkills: {
    countingMax: 20,
    numeralMax: 20,
    compareMax: 20,
    representations: ["quantities"],
    understandsEquality: false,
    operations: [],
    operandMax: 0,
    resultMax: 0,
    allowRegrouping: false,
    allowNegativeResults: false,
  },
  writingMode: "label",
  interests: ["Space"],
};

function sentenceDocumentFor(
  includeDecorativeGraphics: boolean,
  seed = "0000002a",
): WorksheetDocumentV1 {
  const projection = projectGenerationRequest({
    profile,
    preferences: { ...defaults, includeDecorativeGraphics },
    worksheetType: SENTENCE_BUILDER_DEFINITION.id,
    generatorVersion: SENTENCE_BUILDER_DEFINITION.generatorVersion,
    seed,
  });
  if (!projection.ok) {
    throw new Error(projection.message);
  }
  const result = generateSentenceBuilder(projection.request, {
    worksheetId: WORKSHEET_ID,
  });
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.document;
}

interface RenderedSurface {
  readonly artIds: readonly string[];
  readonly bankWords: readonly string[];
  readonly decoration: string | null;
  readonly decorativePanels: number;
  readonly doodleBoxes: number;
  readonly items: number;
  readonly prompt: string | null;
  readonly requiredResponse: string | null;
  readonly responsePanelHtml: string | null;
}

function renderSentencePage(
  worksheetDocument: WorksheetDocumentV1,
): RenderedSurface {
  const { unmount } = render(
    createElement(WorksheetPreview, { document: worksheetDocument }),
  );
  const surface: RenderedSurface = {
    artIds: [...document.querySelectorAll("[data-decorative-art]")].map(
      (node) => node.getAttribute("data-decorative-art") ?? "",
    ),
    bankWords: [...document.querySelectorAll("[data-bank-word]")].map(
      (node) => node.textContent?.trim() ?? "",
    ),
    decoration:
      document
        .querySelector("[data-decorative-panel]")
        ?.getAttribute("data-decoration") ?? null,
    decorativePanels: document.querySelectorAll("[data-decorative-panel]")
      .length,
    doodleBoxes: document.querySelectorAll("[data-doodle-box]").length,
    items: document.querySelectorAll("[data-sentence-item]").length,
    prompt:
      document.querySelector("[data-sentence-prompt]")?.textContent?.trim() ??
      null,
    requiredResponse:
      document
        .querySelector("[data-sentence-item]")
        ?.getAttribute("data-required-response") ?? null,
    responsePanelHtml:
      document.querySelector("[data-response-panel]")?.innerHTML ?? null,
  };
  unmount();
  return surface;
}

describe("decoration reaches the page through the registered renderer", () => {
  test("renders reviewed art with EMPTY alt text when graphics are on", () => {
    const { unmount } = render(
      createElement(WorksheetPreview, { document: sentenceDocumentFor(true) }),
    );
    const panels = document.querySelectorAll("[data-decorative-panel]");
    expect(panels).toHaveLength(1);
    expect(panels[0]?.getAttribute("data-decoration")).toBe("art");

    const images = document.querySelectorAll("img[data-decorative-art]");
    // Non-vacuity: the graphics-on state really does carry decoration, so the
    // graphics-independence comparisons below are not 0 against 0.
    expect(images).toHaveLength(1);
    const image = images[0];
    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.getAttribute("data-decorative-art")).toBe("space-rocket");
    expect(image?.getAttribute("src") ?? "").toContain("space-rocket");
    expect(document.querySelectorAll("[data-doodle-box]")).toHaveLength(0);

    // DECORATION stays out of the instructional response area (plan.md:195).
    // Scoped to decorative markers rather than to every `img`: plan.md:212
    // and :246 require instructional visuals to remain, so a blanket "no
    // image here" assertion would forbid the one thing the response area is
    // explicitly allowed to gain.
    expect(
      document.querySelectorAll("[data-response-panel] [data-decorative-panel]"),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll("[data-response-panel] [data-decorative-art]"),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll("[data-response-panel] [data-doodle-box]"),
    ).toHaveLength(0);
    expect(document.querySelector("header [data-decorative-panel]")).not.toBe(
      null,
    );
    unmount();
  });

  test("turns the same reserved panel into the doodle box when graphics are off", () => {
    const withGraphics = renderSentencePage(sentenceDocumentFor(true));
    const withoutGraphics = renderSentencePage(sentenceDocumentFor(false));

    expect(withGraphics.artIds).toEqual(["space-rocket"]);
    expect(withGraphics.doodleBoxes).toBe(0);
    expect(withoutGraphics.artIds).toEqual([]);
    expect(withoutGraphics.doodleBoxes).toBe(1);
    expect(withoutGraphics.decoration).toBe("doodle");
    expect(withoutGraphics.decorativePanels).toBe(
      withGraphics.decorativePanels,
    );

    // Only decoration changed. Everything the child is asked to do, and the
    // whole response area markup, is identical.
    expect(withoutGraphics.prompt).toBe(withGraphics.prompt);
    expect(withoutGraphics.bankWords).toEqual(withGraphics.bankWords);
    expect(withoutGraphics.items).toBe(withGraphics.items);
    expect(withoutGraphics.requiredResponse).toBe(
      withGraphics.requiredResponse,
    );
    expect(withoutGraphics.responsePanelHtml).toBe(
      withGraphics.responsePanelHtml,
    );
  });

  test("uses the same-size doodle box when no licensed match exists", () => {
    const { unmount } = render(
      createElement(DecorativeGraphic, {
        catalog: [],
        includeDecorativeGraphics: true,
        seed: "0000002a",
        topicId: "space",
      }),
    );
    const panel = document.querySelector<HTMLElement>(
      "[data-decorative-panel]",
    );
    expect(panel?.getAttribute("data-decoration")).toBe("doodle");
    expect(document.querySelectorAll("[data-doodle-box]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-decorative-art]")).toHaveLength(0);
    // Read the reservation off the doodle state BEFORE anything is compared,
    // and require it to be a real declared size. Two `undefined`s comparing
    // equal is exactly how a same-size assertion passes while measuring
    // nothing at all.
    const reservation = {
      aspectRatio: panel?.style.aspectRatio ?? "",
      flex: panel?.style.flex ?? "",
      height: panel?.style.height ?? "",
      maxWidth: panel?.style.maxWidth ?? "",
      width: panel?.style.width ?? "",
    };
    expect(reservation.width).toMatch(/^\d+(?:\.\d+)?rem$/u);
    expect(reservation.flex).toContain("rem");
    // The height is DERIVED from that width by the aspect ratio rather than
    // pinned in rem, which is what keeps the panel square when it shrinks.
    // `graphics.spec.ts` measures the used pixels; here the declaration is
    // pinned so the two cannot drift apart silently.
    expect(reservation.aspectRatio).toBe("1 / 1");
    expect(reservation.height).toBe("auto");
    unmount();

    // Same reservation, whatever fills it: the fallback cannot resize the page.
    const artPanel = render(
      createElement(DecorativeGraphic, {
        includeDecorativeGraphics: true,
        seed: "0000002a",
        topicId: "space",
      }),
    );
    const withArt = document.querySelector<HTMLElement>(
      "[data-decorative-panel]",
    );
    expect(withArt).not.toBeNull();
    expect(withArt?.getAttribute("data-decoration")).toBe("art");
    expect({
      aspectRatio: withArt?.style.aspectRatio ?? "",
      flex: withArt?.style.flex ?? "",
      height: withArt?.style.height ?? "",
      maxWidth: withArt?.style.maxWidth ?? "",
      width: withArt?.style.width ?? "",
    }).toEqual(reservation);
    artPanel.unmount();
  });
});

/* -------------------------------------------------------------------------
 * Decoration is optional: a broken catalog degrades, it does not white-screen
 * ---------------------------------------------------------------------- */

const CORRUPT_MANIFESTS: ReadonlyArray<{ label: string; text: string }> = [
  { label: "truncated JSON", text: '{"schemaVersion": 1, "assets": {' },
  { label: "empty text", text: "" },
  { label: "JSON that is not an object", text: "[]" },
  {
    label: "a valid document with an invalid row",
    text: manifestTextFor({ ...ORIGINAL_ROW, license: "CC-BY-4.0" }),
  },
];

describe("a broken catalog degrades decoration instead of taking a page down", () => {
  for (const { label, text } of CORRUPT_MANIFESTS) {
    test(`withholds every asset and reports ${label}`, () => {
      // `manifest.ts` sits in the parent UI's import graph. Validation used to
      // throw at module load, so a corrupt manifest blanked profile
      // management, generation and print - not merely the decoration.
      let catalog: ReturnType<typeof buildLineArtCatalog> | undefined;
      expect(() => {
        catalog = buildLineArtCatalog(
          text,
          committedSvgMarkup,
          committedSvgUrls,
        );
      }).not.toThrow();
      expect(catalog?.assets).toEqual([]);
      expect(catalog?.manifest).toEqual([]);
      expect(catalog?.defects.join("\n")).toContain(
        "LINE_ART_MANIFEST_INVALID",
      );
      // Every committed drawing is also reported as unmanifested, so the
      // developer-facing failure is loud rather than a single line.
      expect(catalog?.defects.length ?? 0).toBeGreaterThan(
        Object.keys(committedSvgMarkup).length,
      );
    });
  }

  test("still renders the whole worksheet, with the same-size doodle box", () => {
    const corrupt = buildLineArtCatalog(
      "{ not json",
      committedSvgMarkup,
      committedSvgUrls,
    );
    // The runtime consequence of that empty catalog, through the same
    // selection function the panel itself calls.
    expect(
      selectDecorativeAsset("space", "0000002a", corrupt.assets),
    ).toBeUndefined();

    const decorated = renderSentencePage(sentenceDocumentFor(true));
    const undecorated = renderSentencePage(sentenceDocumentFor(false));
    const { unmount } = render(
      createElement(DecorativeGraphic, {
        catalog: corrupt.assets,
        includeDecorativeGraphics: true,
        seed: "0000002a",
        topicId: "space",
      }),
    );
    const panel = document.querySelector<HTMLElement>(
      "[data-decorative-panel]",
    );
    expect(panel?.getAttribute("data-decoration")).toBe("doodle");
    expect(document.querySelectorAll("[data-doodle-box]")).toHaveLength(1);
    expect(panel?.style.width).toMatch(/^\d+(?:\.\d+)?rem$/u);
    unmount();

    // ...and nothing the child is asked to do ever depended on the manifest.
    expect(undecorated.prompt).toBe(decorated.prompt);
    expect(undecorated.bankWords).toEqual(decorated.bankWords);
    expect(undecorated.items).toBe(decorated.items);
    expect(undecorated.requiredResponse).toBe(decorated.requiredResponse);
    expect(undecorated.responsePanelHtml).toBe(decorated.responsePanelHtml);
    expect(undecorated.items).toBeGreaterThan(0);
  });

  test("keeps the shipped module on that same failure-reporting path", () => {
    // The guarantee above is only worth something if the module the
    // application imports is built by the very function it was proven with.
    const real = buildLineArtCatalog(
      manifestJsonText,
      committedSvgMarkup,
      committedSvgUrls,
    );
    expect(real.defects).toEqual([]);
    expect(real.manifest).toEqual(LINE_ART_MANIFEST);
    expect(real.assets.map((asset) => asset.id)).toEqual(
      LINE_ART_ASSETS.map((asset) => asset.id),
    );
    expect(LINE_ART_CATALOG_DEFECTS).toEqual([]);
  });
});

/* -------------------------------------------------------------------------
 * Discovery is at least as wide as the release audit that will police it
 * ---------------------------------------------------------------------- */

describe("committed-SVG discovery", () => {
  test("is recursive, matching the release audit's nested-asset walk", () => {
    // plan.md:740 has Step 13 walk every `.svg` under the line-art directory
    // at ANY depth. A flat glob here would let a nested asset pass this
    // step's unmanifested-file guard and be met for the first time at
    // release, so the discovery pattern itself is pinned.
    const globPatterns = [
      ...manifestSourceText.matchAll(/import\.meta\.glob<string>\("([^"]+)"/gu),
    ].map((match) => match[1] ?? "");
    expect(globPatterns.length).toBeGreaterThan(0);
    for (const pattern of globPatterns) {
      expect(pattern).toBe("./**/*.svg");
    }
  });

  test("rejects a nested SVG that no manifest row could name", () => {
    const nestedKey = "./nested/rogue-mark.svg";
    const nested = buildLineArtCatalog(
      manifestJsonText,
      {
        ...committedSvgMarkup,
        [nestedKey]: `${SVG_OPEN}><path d="M0 0" /></svg>`,
      },
      { ...committedSvgUrls, [nestedKey]: "/assets/rogue-mark.svg" },
    );
    expect(nested.defects).toContain(
      `${LINE_ART_DIRECTORY}nested/rogue-mark.svg: bundled SVG has no manifest row.`,
    );
    // Reported, never rendered: an unreviewed file cannot reach a child.
    expect(nested.assets.map((asset) => asset.id)).not.toContain("rogue-mark");
    expect(nested.assets).toHaveLength(LINE_ART_ASSETS.length);
  });

  test("cannot be answered by a manifest row reaching into a subdirectory", () => {
    expect(() =>
      parseLineArtManifest(
        manifestTextFor(
          { ...ORIGINAL_ROW },
          `${LINE_ART_DIRECTORY}nested/neutral-star.svg`,
        ),
      ),
    ).toThrow(/LINE_ART_MANIFEST_INVALID/u);
  });
});

/* -------------------------------------------------------------------------
 * A decorative image never paints a browser placeholder
 * ---------------------------------------------------------------------- */

describe("the decorative image", () => {
  function renderArtPanel(): HTMLImageElement {
    render(
      createElement(DecorativeGraphic, {
        includeDecorativeGraphics: true,
        seed: "0000002a",
        topicId: "space",
      }),
    );
    const image = document.querySelector<HTMLImageElement>(
      "img[data-decorative-art]",
    );
    if (image === null) {
      throw new Error("The art state did not render an image.");
    }
    return image;
  }

  test("paints nothing at all until the asset has really decoded", () => {
    // A pending - or just-failed - <img> is otherwise free to paint the
    // browser's own broken-image placeholder onto a monochrome child
    // worksheet, one frame before `onError` can swap in the doodle box.
    // `visibility: hidden` is a CSS-level guarantee that the element paints
    // nothing at all, while still reserving the identical box.
    const image = renderArtPanel();
    expect(image.getAttribute("data-decorative-art-status")).toBe("pending");
    expect(image.style.visibility).toBe("hidden");

    fireEvent.load(image);
    expect(image.getAttribute("data-decorative-art-status")).toBe("ready");
    expect(image.style.visibility).toBe("visible");
  });

  test("stays hidden when the SAME asset is mounted again", () => {
    // The verdict belongs to an ELEMENT, not to an asset ID. Without that,
    // a remount after a successful load renders a brand-new, undecoded
    // `<img>` with `visibility: visible` - reopening the one frame in which
    // a failed request paints the browser's broken-image glyph.
    const properties = {
      includeDecorativeGraphics: true,
      seed: "0000002a" as const,
      topicId: "space",
    };
    const view = render(createElement(DecorativeGraphic, properties));
    const first = document.querySelector<HTMLImageElement>(
      "img[data-decorative-art]",
    );
    if (first === null) {
      throw new Error("The art state did not render an image.");
    }
    fireEvent.load(first);
    expect(first.getAttribute("data-decorative-art-status")).toBe("ready");
    expect(first.style.visibility).toBe("visible");

    // Graphics off, then on again, WITHOUT unmounting the component: the
    // `<img>` element is destroyed and recreated while the old verdict is
    // still in state.
    view.rerender(
      createElement(DecorativeGraphic, {
        ...properties,
        includeDecorativeGraphics: false,
      }),
    );
    expect(document.querySelectorAll("img[data-decorative-art]")).toHaveLength(
      0,
    );
    view.rerender(createElement(DecorativeGraphic, properties));

    const second = document.querySelector<HTMLImageElement>(
      "img[data-decorative-art]",
    );
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second?.getAttribute("data-decorative-art")).toBe("space-rocket");
    expect(second?.getAttribute("data-decorative-art-status")).toBe("pending");
    expect(second?.style.visibility).toBe("hidden");
  });

  test("shows an already-decoded asset that never fires a load event", () => {
    // A cached image can be complete before this component's handlers exist,
    // so `load` may never fire for the new element. The commit-phase check of
    // `complete` plus a real intrinsic width is the only path out of
    // `pending` for that case; without it the art would stay hidden forever.
    const complete = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "complete",
    );
    const naturalWidth = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalWidth",
    );
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => 120,
    });
    try {
      const image = renderArtPanel();
      expect(image.getAttribute("data-decorative-art-status")).toBe("ready");
      expect(image.style.visibility).toBe("visible");
    } finally {
      if (complete !== undefined) {
        Object.defineProperty(HTMLImageElement.prototype, "complete", complete);
      }
      if (naturalWidth !== undefined) {
        Object.defineProperty(
          HTMLImageElement.prototype,
          "naturalWidth",
          naturalWidth,
        );
      }
    }
  });

  test("becomes the doodle box when the asset fails, leaving no image", () => {
    const image = renderArtPanel();
    expect(image.style.visibility).toBe("hidden");

    fireEvent.error(image);
    expect(document.querySelectorAll("img[data-decorative-art]")).toHaveLength(
      0,
    );
    const panel = document.querySelector<HTMLElement>(
      "[data-decorative-panel]",
    );
    expect(panel?.getAttribute("data-decoration")).toBe("doodle");
    expect(document.querySelectorAll("[data-doodle-box]")).toHaveLength(1);
    expect(panel?.style.width).toMatch(/^\d+(?:\.\d+)?rem$/u);
  });
});

/* -------------------------------------------------------------------------
 * The art draws what its ledger row says it draws
 * ---------------------------------------------------------------------- */

describe("committed path data", () => {
  test("is written in one consistent style across the whole pack", () => {
    for (const asset of LINE_ART_ASSETS) {
      for (const [, geometry] of asset.markup.matchAll(/ d="([^"]+)"/gu)) {
        const data = geometry ?? "";
        // One command letter, one space, coordinates separated by single
        // spaces, in every file - so a diff shows a changed drawing rather
        // than a re-spaced one.
        expect(data, `${asset.id}: ${data}`).toMatch(
          /^[MLCZ](?: -?\d+(?:\.\d+)?)*(?: [MLCZ](?: -?\d+(?:\.\d+)?)*)*$/u,
        );
        expect(data, `${asset.id}: ${data}`).not.toMatch(/ {2}|,|[a-z]/u);
      }
    }
  });

  /** The widest horizontal rule a drawing contains, as a fraction of canvas. */
  function groundLineFractionOf(assetId: string): number {
    const markup = committedMarkupFor(`${LINE_ART_DIRECTORY}${assetId}.svg`);
    expect(markup, assetId).toBeDefined();
    const viewBox = /viewBox="0 0 (\d+(?:\.\d+)?) /u.exec(markup ?? "")?.[1];
    expect(viewBox, assetId).toBeDefined();
    let widest = 0;
    for (const [, geometry] of (markup ?? "").matchAll(/ d="([^"]+)"/gu)) {
      const segment =
        /^M (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) L (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)$/u.exec(
          geometry ?? "",
        );
      if (segment === null || segment[2] !== segment[4]) {
        continue;
      }
      widest = Math.max(widest, Math.abs(Number(segment[3]) - Number(segment[1])));
    }
    return widest / Number(viewBox);
  }

  test("calls a ground line short only when the path data draws a short one", () => {
    // "A short ground line" was copied from `nature-tree` onto `vehicles-car`,
    // whose rule is the widest stroke in its own drawing. Rasterised at 480 px
    // the car's baseline measures 448 px of dark pixels - 93% of the canvas,
    // and the full horizontal extent of the whole drawing - while the tree's
    // measures 192 px. The two rows may not describe those as the same thing.
    const car = groundLineFractionOf("vehicles-car");
    const tree = groundLineFractionOf("nature-tree");
    expect(car).toBeGreaterThan(0.85);
    expect(tree).toBeLessThan(0.5);
    expect(car).toBeGreaterThan(2 * tree);

    const describes = (assetId: string): string =>
      LINE_ART_MANIFEST.find((entry) => entry.id === assetId)?.description ?? "";
    expect(describes("vehicles-car")).toMatch(/full width/iu);
    expect(describes("vehicles-car")).not.toMatch(/short ground line/iu);
    expect(describes("nature-tree")).toMatch(/short ground line/iu);
  });

  test("says `plain outline` only where nothing is filled in", () => {
    // `animals-cat` is the one asset with solid shapes - two eyes and a nose -
    // and its row used to lead with "drawn in plain outline, with ... a simple
    // face", which is the vaguest kind of true. Every row's wording is bound
    // to whether its markup actually fills anything.
    const SOLID = / fill="#000000" stroke="none"/gu;
    for (const asset of LINE_ART_ASSETS) {
      const solids = [...asset.markup.matchAll(SOLID)].length;
      if (asset.id === "animals-cat") {
        expect(solids, asset.id).toBe(3);
        expect(asset.description, asset.id).toMatch(/two solid eyes/iu);
        expect(asset.description, asset.id).toMatch(/solid triangular nose/iu);
        expect(asset.description, asset.id).not.toMatch(/plain outline/iu);
      } else {
        expect(solids, asset.id).toBe(0);
        expect(asset.description, asset.id).toMatch(/plain outline/iu);
      }
    }
  });

  test("draws the sports ball its ledger row describes, not a wire-frame globe", () => {
    const row = LINE_ART_MANIFEST.find((entry) => entry.id === "sports-ball");
    expect(row?.description).toMatch(/round ball[\s\S]*two curved seams/iu);

    const markup = committedMarkupFor(`${LINE_ART_DIRECTORY}sports-ball.svg`);
    expect(markup).toBeDefined();
    // Exactly the one ball outline the row names...
    expect([...(markup ?? "").matchAll(/<circle/gu)]).toHaveLength(1);
    const seams = [...(markup ?? "").matchAll(/<path d="([^"]+)"/gu)].map(
      (match) => match[1] ?? "",
    );
    // ...and exactly the two seams, each curving with the ball. A straight
    // edge-to-edge equator crossing two meridians is the wire-frame globe the
    // iteration-1 blind-first review read here instead of a ball.
    expect(seams).toHaveLength(2);
    for (const seam of seams) {
      expect(seam, seam).toContain("C");
      expect(seam, seam).not.toMatch(/[LHVlhv]/u);
    }
  });
});
