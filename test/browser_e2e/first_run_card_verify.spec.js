/**
 * Phase 1 verification (track first_run_and_panel_20260911, AC-1 + AC-V1): the converged gesture
 * surfaces in the REAL product.
 *
 * WHY A BROWSER RUN AND NOT THE UNIT SUITE. The unit suite
 * (`test/unit/gesture_surface_convergence.test.js`) proves the card's text is the derivation and
 * that the control opens the shared dialog. What it CANNOT prove is that the card, its new control
 * and the dialog actually render in the injected content script at the real viewport — inside the
 * panel's 232px tray, on the icon height tier this design system fixes, without wrapping the row.
 * AC-V1's whole point is that a pixel claim needs a pixel.
 *
 *   CARD_SHOTS=1 npx mocha test/browser_e2e/first_run_card_verify.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage, reinject } = require("./_helpers.js");

const ENABLED = process.env.CARD_SHOTS === "1";
const ART_ROOT = process.env.CARD_SHOTS_DIR || "docs/first-run-and-panel-20260911";
const SHOTS = path.join(ART_ROOT, "shots-phase1");

describe("Phase 1 — the gesture surfaces converge in the real product (AC-1)", function () {
  this.timeout(900000);
  let ctx, page;

  before(async function () {
    if (!ENABLED) this.skip();
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    fs.mkdirSync(SHOTS, { recursive: true });
  });
  after(async function () {
    if (ctx) await ctx.close();
  });

  it("AC-1a/b: the card renders in the real panel carrying its three gestures and a path to the reference", async function () {
    const card = await page.evaluate(() => {
      const el = document.getElementById("be-onboarding-hint");
      if (!el) return null;
      const text = el.querySelector(".be-onboarding-hint-text");
      const more = el.querySelector(".be-onboarding-hint-more");
      const dismiss = el.querySelector(".be-onboarding-hint-dismiss");
      const r = more ? more.getBoundingClientRect() : null;
      const cr = el.getBoundingClientRect();
      return {
        label: el.getAttribute("aria-label"),
        text: text ? text.textContent : null,
        more: more
          ? {
              tag: more.tagName,
              label: more.getAttribute("aria-label"),
              title: more.title,
              width: Math.round(r.width),
              height: Math.round(r.height),
              visible: r.width > 0 && r.height > 0,
            }
          : null,
        dismissPresent: !!dismiss,
        card: { width: Math.round(cr.width), height: Math.round(cr.height) },
      };
    });

    assert.ok(card, "the first-run card is mounted in the live panel on a fresh profile");
    console.log("\n-- first-run card (live) --\n  ", JSON.stringify(card, null, 2));

    // AC-1a: the sentence is the DERIVATION — same content the unit suite pins, observed here in
    // the real injected script rather than in jsdom.
    assert.strictEqual(
      card.text,
      "Drag to move, drag a corner to resize, or use the handle to rotate",
      "the card renders the derived sentence in the live product",
    );

    // AC-1b: the path exists, is a real button, and is named for what it opens.
    assert.ok(card.more, "the card carries the control that opens the reference");
    assert.strictEqual(card.more.tag, "BUTTON", "…as a real button, so the keyboard can reach it");
    assert.ok(card.more.visible, "…and it is actually rendered (a zero-box control is not a path)");
    assert.ok(
      /gesture|shortcut/i.test(card.more.label || ""),
      `…named for what it opens — got "${card.more.label}"`,
    );

    // AC-1b, the layout constraint AC-V1 exists to check: the control takes the ICON tier (28x28),
    // the same treatment the panel header's own "?" gets, because this is a single-line row inside
    // the panel's 232px tray. A wider control would wrap the row or squeeze the hint.
    assert.strictEqual(
      card.more.width,
      28,
      `the control honours the icon tier width (${card.more.width})`,
    );
    assert.strictEqual(
      card.more.height,
      28,
      `…and height (${card.more.height})`,
    );

    // AC-1c: the name is scoped to the subset, not the set.
    assert.ok(
      /^(a few|few|some|three|3)\b/i.test(card.label || ""),
      `the accessible name scopes itself — got "${card.label}"`,
    );

    // The dismiss is still there: the card remains dismissible (its own AC-5 behaviour, untouched).
    assert.ok(card.dismissPresent, "the Got it control survives — the card is still dismissible");

    await page.screenshot({ path: path.join(SHOTS, "01-card-with-help-path.png") });
  });

  it("AC-1b: the keyboard — not the mouse — can open the reference from the card", async function () {
    // Focus the control the way a keyboard user reaches it, then activate with Enter. This is the
    // assertion a `.click()` cannot make: a click proves the handler is wired, not that the control
    // is reachable or that Enter activates it.
    const focused = await page.evaluate(() => {
      const more = document.querySelector("#be-onboarding-hint .be-onboarding-hint-more");
      if (!more) return null;
      more.focus();
      return document.activeElement === more;
    });
    assert.ok(focused, "focus() lands on the card's control in the real product");

    await page.screenshot({ path: path.join(SHOTS, "02-card-help-focus-ring.png") });
    await page.keyboard.press("Enter");
    await page.waitForSelector(".be-modal-overlay", { timeout: 10000 });

    const dialog = await page.evaluate(() => {
      const overlay = document.querySelector(".be-modal-overlay");
      if (!overlay) return null;
      const modal = overlay.querySelector(".be-modal");
      const terms = Array.from(overlay.querySelectorAll("dt")).map((d) => d.textContent.trim());
      return {
        sharedShell: !!modal,
        ariaModal: !!overlay.querySelector('[aria-modal="true"]'),
        named: !!overlay.querySelector("[aria-labelledby]"),
        gestures: terms,
      };
    });
    console.log("\n-- reference opened from the card (live) --\n  ", JSON.stringify(dialog));

    assert.ok(dialog, "Enter opened the reference surface");
    assert.ok(dialog.sharedShell, "…and it is the SHARED dialog shell, not a second overlay");
    assert.ok(dialog.ariaModal, "…a real modal dialog");
    assert.ok(dialog.named, "…with an accessible name");
    assert.ok(
      dialog.gestures.length >= 8,
      `…listing the product's gestures (got ${dialog.gestures.length})`,
    );
    // AC-1's substance: the three the card teaches are among the ones the reference lists.
    ["Move a section", "Resize a section", "Rotate a shape"].forEach((what) => {
      assert.ok(
        dialog.gestures.includes(what),
        `the reference lists "${what}", which the card teaches`,
      );
    });

    await page.screenshot({ path: path.join(SHOTS, "03-reference-opened-from-card.png") });
  });

  it("AC-1b: opening the reference does NOT dismiss the card", async function () {
    // The behaviour the old design made impossible: before this change the card's only control
    // removed it forever, so teaching the user deleted the teaching.
    const state = await page.evaluate(() => ({
      card: !!document.getElementById("be-onboarding-hint"),
    }));
    assert.ok(state.card, "the card is still mounted after the reference was opened");

    // Close the dialog the keyboard way, then confirm the card is still there and still usable.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const el = document.getElementById("be-onboarding-hint");
      return {
        card: !!el,
        overlay: !!document.querySelector(".be-modal-overlay"),
        dismiss: !!(el && el.querySelector(".be-onboarding-hint-dismiss")),
      };
    });
    assert.ok(after.card, "the card survives closing the reference too");
    assert.ok(!after.overlay, "Escape closed the shared dialog (the shell's own behaviour)");
    assert.ok(after.dismiss, "…and the card is still dismissible");

    await page.screenshot({ path: path.join(SHOTS, "04-card-after-reference-closed.png") });
  });

  it("GATE 3 D2: after a RELOAD the card stays dismissed, and the reference route still exists", async function () {
    // GATE 3 (Phase 1) defect D2: the manual-verification walkthrough's third step asks for a
    // reload, and Phase 1's brief could only claim it was covered by a UNIT suite that simulates a
    // reload with a fresh jsdom window. That is not a reload. This is.
    const dismissed = await page.evaluate(() => {
      const el = document.getElementById("be-onboarding-hint");
      if (!el) return false;
      el.querySelector(".be-onboarding-hint-dismiss").click();
      return !document.getElementById("be-onboarding-hint");
    });
    assert.ok(dismissed, "the card is dismissed before the reload");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    // THE RELOAD ALSO MEASURED SOMETHING THE TRACK ALREADY KNEW, and it is worth stating here
    // because it is Phase 4's whole subject: after a reload the extension is GONE — no panel, no
    // styles, no listeners — because `chrome.action.onClicked` is what injects it. The product is
    // off until the user clicks the toolbar icon, and nothing on the icon says so (F-4).
    const beforeReinject = await page.evaluate(() => ({
      panel: !!document.getElementById("print-enhance-controls"),
    }));
    console.log("\n-- after reload, BEFORE re-injection (F-4: off until the icon is clicked) --\n  ",
      JSON.stringify(beforeReinject));
    assert.ok(
      !beforeReinject.panel,
      "the panel is absent after a reload — this is F-4, recorded rather than glossed",
    );

    // Reproduce the user's next action (the toolbar click) and assert the dismissal persisted.
    await reinject(ctx, page);
    const after = await page.evaluate(() => ({
      card: !!document.getElementById("be-onboarding-hint"),
      helpControl: !!document.getElementById("be-ctl-help"),
      panel: !!document.getElementById("print-enhance-controls"),
    }));
    console.log("\n-- after re-injection --\n  ", JSON.stringify(after));
    assert.ok(after.panel, "the panel is back once the extension is re-injected");
    assert.ok(
      !after.card,
      "the dismissed card does NOT return — its dismissal still persists across a reload",
    );
    assert.ok(
      after.helpControl,
      "…and the gestures reference is still reachable from the panel header, so the card's absence " +
        "does not remove the route it was added to improve",
    );

    await page.screenshot({ path: path.join(SHOTS, "05-after-reload-card-stays-dismissed.png") });
  });
});
