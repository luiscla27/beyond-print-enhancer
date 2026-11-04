# Candidate A — `js/activation_overlay.js` boot-owned module (ADOPTED)

A dedicated, idempotent module that mounts the overlay DOM at the very start of
the content-script boot — before `Storage.init()` — and exposes a
`dismissActivationOverlay(result)` handle. `js/main.js`'s boot IIFE calls mount
first and dismiss last (after `restoreLayout()`/`applyDefaultLayout()` +
`announceBootRestore()`).

**Why admissible:** it matches this repo's encapsulated-module convention
(storage, filters, section_utils, print_styles …) exactly: fail-open imports in
main.js, `window.*` export at module end, idempotence guard, `__DDB_TEST_MODE__`
safe, and it gives the e2e harness a stable, queryable DOM contract
(`#be-activation-overlay`, `data-be-activation-state="active|dismissed"`) that
screenshot judges can SEE on camera — which is the entire certified defect.

**Measured basis:** the defect is a *missing affordance*; the fix must be a
native DOM node that is present at boot and gone at completion, styled in the
extension's own charcoal/brass vocabulary so it cannot be mistaken for D&D
Beyond's spinner (the judge repeatedly attributed the ONLY visible spinner to
the website — f08/f10 quotes in spec.md).

## Candidate B — a toast-only affordance via existing `showFeedback` (REJECTED)

Reuse the toast stack (js/modals.js) to push an "Enhancing sheet…" info toast
at boot and a "Sheet enhanced" success toast at completion.

**Why inadmissible (measured):** toasts live in the FEEDBACK_LANE at the top of
the viewport with a short dwell and auto-dismiss; the certified gap is that the
*transition itself* — the middle of the boot sequence — shows no extension-owned
state. A toast that appears only at boot-instruction time and vanishes after
~4s still leaves the multi-second middle unowned, and BEYOND-19 already owns
in-session progress toasts. The defect class requires an *overlay that spans
the transition*, not a lane notification. Dismissible = yes, but uncertified:
the judge's absence class would survive.

## Candidate C — a CSS-only style flash on `.ct-subsections` re-parenting (REJECTED)

Animate the existing layout-root re-parent with a CSS transition so the change
is visually gradual.

**Why inadmissible (measured):** the abruptness the judge priced is not the
DOM reparent animation — it is that *nothing extension-specific is visible at
all* while the sheet is being enhanced ("the only spinner belongs to D&D
Beyond"). A style flash on website-owned elements remains website-lookalike and
carries no naming, no burden state, and no first-run explanation; it also cannot
carry a dismissible state or a test-visible contract.

## Counterfactual ledger

- **A rejected → B would be adopted:** only if the dwell-cap and feedback-lane
  position were measured to cover the full boot duration. Recall condition: an
  instrumented e2e boot whose median completion exceeds the toast dwell
  (~4s) — today's boot completes in well under that on a cached profile, but
  the uncached/first-run path (BEYOND-25's upload lifecycle) can exceed it;
  B remains inadmissible until that measurement flips.
- **A rejected → C would be adopted:** only if the judge's absence class were
  narrowed to "the transition is jarring" rather than "no extension-owned state
  is visible". Recall condition: a re-certification run whose Layer 2 findings
  name *only* abruptness and not attribution. The current record names both.
