Reviewing as: feature plan. Sections 17–21 apply.

Plan: `docs/plans/visual-math-expansion-plan.md`
Invocation: `/plan-review --autofix docs/plans/visual-math-expansion-plan.md` within plan-expedite.
Baseline: `9f9757b7e74b444b302ba182805d051092bac351`. This review ran in the authoring session; it is not an independent review. The earlier independent adversarial review remains separately documented.

## Blockers

### B1. Draft step identifiers are not build-parser compatible; canonical integration is still outstanding

The proposal at lines126–150 uses `### Step VM1:`, `VM2`, and `VM3`. The required `^#{3,4} Step \d+:` check returned zero matches. The three draft blocks have Problem/Type/Issue/Files/Produces/Done when/Depends on fields, but the heading-based walker cannot discover them. Blank Issue fields are expected before repo-sync and are not this defect.

The proposal itself says at line7 that the master owns dispatch and at line128 that these IDs are not master reservations. Its handoff at line198 requires integration before publication. Therefore renaming the draft to an independent numbered queue would not resolve the canonical-plan conflict. Integrate the accepted slices using free master IDs and preserve existing gates, then review that execution target. This exceeds plan-review's enumerated autofix classes and would edit another project file.

`git worktree list` found an active Operation Grid worktree; its `git status --short` includes modifications to `docs/plans/master_plan.md`, the shared worksheet/config interfaces, renderers, print tests, and CI/golden tests. Do not overwrite or race that work. The project's `.plan-expedite-state` also belongs to that master run and is halted at task-handoff after repo-sync for Step34/#42. Its completed stages are not evidence for this proposal.

### B2. The reference PDF prevents the required check from passing, with no executed resolution

Proposal line170 explicitly records the unresolved full-check blocker. `frontend/scripts/release-tree.mjs:13` supplies export exclusions without consulting Git ignore status; `frontend/scripts/audit-release.mjs:136` rejects PDFs in that export. The file `docs/examples/extra-credit-math-reference.pdf` is still present with SHA-256 `913dd599f8a9f9b36d4ffc2fe2a1a188a3fcb7770b31dc51c192f53d3fb41e10`.

The focused test run recorded in the preceding adversarial review failed in the initial clean-export check, before its injected negative fixture:

```powershell
npm --prefix frontend test -- tests/integration/release-audit.test.ts -t 'rejects pdf after the real test source passes'
```

Result: exit1, `PERSONALIZED_ARTIFACT: docs/examples/extra-credit-math-reference.pdf`. This review verified unchanged source/file state rather than repeat the same failure. Every code step requires full check, so this cannot be left as a release-only note. Recommended resolution remains preserving the reference outside the exported checkout with a verified hash and updated locator. No input files were moved and no audit exemption was introduced. File relocation is outside plan-review's allowed writes.

## Significant gaps

- **Setup is not self-contained (§6/§8/§16).** The proposal includes build, manual print, tests, lint, and typecheck but omits install and dev commands and exact runtime requirements. `frontend/package.json` specifies Node `>=24.0 <25`, npm `>=11 <12`, and the `dev` script. Existing README/CLAUDE document `npm --prefix frontend install`, `npm exec --prefix frontend -- playwright install chromium`, and `npm --prefix frontend run dev`. Add a compact fictional-environment quickstart during canonical integration; retain the no-real-profile and fixed-port preflight rules. No new technology choice is needed.
- **Draft status needs reconciliation before dispatch (§7/§19).** The file still says “first-batch selection and plan agreement pending,” “Await operator selection,” and “not dispatchable.” The current command clearly authorizes preparation of this named proposal; this review does not ask again whether to run the stages. Reconcile those stale drafting statements when integrating the selected scope, without silently authorizing feature implementation or marking manual acceptance complete.

## Missing items

None beyond the concrete setup material above. All39 paths in the proposal's existing-consumer appendix were verified to exist. Clock/tally directories are explicitly proposed new files, not falsely claimed existing modules. The existing producer files support the described app, request projection, immutable answer document, and print dispatch.

## Nice-to-haves

- The supporting proposal is not a discoverable canonical progress plan and has no `**Status:**` fields. That is intentional while it is a draft; integration into the master should provide canonical numbered status-bearing units and retain the master's objective.
- `uv run --project ../dev-observatory observatory ports` exited0 with an empty port map and no collisions. This does not prove the documented app ports are registered or free on the OS; no registry change is needed for this review.
- Blank `**Issue:** #` is correct before publication. Repo-sync must populate the eventual canonical steps before build-phase.

## Check coverage

| Checks | Result / evidence |
|---|---|
| §1 persistence, §9 deduplication | Existing explicit-save v2 config, session-only documents, finite candidates and duplicate rejection are specified; no new store. `schema.ts`, `invariants.ts`, and `create-session.ts` support this approach. |
| §2 external integrations, §3 auth/secrets | No new external service or credentials. Existing loopback boundaries retained. |
| §4 concurrency | Concurrent master/source edits and orchestration state identified in B1; no writes to them. |
| §5 errors | Fixed-domain exhaustion advice and fail-closed validation are explicit; no nonexistent range remedy. |
| §6 build, §8 setup, §14 operations, §16 fresh context | Commands present are supported by package scripts; setup omissions surfaced. Disposable harness and Ctrl+C shutdown are described. |
| §7 unresolved alternatives | “Await operator selection” and “first-batch selection and plan agreement pending” are stale draft statements to reconcile; “Tens Builders ... plus Growing Patterns” is explicitly an alternative, not extra required scope. “ClockFace.tsx and TallyMarks.tsx if separating drawing makes the renderer easier to read” is a routine file-organization choice. “around40mm ...45mm ... adjustable design targets” is explicitly bounded by print verification, not an unresolved architecture. Public-PDF exception versus external placement remains B2. No literal TBD or unfilled angle-bracket step sentinel found. |
| §10 integration, §13 tests, §15.5 smoke | Projection, oracle, family registry, print/key, config parity, golden map and CI matrix deltas are owned. VM1/VM2 specify the real compiled app before VM3. |
| §11 scope, §21 sizing | Two code vertical slices and one operator trial are appropriate; remaining activities are a mapped backlog. No platform rewrite. |
| §12 security | Private data boundaries retained; inline geometry avoids remote assets; no fetched-content-to-LLM or unsafe startup change introduced. |
| §15 autonomous observation, §26 deployment seams | Not triggered: parent-action generation only, no new scheduled/always-on component or deployment/auth wiring. Existing app startup is not a newly introduced deployment seam. |
| §17 existing-code validation |39 consumer paths exist; `types.ts:14` lists current families, `types.ts:202` supports numeric answers, `create-session.ts:113–116` looks up registration then projects the request. Print and audit claims checked against actual source. |
| §18 impact completeness | Previously found request normalization, SVG ink, golden mapping and CI-count requirements are now explicit. No new missing consumer established in this pass. |
| §19 conflicts, §20 context | Master ownership and concurrent Step34 integration remain B1. Architecture summary is adequate for a feature, subject to setup additions. |
| §22 operator/code split | VM3 produces private observations, no code; VM1/VM2 have machine-verifiable acceptance, not hidden human approval. No split required. |
| §23 conditional predicates | No conditional steps. |
| §24 reviewer fields, §27 stakes | Existing master §6 code-review lane is retained. Additive family enum members, existing numeric answers, no new persisted key shape/migration/auth change; no newly established high-stakes substrate redesign requiring flag rewrite. SVG correctness is covered by explicit independent geometric expectations and negative tests. |
| §25 parser compatibility | Fails: zero numeric Step headings; B1. |

Verdict: NEEDS WORK: 2 blockers, 2 items need input

2 items need your input:
  - B1: Resolve canonical integration after the active Operation Grid work releases the master; use available numeric IDs and re-run review on that target. This is an outstanding preparation task, not a request to repeat the already-given plan-expedite authorization.
  - B2: Resolve the reference-PDF placement before the required check; recommended action is preserving it outside the checkout with a verified hash and updated references, rather than weakening the export audit.
