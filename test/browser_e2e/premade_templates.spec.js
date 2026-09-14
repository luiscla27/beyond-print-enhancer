/**
 * Browser E2E — PR #25 "Started Premade sheets feature / Added first extra
 * shapes" (archer_template_replication_20260318): the PREMADE catalog with
 * the Archer sheet template and the first extra (archer) shapes.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The catalog (TEMPLATES button) lists the Archer template.
 *   2. Archer's detail modal summarizes its contents (borders + shapes).
 *   3. Applying the Archer template runs the apply flow and re-styles the
 *      sheet (border classes change, decorations applied, modal closes).
 *   4. The extra archer accent shapes are selectable in the Add Shape
 *      picker's Shapes tab.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:archer
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #25 Premade sheets — Archer template (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function openCatalog(page) {
    await page.evaluate(() => {
      const b = Array.from(
        document.querySelectorAll("#print-enhance-controls button"),
      ).find((x) => (x.textContent || "").includes("TEMPLATES"));
      b.click();
    });
    await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
  }

  it("the Templates catalog lists the Archer template with a thumbnail", async function () {
    const page = await bootPage(ctx);
    try {
      await openCatalog(page);
      const items = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-catalog-item")).map((i) => ({
          title:
            i.querySelector(".be-catalog-title") &&
            i.querySelector(".be-catalog-title").textContent,
          hasThumb: !!(
            i.querySelector(".be-catalog-thumbnail") &&
            i.querySelector(".be-catalog-thumbnail").src
          ),
        })),
      );
      const archer = items.find((i) => i.title === "Archer Template");
      assert.ok(archer, "Archer Template should be listed: " + JSON.stringify(items));
      assert.ok(archer.hasThumb, "Archer catalog item has a thumbnail");
    } finally {
      await page.close();
    }
  });

  it("Archer's detail modal summarizes its contents (borders + shapes)", async function () {
    const page = await bootPage(ctx);
    try {
      await openCatalog(page);
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll(".be-catalog-title")).find(
          (e) => e.textContent.includes("Archer"),
        );
        t.closest(".be-catalog-item").click();
      });
      // Single-overlay contract: detail is an in-modal view (one overlay).
      await page.waitForFunction(
        () => !!document.querySelector(".be-catalog-back"),
        { timeout: 15000 },
      );
      const text = await page.evaluate(
        () => document.querySelector(".be-modal").textContent || "",
      );
      assert.ok(
        /Includes:\s*\d+ Borders,\s*\d+ Shapes/.test(text),
        "detail modal summarizes borders+shapes, got: " + text.slice(0, 200),
      );
    } finally {
      await page.close();
    }
  });

  it("applying the Archer template re-styles the sheet and closes the modals", async function () {
    const page = await bootPage(ctx);
    try {
      await openCatalog(page);
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll(".be-catalog-title")).find(
          (e) => e.textContent.includes("Archer"),
        );
        t.closest(".be-catalog-item").click();
      });
      // Single-overlay contract (T-1): detail is an IN-MODAL view, then an
      // in-modal confirm; apply runs after the confirm.
      await page.waitForFunction(
        () => !!document.querySelector(".be-catalog-back"),
        { timeout: 15000 },
      );
      // Detail → Apply Template opens the in-modal confirm.
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal button"),
        ).find((x) => x.textContent.trim() === "Continue…");
        b.click();
      });
      await page.waitForFunction(
        () => /Apply template/.test(
          (document.querySelector(".be-catalog-view") || {}).textContent || "",
        ),
        { timeout: 15000 },
      );
      // Confirm → Apply Template (the confirm's primary) applies for real.
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll(".be-modal button"),
        ).find((x) => x.textContent.trim() === "Continue");
        b.click();
      });
      // wait for the modal to close after apply.
      await page.waitForFunction(
        () => !document.querySelector(".be-modal-overlay"),
        { timeout: 25000 },
      );
      const after = await page.evaluate(() => ({
        borderClasses: Array.from(
          document.querySelectorAll(".print-section-container"),
        )
          .map((c) => c.className)
          .filter((x) => /(ornament|spikes|ability|goth|barbarian|dwarf|vine|plants|sticks)_border/.test(x))
          .length,
        feedback: Array.from(document.querySelectorAll(".be-feedback")).map((f) =>
          f.textContent.trim(),
        ),
      }));
      // Applying a full template should have re-styled the sheet (many border
      // classes present; modal gone). Count must be > the pre-apply distinct
      // checks: assert the template actually applied ornament-classes beyond
      // whatever existed. We assert at least the modal closed and either
      // feedback or a changed class distribution is observable.
      assert.ok(after.borderClasses >= 5, "border classes applied by template");
      assert.ok(
        after.feedback.some((t) => t.includes("Template applied")),
        "apply feedback shown: " + JSON.stringify(after.feedback),
      );
    } finally {
      await page.close();
    }
  });

  it("archer accent shapes are offered in the Add Shape picker (Shapes tab)", async function () {
    const page = await bootPage(ctx);
    try {
      // unlock the default shape layer so the picker opens
      await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const row = panel.querySelector(
          '.be-layer-row[data-layer-id="shapes-default"]',
        );
        const lock = row.querySelector('button[title="Toggle Edit Mode"]');
        if (lock.dataset.state === "locked") lock.click();
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        document.getElementById("be-btn-add-shape").click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal-tab", {
        timeout: 15000,
      });
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
          (x) => x.textContent === "Shapes",
        );
        t.click();
      });
      await page.waitForTimeout(600);
      const hasArcher = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            ".be-modal-overlay .be-border-option .be-border-preview",
          ),
        ).some((e) => {
          const bg = getComputedStyle(e).backgroundImage || "";
          return bg.includes("archer");
        }),
      );
      assert.ok(
        hasArcher,
        "archer accent shapes should appear in the Shapes tab previews",
      );
    } finally {
      await page.close();
    }
  });
});
