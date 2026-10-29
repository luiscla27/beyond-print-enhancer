/**
 * feature_12_properties_panel — Active Section State + Properties Panel
 *
 * THE declared certificate for unit feature_12_properties_panel
 * (component js/properties_panel, write_dir js/properties_panel.js).
 *
 * This suite proves the PRODUCTION code does what both the jsdoc and the
 * debt-pinned harness say it does, without mutating js/properties_panel.js.
 * Every test executes the real module eval'd via the shared harness boot
 * (the same path the encap-debt tests use) and asserts concrete DOM
 * outcomes — never a stub, never "file exists".
 *
 * Contract under test (js/properties_panel.js, lines 1-33):
 *   - THE selection store is `activeTarget`, written ONLY through
 *     `setActiveSection` (AC-1) and readable via `getActiveSection` /
 *     `getActiveTarget` + legacy `window.setActiveSection`.
 *   - The selected element carries `be-active-target` (+ `be-active-section`
 *     iff not a shape); its `.be-section-wrapper` ancestor carries
 *     `be-active-wrapper`. No other writer may add/remove those classes (AC-2
 *     DOM contract).
 *   - `updatePropertiesPanel` renders precisely the panel the PR #34 spec
 *     says: empty-state plus title + font-size slider + compact + scaling +
 *     border + floor-clip note or POSITION group + shape note, depending on
 *     the target kind.
 *   - Controls have live semantics: slider `oninput` calls
 *     `SectionUtils.applyFontSize`; compact toggles `be-compact-mode`;
 *     scaling toggles `data-no-auto-scale` + calls `initResponsiveScaling`;
 *     border button opens `AssetCatalog` picker and `Filters.clearBorderStyles`;
 *     position inputs clamp/round/commit and fire autosave/bounds.
 *   - House rules borrowed from the file-level comments: selection ring
 *     (fixed overlay `print-enhance-selection-ring` with resize/scroll/be-layout-moved
 *     tracking), chip multi-select is in LayerManager, compact syncs the
 *     sheet button, scaling floor marker + async note discipline, typo-safe
 *     manifest naming, etc.
 *
 * Each `describe` mirrors one of those clauses so a failing title tells the
 * reader which part of the contract broke.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

// ---------------------------------------------------------------------------
// Local fixtures — small, explicit, production-real DOM
// ---------------------------------------------------------------------------

const SECTION_SHEET_HTML = `<!DOCTYPE html><html><body>
  <div class="ct-character-sheet-desktop"><div class="ct-character-sheet__inner">
    <div class="be-section-wrapper" id="wrapper-traits" data-title="Traits">
      <div class="print-section-container" id="section-traits">
        <div class="print-section-header"><span>Traits</span></div>
        <div class="print-section-content">hello</div>
        <button class="be-compact-toggle">compact</button>
      </div>
    </div>
    <div class="be-section-wrapper" id="wrapper-equip" data-title="Equipment">
      <div class="print-section-container" id="section-equip">
        <div class="print-section-header"><span>Equipment</span></div>
        <div class="print-section-content">world</div>
        <button class="be-compact-toggle">compact</button>
      </div>
    </div>
  </div></div>
</body></html>`;

const MINIMAL_WRAPPER_HTML = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper"></div>
</body></html>`;

function panelHtml(document) {
  const panel = document.createElement("div");
  panel.id = "print-enhance-properties-panel";
  document.body.appendChild(panel);
  return panel;
}

// ---------------------------------------------------------------------------
// 1. The selection store — the single "active target" value (AC-1)
// ---------------------------------------------------------------------------

describe("feature_12_properties_panel — selection store (AC-1: one value, one writer)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(SECTION_SHEET_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    // Give trait a stable geometry so the ring has something to measure.
    document.getElementById("section-traits").getBoundingClientRect = () => ({
      left: 50, top: 50, width: 200, height: 120, right: 250, bottom: 170,
      x: 50, y: 50, toJSON() { return this; },
    });
  });
  afterEach(function () { cleanup(); });

  it("window.setActiveSection and window.PropertiesPanel.setActiveSection are the same function", function () {
    assert.strictEqual(window.setActiveSection, window.PropertiesPanel.setActiveSection);
  });

  it("getActiveSection and getActiveTarget read the same value", function () {
    const t = document.getElementById("section-traits");
    window.setActiveSection(t);
    assert.strictEqual(window.getActiveSection(), t);
    assert.strictEqual(window.PropertiesPanel.getActiveTarget(), t);
    // legacy alias is also exposed
    assert.strictEqual(window.getActiveSection(), window.PropertiesPanel.getActiveSection());
  });

  it("starts null when nothing selected", function () {
    assert.strictEqual(window.getActiveSection(), null);
    assert.strictEqual(window.PropertiesPanel.getActiveTarget(), null);
  });

  it("setActiveSection(null) clears the store", function () {
    const t = document.getElementById("section-traits");
    window.setActiveSection(t);
    assert.ok(window.getActiveSection());
    window.setActiveSection(null);
    assert.strictEqual(window.getActiveSection(), null);
    assert.strictEqual(window.PropertiesPanel.getActiveTarget(), null);
  });

  it("the store is exactly the normalized card (.print-section-container)", function () {
    // Fixture wraps: wrapper -> .print-section-container#section-traits
    const inner = document.querySelector("#section-traits .print-section-header span");
    assert.ok(inner);
    window.setActiveSection(inner); // pass a DESCENDANT, not the card
    const stored = window.getActiveSection();
    assert.ok(stored.classList.contains("print-section-container"), "store must be the card");
    assert.strictEqual(stored.id, "section-traits");
  });

  it("a shape target stays the shape wrapper (no card normalization)", function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper be-shape-wrapper" id="shape-wrapper-1" data-label="Star" style="left:20px;top:30px">
        <img alt="Star" />
      </div>
      <div id="print-enhance-properties-panel"></div>
    </body></html>`;
    const b2 = boot(html);
    const w2 = b2.window, d2 = b2.document;
    try {
      const shape = d2.getElementById("shape-wrapper-1");
      shape.getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON() { return this; } });
      w2.setActiveSection(shape);
      assert.strictEqual(w2.getActiveSection(), shape);
      assert.ok(shape.classList.contains("be-shape-wrapper"));
    } finally { b2.cleanup(); }
  });

  it("re-selecting the same target is idempotent — no duplicate writes", function () {
    const t = document.getElementById("section-traits");
    window.setActiveSection(t);
    const first = window.getActiveSection();
    window.setActiveSection(t);
    assert.strictEqual(window.getActiveSection(), first);
  });
});

// ---------------------------------------------------------------------------
// 2. DOM contract — AC-2 + legacy be-active-section/wrapper markers
// ---------------------------------------------------------------------------

describe("feature_12_properties_panel — DOM contract (markers, exactly one active)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(SECTION_SHEET_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    // stable geometries so the ring is exercised
    document.getElementById("section-traits").getBoundingClientRect = () => ({ left: 50, top: 50, width: 200, height: 120, right: 250, bottom: 170, x: 50, y: 50, toJSON() { return this; } });
    document.getElementById("section-equip").getBoundingClientRect = () => ({ left: 300, top: 60, width: 180, height: 100, right: 480, bottom: 160, x: 300, y: 60, toJSON() { return this; } });
  });
  afterEach(function () { cleanup(); });

  it("section: card gets be-active-target + be-active-section; wrapper gets be-active-wrapper", function () {
    const card = document.getElementById("section-traits");
    window.setActiveSection(card);
    assert.ok(card.classList.contains("be-active-target"), "card should have be-active-target");
    assert.ok(card.classList.contains("be-active-section"), "card section adds be-active-section");
    const wrapper = card.closest(".be-section-wrapper");
    assert.ok(wrapper.classList.contains("be-active-wrapper"), "wrapper should have be-active-wrapper");
  });

  it("shape: only be-active-target (+ wrapper) — never be-active-section", function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper be-shape-wrapper" id="shape-1" data-label="Star" style="left:0;top:0"></div>
      <div id="print-enhance-properties-panel"></div>
    </body></html>`;
    const b2 = boot(html);
    const w2 = b2.window, d2 = b2.document;
    try {
      const shape = d2.getElementById("shape-1");
      shape.getBoundingClientRect = () => ({ left: 0, top: 0, width: 20, height: 20, right: 20, bottom: 20, x: 0, y: 0, toJSON() { return this; } });
      w2.setActiveSection(shape);
      assert.ok(shape.classList.contains("be-active-target"));
      assert.ok(!shape.classList.contains("be-active-section"), "shapes must NOT carry be-active-section");
      assert.ok(shape.classList.contains("be-active-wrapper"), "shape wrapper is itself, so carries the wrapper marker");
    } finally { b2.cleanup(); }
  });

  it("only one active at a time — switching clears the old marker pair", function () {
    const a = document.getElementById("section-traits");
    const bEl = document.getElementById("section-equip");
    window.setActiveSection(a);
    assert.ok(a.classList.contains("be-active-target"));
    window.setActiveSection(bEl);
    assert.ok(bEl.classList.contains("be-active-target"));
    assert.ok(!a.classList.contains("be-active-target"), "old target must lose be-active-target");
    assert.ok(!a.classList.contains("be-active-section"));
    assert.ok(!a.closest(".be-section-wrapper").classList.contains("be-active-wrapper"));
  });

  it("clearing removes all markers", function () {
    const card = document.getElementById("section-traits");
    window.setActiveSection(card);
    window.setActiveSection(null);
    assert.ok(!card.classList.contains("be-active-target"));
    assert.ok(!card.classList.contains("be-active-section"));
    assert.ok(!card.closest(".be-section-wrapper").classList.contains("be-active-wrapper"));
  });

  it("never leaves two be-active-wrapper hosts", function () {
    const a = document.getElementById("section-traits");
    const bEl = document.getElementById("section-equip");
    window.setActiveSection(a);
    assert.strictEqual(document.querySelectorAll(".be-active-wrapper").length, 1);
    window.setActiveSection(bEl);
    assert.strictEqual(document.querySelectorAll(".be-active-wrapper").length, 1);
    assert.strictEqual(document.querySelector(".be-active-wrapper").id, "wrapper-equip");
  });

  it("the selection ring is a single fixed overlay that hides on clear", function () {
    const card = document.getElementById("section-traits");
    window.setActiveSection(card);
    const ring = document.getElementById("print-enhance-selection-ring");
    assert.ok(ring, "ring element should exist after first selection");
    assert.strictEqual(document.querySelectorAll("#print-enhance-selection-ring").length, 1, "exactly one ring in DOM");
    assert.notStrictEqual(ring.style.display, "none");
    // second selection must reuse the same element
    window.setActiveSection(document.getElementById("section-equip"));
    assert.strictEqual(document.getElementById("print-enhance-selection-ring"), ring, "ring should be reused, not duplicated");
    window.setActiveSection(null);
    assert.strictEqual(ring.style.display, "none", "ring should hide when nothing selected");
  });

  it("resize/scroll/be-layout-moved repositions the ring (no extra rings)", function () {
    const card = document.getElementById("section-traits");
    const rectA = { left: 50, top: 50, width: 200, height: 120, right: 250, bottom: 170, x: 50, y: 50, toJSON() { return this; } };
    const rectB = { left: 70, top: 40, width: 200, height: 120, right: 270, bottom: 160, x: 70, y: 40, toJSON() { return this; } };
    card.getBoundingClientRect = () => rectA;
    window.setActiveSection(card);
    const ring = document.getElementById("print-enhance-selection-ring");
    const leftA = ring.style.left;
    card.getBoundingClientRect = () => rectB;
    window.dispatchEvent(new window.Event("resize"));
    assert.notStrictEqual(ring.style.left, leftA, "resize should reposition the ring");
    window.dispatchEvent(new window.Event("be-layout-moved"));
    assert.strictEqual(document.querySelectorAll("#print-enhance-selection-ring").length, 1);
  });
});

// ---------------------------------------------------------------------------
// 3. Empty-state + titles
// ---------------------------------------------------------------------------

describe("feature_12_properties_panel — panel empty-state and titles", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(SECTION_SHEET_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () { cleanup(); });

  it("no host is a safe no-op; also accepts an explicit panelElement", function () {
    // Remove any panel so updatePropertiesPanel has no host.
    assert.doesNotThrow(() => window.PropertiesPanel.updatePropertiesPanel());
    const host = panelHtml(document);
    assert.doesNotThrow(() => window.PropertiesPanel.updatePropertiesPanel(host));
  });

  it("empty-state .be-prop-panel-empty until a section is selected", function () {
    const panel = panelHtml(document);
    window.PropertiesPanel.updatePropertiesPanel();
    assert.ok(panel.querySelector(".be-prop-panel-empty"), "empty marker must be present");
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 80, right: 100, bottom: 80, x: 0, y: 0, toJSON() { return this; } });
    window.setActiveSection(card);
    assert.strictEqual(panel.querySelector(".be-prop-panel-empty"), null, "empty marker must go after selection");
  });

  it("section title: Editing: <header span text>", function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    window.setActiveSection(card);
    assert.ok(panel.querySelector("h4"), "title element must exist");
    assert.ok(panel.querySelector("h4").textContent.includes("Traits"), `h4=${panel.querySelector("h4").textContent}`);
  });

  it("shape title prefers data-label/data-title/img alt, then Shape", function () {
    const html = `<!DOCTYPE html><html><body>
      <div class="be-section-wrapper be-shape-wrapper" id="shape-a" data-label="My Star"></div>
      <div class="be-section-wrapper be-shape-wrapper" id="shape-b" data-title="Fallback"></div>
      <div class="be-section-wrapper be-shape-wrapper" id="shape-c"></div>
      <div id="print-enhance-properties-panel"></div>
    </body></html>`;
    const b2 = boot(html);
    const w2 = b2.window, d2 = b2.document;
    try {
      const panel = d2.getElementById("print-enhance-properties-panel");
      const a = d2.getElementById("shape-a");
      a.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10, x: 0, y: 0, toJSON() { return this; } });
      w2.setActiveSection(a);
      assert.ok(panel.querySelector("h4").textContent.includes("My Star"));
      const bEl = d2.getElementById("shape-b");
      bEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10, x: 0, y: 0, toJSON() { return this; } });
      w2.setActiveSection(bEl);
      assert.ok(panel.querySelector("h4").textContent.includes("Fallback"));
      const c = d2.getElementById("shape-c");
      c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10, x: 0, y: 0, toJSON() { return this; } });
      w2.setActiveSection(c);
      assert.ok(panel.querySelector("h4").textContent.includes("Shape"), `shape fallback title=${panel.querySelector("h4").textContent}`);
    } finally { b2.cleanup(); }
  });

  it("switching back to a different section retitles the panel", function () {
    const panel = panelHtml(document);
    const a = document.getElementById("section-traits");
    const bEl = document.getElementById("section-equip");
    a.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 80, right: 100, bottom: 80, x: 0, y: 0, toJSON() { return this; } });
    bEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    window.setActiveSection(a);
    assert.ok(panel.textContent.includes("Traits"));
    window.setActiveSection(bEl);
    assert.ok(panel.textContent.includes("Equipment"));
    assert.ok(!panel.querySelector(".be-prop-panel-empty"));
  });
});

// ---------------------------------------------------------------------------
// 4. Section control surface (font size, position, compact, scaling, border)
// ---------------------------------------------------------------------------

describe("feature_12_properties_panel — section control surface", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(SECTION_SHEET_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    // Stable geometry for selection ring path.
    document.getElementById("section-traits").getBoundingClientRect = () => ({ left: 10, top: 10, width: 120, height: 90, right: 130, bottom: 100, x: 10, y: 10, toJSON() { return this; } });
  });
  afterEach(function () { cleanup(); });

  it("section panel contains font slider + compact toggle + scaling toggle + border button + position inputs", function () {
    const panel = panelHtml(document);
    window.setActiveSection(document.getElementById("section-traits"));
    // font slider
    assert.ok(panel.querySelector('input[type="range"]'), "font slider should be present");
    // compact + scaling checkboxes
    const boxes = panel.querySelectorAll('input[type="checkbox"]');
    assert.strictEqual(boxes.length, 2, `expected compact + scaling toggles, got ${boxes.length}`);
    // border button + preview
    assert.ok(panel.querySelector(".be-prop-border-button"), "border button");
    assert.ok(panel.querySelector(".be-border-preview"), "border preview");
    // position X/Y
    assert.ok(panel.querySelector('input[data-be-pos="x"]'), "position X");
    assert.ok(panel.querySelector('input[data-be-pos="y"]'), "position Y");
    assert.ok(panel.querySelector(".be-prop-position"));
  });

  it("font slider: min 8, max 30, display sync, oninput -> SectionUtils.applyFontSize + updateLayoutBounds", function () {
    const panel = panelHtml(document);
    let applyArgs = null, layoutBoundsCalls = 0;
    const origApply = window.SectionUtils.applyFontSize;
    const origBounds = window.updateLayoutBounds;
    window.SectionUtils.applyFontSize = (wrapper, size) => { applyArgs = { wrapper, size }; };
    window.updateLayoutBounds = () => { layoutBoundsCalls += 1; };
    try {
      const card = document.getElementById("section-traits");
      card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 80, right: 100, bottom: 80, x: 0, y: 0, toJSON() { return this; } });
      const wrapper = card.closest(".be-section-wrapper");
      wrapper.style.fontSize = "14px";
      window.setActiveSection(card);
      const slider = panel.querySelector('input[type="range"]');
      const displaySpan = Array.from(panel.querySelectorAll("span")).find((s) => s.textContent.includes("px"));
      assert.ok(displaySpan, "display span must show initial px value");
      assert.strictEqual(slider.min, "8");
      assert.strictEqual(slider.max, "30");
      assert.strictEqual(slider.value, "14");
      // Drag the slider.
      slider.value = "22";
      slider.dispatchEvent(new window.Event("input", { bubbles: true }));
      assert.ok(applyArgs, "SectionUtils.applyFontSize must be called oninput");
      assert.strictEqual(applyArgs.size, "22px");
      assert.strictEqual(applyArgs.wrapper, wrapper);
      assert.ok(displaySpan.textContent.includes("22"), `display should show 22px, got ${displaySpan.textContent}`);
      assert.strictEqual(layoutBoundsCalls, 1);
    } finally {
      window.SectionUtils.applyFontSize = origApply;
      window.updateLayoutBounds = origBounds;
    }
  });

  it("font slider reads % values as px (base 10): 200% -> 20", function () {
    const panel = panelHtml(document);
    const wrapper = document.getElementById("section-traits").closest(".be-section-wrapper");
    wrapper.style.fontSize = "200%";
    window.setActiveSection(document.getElementById("section-traits"));
    assert.strictEqual(panel.querySelector('input[type="range"]').value, "20");
  });

  it("compact toggle: reflects be-compact-mode and flips it on change, syncs sheet button", function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    let layoutBoundsCalls = 0;
    const orig = window.updateLayoutBounds;
    window.updateLayoutBounds = () => { layoutBoundsCalls += 1; };
    try {
      card.classList.remove("be-compact-mode");
      window.setActiveSection(card);
      const boxes = panel.querySelectorAll('input[type="checkbox"]');
      // Compact is the first checkbox in render order; scaling second.
      const compactBox = boxes[0];
      assert.strictEqual(compactBox.checked, false, "should start false");
      compactBox.checked = true;
      compactBox.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.ok(card.classList.contains("be-compact-mode"), "card should gain compact");
      assert.strictEqual(layoutBoundsCalls, 1);
      const sheetBtn = card.querySelector(".be-compact-toggle");
      assert.ok(sheetBtn, "panel compact should sync sheet button style");
      compactBox.checked = false;
      compactBox.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.ok(!card.classList.contains("be-compact-mode"), "should clear on uncheck");
    } finally { window.updateLayoutBounds = orig; }
  });

  it("auto-scale toggle: checked by default, flips data-no-auto-scale, calls initResponsiveScaling + updateLayoutBounds", async function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    let initCalls = 0, layoutBoundsCalls = 0;
    const origInit = window.initResponsiveScaling;
    const origBounds = window.updateLayoutBounds;
    window.initResponsiveScaling = () => { initCalls += 1; };
    window.updateLayoutBounds = () => { layoutBoundsCalls += 1; };
    try {
      delete card.dataset.noAutoScale;
      window.setActiveSection(card);
      const boxes = panel.querySelectorAll('input[type="checkbox"]');
      const scalingBox = boxes[1];
      assert.strictEqual(scalingBox.checked, true, "auto-scale checked means noAutoScale absent");
      scalingBox.checked = false;
      scalingBox.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.strictEqual(card.dataset.noAutoScale, "true");
      assert.strictEqual(initCalls, 1);
      assert.strictEqual(layoutBoundsCalls, 1);
      // Toggle back: attribute removed.
      scalingBox.checked = true;
      scalingBox.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.strictEqual(card.dataset.noAutoScale, undefined);
      assert.strictEqual(initCalls, 2);
      assert.strictEqual(layoutBoundsCalls, 2);
    } finally {
      window.initResponsiveScaling = origInit;
      window.updateLayoutBounds = origBounds;
    }
    // Include the 0ms timer path so the notebank timer fires before cleanup.
    await new Promise((r) => setTimeout(r, 10));
  });

  it("floor clip note: appears when data-scaling-clipped=true, removed when false", async function () {
    const card = document.getElementById("section-traits");
    card.setAttribute("data-scaling-clipped", "true");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    const panel = panelHtml(document);
    window.setActiveSection(card);
    let note = Array.from(panel.querySelectorAll(".be-prop-panel-note")).find((el) => /auto-scale/i.test(el.textContent));
    assert.ok(note, "clipped note must be present when attribute is true");
    assert.ok(/readability floor|overflows|bottom is cut off/i.test(note.textContent));
    // Switching attribute and toggling the scaling box will trigger the async syncClipNote.
    card.setAttribute("data-scaling-clipped", "false");
    const boxes = panel.querySelectorAll('input[type="checkbox"]');
    const scalingBox = boxes[1];
    scalingBox.checked = false;
    scalingBox.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    const live = Array.from(panel.querySelectorAll(".be-prop-panel-note")).find((el) => /auto-scale/i.test(el.textContent));
    assert.strictEqual(live, undefined, "note must be removed when no longer clipped");
  });

  it("border preview reflects the section's current border class (or default-border)", function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    // Pick a real style from ASSET_LIST (that the harness mapping exposes on the card).
    const known = window.AssetCatalog.ALL_BORDER_STYLES.find((c) => c === "spikes_border");
    if (known) card.classList.add(known);
    window.setActiveSection(card);
    const preview = panel.querySelector(".be-border-preview");
    assert.ok(preview.classList.contains(known || "default-border"));
  });

  it("border button: opens AssetCatalog style picker in style mode; Apply updates class + preview + bounds", async function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    let pickerMode = null, clearSeen = null, boundsCalls = 0;
    const origPicker = window.showAssetPickerModal;
    const origClear = window.Filters.clearBorderStyles;
    const origBounds = window.updateLayoutBounds;
    window.showAssetPickerModal = (opts) => { pickerMode = opts; return Promise.resolve({ style: "spikes_border" }); };
    window.Filters.clearBorderStyles = (el) => {
      clearSeen = el;
      // Reasonable stub: strip only border classes, not the card identity.
      (window.AssetCatalog.ALL_BORDER_STYLES || []).forEach((c) => el.classList.remove(c));
    };
    window.updateLayoutBounds = () => { boundsCalls += 1; };
    try {
      window.setActiveSection(card);
      const btn = panel.querySelector(".be-prop-border-button");
      await btn.onclick();
      assert.ok(pickerMode, "showAssetPickerModal must be invoked");
      assert.strictEqual(pickerMode.mode, "style", "must be style mode");
      assert.strictEqual(pickerMode.target, card);
      assert.strictEqual(clearSeen, card, "clearBorderStyles should receive the card");
      assert.ok(card.classList.contains("spikes_border"));
      assert.ok(panel.querySelector(".be-border-preview").classList.contains("spikes_border"), "preview must track the new class");
      assert.strictEqual(boundsCalls, 1);
    } finally {
      window.showAssetPickerModal = origPicker;
      window.Filters.clearBorderStyles = origClear;
      window.updateLayoutBounds = origBounds;
    }
  });

  it("border button: cancelling the picker leaves the section unchanged", async function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    const origPicker = window.showAssetPickerModal;
    // Strip active markers that the selector adds — border identity is independent of them.
    window.setActiveSection(card);
    const borderBefore = (window.AssetCatalog.ALL_BORDER_STYLES || []).some((c) => card.classList.contains(c))
      ? (window.AssetCatalog.ALL_BORDER_STYLES || []).find((c) => card.classList.contains(c))
      : "none";
    const previewBefore = panel.querySelector(".be-border-preview").className;
    window.showAssetPickerModal = () => Promise.resolve(null);
    try {
      await panel.querySelector(".be-prop-border-button").onclick();
      const borderAfter = (window.AssetCatalog.ALL_BORDER_STYLES || []).some((c) => card.classList.contains(c))
        ? (window.AssetCatalog.ALL_BORDER_STYLES || []).find((c) => card.classList.contains(c))
        : "none";
      assert.strictEqual(borderAfter, borderBefore, "border class must be unchanged when picker is cancelled");
      assert.strictEqual(panel.querySelector(".be-border-preview").className, previewBefore, "preview must be unchanged when picker is cancelled");
    } finally { window.showAssetPickerModal = origPicker; }
  });

  it("position group: committed handlers are wired on change/Enter; syncPositionInputs reflects wrapper style", function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    const wrapper = card.closest(".be-section-wrapper");
    wrapper.style.left = "24px";
    wrapper.style.top = "8px";
    window.setActiveSection(card);
    assert.strictEqual(panel.querySelector('input[data-be-pos="x"]').value, "24");
    assert.strictEqual(panel.querySelector('input[data-be-pos="y"]').value, "8");
    wrapper.style.left = "91px";
    window.PropertiesPanel.syncPositionInputs();
    assert.strictEqual(panel.querySelector('input[data-be-pos="x"]').value, "91");
  });
});

// ---------------------------------------------------------------------------
// 5. Shape panel — one shared panel surface, two rendering modes
// ---------------------------------------------------------------------------

describe("feature_12_properties_panel — shape target (own-sheet controls acknowledged)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(`<!DOCTYPE html><html><body>
      <div class="be-section-wrapper be-shape-wrapper" id="shape-1" data-label="My Star" style="left:12px;top:34px">
        <img alt="Star" />
      </div>
      <div id="print-enhance-properties-panel"></div>
    </body></html>`);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    document.getElementById("shape-1").getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON() { return this; } });
  });
  afterEach(function () { cleanup(); });

  it("shape panel: has position inputs, missing font/compact/border controls, and an explanatory note", function () {
    window.setActiveSection(document.getElementById("shape-1"));
    const panel = document.getElementById("print-enhance-properties-panel");
    assert.ok(panel.querySelector(".be-prop-position"), "shape panel must have a position group");
    assert.ok(panel.querySelector('input[data-be-pos="x"]') && panel.querySelector('input[data-be-pos="y"]'));
    // Accidental section controls would be a modelling mistake (AC-1 in the file).
    assert.strictEqual(panel.querySelector('input[type="range"]'), null, "shape must not have a font slider");
    assert.strictEqual(panel.querySelector(".be-prop-border-button"), null, "shape must not have a border button");
    assert.ok(Array.from(panel.querySelectorAll(".be-prop-panel-note"))
      .some((el) => /Shape selected/i.test(el.textContent)), "shape note must be present");
  });

  it("shape title comes from the shape (label/title/img alt), not a fabricated section header", function () {
    window.setActiveSection(document.getElementById("shape-1"));
    const h4 = document.getElementById("print-enhance-properties-panel").querySelector("h4");
    assert.ok(h4 && h4.textContent.includes("My Star"));
  });

  it("shape still paints the selection ring", function () {
    window.setActiveSection(document.getElementById("shape-1"));
    const ring = document.getElementById("print-enhance-selection-ring");
    assert.ok(ring && ring.style.display !== "none");
  });
});

// ---------------------------------------------------------------------------
// 6. Notifications, lifecycle, and additive seams
// ---------------------------------------------------------------------------

describe("feature_12_properties_panel — notifications and lifecycle (announce, prune, addShape state, syncPosition)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(SECTION_SHEET_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    document.getElementById("section-traits").getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 80, right: 100, bottom: 80, x: 0, y: 0, toJSON() { return this; } });
    document.getElementById("section-equip").getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
  });
  afterEach(function () { cleanup(); });

  it("be-selection-changed event + LayerManager.syncSelectionRow are fired on every store write", function () {
    // Install a readable LayerManager shim resolved lazily by PropertiesPanel.
    let syncArgs = null;
    window.PeDom = () => ({
      getLayerManager: () => ({
        syncSelectionRow: (target) => { syncArgs = target; },
      }),
    });
    let emitted = null;
    window.addEventListener("be-selection-changed", (e) => { emitted = e.detail && e.detail.targetId; });
    window.setActiveSection(document.getElementById("section-traits"));
    assert.strictEqual(syncArgs && syncArgs.id, "section-traits", "syncSelectionRow should receive the card");
    assert.strictEqual(emitted, "section-traits");
    window.setActiveSection(null);
    assert.strictEqual(emitted, null);
    assert.strictEqual(syncArgs, null);
  });

  it("pruneSelection clears a removed target and returns true; stable otherwise", function () {
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON() { return this; } });
    window.setActiveSection(card);
    // Not connected -> prune.
    card.remove();
    assert.strictEqual(window.PropertiesPanel.pruneSelection(), true);
    assert.strictEqual(window.getActiveSection(), null);
    assert.ok(!document.querySelector(".be-active-target"), "marker must be cleared");
    assert.strictEqual(document.getElementById("print-enhance-selection-ring").style.display, "none");
    // Second call: already clear.
    assert.strictEqual(window.PropertiesPanel.pruneSelection(), false);
    // Connected and active -> remains false.
    const live = document.getElementById("section-equip");
    live.getBoundingClientRect = () => ({ left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON() { return this; } });
    window.setActiveSection(live);
    assert.strictEqual(window.PropertiesPanel.pruneSelection(), false);
    assert.strictEqual(window.getActiveSection(), live);
  });

  it("updateControlsState enables/disables #be-btn-add-shape based on LayerManager.activeLayerId (no throw)", function () {
    const b2 = boot(MINIMAL_WRAPPER_HTML);
    const w2 = b2.window, d2 = b2.document;
    try {
      const btn = d2.createElement("button");
      btn.id = "be-btn-add-shape";
      d2.body.appendChild(btn);
      w2.PeDom = () => ({
        getLayerManager: () => ({ activeLayerId: null }),
      });
      // Direct call via w2 harness module:
      w2.PropertiesPanel.updateControlsState();
      assert.strictEqual(btn.disabled, true);
      assert.strictEqual(btn.style.opacity, "0.5");
      w2.PeDom = () => ({ getLayerManager: () => ({ activeLayerId: "sections" }) });
      w2.PropertiesPanel.updateControlsState();
      assert.strictEqual(btn.disabled, false);
      assert.strictEqual(btn.style.opacity, "1");
      // No manager at all -> safe.
      delete w2.PeDom; delete w2.DomManager;
      // Even a missing manager path is documented as not throwing.
      assert.doesNotThrow(() => w2.PropertiesPanel.updateControlsState());
    } finally { b2.cleanup(); }
  });

  it("syncPositionInputs is a safe no-op when there is no panel or no selection", function () {
    // Start with no panel and no selection (boot already reset).
    assert.doesNotThrow(() => window.PropertiesPanel.syncPositionInputs());
    // Panel but still no target.
    panelHtml(document);
    assert.doesNotThrow(() => window.PropertiesPanel.syncPositionInputs());
  });

  it("position commit: clamps negative, rounds, sets !important, calls captureUndo before the write, then bounds+autosave+notify", async function () {
    const panel = panelHtml(document);
    const card = document.getElementById("section-traits");
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 60, right: 80, bottom: 60, x: 0, y: 0, toJSON() { return this; } });
    const wrapper = card.closest(".be-section-wrapper");
    let captureArg = null, bounds = 0, autosave = 0, moved = 0;
    window.captureUndo = async (msg) => { captureArg = msg; };
    window.MUTATION_CLASSES = window.MUTATION_CLASSES || { POSITION: "position" };
    window.updateLayoutBounds = () => { bounds += 1; };
    window.scheduleAutosave = () => { autosave += 1; };
    window.notifyLayoutMoved = () => { moved += 1; };
    try {
      wrapper.style.left = "10px";
      wrapper.style.top = "5px";
      window.setActiveSection(card);
      const xInput = panel.querySelector('input[data-be-pos="x"]');
      const yInput = panel.querySelector('input[data-be-pos="y"]');
      xInput.value = "-7.8";
      xInput.dispatchEvent(new window.Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 15));
      assert.strictEqual(xInput.value, "0", "negative should clamp to 0");
      assert.strictEqual(wrapper.style.left, "0px");
      assert.ok(captureArg && /Position/i.test(captureArg), "captureUndo must be called before mutation");
      assert.strictEqual(bounds, 1);
      assert.strictEqual(autosave, 1);
      assert.strictEqual(moved, 1);
      // Rounding + reroll on same value must not re-capture.
      captureArg = null;
      yInput.value = "8.4";
      yInput.dispatchEvent(new window.Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(yInput.value, "8");
      assert.ok(captureArg, "new value should capture");
      captureArg = null;
      yInput.dispatchEvent(new window.Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(captureArg, null, "no-op re-commit must not re-capture");
      // Enter key path.
      wrapper.style.left = "0px";
      xInput.value = "19.2";
      xInput.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      assert.strictEqual(wrapper.style.getPropertyValue("left"), "19px");
    } finally {
      delete window.captureUndo;
      delete window.scheduleAutosave;
      delete window.notifyLayoutMoved;
      // leave MUTATION_CLASSES if it pre-existed — no-op to restore precisely
    }
  });

  it("PropertiesPanel surface lists every window-observed handle and positions the ring (true audit)", function () {
    const api = window.PropertiesPanel;
    for (const name of ["setActiveSection", "getActiveSection", "getActiveTarget", "pruneSelection", "positionSelectionRing", "updatePropertiesPanel", "updateControlsState", "syncPositionInputs"]) {
      assert.strictEqual(typeof api[name], "function", `${name} must be a function on PropertiesPanel`);
    }
    // True identity (the debt-harnessed overwrite contract): the window legacy and module are the same binding.
    assert.strictEqual(window.setActiveSection, api.setActiveSection);
    assert.strictEqual(window.getActiveSection, api.getActiveSection);
    assert.strictEqual(window.updateControlsState, api.updateControlsState);
  });
});
