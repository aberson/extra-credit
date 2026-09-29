# Seed 01: choose the work before configuring the child

Read [the shared starting point](README.md) first. Goal: a parent can choose a
worksheet, its skill focus and presentation without repeatedly editing a child.

## Operator-requested outcomes

- Make Worksheet type the major choice and use available screen space better.
- Move Writing mode from the child profile into Sentence Builder variants.
- Move Math capabilities from the child profile into worksheet settings.
- Replace the current Difficulty behavior with something more useful; the operator
  invited recommendations rather than choosing a new difficulty algorithm.
- Group paper/scale and place the personalization checkboxes under More options.
  Paper/scale grouping already shipped; checkbox movement remains unbuilt.
- Make decorative artwork visibly relate to interests.
- Remove age unless it genuinely controls generation. It currently supplies setup
  suggestions and an eligibility gate (4–8 inclusive), not the learning content.
- Preserve profiles across UAT/restarts and schema changes.

## Recommended design, not yet an approved schema

Lead with worksheet/variant, followed by child, then explicit Practice focus.
Sentence Builder variants: Draw & Tell, Picture Labels, Copy a Sentence, Finish a
Sentence, Independent Writing. These may remain one internal generator with five
public selections; do not multiply internal worksheet IDs solely for UI labels.

Replace Confidence/Practice/Stretch with explicit operations, ranges and applicable
representations, reusing preset expansion. Current difficulty multiplies selected
numeric ceilings by 0.75 or adds approximately 25%; it does not select a new skill.
Example: select Copy a Sentence today and Picture Labels tomorrow without changing
the child; select Addition within 20 then Mixed within 100 in worksheet controls.

Keep child identity/nickname and interests in profiles. Preserve older math,
writing-mode and presentation values as initial defaults during migration until a
documented compatibility policy supersedes them. Explain vocabulary support with
plain language rather than exposing the old Presentation band terminology.

Use an explicit Theme setting based on reviewed interests. Current Count/Compare
art uses the first projected topic; Sentence Builder uses its generated prompt
topic; both fall back to neutral. Dry Math and Wow disable decoration today.
Separate topic selection for decorative art from instructional content support.
Reusing the reviewed rocket/tree/cat/etc. is a first increment; thematic counted
symbols are a separate instructional-visual change, not a decorative substitution.

## Planning decisions to resolve

1. Where worksheet preferences persist: global defaults, last-used per family, or
   named reusable settings. Select one deliberately; avoid introducing new child
   attributes to recreate the old coupling.
2. Versioned migration versus retaining the old fields as compatibility defaults.
   Enumerate create/edit/reload/recovery/newer-version behavior before removing UI.
3. Remove age from active setup/gating without pretending unreviewed content has
   become age-appropriate. Reconcile schema, support helper, API fixtures, UI and
   documentation as one change; capability checks should own availability.
4. Topic precedence with multiple interests, unmatched text and graphics disabled.
   Resolve theme scope for Dry Math/Wow without leaking raw unmatched tags into
   normalized requests or changing educational answers.
5. Whether the cleaner print content needs another focused iteration. The UAT fix
   removed generic Count/Compare header directions and reduced borders; comparison
   prompts and occasional isolated target numerals still warrant visual review.

## Acceptance examples for the eventual plan

- A stored v1 profile reloads with all prior values preserved; cancelling a changed
  worksheet selection does not mutate the profile or its revision date.
- All five writing selections can generate for the same child without profile edits.
- Choosing a math preset visibly states operations/range; generation, capacity,
  preview, saved defaults and answer key agree. No hidden difficulty multiplier.
- Changing a worksheet setting invalidates a stale preview and requires regeneration;
  toggling irrelevant controls neither silently changes the profile nor affects work.
- Keyboard-only use, 320px reflow and enlarged text retain labels/focus and readable
  controls. More options hides secondary choices without hiding blocking guidance.
- Selecting Space with artwork enabled shows reviewed space artwork; disabling art
  preserves required pictures and answers. Neutral fallback is understandable.
- Standard/large Letter/A4 prints remain legible, one intended worksheet per page,
  with matching keys and intact response cells. Include the densest legal ordering.
- Restart and upgrade checks use fictional persistent fixtures and prove no reset;
  never reset the operator's retained UAT store to canonical examples.

## Scope boundary

Plan this usability milestone before multiplication, packets or a broad content
catalog. Preserve existing family behavior while changing selection and storage.
No new generator family is required to expose existing writing variants.
