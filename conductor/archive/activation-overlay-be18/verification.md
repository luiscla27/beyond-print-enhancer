# verification.md — activation-overlay-be18

**Date:** 2026-11-01 · **Source issue:** BEYOND-18 · **Verification role:** implementer + e2e witness

## 1. Reproduction (a1) — the class exists in-product, proven by this repo's own harness

| Instrument | Pre-fix result | Meaning |
|---|---|---|
| `test/browser_e2e/beyond18_activation_overlay_repro.spec.js` (page arm) | PASS — no activation/overlay module in the production list parsed from `js/background.js`; no `activation overlay` / `Enhancing sheet` / `be-activation-overlay` string in ANY injected file | The code path had no affordance at all |
| same spec, host arm (`BEYOND18_HOST=1`) | PASS — overlay query returned `[]` on the real boot; no extension-owned spinner node existed | The real boot was extension-invisible, exactly as the unprimed judge priced it |

The judge record (BEYOND-18 description) was filing evidence only. Nothing above reads it.

## 2. Contract (Red → Green)

`test/unit/activation_overlay_contract.test.js` — **6/6 failing before the fix** (module absent from
the injection list; no `#be-activation-overlay`; no theme rules; no `js/main.js` mount/dismiss;
fail-open unproven), **6/6 passing after**:

1. `js/activation_overlay.js` is in the production injection list and precedes `js/main.js`.
2. Mounting produces `#be-activation-overlay` with `data-be-activation-state="active"`, text
   "Enhancing sheet…" and the extension's name.
3. `dismiss()` flips the state to `dismissed` (the node is hidden, never removed — a camera can
   witness both halves).
4. The locked theme stylesheet (`js/ui_theme.js`) carries `.be-activation-overlay` rules.
5. `js/main.js` mounts before `await Storage.init()` and its LAST dismissal follows
   `await restoreLayout()`; the re-run-prompt unwedge dismissal also exists.
6. The module fails open with no `document` (peer-module convention; harness boots).

## 3. Host verification (a2) — the real boot, real browser

| Command | Result |
|---|---|
| `BEYOND18_HOST=1 npx mocha test/browser_e2e/beyond18_activation_overlay_repro.spec.js` | **3/3 passing** — production list carries the module before `main.js`; post-boot state `dismissed` with attribution text; **mid-boot snapshot observed it `active`** |
| `OVERLAY_SHOTS=1 npx mocha test/browser_e2e/beyond18_activation_overlay_capture.spec.js` | **2/2 passing** — mid-transition frame captured while `active`; post-boot frame shows it gone |

**The capture is self-verifying.** It does not merely assert DOM state and then save a picture: it
samples the overlay's OWN box pixels (rect inset 8px) in the captured PNG and FAILS if fewer than 3
of 4 corners are dark. Measured on the shipped frame: overlay rect `[0,0,1265,720]`, corner samples
`[18,15,13] / [50,46,42]` (dark) against a light host page; card ground `rgb(30,24,19)` at centre;
antique-gold spinner pixels present near the card. Two harness defects were found and fixed by that
check rather than shipped:

- **Consent-banner blanket.** The host's Ketch consent overlay is a full-viewport fixed layer at
  `z-index 2147483647` with a semi-opaque white backdrop; it photographs EVERYTHING below it light.
  The capture now dismisses consent first (as `bootPage` does) so a pixel failure means the overlay,
  not the host's z-max blanket.
- **Scrollbar gutter.** Viewport-edge sampling at `x = width - 9` hits the 15px scrollbar (measured
  `236,237,238`), not element paint. Sampling moved to the overlay's own box.

## 4. Regression surface

| Command | Result |
|---|---|
| `npx mocha --recursive test/unit test/e2e test/manifest.test.js` | **2241 passing, 0 failing** |
| `node scripts/smoke_low_risk.js` | **11/11 passing** |
| `npx mocha test/unit/encapsulation_debt/*.test.js` | **423 passing** |
| `npx eslint js/activation_overlay.js js/ui_theme.js js/main.js js/background.js test/browser_e2e/beyond18_*.spec.js test/unit/activation_overlay_contract.test.js` | clean |
| `node --check` on all four touched `js/` files | clean |

`test/unit/dead_exports.test.js` needed a conscious count bump (164 → 167) for the three new
`live` seams — `mountActivationOverlay`, `dismissActivationOverlay` (both called by name from
`js/main.js`, including the re-run-prompt unwedge path) and `__DDBActivationOverlay` (the module's
idempotence guard + the harness handle the closure camera uses). The bump carries its justification
in-line, per that guard's convention.

## 5. Closure artifacts attached to BEYOND-18

- YouTrack comment `7-92` (HTTP 200) carrying the closure narrative + the verify commands.
- Attachments `12-2` `be18-mid-boot-active.png` (102,327 B) and `12-3` `be18-post-boot-dismissed.png`
  (389,677 B), both read back from the tracker after upload.
- Receipt: `temp/issue_filings/BEYOND-18-closure.json`.

## 6. Honesty notes (what this does NOT claim)

- The overlay is verified for **presence, attribution, styling and dismissal**. Its *duration* on an
  uncached first-run profile is not measured here; the overlay is state-driven (dismissed when boot
  completes), so it spans whatever the boot actually takes — no timer to tune.
- **This closure does not re-certify the bundle.** Whether the vision judge now finds a smooth
  activation transition is a re-judgment question, answered only by a future certification run over
  fresh corpus bytes — not by this track.
- The screenshot pair proves the affordance for a mid-boot and a post-boot instant on one host page
  at one viewport (1280×720). It is not a claim about every D&D Beyond layout.
