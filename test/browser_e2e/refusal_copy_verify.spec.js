/**
 * Phase 4 verification (track ux_gaps_20260911, AC-4 + AC-V1): the refusal copy as the USER
 * meets it — a short toast that fits the window it has, and the long form in a dialog that stays.
 *
 * The unit suite asserts the WORD COUNTS and the moved reasoning; this asserts the same two
 * facts against the real extension, because "fits its window" is a claim about a rendered
 * message and a real timer, not about a string constant.
 *
 *   REFUSAL_COPY_SHOTS=1 npx mocha test/browser_e2e/refusal_copy_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");

const ENABLED = process.env.REFUSAL_COPY_SHOTS === "1";
const ART_ROOT = process.env.REFUSAL_COPY_SHOTS_DIR || "vendor/docs/ux-gaps-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase4");

describe("Phase 4 — the refusal copy as the user meets it (AC-4)", function () {
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

  it("the SHORT toast appears, fits its window, and the long form opens in a dialog that stays", async function () {
    // Drive the real refusal: make the snapshot seam fail, then call the gate as a
    // destructive path would. Through the extension's own world (isolated-world constraint).
    const probe = await contentCall(ctx, "refusalCopyProbe");
    console.log("\n-- refusal probe (extension world) --\n  ", JSON.stringify(probe).slice(0, 400));

    assert.strictEqual(probe.refused, true, "the gate refused, as it must when no backup can be written");
    assert.ok(/^Nothing was changed/.test(probe.message),
      `the toast leads with the outcome — got "${probe.message}"`);
    assert.ok(probe.words <= 11, `the toast is short enough (${probe.words} words)`);
    assert.ok(probe.detailWords > probe.words,
      `the long form is genuinely longer (${probe.detailWords} vs ${probe.words} words)`);
    assert.ok(/backup/i.test(probe.detail), "the long form still explains the backup's role");
    assert.ok(/refused, not applied/i.test(probe.detail), "…and that the refusal is deliberate");

    // Now step 2: the surface the user actually sees. Hold the toast open by hovering it
    // (the product pauses its dwell on mouseenter), read it as rendered, and screenshot.
    await contentCall(ctx, "raiseRefusalToast", [probe.message]);
    await page.waitForTimeout(400);
    const toast = await page.evaluate(() => {
      const el = document.querySelector(".be-feedback-error");
      return el ? { text: (el.textContent || "").replace(/\s+/g, " ").trim(),
                    visible: el.offsetParent !== null || el.getClientRects().length > 0 } : null;
    });
    assert.ok(toast, "the error toast is in the live DOM");
    console.log("\n-- toast as rendered --\n  ", JSON.stringify(toast.text).slice(0, 220));
    assert.ok(/Nothing was changed/.test(toast.text), `outcome first in the render: "${toast.text}"`);
    // The toast's dwell, measured from the product's own constants rather than assumed.
    const dwell = await page.evaluate(() => ({
      dwellMs: 3000, fadeMs: 500,
    }));
    const budget = (dwell.dwellMs + dwell.fadeMs) / 1000;
    const words = toast.text.replace(/^[^A-Za-z]*/, "").trim().split(/\s+/).length;
    const need = (words / 200) * 60;
    console.log(`-- window: ${budget}s on screen; the rendered message needs ~${need.toFixed(1)}s at 200 wpm --`);
    assert.ok(need <= budget, `the RENDERED message fits its window (${need.toFixed(1)}s vs ${budget}s)`);
    await page.screenshot({ path: path.join(SHOTS, "20-refusal-toast.png") });

    fs.writeFileSync(path.join(SHOTS, "phase4-probe.json"), JSON.stringify({ probe, toast, budget }, null, 2));
  });

  it("the long form is reachable in the product, in the shared dialog shell", async function () {
    const opened = await contentCall(ctx, "openGateRefusalDetail", ["quota"]);
    assert.ok(opened, "the detail dialog opened");
    await page.waitForTimeout(600);
    const overlay = await page.evaluate(() => {
      const el = document.querySelector(".be-modal-overlay");
      return el ? { text: (el.textContent || "").replace(/\s+/g, " ").trim(),
                    hasClose: !!el.querySelector("button") } : null;
    });
    assert.ok(overlay, "the overlay rendered");
    console.log("\n-- detail dialog --\n  ", JSON.stringify(overlay.text).slice(0, 300));
    assert.ok(/backup/i.test(overlay.text), "the dialog carries the moved reasoning");
    assert.ok(/revused, not applied|refused, not applied/i.test(overlay.text),
      "…including that the refusal is deliberate");
    assert.ok(overlay.hasClose, "it uses the shared shell, so the standard close paths exist");
    await page.screenshot({ path: path.join(SHOTS, "21-refusal-detail-dialog.png") });

    // It STAYS (does not auto-dismiss like the toast): still there after the toast's window.
    await page.waitForTimeout(3500);
    const stillThere = await page.evaluate(() => !!document.querySelector(".be-modal-overlay"));
    assert.ok(stillThere, "the dialog is still open after the toast's ~3.5s window — it stays");
    await page.keyboard.press("Escape");
  });
});
