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
 *      (DELIBERATELY CHANGED by ISSUE_drag_and_drop.md: the green hover
 *      drop-shadow is asserted GONE and its replacement, the centred nine-dot
 *      drag handle, is asserted live instead; the gold active-wrapper selection
 *      glow stays) and the print CSS strips them.
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
      // DELIBERATELY REVERSED (ISSUE_drag_and_drop.md, 2026-09-14): this test
      // used to REQUIRE the green hover glow. The owner rejected it — "There's a
      // 'green' shadow filter displayed when hovering a section that's allowed to
      // be dragged and dropped. The UX of that is extremely bad" — because a
      // `filter` on the hovered wrapper repaints the whole subtree. It is asserted
      // GONE here, against the live composed stylesheet rather than the source
      // text, so no rule from any injection point can bring it back unnoticed.
      assert.ok(
        !/filter:[^;}]*drop-shadow\(0 0 15px #28a745\)/.test(
          css.replace(/\/\*[\s\S]*?\*\//g, ""),
        ),
        "no rule paints the green hover glow any more",
      );
      // …and its replacement is live on the page: one centred nine-dot handle per
      // section, invisible at rest, revealed only by the active layer.
      const atRest = await page.evaluate(() => {
        const sec = document.querySelector(
          ".be-active-layer .be-section-wrapper:not(.be-shape-wrapper)",
        );
        const h = sec && sec.querySelector(":scope > .be-drag-handle");
        if (!h) return { present: false };
        const cs = getComputedStyle(h);
        const r = h.getBoundingClientRect();
        const w = sec.getBoundingClientRect();
        const countHandles = () =>
          document.querySelectorAll(".be-section-wrapper > .be-drag-handle").length;
        return {
          present: true,
          dots: h.querySelectorAll("circle").length,
          // centred on the WRAPPER box, not on whatever content it holds
          offCentreX: Math.abs(r.left + r.width / 2 - (w.left + w.width / 2)),
          offCentreY: Math.abs(r.top + r.height / 2 - (w.top + w.height / 2)),
          directChildOfWrapper: h.parentElement === sec,
          visibility: cs.visibility,
          pointerEvents: cs.pointerEvents,
          boxShadow: cs.boxShadow,
          filter: cs.filter,
          handles: countHandles(),
          wrappers: document.querySelectorAll(".be-section-wrapper").length,
        };
      });
      assert.ok(atRest.present, "the active layer's section carries a drag handle");
      assert.strictEqual(atRest.dots, 9, "the handle is the NINE-dot grip");
      assert.ok(atRest.directChildOfWrapper, "it is a direct child of the wrapper");
      assert.ok(
        atRest.offCentreX < 2 && atRest.offCentreY < 2,
        `the handle sits at the CENTRE of the section (off by ${atRest.offCentreX},${atRest.offCentreY})`,
      );
      assert.strictEqual(atRest.visibility, "hidden", "invisible at rest");
      assert.strictEqual(atRest.pointerEvents, "none", "and unhittable at rest");
      assert.ok(
        atRest.boxShadow === "none" || !/rgba?\(/.test(atRest.boxShadow),
        "the handle casts no shadow (ISSUE_shadows.md): " + atRest.boxShadow,
      );
      assert.ok(
        atRest.filter === "none" || !/drop-shadow/.test(atRest.filter),
        "the handle paints no glow: " + atRest.filter,
      );
      assert.strictEqual(
        atRest.handles,
        atRest.wrappers,
        "one handle per section wrapper — none missing, none doubled",
      );

      /* ---- THE REVEAL, measured with a REAL pointer hover -----------------
         Synthetic PointerEvents (the other tests in this file) do NOT move the
         browser's :hover state, so a reveal assertion cannot be faked in-page.
         `pickTopMost` marks its chosen wrapper with data-be-probe so every later
         evaluate() reads THE SAME element it hovered — and returns the top-most
         candidate at its own centre point, so the mouse really lands on it rather
         than on whatever section overlaps it. ---- */
      const probeHover = async (predicate) => {
        const picked = await page.evaluate((pred) => {
          const all = Array.from(
            document.querySelectorAll(".be-section-wrapper"),
          ).filter(
            pred === "active"
              ? (el) =>
                  el.closest(".be-active-layer") &&
                  !el.classList.contains("be-shape-wrapper")
              : // A layer can be BOTH the insertion target and locked (the two
                // are independent concepts — js/dom/layer_manager.js
                // applyInsertionTarget vs toggleLayerLock), so the "inactive"
                // probe must exclude the active layer or it would assert the
                // reveal rule and its negation on the same element.
                (el) => el.closest(".be-layer-locked") && !el.closest(".be-active-layer"),
          );
          for (const el of all) {
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 40) continue;
            if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) continue;
            const hit = document.elementFromPoint(
              r.left + r.width / 2,
              r.top + r.height / 2,
            );
            if (!hit || !(hit === el || el.contains(hit))) continue;
            document
              .querySelectorAll("[data-be-probe]")
              .forEach((n) => n.removeAttribute("data-be-probe"));
            el.setAttribute("data-be-probe", pred);
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
          return null;
        }, predicate);
        if (!picked) return null;
        await page.mouse.move(picked.x, picked.y);
        await page.waitForTimeout(250);
        return page.evaluate(() => {
          const sec = document.querySelector("[data-be-probe]");
          if (!sec) return null;
          const read = (node) => {
            if (!node) return null;
            const cs = getComputedStyle(node);
            return {
              visibility: cs.visibility,
              opacity: cs.opacity,
              pointerEvents: cs.pointerEvents,
              cursor: cs.cursor,
              boxShadow: cs.boxShadow,
            };
          };
          return {
            hovered: sec.matches(":hover"),
            handle: read(sec.querySelector(":scope > .be-drag-handle")),
            bar: read(sec.querySelector(":scope > .be-section-actions")),
          };
        });
      };

      const onActive = await probeHover("active", "active layer");
      if (onActive) {
        assert.ok(
          onActive.hovered,
          "the pointer really hovered the active-layer wrapper (otherwise the " +
            "assertions below prove nothing)",
        );
        assert.ok(onActive.handle, "the handle exists to be revealed");
        assert.strictEqual(onActive.handle.visibility, "visible", "hovering the ACTIVE layer reveals the handle");
        assert.strictEqual(onActive.handle.opacity, "1", "fully, not a ghost");
        assert.strictEqual(onActive.handle.pointerEvents, "auto", "and it is grabbable");
        assert.strictEqual(onActive.handle.cursor, "grab", "with a grab cursor");
        // ISSUE_hover.md, the positive half: the active layer's bar reveals too.
        if (onActive.bar) {
          assert.strictEqual(onActive.bar.opacity, "1", "the active layer's action bar reveals on hover");
          assert.strictEqual(onActive.bar.pointerEvents, "auto", "and is clickable");
        }
      }

      // ISSUE_hover.md, the negative half: hovering an INACTIVE (locked) layer's
      // section reveals NOTHING. Buttons used to appear "on ALL sections
      // regardless of their status".
      const onLocked = await probeHover("locked", "locked layer");
      if (onLocked) {
        assert.ok(onLocked.hovered, "the pointer really hovered the locked wrapper");
        if (onLocked.handle) {
          assert.strictEqual(
            onLocked.handle.visibility,
            "hidden",
            "an INACTIVE layer shows no handle even while hovered",
          );
          assert.strictEqual(onLocked.handle.pointerEvents, "none", "and it is not grabbable");
        }
        if (onLocked.bar) {
          assert.strictEqual(onLocked.bar.opacity, "0", "an INACTIVE layer shows no action bar while hovered");
          assert.strictEqual(
            onLocked.bar.pointerEvents,
            "none",
            "and the hidden bar is OUT OF THE HIT-TEST — the inline " +
              "pointerEvents=\"all\" at build time (js/main.js:2513) must not win",
          );
        }
      }
      await page.mouse.move(4, 400); // leave the sheet before the next probe

      // DELIBERATELY UPDATED (ISSUE_shadows.md): the control panel's shadows are
      // removed by request. The tooled FRAME survives (a zero-blur box-shadow is
      // a border, and track ornament_symmetry_20260910 pins it); the blurred
      // black lift does not, so nothing blurred-black may appear in the panel's
      // composed shadow list.
      const panel = await page.evaluate(() => {
        const el = document.getElementById("print-enhance-controls");
        return el ? getComputedStyle(el).boxShadow : null;
      });
      assert.ok(panel !== null, "the control panel exists");
      assert.ok(
        panel === "none" || !/rgba?\([^)]*\)\s+0px\s+[1-9]\d*px/.test(panel),
        "#print-enhance-controls casts no blurred shadow: " + panel,
      );
      // DELIBERATELY UPDATED (selection_model_ia_20260910, AC-2): the
      // active-wrapper glow used to be the off-palette #c53131 spelled out in
      // this stylesheet; the selection visuals are now a locked palette token so
      // a selected shape and a selected section share one language. Selection is
      // NOT the hover the owner complained about, so this stays.
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
