# Extra Credit

Extra Credit is an open-source, local web application for creating personalized, printable activity sheets for children. Parents configure reusable child profiles, choose a worksheet and options, preview it, and print the worksheet with an optional answer key. Version 1 targets U.S.-English early primary practice and uses deterministic local generation—no accounts, cloud services, telemetry, or runtime AI.

> **Steps 1-19, two iterative UAT revisions and the [worksheet-first controls](documentation/worksheet-first-plan.md) plan are implemented** — issues #25-#31 closed (Step 20 was folded into Step 18). Parents now choose the worksheet type, variant, practice focus or vocabulary, and decorative Theme in a worksheet-first panel; profiles hold only a nickname, review date and interests; saved files move to schema version 2 with a lossless upgrade and one byte-identical backup. The final Windows check passed 848 unit tests and 180 browser specs, lint/types, and log-privacy calibration. Physical-print and family-pilot acceptance remain pending. Two follow-on plans remain, trimmed by the 2026-09-30 lean revision: [math operations and activities](documentation/math-activities-plan.md) (Steps 24-27, issues #35-#38) and [printable packets](documentation/printable-packets-plan.md) (Steps 31 and 33). See [plan.md](plan.md), the [UAT review](documentation/uat-round-2-review.md), and the [operator decisions](documentation/feature-seeds/operator-decisions.md).

## V1 worksheets

| Worksheet | Status | What it provides |
|---|---|---|
| **Dry Math** | Shipped (Step 4) | Numbers and symbols only, using parent-confirmed operations and limits. |
| **Two Whats and a Wow** | Shipped (Step 5) | Three distinct statements per group: exactly two false “whats” and one true “wow,” using equations or quantities as appropriate. |
| **Sentence Builder** | Shipped (Step 6) | Drawing, labeling, copying, sentence-frame, and independent-writing modes with reviewed word banks. |
| **Count, Compare & Make** | Shipped (Step 8) | A mix of matching, comparing, completing, and drawing quantities for a child who is just beginning to count. |

Answer keys, black-and-white line art, Letter and A4 selection, and independent toggles for nickname, interests, and decorative graphics all ship today; automated print and pagination hardening is merged. Personalization may change headings, reviewed vocabulary, topics, or decoration; it never changes the learning target or mathematical answer. While decorative graphics are on, Sentence Builder and Count, Compare & Make also offer a **Theme** under More options (From interests, one of the five reviewed topics, or Neutral) that picks the artwork only: Neutral and interests with no matching artwork use a simple star, and a theme never changes the work or the answers.

**Worksheet-first controls.** The worksheet panel asks for the work first: the worksheet type (four cards), its variant where one exists (Sentence Builder's writing activity, or Two Whats and a Wow's Quantity pictures or Equations statements), the child, and then a practice focus that states its operations and range in words, such as "Addition within 20" or "Quantities to 10"; Sentence Builder asks for its vocabulary instead. Length, the answer key, personalization, and print layout sit under More options. Whether a worksheet can be created depends only on these choices, never on which child is selected. The choices are session state: profile edits, profile saves, and in-app reloads keep them, a browser page reload starts again from the saved defaults, and Create or Make another never writes the local file. Only **Save these as worksheet defaults** stores them, as one set of starting choices for every child. A file saved by an earlier version keeps each child's earlier writing mode, vocabulary band, and math values; they supply that child's starting choices until the first defaults save, which ends that for good.

A new child profile holds only a nickname, a review date, and up to five broad interests. Extra Credit's worksheets are designed for early primary practice; the parent's worksheet choices, not the profile, decide the work.

## Privacy boundary

The code is public, but family data stays local:

- The production user-data store is the gitignored `config/children.local.json`; explicit recovery, and the first save of a file an earlier version saved, can also leave residual backup copies described below. Local attended UAT may use separate ignored retained profiles under `config/uat-session/`; these are private too and are excluded from release exports.
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

Extra Credit never automatically overwrites an invalid, newer-version, oversized, or unsafe target. A parent may explicitly choose **Back up invalid file and replace** only for a bounded regular file with invalid UTF-8, malformed JSON, or an invalid v1 or v2 schema. The server first creates a byte-identical exclusive sibling such as `children.local.json.invalid-YYYYMMDDTHHMMSSZ-1234abcd.bak`, flushes it, and only then replaces the live file. A file saved by a newer version of Extra Credit (a higher schema version, or a current-version file with keys or values this version does not know) is left unchanged and blocked; it needs that newer version or manual intervention. Oversized, symbolic-link, and non-regular targets must be moved or repaired manually. The unreadable raw file is never automatically downloaded into the browser.

A file saved by an earlier version is read without being changed. The first explicit save (a profile change or a worksheet-defaults save) first writes a byte-identical sibling such as `children.local.json.v1-YYYYMMDDTHHMMSSZ-1234abcd.bak`, flushes it, and only then replaces the live file with version 2. That `.v1-…bak` upgrade backup is a residual local copy: it keeps the old age and Difficulty values that version 2 no longer stores, and it stays until you delete it.

Real config files, temporary siblings, and recovery and upgrade backups are ignored by git, but they remain local files. Deleting a profile rewrites only the live JSON file. It does not delete `.bak` siblings under `config/`, a manually downloaded `extra-credit-profile-backup.json`, saved worksheet PDFs/screenshots, or paper copies. Review and remove those separately from the repository's `config/` directory and from whatever download/PDF folders or physical storage you chose. Automatic backup discovery and deletion are outside v1.

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
Run `npm --prefix frontend run release:verify` for a candidate public release. It exports current working-tree bytes (including new public files), excludes private config, recovery/download, environment, dependency, build, and orchestration files before reading them, rejects links, and audits the export. It then runs `npm ci`, installs Chromium, and runs the full `check` gate in an owned OS temporary clean room. Installation requires network access. No push occurs.

Path/SHA-256 manifests, command logs and actual exits are retained under `.build-step/release-*/`. Successful clean rooms are removed; failures retain the clean room and browser artifacts, with the path and cleanup outcome recorded in `06-result.json`. The audit permits canonical fictional serialized profiles only in the example, test fixtures, and the plan appendix. Runtime source links are allowed only as non-executable comments or documentation/provenance; an external runtime URL is never approved by its domain. Physical Edge/Chrome printing (M1), the family pilot (M2), and Ubuntu live CI on the pushed commit (M3) remain separate manual acceptance.

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

A profile contains an optional nickname, a review date, and up to five broad interests. A profile carried over from a file an earlier version saved also keeps that child's earlier writing mode, vocabulary band, and math values as read-only earlier settings, shown in the profile editor and never edited there. No worksheet choice asserts grade, placement, readiness, or mastery. V1 stores no scores, completed worksheets, or inferred performance history.

## Key design decisions

- Educational content is governed by the parent's explicit worksheet choices: the worksheet type, its variant, and a practice focus or vocabulary stated in words.
- Dry Math supports addition/subtraction presets through 100; quantity and Wow activities stay within 20. Dry Math carries and borrows only when the parent chooses "Every problem carries or borrows" under Carrying and borrowing, and no activity produces negative results.
- A seed and generator version reproduce the same educational content.
- Answer keys derive from the same immutable worksheet document shown to the child.
- Instructional visuals remain present when decorative graphics are disabled.
- Semantic HTML and CSS are the source of truth for both preview and print.
- Runtime AI is deferred to a separate V2-or-later, explicit opt-in feature plan. Deterministic local generation must remain the default and fallback.
- The app performs work only in direct response to a parent action; V1 has no scheduler or background service.

## Roadmap

The confirmed V1 plan contains thirteen gated implementation steps. Steps 1-13 are merged; physical-print, family-pilot, and post-push Ubuntu acceptance remain pending. The worksheet-first controls plan (Steps 14-19) is merged. The math operations and packets plans (kept Steps 24-27, 31 and 33) are linked from plan.md and are not yet built.

1. Application and continuous-integration foundation — complete
2. Secure local-profile storage and setup — complete
3. Four worksheet vertical slices — complete
4. Reviewed line art — complete, including personalization and worksheet options
5. Printing, pagination, and accessibility - automated gates merged
6. Release verification and public-project documentation - automated gates merged
7. Physical-print, family-pilot, and live-CI acceptance checks

Later feature plans may add Mini Missions, shapes, measurement, language and science activities, reviewed content beyond early primary practice, and optional runtime AI with a fresh privacy and security review.

## Contributing

Steps 1-19 are merged. Manual acceptance remains pending. Before contributing, read [plan.md](plan.md) and choose work from the corresponding GitHub issue.

[CONTRIBUTING.md](CONTRIBUTING.md) is the single source of truth for contribution rules: licensing, third-party material, asset rules, privacy rules, and the quality gates every pull request must pass. Read it before opening a pull request.

## License

All project-original code, worksheet templates, documentation, and line art are licensed under the [MIT License](LICENSE). Every committed non-code asset and its rights are recorded in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md), mirrored from `frontend/src/web/assets/line-art/manifest.json`. Third-party material, if approved later, retains its upstream terms, is recorded there separately, and is excluded from the project's MIT grant.
