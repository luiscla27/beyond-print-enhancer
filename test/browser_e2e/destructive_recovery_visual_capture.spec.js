/**
 * Destructive-recovery visual-gate capture harness (track
 * destructive_recovery_20260911, AC-V1), per the track's visual_gate_protocol.md.
 *
 * Phase 2 is the recovery UX, and the gate's whole question is whether a user can
 * tell, FROM THE PIXELS, that the action they just took can be reversed — and whether
 * the recovery surfaces read as the product's locked identity rather than as
 * something bolted on. Four states are captured at the protocol's pinned 1440x900
 * viewport (set explicitly — the context default is 1280x720):
 *
 *   20-undo-offer.png          the offer immediately after a destructive action
 *   21-after-undo.png          the same region once the undo has been used
 *   22-restore-entry.png       the restore surface, listing backups
 *   23-restore-empty-honest.png the same surface when there is nothing to restore
 *   recovery-probe.json        the live read of both surfaces: the offer's text/box,
 *                              the backup records, and the round-trip measurement
 *
 * Everything is driven through the REAL UI (the layer row's delete control, the
 * in-app confirm, the control-panel entry) — no product seams — because the claim
 * being gated is about what the user sees.
 *
 * Gating (graceful skip — a normal e2e run never captures and never fails):
 *   RECOVERY_SHOTS=1        enable capturing
 *   RECOVERY_SHOTS_DIR=...  override the artifact root
 *
 * Run:
 *   RECOVERY_SHOTS=1 npx mocha test/browser_e2e/destructive_recovery_visual_capture.spec.js \
 *     --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, contentCall } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'RECOVERY_SHOTS',
  dirVar: 'RECOVERY_SHOTS_DIR',
  defaultDir: 'vendor/docs/destructive-recovery-20260911',
  subdir: 'shots-phase2',
});
const CAPTURING = cap.enabled;
const SHOTS = cap.shots;
const VIEWPORT = cap.viewport;


async function frame(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name) });
  console.log("frame:", path.join("shots-phase2", name));
}

/** Read both recovery surfaces from the live DOM. */
const READ_RECOVERY = () => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  };
  const style = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
  const offer = document.querySelector(".be-feedback-undo");
  const undoBtn = document.querySelector(".be-feedback-undo-btn");
  const overlay = document.querySelector(".be-modal-overlay");
  const rows = Array.from(document.querySelectorAll(".be-restore-row"));
  return {
    offer: offer
      ? {
          present: true,
          text: offer.textContent.trim(),
          box: box(offer),
          background: style(offer, "backgroundColor"),
          undoButton: undoBtn
            ? {
                text: undoBtn.textContent.trim(),
                aria: undoBtn.getAttribute("aria-label"),
                box: box(undoBtn),
                background: style(undoBtn, "backgroundColor"),
                color: style(undoBtn, "color"),
                height: style(undoBtn, "height"),
              }
            : null,
          // Is the affordance ON SCREEN and not covered? (a scrolled-away or overlaid
          // control is discoverable only in theory)
          inViewport: (() => {
            const r = offer.getBoundingClientRect();
            return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
          })(),
        }
      : { present: false },
    restore: overlay
      ? {
          present: true,
          title: (document.querySelector(".be-modal h3") || {}).textContent || null,
          status: (document.querySelector(".be-restore-status") || {}).textContent || null,
          rowCount: rows.length,
          rows: rows.slice(0, 3).map((r) => ({
            what: (r.querySelector(".be-restore-what") || {}).textContent,
            when: (r.querySelector(".be-restore-when") || {}).textContent,
            control: (r.querySelector(".be-restore-apply") || {}).textContent,
          })),
          box: box(document.querySelector(".be-modal")),
          modalBackground: style(document.querySelector(".be-modal"), "backgroundColor"),
        }
      : { present: false },
  };
};

describe("Destructive-recovery visual captures (phase 2)", function () {
  this.timeout(900000);
  let ctx;
  const probe = {};

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    if (CAPTURING) {
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.writeFileSync(
        path.join(SHOTS, "recovery-probe.json"),
        JSON.stringify(probe, null, 2),
      );
      console.log("probe:", path.join("shots-phase2", "recovery-probe.json"));
    }
  });

  it("captures the undo offer, the undone state and the restore surfaces", async function () {
    const page = await bootPage(ctx);
    try {
      await page.setViewportSize(VIEWPORT);
      await page.waitForSelector("#print-enhance-layer-manager", { timeout: 30000 });
      await page.waitForTimeout(1500);
      probe.provenance = cap.provenance(page, "destructive_recovery_visual_capture.spec.js");

      /* 1 — a destructive action through the REAL UI, then the offer. */
      const deleted = await page.evaluate(() => {
        const row = Array.from(
          document.querySelectorAll(".be-layer-row"),
        ).find((r) => r.dataset.layerId && r.dataset.layerId.indexOf("shapes") === 0);
        if (!row) return null;
        const btn = row.querySelector(".be-delete-layer-btn");
        if (!btn) return null;
        const label = (row.querySelector("span") || {}).textContent;
        btn.click();
        return { layerId: row.dataset.layerId, label };
      });
      assert.ok(deleted, "a shape-layer row with a delete control exists");
      await page.waitForSelector(".be-modal-overlay .be-modal-ok", { timeout: 15000 });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        if (ok) ok.click();
      });
      await page.waitForSelector(".be-feedback-undo", { timeout: 15000 });
      await page.waitForTimeout(700);

      probe.afterDelete = await page.evaluate(READ_RECOVERY);
      assert.ok(
        probe.afterDelete.offer.present,
        "the undo offer must be on screen after a destructive action: " +
          JSON.stringify(probe.afterDelete.offer),
      );
      assert.ok(
        probe.afterDelete.offer.undoButton,
        "…with a control the user can press",
      );
      assert.ok(
        probe.afterDelete.offer.inViewport,
        "…fully inside the viewport (not scrolled off or clipped)",
      );
      await frame(page, "20-undo-offer.png");

      /* 2 — use the undo, then look again. */
      await page.evaluate(() => {
        const b = document.querySelector(".be-feedback-undo-btn");
        if (b) b.click();
      });
      await page.waitForTimeout(1200);
      probe.afterUndo = await page.evaluate(READ_RECOVERY);
      assert.strictEqual(
        probe.afterUndo.offer.present,
        false,
        "the offer is spent after the undo (it must not invite a second use)",
      );
      await frame(page, "21-after-undo.png");

      /* 3 — the control-panel restore entry, opened through the REAL button. */
      const opened = await page.evaluate(() => {
        const matches = Array.from(document.querySelectorAll("button")).filter(
          (b) => (b.textContent || "").trim().indexOf("Restore backup") === 0,
        );
        const btn = matches[0];
        const info = {
          matchCount: matches.length,
          labels: matches.map((b) => (b.textContent || "").trim().slice(0, 40)),
          inPanel: matches.map((b) => !!b.closest("#print-enhance-controls")),
          disabled: matches.map((b) => !!b.disabled),
        };
        if (!btn) return Object.assign({ clicked: false }, info);
        btn.click();
        return Object.assign({ clicked: true }, info);
      });
      probe.restoreEntryDebug = opened;
      assert.ok(
        opened.clicked,
        "the control panel's Restore-backup entry exists and was clicked: " +
          JSON.stringify(opened),
      );
      await page.waitForSelector(".be-modal-overlay .be-restore-status", { timeout: 15000 });
      await page.waitForTimeout(1200);
      probe.restorePopulated = await page.evaluate(READ_RECOVERY);
      probe.restoreOpenedDebug = await page.evaluate(() => ({
        overlay: !!document.querySelector(".be-modal-overlay"),
        status: (document.querySelector(".be-restore-status") || {}).textContent || null,
        title: (document.querySelector(".be-modal h3") || {}).textContent || null,
        toasts: document.querySelectorAll(".be-feedback").length,
      }));
      assert.ok(
        probe.restorePopulated.restore.present,
        "the restore surface opened from the control panel (not only from a load failure)",
      );
      assert.ok(
        probe.restorePopulated.restore.rowCount >= 1,
        "…listing at least the backup the delete just wrote: " +
          JSON.stringify(probe.restorePopulated.restore),
      );
      await frame(page, "22-restore-entry.png");

      /* 4 — the honest empty state is captured against a cleaned store. */
      await page.evaluate(() => {
        const close = document.querySelector(".be-modal-close");
        if (close) close.click();
      });
      await page.waitForTimeout(400);
      // Empty the store through the extension's own world: `page.evaluate` cannot see
      // `window.listBackups` (content-script globals are isolated), so this goes
      // through contentCall like every other product-seam probe in this project.
      probe.emptiedStore = await contentCall(ctx, "deleteAllBackups");
      assert.ok(
        probe.emptiedStore && probe.emptiedStore.leftCount === 0,
        "the store must be empty for the empty-state frame to be honest: " +
          JSON.stringify(probe.emptiedStore),
      );
      const reopened = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent || "").trim().indexOf("Restore backup") === 0,
        );
        if (!btn) return false;
        btn.click();
        return true;
      });
      assert.ok(reopened, "the entry can be reopened");
      await page.waitForSelector(".be-modal-overlay .be-restore-status", { timeout: 15000 });
      await page.waitForTimeout(900);
      probe.restoreEmpty = await page.evaluate(READ_RECOVERY);
      await frame(page, "23-restore-empty-honest.png");
    } finally {
      await page.close().catch(() => {});
    }
  });
});
