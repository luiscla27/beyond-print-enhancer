/**
 * Browser E2E — PR #31 "Upload shapes" (custom_shapes_upload_20260423):
 * the "Upload from disk" flow in the "Select Decorative Shape" picker that
 * turns a local image into a custom shape (base64 asset).
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The shape picker (Add Shape) exposes a Custom tab.
 *   2. The Custom tab offers an "Upload from disk" action.
 *   3. Choosing a local image file uploads it and closes the picker.
 *   4. The upload creates a new custom shape whose asset is the base64
 *      image (data:image/...), proving persistence-ready embedding.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:upload
 */

"use strict";

const assert = require("assert");
const path = require("path");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #31 Upload custom shapes from disk (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Unlock the default shape layer so the Add Shape button is usable. */
  async function unlockShapes(page) {
    await domClick(
      page,
      '.be-layer-row[data-layer-id="shapes-default"] button[title="Toggle Edit Mode"]',
    ).catch(() => {});
    await page.waitForTimeout(400);
  }

  async function openCustomTab(page) {
    await unlockShapes(page);
    await page.evaluate(() => {
      document.getElementById("be-btn-add-shape").click();
    });
    await page.waitForSelector(".be-modal-overlay .be-modal-tab", {
      timeout: 15000,
    });
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
        (x) => x.textContent === "Custom",
      );
      if (t) t.click();
    });
    await page.waitForTimeout(500);
  }

  function makeTinyPng(file) {
    return new Promise((resolve, reject) => {
      const sharp = require("sharp");
      sharp({
        create: { width: 6, height: 6, channels: 3, background: { r: 190, g: 70, b: 70 } },
      })
        .png()
        .toFile(file)
        .then(() => resolve(file))
        .catch(reject);
    });
  }

  it("the Add Shape picker offers a Custom tab", async function () {
    const page = await bootPage(ctx);
    try {
      await openCustomTab(page);
      const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-modal-tab")).map((t) =>
          t.textContent.trim(),
        ),
      );
      assert.ok(tabs.includes("Custom"), "Custom tab present: " + tabs);
    } finally {
      await page.close();
    }
  });

  it("the Custom tab exposes an Upload from disk action", async function () {
    const page = await bootPage(ctx);
    try {
      await openCustomTab(page);
      const hasUpload = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-modal-overlay button")).some(
          (b) => b.textContent.trim() === "Upload from disk",
        ),
      );
      assert.ok(hasUpload, "Upload from disk button present");
    } finally {
      await page.close();
    }
  });

  // AC-1 (custom_upload_templates_ux_20260909): a successful upload keeps
  // the picker OPEN with the new shape preselected; OK (Add Shape) places
  // it. The legacy close-and-drop contract is replaced.
  it("choosing a local image keeps the picker open, preselects it, and OK places the shape", async function () {
    const page = await bootPage(ctx);
    try {
      const png = path.join(require("path").resolve("."), "temp", "e2e-upload-tiny.png");
      await makeTinyPng(png);
      const shapesBefore = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      const fcPromise = page.waitForEvent("filechooser", { timeout: 20000 });
      await openCustomTab(page);
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal-overlay button"),
        ).find((x) => x.textContent.trim() === "Upload from disk");
        b.click();
      });
      const chooser = await fcPromise;
      await chooser.setFiles(png);
      // The modal must STAY OPEN and the uploaded cell becomes selected
      // with the OK button enabled.
      await page.waitForFunction(
        () => {
          const ov = document.querySelector(".be-modal-overlay");
          if (!ov) return false;
          const ok = ov.querySelector(".be-modal-ok");
          return (
            ok &&
            !ok.disabled &&
            !!ov.querySelector(".be-border-option.selected")
          );
        },
        { timeout: 25000 },
      );
      const selInfo = await page.evaluate(() => {
        const ov = document.querySelector(".be-modal-overlay");
        const sel = ov.querySelector(".be-border-option.selected");
        return { title: sel ? sel.title || sel.textContent.trim() : null };
      });
      assert.ok(selInfo.title && /upload/i.test(selInfo.title), "uploaded cell selected: " + selInfo.title);
      // OK places the shape (Add Shape flow).
      await page.evaluate(() => {
        document.querySelector(".be-modal-overlay .be-modal-ok").click();
      });
      await page.waitForFunction(
        () => !document.querySelector(".be-modal-overlay"),
        { timeout: 20000 },
      );
      const shapesAfter = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      assert.strictEqual(
        shapesAfter,
        shapesBefore + 1,
        "OK (Add Shape) should create the custom shape",
      );
    } finally {
      await page.close();
    }
  });

  it("Cancel after upload leaves the sheet untouched (library-only save)", async function () {
    const page = await bootPage(ctx);
    try {
      const png = path.join(require("path").resolve("."), "temp", "e2e-upload-tiny3.png");
      await makeTinyPng(png);
      const shapesBefore = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      const fcPromise = page.waitForEvent("filechooser", { timeout: 20000 });
      await openCustomTab(page);
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal-overlay button"),
        ).find((x) => x.textContent.trim() === "Upload from disk");
        b.click();
      });
      const chooser = await fcPromise;
      await chooser.setFiles(png);
      await page.waitForFunction(
        () => {
          const ov = document.querySelector(".be-modal-overlay");
          const ok = ov && ov.querySelector(".be-modal-ok");
          return ok && !ok.disabled && !!ov.querySelector(".be-border-option.selected");
        },
        { timeout: 25000 },
      );
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal-overlay button"),
        ).find((x) => x.textContent.trim() === "Cancel");
        b.click();
      });
      await page.waitForFunction(
        () => !document.querySelector(".be-modal-overlay"),
        { timeout: 20000 },
      );
      const shapesAfter = await page.evaluate(
        () => document.querySelectorAll(".be-shape-wrapper").length,
      );
      assert.strictEqual(
        shapesAfter,
        shapesBefore,
        "Cancel must NOT place a shape (library-only)",
      );
    } finally {
      await page.close();
    }
  });

  it("the uploaded custom shape carries the base64 image as its asset", async function () {
    const page = await bootPage(ctx);
    try {
      const png = path.join(require("path").resolve("."), "temp", "e2e-upload-tiny2.png");
      await makeTinyPng(png);
      const fcPromise = page.waitForEvent("filechooser", { timeout: 20000 });
      await openCustomTab(page);
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal-overlay button"),
        ).find((x) => x.textContent.trim() === "Upload from disk");
        b.click();
      });
      const chooser = await fcPromise;
      await chooser.setFiles(png);
      // Modal stays open; preselect + OK to place.
      await page.waitForFunction(
        () => {
          const ov = document.querySelector(".be-modal-overlay");
          const ok = ov && ov.querySelector(".be-modal-ok");
          return ok && !ok.disabled;
        },
        { timeout: 25000 },
      );
      await page.evaluate(() => {
        document.querySelector(".be-modal-overlay .be-modal-ok").click();
      });
      await page.waitForFunction(
        () => !document.querySelector(".be-modal-overlay"),
        { timeout: 20000 },
      );
      const asset = await page.evaluate(() => {
        const shapes = document.querySelectorAll(".be-shape-wrapper");
        const last = shapes[shapes.length - 1];
        const cont = last && last.querySelector(".be-shape-container");
        return cont ? cont.dataset.assetPath : null;
      });
      assert.ok(
        asset && asset.startsWith("data:image/"),
        "custom shape asset should be a base64 data image, got: " +
          String(asset).slice(0, 40),
      );
    } finally {
      await page.close();
    }
  });
});
