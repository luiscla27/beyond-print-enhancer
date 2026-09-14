/**
 * Modal listener lifecycle (audit U-22; generalized by track
 * modal_primitive_20260910, AC-6). Re-pointed from `showSliderModal` to
 * `showInputModal` by track dead_exports_20260910 (O-1), because the slider
 * dialog was RETIRED — it had zero production callers, so this pin was asserting
 * the invariant on a dialog the product never opened.
 *
 * HISTORY OF THIS PIN, because it matters that it is still honest:
 * `showSliderModal` used to attach a `keydown` listener to `window` and remove
 * it ONLY inside its Enter and Escape branches. Closing with the mouse left the
 * listener attached forever, so a later Enter re-fired `click()` on the detached
 * Apply button and every re-open leaked another listener holding the modal
 * subtree. That test was FALSIFIED against the pre-fix revision before being
 * trusted (3 failures on the mouse-close paths; 6 passes after the fix).
 *
 * The dialogs now go through the shared `createModal` primitive, whose Esc /
 * focus-trap listener belongs on `document` rather than `window`. So the
 * instrumentation covers BOTH targets: counting only `window` would report zero
 * and silently "pass" a real leak on `document` — the exact class of vacuous
 * assertion this track exists to remove.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const {
  instrumentListeners,
  assertNoLeak,
  trackedModalEvents,
} = require("./helpers/listener_probe.js");

const MODALS = fs.readFileSync(path.resolve(__dirname, "../../js/modals.js"), "utf8");

/** Boot a jsdom page with js/modals.js evaluated and the listener registry
 *  instrumented. */
function boot() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const probe = instrumentListeners(window);
  window.eval(MODALS);
  return { dom, window, probe };
}

const openInput = (window) => window.Modals.showInputModal("Name", "Pick a value", "seed");

const overlayOf = (window) => window.document.querySelector(".be-modal-overlay");

describe("the input modal removes its listeners on every close path (U-22)", function () {
  it("mouse Cancel leaves no listener behind", async function () {
    const { window, probe } = boot();
    const before = probe.snapshot();
    const p = openInput(window);
    assert.ok(
      trackedModalEvents(probe.snapshot()) > 0,
      "the instrumentation actually sees the dialog's listeners (else the absence below is vacuous)",
    );

    window.document.querySelector(".be-modal-cancel").click();
    assert.strictEqual(await p, null, "Cancel resolves null");
    assert.strictEqual(overlayOf(window), null, "the overlay is gone");
    assertNoLeak(assert, probe, before, "mouse Cancel");
  });

  it("mouse OK leaves no listener behind", async function () {
    const { window, probe } = boot();
    const before = probe.snapshot();
    const p = openInput(window);
    window.document.querySelector(".be-modal-ok").click();
    assert.strictEqual(await p, "seed", "OK resolves the trimmed value");
    assertNoLeak(assert, probe, before, "mouse OK");
  });

  it("Escape still cancels and cleans up", async function () {
    const { window, probe } = boot();
    const before = probe.snapshot();
    const p = openInput(window);
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.strictEqual(await p, null);
    assertNoLeak(assert, probe, before, "Escape");
  });

  it("the close X cleans up", async function () {
    const { window, probe } = boot();
    const before = probe.snapshot();
    const p = openInput(window);
    window.document.querySelector(".be-modal-close").click();
    assert.strictEqual(await p, null);
    assertNoLeak(assert, probe, before, "the close X");
  });

  it("a keypress after a mouse close does nothing (no detached-button click)", async function () {
    const { window, probe } = boot();
    const before = probe.snapshot();
    const p = openInput(window);
    window.document.querySelector(".be-modal-cancel").click();
    assert.strictEqual(await p, null);

    for (const key of ["Enter", "Escape"]) {
      window.document.dispatchEvent(
        new window.KeyboardEvent("keydown", { key, bubbles: true }),
      );
    }
    assertNoLeak(assert, probe, before, "a keypress after a mouse close");
    assert.strictEqual(overlayOf(window), null, "and nothing is resurrected");
  });

  it("does not accumulate listeners across repeated opens", async function () {
    const { window, probe } = boot();
    const before = probe.snapshot();
    for (let i = 0; i < 5; i++) {
      const p = openInput(window);
      window.document.querySelector(".be-modal-cancel").click();
      await p;
      assertNoLeak(assert, probe, before, `open/close cycle #${i + 1}`);
    }
  });
});
