# Seed 03: assemble and print a packet

Read [the shared starting point](README.md). The operator wants multiple sheets
without generating and printing each one individually. Packet size, persistence,
key placement and regeneration behavior were not specified.

## Recommended first useful flow

Create a worksheet using the ordinary worksheet controls, choose Add to packet,
repeat with another type/variant, reorder or remove sheets, preview the packet,
then print all sheets once. Store the already-generated immutable documents in the
packet so changing current controls cannot silently change earlier pages.

Provide an explicit answer-key placement choice; recommend grouped keys at the end
as the initial default. Open writing pages have no objective key. Keep matching
identifiers/page labels so a parent can associate keys with their worksheets.

## Decisions required before build

- Bound packet length and establish predictable memory/print performance.
- Decide session-only versus persisted packet drafts. Session-only is the smaller
  first milestone but must state that closing loses the queue. Durable drafts must
  remain local, versioned and private; never use browser storage for child data or
  commit generated sheets. No cloud library or scheduling is implied.
- Decide common paper/scale for a packet versus per-sheet layouts. A single packet
  layout is recommended initially; define whether changing it rerenders existing
  documents or requires explicit regeneration, without changing their problems.
- Decide multi-child support. If included, every sheet must retain the correct
  nickname/theme; switching selected child must not rewrite queued documents.
- Define stale-current-preview handling, duplicate Add behavior, removal/undo and
  print cancellation. Printing must not clear the queue automatically.

## Existing boundaries to reuse

The app currently renders one immutable worksheet document and its optional key.
Generation yields an ID, seed, family, version, normalized request, items and
answers. Reuse that document contract; a packet is a collection/order of generated
documents, not a loop that mutates the current profile and invokes Print repeatedly.
Read preview/print components, print tokens, registry applicability and required
content/PDF tests before designing queue state.

No backend packet API is required by the user. Add one only if the selected draft
persistence model needs it, with explicit schemas, ETags, recovery/privacy behavior.

## Acceptance examples

- Assemble math + label + Count/Compare pages, reorder them and print once; PDF
  order, page count, required content and keys exactly match the previewed packet.
- Each worksheet remains intact on its page, with no unexpected blank page, clipped
  marks or key accidentally sharing a child-facing page.
- Changing child or settings after adding a page leaves the queued document intact.
- Cancel printing and return to the same queue; regenerate only the selected page
  through an explicit action and update its matching key together.
- Both Letter/A4 and standard/large layouts work at the maximum packet length.
  Privacy calibration covers queued, removed and regenerated profile identifiers.
- Draft restart behavior matches its chosen persistence contract and never resets
  saved child profiles. Test with fictional data only.
