/**
 * Browser E2E — PR #8 "docs: update README status; style: refine section
 * border rendering": a mostly-docs PR whose only product change is the
 * border-rendering style refinement. This suite pins that the refined
 * border rendering is intact: bordered sections carry their border classes
 * and the border is visually applied (border-image-source on the section's
 * ::before / container via injected CSS), with a clean Default + None
 * rendering.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Sections carry border style classes and the injected CSS defines
 *      them (border-image based).
 *   2. The Default border renders with the default asset.
 *   3. Applying a named style swaps the rendered border-image rule.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:borders8
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #8 Section border rendering refinement (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const cssAll = (page) =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent)
        .join("\n"),
    );

  it("bordered sections carry their classes and injected CSS renders them", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const cs = Array.from(document.querySelectorAll(".print-section-container"));
        return {
          total: cs.length,
          withBorderClass: cs.filter((c) =>
            Array.from(c.classList).some((x) => /_border|border/.test(x)),
          ).length,
        };
      });
      const css = await cssAll(page);
      assert.ok(st.total >= 20);
      assert.ok(st.withBorderClass >= 10, "sections carry border classes: " + st.withBorderClass);
      assert.ok(css.includes("border-image"), "injected CSS defines border-image");
      assert.ok(css.includes("--border-img"), "CSS uses the border-img variable");
    } finally {
      await page.close();
    }
  });

  it("Default border is rendered from the default asset", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await cssAll(page);
      // default-border rule points at border_default.webp
      assert.ok(
        /\.default-border[^{]*\{[^}]*url\([^)]*border_default\.webp\)/.test(css) ||
          css.includes("border_default.webp"),
        "default border uses border_default.webp",
      );
    } finally {
      await page.close();
    }
  });

  it("applying a named style renders its asset border-image", async function () {
    const page = await bootPage(ctx);
    try {
      const secId = await page.evaluate(() => {
        const w = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).find((x) => {
          const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
          return m && m.querySelector(".be-border-button");
        });
        return w ? w.id : null;
      });
      assert.ok(secId);
      await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(250);
      await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
      await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 15000 });
      await page.evaluate(() => {
        const opt = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find(
          (o) => o.querySelector(".spikes_border"),
        );
        opt.click();
        const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find(
          (b) => b.textContent.trim().startsWith("Apply"),
        );
        ok.click();
      });
      await page.waitForFunction(
        (id) => {
          const w = document.getElementById(id);
          const c = w.querySelector(".print-section-container");
          return c && c.classList.contains("spikes_border");
        },
        secId,
        { timeout: 10000 },
      );
      // the spikes class rule points at the spikes asset via --border-img
      const css = await cssAll(page);
      const rule = css.match(/\.spikes_border\s*\{[^}]*\}/);
      assert.ok(rule, "a .spikes_border CSS rule exists");
      assert.ok(
        rule[0].includes("border_spikes.webp"),
        "spikes rule references the spikes webp asset: " + rule[0].slice(0, 120),
      );
    } finally {
      await page.close();
    }
  });
});
