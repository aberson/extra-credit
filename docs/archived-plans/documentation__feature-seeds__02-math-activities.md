# Seed 02: higher math skills and distinct worksheet activities

Read [the shared starting point](README.md). The operator requested multiplication,
division, more representations and more worksheet types, allowing backlog/planning
where needed. Specific fact limits and the first new family remain recommendations.

## Recommended increments

First add bounded multiplication facts and exact division to the worksheet-level
practice selection from seed 01. Start with selected fact families; a suggested
planning default is factors 0–12 and dividends through 144, but this is not an
operator-approved ceiling. Do not reuse the addition/subtraction 100 ceiling by
accident. Exclude division by zero and remainders in the first increment; define
zero as a dividend separately and keep negative results outside scope.

Then add one distinct activity rather than a large batch:

| Candidate | Child task | Recommendation |
| --- | --- | --- |
| Number Bonds / Missing Numbers | Fill a missing part of an addition/subtraction relationship | First new family: useful variation with reusable arithmetic validation. |
| Skip Counting / Number Patterns | Fill missing values in a bounded regular sequence | Keep one unambiguous rule and enough given values. |
| Equal Groups & Arrays | Count groups/rows and connect them to a multiplication fact | Pair with multiplication and reviewed instructional diagrams. |
| Place Value Build & Compare | Compose/decompose tens and ones, then compare | Requires base-ten visual design and response geometry. |

Brainstorm candidates are not all approved for one build. Mini Mission and runtime
AI remain separate future concepts; do not silently fold them into this request.

## Producer constraints to investigate

The current operation enum, transport/profile validation and math presets support
addition/subtraction. Dry Math enumerates legal pairs with no carry/borrow and
capacity checks, while the shared invariant dispatch verifies objective answers.
New operations touch schemas, presets, request projection, capacity advice,
generators, invariants, renderers, keys, registry controls and tests together.

Preserve generator-version/seed semantics: define whether normalization or content
changes require a new generator version, and test older supported requests.
Specify fact uniqueness (whether 3×4 and 4×3 are distinct), division identities,
operand orientation, zero rules and finite capacity before allowing long pages.
Do not increase quantity/ten-frame limits to accommodate symbolic products.

For Number Bonds, decide missing-part positions and answer type; each problem must
have exactly one intended answer, enough writing space and no unintended negative
value. For sequences, disallow patterns whose visible terms admit ambiguous rules.

## Acceptance material to require

- Independent arithmetic oracles over boundary and zero cases, plus seeded variety.
- Availability and page-length choices agree with actual unique candidate capacity;
  no duplicate work or silent widening to another operation or skill range.
- Worksheet and key consume the same immutable document; division symbols, blank
  positions and explanatory diagrams remain unambiguous in monochrome print.
- Both paper sizes/scales cover maximum-width expressions and maximum response
  shapes, including mixed packets later. Reviewed artwork provenance remains intact.
- Legacy profiles remain readable and existing addition/subtraction content retains
  its stated semantics. New enums never make recovery overwrite a newer config.

Carrying/borrowing is another requested expansion direction but not implicitly
included in multiplication/division. Plan it as an explicit capability/content
change if selected; do not reinterpret old ignored permission flags as consent.
