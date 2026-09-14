/**
 * E7 — Encapsulation-debt regression suite (2026-03-18).
 *   5a19a8d Color picker (#23)
 *   a4e98e1 Extension compression 14MB -> 2MB, WebP migration (#24)
 * Complementary to composite_filters/filters_ui/hue_* and
 * shape picker suites.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

/* ------------------------------------------------------------------ */
/* 5a19a8d — Color picker (applyGlobalFilters CSS-variable contract)   */
/* ------------------------------------------------------------------ */
describe("E7 5a19a8d — global filter CSS variables", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><head></head><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function apply() {
    window.applyGlobalFilters({ hue: 90, contrast: 120, greyscale: 20, saturate: 80, sepia: 10 });
    return document.documentElement;
  }

  it("composes the full filter with all five components", function () {
    const root = apply();
    const full = root.style.getPropertyValue("--be-full-filter");
    assert.ok(full.includes("hue-rotate(90deg)"), full);
    assert.ok(full.includes("contrast(120%)"), full);
    assert.ok(full.includes("saturate(80%)"), full);
    assert.ok(full.includes("grayscale(20%)"), full);
    assert.ok(full.includes("sepia(10%)"), full);
  });

  it("keeps hue-rotate out of the decoration-only filter", function () {
    const root = apply();
    const deco = root.style.getPropertyValue("--be-decoration-filter");
    assert.ok(!deco.includes("hue-rotate"), deco);
    assert.ok(deco.includes("contrast(120%)"), deco);
    assert.ok(deco.includes("sepia(10%)"), deco);
  });

  it("pairs the container hue filter with its inverse", function () {
    const root = apply();
    assert.strictEqual(root.style.getPropertyValue("--be-hue-filter").trim(), "hue-rotate(90deg)");
    assert.strictEqual(root.style.getPropertyValue("--be-inv-hue-filter").trim(), "hue-rotate(-90deg)");
  });

  it("reuses a single injected #be-global-filters-style block", function () {
    apply();
    apply();
    const styles = document.querySelectorAll("#be-global-filters-style");
    assert.strictEqual(styles.length, 1);
  });

  it("never applies filters to the control panel", function () {
    apply();
    const css = document.getElementById("be-global-filters-style").textContent;
    assert.ok(css.includes("#print-enhance-controls"));
    assert.ok(css.includes("filter: none !important"));
  });
});

/* ------------------------------------------------------------------ */
/* a4e98e1 — Compression / WebP migration (asset catalog + picker)     */
/* ------------------------------------------------------------------ */
describe("E7 a4e98e1 — webp-only shape catalog in the picker", function () {
  let window, document, cleanup;

  function stubLm() {
    window.PeDom = () => ({
      getLayerManager: () => ({
        activeLayerId: "shapes-default",
        refreshUI: () => {},
        getActiveLayerContainer: () => ({ element: document.body }),
      }),
    });
  }

  beforeEach(function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    stubLm();
  });
  afterEach(function () {
    cleanup();
  });

  async function openPicker(filterFolder) {
    const p = window.showShapePickerModal("", filterFolder);
    p.catch(() => {});
    await new Promise((r) => setTimeout(r, 150)); // let sync render happen
  }

  it("renders only .webp border assets when filtering borders", async function () {
    await openPicker("assets/");
    const opts = Array.from(document.querySelectorAll(".be-border-option"));
    assert.ok(opts.length > 0, "border options should exist");
    const nonWebp = opts.filter((o) => {
      const bg = o.querySelector(".be-border-preview");
      const url = bg && (bg.style.borderImageSource || bg.style.backgroundImage);
      return url && url.includes(".png");
    });
    assert.strictEqual(nonWebp.length, 0, "no png assets should remain in the catalog");
  });

  it("defaults to the Shapes tab when filtered to assets/shapes/", async function () {
    await openPicker("assets/shapes/");
    const shapeTab = Array.from(document.querySelectorAll(".be-modal-tab")).find(
      (t) => t.textContent === "Shapes",
    );
    assert.ok(shapeTab.classList.contains("active"));
    const opts = Array.from(document.querySelectorAll(".be-border-option"));
    assert.ok(opts.length > 0);
    opts.forEach((o) => {
      assert.ok(o.querySelector(".be-border-preview"), "each option has a preview");
    });
  });

  it("shows the Border tab for unfiltered opens", async function () {
    await openPicker("");
    const tabs = Array.from(document.querySelectorAll(".be-modal-tab"));
    const borderTab = tabs.find((t) => t.textContent === "Borders");
    assert.ok(borderTab.classList.contains("active"));
    const opts = Array.from(document.querySelectorAll(".be-border-option"));
    assert.ok(opts.length > 0);
  });

  it("marks the currently selected asset option", async function () {
    const current = "assets/border_default.webp";
    const p = window.showShapePickerModal(current, "assets/");
    await new Promise((r) => setTimeout(r, 120));
    const selected = document.querySelector(".be-border-option.selected");
    assert.ok(selected, "an option should be preselected for the current asset");
    p.then(() => {});
    document.querySelector(".be-modal-overlay")?.remove();
  });

  it("exposes the Upload-from-disk flow on the Custom tab", async function () {
    const p = window.showShapePickerModal();
    await new Promise((r) => setTimeout(r, 120));
    const customTab = Array.from(document.querySelectorAll(".be-modal-tab")).find(
      (t) => t.textContent === "Custom",
    );
    customTab.click();
    await new Promise((r) => setTimeout(r, 120));
    const buttons = Array.from(document.querySelectorAll("button"));
    assert.ok(buttons.some((b) => b.textContent === "Upload from disk"));
    const help = Array.from(document.querySelectorAll("div")).some((d) =>
      d.textContent.includes("Large files will be compressed."),
    );
    assert.ok(help, "help text advertises compression");
    p.then(() => {});
    document.querySelector(".be-modal-overlay")?.remove();
  });
});
