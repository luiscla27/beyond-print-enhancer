/**
 * Browser E2E — PR #17 "Shapes" (shape_decoration_20260223, core): the
 * original decorative-shapes feature — a shapes asset directory exposed to
 * the Add Shape picker (both the borders and shapes categories add floating
 * decorations), shapes listed in the Layer Manager thumbnail list, and
 * deletion keeping the sheet and layer list in sync.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The Add Shape picker exposes both Borders and Shapes categories as
 *      addable decorations.
 *   2. Adding a shape from either category creates a .be-shape-wrapper.
 *   3. Newly added shapes appear in the Layer Manager's thumbnail content
 *      list.
 *   4. Deleting a shape removes it from both the sheet and the layer list.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:shapes
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #17 Shapes decoration core (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function unlock(page) {
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

  async function addShapeFromTab(page, tab) {
    await page.evaluate(() => {
      document.getElementById("be-btn-add-shape").click();
    });
    await page.waitForSelector(".be-modal-overlay .be-modal-tab", { timeout: 15000 });
    await page.evaluate((tab) => {
      const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
        (x) => x.textContent === tab,
      );
      t.click();
    }, tab);
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
    await page.waitForTimeout(1800);
  }

  it("the Add Shape picker exposes Borders and Shapes as addable categories", async function () {
    const page = await bootPage(ctx);
    try {
      await unlock(page);
      await page.evaluate(() => {
        document.getElementById("be-btn-add-shape").click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal-tab", { timeout: 15000 });
      const st = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll(".be-modal-tab")).map(
          (t) => t.textContent.trim(),
        );
        const counts = {};
        tabs.forEach((t) => {
          const tab = Array.from(document.querySelectorAll(".be-modal-tab")).find(
            (x) => x.textContent === t,
          );
          tab.click();
          counts[t] = document.querySelectorAll(
            ".be-modal-overlay .be-border-option",
          ).length;
        });
        return { tabs, counts };
      });
      assert.ok(st.tabs.includes("Borders") && st.tabs.includes("Shapes"));
      assert.ok(st.counts.Borders >= 5, "Borders tab populated");
      assert.ok(st.counts.Shapes >= 5, "Shapes tab populated");
    } finally {
      await page.close();
    }
  });

  it("adding a shape from the Borders tab creates a floating decoration", async function () {
    const page = await bootPage(ctx);
    try {
      await unlock(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      await addShapeFromTab(page, "Borders");
      const after = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      assert.ok(after > before, "a border-category asset added a shape wrapper");
    } finally {
      await page.close();
    }
  });

  it("new shapes appear in the Layer Manager thumbnail list", async function () {
    const page = await bootPage(ctx);
    try {
      await unlock(page);
      const thumbsBefore = await page.evaluate(
        () => document.querySelectorAll(".be-layer-item-thumb").length,
      );
      await addShapeFromTab(page, "Shapes");
      const thumbsAfter = await page.evaluate(
        () => document.querySelectorAll(".be-layer-item-thumb").length,
      );
      assert.strictEqual(
        thumbsAfter,
        thumbsBefore + 1,
        "layer manager gained one thumbnail",
      );
      // and the shapes container gained a matching wrapper
      const shapeCount = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      assert.strictEqual(thumbsAfter, shapeCount, "thumbnails mirror shapes");
    } finally {
      await page.close();
    }
  });

  it("deleting a shape removes it from the sheet and the layer list", async function () {
    const page = await bootPage(ctx);
    try {
      await unlock(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      await addShapeFromTab(page, "Shapes");
      const afterAdd = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      assert.ok(afterAdd > before);
      // delete the last (just-added) shape via its Delete control
      const removed = await page.evaluate(() => {
        const ws = document.querySelectorAll(".be-shape-wrapper");
        const w = ws[ws.length - 1];
        const id = w.id;
        const btn = w.querySelector(
          ":scope > .be-section-actions > .be-shape-delete",
        );
        if (!btn) return false;
        btn.click();
        return id;
      });
      // Shape delete is GATED by the in-app confirm + snapshot (`js/main.js` -> `askConfirm`
      // then `destructiveGate` in `js/recovery_ui.js`), so nothing auto-accepts it
      // (ISSUE_browser_e2e_gate_drift_20260912, F1). Drive the modal the product shows.
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
        removed,
        { timeout: 20000 },
      );
      const afterDel = await page.evaluate(() => ({
        shapes: document.querySelectorAll(".be-shape-wrapper").length,
        thumbs: document.querySelectorAll(".be-layer-item-thumb").length,
      }));
      assert.strictEqual(afterDel.shapes, afterAdd - 1);
      assert.strictEqual(
        afterDel.thumbs,
        afterDel.shapes,
        "layer list stays in sync after delete",
      );
    } finally {
      await page.close();
    }
  });
});
