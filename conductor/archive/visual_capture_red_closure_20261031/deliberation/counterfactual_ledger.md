# Counterfactual ledger — visual_capture_red_closure_20261031

What each rejected candidate's world looks like, and the measurement that falsifies it.
Each entry names the HEAD it retains (what would have to be true for it to win).

## Candidate B (REJECTED) — ledger entries

**Recall condition:** re-open candidate B (spec files immutable) only if a FULL source audit of
`js/modals.js`, `js/catalog_service.js`, `js/dom/layer_manager.js` and `js/storage.js` at a FUTURE
revision shows every one of these reversed simultaneously — the confirm vocabulary back to
literal "OK"/"Apply" labels (with the ia_consistency RATIFIED pin re-sealed to match), the
catalog detail re-stacking a second `.be-modal-overlay`, the lock model made non-exclusive (with
`test/unit/layer_manager.test.js` re-pinned to it), and the shipped DB_VERSION back at 4 with the
`custom_borders` store history preserved some other way — i.e. only if the product genuinely
reverts to the states the stale assertions describe. A single assertion ever failing again is
NOT a recall: it is a defect to fix, not evidence that the harness corrections were wrong.

1. **"The OK button still exists"** — retained head: `showInputModal` renders a control whose
   `textContent` is exactly "OK".
   - Counterexample: `js/modals.js:319-321` renders `okBtn.className = "be-modal-ok";
     okBtn.textContent = "Continue"`. The pin: `test/unit/ia_consistency.test.js:132`
     (`RATIFIED = ["Delete", "Continue", "Cancel", "Close", "Back", "Got it"]`) and its catalog
     assertions (lines 206-210) pin `applyBtn.textContent = "Continue…"` and
     `yesBtn.textContent = "Continue"`.
   - Falsification: EVERY rename-RED row measured live showed the modal open with input filled
     and NO "OK"-texted control in `.be-modal-actions` — the row kept placeholder 'New Layer'
     BECAUSE the old matcher clicked nothing, not because the product dropped the rename.
   - Counterfactual world: to keep B, the product must rename its ratifying vocabulary back —
     an intentional IA regression that breaks two unit pins. Rejected.

2. **"The legacy detail stacks a second overlay"** — retained head: `querySelectorAll(
   ".be-modal-overlay").length >= 2` after opening a template detail.
   - Counterexample: `js/catalog_service.js` `setView(next, focusSel)` (line 283) swaps the
     single overlay's INNER view (`renderDetail`, line 390; `backBtn.onclick = setView("grid")`
     line 422). There is one overlay element for the whole catalog lifecycle.
   - Falsification: measured on the live boot, exactly 1 `.be-modal-overlay` while the detail
     view is showing and a Continue control is present inside it — the OLD assertion failed
     against a product that never had the legacy double-overlay shape.
   - Counterfactual world: re-stacking a second overlay for no user-visible benefit — a UI
     regression. Rejected.

3. **"Unlocking one layer leaves zero locks"** — retained head: after unlocking shapes-default,
   `document.body` carries no `be-lock-*` class and no `.be-layer-locked` element exists.
   - Counterexample: `js/dom/layer_manager.js::_toggleLayerLockNow` — "If we are unlocking this
     layer, lock ALL others" (`allLayers.forEach(l => l.isLocked = true)`), `activeLayerId =
     layer.id`. The paradigm is pinned by `test/unit/layer_manager.test.js`.
   - Falsification: live measurement — after unlocking shapes-default, `<body>` carries exactly
     `be-lock-sections` and the SECTIONS layer is `.be-layer-locked` (measured pre-fix with
     `be-lock-shapes-default` erroneously ALSO present — but that came from the harness's own
     blind second click (entry 4), not from the paradigm; still, even without it,
     `be-lock-sections` alone falsifies `bodyLocks.length === 0`).
   - Counterfactual world: "no layer stays locked" requires a non-exclusive lock model — breaking
     a pinned design decision whose justification ("the layer you are working on is singular")
     is the reason the drag/insertion machinery works. Rejected.

4. **"The rotation-reveal step's second lock click is harmless"** — retained head: clicking the
   shapes layer's lock toggle a second time leaves the layer unlocked.
   - Counterexample (measured on the live boot, pre-fix): the AC-5 step ALREADY unlocked
     shapes-default, so the unconditional click RE-LOCKED it — end state measured:
     `be-lock-shapes-default` back on `<body>`, `print-enhance-shapes-layer` both
     `.be-layer-locked` and NOT `.be-active-layer`, rotation handle hidden by
     `.be-layer-locked .be-rotation-handle`.
   - Falsification: the reveal the test came to observe was impossible in the state the harness
     itself created. The conditional click (only when the shape's layer is actually locked)
     leaves the required state in place.
   - Counterfactual world: keep the blind toggle and accept a hidden rotation handle — the
     assertion would never see what it asserts. Rejected.

5. **"A version-4 open of the product's database is a clean reset"** — retained head:
   `indexedDB.open("DDBPrintEnhancerDB", 4)` succeeds against the shipped database and clears the
   layouts store.
   - Counterexample: `js/storage.js:42` `DB_VERSION = 5` (the `custom_borders` store, track
     `byok_svg_borders_20260927`). Opening a live v5 database with version 4 fires
     `VersionError` (the blocked upgrade path) — measured verbatim `{"ok":false,"err":
     "VersionError"}` on the pre-fix run.
   - Falsification: the corruption the restore-failure test plants was never WRITTEN, so the
     boot had nothing to fail on — the alertdialog legitimately never rendered. The plant must
     attach to the shipped version (version-less open).
   - Counterfactual world: downgrade the product to DB_VERSION 4 and lose persisted borders —
     a regression no user asked for. Rejected.

6. **"The first toast in the lane belongs to the save action"** — retained head: at the moment
   the save completes, the first `.be-feedback` element is the save toast.
   - Counterexample: `js/persistence.js::announceBootRestore` — on a restoring boot it fires
     `show("Restored your saved layout.", "success")` BEFORE any user action can produce its own
     toast; toasts stack in one lane (`js/modals.js` FEEDBACK_LANE).
   - Falsification: measured pre-fix, the first `.be-feedback` at save time was
     `be-feedback-success` textContent "✓ Restored your saved layout." — the boot's toast, not
     the save's. The save's own toast (still present behind it) is `be-feedback-info` — the
     class the ORIGINAL assertion wanted all along.
   - Counterfactual world: suppress the boot-restore announcement so the save toast is first —
     removing a legitimate, pinned UX behavior to suit a lane-order assumption. Rejected.

7. **"The destructive Reset gate announces role=dialog"** — retained head: `confirmDestructive`'s
   surface carries `role="dialog"`.
   - Counterexample: `js/recovery_ui.js:190,287` — the shared primitive renders `role:
     "alertdialog"` for destructive gates (track `modal_primitive_20260910`, fleet-wide).
   - Falsification: live measurement — the Reset gate's dialog reports `alertdialog`, with its
     own close affordance and destructive copy (both still asserted). Only the role NAME was
     stale.
   - Counterfactual world: rename the primitive's role back — undoing an accessibility decision
     (destructive surfaces are alertdialogs, correct for a11y) that the fleet already shipped.
     Rejected.

## Candidate A (ADOPTED) — retained heads

Entry 0 in the retention column (what must remain true for the ADOPTED world to stay correct):

**Recall condition:** candidate A's adoption is re-opened — treated as falsified and re-deliberated
with candidate B — if ANY retained head is measured false on a future boot:
- the pointer-events rule is found UNSCOPED or over-scoped (shape wrappers on an ACTIVE or
  unlocked layer dropping out of the hit test, or a locked SECTIONS wrapper losing its U-7
  interaction) — tripwire: ui_ux_audit's "locked wrapper stays interactive" probe and A's own
  hit-test measurement (`fromShapesOverlay` must stay false at section centres while the shapes
  layer is locked-and-non-active);
- an empty-query Escape stops closing the picker sheet (the field swallows it again), or a
  non-empty one now CANCELS the modal — tripwire: picker_ux phase 3, 18/18;
- any of the 8 superseded assertions is later relaxed into vacuity (e.g. the info-toast class
  check dropped, the overlay-count equality dropped to "> 0") — tripwire: this record requires
  a fresh deliberation before such an edit lands;
- the exclusive-lock paradigm is removed by another track without re-pinning (then the phase-2
  rewritten assertion must be re-adjudicated against the NEW shipped model, not silently kept).

The seven falsifying entries for candidate B follow; each names its counterexample and
counterfactual world.

- The pointer-events rule stays scoped twice (shape wrappers only; `:not(.be-active-layer)`)
  — an unscoped variant would re-break U-7's locked-wrapper interactability and the active
  layer's own rail. The ui_ux_audit "locked wrapper stays interactive" probe remains the tripwire.
- The Escape split stays keyed on query emptiness — a field that swallows the empty-field
  Esc would resurrect picker_ux phase 3's failure; the suite's 18/18 remains the tripwire.
- The 8 superseded assertions keep asserting end states — any future edit that relaxes one into
  vacuity (e.g. dropping the `be-feedback-info` class check, or the overlay-count equality) is a
  regression of this record and must be re-deliberated.
