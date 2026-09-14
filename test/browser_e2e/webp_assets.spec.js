/**
 * Browser E2E — PR #24 "Extension Compression from 14MB to around 2MB"
 * (asset_compression_20260318): the WebP migration. This PR has no new
 * interactive control, but its user-facing contract is that every
 * decorative asset still renders after the .gif → .webp conversion.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Shapes added via the picker reference .webp assets and render
 *      (the applied border-image/background asset URL is a .webp file).
 *   2. The picker previews load from .webp assets (no .gif previews).
 *   3. Layer Manager shape thumbnails point at .webp assets that load.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:webp
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #24 WebP asset migration renders correctly (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("a shape added from the picker renders from a .webp asset", async function () {
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
      const shapesBefore = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
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
        t.click();
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const opt = document.querySelectorAll(
          ".be-modal-overlay .be-border-option",
        )[0];
        opt.click();
        const ok = Array.from(
          document.querySelectorAll(".be-modal-actions button"),
        ).find((b) => b.textContent.trim() === "Add Shape");
        ok.click();
      });
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-shape-wrapper").length > n,
        shapesBefore,
        { timeout: 15000 },
      );
      const asset = await page.evaluate(() => {
        const shapes = document.querySelectorAll(".be-shape-wrapper");
        const last = shapes[shapes.length - 1];
        const cont = last.querySelector(".be-shape-container");
        return cont ? cont.dataset.assetPath : null;
      });
      assert.ok(asset, "new shape has an asset path");
      assert.ok(
        asset.endsWith(".webp"),
        "asset should be a .webp file, got: " + asset,
      );
    } finally {
      await page.close();
    }
  });

  it("picker previews load from .webp assets (no .gif references)", async function () {
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
        t.click();
      });
      await page.waitForTimeout(600);
      const previews = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            ".be-modal-overlay .be-border-option .be-border-preview",
          ),
        ).map((e) => getComputedStyle(e).backgroundImage || ""),
      );
      const real = previews.filter((u) => u && u.startsWith("url("));
      assert.ok(real.length >= 5, "several previews with image URLs");
      assert.ok(
        real.every((u) => u.includes(".webp") && !u.includes(".gif")),
        "every preview URL is a .webp and none are .gif",
      );
    } finally {
      await page.close();
    }
  });

  it("Layer Manager shape thumbnails point at .webp assets that load", async function () {
    const page = await bootPage(ctx);
    try {
      const state = await page.evaluate(async () => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const thumbs = Array.from(
          panel.querySelectorAll(".be-layer-item-thumb"),
        );
        const results = await Promise.all(
          thumbs.map(
            (t) =>
              new Promise((res) => {
                // AC-1 chip structure: the .be-layer-item-thumb is a container
                // (drag unit) holding the <img>; read the img's src.
                const imgEl = t.querySelector("img") || t;
                const img = new Image();
                img.onload = () => res({ url: imgEl.src, loaded: true });
                img.onerror = () => res({ url: imgEl.src, loaded: false });
                img.src = imgEl.src;
              }),
          ),
        );
        return {
          count: thumbs.length,
          webp: results.filter((r) => r.url.includes(".webp")).length,
          loaded: results.filter((r) => r.loaded).length,
        };
      });
      assert.ok(state.count >= 5, "shape thumbnails present");
      assert.strictEqual(
        state.webp,
        state.count,
        "every thumbnail is a .webp asset",
      );
      assert.strictEqual(
        state.loaded,
        state.count,
        "every .webp thumbnail loads without error",
      );
    } finally {
      await page.close();
    }
  });
});
