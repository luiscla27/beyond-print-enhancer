/**
 * Modal-primitive visual-gate capture harness (track modal_primitive_20260910).
 *
 * Captures the MIGRATED dialogs and the UNTOUCHED ones in the same session and
 * at the same zoom, because the phase-1 visual question is a comparison: are the
 * migrated dialogs visually indistinguishable from the ones that were already
 * compliant, and does the new close ✕ read as part of the locked leather-and-gold
 * identity rather than a bolted-on control?
 *
 * It also probes the live DOM for the affordances per dialog (AC-2), so the gate
 * has machine evidence and not only photographs.
 *
 * Gating (graceful-skip — a normal e2e run never captures and never fails):
 *   MODAL_SHOTS=1              enable capturing
 *   MODAL_SHOTS_DIR=...        override the artifact root
 *
 * Run:
 *   MODAL_SHOTS=1 npx mocha test/browser_e2e/modal_primitive_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { captureHarness } = require("./_capture.js");

/**
 * The capture harness (track refactor_surface_20260911, Phase 6, AC-6): the enable flag, the
 * artifact root, the shots subdirectory, the pinned viewport and `cap.provenance()` come from
 * test/browser_e2e/_capture.js instead of being re-declared in this file. The names below are
 * destructured from it, so every artifact name and assertion in this spec is unchanged.
 */
const cap = captureHarness({
  flag: 'MODAL_SHOTS',
  dirVar: 'MODAL_SHOTS_DIR',
  defaultDir: 'docs/modal-primitive-20260910',
});
const ART_ROOT = cap.artRoot;
const CAPTURING = cap.enabled;

/** Bind an artifact to the revision + viewport that produced it. */

function writeJson(name, data) {
  fs.mkdirSync(ART_ROOT, { recursive: true });
  fs.writeFileSync(path.join(ART_ROOT, name), JSON.stringify(data, null, 2));
}

/** Screenshot the whole viewport (dialogs are centred and large; a clip would
 *  cut the backdrop, which is part of what the gate judges). */
async function frame(page, name) {
  fs.mkdirSync(ART_ROOT, { recursive: true });
  await page.screenshot({ path: path.join(ART_ROOT, name) });
  console.log("frame:", name);
}

/** The live affordance read of whichever dialog is currently open. */
const READ_DIALOG = () => {
  const overlay = document.querySelector(".be-modal-overlay") ||
    document.getElementById("print-enhance-overlay");
  if (!overlay) return null;
  const modal = overlay.querySelector(".be-modal");
  const labelledby = modal.getAttribute("aria-labelledby");
  const named = labelledby ? document.getElementById(labelledby) : null;
  const x = modal.querySelector(".be-modal-close");
  const xRect = x ? x.getBoundingClientRect() : null;
  const r = modal.getBoundingClientRect();
  return {
    role: modal.getAttribute("role"),
    ariaModal: modal.getAttribute("aria-modal"),
    ariaLabelledby: labelledby,
    accessibleName: named ? named.textContent.trim() : modal.getAttribute("aria-label"),
    closeButton: !!x,
    closeButtonLabel: x ? x.getAttribute("aria-label") : null,
    closeButtonSize: xRect ? { w: Math.round(xRect.width), h: Math.round(xRect.height) } : null,
    closeButtonText: x ? x.textContent.trim() : null,
    hasActionsRow: !!modal.querySelector(".be-modal-actions"),
    overlayId: overlay.id || null,
    modalBox: { w: Math.round(r.width), h: Math.round(r.height) },
    activeElementInside: modal.contains(document.activeElement),
    activeElement: document.activeElement
      ? document.activeElement.className || document.activeElement.tagName
      : null,
  };
};

describe("modal primitive visual captures", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("captures the migrated dialog, the untouched dialogs, and probes affordances", async function () {
    const page = await bootPage(ctx);
    const readings = {};
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(1500);

      /* ---- 1. MIGRATED: the rename dialog (opens on a layer-label dblclick) ---- */
      // Row 0 is the pinned SECTIONS layer, which `showRenameModal` deliberately
      // refuses to rename (it early-returns), so the first row is a decoy. Try
      // each row until the dialog actually opens.
      const tried = await page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"),
        );
        const attempts = [];
        for (const row of rows) {
          const label = row.children[0];
          if (!label) continue;
          label.dispatchEvent(
            new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
          );
          attempts.push(1);
        }
        return { rows: rows.length, attempted: attempts.length };
      });
      assert.ok(tried.rows > 0, "the layer panel rendered rows: " + JSON.stringify(tried));
      await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 20000 });
      await page.waitForTimeout(700);
      readings.migratedInput = await page.evaluate(READ_DIALOG);
      await frame(page, "10-input-dialog.png");

      // The validation state (AC-4) in the pixels.
      //
      // SCOPING MATTERS HERE, and getting it wrong made this assertion vacuous
      // once already: the control panel reuses the class `be-modal-ok` on its
      // own buttons (js/controls.js), and the panel sits EARLIER in the body
      // than the modal overlay — so a bare document.querySelector(".be-modal-ok")
      // clicked a control-panel button, the empty submit never ran, and the
      // assertion below then passed on the dialog's DESCRIPTION text, which is
      // also non-empty. Every selector here is therefore scoped to the dialog.
      const beforeSubmit = await page.evaluate(() => {
        const m = document.querySelector(".be-modal-overlay .be-modal-message");
        return m ? m.textContent.trim() : null;
      });
      await page.evaluate(() => {
        const input = document.querySelector(".be-modal-overlay .be-modal-input");
        if (input) input.value = "";
        const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
        if (ok) ok.click();
      });
      await page.waitForTimeout(600);
      const afterSubmit = await page.evaluate(() => {
        const m = document.querySelector(".be-modal-overlay .be-modal-message");
        return m ? m.textContent.trim() : null;
      });
      const stillOpen = await page.evaluate(
        () => !!document.querySelector(".be-modal-overlay"),
      );
      await frame(page, "30-validation-message.png");

      assert.strictEqual(stillOpen, true, "an empty submit keeps the dialog open (AC-4)");
      assert.ok(afterSubmit, "a message is present");
      // The message must be the VALIDATION text, not the dialog's own
      // description — this is what caught the vacuous version of this check.
      assert.notStrictEqual(
        afterSubmit,
        beforeSubmit,
        "the message CHANGED on the rejected submit (was the description: " +
          beforeSubmit +
          ")",
      );
      assert.match(
        afterSubmit,
        /cannot be empty|Enter a name/i,
        "and it is the validation text: " + afterSubmit,
      );

      // close it and confirm it really goes
      await page.evaluate(() => {
        const x = document.querySelector(".be-modal-overlay .be-modal-close");
        if (x) x.click();
      });
      await page.waitForTimeout(500);
      const closed = await page.evaluate(
        () => !document.querySelector(".be-modal-overlay"),
      );
      assert.strictEqual(closed, true, "the close X dismisses the dialog (AC-2)");

      /* ---- 2. UNTOUCHED: the shape picker, for the identity comparison ---- */
      await page.evaluate(() => {
        const b = document.getElementById("be-btn-add-shape");
        if (b) b.click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 30000 });
      await page.waitForTimeout(1200);
      readings.untouchedPicker = await page.evaluate(READ_DIALOG);
      await frame(page, "20-untouched-picker.png");
      await page.evaluate(() => {
        const c = document.querySelector(".be-modal-overlay .be-modal-cancel");
        if (c) c.click();
      });
      await page.waitForTimeout(600);

      /* ---- 3. UNTOUCHED: the templates catalog ---- */
      await page.evaluate(() => {
        const b = document.getElementById("be-btn-templates");
        if (b) b.click();
      });
      await page.waitForTimeout(2500);
      readings.untouchedCatalog = await page.evaluate(READ_DIALOG);
      if (readings.untouchedCatalog) await frame(page, "21-untouched-catalog.png");

      writeJson("affordance-probe.json", { provenance: cap.provenance(page), readings });

      /* ---- assertions: the migrated dialog must carry the full set ---- */
      const mig = readings.migratedInput;
      assert.ok(mig, "the migrated dialog was read");
      assert.strictEqual(mig.role, "dialog", "role=dialog");
      assert.strictEqual(mig.ariaModal, "true", "aria-modal");
      assert.ok(mig.accessibleName && mig.accessibleName.length, "accessible name present");
      assert.strictEqual(mig.closeButton, true, "close X present");
      assert.strictEqual(mig.closeButtonLabel, "Close dialog", "close X is labelled");
      assert.strictEqual(mig.activeElementInside, true, "focus starts inside the dialog");

      // The untouched dialogs are the reference: the migrated one now matches
      // them on the affordances that used to be missing.
      for (const [name, other] of [
        ["picker", readings.untouchedPicker],
        ["catalog", readings.untouchedCatalog],
      ]) {
        if (!other) continue;
        assert.strictEqual(other.role, "dialog", name + " (untouched) uses role=dialog");
        assert.ok(other.closeButton, name + " (untouched) has a close X");
        // the migrated dialog is not the odd one out any more
        assert.strictEqual(
          mig.closeButton,
          other.closeButton,
          "the migrated dialog matches " + name + " on the close affordance",
        );
      }
    } finally {
      await page.close().catch(() => {});
    }
  });
});
