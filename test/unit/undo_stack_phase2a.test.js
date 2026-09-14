/**
 * Phase 2 — the mutation breadth, one class per sub-step (track undo_stack_20260911).
 *
 * Phase 2a: drag to move, keyboard nudge, position fields — the three classes that
 * already requested a persist before this track touched them.
 *
 * Every case follows `contract.md` §2.1: the mutation is driven through the REAL gesture
 * path (never a direct state assignment), the after-state must DIFFER from the before-state
 * or the test halts as vacuous, undo is invoked through the stack pop, and the zero-delta
 * case must push nothing.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");
const LayerManager = require("../../js/dom/layer_manager.js");

/** `js/dnd.js` is not part of the shared harness boot, so it is eval'd here. */
const DND_JS = fs.readFileSync(path.join(__dirname, "..", "..", "js", "dnd.js"), "utf8");

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <div class="be-section-wrapper" id="wrapper-main" data-title="Main">
        <div class="print-section-container" id="section-main">
          <div class="print-section-header"><span>Main</span></div>
          <div class="print-section-content"><div>body</div></div>
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

/** The live layout as an exact, realm-independent string. */
async function state(window) {
  return JSON.stringify(await window.scanLayout());
}

/** The drag engine's listener host. */
function layoutRoot(window) {
  return window.DomManager.getInstance().getLayoutRoot().element;
}

/**
 * A pointer event jsdom accepts: it has no `PointerEvent`, so the dnd suite's own
 * convention is a MouseEvent named "pointer*" with `target` pinned, dispatched on the
 * layout root (which is where the engine listens).
 */
function pointer(window, type, target, x, y) {
  const e = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(e, "target", { value: target, enumerable: true });
  Object.defineProperty(e, "pointerId", { value: 1, enumerable: true });
  Object.defineProperty(e, "pointerType", { value: "mouse", enumerable: true });
  Object.defineProperty(e, "button", { value: 0, enumerable: true });
  return e;
}

/**
 * Drive a real drag through the engine: down -> moves (past threshold) -> up.
 *
 * The tick between the moves is not padding: the reversible capture starts at
 * pointerdown and must SETTLE before release, which is what happens for any real drag
 * (a human gesture takes far longer than one storage round-trip). A same-tick flick is
 * deliberately NOT simulated here — the engine refuses to push a record it could not
 * capture pre-drop, and that refusal has its own assertion below.
 */
async function dragTo(window, target, fromX, fromY, toX, toY) {
  const root = layoutRoot(window);
  root.dispatchEvent(pointer(window, "pointerdown", target, fromX, fromY));
  await new Promise((r) => setTimeout(r, 0));
  root.dispatchEvent(
    pointer(window, "pointermove", target, fromX + (toX - fromX) / 2, fromY + (toY - fromY) / 2),
  );
  root.dispatchEvent(pointer(window, "pointermove", target, toX, toY));
  root.dispatchEvent(pointer(window, "pointerup", target, toX, toY));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe("Phase 2a — drag to move (AC-3)", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.initDragAndDrop();
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("a real drag pushes ONE record, and the undo restores the pre-drag position exactly", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");

    const before = await state(window);
    await dragTo(window, wrapper, 10, 10, 60, 50);
    const after = await state(window);

    assert.notStrictEqual(after, before, "the drag must CHANGE the state, or this is vacuous");
    assert.strictEqual(window.undoDepth(), 1, "one record for one gesture");

    const top = window.peekUndo();
    assert.strictEqual(top.class, "drag", "tagged as the drag class");
    assert.ok(/Main/.test(top.label), "the label names what moved: " + top.label);

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-drag layout");
  });

  it("a SAME-TICK flick is still recorded correctly (the capture is awaited pre-drop)", async function () {
    // The adversarial timing: down, past-threshold move and up all in one turn, so the
    // pre-gesture capture cannot possibly have settled. The engine must still record the
    // PRE-drop state — it waits for the capture BEFORE finalizeDrop writes, because a
    // record taken after the drop would silently destroy work on the next undo. This is
    // the case that a "push only if already settled" design would have got wrong, and it
    // is why the await is conditional rather than absent.
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");
    const before = await state(window);

    const root = layoutRoot(window);
    root.dispatchEvent(pointer(window, "pointerdown", wrapper, 10, 10));
    root.dispatchEvent(pointer(window, "pointermove", wrapper, 60, 60));
    root.dispatchEvent(pointer(window, "pointerup", wrapper, 60, 60));
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });

    assert.strictEqual(window.undoDepth(), 1, "the flick pushed exactly one record");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-drag layout — proving the record was NOT taken post-drop",
    );
  });

  it("a CLICK (below the drag threshold) pushes nothing — the drag no-op guard", async function () {
    const wrapper = document.getElementById("wrapper-main");
    const root = layoutRoot(window);
    root.dispatchEvent(pointer(window, "pointerdown", wrapper, 10, 10));
    root.dispatchEvent(pointer(window, "pointerup", wrapper, 10, 10));
    await new Promise((r) => setTimeout(r, 0));

    assert.strictEqual(
      window.undoDepth(),
      0,
      "a press that never became a drag must not push — otherwise every click would fill " +
        "the stack with non-mutations",
    );
  });
});

describe("Phase 2a — keyboard nudge (AC-3)", function () {
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

  it("a nudge burst is ONE record (coalesced), and the undo restores exactly", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.classList.add("be-active-wrapper");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");

    const before = await state(window);
    // A held arrow key is one intent: three nudges in the same burst.
    assert.strictEqual(await window.nudgeActiveWrapper(4, 0), true, "nudge 1");
    assert.strictEqual(await window.nudgeActiveWrapper(4, 0), true, "nudge 2");
    assert.strictEqual(await window.nudgeActiveWrapper(4, 4), true, "nudge 3");
    const after = await state(window);

    assert.notStrictEqual(after, before, "the nudges must CHANGE the state");
    assert.strictEqual(
      window.undoDepth(),
      1,
      "ONE record for the burst — otherwise a single held key exhausts the O-1 bound",
    );
    assert.strictEqual(window.peekUndo().class, "nudge", "tagged as the nudge class");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-nudge layout");
  });

  it("a SECOND burst after the gap pushes its own record", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.classList.add("be-active-wrapper");
    wrapper.style.setProperty("left", "10px", "important");

    await window.nudgeActiveWrapper(4, 0);
    assert.strictEqual(window.undoDepth(), 1, "first burst");
    // Coalescing is time-bounded by AUTOSAVE_DEBOUNCE_MS (1000ms — the product's own
    // notion of "the same edit"), so a genuinely separate burst needs real elapsed time.
    // The clock cannot simply be stubbed: js/dnd.js runs inside the harness's vm context
    // and reads ITS OWN `Date`, not the test realm's.
    // 1000ms is AUTOSAVE_DEBOUNCE_MS (js/dnd.js:185), the window the coalescer uses; it
    // is not read from `window` because the harness evals dnd.js through its module
    // branch, which exports the constant rather than publishing it as a seam.
    await new Promise((r) => setTimeout(r, 1100));
    await window.nudgeActiveWrapper(4, 0);
    assert.strictEqual(window.undoDepth(), 2, "a separate burst is a separate record");
  });
});

describe("Phase 2a — position fields (AC-3)", function () {
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

  it("committing a new X pushes a record, and the undo restores exactly", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");
    // Select through the ONE write path, which renders the properties panel.
    window.setActiveSection(document.getElementById("section-main"));
    await new Promise((r) => setTimeout(r, 0));

    const input = document.querySelector('[data-be-pos="x"]');
    assert.ok(input, "the X field exists");

    const before = await state(window);
    input.value = "42";
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    const after = await state(window);

    assert.notStrictEqual(after, before, "the commit must CHANGE the state");
    assert.strictEqual(window.peekUndo().class, "position", "tagged as the position class");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-commit layout");
  });

  it("committing the SAME value pushes nothing — the zero-delta guard", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    window.setActiveSection(document.getElementById("section-main"));
    await new Promise((r) => setTimeout(r, 0));
    const input = document.querySelector('[data-be-pos="x"]');
    assert.ok(input, "the X field exists");
    assert.strictEqual(input.value, "10", "seeded from the wrapper");

    // Re-committing the current value is a no-op.
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(
      window.undoDepth(),
      0,
      "a commit that changes nothing must not push a record",
    );
  });
});
