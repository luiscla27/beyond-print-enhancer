/**
 * Shape Layers PS UX visual-gate capture harness
 * (track shape_layer_ps_ux_20260909).
 *
 * Boots the unpacked MV3 extension on the demo sheet at 1440px and saves
 * named frames under vendor/docs/shape-layer-ps-ux-20260909/shots-phaseN/ for the
 * per-phase visual gates (spec.md AC-V1 / visual_gate_protocol.md).
 *
 * Gating (graceful-skip — a normal e2e run never captures and never fails):
 *   SHAPE_LAYER_PS_SHOTS=1   enable capturing (otherwise every test skips)
 *   SHAPE_LAYER_PS_PHASE=N   only run the describe block for phase N
 *   SHAPE_LAYER_PS_SHOTS_DIR=...  override the artifact root
 *
 * Interactions reuse the authoritative e2e selectors (shape_layer_management
 * spec file) + the panel's own selectors (#print-enhance-layer-manager,
 * .be-layer-row, .be-layer-item-thumb / .be-layer-item-card).
 *
 * Run:
 *   SHAPE_LAYER_PS_SHOTS=1 SHAPE_LAYER_PS_PHASE=0 npx mocha test/browser_e2e/shape_layer_ps_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, domClick } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'SHAPE_LAYER_PS_SHOTS',
  dirVar: 'SHAPE_LAYER_PS_SHOTS_DIR',
  defaultDir: 'vendor/docs/shape-layer-ps-ux-20260909',
  phaseVar: 'SHAPE_LAYER_PS_PHASE',
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

/** Panel state: layer rows + thumb/card chip counts (DOM truth). */
async function panelState(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("print-enhance-layer-manager");
    if (!panel) return null;
    const rows = Array.from(panel.querySelectorAll(".be-layer-row")).map((r) => ({
      id: r.dataset.layerId,
      label: (r.querySelector("span") || {}).textContent,
      active: r.classList.contains("be-active-layer"),
      locked: !!r.querySelector('button[title="Toggle Edit Mode"]') &&
        (r.querySelector('button[title="Toggle Edit Mode"]').dataset.state === "locked"),
    }));
    return {
      rows,
      thumbCount: panel.querySelectorAll(".be-layer-item-thumb").length,
      cardCount: panel.querySelectorAll(".be-layer-item-card").length,
      groups: panel.querySelectorAll(".be-layer-group").length,
      sectionsHeader: (() => {
        const h = panel.querySelector('.be-layer-section-header[data-group="sections"] span');
        return h ? h.textContent : null;
      })(),
      shapesHeader: (() => {
        const h = panel.querySelector('.be-layer-section-header[data-group="shapes"] span');
        return h ? h.textContent : null;
      })(),
    };
  });
}

describe("Shape Layers PS visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /* ---------------------- phase 0 — BEFORE state --------------------- */
  describe("phase 0 baseline (current panel)", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "0")) this.skip();
    });

    it("captures the layer panel with the default giant shape layer", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(1200);
        const s = await panelState(page);
        assert.ok(s && s.rows.length >= 1, "panel has layer rows");
        await frame(page, "shots-before", "00-layer-panel-default.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a newly added (empty, unnamed) shape layer row", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(600);
        await domClick(page, "#print-enhance-add-layer");
        await page.waitForTimeout(800);
        const s = await panelState(page);
        assert.ok(s && s.rows.length >= 2, "second layer row present");
        await frame(page, "shots-before", "01-layer-panel-new-empty-layer.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  /* ---------------------- phase 2 — split & move ---------------------- */
  describe("phase 2 split/move flows", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "2")) this.skip();
    });

    const rectShot = async (page, name, rect) => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(ART_ROOT, "shots-phase2");
      fs.mkdirSync(dir, { recursive: true });
      const vw = page.viewportSize().width;
      const vh = page.viewportSize().height;
      const x = Math.max(0, Math.floor(rect.x - 12));
      const y = Math.max(0, Math.floor(rect.y - 12));
      const w = Math.min(Math.floor(rect.w + 24), vw - x);
      const h = Math.min(Math.floor(rect.h + 24), vh - y);
      assert.ok(w > 40 && h > 40, `clip for ${name} in viewport`);
      await page.screenshot({
        path: path.join(dir, name),
        clip: { x, y, width: w, height: h },
      });
    };

    it("captures the chip context menu + the split result (zoomed)", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(1200);
        // right-click the FIRST shape chip
        await page.evaluate(() => {
          const thumb = document.querySelector(".be-layer-item-thumb");
          const r = thumb.getBoundingClientRect();
          thumb.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, clientX: r.x + 8, clientY: r.y + 8 }),
          );
        });
        await page.waitForTimeout(300);
        const menuRect = await page.evaluate(() => {
          const m = document.getElementById("print-enhance-context-menu");
          if (!m) return null;
          const r = m.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, inDom: true, vw: window.innerWidth, vh: window.innerHeight };
        });
        assert.ok(menuRect && menuRect.inDom, "context menu present");
        console.log("DIAG menuRect:", JSON.stringify(menuRect));
        const menuTexts = await page.evaluate(() =>
          Array.from(document.querySelectorAll("#print-enhance-context-menu .be-context-menu-item"))
            .map((e) => e.textContent),
        );
        assert.ok(menuTexts.includes("Move to New Layer…"), "menu has move-to-new: " + JSON.stringify(menuTexts));
        assert.ok(menuTexts.includes("Move to Layer…"));
        assert.ok(menuTexts.includes("Delete"));
        // Cell 20: tight zoom on the open menu so its items read at scale.
        await rectShot(page, "20-chip-context-menu.png", menuRect);

        // Choose Move to New Layer → a new layer is split out with the shape
        await page.evaluate(() => {
          const it = Array.from(document.querySelectorAll("#print-enhance-context-menu .be-context-menu-item"))
            .find((e) => e.textContent === "Move to New Layer…");
          if (it) it.click();
        });
        await page.waitForTimeout(900);
        const rows = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          return Array.from(panel.querySelectorAll(".be-layer-row")).map((r) => ({
            id: r.dataset.layerId,
            label: (r.querySelector("span") || {}).textContent,
            badge: (r.querySelector(".be-layer-count") || {}).textContent,
            active: r.classList.contains("be-active-layer"),
          }));
        });
        const shapeRow = rows.find((r) => r.id !== "sections" && r.id !== "shapes-default");
        assert.ok(shapeRow && parseInt(shapeRow.badge, 10) >= 1, "split row holds the shape: " + JSON.stringify(rows));
        assert.strictEqual(shapeRow.active, true, "new layer active");
        // Collapse the default layer's strip so the split row + its badge
        // read clearly (harness framing only).
        await page.evaluate((id) => {
          const panel = document.getElementById("print-enhance-layer-manager");
          Array.from(panel.querySelectorAll(".be-layer-group")).forEach((g) => {
            const row = g.querySelector(".be-layer-row");
            if (!row || (row.dataset.layerId !== id && row.dataset.layerId !== "sections")) {
              g.style.display = "none";
            }
          });
          // Keep the sections header out of the frame to reduce noise.
          const secHead = panel.querySelector('.be-layer-section-header[data-group="sections"]');
          if (secHead) secHead.style.display = "none";
        }, shapeRow.id);
        await page.waitForTimeout(250);
        const panelRect = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          const r = panel.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        // Cell 21: the whole panel now dominated by the split row (Sections
        // pinned + the new named layer).
        await rectShot(page, "21-split-new-layer.png", panelRect);
        // Cell 22: the split layer GROUP alone (row + strip with the moved
        // chip) — proves one clean named row, no duplicates.
        const groupRect = await page.evaluate((id) => {
          const g = Array.from(
            document.querySelectorAll("#print-enhance-layer-manager .be-layer-group"),
          ).find((gr) => {
            const row = gr.querySelector(".be-layer-row");
            return row && row.dataset.layerId === id;
          });
          if (!g) return null;
          g.style.outline = "2px solid #C6A15B";
          const r = g.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }, shapeRow.id);
        await rectShot(page, "22-split-layer-zoom.png", groupRect);
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  describe("phase 1 identity + counts + empty affordance", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) this.skip();
    });

    it("captures the default layer with captioned chips + a live count badge", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(1500);
        const s = await panelState(page);
        assert.ok(s && s.thumbCount >= 5, "shape chips present");
        const names = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".be-layer-chip-name")).map((n) => n.textContent.trim()),
        );
        assert.ok(names.length >= 5, "chips carry captions: " + JSON.stringify(names.slice(0, 4)));
        assert.ok(names.every((n) => !/\.webp/.test(n) && n.length > 0), "no filename-only captions");
        // badges: each shape row shows a live count > 0 for the populated default
        const badges = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".be-layer-row .be-layer-count")).map((b) => b.textContent),
        );
        assert.ok(badges.some((b) => parseInt(b, 10) > 0), "live count badges: " + JSON.stringify(badges));
        await frame(page, "shots-phase1", "10-captioned-chips-counts.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a renamed layer + an empty layer affordance", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(600);
        // add a second (empty) layer, then rename it through the input modal
        await domClick(page, "#print-enhance-add-layer");
        await page.waitForTimeout(600);
        const added = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"));
          const last = rows[rows.length - 1];
          const label = last.querySelector("span");
          if (label) label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
          return last ? last.dataset.layerId : null;
        });
        await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
        await page.fill(".be-modal-overlay input", "Gold Dividers");
        await page.evaluate(() => {
          const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find((b) => b.textContent.trim() === "OK");
          if (ok) ok.click();
        });
        await page.waitForTimeout(700);
        const st = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"));
          const last = rows[rows.length - 1];
          const label = last && last.querySelector("span");
          const list = last && last.parentElement && last.parentElement.querySelector(".be-layer-content-list");
          return {
            label: label ? label.textContent : null,
            emptyText: list ? list.textContent.trim() : null,
            badge: last ? last.querySelector(".be-layer-count").textContent : null,
          };
        });
        assert.strictEqual(st.label, "Gold Dividers", "renamed through the input modal");
        assert.ok(/drag a shape here/.test(st.emptyText), "empty affordance: " + st.emptyText);
        // Deterministic cell-3 capture: scroll the target group into view,
        // temporarily (harness-only) enlarge its empty strip + gold-highlight
        // the group so the reviewer can unambiguously identify it, then clip
        // to its rect. Product DOM text is untouched.
        const clip = await page.evaluate((id) => {
          // Harness-only framing: the fixed panel grows past the 720px
          // viewport with many chips, so collapse the OTHER groups/headers to
          // bring the target empty-layer group fully on-screen (product DOM
          // of the target group is untouched).
          Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-group")).forEach((gr) => {
            const row = gr.querySelector(".be-layer-row");
            if (!row || row.dataset.layerId !== id) gr.style.display = "none";
          });
          Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-section-header")).forEach(
            (h) => (h.style.display = "none"),
          );
          const g = Array.from(
            document.querySelectorAll("#print-enhance-layer-manager .be-layer-group"),
          ).find((gr) => {
            const row = gr.querySelector(".be-layer-row");
            return row && row.dataset.layerId === id;
          });
          if (!g) return null;
          g.style.outline = "2px solid #C6A15B";
          g.style.outlineOffset = "2px";
          const strip = g.querySelector(".be-layer-content-list");
          if (strip) strip.style.minHeight = "60px";
          const r = g.getBoundingClientRect();
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const x = Math.max(0, Math.floor(r.x - 8));
          const y = Math.max(0, Math.floor(r.y - 8));
          const w = Math.min(Math.floor(r.width + 16), vw - x);
          const h = Math.min(Math.floor(r.height + 16), vh - y);
          return w > 40 && h > 40 ? { x, y, w, h } : null;
        }, added);
        assert.ok(clip, "target group rect visible in the viewport");
        const fs = require("fs");
        const path = require("path");
        const dir = path.join(ART_ROOT, "shots-phase1");
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({
          path: path.join(dir, "12-empty-layer-row-zoom.png"),
          clip: { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: Math.round(clip.w), height: Math.round(clip.h) },
        });
        await page.evaluate((id) => {
          const g = Array.from(
            document.querySelectorAll("#print-enhance-layer-manager .be-layer-group"),
          ).find((gr) => {
            const row = gr.querySelector(".be-layer-row");
            return row && row.dataset.layerId === id;
          });
          if (g) g.style.outline = "";
        }, added);
        await frame(page, "shots-phase1", "11-renamed-layer-empty-affordance.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  /* ---------------------- phase 3 — flat stack restack ----------------- */
  describe("phase 3 layer-row restack", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "3")) this.skip();
    });

    it("captures a mid-row-drag (gold ghost + insertion marker) and the after-drop order", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(800);
        await domClick(page, "#print-enhance-add-layer");
        await page.waitForTimeout(700);
        await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"));
          const last = rows[rows.length - 1];
          const label = last.querySelector("span");
          label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        });
        await page.waitForSelector(".be-modal-overlay input", { timeout: 15000 });
        await page.fill(".be-modal-overlay input", "Top Layer");
        await page.evaluate(() => {
          const ok = Array.from(document.querySelectorAll(".be-modal-actions button")).find((b) => b.textContent.trim() === "OK");
          if (ok) ok.click();
        });
        await page.waitForTimeout(700);
        const rows = await page.evaluate(() =>
          Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"))
            .filter((r) => r.dataset.layerId !== "sections")
            .map((r) => r.dataset.layerId),
        );
        assert.ok(rows.length >= 2, "two shape rows to restack: " + JSON.stringify(rows));
        // Same-clip trio over the shape-row band (before / mid-drag / after).
        const clipInfo = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          Array.from(panel.querySelectorAll(".be-layer-content-list")).forEach((l) => {
            if (l.dataset.layer !== "sections") l.style.display = "none"; // rows only
          });
          const secHead = panel.querySelector('.be-layer-section-header[data-group="sections"]');
          if (secHead) secHead.style.display = "none";
          const rowsEls = Array.from(panel.querySelectorAll(".be-layer-row")).filter(
            (r) => r.dataset.layerId !== "sections",
          );
          const rs = rowsEls.map((r) => r.getBoundingClientRect());
          const left = Math.min(...rs.map((r) => r.left));
          const top = Math.min(...rs.map((r) => r.top));
          const right = Math.max(...rs.map((r) => r.right));
          const bottom = Math.max(...rs.map((r) => r.bottom));
          return { x: left, y: top, w: right - left, h: bottom - top };
        });
        const fs = require("fs");
        const path = require("path");
        const dir = path.join(ART_ROOT, "shots-phase3");
        fs.mkdirSync(dir, { recursive: true });
        const shot = async (name) => {
          const x = Math.max(0, Math.floor(clipInfo.x - 12));
          const y = Math.max(0, Math.floor(clipInfo.y - 14));
          const w = Math.min(Math.floor(clipInfo.w + 24), page.viewportSize().width - x);
          const h = Math.min(Math.floor(clipInfo.h + 30), page.viewportSize().height - y);
          await page.screenshot({ path: path.join(dir, name), clip: { x, y, width: w, height: h } });
        };
        // cell 29 — clean BEFORE order (no drag armed yet), same clip.
        await shot("29-order-before.png");
        // Arm the drag with the GHOST OFFSET to the left of the row band (so it
        // never covers the insertion marker), then hover the drop slot.
        const armed = await page.evaluate(
          ({ sourceId, destId }) => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const rowOf = (id) => panel.querySelector(`.be-layer-row[data-layer-id="${id}"]`);
            const groupOf = (id) =>
              Array.from(panel.querySelectorAll(".be-layer-group")).find((g) => {
                const r = g.querySelector(".be-layer-row");
                return r && r.dataset.layerId === id;
              });
            const source = rowOf(sourceId);
            const destGroup = groupOf(destId);
            if (!source || !destGroup) return false;
            const dr = destGroup.getBoundingClientRect();
            const dt = new DataTransfer();
            // ghost placed well to the LEFT of the panel so the gold insertion
            // marker at the drop slot stays visible in the same crop.
            source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: Math.max(0, dr.left - 220), clientY: dr.top + 10 }));
            destGroup.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientX: dr.left + 10, clientY: dr.top + 4 }));
            return true;
          },
          { sourceId: rows[rows.length - 1], destId: rows[0] },
        );
        assert.ok(armed, "row drag armed");
        await page.waitForTimeout(250);
        const midState = await page.evaluate(() => ({
          ghost: !!document.querySelector(".be-layer-drag-ghost"),
          marker: !!document.querySelector(".be-layer-drop-marker"),
          draggingRow: !!document.querySelector(".be-layer-row.dragging"),
        }));
        assert.ok(midState.ghost && midState.marker && midState.draggingRow, "ghost + marker + dragging row");
        await shot("30-row-drag-ghost-marker.png");
        await page.evaluate(
          ({ destId }) => {
            const panel = document.getElementById("print-enhance-layer-manager");
            const groupOf = (id) =>
              Array.from(panel.querySelectorAll(".be-layer-group")).find((g) => {
                const r = g.querySelector(".be-layer-row");
                return r && r.dataset.layerId === id;
              });
            const g = groupOf(destId);
            const dr = g.getBoundingClientRect();
            const src = panel.querySelector(".be-layer-row.dragging");
            g.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: dr.left + 10, clientY: dr.top + 4 }));
            if (src) src.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true }));
          },
          { destId: rows[0] },
        );
        await page.waitForTimeout(900);
        const order = await page.evaluate(() =>
          Array.from(document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"))
            .filter((r) => r.dataset.layerId !== "sections")
            .map((r) => r.dataset.layerId),
        );
        const expected = [rows[rows.length - 1], rows[0]].concat(rows.slice(1, -1));
        assert.strictEqual(JSON.stringify(order), JSON.stringify(expected), "row moved above the first: " + JSON.stringify(order));
        // cell 31 — order AFTER the drop. The drop rebuilds the panel, so
        // re-hide the non-sections strips and re-measure the row band first
        // (otherwise the empty layer's strip pushes the next row out of crop).
        const afterClip = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          Array.from(panel.querySelectorAll(".be-layer-content-list")).forEach((l) => {
            if (l.dataset.layer !== "sections") l.style.display = "none";
          });
          const secHead = panel.querySelector('.be-layer-section-header[data-group="sections"]');
          if (secHead) secHead.style.display = "none";
          const rowsEls = Array.from(panel.querySelectorAll(".be-layer-row")).filter(
            (r) => r.dataset.layerId !== "sections",
          );
          const rs = rowsEls.map((r) => r.getBoundingClientRect());
          const left = Math.min(...rs.map((r) => r.left));
          const top = Math.min(...rs.map((r) => r.top));
          const right = Math.max(...rs.map((r) => r.right));
          const bottom = Math.max(...rs.map((r) => r.bottom));
          return {
            x: left, y: top, w: right - left, h: bottom - top,
            rows: rowsEls.map((r) => ({
              id: r.dataset.layerId,
              label: (r.querySelector("span") || {}).textContent,
              badge: (r.querySelector(".be-layer-count") || {}).textContent,
            })),
          };
        });
        const shotWith = async (name, info, scale) => {
          const x = Math.max(0, Math.floor(info.x - 12));
          const y = Math.max(0, Math.floor(info.y - 14));
          const w = Math.min(Math.floor(info.w + 24), page.viewportSize().width - x);
          const h = Math.min(Math.floor(info.h + 30), page.viewportSize().height - y);
          const raw = path.join(dir, `_tmp-${name}`);
          await page.screenshot({ path: raw, clip: { x, y, width: w, height: h } });
          if (scale && scale !== 1) {
            const sharp = require("sharp");
            await sharp(raw).resize(w * scale, h * scale, { kernel: "lanczos3" }).png().toFile(path.join(dir, name));
            fs.unlinkSync(raw);
          } else {
            fs.renameSync(raw, path.join(dir, name));
          }
        };
        await shotWith("31-after-drop-order.png", afterClip, 1);
        // cell 32 — 3x upscale of the post-drop row band (legible labels+badges)
        await shotWith("32-after-drop-rows-3x.png", afterClip, 3);
        // sanity (DOM truth): the default layer keeps its content after restack
        assert.ok(
          afterClip.rows.some((r) => r.id === "shapes-default" && parseInt(r.badge, 10) >= 5),
          "default layer content preserved after restack: " + JSON.stringify(afterClip.rows),
        );
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

  /* ---------------------- phase 4 — multi-select + batch --------------- */
  describe("phase 4 chip multi-select + batch", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "4")) this.skip();
    });

    it("captures multi-selected chips, the batch menu, and a split-each result", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(1200);
        // ctrl-click the first three shape chips to build a selection
        const sel = await page.evaluate(() => {
          const chips = Array.from(document.querySelectorAll(".be-layer-item-thumb")).slice(0, 3);
          chips.forEach((c) => c.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })));
          return chips.map((c) => c.dataset.targetId);
        });
        assert.strictEqual(sel.length, 3, "three chips selected");
        await page.waitForTimeout(300);
        const selCount = await page.evaluate(
          () => document.querySelectorAll(".be-layer-item-thumb.be-chip-selected").length,
        );
        assert.strictEqual(selCount, 3, "three chips carry the selection ring");
        // tight clip over the selected chip band
        const chipRect = await page.evaluate(() => {
          const chips = Array.from(document.querySelectorAll(".be-layer-item-thumb.be-chip-selected"));
          const rs = chips.map((c) => c.getBoundingClientRect());
          const left = Math.min(...rs.map((r) => r.left));
          const top = Math.min(...rs.map((r) => r.top));
          const right = Math.max(...rs.map((r) => r.right));
          const bottom = Math.max(...rs.map((r) => r.bottom));
          return { x: left, y: top, w: right - left, h: bottom - top };
        });
        const fs = require("fs");
        const path = require("path");
        const dir = path.join(ART_ROOT, "shots-phase4");
        fs.mkdirSync(dir, { recursive: true });
        const clipShot = async (name, rect, scale) => {
          const x = Math.max(0, Math.floor(rect.x - 12));
          const y = Math.max(0, Math.floor(rect.y - 12));
          const w = Math.min(Math.floor(rect.w + 24), page.viewportSize().width - x);
          const h = Math.min(Math.floor(rect.h + 24), page.viewportSize().height - y);
          const raw = path.join(dir, `_tmp-${name}`);
          await page.screenshot({ path: raw, clip: { x, y, width: w, height: h } });
          if (scale && scale !== 1) {
            const sharp = require("sharp");
            await sharp(raw).resize(w * scale, h * scale, { kernel: "lanczos3" }).png().toFile(path.join(dir, name));
            fs.unlinkSync(raw);
          } else {
            fs.renameSync(raw, path.join(dir, name));
          }
        };
        await clipShot("40-multi-selected-chips.png", chipRect, 3);
        // open the context menu on a selected chip → BATCH menu
        const menuRect = await page.evaluate((id) => {
          const chip = document.querySelector(`.be-layer-item-thumb[data-target-id="${id}"]`);
          const r = chip.getBoundingClientRect();
          chip.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.x + 8, clientY: r.y + 8 }));
          const m = document.getElementById("print-enhance-context-menu");
          if (!m) return null;
          const mr = m.getBoundingClientRect();
          return { x: mr.x, y: mr.y, w: mr.width, h: mr.height };
        }, sel[0]);
        assert.ok(menuRect, "batch menu opened");
        await page.waitForTimeout(250);
        const menuTexts = await page.evaluate(() =>
          Array.from(document.querySelectorAll("#print-enhance-context-menu .be-context-menu-item")).map((e) => e.textContent),
        );
        assert.ok(menuTexts.some((t) => /Split 3 into their own layers/.test(t)), "batch menu: " + JSON.stringify(menuTexts));
        await clipShot("41-batch-menu.png", menuRect, 2);
        // run split-each and capture the resulting layer rows
        await page.evaluate(() => {
          const it = Array.from(document.querySelectorAll("#print-enhance-context-menu .be-context-menu-item"))
            .find((e) => /Split 3 into their own layers/.test(e.textContent));
          if (it) it.click();
        });
        await page.waitForTimeout(900);
        const state = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          return Array.from(panel.querySelectorAll(".be-layer-row")).map((r) => ({
            id: r.dataset.layerId,
            label: (r.querySelector("span") || {}).textContent,
            badge: (r.querySelector(".be-layer-count") || {}).textContent,
          }));
        });
        const splitRows = state.filter((r) => r.id !== "sections" && r.id !== "shapes-default");
        assert.ok(splitRows.length >= 3, "three split layers created: " + JSON.stringify(state));
        // collapse strips + hide sections so the new layer rows read cleanly
        const bandRect = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          Array.from(panel.querySelectorAll(".be-layer-content-list")).forEach((l) => {
            if (l.dataset.layer !== "sections") l.style.display = "none";
          });
          const head = panel.querySelector('.be-layer-section-header[data-group="sections"]');
          if (head) head.style.display = "none";
          const rowsEls = Array.from(panel.querySelectorAll(".be-layer-row")).filter((r) => r.dataset.layerId !== "sections");
          const rs = rowsEls.map((r) => r.getBoundingClientRect());
          const left = Math.min(...rs.map((r) => r.left));
          const top = Math.min(...rs.map((r) => r.top));
          const right = Math.max(...rs.map((r) => r.right));
          const bottom = Math.max(...rs.map((r) => r.bottom));
          return { x: left, y: top, w: right - left, h: bottom - top };
        });
        await page.waitForTimeout(200);
        await clipShot("42-split-each-layers.png", bandRect, 2);
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
});

module.exports = { ART_ROOT, CAPTURING, PHASE, frame, panelState };
