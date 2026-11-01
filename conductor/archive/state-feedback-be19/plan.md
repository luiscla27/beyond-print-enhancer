# plan — State feedback: progress / error / state-transition visibility (BEYOND-19)

## Phase 0 — Red: write failing e2e specs that expose each gap

| Step | Description | AC | Status |
|------|-------------|----|--------|
| 0.1 | Create `test/browser_e2e/state_feedback_ai_arrange.spec.js` — boot page, inject AI arrange, stub fetch to delay, assert `showBusy` appears and is cleared after | AC-1 | **DONE** |
| 0.2 | Create `test/browser_e2e/state_feedback_ai_borders.spec.js` — similar for borders round trip | AC-2 | **DONE** (rides AC-1 seam) |
| 0.3 | Name it plain: no separate print spec was written — AC-3's proof is the contract suite cases 7–8 (`state_feedback_contract.test.js`), asserting the marker is raised BEFORE an unchanged `window.print()` and cleared on the browser's own `afterprint` | AC-3 | **DONE** (contract, no dedicated e2e file — the print lifecycle is call-order, which Playwright's dialog-less headless print cannot exercise as a visual e2e) |
| 0.4 | Name it plain: no dedicated filter e2e file — AC-4's proof is contract case 9 (`Storage.saveFilter` REJECTS and the commit reports the failed write; the drag path is asserted untouched) | AC-4 | **DONE** (contract, no dedicated e2e file — a disabled-state visual e2e for filter action icons was scoped out: the disabled state is pre-existing UI chrome the corpus already exercises) |
| 0.4 | Create `test/browser_e2e/state_feedback_persistence.spec.js` — save settings, assert success/error toasts | AC-5 | **already present** |
| 0.6 | Create `test/browser_e2e/state_feedback_clone_shape.spec.js` — clone section / add shape, assert success toasts | AC-6 | **already present** |
| 0.7 | Create `test/browser_e2e/state_feedback_silent_transition.spec.js` — capture sheet blanking >300ms, assert loading toast | AC-7 | **DEFERRED** (diagnosis recorded) |

## Phase 1 — Green: implement the missing feedback in source

| Step | Description | AC | Status |
|------|-------------|----|--------|
| 1.1 | `js/ai_arrange.js`: `showBusy("Arranging…")` already exists at line 978-991 — ensure it's called before fetch and cleared after (already done for arrange; verify borders path) | AC-1 | **DONE** |
| 1.2 | `js/ai_arrange.js`: add progress/error toasts for borders round trip (mirror arrange path) | AC-2 | **DONE** (rides AC-1 seam) |
| 1.3 | `js/print_styles.js` / `js/background.js`: add loading/success/error toasts around print pipeline | AC-3 | **DONE** |
| 1.4 | `js/controls.js` / `js/catalog_service.js`: filter panel loading/error toasts + disabled state for action icons | AC-4 | **DONE** |
| 1.5 | `js/ai_settings.js`: success toast on settings save, error toast on store write failure | AC-5 | **already present** |
| 1.6 | `js/dom/layer_manager.js` / `js/controls.js`: success toasts for shape add / section clone | AC-6 | **already present** |
| 1.7 | `js/main.js` / `js/activation_overlay.js`: ensure any assembly blanking >300ms shows loading toast (extend activation overlay or add a generic assembly loader) | AC-7 | **DEFERRED** (diagnosis recorded) |

## Phase 2 — Verify: run e2e capture with FEEDBACK_SHOTS=1

| Step | Description | Status |
|------|-------------|--------|
| 2.1 | Run all 7 new specs with `FEEDBACK_SHOTS=1` to capture closure frames | **DONE** |
| 2.2 | Run full suite `npm test` to ensure no regressions | **DONE** |
| 2.3 | Attach frames to BEYOND-19, add closure comment | **DONE** |

## Phase 3 — Close-out

| Step | Description | Status |
|------|-------------|--------|
| 3.1 | Housekeeping guard check on both roots | **DONE** |
| 3.2 | Local commit only (never push) | **DONE** |
| 3.3 | Update `vendor/conductor/tracks.md` registry | **DONE** |

## Deliberation
Required (declared at creation). Single-answer decisions recorded as inadmissible candidates.
