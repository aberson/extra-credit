# Second UAT feedback and adversarial review

An independent reviewer examined the current source and the operator's printed
Count, Compare & Make screenshot. This is a product review and follow-up backlog,
not acceptance of physical printing or a completed implementation plan.

The strongest finding: choosing today's exercise requires editing the child.
`project-request.ts:197` takes math skills from the profile, and its capabilities
include the profile's writing mode. These belong in worksheet creation; existing
saved values should supply initial defaults during a compatible transition.

## Immediate revision

- Remove the redundant Label-mode header instruction, retaining the actual prompt
  and drawing/label response areas.
- Group Paper size and Print scale in one responsive Print layout row.
- Give Count/Compare printed problems more separation and internal space, replace
  enclosing card borders with quieter top rules, and remove boxes around the
  comparison words in favor of light underlines. Remove the redundant page-level
  directions; each problem retains its own. Preserve text size, instructional
  marks, and writing cells. Final gutters are 4 mm, card separation 2.5 mm,
  internal padding 2 mm; the dense-page ordering checks retain physical bounds.
- Retain attended UAT profiles in ignored `config/uat-session/` storage across
  preview restarts. The disposable `manual:print` test fixture remains disposable.
  The earlier reset was a preview lifecycle mistake, not evidence of production
  storage failure. Do not silently reseed or delete retained UAT data.

## Reviewer recommendations for the worksheet-first revision

1. Make worksheet choice primary. Expose Sentence Builder as Draw & Tell,
   Picture Labels, Copy a Sentence, Finish a Sentence, and Independent Writing.
   Move math practice settings out of profile editing. Keep names/interests in
   profiles; preserve older saved data and use it for initial defaults.
2. Replace Difficulty with explicit Practice focus: operation, numeric range,
   and applicable representation. Current Confidence is 75% of numeric maxima;
   Stretch adds approximately 25%, capped by the activity. It changes neither
   operation nor instructional strategy (`project-request.ts:122–132`).
3. Move personalization and answer-key checkboxes into More options. Keep the
   main worksheet choices visible and use responsive rows for secondary controls.
4. Make Theme explicit and independent of instructional interest support.
   Count/Compare already chooses art from the first projected reviewed interest
   (`count-compare-make/Renderer.tsx:276`); Sentence Builder uses its prompt topic.
   The screenshot's star is the neutral asset, not proof that interest matching
   is absent. Space already has a rocket. Dry Math and Wow currently project
   neither interests nor decorative graphics. Do not inspect private profiles
   merely to explain the screenshot.
5. Continue print review with representative sparse and dense pages, both sizes
   and scales. The old two-column layout used 2 mm gutters, 1 mm separation and
   1.5 mm padding (`styles/tokens.css`); fitting on a page did not establish visual
   clarity. Never fix crowding by reducing instructional font or response sizes.

## Feature backlog and brainstorm

| Candidate | First useful scope | Why it needs a planned change |
| --- | --- | --- |
| Multiplication and division | Selected fact families; exact division without remainders | Define zero handling, bounds, capacity, answers and print behavior. |
| Worksheet packets | Add generated sheets, reorder/remove, choose key placement, print once | Preserve immutable sheets and seeds; handle page breaks and stale settings consistently. |
| Number Bonds / Missing Numbers | Complete an addition/subtraction relationship | Recommended first new family: distinct practice that reuses bounded arithmetic. |
| Skip Counting / Number Patterns | Fill gaps in a bounded sequence | Specify sequence rules and unambiguous missing values. |
| Equal Groups & Arrays | Connect groups to multiplication facts | Best paired with the multiplication contract and instructional diagrams. |
| Place Value Build & Compare | Tens/ones decomposition and comparison | Needs reviewed base-ten visuals and print geometry. |

The coherent next milestone is the worksheet-first flow, replacing the opaque
difficulty control and moving writing/math choices together. Multiplication,
packets and new generators remain recorded additions, not shipped features.
