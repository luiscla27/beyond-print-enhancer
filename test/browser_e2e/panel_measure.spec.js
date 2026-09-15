/**
 * Phase 5 measurement (track ux_gaps_20260911, AC-5).
 *
 * AC-5's precondition is a measurement of the common path, and its fail condition is explicit:
 * "a control is hidden on a hunch; OR the measurement does not exist and the cut is kept
 * anyway." A first-time-user timing study is not something an agent can run, so this captures
 * the OBJECTIVE half: the panel's real geometry at the pinned viewport — what is above the
 * fold, what needs scrolling, and the order/weight of the controls. Whatever Phase 5 does must
 * follow from these numbers, and if they do not justify a change, none is made.
 *
 *   PANEL_MEASURE=1 npx mocha test/browser_e2e/panel_measure.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

const ENABLED = process.env.PANEL_MEASURE === "1";
const ART_ROOT = process.env.PANEL_MEASURE_DIR || "vendor/docs/ux-gaps-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase5");

describe("Phase 5 — measurement of the panel's default surface (AC-5)", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () {
    if (ctx) await ctx.close();
  });

  it("measures what the panel actually shows at the pinned viewport", async function () {
    const m = await page.evaluate(() => {
      const panel = document.getElementById("print-enhance-controls");
      if (!panel) return null;
      const scroll = panel.querySelector(".be-ctl-scroll");
      const pr = panel.getBoundingClientRect();
      const vh = window.innerHeight;
      const out = {
        viewport: { w: window.innerWidth, h: vh },
        panel: { top: Math.round(pr.top), height: Math.round(pr.height),
                 width: Math.round(pr.width), bottom: Math.round(pr.bottom) },
        scrollport: scroll ? { clientHeight: Math.round(scroll.clientHeight),
                               scrollHeight: Math.round(scroll.scrollHeight) } : null,
        rows: [], trays: [],
      };
      // every action row in document order, with whether it is above the fold
      panel.querySelectorAll("button").forEach((b, i) => {
        const r = b.getBoundingClientRect();
        const text = (b.textContent || "").trim();
        if (!text) return;
        out.rows.push({
          i, text: text.slice(0, 34),
          top: Math.round(r.top), bottom: Math.round(r.bottom),
          aboveFold: r.bottom <= vh && r.top >= 0,
          inScrollport: scroll ? r.bottom > scroll.getBoundingClientRect().bottom : false,
        });
      });
      panel.querySelectorAll(".be-ctl-tray").forEach((tr) => {
        const r = tr.getBoundingClientRect();
        out.trays.push({ head: (tr.querySelector(".be-ctl-tray-head") || {}).textContent || "",
                         top: Math.round(r.top), height: Math.round(r.height) });
      });
      return out;
    });
    assert.ok(m, "the panel is in the live DOM");

    console.log("\n== VIEWPORT / PANEL ==");
    console.log("   viewport:", JSON.stringify(m.viewport));
    console.log("   panel   :", JSON.stringify(m.panel));
    console.log("   scrollport:", JSON.stringify(m.scrollport));
    const needScroll = m.scrollport && m.scrollport.scrollHeight > m.scrollport.clientHeight + 4;
    console.log("   panel body overflows its scrollport:", needScroll,
      m.scrollport ? `(${m.scrollport.scrollHeight} content vs ${m.scrollport.clientHeight} visible)` : "");

    console.log("\n== ACTION CONTROLS, document order (top -> bottom) ==");
    console.log("   #  control                              top   bottom  above-fold");
    for (const r of m.rows) {
      console.log(`   ${String(r.i).padStart(2)} ${r.text.padEnd(36)} ${String(r.top).padStart(5)} ${String(r.bottom).padStart(7)}   ${r.aboveFold ? "yes" : "NO"}`);
    }
    console.log("\n== TRAYS ==");
    for (const t of m.trays) console.log(`   ${t.head.padEnd(8)} top=${String(t.top).padStart(5)} height=${t.height}`);

    const belowFold = m.rows.filter((r) => !r.aboveFold);
    console.log(`\n== SUMMARY ==\n   controls: ${m.rows.length}   above the fold: ${m.rows.length - belowFold.length}   below: ${belowFold.length}`);
    if (belowFold.length) console.log("   below the fold:", JSON.stringify(belowFold.map((r) => r.text)));

    await page.screenshot({ path: path.join(SHOTS, "40-panel-default.png") });
    fs.writeFileSync(path.join(SHOTS, "panel-measure.json"), JSON.stringify(m, null, 2));
    console.log("\nframe:", path.join("shots-phase5", "40-panel-default.png"));
    assert.ok(true, "measurement recorded");
  });
});
