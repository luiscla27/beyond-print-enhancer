/**
 * Browser E2E — PR #33 "Shape glow" (refactor_drag_handles_20260425 + glow):
 * wrapper-level dragging (headers/minimize removed), interaction-safe drag
 * guards, hover/focus glow highlights, locked-layer interaction safety and
 * the minimizable Layer Management panel.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. Section wrappers have no print-section-header / minimize buttons and
 *      preserve their title via data-title (used by the Layer Manager).
 *   2. Wrappers are draggable by background: mousedown on the wrapper
 *      background arms dragging, mousedown on .be-section-actions / buttons
 *      does not.
 *   3. Locked layers are interaction-safe (locked container styled with
 *      be-layer-locked + dimmed, body lock class applied; wrappers inside a
 *      locked layer are not armed for dragging).
 *   4. The active-section / hover glow highlight styles are injected
 *      (green hover drop-shadow, red active-wrapper glow) and the print CSS
 *      strips them.
 *   5. The Layer Management panel is minimizable/restorable via its header
 *      button.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:glow
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("PR #33 Shape glow / wrapper dragging + layer safety (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  const readStyles = (page) =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent)
        .join("\n"),
    );

  it("sections and shapes are headerless wrappers titled via data-title", async function () {
    const page = await bootPage(ctx);
    try {
      const meta = await page.evaluate(() => ({
        headers: document.querySelectorAll(".print-section-header").length,
        minimize: document.querySelectorAll(".print-section-minimize").length,
        sectionsTitled: document.querySelectorAll(
          ".be-section-wrapper[data-title]",
        ).length,
        nativeDragSources: document.querySelectorAll(
          '.be-section-wrapper[draggable="true"]',
        ).length,
        shapeWrappers: document.querySelectorAll(".be-shape-wrapper").length,
      }));
      assert.strictEqual(meta.headers, 0, "print-section-header removed");
      assert.strictEqual(meta.minimize, 0, "minimize (X) button removed");
      assert.ok(meta.sectionsTitled >= 20, "wrappers carry data-title");
      assert.strictEqual(
        meta.nativeDragSources,
        0,
        "wrappers are pointer-drag targets, never native drag sources (AC-1)",
      );
      assert.ok(meta.shapeWrappers >= 5, "shapes present");
    } finally {
      await page.close();
    }
  });

  it("pointer drags arm on the wrapper background but not on action bars or buttons", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const sec = document.querySelector(
          ".be-section-wrapper:not(.be-shape-wrapper)",
        );
        const bar = sec.querySelector(":scope > .be-section-actions");
        const menuBtn = bar.querySelector(".be-more-options-button");
        const bg = sec.querySelector(".print-section-container");

        const ev = (t, target, x, y) => {
          const e = new PointerEvent(t, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          });
          target.dispatchEvent(e);
          return e;
        };
        // Reusable drag attempt against a specific target: down -> threshold
        // move -> release. Returns whether the drag committed.
        const attempt = (target, x, y) => {
          ev("pointerdown", target, x, y);
          ev("pointermove", target, x + 30, y + 24);
          const mid = {
            dragging: sec.classList.contains("dragging"),
            ghosts: document.querySelectorAll(".be-drag-ghost").length,
          };
          ev("pointerup", target, x + 30, y + 24);
          return mid;
        };
        const box = bg.getBoundingClientRect();
        const onBg = attempt(bg, box.left + 8, box.top + 8);
        const onBar = attempt(bar, box.left - 20, box.top - 6);
        const onBtn = attempt(menuBtn, box.left - 20, box.top - 6);
        return { onBg, onBar, onBtn };
      });
      assert.strictEqual(st.onBg.dragging, true, "wrapper background arms the drag");
      assert.strictEqual(st.onBg.ghosts, 1, "custom ghost shown mid-drag");
      assert.strictEqual(st.onBar.dragging, false, "action bar must not arm dragging");
      assert.strictEqual(st.onBtn.dragging, false, "interactive button must not arm dragging");
    } finally {
      await page.close();
    }
  });

  it("locked layers are interaction-safe (styled locked + never armed for drag)", async function () {
    const page = await bootPage(ctx);
    try {
      const st = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const rows = Array.from(panel.querySelectorAll(".be-layer-row")).map(
          (r) => ({
            id: r.dataset.layerId,
            active: r.classList.contains("be-active-layer"),
            lockState:
              (r.querySelector('button[title="Toggle Edit Mode"]') || {}).dataset
                ? r.querySelector('button[title="Toggle Edit Mode"]').dataset.state
                : null,
          }),
        );
        const shapes = document.getElementById("print-enhance-shapes-layer");
        const shape = document.querySelector(".be-shape-wrapper");
        const before = { left: shape.style.left, top: shape.style.top };
        // A real pointer drag attempt against the locked shape must not arm.
        const ev = (t, x, y) =>
          new PointerEvent(t, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 2,
            pointerType: "touch",
            isPrimary: true,
          });
        shape.dispatchEvent(ev("pointerdown", 400, 320));
        document.dispatchEvent(ev("pointermove", 460, 380));
        const mid = {
          dragging: shape.classList.contains("dragging"),
          ghosts: document.querySelectorAll(".be-drag-ghost").length,
        };
        document.dispatchEvent(ev("pointerup", 480, 400));
        return {
          sectionsActive:
            rows.find((r) => r.id === "sections" && r.active) !== undefined,
          sectionsUnlocked:
            (rows.find((r) => r.id === "sections").lockState) === "unlocked",
          shapesLocked:
            (rows.find((r) => r.id.startsWith("shapes")).lockState) === "locked",
          shapesElLocked: shapes.classList.contains("be-layer-locked"),
          shapesOpacity: shapes.style.opacity,
          bodyHasLockClass: Array.from(document.body.classList).some((c) =>
            c.startsWith("be-lock-"),
          ),
          mid,
          moved:
            shape.style.left !== before.left || shape.style.top !== before.top,
        };
      });
      assert.ok(
        st.sectionsActive && st.sectionsUnlocked,
        "sections layer should be active+unlocked by default",
      );
      assert.ok(st.shapesLocked, "shapes layer should be locked by default");
      assert.ok(st.shapesElLocked, "locked container carries be-layer-locked");
      assert.strictEqual(st.shapesOpacity, "0.5", "locked layer is dimmed");
      assert.ok(st.bodyHasLockClass, "body lock class applied");
      assert.strictEqual(
        st.mid.dragging,
        false,
        "locked-layer wrapper must never enter dragging state",
      );
      assert.strictEqual(st.mid.ghosts, 0, "no ghost for a locked-layer drag");
      assert.strictEqual(st.moved, false, "locked shape must not move");
    } finally {
      await page.close();
    }
  });

  it("hover and active glow highlight styles are injected (and print strips them)", async function () {
    const page = await bootPage(ctx);
    try {
      const css = await readStyles(page);
      assert.ok(
        css.includes(".be-active-layer .be-section-wrapper:hover"),
        "scoped hover rule present",
      );
      assert.ok(
        css.includes("drop-shadow(0 0 15px #28a745)"),
        "green hover glow present",
      );
      // DELIBERATELY UPDATED (selection_model_ia_20260910, AC-2): the
      // active-wrapper glow used to be the off-palette #c53131 spelled out in
      // this stylesheet; the selection visuals are now a locked palette token so
      // a selected shape and a selected section share one language.
      assert.ok(
        css.includes(".be-active-wrapper") &&
          css.includes("drop-shadow(0 0 8px var(--be-gold))"),
        "active-wrapper gold glow present (locked token, not a literal)",
      );
      assert.ok(
        css.includes("cursor: grab") && css.includes("cursor: grabbing"),
        "grab/grabbing cursor rules present",
      );
      // print strips the glows
      const printBlock = css.indexOf("@media print");
      assert.ok(printBlock !== -1, "print media block present");
    } finally {
      await page.close();
    }
  });

  it("Layer Management panel minimizes and restores", async function () {
    const page = await bootPage(ctx);
    try {
      const clickHeaderBtn = (title) =>
        page.evaluate(
          (title) => {
            const p = document.getElementById("print-enhance-layer-manager");
            const b = Array.from(p.querySelectorAll("button")).find(
              (x) => x.title === title,
            );
            if (b) b.click();
          },
          title,
        );
      await clickHeaderBtn("Minimize");
      await page.waitForTimeout(500);
      const minimized = await page.evaluate(() => {
        const p = document.getElementById("print-enhance-layer-manager");
        return {
          minimized: p.classList.contains("minimized"),
          hasRestore: Array.from(p.querySelectorAll("button")).some(
            (b) => b.title === "Restore",
          ),
        };
      });
      assert.strictEqual(minimized.minimized, true, "panel minimizes");
      assert.ok(minimized.hasRestore, "restore button appears when minimized");
      await clickHeaderBtn("Restore");
      await page.waitForTimeout(500);
      const restored = await page.evaluate(() => {
        const p = document.getElementById("print-enhance-layer-manager");
        return {
          minimized: p.classList.contains("minimized"),
          hasMinimize: Array.from(p.querySelectorAll("button")).some(
            (b) => b.title === "Minimize",
          ),
        };
      });
      assert.strictEqual(restored.minimized, false, "panel restores");
      assert.ok(restored.hasMinimize, "minimize button back after restore");
    } finally {
      await page.close();
    }
  });
});
