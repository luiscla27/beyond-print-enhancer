# Plan — visual_capture_red_closure_20261031

Operator ruling (2026-10-31, verbatim): *"Fix all 6 real gaps in js/, and update those 5 stale
assertions minimally in the spec files (documented as superseded behavior; they stay the
acceptance harness, still asserting the intended end state)"*. This supersedes spec.md's original
"the 5 spec files are NOT modified" boundary.

Track creation declared `deliberation: required` (operator mandate 2026-09-23). Deliberation is
recorded in `deliberation.md`; the single-answer framing (fix product vs. move the goalposts) is
adjudicated by the operator ruling above rather than padded with a straw rival.

## Phases

- [x] **Phase 0 — Reproduce.** Run the 5 suites with their SHOTS flags through the inventory
  runner's exact mocha invocation (`spawnSync mocha.js --reporter json --require
  scripts/e2e_video_preload.js`), confirming the archived counts, and measure each root cause on a
  real booted MV3 page instead of reading the failure text as the diagnosis.
- [x] **Phase 1 — Product fixes in `js/`.**
  - [x] `js/print_styles.js` — the locked, non-active SHAPES layer stops eating the pointer
    (`pointer-events: none !important` on its wrappers and their subtree). This is what made the
    section wrappers undraggable and the 🎯 select-section button unclickable.
  - [x] `js/shape_picker.js` — Escape in the search field is two-step: clear a non-empty query,
    bubble an empty one so the modal's own window handler closes the sheet.
- [x] **Phase 2 — Minimal spec updates (5 stale assertions, each marked SUPERSEDED BEHAVIOUR).**
  - [x] `custom_templates` ×2: single-overlay in-modal detail (was `nOverlays >= 2`); apply control
    found by class (was `/apply/i`, retired by the ratified "Continue…" vocabulary).
  - [x] `shape_layer_ps` ×2: the input modal's primary control found by class (was `textContent
    === "OK"`).
  - [x] `ui_ux_audit` ×4 (3 failing + 1 latent): the save action's own toast selected by text (a
    boot restore-confirmation success toast legitimately sits in front of it); both IndexedDB opens
    attach to the shipped DB version instead of a frozen 4; the destructive Reset gate accepts the
    shared primitive's `alertdialog` role; the rotation-reveal step resolves the shape's own layer
    and unlocks it only when actually locked (it used to blind-toggle and re-lock it).
- [x] **Phase 3 — Verification (AC-7, real browser).** All 5 suites green: drag_ux 10/10,
  ui_ux_audit 4/4, custom_templates 6/6, picker_ux 18/18, shape_layer_ps 7/7 — 45/45.
  Evidence: `verification.md`.
- [x] **Phase 4 — AC-6 regression.** `npm run lint` clean; `npm test` 2235 passing / 0 failing.
- [x] **Phase 5 — Close-out.** `verification.md`, tracks.md row, CHANGELOG entry, housekeeping
  guard, local commit only (never push). DONE 2026-10-31: verification.md written (45/45 +
  live probe evidence + 8 supersessions re-checked against product source); registry row added;
  CHANGELOG Unreleased entry; guard green at both roots; local commit (SHA in the commit log).
