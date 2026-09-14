/**
 * Adversarial CAPTURE TIMING — one case per gesture path that can settle mid-gesture
 * (track `refactor_surface_20260911`, Phase 1; AC-1, AC-2b, AC-7).
 *
 * WHAT "ADVERSARIAL" MEANS HERE, MEASURED RATHER THAN ASSERTED. `scanLayout` awaits a
 * storage round-trip mid-scan (`js/layout_scan.js:112-113`) and only THEN walks the DOM,
 * so a capture STARTED before a mutation can finish its DOM reads AFTER it. Phase 0 proved
 * the mechanism directly (a synchronous write inside that window changes the recorded
 * value: control `0` -> treatment `90`, `phase0_reverification.md` §F-1). This file drives
 * the same window through the real protocols:
 *
 *   §1 the SHARED protocol (`beginMutation`/`pushMutation`), one case per class. Each case
 *      carries a VACUITY GUARD that fails unless the capture really settled after the
 *      mutation wrote — the settled snapshot itself is asserted to hold the POST value, so
 *      a case that stops being adversarial cannot keep passing. These are the cases that
 *      go red against an unrepaired settled branch (F-9) and green once it repairs.
 *   §2 the GESTURE paths that already repair — resize, nudge, drag — driven as real
 *      gestures with the storage await held open across the mutation. They had no such
 *      case before this file, so their repair was assumed; now it is executed.
 *   §3 the ROTATE gesture, which is the same real-gesture case for the path that used to
 *      carry the defect. It was written in Phase 1 as a probe and stayed RED there by
 *      design (AC-2b forbids routing a call site before the helper is fixed), so it could
 *      not be committed to a green suite; Phase 2 routes the site onto the shared protocol
 *      and this section is the case that flips.
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

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
/** `n` macrotask turns — enough for a capture whose storage hop is held open. */
async function tick(n) {
  for (let i = 0; i < n; i++) await sleep(0);
}

/** The drag engine's listener host. */
function layoutRoot(window) {
  return window.DomManager.getInstance().getLayoutRoot().element;
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

/** See `test/unit/undo_stack_phase2a.test.js`: jsdom has no PointerEvent. */
function pointer(window, type, target, x, y) {
  const e = mouse(window, type, target, x, y);
  Object.defineProperty(e, "pointerId", { value: 1, enumerable: true });
  Object.defineProperty(e, "pointerType", { value: "mouse", enumerable: true });
  Object.defineProperty(e, "button", { value: 0, enumerable: true });
  return e;
}

/**
 * Hold `scanLayout`'s storage await open for `hops` macrotask turns.
 *
 * This is what makes the window REAL rather than theoretical: a synchronous write in the
 * same turn as `beginMutation` is guaranteed to land before the scan's DOM reads, instead
 * of racing a fake-indexeddb round-trip that usually resolves within one microtask.
 */
function holdStorageOpen(window, hops = 3) {
  const real = window.__DDBStorage.getAllSpells;
  window.__DDBStorage.getAllSpells = function () {
    const self = this;
    return new Promise((resolve, reject) => {
      let n = 0;
      const step = () => {
        if (n++ < hops) {
          setTimeout(step, 0);
          return;
        }
        real.call(self).then(resolve, reject);
      };
      setTimeout(step, 0);
    });
  };
  return () => {
    window.__DDBStorage.getAllSpells = real;
  };
}

/**
 * Read the live DOM at the moment a capture RESOLVES — the timing witness for §2, where the
 * mutation is the product's own and cannot be inspected from the pushed record (which the
 * repair has already corrected).
 *
 * It wraps `window.scanLayout`, NOT `window.captureLiveLayout`, and that is a Phase 2 change
 * with a reason: once the sites were routed onto `beginMutation`, the capture is started by the
 * module-internal `captureLiveLayout` in `js/persistence.js` — which calls `window.scanLayout()`
 * — so wrapping the public capture entry point would witness NOTHING (measured: the §2 cases
 * went red with `settlements === 0` the moment the routing landed). `scanLayout` is the seam
 * every route goes through, so the witness survives the refactor it is watching.
 */
function watchCaptureSettlement(window, read) {
  const real = window.scanLayout;
  const seen = { settlements: 0, atSettlement: null };
  window.scanLayout = function () {
    return real.apply(this, arguments).then((layout) => {
      seen.settlements += 1;
      seen.atSettlement = read();
      return layout;
    });
  };
  return {
    seen,
    restore: () => {
      window.scanLayout = real;
    },
  };
}

/** The `layout.shapes` entry for `id` (the post-await scan is the one that sees shapes). */
function capturedShape(layout, id) {
  return (layout.shapes || []).find((s) => s.id === id);
}

/**
 * The PATH-COVERAGE guard the Phase 1 GATE 3 review required (§5 of
 * `phase1_execution_review.md`): a timing guard alone cannot stop a future edit that keeps the
 * assertion green while moving the record onto a DIFFERENT code path, so every §1 case also
 * proves which branch ran — the repair is invoked exactly once, with the SETTLED snapshot by
 * identity, and `pushUndo` receives that same object (not `snap`, not a copy).
 */
function watchProtocol(window) {
  const realPush = window.pushUndo;
  const seen = { pushes: [], repairs: [] };
  window.pushUndo = function (before, label, klass) {
    seen.pushes.push({ before, label, klass });
    return realPush.call(this, before, label, klass);
  };
  return {
    seen,
    repair:
      (inner) =>
      (layout, snap) => {
        seen.repairs.push({ layout, snap });
        return inner(layout, snap);
      },
    restore: () => {
      window.pushUndo = realPush;
    },
  };
}

/** Push, then assert the SETTLED branch is the branch that ran. Returns the pushed entry. */
function pushAssertingSettledPath(window, mut, snap, label, klass, inner) {
  const watch = watchProtocol(window);
  try {
    window.pushMutation(mut, label, klass, watch.repair(inner));
    assert.strictEqual(
      watch.seen.repairs.length,
      1,
      "PATH GUARD: the settled branch ran the repair exactly once",
    );
    assert.strictEqual(
      watch.seen.repairs[0].layout,
      mut.settled,
      "PATH GUARD: the repair received the SETTLED snapshot (identity, not a copy)",
    );
    assert.strictEqual(
      watch.seen.repairs[0].snap,
      snap,
      "PATH GUARD: ...and the caller's synchronous snapshot",
    );
    assert.strictEqual(watch.seen.pushes.length, 1, "PATH GUARD: exactly one record was pushed");
    assert.strictEqual(
      watch.seen.pushes[0].before,
      mut.settled,
      "PATH GUARD: pushUndo received the SETTLED snapshot itself — if a future edit pushes " +
        "`snap` (or a copy) instead, the record stops being the capture and this fails",
    );
    return watch.seen.pushes[0];
  } finally {
    watch.restore();
  }
}

describe("Phase 1 §1 — the SHARED protocol repairs a capture that settled after the mutation", function () {
  this.timeout(20000);
  let window, document, cleanup, release;

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
    if (release) release();
    if (cleanup) cleanup();
  });

  it("rotate class: the settled capture holds the POST angle, and the repair puts the PRE angle back", async function () {
    const shape = window.createShape("assets/ornament.webp");
    const container = shape.querySelector(".print-section-container");
    assert.strictEqual(shape.dataset.rotation || "0", "0", "the shape starts unrotated");

    release = holdStorageOpen(window, 3);
    const snap = { rotation: "0" };
    const mut = window.beginMutation(snap);
    // Exactly what `applyRotation` does, synchronously, inside the capture's await.
    shape.dataset.rotation = "135";
    container.style.transform = "rotate(135deg)";

    await waitFor(() => mut.settled !== undefined, { timeout: 2000 });
    assert.ok(mut.settled, "the capture settled");
    const captured = capturedShape(mut.settled, container.id);
    assert.ok(captured, "the settled capture carries the shape");
    assert.strictEqual(
      captured.rotation,
      "135",
      "VACUITY GUARD: the capture's DOM reads landed AFTER the write, so pushing this raw " +
        "records the POST-gesture angle — which is exactly what F-1 reported",
    );

    pushAssertingSettledPath(
      window,
      mut,
      snap,
      'Rotate "' + container.id + '"',
      "rotate",
      (layout, s) => {
        window.patchCapturedFields(layout, container.id, { rotation: String(s.rotation) });
      },
    );

    const entry = window.peekUndo();
    assert.ok(entry, "a record was pushed");
    assert.strictEqual(entry.class, "rotate", "tagged as the rotate class");
    assert.strictEqual(
      capturedShape(entry.before, container.id).rotation,
      "0",
      "the RECORD holds the PRE-gesture angle — an inverse through a post-gesture record " +
        "re-applies the angle the user is undoing",
    );
  });

  it("resize class: the settled capture holds the POST geometry, and the repair puts the PRE geometry back", async function () {
    const section = document.getElementById("section-main");
    const pre = window.snapshotContainerGeometry(section);
    assert.strictEqual(pre.width, "200px", "the fixture's pre-resize width");

    release = holdStorageOpen(window, 3);
    const mut = window.beginMutation(pre);
    section.style.width = "320px"; // the gesture's write, inside the capture's await

    await waitFor(() => mut.settled !== undefined, { timeout: 2000 });
    assert.ok(mut.settled, "the capture settled");
    assert.strictEqual(
      mut.settled.sections["section-main"].width,
      "320px",
      "VACUITY GUARD: the settled capture holds the POST-resize width",
    );

    pushAssertingSettledPath(window, mut, pre, 'Resize "section-main"', "resize", (layout, s) => {
      window.patchCapturedFields(layout, "section-main", {
        width: s.width,
        height: s.height,
        innerWidths: s.innerWidths,
        zIndex: s.zIndex,
        printZIndex: s.printZIndex,
      });
    });

    const entry = window.peekUndo();
    assert.ok(entry, "a record was pushed");
    assert.strictEqual(entry.class, "resize", "tagged as the resize class");
    assert.strictEqual(
      entry.before.sections["section-main"].width,
      "200px",
      "the RECORD holds the PRE-resize width",
    );
  });

  it("position class (nudge): the settled capture holds the POST position, and the repair puts the PRE position back", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");

    release = holdStorageOpen(window, 3);
    const snap = { left: "10px", top: "20px", zIndex: wrapper.style.zIndex };
    const mut = window.beginMutation(snap);
    wrapper.style.setProperty("left", "999px", "important");

    await waitFor(() => mut.settled !== undefined, { timeout: 2000 });
    assert.ok(mut.settled, "the capture settled");
    assert.strictEqual(
      mut.settled.sections["section-main"].left,
      "999px",
      "VACUITY GUARD: the settled capture holds the POST-nudge left",
    );

    pushAssertingSettledPath(window, mut, snap, "Nudge Main", "nudge", (layout, s) => {
      window.patchCapturedFields(layout, "section-main", { left: s.left, top: s.top });
    });

    const entry = window.peekUndo();
    assert.ok(entry, "a record was pushed");
    assert.strictEqual(entry.class, "nudge", "tagged as the nudge class");
    assert.strictEqual(
      entry.before.sections["section-main"].left,
      "10px",
      "the RECORD holds the PRE-nudge left",
    );
  });

  it("drag class: the settled capture holds the POST position AND the raised stacking, and the repair puts both back", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");

    release = holdStorageOpen(window, 3);
    const snap = { left: "10px", top: "20px", zIndex: wrapper.style.zIndex };
    const mut = window.beginMutation(snap);
    // Both writes a drag performs inside the window: the drop, and the click-to-front
    // stacking raise the product's own mousedown handler performs (measured in a browser).
    wrapper.style.setProperty("left", "60px", "important");
    wrapper.style.zIndex = "700001";

    await waitFor(() => mut.settled !== undefined, { timeout: 2000 });
    assert.ok(mut.settled, "the capture settled");
    const captured = mut.settled.sections["section-main"];
    assert.strictEqual(captured.left, "60px", "VACUITY GUARD: the settled capture holds the POST-drop left");
    assert.strictEqual(captured.zIndex, "700001", "VACUITY GUARD: and the RAISED stacking");

    pushAssertingSettledPath(window, mut, snap, "Move Main", "drag", (layout, s) => {
      window.patchCapturedFields(layout, "section-main", {
        left: s.left,
        top: s.top,
        zIndex: s.zIndex,
      });
    });

    const entry = window.peekUndo();
    assert.ok(entry, "a record was pushed");
    assert.strictEqual(entry.class, "drag", "tagged as the drag class");
    const record = entry.before.sections["section-main"];
    assert.strictEqual(record.left, "10px", "the RECORD holds the PRE-drop left");
    assert.strictEqual(record.zIndex, snap.zIndex, "and the PRE-gesture stacking");
  });
});

describe("Phase 1 §2 — the GESTURE paths that already repair, driven with the capture window OPEN", function () {
  this.timeout(20000);
  let window, document, cleanup, restoreStorage, restoreCapture;

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
    if (restoreStorage) restoreStorage();
    if (restoreCapture) restoreCapture();
    if (cleanup) cleanup();
  });

  it("resize: a capture that settled MID-GESTURE still records the PRE-resize geometry, and the undo returns exactly", async function () {
    if (typeof window.initResizeLogic === "function") window.initResizeLogic();
    const section = document.getElementById("section-main");
    const handle = section.querySelector(".print-section-resize-handle");
    assert.ok(handle, "the resize handle exists (initResizeLogic ran)");
    const before = await state(window);
    const preWidth = section.style.width;

    restoreStorage = holdStorageOpen(window, 3);
    const watch = watchCaptureSettlement(window, () => section.style.width);
    restoreCapture = watch.restore;

    handle.dispatchEvent(mouse(window, "mousedown", handle, 100, 100));
    document.documentElement.dispatchEvent(mouse(window, "mousemove", handle, 180, 140));
    await tick(6); // the capture settles — AFTER doResize wrote
    assert.strictEqual(watch.seen.settlements, 1, "the capture settled exactly once");
    assert.notStrictEqual(
      watch.seen.atSettlement,
      preWidth,
      "VACUITY GUARD: the capture resolved while the DOM already held the NEW width, so this " +
        "case really does exercise the mid-gesture settlement",
    );

    document.documentElement.dispatchEvent(mouse(window, "mouseup", handle, 180, 140));
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(window.undoDepth(), 1, "one record for one gesture");
    assert.strictEqual(window.peekUndo().class, "resize", "tagged as the resize class");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-resize layout");
  });

  it("nudge: a stacking raise that lands INSIDE the capture window is repaired away", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.classList.add("be-active-wrapper");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");
    const before = await state(window);
    const preZ = wrapper.style.zIndex;

    restoreStorage = holdStorageOpen(window, 3);
    const watch = watchCaptureSettlement(window, () => wrapper.style.zIndex);
    restoreCapture = watch.restore;

    const nudged = window.nudgeActiveWrapper(4, 0);
    wrapper.style.zIndex = "700001"; // the click-to-front raise, inside the window
    assert.strictEqual(await nudged, true, "the nudge moved the wrapper");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(
      watch.seen.atSettlement,
      "700001",
      "VACUITY GUARD: the capture's own read saw the RAISED stacking",
    );
    const entry = window.peekUndo();
    assert.strictEqual(entry.class, "nudge", "tagged as the nudge class");
    assert.strictEqual(
      entry.before.sections["section-main"].zIndex,
      preZ,
      "the RECORD carries the PRE-nudge stacking (the fixture's own value) rather than the " +
        "raised one the capture read",
    );

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-nudge layout");
  });

  it("drag: a capture that settled after the drop still records the PRE-drag position and stacking", async function () {
    const wrapper = document.getElementById("wrapper-main");
    wrapper.style.setProperty("left", "10px", "important");
    wrapper.style.setProperty("top", "20px", "important");
    window.initDragAndDrop();
    const before = await state(window);
    const root = layoutRoot(window);

    restoreStorage = holdStorageOpen(window, 3);
    const watch = watchCaptureSettlement(window, () => wrapper.style.left);
    restoreCapture = watch.restore;

    root.dispatchEvent(pointer(window, "pointerdown", wrapper, 10, 10));
    wrapper.style.zIndex = "700001"; // the click-to-front raise, inside the window
    root.dispatchEvent(pointer(window, "pointermove", wrapper, 60, 60));
    // The RELEASE is dispatched while the capture is still in flight, so `finalizeDrop`
    // writes the new position BEFORE the scan's DOM reads land — the engine then awaits the
    // capture and pushes the repaired record.
    root.dispatchEvent(pointer(window, "pointerup", wrapper, 60, 60));
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(watch.seen.settlements, 1, "the capture settled exactly once");
    assert.notStrictEqual(
      watch.seen.atSettlement,
      "10px",
      "VACUITY GUARD: the capture resolved after `finalizeDrop` wrote the dropped left, so " +
        "the record it holds is the POST-drop one unless the repair puts the pre value back",
    );

    assert.strictEqual(window.undoDepth(), 1, "one record for one gesture");
    const entry = window.peekUndo();
    assert.strictEqual(entry.class, "drag", "tagged as the drag class");
    assert.strictEqual(
      entry.before.sections["section-main"].left,
      "10px",
      "the RECORD holds the PRE-drag left",
    );

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-drag layout");
  });
});

describe("Phase 2 §3 — the ROUTED rotate gesture (AC-1's rotate arm)", function () {
  this.timeout(20000);
  let window, document, cleanup, restoreStorage, restoreCapture;

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
    if (restoreStorage) restoreStorage();
    if (restoreCapture) restoreCapture();
    if (cleanup) cleanup();
  });

  it("the real rotate gesture keeps the PRE-gesture angle when its capture settled mid-gesture", async function () {
    // This is the case that was RED in Phase 1 and is green only because the site now goes
    // through the shared protocol, whose settled branch repairs (Phase 1's fix). It is the
    // ONLY committed evidence for AC-1's rotate arm: the §1 rotate case proves the shared
    // path, this one proves the SITE uses it.
    const shape = window.createShape("assets/ornament.webp");
    const container = shape.querySelector(".print-section-container");
    shape.dispatchEvent(new window.CustomEvent("be-rotate-click", { bubbles: true }));
    const handle = shape.querySelector(".be-rotation-handle");
    assert.ok(handle, "the rotation handle exists after the toggle");
    await tick(4);
    window.clearUndoStack();

    const beforeAngle = shape.dataset.rotation || "0";
    assert.strictEqual(beforeAngle, "0", "the shape starts unrotated");

    // PATH GUARD for this site too: the record must come out of the SHARED pair, so the seam
    // has to be the call-time `window.*` lookup the routing introduced. Capturing it here would
    // be circular, so instead the pair is WRAPPED: if the site still hand-rolled its own dance
    // (Phase 1's shape), neither counter would move and this fails before the record assertions.
    const realBegin = window.beginMutation;
    const realPush = window.pushMutation;
    let began = 0;
    let pushed = 0;
    window.beginMutation = function () {
      began += 1;
      return realBegin.apply(this, arguments);
    };
    window.pushMutation = function () {
      pushed += 1;
      return realPush.apply(this, arguments);
    };

    restoreStorage = holdStorageOpen(window, 3);
    const watch = watchCaptureSettlement(window, () => shape.dataset.rotation);
    restoreCapture = watch.restore;

    try {
      handle.dispatchEvent(mouse(window, "mousedown", handle, 200, 100));
      // The gesture's write, while the capture's storage await is still open.
      document.dispatchEvent(mouse(window, "mousemove", handle, 100, 300));
      const movedAngle = shape.dataset.rotation;
      assert.notStrictEqual(movedAngle, beforeAngle, "the drag moved the angle");

      // The capture settles (its DOM reads land AFTER the write above) before the release:
      // the timing the old inline `rotateCaptured` branch was built for, and the timing at
      // which it pushed the POST angle raw.
      await tick(8);
      document.dispatchEvent(mouse(window, "mouseup", handle, 100, 300));
      await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    } finally {
      window.beginMutation = realBegin;
      window.pushMutation = realPush;
    }

    assert.strictEqual(began, 1, "PATH GUARD: the site started its record via the SHARED begin");
    assert.strictEqual(pushed, 1, "PATH GUARD: ...and pushed it via the SHARED push");
    assert.strictEqual(watch.seen.settlements, 1, "the capture settled exactly once");
    assert.notStrictEqual(
      watch.seen.atSettlement,
      beforeAngle,
      "VACUITY GUARD: the capture resolved while the DOM already held the NEW angle",
    );
    assert.strictEqual(window.undoDepth(), 1, "one record for the gesture");
    const entry = window.peekUndo();
    assert.strictEqual(entry.class, "rotate", "tagged as the rotate class");
    const recorded = (entry.before.shapes || []).find((s) => s.id === container.id);
    assert.ok(recorded, "the record carries the shape");
    assert.strictEqual(
      recorded.rotation,
      beforeAngle,
      "the RECORD holds the PRE-gesture angle — this is F-1's defect, and the assertion " +
        "that was RED before Phase 2 routed the site",
    );

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    const live = document.getElementById(container.id);
    const liveWrapper = live.closest(".be-shape-wrapper") || live;
    assert.strictEqual(
      liveWrapper.dataset.rotation || "0",
      beforeAngle,
      "and the angle is back on the LIVE node",
    );
  });
});
