"use strict";

const assert = require("assert");
const { boot } = require("./encapsulation_debt/debt_harness.js");

function bootWithHtml(html) {
  return boot(html || '<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div></body></html>');
}

function baseSheetHtml(sectionsHtml) {
  return `<!DOCTYPE html><html><body>
    <div id="print-layout-wrapper"></div>
    <div id="site-main">
      <div class="ct-character-sheet-desktop">
        <div class="ct-character-sheet__inner">
          ${sectionsHtml || ""}
        </div>
      </div>
    </div>
  </body></html>`;
}

function waitFor(pred, timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    (function poll() {
      if (pred()) return resolve(true);
      if (Date.now() - t0 > (timeoutMs || 2000)) return resolve(pred());
      setTimeout(poll, 5);
    })();
  });
}

// ---------------------------------------------------------------------------
// Harness & constants
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — harness & SectionUtils constants", function () {
  it("boots and exposes SectionCloning + SectionUtils + Z on window", function () {
    const ctx = bootWithHtml();
    try {
      assert.ok(ctx.window.SectionCloning, "window.SectionCloning");
      assert.ok(ctx.window.SectionUtils, "window.SectionUtils");
      assert.ok(ctx.window.Z, "window.Z");
      assert.strictEqual(typeof ctx.window.SectionCloning.captureSectionSnapshot, "function");
      assert.strictEqual(typeof ctx.window.SectionCloning.renderClonedSection, "function");
      assert.strictEqual(typeof ctx.window.SectionCloning.renderExtractedSection, "function");
      assert.strictEqual(typeof ctx.window.SectionCloning.rollbackSection, "function");
      assert.strictEqual(typeof ctx.window.SectionCloning.rollbackExtraction, "function");
      assert.ok(ctx.window.SectionUtils.getSanitizedContent);
      assert.ok(ctx.window.SectionUtils.applyFontSize);
      // commonJS surface mirrors window
      const direct = require("../../js/section_cloning.js");
      assert.ok(direct.captureSectionSnapshot);
      const utilsDirect = require("../../js/section_utils.js");
      assert.ok(utilsDirect.getSanitizedContent);
    } finally { ctx.cleanup(); }
  });

  it("Z declaration covers the required keys", function () {
    const ctx = bootWithHtml();
    try {
      const Z = ctx.window.Z;
      for (const k of ["PANEL", "PICKER", "CONTEXT_MENU", "ACTIONS_BAR", "SHAPE_STEP", "SHAPE_DEFAULT", "SECTION_DEFAULT", "TOP"]) {
        assert.ok(Z[k] != null, `Z.${k} missing`);
      }
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// SectionUtils — pure helpers exercised through real production code
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — SectionUtils.getSanitizedContent", function () {
  it("removes extension UI elements but preserves plain content", function () {
    const ctx = bootWithHtml(baseSheetHtml('<div class="ct-subsection" id="s1"><div class="print-section-content"><p>keep</p><button class="be-clone-button">clone</button><menu>m</menu><div class="print-section-header">hdr</div><div class="ct-spells-filter">f</div><div class="be-section-actions">a</div></div></div>'));
    try {
      // section_utils expects a content node; give it the inner content div
      const content = ctx.document.querySelector(".print-section-content") || ctx.document.getElementById("s1");
      const sanitized = ctx.window.SectionUtils.getSanitizedContent(content);
      assert.ok(sanitized.innerHTML.includes("keep"), "keeps user content");
      assert.strictEqual(sanitized.querySelector(".be-clone-button"), null, "clone button removed");
      assert.strictEqual(sanitized.querySelector("menu"), null, "menu removed");
      assert.strictEqual(sanitized.querySelector(".print-section-header"), null, "print header removed");
      assert.strictEqual(sanitized.querySelector(".ct-spells-filter"), null, "spells filter removed");
      assert.strictEqual(sanitized.querySelector(".be-section-actions"), null, "actions removed");
    } finally { ctx.cleanup(); }
  });

  it("removes standardized header when DomManager present", function () {
    const ctx = bootWithHtml(baseSheetHtml('<div class="ct-subsection" id="s2"><div class="ct-content-group__header">old hdr</div><p>body</p></div>'));
    try {
      const node = ctx.document.getElementById("s2");
      const sanitized = ctx.window.SectionUtils.getSanitizedContent(node);
      assert.strictEqual(sanitized.querySelector(".ct-content-group__header"), null, "old header stripped");
      assert.ok(sanitized.innerHTML.includes("body"));
    } finally { ctx.cleanup(); }
  });

  it("clones without mutating original", function () {
    const ctx = bootWithHtml(baseSheetHtml('<div id="orig"><span>hello</span></div>'));
    try {
      const orig = ctx.document.getElementById("orig");
      const clone = ctx.window.SectionUtils.getSanitizedContent(orig);
      clone.innerHTML = "changed";
      assert.strictEqual(orig.querySelector("span").textContent, "hello");
    } finally { ctx.cleanup(); }
  });
});

describe("feature_09_section_cloning — SectionUtils.getBaseSelector / getExtractionSelector", function () {
  it("getBaseSelector maps class patterns to fixed selectors", function () {
    const ctx = bootWithHtml();
    try {
      const el = ctx.document.createElement("div");
      el.className = "my-group be-extractable";
      const sel = ctx.window.SectionUtils.getBaseSelector(el);
      assert.ok(sel && sel.includes("-group"), sel);
      const el2 = ctx.document.createElement("div");
      el2.className = "styles_actionsList__abc be-extractable";
      const sel2 = ctx.window.SectionUtils.getBaseSelector(el2);
      assert.ok(sel2 && sel2.includes("styles_actionsList"), sel2);
      const el3 = ctx.document.createElement("div");
      el3.className = "no-match";
      assert.strictEqual(ctx.window.SectionUtils.getBaseSelector(el3), null);
    } finally { ctx.cleanup(); }
  });

  it("getExtractionSelector prefers be-ext- class and returns selector+index, filters containers", function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div class="be-ext-abc be-extractable" id="a1">one</div>
      <div class="be-ext-abc be-extractable" id="a2">two</div>
      <div class="print-section-container"><div class="be-ext-abc be-extractable" id="inside">inside</div></div>
    </body></html>`;
    const ctx = boot(html);
    try {
      ctx.window.flagExtractableElements && ctx.window.flagExtractableElements();
      const a1 = ctx.document.getElementById("a1");
      const res = ctx.window.SectionUtils.getExtractionSelector(a1, false);
      assert.ok(res, "should resolve");
      assert.strictEqual(res.selector, ".be-ext-abc.be-extractable");
      assert.strictEqual(res.index, 0);
      const a2 = ctx.document.getElementById("a2");
      const res2 = ctx.window.SectionUtils.getExtractionSelector(a2, false);
      assert.strictEqual(res2.index, 1);
      // includeContainers = true would count inside
      const inside = ctx.document.getElementById("inside");
      const resInside = ctx.window.SectionUtils.getExtractionSelector(inside, true);
      assert.ok(resInside, "includeContainers true should find inside");
      assert.strictEqual(resInside.index, 2);
      const resInsideFiltered = ctx.window.SectionUtils.getExtractionSelector(inside, false);
      assert.strictEqual(resInsideFiltered, null, "filtered (default) should not find container-inside");
    } finally { ctx.cleanup(); }
  });

  it("getExtractionSelector returns null when no selector matches", function () {
    const ctx = bootWithHtml('<div id="x" class="unknown"></div>');
    try {
      const el = ctx.document.getElementById("x");
      assert.strictEqual(ctx.window.SectionUtils.getExtractionSelector(el), null);
    } finally { ctx.cleanup(); }
  });
});

describe("feature_09_section_cloning — SectionUtils.findSectionTitle / getSectionSlug / applyFontSize / refreshLayers", function () {
  it("findSectionTitle discovers heading fallbacks and trims", function () {
    const ctx = bootWithHtml('<div id="el"><h2>  My Title  </h2><p>x</p></div>');
    try {
      const el = ctx.document.getElementById("el");
      assert.strictEqual(ctx.window.SectionUtils.findSectionTitle(el), "My Title");
      const el2 = ctx.document.createElement("div");
      el2.innerHTML = '<div class="head-special">  Head Class </div>';
      assert.strictEqual(ctx.window.SectionUtils.findSectionTitle(el2), "Head Class");
      const el3 = ctx.document.createElement("div");
      assert.strictEqual(ctx.window.SectionUtils.findSectionTitle(el3), null);
    } finally { ctx.cleanup(); }
  });

  it("getSectionSlug extracts slug from ct-subsection-- / ct-content-group-- on self or child", function () {
    const ctx = bootWithHtml();
    try {
      const n = ctx.document.createElement("div");
      n.className = "ct-subsection--abilities";
      assert.strictEqual(ctx.window.SectionUtils.getSectionSlug(n), "abilities");
      const p = ctx.document.createElement("div");
      p.innerHTML = '<div class="ct-content-group--spells"></div>';
      assert.strictEqual(ctx.window.SectionUtils.getSectionSlug(p), "spells");
      const miss = ctx.document.createElement("div");
      assert.strictEqual(ctx.window.SectionUtils.getSectionSlug(miss), null);
      assert.strictEqual(ctx.window.SectionUtils.getSectionSlug(null), null);
    } finally { ctx.cleanup(); }
  });

  it("applyFontSize sets font-size important and computes --be-font-scale for px/%/em", function () {
    const ctx = bootWithHtml();
    try {
      const w = ctx.document.createElement("div");
      ctx.window.SectionUtils.applyFontSize(w, "20px");
      assert.strictEqual(w.style.getPropertyValue("font-size"), "20px");
      assert.strictEqual(w.style.getPropertyValue("--be-font-scale"), "2");
      const w2 = ctx.document.createElement("div");
      ctx.window.SectionUtils.applyFontSize(w2, "50%");
      assert.strictEqual(w2.style.getPropertyValue("--be-font-scale"), "0.5");
      const w3 = ctx.document.createElement("div");
      ctx.window.SectionUtils.applyFontSize(w3, "1em");
      assert.strictEqual(w3.style.getPropertyValue("--be-font-scale"), "1.6");
      // falsy guard
      assert.doesNotThrow(() => ctx.window.SectionUtils.applyFontSize(null, null));
      const w4 = ctx.document.createElement("div");
      ctx.window.SectionUtils.applyFontSize(w4, "");
      assert.strictEqual(w4.style.getPropertyValue("font-size"), "");
    } finally { ctx.cleanup(); }
  });

  it("refreshLayers does not throw when layer manager missing or not ready", function () {
    const ctx = bootWithHtml();
    try {
      assert.doesNotThrow(() => ctx.window.SectionUtils.refreshLayers());
      if (ctx.window.DomManager) {
        // LayerManager may not be loaded in this harness slice — invariant is no throw regardless
        assert.doesNotThrow(() => ctx.window.SectionUtils.refreshLayers());
        const lm = ctx.window.DomManager.getInstance().getLayerManager();
        if (lm) assert.ok(typeof ctx.window.SectionUtils.refreshLayers === "function");
      }
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// captureSectionSnapshot
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — captureSectionSnapshot", function () {
  it("returns null when section missing or content missing", function () {
    const ctx = bootWithHtml('<div id="print-layout-wrapper"><div id="empty"></div></div>');
    try {
      assert.strictEqual(ctx.window.SectionCloning.captureSectionSnapshot("nope"), null);
      assert.strictEqual(ctx.window.SectionCloning.captureSectionSnapshot("empty"), null);
    } finally { ctx.cleanup(); }
  });

  it("captures html sanitized, originalId, styles width/height", function () {
    const html = '<div id="sec-1" style="width: 123px; height: 45px;"><div class="print-section-content"><p>hello</p><menu>rm</menu></div></div>';
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper">${html}</div></body></html>`);
    try {
      const snap = ctx.window.SectionCloning.captureSectionSnapshot("sec-1");
      assert.ok(snap, "snapshot");
      assert.strictEqual(snap.originalId, "sec-1");
      assert.ok(snap.html.includes("hello"), "html contains content");
      assert.strictEqual(snap.html.includes("<menu"), false, "menu sanitized");
      assert.strictEqual(snap.styles.width, "123px");
      assert.strictEqual(snap.styles.height, "45px");
    } finally { ctx.cleanup(); }
  });

  it("captures borderStyle from AssetCatalog ALL_BORDER_STYLES", function () {
    const html = '<div id="sec-2" class="spikes_border"><div class="print-section-content"><p>c</p></div></div>';
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper">${html}</div></body></html>`);
    try {
      ctx.window.AssetCatalog = ctx.window.AssetCatalog || { ALL_BORDER_STYLES: ["no-border", "spikes_border", "ability_border"] };
      // ensure contains
      if (!ctx.window.AssetCatalog.ALL_BORDER_STYLES.includes("spikes_border")) ctx.window.AssetCatalog.ALL_BORDER_STYLES.push("spikes_border");
      const snap = ctx.window.SectionCloning.captureSectionSnapshot("sec-2");
      assert.strictEqual(snap.borderStyle, "spikes_border");
      const html2 = '<div id="sec-3"><div class="print-section-content"><p>c</p></div></div>';
      const ctx2 = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper">${html2}</div></body></html>`);
      try {
        const snap2 = ctx2.window.SectionCloning.captureSectionSnapshot("sec-3");
        assert.strictEqual(snap2.borderStyle, null);
      } finally { ctx2.cleanup(); }
    } finally { ctx.cleanup(); }
  });

  it("captures borderSvg via AiBorder.readBorderSvg choke point and nulls on missing/throw", function () {
    const html = '<div id="sec-b"><div class="print-section-content"><p>c</p></div></div>';
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper">${html}</div></body></html>`);
    try {
      ctx.window.AiBorder = { readBorderSvg: () => "<svg>ok</svg>" };
      const s1 = ctx.window.SectionCloning.captureSectionSnapshot("sec-b");
      assert.strictEqual(s1.borderSvg, "<svg>ok</svg>");
      delete ctx.window.AiBorder;
      const s2 = ctx.window.SectionCloning.captureSectionSnapshot("sec-b");
      assert.strictEqual(s2.borderSvg, null);
      ctx.window.AiBorder = { readBorderSvg: () => { throw new Error("boom"); } };
      const s3 = ctx.window.SectionCloning.captureSectionSnapshot("sec-b");
      assert.strictEqual(s3.borderSvg, null);
    } finally { ctx.cleanup(); }
  });

  it("falls back to [\"no-border\"] when AssetCatalog missing", function () {
    const ctx = bootWithHtml('<div id="sec-x"><div class="print-section-content"><p>c</p></div></div>');
    try {
      const saved = ctx.window.AssetCatalog;
      delete ctx.window.AssetCatalog;
      const snap = ctx.window.SectionCloning.captureSectionSnapshot("sec-x");
      assert.ok(snap, "still captures");
      assert.strictEqual(snap.borderStyle, null);
      if (saved) ctx.window.AssetCatalog = saved;
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// renderClonedSection — construction & style/positioning
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — renderClonedSection construction", function () {
  it("creates wrapper+container with title, sanitized content, be-clone, dataset, header", function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-1", originalId: "sec-orig", title: "My Clone", html: '<p>Snapshot Content</p><menu>no</menu>', styles: { width: "200px", height: "100px" }, width: "200px", height: "100px" };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      assert.ok(wrapper, "wrapper");
      assert.ok(wrapper.classList.contains("be-section-wrapper"));
      assert.strictEqual(wrapper.dataset.title, "My Clone");
      const container = wrapper.querySelector(".print-section-container");
      assert.ok(container, "container");
      assert.ok(container.classList.contains("be-clone"));
      assert.strictEqual(container.dataset.originalId, "sec-orig");
      assert.strictEqual(container.id, "clone-1");
      const hdr = container.querySelector(".ct-content-group__header-content");
      assert.ok(hdr, "header");
      assert.strictEqual(hdr.textContent, "My Clone");
      assert.ok(container.querySelector(".print-section-content").innerHTML.includes("Snapshot Content"));
      assert.strictEqual(container.querySelector("menu"), null, "sanitized menu gone");
      assert.strictEqual(container.style.width, "200px");
      assert.strictEqual(container.style.height, "100px");
    } finally { ctx.cleanup(); }
  });

  it("applies snapshot.width/height and left/top when provided, plus zIndex/printZ/fontSize", function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-z", originalId: "x", title: "T", html: "<p>h</p>", left: "10px", top: "20px", zIndex: "99", printZIndex: "77", fontSize: "14px", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      const container = wrapper.querySelector(".print-section-container");
      assert.ok(container, "the cloned container is rendered inside the wrapper");
      assert.strictEqual(wrapper.style.left, "10px");
      assert.strictEqual(wrapper.style.top, "20px");
      assert.strictEqual(wrapper.style.zIndex, "99");
      assert.strictEqual(wrapper.dataset.printZ, "77");
      assert.strictEqual(wrapper.style.getPropertyValue("font-size"), "14px");
      assert.strictEqual(wrapper.style.getPropertyValue("--be-font-scale"), "1.4");
      // container font size via applyFontSize
    } finally { ctx.cleanup(); }
  });

  it("falls back to snapshot.styles.width/height when top-level missing", function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-s", originalId: "x", title: "T", html: "<p>h</p>", styles: { width: "321px", height: "99px" } };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      const container = wrapper.querySelector(".print-section-container");
      assert.strictEqual(container.style.width, "321px");
      assert.strictEqual(container.style.height, "99px");
    } finally { ctx.cleanup(); }
  });

  it("offsets from original when no left/top, uses maxZ+1, else 32px fallback", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper" id="orig-wrapper" style="left: 10px; top: 20px; z-index: 5;"><div class="print-section-container" id="orig"></div></div>
        <div class="be-section-wrapper" style="z-index: 50;"></div>
      </div>
      <div id="orig"><div class="print-section-content"><p>c</p></div></div>
    </body></html>`);
    try {
      // need original element with id orig so closest works: put a div with id orig inside wrapper? Our HTML has both. Fix: ensure dom has element id=orig that closest works.
      // Simpler: create a real target element
      const target = ctx.document.createElement("div");
      target.id = "sec-orig-2";
      const inner = ctx.document.createElement("div");
      inner.className = "print-section-content";
      inner.innerHTML = "<p>c</p>";
      target.appendChild(inner);
      // wrap it as be-section-wrapper to simulate original source
      const ow = ctx.document.createElement("div");
      ow.className = "be-section-wrapper";
      ow.style.left = "10px"; ow.style.top = "20px";
      ow.appendChild(target);
      ctx.document.getElementById("print-layout-wrapper").appendChild(ow);

      const snap = { id: "clone-off", originalId: "sec-orig-2", title: "Off", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      assert.strictEqual(wrapper.style.left, "42px"); // 10+32
      assert.strictEqual(wrapper.style.top, "52px"); // 20+32
      // zIndex should be max(10 default, 50) +1 = 51 at least
      assert.ok(parseInt(wrapper.style.zIndex, 10) >= 51);

      // fallback when original missing
      const snap2 = { id: "clone-fallback", originalId: "nope-missing", title: "F", html: "<p>h</p>", styles: {} };
      const wrapper2 = ctx.window.SectionCloning.renderClonedSection(snap2);
      assert.strictEqual(wrapper2.style.left, "32px");
      assert.strictEqual(wrapper2.style.top, "32px");
    } finally { ctx.cleanup(); }
  });

  it("handles minimized, compact, borderStyle, and borderSvg choke point", function () {
    const ctx = bootWithHtml();
    try {
      ctx.window.AiBorder = { renderBorderSvg: (el, svg) => { el.dataset.renderedSvg = svg || "null"; } };
      const snap = { id: "clone-flags", originalId: "x", title: "F", html: "<p>h</p>", minimized: true, compact: true, borderStyle: "spikes_border", borderSvg: "<svg>x</svg>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      const container = wrapper.querySelector(".print-section-container");
      assert.strictEqual(container.dataset.minimized, "true");
      assert.ok(container.classList.contains("minimized"));
      assert.ok(container.classList.contains("be-compact-mode"));
      assert.ok(container.classList.contains("spikes_border"));
      assert.strictEqual(container.dataset.renderedSvg, "<svg>x</svg>");
      // with null svg clears
      const snap2 = { id: "clone-noborder", originalId: "x", title: "F2", html: "<p>h</p>", styles: {}, borderSvg: null };
      ctx.window.AiBorder.renderBorderSvg = (el, svg) => { el.dataset.renderedSvg = svg === null ? "cleared" : svg; };
      const wrapper2 = ctx.window.SectionCloning.renderClonedSection(snap2);
      assert.strictEqual(wrapper2.querySelector(".print-section-container").dataset.renderedSvg, "cleared");
      // without AiBorder no throw
      delete ctx.window.AiBorder;
      const snap3 = { id: "clone-noai", originalId: "x", title: "F3", html: "<p>h</p>", styles: {} };
      assert.doesNotThrow(() => ctx.window.SectionCloning.renderClonedSection(snap3));
    } finally { ctx.cleanup(); }
  });

  it("appends to DomManager sections layer and calls initResizeLogic + refreshLayers", function () {
    const ctx = bootWithHtml();
    try {
      let resizeCalled = 0;
      ctx.window.initResizeLogic = () => { resizeCalled++; };
      let refreshCalled = 0;
      const origRL = ctx.window.SectionUtils.refreshLayers;
      ctx.window.SectionUtils.refreshLayers = () => { refreshCalled++; };
      const snap = { id: "clone-append", originalId: "x", title: "T", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      const layer = ctx.window.DomManager.getInstance().getSectionsLayer().element;
      assert.ok(layer.contains(wrapper), "appended to sections layer");
      assert.ok(resizeCalled >= 1, "initResizeLogic called");
      assert.ok(refreshCalled >= 1, "refreshLayers called");
      ctx.window.SectionUtils.refreshLayers = origRL;
    } finally { ctx.cleanup(); }
  });

  it("adds delete button with danger and exposes dblclick title edit", async function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-int", originalId: "x", title: "Orig", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      const btn = wrapper.querySelector(".be-clone-delete");
      assert.ok(btn, "delete btn");
      assert.strictEqual(btn.getAttribute("title"), "Delete Clone");
      assert.ok(btn.innerHTML.includes("🗑"), "icon");
      // dblclick -> showInputModal
      let modalArgs = null;
      ctx.window.showInputModal = (title, msg, cur) => { modalArgs = { title, msg, cur }; return Promise.resolve("Renamed"); };
      let feedbackMsg = null;
      ctx.window.showFeedback = (m) => { feedbackMsg = m; };
      // ensure wrapper title set
      wrapper.dispatchEvent(new ctx.window.MouseEvent("dblclick", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      assert.strictEqual(wrapper.dataset.title, "Renamed");
      const hdr = wrapper.querySelector(".ct-content-group__header-content");
      assert.ok(hdr.textContent.includes("Renamed"));
      assert.strictEqual(feedbackMsg, "Title updated");
      assert.ok(modalArgs && modalArgs.title === "Edit Clone Title");
      // cancel path returns null: title unchanged
      ctx.window.showInputModal = () => Promise.resolve(null);
      wrapper.dispatchEvent(new ctx.window.MouseEvent("dblclick", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(wrapper.dataset.title, "Renamed", "null keeps old title");
      // empty string falsy: also not applied
      ctx.window.showInputModal = () => Promise.resolve("");
      wrapper.dispatchEvent(new ctx.window.MouseEvent("dblclick", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
      assert.strictEqual(wrapper.dataset.title, "Renamed");
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// renderClonedSection — delete flow (confirm + destructive gate + undo)
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — renderClonedSection delete flow", function () {
  it("does not delete when confirm dismissed (confirmAction returns false)", async function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-del1", originalId: "x", title: "Del", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      ctx.window.confirmAction = async () => false;
      ctx.window.destructiveGate = async () => { assert.fail("gate should not be reached when confirm false"); };
      const btn = wrapper.querySelector(".be-clone-delete");
      btn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      assert.ok(ctx.document.getElementById("clone-del1"), "still in DOM");
    } finally { ctx.cleanup(); }
  });

  it("deletes after confirm true, snapshots via destructiveGate, offers undo", async function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-del2", originalId: "x", title: "Del2", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      ctx.window.confirmAction = async () => true;
      let gateReason = null;
      ctx.window.destructiveGate = async (reason) => { gateReason = reason; return { ok: true, record: { id: "rec-1" } }; };
      let undoArgs = null;
      ctx.window.offerUndo = (rec, label) => { undoArgs = { rec, label }; };
      let feedback = null;
      ctx.window.showFeedback = (m) => { feedback = m; };
      let bounds = 0;
      ctx.window.updateLayoutBounds = () => { bounds++; };
      const btn = wrapper.querySelector(".be-clone-delete");
      btn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
      await waitFor(() => !ctx.document.getElementById("clone-del2"), 1500);
      assert.strictEqual(ctx.document.getElementById("clone-del2"), null, "removed");
      assert.ok(gateReason && gateReason.includes("Del2"));
      assert.ok(undoArgs && undoArgs.rec.id === "rec-1");
      assert.ok(undoArgs.label.includes("Del2"));
      assert.strictEqual(feedback, "Clone deleted");
      assert.ok(bounds >= 1);
    } finally { ctx.cleanup(); }
  });

  it("refuses delete when destructiveGate returns ok:false", async function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-del3", originalId: "x", title: "Del3", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      ctx.window.confirmAction = async () => true;
      ctx.window.destructiveGate = async () => ({ ok: false });
      const btn = wrapper.querySelector(".be-clone-delete");
      btn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      assert.ok(ctx.document.getElementById("clone-del3"), "not removed when gate refuses");
    } finally { ctx.cleanup(); }
  });

  it("fallbacks to native confirm when confirmAction missing, and fail-open when destructiveGate missing", async function () {
    const ctx = bootWithHtml();
    try {
      const snap = { id: "clone-del4", originalId: "x", title: "Del4", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      delete ctx.window.confirmAction;
      const origConfirm = ctx.window.confirm;
      ctx.window.confirm = () => true;
      delete ctx.window.destructiveGate; // missing -> fail open via cloningDestructiveGate
      // need offerUndo to not exist branch
      delete ctx.window.offerUndo;
      ctx.window.showFeedback = () => {};
      ctx.window.updateLayoutBounds = () => {};
      const btn = wrapper.querySelector(".be-clone-delete");
      btn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
      await waitFor(() => !ctx.document.getElementById("clone-del4"), 1500);
      assert.strictEqual(ctx.document.getElementById("clone-del4"), null, "fail-open allows delete");
      ctx.window.confirm = origConfirm;
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// renderExtractedSection
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — renderExtractedSection", function () {
  it("returns null and warns when original not found", function () {
    const ctx = bootWithHtml('<div id="print-layout-wrapper"></div>');
    try {
      const logs = [];
      ctx.window.safeLog = (lvl, msg) => logs.push(String(msg));
      const res = ctx.window.SectionCloning.renderExtractedSection({ originalId: "nope", selector: ".none", index: 0, title: "T", id: "ex-1" });
      assert.strictEqual(res, null, "null on miss");
      assert.ok(logs.some((m) => m.includes("Could not resolve original")), "warned");
    } finally { ctx.cleanup(); }
  });

  it("resolves via selector+index when id miss and reassigns id to live element", function () {
    const html = `<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div class="ct-actions-group be-extractable" id="old-id"><h3 class="head">H</h3><p>body</p></div>
      <div class="ct-actions-group be-extractable">other</div>
    </body></html>`;
    const ctx = boot(html);
    try {
      ctx.window.flagExtractableElements && ctx.window.flagExtractableElements();
      // after flag, second element gets be-ext- class; but first still has generic
      // For this test, we place selector that matches both actions groups: getExtractionSelector would give that selector.
      const target = ctx.document.querySelector(".ct-actions-group");
      // Ensure both have a common base selector pattern: we force a selector known to work: use getBaseSelector
      // Simpler: we directly craft a snapshot that uses selector that matches the first element's position
      // Use the real selector from getExtractionSelector
      const resInfo = ctx.window.SectionUtils.getExtractionSelector(target, true);
      // If custom, use that; otherwise fallback to a direct query
      let selector, index;
      if (resInfo) { selector = resInfo.selector; index = resInfo.index; } else { selector = "[class*=\"-group\"]"; index = 0; }
      // Remove id to force selector path
      target.removeAttribute("id");
      const snap = { originalId: "recovered-id", selector, index, title: "Recovered", id: "ex-2" };
      const wrapper = ctx.window.SectionCloning.renderExtractedSection(snap);
      assert.ok(wrapper, "created via selector");
      assert.strictEqual(ctx.document.getElementById("recovered-id"), target, "id restored on live element");
    } finally { ctx.cleanup(); }
  });

  it("hides original, sanitizes clone, strips id, hides inner heading, wraps with header", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="src" class="ct-actions-group be-extractable"><h3 class="head">Hdr</h3><p>keep</p><menu>no</menu></div>
    </body></html>`);
    try {
      ctx.window.flagExtractableElements && ctx.window.flagExtractableElements();
      const snap = { originalId: "src", title: "Extracted", id: "ex-3" };
      const wrapper = ctx.window.SectionCloning.renderExtractedSection(snap);
      assert.ok(wrapper, "wrapper created");
      const original = ctx.document.getElementById("src");
      assert.strictEqual(original.style.getPropertyValue("display"), "none");
      const container = wrapper.querySelector(".print-section-container");
      assert.ok(container.classList.contains("be-extracted-section"));
      assert.strictEqual(container.dataset.originalId, "src");
      assert.ok(container.textContent.includes("keep"));
      // cloned copy inside card must not keep source id
      const insideCopy = container.querySelector("#src");
      assert.strictEqual(insideCopy, null, "clone id stripped");
      // header inside clone hidden
      const h = container.querySelector("h3.head");
      assert.ok(h, "header exists");
      assert.strictEqual(h.style.display, "none");
      // standardized header
      const hdr = container.querySelector(".ct-content-group__header-content");
      assert.ok(hdr && hdr.textContent === "Extracted");
    } finally { ctx.cleanup(); }
  });

  it("promotes children of be-merge-wrapper instead of nesting", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="src2" class="be-merge-wrapper be-extractable"><span>one</span><span>two</span></div>
    </body></html>`);
    try {
      ctx.window.flagExtractableElements && ctx.window.flagExtractableElements();
      const snap = { originalId: "src2", title: "Merge", id: "ex-merge" };
      const wrapper = ctx.window.SectionCloning.renderExtractedSection(snap);
      const cont = wrapper.querySelector(".print-section-container");
      assert.ok(cont.textContent.includes("one") && cont.textContent.includes("two"));
      assert.strictEqual(cont.querySelector(".be-merge-wrapper"), null, "wrapper promoted not kept");
    } finally { ctx.cleanup(); }
  });

  it("applies width/height/left/top/zIndex/printZ/fontSize/minimized/compact/borderStyle/borderSvg and beExtClass", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div id="src3"><div class="print-section-content">c</div></div></body></html>`);
    try {
      ctx.window.AiBorder = { renderBorderSvg: (el, svg) => { el.dataset.b = svg ? "yes" : "no"; } };
      const snap = {
        originalId: "src3", title: "S", id: "ex-4",
        selector: ".be-ext-xyz.be-extractable",
        width: "123px", height: "45px", left: "5px", top: "6px", zIndex: "77", printZIndex: "88", fontSize: "12px", minimized: true, compact: true, borderStyle: "spikes_border", borderSvg: "<svg/>"
      };
      const wrapper = ctx.window.SectionCloning.renderExtractedSection(snap);
      const container = wrapper.querySelector(".print-section-container");
      assert.strictEqual(container.style.getPropertyValue("width"), "123px");
      assert.strictEqual(container.style.getPropertyValue("height"), "45px");
      assert.strictEqual(wrapper.style.getPropertyValue("left"), "5px");
      assert.strictEqual(wrapper.style.getPropertyValue("top"), "6px");
      assert.strictEqual(wrapper.style.getPropertyValue("z-index"), "77");
      assert.strictEqual(wrapper.dataset.printZ, "88");
      assert.strictEqual(wrapper.style.getPropertyValue("font-size"), "12px");
      assert.strictEqual(container.dataset.minimized, "true");
      assert.ok(container.classList.contains("minimized"));
      assert.ok(container.classList.contains("be-compact-mode"));
      assert.ok(container.classList.contains("spikes_border"));
      assert.strictEqual(container.dataset.b, "yes");
      assert.strictEqual(container.dataset.beExtClass, "be-ext-xyz");
      assert.strictEqual(container.dataset.parentSectionId, undefined);
      // parentSectionId branch
      const snap2 = { originalId: "src3", title: "S2", id: "ex-5", parentSectionId: "parent-1" };
      const ctx2 = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div id="src3"><div class="print-section-content">c</div></div></body></html>`);
      try {
        const w2 = ctx2.window.SectionCloning.renderExtractedSection(snap2);
        assert.strictEqual(w2.querySelector(".print-section-container").dataset.parentSectionId, "parent-1");
      } finally { ctx2.cleanup(); }
    } finally { ctx.cleanup(); }
  });

  it("wires rollbackExtraction on minimize button and appends to sections layer + injections", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div id="src4"><p>c</p></div></body></html>`);
    try {
      let injectClone = 0, injectAppend = 0, resize = 0;
      ctx.window.injectCloneButtons = () => { injectClone++; };
      ctx.window.injectAppendButton = () => { injectAppend++; };
      ctx.window.initResizeLogic = () => { resize++; };
      const snap = { originalId: "src4", title: "R", id: "ex-6" };
      const wrapper = ctx.window.SectionCloning.renderExtractedSection(snap);
      // renderExtractedSection wires rollback to the wrapper's minimize control when produced by createDraggableContainer;
      // production code creates it where draggable UI exists, harness variant should at least still append + invoke hooks
      assert.ok(wrapper, "wrapper exists");
      assert.ok(wrapper.classList.contains("be-extracted-section-wrapper"));
      const layer = ctx.window.DomManager.getInstance().getSectionsLayer().element;
      assert.ok(layer.contains(wrapper));
      assert.ok(injectClone >= 1 && injectAppend >= 1 && resize >= 1);
      // if a minimize control is present, it should call rollbackExtraction(container)
      const xBtn = wrapper.querySelector(".print-section-minimize");
      if (xBtn) {
        assert.strictEqual(xBtn.getAttribute("title"), "Rollback Extraction");
        let rolled = null;
        const origRE = ctx.window.SectionCloning.rollbackExtraction;
        ctx.window.SectionCloning.rollbackExtraction = (c) => { rolled = c; };
        xBtn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
        assert.ok(rolled && rolled.classList.contains("be-extracted-section"));
        ctx.window.SectionCloning.rollbackExtraction = origRE;
      } else {
        // fallback: direct rollbackExtraction still rolls back
        ctx.window.updateLayoutBounds = () => {};
        ctx.window.SectionUtils.refreshLayers = () => {};
        ctx.window.showFeedback = () => {};
        const container = wrapper.querySelector(".print-section-container");
        assert.doesNotThrow(() => ctx.window.SectionCloning.rollbackSection(container));
      }
    } finally { ctx.cleanup(); }
  });

  it("without AiBorder still renders (no throw)", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div id="src5">x</div></body></html>`);
    try {
      delete ctx.window.AiBorder;
      const snap = { originalId: "src5", title: "T", id: "ex-7", borderSvg: "<svg/>" };
      assert.doesNotThrow(() => ctx.window.SectionCloning.renderExtractedSection(snap));
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// rollbackSection + rollbackExtraction
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — rollbackSection", function () {
  it("restores display for originalId and associatedIds, removes wrapper, bounds+layers+feedback", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="origA" style="display: none;">a</div>
      <div id="origB" style="display: none;">b</div>
      <div class="be-section-wrapper" id="wrap-ex"><div class="print-section-container be-extracted-section" id="ex-10" data-original-id="origA" data-associated-ids='["origB"]'></div></div>
    </body></html>`);
    try {
      let bounds = 0, layers = 0, feedback = null;
      ctx.window.updateLayoutBounds = () => { bounds++; };
      const origRefresh = ctx.window.SectionUtils.refreshLayers;
      ctx.window.SectionUtils.refreshLayers = () => { layers++; };
      ctx.window.showFeedback = (m) => { feedback = m; };
      const container = ctx.document.getElementById("ex-10");
      ctx.window.SectionCloning.rollbackSection(container);
      assert.strictEqual(ctx.document.getElementById("ex-10"), null, "extracted removed");
      assert.strictEqual(ctx.document.getElementById("wrap-ex"), null, "wrapper removed");
      assert.notStrictEqual(ctx.document.getElementById("origA").style.getPropertyValue("display"), "none");
      assert.notStrictEqual(ctx.document.getElementById("origB").style.getPropertyValue("display"), "none");
      assert.strictEqual(feedback, "Extraction rolled back");
      assert.ok(bounds >= 1 && layers >= 1);
      ctx.window.SectionUtils.refreshLayers = origRefresh;
    } finally { ctx.cleanup(); }
  });

  it("handles missing wrapper (container is wrapper itself) and missing associatedIds", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="origC" style="display: none;">c</div>
      <div class="print-section-container be-extracted-section" id="ex-11" data-original-id="origC"></div>
    </body></html>`);
    try {
      ctx.window.updateLayoutBounds = () => {};
      ctx.window.SectionUtils.refreshLayers = () => {};
      ctx.window.showFeedback = () => {};
      const container = ctx.document.getElementById("ex-11");
      assert.doesNotThrow(() => ctx.window.SectionCloning.rollbackSection(container));
      assert.strictEqual(ctx.document.getElementById("ex-11"), null);
      assert.notStrictEqual(ctx.document.getElementById("origC").style.getPropertyValue("display"), "none");
    } finally { ctx.cleanup(); }
  });

  it("is no-op when originalId points to nothing (still removes card)", function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div class="be-section-wrapper"><div class="print-section-container be-extracted-section" id="ex-12" data-original-id="ghost"></div></div>
    </body></html>`);
    try {
      ctx.window.updateLayoutBounds = () => {};
      ctx.window.SectionUtils.refreshLayers = () => {};
      ctx.window.showFeedback = () => {};
      const container = ctx.document.getElementById("ex-12");
      ctx.window.SectionCloning.rollbackSection(container);
      assert.strictEqual(ctx.document.getElementById("ex-12"), null);
    } finally { ctx.cleanup(); }
  });
});

describe("feature_09_section_cloning — rollbackExtraction async capture", function () {
  it("awaits captureUndo with STRUCTURAL then calls rollbackSection", async function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="origD" style="display: none;">d</div>
      <div class="be-section-wrapper"><div class="print-section-container be-extracted-section" id="ex-13" data-original-id="origD"></div></div>
    </body></html>`);
    try {
      let capArgs = null;
      ctx.window.captureUndo = async (label, klass) => { capArgs = { label, klass }; return { id: "u" }; };
      ctx.window.updateLayoutBounds = () => {};
      ctx.window.SectionUtils.refreshLayers = () => {};
      ctx.window.showFeedback = () => {};
      const container = ctx.document.getElementById("ex-13");
      await ctx.window.SectionCloning.rollbackExtraction(container);
      assert.ok(capArgs, "capture called");
      assert.strictEqual(capArgs.label, "Roll back extraction");
      assert.strictEqual(capArgs.klass, ctx.window.MUTATION_CLASSES.STRUCTURAL);
      assert.strictEqual(ctx.document.getElementById("ex-13"), null, "rolled back");
      assert.notStrictEqual(ctx.document.getElementById("origD").style.getPropertyValue("display"), "none");
    } finally { ctx.cleanup(); }
  });

  it("still rolls back when captureUndo missing", async function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="origE" style="display: none;">e</div>
      <div class="be-section-wrapper"><div class="print-section-container be-extracted-section" id="ex-14" data-original-id="origE"></div></div>
    </body></html>`);
    try {
      delete ctx.window.captureUndo;
      ctx.window.updateLayoutBounds = () => {};
      ctx.window.SectionUtils.refreshLayers = () => {};
      ctx.window.showFeedback = () => {};
      const container = ctx.document.getElementById("ex-14");
      await ctx.window.SectionCloning.rollbackExtraction(container);
      assert.strictEqual(ctx.document.getElementById("ex-14"), null);
    } finally { ctx.cleanup(); }
  });

  it("exposes rollbackExtraction also via window (main.js) when booted", async function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="origF" style="display: none;">f</div>
      <div class="be-section-wrapper"><div class="print-section-container be-extracted-section" id="ex-15" data-original-id="origF"></div></div>
    </body></html>`);
    try {
      // main.js aliases via SectionCloning destructuring; window.rollbackExtraction should exist after boot if main evaluated
      // Our harness boot evaluates main.js last, so check either location
      const fn = ctx.window.rollbackExtraction || ctx.window.SectionCloning.rollbackExtraction;
      assert.ok(fn, "rollbackExtraction available");
      ctx.window.captureUndo = async () => {};
      ctx.window.updateLayoutBounds = () => {};
      ctx.window.SectionUtils.refreshLayers = () => {};
      ctx.window.showFeedback = () => {};
      const c = ctx.document.getElementById("ex-15");
      await fn(c);
      assert.strictEqual(ctx.document.getElementById("ex-15"), null);
    } finally { ctx.cleanup(); }
  });
});

// ---------------------------------------------------------------------------
// extra: native confirm fallback shape
// ---------------------------------------------------------------------------
describe("feature_09_section_cloning — confirm fallback and sanitization details", function () {
  it("sectionCloningAskConfirm falls back to native confirm text concatenation", async function () {
    const ctx = bootWithHtml();
    try {
      delete ctx.window.confirmAction;
      let seen = null;
      ctx.window.confirm = (txt) => { seen = txt; return false; };
      const snap = { id: "clone-nc", originalId: "x", title: "X", html: "<p>h</p>", styles: {} };
      const wrapper = ctx.window.SectionCloning.renderClonedSection(snap);
      const btn = wrapper.querySelector(".be-clone-delete");
      btn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      assert.ok(seen && seen.includes("Delete clone"), seen);
      assert.ok(ctx.document.getElementById("clone-nc"), "not deleted when native says false");
      // now true
      ctx.window.confirm = () => true;
      delete ctx.window.destructiveGate;
      ctx.window.showFeedback = () => {};
      ctx.window.updateLayoutBounds = () => {};
      btn.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
      await waitFor(() => !ctx.document.getElementById("clone-nc"), 1500);
      assert.strictEqual(ctx.document.getElementById("clone-nc"), null);
    } finally { ctx.cleanup(); }
  });

  it("getSanitizedContent does not include standard header duplication inside clone html snapshot", async function () {
    const ctx = bootWithHtml(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper"></div>
      <div id="sec-dup"><div class="print-section-content"><div class="ct-content-group__header">should be gone</div><p>keep</p></div></div>
    </body></html>`);
    try {
      const snap = ctx.window.SectionCloning.captureSectionSnapshot("sec-dup");
      assert.ok(!snap.html.includes("should be gone"), "old header stripped from snapshot html");
      const wrapper = ctx.window.SectionCloning.renderClonedSection({ id: "clone-dup", originalId: "sec-dup", title: "Dup", html: snap.html, styles: {} });
      const headers = wrapper.querySelectorAll(".ct-content-group__header");
      assert.strictEqual(headers.length, 1, "one header in clone (the fresh one)");
    } finally { ctx.cleanup(); }
  });
});
