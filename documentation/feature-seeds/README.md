# Feature planning seeds after iterative UAT

These are durable inputs to `plan-feature`, not approved implementation plans or
new build steps. `plan.md` remains the canonical plan. They record the operator's
feedback and distinguish it from recommendations that still need planning.

Start with [01 — Worksheet-first controls](01-worksheet-first.md), then plan
[02 — Math operations and activities](02-math-activities.md) and
[03 — Printable packets](03-printable-packets.md) as separate increments. Packets
can be planned independently but should use the worksheet-selection contract from
01. Do not bundle every idea into one large v1 rewrite.

Suggested invocation from the repository root:

    /plan-feature Use documentation/feature-seeds/01-worksheet-first.md as the seed; read the current implementation and preserve the recorded operator decisions.

## Verified starting point

Extra Credit is a local parent-facing React/TypeScript app with a Fastify loopback
API. Profiles and defaults use a strict versioned JSON schema. Generators are pure
and seeded; immutable worksheet documents contain both problems and their answers.
The browser has no durable child-data storage or network generation service.

The original thirteen automated steps are implemented. UAT revisions added Dry
Math presets for addition/subtraction to 20, mixed work to 50/100, clearer profile
help, fewer redundant writing instructions, grouped paper/scale controls, and a
less crowded Count/Compare print layout. Carrying, borrowing, negative answers,
multiplication, division and packets are not implemented. Quantity/Wow ceilings
remain 20. Writing mode and math capabilities still live in profiles. Difficulty
still changes numeric maxima, rather than selecting a new learning task.

Read [round 1](../uat-round-1.md) and [the adversarial review](../uat-round-2-review.md)
for the provenance of these seeds. The review examined source and a supplied print
image; it was not a comprehensive independent code review of the UAT changes.
Physical printing and family-pilot acceptance remain open.

## Non-negotiable continuity

- Preserve saved profiles and existing settings through any schema transition.
  No silent resets, reseeding, age-based deletion, or implicit conversion that
  overwrites newer-version data. Keep atomic writes, ETags and explicit recovery.
- Never use real family data in tests, logs, screenshots, issues or commits.
  `config/children.local.json` and all recovery copies are private. Attended UAT
  also has ignored retained storage under `config/uat-session/`; do not inspect,
  replace or delete it during planning. Local handoff state owns its launcher.
- `npm --prefix frontend run manual:print` is a disposable fictional-data test
  harness. Do not use it as a persistent home for operator-created profiles.
- Keep all actual instructional content when decoration is disabled. Preserve
  readable font and response-cell sizes; do not solve pagination by shrinking them.
- Keep deterministic generation, finite-capacity checks, exact answer agreement,
  both paper sizes/scales, and explicit unavailable states.
- No new runtime AI, cloud service, accounts, dependencies or asset licenses are
  implied by these requests.

## Source map and validation

Read the producers before designing changes:

- `frontend/src/shared/config/schema.ts`: persisted profiles/defaults and enums.
- `frontend/src/shared/config/math-presets.ts`: presets and age suggestions.
- `frontend/src/shared/worksheet/project-request.ts`: profile-to-request boundary,
  difficulty scaling, topic allowlist and applicable-option normalization.
- `frontend/src/shared/worksheet/types.ts`, `invariants.ts`, `registry.ts`: generated
  document/request contracts, invariants, families and capability checks.
- `frontend/src/web/generator/GeneratorControls.tsx` and `src/web/worksheets/registry.ts`:
  selected controls, availability, effective counts and stale-preview behavior.
- `frontend/src/web/profiles/`, `src/web/preview/`, `src/web/styles/tokens.css`:
  profile UI, print surfaces and physical layout.
- `frontend/tests/e2e/print.spec.ts` and `tests/fixtures/print/`: real PDF/content,
  independent geometry, ordering and negative-calibration checks.

Paths beginning `src/` or `tests/` above are relative to `frontend/`. Run narrow
tests while iterating, then `npm --prefix frontend run check` before declaring a
combined feature ready. The full command includes lint, three TypeScript checks,
unit/integration tests, compiled browser tests and log-privacy calibration.
`npm --prefix frontend run release:verify` audits an export and checks a clean room.
Seed documents intentionally leave design choices for `plan-feature`; they do not
authorize skipping its review, redline, wrap or acceptance workflow.
