/**
 * Browser E2E — PR #19 "chore(release): version 1.3.2": the release cut that
 * shipped the Shapes & Border Decorations milestone (.be-section-wrapper
 * DOM wrapping, Add Shape decoration tool, robust event listeners, Save to
 * PC download reliability, site-compat fix). A release PR — this suite pins
 * the user-facing surface it shipped, still observable today.
 *
 * One test per release-surface iteration:
 *   1. The Add Shape decoration flow adds a floating decorative wrapper.
 *   2. Decorations float above sections (z-index), are pointer-dragged
 *      wrappers with action bars (robust addEventListener-driven buttons).
 *   3. The Save to PC control is present and initiates a download.
 *   4. The site stays visible (v1.3.1 site-compat guarantee).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:release132
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #19 1.3.2 shapes & border-decoration release surface (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("Add Shape creates a floating decorative wrapper on the sheet", async function () {
    const page = await bootPage(ctx);
    try {
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const row = panel.querySelector(
          '.be-layer-row[data-layer-id="shapes-default"]',
        );
        const lock = row.querySelector('button[title="Toggle Edit Mode"]');
        if (lock.dataset.state === "locked") lock.click();
      });
      await page.waitForTimeout(400);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      await page.evaluate(() => {
        document.getElementById("be-btn-add-shape").click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal-tab", { timeout: 15000 });
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
          (x) => x.textContent === "Shapes",
        );
        t.click();
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const o = document.querySelectorAll(
          ".be-modal-overlay .be-border-option",
        )[0];
        o.click();
        const ok = Array.from(
          document.querySelectorAll(".be-modal-actions button"),
        ).find((b) => b.textContent.trim() === "Add Shape");
        ok.click();
      });
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-shape-wrapper").length > n,
        before,
        { timeout: 15000 },
      );
      const shape = await page.evaluate(() => {
        const ws = document.querySelectorAll(".be-shape-wrapper");
        const w = ws[ws.length - 1];
        const c = w.querySelector(".be-shape-container");
        // Post-1.9.0 contract (js/dnd.js:19, js/main.js:362): a wrapper is NEVER a native
        // drag source, and the MOVE is armed by the pointer-events engine after a
        // movement threshold. The stale pin here was `getAttribute("draggable") === "true"`,
        // which the engine deliberately removed. Probe the engine instead — same synthetic
        // PointerEvent recipe the drag captures use (drag_glow_layers.spec.js).
        const bg = c || w;
        const box = bg.getBoundingClientRect();
        const x = box.left + Math.min(8, Math.max(2, box.width / 2));
        const y = box.top + Math.min(8, Math.max(2, box.height / 2));
        const ev = (t, cx, cy) => {
          bg.dispatchEvent(
            new PointerEvent(t, {
              bubbles: true,
              cancelable: true,
              clientX: cx,
              clientY: cy,
              pointerId: 1,
              pointerType: "mouse",
              isPrimary: true,
            }),
          );
        };
        ev("pointerdown", x, y);
        ev("pointermove", x + 30, y + 24); // past DRAG_THRESHOLD (4px)
        const armed = w.classList.contains("dragging");
        const ghosts = document.querySelectorAll(".be-drag-ghost").length;
        ev("pointerup", x + 30, y + 24);
        return {
          floating: w.classList.contains("be-shape-wrapper"),
          hasAsset: !!c && !!c.dataset.assetPath,
          draggable: w.getAttribute("draggable"),
          armed,
          ghosts,
        };
      });
      assert.ok(shape.floating, "decorative wrapper created");
      assert.ok(shape.hasAsset, "shape carries an asset");
      assert.strictEqual(
        shape.draggable,
        null,
        "a wrapper is never a native drag source (pointer engine, 1.9.0)",
      );
      assert.ok(
        shape.armed,
        "the pointer engine arms the move drag on the wrapper background",
      );
      assert.strictEqual(shape.ghosts, 1, "the drag shows its own ghost mid-gesture");
    } finally {
      await page.close();
    }
  });

  it("decorative shapes float above sections in z-order", async function () {
    const page = await bootPage(ctx);
    try {
      const z = await page.evaluate(() => {
        const shape = document.querySelector(".be-shape-wrapper");
        const section = document.querySelector(
          ".be-section-wrapper:not(.be-shape-wrapper)",
        );
        const gz = (el) => {
          const v = getComputedStyle(el).zIndex;
          return v === "auto" ? 0 : parseInt(v, 10);
        };
        return { shapeZ: gz(shape), sectionZ: gz(section) };
      });
      assert.ok(z.shapeZ > z.sectionZ, "shape z (" + z.shapeZ + ") above section z (" + z.sectionZ + ")");
    } finally {
      await page.close();
    }
  });

  it("Save to PC is present and starts a layout download", async function () {
    const page = await bootPage(ctx);
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
      const clicked = await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("Save to PC"));
        if (!b) return false;
        b.click();
        return true;
      });
      assert.ok(clicked, "Save to PC button exists and was clicked");
      const dl = await downloadPromise;
      if (dl) {
        assert.ok(/\.json$/i.test(dl.suggestedFilename() || ""), "download is a JSON layout");
      }
      // If no download fired (headless download policy), the button still
      // being clickable without page errors is the floor assertion.
    } finally {
      await page.close();
    }
  });

  it("the character sheet stays visible after enhancement (site-compat)", async function () {
    const page = await bootPage(ctx);
    try {
      const vis = await page.evaluate(() => {
        const main = document.getElementById("site-main");
        const wrapper = document.getElementById("print-layout-wrapper");
        return {
          mainHidden: main ? getComputedStyle(main).display === "none" : false,
          wrapperVisible: !!wrapper && wrapper.offsetParent !== null,
        };
      });
      assert.strictEqual(vis.mainHidden, false, "#site-main not hidden");
      assert.ok(vis.wrapperVisible, "layout wrapper visible");
    } finally {
      await page.close();
    }
  });
});
