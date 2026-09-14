/**
 * Verification for the lock-rule fix (issue
 * ISSUE_lock_rule_hides_all_resize_rotate_handles_20260911).
 *
 * Both directions, in a real browser, because the defect was invisible to the unit suite
 * (those tests dispatch mousedown straight onto the handle, which bypasses hit-testing and
 * CSS visibility entirely):
 *
 *   - a wrapper on the ACTIVE (unlocked) layer: its handles must be VISIBLE and hit-testable;
 *   - a wrapper on a LOCKED layer: its handles must STAY HIDDEN (the behaviour the rule
 *     was written for).
 *
 * Self-skipping on no network, like the other browser suites.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage} = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

// Pixel artifact for the fix, per the house visual-gate convention. Gated so a normal e2e
// run never writes anything: LOCK_SHOTS=1 npx mocha test/browser_e2e/lock_handle_visibility.spec.js
//
// AC-6 (track refactor_surface_20260911): the enable flag, the artifact root and the skip
// come from the ONE capture harness; this file declared its own copy until Phase 6.
const cap = captureHarness({
  flag: "LOCK_SHOTS",
  dirVar: "LOCK_SHOTS_DIR",
  defaultDir: "docs/undo-stack-20260911",
  subdir: "shots",
});
const CAPTURING = cap.enabled;
const SHOTS = cap.shots;

describe("lock rule — handles are reachable on the unlocked layer, hidden on locked", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  after(async function () {
    if (page) await page.close().catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
  });

  it("reports the handle state per layer, and the fixes hold both ways", async function () {
    // REAL pointer movement, not a dispatched event: the handle's visibility rides CSS
    // `:hover`, which only a real pointer position satisfies (a synthetic mouseover left
    // opacity at 0 in the first draft).
    async function probe(selector) {
      const box = await page.evaluate((sel) => {
        const w = document.querySelector(sel);
        if (!w) return null;
        w.scrollIntoView({ block: "center" });
        const r = w.getBoundingClientRect();
        // A point that is ACTUALLY over the wrapper. The centre is regularly under the fixed
        // control panel, and a pointer there produces no `:hover` on the wrapper at all
        // (measured: opacity stayed 0), so candidate points are scanned for one whose
        // topmost element is inside the target.
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
            const x = r.left + r.width * fx;
            const y = r.top + r.height * fy;
            if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
            const t = document.elementFromPoint(x, y);
            if (t && (t === w || w.contains(t))) return { x, y, id: w.id };
          }
        }
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: w.id, covered: true };
      }, selector);
      if (!box) return null;
      await page.mouse.move(box.x, box.y);
      await page.waitForTimeout(400);
      return page.evaluate((id) => {
        const w = document.getElementById(id);
        const layerEl = w.closest(".be-shape-layer-container, #print-enhance-sections-layer");
        const h = w.querySelector(".print-section-resize-handle");
        const cs = h ? getComputedStyle(h) : null;
        const hr = h ? h.getBoundingClientRect() : null;
        return {
          id,
          layerId: layerEl ? layerEl.id : null,
          layerLocked: !!(layerEl && layerEl.classList.contains("be-layer-locked")),
          wrapperLocked: !!w.closest(".be-layer-locked"),
          bodyLocked: document.body.className.match(/be-lock-[\w-]+/g) || [],
          hoverPointCovered: w.matches(":hover") ? false : "pointer not over the wrapper",
          handle: h
            ? { display: cs.display, opacity: cs.opacity, w: Math.round(hr.width), h: Math.round(hr.height) }
            : null,
        };
      }, box.id);
    }

    // (a) A wrapper on the layer that is ACTIVE (unlocked) — the case the defect broke.
    const unlockedSel = await page.evaluate(() => {
      const w = Array.from(document.querySelectorAll(".be-section-wrapper")).find((x) => {
        const layerEl = x.closest(".be-shape-layer-container, #print-enhance-sections-layer");
        return layerEl && !layerEl.classList.contains("be-layer-locked");
      });
      return w ? "#" + w.id : null;
    });
    assert.ok(unlockedSel, "a wrapper on an unlocked layer exists");
    const unlocked = await probe(unlockedSel);
    console.log("UNLOCKED:", JSON.stringify(unlocked, null, 2));

    assert.strictEqual(
      unlocked.handle.display,
      "block",
      "an UNLOCKED layer's wrapper must SHOW its resize handle — this is the assertion the " +
        "original defect failed: " + JSON.stringify(unlocked),
    );
    assert.ok(
      unlocked.handle.w > 0 && unlocked.handle.h > 0,
      "…with a real box, not a zero-size one: " + JSON.stringify(unlocked.handle),
    );
    assert.strictEqual(
      unlocked.handle.opacity,
      "1",
      "…and visible on hover (the handle is a hover-only affordance): " + JSON.stringify(unlocked.handle),
    );

    // (b) A wrapper on a LOCKED layer — the original intent must survive. The shapes layer
    // starts locked, so this is the untouched default state.
    const lockedSel = await page.evaluate(() => {
      const w = Array.from(
        document.querySelectorAll(".be-section-wrapper, .be-shape-wrapper"),
      ).find((x) => !!x.closest(".be-layer-locked"));
      return w ? "#" + w.id : null;
    });
    assert.ok(lockedSel, "a wrapper on a LOCKED layer exists (the shapes layer starts locked)");
    const locked = await probe(lockedSel);
    console.log("LOCKED:", JSON.stringify(locked, null, 2));
    assert.strictEqual(
      locked.handle.display,
      "none",
      "a LOCKED layer's wrapper must STILL hide its resize handle — the behaviour the rule " +
        "was written for: " + JSON.stringify(locked),
    );

    // (c) THE CHECK THE UNIT SUITE CANNOT MAKE: real pointer input must reach the handle, so
    // it has to be the topmost element at its own corner. Dispatching mousedown straight on
    // the element (what the unit tests do) bypasses hit-testing and CSS entirely, which is
    // why this defect survived a green suite.
    //
    // Every unlocked wrapper is tried, because the demo sheet overlaps its own elements: a
    // shape's action bar can legitimately sit on another section's resize corner (measured —
    // the first candidate's corner was covered by a `be-shape-rotate` BUTTON). That is
    // z-order between unrelated elements, not the lock bug, so the assertion is made on a
    // wrapper whose corner is genuinely clear rather than on one that happens to be occluded.
    const reachable = await page.evaluate(async () => {
      const candidates = Array.from(document.querySelectorAll(".be-section-wrapper")).filter((x) => {
        const layerEl = x.closest(".be-shape-layer-container, #print-enhance-sections-layer");
        return layerEl && !layerEl.classList.contains("be-layer-locked");
      });
      const tried = [];
      for (const w of candidates.slice(0, 12)) {
        const h = w.querySelector(".print-section-resize-handle");
        if (!h) continue;
        w.scrollIntoView({ block: "center" });
        await new Promise((res) => setTimeout(res, 40));
        const hr = h.getBoundingClientRect();
        if (hr.width === 0 || hr.height === 0) continue;
        if (hr.left < 0 || hr.top < 0 || hr.right > innerWidth || hr.bottom > innerHeight) continue;
        const top = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
        const ok = !!(top && (top === h || h.contains(top)));
        tried.push({
          id: w.id,
          handleRect: [Math.round(hr.left), Math.round(hr.top), Math.round(hr.width), Math.round(hr.height)],
          topmost: top ? top.tagName + "." + top.className : null,
          ok,
        });
        if (ok) return { found: tried[tried.length - 1], tried };
      }
      return { found: null, tried };
    });
    console.log("REACHABILITY:", JSON.stringify(reachable, null, 2));

    // A CROPPED frame around the wrapper whose handle is reachable, so a reviewer can see the
    // affordance rather than infer it from numbers (a 16px handle in a full-page shot is not
    // judgeable). Clipped to the wrapper plus margin.
    if (CAPTURING) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const clip = await page.evaluate((sel) => {
        const w = document.querySelector(sel);
        w.scrollIntoView({ block: "center" });
        const r = w.getBoundingClientRect();
        const m = 24;
        return {
          x: Math.max(0, r.left - m),
          y: Math.max(0, r.top - m),
          width: Math.min(innerWidth - Math.max(0, r.left - m), r.width + m * 2),
          height: Math.min(innerHeight - Math.max(0, r.top - m), r.height + m * 2),
        };
      }, "#" + reachable.found.id);
      await page.screenshot({ path: path.join(SHOTS, "34-resize-handle-reachable.png"), clip });
      console.log("frame:", path.join("shots", "34-resize-handle-reachable.png"));
    }
    assert.ok(
      reachable.found,
      "at least one unlocked wrapper's resize handle must be the topmost element at its own " +
        "corner, so real mouse input reaches it. Tried: " + JSON.stringify(reachable.tried),
    );
  });
});
