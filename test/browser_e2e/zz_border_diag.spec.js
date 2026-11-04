/**
 * DIAGNOSTIC (not a gate) — why did Muse see the same dark rectangle in all six cells?
 *
 * WHAT IT MEASURES
 * ----------------
 * For one deliberately LOUD border (a solid magenta 6px rect, impossible to miss), on the section
 * `aiArrangeFirstSection` picks:
 *   1. whether the border pixels reach the CAMERA at all (screen diff, border on vs border off);
 *   2. what is actually painted on top of the section at that rect;
 *   3. the same for the section `aiArrangeEvidenceTarget` picks (the one the AC-V1 gate already
 *      measured as UNOBSTRUCTED).
 *
 * WHY THE SECOND TARGET IS THE SUSPECT
 * ------------------------------------
 * `aiArrangeEvidenceTarget`'s own docstring records the measurement that killed the first AC-V1
 * gate round: the demo sheet's first arrangeable section sits at record x 16..240, and the tool's
 * OWN control panel is `position: fixed` at viewport x 10..258 with `z-index: 10000`, while a
 * section is z-index 10. The gallery picked `aiArrangeFirstSection` (width >= 100, first match),
 * which is exactly that panel-occluded section.
 *
 * Run: npx mocha test/browser_e2e/zz_border_diag.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "temp", "visual_logs", "byok_svg_borders_20260927", "diag");

const LOUD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
  '<rect x="3" y="3" width="94" height="94" fill="none" stroke="#ff00ff" stroke-width="6"/>' +
  "</svg>";

describe("DIAG — is the gallery photographing the border, or the tool's own panel?", function () {
  this.timeout(900000);
  let ctx;
  let page;

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  async function shot(name) {
    fs.mkdirSync(OUT, { recursive: true });
    const full = path.join(OUT, name);
    await page.screenshot({ path: full });
    return full;
  }

  /** What the MAIN world says is on top of the section's rect. */
  async function topAt(sid) {
    return page.evaluate((id) => {
      const s = document.getElementById(id);
      if (!s) return { ok: false };
      const r = s.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((e) => {
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName,
          cls: String(e.className || "").slice(0, 60),
          pos: cs.position,
          z: cs.zIndex,
          bg: cs.backgroundColor,
        };
      });
      return {
        ok: true,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        stack,
      };
    }, sid);
  }

  it("measures whether the border reaches the camera, for BOTH candidate targets", async function () {
    const first = await contentCall(ctx, "aiArrangeFirstSection", []);
    assert.ok(first.ok, "no first section: " + JSON.stringify(first));
    const target = await contentCall(ctx, "aiArrangeEvidenceTarget", [{ minDist: 40 }]);
    console.log("first section   :", JSON.stringify(first.id), first.width, "x", first.height);
    console.log("evidence target :", JSON.stringify(target && target.pick && target.pick.id));

    const report = {};
    for (const label of ["first", "target"]) {
      const sid = label === "first" ? first.id : target && target.pick && target.pick.id;
      if (!sid) {
        report[label] = { skipped: "no id" };
        continue;
      }
      // OFF
      await contentCall(ctx, "aiArrangeProbe", [{ action: "applyBorder", sectionId: sid, rawSvg: "" }]);
      const off = await shot("off-" + label + ".png");
      // ON
      const on = await contentCall(ctx, "aiArrangeProbe", [
        { action: "applyBorder", sectionId: sid, rawSvg: LOUD },
      ]);
      const onFile = await shot("on-" + label + ".png");
      report[label] = {
        id: sid,
        chokePoint: on,
        topAt: await topAt(sid),
        off,
        on: onFile,
      };
      // clear
      await contentCall(ctx, "aiArrangeProbe", [{ action: "applyBorder", sectionId: sid, rawSvg: "" }]);
    }

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "diag-report.json"), JSON.stringify(report, null, 2));
    console.log("DIAG REPORT");
    console.log(JSON.stringify(report, null, 2).slice(0, 4000));
  });
});
