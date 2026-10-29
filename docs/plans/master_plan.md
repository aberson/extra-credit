# Extra Credit master plan

## 1. What This Is

Reconciled 2026-10-14.

Objective: preserve the deterministic, local worksheet product, finish retained acceptance and packet work, and add the selected visual-math first batch (Phase V).
Proposal: docs/plan-reconciliation/master-plan-proposal.html

Original bytes preserved with [hashes and initial Git state](../plan-reconciliation/source-map.json). All originals remain merged archives because manual acceptance or deferred requirements remain; code-DONE is not release-complete.

- [plan.md](../archived-plans/plan.md)
- [docs/math-activities-plan.md](../archived-plans/documentation__math-activities-plan.md)
- [docs/printable-packets-plan.md](../archived-plans/documentation__printable-packets-plan.md)
- [docs/worksheet-first-plan.md](../archived-plans/documentation__worksheet-first-plan.md)
- [docs/feature-seeds/01-worksheet-first.md](../archived-plans/documentation__feature-seeds__01-worksheet-first.md)
- [docs/feature-seeds/02-math-activities.md](../archived-plans/documentation__feature-seeds__02-math-activities.md)
- [docs/feature-seeds/03-printable-packets.md](../archived-plans/documentation__feature-seeds__03-printable-packets.md)

Binding [operator decisions](../feature-seeds/operator-decisions.md): P9 supersedes P4 durable drafts; P10 supersedes P7 unattended multi-plan chain. Lean kept step fields supersede old appendix/decision rows.

Current build scope (2026-10-28, P6/P7): Steps 35, 36, 31 and 33, in that order; Step 37 and the operator steps follow. Earlier track statuses and acceptance gates remain authoritative.

## 2. Vision

Local parent-facing personalized printable practice, with deterministic worksheet-first choices, preserved identity profiles and printable session packets. Initial plan is the substrate spine; follow-on milestones refine it without reactivating superseded designs.

## 3. Principles

No accounts, cloud services, telemetry, runtime AI or background scheduler in current product. Names/interests remain private. Fixed loopback4310/4311 is not OS-user authentication; stop after use. Immutable documents bind work and answers; finite capacity fails closed, no hidden widening/duplicates. Required visuals and response dimensions survive decoration toggles. MIT root license and full asset provenance unchanged. No real family data, screenshots or profiles in tests/issues/public release. Preserve all user files; cleanup grants no implementation or publication authority.

## 4. Glossary

Worksheet choices are session state; explicit worksheet-defaults save persists global choices. Profiles are identity-only, with preserved legacy choices for initial seeding. Packet means session-only ordered immutable documents, not durable draft. UAT means actual observation; CI means exact pushed-commit check. Source plan01/02/03 aliases remain useful in history, but this master owns dispatch.

## 5. How to read this plan

Each leaf carries status/type/scope/output/acceptance/dependency. Canonical short IDs key dispatch and build-estimates.json; WF1/WF2/MA2/PK1 retain source aliases WF-1/WF-2/MA-2/PK-1. Source issue numbers retained. Four code leaves 27/31/33/34 (34 DONE) keep full acceptance inline; math and packet supporting contracts supply exact referenced rules without old queues. All source line citations target the immutable archived initial plan; that historical specification is not current status authority. `Type: planning` (F1-F8) marks a deferred design placeholder that `/build-phase` never dispatches; selecting one first replaces it with reviewed code/operator steps. Tags such as K1-K13, DD10, D21 and D48 are provenance labels from the archived source plans; the step text is the complete requirement.

## 6. Execution mode

P10: one track/window at a time with its operator screen review before the next. Build eligible named steps only, never entire master. Existing flags --reviewers code --isolation worktree; no runtime/deep/UI lanes without separately designed fictional exercise. Narrow iteration suites; once-per-step post-merge full check, counts no lower than prior step. release:verify once per plan at separately authorized repo-update. No new AST/grep guards, fingerprint repins, golden capture suites or privacy gates. Before build: ports4310/4311 free, retained launcher stopped, Test-Path config/children.local.json false, metadata only. Never inspect/copy/move/delete config/uat-session or retained TEMP store.

## 7. Track structure

Shipped substrate 1-19, math 24-26 and Operation Grid 34; retained acceptance WF1/WF2,MA2,M1/M2/M3. Optional math27; packets31 then33 only afterMA2 screen gate, and packetPK1 afterward. Future scoped content remains deferred. Plan03 code depends on shipped19, not optional27; current orchestration still honors inter-plan screen review.

Track **goal/scope** is its leaves; **prerequisites** are explicit; **tests/validation** are Done-when and existing full check; **effort** is sidecar ranges; **gate** distinguishes code from actual acceptance; **kill criterion** is changed private state, weakened invariant, unresolved architecture or failed required evidence; **rollback** retains previous store bytes/outputs and isolated candidates, never resets profiles or replays superseded migration.

## 8. Decision graph

```text
DONE1-13 ->DONE14-19 ->DONE24-26 ->DONE34 ->MA2 ->31 ->33 ->PK1
                                  \ optional27 ->MA2 re-review
Shipped surfaces ->M1 physical ->M2 family
Each authorized release: release:verify ->push ->M3 exact Ubuntu run
WF1/WF2 acceptance evidence remains explicit, not inferred from later code
```

## 9. Baseline

As of reconciliation (2026-10-14): HEAD `268183162e3fe9a4778bc8d8fc07544872ff7331`. Initial untracked operator screenshot preserved byte-for-byte; it is a pre-existing release-audit blocker, not a privacy exemption. Steps1-13 and14-19 DONE;20 folded into18;21 folded into24;22/23 removed;24/25/26 DONE, latest source gate1047 Vitest/195 Playwright. Optional27 not built. Packets31/33 not built, issues not assigned;28-30 removed; 32 and the archived packet plan's Step 34 (packet smoke/docs) folded into 31/33. The master's Step 34 is a different, later unit: Operation Grid (#42), DONE at `8b2546a`. Age/Difficulty/profile capability gates replaced by worksheet choices; no schema3. Additive v2 keys use defaults; removals/renames require explicit version/read path; blocked unknown-key/enum state preserves bytes. Existing quantity/Wow<=20; symbolic add/sub<=100; factors0-12/exact dividends<=144. Regrouping explicit, no negative answers. No automated history establishes physical/family/hosted CI acceptance. Since then: Step 34 (Operation Grid, #42) merged at `8b2546a`; the operator screenshot now lives outside the checkout at `C:/Users/abero/extra-credit-private/examples/`, so it is no longer a release-audit blocker; the latest accepted full gate is Step 34's 1118 Vitest (40 files)/206 Playwright, the floor for every later step's full gate.

## 10. Phases

### Step 27: Number bond pictures and the last pending choice
- **Status:** DEFERRED (optional; operator selection required)

- **Problem:** Implement master Step 27, using this leaf and the [math contract](../plan-reference/math-contracts.md) as the specification; touch further files when a gate requires it and record them in the checkpoint. Add number bond pictures to Number Bonds: a whole in a top circle joined to two part circles with exactly one part left as an empty circle to write in, each whole and shown part used at most once per page, leaving out pictures whose missing part needs carrying or borrowing unless the parent includes them, generated, validated, counted, keyed, rendered and printed; the Problem style choice (missing number sentences or number bond pictures) is persisted as an additive schemaVersion 2 field inside the numberBonds group with a Zod default of `sentence` (missing number sentences), so a v2 file lacking it parses unchanged, reading never writes, and there is no migration, backup, upgrade notice or version bump.
- **Type:** code
- **Issue:** #38
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: `frontend/src/worksheets/number-bonds/{definition.ts,generator.ts,generator.test.ts}`; `frontend/src/web/worksheets/number-bonds/{Renderer.tsx,Renderer.test.tsx}` and new `BondDiagram.tsx`.
  - Shared: `frontend/src/shared/worksheet/{types.ts,answer-oracle.ts,answer-oracle.test.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,practice-focus.ts,practice-focus.test.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Web: `frontend/src/web/print/AnswerKeyView.tsx`; `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts}`; `frontend/src/web/worksheets/registry.test.ts`; `frontend/src/web/styles/tokens.css`.
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/integration/{arithmetic-oracle,schema-parity,shipped-profile-options,ci-contract}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/{number-bonds,print,accessibility,release-smoke}.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Docs: `README.md` (one sentence), `docs/educational-basis.md`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted field** (schema policy): `NUMBER_BONDS_VARIANTS` (`sentence`, `bond`) in `enums.ts`; `numberBonds.variant` with a Zod `.default()` of `sentence`, composed into the transport schema from the same array.
  - **Types and family** (DD10, D48): `NumberBondItemV1` gains `form: "bond"` with `whole`, `leftPart`, `rightPart` and `missing`; problem identity is the whole and the shown part, and the blank side is drawn from the seeded stream after the slice; picture budgets 6/8/10 (large 6/6/8); Appendix B.3 picture enumeration in canonical order, filtered by the regrouping choice exactly as sentences are; validator and capacity verdict per style; the oracle gains pictures; the `number-bond` arm of `answer-oracle.ts` gains the bond form (whole minus shown part); the pictures shortfall uses the number bond units of Appendix F.
  - **Projection:** pictures emit variant `bond` with `operations` pinned to addition (inactive).
  - **Controls:** the Problem style radio group (Missing number sentences, Number bond pictures) after the card; the three picture focus entries and the picture form of the Saved setting option; the Carrying and borrowing group keeps its value across styles; the helper gains `chooseProblemStyle`.
  - **Renderer and key:** `BondDiagram` draws the whole circle above two part circles joined by lines (an `aria-hidden` inline SVG with no `xmlns` or other URL-valued attribute, because the release audit fails any TSX string literal beginning with http), the blank part as an empty `[data-bond-circle][data-bond-blank]`, the item as `role="img"` with the Appendix F label; key lines per Appendix F, naming the blank side.
  - **Print, compiled proof and docs:** `tokens.css` adds `--bond-circle` (16 mm, 18 mm large) and a three-column pictures grid in new rules; fixture `bonds-pictures-20` at Letter and standard scale only, plus its key; one new separate `test()` block in `release-smoke.spec.ts`, titled without example ids, nicknames or interest words (the log-privacy calibration's count oracle already reads the project's listed test count since plan 01 Step 18, and plan 02 does not change `log-privacy-calibration.mjs`); README gains one sentence and the educational-basis Number Bonds section describes pictures; `testing-print.md` names the new row.
- **Done when:** All numbered acceptance criteria below pass, including the once-per-step post-merge full check; counts do not fall below the preceding accepted step.
- **Acceptance detail:**
  1. **Oracle and generator** (`arithmetic-oracle.test.ts`, `number-bonds/generator.test.ts`, `answer-oracle.test.ts`): for every `wholeMax` 2..20 the picture problem-key set, keyed by whole and shown part, equals the oracle's in both regrouping choices: included, `wholeMax × (wholeMax − 1) / 2`; by default the same through 9 and 36 and 127 at 10 and 20; each candidate has exactly one blank part and exactly one value in `0..40` completes it, equal to the answer; the dispatch recomputes the bond form; inline known vectors pin a few pages and the Step 26 sentence vectors still pass unchanged; one fast-check property of about 200 runs shows every document judged clean with no repeated whole and shown part, and a mirror case (included instead of without, same seed) changes the items.
  2. **Negatives** (`number-bonds/generator.test.ts`): a blank whole, two blanks, a part not below its whole, parts not summing to the whole, a zero part, a duplicate and a mirrored duplicate each fail with `GENERATION_INVARIANT_FAILED`; a default document holding one picture whose parts regroup fails with `REGROUPING_MISMATCH` named, while the same document with `regrouping` `included` passes.
  3. **Availability and persistence** (`shipped-profile-options.test.ts`, `limit-labels.test.ts`, `schema-parity.test.ts`, `project-request.test.ts`): pictures at `wholeMax` 2 and 3 are refused everywhere with the range remedy only; at 4 they fill Short exactly at both scales, refuse Standard at standard with the range-or-shorter sentence and fill large Standard exactly (6); within 5 fills Long at standard exactly (10); the arm sweep's observed set equals the declared set; `numberBonds.variant` has its parity row and a v2 config without it parses as sentences; for pictures, varying `numberBonds.operations` leaves the request deep-equal.
  4. **Render and key** (`Renderer.test.tsx`, `math-generation.test.ts`): reading only the three rendered circles per item, the blank circle is empty, its one solution in `0..40` matches the key's `data-answer-value`, the key line's visible text names the blank side as `?`, and the rendered markup contains no `http`; `createWorksheetSessionForSeed` returns a validated, oracle-equal pictures document.
  5. **Browser and print** (`number-bonds.spec.ts`, `accessibility.spec.ts`, `print.spec.ts`, `release-smoke.spec.ts`): "number bond pictures within twenty match the key" shows every blank circle empty and key answers equal to the oracle's; DOM order card, Problem style, child, focus, Carrying and borrowing, summary, Create, and switching style keeps `wholeMax` and the regrouping choice; axe reports zero violations on both styles, with keyboard reach and 320 CSS px reflow; the new print row prints one worksheet page and one key page with circle diameter 16 mm, round within 0.3 mm and the whole above both parts, and a 1 px circle and `border-radius: 0` each fail those checks, then restore clean; `ci-contract.test.ts` pins the row count raised by exactly that row; the new release-smoke case creates, keys and prints a pictures page on the compiled app.
  6. **Full gate:** after merge, build-phase runs npm --prefix frontend run check once in the main checkout; Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 26

### Step 34: Operation Grid (fill-in table) as the sixth family
- **Status:** DONE (2026-10-26)

- **Problem:** Implement master Step 34; touch further files when a gate requires it and record them in the checkpoint. Add a sixth worksheet family, `operation-grid` (display name "Operation Grid"), modeled on the operator's reference screenshot `C:/Users/abero/extra-credit-private/examples/Screenshot 2026-10-04 140609.png` (kept outside the checkout so the release audit never exports it): one table per page with an operator corner cell, column headers across the top, row headers down the side, a few cells pre-filled as anchors and every other cell an empty box the child completes. The parent chooses the operation (addition `x + y`, multiplication `x × y`, powers `x^y`), the grid size (rows and columns each 2..12, default 10 × 10), and how many cells are pre-filled through a number input with presets; an answer key prints the completed grid. Choices are App session state persisted only by the explicit worksheet-defaults save, as an additive schemaVersion 2 `operationGrid` group whose every field has a Zod default, so a v2 file lacking it parses unchanged, reading never writes, and there is no migration, backup, notice or version bump.
- **Type:** code
- **Issue:** #42
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: new `frontend/src/worksheets/operation-grid/{definition.ts,generator.ts,generator.test.ts}`; new `frontend/src/web/worksheets/operation-grid/{Renderer.tsx,Renderer.test.tsx}`.
  - Shared: `frontend/src/shared/worksheet/{types.ts,answer-oracle.ts,answer-oracle.test.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,practice-focus.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Web: `frontend/src/web/print/AnswerKeyView.tsx`; `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts}`; `frontend/src/web/worksheets/registry.test.ts`; `frontend/src/web/styles/tokens.css`.
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/integration/{arithmetic-oracle,schema-parity,shipped-profile-options,ci-contract}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; new `frontend/tests/e2e/operation-grid.spec.ts`; `frontend/tests/e2e/{print,accessibility,release-smoke}.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Docs: `README.md` (one sentence, one family row and the card count), `docs/educational-basis.md`, `docs/testing-print.md`, and the family slug list in this plan's §11 and the project `CLAUDE.md`.
  - As shipped (`8b2546a`): also `worksheet-session.ts` and `earlier-settings.ts` (each with its test), `migrate.test.ts`, `screen.css`, `web/worksheets/registry.ts`, `tests/fixtures/profiles.ts`, `practice-golden.test.ts` and new `tests/e2e/fixtures/grid-table.ts`; `practice-focus.ts` and `limit-labels.ts` were not needed.
- **Produces:**
  - **Persisted fields** (schema policy): `OPERATION_GRID_OPERATIONS` (`addition`, `multiplication`, `powers`) and `OPERATION_GRID_PLACEMENTS` (`random`, `diagonal-first`) in `enums.ts`; `operationGrid` holds `operation` (default `multiplication`), `rows` and `columns` (integers 2..12, default 10), `prefilled` (integer, default 10) and `placement` (default `random`), composed into the transport schema from the same arrays.
  - **Bounds (fail closed, no widening):** headers run 1..N. Addition sums stay ≤ 24 and multiplication products ≤ 144, inside the existing envelope. Powers use row headers as bases 1..rows and column headers as exponents 1..columns, where columns ≤ 3, so no cell exceeds 1,000; a powers selection asking for more than 3 columns is refused with a remedy naming the exponent limit rather than silently narrowed, and powers rows above 10 are refused the same way. `prefilled` must leave at least one blank cell (0..rows × columns − 1); anything else is refused with the binding remedy.
  - **Types and generator:** `OperationGridItemV1` (one per document) holds `operation`, `rowHeaders`, `columnHeaders` and `cells` (row-major, each `{value, given}`), with `value` the exact result, and `answer` the new objective kind `grid` (every cell's value, row-major); the seeded stream picks which cells are given: `diagonal-first` fills the `i = j` cells first (square grids, addition or multiplication only; otherwise refused with a remedy) and then random extras up to `prefilled`, `random` picks all of them by seed. The `operation-grid` arm of `answer-oracle.ts` recomputes every cell. The length choice does not apply (one grid per page) and is hidden for this family; decorative art is off for this family so the table keeps its print area.
  - **Controls:** after the card, an Operation radio group (Addition `x + y`, Multiplication `x × y`, Powers `x^y`), Rows and Columns number inputs, a Placement radio group (Random, Diagonal first) and a Pre-filled cells number input with preset buttons Nearly blank (10%), Half (50%), Mostly filled (75%) and Diagonal (sets the count to the diagonal length and placement to Diagonal first); presets only write the input, rounding down and keeping at least one blank; the helper gains `chooseOperationGrid`.
  - **Renderer and key:** a semantic `<table>` with `<th scope>` headers and the operator symbol in the corner (`+`, `×`, `^`); given cells show their value with a visible distinguishing style that survives monochrome print, blank cells are empty `[data-grid-blank]` boxes sized for four handwritten digits; the key renders the same table fully completed, given cells still distinguishable.
  - **Print, compiled proof and docs:** `tokens.css` adds grid cell tokens so a 12 × 12 grid prints on one Letter and one A4 page at standard scale (large scale offers at most 10 rows and 10 columns; a larger grid is refused with a remedy naming that limit or Standard print scale, never shrunk below the handwriting minimum); fixtures `grid-multiplication-10` (Letter/standard, diagonal-first, 10 given, matching the reference screenshot's shape), `grid-addition-12` (Letter/standard and A4/standard) and `grid-powers-10x3` (Letter/large) plus their keys; one new separate `test()` in `release-smoke.spec.ts`, titled without example ids, nicknames or interest words; README gains one sentence, one family-table row and the six-card count, educational-basis gains an Operation Grid section (powers is offered as parent-chosen enrichment, with no grade or readiness claim), and `testing-print.md` names the new rows.
- **Done when:**
  1. **Oracle and generator** (`arithmetic-oracle.test.ts`, `operation-grid/generator.test.ts`, `answer-oracle.test.ts`): for every operation and every legal size, every cell equals the oracle's value; exactly `prefilled` cells are given and at least one is blank; `diagonal-first` gives every diagonal cell before any other; one fast-check property of about 200 runs shows every document validates and a mirror case (same seed, other placement) changes the given set; inline known vectors pin a few pages.
  2. **Negatives:** a wrong cell value, a given count that differs from `prefilled`, zero blanks, a powers cell above 1,000 and a diagonal request on a non-square or powers grid each fail with `GENERATION_INVARIANT_FAILED` or the named refusal.
  3. **Availability and persistence** (`shipped-profile-options.test.ts`, `limit-labels.test.ts`, `schema-parity.test.ts`, `project-request.test.ts`): powers with 4+ columns or 11+ rows, a full grid, and diagonal on a non-square grid are refused with remedies naming only the binding limit; each preset writes the expected count for 10 × 10 (10, 50, 75, 10) and 12 × 12; `operationGrid` has its parity rows and a v2 config without it parses with the defaults.
  4. **Render and key** (`Renderer.test.tsx`, `math-generation.test.ts`): reading only the rendered table, headers and the corner symbol match the operation, blank cells are empty, given cells show the oracle value, and the key's cells all equal the oracle; `createWorksheetSessionForSeed` returns a validated, oracle-equal document.
  5. **Browser and print** (`operation-grid.spec.ts`, `accessibility.spec.ts`, `print.spec.ts`, `release-smoke.spec.ts`): each operation creates, previews and keys correctly; presets update the input and the preview; axe reports zero violations with keyboard reach and 320 CSS px reflow; each new print row prints one worksheet page and one key page with every cell at least the handwriting minimum and the table uncut, and a collapsed-cell calibration fails then restores clean; `ci-contract.test.ts` pins the raised row count; the release-smoke case creates, keys and prints a 10 × 10 multiplication grid on the compiled app.
  6. **Full gate:** after merge, build-phase runs npm --prefix frontend run check once in the main checkout; Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 26
- **Operator inputs (2026-10-26):** operations `x + y`, `x × y`, `x^y`; size customizable with a 10 × 10 default; pre-filled count is a number input with Random/Diagonal/density presets; answer key prints the completed grid. The powers cap (exponents 1..3, cells ≤ 1,000) and the 12 × 12 maximum were proposed by the planner and confirmed by the operator the same day (Decision Inventory P4, P5).

### Step 31: Add to packet, reorder and remove (session queue)
- **Status:** DONE (2026-10-29)

- **Problem:** Implement master Step 31, using this leaf and the [packet contract](../plan-reference/packet-contracts.md) as the specification; touch further files when a gate requires it and record them in the checkpoint. Let a parent add the currently previewed worksheet, its answers included, to a printable packet held only in App session state (a reducer beside the worksheet session; P9 and the lean revision: no draft file, no packet route, no browser storage), list the queued sheets with a per-sheet label, move a sheet up or down, remove it, refuse a document that is already queued with a message, and cap the packet at 10 sheets with Add disabled at the cap; sheets for different children may share one packet, queued documents never change when controls, the selected child or profiles change, the panel says the packet is kept only until the page is closed or reloaded, and no packet action ever writes saved profiles or worksheet defaults.
- **Type:** code
- **Issue:** #47
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Web: new `frontend/src/web/packet/{packet-session.ts,packet-session.test.ts,PacketPanel.tsx,PacketPanel.test.tsx}`; `frontend/src/web/App.tsx` (the packet reducer beside the worksheet session, Add to packet beside Make another, the panel); `frontend/src/web/styles/screen.css` (packet screen rules only).
  - Label owners, read only: the registry's family `displayName`, `describePracticeFocus` and `describeNumberBonds` (`frontend/src/shared/config/practice-focus.ts`), `describeOperationGrid` (`frontend/src/worksheets/operation-grid/definition.ts`), `SENTENCE_BUILDER_VARIANT_LABELS` (`frontend/src/worksheets/sentence-builder/definition.ts`) and the Short/Standard/Long length labels, extracted from `GeneratorControls.tsx`'s inline JSX into one exported constant that the controls and the packet both read; besides that extraction, at most an added `export` keyword on an owner that lacks one.
  - E2E: new `frontend/tests/e2e/fixtures/packet-controls.ts`; new `frontend/tests/e2e/packet-queue.spec.ts`; `frontend/tests/e2e/release-smoke.spec.ts` (one new packet `test()`).
- **Produces:**
  - **Session queue (P9):** `packet-session.ts` exports `PACKET_SHEET_LIMIT` (10) and a pure `packetReducer` with `add`, `moveUp`, `moveDown` and `remove` actions over an ordered list of queued sheets, each holding the profile id it was made for and the immutable generated document (items and answers) exactly as previewed. `add` refuses a document whose `worksheetId` is already queued (`already-in-packet`) and an eleventh sheet (`packet-full`), leaving the state unchanged. App holds it with `useReducer` beside the worksheet session; nothing is sent to the server or written to browser storage, and the queue is lost on close or reload by design.
  - **Labels:** `describeQueuedSheet(sheet, profiles)` composes family, variant or focus, child and length from the label owners above and restates no label; a sheet whose `getApplicableControls().length` is false for its selection (Operation Grid, Clock Explorer, Tally Detective; the two no-bank Sentence activities) omits the length segment, and Clock Explorer and Tally Detective, which have no variant or focus, omit the detail segment; the child is the current nickname, "Profile N" by list position, or "a removed profile" when the profile no longer exists.
  - **UI (K1, K2, K3, K9, K12, K13):** "Add to packet" beside Make another, shown only while a current preview is visible, disabled with its visible reason at the cap; `PacketPanel` ("Printable packet", "N of 10 sheets" rendered from `PACKET_SHEET_LIMIT`) lists "Sheet N · family · detail · for child · length" rows, each with Move up, Move down and Remove, and shows the sentence "This packet is kept only until you close or reload this page." A refused duplicate announces "This worksheet is already in the packet." Live messages use `aria-live="polite"` without `role="status"`.
  - **Helper:** `packet-controls.ts` provides `addToPacket`, `packetRows`, `moveSheet` and `removeSheet`.
- **Done when:**
  1. **`packet-session.test.ts`:** `add` stores the previewed document unchanged; a second `add` with the same `worksheetId` and an eleventh `add` are refused with their codes and an unchanged state; `moveUp`, `moveDown` and `remove` give the expected order, with the first and last sheets unable to move past the ends; sheets for two different profiles coexist; `describeQueuedSheet` returns family, detail, child label (nickname, Profile N, a removed profile) and length from the shipped owners, including a Number Bonds, an Operation Grid, a Clock Explorer and a Tally Detective sheet.
  2. **`PacketPanel.test.tsx`:** rows render in queue order with their labels and accessibly named Move up, Move down and Remove controls; the count and cap copy come from `PACKET_SHEET_LIMIT`; Add is disabled with its reason at the cap; the duplicate message is announced through `aria-live="polite"` and no `role="status"` element is added; the session-only sentence is present.
  3. **`packet-queue.spec.ts`** (compiled app, fictional config seeded through the existing `appServer` fixture):
     - adds three sheets of three different families for two children, then reorders and removes, and the rows follow; a second Add of the same preview is refused with its message; ten sheets disable Add with its reason;
     - changing every worksheet control, switching the child and editing a profile after adding leave every row unchanged, and a reload shows an empty packet;
     - no `PUT /api/config` request is sent during any packet action, and localStorage, sessionStorage, IndexedDB, Cache API and service workers stay empty;
     - axe reports zero violations for the six tag groups on the panel, a keyboard-only path reaches Add, Move up, Move down and Remove with visible focus, and 320 CSS px shows no horizontal scroll.
  4. **`release-smoke.spec.ts`:** one new compiled packet `test()`, titled without example ids, nicknames or interest words, adds two sheets for two canonical fictional children and checks both rows and that no `PUT /api/config` was sent; the log-privacy calibration's count oracle already reads the release-smoke project's listed test count (plan 01 Step 18), so this separate test needs no calibration change.
  5. Full gate: after merge, build-phase runs npm --prefix frontend run check once in the main checkout; Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 36 (P7 build order; the MA2 dispatch gate is waived by P6, 2026-10-28)
- **Completed prerequisite:** Step 19 is shipped. Plan 02 code is not a technical dependency; P10's screen review before packets is waived as a dispatch gate by P6 (2026-10-28).

### Step 33: Preview and print the whole packet once
- **Status:** PENDING

- **Problem:** Implement master Step 33, using this leaf and the [packet contract](../plan-reference/packet-contracts.md) as the specification; touch further files when a gate requires it and record them in the checkpoint. Let a parent preview every page of the session packet in print order and print the whole packet with one print action, each worksheet and each applicable answer key on its own page, keys grouped at the end by default with a per-packet choice of at the end, after each sheet or left out, and every key heading labeled with its sheet; one packet paper size, Letter or A4, chosen in the packet panel re-renders every sheet at its own stored scale without changing any problem (paper only: no length search, no regeneration); printing never clears the queue, and the profile delete dialog says how many queued sheets belong to that profile and leaves them in the queue.
- **Type:** code
- **Issue:** #48
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: new `frontend/src/shared/packet/{compose.ts,compose.test.ts}`.
  - Web: new `frontend/src/web/packet/{PacketPrintView.tsx,PacketPrintView.test.tsx}`; new `frontend/src/web/print/print-packet.css`; `frontend/src/web/print/AnswerKeyView.tsx` (optional `sheetLabel`); `frontend/src/web/packet/{packet-session.ts,packet-session.test.ts,PacketPanel.tsx,PacketPanel.test.tsx}` (paper and placement); `frontend/src/web/profiles/ProfileList.tsx`; new `frontend/src/web/profiles/ProfileList.test.tsx`; `frontend/src/web/App.tsx` (the view switch and queued counts); `frontend/src/web/styles/screen.css` (packet screen rules only).
  - Tests: new `frontend/tests/e2e/packet-print.spec.ts`; new `frontend/tests/e2e/fixtures/print-checks.ts` (`print.spec.ts`'s module-private required-content and containment readers, moved unchanged and exported); `frontend/tests/e2e/print.spec.ts` (imports from `print-checks.ts` only); `frontend/tests/e2e/fixtures/packet-controls.ts`; `frontend/tests/integration/ci-contract.test.ts` (one case); `frontend/tests/e2e/release-smoke.spec.ts` (one new packet print `test()`).
  - Docs: `docs/testing-print.md` (one short paragraph on packet printing).
- **Produces:**
  - **Composition (Appendix C, D-packet):** `composePacketPages(sheets, placement)` returns the ordered pages, each a sheet and a surface (worksheet or key). A sheet has a key page exactly when its registration has `hasAnswerKey` and its request includes the answer key. Placements: `grouped-end` (default), `after-each-sheet`, `none`.
  - **Session additions:** the packet reducer gains the packet paper (Letter or A4; an empty packet adopts its first sheet's paper) and the key placement; neither changes a stored document. The panel shows a Paper choice and an "Answer keys" radio group with the three labels.
  - **Paper only (D21's tweak):** each page renders its stored document with the packet paper in place of its stored paper, for display only; items and answers are unchanged because no generator reads `options.paperSize` (generators read only `printScale`), and each sheet keeps its stored scale.
  - **Preview and print:** "Preview packet" (disabled while the packet is empty) replaces the single preview with `PacketPrintView`, which focuses its heading; exactly one `.print-workspace` is mounted. Its controls hold "Print packet (N pages)", which calls `window.print()` once, and "Back to worksheets". Each page is one `.print-surface` with `data-packet-page`, `data-sheet-id` (the document's `worksheetId`), `data-surface`, `data-paper-size` and `data-print-scale`. Printing and cancelling never change or clear the queue.
  - **Key label:** `AnswerKeyView`'s optional `sheetLabel` renders one `span[data-packet-sheet-label]` inside the key's `h2` in both branches (the list key and `OperationGridAnswerKey`), naming the sheet number, family and, when that worksheet prints one, the nickname; without the prop its markup is unchanged.
  - **Print CSS:** `print-packet.css`, imported statically by `PacketPrintView.tsx`, adds `break-before: page` to every packet surface after the first and uses the packet paper's existing named page; no other print file, token or renderer changes.
  - **Deletion disclosure:** `ProfileList` takes an optional `queuedSheetCount(profileId)`; when it is above 0 the delete dialog says how many queued sheets belong to that profile and that they stay in the packet. Deleting leaves them queued, labeled "for a removed profile".
- **Done when:**
  1. **`compose.test.ts`:** one fast-check property of about 200 runs over 0 to `PACKET_SHEET_LIMIT` sheets with mixed key applicability checks the page count and order under all three placements, plus fixed cases: grouped-end puts every key after every worksheet in sheet order, after-each-sheet interleaves, none has no key page.
  2. **`PacketPrintView.test.tsx` and `packet-session.test.ts`:** pages render in composed order with the packet paper on every surface and each sheet's stored scale; changing the paper leaves every stored document deep-equal; a key heading carries the label only with `sheetLabel` and `AnswerKeyView` is otherwise unchanged; an Operation Grid, a Clock Explorer and a Tally Detective key heading carry the label too; Print packet calls the stubbed `window.print` once and the queue is unchanged afterwards.
  3. **`ProfileList.test.tsx` and `PacketPanel.test.tsx`:** the delete dialog shows the count sentence for 1 and for 3 queued sheets and none for 0; after the profile is removed its queued sheets stay and are labeled for a removed profile.
  4. **`packet-print.spec.ts`** holds exactly three tests; the sheets are assembled with the existing `appServer` fixture (`seedConfig` for fictional profiles and defaults), the print spec's seed stub fixing each sheet's seed, and one `packet-controls.ts` helper call (a session-only queue has no seeding route and no production test seam is added):
     - two maximum-length cells, ten sheets each with keys grouped at the end: Letter with standard-scale sheets, and A4 with large-scale sheets;
     - in each cell, the `pdf-lib` page count equals `composePacketPages(...).length`, the `[data-packet-page]` sheet ids in DOM order equal the queued order, every surface holds its required content with no clipped instructional text through `print-checks.ts`, and every key heading carries its sheet label;
     - one calibration: `break-before: auto !important` on packet surfaces lowers the PDF page count;
     - `ci-contract.test.ts` gains one case listing exactly three `packet-print.spec.ts` rows through a filter no `print.spec.ts` row matches, and rejecting skip, only and fixme in that spec.
  5. **`release-smoke.spec.ts`:** one new compiled packet print `test()`, titled without example ids, nicknames or interest words, queues two keyed sheets, previews, prints with keys at the end, and the packet PDF has 4 pages with the queue unchanged after printing; the log-privacy calibration's count oracle already reads the release-smoke project's listed test count (plan 01 Step 18), so this separate test needs no calibration change.
  6. Full gate: after merge, build-phase runs npm --prefix frontend run check once in the main checkout; Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 31

### Step WF1: Retained-store transition observation
- **Status:** PENDING
- **Type:** operator
- **Issue:** none; source manual alias retained
- **Problem:** After the relevant pushed build, operator may make a dated private backup of the retained UAT mirror and TEMP working file. Agents never read/run/copy/move that retained store or launcher. Operator starts it from local handoff, confirms profiles/nicknames/interests preserved, earlier-settings seeding until first explicit defaults save, and exactly one byte-identical v1 backup beside the live store on upgrade. No reset/reseed.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** none


### Step WF2: Worksheet-first screen review
- **Status:** PENDING
- **Type:** operator
- **Issue:** none; source manual alias retained
- **Problem:** Use build then manual:print with disposable fictional profiles. Worksheet type primary, five writing variants and vocabulary labels, practice focus operations/range, More options only secondary choices, no age/Difficulty. Historical progression into later code does not substitute for explicit screen acceptance evidence.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** none


### Step MA2: Math screen review before packets
- **Status:** PENDING
- **Type:** operator
- **Issue:** none; source manual alias retained
- **Problem:** Use build then manual:print. Carrying/borrowing is a practice choice; fact-family help clear; Number Bonds distinct; default no make/cross-ten is explicit; unavailable-state remedies actually work. Operation Grid (34): operation, size, presets and given-cell styling clear, key readable. Clock Explorer (35) and Tally Detective (36) receive this review too, and Optional27 if built. Operator review precedes packet run underP10, except that P6 (2026-10-28) waives it as a code-dispatch gate for Steps 35, 36, 31 and 33.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** Step 34


### Step PK1: Session packet screen review
- **Status:** PENDING
- **Type:** operator
- **Issue:** none; source manual alias retained
- **Problem:** After31/33 and plan release verification, assemble10 sheets across three fictional children; reorder/remove, choose paper and key placement, preview/print, reload. Labels/keys clear; session-only loss understood; reload empties queue and nothing persists after harness exit.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** 33


### Step M1: Physical print acceptance across shipped features
- **Status:** PENDING
- **Type:** operator
- **Issue:** #10
- **Problem:** Build and manual:print with three canonical fictional profiles; use current worksheet choices, not removed age/profile gates. Current Edge and Chrome on Windows11, Letter andA4 each at100%, standard/large. Every shipped family, both Wow variants, all five Sentence variants with both vocabularies, Dry Math within100 with carry/borrow and families3/12 multiplication/division, Count/Compare within20 Theme Space/art off, Number Bonds sentences and optional pictures, Operation Grid 10 × 10 multiplication (Diagonal first), 12 × 12 addition at standard on Letter and A4 and 10 × 3 powers at large, each with keys; grid given cells distinguishable in monochrome, blank boxes fit handwritten digits. One legible page, intact groups/cells, no clipping/blank pages; art-off preserves instructions; personalized-off hides nickname/interests in print. Keys recompute and match IDs; ×/÷ unambiguous, two-digit boxes/circles and three-digit underscore handwriting space. Review Count/Compare prompts/isolated numerals, monochrome clarity and larger response space. After packet33 also print10-sheet Letter packet grouped keys, each surface separate; record same-title key matching limitation. Record printer/browser/settings and generic pass/fail without named worksheets. Stop fictional harness withCtrl+C.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** none


### Step M2: Family usability pilot
- **Status:** PENDING
- **Type:** operator
- **Issue:** #13
- **Problem:** Use retained operator setup under user control; choose writing activity/practice focus per child without editing identity profiles. Observe instructions, vocabulary and Statements labels, interest engagement, space, earlier settings and explicit regroup/fact-family/Problem style and Operation Grid operation/size/preset understanding. Rate too easy/just right/too hard privately; app stores no performance history. Stop if frustration rises. Two-child existing pilot cannot certify broader age/readiness claims. After packet33 review assembling a week for two children, Add/labels/paper/keys and acceptability of reload loss. Non-identifying product notes only; no profile files/named worksheet attachments. Stop server after use.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** none


### Step M3: Exact pushed-commit Ubuntu CI acceptance
- **Status:** PENDING
- **Type:** operator
- **Issue:** #13
- **Problem:** After separately authorized repo-update/release:verify and push, require named current branch and exact local HEAD; locate ci.yml event=push with matching headSha/headBranch, retain URL, watch --exit-status. Ubuntu24.04 must load.node-version, locked frontend install, Chromium, POSIX owner-mode and mandatory DOM/PDF geometry and check. On failure retain failed log link and return fix to owning step before rerun. No pending CI observed or invented by cleanup.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** none


### Step F1: Mini Mission
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** First separate off-page movement, sorting, measuring, sound or observation task with small record box; source educational basis and print/answer semantics before implementation.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F2: Skip Counting and Number Patterns
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** Bounded sequences with one unambiguous rule, enough givens and unique missing values; independent answer/capacity/print proof.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F3: Equal Groups and Arrays
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** Reviewed instructional diagrams relating groups/rows to multiplication; preserve facts bounds and required visuals under art-off.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F4: Place Value Build and Compare
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** Tens/ones compose/decompose/compare, reviewed base-ten visuals and response geometry.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F5: Broader content packs
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** Separate patterns, shapes, measurement, rhyme, letter sounds, story sequencing and observe-predict-draw science designs; not one broad v1 rewrite.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F6: Interest-related instructional icons
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** Separate instructional change for Wow and Count/Compare, beyond already-shipped decorative Theme. Preserve quantities, answers and accessibility; review provenance.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F7: Optional future runtime AI
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** Parent toggle only after explicit future privacy/security design; local default/fallback, names stay on-device, only explicitly selected broad interest tags outbound, structured output validated and mathematics recomputed locally, parent preview before print. No dormant v1/runtime scaffolding.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none


### Step F8: Possible durable packet increment
- **Status:** DEFERRED
- **Type:** planning
- **Problem:** P4 and old draft API/store/recovery/schema proposals are superseded byP9 and are not active work. Reconsider only if operator explicitly selects persistence later; archival design is provenance, not implementation authority.
- **Produces:** Separately reviewed bounded feature proposal with contracts, smoke and actual acceptance gates.
- **Done when:** Explicitly selected and designed; no implementation implied by roadmap retention.
- **Depends on:** none

### Decision Inventory

| ID | P/D | Choice | Status |
|---|---|---|---|
| P1 | P | One master, exact source archives, docs consolidation and affected references | stands |
| P2 | P | Resolve duplication/sequencing while preserving distinct requirements | stands |
| P3 | P | P9 session-only packets and P10 per-plan screen review | stands |
| D1 | D | Initial plan is substrate spine; keep source step IDs for active code | stands |
| D2 | D | Separate seven manual acceptance units from completed code | stands |
| D3 | D | Keep source line-citation/audit allowance attached to exact archive bytes | stands |
| D4 | D | Model hour ranges; optional/deferred work disabled until selected | stands |
| P4 | P | Step 34 Operation Grid: operations x + y, x × y, x^y; customizable size, 10 × 10 default; pre-filled count input with Random/Diagonal/density presets; key prints the completed grid | stands |
| P5 | P | Powers capped at exponents 1..3 (cells ≤ 1,000); grid maximum 12 × 12 | stands |
| D5 | D | Grid defaults: Multiplication, 10 pre-filled cells, Random placement | stands |
| D6 | D | Illegal grid selections are refused with a binding-limit remedy, never auto-clamped | stands |
| D7 | D | One grid per page; length choice hidden; decorative art off for the family | stands |
| D8 | D | Step 34 builds before MA2 with --reviewers code (§6 lean ruling) | stands |
| D9 | D | First visual batch: on-the-hour clocks and grouped tallies; other activities remain backlog | stands |
| D10 | D | Four problems per page; canonical hidden options; retain stored choices for switching back | stands |
| D11 | D | Numeric clock hours 1..12 and tally totals 1..20; SVG ink and geometry calibration | stands |
| D12 | D | Steps 35 and 36 run sequentially after MA2; Step 37 is the parent trial | amended by P6 (MA2 no longer gates dispatch) |
| P6 | P | MA2 is waived as a code-dispatch gate for Steps 35, 36, 31 and 33; MA2 stays PENDING and also reviews Clock Explorer and Tally Detective | confirmed by operator (2026-10-28) |
| P7 | P | Build order 35, 36, 31, 33: packets are built last and cover all eight families | confirmed by operator (2026-10-28) |

## 11. Compute target

Node>=24<25/npm>=11<12, React19/TypeScript6/Vite8/Fastify5. frontend is the single package. Windows operator, Ubuntu24.04 Chromium CI; physical Edge/Chrome Letter/A4 acceptance distinct. npm --prefix frontend run build; npm --prefix frontend run manual:print for disposable fictional checks; npm --prefix frontend run check for full gate. No new dependencies. React owns the interactive state; TypeScript shares domain contracts; Zod validates config; Fastify serves the loopback API; Vite builds browser assets; Vitest checks in-process behavior; Playwright drives the compiled browser and print surfaces; fast-check drives property tests, axe-core checks accessibility in Playwright, and pdf-lib counts printed PDF pages. These retain the single-package stack and existing contracts.

Quickstart in a separately selected fictional development environment: `npm --prefix frontend install`; `npm exec --prefix frontend -- playwright install chromium`; `npm --prefix frontend run dev`; open `http://127.0.0.1:4311`; stop with Ctrl+C. No accounts, secrets or database setup. First explicit valid save creates local config; never seed over existing user data. Run `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, `npm --prefix frontend test`; `run check` includes compiled browser checks. Production: `npm --prefix frontend run build`, then `npm --prefix frontend start`.

Inline contract summary (verified in shared/config/schema.ts, shared/worksheet/types.ts and web/generator/create-session.ts):

| Type / identifier | Fields and owner |
|---|---|
| WorksheetDocumentV1 | schemaVersion:1, worksheetType: family slug, generatorVersion:number, seed:SeedHex, worksheetId:string, request:GenerationRequestV1, items:readonly typed items. Immutable snapshot; answers belong to each objective item. |
| GenerationRequestV1 | worksheet family, resolved capabilities/options and practice selection; each family validates/project-request narrows unsupported fields before generation. |
| GenerationOptionsV1 | length, includeDecorativeGraphics, includeAnswerKey, paperSize:letter/a4, printScale:standard/large, optional decorativeTopicId; carried as request.options. |
| OperationGridItemV1 | itemType:operation-grid, operation:addition/multiplication/powers, rowHeaders/columnHeaders from 1, cells row-major {value, given}, answer {kind:grid, value: every cell}. One item per document. |
| NumberBondItemV1 addition | form:bond, whole:number, leftPart:number, rightPart:number, missing:left/right. Whole2..20, positive parts sum to whole; exactly one part blank. |
| Queued sheet | profile id plus immutable generated document; its worksheetId detects duplicate documents. Max10; order only in React reducer state. |
| ChildProfileV2 | lowercase UUIDv4 id, optional bounded displayName, reviewedOn ISO date, unique bounded interests, optional read-only legacyChoices. No age/current ability gates. |
| AppConfigV2 | schemaVersion:2, profiles:ChildProfileV2[], defaults:WorksheetDefaultsV2 (selection and useEarlierChildSettings). Strict unknown-key refusal. |
| ConfigResponseV2 | config:AppConfigV2 and storedSchemaVersion:1 or2, so reading v1 does not write it. |

Profile id and worksheetId are UUIDv4 strings generated with browser crypto.randomUUID by ProfileEditor and create-session respectively; packet rows retain existing IDs rather than minting replacements. Worksheet family slug is one of dry-math, find-the-wow, sentence-builder, count-compare-make, number-bonds, operation-grid. Item identity and problem deduplication remain family-specific typed/oracle contracts.

No packet API is introduced. Existing GET /api/config returns ConfigResponseV2 and ETag; PUT /api/config accepts validated AppConfigV2 under the session/precondition guards and returns ConfigResponseV2 with new ETag. Config conflict/error codes stay in server/routes/config.ts; no packet action calls PUT. Recovery and session-bootstrap routes remain unchanged; the existing README describes the private-file recovery boundary. GET /api/session returns the in-memory `SessionResponse` token and GET /api/health returns `HealthResponse` (`status`, `version`); no step 27/31/33 adds or changes a route.

## 12. Time budget

[Estimates](build-estimates.json) split worker and attention hours, with the master hash they were estimated against (not refreshed on plan edits; they predate Step 34) and model provenance. Manual printer/family/browser availability is elapsed wait, not worker time. Optional/deferred designs excluded from committed delivery forecast.

## 13. What's NOT in this plan

No packet persistence/store/API/recovery, schema3, undo or per-sheet regeneration, packet scale search, new benchmark/capture/AST guards, or unattended multi-plan build chain. Those source phases are explicitly subsumed/removed underP9/P10 and lean ruling. Existing deterministic local app unaffected. Broader content/AI remains separate design, not automatic implementation. Original line-citation anchor bytes and all six canonical profile hashes remain unchanged.

## 14. Tracking

Existing issue27=#38; operation grid34=#42 (not the archived packet-plan Step 34, which was folded); packet31/33 unassigned. SourceM1=#10,M2/M3=#13; preserve open review findings#15/#18/#19 pending verified closeout rather than assuming source absorption closed issues. See merge map for every source disposition. No GitHub mutation by reconciliation. Root plan.md only redirects here.

## 15. Plan history

2026-10-14: merged initial plan and three feature plans plus three seeds; exact archived originals, current normative math/packet references and one master. Kept lean-revision precedence and all manual/deferred requirements. Public documentation moved into docs; operator screenshot retained, never inspected or exempted. Citation and release-audit producers migrated to exact archived initial source without hash repinning.

2026-10-26: operator identified the retained screenshot (the 2026-10-04 screenshot, a 10 × 10 multiplication grid with a few anchor cells) as an unplanned feature request; added Step 34, Operation Grid, ahead of MA2 so one math screen review covers it. Later the same day the operator had it moved outside the checkout to `C:/Users/abero/extra-credit-private/examples/` (sha256 unchanged, 9bb8728b...a5d7), which clears the release-audit blocker.

### Step 34 wrap — Operation Grid (2026-10-28)

**Issue #42 closed. 1118/1118 Vitest tests (40 files) and 206/206 Playwright specs passing; lint, all three typecheck projects and log-privacy calibration (1/1/0) clean.**

What was built:
- `operation-grid` ("Operation Grid"), the sixth worksheet family: one addition, multiplication or powers table per page with an operator corner cell, row and column headers, seeded pre-filled anchor cells and empty boxes for the rest; the answer key prints the completed grid with given cells still distinguishable.
- Parent controls: Operation (`x + y`, `x × y`, `x^y`), Rows and Columns (2..12, default 10 × 10), Placement (Random or Diagonal first) and a Pre-filled cells input with Nearly blank / Half / Mostly filled / Diagonal presets that round down and always leave a blank.
- Fail-closed bounds with binding-limit remedies: powers use bases 1..10 and exponents 1..3 (cells ≤ 1,000); Diagonal first needs a square addition or multiplication grid; large print is offered up to 10 × 10.
- Persistence: an additive schemaVersion 2 `operationGrid` group with Zod defaults (`multiplication`, 10 × 10, 10 pre-filled, `random`), saved only by the worksheet-defaults save; no migration or version bump.
- Proof: an independent arithmetic-oracle arm, a seeded generator with a ~200-run property and a mirror-placement case, a per-rule negative for every item-2 invariant, renderer and key tests read from the DOM, `operation-grid.spec.ts`, four new print rows (`grid-multiplication-10`, `grid-addition-12` on Letter and A4, `grid-powers-10x3`) plus keys with a collapsed-cell calibration, and one compiled release-smoke case.

Files changed (`8b2546a`, 50 files):

| Area | Files |
|---|---|
| New family | `frontend/src/worksheets/operation-grid/{definition,generator,generator.test}.ts`; `frontend/src/web/worksheets/operation-grid/{Renderer,Renderer.test}.tsx` |
| Shared domain | `frontend/src/shared/worksheet/{types,answer-oracle,invariants,project-request,registry}.ts` and tests; `limit-labels.test.ts` |
| Config and transport | `frontend/src/shared/config/{enums,schema,defaults,earlier-settings}.ts`, `migrate.test.ts`; `frontend/src/server/transport-schemas.ts` |
| Web | `GeneratorControls.tsx`, `worksheet-session.ts`, `AnswerKeyView.tsx`, `worksheets/registry.ts`, `styles/{tokens,screen}.css` and their tests |
| Tests and fixtures | `tests/oracles/arithmetic-oracle.ts`; integration `arithmetic-oracle`, `schema-parity`, `shipped-profile-options`, `ci-contract`, `practice-golden`; `tests/fixtures/{profiles.ts,print/matrix.ts,print/required-content.ts}`; e2e `operation-grid`, `print`, `accessibility`, `release-smoke`, `fixtures/{grid-table,worksheet-controls}.ts` |
| Docs | `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md` (91 worksheet cases, 23 keys, 114 surfaces), this plan's §11 |

Fresh context notes:

| Topic | Detail |
|---|---|
| Re-pinned golden | `tests/fixtures/profiles.ts` re-pins the upgraded-v1 SHA; the only byte change is the defaulted `operationGrid` key. |
| Carrying in grids | Operation Grid sums carry by construction; CLAUDE.md's "every other page stays free of carrying" sentence names it as the exception. |
| Ceiling check | `operationGridCellWithinCeiling` is defense in depth: the request guard and exact recomputation reject a powers cell above 1,000 first, so it is tested directly as a predicate. |
| Load-sensitive tests | Under heavy machine load (a game running) `foundation.spec.ts`'s supervisor-close and fixed-dev-stack tests and `print.spec.ts`'s manual-print startup test time out; each passes in isolation and on a quiet machine. |
| Untracked files | Any untracked personal file in the checkout (screenshot, reference PDF) fails `check` as `PERSONALIZED_ARTIFACT`; the operator's references live in `C:/Users/abero/extra-credit-private/examples/`. |


## Phase V: Visual math first batch

Objective: add four-problem on-the-hour clock and grouped-tally worksheets through the existing Create / preview / print journey, then obtain a short parent trial before selecting the next batch.

Publication scope for this prep run: Phase V Steps 35-37 only; use `/repo-sync --plan docs/plans/master_plan.md --phase V --scope steps`. Do not create, update, or close other-track issues. Execution scope is `/build-phase --plan docs/plans/master_plan.md --steps 35,36`; Step37 is the subsequent operator trial. Existing MA2 must be completed before Step35 starts (waived as a dispatch gate by P6, 2026-10-28). Packet Steps31/33 retain their own dependencies and are not selected by this expansion. The code steps are sequential because they share projection, registry, key, and print-test interfaces.

Specification: [visual math expansion](visual-math-expansion-plan.md). The master alone owns step IDs, statuses, dependencies and issues; the linked specification is technical context and the fourteen-activity backlog, not another execution queue. Operation Grid is already merged at `8b2546a`; no parallel worktree remains. The supplied seed/PDF are preserved outside the checkout with original hashes verified; the focused release-audit test passes (one test,67 filtered out). Reference images are not a runtime or build prerequisite: the specification includes every required mathematical example. No new dependencies or schema migration.

Validation: tiny-domain unit tests, production-caller generation, compiled browser/print evidence and full `npm --prefix frontend run check` after each code step. Print tests include SVG ink/geometry negative calibration. Prior accepted counts must not regress. Effort: two family-sized code slices plus a short operator trial; no wall-clock promise. Kill criterion: failed mathematical or print invariants, changed retained private data, or an unresolved required gate. Backout: retain the previous app/config bytes; never reset profiles.

### Phase V implementation contract

New family IDs are `clock-explorer` and `tally-detective`, generatorVersion1 each. Sample four distinct hours1..12 or totals1..20 using the existing seeded RNG. Clock item: id, itemType, answerability objective, hour, numeric answer(hour). Tally item: id, itemType, answerability objective, bundles=floor(total/5), remainder=total%5, numeric answer(5*bundles+remainder). IDs use existing `item-001` sequence; document/profile IDs remain browser-generated UUIDv4, seeds nonzero eight-lowercase-hex strings. No new answer kind or persisted settings group.

Clock: all12 labels; minute hand at twelve, shorter distinct hour hand at30*(hour%12) degrees clockwise from twelve. At12:00 longer minute hand remains visible past overlapping hour hand. Blank child response is `Time: ____ :00`; key formats e.g. `3:00 - long hand at12, short hand at3`. Tally: each full five is four upright strokes plus a crossing fifth; 0..4 loose strokes follow. Reference8=5+3;20=four full bundles. Independent oracle recomputes numeric answers; validate exactly four same-family sequential items, unique problems, domain bounds and canonical request.

Projection: force length standard, decoration false, absent topicIds/decorativeTopicId/practice, inactive writing/math fields copied from existing shared constants. Hidden stored values stay intact for switching back. Changing unrelated options/profile legacy values with same seed and applicable options must leave entire request/content identical. Controls: name opt-in, key inclusion, paper and scale only; fixed count4, NO_MAXIMUMS, sufficient capacity and truthful fixed-domain exhaustion message. Existing Make another uses16 attempts; no hidden range advice. Save only explicit defaults; older versions block unknown family IDs without rewriting data. No profile migration/reset.

Use local family renderers with inline SVG; no external URLs or assets. Standard/large print retains16/18pt instructions,7/9mm response lines; start dials around40/45mm and verify rather than shrink below legibility. Check every SVG hand, outline, tally upright/crossing under print media for actual ink, effective visibility/opacity, positive stroke width, correct endpoints/orientation and containment. Hiding a stroke or zeroing width must fail while box stays intact, then restoration passes. Four cards and separate parent key each fit one Letter/A4 page.

Integration: extend shared/worksheet types, registry, project-request, invariants, answer-oracle; web worksheet registry, GeneratorControls, AnswerKeyView and tokens; schema/default/transport consumers only as required by new enum members. Extend requiredPrintContent titles/prompts/blanks/formatted keys; explicit no-extra-choice branches in chooseWorksheetChoices; golden coveringGroup entries undefined (no legacy group), unchanged golden JSON/hash. One fixture/family expands to4 child cases+4 key surfaces. Current baseline91 child/23 key/109 discovered print tests; update exact deltas against source, retaining all old rows. The print helper already guards hidden Length. Unit-check all12 hours/all20 totals, several deterministic seeds, malformed inputs and request noninterference; then compiled Create/key/print flow and complete check.

Run setup/test commands in section 11; disposable `npm --prefix frontend run manual:print` after build supplies fictional profiles and exact ephemeral URL, stop with Ctrl+C. Source summary, fourteen-activity/reference-page inventory, backlog, impacts and full design rationale are in the linked specification. It is reference material, not an independent status queue.

### Step 35: Print on-the-hour clock practice
- **Status:** DONE (2026-10-29)
- **Problem:** A parent can generate a four-clock page through the existing app.
- **Type:** code
- **Issue:** #43
- **Flags:** --reviewers code --isolation worktree
- **Files:** frontend/src/worksheets/clock-explorer/{definition.ts,generator.ts,generator.test.ts}, frontend/src/web/worksheets/clock-explorer/{Renderer.tsx,Renderer.test.tsx}; shared types/registry/projection/invariants/oracle; enum transport/default consumers as necessary; web renderer registry/controls/key/tokens; associated unit, schema parity, integration, E2E and print fixtures, including `practice-golden.test.ts`, `ci-contract.test.ts`, and `print.spec.ts`; README.md, CLAUDE.md, docs/educational-basis.md and docs/testing-print.md.
- **Existing context:** Phase V uses the current local app, immutable seeded documents, shared generator and renderer registries, and separate parent key. Full contracts and exact affected paths: [visual math specification](visual-math-expansion-plan.md), especially sections 4-6 and 9.
- **Produces:** Four seeded, distinct, on-the-hour clocks with writable time answers and matching separate key.
- **Done when:** Through the compiled app, select Clock Explorer, Create, preview child page, switch to key, print each surface; each is one page on Letter/A4 at standard/large scale. All twelve hours have tested hand angles and correct key text; 12:00 remains readable, 3:00 has long hand at twelve and short hand at three. Child surface has no filled answer. Same request/seed reproduces content, malformed hours/wrong answers/duplicates/mixed-family items fail, Make another changes content or reports existing exhaustion truthfully without recommending unavailable controls. The canonical-request noninterference contract in the visual math specification section 6 passes, including switching families and restoring stored choices. Saving/reloading a fictional profile config retains the new family without mutating identity; old config reads unchanged and schema parity/fingerprint checks pass without repinning. Diagram survives art-off; removing either hand's ink or making its stroke width zero fails the family print oracle, then restoring it passes. Keyboard selection and narrow-screen controls work. Golden-grid base-only registration and exact print/CI discovery deltas are updated without changing historical golden bytes. Existing family tests and the required full check pass.
- **Depends on:** Step 34 (DONE). The MA2 dispatch gate is waived by P6 (2026-10-28); MA2 stays PENDING. No technical dependency on packets or optional Step 27.

### Step 36: Print grouped-tally practice
- **Status:** DONE (2026-10-29)
- **Problem:** A parent can generate a four-problem tally page through the existing app.
- **Type:** code
- **Issue:** #44
- **Flags:** --reviewers code --isolation worktree
- **Files:** frontend/src/worksheets/tally-detective/{definition.ts,generator.ts,generator.test.ts}, frontend/src/web/worksheets/tally-detective/{Renderer.tsx,Renderer.test.tsx}; corresponding shared, selection, renderer, key and print integration from Step 35; unit/E2E/print fixtures and shipped-family docs.
- **Existing context:** Phase V uses the current local app, immutable seeded documents, shared generator and renderer registries, and separate parent key. Full contracts and exact affected paths: [visual math specification](visual-math-expansion-plan.md), especially sections 4-6 and 9.
- **Produces:** Readable grouped tallies, blank answer lines, and decomposed parent answers.
- **Done when:** Compiled-app selection/Create/key/print works on both paper sizes/scales with four intact cards per child page and a separate key page. Independently count rendered strokes for every quantity1..20, especially4/5/6/10/19/20; each group of five has four uprights plus a crossing fifth. The reference8 renders5+3 and keys8; four full bundles key20. Corrupt counts/remainders/answers/duplicates/mixed-family items fail. Removing the crossing stroke's ink or setting its width to zero fails the print oracle even while the SVG bounding box remains; restoration passes. Canonical-request noninterference, seed repeatability, Make another, explicit default save/reload, art-off, keyboard/reflow, and existing-family behavior pass through the same callers as Step 35. Golden-grid base-only registration and exact print/CI discovery deltas reflect this family without changing historical golden bytes. Full check passes.
- **Depends on:** Step 35 (serialize shared-interface edits).

### Step 37: Try the printed first batch
- **Status:** PENDING
- **Problem:** Establish whether the pictures and response space work for actual use before choosing more activities.
- **Type:** operator
- **Issue:** #45
- **Files:** No code artifacts; optional private observation notes only.
- **Existing context:** Phase V uses the current local app, immutable seeded documents, shared generator and renderer registries, and separate parent key. Full contracts and exact affected paths: [visual math specification](visual-math-expansion-plan.md), especially sections 4-6 and 9.
- **Produces:** Parent judgment on clarity, spacing, interest, and the next batch.
- **Done when:** Parent prints one page from each family at100%, reads each prompt aloud once, and records which visual cues or response spaces need adjustment. Confirm clock hands remain distinct and crossed tally bundles remain legible in grayscale; observe whether four problems feel comfortable. Record confusion as design feedback, not a skill assessment. Choose retry/revise or the next activity; automated tests cannot substitute for this decision.
- **Depends on:** Step 36 and a running accepted build under parent control.
