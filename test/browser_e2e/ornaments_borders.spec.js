/**
 * Browser E2E — PR #16 "Ornaments" (border_asset_expansion_20260222): the
 * expanded border palette — new ornament/corner/vertical border style
 * classes surfaced as options in the border picker modal, with a scrollable
 * grid, and each option applying its style class to the section.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The border picker modal lists the expanded style set (ornament
 *      family, spike variants, vine, etc.).
 *   2. The modal grid is scrollable (max-height + overflow).
 *   3. Applying an ornament style adds its class to the section.
 *   4. Reopening the picker preselected that section's current style.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:ornaments
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #16 Ornaments / expanded border palette (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function openBorderPicker(page) {
    const id = await page.evaluate(() => {
      const w = Array.from(
        document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
      ).find((x) => {
        const m = x.querySelector(
          ":scope > .be-section-actions > .be-context-menu",
        );
        return m && m.querySelector(".be-border-button");
      });
      return w ? w.id : null;
    });
    assert.ok(id, "section with border menu not found");
    await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
    await page.waitForTimeout(300);
    await domClick(page, `#${id} > .be-section-actions > .be-context-menu > .be-border-button`);
    await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
    return id;
  }

  it("the border picker lists the expanded (ornament) style set", async function () {
    const page = await bootPage(ctx);
    try {
      await openBorderPicker(page);
      const classes = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-modal-overlay .be-border-preview")).map(
          (p) => p.className,
        ),
      );
      const has = (re) => classes.some((c) => re.test(c));
      assert.ok(has(/ornament_border/), "ornament_border present");
      assert.ok(has(/ornament2_border/), "ornament2_border present");
      assert.ok(has(/ornament_bold_border/), "ornament_bold_border present");
      assert.ok(has(/ornament_bold2_border/), "ornament_bold2_border present");
      assert.ok(has(/ornament_simple_border/), "ornament_simple_border present");
      assert.ok(has(/spike_hollow_border/), "spike_hollow_border present");
      assert.ok(has(/spiky_border/), "spiky_border present");
      assert.ok(has(/spiky_bold_border/), "spiky_bold_border present");
      assert.ok(has(/vine_border/), "vine_border present");
      assert.ok(has(/dwarf_hollow_border/), "dwarf_hollow_border present");
    } finally {
      await page.close();
    }
  });

  it("the border picker grid is scrollable", async function () {
    const page = await bootPage(ctx);
    try {
      await openBorderPicker(page);
      const st = await page.evaluate(() => {
        const c = document.querySelector(
          ".be-modal-overlay .be-border-options",
        );
        if (!c) return null;
        const cs = getComputedStyle(c);
        return {
          maxHeight: cs.maxHeight,
          overflowY: cs.overflowY,
          scrollable: c.scrollHeight > c.clientHeight,
        };
      });
      assert.ok(st, "options container exists");
      assert.ok(st.scrollable || (st.maxHeight && st.maxHeight !== "none"),
        "options grid is scrollable (scrollHeight " + (st && st.scrollable) + ")");
    } finally {
      await page.close();
    }
  });

  it("applying an ornament style adds the class to the section", async function () {
    const page = await bootPage(ctx);
    try {
      const secId = await openBorderPicker(page);
      await page.evaluate(() => {
        const opt = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find(
          (o) => o.querySelector(".ornament_bold_border"),
        );
        opt.click();
        const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find(
          (b) => b.textContent.trim().startsWith("Apply"),
        );
        ok.click();
      });
      await page.waitForFunction(
        (id) => {
          const w = document.getElementById(id);
          const c = w && w.querySelector(".print-section-container");
          return c && c.classList.contains("ornament_bold_border");
        },
        secId,
        { timeout: 10000 },
      );
      assert.ok(true, "ornament_bold_border applied to the section");
    } finally {
      await page.close();
    }
  });

  it("the properties-panel picker preselects the section's current style", async function () {
    const page = await bootPage(ctx);
    try {
      // select a section (🎯) so the properties panel is live
      const secId = await page.evaluate(() => {
        const w = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).find((x) => {
          const bar = x.querySelector(":scope > .be-section-actions");
          return bar && bar.querySelector(".be-select-section-button");
        });
        const b = w && w.querySelector(":scope > .be-section-actions .be-select-section-button");
        if (b) b.click();
        return w ? w.id : null;
      });
      assert.ok(secId, "a selectable section exists");
      await page.waitForTimeout(600);
      // apply vine via the panel's border button
      await domClick(page, "#print-enhance-properties-panel .be-prop-border-button");
      await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
      await page.evaluate(() => {
        const opt = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find(
          (o) => o.querySelector(".vine_border"),
        );
        opt.click();
        const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find(
          (b) => b.textContent.trim().startsWith("Apply"),
        );
        ok.click();
      });
      await page.waitForTimeout(700);
      // reopen the panel picker — it passes the current style and preselects
      await domClick(page, "#print-enhance-properties-panel .be-prop-border-button");
      await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
      const selected = await page.evaluate(() => {
        const o = document.querySelector(".be-modal-overlay .be-border-option.selected");
        return o ? (o.querySelector(".be-border-preview").className || "") : null;
      });
      assert.ok(selected && selected.includes("vine_border"),
        "picker preselects vine_border, got: " + selected);
    } finally {
      await page.close();
    }
  });
});
