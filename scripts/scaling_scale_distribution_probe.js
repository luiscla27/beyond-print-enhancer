"use strict";
/**
 * The distribution of scales the fit-to-container feature applies on the live demo sheet.
 *
 *   node scripts/scaling_scale_distribution_probe.js
 *
 * This is the measurement behind the table in
 * `vendor/docs/responsive-scaling-wiring-20260913/FIX_REPORT.md` §4 and behind
 * `temp/archived/ISSUE_scaling_floor_spells_0443_20260913.md` (a section at 0.443 is the reason a
 * floor on the scale is a question at all). Re-run it after any change to `fitContainer`, because
 * the numbers move with the compensation mechanism.
 */
const { launchExtensionContext, bootPage } = require("../test/browser_e2e/_helpers.js");

(async () => {
  const ctx = await launchExtensionContext();
  const page = await bootPage(ctx);
  try {
    await page.waitForTimeout(3000);
    const st = await page.evaluate(() => {
      const scaled = [];
      const containers = Array.from(
        document.querySelectorAll("#print-enhance-sections-layer .print-section-container"),
      );
      for (const c of containers) {
        const content = c.querySelector(".print-section-content");
        const inner = content && content.firstElementChild;
        if (!inner) continue;
        const m = (inner.style.transform || "").match(/scale\(([\d.]+)\)/);
        if (!m) continue;
        scaled.push({
          id: c.id,
          title: (c.closest(".be-section-wrapper") || {}).dataset
            ? c.closest(".be-section-wrapper").dataset.title
            : null,
          scale: parseFloat(m[1]),
          beScale: inner.style.getPropertyValue("--be-scale") || null,
          inlineWidth: inner.style.width || null,
          boxH: content.clientHeight,
          naturalH: inner.scrollHeight,
        });
      }
      scaled.sort((a, b) => a.scale - b.scale);
      return { total: containers.length, scaled };
    });
    console.log(
      JSON.stringify(
        {
          total: st.total,
          scaledCount: st.scaled.length,
          worst: st.scaled.slice(0, 8),
        },
        null,
        1,
      ),
    );
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
})();
