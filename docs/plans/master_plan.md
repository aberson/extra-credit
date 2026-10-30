# Extra Credit master plan

## 1. What This Is

Reconciled 2026-10-14.

Objective: preserve the deterministic, local worksheet product, finish retained acceptance and packet work, and add the selected visual-math first batch (Phase V).
Proposal: docs/plan-redline/extra-credit-proposal.html

Original bytes preserved with hashes and initial Git state (kept privately outside the checkout at `C:/Users/abero/extra-credit-private/plan-reconciliation/source-map.json`, operator decision HP5 A4). All originals remain merged archives because manual acceptance or deferred requirements remain; code-DONE is not release-complete.

- [plan.md](../archived-plans/plan.md)
- [docs/math-activities-plan.md](../archived-plans/documentation__math-activities-plan.md)
- [docs/printable-packets-plan.md](../archived-plans/documentation__printable-packets-plan.md)
- [docs/worksheet-first-plan.md](../archived-plans/documentation__worksheet-first-plan.md)
- [docs/feature-seeds/01-worksheet-first.md](../archived-plans/documentation__feature-seeds__01-worksheet-first.md)
- [docs/feature-seeds/02-math-activities.md](../archived-plans/documentation__feature-seeds__02-math-activities.md)
- [docs/feature-seeds/03-printable-packets.md](../archived-plans/documentation__feature-seeds__03-printable-packets.md)

Binding [operator decisions](../feature-seeds/operator-decisions.md): P9 supersedes P4 durable drafts; P10 supersedes P7 unattended multi-plan chain. Lean kept step fields supersede old appendix/decision rows.

Current build scope (2026-10-28, master Decision Inventory P6/P7, distinct from operator-decisions.md P6/P7): Steps 35, 36, 31 and 33, built in that order and DONE on 2026-10-29; Step 37 and the operator steps follow. Earlier track statuses and acceptance gates remain authoritative. Phase H (harder practice, planned 2026-10-29): Step 38, the Random packet, is built on the `random-packet` branch; Steps 39-55 and the HR1 screen review follow after plan review, redline, wrap and issue publication.

## 2. Vision

Local parent-facing personalized printable practice, with deterministic worksheet-first choices, preserved identity profiles and printable session packets. Initial plan is the substrate spine; follow-on milestones refine it without reactivating superseded designs.

## 3. Principles

No accounts, cloud services, telemetry, runtime AI or background scheduler in current product. Names/interests remain private. Fixed loopback4310/4311 is not OS-user authentication; stop after use. Immutable documents bind work and answers; finite capacity fails closed, no hidden widening/duplicates. Required visuals and response dimensions survive decoration toggles. MIT root license and full asset provenance unchanged. No real family data, screenshots or profiles in tests/issues/public release. Preserve all user files; cleanup grants no implementation or publication authority.

## 4. Glossary

Worksheet choices are session state; explicit worksheet-defaults save persists global choices. Profiles are identity-only, with preserved legacy choices for initial seeding. Packet means session-only ordered immutable documents, not durable draft. UAT means actual observation; CI means exact pushed-commit check. Source plan01/02/03 aliases remain useful in history, but this master owns dispatch.

## 5. How to read this plan

Each leaf carries status/type/scope/output/acceptance/dependency. Canonical short IDs key dispatch and build-estimates.json; WF1/WF2/MA2/PK1 retain source aliases WF-1/WF-2/MA-2/PK-1. Source issue numbers retained. Four code leaves 27/31/33/34 (34 DONE) keep full acceptance inline; math and packet supporting contracts supply exact referenced rules without old queues. All source line citations target the immutable archived initial plan; that historical specification is not current status authority. `Type: planning` (F1-F8) marks a deferred design placeholder that `/build-phase` never dispatches; selecting one first replaces it with reviewed code/operator steps. Tags such as K1-K13, DD10, D21 and D48 are provenance labels from the archived source plans; the step text is the complete requirement.

## 6. Execution mode

P10: one track/window at a time with its operator screen review before the next (amended by HD5 for Phase H: no per-track review; one screen review, HR1, follows Step 55; each Phase H track still runs as its own `/build-phase` run in a fresh window). Build eligible named steps only, never entire master. Existing flags --reviewers code --isolation worktree; no runtime/deep/UI lanes without separately designed fictional exercise. Narrow iteration suites; once-per-step post-merge full check, counts no lower than prior step. release:verify once per plan at separately authorized repo-update. No new AST/grep guards, fingerprint repins, golden capture suites or privacy gates. Before build: ports4310/4311 free, retained launcher stopped, Test-Path config/children.local.json false, metadata only. Never inspect/copy/move/delete config/uat-session or retained TEMP store.

## 7. Track structure

Shipped substrate 1-19, math 24-26 and Operation Grid 34; retained acceptance WF1/WF2,MA2,M1/M2/M3. Optional math27; packets31 then33 built after Phase V 35/36 (P6 waived the MA2 dispatch gate; MA2 still PENDING), and packetPK1 afterward. Phase H (harder practice): random packet 38 built, then 39-55 sequentially and HR1. Future scoped content remains deferred. Plan03 code depends on shipped19, not optional27; current orchestration still honors inter-plan screen review, except that Phase H waives its per-track review for one HR1 after Step 55 (amended by HD5).

Track **goal/scope** is its leaves; **prerequisites** are explicit; **tests/validation** are Done-when and existing full check; **effort** is sidecar ranges; **gate** distinguishes code from actual acceptance; **kill criterion** is changed private state, weakened invariant, unresolved architecture or failed required evidence; **rollback** retains previous store bytes/outputs and isolated candidates, never resets profiles or replays superseded migration.

## 8. Decision graph

```text
DONE1-13 ->DONE14-19 ->DONE24-26 ->DONE34 ->DONE35 ->DONE36 ->DONE31 ->DONE33 ->PK1
                                  \ optional27 ->MA2 re-review
DONE34/35/36 ->MA2 screen review (P6: not a dispatch gate); DONE36 ->37 operator trial
Shipped surfaces ->M1 physical ->M2 family
Each authorized release: release:verify ->push ->M3 exact Ubuntu run
WF1/WF2 acceptance evidence remains explicit, not inferred from later code
DONE33 ->DONE38 random packet ->39 ->40 ->...->55 ->HR1 (Phase H, sequential; HP3 waives the Step 37 hold on clock times)
```

## 9. Baseline

As of reconciliation (2026-10-14): HEAD `268183162e3fe9a4778bc8d8fc07544872ff7331`. Initial untracked operator screenshot preserved byte-for-byte; it is a pre-existing release-audit blocker, not a privacy exemption. Steps1-13 and14-19 DONE;20 folded into18;21 folded into24;22/23 removed;24/25/26 DONE, latest source gate1047 Vitest/195 Playwright. Optional27 not built. Packets31/33 not built, issues not assigned;28-30 removed; 32 and the archived packet plan's Step 34 (packet smoke/docs) folded into 31/33. The master's Step 34 is a different, later unit: Operation Grid (#42), DONE at `8b2546a`. Age/Difficulty/profile capability gates replaced by worksheet choices; no schema3. Additive v2 keys use defaults; removals/renames require explicit version/read path; blocked unknown-key/enum state preserves bytes. Existing quantity/Wow<=20; symbolic add/sub<=100; factors0-12/exact dividends<=144. Regrouping explicit, no negative answers. No automated history establishes physical/family/hosted CI acceptance. Since then: Step 34 (Operation Grid, #42) merged at `8b2546a`; the operator screenshot now lives outside the checkout at `C:/Users/abero/extra-credit-private/examples/`, so it is no longer a release-audit blocker; Step 34's full gate was 1118 Vitest (40 files)/206 Playwright. Since then (2026-10-29): Steps 35 (Clock Explorer, #43, `ec33261`), 36 (Tally Detective, #44, `ed1a03c`), 31 (session packet queue, #47, `4bc6607`) and 33 (packet preview and print, #48, `4ec5733`) merged; the latest accepted full gate on `main` is 1356 Vitest (49 files)/232 Playwright. Step 38 (Random packet) passed 1403 Vitest (51 files)/233 Playwright on the `random-packet` branch. After its merge, one `npm --prefix frontend run check` on `main` records its counts here as the Phase H floor (they must not be below 1403 Vitest (51 files)/233 Playwright), and no Phase H step's full gate may fall below that floor.

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
- **Status:** DONE (2026-10-29)

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
  - **Session additions:** the packet reducer gains the packet paper (Letter or A4; an empty packet adopts its first sheet's paper) and the key placement; neither changes a stored document. Once the packet holds a sheet, the panel shows a Paper radio group (US Letter, A4) and an "Answer keys" radio group with the three labels.
  - **Paper only (D21's tweak):** each page renders its stored document with the packet paper in place of its stored paper, for display only; items and answers are unchanged because no generator reads `options.paperSize` (generators read only `printScale`), and each sheet keeps its stored scale.
  - **Preview and print:** "Preview packet" (disabled while the packet is empty) replaces the single preview with `PacketPrintView`, which focuses its heading; exactly one `.print-workspace` is mounted. Its controls hold "Print packet (N pages)", which calls `window.print()` once, and "Back to worksheets". Each page is one `.print-surface` with `data-packet-page`, `data-sheet-id` (the document's `worksheetId`), `data-surface`, `data-paper-size` and `data-print-scale`. Printing and cancelling never change or clear the queue. The packet preview closes on Back to worksheets, on a new single preview and when the last sheet is removed, and Add to packet is hidden while it is shown (`packet-queue.spec.ts` gains one test for this).
  - **Key label:** `AnswerKeyView`'s optional `sheetLabel` renders one `span[data-packet-sheet-label]` inside the key's `h2` in every branch (the list key, `OperationGridAnswerKey`, `ClockExplorerAnswerKey` and `TallyDetectiveAnswerKey`), after " — ", naming the sheet number, family and, when that worksheet prints one, the nickname; without the prop its markup is unchanged.
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
- **Problem:** Build and manual:print with three canonical fictional profiles; use current worksheet choices, not removed age/profile gates. Current Edge and Chrome on Windows11, Letter andA4 each at100%, standard/large. Every shipped family, both Wow variants, all five Sentence variants with both vocabularies, Dry Math within100 with carry/borrow and families3/12 multiplication/division, Count/Compare within20 Theme Space/art off, Number Bonds sentences and optional pictures, Operation Grid 10 × 10 multiplication (Diagonal first), 12 × 12 addition at standard on Letter and A4 and 10 × 3 powers at large, each with keys; grid given cells distinguishable in monochrome, blank boxes fit handwritten digits. One legible page, intact groups/cells, no clipping/blank pages; art-off preserves instructions; personalized-off hides nickname/interests in print. Keys recompute and match IDs; ×/÷ unambiguous, two-digit boxes/circles and three-digit underscore handwriting space. Review Count/Compare prompts/isolated numerals, monochrome clarity and larger response space. After packet33 also print10-sheet Letter packet grouped keys, each surface separate; record same-title key matching limitation. After Phase H (Step 55), also print on Letter and A4, standard and large, each with its key:
- three-digit addition/subtraction (four-digit blank) and division with remainders (quotient and R blanks), whose blanks fit handwritten digits;
- two-digit × one-digit multiplication and three-digit ÷ one-digit division (Step 42's three-digit blanks), whose blanks fit handwritten digits;
- Number Bonds within 100 with every problem carrying or borrowing, whose three-digit missing-number box (21 × 9 mm, 24 × 11 mm large) fits a handwritten 100;
- Count, Compare & Make "Compare numbers to 100" numeral cards with the decorative art panel on (A3), with both numbers and the three relation phrases legible and the page on one sheet;
- Operation Grid with mixed-up headers and with headers starting above 1 (offset-header grids);
- Clock Explorer five-minute and any-minute minute dials, with the hands and the 60 marks distinct in monochrome;
- Count, Compare & Make tens-and-ones pictures to 50 and to 100, with rods and cubes countable;
- Two Whats and a Wow dots to 50 in ten-wide rows;
- Tally Detective 21 to 50 in three stacked rows.

Record printer/browser/settings and generic pass/fail without named worksheets. Stop fictional harness withCtrl+C.
- **Produces:** Actual private or generic non-identifying observation record.
- **Done when:** Every required observation is recorded and genuine user judgment supplied; local automated evidence does not replace it.
- **Depends on:** none


### Step M2: Family usability pilot
- **Status:** PENDING
- **Type:** operator
- **Issue:** #13
- **Problem:** Use retained operator setup under user control; choose writing activity/practice focus per child without editing identity profiles. Observe instructions, vocabulary and Statements labels, interest engagement, space, earlier settings and explicit regroup/fact-family/Problem style and Operation Grid operation/size/preset understanding. Rate too easy/just right/too hard privately; app stores no performance history. Stop if frustration rises. Two-child existing pilot cannot certify broader age/readiness claims. After packet33 review assembling a week for two children, Add/labels/paper/keys and acceptability of reload loss. After Phase H HR1, give each child printed pages of the new harder choices and one Random packet at Harder, Challenge and Expert. Record privately whether the answer spaces fit their handwriting, and whether each level feels too easy, just right or too hard; this is design feedback, not a skill assessment. Non-identifying product notes only; no profile files/named worksheet attachments. Stop server after use.
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
| D12 | D | Steps 35 and 36 run sequentially after MA2; Step 37 is the parent trial (amended by P6: MA2 no longer gates dispatch) | changed 2026-10-28 |
| P6 | P | MA2 is waived as a code-dispatch gate for Steps 35, 36, 31 and 33; MA2 stays PENDING and also reviews Clock Explorer and Tally Detective (confirmed by operator (2026-10-28)) | stands |
| P7 | P | Build order 35, 36, 31, 33: packets are built last and cover all eight families (confirmed by operator (2026-10-28)) | stands |
| HP1 | P | Phase H scope: every harder option for arithmetic (three-digit +/−, bigger × and ÷, remainders, harder grid headers), counting and numbers (Number Bonds, Wow equations and numeral comparison to 100; tens-and-ones pictures, Wow dots and tallies past 20) and clocks (half, quarter, five-minute, any minute); Sentence Builder out of scope (confirmed by operator (2026-10-29)) | stands |
| HP2 | P | New settings only: additive v2 keys with defaults or new enum members; no widened bound, no schemaVersion 3, no migration (confirmed by operator (2026-10-29)) | stands |
| HP3 | P | Choosing clock modes waives the Phase V hold on half hours until Step 37; Step 37 stays PENDING (confirmed by operator (2026-10-29)) | stands |
| HP4 | P | App version 1.4.0 after Step 38; bump the minor version whenever a feature merges (per-step targets 1.5.0 at Step 39 through 1.20.0 at Step 55, none at Step 40, in the Phase H header) (confirmed by operator (2026-10-29); targets derived by the coordinator) | stands |
| HP5 | P | Operator answers: A1, the number in each level's hint covers arithmetic and counting only, Clock Explorer and Tally Detective are left out of the ceiling and named by their own phrase once they change by level (Step 55), and the scorer returns "not scored" for exactly those two families until then; A2, Step 55's Challenge and Expert cells replace Step 39's candidates for each family in the table, and every family keeps at least one large-print-safe candidate at every level; A3, Count, Compare & Make's numerals-to-100 mode keeps decoration (Step 49 counts the extra decoration-true rows, extends the ci-contract regex and proves the page fits with the art panel); A4, the private reconciliation folder lives outside the checkout at `C:/Users/abero/extra-credit-private/plan-reconciliation/` (confirmed by operator (2026-10-29)) | stands |
| HD1 | D | Five packet levels: Easier, Medium, Harder, Challenge, Expert; Medium stays the default (agent default; confirm at plan-redline) | stands |
| HD2 | D | Per-family constants beside `V1_NUMERIC_MAXIMUM` and `DRY_MATH_NUMERIC_MAXIMUM` in `types.ts`; neither envelope changes. Exception: `WIDE_RANGE_MAXIMA` lives in `practice-focus.ts`, because it derives from `MATH_PRESETS`, which imports `types.ts` (agent default (avoids widening Tally, ten-frames and earlier-settings clamps)) | stands |
| HD3 | D | Existing choices stay byte-identical: no generatorVersion bump, goldens and known vectors unchanged (agent default) | stands |
| HD4 | D | Sequential build 39-55 in ID order; picture modes 52-54 last among the practice steps as the largest print risk, then levels 55 (agent default) | stands |
| HD5 | D | One screen review (HR1) after Step 55 instead of one per track; P10's per-track review is waived for Phase H the way P6 waived MA2. Each track still runs as its own `/build-phase` run in a fresh window. Physical print goes to M1 and child judgments to M2 (agent default; confirm at plan-redline) | stands |
| HD6 | D | Step 55's level mapping table; Challenge and Expert cells replace Step 39's candidates, each family keeps a large-print-safe candidate at every level, and the hint wording is part of the mapping (agent default for the cells and hints; the replace rule and large-print sibling confirmed by operator (A2, 2026-10-29); HR1 decides keep or adjust) | stands |
| HD7 | D | Number Bonds "Every problem carries or borrows" is offered only for a range of 10 and up (Step 48's Wow pattern), so no shipped catalog cell starves (Step 46; spec § Design defaults, Numbers 7) (agent default (coordinator); adjustable at plan-redline) | stands |
| R1(a) | D | Keep packet code compiling when a group gains a key by spreading the exported default group (`...DEFAULT_WORKSHEET_DEFAULTS_V2.<group>` or `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)`), never the parent's `selection.<group>` (coordinator ruling (2026-10-29)) | stands |
| R1(b) | D | A new choice is named in a queued sheet's label (`packet-session.ts` `detailOf`), with a wording test in `packet-session.test.ts` (coordinator ruling (2026-10-29)) | stands |
| R1(c) | D | The parent's new Clock Explorer or Tally Detective choice, and any new choice a level's `FocusChoice` does not reset, stays out of Random packets (every sheet carries the default) until Step 55 maps the levels; Step 39's defaults-first candidates enforce it, so Steps 40-54 edit no `RANDOM_PACKET_FOCUS` row and add only leak tests (coordinator ruling (2026-10-29); ends at Step 55) | stands |
| R2 | D | One wording owner per entry list; the status line beside Create, the select option and the packet label all read it (coordinator ruling (2026-10-29)) | stands |
| R3 | D | No persisted or fixture value above its persisted bound: store today's bounded field plus a new additive key or enum member (coordinator ruling (2026-10-29)) | stands |
| R4 | D | A step too large for one developer context is split into separately reviewed steps (Step 47 → Steps 47 and 48) (coordinator ruling (2026-10-29)) | stands |

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
| NumberBondItemV1 | shipped: form:sentence only (NumberBondSentenceItemV1). Step 27 (not built) adds form:bond, whole, leftPart, rightPart, missing:left/right; whole 2..20, positive parts sum to whole; exactly one part blank. |
| Queued sheet | QueuedSheet {profileId, selection: WorksheetSelectionV2, document: WorksheetDocumentV1}; document.worksheetId detects duplicates. PacketState {sheets, paperSize, keyPlacement}; PACKET_SHEET_LIMIT 10 (shared/packet/compose.ts); order only in React reducer state. |
| ChildProfileV2 | lowercase UUIDv4 id, optional bounded displayName, reviewedOn ISO date, unique bounded interests, optional read-only legacyChoices. No age/current ability gates. |
| AppConfigV2 | schemaVersion:2, profiles:ChildProfileV2[], defaults:WorksheetDefaultsV2 (selection and useEarlierChildSettings). Strict unknown-key refusal. |
| ConfigResponseV2 | config:AppConfigV2 and storedSchemaVersion:1 or2, so reading v1 does not write it. |

Profile id and worksheetId are UUIDv4 strings generated with browser crypto.randomUUID by ProfileEditor and create-session respectively; packet rows retain existing IDs rather than minting replacements. Worksheet family slug is one of dry-math, find-the-wow, sentence-builder, count-compare-make, number-bonds, operation-grid, clock-explorer, tally-detective (`WORKSHEET_TYPE_IDS` in shared/worksheet/types.ts). Item identity and problem deduplication remain family-specific typed/oracle contracts.

No packet API is introduced. Existing GET /api/config returns ConfigResponseV2 and ETag; PUT /api/config accepts validated AppConfigV2 under the session/precondition guards and returns ConfigResponseV2 with new ETag. Config conflict/error codes stay in server/routes/config.ts; no packet action calls PUT. Recovery and session-bootstrap routes remain unchanged; the existing README describes the private-file recovery boundary. GET /api/session returns the in-memory `SessionResponse` token and GET /api/health returns `HealthResponse` (`status`, `version`); no step 27/31/33 adds or changes a route.

## 12. Time budget

[Estimates](build-estimates.json) split worker and attention hours, with the master hash they were estimated against (not refreshed on plan edits; they predate Step 34) and model provenance. Manual printer/family/browser availability is elapsed wait, not worker time. Optional/deferred designs excluded from committed delivery forecast. Phase H (Steps 39-55 and HR1) is unestimated: no build-estimates.json entry covers it until the estimates are refreshed.

## 13. What's NOT in this plan

No packet persistence/store/API/recovery, schema3, undo or per-sheet regeneration, packet scale search, new benchmark/capture/AST guards, or unattended multi-plan build chain. Those source phases are explicitly subsumed/removed underP9/P10 and lean ruling. Existing deterministic local app unaffected. Broader content/AI remains separate design, not automatic implementation. Original line-citation anchor bytes and all six canonical profile hashes remain unchanged. Phase H keeps "no schema3": every new choice is an additive version 2 key or enum member (HP2).

## 14. Tracking

Existing issue27=#38; operation grid34=#42 (not the archived packet-plan Step 34, which was folded); packet31=#47, packet33=#48; Phase V clock35=#43, tally36=#44, try37=#45. SourceM1=#10,M2/M3=#13; preserve open review findings#15/#18/#19 pending verified closeout rather than assuming source absorption closed issues. See merge map for every source disposition. No GitHub mutation by reconciliation. Phase H: Step 38 has no issue (built on direct operator request); Steps 39-55 receive issues at repo-sync. Root plan.md only redirects here.

## 15. Plan history

2026-10-14: merged initial plan and three feature plans plus three seeds; exact archived originals, current normative math/packet references and one master. Kept lean-revision precedence and all manual/deferred requirements. Public documentation moved into docs; operator screenshot retained, never inspected or exempted. Citation and release-audit producers migrated to exact archived initial source without hash repinning.

2026-10-26: operator identified the retained screenshot (the 2026-10-04 screenshot, a 10 × 10 multiplication grid with a few anchor cells) as an unplanned feature request; added Step 34, Operation Grid, ahead of MA2 so one math screen review covers it. Later the same day the operator had it moved outside the checkout to `C:/Users/abero/extra-credit-private/examples/` (sha256 unchanged, 9bb8728b...a5d7), which clears the release-audit blocker.

2026-10-29: the operator approved the Random packet (Step 38, built directly on the `random-packet` branch), set the app version to 1.4.0 with a minor bump per merged feature, and reported that the children find many worksheets too easy. After a six-lane source discovery the operator selected every harder option for arithmetic, counting and numbers, and clocks, with new settings only (no schemaVersion 3). Phase H (Steps 39-55, HR1) was drafted by five lane drafters, each independently critiqued and repaired once; the technical contract lives in [harder-practice-spec.md](harder-practice-spec.md).

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

### Steps 35, 36, 31 and 33 wrap — visual math and printable packets (2026-10-29)

**Issues #43, #44, #47 and #48 closed. 1356/1356 Vitest tests (49 files) and 232/232 Playwright specs passing; lint, all three typecheck projects and log-privacy calibration clean.**

Built in the P7 order 35, 36, 31, 33, with MA2 waived as a dispatch gate by P6 (MA2 stays PENDING).

What was built:
- `clock-explorer` ("Clock Explorer", Step 35), the seventh family: four distinct on-the-hour clocks per page drawn as inline SVG from each hour alone; the child writes the hour, and the key names the time and both hands.
- `tally-detective` ("Tally Detective", Step 36), the eighth family: four distinct totals from 1 to 20 drawn as bundles of five plus loose marks; the key prints each total with its grouping (`8 = 5 + 3`). Both families share one canonical-request check (`seedOnlyRequestIsCanonical`) and add no settings group and no schema change.
- Session packet queue (Step 31): "Add to packet" beside Make another, a "Printable packet" panel of up to `PACKET_SHEET_LIMIT` (10) immutable sheet snapshots for one or several children, with Move up, Move down and Remove; nothing reaches the server or browser storage.
- Packet preview and print (Step 33): `composePacketPages` orders worksheet and key pages with keys grouped at the end (default), after each sheet or left out; one packet paper (Letter or A4) re-renders each sheet at its stored scale without regeneration; "Print packet (N pages)" calls `window.print()` once and never clears the queue; every key heading carries its sheet label; the profile delete dialog counts the profile's queued sheets, which stay labeled "for a removed profile".
- Proof: clock and tally ink oracles in `print.spec.ts` (`tests/oracles/{clock,tally}-oracle.ts`) with hide/zero calibrations, `visual-math.spec.ts`, `packet-queue.spec.ts`, `packet-print.spec.ts` (two ten-sheet PDF cells plus a page-break calibration), a fast-check composition property, and two compiled release-smoke packet cases.

Files changed (`ec33261`..`4ec5733`, 63 files across 4 checkpoints):

| Area | Files |
|---|---|
| New families | `frontend/src/worksheets/{clock-explorer,tally-detective}/{definition,generator,generator.test}.ts`; `frontend/src/web/worksheets/{clock-explorer,tally-detective}/{Renderer,Renderer.test}.tsx` |
| Shared domain | `frontend/src/shared/worksheet/{types,registry,project-request,invariants,answer-oracle}.ts` and tests; new `frontend/src/shared/packet/{compose,compose.test}.ts` |
| Web | `App.tsx`, `GeneratorControls.tsx`, new `generator/control-labels.ts`, new `packet/{packet-session,PacketPanel,PacketPrintView}` and tests, `print/AnswerKeyView.tsx`, new `print/print-packet.css`, `profiles/ProfileList.tsx` and new test, `worksheets/registry.ts`, `styles/{tokens,screen}.css` |
| Tests and fixtures | new `tests/oracles/{clock,tally}-oracle.ts`; new e2e `visual-math`, `packet-queue`, `packet-print`, `fixtures/{packet-controls,print-checks}.ts`; e2e `print`, `accessibility`, `release-smoke`, `fixtures/worksheet-controls.ts`; `tests/fixtures/print/{matrix,required-content}.ts`; integration `ci-contract`, `config-api`, `config-upgrade`, `practice-golden`, `schema-parity`, `shipped-profile-options` |
| Docs | `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`, this plan (statuses, P6/P7, `## Manual UAT`) |

Fresh context notes:

| Topic | Detail |
|---|---|
| Single owners | `PACKET_SHEET_LIMIT` lives in `shared/packet/compose.ts` and `packet-session.ts` re-exports it; Length, Paper and `profileLabel` labels live in `generator/control-labels.ts` because exporting them from `GeneratorControls.tsx` trips the react-refresh lint rule. |
| Key surface name | Packet key pages use `data-surface="answer"`, the name `PrintView` and `requiredPrintContent` already use, not "key". |
| Packet preview state | The packet preview closes on Back, on a new single preview, and when the last sheet is removed; Add to packet is hidden while it is shown (Step 33 review round 1). |
| CI filter | `ci-contract.test.ts`'s `print.spec.ts` row filter was tightened so it no longer matches `packet-print.spec.ts` rows; a disjointness assertion guards both filters. |
| Load and memory | Under Windows Defender load, `foundation.spec.ts`'s supervisor-close test times out (wait for three CPU samples under 50% and rerun); once a release-audit test failed on a host `VirtualAlloc` out-of-memory error and passed on rerun. |
| Manual UAT naming | The `## Manual UAT` items M1-M2 at the end of this plan are build-phase review deferrals (both already met by the final 1356/232 check), distinct from the Step M1-M3 operator steps. |


## Phase V: Visual math first batch

Objective: add four-problem on-the-hour clock and grouped-tally worksheets through the existing Create / preview / print journey, then obtain a short parent trial before selecting the next batch.

Publication scope for this prep run: Phase V Steps 35-37 only; use `/repo-sync --plan docs/plans/master_plan.md --phase V --scope steps`. Do not create, update, or close other-track issues. Execution scope is `/build-phase --plan docs/plans/master_plan.md --steps 35,36`; Step37 is the subsequent operator trial. Existing MA2 must be completed before Step35 starts (waived as a dispatch gate by P6, 2026-10-28). Packet Steps31/33 retain their own dependencies and are not selected by this expansion. The code steps are sequential because they share projection, registry, key, and print-test interfaces.

Specification: [visual math expansion](visual-math-expansion-plan.md). The master alone owns step IDs, statuses, dependencies and issues; the linked specification is technical context and the fourteen-activity backlog, not another execution queue. Operation Grid is already merged at `8b2546a`; no parallel worktree remains. The supplied seed/PDF are preserved outside the checkout with original hashes verified; the focused release-audit test passes (one test,67 filtered out). Reference images are not a runtime or build prerequisite: the specification includes every required mathematical example. No new dependencies or schema migration.

Validation: tiny-domain unit tests, production-caller generation, compiled browser/print evidence and full `npm --prefix frontend run check` after each code step. Print tests include SVG ink/geometry negative calibration. Prior accepted counts must not regress. Effort: two family-sized code slices plus a short operator trial; no wall-clock promise. Kill criterion: failed mathematical or print invariants, changed retained private data, or an unresolved required gate. Backout: retain the previous app/config bytes; never reset profiles.

### Phase V implementation contract

New family IDs are `clock-explorer` and `tally-detective`, generatorVersion1 each. Sample four distinct hours1..12 or totals1..20 using the existing seeded RNG. Clock item: id, itemType, answerability objective, hour, numeric answer(hour). Tally item: id, itemType, answerability objective, bundles=floor(total/5), remainder=total%5, numeric answer(5*bundles+remainder). IDs use existing `item-001` sequence; document/profile IDs remain browser-generated UUIDv4, seeds nonzero eight-lowercase-hex strings. No new answer kind or persisted settings group.

Clock: all12 labels; minute hand at twelve, shorter distinct hour hand at30*(hour%12) degrees clockwise from twelve. At12:00 longer minute hand remains visible past overlapping hour hand. Blank child response is `Time: ____ :00`; key formats e.g. `3:00 — long hand at 12, short hand at 3`. Tally: each full five is four upright strokes plus a crossing fifth; 0..4 loose strokes follow. Reference8=5+3;20=four full bundles. Independent oracle recomputes numeric answers; validate exactly four same-family sequential items, unique problems, domain bounds and canonical request.

Projection: force length standard, decoration false, absent topicIds/decorativeTopicId/practice, inactive writing/math fields copied from existing shared constants. Hidden stored values stay intact for switching back. Changing unrelated options/profile legacy values with same seed and applicable options must leave entire request/content identical. Controls: name opt-in, key inclusion, paper and scale only; fixed count4, NO_MAXIMUMS, sufficient capacity and truthful fixed-domain exhaustion message. Existing Make another uses16 attempts; no hidden range advice. Save only explicit defaults; older versions block unknown family IDs without rewriting data. No profile migration/reset.

Use local family renderers with inline SVG; no external URLs or assets. Standard/large print retains16/18pt instructions,7/9mm response lines; start dials around40/45mm and verify rather than shrink below legibility. Check every SVG hand, outline, tally upright/crossing under print media for actual ink, effective visibility/opacity, positive stroke width, correct endpoints/orientation and containment. Hiding a stroke or zeroing width must fail while box stays intact, then restoration passes. Four cards and separate parent key each fit one Letter/A4 page.

Integration: extend shared/worksheet types, registry, project-request, invariants, answer-oracle; web worksheet registry, GeneratorControls, AnswerKeyView and tokens; schema/default/transport consumers only as required by new enum members. Extend requiredPrintContent titles/prompts/blanks/formatted keys; explicit no-extra-choice branches in chooseWorksheetChoices; golden coveringGroup entries undefined (no legacy group), unchanged golden JSON/hash. One fixture/family expands to4 child cases+4 key surfaces. Pre-Phase V baseline (8b2546a): 91 child/23 key/109 discovered print tests; Steps 35 and 36 each added 4 child cases, 4 key surfaces and 4 discovered tests (now 99/31/117), retaining all old rows. The print helper already guards hidden Length. Unit-check all12 hours/all20 totals, several deterministic seeds, malformed inputs and request noninterference; then compiled Create/key/print flow and complete check.

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

## Phase H: Harder practice

Objective: the operator reports that the children find many worksheets too easy (2026-10-29). Phase H raises what the arithmetic, counting-and-number and clock worksheets can practise. It does this through new choices on the existing Create / preview / print journey, and then lets the Random packet's difficulty levels reach that new practice. Sentence Builder is out of scope (HP1).

Abbreviations used in Phase H: CCM is Count, Compare & Make (`count-compare-make`); Wow is Math — Two Whats and a Wow (`find-the-wow`); "the spec" is `docs/plans/harder-practice-spec.md`; HP/HD rows and R1(a)-R4 are Decision Inventory IDs; DW n is a step's Done-when item n.

Specification: the [harder practice specification](harder-practice-spec.md) is the technical contract for Steps 40-54. It covers constants, persisted keys, request shapes, generation, oracles, print geometry and consumer sites, plus the notes Steps 39 and 55 read. It also holds § Coordinator rulings and § Design defaults, and was verified against source on 2026-10-29. The master alone owns step IDs, statuses, dependencies and issues. The coordinator rulings R1(a)-(c) and R2-R4 are defined once, in the Decision Inventory and in the spec's § Coordinator rulings, and steps cite them by ID. The operator answers A1-A4 are recorded in row HP5.

Preconditions before the first Phase H build:
- The `random-packet` branch is committed and merged to `main` with operator approval. It holds Step 38, the 1.4.0 version, this plan and `docs/plans/harder-practice-spec.md`, which is untracked today. Build-phase checkpoints run `git add --all` over the working copy.
- After that merge, one `npm --prefix frontend run check` passes on `main`. §9 records its counts as the Phase H floor; Step 38's branch gate was 1403 Vitest (51 files) and 233 Playwright.
- The private reconciliation folder stays outside the checkout. It was moved to `C:/Users/abero/extra-credit-private/plan-reconciliation/` on 2026-10-29 (A4). Before each gate, `git status --porcelain` shows no untracked file, because any untracked file fails the release audit as `PERSONALIZED_ARTIFACT`.
- §6 applies unchanged:
  - ports 4310/4311 are free and the retained launcher is stopped;
  - `config/children.local.json` is absent (metadata check only);
  - `config/uat-session/` is never read.

Saved settings (HP2):
- Every new choice is either an additive schemaVersion 2 key with a Zod default, listed in its transport `optional` list, or a new member of a value list that no array bound derives from (CONTRIBUTING.md "Persisted shape").
- No existing persisted bound is widened. There is no schemaVersion 3 and no migration, and §13's "no schema3" stands.
- `V1_NUMERIC_MAXIMUM` (20) and `DRY_MATH_NUMERIC_MAXIMUM` (100) keep their values. Each family that goes past them gets its own constant (HD2).
- No persisted or fixture value exceeds its bound (R3).
- Every new persisted key or member gets two checks:
  - a PUT/GET round trip through `frontend/tests/integration/config-api.test.ts`, following the Clock Explorer/Tally Detective `describe.each` there, or through the compiled app's save and reload;
  - a check that a v2 file without it parses unchanged and is not rewritten on read.

Existing choices stay byte-identical (HD3): today's selections keep their enumeration order, seed stream and `generatorVersion`. `frontend/tests/fixtures/golden/practice-content-keys.json` and every existing known vector are therefore unchanged. A new mode projects a new request member or field only when it differs from today's default.

Version (HP4): the app version lives in `frontend/package.json` (and `package-lock.json`) and is 1.4.0 after Step 38. Each parent-visible step sets its target exactly with `npm --prefix frontend version <target> --no-git-tag-version`:

| Step | Version |
|---|---|
| 39 | 1.5.0 |
| 40 | none |
| 41 | 1.6.0 |
| 42 | 1.7.0 |
| 43 | 1.8.0 |
| 44 | 1.9.0 |
| 45 | 1.10.0 |
| 46 | 1.11.0 |
| 47 | 1.12.0 |
| 48 | 1.13.0 |
| 49 | 1.14.0 |
| 50 | 1.15.0 |
| 51 | 1.16.0 |
| 52 | 1.17.0 |
| 53 | 1.18.0 |
| 54 | 1.19.0 |
| 55 | 1.20.0 |

Docs: every README edit keeps the literal "within 20", a release-audit term (`frontend/scripts/audit-release.mjs:157`).

Packet scope (R1): `frontend/src/web/packet/` changes outside Steps 39 and 55 only to keep compiling, by spreading the exported default group (R1(a)), or to name a new choice in a queued sheet's label with a wording test (R1(b)). A new choice stays out of Random packets until Step 55 (R1(c)). Step 39's defaults-first candidates enforce this structurally, so Steps 44-54 add only leak tests there and edit no `RANDOM_PACKET_FOCUS` row (Steps 50 and 54 included: `seedOnly` already supplies their new groups' defaults).

Validation:
- Iterate on narrow tests.
- Every new mode gets an integration test through `createWorksheetSessionForSeed` and through the compiled app.
- Every print-affecting change gets print rows with a calibration that fails on a broken anchor. A calibration runs inside an existing matrix row test, so the `ci-contract.test.ts` per-test pin moves only when a step adds rows.
- After each merge, one full `npm --prefix frontend run check` runs, with counts not below the previous step's. Step 39's floor is the §9 Phase H floor.
- `docs/testing-print.md` and the `ci-contract.test.ts` counts move by the actual delta.
- Flags for Steps 39-55 are exactly `--reviewers code --isolation worktree` (§6 lean ruling).

Review (HD5): Phase H has no per-track screen review. One screen review, HR1, follows Step 55, and it judges legibility, labels and whether the levels rise. Physical print of the Phase H surfaces is part of M1, and handwriting fit and the children's difficulty judgment are part of M2. Each track still runs as its own `/build-phase` run in a fresh window (P10).

Order: Steps 39-55 run one at a time in ID order, because they share types, invariants, request projection, registry and controls (HD4). The tracks are:
- arithmetic 39-45: packet levels 39, Dry Math 40-43, grid headers 44-45;
- numbers 46-49;
- clocks 50-51;
- pictures 52-54 (the largest print risk, so last);
- levels 55.

A step too large for one developer context is split before build (R4). Kill criterion: a failed mathematical or print invariant, a changed golden or existing document, changed private data, or a persisted bound that would need schemaVersion 3. Backout: drop the step's merge. Previous config bytes and documents remain valid, because every key is additive.

### Step 38: Random packet
- **Status:** DONE (2026-10-29; built on the `random-packet` branch on direct operator request; merge to `main` and its post-merge check are Phase H preconditions)
- **Problem:** A parent can tick the worksheet families to include, choose how many pages (one worksheet each, up to the packet's room) and a difficulty (Easier, Medium, Harder), and fill the session packet with newly generated worksheets for the chosen child in one action.
- **Type:** code
- **Issue:** none; built on direct operator request (2026-10-29)
- **Flags:** none (built outside build-phase; reviewed by one independent code reviewer, two rounds)
- **Files:** new `frontend/src/web/packet/{random-packet.ts,random-packet.test.ts,RandomPacketForm.tsx,RandomPacketForm.test.tsx}`; `frontend/src/web/App.tsx`; `frontend/src/web/packet/{PacketPrintView.tsx,PacketPrintView.test.tsx}`; `frontend/src/web/styles/screen.css`; `frontend/tests/e2e/fixtures/packet-controls.ts`; `frontend/tests/e2e/packet-queue.spec.ts`; `frontend/{package.json,package-lock.json}` (version 0.1.0 to 1.4.0, operator decision HP4).
- **Produces:**
  - `RANDOM_PACKET_FOCUS`: each family's candidate selections per level, built from the shipped practice-focus catalogs and Operation Grid choices; Clock Explorer and Tally Detective print the same at every level (`UNCHANGED`, `random-packet.ts:192-193`).
  - `makeRandomPacket`: deals ticked families from a seeded shuffled deck (each once before any repeats), generates each sheet through `createInitialWorksheetSession`, regenerates a repeated page, leaves out and names a family that cannot be made, and keeps every choice difficulty does not set (child, nickname and interests, Theme, decoration, answer key, length, paper, print scale).
  - "Random packet" form: family checkboxes, Pages (1 to the packet's room, default `DEFAULT_RANDOM_PACKET_PAGES` = 5, `RandomPacketForm.tsx:15`), Difficulty with a hint per level and "it is not a grade level"; disabled with a reason while no child is chosen, the packet is full or nothing is ticked.
  - App adds the sheets to the session packet and opens the packet preview, which shows what was added (and anything left out) under its heading; nothing reaches the server or browser storage.
- **Done when:** Met on the branch on 2026-10-29: full `npm --prefix frontend run check` passed with 1403 Vitest tests (51 files) and 233 Playwright specs, lint, all three typecheck projects and log-privacy calibration. Still owed before Step 39 (Phase H precondition): after the operator-approved merge, one `npm --prefix frontend run check` on `main` passes with counts not below 1403 (51 files)/233, and §9 records those counts as the Phase H floor.
- **Depends on:** Step 33

### Step 39: Challenge and Expert packet levels from today's settings
- **Status:** DONE (2026-10-29)
- **Problem:** The Random packet's Difficulty offers five levels, Easier, Medium, Harder, Challenge and Expert. Challenge and Expert use the hardest practice the worksheets already support for Dry Math, Operation Grid and Sentence Builder; the other families repeat Harder until Step 55. Every candidate starts from the built-in defaults, so a parent's saved family choice (today's or a later step's) never reaches a packet sheet.
- **Type:** code
- **Issue:** #50
- **Flags:** --reviewers code --isolation worktree
- **Files:** `frontend/src/web/packet/{random-packet.ts,random-packet.test.ts,RandomPacketForm.tsx,RandomPacketForm.test.tsx}`; `frontend/tests/e2e/fixtures/packet-controls.ts` (the `RandomPacketPlan` level union at :173); `frontend/tests/e2e/packet-queue.spec.ts`; `frontend/{package.json,package-lock.json}` (1.5.0); `README.md` (the :5 status paragraph); `CLAUDE.md` (Current state).
- **Produces:**
  - `RANDOM_PACKET_LEVELS` = `easier`, `medium`, `harder`, `challenge`, `expert`; `DEFAULT_RANDOM_PACKET_LEVEL` stays `medium`.
  - **Defaults first (R1(a), R1(c)):** every `FocusChoice` returns `{ ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2), ...levelFields, ...keptChoices(selection) }`, where `keptChoices` copies exactly `theme`, `useDisplayName`, `useInterests`, `includeDecorativeGraphics`, `includeAnswerKey`, `length`, `paperSize` and `printScale` from the parent's selection (Step 38's kept list). `wowQuantity` and `wowEquation` build `findTheWow` from the default group (no `...selection.findTheWow`); `grid()` overrides only the fields it names on the default `operationGrid`; `UNCHANGED` becomes `seedOnly`, the defaults plus the kept choices, for Clock Explorer and Tally Detective. A later step's new group or member therefore arrives at its default in every packet sheet with no edit here, and Steps 44-54 need only their leak tests.
  - **Builders:** `dryMath(id, regrouping = "without")`; `facts(operations, families)` (Harder keeps `["multiplication"]` with `DEFAULT_FACT_FAMILIES`); `grid({ operation, rows, columns, prefilled })` with separate rows and columns.
  - **Challenge:**
    - Dry Math: `dryMath("addition-and-subtraction-within-100", "required")`; `facts(["multiplication", "division"], [2, 3, 4, 5, 6, 7, 8, 9, 10])`.
    - Operation Grid: multiplication 12 × 12 with 14 given cells; multiplication 10 × 10 with 0 given cells (the large-print sibling).
    - Sentence Builder: `sentence("independent", "all-words")` only.
    - Two Whats and a Wow, Count, Compare & Make and Number Bonds: Harder's candidates (Number Bonds stops at a whole of 20 until Step 46; Step 55 maps the wider ranges).
  - **Expert:**
    - Dry Math: `dryMath("addition-and-subtraction-within-100", "required")`; `facts(["multiplication", "division"], [0, 1, …, 12])`.
    - Operation Grid: powers 10 rows × 3 columns (`OPERATION_GRID_POWERS_BASE_MAXIMUM` × `OPERATION_GRID_POWERS_EXPONENT_MAXIMUM`) with `DEFAULT_OPERATION_GRID_PREFILLED` (10) given cells; multiplication 10 × 10 with 0 given cells.
    - Every other family: Challenge's candidates.
  - **One owner for each level's claim:** `RANDOM_PACKET_LEVEL_LABELS[level]` gains `ceiling` (Easier 10, Medium 20, Harder 100, Challenge 144, Expert 1,000), and its `hint` is composed as `` `Numbers to ${ceiling.toLocaleString("en-US")}, ${rest}` ``. The literal hints:
    - Easier "Numbers to 10, drawing and labeling", Medium "Numbers to 20, copying and sentence frames" and Harder "Numbers to 100, plus times tables and longer words" stay byte-identical.
    - Challenge: "Numbers to 144, plus carrying and borrowing, times tables to 10 and independent writing".
    - Expert: "Numbers to 1,000, plus powers, carrying and borrowing, times tables to 12 and independent writing".
    - Under A1, the number covers arithmetic and counting only. Challenge's 144 comes from its 12 × 12 grid, so a large-print Challenge packet practises at most 100; the docblock says so. Wording is confirmable at redline (HD6).
  - **Scorer** (`random-packet.test.ts`, which drops its private `LEVEL_CEILING` copy and reads the owner): `largestNumber` returns `{kind:"number", value}`, `{kind:"facts", value}` (named by "times tables", never counted in `ceiling`), `{kind:"writing"}` (Sentence Builder) or `{kind:"not-scored"}`. The outer switch is exhaustive over `WorksheetType`, with a `never` default:
    - Dry Math: an exhaustive switch over `DryMathStrand` with a `never` default. `add-subtract` scores `dryMath.resultMax`; `multiply-divide` scores facts as `max(factFamilies) × FACT_FACTOR_MAXIMUM`. Each strand Steps 41-43 add fails to compile until that step scores it from its shipped constant (R1(a)).
    - Operation Grid: an exhaustive switch over its operation. Addition scores `rows + columns`, multiplication `rows × columns`, and powers `rows ** columns`.
    - Wow scores `countingMax` or the equation's `resultMax`, Count, Compare & Make `compareMax`, and Number Bonds `wholeMax`.
    - Clock Explorer and Tally Detective return `not-scored` (A1) until Step 55 scores them by name.
- **Done when:**
  1. **Level table** (`random-packet.test.ts`):
     - With `BASE`, every candidate makes a sheet at every length at standard print.
     - At large print, every candidate makes a sheet except Harder's 12 × 12 addition grid and Challenge's 12 × 12 multiplication grid. The test lists those two by name, and each returns `ok: false` with the "Large print fits at most 10 rows" sentence (`operation-grid/definition.ts:144-155`).
     - For every family, level, length and scale, at least one candidate succeeds, and an every-family packet leaves none out at any level (today's :95-107 test over five levels).
     - For each level, the maximum `number` score equals `ceiling` exactly, and the ceilings rise strictly. A hint contains "times tables" exactly when its level has a `facts` candidate. The families returning `not-scored` are exactly `["clock-explorer", "tally-detective"]`.
     - Challenge's candidate set, applied to `BASE`, differs from Harder's for Dry Math, Operation Grid and Sentence Builder, and Expert's differs from Challenge's for Dry Math and Operation Grid. The test names the repeats: Two Whats and a Wow, Count, Compare & Make and Number Bonds equal Harder at Challenge and Expert, and Sentence Builder's Expert equals its Challenge.
  2. **No leak** (`random-packet.test.ts`): `PARENT` sets a non-default value in every family group and every kept choice. For every candidate, `{ ...choose(PARENT), ...keptChoices(BASE) }` deep-equals `choose(BASE)`, and every kept choice equals `PARENT`'s.
  3. **Form** (`RandomPacketForm.test.tsx`): five Difficulty radios in level order with Medium checked. Each label and hint is read from the owner, and the Challenge and Expert hints equal the literals above. Choosing Expert passes `level: "expert"`.
  4. **Compiled app** (`packet-queue.spec.ts`): an Expert packet of Dry Math and Operation Grid (Pages 4) queues rows whose details are all in the set `describeQueuedSheet` gives for `RANDOM_PACKET_FOCUS[family].expert`. No row reads "Multiplication facts for 2, 5 and 10" (Harder's literal). It sends no `PUT /api/config` (`withoutConfigWrite`) and leaves every browser store empty (`expectEmptyBrowserStores`).
  5. **Version and docs:**
     - `frontend/package.json` and `package-lock.json` read 1.5.0.
     - The README :5 status paragraph gains one sentence on the Random packet and its five levels ("it is not a grade level"), and README still contains "within 20" (`frontend/scripts/audit-release.mjs:157`).
     - CLAUDE.md Current state records Steps 38-39, version 1.5.0 and the gate counts.
  6. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout; Vitest and Playwright counts must not fall below the §9 Phase H floor.
- **Depends on:** Step 38 and the Phase H preconditions

### Step 40: Exhaustive Dry Math strand dispatch and a measured answer blank
- **Status:** DONE (2026-10-29)
- **Problem:** Before Dry Math can gain a third practice strand, two things must change. First, about fifteen sites test `dryMathStrand` or `practice.kind` as a binary (`multiply-divide`, otherwise add-subtract), so a new strand would silently be treated as add-subtract. Second, the printed answer blank is a bare literal `____` (`frontend/src/web/worksheets/dry-math/Renderer.tsx:70`, `frontend/tests/fixtures/print/required-content.ts:240`), and nothing measures it. After this step, every site handles each strand by name and fails to compile when a strand is added. The blank comes from one owner, and print measures it with a calibration that fails when the blank is collapsed. A parent sees no change: every page, key and print output keeps its current text.
- **Type:** code
- **Issue:** #51
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: `frontend/src/worksheets/dry-math/{definition.ts,generator.ts}`; `frontend/src/web/worksheets/dry-math/Renderer.tsx`; new `frontend/src/shared/worksheet/{dry-math-blank.ts,dry-math-blank.test.ts}`.
  - Shared: `frontend/src/shared/worksheet/{invariants.ts,project-request.ts,registry.ts,limit-labels.test.ts}`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,worksheet-session.ts}`; `frontend/src/web/worksheets/registry.test.ts`.
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/print.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Docs: `docs/testing-print.md` (the new blank measurement and its first measured widths; no count change).
  - Not touched: `frontend/src/web/packet/`. Step 39 owns `largestNumber` (`random-packet.test.ts:58-77`, a `dryMathStrand` switch with a `never` default); `packet-session.ts:199-204` (`detailOf`) is converted in Step 41, which adds the first new strand (R1(b)).
- **Produces:**
  - **Strand dispatch:** every site in the Spec list "Strand dispatch" becomes an exhaustive `switch` over `DryMathStrand` or over the Dry Math `practice.kind` values, ending in `default: { const unreachable: never = …; }`. `DRY_MATH_STRANDS` still has only two members, so behavior is identical.
  - **Capability gate:** `getDryMathCapabilitySupport` (`definition.ts:90-119`) becomes a switch on `practice?.kind`. `dry-math-facts` is available whenever `equations` is present. `undefined` and `dry-math-add-subtract` keep today's numeric-operation check. Any non-Dry-Math kind also keeps that check, so a malformed request has today's outcome. Its docblock (`:85-89`) states the per-kind rule.
  - **Print boundary predicates:** the carrying-and-borrowing predicate (`matrix.ts:316-326`) is today keyed only on `dryMathRegrouping === "required"`, and it now applies only to the add-subtract strand. The facts predicate (`:330-349`) applies only to multiply-divide. Without this, a later strand that also requires regrouping would search 50,000 seeds for a subtraction from 100 and throw.
  - **Blank owner:** `dryMathBlank(practice)` in `dry-math-blank.ts` returns `{ kind: "single", underscores: LEGACY_DRY_MATH_BLANK_UNDERSCORES }` (4) for every kind that exists today. `Renderer.tsx:65-71` wraps the blank in `<span data-answer-blank="answer">`, and the row's text content and aria-label are unchanged. The blank is underscores only, with no CSS `min-width`, so its printed width is the width of its glyphs.
  - **Print measurement:** `answerBlankViolations(page, expectedDigits, floorMm)` goes next to `operatorViolations` (`print.spec.ts:321`). It reports each `[data-answer-blank]` whose box is narrower than the expected digit count × the per-digit floor, and it reports "no blank printed" when none printed.
    - The floor is a test-side constant: 4.5 mm per digit at standard and 5 mm at large, about 20% below a nominal 0.5 em underscore (2 underscores are about 5.6 / 6.4 mm at 16 / 18 pt).
    - The expected digit count for today's kinds is the restated legacy value of 2 (4 underscores).
    - It runs on the worksheet surface of every Dry Math row, inside the existing row test (`if (fixture.selection.worksheetType === "dry-math")`).
    - Its calibrations run inside the existing `dry-math-regrouping-100` block of that row test (`print.spec.ts:1015-1025`, the row `dry-math-regrouping-100-letter-standard-decoration-false`), as the facts operator calibration does at `:1044-1050`. No `test()` is added, so the `ci-contract.test.ts:48` pin (117) and the per-cell counts (`:62-77`) do not move.
    - `docs/testing-print.md` records the blank widths measured on the first Windows run per paper and scale, so M3's Ubuntu run (a different resolved face from `App.tsx:431`'s font stack) can be compared.
  - No version bump: nothing a parent sees changes.
- **Done when:**
  1. **No behavior change:**
     - Every existing Vitest and Playwright test passes, except the test edits listed under the spec's "Tests that change on purpose" (Step 40).
     - `frontend/tests/fixtures/golden/practice-content-keys.json` and every existing known vector are unchanged, and `generatorVersion` stays 1.
     - `config-shape-fingerprint.test.ts` passes without a repin.
  2. **Dispatch is exhaustive:**
     - `git grep -nE 'dryMathStrand [!=]==|strand [!=]==|kind [!=]== "dry-math-(facts|add-subtract)"|dryMathBranch\.kind [!=]==' -- frontend/src frontend/tests ':!frontend/src/web/packet'` prints nothing. Today it prints 17 lines.
     - Each converted switch ends in a `never` default.
  3. **Blank owner:**
     - `dry-math-blank.test.ts` asserts the literal `"____"` for no practice member, the add-subtract member and the facts member. The test types the literal instead of importing the constant.
     - `web/worksheets/registry.test.ts` reads `[data-answer-blank]` on add-subtract, regrouping and facts pages and finds exactly `____` in each.
     - The `required-content.ts` row text stays the literal `= ____`.
  4. **Print** (`print.spec.ts`, inside the existing row test):
     - `answerBlankViolations` returns `[]` on every Dry Math row.
     - On `dry-math-regrouping-100`, `withPrintStyle(page, "[data-answer-blank] { font-size: 1px !important; }")` makes it return at least one violation, and `[data-answer-blank] { display: none !important; }` makes it report "no blank printed"; after each style is removed it returns `[]`.
     - `ci-contract.test.ts` passes unedited (117 `print.spec.ts` rows).
     - `docs/testing-print.md` names the measurement and the measured widths.
  5. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 39

### Step 41: Three-digit addition and subtraction to 1,000
- **Status:** DONE (2026-10-29)
- **Problem:** A parent picks a "within 1,000" Dry Math practice focus (addition, subtraction, or both) and keeps or turns on "Every problem carries or borrows". Create, preview, key and print then give three-digit problems such as 638 + 287 = ________ or 1000 − 463 = ________, with a blank wide enough for a four-digit answer. The status line beside Create, the selected option and a queued packet row all name the three-digit focus, and the choice survives "Save these as worksheet defaults" and a reload.
- **Type:** code
- **Issue:** #52
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: `frontend/src/worksheets/dry-math/{definition.ts,generator.ts,generator.test.ts}`; `frontend/src/shared/worksheet/{dry-math-blank.ts,dry-math-blank.test.ts}`.
  - Shared: `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,earlier-settings.ts,earlier-settings.test.ts,practice-focus.ts,practice-focus.test.ts,migrate.test.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,worksheet-session.ts,worksheet-session.test.ts,options.test.tsx,math-generation.test.ts}`; `frontend/src/web/worksheets/registry.test.ts`; `frontend/src/web/packet/{packet-session.ts,packet-session.test.ts}` (`detailOf` only, R1(b)); `frontend/src/web/packet/random-packet.test.ts` (one `largestNumber` case, R1(a), and one strand pin test, R1(c)).
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/integration/{arithmetic-oracle,schema-parity,shipped-profile-options,ci-contract,config-api,config-shape-fingerprint}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/{dry-math,print}.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Version and docs: `frontend/package.json`, `frontend/package-lock.json`; `README.md` (the :167 bullet and the :22 controls sentence); `docs/educational-basis.md` (:51 Numeric range, :53 Regrouping, and the `dry-math` section from :64); `docs/testing-print.md`; `CLAUDE.md` (the Architecture summary at :75); `CONTRIBUTING.md` (§ Persisted shape, :104-112).
- **Produces:**
  - **Persisted (additive at v2):**
    - `DRY_MATH_STRANDS` (`enums.ts:41`) gains `three-digit` at the end.
    - A new group `dryMathThreeDigit: { operations }` holds a nonempty canonical subset of `MATH_OPERATIONS`. It defaults to `DEFAULT_DRY_MATH_THREE_DIGIT_OPERATIONS = ["addition", "subtraction"]` and is defaulted as a whole, like `dryMathFacts` (`schema.ts:228-231`).
    - Its canonical-order refinement is registered in `PERSISTED_REFINEMENTS` (`schema.ts:80-93`) as `worksheet.dry-math-three-digit.operations.canonical-order` (CONTRIBUTING.md "Its limits", :133-140), and `config-shape-fingerprint.test.ts` gains its violation probe (`["subtraction", "addition"]`) in the map at `:371-408`, which `:409` requires to equal the registered list. This is an added probe, not a snapshot repin.
    - Carrying and borrowing reuses `dryMathRegrouping`.
    - `transport-schemas.ts` mirrors the group as a `strictObjectSchema` next to `dryMathFactsSchema` (:219), adds it to `worksheetDefaultsProperties` (:275-283) and lists it in `optional` (:377-381).
    - `dryMath` is still capped at `DRY_MATH_NUMERIC_MAXIMUM` (100). Under R3, no persisted field holds a value above its bound: the group stores operations only.
  - **Constants** (`types.ts`, after `FACT_DIVIDEND_MAXIMUM` at :60):
    - `DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM = 100`, `DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM = 999`, and `DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM = 1000`, which is also the largest minuend.
    - In `dry-math/definition.ts`: the exact pool table `DRY_MATH_THREE_DIGIT_CAPACITY`, `DRY_MATH_SAMPLE_ATTEMPTS = 1000` and `DRY_MATH_FIXED_POOL_ADVICE`.
  - **Request:** practice kind `{ kind: "dry-math-three-digit", operations, regrouping }`, projected on every three-digit request with both regrouping values explicit. `mathSkills` is `{ ...inactiveMath(), representations: ["equations"] }`, as for facts (`project-request.ts:141-143`). `getDryMathCapabilitySupport` gains `case "dry-math-three-digit"`: available whenever `equations` is present.
  - **Generator and capacity:**
    - The page is built by seeded rejection sampling (Spec "Generation"), not by enumeration. Each item draws its operation once, then retries only its operands, so each item's operation is equally likely.
    - The injection seam is the exported `sampleThreeDigitItems(practice, count, random: Pick<SeededRandom, "nextBounded">)` in `dry-math/generator.ts`, which returns exactly `count` items or `undefined`. `generateDryMath` calls it with `createSeededRandom(request.seed)` (today's `:245`), maps `undefined` to `GENERATION_INVARIANT_FAILED`, and builds items per kind where `:247-257` today writes `{ kind: "number" }`.
    - `measureDryMathCapacity` (`generator.ts:289-291`) is the single capacity owner (issue #14), and for this kind it returns the table sum. For this kind only, `generateDryMath` reads capacity from it at `:234-236` and never calls `enumerateDryMathCandidates`; every existing kind still enumerates and shuffles its pool (`:235`, `:246`). For this kind `enumerateDryMathCandidates` throws ("the three-digit pool is never enumerated"). The `measureDryMathCapacity` docblock (`generator.ts:283-288`, "counted by enumerating the very collection `generateDryMath` shuffles") is reworded to state the per-kind rule: enumerated kinds count their shuffled collection, and the three-digit kind returns the exact table sum.
    - A third invariant branch, `threeDigitItemHolds`, is added. The oracle gains a three-digit focus.
  - **Controls and wording (R2), one owner each in `practice-focus.ts`:**
    - `THREE_DIGIT_PRACTICE_ENTRIES` is a separate entry list like `FACT_PRACTICE_ENTRIES` (:170-186) and is not part of the catalog. Its labels are formatted from `DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM.toLocaleString("en-US")`: "Three-digit addition within 1,000", "Three-digit subtraction within 1,000" and "Three-digit addition and subtraction within 1,000". The select lists them after the fact entries (`GeneratorControls.tsx:911-917`).
    - `describeThreeDigitFocus(group, regrouping)` returns the entry label, plus `REGROUPING_SUMMARY_PHRASE` (:127) when the choice is `required`. It is used by:
      - the status line (`registry.ts:341-349`), which on this strand always reads `Practice focus for Dry Math: <description>.`;
      - packet `detailOf` (`packet-session.ts:199-204`, made an exhaustive switch);
      - `focusOptionIdFor` (`GeneratorControls.tsx:252-258`), which selects the matching entry.
    - Carrying and borrowing shows (`registry.ts:437`), and fact families and earlier-settings seeding stay hidden (`GeneratorControls.tsx:276-282` returns `[]`).
    - `getLimitingResourceAdvice` (`registry.ts:415-421`) returns `DRY_MATH_FIXED_POOL_ADVICE` ("Dry Math has no further variation to offer for this practice focus. Create a new worksheet later."), which names no range control. `getRelevantMaximums` returns `NO_MAXIMUMS`.
  - **Random packet (R1):** Step 39's `largestNumber` switch gains `case "three-digit"`, which returns `DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM`; no level uses the strand before Step 55. One `random-packet.test.ts` test saves each `DRY_MATH_STRANDS` member as the parent's `dryMathStrand` and asserts that every Dry Math sheet at every level carries `add-subtract` or `multiply-divide`, the strands the level candidates set. Steps 42 and 43 inherit it unedited.
  - **Render and key:** `dryMathBlank` returns 8 underscores for this kind: 2 × the digit count of `DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM`, never typed in. Every earlier kind keeps `____`. The key line stays `638 + 287 = 925`.
  - **Print:**
    - Fixture `dry-math-three-digit-1000` (both operations, `required`) is placed after `dry-math-facts-144` (`matrix.ts:93-106`), with `printedOn` Letter/standard and A4/large.
    - Its boundary predicate is a three-digit-strand case of the Step 40 switch, and it searches for a subtraction from 1000.
    - `answerBlankViolations` runs on both rows with an expected digit count of 4, and the Step 40 1 px calibration repeats inside the new fixture's `fixture.id` block of the existing row test (no new `test()`).
    - This adds 2 print rows, 2 worksheet cases and 2 keys (4 surfaces).
  - **Docs and version:**
    - README extends the :167 bullet by one clause and the :22 controls sentence by the three-digit focus, and keeps the literal "within 20" (`frontend/scripts/audit-release.mjs:157`).
    - `educational-basis.md` updates its Numeric range row (:51), its Regrouping row (:53) and the `dry-math` section. The section explains place-value meaning only and makes no grade, readiness or fluency claim.
    - `testing-print.md` gets the new rows and counts.
    - The CLAUDE.md claim "addition and subtraction to 100" gains the three-digit strand.
    - CONTRIBUTING.md :106-108 adds `dryMathThreeDigit.operations` to the arrays capped at `MATH_OPERATIONS.length`.
    - `npm --prefix frontend version 1.6.0 --no-git-tag-version`.
- **Done when:**
  1. **Oracle and generator** (`dry-math/generator.test.ts`, `tests/integration/arithmetic-oracle.test.ts`):
     - For every operation subset × regrouping choice × length × scale, every item meets the domain rule. Addition operands are 100-999 with a sum of at most 1000. Subtraction has a minuend of 100-1000, a subtrahend of 100-999 and a difference of at least 0.
     - `regroups()` equals the requested choice, items are unique by `factKey`, and the oracle solves every row.
     - An exhaustive count by the oracle's own test-side enumerator equals `DRY_MATH_THREE_DIGIT_CAPACITY` (108,900 / 212,301 / 136,125 / 270,225). The enumerator uses the oracle's restated constants. This pool-equals-table test is the only drift guard between the table and the domain.
     - Inline known vectors pin seeds `00000001` and `0000abcd`. A fast-check property (about 200 runs) shows that every document validates and that the same seed with the other regrouping choice changes the items.
  2. **Negatives:**
     - Each of these fails with `GENERATION_INVARIANT_FAILED`: a two-digit operand, a sum above 1000, a negative difference, a regrouping mismatch, a duplicate, a multiplication item, or a malformed `operations` member.
     - Fail closed through the seam: `sampleThreeDigitItems` with `{ nextBounded: () => 0 }` (every draw gives 100 and 100) returns `undefined` for `required` after exactly 1 operation draw and 2 × `DRY_MATH_SAMPLE_ATTEMPTS` operand draws, and for `without` accepts one item and returns `undefined` on the second; it never returns a short list.
  3. **Availability, capacity and persistence** (`schema-parity`, `shipped-profile-options`, `project-request`, `earlier-settings`, `migrate`, `limit-labels`, `config-api`, `config-shape-fingerprint` tests):
     - Each of the three entries is available at every length and scale.
     - `measureDryMathCapacity` returns the table sum for each operation subset and choice, and `enumerateDryMathCandidates` throws for the kind. This proves that capacity and generation never enumerate, and it uses no wall-clock assertion.
     - `limit-labels.test.ts`: the sweep gains one source per entry; the Step 40 switches `dryArm` (:1430-1437) and `factsPage` (:1477-1478) gain a `three-digit` case; the new arm `NA-dry-math-fixed-pool` is declared reachable and is observed; `DSF-fixed-pool` is declared dead, with the note "every three-digit pool is at least `DRY_MATH_ITEM_BUDGETS.long` (18)".
     - `dryMathThreeDigit` and the new strand member have parity rows. `config-shape-fingerprint.test.ts` passes with the new probe and no snapshot repin.
     - `config-api.test.ts` gains a `describe.each` over new Dry Math defaults (Steps 42 and 43 add rows), modeled on `:617-670`: a fictional v2 file written without `dryMathThreeDigit` is read back with the group's default and its bytes are unchanged; a PUT setting `dryMathStrand: "three-digit"`, `dryMathThreeDigit: { operations: ["subtraction"] }` and `dryMathRegrouping: "required"` reads back equal with only those keys changed and the profiles untouched, and the stored file holds them.
     - Existing selections project byte-identical requests: `frontend/tests/fixtures/golden/practice-content-keys.json` and the existing known vectors are unchanged, and `generatorVersion` stays 1.
     - Switching to three-digit and back restores the stored `dryMath` focus.
     - The `random-packet.test.ts` strand pin test passes.
  4. **Wording, render and key** (`options.test.tsx`, `web/worksheets/registry.test.ts`, `math-generation.test.ts`, `packet-session.test.ts`):
     - The status line reads exactly `Practice focus for Dry Math: Three-digit addition and subtraction within 1,000, every problem carries or borrows.`, and without the regrouping phrase when the choice is `without`.
     - The select shows the chosen entry. The limiting-resource advice equals `DRY_MATH_FIXED_POOL_ADVICE` and contains neither "operand" nor "wider range".
     - A queued three-digit sheet's `describeQueuedSheet(...).detail` reads `Three-digit subtraction within 1,000`.
     - Reading only the rendered rows, the oracle re-solves each one. The child page shows `[data-answer-blank]` text of exactly 8 underscores (the literal in the test) and no answers.
     - The key restates each row with its oracle answer, and every earlier kind still renders `= ____`.
     - `createWorksheetSessionForSeed` returns a validated, oracle-equal three-digit document.
  5. **Browser and print** (`dry-math.spec.ts`, `print.spec.ts`, `ci-contract.test.ts`):
     - On the compiled app, each entry creates, previews and keys, and the regrouping radio changes the page.
     - The two new rows each print one worksheet page and one key page, with a row matching `^1000 − \d{3} = _{8}$` present and contained.
     - `answerBlankViolations` uses an expected digit count derived test-side from the oracle's restated 1000 (4 digits). It passes on both rows, the 1 px calibration fails, and the restored page passes.
     - `ci-contract.test.ts:48` (117 to 119, if Step 39 added no print row) and `docs/testing-print.md` (99/31/130 to 101/33/134) change by exactly +2 rows (+1 Letter/standard, +1 A4/large) and +2 worksheet cases / +2 keys / +4 surfaces. The per-cell expectation gains a `dryMathCells` map like `gridCells` (:62-66).
  6. **Version:** `frontend/package.json` and `frontend/package-lock.json` both read 1.6.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 40

### Step 42: Bigger multiplication and division
- **Status:** DONE (2026-10-29)
- **Problem:** A parent picks a Dry Math practice focus of two-digit × one-digit multiplication (such as 47 × 6), three-digit ÷ one-digit exact division (such as 852 ÷ 4), or both. Create, preview, key and print then give those problems with three-digit blanks, the status line and a queued packet row name the focus, and the choice survives a defaults save and a reload.
- **Type:** code
- **Issue:** #53
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: `frontend/src/worksheets/dry-math/{definition.ts,generator.ts,generator.test.ts}`; `frontend/src/shared/worksheet/{dry-math-blank.ts,dry-math-blank.test.ts,arithmetic.test.ts}`.
  - Shared: `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,earlier-settings.ts,earlier-settings.test.ts,practice-focus.ts,practice-focus.test.ts,migrate.test.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,worksheet-session.ts,worksheet-session.test.ts,options.test.tsx,math-generation.test.ts}`; `frontend/src/web/worksheets/registry.test.ts`; `frontend/src/web/packet/{packet-session.ts,packet-session.test.ts}` (`detailOf` case only, R1(b)); `frontend/src/web/packet/random-packet.test.ts` (one `largestNumber` case only, R1(a)).
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/integration/{arithmetic-oracle,schema-parity,shipped-profile-options,ci-contract,config-api,config-shape-fingerprint}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/{dry-math,print}.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Version and docs: `frontend/package.json`, `frontend/package-lock.json`; `README.md` (the :167 bullet); `docs/educational-basis.md` (:51 and the `dry-math` section); `docs/testing-print.md`; `CLAUDE.md` (Architecture summary :75); `CONTRIBUTING.md` (:106-108).
- **Produces:**
  - **Persisted (additive at v2):**
    - `DRY_MATH_STRANDS` gains `multi-digit`.
    - A new group `dryMathMultiDigit: { operations }` holds a nonempty canonical subset of `FACT_OPERATIONS` (the list itself is unchanged) and defaults to `["multiplication"]`, as a whole group.
    - Its refinement is registered in `PERSISTED_REFINEMENTS` (`schema.ts:80-93`) as `worksheet.dry-math-multi-digit.operations.canonical-order`, with a violation probe (`["division", "multiplication"]`) in `config-shape-fingerprint.test.ts:371-409`.
    - The group gets a transport mirror and an entry in the `optional` list (`transport-schemas.ts:219`, `:275-283`, `:377-381`).
    - CONTRIBUTING.md adds `dryMathMultiDigit.operations` to the arrays capped at `FACT_OPERATIONS.length`.
  - **Constants** (`types.ts`):
    - `DRY_MATH_TWO_DIGIT_MINIMUM = 10`, `DRY_MATH_TWO_DIGIT_MAXIMUM = 99`, `DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM = 2` and `DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM = 9` (Design defaults, Dry Math 4).
    - The dividend bounds reuse Step 41's `DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM/MAXIMUM`.
  - **Request and generator:** practice kind `{ kind: "dry-math-multi-digit", operations }`. `getDryMathCapabilitySupport` gains the case, available whenever `equations` is present.
    - The pool is small, so the existing enumerate-then-`seededShuffle` pattern applies, in canonical order.
    - Multiplication runs by left factor 10-99, then right factor 2-9: 720 problems with products up to 891.
    - Division runs by divisor 2-9, then quotient, keeping dividends 100-999: 1,645 exact divisions with quotients 12-499.
    - Capacity is the enumeration length, through `measureDryMathCapacity`.
    - A fourth invariant branch, `multiDigitItemHolds`, is added, and the oracle gains a multi-digit focus.
  - **Controls and wording (R2):** `MULTI_DIGIT_PRACTICE_ENTRIES` adds three entries after the three-digit ones: "Two-digit × one-digit multiplication", "Three-digit ÷ one-digit division" and "Two-digit × one-digit and three-digit ÷ one-digit".
    - `describeMultiDigitFocus(group)` returns the entry label. The status line reads `Practice focus for Dry Math: <label>.`. Packet `detailOf` and `focusOptionIdFor` use the same helper.
    - Carrying and borrowing and fact families are hidden for this strand.
    - The advice is `DRY_MATH_FIXED_POOL_ADVICE`, and `getRelevantMaximums` returns `NO_MAXIMUMS`.
  - **Random packet (R1(a)):** `largestNumber` gains `case "multi-digit"`: `DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM` when division is chosen, otherwise `DRY_MATH_TWO_DIGIT_MAXIMUM × DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM`. Step 41's strand pin test covers the member unedited.
  - **Render and key:** the blank is 6 underscores (2 × the digit count of max(99 × 9, ⌊999 ÷ 2⌋) = 891, derived from the constants). The key reads `47 × 6 = 282` and `852 ÷ 4 = 213`.
  - **Print:** fixture `dry-math-multi-digit` (both operations), Letter/standard only.
    - Its boundary predicate searches for a product of at least 800 (11 of the 720 products qualify) and a quotient of at least 100 (1,031 of the 1,645 divisions), so the page carries rows that fill the 6-underscore blank.
    - `operatorViolations` and `answerBlankViolations` and their 1 px calibrations run inside the new fixture's `fixture.id` block of the existing row test, as the facts row does at `print.spec.ts:1044-1050` (no new `test()`).
    - This adds 1 row, 1 worksheet case and 1 key.
  - **Docs and version:**
    - README extends the :167 bullet and keeps the literal "within 20".
    - `educational-basis.md` updates the :51 range row and the `dry-math` section.
    - `testing-print.md` is updated.
    - The CLAUDE.md claim "multiplication and division facts to 12 × 12" gains the new strand.
    - `npm --prefix frontend version 1.7.0 --no-git-tag-version`.
- **Done when:**
  1. **Oracle and generator:**
     - Enumeration counts equal 720 and 1,645. Every item has a two-digit left factor and a one-digit right factor from 2 to 9, or a three-digit dividend that its divisor from 2 to 9 divides exactly.
     - Items are unique and oracle-equal. Inline known vectors pin two seeds, and one fast-check property (about 200 runs) validates every document.
     - A same-seed mirror with the other operation subset changes the items.
  2. **Negatives:** each of these fails with `GENERATION_INVARIANT_FAILED`: a one-digit left factor, a ×1 or ×10 right factor, an inexact or two-digit-dividend division, a divisor of 0, 1 or 10, a four-digit dividend (1000 ÷ 2, the only way to reach a quotient above 499; the spec's invariant has no separate quotient bound, so this case proves the dividend check), an addition item, or a duplicate.
  3. **Availability and persistence:**
     - All three entries are available at every length and scale.
     - Parity rows exist for `dryMathMultiDigit` and the new strand member. The fingerprint passes with the new probe and no snapshot repin.
     - `config-api.test.ts`'s Step 41 `describe.each` gains a row: a fictional v2 file without `dryMathMultiDigit` reads back with its default and unchanged bytes, and a PUT of `dryMathStrand: "multi-digit"` with `dryMathMultiDigit: { operations: ["division"] }` reads back equal with only those keys changed and the profiles untouched.
     - `limit-labels.test.ts` adds one sweep source per entry. They are observed under `NA-dry-math-fixed-pool`, and `DSF-fixed-pool` stays dead (every pool is at least 720).
     - Goldens, existing known vectors and `generatorVersion` are unchanged.
     - Switching from multi-digit to facts and back restores both `dryMathFacts` and `dryMathMultiDigit`.
  4. **Wording, render and key:**
     - The status line reads exactly `Practice focus for Dry Math: Two-digit × one-digit and three-digit ÷ one-digit.`.
     - A queued sheet's detail reads `Three-digit ÷ one-digit division`.
     - The advice contains no "wider range".
     - The oracle re-solves every rendered row with `parseRenderedRow`. Blanks are exactly 6 underscores (a test literal), and the key restates each row with its oracle answer.
     - `createWorksheetSessionForSeed` returns a validated, oracle-equal multi-digit document.
  5. **Browser and print:**
     - The compiled-app journey creates, previews and keys each entry.
     - The new row prints one worksheet page and one key page, with `^\d{2} × \d = _{6}$` and `^\d{3} ÷ \d = _{6}$` rows present and contained, including a product of at least 800 and a quotient of at least 100.
     - `operatorViolations` and `answerBlankViolations` pass on the row. The expected digits are 3, derived from the oracle's restated constants. Their 1 px calibrations fail, and the restored page passes.
     - The ci-contract and testing-print counts change by exactly +1 row (Letter/standard; the `dryMathCells` map), +1 worksheet case and +1 key.
  6. **Version:** `frontend/package.json` and `frontend/package-lock.json` both read 1.7.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 41

### Step 43: Division with remainders
- **Status:** PENDING
- **Problem:** A parent picks the Dry Math practice focus "Division with remainders". Create, preview, key and print then give problems such as 47 ÷ 5 = ____ R __, whose key reads 47 ÷ 5 = 9 R 2. The status line and a queued packet row say "Division with remainders", and the choice survives a defaults save and a reload.
- **Type:** code
- **Issue:** #54
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: `frontend/src/worksheets/dry-math/{definition.ts,generator.ts,generator.test.ts}`; `frontend/src/web/worksheets/dry-math/Renderer.tsx`; `frontend/src/shared/worksheet/{dry-math-blank.ts,dry-math-blank.test.ts}`; `frontend/src/worksheets/count-compare-make/generator.ts` (`sameAnswer` only).
  - Shared: `frontend/src/shared/worksheet/{types.ts,invariants.ts,answer-oracle.ts,answer-oracle.test.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,practice-focus.ts,practice-focus.test.ts}`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,worksheet-session.ts,worksheet-session.test.ts,options.test.tsx,math-generation.test.ts}`; `frontend/src/web/print/AnswerKeyView.tsx`; `frontend/src/web/worksheets/registry.test.ts`; `frontend/src/web/packet/{packet-session.ts,packet-session.test.ts}` (`detailOf` case only, R1(b)); `frontend/src/web/packet/random-packet.test.ts` (one `largestNumber` case only, R1(a)).
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/integration/{arithmetic-oracle,schema-parity,shipped-profile-options,ci-contract,config-api}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/{dry-math,print}.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Version and docs: `frontend/package.json`, `frontend/package-lock.json`; `README.md` (the :167 bullet, "every division is exact"); `docs/educational-basis.md` (:51 range, :52 Sign row and :77 in the `dry-math` section, both "every division is exact", plus a remainders paragraph); `docs/testing-print.md`; `CLAUDE.md` (the Architecture summary claim "every division is exact", :75).
- **Produces:**
  - **Persisted (additive at v2):** `DRY_MATH_STRANDS` gains `remainders`. There is no new group, because the domain is fixed (Design defaults, Dry Math 3), so no refinement or fingerprint probe is added.
  - **Constants** (`types.ts`): `DRY_MATH_REMAINDER_DIVIDEND_MINIMUM = DRY_MATH_TWO_DIGIT_MINIMUM` and `DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM = DRY_MATH_TWO_DIGIT_MAXIMUM`. The divisor runs over Step 42's one-digit factor range, 2-9.
  - **Answer kind:**
    - `ObjectiveAnswerV1` (`types.ts:264-275`) gains `{ kind: "quotient-remainder", quotient, remainder }`. `DryMathItemV1.answer` (`types.ts:299`) widens to `number | quotient-remainder`.
    - `dryMathAnswer` (`answer-oracle.ts:47-61`) chooses the kind from the item's own stored `answer.kind`:
      - a quotient-remainder item with a nonzero divisor recomputes `{ quotient: ⌊l ÷ r⌋, remainder: l mod r }`;
      - a number-kind division still has an answer only when it is exact, so an inexact fact keeps no answer and the existing `answer-oracle.test.ts` expectation stands;
      - the docblock at `:43-46` states the new rule.
    - `objectiveAnswerMatches` gains a field-wise quotient-remainder branch before `:233`, like the grid branch at `:222-232`.
    - `AnswerKeyView.tsx` `answerText` (`:58-80`, an exhaustive switch) gains `case "quotient-remainder"`, which prints `9 R 2`.
    - Compile surface of the new member, found by `npm --prefix frontend run typecheck` and fixed by narrowing on `answer.kind`, never by a cast:
      - `count-compare-make/generator.ts:436-445` `sameAnswer` reads `.value` on any `ObjectiveAnswerV1`, so it compares per kind (an exhaustive switch on `actual.kind`). Count, Compare & Make never produces the new kind, so its behavior is unchanged; Step 50 adds only its own case.
      - Dry Math `answer.value` readers: `invariants.ts:170-172`, `required-content.ts:219-223`, `dry-math/generator.test.ts` (:411, :447-448, :620, :809, :993), `tests/integration/arithmetic-oracle.test.ts` (:226, :258, :400, :431) and `web/worksheets/registry.test.ts:796-801`, plus any further site typecheck names.
  - **Invariants:**
    - The universal Dry Math gate at `invariants.ts:536-545` drops its `item.answer.kind !== "number"` clause and keeps only `objectiveAnswerMatches(item) !== true`. The kind check moves into the branches:
      - `addSubtractItemHolds` (:150), `factItemHolds` (:200), `threeDigitItemHolds` and `multiDigitItemHolds` each require the number kind, which also narrows `:170-172` for the compiler;
      - only the new `remaindersItemHolds` accepts quotient-remainder.
    - The answerability check at `:521-527` adds `Number.isSafeInteger` for `quotient` and `remainder`.
    - `remaindersItemHolds` requires `quotient × divisor + remainder = dividend`, `1 ≤ remainder < divisor`, quotient ≥ 1, a dividend of 10-99 and a divisor of 2-9.
  - **Request and generator:** practice kind `{ kind: "dry-math-remainders" }`. `getDryMathCapabilitySupport` gains the case.
    - The pool is enumerated by divisor 2-9, then dividend 10-99, keeping every non-multiple. That gives 556 problems, with quotients 1-49 and remainders 1 to divisor − 1.
    - Items are built with the quotient-remainder answer. Today the generator's item map (`generator.ts:247-257`) writes `{ kind: "number" }` unconditionally at `:256`; Step 41 made that per-kind, and this step adds the remainders case.
  - **Controls and wording (R2):** one entry, "Division with remainders", after the multi-digit entries. The status line reads `Practice focus for Dry Math: Division with remainders.`, and packet `detailOf` reads `Division with remainders`. Every other choice is hidden for this strand. The advice is `DRY_MATH_FIXED_POOL_ADVICE`.
  - **Random packet (R1(a)):** `largestNumber` gains `case "remainders"`, returning `DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM`. Step 41's strand pin test covers the member unedited.
  - **Render and key:**
    - `dryMathBlank` returns `{ kind: "remainder", quotient: 4, remainder: 2 }` underscores: 2 × the digit counts of 49 and 8, derived from the constants.
    - The child page renders `L ÷ R = <span data-answer-blank="quotient">____</span> <span data-remainder-mark>R</span> <span data-answer-blank="remainder">__</span>`.
    - The row's aria-label reads "47 divided by 5, answer and remainder".
    - The key prints `47 ÷ 5 = 9 R 2`, with `data-answer-value="9 R 2"`.
  - **Test readers:**
    - `required-content.ts:219-223` gains a quotient-remainder branch. It computes `⌊left ÷ right⌋ R left mod right` from the item's operands, not from the stored answer. Its row literal is `= ____ R __`.
    - In `arithmetic-oracle.ts`:
      - the Dry Math reader at `:456` reads the pair;
      - `parseRenderedRow` (`:494`) adds an optional ` R _+`;
      - `solveRow` (`:509-523`) returns `{ quotient, remainder }` only for rows parsed with ` R _+`. An R-less inexact division still returns `undefined`, so the oracle still catches an inexact fact.
  - **Print:**
    - Fixture `dry-math-remainders`, `printedOn` Letter/standard and A4/large.
    - `answerBlankViolations` runs with expected digits of 2 for the quotient blank and 1 for the remainder blank, from the oracle's restated constants.
    - An R-mark ink check requires the mark to be visible and at least 2 mm wide.
    - All measurements and calibrations run inside the new fixture's `fixture.id` block of the existing row test (no new `test()`).
    - This adds 2 rows, 2 worksheet cases and 2 keys (4 surfaces).
  - **Docs and version:**
    - README updates "every division is exact" (division facts and the multi-digit strand are exact; the remainders focus leaves a remainder) and keeps the literal "within 20".
    - `educational-basis.md` updates the range row, the Sign row and the `dry-math` section sentence at :77, and adds a remainders paragraph.
    - `testing-print.md` is updated.
    - The CLAUDE.md claim is updated to match.
    - `npm --prefix frontend version 1.8.0 --no-git-tag-version`.
- **Done when:**
  1. **Oracle and generator:**
     - The enumeration count equals 556, and every item satisfies the remainder identity with `1 ≤ remainder < divisor`.
     - The independent oracle's `oracleDivide` agrees with every item. `parseRenderedRow` accepts `^\d+ ÷ \d+ = _+ R _+$`, and `solveRow` returns the pair for such rows. An R-less `47 ÷ 5 = ____` row still solves to `undefined`.
     - Inline known vectors include 47 ÷ 5 → 9 R 2. A fast-check property (about 200 runs) validates every document.
  2. **Negatives:**
     - Each of these fails with `GENERATION_INVARIANT_FAILED`:
       - an exact division on a remainders page;
       - a remainder of 0, or one at least the divisor;
       - a wrong quotient;
       - the number kind on a remainders page;
       - the quotient-remainder kind on an add-subtract, facts, three-digit or multi-digit page;
       - a non-integer `quotient` or `remainder`;
       - a three-digit dividend;
       - a divisor of 1 or 10.
     - `answer-oracle.test.ts` keeps its expectation that a number-kind inexact division has no answer. A new row shows that the quotient-remainder kind is recomputed for 47 ÷ 5, and that a quotient-remainder addition item does not match.
     - Count, Compare & Make's generator tests pass unedited after the `sameAnswer` change.
  3. **Availability and persistence:**
     - The entry is available at every length and scale, and the strand member has a parity row.
     - `config-api.test.ts`'s Step 41 `describe.each` gains a row: a fictional v2 file written before the member reads back unchanged with unchanged bytes, and a PUT of `dryMathStrand: "remainders"` reads back equal with only that key changed and the profiles untouched.
     - `limit-labels.test.ts` observes the entry under `NA-dry-math-fixed-pool`.
     - The fingerprint passes without a repin. Goldens, existing known vectors and `generatorVersion` are unchanged.
     - Two existing tests must stay green, with no edit: `tests/integration/config-upgrade.test.ts:250` and `src/shared/config/migrate.test.ts:407`. They show the same unknown-enum rule, on `worksheetType` (`"skip-counting"`): an unknown enum member in defaults classifies as `blocked`, which is what an older build sees in a saved `dryMathStrand: "remainders"`.
  4. **Wording, render and key:**
     - The status line and the queued-sheet detail read exactly as stated above.
     - Reading only the rendered rows, the oracle re-solves each quotient and remainder. The child page shows both blanks (exactly `____` and `__`) and the R mark, with no answers.
     - The key's quotient and remainder equal the oracle's.
     - `createWorksheetSessionForSeed` returns a validated, oracle-equal remainders document.
  5. **Browser and print:**
     - The compiled-app journey creates, previews and keys the page.
     - Each new row prints one worksheet page and one key page, with `^\d{2} ÷ \d = _{4} R _{2}$` rows present and contained.
     - Each of these fails, and the restored page passes: hiding the R mark (`[data-remainder-mark]{visibility:hidden}`), collapsing the quotient blank (`[data-answer-blank="quotient"]{font-size:1px}`) and collapsing the remainder blank (`[data-answer-blank="remainder"]{font-size:1px}`).
     - The ci-contract and testing-print counts change by exactly +2 rows (+1 Letter/standard, +1 A4/large in `dryMathCells`), +2 worksheet cases and +2 keys.
  6. **Version:** `frontend/package.json` and `frontend/package-lock.json` both read 1.8.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 42

### Step 44: Mixed-up grid headers
- **Status:** PENDING
- **Problem:** A parent choosing Operation Grid can mix up the order of the row and column numbers. The child then has to recall each fact rather than count along a row. The parent does this through the existing Create, preview, key and print journey.
- **Type:** code
- **Issue:** #55
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Family: `frontend/src/worksheets/operation-grid/{definition.ts,generator.ts,generator.test.ts}`; `frontend/src/web/worksheets/operation-grid/Renderer.test.tsx` (the Renderer does not change: its keys at `Renderer.tsx:88,96,113` need headers that are distinct within each axis, which a permutation keeps).
  - Shared: `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts,answer-oracle.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,migrate.test.ts,earlier-settings.test.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts,worksheet-session.test.ts}`; `frontend/src/web/worksheets/registry.test.ts`.
  - Packet, only as Decision Inventory R1 allows:
    - `frontend/src/web/packet/packet-session.test.ts:239-247`, under R1(a) and R1(b). The literal becomes `{ ...BASE_SELECTION.operationGrid, ... }` (`BASE_SELECTION` is at :51), and the step adds a wording test for a mixed grid's queued-sheet detail.
    - `frontend/src/web/packet/random-packet.test.ts`: one leak test, under R1(c).
    - `random-packet.ts` is not edited, unless its `grid()` still writes a five-field literal (today `random-packet.ts:124-135`). Then R1(a) applies: spread `DEFAULT_WORKSHEET_DEFAULTS_V2.operationGrid`, never `selection.operationGrid`, so the parent's header order never reaches a packet sheet.
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`; `frontend/tests/integration/{arithmetic-oracle,schema-parity,shipped-profile-options,config-api}.test.ts`; `frontend/tests/fixtures/print/matrix.ts` (the 3 literal sites at :130, :146 and :165 spread `...shippedSelection.operationGrid`, with no new row); `frontend/tests/e2e/fixtures/worksheet-controls.ts`; `frontend/tests/e2e/{operation-grid,release-smoke,accessibility}.spec.ts`.
  - Version: `frontend/package.json`, `frontend/package-lock.json`.
  - Docs: `README.md` (:16 table row, :22 clause), `docs/educational-basis.md`, `CLAUDE.md`.
- **Produces:**
  - **Persisted field** (additive at schemaVersion 2):
    - `enums.ts` (after :62) adds `OPERATION_GRID_HEADER_ORDERS = ["in-order", "mixed"]`. No array bound derives from it.
    - `operationGrid` gains `headerOrder`, with the Zod default `DEFAULT_OPERATION_GRID_HEADER_ORDER = "in-order"` (beside `schema.ts:170-173`).
    - `headerOrder` is listed in the transport optional list (`transport-schemas.ts:272`), and the outer default objects (`schema.ts:241-247`, `defaults.ts:66-72`) gain it.
    - There is no schemaVersion 3, and no file is rewritten on read.
  - **Generator:**
    - `chooseGivenCells` (`generator.ts:49-66`, called only at :116) takes the generator's one `SeededRandom` in place of creating its own, so its draws are unchanged.
    - Only under `mixed`: the row headers, then the column headers, are each a seeded shuffle of 1..count drawn after the given cells. An axis that comes out ascending has its first two headers swapped, with no extra draw.
    - Cells are computed from the printed headers.
    - `generatorVersion` stays 1. Today's choices give byte-identical requests and documents.
  - **Request:** the `operation-grid` practice member carries `headerOrder: "mixed"` only when the order differs from `DEFAULT_OPERATION_GRID_HEADER_ORDER`. This follows the Dry Math "without" precedent.
  - **Refusal:** Diagonal first with mixed headers is refused by a new third branch of the diagonal chain at `definition.ts:163-169` (sentence in the spec).
  - **Controls:** a "Header order" radio group ("In order" / "Mixed up"), placed after the Grid size fieldset and before Placement.
  - **Wording (Decision Inventory R2):**
    - `describeOperationGrid` (`definition.ts:217-220`) is the one owner. It appends `OPERATION_GRID_MIXED_SUMMARY_PHRASE` (", row and column numbers mixed up") only when the headers are mixed. It feeds the status line after Create (`registry.ts:688`, rendered at `GeneratorControls.tsx:1050-1051`) and every packet row (`packet-session.ts:216`).
    - Advice owner: `operationGridLimitingResourceAdvice(choices)` in `definition.ts` returns `OPERATION_GRID_LIMITING_RESOURCE_ADVICE` (:210-211, byte-identical) in order, and `OPERATION_GRID_MIXED_LIMITING_RESOURCE_ADVICE` = "Operation Grid varies in its header order and in which cells are pre-filled. Choose Random placement or a different number of pre-filled cells, or create a new worksheet later." when mixed. The registration lambda at `registry.ts:693` becomes `({ selection }) => operationGridLimitingResourceAdvice(selection.operationGrid)`, as at `registry.ts:524`.
  - **Print:** no new matrix row. Mixed order prints exactly the same header values, cell count, digit counts and CSS as an in-order grid of the same size, so it does not affect print geometry. The compiled spec still prints each surface to one PDF page.
  - **Version:** `npm --prefix frontend version 1.9.0 --no-git-tag-version`.
  - **Docs:** the README table row (:16) and clause (:22), keeping the literal "within 20" (`frontend/scripts/audit-release.mjs:157`); the educational-basis rows (:50) and section (:118-131); the CLAUDE.md current state.
- **Done when:**
  1. **Oracle and generator** (`arithmetic-oracle.test.ts`, `generator.test.ts`):
     - Every operation, at every legal size and both orders, matches the independent oracle cell by cell.
     - In order, the headers are exactly 1..count. Mixed up, each axis is a permutation of 1..count and is never ascending, including at size 2.
     - One fast-check property (about 200 runs) shows every document validates.
     - A mirror case uses the same seed and size in order and mixed up: the headers differ, the given indexes are equal, and every cell equals its own headers' value.
     - The known vectors at `generator.test.ts:243-263` still pass unchanged, and one new inline vector pins a mixed page.
  2. **Negatives:** each of these fails `GENERATION_INVARIANT_FAILED`:
     - a repeated header, a header outside 1..count, or an ascending mixed axis;
     - a cell that does not match its headers;
     - a request that writes `headerOrder: "in-order"` explicitly (non-canonical).

     Diagonal first with mixed headers is refused by the new sentence, and the invariant rejects the same request.
  3. **Availability and refusal** (`limit-labels.test.ts`, `shipped-profile-options.test.ts`):
     - Two new `OPERATION_GRID_SOURCES` entries (`limit-labels.test.ts:1199-1236`): "diagonal mixed" reaches the existing `REG-operation-grid-UNAVAIL` arm on its own, and "mixed random" (Random placement) is available, so the mixed advice is observed. The UNAVAIL note at :387-388 names mixed headers on Diagonal first, and the `NA-operation-grid` note (:526-530) says its advice also names the header order when mixed.
     - The `NA-operation-grid` branch (:1495-1503) expects, per source, `OPERATION_GRID_MIXED_LIMITING_RESOURCE_ADVICE` when `selection.operationGrid.headerOrder === "mixed"` and `OPERATION_GRID_LIMITING_RESOURCE_ADVICE` otherwise, choosing between the two constants directly rather than calling the owner.
     - The new diagonal sentence is pinned exactly beside the Diagonal first refusal test (:2137-2148), and every existing refusal sentence (:2104-2183) is byte-identical.
  4. **Persistence** (`schema-parity.test.ts`, `project-request.test.ts`, `migrate.test.ts`, `config-api.test.ts`):
     - `$.defaults.operationGrid.headerOrder` has a parity row (beside :309-336), and the expected default object (:586) gains the default.
     - A v2 file whose `operationGrid` lacks `headerOrder`, and a v2 file without `operationGrid`, both parse to the default and are never rewritten.
     - `config-api.test.ts` (beside the `describe.each` at :617-667): a PUT of a fictional config whose `operationGrid.headerOrder` is `mixed` GETs back equal, with only that key changed and the profile untouched; a file written with an `operationGrid` lacking `headerOrder` GETs `in-order` and its bytes stay unchanged.
     - `config-shape-fingerprint.test.ts` passes without a repin, since `operationGrid` is not pinned.
     - The default selection projects exactly today's five-field member.
  5. **Wording** (`options.test.tsx`, `limit-labels.test.ts`, `packet-session.test.ts`, `registry.test.ts`):
     - The default status line stays byte-identical (`options.test.tsx:2108`, `limit-labels.test.ts:2183`).
     - A mixed grid's status line ends with ", row and column numbers mixed up.".
     - A queued mixed grid's packet detail ends with ", row and column numbers mixed up" (R1(b) wording test).
  6. **Render and session** (`Renderer.test.tsx`, `math-generation.test.ts`):
     - Reading only the rendered table of a mixed 10 × 10 multiplication grid: the headers are that permutation, the given cells equal the oracle, the blank cells are empty, and every key cell equals the oracle.
     - `createWorksheetSessionForSeed` with mixed headers returns a validated, oracle-equal document (`judgeOperationGridDocument` returns `[]`).
  7. **Packet leak** (`random-packet.test.ts`, R1(c), until Step 55 replaces it with its level table): with a session selection whose `operationGrid.headerOrder` is `mixed`, every Operation Grid sheet `makeRandomPacket` makes at every level has a request member without `headerOrder` and headers exactly 1..count.
  8. **Browser** (`operation-grid.spec.ts`, `release-smoke.spec.ts`, `accessibility.spec.ts`):
     - On the compiled app, a mixed 10 × 10 multiplication grid is created, previewed, keyed and printed to one page per surface, and `judgeGridTable` passes on both tables.
     - Saving as worksheet defaults, then reloading, keeps Mixed up.
     - The existing release smoke passes unchanged.
     - Keyboard walk (the grid test, between Columns at :636 and Placement at :637): `tabTo` reaches the checked In order radio with visible focus; ArrowDown checks and focuses Mixed up, and `[data-selection-summary]` then contains ", row and column numbers mixed up"; ArrowUp restores In order, so the later Diagonal preset walk is unchanged. axe stays clean.
  9. **Version:** `frontend/package.json` and `package-lock.json` both read 1.9.0.
  10. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 43

### Step 45: Grid headers that start above 1
- **Status:** PENDING
- **Problem:** A parent choosing Operation Grid can start the row and column numbers above 1, for example rows and columns 6 to 15, in order or mixed up. The child then practises sums and products past the times-table range. The parent does this through the existing Create, preview, key and print journey.
- **Type:** code
- **Issue:** #56
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Everything Step 44 lists. `random-packet.test.ts` gets one more leak case (no new test file).
  - Print: `frontend/tests/e2e/fixtures/print-checks.ts`, `frontend/tests/e2e/print.spec.ts`, `frontend/tests/fixtures/print/matrix.ts` (one new row), `frontend/tests/integration/ci-contract.test.ts`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted fields** (additive at schemaVersion 2):
    - `operationGrid` gains `rowStart` and `columnStart`. Each is an integer from `OPERATION_GRID_HEADER_START_MINIMUM` (1) to `OPERATION_GRID_HEADER_START_PERSISTED_MAXIMUM` (98), with the Zod default `DEFAULT_OPERATION_GRID_HEADER_START` (1).
    - Both are in the transport optional list and the outer default objects.
    - The persisted bound is its own constant. It is never derived from a refusal ceiling (Decision Inventory R3).
  - **Bounds** (refusal-only, fail closed, no narrowing):
    - `OPERATION_GRID_HEADER_MAXIMUM` (99): the last header of any axis.
    - `OPERATION_GRID_CELL_MAXIMUM` (999): every addition or multiplication cell. Sums reach at most 198, and the last row header times the last column header must be at most 999, so every new cell keeps three digits.
    - Powers: the last base is at most 10 and the last exponent at most 3. Cells stay at most 1,000.
    - Diagonal first needs equal starts.
  - **Generator:** headers are `headersFrom(start, count)`, then mixed exactly as in Step 44. `generatorVersion` stays 1, and defaults stay byte-identical.
  - **Request:** `rowStart` and `columnStart` are carried only when they differ from `DEFAULT_OPERATION_GRID_HEADER_START`.
  - **Controls:**
    - "First row number" and "First column number" inputs (1–98) go inside the Grid size fieldset, after Columns.
    - One sentence is added to `OPERATION_GRID_SIZE_HELP` (`definition.ts:74`).
  - **Wording (Decision Inventory R2):** `describeOperationGrid` writes "{n} rows from {s} to {last}" (and the same for columns) only when a start is not 1. It feeds the status line, the packet row and the summary.
  - **Print:**
    - A per-cell text check in `print-checks.ts`.
    - Matrix row `grid-multiplication-offset-mixed`: 12 × 12 multiplication, with rows and columns starting at `largest square header − 12 + 1` (headers 20–31, written as a derived expression, never a bare literal), mixed up, 72 cells given at random, printed on Letter/standard and A4/standard. Products run 400–961.
    - A CSS calibration.
    - The counts move by exactly +2 worksheet cases, +2 keys and +4 surfaces.
  - **Version:** `npm --prefix frontend version 1.10.0 --no-git-tag-version`.
  - **Docs:**
    - The README :16/:22 headers wording, keeping the literal "within 20" (`frontend/scripts/audit-release.mjs:157`).
    - The educational-basis :50-51 rows and section, with the 2.NBT and 4.NBT sources.
    - The testing-print counts, table row and grid paragraph.
    - CLAUDE.md :75 and the current state.
- **Done when:**
  1. **Oracle and generator:**
     - For every operation, both orders and a sweep of legal starts (including the boundaries: start 98 for 2-row addition, a last header of 99, and a product of 999 against 1,000), every cell equals the oracle computed from its own row and column headers.
     - In order, the headers are exactly start..start + count − 1. Mixed up, they are a permutation of that range and are never ascending.
     - A fast-check property (about 200 runs) holds.
     - A mirror case uses the same seed and size with starts 1 and 6: the given indexes are equal, and the headers are shifted by 5.
     - New inline vectors pin one offset in-order page and one offset mixed page.
     - The existing known vectors are unchanged.
  2. **Negatives** (`GENERATION_INVARIANT_FAILED`):
     - a header outside its range;
     - an explicit `rowStart: 1` or `columnStart: 1`;
     - a start above 98, or a last header above 99;
     - a non-powers cell above 999, or a product above 999;
     - a powers base above 10 or an exponent above 3 caused by a start;
     - Diagonal first with unequal starts.

     The powers cell ceiling test (`generator.test.ts:368-373`) replaces its multiplication and addition `1,001 → true` assertions with `999 → true` and `1,000 → false`. Its powers assertions are unchanged. Today's documents never exceed 144, so no existing document changes.
  3. **Refusals** (`limit-labels.test.ts`, `shipped-profile-options.test.ts`):
     - Six new `OPERATION_GRID_SOURCES` entries each reach the `REG-operation-grid-UNAVAIL` arm on its own: row header ceiling, column header ceiling, product ceiling, powers row start, powers column start, and diagonal unequal starts. The UNAVAIL note (:387-388) names them, and each new sentence is pinned exactly beside the existing refusal tests (:2104-2183).
     - Pair cases prove the precedence rules in the spec:
       - powers with start 5 and 12 rows gives only the start sentence;
       - powers with start 95 gives no 99 sentence;
       - multiplication columns 95–104 gives the header sentence and no product sentence.
     - With both starts at 1, every existing sentence is byte-identical.
     - `persisted start maximum ≥ OPERATION_GRID_HEADER_MAXIMUM − OPERATION_GRID_SIZE_MINIMUM + 1` is asserted.
  4. **Persistence:**
     - Parity rows exist for both fields.
     - A v2 file lacking them parses to 1 and is never rewritten.
     - `config-api.test.ts`: a PUT with `rowStart: 6` and `columnStart: 11` GETs back equal, with only those keys changed and the profile untouched; a file written without them GETs 1 and its bytes stay unchanged.
     - The fingerprint passes without a repin.
     - The default projection is unchanged.
  5. **Wording and render:**
     - The status line and the packet detail (R1(b)) for a 6–15 mixed grid read "…, 10 rows from 6 to 15 by 10 columns from 6 to 15, …, row and column numbers mixed up".
     - The default text is byte-identical.
     - The rendered 6–15 table and its key equal the oracle.
     - `createWorksheetSessionForSeed` with offset starts returns a validated, oracle-equal document.
     - The packet leak test (R1(c), until Step 55) also sets the session's `rowStart` and `columnStart` to 6: no packet grid's request member carries either field.
  6. **Browser and print:**
     - On the compiled app, a mixed 6–15 × 6–15 multiplication grid and an in-order addition grid (rows starting at 21, columns starting at 11, 10 × 10) are created, previewed and keyed, and `judgeGridTable` passes.
     - Rows from 95 with 10 rows are refused before Create with the 99 sentence.
     - Saving defaults, then reloading, keeps both starts.
     - The keyboard walk in `accessibility.spec.ts` `tabTo`s First row number and First column number, each with visible focus, between Columns (:636) and Step 44's Header order radios.
     - The new matrix row prints one worksheet page and one key page on Letter and A4. Every cell is at least the handwriting size, and no number leaves its own cell.
     - Calibration on every grid row: `.print-surface [data-grid-given] { letter-spacing: 4mm !important }`, injected through `withPrintStyle`, must produce a `text outside cell:` violation and then restore clean. The existing collapsed-cell and cut-short calibrations still fail and then restore clean.
     - `packet-print.spec.ts` runs the new per-cell check unchanged, and its count stays 3 (`ci-contract.test.ts:98-100`).
     - `ci-contract.test.ts`: the listed count (:48) rises by 2, `gridCells` (:62-66) `letter-standard` and `a4-standard` each rise by 1, and the comments at :46-47 and :56-61 are updated. `docs/testing-print.md` moves by +2 worksheet cases, +2 keys and +4 surfaces.
  7. **Version:** `package.json` and `package-lock.json` both read 1.10.0.
  8. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 44

### Step 46: Number Bonds within 50 and 100
- **Status:** PENDING
- **Problem:** A parent picks Number Bonds, chooses a practice focus such as "Addition and subtraction within 100", and can also choose "Every problem carries or borrows". They then create, preview and print missing number sentences whose wholes go up to 50 or 100. When a page can need a three-digit answer, its answer box is wide enough to write one, and the status line, the summary and a queued packet row all say "within 100".
- **Type:** code
- **Issue:** #57
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,practice-focus.ts,practice-focus.test.ts}`, `frontend/src/server/transport-schemas.ts`, `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,limit-labels.test.ts}`.
  - Family: `frontend/src/worksheets/number-bonds/{definition.ts,generator.ts,generator.test.ts}`, `frontend/src/web/worksheets/number-bonds/{Renderer.tsx,Renderer.test.tsx}`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts}`, `frontend/src/web/styles/tokens.css`, `frontend/src/web/worksheets/registry.test.ts` (also its catalog sweep and length pin, Done-when 2).
  - Compile-only literal updates: every typed `numberBonds` literal `tsc` reports spreads the default group (`...DEFAULT_WORKSHEET_DEFAULTS_V2.numberBonds`) instead of hand-writing `wideRange`. Today: `src/shared/config/{earlier-settings.test.ts:205,migrate.test.ts:492}`, `src/shared/worksheet/{limit-labels.test.ts:1181,project-request.test.ts:702}`, `src/web/generator/options.test.tsx:2039`, `src/web/worksheets/registry.test.ts:1118`, `tests/integration/shipped-profile-options.test.ts:448`, `tests/fixtures/print/matrix.ts:113`, and, under Decision Inventory R1(a), `src/web/packet/packet-session.test.ts:224`. `src/web/packet/random-packet.ts` `bonds()` (today `:112-122`, a three-field literal) changes only if Step 39 left it writing a literal; then it spreads the same default (R1(a)), with no level, id or hint change.
  - Tests: `frontend/tests/oracles/arithmetic-oracle.ts`, `frontend/tests/integration/{arithmetic-oracle,schema-parity,ci-contract,config-api,shipped-profile-options}.test.ts` (`shipped-profile-options` also for its catalog and stored-value sweeps, Done-when 2), new `frontend/tests/integration/new-choice-consumers.test.ts`, `frontend/tests/integration/plan-citations.json` (only if a citation site is added or removed; moved source lines never change it), `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`, `frontend/tests/e2e/{number-bonds,print}.spec.ts`.
  - Release: `frontend/package.json`, `frontend/package-lock.json`.
  - Docs: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted (additive at schemaVersion 2):**
    - `NUMBER_BONDS_REGROUPING_MODES` (`enums.ts:50`) gains `"required"`, appended after `"included"`. No array bound is derived from that list.
    - New shared list `WIDE_RANGES = ["off", "within-50", "within-100"]` in `enums.ts`, and its one default `DEFAULT_WIDE_RANGE = "off"` in `schema.ts` beside the Number Bonds defaults (:165-167). Step 47 reuses both.
    - `numberBonds.wideRange` is `z.enum(WIDE_RANGES).default(DEFAULT_WIDE_RANGE)` in `NumberBondsV2Schema` (`schema.ts:151-162`), listed in the transport `numberBondsSchema` optional argument (`transport-schemas.ts:237-251`), and joins the group default (`schema.ts:234-238`, `defaults.ts:61-65`).
    - `wholeMax` keeps its 2..20 bound (`schema.ts:160`). A wide choice stores `wholeMax: V1_NUMERIC_MAXIMUM` beside its `wideRange` member (Decision Inventory R3).
  - **Constants and readers:**
    - `NUMBER_BONDS_WHOLE_MAXIMUM = 100` in `types.ts`, beside `NUMBER_BONDS_WHOLE_MINIMUM` (:66): the family ceiling that bounds requests.
    - `WIDE_RANGE_MAXIMA` in `practice-focus.ts`, derived from `MATH_PRESETS["arithmetic-within-50" | "arithmetic-within-100"].mathSkills.resultMax` (no new literal).
    - `numberBondsWholeMaximum(group)` in `practice-focus.ts`: `wideRange === "off" ? Math.min(wholeMax, V1_NUMERIC_MAXIMUM) : WIDE_RANGE_MAXIMA[wideRange]`. It is the only reader of `wideRange`.
  - **Generator and capacity:**
    - The enumeration (`generator.ts:82-…`) is unchanged except its clamp at :89, which reads `NUMBER_BONDS_WHOLE_MAXIMUM`.
    - `relationAllowed` (:53-59) follows the mode: `included` allows every relation, `without` only relations whose parts do not regroup, `required` only relations whose parts do.
    - Capacity per operation (both blanks counted):

      | Range | without | included | required |
      |---|---|---|---|
      | Within 50 | 1460 | 2450 | 990 |
      | Within 100 | 5652 | 9900 | 4248 |
      | Within 20 | 254 | 380 | 126 |
      | Within 10 | 72 | 90 | 18 |
      | Within 2..9 | | | 0 |

    - `required` adds no new shortfall arm. Every stored `wholeMax` 2..9 with `required` has capacity 0 (no split of a whole below 10 regroups), an observation of the existing `NB-range-only` arm. Within 10 holds 18 problems per operation, which fills Long at standard exactly (`NUMBER_BONDS_ITEM_BUDGETS.long`, 18).
    - **Offered only from 10 up (coordinator default, spec § Design defaults, Numbers 7; adjustable at redline):** "Every problem carries or borrows" is offered only for a focus whose `numberBondsWholeMaximum` is at least `NUMBER_BONDS_REQUIRED_WHOLE_MINIMUM = 10` (`types.ts`, beside `NUMBER_BONDS_WHOLE_MINIMUM`: the smallest whole with a regrouping split, 1 + 9), following Step 48's Wow pattern of not offering a choice where it cannot fill a page. One owner, `numberBondsRegroupingModesFor(focus)` in `practice-focus.ts`, returns `NUMBER_BONDS_REGROUPING_MODES` without `required` below that whole; the radio's options (`GeneratorControls.tsx:958`) and both catalog sweeps read it. No shipped catalog cell therefore starves: within 5 offers only Without and Include.
    - Choosing a focus below 10 while `required` is checked writes `regrouping: "without"`, so a hidden option is never left checked. A stored `required` with a whole below 10 that no control offers (a hand-written file or a direct PUT) is refused before Create with the existing range sentence, like any other stored-value shortfall.
  - **Catalog and controls:**
    - `NumberBondsFocus` (`practice-focus.ts:219`) becomes `Pick<NumberBondsV2, "operations" | "wholeMax" | "wideRange">`.
    - The range filter (:272) rises to `NUMBER_BONDS_WHOLE_MAXIMUM`, so 50 and 100 come from the presets. The catalog grows from 9 to 15 entries.
    - A range up to 20 stores `{operations, wholeMax, wideRange: "off"}`. A wider range stores `{operations, wholeMax: V1_NUMERIC_MAXIMUM, wideRange: member}`, and building the catalog throws at module load if a range above 20 has no member.
    - Labels and ids come from `numberBondsWholeMaximum`, so existing ids are unchanged and the new ones are `addition-within-50` … `addition-and-subtraction-within-100`.
    - `matchNumberBondsFocusOption` (`practice-focus.ts:302-311`, feeding the select at `GeneratorControls.tsx:536`) compares `numberBondsWholeMaximum(option.focus) === numberBondsWholeMaximum(focus)` and the operations, never the raw `wholeMax`. Otherwise a stored within-100 focus (`wholeMax: 20`) would match the within-20 entry first.
    - `chooseNumberBondsFocus` (`GeneratorControls.tsx:643-653`) also writes the focus's `wideRange`. The Carrying and borrowing radio (:949-964) gains "Every problem carries or borrows" for ranges of 10 and up, its options read from `numberBondsRegroupingModesFor`, and `NUMBER_BONDS_REGROUPING_HELP` (`definition.ts:64-65`) names it.
  - **Summaries (Decision Inventory R2):**
    - `describeNumberBondsFocus` (:239-241) prints `numberBondsWholeMaximum`, so the select, `savedSettingOptionLabel` (:256-258), the status line (`registry.ts:646`) and the packet row (`packet-session.ts:214`) say "within 100".
    - `describeNumberBonds` (:249-253) appends `REGROUPING_SUMMARY_PHRASE` for `required`.
  - **Request:** `projectWorksheetPractice` (`project-request.ts:263-270`) writes `wholeMax: numberBondsWholeMaximum(selection.numberBonds)`. `invariants.ts:258-261` bounds the member at `NUMBER_BONDS_WHOLE_MAXIMUM`, and :300 handles the three modes.
  - **Renderer and key:**
    - The list carries `data-missing-digits` from `numberBondsMissingDigits(practice)`: the digit count of the largest blank value the request's filtered relations produce, never less than 2. In closed form it is 3 exactly when the operations include subtraction, the whole maximum is 100 and the mode is not `without` (a blank minuend of 100); otherwise 2. Under `without` no relation has a whole of 100.
    - Three-digit boxes are 21 × 9 mm (24 × 11 mm at large scale). At large scale those lists print in two columns.
    - The key is unchanged.
  - **Print:** new matrix row `bonds-missing-100` on Letter and A4 at standard and large scale, with keys: +4 worksheet cases, +4 keys, +8 surfaces.
  - **Version:** `npm --prefix frontend version 1.11.0 --no-git-tag-version`.
- **Done when:**
  1. **Oracle and generator** (`arithmetic-oracle.test.ts`, `number-bonds/generator.test.ts`):
     - The independent oracle has its own ceiling of 100 and its own solve bound of 200, and it encodes `required`.
     - It agrees with every item for each operation choice × {50, 100} × {without, included, required}, with several seeds per cell.
     - Enumeration counts equal the table in Produces.
     - Under `required` every item regroups. Under `without` at 100, no whole is 100.
     - Inline known vectors pin one page each for within 50 with `without` and within 100 with `required`.
  2. **Negatives:**
     - The existing negative "a largest whole of 21" (`generator.test.ts:333-336`) is retargeted to `NUMBER_BONDS_WHOLE_MAXIMUM + 1`.
     - A projection test keeps the "20 when off" guarantee: an unvalidated `{wholeMax: 21, wideRange: "off"}` group projects 20, and every catalog entry with `wideRange: "off"` projects at most 20.
     - A non-regrouping item under `required` and a regrouping item under `without` each fail with `GENERATION_INVARIANT_FAILED`.
     - The Carrying and borrowing radio shows no "Every problem carries or borrows" option for within 5 and shows it for within 10, 20, 50 and 100 (`options.test.tsx`). Choosing within 5 while it is checked dispatches `regrouping: "without"`. A stored `{operations: ["addition"], wholeMax: 5, wideRange: "off", regrouping: "required"}` is refused before Create, by the control and the generator alike, with the existing sentence "Choose a practice focus with a wider range." (`definition.ts:109`). An independent oracle count is 0 at a whole of 9 and positive at 10 under `required`, which pins `NUMBER_BONDS_REQUIRED_WHOLE_MINIMUM`.
     - `limit-labels.test.ts`: `NUMBER_BONDS_SOURCES` (:1167-1185) covers `required` and both wide members. The notes (:542-556) are reworded with the arm statuses unchanged: `NB-range-only` reads "one operation within 2 or 3, or both operations within 2, under Without or Include; under Every problem carries or borrows, every largest whole from 2 to 9 with any operation choice (no split regroups)"; `NB-range-or-shorter` says "under Without or Include"; `NB-shorter-only` says the count never decreases in every choice and a largest whole of 20 fills every budget (at least 126 problems per operation under `required`).
     - Catalog and stored-value sweeps that iterate `NUMBER_BONDS_REGROUPING_MODES` today (verified against source):
       - `registry.test.ts` "availability equals generation" (:3298-3318): `catalogSweepCells` (:3238-3245) iterates `numberBondsRegroupingModesFor(focus)`. The Number Bonds cells grow from 9 focuses × 2 choices (18) to 3 within-5 focuses × 2 + 12 focuses × 3 (42), so the length pin (:3310) rises by exactly 144 from Step 45's merged value; its comment says "15 Number Bonds focuses × their offered carrying and borrowing choices". The starving set stays `[]` and its "Every shipped catalog focus fills every length and scale" comment stays true.
       - `shipped-profile-options.test.ts` "none starves" (:253-265): `CATALOG_CELLS` (:167-174) iterates the same owner, so its self-computing length check and empty starving set are unchanged.
       - `shipped-profile-options.test.ts` (:454-483), which sweeps every stored largest whole 2..20 × every choice: the expected refusal set gains every layout of `required` at largest wholes 2..9 for each operation choice, and the comment says shortfalls under Without or Include lie at a largest whole of 4 or below, where both hold the same problems, and under `required` at every largest whole below 10.
       - `shipped-profile-options.test.ts` (:500-520), "addition within 4 fills Short … Standard exactly": the loop runs over `without` and `included` only, and one added assertion shows addition within 4 with `required` refused at every length and scale with the range-only sentence.
       - The test at :485-498 (one operation within 2 or 3, range remedy only) iterates every choice and stays green unedited: `required` there has 0 problems and takes the same sentence.
  3. **Availability and persistence** (`schema-parity.test.ts`, `project-request.test.ts`, `practice-focus.test.ts`, `options.test.tsx`, `registry.test.ts`, `config-api.test.ts`):
     - `$.defaults.numberBonds.wideRange` has its parity rows, including an absent probe.
     - A v2 file whose `numberBonds` lacks `wideRange` parses as `"off"`, with its bytes unchanged.
     - `config-api.test.ts`: a PUT whose `numberBonds` is `{operations: ["addition", "subtraction"], wholeMax: 20, wideRange: "within-100", regrouping: "required"}` GETs back equal, with only that group changed and the profile untouched; a file written with a `numberBonds` lacking `wideRange` GETs `"off"` and its bytes stay unchanged.
     - `config-shape-fingerprint.test.ts` passes without a repin.
     - The pinned catalog lists 15 entries, and its id-count assertion (`practice-focus.test.ts:236`) reads 15. The raw `wholeMax` maximum (:240) stays `V1_NUMERIC_MAXIMUM`, and a new assertion reads the largest `numberBondsWholeMaximum` as `NUMBER_BONDS_WHOLE_MAXIMUM`. The existing `NumberBondsV2Schema.safeParse` loop (:237-238) is kept unchanged and passes for every entry.
     - `matchNumberBondsFocusOption` returns `addition-and-subtraction-within-100`, not `-within-20`, for the within-100 focus, and every entry matches its own id.
     - A new test checks that every catalog sweep selection in `registry.test.ts` and `shipped-profile-options.test.ts` parses with `WorksheetSelectionV2Schema`.
     - `WIDE_RANGE_MAXIMA` values are the presets' `resultMax` read by identity, and their largest equals `NUMBER_BONDS_WHOLE_MAXIMUM`.
     - Choosing "within 100" and then "within 20" writes `wideRange: "off"` and `wholeMax` 20. The select shows the chosen option in both directions.
     - Every existing request is byte-identical. `generatorVersion` stays 1, and `tests/fixtures/golden/practice-content-keys.json` and the existing known vectors are unchanged.
  4. **Render and summaries** (`Renderer.test.tsx`, `math-generation.test.ts`, `new-choice-consumers.test.ts`):
     - `createWorksheetSessionForSeed` with a within 100, `required` selection returns a validated document whose list reports `data-missing-digits="3"`, while a within 20 document reports 2.
     - `numberBondsMissingDigits` equals the digit count of the largest blank among `enumerateNumberBondsCandidates` for every catalog focus × mode, including within 100 subtraction with `without` (2).
     - For that selection, the registry status message is exactly "Practice focus for Number Bonds: Missing number sentences, Addition and subtraction within 100, every problem carries or borrows.". `describeQueuedSheet(...).detail` gives the same description (R1(b) wording test, in `packet-session.test.ts`).
     - Packet leak (R1(c), until Step 55): with the session saved at within 100 and `required`, every Number Bonds sheet `makeRandomPacket` makes at every level carries `wideRange: "off"` and a request member whose `wholeMax` is at most `V1_NUMERIC_MAXIMUM`.
     - The key lines restate each problem with `?`.
  5. **Browser and print** (`number-bonds.spec.ts`, `print.spec.ts`):
     - The compiled app chooses "Addition and subtraction within 100" and "Every problem carries or borrows". It creates, previews and keys, saves defaults and reloads with both choices kept, and the status line reads "within 100".
     - The `bonds-missing-100` fixture row declares its own expected box size, 21 × 9 mm (24 × 11 mm), independent of the page's attribute. Each surface prints on one page and stays contained, and it prints the answer 100 in its key. A separate assertion reads `data-missing-digits="3"`.
     - Forcing the wide boxes to 14 mm fails `missingBox[0]: widthMm`, and restoring passes.
     - The `bonds-missing-20` row is unchanged and reports `data-missing-digits="2"`.
     - `ci-contract.test.ts`: the listed count (:48) rises by 4 and every cell's decoration-false count rises by 1 (the `17 : 14` base at :71); `docs/testing-print.md` moves by +4 worksheet cases, +4 keys and +8 surfaces.
  6. **Docs and prose:**
     - README's Number Bonds row (:15) and its line-22 sentence name 50 and 100 and the third carrying choice. The literal "within 20" stays (`frontend/scripts/audit-release.mjs:157`).
     - `docs/educational-basis.md` updates the numeric range row (:51), the Regrouping row's Number Bonds sentence (:53) and the Number Bonds section (:94-117), with no grade or readiness claim.
     - CLAUDE.md's "missing number sentences stay within 20" sentence (:75) is corrected.
     - Code comments that go stale are updated: the `types.ts:62-65` docblock, the `number-bonds/definition.ts:9-15` header, the `invariants.ts:236-241` and :265-271 docblocks, and the `tokens.css:203-208` comment. `parent-copy-scan.test.ts` passes on the new labels.
  7. **Version:** `package.json` and `package-lock.json` both read 1.11.0.
  8. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 45

### Step 47: Two Whats and a Wow equations to 100
- **Status:** PENDING
- **Problem:** A parent picks Two Whats and a Wow with Equations and chooses "Addition and subtraction within 50" or "within 100". Each printed group shows one true equation beside two wrong answers that are close to the true one, such as 68, 58 and 86 for 43 + 25. No problem carries or borrows, as on today's pages, and the summary and a queued packet row say "within 100".
- **Type:** code
- **Issue:** #58
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/config/{schema.ts,defaults.ts,earlier-settings.ts,earlier-settings.test.ts,practice-focus.ts,practice-focus.test.ts,migrate.test.ts}`, `frontend/src/server/transport-schemas.ts`, `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts}`.
  - Family: `frontend/src/worksheets/find-the-wow/{definition.ts,generator.ts,generator.test.ts}`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts}`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/web/packet/packet-session.test.ts` (wording test only).
  - Compile-only literal updates: typed `equation` literals spread `DEFAULT_WORKSHEET_DEFAULTS_V2.findTheWow.equation`. Today: `earlier-settings.test.ts:99` and `migrate.test.ts:503`; the `arithmeticFocusArbitrary(V1_NUMERIC_MAXIMUM)` at `project-request.test.ts:519` maps to `{ ...focus, wideRange: DEFAULT_WIDE_RANGE }`; `registry.test.ts:318` already spreads; plus any site `tsc` reports. No `src/web/packet/` edit: `wowEquation()` (`random-packet.ts:92-98`) copies a whole catalog focus, which now carries `wideRange: "off"`, and `wowQuantity()` (:84-90) builds `findTheWow` from the default group (Step 39), so no parent's `equation` reaches a packet sheet.
  - Tests: `frontend/tests/integration/{schema-parity,shipped-profile-options,ci-contract,config-api,new-choice-consumers}.test.ts`, `frontend/tests/integration/plan-citations.json` (only if a citation site is added or removed; moved source lines never change it), `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`, `frontend/tests/e2e/{find-the-wow,print}.spec.ts`, `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Release: `frontend/package.json`, `frontend/package-lock.json`.
  - Docs: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted (additive at v2, inside `findTheWow.equation`):**
    - `EquationFocusV2Schema` (`schema.ts:206`) is `arithmeticFocusV2Schema(V1_NUMERIC_MAXIMUM).extend({wideRange: z.enum(WIDE_RANGES).default(DEFAULT_WIDE_RANGE)})`, reusing Step 46's list and default, and gains its own type `EquationFocusV2`.
    - The transport `equation` object (`transport-schemas.ts:289`) stops calling the shared `arithmeticFocusSchema(V1)`. It is composed from the same properties plus `wideRange`, which is in its optional list, so the pinned `$.defaults.findTheWow.equation` line (`config-shape-fingerprint.test.ts:75`, `required=[...]`) stays identical.
    - `operandMax` and `resultMax` keep 1..20. A wide entry stores both as `V1_NUMERIC_MAXIMUM` beside its member (Decision Inventory R3); `practice-focus.ts` imports only shared modules, so it never reads `FIND_THE_WOW_V1_MAXIMUM` (`find-the-wow/definition.ts:43`).
  - **Type flow:**
    - `PracticeFocusValues["find-the-wow-equation"]` (`practice-focus.ts:43`) becomes `EquationFocusV2`.
    - `arithmeticCatalog` (:321-345) is split: Dry Math keeps `ArithmeticFocusV2`, and a new `equationCatalog` builds `EquationFocusV2` entries, so every entry carries `wideRange`.
    - `earlier-settings.ts:178` writes `{...arithmeticFocus(...), wideRange: DEFAULT_WIDE_RANGE}`. `defaults.ts:79` gains it.
  - **Constants and readers** (`types.ts`, beside :47-66):
    - `FIND_THE_WOW_EQUATION_MAXIMUM = 100`.
    - `FIND_THE_WOW_NEAR_MISS_OFFSETS = [-10, -2, -1, 1, 2, 10] as const`, the one definition of the near-miss offsets. `nearMissResults` reads it, and Step 53 imports it rather than redefining it.
    - `findTheWowEquationLimits(focus)` in `practice-focus.ts` returns `{operandMax, resultMax}`: the stored values when `off`, else `WIDE_RANGE_MAXIMA[wideRange]` for both.
    - A new `PracticeRequestV1` kind `{kind: "find-the-wow-equation", regrouping: "without"}`. Step 48 widens `regrouping`.
  - **Projection:** `wideRange: "off"` is exactly today's request, with no member. Otherwise the capabilities (`project-request.ts:148-150`) carry `findTheWowEquationLimits`, and the request carries the member.
  - **Generator:**
    - With the member, a new stem enumeration runs. Operands are 1..L, no stem regroups, and wrong answers come from `nearMissResults`.
    - Wrong answers are drawn per stem, so the full distractor-pair product is never enumerated.
    - Stem capacity per operation: within 50, addition 730 and subtraction 780; within 100, addition 2826 and subtraction 2926.
    - Without the member, `enumerateEquationWowCandidates` (`generator.ts:92-134`) and its RNG order are unchanged.
  - **Controls and summaries (Decision Inventory R2):**
    - The equation select gains "Addition and subtraction within 50" and "within 100" from the presets.
    - `canonicalFocus` (:428-441) gives the Wow equation its own branch: a wide focus reduces to `{operations, wideRange}`, and an `off` focus to today's three fields plus `wideRange`.
    - `describePracticeFocus("find-the-wow-equation", …)` (:145-146) describes `findTheWowEquationLimits(focus)`. The select, the earlier-setting label (`GeneratorControls.tsx:272`), the seeded-group status (:316-317), the packet row (`packet-session.ts:207`) and `EarlierSettingsSummary` then say "within 100".
    - The Wow status message (`registry.ts:463`) is unchanged without the member. With it, the message appends " Practice focus: <description>.", following the Dry Math precedent at `registry.ts:337-349`.
  - **Limiting advice:** `findTheWowRelevantMaximums` (`registry.ts:366-378`) returns `NO_MAXIMUMS` for a wide range, and the Wow `getLimitingResourceAdvice` returns `FIND_THE_WOW_WIDE_RANGE_LIMITING_RESOURCE_ADVICE` (`find-the-wow/definition.ts`) = "Two Whats and a Wow varies which equations it shows and which close wrong answers stand beside them. Choose another practice focus, or create a new worksheet later." for it, never `numericLimitAdvice`'s "has no further variation" text (`registry.ts:321-326`).
  - **Renderer and key:** unchanged. Equations are text, and the key prints "Choice N".
  - **Print:** new matrix row `wow-equation-100` on Letter and A4 at standard and large scale, with keys: +4 worksheet cases, +4 keys, +8 surfaces.
  - **Version:** `npm --prefix frontend version 1.12.0 --no-git-tag-version`.
- **Done when:**
  1. **Generator and oracle** (`find-the-wow/generator.test.ts`):
     - For within 50 and within 100 × each operation choice, with several seeds, every group has exactly one true equation, recomputed by plain arithmetic in the test.
     - Both wrong answers are in the test's own independent near-miss set (its own literal offsets plus its own digit-reversal rule, spec "Wow near-miss path") and in range.
     - Stem counts equal Produces. No stem regroups, and correct positions stay balanced.
     - A fast-check property of about 200 runs validates every document.
     - Enumerating within 100 with both operations builds no per-pair candidates: the candidate count equals the stem count.
     - An inline known vector pins one within 100 page.
     - Run from the repository root (the pathspec resolves against the current directory), `git grep -nF -e "-10, -2, -1, 1, 2, 10" -- frontend/src ":!*.test.ts"` prints exactly one line, the `types.ts` definition; the test keeps its own independent literal.
  2. **Negatives:**
     - A wrong answer outside the near-miss set, a regrouping stem, an operand of 0 or above 100, capabilities above 20 without the member, and the member on a quantity request each fail with `GENERATION_INVARIANT_FAILED`.
     - `invariants.ts:478-504` refuses the member on any other family.
  3. **Availability and persistence** (`schema-parity.test.ts`, `practice-focus.test.ts`, `earlier-settings.test.ts`, `project-request.test.ts`, `options.test.tsx`, `limit-labels.test.ts`, `config-api.test.ts`):
     - Parity rows cover `$.defaults.findTheWow.equation.wideRange`.
     - A v2 file without it parses with `"off"` and is not rewritten.
     - `config-api.test.ts`: a PUT whose `findTheWow` is `{variant: "equation", equation: {operations: ["addition", "subtraction"], operandMax: 20, resultMax: 20, wideRange: "within-100"}}` GETs back equal, with only that group changed and the profile untouched; a file written with an `equation` lacking `wideRange` GETs `"off"` and its bytes stay unchanged.
     - The fingerprint passes without a repin.
     - The pinned equation labels (`practice-focus.test.ts:55-67`) gain exactly "Addition and subtraction within 50" and "Addition and subtraction within 100", the test title no longer says "within the Version 1 ceiling", and every entry parses with `EquationFocusV2Schema` (the `FOCUS_SCHEMAS` loop at :78-93).
     - The select shows "within 100" after choosing it, and shows "Addition within 20" after switching back.
     - Earlier-settings seeding writes `wideRange: "off"` and still discloses "stored 50, using 20".
     - Every existing Wow request is byte-identical, with no member. The golden hashes, the known vectors and `generatorVersion` 1 are unchanged.
     - Limit-labels sweep: the two new catalog entries (through `CATALOG_SOURCES`, :1100) reach a new explicit branch placed before the generic one at :1526-1534, observing new reachable arms `NA-wow-wide-range` (advice equals `FIND_THE_WOW_WIDE_RANGE_LIMITING_RESOURCE_ADVICE`, zero maxima) and `FRM-wide-range` (beside :1536-1543). `NA-empty` and `FRM-none` stay dead, and their notes (:507-510, :557-560) say a wide Wow range takes its own arm.
     - `registry.test.ts` "availability equals generation": the catalog-sweep length pin (:3310) rises by exactly 12 (two equation entries × 3 lengths × 2 scales), its comment counts 7 equation Wow focuses, and the starving set stays `[]`.
  4. **Production caller and summaries** (`math-generation.test.ts`, `new-choice-consumers.test.ts`):
     - `createWorksheetSessionForSeed` with "within 100" returns a validated document, and some displayed result has three digits in at least one of the swept seeds.
     - Its status message is "Statements for Two Whats and a Wow: Equations. Practice focus: Addition and subtraction within 100.", and `describeQueuedSheet(...).detail` is "Addition and subtraction within 100" (R1(b) wording test, in `packet-session.test.ts`).
     - Packet leak (R1(c), until Step 55): with the session saved at Equations within 100, no Wow sheet `makeRandomPacket` makes at any level has a request carrying a `find-the-wow-equation` member, and every equation sheet carries `wideRange: "off"`. The assertion reads the projected request, so it holds for quantity sheets too.
  5. **Browser and print** (`find-the-wow.spec.ts`, `print.spec.ts`):
     - The compiled app selects Equations and then within 100. It creates, previews and keys, and keeps the choice across a defaults save and reload.
     - Switching to Quantity pictures and back restores it.
     - The `wow-equation-100` row prints one page per surface with a group showing 100, and every choice is contained.
     - Hiding one choice's equation text (`visibility: hidden`) fails required-content, and restoring passes.
     - `ci-contract.test.ts`: the listed count (:48) rises by 4 and every cell's decoration-false count rises by 1; `docs/testing-print.md` moves by +4 worksheet cases, +4 keys and +8 surfaces.
  6. **Docs and prose:**
     - README's Wow row (:12) and line 167 say that equations can reach 100 while quantity pictures stay within 20. The literal "within 20" stays (`frontend/scripts/audit-release.mjs:157`).
     - `docs/educational-basis.md` updates :51 and the Wow section (:188-199).
     - CLAUDE.md's "Quantity and Wow activities clamp numbers to 20" (:75) is corrected.
     - The `practice-focus.ts:393-396` catalog docblock is corrected.
  7. **Version:** `package.json` and `package-lock.json` both read 1.12.0.
  8. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 46

### Step 48: Carrying and borrowing for Wow equations to 100
- **Status:** PENDING
- **Problem:** A parent who chose Two Whats and a Wow equations within 50 or 100 can choose "Include problems that carry or borrow". The page then mixes equations such as 47 + 25 beside the wrong answers 62 and 73, which catch a forgotten carry. The status line and a queued packet row add "including problems that carry or borrow".
- **Type:** code
- **Issue:** #59
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,earlier-settings.ts,earlier-settings.test.ts,practice-focus.ts,practice-focus.test.ts}`, `frontend/src/server/transport-schemas.ts`, `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts}`.
  - Family: `frontend/src/worksheets/find-the-wow/{definition.ts,generator.ts,generator.test.ts}`.
  - Web: `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts}`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/web/packet/packet-session.test.ts` (wording test only).
  - Compile-only literal updates: Step 47's equation spreads already carry the new default; any other typed `equation` literal `tsc` reports spreads `DEFAULT_WORKSHEET_DEFAULTS_V2.findTheWow.equation`. No `src/web/packet/` edit, for Step 47's reasons.
  - Tests: `frontend/tests/integration/{schema-parity,shipped-profile-options,config-api,new-choice-consumers}.test.ts`, `frontend/tests/integration/plan-citations.json` (only if a citation site is added or removed; moved source lines never change it), `frontend/tests/e2e/{find-the-wow,accessibility}.spec.ts`, `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Release: `frontend/package.json`, `frontend/package-lock.json`.
  - Docs: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`.
- **Produces:**
  - **Persisted:** `FIND_THE_WOW_REGROUPING_MODES = ["without", "included"]` in `enums.ts`. `findTheWow.equation.regrouping` is `z.enum(FIND_THE_WOW_REGROUPING_MODES).default(DEFAULT_FIND_THE_WOW_REGROUPING)` (`"without"`, in `schema.ts`), and is in the transport `equation` object's optional list. Catalog entries store `"without"`.
  - **Applicability:** the Wow registration's `regrouping` (`registry.ts:478-493`, today `false` at :486) becomes `variant === "equation" && wideRange !== "off"`. No range up to 20 offers the choice, so a within 5 page, whose stems can have fewer than two near misses, never takes the near-miss path. `GeneratorControls.tsx` renders each family's own radio by `worksheetType` (:949, :1000), so this flag shows only the new Wow radio.
  - **Projection:** the member's `regrouping` is the stored choice. A stored `included` on an `off` range stays inert, because no member is projected.
  - **Generator:** `included` keeps the regrouping stems. Capacity rises to 1225 / 1275 (within 50) and 4950 / 5050 (within 100) for addition / subtraction. Wrong answers still come from `nearMissResults`, which reads Step 47's `FIND_THE_WOW_NEAR_MISS_OFFSETS`.
  - **Controls:** a "Carrying and borrowing" radio group sits under the equation select (beside `GeneratorControls.tsx:949`). Choosing a focus (`chooseFocus`, :618-636) keeps the current `regrouping`: the Wow branch writes `{...option.focus, regrouping: current.regrouping}`.
  - **Summaries (Decision Inventory R2):** `describePracticeFocus("find-the-wow-equation", …)` appends `NUMBER_BONDS_REGROUPING_SUMMARY_PHRASE` (", including problems that carry or borrow") only for a wide range with `included`. `canonicalFocus` ignores `regrouping`.
  - **Earlier settings:** `earlier-settings.ts:178` copies `base.findTheWow.equation.regrouping`, following `dryMathRegrouping: base.dryMathRegrouping` at :203.
  - **Print:** no new row. Equation text widths are those of Step 47's `wow-equation-100` row, which already holds three-digit results.
  - **Version:** `npm --prefix frontend version 1.13.0 --no-git-tag-version`.
- **Done when:**
  1. **Generator** (`find-the-wow/generator.test.ts`):
     - For within 50 and 100 × {without, included} × each operation choice, every group recomputes and both wrong answers are near misses.
     - Under `included` at 100, a regrouping stem appears. A mirror case (same seed, other choice) changes the stems.
     - Stem counts equal Produces.
     - A regrouping stem under `without` and an `included` member with `off`-range capabilities each fail with `GENERATION_INVARIANT_FAILED`.
  2. **Availability and persistence** (`schema-parity.test.ts`, `options.test.tsx`, `earlier-settings.test.ts`, `config-api.test.ts`):
     - Parity rows cover `.regrouping`, including an absent probe.
     - A v2 file without it reads `"without"` unchanged. The fingerprint passes without a repin (the key is optional, so the pinned `required=[...]` line at `config-shape-fingerprint.test.ts:75` is unchanged).
     - `config-api.test.ts`: a PUT whose `equation` is within 100 with `regrouping: "included"` GETs back equal, with only that key changed and the profile untouched; a file written with an `equation` lacking `regrouping` GETs `"without"` and its bytes stay unchanged.
     - The radio is absent for every range up to 20 and present for 50 and 100; the applicable-controls pins in `options.test.tsx` show `regrouping` true only there.
     - Choosing within 100 → included → within 50 keeps `included`.
     - Seeding copies the base choice.
     - Every Step 47 request without `included` is byte-identical.
  3. **Production caller and summaries** (`math-generation.test.ts`, `new-choice-consumers.test.ts`):
     - `createWorksheetSessionForSeed` with within 100 and `included` validates.
     - The status message ends "Practice focus: Addition and subtraction within 100, including problems that carry or borrow.", and the packet `detail` matches (R1(b) wording test, in `packet-session.test.ts`). Switching to within 20 drops the phrase from both.
     - Packet leak (R1(c), until Step 55): with the session saved at within 100 and `included`, no Wow sheet `makeRandomPacket` makes at any level has a request carrying a `find-the-wow-equation` member, and every equation sheet's stored `regrouping` is `"without"`.
  4. **Browser** (`find-the-wow.spec.ts`, `accessibility.spec.ts`):
     - The compiled app selects within 100 and "Include problems that carry or borrow", creates, keys, saves defaults and reloads with the choice kept.
     - The keyboard walk `tabTo`s the checked Without radio, ArrowDown checks and focuses Include, and the summary names the phrase (the Number Bonds pattern at `accessibility.spec.ts:500-507`). axe reports zero violations with the radio group shown.
  5. **Docs:**
     - README :22 adds Wow to the families that ask about carrying. The literal "within 20" stays (`frontend/scripts/audit-release.mjs:157`).
     - `docs/educational-basis.md:53` (the Regrouping row, "in every other family, no generated addition carries") names Wow's choice.
     - CLAUDE.md :75 "every other page stays free of carrying and borrowing, except Operation Grid" names Wow.
  6. **Version:** `package.json` and `package-lock.json` both read 1.13.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 47

### Step 49: Compare numerals to 100
- **Status:** PENDING
- **Problem:** A parent picks Count, Compare & Make, chooses the practice focus "Compare numbers to 100", and prints a page of number comparisons, with the same decorative art as today's page when decoration is on. Each card shows two numbers that are close, such as 47 and 74, or 39 and 41, and the child circles "less than", "equal to" or "greater than". The status line, the summary and a queued packet row all say "Compare numbers to 100".
- **Type:** code
- **Issue:** #60
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,earlier-settings.ts,earlier-settings.test.ts,practice-focus.ts,practice-focus.test.ts,migrate.test.ts}`, `frontend/src/server/transport-schemas.ts`, `frontend/src/shared/worksheet/{types.ts,invariants.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts}`.
  - Family: `frontend/src/worksheets/count-compare-make/{definition.ts,generator.ts,generator.test.ts}`.
  - Web: `frontend/src/web/worksheets/count-compare-make/Renderer.tsx`, new `frontend/src/web/worksheets/count-compare-make/Renderer.test.tsx`, `frontend/src/web/print/AnswerKeyView.tsx`, `frontend/src/web/generator/{GeneratorControls.tsx,options.test.tsx,math-generation.test.ts}`, `frontend/src/web/worksheets/registry.test.ts`, `frontend/src/web/profiles/ProfileEditor.test.tsx` (literal only), `frontend/src/web/packet/packet-session.test.ts` (wording test only).
  - Compile-only literal updates: typed `countCompareMake` literals spread `DEFAULT_WORKSHEET_DEFAULTS_V2.countCompareMake`. Today: `count-compare-make/generator.test.ts:188`, `migrate.test.ts:510`, `project-request.test.ts:327`, `ProfileEditor.test.tsx:1496`, plus any site `tsc` reports (`registry.test.ts:337` already spreads; `schema-parity.test.ts:759` is an `unknown` probe type and needs no change). No `src/web/packet/` edit: `countCompare()` (`random-packet.ts:107-110`) copies a whole catalog focus, which now carries `mode: "groups"`.
  - Tests: `frontend/tests/integration/{schema-parity,shipped-profile-options,ci-contract,config-api,new-choice-consumers}.test.ts`, `frontend/tests/integration/plan-citations.json` (only if a citation site is added or removed: the manifest stores `file`, `planLine`, `anchors` and `siteCount`, so moved source lines never change it), `frontend/tests/fixtures/print/{matrix.ts,required-content.ts,count-layout.ts}`, `frontend/tests/e2e/{count-compare-make,print}.spec.ts`.
  - Release: `frontend/package.json`, `frontend/package-lock.json`.
  - Docs: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted (additive at v2):**
    - `COUNT_COMPARE_MAKE_MODES = ["groups", "numerals-to-100"]` in `enums.ts`. Later modes append to it (Step 52).
    - `CountCompareFocusV2Schema` (`schema.ts:213-217`) gains `mode: z.enum(COUNT_COMPARE_MAKE_MODES).default(DEFAULT_COUNT_COMPARE_MAKE_MODE)` (`"groups"`), which is in the transport `countCompareMake` object's optional list (`transport-schemas.ts:295-299`), so the pinned `$.defaults.countCompareMake` line (`config-shape-fingerprint.test.ts:65`) stays identical. The defaults (`defaults.ts:82-86`) gain it.
    - The quantity maxima keep 1..20. The numerals entry stores all three as `V1_NUMERIC_MAXIMUM` beside `mode: "numerals-to-100"` (Decision Inventory R3).
  - **Constants** (`types.ts`):
    - `COUNT_COMPARE_NUMERAL_MINIMUM = 10` and `COUNT_COMPARE_NUMERAL_MAXIMUM = 100`.
    - A new `PracticeRequestV1` kind `{kind: "count-compare-numerals"}`.
    - A new item `CountCompareNumeralItemV1` (`activity: "compare-numerals"`, `leftNumber`, `rightNumber`, `answer` of kind `comparison`) in the `CountCompareItemV1` union (`types.ts:483`). `COUNT_COMPARE_MAKE_SUBTYPES` (`definition.ts:38-43`) is unchanged.
  - **Generator and capacity:**
    - The pool is every ordered near pair in 10..100: 1,187 pairs, of which 91 are equal, 548 less and 548 greater, and 7 contain 100.
    - A page is a seeded shuffle sliced to `getCountCompareMakeItemCount`: 6/8/10, or 6/8 at large scale.
    - The groups path is unchanged.
  - **Wording:**
    - `COUNT_COMPARE_NUMERAL_RELATION_WORDS = {less: "less than", equal: "equal to", greater: "greater than"}`, beside `COUNT_COMPARE_RELATION_WORDS` (`definition.ts:69-73`).
    - The page prompt is "Circle the words that make the sentence true."
    - A key line reads "47 is less than 74".
  - **Catalog and controls** (this step originates the pattern Step 52 extends):
    - `countCompareCatalog` (`practice-focus.ts:369-391`) gives every preset entry `mode: "groups"`, then appends one non-preset entry, "Compare numbers to 100" (id `compare-numbers-to-100`), whose label is built from `COUNT_COMPARE_NUMERAL_MAXIMUM`. The Wow quantity catalog is unchanged.
    - `canonicalFocus` (:446-453) reads `mode`: a numerals focus reduces to `{mode}`, and a groups focus keeps its three maxima plus `mode`. The select therefore shows the numerals entry while it is chosen, and choosing a quantities entry fires a change that restores `mode: "groups"`.
  - **Summaries (Decision Inventory R2):**
    - `describeCountCompare` (:119-124) returns the entry label in numerals mode, so the select, the packet row (`packet-session.ts:212`), the seeded-group status (`GeneratorControls.tsx:322-323`) and `EarlierSettingsSummary` say "Compare numbers to 100".
    - CCM gains a status message only in numerals mode: "Practice focus for Count, Compare & Make: Compare numbers to 100.". This follows the Dry Math precedent (`registry.ts:337-349`). Groups mode keeps none, as at `registry.ts:588-597`.
  - **Limiting advice** (`registry.ts:580-632`): the capacity verdict routes by mode; `getRelevantMaximums` returns `NO_MAXIMUMS` in numerals mode; `getLimitingResourceAdvice` returns `COUNT_COMPARE_NUMERAL_LIMITING_RESOURCE_ADVICE` (`count-compare-make/definition.ts`) = "Count, Compare & Make varies which close pairs of numbers from 10 to 100 it compares. Choose another practice focus, or create a new worksheet later." (numbers from the two constants) in numerals mode, and today's `numericLimitAdvice` text in groups mode. Applicable controls are unchanged, so decoration and Theme stay offered.
  - **Earlier settings:** `earlier-settings.ts:183-187` writes `mode: "groups"`, because a seeded earlier setting always describes counted groups.
  - **Renderer:** each card puts the left number, a vertical stack of the three phrases, and the right number side by side. The decorative panel is unchanged.
  - **Print:**
    - A new `countNumeralCardBound(paper, scale)` in `count-layout.ts` sits beside `countCardBounds` (:18-22), which is unchanged together with `CountActivity`. Its value is rounded up from the physical layout: three stacked 16 pt phrases at line height 1.15 plus borders, padding, the 2 mm card padding and the 0.3 mm rule. That is about 117 px, giving 125 px (18 pt: about 129 px, giving 140 px).
    - A static fit bound beside it: the retained title-and-art header (112 px standard, 120 px large, as at `print.spec.ts:758-761`) plus `ceil(count / 2) × (countNumeralCardBound + 10)` for the two print columns (`tokens.css:129-133`) is below `paperMetrics[paper].printable.height` (`print.spec.ts:49`, :54): 787 px standard and 720 px large, against 979 px (Letter) and 1,047 px (A4).
    - New matrix row `count-numerals-100` on Letter and A4 at standard and large scale. Because `decorationApplicable` is keyed on the family (`print.spec.ts:897-898`), it prints decoration false and true in every cell: +8 worksheet cases, +4 keys (decoration-false only, :917), +12 surfaces.
  - **Version:** `npm --prefix frontend version 1.14.0 --no-git-tag-version`.
- **Done when:**
  1. **Generator** (`count-compare-make/generator.test.ts`):
     - The pool equals an independent brute force of the near rule (1,187 pairs).
     - Every page item is a near pair in range whose answer recomputes from its two numbers, with no duplicates.
     - Several seeds × every length and scale produce validated documents.
     - A mirror case (same seed, groups mode) produces the unchanged groups page.
     - An inline known vector pins one numerals page.
  2. **Negatives:**
     - A numerals item on a groups page, a groups item on a numerals page, a far pair (12 vs 87), a number of 9 or 101, and a wrong relation each fail with `GENERATION_INVARIANT_FAILED`.
     - `invariants.ts:478-504` refuses the member on any other family.
  3. **Availability and persistence** (`schema-parity.test.ts`, `practice-focus.test.ts`, `project-request.test.ts`, `earlier-settings.test.ts`, `options.test.tsx`, `limit-labels.test.ts`, `config-api.test.ts`):
     - Parity rows cover `$.defaults.countCompareMake.mode`.
     - A v2 file without `mode` parses as `"groups"` unchanged.
     - `config-api.test.ts`: a PUT whose `countCompareMake` is `{countingMax: 20, numeralMax: 20, compareMax: 20, mode: "numerals-to-100"}` GETs back equal, with only that group changed and the profile untouched; a file written with a `countCompareMake` lacking `mode` GETs `"groups"` and its bytes stay unchanged.
     - The fingerprint passes without a repin.
     - The two-catalog label pin (`practice-focus.test.ts:70-77`) splits per catalog: `find-the-wow-quantity` stays `["Quantities to 10", "Quantities to 20"]`, and `count-compare-make` becomes those two plus "Compare numbers to 100". Every catalog entry parses with `CountCompareFocusV2Schema` and matches its own id, and the preset-literal test (:125-134) checks only `mode: "groups"` entries.
     - The select shows "Compare numbers to 100" after it is chosen. Choosing "Quantities to 10" then dispatches `mode: "groups"`, and the select shows it.
     - A numerals request carries no stored maximum: changing `countingMax` leaves it byte-identical.
     - Every groups request, the golden hashes, the known vectors and `generatorVersion` 1 are unchanged.
     - Seeding writes `mode: "groups"`.
     - Limit-labels sweep: the numerals entry (through `CATALOG_SOURCES`, :1100) reaches a new explicit branch before the generic one at :1526-1534, observing a new reachable arm `NA-count-numerals` (zero maxima, advice equals `COUNT_COMPARE_NUMERAL_LIMITING_RESOURCE_ADVICE`). Groups entries still observe `NA-nonempty`, and `NA-empty` stays dead, with its note (:507-510) saying Count, Compare & Make declares its maxima in groups mode.
     - `registry.test.ts` "availability equals generation": the catalog-sweep length pin (:3310) rises by exactly 6 (one CCM entry × 3 lengths × 2 scales), its comment counts 3 Count, Compare & Make focuses, and the starving set stays `[]`.
  4. **Render, key and summaries** (`Renderer.test.tsx`, `math-generation.test.ts`, `new-choice-consumers.test.ts`):
     - Through `createWorksheetSessionForSeed`, each numerals card shows both numbers and the three phrases from the new constant.
     - The key prints "N is <phrase> M" with the phrase equal to the recomputed relation, from a `compare-numerals` branch beside the number-bond branch (`AnswerKeyView.tsx:104`).
     - Groups-page keys still print "fewer than", "the same as" or "more than".
     - The status message and `describeQueuedSheet(...).detail` name "Compare numbers to 100" (R1(b) wording test, in `packet-session.test.ts`).
     - Packet leak (R1(c), until Step 55): with the session saved in numerals mode, every Count, Compare & Make sheet `makeRandomPacket` makes at every level carries `mode: "groups"` and a request without a `count-compare-numerals` member.
  5. **Browser and print** (`count-compare-make.spec.ts`, `print.spec.ts`, `ci-contract.test.ts`):
     - The compiled app selects "Compare numbers to 100", creates, previews, keys, uses Make another, then saves defaults and reloads.
     - Choosing "Quantities to 10" from the select restores the groups page.
     - The matrix seed search (`matrix.ts:388-405`) gates its groups check on `mode` and adds a numerals branch: a page containing 100 and a reversed-digit pair.
     - `measurePrint` (`print.spec.ts:679-689`) and the item reader (`expectCountBoundary`, :629-655) branch on `compare-numerals`, reading both numbers and expecting no target.
     - Each surface prints on one page, every card is within `countNumeralCardBound` and contained, and the key prints on one page. The static fit bound in Produces is asserted for every paper and scale.
     - On every `count-numerals-100-…-decoration-true` row, the art is decoded and visible (the existing panel check, :260-272, and asset check, :1000-1013), every card stays contained, and the page is one page.
     - Forcing the phrase stack's line height to 2 fails the bound, and restoring passes. Hiding one relation phrase fails required-content, and restoring passes.
     - `ci-contract.test.ts`: the listed count (:48) rises by 8; in every cell the decoration-true count (:70) rises from 9 to 10 and the decoration-false count rises by 1; the decoration-true regex (:83) becomes `/(?:sentence-|count-all-four-subtypes-|count-numerals-100-)/u`. `docs/testing-print.md` moves by +8 worksheet cases, +4 keys and +12 surfaces. The existing 240-seed groups sweep is unchanged.
  6. **Docs and prose:**
     - README's Count, Compare & Make row (:14) and line 167 say numeral comparison reaches 100 while counted quantities stay within 20. The literal "within 20" stays (`frontend/scripts/audit-release.mjs:157`).
     - `docs/educational-basis.md` updates :51 and the Count, Compare & Make section (:200-225).
     - The CLAUDE.md clamp sentence (:75) is corrected.
     - The `count-compare-make/definition.ts:23-33` docblock says the 20 clamp applies to quantities only, and keeps its existing archived-plan line citation (line 211) unchanged.
  7. **Version:** `package.json` and `package-lock.json` both read 1.14.0.
  8. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 48

### Step 50: Half-hour and quarter-hour clocks
- **Status:** PENDING
- **Problem:** Clock Explorer gets its first setting. After choosing the Clock Explorer card, a parent picks **Clock times**: On the hour (the default and today's page), Half hours, or Quarter hours. With Half hours or Quarter hours, Create prints four distinct clocks at :00/:30 or :00/:15/:30/:45. The hour hand sits between two numbers wherever the time requires it, the child writes the hour and the minutes in two blanks (`Time: ____ : ____`), and the key names each time and where both hands point (for example "3:30 — long hand at 6, short hand between 3 and 4"). The selection summary, Make another's advice and packet rows name the chosen Clock times. Random packets keep printing on-the-hour clocks at every level until Step 55. On the hour still prints today's page, byte for byte.
- **Type:** code
- **Issue:** #61
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Config: `src/shared/config/{enums.ts,schema.ts,defaults.ts,earlier-settings.ts}`, `src/server/transport-schemas.ts`, `src/shared/config/migrate.test.ts` (only where it pins the full default groups), `src/shared/config/earlier-settings.test.ts` (the pass-through case).
  - Shared: `src/shared/worksheet/clock-time.ts` (new) and `clock-time.test.ts` (new), `src/shared/worksheet/{types.ts,invariants.ts,answer-oracle.ts,answer-oracle.test.ts,project-request.ts,project-request.test.ts,registry.ts,limit-labels.test.ts}`.
  - Family: `src/worksheets/clock-explorer/{definition.ts,generator.ts,generator.test.ts}`. `src/worksheets/count-compare-make/generator.ts` only adds the `time` case to `sameAnswer` (:436-445), which Step 43 already narrows by answer kind.
  - Web: `src/web/worksheets/clock-explorer/{Renderer.tsx,Renderer.test.tsx}`, `src/web/worksheets/registry.test.ts`, `src/web/print/AnswerKeyView.tsx`, `src/web/generator/{GeneratorControls.tsx,worksheet-session.ts,worksheet-session.test.ts,options.test.tsx,math-generation.test.ts}`.
  - Packet (rulings R1(b) and R1(c) only): `src/web/packet/{packet-session.ts,packet-session.test.ts}` (`detailOf` and its wording test); `src/web/packet/random-packet.test.ts` (leak test only); `src/web/packet/random-packet.ts` (docblock comment only, no `RANDOM_PACKET_FOCUS` row edit).
  - Tests: `tests/oracles/clock-oracle.ts`, `tests/integration/{schema-parity,ci-contract,config-api,shipped-profile-options}.test.ts`, `tests/fixtures/print/{matrix.ts,required-content.ts}`, `tests/e2e/{print,visual-math,accessibility}.spec.ts`, `tests/e2e/fixtures/worksheet-controls.ts`.
  - Version: `package.json`, `package-lock.json`.
  - Docs: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted setting (additive at v2):**
    - `CLOCK_EXPLORER_TIME_STEPS = ["hour", "half-hour", "quarter-hour"]` in `enums.ts`. No array bound derives from it.
    - In `schema.ts`, beside the `DEFAULT_OPERATION_GRID_*` defaults (:169-173): `DEFAULT_CLOCK_EXPLORER_TIME_STEP = "hour" as const` and an exported group default `DEFAULT_CLOCK_EXPLORER = { timeStep: DEFAULT_CLOCK_EXPLORER_TIME_STEP }`. The Zod group default and `defaults.ts` read this one constant, and Step 39's `seedOnly` reaches it through `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)`.
    - A `clockExplorer` group in `worksheetSelectionShape` (`schema.ts:219`): `z.strictObject({ timeStep: z.enum(CLOCK_EXPLORER_TIME_STEPS).default(DEFAULT_CLOCK_EXPLORER_TIME_STEP) }).default(() => ({ ...DEFAULT_CLOCK_EXPLORER }))`, following the pattern of `operationGrid` at :241.
    - A `clockExplorerSchema` in `transport-schemas.ts`, with `timeStep` optional. `clockExplorer` joins `worksheetDefaultsProperties` (:275-282) and the optional list (:375-381).
    - Defaults in `defaults.ts` (:66, :123, :155), the pass-through in `earlier-settings.ts:218`, and `"clockExplorer"` in `WORKSHEET_GROUP_KEYS` (`worksheet-session.ts:38-60`) with a `safeParse` guard like the one at :300.
    - No numeric key, no schemaVersion 3, no migration.
  - **Request:**
    - A new `PracticeRequestV1` arm `{ kind: "clock-explorer"; timeStep: "half-hour" | "quarter-hour" }` (`types.ts:225-249`).
    - `projectWorksheetPractice` (`project-request.ts:263-288`) projects it only when `timeStep !== "hour"`, so an on-the-hour request keeps no `practice` member.
  - **Item and answer:**
    - `ClockExplorerItemV1` (`types.ts:539-543`) gains an optional `minute`, present exactly when the request carries a clock practice member.
    - Its `answer`, typed today as the `number` member only (:542), widens to the `number` or `time` member.
    - `ObjectiveAnswerV1` (`types.ts:264-275`) gains `{ kind: "time"; hour: number; minute: number }`, with no `value` field, so the compiler finds every consumer.
    - An on-the-hour item keeps `answer: { kind: "number", value: hour }`.
  - **Shared clock rules:** `src/shared/worksheet/clock-time.ts` (new) holds the step-minutes table, the coarser-step map and `clockStepWitness(step, minute)` (see the Spec section). `invariants.ts`, `definition.ts`, `generator.ts` and `Renderer.tsx` import it, so shared code never imports `src/worksheets/`.
  - **Generator:** on the hour runs today's unchanged path (`generator.ts:76-87`). The other steps shuffle the seeded candidate list of (hour, minute) pairs, in ascending order, and apply the step-witness rule. `generatorVersion` stays 1.
  - **Invariants:**
    - `seedOnlyRequestIsCanonical` (`invariants.ts:426`) is split, and the base checks (length, decoration, topics, inactive capabilities) become one helper.
    - Tally Detective (:713) keeps `!("practice" in request)`.
    - Clock Explorer (:698) accepts either no member or exactly one valid non-hour clock member.
    - The practice gate (:478-498) admits the clock arm for `clock-explorer` only.
    - Uniqueness is keyed on (hour, minute) (:509, :576-592).
  - **Controls and summaries** (ruling R2: one wording owner):
    - `WorksheetApplicableControlsV1` (`registry.ts:163-189`) gains `clockTimeStep`. It is declared in all eight entries and true only for Clock Explorer (:740-755).
    - `CLOCK_EXPLORER_TIME_STEP_LABELS` goes in `definition.ts`, the owner pattern of `OPERATION_GRID_OPERATION_LABELS` (`operation-grid/definition.ts:49`): "On the hour", "Half hours", "Quarter hours".
    - `GeneratorControls.tsx` gains a "Clock times" radio group after the card, reading those labels. The e2e helper gains `chooseClockTimes`.
    - Selection summary: Clock Explorer's `getCapabilitySupport` (`registry.ts:726-729`) returns `statusMessage: "Clock times for Clock Explorer: <label>."` for every step, On the hour included, like Number Bonds (:646) and Operation Grid (:688). The message renders in `[data-selection-summary]` (`GeneratorControls.tsx:1049-1052`).
    - The status line after Create ("Worksheet ready with 4 unique clocks.", `App.tsx:1105-1112`) is already correct for every step and stays unchanged.
    - Packet row (R1(b)): `detailOf`'s clock arm (`packet-session.ts:217-219`) returns the step's label when the step is not the hour, and `undefined` on the hour. Today's rows therefore keep their bytes (pinned at `PacketPanel.test.tsx:69`, `packet-session.test.ts:266` and `packet-queue.spec.ts:118`). The title of the test at `packet-session.test.ts:257` is reworded to say on-the-hour sheets.
    - Random packets (R1(c)): no `RANDOM_PACKET_FOCUS` row changes. Step 39 already made the clock row `seedOnly`, the defaults plus the kept choices (`{ ...worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2), ...keptChoices(selection) }`), so once `defaults.ts` (:155) carries `clockExplorer`, every clock sheet gets `DEFAULT_CLOCK_EXPLORER` at every level and Step 39's no-leak test stays green. Spreading the parent's `selection` here would break that test. Only the `RANDOM_PACKET_FOCUS` docblock's "Clock Explorer … has no practice choice" clause (:139-143 today; re-grep after Step 39) is reworded. Step 55 maps the levels onto the new steps.
    - Capacity stays `SUFFICIENT_CAPACITY`.
  - **Advice:** `CLOCK_EXPLORER_LIMITING_RESOURCE_ADVICE` (`definition.ts:43`) says that no other choice changes the twelve times, which becomes false.
    - It becomes `clockExplorerLimitingResourceAdvice(step)`: "Clock Explorer draws 4 clocks from a fixed set of <n> <step> times. Choose other Clock times, or create a new worksheet later." Here n is 12, 24 or 48, and the step text is "on-the-hour", "half-hour" or "quarter-hour".
    - The registry (:730-731) reads it from `selection.clockExplorer.timeStep`. This is UI copy, not document bytes.
    - Pins that change: `options.test.tsx:1241-1242` and the exhausted message at `math-generation.test.ts:409`.
    - The `limit-labels.test.ts` import (:50) and its notes at :383-384 and :532-535 are reworded.
    - The new advice recommends its own control, so the guard's intent changes from "recommends no control" to "names only its own control": the checks at `limit-labels.test.ts:1512-1514` and `math-generation.test.ts:411-413` keep `not.toMatch(/practice focus|length|More options/u)` and add a positive `toContain("Clock times")`. The comment at `limit-labels.test.ts:1505-1506` ("advice that recommends no control"), the title at `math-generation.test.ts:391` ("… without recommending a control") and the comment at `options.test.tsx:1240` ("A fixed domain: no range, length or practice focus is recommended.") are reworded to match.
  - **Copy:**
    - The card text becomes "Read four clocks and write each time."
    - For minute steps the instruction is "Read each clock. Write the hour and the minutes." On the hour keeps "Read each clock. Write the hour on the line."
    - Key and spoken-dial text follow the Spec section.
  - **Renderer and key:**
    - The minute hand is drawn at `6·minute` degrees and the hour hand at `30·(hour mod 12) + minute/2` degrees.
    - The on-the-hour response markup is unchanged: one `span` with `data-time-blank="true"`, `aria-label="blank for the hour"` and `role="img"` (`Renderer.tsx:189-201`), followed by ":00".
    - Minute steps print `Time: [blank] : [blank]`. Both blanks keep `data-time-blank="true"`, so the size table's `[data-time-blank]` selector (`print.spec.ts:115`) measures both at 18/22 mm. They add `data-time-part="hour"` / `"minutes"`, with `aria-label` "blank for the hour" and "blank for the minutes".
    - The key prints `h:mm` and the hands text.
    - No new print token, and dial geometry is unchanged. The minute hand now also points at 3, 6 and 9, which the plain dial has never measured. The quarter row measures all four directions on every paper and scale, because its boundary seed holds a :15, a :30 and a :45 time. Half-hour pages use only the 12 and 6 positions, so the quarter row bounds them.
  - **Print row:** `clock-quarter-hours` on Letter/A4 × standard/large, with no decoration.
  - **Docs and comments:**
    - README: the clause on line 5, the Clock Explorer row (:17) and the "no practice focus" clause (:22). Keep the literal "within 20" (`frontend/scripts/audit-release.mjs:157`).
    - `docs/educational-basis.md`, Clock Explorer section (:147-166), including the now-false "Half hours are not offered" (:164-165): describe half hours and quarter hours, citing Common Core Grade 1 and Grade 2 Measurement and Data only for telling time to the half hour and to five minutes, with no grade or readiness claim.
    - `docs/testing-print.md`: row :88, the dial and hour-line prose (:128-129), the calibration prose (:145-156) and the counts.
    - `CLAUDE.md`: :77, :113-115 and :120 (canonical requests and "no settings group").
    - Reword the comments that state an on-the-hour-only or no-choice domain: `types.ts:88-91` and :533-538; `answer-oracle.ts:125-129` and :181-182; `invariants.ts:576-577`; `project-request.ts:181-184`; `clock-explorer/definition.ts:8-16` and :38-42; `generator.ts:20-25` and :37-43; `Renderer.tsx:11-17`; `registry.ts:724-725` and :730; `tokens.css:276-281`; `clock-oracle.ts:13`; and `registry.test.ts:1221-1222` and :3266. Do not enumerate coverage.
  - **Version:** 1.15.0 (`npm --prefix frontend version 1.15.0 --no-git-tag-version`, HP4).
- **Done when:**
  1. **Oracle and generator** (`generator.test.ts`, `answer-oracle.test.ts`, `clock-time.test.ts`, `clock-oracle.ts`):
     - Every half-hour (24) and quarter-hour (48) time has the oracle's hand angles and key line. 12:30 and 12:45 read "between 12 and 1".
     - About 400 seeds per step each give four distinct (hour, minute) times on the step, and every page holds at least one step witness.
     - Known vectors pin five seeds per new step.
     - The on-the-hour known vectors at `generator.test.ts:102-108` pass unchanged.
     - Mirror case: the same seed with another step changes the minutes.
  2. **Negatives:** each of these fails with `GENERATION_INVARIANT_FAILED`, and `judgeClockDocument` rejects the same mutations:
     - a minute off the step, or a minute of 60;
     - a `minute` on an on-the-hour page, or a missing `minute` on a quarter page;
     - a `number` answer on a quarter page, or a `time` answer with the wrong minute;
     - a duplicate (hour, minute), or a page with no step witness;
     - a clock `practice` member with `timeStep: "hour"` or with an unknown step;
     - a Tally Detective request carrying the clock member (Tally stays strict).
  3. **Availability and persistence** (`schema-parity.test.ts`, `config-api.test.ts`, `project-request.test.ts`, `worksheet-session.test.ts`, `src/web/worksheets/registry.test.ts`, `shipped-profile-options.test.ts`):
     - `$.defaults.clockExplorer` has an absent-probe object row, and `timeStep` has an enum row.
     - `config-api.test.ts`, following the `describe.each` at :617-667: an explicit PUT of each non-hour step reads back through GET and from the stored bytes, with profiles untouched. A v2 file written to the temporary path without `clockExplorer` reads back as `{ timeStep: "hour" }`, and its bytes are unchanged after the GET.
     - `config-shape-fingerprint.test.ts` passes without a repin.
     - An on-the-hour request deep-equals today's request (no `practice`).
     - `tests/fixtures/golden/practice-content-keys.json` and `practice-golden.test.ts` are unchanged.
     - Noninterference owner: `FAMILY_CHOICE_EDITS` (`registry.test.ts:1144-1250`) gives Clock Explorer `own: otherClockExplorer` (timeStep changed) instead of `own: undefined` (:1221-1224), and that comment is reworded. `otherClockExplorer` is composed into all seven other families' `foreign` lists, Tally Detective's (:1238-1250) included. The `own === undefined` branch's flag list (:1570-1584), now reached by Tally Detective alone, gains `clockTimeStep`.
     - `CONTROL_PROBES` (:1287 onward) gains a `clockTimeStep` entry observing the clock `practice` member, with values `[unchanged, otherClockExplorer]`.
     - `registry.test.ts` (`sweepCells`, :3267) and `shipped-profile-options.test.ts` (:198-199) each add one Clock Explorer cell per step, and their "fixed twelve hours" comments are reworded. The `registry.test.ts` catalog-sweep length pin (:3310) rises by 6 per added cell.
     - `earlier-settings.test.ts`: following the Operation Grid case (:219-222), earlier settings keep a non-default `clockExplorer` group unchanged, and `result.groups` does not contain `"clockExplorer"`.
  4. **Summaries, advice and packets:**
     - `options.test.tsx`: the selection summary reads "Clock times for Clock Explorer: On the hour." / "Half hours." / "Quarter hours." for each choice. The advice pin at :1242 is updated to the on-the-hour sentence, and one pin is added per new step.
     - `limit-labels.test.ts`: the sweep (:1081 onward) adds one Clock Explorer cell per step, and each step's advice arm is observed, so no step falls back to the on-the-hour sentence. The clock guard (:1512-1514) asserts `not.toMatch(/practice focus|length|More options/u)` and `toContain("Clock times")`.
     - `math-generation.test.ts:409` reads the new on-the-hour exhausted message, and its guard (:411-413) asserts the same pair.
     - `packet-session.test.ts`: a queued Quarter hours sheet reads "Sheet N · Clock Explorer · Quarter hours · for <child>", a Half hours sheet names "Half hours", and an on-the-hour sheet keeps today's label.
     - `random-packet.test.ts`: with the parent's selection at Quarter hours, every clock sheet at every level carries `timeStep: "hour"`, its items have no `minute`, and the parent's selection object is unchanged.
  5. **Render and key** (`Renderer.test.tsx`, `math-generation.test.ts`):
     - Reading only the rendered SVG endpoints, every hand angle matches the oracle within 1.5°.
     - Minute pages show two empty blanks with the labels above. On-the-hour pages show today's exact blank markup before `:00`.
     - Key lines equal `oracleClockKeyLine`.
     - `createWorksheetSessionForSeed` returns validated, oracle-accepted half-hour and quarter-hour pages.
  6. **Browser and print** (`visual-math.spec.ts`, `accessibility.spec.ts`, `print.spec.ts`):
     - On the compiled app, choosing Half hours and then Quarter hours each runs Create, preview and key; Quarter hours also prints.
     - The noninterference test (`visual-math.spec.ts:199-234`) also proves that the clock's own stored step changes the clocks, survives switching families, and saves and reloads explicitly without touching profiles.
     - The Clock Explorer accessibility test (`accessibility.spec.ts:684-738`) shows the Clock times group and reaches it by keyboard, with axe clean at 320 px. Its title, which says it "shows only the nickname, key, paper and scale", is reworded to name Clock times.
     - Each `clock-quarter-hours` cell's boundary seed holds:
       - a 12:xx time with a minute other than 0;
       - a :15, a :30 and a :45 time;
       - a 10:xx or 11:xx time with a minute other than 0.

       About 1 seed in 36 qualifies, well inside the 50,000-seed search.
     - That seed prints one worksheet page and one key page, with every response on one line inside its card. `clockInkViolations` reads every hand back as its (hour, minute), and no hand meets a label at 12, 3, 6 or 9.
     - Calibrations each fail, then restore clean:
       - the hour hand of the :45 clock redrawn at its on-the-hour angle;
       - the minute hand of the :15 clock redrawn at 12;
       - one minutes blank hidden.
     - `docs/testing-print.md` and `ci-contract.test.ts` change by the delta relative to the previous step's merged counts:
       - +4 print.spec rows (`ci-contract.test.ts:48`);
       - +1 row in each decoration-false cell (:68-72);
       - +1 `clock-` row per cell (:73-75);
       - +4 worksheet cases and +4 keys in `docs/testing-print.md`.
  7. **Version:** `package.json` and `package-lock.json` read 1.15.0.
  8. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 49

### Step 51: Five-minute and any-minute clocks
- **Status:** PENDING
- **Problem:** The Clock times choice gains **Five minutes** (any multiple of five, for example 3:55) and **Any minute** (for example 7:43). These pages use a larger minute dial with 60 minute marks, 12 heavier marks at the numbers, and the twelve numbers moved inward at the same 16/18 pt print size. The minute hand and every mark stay measurably clear of all twelve numbers, including the wide 10 and 11. The hour hand sits just short of the next number at :55. The key reads, for example, "7:43 — long hand 3 marks past 8, short hand between 7 and 8". The summary, advice and packet rows name the two new choices; random packets still print on-the-hour clocks until Step 55.
- **Type:** code
- **Issue:** #62
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - `src/shared/config/enums.ts`, `src/shared/worksheet/{clock-time.ts,clock-time.test.ts,types.ts,invariants.ts,project-request.test.ts,limit-labels.test.ts}`.
  - `src/worksheets/clock-explorer/{definition.ts,generator.ts,generator.test.ts}`.
  - `src/web/worksheets/clock-explorer/{Renderer.tsx,Renderer.test.tsx}`, `src/web/worksheets/registry.test.ts`, `src/web/styles/tokens.css`, `src/web/generator/{options.test.tsx,math-generation.test.ts}`.
  - `src/web/packet/{packet-session.test.ts,random-packet.test.ts}` (wording and leak tests only; R1(b) and R1(c)).
  - `tests/oracles/clock-oracle.ts`, `tests/integration/{schema-parity,ci-contract,config-api,shipped-profile-options}.test.ts`, `tests/fixtures/print/{matrix.ts,required-content.ts}`, `tests/e2e/{print,visual-math}.spec.ts`.
  - `package.json`, `package-lock.json`.
  - `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`.
- **Produces:**
  - **Persisted setting:** `"five-minute"` and `"any-minute"` are appended to `CLOCK_EXPLORER_TIME_STEPS`.
    - These are additive enum members, and nothing else persisted changes.
    - This completes the enum, because one minute is the finest step a 60-mark dial shows.
    - An older Step 50 build reports such a file as `blocked`, never `invalid`.
  - **Request:** the practice arm's `timeStep` admits the two new steps. Steps of 5 and 1 minutes give 144 and 720 candidates. Capacity is unchanged.
  - **Generator:** the same candidate shuffle and witness rule, so the existing steps' vectors stay unchanged.
  - **Labels, advice and rows:** `CLOCK_EXPLORER_TIME_STEP_LABELS` gains "Five minutes" and "Any minute".
    - The summary, the advice and the packet `detailOf` arm pick them up from that one owner (R2). The advice uses n = 144 with "five-minute" and n = 720 with "any-minute".
    - The random-packet clock row is unchanged (Step 39's `seedOnly`) and stays on the hour.
  - **Minute face** (Design defaults, Clocks 4; built here): five-minute and any-minute dials render a separate face geometry in `Renderer.tsx`. Each minute dial carries both `data-clock-dial="true"` and `data-clock-face="minute"`, so `readClockInk` (`print.spec.ts:380`) still finds it. Hour, half-hour and quarter-hour dials stay exactly as in Step 50, with no `data-clock-face` attribute and plain markup.
    - Dial size: the new print token `--clock-minute-dial` is 50 mm standard and 56 mm large, declared in `tokens.css` beside `--clock-dial` (:285-290). It is applied by `.print-surface [data-clock-dial][data-clock-face="minute"]`, placed after the plain `[data-clock-dial]` rule (:293-296); that rule also uses `!important`, so the higher specificity and the later position decide the size. The plain dial stays 40/45 mm.
    - Labels stay at `--instruction-size` (16/18 pt, `tokens.css:297-300`), bold, with line height 1. They move inward to a measured radius, starting at 34 %.
    - The face carries 60 radial `line[data-clock-tick]` marks, all inside the outline. The 12 at multiples of 30° are `="major"` and run from about 44 % to 47 %, at least 1.5 mm long at standard scale. The minors run from about 45 % to 47 %, at least 0.8 mm long.
    - The minute hand shortens (starting at 22). The hour hand stays 16 long by 5.5 wide, so the minute hand is 1.375 × the hour hand.
    - Print measurement chooses the final constants. The bar, at both scales:
      - every tick, and the minute hand at each of the 60 positions, at least 0.75 mm clear of every label box;
      - tick lengths at or above the minimums;
      - minute hand at least 1.25 × the hour hand's length;
      - the existing label-overlap, label-inside-dial, hand-inside-outline and outline checks (`print.spec.ts:389-399`, :425-447) all pass on minute faces.
  - **Print styles:**
    - The black stroke rule at `tokens.css:301-302` extends to `[data-clock-tick]`. At 50/56 mm the marks are about 2.3/2.5 mm apart at the outline.
    - In `print.spec.ts`, `physicalSelectors.clockDial` (:114) becomes `[data-clock-dial]:not([data-clock-face])` and keeps 40/45. A new `clockMinuteDial` selector, `[data-clock-dial][data-clock-face="minute"]`, gets size-table entries of 50 (:94) and 56 (:100) and a `case` in `physicalViolations` (:197-200).
    - The existing collapsed-dial calibration (`print.spec.ts:1127-1134`) expects `clockMinuteDial[0]: widthMm` on minute-face rows and `clockDial[0]: widthMm` on the others. Its injected style today is `.print-surface [data-clock-dial] { width: 10mm !important; height: 10mm !important; }`, specificity (0,2,0), which loses to the (0,3,0) minute-face rule whatever the order (`withPrintStyle`, `print.spec.ts:612-619`, only appends a style tag, and `src/web/styles` has no `@layer`). On minute-face rows the collapse style therefore targets `.print-surface [data-clock-dial][data-clock-face="minute"]` (at least (0,3,0)), and so does the Done-when 5 "minute dial forced to 40/45 mm" calibration.
  - **Copy:** the key and spoken text name "marks past N" for a minute that is not a multiple of five.
  - **Print row:** `clock-any-minute` on all four paper and scale cells. Five minutes shares the face, which `Renderer.test.tsx` asserts, so it adds no row.
  - **Docs:**
    - README Clock Explorer row, keeping the literal "within 20" (`audit-release.mjs:157`).
    - Educational basis: five minutes and the nearest minute, citing Common Core Grade 2 and Grade 3 Measurement and Data only for those skills.
    - `docs/testing-print.md`: the row, the dial prose at :128-129 (minute dials 50/56 mm), the tick calibration and the counts.
    - `CLAUDE.md`: the clock claims.
    - Comments: the `tokens.css:276-282` clock block names the minute face.
  - **Version:** 1.16.0 (`npm --prefix frontend version 1.16.0 --no-git-tag-version`, HP4).
- **Done when:**
  1. **Oracle and generator:**
     - Every five-minute time (144) and a sweep of all 720 any-minute times have oracle hand angles, `oracleTimeFromHands` round trips and key lines.
     - 11:55 and 12:55 put the hour hand 2.5° short of the next number.
     - The page properties of Step 50 hold for both new steps, and known vectors pin five seeds each.
     - Step 50's vectors and the on-the-hour vectors pass unchanged.
  2. **Negatives:**
     - Each of these fails the invariants and `judgeClockDocument`:
       - a minute that is not a multiple of 5 on a five-minute page;
       - a five-minute page with no minute off the quarter hours;
       - an any-minute page with no minute off the five-minute marks;
       - a minute of 60 or -1.
     - The oracle rejects an 11:55 whose hour hand reads 12, and accepts a 12:00 minute hand measured at 359.5°.
  3. **Availability, persistence and wording:**
     - The `timeStep` enum row covers five members.
     - `config-api.test.ts`: an explicit PUT of each new step reads back through GET and from the stored bytes, with profiles untouched. A v2 file without the group still reads as `hour`, and its bytes are unchanged.
     - The fingerprint passes without a repin, and the goldens are unchanged.
     - Five-minute and any-minute requests project their own member. The hour, half-hour and quarter-hour requests deep-equal Step 50's.
     - `registry.test.ts`, `shipped-profile-options.test.ts` and `limit-labels.test.ts` each add a sweep cell per new step (the `registry.test.ts` length pin at :3310 rises by 6 per cell), and `limit-labels.test.ts` observes each new advice arm.
     - `options.test.tsx` pins the two new summary sentences and advice sentences.
     - `packet-session.test.ts` pins "Five minutes" and "Any minute" rows.
     - `random-packet.test.ts` repeats the Step 50 leak test with the parent at Any minute.
  4. **Render and key:**
     - Minute faces render exactly 60 ticks, with 12 majors at 0°, 30° and so on through 330°. Hour, half-hour and quarter-hour faces render no ticks and no `data-clock-face`.
     - Five-minute and any-minute faces render identical tick, label and hand geometry (one constant set).
     - Hand endpoints match the oracle, and the key lines equal the oracle.
     - `createWorksheetSessionForSeed` returns validated, oracle-accepted five-minute and any-minute pages.
  5. **Browser and print:**
     - The compiled journey runs Five minutes and Any minute through Create, key and print. It also saves worksheet defaults at Any minute, reloads, finds Any minute still chosen, and leaves profiles untouched.
     - Each `clock-any-minute` cell's boundary seed holds a 12:5x time (hour hand just short of 1), an 11:5x time, and a minute that is not a multiple of 5. It prints one worksheet page and one key page on Letter and A4 at both scales, with all four cards on that page.
     - Minute dials measure 50/56 mm and plain dials 40/45 mm.
     - Every tick is real ink under print media, radial within 1.5°, at least its minimum length, inside the outline, and at least 0.75 mm clear of every label. The existing label-overlap and label-inside-dial checks pass.
     - Inside the row, a sweep redraws one minute hand at all 60 oracle angles and finds it at least 0.75 mm clear of every label at both scales.
     - Calibrations each fail, then restore clean:
       - one minor tick hidden, or one major tick at zero width;
       - one tick removed (59 counted), or a major tick rotated 6°;
       - one minor tick shortened to 0.3 mm;
       - the 11:5x clock's hour hand redrawn at the 12 position;
       - the minute hand lengthened to 27 in the sweep;
       - the hour hand lengthened to the minute hand's length;
       - a minute dial forced to 40/45 mm with a `.print-surface [data-clock-dial][data-clock-face="minute"]` style, which fails its size and makes its labels overlap;
       - the collapsed-dial calibration, injected with that same (0,3,0) selector on minute-face rows, reporting `clockMinuteDial[0]`.
     - Counts change by the delta relative to Step 50's merged counts:
       - +4 print.spec rows;
       - +1 row in each decoration-false cell;
       - +1 `clock-` row per cell;
       - +4 worksheet cases and +4 keys in `docs/testing-print.md`.
  6. **Version:** `package.json` and `package-lock.json` read 1.16.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 50

### Step 52: Quantities to 50 and to 100 as tens and ones
- **Status:** PENDING
- **Problem:** A parent picks "Tens and ones, 21 to 50" or "Tens and ones, 21 to 100" as the Count, Compare & Make practice focus and gets a printable page of base-ten pictures: rods of ten plus loose ones. The child circles the number a picture shows, compares two pictures, finishes a picture to reach a target, and draws a number as tens and ones. The key prints each made or drawn answer, for example "35 (3 tens and 5 ones)". Decoration and Theme do not apply to these pages. Ten-frames and loose piles stay for the existing ranges.
- **Type:** code
- **Issue:** #63
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/worksheet/{types.ts,project-request.ts,project-request.test.ts,invariants.ts,registry.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,practice-focus.ts,practice-focus.test.ts,earlier-settings.test.ts}`; `frontend/src/server/transport-schemas.ts` (only if the transport `mode` enum is not already read from `COUNT_COMPARE_MAKE_MODES`).
  - Family: `frontend/src/worksheets/count-compare-make/{definition.ts,generator.ts,generator.test.ts}`.
  - Web: `frontend/src/web/worksheets/count-compare-make/Renderer.tsx`; new `frontend/src/web/preview/{BaseTenPicture.tsx,BaseTenPicture.test.tsx}`; `frontend/src/web/print/AnswerKeyView.tsx`; `frontend/src/web/styles/tokens.css`; `frontend/src/web/generator/{math-generation.test.ts,options.test.tsx}`; `frontend/src/web/worksheets/registry.test.ts` (per-family control pins).
  - Packet (wording and pin tests only, rulings R1(b) and R1(c)): `frontend/src/web/packet/{packet-session.test.ts,random-packet.test.ts}`.
  - Tests: new `frontend/tests/oracles/base-ten-oracle.ts`; `frontend/tests/integration/{schema-parity,shipped-profile-options,ci-contract,config-api}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,count-layout.ts,required-content.ts}`; `frontend/tests/e2e/{count-compare-make,print}.spec.ts`.
  - Docs and version: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`, `frontend/package.json`, `frontend/package-lock.json`.
- **Produces:**
  - **Persisted fields:** `COUNT_COMPARE_MAKE_MODES` (Step 49) appends `"tens-and-ones-to-50"` and `"tens-and-ones-to-100"`.
    - Each is a new member of a value list that no array bound derives from, so it is additive at schemaVersion 2. It needs no new key, no new required field and no widened bound.
    - The three quantity maxima keep 1..20 (R3).
    - An older Step 51 build reports such a file as `blocked`, never `invalid`.
  - **Constants** (`types.ts`, beside `DRY_MATH_NUMERIC_MAXIMUM`):
    - `COUNT_COMPARE_MAKE_TENS_ONES_MINIMUM = V1_NUMERIC_MAXIMUM + 1`
    - `COUNT_COMPARE_MAKE_TENS_ONES_MAXIMA = { "tens-and-ones-to-50": 50, "tens-and-ones-to-100": 100 }`
    - `COUNT_COMPARE_MAKE_TENS_ONES_COMPARE_SPREAD = 10`
  - **Catalog and labels:** the CCM catalog appends two entries after the preset loop and after Step 49's numerals entry.
    - Their labels are built from the constants: "Tens and ones, 21 to 50" and "Tens and ones, 21 to 100".
    - Each entry stores maxima of `V1_NUMERIC_MAXIMUM` (a valid saved setting) plus its `mode` member.
    - `describePracticeFocus` and `canonicalFocus` read `mode`. The controls summary, the earlier-settings status and the packet row (`packet-session.ts:211-212`) therefore name the range from that one owner (R2) with no code change.
  - **Projection:** practice `{kind: "count-compare-tens-ones", mode}` with the inactive quantities skills `{...inactiveMath(), representations: ["quantities"]}`, so the hidden maxima never reach the request.
    - In these modes `includeDecorativeGraphics` projects `false` and no `decorativeTopicId` is set (`project-request.ts:223-246`, :360-368).
    - The stored decoration and Theme are untouched, so switching back restores them.
    - Every other mode projects exactly as before.
  - **Generator:** a tens-and-ones arm over D = 21..max with fixed pools:
    - to 50: match 30, compare 520, complete 603, draw 30;
    - to 100: match 80, compare 1,570, complete 2,708, draw 80.

    Match places one ones-neighbour and one tens-neighbour, with directions drawn by the seed. Complete never trades a ten.
    - Effective length at standard print: long 8, standard 8, short 6 (long uses the 2/2/2/2 allocation). At large print: long 6, standard 6, short 6 (2/2/1/1).
  - **Registry:** in these modes:
    - `getRelevantMaximums` returns `NO_MAXIMUMS`;
    - the advice names the mode's fixed range;
    - `getApplicableControls` (`registry.ts:613-619`) returns `includeDecorativeGraphics: false` and `theme: false`;
    - `getEffectiveUnit` reads the mode-aware count (`registry.ts:600-628`).
  - **Renderer and key:**
    - `BaseTenPicture` is inline SVG with a fixed height of 10 units. Each rod is ten touching unit squares, and the ones are separated squares in at most two columns of five. Its own ceiling is the to-100 maximum.
    - Match is deliberately reversed for these modes. Today's match prints a numeral and three groups ("Circle the group that shows", `Renderer.tsx:94-95`). Here it prints one picture and three numerals ("Circle the number this picture shows."), because three stacked base-ten pictures do not fit a card.
      - The item keeps `target` and `choices`, and the key still prints "Choice N".
      - Required-content for this mode expects the one picture, its `data-base-ten-value` and the three numerals.
    - Complete and draw get a fixed-height response box. Compare keeps the relation phrase.
    - Complete and draw keys print `N (<parts>)`, from one owner, `tensOnesText` in `definition.ts`. That owner also writes the picture's `aria-label`.
      - A zero part is left out, and a nonzero part is singular at 1.
      - Examples: "1 (1 one)", "7 (7 ones)", "30 (3 tens)", "35 (3 tens and 5 ones)", "100 (10 tens)", "21 (2 tens and 1 one)".
      - These cases are reachable: a complete answer is `target - partial` (`count-compare-make/generator.ts:361-362`), so answers 1-9 and multiples of 10 occur, and a partial picture can have no tens.
  - **Print:**
    - `tokens.css` adds `--base-ten-unit` (2.2 mm standard, 2.5 mm large) and `--base-ten-response-height` (26 mm standard, 30 mm large).
    - Decoration rows come from the registry, not the family. `print.spec.ts:897-898` today decides `decorationApplicable` by family alone, which would give every CCM fixture a decoration-true row. It becomes `getWorksheetRegistration(fixture.selection.worksheetType).controls.getApplicableControls({ selection: fixture.selection }).includeDecorativeGraphics`.
      - The loop (:915) and the graphics-control count (:976) read that value.
      - Every existing fixture, including Step 49's decorated `count-numerals-100`, gets the same value it gets today, so its rows are unchanged.
    - Fixture `count-tens-ones-100` prints on all four paper and scale cells, decoration-false only.
      - Its boundary seed puts 99 in a compare item and 100 on the page.
      - The to-50 mode has no print row. It uses the same renderer, CSS and card bounds with at most five rods, so the to-100 rows bound it, and the compiled-app test covers it.
    - `count-layout.ts` gains `tensOnesCardBounds`. `countOrderBound` takes an allocation (defaulting to today's), so it can enumerate the 2/2/2/2 and 2/2/1/1 orders.
      - The order checks run inside the `count-tens-ones-100` cell tests, so the "count ordering and frame bounds" pin (`ci-contract.test.ts:49`) stays 4.
  - **Docs and comments:**
    - README :14 and :167 gain one clause each, keeping the literal "within 20" (`audit-release.mjs:157`), for example "...stay within 20 unless the parent chooses tens and ones to 50 or 100".
    - educational-basis: :51 (Numeric range), :220-222 (the CCM `min(..., 20)` limits), and a new tens-and-ones paragraph with no grade or readiness claim.
    - Comments:
      - `count-compare-make/definition.ts:23-33`, :80-83 and :91-95. Keep every existing archived-plan line citation; the `plan-citations.json` siteCount is unchanged.
      - `practice-focus.ts:6-10`: the catalogs derive from `MATH_PRESETS` except for the named constant-derived entries.
    - testing-print counts, CLAUDE.md :75 and the current-state section.
  - **Version:** 1.17.0 (`npm --prefix frontend version 1.17.0 --no-git-tag-version`, HP4).
- **Done when:**
  1. **Oracle and generator** (`count-compare-make/generator.test.ts`, `math-generation.test.ts`):
     - For each mode, each enumerated pool length equals its closed form, giving the counts above:
       - compare: n + 2(Sn − S(S+1)/2);
       - complete: Σ((⌊t/10⌋+1)(t mod 10+1)−2).
     - Every item holds:
       - targets and compared values are in 21..max, and compared pairs differ by at most 10;
       - complete partials have tens ≤ the target's tens and ones ≤ the target's ones;
       - match choices are {t, t±1, t±10}, all within 21..max;
       - every answer recomputes.
     - A mirror pair (same seed, "Quantities to 20") prints today's document.
     - Inline vectors pin one page per mode.
     - `createWorksheetSessionForSeed` returns a validated, oracle-accepted document for both modes at all three lengths × two scales: long 8, standard 8, short 6 at standard print, and 6, 6, 6 at large print.
  2. **Negatives:** each of these fails with `GENERATION_INVARIANT_FAILED`:
     - a target of 20, or above the mode's maximum (51 on to-50, 101 on to-100);
     - a compare pair 15 apart;
     - a complete partial that trades a ten (target 52, partial 27);
     - a match distractor off by 2;
     - a tens-and-ones member on another family's request;
     - a tens-and-ones request whose `mathSkills` differs from the inactive quantities skills;
     - a tens-and-ones request with `includeDecorativeGraphics: true` or a `decorativeTopicId`.
  3. **Availability, persistence and wording** (`schema-parity`, `config-api`, `shipped-profile-options`, `limit-labels`, `practice-focus`, `project-request`, `earlier-settings`, `registry.test.ts`, `packet-session.test.ts`, `random-packet.test.ts`):
     - `$.defaults.countCompareMake.mode` has an enum parity row for each new member. A v2 file without `mode` still parses as `"groups"`, and the fingerprint passes without a repin.
     - `config-api.test.ts`: an explicit PUT of each new member reads back through GET and from the stored bytes, with profiles untouched. A v2 file without `mode` reads as `"groups"`, and its bytes are unchanged after the GET.
     - Earlier settings still map to `"groups"`.
     - The preset-origin test's Count, Compare & Make loop (`practice-focus.test.ts:125-134`) keeps Step 49's filter, checking only `mode: "groups"` entries, so Step 49's numerals entry and these two entries are left out by that filter, not by a list of named exceptions. The `registry.test.ts` catalog-sweep length pin (:3310) rises by exactly 12 (two entries), and its starving set stays `[]`. The CCM label list, which Step 49 split from the two-catalog pin (`practice-focus.test.ts:70-77`), grows by two.
     - Both entries are available at every length and scale. Their limit-labels arm is "sufficient", and their advice names the fixed range.
     - In these modes the applicable controls report decoration and Theme off. Changing the hidden maxima, decoration or Theme leaves the request byte-identical.
     - The controls summary and a queued sheet's row read "Tens and ones, 21 to 50" / "Tens and ones, 21 to 100".
     - `random-packet.test.ts`: with the parent at "Tens and ones, 21 to 100", every CCM sheet at every level has mode `"groups"`, its request carries no `count-compare-tens-ones` member, and the parent's selection object is unchanged.
     - `practice-content-keys.json` and its SHA are unchanged, and generatorVersion stays 1.
  4. **Render and key** (`BaseTenPicture.test.tsx`; `base-ten-oracle.ts` read over rendered SVG):
     - For every n in 21..100, reading only rect geometry gives rods×10+ones = n.
     - Every picture's viewBox height is identical, and 100 draws ten rods.
     - Complete and draw key lines and every picture `aria-label` follow `tensOnesText`. Pins: "1 (1 one)", "30 (3 tens)", "100 (10 tens)", "21 (2 tens and 1 one)", and a partial-picture label of "7 ones". No line or label contains "0 tens" or "0 ones".
     - Match prints "Choice N".
  5. **Browser and print** (`count-compare-make.spec.ts`, `print.spec.ts`):
     - The compiled app selects each tens-and-ones focus, then creates, previews, keys and prints. The decoration and Theme controls are absent for it.
     - It saves worksheet defaults at "Tens and ones, 21 to 100", reloads, and finds that focus still chosen, with profiles untouched.
     - Each `count-tens-ones-100` cell prints one worksheet page and one key page:
       - every card fits under its bound;
       - every picture is exactly 10 units tall;
       - two compare pictures sit side by side inside the column.
     - Order bound: for every cell, `countOrderBound` with the tens-and-ones allocation (2,520 orders at standard, 180 at large) plus the header bound is at most the printable height. The worst order and its reverse, applied as a labeled DOM stress on real rendered cards (as in the existing "count ordering and frame bounds" test), print one page.
     - The base-ten print oracle reads each picture's ink back to its item value.
       - Calibration: hiding one rod cell (a partial rod) or zeroing one unit's stroke width fails; restoring passes.
     - Decoration: `count-tens-ones-100` produces no decoration-true row. Every pre-existing row name is unchanged.
     - Counts, relative to Step 51's merged values:
       - `ci-contract.test.ts` gains 4 decoration-false rows (one per cell): the total at :48 and the decoration-false per-cell count at :68-72 move by that delta;
       - the decoration-true per-cell count and the regex at :82-85 are unchanged;
       - `docs/testing-print.md` changes by the same delta.
  6. **Version:** `package.json` and `package-lock.json` read 1.17.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 51

### Step 53: Wow dots to 50 in rows of ten
- **Status:** PENDING
- **Problem:** A parent picks "Dots 21 to 50 in rows of ten" as the Two Whats and a Wow quantity practice focus. Each group shows three numeral-and-dot pairs with the same numeral; the dots are laid out in rows of ten with a gap after the fifth, two pairs are near misses (±1, ±2 or ±10 dots) and one matches. The child circles the matching pair. The page keeps today's group budgets, and the key prints "Choice N".
- **Type:** code
- **Issue:** #64
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/worksheet/{types.ts,project-request.ts,project-request.test.ts,invariants.ts,registry.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,practice-focus.ts,practice-focus.test.ts,earlier-settings.ts,earlier-settings.test.ts,migrate.test.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Family: `frontend/src/worksheets/find-the-wow/{definition.ts,generator.ts,generator.test.ts}`.
  - Web: `frontend/src/web/worksheets/find-the-wow/Renderer.tsx`; `frontend/src/web/styles/tokens.css`; `frontend/src/web/generator/{math-generation.test.ts,options.test.tsx,worksheet-session.test.ts}`; `frontend/src/web/worksheets/registry.test.ts`.
  - Packet (wording and pin tests only, rulings R1(b) and R1(c)): `frontend/src/web/packet/{packet-session.test.ts,random-packet.test.ts}`.
  - Tests: `frontend/tests/integration/{schema-parity,shipped-profile-options,ci-contract,earlier-settings-canonical,config-api}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/{find-the-wow,print,worksheet-choices}.spec.ts`. These cover every typed `QuantityFocusV2` literal that the new required output field breaks (`grep -rn "quantity: {" frontend/src frontend/tests`).
  - Docs and version: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`, `frontend/package.json`, `frontend/package-lock.json`.
- **Produces:**
  - **Persisted fields:**
    - `FIND_THE_WOW_DOT_LAYOUTS = ["fives", "rows-of-ten"]` goes in `enums.ts`.
    - `findTheWow.quantity.layout` gets `.default("fives")` in `QuantityFocusV2Schema` (`schema.ts:208-211`, used only by `findTheWow.quantity`). It is listed as optional in the transport `quantity` `strictObjectSchema` (`transport-schemas.ts:285-288`).
    - The `variant` enum is unchanged, and no numeric bound is added (R3).
  - **Constants** (`types.ts`):
    - `FIND_THE_WOW_ROWS_OF_TEN_MINIMUM = V1_NUMERIC_MAXIMUM + 1`
    - `FIND_THE_WOW_ROWS_OF_TEN_MAXIMUM = 50`
    - `FIND_THE_WOW_DOT_ROW_WIDTH = 10`
    - The near-miss offsets come from Step 47's one owner, `FIND_THE_WOW_NEAR_MISS_OFFSETS` (`[-10, -2, -1, 1, 2, 10]`), by import. No second literal is written.
  - **Catalog:** the quantity catalog (`practice-focus.ts:347-367`) appends one entry, "Dots 21 to 50 in rows of ten".
    - Its preset entries now carry `layout: "fives"`.
    - The new entry stores maxima of `V1_NUMERIC_MAXIMUM` (a valid saved setting) and `layout: "rows-of-ten"`.
    - `describePracticeFocus` and `canonicalFocus` (:428-458) read `layout`. The controls summary, the earlier-settings status and the packet row (`packet-session.ts:205-208`) therefore name the entry from that one owner (R2) with no code change.
  - **Projection:** practice `{kind: "find-the-wow-quantity", layout: "rows-of-ten"}`, only for the quantity variant with this layout, using the inactive quantities skills. The default layout projects no member.
  - **Generator:**
    - Stems are the 30 targets 21-50, so capacity is 30.
    - Each candidate is a target paired with an unordered pair from N(t) = {t+o : o in the offsets} ∩ [1, 50], giving 389 candidates. For example, N(49) = {39, 47, 48, 50}; 51 and 59 fall outside.
    - It uses today's `constructItems` stream (`generator.ts:225-252`): stem shuffle, balanced positions, per-stem pick, then distractor order.
    - Budgets stay at `FIND_THE_WOW_GROUP_BUDGETS` 4/6/8. Large print steps down as today (long 6, otherwise 4). The five-dot-row cap is what keeps eight groups on one page.
  - **Registry** (`registry.ts:366-378`, :440-495): in this layout `findTheWowRelevantMaximums` returns `NO_MAXIMUMS`, so the hidden 20/20 maxima never appear in limit advice. The advice names the fixed range of 21 to 50.
  - **Renderer:** for this layout the dot grid has ten columns, with a wider gap after the fifth, plus `data-dot-layout="rows-of-ten"`. Five-wide markup for "fives" is unchanged.
  - **Print:**
    - `tokens.css` adds a rows-of-ten rule: ten 2.5 mm columns and a 1 mm half-row gap, about 29.6 mm wide. Its selector is `.print-surface [data-wow-choice] [role="img"][data-dot-layout="rows-of-ten"]` with `!important`, placed after :115-123: the shared rule at :115-118 is (0,3,0) with `!important`, so a rule scoped only as `.print-surface [data-dot-layout="rows-of-ten"]` would lose to it.
    - The shared `repeat(5, 2.5mm)` selector at `tokens.css:115-118` stays as it is, for "fives" and the CCM groups.
    - Fixture `wow-rows-of-ten-50` prints on all four cells, and its boundary seed holds 50 and 49.
  - **Docs and comments:**
    - README :12 and :167, keeping the literal "within 20" (`audit-release.mjs:157`), for example "...quantity pictures stay within 20 unless the parent chooses dots to 50".
    - educational-basis :51 and the Wow section, with no grade claim.
    - The `find-the-wow/definition.ts:31-43` envelope comment.
    - testing-print counts and CLAUDE.md :75.
  - **Version:** 1.18.0 (`npm --prefix frontend version 1.18.0 --no-git-tag-version`, HP4).
- **Done when:**
  1. **Oracle and generator** (`find-the-wow/generator.test.ts`, `math-generation.test.ts`):
     - The stem and candidate counts equal 30 and 389.
     - Every group has:
       - numeral t in 21-50 on all three pairs;
       - three distinct quantities from {t} ∪ N(t);
       - exactly one true choice;
       - balanced positions.
     - The rows-of-ten neighbourhood reads Step 47's exported offsets array: `generator.test.ts` asserts identity (`toBe`), not just equality.
     - A mirror pair (same seed, the default "Quantities to 10" focus) prints today's document.
     - Inline vectors pin one page per length.
     - `createWorksheetSessionForSeed` returns a validated document at every length and scale.
  2. **Negatives:** each of these fails with `GENERATION_INVARIANT_FAILED`:
     - a target of 20 or 51;
     - a distractor off by 3 or by 20;
     - a 51 distractor on t = 49, which is a near-miss offset but above 50;
     - two true choices;
     - a rows-of-ten member on the equation variant or on another family;
     - a rows-of-ten request whose `mathSkills` is not the inactive quantities skills.
  3. **Availability, persistence and wording:**
     - `$.defaults.findTheWow.quantity.layout` has parity rows, including absent.
     - A v2 file without it parses unchanged, and the fingerprint passes without a repin.
     - `config-api.test.ts`: an explicit PUT of `layout: "rows-of-ten"` reads back through GET and from the stored bytes, with profiles untouched. A v2 file without `layout` reads as `"fives"`, and its bytes are unchanged after the GET.
     - Earlier settings map to "fives".
     - The new catalog entry is available at every length and scale. Its limit-labels arm is "sufficient", `getRelevantMaximums` is empty, and its advice names 21 to 50.
     - Hidden quantity maxima never reach the request.
     - The Wow quantity label list, which Step 49 split from the two-catalog pin (`practice-focus.test.ts:70-77`), gains "Dots 21 to 50 in rows of ten". The preset-origin test (:96-139) reads only the Dry Math and Count, Compare & Make catalogs, so it is unchanged. The `registry.test.ts` catalog-sweep length pin (:3310) rises by exactly 6 (one quantity entry), and its starving set stays `[]`.
     - The controls summary and a queued sheet's row read "Dots 21 to 50 in rows of ten".
     - `random-packet.test.ts`: with the parent at "Dots 21 to 50 in rows of ten", no Wow sheet at any level carries a rows-of-ten member in its request. The quantity candidates' focus has `layout: "fives"`, and the parent's selection object is unchanged.
     - The golden JSON and its SHA are unchanged, and generatorVersion stays 1.
  4. **Render and key:**
     - Rendered marks group into ⌈q/10⌉ rows: every full row has 10 marks, and the last row has q mod 10 (or 10).
     - The "fives" layout renders exactly today's markup.
     - The key prints "Choice N".
  5. **Browser and print** (`find-the-wow.spec.ts`, `worksheet-choices.spec.ts`, `print.spec.ts`):
     - The compiled app selects the focus, then creates, keys and prints.
     - `worksheet-choices.spec.ts` saves worksheet defaults with "Dots 21 to 50 in rows of ten", reloads, reads `layout: "rows-of-ten"` back, and leaves profiles untouched.
     - Each `wow-rows-of-ten-50` cell prints one worksheet page and one key page. Every dot grid stays inside its choice cell. Mark centres form full ten-wide rows with a measurable fifth-to-sixth gap, wider than the gap between any other two neighbouring marks.
     - Worst page: in every cell, a labeled DOM stress on the real rendered page sets every group's min-height to the measured height of that page's tallest (five-row) group, never shrinking. The page must still print one page inside the printable height, which proves the long Letter/standard page with eight five-row groups.
     - Calibrations each fail, then restore clean:
       - forcing one 50-dot choice back to five columns fails the row check;
       - dropping one mark fails the count;
       - zeroing the extra left margin on one 50-dot choice fails the gap check.
     - ci-contract gains 4 decoration-false rows (one per cell), and testing-print counts change by the same delta. The decoration-true count and regex are unchanged.
  6. **Version:** `package.json` and `package-lock.json` read 1.18.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 52

### Step 54: Tallies to 50 in stacked rows
- **Status:** PENDING
- **Problem:** A parent chooses Tally Detective's new Range, "21 to 50", and gets four tallies drawn in stacked rows of four bundles each (20 marks per row). The child writes each total, and the key prints, for example, "47 = 5 × 9 + 2". The default "1 to 20" range prints exactly today's pages. The selection summary names the chosen Range, and Make another's advice and packet rows follow it. Random packets keep printing 1 to 20 tallies at every level until Step 55 maps the levels.
- **Type:** code
- **Issue:** #65
- **Flags:** --reviewers code --isolation worktree
- **Files:**
  - Shared: `frontend/src/shared/worksheet/{types.ts,project-request.ts,project-request.test.ts,invariants.ts,answer-oracle.ts,answer-oracle.test.ts,registry.ts,limit-labels.test.ts}`; `frontend/src/shared/config/{enums.ts,schema.ts,defaults.ts,earlier-settings.ts,earlier-settings.test.ts,migrate.test.ts}`; `frontend/src/server/transport-schemas.ts`.
  - Family: `frontend/src/worksheets/tally-detective/{definition.ts,generator.ts,generator.test.ts}`.
  - Web: `frontend/src/web/worksheets/tally-detective/{Renderer.tsx,Renderer.test.tsx}`; `frontend/src/web/print/AnswerKeyView.tsx`; `frontend/src/web/generator/{GeneratorControls.tsx,worksheet-session.ts,worksheet-session.test.ts,math-generation.test.ts,options.test.tsx}`; `frontend/src/web/worksheets/registry.test.ts`; `frontend/src/web/styles/tokens.css`.
  - Packet (rulings R1(b) and R1(c) only): `frontend/src/web/packet/{packet-session.ts,packet-session.test.ts}` (`detailOf` and its wording test); `frontend/src/web/packet/random-packet.test.ts` (leak test only); `frontend/src/web/packet/random-packet.ts` (docblock comment only, no `RANDOM_PACKET_FOCUS` row edit).
  - Tests: `frontend/tests/oracles/tally-oracle.ts`; `frontend/tests/integration/{schema-parity,ci-contract,config-api,shipped-profile-options}.test.ts`; `frontend/tests/fixtures/print/{matrix.ts,required-content.ts}`; `frontend/tests/e2e/{visual-math,print,accessibility}.spec.ts`; `frontend/tests/e2e/fixtures/worksheet-controls.ts`.
  - Docs and version: `README.md`, `CLAUDE.md`, `docs/educational-basis.md`, `docs/testing-print.md`, `frontend/package.json`, `frontend/package-lock.json`.
- **Produces:**
  - **Persisted fields:**
    - `TALLY_DETECTIVE_RANGES = ["to-20", "to-50"]` goes in `enums.ts`.
    - The selection gets a `tallyDetective` group after `operationGrid` (`schema.ts:240-247`): `{ range: z.enum(TALLY_DETECTIVE_RANGES).default("to-20") }`. Its group default comes from an exported `DEFAULT_TALLY_DETECTIVE = { range: "to-20" }` in `schema.ts`, which the Zod default and `defaults.ts` read; Step 39's `seedOnly` reaches it through `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)`.
    - A `tallyDetectiveSchema` in `transport-schemas.ts`, with `range` optional. It joins `worksheetDefaultsProperties` (:275-282) and the defaults optional list (:375-381).
    - It touches the same default, clone and earlier-settings pass-through sites, and the same `WORKSHEET_GROUP_KEYS` entry with its `safeParse` guard, that Step 50 touched for `clockExplorer`: `defaults.ts:66`, :123 and :155; `earlier-settings.ts:218`; `worksheet-session.ts:38-60` and :300.
  - **Constants** (`types.ts`):
    - `TALLY_DETECTIVE_WIDE_TOTAL_MINIMUM = V1_NUMERIC_MAXIMUM + 1`
    - `TALLY_DETECTIVE_WIDE_TOTAL_MAXIMUM = 50`
    - `TALLY_DETECTIVE_BUNDLES_PER_ROW = 4`
    - `TALLY_DETECTIVE_TOTAL_MAXIMUM` (:104) stays equal to `V1_NUMERIC_MAXIMUM`.
  - **Projection and request:**
    - "to-50" projects `{kind: "tally-detective", range: "to-50"}`, and "to-20" projects no member.
    - The canonical-request check (`invariants.ts:426-440`, which Step 50 split into a base helper) admits exactly that one member on Tally Detective, through `tallyDetectivePracticeOf`.
  - **Generator:** `TALLY_DETECTIVE_TOTALS` (1-20) is unchanged. The new `TALLY_DETECTIVE_WIDE_TOTALS` (21-50) feeds the same `seededShuffle(...).slice(0, 4)`.
  - **Controls and wording** (ruling R2: one wording owner):
    - `TALLY_DETECTIVE_RANGE_LABELS` lives in `tally-detective/definition.ts`, beside Step 50's `CLOCK_EXPLORER_TIME_STEP_LABELS` pattern. Its labels, "1 to 20" and "21 to 50", are built from the total constants. The radio, the summary and the packet row all read it.
    - A "Range" radio group with "1 to 20" and "21 to 50".
    - A new `tallyRange` applicable-control key is declared in all eight registry entries and is true only for this family (`registry.ts:778-793`).
    - Selection summary: like Clock Explorer, Tally Detective's `getCapabilitySupport` (`registry.ts:764-767`) returns `statusMessage: "Totals for Tally Detective: <label>."` for every range, so "Totals for Tally Detective: 1 to 20." is shown as well as "21 to 50.".
    - Advice: `TALLY_DETECTIVE_LIMITING_RESOURCE_ADVICE` (`definition.ts:43`) says that no other choice changes the totals, which becomes false.
      - It becomes `tallyDetectiveLimitingResourceAdvice(range)`: "Tally Detective draws 4 tallies from a fixed set of <n> totals. Choose another Range, or create a new worksheet later." Here n is 20 or 30, from the range constants.
      - The registry (:768-769) reads it from `selection.tallyDetective.range`.
      - The new advice recommends its own control, so the guards at `limit-labels.test.ts:1523-1525` and `math-generation.test.ts:466-468` change intent from "recommends no control" to "names only its own control": each keeps `not.toMatch(/practice focus|length|More options/u)` and adds a positive `toContain("Range")`. Passing the old lowercase `range` alternative by capitalization alone is not relied on.
    - Packet row (R1(b)): `detailOf` (`packet-session.ts:217-219`) splits the shared clock/tally arm. It returns "21 to 50" for a to-50 tally, and a to-20 tally row is unchanged (no detail).
  - **Random packet (R1(c)):** no `RANDOM_PACKET_FOCUS` row changes. Step 39 already made the tally row `seedOnly` (the defaults plus the kept choices), so once `defaults.ts` (:155) carries `tallyDetective`, every tally sheet gets `DEFAULT_TALLY_DETECTIVE` at every level, a saved "21 to 50" never reaches a packet, and Step 39's no-leak test stays green. Spreading the parent's `selection` here would break that test. Only the Tally Detective clause of the `RANDOM_PACKET_FOCUS` docblock is reworded. Step 55 later maps the levels onto to-50.
  - **Renderer:**
    - A tally has one slot per bundle, plus one more if there are loose marks. `tallyRowCount(bundles, remainder) = max(1, ⌈slots / TALLY_DETECTIVE_BUNDLES_PER_ROW⌉)` lives in `tally-detective/definition.ts` beside `tallyGroupingOf`, and the renderer, required-content and print expectations import it.
    - `TALLY_VIEW_WIDTH` becomes `TALLY_DETECTIVE_BUNDLES_PER_ROW * TALLY_SLOT_WIDTH`, still 180 (`Renderer.tsx:20-22`), and `Renderer.test.tsx` asserts that derivation.
    - The viewBox is 180 × 50·rows, and slot s draws at column s mod 4 and row ⌊s/4⌋.
    - A strip with more than one row carries `data-tally-rows="<rows>"` and an inline `--tally-rows`. A one-row tally emits exactly today's markup.
  - **Key:** a total of `TALLY_DETECTIVE_WIDE_TOTAL_MINIMUM` or more prints `T = 5 × B + R`, leaving out "+ 0". Lower totals keep the `8 = 5 + 3` form. The ranges are disjoint, so the form always follows the page's range.
  - **Print:**
    - The strip stays 72 (81) mm wide. Its height is rows × 20 (22.5) mm, through `calc(var(--tally-height) * var(--tally-rows, 1))` (`tokens.css:333-337`).
    - `physicalViolations` (`print.spec.ts:205-208`) expects a `tallyMarks` height of `(data-tally-rows ?? 1) × tallyHeight`.
    - Fixture `tally-totals-50` prints on all four cells. Its boundary seed holds 50 and 49 and puts a three-row tally in each card row.
    - The calibration block (`print.spec.ts:1136-1192`) branches on `request.practice`:
      - the existing 20/19 calibrations (:1141-1182) run only for the to-20 request;
      - to-50 rows run the three-row calibrations below plus the shared collapsed-strip calibration (:1184-1191).
  - **Docs and comments:**
    - README :18, :22 and :167, keeping the literal "within 20" (`audit-release.mjs:157`).
    - educational-basis: :50 (Availability gains Tally Detective's Range), :51 and :168-186.
    - testing-print counts, and CLAUDE.md :77 and :118-122.
    - Reword the comments that state "1 to 20", or no choice, as the whole domain:
      - `tally-detective/definition.ts:9-17` and :38-43;
      - `generator.ts:20-30` and :37-43;
      - `Renderer.tsx:8-17`;
      - `tokens.css:313-320`;
      - `tally-oracle.ts:1-17`;
      - `types.ts:96-102` and :545-550;
      - `answer-oracle.ts:139-144` and :182-183;
      - `invariants.ts:594-596`;
      - `project-request.ts:181-184`;
      - `registry.ts:762-763`, :768 and :776-777;
      - `registry.test.ts:1236-1237` and :3268;
      - `shipped-profile-options.test.ts:200`;
      - `limit-labels.test.ts:385-386`, :537-539 and :1516-1517 ("advice that recommends no control");
      - the `math-generation.test.ts:446` title ("… without recommending a control").

      Do not enumerate coverage.
  - **Version:** 1.19.0 (`npm --prefix frontend version 1.19.0 --no-git-tag-version`, HP4).
- **Done when:**
  1. **Oracle and generator** (`tally-detective/generator.test.ts`, `math-generation.test.ts`):
     - A to-50 page has four distinct totals in 21-50, each with remainder 0-4 and answer 5B+R.
     - The rewritten `tally-oracle.ts` reads every total 1-50 back from rendered segments. It clusters segments into rows by y. Every row before the last must hold exactly four bundles and no loose marks, loose marks may appear only in the last row, and it still refuses everything it refuses today.
     - `judgeTallyDocument` takes its total set from the request's practice member, and is written from this step's text.
     - `oracleTallyKeyLine` covers both forms.
     - `createWorksheetSessionForSeed` returns a validated, oracle-accepted to-50 page, and a to-20 request byte-identical to today's.
  2. **Negatives:** each of these fails:
     - a 21 on a to-20 page;
     - a 20 or a 51 on a to-50 page;
     - a duplicate total;
     - a remainder of 5;
     - a to-50 member on another family;
     - any other practice member on Tally Detective, which breaks the canonical check.
  3. **Availability, persistence and wording:**
     - `$.defaults.tallyDetective` and `.range` have parity rows, including absent.
     - A v2 file without the group parses unchanged, and the fingerprint passes without a repin.
     - `config-api.test.ts`: an explicit PUT of `range: "to-50"` reads back through GET and from the stored bytes, with profiles untouched. A v2 file without `tallyDetective` reads as `{ range: "to-20" }`, and its bytes are unchanged after the GET.
     - A to-20 selection projects today's request byte for byte, and the existing tally known vectors and seed reproductions pass unchanged.
     - Summary and advice pins:
       - `options.test.tsx`: the summary reads "Totals for Tally Detective: 1 to 20." and "Totals for Tally Detective: 21 to 50.", and the advice pin at :1243-1244 becomes one pin per range.
       - `math-generation.test.ts:464` reads the new to-20 exhausted message.
       - `limit-labels.test.ts`: the sweep adds one Tally Detective cell per range, and each range's advice arm is observed, so to-50 never falls back to the to-20 sentence. The tally guards (`limit-labels.test.ts:1523-1525`, `math-generation.test.ts:466-468`) assert `not.toMatch(/practice focus|length|More options/u)` and `toContain("Range")`.
     - `earlier-settings.test.ts`: following the Operation Grid case (:219-222), earlier settings keep a non-default `tallyDetective` group unchanged, and `result.groups` does not contain `"tallyDetective"`.
     - Packet pins:
       - a queued to-50 sheet's row detail is "21 to 50", and a to-20 row is unchanged (`packet-session.test.ts`; the title at :257 is reworded);
       - `random-packet.test.ts`: with the parent's range at "to-50", every tally sheet at every level has totals 1-20 and no practice member, and the parent's selection object is unchanged.
     - Noninterference (`registry.test.ts`):
       - `FAMILY_CHOICE_EDITS` gives Tally Detective `own: otherTallyDetective` (range changed) instead of `own: undefined` (:1238-1239), and its comment is reworded;
       - `otherTallyDetective` is composed into all seven other families' `foreign` lists, Clock Explorer's included;
       - `CONTROL_PROBES` gains a `tallyRange` entry observing the tally `practice` member, with values `[unchanged, otherTallyDetective]`;
       - every family now has an own choice, so `own` becomes required (:1147) and the unreached `own === undefined` branch (:1570-1584) is removed.
     - `registry.test.ts` (`sweepCells`, :3269) and `shipped-profile-options.test.ts` (:200-201) each add one cell per range (the `registry.test.ts` length pin at :3310 rises by 6 per added cell).
     - The golden JSON is unchanged, and generatorVersion stays 1.
  4. **Render and key** (`Renderer.test.tsx`, `answer-oracle.test.ts`):
     - Totals 21-40 draw two rows, and 41-50 draw three.
     - The one-row markup is unchanged for 1-20.
     - The keys read "21 = 5 × 4 + 1", "47 = 5 × 9 + 2" and "50 = 5 × 10".
  5. **Browser and print** (`visual-math.spec.ts`, `accessibility.spec.ts`, `print.spec.ts`):
     - The compiled app selects Range "21 to 50", then creates, keys and prints.
     - The noninterference test (`visual-math.spec.ts:405`) also proves that the tally's own stored range changes the tallies, survives switching families, and saves and reloads explicitly without touching profiles.
     - The Tally Detective accessibility test (`accessibility.spec.ts:739`) also reaches the Range group by keyboard with visible focus. It stays axe clean on the controls, page and key, and reflows at 320 px. Its title, which says it "shows only the nickname, key, paper and scale", is reworded to name the Range.
     - `tally-totals-50` prints one worksheet page and one key page on each cell. Each strip measures 72 (81) mm by rows × 20 (22.5) mm, and the ink oracle reads every stroke. The existing `tally-totals-20` geometry assertions (`print.spec.ts:95`, :101 and :205-208) still pass.
     - Calibrations on a three-row tally each fail, then restore clean:
       - hiding one first-row upright fails ("row not full");
       - zeroing a second-row crossing's stroke width fails.

       The existing 20/19 calibrations still pass on the to-20 rows.
     - ci-contract gains 4 decoration-false rows (one per cell), and the per-cell `tally-` filter (`ci-contract.test.ts:76-78`) expects 2. testing-print counts change by the same delta.
  6. **Version:** `package.json` and `package-lock.json` read 1.19.0.
  7. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout. Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 53

### Step 55: Packet levels reach the new practice
- **Status:** PENDING
- **Problem:** From Harder up, each Random packet level draws on the practice Steps 40-54 added, wherever HD6's table sets it. Challenge and Expert become harder for every family Phase H extends. Easier and Medium are unchanged, and Sentence Builder keeps Step 39's choices (HP1). Each changed level's hint names its new kinds.
- **Type:** code
- **Issue:** #66
- **Flags:** --reviewers code --isolation worktree
- **Files:** `frontend/src/web/packet/{random-packet.ts,random-packet.test.ts,RandomPacketForm.test.tsx}`; `frontend/tests/integration/new-choice-consumers.test.ts` (the Steps 46-49 packet leak cases); `frontend/tests/e2e/packet-queue.spec.ts`; `frontend/{package.json,package-lock.json}` (1.20.0); `README.md` (the :5 status paragraph); `CLAUDE.md` (Current state).
- **Produces:**
  - **Read first:**
    - Spec "Numbers to 100", "Notes for Step 55" (spec :402 on 2026-10-29): the effective-limit readers, and a wide `bonds()` candidate takes `wideRange` from its catalog focus.
    - Spec "Clocks", "Consumer sites", its "Packet code" bullets (spec :560-563), and "Pictures past 20", "Why top-level for Tally Detective" (spec :606).
    - Spec "Design defaults", Pictures 6.
    - Spec "Coordinator rulings". Re-grep every cited symbol, because Steps 39-54 move lines.
  - **Replace rule (A2):**
    - Each table cell's candidates are new `FocusChoice` builders on Step 39's defaults-first base (R1(a)).
    - The Harder column adds to Harder's Step 39 candidates. A Challenge or Expert cell replaces that family's Step 39 candidates at that level.
    - Every family keeps at least one large-print-safe candidate at every level.
    - Bounds come from the shipped constants and catalogs, never restated. The level's own choices (sizes, starts, given cells) are written once, in this table.

    | Family | Harder adds | Challenge (replaces) | Expert (replaces) |
    |---|---|---|---|
    | Dry Math | — | three-digit addition and subtraction, `dryMathRegrouping: "without"`; "Two-digit × one-digit multiplication" (`MULTI_DIGIT_PRACTICE_ENTRIES`) | three-digit addition and subtraction, `"required"`; "Three-digit ÷ one-digit division"; `remainders` |
    | Operation Grid | multiplication 10 × 10, `DEFAULT_OPERATION_GRID_PREFILLED` (10) given, `headerOrder: "mixed"` | multiplication 12 × 12 (`OPERATION_GRID_SIZE_MAXIMUM`), 14 given, mixed; multiplication 10 × 10, 0 given, mixed (large-print sibling) | multiplication 10 × 10, `rowStart` and `columnStart` 6 (headers 6-15), `DEFAULT_OPERATION_GRID_PREFILLED` (10) given, mixed; Step 39's powers 10 × 3 |
    | Number Bonds | "Addition and subtraction within 50", `"included"` | "Addition and subtraction within 100", `"included"` | "Addition and subtraction within 100", `"required"` |
    | Two Whats and a Wow | equations "Addition and subtraction within 50" | equations within 100, `regrouping: "without"`; "Dots 21 to 50 in rows of ten" | equations within 100, `regrouping: "included"` |
    | Count, Compare & Make | "Compare numbers to 100" (numerals) | the `tens-and-ones-to-50` entry | the `tens-and-ones-to-100` entry |
    | Clock Explorer | `half-hour`; `quarter-hour` | `five-minute` | `any-minute` |
    | Tally Detective | — | `{ range: "to-50" }` | `{ range: "to-50" }` |

    Placement stays `DEFAULT_OPERATION_GRID_PLACEMENT` (Diagonal first is refused with mixed headers). Clock and tally candidates spread `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)`'s group. If a table candidate is refused at large print, the level keeps one Step 39 candidate of that family as its large-print sibling, and the test names it.
  - **Scorer** (`largestNumber`, test-side). Each new kind is scored from its shipped constant:
    - Three-digit: `DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM`, for both carrying modes.
    - Two-digit × one-digit: `DRY_MATH_TWO_DIGIT_MAXIMUM × DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM`.
    - Three-digit ÷ one-digit: `DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM`.
    - Remainders: `DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM`.
    - Grids, an exhaustive switch over the operation, where lastRow = `rowStart + rows − 1` and lastColumn = `columnStart + columns − 1`: addition scores lastRow + lastColumn, multiplication lastRow × lastColumn, and powers lastRow ** columns. Harder's kept Step 39 12 × 12 addition grid therefore scores 24, not 144.
    - Number Bonds: `numberBondsWholeMaximum(group)`. Wow equations: `findTheWowEquationLimits(focus)`'s result maximum. Rows-of-ten dots: `FIND_THE_WOW_ROWS_OF_TEN_MAXIMUM`.
    - Numerals: `COUNT_COMPARE_NUMERAL_MAXIMUM`. Tens and ones: `COUNT_COMPARE_MAKE_TENS_ONES_MAXIMA[mode]`.
    - Clock Explorer and Tally Detective (A1) score `{kind:"phrase"}` by name and are never counted in `ceiling`: a non-default time step, and `to-50` named from `TALLY_DETECTIVE_WIDE_TOTAL_MAXIMUM`. The defaults (On the hour, 1 to 20) stay `not-scored`.
  - **Ceilings and hints:**
    - Ceilings are recomputed: Easier 10, Medium 20, Harder 100, Challenge 1,000, Expert 1,000. Challenge and Expert are equal because both have three-digit pages, so the hints tell them apart by kind.
    - Easier and Medium hints are unchanged. The new literal hints are confirmable at redline:
      - Harder: "Numbers to 100, plus times tables, half and quarter hours, and longer words".
      - Challenge: "Numbers to 1,000, plus two-digit × one-digit, five-minute times, tallies to 50 and independent writing".
      - Expert: "Numbers to 1,000, plus powers, three-digit carrying, remainders, any-minute times, tallies to 50 and independent writing" ("powers" stays, because Expert keeps Step 39's powers 10 × 3 grid).
    - Phrase-to-substring map: `random-packet.test.ts` holds one table, beside the scorer, from each scored phrase to the hint substring that names it: `half-hour` and `quarter-hour` → "half and quarter hours"; `five-minute` → "five-minute times"; `any-minute` → "any-minute times"; tally `to-50` → "tallies to 50". One substring may cover several phrases, as Harder's "half and quarter hours" covers two time steps.
  - **R1(c) ends here:** a level with no table cell keeps the family default through Step 39's defaults-first candidates, not by a pin. Those levels are Easier and Medium everywhere, and Harder for Dry Math and Tally Detective.
- **Done when:**
  1. **Level table** (`random-packet.test.ts`):
     - With `BASE`, every candidate makes a sheet at every length at standard print.
     - At large print, each candidate either makes a sheet or returns its family's large-print refusal and is on the test's named refusal list.
     - For every family, level, length and scale, at least one candidate succeeds, and an every-family packet leaves none out at every level and scale.
     - Each level's maximum `number` score equals its `ceiling`, and ceilings never fall. Each hint equals its literal and contains "times tables" exactly when its level has a facts candidate. Through the phrase-to-substring map, it contains each mapped substring exactly when a candidate at its level carries a phrase mapped to it. The `not-scored` results are exactly the default clock and tally candidates.
     - Except for the named exemptions, Challenge includes a candidate absent from Harder for every family, and Expert one absent from Challenge. The test names the exemptions: Sentence Builder at Challenge and Expert (HP1), and Tally Detective at Expert (one wide range).
  2. **Tests that change on purpose** (`random-packet.test.ts` cases from Steps 41, 44, 45, 50, 51, 52, 53 and 54, Step 41's being the strand pin test that Steps 42 and 43 inherit; `new-choice-consumers.test.ts` cases from Steps 46-49):
     - Each pin is rewritten to the same shape. With the parent's selection at that choice's most extreme saved value (for Step 41's test, each `DRY_MATH_STRANDS` member), each sheet at each level carries a value from that level's candidate set (the default where the level has no cell). A level can deal from several candidates (Harder keeps Step 39's and adds its cell's; Challenge Operation Grid has two grids; Expert Dry Math has three strands), so the pin checks set membership, not one value. Because an extreme saved value can itself be a cell at a higher level, the parent's lack of effect is shown by comparison, not by exclusion: with the same seed source, the dealt values are identical with the parent's selection at its default and at the extreme. The parent's selection object stays unchanged.
     - Step 39's no-leak test still passes unchanged.
  3. **Compiled app** (`packet-queue.spec.ts`):
     - An Expert packet of Clock Explorer, Number Bonds and Count, Compare & Make (Pages 6) queues rows whose details are all in the set `describeQueuedSheet` gives for those families' Expert candidates. It sends no `PUT /api/config` and leaves every browser store empty.
     - The existing Harder test's `harderBonds` and `harderDryMath` lists (:426-434) become that same seed-independent set for Harder, so a dealt "within 50" row passes.
  4. **Form** (`RandomPacketForm.test.tsx`): the Harder, Challenge and Expert hint pins equal the new literals.
  5. **Version and docs:**
     - `frontend/package.json` and `package-lock.json` read 1.20.0.
     - The README :5 status paragraph says the levels reach the harder practice and still contains "within 20" (`frontend/scripts/audit-release.mjs:157`).
     - CLAUDE.md Current state records Step 55 and its gate.
  6. **Full gate:** after merge, build-phase runs `npm --prefix frontend run check` once in the main checkout; Vitest and Playwright counts must not fall below the previous step's.
- **Depends on:** Step 54

### Step HR1: Harder practice screen review
- **Status:** PENDING
- **Problem:** This is a screen review only. It checks legibility, labels and whether the levels rise. Physical printing of the Phase H surfaces belongs to Step M1, and handwriting fit and how hard the pages feel to the children belong to Step M2.
  - **Setup:** after Step 55, build and run `npm --prefix frontend run manual:print` with the disposable fictional profiles.
  - **Cases:** for each case below, Create and preview the child page and the key on screen at Letter, standard print. Cases 7, 12, 15, 19 and 20 are also previewed at large print. Check that:
    - the numbers, blanks, grid headers, clock hands and marks, rods and cubes, dots and tallies are legible;
    - the select, the status line beside Create and a queued packet row all name the choice;
    - the key is clear and matches the page.
  - **Cases to preview:**
    1. Three-digit addition within 1,000, without carrying and with "Every problem carries or borrows".
    2. Three-digit subtraction within 1,000 with every problem borrowing.
    3. Two-digit × one-digit multiplication.
    4. Three-digit ÷ one-digit division.
    5. Division with remainders: the quotient and R blanks, and the "q R r" key.
    6. Operation Grid, multiplication 10 × 10, mixed-up headers.
    7. Operation Grid, multiplication 10 × 10, first row and column number 6.
    8. Number Bonds, addition and subtraction within 50, including carrying and borrowing.
    9. Number Bonds within 100, every problem carries or borrows: the three-digit answer box.
    10. Two Whats and a Wow, equations within 50.
    11. Two Whats and a Wow, equations within 100, including carrying and borrowing.
    12. Two Whats and a Wow, dots 21 to 50 in rows of ten.
    13. Count, Compare & Make, compare numbers to 100, with Theme art on (A3).
    14. Count, Compare & Make, tens and ones 21 to 50.
    15. Count, Compare & Make, tens and ones 21 to 100.
    16. Clock Explorer, half hours.
    17. Clock Explorer, quarter hours.
    18. Clock Explorer, five minutes.
    19. Clock Explorer, any minute.
    20. Tally Detective, 21 to 50.
  - **Random packet:** set Pages to 8 with all eight families ticked, and make one packet at each of Easier, Medium, Harder, Challenge and Expert. Reload the page between levels, because the packet holds 10 sheets and has no clear control. For each level, judge whether the dealt sheets match the hint and whether the levels rise in a useful way.
  - **Record:** keep the notes private and non-identifying, and record confusion as design feedback. Stop the harness with Ctrl+C. Finish by deciding to keep or adjust the HD6 mapping, and file any change as a new step.
- **Type:** operator
- **Issue:** none; operator review
- **Flags:** none
- **Files:** No code artifacts; optional private observation notes only.
- **Produces:** Actual private or generic non-identifying observation record, plus the keep-or-adjust decision on HD6.
- **Done when:** Every required observation is recorded, and genuine user judgment is supplied: cases 1-20 (with large print where listed) and the five packet levels. The HD6 decision is recorded. Local automated evidence does not replace this review.
- **Depends on:** Step 55

## Manual UAT

*Generated by /build-phase on 2026-10-29. Append-only; re-running the phase adds new items below, never modifies existing ones.*

### M1: Print grouped-tally practice
- **Source step:** Step 36 — review deferral
- **Issue:** #44
- **What you're looking for:**

  | Check | Expected outcome |
  |---|---|
  | verify: Full check passes. (reason: no reviewer arm could observe the post-merge gate; check: npm --prefix frontend run check — build-step DONE gate already ran it after landing: 1303 Vitest / 223 Playwright, exit 0) | `npm --prefix frontend run check` exits 0 on `main` with counts not below 1303 Vitest / 223 Playwright |

### M2: Add to packet, reorder and remove (session queue)
- **Source step:** Step 31 — review deferral
- **Issue:** #47
- **What you're looking for:**

  | Check | Expected outcome |
  |---|---|
  | verify: Full gate: after merge, npm --prefix frontend run check passes with counts not below the previous step. (reason: no reviewer arm could observe the post-merge gate; check: npm --prefix frontend run check - build-step DONE gate ran it after landing: first run 1 load-sensitive foundation.spec.ts:959 timeout at 84-94% CPU (Defender scan), rerun on a quiet machine 1324 Vitest / 227 Playwright, exit 0) | `npm --prefix frontend run check` exits 0 on `main` with counts not below 1324 Vitest / 227 Playwright |
