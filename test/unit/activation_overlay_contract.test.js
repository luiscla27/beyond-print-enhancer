/**
 * BEYOND-18 — activation overlay contract (track activation-overlay-be18, plan step 2 RED phase).
 *
 * The certified absence class (goal-grounded re-cert, unprimed v3 arm, 12/19
 * bundles): the enhancement sequence runs with NO extension-owned loading
 * affordance — the only spinner on screen belongs to D&D Beyond, so a
 * first-run user watches the website load, then a wholly new UI appears with
 * no indication an extension did it.
 *
 * This file asserts the CONTRACT the fix must satisfy, evaluated against the
 * REAL production boot (js/main.js) in JSDOM — not against a hand-written
 * fixture. Until js/activation_overlay.js exists and main.js mounts/dismisses
 * it, these tests fail. That failure IS the Red phase.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..", "..");

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}

// The production content-script list, parsed from the source the browser runs.
function productionFiles() {
  const bg = read("js/background.js");
  const m = /files:\s*\[([\s\S]*?)\]/.exec(bg);
  if (!m) throw new Error("Could not parse files array from js/background.js");
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
}

describe("BEYOND-18 — activation overlay contract", function () {
  let dom, window, document;

  before(function () {
    dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
      <div class="ct-subsections"><section><header>Skills</header></section></div>
    </body></html>`, { url: "https://www.dndbeyond.com/characters/151911403", pretendToBeVisual: true });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.NodeList = window.NodeList;
    global.Node = window.Node;
    window.__DDB_TEST_MODE__ = true;
    require("fake-indexeddb/auto");
    window.__DDB_TEST_MODE__ = true;
  });

  it("1. the overlay module is part of the production injection list", function () {
    const files = productionFiles();
    assert.ok(
      files.some((f) => /activation_overlay/i.test(f)),
      "no activation-overlay module in the production files list: " + files.join(","),
    );
  });

  it("2. the module mounts an overlay node at boot with the contract id + state", function () {
    const src = read("js/activation_overlay.js");
    const mod = { exports: {} };
    new Function("window", "document", "module", "exports", src)(
      window, document, mod, mod.exports,
    );
    const overlay = document.getElementById("be-activation-overlay");
    assert.ok(overlay, "no #be-activation-overlay in the DOM after module evaluation");
    assert.strictEqual(
      overlay.getAttribute("data-be-activation-state"),
      "active",
      "overlay must be mounted ACTIVE at boot",
    );
    assert.ok(
      /Enhancing sheet/i.test(overlay.textContent || ""),
      "overlay must name what is happening ('Enhancing sheet…'), not a bare spinner",
    );
    assert.ok(
      /print enhance/i.test(overlay.textContent || ""),
      "overlay must name the extension (attribution is the certified gap)",
    );
  });

  it("3. the overlay is dismissible and the dismiss handle is exported", function () {
    const src = read("js/activation_overlay.js");
    const mod = { exports: {} };
    new Function("window", "document", "module", "exports", src)(
      window, document, mod, mod.exports,
    );
    const api = window.__DDBActivationOverlay || mod.exports;
    assert.ok(api && typeof api.dismiss === "function", "module must export dismiss()");
    api.dismiss({ restored: true });
    const overlay = document.getElementById("be-activation-overlay");
    assert.strictEqual(
      overlay.getAttribute("data-be-activation-state"),
      "dismissed",
      "dismiss() must flip the state attribute (removal alone is a blind spot for the camera)",
    );
  });

  it("4. the overlay is styled by the extension's own theme vocabulary (not D&D Beyond's spinner)", function () {
    const css = read("js/ui_theme.js");
    assert.ok(
      /be-activation-overlay/.test(css),
      "the locked theme stylesheet (js/ui_theme.js) must carry .be-activation-overlay rules — the affordance must read as extension chrome, leather-and-bone, not the host site",
    );
  });

  it("5. main.js mounts before Storage.init() and dismisses after restore/announceBootRestore", function () {
    const main = read("js/main.js");
    const mountAt = main.indexOf("mountActivationOverlay");
    // LAST dismissal = the boot-completion dismissal (the first is the re-run
    // prompt's own unwedge path — both must exist, both must be after mount).
    const dismissAt = main.lastIndexOf("dismissActivationOverlay");
    const promptDismissAt = main.indexOf("dismissActivationOverlay");
    const storageAt = main.indexOf("await Storage.init()");
    const restoreAt = main.indexOf("await restoreLayout()");
    assert.ok(mountAt !== -1, "main.js must mount the overlay");
    assert.ok(dismissAt !== -1, "main.js must dismiss the overlay");
    assert.notStrictEqual(promptDismissAt, dismissAt, "both dismissal paths must exist (boot completion + re-run prompt unwedge)");
    assert.ok(
      mountAt !== -1 && storageAt !== -1 && mountAt < storageAt,
      "mount must precede Storage.init() — the overlay owns the whole transition",
    );
    assert.ok(
      dismissAt !== -1 && restoreAt !== -1 && dismissAt > restoreAt,
      "boot-completion dismissal must follow the restore/apply sequence — the overlay lives until the sheet is enhanced",
    );
  });

  it("6. boot safety: module is fail-open (no document/head => no throw, no mount)", function () {
    const src = read("js/activation_overlay.js");
    const bare = { window: {}, document: undefined };
    assert.doesNotThrow(() => {
      new Function("window", "document", "module", "exports", src)(
        bare.window, bare.document, {}, {},
      );
    }, "module must fail open on harness boots without a document (peer-module convention)");
  });
});
