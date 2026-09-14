"use strict";
/**
 * PROBE: does the fit-to-container compensation width land on the SAME element and SAME inline
 * property that the layout record (`innerWidths`) owns? (issue
 * responsive_scaling_observer_never_observed_20260912 → follow-up from the browser gate run.)
 *
 *   node scripts/scaling_innerwidth_collision_probe.js
 *
 * `scanLayout`/`snapshotContainerGeometry` record `child.style.width` for the children of
 * `div[class$="-content"]` — and `.print-section-content` ENDS with "-content", so its direct child
 * is in that set. `fitContainer` writes `inner.style.width = ${100/scale}%` on that very element.
 * If both are true, the persisted layout absorbs a value the FEATURE derived, not the user chose.
 */
const { launchExtensionContext, bootPage } = require("../test/browser_e2e/_helpers.js");

(async () => {
  const ctx = await launchExtensionContext();
  const page = await bootPage(ctx);
  try {
    await page.waitForTimeout(2500);
    const out = await page.evaluate(() => {
      const rows = [];
      document
        .querySelectorAll('#print-enhance-sections-layer .print-section-container[data-scaling="true"]')
        .forEach((section) => {
          // The EXACT selector the scan uses, and the same keying.
          const containers = section.querySelectorAll(
            'div[class$="-row-header"], div[class$="-content"]',
          );
          containers.forEach((container, cIdx) => {
            Array.from(container.children).forEach((child, dIdx) => {
              if (!child || child.tagName !== "DIV" || !child.style.width) return;
              rows.push({
                section: section.id,
                key: `${cIdx}-${dIdx}`,
                isTheScalingElement:
                  container.classList.contains("print-section-content") &&
                  container.firstElementChild === child,
                containerClass: container.className,
                inlineWidth: child.style.width,
                inlineTransform: child.style.transform || null,
              });
            });
          });
        });
      return rows;
    });
    const collision = out.filter((r) => r.isTheScalingElement);
    console.log(
      JSON.stringify(
        {
          recordedInnerWidths: out.length,
          onTheScalingElement: collision.length,
          examples: collision.slice(0, 5),
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
