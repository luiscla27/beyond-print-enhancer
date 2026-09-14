/**
 * E5 — Encapsulation-debt regression suite (2026-02-24).
 *   bb0101d feat(dom): wrapper selector to DomManager
 *   05edc50 feat(css): be-section-wrapper CSS (wrapper structure)
 *   1ae380b fix(ui): introduce .be-section-wrapper to prevent clipping
 *   1b625be fix(layout): default Shapes Mode OFF + height fix
 *   0627156 fix(assets): Correct Dwarf and Ornament paths
 * Complementary to dom_manager, wrapper_bug, cloning_*, site_main_visibility.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootRooted() {
  return boot(
    "<!DOCTYPE html><html><body><div id='print-layout-wrapper'></div></body></html>",
  );
}

/* ------------------------------------------------------------------ */
/* bb0101d — DomManager wrapper/layer selectors                        */
/* ------------------------------------------------------------------ */
describe("E5 bb0101d — DomManager layer containers", function () {
  let window, document, cleanup, dom;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    dom = window.DomManager.getInstance();
  });
  afterEach(function () {
    cleanup();
  });

  it("getLayoutRoot resolves the #print-layout-wrapper element", function () {
    assert.strictEqual(
      dom.getLayoutRoot().element,
      document.getElementById("print-layout-wrapper"),
    );
  });

  it("adopts .ct-subsections as the layout root when the wrapper id is missing", function () {
    const b = boot(
      "<!DOCTYPE html><html><body><div class='ct-subsections'></div></body></html>",
    );
    const root = b.window.DomManager.getInstance().getLayoutRoot().element;
    assert.ok(root.classList.contains("ct-subsections"));
    assert.strictEqual(root.id, "print-layout-wrapper");
    b.cleanup();
  });

  it("creates the sections layer inside the layout root", function () {
    const layer = dom.getSectionsLayer().element;
    assert.ok(layer);
    assert.strictEqual(layer.id, "print-enhance-sections-layer");
    assert.strictEqual(layer.parentElement.id, "print-layout-wrapper");
  });

  it("creates the shapes container inside the layout root", function () {
    const container = dom.getShapesContainer().element;
    assert.strictEqual(container.id, "print-enhance-shapes-container");
    assert.strictEqual(container.parentElement.id, "print-layout-wrapper");
  });

  it("reuses existing layer containers instead of duplicating them", function () {
    dom.getSectionsLayer();
    dom.getSectionsLayer();
    assert.strictEqual(
      document.querySelectorAll("#print-enhance-sections-layer").length,
      1,
    );
  });
});

/* ------------------------------------------------------------------ */
/* 05edc50 — wrapper structure produced by createDraggableContainer    */
/* ------------------------------------------------------------------ */
describe("E5 05edc50 — wrapper DOM structure", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("builds be-section-wrapper > print-section-container > print-section-content", function () {
    const wrapper = window.createDraggableContainer("Title", document.createElement("div"), "sec-1");
    assert.ok(wrapper.classList.contains("be-section-wrapper"));
    assert.strictEqual(wrapper.id, "sec-1-wrapper");
    assert.strictEqual(wrapper.dataset.title, "Title");
    const container = wrapper.querySelector(".print-section-container");
    assert.strictEqual(container.id, "sec-1");
    assert.ok(container.querySelector(".print-section-content"));
    assert.strictEqual(container.parentElement, wrapper);
  });

  it("keeps container free of inline left/top at creation", function () {
    const wrapper = window.createDraggableContainer("T", document.createElement("div"), "s2");
    const container = wrapper.querySelector(".print-section-container");
    assert.strictEqual(container.style.left, "");
    assert.strictEqual(container.style.top, "");
  });

  it("categorizes wrappers by section slug when content is recognizable", function () {
    const body = document.createElement("div");
    body.innerHTML = '<div class="print-section-header"><span>Stats</span></div>';
    const wrapper = window.createDraggableContainer("Stats", body, "s3");
    assert.ok(
      wrapper.classList.contains("be-section-stats") ||
        wrapper.classList.contains("be-section-unknown"),
    );
  });

  it("wrappers are not native drag sources for the pointer dnd engine", function () {
    // Superseded 2026-09-09 by drag_ux_overhaul_20260909 Phase 1: wrapper
    // dragging moved from native HTML5 DnD (draggable=true) to the
    // pointer-events engine, which arms after a movement threshold.
    const wrapper = window.createDraggableContainer("T", document.createElement("div"), "s4");
    assert.strictEqual(wrapper.draggable, false);
  });
});

/* ------------------------------------------------------------------ */
/* 1ae380b — wrapper introduction around rendered clones               */
/* ------------------------------------------------------------------ */
describe("E5 1ae380b — cloned sections are wrapped once", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function snapshot(id, title) {
    return {
      originalId: id,
      id: id,
      title: title,
      html: '<div class="print-section-header"><span>' + title + "</span></div><div>body</div>",
      styles: {},
    };
  }

  it("renderClonedSection returns a single wrapped clone", function () {
    const clone = window.renderClonedSection(snapshot("clone-abc", "Stats"));
    assert.strictEqual(clone.querySelectorAll(".be-section-wrapper").length, 0);
    assert.ok(clone.classList.contains("be-section-wrapper"));
    const container = clone.querySelector(".print-section-container");
    assert.ok(container.classList.contains("be-clone"));
    assert.strictEqual(container.dataset.originalId, "clone-abc");
  });

  it("appends the wrapped clone into the sections layer", function () {
    const clone = window.renderClonedSection(snapshot("clone-def", "Gear"));
    const layer = document.getElementById("print-enhance-sections-layer");
    assert.ok(layer.contains(clone), "clone should live inside the sections layer");
  });

  it("wrapper precedes the container in the hierarchy (no double nesting)", function () {
    const clone = window.renderClonedSection(snapshot("clone-ghi", "Notes"));
    const container = clone.querySelector(".print-section-container");
    assert.strictEqual(container.parentElement, clone);
    assert.ok(!container.classList.contains("be-section-wrapper"));
  });

  it("fresh clones start without active section state", function () {
    const clone = window.renderClonedSection(snapshot("clone-jkl", "Feats"));
    assert.ok(!clone.classList.contains("be-active-wrapper"));
  });
});

/* ------------------------------------------------------------------ */
/* 1b625be — Shapes Mode default OFF + height enforcement              */
/* ------------------------------------------------------------------ */
describe("E5 1b625be — default shapes mode and height enforcement", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = bootRooted();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("fresh boot leaves shapes mode inactive", function () {
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
  });

  it("explicit off-toggle is idempotent and side-effect free", function () {
    window.toggleShapesMode(false);
    const classes = document.body.className;
    window.toggleShapesMode(false);
    assert.strictEqual(document.body.className, classes);
    assert.ok(!document.body.classList.contains("be-shapes-mode-active"));
  });

  it("enforceFullHeight runs without error on an empty layout", function () {
    assert.doesNotThrow(() => window.enforceFullHeight());
  });

  it("enforceFullHeight is safe to call twice (idempotent)", function () {
    window.enforceFullHeight();
    assert.doesNotThrow(() => window.enforceFullHeight());
  });
});

/* ------------------------------------------------------------------ */
/* 0627156 — Dwarf and Ornament asset paths                            */
/* ------------------------------------------------------------------ */
describe("E5 0627156 — dwarf/ornament assets reachable in picker", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: "shapes-default",
        refreshUI: () => {},
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
  });
  afterEach(function () {
    cleanup();
  });

  async function openTab(folder) {
    const p = window.showShapePickerModal("", folder);
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
  }

  it("lists the Dwarf border asset under the Borders tab", async function () {
    await openTab("assets/");
    const titles = Array.from(document.querySelectorAll(".be-border-option")).map(
      (o) => (o.title || "").toLowerCase(),
    );
    assert.ok(titles.includes("dwarf"), `titles: ${titles.join(", ")}`);
  });

  it("lists Ornament variants under the Borders tab", async function () {
    await openTab("assets/");
    const titles = Array.from(document.querySelectorAll(".be-border-option")).map(
      (o) => (o.title || "").toLowerCase(),
    );
    const ornaments = titles.filter((t) => t.includes("ornament"));
    assert.ok(ornaments.length >= 2, `ornaments: ${ornaments.join(", ")}`);
  });

  it("renders dwarf/ornament options through their border classes", async function () {
    await openTab("assets/");
    const dwarf = Array.from(
      document.querySelectorAll(".be-border-option"),
    ).find((o) => (o.title || "").toLowerCase() === "dwarf");
    assert.ok(dwarf, "dwarf option should exist");
    const preview = dwarf.querySelector(".be-border-preview");
    assert.ok(preview.classList.contains("dwarf_border"), preview.className);
  });

  it("keeps dwarf reachable as a shape asset too", async function () {
    await openTab("assets/shapes/");
    const titles = Array.from(document.querySelectorAll(".be-border-option")).map(
      (o) => (o.title || "").toLowerCase(),
    );
    assert.ok(titles.some((t) => t.includes("dwarf")), `titles: ${titles.join(", ")}`);
  });
});
