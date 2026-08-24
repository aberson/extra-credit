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

## Quality gates

Run these from the repository root before opening a pull request:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
```

`npm --prefix frontend run check` runs all four in order. Add tests with every
behavior change, and keep worksheet generation deterministic for a given
normalized request and seed.
