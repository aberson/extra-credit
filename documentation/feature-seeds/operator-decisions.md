# Operator decisions for the post-UAT feature plans

Recorded 2026-09-29 from the planning session that turned the three feature
seeds into implementation plans. `P` items are explicit operator choices and
are binding on the plans. `D` items are agent-recommended defaults that the
plans adopt unless the operator changes them at redline. This file is a
public planning record and contains no profile data.

## Operator choices (P)

| ID | Choice | Applies to |
| --- | --- | --- |
| P1 | Worksheet choices (type, variant, practice focus, theme, layout) persist as **global worksheet defaults saved explicitly** through the existing "save as worksheet defaults" action. Current selections live in session state and survive profile saves. No per-child attributes recreate the old coupling; no write on every Create. | 01 |
| P2 | **Age is removed entirely** from profiles. The 4–8 generation gate goes away; capability checks own availability; help text states the content is designed for early primary. The v1 backup written at the first v2 save retains the old value. | 01 |
| P3 | First multiplication/division increment: **factors 0–12, dividends through 144**, parent-selected fact families, exact division only, no remainders, divisor never zero. 3×4 and 4×3 are distinct facts. | 02 |
| P4 | Packets are **durable local drafts**: a versioned, private, gitignored local draft store with its own ETag precondition, atomic writes, explicit recovery, and release-export exclusion. | 03 |
| P5 | The first new activity family is **Number Bonds / Missing Numbers**. | 02 |
| P6 | **Carrying/borrowing is included in plan 02** as an explicit Dry Math capability, not inferred from old permission flags. | 02 |
| P7 | The unattended run builds **all three plans in dependency order**, each gated on the previous plan's full gate; later plans are re-checked against what actually shipped before they are built. Any halt parks the remainder. | run |
| P8 | After each increment passes its full gate, repo-update **commits and pushes** so the exact commit gets Ubuntu CI evidence. | run |

## Agent defaults adopted (D), tweakable at redline

- D-schema: a real `schemaVersion: 2` with a v1 read path. The file is rewritten to v2 only on the first explicit save, never on read. Newer versions remain blocked, recovery stays backup-first, and legacy per-child writing mode, math preset and presentation band ride along to seed that child's initial worksheet choices.
- D-difficulty: Difficulty is replaced by explicit Practice focus (operations, numeric range, applicable representation) with no hidden multiplier. Two Whats and a Wow gains an explicit Quantity / Equations variant because Confidence currently switches it to quantity mode silently.
- D-writing: Sentence Builder exposes five public variants (Draw & Tell, Picture Labels, Copy a Sentence, Finish a Sentence, Independent Writing) over one internal generator, plus a plain-language vocabulary option that replaces the presentation-band terminology.
- D-theme: an explicit Theme selector (From interests, the reviewed topics, Neutral) for the families that decorate today. Dry Math and Wow remain undecorated in plan 01; thematic instructional symbols are a separate later change.
- D-print: no further Count/Compare print iteration in plan 01; comparison-prompt and isolated-numeral review moves to M1 physical evidence.
- D-packet: maximum 10 sheets per packet, one packet-wide paper/scale layout that re-renders immutable documents without changing their problems, grouped answer keys at the end by default with a per-packet placement choice, sheets from different children allowed, printing never clears the queue.
- D-flags: build steps reuse the reviewer and start-command flags of the shipped steps, keep the default iteration budget, and never extend it.
- D-numbering: plan 01 numbers steps from 14, plan 02 from 21, plan 03 from 28, so issue titles never collide across plans.

## Run-time safety notes

- Other Claude processes were alive when the run was armed; no commit by another session had landed within the previous hour and ports 4310/4311 were free. Any other window on this repository must stay idle during the run.
- `config/children.local.json`, its recovery copies and `config/uat-session/` are never read, changed or used by the plans or the run.

## Coordinator rulings after the plan 01 critique (D, recorded 2026-09-29)

These resolve contradictions the adversarial critique found. They are agent
rulings under the operator's delegation of routine choices, tweakable at redline.

- D-save: once the worksheet-first panel exists, the explicit "save as worksheet defaults" action writes exactly the visible selection, seeded groups included, and turns off earlier-settings seeding. Before the panel lands, the interim save passes existing groups through unchanged. No re-enable control ships; a parent who wants a child's earlier choices picks them in the controls before saving. Stored legacy choices are retained, never deleted.
- D-interim: intermediate states inside plan 01 (before its panel step) may keep editing legacy choices through the profile editor so every step stays usable and fully gated. P1 holds at the end of the last code step. This is sequencing, not an exception to P1.
- D-split: plan 01 uses its spare step slot so no single step carries both the module refactor and the persisted-shape change. Plan 01 is Steps 14–20; plans 02 and 03 still start at 21 and 28.
- D-pregate: the run must not begin while `config/children.local.json` or any `children.local.json.*` sibling exists in the main checkout, because runtime reviewers start the dev server from that checkout. At 5c22159 the file was absent (metadata check only). The retained UAT launcher stays stopped for the whole run. Any such file that reviewer sessions create during the run is reported in the morning summary and left for the operator; agents never delete it and never open `config/uat-session/`.
- D-pointer: every step's Problem field begins by pointing the developer at this plan file and the sections it must read, because build-step forwards only Problem and Done-when.
- D-scripted-evidence: any evidence a step's Done-when relies on (golden captures, digests, calibrations) comes from a committed re-runnable script; DONE never depends on what a reviewer chooses to do.
- D-foundation: the fixed development-stack browser check keeps its health-proxy and `/@fs/` rejection assertions but no longer asserts page layout against whatever file sits at the canonical config path; the 1920×1080 no-scroll assertion moves to the ephemeral compiled fixture path, where it runs deterministically against the empty state and the canonical fictional profiles. This keeps the DONE gate independent of any fictional file a runtime reviewer creates in the main checkout, and keeps `npm run check` runnable for an operator who has a real local file. Landed in plan 01's first step.
- D-pointer (amended 2026-09-29): the Problem pointer sentence names the plan file and the sections to read as the specification, not as an exhaustive allowlist. A developer may touch files a step's Files list omits when a gate or an existing test requires it, and records each such file in the step checkpoint; reviewers treat an omitted file as a plan-accuracy note, never as a defect by itself. Each step's Files list still names every file the plan knows it must change.
- D-planindex: the pointer section appended to the end of `plan.md` ("Post-UAT feature plans") is kept and committed with the plans. It follows the workspace convention that one canonical entry plan may point to sub-plans, adds no plan-line citation, moves no cited line, and leaves Steps 1–13 and their history untouched. No later step, wrap or repo-update edits `plan.md` except the status lines build-phase writes in the sub-plans themselves.
- D-uatbackup: the mandatory pre-run condition on the retained attended-UAT store is that its launcher is stopped for the whole run (verified by the free fixed ports and the absence of a retained preview process) and that no agent ever reads, copies, moves or deletes `config/uat-session/` or the launcher's TEMP file. A dated private backup of that store is a recommended operator action before the operator first opens any build from these plans against it, not a precondition agents can satisfy, so it moves to the morning checklist.
- D-bonds-ten (plan 02, resolves its open D22): default Number Bonds pages exclude sentences whose missing part requires crossing ten (column regrouping); crossing-ten bonds become available only when the parent enables the same explicit regrouping capability that governs Dry Math carrying and borrowing (P6). Capacity, availability and page-length advice are computed on the filtered pool. This keeps "regrouping only when the parent chooses it" consistent across families; widening the default is a redline tweak.
