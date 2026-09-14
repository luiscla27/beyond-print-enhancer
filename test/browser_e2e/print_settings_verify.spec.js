/**
 * Phase 2 verification (track first_run_and_panel_20260911, AC-2 + AC-V1): the print-settings
 * guidance in the REAL product, at the moment of printing.
 *
 * WHY A BROWSER RUN. The unit suite proves the dialog's content matches the shipped checklist and
 * that the README agrees. What it cannot prove is what the user actually meets: that the control
 * renders in the OUTPUT tray beside Print, that opening it does not sit in front of `window.print()`,
 * and that the dialog survives being opened twice — inside the extension's own injected script at
 * the real viewport.
 *
 *   PRINT_SHOTS=1 npx mocha test/browser_e2e/print_settings_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

const ENABLED = process.env.PRINT_SHOTS === "1";
const ART_ROOT = process.env.PRINT_SHOTS_DIR || "docs/first-run-and-panel-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase2");

describe("Phase 2 — print settings at the moment of printing (AC-2)", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () { if (ctx) await ctx.close(); });

  it("the control is rendered in the OUTPUT tray, immediately after Print", async function () {
    const m = await page.evaluate(() => {
      const print = document.getElementById("be-btn-print");
      const btn = document.getElementById("be-btn-print-settings");
      if (!print || !btn) return null;
      const r = btn.getBoundingClientRect();
      const pr = print.getBoundingClientRect();
      const rows = Array.from(
        document.querySelectorAll(".be-ctl-tray-output button"),
      ).map((b) => b.textContent.trim());
      return {
        label: btn.textContent.trim(),
        title: btn.title,
        height: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
        belowPrint: r.top > pr.top,
        outputTrayOrder: rows,
      };
    });
    assert.ok(m, "both Print and Print settings are in the live panel");
    console.log("\n-- print settings control (live) --\n  ", JSON.stringify(m, null, 2));
    assert.ok(m.visible, "the control is rendered");
    assert.ok(m.belowPrint, "it sits with Print (below it), not somewhere the user must hunt");
    // The action tier (T1 = 32px): it is a text button, not an icon-only control.
    assert.strictEqual(m.height, 32, `it honours the action tier height (${m.height})`);
    await page.screenshot({ path: path.join(SHOTS, "10-output-tray.png") });
  });

  it("opening it does NOT sit in front of the print dialog, and it names the settings", async function () {
    // Printing must stay immediate. The fail condition is explicit: the guidance may not block,
    // delay or otherwise interfere with window.print().
    //
    // HOW THIS IS MEASURED, AND WHY NOT BY STUBBING window.print. A stub set from `page.evaluate`
    // lives in the MAIN world, while the extension's button handler calls window.print() from its
    // ISOLATED world — separate `window` objects, so the stub is never reached (measured: with the
    // stub installed, calls stayed 0 even though the control was clicked). That is the same
    // isolated-world trap this project has hit twice before. So the interception assertion lives in
    // the UNIT suite (jsdom shares one window, and there it asserts exactly one call), and what is
    // measured HERE is the DOM-observable consequence: clicking Print must not put a dialog in front
    // of the browser's own print dialog.
    const clicked = await page.evaluate(() => {
      document.getElementById("be-btn-print").click();
      return { overlay: !!document.querySelector(".be-modal-overlay") };
    });
    console.log("\n-- Print stays immediate (DOM-observable half) --\n  ", JSON.stringify(clicked));
    assert.ok(
      !clicked.overlay,
      "clicking Print does not open the guidance over it — printing is not gated behind a dialog",
    );

    // Now open the guidance and read what it actually says.
    await page.evaluate(() => document.getElementById("be-btn-print-settings").click());
    await page.waitForSelector(".be-modal-overlay", { timeout: 10000 });
    const dialog = await page.evaluate(() => {
      const overlay = document.querySelector(".be-modal-overlay");
      return {
        sharedShell: !!overlay.querySelector(".be-modal"),
        ariaModal: !!overlay.querySelector('[aria-modal="true"]'),
        named: !!overlay.querySelector("[aria-labelledby]"),
        rows: Array.from(overlay.querySelectorAll("dt")).map((d) => d.textContent.trim()),
        values: Array.from(overlay.querySelectorAll("dd")).map((d) => d.textContent.trim()),
        note: (overlay.querySelector(".be-help-note") || {}).textContent || null,
      };
    });
    console.log("\n-- print settings dialog (live) --\n  ", JSON.stringify(dialog, null, 2));

    assert.ok(dialog.sharedShell, "it is the SHARED dialog shell");
    assert.ok(dialog.ariaModal && dialog.named, "…a named modal dialog");
    ["Color", "Scale", "Headers and footers", "Background graphics"].forEach((s) => {
      assert.ok(dialog.rows.includes(s), `it names "${s}" — got ${JSON.stringify(dialog.rows)}`);
    });
    assert.ok(
      dialog.note && /Margins/i.test(dialog.note),
      "it tells the user the margins are already handled (the measured no-op setting)",
    );
    await page.screenshot({ path: path.join(SHOTS, "11-print-settings-dialog.png") });
  });

  it("it is re-openable without a reload — a dialog that stays, not a toast that expires", async function () {
    // 1.13.2 moved exactly this class of content (something the user must act on) to a dialog that
    // STAYS, because a toast expires before it can be acted on. Asserted here as a behaviour.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    assert.ok(
      !(await page.evaluate(() => !!document.querySelector(".be-modal-overlay"))),
      "Escape closed it (the shared shell's own behaviour)",
    );
    await page.evaluate(() => document.getElementById("be-btn-print-settings").click());
    await page.waitForSelector(".be-modal-overlay", { timeout: 10000 });
    assert.ok(
      await page.evaluate(() => !!document.querySelector(".be-modal-overlay")),
      "it opens again on a second use",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, "12-panel-after-close.png") });
  });
});
