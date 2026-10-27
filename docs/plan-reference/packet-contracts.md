# Session packet supporting contract

P9 session-only and P10 separate run/screen gates are binding. Master31/33 contain complete active requirements. No draft API/store/recovery, no schema3, no undo/regeneration, no packet scale change.

### C. Print composition

`composePacketPages(sheets, placement)` returns pages in this order. `W(n)` is sheet n's worksheet page and `K(n)` its key page; `K(n)` exists only when the sheet's registration has `hasAnswerKey` and its request has `options.includeAnswerKey`.

| Placement | Label in the panel | Page order |
|---|---|---|
| `grouped-end` (default) | All answer keys at the end | W(1) … W(N), then K(n) for each keyed sheet in sheet order |
| `after-each-sheet` | Each key after its worksheet | W(1), K(1) if any, W(2), K(2) if any, … |
| `none` | Leave out answer keys | W(1) … W(N) |

Every page is one `.print-surface` at the packet layout, and every key page's heading carries its sheet label (DD12). Every page after the first starts a new printed page, each fits one printable page (proven at maximum length in Step 33), and no key shares a child-facing page. Child pages are rendered exactly as a single sheet.


Queued labels reuse shipped display/focus/variant owners. The current profile nickname labels the panel; the immutable document keeps its printed nickname. Key headings carry sheet number, family and printed nickname when present. Same-title grouped keys retain the accepted matching limitation; recommend after-each placement and record physical judgment, without inventing a new worksheet-label feature.
