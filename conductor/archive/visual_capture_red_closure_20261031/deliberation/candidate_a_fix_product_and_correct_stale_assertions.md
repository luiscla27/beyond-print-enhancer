# Candidate A — Fix the product in js/, and CORRECT the stale harness assertions
(read: the operator ruling's Option A, verbatim in metadata.json)

## What it commits to

1. **Two REAL product fixes in the shipped content scripts**, each justified by a MEASURED live
   defect on a booted MV3 page (not by the failure text alone):
   - `js/print_styles.js`: a `.be-shape-wrapper` on a layer that is LOCKED and NOT the active
     layer — and its whole subtree — gets `pointer-events: none !important`.
     MEASURED pre-fix: `#print-enhance-shapes-layer` (z-index 1001, above the sections layer's
     1000) boots LOCKED with `pointer-events: auto`, and its wrappers are the topmost
     elementFromPoint at the centre of every section they frame — so sections were undraggable
     on mouse AND touch, and the 🎯 select-section button in a section's own action rail was
     hit-test-intercepted, never clickable (phase 4's 15 s locator timeout).
     MEASURED post-fix on a live boot: elementFromPoint at 6 section centres is sheet content
     (`fromShapesOverlay: false` on all six), and a dispatched pointer sequence commits
     `.be-section-wrapper.dragging` MID-GESTURE on both pointer types.
   - `js/shape_picker.js`: Escape in the search field is two-step — a non-empty query is cleared
     (the field owns that Esc), an empty field's Escape is left to bubble to the modal's own
     window handler (`onModalKey`) which closes the sheet. MEASURED pre-fix: `stopPropagation()`
     was unconditional and the picker opens with the field focused, so Escape NEVER closed the
     sheet from its default state (picker_ux phase 3: "Esc closed the modal: false !== true").
2. **Eight minimal, in-place, SUPERSEDED-BEHAVIOUR-marked spec corrections**, each keeping the
   ORIGINAL assertion's intent (the acceptance harness still asserts the intended end state):
   - indexedDB opens WITHOUT a frozen version 4 (×3, ui_ux_audit) — the product ships
     `DB_VERSION = 5` (`js/storage.js`); opening a live v5 DB at v4 throws `VersionError`, so the
     corruption/clean-reset the tests plant never landed.
   - The save action's toast selected by its text (phase 1) — `announceBootRestore`
     (`js/persistence.js`) legitimately emits a success toast at every restoring boot, and the
     toasts stack in one lane; the class assertion (`be-feedback-info`) is unchanged.
   - Reset gate role accepts `alertdialog` — `js/recovery_ui.js::confirmDestructive` renders
     `role: "alertdialog"` through the shared destructive-gate primitive (track
     `modal_primitive_20260910`); the still-checked intent is in-app dialog + close affordance.
   - Lock-state invariant rewritten to the reachable end state (phase 2) —
     `_toggleLayerLockNow` (`js/dom/layer_manager.js`) locks EVERY other layer on unlock, so
     "no layer stays locked" (`bodyLocks.length === 0`, `lockedLayers === 0`) is unreachable BY
     DESIGN (pinned by `test/unit/layer_manager.test.js`); what the reveal needs is "no
     `be-lock-shapes-default` on `<body>`; the shape's layer unlocked and active".
   - The reveal step's unlock click is CONDITIONAL (only when the shape's own layer is actually
     locked) and the layer is resolved BY THE SHAPE (`firstShape.closest(".pe-layer")`) —
     pre-fix it blind-toggled and RE-LOCKED the already-unlocked layer (measured live), and the
     hard-coded `shapes-default` id can mismatch a persisted profile's booted topology.
   - Catalog legacy-double-overlay assertion → `strictEqual(nOverlays, 1)` + in-modal detail
     visibility — `js/catalog_service.js` renders detail inside the single overlay
     (`setView("detail")` / `renderDetail`).
   - Confirm controls found by `.be-modal-ok` class (custom_templates apply ×1,
     shape_layer_ps input modal ×2) — the ratifying label is "Continue"/"Continue…"
     (`js/modals.js:319-321`, `js/catalog_service.js:427`); the old text matches
     (`/apply/i`, `textContent === "OK"`) can never fire against the shipped product.

## Cost / risk

- 8 assertions change — the exact surface where a "fix the test" laundering of a real defect
  could hide. MITIGATION carried into the acceptance gate: every supersession re-checked against
  the product source it cites BEFORE the verdict (verification.md §"The 8 spec supersessions").
- The pointer-events rule could over-reach and break U-7's "a lock is not a trap" interaction.
  MITIGATION: the rule is scoped twice — shape wrappers ONLY (a shape layer is the only thing
  that legally paints above the active layer) and `:not(.be-active-layer)` (isLocked and "is the
  insertion target" are independent states; `applyInsertionTarget` vs `toggleLayerLock`). The
  layer manager's ROW, U-7's actual escape hatch, lives outside every `.pe-layer` and is
  untouched. ui_ux_audit's own "locked wrapper stays interactive" probe passes inside the 4/4.

## Evidence in its favour

- The failing measurements are product facts, reproducible on any boot (hit-test, drag commit,
  Escape cancel), not harness artefacts.
- The stale assertions cite product decisions that already SHIPPED and are PINNED by unit tests
  (ia_consistency.test.js RATIFIED set; layer_manager.test.js exclusive lock) — a product
  regression to satisfy them would break pinned behaviour.

## Disposition

ADOPTED (operator ruling 2026-10-31, Option A). Delivered and verified: 45/45 real-browser green,
lint green, unit composite 2235/0. See candidate_b_rigid_no_spec_edits.md for the rejected rival
and counterfactual_ledger.md for the falsifying counterexamples.
