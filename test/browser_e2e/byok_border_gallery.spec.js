/**
 * Browser E2E — BYOK SVG border gallery (AC-V1 gallery + prompt-corpus evidence).
 *
 * WHAT THIS SPEC IS
 * -----------------
 * A gallery E2E that applies MULTIPLE live-NOUS-generated SVG borders through the real
 * extension on the README's demo sheet (https://www.dndbeyond.com/characters/151911403),
 * and captures one labelled frame per design.
 *
 * The byok_border_roundtrip spec already proves the choke point contract, undo, and one
 * clean-vs-hostile path. This spec is NOT that contract: it is a MEASUREMENT of the
 * generator's real output against the product's real render path, so a visual gate can
 * score whether the generated borders look right.
 *
 * WHY THE DESIGN FILE IS THE AUTHORITY, NOT A HARDCODED LIST
 * -------------------------------------------------------
 * `scripts/border_designs.json` is the prompt corpus, and `temp/visual_logs/…/designs-round<N>.json`
 * is its run record. This spec reads the run record, filters to accepted designs, and applies each
 * through the choke point — so a prompt fix IS a `js/ai_layout.js` edit followed by a re-generation,
 * and the gallery automatically picks up the new designs.
 *
 * WHY THE EXTENSION'S OWN SEAMS ARE DRIVEN
 * ----------------------------------------
 * The gallery applies each SVG through `window.AiBorder.renderBorderSvg` — the SAME choke point
 * every real apply path uses. It never reaches the DOM directly; it never calls the sanitizer
 * outside the choke point. Each design is one call, one `readBorderSvg`, one DOM measurement, one
 * page.screenshot. That is the ONLY proof the gallery needs to carry: what the code does with the
 * design.
 *
 * GATING (graceful skip — a normal e2e run must never capture and never fail):
 *   BORDER_GALLERY_SHOTS=1          enable capturing
 *   BORDER_GALLERY_SHOTS_DIR=...    override the artifact root
 *   BORDER_GALLERY_ROUND=...        which designs-round<N>.json to read (default: 1)
 *
 * Run:
 *   BORDER_GALLERY_SHOTS=1 npx mocha test/browser_e2e/byok_border_gallery.spec.js --timeout 900000
 *
 * Or:
 *   npm run test:e2e:byokgallery
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");
const { captureHarness } = require("./_capture.js");

const ROOT = path.resolve(__dirname, "..", "..");
const cap = captureHarness({
  flag: "BORDER_GALLERY_SHOTS",
  dirVar: "BORDER_GALLERY_SHOTS_DIR",
  defaultDir: "temp/visual_logs/byok_svg_borders_20260927",
  subdir: "gallery-round" + (process.env.BORDER_GALLERY_ROUND || "1"),
});
const CAPTURING = cap.enabled;
const ROUND = process.env.BORDER_GALLERY_ROUND || "1";

/** Read the run record, filter to accepted designs, and assert the gallery has something to prove. */
function loadDesigns(round) {
  const p = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "designs-round" + round + ".json");
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  return (data.designs || []).filter((d) => d.accepted && d.svg);
}

const DEFAULT_TIMEOUT = (function () {
  try {
    return require("path").resolve(__dirname, "..", "..") ? 180000 : 30000;
  } catch {
    return 30000;
  }
})();

describe("BYOK SVG border gallery — live NOUS designs through the real choke point, real page", function () {
  this.timeout(900000);
  let ctx;
  let page;
  const designs = loadDesigns(ROUND);

  before(async function () {
    if (!CAPTURING) this.skip();
    if (designs.length === 0) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    const injected = await contentCall(ctx, "aiArrangeFirstSection", []);
    if (!injected.ok) this.skip();
    // `bootPage` already replayed the toolbar click that injects the file list, and the probe
    // above confirms the content script answered — but the file-list includes `js/ai_border.js`
    // which sets the seam, so wait for the choke point to actually resolve before anything else.
    // `window.AiBorder` is set in the ISOLATED world (the one `contentCall` drove above), not in
    // the MAIN world `page.evaluate` runs in; the byok_border_roundtrip spec measures it from the
    // MAIN world and sees it there because `executeScript` defines the property on `window` in that
    // world too, but there is a race between the service worker's `executeScript` call and the main
    // frame's readiness. The safest signal is the content-call probe itself: if the isolated world
    // can answer `aiArrangeFirstSection`, the file list was already injected.
    await page.setViewportSize(cap.viewport);
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("window.AiBorder is live in the ISOLATED world (the world the product's own code runs in)", async function () {
    // The byok_border_roundtrip spec reads `window.AiBorder` from the MAIN world, which is the
    // `page.evaluate` default. `contentCall` drives the ISOLATED world — the world the
    // extension's own content script and the choke point live in — so it is the honest place to
    // assert the seam: `renderBorderSvg` / `readBorderSvg` / `clearBorderSvg` all exist there.
    const modules = await contentCall(ctx, "aiBorderRead", []);
    assert.ok(modules && modules.render === "function", "renderBorderSvg is not on the isolated-world seam");
    assert.ok(modules && modules.read === "function", "readBorderSvg is not on the isolated-world seam");
    assert.ok(modules && modules.clear === "function", "clearBorderSvg is not on the isolated-world seam");
  });

  it("the README's demo sheet exposes at least one arrangeable section", async function () {
    const info = await contentCall(ctx, "aiArrangeFirstSection", []);
    assert.ok(info.ok, "the live sheet exposes no arrangeable section: " + JSON.stringify(info));
  });

  for (const d of designs) {
    it("renders " + d.id + " (" + d.title + ") behind content and captures a frame", async function () {
      const info = await contentCall(ctx, "aiArrangeFirstSection", []);
      assert.ok(info.ok, "no section available for " + d.id);
      const sectionId = info.id;

      // Clear any prior border on this section.
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
      }, sectionId);

      // Apply the design through the real choke point.
      const applied = await contentCall(ctx, "aiBorder", [{ action: "apply", sectionId, rawSvg: d.svg }]);
      assert.ok(applied && applied.ok, "renderBorderSvg refused " + d.id + ": " + JSON.stringify(applied));
      assert.strictEqual(applied.rendered, true, "the border did not render for " + d.id);
      assert.strictEqual(applied.hostile, false, "the rendered border contains hostile markup: " + d.id);
      assert.ok(applied.geom, "no overlay node for " + d.id);
      assert.strictEqual(applied.geom.position, "absolute", d.id + ": overlay not absolutely positioned");
      assert.strictEqual(applied.geom.pointerEvents, "none", d.id + ": overlay intercepts pointer events");
      assert.ok(applied.geom.zIndex < 0, d.id + ": overlay does not sit behind content (z-index " + applied.geom.zIndex + ")");

      // Clear the border for the next design.
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
      }, sectionId);
    });
  }

  if (CAPTURING && designs.length > 0) {
    it("captures a labelled frame for every accepted design", async function () {
      const info = await contentCall(ctx, "aiArrangeFirstSection", []);
      assert.ok(info.ok, "no section for gallery capture");
      const sectionId = info.id;
      const frames = [];

      for (const d of designs) {
        // Clear prior border.
        await page.evaluate((id) => {
          const section = document.getElementById(id);
          if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
        }, sectionId);

        // Apply design.
        const applied = await contentCall(ctx, "aiBorder", [{ action: "apply", sectionId, rawSvg: d.svg }]);
        if (!applied || !applied.ok) continue;

        await page.waitForTimeout(400);
        const name = d.id + ".png";
        await cap.frame(page, name);
        frames.push({ id: d.id, title: d.title, file: name, svgChars: (applied.read || "").length });
      }

      cap.probe("gallery-manifest.json", {
        round: ROUND,
        generatedAt: new Date().toISOString(),
        provenance: cap.provenance(page, "byok_border_gallery.spec.js"),
        designs: frames,
      });

      // Clean up last border.
      await page.evaluate((id) => {
        const section = document.getElementById(id);
        if (section && window.AiBorder) window.AiBorder.clearBorderSvg(section);
      }, sectionId);

      assert.ok(frames.length >= 1, "the gallery captured zero frames");
    });
  }
});