/**
 * Browser E2E — PR #26 "Fixed shapes mode" (layer management panel +
 * layer content visualization + layer edit mode): the Layer Management
 * panel visualizes every layer's contents and per-layer Edit (lock)
 * toggles fade / restore interactivity.
 *
 * One test per user-facing UI iteration available from the merged PR:
 *   1. The Layer Management panel shows nested content lists: sections as
 *      mini preview cards (titles) and shapes as asset thumbnails.
 *   2. The lists stay in sync with the actual layer DOM containers.
 *   3. Edit-mode toggles exist for BOTH the Sections and Shapes rows
 *      (lock/unlock icons next to the visibility eye).
 *   4. Locking a layer fades its container (opacity 0.5) and suppresses
 *      pointer interaction; unlocking restores full opacity and
 *      interaction.
 *
 * Requires the real demo sheet + the unpacked MV3 extension in Chromium.
 * Run via: npm run test:e2e:shapesmode
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");

describe("PR #26 Layer content visualization + edit mode (Playwright e2e)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the panel shows sections as mini cards and shapes as thumbnails", async function () {
    const page = await bootPage(ctx);
    try {
      const info = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const secList = panel.querySelector(
          '.be-layer-content-list[data-layer="sections"]',
        );
        const shpList = panel.querySelector(
          '.be-layer-content-list[data-layer="shapes-default"]',
        );
        const secCards = Array.from(
          secList.querySelectorAll(".be-layer-item-card"),
        );
        const thumbs = Array.from(
          shpList.querySelectorAll(".be-layer-item-thumb"),
        );
        return {
          secCount: secCards.length,
          secTitles: secCards.slice(0, 3).map((c) => c.textContent),
          thumbCount: thumbs.length,
          thumbHasSrc: thumbs.every(
            (t) => {
              const imgEl = t.querySelector("img") || t;
              return imgEl.src && imgEl.src.length > 0;
            },
          ),
          thumbTracksContainer: thumbs.length ===
            document.getElementById("print-enhance-shapes-layer").children
              .length,
        };
      });
      assert.ok(info.secCount >= 5, "sections list populated: " + info.secCount);
      assert.ok(
        info.secTitles.every((t) => t && t.trim().length > 0),
        "section mini cards carry titles",
      );
      assert.ok(info.thumbCount >= 5, "shapes shown as thumbnails");
      assert.ok(info.thumbHasSrc, "every thumbnail has an image source");
      assert.ok(
        info.thumbTracksContainer,
        "thumbnail list mirrors the shape-layer container",
      );
    } finally {
      await page.close();
    }
  });

  it("edit-mode toggles exist for both Sections and Shapes rows", async function () {
    const page = await bootPage(ctx);
    try {
      const rows = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        return Array.from(panel.querySelectorAll(".be-layer-row")).map((r) => {
          const btns = Array.from(r.querySelectorAll("button")).map(
            (b) => b.title,
          );
          const edit = r.querySelector('button[title="Toggle Edit Mode"]');
          return {
            id: r.dataset.layerId,
            editState: edit ? edit.dataset.state : null,
            hasEdit: btns.includes("Toggle Edit Mode"),
            // O-2 (selection_model_ia_20260910) renamed and split the per-layer
            // controls so each answers ONE question: on-sheet VISIBILITY ("Hide on
            // sheet") and PRINT exclusion ("Skip when printing"). The stale pin here
            // read "Toggle Layer Visibility", a title the product no longer uses —
            // which made this case fail on `hasView` for BOTH rows, not on the
            // Edit toggle it looked like it was testing.
            hasHide: btns.includes("Hide on sheet"),
            hasSkipPrint: btns.includes("Skip when printing"),
          };
        });
      });
      const sections = rows.find((r) => r.id === "sections");
      const shapes = rows.find((r) => r.id.startsWith("shapes"));
      assert.ok(
        sections.hasEdit && shapes.hasEdit,
        "both rows carry the Edit toggle: " + JSON.stringify(rows),
      );
      assert.ok(
        sections.hasHide && sections.hasSkipPrint,
        "Sections row has both per-layer controls (hide + print): " +
          JSON.stringify(sections),
      );
      assert.ok(
        shapes.hasHide && shapes.hasSkipPrint,
        "Shapes row has both per-layer controls (hide + print): " +
          JSON.stringify(shapes),
      );
      assert.ok(
        sections.editState === "unlocked" || sections.editState === "locked",
        "sections edit state present",
      );
    } finally {
      await page.close();
    }
  });

  it("locking the sections layer fades it and refuses the move drag; unlock restores", async function () {
    const page = await bootPage(ctx);
    try {
      const rowSel = '.be-layer-row[data-layer-id="sections"]';
      const editBtn = rowSel + ' button[title="Toggle Edit Mode"]';
      // sections starts unlocked -> lock it
      const startIcon = await page.evaluate(() => {
        const panel = document.getElementById("print-enhance-layer-manager");
        const b = panel.querySelector(
          '.be-layer-row[data-layer-id="sections"] button[title="Toggle Edit Mode"]',
        );
        return b ? b.dataset.state : null;
      });
      if (startIcon === "unlocked") {
        await domClick(page, editBtn);
        await page.waitForTimeout(500);
      }

      /**
       * Attempt a move drag on a section wrapper's own background, with the synthetic
       * PointerEvent recipe the drag captures use. Returns whether the engine committed.
       *
       * This is the half of "suppressed" the product actually implements. Locking used to
       * set `pointer-events: none` on the layer, which killed the hover that reveals the
       * action bar — the layer's own unlock/hide/delete controls became unreachable and the
       * lock was a TRAP. MEASURED in the live product (js/dom/layer_manager.js, AC-5/U-7 of
       * ui_ux_review_20260910): both branches of the lock write `pointerEvents = "auto"`
       * and the suppression is expressed instead as "not draggable / resizable / rotatable"
       * — `isElementLocked` refuses to arm (`js/dnd.js`), and the move affordances are
       * hidden by CSS. So the stale read of the inline `pointerEvents` here was the
       * pre-fix contract, and the honest pin is the engine's refusal.
       */
      const dragState = () =>
        page.evaluate(() => {
          const sec = document.querySelector(
            "#print-enhance-sections-layer .be-section-wrapper:not(.be-shape-wrapper)",
          );
          if (!sec) return { error: "no section wrapper" };
          const bg = sec.querySelector(".print-section-container") || sec;
          const box = bg.getBoundingClientRect();
          const x = box.left + 8;
          const y = box.top + 8;
          const ev = (t, cx, cy) => {
            bg.dispatchEvent(
              new PointerEvent(t, {
                bubbles: true,
                cancelable: true,
                clientX: cx,
                clientY: cy,
                pointerId: 1,
                pointerType: "mouse",
                isPrimary: true,
              }),
            );
          };
          ev("pointerdown", x, y);
          ev("pointermove", x + 30, y + 24); // past DRAG_THRESHOLD (4px)
          const armed = sec.classList.contains("dragging");
          ev("pointerup", x + 30, y + 24);
          sec.classList.remove("dragging");
          return { armed };
        });

      const locked = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        return {
          locked: el.classList.contains("be-layer-locked"),
          opacity: el.style.opacity,
          pointer: el.style.pointerEvents,
        };
      });
      assert.strictEqual(locked.locked, true, "sections layer locked");
      assert.strictEqual(locked.opacity, "0.5", "locked layer dimmed");
      assert.strictEqual(
        locked.pointer,
        "auto",
        "a locked layer stays INTERACTIVE — locking must never make its own controls unreachable",
      );
      const lockedDrag = await dragState();
      assert.strictEqual(
        lockedDrag.armed,
        false,
        "the drag engine refuses to arm on a locked layer: " + JSON.stringify(lockedDrag),
      );

      // unlock -> restore
      await domClick(page, editBtn);
      await page.waitForTimeout(500);
      const unlocked = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-sections-layer");
        return {
          locked: el.classList.contains("be-layer-locked"),
          opacity: el.style.opacity,
          pointer: el.style.pointerEvents,
        };
      });
      assert.strictEqual(unlocked.locked, false, "sections layer unlocked");
      assert.strictEqual(unlocked.opacity, "1", "full opacity restored");
      assert.strictEqual(
        unlocked.pointer,
        "auto",
        "interaction stays available after unlock",
      );
      const unlockedDrag = await dragState();
      assert.strictEqual(
        unlockedDrag.armed,
        true,
        "unlocking restores the move drag: " + JSON.stringify(unlockedDrag),
      );
    } finally {
      await page.close();
    }
  });

  it("locking the shapes layer dims it; unlocking restores (default lock honored)", async function () {
    const page = await bootPage(ctx);
    try {
      const rowSel = '.be-layer-row[data-layer-id="shapes-default"]';
      const editBtn = rowSel + ' button[title="Toggle Edit Mode"]';
      const locked = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-shapes-layer");
        return {
          locked: el.classList.contains("be-layer-locked"),
          opacity: el.style.opacity,
        };
      });
      assert.strictEqual(locked.locked, true, "shapes layer locked by default");
      assert.strictEqual(locked.opacity, "0.5", "locked shapes dimmed");
      await domClick(page, editBtn);
      await page.waitForTimeout(500);
      const unlocked = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-shapes-layer");
        return {
          locked: el.classList.contains("be-layer-locked"),
          opacity: el.style.opacity,
        };
      });
      assert.strictEqual(unlocked.locked, false, "shapes layer unlocked");
      assert.strictEqual(unlocked.opacity, "1", "full opacity restored");
    } finally {
      await page.close();
    }
  });
});
