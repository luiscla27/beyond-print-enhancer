/**
 * BROWSER E2E — responsive scaling actually scales, in a real browser.
 *
 * WHY THIS FILE EXISTS (issue `responsive_scaling_observer_never_observed_20260912`).
 * The product constructed a `ResizeObserver` and never called `observe()` on it, so the
 * feature has never done anything since it was written — and the repository had NO browser
 * case for it, only a unit test that copied the arithmetic and triggered its own copy. A
 * missing wire is precisely what a unit-level copy cannot see and a real browser sees
 * immediately: in a real browser the boxes have REAL sizes, so if the wiring is absent the
 * sheet simply never scales and every assertion below fails.
 *
 * THREE THINGS THIS PINS
 *   1. `observe()` reached a container — asserted by the effect, not by spying on the API:
 *      a long section on the live sheet gets a scale and the `data-scaling` attribute.
 *   2. The scaling is STABLE. A ResizeObserver whose callback changes the box it observes
 *      re-notifies itself; Chromium reports that as "ResizeObserver loop completed with
 *      undelivered notifications". Nothing here waits for such a page error, so the FIRST
 *      loop the feature causes turns this spec red rather than being a console note.
 *   3. The scaled content FITS its container: the point of the feature is that a section's
 *      overflow stops being clipped by `.print-section-content { overflow: hidden }`, so the
 *      on-screen result is measured, not assumed.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run:  npx mocha test/browser_e2e/responsive_scaling.spec.js --timeout 900000
 *       (or `npm run test:e2e` / the browser gate, which collect it; no per-file npm alias was
 *       added — the roster of those is pinned by `test/unit/e2e_plumbing_guard.test.js`, and
 *       `npm run test:e2e -- --grep "Responsive scaling"` already serves a curated single run)
 */
"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

/** Everything the feature is supposed to have done to the live sheet. */
async function readSheet(page) {
  return page.evaluate(() => {
    const containers = Array.from(
      document.querySelectorAll(
        "#print-enhance-sections-layer .print-section-container",
      ),
    );
    const scaled = [];
    let misfit = 0;
    for (const c of containers) {
      const content = c.querySelector(".print-section-content");
      const inner = content && content.firstElementChild;
      if (!content || !inner) continue;
      if (c.getAttribute("data-scaling") !== "true") continue;
      const box = content.getBoundingClientRect();
      const drawn = inner.getBoundingClientRect();
      // A scaled inner renders at scale * its layout size, so getBoundingClientRect is the
      // DRAWN box; 1px of sub-pixel slack per edge, because that is what Chromium rounds.
      if (drawn.width > box.width + 1 || drawn.height > box.height + 1) misfit++;
      scaled.push({
        id: c.id,
        transform: inner.style.transform,
        scale: parseFloat((inner.style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"),
      });
    }
    return {
      containers: containers.length,
      scaledCount: scaled.length,
      misfit,
      // The transform is deliberately not clamped to a pretty number: `scale(0.774194)` is
      // what the arithmetic writes, and the width compensation rides on the SAME number.
      minScale: scaled.reduce((m, s) => Math.min(m, s.scale), 1),
      sample: scaled.slice(0, 4),
    };
  });
}

describe("Responsive scaling in a real browser (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  let page;
  const pageErrors = [];

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    page.on("pageerror", (e) => pageErrors.push(String(e && e.message ? e.message : e)));
    // Let the observers settle: the sheet scales over the first few frames after layout is
    // applied, and a capture taken mid-flight would be a race, not a measurement.
    await page.waitForTimeout(2500);
  });

  after(async function () {
    if (page) await page.close().catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the default sheet has sections whose content actually overflows", async function () {
    // The precondition for everything below, asserted rather than assumed: if NOTHING on the
    // live sheet overflows, this spec could only ever pass vacuously (an observed container,
    // and no scale, forever). The measurement is taken with the feature's own reset in place.
    const st = await page.evaluate(() => {
      const containers = Array.from(
        document.querySelectorAll(
          "#print-enhance-sections-layer .print-section-container",
        ),
      );
      let overflowing = 0;
      for (const c of containers) {
        const content = c.querySelector(".print-section-content");
        const inner = content && content.firstElementChild;
        if (!content || !inner) continue;
        if (
          inner.scrollHeight > content.clientHeight + 1 ||
          inner.scrollWidth > content.clientWidth + 1
        ) {
          overflowing++;
        }
      }
      return { containers: containers.length, overflowing };
    });
    assert.ok(st.containers >= 15, "sections on the sheet: " + st.containers);
    assert.ok(st.overflowing >= 1, "no section's content exceeds its box, so the scaling assertions below would prove " +
        "nothing — " +
        JSON.stringify(st));
  });

  it("at least one section is scaled down and carries data-scaling", async function () {
    const st = await readSheet(page);
    assert.ok(
      st.scaledCount >= 1,
      "NOT ONE section carries data-scaling, so the observer is not driving the sheet — " +
        JSON.stringify(st),
    );
    assert.ok(st.minScale > 0 && st.minScale < 1, "a scale outside (0,1): " + st.minScale);
    // The `data-scaling` rule in js/print_styles.js is what makes the transform correct
    // (transform-origin: top left); if the attribute is set the rule is reachable.
    const origin = await page.evaluate(() => {
      const c = document.querySelector(
        '#print-enhance-sections-layer .print-section-container[data-scaling="true"]',
      );
      const inner = c && c.querySelector(".print-section-content > div");
      return inner ? getComputedStyle(inner).transformOrigin : null;
    });
    assert.ok(
      origin && /0px 0px|top left/.test(origin),
      "the scaled element is not pinned top-left (data-scaling rule not applying): " + origin,
    );
  });

  it("scaled content fits its container and no observer loop was reported", async function () {
    const st = await readSheet(page);
    assert.strictEqual(
      st.misfit,
      0,
      st.misfit + " scaled sections still overflow their content box: " + JSON.stringify(st.sample),
    );
    // The loop check is an ABSENCE assertion, and it is only meaningful because the feature
    // really ran (the case above proves a scale was applied) — a spec that measured nothing
    // could not have looped.
    const loops = pageErrors.filter((m) => /ResizeObserver loop/i.test(m));
    assert.deepStrictEqual(loops, [], "ResizeObserver loop errors: " + loops.join(" | "));
    // …and the sheet produced no page errors at all while it settled.
    assert.deepStrictEqual(pageErrors, [], "page errors during boot: " + pageErrors.join(" | "));
  });
});
