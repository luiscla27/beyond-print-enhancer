/**
 * Browser E2E — PR #21 "Refinements" (shape_lockdown_switch_20260307 + print
 * opacity consolidation): the shape Quick Switch that preserves the shape's
 * transform, and the print pass that makes shapes fully opaque while
 * strictly hiding UI chrome.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The shape menu's Switch Shape Asset opens the picker pre-filtered to
 *      the shape's own category.
 *   2. Switching the asset preserves the shape's transform (position,
 *      rotation dataset) while updating the asset path.
 *   3. The consolidated print CSS makes shapes fully opaque and hides the
 *      interactive UI (headers/actions/handles) inside @media print.
 *
 * Note: the "Shapes Mode OFF lockdown" from this PR has since evolved into
 * the per-layer Edit lock (covered by the PR #33/#26 suites); here we pin
 * the still-observable quick-switch + print-opacity iterations.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:quickswitch
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #21 Quick switch + print opacity (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function pickShapeWrapper(page, { withMenu = ".be-shape-switch" } = {}) {
    const info = await page.evaluate((menuSel) => {
      const ws = Array.from(document.querySelectorAll(".be-shape-wrapper"));
      const w = ws.find((x) => {
        const menu = x.querySelector(":scope > .be-section-actions > .be-context-menu");
        return menuSel ? menu && menu.querySelector(menuSel) : !!x;
      });
      if (!w) return null;
      const cont = w.querySelector(".be-shape-container");
      return { id: w.id, asset: cont ? cont.dataset.assetPath : null };
    }, withMenu);
    assert.ok(info, "shape with switch menu not found");
    return info;
  }

  it("Switch Shape Asset opens the picker pre-filtered to Shapes", async function () {
    const page = await bootPage(ctx);
    try {
      const shp = await pickShapeWrapper(page);
      await domClick(page, `#${shp.id} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(
        page,
        `#${shp.id} > .be-section-actions > .be-context-menu > .be-shape-switch`,
      );
      await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
      const state = await page.evaluate((asset) => {
        const tabs = Array.from(document.querySelectorAll(".be-modal-tab")).map(
          (t) => t.textContent.trim(),
        );
        // the folder filter hides the tab bar (filterFolder set) for shapes
        const tabBar = document.querySelector(".be-modal-tabs");
        const first = document.querySelector(".be-modal-overlay .be-border-option");
        return {
          tabs,
          isShapeFolder: asset && asset.includes("assets/shapes/"),
          tabBarHidden: tabBar ? tabBar.style.display === "none" : true,
          firstInShapesDir: (() => {
            const p = first && first.querySelector(".be-border-preview");
            return p ? (getComputedStyle(p).backgroundImage || "").includes("assets/shapes/") : false;
          })(),
        };
      }, shp.asset);
      assert.ok(
        state.tabBarHidden,
        "folder-filtered picker hides the tab bar",
      );
      assert.ok(
        state.firstInShapesDir,
        "previews are shapes-directory assets (pre-filtered to Shapes)",
      );
    } finally {
      await page.close();
    }
  });

  it("switching a shape's asset preserves its transform and updates the path", async function () {
    const page = await bootPage(ctx);
    try {
      const shp = await pickShapeWrapper(page);
      // give the shape a rotation and a position
      await page.evaluate((id) => {
        const w = document.getElementById(id);
        w.style.left = "123px";
        w.style.top = "77px";
        w.dataset.rotation = "45";
      }, shp.id);
      const before = await page.evaluate((id) => {
        const w = document.getElementById(id);
        return { left: w.style.left, top: w.style.top, rotation: w.dataset.rotation };
      }, shp.id);
      await domClick(page, `#${shp.id} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(
        page,
        `#${shp.id} > .be-section-actions > .be-context-menu > .be-shape-switch`,
      );
      await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
      // choose a different option (not the current asset)
      const clicked = await page.evaluate((cur) => {
        const opts = Array.from(
          document.querySelectorAll(".be-modal-overlay .be-border-option"),
        );
        const target =
          opts.find((o) => (o.title || "") !== cur && !o.classList.contains("selected")) ||
          opts[opts.length - 1];
        target.click();
        const ok = Array.from(
          document.querySelectorAll(".be-modal-actions button"),
        ).find((b) => b.textContent.trim() === "Switch Asset");
        ok.click();
        return true;
      }, shp.asset);
      assert.ok(clicked, "an alternate asset was picked");
      await page.waitForFunction(
        ({ id, cur }) => {
          const w = document.getElementById(id);
          const c = w.querySelector(".be-shape-container");
          return c && c.dataset.assetPath !== cur;
        },
        { id: shp.id, cur: shp.asset },
        { timeout: 15000 },
      );
      const after = await page.evaluate((id) => {
        const w = document.getElementById(id);
        const c = w.querySelector(".be-shape-container");
        return { left: w.style.left, top: w.style.top, rotation: w.dataset.rotation, asset: c.dataset.assetPath };
      }, shp.id);
      assert.ok(after.asset !== shp.asset, "asset path updated: " + after.asset);
      assert.ok(after.asset.endsWith(".webp"), "new asset is a .webp file");
      assert.strictEqual(after.left, before.left, "left preserved");
      assert.strictEqual(after.top, before.top, "top preserved");
      assert.strictEqual(after.rotation, "45", "rotation preserved");
    } finally {
      await page.close();
    }
  });

  it("print CSS makes shapes fully opaque and hides the UI chrome", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await page.evaluate(() =>
        Array.from(document.querySelectorAll("style"))
          .map((s) => s.textContent)
          .join("\n"),
      );
      const print = css.slice(css.indexOf("@media print"));
      assert.ok(
        /\.be-shape-wrapper[^{]*\{[^}]*opacity:\s*1 !important/.test(print) ||
          /html\s+body[^{]*\.be-shape-wrapper[^{]*\{[^}]*opacity:\s*1 !important/.test(print),
        "shapes forced fully opaque on print",
      );
      assert.ok(
        print.includes(".be-section-actions") && print.includes("display: none !important"),
        "section action bars hidden on print",
      );
      assert.ok(
        print.includes(".print-section-resize-handle") && print.includes("display: none !important"),
        "resize handles hidden on print",
      );
    } finally {
      await page.close();
    }
  });
});
