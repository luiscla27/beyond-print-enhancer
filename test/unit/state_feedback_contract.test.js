/**
 * BEYOND-19 state-feedback contract (track state-feedback-be19).
 *
 * The goal-grounded certification found, UNPROMPTED in 17/19 bundles, that the extension is
 * state-invisible: no progress feedback across a latency boundary, no error state anywhere, no
 * explanation of a transition. Each case below pins ONE seam that closes a named class, and each
 * is written against the thing that can actually rot:
 *
 *  1. `.be-progress` exists as a SURFACE with the theme's own geometry and is print-hidden from
 *     the stylesheet the extension INJECTS (not from source text — a rule that is built but never
 *     injected cannot pass here; same method as print_hides_own_surfaces.test.js).
 *  2. `showProgress`/`clearProgress` are the shared lifetimes: mounted on `document.body`,
 *     announced politely, and `clearProgress` is idempotent (a `finally` and an `afterprint` can
 *     both reach it — a throw on the second call would break the print path).
 *  3. Print is still IMMEDIATE: the marker must not sit in front of `window.print()`. Asserted
 *     as call order, because "it looks fine" is what the pre-fix code looked like too.
 *  4. A failed filter store write is REPORTED, not swallowed (Storage.saveFilter rejects).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "../..");
const MODALS_SRC = fs.readFileSync(path.join(ROOT, "js/modals.js"), "utf8");
const CONTROLS_SRC = fs.readFileSync(path.join(ROOT, "js/controls.js"), "utf8");
const THEME_SRC = fs.readFileSync(path.join(ROOT, "js/ui_theme.js"), "utf8");

function makeDom() {
  return new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "https://www.dndbeyond.com/characters/12345",
    runScripts: "dangerously",
  });
}

/** Brace-matched @media print blocks — a non-greedy regex stops at the first inner close. */
function printBlocks(css) {
  const out = [];
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
    out.push(css.slice(start, i + 1));
  }
  return out;
}

describe("BEYOND-19 state-feedback contract", function () {
  describe("the shared in-flight marker", function () {
    let dom, window, document, Modals;

    before(function () {
      dom = makeDom();
      window = dom.window;
      document = window.document;
      const el = document.createElement("script");
      el.textContent = MODALS_SRC;
      document.body.appendChild(el);
      Modals = window.Modals;
      assert.ok(Modals, "precondition: js/modals.js publishes window.Modals");
    });

    after(function () {
      if (dom) dom.window.close();
    });

    it("exposes showProgress / clearProgress as a pair", function () {
      assert.strictEqual(typeof Modals.showProgress, "function");
      assert.strictEqual(typeof Modals.clearProgress, "function");
    });

    it("mounts a .be-progress node on body, politely announced", function () {
      const node = Modals.showProgress("Preparing your sheet for print…");
      try {
        assert.ok(node, "showProgress returns the node it mounted");
        assert.strictEqual(node.className, "be-progress");
        assert.strictEqual(node.parentNode, document.body);
        assert.strictEqual(node.getAttribute("role"), "status");
        assert.strictEqual(node.getAttribute("aria-live"), "polite");
        assert.match(node.textContent, /Preparing your sheet for print/);
      } finally {
        Modals.clearProgress(node);
      }
      assert.strictEqual(document.querySelectorAll(".be-progress").length, 0);
    });

    it("clearProgress is IDEMPOTENT — the second call must not throw", function () {
      const node = Modals.showProgress("Saving filter…");
      Modals.clearProgress(node);
      // A `finally` and an `afterprint` handler can both reach this node. Throwing here would
      // break the print path itself, which is the failure mode this case exists to prevent.
      assert.doesNotThrow(() => Modals.clearProgress(node));
      assert.doesNotThrow(() => Modals.clearProgress(null));
      assert.doesNotThrow(() => Modals.clearProgress(undefined));
    });

    it("is NOT the toast lane — a marker does not drain on the toast timer", function () {
      const node = Modals.showProgress("Rebuilding…");
      try {
        assert.ok(
          !node.classList.contains("be-feedback"),
          "the marker must not wear the toast's class: a toast drains in ~3 s while an " +
            "operation that crosses a latency boundary does not",
        );
      } finally {
        Modals.clearProgress(node);
      }
    });
  });

  describe("the .be-progress surface in the injected theme", function () {
    let css;

    before(function () {
      const dom = makeDom();
      // js/ui_theme.js is a classic script whose tail also does `module.exports = UiTheme`. Under
      // a bare `eval` there is no `module`, so the tail throws AFTER `injectTheme()` has already
      // run — the stylesheet we want is on the DOM by then. Declaring a throwaway `module` keeps
      // the tail harmless AND lets the case read `UiTheme.css`, which is the SAME string the
      // module injected (so a rule that exists only in the export cannot pass).
      dom.window.eval("var module = { exports: {} };" + "\n" + THEME_SRC);
      const style = dom.window.document.getElementById("ddb-print-ui-theme");
      assert.ok(style, "precondition: js/ui_theme.js injects #ddb-print-ui-theme");
      css = style.textContent;
      assert.ok(
        dom.window.module.exports && dom.window.module.exports.css === css,
        "the exported css and the injected stylesheet must be the same string",
      );
      dom.window.close();
    });

    it("carries the theme's own geometry and the top rung", function () {
      const rule = /\.be-progress\s*\{([^}]*)\}/.exec(css);
      assert.ok(rule, ".be-progress must be declared in the injected theme");
      assert.match(rule[1], /position:\s*fixed/);
      assert.match(
        rule[1],
        /z-index:\s*10001/,
        "it must share .be-ai-busy's rung: two differently-positioned in-flight markers read " +
          "as two subsystems failing",
      );
      assert.match(rule[1], /box-shadow:\s*none\s*!important/);
    });

    it("is print-hidden in the injected @media print block", function () {
      const blocks = printBlocks(css);
      assert.ok(blocks.length, "precondition: the theme has an @media print block");
      const hides = blocks.some((b) =>
        /\.be-progress\b[^{}]*\{[^{}]*display:\s*none\s*!important/.test(b),
      );
      assert.ok(
        hides,
        "a position:fixed marker on screen when the user prints is repeated on EVERY printed " +
          "page — the class of defect print_hides_own_surfaces.test.js was written for",
      );
    });
  });

  describe("the print control's lifecycle", function () {
    it("calls window.print() itself, with no dialog or await in front of it", function () {
      const start = CONTROLS_SRC.indexOf('id: "be-btn-print"');
      assert.ok(start > 0, "precondition: the Print control is still declared");
      const action = CONTROLS_SRC.slice(start, start + 2400);
      // The CALL, not the prose: `window.print()` is also named in the comment above it, so a
      // bare `indexOf` matches the documentation and would pass on a control that never printed.
      const callRe = /window\.print\(\);/;
      const printAt = action.search(callRe);
      assert.ok(printAt > 0, "the control must CALL window.print()");
      assert.ok(!/await\s+window\.print/.test(action), "window.print() is never awaited");
      assert.ok(
        !/showModal|__createModal/.test(action),
        "no dialog may sit in front of the print dialog",
      );
    });

    it("raises the marker BEFORE the print call and clears it on afterprint", function () {
      const start = CONTROLS_SRC.indexOf('id: "be-btn-print"');
      const action = CONTROLS_SRC.slice(start, start + 2400);
      const raiseAt = action.indexOf("showProgress(");
      const printAt = action.search(/window\.print\(\);/);
      const afterAt = action.indexOf('"afterprint"');
      assert.ok(raiseAt > 0, "the control raises the in-flight marker");
      assert.ok(raiseAt < printAt, "the marker is raised BEFORE window.print()");
      assert.ok(afterAt > 0, "the marker is cleared on the browser's own afterprint signal");
    });

    it("the filter commit reports a failed store write instead of swallowing it", function () {
      const start = CONTROLS_SRC.indexOf("slider.onchange = async");
      assert.ok(start > 0, "precondition: the filter commit handler is still declared");
      const handler = CONTROLS_SRC.slice(start, start + 2400);
      assert.match(handler, /showProgress\(/, "the commit raises the in-flight marker");
      assert.match(
        handler,
        /catch\s*\{[\s\S]{0,400}could not be saved/,
        "a rejected store write must produce an error toast — Storage.saveFilter REJECTS, so " +
          "a truthiness check on the resolved value would be dead code",
      );
      assert.match(handler, /clearProgress\(/, "the marker is cleared in a finally");
    });
  });

  /**
   * WHY THIS BLOCK IS SOURCE-READ AND NOT A DOM RUN. `handleSaveBrowser` is an `async` function
   * whose whole job is to AWAIT three seams (`__DDBStorage.init`, `scanLayout`,
   * `saveGlobalLayout`). Driving it end to end needs that entire store stack under jsdom — which
   * is exactly what the e2e already does against the real IndexedDB. What can silently rot here
   * is narrower and structural: is the marker raised BEFORE the first await, and is it cleared on
   * EVERY exit (a `catch`-only clear leaks the marker on the success path, and a pre-await-less
   * raise never covers the very latency it exists for).
   */
  describe("the save-to-browser lifecycle (js/persistence.js)", function () {
    const PERSISTENCE_SRC = fs.readFileSync(path.join(ROOT, "js/persistence.js"), "utf8");

    it("raises the marker BEFORE the first await and clears it in a finally", function () {
      const start = PERSISTENCE_SRC.indexOf("async function handleSaveBrowser");
      assert.ok(start > 0, "precondition: handleSaveBrowser is still declared");
      const end = PERSISTENCE_SRC.indexOf("async function handleSavePC");
      assert.ok(end > start, "precondition: handleSavePC follows it");
      const body = PERSISTENCE_SRC.slice(start, end);

      const raiseAt = body.indexOf("showProgress(");
      const firstAwaitAt = body.search(/\bawait\b/);
      assert.ok(raiseAt > 0, "the save raises the shared in-flight marker");
      assert.ok(firstAwaitAt > 0, "precondition: the save crosses an await");
      assert.ok(
        raiseAt < firstAwaitAt,
        "the marker must be raised BEFORE the first await — raised after it, the user sees " +
          "nothing for exactly the window it exists to cover",
      );
      assert.match(
        body,
        /\}\s*finally\s*\{[\s\S]{0,200}clearProgress\(/,
        "the marker is cleared in a finally, so the success path cannot leak it",
      );
      assert.match(
        body,
        /could not be|Failed to save[\s\S]{0,80}"error"/,
        "a rejected write must still produce an error toast",
      );
    });
  });
});
