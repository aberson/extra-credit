# Print verification

The app prints the selected worksheet or its separate parent answer key. Select
**More options** to choose Letter/A4 and standard/large print before creating a
worksheet. Select **Worksheet** or **Parent answer key**, then **Print current
page**. Sentence Builder has no answer key.

Use the selected paper, 100% scale, and browser headers/footers **off**. Keep the
browser's default CSS margins; do not add custom margins or fit-to-page scaling.
Background graphics may remain off: instructions, counters, frames, guides, and
text use black marks and borders on white paper. The decorative-graphics option
only controls the optional art panel.

| Setting | Physical page | Safe margins | Instructional text |
| --- | --- | --- | --- |
| Letter | 8.5 × 11 in | 0.4 in | Standard 16 pt; large 18 pt |
| A4 | 210 × 297 mm | 10 mm | Standard 16 pt; large 18 pt |

Large print uses the generators' existing shorter effective budgets and larger
writing lines, drawing areas, and frame cells. Quantity marks are visual symbols,
not text; the optional doodle caption scales within its reserved panel. Print
styles live in `src/web/styles/tokens.css` and the two dedicated, same-origin
paper stylesheets under `src/web/print/`. Both paper styles are bundled into the
startup stylesheet before the app becomes interactive. No web fonts or pixel
baselines are used.

## Automated gate

From the repository root:

```powershell
npm --prefix frontend run check
```

For print-only iteration (including a fresh production build):

```powershell
npm --prefix frontend run test:e2e -- print.spec.ts
```

`tests/e2e/print.spec.ts` drives the compiled app through the existing ephemeral
server fixture. It loads the three fictional profiles from
`config/children.example.json`, edits boundary data through the real profile UI,
and pins only the random seed. The browser must reproduce the real generator's
items, prompts, banks, and answers. Count/Compare compares every rendered item's
activity, quantities, choices, and target with the boundary document, including
the quantity-20 cases. No manufactured worksheet is injected into React.

The 84 worksheet cases cross every row below with Letter/A4 and standard/large.
Sentence Builder and Count/Compare also cross decoration off/on. Applicable
keys add 16 separate one-page PDF checks, once
per renderer/paper/scale: the key does not consume decoration.
Dry Math and both Wow variants run once per paper/scale; a separate production
session/render test proves a hidden stored decoration-on preference canonicalizes
to false and produces no panel.

Four additional Count/Compare tests sweep 240 real seeds per paper/scale,
including the previously overflowing Long/standard/Letter seed `00000005`.
They cover every target prompt, one/two ten-frames, all one-to-four-row mark
heights, and the two-digit problem prefix. Independent card-height ceilings
bound all 25,200 standard and 2,520 large subtype orders. Separate stress PDFs
place real cards in the worst contiguous order and its reverse, expanding their
minimum heights to those ceilings. These synthetic layout stresses are labeled
separately from actual generator outputs. Print lays intact five-by-two frames
side by side; cell sizes, text and response counts remain unchanged.
Seed and stress PDF/JSON/PNG artifacts live under
`.build-step/count-order-evidence/`, outside the original 100-surface inventory.
The seed-5 negative restores the old stacked-frame/spacing layout and must
overflow in both DOM geometry and an actual multi-page PDF.

| Fixture | Maximum effective work (standard / large) | Boundary content |
| --- | --- | --- |
| Dry Math | 18 / 12 problems | Age-eight within-20 profile |
| Quantity Wow | 8 / 6 groups | Canonical quantities-to-10 profile |
| Equation Wow | 8 / 6 groups | Age-eight within-20 profile |
| Count, Compare & Make | 10 / 8 items | All four subtypes; each reaches quantity 20, including complete/draw frames |
| Draw-and-tell | One prompt | Longest curated prompt; canonical hidden standard length |
| Copy-with-model | One prompt | Longest curated prompt and its required model; canonical hidden standard length |
| Label (two fixtures) | 8 / 6 bank words | Longest prompt; independently, the widest bank by total character count |
| Sentence-frame (two fixtures) | 8 / 6 bank words | Longest prompt; independently, the widest bank |
| Independent (two fixtures) | 10 / 8 bank words | Longest prompt; independently, the widest idea bank |

Every worksheet includes the exact wide-Unicode nickname `"界".repeat(40)`.
Writing-mode and interest edits use only fictional Morgan. Fixture construction
searches bounded real generator outputs for the longest prompt or the complete
set of longest bank entries; a missing match fails rather than falling back.

Each surface uses `page.pdf({ preferCSSPageSize: true })` with backgrounds off.
`pdf-lib` verifies exactly one page and its physical dimensions. Independent
paper dimensions and margins bound the entire surface, including its origin;
the gate checks the surface's computed selected page and its named margin rule. A Letter `page: auto` counterexample must fail even when its PDF retains Letter dimensions. DOM bounding
boxes and text ranges verify the printable extent, group containment, clipping
ancestors, instructional font size, and visible instructional visuals. Each
problem must have exactly one actual `getClientRects()` fragment. Every pair of
groups must be disjoint and follow reading order: down columns for Count/Compare
worksheets, across rows for the other worksheets and all keys.

Independent measurements enforce response geometry in millimetres: writing lines
are 7/9 mm high, ordinary drawing boxes 33/38 mm, draw-and-tell boxes 100/110 mm,
and guide/ten-frame cells 5/6 mm square (standard/large). Lines and drawing boxes
must provide at least 150 mm of usable width. Circle targets stay 4 mm square and
decoration reservations 24 mm square. For large worksheets, the same content is
temporarily measured with standard print styles, then restored; response heights
and cell widths must grow, while fixed reservations must stay equal.

After print media starts, applicable decoration-on rows wait for ready art,
successfully decode its image, and require visible art with no doodle. Off rows
require a visible doodle with no art. The selected state, asset, intrinsic image
dimensions, and physical/scale comparisons enter the JSON evidence.

A fixture-derived manifest additionally checks all required content
after print media is active: titles, nicknames, instructions, prompts, values,
answers, word banks, models, frames, response lines/boxes, and counting marks.
Missing or hidden nodes and empty required text fail. Closed drawing boxes, circle targets, ten-frame containers/cells, and guide containers/cells require all four visible edges (style, width, and nontransparent color); writing lines require their bottom rule. Two standard Letter rows calibrate each required edge across these shape families. Circle targets also require round corners and equal 4 mm dimensions.
Deliberate collapsed writing/drawing/cell dimensions, actual column fragmentation,
stacked/reordered items, print-hidden art/header/answer, clipped text, oversized
sheets, and a wrong Count/Compare seed prove the guards go red. Mutation styles
and the random-source descriptor are restored in `finally`, followed by clean
measurements. A delayed-CSS browser case
clicks Print as soon as its button mounts and checks that both selected paper
contracts are already available at the invocation.
Registered worksheet/key components also render together in Vitest to detect
duplicate document-scoped IDs. Parent controls must be hidden in print media.

Evidence is written only to the ignored `.build-step/print-evidence/` directory:
PDFs, JSON content/page/geometry reports, and screenshots for all 100 distinct
measured surfaces (84 worksheets and 16 keys). These are disposable review evidence, not committed
fixtures. The CI contract discovers the full print matrix through Playwright's
actual unfiltered test entry point and guards against OS skips and pixel baselines.
The Step 1 Ubuntu 24.04 workflow runs that same `check` command. Local Windows
success is not a claim that the first post-push Ubuntu run has happened.

## Fictional manual harness

```powershell
npm --prefix frontend run build
npm --prefix frontend run manual:print
```

Open the exact `http://127.0.0.1:<port>` URL printed by the harness. It imports the
compiled app, selects direct-only `securityMode: "ephemeral-test"`, binds a real
ephemeral loopback socket, and seeds only fictional Riley, Morgan, and Avery from
the committed example. It never opens the family's local config file. Stop with
**Ctrl+C**; the listener closes and its temporary profiles are removed. Restarting
restores the original fixtures. A browser test verifies both the callable lifecycle
and the executable's URL reporting and graceful process-side shutdown. Test-only loader barriers pause the real CLI before imports, after temporary allocation, and during listen; disconnect must be remembered at each boundary and even before entry. Signal events are dispatched inside the CLI because Windows `kill()` forcibly terminates Node; this verifies registered handlers, not physical terminal Ctrl+C delivery. The same tests check socket closure, directory removal, safe error categories, and preservation of a startup failure when cleanup also fails. Cleanup failures remain nonzero and may require removal of the reported test-owned directory by the test runner.

For the Windows physical-print acceptance (M1), use current Microsoft Edge and
Google Chrome. In each browser, create each worksheet family, exercise both paper
sizes and print scales, and inspect Print Preview before printing representative
sheets. For writing modes, edit fictional Morgan's **Writing mode** and save.
For dense pages, choose **Long** in **More options** and use fictional Avery for
within-20 math. Verify one worksheet page, one key page where offered, readable
text, complete groups and writing areas, visible instructional marks with
decoration off, and no parent controls or browser headers/footers on paper.
Record browser version, printer/driver, paper, scale, and observations. Automated
PDF checks do not complete M1's physical-printer acceptance. Physical printing on
other platforms remains best-effort until separately accepted.
