"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const FILTERS_SRC = fs.readFileSync(path.join(ROOT, "js/filters.js"), "utf8");
const ICONS_SRC = fs.readFileSync(path.join(ROOT, "js/icons.js"), "utf8");

const VARS = [
  "--be-full-filter",
  "--be-decoration-filter",
  "--be-hue-filter",
  "--be-inv-hue-filter",
];

function createDom(html) {
  const dom = new JSDOM(
    html || "<!DOCTYPE html><html><head></head><body></body></html>",
    {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously",
    }
  );
  const { window } = dom;
  const { document } = window;
  return { dom, window, document };
}

function loadFilters(window) {
  window.eval(FILTERS_SRC);
  assert.ok(
    window.Filters && typeof window.Filters.applyGlobalFilters === "function",
    "js/filters.js must publish window.Filters"
  );
}

function loadIcons(window) {
  window.eval(ICONS_SRC);
  assert.ok(
    window.Icons && typeof window.Icons.svg === "function",
    "js/icons.js must publish window.Icons"
  );
}

function varsFor(window, filters) {
  window.Filters.applyGlobalFilters(filters);
  const style = window.document.documentElement.style;
  return Object.fromEntries(VARS.map((v) => [v, style.getPropertyValue(v)]));
}

function cssFor(window, filters) {
  if (filters) window.Filters.applyGlobalFilters(filters);
  const el = window.document.getElementById("be-global-filters-style");
  return el ? el.textContent : "";
}

// ---------------------------------------------------------------------------
// Filters — applyGlobalFilters
// ---------------------------------------------------------------------------
describe("Filters — applyGlobalFilters (js/filters.js)", function () {
  let dom;
  let window;

  before(function () {
    const ctx = createDom();
    dom = ctx.dom;
    window = ctx.window;
    loadFilters(window);
    loadIcons(window);
  });

  after(function () {
    if (dom) dom.window.close();
  });

  describe("identity chain collapse (anti-rasterisation)", function () {
    it("all-neutral identity: all four chains are none", function () {
      const vars = varsFor(window, {
        hue: 0,
        contrast: 100,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      for (const v of VARS) {
        assert.strictEqual(vars[v], "none", `${v} must be none at identity`);
      }
    });

    it("product DEFAULT greyscale 100 is NOT neutral — ornaments stay grey", function () {
      const vars = varsFor(window, {
        hue: 0,
        contrast: 100,
        saturate: 100,
        greyscale: 100,
        sepia: 0,
      });
      assert.strictEqual(vars["--be-hue-filter"], "none");
      assert.strictEqual(vars["--be-inv-hue-filter"], "none");
      assert.ok(
        vars["--be-decoration-filter"].includes("grayscale(100%)"),
        `decoration must still carry grayscale(100%) got ${vars["--be-decoration-filter"]}`
      );
      assert.ok(
        vars["--be-full-filter"].includes("grayscale(100%)"),
        `full must still carry grayscale(100%) got ${vars["--be-full-filter"]}`
      );
      assert.strictEqual(
        vars["--be-decoration-filter"],
        "contrast(100%) saturate(100%) grayscale(100%) sepia(0%)"
      );
    });

    it("per-chain decision: hue identity + user decoration — hue collapses, decoration survives", function () {
      const vars = varsFor(window, {
        hue: 0,
        contrast: 150,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.strictEqual(vars["--be-hue-filter"], "none");
      assert.strictEqual(vars["--be-inv-hue-filter"], "none");
      assert.ok(vars["--be-decoration-filter"].includes("contrast(150%)"));
      assert.ok(vars["--be-full-filter"].includes("contrast(150%)"));
    });

    it("per-chain decision: real hue + identity decoration — decoration collapses, hue emitted", function () {
      const vars = varsFor(window, {
        hue: 90,
        contrast: 100,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.strictEqual(vars["--be-decoration-filter"], "none");
      assert.strictEqual(vars["--be-hue-filter"], "hue-rotate(90deg)");
      assert.strictEqual(vars["--be-inv-hue-filter"], "hue-rotate(-90deg)");
    });

    it("hue-rotate(360deg) is an identity (full slider range)", function () {
      const vars = varsFor(window, {
        hue: 360,
        contrast: 100,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.strictEqual(vars["--be-hue-filter"], "none");
      assert.strictEqual(vars["--be-inv-hue-filter"], "none");
      assert.strictEqual(vars["--be-full-filter"], "none");
    });

    it("hue 720 (2*360) is also identity", function () {
      const vars = varsFor(window, {
        hue: 720,
        contrast: 100,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.strictEqual(vars["--be-hue-filter"], "none");
    });

    it("non-zero hue not divisible by 360 is NOT identity", function () {
      const vars = varsFor(window, {
        hue: 1,
        contrast: 100,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.strictEqual(vars["--be-hue-filter"], "hue-rotate(1deg)");
    });
  });

  describe("verbatim emission for user settings", function () {
    it("user settings are emitted verbatim, not normalized", function () {
      const vars = varsFor(window, {
        hue: 90,
        contrast: 150,
        saturate: 120,
        greyscale: 50,
        sepia: 30,
      });
      assert.strictEqual(
        vars["--be-full-filter"],
        "hue-rotate(90deg) contrast(150%) saturate(120%) grayscale(50%) sepia(30%)"
      );
      assert.strictEqual(
        vars["--be-decoration-filter"],
        "contrast(150%) saturate(120%) grayscale(50%) sepia(30%)"
      );
      assert.strictEqual(vars["--be-hue-filter"], "hue-rotate(90deg)");
      assert.strictEqual(vars["--be-inv-hue-filter"], "hue-rotate(-90deg)");
    });

    it("numeric strings are treated as numbers for identity check but emitted verbatim", function () {
      const vars = varsFor(window, {
        hue: "0",
        contrast: "100",
        saturate: "100",
        greyscale: "0",
        sepia: "0",
      });
      for (const v of VARS) {
        assert.strictEqual(vars[v], "none", `${v} must collapse for numeric-string zeros`);
      }
    });
  });

  describe("unparseable / non-finite input never silently collapses", function () {
    it("non-numeric hue string keeps the chain (does not become none)", function () {
      const vars = varsFor(window, {
        hue: "abc",
        contrast: 100,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.notStrictEqual(vars["--be-hue-filter"], "none");
      assert.notStrictEqual(vars["--be-full-filter"], "none");
    });

    it("undefined / missing decoration value prevents collapse", function () {
      const vars = varsFor(window, {
        hue: 0,
        contrast: undefined,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.notStrictEqual(vars["--be-decoration-filter"], "none");
    });

    it("empty string, whitespace, null hue must not read as 0", function () {
      for (const empty of ["", "   ", null]) {
        const vars = varsFor(window, {
          hue: empty,
          contrast: 100,
          saturate: 100,
          greyscale: 0,
          sepia: 0,
        });
        assert.notStrictEqual(
          vars["--be-hue-filter"],
          "none",
          `hue=${JSON.stringify(empty)} must not collapse`
        );
        assert.notStrictEqual(vars["--be-inv-hue-filter"], "none");
      }
    });

    it("Infinity and NaN never collapse", function () {
      for (const v of [Infinity, -Infinity, NaN]) {
        const vars = varsFor(window, {
          hue: v,
          contrast: 100,
          saturate: 100,
          greyscale: 0,
          sepia: 0,
        });
        assert.notStrictEqual(vars["--be-hue-filter"], "none", `hue=${String(v)} must not collapse`);
      }
      const dec = varsFor(window, {
        hue: 0,
        contrast: NaN,
        saturate: 100,
        greyscale: 0,
        sepia: 0,
      });
      assert.notStrictEqual(dec["--be-decoration-filter"], "none");
    });
  });

  describe("style block creation and selectors", function () {
    it("creates #be-global-filters-style once and reuses it (idempotent)", function () {
      // fresh DOM for idempotency check
      const ctx = createDom();
      const w = ctx.window;
      loadFilters(w);
      w.Filters.applyGlobalFilters({
        hue: 10,
        contrast: 110,
        greyscale: 10,
        saturate: 110,
        sepia: 10,
      });
      let els = w.document.querySelectorAll("#be-global-filters-style");
      assert.strictEqual(els.length, 1, "first call must create exactly one style");
      const firstEl = els[0];
      w.Filters.applyGlobalFilters({
        hue: 20,
        contrast: 120,
        greyscale: 20,
        saturate: 120,
        sepia: 20,
      });
      els = w.document.querySelectorAll("#be-global-filters-style");
      assert.strictEqual(els.length, 1, "second call must not duplicate the style");
      assert.strictEqual(
        w.document.getElementById("be-global-filters-style"),
        firstEl,
        "same element must be reused"
      );
      ctx.dom.window.close();
    });

    it("style uses CSS variables and targets required selectors", function () {
      const css = cssFor(window, {
        hue: 90,
        contrast: 150,
        saturate: 120,
        greyscale: 50,
        sepia: 30,
      });
      // variable usage
      assert.ok(css.includes("var(--be-full-filter)"), "must use --be-full-filter");
      assert.ok(css.includes("var(--be-decoration-filter)"), "must use --be-decoration-filter");
      assert.ok(css.includes("var(--be-inv-hue-filter)"), "must use --be-inv-hue-filter");
      // selectors
      assert.ok(css.includes(".be-shape-container"), "must target .be-shape-container");
      assert.ok(css.includes("img.be-shape-asset"), "must target img.be-shape-asset");
      assert.ok(
        css.includes(".print-section-container .be-shape-container"),
        "must target nested shape container"
      );
      assert.ok(css.includes(".print-shape-container"), "must target .print-shape-container");
      assert.ok(css.includes(".print-section-container::before"), "must target border pseudo");
      assert.ok(css.includes(".be-focus-highlight"), "must target focus highlight");
      assert.ok(css.includes(".print-section-content"), "must target print-section-content");
      assert.ok(
        css.includes("img:not(.be-shape-asset)"),
        "must target non-shape images with :not"
      );
      assert.ok(css.includes("#print-enhance-controls"), "must exclude controls panel");
      assert.ok(css.includes(".be-drag-handle"), "must target drag handle");
      assert.ok(css.includes("filter: none !important"), "exclusions must be forced to none");
    });

    it("standalone vs nested shape filter separation", function () {
      const css = cssFor(window, {
        hue: 90,
        contrast: 100,
        saturate: 200,
        greyscale: 0,
        sepia: 0,
      });
      assert.ok(css.includes(".be-shape-container,"), "standalone rule must exist");
      assert.ok(css.includes("filter: var(--be-full-filter) !important"), "standalone must use full");
      assert.ok(
        css.includes(".print-section-container .be-shape-container"),
        "nested rule must exist"
      );
      // nested and ::before both use decoration
      const hasDecoration = css.includes("filter: var(--be-decoration-filter) !important");
      assert.ok(hasDecoration, "nested/border must use decoration filter");
    });

    it("anti-vacuity: four variables are set on :root and consumed in the sheet", function () {
      varsFor(window, { hue: 0, contrast: 100, saturate: 100, greyscale: 0, sepia: 0 });
      const styleEl = window.document.getElementById("be-global-filters-style");
      assert.ok(styleEl, "style must exist");
      const own = styleEl.textContent;
      for (const v of ["--be-full-filter", "--be-decoration-filter", "--be-inv-hue-filter"]) {
        assert.ok(own.includes(`var(${v})`), `sheet must consume var(${v})`);
      }
      // section containers hue filter is in print_styles.js, verify that file still wires it
      const printStyles = fs.readFileSync(path.join(ROOT, "js/print_styles.js"), "utf8");
      assert.ok(
        printStyles.includes("filter: var(--be-hue-filter)"),
        "print_styles.js must still read --be-hue-filter"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Filters — clearBorderStyles / applyBorderStyle
// ---------------------------------------------------------------------------
describe("Filters — border-style helpers", function () {
  let window;
  let document;
  let dom;

  before(function () {
    const ctx = createDom(
      "<!DOCTYPE html><html><head></head><body><div class=\"print-section-container\"></div></body></html>"
    );
    dom = ctx.dom;
    window = ctx.window;
    document = ctx.document;
    loadFilters(window);
  });

  after(function () {
    if (dom) dom.window.close();
  });

  function freshEl(className) {
    const el = document.createElement("div");
    el.className = className || "";
    return el;
  }

  describe("clearBorderStyles", function () {
    it("null/undefined guard — does not throw", function () {
      assert.doesNotThrow(function () {
        window.Filters.clearBorderStyles(null);
      });
      assert.doesNotThrow(function () {
        window.Filters.clearBorderStyles(undefined);
      });
      assert.doesNotThrow(function () {
        window.Filters.clearBorderStyles();
      });
    });

    it("removes ALL_BORDER_STYLES classes via window.AssetCatalog (and leaves others)", function () {
      window.AssetCatalog = {
        ALL_BORDER_STYLES: ["no-border", "spikes_border", "ability_border", "default-border"],
      };
      const el = freshEl("spikes_border ability_border keep-me");
      window.Filters.clearBorderStyles(el);
      assert.ok(!el.classList.contains("spikes_border"), "spikes_border must be removed");
      assert.ok(!el.classList.contains("ability_border"), "ability_border must be removed");
      assert.ok(el.classList.contains("keep-me"), "unrelated class must survive");
      delete window.AssetCatalog;
    });

    it("fallback when AssetCatalog absent — removes no-border", function () {
      delete window.AssetCatalog;
      const el = freshEl("no-border keep");
      window.Filters.clearBorderStyles(el);
      assert.ok(!el.classList.contains("no-border"), "no-border fallback must be removed");
      assert.ok(el.classList.contains("keep"));
    });

    it("without AiBorder: clears inline --border-* props and dataset.borderRawSvg", function () {
      delete window.AiBorder;
      const el = freshEl("spikes_border");
      el.style.setProperty("--border-img", "url(foo)");
      el.style.setProperty("--border-img-slice", "10");
      el.style.setProperty("--border-img-width", "5px");
      el.style.setProperty("--border-img-outset", "2px");
      el.dataset.borderRawSvg = "<svg></svg>";
      window.Filters.clearBorderStyles(el);
      assert.strictEqual(el.style.getPropertyValue("--border-img"), "");
      assert.strictEqual(el.style.getPropertyValue("--border-img-slice"), "");
      assert.strictEqual(el.style.getPropertyValue("--border-img-width"), "");
      assert.strictEqual(el.style.getPropertyValue("--border-img-outset"), "");
      assert.strictEqual(el.dataset.borderRawSvg, undefined);
    });

    it("with AiBorder.clearBorderSvg present: delegates and returns early", function () {
      let calledWith = null;
      window.AiBorder = {
        clearBorderSvg: function (el) {
          calledWith = el;
          el.dataset.proof = "ai-cleared";
        },
      };
      window.AssetCatalog = { ALL_BORDER_STYLES: ["spikes_border"] };
      const el = freshEl("spikes_border");
      // set a prop that the fallback WOULD clear — delegate path must not run fallback
      el.style.setProperty("--border-img", "url(delegate)");
      window.Filters.clearBorderStyles(el);
      assert.strictEqual(calledWith, el, "AiBorder.clearBorderSvg must be called with the element");
      assert.strictEqual(el.dataset.proof, "ai-cleared");
      // class removal still happens before delegation
      assert.ok(!el.classList.contains("spikes_border"));
      delete window.AiBorder;
      delete window.AssetCatalog;
    });
  });

  describe("applyBorderStyle", function () {
    it("null guards — does not throw for null section or style", function () {
      assert.doesNotThrow(function () {
        window.Filters.applyBorderStyle(null, "spikes_border");
      });
      assert.doesNotThrow(function () {
        window.Filters.applyBorderStyle(document.createElement("div"), null);
      });
      assert.doesNotThrow(function () {
        window.Filters.applyBorderStyle(null, null);
      });
    });

    it("string styleId: clears then adds the class", function () {
      window.AssetCatalog = { ALL_BORDER_STYLES: ["no-border", "spikes_border", "ability_border"] };
      const el = freshEl("ability_border");
      window.Filters.applyBorderStyle(el, "spikes_border");
      assert.ok(el.classList.contains("spikes_border"), "spikes_border must be added");
      assert.ok(!el.classList.contains("ability_border"), "previous border must be cleared");
      delete window.AssetCatalog;
    });

    it("object style {style: id}: extracts styleId", function () {
      window.AssetCatalog = { ALL_BORDER_STYLES: ["no-border", "spikes_border"] };
      const el = freshEl("");
      window.Filters.applyBorderStyle(el, { style: "spikes_border" });
      assert.ok(el.classList.contains("spikes_border"));
      delete window.AssetCatalog;
    });

    it("no-border (string and object) — clears but does not add", function () {
      window.AssetCatalog = { ALL_BORDER_STYLES: ["no-border", "spikes_border"] };
      const a = freshEl("spikes_border");
      window.Filters.applyBorderStyle(a, "no-border");
      assert.ok(!a.classList.contains("spikes_border"));
      assert.ok(!a.classList.contains("no-border"), "no-border itself must not be added");
      const b = freshEl("spikes_border");
      window.Filters.applyBorderStyle(b, { style: "no-border" });
      assert.ok(!b.classList.contains("spikes_border"));
      assert.ok(!b.classList.contains("no-border"));
      delete window.AssetCatalog;
    });

    it("calls window.updateLayoutBounds when it exists", function () {
      let called = 0;
      window.updateLayoutBounds = function () {
        called += 1;
      };
      window.AssetCatalog = { ALL_BORDER_STYLES: ["no-border"] };
      const el = freshEl("");
      window.Filters.applyBorderStyle(el, "spikes_border");
      assert.strictEqual(called, 1, "updateLayoutBounds must be called once");
      delete window.updateLayoutBounds;
      delete window.AssetCatalog;
    });

    it("does not throw when updateLayoutBounds is absent", function () {
      delete window.updateLayoutBounds;
      window.AssetCatalog = { ALL_BORDER_STYLES: ["no-border"] };
      const el = freshEl("");
      assert.doesNotThrow(function () {
        window.Filters.applyBorderStyle(el, "spikes_border");
      });
      delete window.AssetCatalog;
    });
  });
});

// ---------------------------------------------------------------------------
// Icons — Icons.svg
// ---------------------------------------------------------------------------
describe("Icons — Icons.svg (js/icons.js)", function () {
  let window;

  before(function () {
    const ctx = createDom();
    window = ctx.window;
    loadIcons(window);
  });

  it("returns empty string for unknown icon name", function () {
    assert.strictEqual(window.Icons.svg("does-not-exist", 16), "");
    assert.strictEqual(window.Icons.svg("", 16), "");
    assert.strictEqual(window.Icons.svg(null, 16), "");
  });

  it("known icons produce valid SVG with expected attributes", function () {
    const svg = window.Icons.svg("printer", 16);
    assert.ok(svg.includes("<svg"), "must contain <svg");
    assert.ok(svg.includes('class="be-icon be-icon-printer"'), "must have be-icon-printer class");
    assert.ok(svg.includes('viewBox="0 0 16 16"'), "must have viewBox");
    assert.ok(svg.includes('stroke="currentColor"'), "must have stroke currentColor");
    assert.ok(svg.includes('stroke-width="1.5"'), "must have stroke-width 1.5");
    assert.ok(svg.includes('aria-hidden="true"'), "must be aria-hidden");
    assert.ok(svg.includes('stroke-linecap="round"'));
    assert.ok(svg.includes('stroke-linejoin="round"'));
  });

  it("size param is reflected in width/height", function () {
    const s16 = window.Icons.svg("heart", 16);
    assert.ok(s16.includes('width="16"') && s16.includes('height="16"'));
    const s24 = window.Icons.svg("heart", 24);
    assert.ok(s24.includes('width="24"') && s24.includes('height="24"'));
    const s12 = window.Icons.svg("grip", 12);
    assert.ok(s12.includes('width="12"'));
  });

  it("SOLID_FILL special-case: lock uses fill currentColor solid, others use fill none", function () {
    const lockSvg = window.Icons.svg("lock", 16);
    // lock is solid-fill: should NOT have fill=\"none\", should contain its filled rect
    assert.ok(!lockSvg.includes('fill="none"'), "lock must not have fill=none");
    assert.ok(lockSvg.includes('fill="currentColor"'), "lock must have fill currentColor in its paths");

    const printerSvg = window.Icons.svg("printer", 16);
    assert.ok(printerSvg.includes('fill="none"'), "printer must have fill=none on <svg>");

    const lockOpenSvg = window.Icons.svg("lockOpen", 16);
    assert.ok(lockOpenSvg.includes('fill="none"'), "lockOpen (not in SOLID_FILL) must have fill=none");

    const heartSvg = window.Icons.svg("heart", 16);
    assert.ok(heartSvg.includes('fill="none"'));
  });

  it("grip vs gripVertical: distinct dot families", function () {
    const grip = window.Icons.svg("grip", 16);
    const gripV = window.Icons.svg("gripVertical", 16);
    // grip is 3 dots horizontal; gripVertical is 9 dots 3x3
    const gripDots = (grip.match(/<circle/g) || []).length;
    const gripVDots = (gripV.match(/<circle/g) || []).length;
    assert.strictEqual(gripDots, 3, "grip must be 3 dots");
    assert.strictEqual(gripVDots, 9, "gripVertical must be 9 dots");
    assert.notStrictEqual(grip, gripV);
  });

  it("covers a representative set of the 30+ icon catalogue", function () {
    const names = [
      "printer",
      "printerOff",
      "eye",
      "eyeOff",
      "trash",
      "plus",
      "reset",
      "layers",
      "clone",
      "heart",
      "x",
      "check",
      "border",
      "shape",
      "expand",
      "sparkle",
      "power",
    ];
    for (const name of names) {
      const svg = window.Icons.svg(name, 16);
      assert.ok(svg.length > 50, `${name} must produce non-trivial SVG, got length ${svg.length}`);
      assert.ok(svg.includes(`be-icon-${name}`), `${name} must carry its class`);
    }
  });

  it("module is idempotent — second eval does not break the API", function () {
    const before = window.Icons.svg("trash", 16);
    window.eval(ICONS_SRC);
    const after = window.Icons.svg("trash", 16);
    assert.strictEqual(after, before, "re-eval must produce identical output");
  });
});
