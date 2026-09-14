/**
 * Manual Verification — Phase 3 (IA & token consistency, AC-6..AC-10) — AUTOMATED.
 *
 * The automated form of "Conductor - User Manual Verification 'Phase 3'". Per
 * conductor/workflow.md §3.1 a checkpoint is a user-facing walkthrough with
 * expected results; the walkthrough below is asserted instead of eyeballed.
 *
 * The walkthrough:
 *   1. "Hover a layer row's controls / read their labels" -> two controls that each say what they
 *                                                            do (print exclusion vs on-screen
 *                                                            visibility), not two names for one thing
 *   2. "Make the window narrow"                           -> the panels stop eating the sheet and
 *                                                            the layer panel collapses to its header
 *   3. "Press Restore on that header"                     -> the layer rows come back (never a dead end)
 *   4. "Open a dialog while narrow"                       -> it fits the window with no sideways overflow
 *
 * Steps 2-3 assert the geometry that a human would judge by eye, measured instead:
 * both panels inside the viewport, no overlap between them, and the sheet keeping
 * a usable share of the width at each stage.
 *
 * Run via: npm run test:e2e:verify3
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

/** Panel geometry + the sheet band the two docked panels leave free. */
const READ_GEOMETRY = () => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  };
  const controls = box(document.getElementById("print-enhance-controls"));
  const layers = box(document.getElementById("print-enhance-layer-manager"));
  const vw = window.innerWidth;
  const controlsHidden = !controls || controls[2] === 0;
  const layersHidden = !layers || layers[2] === 0;
  const freeLeft = controlsHidden ? 0 : controls[0] + controls[2];
  const freeRight = layersHidden ? vw : layers[0];
  const panel = document.getElementById("print-enhance-layer-manager");
  return {
    viewport: [vw, window.innerHeight],
    controlsBox: controls,
    layersBox: layers,
    freeBand: Math.round(freeRight - freeLeft),
    bandShare: Number(((freeRight - freeLeft) / vw).toFixed(3)),
    panelsOverlap:
      !!(controls && layers) &&
      !(controls[0] + controls[2] <= layers[0] || layers[0] + layers[2] <= controls[0]),
    panelHidden: !!(panel && getComputedStyle(panel).display === "none"),
    rail: (() => {
      if (!panel) return null;
      const header = panel.querySelector(".be-layer-panel-header");
      const btn = header && header.querySelector("button");
      const pr = panel.getBoundingClientRect();
      const rowsInside = Array.from(panel.querySelectorAll(".be-layer-row")).filter((r) => {
        const rr = r.getBoundingClientRect();
        return rr.height > 0 && rr.top < pr.bottom - 2;
      }).length;
      return {
        minimized: panel.classList.contains("minimized"),
        height: Math.round(pr.height),
        headerVisible: !!(header && header.getBoundingClientRect().height > 0),
        controlLabel: btn ? btn.textContent.trim() : null,
        rowsInsidePanel: rowsInside,
      };
    })(),
  };
};

describe("Manual verification — Phase 3 (IA & token consistency)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the four-step consistency walkthrough behaves as documented", async function () {
    const page = await bootPage(ctx);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
      await page.waitForTimeout(1500);

      /* Step 1 — "Each per-layer control says what it does." */
      const controls = await page.evaluate(() => {
        const row = document.querySelector("#print-enhance-layer-manager .be-layer-row");
        if (!row) return null;
        return Array.from(row.querySelectorAll(".be-layer-controls button")).map((b) => ({
          title: b.title,
          aria: b.getAttribute("aria-label"),
        }));
      });
      assert.ok(controls && controls.length >= 3, "a layer row offers its controls");
      const titles = controls.map((c) => c.title);
      assert.ok(
        titles.includes("Skip when printing") && titles.includes("Hide on sheet"),
        "step 1: the print/visibility pair is one question each: " + JSON.stringify(titles),
      );
      const print = controls.find((c) => c.title === "Skip when printing");
      const view = controls.find((c) => c.title === "Hide on sheet");
      assert.ok(
        print.aria && /skip .*print|print/i.test(print.aria),
        "step 1: the print control's aria-label names printing: " + print.aria,
      );
      assert.ok(
        view.aria && /(sheet|hide|show)/i.test(view.aria),
        "step 1: the visibility control's aria-label names the sheet: " + view.aria,
      );
      assert.notStrictEqual(
        print.aria,
        view.aria,
        "step 1: …and the two labels do not overlap",
      );

      /* Step 2 — "Make the window narrow." */
      const stages = [
        [900, 0.25],
        [700, 0.25],
        [560, 0.25],
      ];
      for (const [width, minShare] of stages) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(800);
        const g = await page.evaluate(READ_GEOMETRY);
        assert.ok(
          !g.panelsOverlap,
          `step 2 @${width}px: the two panels do not overlap each other`,
        );
        assert.ok(
          [g.controlsBox, g.layersBox].every(
            (b) => !b || (b[0] >= 0 && b[0] + b[2] <= g.viewport[0] + 1),
          ),
          `step 2 @${width}px: both panels stay inside the window`,
        );
        assert.ok(
          g.bandShare >= minShare,
          `step 2 @${width}px: the sheet keeps at least ${minShare * 100}% of the width ` +
            `(measured ${(g.bandShare * 100).toFixed(1)}% = ${g.freeBand}px)`,
        );
        if (width <= 700) {
          assert.ok(
            g.rail && g.rail.minimized && g.rail.height <= 40,
            `step 2 @${width}px: the layer panel has collapsed to its header, leaving the rest ` +
              `to the sheet — rail=${JSON.stringify(g.rail)}`,
          );
        }
      }

      /* Step 3 — "Press Restore." */
      const railBefore = await page.evaluate(READ_GEOMETRY);
      assert.ok(
        railBefore.rail && railBefore.rail.rowsInsidePanel === 0,
        "step 3: at the narrow width the rows are out of the way",
      );
      const restored = await page.evaluate(() => {
        const before = document.getElementById("print-enhance-layer-manager");
        const btn = before.querySelector(".be-layer-panel-header button");
        if (!btn) return null;
        const label = btn.textContent.trim();
        btn.click();
        // toggleMinimize() REBUILDS the panel, so re-query rather than reuse the ref.
        const after = document.getElementById("print-enhance-layer-manager");
        const pr = after.getBoundingClientRect();
        const rows = Array.from(after.querySelectorAll(".be-layer-row")).filter((r) => {
          const rr = r.getBoundingClientRect();
          return rr.height > 0 && rr.top < pr.bottom - 2;
        }).length;
        return { label, height: Math.round(pr.height), rows, minimized: after.classList.contains("minimized") };
      });
      assert.ok(restored, "step 3: the rail header carries a control");
      assert.strictEqual(
        restored.label,
        "Restore",
        "step 3: the control is WORDED, so a user can tell what it does (a bare glyph was not " +
          "identifiable in the phase's visual-gate frames)",
      );
      assert.ok(
        restored.rows > 0 && restored.height > 40 && !restored.minimized,
        "step 3: pressing it brings the layer rows back — " + JSON.stringify(restored),
      );

      /* Step 4 — "Open a dialog while narrow." */
      await page.setViewportSize({ width: 560, height: 900 });
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const b = document.getElementById("be-btn-add-shape");
        if (b) b.click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 20000 });
      await page.waitForTimeout(1200);
      const dialog = await page.evaluate(() => {
        const m = document.querySelector(".be-modal-overlay .be-modal");
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return {
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          viewportWidth: window.innerWidth,
          fits: r.left >= -1 && r.left + r.width <= window.innerWidth + 1,
          sidewaysOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          inlineWidth: m.style.width || "(none)",
        };
      });
      assert.ok(dialog, "step 4: the shape picker opened");
      assert.ok(
        dialog.fits,
        "step 4: the dialog fits the narrow window — " + JSON.stringify(dialog),
      );
      assert.strictEqual(
        dialog.sidewaysOverflow,
        false,
        "step 4: …with no sideways overflow of the page",
      );
      assert.strictEqual(
        dialog.inlineWidth,
        "(none)",
        "step 4: …because no inline pixel width overrides the shared dialog rule",
      );
    } finally {
      await page.close().catch(() => {});
    }
  });
});
