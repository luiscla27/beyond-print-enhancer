/**
 * Browser E2E — PR #22 "chore: finalize version 1.4.0 release on new
 * branch": a pure release/chore PR (version bump + changelog + zip). It
 * introduces no new interactive control, so this suite pins the release
 * surface it shipped: the 1.4.0 milestone behaviors must boot cleanly and
 * the core user-facing controls must be present and interactive.
 *
 * One test per release-surface iteration:
 *   1. The extension boots on the live sheet without page errors and the
 *      sheet stays visible (the v1.3.x site-compat guarantee).
 *   2. The floating control panel with its headline actions (Add Shape,
 *      Save to Browser, Save to PC, Print) is present.
 *   3. Decorations layer: the layer management panel + properties surfaces
 *      of the 1.4.0 milestone are present.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:release140
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #22 1.4.0 release-surface smoke (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("extension boots cleanly and the character sheet stays visible", async function () {
    // bootPage already asserts no page errors + enhancer-ready.
    const page = await bootPage(ctx);
    try {
      const vis = await page.evaluate(() => {
        const main = document.getElementById("site-main");
        const wrapper = document.getElementById("print-layout-wrapper");
        return {
          sheetVisible: !main || main.style.display !== "none",
          wrapperVisible: !!wrapper && wrapper.offsetParent !== null,
          sections: document.querySelectorAll(".be-section-wrapper").length,
        };
      });
      assert.ok(vis.sheetVisible, "the character sheet is not hidden");
      assert.ok(vis.wrapperVisible, "print layout wrapper visible");
      assert.ok(vis.sections >= 5, "sections wrapped: " + vis.sections);
    } finally {
      await page.close();
    }
  });

  it("the control panel shows the 1.4.0 headline actions", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ctl = document.getElementById("print-enhance-controls");
        if (!ctl) return null;
        const texts = Array.from(ctl.querySelectorAll("button")).map((b) =>
          (b.textContent || "").replace(/\s+/g, " ").trim(),
        );
        return {
          addShape: texts.some((t) => t.includes("Add Shape")),
          saveBrowser: texts.some((t) => t.includes("Save to Browser")),
          savePC: texts.some((t) => t.includes("Save to PC")),
          print: texts.some((t) => t.includes("Print")),
          resetDefault: texts.some((t) => t.includes("Reset to Default")),
        };
      });
      assert.ok(st, "control panel present");
      assert.ok(st.addShape && st.saveBrowser && st.savePC && st.print && st.resetDefault,
        "headline actions present: " + JSON.stringify(st));
    } finally {
      await page.close();
    }
  });

  it("the 1.4.0 decoration/layer surfaces are present", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => ({
        layerPanel: !!document.getElementById("print-enhance-layer-manager"),
        shapesContainer: !!document.getElementById("print-enhance-shapes-container"),
        shapes: document.querySelectorAll(".be-shape-wrapper").length,
        sectionsLayer: !!document.getElementById("print-enhance-sections-layer"),
      }));
      assert.ok(st.layerPanel, "layer management panel present");
      assert.ok(st.shapesContainer, "shapes container present");
      assert.ok(st.shapes >= 1, "decorative shapes present: " + st.shapes);
      assert.ok(st.sectionsLayer, "sections layer present");
    } finally {
      await page.close();
    }
  });
});
