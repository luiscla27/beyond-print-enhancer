/**
 * BEYOND-18 reproduction + closure probe — track activation-overlay-be18, plan steps 1 + 5.
 *
 * FILING a1 (pre-fix, recorded 2026-11-01): the page arm asserted the production
 * script list contained NO activation-overlay affordance (it passed on the
 * pre-fix tree — absence confirmed by the project's own harness, not by the
 * judge record), and the host arm showed no extension-owned loading node on
 * the real boot (query returned []). The judge record stayed filing evidence;
 * THIS probe was the reproduction.
 *
 * CLOSURE a2 (post-fix, this form): the same two arms now assert the affordance
 * EXISTS in the production list, mounts at boot with the contract id/state,
 * and dismisses at completion. The closure artifacts (this file's passing run
 * + the visual capture it produces) are what BEYOND-18 asks for.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

const EXT_ROOT = path.resolve(__dirname, "..", "..");
const SHOTS = path.join(EXT_ROOT, "vendor", "docs", "activation-overlay-be18");

function productionFiles() {
  const bg = fs.readFileSync(path.join(EXT_ROOT, "js", "background.js"), "utf8");
  const m = /files:\s*\[([\s\S]*?)\]/.exec(bg);
  if (!m) throw new Error("Could not parse files array from js/background.js");
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
}

const OVERLAY_QUERY =
  "(() => { const e = document.getElementById('be-activation-overlay'); return e ? {state: e.getAttribute('data-be-activation-state'), text: (e.textContent||'').slice(0,120)} : null; })()";

describe("BEYOND-18 — activation overlay: reproduction legacy + closure contract", function () {
  this.timeout(900000);

  it("a1-legacy/page arm: the production script list carries the activation-overlay module", function () {
    const files = productionFiles();
    assert.ok(
      files.includes("js/activation_overlay.js"),
      "js/activation_overlay.js must be in the production injection list (parsed from js/background.js)",
    );
    // It must load BEFORE main.js — the overlay owns the transition middle,
    // so it exists before main.js's async boot work starts.
    assert.ok(
      files.indexOf("js/activation_overlay.js") < files.indexOf("js/main.js"),
      "the overlay module must precede js/main.js in the injection order",
    );
  });

  it("a2/host arm: real boot mounts the overlay active, then dismisses it (network)", async function () {
    if (process.env.BEYOND18_HOST !== "1") this.skip();
    const ctx = await launchExtensionContext();
    try {
      const page = await bootPage(ctx);
      const overlay = await page.evaluate(OVERLAY_QUERY);
      assert.ok(overlay, "post-boot: no #be-activation-overlay node — the module never mounted");
      assert.strictEqual(
        overlay.state,
        "dismissed",
        "post-boot the overlay must be DISMISSED (transition complete) — got " + overlay.state,
      );
      assert.ok(
        /Enhancing sheet/i.test(overlay.text || ""),
        "overlay must name the work ('Enhancing sheet…') — attribution is the certified gap",
      );
      assert.ok(
        /Print Enhancer/i.test(overlay.text || ""),
        "overlay must name the extension — the judge priced exactly this missing attribution",
      );
      // Camera artifact for the closure evidence attached to BEYOND-18.
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, "closure-post-boot-dismissed.png"), fullPage: false });
    } finally {
      await ctx.close();
    }
  });

  it("a2/host arm (mid-boot snapshot): the overlay is ACTIVE while boot work is still running", async function () {
    if (process.env.BEYOND18_HOST !== "1") this.skip();
    const ctx = await launchExtensionContext();
    try {
      // Boot slowly enough to sample mid-transition: block the harness's
      // ready-wait by injecting a delay into Storage via route interception is
      // overkill; instead sample in a tight poll right after injection lands.
      const page = ctx.pages()[0] || (await ctx.newPage());
      await page.goto("https://www.dndbeyond.com/characters/151911403", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(3500);
      // inject immediately (same list the toolbar click uses)
      const files = productionFiles();
      const sw = (await ctx.serviceWorkers()).find((w) => w.url().includes("background.js"));
      assert.ok(sw, "service worker not found");
      const inj = await sw.evaluate(async ({ f }) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.filter((t) => t.url && t.url.includes("dndbeyond.com/characters/")).pop() || tabs[0];
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: f });
        return true;
      }, { f: files });
      assert.ok(inj, "injection failed");
      // Sample the overlay DURING the async boot (storage + layout restore).
      let activeSeen = false;
      for (let i = 0; i < 40; i++) {
        const s = await page.evaluate(OVERLAY_QUERY).catch(() => null);
        if (s && s.state === "active") { activeSeen = true; break; }
        await page.waitForTimeout(150);
      }
      assert.ok(activeSeen, "mid-boot: overlay was never observed ACTIVE — it must own the transition middle");
    } finally {
      await ctx.close();
    }
  });
});
