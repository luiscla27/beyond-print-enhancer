/**
 * Browser E2E — PR #27 "Section print order on drag" (layer_focus_print_z_
 * 20260420): reordering sections in the Layer Management list drives the
 * print z-order.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The sections layer list mirrors the sheet front-to-back: the
 *      top-of-list card holds the highest data-print-z.
 *   2. Dragging the top card to the bottom of the list reorders the list,
 *      re-assigns data-print-z (the moved card becomes the lowest) and
 *      reorders the DOM container so print order follows the drag.
 *   3. Dragging a card back to the top gives it the highest z again.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:printorder
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #27 Section print order on drag (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const listState = (page) =>
    page.evaluate(() => {
      const panel = document.getElementById("print-enhance-layer-manager");
      const list = panel.querySelector(
        '.be-layer-content-list[data-layer="sections"]',
      );
      const cards = Array.from(list.querySelectorAll(".be-layer-item-card"));
      return cards.map((c) => {
        const el = document.getElementById(c.dataset.targetId);
        return {
          title: c.textContent.slice(0, 20),
          target: c.dataset.targetId,
          z: el ? el.dataset.printZ : null,
        };
      });
    });

  /**
   * Simulate the app's HTML5 drag flow on the sections layer list:
   * dragstart on the source card, dragover on the list at a y offset just
   * past the target card (so getDragAfterElement appends/prepends), dragend.
   */
  /**
   * Move the card at `fromIndex` to the list's top or bottom. Drop coordinates
   * are chosen outside the first/last card edges so getDragAfterElement
   * prepends/appends (mid-card drops insert one slot early).
   */
  async function dragCardToEdge(page, fromIndex, edge) {
    return page.evaluate(
      ({ fromIndex, edge }) => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const list = panel.querySelector(
          '.be-layer-content-list[data-layer="sections"]',
        );
        const cards = Array.from(list.querySelectorAll(".be-layer-item-card"));
        const source = cards[fromIndex];
        if (!source) return false;
        const first = cards[0];
        const last = cards[cards.length - 1];
        const fr = first.getBoundingClientRect();
        const lr = last.getBoundingClientRect();
        const clientX = fr.left + Math.min(12, fr.width);
        const clientY = edge === "top" ? fr.top - 6 : lr.bottom + 6;
        const dt = new DataTransfer();
        source.dispatchEvent(
          new DragEvent("dragstart", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          }),
        );
        list.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
          }),
        );
        source.dispatchEvent(
          new DragEvent("dragend", { bubbles: true, cancelable: true }),
        );
        return true;
      },
      { fromIndex, edge },
    );
  }

  it("top-of-list card carries the highest print z (front-to-back mirror)", async function () {
    const page = await bootPage(ctx);
    try {
      const s = await listState(page);
      assert.ok(s.length >= 3, "need at least 3 sections, got " + s.length);
      const zs = s.map((x) => parseInt(x.z, 10));
      assert.ok(zs.every((z) => !Number.isNaN(z)), "all cards have print z");
      for (let i = 0; i < zs.length - 1; i++) {
        assert.ok(
          zs[i] > zs[i + 1],
          "list order must be descending z: index " + i,
        );
      }
    } finally {
      await page.close();
    }
  });

  it("dragging the top card to the bottom lowers its print z and reorders the DOM", async function () {
    const page = await bootPage(ctx);
    try {
      const before = await listState(page);
      const n = before.length;
      const topTarget = before[0].target;
      await dragCardToEdge(page, 0, "bottom");
      await page.waitForTimeout(900);
      const after = await listState(page);
      assert.strictEqual(
        after[n - 1].target,
        topTarget,
        "dragged card should now be at the bottom of the list",
      );
      const moved = after[n - 1];
      const newTop = after[0];
      assert.ok(
        parseInt(newTop.z, 10) > parseInt(moved.z, 10),
        "the new top card outranks the moved card in print order",
      );
      // DOM container is bottom-to-top: the last child is the visual top
      const domTop = await page.evaluate(() => {
        const c = document.getElementById("print-enhance-sections-layer");
        return c.lastElementChild ? c.lastElementChild.id : null;
      });
      assert.strictEqual(
        domTop,
        newTop.target,
        "DOM last child matches the visual-top card",
      );
    } finally {
      await page.close();
    }
  });

  it("dragging the last card back to the top gives it the highest print z", async function () {
    const page = await bootPage(ctx);
    try {
      // First move the current top to the bottom, then back to the top.
      const before = await listState(page);
      const n = before.length;
      await dragCardToEdge(page, 0, "bottom");
      await page.waitForTimeout(900);
      const mid = await listState(page);
      const bottomTarget = mid[n - 1].target;
      await dragCardToEdge(page, n - 1, "top");
      await page.waitForTimeout(900);
      const after = await listState(page);
      assert.strictEqual(
        after[0].target,
        bottomTarget,
        "moved card should be back at the top",
      );
      const zs = after.map((x) => parseInt(x.z, 10));
      assert.strictEqual(
        zs[0],
        Math.max(...zs),
        "top card holds the maximum print z after drag to top",
      );
    } finally {
      await page.close();
    }
  });
});
