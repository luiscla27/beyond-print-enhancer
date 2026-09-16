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
 *   3. The scaled content FITS its container, or SAYS SO. The point of the feature is that a
 *      section's overflow stops being clipped by `.print-section-content { overflow: hidden }`,
 *      and the on-screen result is measured, not assumed. Since MIN_SCALE_FLOOR = 0.60 the
 *      feature can honestly decline to shrink something enough (issue
 *      `scaling_floor_spells_0443_20260913`), so the contract is "fit, or mark it": this spec
 *      compares the pixels against the sheet's own `data-scaling-clipped` claim and fails on
 *      any disagreement in either direction. It also asserts the marked set is NOT empty, so
 *      the equality cannot be won by measuring nothing.
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
    const misfitIds = [];
    const clipped = [];
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
      // The IDs ride along: "1 section misfits" is not actionable, "section-Spells misfits
      // and did not mark itself" is.
      if (drawn.width > box.width + 1 || drawn.height > box.height + 1) {
        misfit++;
        misfitIds.push(c.id);
      }
      // The marker the floor earns: js/main.js stamps data-scaling-clipped on a section whose
      // applied scale still leaves content outside the box. Read it here as the sheet's own
      // claim, so the case below can compare the claim with the pixels.
      const marked = c.getAttribute("data-scaling-clipped") === "true";
      if (marked) clipped.push(c.id);
      scaled.push({
        id: c.id,
        marked,
        transform: inner.style.transform,
        scale: parseFloat((inner.style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || "1"),
      });
    }
    return {
      containers: containers.length,
      scaledCount: scaled.length,
      misfit,
      misfitIds,
      clipped,
      // The scales of the MARKED sections specifically. `sample` is only the first four, and
      // on the demo sheet the marked one is not among them (measured: Spells is 5th) — a check
      // run over `sample` would silently see nothing.
      clippedScales: scaled
        .filter((s) => s.marked)
        .map((s) => ({ id: s.id, scale: s.scale })),
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

  it("scaled content fits its container, or says so — and no observer loop was reported", async function () {
    const st = await readSheet(page);
    // THE CONTRACT AFTER THE FLOOR. This case used to assert `misfit === 0` outright, and it
    // was RED on a clean HEAD (measured: 1 section, `section-Spells`) because MIN_SCALE_FLOOR
    // = 0.60 can refuse to shrink content that needs less — issue
    // scaling_floor_spells_0443_20260913. "Fit, or be silent" is not what shipped; the honest
    // rule is "fit, or mark it", so the measure is now the DISAGREEMENT between the pixels and
    // the sheet's own claim:
    //   * a section that overflows WITHOUT marking itself is the silent clip the issue forbids;
    //   * a section that marks itself and still FITS is a false alarm on the user's sheet.
    // Both are failures. Neither can be reached by a spec that measures nothing (the case above
    // proves a scale was applied).
    const unmarked = st.misfitIds.filter((id) => !st.clipped.includes(id));
    const falseAlarms = st.clipped.filter((id) => !st.misfitIds.includes(id));
    assert.deepStrictEqual(
      unmarked,
      [],
      unmarked.length + " scaled sections overflow their content box and are NOT marked " +
        "data-scaling-clipped — the floor's cost is silent again: " + JSON.stringify(unmarked),
    );
    assert.deepStrictEqual(
      falseAlarms,
      [],
      "marked as clipped but the content fits: " + JSON.stringify(falseAlarms) +
        " — a warning that lies is worse than no warning",
    );
    // And the marker must mean "the floor decided", so every marked section sits AT the floor.
    const flooredOff = st.clippedScales.filter((s) => s.scale > 0.6001);
    assert.deepStrictEqual(
      flooredOff,
      [],
      "a clipped section was NOT at the 0.60 floor — the marker means something else: " +
        JSON.stringify(flooredOff),
    );
    // Guard the guard: on the demo sheet exactly the sections that misfit are marked, and the
    // set is not empty. An assertion over two empty lists passes vacuously.
    assert.deepStrictEqual(
      st.clipped.slice().sort(),
      st.misfitIds.slice().sort(),
      "the marked set and the misfit set must be the SAME sections: clipped=" +
        JSON.stringify(st.clipped) + " misfit=" + JSON.stringify(st.misfitIds),
    );
    assert.ok(
      st.clipped.length >= 1,
      "no section on the demo sheet is floored into a clip, so every assertion above is " +
        "over empty sets and proves nothing — re-measure before trusting this case: " +
        JSON.stringify(st.clippedScales),
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
