# Asset provenance

This file is the human-readable ledger of every non-code asset committed to
Extra Credit. The machine-readable source of the same rows is
[`frontend/src/web/assets/line-art/manifest.json`](frontend/src/web/assets/line-art/manifest.json),
which the runtime loads and validates through
`frontend/src/web/assets/line-art/manifest.ts`.
Edit both together — or, better, edit the manifest and mirror it here. One
test reads this file and that manifest from disk and fails if they disagree
on a single mirrored field. Every field of every row is compared in both
directions — including `notice`, which only third-party rows carry — and a
manifest field this file has no line for is itself reported as drift:

- Drift gate: `frontend/tests/e2e/graphics.spec.ts`

That gate is Node-side on purpose: the rest of the repository-root contract
(the root `LICENSE`, `CONTRIBUTING.md`) is already checked there, from Node,
with `readFileSync`.

Every asset in v1 is project-original, bundled, monochrome SVG line art with a
stable lowercase kebab-case ID. All of it is covered by the one root
[`LICENSE`](LICENSE) (MIT). There is no second project license.

TypeScript, TSX, worksheet definitions, and worksheet renderers are project
code. They are covered globally by the root MIT license and deliberately have
no per-file rows here.

Formatting contract: each `###` heading below is the repository-relative POSIX
path of exactly one asset, and every field is one `- Label: value` line. No
other `###` heading may appear in this file.

## Reviewed line art

### `frontend/src/web/assets/line-art/animals-cat.svg`

- Asset ID: animals-cat
- Topics: animals
- Description: A seated cat drawn in outline, with pointed ears, whiskers, a curled tail, and two solid eyes above a solid triangular nose.
- Creator: Extra Credit contributors
- Source: This repository (frontend/src/web/assets/line-art/)
- Reviewed on: 2026-08-24
- Origin: original
- License: MIT
- License file: LICENSE
- AI assistance: AI-assisted: the SVG path data was drafted with Claude (Anthropic) from a generic-archetype brief during development, then reviewed and committed in this repository under the root MIT license before runtime. No third-party artwork, franchise character, celebrity likeness, or living artist's identifiable style was copied or imitated.

### `frontend/src/web/assets/line-art/nature-tree.svg`

- Asset ID: nature-tree
- Topics: nature
- Description: A broad-canopy tree drawn in plain outline, standing on a short ground line.
- Creator: Extra Credit contributors
- Source: This repository (frontend/src/web/assets/line-art/)
- Reviewed on: 2026-08-24
- Origin: original
- License: MIT
- License file: LICENSE
- AI assistance: AI-assisted: the SVG path data was drafted with Claude (Anthropic) from a generic-archetype brief during development, then reviewed and committed in this repository under the root MIT license before runtime. No third-party artwork, franchise character, celebrity likeness, or living artist's identifiable style was copied or imitated.

### `frontend/src/web/assets/line-art/neutral-star.svg`

- Asset ID: neutral-star
- Topics: neutral
- Description: A five-pointed star drawn as a single plain outline.
- Creator: Extra Credit contributors
- Source: This repository (frontend/src/web/assets/line-art/)
- Reviewed on: 2026-08-24
- Origin: original
- License: MIT
- License file: LICENSE
- AI assistance: AI-assisted: the SVG path data was drafted with Claude (Anthropic) from a generic-archetype brief during development, then reviewed and committed in this repository under the root MIT license before runtime. No third-party artwork, franchise character, celebrity likeness, or living artist's identifiable style was copied or imitated.

### `frontend/src/web/assets/line-art/space-rocket.svg`

- Asset ID: space-rocket
- Topics: space
- Description: A generic rocket drawn in plain outline, with one round window, two fins and a flame.
- Creator: Extra Credit contributors
- Source: This repository (frontend/src/web/assets/line-art/)
- Reviewed on: 2026-08-24
- Origin: original
- License: MIT
- License file: LICENSE
- AI assistance: AI-assisted: the SVG path data was drafted with Claude (Anthropic) from a generic-archetype brief during development, then reviewed and committed in this repository under the root MIT license before runtime. No third-party artwork, franchise character, celebrity likeness, or living artist's identifiable style was copied or imitated.

### `frontend/src/web/assets/line-art/sports-ball.svg`

- Asset ID: sports-ball
- Topics: sports
- Description: A round ball drawn in plain outline, with two curved seams.
- Creator: Extra Credit contributors
- Source: This repository (frontend/src/web/assets/line-art/)
- Reviewed on: 2026-08-24
- Origin: original
- License: MIT
- License file: LICENSE
- AI assistance: AI-assisted: the SVG path data was drafted with Claude (Anthropic) from a generic-archetype brief during development, then reviewed and committed in this repository under the root MIT license before runtime. No third-party artwork, franchise character, celebrity likeness, or living artist's identifiable style was copied or imitated.

### `frontend/src/web/assets/line-art/vehicles-car.svg`

- Asset ID: vehicles-car
- Topics: vehicles
- Description: A side view of a generic car drawn in plain outline, with two wheels, two windows and a ground line running the full width of the drawing beneath it.
- Creator: Extra Credit contributors
- Source: This repository (frontend/src/web/assets/line-art/)
- Reviewed on: 2026-08-24
- Origin: original
- License: MIT
- License file: LICENSE
- AI assistance: AI-assisted: the SVG path data was drafted with Claude (Anthropic) from a generic-archetype brief during development, then reviewed and committed in this repository under the root MIT license before runtime. No third-party artwork, franchise character, celebrity likeness, or living artist's identifiable style was copied or imitated.

## Third-party material

There is none. Extra Credit v1 ships no third-party artwork, fonts, icons, or
other non-code assets.

If any is ever approved, it is recorded exactly like the rows above but with
`origin: "third-party"`, and it must additionally carry:

- `license`: the upstream license identifier, unchanged.
- `licenseFile`: a separate license reference committed alongside the asset.
  It may never be the root `LICENSE`; third-party material is never
  relicensed under this project's MIT grant and is excluded from it.
- `notice`: the complete attribution or notice text the upstream terms
  require, reproduced verbatim. Its line here is `- Notice: <text>`, and the
  drift gate compares it like every other field.
- `source`: the upstream `https://` URL the material came from.
- `creator`: the upstream creator, credited as the upstream terms require.

The manifest schema in `manifest.ts` enforces every one of those fields, so an
incomplete third-party row cannot load, and Step 13's release audit re-checks
the same contract on the exported release tree.

## Excluded by policy

Franchise characters, celebrity likenesses, trademark-dependent designs,
imitation of a living artist's identifiable style, remote image URLs, and
live or runtime image generation are all excluded from this repository.
