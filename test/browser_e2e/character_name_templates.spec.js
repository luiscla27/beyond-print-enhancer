/**
 * Browser E2E — PR #36 "WIP: Adding character name section, and also the
 * button for the template's catalog": the sheet shows the character name in
 * its own draggable tidbit section, and the control panel exposes the
 * TEMPLATES button that opens the premade-template catalog (renamed from
 * "Premade Templates").
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The character's name is shown at the top of the sheet (tidbit
 *      heading) and rendered into a draggable extension section.
 *   2. The control panel exposes a TEMPLATES button.
 *   3. Clicking TEMPLATES opens the catalog modal listing the active
 *      templates (each with name, description and thumbnail).
 *   4. Clicking a template opens its detail/preview modal (name,
 *      description, contents summary, Apply Template + Back).
 *   5. Back returns to the catalog; Apply Template runs the template apply
 *      flow (confirm + layout update + success feedback).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:char
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage} = require("./_helpers.js");

describe("PR #36 Character name section + Templates catalog (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("renders the character name in its own draggable tidbit section", async function () {
    const page = await bootPage(ctx);
    try {
      const name = await page.evaluate(() => {
        const h1 = document.querySelector(".ddbc-character-tidbits__heading h1");
        return h1 ? h1.textContent.trim() : "";
      });
      assert.ok(name, "character name heading should exist on the sheet");

      const sec = await page.evaluate(() => {
        const ext = document.querySelector(".be-tidbit-extension-section");
        if (!ext) return null;
        const w = ext.closest(".be-section-wrapper");
        return {
          wrapperTitle: w && w.dataset.title,
          wrapperId: w && w.id,
          hasBody: !!w.querySelector(".ddbc-character-tidbits__body"),
          hasActions: !!w.querySelector(":scope > .be-section-actions"),
        };
      });
      assert.ok(sec, "tidbit extension section should exist");
      assert.strictEqual(
        sec.wrapperTitle,
        name,
        "draggable section should be titled with the character name",
      );
      assert.ok(
        /^section-extra-tidbits/.test(sec.wrapperId || ""),
        "wrapper id should be the tidbit extension one, got " + sec.wrapperId,
      );
      assert.ok(sec.hasBody, "the tidbits body should be integrated");
      assert.ok(sec.hasActions, "section should have its action bar");
    } finally {
      await page.close();
    }
  });

  it("shows a TEMPLATES button in the control panel", async function () {
    const page = await bootPage(ctx);
    try {
      const btn = await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("TEMPLATES"));
        return b ? { text: b.textContent.trim().replace(/\s+/g, " "), visible: b.offsetParent !== null } : null;
      });
      assert.ok(btn, "TEMPLATES button should exist in the control panel");
      assert.ok((btn.text || "").includes("TEMPLATES"));
      assert.ok(btn.visible, "TEMPLATES button should be visible");
    } finally {
      await page.close();
    }
  });

  it("opens the Templates catalog listing the active templates with thumbnails", async function () {
    const page = await bootPage(ctx);
    try {
      await page.evaluate(() => {
        const b = Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("TEMPLATES"));
        b.click();
      });
      await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
      const cat = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".be-catalog-item")).map(
          (i) => ({
            title:
              i.querySelector(".be-catalog-title") &&
              i.querySelector(".be-catalog-title").textContent,
            hasThumb: !!(
              i.querySelector(".be-catalog-thumbnail") &&
              i.querySelector(".be-catalog-thumbnail").src
            ),
            hasDesc: !!i.querySelector(".be-catalog-description"),
          }),
        );
        return {
          heading:
            document.querySelector(".be-modal h3") &&
            document.querySelector(".be-modal h3").textContent,
          items,
        };
      });
      assert.strictEqual(cat.heading, "Templates");
      assert.ok(cat.items.length >= 1, "catalog should list active templates");
      const names = cat.items.map((i) => i.title);
      assert.ok(names.includes("Basic Template"), "Basic Template should be listed: " + names);
      assert.ok(
        cat.items.every((i) => i.hasThumb && i.hasDesc),
        "every catalog item should show a thumbnail and description",
      );
    } finally {
      await page.close();
    }
  });

  it("selecting a template opens its detail modal with Apply Template + Back", async function () {
    const page = await bootPage(ctx);
    try {
      await page.evaluate(() => {
        Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("TEMPLATES")).click();
      });
      await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
      await page.evaluate(() => {
        const first = document.querySelectorAll(".be-catalog-item")[0];
        first.click();
      });
      // Single-overlay contract: detail is an IN-MODAL view of the one overlay.
      await page.waitForFunction(
        () => !!document.querySelector(".be-catalog-back"),
        { timeout: 15000 },
      );
      const detail = await page.evaluate(() => {
        const pm = document.querySelector(".be-modal");
        return {
          title: pm && pm.querySelector("h3") && pm.querySelector("h3").textContent,
          hasImg: !!(pm && pm.querySelector("img")),
          hasApply: !!(
            pm &&
            Array.from(pm.querySelectorAll("button")).some((b) =>
              b.textContent.trim() === "Continue…",
            )
          ),
          hasBack: !!(
            pm &&
            Array.from(pm.querySelectorAll("button")).some(
              (b) => b.textContent.trim() === "Back",
            )
          ),
          includes: pm && pm.textContent.includes("Includes:"),
          overlayCount: document.querySelectorAll(".be-modal-overlay").length,
        };
      });
      assert.ok(detail.title, "detail modal should show the template name");
      assert.ok(detail.hasImg, "detail modal should show the template image");
      assert.ok(detail.includes, "detail modal should summarize contents");
      assert.ok(detail.hasApply && detail.hasBack, "Apply + Back buttons present");
    } finally {
      await page.close();
    }
  });

  it("Back returns from the template detail to the catalog", async function () {
    const page = await bootPage(ctx);
    try {
      await page.evaluate(() => {
        Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("TEMPLATES")).click();
      });
      await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
      await page.evaluate(() => {
        document.querySelectorAll(".be-catalog-item")[0].click();
      });
      await page.waitForFunction(
        () => !!document.querySelector(".be-catalog-back"),
        { timeout: 15000 },
      );
      await page.evaluate(() => {
        const back = Array.from(
          document.querySelectorAll(".be-modal button"),
        ).find((b) => b.textContent.trim() === "Back");
        back.click();
      });
      await page.waitForFunction(
        () => !!document.querySelector(".be-catalog-item"),
        { timeout: 10000 },
      );
      const stillCatalog = await page.evaluate(
        () => document.querySelectorAll(".be-catalog-item").length > 0,
      );
      assert.ok(stillCatalog, "Back should return to the catalog grid");
    } finally {
      await page.close();
    }
  });

  it("Apply Template runs the apply flow (confirm) and shows success feedback", async function () {
    const page = await bootPage(ctx);
    try {
      const dialogs = [];
      page.on("dialog", (d) => {
        dialogs.push((d.message() || "").slice(0, 60));
        d.accept().catch(() => {});
      });
      await page.evaluate(() => {
        Array.from(
          document.querySelectorAll("#print-enhance-controls button"),
        ).find((x) => (x.textContent || "").includes("TEMPLATES")).click();
      });
      await page.waitForSelector(".be-catalog-item", { timeout: 15000 });
      await page.evaluate(() => {
        document.querySelectorAll(".be-catalog-item")[0].click();
      });
      await page.waitForFunction(
        () => !!document.querySelector(".be-catalog-back"),
        { timeout: 15000 },
      );
      // Detail → Apply Template opens the IN-MODAL confirm (no native dialog).
      await page.evaluate(() => {
        const apply = Array.from(
          document.querySelectorAll(".be-modal button"),
        ).find((b) => b.textContent.trim() === "Continue…");
        apply.click();
      });
      await page.waitForFunction(
        () => /Apply template/.test(
          (document.querySelector(".be-catalog-view") || {}).textContent || "",
        ),
        { timeout: 15000 },
      );
      // Confirm → the ratified commit verb applies for real (no ellipsis on the
      // confirm's own primary: nothing further follows it).
      await page.evaluate(() => {
        const apply = Array.from(
          document.querySelectorAll(".be-modal button"),
        ).find((b) => b.textContent.trim() === "Continue");
        apply.click();
      });
      await page.waitForFunction(
        () => !document.querySelector(".be-modal-overlay"),
        { timeout: 20000 },
      );
      assert.strictEqual(
        dialogs.length,
        0,
        "no native confirm dialog (in-modal confirm replaces it), got: " +
          JSON.stringify(dialogs),
      );
      // Feedback toast appears briefly ("Template applied: …").
      const feedback = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".be-feedback")).map((f) =>
          f.textContent.trim(),
        ),
      );
      assert.ok(
        feedback.some((t) => t.includes("Template applied")),
        "apply success feedback expected, got: " + JSON.stringify(feedback),
      );
    } finally {
      await page.close();
    }
  });
});
