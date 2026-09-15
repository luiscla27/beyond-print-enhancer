/**
 * Phase 2 verification (track ux_gaps_20260911, AC-2 + AC-V1): the reference surface in the REAL
 * product, with the measurement AC-2 makes the criterion.
 *
 * AC-2's fail condition names the trap this project has fallen into twice: asserting a surface
 * from markup or source instead of a capture. So this reads the LIVE dialog and asserts the six
 * committed gestures are nameable from what the panel actually renders.
 *
 *   HELP_SHOTS=1 npx mocha test/browser_e2e/help_surface_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");

const ENABLED = process.env.HELP_SHOTS === "1";
const ART_ROOT = process.env.HELP_SHOTS_DIR || "vendor/docs/ux-gaps-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase2");

describe("Phase 2 — every feature is discoverable from the real UI (AC-2)", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () {
    if (ctx) await ctx.close();
  });

  it("the panel header exposes the help control in the real panel", async function () {
    const btn = await page.evaluate(() => {
      const b = document.getElementById("be-ctl-help");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { text: b.textContent.trim(), title: b.title, aria: b.getAttribute("aria-label"),
               width: Math.round(r.width), height: Math.round(r.height), visible: r.width > 0 };
    });
    assert.ok(btn, "the help control is in the live panel");
    console.log("\n-- help control (live) --\n  ", JSON.stringify(btn));
    assert.ok(btn.visible, "it is actually rendered");
    assert.strictEqual(btn.text, "?", "the signifier is the question mark");
    // The T2 icon tier: 28x28, per the locked height tiers (AC-4 of an earlier track).
    assert.strictEqual(btn.width, 28, `the control honours the icon tier width (${btn.width})`);
    assert.strictEqual(btn.height, 28, `…and height (${btn.height})`);
    await page.screenshot({ path: path.join(SHOTS, "30-panel-header-help.png") });
  });

  it("opening it in the REAL product teaches all six committed gestures (AC-2c)", async function () {
    const opened = await page.evaluate(() => {
      const b = document.getElementById("be-ctl-help");
      if (!b) return false;
      b.click();
      return true;
    });
    assert.ok(opened, "the control is clickable");
    await page.waitForTimeout(700);
    const surface = await page.evaluate(() => {
      const el = document.querySelector(".be-modal-overlay");
      if (!el) return null;
      return { text: (el.textContent || "").replace(/\s+/g, " ").trim(),
               title: (el.querySelector("h3") || {}).textContent || "" };
    });
    assert.ok(surface, "the surface opened in the live product");
    console.log("\n-- help surface (live) --\n  ", JSON.stringify(surface.text).slice(0, 420));
    await page.screenshot({ path: path.join(SHOTS, "31-help-surface.png") });

    // The six the track committed to, measured on the RENDERED text.
    for (const needle of ["Drag it", "corner", "rotation handle", "Double-click", "Right-click", "Ctrl+Z"]) {
      assert.ok(surface.text.includes(needle), `the live surface teaches "${needle}"`);
    }
    // …and the session-vs-reload distinction lands where a confused user would look.
    assert.ok(/current session/i.test(surface.text), "undo's scope is stated here too");
    assert.ok(/Restore backup/.test(surface.text), "…with the durable path named");

    // The SHARED shell supplies the close paths — proven by closing with Escape.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => !document.querySelector(".be-modal-overlay"));
    assert.ok(closed, "Escape closes it (the shared shell's behaviour, not a bespoke overlay)");
  });

  it("the undo control names its keyboard route in the live panel (AC-2b)", async function () {
    const probe = await contentCall(ctx, "recoveryDepthProbe");
    console.log("\n-- undo control (live) --\n  ", JSON.stringify(probe.undoTitle));
    assert.ok(/Ctrl\+Z/.test(probe.undoTitle), `the tooltip names the shortcut: "${probe.undoTitle}"`);
    assert.ok(/Cmd\+Z/.test(probe.undoTitle), `…and the platform variant`);
    await page.screenshot({ path: path.join(SHOTS, "32-undo-tooltip.png") });
    fs.writeFileSync(path.join(SHOTS, "phase2-probe.json"), JSON.stringify(probe, null, 2));
  });
});
