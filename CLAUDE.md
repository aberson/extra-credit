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
npm --prefix frontend run manual:print
npm --prefix frontend run check
npm --prefix frontend run release:verify
npm --prefix frontend run security
```

Development uses `http://127.0.0.1:4311`; the built application uses `http://127.0.0.1:4310`. Dev-observatory reserves both ports for this project. Host and ports are fixed in v1—there are no production environment overrides. Tests derive one exact same-origin Host/Origin pair from the injected app's real ephemeral socket and temporary config path; no wildcard loopback port is accepted. A fixed-port conflict must exit nonzero. Inspect the live owner with `Get-NetTCPConnection` on Windows or `lsof` on macOS/Linux; workspace maintainers may separately check reservations from this repository with `uv run --project ..\dev-observatory observatory ports` when that sibling exists.

## Directory layout

```text
config/                         # example profile plus ignored children.local.json
documentation/                  # educational basis and physical-print protocol
frontend/                       # single npm package
  src/server/                   # loopback API and production static server
  src/shared/                   # platform-neutral schemas and worksheet domain
  src/web/                      # React parent UI, preview, print views, and renderers
    worksheets/                 # four React-only worksheet renderers
  src/worksheets/               # four generator definitions
  tests/integration/            # real Fastify plus temporary-file tests
  tests/e2e/                    # built-app Playwright and print tests
.github/                        # public issue guidance and CI
plan.md                         # canonical project plan and build steps
```

## Architecture summary

The React UI is parent-facing only. It obtains an in-memory session token, loads or creates the config through same-origin API routes with ETag preconditions, then calls the sole shared `projectGenerationRequest` boundary. That boundary applies `getV1ProfileSupport` before producing an allowlisted, age-free `GenerationRequestV1`: profiles accept ages 4–18, generation proceeds only for ages 4–8, and ages 9–18 remain editable with `GENERATION_AGE_UNSUPPORTED`. Disabled names/interests, profile IDs, age, review dates, and raw unmatched tags never enter the request. React and every worksheet renderer stay under `src/web`; server, shared, and generator modules remain platform-neutral. Age supplies setup suggestions and never asserts grade, placement, curriculum, readiness, or mastery. The browser persists no child data in localStorage, sessionStorage, IndexedDB, Cache API, or service workers.

The Fastify server binds only `127.0.0.1`, serves only `dist/web`, and owns the exact `config/children.local.json` path. It validates Host, Origin, Fetch Metadata, token, request size, transform-free transport schema, strict Zod schema, ETag precondition, and file state before serialized atomic replacement. Invalid-file recovery is explicit and backup-first; future versions are preserved. It never accepts a filesystem path or logs child data, and every API response is `no-store`. In-repository E2E/manual harnesses alone may select `securityMode: "ephemeral-test"`; it derives one exact authority from the real socket port and never permits wildcard loopback origins or a production override. Loopback blocks network peers, not other local processes or OS users: while the unauthenticated server runs, any local process that reaches port 4310 can use its API. Never forward the ports, and stop the server after use on shared or untrusted machines.

The worksheet layer is deterministic: normalized request plus nonzero eight-hex seed plus generator version yields the same educational content. It calculates finite candidate capacity before generation and fails closed rather than widening or duplicating work. V1 clamps every generated number, operand, and result to 20 and emits no negative results or carrying/borrowing; higher stored maxima/permissions are retained only for later sourced packs. Objective answers and open `answer: null` items live beside their sources in one immutable document; worksheet and answer-key renderers consume that same document. Instructional visuals and required work survive the decorative-graphics toggle.

V1 activity IDs are `dry-math`, `find-the-wow`, `sentence-builder`, and `count-compare-make`. Age supplies setup suggestions only; explicit math skills and writing mode control generated work. Runtime AI and Mini Mission are later feature plans, not dormant v1 code. All project-original code, worksheet templates, documentation, and line art use the one root MIT `LICENSE`; do not add a second project license. Record any approved third-party material and its complete upstream terms in `ASSET_PROVENANCE.md` without relicensing it.

## Current state

The plan decisions are operator-confirmed; no application code or nested Git repository exists yet. `plan.md` remains the canonical implementation plan, `documentation/extra-credit-proposal.html` is its confirmed revision-2 review surface, and the privacy-critical root `.gitignore` plus canonical MIT `LICENSE` are pre-created. The public repository name `extra-credit` is selected; confirm the target GitHub account immediately before `/repo-init`. Then follow Section 11 exactly: bootstrap the project-local task-handoff helper/schema, run `/repo-init` once, backfill every issue field, and run `/plan-expedite` before implementation.

## Environment requirements

- Node.js `>=24.0 <25` and npm `>=11 <12`; the verified baseline is Node 24.14.0/npm 11.9.0.
- Windows 11, macOS, or Linux for development; primary operator environment is Windows PowerShell.
- Current Microsoft Edge or Google Chrome on Windows 11 for the validated v1 physical-print path; Ubuntu 24.04 Chromium is the automated PDF/layout substrate, while other physical-print platforms are best-effort.
- GitHub CLI authentication is required only for the maintainer's post-push CI smoke, not normal app use.
- No Docker, database, login, API key, external service, public deployment, or persistent background process.
- Real profiles belong only in `config/children.local.json`, which must remain gitignored. Tests always inject a temporary path and use fictional data.
- The stopped JSON file relies on filesystem ACLs. The running loopback server is not an OS-account boundary and exposes its unauthenticated API to other local processes/users; use a trusted session, never forward its ports, and stop it after use on shared or untrusted machines.
