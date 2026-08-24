# Extra Credit

Extra Credit is an open-source, local web application for creating personalized, printable activity sheets for children. Parents configure reusable child profiles, choose a worksheet and options, preview it, and print the worksheet with an optional answer key. Version 1 targets U.S.-English practice for ages 4–8 and uses deterministic local generation—no accounts, cloud services, telemetry, or runtime AI.

> **Steps 1-7 complete** — issues #1-#7 closed. Parents can create local child profiles and generate, preview, and print three of the four V1 worksheet families with answer keys and reviewed decorative line art. 327 tests passing, 0 type errors, 0 lint violations. Step 8 (Count, Compare & Make) is next; see [plan.md](plan.md).

## V1 worksheets

| Worksheet | Status | What it provides |
|---|---|---|
| **Dry Math** | Shipped (Step 4) | Numbers and symbols only, using parent-confirmed operations and limits. |
| **Two Whats and a Wow** | Shipped (Step 5) | Three distinct statements per group: exactly two false “whats” and one true “wow,” using equations or quantities as appropriate. |
| **Sentence Builder** | Shipped (Step 6) | Drawing, labeling, copying, sentence-frame, and independent-writing modes with reviewed word banks. |
| **Count, Compare & Make** | Planned (Step 8) | An age-four-friendly mix of matching, comparing, completing, and drawing quantities. |

Answer keys, black-and-white line art, Letter and A4 selection, and independent toggles for nickname, interests, and decorative graphics all ship today; print and pagination hardening lands in Step 10. Personalization may change headings, reviewed vocabulary, topics, or decoration; it never changes the learning target or mathematical answer.

Profiles may be stored for ages 4–18. Worksheet generation is enabled only for ages 4–8 in V1; profiles for ages 9–18 remain editable while later content packs are reviewed.

## Privacy boundary

The code is public, but family data stays local:

- The only live durable user-data store is the gitignored `config/children.local.json`; explicit recovery can also leave residual backup copies described below.
- The browser will not store child data in local storage, session storage, IndexedDB, the Cache API, or service workers.
- V1 has no login, cloud sync, analytics, advertising, API keys, or runtime AI.
- The application binds only to `127.0.0.1`: port `4310` for the built app/API and port `4311` for Vite development.
- Loopback prevents access from network peers, but it is **not** an operating-system account boundary. While the server is running, another local process or user able to reach port `4310` can use its unauthenticated API. Never forward these ports, and stop the server after use on shared or untrusted computers.
- Deleting a live profile does not remove earlier backups, browser downloads, saved PDFs, screenshots, or printed copies; those must be cleaned up separately.

When the server is stopped, normal filesystem permissions protect the plaintext file: new files request owner-only mode `0600` on POSIX systems, while Windows relies on the current account's access-control list. Those permissions do not protect the running API from another local process or OS user that can reach its loopback port. Use Extra Credit only in a trusted machine session, never forward ports `4310` or `4311`, and stop it after use—especially on a shared or untrusted computer.

Use nicknames rather than legal names. Extra Credit does not ask for surnames, exact birthdates, schools, teachers, email addresses, locations, photos, voices, diagnoses, scores, or behavioral history. Nicknames and interest tags are still free text, so do not put any of those details there. The project makes no claim of legal compliance for child-facing online use; the browser experience is for a parent or other grown-up.

The application runtime sends no profile or worksheet data to a cloud service. Dependency installation and the explicit `npm --prefix frontend run security` maintenance command can contact the npm registry; those are development operations, not profile-data transmission.

## Profile file safety and recovery

The server owns one fixed path, `config/children.local.json`; the HTTP API never accepts a filesystem path. It reads at most 64 KiB, rejects symbolic links and other non-regular targets, validates UTF-8/JSON/the complete versioned schema, and requires ETag preconditions so a stale browser tab cannot silently overwrite a newer save. Writes use flushed atomic replacement and normalized two-space JSON with a final newline.

Extra Credit never automatically overwrites an invalid, newer-version, oversized, or unsafe target. A parent may explicitly choose **Back up invalid file and replace** only for a bounded regular file with invalid UTF-8, malformed JSON, or an invalid v1 schema. The server first creates a byte-identical exclusive sibling such as `children.local.json.invalid-YYYYMMDDTHHMMSSZ-1234abcd.bak`, flushes it, and only then replaces the live file. A newer schema version needs a future migration or manual intervention; oversized, symbolic-link, and non-regular targets must be moved or repaired manually. The unreadable raw file is never automatically downloaded into the browser.

Real config files, temporary siblings, and recovery backups are ignored by git, but they remain local files. Deleting a profile rewrites only the live JSON file. It does not delete `.bak` siblings under `config/`, a manually downloaded `extra-credit-profile-backup.json`, saved worksheet PDFs/screenshots, or paper copies. Review and remove those separately from the repository's `config/` directory and from whatever download/PDF folders or physical storage you chose. Automatic backup discovery and deletion are outside v1.

Keep any manual profile backup and browser-saved worksheet under the generic filenames offered by the app and save them outside this public repository. Those copies remain the parent's responsibility.

## Stack

| Tool | Why |
|---|---|
| Node.js 24 and npm 11 | One runtime and dependency graph for the server, shared domain logic, tests, and browser build. |
| React 19 and strict TypeScript 6 | React is confined to the parent-facing frontend UI; shared generators and server code remain platform-neutral. |
| Vite 8 | Fast development and a production browser bundle. |
| Fastify 5 | A small loopback-only API and production static server. |
| Zod 4 and versioned JSON | Strict validation for forms, API requests, and the local profile file. |
| Pure seeded TypeScript generators | Reproducible worksheets and locally verified answers without a network or AI dependency. |
| Semantic HTML and print CSS | One accessible source for preview, Letter/A4 output, and browser printing. |
| Vitest and Playwright | Unit, integration, accessibility, browser-flow, and print-geometry coverage. |

The project uses one npm package under `frontend/`. React and all React worksheet renderers stay under `frontend/src/web/`.

## Prerequisites

Local development requires:

- Git
- Node.js `>=24.0 <25` and npm `>=11 <12`
- Current Microsoft Edge or Google Chrome for the validated V1 physical-print path
- Windows, macOS, or Linux

Docker, a database, an account, an API key, and a cloud service are not required.

## Setup and development run

1. Clone the repository and enter it:

   ```shell
   git clone https://github.com/aberson/extra-credit.git
   cd extra-credit
   ```

2. Install dependencies:

   ```shell
   npm --prefix frontend install
   ```

3. Install the test browser:

   ```shell
   npm exec --prefix frontend -- playwright install chromium
   ```

4. Start the development server:

   ```shell
   npm --prefix frontend run dev
   ```

5. Open `http://127.0.0.1:4311`.

6. Stop both development processes with `Ctrl+C` when finished.

The browser shell carries the parent profile setup screen, the generator controls, the worksheet preview, and the print and answer-key views. The secure config API creates the sole durable family-data file at `config/children.local.json` after a valid, preconditioned save.

For a production-style local run:

```shell
npm --prefix frontend run build
npm --prefix frontend start
```

Then open `http://127.0.0.1:4310`.

## Quality commands

```shell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
npm --prefix frontend run check
npm --prefix frontend run security
```

Tests use fictional profiles and temporary config paths; they must never read or write a real family profile.
The clean-room `release:verify` command arrives with the public-release step.

## Data and project structure

```text
config/
  children.example.json       # committed fictional examples
  children.local.json         # real profiles; always gitignored
documentation/                # confirmed proposal and plan-review record
frontend/
  src/server/                 # loopback API and static server
  src/shared/                 # schemas and worksheet contracts
  src/web/                    # React parent UI and print views
  src/web/assets/line-art/    # reviewed monochrome SVGs and provenance manifest
  src/worksheets/             # platform-neutral generators
  tests/                      # integration and browser tests
.github/                      # public issue guidance and CI
plan.md                       # canonical implementation plan
CONTRIBUTING.md               # contribution, asset, privacy, and quality rules
ASSET_PROVENANCE.md           # ledger of every committed non-code asset
PRIVACY.md                    # what stays local and what leaves the machine
SECURITY.md                   # loopback boundary and reporting
LICENSE                       # project MIT license
```

A profile contains an optional nickname, age, parent-confirmed presentation band, review date, explicit math capabilities, writing mode, and up to five broad interests. Age provides setup suggestions only; it does not determine grade, placement, readiness, or mastery. V1 stores no scores, completed worksheets, or inferred performance history.

## Key design decisions

- Educational content is governed by explicit capabilities rather than age alone.
- Every generated number, operand, and result stays within 20 in V1, with no negative results or carrying/borrowing.
- A seed and generator version reproduce the same educational content.
- Answer keys derive from the same immutable worksheet document shown to the child.
- Instructional visuals remain present when decorative graphics are disabled.
- Semantic HTML and CSS are the source of truth for both preview and print.
- Runtime AI is deferred to a separate V2-or-later, explicit opt-in feature plan. Deterministic local generation must remain the default and fallback.
- The app performs work only in direct response to a parent action; V1 has no scheduler or background service.

## Roadmap

The confirmed V1 plan contains thirteen gated implementation steps. Steps 1-7 are complete; Steps 8-13 remain.

1. Application and continuous-integration foundation — complete
2. Secure local-profile storage and setup — complete
3. Four worksheet vertical slices — three complete; Count, Compare & Make remains
4. Reviewed line art — complete; personalization and worksheet options remain
5. Printing, pagination, and accessibility
6. Release verification and public-project documentation
7. Physical-print, family-pilot, and live-CI acceptance checks

Later feature plans may add Mini Missions, shapes, measurement, language and science activities, reviewed content for ages nine and older, and optional runtime AI with a fresh privacy and security review.

## Contributing

Steps 1-7 are merged and Step 8 (Count, Compare & Make) is the current frontier. Before contributing, read [plan.md](plan.md) and choose work from the corresponding GitHub issue.

[CONTRIBUTING.md](CONTRIBUTING.md) is the single source of truth for contribution rules: licensing, third-party material, asset rules, privacy rules, and the quality gates every pull request must pass. Read it before opening a pull request.

## License

All project-original code, worksheet templates, documentation, and line art are licensed under the [MIT License](LICENSE). Every committed non-code asset and its rights are recorded in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md), mirrored from `frontend/src/web/assets/line-art/manifest.json`. Third-party material, if approved later, retains its upstream terms, is recorded there separately, and is excluded from the project's MIT grant.
