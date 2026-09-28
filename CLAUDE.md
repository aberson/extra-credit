# Extra Credit — Project Instructions

## Project overview

Extra Credit is an open-source, parent-facing local web application that creates personalized, printable activity sheets from reusable child profiles. Version 1 stores profiles only in a gitignored local JSON file and generates four deterministic worksheet families without accounts, cloud services, telemetry, or runtime AI.

## Stack

| Layer | Tool |
|---|---|
| Runtime | Node.js `>=24.0 <25` (`.node-version` 24.14.0), npm `>=11 <12`, native ESM / NodeNext server build |
| Frontend UI | React 19, strict TypeScript 6, Vite 8 |
| Local server | Fastify 5 on `127.0.0.1:4310` |
| Development UI | Vite on `127.0.0.1:4311`, proxying `/api` to 4310 |
| Validation/storage | Zod 4, versioned JSON, `write-file-atomic` 7 |
| Print | Semantic HTML, plain screen/Letter/A4 CSS, browser Print |
| Tests | Vitest, Testing Library, fast-check, Playwright Chromium, axe-core, pdf-lib; DOM/PDF geometry on Windows and pinned Ubuntu 24.04 CI |
| Quality | ESLint, typescript-eslint, strict `tsc --noEmit`, GitHub Actions |

## Commands

The single npm package lives under `frontend/`.

```powershell
npm --prefix frontend install
npm exec --prefix frontend -- playwright install chromium
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend start
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:e2e
npm --prefix frontend run check
npm --prefix frontend run manual:print
npm --prefix frontend run security
```

The `manual:print` command starts the already-built app at an exact ephemeral loopback URL with the three canonical fictional profiles; stop it with Ctrl+C. It never accesses real family profiles. See `documentation/testing-print.md` for print settings and the automated fixture matrix. `release:verify` remains planned for Step 13.

Development uses `http://127.0.0.1:4311`; the built application uses `http://127.0.0.1:4310`. Dev-observatory reserves both ports for this project. Host and ports are fixed in v1—there are no production environment overrides. Tests derive one exact same-origin Host/Origin pair from the injected app's real ephemeral socket and temporary config path; no wildcard loopback port is accepted. A fixed-port conflict must exit nonzero. Inspect the live owner with `Get-NetTCPConnection` on Windows or `lsof` on macOS/Linux; workspace maintainers may separately check reservations from this repository with `uv run --project ..\dev-observatory observatory ports` when that sibling exists.

## Directory layout

```text
config/                         # example profile plus ignored children.local.json
documentation/                  # confirmed proposal and plan-review record
frontend/                       # single npm package
  scripts/                      # dev-preflight port guard
  src/server/                   # loopback API and production static server
  src/shared/                   # platform-neutral schemas and worksheet domain
  src/web/                      # React parent UI, preview, print views, and renderers
    assets/line-art/            # reviewed monochrome SVGs plus provenance manifest
    worksheets/                 # four React-only worksheet renderers
  src/worksheets/               # four generator definitions
  tests/integration/            # real Fastify, temporary-file, and plan-citation guard tests
  tests/e2e/                    # built-app Playwright and print tests
.github/                        # public issue guidance and CI
plan.md                         # canonical project plan and build steps
CONTRIBUTING.md                 # contribution, asset, privacy, and quality rules
ASSET_PROVENANCE.md             # ledger of every committed non-code asset
PRIVACY.md                      # what stays local and what leaves the machine
SECURITY.md                     # loopback boundary and reporting
LICENSE                         # root MIT license covering all project-original work
```

## Architecture summary

The React UI is parent-facing only. It obtains an in-memory session token, loads or creates the config through same-origin API routes with ETag preconditions, then calls the sole shared `projectGenerationRequest` boundary. That boundary applies `getV1ProfileSupport` before producing an allowlisted, age-free `GenerationRequestV1`: profiles accept ages 4–18, generation proceeds only for ages 4–8, and ages 9–18 remain editable with `GENERATION_AGE_UNSUPPORTED`. Disabled names/interests, profile IDs, age, review dates, and raw unmatched tags never enter the request. React and every worksheet renderer stay under `src/web`; server, shared, and generator modules remain platform-neutral. Age supplies setup suggestions and never asserts grade, placement, curriculum, readiness, or mastery. The browser persists no child data in localStorage, sessionStorage, IndexedDB, Cache API, or service workers.

The Fastify server binds only `127.0.0.1`, serves only `dist/web`, and owns the exact `config/children.local.json` path. It validates Host, Origin, Fetch Metadata, token, request size, transform-free transport schema, strict Zod schema, ETag precondition, and file state before serialized atomic replacement. Invalid-file recovery is explicit and backup-first; future versions are preserved. It never accepts a filesystem path or logs child data, and every API response is `no-store`. In-repository E2E/manual harnesses alone may select `securityMode: "ephemeral-test"`; it derives one exact authority from the real socket port and never permits wildcard loopback origins or a production override. Loopback blocks network peers, not other local processes or OS users: while the unauthenticated server runs, any local process that reaches port 4310 can use its API. Never forward the ports, and stop the server after use on shared or untrusted machines.

The worksheet layer is deterministic: normalized request plus nonzero eight-hex seed plus generator version yields the same educational content. It calculates finite candidate capacity before generation and fails closed rather than widening or duplicating work. V1 clamps every generated number, operand, and result to 20 and emits no negative results or carrying/borrowing; higher stored maxima/permissions are retained only for later sourced packs. Objective answers and open `answer: null` items live beside their sources in one immutable document; worksheet and answer-key renderers consume that same document. Instructional visuals and required work survive the decorative-graphics toggle; `count-compare-make` sizes each ten-frame from the quantity the child must reach, so a completion item always prints room for its own answer. Decoration is a separate bundled layer: `src/web/assets/line-art/` holds the project-original monochrome SVGs plus `manifest.json`, the machine-readable provenance source that `manifest.ts` validates and `ASSET_PROVENANCE.md` mirrors; `selectDecorativeAsset` picks a topic match by seed, and one fixed-size panel falls back to the doodle box whenever the toggle is off, no topic matches, or a bundled asset fails to load.

V1 activity IDs are `dry-math`, `find-the-wow`, `sentence-builder`, and `count-compare-make`. Age supplies setup suggestions only; explicit math skills and writing mode control generated work. Runtime AI and Mini Mission are later feature plans, not dormant v1 code. All project-original code, worksheet templates, documentation, and line art use the one root MIT `LICENSE`; do not add a second project license. Record any approved third-party material and its complete upstream terms in `ASSET_PROVENANCE.md` without relicensing it.

## Current state

Steps 1-9 are merged and issues #1-#9 are closed: the runnable application foundation and its CI/browser gates, the secure profile-config round trip, the parent profile setup flow, all four v1 worksheet families (`dry-math`, `find-the-wow`, `sentence-builder`, `count-compare-make`) with their preview, print, and answer-key surfaces, the reviewed decorative line-art system whose `frontend/src/web/assets/line-art/manifest.json` is mirrored by `ASSET_PROVENANCE.md` and governed by `CONTRIBUTING.md`, and Step 9's personalization and worksheet options (issue #9, absorbing #14 and #16): capacity-aware availability that never offers an unproducible selection, remedies that name only the maximum that actually binds, stored generation defaults kept separate from profiles, and profile-scoped disclosure of stored maxima above 20 and future-permission flags that v1 never uses. Local gates on `main` are 457 Vitest tests across 20 files, 158 Playwright specs, `eslint . --max-warnings 0` clean, and all three `tsc --noEmit` projects clean. Two mechanical guards run in the suite: `frontend/tests/integration/plan-citations.test.ts` and its `plan-citations.json` manifest register every `plan.md:NNN` citation in source and fail on line drift, a wrong number, an unregistered site, a stale anchor, or a changed number inside an anchored line (`CONTRIBUTING.md` § "Comment claims" owns the rule); `frontend/tests/integration/envelope-single-source.test.ts` fails if the Version 1 numeric envelope is ever defined anywhere but `V1_NUMERIC_MAXIMUM` in `frontend/src/shared/worksheet/types.ts`. Step 9's own structural regression test, `frontend/src/shared/worksheet/limit-labels.test.ts`, records which capacity/advice arm every sweep dispatch returns and asserts every declared reachable arm is observed and every structurally dead arm stays dead. The independent nested repository is public at `https://github.com/aberson/extra-credit`; `plan.md` remains the canonical implementation plan, `documentation/extra-credit-proposal.html` is its confirmed revision-2 review surface, and the privacy-critical root `.gitignore` plus canonical MIT `LICENSE` are in place. Step 10, print and pagination hardening (issue #10), is merged at `e721ca6` after round 5 of the approved 10-round limit: all eight independent reviews and the full main post-merge gate passed. Step 11, parent UI accessibility hardening, is merged at `1f30ce4` after eight independent reviews with zero findings and the full main post-merge gate. Next is Step 12, real-pipeline release smoke. Open issues #15, #18, and #19 carry review findings that later steps absorb.

Merged Step 10 adds: startup-bundled Letter/A4 stylesheets set physical margins and named pages; shared print tokens set 16/18 pt instructional text, compact grouped layouts, and response geometry. The built-app print matrix runs 84 distinct worksheet cases and 16 distinct applicable key PDFs using only canonical fictional profiles and deterministic boundary seeds, with required-content, exact Count/Compare item, page-count, dimensions, text/group containment, actual single-fragment and nonoverlap/order checks, and independent physical response dimensions. Large response geometry is compared with standard on the same content, and applicable art is decoded and verified visible after print media starts. Every measured surface has a screenshot; collapsed response/cell dimensions, column fragmentation, stacked/reordered groups, print-hidden art/content, wrong-seed, and delayed-CSS regressions calibrate the gate. The corpus contains 100 PDF/JSON/PNG surfaces (84 worksheets and 16 keys). The manual harness has compiled startup, exact-authority, canonical-profile, and shutdown coverage, including early IPC disconnect and signal-handler dispatch at import, allocation, and listen barriers. Computed named-page selection and every required shape edge are calibrated; circle dimensions and roundness are checked independently. Four ordering tests add 960 real generated Count/Compare observations and separately labeled synthetic worst-order stress; the repaired seed 00000005 prints one page. Main lint, all three TypeScript projects, 457 unit tests and 145 browser tests passed after merge. Evidence stays under ignored `.build-step/print-evidence/`; physical Edge/Chrome printing remains M1 acceptance and first Ubuntu CI execution remains M3. Steps 12 and 13 remain pending.

Step 10 also keeps separate Count/Compare ordering evidence under `.build-step/count-order-evidence/`: four paper/scale tests sweep 240 real seeds each, check every target prompt and one/two-frame geometry, and enumerate all maximum subtype orders against independent card-height ceilings. Real seed PDFs and explicitly labeled expanded-height DOM stress PDFs are separate from the original 100-surface matrix. Print places intact five-by-two frames side by side without reducing cell dimensions or instructional text. These are merged automated checks; M1/M2/M3 remain pending.

Step 11 adds screen-only responsive controls and visible focus, explicit focus transfers, and associated form/error guidance. Thirteen browser checks cover eight accessibility states, keyboard-only profile creation through preview, four-family reflow at 320 CSS pixels and text resizing, plus a negative oracle calibration. All six requested axe tag groups passed on the measured states. Main lint, three TypeScript projects, 457 unit tests and 158 browser tests passed after merge. This is scoped Windows Chromium evidence, not accessibility certification or physical/family acceptance.

## Environment requirements

- Node.js `>=24.0 <25` and npm `>=11 <12`; the verified baseline is Node 24.14.0/npm 11.9.0.
- Windows 11, macOS, or Linux for development; primary operator environment is Windows PowerShell.
- Current Microsoft Edge or Google Chrome on Windows 11 for the validated v1 physical-print path; Ubuntu 24.04 Chromium is the automated PDF/layout substrate, while other physical-print platforms are best-effort.
- GitHub CLI authentication is required only for the maintainer's post-push CI smoke, not normal app use.
- No Docker, database, login, API key, external service, public deployment, or persistent background process.
- Real profiles belong only in `config/children.local.json`, which must remain gitignored. Tests always inject a temporary path and use fictional data.
- The stopped JSON file relies on filesystem ACLs. The running loopback server is not an OS-account boundary and exposes its unauthenticated API to other local processes/users; use a trusted session, never forward its ports, and stop it after use on shared or untrusted machines.
