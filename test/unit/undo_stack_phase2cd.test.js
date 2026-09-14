/**
 * Phase 2c + 2d — layer restack, chip reparenting, layer flags and rename.
 * Track undo_stack_20260911.
 *
 * 2d is the class the original audit MISSED entirely (spec.md U-8): isLocked / isHidden /
 * isDisabledOnPrint are all persisted by scanLayout and all user-togglable, plus the layer
 * RENAME which writes the persisted `name`.
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
        <div class="print-section-container" id="section-main">
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

function bootPanel() {
  const b = boot(SHEET);
  b.window.LayerManager = b.window.LayerManager || LayerManager;
  b.window.eval(DND_JS);
  return b;
}

async function state(window) {
  return JSON.stringify(await window.scanLayout());
}

function ev(window, type, target, extra) {
  const e = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: (extra && extra.clientX) || 0,
    clientY: (extra && extra.clientY) || 0,
  });
  // `target` is read-only on a dispatched event in jsdom, so it is pinned the way the
  // repo's own dnd suites pin it.
  Object.defineProperty(e, "target", { value: target, enumerable: true });
  return e;
}

/**
 * A new layer's CONTAINER is created by the app's refresh path, not by addShapeLayer
 * (which only appends to `shapeLayers`). The reparent primitive looks the container up by
 * `layer.layerId`, so the test has to create it the same way the app does.
 */
function addLayerWithContainer(window, document, lm) {
  const layer = lm.addShapeLayer();
  const container = document.createElement("div");
  container.className = "be-shape-layer-container";
  container.id = layer.layerId;
  document.getElementById("print-enhance-shapes-layer").appendChild(container);
  return layer;
}

describe("Phase 2c — layer restack (AC-3)", function () {
  this.timeout(20000);
  let window, document, cleanup, lm;

  beforeEach(async function () {
    const b = bootPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    // Three layers so a reorder is observable.
    addLayerWithContainer(window, document, lm);
    addLayerWithContainer(window, document, lm);
    lm.refreshLayerContents();
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("a real row drop pushes ONE record, and the undo restores the ORDER exactly", async function () {
    const order = () => lm.shapeLayers.map((l) => l.id).join("|");
    const before = order();
    assert.ok(lm.shapeLayers.length >= 3, "three layers exist");

    // Drive the REAL gesture path: dragstart on the row -> dragover -> drop -> dragend.
    const row = lm.panel.querySelector('[data-layer-id="' + lm.shapeLayers[2].id + '"]');
    assert.ok(row, "the row exists");
    row.dispatchEvent(ev(window, "dragstart", row, { clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 0));

    const group = row.closest(".be-layer-group") || row.parentElement;
    // A dragover at the TOP of the stack asks for a move to the front.
    group.dispatchEvent(ev(window, "dragover", group, { clientY: -999 }));
    group.dispatchEvent(ev(window, "drop", group, { clientY: -999 }));
    row.dispatchEvent(ev(window, "dragend", row, {}));
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });

    const after = order();
    assert.notStrictEqual(after, before, "the drop must CHANGE the order, or this is vacuous");
    assert.strictEqual(window.undoDepth(), 1, "one record for one gesture");
    assert.strictEqual(window.peekUndo().class, "restack", "tagged as the restack class");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(order(), before, "the layer ORDER is exactly as it was");
  });
});

describe("Phase 2c — chip reparenting (AC-3)", function () {
  this.timeout(20000);
  let window, document, cleanup, lm;

  beforeEach(async function () {
    const b = bootPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    lm.refreshLayerContents();
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("moving a shape to another layer is reversible, membership included", async function () {
    const shape = window.createShape("assets/ornament.webp");
    // The reparent API takes the WRAPPER id (the record is keyed by the CONTAINER id —
    // `snapshotLayerMembership` translates between them).
    const id = shape.id;
    const target = addLayerWithContainer(window, document, lm);
    lm.refreshLayerContents();

    const before = await state(window);
    const moved = await lm.moveShapeToExistingLayer(id, target.id);
    assert.strictEqual(moved, true, "the reparent applied");
    const after = await state(window);
    assert.notStrictEqual(after, before, "the reparent must CHANGE the state");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(window.peekUndo().class, "reparent", "tagged as the reparent class");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-move layout — the shape is back in its original layer",
    );
  });
});

describe("Phase 2d — layer flags and rename (AC-3)", function () {
  this.timeout(20000);
  let window, cleanup, lm;

  beforeEach(async function () {
    const b = bootPanel();
    window = b.window;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    lm = window.DomManager.getInstance().getLayerManager();
    lm.createPanel();
    lm.refreshLayerContents();
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("the PRINT toggle is reversible — the flag is read back from scanLayout", async function () {
    const layer = lm.shapeLayers[0];
    const before = await state(window);
    lm.toggleLayerPrint(layer);
    const after = await state(window);
    assert.notStrictEqual(after, before, "the toggle must CHANGE the persisted state");
    assert.ok(/"isDisabledOnPrint":true/.test(after), "the flag is set in the record");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(window.peekUndo().class, "layer-flag", "tagged as a layer-flag mutation");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-toggle layout");
  });

  it("the VISIBILITY toggle is reversible — the flag the browser pass found missing", async function () {
    // This case exists because the real-browser per-class verification caught a site the
    // unit suite did not cover: `toggleLayerVisibility` had NO capture point at all (its
    // wiring was lost with a reverted draft), so hiding a layer was recorded as nothing and
    // the unit suite was green. The assertion reads the flag back out of scanLayout, not off
    // the button, so it cannot pass on button state alone.
    const layer = lm.shapeLayers[0];
    const before = await state(window);
    lm.toggleLayerVisibility(layer);
    const after = await state(window);
    assert.notStrictEqual(after, before, "the toggle must CHANGE the persisted state");
    assert.ok(/"isHidden":true/.test(after), "the flag is set in the record");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(window.peekUndo().class, "layer-flag", "tagged as a layer-flag mutation");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-toggle layout");
  });

  it("the LOCK toggle is reversible INCLUDING its cascade to every other layer", async function () {
    // The cascade is the reason the snapshot covers all layers: the clicked layer is not
    // the only one that changes.
    const layer = lm.shapeLayers[0];
    const before = await state(window);
    lm.toggleLayerLock(layer);
    const after = await state(window);
    assert.notStrictEqual(after, before, "the toggle must CHANGE the persisted state");
    assert.notStrictEqual(
      after.match(/"isLocked":true/g).length,
      before.match(/"isLocked":true/g).length,
      "more than one layer changed — the cascade fired",
    );

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-toggle layout — the cascade is reverted too, not just the clicked layer",
    );
  });

  it("the RENAME is reversible, and a rename to the SAME name pushes nothing", async function () {
    const layer = lm.shapeLayers[0];
    const before = await state(window);

    // Drive the real entry point; only the modal is stubbed (it is the user's input).
    window.showInputModal = async () => "Renamed Layer";
    await lm.showRenameModal(layer);
    const after = await state(window);
    assert.notStrictEqual(after, before, "the rename must CHANGE the persisted name");
    assert.ok(/"name":"Renamed Layer"/.test(after), "the new name is in the record");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(window.peekUndo().class, "rename", "tagged as the rename class");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-rename layout");

    // And the no-op: re-renaming to the CURRENT name is not a mutation.
    const depth = window.undoDepth();
    window.showInputModal = async () => layer.label;
    await lm.showRenameModal(layer);
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(window.undoDepth(), depth, "a rename that changes nothing pushes nothing");
  });
});
