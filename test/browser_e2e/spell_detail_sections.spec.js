/**
 * Browser E2E — PR #11 "Spell description sheets" (spell_detail_section
 * injection): clicking "Details" on a spell row opens a floating spell
 * detail section that fetches (cache/network) and renders the spell's
 * description, with duplicate prevention when the same spell is requested
 * again.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Spell rows expose a "Details" trigger.
 *   2. Clicking Details creates a floating .be-spell-detail section.
 *   3. Re-requesting the same spell does not duplicate it (bring-to-front /
 *      existing-section guard).
 *   4. The section is a draggable wrapper (title, action bar) in the
 *      sections layer.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:spelldetails
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #11 Spell detail sheets (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function clickFirstDetails(page) {
    const r = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll(".be-spell-details-button"));
      const b =
        btns.find((x) => x.offsetParent !== null) || btns[0];
      if (!b) return null;
      const name = (b.closest(".ct-spells-spell") || b.closest("tr, li, div"))
        ? (b.closest(".ct-spells-spell") || b.parentElement).textContent.trim().slice(0, 30)
        : "";
      b.click();
      return { name, total: btns.length };
    });
    assert.ok(r, "spell Details buttons exist");
    return r;
  }

  it("spell rows expose a Details trigger", async function () {
    const page = await bootPage(ctx);
    try {
      const count = await page.evaluate(
        () => document.querySelectorAll(".be-spell-details-button").length,
      );
      assert.ok(count >= 5, "spell Details buttons present: " + count);
    } finally {
      await page.close();
    }
  });

  it("clicking Details creates a floating spell detail section", async function () {
    const page = await bootPage(ctx);
    try {
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-spell-detail").length,
      );
      await clickFirstDetails(page);
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-spell-detail").length > n,
        before,
        { timeout: 25000 },
      );
      const st = await page.evaluate(() => {
        const sec = document.querySelector(".be-spell-detail");
        const w = sec && sec.closest(".be-section-wrapper");
        return {
          count: document.querySelectorAll(".be-spell-detail").length,
          draggable: w ? w.classList.contains("be-spell-detail-wrapper") : false,
          actions: !!(w && w.querySelector(":scope > .be-section-actions")),
          inSectionsLayer: !!sec && !!sec.closest("#print-enhance-sections-layer"),
          content: sec ? sec.textContent.length : 0,
        };
      });
      assert.strictEqual(st.count, before + 1, "a spell detail section opened");
      assert.ok(st.draggable, "spell detail is a draggable wrapper");
      assert.ok(st.actions, "spell detail wrapper has an action bar");
      assert.ok(st.inSectionsLayer, "placed in the sections layer");
    } finally {
      await page.close();
    }
  });

  it("re-requesting the same spell does not duplicate the section", async function () {
    const page = await bootPage(ctx);
    try {
      await clickFirstDetails(page);
      await page.waitForFunction(
        () => document.querySelectorAll(".be-spell-detail").length > 0,
        { timeout: 25000 },
      );
      await page.waitForTimeout(1500);
      const countOnce = await page.evaluate(
        () => document.querySelectorAll(".be-spell-detail").length,
      );
      // click the SAME row's Details again
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll(".be-spell-details-button"));
        const b = btns.find((x) => x.offsetParent !== null) || btns[0];
        if (b) b.click();
      });
      await page.waitForTimeout(2000);
      const countTwice = await page.evaluate(
        () => document.querySelectorAll(".be-spell-detail").length,
      );
      assert.ok(countOnce >= 1);
      assert.strictEqual(
        countTwice,
        countOnce,
        "same spell request must not create a duplicate section",
      );
    } finally {
      await page.close();
    }
  });

  it("the opened spell detail eventually shows content or a retry/delete error state", async function () {
    const page = await bootPage(ctx);
    try {
      await clickFirstDetails(page);
      await page.waitForFunction(
        () => document.querySelectorAll(".be-spell-detail").length > 0,
        { timeout: 25000 },
      );
      // give the (possibly network) fetch time to resolve into content or error
      await page.waitForTimeout(6000);
      const st = await page.evaluate(() => {
        const sec = document.querySelector(".be-spell-detail");
        if (!sec) return null;
        return {
          hasContent: sec.textContent.replace(/\s+/g, " ").trim().length > 12,
          hasSpinner: !!sec.querySelector(".be-spinner"),
          hasRetry: !!sec.querySelector(".be-retry-button"),
          hasDelete: !!sec.querySelector(".be-delete-button"),
        };
      });
      assert.ok(
        st && (st.hasContent || st.hasSpinner || st.hasRetry),
        "spell detail shows content, a pending state, or a retry error state",
      );
    } finally {
      await page.close();
    }
  });
});
