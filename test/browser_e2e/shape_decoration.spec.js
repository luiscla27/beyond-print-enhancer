/**
 * Browser E2E — PR #18 "Fixed DND BEYOND COMPATIBILITY & Shapes preview"
 * (shape_decoration_20260223 early work): the Add Shape decoration feature —
 * independent floating decorative elements placed on top of the layout, with
 * a picker over assets/shapes, z-index above sections, resize handles, and a
 * Delete icon.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The Add Shape picker offers decorative assets (from the shapes
 *      directory) in a grid.
 *   2. Adding one creates an independent floating .be-shape-wrapper with a
 *      z-index above layout sections.
 *   3. The floating decoration is resizable (resize handle present) and
 *      interactive (draggable wrapper).
 *   4. The decoration can be removed via its Delete control.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:decoration
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #18 Shape decoration (floating shapes preview) (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /**
   * Unlock the default shapes layer, so its wrappers are armable for a move drag.
   *
   * WHY THIS IS ITS OWN HELPER. The shapes layer starts LOCKED (`js/dom/layer_manager.js`), and
   * the drag engine refuses to arm on a locked wrapper — that refusal is the contract pinned by
   * `shapes_mode_layers.spec.js` ("locking … refuses the move drag"). A case that wants to
   * observe the drag ARMING therefore has to unlock first; this states that precondition
   * explicitly instead of leaving it implicit in a bigger helper.
   */
  async function unlockShapesLayer(page) {
    await page.evaluate(() => {
      const panel = document.getElementById("print-enhance-layer-manager");
      const row = panel.querySelector(
        '.be-layer-row[data-layer-id="shapes-default"]',
      );
      const lock = row.querySelector('button[title="Toggle Edit Mode"]');
      if (lock.dataset.state === "locked") lock.click();
    });
    await page.waitForTimeout(400);
  }

  async function unlockAndAddShape(page) {
    await unlockShapesLayer(page);
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
  }

  it("the Add Shape picker offers decorative shape assets in a grid", async function () {
    const page = await bootPage(ctx);
    try {
      await unlockAndAddShape(page);
      const st = await page.evaluate(() => {
        const opts = document.querySelectorAll(
          ".be-modal-overlay .be-border-option",
        );
        return {
          count: opts.length,
          firstPreview: (() => {
            const p = opts[0] && opts[0].querySelector(".be-border-preview");
            return p ? (getComputedStyle(p).backgroundImage || "").slice(0, 90) : "";
          })(),
        };
      });
      assert.ok(st.count >= 10, "decorative shapes grid populated: " + st.count);
      assert.ok(
        st.firstPreview.includes("assets/shapes/"),
        "first preview is a shapes-directory asset: " + st.firstPreview,
      );
    } finally {
      await page.close();
    }
  });

  it("adding a shape creates an independent floating wrapper above sections", async function () {
    const page = await bootPage(ctx);
    try {
      await unlockAndAddShape(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
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
      const st = await page.evaluate(() => {
        const ws = document.querySelectorAll(".be-shape-wrapper");
        const w = ws[ws.length - 1];
        const c = w.querySelector(".be-shape-container");
        const section = document.querySelector(
          ".be-section-wrapper:not(.be-shape-wrapper)",
        );
        const gz = (el) => {
          const v = getComputedStyle(el).zIndex;
          return v === "auto" ? 0 : parseInt(v, 10);
        };
        return {
          isShapeWrapper: w.classList.contains("be-shape-wrapper"),
          independent: !w.closest(".print-section-container"),
          asset: c ? c.dataset.assetPath : null,
          zAbove: gz(w) > gz(section),
        };
      });
      assert.ok(st.isShapeWrapper, "created a shape wrapper");
      assert.ok(st.independent, "wrapper is independent (not inside a section)");
      assert.ok(st.asset, "decoration carries its asset");
      assert.ok(st.zAbove, "shape floats above sections");
    } finally {
      await page.close();
    }
  });

  it("floating shapes are resizable (handle) and pointer-dragged", async function () {
    const page = await bootPage(ctx);
    try {
      // The shapes layer is LOCKED by default and the engine refuses to arm on a locked
      // wrapper, so the drag half of this case needs the layer unlocked (its refusal is the
      // other half, pinned in `shapes_mode_layers.spec.js`).
      await unlockShapesLayer(page);
      const st = await page.evaluate(() => {
        const shape = document.querySelector(".be-shape-wrapper");
        const inner = shape.querySelector(".print-section-container, .be-shape-container");
        const resize = inner
          ? inner.querySelector(".print-section-resize-handle")
          : shape.querySelector(".print-section-resize-handle");
        // Post-1.9.0 contract (js/dnd.js:19, js/main.js:362): the wrapper is NEVER a
        // native drag source; the MOVE is armed by the pointer-events engine after a
        // movement threshold. Probe the engine rather than the removed `draggable`
        // attribute, and assert its ABSENCE so the pointer-engine guarantee stays pinned.
        const bg = inner || shape;
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
        const armed = shape.classList.contains("dragging");
        const ghosts = document.querySelectorAll(".be-drag-ghost").length;
        ev("pointerup", x + 30, y + 24);
        return {
          draggable: shape.getAttribute("draggable"),
          hasResizeHandle: !!resize,
          actions: !!shape.querySelector(":scope > .be-section-actions"),
          armed,
          ghosts,
          layerLocked: !!shape.closest(".be-layer-locked"),
        };
      });
      assert.strictEqual(
        st.draggable,
        null,
        "a shape wrapper is never a native drag source (pointer engine, 1.9.0)",
      );
      assert.strictEqual(
        st.layerLocked,
        false,
        "precondition: the shapes layer must be unlocked for the drag to be armable",
      );
      assert.ok(
        st.armed,
        "the pointer engine arms the move drag on the shape's background " +
          `(armed ${st.armed}, ghosts ${st.ghosts})`,
      );
      assert.strictEqual(st.ghosts, 1, "the drag shows its own ghost mid-gesture");
      assert.ok(st.hasResizeHandle, "resize handle present on the decoration");
      assert.ok(st.actions, "decoration has its action bar");
    } finally {
      await page.close();
    }
  });

  it("the Delete control removes the decoration", async function () {
    const page = await bootPage(ctx);
    try {
      await unlockAndAddShape(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
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
      const addedId = await page.evaluate(() => {
        const ws = document.querySelectorAll(".be-shape-wrapper");
        const w = ws[ws.length - 1];
        return w.id;
      });
      // Delete via the shape's visible Delete control. GATED by the in-app confirm +
      // snapshot (`js/main.js` -> `askConfirm` then `destructiveGate`), so it is NOT
      // auto-accepted (ISSUE_browser_e2e_gate_drift_20260912, F1).
      await page.evaluate((id) => {
        const w = document.getElementById(id);
        const btn = w.querySelector(
          ":scope > .be-section-actions > .be-shape-delete",
        );
        btn.click();
      }, addedId);
      await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 15000 });
      const verb = await page.evaluate(() => {
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        const text = ok.textContent.trim();
        ok.click();
        return text;
      });
      assert.strictEqual(verb, "Delete", "the in-app confirm offers the destructive verb");
      await page.waitForFunction(
        (id) => !document.getElementById(id),
        addedId,
        { timeout: 20000 },
      );
      assert.ok(true, "decoration removed by its Delete control");
    } finally {
      await page.close();
    }
  });
});
