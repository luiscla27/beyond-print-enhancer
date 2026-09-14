/**
 * Browser E2E — PR #15 "New borders" (section_border_selection_20260218):
 * the original border picker modal + border style CSS classes + snapshot
 * persistence of the chosen border.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The border picker modal opens titled "Select Section Border".
 *   2. The base style set is offered (Default, None, Ability, Spikes,
 *      Barbarian, Goth…).
 *   3. Choosing a style applies its class to the section.
 *   4. "None" clears border classes (no-border state).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:borders
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #15 Border picker (base styles) (Playwright e2e)", function () {
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

  async function applyBorder(page, cls) {
    await page.evaluate((cls) => {
      const opt = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find(
        (o) => o.querySelector("." + cls),
      );
      opt.click();
      const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find(
        (b) => b.textContent.trim().startsWith("Apply"),
      );
      ok.click();
    }, cls);
    await page.waitForTimeout(700);
  }

  it("the border picker modal is titled Select Section Border", async function () {
    const page = await bootPage(ctx);
    try {
      await openBorderPicker(page);
      const title = await page.evaluate(
        () =>
          document.querySelector(".be-modal h3") &&
          document.querySelector(".be-modal h3").textContent,
      );
      assert.strictEqual(title, "Select Section Border");
    } finally {
      await page.close();
    }
  });

  it("the base style set is offered (Default/None/Ability/Spikes/Barbarian/Goth)", async function () {
    const page = await bootPage(ctx);
    try {
      await openBorderPicker(page);
      const classes = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-modal-overlay .be-border-preview")).map(
          (p) => p.className,
        ),
      );
      const has = (re) => classes.some((c) => re.test(c));
      assert.ok(has(/default-border/), "default present");
      assert.ok(classes.some((c) => c.includes("no-border")), "none present");
      assert.ok(has(/ability_border/), "ability present");
      assert.ok(has(/spikes_border/), "spikes present");
      assert.ok(has(/barbarian_border/), "barbarian present");
      assert.ok(has(/goth_border/), "goth present");
    } finally {
      await page.close();
    }
  });

  it("choosing a style applies its class to the section", async function () {
    const page = await bootPage(ctx);
    try {
      const secId = await openBorderPicker(page);
      await applyBorder(page, "spikes_border");
      const has = await page.evaluate((id) => {
        const c = document.getElementById(id).querySelector(".print-section-container");
        return c.classList.contains("spikes_border");
      }, secId);
      assert.strictEqual(has, true, "spikes_border applied");
    } finally {
      await page.close();
    }
  });

  it("None clears the border classes", async function () {
    const page = await bootPage(ctx);
    try {
      const secId = await openBorderPicker(page);
      await applyBorder(page, "spikes_border");
      await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
      await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
      await page.evaluate(() => {
        // None option shows a "no-border" preview
        const opt = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find(
          (o) => o.querySelector(".no-border") || (o.textContent || "").includes("None"),
        );
        opt.click();
        const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find(
          (b) => b.textContent.trim().startsWith("Apply"),
        );
        ok.click();
      });
      await page.waitForTimeout(700);
      const st = await page.evaluate((id) => {
        const c = document.getElementById(id).querySelector(".print-section-container");
        return {
          spikes: c.classList.contains("spikes_border"),
          noBorder: c.classList.contains("no-border"),
          borderCls: Array.from(c.classList).filter((x) => x.includes("_border")),
        };
      }, secId);
      assert.strictEqual(st.spikes, false, "spikes removed");
      assert.ok(st.noBorder || st.borderCls.length === 0, "no border style remains");
    } finally {
      await page.close();
    }
  });
});
