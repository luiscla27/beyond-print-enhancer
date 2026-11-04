# Candidate B — Leave the spec files untouched: fix ONLY product behavior, and if an
assertion cannot go green without a product regression, treat the suite as non-gating

(read: the rival that survived to the execution floor — "the acceptance harness is immutable;
anything that fails against it must be fixed in the product or dismissed")

## What it commits to

1. The same two product fixes in `js/` (pointer-events scoping; two-step Escape) — those were
   genuinely missing behavior and this candidate accepts them.
2. **ZERO edits to any `test/browser_e2e/*_visual_capture.spec.js`.** Where a test still fails
   after the product fixes, the remedy is either (a) a PRODUCT change that makes the literal
   assertion true, or (b) marking the suite/observation not-gating (a skip or a scope note),
   never an assertion edit.

## Cost / risk — and the FALSIFYING measurements

- **(a) is impossible for at least 4 of the 8 stale assertions without UNDOING shipped, pinned
  product behavior:**
  - The `/apply/i`, `textContent === "OK"` matchers (custom_templates phase 2; shape_layer_ps
    rename ×2): the shipped confirm vocabulary is RATIFIED "Continue"/"Continue…" — pinned by
    `test/unit/ia_consistency.test.js` (RATIFIED set, line 132) and rendered by
    `js/modals.js:319-321`. Renaming them back to "Apply"/"OK" to satisfy the old matcher would
    be an intentional IA REGRESSION that breaks the pin.
  - `nOverlays >= 2` (custom_templates phase 0): the shipped catalog renders detail IN-modal
    (`js/catalog_service.js setView("detail")` / `renderDetail`). Re-stacking a second overlay
    is a UI regression with no user-visible benefit.
  - `bodyLocks.length === 0` + `lockedLayers === 0` (ui_ux_audit phase 2): `_toggleLayerLockNow`
    (`js/dom/layer_manager.js`) locks every OTHER layer on unlock — the exclusive-lock paradigm
    pinned by `test/unit/layer_manager.test.js`. "No layer stays locked" is unreachable BY
    DESIGN; satisfying it would break the pinned paradigm.
  - The frozen-version indexedDB opens (`indexedDB.open("DDBPrintEnhancerDB", 4)` ×3): the
    product ships `DB_VERSION = 5` (`js/storage.js`); opening a live v5 DB at v4 throws
    `VersionError` — NO product change can make a version-4 open of a version-5 database
    succeed (downgrading the shipped DB version to 4 would drop the `custom_borders` store and
    break byok history).
- **(b) discards 6 real, user-facing defects** (undraggable sections on both pointer types,
  unclickable 🎯 select-section, a picker that cannot be cancelled from its default state) and
  leaves the certification's AC-1 residual unclosed — while the probe measurements prove the
  defects are product facts, not harness noise.

## Evidence in its favour (steelman)

- Spec files ARE the acceptance harness; an uncritical edit culture is a real risk (the exact
  laundering concern candidate A's mitigation exists for).
- For the four product-behavior REDs (drag commit ×2, snap/guides, select-button), this candidate
  and A agree completely — no spec edit is needed there, and none was made.

## Disposition

REJECTED at the execution floor — its own commitment (spec files immutable) makes 4+ of the
remaining REDs permanently unfixable except by regression. The operator ruling (Option A,
2026-10-31) adjudicated the same fork in candidate A's favour with the documented-supersession
discipline as the anti-laundering control. See counterfactual_ledger.md for the counterexamples
that falsified each of B's unfixable assertions.
