/**
 * Dead export audit — the classification half of AC-2 (track
 * dead_exports_20260910).
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * `scripts/audit_dead_exports.js` produces the audit; this file is what stops
 * the audit from being a one-off report. It runs the COMMITTED scanner in-process
 * and fails when:
 *
 *   - a row carries anything other than one of the three verdicts (AC-2), or
 *   - a `test-seam` row does not name the test that reaches it (AC-2), or
 *   - the audit reports a `dead` export that is not in the explicitly handled
 *     list below — i.e. a new unhandled dead export (AC-3/AC-6).
 *
 * It deliberately does NOT assert "there are no dead exports": that would pass
 * vacuously today and say nothing tomorrow. It asserts the dead set is EXACTLY
 * the handled set, so the set must be maintained consciously in both directions.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const {
  loadSources,
  buildRows,
  summarize,
} = require("../../scripts/audit_dead_exports.js");
const { check: checkExports, MARKERS } = require("../../scripts/check_dead_exports.js");

const AUDIT = buildRows(loadSources());
const ROWS = AUDIT.rows;
const SUMMARY = summarize(ROWS);
const VERDICTS = ["dead", "test-seam", "live"];

/**
 * Exports the audit is ALLOWED to report as `dead`. Empty is the goal state: a
 * dead export should be retired, not tolerated. Every name here must also be
 * absent from the live audit, so the list cannot rot into a stale alibi.
 */
const HANDLED_DEAD = [];

describe("AC-1/AC-2 — the audit classifies every export on both surfaces", function () {
  it("audits the direct surface and the namespace surface, not just one", function () {
    // The measured baseline (2026-09-10) was 120 `window.*` assignments, of
    // which exactly one was a host property (`window.onresize = null`). The
    // `window.UiTheme` line was retired by this track (119 = 118 + 1), and
    // `feedback_lifecycle_a11y_20260910` added exactly one deliberate new seam —
    // `window.announceBootRestore` (AC-2) — bringing it back to 120 = 119 + 1.
    // `destructive_recovery_20260911` adds ONE more, `window.gateDestructive`
    // (AC-1): every destructive path resolves it at call time, and two of those
    // paths (js/dom/layer_manager.js, js/section_cloning.js) are evaluated BEFORE
    // js/persistence.js, so it must be a window seam rather than an import.
    // `destructive_recovery_20260911` Phase 2 adds SIX more, all deliberate: the
    // undo offer and the restore surface must be reachable from js/controls.js and
    // the destructive sites, and three of those modules (layer_manager,
    // section_cloning, and the controls panel itself) are evaluated BEFORE
    // js/persistence.js owns them — `offerUndo`, `clearUndoOffer`, `hasUndoOffer`,
    // `applyUndo`, `restoreBackupRecord`, `showRestoreSurface` (121 -> 127).
    // `undo_stack_20260911` Phase 1 replaces the single-level undo slot with a real
    // stack and adds SEVEN more (127 -> 134): `pushUndo`, `peekUndo`, `undoDepth`,
    // `clearUndoStack`, `canUndo`, `captureLiveLayout` and `UNDO_STACK_MAX`. Six of
    // them are the mutation surface's entry points — the same lazily-resolved-seam
    // reason as `gateDestructive` above, since the destructive sites and (Phase 2)
    // every other mutation site live in modules evaluated BEFORE persistence.js — and
    // the seventh is annotated in place as a test seam (the O-1 depth bound).
    // A seventh name was written first and then DELETED rather than annotated: a
    // `window.undoStack` convenience object with no reader, which the re-rot guard
    // flagged on the next run. That is the guard doing its job, so it is recorded
    // here rather than quietly dropped.
    // Pinned because a new export must not slip in silently: it has to be
    // audited and classified, and whoever adds one updates this number on
    // purpose — which is what this line is.
    // `undo_stack_20260911` Phase 2a adds ONE more (134 -> 135): `captureUndo`, the
    // single capture-and-push entry point every Phase 2 mutation site calls. Same
    // lazily-resolved-seam reason — those sites live in js/dnd.js,
    // js/properties_panel.js and js/dom/layer_manager.js, all evaluated before
    // js/persistence.js.
    // Phase 2b adds TWO more (135 -> 137): `patchCapturedFields` and
    // `snapshotContainerGeometry`, the late-capture repair primitives. `patchCapturedFields`
    // is called from BOTH js/dnd.js and js/main.js (ONE implementation of the
    // find-this-element-in-a-captured-layout lookup, so the repairs cannot drift apart), and
    // `snapshotContainerGeometry` from js/main.js's resize path — both modules evaluated
    // before js/persistence.js, so both must be seams.
    // Phase 2e adds FOUR more (137 -> 141): `beginMutation` / `pushMutation` (the
    // NON-DEFERRING capture pair — sites whose callers assert synchronously cannot await
    // a scan before mutating) and `snapshotSectionFlags` / `repairSectionFlags` (the
    // compact + borderStyle snapshot and its repair). All four are called from js/main.js,
    // evaluated before js/persistence.js.
    // AC-8 adds THREE more (141 -> 144): `undoLabel` (the affordance's label, read from
    // the stack top), `installUndoShortcut` (the Ctrl/Cmd+Z binding, bound at boot in
    // js/main.js) and `isTextEntryTarget` (the focus guard the binding consults — exported
    // because the guard is asserted directly). A fourth name was written and then DELETED
    // rather than annotated: `__refreshUndoControl`, a test-only seam with no caller, which
    // the re-rot guard flagged on the next run. The event-driven refresh already covers the
    // boot case, so the seam had no reader. Second time this guard has caught one of mine.
    // +1 for `undoScreenLabel` (144 -> 145): AC-V1 round 1 measured that the composed
    // "Undo: <label>" string was being ELLIPSIZED by the panel for a realistic subject, so
    // the label is clamped in one place instead. js/controls.js calls it, and that module is
    // evaluated before js/persistence.js. NOTE: `UNDO_LABEL_MAX` is deliberately NOT
    // exported — the re-rot guard flagged it as a seam with no reader, and it was right.
    // +1 for `MUTATION_CLASSES` (145 -> 146; module exports 144 -> 145): AC-3 of
    // refactor_surface_20260911 declares the mutation-class vocabulary ONCE, in
    // js/persistence.js, and six modules evaluated BEFORE it push through the seam
    // (main, dnd, controls, layer_manager, properties_panel, section_cloning). The VALUES
    // list is deliberately NOT a seam: a reader takes Object.values of the map, and the
    // re-rot guard deletes a seam with no reader of its own.
    // +1 for `Z` (146 -> 147): AC-5 of refactor_surface_20260911 declares the z-index ladder ONCE
    // (a frozen map in js/main.js) instead of bare literals across three modules, and the map must
    // be a seam because its readers (controls, spells_ui, layer_manager) eval before main.js.
    // +3 (148 -> 151): AC-4 of ux_gaps_20260911 splits the refusal copy into the short toast form
    // and the long dialog form — `gateRefusalMessage`, `gateRefusalDetail` and
    // `showGateRefusalDetail` — because the old 21-word sentence outran the toast's measured
    // ~3.5 s window. Three seams for one change, each with a reader (the gate, the dialog, and the
    // Phase 4 suite).
    // +2 (151 -> 153): AC-2 of ux_gaps_20260911 adds the reference surface — `showHelpSurface`,
    // the same dialog the panel's "?" opens (so a suite and a user reach ONE surface), and
    // `HELP_GESTURES`, the shipped list the AC-2 measurement enumerates rather than re-typing.
    // +2 (153 -> 155): AC-1a of first_run_and_panel_20260911 exposes the DERIVATION the card
    // renders (`cardHintText`) and the phrases it draws out of that shipped list
    // (`cardGesturePhrases`), so the convergence suite compares the card's RENDERED TEXT against
    // the product's own derivation instead of re-implementing the join and then checking its own
    // arithmetic. Both have a reader: `test/unit/gesture_surface_convergence.test.js`, which
    // asserts the two gesture surfaces cannot disagree (the defect this change removes).
    // +3 (155 -> 158): AC-2 of first_run_and_panel_20260911 adds the print-settings surface
    // (`showPrintSettingsSurface`, opened by the panel's own "Print settings" control) and exposes
    // its DATA (`PRINT_SETTINGS_REQUIRED`, `PRINT_SETTINGS_HANDLED`) so the suite can assert the
    // README still agrees with what the dialog renders. Exposing the data rather than letting the
    // test re-type it is the whole anti-drift mechanism: two independent lists that drift is the
    // defect AC-2 names, and it is the same defect AC-1a removes from the gesture surfaces.
    // +1 (158 -> 159): AC-4 of the same track exposes the turn-off surface
    // (`showTurnOffSurface`), so the panel's power control and the AC-4 suite open the SAME dialog.
    // Its reader is `test/unit/turn_off_state.test.js`, which asserts the save-then-deactivate
    // order.
    // +1 (159 -> 160): AC-4 of byok_ai_layout_20260915 Phase 2 adds `window.AiSettings` — the BYOK
    // config store (`js/ai_settings.js`), injected by js/background.js right after js/modals.js so
    // the dialog can resolve `Modals.__createModal`. It is a TEST-SEAM namespace, not a product one
    // yet: its only `js/` reader is Phase 4's panel button, and the guard's annotation on the
    // namespace is what keeps that honest. `js/ai_layout.js` (Phase 1's pure core) adds NOTHING
    // here — it publishes no `window.*` at all until Phase 4 gives it a caller.
    assert.strictEqual(SUMMARY.directExports, 160, "direct `window.*` assignments");
    assert.strictEqual(SUMMARY.moduleExports, 159, "of which module exports");
    assert.strictEqual(SUMMARY.hostProperties, 1, "of which host-object properties");
    assert.ok(
      SUMMARY.namespaceMembers > 50,
      "namespace members are audited too (got " + SUMMARY.namespaceMembers + ")",
    );
    assert.ok(
      ROWS.some((r) => r.surface === "direct") && ROWS.some((r) => r.surface === "namespace"),
      "both surfaces are represented",
    );
  });

  it("gives every row exactly one of the three verdicts (never guesses, never omits)", function () {
    const unclassified = ROWS.filter((r) => !VERDICTS.includes(r.verdict));
    assert.deepStrictEqual(
      unclassified.map((r) => `${r.namespace ? r.namespace + "." : ""}${r.name}=${r.verdict}`),
      [],
      "every row must be dead / test-seam / live",
    );
    assert.strictEqual(SUMMARY.unclassified, 0, "the summary agrees");
  });

  it("names the test that reaches a test-seam row (a seam without a reason is not a seam)", function () {
    const seams = ROWS.filter((r) => r.verdict === "test-seam");
    assert.ok(seams.length > 0, "there are kept seams, so this check is not vacuous");
    for (const row of seams) {
      assert.ok(
        row.testFiles.length > 0,
        `${row.namespace ? row.namespace + "." : ""}${row.name} is test-seam but names no test`,
      );
      for (const file of row.testFiles) {
        assert.match(file, /^test\//, "the named consumer is a test file: " + file);
      }
    }
  });

  it("reports a dead export only if it is explicitly handled (AC-3/AC-6)", function () {
    const deadNow = ROWS.filter((r) => r.verdict === "dead").map((r) =>
      r.namespace ? `${r.namespace}.${r.name}` : r.name
    );
    assert.deepStrictEqual(
      deadNow.slice().sort(),
      HANDLED_DEAD.slice().sort(),
      "a dead export must be retired or listed in HANDLED_DEAD with its reason — " +
        "the audit found: " + (deadNow.join(", ") || "(none)"),
    );
    // ...and the handled list must not keep naming things that are no longer
    // dead (which would let a stale entry excuse a future regression).
    const allLabels = new Set(
      ROWS.map((r) => (r.namespace ? `${r.namespace}.${r.name}` : r.name)),
    );
    for (const handled of HANDLED_DEAD) {
      assert.ok(
        !allLabels.has(handled),
        `${handled} is listed as handled but is still in the audit — the entry is stale`,
      );
    }
  });
});

describe("AC-5/AC-6 — the kept seams are annotated and the surface cannot re-rot", function () {
  const RESULT = checkExports();

  it("inspects the export surface rather than passing on nothing (not vacuous)", function () {
    assert.ok(
      RESULT.checked.length > 100,
      "the guard checked a real surface (got " + RESULT.checked.length + " exports)",
    );
    assert.ok(
      RESULT.skipped.some((s) => s.label === "onresize"),
      "the host property window.onresize is skipped as 'not an export'",
    );
  });

  it("AC-5: every kept export with no product caller carries a reason at its declaring site", function () {
    // The guard is the mechanism, but AC-5's claim is specifically about the
    // ANNOTATION, so it is asserted here in those terms: no kept export may
    // reach the guard through the ALLOWLISTED waiver without a written reason.
    for (const f of RESULT.findings) {
      assert.fail(
        `${f.label} (${f.file}:${f.line}) is kept with no caller and no reason comment`,
      );
    }
    // ...and the seam rows the track annotated must be visible as annotated, not
    // merely absent from the findings (an empty findings list could also mean the
    // rows were dropped from the audit).
    const seams = ROWS.filter((r) => r.verdict === "test-seam" && r.kind !== "host-property");
    assert.ok(seams.length > 0, "there are kept seams");
    for (const row of seams) {
      const lines = loadSources()[row.file].lines;
      const block = lines
        .slice(Math.max(0, row.line - 9), row.line)
        .join("\n");
      assert.ok(
        MARKERS.some((re) => re.test(block)),
        `${row.namespace ? row.namespace + "." : ""}${row.name} (${row.file}:${row.line}) ` +
          "is kept with no product caller — its declaring site must say why",
      );
    }
  });

  it("AC-6: the guard reports zero violations on the current surface", function () {
    assert.deepStrictEqual(
      RESULT.findings.map((f) => f.label),
      [],
      "the export surface must not contain a new unannotated, uncalled export",
    );
    assert.deepStrictEqual(
      RESULT.staleAllow.map((a) => a.name),
      [],
      "no stale ALLOWLISTED waiver (a waiver that no longer matches hides a regression)",
    );
  });
});

describe("AC-7 — retiring window.UiTheme did not disturb the theme (no behaviour change)", function () {
  const THEME_SRC = fs.readFileSync(
    path.resolve(__dirname, "../../js/ui_theme.js"),
    "utf8",
  );

  /** Evaluate the theme module the way a content script does: in a live window. */
  function bootTheme() {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      runScripts: "outside-only",
    });
    dom.window.eval(THEME_SRC);
    return dom;
  }

  it("still self-injects its stylesheet at module scope (injectTheme() runs on load)", function () {
    // The export removed by this track was never the injection path — the module
    // calls injectTheme() at module scope, before the export block. This pins
    // that removing `window.UiTheme = UiTheme` did not take the theme with it.
    const dom = bootTheme();
    const styles = dom.window.document.querySelectorAll("#ddb-print-ui-theme");
    assert.strictEqual(styles.length, 1, "exactly one injected stylesheet");
    const css = styles[0].textContent;
    assert.ok(css.length > 10000, "the emitted stylesheet is substantial (got " + css.length + ")");
    assert.match(css, /--be-[a-z-]+\s*:/, "the token layer is present in the emitted CSS");
  });

  it("leaves the retired export retired (window.UiTheme stays gone)", function () {
    const dom = bootTheme();
    assert.strictEqual(
      typeof dom.window.UiTheme,
      "undefined",
      "window.UiTheme was retired by dead_exports_20260910 — do not re-add it",
    );
  });
});
