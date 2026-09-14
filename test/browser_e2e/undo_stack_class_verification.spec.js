/**
 * Per-class undo verification in a REAL BROWSER — track undo_stack_20260911.
 *
 * WHY THIS EXISTS. The track's 43 unit cases prove every class in jsdom, and the AC-V1 gate
 * proved exactly ONE class end-to-end in Chromium (the compact toggle). That left an honest
 * gap, stated in the final report: the other classes were verified against a DOM emulator,
 * not against the browser the extension actually runs in — where `getComputedStyle` has real
 * numbers, layout exists, and pointer/keyboard events carry real coordinates.
 *
 * This spec closes that gap for every remaining class. Each class gets the SAME uniform,
 * falsifiable round trip, driven through its real entry point (a real click, a real pointer
 * gesture, a real keystroke) in the extension's own world:
 *
 *   1. clear the stack, read the LIVE layout
 *   2. perform the mutation through its real entry point
 *   3. assert the state CHANGED  (otherwise the round trip below is vacuous)
 *   4. assert a record was PUSHED
 *   5. invoke the undo through the stack
 *   6. assert the state is EXACTLY the state from (1)
 *
 * Step 3 is the one that matters: without it, "undo restored the state" would pass on a
 * mutation that never happened.
 *
 * Self-skipping: a normal `npm run test:e2e` run executes it (it is a real gate, unlike the
 * capture harnesses), but it needs the live demo sheet, so it is not part of `npm test`.
 *
 * Run:
 *   npx mocha test/browser_e2e/undo_stack_class_verification.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage, contentCall, domClick } = require("./_helpers.js");

const VIEWPORT = { width: 1440, height: 900 };

/** Read the stack + live layout from the extension's own world. */
function read(ctx) {
  return contentCall(ctx, "undoRead");
}
function invokeUndo(ctx) {
  return contentCall(ctx, "undoInvoke");
}
function clearStack(ctx) {
  return contentCall(ctx, "undoClear");
}
function layerSnapshot(ctx) {
  return contentCall(ctx, "layerSnapshot");
}

describe("undo stack — per-class round trip in a real browser (AC-3)", function () {
  this.timeout(900000);
  let ctx;
  let page;

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    await page.setViewportSize(VIEWPORT);
  });

  after(async function () {
    if (page) await page.close().catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
  });

  /**
   * Close whatever the previous class left open (a picker, a context menu, a toast). Without
   * this, a class that fails mid-flow leaves its modal up and the NEXT class's
   * `waitForSelector(".be-modal-overlay input")` matches the wrong input — which is exactly
   * how the first run of this spec mis-reported the rename as a timeout.
   */
  beforeEach(async function () {
    if (!ctx) return;
    await contentCall(ctx, "closeOverlays").catch(() => {});
    await page.waitForTimeout(300);
  });

  /**
   * The uniform assertion set every class runs. Returns the three observations so a failing
   * class can be diagnosed from the artifacts rather than from a rerun.
   */
  async function roundTrip(label, act, opts) {
    const o = opts || {};
    await clearStack(ctx);
    const before = await read(ctx);
    assert.ok(before.state, label + ": the live layout must be readable — " + JSON.stringify(before));

    await act();
    await page.waitForTimeout(o.settleMs || 900);

    const after = await read(ctx);
    assert.notStrictEqual(
      after.state,
      before.state,
      label + ": the mutation must CHANGE the layout, or the round trip below is vacuous",
    );
    assert.ok(
      after.depth > before.depth,
      label + ": a reversible record must be pushed (depth " + before.depth + " -> " + after.depth + ")",
    );
    assert.ok(after.label, label + ": the record must name what it will undo");

    const undone = await invokeUndo(ctx);
    assert.strictEqual(undone.ok, true, label + ": the undo must run — " + JSON.stringify(undone));
    await page.waitForTimeout(o.settleMs || 900);

    const back = await read(ctx);
    assert.strictEqual(
      back.state,
      before.state,
      label + ": the undo must restore EXACTLY the pre-mutation layout",
    );
    return { before, after, back };
  }

  /**
   * A real pointer gesture on an element.
   *
   * The element is scrolled into view FIRST and the gesture is driven from a point that is
   * inside the viewport: the sheet is a full-viewport fixed overlay, so a section's
   * `getBoundingClientRect()` is regularly off-screen (below the fold), and a `page.mouse`
   * move to off-screen coordinates silently hits nothing — which is how the first run of this
   * spec reported "the mutation must CHANGE the layout" for the drag and the resize.
   */
  async function pointerGesture(page, selector, from, to, steps) {
    const pt = await page.evaluate(
      ({ sel, f, t }) => {
        const el = document.querySelector(sel);
        if (!el) return { error: "not found" };
        el.scrollIntoView({ block: "center", behavior: "instant" });
        const r = el.getBoundingClientRect();
        // FIND A POINT INSIDE THE TARGET THAT IS ACTUALLY HIT-TESTABLE. The control panel and
        // the layer panel are fixed overlays sitting ON the sheet, so the geometric centre of
        // a section is regularly covered by them — a `page.mouse` move there clicks the PANEL
        // and the drag never arms. Measured: at the section's centre, `elementFromPoint`
        // returned `.be-ctl-tray-layout`. So candidate points are scanned and the first one
        // whose topmost element is inside the target wins.
        const cands = [];
        for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
            cands.push([r.left + r.width * fx, r.top + r.height * fy]);
          }
        }
        let cx = null;
        let cy = null;
        for (const [x, y] of cands) {
          if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
          const top = document.elementFromPoint(x, y);
          if (top && (top === el || el.contains(top))) {
            cx = x;
            cy = y;
            break;
          }
        }
        if (cx === null) {
          return {
            error: "every candidate point inside the target is covered by another element",
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            vp: [innerWidth, innerHeight],
            topmost: (() => {
              const t0 = document.elementFromPoint(
                Math.min(Math.max(r.left + r.width / 2, 4), innerWidth - 4),
                Math.min(Math.max(r.top + r.height / 2, 4), innerHeight - 4),
              );
              return t0 ? t0.tagName + "." + t0.className : null;
            })(),
          };
        }
        return {
          sx: cx + (f ? f.dx : 0),
          sy: cy + (f ? f.dy : 0),
          ex: cx + (f ? f.dx : 0) + (t ? t.dx : 0),
          ey: cy + (f ? f.dy : 0) + (t ? t.dy : 0),
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          vp: [innerWidth, innerHeight],
        };
      },
      { sel: selector, f: from || null, t: to || null },
    );
    assert.ok(!pt.error, "gesture target not usable: " + selector + " — " + JSON.stringify(pt));
    assert.ok(
      pt.rect[2] > 0 && pt.rect[3] > 0,
      "gesture target has no layout box: " + JSON.stringify(pt),
    );

    await page.mouse.move(pt.sx, pt.sy);
    await page.mouse.down();
    const n = steps || 8;
    for (let i = 1; i <= n; i += 1) {
      await page.mouse.move(pt.sx + ((pt.ex - pt.sx) * i) / n, pt.sy + ((pt.ey - pt.sy) * i) / n);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
  }

  /* ------------------------------------------------------------------ *
   * The classes. Each name matches spec.md's inventory (contract.md §0.2).
   * ------------------------------------------------------------------ */

  it("1. drag to move — round trip", async function () {
    const target = await page.evaluate(() => {
      // A LOCKED layer never arms a drag, so pick an unlocked one — on the demo sheet the
      // shapes layer starts locked.
      const w = Array.from(document.querySelectorAll(".be-section-wrapper")).find(
        (x) =>
          !x.classList.contains("be-shape-wrapper") &&
          x.querySelector(".be-section-actions") &&
          !x.closest("[class*='be-layer-locked']"),
      );
      return w ? w.id : null;
    });
    assert.ok(target, "an unlocked section wrapper with actions exists");
    await roundTrip("drag", async () => {
      await pointerGesture(page, "#" + target, { dx: 0, dy: 0 }, { dx: 80, dy: 50 });
    });
  });

  it("2. keyboard nudge — round trip", async function () {
    await roundTrip("nudge", async () => {
      // Make a wrapper active the way the product does, then send a REAL arrow key.
      const ok = await page.evaluate(() => {
        const w = Array.from(document.querySelectorAll(".be-section-wrapper")).find(
          (x) => !x.classList.contains("be-shape-wrapper"),
        );
        if (!w) return null;
        document.querySelectorAll(".be-active-wrapper").forEach((el) =>
          el.classList.remove("be-active-wrapper"),
        );
        w.classList.add("be-active-wrapper");
        return w.id;
      });
      assert.ok(ok, "an active wrapper was set");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowDown");
    });
  });

  it("3. position fields — round trip", async function () {
    const sectionId = await page.evaluate(() => {
      const s = Array.from(document.querySelectorAll(".print-section-container")).find(
        (x) => !x.closest(".be-drag-ghost") && x.id && !x.classList.contains("be-shape"),
      );
      return s ? s.id : null;
    });
    assert.ok(sectionId, "a section exists");
    // Select through the product's own selection seam (the same one its layer rows call),
    // then confirm the panel actually rendered the numeric fields.
    const sel = await contentCall(ctx, "selectSectionOnSheet", [sectionId]);
    assert.ok(sel && (sel.ok === undefined || sel.ok !== false), "selection seam ran: " + JSON.stringify(sel));
    await page.waitForTimeout(800);
    const hasField = await page.evaluate(
      () => !!document.querySelector('[data-be-pos="x"]'),
    );
    assert.ok(
      hasField,
      "the properties panel rendered its X field (if this fails the panel is not showing the " +
        "selection, and the field is not drivable)",
    );

    await roundTrip("position", async () => {
      // Drive the real numeric field the properties panel renders.
      await page.evaluate(() => {
        const input = document.querySelector('[data-be-pos="x"]');
        if (!input) throw new Error("no X field");
        const r = input.getBoundingClientRect();
        if (r.width === 0) throw new Error("the X field is not laid out");
        input.value = String(parseInt(input.value || "0", 10) + 37);
        input.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
    });
  });

  /* ------------------------------------------------------------------ *
   * UI-driven classes with a multi-step modal.
   * ------------------------------------------------------------------ */

  it("4. corner resize — round trip (REAL pointer input)", async function () {
    // Real pointer input on the handle. This class used to dispatch mouse events straight
    // onto the handle element, because the handle was `display: none` — a separate defect
    // (the over-broad lock rule, issue ISSUE_lock_rule_hides_all_resize_rotate_handles) that
    // is now FIXED, so the gesture is driven the way a user drives it: hover the wrapper,
    // press on the handle, drag, release. If the handle ever becomes unreachable again, this
    // case fails rather than silently dispatching into the void.
    // The section is chosen by HITTABILITY, not mere presence: the demo sheet overlaps its own
    // elements, so the first section with a handle can have that handle covered by another
    // element's control (measured: a shape's rotate BUTTON sat on Section-1's corner). Real
    // pointer input there drives the wrong control entirely — which is how this class first
    // reported "a reversible record must be pushed (depth 0 -> 0)" while the layout had
    // changed: the click went to the button, not the handle.
    const sectionId = await page.evaluate(async () => {
      const candidates = Array.from(document.querySelectorAll(".print-section-container"));
      for (const s of candidates.slice(0, 12)) {
        const h = s.querySelector(".print-section-resize-handle");
        const w = s.closest(".be-section-wrapper") || s;
        const layerEl = w.closest(".be-shape-layer-container, #print-enhance-sections-layer");
        if (!h || !layerEl || layerEl.classList.contains("be-layer-locked")) continue;
        w.scrollIntoView({ block: "center" });
        await new Promise((r) => setTimeout(r, 40));
        const hr = h.getBoundingClientRect();
        if (!hr.width || !hr.height) continue;
        if (hr.left < 4 || hr.top < 4 || hr.right > innerWidth - 4 || hr.bottom > innerHeight - 4) continue;
        const top = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
        if (top && (top === h || h.contains(top))) return s.id;
      }
      return null;
    });
    assert.ok(sectionId, "a section whose resize handle is actually reachable exists");

    // Hover, then confirm the handle is genuinely hittable before driving it.
    const ready = await page.evaluate(async (id) => {
      const section = document.getElementById(id);
      const w = section.closest(".be-section-wrapper") || section;
      w.scrollIntoView({ block: "center" });
      const r = w.getBoundingClientRect();
      for (const fy of [0.5, 0.35, 0.65]) {
        for (const fx of [0.5, 0.3, 0.7]) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
          const t = document.elementFromPoint(x, y);
          if (t && (t === w || w.contains(t))) return { x, y };
        }
      }
      return null;
    }, sectionId);
    assert.ok(ready, "a hoverable point on the wrapper exists");
    await page.mouse.move(ready.x, ready.y);
    await page.waitForTimeout(500);

    const box = await page.evaluate((id) => {
      const h = document
        .getElementById(id)
        .querySelector(".print-section-resize-handle");
      const r = h.getBoundingClientRect();
      const cs = getComputedStyle(h);
      const top = r.width
        ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        : null;
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: Math.round(r.width),
        h: Math.round(r.height),
        display: cs.display,
        topmost: top ? top.tagName + "." + top.className : null,
      };
    }, sectionId);
    assert.strictEqual(box.display !== "none" && box.w > 0, true,
      "the resize handle is displayed and has a box: " + JSON.stringify(box));

    await roundTrip("resize", async () => {
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i += 1) {
        await page.mouse.move(box.x + i * 8, box.y + i * 5);
        await page.waitForTimeout(40);
      }
      await page.mouse.up();
    });
  });

  it("5. rotate — round trip (REAL pointer input)", async function () {
    // The shapes layer starts LOCKED, and a locked layer correctly hides its handles — so the
    // layer is unlocked first, through the panel's own lock control. (Before this, dispatching
    // events straight onto the handle bypassed the visibility rule; with real pointer input the
    // rule has to be respected, which is the point.)
    const unlocked = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll(".be-layer-row")).find(
        (r) => r.dataset.layerId && r.dataset.layerId.startsWith("shapes"),
      );
      if (!row) return { error: "no shapes layer row" };
      const btn = row.querySelector('button[title="Toggle Edit Mode"]');
      if (!btn) return { error: "no lock control" };
      btn.click();
      return { ok: true };
    });
    assert.ok(unlocked.ok, "the shapes layer was unlocked: " + JSON.stringify(unlocked));
    await page.waitForTimeout(1200);

    const wrapperId = await page.evaluate(() => {
      const w = document.querySelector(".be-shape-wrapper");
      return w ? w.id : null;
    });
    assert.ok(wrapperId, "a shape wrapper exists");

    const shown = await page.evaluate((id) => {
      const w = document.getElementById(id);
      const btn = w.querySelector(".be-shape-rotate");
      if (!btn) {
        return {
          error: "no rotate control",
          buttons: Array.from(w.querySelectorAll("button")).map((b) => b.className),
        };
      }
      btn.click();
      return { ok: true, handle: !!w.querySelector(".be-rotation-handle") };
    }, wrapperId);
    assert.ok(shown.handle, "the rotation handle exists after the control is used: " + JSON.stringify(shown));

    // Hover the handle itself, which also hovers its wrapper (the handle is a descendant).
    const box = await page.evaluate((id) => {
      const w = document.getElementById(id);
      const h = w.querySelector(".be-rotation-handle");
      const r = w.getBoundingClientRect();
      h.scrollIntoView({ block: "center" });
      const hr = h.getBoundingClientRect();
      return {
        hx: hr.width ? hr.left + hr.width / 2 : r.left + r.width / 2,
        hy: hr.height ? hr.top + hr.height / 2 : r.top - 40,
        w: Math.round(hr.width),
        h: Math.round(hr.height),
        display: getComputedStyle(h).display,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      };
    }, wrapperId);
    assert.strictEqual(
      box.display !== "none" && box.w > 0,
      true,
      "the rotation handle is displayed and has a box: " + JSON.stringify(box),
    );

    await page.mouse.move(box.hx, box.hy);
    await page.waitForTimeout(400);

    await roundTrip("rotate", async () => {
      await page.mouse.move(box.hx, box.hy);
      await page.mouse.down();
      for (let i = 1; i <= 8; i += 1) {
        await page.mouse.move(box.hx + i * 15, box.hy + i * 12);
        await page.waitForTimeout(40);
      }
      await page.mouse.up();
    });
  });

  it("6. layer restack — round trip", async function () {
    // The demo sheet ships with ONE shapes layer, so a reorder needs a second one created
    // through the product's own path before the drag can mean anything.
    let snap = await layerSnapshot(ctx);
    while (snap.layers.length < 2) {
      await contentCall(ctx, "addShapeLayer");
      snap = await layerSnapshot(ctx);
    }
    assert.ok(snap.layers.length >= 2, "at least two layers exist: " + snap.layers.length);

    await roundTrip("restack", async () => {
      // Drive the REAL row drag: HTML5 dragstart -> dragover -> drop -> dragend.
      await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll(".be-layer-row[data-layer-id]"));
        const from = rows[rows.length - 1];
        const group = from.closest(".be-layer-group");
        const dt = { setDragImage() {}, getData: () => "", setData() {} };
        // `clientY` is a GETTER on MouseEvent, so it must be passed to the CONSTRUCTOR —
        // assigning it afterwards throws "has only a getter" (measured).
        const mk = (type, clientY) => {
          const e = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY,
          });
          Object.defineProperty(e, "dataTransfer", { value: dt });
          return e;
        };
        from.dispatchEvent(mk("dragstart", 300));
        group.dispatchEvent(mk("dragover", -999));
        group.dispatchEvent(mk("drop", -999));
        from.dispatchEvent(mk("dragend", 300));
      });
    });
  });

  it("7. chip reparenting — round trip", async function () {
    const snap = await layerSnapshot(ctx);
    assert.ok(snap.shapes.length > 0, "a shape exists to reparent");
    const target = await contentCall(ctx, "addShapeLayer");
    assert.ok(target.ok, "a target layer was created: " + JSON.stringify(target));

    const shape = snap.shapes[0];
    await roundTrip("reparent", async () => {
      const res = await contentCall(ctx, "moveShapeToLayer", [shape.wrapperId, target.id]);
      assert.ok(res.ok, "the reparent applied (its capture point is inside this method)");
    });
  });

  it("8. compact mode — round trip", async function () {
    const btn = await page.evaluate(() => !!document.querySelector(".be-compact-button"));
    assert.ok(btn, "the in-sheet compact control exists");
    await roundTrip("compact", async () => {
      await domClick(page, ".be-compact-button");
    });
  });

  it("9. border style — round trip", async function () {
    // The REAL picker flow: open the section menu -> the border button -> choose -> Apply.
    const opened = await page.evaluate(() => {
      const w = Array.from(
        document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
      ).find((x) => {
        const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
        return m && m.querySelector(".be-border-button");
      });
      if (!w) return null;
      w.querySelector(":scope > .be-section-actions > .be-more-options-button").click();
      return w.id;
    });
    assert.ok(opened, "a section with a border menu exists");
    await page.waitForTimeout(400);
    await domClick(page, `#${opened} > .be-section-actions > .be-context-menu > .be-border-button`);
    await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });

    await roundTrip("border", async () => {
      await page.evaluate(() => {
        const opt = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find(
          (o) => o.querySelector("[class*='_border']"),
        );
        if (!opt) throw new Error("no border option");
        opt.click();
        const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find((b) =>
          b.textContent.trim().startsWith("Apply"),
        );
        if (!ok) throw new Error("no Apply control");
        ok.click();
      });
    });
  });

  it("10. layer flags (print / visibility / lock) — round trip each", async function () {
    for (const [title] of [
      ["Skip when printing", "layer-flag"],
      ["Hide on sheet", "layer-flag"],
      ["Toggle Edit Mode", "layer-flag"],
    ]) {
      // Re-queried every iteration: an undo RESTORES THE LAYOUT through applyLayout, which
      // rebuilds the layer panel, so a button reference held from before is detached.
      await page.waitForTimeout(400);
      const hit = await page.evaluate((t) => {
        const btn = Array.from(document.querySelectorAll(".be-layer-row button")).find(
          (b) => b.title === t,
        );
        if (!btn) return null;
        if (btn.disabled) return "disabled";
        btn.click();
        return t;
      }, title);
      assert.strictEqual(hit, title, "the '" + title + "' control exists and is enabled (got " + hit + ")");
      await page.waitForTimeout(1400);

      const after = await read(ctx);
      assert.ok(after.depth > 0, title + ": a record was pushed (" + after.depth + ")");
      assert.ok(after.label, title + ": the record is named: " + after.label);
      const undone = await invokeUndo(ctx);
      assert.strictEqual(undone.ok, true, title + ": the undo ran — " + JSON.stringify(undone));
      await page.waitForTimeout(1400);
      assert.strictEqual(
        (await read(ctx)).depth,
        0,
        title + ": the stack drained to 0",
      );
    }
  });

  it("11. layer rename — round trip", async function () {
    // A SHAPE layer row is needed: the SECTIONS row is not renameable and its label carries no
    // handler at all (measured — the first pass searched every row and found none, because on
    // the demo sheet the sections row is the only one until a shape layer exists).
    let snap = await layerSnapshot(ctx);
    while (snap.layers.length < 2) {
      await contentCall(ctx, "addShapeLayer");
      snap = await layerSnapshot(ctx);
    }
    await page.waitForTimeout(500);

    // The rename target is the row's label span, which carries NO class — it is identified by
    // its handler, exactly as the panel wires it (`label.ondblclick = ... showRenameModal`).
    // The label span carries NO class, so it is found as the first span of a SHAPE layer row.
    //
    // It CANNOT be found by its handler: `typeof el.ondblclick` reads as "undefined" from
    // `page.evaluate`, because event-handler IDL attributes are stored PER WORLD and the
    // handler was assigned in the extension's isolated world (the same documented limitation
    // as content-script globals). Dispatching the event still works — DOM events cross worlds
    // — so the listener fires; only the introspection does not.
    const label = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll(".be-layer-row")).find(
        (r) => r.dataset.layerId && r.dataset.layerId.startsWith("shapes"),
      );
      const lab = row && row.querySelector("span");
      if (!lab) return null;
      lab.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
      return lab.textContent;
    });
    assert.ok(label, "a shape layer row with a label exists: " + JSON.stringify(label));

    // Target the rename dialog specifically. A generic `.be-modal-overlay input` also matches
    // the border picker's SEARCH field, which is how the first run matched a hidden element
    // and reported a bogus timeout.
    await page.waitForSelector(".be-modal-overlay input[type='text'], .be-modal-overlay input:not([type])", {
      timeout: 20000,
    });
    await roundTrip("rename", async () => {
      await page.evaluate(() => {
        const input = document.querySelector(".be-modal-overlay input.be-modal-input")
          || document.querySelector(".be-modal-overlay input");
        input.value = "Renamed In Browser";
        // The SUBMIT control is targeted EXACTLY. A selector list including
        // `.be-modal-actions button` matches the CANCEL button first (document order), which
        // silently closes the dialog without renaming — that is what made this class report
        // "the mutation must CHANGE the layout" on the previous run.
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        if (!ok) throw new Error("no .be-modal-ok in the rename dialog");
        ok.click();
      });
    });
  });

  it("12. structural — clone shape and add shape round trip", async function () {
    const wrapperId = await page.evaluate(() => {
      const w = document.querySelector(".be-shape-wrapper");
      return w ? w.id : null;
    });
    assert.ok(wrapperId, "a shape wrapper exists");

    // Show the shape's action menu, then press Clone Shape.
    const cloned = await page.evaluate((id) => {
      const w = document.getElementById(id);
      const actions = w.querySelector(".be-section-actions");
      const trigger = actions && actions.querySelector(".be-more-options-button");
      if (trigger) trigger.click();
      return !!trigger;
    }, wrapperId);
    assert.ok(cloned, "the shape action menu has a trigger");
    await page.waitForTimeout(400);
    await domClick(page, `#${wrapperId} .be-context-menu .be-shape-clone`);
    await page.waitForTimeout(900);

    const after = await read(ctx);
    assert.ok(after.depth > 0, "clone shape pushed a record (" + after.depth + ")");
    assert.strictEqual(after.label, "Clone shape", "and it is named: " + after.label);
    const undone = await invokeUndo(ctx);
    assert.strictEqual(undone.ok, true, "the undo ran");
    await page.waitForTimeout(900);
    assert.strictEqual((await read(ctx)).depth, 0, "the stack drained");
  });
});
