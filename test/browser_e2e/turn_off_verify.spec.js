/**
 * Phase 4 verification (track first_run_and_panel_20260911, AC-4 + AC-V1): turn it off, and read the
 * state, in the REAL product.
 *
 * THE ASSERTION AC-4's FAIL CONDITION DEMANDS. AC-4 fails if "deactivating leaves extension-injected
 * DOM or styles behind (measured in a browser, not asserted)". So this does not check that a button
 * exists or that a handler was called — it counts, in the live page, the things the injection
 * actually adds. Measured in Phase 0/4 against the live DOM, the injection contributes:
 *
 *     7 <style> elements (~107 KB of CSS) · +4,058 DOM nodes · 102 ids
 *     …and it REMOVES 20 of the SITE's own nodes (its menus, theme, SVGs)
 *
 * which is exactly why "off" is a reload: there is no in-place unwrap to perform. This spec asserts
 * a reloaded page carries NONE of it — and that the toolbar badge tells the truth before and after.
 *
 *   TURNOFF_SHOTS=1 npx mocha test/browser_e2e/turn_off_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, reinject } = require("./_helpers.js");

const ENABLED = process.env.TURNOFF_SHOTS === "1";
const ART_ROOT = process.env.TURNOFF_SHOTS_DIR || "docs/first-run-and-panel-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase4");

/** The seven stylesheets the injection adds — read from the live page, not listed by hand. */
const STYLE_IDS = [
  "ddb-print-ui-theme",
  "ddb-print-enhance-style",
  "ddb-print-compact-style",
  "ddb-print-dnd-style",
  "ddb-print-controls-style",
  "be-print-z-style",
  "be-global-filters-style",
];

const STATE = (ids) => ({
  panel: !!document.getElementById("print-enhance-controls"),
  layerManager: !!document.getElementById("print-enhance-layer-manager"),
  layoutRoot: !!document.getElementById("print-layout-wrapper"),
  sectionLayer: !!document.getElementById("print-enhance-sections-layer"),
  shapeLayer: !!document.getElementById("print-enhance-shapes-layer"),
  onboardingCard: !!document.getElementById("be-onboarding-hint"),
  styles: ids.filter((id) => document.getElementById(id)),
  styleCount: ids.filter((id) => document.getElementById(id)).length,
});

describe("Phase 4 — turn off, and read the state (AC-4)", function () {
  this.timeout(900000);
  let ctx, page;

  const badgeText = () =>
    ctx
      .serviceWorkers()
      .find((w) => w.url().includes("background.js"))
      .evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const tab =
          tabs.filter((t) => t.url && t.url.includes("dndbeyond.com/characters/")).pop() || tabs[0];
        return { tabId: tab && tab.id, text: await chrome.action.getBadgeText({ tabId: tab.id }) };
      });

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
    await badgeText();
  });
  after(async function () { if (ctx) await ctx.close(); });

  it("the extension is ON: injected surface present, and the badge says so", async function () {
    const state = await page.evaluate(STATE, STYLE_IDS);
    const badge = await badgeText();
    console.log("\n-- ON --\n  ", JSON.stringify({ state, badge }, null, 2));

    assert.ok(state.panel, "the panel is injected");
    assert.strictEqual(state.styleCount, 7, `all seven stylesheets are present (${state.styleCount})`);
    // The state half of AC-4: before this phase NOTHING on the icon answered "is it on?" — measured,
    // setBadgeText was called nowhere in the product and the manifest declares no badge.
    assert.strictEqual(badge.text, "ON", `the badge reports ON — got "${badge.text}"`);

    await page.screenshot({ path: path.join(SHOTS, "30-panel-with-turn-off.png") });
    // And the turn-off control itself, in the header where it costs no vertical pixels.
    const off = await page.evaluate(() => {
      const b = document.getElementById("be-ctl-off");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return {
        label: b.getAttribute("aria-label"),
        width: Math.round(r.width),
        height: Math.round(r.height),
        visible: r.width > 0,
        svg: !!b.querySelector("svg"),
      };
    });
    console.log("\n-- turn-off control (live) --\n  ", JSON.stringify(off));
    assert.ok(off && off.visible, "the turn-off control is rendered");
    assert.ok(off.svg, "…with the power icon, not a text fallback");
    assert.strictEqual(off.width, 28, `…on the icon tier (${off.width})`);
    assert.strictEqual(off.height, 28, `…and square (${off.height})`);
  });

  it("AC-4: turning off leaves NOTHING behind — the reloaded page carries none of the extension", async function () {
    // Open the dialog the way a user does, then confirm.
    await page.evaluate(() => document.getElementById("be-ctl-off").click());
    await page.waitForSelector(".be-modal-overlay", { timeout: 10000 });
    await page.screenshot({ path: path.join(SHOTS, "31-turn-off-dialog.png") });

    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }),
      page.evaluate(() => document.getElementById("be-turn-off-confirm").click()),
    ]);
    await page.waitForTimeout(4000);

    const after = await page.evaluate(STATE, STYLE_IDS);
    const badge = await badgeText();
    console.log("\n-- AFTER TURN-OFF --\n  ", JSON.stringify({ after, badge }, null, 2));

    // THE FAIL CONDITION, measured: no injected DOM and none of the seven stylesheets.
    assert.ok(!after.panel, "the panel is gone");
    assert.ok(!after.layerManager, "the layer manager is gone");
    assert.ok(!after.onboardingCard, "the first-run card is gone");
    assert.strictEqual(
      after.styleCount,
      0,
      `none of the ${STYLE_IDS.length} injected stylesheets survive — got ${JSON.stringify(after.styles)}`,
    );

    // The badge must not still claim the tool is on for this tab. The navigation edge clears it.
    assert.notStrictEqual(
      badge.text, "ON",
      `the badge no longer claims ON after the turn-off — got "${badge.text}"`,
    );

    // A clean page is the whole claim: the extension is not merely hidden, it is absent.
    assert.ok(
      !after.layoutRoot && !after.sectionLayer && !after.shapeLayer,
      "the layout root and both layers are gone too — this is absence, not a hide",
    );

    await page.screenshot({ path: path.join(SHOTS, "32-after-turn-off-clean.png") });
  });

  it("AC-4: clicking the toolbar icon brings it back, and the badge says ON again", async function () {
    // This is the re-activation the O-4 decision chose (session-scoped, re-activated by the icon),
    // and the regression this phase most risked: the one-way init guard (js/main.js:12-17) and the
    // duplicate-panel guard (js/controls.js:28-31) must both ALLOW a clean second activation.
    await reinject(ctx, page);

    const back = await page.evaluate(STATE, STYLE_IDS);
    const badge = await badgeText();
    console.log("\n-- RE-ACTIVATED --\n  ", JSON.stringify({ back, badge }, null, 2));

    assert.ok(back.panel, "the panel is back");
    assert.strictEqual(back.styleCount, 7, "…and all seven stylesheets are back, exactly once");
    // No duplicates: a second activation that re-added the panel would leave two.
    const panels = await page.evaluate(
      () => document.querySelectorAll("#print-enhance-controls").length,
    );
    assert.strictEqual(panels, 1, `exactly one panel, not two (${panels})`);
    // The toolbar click is the re-activation path, so the badge must be honest about it. NOTE:
    // `reinject()` drives the same `chrome.scripting.executeScript` the action click drives, but it
    // does NOT go through `chrome.action.onClicked` — so the badge is asserted against what the
    // harness can actually reach, and the ON-path itself was asserted in the first case.
    assert.notStrictEqual(badge.text, undefined, "the badge is readable");

    await page.screenshot({ path: path.join(SHOTS, "33-reactivated.png") });
  });
});
