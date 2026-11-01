# final report — state feedback: progress / error / state-transition visibility (BEYOND-19)

Track: `state-feedback-be19` · Parent: `e2e_goalgrounded_recert_20261101` · Issue: **BEYOND-19**
Status: **COMPLETE for the ACs it claims; one AC explicitly deferred, not silently dropped.**

## What the finding actually was

The goal-grounded certification (unprimed control arm, no absence class seeded in the prompt)
found state-invisibility in **17 of 19 bundles**, in the judge's own words:

- *"No dedicated loading indicator for AI work… no extension-specific 'arranging'/pending state"* (f01)
- *"No loading/transition state for printing"*, *"No print success, completion, or error feedback"* (f06)
- *"No visible success feedback follows a Save action"*, *"No error state is shown for a failed save or store write"* (f07)
- *"No loading/transition state for the extension's print/filter operation"*, *"No extension error state is shown"* (f14)
- *"most of the sheet is temporarily blank… no explicit loading"* (f12)

## What shipped

**A shared in-flight marker, not seven one-off spinners.** `.be-progress` +
`showProgress`/`clearProgress` in `js/modals.js`, exposed through `js/main.js` beside
`showFeedback`. The reasoning: the extension already had ONE such node (`.be-ai-busy`, private to
the AI flow). The defect was not "this control lacks a spinner" — it was that the product had no
vocabulary for *"this is happening"* as distinct from *"this happened"*. A toast drains in ~3 s,
which is shorter than every operation the judge flagged; giving each control its own timer would
reproduce the gap the next time someone adds an operation.

Three call sites wired:

1. **AI arrange / AI borders** — already correct (`showBusy` wraps `sendByokChat`), now
   PROVEN by a spec instead of assumed.
2. **Print** — the worst case in the judge's list, because print is the product's purpose.
   Marker raised immediately before an **unchanged, un-awaited, undialogued** `window.print()`,
   cleared on the browser's own `afterprint` (including Cancel) with a 120 s backstop for the
   browsers that never fire it.
3. **Filter commit** — marker for the store write; an **error toast** when the write rejects.

`js/ui_theme.js` carries the surface (same pill, same `z-index: 10001` rung as the AI marker —
two differently-positioned in-flight markers read as two subsystems failing), and both
`@media print` blocks now hide it. `.be-ai-busy` was **added to the injected print hide list
while doing this** — a pre-existing leak the audit had never covered: a marker on screen at print
time repeats on every printed page.

## Verification

| AC | Result | Proof |
|----|--------|-------|
| AC-1 | **PASS** | e2e with a real 2 s provider latency: `busyDuring: true busyCleared: true` |
| AC-2 | **PASS (shared seam)** | one `showBusy` wraps `sendByokChat`, which both flows use |
| AC-3 | **PASS** | unit case asserts the **call order**, not the appearance |
| AC-4 | **PASS** | unit case asserts the reject path; `Storage.saveFilter` rejects, documented in-source |
| AC-5 | **already present** | `js/ai_settings.js` had distinct success/error copy; audited, not re-written |
| AC-6 | **already present** | "Shape added" / "Layout saved" toasts; audited, not re-written |
| AC-7 | **DEFERRED** | see below |

## The honest gap

**AC-7 is deferred, and this report says so rather than counting it.** A mid-session
`applyLayout` rebuild is synchronous inside the content script: a marker raised before it and
cleared after it never paints, because the browser gets no frame. The real fix is to yield to
the event loop between teardown and rebuild in `js/layout_apply.js` — a path every gesture
depends on. Landing that inside this track without running the full e2e corpus against it would
be the quiet-regression pattern this project's rules exist to block. It stays open as a
carry-over with its diagnosis already written down.

**AC-2 rides AC-1's spec, deliberately.** Both capabilities share `arrangeWithAi` →
`sendByokChat`; a marker defect breaks both and the AC-1 spec sees it. A second spec driving a
border round trip would assert the same node from the same seam — ceremony, not evidence.

## Cumulative-approach record (Muse-First protocol)

The red phase produced two WRONG diagnoses before the third worked; both are recorded in
`verification.md` §"Red → green record" with their falsifying measurements:

1. "the marker isn't painted (no yield)" — falsified by a main-world poll that found it (count 1).
2. "use `waitForFunction`" — falsified: returns a `JSHandle` in this Playwright build and
   serialising it produced a `RangeError: Array buffer allocation failed`.
3. Fixed by adding `async_start` to the harness probe so the test observes the latency window
   from outside the flow.

## Commits (local only — never pushed)

Delivered as local commits on `master_next`. Nothing pushed; the operator syncs remotes.
