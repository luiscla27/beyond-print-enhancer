/**
 * Browser E2E — PR #4 "enhance layout, styling, and portrait positioning":
 * automatic portrait placement into the primary box, cleaned/navigation UI
 * removal, section borders + larger font, and default coordinates.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The character portrait is auto-moved into the primary box section.
 *   2. Sections carry border styling and a readable print font-size.
 *   3. Navigation / management clutter is removed from the enhanced view
 *      (print-only cleanup is active).
 *   4. The layout applies default coordinates (sections positioned, not
 *      stacked).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:portrait
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #4 Portrait positioning + layout cleanup (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the character portrait is moved into the primary box", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const portrait = document.querySelector(".ddbc-character-avatar__portrait");
        const pb = document.querySelector(".ct-subsection--primary-box, [class*='primary-box']");
        return {
          portraitExists: !!portrait,
          portraitInPrimary: !!(portrait && portrait.closest(".ct-subsection--primary-box, [class*='primary-box']")),
          hasPB: !!pb,
        };
      });
      assert.ok(st.portraitExists, "portrait exists on the sheet");
      assert.ok(st.hasPB, "primary box section present");
      assert.ok(st.portraitInPrimary, "portrait was moved into the primary box");
    } finally {
      await page.close();
    }
  });

  it("sections carry border styling and readable font sizing", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const secs = Array.from(document.querySelectorAll(".print-section-container"));
        const bordered = secs.filter((c) =>
          Array.from(c.classList).some((x) => /_border|border/.test(x)),
        ).length;
        // font size from injected CSS (print sections use a base size)
        const styleHasFont = Array.from(document.querySelectorAll("style")).some(
          (s) => /print-section[^{]*\{[^}]*font-size/.test(s.textContent),
        );
        return { total: secs.length, bordered, styleHasFont };
      });
      assert.ok(st.total >= 20);
      assert.ok(st.bordered >= 10, "many sections bordered: " + st.bordered);
      assert.ok(st.styleHasFont, "print font-size defined in injected CSS");
    } finally {
      await page.close();
    }
  });

  it("sections are positioned (default coordinates applied), not stacked", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).slice(0, 12);
        const positioned = ws.filter((w) => parseInt(w.style.left, 10) >= 0 || w.style.left);
        const distinctTops = new Set(ws.map((w) => w.style.top)).size;
        const distinctLefts = new Set(ws.map((w) => w.style.left)).size;
        return { total: ws.length, positioned: positioned.length, distinctTops, distinctLefts };
      });
      assert.ok(st.total >= 10);
      assert.ok(st.positioned >= 8, "sections positioned by coordinates: " + st.positioned);
      assert.ok(st.distinctTops >= 3 && st.distinctLefts >= 2, "multiple columns/lines present");
    } finally {
      await page.close();
    }
  });

  it("the enhanced layout cleanup is active (search boxes removed)", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const visibleSearch = Array.from(
          document.querySelectorAll("input[type=search], .header-wrapper"),
        ).filter((el) => el.offsetParent !== null && !el.closest("[data-testid='SPELLS'], .ct-spells")).length;
        return { visibleSearch };
      });
      assert.strictEqual(st.visibleSearch, 0, "search boxes removed from the enhanced layout");
    } finally {
      await page.close();
    }
  });
});
