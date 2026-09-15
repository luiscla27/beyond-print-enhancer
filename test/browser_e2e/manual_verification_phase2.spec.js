/**
 * Manual Verification — Phase 2 (first-run discoverability, AC-5) — AUTOMATED.
 *
 * The automated form of "Conductor - User Manual Verification 'Phase 2'". Per
 * vendor/conductor/workflow.md §3.1 a checkpoint is a user-facing walkthrough with
 * expected results; the walkthrough below is asserted instead of eyeballed.
 *
 * The walkthrough (the O-1 affordance the operator ratified):
 *   1. "Open the editor for the first time"   -> a card tells you the sheet is manipulable,
 *                                                naming drag / resize / rotate
 *   2. "Look at where it sits"                -> it is inside the control panel, so it does NOT
 *                                                cover the sheet you are arranging
 *   3. "Press Got it"                         -> the card goes away
 *   4. "Reopen the editor"                    -> it does NOT come back
 *
 * Step 4 opens a SECOND page in the same browser profile: that is what a reload
 * looks like to the extension's content script, so the persistence is exercised
 * the way a user experiences it (the unit suite simulates the same with a fresh
 * window plus the stored flag).
 *
 * Run via: npm run test:e2e:verify2
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");

const READ_HINT = () => {
  const card = document.getElementById("be-onboarding-hint");
  const panel = document.getElementById("print-enhance-controls");
  if (!card) return { present: false, panelPresent: !!panel };
  const c = card.getBoundingClientRect();
  const p = panel ? panel.getBoundingClientRect() : null;
  return {
    present: true,
    panelPresent: !!panel,
    text: (card.querySelector(".be-onboarding-hint-text") || {}).textContent || "",
    dismissText: (() => {
      const d = card.querySelector(".be-onboarding-hint-dismiss");
      return d ? d.textContent.trim() : null;
    })(),
    role: card.getAttribute("role"),
    cardBox: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)],
    panelBox: p
      ? [Math.round(p.left), Math.round(p.top), Math.round(p.width), Math.round(p.height)]
      : null,
  };
};

describe("Manual verification — Phase 2 (first-run discoverability)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  it("the four-step discoverability walkthrough behaves as documented", async function () {
    /* Steps 1-3 happen in the first session. */
    const first = await bootPage(ctx);
    let dismissed = false;
    try {
      await first.setViewportSize({ width: 1440, height: 900 });
      await first.waitForSelector("#print-enhance-controls", { timeout: 30000 });
      await first.waitForTimeout(1500);

      /* Step 1 — "A card tells you the sheet is manipulable." */
      const before = await first.evaluate(READ_HINT);
      assert.ok(
        before.present,
        "step 1: the first-run hint is on screen: " + JSON.stringify(before),
      );
      assert.strictEqual(before.role, "note", "step 1: it is an informational note");
      ["drag", "resize", "rotate"].forEach((verb) => {
        assert.ok(
          before.text.toLowerCase().includes(verb),
          `step 1: the card names "${verb}" — text: "${before.text}"`,
        );
      });
      assert.strictEqual(
        before.dismissText,
        "Got it",
        "step 1: it carries the ratified dismiss control",
      );

      /* Step 2 — "It does not cover the sheet." */
      assert.ok(before.panelBox, "step 2: the control panel is present (the card's host)");
      const [cl, , cw] = before.cardBox;
      const [pl, , pw] = before.panelBox;
      assert.ok(
        before.cardBox[2] > 0 && before.cardBox[3] > 0,
        "step 2: the card has a real rendered box",
      );
      assert.ok(
        cl >= pl - 1 && cl + cw <= pl + pw + 1,
        "step 2: the card sits WITHIN the control panel, so it cannot cover the sheet — " +
          "card=" +
          JSON.stringify(before.cardBox) +
          " panel=" +
          JSON.stringify(before.panelBox),
      );

      /* Step 3 — "Press Got it." */
      const clicked = await first.evaluate(() => {
        const d = document.querySelector(
          "#be-onboarding-hint .be-onboarding-hint-dismiss",
        );
        if (!d) return null;
        d.click();
        return true;
      });
      assert.ok(clicked, "step 3: the Got it control was clicked");
      await first.waitForTimeout(600);
      const after = await first.evaluate(READ_HINT);
      assert.strictEqual(after.present, false, "step 3: the card is gone");
      // …and the dismissal reached the store the product can actually use.
      dismissed = await first.evaluate(() =>
        window.localStorage.getItem("ddbPrintEnhancer.onboardingHintDismissed") === "true",
      );
      assert.ok(
        dismissed,
        "step 3: the dismissal was persisted (host-origin store — the manifest has no " +
          "storage permission, so chrome.storage is not available in a content script)",
      );
    } finally {
      await first.close().catch(() => {});
    }

    /* Step 4 — "Reopen the editor: it does not come back." */
    const second = await bootPage(ctx);
    try {
      await second.setViewportSize({ width: 1440, height: 900 });
      await second.waitForSelector("#print-enhance-controls", { timeout: 30000 });
      await second.waitForTimeout(1500);
      const reopened = await second.evaluate(READ_HINT);
      assert.strictEqual(
        reopened.present,
        false,
        "step 4: the hint did NOT reappear on a later boot: " + JSON.stringify(reopened),
      );
      assert.ok(
        reopened.panelPresent,
        "step 4: …while the control panel itself is of course still there",
      );
    } finally {
      await second.close().catch(() => {});
    }
  });
});
