/**
 * Undo System — feature_10_undo_system
 * Declared certificate: test/unit/undo.test.js (manifest test_paths[0])
 * Companion: test/unit/destructive_recovery.test.js (10/10 existing, fleet already green)
 * Isolation: WIP at temp/wip/feature_10_undo_system/undo.test.js (9/9 green pre-publish)
 * Publish: atomic write via temp file + rename; no production code modified (js/undo.js read-only assertions)
 *
 * Certifies js/undo.js: bounded stack, live capture, mutation vocabulary,
 * beginMutation/pushMutation with late-capture repair, label/shortcut apis.
 */
"use strict";
const assert = require("assert");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");
const LayerManager = require("../../js/dom/layer_manager.js");

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <div class="be-section-wrapper" id="wrapper-main" data-title="Main">
        <div class="print-section-container" id="section-main" style="width: 200px; height: 100px;">
          <div class="print-section-header"><span>Main</span></div>
        </div>
      </div>
      <div class="be-section-wrapper" id="wrapper-actions" data-title="Actions">
        <div class="print-section-container" id="section-Actions" style="width: 200px; height: 100px;">
          <div class="print-section-header"><span>Actions</span></div>
        </div>
      </div>
    </div>
    <div id="print-enhance-shapes-layer">
      <div class="be-shape-layer-container" id="shapes-default"></div>
    </div>
    <div id="print-enhance-properties-panel"></div>
    <input id="probe-input" type="text" />
    <textarea id="probe-textarea"></textarea>
    <div id="probe-editable" contenteditable="true">edit</div>
  </div>
</body></html>`;

function bootEditor() {
  const b = boot(SHEET);
  b.window.LayerManager = b.window.LayerManager || LayerManager;
  return b;
}

async function layoutString(window) {
  return JSON.stringify(await window.scanLayout());
}

describe("undo — bounded stack and lifecycle (js/undo.js)", function () {
  this.timeout(20000);
  let window;
  let document;
  let cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("UNDO_STACK_MAX is 25 and enforced as FIFO", async function () {
    assert.strictEqual(window.UNDO_STACK_MAX, 25);
    const live = await window.captureLiveLayout();
    for (let i = 0; i < 26; i += 1) window.pushUndo(live, "m" + i);
    assert.strictEqual(window.undoDepth(), 25);
    assert.strictEqual(window.peekUndo().label, "m25");
    assert.strictEqual(window.undoDepth(), 25);
  });

  it("pushUndo refuses null before-state, captureLiveLayout returns live shape, peek/apply round-trip", async function () {
    const live = await window.captureLiveLayout();
    assert.ok(live && typeof live === "object");
    assert.ok(Object.prototype.hasOwnProperty.call(live, "shapeLayers"));
    assert.strictEqual(window.pushUndo(null, "nothing"), null);
    assert.strictEqual(window.undoDepth(), 0);
    // Derive the banded printZIndex state first (mirrors coverage helper deriveLayoutState).
    // Without it a before captured at 10/10 drifts to 10/11 after applyLayout derives.
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    lm.refreshLayerContents();
    lm.updatePrintZIndexes(true);
    const fresh = await window.captureLiveLayout();
    window.pushUndo(fresh, "probe", "drag");
    assert.strictEqual(window.undoDepth(), 1);
    assert.strictEqual(window.canUndo(), true);
    assert.ok(window.peekUndo());
    assert.strictEqual(window.undoLabel(), "probe");
    const before = await layoutString(window);
    // pushed record is exactly the layout we just scanned
    assert.deepStrictEqual(JSON.parse(JSON.stringify(window.peekUndo().before)), JSON.parse(before));
    const res = await window.applyUndo();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(window.undoDepth(), 0);
    assert.strictEqual(window.canUndo(), false);
    assert.strictEqual(window.undoLabel(), null);
    assert.strictEqual(await layoutString(window), before);
  });

  it("clearUndoStack drains and canUndo/peek reflect empty", async function () {
    const live = await window.captureLiveLayout();
    window.pushUndo(live, "a");
    window.pushUndo(live, "b");
    assert.strictEqual(window.undoDepth(), 2);
    window.clearUndoStack();
    assert.strictEqual(window.undoDepth(), 0);
    assert.strictEqual(window.peekUndo(), null);
    assert.strictEqual(window.canUndo(), false);
    const res = await window.applyUndo();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, "none");
  });

  it("applyUndo with unavailable applyLayout preserves the record", async function () {
    const live = await window.captureLiveLayout();
    window.pushUndo(live, "keep me");
    const orig = window.applyLayout;
    window.applyLayout = undefined;
    const res = await window.applyUndo();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, "unavailable");
    assert.strictEqual(window.undoDepth(), 1, "record survives unavailable restore");
    window.applyLayout = orig;
    window.clearUndoStack();
  });

  it("MUTATION_CLASSES is frozen; undeclared class rejected in test mode, missing -> unknown", function () {
    assert.ok(Object.isFrozen(window.MUTATION_CLASSES));
    assert.strictEqual(window.MUTATION_CLASSES.DRAG, "drag");
    assert.strictEqual(window.MUTATION_CLASSES.UNKNOWN, "unknown");
    assert.throws(function () { window.pushUndo({}, "x", "not-a-class"); }, /Undeclared mutation class/);
  });

  it("missing mutation class resolves to unknown without throwing", async function () {
    const live = await window.captureLiveLayout();
    const e = window.pushUndo(live, "no class");
    // LITERAL, not `window.MUTATION_CLASSES.UNKNOWN`: mutation_class_guard's external anchor
    // requires a per-class expectation to spell the class out (declaration vs extractor).
    assert.strictEqual(e.class, "unknown");
    window.clearUndoStack();
    const e2 = window.pushUndo(live, "empty", "");
    assert.strictEqual(e2.class, "unknown");
    window.clearUndoStack();
  });

  it("isTextEntryTarget and installUndoShortcut inert in text fields", async function () {
    const input = document.getElementById("probe-input");
    const ta = document.getElementById("probe-textarea");
    const ed = document.getElementById("probe-editable");
    assert.strictEqual(window.isTextEntryTarget(input), true);
    assert.strictEqual(window.isTextEntryTarget(ta), true);
    assert.strictEqual(window.isTextEntryTarget(ed), true);
    assert.strictEqual(window.isTextEntryTarget(document.body), false);
    assert.strictEqual(window.isTextEntryTarget(null), false);

    const off = window.installUndoShortcut(document);
    assert.strictEqual(typeof off, "function");
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    await window.captureUndo("Set X of Main", "position");
    wrapper.style.setProperty("left", "60px", "important");
    async function left() { return (await window.scanLayout()).sections["section-main"].left; }
    assert.strictEqual(await left(), "60px");
    const ev = new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: document.body, enumerable: true });
    document.dispatchEvent(ev);
    await waitFor(async function () { return (await left()) === "10px"; }, { timeout: 2000 });
    assert.strictEqual(await left(), "10px");
    off();
    wrapper.style.setProperty("left", "10px", "important");
    await window.captureUndo("probe inert", "position");
    wrapper.style.setProperty("left", "60px", "important");
    const off2 = window.installUndoShortcut(document);
    input.focus();
    const ev2 = new window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(ev2, "target", { value: input, enumerable: true });
    document.dispatchEvent(ev2);
    await new Promise(function (r) { setTimeout(r, 30); });
    assert.strictEqual(await left(), "60px", "inert inside input");
    assert.strictEqual(ev2.defaultPrevented, false);
    off2();
  });

  it("undoScreenLabel truncates at word boundary, patch/repair primitives are live", async function () {
    assert.strictEqual(window.undoScreenLabel("short"), "short");
    assert.strictEqual(window.undoScreenLabel(null), null);
    const long = "Undo: Toggle compact mode for \"Actions\" with a very long label that exceeds";
    const short = window.undoScreenLabel(long);
    assert.ok(short.length < long.length && short.endsWith("\u2026"));
    assert.strictEqual(typeof window.patchCapturedFields, "function");
    assert.strictEqual(typeof window.repairSectionFlags, "function");
    assert.strictEqual(typeof window.repairLateExtractions, "function");
    assert.strictEqual(typeof window.snapshotSectionFlags, "function");
    assert.strictEqual(typeof window.snapshotContainerGeometry, "function");
    const sec = document.getElementById("section-main");
    const geom = window.snapshotContainerGeometry(sec);
    assert.ok(geom && typeof geom.width === "string");
    assert.strictEqual(typeof window.offerUndo, "function");
    assert.strictEqual(typeof window.clearUndoOffer, "function");
    assert.strictEqual(typeof window.hasUndoOffer, "function");
  });

  it("beginMutation + pushMutation with repair rewrites late capture", async function () {
    const sec = document.getElementById("section-main");
    const snap = window.snapshotSectionFlags();
    const mut = window.beginMutation(snap);
    sec.classList.add("be-compact-mode");
    window.pushMutation(mut, "Toggle compact", "compact", window.repairSectionFlags);
    await waitFor(function () { return window.undoDepth() > 0; }, { timeout: 2000 });
    assert.strictEqual(window.peekUndo().class, "compact");
    await window.applyUndo();
    assert.strictEqual(sec.classList.contains("be-compact-mode"), false);
  });
});
