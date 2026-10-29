# Visual math expansion specification

State: integrated into canonical master Phase V, Steps 35-37. Preparation is authorized; implementation remains behind the existing MA2 operator gate and build invocation.

Independent adversarial findings have been incorporated. Historical reports are [adversarial review](visual-math-expansion-review.md) and [initial plan-review](visual-math-expansion-plan-review.md); their open-state descriptions are historical and superseded by this refresh.

Baseline refreshed: `main`, `8b2546a`, 2026-10-27. Operation Grid is merged as the sixth family and no parallel worktree remains. The [master plan](master_plan.md#phase-v-visual-math-first-batch) owns the only build queue, Steps 35-37. Both supplied reference files are preserved byte-for-byte outside the public checkout; their hashes are retained below. The first batch is clocks and tallies as the standing agent recommendation, now being prepared at the operator's request.

## 1. What This Feature Does

Let a parent create roomy, reproducible visual math worksheets through Extra Credit's existing worksheet choices, preview them, and print a child page plus a separate parent key. Start with a small batch and use a brief family trial to select the next activities.

First batch: **on-the-hour clocks (#13) and tally reading (#20)** (agent-selected default). They provide two different visual tasks with finite, easily verified answers. Half-hour clocks (#18) are the cheapest follow-up using the same clock renderer. This ordering reflects implementation cost and the supplied interest shortlist, not a claim about readiness.

Deferred alternative, not an unresolved first-batch choice: Tens Builders (#5) plus Growing Patterns (#4) connects more directly to number work and master F2/F4, but needs new base-ten geometry, explicit pattern rules, and a separate place-value range beyond today's quantity ceiling. A later operator change would require revising Phase V before build.

## 2. Existing Context

Observed source, rather than the seed's unverified CLI assumption:

- `frontend/package.json` defines development/build/start/test commands for one React/TypeScript/Fastify application. There is no worksheet-generation CLI. Extend the existing local app; do not create another UI or invent CLI flags.
- `src/web/App.tsx`, `generator/GeneratorControls.tsx`, `generator/create-session.ts`, and `print/PrintView.tsx` own the journey: worksheet choice, Create, preview, Worksheet/Parent answer key, Print current page. The seed/profile route remains unchanged.
- `src/shared/worksheet/types.ts` lists six shipped families. `number-bonds` already supplies missing-number addition/subtraction sentences; #1 is not a new feature. Operation Grid is shipped at this baseline. Packets (master 31/33) are still planned; mixed-family pages do not exist.
- `src/shared/worksheet/registry.ts` owns availability, finite capacity, item count, applicable controls, and generation; `src/web/worksheets/registry.ts` maps family to renderer. New families must participate in both.
- `src/shared/worksheet/seeded-random.ts` uses nonzero eight-character lowercase hexadecimal seeds and xorshift32. `createWorksheetSessionForSeed` projects selections through `projectGenerationRequest`; Make another tries at most 16 seeds and compares canonical content. Keep this behavior and version new generators independently.
- `src/shared/worksheet/answer-oracle.ts` recomputes objective answers; `AnswerKeyView.tsx` consumes the same immutable document as the child renderer. Current answer kinds are number, choice, comparison, and grid (Operation Grid). New clock answers can use a numeric hour, formatted with `:00` in their own key branch; no generic answer-union expansion is necessary for batch A.
- `InstructionalVisual.tsx` supplies bounded groups and five-by-two ten-frames; `InstructionalWritingGuide` supplies drawing space. Its quantity cap is 20. These are useful for later dot tasks, but neither component is a clock, tally group, base-ten rod, or arbitrary grid.
- `schema.ts`, `defaults.ts`, `earlier-settings.ts`, and the worksheet-session reducer handle selection/defaults separately from child identity. There is no age or mastery gate to add. `CONTRIBUTING.md`, “Persisted shape,” requires additive enum/defaulted-key evolution with transport parity, never changing old bounds or repinning the schema fingerprint.

All `src/` paths above are relative to `frontend/`. Parent relationship: this expands master F5; backlog #4 overlaps F2 and #5 overlaps F4. Preserve those relationships rather than create duplicate commitments. Keep Step 34, MA2, packets, and outstanding physical/family/CI acceptance intact. The proposed track is selected separately under the master's one-track-at-a-time rule.

### Reference inspection and printable evidence

All four pages of the supplied `extra-credit-math-reference.pdf` (now preserved outside the checkout) were rendered and visually inspected; each is US Letter, 612 × 792 PDF points. They are concept cards, not ready-to-print child worksheets. The reference contains 8–22 pt text (including small instructions/key), colored fills, sparse clock labels, and question marks rather than defined handwriting areas. Preserve the pictures' clarity, not their typography or answer-key placement.

An existing generated `count-all-four-subtypes-a4-large-decoration-false-worksheet.pdf` under ignored historical Step 10 print evidence was also rendered and inspected: one approximately 595 × 842 pt A4 page, eight dense cards, monochrome shapes/frames, and intact response areas. This is historical layout evidence, not a fresh current-build pass or physical print acceptance. The current `tokens.css` uses 16/18 pt instructional text, 7/9 mm response lines, 5/6 mm cells; `print-letter.css` uses 0.4 inch margins and `print-a4.css` 10 mm margins. Reuse those conventions, but start the new activities at four cards per page. No printer was exercised during planning.

Reference observations: 3/4 pizza shading is correct; the grid reflection has room for matching cells; the quantity groups show 1,3,5; triangles are four small plus one large; squares are four unit plus one large; the single missing Sudoku circle is forced by both row and column; pet counts are 5,3,2; clocks show 3:00 and 3:30 with the latter hour hand between 3 and 4; scaled graph counts 3 and 2 symbols at two rockets each; tallies show five plus three; rotations go up/right/down; bag contains four circles and one triangle. Base-ten rods should be redrawn with the same unit-cell size as the loose ones (the reference uses flatter rod subdivisions).


### Build environment and inline interfaces

Use Node24 (`>=24.0 <25`) and npm11 (`>=11 <12`); one `frontend` package. React renders the existing parent UI, TypeScript shares validated generation contracts, Fastify serves the loopback API, Zod validates config, Vitest checks domain behavior and Playwright Chromium checks the compiled UI/PDF. Reuse this stack to preserve the production path and avoid another runtime.

Fresh disposable setup from the repository root: `npm --prefix frontend install`; `npm exec --prefix frontend -- playwright install chromium`; `npm --prefix frontend run build`; `npm --prefix frontend run manual:print`. The harness provides fictional profiles and its own ephemeral URL. For separately chosen development with no retained data, `npm --prefix frontend run dev` serves UI at127.0.0.1:4311 and API4310; stop with Ctrl+C. Before normal build/start, check those ports are free and `config/children.local.json` absent by metadata only, per master section 6. No account, secret, database or new environment variable is needed.

| Interface / identifier | Shape and ownership |
|---|---|
| `GenerationRequestV1` | schemaVersion1, worksheetType slug, generatorVersion positive integer, seed, capabilities, options; optional displayName, topicIds, practice. New families omit topicIds/practice and use canonical options in section 6. |
| `WorksheetDocumentV1` | schemaVersion1, worksheetType, generatorVersion, seed, worksheetId, request, items. Immutable snapshot; answers are on objective items. |
| `ClockExplorerItemV1` (proposed) | id, itemType `clock-explorer`, answerability `objective`, hour1..12, answer `{kind:"number",value:hour}`. |
| `TallyDetectiveItemV1` (proposed) | id, itemType `tally-detective`, answerability `objective`, bundles0..4, remainder0..4, answer `{kind:"number",value:5*bundles+remainder}`; total1..20. |
| `AppConfigV2` / `ConfigResponseV2` | config: schemaVersion2, identity profiles, global defaults; response wraps config with storedSchemaVersion1 or2. New family enum members only. |
| `ChildProfileV2` | id (lowercase UUIDv4), optional displayName, reviewedOn ISO date, interests[], optional preserved legacyChoices. No new identity fields or performance tracking. |
| IDs | worksheetId: browser `crypto.randomUUID()` in create-session; profile id: UUIDv4 created by ProfileEditor; item id: `item-001` onward in page order; seed: nonzero lowercase eight-hex string. Topic/family IDs are fixed slugs from shared types. |
| API seam | GET /api/config returns ConfigResponseV2 plus ETag; PUT /api/config accepts AppConfigV2 under existing session/precondition guards and returns ConfigResponseV2 plus ETag. Existing session/health/recovery routes unchanged; no new endpoint. |

Runtime actions remain parent-triggered. Code steps use isolated worktrees, code review, compiled UI/print evidence and the full check gate. No operator judgment is counted as an automated pass. The master records statuses/issues and the next operator handoff. The private seed/PDF are optional visual provenance, not required build inputs; this specification fully summarizes their relevant content.

## 3. Scope

Batch A proposal: two independently selectable worksheet families, Clock Explorer and Tally Detective, fixed four problems per page, all-hour clock faces and tally quantities 1–20, child preview and separate parent key, existing paper/scale/name controls, Make another, and explicit saving of the family selection. No new dependencies.

Out: half-hours until the first trial, other backlog activities, mixed-family pages, packet implementation, duplicate mystery equations, measurement #6, unselected activities, accounts, tracking, new services, runtime AI, new CLI, schema-version bump, changes to old generators' outputs, and a universal puzzle abstraction. No educational assessment claims.

### Selected inventory and proposed batches

The PDF's parent key is on page 4 for every row. Batches after A remain a backlog, not executable scope; trial results may reorder them.

| Original ID | Activity | Reference page | Batch | Mathematical contract / acceptance example |
|---|---|---:|---|---|
| 13 | Clock explorer | 4 | A | Hours 1–12; minute hand at 12, distinct shorter hour hand; 3:00 shown and keyed correctly. |
| 20 | Tally detective | 3 | A | Four upright strokes plus crossing fifth; 5+3=8. Bound 1–20, including exact bundles. |
| 18 | Half-past adventure | 4 | B, after trial | Minute hand at 6; hour hand moves halfway to next hour, including 12:30 wrap. |
| 5 | Tens builders | 1 | B candidate; master F4 | Two rods of ten identical units plus three loose units =23. Own bounded place-value contract; do not widen old quantity tasks. |
| 4 | Growing patterns | 1 | B candidate; master F2 | State “add two each time”; 1,3,5 leads to 7, then 9. All drawn groups remain within the chosen visual range. |
| 12 | Pet picture graph | 3 | C | Explicit one-symbol/one-vote key; cats5/dogs3/fish2 => difference2, total10. Ask one clear question per card. |
| 19 | Space picture graph | 3 | C, after #12 trial | Explicit two-rockets-per-symbol legend; Mars3 symbols =>6, Moon2=>4. No partial symbols initially. |
| 2 | Fraction feast | 1 | C | Equal-area partitions; 3 of4 shaded =>3/4 shaded,1/4 unshaded. Accept equivalent fractions in parent guidance; no unequal decorative slices. |
| 22 | Secret bag | 3 | C | Four circles,one triangle => circle more likely, not certain. State random draw of equally selectable objects; handle ties explicitly if later allowed. |
| 3 | Mirror artist | 1 | D | Mirror lies on grid boundary; corresponding cell centers have equal perpendicular distance. Key shows completed reflection. |
| 21 | Turn the pattern | 2 | D | Explicit clockwise quarter-turn rule; up,right,down =>left,up. Avoid rotation-symmetric symbols. |
| 15 | Square search | 2 | D | 2×2 grid =>4 unit +1 large=5; key outlines/counts each size. Larger grids need independent enumeration. |
| 8 | Triangle treasure hunt | 2 | D | Reference topology =>4 small+1 large=5; use reviewed templates and enumerate closed straight-edge triples, never reuse “5” blindly. |
| 16 | Shape sudoku | 2 | D | 3×3 Latin square, row/column rules only, no implied sub-box rule. One blank is circle; multi-blank generation requires exactly one solution. |

Useful later sharing is narrow: one clock face for #13/#18; one pictograph layout with explicit unit value for #12/#19; grid geometry for reflection/shape tasks where appropriate; equal partitions for fractions; dot groups for patterns. Counting-shape solvers and Sudoku constraints remain separate domain logic.

## 4. Impact Analysis

| File or interface | Change | Reason | Verified evidence |
|---|---|---|---|
| `shared/worksheet/types.ts` | Add two family IDs and typed objective items; retain numeric answer kind | Discriminated generation and rendering | Current six IDs, numeric/choice/comparison/grid answers |
| `shared/worksheet/{registry,project-request,invariants,answer-oracle}.ts` | Register, project, validate and recompute new families | Real caller must reject malformed inputs and duplicate problems | Existing Number Bonds branch and capacity contract |
| `shared/config/{schema,defaults,earlier-settings}.ts`, `server/transport-schemas.ts` | Carry new family enum through selection/save/read; no new settings group in A | Existing family selection is sufficient for fixed four-item families | Strict v2 schema and transport composition |
| `web/generator/{GeneratorControls,worksheet-session,create-session}` | Family choices and applicability; preserve Make another | Hide inapplicable length/practice/decoration controls | Registration-driven controls and seeded-session caller |
| `web/worksheets/registry.ts`, new family renderers | Preview and print actual instructional graphics | Shared document is the source of truth | Existing renderer map |
| `web/print/AnswerKeyView.tsx` | Clock time formatting and tally decomposition | Keys need useful source context | Existing Number Bonds-specific branch |
| `web/styles/tokens.css` | Bounded four-card layout and graphic/answer geometry | Legibility at both paper sizes/scales | Current physical print tokens |
| `tests/fixtures/print/{matrix,required-content}.ts`, E2E print/controls/accessibility/release smoke | Add representative new output through app caller | Count correctness alone cannot detect clipping or hidden diagrams | Existing compiled browser harness and print matrix |
| `tests/e2e/print.spec.ts`, `tests/integration/ci-contract.test.ts` | Extend SVG ink/geometry evidence and update exact matrix/discovery counts by the added fixture delta | Existing visibility checks cover boxes and CSS borders, not individual SVG strokes | `print.spec.ts` required-content checker and matrix accounting; CI discovery pins |
| `tests/integration/practice-golden.test.ts` | Add both new IDs to `coveringGroup` with `undefined` | Neither family has an earlier-settings group; exhaustive family map otherwise fails compilation | Existing Number Bonds base-only branch; preserve frozen grid and digest |
| `scripts/{release-tree,audit-release}.mjs` | No code change planned; resolve reference input placement before full-check execution | Export includes untracked PDFs and audit rejects them | Focused release-audit test reproduced `PERSONALIZED_ARTIFACT` on supplied reference |
| `README.md`, `docs/{educational-basis,testing-print}.md`, `CLAUDE.md` | Describe shipped families after implementation | Avoid stale capability claims | Current shipped-family descriptions |

Paths in this table are under `frontend/` unless explicitly root docs. Shared-consumer search: `rg -l 'WorksheetType|WorksheetItemV1|ObjectiveAnswerV1|WORKSHEET_TYPE_IDS|WorksheetSelectionV2' frontend/src frontend/tests`, all source/tests, no exclusions within these roots. The complete matching-path inventory is in the appendix. Also searched worksheet generator/renderer roots for clock/tally/fraction/mirror/Sudoku/graph/pattern implementations; matches were unrelated test terminology. No bound derived from `WORKSHEET_TYPE_IDS.length` was found in source/tests. These searches do not prove facts about external consumers or later source revisions.

## 5. New Components

Proposed paths, not existing APIs:

- `frontend/src/worksheets/clock-explorer/{definition.ts,generator.ts,generator.test.ts}` and corresponding `web/worksheets/clock-explorer/{Renderer.tsx,Renderer.test.tsx}`.
- Equivalent `tally-detective` directories and tests.
- A family-local `ClockFace.tsx` and `TallyMarks.tsx` if separating drawing makes the renderer easier to read. Use inline vector geometry, no external resource URLs or generated artwork. Do not extract shared primitives until a second caller exists.
- `frontend/tests/e2e/visual-math.spec.ts` for the new production journeys; extend existing print fixtures rather than create another capture framework.

## 6. Design Decisions

| Choice | Decision | Provenance | Rationale | Alternatives / unresolved state |
|---|---|---|---|---|
| Entry point | Existing local app and browser printing | Inference from verified source; seed permits reuse | This is the actual worksheet workflow | No new CLI or UI |
| First batch | Recommend #13 and #20 | Agent default | Small, different, finite visual tasks | Stands for the requested preparation run |
| Remaining shortlist | Backlog with original IDs | Operator seed | Preserve interests without shipping all fourteen | Order is revisable after trial |
| Page load | Four cards, hide length control for new families | Agent default | Room for large pictures and answers; avoids larger-budget coupling | Revisit after actual print/trial |
| Clock representation | Numeric hour, minutes fixed zero in batch A | Agent default | Reuse numeric answer contract | #18 later needs explicit minute semantics |
| Clock dial | Labels 1–12, black outline, distinguish hands by length/weight | Agent default | Does not rely on color or reading a paragraph | Reference labels only selected hours |
| Tally range | 1–20, fixed in batch A | Agent default | Existing visual envelope; includes multiple bundles | Later choice can narrow range if trial warrants |
| Decoration | Inapplicable to these families; instructional diagrams always present | Agent default, existing separation | Preserve space and mathematical content | Cheap themes deferred |
| Persistence | Add family enum members only, retain v2 | Agent default under contributor policy | No new knobs necessary in A | Any later setting requires default + optional transport key |
| Review | Existing code-review lane plus compiled browser/print checks | Master §6 | No fabricated runtime-review URL | Physical/family judgment stays separate |

### Exact proposed behavior

Clock candidate set: hours 1..12, four distinct hours sampled using the existing seeded RNG. Item carries `itemType: "clock-explorer"`, `hour`, and numeric `answer.value=hour`. The diagram is derived solely from hour: minute angle zero, hour angle `30*(hour % 12)` degrees clockwise from twelve. For future half-hours use `30*(hour % 12)+0.5*minutes` and minute angle `6*minutes`; no half-hour mode ships in A. Label response “Time: ____ :00”; parent key says “3:00 — long hand at 12, short hand at 3.” At 12:00 the hands overlap but the longer minute hand remains visible beyond the hour hand.

Tally candidates: integers 1..20, four distinct totals. Item stores bundle count `floor(total/5)` and remainder `total%5`; source geometry is four upright strokes crossed by the fifth, followed by 0..4 loose upright strokes. Independently recompute answer as `5*bundles+remainder`; validate ranges and reject a corrupted answer or malformed grouping. Prompt: “How many tally marks?” Key: “8 = 5 + 3,” with source marks or equivalent unambiguous item context. Never draw five parallel strokes for a completed bundle.

Both families: version1, fixed four-item budget at both scales, stable item identities, no repeated problem per page, names only through existing projection, no interests in mathematical generation, no decorative topic in request. Make another uses existing content comparison/exhaustion behavior. No selected child capability gates. Existing stored `length` and inactive options survive switching families; they do not alter generated work for these families.

**Canonical request contract:** extend `projectedLength` so both new families project `options.length: "standard"`, independent of stored Short/Standard/Long. Set `includeDecorativeGraphics: false`; omit `topicIds`, `decorativeTopicId`, and `practice`. Return `INACTIVE_WRITING_CAPABILITIES` and a fresh copy of `INACTIVE_MATH_FIELDS` (including copied arrays); these legacy capability fields are inactive, not limits on the family's fixed domain. Preserve the stored selection verbatim so switching back restores earlier choices. Only nickname opt-in, paper, scale, and answer-key inclusion remain applicable. Extend the request noninterference tests to vary every unrelated family choice, stored length, theme, graphics, interests, and legacy profile settings: at the same seed/version and applicable options the complete projected request must be deep-equal, and generated educational content must match. Hiding a control without normalization does not satisfy this contract.

Registration must report four problems and sufficient capacity for all valid selections, `NO_MAXIMUMS` (no user-selectable range), and only the applicable controls above. Supply truthful exhaustion advice such as “This activity uses a fixed set of hours; try Create worksheet again” (or tally quantities); do not suggest widening a hidden range or length control. Validate exactly four correctly typed, sequentially identified items, uniqueness by hour or tally total, recomputed numeric answers, and the canonical request's absence of unrelated practice/interest/decoration data. A deliberately mixed-family item or noncanonical request must fail. Keep these checks family-specific; do not refactor all shipped generators.

Compatibility: files using only old families parse unchanged; reading never writes; explicit save may persist a new family ID. Older builds must block unknown IDs without modifying bytes, consistent with current classifier. Backout is old code plus an operator-owned pre-save config backup if needed; do not rewrite a new-family file with an old binary or reset profiles. No document migration is needed because generated documents are session-only. If packets land first, verify their existing renderer dispatch accepts these immutable documents; do not rebuild packets.

## 7. Canonical build steps

The [master Phase V](master_plan.md#phase-v-visual-math-first-batch) defines Step35 (clocks), Step36 (tallies), and Step37 (operator trial). Only that master carries execution fields, statuses and issues. Step35 follows completed34 and the existing MA2 operator screen review; Step36 follows35; Step37 follows36. No code dispatch until MA2 has an actual recorded observation. Optional27 and packet31/33 are not part of this batch.

For disposable fictional preview after implementation, run `npm --prefix frontend run build` then `npm --prefix frontend run manual:print`, open its exact ephemeral URL, and stop with Ctrl+C. Choose Clock Explorer or Tally Detective, Create worksheet, Parent answer key, Print current page. Those new labels are not available before the feature ships. Use the existing operator-controlled setup for the actual family trial; never read or reseed retained private data.

## 8. Risks and Open Questions

| Item | Consequence | Mitigation / owner | Blocking state |
|---|---|---|---|
| Source refresh | Later changes may alter shared interfaces | Builder checks HEAD against8b2546a and preserves merged Operation Grid consumers | Current refresh complete; recheck before build |
| Print appearance | PDF geometry cannot prove physical grayscale output or child comfort | Existing automated print seam plus Step37 | Blocks acceptance, not initial coding once agreed |
| Larger later activities | Four cards may not fit drawing/pictograph/shape tasks | Budget each later family independently; do not impose four everywhere | Deferred design |
| Reference PDF placement | Public export rejects reference PDFs | Original seed and PDF are now outside checkout; original SHA-256 values verified, focused audit test passes | Resolved 2026-10-27; no audit exception |

No background/scheduled behavior, external service, auth change, dependency installation, or deployment seam is introduced. Thus no long-duration autonomous observation is warranted. The generator → immutable document → renderer/key chain does require a short real compiled-app smoke in each code slice before the family trial.

## 9. Testing Strategy

Keep tests proportional: exhaustive tiny candidate domains (12 hours,20 tally totals), a few deterministic seed vectors and generated multi-seed documents, malformed-input tests, and production-caller integration. Read rendered geometry/strokes independently of answer fields; a generator and key agreeing on the same wrong value is insufficient. Preserve existing golden educational outputs; do not regenerate baselines merely to accommodate a regression.

Extend existing print matrix/required-content checks with new-family rows exercising Letter/A4, standard/large, child/key. Require one page per surface, intact cards, visible dial labels/strokes, no clipping/overlap, adequate blank writing areas, and no reliance on color/background printing. Start clock diameter around40mm standard and45mm large as adjustable design targets, retaining16/18pt instructions and7/9mm response-line minima. Verify actual geometry before claiming layout acceptance; reduce content rather than shrink instructional text. A focused negative case hiding/collapsing the new instructional graphic should fail its print check. Reuse existing harness and calibration patterns.

**SVG ink evidence:** the existing required-content checker verifies CSS visibility, boxes, text, and CSS border edges; it does not prove an SVG line is drawn. Add a narrow family-specific check in the current print test for every required hand, dial outline, tally upright, and tally crossing: nonzero geometric length, expected position/orientation, computed stroke neither none nor transparent, positive stroke width and effective opacity, visibility through ancestors, and containment in the printable graphic. Clock numbers must be legible without hand/label collisions; tallies must preserve gaps between bundles. Check actual SVG endpoints/transforms against the independent domain expectation, not a `data-answer` attribute. Under print media, deliberately set one hand or crossing to `stroke:none`, then zero width; both must fail even when the SVG retains its size and labels. Restore and require clean results. This extends the existing oracle and evidence capture rather than adding a new screenshot baseline system.

**Fixture and tooling integration:** add one boundary fixture per family (including 12:00/overlapping hands for clocks and20/four bundles for tallies) expanded over both papers/scales with decoration inapplicable. Each fixture adds four worksheet cases and four key surfaces. At the refreshed baseline, `print.spec.ts` pins91 worksheet cases/23 keys and `ci-contract.test.ts` discovers109 tests plus per-cell counts. Update these by the actual new fixture delta against refreshed source, not by freezing those old absolute counts into this proposal. Do not change mandatory old-row assertions or skip checks. The matrix already guards the Length locator before interacting, so no unconditional Length-helper repair is needed. `chooseWorksheetChoices` needs explicit new-family no-extra-choice cases. `requiredPrintContent` needs titles, prompts, answer blanks, and family-specific formatted key text. Add new IDs as `undefined` in `practice-golden.test.ts`'s exhaustive `coveringGroup`; preserve the golden JSON and its hash. Keep the existing schema parity/fingerprint probes, which already enumerate worksheet IDs, and add meaningful save/read and blocked-unknown-family coverage without another capture framework.

Commands verified in `frontend/package.json` (repository-root PowerShell):

```powershell
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:e2e
npm --prefix frontend run check
```

`test:e2e` builds and invokes `tests/e2e/server-harness.mjs`; do not invoke Playwright directly without its injected ephemeral base URL. Iterate on relevant Vitest files using `npm --prefix frontend test -- <file-path>` once new files exist. Full `check` is the master-required step gate, not a planning claim. During adversarial review, `npm --prefix frontend test -- tests/integration/release-audit.test.ts -t 'rejects pdf after the real test source passes'` failed at the initial clean-export assertion with `PERSONALIZED_ARTIFACT: docs/examples/extra-credit-math-reference.pdf` (one failed,67 filtered out). The negative injection was never reached in that historical run. On 2026-10-27, after external preservation of the inputs, the same selected test passed (1 passed,67 filtered out), including its rejection of an injected PDF. No full suite, build, server launch, or physical printing was run in this prep task; new-family runtime checks remain future implementation work.

### Handoff

Run prep gates against `docs/plans/master_plan.md`, Phase V: plan-review, plan-redline, plan-wrap, then repo-sync limited to Phase V steps. After MA2 observation is recorded, build only `--steps 35,36`; hand Step37 to the operator afterward. Never run all pending master steps as this expansion. The original proposal path is now this technical specification, not an independent parser input.

## Appendix: shared-consumer search inventory

Refreshed at8b2546a; every match is an existing source/test consumer, not necessarily an edit target.

- `frontend/src/server/transport-schemas.ts`
- `frontend/src/shared/config/defaults.ts`
- `frontend/src/shared/config/earlier-settings.test.ts`
- `frontend/src/shared/config/earlier-settings.ts`
- `frontend/src/shared/config/schema.ts`
- `frontend/src/shared/worksheet/answer-oracle.ts`
- `frontend/src/shared/worksheet/invariants.ts`
- `frontend/src/shared/worksheet/limit-labels.test.ts`
- `frontend/src/shared/worksheet/project-request.test.ts`
- `frontend/src/shared/worksheet/project-request.ts`
- `frontend/src/shared/worksheet/registry.ts`
- `frontend/src/shared/worksheet/types.ts`
- `frontend/src/web/assets/line-art/manifest.test.ts`
- `frontend/src/web/generator/GeneratorControls.tsx`
- `frontend/src/web/generator/create-session.ts`
- `frontend/src/web/generator/math-generation.test.ts`
- `frontend/src/web/generator/options.test.tsx`
- `frontend/src/web/generator/worksheet-session.test.ts`
- `frontend/src/web/generator/worksheet-session.ts`
- `frontend/src/web/print/AnswerKeyView.tsx`
- `frontend/src/web/worksheets/number-bonds/Renderer.test.tsx`
- `frontend/src/web/worksheets/registry.test.ts`
- `frontend/src/web/worksheets/registry.ts`
- `frontend/src/worksheets/count-compare-make/definition.ts`
- `frontend/src/worksheets/count-compare-make/generator.test.ts`
- `frontend/src/worksheets/count-compare-make/generator.ts`
- `frontend/src/worksheets/dry-math/generator.test.ts`
- `frontend/src/worksheets/find-the-wow/generator.test.ts`
- `frontend/src/worksheets/number-bonds/generator.test.ts`
- `frontend/src/worksheets/operation-grid/generator.test.ts`
- `frontend/src/worksheets/sentence-builder/generator.test.ts`
- `frontend/tests/e2e/fixtures/worksheet-controls.ts`
- `frontend/tests/e2e/graphics.spec.ts`
- `frontend/tests/e2e/options.spec.ts`
- `frontend/tests/e2e/worksheet-choices.spec.ts`
- `frontend/tests/fixtures/print/matrix.ts`
- `frontend/tests/integration/arithmetic-oracle.test.ts`
- `frontend/tests/integration/practice-golden.test.ts`
- `frontend/tests/integration/schema-parity.test.ts`
- `frontend/tests/integration/shipped-profile-options.test.ts`

Read-only input SHA-256:

- `extra-credit-astra-prompt.txt`: `2c3bc93246c94cdb4e395f5b57f610c0aa2737e106ef58d93041f41fa6aedca9`
- `extra-credit-math-reference.pdf`: `913dd599f8a9f9b36d4ffc2fe2a1a188a3fcb7770b31dc51c192f53d3fb41e10`
