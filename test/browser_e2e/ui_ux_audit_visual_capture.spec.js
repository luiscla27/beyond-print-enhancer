/**
 * UI/UX audit visual-gate capture harness (track ui_ux_review_20260910).
 *
 * Boots the unpacked MV3 extension on the demo sheet at 1440px and saves named
 * frames under docs/ui-ux-review-20260910/shots-phaseN/ for the per-phase
 * visual gates (spec.md AC-V1 / visual_gate_protocol.md).
 *
 * Gating (graceful-skip — a normal e2e run never captures and never fails):
 *   UI_UX_AUDIT_SHOTS=1        enable capturing
 *   UI_UX_AUDIT_PHASE=1|2      only run that phase's describe block
 *   UI_UX_AUDIT_SHOTS_DIR=...  override the artifact root
 *
 * Run:
 *   UI_UX_AUDIT_SHOTS=1 UI_UX_AUDIT_PHASE=1 npx mocha test/browser_e2e/ui_ux_audit_visual_capture.spec.js --timeout 900000
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
  flag: 'UI_UX_AUDIT_SHOTS',
  dirVar: 'UI_UX_AUDIT_SHOTS_DIR',
  defaultDir: 'docs/ui-ux-review-20260910',
  phaseVar: 'UI_UX_AUDIT_PHASE',
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

/** Clip a padded region around a selector (deterministic framing). */
async function clipAround(page, selector, phaseDir, name, pad = 24, scale = 1) {
  const dir = path.join(ART_ROOT, phaseDir);
  fs.mkdirSync(dir, { recursive: true });
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box, "no box for " + selector);
  const vs = page.viewportSize();
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const w = Math.min(Math.floor(box.width + pad * 2), vs.width - x);
  const h = Math.min(Math.floor(box.height + pad * 2), vs.height - y);
  const raw = path.join(dir, `_tmp-${name}`);
  await page.screenshot({ path: raw, clip: { x, y, width: w, height: h } });
  if (scale && scale !== 1) {
    const sharp = require("sharp");
    await sharp(raw).resize(w * scale, h * scale, { kernel: "lanczos3" }).png().toFile(path.join(dir, name));
    fs.unlinkSync(raw);
  } else {
    fs.renameSync(raw, path.join(dir, name));
  }
}


const { DEMO_URL } = require("./_helpers.js");

/**
 * Clear the extension's layout store on a raw page (no extension boot, so a
 * previously-corrupted profile cannot block readiness). The harness profile
 * persists across runs, so every capture starts from a known-empty store.
 */
async function clearLayouts(ctx) {
  const page = await ctx.newPage();
  try {
    await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(
      () =>
        new Promise((res) => {
          const req = indexedDB.open("DDBPrintEnhancerDB", 4);
          req.onsuccess = () => {
            const db = req.result;
            try {
              const tx = db.transaction(["layouts"], "readwrite");
              tx.objectStore("layouts").clear();
              tx.oncomplete = tx.onerror = tx.onabort = () => res();
            } catch {
              res();
            }
          };
          req.onerror = () => res();
        }),
    );
  } catch {
    /* best effort */
  } finally {
    await page.close().catch(() => {});
  }
}

describe("UI/UX audit visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /* ---------------- phase 1 — trust primitive ---------------- */
  describe("phase 1 trust primitive", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) this.skip();
    });
    beforeEach(async function () {
      if (!CAPTURING || (PHASE && PHASE !== "1")) return;
      await clearLayouts(ctx);
    });

    it("captures the Reset confirm (backup copy, in-app dialog) + the restore-failure card", async function () {
      const page = await bootPage(ctx);
      try {
        // Open the Reset confirm by clicking Reset to Default in the panel.
        await domClick(page, "#print-enhance-controls button:has-text('Reset to Default')").catch(async () => {
          await page.evaluate(() => {
            const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
              (x) => (x.textContent || "").includes("Reset to Default"),
            );
            if (b) b.click();
          });
        });
        await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 30000 });
        await page.waitForTimeout(400);
        const modalState = await page.evaluate(() => {
          const m = document.querySelector(".be-modal");
          const ok = document.querySelector(".be-modal-ok");
          return {
            title: (m.querySelector("h3") || {}).textContent,
            body: (m.querySelector("p") || {}).textContent || "",
            ok: ok ? ok.textContent : null,
            role: m.getAttribute("role"),
            hasClose: !!m.querySelector(".be-modal-close"),
          };
        });
        assert.strictEqual(modalState.role, "dialog", "in-app dialog, not native confirm");
        assert.strictEqual(modalState.hasClose, true, "has a close affordance");
        assert.ok(/backup/i.test(modalState.body), "copy mentions the backup: " + modalState.body);
        assert.ok(/deletes your saved layout/.test(modalState.body), "copy names what is erased");
        assert.ok(/only way back/.test(modalState.body), "copy says it is unrecoverable otherwise");
        await clipAround(page, ".be-modal", "shots-phase1", "10-reset-confirm-backup.png", 16, 2);
        // Cancel closes the dialog (the autosave pause/resume contract itself
        // is asserted in test/unit/persistence_backup.test.js — content-script
        // globals are not reachable from the page's main world).
        // Close the dialog so the next frame starts clean. (Every close path —
        // confirm / cancel / Esc / backdrop / ✕ — is asserted in
        // test/unit/persistence_backup.test.js; only pixels are graded here.)
        await page.evaluate(() => {
          const c = document.querySelector(".be-modal-cancel");
          if (c) c.click();
        });
        await page.waitForTimeout(400);

      } finally {
        await page.close().catch(() => {});
      }
    });

    it("captures a success toast, then a REAL error toast from a failed backup write", async function () {
      const page = await bootPage(ctx);
      try {
        // Success: a real user action (Save to Browser) shows the info toast.
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Save to Browser"),
          );
          if (b) b.click();
        });
        await page.waitForSelector(".be-feedback", { timeout: 20000 });
        await page.waitForTimeout(500);
        const info = await page.evaluate(() => {
          const f = document.querySelector(".be-feedback");
          return { cls: f.className, role: f.getAttribute("role") };
        });
        assert.ok(/be-feedback-info/.test(info.cls), "info toast class: " + JSON.stringify(info));
        await frame(page, "shots-phase1", "12-success-toast.png");

        // Error: a REAL failure path — feed Load a file that is not a layout.
        const bad = path.join(ART_ROOT, "_bad_layout.json");
        fs.mkdirSync(ART_ROOT, { recursive: true });
        fs.writeFileSync(bad, JSON.stringify({ version: "1.5.0", nope: true }));
        const chooserP = page.waitForEvent("filechooser", { timeout: 20000 });
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => /(^|\s)Load(\s|$)/.test(x.textContent || ""),
          );
          if (b) b.click();
        });
        const chooser = await chooserP;
        await chooser.setFiles(bad);
        await page.waitForTimeout(1500);
        const err = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".be-feedback")).map((f) => ({
            cls: f.className,
            role: f.getAttribute("role"),
            text: f.textContent.trim().slice(0, 80),
          })),
        );
        const errorToast = err.find((f) => /be-feedback-error/.test(f.cls));
        assert.ok(errorToast, "typed error toast from a bad layout file: " + JSON.stringify(err));
        assert.strictEqual(errorToast.role, "alert", "error toast is announced");
        fs.unlinkSync(bad);
        await frame(page, "shots-phase1", "13-error-toast-vs-success.png");
      } finally {
        await page.close().catch(() => {});
      }
    });
  });

    it("captures the boot restore-failure card (corrupt saved layout, real boot path)", async function () {
      let page = await bootPage(ctx);
      try {
        // 1. Persist a real layout through the UI.
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("#print-enhance-controls button")).find(
            (x) => (x.textContent || "").includes("Save to Browser"),
          );
          if (b) b.click();
        });
        await page.waitForTimeout(1500);
        // 2. Corrupt the stored layout from the page origin, then 3. reload so
        //    the REAL boot restore path runs and fails (Edge 4).
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              const req = indexedDB.open("DDBPrintEnhancerDB", 4);
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction(["layouts"], "readwrite");
                const store = tx.objectStore("layouts");
                // Clear first: otherwise a valid character-specific record is
                // restored and the failure path never runs.
                store.clear();
                store.put({ characterId: "GLOBAL", version: "1.5.0", nope: true });
                tx.oncomplete = () => resolve();
                tx.onerror = tx.onabort = () => resolve();
              };
              req.onerror = () => resolve();
            }),
        );
        // The harness injects the extension on bootPage, so a reload would not
        // re-boot it: close this page and boot a FRESH one. IndexedDB is
        // per-origin, so the corrupted layout is still there.
        await page.close();
        page = await bootPage(ctx);
        await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 60000 });
        await page.waitForTimeout(600);
        const card = await page.evaluate(() => {
          const m = document.querySelector(".be-modal");
          if (!m) return null;
          return {
            title: (m.querySelector("h3") || {}).textContent || "",
            body: (m.querySelector("p") || {}).textContent || "",
            actions: Array.from(m.querySelectorAll("button")).map((b) => b.textContent.trim()),
            role: m.getAttribute("role"),
          };
        });
        assert.ok(card, "error card rendered on boot");
        assert.strictEqual(card.role, "alertdialog", "it is an alertdialog");
        assert.ok(/could not be loaded/i.test(card.body), "names the failure: " + card.body);
        assert.ok(/NOT overwritten/.test(card.body), "says the saved layout survives");
        assert.ok(
          card.actions.some((t) => /backup/i.test(t)) && card.actions.some((t) => /fresh|reset/i.test(t)),
          "offers recovery actions: " + JSON.stringify(card.actions),
        );
        const box = await page.locator(".be-modal").first().boundingBox();
        fs.mkdirSync(path.join(ART_ROOT, "shots-phase1"), { recursive: true });
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase1", "11-restore-failure-card.png"),
          clip: {
            x: Math.max(0, Math.floor(box.x - 16)),
            y: Math.max(0, Math.floor(box.y - 16)),
            width: Math.min(Math.floor(box.width + 32), page.viewportSize().width),
            height: Math.min(Math.floor(box.height + 32), page.viewportSize().height),
          },
        });
      } finally {
        await page.close().catch(() => {});
      }
    });
  /* ---------------- phase 2 — editor fixes ---------------- */
  describe("phase 2 editor fixes", function () {
    before(function () {
      if (!CAPTURING || (PHASE && PHASE !== "2")) this.skip();
    });

    it("captures a locked layer that stays reachable, and the themed rotation handle", async function () {
      const page = await bootPage(ctx);
      try {
        await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
        await page.waitForTimeout(1200);

        // Lock the default shapes layer through its own panel control.
        const locked = await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          const row = panel.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
          const lock = row && row.querySelector('button[title="Toggle Edit Mode"]');
          if (lock) lock.click();
          return !!lock;
        });
        assert.ok(locked, "lock control found");
        await page.waitForTimeout(700);

        // AC-5 measured on the real DOM: a locked layer must NOT be inert
        // (that was the U-7 root cause — an inline pointer-events:none made the
        // layer's own unlock/delete controls unreachable), it must be visibly
        // dimmed, and its move/resize/rotate affordances must be gone.
        // AC-5 measured on the real DOM. Note the layers live inside a fixed
        // editor overlay that is itself pointer-events:none (wrappers re-enable
        // it), so the contract is measured on the WRAPPER — the element the
        // user actually hovers — not on the layer container.
        const state = await page.evaluate(() => {
          const g = (el) => (el ? getComputedStyle(el) : null);
          const wrap = document.querySelector(".be-shape-wrapper, .be-section-wrapper");
          // The locked layer CONTAINER is inside the overlay (its own
          // pointer-events is none by design); the element the user hovers is
          // the wrapper inside it.
          const lockedWrap = document.querySelector(".be-layer-locked .be-section-wrapper");
          const rot = wrap ? wrap.querySelector(".be-rotation-handle") : null;
          const res = wrap ? wrap.querySelector(".print-section-resize-handle") : null;
          return {
            bodyLocked: document.body.className.split(/\s+/).filter((c) => c.startsWith("be-lock-")),
            layerLockedEls: document.querySelectorAll(".be-layer-locked").length,
            wrapPointerEvents: wrap ? g(wrap).pointerEvents : null,
            wrapOpacity: wrap ? g(wrap).opacity : null,
            lockedWrapPointerEvents: lockedWrap ? g(lockedWrap).pointerEvents : "no-locked-wrapper",
            rotationDisplay: rot ? g(rot).display : "absent",
            resizeDisplay: res ? g(res).display : "absent",
            actions: !!document.querySelector(".be-section-actions"),
          };
        });
        assert.ok(state.bodyLocked.length > 0, "a layer lock class is emitted: " + JSON.stringify(state.bodyLocked));
        assert.ok(state.layerLockedEls > 0, "the locked layer carries be-layer-locked");
        // the locked wrapper must stay hoverable, or its own controls are unreachable
        assert.notStrictEqual(
          state.lockedWrapPointerEvents,
          "none",
          "a locked wrapper stays interactive (controls reachable): " + JSON.stringify(state),
        );
        assert.strictEqual(state.wrapOpacity, "0.5", "locked state is cued by dimming");
        assert.ok(state.actions, "action bars still exist on the sheet");
        // The rotate handle is created on demand, so "absent" is equally fine;
        // the resize handle is always present and proves the CSS rule fires.
        assert.ok(
          state.rotationDisplay === "absent" || state.rotationDisplay === "none",
          "rotate affordance unavailable while locked: " + state.rotationDisplay,
        );
        assert.strictEqual(state.resizeDisplay, "none", "resize affordance disabled while locked");

        await frame(page, "shots-phase2", "20-locked-layer-reachable.png");

        // Themed rotation handle (AC-8/U-29). Two traps made this frame go
        // MISSING silently in the first pass, so both are now asserted:
        //   1. The handle is created on demand by a `be-rotate-click` listener
        //      registered per shape wrapper (main.js:1518, inside createShape)
        //      — so a `.be-shape-wrapper` must exist and be the event target.
        //   2. `body[class*="be-lock-"]` hides rotation handles with
        //      !important (print_styles.js:915). A per-layer lock emits
        //      `body.be-lock-<layerId>` (layer_manager.js:1178), so the layer
        //      must be genuinely unlocked first.
        // Previously a zero-size handle just skipped the screenshot
        // (`if (h && h.w > 0)`), which is how the gap went unnoticed.
        await page.evaluate(() => {
          const panel = document.getElementById("print-enhance-layer-manager");
          const row = panel.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
          const lock = row && row.querySelector('button[title="Toggle Edit Mode"]');
          if (lock) lock.click();
        });
        await page.waitForTimeout(700);
        const pre = await page.evaluate(() => ({
          bodyLocks: document.body.className.split(/\s+/).filter((c) => c.startsWith("be-lock-")),
          lockedLayers: document.querySelectorAll(".be-layer-locked").length,
          shapeWrappers: document.querySelectorAll(".be-shape-wrapper").length,
          rotateButtons: document.querySelectorAll(".be-shape-rotate").length,
        }));
        assert.strictEqual(
          pre.bodyLocks.length,
          0,
          "no body be-lock-* class remains before the reveal: " + JSON.stringify(pre),
        );
        assert.strictEqual(pre.lockedLayers, 0, "no layer stays locked before the reveal: " + JSON.stringify(pre));
        assert.ok(
          pre.shapeWrappers > 0,
          "a real .be-shape-wrapper exists (the be-rotate-click listener lives there): " + JSON.stringify(pre),
        );

        // Dispatch on the WRAPPER itself — the element that owns the listener.
        const shown = await page.evaluate(() => {
          const wrap = document.querySelector(".be-shape-wrapper");
          if (!wrap) return false;
          wrap.dispatchEvent(new CustomEvent("be-rotate-click", { bubbles: true }));
          return true;
        });
        await page.waitForTimeout(700);
        const h = await page.evaluate(() => {
          const el = document.querySelector(".be-shape-wrapper .be-rotation-handle");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            w: r.width,
            h: r.height,
            display: cs.display,
            border: cs.borderTopColor,
            background: cs.backgroundColor,
            hasPink: /rgb\(255,\s*0,\s*255\)/.test(cs.borderTopColor + cs.backgroundColor),
          };
        });
        assert.ok(shown, "shape wrapper found for the rotate reveal");
        assert.ok(h, "the be-rotate-click listener created the rotation handle: " + JSON.stringify(pre));
        assert.notStrictEqual(h.display, "none", "the handle is displayed, not suppressed: " + JSON.stringify(h));
        assert.ok(h.w > 0 && h.h > 0, "the handle has a real on-screen box: " + JSON.stringify(h));
        assert.strictEqual(h.hasPink, false, "themed handle, no debug hot-pink: " + JSON.stringify(h));
        const vs = page.viewportSize();
        const pad = 44;
        const x = Math.max(0, Math.floor(h.x - pad));
        const y = Math.max(0, Math.floor(h.y - pad));
        fs.mkdirSync(path.join(ART_ROOT, "shots-phase2"), { recursive: true });
        await page.screenshot({
          path: path.join(ART_ROOT, "shots-phase2", "21-themed-rotation-handle.png"),
          clip: {
            x,
            y,
            width: Math.min(Math.floor(h.w + pad * 2), vs.width - x),
            height: Math.min(Math.floor(h.h + pad * 2), vs.height - y),
          },
        });
      } finally {
        await page.close().catch(() => {});
      }
    });
  });
});

module.exports = { ART_ROOT, CAPTURING, PHASE, frame };
