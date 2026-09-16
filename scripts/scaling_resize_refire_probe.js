"use strict";
/**
 * Does a RESIZE of a section re-fire the fit-to-container measure? (Option 4 of
 * temp/archived/ISSUE_scaling_floor_spells_0443_20260913.md claims a user who dislikes a
 * shrunken section can drag it taller. This measures that instead of asserting it.)
 *
 *   node scripts/scaling_resize_refire_probe.js
 */
const { launchExtensionContext, bootPage } = require("../test/browser_e2e/_helpers.js");

function read(page, id) {
  return page.evaluate((sectionId) => {
    const c = document.getElementById(sectionId);
    if (!c) return null;
    const inner = c.querySelector(".print-section-content > div");
    const content = c.querySelector(".print-section-content");
    const m = inner && (inner.style.transform || "").match(/scale\(([\d.]+)\)/);
    return {
      scaling: c.getAttribute("data-scaling"),
      scale: m ? parseFloat(m[1]) : null,
      boxH: content ? content.clientHeight : null,
      naturalH: inner ? inner.scrollHeight : null,
    };
  }, id);
}

(async () => {
  const ctx = await launchExtensionContext();
  const page = await bootPage(ctx);
  try {
    await page.waitForTimeout(2500);
    const id = await page.evaluate(() => {
      const c = document.querySelector(
        '#print-enhance-sections-layer .print-section-container[data-scaling="true"]',
      );
      return c ? c.id : null;
    });
    if (!id) throw new Error("no scaled section on the default layout — nothing to probe");
    const before = await read(page, id);

    // Grow the section's own box the way the resize handle does (it writes style.height on the
    // container), WITHOUT touching the content.
    await page.evaluate(({ sectionId, h }) => {
      const c = document.getElementById(sectionId);
      c.style.height = h + "px";
    }, { sectionId: id, h: (before.boxH + 400) | 0 });
    await page.waitForTimeout(1200);
    const after = await read(page, id);
    console.log(JSON.stringify({ id, before, after, refired: after.scale !== before.scale }, null, 1));
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
})();
