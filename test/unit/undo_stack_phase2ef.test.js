/**
 * Phase 2e + 2f — compact, border/style, and the structural family.
 * Track undo_stack_20260911.
 *
 * NOT covered here, and deliberately: FILTER / HUE. Measured during 2e — filters are
 * `documentElement` CSS variables set by `applyGlobalFilters` and are NOT part of
 * `scanLayout`'s output at all (they are not persisted with the layout either), so by the
 * contract's own definition (`contract.md` §0.1: a mutation is anything that changes what
 * scanLayout would return) a filter change is not a layout mutation. The uniform inverse
 * cannot restore it, and claiming otherwise would be false. Recorded in `contract.md` §4.
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

async function state(window) {
  return JSON.stringify(await window.scanLayout());
}

describe("Phase 2e — compact mode (AC-3)", function () {
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

  it("the in-sheet compact button is reversible, and the record is taken BEFORE the toggle", async function () {
    const section = document.getElementById("section-main");
    // The button lives in the section's ACTION container, which is not necessarily a child
    // of the section element itself — so it is looked up document-wide.
    const btn = document.querySelector(".be-compact-button");
    assert.ok(btn, "the compact button was injected");

    const before = await state(window);
    btn.click();
    // SYNCHRONOUS assertion right after the click: this is exactly why the compact sites
    // use the non-deferring capture pair instead of awaiting the scan first.
    assert.ok(
      section.classList.contains("be-compact-mode"),
      "the toggle applied synchronously — a deferred mutation would break this",
    );
    const after = await state(window);
    assert.notStrictEqual(after, before, "the toggle must CHANGE the persisted state");
    assert.ok(/"compact":true/.test(after), "the flag is in the record");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual(window.peekUndo().class, "compact", "tagged as the compact class");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-toggle layout");
    assert.ok(
      !document.getElementById("section-main").classList.contains("be-compact-mode"),
      "the class is gone on the live node too",
    );
  });
});

describe("Phase 2e — border style (AC-3)", function () {
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

  it("a border change is reversible, asserting the OLD class is BACK (not just that the new one is gone)", async function () {
    const section = document.getElementById("section-main");
    const styles = window.AssetCatalog.ALL_BORDER_STYLES || [];
    const next = styles.find((s) => s !== "no-border" && s !== "default-border") || styles[1];
    assert.ok(next, "the catalog offers a border style");

    const before = await state(window);
    // The record is taken by the same path the in-sheet button uses.
    const mut = window.beginMutation(window.snapshotSectionFlags());
    window.Filters.applyBorderStyle(section, next);
    window.pushMutation(mut, "Change border", "border",
      (layout, snap) => window.repairSectionFlags(layout, snap));

    const after = await state(window);
    assert.notStrictEqual(after, before, "the border change must CHANGE the persisted state");
    assert.ok(section.classList.contains(next), "the style applied");

    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-change layout");
    assert.ok(
      !document.getElementById("section-main").classList.contains(next),
      "the new class is gone",
    );
    assert.strictEqual(
      (await window.scanLayout()).sections["section-main"].borderStyle,
      (JSON.parse(before).sections["section-main"] || {}).borderStyle,
      "and the RECORDED border style is back to what it was",
    );
  });
});

describe("Phase 2e — the border BUTTON path pushes a record (the browser pass's finding)", function () {
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

  it("drives the real border control and asserts a record reaches the stack", async function () {
    // WHY THIS CASE EXISTS: the record-pushing code in the border handler referred to a
    // variable that was NOT in scope there, so it threw a ReferenceError AFTER applying the
    // border and BEFORE pushing — and `addRobustButton` swallows callback errors, so the
    // user got a border change with no undo and no visible error. The other border tests
    // assert the CLASS, which the apply had already set, so they stayed green. This one
    // asserts the STACK, which is what the undo contract actually depends on. The
    // real-browser per-class verification is what found it.
    // The action container (and therefore the border control) is a sibling of the section
    // inside the WRAPPER, not a descendant of the section — `section.querySelector` finds
    // nothing here.
    const wrapper = document.getElementById("wrapper-main");
    const btn = wrapper.querySelector(".be-border-button");
    assert.ok(btn, "the border control exists");

    const before = await state(window);
    btn.click();
    const modal = document.querySelector(".be-modal-overlay");
    assert.ok(modal, "the picker opened");

    const opt = Array.from(modal.querySelectorAll(".be-border-option")).find((o) =>
      o.querySelector("[class*='_border']"),
    );
    assert.ok(opt, "a border option exists");
    opt.click();
    const ok = modal.querySelector(".be-modal-ok");
    assert.ok(ok, "the picker's Apply control exists");
    ok.click();
    await waitFor(() => window.undoDepth() > 0, { timeout: 3000 });

    assert.strictEqual(window.undoDepth(), 1, "the border change pushed exactly one record");
    assert.strictEqual(window.peekUndo().class, "border", "tagged as the border class");
    assert.ok(/^Border /.test(window.peekUndo().label), "and it is named: " + window.peekUndo().label);

    const after = await state(window);
    assert.notStrictEqual(after, before, "the border change landed");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(await state(window), before, "EXACTLY the pre-change layout");
  });
});

describe("Phase 2f — the structural family (AC-3)", function () {
  this.timeout(20000);
  let window, cleanup;

  beforeEach(async function () {
    const b = bootEditor();
    window = b.window;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    await window.injectCloneButtons();
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("cloning a shape is reversible — the inverse REMOVES the created node", async function () {
    const shape = window.createShape("assets/ornament.webp");
    await window.injectCloneButtons();
    const before = await state(window);

    const cloneBtn = shape.querySelector(".be-shape-clone");
    assert.ok(cloneBtn, "the clone-shape button was injected");
    cloneBtn.click();
    await waitFor(() => window.undoDepth() > 0, { timeout: 2000 });

    const after = await state(window);
    assert.notStrictEqual(after, before, "the clone must ADD something");
    assert.ok(
      (JSON.parse(after).shapeLayers[0].elements || []).length >
        (JSON.parse(before).shapeLayers[0].elements || []).length,
      "the record gained an element",
    );
    assert.strictEqual(window.peekUndo().class, "structural", "tagged as structural");

    assert.strictEqual((await window.applyUndo()).ok, true, "undo runs");
    assert.strictEqual(
      await state(window),
      before,
      "EXACTLY the pre-clone layout — the created shape is gone from the record",
    );
  });
});
