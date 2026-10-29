# Visual math expansion: adversarial integration review

Reviewed proposal: [visual-math-expansion-plan.md](visual-math-expansion-plan.md).
Source baseline: `9f9757b7e74b444b302ba182805d051092bac351`, main. Operation Grid remains in a separate active worktree; its implementation is not treated as merged source.

**Outcome:** two independent review findings corrected in the proposal and rechecked by the same independent reviewer. The proposed clocks/tallies scope fits the current architecture. One demonstrated existing full-check blocker remains unresolved: the supplied reference PDF is included in the public export. First-batch selection and plan agreement remain pending. This bounded adversarial review does not certify implementation, physical printing, or the formal master-plan review/redline/wrap gates.

## Method and boundary

A separate fresh-context reviewer read the proposal and actual production/test sources with instructions to challenge integration assumptions. The coordinator independently examined request projection, print fixtures/oracles, config parity, golden-output coverage, CI discovery, and release export/audit. The reviewer was read-only; the coordinator changed only proposal/review documentation. No production code, input asset, master queue, private profile, or concurrent worktree was modified.

## Findings and dispositions

### R1 — Medium: hidden settings could still alter generation requests

Original proposal §6 hid Length and decoration but did not explicitly canonicalize their request values. `frontend/src/shared/worksheet/project-request.ts:279` normalizes Length only for two Sentence Builder modes; line338 forces graphics off only for named existing families. A generator that ignores those fields could produce identical work with different requests depending on previously selected options, violating the existing projection contract.

**Resolution:** proposal §6 now pins length to `standard`, graphics false, inactive math/writing capability values, and absence of topics/decorative topic/practice. Saved choices remain intact for switching back. Tests must compare entire projected requests and educational content after varying unrelated choices. Registrations must report four problems and give exhaustion advice that does not reference hidden controls. VM1/VM2 acceptance includes these obligations.

**Disposition:** addressed at plan level; independently rechecked. Implementation tests still required.

### R2 — Medium: SVG content could disappear without failing the existing print oracle

The original proposal specified visibility and hide/collapse checks. `frontend/tests/e2e/print.spec.ts:321` checks required-node geometry/visibility, and line363 checks CSS border edges. A clock retaining its SVG dimensions and numbers can lose a hand via `stroke:none` or zero stroke width; similarly, a tally bundle can lose its crossing fifth stroke. Its box and text remain visible, but the task becomes wrong or unsolvable.

**Resolution:** proposal §9 now requires family-specific geometry and actual ink checks under print media, including individual hands, tally uprights/crossings, effective opacity, positive stroke width, position/orientation, and containment. Negative calibration removes one required stroke's ink or width while preserving the SVG box, then restores it and requires a clean result. This extends the current harness, not a new screenshot framework.

**Disposition:** addressed at plan level; independently rechecked. Browser/PDF and physical-print evidence still required after implementation.

### R3 — High: reference PDF already blocks the required full check

The initial risk table called asset placement only a future release concern. `frontend/scripts/release-tree.mjs:12` defines export exclusions without consulting Git ignore status; `frontend/scripts/audit-release.mjs:133` rejects every PDF/PNG/JPEG/WebP in the exported tree. `frontend/tests/integration/release-audit.test.ts:26` exports current working-tree bytes and requires a clean initial audit. The untracked supplied PDF therefore blocks ordinary `check` through the existing Vitest integration suite.

Command run:

```powershell
npm --prefix frontend test -- tests/integration/release-audit.test.ts -t 'rejects pdf after the real test source passes'
```

Actual result: exit1; one failed test,67 filtered out. The failure was in `clean()` before any negative fixture injection:

```text
PERSONALIZED_ARTIFACT: docs/examples/extra-credit-math-reference.pdf
```

**Resolution in plan:** promoted to an explicit full-check/build-completion prerequisite. Recommended future resolution is preserving the reference outside the public checkout and updating its locator/hash. A `.gitignore` entry alone does not fix this exporter. A public-PDF exception would be a separate policy change, not an incidental feature fix.

**Disposition:** open, reproduced. Both input files were deliberately left untouched; their SHA-256 hashes still match the proposal. No gate was weakened or represented as passing.

### R4 — Medium: test-tool consumers needed explicit implementation ownership

The original impact table named general print/integration areas but left two important adapters implicit:

- `frontend/tests/integration/practice-golden.test.ts:343` has an exhaustive `Record<WorksheetType,...>` covering-group map. New IDs need `undefined` entries because neither has a legacy settings group; the committed historical grid/hash must remain unchanged.
- `frontend/tests/e2e/print.spec.ts:1288` pins worksheet/key counts; `frontend/tests/integration/ci-contract.test.ts:39` pins discovered print tests and per-cell counts. Adding fixtures without updating these exact counts fails CI. Operation Grid may change the baseline before this proposal builds.

**Resolution:** the impact table, VM1/VM2 acceptance, and §9 now name these consumers and require actual fixture deltas against refreshed source. One fixture per new family expands to four paper/scale worksheet cases and four key surfaces; old mandatory coverage remains. Required-content titles/prompts/key formatting and explicit no-extra-choice helper branches are also owned.

**Disposition:** addressed at plan level by coordinator source verification. No test implementation performed.

## Concerns checked that did not justify new scope

- The print matrix already checks whether the Length locator exists before selecting it (`print.spec.ts:879`); no unconditional Length-helper bug was found there.
- `schema-parity.test.ts` already enumerates `WORKSHEET_TYPE_IDS`; new family enum values do not require a new settings object or schema version. Existing save/read and unknown-enum behavior still need coverage.
- A numeric hour plus family-specific key formatting is sufficient for on-the-hour clocks. Half-hours remain a later explicit design; no time-answer framework is needed now.
- Existing render dispatch, seeded generation, separate parent key, and finite capacity behavior support both new families. No new service, dependency, UI, or orchestration framework is justified.

## Recheck and next boundary

The independent reviewer reread the revised proposal and confirmed R1/R2 addressed at plan level, found no new contradiction, and retained the architecture-compatible assessment. Coordinator checks verified required step fields and unchanged input hashes. No full suite, server launch, or new-family runtime validation was performed.

Before activation: resolve first-batch selection/plan agreement, resolve reference placement, refresh shared-interface evidence after Operation Grid, then integrate accepted steps into the canonical master through its existing review/redline/wrap and issue-publication sequence. Keep the current operator screen-review and acceptance gates intact.
