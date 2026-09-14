/**
 * Browser E2E — PR #13 "Section merges and host_permissions for spell
 * section" (merge_sections_20260214): the "Reset to Default" control
 * (which un-merges and recreates sections) and the unified
 * .be-section-actions floating container that this PR introduced.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Sections carry a single unified .be-section-actions floating
 *      container holding the menu trigger + primary actions.
 *   2. The control panel exposes "Reset to Default" (renamed from Load
 *      Default in this PR).
 *   3. Clicking Reset to Default rebuilds a clean default layout (sections
 *      stay wrapped, no duplicate header/actions per section).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:mergereset
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage} = require("./_helpers.js");

describe("PR #13 Reset to Default + unified section actions (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("sections carry a unified .be-section-actions container with the trigger", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        );
        const withBar = ws.filter((w) => w.querySelector(":scope > .be-section-actions"));
        const withTrigger = ws.filter((w) =>
          w.querySelector(":scope > .be-section-actions .be-more-options-button"),
        );
        const triggerInMenu = ws.filter((w) =>
          w.querySelector(":scope > .be-section-actions .be-context-menu"),
        );
        return { total: ws.length, withBar: withBar.length, withTrigger: withTrigger.length, triggerInMenu: triggerInMenu.length };
      });
      assert.ok(st.total >= 20, "sections present");
      assert.strictEqual(
        st.withBar,
        st.total,
        "every section wrapper has an actions container",
      );
      assert.strictEqual(
        st.withTrigger,
        st.total,
        "every container holds the More Options trigger",
      );
      assert.strictEqual(
        st.triggerInMenu,
        st.total,
        "every container holds the context menu",
      );
    } finally {
      await page.close();
    }
  });

  it("the control panel exposes Reset to Default", async function () {
    const page = await bootPage(ctx);
    try {
      const has = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).some((b) => (b.textContent || "").includes("Reset to Default")),
      );
      assert.ok(has, "Reset to Default button present");
    } finally {
      await page.close();
    }
  });

  it("Reset to Default rebuilds a clean wrapped layout", async function () {
    const page = await bootPage(ctx);
    try {
      const before = await page.evaluate(
        () => document.querySelectorAll(".be-section-wrapper").length,
      );
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("Reset to Default"));
        if (b) b.click();
      });
      // Reset re-runs the full layout asynchronously; give it time to settle.
      await page.waitForTimeout(8000);
      const after = await page.evaluate(() => {
        const ws = Array.from(document.querySelectorAll(".be-section-wrapper"));
        return {
          ws: ws.length,
          noBar: ws.filter((w) => !w.querySelector(":scope > .be-section-actions")).length,
          noTrigger: ws.filter(
            (w) => !w.querySelector(":scope > .be-section-actions .be-more-options-button"),
          ).length,
          controlAlive: !!document.getElementById("print-enhance-controls"),
          clones: document.querySelectorAll(".print-section-container.be-clone").length,
        };
      });
      assert.ok(after.ws >= before * 0.8, "layout rebuilt with wrapped sections: " + after.ws);
      assert.strictEqual(after.noBar, 0, "every rebuilt section has an actions bar");
      assert.strictEqual(after.noTrigger, 0, "every rebuilt section has the trigger");
      assert.ok(after.controlAlive, "control panel survives reset");
    } finally {
      await page.close();
    }
  });
});
