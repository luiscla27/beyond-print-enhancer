/**
 * Browser E2E — PR #23 "Color picker" (color_picker_20260309 + filter
 * expansion/fix): the global hue-rotation feature surfaced as the Color
 * Picker in the control panel with a 2D hue/saturation/greyscale grid.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The control panel exposes the Color Picker button (plus the hidden
 *      hue slider and Reset-All filters).
 *   2. Clicking Color Picker opens the floating 2D grid picker (600
 *      swatches + greyscale slider + Continue).
 *   3. Choosing a swatch live-previews the hue (the hue slider + hue CSS
 *      variables update) and Continue persists/closes the picker.
 *   4. Reset All Filters restores the default filter values.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:colorpicker
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #23 Color picker / hue shift (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const openPicker = (page) =>
    page.evaluate(() => {
      const b = Array.from(
        document.querySelectorAll("#print-enhance-controls button"),
      ).find((x) => (x.textContent || "").includes("Color Picker"));
      b.click();
    });

  const pickerState = (page) =>
    page.evaluate(() => {
      // The picker root is found by its inline `z-index`, which is what the picker itself
      // sets (`huePicker.style.zIndex = window.Z.PICKER`, js/controls.js). The declaration
      // map behind that name (js/section_utils.js, AC-5) is NOT readable from here: the
      // extension runs in MV3's ISOLATED world and `page.evaluate` runs in the MAIN one, so
      // `window.Z` is undefined in this scope (measured). The literal below is the
      // cross-world spelling of `window.Z.PICKER` — keep the two in step.
      const pickerZ = "20000";
      const hp = Array.from(document.querySelectorAll("div")).find(
        (d) => d.style && d.style.position === "fixed" && String(d.style.zIndex) === pickerZ,
      );
      if (!hp) return { open: false };
      const grid = hp.querySelector('[style*="grid-template-columns"]');
      // The accept control is matched by its CLASS, not by its copy: the label has already
      // changed once ("Accept" -> "Continue", js/controls.js) and a text matcher breaks on
      // every copy change. `.be-modal-ok` is what the picker itself sets.
      const ok = hp.querySelector("button.be-modal-ok");
      return {
        open: true,
        display: hp.style.getPropertyValue("display"),
        swatches: grid ? grid.children.length : 0,
        greyscaleSliders: hp.querySelectorAll('input[type="range"]').length,
        hasAccept: !!ok,
        acceptLabel: ok ? ok.textContent.trim() : null,
      };
    });

  it("control panel exposes the Color Picker button and filter controls", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ctl = document.getElementById("print-enhance-controls");
        const btns = Array.from(ctl.querySelectorAll("button"));
        return {
          colorPicker: btns.some((b) => (b.textContent || "").includes("Color Picker")),
          // O-2 (ornament_symmetry_20260910): the label is now "Reset Filters";
          // the id and the full-text tooltip are the stable contract.
          resetAll: btns.some((b) => b.id === "be-reset-all-filters"),
          resetAllTooltip: (document.getElementById("be-reset-all-filters") || {}).title || "",
          hueReset: btns.some((b) => (b.title || "").includes("Hue Shift")),
          filterSliders: ctl.querySelectorAll(".be-filters-container input[type=range]").length,
        };
      });
      assert.ok(st.colorPicker, "Color Picker button present");
      assert.ok(st.resetAll, "Reset All Filters present");
      assert.ok(
        st.resetAllTooltip.includes("Reset All Filters"),
        "the shortened label keeps its full text in the tooltip: " + st.resetAllTooltip,
      );
      assert.ok(st.hueReset, "hue slider reset control present");
      assert.ok(st.filterSliders >= 5, "filter sliders present");
    } finally {
      await page.close();
    }
  });

  it("Color Picker opens the 2D grid (swatches + greyscale + Continue)", async function () {
    const page = await bootPage(ctx);
    try {
      await openPicker(page);
      await page.waitForTimeout(800);
      const st = await pickerState(page);
      assert.ok(st.open, "color picker opens");
      assert.strictEqual(st.display, "flex", "picker visible");
      assert.strictEqual(st.swatches, 600, "2D hue/sat grid (60x10)");
      assert.strictEqual(st.greyscaleSliders, 1, "greyscale slider inside");
      assert.ok(
        st.hasAccept,
        "the picker's accept control (.be-modal-ok) is present, label: " + st.acceptLabel,
      );
    } finally {
      await page.close();
    }
  });

  it("choosing a swatch previews the hue and Continue closes the picker", async function () {
    const page = await bootPage(ctx);
    try {
      await openPicker(page);
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        // window.Z.PICKER; a literal here for the same cross-world reason as pickerState.
        const pickerZ = "20000";
        const hp = Array.from(document.querySelectorAll("div")).find(
          (d) => d.style && d.style.position === "fixed" && String(d.style.zIndex) === pickerZ,
        );
        const grid = hp.querySelector('[style*="grid-template-columns"]');
        // grid children are laid out saturations[rows] × 60 hue columns;
        // hue 90° = column 15, saturation 100% = row index 4 → 4*60+15 = 255
        const idx = 4 * 60 + 15;
        grid.children[idx].click();
      });
      await page.waitForTimeout(500);
      const preview = await page.evaluate(() => ({
        hueFilter: document.documentElement.style.getPropertyValue("--be-hue-filter") || "",
        hueVarSet: (document.documentElement.style.getPropertyValue("--be-hue-filter") || "").includes("90deg"),
      }));
      assert.ok(preview.hueVarSet, "hue variable previewed, got: " + preview.hueFilter);
      // Continue (the picker's accept control, matched by class — see pickerState)
      const label = await page.evaluate(() => {
        // window.Z.PICKER; a literal here for the same cross-world reason as pickerState.
        const pickerZ = "20000";
        const hp = Array.from(document.querySelectorAll("div")).find(
          (d) => d.style && d.style.position === "fixed" && String(d.style.zIndex) === pickerZ,
        );
        const acc = hp.querySelector("button.be-modal-ok");
        const text = acc.textContent.trim();
        acc.click();
        return text;
      });
      await page.waitForTimeout(600);
      const after = await pickerState(page);
      assert.ok(
        after.open && after.display === "none",
        "picker hidden after " + label + " (got: " + after.display + ")",
      );
    } finally {
      await page.close();
    }
  });

  it("Reset All Filters restores default filter values", async function () {
    const page = await bootPage(ctx);
    try {
      // change the contrast slider first
      await page.evaluate(() => {
        const ctl = document.getElementById("print-enhance-controls");
        const sliders = ctl.querySelectorAll(".be-filters-container input[type=range]");
        // second filter slider = contrast
        const s = sliders[1];
        s.value = "150";
        s.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(400);
      const changed = await page.evaluate(() => {
        const ctl = document.getElementById("print-enhance-controls");
        const labels = Array.from(ctl.querySelectorAll(".be-filters-container label"));
        const contrast = labels.find((l) => l.textContent.includes("Contrast"));
        return contrast ? contrast.textContent : null;
      });
      assert.ok(changed && changed.includes("150"), "contrast set to 150");
      // reset all (excl hue)
      await page.evaluate(() => {
        const b = document.getElementById("be-reset-all-filters")
          || Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Reset Filters"),
          );
        b.click();
      });
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => {
        const ctl = document.getElementById("print-enhance-controls");
        const labels = Array.from(ctl.querySelectorAll(".be-filters-container label"));
        const contrast = labels.find((l) => l.textContent.includes("Contrast"));
        return contrast ? contrast.textContent : null;
      });
      assert.ok(
        after && after.includes("100"),
        "contrast restored to 100 after reset: " + after,
      );
    } finally {
      await page.close();
    }
  });
});
