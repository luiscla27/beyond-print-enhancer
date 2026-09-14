/**
 * AC-6 (the record is the LIVE layout) and AC-7 (persistence + autosave DEFINED).
 * Track undo_stack_20260911.
 *
 * AC-6 is the criterion the source issue named as point 3: the snapshot used to capture the
 * layout as last SAVED, so undoing also reverted edits made since the last save. These
 * cases assert the record is the LIVE layout instead — and, crucially, they assert the
 * direction that a last-saved record would get WRONG (it would lose the unsaved edit).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");
const LayerManager = require("../../js/dom/layer_manager.js");
const DND_JS = fs.readFileSync(path.join(__dirname, "..", "..", "js", "dnd.js"), "utf8");

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <div class="be-section-wrapper" id="wrapper-main" data-title="Main">
        <div class="print-section-container" id="section-main" style="width: 200px; height: 100px;">
          <div class="print-section-header"><span>Main</span></div>
        </div>
      </div>
    </div>
    <div id="print-enhance-shapes-layer">
      <div class="be-shape-layer-container" id="shapes-default"></div>
    </div>
    <div id="print-enhance-properties-panel"></div>
  </div>
</body></html>`;

function bootEditor() {
  const b = boot(SHEET);
  b.window.LayerManager = b.window.LayerManager || LayerManager;
  b.window.eval(DND_JS);
  return b;
}

async function left(window) {
  const L = await window.scanLayout();
  return (L.sections["section-main"] || {}).left;
}

describe("AC-6 — the record is the LIVE layout, not the last-saved one", function () {
  this.timeout(20000);
  let window, document, cleanup;

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

  it("undoing a mutation does NOT revert an edit made since the last save", async function () {
    const wrapper = document.getElementById("wrapper-main");
    const section = document.getElementById("section-main");

    // 1. A persisted baseline: the SAVED layout says left = 10px.
    wrapper.style.setProperty("left", "10px", "important");
    const baseline = await window.scanLayout();
    await window.__DDBStorage.saveGlobalLayout(baseline);
    assert.strictEqual((await window.__DDBStorage.loadGlobalLayout()).sections["section-main"].left, "10px");

    // 2. An UNSAVED edit: left -> 50px. Nothing persists this.
    wrapper.style.setProperty("left", "50px", "important");
    assert.strictEqual(await left(window), "50px", "the live layout has the unsaved edit");
    assert.strictEqual(
      (await window.__DDBStorage.loadGlobalLayout()).sections["section-main"].left,
      "10px",
      "…and the SAVED layout does not — the two now disagree, which is the window AC-6 closes",
    );

    // 3. A recorded mutation on top: left -> 90px. The record is taken first.
    await window.captureUndo("Set X of Main", "position");
    wrapper.style.setProperty("left", "90px", "important");
    assert.strictEqual(await left(window), "90px");

    // 4. Undo it. The record must be the LIVE pre-state (50px), NOT the last-saved 10px.
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await left(window),
      "50px",
      "EXACTLY the live state before the mutation — the unsaved edit SURVIVED",
    );
    assert.notStrictEqual(
      await left(window),
      "10px",
      "the falsification: a last-saved record would have produced 10px here and silently " +
        "destroyed the unsaved edit (that is the documented limitation this criterion closes)",
    );
    assert.strictEqual(
      (await window.__DDBStorage.loadGlobalLayout()).sections["section-main"].left,
      "10px",
      "and the BACKUP history is untouched — it still holds the saved baseline",
    );
    assert.ok(section, "the section is still there");
  });

  it("asserts live and last-saved DIFFER at capture time (the window is real, not assumed)", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    await window.__DDBStorage.saveGlobalLayout(await window.scanLayout());
    wrapper.style.setProperty("left", "77px", "important");

    const live = await window.scanLayout();
    const saved = await window.__DDBStorage.loadGlobalLayout();
    assert.notStrictEqual(
      live.sections["section-main"].left,
      saved.sections["section-main"].left,
      "if these agreed, this case would prove nothing about which one the record uses",
    );
  });
});

describe("AC-7 — persistence and the autosave interaction are DEFINED", function () {
  this.timeout(20000);
  let window, document, cleanup;

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

  it("the stack is SESSION-SCOPED — O-2 ratified, and the record proves it", async function () {
    // O-2: the stack does not survive a reload, because persisting a full layout per
    // mutation multiplies IndexedDB usage by the depth and collides with the 3-deep
    // MAX_BACKUPS prune (10 since ux_gaps_20260911 Phase 3; it was 3) that bounds storage.
    // Cross-reload recovery
    // stays the backup history's job.
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "42px", "important");
    await window.captureUndo("probe", "position");
    assert.strictEqual(window.undoDepth(), 1, "one record in this session");

    // The serialized layout carries NO undo state — so a reload cannot resurrect it.
    const serialized = JSON.stringify(await window.scanLayout());
    assert.ok(
      !/undoStack|undo_stack|__undo/i.test(serialized),
      "the persisted layout must not carry the undo stack",
    );

    // And a fresh session starts empty, which is the observable a reload would produce.
    const fresh = bootEditor();
    try {
      await fresh.window.__DDBStorage.init();
      assert.strictEqual(
        fresh.window.undoDepth(),
        0,
        "a new session starts with an empty stack (session-scoped, as O-2 ratified)",
      );
    } finally {
      fresh.cleanup();
    }
  });

  it("pushes BEFORE the autosave debounce fires — the ordering is defined, not incidental", async function () {
    // AC-7's ordering requirement for a class whose persist moment was previously
    // undefined: the record exists before the save that makes the mutation permanent, so
    // "undo after autosave" always has something to undo.
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    const layer = lm.shapeLayers[0];
    const before = window.undoDepth();

    lm.toggleLayerPrint(layer);
    // The push happens synchronously for a settled capture; either way it must land well
    // inside the 1000ms debounce window.
    await waitFor(() => window.undoDepth() > before, { timeout: 500 });
    assert.strictEqual(
      window.undoDepth(),
      before + 1,
      "the record is on the stack BEFORE the autosave debounce (AUTOSAVE_DEBOUNCE_MS = 1000) " +
        "could have persisted the change",
    );
  });

  it("the bound holds under bound+1 pushes and never touches the backup FIFO (O-1, O-4)", async function () {
    await window.createBackupSnapshot("probe a");
    const backupsBefore = (await window.listBackups()).length;
    const live = await window.captureLiveLayout();
    for (let i = 0; i < window.UNDO_STACK_MAX + 1; i += 1) {
      window.pushUndo(live, "m" + i);
      assert.ok(window.undoDepth() <= window.UNDO_STACK_MAX, "depth never exceeds the bound");
    }
    assert.strictEqual(window.undoDepth(), window.UNDO_STACK_MAX, "the bound holds");
    assert.strictEqual(
      (await window.listBackups()).length,
      backupsBefore,
      "stack eviction never touches the 3-deep backup FIFO",
    );
  });
});
