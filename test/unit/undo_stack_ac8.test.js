/**
 * AC-8 — reachable and named (track undo_stack_20260911).
 *
 * The gate was explicit that BOTH halves of the keyboard requirement must be proven, and
 * both falsified before being trusted:
 *   - the binding actually reverts state when fired OUTSIDE a text field, and
 *   - it is INERT when fired inside one (a user undoing their typing must get the
 *     browser's undo, not a layout revert).
 * The focus guard is asserted BOTH ways, because a binding that never fires would pass a
 * one-sided "it did nothing in the input" check vacuously.
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
    <input id="some-input" type="text" />
    <textarea id="some-textarea"></textarea>
    <div id="some-editable" contenteditable="true"></div>
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

/** A real Ctrl+Z (or Cmd+Z) keydown aimed at `target`. */
function pressUndoKey(window, document, target, opts) {
  const o = opts || {};
  const e = new window.KeyboardEvent("keydown", {
    key: o.key || "z",
    ctrlKey: o.meta ? false : o.ctrlKey !== false,
    metaKey: !!o.meta,
    shiftKey: !!o.shiftKey,
    altKey: !!o.altKey,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(e, "target", { value: target || document.body, enumerable: true });
  (target || document).dispatchEvent(e);
  return e;
}

describe("AC-8 — the affordance NAMES what it will undo", function () {
  this.timeout(20000);
  let window, cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("reports null with nothing to undo, then the action AND its subject", async function () {
    assert.strictEqual(window.undoLabel(), null, "nothing to undo => no label");

    await window.captureUndo("Move Main", "drag");
    assert.strictEqual(
      window.undoLabel(),
      "Move Main",
      "the label names the action and its subject — never a generic 'Undo'",
    );

    window.clearUndoStack();
    assert.strictEqual(window.undoLabel(), null, "and back to nothing");
  });
});

describe("AC-8 — Ctrl/Cmd+Z is wired, and inert in text fields", function () {
  this.timeout(20000);
  let window, document, cleanup, off;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
    off = window.installUndoShortcut();
    assert.strictEqual(typeof off, "function", "the binding returns its unbind");
  });

  afterEach(function () {
    if (off) off();
    if (cleanup) cleanup();
  });

  /** Record a mutation to left=60px, leaving a live stack entry to undo. */
  async function recordMoveTo60() {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    await window.captureUndo("Set X of Main", "position");
    wrapper.style.setProperty("left", "60px", "important");
    assert.strictEqual(await left(window), "60px", "the mutation landed");
  }

  it("FIRING it OUTSIDE a text field reverts the layout (the positive half)", async function () {
    await recordMoveTo60();
    pressUndoKey(window, document, document.body);
    await waitFor(async () => (await left(window)) === "10px", { timeout: 2000 });
    assert.strictEqual(await left(window), "10px", "Ctrl+Z reverted the mutation");
  });

  it("is INERT inside an input, a textarea AND a contenteditable (the negative half)", async function () {
    for (const id of ["some-input", "some-textarea", "some-editable"]) {
      window.clearUndoStack();
      const wrapper = document.getElementById("wrapper-main");
      wrapper.style.setProperty("left", "10px", "important");
      await window.captureUndo("probe " + id, "position");
      wrapper.style.setProperty("left", "60px", "important");

      const target = document.getElementById(id);
      assert.ok(target, id + " exists in the fixture");
      target.focus();

      const e = pressUndoKey(window, document, target);
      await new Promise((r) => setTimeout(r, 20));

      assert.strictEqual(
        await left(window),
        "60px",
        "Ctrl+Z inside " + id + " must NOT revert the layout — the user is undoing typing",
      );
      assert.strictEqual(
        window.undoDepth(),
        1,
        "and the record is untouched, so it can still be undone afterwards",
      );
      assert.strictEqual(
        e.defaultPrevented,
        false,
        "the native undo is left alone (we do not preventDefault inside a text field)",
      );
    }
  });

  it("is a no-op with an EMPTY stack (never claims an action it cannot perform)", async function () {
    const before = await left(window);
    pressUndoKey(window, document, document.body);
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(await left(window), before, "nothing changed");
    assert.strictEqual(window.undoDepth(), 0, "and nothing was consumed");
  });

  it("FALSIFIED BOTH WAYS: unbind it and the shortcut stops working", async function () {
    // The unbound case proves the previous case was not vacuous — a binding that never
    // worked would also "not fire" inside an input.
    await recordMoveTo60();
    off();
    off = null;
    pressUndoKey(window, document, document.body);
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(
      await left(window),
      "60px",
      "with the listener unbound, Ctrl+Z does nothing — so the test that it DOES revert " +
        "while bound is measuring the binding, not the environment",
    );

    // And re-binding restores it, so the previous assertion cannot pass by accident.
    off = window.installUndoShortcut();
    pressUndoKey(window, document, document.body);
    await waitFor(async () => (await left(window)) === "10px", { timeout: 2000 });
    assert.strictEqual(await left(window), "10px", "re-bound, it reverts again");
  });

  it("ignores the near-misses: no modifier, Shift, Alt, and a different key", async function () {
    for (const opts of [
      { ctrlKey: false },
      { shiftKey: true },
      { altKey: true },
      { key: "y" },
    ]) {
      window.clearUndoStack();
      const wrapper = document.getElementById("wrapper-main");
      wrapper.style.setProperty("left", "10px", "important");
      await window.captureUndo("probe", "position");
      wrapper.style.setProperty("left", "60px", "important");

      pressUndoKey(window, document, document.body, opts);
      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(
        await left(window),
        "60px",
        "must not fire for " + JSON.stringify(opts),
      );
    }
  });
});
