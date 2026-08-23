# Extra Credit — Project Plan

## 1. What This Is

Proposal: documentation/extra-credit-proposal.html

Extra Credit is an open-source, parent-facing local web application that creates personalized, capability-aligned activity sheets for printing at home. A parent maintains reusable child profiles in a gitignored JSON file, chooses an activity and a small set of options, previews the result, then prints the worksheet and an optional parent answer key. Version 1 supports Dry Math, Math — Two Whats and a Wow, Sentence Builder, and the younger-child-friendly Count, Compare & Make. Children use the printed output rather than an online account, and the application sends no profile or worksheet data off the computer.

Version 1 is deliberately not a tutor, assessment system, public hosted service, classroom manager, cloud-sync product, worksheet archive, scheduler, or AI-dependent generator. Runtime AI is reserved for an explicitly enabled v2-or-later experiment that must retain the deterministic local generator as its fallback.

V1 is a narrow U.S.-English number/operations and emergent-to-independent sentence-practice set for ages 4–8, with preschool and early-primary capability bands plus age-four, age-six, and age-eight acceptance fixtures. Its source envelope spans preschool through Grade 2 examples, but age never implies a grade or skill placement. It is not a comprehensive preschool-through-Grade-2 curriculum; profiles ages 9–18 remain editable but generation stays disabled until those ages receive their own sources, content review, print fixtures, and family acceptance work.

## 2. Stack

| Layer | Tool | Why |
|---|---|---|
| Runtime | Node.js `>=24.0 <25` and npm `>=11 <12` | One supported runtime for the local server, shared domain code, tests, and frontend build. The repository pins `.node-version` to the operator's verified Node 24.14.0. |
| Frontend UI | React 19 with strict TypeScript 6 | React is used only for the parent-facing browser interface. Strict TypeScript keeps profile, generator, and API contracts aligned. |
| Build | Vite 8 | Fast local development, a production browser bundle, and explicit dev-server proxy/security controls without server rendering. |
| Local server | Fastify 5, `@fastify/static`, and `@fastify/helmet` | A small loopback-only API with JSON-schema validation, bounded requests, security headers, static production serving, and injection-based integration tests. |
| Shared validation | Zod 4 | One strict schema validates setup forms, HTTP bodies, and the on-disk JSON file; Zod's Draft 7 JSON Schema conversion feeds Fastify. |
| File durability | `write-file-atomic` 7 | Serializes writes to the fixed config path and replaces the file through a flushed temporary sibling plus rename while remaining compatible with the verified Node 24.14.0 baseline. |
| Worksheet generation | Pure TypeScript with a project-owned seeded pseudorandom number generator (PRNG) | Reproducible worksheets, locally recomputed answers, no network dependency, and no AI deciding mathematical truth. |
| Styling and print | Semantic HTML and plain CSS | One source of layout truth for preview and print, reliable physical units, accessible real text, and no second PDF component system. |
| Unit/component tests | Vitest 4, Testing Library, `jsdom`, `fast-check`, `pdf-lib`, and `yaml` | Fast tests for generators, validation, server routes, parent UI behavior, deterministic properties, PDF page-count inspection, and CI-contract parsing. `pdf-lib` and `yaml` are development-only verification tools, not worksheet exporters. |
| Browser/accessibility tests | Playwright 1.62 with Chromium and `@axe-core/playwright` | Real built-app flows, automated accessibility scans, print-media checks, DOM/PDF geometry assertions, and network/privacy gates in a pinned CI environment. |
| Quality | ESLint 10, typescript-eslint 8, and `tsc --noEmit` | Zero-warning linting plus separate shared, browser, and server type boundaries. TypeScript is initially pinned to `~6.0.3`, within typescript-eslint's supported range. |
| Development orchestration | `tsx` 4, `concurrently` 10, and `rimraf` 6 | Cross-platform server watch, fail-fast two-process development, and one explicit build clean. |
| CI | GitHub Actions on `ubuntu-24.04` with `actions/setup-node@v4` reading `.node-version` | Public, reproducible `npm ci`, lint, typecheck, unit/integration, build, and Playwright gates on one declared Node/Chromium/font substrate. |
| Licensing | One root MIT license for all project-original software, worksheet templates, documentation, and line art | Keeps reuse and contribution terms consistent across the public repository. Any approved third-party material remains under its own recorded license and is excluded from the project's MIT grant. |

The repository contains one npm package under `frontend/`. Despite that directory name, React remains confined to `src/web`; Fastify lives in `src/server`, and platform-neutral contracts live in `src/shared`.

`frontend/package.json` declares `"type": "module"`. Shared/server TypeScript uses `module` and `moduleResolution` `NodeNext` with explicit ESM import specifiers; the web target uses `module: "ESNext"` and `moduleResolution: "Bundler"` for Vite. The first build gate dynamically imports the emitted `dist/server/app.js` from the real `.mjs` harness, so ESM/source-output drift fails before later worksheet work.

Terminology used below: AI is artificial intelligence; API is application programming interface; HTML is HyperText Markup Language; CSS is Cascading Style Sheets; DOM is the browser Document Object Model; PDF is Portable Document Format; JSON is JavaScript Object Notation; HTTP is Hypertext Transfer Protocol; URL is Uniform Resource Locator; ESM is JavaScript's native ECMAScript module format; TSX is TypeScript with JSX markup; E2E means end-to-end; CI means continuous integration; CLI means command-line interface; PRNG is pseudorandom number generator; UUID is universally unique identifier; SVG is Scalable Vector Graphics; CORS is Cross-Origin Resource Sharing; CSP is Content Security Policy; HSTS is HTTP Strict Transport Security; XHR is XMLHttpRequest; POSIX names the Portable Operating System Interface family; ACL is access-control list; and Ajv is Fastify's JSON Schema validator. IES is the U.S. Institute of Education Sciences; NAEYC is the National Association for the Education of Young Children; AAP is the American Academy of Pediatrics; FTC is the U.S. Federal Trade Commission; ELOF is Head Start's Early Learning Outcomes Framework; WCAG is the Web Content Accessibility Guidelines; UDL is Universal Design for Learning; and COPPA is the U.S. Children's Online Privacy Protection Act.

Bootstrap baselines verified on 2026-08-22 are Node 24.14.0, npm 11.9.0, React 19.2, Vite 8.2.2, Fastify 5.12, Zod 4.4, TypeScript 6.0, Vitest 4.1.11, Playwright 1.62.1, and `write-file-atomic` 7.0.0. Vite accepts Node `^20.19.0 || >=22.12.0`; Vitest accepts `^20.0.0 || ^22.0.0 || >=24.0.0`; Playwright accepts Node 20 or newer; `write-file-atomic` 7 accepts `^20.17.0 || >=22.9.0`. Version 8 is intentionally not selected because it requires Node `^24.15.0` on the Node 24 line. The committed lockfile, not this prose list, becomes the producing source for exact dependency versions after Step 1.

## 3. Data Store

### 3.1 Stored entities

The sole durable user-data store is `config/children.local.json`. It is a UTF-8, versioned `AppConfigV1` document with two top-level collections:

- `profiles`: zero or more `ChildProfileV1` records.
- `defaults`: worksheet-generation preferences that are not child attributes.

`config/children.example.json` is committed with clearly fictional profiles. The real file and its temporary siblings are ignored:

```gitignore
/config/children.local.json
/config/children.local.json.*
/extra-credit-profile-backup.json
/Extra Credit Worksheet*.pdf
/Extra Credit Worksheet*.png
/extra-credit-worksheet*.pdf
/extra-credit-worksheet*.png
```

Only the local Fastify server may read or write the real file. The HTTP API accepts no file path. The web bundle, source maps, tests, fixtures, URLs, logs, output filenames, and repository never contain the real profile document.

### 3.2 Child profile schema

Each profile has:

| Field | Contract |
|---|---|
| `id` | Lowercase, hyphenated universally unique identifier version 4 (UUID v4), for example `d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321`, generated with `crypto.randomUUID()`; immutable and unique within the file. |
| `displayName` | Optional nickname, 1–40 trimmed Unicode characters. A surname or legal name is neither requested nor needed. |
| `ageYears` | Integer from 4 through 18. V1 enables its bounded practice set for ages 4–8; ages 9–18 are retained for future profiles but show an unsupported-band notice. Age chooses initial suggestions only and never automatically advances difficulty. |
| `presentationBand` | Parent-confirmed `preschool` or `early-primary`; controls reviewed vocabulary and visual tone, never mathematical limits. `early-primary` covers the v1 ages-six-through-eight source envelope without asserting a school grade. For a retained age-9–18 profile it means the last parent-reviewed v1 band, not a developmental placement claim; generation remains disabled until a later supported band exists. |
| `reviewedOn` | ISO calendar date `YYYY-MM-DD`. The UI shows a non-blocking review reminder after nine months. |
| `mathSkills` | Explicit capability object: `countingMax`, `numeralMax`, `compareMax`, unique `representations` drawn from `quantities` and `equations`, parent-confirmed `understandsEquality`, supported `operations`, `operandMax`, `resultMax`, `allowRegrouping`, and `allowNegativeResults`. Stored maxima and permissions can outlive v1 as the children grow; the v1 generation envelope independently caps every rendered number, operand, and result at 20 and emits neither negative results nor carrying/borrowing. |
| `writingMode` | Exactly one of `draw-and-tell`, `label`, `copy-with-model`, `sentence-frame`, or `independent`. |
| `interests` | Zero to five parent-entered broad tags, each 1–32 characters; trimmed and deduplicated case-insensitively. |

The setup UI offers friendly presentation and math suggestions, then stores the parent's confirmed expanded capabilities so generator behavior has one source of truth. Initial suggestions are: age 4 → `preschool` plus quantities to 10; age 5 → parent chooses quantities to 10 or emerging equations within 5; ages 6–7 → `early-primary` plus equations within 10; age 8 → `early-primary` plus equations within 20. The named presets are `quantities-to-10`, `emerging-equations-within-5`, `early-primary-within-10`, `early-primary-within-20`, and `custom`; their complete mappings appear in Appendix 12.2. A birthday never changes a band or skill silently. The parent confirms or changes every suggestion and can update the profile when observed readiness changes.

The app does not request surname, exact birthdate, school, teacher, email, location, photo, voice, diagnosis, score history, or behavioral history in v1. Because nicknames and topic tags remain free text, their forms warn the parent not to enter those details. Unicode nicknames and tags do not imply multilingual instructional support.

Topic IDs are vocabulary-registry identifiers, not raw tags: unique lowercase ASCII kebab-case slugs. V1's complete reviewed topic enum is `animals`, `space`, `nature`, `sports`, `vehicles`, plus the internal fallback `neutral`. Case-folded exact raw-tag matches map to those IDs; everything else maps only to `neutral` and is not copied forward. Asset IDs are a separate lowercase kebab-case namespace such as `animals-cat` or `space-rocket`; each manifest entry declares one or more topic IDs. Expanding either enum is a content-affecting reviewed change.

### 3.3 Generation defaults

`defaults` stores these independent preferences:

- `useDisplayName`: boolean, default `true`.
- `useInterests`: boolean, default `true`.
- `includeDecorativeGraphics`: boolean, default `true`.
- `difficulty`: `confidence`, `practice`, or `stretch`; default `practice`.
- `length`: `short`, `standard`, or `long`; default `standard`.
- `includeAnswerKey`: boolean, default `true` for applicable worksheets.
- `paperSize`: `letter` or `a4`; default `letter`.
- `printScale`: `standard` or `large`; default `standard`.

The selected worksheet type and active profile are transient UI state, not persisted history.

The browser creates no second child-data store: no `localStorage`, `sessionStorage`, IndexedDB, Cache API, service-worker cache/registration, browser database, or client-side profile archive. Unsaved form and worksheet state lives only in React memory and disappears when the tab closes; nickname and interest inputs disable autocomplete. The server-controlled JSON file is the only durable user-data store.

### 3.4 Generated entities

Worksheets exist only in memory and are never archived automatically. Every generated `WorksheetDocumentV1` has:

- `schemaVersion: 1`.
- `worksheetType`: one of the four stable kebab-case type IDs.
- `generatorVersion`: positive integer owned by that worksheet generator.
- `seed`: exactly eight lowercase hexadecimal characters representing one nonzero unsigned 32-bit seed. Generation retries if cryptographic randomness returns `00000000`, avoiding the zero-lock state of the seeded PRNG.
- `worksheetId`: lowercase, hyphenated UUID v4 generated with `crypto.randomUUID()` for this in-memory generation session.
- Normalized, personalization-filtered request metadata.
- Ordered content items with IDs `item-001`, `item-002`, and so on.
- Answers embedded beside their source item in the in-memory model through a discriminated union: an objectively checkable item has `answerability: "objective"` and an `ObjectiveAnswerV1` whose nested `kind` is `number`, `choice`, or `comparison`; a subjective Sentence Builder drawing/writing item has `answerability: "open"` and `answer: null`. Drawing a requested numeric quantity in Count, Compare & Make remains objective with the target number as its answer. The answer-key renderer includes objective items only.

`GenerationRequestV1` is an allowlisted projection, not a copied profile:

| Field | Type and contract |
|---|---|
| `schemaVersion` | Literal `1`. |
| `worksheetType` | One of the four stable type IDs. |
| `generatorVersion` | Positive integer selected from the registered worksheet definition. |
| `seed` | Nonzero eight-lowercase-hex string. |
| `capabilities` | Exact effective object containing `presentationBand`, `writingMode`, and a normalized `mathSkills`: representation/equality/operation gates come from the profile, every positive numeric maximum is first clamped to 20 and then difficulty-adjusted, and `allowRegrouping`/`allowNegativeResults` are always `false` in v1. Stored future-range values never enter the request. |
| `options` | Exact object containing `difficulty`, effective `length`, `includeDecorativeGraphics`, `includeAnswerKey`, `paperSize`, and `printScale`. |
| `displayName` | Optional normalized nickname; property is absent unless name personalization is enabled. |
| `topicIds` | Optional unique array of known local topic IDs from the Section 3.2 enum; property is absent unless interest personalization is enabled and at least one reviewed ID matches. Vocabulary records and asset IDs are selected from those topic IDs later and never enter this field. |

Profile ID, age, review date, raw interest tags, and every disabled personalization value are absent. Unmatched free text is never interpolated into a prompt or worksheet.

The sole production profile-to-request boundary is `projectGenerationRequest` in `src/shared/worksheet/project-request.ts`. Before removing age, it calls the shared `getV1ProfileSupport` gate: ages 4–8 continue to capability projection, while ages 9–18 return `GENERATION_AGE_UNSUPPORTED` without constructing a request or invoking a generator. The strict config schema rejects ages outside 4–18. The registry and pure generators deliberately remain age-free and capability-driven; UI and direct-call tests exercise the gate so no caller may bypass the v1 age boundary accidentally.

Hidden controls still have one canonical normalized representation. Every Sentence Builder request has `difficulty: "practice"` and `includeAnswerKey: false`; `draw-and-tell` and `copy-with-model` additionally have `length: "standard"`. Stored defaults never leak a different hidden value into the request, content key, or deterministic equality comparison.

`WorksheetItemV1` is the following discriminated union; each strict payload contains only the listed educational primitives:

| `itemType` literal | Payload | Answer |
|---|---|---|
| `dry-math` | operation, left operand, right operand, rendered symbol | `{ kind: "number", value: integer }` |
| `wow-group` | `quantity` or `equation` mode, three quantity-card/equation-statement models, correct zero-based position | `{ kind: "choice", value: 0 | 1 | 2 }` |
| `sentence` | writing mode, curated prompt, mode-required curated word bank/model sentence/topic ID, required-response flags; a bank or model is absent only in modes whose Section 4.2 contract says it is absent | `null` |
| `count-compare` | match/compare/complete/draw activity plus bounded numeral, group, choices, or target models | `{ kind: "choice", value: 0 | 1 | 2 }`, `{ kind: "comparison", value: "less" | "equal" | "greater" }`, or `{ kind: "number", value: integer }`; complete/draw answers are the missing/requested count, not subjective art judgments |

Every item also has its document-scoped `item-NNN` ID and either `answerability: "objective"` with the typed answer or `answerability: "open"` with `answer: null`. `itemType` selects the activity payload; `answerability` selects whether a key entry exists; only `answer.kind` selects the objective answer representation. `WorksheetDocumentV1` contains exactly the version/type/seed/UUID metadata listed above, the normalized request, and an ordered readonly `items` array of that union.

The parent-facing answer key is rendered by filtering objective items from this already-generated document. It is never created by rerunning generation. The same normalized request, seed, and generator version must produce a byte-equivalent `items` array including embedded answers; lifecycle metadata such as the fresh worksheet UUID is excluded from that equality. Any content-affecting generator change increments that worksheet's `generatorVersion`. V1 does not promise to reproduce output from an older generator version unless that implementation remains registered. No hash of a nickname, interest, or complete request is placed in an ID.

Item IDs are unique within one worksheet document, not globally. DOM IDs prefix the document UUID, output surface, and item ID—`worksheet-{worksheetId}-{worksheet|answer}-{itemId}`—so worksheet and answer-key markup can coexist without collisions.

The browser `document.title` is always `Extra Credit Worksheet`, including personalized previews, so names/interests do not enter browser history, window titles, default Save-as-PDF names, URLs, or output filenames. The app itself writes no PDF/image file; browser-saved copies use a generic default name, belong outside the repository, and remain the parent's responsibility. The UI may show the nickname inside the worksheet header only when enabled.

### 3.5 Validation, duplication, and corruption protection

- Inspect the fixed target with `lstat` before opening it. A symlink or other non-regular target returns `CONFIG_UNSAFE_FILE`; a regular file whose size exceeds 65,536 bytes returns `CONFIG_TOO_LARGE`. Neither state is read, hashed, returned, backed up, or recoverable through the app; the UI gives manual move/permission guidance.
- For a regular file whose initial size is in range, open without following a replacement symlink where the platform supports no-follow flags and read the 65,536-byte payload limit plus a one-byte overflow probe. If the probe is present, classify `CONFIG_TOO_LARGE` without hashing or recovery; otherwise compute the full raw ETag, decode with `new TextDecoder("utf-8", { fatal: true })`, parse JSON, then validate the strict Zod schema. A fatal decode failure, malformed JSON, or schema-invalid bounded regular file returns `CONFIG_INVALID`, keeps that raw-byte ETag, and is eligible for explicit backup recovery; replacement-character decoding is forbidden and failures never return raw contents.
- Reject unknown fields, duplicate profile IDs, duplicate normalized interest tags, invalid capability combinations, and unsupported schema versions.
- Serialize normalized JSON with two-space indentation and a final newline.
- Measure the final serialized UTF-8 bytes before any replacement. If pretty-print normalization would exceed 65,536 bytes—even when the compact request body fit—return `CONFIG_SERIALIZED_TOO_LARGE` and leave the existing target unchanged.
- Every successfully read file has a strong HTTP entity tag (ETag) of `"sha256-<64 lowercase hex>"` over its raw bytes. Create requires `If-None-Match: *`; update requires the last-read `If-Match`. The store compares the precondition and replaces the file inside the same in-process save mutex, so two browser tabs cannot silently overwrite one another.
- Serialize concurrent saves and call `writeFileAtomic` with flushing enabled. This is a crash-resistant replacement, not a promise of power-loss durability on every filesystem; a failed replacement retains the prior valid file. Create files with owner-only `0600` mode on Portable Operating System Interface (POSIX)-style systems and reapply that mode after replacement on a best-effort basis; Windows relies on the current OS account's access-control list (ACL).
- Never automatically overwrite fatal-decode, malformed-JSON, schema-invalid, or future-version data. A fatal-decode/malformed/schema-invalid file may be replaced only through the explicit **Back up invalid file and replace** action with the raw-file ETag. Before replacement, copy at most the already-bounded 64 KiB to an exclusive sibling named `children.local.json.invalid-YYYYMMDDTHHMMSSZ-<8hex>.bak`, flush it, apply owner-only mode where supported, then replace the target. If backup creation fails, leave the target untouched. A future schema version is never eligible for this recovery action and requires a later migration or manual intervention.
- The repair screen may download only the parent's current unsaved valid form state, after a privacy warning, under the generic filename `extra-credit-profile-backup.json`; it never downloads the unreadable raw file automatically.
- Deleting a profile rewrites only the live `children.local.json`; it never silently deletes invalid-file `.bak` siblings, prior browser downloads, saved PDFs, or printed pages. Delete/recovery UI plus README/PRIVACY disclose those residual copies and give manual cleanup guidance for the repository `config/` directory and the parent's chosen download/PDF locations. Automatic backup discovery or deletion is outside v1.
- Tests inject temporary config paths; they are forbidden from touching `config/children.local.json`.
- Reusing a seed intentionally reproduces content. New seeds may repeat individual valid facts within the confirmed capability bounds, but each worksheet rejects duplicate items within its own page.

## 4. Learning and Worksheet Design

### 4.1 Product stance

Extra Credit is an activity-sheet generator for a parent, not an automated assessment or placement engine. Age supplies setup suggestions; explicit capabilities determine content. This follows Head Start's warning that developmental indicators are not curricula or checklists and the IES recommendation to build early mathematics on what a child knows ([Head Start ELOF](https://headstart.gov/interactive-head-start-early-learning-outcomes-framework-ages-birth-five), [IES early-math practice guide](https://ies.ed.gov/ncee/wwc/practiceguide/18)).

The UI labels results as practice. It offers no score, grade, diagnosis, adaptive promotion, or claim that completing a sheet demonstrates mastery. “Supported for ages 4–8” means a profile at each boundary can be created, validated, saved, selected for all capability-eligible generators, previewed, and printed on Letter/A4 through the declared acceptance path. It does not mean age determines grade, placement, curriculum, readiness, or mastery. Profiles ages 9–18 can be retained and edited as the children grow, but v1 disables their worksheet generation with an unsupported-band explanation. A later reviewed skill pack expands that gate. Personalization changes the header, vocabulary, topic, or decorative context; it never changes a validated learning target or answer.

### 4.2 V1 worksheet catalog

#### `dry-math` — Dry Math

- Numbers and symbols only: no interest vocabulary or instructional graphics.
- Available only when `representations` contains `equations` and at least one operation is enabled; it supports only those enabled operations.
- Respects operand/result constraints inside the v1 within-20 envelope and never emits a negative result or carrying/borrowing. Stored permission for those later skills does not widen v1 output.
- Name personalization may affect only the header.
- Every item is recomputed locally and paired with exactly one answer-key entry.
- If a profile has no supported symbolic operation, the UI explains why this activity is unavailable and suggests Count, Compare & Make.

#### `find-the-wow` — Math — Two Whats and a Wow

- Each group contains exactly three distinct statements in randomized positions: exactly one true “wow” and two false “whats.”
- Equation mode is available only when `representations` contains `equations`, `understandsEquality` is true, and at least one operation is enabled. Determining whether addition and subtraction equations are true or false is a Grade 1 expectation ([Common Core Grade 1 Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/1/OA/)).
- Otherwise, quantity mode is available when `representations` contains `quantities`. All three choices repeat the same target numeral beside different dot/shape groups: exactly one group matches that numeral (the wow), while two use distinct bounded nonzero count offsets (the whats). The child circles the matching pair; the answer is its zero-based position. With `L = min(countingMax, numeralMax, 20)`, the generator requires `L >= 3` and enumerates `L × choose(L-1, 2)` unique target-plus-unordered-distractor sets before seeded ordering; this exact capacity must cover the page budget. Every displayed pair is recomputed after construction. This reflects kindergarten numeral/quantity correspondence ([Common Core Kindergarten Counting and Cardinality](https://www.thecorestandards.org/Math/Content/K/CC/)). These are instructional visuals and remain when decorative graphics are off. If neither capability gate passes, the worksheet is unavailable with an explanation.
- False statements use bounded, nonzero answer offsets and are re-evaluated after construction. No duplicate or ambiguous choices are allowed.
- The correct positions are page-balanced: the most-used and least-used of the three positions differ by at most one.

#### `sentence-builder` — Sentence Builder

- `draw-and-tell`: a large drawing area plus a prompt for the child to tell an adult about the picture.
- `label`: a required large child-drawing area, a curated unique word bank of 4/6/8 entries for short/standard/long, and room to label parts of that drawing. Decorative art, when enabled, stays outside this instructional response area.
- `copy-with-model`: one curated model sentence with clear copy lines; tracing-font production is out of scope for v1.
- `sentence-frame`: a validated sentence frame, a curated unique word bank of 4/6/8 entries for short/standard/long, and writing lines.
- `independent`: a topic, always-present curated idea word bank that the child may ignore, drawing area, and open writing lines. Length deterministically controls that bank's 6/8/10 entries.
- Every Sentence Builder document contains exactly one open `sentence` item. For `draw-and-tell`, candidate capacity is the count of eligible distinct prompts; for `copy-with-model`, it is the count of eligible distinct prompt/model-sentence pairs; either mode requires capacity of at least one, has no word bank, and normalizes hidden `length` to `standard`. For `label`, `sentence-frame`, and `independent`, the generator likewise requires at least one eligible prompt/frame and separately proves that the chosen topic/fallback vocabulary pool can supply the mode's exact bank width without duplicates. All Sentence Builder modes normalize hidden `difficulty` to `practice` and hidden `includeAnswerKey` to `false`.
- Drawing, dictating, and writing are all legitimate kindergarten response forms ([Common Core Kindergarten Writing](https://www.thecorestandards.org/ELA-Literacy/W/K/)); a four-year-old is never forced into independent full-sentence writing.
- Interest tags select from reviewed local vocabulary. Unknown tags fall back to neutral vocabulary. A nickname may appear in the title or instruction but is not required inside a sentence.
- With decorative graphics on, the generator chooses a tagged monochrome SVG for a reserved header/side panel. With graphics off or no licensed match, that same-size decorative panel becomes an optional doodle box. The prompt, word bank, item count, required response, and writing objective do not change because decoration changed; `draw-and-tell`, `label`, and any other drawing mode retain a separate required response area.

#### `count-compare-make` — Count, Compare & Make

- Available only when `representations` contains `quantities`; numeric maxima do not independently authorize a representation. Otherwise the UI shows the capability-specific unavailable state.
- Supports numeral-to-quantity matching, comparing two groups, completing a group, and drawing a requested quantity. Numeral/make items use at most `min(countingMax, numeralMax, 20)`; comparison items use at most `min(countingMax, compareMax, 20)`.
- The fixed subtype mix is match/compare/complete/draw = `2/2/1/1` for short, `2/2/2/2` for standard, and `3/3/2/2` for long; a seeded shuffle interleaves them. A match item shows one numeral and three distinct group choices with one exact match, answered by position. A compare item shows two groups and asks which has fewer, the same, or more through words/visual selection rather than an equation. A complete item shows a target and a partial group and asks the child to draw the missing count. A draw item shows a target numeral and asks for that many marks. The parent key records the choice, relation, missing count, or target count respectively.
- For a normalized subtype limit `L`, pre-shuffle candidate capacities are: match `L` distinct target numerals when `L >= 3` and zero otherwise (each receives two distinct in-range distractors and a deterministic order), compare `L²` ordered group pairs, complete `L(L-1)/2` target/partial pairs for targets 2 through `L`, and draw `L` targets. The activity fails with `GENERATION_CONSTRAINT_CONFLICT` if any subtype capacity is below its allocated count; it does not silently substitute another subtype.
- Provides an age-four-friendly path that does not require symbolic arithmetic.
- Caps rendered quantities at 20 in v1 even when a profile records a higher capability; later visual representations require their own feature plan.
- Dots, ten-frames, shapes, and writing guides are instructional visuals, not decoration, so the decorative-graphics toggle never removes them.
- All quantities and comparisons are computed from the same item model used by the answer key; all four subtypes are objectively checkable even when the child's response is a drawing.

### 4.3 Controls

The primary generator screen exposes only the selected profile, worksheet type, and the three requested personalization controls: nickname, interests, and decorative graphics. “More options” contains difficulty, length, answer key, paper size, and print scale. Controls appear only when they affect the selected worksheet; interest personalization never changes Dry Math. For Sentence Builder, difficulty and answer key are hidden and normalize to `practice`/`false`; length is hidden and normalizes to `standard` for `draw-and-tell` and `copy-with-model`, while the three bank modes expose length because it selects their exact bank width.

Before applying difficulty, `projectGenerationRequest` clones the profile capabilities into an effective request shape: every positive stored numeric maximum is clamped to the v1 source envelope of 20, `allowRegrouping` and `allowNegativeResults` are set to `false`, and only then is the selected difficulty applied to the maxima relevant to the chosen activity. Stored values above 20 and true future permissions remain only in the profile and never enter `GenerationRequestV1`; the UI shows the stored value beside the v1 effective bound whenever they differ. V1 arithmetic is always nonnegative and carrying/borrowing-free.

Difficulty is parent-selected and never adaptive:

- `confidence`: replaces each applicable positive numeric capability maximum with `max(1, floor(maximum × 0.75))` and favors the worksheet's more scaffolded representation.
- `practice`: uses the v1-clamped effective capability values unchanged.
- `stretch`: previews every applicable positive v1-clamped base maximum beside its proposed effective value, then requires a one-generation parent confirmation before applying `min(20, maximum + max(1, ceil(maximum × 0.25)))`. Confirmation is not persisted. Zero/inapplicable sentinels remain zero. Stretch never adds a new representation or operation, asserts equality readiness, enables regrouping, enables negative results, changes writing mode, or bypasses the v1 source envelope.

If every activity-relevant positive base maximum is already 20, stretch is disabled with “Already at the V1 maximum”; it requires no confirmation and a stored stretch default normalizes to `difficulty: "practice"` for that generation. Thus every enabled difficulty choice changes at least one effective value.

Length has a fixed one-page budget per worksheet:

| Worksheet | Short | Standard | Long |
|---|---:|---:|---:|
| Dry Math | 8 items | 12 items | 18 items |
| Two Whats and a Wow | 4 groups | 6 groups | 8 groups |
| Sentence Builder (`label`/`sentence-frame`; `independent`) | 4; 6 unique bank entries | 6; 8 unique bank entries | 8; 10 unique bank entries |
| Count, Compare & Make | 6 items | 8 items | 10 items |

Sentence Builder always has one prompt; its length setting changes word-bank breadth and response space rather than adding prompts. Its `draw-and-tell` and `copy-with-model` modes have no bank and canonical hidden `length: "standard"`. Large print may reduce an item/bank-bearing activity to the next shorter effective budget to preserve the one-page contract; in the two no-bank writing modes it changes response geometry without changing canonical length. The preview states the effective item or bank count before generation.

Before generation, each worksheet computes its required work units and the number of distinct valid candidates under the normalized constraints. Math activities compare candidate capacity with their fixed item/subtype budgets. Sentence Builder requires one eligible prompt/model record and, for bank modes, an independently sufficient unique-word pool at the exact 4/6/8 or 6/8/10 width defined above. If any required capacity is insufficient, generation fails closed with `GENERATION_CONSTRAINT_CONFLICT`; it never silently widens limits, repeats an item/word, changes the requested length, or partially fills a page. The UI explains which capability or length choice conflicts. “Make another” calls an injected seed source at most 16 times, rejecting zero/current seeds and accepting the first document with a different content key. The content key is the canonical JSON string of `items` with array order preserved and object keys recursively sorted; it includes embedded answers and excludes UUID/request lifecycle metadata, is kept only in memory, and is never logged. Production uses browser cryptographic randomness; tests inject a fixed seed sequence. If no attempt differs, the control is disabled with an explanation instead of looping.

### 4.4 Graphics and asset policy

All v1 art is bundled, project-original, high-contrast, black-and-white Scalable Vector Graphics (SVG) line art with stable lowercase kebab-case IDs such as `space-rocket`. Each manifest entry records creator, source, review date, topic tags, any AI-assistance note, and exact license provenance: an original uses `origin: "original"`, `license: "MIT"`, and `licenseFile: "LICENSE"`; a future approved third-party entry uses `origin: "third-party"` plus its creator, source, license, required notice, and separate license reference and is never relicensed. Programmatic or human-authored art is preferred. AI may assist asset creation during development, but every result is reviewed, committed, and covered by the root MIT license before runtime. Franchise characters, celebrity likenesses, trademark-dependent prompts, imitation of a living artist's style, remote image URLs, and live image generation are excluded.

The graphics toggle controls decoration only. Learning-essential quantities, geometry, counters, guides, and diagrams remain visible. Every decorative image has an empty alt attribute; every instructional visual has a text alternative in accessible HTML.

### 4.5 Print and accessibility contract

- Parent controls disappear under `@media print`; only the chosen worksheet or answer key prints.
- Letter and A4 use dedicated same-origin print stylesheets, physical units, safe margins, and one predictable page per sheet.
- Groups use `break-inside: avoid`; no required background fills, color meaning, web fonts, external fonts, or rasterized text.
- Standard instructional text starts at 16 pt; large print starts at 18 pt with fewer items and larger response areas ([Library of Congress large-print guidance](https://www.loc.gov/nls/services-and-resources/informational-publications/large-print-materials/)).
- Preview markup uses headings, lists, tables only when tabular, meaningful labels, keyboard-operable controls, strong black-on-white contrast, and clear focus states. Web Content Accessibility Guidelines (WCAG) 2.2 level AA is the implementation target for the parent user interface (UI) ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)).
- Every page declares `lang="en-US"`. Automated axe scans use WCAG 2.2 A/AA tags and must report zero violations on named setup, generator, preview, recovery, and error fixtures. Keyboard-only flow, visible focus, 200% text resize, and 320 CSS-pixel reflow receive explicit browser assertions. These checks are a scoped implementation target, not an accessibility certification.
- Print fixtures cover every structurally distinct renderer: Dry Math; quantity and equation Wow; all five Sentence Builder modes; all four Count/Compare item subtypes; decoration on/off; and worksheet/key surfaces. Each renderer runs at its effective maximum length across Letter/A4 and standard/large scale, including the exact wide-Unicode boundary nickname `"界".repeat(40)` plus the longest curated prompt and word-bank entries.
- V1's validated physical-print path is current Chromium-based Edge and Chrome on the primary Windows 11 environment, with Ubuntu 24.04 Chromium as the automated PDF/layout substrate. The app still runs on macOS/Linux and may use browser Print there, but those physical outputs are best-effort until separately accepted. A dedicated tagged-PDF exporter is deferred until it can preserve document language, reading order, and text alternatives.

### 4.6 Playful extensions and roadmap

Printable practice should not become the whole learning experience. NAEYC and the American Academy of Pediatrics emphasize play and active learning alongside structured work ([NAEYC curriculum guidance](https://www.naeyc.org/resources/position-statements/dap/planning-curriculum), [AAP Power of Play](https://www.healthychildren.org/English/family-life/power-of-play/Pages/the-power-of-play-how-fun-and-games-help-children-thrive.aspx)). The first post-v1 pack is Mini Mission: a short off-page movement, sorting, measuring, sound, or observation task with a small record box. Patterns, shapes, measurement, rhyme, letter sounds, story sequencing, and observe-predict-draw science follow as separate feature plans.

Runtime AI is a v2-or-later parent toggle, absent from the v1 UI. Its future feature plan must keep local generation as the default and fallback, keep names on-device, send only explicitly selected broad interest tags, validate structured output, recompute mathematics locally, preview everything before print, and receive a fresh privacy/security review.

## 5. Modules

### `frontend/src/shared/`

- `config/schema.ts`: strict `AppConfigV1` and `ChildProfileV1` Zod schemas, inferred types, limits, and error mapping.
- `config/math-presets.ts`: parent-friendly preset definitions expanded into the one canonical `mathSkills` shape.
- `config/normalize.ts`: whitespace, interest-tag, ordering, and duplicate normalization shared by form and server.
- `config/profile-support.ts`: the single ages-4–8 supported / ages-9–18 retained-but-disabled decision, shared by setup and request projection.
- `runtime/ports.ts`: the fixed observatory reservations `4310` and `4311`, imported by the server, Vite config, and tests.
- `worksheet/types.ts`: the allowlisted `GenerationRequestV1`, `WorksheetDocumentV1`, discriminated open/objective item and answer unions, option, and capability contracts.
- `worksheet/project-request.ts`: the only production ChildProfile-to-GenerationRequest projector; applies `profile-support.ts` before discarding age and all non-allowlisted fields.
- `worksheet/seeded-random.ts`: xorshift32 with unsigned normalization after each full transition (`x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0`) and unbiased bounded selection by rejecting values at or above `floor(2^32 / n) * n`; production generators never use `Math.random()`. Seed `00000001` must yield `00042021`, `04080601`, `9dcca8c5`, `1255994f`, `8ef917d1`, then `2c6f5bd0`.
- `worksheet/registry.ts`: stable worksheet IDs, display metadata, supported capabilities, and generator registration.
- `worksheet/invariants.ts`: shared uniqueness, answer-key completeness, bounds, and personalization-leak checks.

`src/shared` has no DOM or Node globals. Separate TypeScript configuration enforces that boundary.

### `frontend/src/server/`

- `app.ts`: constructs Fastify with injected config path, fixed production defaults, strict Ajv options, routes, static production root, and test-friendly lifecycle. Tests may inject port `0`; the production entry point cannot accept a port override.
- `index.ts`: validates environment, resolves repository-relative paths from `import.meta.url`, binds only `127.0.0.1`, and reports startup errors without sensitive paths.
- `security.ts`: allowed Host and Origin checks, Fetch Metadata checks, in-memory 256-bit session token, headers, redaction, and stable security errors.
- `transport-schemas.ts`: transform-free Draft 7 route schemas; Fastify Ajv runs with `coerceTypes: false`, `useDefaults: false`, and `removeAdditional: false`, after which authoritative strict Zod `safeParse` performs normalization and cross-field validation. Parity tests prove both layers reject unknown fields.
- `config-store.ts`: size-limited fatal UTF-8 reads, symlink rejection, ETag/precondition checks inside the save mutex, Zod validation, serialized atomic writes, explicit invalid-file backup/recovery, and config error classification.
- `routes/health.ts`, `routes/session.ts`, and `routes/config.ts`: the four API routes in Section 6.

### `frontend/src/web/`

- `index.html`, `main.tsx`, and `App.tsx`: Vite entry and the parent-facing setup/generate/preview flow.
- `api/client.ts`: same-origin typed client, session-token refresh for reads, and explicit non-replay behavior for stale pre-restart mutation tokens.
- `profiles/ProfileEditor.tsx`: create, edit, validate, delete, review-reminder, stale-tab conflict, and explicit invalid-file recovery UI.
- `profiles/MathSkillsEditor.tsx`: preset-first math capability editor with advanced fields.
- `generator/create-session.ts`: uses browser cryptographic randomness to create the UUID v4 and nonzero eight-hex seed before calling platform-neutral generators.
- `generator/GeneratorControls.tsx`: profile, activity, personalization, difficulty, length, answer-key, paper, and print-size controls.
- `preview/WorksheetPreview.tsx`: accessible screen preview and invariant-error boundary.
- `worksheets/registry.ts` and `registry.test.ts`: typed web-only worksheet-ID-to-React-renderer map whose keys must exactly match the shared generator registry.
- `worksheets/{dry-math,find-the-wow,sentence-builder,count-compare-make}/Renderer.tsx`: React-only worksheet renderers that consume immutable domain documents and never invent or recompute answers.
- `print/PrintView.tsx`, `print/AnswerKeyView.tsx`, `print/print-letter.css`, and `print/print-a4.css`: printable worksheet and parent-key surfaces.
- `styles/screen.css` and `styles/tokens.css`: parent UI and shared monochrome design tokens; no utility CSS framework.

### `frontend/src/worksheets/`

Each worksheet directory owns platform-neutral `definition.ts`, `generator.ts`, and focused tests; Sentence Builder also owns its curated `vocabulary.ts`. The four directories are `dry-math/`, `find-the-wow/`, `sentence-builder/`, and `count-compare-make/`. Generators return domain documents; their React renderers live only under `src/web/worksheets/`.

### `frontend/src/web/assets/line-art/`

Contains committed monochrome SVGs, the dependency-free provenance source `manifest.json`, and its typed runtime wrapper `manifest.ts`. All selections go through exact allowlisted topic tags; missing matches use the documented neutral fallback.

### `frontend/tests/`

- `integration/`: real Fastify injection plus temporary-file tests, including security, malformed data, concurrent saves, and built-app smoke coverage.
- `e2e/`: Playwright profile-to-print flows, print-media/PDF geometry assertions, personalization removal, and network request allow-listing.
- `e2e/server-harness.mjs`: imports compiled `dist/server/app.js`, calls `buildApp` with an injected temporary config path and direct-only `securityMode: "ephemeral-test"`, then initially listens on `{ host: "127.0.0.1", port: 0 }`. It reports the resolved URL and owns close/cleanup. Its process-side controller retains that internally allocated port and may close/rebind Fastify on the same authority with the same temporary config but a fresh token for the explicit restart test, preserving browser origin and in-memory form state; that control is never an HTTP route. It never launches production `dist/server/index.js`, never accepts an external caller-selected authority, and exposes no production path/port environment override.
- `fixtures/`: synthetic profiles and deterministic seeds only.

## 6. API Route Contract

All application programming interface (API) routes are JSON under the loopback server. No cross-origin resource sharing (CORS) plugin is installed, request or response bodies are never logged, and every API success or error sends `Cache-Control: no-store`. The production entry point constructs a fixed security policy allowing only authority/origin `127.0.0.1:4310`; development additionally allows browser origin `http://127.0.0.1:4311` while the API authority remains `127.0.0.1:4310`. Vite proxies `/api` to 4310 with `changeOrigin: true` while preserving the browser `Origin` for validation.

`buildApp` also accepts direct option `securityMode: "ephemeral-test"` only for in-repository E2E/manual harnesses; `index.ts` never selects it and no environment variable maps to it. In that mode, each real request derives expected authority as exactly `127.0.0.1:${request.raw.socket.localPort}`. `Host` must equal that authority, and every present Origin—and every mutation Origin—must equal `http://${authority}`. No wildcard loopback port, `localhost`, caller-selected URL, or forwarded-host value is accepted. Fastify injection tests use the fixed policy; the port-zero contract is exercised through a real listener. Integration tests prove a different loopback port is rejected and the production/development fixed policy is unchanged.

| Method and route | Request | Success response | Route-specific failure contract |
|---|---|---|---|
| `GET /api/health` | No body or token | `200 { "status": "ok", "version": "package version" }` after startup checks pass | No routed readiness state: a failed startup check exits before listening. |
| `GET /api/session` | No body | `200 { "token": "base64url 256-bit token" }` | None beyond the cross-cutting security failures below. |
| `GET /api/config` | `X-Extra-Credit-Token` | `200 { "config": AppConfigV1 }` plus strong raw-byte `ETag` | `401 SESSION_TOKEN_INVALID`; `404 CONFIG_NOT_FOUND`; `409 CONFIG_INVALID` plus ETag for a bounded regular file; `409 CONFIG_VERSION_UNSUPPORTED` plus ETag; `409 CONFIG_TOO_LARGE` without ETag; `409 CONFIG_UNSAFE_FILE` without ETag; `503 CONFIG_IO_ERROR`. Raw invalid contents are never returned. |
| `PUT /api/config` | `Content-Type: application/json`, token, complete `AppConfigV1`, and either `If-None-Match: *` for create or last-read `If-Match` for update | `200 { "config": AppConfigV1 }` plus the replacement ETag | `400 INVALID_JSON`; `401 SESSION_TOKEN_INVALID`; `409 CONFIG_CONFLICT`; `409 CONFIG_RECOVERY_NOT_ALLOWED`; `409 CONFIG_VERSION_UNSUPPORTED` plus the existing raw-byte ETag; `409 CONFIG_TOO_LARGE`; `409 CONFIG_UNSAFE_FILE`; `413 BODY_TOO_LARGE`; `413 CONFIG_SERIALIZED_TOO_LARGE`; `415 CONTENT_TYPE_REQUIRED`; `422 VALIDATION_FAILED`; `428 CONFIG_PRECONDITION_REQUIRED`; `503 CONFIG_IO_ERROR`. |

All routes can also return `403 HOST_REJECTED`, `403 ORIGIN_REJECTED`, or `403 CROSS_SITE_REJECTED` before route logic. `PUT /api/config` may include `X-Extra-Credit-Recovery: backup-and-replace` only when the existing target is a bounded regular fatal-decode/malformed-JSON/schema-invalid file and the request supplies its exact `If-Match`; the server performs the Section 3.5 byte-identical backup before replacement. The header cannot recover a future schema version, oversized file, symlink, or other non-regular target.

Every non-success response uses:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe parent-facing explanation",
    "fieldErrors": {}
  }
}
```

`fieldErrors` is present only for validation failures and maps dotted schema paths to message arrays. Responses never reveal absolute paths, raw OS errors, profile values, raw invalid file contents, or security tokens.

Server invariants:

- Hard-code host `127.0.0.1`; there is no LAN-bind option.
- Use the dev-observatory reservations `4310` for API/production and `4311` for the development UI. Both are registered to `extra-credit` with no collision as of 2026-08-22. Production exposes no port or host override. If either fixed port is occupied, startup exits nonzero and the operator inspects/stops the conflicting process or updates the observatory reservation and project plan together.
- Reject unexpected Host headers before routing, require exact allowed Origin on mutation, reject `Sec-Fetch-Site: cross-site`, and use a 65,536-byte body limit with 10-second request and connection timeouts. Fixed production/development policy and direct-only `ephemeral-test` policy are the only variants; no environment variable or request header can add an origin.
- Generate a 32-byte random token on each server start. It is never persisted, placed in a URL, or logged. After restart, the web client may fetch a fresh token for reads but must ask the parent to press Save again rather than automatically replaying a mutation.
- Configure Fastify's transport validator with `coerceTypes: false`, `useDefaults: false`, and `removeAdditional: false`; transport schemas contain no transforms. Run authoritative strict Zod parsing and cross-field validation after transport validation. Unknown fields fail at both boundaries instead of being removed.
- Apply a same-origin Content Security Policy (CSP), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, and `Referrer-Policy: no-referrer`. HTTP Strict Transport Security (HSTS) and `upgrade-insecure-requests` stay disabled because the app intentionally uses loopback HTTP.
- Serve only `frontend/dist/web`, with dotfiles and directory listings disabled. Vite has `host: "127.0.0.1"`, `port: 4311`, `strictPort: true`, `server.fs.strict: true`, an allowlist limited to `frontend/`, and an explicit deny for `config/**`; Step 1 launches Vite and proves `/@fs/.../config/children.example.json` is rejected, exercising the boundary without requiring or touching a real local profile.

For `GET /api/session`, a missing `Origin` is accepted only when Fetch Metadata is absent or same-origin; a present `Origin` must match an allowed origin. `PUT /api/config` always requires the exact allowed `Origin`. ETag preconditions are compared inside the same save mutex used for replacement. The token, origin, and precondition checks protect against hostile websites, restart replay, and stale browser tabs.

Loopback is a host boundary, not an OS-account boundary. While the server is listening, any process under any local OS user that can connect to `127.0.0.1:4310` can forge browser headers, obtain a session token, and read or replace the config through the API even if filesystem ACLs would block direct access. V1 knowingly accepts that limitation under P7: use it only on a trusted machine/session, never forward the ports, and stop the development or production process after printing—especially on shared or untrusted computers. True per-account confidentiality would require a bootstrap secret or app authentication and therefore a future explicit revision of P7. The server also does not coordinate writers in separate processes; the fixed production port prevents a second normal instance.

## 7. Project Structure

```text
extra-credit/
├── .claude/
│   ├── hooks/lib/task-state-derive.ps1 # project-local handoff rollup helper
│   └── references/task-state-schema.md # handoff state contract
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml          # structured report with child-data warning
│   │   └── config.yml              # blank-issue and security-link policy
│   └── workflows/
│       └── ci.yml                   # locked install and full quality gates
├── config/
│   ├── children.example.json       # tracked fictional profiles and defaults
│   └── children.local.json         # ignored real profiles; created by setup UI
├── documentation/
│   ├── educational-basis.md        # sourced design rationale and limits
│   ├── extra-credit-proposal.html  # confirmed operator decision review surface
│   └── testing-print.md             # repeatable physical-print protocol
├── frontend/                        # the repository's single npm package
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   ├── eslint.config.js
│   ├── tsconfig.shared.json
│   ├── tsconfig.web.json
│   ├── tsconfig.server.json
│   ├── tsconfig.server.build.json
│   ├── src/
│   │   ├── server/                 # loopback API and production static server
│   │   ├── shared/                 # platform-neutral schemas and worksheet domain
│   │   ├── web/                    # React parent UI and print views
│   │   │   └── worksheets/         # React renderers for the four domain generators
│   │   └── worksheets/             # four independent generator definitions
│   ├── tests/
│   │   ├── integration/
│   │   ├── e2e/                     # includes server-harness.mjs
│   │   └── fixtures/
│   └── dist/                       # ignored build output
├── .gitignore
├── .node-version                   # 24.14.0
├── ASSET_PROVENANCE.md             # original/third-party source and license ledger
├── CLAUDE.md                       # project commands, architecture, and state
├── CONTRIBUTING.md
├── LICENSE                         # MIT for all project-original repository work
├── PRIVACY.md
├── README.md
├── SECURITY.md
└── plan.md                         # this canonical implementation plan
```

## 8. Key Design Decisions

### Local code, local data

The repository is public, but v1 is not publicly hosted. The parent runs the app locally and the server reads a fixed gitignored file. This supports set-once profiles without putting child data into browser build artifacts, cloud storage, or a third party.

### Loopback address and observatory-owned ports are separate concerns

`127.0.0.1` is the privacy-preserving interface restriction; `4310` and `4311` are the collision-managed numeric ports. The dev-observatory registered both numbers to `extra-credit` with no collision on 2026-08-22 while Vite's common `5173` was already allocated. They are fixed in v1 and declared in CLAUDE.md so future collision scans see them.

### One nested npm package

The app uses a single npm dependency graph and lockfile under `frontend/`, avoiding workspace/versioning overhead. Browser, server, shared, and worksheet modules remain separated by directory and TypeScript configuration. React is never imported by server or shared modules.

### Deterministic educational core

Every mathematical answer and worksheet invariant is computed by pure local code. The seed and generator version make bugs reproducible; the answer key derives from the exact generated items. Runtime AI adds no value to correctness in v1 and would introduce keys, cost, latency, content review, and privacy risk.

### Skills outrank age

Age provides initial suggestions only. Explicit math capabilities and writing mode control content because children develop along different paths. Profile review is parent-driven and never a silent birthday-triggered difficulty change.

### Instructional visuals are not decoration

The graphics toggle removes optional embellishment, not dots, shapes, ten-frames, writing guides, or diagrams required by the activity. This preserves the learning target and avoids making the toggle an accidental difficulty control.

### HTML is the print source of truth

Semantic HTML and print CSS drive both preview and paper output. A PDF component library would create a second layout system and a server-side browser would add operations solely for export. Browser Print and Save as PDF meet v1 needs; a tagged-PDF exporter is a later accessibility project.

### No performance history

The tool stores profiles and defaults, not scores, completed worksheets, or inferred ability. This keeps the privacy model small and prevents a practice-sheet generator from drifting into unvalidated assessment.

### No background execution

V1 has no scheduler, worker queue, daemon, polling loop, auto-generation, or unattended file watcher outside the explicit development server watcher. Profile saves and worksheet generation occur only in direct response to a parent action. The save mutex orders simultaneous requests within the one local process; it is not a background-job subsystem.

### Parent-facing online surface

Setup and generation are labeled for grown-ups; children interact with paper. FTC guidance distinguishes information submitted by adults from information collected online from children, but the project does not claim legal compliance. Child-facing online use, analytics, advertising, accounts, or cloud sync requires a fresh privacy/legal review ([FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)).

### No premature AI abstraction

V1 documents the v2+ constraints but does not ship a disabled toggle, provider interface, API route, or dormant credential field. The runtime-AI toggle starts with a separate feature plan when there is a concrete provider and safety contract.

## 9. Open Questions and Risks

There are no unresolved implementation choices from the planning interview. The remaining items are risks with fixed mitigations:

| Item | Risk | V1 mitigation |
|---|---|---|
| Browser print variation | Margins, headers, scaling, and fonts can vary by browser and printer. | Support current Edge/Chrome, test Letter and A4 under Playwright print media, provide a 100% scale/header-footer tip, then run physical-print step M1. |
| Developmental fit | A sheet can be technically valid but too easy, too hard, or inappropriate for a child's writing stage. | Capability-based profiles, explicit writing-mode variants, parent preview, no assessment claims, and family pilot M2. |
| Stale profiles | A growing child may outgrow saved settings. | Display `reviewedOn` and a nine-month reminder; never auto-advance difficulty. |
| Plaintext local data | Filesystem ACLs protect the JSON only from direct reads; while the app is running, any local process/user able to reach loopback can use the API because v1 has no account-level secret. | Request nicknames and minimal fields, disclose the running-server boundary in README/PRIVACY, bind only loopback, forbid port forwarding, tell parents to stop the server on shared/untrusted machines, and offer profile deletion. Per-account authentication/encryption requires revisiting P7. |
| File corruption or interrupted save | Hand edits or an interrupted write could make profiles unreadable. | Full-schema validation, fixed-size read, symlink rejection, serialized crash-resistant replacement, explicit backup-before-recovery, preserve future versions, and retain unsaved form state. |
| Stale browser tab | One open editor could overwrite a newer save from another tab. | Strong ETags, required create/update preconditions, comparison inside the save mutex, and a conflict UI that reloads before retry. |
| Hostile browser page | Another site may try to reach a loopback API. | Strict Host/Origin/Fetch Metadata checks, no CORS, in-memory mutation token, content-type/body limits, CSP, and adversarial integration tests. |
| Incorrect math or answer key | A false invariant could create misleading homework. | Pure generators, local recomputation, property tests, exactly-one-wow assertions, answer-key completeness, fail-closed printing, deterministic seeds, and finite-capacity checks. |
| Unmapped interests | A custom interest may have no reviewed vocabulary or art. | Map only exact normalized allowlisted tags, fall back to neutral curated content, and never interpolate unmatched free text into a worksheet, code, path, URL, or prompt. |
| Asset rights | Public distribution can accidentally include unlicensed or imitation artwork. | Project-original MIT assets, provenance manifest, contributor rules, review gate, and no remote/runtime art. |
| Future AI privacy | A later provider could receive names or silently degrade correctness. | Separate v2+ plan, explicit opt-in toggle, no names sent, broad tags only, structured validation, local math verification, parent preview, and deterministic fallback. |
| Supporting ages 9+ | The first templates may become too narrow after the v1 age-eight boundary. | Retain ages 9–18 without generation, then add sourced skill packs through the stable worksheet registry and versioned generators rather than age-specific forks. |

## 10. How to Run

### Requirements

- Windows 11, macOS, or Linux capable of running Node.js `>=24.0 <25` and npm `>=11 <12`; `.node-version` pins the verified 24.14.0 baseline.
- Current Chromium-based Microsoft Edge or Google Chrome for the supported v1 print path.
- No Docker, database, account, API key, or cloud service. The application needs no internet connection after dependencies are installed; dependency installation and the explicit `security` maintenance command contact the npm registry.
- GitHub CLI authentication is needed only for the maintainer's post-push M3 check, not to install, generate, or print.

### First local run

From the completed clone's repository root (the npm commands are identical in PowerShell, Bash, and zsh):

```shell
npm --prefix frontend install
npm exec --prefix frontend -- playwright install chromium
npm --prefix frontend run dev
```

Open `http://127.0.0.1:4311`. On first run, the setup screen creates `../config/children.local.json` after the parent saves a valid profile. Stop both development processes with `Ctrl+C` in the launching console.

### Production-style local run

```shell
npm --prefix frontend run build
npm --prefix frontend start
```

Open `http://127.0.0.1:4310`. If that fixed port is occupied, the server exits nonzero. On Windows, inspect the live owner with `$extraCreditConnection = Get-NetTCPConnection -LocalPort 4310 -State Listen; Get-Process -Id $extraCreditConnection.OwningProcess` (substitute `4311` when inspecting Vite); on macOS/Linux use `lsof -nP -iTCP:4310 -sTCP:LISTEN` (or `4311`). Stop only the process you identify and own, then retry. Workspace maintainers may separately verify the reservation from this repository with `uv run --project ..\dev-observatory observatory ports` when that sibling project exists; public standalone clones do not require dev-observatory. The application never changes its host or silently chooses a port.

### Quality commands

```shell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
npm --prefix frontend run check
npm --prefix frontend run security
```

`test:e2e` and `check` use the direct-only `ephemeral-test` harness with a temporary injected config path and exact authority derived from its real loopback socket; they never read or write the real family profile file. CI uses `runs-on: ubuntu-24.04`, `actions/setup-node@v4` with `node-version-file: .node-version`, `defaults.run.working-directory: frontend`, `npm ci`, `npx playwright install --with-deps chromium`, then `npm run check`. The validated print-layout substrates are the primary Windows 11 operator machine (automated DOM/PDF geometry plus M1 Edge/Chrome) and pinned Ubuntu CI (the same DOM/PDF geometry gates). Pixel comparisons are intentionally omitted because a Windows-authored baseline would not be an authoritative Ubuntu raster fixture before the first push. macOS/Linux remain supported for development/runtime, but non-Windows physical printing is best-effort until a dedicated acceptance fixture is added.

### Planned package scripts

| Script | Exact behavior |
|---|---|
| `dev` | Run `dev:web` and `dev:server` together with fail-fast process cleanup. |
| `dev:web` | Start Vite on `127.0.0.1:4311` with strict port and `/api` proxy to 4310. |
| `dev:server` | Run `tsx watch src/server/index.ts` on `127.0.0.1:4310`. |
| `build` | Clean `dist` once with `rimraf`, typecheck all three targets, run Vite with repository-resolved absolute root `frontend/src/web`, repository-resolved absolute outDir `frontend/dist/web` (computed from `vite.config.ts` via `fileURLToPath`/`path.resolve`), and `emptyOutDir: false`, then compile TypeScript with `rootDir: src` and `outDir: dist` so entries are `dist/server/app.js` and `dist/server/index.js`. |
| `start` | Run compiled `dist/server/index.js`; no `vite preview` production shortcut. |
| `lint` | Run `eslint . --max-warnings 0`. |
| `typecheck` | Run the shared, web, and server `tsc --noEmit` projects. |
| `test` | Run all Vitest unit, component, and Fastify integration tests once. |
| `test:e2e` | Build, have `tests/e2e/server-harness.mjs` import `dist/server/app.js`, inject a temporary config plus loopback port `0`, and run Playwright against the reported URL. |
| `manual:print` | Launch the already-built app through `tests/manual/print-harness.mjs` using direct-only `securityMode: "ephemeral-test"` at a reported exact loopback URL with only the committed fictional acceptance profiles; stop with `Ctrl+C`. |
| `check` | Run lint, typecheck, unit/integration tests, and `test:e2e`; the latter performs the single clean production build used by browser tests. |
| `release:verify` | Use `scripts/release-clean-room.mjs` to copy current tracked and untracked-but-not-ignored working-tree files into a temporary clean room, excluding `.git`, `node_modules`, `dist`, real config/backups, and recovery downloads by git-ignore policy; run the copied `scripts/audit-release.mjs` against that whole export before dependency installation; then run `npm ci`, install Chromium, and run `check` there before removing the temporary copy. Any audit/install/browser/check failure preserves the failure exit code while cleanup still runs. |
| `security` | With npm-registry access, run `npm audit --audit-level=high`; advisory changes require review rather than automatic lockfile mutation. |

## 11. Development Process

`extra-credit/` is now an independent Git repository nested inside the broader `dev` checkout and published publicly at `https://github.com/aberson/extra-credit`. Repository initialization completed on 2026-08-22; the remaining planning-to-build transition follows this exact order:

1. **Completed 2026-08-22:** copied the verified workspace standards `C:\Users\abero\dev\.claude\hooks\lib\task-state-derive.ps1` and `C:\Users\abero\dev\.claude\references\task-state-schema.md` byte-for-byte to the matching project-local paths shown in Section 7. The pre-created root `.gitignore` and canonical root MIT `LICENSE` were verified before the first Git add; the ignore file covers the profile/export patterns in Section 3.1 plus `/frontend/node_modules/`, `/frontend/dist/`, `/frontend/test-results/`, `/frontend/playwright-report/`, `/frontend/coverage/`, `/.plan-expedite-state`, `/.plan-expedite-state.*`, and `/.claude/task-state/`. The helper, schema, and license are tracked; generated task state and expedite resume state remain local-only.
2. **Completed 2026-08-22:** ran `/repo-init` in `C:\Users\abero\dev\extra-credit`, confirmed public visibility, repository name `extra-credit`, and owner `aberson`, then initialized and pushed the nested repository with its README and one issue per automated step.
3. **Completed 2026-08-22:** mapped automated Steps 1–13 to issues #1–#13, M1 to #10, and M2/M3 to #13; verified no blank `**Issue:** #` field remains; and committed the mapping.
4. **Next:** run `/plan-expedite --plan plan.md` from this repository. Its fresh review/wrap will see populated issue fields; `/repo-sync` reconciles issue bodies; `task-handoff --next-task` can load the tracked project-local helper and write only ignored task state; and `/.plan-expedite-state*` remains ignored throughout.
5. Only after plan-expedite returns success may `/build-phase --plan plan.md` begin. Do not substitute `/repo-sync` alone for either required stage.

Implementation then uses `/build-phase`, which dispatches each automated step through `/build-step` in an isolated git worktree. Profile-file security receives deep review; visible full-stack slices receive code plus live-browser review; code and documentation slices receive independent code review. Each step runs the complete quality suite available at that point before it may be marked done. The package intentionally remains under `frontend/`: the build producer detects that nested `package.json` and installs there in every worktree.

### Automated Steps

These run unattended through `/build-phase`.

### Step 1: Runnable application foundation

- **Problem:** Bootstrap the runnable Extra Credit application on its observatory-approved loopback ports.
- **Type:** code
- **Status:** PENDING
- **Issue:** #1
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/scripts/dev-preflight.ts`, `frontend/src/shared/runtime/ports.ts`, `frontend/src/shared/api/health.ts`, `frontend/src/server/app.ts`, `frontend/src/server/startup.ts`, `frontend/src/server/dev.ts`, `frontend/src/server/index.ts`, `frontend/src/server/routes/health.ts`, `frontend/src/web/index.html`, `frontend/src/web/main.tsx`, `frontend/src/web/App.tsx`, `frontend/tests/e2e/server-harness.mjs`, `frontend/tests/e2e/foundation.spec.ts`, `frontend/tests/integration/app-bootstrap.test.ts`, `frontend/tests/integration/ci-contract.test.ts`, `frontend/tsconfig.shared.json`, `frontend/tsconfig.web.json`, `frontend/tsconfig.server.json`, `frontend/tsconfig.server.build.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/playwright.config.ts`, `frontend/eslint.config.js`, `.github/workflows/ci.yml`, `.node-version`, `.gitignore`, `README.md`, `CLAUDE.md`
- **Produces:** Installable one-package scaffold, exact scripts/build coordinates from Section 10, guarded fixed observatory authorities, private bootstrap context for the test-only ephemeral-port harness, fail-loud production static startup, Fastify health route, React shell with bounded startup recovery, quickstart, parse-tested CI contract, and initial unit/browser gates.
- **Done when:** From the repository root, a clean `npm --prefix frontend install`, `npm exec --prefix frontend -- playwright install chromium`, and `npm --prefix frontend run check` succeed; `frontend/package.json` declares `type: "module"` and `license: "MIT"`; shared/server configs use NodeNext while the web config uses ESNext/Bundler resolution; development listeners are exactly `127.0.0.1:4310` and `127.0.0.1:4311`; independent literal assertions pin those coordinates, the API verifies its actual bound socket, and Vite rejects resolved host/port/strict-port overrides with a stable safe error code; the browser shell reaches the real health route through the Vite proxy and recovers from a bounded transient API-startup failure; the real `.mjs` E2E harness dynamically imports emitted `frontend/dist/server/app.js`, starts it on an internally allocated ephemeral loopback port, retains its resolved temporary config path and `ephemeral-test` mode in a frozen private bootstrap context without exposing either in health/log output, reaches the compiled health route, closes cleanly, and proves both fixed ports are released; production startup requires `frontend/dist/web/index.html` and fails before listening with a safe category when it is absent; a direct Vite `/@fs/` request for the fictional `config/children.example.json` is rejected, Vite's complete installed default secret-deny patterns remain present, and representative `.npmrc`, `.yarnrc.yml`, `.key`, and `.p12` requests return `403`; compiled output contains `frontend/dist/web/index.html`, `frontend/dist/server/app.js`, and `frontend/dist/server/index.js`; and occupying either fixed development port makes startup exit nonzero rather than selecting another. The README reproduces the exact install/dev/build/start coordinates, states the local-only/public-code boundary, and warns that the unauthenticated running loopback API is reachable by other local processes/users; README and CLAUDE current-state prose must not direct contributors back to completed planning preparation. `ci-contract.test.ts` parses `.github/workflows/ci.yml` and asserts top-level `permissions: contents: read`, unfiltered push and pull-request triggers, `actions/checkout@v4` with `persist-credentials: false` before `actions/setup-node@v4`, Ubuntu 24.04, `.node-version`, `frontend` as the default working directory, lockfile install, Chromium installation, `npm run check`, and no self-referential path filter; live execution remains M3 after the first push.
- **Depends on:** none

### Step 2: Secure profile config round trip

- **Problem:** Make one validated child-profile configuration round-trip through the loopback API without exposing an arbitrary filesystem path.
- **Type:** code
- **Status:** PENDING
- **Issue:** #2
- **Flags:** --reviewers deep --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/shared/config/schema.ts`, `frontend/src/shared/config/math-presets.ts`, `frontend/src/shared/config/normalize.ts`, `frontend/src/shared/config/profile-support.ts`, `frontend/src/shared/config/profile-support.test.ts`, `frontend/src/server/app.ts`, `frontend/src/server/security.ts`, `frontend/src/server/transport-schemas.ts`, `frontend/src/server/config-store.ts`, `frontend/src/server/routes/session.ts`, `frontend/src/server/routes/config.ts`, `config/children.example.json`, `.gitignore`, `frontend/tests/e2e/server-harness.mjs`, `frontend/tests/integration/config-api.test.ts`, `frontend/tests/integration/config-store.test.ts`, `frontend/tests/integration/security.test.ts`, `frontend/tests/integration/schema-parity.test.ts`, `PRIVACY.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/config.yml`
- **Produces:** Versioned strict schema, exact math presets, fictional config, fixed-path atomic store, strong ETags, preconditioned saves, invalid-file backup recovery, four-route API, loopback/browser security controls, adversarial route/file tests, privacy/recovery disclosures, vulnerability path, and child-data-safe issue guidance.
- **Done when:** A real injected Fastify instance creates, reads, and updates a valid temporary config with the documented ETags; table-driven Ajv/Zod parity fixtures accept ages 4, 5, 6, 7, 8, 9, and 18 while rejecting ages 3 and 19, and direct `getV1ProfileSupport` tests return supported only for 4–8 and `GENERATION_AGE_UNSUPPORTED` for 9–18; stale/missing preconditions, malformed JSON, unknown fields at both validation layers—including an `avoidTopics` property, for which no released-v1 migration exists—bounded invalid data, oversized files, symlinks/non-regular targets, duplicate profiles, cross-site/wrong-host/wrong-origin requests, stale pre-restart tokens, simultaneous saves, and I/O failures return their exact safe contracts and leave the prior target unchanged; a real port-zero listener accepts only its exact reported Host/Origin pair and rejects the same loopback host with another port; a bounded regular raw-byte fixture containing malformed UTF-8 returns `CONFIG_INVALID` with its raw-byte ETag, exposes no replacement-decoded text, and is backed up byte-for-byte before explicit recovery; a compact body whose final pretty-printed UTF-8 form crosses 65,536 bytes returns `CONFIG_SERIALIZED_TOO_LARGE` without creating/replacing a target, while the exact-limit form round-trips; only bounded regular fatal-decode/malformed/schema-invalid recovery creates a byte-identical exclusive backup before replacement; future-version recovery/update returns `CONFIG_VERSION_UNSUPPORTED`, preserves the raw-byte ETag and target, while oversized/unsafe recovery is rejected without an ETag or truncated backup; an injected mode adapter receives `0600` while native POSIX runs assert owner-only mode and Windows asserts best-effort mode handling never blocks a valid save; and every API response carries `Cache-Control: no-store` without exposing raw values or paths. README/PRIVACY/SECURITY state the stopped-file ACL boundary, running-API local-process/user exposure, loopback/no-cloud behavior, no-port-forwarding and stop-after-use guidance, recovery semantics, residual backup/download/PDF/print copies after profile deletion, save-outside-the-repository guidance, non-collection claims, and private vulnerability path; the parseable issue forms warn against posting child data, profiles, named sheets, or secrets and disable unsafe blank issues.
- **Depends on:** Step 1

### Step 3: Parent profile setup flow

- **Problem:** Let a parent manage reusable child profiles through the browser setup flow.
- **Type:** code
- **Status:** PENDING
- **Issue:** #3
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/web/api/client.ts`, `frontend/src/web/profiles/ProfileList.tsx`, `frontend/src/web/profiles/ProfileEditor.tsx`, `frontend/src/web/profiles/MathSkillsEditor.tsx`, `frontend/src/web/profiles/RecoveryPanel.tsx`, `frontend/src/web/profiles/ProfileEditor.test.tsx`, `frontend/src/web/App.tsx`, `frontend/tests/e2e/server-harness.mjs`, `frontend/tests/e2e/fixtures/app-server.ts`, `frontend/tests/e2e/profile-flow.spec.ts`
- **Produces:** First-run setup, profile list/editor, exact preset-first math controls, presentation/writing controls, ages-4–8 supported-band and ages-9–18 retained/unsupported states, free-text privacy warnings, review reminder, delete confirmation, stale-tab conflict UI, missing/invalid-file recovery UI, and preserved unsaved state on write failure.
- **Done when:** Playwright creates the three canonical fictional profiles—age-four preschool/emergent, age-six early-primary, and age-eight early-primary/independent—reloads them from the temporary JSON file, edits one without changing its UUID, creates and deletes a fourth disposable fictional profile, and shows a conflict instead of overwriting after a second tab saves. Delete confirmation states that recovery backups, downloads, saved PDFs, and paper copies are not erased; an integration fixture proves profile deletion rewrites the live file without silently deleting an existing sibling backup. A table-driven setup check proves the exact age suggestions for 4, 5, 6, 7, and 8—including the unselected two-choice age-five state and the distinct age-seven/age-eight numeric bounds—then accepts and retains age 9 with the unsupported-generation state; the form rejects ages 3 and 19 and never infers grade or changes a confirmed capability preset from age. For restart coverage, the process-side fixture preserves the same temporary config, closes Fastify, rebinds a fresh instance/token to the same internally allocated ephemeral port, and leaves the browser on that unchanged origin without exposing an HTTP restart route; the UI retains its unsaved in-memory form, rejects the stale token, performs no automatic mutation, fetches a fresh token, and saves only after the parent presses Save again. The flow also requires confirmation before backup-and-replace recovery, offers only the generic unsaved-form download after its warning, verifies nickname/tag inputs use `autocomplete="off"`, and asserts after create/edit/reload that localStorage, sessionStorage, IndexedDB, Cache API, and service-worker registrations contain no app-created state. The real file path and profile values never enter URLs, logs, document titles, or automatic downloads.
- **Depends on:** Step 2

### Step 4: Dry Math vertical slice

- **Problem:** Ship the first complete Dry Math worksheet from profile selection through paper output.
- **Type:** code
- **Status:** PENDING
- **Issue:** #4
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/shared/worksheet/types.ts`, `frontend/src/shared/worksheet/seeded-random.ts`, `frontend/src/shared/worksheet/registry.ts`, `frontend/src/shared/worksheet/invariants.ts`, `frontend/src/shared/worksheet/project-request.ts`, `frontend/src/shared/worksheet/project-request.test.ts`, `frontend/src/worksheets/dry-math/definition.ts`, `frontend/src/worksheets/dry-math/generator.ts`, `frontend/src/web/worksheets/registry.ts`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/web/worksheets/dry-math/Renderer.tsx`, `frontend/src/web/App.tsx`, `frontend/src/web/generator/create-session.ts`, `frontend/src/web/generator/GeneratorControls.tsx`, `frontend/src/web/preview/WorksheetPreview.tsx`, `frontend/src/web/print/PrintView.tsx`, `frontend/src/web/print/AnswerKeyView.tsx`, `frontend/src/worksheets/dry-math/generator.test.ts`, `frontend/tests/e2e/dry-math.spec.ts`
- **Produces:** Exact seeded PRNG and vectors, allowlisted generation request, discriminated answer model, worksheet registry through its first caller, finite-capacity check, Dry Math constraints, preview/key/print surfaces, bounded “Make another,” and unavailable-state guidance.
- **Done when:** Unit tests match all six xorshift32 vectors and unbiased bounded-selection edge cases; direct projector tests accept the age-four and age-eight boundaries but return `GENERATION_AGE_UNSUPPORTED` for ages 9–18 before constructing an age-free request or calling an injected generator, and the production UI mirrors that gate; the UI allows Dry Math only for an equation-capable supported profile; the typed web renderer registry reaches Dry Math through `WorksheetPreview` and its key set exactly equals the shared generator registry; every generated symbols-only item is unique, nonnegative, carrying/borrowing-free, and inside both effective profile limits and the v1 within-20 envelope—even when a custom stored profile uses maxima of 1,000 and enables both future permission flags; objective answers recompute and key by item ID; disabled personalization values never enter the request/document or worksheet/answer-key output DOM; insufficient candidate capacity returns `GENERATION_CONSTRAINT_CONFLICT`; same request/seed/version reproduces content; and at most 16 injected candidate seeds are tried before “Make another” changes content or disables itself.
- **Depends on:** Step 3

### Step 5: Two Whats and a Wow vertical slice

- **Problem:** Generate a deterministic Math — Two Whats and a Wow sheet with exactly one valid statement per group.
- **Type:** code
- **Status:** PENDING
- **Issue:** #5
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/worksheets/find-the-wow/definition.ts`, `frontend/src/worksheets/find-the-wow/generator.ts`, `frontend/src/web/worksheets/find-the-wow/Renderer.tsx`, `frontend/src/worksheets/find-the-wow/generator.test.ts`, `frontend/src/shared/worksheet/registry.ts`, `frontend/src/web/worksheets/registry.ts`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/web/generator/GeneratorControls.tsx`, `frontend/tests/e2e/find-the-wow.spec.ts`
- **Produces:** Capability-gated equation and quantity variants, balanced true positions, bounded false construction, accessible selection instructions, and exact parent key.
- **Done when:** Property tests over fixed seed ranges prove every group has three distinct statements with exactly one true result, no result violates effective limits, position counts differ by at most one, impossible budgets fail closed, equation mode requires equation representation plus confirmed equality understanding, quantity mode requires quantity representation, and an extreme stored profile with maxima 1,000 plus both future permissions still yields equation-Wow statements whose operands/results are within 20, nonnegative, and carrying/borrowing-free. The shared/web registries remain in exact ID parity, and Playwright reaches both registered renderer variants plus the unavailable state through the real UI.
- **Depends on:** Step 4

### Step 6: Sentence Builder vertical slice

- **Problem:** Generate a capability- and writing-mode-aligned Sentence Builder sheet from the profile's confirmed settings.
- **Type:** code
- **Status:** PENDING
- **Issue:** #6
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/worksheets/sentence-builder/definition.ts`, `frontend/src/worksheets/sentence-builder/generator.ts`, `frontend/src/web/worksheets/sentence-builder/Renderer.tsx`, `frontend/src/worksheets/sentence-builder/vocabulary.ts`, `frontend/src/shared/worksheet/registry.ts`, `frontend/src/web/worksheets/registry.ts`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/worksheets/sentence-builder/generator.test.ts`, `frontend/tests/e2e/sentence-builder.spec.ts`
- **Produces:** Five writing-mode variants, reviewed local vocabulary/topic allowlist, exact interest selection, neutral fallback, stable response panel, and mode-appropriate preview/print layout without decorative art.
- **Done when:** Each writing mode—including `copy-with-model`—renders its specified response surface through the registered web renderer; shared/web registry IDs remain in exact parity; bank-bearing modes produce exactly their effective unique 4/6/8 entries (`label`/`sentence-frame`) or 6/8/10 entries (`independent`), while no-bank modes require one eligible prompt/model and normalize hidden options to `difficulty: practice`, `length: standard`, and `includeAnswerKey: false`; injected prompt, model, or bank shortages fail before partial output with `GENERATION_CONSTRAINT_CONFLICT`; exact known interests select reviewed topics, while unknown raw tags never appear in requests or worksheet text and produce neutral content; graphics-independent prompts and response requirements are stable; and every open writing/drawing item has `answer: null` and is absent from the answer key.
- **Depends on:** Step 4

### Step 7: Reviewed decorative line-art system

- **Problem:** Add optional black-and-white decoration without changing required child work or introducing unclear asset rights.
- **Type:** code
- **Status:** PENDING
- **Issue:** #7
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/web/assets/line-art/manifest.json`, `frontend/src/web/assets/line-art/manifest.ts`, `frontend/src/web/assets/line-art/manifest.test.ts`, `frontend/src/web/assets/line-art/neutral-star.svg`, `frontend/src/web/assets/line-art/animals-cat.svg`, `frontend/src/web/assets/line-art/space-rocket.svg`, `frontend/src/web/assets/line-art/nature-tree.svg`, `frontend/src/web/assets/line-art/sports-ball.svg`, `frontend/src/web/assets/line-art/vehicles-car.svg`, `frontend/src/web/preview/DecorativeGraphic.tsx`, `frontend/src/web/worksheets/sentence-builder/Renderer.tsx`, `frontend/tests/e2e/graphics.spec.ts`, `ASSET_PROVENANCE.md`, `CONTRIBUTING.md`, `LICENSE`
- **Produces:** Reviewed monochrome SVG pack, dependency-free machine-readable provenance manifest plus typed runtime wrapper, deterministic selection, human provenance ledger, contributor/asset rules, empty-alt rendering, and same-size graphics-off/missing-match fallback.
- **Done when:** `manifest.json` is the single machine-readable asset source with unique repository-relative POSIX `path` keys and exact asset ID, topics, creator, source, review date, AI-assistance note, origin, license, and license-file fields; `manifest.ts` validates/imports that same JSON for runtime selection, and tests prove it and `ASSET_PROVENANCE.md` contain the same rows. Every original asset points to the root MIT license with the exact original provenance fields and passes SVG safety checks; schema/tests require complete upstream terms for any future third-party row; CONTRIBUTING states that every project-original contribution uses the root MIT license and requires complete provenance/upstream terms without relicensing for any future third-party material; only allowlisted topic IDs select art; remote URLs and executable SVG content are rejected; toggling graphics or forcing a missing match changes only decoration while prompt, word bank, item count, required response, and response-panel dimensions remain equal; and decorative images expose empty alt text. TypeScript/TSX worksheet definitions and renderers are project code covered globally by the root MIT license and do not require per-file asset rows.
- **Depends on:** Step 6

### Step 8: Count, Compare & Make vertical slice

- **Problem:** Generate an age-four-friendly Count, Compare & Make sheet without requiring symbolic arithmetic.
- **Type:** code
- **Status:** PENDING
- **Issue:** #8
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/worksheets/count-compare-make/definition.ts`, `frontend/src/worksheets/count-compare-make/generator.ts`, `frontend/src/web/worksheets/count-compare-make/Renderer.tsx`, `frontend/src/worksheets/count-compare-make/generator.test.ts`, `frontend/src/shared/worksheet/registry.ts`, `frontend/src/web/worksheets/registry.ts`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/web/preview/InstructionalVisual.tsx`, `frontend/tests/e2e/count-compare-make.spec.ts`, `documentation/educational-basis.md`
- **Produces:** Quantity matching, group comparison, group completion, draw-a-quantity items, instructional visuals, derived answers, and the complete sourced educational-scope document for the four-family catalog.
- **Done when:** The activity is unavailable without `quantities`; when available, the exact subtype allocations and formulas in Section 4.2 hold; numeral/make quantities stay within `min(countingMax, numeralMax, 20)` and comparisons within `min(countingMax, compareMax, 20)`; insufficient capacity fails before filling; match/compare/complete/draw answers recompute respectively as choice/relation/missing-count/target-count; shared/web registry IDs remain in exact parity; and disabling decorative graphics leaves every learning-essential visual and required response intact. `documentation/educational-basis.md` maps each family and writing mode to the Section 12.5 primary sources, states the ages-4–8/within-20/nonnegative/no-regrouping envelope and non-curriculum/non-assessment limits, and makes no fluency, intervention, placement, or mastery claim.
- **Depends on:** Step 4

### Step 9: Personalization and worksheet options

- **Problem:** Apply the approved worksheet-option contract consistently through the generator UI.
- **Type:** code
- **Status:** PENDING
- **Issue:** #9
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/web/generator/GeneratorControls.tsx`, `frontend/src/shared/config/schema.ts`, `frontend/src/worksheets/dry-math/definition.ts`, `frontend/src/worksheets/find-the-wow/definition.ts`, `frontend/src/worksheets/sentence-builder/definition.ts`, `frontend/src/worksheets/count-compare-make/definition.ts`, `frontend/src/web/preview/WorksheetPreview.tsx`, `frontend/src/web/print/PrintView.tsx`, `frontend/src/web/print/AnswerKeyView.tsx`, `frontend/tests/e2e/options.spec.ts`
- **Produces:** Simple primary controls, contextual advanced controls, deterministic option normalization, personalization removal, and stored defaults separate from profiles.
- **Done when:** Applicable controls change only their documented output and inapplicable controls are absent; hidden Sentence Builder options enter normalized requests only at their documented canonical values, so stored defaults cannot silently change an identical visible writing-mode request; toggling nickname/interests off removes their raw values before request construction and from preview/print DOM; custom tags map only to exact known IDs; confidence/practice/stretch never adds a representation, equality readiness, operation, or other boolean capability; direct projector assertions prove the exact effective request contains only within-20 numeric maxima and forces both future permissions false; a stored maximum above 20 and either future permission flag are shown but cannot widen v1 generation; stretch shows the v1-clamped base-to-effective values, never exceeds 20, and requires non-persisted confirmation only when at least one activity-relevant value changes; an all-20 case is disabled/labeled and normalizes a stored stretch default to practice without confirmation; the effective budget is shown before generation; and saved defaults reload without mutating a child profile.
- **Depends on:** Steps 5, 7, and 8

### Step 10: Print and pagination hardening

- **Problem:** Make every worksheet and answer key fit its selected paper and print-scale contract in the supported browsers.
- **Type:** code
- **Status:** PENDING
- **Issue:** #10
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/web/print/PrintView.tsx`, `frontend/src/web/print/AnswerKeyView.tsx`, `frontend/src/web/print/print-letter.css`, `frontend/src/web/print/print-a4.css`, `frontend/src/web/styles/tokens.css`, `frontend/tests/e2e/print.spec.ts`, `frontend/tests/fixtures/print/`, `frontend/tests/manual/print-harness.mjs`, `frontend/tests/integration/ci-contract.test.ts`, `documentation/testing-print.md`, `frontend/package.json`
- **Produces:** Letter/A4 physical-unit styles, standard/large modes, worksheet/key print selection, cross-platform DOM/PDF geometry fixtures, PDF page-count inspection, overflow checks, document-scoped IDs, and physical-print instructions.
- **Done when:** For every structurally distinct renderer × Letter/A4 × standard/large fixture at effective maximum length—with decoration both ways and the boundary nickname/prompt/bank data—the primary Windows run uses `page.pdf({ preferCSSPageSize: true })`, `pdf-lib` reports exactly one worksheet page and one key page when applicable, and bounding-box assertions find no clipping or split group. The test suite contains no operating-system skip for DOM, PDF page-count, or geometry checks and requires no committed pixel baseline; the extended `ci-contract.test.ts` proves the Step 1 workflow still invokes that same mandatory suite, while M3 supplies the first actual Ubuntu execution after push. Worksheet/key coexist with no duplicate DOM ID, required visuals remain visible, and parent controls do not enter print output. The manual harness starts the compiled app through `securityMode: "ephemeral-test"` against only the three canonical fictional acceptance profiles and prints its exact ephemeral loopback URL.
- **Depends on:** Step 9

### Step 11: Parent UI accessibility hardening

- **Problem:** Make setup, generation, preview, recovery, and error flows usable through the declared browser-accessibility contract.
- **Type:** code
- **Status:** PENDING
- **Issue:** #11
- **Flags:** --reviewers full --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/src/web/index.html`, `frontend/src/web/App.tsx`, `frontend/src/web/profiles/ProfileEditor.tsx`, `frontend/src/web/profiles/MathSkillsEditor.tsx`, `frontend/src/web/generator/GeneratorControls.tsx`, `frontend/src/web/preview/WorksheetPreview.tsx`, `frontend/src/web/styles/screen.css`, `frontend/tests/e2e/accessibility.spec.ts`
- **Produces:** `en-US` language metadata, semantic structure, labeled/status/error relationships, keyboard flow, visible focus, zoom/reflow behavior, and scoped axe WCAG 2.2 A/AA gate.
- **Done when:** Named setup, generator, preview, invalid-file recovery, stale-conflict, unavailable, and invariant-error fixtures have zero axe violations under `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, and `wcag22aa`; a keyboard-only Playwright flow completes create-to-preview with visible focus; 200% text resize preserves content/actions; a 320 CSS-pixel viewport has no two-dimensional page scroll; and `html[lang]` is exactly `en-US`.
- **Depends on:** Step 10

### Step 12: Real-pipeline release smoke

- **Problem:** Prove the built application completes one real profile-to-print cycle across all four worksheet generators without mocks or external requests.
- **Type:** code
- **Status:** PENDING
- **Issue:** #12
- **Flags:** --reviewers deep --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/tests/fixtures/profiles.ts`, `frontend/tests/e2e/server-harness.mjs`, `frontend/tests/e2e/release-smoke.spec.ts`, `frontend/playwright.config.ts`
- **Produces:** Sub-60-second black-box gate using the compiled server, real routes, temporary JSON, real registry, three canonical fictional acceptance fixtures, all worksheet variants, real print DOM, and network/privacy assertions.
- **Done when:** One Playwright project creates the age-four preschool/emergent, age-six early-primary, and age-eight early-primary/independent fixtures through the API-backed UI; exercises Count/Compare, all five Sentence Builder modes, Dry Math, quantity Wow, equation Wow, and the symbolic-unavailable state; specifically drives the age-eight fixture through all four capability-eligible worksheet families, both Wow variants, within-20 math, independent writing, every applicable answer key, preview, and print media; temporarily creates an age-nine profile and proves every v1 generator remains disabled while the profile is retained; observes no browser/server error or non-loopback request; proves the compiled Fastify static root rejects dotfiles, directory listing, encoded traversal, and any `config/**` path; keeps `document.title`, URLs, suggested output filenames, and logs generic even when preview content is personalized; verifies the browser persistence surfaces named in Section 3.3 remain empty/unregistered; finishes under 60 seconds in CI mode; and leaves the real local config untouched.
- **Depends on:** Step 11

### Step 13: Public open-source release surface

- **Problem:** Prove the current working tree is a privacy-safe, license-complete, reproducible public release candidate through one clean-room gate.
- **Type:** code
- **Status:** PENDING
- **Issue:** #13
- **Flags:** --reviewers deep --isolation worktree --ui --start-cmd "npm --prefix frontend run dev" --url http://127.0.0.1:4311 --ready-url http://127.0.0.1:4310/api/health
- **Start-cmd:** `npm --prefix frontend run dev`
- **URL:** `http://127.0.0.1:4311`
- **Files:** `frontend/scripts/audit-release.mjs`, `frontend/scripts/release-clean-room.mjs`, `frontend/tests/integration/release-audit.test.ts`, `frontend/package.json`
- **Produces:** One `release:verify` entry point that exports the working tree, audits its public/privacy/license contract, performs a locked clean-room install, and reruns the complete quality/browser suite without pushing.
- **Done when:** `npm --prefix frontend run release:verify` exports the current Step 13 working tree—not merely HEAD—to a clean room, runs the release audit over that export, and passes its locked install/browser/check cycle using only fictional examples. The export manifest proves `.git`, dependencies/build output, `config/children.local.json*`, recovery backups/downloads, `.env*`, and local orchestration state are absent. `audit-release.mjs` walks that export and (1) recognizes complete serialized profile records by their required structural fields, permits them only in `config/children.example.json`, `frontend/tests/fixtures/**`, and the Appendix 12.1 JSON block in `plan.md`, and requires every such record to match one of the three canonical fictional fixture UUIDs/fields; (2) rejects tested private-key/token/key-assignment signatures and, under production `frontend/src/**` only, browser persistence writes/registrations such as `localStorage.setItem`, `sessionStorage.setItem`, `indexedDB.open`, `caches.open`/write methods, and `serviceWorker.register`, while allowing read-only persistence probes under `frontend/tests/**`; (3) rejects every exported `.pdf`, `.png`, `.jpg`, `.jpeg`, or `.webp` document/image artifact because v1 commits only reviewed SVG line art and no raster/PDF fixture; (4) rejects non-loopback runtime `fetch`/XHR/WebSocket/remote asset targets outside the documented source-link allowlist; (5) reads dependency-free `frontend/src/web/assets/line-art/manifest.json` and requires a unique matching row for every file under `frontend/src/web/assets/line-art/**/*.svg` and every future non-code file under `frontend/src/web/assets/templates/**`, with every project-original row declaring `origin: "original"`, `license: "MIT"`, and `licenseFile: "LICENSE"`; TypeScript/TSX code and worksheet renderers are covered globally and are not per-file asset rows; and (6) requires the canonical root MIT `LICENSE`, `frontend/package.json` license `MIT`, README/CONTRIBUTING statements that the root license covers all project-original code, worksheet templates, documentation, and line art, no second project license, and complete upstream terms for every future third-party row without relicensing it. `release-audit.test.ts` synthesizes every forbidden payload only inside temporary fixture trees at test runtime, keeps those complete signatures/records out of committed test source, proves the real exported test file itself passes the audit, and then proves nonzero results for one violation of every privacy/security class plus a personalized PDF/raster artifact, a missing root license, an unmanifested audited asset, an original row with a non-MIT or missing provenance field, and an incomplete third-party row. The audit also requires the previously owned docs to state every v1 boundary/fixed port and verifies the parse-tested CI workflow still carries its Step 1/10 contract. Live GitHub execution remains manual Step M3 because no push occurs inside this build step.
- **Depends on:** Step 12

### Manual Steps

These run after `/build-phase` completes. The operator drives them and records non-sensitive observations without adding code artifacts.

Run them in this order: M1 physical print, then M2 family pilot. A failed manual acceptance returns to its owning automated step; reopen and rerun that step plus its complete transitive downstream dependency closure through Step 13—including `release:verify`—before repeating the affected manual check and any earlier manual check whose accepted substrate changed. When M1 and M2 pass against that refreshed evidence, run `/repo-update` to commit and push the completed phase, then run M3 against that exact pushed commit. An M3 failure returns to the owning step (normally Step 13), followed by the same downstream rerun, another `/repo-update`, and M3; it is never waived by changing or deleting the gate.

### Step M1: Physical print acceptance

- **Source step:** Step 10
- **Type:** operator
- **Issue:** #10
- **Commands:**

```shell
npm --prefix frontend run build
npm --prefix frontend run manual:print
```

- **What to look for:**

| Check | Expected outcome |
|---|---|
| Use only the harness's three canonical fictional profiles: age-four quantity/label, age-six equation/equality/sentence-frame, and age-eight within-20/independent | Together they unlock all four worksheet families, both Wow variants, younger/scaffolded/independent writing layouts, and the upper v1 age boundary without reading or changing the real profile file. |
| Across current Edge and Chrome, print every worksheet family at least once; cover both US Letter and A4 in each browser at 100% scale | Every page fits once, with no clipped border, browser control, accidental blank page, or split problem group. |
| Include at least one physical quantity-Wow page and one equation-Wow page across that matrix | Both the graphics-heavy quantity cards and equation-heavy statement groups retain clear spacing and circle targets. |
| Across the matrix, use the age-eight fixture to print all four eligible worksheet families, including both Wow variants | The independent idea bank/writing area, quantity visuals, relation targets, and upper-bound within-20 numeric layouts remain clear, capability-bounded, and within one page. |
| Inspect black-and-white output | Text and instructional visuals remain crisp and distinguishable without color or background graphics. |
| Compare standard and large print | Large mode visibly increases type and response space while reducing content enough to retain one-page boundaries. |
| Print an answer key separately | No child work area is mixed into the parent key, and every key entry matches the corresponding worksheet item ID and recomputed value. |
| Turn personalization off before printing | The nickname and interests are absent from the physical page, not merely hidden on screen. |

Stop the server with `Ctrl+C` after the checks. Record printer model, both browser versions, paper settings, pass/fail, and any layout observation in the M1 issue without attaching named worksheets.

### Step M2: Short family usability pilot

- **Source step:** Step 13
- **Type:** operator
- **Issue:** #13
- **Commands:**

```shell
npm --prefix frontend run build
npm --prefix frontend start
```

- **What to look for:**

| Check | Expected outcome |
|---|---|
| With each child, use the confirmed writing mode; use Count/Compare and quantity Wow only when `quantities` is present; use Dry Math only with equations/operation; use equation Wow only with equations/operation/equality; if no Wow gate passes, record the unavailable explanation instead of forcing a fallback | Each child can understand the available page with normal parent guidance; the pilot never edits capabilities merely to unlock an activity. |
| Parent rates each sheet `too easy`, `just right`, or `too hard` | Ratings inform profile edits or future generator issues; the app stores no performance record. |
| Observe writing-space and instruction clarity | The selected writing mode provides enough room and does not demand a skill the profile did not declare. |
| Observe interest personalization | It makes the sheet more engaging without changing the learning target or creating awkward/unsafe text. |
| Stop if frustration rises | The activity remains optional practice, not a completion requirement or assessment. |

Summarize only non-identifying product observations in the M2 issue. Never attach the real profile file or named worksheet output.

This pilot covers only the operator's current age-four and age-six children. It does not establish family-tested usability for age eight; until a representative age-eight pilot is added later, the v1 age-eight claim is limited to sourced content bounds plus canonical profile, generator, preview, and print acceptance fixtures.

Stop the server with `Ctrl+C` after the second session.

### Step M3: Live GitHub Actions smoke

- **Source step:** Step 13
- **Type:** operator
- **Issue:** #13
- **Commands:**

After the completed phase is committed and pushed with `/repo-update`:

```powershell
Set-Location C:\Users\abero\dev\extra-credit
gh auth status
$extraCreditHead = (git rev-parse HEAD).Trim()
$extraCreditBranch = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($extraCreditBranch)) { throw "M3 requires a named branch, not detached HEAD." }
$extraCreditRun = $null
for ($attempt = 0; $attempt -lt 24 -and -not $extraCreditRun; $attempt++) {
  $extraCreditRuns = @(gh run list --workflow ci.yml --branch $extraCreditBranch --event push --limit 20 --json databaseId,headSha,headBranch,event,status,conclusion,url | ConvertFrom-Json)
  $extraCreditRun = $extraCreditRuns | Where-Object { $_.headSha -eq $extraCreditHead -and $_.headBranch -eq $extraCreditBranch -and $_.event -eq 'push' } | Select-Object -First 1
  if (-not $extraCreditRun) { Start-Sleep -Seconds 5 }
}
if (-not $extraCreditRun) { throw "No push-triggered ci.yml run found for branch $extraCreditBranch at $extraCreditHead within two minutes." }
Write-Host "Watching push run $($extraCreditRun.url) for $extraCreditBranch at $extraCreditHead"
gh run watch $extraCreditRun.databaseId --exit-status
```

- **What to look for:** The selected `ci.yml` run's `headSha`, `headBranch`, and `event` equal the pushed local HEAD, current named branch, and `push`; its printed URL is retained in the Step 13 issue; it runs on Ubuntu 24.04, loads `.node-version`, installs from the lockfile under `frontend/`, installs Chromium, exercises the native POSIX owner-mode assertion plus mandatory DOM/PDF print geometry gates, and completes the same `check` gate successfully. On failure, run `gh run view $extraCreditRun.databaseId --log-failed`, record the failing job/log link, route the fix back through the owning build step, then repeat `/repo-update` and M3.

After all automated steps complete, please run M1 next.

## 12. Appendix

### 12.1 Synthetic `AppConfigV1` example

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "d2c05a44-73ad-4fa0-a4b3-9db5c5f6e321",
      "displayName": "Riley",
      "ageYears": 4,
      "presentationBand": "preschool",
      "reviewedOn": "2026-08-22",
      "mathSkills": {
        "countingMax": 10,
        "numeralMax": 10,
        "compareMax": 10,
        "representations": ["quantities"],
        "understandsEquality": false,
        "operations": [],
        "operandMax": 0,
        "resultMax": 0,
        "allowRegrouping": false,
        "allowNegativeResults": false
      },
      "writingMode": "label",
      "interests": ["animals", "space"]
    },
    {
      "id": "6af42f16-8c91-4c88-a726-5a0b8e7dd940",
      "displayName": "Morgan",
      "ageYears": 6,
      "presentationBand": "early-primary",
      "reviewedOn": "2026-08-22",
      "mathSkills": {
        "countingMax": 20,
        "numeralMax": 20,
        "compareMax": 20,
        "representations": ["quantities", "equations"],
        "understandsEquality": true,
        "operations": ["addition", "subtraction"],
        "operandMax": 10,
        "resultMax": 10,
        "allowRegrouping": false,
        "allowNegativeResults": false
      },
      "writingMode": "sentence-frame",
      "interests": ["nature", "vehicles"]
    },
    {
      "id": "93c7a8d2-4b1e-4a6f-9d30-7b8e2f1c5a64",
      "displayName": "Avery",
      "ageYears": 8,
      "presentationBand": "early-primary",
      "reviewedOn": "2026-08-22",
      "mathSkills": {
        "countingMax": 20,
        "numeralMax": 20,
        "compareMax": 20,
        "representations": ["quantities", "equations"],
        "understandsEquality": true,
        "operations": ["addition", "subtraction"],
        "operandMax": 20,
        "resultMax": 20,
        "allowRegrouping": false,
        "allowNegativeResults": false
      },
      "writingMode": "independent",
      "interests": ["sports", "nature"]
    }
  ],
  "defaults": {
    "useDisplayName": true,
    "useInterests": true,
    "includeDecorativeGraphics": true,
    "difficulty": "practice",
    "length": "standard",
    "includeAnswerKey": true,
    "paperSize": "letter",
    "printScale": "standard"
  }
}
```

### 12.2 Math-skill invariants

- `countingMax`, `numeralMax`, and `compareMax`: stored integers 1–1,000 for profile growth; every v1 generator clamps its effective numeric envelope to 20.
- `representations`: non-empty unique ordered subset of `quantities` and `equations`. `understandsEquality` is independent parent confirmation; the Wow equation variant requires both `equations` and `understandsEquality`.
- `operations`: unique ordered subset of `addition` and `subtraction` in v1.
- `operandMax` and `resultMax`: stored integers 0–1,000; both are zero when operations are empty and both positive when operations are present. V1 clamps both effective values to 20.
- `allowNegativeResults: false` prohibits subtraction items whose result is below zero. A true value is retained permission for a future sourced pack; v1 still emits only nonnegative results.
- `allowRegrouping: false` prohibits carrying/borrowing for profiles using multi-digit ranges. A true value is retained permission for a future sourced pack; v1 still emits no carrying/borrowing.
- Generators may use less than the v1-clamped maximum for confidence mode but must never exceed the normalized request's effective limits or the within-20 source envelope.

Exact setup presets expand as follows; the UI shows every expanded field before the parent confirms it:

| Preset | Presentation | Counting / numeral / compare | Representations / equality | Operations | Operand / result | Regrouping / negatives |
|---|---|---|---|---|---|---|
| `quantities-to-10` | `preschool` | 10 / 10 / 10 | `quantities` / false | none | 0 / 0 | false / false |
| `emerging-equations-within-5` | parent confirms band | 10 / 10 / 10 | `quantities`, `equations` / false | addition | 5 / 5 | false / false |
| `early-primary-within-10` | `early-primary` | 20 / 20 / 20 | `quantities`, `equations` / true | addition, subtraction | 10 / 10 | false / false |
| `early-primary-within-20` | `early-primary` | 20 / 20 / 20 | `quantities`, `equations` / true | addition, subtraction | 20 / 20 | false / false |
| `custom` | parent selected | every field parent selected | every field parent selected | every field parent selected | every field parent selected | every field parent selected |

Age suggestions are exact: age 4 selects `quantities-to-10`; age 5 presents `quantities-to-10` and `emerging-equations-within-5` without preselecting between them; ages 6–7 select `early-primary-within-10`; age 8 selects `early-primary-within-20`; ages 9–18 retain the profile but show no v1 content preset and an unsupported-band notice. Age never changes a confirmed preset.

The committed example, E2E suite, and manual print harness share three explicitly fictional acceptance fixtures:

| Fixture ID | Profile contract | Required coverage |
|---|---|---|
| `preschool-emergent` | age 4, `preschool`, `quantities-to-10`, `writingMode: label`, topics `animals`/`space` | Count/Compare, quantity Wow, younger writing, graphics/personalization toggles |
| `early-primary` | age 6, `early-primary-within-10`, `writingMode: sentence-frame`, topics `nature`/`vehicles` | Dry Math, equation Wow, scaffolded primary writing, answer keys; tests may edit only this fictional profile through the real UI to exercise other writing modes |
| `age-eight-boundary` | age 8, `early-primary-within-20`, `writingMode: independent`, topics `sports`/`nature` | Upper v1 age gate, within-20 math, independent writing/idea bank, print geometry, and proof that age 8 is enabled while age 9 is not |

### 12.3 Worksheet capability summary

| Type ID | Requires symbolic operation | Uses instructional visuals | Uses interests | Has answer key |
|---|---:|---:|---:|---:|
| `dry-math` | Yes | No | No | Yes |
| `find-the-wow` | Only in equation mode | In quantity mode | No | Yes |
| `sentence-builder` | No | Writing guides; optional line art | Yes | No |
| `count-compare-make` | No | Yes | Optional decorative context only | Yes for all four numeric/relation subtypes |

### 12.4 Stable error codes

`HOST_REJECTED`, `ORIGIN_REJECTED`, `CROSS_SITE_REJECTED`, `SESSION_TOKEN_INVALID`, `CONFIG_NOT_FOUND`, `CONFIG_INVALID`, `CONFIG_VERSION_UNSUPPORTED`, `CONFIG_TOO_LARGE`, `CONFIG_UNSAFE_FILE`, `CONFIG_SERIALIZED_TOO_LARGE`, `CONFIG_CONFLICT`, `CONFIG_PRECONDITION_REQUIRED`, `CONFIG_RECOVERY_NOT_ALLOWED`, `CONFIG_IO_ERROR`, `INVALID_JSON`, `BODY_TOO_LARGE`, `CONTENT_TYPE_REQUIRED`, `VALIDATION_FAILED`, `GENERATION_AGE_UNSUPPORTED`, `GENERATION_CONSTRAINT_CONFLICT`, and `GENERATION_INVARIANT_FAILED` are the complete v1 public machine-code set. UI messages may improve without changing these codes.

### 12.5 Source basis

- Development and individual variation: [Head Start Early Learning Outcomes Framework](https://headstart.gov/interactive-head-start-early-learning-outcomes-framework-ages-birth-five) and [NAEYC Developmentally Appropriate Practice](https://www.naeyc.org/resources/position-statements/dap/core-considerations).
- Early mathematics: [IES Teaching Math to Young Children](https://ies.ed.gov/ncee/wwc/practiceguide/18), [IES Assisting Students Struggling with Mathematics: Intervention in the Elementary Grades](https://ies.ed.gov/ncee/wwc/practiceguide/26), [Common Core Kindergarten Counting and Cardinality](https://www.thecorestandards.org/Math/Content/K/CC/), [Kindergarten Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/K/OA/), [Grade 1 Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/1/OA/), and [Grade 2 Operations and Algebraic Thinking, including fluency within 20](https://www.thecorestandards.org/Math/Content/2/OA/B/2/). These sources bound reviewed examples; Extra Credit neither measures fluency nor presents itself as an intervention.
- Early writing and literacy: [Head Start Preschool Literacy](https://headstart.gov/school-readiness/article/literacy-preschool), [Common Core Kindergarten Writing](https://www.thecorestandards.org/ELA-Literacy/W/K/), [Common Core Grade 2 Writing](https://www.thecorestandards.org/ELA-Literacy/W/2/), [Common Core Grade 2 sentence production](https://www.thecorestandards.org/ELA-Literacy/L/2/1/f/), and [IES Foundational Reading Practice Guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/21/Published).
- Play and flexible response: [NAEYC curriculum planning](https://www.naeyc.org/resources/position-statements/dap/planning-curriculum), [AAP Power of Play](https://www.healthychildren.org/English/family-life/power-of-play/Pages/the-power-of-play-how-fun-and-games-help-children-thrive.aspx), and [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/).
- Accessibility and print: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [MDN Printing](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing), [`window.print`](https://developer.mozilla.org/en-US/docs/Web/API/Window/print), and [`@page`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40page).
- Privacy: [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
- Runtime and frameworks: [Node release status](https://nodejs.org/en/about/previous-releases), [Vite 8 announcement](https://vite.dev/blog/announcing-vite8), [Vite server options](https://vite.dev/config/server-options), [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [Fastify testing](https://fastify.dev/docs/latest/Guides/Testing/), [Zod JSON Schema](https://zod.dev/json-schema), and [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots).
- Licensing and repository security: [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository), [OSI MIT License](https://opensource.org/license/mit), and [GitHub repository security quickstart](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository).

### 12.6 Determinism and evolution contract

- The seeded PRNG is exactly the xorshift32 algorithm and rejection sampler in Section 5. Any algorithm change increments every affected generator version and updates the known vectors.
- Candidate enumeration order, normalization order, shuffle order, capacity calculation, and page-balance tie breaking are content-affecting behavior covered by deterministic fixtures.
- The generator calculates capacity before drawing random candidates. It never relies on an unbounded retry loop to discover impossibility.
- A worksheet's `generatorVersion` increments for any content-affecting change. Old-version reproduction is supported only while its implementation remains explicitly registered; v1 makes no archival promise because documents are not stored.
- `AppConfigV1.schemaVersion` evolves separately. The server may read only versions for which an explicit parse/migration path exists and never rewrites an unsupported future version.
- The worksheet lifecycle UUID is intentionally nondeterministic and excluded from content equality; its sole contract is collision-resistant DOM/output namespacing.

### 12.7 Verified environment evidence

The following read-only checks were run from `C:\Users\abero\dev` on 2026-08-22 before Step 1; the future lockfile supersedes registry prose as soon as it exists:

| Check | Observed contract |
|---|---|
| `node --version` / `npm --version` | Node `v24.14.0`; npm `11.9.0` |
| `npm view vite@8.2.2 engines --json` | `^20.19.0 || >=22.12.0` |
| `npm view vitest@4.1.11 engines --json` | `^20.0.0 || ^22.0.0 || >=24.0.0` |
| `npm view playwright@1.62.1 engines --json` | Node `>=20` |
| `npm view write-file-atomic@7.0.0 engines --json` | `^20.17.0 || >=22.9.0`; selected for Node 24.14.0 compatibility |
| `uv run --project dev-observatory observatory ports` after registration | `4310: extra-credit`; `4311: extra-credit`; neither appears in Collisions |

### 12.8 Verified build-producer contract

The step syntax is grounded in the installed producer files, not inferred from prior projects:

- `C:\Users\abero\.agents\skills\build-phase\core.md` parses headings shaped `### Step N` and fields `Problem`, `Type`, `Issue`, `Flags`, optional `Done when`, and dependencies; it forwards the acceptance text and flags to `/build-step` in numeric order.
- `C:\Users\abero\.agents\skills\build-step\core.md` accepts reviewer values `auto`, `code`, `deep`, `runtime`, and `full`; isolation values `worktree` and `docker`; and the UI flags `--ui`, `--start-cmd`, `--url`, and `--ready-url`. `full` requires start command and URL. Every step here uses only those verified values.
- The same build-step producer explicitly detects `frontend/package.json` in a worktree and runs its npm install there. That is why this plan's single package can remain nested while all flags invoke commands from the repository root with `npm --prefix frontend`.
- The build-phase producer flags any automated step touching `frontend/` without `--ui`. Consequently every such step in this plan declares a UI start command and URL, including backend, test, and release-contract slices; the selected reviewer still controls the review depth.

### 12.9 Decision Inventory

The proposal presents operator-picked decisions as locked context and records the operator-confirmed disposition of every agent-defaulted decision. IDs remain stable across proposal revisions.

| ID | P/D | Choice | Status |
|---|---|---|---|
| P1 | Operator-picked | Publish the code and original assets as an open-source repository; keep the application local rather than publicly hosted. | Locked |
| P2 | Operator-picked | Store reusable child profiles in a gitignored local JSON file and edit them through the setup UI. | Locked |
| P3 | Operator-picked | Offer independent name, interests, and simple black-and-white graphics toggles. | Locked |
| P4 | Operator-picked | Use React 19 for the frontend UI only, with Node/Fastify for the local server. | Locked |
| P5 | Operator-picked | Defer runtime AI to a v2-or-later explicit opt-in toggle and retain deterministic local generation as the default and fallback. | Locked |
| P6 | Operator-picked | Run no scheduled or background work in v1; only direct parent actions and an in-process save mutex may cause work. | Locked |
| P7 | Operator-picked | Add no app login, PIN, encryption layer, or API secrets in v1; filesystem ACLs protect the stopped file and loopback blocks network peers, while docs disclose that any local process/user can access the running API and advise stopping it on shared/untrusted machines. | Locked |
| P8 | Operator-picked | Ship four v1 worksheet families and defer Mini Mission to a later feature plan. | Locked |
| P9 | Operator-picked | Let dev-observatory own workspace port allocation rather than assuming a popular default port is free. | Locked |
| D1 | Agent-defaulted | Bind to `127.0.0.1` and use observatory-reserved fixed ports `4310` for the app/API and `4311` for Vite, with no v1 port override. | Confirmed 2026-08-22 |
| D2 | Agent-defaulted | Model age plus explicit math capabilities, writing mode, reviewed date, and interests—without an avoid-topics field in v1—instead of a single coarse math-level label. | Changed 2026-08-22; confirmed |
| D3 | Agent-defaulted | Validate U.S.-English content for ages four through eight in v1; retain ages nine through eighteen but disable generation until their bands are reviewed. | Changed 2026-08-22; confirmed |
| D4 | Agent-defaulted | Use versioned deterministic generators, a specified PRNG, preflight capacity checks, immutable worksheet documents, and typed objective/open answers. | Confirmed 2026-08-22 |
| D5 | Agent-defaulted | Protect local config with strict validation, bounded regular-file reads, strong ETags, serialized atomic writes, and explicit byte-identical recovery backups. | Confirmed 2026-08-22 |
| D6 | Agent-defaulted | Define the exact activity variants, capability gates, answer semantics, decoration boundaries, and neutral fallbacks in the plan. | Confirmed 2026-08-22 |
| D7 | Agent-defaulted | Provide simple defaults plus advanced difficulty, length, answer-key, paper-size, and print-scale controls; require confirmation for stretch. | Confirmed 2026-08-22 |
| D8 | Agent-defaulted | Make semantic HTML/CSS the print source, support Letter/A4, and verify accessibility, geometry, PDF page count, and the scoped browser/platform matrix. | Confirmed 2026-08-22 |
| D9 | Agent-defaulted | Use the pinned Node/React/Fastify/Vite/TypeScript test stack and one root MIT license for every project-original code, worksheet-template, documentation, and line-art artifact. | Changed 2026-08-22; confirmed |
| D10 | Agent-defaulted | Deliver through thirteen gated automated build steps followed by physical-print, family-pilot, and live-CI manual gates. | Confirmed 2026-08-22 |
