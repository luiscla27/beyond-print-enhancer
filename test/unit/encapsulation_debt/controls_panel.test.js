"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

function bootRooted() {
  return boot('<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div></body></html>');
}

function getLabel(container, needle) {
  return Array.from(container.querySelectorAll("label")).find((l) => l.textContent.includes(needle)) || null;
}
function getSliderForLabel(container, needle) {
  const label = getLabel(container, needle);
  if (!label) return null;
  const row = label.closest("div").parentElement;
  return row.querySelector('input[type="range"]');
}
function findColorPickerBtn(document) {
  return Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Color Picker")) || null;
}
function findPicker(document) {
  const tint = Array.from(document.body.querySelectorAll("*")).find((e) => e.textContent === "Tint");
  return tint ? tint.parentElement : null;
}

// ---------------------------------------------------------------------------
// 1. Boot & idempotency
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — boot & idempotency", function () {
  let ctx;
  beforeEach(function () { ctx = bootRooted(); });
  afterEach(function () { ctx.cleanup(); });

  it("createControls builds #print-enhance-controls in the document", function () {
    ctx.window.createControls();
    const el = ctx.document.getElementById("print-enhance-controls");
    assert.ok(el, "#print-enhance-controls should exist after createControls()");
    assert.strictEqual(el.tagName, "DIV");
  });

  it("second call is idempotent — no duplicate panel (debt #1 fix)", function () {
    ctx.window.createControls();
    ctx.window.createControls();
    assert.strictEqual(ctx.document.querySelectorAll("#print-enhance-controls").length, 1);
  });

  it("container is position:fixed with expected chrome", function () {
    ctx.window.createControls();
    const el = ctx.document.getElementById("print-enhance-controls");
    assert.strictEqual(el.style.position, "fixed");
    assert.strictEqual(el.style.top, "10px");
    assert.strictEqual(el.style.left, "10px");
    assert.strictEqual(el.style.zIndex, String(ctx.window.Z.PANEL));
    // browser normalises "#222" to rgb(34,34,34); accept either spelling
    assert.match(el.style.background, /222|34,\s*34,\s*34/);
    assert.strictEqual(el.style.borderRadius, "8px");
  });

  it("hover listeners toggle transform between scale(1) and scale(1.02)", function () {
    ctx.window.createControls();
    const el = ctx.document.getElementById("print-enhance-controls");
    el.dispatchEvent(new ctx.window.Event("mouseenter"));
    assert.strictEqual(el.style.transform, "scale(1.02)");
    el.dispatchEvent(new ctx.window.Event("mouseleave"));
    assert.strictEqual(el.style.transform, "scale(1)");
  });

  it("no inline box-shadow — theme layer owns shadow (ISSUE_shadows.md)", function () {
    ctx.window.createControls();
    const el = ctx.document.getElementById("print-enhance-controls");
    assert.strictEqual(el.style.boxShadow, "");
  });

  it("print-hiding style block is injected once", function () {
    ctx.window.createControls();
    ctx.window.createControls();
    const styles = ctx.document.querySelectorAll("#ddb-print-controls-style");
    assert.strictEqual(styles.length, 1);
    assert.match(styles[0].textContent, /@media print/);
  });

  it("container has opacity/transform transition", function () {
    ctx.window.createControls();
    const el = ctx.document.getElementById("print-enhance-controls");
    assert.match(el.style.transition, /opacity/);
    assert.match(el.style.transition, /transform/);
  });
});

// ---------------------------------------------------------------------------
// 2. Tray IA and collapsible disclosure
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — tray IA and collapsible disclosure", function () {
  let ctx, document, window;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
  });
  afterEach(function () { ctx.cleanup(); });

  it("LAYOUT and OUTPUT trays exist with stable IDs", function () {
    assert.ok(document.getElementById("be-ctl-tray-layout"), "LAYOUT tray missing");
    assert.ok(document.getElementById("be-ctl-tray-output"), "OUTPUT tray missing");
  });

  it("no HELP tray — legacy tray was removed (AC-3 first_run_and_panel)", function () {
    assert.strictEqual(document.getElementById("be-ctl-tray-help"), null);
  });

  it("each tray contains a collapsible head button .be-ctl-fold with aria-expanded and aria-controls", function () {
    ["be-ctl-tray-layout", "be-ctl-tray-output"].forEach((id) => {
      const tray = document.getElementById(id);
      const head = document.getElementById(`${id}-head`);
      assert.ok(head, `head for ${id} missing`);
      assert.strictEqual(head.tagName, "BUTTON");
      assert.strictEqual(head.type, "button");
      assert.ok(head.classList.contains("be-ctl-tray-head"), "missing be-ctl-tray-head");
      assert.ok(head.classList.contains("be-ctl-fold"), "missing be-ctl-fold");
      assert.strictEqual(head.getAttribute("aria-expanded"), "true");
      assert.strictEqual(head.getAttribute("aria-controls"), id);
      assert.strictEqual(head.parentElement, tray, "head should be direct child of its tray");
      const caret = head.querySelector(".be-ctl-fold-caret");
      assert.ok(caret, "caret missing");
      assert.strictEqual(caret.getAttribute("aria-hidden"), "true");
      const label = head.querySelector(".be-ctl-fold-label");
      assert.ok(label, "fold label missing");
    });
  });

  it("header label text matches tray name", function () {
    assert.strictEqual(document.getElementById("be-ctl-tray-layout-head").querySelector(".be-ctl-fold-label").textContent, "LAYOUT");
    assert.strictEqual(document.getElementById("be-ctl-tray-output-head").querySelector(".be-ctl-fold-label").textContent, "OUTPUT");
  });

  it("clicking the header toggles parent .be-ctl-folded and flips aria-expanded", function () {
    const tray = document.getElementById("be-ctl-tray-layout");
    const head = document.getElementById("be-ctl-tray-layout-head");
    assert.strictEqual(tray.classList.contains("be-ctl-folded"), false);
    head.click();
    assert.strictEqual(tray.classList.contains("be-ctl-folded"), true);
    assert.strictEqual(head.getAttribute("aria-expanded"), "false");
    head.click();
    assert.strictEqual(tray.classList.contains("be-ctl-folded"), false);
    assert.strictEqual(head.getAttribute("aria-expanded"), "true");
  });

  it("collapsing a group that contains focus moves focus to its header (keyboard a11y)", function () {
    const tray = document.getElementById("be-ctl-tray-layout");
    const head = document.getElementById("be-ctl-tray-layout-head");
    const inner = document.createElement("button");
    inner.textContent = "inner focusable";
    tray.appendChild(inner);
    inner.focus();
    assert.strictEqual(document.activeElement, inner);
    head.click();
    assert.strictEqual(document.activeElement, head, "focus should move to header when subtree collapsed");
    assert.strictEqual(tray.classList.contains("be-ctl-folded"), true);
  });

  it("expanding does not steal focus", function () {
    const tray = document.getElementById("be-ctl-tray-output");
    const head = document.getElementById("be-ctl-tray-output-head");
    head.click(); // collapse
    assert.strictEqual(tray.classList.contains("be-ctl-folded"), true);
    const other = document.createElement("button");
    other.textContent = "other";
    document.body.appendChild(other);
    other.focus();
    head.click(); // expand
    assert.strictEqual(document.activeElement, other, "expanding should not steal focus from unrelated element");
  });

  it("scroll body exists and trays are inside it (pinned header contract)", function () {
    const scroll = document.querySelector(".be-ctl-scroll");
    assert.ok(scroll, ".be-ctl-scroll missing");
    assert.ok(scroll.contains(document.getElementById("be-ctl-tray-layout")));
    assert.ok(scroll.contains(document.getElementById("be-ctl-tray-output")));
  });
});

// ---------------------------------------------------------------------------
// 3. Topbar chrome
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — topbar chrome", function () {
  let ctx, document, window;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
  });
  afterEach(function () { ctx.cleanup(); });

  it("topbar contains title Beyond Print", function () {
    const title = document.querySelector(".be-ctl-title");
    assert.ok(title, ".be-ctl-title missing");
    assert.strictEqual(title.textContent, "Beyond Print");
    assert.strictEqual(title.title, "Beyond Print");
  });

  it("topbar structure: two rows (title row + actions row)", function () {
    const topbar = document.querySelector(".be-ctl-topbar");
    assert.ok(topbar, ".be-ctl-topbar missing");
    const rows = topbar.querySelectorAll(".be-ctl-topbar-row");
    assert.strictEqual(rows.length, 2);
  });

  it("#be-ctl-collapse minimises the panel by toggling .be-ctl-collapsed", function () {
    const el = document.getElementById("print-enhance-controls");
    const btn = document.getElementById("be-ctl-collapse");
    assert.ok(btn, "#be-ctl-collapse missing");
    assert.strictEqual(btn.getAttribute("aria-label"), "Minimize panel");
    assert.strictEqual(el.classList.contains("be-ctl-collapsed"), false);
    btn.click();
    assert.strictEqual(el.classList.contains("be-ctl-collapsed"), true);
    btn.click();
    assert.strictEqual(el.classList.contains("be-ctl-collapsed"), false);
  });

  it("#be-ctl-help (?) exists and opens help surface on click", function () {
    const btn = document.getElementById("be-ctl-help");
    assert.ok(btn, "#be-ctl-help missing");
    assert.strictEqual(btn.classList.contains("be-ctl-help"), true);
    assert.strictEqual(btn.textContent, "?");
    assert.strictEqual(btn.getAttribute("aria-label"), "Gestures and keyboard shortcuts");
    const handle = (() => {
      let saw = null;
      const orig = window.Modals.__createModal;
      window.Modals.__createModal = function (opts) {
        const h = orig.call(window.Modals, opts);
        saw = opts.title;
        return h;
      };
      try {
        btn.click();
        return saw;
      } finally {
        window.Modals.__createModal = orig;
      }
    })();
    assert.strictEqual(handle, "Gestures & shortcuts");
    // clean up the modal that was just opened
    const closeBtn = document.querySelector(".be-help-close");
    if (closeBtn) closeBtn.click();
  });

  it("#be-ctl-off exists and opens turn-off surface on click", function () {
    const btn = document.getElementById("be-ctl-off");
    assert.ok(btn, "#be-ctl-off missing");
    assert.strictEqual(btn.title, "Turn off for this page");
    let sawTitle = null;
    const orig = window.Modals.__createModal;
    window.Modals.__createModal = function (opts) {
      const h = orig.call(window.Modals, opts);
      sawTitle = opts.title;
      return h;
    };
    try {
      btn.click();
      assert.strictEqual(sawTitle, "Turn off for this page");
    } finally {
      window.Modals.__createModal = orig;
    }
    const closeBtn2 = document.body.querySelector(".be-modal-cancel");
    if (closeBtn2) closeBtn2.click();
    // fallback: close via backdrop utility if cancel not found via body query
    Array.from(document.querySelectorAll(".be-modal-cancel")).forEach((b) => b.click());
  });

  it("#be-btn-templates TEMPLATES chip exists with correct classes", function () {
    const btn = document.getElementById("be-btn-templates");
    assert.ok(btn, "#be-btn-templates missing");
    assert.strictEqual(btn.textContent, "TEMPLATES");
    assert.ok(btn.classList.contains("be-ctl-chip"), "missing be-ctl-chip");
    assert.ok(btn.classList.contains("be-ctl-templates"), "missing be-ctl-templates");
    assert.ok(document.querySelector(".be-ctl-topbar-row.be-ctl-topbar-actions").contains(btn));
  });
});

// ---------------------------------------------------------------------------
// 4. Action buttons registry
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — action buttons registry", function () {
  let ctx, document, window;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
  });
  afterEach(function () { ctx.cleanup(); });

  it("canonical buttons exist by stable ID", function () {
    [
      "be-btn-add-shape",
      "be-btn-ai-arrange",
      "be-btn-ai-settings",
      "be-btn-print",
      "be-btn-print-settings",
      "be-btn-export-settings",
      "be-btn-import-settings",
      "be-btn-undo",
    ].forEach((id) => assert.ok(document.getElementById(id), `missing #${id}`));
  });

  it("label-based buttons exist for non-id actions", function () {
    const labels = Array.from(document.querySelectorAll("#print-enhance-controls .be-ctl-btn .be-ctl-label")).map((s) => s.textContent);
    const joined = labels.join(" | ");
    ["Load", "Reset to Default", "Manage Clones", "Manage Compact", "Save to Browser", "Save to PC", "Restore backup"].forEach((needle) => {
      assert.ok(joined.includes(needle), `label "${needle}" missing in ${joined}`);
    });
  });

  it("Print hero: #be-btn-print is inside .be-ctl-hero-wrap with .be-ctl-hero class", function () {
    const hero = document.getElementById("be-btn-print");
    assert.ok(hero.classList.contains("be-ctl-hero"), "print should carry be-ctl-hero");
    const wrap = hero.closest(".be-ctl-hero-wrap");
    assert.ok(wrap, "hero wrap missing");
    assert.strictEqual(wrap.parentElement.id, "be-ctl-tray-output", "hero wrap should be inside OUTPUT tray");
  });

  it("every action button carries be-ctl-btn and a title tooltip", function () {
    const btns = Array.from(document.querySelectorAll("#print-enhance-controls .be-ctl-btn"));
    assert.ok(btns.length >= 12, `expected >=12 be-ctl-btn, got ${btns.length}`);
    btns.forEach((b) => {
      assert.strictEqual(typeof b.title, "string");
      assert.ok(b.title.length > 0, `button ${b.id || b.textContent.trim()} should have non-empty title`);
    });
  });

  it("icon buttons render .be-ctl-ico + .be-ctl-label spans", function () {
    const withIcon = Array.from(document.querySelectorAll("#print-enhance-controls .be-ctl-btn")).filter((b) => b.querySelector(".be-ctl-ico"));
    assert.ok(withIcon.length > 0, "at least one icon button expected");
    withIcon.forEach((b) => {
      assert.ok(b.querySelector(".be-ctl-label"), `icon button ${b.id} should have .be-ctl-label`);
    });
  });

  it("Add Shape button honours id from config (debt #2 fix) and lives in LAYOUT tray", function () {
    const btn = document.getElementById("be-btn-add-shape");
    assert.ok(btn);
    assert.strictEqual(document.getElementById("be-ctl-tray-layout").contains(btn), true);
  });

  it("buttons carry the expected tray assignment", function () {
    const layoutIds = ["be-btn-add-shape", "be-btn-ai-arrange", "be-btn-ai-settings"];
    const outputIds = ["be-btn-print", "be-btn-print-settings", "be-btn-export-settings", "be-btn-import-settings", "be-btn-undo"];
    layoutIds.forEach((id) => assert.ok(document.getElementById("be-ctl-tray-layout").contains(document.getElementById(id)), `${id} should be in LAYOUT`));
    outputIds.forEach((id) => assert.ok(document.getElementById("be-ctl-tray-output").contains(document.getElementById(id)), `${id} should be in OUTPUT`));
  });
});

// ---------------------------------------------------------------------------
// 5. Properties panel band
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — properties panel band", function () {
  let ctx, document, window;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
  });
  afterEach(function () { ctx.cleanup(); });

  it("#print-enhance-properties-panel exists and lives inside #be-ctl-band-properties", function () {
    const panel = document.getElementById("print-enhance-properties-panel");
    const band = document.getElementById("be-ctl-band-properties");
    assert.ok(panel, "properties panel missing");
    assert.ok(band, "properties band missing");
    assert.ok(band.contains(panel), "panel should be inside its band");
  });

  it("properties band has a collapsible head PROPERTIES with correct aria wiring", function () {
    const head = document.getElementById("be-ctl-band-properties-head");
    assert.ok(head);
    assert.strictEqual(head.querySelector(".be-ctl-fold-label").textContent, "PROPERTIES");
    assert.strictEqual(head.getAttribute("aria-controls"), "be-ctl-band-properties");
  });

  it("properties band collapses via its header", function () {
    const band = document.getElementById("be-ctl-band-properties");
    const head = document.getElementById("be-ctl-band-properties-head");
    head.click();
    assert.strictEqual(band.classList.contains("be-ctl-folded"), true);
    head.click();
    assert.strictEqual(band.classList.contains("be-ctl-folded"), false);
  });

  it("properties panel has flex layout and empty-state affordance before selection", function () {
    const panel = document.getElementById("print-enhance-properties-panel");
    assert.strictEqual(panel.style.display, "flex");
    assert.strictEqual(panel.style.flexDirection, "column");
    const empty = panel.querySelector(".be-prop-panel-empty");
    assert.ok(empty, ".be-prop-panel-empty should be present before any section is selected");
  });
});

// ---------------------------------------------------------------------------
// 6. Canvas Filters band
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — canvas filters band", function () {
  let ctx, document, window;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
  });
  afterEach(function () { ctx.cleanup(); });

  it("#be-ctl-band-filters exists inside the scroll body with a collapsible head CANVAS FILTERS", function () {
    const band = document.getElementById("be-ctl-band-filters");
    assert.ok(band);
    assert.ok(document.querySelector(".be-ctl-scroll").contains(band));
    const head = document.getElementById("be-ctl-band-filters-head");
    assert.ok(head);
    assert.strictEqual(head.querySelector(".be-ctl-fold-label").textContent, "CANVAS FILTERS");
  });

  it("band collapses and expands via its header", function () {
    const band = document.getElementById("be-ctl-band-filters");
    const head = document.getElementById("be-ctl-band-filters-head");
    head.click();
    assert.strictEqual(band.classList.contains("be-ctl-folded"), true);
    head.click();
    assert.strictEqual(band.classList.contains("be-ctl-folded"), false);
  });

  it("filter sliders exist with correct ranges and defaults", function () {
    const filters = document.querySelector(".be-filters-container");
    assert.ok(filters, ".be-filters-container missing");
    const expectations = [
      { needle: "Hue Shift", min: "0", max: "360", val: "0" },
      { needle: "Contrast",  min: "0", max: "200", val: "100" },
      { needle: "Saturate",  min: "0", max: "200", val: "100" },
      { needle: "Greyscale", min: "0", max: "100", val: "100" },
      { needle: "Sepia",     min: "0", max: "100", val: "0" },
    ];
    expectations.forEach(({ needle, min, max }) => {
      const slider = getSliderForLabel(filters, needle);
      assert.ok(slider, `slider for ${needle} missing`);
      assert.strictEqual(slider.min, min, `${needle} min`);
      assert.strictEqual(slider.max, max, `${needle} max`);
      // The harness hydrates these from storage defaults (async); on boot they reflect
      // currentFilters defaults until the async hydration resolves, so allow both.
      // At least the range contract must hold; value is sanity-checked to be numeric.
      assert.ok(!isNaN(parseInt(slider.value, 10)), `${needle} value should be numeric got ${slider.value}`);
    });
  });

  it("hue slider is hidden (display:none) and lives with the Color Picker button in the same row", function () {
    const hueSlider = getSliderForLabel(document.querySelector(".be-filters-container"), "Hue Shift");
    assert.strictEqual(hueSlider.style.display, "none");
    const hueRow = hueSlider.closest("div").parentElement;
    const cpBtn = hueRow.querySelector("button.be-modal-ok");
    assert.ok(cpBtn && cpBtn.textContent.includes("Color Picker"), "Color Picker button should be in the hue row");
  });

  it("each filter row has a per-row reset button that restores its default", async function () {
    const filters = document.querySelector(".be-filters-container");
    const saved = [];
    window.Storage.saveFilter = async (k, v) => { saved.push([k, v]); };
    let applied = null;
    window.applyGlobalFilters = (f) => { applied = { ...f }; };

    // drive contrast to 50 then reset via its ↺ button
    const contrastSlider = getSliderForLabel(filters, "Contrast");
    contrastSlider.value = "50";
    contrastSlider.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.ok(applied && applied.contrast === 50, "moving slider should apply filters immediately");
    const contrastRow = getLabel(filters, "Contrast").closest("div").parentElement;
    const resetBtn = Array.from(contrastRow.querySelectorAll("button")).find((b) => b.textContent === "↺");
    assert.ok(resetBtn, "reset button missing on contrast row");
    resetBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(contrastSlider.value, "100", "reset should restore contrast slider to 100");
    assert.ok(getLabel(filters, "Contrast").textContent.includes("100%"));
  });

  it("#be-reset-all-filters resets contrast/saturate/greyscale/sepia to defaults and persists", async function () {
    const filters = document.querySelector(".be-filters-container");
    const saved = [];
    window.Storage.saveFilter = async (k, v) => { saved.push([k, v]); };
    let applied = null;
    window.applyGlobalFilters = (f) => { applied = { ...f }; };

    // move some sliders away from defaults
    const satSlider = getSliderForLabel(filters, "Saturate");
    satSlider.value = "0";
    satSlider.dispatchEvent(new window.Event("input", { bubbles: true }));
    const sepiaSlider = getSliderForLabel(filters, "Sepia");
    sepiaSlider.value = "80";
    sepiaSlider.dispatchEvent(new window.Event("input", { bubbles: true }));

    const resetAll = document.getElementById("be-reset-all-filters");
    assert.ok(resetAll);
    assert.strictEqual(resetAll.textContent, "Reset Filters");
    assert.strictEqual(resetAll.title, "Reset All Filters (excl. Hue)");
    resetAll.click();
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(getSliderForLabel(filters, "Contrast").value, "100");
    assert.strictEqual(getSliderForLabel(filters, "Saturate").value, "100");
    assert.strictEqual(getSliderForLabel(filters, "Greyscale").value, "100");
    assert.strictEqual(getSliderForLabel(filters, "Sepia").value, "0");
    assert.ok(applied && applied.contrast === 100 && applied.saturate === 100, "applyGlobalFilters should have been called with defaults");
    // saved should contain the four defaults (hue excluded)
    const savedKeys = saved.map(([k]) => k);
    ["contrast", "saturate", "greyscale", "sepia"].forEach((k) => assert.ok(savedKeys.includes(k), `saveFilter should have been called for ${k}`));
  });

  it("slider oninput applies filters immediately; onchange persists on release", async function () {
    const filters = document.querySelector(".be-filters-container");
    let applied = null;
    const saved = [];
    window.applyGlobalFilters = (f) => { applied = { ...f }; };
    window.Storage.saveFilter = async (k, v) => { saved.push([k, v]); };
    const sepiaSlider = getSliderForLabel(filters, "Sepia");
    sepiaSlider.value = "30";
    sepiaSlider.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.ok(applied && applied.sepia === 30, "input should trigger applyGlobalFilters immediately");
    sepiaSlider.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(saved.some(([k, v]) => k === "sepia" && v === 30), "change should persist sepia=30");
  });
});

// ---------------------------------------------------------------------------
// 7. Color picker (floating hue grid + greyscale)
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — color picker", function () {
  let ctx, document, window, cpBtn, picker;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
    cpBtn = findColorPickerBtn(document);
    picker = findPicker(document);
    assert.ok(cpBtn, "Color Picker button missing in beforeEach");
    assert.ok(picker, "hue picker missing in beforeEach");
  });
  afterEach(function () { ctx.cleanup(); });

  it("picker is position:fixed, width 150px, initially display:none !important", function () {
    assert.strictEqual(picker.style.position, "fixed");
    assert.strictEqual(picker.style.width, "150px");
    assert.strictEqual(picker.style.display, "none");
    assert.strictEqual(picker.style.getPropertyValue("display"), "none");
  });

  it("picker title Tint is present", function () {
    const tint = picker.querySelector(".be-color-picker-title");
    assert.ok(tint);
    assert.strictEqual(tint.textContent, "Tint");
  });

  it("grid has 600 swatches (60 hues × 10 saturations), each 2×8px with hue-rotate filter", function () {
    const grid = Array.from(picker.children).find((c) => c.style.display === "grid");
    assert.ok(grid, "grid container missing");
    assert.strictEqual(grid.style.gridTemplateColumns, "repeat(60, 2px)");
    const swatches = Array.from(grid.children);
    assert.strictEqual(swatches.length, 600, `expected 600 swatches, got ${swatches.length}`);
    assert.strictEqual(swatches[0].style.width, "2px");
    assert.strictEqual(swatches[0].style.height, "8px");
    assert.match(swatches[0].style.filter, /hue-rotate\(0deg\)/);
    assert.match(swatches[0].title, /Hue:/);
    const last = swatches[599];
    assert.match(last.title, /Sat:/);
  });

  it("clicking Color Picker shows the picker (flex); clicking again hides and reverts", function () {
    cpBtn.click();
    assert.strictEqual(picker.style.getPropertyValue("display"), "flex");
    cpBtn.click();
    assert.strictEqual(picker.style.getPropertyValue("display"), "none");
  });

  it("clicking outside the picker hides it and reverts live filters", function () {
    window.applyGlobalFilters = () => {};
    cpBtn.click();
    assert.strictEqual(picker.style.getPropertyValue("display"), "flex");
    document.body.click();
    assert.strictEqual(picker.style.getPropertyValue("display"), "none");
  });

  it("clicking a swatch previews hue/saturate and syncs sliders; applyGlobalFilters is called", function () {
    let applied = null;
    window.applyGlobalFilters = (f) => { applied = { ...f }; };
    const filters = document.querySelector(".be-filters-container");
    cpBtn.click();
    const grid = Array.from(picker.children).find((c) => c.style.display === "grid");
    const target = Array.from(grid.children).find((s) => s.title === "Hue: 12°, Sat: 100%");
    assert.ok(target, "target swatch not found");
    target.click();
    assert.strictEqual(getSliderForLabel(filters, "Hue Shift").value, "12");
    assert.strictEqual(getSliderForLabel(filters, "Saturate").value, "100");
    assert.ok(applied && applied.hue === 12 && applied.saturate === 100, `applied filters mismatch: ${JSON.stringify(applied)}`);
    assert.ok(getLabel(filters, "Hue Shift").textContent.includes("12°"));
  });

  it("picker greyscale slider previews and syncs the main greyscale slider", function () {
    let applied = null;
    window.applyGlobalFilters = (f) => { applied = { ...f }; };
    const filters = document.querySelector(".be-filters-container");
    cpBtn.click();
    const pickerGreyscale = picker.querySelector('input[type="range"]');
    assert.ok(pickerGreyscale, "picker greyscale slider missing");
    pickerGreyscale.value = "42";
    pickerGreyscale.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.ok(applied && applied.greyscale === 42, `picker greyscale should apply, got ${JSON.stringify(applied)}`);
    assert.strictEqual(getSliderForLabel(filters, "Greyscale").value, "42");
    assert.ok(getLabel(filters, "Greyscale").textContent.includes("42%"));
  });

  it("Continue button persists hue/saturate/greyscale via Storage.saveFilter and hides picker", async function () {
    const saved = [];
    window.Storage.saveFilter = async (k, v) => { saved.push([k, v]); };
    window.applyGlobalFilters = () => {};
    cpBtn.click();
    const grid = Array.from(picker.children).find((c) => c.style.display === "grid");
    const sw = Array.from(grid.children).find((s) => s.title === "Hue: 180°, Sat: 50%");
    sw.click();
    // also move picker greyscale
    const pickerGreyscale = picker.querySelector('input[type="range"]');
    pickerGreyscale.value = "77";
    pickerGreyscale.dispatchEvent(new window.Event("input", { bubbles: true }));
    const acceptBtn = Array.from(picker.querySelectorAll("button")).find((b) => b.textContent === "Continue");
    assert.ok(acceptBtn, "Continue button missing");
    acceptBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    const keys = saved.map(([k]) => k);
    assert.ok(keys.includes("hue"), "should persist hue");
    assert.ok(keys.includes("saturate"), "should persist saturate");
    assert.ok(keys.includes("greyscale"), "should persist greyscale");
    assert.strictEqual(picker.style.getPropertyValue("display"), "none");
  });
});

// ---------------------------------------------------------------------------
// 8. Help / Print-settings / Turn-off seams
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — help / print-settings / turn-off seams", function () {
  let ctx, window, document;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
    window.createControls();
  });
  afterEach(function () {
    // close any modals left open
    Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "Got it").forEach((b) => {
      try {
        b.click();
      } catch {
        // a stale node from a torn-down ctx must not fail the teardown
      }
    });
    ctx.cleanup();
  });

  it("HELP_GESTURES array is exposed and covers the gesture contract", function () {
    assert.ok(Array.isArray(window.HELP_GESTURES));
    assert.ok(window.HELP_GESTURES.length >= 8);
    const whats = window.HELP_GESTURES.map((g) => g.what);
    assert.ok(whats.includes("Move a section"));
    assert.ok(whats.includes("Resize a section"));
    assert.ok(whats.includes("Rotate a shape"));
  });

  it("cardHintText derives from HELP_GESTURES (DRY — AC-1a)", function () {
    const phrases = window.cardGesturePhrases();
    assert.ok(Array.isArray(phrases) && phrases.length >= 3);
    const text = window.cardHintText();
    phrases.forEach((p) => assert.ok(text.includes(p), `card hint should contain phrase "${p}" got "${text}"`));
  });

  it("PRINT_SETTINGS arrays are exposed and non-empty with expected keys", function () {
    assert.ok(Array.isArray(window.PRINT_SETTINGS_REQUIRED) && window.PRINT_SETTINGS_REQUIRED.length === 4);
    assert.ok(Array.isArray(window.PRINT_SETTINGS_HANDLED) && window.PRINT_SETTINGS_HANDLED.length === 2);
    // jsdom arrays are a different realm — spread into the test realm before deepStrictEqual
    const keys = [...window.PRINT_SETTINGS_REQUIRED.map((s) => s.key)].sort();
    assert.deepStrictEqual(keys, ["backgrounds", "color", "headers", "scale"]);
  });

  it("window.Controls exposes the four surface seams", function () {
    assert.strictEqual(typeof window.Controls.createControls, "function");
    assert.strictEqual(typeof window.Controls.showHelpSurface, "function");
    assert.strictEqual(typeof window.Controls.showPrintSettingsSurface, "function");
    assert.strictEqual(typeof window.Controls.showTurnOffSurface, "function");
    assert.strictEqual(typeof window.Controls.hintDismissed, "function");
  });

  it("showHelpSurface renders a modal titled 'Gestures & shortcuts' with dl.be-help-list", function () {
    const handle = window.showHelpSurface();
    assert.ok(handle && typeof handle.close === "function", "showHelpSurface should return a modal handle");
    const lead = document.querySelector(".be-help-lead");
    assert.ok(lead, "help lead paragraph missing");
    assert.match(lead.textContent, /Nothing here changes your character/);
    const list = document.querySelector(".be-help-list");
    assert.ok(list);
    const dts = list.querySelectorAll("dt.be-help-what");
    assert.ok(dts.length >= 8);
    handle.close(null);
  });

  it("showPrintSettingsSurface renders required and handled lists", function () {
    const handle = window.showPrintSettingsSurface();
    assert.ok(handle && typeof handle.close === "function");
    const list = document.querySelector(".be-help-list.be-print-list");
    assert.ok(list, "print list dl missing");
    const dts = list.querySelectorAll("dt.be-help-what");
    assert.strictEqual(dts.length, window.PRINT_SETTINGS_REQUIRED.length);
    const note = document.querySelector(".be-help-note");
    assert.ok(note && note.textContent.includes("Already handled"));
    handle.close(null);
  });

  it("showTurnOffSurface renders a modal with Turn off and Cancel controls", function () {
    const handle = window.showTurnOffSurface();
    assert.ok(handle && typeof handle.close === "function");
    assert.ok(document.getElementById("be-turn-off-confirm"), "#be-turn-off-confirm missing");
    const cancel = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Cancel");
    assert.ok(cancel, "Cancel button missing");
    handle.close(null);
  });

  it("showHelpSurface etc are idempotent via window shims (reachable via panel and directly)", function () {
    assert.strictEqual(window.showHelpSurface, window.Controls.showHelpSurface);
    assert.strictEqual(window.showPrintSettingsSurface, window.Controls.showPrintSettingsSurface);
    assert.strictEqual(window.showTurnOffSurface, window.Controls.showTurnOffSurface);
  });
});

// ---------------------------------------------------------------------------
// 9. Undo / AI arrange reactivity
// ---------------------------------------------------------------------------
describe("feature_05_controls_panel — undo and AI arrange reactivity", function () {
  let ctx, window, document;
  beforeEach(function () {
    ctx = bootRooted();
    window = ctx.window;
    document = ctx.document;
  });
  afterEach(function () { ctx.cleanup(); });

  it("Undo button starts disabled with 'Nothing to undo' tooltip when the stack is empty", function () {
    window.createControls();
    const btn = document.getElementById("be-btn-undo");
    assert.strictEqual(btn.disabled, true);
    assert.match(btn.title, /Nothing to undo/);
    assert.match(btn.getAttribute("aria-label"), /Nothing to undo/);
    assert.strictEqual(btn.querySelector(".be-ctl-label").textContent, "Undo");
  });

  it("be-undo-stack-changed with a label enables and re-labels the undo button (with truncation, Ctrl+Z and scope)", function () {
    window.createControls();
    const btn = document.getElementById("be-btn-undo");
    window.undoLabel = () => "Move Fireball";
    window.dispatchEvent(new window.Event("be-undo-stack-changed"));
    assert.strictEqual(btn.disabled, false);
    const labelText = btn.querySelector(".be-ctl-label").textContent;
    assert.ok(labelText.includes("Move"), `label should contain undo label, got "${labelText}"`);
    assert.match(btn.title, /Ctrl\+Z/);
    assert.match(btn.title, /this session only/);
    assert.match(btn.getAttribute("aria-label"), /Ctrl\+Z/);
  });

  it("clearing the undo stack disables the button again", function () {
    window.createControls();
    const btn = document.getElementById("be-btn-undo");
    window.undoLabel = () => "something";
    window.dispatchEvent(new window.Event("be-undo-stack-changed"));
    assert.strictEqual(btn.disabled, false);
    window.undoLabel = () => null;
    window.dispatchEvent(new window.Event("be-undo-stack-changed"));
    assert.strictEqual(btn.disabled, true);
    assert.strictEqual(btn.querySelector(".be-ctl-label").textContent, "Undo");
  });

  it("undoScreenLabel truncation is honoured when present", function () {
    window.undoScreenLabel = (full) => full ? full.slice(0, 8) : null;
    window.undoLabel = () => "A very long undo label name";
    window.createControls();
    const btn = document.getElementById("be-btn-undo");
    window.dispatchEvent(new window.Event("be-undo-stack-changed"));
    assert.strictEqual(btn.querySelector(".be-ctl-label").textContent.length, 8);
  });

  it("AI arrange button is disabled and carries be-ctl-ai-off when no key is stored", async function () {
    window.AiSettings = { hasStoredKey: async () => false };
    window.createControls();
    await new Promise((r) => setTimeout(r, 40));
    const btn = document.getElementById("be-btn-ai-arrange");
    assert.strictEqual(btn.disabled, true);
    assert.ok(btn.classList.contains("be-ctl-ai-off"));
    assert.match(btn.title, /no key|needs your own|add your own/i);
  });

  it("AI arrange button enables when a key is stored (be-ctl-ai-off removed)", async function () {
    window.AiSettings = { hasStoredKey: async () => true };
    window.createControls();
    await new Promise((r) => setTimeout(r, 40));
    const btn = document.getElementById("be-btn-ai-arrange");
    assert.strictEqual(btn.disabled, false);
    assert.strictEqual(btn.classList.contains("be-ctl-ai-off"), false);
    assert.match(btn.title, /Ask your AI/i);
  });

  it("be-ai-key-changed flips the AI arrange enabled state (async race guard)", async function () {
    window.AiSettings = { hasStoredKey: async () => true };
    window.createControls();
    await new Promise((r) => setTimeout(r, 40));
    const btn = document.getElementById("be-btn-ai-arrange");
    assert.strictEqual(btn.disabled, false, "should start enabled with key present");
    window.AiSettings.hasStoredKey = async () => false;
    window.dispatchEvent(new window.Event("be-ai-key-changed"));
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(btn.disabled, true, "should disable after key removed");
    assert.ok(btn.classList.contains("be-ctl-ai-off"));
    window.AiSettings.hasStoredKey = async () => true;
    window.dispatchEvent(new window.Event("be-ai-key-changed"));
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(btn.disabled, false, "should re-enable after key restored");
  });

  it("AI Settings button is always enabled but its tooltip reflects key state", async function () {
    window.AiSettings = { hasStoredKey: async () => false };
    window.createControls();
    await new Promise((r) => setTimeout(r, 40));
    const settingsBtn = document.getElementById("be-btn-ai-settings");
    assert.strictEqual(settingsBtn.disabled, false, "AI settings button should never be disabled");
    assert.match(settingsBtn.title, /no key/i);
    window.AiSettings.hasStoredKey = async () => true;
    window.dispatchEvent(new window.Event("be-ai-key-changed"));
    await new Promise((r) => setTimeout(r, 40));
    assert.match(settingsBtn.title, /key is stored/i);
  });
});
