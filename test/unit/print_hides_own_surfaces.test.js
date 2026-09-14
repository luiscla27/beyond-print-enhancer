/**
 * The tool's own transient surfaces must never reach the paper.
 * (issue `print_output_never_assessed_20260911`; found by auditing the REAL printed output)
 *
 * WHY THIS SUITE EXISTS, AND WHY IT IS NOT A TEST OF THE CSS FOR ITS OWN SAKE.
 * Every print-related suite in this repo asserted print *configuration* — "the layer carries
 * data-print-disabled", "the injected @media print CSS has a hide rule". None of them had ever
 * looked at a printed page. Measuring the actual output (Chromium's print pipeline, rasterised by
 * pdf.js) found that the extension's boot toast — `showFeedback("No saved layout yet — the default
 * template is loaded.")`, `js/persistence.js:734` — is `position: fixed` and is covered by NO print
 * rule, so it appears at the top of EVERY printed page. Measured on the live demo sheet, before any
 * fix: the toast's sentence was the ONLY text in the whole PDF, present on all four pages (213
 * text-showing operators, 55/53/53/53 characters).
 *
 * The same audit measured the tool's OTHER overlays to be safe: a dialog carrying the id
 * `print-enhance-overlay` and the one-time card `#be-onboarding-hint` both compute to
 * `display: none` in print media and their text does not reach the PDF. So the defect was not
 * "print CSS is missing" — one class of surface was left out of the list, and nothing in the suite
 * could notice, because that list is only ever read by a browser.
 *
 * WHAT MAKES THIS NON-VACUOUS. The rules are read from the stylesheet the extension INJECTS into the
 * page (`#ddb-print-enhance-style`, created by `enforceFullHeight()` at boot) — not from source
 * text, so a rule that is built but never injected cannot pass, and the extractor itself is asserted
 * to have found surfaces we know are in there. And the BASE class must be hidden, not one toast KIND,
 * so a new `be-feedback-<kind>` added tomorrow is covered by construction.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
require("fake-indexeddb/auto");

const ROOT = path.resolve(__dirname, "../..");
const MODALS = fs.readFileSync(path.join(ROOT, "js/modals.js"), "utf8");
const PERSISTENCE = fs.readFileSync(path.join(ROOT, "js/persistence.js"), "utf8");

/**
 * The `@media print` rules of the stylesheet the extension injects, as the browser receives them.
 * Selectors are returned split on commas and trimmed, so membership can be asserted exactly.
 */
function hiddenInPrint(css) {
  // Brace-matched, not regex-terminated: the block we care about contains nested rules, so a
  // non-greedy `.*?\}` stops at the FIRST inner closing brace and silently sees almost nothing.
  const blocks = [];
  const openRe = /@media\s+print\s*\{/g;
  let m;
  while ((m = openRe.exec(css))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    const start = i;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(css.slice(start, i + 1));
  }
  assert.ok(blocks.length, "precondition: the injected stylesheet has an @media print block");

  const out = [];
  for (const block of blocks) {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = ruleRe.exec(block))) {
      if (/display\s*:\s*none\s*!important/.test(r[2])) {
        out.push(...r[1].split(",").map((s) => s.trim()).filter(Boolean));
      }
    }
  }
  return out;
}

/** Does `selectors` cover this exact class/selector, including as one member of a group? */
function covers(selectors, needle) {
  return selectors.some((s) => s === needle || s.split(/\s+/).includes(needle));
}

describe("print media hides the tool's own surfaces (issue print_output_never_assessed_20260911)", function () {
  let dom, window, document, HIDDEN;

  before(async function () {
    dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously",
      resources: "usable",
    });
    window = dom.window;
    const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    document = window.document;
    window.chrome = { runtime: { getURL: (p) => `chrome-extension://mock-id/${p}` } };

    // Same boot order as the other stylesheet suites: the modules `enforceFullHeight()` needs.
    const src = ["js/print_styles.js", "js/section_utils.js", "js/dom/element_wrapper.js", "js/dom/dom_manager.js", "js/layout_ops.js", "js/main.js"]
      .map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"));
    const scriptEl = document.createElement("script");
    scriptEl.textContent = src.join("\n");
    document.body.appendChild(scriptEl);
    await new Promise((r) => setTimeout(r, 150));

    const style = document.getElementById("ddb-print-enhance-style");
    assert.ok(style, "precondition: boot injected #ddb-print-enhance-style");
    HIDDEN = hiddenInPrint(style.textContent);
  });

  after(function () {
    if (dom) dom.window.close();
  });

  it("the extractor really reads the injected print block (so the checks below cannot pass vacuously)", function () {
    assert.ok(
      HIDDEN.length > 0,
      "no `display: none !important` selectors were found inside the injected @media print block — " +
        "the extractor is broken and every assertion below would be vacuous",
    );
    // Surfaces the audit MEASURED to be safe, and which the product has hidden for a long time.
    assert.ok(
      covers(HIDDEN, "#be-onboarding-hint"),
      `the one-time card is hidden in print; extractor saw: ${JSON.stringify(HIDDEN)}`,
    );
    assert.ok(
      covers(HIDDEN, ".print-page-separator"),
      `page separators are hidden in print; extractor saw: ${JSON.stringify(HIDDEN)}`,
    );
  });

  it("the transient feedback lane (.be-feedback) is hidden — measured leaking onto every page", function () {
    assert.ok(
      PERSISTENCE.includes("No saved layout yet"),
      "precondition: the boot notice still goes through the feedback lane",
    );
    assert.ok(
      covers(HIDDEN, ".be-feedback"),
      ".be-feedback must be hidden in print: it is position:fixed, so a toast that is on screen when " +
        "the user prints is repeated on EVERY page of the output. Measured, before this fix: the boot " +
        `toast's sentence was the only text in the whole PDF, on all 4 pages. Hidden selectors: ${JSON.stringify(HIDDEN)}`,
    );
  });

  it("it is the BASE class that is hidden, so every toast KIND is covered by construction", function () {
    const kinds = [...new Set(Array.from(MODALS.matchAll(/be-feedback-([a-z-]+)/g), (m) => m[1]))].filter(
      (k) => !k.endsWith("-"),
    );
    assert.ok(kinds.length >= 2, `precondition: the lane has more than one kind (${kinds.join(", ")})`);
    assert.ok(
      covers(HIDDEN, ".be-feedback"),
      `the base class must be the thing hidden; kinds seen in js/modals.js: ${JSON.stringify(kinds)}`,
    );
    for (const kind of kinds) {
      // Hiding one KIND is the wrong fix even when it looks sufficient today.
      if (HIDDEN.includes(`.be-feedback-${kind}`)) {
        assert.ok(
          covers(HIDDEN, ".be-feedback"),
          `hiding .be-feedback-${kind} instead of the base class leaves every other kind leaking`,
        );
      }
    }
  });

  it("the modal shell stays hidden when a dialog carries no print-hiding id", function () {
    // MEASURED: only ONE dialog passes `id: "print-enhance-overlay"` (js/modals.js:377), which
    // js/controls.js:801 hides by id. Every other dialog from the shared shell keeps the plain
    // `.be-modal-overlay` class, so the class itself must be hidden or those dialogs print.
    assert.ok(
      covers(HIDDEN, ".be-modal-overlay"),
      "a dialog open at print time must not print its scrim; the class is the only thing that " +
        `covers the dialogs that pass no id. Hidden selectors: ${JSON.stringify(HIDDEN)}`,
    );
  });

  it("#be-onboarding-hint and the panel surfaces stay hidden too (measured safe — keep them so)", function () {
    for (const sel of ["#be-onboarding-hint", "#print-enhance-controls"]) {
      assert.ok(
        covers(HIDDEN, sel),
        `${sel} must stay hidden in print; measured display:none in print media`,
      );
    }
  });
});
