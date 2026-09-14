/**
 * Phase 2b — corner resize and rotate (track undo_stack_20260911).
 *
 * Neither class requested a persist before this track (spec.md U-4), so this sub-step also
 * settles AC-7's "when does this mutation become permanent" for an uncovered class: the
 * commit point is DEFINED as gesture start -> gesture end, and the record is pushed at that
 * point (asserted below by the depth landing on 1 right after the gesture ends).
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
          <div class="print-section-content"><div style="width: 200px;">body</div></div>
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

async function state(window) {
  return JSON.stringify(await window.scanLayout());
}

function mouse(window, type, target, x, y) {
  const e = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, "target", { value: target, enumerable: true });
  return e;
}

/** A real resize gesture: mousedown on the handle, drag, mouseup. */
async function resizeBy(window, document, handle, dx, dy) {
  handle.dispatchEvent(mouse(window, "mousedown", handle, 100, 100));
  await new Promise((r) => setTimeout(r, 0));
  document.documentElement.dispatchEvent(mouse(window, "mousemove", handle, 100 + dx, 100 + dy));
  document.documentElement.dispatchEvent(mouse(window, "mouseup", handle, 100 + dx, 100 + dy));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

/** initResizeLogic is a closure inside main.js; it adds the handles, so run it first. */
function addResizeHandles(window) {
  if (typeof window.initResizeLogic === "function") window.initResizeLogic();
}

describe("Phase 2b — corner resize (AC-3, AC-7)", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    addResizeHandles(window);
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("a real resize pushes ONE record at gesture end, and the undo restores the size EXACTLY", async function () {
    const section = document.getElementById("section-main");
    const handle = section.querySelector(".print-section-resize-handle");
    assert.ok(handle, "the resize handle exists (initResizeLogic ran)");

    const before = await state(window);
    await resizeBy(window, document, handle, 64, 32);
    const after = await state(window);

    assert.notStrictEqual(after, before, "the resize must CHANGE the state, or this is vacuous");
    assert.strictEqual(window.undoDepth(), 1, "one record for one gesture");

    const top = window.peekUndo();
    assert.strictEqual(top.class, "resize", "tagged as the resize class");
    assert.ok(/section-main/.test(top.label), "the label names the subject: " + top.label);

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-resize layout — including the innerWidths that " +
        "adjustInnerContentWidth changes as a SIDE EFFECT (asserting only the pixel size " +
        "would let that leak)",
    );
  });

  it("a resize that changes nothing pushes nothing — the no-op guard", async function () {
    const section = document.getElementById("section-main");
    const handle = section.querySelector(".print-section-resize-handle");
    assert.ok(handle, "the resize handle exists");

    handle.dispatchEvent(mouse(window, "mousedown", handle, 100, 100));
    await new Promise((r) => setTimeout(r, 0));
    // Release with no movement at all.
    document.documentElement.dispatchEvent(mouse(window, "mouseup", handle, 100, 100));
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(window.undoDepth(), 0, "a zero-delta resize must not push a record");
  });

  it("a SAME-TICK resize is still recorded correctly (late captures are repaired)", async function () {
    // The adversarial timing: the gesture completes before the capture can settle, so its
    // DOM reads land AFTER the size was written. The record must still be the PRE-resize
    // geometry — including innerWidths — which is what the synchronous geometry snapshot
    // is for.
    const section = document.getElementById("section-main");
    const handle = section.querySelector(".print-section-resize-handle");
    assert.ok(handle, "the resize handle exists");
    const before = await state(window);

    handle.dispatchEvent(mouse(window, "mousedown", handle, 100, 100));
    document.documentElement.dispatchEvent(mouse(window, "mousemove", handle, 180, 140));
    document.documentElement.dispatchEvent(mouse(window, "mouseup", handle, 180, 140));
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });

    assert.strictEqual(window.undoDepth(), 1, "the fast resize still produced a record");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-resize layout — proving the record was NOT taken post-resize",
    );
  });
});

describe("Phase 2b — rotate (AC-3, AC-7)", function () {
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

  it("a real rotate pushes ONE record at gesture end, and the undo restores the angle EXACTLY", async function () {
    const shape = window.createShape("assets/ornament.webp");
    const container = shape.querySelector(".print-section-container");
    const wrapper = shape;
    // Show the rotation tool, which is what creates the handle.
    wrapper.dispatchEvent(new window.CustomEvent("be-rotate-click", { bubbles: true }));
    const handle = wrapper.querySelector(".be-rotation-handle");
    assert.ok(handle, "the rotation handle exists after the toggle");

    const before = await state(window);
    const beforeAngle = wrapper.dataset.rotation || "0";

    handle.dispatchEvent(mouse(window, "mousedown", handle, 200, 100));
    await new Promise((r) => setTimeout(r, 0));
    // Drag to a clearly different angle from the handle's centre.
    document.dispatchEvent(mouse(window, "mousemove", handle, 100, 300));
    document.dispatchEvent(mouse(window, "mouseup", handle, 100, 300));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const after = await state(window);
    assert.notStrictEqual(after, before, "the rotation must CHANGE the state, or this is vacuous");
    assert.notStrictEqual(
      wrapper.dataset.rotation,
      beforeAngle,
      "the angle actually moved",
    );
    assert.strictEqual(window.undoDepth(), 1, "one record for one gesture");
    assert.strictEqual(window.peekUndo().class, "rotate", "tagged as the rotate class");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-rotation layout");
    // RE-QUERY: applyLayout removes and re-creates shape wrappers, so the node held before
    // the undo is detached — asserting on it would read a stale attribute (which is how a
    // first draft of this case reported '165' and looked like a product failure).
    const live = document.getElementById(container.id);
    assert.ok(live, "the shape was re-created by the restore");
    const liveWrapper = live.closest(".be-shape-wrapper") || live;
    assert.strictEqual(
      liveWrapper.dataset.rotation || "0",
      beforeAngle,
      "and the angle is back on the LIVE node",
    );
  });
});
