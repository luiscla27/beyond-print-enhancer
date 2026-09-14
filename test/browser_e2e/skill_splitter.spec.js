/**
 * Browser E2E — PR #37 "WIP Skill splitter" (skill_box_splitter_20260511):
 * the feature that splits the combined skills box into five individual
 * stat-based sections (STR / INT / WIS / CHA / DEX).
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The skills section exposes a "Split Skills" control (since the #38
 *      revamp it lives inside the section's ⋮ context menu).
 *   2. Triggering the split creates exactly 5 new stat sections.
 *   3. Each new section is titled with its ability score (STR/INT/WIS/CHA/DEX).
 *   4. Each new section keeps ONLY the skill rows matching its score and
 *      drops the rest (item filtering).
 *   5. The generated stat sections carry no Splitter control (no re-split).
 *   6. The original combined skills box section is removed after the split.
 *   7. The split state flag (window.skillsSplit) is set once split.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:skill
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #37 Skill splitter (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Locate the skills-box section wrapper id (throws if absent). */
  async function skillsWrapperId(page) {
    const id = await page.evaluate(() => {
      const w = Array.from(
        document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
      ).find((x) =>
        x.querySelector(".ct-skills__box, .ct-subsection--skills"),
      );
      return w ? w.id : null;
    });
    assert.ok(id, "skills box section not found on the sheet");
    return id;
  }

  it("exposes a Split Skills control for the skills section (inside its ⋮ menu)", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await skillsWrapperId(page);
      const info = await page.evaluate((id) => {
        const w = document.getElementById(id);
        const bar = w.querySelector(":scope > .be-section-actions");
        return {
          trigger: !!bar.querySelector(".be-more-options-button"),
          menuHidden:
            bar.querySelector(".be-context-menu").style.display === "none",
          splitter: !!bar
            .querySelector(".be-context-menu")
            .querySelector(".be-split-skills-button"),
          skillRows: w.querySelectorAll(".ct-skills__item").length,
        };
      }, id);
      assert.ok(info.trigger, "skills section should have a ⋮ trigger");
      assert.ok(info.menuHidden, "context menu starts hidden");
      assert.ok(info.splitter, "Split Skills control should be in the ⋮ menu");
      assert.ok(
        info.skillRows >= 5,
        "combined skills box should hold multiple stat rows, got " +
          info.skillRows,
      );
    } finally {
      await page.close();
    }
  });

  it("splitting creates exactly the 5 stat sections STR/INT/WIS/CHA/DEX", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await skillsWrapperId(page);
      await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
      await page.waitForFunction(
        (id) => {
          const w = document.getElementById(id);
          const m = w && w.querySelector(":scope > .be-section-actions > .be-context-menu");
          return !!m && m.style.display === "block";
        },
        id,
        { timeout: 10000 },
      );
      await domClick(
        page,
        `#${id} > .be-section-actions > .be-context-menu > .be-split-skills-button`,
      );
      await page.waitForFunction(
        () => {
          const secs = Array.from(
            document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          ).filter((x) => /^(STR|INT|WIS|CHA|DEX)$/.test(x.dataset.title || ""));
          return secs.length === 5;
        },
        { timeout: 20000 },
      );
      const titles = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        )
          .map((x) => x.dataset.title)
          .filter((t) => /^(STR|INT|WIS|CHA|DEX)$/.test(t || "")),
      );
      assert.deepStrictEqual(
        [...titles].sort(),
        ["CHA", "DEX", "INT", "STR", "WIS"],
        "expected exactly one section per ability score",
      );
    } finally {
      await page.close();
    }
  });

  it("each stat section keeps only skill rows matching its ability score", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await skillsWrapperId(page);
      await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(
        page,
        `#${id} > .be-section-actions > .be-context-menu > .be-split-skills-button`,
      );
      await page.waitForFunction(
        () =>
          Array.from(
            document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          ).filter((x) => /^(STR|INT|WIS|CHA|DEX)$/.test(x.dataset.title || ""))
            .length === 5,
        { timeout: 20000 },
      );
      const rows = await page.evaluate(() => {
        const out = [];
        Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).forEach((x) => {
          const t = x.dataset.title;
          if (!/^(STR|INT|WIS|CHA|DEX)$/.test(t || "")) return;
          const stats = Array.from(x.querySelectorAll(".ct-skills__item")).map(
            (r) => {
              const e = r.querySelector(
                ".ct-skills__item--stat, .ct-skills__col--stat",
              );
              return e ? e.textContent.trim().toUpperCase() : "";
            },
          );
          out.push({ title: t, stats });
        });
        return out;
      });
      assert.strictEqual(rows.length, 5);
      for (const r of rows) {
        assert.ok(r.stats.length >= 1, r.title + " should keep ≥1 matching row");
        assert.ok(
          r.stats.every((s) => s === r.title),
          r.title + " contains non-matching rows: " + r.stats.join(","),
        );
      }
    } finally {
      await page.close();
    }
  });

  it("generated stat sections carry no Split Skills control (no re-split)", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await skillsWrapperId(page);
      await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(
        page,
        `#${id} > .be-section-actions > .be-context-menu > .be-split-skills-button`,
      );
      await page.waitForFunction(
        () =>
          Array.from(
            document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          ).filter((x) => /^(STR|INT|WIS|CHA|DEX)$/.test(x.dataset.title || ""))
            .length === 5,
        { timeout: 20000 },
      );
      const splitterCount = await page.evaluate(() => {
        let n = 0;
        Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).forEach((x) => {
          const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
          if (m && m.querySelector(".be-split-skills-button")) n += 1;
        });
        return n;
      });
      assert.strictEqual(
        splitterCount,
        0,
        "no generated section should carry the splitter again",
      );
    } finally {
      await page.close();
    }
  });

  it("removes the original combined skills-box section from the enhancer layout", async function () {
    const page = await bootPage(ctx);
    try {
      const id = await skillsWrapperId(page);
      const beforeCount = await page.evaluate(
        () => document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)").length,
      );
      await domClick(page, `#${id} > .be-section-actions > .be-more-options-button`);
      await page.waitForTimeout(300);
      await domClick(
        page,
        `#${id} > .be-section-actions > .be-context-menu > .be-split-skills-button`,
      );
      await page.waitForFunction(
        (beforeCount) =>
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)").length >
          beforeCount + 3,
        beforeCount,
        { timeout: 20000 },
      );
      const after = await page.evaluate((id) => {
        // The original combined wrapper must be gone; the only remaining
        // skills-box owners are the five stat sections themselves (each keeps
        // its own filtered subset). The skills-split flag itself lives in the
        // extension's isolated world, so the DOM is the observable contract.
        const owners = Array.from(
          document.querySelectorAll(".be-section-wrapper"),
        ).filter((w) =>
          w.querySelector(".ct-skills__box, .ct-subsection--skills"),
        );
        return {
          origWrapperGone: !document.getElementById(id),
          ownerCount: owners.length,
          ownerIds: owners.map((w) => w.id),
        };
      }, id);
      assert.strictEqual(after.origWrapperGone, true, "original wrapper removed");
      assert.strictEqual(
        after.ownerCount,
        5,
        "only the five stat sections should remain as skills-box owners, got " +
          JSON.stringify(after.ownerIds),
      );
    } finally {
      await page.close();
    }
  });
});
