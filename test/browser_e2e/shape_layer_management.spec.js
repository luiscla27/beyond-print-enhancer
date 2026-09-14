/**
 * Browser E2E — PR #30 "Layer splitter for shapes" (shape_layer_management_
 * 20260422): multi-layer shape management — distinct shape-layer DOM
 * containers, per-layer panel rows, and shape placement into the active
 * layer.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Shapes live in a dedicated default shape-layer container inside the
 *      shapes container (Sections layer untouched).
 *   2. "Add new Layer" creates a second shape-layer DOM container + panel
 *      row that becomes the active layer.
 *   3. Adding a decorative shape while the new layer is active places the
 *      shape into that layer's container (and its thumbnail list), not the
 *      default layer.
 *   4. Layer rows carry per-layer controls (Print / Visibility / Edit) and
 *      the shape-layer container reflects the layer state.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:shapelayers
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #30 Shape layer management (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const containerState = (page) =>
    page.evaluate(() => {
      const sc = document.getElementById("print-enhance-shapes-container");
      const layerEls = sc
        ? Array.from(sc.querySelectorAll(":scope > .be-shape-layer-container"))
        : [];
      const panel = document.getElementById("print-enhance-layer-manager");
      const rows = Array.from(panel.querySelectorAll(".be-layer-row")).map(
        (r) => ({
          id: r.dataset.layerId,
          label: r.querySelector("span").textContent,
          active: r.classList.contains("be-active-layer"),
        }),
      );
      return {
        containers: layerEls.map((e) => ({
          id: e.id,
          children: e.children.length,
          active: e.classList.contains("be-active-layer"),
        })),
        rows,
        shapeThumbCount:
          panel.querySelectorAll(".be-layer-item-thumb").length,
      };
    });

  async function addShapeViaPicker(page) {
    await page.evaluate(() => {
      document.getElementById("be-btn-add-shape").click();
    });
    await page.waitForSelector(".be-modal-overlay .be-modal-tab", {
      timeout: 15000,
    });
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
        (x) => x.textContent === "Shapes",
      );
      if (t) t.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const opt = document.querySelectorAll(
        ".be-modal-overlay .be-border-option",
      )[0];
      if (opt) opt.click();
      const ok = Array.from(
        document.querySelectorAll(".be-modal-actions button"),
      ).find((b) => b.textContent.trim() === "Add Shape");
      if (ok) ok.click();
    });
    await page.waitForTimeout(2000);
  }

  it("shapes live in a dedicated default shape-layer container", async function () {
    const page = await bootPage(ctx);
    try {
      const s = await containerState(page);
      const sc = await page.evaluate(() => {
        const c = document.getElementById("print-enhance-shapes-container");
        return !!c;
      });
      assert.ok(sc, "shapes container exists");
      assert.strictEqual(s.containers.length, 1, "one default shape layer");
      assert.ok(
        s.containers[0].id === "print-enhance-shapes-layer",
        "default layer container id",
      );
      assert.ok(s.containers[0].children >= 5, "default layer holds shapes");
      // Sections row remains the single hardcoded sections layer.
      assert.strictEqual(
        s.rows.filter((r) => r.id === "sections").length,
        1,
      );
    } finally {
      await page.close();
    }
  });

  it("Add new Layer creates a second shape-layer container that becomes active", async function () {
    const page = await bootPage(ctx);
    try {
      const before = await containerState(page);
      await domClick(page, "#print-enhance-add-layer");
      await page.waitForTimeout(600);
      const after = await containerState(page);
      assert.strictEqual(
        after.containers.length,
        before.containers.length + 1,
        "a second shape-layer container created",
      );
      const added = after.containers[after.containers.length - 1];
      assert.ok(added.id !== "print-enhance-shapes-layer", "new container id");
      assert.strictEqual(added.active, true, "new container is the active layer");
      assert.strictEqual(
        after.rows[after.rows.length - 1].active,
        true,
        "new row active in panel",
      );
      // Sections layer count unchanged.
      assert.strictEqual(
        after.rows.filter((r) => r.id === "sections").length,
        1,
      );
    } finally {
      await page.close();
    }
  });

  it("adding a shape while the new layer is active places it into that layer", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(page, "#print-enhance-add-layer");
      await page.waitForTimeout(500);
      const before = await containerState(page);
      const newLayerId = before.containers[before.containers.length - 1].id;
      // layer id used for the panel row / content list is the row data-layer-id
      const newLayerRowId = before.rows[before.rows.length - 1].id;
      const defaultChildren = before.containers[0].children;
      await addShapeViaPicker(page);
      const after = await containerState(page);
      const newLayer = after.containers.find((c) => c.id === newLayerId);
      const defLayer = after.containers.find(
        (c) => c.id === "print-enhance-shapes-layer",
      );
      assert.ok(newLayer, "new layer container still exists");
      assert.strictEqual(
        newLayer.children,
        1,
        "the added shape should land in the new (active) layer",
      );
      assert.strictEqual(
        defLayer.children,
        defaultChildren,
        "default layer count unchanged",
      );
      // its thumbnail appears in the new layer's content list
      const inList = await page.evaluate(
        (newLayerRowId) => {
          const panel = document.getElementById("print-enhance-layer-manager");
          const list = panel.querySelector(
            `.be-layer-content-list[data-layer="${newLayerRowId}"]`,
          );
          return list ? list.children.length : -1;
        },
        newLayerRowId,
      );
      assert.strictEqual(inList, 1, "new layer list shows the added shape");
    } finally {
      await page.close();
    }
  });

  it("shape-layer rows provide per-layer Print/Visibility/Edit controls", async function () {
    const page = await bootPage(ctx);
    try {
      const ctrl = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        return Array.from(
          panel.querySelectorAll(".be-layer-row[data-layer-id^='shapes']"),
        ).map((r) => ({
          id: r.dataset.layerId,
          titles: Array.from(
            r.querySelectorAll(".be-layer-controls button"),
          ).map((b) => b.title),
        }));
      });
      const any = ctrl[0];
      assert.ok(any, "a shape layer row exists");
      assert.ok(
        any.titles.includes("Skip when printing") &&
          any.titles.includes("Hide on sheet") &&
          any.titles.includes("Toggle Edit Mode"),
        "per-layer print/visibility/edit controls present: " +
          any.titles.join(","),
      );
    } finally {
      await page.close();
    }
  });
});
