/**
 * AC-V1-lite visual-gate capture harness — track byok_ai_layout_20260915, Phase 2.
 *
 * The phase's visual question is narrow and it is a COMPARISON, not an absolute: does the
 * new AI settings dialog read as part of the locked leather-and-gold identity, or as a
 * bolted-on control? A single screenshot cannot answer that — a reviewer needs the new
 * surface and a compliant one from the same build side by side, at the same zoom, in the
 * same session. `modal_primitive_20260910` established that shape, and this file reuses its
 * capture harness (`_capture.js`) rather than re-declaring the plumbing.
 *
 * WHY THE DIALOG IS OPENED THROUGH `contentCall` AND NOT FROM THE PAGE. `window.AiSettings`
 * lives in the extension's ISOLATED world; a `page.evaluate` that "opened the dialog" would
 * find `undefined`, silently do nothing, and the camera would photograph the sheet — a frame
 * of nothing, with nothing to fail on. The DOM itself is SHARED between the worlds (measured
 * in this track: a MAIN-world read found `.be-ai-key` and the value typed into it), so a
 * dialog opened in the isolated world is a real, photographable dialog. Drive in the world
 * that owns the seam, measure and photograph from the other one.
 *
 * Frames:
 *   10-ai-settings-empty.png    as a first-time user sees it (no provider, no key, and today
 *                               the real no-permission message — the manifest grants no `storage`)
 *   11-ai-settings-filled.png   provider chosen + a credential typed: the masked field and
 *                               the enabled action row
 *   12-ai-settings-error.png    a rejected base URL: the shell's error state, field marked
 *   20-reference-rename.png     an EXISTING input-bearing dialog on the same shell
 *   21-reference-help.png       an EXISTING read-only dialog on the same shell
 *
 * The seven identity claims at the bottom are the numbers a reviewer would otherwise eyeball.
 * What they do NOT cover is what the collage is for.
 *
 * Gating (graceful skip — a normal e2e run never captures and never fails):
 *   BYOK_SHOTS=1          enable capturing
 *   BYOK_SHOTS_DIR=...    override the artifact root
 *
 * Run:
 *   BYOK_SHOTS=1 npx mocha test/browser_e2e/byok_settings_visual_capture.spec.js --timeout 900000
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");
const { captureHarness } = require("./_capture.js");

const cap = captureHarness({
  flag: "BYOK_SHOTS",
  dirVar: "BYOK_SHOTS_DIR",
  defaultDir: "vendor/docs/byok-ai-layout-20260915",
});
const CAPTURING = cap.enabled;

/** A credential-shaped string so the MASK is something a reviewer can actually judge. */
const PROBE_KEY = "sk-probe-material-0123456789abcdef";

/** Computed styles of whichever dialog is currently open, from the MAIN world. */
const READ_SHELL = () => {
  const m = document.querySelector(".be-modal-overlay .be-modal");
  if (!m) return null;
  const cs = getComputedStyle(m);
  const r = m.getBoundingClientRect();
  const box = (el) => (el ? getComputedStyle(el) : null);
  const input = m.querySelector("input");
  const ok = m.querySelector(".be-modal-ok");
  const cancel = m.querySelector(".be-modal-cancel");
  const title = m.querySelector("h3");
  return {
    title: title ? title.textContent : null,
    box: { w: Math.round(r.width), h: Math.round(r.height) },
    background: cs.backgroundColor,
    color: cs.color,
    radius: cs.borderRadius,
    font: cs.fontFamily.split(",")[0],
    inputHeight: input ? box(input).height : null,
    inputBackground: input ? box(input).backgroundColor : null,
    inputColor: input ? box(input).color : null,
    inputRadius: input ? box(input).borderRadius : null,
    okHeight: ok ? box(ok).height : null,
    okBackground: ok ? box(ok).backgroundColor : null,
    okColor: ok ? box(ok).color : null,
    okRadius: ok ? box(ok).borderRadius : null,
    cancelBorder: cancel ? box(cancel).borderColor : null,
    actionsGap: box(m.querySelector(".be-modal-actions")).gap,
  };
};

describe("byok_ai_layout Phase 2 — AI settings dialog visual captures (AC-V1-lite)", function () {
  this.timeout(900000);
  let ctx;

  before(async function () {
    if (!CAPTURING) this.skip();
    ctx = await launchExtensionContext();
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("captures the new dialog in three states and two existing dialogs for comparison", async function () {
    const page = await bootPage(ctx);
    const M = {};
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(1500);

      /* ---- 1. The new dialog, empty ------------------------------------------------ */
      const empty = await contentCall(ctx, "aiSettingsDialogProbe", [{ leaveOpen: true }]);
      assert.strictEqual(empty.ok, true, "the dialog opened: " + JSON.stringify(empty));
      await page.waitForTimeout(700);
      M.empty = await page.evaluate(READ_SHELL);
      assert.ok(M.empty, "the dialog is in the shared DOM where the camera can see it");
      // The frame must show the MASKED field, and the assertion that guarantees it is taken
      // from the SAME measurement pass that produced the pixels: an unmasked capture would
      // otherwise still satisfy every colour comparison below.
      const emptyKey = await page.evaluate(() => {
        const k = document.querySelector(".be-modal-overlay .be-ai-key");
        return { type: k.type, value: k.value };
      });
      assert.strictEqual(emptyKey.type, "password");
      assert.strictEqual(emptyKey.value, "", "the dialog never populates a credential");
      await cap.frame(page, "10-ai-settings-empty.png");

      /* ---- 2. Populated: provider chosen + a key typed ----------------------------- */
      await contentCall(ctx, "closeOverlays", []);
      await page.waitForTimeout(300);
      const filled = await contentCall(ctx, "aiSettingsDialogProbe", [
        { typeKey: PROBE_KEY, leaveOpen: true, skipRevealCycles: true, noSave: true },
      ]);
      assert.strictEqual(filled.ok, true);
      await page.waitForTimeout(700);
      M.filled = await page.evaluate(READ_SHELL);
      const filledKey = await page.evaluate(() => {
        const k = document.querySelector(".be-modal-overlay .be-ai-key");
        return { type: k.type, hasValue: k.value.length > 0 };
      });
      assert.strictEqual(filledKey.type, "password", "still masked when populated");
      assert.ok(filledKey.hasValue, "…and there IS a value behind the mask, so the dots are real");
      await cap.frame(page, "11-ai-settings-filled.png");

      /* ---- 3. The error state ------------------------------------------------------ */
      await contentCall(ctx, "closeOverlays", []);
      await page.waitForTimeout(300);
      const errored = await contentCall(ctx, "aiSettingsDialogProbe", [
        { tryBadBaseUrl: "http://insecure.example/v1", leaveOpen: true, skipRevealCycles: true },
      ]);
      assert.strictEqual(errored.ok, true);
      await page.waitForTimeout(500);
      M.error = await page.evaluate(() => {
        const m = document.querySelector(".be-modal-overlay .be-modal");
        const msg = m.querySelector(".be-modal-message");
        const cs = getComputedStyle(msg);
        const bad = m.querySelector("[aria-invalid='true']");
        return {
          text: msg.textContent,
          shown: cs.display !== "none",
          isErrorClass: msg.classList.contains("be-modal-message-error"),
          color: cs.color,
          markedField: bad ? bad.className : null,
        };
      });
      assert.ok(M.error.shown, "the error must be VISIBLE in the frame, not merely present");
      assert.ok(M.error.isErrorClass, "…and styled as an error, not as hint copy");
      assert.ok(
        !M.error.text.includes("sk-"),
        "the error copy never echoes a credential back into the frame: " + M.error.text,
      );
      await cap.frame(page, "12-ai-settings-error.png");
      await contentCall(ctx, "closeOverlays", []);
      await page.waitForTimeout(300);

      /* ---- 4. REFERENCE: the rename dialog (an input-bearing form, same shell) ----- */
      const openedRename = await page.evaluate(() => {
        const rows = Array.from(
          document.querySelectorAll("#print-enhance-layer-manager .be-layer-row"),
        );
        for (const row of rows) {
          const label = row.children[0];
          if (!label) continue;
          label.dispatchEvent(
            new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
          );
          if (document.querySelector(".be-modal-overlay .be-modal")) return true;
        }
        return false;
      });
      assert.ok(openedRename, "the rename dialog opened, so the comparison has its reference");
      await page.waitForTimeout(700);
      M.rename = await page.evaluate(READ_SHELL);
      await cap.frame(page, "20-reference-rename.png");
      await page.evaluate(() => {
        const x = document.querySelector(".be-modal-overlay .be-modal-close");
        if (x) x.click();
      });
      await page.waitForTimeout(400);

      /* ---- 5. REFERENCE: the help dialog (a read-only body, same shell) ------------ */
      await page.evaluate(() => {
        const b = document.getElementById("be-ctl-help");
        if (b) b.click();
      });
      await page.waitForSelector(".be-modal-overlay .be-modal", { timeout: 20000 });
      await page.waitForTimeout(700);
      M.help = await page.evaluate(READ_SHELL);
      await cap.frame(page, "21-reference-help.png");
      await page.evaluate(() => {
        const x = document.querySelector(".be-modal-overlay .be-modal-close");
        if (x) x.click();
      });

      /* ---- The identity claims, as numbers ----------------------------------------- */
      // `empty` vs the two EXISTING dialogs: same ground, radius, typeface, and the shell's
      // own control tiers. A new dialog that diverges on any of these is a bolted-on control,
      // and this is the half of the visual gate that does not need a model to answer.
      for (const refName of ["rename", "help"]) {
        const ref = M[refName];
        assert.ok(ref, "reference measurement " + refName + " was taken");
        assert.strictEqual(M.empty.background, ref.background, `modal ground matches ${refName}`);
        assert.strictEqual(M.empty.radius, ref.radius, `corner radius matches ${refName}`);
        assert.strictEqual(M.empty.font, ref.font, `typeface matches ${refName}`);
        assert.strictEqual(M.empty.color, ref.color, `body text colour matches ${refName}`);
      }
      assert.strictEqual(M.empty.inputHeight, M.rename.inputHeight, "field height is the shell's T4, measured");
      assert.strictEqual(M.empty.inputBackground, M.rename.inputBackground, "same input ground");
      assert.strictEqual(M.empty.inputColor, M.rename.inputColor, "same input ink");
      assert.strictEqual(M.empty.okHeight, M.rename.okHeight, "the OK control is the shell's T1 height");
      assert.strictEqual(M.empty.okBackground, M.rename.okBackground, "…and its fill");
      assert.strictEqual(M.empty.actionsGap, M.rename.actionsGap, "the action row keeps the shell's gap");
      cap.probe("byok-phase2-measurements.json", M);
      cap.probe("byok-phase2-probe-reads.json", {
        empty: { message: empty.message, buttons: empty.buttons, bodyChildClasses: empty.bodyChildClasses },
        filled: { afterSave: filled.afterSave || null },
        errored: { afterSave: errored.afterSave || null },
      });
    } finally {
      fs.mkdirSync(cap.shots, { recursive: true });
      fs.writeFileSync(
        path.join(cap.shots, "provenance.json"),
        JSON.stringify(cap.provenance(page, "byok_settings_visual_capture.spec.js"), null, 2),
      );
    }
  });
});
