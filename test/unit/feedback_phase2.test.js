/**
 * Phase 2 of track feedback_lifecycle_a11y_20260910:
 *   AC-5 (U-17) empty states PERSIST (a dialog, not an expiring toast).
 *   AC-6 (U-27) the layer context menu is keyboard-operable, ARIA-complete,
 *               restores focus and is clamped inside the viewport.
 *   AC-7 (U-16) a rename that changes nothing says so.
 *
 * THE NEGATIVE / BEHAVIOURAL ASSERTIONS HERE WERE FALSIFIED BEFORE BEING TRUSTED
 * (track working note 6): breaking one keyboard binding made the walk fail, and
 * removing the clamp made the corner case fail. The runs are recorded in the
 * Phase 2 commit message.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const read = (f) => fs.readFileSync(path.resolve(__dirname, "../../js", f), "utf8");

/* ------------------------------------------------------------------ *
 * AC-6 / AC-7 — the layer context menu and rename, against a LIVE DOM.
 * ------------------------------------------------------------------ */

function bootLayers({ width = 1440, height = 900 } = {}) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
      '<div id="print-enhance-layer-manager"></div>' +
      '<div id="print-enhance-shapes-layer"></div>' +
      '<div id="print-enhance-sections-layer"></div>' +
      // A real shape target: the menu builds its shape branch (and therefore
      // several items) only when the target exists AND carries the shape class.
      '<div id="shape-1" class="be-shape-wrapper"></div>' +
      "</body></html>",
    { pretendToBeVisual: true },
  );
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.HTMLElement = w.HTMLElement;
  global.NodeList = w.NodeList;
  // jsdom has no layout, so innerWidth/innerHeight default to 1024x768; pin them
  // so the clamp geometry is deterministic and matches the capture viewport.
  Object.defineProperty(w, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(w, "innerHeight", { value: height, configurable: true });
  w.DomManager = {
    getInstance: () => ({
      getLayoutRoot: () => ({ element: w.document.body }),
      getShapesContainer: () => ({ element: w.document.body }),
    }),
  };
  w.updatePrintStyles = () => {};
  w.safeLog = () => {};
  const toasts = [];
  w.showFeedback = (msg, type) => toasts.push({ msg, type: type || "info" });
  const LayerManager = require("../../js/dom/layer_manager.js");
  return { w, LayerManager, toasts };
}

function teardownLayers() {
  delete global.document;
  delete global.window;
  delete global.HTMLElement;
  delete global.NodeList;
  delete require.cache[require.resolve("../../js/dom/layer_manager.js")];
}

/**
 * Give jsdom the geometry the clamp needs. jsdom reports every rect as 0x0, so a
 * clamp test would pass vacuously without this: the menu would "fit" trivially.
 * Each menu gets the height implied by its item count.
 */
function stubMenuGeometry(w, { width = 180, itemHeight = 26 } = {}) {
  const proto = w.Element.prototype;
  proto.getBoundingClientRect = function () {
    const items = this.querySelectorAll
      ? this.querySelectorAll('[role="menuitem"]').length
      : 0;
    const isMenu = this.id === "print-enhance-context-menu";
    const h = isMenu ? Math.max(40, items * itemHeight + 8) : 24;
    const wd = isMenu ? width : 120;
    const left = parseFloat(this.style.left) || 0;
    const top = parseFloat(this.style.top) || 0;
    return {
      x: left,
      y: top,
      left,
      top,
      width: wd,
      height: h,
      right: left + wd,
      bottom: top + h,
    };
  };
  return { width, itemHeight };
}

describe("AC-6 — the layer context menu is keyboard-operable and ARIA-complete (U-27)", function () {
  afterEach(teardownLayers);

  const items = (w) =>
    Array.from(w.document.querySelectorAll('#print-enhance-context-menu [role="menuitem"]'));

  function openMenu(w, LayerManager, x = 100, y = 100) {
    const lm = new LayerManager();
    lm.createContextMenu(x, y, "shape-1");
    return lm;
  }

  it("is a role=menu of role=menuitem children, and opening moves focus into it", function () {
    const { w, LayerManager } = bootLayers();
    stubMenuGeometry(w);
    openMenu(w, LayerManager);

    const menu = w.document.getElementById("print-enhance-context-menu");
    assert.ok(menu, "the menu opened");
    assert.strictEqual(menu.getAttribute("role"), "menu", "role=menu");
    assert.ok(menu.getAttribute("aria-label"), "the menu is labelled");

    const list = items(w);
    assert.ok(list.length >= 2, "the menu has items: " + list.length);
    for (const it of list) {
      assert.strictEqual(it.getAttribute("role"), "menuitem", "each child is a menuitem");
    }
    // Roving tabindex: exactly ONE item is in the tab order at a time (the focused
    // one); the rest are programmatically focusable only.
    const tabbable = list.filter((it) => it.getAttribute("tabindex") === "0");
    assert.strictEqual(tabbable.length, 1, "exactly one item is tabbable (roving)");
    assert.strictEqual(tabbable[0], list[0], "the tabbable item is the focused first item");
    for (const it of list.slice(1)) {
      assert.strictEqual(it.getAttribute("tabindex"), "-1", "others are out of tab order");
    }
    // Opening focus: the FIRST item is focused, so the arrows work immediately.
    assert.strictEqual(
      w.document.activeElement,
      list[0],
      "focus moved to the first item on open",
    );
  });

  it("walks with ArrowDown/ArrowUp (wrapping), Home and End", function () {
    const { w, LayerManager } = bootLayers();
    stubMenuGeometry(w);
    openMenu(w, LayerManager);
    const menu = w.document.getElementById("print-enhance-context-menu");
    const list = items(w);
    const idx = () => list.indexOf(w.document.activeElement);
    const key = (k) =>
      menu.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
      );

    assert.strictEqual(idx(), 0, "entry focus is the first item");
    key("ArrowDown");
    assert.strictEqual(idx(), 1, "ArrowDown moves to the next item");
    key("End");
    assert.strictEqual(idx(), list.length - 1, "End jumps to the last item");
    key("ArrowDown");
    assert.strictEqual(idx(), 0, "ArrowDown from the last item WRAPS to the first");
    key("ArrowUp");
    assert.strictEqual(idx(), list.length - 1, "ArrowUp from the first WRAPS to the last");
    key("Home");
    assert.strictEqual(idx(), 0, "Home jumps back to the first item");
  });

  it("activates the focused item with Enter, and closes", function () {
    const { w, LayerManager } = bootLayers();
    stubMenuGeometry(w);
    const lm = openMenu(w, LayerManager);
    const menu = w.document.getElementById("print-enhance-context-menu");

    // The last item is the destructive one; pressing Enter must reach ITS action,
    // not just any action. Spy on the click path.
    let clicked = null;
    items(w).forEach((it) => {
      const original = it.onclick;
      it.onclick = (e) => {
        clicked = it.textContent;
        if (original) original.call(it, e);
      };
    });
    const list = items(w);
    list[list.length - 1].focus();
    menu.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );

    assert.strictEqual(clicked, list[list.length - 1].textContent, "Enter activated the focused item");
    assert.strictEqual(
      w.document.getElementById("print-enhance-context-menu"),
      null,
      "activating an item closed the menu",
    );
    assert.strictEqual(lm.contextMenu, null);
  });

  it("Escape closes and returns focus to the invoking control", function () {
    const { w, LayerManager } = bootLayers();
    stubMenuGeometry(w);
    // A real invoking control: the row that was right-clicked.
    const invoker = w.document.createElement("button");
    invoker.textContent = "row";
    w.document.body.appendChild(invoker);
    invoker.focus();

    const lm = new LayerManager();
    lm._lastRowInvoker = invoker;
    lm.createContextMenu(100, 100, "shape-1");
    const menu = w.document.getElementById("print-enhance-context-menu");
    assert.ok(menu, "menu open");
    // Focus is INSIDE the menu while it is open...
    assert.ok(menu.contains(w.document.activeElement), "focus is inside the menu");

    menu.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    assert.strictEqual(
      w.document.getElementById("print-enhance-context-menu"),
      null,
      "Escape closed the menu",
    );
    assert.strictEqual(
      w.document.activeElement,
      invoker,
      "Escape handed focus back to the invoking control (not <body>)",
    );
  });

  it("clamps the menu inside the viewport at EVERY edge and corner", function () {
    const cases = [
      ["top-left", 0, 0],
      ["top-right", 1439, 0],
      ["bottom-left", 0, 899],
      ["bottom-right", 1439, 899],
      ["mid-right", 1439, 450],
      ["mid-bottom", 720, 899],
    ];
    for (const [name, x, y] of cases) {
      const { w, LayerManager } = bootLayers({ width: 1440, height: 900 });
      stubMenuGeometry(w);
      openMenu(w, LayerManager, x, y);
      const menu = w.document.getElementById("print-enhance-context-menu");
      const r = menu.getBoundingClientRect();
      assert.ok(r.left >= 0, `${name}: left inside the viewport (${r.left})`);
      assert.ok(r.top >= 0, `${name}: top inside the viewport (${r.top})`);
      assert.ok(
        r.right <= w.innerWidth,
        `${name}: right edge inside the viewport (right ${r.right} > ${w.innerWidth})`,
      );
      assert.ok(
        r.bottom <= w.innerHeight,
        `${name}: bottom edge inside the viewport (bottom ${r.bottom} > ${w.innerHeight})`,
      );
      teardownLayers();
    }
  });

  it("leaves the locked quiet ornament treatment alone (no ornament added to the menu)", function () {
    const { w, LayerManager } = bootLayers();
    stubMenuGeometry(w);
    openMenu(w, LayerManager);
    const menu = w.document.getElementById("print-enhance-context-menu");
    // The menu's own classes are the locked ones; no ornament class was added.
    assert.ok(/be-context-menu/.test(menu.className));
    assert.ok(/be-floating-ui/.test(menu.className));
    assert.ok(!/be-ornament|be-blind-tool|be-corner/.test(menu.className), menu.className);
  });
});

describe("AC-7 — a rename that changes nothing explains itself (U-16)", function () {
  afterEach(teardownLayers);

  it("submitting the SAME name reports that no change was made", async function () {
    const { w, LayerManager, toasts } = bootLayers();
    const lm = new LayerManager();
    const layer = { id: "l1", label: "Background" };
    lm.rebuildPanel = () => {};
    // The input modal resolves with the UNCHANGED name.
    w.showInputModal = async () => "Background";

    await lm.showRenameModal(layer);

    assert.strictEqual(layer.label, "Background", "the label is unchanged");
    const said = toasts.map((t) => t.msg).join(" | ");
    assert.match(
      said,
      /already the layer's name|no change/i,
      "the no-op is reported instead of closing in silence: " + said,
    );
  });

  it("still reports a REAL rename, and says nothing on an empty submission", async function () {
    const { w, LayerManager, toasts } = bootLayers();
    const lm = new LayerManager();
    lm.rebuildPanel = () => {};
    const layer = { id: "l1", label: "Background" };

    w.showInputModal = async () => "Scenery";
    await lm.showRenameModal(layer);
    assert.strictEqual(layer.label, "Scenery", "the rename applied");
    assert.match(toasts.map((t) => t.msg).join(" | "), /renamed to "Scenery"/);

    toasts.length = 0;
    layer.label = "Scenery";
    w.showInputModal = async () => "   "; // whitespace only
    await lm.showRenameModal(layer);
    assert.strictEqual(layer.label, "Scenery", "an empty submission changes nothing");
    assert.deepStrictEqual(
      toasts,
      [],
      "an empty submission is the input modal's validation to report (U-21), not this path's",
    );
  });
});

/* ------------------------------------------------------------------ *
 * AC-5 — the persistent empty-state dialog.
 * ------------------------------------------------------------------ */

describe("AC-5 — empty states persist instead of expiring (U-17)", function () {
  // The persistence case deliberately waits out the old 3s dwell.
  this.timeout(15000);

  function bootModals() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.HTMLElement = w.HTMLElement;
    global.Node = w.Node;
    w.__DDB_TEST_MODE__ = true;
    w.safeLog = () => {};
    w.eval(read("modals.js"));
    return w;
  }

  const dialog = (w) =>
    w.document.querySelector(".be-modal-overlay .be-modal") ||
    w.document.getElementById("print-enhance-overlay");

  it("shows a persistent dialog carrying the message AND a next-step hint", async function () {
    const w = bootModals();
    const p = w.Modals.showEmptyStateDialog({
      title: "No clones found",
      message: "This sheet has no clones to manage yet.",
      hint: "Clone a section first.",
    });
    const el = dialog(w);
    assert.ok(el, "a dialog opened");
    assert.strictEqual(el.getAttribute("role"), "dialog", "role=dialog via the primitive");
    assert.ok(el.querySelector(".be-modal-close"), "the primitive's close ✕ is present");
    const text = el.textContent;
    assert.match(text, /No clones found/, "the title");
    assert.match(text, /no clones to manage yet/, "the message");
    assert.match(text, /Clone a section first/, "the NEXT-STEP hint");

    // Dismiss and confirm the promise settles.
    el.querySelector(".be-modal-ok").click();
    await p;
    assert.strictEqual(dialog(w), null, "dismissing removes it");
  });

  it("persists well past the toast dwell it replaced (the actual defect)", async function () {
    const w = bootModals();
    w.Modals.showEmptyStateDialog({ title: "No available targets found", message: "…" });
    assert.ok(dialog(w), "present when opened");
    // The old behaviour was a 3000ms toast. Wait past it and past the 500ms
    // fade it used, then assert the dialog is STILL there.
    await new Promise((r) => setTimeout(r, 3700));
    assert.ok(
      dialog(w),
      "an empty state must outlive the 3s toast dwell — expiring was the whole defect",
    );
    assert.strictEqual(
      w.document.querySelectorAll(".be-feedback").length,
      0,
      "and it is a dialog, not a toast that happens to still be on screen",
    );
  });

  it("never silently does nothing when the seam is missing (main.js fallback)", function () {
    // AC-5's three call sites route through main.js's emptyState(); with no modal
    // seam it must fall back to a toast rather than to silence. Asserted at source
    // level because booting main.js for real is the encapsulation harness's job.
    const main = read("main.js");
    const fallback = main.slice(main.indexOf("function emptyState("));
    assert.match(
      fallback.slice(0, 900),
      /showFeedback\(/,
      "the fallback path still reports something",
    );
    for (const call of ["No clones found", "No available targets found", "No compact-compatible sections found"]) {
      assert.ok(main.includes(`emptyState("${call}"`), `${call} goes through the dialog seam`);
      assert.ok(
        !main.includes(`showFeedback("${call}")`),
        `${call} must no longer be a bare expiring toast`,
      );
    }
  });
});
