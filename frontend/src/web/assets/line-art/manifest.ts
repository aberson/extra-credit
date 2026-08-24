import { z } from "zod";

import { createSeededRandom } from "../../../shared/worksheet/seeded-random";
import { TOPIC_IDS, type SeedHex } from "../../../shared/worksheet/types";

import rawManifestJson from "./manifest.json?raw";

/**
 * The reviewed decorative line-art pack.
 *
 * `manifest.json` beside this file is the SINGLE machine-readable source of
 * asset provenance (plan.md:244, :311). This module never re-declares a row:
 * it imports that exact JSON text, validates it, and joins each row to the
 * bundled SVG it names. `ASSET_PROVENANCE.md` is the human ledger of the same
 * rows and `frontend/tests/e2e/graphics.spec.ts` proves the two never drift.
 * That gate is Node-side because the rest of the repository-root contract
 * (`LICENSE`, `CONTRIBUTING.md`) is already checked there, from Node, with
 * `readFileSync`. `manifest.test.ts` beside this module could not import the
 * ledger anyway: it runs under `// @vitest-environment jsdom`, and from there
 * Vite refuses a module ID outside the frontend package ("Denied ID
 * .../ASSET_PROVENANCE.md?raw", measured). That refusal is scoped to that
 * file's environment; it is not a property of the unit suite as a whole.
 *
 * Decoration is decoration. Nothing here can change a prompt, a word bank, an
 * item count, or a required response: its only importer anywhere in
 * `src/` is the reserved panel in `preview/DecorativeGraphic.tsx`, which
 * renders the same box whether art is selected or not (plan.md:202). Decoration is also
 * OPTIONAL: every failure in this module - an unreadable manifest, an unsafe
 * asset, a missing file - withholds art and leaves the doodle box, and none
 * of them may take the parent UI down with it.
 */

/** Repository-relative POSIX directory that owns every reviewed asset. */
export const LINE_ART_DIRECTORY = "frontend/src/web/assets/line-art/" as const;

/** The root MIT license every project-original asset points at (plan.md:30). */
export const ROOT_LICENSE_FILE = "LICENSE" as const;

export const LINE_ART_ERROR_CODES = {
  manifestInvalid: "LINE_ART_MANIFEST_INVALID",
} as const;

export type LineArtErrorCode =
  (typeof LINE_ART_ERROR_CODES)[keyof typeof LINE_ART_ERROR_CODES];

const ASSET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UPSTREAM_URL_PATTERN = /^https:\/\/[^\s"'<>]+$/u;

/**
 * The same calendar check `shared/config/schema.ts` applies to a profile's
 * `reviewedOn`. A shape-only regex accepts `2026-02-29` and `2026-13-01`,
 * which are not dates, so a review date could be recorded that never
 * happened. That helper is private to its own module and this one is
 * platform-neutral browser code, so the rule is restated here and
 * `manifest.test.ts` pins both validators to the SAME verdict over a table of
 * real and impossible dates - that is what fails if either side drifts.
 */
function isIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const nonEmptyText = z.string().trim().min(1);

const assetIdSchema = z
  .string()
  .regex(ASSET_ID_PATTERN, "An asset ID must be stable lowercase kebab-case.");

const reviewDateSchema = z
  .string()
  .refine(isIsoCalendarDate, "A review date must be a valid ISO calendar date.");

const topicIdSchema = z.enum(TOPIC_IDS);

const provenanceFields = {
  id: assetIdSchema,
  topics: z.array(topicIdSchema).min(1),
  description: nonEmptyText,
  creator: nonEmptyText,
  source: nonEmptyText,
  reviewedOn: reviewDateSchema,
  aiAssistance: nonEmptyText,
};

/**
 * A project-original row. plan.md:244 fixes all three license fields exactly,
 * and Step 13 release audit re-checks them on the exported tree.
 */
const originalRowSchema = z.strictObject({
  ...provenanceFields,
  origin: z.literal("original"),
  license: z.literal("MIT"),
  licenseFile: z.literal(ROOT_LICENSE_FILE),
});

/**
 * A FUTURE approved third-party row. No such asset exists in v1; the schema
 * exists so the first one cannot land without its complete upstream terms,
 * and can never be relicensed under the root MIT grant: its own license file
 * must be a separate reference, never the root `LICENSE`.
 */
const thirdPartyRowSchema = z.strictObject({
  ...provenanceFields,
  origin: z.literal("third-party"),
  license: nonEmptyText,
  licenseFile: nonEmptyText.refine(
    (value) => value !== ROOT_LICENSE_FILE,
    "Third-party material keeps its own license file and is never relicensed under the root MIT license.",
  ),
  notice: nonEmptyText,
  source: z
    .string()
    .regex(
      UPSTREAM_URL_PATTERN,
      "A third-party row must cite its upstream source URL.",
    ),
});

const rowSchema = z.discriminatedUnion("origin", [
  originalRowSchema,
  thirdPartyRowSchema,
]);

const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  assets: z.record(z.string(), rowSchema),
});

export type LineArtRowV1 = z.infer<typeof rowSchema>;

/** One validated row joined to the repository path that keys it. */
export type LineArtManifestEntryV1 = LineArtRowV1 & { readonly path: string };

/** A manifest entry joined to the bundled SVG it names. */
export type LineArtAssetV1 = LineArtManifestEntryV1 & {
  readonly markup: string;
  readonly url: string;
};

export class LineArtManifestError extends Error {
  override readonly name = "LineArtManifestError";

  constructor(
    readonly code: LineArtErrorCode,
    safeMessage: string,
  ) {
    super(`${code}: ${safeMessage}`);
  }
}

function fail(detail: string): never {
  throw new LineArtManifestError(LINE_ART_ERROR_CODES.manifestInvalid, detail);
}

/**
 * Every construct this project refuses to bundle inside an SVG. The list is
 * the enforcement side of the plan.md:244 exclusions on remote image URLs and
 * runtime image generation: an asset that trips any rule is dropped from the
 * runtime catalog and reported as a defect instead of being rendered.
 *
 * `manifest.test.ts` requires this list and its table of hostile markup to
 * name exactly the same rules, so a rule cannot be added or removed without
 * the hostile case that proves it.
 */
export const SVG_SAFETY_RULES = [
  "not-an-svg-root",
  "doctype-or-entity",
  "processing-instruction",
  "script-element",
  "foreign-object",
  "embedded-document-element",
  "event-handler-attribute",
  "javascript-uri",
  "data-uri",
  "remote-reference",
  "external-reference",
  "external-style-reference",
  "style-import",
] as const;

export type SvgSafetyRule = (typeof SVG_SAFETY_RULES)[number];

/** `xmlns="http://www.w3.org/2000/svg"` is required markup, not a reference. */
const NAMESPACE_DECLARATION =
  /\sxmlns(?::[a-z0-9_-]+)?\s*=\s*("[^"]*"|'[^']*')/giu;
const REFERENCE_ATTRIBUTE =
  /\s(?:xlink:)?(?:href|src)\s*=\s*("[^"]*"|'[^']*')/giu;

/**
 * Static SVG safety check over committed markup. It is deliberately textual:
 * the markup never reaches a parser, a network stack, or a script context
 * before this runs, and it runs at module load over every bundled asset as
 * well as in tests over synthetic hostile markup.
 */
export function svgSafetyViolations(markup: string): readonly SvgSafetyRule[] {
  const violations: SvgSafetyRule[] = [];
  const add = (rule: SvgSafetyRule): void => {
    if (!violations.includes(rule)) {
      violations.push(rule);
    }
  };
  const scrubbed = markup.replace(NAMESPACE_DECLARATION, " ");

  if (!/^\s*<svg[\s>]/u.test(markup)) {
    add("not-an-svg-root");
  }
  if (/<!\s*(?:doctype|entity|\[cdata\[)/iu.test(markup)) {
    add("doctype-or-entity");
  }
  if (/<\?/u.test(markup)) {
    add("processing-instruction");
  }
  if (/<\s*script\b/iu.test(markup)) {
    add("script-element");
  }
  if (/<\s*foreignobject\b/iu.test(markup)) {
    add("foreign-object");
  }
  if (/<\s*(?:image|iframe|embed|object|audio|video)\b/iu.test(markup)) {
    add("embedded-document-element");
  }
  if (/\son[a-z]+\s*=/iu.test(markup)) {
    add("event-handler-attribute");
  }
  if (/javascript\s*:/iu.test(markup)) {
    add("javascript-uri");
  }
  if (/\bdata\s*:/iu.test(scrubbed)) {
    add("data-uri");
  }
  if (/[a-z][a-z0-9+.-]*:\/\//iu.test(scrubbed)) {
    add("remote-reference");
  }
  if (/url\(\s*(?!#)/iu.test(markup)) {
    add("external-style-reference");
  }
  if (/@import/iu.test(markup)) {
    add("style-import");
  }
  for (const match of markup.matchAll(REFERENCE_ATTRIBUTE)) {
    const value = (match[1] ?? "").slice(1, -1).trim();
    if (!value.startsWith("#")) {
      add("external-reference");
    }
  }

  return violations;
}

export function isSafeSvgMarkup(markup: string): boolean {
  return svgSafetyViolations(markup).length === 0;
}

/**
 * Validate the manifest TEXT and return its rows.
 *
 * Text rather than a parsed object on purpose: JSON silently keeps the last
 * of two identical keys, so a duplicated path would quietly collapse two
 * assets into one row. The raw occurrence count closes that.
 *
 * This THROWS on a bad manifest, which is the right contract for a validator
 * a test drives directly. It is not what a child's page ever sees:
 * {@link buildLineArtCatalog} is the only caller at module load, and it turns
 * the throw into a withheld catalog.
 */
export function parseLineArtManifest(
  rawJson: string,
): readonly LineArtManifestEntryV1[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return fail("the manifest is not valid JSON.");
  }

  const result = manifestSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return fail(
      `${first?.path.join(".") ?? "manifest"}: ${first?.message ?? "invalid row"}`,
    );
  }

  const entries: LineArtManifestEntryV1[] = [];
  for (const [path, row] of Object.entries(result.data.assets)) {
    // The path key IS the asset ID plus `.svg` under the one line-art
    // directory. That single equality is what makes IDs unique as well:
    // distinct keys cannot resolve to the same ID, so there is no separate
    // (and never-exercised) duplicate-ID branch to drift out of date.
    if (path !== `${LINE_ART_DIRECTORY}${row.id}.svg`) {
      fail(
        `"${path}" must be the repository-relative POSIX path ${LINE_ART_DIRECTORY}${row.id}.svg for asset "${row.id}".`,
      );
    }
    const keyOccurrences = rawJson.split(`"${path}"`).length - 1;
    if (keyOccurrences !== 1) {
      fail(`path key "${path}" appears ${String(keyOccurrences)} times.`);
    }
    entries.push({ ...row, path });
  }

  if (entries.length === 0) {
    fail("the manifest lists no assets.");
  }
  return entries;
}

/** The rows, the renderable assets, and every reason an asset was withheld. */
export interface LineArtCatalogV1 {
  readonly assets: readonly LineArtAssetV1[];
  readonly defects: readonly string[];
  readonly manifest: readonly LineArtManifestEntryV1[];
}

function repositoryPathOf(globKey: string): string {
  return `${LINE_ART_DIRECTORY}${globKey.replace(/^\.\//u, "")}`;
}

/**
 * Join the manifest text to the bundled SVGs, REPORTING problems instead of
 * throwing them.
 *
 * This function is the whole of the module's failure policy. Decoration is
 * optional by contract (plan.md:202, :246), so nothing here may escape as an
 * exception: this module sits in the parent UI's import graph, and a throw at
 * module load would blank profile management, generation and print over a
 * decoration problem. A corrupt manifest, an unsafe asset or a missing file
 * therefore yields an EMPTY catalog plus a defect line, and the panel draws
 * its same-size doodle box.
 *
 * WHICH GATE CATCHES IT, measured rather than assumed: corrupting
 * `manifest.json` and running the real `npm run build` exits 0 and still
 * emits all six assets - Vite never validates this file, so the build is NOT
 * a gate. The gate is `npm test`: `manifest.test.ts` requires
 * {@link LINE_ART_CATALOG_DEFECTS} to be empty, so any corruption of this file
 * turns that suite red. `npm run check` and CI run that suite; `npm run build`
 * alone does not. A count of the reddened tests is deliberately NOT recorded
 * here: nothing binds such a number, so it goes stale the next time a test is
 * added to that file. Because a fail-open path that reports only to a test
 * suite is silent in `npm run dev`, the module also logs every defect once at
 * load in a development build (see {@link LINE_ART_CATALOG_DEFECTS}).
 */
export function buildLineArtCatalog(
  rawJson: string,
  markupByGlobKey: Readonly<Record<string, string>>,
  urlByGlobKey: Readonly<Record<string, string>>,
): LineArtCatalogV1 {
  const defects: string[] = [];
  let manifest: readonly LineArtManifestEntryV1[] = [];

  try {
    manifest = parseLineArtManifest(rawJson);
  } catch (error) {
    const detail =
      error instanceof LineArtManifestError
        ? error.message
        : `${LINE_ART_ERROR_CODES.manifestInvalid}: the manifest could not be read.`;
    defects.push(`${LINE_ART_DIRECTORY}manifest.json: ${detail}`);
  }

  const manifestByPath = new Map(manifest.map((entry) => [entry.path, entry]));
  for (const [globKey, markup] of Object.entries(markupByGlobKey)) {
    const path = repositoryPathOf(globKey);
    if (!manifestByPath.has(path)) {
      defects.push(`${path}: bundled SVG has no manifest row.`);
    }
    const violations = svgSafetyViolations(markup);
    if (violations.length > 0) {
      defects.push(`${path}: unsafe SVG content (${violations.join(", ")}).`);
    }
  }

  const assets: LineArtAssetV1[] = [];
  for (const entry of manifest) {
    const globKey = `./${entry.path.slice(LINE_ART_DIRECTORY.length)}`;
    const markup = markupByGlobKey[globKey];
    const url = urlByGlobKey[globKey];
    if (markup === undefined || url === undefined) {
      defects.push(`${entry.path}: manifest row has no bundled SVG.`);
      continue;
    }
    if (svgSafetyViolations(markup).length > 0) {
      continue;
    }
    assets.push({ ...entry, markup, url });
  }

  assets.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );

  return { assets, defects, manifest };
}

/**
 * The committed SVGs, discovered rather than re-listed. A file added without
 * a manifest row therefore cannot silently ship: it lands in
 * {@link LINE_ART_CATALOG_DEFECTS}, which `manifest.test.ts` requires to be
 * empty and Step 13 release audit re-checks on the exported tree.
 *
 * The glob is RECURSIVE on purpose. plan.md:738 makes the release audit walk
 * every `.svg` under this directory at any depth, so this step's own
 * unmanifested-file guard has to be at least that wide; a flat glob would let
 * an asset in a subdirectory ship unseen until release. A nested file can
 * never satisfy the `<line-art directory>/<id>.svg` path-key rule, so it is
 * always reported as a defect rather than quietly rendered.
 */
const bundledMarkup = import.meta.glob<string>("./**/*.svg", {
  eager: true,
  import: "default",
  query: "?raw",
});

/**
 * `?no-inline` is a BUILD property, not a browser guard. Every sentence below
 * was measured, because two earlier revisions of this comment asserted a
 * mechanism nobody had run.
 *
 * NOT a CSP matter. The production static route emits helmet's merged default
 * policy; read off a live built server it is `default-src 'self';base-uri
 * 'none';font-src 'self' https: data:;form-action 'self';frame-ancestors
 * 'none';img-src 'self' data:;object-src 'none';script-src 'self';
 * script-src-attr 'none';style-src 'self' 'unsafe-inline'`. `img-src` permits
 * `data:`, so an inlined asset would render perfectly well. Any claim that
 * CSP blocks inlining is false, and `graphics.spec.ts` pins that header.
 *
 * What it buys is one inspectable file per row. Dropping `?no-inline` and
 * running `vite build` emits ZERO `.svg` files and six inline payloads of the
 * form `data:image/svg+xml,%3csvg%20xmlns='http://...` - percent-encoded, not
 * base64, and not the committed bytes: `"` becomes `'`, `#000000` becomes
 * `%23000000`, and the file's newlines and indentation are gone. With
 * `?no-inline` the build emits one `.svg` per row whose bytes are exactly the
 * committed bytes the `?raw` copy above was safety-checked against, and
 * `graphics.spec.ts` compares them file by file.
 *
 * Step 13 does NOT inspect those built files: plan.md:738 audits an EXPORTED
 * WORKING TREE whose manifest proves build output absent, so its asset clause
 * walks committed `line-art/**\/*.svg` sources. It re-runs this suite in the
 * clean room, which is how the built-file check travels to release. The
 * assets also stay separately cacheable rather than being copied into every
 * bundle that imports them.
 */
const bundledUrls = import.meta.glob<string>("./**/*.svg", {
  eager: true,
  import: "default",
  query: "?no-inline",
});

const catalog = buildLineArtCatalog(rawManifestJson, bundledMarkup, bundledUrls);

/** The validated rows of the one machine-readable provenance source. */
export const LINE_ART_MANIFEST: readonly LineArtManifestEntryV1[] =
  catalog.manifest;

/**
 * Every reason an asset was withheld from the runtime catalog. Decoration
 * fails safe - a withheld asset becomes the same-size doodle box rather than
 * a broken page - so this list is the loud half of that contract.
 *
 * `manifest.test.ts` requires it to be empty, and a development build also
 * prints it: silently swallowing a provenance defect until someone happens to
 * run the test suite is the failure mode this whole module is built to avoid.
 * Production stays quiet - a parent has nothing to do about it, and the page
 * has already degraded correctly.
 */
export const LINE_ART_CATALOG_DEFECTS: readonly string[] = catalog.defects;

if (import.meta.env.DEV && LINE_ART_CATALOG_DEFECTS.length > 0) {
  console.error(
    `Reviewed line art withheld:\n${LINE_ART_CATALOG_DEFECTS.join("\n")}`,
  );
}

/** Reviewed assets that may be rendered, in stable asset-ID order. */
export const LINE_ART_ASSETS: readonly LineArtAssetV1[] = catalog.assets;

/** The exact topic allowlist decoration may be selected by (plan.md:311). */
export const LINE_ART_TOPIC_IDS = TOPIC_IDS;

/**
 * Reviewed art tagged with an EXACT allowlisted topic ID. An unmatched or
 * unknown tag returns nothing at all; it never widens to another topic.
 */
export function decorativeAssetsForTopic(
  topicId: string,
  catalogAssets: readonly LineArtAssetV1[] = LINE_ART_ASSETS,
): readonly LineArtAssetV1[] {
  if (!(LINE_ART_TOPIC_IDS as readonly string[]).includes(topicId)) {
    return [];
  }
  return catalogAssets.filter((asset) =>
    (asset.topics as readonly string[]).includes(topicId),
  );
}

/**
 * The one decorative asset a given normalized request and seed select.
 *
 * Deterministic in exactly the way every other worksheet family is: the same
 * seed over the same candidate list always yields the same asset. Returning
 * `undefined` is the documented no-licensed-match path, and the caller draws
 * the same-size doodle box instead (plan.md:202).
 */
export function selectDecorativeAsset(
  topicId: string,
  seed: SeedHex,
  catalogAssets: readonly LineArtAssetV1[] = LINE_ART_ASSETS,
): LineArtAssetV1 | undefined {
  const candidates = decorativeAssetsForTopic(topicId, catalogAssets);
  if (candidates.length === 0) {
    return undefined;
  }
  let index: number;
  try {
    index = createSeededRandom(seed).nextBounded(candidates.length);
  } catch {
    // A malformed seed is not a reason to break a page: decoration fails
    // closed to the doodle box, exactly like a missing match.
    return undefined;
  }
  return candidates[index];
}
