# Re-Certification Verdict — e2e_feature_inventory_recert_20261101

**Date:** 2026-11-01
**Certifier:** MiniMax-M3.1-Flash (pinned, official api.minimax.io)
**Model resolution:** operator phrase 'minimax 3.1 flash' pinned to MiniMax-M3.1-Flash; re-verified live this session via GET https://api.minimax.io/v1/models -> 200 OK, 'MiniMax-M3.1-Flash' first entry of the model list (owner minimax, created 1789556118) — model id used verbatim in every call, never substituted
**Evidence source:** Archived track `e2e_feature_inventory_minimax_20261029` (all 82 suites, full video)
**Trigger:** Closure of 11 RED visual-capture tests (commit 2e4dc0e) — 5 suites improved from 34/45 to 45/45

## Per-Feature Results

| Feature | Mocha (archived) | Mocha (fresh) | Videos | MiniMax Verdict (NEW) |
|---------|------------------|---------------|--------|----------------------|
| feature_01_ai_arrange | N/A | N/A | 1 | **PARTIAL** *(was PARTIAL)* |
| feature_02_ai_borders | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_03_layer_management | N/A | N/A | 2 | **PARTIAL** *(was PARTIAL)* |
| feature_04_shape_picker | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_05_controls_panel | N/A | N/A | 2 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_06_print_styles | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_07_persistence | N/A | N/A | 3 | **PARTIAL** *(was PARTIAL)* |
| feature_08_layout_operations | N/A | N/A | 2 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_09_section_cloning | N/A | N/A | 1 | **PARTIAL** *(was NOT-VISIBLE)* |
| feature_10_undo_system | N/A | N/A | 2 | **PARTIAL** *(was PARTIAL)* |
| feature_11_spells_ui | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_12_properties_panel | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_13_ui_theme | N/A | N/A | 1 | **PARTIAL** *(was PARTIAL)* |
| feature_14_filters | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_15_modals | N/A | N/A | 1 | **PARTIAL** *(was PARTIAL)* |
| feature_16_background_context | N/A | N/A | 1 | **NOT-VISIBLE** *(was NOT-VISIBLE)* |
| feature_17_dnd | 6P / 4F | 10P / 0F | 3 | **PARTIAL** *(was PARTIAL)* |
| feature_18_image_processor | N/A | N/A | 1 | **PARTIAL** *(was NOT-VISIBLE)* |
| cross-cutting | 820P / 1F | 820P / 1F | 8 | **PARTIAL** *(was PARTIAL)* |

## Before / After Comparison (Visual-Capture Bundles)

The 5 visual-capture suites had 11 RED tests closed in commit 2e4dc0e. This table shows the impact on their bundle verdicts:

| Bundle | Visual-Capture Suites | Archived Mocha | Fresh Mocha | Archived Verdict | New Verdict | Change |
|--------|----------------------|----------------|-------------|------------------|-------------|--------|
| cross-cutting | drag_ux_visual_capture.spec.js, ui_ux_audit_visual_capture.spec.js, custom_templates_visual_capture.spec.js, picker_ux_visual_capture.spec.js, shape_layer_ps_visual_capture.spec.js | 34P/11F | 45P/0F | PARTIAL | PARTIAL | SAME |

## Detailed New Verdicts (verbatim excerpts)

### feature_01_ai_arrange

... visible over the sheet near the top stat area.
- The ordinary sheet layout otherwise remains visible, including the character portrait, ability scores, skill list, actions, defenses, and conditions.
- The video does **not** visibly show the pending arrangement being accepted and applied to the live record, a real Ctrl+Z undo restoring the prior layout, a rejected-patch/Cancel preservation check, byte-identical record comparisons, save-count verification, the “AI Arrange” row being enabled by storing a key, or evidence that the request was served by a worker stub with zero network traffic.

Thus, the extension and its AI-arrange preview flow are visibly present, and a pending ghost appears, but the required apply/save/undo end-to-end round trip is not completed on camera.

VERDICT: PARTIAL

### feature_02_ai_borders

... and actions pages.
- Later, the print output is shown with the extension panels over it, but **no AI-border gallery, border-selection controls, refinement controls, adjustment controls, accept/apply flow, or undo action specific to AI borders are visibly shown**.
- No visible interaction demonstrates selecting a border, adjusting a stroke, receiving a `not_adjustable` result for a fill-only border, or applying an AI-generated border. The labeled-frame capture behavior is also not visibly demonstrated.
- The isolated-world `window.AiBorder` seam and its `adjust`, `transform`, and `canAdjust` properties cannot be verified from the visible frames.

The page and extension panels are visible, but the AI-border feature’s end-to-end interaction is not visible in this video.

VERDICT: NOT-VISIBLE

### feature_03_layer_management

...e toast and changed header arrangement visibly connect a layer-order edit to the resulting sheet layout.
- However, no actual ArrowUp, ArrowDown, Home, or End press is visible, no focused layer row is visible, and no lock/boundary no-op, undo behavior, or keyboard-versus-drag positional comparison is demonstrated. The three-state print controls are not exercised either.
- **Video verdict: PARTIAL.** A layer-order update is visibly confirmed and reflected on the sheet, but most of the keyboard-specific interaction contract is not directly witnessed.

Across the two videos, the extension and its real sheet are visible, and one reorder update is visibly confirmed. The print-visibility behavior and the detailed keyboard-reorder assertions are not visibly completed end to end.

VERDICT: PARTIAL

### feature_04_shape_picker

...archetype thumbnails.
- The **CUSTOM** tab is then visibly selected. It exposes an **Upload from disk** action, explanatory text for supported image files, the message **“No custom shapes uploaded yet.”**, and **Cancel** and **Add Shape** buttons.
- The **Add Shape** button appears disabled while no custom upload is shown.
- The video ends while the Custom tab and empty upload area are still displayed. No local-file selection, uploaded preview, OK/addition to the sheet, Cancel-after-upload behavior, or base64 asset is visibly demonstrated. The character sheet itself shows no newly placed custom shape.

Because the supplied frames do not visibly witness the file upload or the resulting shape placement, the end-to-end upload behavior cannot be certified from this video.

VERDICT: NOT-VISIBLE

### feature_05_controls_panel

... names such as **Corvo Saggio**, **Health**, **Box 2**, ability sections, **Features & Traits**, **Inventory**, and numbered sections.
- However, no properties panel containing a font-size slider, compact-mode toggle, or border-style button is visibly shown.
- No visible section highlight or fill of a properties panel can be confirmed, and no visible font-size change, compact-mode change, border-picker application, or corresponding sheet update is shown. Those asserted end-to-end interactions are **NOT-VISIBLE**.

Overall, the videos visibly show the extension panels and a section-selection notification on the real demo sheet, but they do not visibly witness the required panel measurement or the font-size, compact-mode, and border-style interactions and their results.

VERDICT: NOT-VISIBLE

### feature_06_print_styles

...and a **Layer Management** panel on the right. A notification states, “No saved layout yet — the default template is loaded.”
3. The left panel visibly includes output controls such as **PRINT**, **Print settings**, and **Save to Browser**, while the right panel lists sections and shapes.
4. No button press, dialog interaction, layer change, apply/undo flow, print-preview action, or style application is visibly shown. The sheet remains essentially unchanged through the final frame.
5. Consequently, the video does not visibly show print CSS hiding the extension panels or selection highlights, changing locked-layer opacity or ordering, applying `data-print-z` overrides, hiding disabled layers, or computing layout bounds and page separators. No print result is presented.

VERDICT: NOT-VISIBLE

### feature_07_persistence

...action is visible as icon-labelled text without an emoji prefix.
- No action-icon menu is visibly opened in the sampled frames, so relocated asks are not directly witnessed as reachable from that menu.
- Page-separator rendering and fit-to-wrapper sizing are not clearly demonstrated as a distinct before/after result.

Across the three videos, the extension visibly opens its real panels, exposes the relevant settings and persistence controls, performs a browser save with a success toast, and restores a saved layout after reload with a visible restoration toast. However, several required round-trip details—real storage contents, credential removal mechanics, every customization type, the PC download, separators, and the relocated action-menu items—are not visibly completed.

VERDICT: PARTIAL

### feature_08_layout_operations

...bly includes:
  - **Sections (22)** with a list of section names.
  - **Shapes (1)** with an “Anchor Accent 8” entry.
  - Small per-row icons beside the listed items.
- The character sheet remains visible behind the panels.

**Not visibly witnessed:**
- The top section card is not visibly dragged to the bottom.
- The last section card is not visibly dragged back to the top.
- No section list reorder is captured.
- No DOM-order change, print z-index change, or corresponding visible stacking change on the sheet is captured.

**Assessment for this video:** NOT-VISIBLE for the asserted end-to-end interactions.

Overall, both videos show the extension panel on the real sheet, but neither provides visible evidence of the required control actions and resulting sheet changes.

VERDICT: NOT-VISIBLE

### feature_09_section_cloning

...lones**, along with other layout controls.
- A **LAYER MANAGEMENT** panel is open on the right, showing **SECTIONS (22)** and a list of named sections.
- The **Manage Clones** control is activated, opening a centered **CLONE SECTION** modal.
- The modal visibly asks, “Enter a name for this Section 1 clone:” and contains the default name **“Section 1 (Clone)”**, with **Cancel** and **Continue** buttons.
- The video ends while this naming modal is still visible. No click on **Continue**, creation of a titled clone, content comparison, title rename interaction, deletion through a visible **Delete** control, or final cloned result is shown.

The clone-name prompt is visibly demonstrated, but the remaining cloning, renaming, and deletion behaviors are not witnessed end to end.

VERDICT: PARTIAL

### feature_10_undo_system

...corresponding undo.
- Compact mode is again exercised, with **“Compact mode ON”** and **“Undo: Toggle ‘Actions’”** visible and the actions area changing density.
- The sampled frames clearly show multiple successful action-and-undo round trips for layout, sections, shapes, borders, ordering, visibility, renaming, and compact mode. However, the frames do not unambiguously expose every separately named case in the eight-case contract—particularly real-pointer corner resize, real-pointer rotation, keyboard nudge, position-field editing, and chip reparenting.

The feature visibly completes end-to-end undo behavior across the recordings for the actions that are clearly shown, but the complete set of eight per-class round trips is not individually visible in the sampled frames.

VERDICT: PARTIAL

### feature_11_spells_ui

...tab, where actions such as Longbow of Warning, Thorn Whip, and Guiding Bolt are visible.
- The view briefly shifts/zooms toward the sheet, but no spell row is opened and no **Details** trigger is visibly shown.
- The unpacked extension’s panel subsequently appears on both sides of the sheet. The left panel shows layout and output controls, while the right **LAYER MANAGEMENT** panel shows sections and shapes.
- A notice says, “No saved layout yet — the default template is loaded.” The panels remain visible while the default character sheet layout stays on screen.
- No visible click on a spell’s **Details** control occurs, and no floating spell detail section, duplicate-prevention behavior, loaded spell content, or retry/delete error state appears in the sampled frames.

VERDICT: NOT-VISIBLE

### feature_12_properties_panel

...he unpacked Print Enhancer extension panel appearing on the left, with controls such as Templates, Load, Reset to Default, Manage Clones, Add Shape, Manage Compact, AI Arrange, Print, and Save to Browser.
- A Layer Management panel appearing on the right, listing sections and shapes.
- A toast notification stating “Section selected for editing” appearing near the top of the sheet.

However, no properties-panel controls are visibly shown in the sampled frames: there is no visible font-size slider, compact-mode toggle, border-style button, border picker, or visible application of font size, compact mode, or border changes to the sheet. The section-selection toast alone does not visibly demonstrate the asserted properties-panel interactions or their results on the sheet.

VERDICT: NOT-VISIBLE

### feature_13_ui_theme

...int Settings**, and **Save to Browser**. A right-hand **Layer Management** panel shows **Sections (22)** and **Shapes (1)**.
4. **Visible sheet change:** The sheet behind the panels changes to a gray, ornate default-template appearance. A visible notification states, **“No saved layout yet — the default template is loaded.”**
5. **Interaction coverage limitation:** No visible cursor movement, button press, theme selection, apply action, or undo action is shown. The frames establish that the extension panels and controls render and that the sheet’s visible appearance changes, but they do not visibly demonstrate the complete apply/undo interaction sequence.

The extension UI and a changed sheet result are visible, but the end-to-end control flow is only partially witnessed.

VERDICT: PARTIAL

### feature_14_filters

...ears on the right.

The visible extension activity is limited to the layer-management interface. The sheet’s decorative borders and several panels visibly change from red to green and later back to gray while the character portrait, statistics, skills, actions, defenses, and other sheet content remain present. The left panel’s **Print**, **Print settings**, and **Save to Browser** controls are visible, but no filter controls or filter dialogs are shown.

No Greyscale slider, hue control, identity-chain setting, apply/undo filter action, or printed-paper result is visibly demonstrated. Consequently, the specific print-filter identity behavior under test cannot be witnessed in the video, even though the extension panel and unrelated layer-color interactions are visible.

VERDICT: NOT-VISIBLE

### feature_15_modals

...e dialog is then closed without a rename being submitted.

4. **Other dialogs/affordances:** A centered **SELECT DECORATIVE SHAPE** dialog appears, showing border/shape/custom tabs, category filters, a search field, and Archer shape choices. It is closed without visibly adding a shape. A **TEMPLATES** dialog then appears with “Basic Template” and “Anchor Template” options and a Cancel button; it remains open at the end of the video.

5. **Overall assessment:** The extension panel is visibly present, multiple modal dialogs are displayed over the actual sheet, the rename dialog’s empty-field validation is exercised, and the decorative-shape and template dialogs are visibly opened. The video does not show a successful rename, a shape being added, or a template being applied.

VERDICT: PARTIAL

### feature_16_background_context

...e panels, showing the character portrait, ability scores, skills, defenses, and actions.
- Around 34.4 seconds, the visible portion of the sheet changes to a different scroll position, revealing more of the upper ability-score boxes and shifting the sheet content. Afterward, the panel layout and sheet remain largely stationary.
- No visible pointer action identifies which control was activated, and no dialog, Apply, or Undo flow is shown. Most importantly for the stated auto-scroll contract, no drag toward the viewport’s bottom edge is visibly performed, and no held drag causing the sheet to auto-scroll can be witnessed.

The extension panels and a changed sheet scroll position are visible, but the end-to-end auto-scroll interaction itself is not visibly demonstrated.

VERDICT: NOT-VISIBLE

### feature_17_dnd

...stinction is shown.
- No gold alignment guides or zero-jump snapping are visible.
- No autosave toast appears after a drop.
- No locked-layer dimmed state is shown.
- No drop is visibly clamped at the sheet origin, and no negative-position check is shown.
- No source-restored/wrapper-moved before-and-after pair is visible.

**Video status:** NOT-VISIBLE — scrolling and panel presence are visible, but the visual-capture suite’s drag interactions are not witnessed.

Across the three videos, the extension and its layer controls are visibly present, and the first video shows hover action affordances on the real sheet. However, the sampled evidence does not visibly complete the required mouse/touch dragging, snapping, save, locking, and origin-clamping interactions end to end.

VERDICT: PARTIAL

### feature_18_image_processor

...e dialog titled “SELECT DECORATIVE SHAPE” shows the “SHAPES” tab selected, category filters, a search field, and three visible Archer preview thumbnails: “Archer Accent A,” “Archer Accent B,” and “Archer Divider.” These previews visibly render.
- The video ends with the picker still open. No preview is selected, the “Add Shape” button remains visibly disabled, no shape is added to the sheet, and no apply/undo or image-processing action/result is shown.
- Asset URLs are not displayed, so the frames do not visibly prove that the previews use `.webp` files or contain no `.gif` references.

The video visibly demonstrates the extension panel and shape-picker previews, but it does not complete the picker-to-added-shape flow or visibly establish the required WebP asset behavior.

VERDICT: PARTIAL

### cross-cutting

...ctions/Spells tabs, character artwork, and the extension’s control and layer panels.
- The live **ACTIONS / SPELLS / INVENTORY / FEATURES & TRAITS / EXTRAS** tabs are visible, and the sheet remains laid out cleanly.
- No visible interaction with the Spells tab filter is shown, so continued interactivity cannot be confirmed.
- No modal above the cleaned layout is opened, and no spell-row **Details** trigger is visibly activated or clearly presented.
- **Verdict: NOT-VISIBLE.**

Across the eight videos, the clearest end-to-end completions are the release-surface smoke behavior and the decorative-shape add flow. Shape-layer creation/active-layer placement, BYOK persistence, and several other asserted interactions are either only partly shown or not visible enough to certify.

VERDICT: PARTIAL
