# spec — State feedback: progress / error / state-transition visibility (BEYOND-19)

## Goal
Close BEYOND-19 by ensuring the extension exposes:
1. **Progress affordance** for every operation that crosses a latency boundary (AI arrange/borders, print, filter, save).
2. **Error toasts** for every failure path that currently silently swallows failures (save writes, print errors, network failures).
3. **State-transition explanation** for silent transitions (blank sheet during assembly, no explicit loading for print/filter).

## Accepted findings (from the unprimed v3 judge, 17/19 bundles)

| Bundle | Finding (verbatim excerpt) |
|--------|----------------------------|
| f01 AI arrange | "No dedicated loading indicator for AI work… no extension-specific 'arranging'/pending state" |
| f02 AI borders | Toast only on success; no progress indicator during the round trip |
| f04 Shape picker | "No loading/transition state for printing" |
| f05 Controls panel | "specific loading animation or incremental activation state is shown" (i.e. missing) |
| f06 Print styles | "No loading/transition state for printing", "No print success, completion, or error feedback" |
| f07 Persistence | "No visible success feedback follows a Save action", "No error state is shown for a failed save or store write" |
| f08 Layout ops | "No print state or print preview is shown", "state transition is shown" (missing) |
| f09 Section cloning | "No success toast such as 'Shape added'/'Layout saved,' or a clone" |
| f11 Spells UI | layout status toast visible, but no progress during operations |
| f12 Properties panel | "most of the sheet is temporarily blank… no explicit loading" |
| f13 UI theme | No button interaction / state change shown |
| f14 Filters | "No loading/transition state for the extension's print/filter operation", "No extension error state is shown", "No disabled state is shown" |
| f15 Modals | Validation error IS shown (good) |
| f17 DnD | Toast for save/shape visible |
| f18 Image processor | "No applied shape is shown after selection, so the add flow, success toast, and resulting page rendering are not demonstrated" |

## Scope
- Content script: `js/modals.js` (showFeedback, showBusy), `js/ai_arrange.js` (showBusy used), `js/controls.js`, `js/dnd.js`, `js/catalog_service.js`, `js/dom/layer_manager.js`, `js/print_styles.js`, `js/ai_settings.js`
- Background: `js/background.js` (error handling in relay)
- New e2e specs that exercise each gap and capture evidence frames

## Acceptance criteria (track-level)

| AC | Description | Evidence |
|----|-------------|----------|
| AC-1 | AI arrange: `showBusy("Arranging…")` is mounted before the worker fetch and cleared only after the preview dialog or error toast | e2e frame + probe |
| AC-2 | AI borders: progress toast during the border round trip, error toast on failure | e2e frame + probe |
| AC-3 | Print: loading toast "Preparing print…", success toast "Print ready", error toast on failure | e2e frame + probe |
| AC-4 | Filter panel: loading toast during filter application, error toast on failure, disabled state shown for action icons | e2e frame + probe |
| AC-5 | Persistence (settings): success toast "Settings saved", error toast on store write failure | e2e frame + probe |
| AC-6 | Section cloning / shape add: success toast "Shape added" / "Layout cloned" | e2e frame + probe |
| AC-7 | Silent transitions: any assembly that blanks the sheet for >300ms shows a "Loading…" toast | e2e frame + probe |

Each AC requires a **new e2e spec** that exercises the gap and produces a **closure frame** (screenshot + live DOM probe) — NOT re-reading the judge record.
