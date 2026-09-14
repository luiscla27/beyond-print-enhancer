/**
 * Browser E2E — PR #1 "absolute positioning engine and UX enhancements
 * v1.1": coordinate-based absolute layout with 16px grid snapping, section
 * minimization/restoration + click-to-front z-index, masonry auto-arrange,
 * ResizeObserver responsive scaling and resize handles.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Sections are absolutely positioned with 16px-grid coordinates.
 *   2. Sections expose resize handles (responsive scaling hooks).
 *   3. Clicking a section brings it to the front (z-index).
 *   4. The wrapper is draggable (absolute-positioning drag target).
 *
 * (Auto-arrange and minimization buttons were later removed/superseded by
 * the layer system — the still-observable engine surfaces above are what
 * this suite pins.)
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:abspos
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #1 Absolute positioning engine + UX (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("sections are absolutely positioned on a 16px grid", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).filter((w) => w.style.position === "absolute" || parseInt(w.style.left, 10) >= 0);
        const onGrid = ws.filter((w) => {
          const l = parseInt(w.style.left, 10);
          const t = parseInt(w.style.top, 10);
          return (Number.isNaN(l) || l % 16 === 0) && (Number.isNaN(t) || t % 16 === 0);
        });
        return { positioned: ws.length, onGrid: onGrid.length };
      });
      assert.ok(st.positioned >= 15, "sections absolutely positioned: " + st.positioned);
      assert.ok(
        st.onGrid >= st.positioned * 0.9,
        "coordinates fall on the 16px grid: " + st.onGrid + "/" + st.positioned,
      );
    } finally {
      await page.close();
    }
  });

  it("sections expose resize handles", async function () {
    const page = await bootPage(ctx);
    try {
      const count = await page.evaluate(
        () => document.querySelectorAll(".print-section-resize-handle").length,
      );
      assert.ok(count >= 15, "resize handles present: " + count);
    } finally {
      await page.close();
    }
  });

  it("clicking a section brings it to the front (z-index)", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        );
        const a = ws[0];
        const b = ws.find((w) => w !== a) || ws[1];
        const z = (el) => parseInt(getComputedStyle(el).zIndex) || 0;
        const zB0 = z(b);
        a.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        const zA1 = z(a);
        return { zB0, zA1, fronted: zA1 > zB0 };
      });
      assert.ok(st.fronted, "clicked section rose above its sibling (z " + st.zA1 + " > " + st.zB0 + ")");
    } finally {
      await page.close();
    }
  });

  it("sections move through the pointer drag engine (no native drag sources)", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const ws = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        );
        const sec = ws[0];
        const rect = sec.getBoundingClientRect();
        const ev = (t, x, y) =>
          new PointerEvent(t, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 7,
            pointerType: "mouse",
            button: 0,
            isPrimary: true,
          });
        sec.dispatchEvent(ev("pointerdown", rect.left + 20, rect.top + 20));
        document.dispatchEvent(
          ev("pointermove", rect.left + 60, rect.top + 52),
        );
        const mid = {
          dragging: sec.classList.contains("dragging"),
          ghosts: document.querySelectorAll(".be-drag-ghost").length,
        };
        document.dispatchEvent(
          ev("pointerup", rect.left + 60, rect.top + 52),
        );
        return {
          total: ws.length,
          nativeDragSources: ws.filter(
            (w) => w.getAttribute("draggable") === "true",
          ).length,
          mid,
        };
      });
      assert.ok(st.total >= 15);
      assert.strictEqual(
        st.nativeDragSources,
        0,
        "wrappers are pointer-drag targets, not native drag sources (AC-1)",
      );
      assert.strictEqual(st.mid.dragging, true, "drag commits mid-gesture");
      assert.strictEqual(st.mid.ghosts, 1, "custom ghost visible mid-drag");
    } finally {
      await page.close();
    }
  });
});
