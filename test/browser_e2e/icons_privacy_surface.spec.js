/**
 * Browser E2E — PR #7 "added PRIVACY_POLICY.md and icons": the packaged
 * privacy policy + extension icons. Infrastructure PR — this suite pins the
 * packaged surface: declared icons exist and load, and the privacy policy
 * is present (the store-policy artifact).
 *
 * One test per user-facing iteration:
 *   1. Every icon referenced by the manifest exists on disk.
 *   2. The action icon is set and the extension UI renders on the sheet.
 *   3. PRIVACY_POLICY.md (and README) are packaged.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:icons
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, EXT_ROOT } = require("./_helpers.js");

describe("PR #7 Icons + privacy policy surface (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("all manifest-declared icons exist on disk", function () {
    const m = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "manifest.json"), "utf8"));
    const iconSets = [m.icons, m.action && m.action.default_icon].filter(Boolean);
    assert.ok(iconSets.length >= 1, "manifest declares icon set(s)");
    for (const set of iconSets) {
      for (const p of Object.values(set)) {
        assert.ok(fs.existsSync(path.join(EXT_ROOT, p)), "icon exists: " + p);
        assert.ok(/\.(png|svg|webp|jpg)$/i.test(p), "icon is an image file: " + p);
      }
    }
  });

  it("the privacy policy and readme are packaged", function () {
    for (const f of ["PRIVACY_POLICY.md", "README.md"]) {
      assert.ok(fs.existsSync(path.join(EXT_ROOT, f)), f + " present");
    }
  });

  it("the extension UI renders on a character sheet", async function () {
    const page = await bootPage(ctx);
    try {
      const ok = await page.evaluate(() => ({
        controls: !!document.getElementById("print-enhance-controls"),
        sections: document.querySelectorAll(".be-section-wrapper").length,
      }));
      assert.ok(ok.controls, "control panel rendered");
      assert.ok(ok.sections >= 10, "sheet enhanced");
    } finally {
      await page.close();
    }
  });
});
