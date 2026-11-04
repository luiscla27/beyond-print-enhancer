# Decision space — state-feedback-be19

**Question:** how is the certified absence class closed — "the extension is state-invisible" (BEYOND-19,
found UNPROMPTED in 17/19 bundles: no progress across a latency boundary, no error state where a write
can fail, no explanation of a transition) — with the fewest NEW surface concepts?

**Answer space:** affordances in the extension's OWN control, on the seams the judge actually named.
Anything the website renders is explicitly not ours, and treating it as ours is the defect the
parent certification was re-run to correct.

**Basis:** the three admissibility tests are the judge's verbatim language, cited from the sealed record `conductor/archive/e2e_goalgrounded_recert_20261101/verdict.md` and the sealed acceptance criteria `conductor/archive/state-feedback-be19/spec.md`:

- **(i) PRESENCE ACROSS LATENCY** — *"No dedicated loading indicator for AI work… no
  extension-specific 'arranging'/pending state"* (f01); *"No loading/transition state for
  printing"* (f06, f14).
- **(ii) FAILURE IS VISIBLE** — *"No extension error state is shown"* (f14); *"No error state is
  shown for a failed save or store write"* (f07).
- **(iii) ONE VOCABULARY, NOT SEVEN** — the product's ONLY feedback primitive was a toast, and a
  toast drains at ~3 s, shorter than every operation the judge flagged. `.be-ai-busy` already
  existed as a PRIVATE node inside one flow, which is the direct evidence that the missing thing
  was a shared vocabulary rather than seven missing spinners.

**Basis tie:** the tests are the sealed acceptance criteria of this same track — (i) is [AC-1] with
[AC-3], (ii) is [AC-4] with our corrective reading of [AC-5]/[AC-7], (iii) is [AC-2]'s "rides the
one seam" claim. The rubric therefore cannot drift away from the contract it judges.

## Comparison (no verdicts in this section — each option is judged under its own heading below)

| Option | Marker paints across a latency boundary? | Error path covered? | Print-safe by construction? | Stops the class returning? |
|---|---|---|---|---|
| `candidate_a_shared_progress_marker.md` — shared `showProgress`/`clearProgress` + `.be-progress` | YES — a plain DOM node, mounted before the await and cleared after it | YES — the filter commit reports a rejected `Storage.saveFilter` | YES — one class in BOTH injected `@media print` lists (this is how the `.be-ai-busy` leak was found: it was in NEITHER) | YES — the shared seam is the precedent the next operation copies |
| `candidate_b_per_control_spinners.md` — a bespoke spinner per control | YES where wired; nothing for the next operation | YES at the same call sites, no advantage | NO — seven positioned nodes, seven hide-list entries to forget | NO — nothing to copy; the next control invents its own |

## Candidate A — shared in-flight marker

**verdict candidate_a_shared_progress_marker:** ADOPTED. The only option satisfying all three basis
tests, and the only one whose print-safety is a single addition rather than seven. It also matches the
repo's existing conventions exactly: the pair is published from `js/main.js` beside `window.showFeedback`
(the same seam kind the non-modular callers already resolve at call time), the surface lives in the
locked theme rather than in an ad-hoc inline style, and the copy is per-operation so the marker still
says WHICH work is in flight. Implemented 2026-11-02; verified per `verification.md`
(e2e with a real 2 s provider latency: `busyDuring: true busyCleared: true`; 9/9 contract cases
including the print CALL ORDER and the injected print-hiding rule; full suite 2250 passing / 0 failing).

## Candidate B — per-control spinners

**verdict candidate_b_per_control_spinners:** REJECTED for THIS finding, and recorded with a recall
condition rather than deleted — B's spatial honesty (a marker anchored to the control the user pressed)
is a real design virtue that the shared top-of-screen pill does not have.

**Recall condition:** revive B if a design ruling requires the affordance to sit INSIDE the control's own
box (for example a spinner replacing the Print row's label so the ROW is visibly the thing working).
That ruling would make the shared pill the wrong geometry, and B's seven lifetimes would become the
price of the correct placement.

## What BOTH candidates leave open

Neither makes a marker paint for a **synchronous** `applyLayout` rebuild — the judged f12 case
("most of the sheet is temporarily blank… no explicit loading"). A marker raised before a blocking task
and cleared after it inside the same task never reaches a frame. That is [AC-7], and it is DEFERRED
rather than dressed up as done; the structural fix (yield to the event loop between teardown and
re-render in `js/layout_apply.js`) is on the counterfactual ledger with its diagnosis written down.
