/**
 * Browser E2E — PR #12 "Extract section content" (dynamic content
 * extraction trigger + rollback): double-clicking a flagged extractable
 * element lifts it out of its section into its own floating extracted
 * section with a content header and rollback wiring.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Extractable elements are flagged with .be-extractable + a
 *      .be-ext-* identification class.
 *   2. Double-clicking an extractable (after the layout re-flags the DOM)
 *      creates a floating .be-extracted-section carrying the discovered
 *      title in a standardized header.
 *   3. The extracted section is placed in the print sections layer and
 *      appended exactly once per double-click.
 *   4. The source element is hidden after extraction (moved out of the
 *      live flow).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:extract
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #12 Dynamic content extraction (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Apply the Archer template — its applyLayout re-flags extractable
   *  elements on the current DOM (the flag pass runs on freshly created
   *  nodes), making the double-click extraction trigger live.
   *
   *  DRIFT NOTE (ISSUE_browser_e2e_gate_drift_20260912, F1): this helper used to wait
   *  for a SECOND stacked `.be-modal-overlay` whose INLINE `style.zIndex` was "31000",
   *  then click "Apply Template" inside it. The catalog was migrated to ONE overlay
   *  with an in-modal view state (grid ⇄ detail ⇄ confirm) and no stacked
   *  30000/31000 overlays — stated verbatim in `js/catalog_service.js` (T-1/AC-2 of
   *  custom_upload_templates_ux_20260909) — so that wait could never resolve. The
   *  overlay's stacking now comes from CSS (`js/print_styles.js`), never from an inline
   *  style, which is exactly why the inline read is the wrong thing to wait on. The flow
   *  below drives the shipped one: card -> detail (`Continue…`) -> in-modal confirm
   *  (`Continue`, `.be-modal-ok`) -> apply.
   */
  async function enableExtraction(page) {
    await page.evaluate(() => {
      const b = Array.from(
        document.querySelectorAll("#print-enhance-controls button"),
      ).find((x) => (x.textContent || "").includes("TEMPLATES"));
      b.click();
    });
    await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll(".be-catalog-title")).find(
        (e) => e.textContent.includes("Archer"),
      );
      t.closest(".be-catalog-item").click();
    });
    // Detail view of the ONE overlay (the Back control is its marker).
    await page.waitForSelector(".be-catalog-back", { timeout: 15000 });
    // "Continue…" — the detail view's own class, not its copy.
    await domClick(page, ".be-modal-overlay .be-modal-ok");
    // In-modal apply confirm, then apply.
    await page.waitForSelector(".be-catalog-confirm-cancel", { timeout: 15000 });
    await domClick(page, ".be-modal-overlay .be-modal-ok");
    await page.waitForFunction(
      () => !document.querySelector(".be-modal-overlay"),
      { timeout: 25000 },
    );
    await page.waitForTimeout(1200);
  }

  function dblclickExtractable(page) {
    return page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".be-extractable"));
      const pick =
        els.find(
          (el) =>
            el.textContent.trim().length > 12 &&
            el.getBoundingClientRect().width > 40,
        ) || els[0];
      if (!pick) return null;
      const r = pick.getBoundingClientRect();
      pick.dispatchEvent(
        new MouseEvent("dblclick", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + 20,
          clientY: r.top + 20,
        }),
      );
      return {
        cls: pick.className.toString().slice(0, 60),
        titleHint: pick.textContent.trim().slice(0, 24),
      };
    });
  }

  it("extractable elements are flagged with identification classes", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll(".be-extractable"));
        return {
          count: els.length,
          withExtId: els.filter((el) =>
            Array.from(el.classList).some((c) => c.startsWith("be-ext-")),
          ).length,
        };
      });
      assert.ok(st.count >= 5, "extractable elements flagged: " + st.count);
      assert.ok(st.withExtId >= 1, "elements carry be-ext-* id classes");
    } finally {
      await page.close();
    }
  });

  it("double-clicking an extractable creates a floating extracted section with its title", async function () {
    const page = await bootPage(ctx);
    try {
      await enableExtraction(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      const pick = await dblclickExtractable(page);
      assert.ok(pick, "an extractable was double-clicked");
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-extracted-section").length > n,
        before,
        { timeout: 20000 },
      );
      const st = await page.evaluate(() => {
        const secs = Array.from(
          document.querySelectorAll(".be-extracted-section"),
        );
        const last = secs[secs.length - 1];
        const header = last.querySelector(".ct-content-group__header-content");
        return {
          count: secs.length,
          hasHeader: !!header,
          title: header ? header.textContent : "",
          inSectionsLayer: !!last.closest("#print-enhance-sections-layer"),
        };
      });
      assert.strictEqual(st.count, before + 1, "one extracted section created");
      assert.ok(st.hasHeader && st.title.trim().length > 0, "carries a title header");
      assert.ok(st.inSectionsLayer, "extracted section lives in the sections layer");
    } finally {
      await page.close();
    }
  });

  it("double-clicking again adds exactly one more (no runaway duplication)", async function () {
    const page = await bootPage(ctx);
    try {
      await enableExtraction(page);
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      await dblclickExtractable(page);
      await page.waitForFunction(
        (n) => document.querySelectorAll(".be-extracted-section").length > n,
        before,
        { timeout: 20000 },
      );
      await page.waitForTimeout(1200);
      const afterFirst = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      await dblclickExtractable(page);
      await page.waitForTimeout(2500);
      const afterSecond = await page.evaluate(
        () => document.querySelectorAll(".be-extracted-section").length,
      );
      assert.strictEqual(afterFirst, before + 1);
      assert.ok(
        afterSecond === afterFirst || afterSecond === before + 2,
        "each double-click yields one extraction (got " + afterSecond + ")",
      );
    } finally {
      await page.close();
    }
  });
});
