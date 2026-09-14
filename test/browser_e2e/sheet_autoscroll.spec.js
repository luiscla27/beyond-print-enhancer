/**
 * Browser E2E — Sheet auto-scroll (sheet_autoscroll_20260909, AC-S1/S3/S4).
 *
 * Functional gate on the real demo sheet + unpacked extension in Chromium:
 *   1. The sections layer is an internal vertical scrollport in the real CSS
 *      engine (computed overflow-y: auto wins over the .pe-layer base rule)
 *      and its content is natively scrollable (scrollTop can be set).
 *   2. Dragging a section toward the viewport bottom edge and holding
 *      auto-scrolls the layer's scrollTop while the pointer is down.
 *   3. Releasing there persists a CONTENT-space drop: the wrapper's stored
 *      top is below the original 100vh fold (reachable only after scroll),
 *      so the section is no longer stuck off-screen.
 *
 * Run via: npm run test:e2e:autoscroll
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

describe("Sheet auto-scroll (sheet_autoscroll_20260909)", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the sections layer is a natively scrollable screen scrollport", async function () {
    const page = await bootPage(ctx);
    const info = await page.evaluate(() => {
      const layer = document.getElementById("print-enhance-sections-layer");
      const cs = getComputedStyle(layer);
      const before = layer.scrollTop;
      const max = layer.scrollHeight - layer.clientHeight;
      layer.scrollTop = max;
      const after = layer.scrollTop;
      layer.scrollTop = before;
      return {
        overflowY: cs.overflowY,
        scrollHeight: layer.scrollHeight,
        clientHeight: layer.clientHeight,
        maxScroll: max,
        nativeScrollApplied: after === max,
      };
    });
    assert.strictEqual(
      info.overflowY,
      "auto",
      "sections layer must compute overflow-y: auto (screen scrollport)",
    );
    assert.ok(
      info.scrollHeight > info.clientHeight,
      `expected below-fold content (scrollHeight ${info.scrollHeight} > clientHeight ${info.clientHeight})`,
    );
    assert.ok(
      info.nativeScrollApplied,
      "native scrollTop assignment must be honored (content natively reachable)",
    );
  });

  it("dragging toward the viewport bottom edge auto-scrolls the sheet while held", async function () {
    const page = await bootPage(ctx);

    /**
     * STEP 0 — GET THE DECORATIONS OUT OF THE WAY (ISSUE_browser_e2e_gate_drift_20260912,
     * F1-adjacent). This case used to grab a section wrapper by its GEOMETRIC CENTRE and
     * measured `committed === false` in every run. The issue filed that as an unproven
     * hypothesis ("it can land the press on content inside the section, which the arming rule
     * now treats as a click"). MEASURED, that is NOT what happens: on this sheet the default
     * layout lays 13 decorative `.be-shape-wrapper`s over the sections, and their layer's
     * z-index is above them — so for every one of the 22 section wrappers, EVERY in-view point
     * of their own rect resolves to a different wrapper (tallied: 437–1558 covered points per
     * wrapper, 0 that belong to the wrapper itself, 0 interactive hits). The press therefore
     * lands on a SHAPE, and the shapes layer is LOCKED by default, so `isElementLocked` refuses
     * to arm — deterministically. (A shape drag would not do either: `scrollHostFor` is the
     * wrapper's own `.pe-layer`, i.e. the SHAPES layer, while the assertions below are about the
     * SECTIONS layer's scrollport.)
     *
     * So the first thing this case does is what a user does when the decorations are in the way:
     * hide the shapes layer from the layer panel. That is a product control, not DOM surgery,
     * and it changes no assertion — it makes the scenario this case names (grab a SECTION and
     * drag it to the edge) reachable at all.
     */
    const shapes = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"),
      ).filter((r) => (r.dataset.layerId || "").startsWith("shapes"));
      const clicked = [];
      rows.forEach((row) => {
        const hide = row.querySelector('button[title="Hide on sheet"]');
        if (hide && hide.dataset.state === "visible") {
          hide.click();
          clicked.push(row.dataset.layerId);
        }
      });
      return { rows: rows.length, clicked };
    });
    await page.waitForTimeout(600);
    const shapesHidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".be-shape-layer-container")).map(
        (l) => getComputedStyle(l).display,
      ),
    );
    assert.ok(
      shapesHidden.length > 0 && shapesHidden.every((d) => d === "none"),
      "the shape layers must be hidden on the sheet, else the sections underneath are not " +
        `pressable at all (rows ${shapes.rows}, clicked ${JSON.stringify(shapes.clicked)}, ` +
        `displays ${JSON.stringify(shapesHidden)})`,
    );

    // Pick a point on a section wrapper's OWN background, using the LIVE arming rule
    // (`js/dnd.js`: the pressed element's `.be-section-wrapper` ancestor must be the wrapper
    // being dragged, its layer must be unlocked, and the pressed element must not be
    // interactive). Scanning beats guessing a corner: the sheet's content is dense, and a
    // geometry-only pick is exactly what made this case deterministic-red.
    const target = await page.evaluate(
      (INTERACTIVE) => {
        const panels = [
          "#print-enhance-controls",
          "#print-enhance-layer-manager",
        ]
          .map((s) => document.querySelector(s))
          .filter(Boolean)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          });
        const inside = (x, y) =>
          panels.some(
            (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
          );
        const ws = Array.from(
          document.querySelectorAll(
            "#print-enhance-sections-layer .be-section-wrapper:not(.be-shape-wrapper)",
          ),
        );
        for (const w of ws) {
          const r = w.getBoundingClientRect();
          if (r.width <= 40 || r.height <= 40) continue;
          if (r.bottom < 0 || r.top > window.innerHeight) continue;
          for (let dy = 4; dy < r.height - 4; dy += 6) {
            for (let dx = 4; dx < r.width - 4; dx += 6) {
              const x = r.left + dx;
              const y = r.top + dy;
              if (y < 0 || y > window.innerHeight - 1 || x < 0) continue;
              if (inside(x, y)) continue;
              const el = document.elementFromPoint(x, y);
              if (!el || el.ownerDocument !== document) continue;
              if (el.tagName === "IFRAME") continue;
              if (el.closest(".be-section-wrapper") !== w) continue;
              if (el.closest(INTERACTIVE)) continue;
              return {
                id: w.id,
                x,
                y,
                vh: window.innerHeight,
                hit: el.tagName,
              };
            }
          }
        }
        return null;
      },
      ".be-section-actions, .be-rotation-handle, .print-section-resize-handle, " +
        "button, input, select, textarea, a",
    );
    const sections = await page.evaluate(
      () =>
        document.querySelectorAll("#print-enhance-sections-layer .be-section-wrapper")
          .length,
    );
    assert.ok(
      target,
      "a draggable, non-covered section background point must exist " +
        `(sections: ${sections}, hidden shape displays: ${JSON.stringify(shapesHidden)})`,
    );

    const layer = await page.evaluate(() => {
      const el = document.getElementById("print-enhance-sections-layer");
      return {
        scrollTop: el.scrollTop,
        maxScroll: el.scrollHeight - el.clientHeight,
      };
    });
    assert.ok(
      layer.maxScroll > layer.scrollTop,
      "sheet must have scrollable content remaining below",
    );

    // Grab the wrapper and commit the drag (proven recipe: small move first).
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 12, target.y + 8, { steps: 3 });
    const committed = await page.evaluate(
      () => !!document.querySelector(".be-section-wrapper.dragging"),
    );
    assert.strictEqual(committed, true, "drag must commit before the edge hold");

    // Push the pointer into the bottom edge band with ONE jump, landing on a
    // point that still belongs to our document (never an iframe — a move
    // over an iframe would stop reaching the engine's document listeners).
    const layerRect = await page.evaluate(() => {
      const r = document
        .getElementById("print-enhance-sections-layer")
        .getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    let endpoint = null;
    for (let inset = 12; inset <= 44; inset += 8) {
      const ey = layerRect.bottom - inset;
      const ok = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return false;
          if (el.tagName === "IFRAME") return false;
          const inOurDoc = el.ownerDocument === document;
          return inOurDoc;
        },
        { x: target.x, y: ey },
      );
      if (ok) {
        endpoint = { x: target.x, y: ey };
        break;
      }
    }
    assert.ok(
      endpoint,
      `no non-iframe point found in the bottom edge band (layer bottom ${layerRect.bottom}, vh ${layerRect.vh})`,
    );
    await page.mouse.move(endpoint.x, endpoint.y, { steps: 1 });
    await page.waitForTimeout(800); // hold in the edge band (~50 ticks)

    const held = await page.evaluate(() => {
      const el = document.getElementById("print-enhance-sections-layer");
      return {
        scrollTop: el.scrollTop,
        stillDragging: !!document.querySelector(".be-drag-ghost"),
      };
    });
    assert.ok(
      held.scrollTop > layer.scrollTop,
      `auto-scroll must grow scrollTop while held near the bottom edge (before ${layer.scrollTop}, held ${held.scrollTop}, stillDragging ${held.stillDragging}, endpoint ${JSON.stringify(endpoint)})`,
    );

    await page.mouse.up();
    const dropped = await page.evaluate(
      (id) => {
        const el = document.getElementById("print-enhance-sections-layer");
        const w = document.getElementById(id);
        return {
          scrollTopAfterRelease: el.scrollTop,
          storedTop: parseInt(w.style.top, 10) || 0,
        };
      },
      target.id,
    );

    assert.ok(
      dropped.storedTop > target.vh,
      `drop must persist a CONTENT-space top below the original fold (stored ${dropped.storedTop} > viewport ${target.vh}) — reachable only via the new scrollport`,
    );
    await page.close().catch(() => {});
  });
});
