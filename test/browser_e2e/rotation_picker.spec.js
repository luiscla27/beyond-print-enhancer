/**
 * Browser E2E — PR #20 "Corners" (shape_rotation_20260307): asset migration
 * + the enhanced Add Shape modal (folder tabs + tag filtering) + persistent
 * shape rotation with 15-degree snapping.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The Add Shape modal separates assets into Borders / Shapes tabs.
 *   2. The Shapes tab renders a grid and quick tag filters that narrow the
 *      displayed assets.
 *   3. Selecting a shape asset adds it; the shape carries the asset path.
 *   4. The Rotate control toggles a rotation handle; dragging it rotates
 *      the shape with 15° snapping (dataset.rotation is a multiple of 15).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:corners
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #20 Picker tabs/tags + shape rotation (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function unlockShapes(page) {
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

  async function openAddShape(page) {
    await page.evaluate(() => {
      document.getElementById("be-btn-add-shape").click();
    });
    await page.waitForSelector(".be-modal-overlay .be-modal-tab", { timeout: 15000 });
  }

  it("the Add Shape modal separates assets into Borders and Shapes tabs", async function () {
    const page = await bootPage(ctx);
    try {
      await unlockShapes(page);
      await openAddShape(page);
      const st = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll(".be-modal-tab")).map(
          (t) => t.textContent.trim(),
        );
        return { tabs };
      });
      assert.ok(
        st.tabs.includes("Borders") && st.tabs.includes("Shapes"),
        "Borders + Shapes tabs present: " + st.tabs,
      );
    } finally {
      await page.close();
    }
  });

  it("the Shapes tab renders a grid with tag filters that narrow it", async function () {
    const page = await bootPage(ctx);
    try {
      await unlockShapes(page);
      await openAddShape(page);
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
          (x) => x.textContent === "Shapes",
        );
        t.click();
      });
      await page.waitForTimeout(600);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-modal-overlay .be-border-option").length,
      );
      assert.ok(before >= 10, "shapes grid populated: " + before);
      // apply the 'ornament' tag filter
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal-tags button"),
        ).find((x) => x.textContent.trim() === "ornament");
        b.click();
      });
      await page.waitForTimeout(600);
      const after = await page.evaluate(
        () => document.querySelectorAll(".be-modal-overlay .be-border-option").length,
      );
      assert.ok(after < before, "tag filter narrowed the grid: " + before + " -> " + after);
      // All options carry the tag in their filename/title
      const titles = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).map(
          (o) => o.title || o.textContent,
        ),
      );
      assert.ok(
        titles.length > 0 && titles.every((t) => t.toLowerCase().includes("ornament")),
        "filtered options all ornament-tagged: " + titles.slice(0, 4),
      );
    } finally {
      await page.close();
    }
  });

  it("selecting a shape asset adds a shape carrying that asset path", async function () {
    const page = await bootPage(ctx);
    try {
      await unlockShapes(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      await openAddShape(page);
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
          (x) => x.textContent === "Shapes",
        );
        t.click();
      });
      await page.waitForTimeout(500);
      // The call's SIDE EFFECT is the test: it clicks the first border option and confirms with
      // "Add Shape", which is what produces the shape the next line waits for. The `title` it used to
      // return was never read, so the BINDING was removed (track gate_coverage_20260912, Phase 1) and
      // the CALL kept — deleting the whole statement is what the first attempt did, and the browser
      // gate caught it as a 15 s `waitForFunction` timeout on this very case.
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
      const asset = await page.evaluate(() => {
        const shapes = document.querySelectorAll(".be-shape-wrapper");
        const last = shapes[shapes.length - 1];
        const c = last.querySelector(".be-shape-container");
        return c ? c.dataset.assetPath : null;
      });
      assert.ok(asset && asset.includes("assets/shapes/"),
        "new shape carries a shapes asset path: " + asset);
    } finally {
      await page.close();
    }
  });

  it("Rotate toggles a handle and dragging snaps rotation to 15°", async function () {
    const page = await bootPage(ctx);
    try {
      const shp = await page.evaluate(() => {
        const ws = Array.from(document.querySelectorAll(".be-shape-wrapper"));
        const w = ws.find((x) => x.querySelector(":scope > .be-section-actions > .be-shape-rotate"));
        return w ? w.id : null;
      });
      assert.ok(shp, "a shape with rotate control exists");
      // toggle rotation handle
      await domClick(page, `#${shp} > .be-section-actions > .be-shape-rotate`);
      await page.waitForFunction(
        (id) => !!document.querySelector(`#${id} > .be-rotation-handle`),
        shp,
        { timeout: 10000 },
      );
      // simulate the handle drag: mousedown on handle then mousemove to a
      // point 45° above-right of the wrapper center
      const rot = await page.evaluate((id) => {
        const w = document.getElementById(id);
        const handle = w.querySelector(".be-rotation-handle");
        const r = w.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        handle.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }),
        );
        // point where atan2(dy,dx) = -45° -> angle 315°, +90 = 405 -> snap 45
        const px = cx + 100;
        const py = cy - 100;
        document.dispatchEvent(
          new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: px, clientY: py }),
        );
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        return {
          rotation: parseInt(w.dataset.rotation, 10) || 0,
          transform: w.querySelector(".be-shape-container").style.transform,
        };
      }, shp);
      assert.strictEqual(
        rot.rotation % 15,
        0,
        "rotation snapped to a multiple of 15: " + rot.rotation,
      );
      assert.ok(rot.rotation !== 0, "rotation actually applied: " + rot.rotation);
    } finally {
      await page.close();
    }
  });
});
