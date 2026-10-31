# counterfactual_ledger.md — activation-overlay-be18

Every rejection on this track, with the measured reason it was rejected and the condition that would
flip the verdict. The candidates themselves are in `candidate_a_boot_owned_overlay_module.md` and
`candidate_b_c_inadmissible.md`; this file is the ledger the guard reads.

## C1 — Candidate B: toast-only affordance via `showFeedback` (REJECTED)

**Rejected because:** the certified class is the *unowned middle of the transition* ("the enhancement
simply appears" f18; "panels appear together rather than showing a clear progressive
loading/transition state" f09). The toast lane is top-of-viewport with a short dwell and
auto-dismiss, so it cannot span the boot sequence it is supposed to explain; and in-session progress
toasts are BEYOND-19's class, which folding them here would blur into one fix.
**Recall condition:** adopt B instead only if an instrumented e2e shows median boot completion under
the toast dwell on the *uncached first-run* path too, AND a re-certification's Layer-2 findings no
longer name attribution. Neither holds as of 2026-11-01.

## C2 — Candidate C: CSS-only gradual re-parent flash (REJECTED)

**Rejected because:** the class is attribution, not abruptness alone. A transition on website-owned
`.ct-subsections` stays D&D-Beyond-lookalike, is undismissable, carries no extension name and exposes
no test contract — the defect would survive the fix and the next re-certification would re-find it.
**Recall condition:** adopt C instead only if a future re-certification names *only* visual abruptness
(no attribution finding) across all bundles. The unprimed record names attribution in 12/19.

## C3 — Reduced-scope alternative: dismiss the overlay at `Storage.init()` completion (REJECTED)

Considered as a cheaper half-measure (own the storage wait only, not the layout restore).
**Rejected because:** measured, the sheet is still the *plain* sheet while the layout is being
restored and applied — that is the exact stretch the judge watched ("the enhancement simply appears as
the page loads"). Dismissing at storage completion leaves the visually-identical gap.
**Recall condition:** if boot profiling ever shows layout restore completing before first paint, C3
becomes equivalent to A; not observed here (`applyDefaultLayout`/`restoreLayout` both mutate the DOM,
so they cannot precede paint).

## C4 — Reduced-scope alternative: reuse the host's own spinner (REJECTED, inadmissible on its face)

Not a candidate worth testing: the whole certified finding is that the only spinner on screen belongs
to D&D Beyond, and attributing our work by borrowing their affordance would make the absence class
*harder* to detect, not closed.
**Recall condition:** none. This would be a falsification of the product brief, not a fix.
