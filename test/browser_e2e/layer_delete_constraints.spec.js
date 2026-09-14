/**
 * Browser E2E — PR #32 "New delete buttons" (layer_improvements_20260424):
 * per-layer deletion and shape-addition constraints around the Layer
 * Management panel.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Shape layers expose a Delete Layer control; the built-in Sections
 *      layer does not.
 *   2. Unlocking a layer makes it the active layer (visual indicator +
 *      others lock); the Add Shape control becomes enabled only while an
 *      active shape layer exists.
 *   3. Adding a new Shape Layer auto-activates it (unlocked, active
 *      highlight) and gives it its own DOM container.
 *   4. The Delete Layer flow (confirm accepted) removes the layer row and
 *      its DOM container.
 *   5. When every layer is locked (no active layer), Add Shape is disabled
 *      again (shape-addition constraint).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:deletes
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #32 Layer delete buttons + shape-addition constraints (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const rowsState = (page) =>
    page.evaluate(() => {
      const panel = document.getElementById("print-enhance-layer-manager");
      return {
        rows: Array.from(panel.querySelectorAll(".be-layer-row")).map((r) => ({
          id: r.dataset.layerId,
          label: r.querySelector("span").textContent,
          active: r.classList.contains("be-active-layer"),
          lockState:
            (r.querySelector('button[title="Toggle Edit Mode"]') || {}).dataset
              ? r.querySelector('button[title="Toggle Edit Mode"]').dataset.state
              : null,
          hasDelete: !!r.querySelector(".be-delete-layer-btn"),
        })),
        addShapeDisabled: (() => {
          const b = document.getElementById("be-btn-add-shape");
          return b ? b.disabled : null;
        })(),
      };
    });

  it("shape layers carry a Delete control; the Sections layer does not", async function () {
    const page = await bootPage(ctx);
    try {
      const s = await rowsState(page);
      const sections = s.rows.find((r) => r.id === "sections");
      const shapes = s.rows.find((r) => r.id.startsWith("shapes"));
      assert.ok(sections && !sections.hasDelete, "Sections layer has no delete");
      assert.ok(shapes && shapes.hasDelete, "shape layer has Delete control");
    } finally {
      await page.close();
    }
  });

  it("unlocking a layer activates it and enables Add Shape", async function () {
    const page = await bootPage(ctx);
    try {
      // Default: shapes locked, sections unlocked/active? unlock the shapes layer
      await domClick(
        page,
        '.be-layer-row[data-layer-id="shapes-default"] button[title="Toggle Edit Mode"]',
      );
      await page.waitForTimeout(500);
      const s = await rowsState(page);
      const shapes = s.rows.find((r) => r.id.startsWith("shapes"));
      const sections = s.rows.find((r) => r.id === "sections");
      assert.strictEqual(shapes.active, true, "unlocked shape layer is active");
      assert.strictEqual(shapes.lockState, "unlocked", "shape layer unlocked");
      assert.strictEqual(sections.lockState, "locked", "sections re-locked");
      assert.strictEqual(
        s.addShapeDisabled,
        false,
        "Add Shape enabled with active layer",
      );
    } finally {
      await page.close();
    }
  });

  it("adding a Shape Layer auto-activates it with its own container", async function () {
    const page = await bootPage(ctx);
    try {
      const countBefore = await page.evaluate(
        () => document.querySelectorAll(".be-layer-row").length,
      );
      await domClick(page, "#print-enhance-add-layer");
      await page.waitForTimeout(600);
      const s = await rowsState(page);
      assert.strictEqual(s.rows.length, countBefore + 1, "new row added");
      const added = s.rows[s.rows.length - 1];
      assert.strictEqual(added.lockState, "unlocked", "new layer unlocked");
      assert.strictEqual(added.active, true, "new layer auto-activated");
      assert.ok(added.hasDelete, "new shape layer has delete control");
      assert.strictEqual(s.addShapeDisabled, false, "Add Shape enabled");
      // its DOM container exists (one shape-layer container beyond defaults)
      const containerCount = await page.evaluate(
        () =>
          document.querySelectorAll(
            "#print-enhance-shapes-container > .be-shape-layer-container",
          ).length,
      );
      assert.ok(
        containerCount >= 2,
        "a second shape layer container should exist, got " + containerCount,
      );
    } finally {
      await page.close();
    }
  });

  it("Delete Layer removes the layer row (confirm accepted)", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(page, "#print-enhance-add-layer");
      await page.waitForTimeout(500);
      const countBefore = await page.evaluate(
        () => document.querySelectorAll(".be-layer-row").length,
      );
      // delete the just-added (last) layer
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const rows = Array.from(panel.querySelectorAll(".be-layer-row"));
        const last = rows[rows.length - 1];
        last.querySelector(".be-delete-layer-btn").click();
      });
      await page.waitForTimeout(600);
      // STALE SPEC, REPAIRED (selection_model_ia_20260910, AC-4). This step used
      // to rely on the NATIVE confirm: the harness accepts any native dialog, so
      // the test passed. Since U-36/1.13.0 the delete goes through the in-app
      // modal primitive, so nothing accepted the confirm, `deleteShapeLayer`
      // never ran, and the row count was unchanged — the assertion was a FALSE
      // NEGATIVE that no longer exercised its own scenario (verified on the
      // pre-change tree: it failed identically there, i.e. this is a spec defect
      // the 1.13.0 track left behind, not a regression). The confirm control is
      // now clicked explicitly, which is what the test's own name promises.
      const confirm = await page.evaluate(() => {
        const overlay = document.querySelector(".be-modal-overlay");
        const ok = overlay && overlay.querySelector(".be-modal-ok");
        if (!ok) return null;
        const verb = ok.textContent.trim();
        ok.click();
        return verb;
      });
      assert.strictEqual(
        confirm,
        "Delete",
        "the in-app confirm must offer the ratified destructive verb (AC-8:" +
          " one verb per action class; the dialog TITLE carries the specifics)",
      );
      await page.waitForTimeout(600);
      const countAfter = await page.evaluate(
        () => document.querySelectorAll(".be-layer-row").length,
      );
      assert.strictEqual(
        countAfter,
        countBefore - 1,
        "layer row removed after delete",
      );
    } finally {
      await page.close();
    }
  });

  it("locking the active layer disables Add Shape (no active layer)", async function () {
    const page = await bootPage(ctx);
    try {
      // unlock shapes-default so it is the active layer
      await domClick(
        page,
        '.be-layer-row[data-layer-id="shapes-default"] button[title="Toggle Edit Mode"]',
      );
      await page.waitForTimeout(400);
      const enabled = await page.evaluate(() => {
        const b = document.getElementById("be-btn-add-shape");
        return b ? b.disabled : null;
      });
      assert.strictEqual(enabled, false, "Add Shape enabled while active");
      // lock it back
      await domClick(
        page,
        '.be-layer-row[data-layer-id="shapes-default"] button[title="Toggle Edit Mode"]',
      );
      await page.waitForTimeout(400);
      const s = await rowsState(page);
      assert.strictEqual(
        s.rows.every((r) => r.lockState === "locked"),
        true,
        "all layers locked",
      );
      assert.strictEqual(
        s.addShapeDisabled,
        true,
        "Add Shape disabled with no active layer",
      );
    } finally {
      await page.close();
    }
  });
});
