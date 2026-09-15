https://github.com/user-attachments/assets/1d596af8-59bf-476d-b100-920194e96072


# Print Enhancer for D&D Beyond

**Version 2.0.0** — the 1.4.x line closed. Highlights: one modular architecture instead of the `js/main.js`
monolith, a general undo with a snapshot gate on every destructive action, real shape layers with
per-layer print control, and a printed sheet that is real text. Full list in [CHANGELOG.md](CHANGELOG.md).

Modernized and restored for D&D Beyond 2026 site changes. This extension helps you print your D&D Beyond character sheets in a clean, print-friendly format.

**Credits**: This project is a fork of the abandoned [D&D Beyond Character Sheet Print Enhancer](https://github.com/adam-p/dndbeyond-printenhance) by Adam Pritchard, with significant updates for modern site compatibility and new features. I made this project because I wanted print-ready character sheets for my D&D games without having to manually edit or create the PDF.


**This project is a work in progress. Feature requests, issue reports and pull requests are welcome.**

## Try the Chrome Extension Directly
https://chromewebstore.google.com/detail/beyond-print-enhancer/obmbfcnlmoegklgdlkcanlkiadhengbc


## Try it Live (Developer Mode)

To test the extension locally:
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the root folder of this project.
5. Open any D&D Beyond character sheet (e.g., [this example character](https://www.dndbeyond.com/characters/151911403)).
6. Click the extension icon in your toolbar to activate the print enhancer.
7. Press `Ctrl+P` to view the print preview.

## Tests

**The gates run themselves now, and there is one command that cannot miss them.** `npm test` runs
**lint first**, then unit + integration + the manifest check — so a `console.log` outside the logger
fails the fast gate and names the file and line, rather than being caught by somebody noticing:

```bash
npm test                                   # lint + unit + integration + the manifest check
npm run lint                               # eslint js/ test/ scripts/        (~4 s)
npx mocha --recursive test/unit            # just the unit suites            (~30 s)
npx mocha --recursive test/unit/encapsulation_debt   # the code-debt oracle  (299 cases)
```

The unit and integration suites run in Node against jsdom and need nothing but `npm install`.

The `test/browser_e2e/` suites drive the **real unpacked extension** in Chromium
against the live demo sheet, so they need a browser and a network connection, and
take minutes rather than seconds:

```bash
npm run test:e2e                           # every browser suite
npm run test:e2e:layer                     # ...or one area at a time (see package.json
npm run test:e2e:font                      #    for the per-feature aliases:
                                           #    :layer :font :glow :ornaments :shapes …)
npm run test:e2e:verify                    # the five user-verification checkpoints
```

The `manual_verification_phase0..4` specs are the automated form of the project's
per-phase "user manual verification" step: each drives the walkthrough a person would
perform (select a section from its action bar, click a layer chip, dismiss the
first-run hint, press the rail's Restore control) and asserts what they should see.

**This suite is NOT part of `npm test`, and it cannot be** — it needs a browser, a live network and
about an hour, so per-push is not achievable and saying "we have CI" about it would be false. It gets a
**schedule** instead, which exists because of exactly what this section used to describe as a standing
risk: the suite drifted red (**22 failing cases**) across several releases with nobody noticing,
because the only thing that ran it was a human who remembered
(`temp/archived/ISSUE_browser_e2e_gate_drift_20260912.md`).

**The browser gate runs it and refuses to pass by skipping.** One entry point, used by hand and by the
scheduled task alike, writing a machine-readable artifact and exiting non-zero on anything wrong:

```bash
npm run test:browser-gate            # the whole gate, serial      (measured: 88.5 min)
npm run test:browser-gate:sharded    # 4 shards, set-identical     (measured: 23.4 min)
```

Both write `temp/browser_gate/artifact.json`. It **fails** — with no green artifact — if a spec file
drops out of collection (naming the file), if the pending set stops matching its committed cause map
(`test/browser_e2e/spec_pending.json`), if collection is **empty**, if any case fails, if a second run
holds the guard file, or if the executed set does not account for the collected set. Read the artifact
for *what* failed (`failures_named`, `missing`, `by_spec_diff`); read the exit code for *that* it failed.
The two sharded/serial runs were diffed case-by-case and are identical (`--compare`), and the
`[boot] tolerated … [host]` canary is carried in every artifact so a sharded run that leans harder on
the demo host is visible rather than assumed.

**Registering the schedule is an operator action, and the agent will not do it.** The shape lives in
`browser-gate-task.ps1.fragment` (name, action, trigger, guard, timeout), in the same comment-only form
as the relay's `scheduled-task.ps1.fragment`. The concrete steps:

1. **Task Scheduler → Create Task** (not "Basic Task", so the settings below are reachable).
2. **General:** name the task; "Run only when user is logged on" —
   the gate needs the interactive session (a real Chromium, the network, the demo sheet).
3. **Triggers:** Daily, at a quiet hour. Measured: 88.5 min serial, 23.4 min at 4 shards.
4. **Actions:** Start a program = the `node.exe` this repo's npm uses; arguments
   `"<repo>\scripts\browser_gate.js" --artifacts-dir "<repo>\temp\browser_gate\scheduled"`;
   "Start in" = the repo root.
5. **Settings:** "If the task is already running, do not start a new instance" (the runner refuses
   overlap itself too), and "Stop the task if it runs longer than 2 hours".
6. **Verify after the first run:** Last Run Result is `0x0` **and** `temp\browser_gate\artifact.json`
   reads `"green": true` with `collection.status: "ok"` and `execution.status: "pass"`. Read **both** —
   the artifact says what failed, the exit code is what the scheduler acts on.

One warning worth repeating: a killed run leaves `temp/browser_gate.lock` behind, and the runner clears a
guard whose pid is dead (recording the restart in the artifact) — do not add a second guard at the
scheduler level, because two guards drift and the unwatched one is the one that gets it wrong.

Two harness behaviours are worth knowing when reading a run's output:

* `bootPage` tolerates ONE class of page error — a network failure of the demo **host's** own
  requests while the page boots (`[boot] tolerated 1 HOST network error(s) — Failed to fetch
  [host]`). The live sheet produces these intermittently, and they are not ours: every `fetch`
  in `js/` is rejection-guarded, which `test/unit/browser_harness_boot_tolerance.test.js`
  pins. Everything else — any code error, a network failure over the cap, or a boot that
  never reaches the readiness gates — still fails the boot. The marker line is deliberately
  loud; if it appears often, the host (or the network) is the problem, not the extension.
* A visual-gate capture harness self-skips unless its env var is set, so `pending` in the
  output is a skip, not a failure (the next section lists them).

```bash
# the whole gate, the way a release step runs it
npx mocha test/browser_e2e --recursive --timeout 900000 --reporter spec
```

Some suites are **visual-gate capture harnesses**: they self-skip unless an env var is
set, because they write screenshot evidence rather than asserting behaviour:

```bash
SELECTION_SHOTS=1 npx mocha test/browser_e2e/selection_visual_capture.spec.js
FEEDBACK_SHOTS=1  npx mocha test/browser_e2e/feedback_visual_capture.spec.js
```

Some of these are **probes rather than gates**: they measure something and print it, so they
self-skip unless their flag is set (`ENCODING_SHOTS`, `RECOVERY_DEPTH_SHOTS`,
`REFUSAL_COPY_SHOTS`, `HELP_SHOTS`, `PANEL_MEASURE`) and never fail a normal run. Their
outputs are committed under `vendor/docs/ux-gaps-20260911/`.

Their committed evidence and the deterministic checks over it live under
`vendor/docs/selection-model-ia-20260910/` and `vendor/docs/feedback-lifecycle-a11y-20260910/`
(`scripts/selection_visual_diff.js` re-measures the selection frames; the collage
composers refuse to write a collage whose cells differ in size or scale).

One suite measures the **printed output** rather than the page it came from. It drives the
extension's real print path, then measures the PDF the printer would receive — page box, where
the ink sits on the page, per-page coverage, and what the file carries — and rasterises every
page so it can be looked at and gated. It self-skips without its flag, like the capture suites:

```bash
PRINT_AUDIT=1 npx mocha test/browser_e2e/print_output_audit.spec.js --timeout 1800000
```

Its evidence is committed under `vendor/docs/print-output-audit-20260911/` (page rasters,
`measurements.json`, the visual-gate briefs and verdicts); the audit's findings are in
`vendor/docs/print-output-audit-20260911/audit_report.md`. The sheet's missing text layer, which that
audit handed on, is fixed and re-measured in `vendor/docs/print-sheet-text-layer-20260911/` (its
post-fix artifacts are committed alongside, and the suite's last case now REQUIRES the text layer
instead of only recording it).

The browser suite also gates **responsive scaling** (`test/browser_e2e/responsive_scaling.spec.js`):
the feature once sat inert for its whole life because its only test copied the arithmetic instead of
exercising the wiring, so the browser case asserts the effect on the real sheet — a section scaled down,
its drawn box inside its container, and no `ResizeObserver loop` page error. Its before/after evidence
(page rasters, print measurements, the visual-gate brief and verdicts) is committed under
`vendor/docs/responsive-scaling-wiring-20260913/`.

A second, self-skipping probe measures the one thing the audit cannot — whether a chain with every
filter slider at its DEFAULT value is really neutral, and whether a setting the user makes still
reaches the paper. It drives the panel's own sliders and asserts both:

```bash
PRINT_FILTER_PROBE=1 npx mocha test/browser_e2e/print_filter_identity_probe.spec.js --timeout 1800000
```

## Features

1. **Drag & Drop Layout**: Freely reorder and position any character sheet
   section. Since 1.9.0 the drag is a **pointer-events engine** (mouse,
   touch and pen): drags commit after a ~4px movement so clicks and text
   selection stay intact, the ghost snaps live to the 16px grid with gold
   alignment guides, drops always complete (clamped to the sheet), and the
   layout auto-saves ~1s after the last drop ("Layout saved" toast). Arrow
   keys nudge the selected section (1px; `Shift` = one 16px step) and the
   properties panel shows numeric Position X/Y inputs. **What is selected is one thing**: picking a section on the sheet, picking it from the layer panel, or picking a shape all move the same selection, so the outline, the layer row and the properties panel cannot disagree — and clearing clears all three. See `vendor/docs/selection-model-ia-20260910/` for this track's visual-gate record and `vendor/docs/drag-ux-20260909/` for the drag engine's.
   Since 2.0.1 the move affordance is **shown, not guessed**: hovering a section
   on the active layer puts a nine-dot grip at its centre, and the section drags
   from there. It replaces a green `drop-shadow` that washed the whole section
   when you hovered it (`vendor/docs/sheet-affordances-20260914/`). Dragging the section
   body itself still works exactly as before.
2. **Resizable Sections**: Adjust section width and height to fit your custom layout.
3. **Properties Panel**: A centralized panel to manage the active section's font size, compact mode, and border style in real-time.
4. **Pixel-based Font Scaling**: Granular control over section font sizes (8px to 30px) with proportional scaling for headers and icons.
5. **Decorative Shapes**: Add resizable, rotatable graphical elements to your sheet. Includes a library of borders, corners, and accents.
6. **Custom Asset Upload**: Upload your own image files (PNG, WebP, etc.) to use as custom shapes.
7. **Section Cloning**: Create snapshots of sections like Spells to show different filtered lists (e.g., "Combat" vs "Social") simultaneously.
8. **Dynamic Extraction**: Double-click any block of content (traits, features, actions) to extract it into its own floating, resizable card.
9. **Compact Mode**: One-click condensed view for complex sections to maximize information density.
10. **Border Customization**: Choose from multiple themed border styles (Archer, Barbarian, Goth, etc.) for any section.
11. **Templates**: Apply professional layouts (like the classic Archer theme) instantly.
12. **Global Visual Filters**: Adjust Hue, Saturation, Contrast, and Grayscale for all decorative elements while keeping text legible.
13. **Save & Load**: Persist your custom layouts to browser storage or export them as JSON files to share.
14. **Undo**, for everything, not just deletes. Deleting a layer, a shape, a clone or a
    batch, merging sections, splitting a skills box, loading a layout file — each is
    snapshotted automatically first, and the action is refused outright if that snapshot
    cannot be written. But the stack goes further: **drag to move, resize, rotate,
    reorder layers, move a shape to another layer, toggle compact mode, change a border
    or a shape, flip a layer's lock / print / visibility, rename a layer, add and clone**
    are all reversible too, newest first, one change at a time. Undo is reachable from
    the panel control — which names what it will undo ("Undo: Toggle \"Actions\"") and is
    disabled when there is nothing to undo — and from **Ctrl+Z / Cmd+Z**, which stays
    inert while you are typing in a text field so your typing keeps the browser's undo.
    The history is **per session**; for going back further, or across a reload, a
    **Restore backup...** entry in the control panel lists the automatic backups (what
    each one was, and when) — the newest **ten**, and the dialog says they are saved in this
    browser so they survive a reload, which is the difference from the session-scoped undo.
    The panel's **?** lists the gestures and shortcuts, including the undo keys.
15. **Layer Management**: Organize your decorative elements into layers with custom print Z-ordering and visibility toggles. Per-layer controls are **Skip when printing** (print exclusion) and **Hide on sheet** (on-screen visibility); the layer holding your current selection is the one highlighted, and on a narrow window the panel collapses to a header whose **Restore** control brings the rows back.
16. **Hue Color Filter**: Modify the whole sheet colors.
17. **Shape Rotation**: Persistent 15-degree incremental rotation for all decorative shapes with visual handles.
18. **Quick Switch**: Swap shape assets while perfectly preserving position, size, and rotation.
19. **Gestures & shortcuts reference**: a **?** in the panel header lists every gesture the
    extension adds — drag, corner-resize, the rotation handle, **double-click to extract**,
    **right-click for a layer's menu**, arrow-key nudging, and **Ctrl/Cmd+Z** — so a feature
    you cannot find is a click away instead of a README away. The first-run card carries the
    same **?**, so the reference is reachable from the one moment the product is teaching you
    something, instead of only from the panel header.
20. **Sections shrink to fit, so nothing is cut off** (since 1.17.3). A section whose content is
    taller or wider than its box used to have that overflow silently clipped; the content is now scaled
    down to fit the box instead, on screen and in the printout, and it re-fits when you resize the
    section or change what is inside it.

### The tool's own chrome (since 1.8.0, ornamented in 1.11.0)

On the first run a small card names the three gestures that are otherwise only
discoverable by hovering (drag to move, corner to resize, handle to rotate), and it
carries a **?** that opens the full gestures-and-shortcuts reference — so the one
moment the product teaches you something now points at the rest of it instead of
being a dead end. (Its sentence is *derived* from the same list the reference
renders, so the two cannot disagree.) Press **Got it** and it never returns; it
sits inside the control panel, so it never covers the sheet you are arranging.

### Folding the panel

Each of the panel's four sections — **LAYOUT**, **OUTPUT**, **PROPERTIES** and **CANVAS FILTERS** —
has a heading you can click to fold that section away, and the heading is a real button, so the
keyboard works too (Enter or Space, with the state announced to screen readers). Fold every one and
the panel's content drops from **1120px to 323px**, which takes it from overflowing its own window by
534px to not overflowing at all — so it sits beside the sheet instead of over it, and every control is
still there when you unfold it. Focus is never left stranded inside a folded section, and the fold is
not remembered between visits: the panel always opens expanded.

**Nothing was removed or reordered to make this fit.** Which control comes first, and which are above
the fold, were measured in 1.16.0 and are unchanged; folding is a new thing you can do, not a change
to what is there.

### Turning it off

The panel header carries a **power control**. Choosing it saves your layout and reloads the page,
leaving a sheet with **none of the extension in it** — no panel, no styling, no listeners (measured,
not promised: the browser suite asserts that not one of the seven injected stylesheets survives).
Your arrangement is saved first, so nothing is lost.

The extension is **off after every reload** — that is what activating it from the toolbar icon does,
and clicking that icon again is how you bring it back. The icon also **shows when it is on** (an
**ON** badge), so you can tell whether the tool is active on the page in front of you without
looking for the panel. An earlier version of this section would have had to say "reload the page to
get rid of it, and hope you noticed that was the way out"; it no longer does.

The panels and modals carry a deliberately restrained **D&D 3.5 "codex on the
workbench"** identity: oiled-leather grounds, antique gold used as *light* (hair
lines) rather than fill, and a **double hairline with a leather gap** plus
**spiky 12px corner terminations** framing the control panel, the layer manager
and every modal. It is ornament, not decoration for its own sake: context menus
and the colour picker keep a single quiet rule, and the toasts, in-sheet action
buttons, cards, pills and tabs get **no** ornament at all, so the character
sheet stays the thing you look at.

Every clickable control also follows one **fixed height tier** — action buttons
32px, icon-only controls 28×28px, chips and pills 22px, inputs 32px, list rows
40px — so nothing looks accidentally misaligned when a label is short or long.

### Dialogs (since 1.12.0)

The extension's dialogs — the name prompt, the value slider, the layout-JSON
fallback, the recovery card, the append-target picker, Manage Clones and Manage
Compact — are built from one shared dialog shell, so they all behave the same
way: **✕**, **backdrop click** and **Escape** all close them, they carry a
proper dialog role and an accessible name for screen readers, and focus moves
into the dialog when it opens and back to where you were when it closes.

Since 1.13.0 there are **no browser-native confirms or alerts left**: every
confirmation (including every delete) and every error message is the
extension's own dialog or toast. A dialog you dismiss always counts as "no", so
nothing destructive can happen from a prompt you never actually saw.

### Messages, empty states and the layer menu (since 1.13.2)

Feedback now waits for you instead of expiring:

- **Toasts are dismissible** — each carries a ✕ (or press Escape while it has
  focus), and they **stack down the top of the sheet** rather than covering one
  another. Dismissing one is announced to screen readers.
- **A failure is never dropped.** The old stack cap removed the oldest message
  whatever it was, so a rapid save-then-error sequence could throw away the error
  before you read it. Errors are now kept; the cap applies to the ordinary ones.
- **Starting a session tells you which layout is showing** — "Restored your saved
  layout." or "No saved layout yet — the default template is loaded.", so a
  restored layout and a defaulted one are no longer indistinguishable.
- **"Nothing found" opens a dialog that stays** ("No clones found", "No available
  targets found", "No compact-compatible sections found"), each with a suggested
  next step, instead of a toast that vanished after three seconds.
- **The layer right-click menu is fully keyboard-operable** — `role=menu`, focus
  moves in on open, arrow keys move (wrapping), Home/End jump, Enter activates,
  Escape closes and returns focus to the layer you right-clicked. It is also
  **clamped inside the window**, so right-clicking near an edge no longer opens it
  partly off-screen.

### Picker UX (since 1.9.1)

Borders, shapes, section styles and custom uploads share ONE picker shell
(`showAssetPickerModal` — modes *Add Shape* / *Switch Shape Asset* /
*Section border style*), with a single catalog source, per-flow copy and an
OK button that stays disabled until you actually change the selection (no
stray-Enter commits). The picker is keyboard/cancel-safe (Enter honors the
focused control, Esc / ✕ / backdrop cancel, focusable option cells with
arrow-key navigation), assets show curated names under family-group headers
with live search, and hovering a style or asset tile **tries it live on the
real section/shape** (dashed-gold outline) with an exact restore when you
leave — no more blind commits. Add mode shows an enlarged in-modal preview
instead. See `vendor/docs/border-shape-picker-ux-20260909/` for the per-phase
visual-gate record.

### Custom upload & templates (since 1.9.2)

Uploading a custom shape from the Custom tab no longer closes the picker or
drops an unpositioned shape: it saves to your library and the picker stays
open with the new shape preselected — **Add Shape / Switch Asset** places
it, **Cancel** is save-to-library only. The **Templates** catalog is now a
single, keyboard-safe modal (Esc/✕/backdrop, focusable cards, in-modal
detail and an apply-confirm), and the Basic + Archer template cards show
real captured thumbnails. See `vendor/docs/custom-upload-templates-ux-20260909/`
for the per-phase visual-gate record.

### Shape layers (since 1.10.0)

The layer panel is a flat, Photoshop-style layer list. You build multiple
layers by **splitting** shapes out of the default one: right-click a shape
chip → **Move to New Layer…** (the layer takes the shape's name) or **Move to
Layer…**. Layer **rows are draggable** to restack the list (which sets the
print z-order), **Sections** stays pinned below as its own band, and rows only
drag while their layer is unlocked. Chips show curated names, rows show live
counts, empty layers say "Empty — drag a shape here", and **Ctrl/Shift-click**
multi-selects shapes for batch **Split each into its own layer / Move
selected / Delete selected** (atomic with rollback). See
`vendor/docs/shape-layer-ps-ux-20260909/` for the per-phase visual-gate record.

### Trust & editor fixes (since 1.10.1)

A full-surface UX audit (35 findings, `vendor/conductor/archive/ui_ux_review_20260910/`)
produced this patch set, scoped against the *"click once, then print"*
contract:

- **Your saved layout is safe.** *Reset to Default* writes a timestamped
  backup **before** erasing anything (the newest 3 are kept) and its in-app
  confirmation says exactly what is deleted; if the backup cannot be written
  the reset is aborted. If a saved layout fails to load you get an explicit
  recovery card (restore a backup / start fresh) instead of silently landing on
  the default template, and *Load* warns before replacing your layout while
  naming the file.
- **Failures look like failures.** Error toasts are visually distinct from
  success ones (warning glyph + danger accent) and are announced to screen
  readers; Save to PC reports a scan failure instead of failing silently.
- **"Locked" means read-only, not unreachable.** Locking a layer stops it being
  dragged/resized/rotated while its own controls stay visible and usable, and
  adding a shape no longer locks every other layer.
- **The rotate/resize handles rotate and resize** — they no longer also start a
  move drag.
- **Spell-detail *Retry* actually retries**, and a chip click toggles the
  selection instead of clearing it.

Deferred findings (the remaining audit items) are tracked in `temp/issues/`.

## Module map

As of v1.7.0 the extension's `js/` runtime is a set of small, focused
modules loaded in dependency order (single source of truth:
`js/background.js` `chrome.scripting.executeScript` `files` array). Each
module registers on `window.<Name>` (content scripts) and via
`module.exports` (Node tests). Modules depend only on modules listed
earlier in the load order; `js/main.js` is the orchestrator that wires the
boot sequence and the `window.*` test surface.

Design system (v1.8.0 "3.5 Codex on the Workbench"): `js/ui_theme.js`
injects the leather-and-bone token set (leather-black grounds, bone text,
antique gold as light, oxblood/ember semantics — see
`vendor/docs/dnd35-nostalgia-20260908/` for the art-direction contract) and the
chrome component skin; `js/icons.js` provides the 16px SVG line-icon set
used by the panel,
in-sheet action bars and the layer manager (semantic `data-state`).

- `js/catalog_service.js` — premade template catalog + apply.
- `js/spells.js` — spell-view legacy helpers.
- `js/dom/element_wrapper.js` — ElementWrapper (single-element DOM handle).
- `js/dom/dom_manager.js` — DomManager singleton (layout roots, layers, selectors).
- `js/dom/layer_manager.js` — LayerManager (sections/shapes layers, print z-order).
- `js/storage.js` — IndexedDB data-access (`window.__DDBStorage`): layouts, filters/hue, custom shapes, spell cache, migration/validation.
- `js/image_processor.js` — canvas read/resize/compress for uploads.
- `js/section_utils.js` — title discovery, slug/sanitize, selectors + shared `applyFontSize`/`refreshLayers`.
- `js/print_styles.js` — injected `@media print` CSS, layout bounds, page separators, compact CSS, base styles (`enforceFullHeight`).
- `js/asset_catalog.js` — asset lists/metadata, `ALL_BORDER_STYLES`, `parseAssets`.
- `js/context_menu.js` — context-menu primitives.
- `js/section_cloning.js` — clone/extract snapshot render + rollback.
- `js/layout_ops.js` — portrait/quick-info/ability separation, search-box cleanup, inner-width adjust.
- `js/filters.js` — global filter CSS composer + border-style helpers.
- `js/spells_ui.js` — floating spell-detail sections + spell fetch/cache.
- `js/ui_theme.js` — design tokens + chrome skin — "3.5 Codex on the Workbench" leather-and-bone identity (grounds/seams/bone/gold/oxblood/ember, engraved display type, Signet Print plaque, sheet-edge buffer, unified range chrome).
- `js/icons.js` — 16px SVG line-icon language.
- `js/modals.js` — input/slider/fallback modals + feedback toast.
- `js/shape_picker.js` — the unified asset/style picker shell (`showAssetPickerModal`; borders/shapes/custom tabs, section styles, curated groups + search, live hover "try it", upload-from-disk).
- `js/properties_panel.js` — active-section state + properties panel.
- `js/controls.js` — fixed control panel (buttons, filter sliders, color picker).
- `js/layout_scan.js` — DOM→data layout serialization + migration.
- `js/layout_apply.js` — layout data→DOM restoration.
- `js/persistence.js` — user save/load/restore/default flows.
- `js/dnd.js` — drag & drop engine + dnd styles (pointer-events engine,
  live 16px grid snap, gold alignment guides, debounced auto-save).
- `js/main.js` — orchestrator: init guard, boot sequence, resize/scroll interception, remaining interactive glue, `window.*` export table.

Encapsulation history is tracked in `vendor/conductor/tracks/encapsulation_functionality_20260907/`.

## Instructions for use

1. View your character sheet.
2. Click the Beyond Print Enhancer button on your browser toolbar on your PC.
3. Open the print dialog (ctrl+p/cmd+p).
4. Print settings (the panel's **Print settings** control lists these in-app, at the
   moment you print):
  - Color: Probably black and white.
  - Scale: Actual size.
  - Headers and footers: deselect.
  - Background graphics: deselect.
  - **Margins: you do not need to set these.** The extension sets its own margins in
    its print stylesheet, which overrides the print dialog's margin setting — so changing
    it has no effect. Measured, with the method and its control, in
    `vendor/docs/first-run-and-panel-20260911/phase2_print_settings.md`.
5. Review the print preview.
6. Print!

## Known issues

1. The extension does not work on mobile browser devices nor the D&D Beyond mobile app.
2. The extension is not meant to let you edit your character sheet nor throw dices. Only the SPELL section "Manage spells" should be usable.
4. Spell description sheets can ONLY gather information from the original "known spells" of D&D Beyond. The tool mitigates this by saving previously known spells. However, if a description was never seen before, it will not be available.

## Legal ##
Beyond Print Enhancer is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
