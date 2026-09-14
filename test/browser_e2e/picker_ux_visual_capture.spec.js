/**
 * Border/Shape Picker UX visual-gate capture harness
 * (track border_shape_picker_ux_20260909).
 *
 * Boots the unpacked MV3 extension on the demo sheet at 1440px and saves
 * named frames under docs/border-shape-picker-ux-20260909/shots-phaseN/ for
 * the per-phase visual gates (spec.md AC-V1 / visual_gate_protocol.md).
 *
 * Gating (graceful-skip pattern — a normal `npm run test:e2e:*` run never
 * captures and never fails):
 *   PICKER_UX_SHOTS=1        enable capturing (otherwise every test skips)
 *   PICKER_UX_PHASE=N        only run the describe block for phase N
 *   PICKER_UX_SHOTS_DIR=...  override the artifact root (default
 *                            docs/border-shape-picker-ux-20260909)
 *
 * Interactions mirror the authoritative selectors of the existing e2e
 * suites (border_picker_base.spec.js, quick_switch_print.spec.js): section
 * and shape action bars live at `#id > .be-section-actions` with the ⋮
 * overflow opening `.be-context-menu` containing `.be-border-button` /
 * `.be-shape-switch`. Phase 0 captures the PRE-MERGE surfaces (the tabbed
 * shape picker and the separate 20-style section-border picker). Phase 1+
 * add describe blocks for the unified shell states as each phase lands.
 *
 * Run:
 *   PICKER_UX_SHOTS=1 PICKER_UX_PHASE=0 npx mocha test/browser_e2e/picker_ux_visual_capture.spec.js --timeout 900000
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
  flag: 'PICKER_UX_SHOTS',
  dirVar: 'PICKER_UX_SHOTS_DIR',
  defaultDir: 'docs/border-shape-picker-ux-20260909',
  phaseVar: 'PICKER_UX_PHASE',
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

/** Find the id of a section wrapper whose ⋮ menu carries a border button. */
async function findSectionWithBorderMenu(page) {
  return page.evaluate(() => {
    const w = Array.from(
      document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
    ).find((x) => {
      const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
      return m && m.querySelector(".be-border-button");
    });
    return w ? w.id : null;
  });
}

/** Find the id + asset of a shape wrapper whose ⋮ menu carries the switch. */
async function findShapeWithSwitchMenu(page) {
  return page.evaluate(() => {
    const ws = Array.from(document.querySelectorAll(".be-shape-wrapper"));
    const w = ws.find((x) => {
      const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
      return m && m.querySelector(".be-shape-switch");
    });
    if (!w) return null;
    const cont = w.querySelector(".be-shape-container");
    return { id: w.id, asset: cont ? cont.dataset.assetPath : null };
  });
}

describe("Picker UX visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /* ------------------------------------------------------------------ */
  /* Phase 0 — BEFORE-state (pre-merge surfaces)                         */
  /* ------------------------------------------------------------------ */
  describe("phase 0 baseline (two separate picker surfaces)", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "0")) this.skip();
    });

    it("captures the Add Shape modal — Borders/Shapes/Custom tabs (pre-merge tabs+tags grid)", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.waitForTimeout(600);
        await frame(page, "shots-before", "00-add-shape-modal-borders-tab.png");
        await page.evaluate(() => {
          const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
            (x) => x.textContent.trim() === "Shapes",
          );
          if (t) t.click();
        });
        await page.waitForTimeout(500);
        await frame(page, "shots-before", "01-add-shape-modal-shapes-tab.png");
        await page.evaluate(() => {
          const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
            (x) => x.textContent.trim() === "Custom",
          );
          if (t) t.click();
        });
        await page.waitForTimeout(400);
        await frame(page, "shots-before", "02-add-shape-modal-custom-tab.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the separate Select Section Border modal (20 hard-coded styles)", async function () {
      const page = await bootPage(ctx);
      try {
        const secId = await findSectionWithBorderMenu(page);
        assert.ok(secId, "section with border menu not found");
        await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(300);
        await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(500);
        await frame(page, "shots-before", "03-section-border-modal.png");
        // Close (Escape) so the next capture in a fresh page is unaffected.
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the Switch Shape Asset picker (pre-filtered to Shapes)", async function () {
      const page = await bootPage(ctx);
      try {
        const shp = await findShapeWithSwitchMenu(page);
        assert.ok(shp, "shape with switch menu not found");
        await domClick(page, `#${shp.id} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(300);
        await domClick(page, `#${shp.id} > .be-section-actions > .be-context-menu > .be-shape-switch`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(500);
        await frame(page, "shots-before", "04-switch-shape-asset-picker.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  /* ------------------------------------------------------------------ */
  /* Phase 1 — unified shell in all three modes (B-1)                    */
  /* ------------------------------------------------------------------ */
  describe("phase 1 unified shell (one picker, three modes)", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) this.skip();
    });

    it("captures style mode (Change Border Style → Section Styles surface)", async function () {
      const page = await bootPage(ctx);
      try {
        const secId = await findSectionWithBorderMenu(page);
        assert.ok(secId, "section with border menu not found");
        await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(300);
        await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(500);
        await frame(page, "shots-phase1", "10-style-mode-section-styles.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures switch mode (Switch Shape Asset → folder-filtered picker)", async function () {
      const page = await bootPage(ctx);
      try {
        const shp = await findShapeWithSwitchMenu(page);
        assert.ok(shp, "shape with switch menu not found");
        await domClick(page, `#${shp.id} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(300);
        await domClick(page, `#${shp.id} > .be-section-actions > .be-context-menu > .be-shape-switch`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(500);
        await frame(page, "shots-phase1", "11-switch-mode-shapes.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures add mode (Add Shape → Borders/Shapes/Custom tabs)", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.waitForTimeout(600);
        await frame(page, "shots-phase1", "12-add-mode-tabs.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  /* ------------------------------------------------------------------ */
  /* Phase 2 — per-flow copy + disabled-until-selection (B-2)            */
  /* ------------------------------------------------------------------ */
  describe("phase 2 mode-driven OK state (disabled → enabled)", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "2")) this.skip();
    });

    const clickOptionByText = async (page, text) => {
      await page.evaluate((txt) => {
        const o = Array.from(
          document.querySelectorAll(".be-modal-overlay .be-border-option"),
        ).find((x) => (x.textContent || "").includes(txt));
        if (o) o.click();
      }, text);
      await page.waitForTimeout(250);
    };

    it("captures style mode OK disabled at open + enabled after a different pick", async function () {
      const page = await bootPage(ctx);
      try {
        const secId = await findSectionWithBorderMenu(page);
        assert.ok(secId);
        await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(250);
        await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(400);
        // Verify the disabled state exists in the DOM, then frame it.
        const dis = await page.evaluate(() => {
          const ok = document.querySelector(".be-modal-actions .be-modal-ok");
          return { disabled: ok.disabled, verb: ok.textContent.trim() };
        });
        assert.strictEqual(dis.disabled, true, "style OK disabled at open");
        assert.strictEqual(dis.verb, "Apply Border Style");
        await frame(page, "shots-phase2", "20-style-ok-disabled.png");
        await clickOptionByText(page, "Goth");
        const en = await page.evaluate(() => {
          const ok = document.querySelector(".be-modal-actions .be-modal-ok");
          return ok.disabled;
        });
        assert.strictEqual(en, false, "style OK enabled after different pick");
        await frame(page, "shots-phase2", "21-style-ok-enabled.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures add mode OK disabled (no fabricated default) + enabled on first choice", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.waitForTimeout(400);
        const state0 = await page.evaluate(() => {
          const ok = document.querySelector(".be-modal-actions .be-modal-ok");
          return { disabled: ok.disabled, verb: ok.textContent.trim(), selected: !!document.querySelector(".be-border-option.selected") };
        });
        assert.strictEqual(state0.disabled, true, "add OK disabled at open");
        assert.strictEqual(state0.selected, false, "no fabricated preselection");
        await frame(page, "shots-phase2", "22-add-ok-disabled.png");
        // Zoom on the top-left tile at open: proves the ring the reviewer
        // saw in round 1 is the tile's border-frame ARTWORK, not a selection
        // ring (DOM: no .be-border-option.selected at open).
        const t0 = await page.evaluate(() => {
          const t = document.querySelectorAll(".be-modal-overlay .be-border-option")[0];
          const r = t.getBoundingClientRect();
          const ok = document.querySelector(".be-modal-actions .be-modal-ok");
          const o = ok.getBoundingClientRect();
          return {
            x: Math.max(0, r.left - 12),
            y: Math.max(0, r.top - 12),
            w: r.width + 24,
            h: r.height + 24,
            okRect: { x: o.x, y: o.y, w: o.width, h: o.height },
          };
        });
        const fs = require("fs");
        const path = require("path");
        fs.mkdirSync(path.join(ART_ROOT, "shots-phase2"), { recursive: true });
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase2", "26-add-open-tile-zoom.png"),
          clip: { x: t0.x, y: t0.y, width: t0.w, height: t0.h },
        });
        await page.evaluate(() => {
          document.querySelectorAll(".be-modal-overlay .be-border-option")[0].click();
        });
        await page.waitForTimeout(250);
        const en = await page.evaluate(() => document.querySelector(".be-modal-actions .be-modal-ok").disabled);
        assert.strictEqual(en, false, "add OK enabled after first choice");
        await frame(page, "shots-phase2", "23-add-ok-enabled.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures switch mode OK disabled at open (current preselected) + enabled on change", async function () {
      const page = await bootPage(ctx);
      try {
        const shp = await findShapeWithSwitchMenu(page);
        assert.ok(shp);
        await domClick(page, `#${shp.id} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(250);
        await domClick(page, `#${shp.id} > .be-section-actions > .be-context-menu > .be-shape-switch`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(400);
        const st0 = await page.evaluate(() => ({
          disabled: document.querySelector(".be-modal-actions .be-modal-ok").disabled,
          verb: document.querySelector(".be-modal-actions .be-modal-ok").textContent.trim(),
          selected: !!document.querySelector(".be-border-option.selected"),
        }));
        assert.strictEqual(st0.disabled, true, "switch OK disabled at open");
        assert.strictEqual(st0.selected, true, "current asset preselected");
        assert.strictEqual(st0.verb, "Switch Asset");
        await frame(page, "shots-phase2", "24-switch-ok-disabled.png");
        await page.evaluate(() => {
          const o = Array.from(document.querySelectorAll(".be-modal-overlay .be-border-option")).find((x) => !x.classList.contains("selected"));
          if (o) o.click();
        });
        await page.waitForTimeout(250);
        await frame(page, "shots-phase2", "25-switch-ok-enabled.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  /* ------------------------------------------------------------------ */
  /* Phase 3 — keyboard/cancel integrity + a11y (B-3)                    */
  /* ------------------------------------------------------------------ */
  describe("phase 3 keyboard/cancel + a11y states", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "3")) this.skip();
    });

    it("captures the style modal with its close ✕ affordance", async function () {
      const page = await bootPage(ctx);
      try {
        const secId = await findSectionWithBorderMenu(page);
        assert.ok(secId);
        await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(250);
        await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(400);
        const hasX = await page.evaluate(() => !!document.querySelector(".be-modal-close"));
        assert.strictEqual(hasX, true, "close ✕ present");
        await frame(page, "shots-phase3", "30-style-modal-close-x.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a keyboard-focused option cell with its visible focus ring", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.waitForTimeout(400);
        // Focus the first cell programmatically, then move with the keyboard
        // (ArrowRight) so Chromium applies :focus-visible (keyboard-driven
        // navigation) — the ring is the pixel under validation.
        await page.evaluate(() => {
          const c = document.querySelectorAll(
            ".be-modal-overlay .be-border-option",
          )[0];
          if (c) c.focus();
        });
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(150);
        const focused = await page.evaluate(() => {
          const ae = document.activeElement;
          return ae ? { isCell: ae.classList && ae.classList.contains("be-border-option"), cls: ae.className } : null;
        });
        assert.ok(focused && focused.isCell, "arrow-key navigation focuses an option cell");
        await frame(page, "shots-phase3", "31-keyboard-focused-cell-ring.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the sheet after Escape closes the modal (cancel path)", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.waitForTimeout(400);
        await frame(page, "shots-phase3", "32-before-esc-modal-open.png");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        const gone = await page.evaluate(() => !document.querySelector(".be-modal-overlay"));
        assert.strictEqual(gone, true, "Esc closed the modal");
        await frame(page, "shots-phase3", "33-after-esc-sheet.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  /* ------------------------------------------------------------------ */
  /* Phase 4 — curated names, groups, search (B-4)                       */
  /* ------------------------------------------------------------------ */
  describe("phase 4 grouped grid + live search", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "4")) this.skip();
    });

    it("captures the grouped Borders grid with family headers", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(500);
        const hs = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".be-asset-group")).map((h) => h.textContent.trim()),
        );
        assert.ok(hs.length > 1, "family headers present");
        await frame(page, "shots-phase4", "40-grouped-grid-headers.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a live search query mid-type on the Shapes tab", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.evaluate(() => {
          const t = Array.from(document.querySelectorAll(".be-modal-tab")).find(
            (x) => x.textContent.trim() === "Shapes",
          );
          if (t) t.click();
        });
        await page.waitForTimeout(400);
        await page.fill(".be-picker-search", "corner");
        await page.waitForTimeout(400);
        const n = await page.evaluate(() =>
          document.querySelectorAll(".be-modal-overlay .be-border-option").length,
        );
        assert.ok(n > 0 && n < 25, `search narrowed to ${n} cells`);
        await frame(page, "shots-phase4", "41-search-query.png");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the empty state for a no-match query", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay", { timeout: 20000 });
        await page.waitForTimeout(300);
        await page.fill(".be-picker-search", "zzzz-nope");
        await page.waitForTimeout(300);
        const empty = await page.evaluate(() =>
          /No shapes found/.test(document.querySelector(".be-border-options").textContent),
        );
        assert.strictEqual(empty, true, "empty state shown");
        await frame(page, "shots-phase4", "42-search-empty.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
  /* ------------------------------------------------------------------ */
  /* Phase 5 — live hover-swap try-it (B-5)                              */
  /* ------------------------------------------------------------------ */
  describe("phase 5 hover-swap preview frames", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "5")) this.skip();
    });

    const hoverCellByText = async (page, text) => {
      await page.evaluate((txt) => {
        const o = Array.from(
          document.querySelectorAll(".be-modal-overlay .be-border-option"),
        ).find((x) => (x.textContent || "").includes(txt));
        if (!o) throw new Error("hover cell not found: " + txt);
        o.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      }, text);
      await page.waitForTimeout(400);
    };
    const leaveCell = async (page) => {
      await page.evaluate(() => {
        const o = document.querySelector(
          ".be-modal-overlay .be-border-option:hover, .be-modal-overlay .be-border-option",
        );
        if (o) o.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
      });
      await page.waitForTimeout(300);
    };


    const disableScrim = async (page) => {
      // Test-harness-only visual neutralization for evidence frames: the
      // locked modal scrim (35-40% + 4px blur) is what hides the real target
      // from a reviewer. Product code is untouched; only the capture page's
      // computed overlay style is relaxed so the swap is legible.
      await page.evaluate(() => {
        const o = document.querySelector(".be-modal-overlay");
        if (o) {
          o.style.backdropFilter = "none";
          o.style.background = "rgba(0,0,0,0.04)";
        }
      });
      await page.waitForTimeout(120);
    };

    const findLeftSectionWithBorderMenu = async (page) => {
      const id = await page.evaluate(() => {
        const all = Array.from(
          document.querySelectorAll(".be-section-wrapper:not(.be-shape-wrapper)"),
        ).filter((x) => {
          const m = x.querySelector(":scope > .be-section-actions > .be-context-menu");
          return m && m.querySelector(".be-border-button");
        });
        for (const w of all) {
          const c = w.querySelector(".print-section-container");
          if (c) {
            const r = c.getBoundingClientRect();
            if (r.width > 80 && r.left < 300 && r.left >= 0) return w.id;
          }
        }
        const w = all[0];
        return w ? w.id : null;
      });
      assert.ok(id, "left-side section with border menu not found");
      return id;
    };

    // Fixed left-band clip (x ∈ [0, ~340]) so the SAME region is captured
    // before (no modal), during (modal open, scrim off) and after — framing
    // never shifts and the modal box never enters the frame.
    const leftBandShot = async (page, selector, name) => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(ART_ROOT, "shots-phase5");
      fs.mkdirSync(dir, { recursive: true });
      const box = await page.locator(selector).first().boundingBox();
      assert.ok(box && box.width > 40, "bbox for " + selector);
      const x = Math.max(0, Math.floor(box.x - 60));
      const y = Math.max(0, Math.floor(box.y - 60));
      const maxW = 340 - x;
      const w = Math.min(maxW, Math.floor(box.width + 120));
      const h = Math.min(Math.floor(box.height + 150), 360);
      await page.screenshot({
        path: path.join(dir, name),
        clip: { x, y, width: Math.max(40, w), height: Math.max(40, h) },
      });
    };

    it("captures a style-mode hover-swap on a real section + the restored state", async function () {
      const page = await bootPage(ctx);
      try {
        const secId = await findLeftSectionWithBorderMenu(page);
        const sel = `#${secId} .print-section-container`;
        await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
        }, sel);
        await page.waitForTimeout(300);
        // open style picker via the ⋮ menu
        await domClick(page, `#${secId} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(250);
        await domClick(page, `#${secId} > .be-section-actions > .be-context-menu > .be-border-button`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(300);
        await disableScrim(page);
        // Baseline BEFORE hover, under the SAME modal-open/scrim-off page
        // state so all three frames share one framing (reviewer Option C).
        await leftBandShot(page, sel, "50a-section-before.png");
        await hoverCellByText(page, "Goth");
        const applied = await page.evaluate((id) => {
          const s = document.getElementById(id).querySelector(".print-section-container");
          return {
            goth: s.classList.contains("goth_border"),
            marker: s.classList.contains("be-hover-preview"),
            outline: getComputedStyle(s).outlineStyle,
          };
        }, secId);
        assert.ok(applied.goth && applied.marker, "hover applied + marker on the real section");
        assert.strictEqual(applied.outline, "dashed", "try-it outline visible while hovering");
        await leftBandShot(page, sel, "50z-section-hover-goth.png");
        await leaveCell(page);
        const restored = await page.evaluate((id) => {
          const s = document.getElementById(id).querySelector(".print-section-container");
          return { goth: s.classList.contains("goth_border"), marker: s.classList.contains("be-hover-preview") };
        }, secId);
        assert.strictEqual(restored.goth, false, "hover style removed on leave");
        assert.strictEqual(restored.marker, false, "marker cleared");
        await leftBandShot(page, sel, "51z-section-restored.png");
        await page.keyboard.press("Escape");
      } finally {
        await page.close().catch(() => {});
      }
    });

    const bandShot = async (page, selector, name) => {
      const fs = require("fs");
      const path = require("path");
      const dir = path.join(ART_ROOT, "shots-phase5");
      fs.mkdirSync(dir, { recursive: true });
      const box = await page.locator(selector).first().boundingBox();
      assert.ok(box && box.width > 20, "bbox for " + selector);
      const cx = box.x + box.width / 2;
      const leftSide = cx < 330;
      const x0 = Math.max(0, Math.floor(box.x - 60));
      const x = leftSide ? x0 : Math.max(940 - 60, Math.floor(box.x - 60));
      const y = Math.max(0, Math.floor(box.y - 60));
      const w = Math.min(
        (leftSide ? 340 : 1280) - x,
        Math.floor(box.width + 120),
      );
      const h = Math.min(Math.floor(box.height + 140), 400);
      await page.screenshot({
        path: path.join(dir, name),
        clip: { x, y, width: Math.max(40, w), height: Math.max(40, h) },
      });
    };

    it("captures a switch-mode asset hover-swap on a real shape", async function () {
      const page = await bootPage(ctx);
      try {
        const shp = await findShapeWithSwitchMenu(page);
        assert.ok(shp);
        const sel = `#${shp.id} .be-shape-container`;
        await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
        }, sel);
        await page.waitForTimeout(300);
        await domClick(page, `#${shp.id} > .be-section-actions > .be-more-options-button`);
        await page.waitForTimeout(250);
        await domClick(page, `#${shp.id} > .be-section-actions > .be-context-menu > .be-shape-switch`);
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(300);
        // If the shape sits under the centered modal, move its wrapper into
        // the free left band for legible evidence frames (harness-only
        // repositioning — never persisted).
        await page.evaluate((id) => {
          const w = document.getElementById(id);
          const r = w.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          if (cx > 300 && cx < 980) {
            w.style.left = "30px";
            w.style.top = "300px";
          }
          // Harness-only: enlarge the shape so the asset swap is legible to
          // a reviewer at clip scale (never persisted).
          w.style.width = "200px";
          w.style.height = "200px";
          const c = w.querySelector(".be-shape-container");
          if (c) {
            c.style.width = "200px";
            c.style.height = "200px";
          }
        }, shp.id);
        await page.waitForTimeout(250);
        await disableScrim(page);
        // Baseline BEFORE hover (same modal-open/scrim-off state)
        await bandShot(page, sel, "52a-shape-before.png");
        // hover a DIFFERENT, visually distinct asset (avoid near-identical
        // family art so the swap is legible)
        await page.evaluate(() => {
          const cur = document.querySelector(".be-border-option.selected");
          const curTxt = cur ? cur.textContent : "";
          const opts = Array.from(
            document.querySelectorAll(".be-modal-overlay .be-border-option"),
          );
          const o =
            opts.find(
              (x) =>
                !x.classList.contains("selected") &&
                /spike|shield|dwarf|vine/i.test(x.textContent) &&
                x.textContent !== curTxt,
            ) ||
            opts.find((x) => !x.classList.contains("selected")) ||
            opts[opts.length - 1];
          o.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
        });
        await page.waitForTimeout(400);
        const state = await page.evaluate((id) => {
          const c = document.getElementById(id).querySelector(".be-shape-container");
          const img = c.querySelector("img.be-shape-asset");
          return {
            asset: c.dataset.assetPath,
            src: img ? img.getAttribute("src") : null,
            marker: c.classList.contains("be-hover-preview"),
          };
        }, shp.id);
        assert.ok(state.asset && state.asset !== "undefined", "asset dataset present");
        assert.ok(state.marker, "marker on the real shape");
        assert.ok(state.src && state.src.includes(state.asset), "rendered img follows the hovered asset");
        await bandShot(page, sel, "52z-shape-hover-swap.png");
        await page.evaluate(() => {
          const o = Array.from(
            document.querySelectorAll(".be-modal-overlay .be-border-option"),
          ).find((x) => x.classList.contains("be-hover-preview") || true);
          // leave the currently-hovered cell (any is fine — restore is
          // idempotent and terminal per preview cycle)
          if (o) o.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
        });
        await page.waitForTimeout(300);
        await bandShot(page, sel, "52c-shape-restored.png");
        await page.keyboard.press("Escape");
      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures the add-mode magnified hover strip (no sheet mutation)", async function () {
      const page = await bootPage(ctx);
      try {
        await domClick(page, "#be-btn-add-shape");
        await page.waitForSelector(".be-modal-overlay .be-border-option", { timeout: 20000 });
        await page.waitForTimeout(300);
        await page.evaluate(() => {
          const o = document.querySelectorAll(".be-modal-overlay .be-border-option")[2];
          o.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
        });
        await page.waitForTimeout(400);
        const strip = await page.evaluate(() => {
          const s = document.querySelector(".be-picker-hover-strip");
          return s ? { display: s.style.display, hasPreview: !!s.querySelector(".be-border-preview") } : null;
        });
        assert.ok(strip && strip.display === "flex" && strip.hasPreview, "strip shown with preview");
        await frame(page, "shots-phase5", "53-add-mode-strip.png");
        await page.keyboard.press("Escape");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
});

module.exports = { ART_ROOT, CAPTURING, PHASE, frame };
