# final_report.md — activation-overlay-be18

**Track:** activation-overlay-be18 · **Source issue:** BEYOND-18 · **Date:** 2026-11-01
**Status:** COMPLETE — archived 2026-11-01 · local commit only, nothing pushed.

## What the finding was, in the operator's own terms

You said it first: *"a basic feature we are missing on the 'first run' is very basic 'loading…' overlay
to smoothly go to the transition from the original DnD character sheet, to our print enhancer UI."* The
goal-grounded certification then confirmed it **unprompted** — the unprimed control arm found the
missing activation/loading affordance in **12 of 19 bundles**, repeatedly pointing out that *the only
spinner on screen belonged to D&D Beyond*. That is the certified class this track closes: during the
plain-sheet → enhanced-sheet transition, the extension was INVISIBLE.

## What shipped

| Surface | Change |
|---|---|
| `js/activation_overlay.js` (new) | Mounts `#be-activation-overlay` at module evaluation — i.e. before `js/main.js`'s async boot begins. Names the work ("Enhancing sheet…") and the extension ("by Print Enhancer" on first boot, remembered after). Extension-owned antique-gold spinner. Dismissible by click and Esc. State is a DOM attribute (`active` → `dismissed`) rather than a removal, so a camera can witness BOTH halves of the transition. Fail-open with no `document`. |
| `js/main.js` | `mountActivationOverlay()` before `await Storage.init()`; `dismissActivationOverlay()` after `restoreLayout()`/`applyDefaultLayout()` + `announceBootRestore()` (the transition ends when the user learns what layout they got); an extra idempotent dismissal unwedges the re-run-confirmation refusal path. |
| `js/ui_theme.js` | `.be-activation-overlay*` rules in the locked theme stylesheet (leather ground, bone text, antique-gold spinner, blind-tooled seam, brass focus ring), z-index 2147483646 so it sits above the host page's own top chrome, and the overlay joins the print-reinforcement block so it can never reach paper. |
| `js/background.js` | `js/activation_overlay.js` added to the production injection list immediately before `js/main.js`. |

## Verification (every command re-run after the final edit)

| Instrument | Result |
|---|---|
| `test/unit/activation_overlay_contract.test.js` | **6/6 passing** (was 6/6 failing pre-fix — the Red baseline) |
| `BEYOND18_HOST=1 npx mocha test/browser_e2e/beyond18_activation_overlay_repro.spec.js` | **3/3 passing** — module in the production list before `main.js`; real boot mounts ACTIVE then DISMISSED; **mid-boot snapshot observed ACTIVE** |
| `OVERLAY_SHOTS=1 npx mocha test/browser_e2e/beyond18_activation_overlay_capture.spec.js` | **2/2 passing** — self-verifying mid-transition frame + post-boot frame |
| `npx mocha --recursive test/unit test/e2e test/manifest.test.js` | **2241 passing, 0 failing** |
| `node scripts/smoke_low_risk.js` | **11/11 passing** |
| `npx eslint` (6 files) · `node --check` (4 js files) | clean |
| `python vendor/housekeeping_guard.py check` (both roots) · `check --root vendor` | **OK** — 0 debt; criteria sealed (8 labelled); deliberation ADMITTED |

## The two harness defects the capture check found (and fixed, not shipped)

1. **The host's consent banner is a z-max blanket.** Ketch's consent layer is `position: fixed;
   inset: 0; z-index: 2147483647` with a semi-opaque white backdrop — everything under it photographs
   light. A naive "did the overlay paint" pixel check fails for the WRONG reason. The capture now
   dismisses consent first, as `bootPage()` does.
2. **The scrollbar gutter is not paint.** Sampling the screenshot's viewport edge at `x = width - 9`
   measured the 15px scrollbar (`236,237,238`). Sampling moved to the overlay's own box rect.

Both were caught because the capture asserts on PIXELS rather than on DOM state alone. A screenshot
that cannot fail is decoration; this one found two real problems before it passed.

## Honest limits

- Verified for presence, attribution, styling, dismissal, print-exclusion and fail-open behaviour. The
  overlay's on-screen DURATION is not measured on an uncached first-run profile — it is state-driven
  (dismissed when boot completes), so there is no timer to tune, but "how long a cold first run shows
  it" is unmeasured.
- **This track does not re-certify the bundle.** Whether the vision judge now reads a smooth activation
  transition is a re-judgment question, answered only by a future certification run over fresh corpus
  bytes.
- The screenshot pair covers one host page at one viewport (1280×720), not every D&D Beyond layout.

## Tracker close-out

- **BEYOND-18** — closure comment `7-92` (HTTP 200) with the full narrative and commands; attachments
  `12-2` `be18-mid-boot-active.png` (102,327 B) and `12-3` `be18-post-boot-dismissed.png` (389,677 B),
  both read back from the tracker.
- Receipt: `temp/issue_filings/BEYOND-18-closure.json`.
- Remaining sibling issues in the same certified family (BEYOND-19..28) are untouched by this track and
  stay in Triage — this track fixed ONE class, as scoped.

## Files

- Implementation: `js/activation_overlay.js`, `js/main.js`, `js/ui_theme.js`, `js/background.js`
- Tests: `test/unit/activation_overlay_contract.test.js`,
  `test/browser_e2e/beyond18_activation_overlay_repro.spec.js`,
  `test/browser_e2e/beyond18_activation_overlay_capture.spec.js`,
  `test/unit/dead_exports.test.js` (count bump 164 → 167, justified in-line)
- Artifacts: `vendor/docs/activation-overlay-be18/{be18-mid-boot-active,be18-post-boot-dismissed}.png`
- Record: this folder (metadata.json + spec.md + plan.md + verification.md + final_report.md +
  deliberation/{meta.json, candidate_a…, candidate_b_c_inadmissible, evaluation_matrix,
  counterfactual_ledger}.md)
