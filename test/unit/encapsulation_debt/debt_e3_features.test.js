/**
 * E3 — Encapsulation-debt regression suite (2026-02-13..17).
 *   f92bc0c Compact mode (#10)
 *   f43433f Spell description sheets (#11)
 *   f69c8c5 Extract section content (#12)
 *   7184598 Section merges (#13)
 *   d0ab569 Mayor refactor (#14)
 * Complementary to the inject-compact, merge, extraction, spell and dom_manager suites.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./debt_harness.js");

/* ------------------------------------------------------------------ */
/* f92bc0c — Compact mode CSS                                          */
/* ------------------------------------------------------------------ */
describe("E3 f92bc0c — compact mode CSS injection", function () {
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

  it("injects a single #ddb-print-compact-style block", function () {
    window.injectCompactStyles();
    window.injectCompactStyles();
    assert.strictEqual(
      document.querySelectorAll("#ddb-print-compact-style").length,
      1,
    );
  });

  it("targets .print-section-container.be-compact-mode", function () {
    window.injectCompactStyles();
    const css = document.getElementById("ddb-print-compact-style").textContent;
    assert.ok(css.includes(".print-section-container.be-compact-mode"));
  });

  it("contains spacing rules for compact headers/rows", function () {
    window.injectCompactStyles();
    const css = document.getElementById("ddb-print-compact-style").textContent;
    assert.ok(css.includes("__header") || css.includes("[class$=\"__header\"]"));
    assert.ok(css.includes("-row") || css.includes("__row-header"));
  });

  it("defines reduction variables for compact containers", function () {
    window.injectCompactStyles();
    const css = document.getElementById("ddb-print-compact-style").textContent;
    assert.ok(css.includes("--reduce-height-by"));
    assert.ok(css.includes("--reduce-width-by"));
  });
});

/* ------------------------------------------------------------------ */
/* f43433f — Spell description sheets (cache contract)                 */
/* ------------------------------------------------------------------ */
describe("E3 f43433f — spell sheet surface + cache", function () {
  let window, cleanup;
  beforeEach(async function () {
    const b = boot("<!DOCTYPE html><html><body></body></html>");
    window = b.window;
    cleanup = b.cleanup;
    await window.Storage.init();
  });
  afterEach(function () {
    cleanup();
  });

  it("exposes the spell-sheet API handles", function () {
    ["createSpellDetailSection", "fetchSpellWithCache", "getCharacterSpells", "injectSpellDetailTriggers"].forEach(
      (h) => assert.strictEqual(typeof window[h], "function", `${h} missing`),
    );
  });

  it("caches a spell and retrieves it by name", async function () {
    await window.Storage.saveSpells([{ name: "Fireball", level: 3 }]);
    const spell = await window.Storage.getSpell("Fireball");
    assert.ok(spell);
    assert.strictEqual(spell.level, 3);
  });

  it("lists cached spells including ours", async function () {
    await window.Storage.saveSpells([
      { name: "Fireball", level: 3 },
      { name: "Cure Wounds", level: 1 },
    ]);
    const all = await window.Storage.getAllSpells();
    const names = all.map((s) => s.name);
    assert.ok(names.includes("Fireball"));
    assert.ok(names.includes("Cure Wounds"));
  });

  it("re-saving a spell by name overwrites the cached entry", async function () {
    await window.Storage.saveSpells([{ name: "Fireball", level: 3 }]);
    await window.Storage.saveSpells([{ name: "Fireball", level: 5 }]);
    const all = await window.Storage.getAllSpells();
    const fireball = all.filter((s) => s.name === "Fireball");
    assert.strictEqual(fireball.length, 1);
    assert.strictEqual(fireball[0].level, 5);
  });
});

/* ------------------------------------------------------------------ */
/* f69c8c5 — Extract section content (renderExtractedSection)          */
/* ------------------------------------------------------------------ */
describe("E3 f69c8c5 — section content capture (snapshot contract)", function () {
  let window, cleanup;
  beforeEach(function () {
    const b = boot(`<!DOCTYPE html><html><body>
      <div id="sec-1" class="print-section-container">
        <div class="print-section-content"><p>Live Content</p></div>
      </div>
    </body></html>`);
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("captureSectionSnapshot returns null for an unknown id", function () {
    assert.strictEqual(window.captureSectionSnapshot("missing-1"), null);
  });

  it("captures html and the originalId from a live container", function () {
    const snap = window.captureSectionSnapshot("sec-1");
    assert.ok(snap);
    assert.strictEqual(snap.originalId, "sec-1");
    assert.ok(snap.html.includes("Live Content"), snap.html);
  });

  it("returns null when the container has no .print-section-content", function () {
    const b2 = boot(
      "<!DOCTYPE html><html><body><div id='bare' class='print-section-container'></div></body></html>",
    );
    assert.strictEqual(b2.window.captureSectionSnapshot("bare"), null);
    b2.cleanup();
  });

  it("captures borderStyle and styles even when unset", function () {
    const snap = window.captureSectionSnapshot("sec-1");
    assert.strictEqual(snap.borderStyle, null);
    assert.ok("width" in snap.styles && "height" in snap.styles);
  });

  it("exposes the extraction entry points", function () {
    assert.strictEqual(typeof window.handleElementExtraction, "function");
    assert.strictEqual(typeof window.captureSectionSnapshot, "function");
    assert.strictEqual(typeof window.rollbackSection, "function");
    assert.strictEqual(typeof window.flagExtractableElements, "function");
  });
});

/* ------------------------------------------------------------------ */
/* 7184598 — Section merges                                            */
/* ------------------------------------------------------------------ */
describe("E3 7184598 — merge execution mechanics", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot(`<!DOCTYPE html><html><body>
      <div id="print-layout-wrapper">
        <div class="be-section-wrapper">
          <div class="print-section-container" id="source-section" data-original-id="orig-source">
            <div class="print-section-header"><span>Source</span></div>
            <div class="print-section-content"><p>Source Content</p></div>
          </div>
        </div>
        <div class="be-section-wrapper">
          <div class="print-section-container" id="target-section" data-original-id="orig-target">
            <div class="print-section-header"><span>Target</span></div>
            <div class="print-section-content"><p>Target Content</p></div>
          </div>
        </div>
      </div>
      <div id="orig-source" style="display:none">Original Source</div>
      <div id="orig-target" style="display:none">Original Target</div>
    </body></html>`);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  function targetRef() {
    return {
      type: "section",
      id: "target-section",
      element: document.getElementById("target-section"),
      name: "Target",
    };
  }

  it("removes the source container after a merge", function () {
    window.handleMergeSections(document.getElementById("source-section"), targetRef());
    assert.strictEqual(document.getElementById("source-section"), null);
  });

  it("moves source content into the target container", function () {
    window.handleMergeSections(document.getElementById("source-section"), targetRef());
    const target = document.getElementById("target-section");
    assert.ok(target.textContent.includes("Source Content"));
    assert.ok(target.textContent.includes("Target Content"));
  });

  it("tracks the source original id on the target", function () {
    window.handleMergeSections(document.getElementById("source-section"), targetRef());
    const target = document.getElementById("target-section");
    const associated = JSON.parse(target.dataset.associatedIds);
    assert.ok(associated.includes("orig-source"));
  });

  it("discovers merge targets across extractable and extracted sections", function () {
    const extra = document.createElement("div");
    extra.className = "be-extractable";
    extra.id = "sheet-target";
    document.querySelector(".print-section-content").appendChild(extra);

    const extracted = document.createElement("div");
    extracted.className = "print-section-container be-extracted-section";
    extracted.id = "floating-target";
    const content = document.createElement("div");
    content.className = "ct-content-group__header-content";
    content.textContent = "Floating Spell";
    extracted.appendChild(content);
    document.body.appendChild(extracted);

    const targets = window.getMergeTargets();
    assert.ok(targets.length >= 2, `expected >=2 targets, got ${targets.length}`);
    assert.ok(targets.some((t) => t.id === "sheet-target"));
    assert.ok(targets.some((t) => t.id === "floating-target"));
  });
});

/* ------------------------------------------------------------------ */
/* d0ab569 — Mayor refactor (DomManager/ElementWrapper)                */
/* ------------------------------------------------------------------ */
describe("E3 d0ab569 — DomManager + ElementWrapper contracts", function () {
  let window, document, cleanup;
  beforeEach(function () {
    const b = boot(
      "<!DOCTYPE html><html><body><div id='probe'>x</div></body></html>",
    );
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("DomManager.getInstance is a singleton", function () {
    const a = window.DomManager.getInstance();
    const b = window.DomManager.getInstance();
    assert.strictEqual(a, b);
  });

  it("dom helpers return ElementWrapper instances", function () {
    const dom = window.DomManager.getInstance();
    assert.ok(window.ElementWrapper);
    assert.ok(dom.getCharacterSheet() instanceof window.ElementWrapper);
    assert.ok(dom.getSheetInner() instanceof window.ElementWrapper);
    assert.ok(dom.getQuickInfo() instanceof window.ElementWrapper);
  });

  it("ElementWrapper hide/show toggle inline display", function () {
    const probe = document.getElementById("probe");
    const wrapper = new window.ElementWrapper(probe);
    wrapper.hide();
    assert.strictEqual(probe.style.display, "none");
    wrapper.show();
    assert.strictEqual(probe.style.display, "");
  });

  it("ElementWrapper.isVisible reflects hidden state", function () {
    const probe = document.getElementById("probe");
    const wrapper = new window.ElementWrapper(probe);
    assert.ok(wrapper.isVisible());
    wrapper.hide();
    assert.ok(!wrapper.isVisible());
  });

  it("ElementWrapper methods are chainable", function () {
    const probe = document.getElementById("probe");
    const wrapper = new window.ElementWrapper(probe);
    assert.strictEqual(wrapper.hide(), wrapper);
    assert.strictEqual(wrapper.show(), wrapper);
    assert.strictEqual(wrapper.toggle(), wrapper);
  });
});
