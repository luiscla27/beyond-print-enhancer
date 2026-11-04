# plan.md — activation-overlay-be18

**spec:** spec.md · **source issue:** BEYOND-18 · **deliberation:** declared at creation (meta.json + evaluation_matrix.md)

## Steps

- [x] 1. Reproduce the absence class with the project's own harness (filing a1): a focused e2e/wire check asserting NO extension-owned loading affordance exists at boot on the pre-fix tree → RED baseline recorded.
  - DONE 2026-11-01: `test/browser_e2e/beyond18_activation_overlay_repro.spec.js` page arm PASSED on the pre-fix tree (no overlay module in production list, no overlay node anywhere in js/) and the host arm (real boot, BEYOND18_HOST=1) returned `[]` for the overlay query — absence confirmed in-product by the project's own harness, independent of the judge record.
- [x] 2. Red phase: author the post-fix assertions as failing tests (overlay present at boot with `#be-activation-overlay` + `data-be-activation-state="active"`, theme CSS applied, dismisses after boot with `data-be-activation-state="dismissed"`, click-dismiss path, test-mode safety).
  - DONE: `test/unit/activation_overlay_contract.test.js` — all 6 assertions failed on the pre-fix tree (RED baseline: module absent from injection list; no #be-activation-overlay; no theme rules; no main.js mount/dismiss; fail-open unproven).
- [x] 3. Green phase: implement `js/activation_overlay.js` (mount/dismiss, be-* charcoal/brass styling, first-run note naming the extension) + theme CSS in `js/ui_theme.js` (leather/bone/antique-gold vocabulary, z-index 2147483000, print-reinforced hidden); wire into `js/main.js` boot IIFE (mount before `Storage.init()`, dismiss after `announceBootRestore`, unwedge on the re-run-confirmation refusal path) and the production script list (`js/background.js` injection order: activation_overlay.js immediately before main.js).
  - DONE: 6/6 contract assertions pass; harness boot tolerance (21) and encapsulation debt (423) suites green; eslint clean on all four touched files.
- [x] 4. Refactor/verify: run the focused tests + the activation-relevant suite subset; keep the re-run-confirmation (`askConfirm`) path unwedged; confirm no regression in suites that boot main.js standalone.
  - DONE: re-run-confirmation refusal path gets its own dismiss (idempotent); standalone-boot suites green; host-arm e2e (mid-boot ACTIVE snapshot + post-boot DISMISSED) — see verdict.md for the measured result.
- [x] 5. Closure evidence: run the e2e activation check post-fix, capture screenshot/JSON proof, attach to BEYOND-18 as closure evidence (a2), write final_report, guard green, archive track, registry row, local commit (never push).

  - DONE 2026-11-01: `OVERLAY_SHOTS=1 npx mocha test/browser_e2e/beyond18_activation_overlay_capture.spec.js` → the SELF-VERIFYING capture passed (it samples the overlay's own box pixels in the PNG and fails when the backdrop is not painted) and shipped `be18-mid-boot-active.png`; the post-boot frame shows it gone. Both attached to BEYOND-18 (attachments 12-2 / 12-3) with the closure comment 7-92; receipt `temp/issue_filings/BEYOND-18-closure.json`. Guard green on both roots; criteria sealed (8 labels); deliberation admitted; track archived; registry row added; local commit only.

## Notes

- The uncached/first-run boot duration is the one distributional unknown (affects overlay dwell only, not contract); the overlay is state-driven, not timer-driven, so no measurement blocks the fix.
- Test-harness boot (jsdom/page templates) may not have a real extension runtime; module must be fail-open exactly like its peers. VERIFIED: contract test #6 boots the module with `document: undefined` and asserts no throw, no mount.
