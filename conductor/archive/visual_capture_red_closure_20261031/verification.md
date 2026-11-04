# Verification — visual_capture_red_closure_20261031

**Verdict: ALL 7 ACs MET. 45/45 browser_e2e tests green in a REAL browser (real Chromium, the
unpacked MV3 extension booted exactly as the fleet inventory boots it), plus the live probe
measurements below, lint green, unit suite 2235 passing / 0 failing.**

## AC-1..AC-5 — the five suites, real-browser runs (2026-10-30/31)

Each suite ran through the inventory runner's EXACT invocation (`node node_modules/mocha/bin/
mocha.js <spec> --timeout 900000 --reporter json --reporter-option output=<file> --require
scripts/e2e_video_preload.js`) with its SHOTS flag on, so the gate conditions are the same as the
certification run that found the 11 REDs. Runner scratch: `temp/scratch/verify_5suites.js`,
per-suite `report.json` + per-case `.webm` videos under `temp/scratch/verify-<suite>/`.

| suite | result (was) | duration |
| --- | --- | --- |
| drag_ux_visual_capture.spec.js | **10/10 PASS** (was 6/10) | 326 s |
| ui_ux_audit_visual_capture.spec.js | **4/4 PASS** (was 1/4) | (in run) |
| custom_templates_visual_capture.spec.js | **6/6 PASS** (was 4/6) | 215 s |
| picker_ux_visual_capture.spec.js | **18/18 PASS** (was 17/18) | 622 s |
| shape_layer_ps_visual_capture.spec.js | **7/7 PASS** (was 6/7) | 255 s |

Summary file: `temp/scratch/verify_summary.json` (`ok: true`, all five rows rc=0, 0 failures).

## AC-7 — the live probe (the raw measurements behind the RED closures)

`temp/scratch/probe_decisive.js`, booted through the shipped harness helpers
(`test/browser_e2e/_helpers/dom.js :: launchExtensionContext + bootPage` — the real demo sheet,
consent dismissed, extension injected, harness boot-error policy applied). Verbatim output:

- **Hit-test at 6 section-wrapper centres** (`PROBE-1`): every topmost element is sheet content
  (`.be-ctl-fold-label`, `.be-ctl-btn`, `.be-btn-ai-arrange`, `.ct-skills__col--skill…`,
  `.ct-combat__statuses-group…`, `.ddbc-character-avatar__portrait`); `fromShapesOverlay: false`
  for ALL six. Pre-fix, the archived failure measured shapes-overlay nodes as the topmost
  element at these points. Layers at probe time: sections layer `#print-enhance-sections-layer`
  (z-index 1000, `be-active-layer`, NOT locked) and shapes layer
  `#print-enhance-shapes-layer` (z-index 1001, `be-layer-locked`, NOT active) — i.e. the fix
  holds while the shapes layer is in exactly the state that used to steal every press.
- **Drag commit, both pointer types** (`PROBE-2`): `{"mouse":{"midGestureDragging":true},
  "touch":{"midGestureDragging":true}}` — the `.be-section-wrapper.dragging` class that both RED
  phase-1 tests demanded is present mid-gesture on mouse AND on touch.
- **Scope bounds (the side-effect hygiene R1 demanded):** the pointer-events rule is scoped
  `:not(.be-active-layer)` — with the sections layer active and the shapes layer locked-non-active
  the shapes wrappers step out of the hit test; a layer that BECOMES active keeps full pointer
  interaction (dimmed-but-hittable), and the locked SECTIONS layer wrapper keeps its interaction
  (ui_ux_audit's "locked wrapper stays interactive" probe still passes inside the same 4/4 run).
- The 🎯 select-section buttons exist, are visible (39x32 each) and are clickable in the suite's
  own phase-4 test (10/10) — the RED was a hit-test interception by the shapes overlay, which
  PROBE-1 shows no longer occurs (`fromShapesOverlay: false` everywhere; the rail-level overlay
  nodes like `.be-onboarding-hint` that sit over ONE button are the harness's own first-boot hint,
  not the product, and the suite's own wait handles it).

## AC-6 — regression gates

- `npm run lint`: eslint js/ test/ scripts/ clean; border-SVG injection guard 34/34; scripts
  hygiene `SCRIPTS HYGIENE OK` (58 judged).
- `npx mocha --recursive test/unit test/e2e test/manifest.test.js` (the `npm test` composition):
  **2235 passing, 0 failing** (2 m).
- The drag_ux suite's own phase-2 assertion (`assert.ok(mid.guides >= 1, "alignment guide visible
  mid-drag")`, checking `.be-drag-guides > .be-drag-guide` count) passed inside the 10/10 run —
  live snap + gold guide, the third RED closure of AC-1. `js/dnd.js:811-818` is the guide
  overlay (`be-drag-guide` class, gold hairlines).

## The 8 spec supersessions — each checked against the shipped code BEFORE this verdict

Every SUPERSEDED BEHAVIOUR edit was verified against the product source it cites (not just the
test result), so the harness changes are corrections of stale assertions, not goalpost moves:

1. **indexedDB at frozen v4 (×3 edits, ui_ux_audit)** — `js/storage.js:42` ships `DB_VERSION = 5`.
   Opening a live v5 database at version 4 throws `VersionError`, so the corruption/clean-reset
   the tests plant never landed; opening WITHOUT a version attaches to what the product ships.
2. **First-toast selection (ui_ux_audit phase 1)** — `js/persistence.js:1057-1075`
   `announceBootRestore` emits `"Restored your saved layout.", "success"` at every boot that
   restores; toasts stack in one lane (`js/modals.js:611+`), so a boot toast legitimately sits in
   front of the save toast. Selecting by text `/Saved to browser/i` picks THIS action's toast —
   and it still asserts `be-feedback-info` (the kind for a plain `showFeedback(msg)` call,
   `js/modals.js:613`), so the original intent is intact.
3. **Reset gate role (ui_ux_audit)** — `js/recovery_ui.js:190,287` `confirmDestructive` renders
   `role: "alertdialog"` through the shared primitive (track `modal_primitive_20260910`). The
   assertion still requires an in-app dialog with its own close affordance — only the role name
   changed.
4. **Exclusive-lock body implies bodyLocks≥1 (ui_ux_audit phase 2)** —
   `js/dom/layer_manager.js:1862-1880` `_toggleLayerLockNow` locks EVERY other layer when one is
   unlocked, so "no layer stays locked" (`bodyLocks.length === 0`, `lockedLayers === 0`) is a
   state this product cannot reach BY DESIGN (pinned by `test/unit/layer_manager.test.js`).
   The rewritten assertion checks what the reveal actually needs: no `be-lock-shapes-default` on
   `<body>`, the shape's layer unlocked and active.
5. **The blind second lock click (ui_ux_audit phase 2)** — measured live before the fix: the
   AC-5 step had already unlocked shapes-default, so the unconditional click RE-LOCKED it
   (`be-lock-shapes-default` back on `<body>`, rotation handle hidden). The click is now
   conditional on the layer actually being locked, and the layer is resolved by the shape
   (`firstShape.closest(".pe-layer")`) instead of a hard-coded id, because this suite shares one
   persistent profile whose booted topology can differ from the canned id.
6. **Catalog detail overlays (custom_templates phase 0)** — `js/catalog_service.js:390+ renderDetail`
   + `setView("detail", …)` (line 283) render the detail WITHIN the single modal overlay; the
   legacy `nOverlays >= 2` double-overlay does not exist in the shipped product. Kept as a real
   assertion (`strictEqual(nOverlays, 1)` + an in-modal detail-visibility check).
7. **Apply by class (custom_templates phase 2)** — `js/catalog_service.js:427`
   `applyBtn.className = "be-modal-ok"` (label "Continue", line ~428); the /apply/i text match
   could never fire. Pinned vocabulary: `test/unit/ia_consistency.test.js:132`
   (`RATIFIED = … "Continue" …`, lines 206-210 pin `applyBtn.textContent = "Continue…"` /
   `yesBtn.textContent = "Continue"`).
8. **Input-modal confirm by class (shape_layer_ps ×2)** — `js/modals.js:319-321`
   `okBtn.className = "be-modal-ok"; okBtn.textContent = "Continue"` — the `textContent === "OK"`
   match could never fire. Same IA pin as #7.

## Repository hygiene

No `manifest.json`, no `vendor/` changes (track scope.never). Changes: `js/print_styles.js`
(+40), `js/shape_picker.js` (+25/-6), 5 spec-file edits across the 3 files that carried stale
assertions (`custom_templates` +32, `ui_ux_audit` +119/-6, `shape_layer_ps` +14), track record,
registry row, CHANGELOG entry. `temp/scratch/` holds the runner, probes and reports (scratch,
gitignored).
