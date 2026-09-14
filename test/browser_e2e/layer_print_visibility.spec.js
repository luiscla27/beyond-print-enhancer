/**
 * Browser E2E — PR #28 "Layer enhancements fixes, also layer management is
 * now hidden on print" (layer_print_visibility_20260421 family): print-time
 * layer behaviors — the Layer Management panel never prints, per-layer
 * "Disable on Print", and forced full opacity for locked layers on print.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The injected @media print CSS hides the Layer Management panel.
 *   2. Locked layers render fully opaque on print (static print CSS forces
 *      opacity:1 over the edit-mode dimming) — the edit-time 0.5 dimming is
 *      never visible on paper.
 *   3. Per-layer "Disable on Print" toggle marks the layer
 *      data-print-disabled=true and emits a hide rule for that layer id.
 *   4. Toggling back re-enables the layer and removes the hide rule.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:printvisibility
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #28 Layer manager hidden on print + print-disabled layers (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const allCss = (page) =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent)
        .join("\n"),
    );

  it("the Layer Management panel is hidden inside @media print", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await allCss(page);
      // The rule appears in the static print CSS: media query containing
      // #print-enhance-layer-manager with display:none !important.
      const mediaBlocks = css.split("@media print");
      let found = false;
      for (const block of mediaBlocks) {
        if (block.includes("#print-enhance-layer-manager")) {
          if (/display:\s*none !important/.test(block)) found = true;
        }
      }
      assert.ok(found, "print CSS should hide the layer manager panel");
    } finally {
      await page.close();
    }
  });

  it("locked layers are forced fully opaque on print", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await allCss(page);
      // Static/dynamic print rules override the edit-time 0.5 dimming.
      let found = false;
      const blocks = css.split("@media print");
      for (const b of blocks) {
        if (b.includes("be-layer-locked") || b.includes("be-lock-shapes")) {
          if (/opacity:\s*1 !important/.test(b)) found = true;
        }
      }
      assert.ok(
        found,
        "print CSS forces opacity:1 on locked layer containers",
      );
    } finally {
      await page.close();
    }
  });

  it("Disable on Print marks the layer container and hides it in print CSS", async function () {
    const page = await bootPage(ctx);
    try {
      await domClick(
        page,
        '.be-layer-row[data-layer-id="sections"] button[title="Skip when printing"]',
      );
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          disabled: el.dataset.printDisabled,
          icon: (() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const row = panel.querySelector(
              '.be-layer-row[data-layer-id="sections"]',
            );
            const b = row.querySelector(
              'button[title="Skip when printing"]',
            );
            return b ? b.dataset.state : null;
          })(),
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.disabled, "true", "layer marked disabled on print");
      assert.strictEqual(st.icon, "off", "button shows disabled icon");
      assert.ok(
        /#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "dynamic print CSS hides the disabled layer",
      );
    } finally {
      await page.close();
    }
  });

  it("re-enabling a layer clears data-print-disabled and its hide rule", async function () {
    const page = await bootPage(ctx);
    try {
      const sel =
        '.be-layer-row[data-layer-id="sections"] button[title="Skip when printing"]';
      await domClick(page, sel); // disable
      await page.waitForTimeout(500);
      await domClick(page, sel); // re-enable
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        const dyn = document.getElementById("be-print-z-style");
        return {
          disabled: el.dataset.printDisabled,
          icon: (() => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const row = panel.querySelector(
              '.be-layer-row[data-layer-id="sections"]',
            );
            const b = row.querySelector(
              'button[title="Skip when printing"]',
            );
            return b ? b.dataset.state : null;
          })(),
          css: dyn.textContent,
        };
      });
      assert.strictEqual(st.disabled, "false", "layer re-enabled");
      assert.strictEqual(st.icon, "on", "icon back to enabled");
      assert.ok(
        !/#print-enhance-sections-layer\s*\{[^}]*display:\s*none !important/.test(
          st.css,
        ),
        "hide rule removed after re-enable",
      );
    } finally {
      await page.close();
    }
  });
});
