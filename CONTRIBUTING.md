# Contributing to Extra Credit

Extra Credit is a local, parent-facing worksheet generator with no accounts,
no cloud services, no telemetry, and no runtime AI. Before contributing, read
[plan.md](plan.md) and pick up the GitHub issue for the plan step you want to
work on.

## Licensing of contributions

Every project-original contribution — code, worksheet templates and
definitions, documentation, and line art — is licensed under the one root
[MIT `LICENSE`](LICENSE). By opening a pull request you agree that your
contribution is your own work and is released under that license. Do not add
a second project license file, a per-directory license, or a per-file license
header that grants different terms.

## Third-party material

V1 ships no third-party assets, and none is accepted without complete
provenance and upstream terms.

If third-party material is ever approved, it keeps its own upstream license
and is **never relicensed** under this project's MIT grant; it is excluded
from that grant. Such material must be recorded in
[`ASSET_PROVENANCE.md`](ASSET_PROVENANCE.md) and in
`frontend/src/web/assets/line-art/manifest.json` with `origin: "third-party"`
and all of:

- the upstream creator, credited as the upstream terms require;
- the upstream `https://` source URL;
- the upstream license identifier, unchanged;
- the complete required notice or attribution text, reproduced verbatim;
- a separate committed license file reference — never the root `LICENSE`.

The manifest schema enforces every one of those fields, so an incomplete
third-party row fails validation instead of shipping.

The release audit currently verifies complete canonical MIT terms in that
separate file, with the upstream copyright notice retained verbatim. Other
licenses or modified grants fail closed until their complete terms have an
explicit verification rule; the root project license never substitutes for them.

Production HTML and SVG must contain no inline scripts, event handlers,
embedded documents, executable URLs, or entity references. The release audit
rejects these forms rather than attempting to interpret browser markup. The
fixed external module tag in `frontend/src/web/index.html` loads the separately
audited application source.

## Asset rules

- All art is bundled, project-original, high-contrast, black-and-white SVG
  line art with a stable lowercase kebab-case ID.
- Franchise characters, celebrity likenesses, trademark-dependent designs,
  imitation of a living artist's identifiable style, remote image URLs, and
  live or runtime image generation are excluded.
- AI may assist asset creation during development, but every result is
  reviewed, committed, and covered by the root MIT license before runtime,
  and the manifest row must say so truthfully in its AI-assistance note.
- Executable SVG content is rejected: no `<script>`, no `<foreignObject>`, no
  `on*` event-handler attributes, no `javascript:` URIs, no `DOCTYPE`/entity
  declarations, and no reference to anything outside the document.
- Add every new asset to `manifest.json` and mirror the same row in
  `ASSET_PROVENANCE.md`. `frontend/tests/e2e/graphics.spec.ts` reads both from
  disk and fails if any mirrored field disagrees in either direction, or if a
  committed SVG at any depth under the line-art directory has no row.
- TypeScript, TSX, worksheet definitions, and worksheet renderers are project
  code covered globally by the root MIT license. They do not get per-file
  asset rows.

## Privacy rules

- Never commit real child data. Use only fictional profiles and fictional
  worksheet content, in the example config and in test fixtures.
- `config/children.local.json` is gitignored and must stay that way.
- The browser stores no child data — no `localStorage`, `sessionStorage`,
  `IndexedDB`, Cache API, or service worker.
- Keep the server bound to `127.0.0.1` and every API response `no-store`.

## Persisted shape

The local profile file carries a `schemaVersion`. Version 2, defined in
`frontend/src/shared/config/schema.ts`, is the current shape. A version 1 file
is read through the frozen `legacy-v1.ts` path, upgraded in memory by
`migrate.ts`, and rewritten only by the first explicit save, after a
byte-identical `.v1-…bak` backup of the earlier file.

- **Additive changes land at the current version; everything else needs a new one.**
  Additive changes (a new optional key with a default, a new enum member) land
  at the current version with no migration, backup or upgrade notice: a
  version 2 file that lacks the new key parses with its default. A removal,
  rename or tightened bound needs a new version with a read path, that is,
  `schemaVersion: 3` with a version 2 read path and its own step in
  `CONFIG_MIGRATIONS`. A widened bound or a key that stops being required is
  not additive either and needs the same new version, because an older
  version 2 build would classify a file using it as invalid.
- **What makes a new key additive.** The key needs a Zod `.default()`, so
  this build still parses an older file that lacks it; a key without one is
  required, and this build would classify such a file as invalid. In
  `frontend/src/server/transport-schemas.ts` the key must also be named in the
  `optional` list of the `strictObjectSchema` call that composes its parent
  object, because that composer marks every property required unless it is
  listed there, and the fingerprint fails when a parent's `required` list
  changes. A new required key is not additive.
- **What makes a new enum member additive.** Only a member of a value list
  that no array bound is derived from. The `operations` arrays (Dry Math, Number
  Bonds, the Two Whats and a Wow equation focus, and the earlier `mathSkills`)
  are capped at `MATH_OPERATIONS.length`, the Dry Math facts `operations` at
  `FACT_OPERATIONS.length`, and `representations` at
  `REPRESENTATIONS.length`, in both `schema.ts`/`legacy-v1.ts` and
  `transport-schemas.ts`. A member added to any of these lists also raises that cap,
  and an older build meeting a full-length array reports it too big, which is
  invalid, not blocked; such a member needs a new version or a separate list.
- **Why additive changes are safe.** A build that meets a current-version
  file whose only strict-parse failures are unknown keys or unknown enum
  members classifies it as `blocked`: it answers `CONFIG_VERSION_UNSUPPORTED`,
  leaves the bytes untouched, writes no backup and offers no recovery, exactly
  as for a higher `schemaVersion`. Any other strict-parse failure is still
  `invalid` and offers backup-and-replace, which is why only those two kinds
  of change may skip the version bump.
- **The fingerprint enforces it.**
  `frontend/tests/integration/config-shape-fingerprint.test.ts` pins the
  accepted value domain as Step 15 landed it (the composed transport JSON
  Schema, the refinement names, and each text field at its maximum and one
  past it) and checks it additive-only: it passes when an optional key path,
  an enum member or a refinement name is added, and fails with "A persisted
  config change that is not additive requires schemaVersion 3 with a v2 read
  path" when a pinned key path, enum member or refinement name disappears or
  any pinned constraint (a parent's `required` list and an array's `maxItems`
  included) or text-bound outcome changes. The failure text also names the two
  additive forms. For a new key, list it as optional in `strictObjectSchema`
  and give it a Zod default; otherwise bump the version. Do not edit the
  snapshot to make it pass.
- **Its limits.** `PERSISTED_REFINEMENTS` in `schema.ts` is a hand-kept list
  that pins refinement names, not their logic. A new name passes, because a
  refinement on a new optional key is additive; a new refinement on an
  existing key tightens what that key accepts, which the fingerprint cannot
  see. A refinement added without being registered, a new refinement on an
  existing key, and a change inside a registered one are left to review, so
  register every new refinement on a persisted object and treat the last two
  as shape changes that need a new version.
- **One source for every value.** `frontend/src/server/transport-schemas.ts`
  composes the transport schema from the same value lists and ceilings the Zod
  schema uses; never restate a list or bound by hand. The frozen legacy
  `mathSkills` bounds are written only in `legacy-v1.ts`; consumers read them
  from the `MathSkillsV1Schema` fields.
  `frontend/tests/integration/schema-parity.test.ts` requires a parity row for
  every key path the transport schema declares.

## Quality gates

Run these from the repository root before opening a pull request:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
```

`npm --prefix frontend run check` runs all four in order, then the retained
log-privacy calibration: injected compiled UUID leaks must fail both selectors,
and the restored application must pass. `npm --prefix frontend run release:verify`
exports the current tree, audits privacy and licensing, installs locked dependencies
and Chromium in a temporary clean room, and runs that same complete gate. Add tests with every
behavior change, and keep worksheet generation deterministic for a given
normalized request and seed. A change that alters a known vector pinned in a
family's `generator.test.ts` changes what an earlier request produces, so it
needs a `generatorVersion` bump with the old version kept registered.

## Comment claims

### `plan.md` line citations are checked mechanically

A comment naming a line of `plan.md` is a claim about a living document: every
line inserted above it silently rots the claim. The guard is
`frontend/tests/integration/plan-citations.test.ts`, with the manifest
`frontend/tests/integration/plan-citations.json`, and it runs as part of
`npm --prefix frontend test`. Each manifest entry registers one citing file and
one cited plan line, the `anchors` that must sit on that line, and the
`siteCount` of citations that file makes of it.

- **The guard went red after you edited `plan.md`.** Update the citing files and
  the matching manifest entry as the failure directs; it distinguishes an anchor
  that moved to a new line from one that is gone from `plan.md` entirely.
- **You added a citation.** Add its manifest entry, or raise `siteCount` if that
  file already cites that line. Quote the anchor from the cited line, long
  enough to appear on that line and no other. If the citation depends on a
  number in that line, keep the number inside the anchor — an anchor that omits
  it stays green while the number changes.
- **You cited the plan from a new place.** The scanned roots and file extensions
  are constants at the top of the guard. A citation outside them is unguarded,
  so widen those constants instead.

### A claim about where code lives needs an executable check

A comment asserting that something is the only, the one, or the sole place — or
that nothing, everything, or no other module does X — must name the test or
grep that proves it, or not be written. Prefer deleting such a claim over
rewording it: a deleted comment cannot be wrong, and a reworded one can.
