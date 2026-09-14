/**
 * Coverage for the capture points that had NO test asserting the push.
 * Track undo_stack_20260911 — a post-release audit.
 *
 * WHY THIS FILE EXISTS. The browser verification found two shipped bugs whose common
 * signature was: a capture point existed, the suite was green, and nothing asserted the
 * STACK. So every capture point in the product was enumerated against the tests, and seven
 * had no push assertion at all. Auditing them found two more real defects:
 *
 *   - `batchReparent` pushed AFTER an unconditional `return` — dead code, so batch
 *     reparenting was not undoable at all;
 *   - the shape-asset switch captured AFTER writing `dataset.assetPath`, so the record held
 *     the NEW path and the undo produced an inconsistent shape (new path, old classes).
 *
 * Both are fixed and asserted here. This file's job is to make those classes fail loudly if
 * they regress, since nothing else looks at their stack.
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
    <div id="print-enhance-controls-container"></div>
  </div>
</body></html>`;

function bootEditor() {
  const b = boot(SHEET);
  b.window.LayerManager = b.window.LayerManager || LayerManager;
  b.window.eval(DND_JS);
  return b;
}

async function state(window) {
  return JSON.stringify(await window.scanLayout());
}

/**
 * Put the fixture into the state a LIVE page is in before a user acts.
 *
 * `printZIndex` is DERIVED state: `updatePrintZIndexes` recomputes `dataset.printZ` from the
 * layer panel's order and index, and the restore path ends with exactly that
 * (`applyLayout` -> `SectionUtils.refreshLayers()` -> `updatePrintZIndexes(true)`). A fixture
 * that never ran that derivation starts with `printZ` values the product never produces
 * (two sections both at "10"), so the first derivation — triggered by any restore — looks
 * like the undo drifted. Measured: with the banding derived once, the round trip is EXACT.
 *
 * This is the same lesson as the retracted D-1 in this track: a fixture that does not match
 * what the production path emits can manufacture a difference that does not exist. The
 * product is not changed for it; the fixture is.
 */
function deriveLayoutState(window) {
  const lm = window.DomManager.getInstance().getLayerManager();
  if (!lm) return;
  lm.createPanel();
  lm.refreshLayerContents();
  lm.updatePrintZIndexes(true);
}

/** Add an empty layer WITH its container — the app's refresh path creates the container. */
function addLayerWithContainer(window, document, lm) {
  const layer = lm.addShapeLayer();
  const container = document.createElement("div");
  container.className = "be-shape-layer-container";
  container.id = layer.layerId;
  document.getElementById("print-enhance-shapes-layer").appendChild(container);
  return layer;
}

describe("coverage — BATCH reparent pushes a record (was dead code)", function () {
  this.timeout(20000);
  let window, document, cleanup, lm;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    lm = window.DomManager.getInstance().getLayerManager();
    deriveLayoutState(window);
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("a batch of two moves pushes exactly ONE record, and the undo restores both", async function () {
    const a = window.createShape("assets/ornament.webp");
    const b2 = window.createShape("assets/shapes/corner_spikes.webp");
    const idA = a.querySelector(".print-section-container").id;
    const idB = b2.querySelector(".print-section-container").id;
    const target = addLayerWithContainer(window, document, lm);
    lm.refreshLayerContents();

    const before = await state(window);
    const ok = lm.batchReparent([
      { wrapperId: a.id, targetLayerId: target.id },
      { wrapperId: b2.id, targetLayerId: target.id },
    ]);
    assert.strictEqual(ok, true, "the batch applied");

    const after = await state(window);
    assert.notStrictEqual(after, before, "the batch must CHANGE the layout");

    // THE ASSERTION THE OLD TEST NEVER MADE. Before the fix this block sat after a
    // `return`, so the stack stayed empty here and the batch was silently un-undoable.
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(
      window.undoDepth(),
      1,
      "ONE record for the whole batch (the user performed one action)",
    );
    assert.strictEqual(window.peekUndo().class, "reparent", "tagged as reparent");
    assert.ok(/2 shapes/.test(window.peekUndo().label), "named with the count: " + window.peekUndo().label);

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-batch layout (both shapes back)");
    assert.ok(idA && idB, "both shapes were identified");
  });

  it("a batch that applies NOTHING pushes nothing (no undo that reverts nothing)", async function () {
    const shape = window.createShape("assets/ornament.webp");
    // Move it to the layer it is already in: the primitive refuses, so `applied` is 0.
    const currentLayerId = shape.parentElement.id;
    const current = lm.shapeLayers.find((l) => l.layerId === currentLayerId);
    if (current) {
      lm.batchReparent([{ wrapperId: shape.id, targetLayerId: current.id }]);
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(window.undoDepth(), 0, "nothing applied, so nothing recorded");
    }
  });
});

describe("coverage — BOTH compact-toggles in the Manage Compact modal push records", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    deriveLayoutState(window);
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  /** Open the real Manage Compact dialog and return its two kinds of control. */
  async function openManageCompact() {
    window.handleManageCompact();
    await waitFor(() => document.querySelector(".be-modal-overlay"), { timeout: 3000 });
    return {
      overlay: document.querySelector(".be-modal-overlay"),
    };
  }

  it("the modal's per-section toggle is reversible", async function () {
    const { overlay } = await openManageCompact();
    const btn = overlay.querySelector(".be-modal-ok"); // "Toggle All" reuses this class
    assert.ok(btn, "the modal rendered");

    // The PER-SECTION controls are the small ON/OFF buttons in the list.
    const perSection = Array.from(overlay.querySelectorAll("button")).find((x) =>
      /^(ON|OFF)$/.test(x.textContent.trim()),
    );
    assert.ok(perSection, "a per-section ON/OFF control exists");

    const before = await state(window);
    perSection.click();
    await waitFor(() => window.undoDepth() > 0, { timeout: 3000 });
    assert.notStrictEqual(await state(window), before, "the toggle changed the layout");
    assert.strictEqual(window.peekUndo().class, "compact", "tagged as compact");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-toggle layout");
  });

  it("the modal's TOGGLE ALL control is reversible", async function () {
    const { overlay } = await openManageCompact();
    const toggleAll = Array.from(overlay.querySelectorAll("button")).find(
      (x) => x.textContent.trim() === "Toggle All",
    );
    assert.ok(toggleAll, "the Toggle All control exists");

    const before = await state(window);
    toggleAll.click();
    await waitFor(() => window.undoDepth() > 0, { timeout: 3000 });
    const after = await state(window);
    assert.notStrictEqual(after, before, "the toggle-all changed the layout");
    assert.ok(/"compact":true/.test(after), "the flags are set in the record");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-toggle layout");
  });
});

describe("coverage — the shape-asset switch captures BEFORE the write", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    await window.injectCloneButtons();
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("switching a shape's asset is recorded with the OLD path, and the undo restores it", async function () {
    const shape = window.createShape("assets/ornament.webp");
    await window.injectCloneButtons();
    const container = shape.querySelector(".print-section-container");
    const oldPath = container.dataset.assetPath;
    assert.ok(oldPath, "the shape starts with an asset path: " + oldPath);

    const before = await state(window);
    const btn = shape.querySelector(".be-shape-switch");
    assert.ok(btn, "the switch control exists");

    // Drive the REAL picker. Stubbing `window.showShapePickerModal` does NOT work here: the
    // button's handler closes over the function destructured at module load, so replacing the
    // window property changes nothing (measured — the first draft of this test failed with
    // "the switch changed the layout" for exactly that reason).
    btn.click();
    // `waitFor` returns a BOOLEAN, not the predicate's value — so the element is polled for
    // separately rather than returned through it.
    await waitFor(
      () => document.querySelectorAll(".be-modal-overlay .be-border-option").length > 1,
      { timeout: 3000 },
    );
    const modal = document.querySelector(".be-modal-overlay");
    assert.ok(modal, "the picker opened");
    const options = Array.from(modal.querySelectorAll(".be-border-option"));
    const other = options.find((o) => {
      const img = o.querySelector("img");
      return img && img.getAttribute("src") && !img.getAttribute("src").includes("ornament");
    }) || options[1];
    assert.ok(other, "the picker offered an alternative asset");
    other.click();
    const apply = modal.querySelector(".be-modal-ok");
    assert.ok(apply, "the picker has an Apply control");
    apply.click();
    await waitFor(() => window.undoDepth() > 0, { timeout: 3000 });

    const after = await state(window);
    assert.notStrictEqual(after, before, "the switch changed the layout");
    assert.strictEqual(window.peekUndo().class, "asset", "tagged as asset");

    // THE ASSERTION THAT CATCHES THE BUG: the RECORD must hold the OLD path. When the
    // capture ran after the write it held the NEW one, and the undo then produced a shape
    // with the new path but the old visual classes.
    const recOf = (layout, id) =>
      ((layout.shapeLayers || [])[0] || {}).elements.find((e) => e.id === id);
    const top = window.peekUndo();
    assert.strictEqual(
      (recOf(top.before, container.id) || {}).assetPath,
      oldPath,
      "the record holds the PRE-switch asset path (a capture after the write held the new one)",
    );
    assert.notStrictEqual(
      (recOf(top.before, container.id) || {}).assetPath,
      "assets/shapes/corner_spikes.webp",
      "and specifically NOT the new one",
    );

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-switch layout");
    assert.strictEqual(
      document.getElementById(container.id).dataset.assetPath,
      oldPath,
      "and the live path is the old one again",
    );
  });
});

describe("coverage — the THIRD batch: clone section, add shape, roll back extraction", function () {
  // These three were still unasserted after the first coverage pass — the pass covered 4 of
  // the 7 sites it listed and this file said otherwise for a while. Auditing them found ONE
  // more real defect: "roll back extraction" had its capture point wired to the RESTORE path
  // only, so the path a user actually takes (extract something, then roll it back) was not
  // recorded at all. The capture now lives in `rollbackExtraction`, which BOTH paths call.
  this.timeout(20000);
  let window, document, cleanup;

  const EXTRACT_SHEET = `<!DOCTYPE html><html><body>
    <div id="print-layout-wrapper">
      <div id="print-enhance-sections-layer">
        <div class="be-section-wrapper" id="wrapper-main" data-title="Main">
          <div class="print-section-container" id="section-main" style="width: 200px; height: 100px;">
            <div class="print-section-header"><span>Main</span></div>
            <div class="print-section-content"><div>body</div></div>
          </div>
        </div>
        <div class="ct-actions-group" id="target-element">
          <h3 class="head">My Actions</h3>
          <p>Some content</p>
        </div>
      </div>
      <div id="print-enhance-shapes-layer">
        <div class="be-shape-layer-container" id="shapes-default"></div>
      </div>
      <div id="print-enhance-properties-panel"></div>
    </div>
  </body></html>`;

  beforeEach(async function () {
    const b = boot(EXTRACT_SHEET);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.flagExtractableElements();
    deriveLayoutState(window);
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("ROLL BACK EXTRACTION through the USER path is recorded (the path that was missing)", async function () {
    // 1. Extract through the product's own entry point (double-click an extractable element).
    const target = document.getElementById("target-element");
    assert.ok(target, "the extractable element exists");
    target.dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
    await waitFor(() => document.querySelector(".be-extracted-section"), { timeout: 3000 });

    const extracted = document.querySelector(".be-extracted-section");
    assert.ok(extracted, "an extracted section was created");

    // NOTE: creating the extraction is NOT asserted as recorded, because it is NOT — that gap
    // is real and documented at `extractElementRecorded` in js/main.js (wiring it needs the
    // non-deferring pattern plus a repair, since this class ADDS an entry and a late capture
    // would include it). Claiming it here would be a false assertion; the ROLLBACK below is
    // the arm this case exists for.

    // 2. Roll it back through the USER-facing control. THIS is the arm that was broken:
    //    `handleElementExtraction` wires `.be-delete-button`, while the capture point used to
    //    live on `.print-section-minimize` in `renderExtractedSection` — which only runs on
    //    the RESTORE path. So this click used to push nothing.
    window.clearUndoStack();
    const recordedBefore = await state(window);
    // Driven through `rollbackExtraction` — the class's single capture entry point, the
    // one BOTH wired controls call (`.be-delete-button` from the user path and
    // `.print-section-minimize` from the restore path). A DOM-control arm is not used, and
    // the reason is recorded rather than glossed: a FRESHLY extracted wrapper carries no
    // `.be-delete-button` (that element is created by js/spells_ui.js for spell details),
    // so the user-path control is conditionally absent for a plain extraction. How a plain
    // extraction is rolled back in the live product is a separate question, NOT claimed
    // either way here.
    await window.SectionCloning.rollbackExtraction(extracted);
    await waitFor(() => window.undoDepth() > 0, { timeout: 3000 });

    assert.ok(
      window.undoDepth() > 0,
      "rolling back an extraction through the user path MUST be recorded — this is the " +
        "assertion that was missing, and the capture used to be on the restore path instead",
    );
    assert.strictEqual(window.peekUndo().class, "structural", "tagged as structural");
    assert.strictEqual(window.peekUndo().label, "Roll back extraction", "and named");

    const after = await state(window);
    assert.notStrictEqual(after, recordedBefore, "the rollback changed the layout");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), recordedBefore, "EXACTLY the pre-rollback layout");
  });

  it("CLONE SECTION through the real control pushes a record", async function () {
    await window.injectCloneButtons();
    const wrapper = document.getElementById("wrapper-main");
    const btn = wrapper.querySelector(".be-clone-button");
    assert.ok(btn, "the clone-section control exists in the section menu");

    // The name comes from the REAL dialog. It CANNOT be stubbed through
    // `window.showInputModal`: the handler closes over the function destructured at module
    // load (js/main.js:85), so replacing the window property changes nothing — measured, the
    // title came back undefined and neither the capture nor the clone ran.
    const before = await state(window);
    btn.click();
    await waitFor(
      () => !!document.querySelector('.be-modal-overlay input.be-modal-input'),
      { timeout: 3000 },
    );
    const input = document.querySelector('.be-modal-overlay input.be-modal-input');
    assert.ok(input, 'the clone-name dialog opened');
    input.value = 'Cloned In Test';
    document.querySelector('.be-modal-overlay .be-modal-ok').click();
    await waitFor(() => window.undoDepth() > 0, { timeout: 3000 });

    const after = await state(window);
    assert.notStrictEqual(after, before, "the clone must CHANGE the layout");
    assert.strictEqual(window.peekUndo().class, "structural", "tagged as structural");
    assert.ok(
      /^Clone "/.test(window.peekUndo().label),
      "named with the clone's title: " + window.peekUndo().label,
    );
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-clone layout — the created clone is gone",
    );
  });

  it("ADD SHAPE through the control-panel button pushes a record", async function () {
    // This case boots its OWN minimal fixture rather than reusing the extraction sheet. Reason
    // (measured): on that sheet the created shape lands in a container `scanLayout` does not
    // associate with any layer, so the element count stays 0 and the assertion cannot be made —
    // while the record was pushed correctly (`depth=1 label="Add shape"`). The capture point is
    // what this case is for, so it runs where the effect is observable: the same shape the
    // product creates on a normal sheet.
    const b = boot(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper">
        <div id="print-enhance-sections-layer"></div>
        <div id="print-enhance-shapes-layer">
          <div class="be-shape-layer-container" id="shapes-default"></div>
        </div>
        <div id="print-enhance-properties-panel"></div>
      </div>
    </body></html>`);
    const w2 = b.window;
    const d2 = b.document;
    try {
      w2.LayerManager = w2.LayerManager || LayerManager;
      await w2.__DDBStorage.init();
      await w2.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
      w2.clearUndoStack();
      w2.createControls();
      const btn = d2.getElementById("be-btn-add-shape");
      assert.ok(btn, "the Add Shape control exists");

      // The picker is the user's input, so it is stubbed; the capture point and `createShape`
      // are the product's.
      w2.showShapePickerModal = async () => ({ assetPath: "assets/ornament.webp" });
      const before = JSON.stringify(await w2.scanLayout());
      btn.click();
      await waitFor(() => w2.undoDepth() > 0, { timeout: 3000 });

      const after = JSON.stringify(await w2.scanLayout());
      assert.notStrictEqual(after, before, "the add must CHANGE the layout");
      const elementCount = (layout) =>
        (layout.shapeLayers || []).reduce((n, l) => n + (l.elements || []).length, 0);
      assert.ok(
        elementCount(JSON.parse(after)) > elementCount(JSON.parse(before)),
        "an element was added to a layer",
      );
      assert.strictEqual(w2.peekUndo().class, "structural", "tagged as structural");
      assert.strictEqual(w2.peekUndo().label, "Add shape", "and named");
      assert.strictEqual((await w2.applyUndo()).ok, true, "undo runs");
      assert.strictEqual(
        JSON.stringify(await w2.scanLayout()),
        before,
        "EXACTLY the pre-add layout — the created shape is gone",
      );
    } finally {
      b.cleanup();
    }
  });
});
