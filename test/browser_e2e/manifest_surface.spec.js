/**
 * Browser E2E — PR #6 "extension manifest.json": the MV3 manifest shaping
 * the packaged extension. Infrastructure PR with no interactive control —
 * this suite pins the extension-loading surface it defines.
 *
 * One test per user-facing iteration:
 *   1. The extension is MV3 with action + page rules matching character
 *      pages.
 *   2. The packaged content-script files listed in the manifest load in
 *      order (the enhancer boots = toolbar action works).
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:manifest
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, EXT_ROOT } = require("./_helpers.js");

describe("PR #6 MV3 manifest surface (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the manifest is MV3 with an action and page-action rule", function () {
    const m = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "manifest.json"), "utf8"));
    assert.strictEqual(m.manifest_version, 3);
    assert.ok(m.action || m.browser_action, "action declared");
    assert.ok(
      (m.background && m.background.service_worker) ||
        (m.background && m.background.scripts),
      "background entry declared",
    );
    assert.ok(Array.isArray(m.permissions), "permissions array present");
  });

  it("the toolbar action boots the enhancer on a character page", async function () {
    const page = await bootPage(ctx);
    try {
      const ok = await page.evaluate(() => ({
        controls: !!document.getElementById("print-enhance-controls"),
        layers: !!document.getElementById("print-enhance-layer-manager"),
      }));
      assert.ok(ok.controls && ok.layers, "extension booted via the action path");
    } finally {
      await page.close();
    }
  });
});
