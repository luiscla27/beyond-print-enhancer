# verification — state feedback: progress / error / state-transition visibility (BEYOND-19)

Track `state-feedback-be19`. Parent certification: `e2e_goalgrounded_recert_20261101`
(unprimed v3 control arm, 17/19 bundles named state-invisibility).

## What was ACTUALLY verified, and how

Every row below is a command that ran in this session, not a reading of the judge record.
The judge record is the FILING evidence for the issue; closure evidence has to come from the
project's own machinery.

| AC | Claim | Evidence | Result |
|----|-------|----------|--------|
| AC-1 | AI arrange shows an in-flight marker across the provider round trip and clears it before the preview dialog is readable | `npx mocha test/browser_e2e/state_feedback_ai_arrange.spec.js` — service-worker `self.fetch` stubbed to a **2 s delay**, marker polled from the main world, zero network | **PASS** — `busyDuring: true busyCleared: true` |
| AC-2 | AI borders rides the same in-flight path (one `showBusy` for every BYOK round trip) | same spec path + `js/ai_arrange.js:793/806` — the marker wraps `sendByokChat` for **every** capability combination, border included | **PASS (by construction, one seam)** |
| AC-3 | Print has a lifecycle: a marker raised before `window.print()`, cleared on the browser's own `afterprint` | `npx mocha test/unit/state_feedback_contract.test.js` cases 7–8 (call ORDER asserted, not appearance) | **PASS** |
| AC-4 | A filter commit reports a failed store write; the drag path is untouched | contract case 9 (`Storage.saveFilter` REJECTS — asserted via the catch shape, and the source comment records why a truthiness check would be dead code) | **PASS** |
| AC-5 | Settings save already carries distinct success/error copy | pre-existing (`js/ai_settings.js` `aiSaveErrorMessage` ×5 + `status.textContent`); NOT re-implemented — the judge's bundle only saw the dialog without a save | **already present** |
| AC-6 | Shape add / layout save already toast | pre-existing (`js/controls.js` "Shape added", `js/dnd.js` "Layout saved") | **already present** |
| AC-7 | Any assembly that blanks the sheet shows a marker | **NOT implemented this pass** — see the honest gap below | **DEFERRED** |

## The honesty section (what this pass did NOT close)

**AC-7 is deferred, deliberately.** The judge's f12 finding ("most of the sheet is temporarily
blank … no explicit loading") is real, but the seam it needs is not the one the other six ACs
use: a mid-session `applyLayout` rebuild is *synchronous* inside the content script, so a marker
raised before it and cleared after it would never paint — the browser never gets a frame in
between. Closing it properly means yielding to the event loop between the teardown and the
rebuild inside `js/layout_apply.js`, which changes a code path every gesture depends on. Doing
that inside this track, unverified against the full e2e corpus, would be exactly the "fix that
looks right and regresses quietly" this project's rules exist to prevent. It is filed as a
carry-over rather than claimed.

**AC-2 rides AC-1's seam rather than getting its own spec.** That is a real claim, not a
shortcut: `arrangeWithAi` wraps `sendByokChat` — the single transport both flows use — so a
marker defect would break both and the AC-1 spec would see it. A second spec driving a border
round trip would assert the same node from the same seam.

## Files changed

- `js/modals.js` — NEW `showProgress` / `clearProgress` (the shared in-flight marker), exported
  on `window.Modals` beside `showFeedback`.
- `js/main.js` — destructures and re-publishes them as `window.showProgress` /
  `window.clearProgress` for the non-modular callers.
- `js/ui_theme.js` — NEW `.be-progress` rule (same pill, same z-index 10001 rung as
  `.be-ai-busy` on purpose) + print-hidden in the theme's own `@media print` block.
- `js/print_styles.js` — `.be-progress` and `.be-ai-busy` added to the injected print hide list
  (`.be-ai-busy` was missing from it — a real pre-existing leak: a marker on screen when the
  user printed would repeat on every printed page).
- `js/controls.js` — Print control gains the lifecycle marker (raised before an unchanged,
  un-awaited `window.print()`; cleared on `afterprint` + a 120 s backstop); filter commit gains
  the marker and the error toast on a rejected store write.
- `test/unit/state_feedback_contract.test.js` — NEW, 9 cases (marker surface + lifetime +
  theme rule + injected print hiding + print call order + filter error path).
- `test/browser_e2e/state_feedback_ai_arrange.spec.js` — NEW, drives a real 2 s provider
  latency through the service-worker stub and asserts the marker appears then clears.
- `test/browser_e2e/_helpers/inject.js` — `aiArrangeProbe` gains `action: "async_start"`
  (start the flow and return immediately, so a caller can observe the window WHILE it runs; the
  existing `start` blocks until the flow settles, which made the marker unobservable from a
  second call).

## Red → green record

The AC-1 spec was written to FAIL first and did: with the `2 s` stub in place and the flow
running, `busyDuring` came back **false** because the only observable path from the harness was
`action: "start"`, which awaits the flow and therefore samples AFTER `clearBusy`. Two wrong
diagnoses were tried and rejected before the third (recorded, per the Muse-First cumulative
rule):

1. *"The marker is not painted because nothing yields"* — REJECTED by measurement: a direct
   `document.querySelectorAll(".be-ai-busy")` poll from the main world found the node (count 1)
   while the fetch was in flight. The marker was always painted; the harness could not see it.
2. *"`waitForFunction` is the right tool"* — REJECTED: it returned a `JSHandle` in this
   Playwright build and serialising it back produced a spurious
   `RangeError: Array buffer allocation failed`. Replaced with a main-world poll loop, which is
   also what the other specs in this repo do.
3. *Fixed by* adding `async_start` to the harness probe, so the flow is started and the test
   observes the window from outside it. `busyDuring: true busyCleared: true`.

## Commands run

```
npx mocha test/unit/state_feedback_contract.test.js            # 9 passing
npx mocha test/browser_e2e/state_feedback_ai_arrange.spec.js   # 1 passing (busyDuring/busyCleared both true)
node --check js/{modals,main,controls,ui_theme,print_styles,ai_arrange}.js   # all clean
npm test                                                        # full suite
```
