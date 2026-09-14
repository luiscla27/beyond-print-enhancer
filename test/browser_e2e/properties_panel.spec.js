/**
 * Browser E2E — PR #34 "Font size" (properties_panel_20260503): the
 * Properties Panel in the control panel that manages per-section Font Size,
 * Compact Mode and Border Style, driven by an Active Section concept.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The properties panel sits in the control panel and shows an empty
 *      state until a section is selected.
 *   2. Selecting a section (🎯 Select Section) activates it (visual
 *      highlight) and fills the panel with its font size/compact/border.
 *   3. The font-size slider live-updates the active section's font size
 *      (and proportional scale variable) as it moves.
 *   4. Activating a different section syncs the panel slider to that
 *      section's font size.
 *   5. The compact-mode toggle reflects and toggles be-compact-mode.
 *   6. The border-style button opens the border picker modal and applying a
 *      style updates both the section and the panel thumbnail.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:font
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #34 Properties panel (Font size / Compact / Border) (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Returns [wrapper, container] ids of the first selectable section. */
  async function pickSelectableSection(page, { skipTitle = null } = {}) {
    const found = await page.evaluate((skipTitle) => {
      const ws = Array.from(
        document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
      );
      for (const w of ws) {
        if (skipTitle && w.dataset.title === skipTitle) continue;
        const bar = w.querySelector(":scope > .be-section-actions");
        const b =
          bar &&
          Array.from(bar.children).find((c) =>
            c.classList.contains("be-select-section-button"),
          );
        if (b) return { wrapperId: w.id, hasSelect: true };
      }
      return null;
    }, skipTitle);
    assert.ok(found, "no selectable section found");
    return found.wrapperId;
  }

  async function selectSection(page, wrapperId) {
    await page.evaluate((id) => {
      const w = document.getElementById(id);
      const bar = w.querySelector(":scope > .be-section-actions");
      const b = Array.from(bar.children).find((c) =>
        c.classList.contains("be-select-section-button"),
      );
      if (b) b.click();
    }, wrapperId);
    await page.waitForTimeout(600);
  }

  function panelState(page) {
    return page.evaluate(() => {
      const panel = document.getElementById("print-enhance-properties-panel");
      if (!panel) return null;
      const active = document.querySelector(
        ".be-section-wrapper.be-active-wrapper",
      );
      const slider = panel.querySelector("input[type=range]");
      const compact = panel.querySelector("input[type=checkbox]");
      const borderBtn = panel.querySelector(".be-prop-border-button");
      const preview = borderBtn && borderBtn.querySelector(".be-border-preview");
      return {
        empty: !!panel.querySelector(".be-prop-panel-empty"),
        editingText: panel.querySelector("h4")
          ? panel.querySelector("h4").textContent
          : "",
        activeWrapperId: active ? active.id : null,
        activeTitle: active ? active.dataset.title : null,
        sliderValue: slider ? slider.value : null,
        compactChecked: compact ? compact.checked : null,
        borderPreviewClass: preview ? (preview.className || "") : null,
      };
    });
  }

  it("properties panel shows an empty state until a section is selected", async function () {
    const page = await bootPage(ctx);
    try {
      const s = await panelState(page);
      assert.ok(s, "properties panel should exist");
      assert.strictEqual(s.empty, true, "panel should start in empty state");
      assert.strictEqual(s.sliderValue, null, "no slider until section active");
      // The panel lives inside the control panel.
      const inControls = await page.evaluate(() => {
        const c = document.getElementById("print-enhance-controls");
        return !!c.querySelector("#print-enhance-properties-panel");
      });
      assert.ok(inControls, "panel should be inside the control panel");
    } finally {
      await page.close();
    }
  });

  it("selecting a section highlights it and fills the panel", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await pickSelectableSection(page);
      await selectSection(page, id);
      const s = await panelState(page);
      assert.strictEqual(s.empty, false, "panel no longer empty");
      assert.strictEqual(s.activeWrapperId, id, "correct wrapper is active");
      assert.ok(
        s.editingText.startsWith("Editing:"),
        "panel header shows Editing: " + s.editingText,
      );
      assert.ok(s.sliderValue !== null, "font-size slider present");
      assert.ok(s.compactChecked !== null, "compact toggle present");
      assert.ok(s.borderPreviewClass, "border preview present");
    } finally {
      await page.close();
    }
  });

  it("font-size slider live-updates the active section", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await pickSelectableSection(page);
      await selectSection(page, id);
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-properties-panel");
        const slider = panel.querySelector("input[type=range]");
        slider.value = "24";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(400);
      const st = await page.evaluate((id) => {
        const w = document.getElementById(id);
        return {
          fontSize: w.style.fontSize,
          scale: w.style.getPropertyValue("--be-font-scale"),
        };
      }, id);
      assert.strictEqual(st.fontSize, "24px", "wrapper font size applied");
      assert.strictEqual(st.scale, "2.4", "proportional scale variable set");
    } finally {
      await page.close();
    }
  });

  it("activating a different section syncs the slider to its font size", async function () {
    const page = await bootPage(ctx);
    try {
      const a = await pickSelectableSection(page);
      await selectSection(page, a);
      // set a distinctive font size on section A
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-properties-panel");
        const slider = panel.querySelector("input[type=range]");
        slider.value = "27";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(300);
      // select a different section
      const other = await page.evaluate((a) => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        );
        const target = ws.find((w) => w.id !== a);
        const bar = target && target.querySelector(":scope > .be-section-actions");
        const b = bar && Array.from(bar.children).find((c) =>
          c.classList.contains("be-select-section-button"),
        );
        if (b) b.click();
        return target ? target.id : null;
      }, a);
      assert.ok(other, "a second selectable section should exist");
      await page.waitForTimeout(400);
      const s = await panelState(page);
      assert.strictEqual(s.activeWrapperId, other, "new section is active");
      // new section slider reflects ITS font size (10px default)
      assert.strictEqual(s.sliderValue, "10", "slider synced to new section");
    } finally {
      await page.close();
    }
  });

  it("compact-mode toggle toggles be-compact-mode on the active section", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await pickSelectableSection(page);
      await selectSection(page, id);
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-properties-panel");
        const box = panel.querySelector("input[type=checkbox]");
        box.checked = true;
        box.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(400);
      const on = await page.evaluate((id) => {
        const w = document.getElementById(id);
        const sec = w.querySelector(".print-section-container");
        return sec.classList.contains("be-compact-mode");
      }, id);
      assert.strictEqual(on, true, "compact mode ON via panel toggle");
      // toggle off
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-properties-panel");
        const box = panel.querySelector("input[type=checkbox]");
        box.checked = false;
        box.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(400);
      const off = await page.evaluate((id) => {
        const w = document.getElementById(id);
        const sec = w.querySelector(".print-section-container");
        return sec.classList.contains("be-compact-mode");
      }, id);
      assert.strictEqual(off, false, "compact mode OFF via panel toggle");
    } finally {
      await page.close();
    }
  });

  it("border-style button opens the picker and applying updates the section + preview", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await pickSelectableSection(page);
      await selectSection(page, id);
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-properties-panel");
        panel.querySelector(".be-prop-border-button").click();
      });
      await page.waitForSelector(".be-modal-overlay .be-border-option", {
        timeout: 15000,
      });
      const modalTitle = await page.evaluate(
        () =>
          document.querySelector(".be-modal h3") &&
          document.querySelector(".be-modal h3").textContent,
      );
      assert.strictEqual(modalTitle, "Select Section Border");
      // choose "spikes_border" option then Apply
      await page.evaluate(() => {
        const opt = Array.from(
          document.querySelectorAll(".be-border-option"),
        ).find((o) => o.querySelector(".spikes_border"));
        opt.click();
        const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find(
          (b) => b.textContent.trim().startsWith("Apply"),
        );
        ok.click();
      });
      await page.waitForTimeout(700);
      const st = await page.evaluate((id) => {
        const w = document.getElementById(id);
        const sec = w.querySelector(".print-section-container");
        const panel = document.getElementById("print-enhance-properties-panel");
        const prev = panel.querySelector(".be-prop-border-button .be-border-preview");
        return {
          hasClass: sec.classList.contains("spikes_border"),
          previewHas: prev ? prev.classList.contains("spikes_border") : false,
        };
      }, id);
      assert.strictEqual(st.hasClass, true, "section got spikes_border");
      assert.strictEqual(
        st.previewHas,
        true,
        "panel preview thumbnail updated to spikes_border",
      );
    } finally {
      await page.close();
    }
  });
});
