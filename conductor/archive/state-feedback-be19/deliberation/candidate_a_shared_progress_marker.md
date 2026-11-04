# Candidate A — a shared in-flight marker (`showProgress` / `clearProgress` + `.be-progress`)

**Status: ADOPTED**

## What it is

One pair of functions in `js/modals.js` (`showProgress(text)` / `clearProgress(node)`), one CSS
class in the injected theme (`js/ui_theme.js`), published to non-modular callers from
`js/main.js` beside the existing `window.showFeedback`. Each operation that crosses a latency
boundary raises a marker carrying its OWN copy ("Preparing your sheet for print…", "Saving
filter…") and clears exactly the node it mounted.

## Why it is the right shape for THIS finding

The judge did not report seven unrelated bugs. Every one of its bullets is the same sentence
about a different control:

- *"No dedicated loading indicator for AI work… no extension-specific 'arranging'/pending state"* (f01)
- *"No loading/transition state for printing"* (f06, f14)
- *"No extension error state is shown"* (f14)

The product had ONE in-flight node already — `.be-ai-busy`, private to the AI flow, ~20 lines of
bespoke DOM in `js/ai_arrange.js`. So the defect was never "this control lacks a spinner". It was
that the extension had **no vocabulary for "this is happening", as distinct from "this happened"**:
the only feedback primitive was a toast, and a toast drains at ~3 s, which is SHORTER than every
operation the judge flagged. Adding seven spinners would reproduce the gap the next time someone
adds an operation.

## What it buys, concretely

1. **One lifetime rule.** `clearProgress` is idempotent (asserted), so a `finally` and an
   `afterprint` handler can both reach the same node — the print path does exactly that.
2. **One geometry.** Same pill, same `z-index: 10001` rung as `.be-ai-busy`, so two in-flight
   operations can never look like two subsystems failing. The class differs only so a spec can
   say WHICH operation is pending.
3. **One place to be print-safe.** It arrived in the theme, and both `@media print` blocks hide
   it — which is how the pre-existing `.be-ai-busy` leak got found and fixed en route (it was in
   NO hide list, so a marker on screen at print time repeated on every printed page).
4. **Accessible by default.** `role="status"` + `aria-live="polite"`; the error path stays on
   `showFeedback`'s assertive lane, so a failure still interrupts and a progress note does not.

## Cost / limitation, stated plainly

The marker cannot appear for work that never yields to the event loop. That is exactly the AC-7
case (a synchronous `applyLayout` rebuild pits teardown and re-render in one task), and it is why
AC-7 is DEFERRED rather than claimed — see `counterfactual_ledger.md`.

## Evidence it works

`test/browser_e2e/state_feedback_ai_arrange.spec.js` drives a real **2 s** provider latency
through the service-worker fetch stub and observes `busyDuring: true busyCleared: true`.
`test/unit/state_feedback_contract.test.js` (9 cases) pins surface, lifetime, idempotence,
injected-theme rule, injected print-hiding, print CALL ORDER, and the reject path for
`Storage.saveFilter`.
