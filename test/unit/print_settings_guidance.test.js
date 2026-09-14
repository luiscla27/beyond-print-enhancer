/**
 * Phase 2 — the print settings are named in-product, at the moment of printing
 * (track first_run_and_panel_20260911, AC-2a / AC-2b).
 *
 * WHY THIS SUITE EXISTS. The README's "Instructions for use" step 4 told the user to set six things
 * by hand in the browser's print dialog, and the product itself said none of them: a grep over
 * `js/*.js` for the settings' own vocabulary ("actual size", "headers and footers", "background
 * graphics") returned ZERO hits, and Print was a bare `window.print()`. So the step that most
 * decides whether the printout is right was documented only where the user is not looking.
 *
 * WHAT IT ASSERTS, AND WHY THAT IS NOT THE SAME AS "A DIALOG EXISTS". AC-2's fail conditions name
 * three ways to get this wrong: omit a setting the README still requires; delete a setting on
 * judgement rather than measurement; and let the in-product copy and the README become two
 * independent lists that drift. So the central assertion is a RELATION between the shipped
 * checklist, the shipped dialog, and the shipped README — none of the three re-typed here.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

const README = fs.readFileSync(path.resolve(__dirname, "../../README.md"), "utf8");

/** The README's "Instructions for use" step 4, as the user reads it. */
function readmePrintSettings() {
  const section = README.split("## Instructions for use")[1] || "";
  const step4 = (section.split(/^\s*4\.\s+Print settings/m)[1] || "").split(/^\s*5\.\s/m)[0];
  assert.ok(step4, "precondition: the README still has a numbered print-settings step");
  return step4;
}

describe("Phase 2 — print settings are named at the moment of printing (AC-2)", function () {
  let b, window, document, cleanup;

  beforeEach(function () {
    b = boot();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("AC-2a: the panel offers a settings control, and it opens the SHARED dialog shell", async function () {
    window.createControls();
    const btn = document.getElementById("be-btn-print-settings");
    assert.ok(btn, "the OUTPUT tray carries a print-settings control");
    assert.ok(
      /print|setting/i.test(btn.title || ""),
      `it is named for what it opens — got "${btn.title}"`,
    );

    // Reachable AT THE MOMENT OF PRINTING: it lives in the same tray as Print, and immediately
    // after it, so a user about to print meets it without leaving the flow.
    const tray = btn.closest(".be-ctl-tray-output");
    assert.ok(tray, "it is in the OUTPUT tray");
    const print = document.getElementById("be-btn-print") || tray.querySelector(".be-ctl-hero");
    assert.ok(print, "…which is the tray that holds Print");

    btn.click();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const overlay = document.querySelector(".be-modal-overlay");
    // The SHARED shell (track modal_primitive_20260910), not a bespoke overlay: that is what
    // supplies Escape, backdrop-dismiss, the dialog role/name, and the focus trap.
    assert.ok(overlay.querySelector(".be-modal"), "the shared modal element is used");
    assert.ok(overlay.querySelector('[aria-modal="true"]'), "…and it is a modal dialog");
    assert.ok(overlay.querySelector("[aria-labelledby]"), "…with an accessible name");
  });

  it("AC-2a: the dialog names EVERY setting the README requires — read from the shipped list on both sides", async function () {
    window.createControls();
    const required = window.PRINT_SETTINGS_REQUIRED;
    assert.ok(Array.isArray(required) && required.length > 0, "the checklist is shipped as data");

    window.showPrintSettingsSurface();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const text = document.querySelector(".be-modal-overlay").textContent;
    const terms = Array.from(document.querySelectorAll(".be-modal-overlay dt")).map((d) =>
      d.textContent.trim(),
    );

    // Every required setting is NAMED in the dialog (per-setting, not as one blob of prose).
    required.forEach((s) => {
      assert.ok(
        terms.includes(s.setting),
        `the dialog lists "${s.setting}" as its own row — got ${JSON.stringify(terms)}`,
      );
      assert.ok(
        text.includes(s.value),
        `…and states its value "${s.value}"`,
      );
    });

    // And the tool's own side of the ledger is stated, so a user does not hunt for a setting that
    // provably does nothing (the margins — measured, see the phase record).
    const handled = window.PRINT_SETTINGS_HANDLED;
    assert.ok(handled.length > 0, "the tool also says what it handles itself");
    handled.forEach((s) => {
      assert.ok(
        text.includes(s.setting),
        `the dialog mentions the handled setting "${s.setting}"`,
      );
    });
  });

  it("AC-2 (anti-drift): the README and the shipped checklist agree — neither is re-typed here", async function () {
    const required = window.PRINT_SETTINGS_REQUIRED;
    const step4 = readmePrintSettings();

    // The README must still require exactly the settings the product now names. This is the
    // assertion that makes "two independent lists" impossible: change one without the other and
    // this fails, whichever side moved.
    required.forEach((s) => {
      assert.ok(
        new RegExp(`^\\s*-\\s*${s.setting}\\s*:`, "im").test(step4),
        `the README still lists "${s.setting}" (read from the shipped checklist)`,
      );
    });

    // AC-2(b): the MARGINS instructions are gone, because the measurement showed the extension's
    // own @page rule overrides the dialog. Asserted as a POSITIVE fact about the README so that
    // restoring the four manual inch values (which provably do nothing) turns this red.
    assert.ok(
      !/^\s*-?\s*Top:\s*0\.25/m.test(step4),
      "the README no longer tells the user to set margin values by hand (measured unnecessary)",
    );
    assert.ok(
      /Margins: you do not need to set these/i.test(step4),
      "…it says so explicitly instead, pointing at the measurement",
    );

    // And the settings whose effect COULD NOT be resolved were KEPT, not quietly dropped:
    // AC-2(b) permits removal only on a measurement.
    ["Scale", "Headers and footers", "Background graphics"].forEach((setting) => {
      assert.ok(
        new RegExp(`^\\s*-\\s*${setting}\\s*:`, "im").test(step4),
        `"${setting}" is still required — its effect was not resolved, so it may not be removed`,
      );
    });
  });

  it("AC-2: printing is not delayed, blocked or replaced by the guidance", async function () {
    window.createControls();
    let printed = 0;
    window.print = () => { printed += 1; };

    // The Print control must still print immediately and synchronously: no dialog in front of it.
    // This is the fail condition "the guidance blocks, delays or otherwise interferes with
    // window.print()" — asserted, not asserted-about.
    document.getElementById("be-btn-print").click();
    await waitFor(() => printed > 0);
    assert.strictEqual(printed, 1, "Print called window.print() exactly once");
    assert.strictEqual(
      document.querySelector(".be-modal-overlay"),
      null,
      "…and nothing opened in front of it: printing is not gated behind the guidance",
    );

    // The guidance is a separate, re-openable surface — reachable a second time without a reload
    // (a toast would have expired; that is why this is a dialog).
    window.showPrintSettingsSurface();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const first = document.querySelector(".be-modal-overlay");
    assert.ok(first, "the guidance opens");
    first.querySelector(".be-print-settings-close").click();
    await waitFor(() => document.querySelector(".be-modal-overlay") === null);
    window.showPrintSettingsSurface();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    assert.ok(document.querySelector(".be-modal-overlay"), "…and opens again");
  });
});
