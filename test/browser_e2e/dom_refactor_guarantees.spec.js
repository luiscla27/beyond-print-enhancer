/**
 * Browser E2E — PR #14 "Mayor refactor" (selector_abstraction_refactor_
 * 20260215): the DomManager/ElementWrapper abstraction. A pure internal
 * refactor with no new control; this suite pins the user-visible guarantees
 * it shipped:
 *   1. The sheet still enhances (sections wrapped in .be-section-wrapper).
 *   2. The live Spells node stays interactive — its tab filter is preserved
 *      (the refactor restored tab-filter visibility).
 *   3. The sidebar portal is not hidden — modal UI (input prompt) stays
 *      usable above the cleaned layout.
 *   4. Spell rows expose the extension's Details triggers (spell
 *      interactivity survived the selector migration).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:refactor
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #14 DomManager selector refactor — user-visible guarantees (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the sheet enhances with wrapped sections after the selector migration", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => ({
        wrappers: document.querySelectorAll(".be-section-wrapper").length,
        controls: !!document.getElementById("print-enhance-controls"),
        layerPanel: !!document.getElementById("print-enhance-layer-manager"),
      }));
      assert.ok(st.wrappers >= 20, "sections wrapped");
      assert.ok(st.controls && st.layerPanel, "enhancer UI present");
    } finally {
      await page.close();
    }
  });

  it("the live Spells node keeps its tab filter (stays interactive)", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        // The spells filter is preserved (not deep-cleaned away).
        const filters = Array.from(document.querySelectorAll(".ct-spells-filter")).filter(
          (el) => el.offsetParent !== null,
        );
        const spellRows = Array.from(
          document.querySelectorAll(".be-section-wrapper .ct-spells-spell, .be-section-wrapper [class*='spells-spell']"),
        );
        return { visibleFilters: filters.length, spellRows: spellRows.length };
      });
      assert.ok(st.visibleFilters >= 1, "a spells filter remains visible");
      assert.ok(st.spellRows >= 5, "spell rows present in the enhanced sheet");
    } finally {
      await page.close();
    }
  });

  it("modal UI stays usable above the cleaned layout (sidebar portal not hidden)", async function () {
    const page = await bootPage(ctx);
    try {
      // Open the clone-name modal (input prompt) via a section's Clone flow.
      const id = await page.evaluate(() => {
        const w = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).find((x) => {
          const m = x.querySelector(
            ":scope > .be-section-actions > .be-context-menu",
          );
          return m && m.querySelector(".be-clone-button");
        });
        return w ? w.id : null;
      });
      assert.ok(id, "a clonable section exists");
      await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(page, `#${id} > .be-section-actions > .be-context-menu > .be-clone-button`);
      await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
      const st = await page.evaluate(() => {
        const input = document.querySelector(".be-modal-overlay input");
        const r = input.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + 4, r.top + 4);
        return {
          inputVisible: r.width > 0 && r.height > 0,
          notClipped: !!(top && (top === input || input.contains(top) || top.contains(input))),
        };
      });
      assert.ok(st.inputVisible, "input modal is rendered");
      assert.ok(st.notClipped, "modal input is not covered by hidden portal/backdrop");
      // close modal (Cancel)
      await page.evaluate(() => {
        const c = Array.from(document.querySelectorAll(".be-modal-overlay button")).find(
          (b) => b.textContent.trim() === "Cancel",
        );
        if (c) c.click();
      });
    } finally {
      await page.close();
    }
  });

  it("spell rows expose the extension Details triggers", async function () {
    const page = await bootPage(ctx);
    try {
      const count = await page.evaluate(
        () => document.querySelectorAll(".be-spell-details-button").length,
      );
      assert.ok(count >= 5, "spell rows carry Details buttons: " + count);
    } finally {
      await page.close();
    }
  });
});
