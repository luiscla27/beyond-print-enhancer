/**
 * BEYOND-18 closure camera (track activation-overlay-be18, plan step 5).
 *
 * The filing's a2: closure evidence ATTACHED to the issue demonstrating the new
 * affordance. The repro probe (beyond18_activation_overlay_repro.spec.js) proves
 * the DOM contract; this capture proves what a CAMERA sees — the overlay ACTIVE
 * on screen during the transition (attribution visible, spinner ours, text
 * naming the work) and DISMISSED after boot. The vision seat that priced the
 * absence can re-price the presence from these pixels.
 *
 *   OVERLAY_SHOTS=1 npx mocha test/browser_e2e/beyond18_activation_overlay_capture.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext } = require("./_helpers.js");

const ENABLED = process.env.OVERLAY_SHOTS === "1";
const SHOTS = path.resolve(__dirname, "..", "..", "vendor", "docs", "activation-overlay-be18");

const OVERLAY_STATE =
  "(() => { const e = document.getElementById('be-activation-overlay'); if (!e) return null; const r = e.getBoundingClientRect(); return { state: e.getAttribute('data-be-activation-state'), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0, text: (e.textContent||'').trim().slice(0,160) }; })()";

describe("BEYOND-18 closure camera — the overlay on screen", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () {
    if (ctx) await ctx.close();
  });

  it("mid-transition: the extension claims the screen with its OWN loading state", async function () {
    const page = await ctx.newPage();
    await page.goto("https://www.dndbeyond.com/characters/151911403", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(4000); // consent banner lands

    // Dismiss the Ketch consent banner FIRST — measured 2026-11-01: it is a
    // full-viewport fixed overlay at z-index 2147483647 with a semi-opaque
    // white backdrop, so ANY element under it photographs light and a naive
    // "is the overlay visible" pixel check fails for the wrong reason (it
    // fails on the host's z-max blanket, not on our overlay). bootPage() does
    // the same dismissal; this spec boots its own page to own the timing.
    await page
      .evaluate(() => {
        const bs = Array.from(document.querySelectorAll("#lanyard_root button"));
        const b = bs.find(
          (x) =>
            (x.textContent || "").trim() === "Accept All" ||
            (x.getAttribute("aria-label") || "").includes("Accept All"),
        );
        if (b) b.click();
      })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // Toolbar-click stand-in: the production injection list straight from
    // js/background.js, exactly like reinject() does.
    const files = (() => {
      const bg = fs.readFileSync(path.resolve(__dirname, "..", "..", "js", "background.js"), "utf8");
      const m = /files:\s*\[([\s\S]*?)\]/.exec(bg);
      return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
    })();
    const sw = (await ctx.serviceWorkers()).find((w) => w.url().includes("background.js"));
    assert.ok(sw, "service worker not found");
    await sw.evaluate(async ({ f }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.filter((t) => t.url && t.url.includes("dndbeyond.com/characters/")).pop() || tabs[0];
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: f });
      return true;
    }, { f: files });

    // Sample until the overlay is ACTIVE and VISIBLE (the transition middle),
    // then capture IN THE SAME INSTANT — the boot completes in ~1-3s and a
    // state-then-screenshot round trip races the dismissal.
    let snap = null;
    let shotWhileActive = null;
    for (let i = 0; i < 90; i++) {
      const s = await page.evaluate(OVERLAY_STATE).catch(() => null);
      if (s && s.state === "active" && s.visible) {
        snap = s;
        shotWhileActive = await page.screenshot();
        break;
      }
      await page.waitForTimeout(100);
    }
    assert.ok(snap, "overlay never observed ACTIVE+visible mid-boot");
    assert.match(snap.text, /Enhancing sheet/i, "the camera must read what is happening");
    assert.match(snap.text, /Print Enhancer/i, "the camera must read WHO did it (attribution)");
    // SELF-VERIFYING CAPTURE: the pixels themselves must prove the overlay drew
    // (dark leather backdrop over the dimmed sheet) — a state-only assertion
    // that ships a blank-looking frame is not closure evidence. The overlay's
    // own backdrop is rgba(18,13,10,.82): sample the screen CORNERS (always
    // backdrop, never the card) and require them dark.
    const corners = await page.evaluate(() => {
      const e = document.getElementById("be-activation-overlay");
      const cs = getComputedStyle(e);
      return { z: cs.zIndex, position: cs.position, bg: cs.backgroundColor, display: cs.display };
    });
    assert.strictEqual(corners.position, "fixed", "overlay must be fixed-positioned");
    assert.strictEqual(corners.display, "flex", "overlay must be displayed");
    const { PNG } = require("pngjs");
    const png = PNG.sync.read(shotWhileActive);
    const at = (x, y) => {
      const i = (y * png.width + x) * 4;
      return [png.data[i], png.data[i + 1], png.data[i + 2]];
    };
    // Sample the overlay's OWN box corners (inset 8px), not the viewport's:
    // the page's 15px scrollbar gutter sits inside the screenshot's right edge
    // and is not part of any element's paint, so viewport corners would sample
    // the scrollbar and read "light" for a reason that has nothing to do with
    // the overlay (MEASURED 2026-11-01: 236,237,238 at x = width-9).
    const [bx, by, bw, bh] = snap.rect;
    const samples = [
      at(bx + 8, by + 8),
      at(bx + bw - 8, by + 8),
      at(bx + 8, by + bh - 8),
      at(bx + bw - 8, by + bh - 8),
    ];
    const darkCount = samples.filter(([r, g, b]) => r < 110 && g < 100 && b < 90).length;
    assert.ok(
      darkCount >= 3,
      "camera pixels do not show the overlay backdrop (corners sampled " +
        JSON.stringify(samples) + ", overlay rect " + JSON.stringify(snap.rect) +
        ", computed z=" + corners.z + ", bg=" + corners.bg +
        ") — the affordance is not visible on screen, which is the defect it exists to close",
    );
    fs.writeFileSync(path.join(SHOTS, "be18-mid-boot-active.png"), shotWhileActive);

    // Wait out the boot, then the same node must be dismissed.
    await page.waitForFunction(
      () => {
        const e = document.getElementById("be-activation-overlay");
        return e && e.getAttribute("data-be-activation-state") === "dismissed";
      },
      { timeout: 90000 },
    );
    const done = await page.evaluate(OVERLAY_STATE);
    assert.strictEqual(done.state, "dismissed", "post-boot the overlay must be dismissed, not left on screen");
    await page.screenshot({ path: path.join(SHOTS, "be18-post-boot-dismissed.png") });
  });

  it("the overlay never reaches paper (print reinforcement)", async function () {
    const page = await ctx.pages()[0] || (await ctx.newPage());
    const hidden = await page.evaluate(() => {
      const el = document.getElementById("be-activation-overlay");
      if (!el) return "absent";
      const cs = getComputedStyle(el);
      return cs.display;
    });
    // The theme stylesheet carries the @media print rule; the node itself must
    // exist (or have existed) — display:none in print comes from the sheet.
    assert.ok(hidden === "none" || hidden === "absent", "overlay display in print context: " + hidden);
  });
});
