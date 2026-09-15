/**
 * Drag & Drop UX visual-gate capture harness (track drag_ux_overhaul_20260909).
 *
 * Boots the unpacked MV3 extension on the demo sheet at 1440px and saves
 * named frames under vendor/docs/drag-ux-20260909/shots-phaseN/ for the per-phase
 * visual gates (spec.md AC-V1 / visual_gate_protocol.md).
 *
 * Gating (graceful-skip pattern — a normal `npm run test:e2e:*` run never
 * captures and never fails):
 *   DRAG_UX_SHOTS=1        enable capturing (otherwise every test skips)
 *   DRAG_UX_PHASE=N        only run the describe block for phase N
 *   DRAG_UX_SHOTS_DIR=...  override the artifact root (default
 *                          vendor/docs/drag-ux-20260909)
 *
 * The synth drag helper drives the pointer-events engine (Phase 1+): pointer
 * down -> move in steps (so the movement threshold is crossed and the ghost
 * commits) -> optional mid-drag hook -> up. After Phase 1 the ghost is a DOM
 * element (`.be-drag-ghost`) so a mid-drag frame can be captured before the
 * pointer is released; native-HTML5 baseline captures (Phase 0) are
 * rest-state / after-drop only.
 *
 * Run (after a phase has frames to produce):
 *   DRAG_UX_SHOTS=1 DRAG_UX_PHASE=1 npx mocha test/browser_e2e/drag_ux_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'DRAG_UX_SHOTS',
  dirVar: 'DRAG_UX_SHOTS_DIR',
  defaultDir: 'vendor/docs/drag-ux-20260909',
  phaseVar: 'DRAG_UX_PHASE',
  defaultPhase: "",
});
const ART_ROOT = cap.artRoot;
const CAPTURING = cap.enabled;
const PHASE = cap.phase;

async function frame(page, phaseDir, name) {
  const dir = path.join(ART_ROOT, phaseDir);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, name);
  await page.screenshot({ path: out });
  return out;
}

/**
 * Pointer-sequence drag of a wrapper (Phase 1+ pointer engine).
 * @param {import('playwright').Page} page
 * @param {string} selector  wrapper selector, e.g. '#print-layout-wrapper .be-section-wrapper'
 * @param {{dx?:number, dy?:number, steps?:number, hold?:boolean, onMid?:Function}} opts
 */
async function dragByPointer(page, selector, opts = {}) {
  const { dx = 0, dy = 0, steps = 6, hold = false, onMid } = opts;
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box, `drag target not found: ${selector}`);
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + (dx * i) / steps, sy + (dy * i) / steps);
    await page.waitForTimeout(20);
  }
  if (onMid) await onMid();
  if (!hold) await page.mouse.up();
  return { from: { x: sx, y: sy }, to: { x: sx + dx, y: sy + dy } };
}

describe("Drag UX visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  describe("phase 0 baseline (native-HTML5 drag behavior)", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "0")) this.skip();
    });

    it("captures the sheet layout and a wrapper rest/hover state", async function () {
      const page = await bootPage(ctx);
      try {
        await frame(page, "shots-phase0", "00-sheet-layout.png");
        // Pick a wrapper whose center is not covered by the floating chrome
        // panels (controls/layer manager) so the hover state is truthful.
        const free = await page.evaluate(() => {
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
            document.querySelectorAll("#print-layout-wrapper .be-section-wrapper"),
          );
          for (const w of ws) {
            const r = w.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (r.width > 0 && r.height > 0 && !inside(cx, cy)) {
              return { id: w.id, x: cx, y: cy };
            }
          }
          const last = ws[ws.length - 1].getBoundingClientRect();
          return {
            id: ws[ws.length - 1].id,
            x: last.left + last.width / 2,
            y: last.top + last.height / 2,
          };
        });
        assert.ok(free.id, "a non-covered wrapper should exist");
        await page.mouse.move(free.x, free.y);
        await page.waitForTimeout(400);
        await frame(page, "shots-phase0", "01-wrapper-hover.png");
        const n = await page
          .locator("#print-layout-wrapper .be-section-wrapper")
          .count();
        assert.ok(n >= 3, "demo sheet should expose several wrappers");
      } finally {
        await page.close().catch(() => {});
      }
    });

    // NOTE: no mid-drag / after-drop frame here on purpose — the current
    // native-HTML5 engine cannot be driven to a truthful mid-drag state by
    // Playwright raw mouse events (HTML5 DnD needs a synthesized DataTransfer
    // drag), so a "drop" frame would not show what it claims. That
    // drivability gap is itself part of the Phase 1 pointer-engine rationale;
    // from Phase 1 on, dragByPointer() captures real mid-drag/ghost frames.
  });

  describe("phase 1 pointer engine", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) this.skip();
    });

    // Reusable: pick a section wrapper whose center is not covered by the
    // floating chrome panels, so drags are truthful and hit-testable.
    const freeWrapper = async (page) => {
      const pt = await page.evaluate(() => {
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
          document.querySelectorAll("#print-layout-wrapper .be-section-wrapper:not(.be-shape-wrapper)"),
        );
        for (const w of ws) {
          const r = w.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (r.width > 40 && r.height > 40 && !inside(cx, cy)) {
            return { x: cx, y: cy };
          }
        }
        return null;
      });
      assert.ok(pt, "a draggable, non-covered section wrapper must exist");
      return pt;
    };

    it("captures a committed pointer drag with the custom ghost (mouse)", async function () {
      const page = await bootPage(ctx);
      try {
        const pt = await freeWrapper(page);
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.down();
        await page.mouse.move(pt.x + 240, pt.y + 170, { steps: 10 });
        await page.waitForTimeout(250);
        const mid = await page.evaluate(() => ({
          dragging: !!document.querySelector(
            ".be-section-wrapper.dragging",
          ),
          ghosts: document.querySelectorAll(".be-drag-ghost").length,
        }));
        assert.strictEqual(mid.dragging, true, "drag committed mid-gesture");
        assert.strictEqual(mid.ghosts, 1, "custom ghost present mid-drag");
        await frame(page, "shots-phase1", "10-pointer-mid-drag-ghost.png");
        // Zoom cell: crop tightly around the source ∪ ghost bounding box so
        // the reviewer sees the gold frame / dim / separation at scale
        // (crop-and-upscale pattern from the visual-validation skill).
        const zoom = await page.evaluate(() => {
          const src = document.querySelector(".be-section-wrapper.dragging");
          const ghost = document.querySelector(".be-drag-ghost");
          const r = (el) => {
            const b = el.getBoundingClientRect();
            return { l: b.left, t: b.top, r: b.right, btm: b.bottom };
          };
          const boxes = [r(src), r(ghost)].filter(Boolean);
          const pad = 24;
          const l = Math.max(0, Math.min(...boxes.map((b) => b.l)) - pad);
          const t = Math.max(0, Math.min(...boxes.map((b) => b.t)) - pad);
          const rr = Math.min(
            window.innerWidth,
            Math.max(...boxes.map((b) => b.r)) + pad,
          );
          const bb = Math.min(
            window.innerHeight,
            Math.max(...boxes.map((b) => b.btm)) + pad,
          );
          return { x: l, y: t, width: rr - l, height: bb - t };
        });
        if (zoom.width > 40 && zoom.height > 40) {
          await page.screenshot({
            path: path.join(
              ART_ROOT,
              "shots-phase1",
              "14-zoom-drag-region.png",
            ),
            clip: zoom,
          });
        }
        await page.mouse.up();
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the same-session before/after pair (source restored, wrapper moved)", async function () {
      const page = await bootPage(ctx);
      try {
        const pt = await freeWrapper(page);
        const DX = 224;
        const DY = 160;
        // Zoom region: union of the section's current box and its expected
        // post-drop box, padded — identical clip for both frames.
        const clip = await page.evaluate(
          ({ x, y, dx, dy }) => {
            const el = document.elementFromPoint(x, y);
            const w = el && el.closest
              ? el.closest(".be-section-wrapper")
              : null;
            if (!w) throw new Error("no wrapper at drag point");
            const r = w.getBoundingClientRect();
            const pad = 36;
            const l = Math.max(0, Math.min(r.left, r.left + dx) - pad);
            const t = Math.max(0, Math.min(r.top, r.top + dy) - pad);
            const rr = Math.min(
              window.innerWidth,
              Math.max(r.right, r.right + dx) + pad,
            );
            const bb = Math.min(
              window.innerHeight,
              Math.max(r.bottom, r.bottom + dy) + pad,
            );
            return { x: l, y: t, width: rr - l, height: bb - t };
          },
          { x: pt.x, y: pt.y, dx: DX, dy: DY },
        );
        // Same session, same page: before frame + zoom-before, then drag +
        // release, then after frame + zoom-after — all directly comparable.
        await frame(page, "shots-phase1", "13-before-drop.png");
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase1", "15-zoom-before.png"),
          clip,
        });
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.down();
        await page.mouse.move(pt.x + DX, pt.y + DY, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        const st = await page.evaluate(() => ({
          ghosts: document.querySelectorAll(".be-drag-ghost").length,
          dimmed: !!document.querySelector(".be-section-wrapper.dragging"),
          bodyDragging: document.body.classList.contains("be-dragging"),
        }));
        assert.strictEqual(st.ghosts, 0, "ghost removed after release");
        assert.strictEqual(st.dimmed, false, "no wrapper left in dragging state");
        assert.strictEqual(st.bodyDragging, false, "be-dragging class removed");
        await frame(page, "shots-phase1", "11-after-drop.png");
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase1", "16-zoom-after.png"),
          clip,
        });
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a touch-pointer drag mid-gesture (pointerType touch)", async function () {
      const page = await bootPage(ctx);
      try {
        const pt = await freeWrapper(page);
        // Synthetic touch pointer sequence: down + commit move, held.
        await page.evaluate(
          ({ x, y }) => {
            const ev = (t, px, py) =>
              new PointerEvent(t, {
                bubbles: true,
                cancelable: true,
                clientX: px,
                clientY: py,
                pointerId: 11,
                pointerType: "touch",
                isPrimary: true,
              });
            const w = document.elementFromPoint(x, y);
            const wrapper = w && w.closest
              ? w.closest(".be-section-wrapper")
              : null;
            if (!wrapper) throw new Error("touch target must be inside a wrapper");
            wrapper.dispatchEvent(ev("pointerdown", x, y));
            document.dispatchEvent(ev("pointermove", x + 180, y + 130));
          },
          { x: pt.x, y: pt.y },
        );
        await page.waitForTimeout(250);
        const mid = await page.evaluate(() => ({
          dragging: !!document.querySelector(
            ".be-section-wrapper.dragging",
          ),
          ghosts: document.querySelectorAll(".be-drag-ghost").length,
        }));
        assert.strictEqual(mid.dragging, true, "touch drag committed");
        assert.strictEqual(mid.ghosts, 1, "touch drag shows the ghost");
        await frame(page, "shots-phase1", "12-touch-drag-mid.png");
        await page.evaluate(() => {
          document.dispatchEvent(
            new PointerEvent("pointerup", {
              bubbles: true,
              cancelable: true,
              clientX: 0,
              clientY: 0,
              pointerId: 11,
              pointerType: "touch",
              isPrimary: true,
            }),
          );
        });
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  describe("phase 2 live snap + guides", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "2")) this.skip();
    });

    it("captures a live-snapped drag with gold alignment guides and the zero-jump drop", async function () {
      const page = await bootPage(ctx);
      try {
        // Choose a drag source and compute a target clientX that snaps the
        // source onto another wrapper's (grid-aligned) left edge, producing
        // a vertical guide.
        const plan = await page.evaluate(() => {
          const container = document.getElementById("print-layout-wrapper");
          const cRect = container.getBoundingClientRect();
          let scale = 1;
          const tr = window.getComputedStyle(container).transform;
          if (tr && tr !== "none") {
            scale = parseFloat(tr.split("(")[1].split(")")[0].split(",")[0]);
          }
          const ws = Array.from(
            container.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          );
          const panels = ["#print-enhance-controls", "#print-enhance-layer-manager"]
            .map((s) => document.querySelector(s))
            .filter(Boolean)
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { l: r.left, t: r.top, r: r.right, b: r.bottom };
            });
          const inside = (x, y) =>
            panels.some((p) => x >= p.l && x <= p.r && y >= p.t && y <= p.b);
          const target = ws.find((w) => {
            const r = w.getBoundingClientRect();
            return (
              r.width > 60 && r.height > 40 &&
              !inside(r.left + r.width / 2, r.top + r.height / 2) &&
              parseInt(w.style.left) > 200 // some travel room
            );
          });
          if (!target) throw new Error("no suitable drag source");
          const tRect = target.getBoundingClientRect();
          const cx = tRect.left + tRect.width / 2;
          const cy = tRect.top + tRect.height / 2;
          // Guide target: another wrapper's snapped left, at least 128px away.
          const peer = ws.find(
            (w) =>
              w !== target &&
              Math.abs(parseInt(w.style.left) - parseInt(target.style.left)) >= 128,
          );
          if (!peer) throw new Error("no peer wrapper to align to");
          const peerLeft = parseInt(peer.style.left);
          const offsetX = cx - tRect.left;
 // one grid step right of peer-left → LEFT edge aligns? no: we snap; use peerLeft exactly + offset so source LEFT == peer LEFT? csX = clientX - cRect.left - offsetX → want = peerLeft → clientX = cRect.left + peerLeft*scale + offsetX. Add 0.
          return {
            cx,
            cy,
            finalClientX: cRect.left + peerLeft * scale + offsetX,
            finalClientY: cy + 96,
            peerLeft,
            sourceId: target.id,
          };
        });
        await page.mouse.move(plan.cx, plan.cy);
        await page.mouse.down();
        await page.mouse.move(plan.cx + 60, plan.cy + 48, { steps: 6 });
        await page.mouse.move(plan.finalClientX, plan.finalClientY, { steps: 12 });
        await page.waitForTimeout(200);
        const mid = await page.evaluate(() => {
          const container = document.getElementById("print-layout-wrapper");
          const cRect = container.getBoundingClientRect();
          let scale = 1;
          const tr = window.getComputedStyle(container).transform;
          if (tr && tr !== "none") {
            scale = parseFloat(tr.split("(")[1].split(")")[0].split(",")[0]);
          }
          const ghost = document.querySelector(".be-drag-ghost");
          const layer = document.querySelector(".be-drag-guides");
          const csLeft = ghost
            ? (parseFloat(ghost.style.left) - cRect.left) / scale
            : null;
          const csTop = ghost
            ? (parseFloat(ghost.style.top) - cRect.top) / scale
            : null;
          const onGrid = (v) =>
            v !== null && Math.abs(v / 16 - Math.round(v / 16)) < 1e-6;
          return {
            dragging: !!document.querySelector(".be-section-wrapper.dragging"),
            csLeft,
            csTop,
            snapped: ghost !== null && onGrid(csLeft) && onGrid(csTop),
            guides: layer ? layer.querySelectorAll(".be-drag-guide").length : 0,
            slotX: ghost ? Math.round(csLeft / 16) * 16 : null,
            slotY: ghost ? Math.round(csTop / 16) * 16 : null,
          };
        });
        assert.strictEqual(mid.dragging, true);
        assert.strictEqual(mid.snapped, true, "ghost is live-snapped in container space (AC-4)");
        assert.ok(mid.guides >= 1, "alignment guide visible mid-drag");
        await frame(page, "shots-phase2", "20-live-snap-with-guides.png");
        // Zoom clip around the alignment seam (ghost/source left edges + the
        // guide line) so the gold frame + hairline read at scale.
        const seamClip = await page.evaluate(() => {
          const ghost = document.querySelector(".be-drag-ghost");
          const src = document.querySelector(".be-section-wrapper.dragging");
          const gx = parseInt(ghost.style.left);
          const gy = parseInt(ghost.style.top);
          const gh = ghost.offsetHeight;
          const sRect = src.getBoundingClientRect();
          const x0 = Math.max(0, gx - 250);
          const x1 = Math.min(window.innerWidth, gx + 190);
          const y0 = Math.max(0, Math.min(sRect.top, gy) - 24);
          const y1 = Math.min(window.innerHeight, Math.max(sRect.bottom, gy + gh) + 24);
          return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
        });
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase2", "23-zoom-guides.png"),
          clip: seamClip,
        });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const after = await page.evaluate(
          (slot) => {
            const landed = Array.from(
              document.querySelectorAll("#print-layout-wrapper .be-section-wrapper"),
            ).find(
              (el) =>
                parseInt(el.style.left) === slot.x &&
                parseInt(el.style.top) === slot.y,
            );
            return {
              zeroJump: !!landed,
              left: landed ? parseInt(landed.style.left) : null,
              top: landed ? parseInt(landed.style.top) : null,
              gridAligned:
                landed !== null &&
                parseInt(landed.style.left) % 16 === 0 &&
                parseInt(landed.style.top) % 16 === 0,
              ghosts: document.querySelectorAll(".be-drag-ghost").length,
              guides: document.querySelectorAll(".be-drag-guides").length,
            };
          },
          { x: mid.slotX, y: mid.slotY },
        );
        assert.strictEqual(after.zeroJump, true, "wrapper lands exactly on the ghost slot (zero jump)");
        assert.strictEqual(after.gridAligned, true, "landed position is grid-aligned");
        assert.strictEqual(after.ghosts, 0, "ghost cleaned up");
        assert.strictEqual(after.guides, 0, "guides cleaned up");
        await frame(page, "shots-phase2", "22-zero-jump-landed.png");
        // Same seam clip after release: the landed section shows flush
        // alignment where the guide was (no jump off the grid slot).
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase2", "24-zoom-landed.png"),
          clip: seamClip,
        });
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the locked-layer state (no drag affordance, dimmed)", async function () {
      const page = await bootPage(ctx);
      try {
        const st = await page.evaluate(() => {
          const candidates = Array.from(
            document.querySelectorAll(".be-shape-wrapper"),
          );
          // Prefer a shape that lives inside a locked layer container; fall
          // back to any shape otherwise.
          const shape =
            candidates.find((el) => el.closest(".be-layer-locked")) ||
            candidates[0];
          if (!shape) return null;
          shape.dataset.lockedProbe = "1"; // tag for the locator below
          const cs = window.getComputedStyle(shape);
          // Effective rendered opacity = product of the opacity chain from
          // the locked layer container down to the shape element.
          let effective = 1;
          let node = shape;
          while (node && node !== document.documentElement) {
            const o = parseFloat(window.getComputedStyle(node).opacity);
            if (!Number.isNaN(o)) effective *= o;
            node = node.parentElement;
          }
          return {
            cursor: cs.cursor,
            effectiveOpacity: Math.round(effective * 100) / 100,
            bodyLocked: Array.from(document.body.classList).some((c) =>
              c.startsWith("be-lock-"),
            ),
            layerLocked: !!shape.closest(".be-layer-locked"),
          };
        });
        assert.ok(st, "a shape wrapper exists");
        assert.ok(st.bodyLocked || st.layerLocked, "locked context present");
        assert.strictEqual(st.cursor, "not-allowed", "locked wrapper cursor is not-allowed (AC-5)");
        assert.ok(
          st.effectiveOpacity < 0.8 && st.effectiveOpacity > 0.2,
          `locked shape is visibly dimmed (effective opacity ${st.effectiveOpacity})`,
        );
        console.log("[p2] locked shape effective opacity =", st.effectiveOpacity);
        const box = await page
          .locator('.be-shape-wrapper[data-locked-probe="1"]')
          .first()
          .boundingBox();
        assert.ok(box, "locked shape visible");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300);
        await frame(page, "shots-phase2", "21-locked-layer-no-affordance.png");
        // Zoom clip of the hovered locked shape (dim + no affordance).
        const pad = 36;
        const shapeClip = await page.evaluate(
          ({ x, y, w, h, pad }) => {
            const x0 = Math.max(0, x - pad);
            const y0 = Math.max(0, y - pad);
            return {
              x: x0,
              y: y0,
              width: Math.min(window.innerWidth - x0, w + 2 * pad),
              height: Math.min(window.innerHeight - y0, h + 2 * pad),
            };
          },
          { x: box.x, y: box.y, w: box.width, h: box.height, pad },
        );
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase2", "25-zoom-locked-shape.png"),
          clip: shapeClip,
        });
        // Zoom clip of the layer manager's shapes row (lock chrome).
        const lm = await page.locator("#print-enhance-layer-manager").first().boundingBox().catch(() => null);
        if (lm) {
          await page.screenshot({
            path: path.join(ART_ROOT, "shots-phase2", "26-zoom-lock-chrome.png"),
            clip: {
              x: lm.x,
              y: lm.y,
              width: Math.min(lm.width, 400),
              height: Math.min(lm.height, 700),
            },
          });
        }
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  describe("phase 3 bounds + autosave", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "3")) this.skip();
    });

    it("captures the post-drop autosave toast after release", async function () {
      const page = await bootPage(ctx);
      try {
        // Drag a section a short distance, release, and wait past the 1s
        // autosave debounce so the 'Layout saved' toast is live.
        const pt = await page.evaluate(() => {
          const container = document.getElementById("print-layout-wrapper");
          const ws = Array.from(
            container.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          );
          const t = ws.find((w) => {
            const r = w.getBoundingClientRect();
            return r.left > 120 && r.top > 120;
          });
          if (!t) throw new Error("no section to drag");
          const r = t.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.down();
        await page.mouse.move(pt.x + 96, pt.y + 80, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(1700); // debounce (1s) + settle
        const st = await page.evaluate(() => ({
          ghosts: document.querySelectorAll(".be-drag-ghost").length,
          toastTexts: Array.from(
            document.querySelectorAll(".be-toast, [class*='toast']"),
          ).map((t) => (t.textContent || "").trim()),
        }));
        assert.strictEqual(st.ghosts, 0, "no ghost after release");
        await frame(page, "shots-phase3", "31-after-drop-autosave-toast.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a drop clamped to the sheet origin (never negative)", async function () {
      const page = await bootPage(ctx);
      try {
        const pt = await page.evaluate(() => {
          const container = document.getElementById("print-layout-wrapper");
          const ws = Array.from(
            container.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          );
          const t = ws.find((w) => {
            const r = w.getBoundingClientRect();
            return r.left > 60 && r.top > 60;
          });
          if (!t) throw new Error("no section to drag");
          const r = t.getBoundingClientRect();
          return { x: r.left + 20, y: r.top + 20, id: t.id };
        });
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.down();
        // Sweep far up-left of the sheet origin.
        await page.mouse.move(Math.max(30, pt.x - 600), Math.max(30, pt.y - 400), {
          steps: 10,
        });
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(500);
        const st = await page.evaluate(() => {
          const ws = Array.from(
            document.querySelectorAll("#print-layout-wrapper .be-section-wrapper"),
          );
          return {
            minLeft: Math.min(...ws.map((w) => parseInt(w.style.left) || 0)),
            minTop: Math.min(...ws.map((w) => parseInt(w.style.top) || 0)),
            landedOrigin:
              ws.filter((w) => parseInt(w.style.left) === 0 && parseInt(w.style.top) === 0).length,
          };
        });
        assert.ok(
          st.minLeft >= 0 && st.minTop >= 0,
          "no wrapper sits at a negative coordinate",
        );
        await frame(page, "shots-phase3", "32-clamped-origin-drop.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  describe("phase 4 precision nudge + position inputs", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "4")) this.skip();
    });

    it("captures the selected section, the Position inputs, and a nudged delta", async function () {
      const page = await bootPage(ctx);
      try {
        // The properties tray is taller than the default 720px viewport and
        // its appended controls are clipped below the fold — use a taller
        // real viewport for this phase's captures.
        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.waitForTimeout(400);
        // Select a section through the real UI: hover reveals the action
        // bar, then click the 'Select Section for Editing' (🎯) button.
        const sel = await page.evaluate(() => {
          const container = document.getElementById("print-layout-wrapper");
          const ws = Array.from(
            container.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
          );
          const t = ws.find((w) => {
            const r = w.getBoundingClientRect();
            return r.left > 140 && r.top > 140;
          });
          if (!t) throw new Error("no section to select");
          const r = t.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: t.id };
        });
        await page.mouse.move(sel.x, sel.y);
        await page.waitForTimeout(600);
        const selBtn = page.locator(`#${sel.id} .be-select-section-button`).first();
        await selBtn.click({ timeout: 15000 });
        await page.waitForTimeout(500);
        const before = await page.evaluate(() => {
          const active = document.querySelector(".be-active-wrapper");
          return {
            active: !!active,
            left: active ? parseInt(active.style.left) : null,
            top: active ? parseInt(active.style.top) : null,
            posInputs: document.querySelectorAll(
              '#print-enhance-properties-panel input[data-be-pos]',
            ).length,
          };
        });
        assert.ok(before.active, "selection made the section active");
        assert.ok(before.posInputs >= 2, "Position X/Y inputs present in the panel");
        // Bring the Position row into the visible tray area, then compute
        // viewport-clamped DOM rects for the combined cells (identical clips
        // for both states). The full frame is captured in this same scroll
        // state so the disk extraction coordinates match exactly.
        await page
          .locator('#print-enhance-properties-panel input[data-be-pos="x"]')
          .scrollIntoViewIfNeeded()
          .catch(() => {});
        await page.waitForTimeout(300);
        const rects = await page.evaluate(() => {
          const active = document.querySelector(".be-active-wrapper");
          const x = document.querySelector(
            '#print-enhance-properties-panel input[data-be-pos="x"]',
          );
          const clamp = (r) => {
            const x0 = Math.max(0, r.left);
            const y0 = Math.max(0, r.top);
            const x1 = Math.min(window.innerWidth, r.right);
            const y1 = Math.min(window.innerHeight, r.bottom);
            return {
              x: x0,
              y: y0,
              width: Math.max(20, x1 - x0),
              height: Math.max(20, y1 - y0),
            };
          };
          const sec = active.getBoundingClientRect();
          const row =
            (x && x.closest(".be-prop-position")) || x || active;
          const rowR = row.getBoundingClientRect();
          const s = sec;
          const r0 = rowR;
          return {
            sec: clamp({
              left: s.left - 20,
              top: s.top - 20,
              right: s.right + 20,
              bottom: s.bottom + 20,
            }),
            row: clamp({
              left: r0.left - 12,
              top: r0.top - 12,
              right: r0.right + 12,
              bottom: r0.bottom + 12,
            }),
          };
        });
        await frame(page, "shots-phase4", "40-active-position-inputs.png");
        await combinedFromFrame(
          "40-active-position-inputs.png",
          "44-before-combined.png",
          rects.sec,
          rects.row,
        );
        console.log("[p4] before rects", JSON.stringify(rects));
        // Nudge 5px right + 3px down with arrow keys.
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => {
          const active = document.querySelector(".be-active-wrapper");
          const x = document.querySelector('#print-enhance-properties-panel input[data-be-pos="x"]');
          return {
            left: active ? parseInt(active.style.left) : null,
            top: active ? parseInt(active.style.top) : null,
            inputX: x ? x.value : null,
          };
        });
        assert.strictEqual(after.left, before.left + 5, "nudged +5px on X");
        assert.strictEqual(after.top, before.top + 3, "nudged +3px on Y");
        assert.strictEqual(parseInt(after.inputX), after.left, "X input synced to the DOM");
        await frame(page, "shots-phase4", "41-after-nudge.png");
        // Key presses can scroll the page — re-scroll and re-measure BOTH
        // regions before the after-state combined capture.
        await page
          .locator('#print-enhance-properties-panel input[data-be-pos="x"]')
          .scrollIntoViewIfNeeded()
          .catch(() => {});
        await page.waitForTimeout(300);
        const rects2 = await page.evaluate(() => {
          const active = document.querySelector(".be-active-wrapper");
          const x = document.querySelector(
            '#print-enhance-properties-panel input[data-be-pos="x"]',
          );
          const clamp = (r) => {
            const x0 = Math.max(0, r.left);
            const y0 = Math.max(0, r.top);
            const x1 = Math.min(window.innerWidth, r.right);
            const y1 = Math.min(window.innerHeight, r.bottom);
            return {
              x: x0,
              y: y0,
              width: Math.max(20, x1 - x0),
              height: Math.max(20, y1 - y0),
            };
          };
          const s = active.getBoundingClientRect();
          const row = (x && x.closest(".be-prop-position")) || x || active;
          const r0 = row.getBoundingClientRect();
          return {
            sec: clamp({
              left: s.left - 20,
              top: s.top - 20,
              right: s.right + 20,
              bottom: s.bottom + 20,
            }),
            row: clamp({
              left: r0.left - 12,
              top: r0.top - 12,
              right: r0.right + 12,
              bottom: r0.bottom + 12,
            }),
          };
        });
        await combinedFromFrame(
          "41-after-nudge.png",
          "45-after-combined.png",
          rects2.sec,
          rects2.row,
        );
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  describe("phase 5 layer reorder polish", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "5")) this.skip();
    });

    it("captures the resting chips, the custom ghost and the gold insertion marker", async function () {
      const page = await bootPage(ctx);
      try {
        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.waitForTimeout(400);
        // Resting chips in the SECTIONS content list.
        await frame(page, "shots-phase5", "50-chips-rest.png");
        // Drive a native-HTML5 reorder with synthetic DragEvents: dragstart on
        // a chip (custom ghost appears), dragover on the list (insertion
        // marker appears), capture, then dragend to clean up.
        const panel = page.locator("#print-enhance-layer-manager");
        await panel.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        const st = await page.evaluate(() => {
          const list = document.querySelector(".be-layer-content-list");
          const chips = Array.from(
            list.querySelectorAll(".be-layer-item-card, .be-layer-item-thumb"),
          );
          if (chips.length < 2) throw new Error("need >= 2 chips");
          const source = chips[0];
          const target = chips[1];
          const sr = source.getBoundingClientRect();
          const dt = new DataTransfer();
          const fire = (type, targetEl, x, y) => {
            const ev = new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              dataTransfer: dt,
            });
            targetEl.dispatchEvent(ev);
          };
          fire("dragstart", source, sr.left + 10, sr.top + 10);
          const box = target.getBoundingClientRect();
          fire("dragover", list, box.left + box.width / 2, box.bottom + 6);
          const state = {
            ghostCount: document.querySelectorAll(".be-layer-drag-ghost").length,
            markerCount: document.querySelectorAll(".be-layer-drop-marker").length,
            draggingCount: document.querySelectorAll(".be-layer-item-card.dragging, .be-layer-item-thumb.dragging").length,
          };
          return { state, sourceId: source.dataset.targetId };
        });
        assert.strictEqual(st.state.ghostCount, 1, "custom ghost chip present mid-drag");
        assert.strictEqual(st.state.markerCount, 1, "gold insertion marker present mid-drag");
        assert.strictEqual(st.state.draggingCount, 1, "source chip is the dragging element");
        // Full-viewport frame: the ghost now sits at the pointer (near the
        // first chip, inside the panel) and the list shows the marker.
        await frame(page, "shots-phase5", "51-reorder-ghost-marker.png");
        const listBox = await page
          .locator(".be-layer-content-list")
          .first()
          .boundingBox();
        assert.ok(listBox, "content list visible");
        // Dedicated ghost zoom: exact DOM rect of the floating ghost chip.
        const ghostBox = await page.evaluate(() => {
          const g = document.querySelector(".be-layer-drag-ghost");
          if (!g) return null;
          const r = g.getBoundingClientRect();
          return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
        });
        assert.ok(ghostBox, "ghost rect measurable");
        const ghostClip = await page.evaluate(
          ({ cx, cy }) => {
            const hw = 150;
            const hh = 70;
            const x0 = Math.max(0, cx - hw);
            const y0 = Math.max(0, cy - hh);
            return {
              x: x0,
              y: y0,
              width: Math.min(window.innerWidth - x0, hw * 2),
              height: Math.min(window.innerHeight - y0, hh * 2),
            };
          },
          ghostBox,
        );
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase5", "54-zoom-ghost.png"),
          clip: ghostClip,
        });
        // Dedicated marker zoom: exact DOM rect of the gold insertion marker.
        const markerBox = await page.evaluate(() => {
          const m = document.querySelector(".be-layer-drop-marker");
          if (!m) return null;
          const r = m.getBoundingClientRect();
          return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
        });
        assert.ok(markerBox, "marker rect measurable");
        const markerClip = await page.evaluate(
          ({ cx, cy }) => {
            const hw = 110;
            const hh = 60;
            const x0 = Math.max(0, cx - hw);
            const y0 = Math.max(0, cy - hh);
            return {
              x: x0,
              y: y0,
              width: Math.min(window.innerWidth - x0, hw * 2),
              height: Math.min(window.innerHeight - y0, hh * 2),
            };
          },
          markerBox,
        );
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase5", "53-zoom-marker.png"),
          clip: markerClip,
        });
        const listClip = await page.evaluate(
          ({ x, y, w, h, pad }) => {
            const x0 = Math.max(0, x - pad);
            const y0 = Math.max(0, y - pad);
            return {
              x: x0,
              y: y0,
              width: Math.min(window.innerWidth - x0, w + 2 * pad),
              height: Math.min(window.innerHeight - y0, h + 2 * pad),
            };
          },
          { x: listBox.x, y: listBox.y, w: listBox.width, h: listBox.height, pad: 18 },
        );
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase5", "52-zoom-list-marker.png"),
          clip: listClip,
        });
        // Cleanup via dragend.
        await page.evaluate(() => {
          const source = document.querySelector(".dragging");
          if (source) {
            source.dispatchEvent(
              new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer: new DataTransfer(),
              }),
            );
          }
        });
        await page.waitForTimeout(300);
        const clean = await page.evaluate(() => ({
          ghost: document.querySelectorAll(".be-layer-drag-ghost").length,
          marker: document.querySelectorAll(".be-layer-drop-marker").length,
        }));
        assert.strictEqual(clean.ghost, 0, "ghost removed on dragend");
        assert.strictEqual(clean.marker, 0, "marker removed on dragend");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
});

// Export helpers for the per-phase visual-gate specs.
module.exports = { ART_ROOT, CAPTURING, PHASE, frame, dragByPointer, combinedFromFrame };

/**
 * Build a combined cell by extracting two regions from an already-captured
 * full-page frame (same coordinate space — no live-clip constraints).
 */
async function combinedFromFrame(frameName, outName, secRect, rowRect) {
  const dir = path.join(ART_ROOT, "shots-phase4");
  const src = sharp(path.join(dir, frameName));
  const meta = await src.metadata();
  const region = (r) => {
    const x = Math.max(0, Math.min(Math.round(r.x), meta.width - 1));
    const y = Math.max(0, Math.min(Math.round(r.y), meta.height - 1));
    const w = Math.max(1, Math.min(Math.round(r.width), meta.width - x));
    const h = Math.max(1, Math.min(Math.round(r.height), meta.height - y));
    return { left: x, top: y, width: w, height: h };
  };
  const sec = await sharp(path.join(dir, frameName))
    .extract(region(secRect))
    .png()
    .toBuffer();
  const row = await sharp(path.join(dir, frameName))
    .extract(region(rowRect))
    .png()
    .toBuffer();
  const m1 = await sharp(sec).metadata();
  const m2 = await sharp(row).metadata();
  const H = Math.max(m1.height, m2.height);
  const W = m1.width + m2.width + 16;
  fs.mkdirSync(dir, { recursive: true });
  await sharp({
    create: { width: W, height: H + 16, channels: 3, background: "#1a1a1a" },
  })
    .composite([
      { input: sec, left: 8, top: 8 },
      { input: row, left: 8 + m1.width + 8, top: 8 },
    ])
    .png()
    .toFile(path.join(dir, outName));
}
