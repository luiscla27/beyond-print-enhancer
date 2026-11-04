# spec.md — activation-overlay-be18

**Source:** BEYOND-18 (YouTrack). msf_key `BEYOND-CERT-ACTIVATION-TRANSITION-OVERLAY-20261101-GOALGROUNDED-RECERT`.
**Filing verdict:** The goal-grounded certification re-run (MiniMax-M3.1-Flash vision seat, prompt v2/v3, 19 bundles) found — **unprimed, in 12/19 bundles of the control arm** — that the extension's activation transition is invisible to the user: the enhanced sheet and panels "simply appear" with no extension-specific loading/processing state. First-run users see D&D Beyond's own page spinner (website-owned, correctly attributed), then a wholly new UI with no indication that an extension did the work or what changed.

**Verbatim judge hits (control arm, unprompted):**
- "No explicit activation transition from the plain sheet to the enhanced sheet is captured; the enhancement simply appears as the page loads." (f18)
- "The enhancement appears abruptly near the end; no clear extension-specific loading or activation transition is visible." (f08)
- "No extension-specific activation/loading indicator is visible; the only spinner belongs to D&D Beyond." (f10)
- "The extension activation transition itself is brief and partly obscured by the panel appearance. The enhanced template and panels appear together rather than showing a clear progressive loading/transition state." (f09)
- "No dedicated loading indicator for AI work: … no extension-specific 'arranging'/pending state is visible." (f01)

**Scope (exact, per filing):**
1. Reproduction: instrument the project's own e2e harness to prove the absence class exists in-product (not by re-reading the judge record).
2. Fix: an extension-owned, theme-consistent "Enhancing sheet…" activation affordance visible from content-script boot until the enhancement sequence (layout apply + restore) completes — dismissible on completion, with a brief first-run note naming the extension.
3. Closure: re-run the same e2e instrument, attach the result/screenshot to BEYOND-18, archive the track, commit (local only).

**Constraints (inherited, binding):**
- This track MAY edit `js/**` (it is a product-fix track, unlike the certification tracks).
- Local commits only — never push.
- Theme vocabulary: the extension's own charcoal/brass `be-*` design language (see js/modals.js `showFeedback`, js/ui_theme.js); the overlay must not borrow D&D Beyond's spinner (that is website-owned and the whole point of the gap).
- Test harness boot declares `window.__DDB_TEST_MODE__`; the production boot sequence (`js/main.js` async IIFE, ~line 3222) is the injection site: overlay DOM must exist BEFORE `Storage.init()` starts and must be dismissed after `restoreLayout()`/`applyDefaultLayout()` and `announceBootRestore()` settle.
- The re-run confirmation dialog (`askConfirm` for an existing `print-layout-wrapper`) runs inside the boot sequence — the overlay must survive a "reload?" prompt refusal path without wedging the page.

**Out of scope (deferred to other BEYOND items):**
- Progress feedback during long operations once booted (BEYOND-19).
- Save confirmation toasts (BEYOND-20).
- AI-operation pending states beyond the boot overlay's lifetime (BEYOND-19).

## Acceptance Criteria

- [AC-1] **reproduce before fixing.** The absence class is proven by this repo's own instrument on the
  pre-fix tree — not by re-reading the judge record. Instrument: the production injection list parsed
  from `js/background.js` carries no activation affordance, and the real host boot exposes no
  extension-owned loading node. Evidence: the recorded pre-fix run and its result in verification.md §1.
- [AC-2] **extension-owned affordance.** A DOM node `#be-activation-overlay` exists, mounted before any
  boot work (ahead of `await Storage.init()`), carrying `data-be-activation-state="active"`.
- [AC-3] **attribution.** The overlay names the work it is doing ("Enhancing sheet…") AND the extension
  ("Print Enhancer") — the certified gap was precisely that the only visible spinner belonged to
  D&D Beyond and nothing told the user an extension had changed the sheet.
- [AC-4] **dismissal + witnessability.** The overlay is dismissed on completion (state flips to
  `dismissed`, node retained so a camera can witness both halves), is click- and Esc-dismissible, and
  never wedges on the re-run-confirmation refusal path.
- [AC-5] **theme + print integrity.** Styling is owned by the locked theme stylesheet
  (`js/ui_theme.js`), not a parallel sheet, and the overlay is hidden by the print-reinforcement block.
- [AC-6] **fail-open.** Evaluating the module without a `document` neither throws nor mounts (the peer
  module convention that keeps standalone/mjsdom harness boots alive).
- [AC-7] **on-camera proof.** A captured frame taken while the overlay is `active` passes a
  self-verifying pixel check (its own box corners are the overlay's backdrop), and a post-boot frame
  shows it gone. Artifacts attached to BEYOND-18.
- [AC-8] **no regression.** The full unit/e2e suite and the low-risk smoke set stay green; the dead-export
  count bump for the new seams is justified in-line where the count is asserted.

