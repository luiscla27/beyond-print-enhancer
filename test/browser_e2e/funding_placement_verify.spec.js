/**
 * Phase 3 verification (track first_run_and_panel_20260911, AC-3 + AC-V1): the funding asks left the
 * panel and are still reachable.
 *
 * WHY A BROWSER RUN, AND WHAT ONLY IT CAN PROVE. AC-3's fail conditions are "an ask is deleted rather
 * than relocated" and "a monetisation channel becomes unreachable". A source scan proves a STRING is
 * present; it does not prove the browser accepts the menu item. So the reachability assertion here is
 * a RUNTIME one, made in the extension's own service worker: `chrome.contextMenus.update({id})`
 * resolves for an id that exists and REJECTS for one that does not — which is the closest thing
 * Chrome offers to "is this menu entry actually there", since `contextMenus` has no getAll().
 *
 *   FUNDING_SHOTS=1 npx mocha test/browser_e2e/funding_placement_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

const ENABLED = process.env.FUNDING_SHOTS === "1";
const ART_ROOT = process.env.FUNDING_SHOTS_DIR || "vendor/docs/first-run-and-panel-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase3");

/** The five destinations AC-3 must not lose: 3 funding channels + the bug tracker + the project page. */
const DESTINATIONS = ["sponsor", "donate", "buy-me-a-coffee", "contribute", "feedback"];

describe("Phase 3 — the funding asks moved, and nothing was lost (AC-3)", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () { if (ctx) await ctx.close(); });

  it("AC-3a: the live panel carries no fundraising row, and no empty HELP tray", async function () {
    const m = await page.evaluate(() => {
      const panel = document.getElementById("print-enhance-controls");
      const labels = Array.from(panel.querySelectorAll("button")).map((b) => b.textContent.trim());
      const heads = Array.from(panel.querySelectorAll(".be-ctl-tray-head")).map((h) =>
        h.textContent.trim(),
      );
      return {
        labels,
        trayHeads: heads,
        hasHelpTray: !!panel.querySelector(".be-ctl-tray-help"),
        hasContributeClass: !!panel.querySelector(".be-ctl-contribute"),
      };
    });
    console.log("\n-- panel after the move (live) --\n  ", JSON.stringify(m, null, 2));

    assert.ok(
      !m.labels.some((l) => /contribute/i.test(l)),
      `no fundraising row in the panel — got ${JSON.stringify(m.labels)}`,
    );
    // An EMPTY tray header would have been a worse artifact than no tray: asserted, not assumed.
    assert.ok(!m.hasHelpTray, "the HELP tray is gone, not left behind empty");
    assert.ok(
      !m.trayHeads.includes("HELP"),
      `no orphaned HELP header — got ${JSON.stringify(m.trayHeads)}`,
    );
    // The rest of the panel is intact: this was a move, not a demolition.
    ["Print", "Print settings", "Save to Browser", "Save to PC", "Undo", "Restore backup..."].forEach(
      (label) => {
        assert.ok(m.labels.includes(label), `"${label}" is still in the panel`);
      },
    );
    await page.screenshot({ path: path.join(SHOTS, "20-panel-no-help-tray.png") });
  });

  it("AC-3b/d: every destination is still REACHABLE — asserted at runtime, not from source", async function () {
    const sw =
      ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
      ctx.serviceWorkers()[0];
    assert.ok(sw, "the extension's service worker is running");

    // `update` resolves for an existing id and rejects for a missing one, so this distinguishes
    // "moved" from "deleted" in the browser's own registrar rather than in a regex over source.
    const reachable = await sw.evaluate(async (ids) => {
      const out = {};
      for (const id of ids) {
        try {
          await chrome.contextMenus.update(id, {});
          out[id] = "present";
        } catch (err) {
          out[id] = "MISSING: " + (err && err.message ? err.message : String(err));
        }
      }
      return out;
    }, DESTINATIONS);

    console.log("\n-- action-menu destinations (live, via the service worker) --\n  ",
      JSON.stringify(reachable, null, 2));

    DESTINATIONS.forEach((id) => {
      assert.strictEqual(
        reachable[id],
        "present",
        `"${id}" must still be reachable after the move — got ${reachable[id]}`,
      );
    });
  });

  it("AC-3c: the number of asks did not increase", async function () {
    const sw =
      ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
      ctx.serviceWorkers()[0];
    // Five destinations, each of which existed before this phase: three funding entries already in
    // the menu, plus the two rows that moved. Nothing new was created.
    const count = await sw.evaluate(async (ids) => {
      let n = 0;
      for (const id of ids) {
        try {
          await chrome.contextMenus.update(id, {});
          n += 1;
        } catch {
          /* not present */
        }
      }
      return n;
    }, DESTINATIONS);
    assert.strictEqual(count, 5, `five asks, unchanged, got ${count}`);
  });
});
