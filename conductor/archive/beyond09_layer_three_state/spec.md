# spec — BEYOND-9 / SC-C2: Per-layer three-state control (Print only / Screen only / Both)

Track: `beyond09_layer_three_state` · parent + tracked issue **BEYOND-9** · created 2026-11-01
Scope: one YouTrack card, executed as a conductor track by an external orchestrator-spawned session.

## The card (verbatim, from the BEYOND tracker)

> **BEYOND-9 — [UX Gap] SC-C2: Per-layer three-state control (Print Only / Screen Only / Both)
> missing — test shows basic enable/disable only**
>
> UX Gap from e2e test matrix (approved scores 2026-10-25). Scenario SC-C2 (UC-04: Managing Layers
> for Print). Composite UX Score 2.0 (critical gap). Evidence from matrix & specs:
> - `layer_print_visibility.spec.js` tests basic layer enable/disable only
> - Three-state control (Print Only / Screen Only / Both visible) is designed but not implemented
> - Current UI only has a toggle, no three-state selector
> - This directly impacts users who want layers visible on screen but hidden from print (or vice versa)
>
> Gap classification: Feature absent — the three-state mechanism does not exist in the codebase.
> Priority P1 (High) — daily workflow blocker for layer management. Quick win: YES — UI addition
> only, no backend changes needed (VERIFY that claim yourself against the code before trusting it —
> print rendering and persistence may already be structured to carry a per-layer visibility field,
> which would make it genuinely a quick win, or may not, in which case you must say so).

### Acceptance criteria (the card's own words — all five must be met and measured)

- **AC-1** — Layer panel shows three-state selector per layer (Print Only / Screen Only / Both).
  Vehicle: `test/browser_e2e/layer_print_visibility.spec.js`, which must show a strip on EVERY layer
  group (not only `sections`), the three modes named in the criterion's words, and exactly one pressed.
- **AC-2** — Print preview respects Print Only / Screen Only states correctly. Vehicle: the same spec,
  with the print **media emulated** (`page.emulateMedia({media:"print"})`) reading the RENDERED computed
  style — not only the stylesheet text.
- **AC-3** — Settings persist three-state selection across reloads. Vehicle: the same spec, a real
  `page.reload()` + reinject through the product's own save/restore seams, with ONE user click and no
  Save click in the flow.
- **AC-4** — E2E test `layer_print_visibility.spec.js` extended to cover all three states. Vehicle: the
  spec file itself, extended in place (no sibling/fork).
- **AC-5** — Gate G-PIX-OVERFLOW and G-PERSIST pass for the new states. Vehicle: the spec's own two gate
  cases — no horizontal overflow of the strip inside the real 248px panel, and the persisted-record
  round-trip (now including the reload half above).

## Pre-work finding — the card's premises are STALE (measured, not assumed)

The card says the mechanism "does not exist". By the time this track opened, **it does**:
commit `ac3c72f` (track `ux_quick_wins_20261025`, 2026-10-26) shipped it as that track's AC-1:

- `js/dom/layer_manager.js` — `LAYER_MODES` triple (:59-75), `layerModeOf()` derivation (:78-84),
  `setLayerMode()` / `_setLayerModeNow()` (:509-533), `syncModeStrip()` (:486-500), the strip DOM
  (:643-678), and `dataset.printOnly` / `dataset.printDisabled` / the on-screen hide (:1671-1679).
- `js/print_styles.js:24-82` — the print rules: `data-print-disabled` → `display:none !important`,
  `data-print-only` → `display:block !important` (the print-time UNDO of the on-screen hide).
- `js/ui_theme.js:1146-1183` — the themed strip (`.be-layer-mode-strip` / `.be-layer-mode-seg`).
- `test/browser_e2e/layer_print_visibility.spec.js:180-427` — six AC-1 cases already in the spec.

The card's own "Quick win: YES — UI addition only" claim is therefore **half true**: the *UI*
addition was cheap, but it was not UI-only — `js/print_styles.js` needed a new print rule (the
on-screen hide is an inline `display:none`, and only an `!important` print rule can undo it), and
the storage path had to already carry the two flags per layer. It did (`js/layout_scan.js:99-148`,
`js/layout_apply.js:34-64`), which is why the schema stayed unchanged.

So this track is NOT a greenfield build. It is the **card-closing certification pass**, and what it
must add is exactly what the shipped work left unmeasured:

1. **AC-2 is asserted at the wrong layer.** The existing cases assert the print *stylesheet text*
   (`/#print-enhance-sections-layer\s*\{[^}]*display:\s*(none|block) !important/`). A stylesheet
   that says the right thing while the rendered element stays visible would pass. The card says
   "print preview **respects** the states", so the proof has to be the rendered computed style under
   emulated print media.
2. **AC-3 is asserted at the wrong boundary.** The existing G-PERSIST case reads `scanLayout()`'s
   record (the *shape that gets persisted*) and re-derives the mode from it. It never reloads. The
   card says "across reloads", so the proof has to be a real `page.reload()` + reinject and then the
   restore path's own read-back.
3. **AC-1 says "per layer".** The existing cases only ever look at the sections group.

## Scope (files this track may touch)

- `test/browser_e2e/layer_print_visibility.spec.js` — the card names this spec; extend in place (AC-4).
- `js/dom/layer_manager.js` — only if a measured defect requires it.
- `js/print_styles.js` — only if a measured defect requires it.
- Track record: `conductor/archive/beyond09_layer_three_state/**`.
- NOT in scope: `vendor/**` (drift check must stay green), tracker writes (the orchestrator's act).

## Out of scope / recorded follow-ups

- The **fourth corner** of the two-flag space (`isHidden && isDisabledOnPrint` — hidden everywhere)
  is not one of the three modes. `layerModeOf()` returns the honest `'hidden'` for it and the strip
  then lights no segment. Pinned by a case; not "fixed", because inventing a fourth segment would
  answer a question the card did not ask.
- The sibling row toggles (hide / print-off / lock) have the same autosave gap that AC-3 exposes
  here. Fixing them is not this card; it is reported as a finding with the measurement that proves it.
