/**
 * Boot — the extension's startup orchestration, extracted from js/main.js.
 *
 * Track `refactor_surface_20261101` (Phase 1). The async IIFE body that owned
 * Storage.init → suppressResizeEvents → the twelve init mutations →
 * createControls → the DDB_IS_ON message → restoreLayout's 3-branch →
 * dismissActivationOverlay → toggleShapesMode(false) is MOVED here. main.js keeps
 * only the two things that genuinely belong to it: the activation-overlay MOUNT
 * (it must run before the re-run gate) and the re-run gate itself (it uses
 * `askConfirm`, a main.js-local). main.js then calls `window.Boot.boot()`.
 *
 * SEAM. Exposed on `window.Boot` beside the existing `window.Persistence` /
 * `window.LayoutScan` / `window.LayoutApply` family — the same kind (a standalone
 * module in the injected list, booted before js/main.js, whose caller resolves it
 * on `window`). Window.Boot itself is an ORCHESTRATION seam, the closest relative
 * of the activation-overlay mount/dismiss pair
 * (`window.mountActivationOverlay` / `window.dismissActivationOverlay`): both own
 * the extension's startup lifetime. The mount side stays in main.js; the dismiss
 * side lives here, after the restore announcement.
 *
 * DISCIPLINE. One top-level binding: `window.Boot` (its method is `boot`). The
 * module-locals are `bootSafeLog` / `bootStep` — uniquely prefixed per the
 * injected-scope rule (js/border_refine.js header; js/undo.js, js/recovery_ui.js
 * follow the same rule), never `state`, `_safeLog`, `open`, or `close` (real
 * `window` members). `test/unit/injected_scope_collision.test.js` fails the fast
 * suite if this file ever collides with another injected module.
 *
 * RESOLUTION. Every seam this module drives — `window.__DDBStorage`,
 * `window.Persistence` (restoreLayout / applyDefaultLayout / restoreFailureCard /
 * announceBootRestore) and the main.js exports (suppressResizeEvents, tweakStyles,
 * …) — is resolved at CALL time through `window.*`, the range's established
 * pattern (refineAiBorder resolves window.AiBorder at call time). Two reasons:
 * the module is eval'd before js/main.js in the extension list, and the unit test
 * can drive BOTH branches of every seam (present / absent) without reordering.
 */
"use strict";

(function () {
  if (window.Boot) return; // idempotent across re-injection

  // --- module-local logger (uniquely named — injected-scope rule) ------------

  /**
   * Resolve the ONE logger at CALL time, exactly as js/main.js's `safeLog` contract requires.
   *
   * There is deliberately NO `console` fallback: O-4 (track refactor_surface_20260911, AC-5) made
   * `no-console` an eslint ERROR for `js/`, because a per-module console bridge is a SECOND logger
   * implementation — and js/main.js's `safeLog` header calls the resulting drop "documented
   * degradation, not a hidden delta". This module is second-to-last in the injected list, so the seam
   * is present in the product; in a harness that boots this file alone the line is dropped, silently
   * and by design.
   */
  function bootSafeLog(method, ...args) {
    if (typeof window.safeLog === "function") window.safeLog(method, ...args);
  }

  // --- call-time seam resolution (fail-open, per the range's convention) -----

  /**
   * Resolve a seam at CALL time and run it fail-open.
   *
   * `path` is the name under `window` (e.g. "suppressResizeEvents"); a step that is
   * absent is SKIPPED, not fatal — the harness and any partially-wired page still
   * run the rest of the sequence, and a throw in one mutation cannot abort boot.
   */
  async function bootStep(path, args) {
    const fn = window[path];
    if (typeof fn !== "function") return undefined;
    try {
      return await fn.apply(window, args || []);
    } catch (e) {
      bootSafeLog("error", `[DDB Boot] ${path} threw:`, e && e.message);
      return undefined;
    }
  }

  /**
   * Run the startup sequence.
   *
   * @param {Function} [beforeMutations] Optional async hook run AFTER storage init
   *   and resize suppression, and BEFORE the first mutation. Returning `false`
   *   halts the boot (the re-run gate in js/main.js uses this: it owns the
   *   user-facing confirm, which is a main.js-local seam). boot() then resolves to
   *   `false`; every other path resolves to `true`.
   * @returns {Promise<boolean>} whether the boot ran to completion.
   */
  async function boot(beforeMutations) {
    // --- initialize storage (first real work) --------------------------------
    const storage = window.__DDBStorage;
    if (storage && typeof storage.init === "function") {
      try {
        await storage.init();
      } catch (err) {
        bootSafeLog("error", "[DDB Print] Failed to initialize storage:", err);
      }
    }

    // --- stabilize layout ----------------------------------------------------
    await bootStep("suppressResizeEvents");

    // --- the caller's gate (main.js owns the re-run confirm) -----------------
    if (typeof beforeMutations === "function") {
      const proceed = await beforeMutations();
      if (proceed === false) return false;
    }

    // --- the init mutations, in the order the product ships them -------------
    await bootStep("enforceFullHeight");
    await bootStep("injectClonesIntoSpellsView");
    await bootStep("moveDefenses");
    await bootStep("tweakStyles");
    await bootStep("injectCompactStyles");
    await bootStep("removeSearchBoxes");
    await bootStep("movePortrait"); // User Request: Move portrait at the end
    await bootStep("moveQuickInfo"); // User Request: Make Quick Info draggable
    await bootStep("separateAbilities");
    await bootStep("separateQuickInfoBoxes");
    await bootStep("addInteractiveTidbitSection");
    await bootStep("injectCloneButtons");
    await bootStep("flagExtractableElements");
    await bootStep("initDragAndDrop");

    // AC-8 (undo_stack_20260911): the keyboard path. Bound once at boot; inert while a
    // text field has focus and a no-op when the stack is empty (both asserted).
    if (typeof window.installUndoShortcut === "function") {
      await bootStep("installUndoShortcut");
      bootSafeLog("log", "[DDB Print] Undo shortcut bound (Ctrl/Cmd+Z)");
    }
    if (typeof window.injectDnDStyles === "function") {
      await bootStep("injectDnDStyles");
      bootSafeLog("log", "[DDB Print] DnD Styles Injected");
    }
    await bootStep("initResponsiveScaling");
    await bootStep("initZIndexManagement");
    await bootStep("initResizeLogic");

    // --- UI controls ---------------------------------------------------------
    await bootStep("createControls");

    // --- announce to the extension runtime (best-effort, fenced) -------------
    // AC-4 (first_run_and_panel_20260911): the badge must report that this script
    // actually booted in this tab, not that an injection was requested — which is
    // why the message comes from here and not from `chrome.action.onClicked`. A
    // page with no extension runtime (jsdom, a standalone boot) still boots fully.
    try {
      const runtime = window.chrome && window.chrome.runtime;
      if (runtime && typeof runtime.sendMessage === "function") {
        runtime.sendMessage({ type: "DDB_IS_ON" });
      }
    } catch {
      /* no runtime to tell: the enhancer still works */
    }

    // --- restore / default / recovery (the 3-branch decision) ----------------
    // AC-1/Edge 4: a layout that exists but FAILED to load surfaces an error card —
    // never a silent downgrade to the default template (which looked like data loss).
    const persistence = window.Persistence || {};
    const restoreLayout = persistence.restoreLayout;
    const restoreResult =
      typeof restoreLayout === "function"
        ? await restoreLayout()
        : { restored: false, reason: "empty" };

    if (restoreResult && restoreResult.restored) {
      await bootStep("updateLayoutBounds");
    } else {
      const applyDefaultLayout = persistence.applyDefaultLayout;
      if (typeof applyDefaultLayout === "function") {
        await applyDefaultLayout();
      }
      // Consultant risk #3: never leave a blank sheet. Establish a usable,
      // printable default and THEN explain what happened — the saved layout is
      // untouched (nothing re-persists it) and the card offers recovery.
      if (restoreResult && restoreResult.reason && restoreResult.reason !== "empty") {
        const card = persistence.restoreFailureCard;
        if (typeof card === "function") card(restoreResult);
      }
    }

    // AC-2 (U-15): one confirmation of which layout the sheet is showing —
    // "restored" and "there was nothing to restore, here is the default" must not
    // look the same. Silent on the failure branch above, which the recovery card owns.
    const announce = persistence.announceBootRestore;
    if (typeof announce === "function") announce(restoreResult);

    // --- dismiss the activation overlay LAST (BEYOND-18) --------------------
    // The overlay owns the plain-sheet -> enhanced-sheet middle; dismissing before
    // the restore announcement would re-open exactly the unowned gap the
    // certification priced. It is hidden, not removed, so the e2e camera can
    // witness both halves. Dismissal is idempotent, so the re-run-gate path in
    // main.js may also have called it.
    await bootStep("dismissActivationOverlay", [restoreResult]);

    // --- default to Shapes Mode OFF -----------------------------------------
    await bootStep("toggleShapesMode", [false]);

    return true;
  }

  window.Boot = { boot };
})();
