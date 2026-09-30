# Educational basis and scope

This document records the published sources that bound the reviewed examples in
Extra Credit's four version 1 worksheet families, and the limits of what those
sources are being used for. It is the human-readable companion to
[`plan.md` Section 12.5](../plan.md) and covers `dry-math`, `find-the-wow`,
`sentence-builder` (all five writing modes), and `count-compare-make`.

## What this document is, and is not

Extra Credit generates printable practice pages from the worksheet choices a
parent makes: the worksheet type, its variant, and a practice focus or
vocabulary. It is a worksheet generator, not a curriculum, not a program of
study, and not any kind of test.

- **Not a curriculum.** Nothing here sequences instruction, sets pacing, or
  claims coverage of a course of study. A parent chooses the family, its
  variant, the practice focus or vocabulary, the length, and the options.
- **Not an assessment.** No page is scored, timed, banked, compared with a
  norm, or retained. The parent answer key exists so an adult can check one
  printed page, and generated documents are never stored.
- **No fluency claim.** Nothing in this application measures automaticity,
  rate, or recall speed, and no output should be read as evidence of any.
- **No intervention claim.** The Institute of Education Sciences practice
  guides cited below bound the shape of reviewed examples. They do not make
  Extra Credit an intervention, and it must not be used as one.
- **No placement claim.** Ages 4–8 select setup suggestions only. Age never
  asserts a grade, a placement, a readiness verdict, or a reading or maths
  level. The parent's explicit worksheet choices, not age, decide what is
  generated.
- **No mastery claim.** A completed page records that a child did that page.
  It does not establish that any skill is learned, retained, or transferred.
- **Grade-level source labels are provenance, not verdicts.** Where a source
  below carries a grade in its title, that names where the published example
  came from. It never describes the child who receives the page.

If a decision needs any of the judgements above, it needs a qualified human
who knows the child. This application is not part of that judgement.

## The version 1 generation envelope

Every generated page, in every family, stays inside one fixed envelope:

| Bound | Value |
|---|---|
| Supported ages | 4 through 8. A profile outside that range stays saved and editable, and generation returns `GENERATION_AGE_UNSUPPORTED`. |
| Numeric range | The practice focus the parent chooses states it in words. Dry Math offers addition and subtraction ranges up to 100; every quantity, numeral, operand, and result in the other families stays at most 20. |
| Sign | Nonnegative. No generated result is below zero. |
| Regrouping | None. No generated addition carries and no generated subtraction borrows. |
| Personalization | A nickname and reviewed interest topics only. Raw unmatched interest text never reaches a request or a page. |
| Locality | Generation is deterministic local code. The page talks to nothing but its own loopback server on 127.0.0.1: no account, no off-device request, no runtime model, and no telemetry. |

A child's earlier settings, kept from a file an earlier version saved, keep
their stored maxima and future permission flags. While they supply that
child's starting choices, the panel names any value it clamps to a family's
range and any permission it does not use; neither can widen generation.

## Sources by family

### `dry-math` — Dry Math

Symbolic addition and subtraction within the chosen practice focus, from
addition within 5 up to addition and subtraction within 100, without carrying
or borrowing and without negative results.

- [Common Core Kindergarten Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/K/OA/)
- [Common Core Grade 1 Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/1/OA/)
- [Common Core Grade 2 Operations and Algebraic Thinking, including fluency within 20](https://www.thecorestandards.org/Math/Content/2/OA/B/2/) — cited only to bound the within-20 example range. Extra Credit does not measure fluency.
- [IES Teaching Math to Young Children](https://ies.ed.gov/ncee/wwc/practiceguide/18)
- [IES Assisting Students Struggling with Mathematics: Intervention in the Elementary Grades](https://ies.ed.gov/ncee/wwc/practiceguide/26) — bounds reviewed example shapes only. Extra Credit is not an intervention.

Dry Math always practices equations. Its practice focus names the operations
and the range, so whether a page can be created depends on the worksheet
choices alone, not on which child is selected.

### `find-the-wow` — Two Whats and a Wow

Three statements per group, one of which is true; the child circles it. The
family has two variants, and the parent chooses one under Statements: Quantity
pictures or Equations. Each variant has its own practice focus.

- Quantity pictures — numeral-and-dot statements: [Common Core Kindergarten Counting and Cardinality](https://www.thecorestandards.org/Math/Content/K/CC/) and [IES Teaching Math to Young Children](https://ies.ed.gov/ncee/wwc/practiceguide/18).
- Equations — true and false equations, for a child who understands
  equality: [Common Core Kindergarten Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/K/OA/) and [Common Core Grade 1 Operations and Algebraic Thinking](https://www.thecorestandards.org/Math/Content/1/OA/).
- Selecting a correct answer among close alternatives as a recognition format:
  [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/).

### `count-compare-make` — Count, Compare & Make

Counting, comparing, completing, and drawing groups, with no symbolic
arithmetic required anywhere. This is the age-four-friendly path.

- Counting a group, matching a numeral to a quantity, comparing two groups as
  greater than, less than, or equal, and building a group to a requested count:
  [Common Core Kindergarten Counting and Cardinality](https://www.thecorestandards.org/Math/Content/K/CC/).
- Concrete and pictorial quantity work before symbols, and structured
  arrangements such as ten-frames: [IES Teaching Math to Young Children](https://ies.ed.gov/ncee/wwc/practiceguide/18).
- Wide developmental variation at these ages, which is why the parent's
  worksheet choices rather than age decide the generated work:
  [Head Start Early Learning Outcomes Framework](https://headstart.gov/interactive-head-start-early-learning-outcomes-framework-ages-birth-five)
  and [NAEYC Developmentally Appropriate Practice](https://www.naeyc.org/resources/position-statements/dap/core-considerations).
- Accepting a drawn response as a legitimate way to show an answer:
  [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/) and
  [AAP Power of Play](https://www.healthychildren.org/English/family-life/power-of-play/Pages/the-power-of-play-how-fun-and-games-help-children-thrive.aspx).

The practice focus sets the counting, numeral, and comparison ranges.
Numeral, completion, and drawing work stays within
`min(countingMax, numeralMax, 20)`; comparison work stays within
`min(countingMax, compareMax, 20)`. Dots, ten-frames, shapes, and drawing
guides are instructional visuals, so the decorative-graphics toggle never
removes them.

### `sentence-builder` — Sentence Builder, by writing activity

One prompt per page. The writing activity the parent chooses selects the
response the page asks for; the length setting changes word-bank breadth and
response space, not the number of prompts.

| Writing activity | What the page asks for | Primary sources |
|---|---|---|
| Draw & Tell (`draw-and-tell`) | Draw, then tell an adult about the picture | [Common Core Kindergarten Writing](https://www.thecorestandards.org/ELA-Literacy/W/K/) (drawing, dictating, and writing are all named response forms) · [Head Start Preschool Literacy](https://headstart.gov/school-readiness/article/literacy-preschool) · [AAP Power of Play](https://www.healthychildren.org/English/family-life/power-of-play/Pages/the-power-of-play-how-fun-and-games-help-children-thrive.aspx) |
| Picture Labels (`label`) | Draw, then write labels on ruled lines using a reviewed word bank | [Common Core Kindergarten Writing](https://www.thecorestandards.org/ELA-Literacy/W/K/) · [Head Start Preschool Literacy](https://headstart.gov/school-readiness/article/literacy-preschool) |
| Copy a Sentence (`copy-with-model`) | Copy one reviewed model sentence onto copy lines | [IES Foundational Reading Practice Guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/21/Published) · [Head Start Preschool Literacy](https://headstart.gov/school-readiness/article/literacy-preschool) |
| Finish a Sentence (`sentence-frame`) | Finish a validated sentence frame on writing lines | [Common Core Grade 2 sentence production](https://www.thecorestandards.org/ELA-Literacy/L/2/1/f/) · [Common Core Grade 2 Writing](https://www.thecorestandards.org/ELA-Literacy/W/2/) |
| Independent Writing (`independent`) | Draw, then write independently with an optional idea word bank | [Common Core Grade 2 Writing](https://www.thecorestandards.org/ELA-Literacy/W/2/) · [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/) |

Every Sentence Builder item is open: it carries no objective answer and never
appears in a parent answer key. The writing activity is the parent's explicit
worksheet choice. The Vocabulary choice limits which prompts appear: "Simpler
words — for beginning readers" uses the `preschool` prompt set, whose
Independent Writing prompts ask for writing supported by an idea bank rather
than multi-sentence work, and "Include longer words" uses the `early-primary`
set. A parent who chooses Independent Writing with simpler words still gets an
independent-writing page.

## Cross-cutting sources

- Developmental range and individual variation across ages 4–8:
  [Head Start Early Learning Outcomes Framework](https://headstart.gov/interactive-head-start-early-learning-outcomes-framework-ages-birth-five)
  and [NAEYC Developmentally Appropriate Practice](https://www.naeyc.org/resources/position-statements/dap/core-considerations).
- Adult-chosen rather than adaptive difficulty, and the parent's role in
  selecting the work: [NAEYC curriculum planning](https://www.naeyc.org/resources/position-statements/dap/planning-curriculum).
- Multiple acceptable response forms — circling, drawing, dictating, labelling,
  copying, writing: [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/).
- Accessible printed output, including a text alternative for every
  instructional visual and an empty alternative for every decorative image:
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## How to read a generated page

A generated page is one adult-selected practice sheet. Treat what a child does
on it as one observation on one day, made under whatever conditions that day
supplied. It is not a measurement, and nothing in this application converts it
into one.
