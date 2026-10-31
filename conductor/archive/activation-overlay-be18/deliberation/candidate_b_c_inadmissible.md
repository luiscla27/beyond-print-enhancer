# Candidate B — toast-only affordance via showFeedback (INADMISSIBLE)

Reuse js/modals.js showFeedback to push an info toast at boot and a success
toast at completion.

Rejected because the certified defect is the *unowned middle of the transition*,
and the toast lane (top-of-viewport, short dwell, auto-dismiss) leaves that
middle unpriced. Tested against the judge's own words: "the enhancement simply
appears" (f18) and "panels appear together rather than showing a clear
progressive loading/transition state" (f09) — a 4-second toast does not span
the sequence the judge watched, and an uncached first-run boot can exceed the
dwell. BEYOND-19 separately owns in-session progress toasts; folding the boot
overlay into them would blur two certified absence classes into one fix.

**Recall condition:** adopt B instead only if an instrumented e2e shows median
boot completion under toast dwell on the UNCACHED first-run path too, AND a
re-certification Layer 2 no longer names attribution. Neither holds today.

# Candidate C — CSS-only gradual re-parent flash (INADMISSIBLE)

Animate the .ct-subsections re-parent so the sheet change looks gradual.

Rejected because the absence class is attribution, not abruptness alone: the
judge found the only spinner on screen belongs to D&D Beyond (f10) and that the
activation transition is "brief and partly obscured" (f09). A transition on
website-owned DOM elements stays website-lookalike, is undismissable, carries no
extension name, and exposes no contract for the e2e harness to assert — the
defect would survive a C-only fix and the re-certification would re-find it.

**Recall condition:** adopt C instead only if a future re-certification names
*only* visual abruptness (no attribution finding) on 0 bundles. The current
unprimed record names attribution in 12/19.
