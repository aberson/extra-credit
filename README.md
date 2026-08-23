# Extra Credit

Extra Credit is an open-source, local web application for creating personalized, printable activity sheets for children. Parents configure reusable child profiles, choose a worksheet and options, preview it, and print the worksheet with an optional answer key. Version 1 targets U.S.-English practice for ages 4–8 and uses deterministic local generation—no accounts, cloud services, telemetry, or runtime AI.

> **Project status:** Planning scaffold. The implementation, npm package, and runnable application have not been created yet. The confirmed build contract is in [plan.md](plan.md).

## Planned V1 worksheets

| Worksheet | What it provides |
|---|---|
| **Dry Math** | Numbers and symbols only, using parent-confirmed operations and limits. |
| **Two Whats and a Wow** | Three distinct statements per group: exactly two false “whats” and one true “wow,” using equations or quantities as appropriate. |
| **Sentence Builder** | Drawing, labeling, copying, sentence-frame, and independent-writing modes with reviewed word banks. |
| **Count, Compare & Make** | An age-four-friendly mix of matching, comparing, completing, and drawing quantities. |

V1 will support Letter and A4 printing, black-and-white graphics, answer keys where applicable, and independent toggles for nickname, interests, and decorative graphics. Personalization may change headings, reviewed vocabulary, topics, or decoration; it never changes the learning target or mathematical answer.

Profiles may be stored for ages 4–18. Worksheet generation is enabled only for ages 4–8 in V1; profiles for ages 9–18 remain editable while later content packs are reviewed.

## Privacy boundary

The code is public, but family data stays local:

- The only durable user-data file is the gitignored `config/children.local.json`.
- The browser will not store child data in local storage, session storage, IndexedDB, the Cache API, or service workers.
- V1 has no login, cloud sync, analytics, advertising, API keys, or runtime AI.
- The application binds only to `127.0.0.1`: port `4310` for the built app/API and port `4311` for Vite development.
- Loopback prevents access from network peers, but it is **not** an operating-system account boundary. While the server is running, another local process or user able to reach port `4310` can use its unauthenticated API. Never forward these ports, and stop the server after use on shared or untrusted computers.
- Deleting a live profile does not remove earlier backups, browser downloads, saved PDFs, screenshots, or printed copies; those must be cleaned up separately.

Use nicknames rather than legal names, and do not enter school, teacher, location, health, diagnosis, or behavioral information.

## Planned stack

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

The project will use one npm package under `frontend/`. React and all React worksheet renderers stay under `frontend/src/web/`.

## Prerequisites

Once the application foundation is implemented, local development will require:

- Git
- Node.js `>=24.0 <25` and npm `>=11 <12`
- Current Microsoft Edge or Google Chrome for the validated V1 physical-print path
- Windows, macOS, or Linux

Docker, a database, an account, an API key, and a cloud service are not required.

## Planned setup and development run

These commands become available when the application-foundation build step lands:

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

For the planned production-style local run:

```shell
npm --prefix frontend run build
npm --prefix frontend start
```

Then open `http://127.0.0.1:4310`.

## Planned quality commands

```shell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
npm --prefix frontend run check
npm --prefix frontend run security
npm --prefix frontend run release:verify
```

Tests will use fictional profiles and temporary config paths; they must never read or write a real family profile.

## Data and project structure

```text
config/
  children.example.json       # committed fictional examples
  children.local.json         # real profiles; always gitignored
documentation/                # educational basis and print protocol
frontend/
  src/server/                 # loopback API and static server
  src/shared/                 # schemas and worksheet contracts
  src/web/                    # React parent UI and print views
  src/worksheets/             # platform-neutral generators
  tests/                      # integration and browser tests
plan.md                       # canonical implementation plan
LICENSE                       # project MIT license
```

A profile will contain an optional nickname, age, parent-confirmed presentation band, review date, explicit math capabilities, writing mode, and up to five broad interests. Age provides setup suggestions only; it does not determine grade, placement, readiness, or mastery. V1 stores no scores, completed worksheets, or inferred performance history.

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

The confirmed V1 plan contains thirteen gated implementation steps covering:

1. Application and continuous-integration foundation
2. Secure local-profile storage and setup
3. Four worksheet vertical slices
4. Reviewed line art, personalization, and generation controls
5. Printing, pagination, and accessibility
6. Release verification and public-project documentation
7. Physical-print, family-pilot, and live-CI acceptance checks

Later feature plans may add Mini Missions, shapes, measurement, language and science activities, reviewed content for ages nine and older, and optional runtime AI with a fresh privacy and security review.

## Contributing

The repository is currently at the planning stage. Before contributing, read [plan.md](plan.md) and choose work from the corresponding GitHub issue.

Contributions must:

- Use only fictional test profiles and outputs.
- Preserve the local-data and deterministic-generation boundaries.
- Include appropriate tests and documentation.
- Avoid unreviewed third-party or trademark-dependent artwork.
- Record complete provenance and upstream terms for any approved third-party material.

## License

All project-original code, worksheet templates, documentation, and line art are licensed under the [MIT License](LICENSE). Third-party material, if approved later, retains its upstream terms, is recorded separately, and is excluded from the project's MIT grant.
