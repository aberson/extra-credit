# Harder practice specification

Technical contract for master plan Phase H, Steps 40-54, plus the notes Steps 39 and 55 read, § Coordinator rulings and § Design defaults ([master plan](master_plan.md)). The master alone owns step IDs, statuses, dependencies and issues; this document is reference material, not another execution queue. Every cited `file:line` was read on the `random-packet` working tree (app version 1.4.0) on 2026-10-29; earlier Phase H steps may move lines, so a developer re-greps a cited symbol before editing.

Abbreviations used in Phase H: CCM is Count, Compare & Make (`count-compare-make`); Wow is Math — Two Whats and a Wow (`find-the-wow`); "the spec" is `docs/plans/harder-practice-spec.md`; HP/HD rows and R1(a)-R4 are Decision Inventory IDs; DW n is a step's Done-when item n.

Binding rules for every section (master plan Phase H and Decision Inventory HP1-HP5, HD1-HD7, R1(a)-R4): new choices are additive schemaVersion 2 keys with Zod defaults (listed in their transport `optional` lists) or new enum members that no array bound derives from; no persisted bound is widened and there is no schemaVersion 3; `V1_NUMERIC_MAXIMUM` and `DRY_MATH_NUMERIC_MAXIMUM` keep their values; today's choices produce byte-identical documents (no `generatorVersion` bump, goldens and known vectors unchanged); outside Steps 39 and 55, `frontend/src/web/packet/` changes only under § Coordinator rulings R1(a) (keep compiling), R1(b) (name a new choice in a queued sheet's label) and R1(c) (keep a new choice out of Random packets until Step 55).

## Coordinator rulings

These rulings are binding for Steps 39-55. They are mirrored in the master Decision Inventory, and steps cite them by ID.

- **R1(a), keep compiling:** when a persisted group gains a key, packet code and typed literals spread the exported default group (`...DEFAULT_WORKSHEET_DEFAULTS_V2.<group>` or `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)`), never the parent's `selection.<group>`.
- **R1(b), name it in the packet:** a new choice is named in a queued sheet's label through `packet-session.ts` `detailOf`, with a wording test in `packet-session.test.ts`.
- **R1(c), keep it out of Random packets:** until Step 55 maps the levels, every Random packet sheet carries the default for the parent's new Clock Explorer or Tally Detective choice, and for any new choice a level's `FocusChoice` does not reset. Step 39's defaults-first candidates guarantee this (every candidate, `seedOnly` for Clock Explorer and Tally Detective included, starts from `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)` and copies only the kept choices), so Steps 40-54 edit no `RANDOM_PACKET_FOCUS` row, and each step's leak test asserts it.
- **R2, one wording owner:** each entry list has one wording owner, which the status line beside Create, the select option and the packet label all read.
- **R3, no value above its bound:** no persisted or fixture value exceeds its persisted bound. A wider choice stores today's bounded field plus a new additive key or enum member, and the effective-limit readers compute the real maximum.
- **R4, split oversized steps:** a step too large for one developer context is split into separately reviewed steps before build, as Step 47 was split into Steps 47 and 48.

## Arithmetic: Dry Math (Steps 40-43)

**Strand dispatch (Step 40).** Today `dryMathStrand` and the Dry Math `practice.kind` are tested as a binary: `=== "multiply-divide"` or `=== "dry-math-facts"`, or else the value is treated as add-subtract. Step 40 turns each site below into an exhaustive `switch` with a `never` default:
- `project-request.ts:141` (capabilities) and `:279-288` (practice).
- `definition.ts:90-119` (`getDryMathCapabilitySupport`; the docblock at `:85-89`).
- `generator.ts:40-43` (`factsPractice`), `:51-56` (`regroupingRequired`), `:65-75` (`enumerateDryMathCandidates`) and `:173-204` (`dryMathShortfallFor`).
- `invariants.ts:613-631`, the Dry Math item loop (`dryMathBranch.kind === "facts"` at :617). `dryMathBranchOf` (`:122-143`) is already a switch.
- `registry.ts:333-335` (`dryMathFactsChosen`), `:341-349` (status), `:415-423` (advice and relevant maximums) and `:437-438` (`regrouping` / `factFamilies`).
- `GeneratorControls.tsx:252-258` (`focusOptionIdFor`), `:276-282` (`groupsShownFor`), `:596-616` (`chooseDryMathPractice`) and `:911-917` (select entries).
- `worksheet-session.ts:109-119` (the `DryMathPracticeChosen` union) and `:310-331` (the reducer and the touched keys per strand).
- `tests/e2e/fixtures/worksheet-controls.ts:292-299`, `tests/fixtures/print/matrix.ts:316-326` and `:330-349`, `tests/oracles/arithmetic-oracle.ts:294-316`, and `limit-labels.test.ts:1430-1437` and `:1477-1478`.
- Packet sites, outside Step 40's grep: `random-packet.test.ts:61` (`largestNumber`) is converted by Step 39 to a `dryMathStrand` switch with a `never` default, and Steps 41-43 each add their case (R1(a)). `packet-session.ts:199-204` (`detailOf`) is converted in Step 41 under R1(b), and Steps 42 and 43 each add their case with a wording test.
- Checked and unchanged: `tests/e2e/release-smoke.spec.ts:673` and `src/web/profiles/ProfileEditor.test.tsx:1968` set or assert the existing `multiply-divide` member and do not dispatch on it. `EarlierSettingsSummary.tsx:52-57` reads the `dryMath` earlier-settings group only.

**Random packet (rulings R1-R3, Decision Inventory).** Cited lines are from the Step 38 tree; Step 39 rewrites the builders, so re-grep after it.
- `random-packet.ts:66-82` (`dryMath()` and `multiplicationFacts()`) set `dryMathStrand` explicitly on every Dry Math candidate. A parent's saved three-digit, multi-digit or remainders strand therefore never reaches an Easier, Medium or Harder sheet, so R1(c) needs no new pin for Dry Math. Step 41 proves it with one `random-packet.test.ts` test that saves each `DRY_MATH_STRANDS` member as the parent's strand and checks every Dry Math sheet at every level; Steps 42 and 43 inherit it unedited.
- R1(a): the new groups ride the selection or default-group spread, so the builders need no edit. Only `largestNumber` gains a case per strand, scored from the shipped constants: three-digit `DRY_MATH_THREE_DIGIT_RESULT_MAXIMUM`; multi-digit `DRY_MATH_THREE_DIGIT_OPERAND_MAXIMUM` with division, else `DRY_MATH_TWO_DIGIT_MAXIMUM × DRY_MATH_ONE_DIGIT_FACTOR_MAXIMUM`; remainders `DRY_MATH_REMAINDER_DIVIDEND_MAXIMUM`.
- Level tables change only in Step 55.

**Persisted shape** (CONTRIBUTING.md § Persisted shape, :79-148). Every new item is additive at schemaVersion 2:
- `DRY_MATH_STRANDS` (`enums.ts:41`) is appended in order: `three-digit` (Step 41), `multi-digit` (Step 42), `remainders` (Step 43). No array bound derives from it; it is used only as an `enum` (`schema.ts:227`, `transport-schemas.ts:279`).
- `dryMathThreeDigit` defaults to `{operations:["addition","subtraction"]}`. Its `operations` follow the same `MATH_OPERATIONS` canonical-subset rule as `NumberBondsV2Schema` (`schema.ts:151`).
- `dryMathMultiDigit` defaults to `{operations:["multiplication"]}`. Its `operations` follow the `FACT_OPERATIONS` canonical-subset rule of `DryMathFactsV2Schema` (`schema.ts:125`).
- Each group gets:
  - a whole-group `.default(() => ...)` in `worksheetSelectionShape` (`schema.ts:219-250`);
  - its refinement registered in `PERSISTED_REFINEMENTS` (`schema.ts:80-93`) as `worksheet.dry-math-three-digit.operations.canonical-order` / `worksheet.dry-math-multi-digit.operations.canonical-order` (CONTRIBUTING.md "Its limits", :133-140), with one violation probe each in `config-shape-fingerprint.test.ts:371-408`, which `:409` requires to equal the registered list. A new name is additive, so the pinned snapshot is not repinned;
  - a transport mirror composed next to `dryMathFactsSchema` (`transport-schemas.ts:219`, `:275-283`), and a name in the `optional` list (`:377-381`);
  - a default in `defaults.ts:56-60` and a copy at `:150-155`;
  - a pass-through in `earlier-settings.ts:198-210`, which names every field;
  - an entry in `WORKSHEET_GROUP_KEYS` (`worksheet-session.ts:38-60`);
  - parity rows in `schema-parity.test.ts`.
- Round trip through the real API (both validation layers): `config-api.test.ts` gains one `describe.each` over the new Dry Math defaults, modeled on the Clock Explorer / Tally Detective block at `:617-670`, with one row per step (41 three-digit with `dryMathThreeDigit` and `required`, 42 multi-digit with `["division"]`, 43 remainders). Each row checks that a fictional v2 file written without the new key or member is read back with its default and its bytes are unchanged, and that a PUT of the non-default value reads back equal with only those keys changed and the profiles untouched.
- `FACT_OPERATIONS`, `MATH_OPERATIONS`, `REGROUPING_MODES`, `V1_NUMERIC_MAXIMUM` and `DRY_MATH_NUMERIC_MAXIMUM` never change.
- R3: every entry stores operations only. `dryMath` keeps its bounded values whichever strand is chosen, and no fixture writes a value above a persisted bound.
- An older build that meets `dryMathThreeDigit`, `dryMathMultiDigit` or a new strand member reports `blocked`, by the existing unknown-key and unknown-enum rules.

**Constants.** All live in `types.ts` after `:60`, import their neighbours, and none is a bare `20` (`envelope-single-source.test.ts` must stay green):
- Three-digit: `DRY_MATH_THREE_DIGIT_OPERAND_MINIMUM = 100`, `..._OPERAND_MAXIMUM = 999` and `..._RESULT_MAXIMUM = 1000`.
- Two-digit and one-digit: `DRY_MATH_TWO_DIGIT_MINIMUM = 10`, `..._MAXIMUM = 99`, `DRY_MATH_ONE_DIGIT_FACTOR_MINIMUM = 2` and `..._MAXIMUM = 9`.
- Remainders: `DRY_MATH_REMAINDER_DIVIDEND_MINIMUM/MAXIMUM`, which alias the two-digit pair.
- In `dry-math/definition.ts`: `DRY_MATH_THREE_DIGIT_CAPACITY = { addition: { without: 108900, required: 212301 }, subtraction: { without: 136125, required: 270225 } }`, `DRY_MATH_SAMPLE_ATTEMPTS = 1000` and `DRY_MATH_FIXED_POOL_ADVICE`.
- The oracle restates its own copies on purpose, next to `arithmetic-oracle.ts:26-35`, as it already does for 100, 12 and 144.

**Practice members** (`types.ts:225-251`; `PracticeRequestV1` is never persisted):
- `{kind:"dry-math-three-digit"; operations: readonly MathOperation[]; regrouping: RegroupingMode}`. Both regrouping values are explicit; it is a new path.
- `{kind:"dry-math-multi-digit"; operations: readonly FactOperation[]}`.
- `{kind:"dry-math-remainders"}`.
- Each is projected whenever its strand is chosen, with `mathSkills = { ...inactiveMath(), representations: ["equations"] }`, so the document-level bounds check at `invariants.ts:636-651` stays true without being widened.
- The existing kinds and the `without` rule (no member means the default page) are untouched, so every earlier request is byte-identical.

**Generation:**
- `enumerateDryMathCandidates` (`generator.ts:65-75`) is a per-kind switch from Step 40. Existing branches keep their walk, order and `seededShuffle` exactly.
- **Three-digit** (`sampleThreeDigitItems(practice, count, random: Pick<SeededRandom, "nextBounded">)`, exported from `generator.ts` as the test seam; `SeededRandom` is `seeded-random.ts:6`):
  - `generateDryMath` passes `createSeededRandom(request.seed)` (today `:245`). For each item:
    - draw `op = operations[random.nextBounded(operations.length)]` once;
    - then repeat up to `DRY_MATH_SAMPLE_ATTEMPTS` times: `left = 100 + random.nextBounded(op === "addition" ? 900 : 901)`, `right = 100 + random.nextBounded(900)`; accept when `0 ≤ answer ≤ 1000`, `regroups(op,left,right) === (regrouping === "required")` and `factKey` is unseen.
  - The sampler returns exactly `count` items or `undefined`, never a short list; `generateDryMath` maps `undefined` to `GENERATION_INVARIANT_FAILED`. The fail-closed test calls the seam with `{ nextBounded: () => 0 }` (every operand pair is 100, 100).
  - The worst per-attempt acceptance rate is 0.134 (addition without regrouping), so the chance an item misses is below 10^-60.
  - Each item's operation is equally likely, because it is drawn before and independently of the retries, and rejection keeps each operand pair uniform over its operation's pool. A page may still be mostly one operation.
  - Items are built per kind where the item map (`:247-257`) today writes `{ kind: "number" }` at `:256`.
  - Capacity is read only through `measureDryMathCapacity` (`:289-291`), which returns the table sum for the requested operations. `generateDryMath` (`:234-236`) and `dryMathCapacityVerdict` (`:300-304`) share it, which keeps the single pre-click/generator owner from issue #14. It must not enumerate, because `probeCapacity` (`registry.ts:290-313`) runs on every control render and the print seed search runs up to 50,000 seeds (`matrix.ts:295`).
- **Multi-digit and remainders:** canonical exhaustive enumeration, as for facts. The pools are 720 + 1,645 and 556.
- **Capacity verdict:**
  - Every new pool is at least the largest budget (`DRY_MATH_ITEM_BUDGETS.long` = 18, `definition.ts:24`).
  - `dryMathShortfallFor` routes each new kind to one new function, `dryMathFixedPoolShortfall`, which names no maximum key and so never reaches `bindingMaximumKeysByProbe`.
  - Its arm is declared dead in `limit-labels.test.ts` with that reason, and a unit test with a stubbed capacity of 1 checks its sentence.
  - `getRelevantMaximums` returns `NO_MAXIMUMS` for every new strand.

**Answer kinds and invariants:** see Step 43 Produces. Summary:
- `ObjectiveAnswerV1` gains `quotient-remainder`, and `DryMathItemV1.answer` widens to include it.
- `dryMathAnswer` chooses the recomputed kind from the item's stored kind.
- The universal Dry Math kind gate at `invariants.ts:536-545` moves into the per-branch checks.
- The safe-integer check at `:521-527` covers the pair.
- The exhaustive `answerText` sites (`AnswerKeyView.tsx:58`, `required-content.ts:219-223`) gain the kind.
- Every reader of `.value` on an un-narrowed answer narrows on `answer.kind` (typecheck is the inventory). Outside Dry Math this includes `count-compare-make/generator.ts:436-445` (`sameAnswer`), which Step 43 owns and compares per kind; Step 50 later adds only its `time` case. The Dry Math readers are listed in Step 43 Produces.
- `dryMathBranchOf` (`invariants.ts:122-143`) gains `three-digit` / `multi-digit` / `remainders`, each with its own `*ItemHolds`.
- The three-digit check uses the Step 41 domain rule. The multi-digit check covers a 10-99 left factor × a 2-9 right factor, or an exact division of a 100-999 dividend by a 2-9 divisor. The remainders check covers a 10-99 dividend divided by a 2-9 divisor, with a remainder from 1 to divisor − 1 and a quotient of at least 1.
- In `tests/oracles/arithmetic-oracle.ts`, `oracleFocusOf` (`:294-316`) gains the three kinds. The Dry Math document reader is at `:456`; `:780` is the Number Bonds reader and is not touched.

**Blank owner** (`src/shared/worksheet/dry-math-blank.ts`):
- `dryMathBlank(practice)` returns `{kind:"single", underscores}` or `{kind:"remainder", quotient, remainder}`.
  - Legacy kinds (no member, `dry-math-add-subtract`, `dry-math-facts`) return `LEGACY_DRY_MATH_BLANK_UNDERSCORES = 4`. This is today's literal, kept so that earlier pages render the same text (Design defaults, Dry Math 2).
  - `three-digit` returns 8 and `multi-digit` returns 6.
  - `remainders` returns 4 / 2.
  - New counts are 2 × the digit count of the domain's largest answer, computed from the constants.
- The mechanism is underscore glyphs only, with no CSS `min-width` and no token. The printed width is the glyph width, so a `font-size:1px` calibration really collapses the box.
- Independence: the expected values are never read from the helper.
  - `required-content.ts` keeps a per-kind literal: `____`, `________`, `______`, `____ R __`.
  - `print.spec.ts` derives expected digits from the oracle's restated constants: 1000 → 4, max(99 × 9, ⌊999 ÷ 2⌋) → 3, ⌊99 ÷ 2⌋ = 49 → 2, and 9 − 1 = 8 → 1. Legacy rows expect 2 digits (exactly 4 underscores).
  - A helper bug therefore fails both the content check and the measurement.

**Print geometry.**
- The Dry Math print grid has two columns (`tokens.css:66-70`), and items use `white-space: nowrap` (`:79-82`). Rows print at `--instruction-size` (16 / 18 pt), and a column is about 93 mm wide.
- The widest new row is `1000 − 999 = ________`: about 57 mm at 16 pt and about 64 mm at 18 pt, so A4/large is the binding cell. That is why Steps 41 and 43 print on Letter/standard and A4/large.
- `47 ÷ 5 = ____ R __` is about 50 mm.
- No item budget changes (8/12/18, and 8/8/12 at large scale).
- New `matrix.ts` fixtures go after `dry-math-facts-144` (:93-106), with their boundary predicates in the Step 40 switch near `:316-349`. Their `print.spec.ts` assertions go next to `:1015-1051`, each inside its fixture's `if (fixture.id === …)` block of the existing row test.
- Calibrations go through `withPrintStyle` (`:612`) inside those blocks, as the facts operator calibration does at `:1044-1050`; no calibration is its own `test()`, so only new fixture rows move the counts. Step 40's calibrations run in the `dry-math-regrouping-100` block (`:1015-1025`) and move nothing. Step 43 calibrates the R mark, the quotient blank and the remainder blank separately.
- The per-digit floor (4.5 / 5 mm) rests on a nominal 0.5 em underscore, and the font stack (`App.tsx:431`) resolves a different face on Ubuntu; Step 40 records the measured Windows widths in `docs/testing-print.md` for M3 to compare.
- Count pins: `ci-contract.test.ts:48` (117 now; then 119, 120 and 122) and the per-cell expectation at `:62-77`, which gains a `dryMathCells` map (Letter/standard +1 in each of Steps 41-43, A4/large +1 in Steps 41 and 43). `docs/testing-print.md` reads 99/31/130 now; then 101/33/134, 102/34/136 and 104/36/140. The absolutes assume Step 39 and the other Phase H lanes add no print row before these steps; each step's Done-when is the delta, and the coordinator recounts at assembly.

**Tests that change on purpose** (not regressions):
- Step 40:
  - `limit-labels.test.ts:1430-1437` and `:1477-1478` (switches);
  - `registry.test.ts` (reads `[data-answer-blank]`);
  - `print.spec.ts` (the new measurement inside existing row tests).
- Steps 41-43:
  - `limit-labels.test.ts` (sweep sources, the `NA-dry-math-fixed-pool` reachable arm and the `DSF-fixed-pool` dead arm; Step 41 adds a `three-digit` case to the Step 40 switches);
  - the fast-check selection arbitrary at `project-request.test.ts:512`, which picks up the new members automatically and gains arbitraries for the new groups;
  - `migrate.test.ts`, whose expected v2 output gains the default groups;
  - `config-shape-fingerprint.test.ts` (one added violation probe each in Steps 41 and 42; no snapshot repin);
  - `config-api.test.ts` (one added round-trip row per step);
  - `packet-session.test.ts` (one detail row per step);
  - `random-packet.test.ts` (one `largestNumber` case per step; Step 41's strand pin test);
  - `ci-contract.test.ts` counts.
- Step 43: the Dry Math `answer.value` readers named in its Produces narrow on `answer.kind`, and `count-compare-make/generator.ts` `sameAnswer` compares per kind; their assertions do not change.
- `practice-focus.test.ts:44-53` (the catalog labels) does not change, because the new entries are separate lists. It gains tests for each new entry list and `describe*` helper.

**Out of scope.** `random-packet.ts` and the random packet levels (Step 55; `random-packet.test.ts` changes only as above), Sentence Builder, a stacked column layout, larger blanks on existing pages (Design defaults, Dry Math 2), and any change to `V1_NUMERIC_MAXIMUM` or `DRY_MATH_NUMERIC_MAXIMUM`.

## Arithmetic: Operation Grid headers (Steps 44-45)

**Constants** (owner `frontend/src/shared/worksheet/types.ts`, beside :69-85. Never touch `V1_NUMERIC_MAXIMUM`/`DRY_MATH_NUMERIC_MAXIMUM`, and write no bare literal 20):
- Step 45 adds:
  - `OPERATION_GRID_HEADER_START_MINIMUM = 1`.
  - `OPERATION_GRID_HEADER_START_PERSISTED_MAXIMUM = 98`, with the comment: "permanent at schemaVersion 2; refusal ceilings may tighten, this bound may not" (Coordinator ruling R3).
  - `OPERATION_GRID_HEADER_MAXIMUM = 99`: headers stay two digits.
  - `OPERATION_GRID_CELL_MAXIMUM = 999`: three digits. Today's standard rows already print three digits in a 14.5 mm cell (`grid-multiplication-10` reaches 100). Large print already prints four digits in 17 mm (the `grid-powers-10x3` key's 1,000).
- Refusals, invariants and oracle read these constants. Only the persisted constant feeds Zod (`z.number().int().min(…).max(OPERATION_GRID_HEADER_START_PERSISTED_MAXIMUM).default(DEFAULT_OPERATION_GRID_HEADER_START)`) and the transport schema.
- Step 44 adds no limit constant.
- The `types.ts:69-71` docblock ("Its headers run from 1 to that count") is rewritten in Step 45.

**Defaults** (`schema.ts:170-173`, mirrored in `defaults.ts:66-72`):
- `DEFAULT_OPERATION_GRID_HEADER_ORDER = "in-order"` (Step 44).
- `DEFAULT_OPERATION_GRID_HEADER_START = 1` (Step 45).
- The outer default at `schema.ts:241-247` spreads the same constants.

**Persisted shape:**
- `transport-schemas.ts:264-273`: add `headerOrder: { enum: OPERATION_GRID_HEADER_ORDERS }` (Step 44) and two integer properties with minimum 1 and maximum `OPERATION_GRID_HEADER_START_PERSISTED_MAXIMUM` (Step 45). Append each name to the optional list at :272.
- `schema-parity.test.ts`: add rows beside :309-336 and extend the expected object at :586.
- `migrate.test.ts`, `earlier-settings.test.ts` (one literal each): the expected `operationGrid` objects gain the defaults.
- The fingerprint test (`config-shape-fingerprint.test.ts:61+`) pins no `operationGrid` path, so new paths may appear.
- `tests/integration/config-api.test.ts`, beside the `describe.each` at :617-667: a PUT of a fictional config with the new field set to a non-default value (`headerOrder: "mixed"`; `rowStart: 6`, `columnStart: 11`) GETs back equal, with only that field changed and the profile untouched. A file written directly with an `operationGrid` lacking the field GETs the default, and its bytes stay unchanged (no rewrite on read).

**Request** (`types.ts:242-249`, `project-request.ts:272-275`):
- The member gains `readonly headerOrder?: "mixed"` (Step 44), and `readonly rowStart?: number` and `readonly columnStart?: number` (Step 45).
- Each field is spread only when it is non-default, compared against the `DEFAULT_*` constants, never against literals.
- **Golden:** `frontend/tests/fixtures/golden/practice-content-keys.json` has no `operation-grid` key, because Operation Grid was added after the golden grid was captured (`tests/integration/practice-golden.test.ts:341-350`: its `undefined` is the earlier-settings covering group, so every grid cell is base-only). The golden stays unchanged.

**Refusal** (`definition.ts:113-171`, the one owner that both the control and the generator read):
- `OperationGridChoices` (:114-120) gains `headerOrder?`, `rowStart?` and `columnStart?`, each read with `?? DEFAULT_*`. So `describeOperationGrid` callers (`packet-session.ts:216`, `registry.ts:688`) and the 5-field literals in tests keep compiling.
- Step 44 adds the diagonal chain branch after the non-square branch (:165-169):

  > Diagonal first needs row and column numbers in order. Choose In order, or Random placement.
- Step 45 changes the following. `s` is a start, and `last = s + count − 1`.
  - **Powers arms (:134-143)** are generalized, not appended to. When the start is 1, today's byte-identical sentence fires. Otherwise only the start sentence fires (and the same for columns, with "exponents up to 3"):

    > Powers use bases up to 10, so rows from {s} to {last} go past it. Choose fewer rows or a smaller first row number.
  - **Header ceiling** (addition and multiplication only; powers is always bound tighter, so this arm never fires for powers):

    > Row numbers go up to at most 99. Rows from {s} to {last} go past it; choose fewer rows or a smaller first row number.

    The same arm exists for columns.
  - **Product ceiling** (multiplication only, and only when neither header-ceiling arm fired), when `lastRow × lastColumn > 999`:

    > Multiplication answers can be at most 999 so they fit their boxes. Rows up to {lastRow} and columns up to {lastColumn} make {product}; choose fewer rows or columns, or smaller first numbers.

    Addition can never reach 999 under the 99 header ceiling.
  - **Diagonal chain:** the order is powers → non-square → mixed → unequal starts. One diagonal sentence prints at a time, as today. The unequal-starts sentence is:

    > Diagonal first needs the same first row number and first column number. Choose the same first numbers, or Random placement.
- **Limit-labels sweep** (`limit-labels.test.ts`): Operation Grid has one refusal arm, `REG-operation-grid-UNAVAIL` (`REFUSING_WORKSHEET_TYPES` :392, note :387-388), and one advice arm, `NA-operation-grid` (note :526-530, branch :1495-1503).
  - Each step extends the UNAVAIL note and adds one `OPERATION_GRID_SOURCES` entry (:1199-1236) per new sentence, each reaching the UNAVAIL arm on its own. Each new sentence is pinned exactly beside the existing refusal tests (:2104-2183; the Diagonal first test is at :2137-2148).
  - Step 44 also adds an available "mixed random" source, so the mixed advice is observed.
  - The `NA-operation-grid` branch expects, per source, `OPERATION_GRID_MIXED_LIMITING_RESOURCE_ADVICE` when the source's `headerOrder` is `mixed` and `OPERATION_GRID_LIMITING_RESOURCE_ADVICE` otherwise. It picks between the two constants directly, never through the owner function, so the test cannot agree with a wrong owner.
- **Advice** (Step 44):
  - The owner is `operationGridLimitingResourceAdvice(choices)` in `definition.ts`. In order it returns `OPERATION_GRID_LIMITING_RESOURCE_ADVICE` (:210-211, byte-identical). Mixed, it returns `OPERATION_GRID_MIXED_LIMITING_RESOURCE_ADVICE`:

    > Operation Grid varies in its header order and in which cells are pre-filled. Choose Random placement or a different number of pre-filled cells, or create a new worksheet later.
  - The `getLimitingResourceAdvice` interface already takes `context` (`registry.ts:218-220`). Only the grid registration's lambda at :693 changes, from `() =>` to `({ selection }) => operationGridLimitingResourceAdvice(selection.operationGrid)`, as at `registry.ts:524`.
  - Update the comments at `registry.ts:692` and `definition.ts:206-208`.
- **`describeOperationGrid` (:217-220)**, the one wording owner for the status line and the packet label (Coordinator ruling R2):
  - (Step 44) appends `OPERATION_GRID_MIXED_SUMMARY_PHRASE` (", row and column numbers mixed up").
  - (Step 45) writes `{rows} rows from {s} to {last}` (and the same for columns) only when a start is not 1.
- `OPERATION_GRID_SIZE_HELP` (:74), in Step 45, adds: "Row and column numbers start at the first number you choose and go up to at most 99, and multiplication answers stay at most 999."

**Generator** (`generator.ts`):
- In Step 45, `headersTo` (:40-43) becomes `headersFrom(start, count)`.
- `chooseGivenCells(practice, random)` is exported and has no other caller (grep: only `generator.ts:116`). The generator creates `createSeededRandom(request.seed)` once and passes it in first, so the existing draws are identical.
- Then, only when mixed: `rowHeaders = notAscending(seededShuffle(range, random))`, then the same for `columnHeaders`.
- Update the docblock at :23-29.

**Invariants** (`invariants.ts`):
- `operationGridPracticeOf` (:335-354) also requires:
  - `headerOrder` absent or exactly `"mixed"`;
  - each start absent or an integer from 2 to 98;
  - each `last ≤ 99`;
  - the multiplication `lastRow × lastColumn ≤ 999`;
  - the powers last base ≤ 10 and last exponent ≤ 3;
  - for Diagonal first, no `headerOrder` and equal starts.
- `headersRunFromOne` (:357-359, used at :392-393) becomes `headersHold(headers, start, count, order)`:
  - in order, exactly the range;
  - mixed, a permutation of the range that is not ascending.
- `operationGridCellWithinCeiling` (:368-373), in Step 45: powers cells are at most 1,000, and all other cells at most `OPERATION_GRID_CELL_MAXIMUM`. Its test (`generator.test.ts:368-373`) changes as Step 45 Done-when 2 states.
- Rewrite the docblocks at :327-333, :356, :361-366 (which says "no ceiling of their own") and :375-383.
- `answer-oracle.ts:89-122` already recomputes from any positive headers, so it does not change. Add one mixed and one offset item to `answer-oracle.test.ts`.

**Independent oracle** (`tests/oracles/arithmetic-oracle.ts:842-1064`). It keeps its own literals, per the oracle convention:
- `ORACLE_GRID_HEADER_MAXIMUM = 99`, `ORACLE_GRID_CELL_MAXIMUM = 999` (Step 45).
- `OracleGridFocus` (:862-868) gains optional `headerOrder?`, `rowStart?` and `columnStart?`. Absent means in order from 1. The existing literals keep compiling unchanged:
  - `arithmetic-oracle.test.ts:750, 767, 819`
  - `operation-grid.spec.ts:36-40`
  - `Renderer.test.tsx:87`
  - `release-smoke.spec.ts:814`
- `oracleGridFocusOf` (:1013-1025) copies the fields only when present.
- `oracleGridPrintable` (:902-915) applies the new last-header, product, powers-start and diagonal rules.
- `judgeGridTable` (:952-1010):
  - The headers (:961-967) equal the exact range in order, or are a permutation of it mixed. A mixed axis that comes out ascending gets the new code `NOT_MIXED`.
  - The expected value of each cell is `oracleGridCell(operation, table.rowHeaders[r], table.columnHeaders[c])`, read only after the headers have passed that check.
  - `OVER_CEILING` also covers non-powers cells above 999.
- `judgeOperationGridDocument` (:1032-1064): compute `expected` (:1055) from the item's validated headers, not from `oracleGrid(...)` by index. Update the docblock at :890.

**Controls** (`GeneratorControls.tsx:766-855`, helper `changeOperationGrid` at :670):
- (Step 44) A `RadioGroup` with the legend `OPERATION_GRID_HEADER_ORDER_LEGEND` ("Header order"), the name `operation-grid-header-order`, and the labels `OPERATION_GRID_HEADER_ORDER_LABELS = { "in-order": "In order", mixed: "Mixed up" }` in `definition.ts`, after the Grid size fieldset and before Placement.
- (Step 45) Two `NumberField`s, `OPERATION_GRID_ROW_START_LABEL` ("First row number") and `OPERATION_GRID_COLUMN_START_LABEL` ("First column number"), with min 1 and max `OPERATION_GRID_HEADER_START_PERSISTED_MAXIMUM`, after Columns (:794-803).
- The presets (:677-684) do not change.
- e2e (`tests/e2e/fixtures/worksheet-controls.ts`):
  - Add locators beside :112-115.
  - `chooseOperationGrid` (:241-260) takes `OperationGridChoices` (new fields optional) and sets a new control only when its field is present. Its callers then compile unchanged: `operation-grid.spec.ts:49`, `packet-queue.spec.ts:223`, `release-smoke.spec.ts:830` and `worksheet-controls.ts:327`.
- `accessibility.spec.ts` (the grid test at :610+; `tabTo` at :191-205 presses Tab until the target takes focus, so it can reach only a radio group's checked option):
  - (Step 45) `tabTo` First row number, then First column number, after Columns (:636).
  - (Step 44) then `tabTo` the checked In order radio; ArrowDown checks and focuses Mixed up and the summary names the mixed order; ArrowUp restores In order before Placement (:637), so the later Diagonal preset walk is unchanged. This is the radio pattern at :500-507.

**Literal `operationGrid` construction sites:**
- The sites typed as `OperationGridV2` or `WorksheetSelectionV2` spread a default group: `...shippedSelection.operationGrid`, `...BASE_SELECTION.operationGrid`, `...SWEEP_BASE.operationGrid`, or `worksheetSelectionOf(...)`'s group. They are:
  - `matrix.ts:130,146,165`
  - `release-smoke.spec.ts:814`
  - `packet-session.test.ts:239` (Coordinator ruling R1(a))
  - `random-packet.ts` `grid()` (:124-135), only if Step 39 left it writing a five-field literal: it spreads `DEFAULT_WORKSHEET_DEFAULTS_V2.operationGrid`, never `selection.operationGrid` (R1(a), R1(c))
  - the config, `limit-labels`, `project-request`, `registry`, `shipped-profile-options`, `options` and `worksheet-session` test literals
- Sites typed as practice members or `OracleGridFocus` compile unchanged, because those fields are optional.
- The developer greps `placement: "` across `frontend/src` and `frontend/tests` (19 files today) and runs `typecheck` to confirm, as the code-quality rule requires.

**Random packet** (Coordinator ruling R1(c), until Step 55): the leak test in `random-packet.test.ts` sets the session's `operationGrid` to mixed (Step 44) and to starts of 6 (Step 45), and asserts that every Operation Grid sheet `makeRandomPacket` makes at every level has a request member without `headerOrder`, `rowStart` or `columnStart`, and headers exactly 1..count.

**Print** (Step 45; the geometry at `tokens.css:230-274` does not change: fixed 14.5/17 mm cells, `table-layout: fixed`, the instruction-size font):
- **Fit:** three bold Arial digits at 16 pt are about 9.4 mm, inside a given cell's 12.7 mm content box (14.5 mm less two 0.9 mm borders). The developer measures this on the new row rather than trusting the estimate.
- **Large print:** headers keep two digits and cells at most three. Large print already prints four digits in its powers key, so no large row is added.
- **Per-cell check:** in `print-checks.ts`, beside the text loop at :163-191.
  - For each text node whose element has a `closest("[data-grid-cell]")`, compute the cell rectangle inset by its computed border widths.
  - Push `text outside cell: <label>` when a text rectangle exceeds it by more than 0.05 mm.
  - The check is shared, so `packet-print.spec.ts` also runs it.
- **Matrix row:** add a new row in `matrix.ts` after :174, built from `...shippedSelection.operationGrid`:
  - multiplication, 12 × 12;
  - `rowStart` and `columnStart` both set to `Math.floor(Math.sqrt(OPERATION_GRID_CELL_MAXIMUM)) − OPERATION_GRID_SIZE_MAXIMUM + 1`;
  - `headerOrder: "mixed"`, 72 given cells, random placement;
  - printed on Letter/standard and A4/standard.
- **Calibration:** in the shared `operation-grid` block of `print.spec.ts:1193-1224`, the letter-spacing anchor goes through `withPrintStyle` (:612), with CSS only and no DOM mutation. It must fail, then restore clean.
- **Counts** (deltas from whatever Steps 39-44 leave; Steps 40-43 already move them):
  - `ci-contract.test.ts:48`: +2, and its comment at :46-47 is updated.
  - In `gridCells` (:62-66), `letter-standard` and `a4-standard` each rise by 1. The comment at :56-61 is updated.
  - In `docs/testing-print.md`:
    - worksheet cases (:54) +2, keys (:59) +2 and surfaces (:178-179) +4;
    - :56-57 "three Operation Grid rows" becomes four;
    - add a table row after :87, and one per-cell sentence at :123-127.

**Docs:**
- `README.md`, keeping the literal "within 20" (:167; the release audit requires it, `frontend/scripts/audit-release.mjs:157`):
  - :16, the Operation Grid row: (Step 44) "…its size, whether its row and column numbers run in order or mixed up…"; (Step 45) "…and the first row and column numbers…".
  - :22, the clause "Operation Grid asks for its operation, grid size, placement, and number of pre-filled cells": the same additions.
- `docs/educational-basis.md`:
  - :50, Availability: name the header order (Step 44) and the first numbers (Step 45).
  - :51, in Step 45: "headers run from 1 to at most 12 … at most 144" becomes headers up to 99, sums at most 198 and products at most 999.
  - The section at :118-131:
    - (Step 44) mixed order rationale, which is recall rather than counting along a row, and Diagonal first needing in-order headers;
    - (Step 45) the starts and the equal-start diagonal. Replace :120-121's "each from 1 to the size".
  - Add sources, cited only for what is practised, with no grade, placement or readiness claim:
    - CCSS 2.NBT.B.7, adding within 1,000, for sums of two-digit headers;
    - CCSS 4.NBT.B.5, multiplying two two-digit numbers, for products of two-digit headers.
- `CLAUDE.md`:
  - :75 becomes "sums (to 24, or to 198 when the parent starts the headers above 1), products (to 144, or to 999) or powers (to 1,000)" (Step 45).
  - The architecture rule about mixed order (Step 44).
  - One current-state paragraph per step, after :106-109.
  - The counts sentence that `testing-print.md` owns (Step 45).
- Version: Step 44 sets 1.9.0 and Step 45 sets 1.10.0 (`npm --prefix frontend version <target> --no-git-tag-version`).

## Numbers to 100 (Steps 46-49)

**Constants** (`src/shared/worksheet/types.ts`, beside :47-66). `V1_NUMERIC_MAXIMUM` and `DRY_MATH_NUMERIC_MAXIMUM` are unchanged.
- Family ceilings: `NUMBER_BONDS_WHOLE_MAXIMUM = 100`, `FIND_THE_WOW_EQUATION_MAXIMUM = 100`, `COUNT_COMPARE_NUMERAL_MINIMUM = 10` and `COUNT_COMPARE_NUMERAL_MAXIMUM = 100`. They bound requests and validators, never catalogs.
- `FIND_THE_WOW_NEAR_MISS_OFFSETS = [-10, -2, -1, 1, 2, 10] as const` (Step 47): the one definition of the Wow near-miss offsets. Step 47's `nearMissResults` reads it, and Step 53 imports it; no other module restates the list. Tests keep their own independent literal, per the oracle convention.
- One shared list `WIDE_RANGES` (`enums.ts`) and its one default `DEFAULT_WIDE_RANGE = "off"` (`schema.ts`) serve both families (Step 46).
- One map `WIDE_RANGE_MAXIMA` (`practice-focus.ts`) reads the two preset `resultMax` values. It is not in `types.ts`, because `math-presets.ts:1` imports `types.ts`.
- No new name ends in `_V1_MAXIMUM`, because the envelope guard treats such names as aliases. New shared code imports `V1_NUMERIC_MAXIMUM` and never types a bare 20. `practice-focus.ts` imports only shared modules (:12-28), so it never reads `FIND_THE_WOW_V1_MAXIMUM` (`find-the-wow/definition.ts:43`).

**Persisted keys** (CONTRIBUTING "Persisted shape": additive at v2; no migration, no fingerprint repin).

| Key | Values | Default constant | Step |
|---|---|---|---|
| `numberBonds.wideRange` | `WIDE_RANGES` | `DEFAULT_WIDE_RANGE` (`off`) | 46 |
| `numberBonds.regrouping` | appends `required` | `DEFAULT_NUMBER_BONDS_REGROUPING` (`without`, unchanged) | 46 |
| `findTheWow.equation.wideRange` | `WIDE_RANGES` | `DEFAULT_WIDE_RANGE` (`off`) | 47 |
| `findTheWow.equation.regrouping` | `FIND_THE_WOW_REGROUPING_MODES` (`without`, `included`) | `DEFAULT_FIND_THE_WOW_REGROUPING` (`without`) | 48 |
| `countCompareMake.mode` | `COUNT_COMPARE_MAKE_MODES` (`groups`, `numerals-to-100`) | `DEFAULT_COUNT_COMPARE_MAKE_MODE` (`groups`) | 49 |

- Labels `NUMBER_BONDS_REGROUPING_LABELS` (`number-bonds/definition.ts:58-61`) are a `Record`, so `tsc` forces the new label "Every problem carries or borrows".
- Each new key is optional in its transport object, so the pinned `required=[...]` lines for `$.defaults.findTheWow.equation` (`config-shape-fingerprint.test.ts:75`) and `$.defaults.countCompareMake` (:65) stay identical; `numberBonds` is not pinned.
- Every new key gets a round trip in `tests/integration/config-api.test.ts`, beside the `describe.each` at :617-667: a PUT of a fictional config with the key at a non-default value GETs back equal, with only that key changed and the profile untouched; a file written directly with the group lacking the key GETs the default, and its bytes stay unchanged.
- Catalog entries never hold a value above a persisted bound (Coordinator ruling R3). A wide or numerals entry stores the bounded field at `V1_NUMERIC_MAXIMUM` plus its new member, and the readers (`numberBondsWholeMaximum`, `findTheWowEquationLimits`, the CCM `mode` branch) ignore that field.

**Random packet** (Coordinator ruling R1(c), until Step 55): no Easier/Medium/Harder sheet may carry a parent's saved wide range, carrying choice or numerals mode.
- `bonds()` (`random-packet.ts:112-122`) and `countCompare()` (:107-110) replace the whole group, and `wowEquation()` (:92-98) replaces the whole `equation`. Once Step 39 builds from the exported defaults, or the Step 46 R1(a) spread lands, each writes the default for every new key.
- `wowQuantity()` (:84-90) builds `findTheWow` from the default group (Step 39), so a parent's saved `equation` never reaches a packet sheet; a quantity page projects no equation member in any case.
- `new-choice-consumers.test.ts` therefore asserts on the projected request, per family: no Number Bonds member has `wholeMax` above `V1_NUMERIC_MAXIMUM`; no Wow request carries a `find-the-wow-equation` member; no CCM request carries a `count-compare-numerals` member. It also asserts the stored defaults on each sheet whose family the candidate replaced.

**Requests** (`project-request.ts`):
- **Number Bonds** (:263-270): the member keeps its shape, with `wholeMax: numberBondsWholeMaximum(numberBonds)`.
- **Wow:**
  - With `wideRange !== "off"`, the capabilities (:148-150) carry `findTheWowEquationLimits`, and `projectWorksheetPractice` adds `{kind: "find-the-wow-equation", regrouping}`.
  - Otherwise there is no member, as with the Dry Math "without" case (:286-288).
- **CCM** (:158-168):
  - In numerals mode, `mathSkills` is `{...inactiveMath(), representations: ["quantities"]}`. The gate (`count-compare-make/definition.ts:170-181`) passes, and no stored maximum reaches the request.
  - The request carries `practice: {kind: "count-compare-numerals"}`. Decoration, Theme and the decorative topic are unchanged, as on today's page.
- **Family acceptance** (`invariants.ts:478-504`): Wow accepts only its kind, and only in equation mode. CCM accepts only its kind. `dryMathBranchOf` (:122-142) returns `undefined` for both, so Dry Math refuses them.

**Number Bonds catalog, generation and print:**
- `matchNumberBondsFocusOption` (`practice-focus.ts:302-311`, read by the select at `GeneratorControls.tsx:536`) compares `numberBondsWholeMaximum` and the operations, never the raw `wholeMax`, so a stored within-100 focus (`wholeMax: 20`) matches `…-within-100`, not `…-within-20`. `savedSettingOptionLabel` (:256-258) reads the same reader through `describeNumberBondsFocus`.
- `relationAllowed` (`generator.ts:53-59`) and `numberBondItemHolds` (`invariants.ts:300`) use `regroups("addition", a, b)` for the three modes.
- `required` is offered only from a whole of `NUMBER_BONDS_REQUIRED_WHOLE_MINIMUM = 10` (`types.ts`; the smallest whole with a regrouping split, 1 + 9) up, through one owner, `numberBondsRegroupingModesFor(focus)` (`practice-focus.ts`), which the radio and both catalog sweeps (`registry.test.ts:3238-3245`, `shipped-profile-options.test.ts:167-174`) read (Design defaults, Numbers 7). Below 10 no split regroups, so `required` would have 0 problems; within 10 has 18 per operation, exactly the Long budget. Choosing a focus below 10 while `required` is checked writes `without`. The stored-value sweeps over every largest whole 2..20 (`shipped-profile-options.test.ts:454-483`, :500-520, and `limit-labels.test.ts` `NUMBER_BONDS_SOURCES`) still reach `required` below 10, where it is refused at every layout under the existing `NB-range-only` arm.
- The capacity probe enumerates about 19.8k candidates for within 100 with both operations and `included`. That cost is acceptable, and it is not timed.
- The oracle (`tests/oracles/arithmetic-oracle.ts:34-35`) gets `ORACLE_NUMBER_BONDS_CEILING = 100` and `ORACLE_SOLUTION_MAXIMUM = 200` as its own literals.
- `numberBondsMissingDigits(practice)` (`number-bonds/definition.ts`) returns the digit count of the largest blank value the request's filtered relations produce, never less than 2. A blank is an addend, a minuend or a subtrahend, and an addend is at most 99, so the only three-digit blank is a minuend of 100. The closed form is 3 exactly when the operations include subtraction, the whole maximum is 100 and the mode is not `without`; under `without` no relation has a whole of 100 (every split of 100 regroups), so within 100 subtraction without carrying or borrowing returns 2. The unit test checks the closed form against `enumerateNumberBondsCandidates` for every catalog focus × mode.
- `Renderer.tsx:70` sets the attribute on the `<ol>`. The screen box width (:47, now 2.4em) is 3.4em when the count is 3.
- `tokens.css:209-228` adds `[data-missing-digits="3"]` boxes of 21 × 9 / 24 × 11 mm, keeping the existing 7-8 mm per digit. At large scale those lists get a two-column grid.
- At standard scale the widest row, "63 + [21 mm] = 100", is estimated at about 48 mm against the roughly 51 mm auto-fit cell (`Renderer.tsx:75`). If containment fails, standard three-digit lists also take two columns.
- `bonds-missing-100` selection: both operations, `wholeMax: V1_NUMERIC_MAXIMUM`, `wideRange: "within-100"`, `regrouping: "required"`, on Letter and A4 at standard and large scale (no decoration control).
  - Its seed search requires a subtraction item with `missing === "left"` and `leftOperand` 100.
  - The fixture carries `expectedMissingBox: {standard: [21, 9], large: [24, 11]}`, which `print.spec.ts:189-191` prefers over `responseMetrics` (:85-103).

**Wow near-miss path** (`find-the-wow/generator.ts`):
- `nearMissResults(a, R)` returns, in fixed order and without duplicates, the in-range values (0..R, ≠ a) of `a + offset` for each offset of `FIND_THE_WOW_NEAR_MISS_OFFSETS`, then `reverse(a)`.
  - `reverse` applies only to a two-digit `a` whose ones digit is nonzero and differs from its tens digit.
  - It is exported for the validator, and the test re-derives it independently.
- Stems are every `(op in MATH_OPERATIONS order, l asc, r asc)` with l, r ∈ 1..L and 0 ≤ result ≤ R, where L and R are the limits clamped at `FIND_THE_WOW_EQUATION_MAXIMUM`.
  - Regrouping stems are filtered out unless `included`.
  - A stem needs at least 2 near misses; for R ≥ 10 the minimum is 3, so no stem is dropped. No range up to 20 offers the near-miss path (Step 48 applicability), so a within 5 stem with fewer than two near misses never reaches it.
- Construction:
  - `seededShuffle(stems)` sliced to the group count;
  - `balancedCorrectPositions`;
  - per group, `seededShuffle(nearMiss).slice(0, 2)`, then `positionChoices`.
  - Equation stem keys (:147) are unchanged.
- `measureFindTheWowStemCapacity` (:582) and `findTheWowCapacityVerdict` (:599) route by the member.
- The validator (:315-465) changes only with the member:
  - its operand and result maxima may reach `FIND_THE_WOW_EQUATION_MAXIMUM` (today every maximum is bounded by `FIND_THE_WOW_V1_MAXIMUM`, :333-342);
  - operands are at least 1;
  - regrouping is allowed only under `included`;
  - each wrong result is in `nearMissResults`.
  - The quantity maxima keep the V1 bound.
- **Advice** (`registry.ts:366-378`, :467-471): `findTheWowRelevantMaximums` returns `NO_MAXIMUMS` for a wide range, and the Wow advice then returns `FIND_THE_WOW_WIDE_RANGE_LIMITING_RESOURCE_ADVICE` (`find-the-wow/definition.ts`):

  > Two Whats and a Wow varies which equations it shows and which close wrong answers stand beside them. Choose another practice focus, or create a new worksheet later.

  It never falls through to `numericLimitAdvice`'s empty-list sentence (:321-326). In `limit-labels.test.ts` the wide catalog entries take new reachable arms `NA-wow-wide-range` and `FRM-wide-range`, through an explicit branch before the generic one (:1526-1534) and the FRM observation (:1536-1543); `NA-empty` and `FRM-none` stay dead.

**CCM numerals mode:**
- `isNearNumeralPair(a, b)` (`definition.ts`) holds when the two numbers are equal, share a tens digit, differ by 10, differ by at most 2, or are digit reversals.
- Pairs are ordered, left ascending and then right.
- `enumerateNumeralComparisonPairs` sits beside `generator.ts:227-280`, and generation branches before the subtype allocation.
- The validator (`validateCountCompareMakeDocument`, :471) requires a page of only numerals items or only groups items. `recomputeCountCompareAnswer` (:341) and `stemKey` (:423) gain the activity.
- Every `activity` consumer is updated: the Renderer, `registry.test.ts`, `generator.ts` and its test, `count-compare-make.spec.ts`, `print.spec.ts`, `matrix.ts` and `required-content.ts`.
- **Catalog** (`practice-focus.ts:369-391`; Step 49 originates the pattern, and Step 52 appends after it): every preset entry gains `mode: "groups"`, then one non-preset entry "Compare numbers to 100" (id `compare-numbers-to-100`, label from `COUNT_COMPARE_NUMERAL_MAXIMUM`) is appended. The two-catalog label pin (`practice-focus.test.ts:70-77`) splits per catalog: the Wow quantity list is unchanged. The preset-origin test's Count, Compare & Make loop (`practice-focus.test.ts:125-134`) checks only `mode: "groups"` entries.
- `registry.ts:580-632`:
  - the capacity verdict routes by mode;
  - `getRelevantMaximums` returns `NO_MAXIMUMS` in numerals mode, and the advice is `COUNT_COMPARE_NUMERAL_LIMITING_RESOURCE_ADVICE` (`count-compare-make/definition.ts`), built from the two numeral constants:

    > Count, Compare & Make varies which close pairs of numbers from 10 to 100 it compares. Choose another practice focus, or create a new worksheet later.

    In `limit-labels.test.ts` the numerals entry takes a new reachable arm `NA-count-numerals` through an explicit branch; groups entries keep `NA-nonempty`, and `NA-empty` stays dead;
  - applicable controls are unchanged, so decoration and Theme stay offered.
- **Print with decoration.** `decorationApplicable` is keyed on the family (`print.spec.ts:897-898`), so `count-numerals-100` prints decoration false and true in every paper and scale cell: +8 worksheet cases, +4 keys (only decoration-false rows print a key, :917), +12 surfaces.
  - `ci-contract.test.ts`: the listed count (:48) +8; per cell the decoration-true count (:70) rises from 9 to 10, and the decoration-false count rises by 1; the decoration-true regex (:83) becomes `/(?:sentence-|count-all-four-subtypes-|count-numerals-100-)/u`.
  - Fit: `countNumeralCardBound` (125 px standard, 140 px large) plus the 10 px trailing gap, in the two print columns (`tokens.css:129-133`), below the retained title-and-art header (112/120 px, `print.spec.ts:758-761`): 112 + 5 × 135 = 787 px and 120 + 4 × 150 = 720 px, against printable heights of 979 px (Letter) and 1,047 px (A4) (`print.spec.ts:49`, :54). The test asserts this bound and measures the decoration-true rows with the art decoded and visible.
- Later CCM modes append to `COUNT_COMPARE_MAKE_MODES` rather than adding a second key, so `mode` stays the one switch (Design defaults, Numbers 5).

**Notes for Step 55** (level mapping, not built here): the packet test's `largestNumber` (`random-packet.test.ts:58-77`) scores raw `compareMax`/`wholeMax`, so a level ceiling must read the effective limits: `numberBondsWholeMaximum`, `findTheWowEquationLimits` and `COUNT_COMPARE_NUMERAL_MAXIMUM` for numerals mode. A wide `bonds()` candidate must also take `wideRange` from its catalog focus. Step 55 also rewrites the Steps 46-49 leak assertions above to read its level table.

**Sizing note.**
- Step 46 joins two behaviors: the wider ranges and the `required` mode. They share one filter (`relationAllowed`), one radio group and one invariant line, and splitting them would edit those lines twice.
- Step 47 was split under Coordinator ruling R4 (a step too large for one developer context is split): equations to 100 (Step 47) and their carrying choice (Step 48).
- Versions: Step 46 sets 1.11.0, Step 47 1.12.0, Step 48 1.13.0 and Step 49 1.14.0 (`npm --prefix frontend version <target> --no-git-tag-version`). README edits keep the literal "within 20" (`frontend/scripts/audit-release.mjs:157`).

## Clocks (Steps 50-51)

**Constants and owners**
- `src/shared/worksheet/clock-time.ts` is new and shared, and imports only `enums.ts` and `types.ts`. It owns:
  - `CLOCK_EXPLORER_MINUTES_PER_HOUR = 60`;
  - `CLOCK_EXPLORER_TIME_STEP_MINUTES = { hour: 60, "half-hour": 30, "quarter-hour": 15, "five-minute": 5, "any-minute": 1 }`, typed with `satisfies Record<ClockExplorerTimeStep, number>` (Step 50 lists the first three);
  - the coarser-step map: half-hour → hour, quarter-hour → half-hour, five-minute → quarter-hour, any-minute → five-minute;
  - `clockStepWitness(step, minute)`: a minute is a witness when it is not a multiple of the coarser step's minutes.
- `definition.ts`, `generator.ts`, `invariants.ts` and `Renderer.tsx` import it. Today `invariants.ts` imports only shared modules (`invariants.ts:1-40`), and only `registry.ts` reaches into `src/worksheets/`; this design keeps that boundary.
- `ClockExplorerTimeStep = (typeof CLOCK_EXPLORER_TIME_STEPS)[number]` lives in `types.ts`, imported from `enums.ts` the way the Operation Grid enums are (`types.ts:1-9`).
- `CLOCK_EXPLORER_ITEM_COUNT` stays 4.
- `schema.ts`, beside the `DEFAULT_OPERATION_GRID_*` defaults (:169-173), holds two defaults:
  - `DEFAULT_CLOCK_EXPLORER_TIME_STEP = "hour"`;
  - the exported group default `DEFAULT_CLOCK_EXPLORER = { timeStep: DEFAULT_CLOCK_EXPLORER_TIME_STEP }`.

  The Zod group default and `defaults.ts` spread `DEFAULT_CLOCK_EXPLORER` (ruling R1(a)). Step 39's `seedOnly` reaches it through `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)`, so the Random packet needs no pin.
- `CLOCK_EXPLORER_TIME_STEP_LABELS` lives in `definition.ts`, following the `OPERATION_GRID_OPERATION_LABELS` pattern (`operation-grid/definition.ts:49`). It is the one wording owner (R2), read by the registry summary and advice, by `GeneratorControls.tsx` and by `packet-session.ts`.
- No literal 20 appears, and `V1_NUMERIC_MAXIMUM` and `DRY_MATH_NUMERIC_MAXIMUM` do not change.

**Persisted shape** (`CONTRIBUTING.md` § "Persisted shape", rules (a) and (b))
- The group is `clockExplorer: { timeStep }`, with a field default and a group default.
- Its transport `strictObjectSchema` lists `timeStep` as optional, and `clockExplorer` joins the defaults optional list (`transport-schemas.ts:375-381`).
- Step 51 adds only enum members. A Step 50 build reports a five-minute or any-minute file as `blocked`.
- Permanent bound: the five-member enum. There is no numeric key, so nothing can widen later, and no catalog entry or fixture holds a value outside the enum (R3).
- Round trip: `tests/integration/config-api.test.ts` extends the `describe.each` at :617-667, which already covers the Clock Explorer worksheet type.
  - An explicit PUT of each non-hour step reads back through GET and from the stored bytes, with profiles untouched.
  - A v2 file written directly to the temporary path without `clockExplorer` reads as `{ timeStep: "hour" }`, and its bytes are unchanged after the GET.

**Request and projection**
- `PracticeRequestV1` gains `{ kind: "clock-explorer"; timeStep: Exclude<ClockExplorerTimeStep, "hour"> }`.
- `projectWorksheetPractice` (`project-request.ts:263-288`), clock branch: `timeStep === "hour" ? undefined : { kind, timeStep }`. This follows the Dry Math "without" precedent (:286-288).
- `projectWorksheetCapabilities` (:177-189) is unchanged, but its comment at :181-184 must be reworded.

**Generator** (`generator.ts:61-99`)
- On the hour runs today's code verbatim (:76-87), including the `CLOCK_EXPLORER_HOURS` shuffle and the item without `minute`.
- Every other step works as follows:
  - Candidates are `[(h, m) for h in 1..12, m in 0, s, 2s, ... < 60]`, in ascending order.
  - The page takes `seededShuffle(candidates, createSeededRandom(seed)).slice(0, 4)`.
  - If no pick is a witness, the fourth pick is replaced by the first witness after index 4 of the same shuffle.
  - Items are `{ id, itemType, answerability: "objective", hour, minute, answer: { kind: "time", hour, minute } }`.
- Capacity is always sufficient: 24, 48, 144 or 720 candidates for 4 slots, so there is no new refusal arm.

**Answer kind**
- `{ kind: "time"; hour: number; minute: number }`. Documents are session-only, so this is no persisted change.
- `ClockExplorerItemV1.answer` is typed today as the `number` member only (`types.ts:542`). It widens to the `number` or `time` member.
- Consumers to change:
  - `answer-oracle.ts:130-137`: `clockExplorerAnswer` returns `time` when `minute` is present (an integer 0-59), and today's `number` otherwise.
  - `answer-oracle.ts:211-234`: `objectiveAnswerMatches` gains a time branch (both kinds `time`, with equal hour and minute).
  - `AnswerKeyView.tsx`: a `"time"` case in `answerText` (:58-80), plus `ClockExplorerAnswerKey` (:146-180).
  - `count-compare-make/generator.ts:436-445`: `sameAnswer`. Step 43 narrows it by kind for `quotient-remainder`; Step 50 adds only the `time` case.
  - `required-content.ts`: the answer text (:219-223). Lines :160-169 expect two `[data-time-blank]` per card on minute pages and one on the hour.

**Invariants** (`invariants.ts`)
- `seedOnlyRequestIsCanonical` (:426) splits into a base helper used twice:
  - Tally at :713 is the base plus `!("practice" in request)`. Step 54 later replaces this with `tallyDetectivePracticeOf`.
  - Clock at :698 is the base plus `clockExplorerPracticeOf(request)`. That function returns `"hour"` when the member is absent, the step when the member is valid, and `undefined` otherwise. A present member naming `"hour"` is invalid.
- The practice gate (:478-498) branches for clock-explorer the way it does for operation-grid, and `dryMathBranch` excludes clock-explorer.
- The per-item rule (:576-592) is replaced by these checks:
  - `minute` is present exactly when the step is not hour;
  - the minute is an integer in 0..59 and a multiple of the step's minutes;
  - the answer kind is `number` for hour and `time` otherwise, and `objectiveAnswerMatches` holds;
  - a `Set<string>` of `${hour}:${minute ?? 0}` replaces `clockHours` (:509).
- The page rule adds one check: a non-hour page holds at least one `clockStepWitness`.

**Independent oracle** (`tests/oracles/clock-oracle.ts`, never importing `src/`)
- It keeps its own step-minutes table and reads the step from `request.practice`. Its comment at :13 is reworded.
- `oracleClockFace(hour, minute = 0)`: the minute hand at `6m`, the hour hand at `30(h mod 12) + m/2`.
- `oracleTimeFromHands(minuteVector, hourVector)` makes every angle comparison through `oracleAngleBetween` (`clock-oracle.ts:53-56`), so a hand measured at 359.x° matches 0°:
  - `m = round(minDeg / 6) mod 60`, with `oracleAngleBetween(minDeg, 6m) ≤ 1.5`;
  - `k = round((hourDeg − m/2) / 30)`, with `oracleAngleBetween(hourDeg, 30k + m/2) ≤ 1.5`; then `h = k mod 12`, with 0 mapping to 12.
- `oracleHourFromHands` becomes the `m = 0` case.
- `oracleClockKeyLine(h, m)` writes its text from the copy rules below.
- `judgeClockDocument` checks the step domain, (hour, minute) uniqueness and the witness rule.
- `print.spec.ts:482-502` compares the reading with `(item.hour, item.minute ?? 0)`.
- Step 51 adds `oracleTickDegrees()`, which returns 0, 6, ... 354, with majors where `deg % 30 = 0`.

**Copy** (owned by `definition.ts:25-69`)
- Time text: `h:mm`, with zero-padded minutes. On the hour stays `${h}:00`.
- Long-hand phrase:
  - m = 0: "long hand at 12";
  - m a multiple of 5: "long hand at m/5";
  - any other minute: "long hand k marks past n", where n = floor(m/5) (0 → 12) and k = m mod 5. Use "1 mark" for k = 1.
- Short-hand phrase: m = 0 gives "short hand at h". Any other minute gives "short hand between h and h+1", where 12 is followed by 1.
- `spokenDial` (`Renderer.tsx:49-51`) reuses both phrases: "The long hand points …, the short hand points …". It still never gives the written time, and on the hour its string is unchanged.
- Selection summary, for every step with On the hour included: "Clock times for Clock Explorer: <label>." It is the `statusMessage` of `getCapabilitySupport` (`registry.ts:726-729`).
- Packet detail: the label, absent on the hour.
- Advice: `clockExplorerLimitingResourceAdvice(step)` replaces the constant at `definition.ts:43`: "Clock Explorer draws 4 clocks from a fixed set of <n> <step> times. Choose other Clock times, or create a new worksheet later."
  - The registry reads it at :730-731.
  - It recommends its own control, so the guards at `limit-labels.test.ts:1512-1514` and `math-generation.test.ts:411-413` change intent to "names only its own control": they keep `not.toMatch(/practice focus|length|More options/u)` and add `toContain("Clock times")`. The comment at `limit-labels.test.ts:1505-1506`, the title at `math-generation.test.ts:391` and the comment at `options.test.tsx:1240` are reworded to match.
- On the hour keeps every pinned page string (`required-content.ts:57-58` and :160-168). The on-the-hour strings that change are UI copy, not document bytes: the advice pins at `options.test.tsx:1241-1242` and `math-generation.test.ts:409`.

**Print geometry and rows**
- Print lays the four cards out in two columns (`tokens.css:66-70`) on a 7.7 in (Letter) or 190 mm (A4) print width (`print-letter.css`, `print-a4.css`). Each card is about 90 mm wide inside its 2 mm padding.
- Step 50 changes no geometry.
  - Two blanks at 18/22 mm, plus "Time:" and ":", come to an estimated 55/65 mm on one line (`[data-clock-response]` is nowrap, `tokens.css:304`), inside that width. The row measures it.
  - Today's minute hand only ever points at 12 (`definition.ts:50-51`, `Renderer.tsx:55`), so the hand-meets-label check (`print.spec.ts:451-461`) has never seen it at 90°, 180° or 270°. At 180° the label's half-height, not its half-width, faces the tip.
  - The quarter boundary seed therefore holds :15, :30 and :45, and the row measures all four directions. Half-hour pages use only 12 and 6, so the quarter row bounds them.
- Step 51 measures the minute face. These estimates come from source constants, not from print:
  - On the 40/45 mm dial, a longer-reaching face cannot reuse the dial:
    - the minute hand (27 + 1.25 cap) already comes within about 0.3 mm of the "10" box;
    - labels at 34 % would overlap: the "10" and "11" centres are 4.98 mm apart vertically against a 5.64 mm label height, beyond the 0.5 px tolerance at `print.spec.ts:395-399`;
    - at 38 % the "10" box's outer corner reaches the outline, leaving no room for ticks.
  - On a 50/56 mm dial with labels at 34 %:
    - the "10"/"11" vertical gap is 6.2/7.0 mm against label heights of 5.64/6.35 mm;
    - the nearest label corner is about 12.9/14.4 mm from the centre, so a 22-unit minute hand plus its cap (11.6/13.0 mm) clears it by about 1.2/1.4 mm;
    - a major tick from 44 % sits about 1.2 mm outside the "10" box along its own ray.
  - Height: at large scale a card is about 85 mm (the 56 mm dial plus number, response and gaps). Two rows plus the header fit within the 259 mm (Letter) and 277 mm (A4) print heights. The row measures this.
- Minute-face selectors (Step 51):
  - A minute dial carries both `data-clock-dial="true"` and `data-clock-face="minute"`, so `readClockInk` (`print.spec.ts:380`) still finds it.
  - Its size comes from `.print-surface [data-clock-dial][data-clock-face="minute"]`, placed after the plain rule (`tokens.css:293-296`). Both rules use `!important`, so specificity and order decide.
  - The black stroke rule (`tokens.css:301-302`) extends to `[data-clock-tick]`.
  - In `print.spec.ts`:
    - `physicalSelectors.clockDial` (:114) becomes `[data-clock-dial]:not([data-clock-face])`;
    - a new `clockMinuteDial` kind gets 50/56 in the size table (:94, :100) and a `case` in `physicalViolations` (:197-200);
    - the collapsed-dial calibration (:1127-1134) expects `clockMinuteDial[0]: widthMm` on minute-face rows.
- `readClockInk` (`print.spec.ts:358-475`) gains:
  - a `[data-clock-tick]` reading of ink, angle, length, containment and label clearance;
  - a clearance check of at least 0.75 mm on minute faces, in place of the 40-step hand sample;
  - a length-ratio check.
- Matrix (`matrix.ts:175-182`): add the rows `clock-quarter-hours` and `clock-any-minute` with `clockExplorer.timeStep`. The boundary predicate at :367-376 branches on the step:
  - hour: today's predicate;
  - quarter: a 12:xx time with a minute other than 0; a :15, a :30 and a :45 time; and a 10:xx or 11:xx time with a minute other than 0. About 1 seed in 36 qualifies;
  - any-minute: a 12:5x time, an 11:5x time, and a minute that is not a multiple of 5. Expect about 1 seed in 430; the search runs to 50,000 (`matrix.ts:295`).
- The calibration block (`print.spec.ts:1083-1134`) finds its 12 o'clock item by hour (:1088-1090), so each row's predicate includes hour 12. The :15, :45 and 11:5x calibrations find their items by minute and hour.
- ci-contract pins: the total at `ci-contract.test.ts:48`, the cell counts at :68-72 and the `clock-` rows at :73-75. Each step states its delta, not absolute counts.

**Consumer sites**
- `registry.ts`:
  - :163-189: the `WorksheetApplicableControlsV1` interface;
  - the eight `getApplicableControls` entries (:429, :478, :552, :613, :657, :702, :740, :778);
  - the clock support at :726-729 and the advice at :730-731.
- `GeneratorControls.tsx`: :132 (card), :235 and :296 (switch arms, with no earlier-settings group), plus a new block near :766.
- `worksheet-session.ts`: :38-60 and :300.
- `invariants.ts:467` is unaffected.
- Noninterference: in `registry.test.ts`, the Clock Explorer entry of `FAMILY_CHOICE_EDITS` (:1221-1235) gains `own: otherClockExplorer`, and `CONTROL_PROBES` (:1287) gains `clockTimeStep`. The `own === undefined` branch (:1570-1584), left to Tally Detective until Step 54, adds `clockTimeStep` to its flag list.
- One cell per step goes into the "offered exactly when generated" sweeps: `registry.test.ts:3266-3267` and `tests/integration/shipped-profile-options.test.ts:198-199`.
- Comments whose on-the-hour-only or no-choice claims become false:
  - `types.ts:88-91` ("Neither is a parent choice") and :533-538;
  - `answer-oracle.ts:125-129` and :181-182;
  - `invariants.ts:576-577`;
  - `project-request.ts:181-184`;
  - `clock-explorer/definition.ts:8-16` and :38-42;
  - `generator.ts:20-25` and :37-43;
  - `Renderer.tsx:11-17`;
  - `registry.ts:724-725` and :730;
  - `tokens.css:276-281`;
  - `clock-oracle.ts:13`;
  - `registry.test.ts:1221-1222` and :3266;
  - `shipped-profile-options.test.ts:198`.

  The test titles at `accessibility.spec.ts:684` and `packet-session.test.ts:257` are reworded as well.
- Packet code:
  - `packet-session.ts:217-219` (`detailOf`) changes in Step 50 under R1(b).
  - The `"clock-explorer"` row of `RANDOM_PACKET_FOCUS` does not change in Steps 50-51: Step 39's `seedOnly` already supplies the default group, so every clock sheet stays on the hour (R1(c)) and only a leak test is added. Only the docblock's "no practice choice" clause (`random-packet.ts:139-143` today; re-grep after Step 39's five-level rewrite) is reworded.
  - Step 55 replaces the random-packet clock row.
- Every other `src/web/packet/` file spreads `worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2)` (for example `packet-session.test.ts:51` and `PacketPanel.test.tsx:45`), so the new required group needs no hand-written field there (R1(a)).

## Pictures past 20 (Steps 52-54)

### Constants (`frontend/src/shared/worksheet/types.ts`, beside `V1_NUMERIC_MAXIMUM` :47 and `DRY_MATH_NUMERIC_MAXIMUM` :50)

| Constant | Value |
|---|---|
| `COUNT_COMPARE_MAKE_TENS_ONES_MINIMUM` | `V1_NUMERIC_MAXIMUM + 1` (21) |
| `COUNT_COMPARE_MAKE_TENS_ONES_MAXIMA` | `{ "tens-and-ones-to-50": 50, "tens-and-ones-to-100": 100 }` |
| `COUNT_COMPARE_MAKE_TENS_ONES_COMPARE_SPREAD` | 10 |
| `FIND_THE_WOW_ROWS_OF_TEN_MINIMUM` / `_MAXIMUM` | `V1_NUMERIC_MAXIMUM + 1` / 50 |
| `FIND_THE_WOW_DOT_ROW_WIDTH` | 10 |
| `TALLY_DETECTIVE_WIDE_TOTAL_MINIMUM` / `_MAXIMUM` | `V1_NUMERIC_MAXIMUM + 1` / 50 |
| `TALLY_DETECTIVE_BUNDLES_PER_ROW` | 4 (the web `TALLY_VIEW_WIDTH` derives from it) |

- Step 53 does not define the near-miss offsets `[-10, -2, -1, 1, 2, 10]`. It imports `FIND_THE_WOW_NEAR_MISS_OFFSETS` from its one owner, Step 47, and a `toBe` identity test guards against a second literal.
- Never type a bare 20 or 21; derive both from the envelope. No name may end in `_V1_MAXIMUM`, which the envelope guard treats as an alias.
- `V1_NUMERIC_MAXIMUM`, `DRY_MATH_NUMERIC_MAXIMUM`, `TALLY_DETECTIVE_TOTAL_MAXIMUM` (:104) and the ten-frame clamp `MAXIMUM_TEN_FRAME_CELLS` (`InstructionalVisual.tsx:46`) do not change.
- The ranges are not persisted. Changing one later changes documents, so it needs a generatorVersion bump.

### Persisted keys (additive at schemaVersion 2, enum-only, Zod defaults)

| Key | Values | Default |
|---|---|---|
| `countCompareMake.mode` (Step 49) | appends `"tens-and-ones-to-50"`, `"tens-and-ones-to-100"` | `"groups"` |
| `findTheWow.quantity.layout` | `FIND_THE_WOW_DOT_LAYOUTS` | `"fives"` |
| `tallyDetective: {range}` | `TALLY_DETECTIVE_RANGES` | exported `DEFAULT_TALLY_DETECTIVE` = `{range: "to-20"}` (`schema.ts`) |

- **No value above its bound (R3):** every new catalog entry stores maxima of `V1_NUMERIC_MAXIMUM` plus its new member.
- **Round trip:** each key or member gets a `tests/integration/config-api.test.ts` case, following the `describe.each` at :617-667.
  - An explicit PUT reads back through GET and from the stored bytes, with profiles untouched.
  - A v2 file written without the key reads as its default, and its bytes are unchanged after the GET.
  - Each step also saves and reloads its new value once through the compiled app:
    - `count-compare-make.spec.ts` (Step 52);
    - `worksheet-choices.spec.ts` (Step 53);
    - the `visual-math.spec.ts:405` noninterference test (Step 54).
- **Why nested for CCM and Wow:** the focus objects carry the mode, so every `describePracticeFocus` consumer stays truthful with no code change (`GeneratorControls.tsx:311-323`, `EarlierSettingsSummary.tsx:55-72`, `packet-session.ts:199-221`).
  - The Random packet's `countCompare` (`random-packet.ts:107-110`) and `wowQuantity` (:84-90) choices clone a whole catalog focus, so they reset the mode or layout.
  - `wowEquation` leaves the quantity focus unread, because only the quantity variant projects a layout.
  - `canonicalFocus` (`practice-focus.ts:428-458`) must include the mode, or a tens-and-ones focus with maxima of 20 would match "Quantities to 20".
  - Steps 52 and 53 each pin this at the request level in `random-packet.test.ts` (R1(c)). With the parent at the new entry, no level's sheet request carries the new member.
- **Why top-level for Tally Detective:** it has no focus object, so the range is its own group. Step 39's `seedOnly` already supplies the default group, so every packet tally sheet carries `DEFAULT_TALLY_DETECTIVE` at every level until Step 55 (R1(c)); Step 54 edits no `RANDOM_PACKET_FOCUS` row and adds only its leak test.
- **Catalog:** `countCompareCatalog`/`quantityCatalog` (`practice-focus.ts:347-391`) append the constant-derived entries after the preset loop, so existing ids and order are unchanged.
  - The preset-origin test (`practice-focus.test.ts:96-139`) reads only the Dry Math and Count, Compare & Make catalogs. Its CCM loop (:125-134) keeps Step 49's `mode: "groups"` filter, so the tens-and-ones entries are left out by that filter, and the Wow quantity entry is never read; no named-exception list is added.
  - Step 49 splits the two-catalog label pin (:70-77) per catalog. The CCM list then grows by two (Step 52), and the Wow quantity list gains "Dots 21 to 50 in rows of ten" (Step 53).

### Request shape and invariants

`PracticeRequestV1` (`types.ts:225-249`) gains three members:
- `{kind: "count-compare-tens-ones"; mode}`;
- `{kind: "find-the-wow-quantity"; layout: "rows-of-ten"}`;
- `{kind: "tally-detective"; range: "to-50"}`.

A member is projected only when it differs from the default, following the Dry Math "without" precedent.
- Projection: new branches go in `projectWorksheetPractice` before the `!== "dry-math"` return (`project-request.ts:259-293`, :276). Capabilities are at :145-167. `projectedLength` (:296-307) is unchanged.
- Family gate (`invariants.ts:478-505`): every non-bonds, non-grid request passes through `dryMathBranchOf` (:122-145, called at :490), which returns `undefined` for an unknown kind. Each new kind needs its own `...PracticeOf` branch before that call, accepted only on its own family.
- Tally total rule (:594-611): it checks range membership from the request. `answer-oracle.ts:140-160` bounds a tally to 1..`TALLY_DETECTIVE_WIDE_TOTAL_MAXIMUM`; the per-range check lives in the invariant.

### Decoration rows in the print matrix

- `print.spec.ts:897-898` decides `decorationApplicable` by family alone, so every CCM fixture would get a decoration-true row. That would fail the decoration-true regex at `ci-contract.test.ts:82-85` and the hidden-control count at :976.
- Step 52 makes it `getWorksheetRegistration(fixture.selection.worksheetType).controls.getApplicableControls({ selection: fixture.selection }).includeDecorativeGraphics`. `matrix.ts` already imports the registry.
- Every existing fixture keeps today's value: Sentence Builder and the CCM groups, plus Step 49's decorated `count-numerals-100` (operator answer A3).
- Tens-and-ones rows are decoration-false only. The per-cell decoration-true count and the regex stay at Step 49's merged values.

### Count, Compare & Make, tens and ones

| Subtype | Pool over D = 21..max | to 50 | to 100 |
|---|---|---|---|
| match | one candidate per t | 30 | 80 |
| compare | ordered (l, r) ∈ D², \|l−r\| ≤ S, equal pairs included: n + 2(Sn − S(S+1)/2) | 520 | 1,570 |
| complete | (t, p), 1 ≤ p < t, ⌊p/10⌋ ≤ ⌊t/10⌋, p mod 10 ≤ t mod 10: Σ((⌊t/10⌋+1)(t mod 10+1)−2) | 603 | 2,708 |
| draw | one per t | 30 | 80 |

- `enumerateCountCompareCandidates` (`generator.ts:227`) branches on the member, leaving the existing arm and its seed stream (:633-681) untouched. Add `countCompareTensOnesCapacityFormula` beside :321.
- **Match distractors:** in this arm only, after `seededMatchPositions`, draw `nextBounded(2)` twice per selected match: first the ones direction (t∓1), then the tens direction (t∓10).
  - A direction that would leave D flips: t=21 gives 22 and 31, and t=100 gives 99 and 90.
  - Choices go through `placeMatchChoices`.
- **Allocation:** `getCountCompareMakeEffectiveLength(length, scale, mode)` (`definition.ts:96-104`), with consumers at `definition.ts:106-125` and :236, `generator.ts:485` and :614, and `registry.ts:608-612`. No shortage arm is reachable, because the smallest pool (30) exceeds every allocation.
- **Validator** (`generator.ts:471-591`): in these modes it replaces the numeral and comparison limits with D. It requires the inactive quantities skills and no decoration, and enforces the spread, no-trade and match-neighbour rules.

### Base-ten picture (`web/preview/BaseTenPicture.tsx`, an instructional visual)

- The picture has `role="img"`, an `aria-label` and `data-base-ten-value`. The viewBox is W × 10.6 units for every picture.
- Rods are ten touching 1×1 cells (stroke 0.12, rod gap 0.4). Ones follow after a 1-unit gap, as squares with a 0.3 gap, filled top-down in columns of five (at most two columns).
- The widest picture, 99, is about 15.6 units: 34 mm at standard scale and 39 mm at large, so two fit the roughly 85 mm card.
- **Parts wording:** `tensOnesText` in `definition.ts` is the one owner for the key text (`AnswerKeyView.tsx:58-80`) and the `aria-label`.
  - A zero part is left out, and a part of 1 is singular: "1 one", "7 ones", "3 tens", "2 tens and 1 one", "10 tens".
  - Key lines read `N (<parts>)`, for example "1 (1 one)", "30 (3 tens)" and "100 (10 tens)".
  - Zero parts are reachable: a complete answer is `target - partial` (`count-compare-make/generator.ts:361-362`), and partials can be below 10.
- Cards:
  - match shows the picture and three numerals;
  - compare shows two pictures with today's relation words;
  - complete reads "This group needs N in all. Draw the missing tens and ones in the box." over the partial picture and `[data-base-ten-response]`;
  - draw reads "Draw N as tens and ones in the box."
- **Oracle** (`tests/oracles/base-ten-oracle.ts`, written from this text). It reads painted rects:
  - squares whose x centres agree within 0.25 unit form a column;
  - a rod is exactly ten vertically touching squares, and ones are separated squares;
  - all rods precede all ones, with a gap wider than the rod gap;
  - there are at most two ones columns, and the first holds five before the second starts;
  - total = 10·rods + ones.

  Ink checks follow the tally pattern (`print.spec.ts:504-610`).
- **Seed search:** the CCM predicate (`matrix.ts:388-406`) keys its 20-check on `mode === "groups"`. The tens-and-ones branch requires 99 in a compare item and 100 on the page.

### Two Whats and a Wow, rows of ten

- `enumerateQuantityWowCandidates` (`generator.ts:66-90`) branches on the member: targets ascend through 21-50, and pairs ascend over N(t) = {t+o : o in the offsets} ∩ [1, 50], first < second. For example, N(49) = {39, 47, 48, 50}. `constructItems` (:225-252) is reused.
- Validator (:315-464): the numeral is in 21-50, every quantity is in {t} ∪ N(t), and the request uses the inactive quantities skills. Decoration stays refused.
- Renderer (`Renderer.tsx:26-57`): ten grid columns, and every 10n+6th mark gets an extra left margin. The print rule goes after `tokens.css:115-123`, scoped to `[data-dot-layout="rows-of-ten"]`.
- Print checks:
  - mark centres form ten-wide rows;
  - the fifth-to-sixth gap is wider than any other neighbour gap;
  - each check has a calibration that fails on a broken anchor: five columns forced, one mark dropped, or the extra margin zeroed.
- Fit: the measured Letter/standard long page (`.build-step/print-evidence/wow-quantity-letter-standard-decoration-false-worksheet.json`) has 64 px groups ending at 660 of 979 px. Five dot rows (14.1 mm) give about 91 px per group, about 876 px for eight. The Done-when stress proves this.

### Tally Detective to 50

- **Rows:** row r is offset 50r in y.
  - A strip with more than one row carries `data-tally-rows` and an inline `--tally-rows`, and the print rule (`tokens.css:333-337`) sets its height to `calc(var(--tally-height) * var(--tally-rows, 1))`.
  - `physicalViolations` (`print.spec.ts:205-208`) expects `(data-tally-rows ?? 1)` × 20 (22.5) mm per item.
  - A one-row tally keeps today's markup.
- **Key:** `tallyDecompositionText` and `tallyKeyText` (`definition.ts:61-78`) choose the form by total.
- **Labels:** `TALLY_DETECTIVE_RANGE_LABELS` ("1 to 20", "21 to 50", built from the total constants) lives in `tally-detective/definition.ts`, the same owner pattern as `CLOCK_EXPLORER_TIME_STEP_LABELS`. The Range radio, the summary and the packet row all read it (R2).
- **Advice:** `TALLY_DETECTIVE_LIMITING_RESOURCE_ADVICE` (:38-43) becomes `tallyDetectiveLimitingResourceAdvice(range)`: "Tally Detective draws 4 tallies from a fixed set of <n> totals. Choose another Range, or create a new worksheet later." Here n is 20 or 30.
  - The registry (:768-769) reads it from `selection.tallyDetective.range`.
  - It recommends its own control, so the guards at `limit-labels.test.ts:1523-1525` and `math-generation.test.ts:466-468` keep `not.toMatch(/practice focus|length|More options/u)` and add `toContain("Range")`. The comment at `limit-labels.test.ts:1516-1517` and the title at `math-generation.test.ts:446` are reworded.
- **Summary:** "Totals for Tally Detective: <label>." for every range, like Clock Explorer.
- **Packet detail:** "21 to 50" for a to-50 sheet, and no detail at "1 to 20".
- **Oracle:** `oracleReadTally` (`tally-oracle.ts:85-162`) clusters segments into rows by overlapping y extents and reads each row with today's rules. `ORACLE_TALLY_TOTALS` stays, and `ORACLE_TALLY_WIDE_TOTALS` covers 21-50.
- **Seed search:** the tally predicate (`matrix.ts:378-387`) keys 19/20 on to-20. To-50 requires 49, 50, and a total ≥ 41 among items 1-2 and among items 3-4.
- **Calibrations:** the calibration block (`print.spec.ts:1136-1192`) branches on `request.practice`.
  - Its 20/19 calibrations (:1141-1182) run only for the to-20 request.
  - To-50 rows run the three-row calibrations (a first-row upright hidden; a second-row crossing zeroed) and the shared collapsed-strip calibration (:1184-1191).
- **Noninterference:** `registry.test.ts` gives Tally Detective `own: otherTallyDetective` and a `tallyRange` probe. With every family now owning a choice, `own` becomes required and the `own === undefined` branch (:1570-1584) is removed.
- **Fit:** three-row strips are 60 mm (67.5 mm large). Letter/standard pages reach about 224 of 259 mm, and Letter/large about 244 of 259 mm, the tightest case. A4 has 277 mm.

## Design defaults

Each former open question is listed here with the default the steps apply. **Confirmed** means the operator answered it on 2026-10-29 (A1-A4, master row HP5). **Agent default** means the coordinator chose it, and plan-redline can still adjust it (HR1 reviews the result on screen).

### Packet levels (Steps 39 and 55)

1. **What the number in a level's hint covers.**
   - Arithmetic and counting only.
   - Clock Explorer and Tally Detective are left out of `ceiling`, and the scorer returns "not scored" for exactly those two families until Step 55. From then on they are named by their own phrase, like times tables.
   - Status: confirmed (A1).
2. **Do Step 55's Challenge and Expert cells add to Step 39's candidates or replace them?**
   - They replace them for each family in the table, and the Harder column adds. Every family keeps at least one large-print-safe candidate at every level (for Operation Grid, a 10 × 10 grid).
   - Status: confirmed (A2).
3. **Level cells and hint wording.**
   - Step 39's candidates and its Challenge/Expert hints, and Step 55's table and hints, as written in those steps.
   - Status: agent default (HD6), which HR1 keeps or adjusts.

### Arithmetic: Dry Math (Steps 40-43)

1. **Three-digit domain.**
   - Both operands are three-digit (100-999), sums are at most 1,000 and minuends go up to 1,000 (built in Step 41).
   - The alternative also allows two-digit operands.
   - Status: agent default.
2. **Bigger blanks on existing pages.**
   - Today's facts and within-100 pages keep the 4-underscore blank, so existing printed pages do not change.
   - Status: agent default, until M1 physical print reviews them.
3. **Remainder mix and range.**
   - Every problem leaves a remainder of at least 1, and dividends are two-digit only (10-99 ÷ 2-9) (built in Step 43).
   - Status: agent default.
4. **One-digit factor and divisor range.**
   - 2-9, which leaves out ×1 and ÷1 (Steps 42 and 43).
   - Status: agent default.

### Arithmetic: Operation Grid headers (Steps 44-45)

1. **Multiplication cell ceiling.**
   - 999 (three digits). The persisted start bound stays 98, so raising the ceiling later is a refusal-only change.
   - Raise it only after a Letter/large 10 × 10 four-digit row passes the per-cell check and M1 physical print.
   - Status: agent default.
2. **Diagonal first with mixed headers or unequal starts.**
   - Refused, and the positional diagonal invariant is unchanged.
   - Status: agent default.

### Numbers to 100 (Steps 46-49)

1. **Numeral comparison wording.**
   - Words only ("less than / equal to / greater than"), matching the shipped groups wording.
   - Status: agent default.
2. **Wow equations above 20.**
   - "Addition and subtraction" only, from the reviewed presets.
   - Status: agent default.
3. **Wow carrying choice.**
   - "Include problems that carry or borrow" only, and only for within 50 and 100.
   - Status: agent default.
4. **Numerals page length.**
   - Count, Compare & Make's 6/8/10 cards, reusing the length budgets.
   - Status: agent default.
5. **One CCM mode switch.**
   - `countCompareMake.mode` is the single switch. Step 52 appends `"tens-and-ones-to-50"` and `"tens-and-ones-to-100"` to `COUNT_COMPARE_MAKE_MODES` and adds no `pictures` key.
   - Status: agent default.
6. **Does the numerals-to-100 page keep decoration?**
   - Yes, as today's Count, Compare & Make does. Step 49:
     - counts the extra decoration-true print rows;
     - extends the `ci-contract.test.ts` decoration-true regex and count;
     - proves the long page fits with the art panel.
   - Status: confirmed (A3).
7. **Where "Every problem carries or borrows" is offered for Number Bonds.**
   - Only for a range of 10 and up (Step 46), following Step 48's Wow pattern of not offering a choice that cannot fill a page. Within 5 offers only Without and Include, so no shipped catalog cell starves and the "none starves" pins keep empty starving sets.
   - The alternative offers it everywhere and refuses within 5 before Create, which repins the starving sets with 18 cells.
   - Status: agent default (coordinator, master HD7); adjustable at plan-redline.

### Clocks (Steps 50-51)

1. **Half-hour and quarter-hour pages mix in :00 times.**
   - Yes. At least one time per page is new to that step.
   - Status: agent default.
2. **The same hour twice on a page (3:00 and 3:30).**
   - Allowed. Uniqueness is by full time.
   - Status: agent default.
3. **Minute marks on hour, half-hour and quarter-hour dials.**
   - No. Marks appear only for Five minutes and Any minute.
   - Status: agent default.
4. **Fitting 60 marks beside 16/18 pt numbers.**
   - A larger 50/56 mm minute dial, keeping the 16/18 pt print contract (Step 51).
   - Status: agent default.
5. **Packet rows for On the hour.**
   - A row names only Half hours, Quarter hours, Five minutes or Any minute.
   - The selection summary names every step, On the hour included.
   - Status: agent default.
6. **Clock and tally summary conventions.**
   - Both name every choice: Clock Explorer names every step, and Tally Detective names every range, "Totals for Tally Detective: 1 to 20." included (§ Tally Detective to 50, Summary; master Step 54).
   - Status: resolved (aligned to every range).

### Pictures past 20 (Steps 52-54)

1. **Where the harder ranges start.**
   - At 21 (one past the envelope), so the existing modes keep 1-20. This choice is permanent per generatorVersion.
   - Status: agent default.
2. **Tens-and-ones page size.**
   - 8 problems at standard print and 6 at large print, with 2.2/2.5 mm cubes.
   - Status: agent default.
3. **How 100 is drawn.**
   - As ten rods.
   - Status: agent default.
4. **Do tens-and-ones pages keep decoration?**
   - No. Step 52 adds decoration-false rows only. The numerals page differs; see Numbers 6.
   - Status: agent default.
5. **The to-50 tally key form.**
   - "47 = 5 × 9 + 2".
   - Status: agent default.
6. **A second tens-and-ones range.**
   - Step 52 ships both `tens-and-ones-to-50` and `tens-and-ones-to-100`, which Step 55's Challenge and Expert use.
   - Status: agent default.
7. **If eight five-row Wow groups do not fit.**
   - The 4/6/8 budgets stay a hard assertion. A failure stops the step under the phase kill criterion, and the operator then chooses between six groups for long and smaller dots.
   - Status: agent default.

### Phase preconditions

1. **Private reconciliation notes.**
   - They stay outside the checkout at `C:/Users/abero/extra-credit-private/plan-reconciliation/` (moved 2026-10-29), and are never stashed or committed.
   - Status: confirmed (A4).
