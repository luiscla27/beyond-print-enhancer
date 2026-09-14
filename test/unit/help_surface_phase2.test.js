/**
 * Phase 2 — every feature is discoverable from the UI (track ux_gaps_20260911, AC-2).
 *
 * WHY THIS SUITE EXISTS. The product taught exactly three gestures, once, in a card that never
 * returns, while documenting 18 features in its README where the user is not looking. Measured
 * before the surface was built: no help/shortcut/keymap surface existed anywhere in `js/`, and
 * the ONLY non-comment mention of `Ctrl/Cmd+Z` in the whole product was a `safeLog` line.
 *
 * THE CENTRAL ASSERTION IS THE MEASUREMENT, NOT THE PRESENCE OF A BUTTON. AC-2's fail condition
 * names the mistake this project has made twice before: "the surface is asserted from
 * markup/source rather than a capture". So the criterion asserted here is that every gesture in
 * the product's own list is REACHABLE FROM THE PRODUCT ITSELF — the list is read from the
 * shipped seam (`window.HELP_GESTURES`), so this cannot drift from what the panel shows.
 */
"use strict";

const assert = require("assert");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

describe("Phase 2 — every feature is discoverable from the UI (AC-2)", function () {
  let b, window, document, cleanup;

  beforeEach(function () {
    b = boot();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("the panel exposes a help control, and opening it uses the SHARED dialog shell", async function () {
    window.createControls();
    const helpBtn = document.getElementById("be-ctl-help");
    assert.ok(helpBtn, "the panel header carries a help control");
    assert.ok(
      /shortcut|gesture/i.test(helpBtn.getAttribute("aria-label") || ""),
      `it is named for what it opens — got "${helpBtn.getAttribute("aria-label")}"`,
    );

    helpBtn.click();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const overlay = document.querySelector(".be-modal-overlay");
    assert.ok(overlay, "the surface opened");
    // The SHARED shell, not a bespoke overlay: the shell is what supplies the role, the
    // accessible name, Escape, backdrop and the focus trap (track modal_primitive_20260910).
    assert.ok(overlay.querySelector(".be-modal"), "the shared modal element is used");
    assert.ok(overlay.querySelector('[aria-modal="true"]'), "…and it is a modal dialog");
    assert.ok(
      overlay.querySelector('[aria-labelledby]'),
      "…with an accessible name (an unnamed dialog is barely better than none)",
    );
  });

  it("EVERY gesture the product lists is reachable from the product's own UI (AC-2c)", async function () {
    window.createControls();
    // Read the list from the SHIPPED seam — not re-typed here, so the assertion cannot pass
    // against a stale copy of the content while the real surface says something else.
    const listed = window.HELP_GESTURES;
    assert.ok(Array.isArray(listed) && listed.length >= 6, `the product lists its gestures (${listed && listed.length})`);

    window.showHelpSurface();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const text = document.querySelector(".be-modal-overlay").textContent;

    for (const g of listed) {
      assert.ok(
        text.includes(g.what),
        `the surface names the gesture: "${g.what}"`,
      );
      // The KEYWORDS a user would search for must be present too — naming only the noun
      // ("Extract a block…") without the action ("Double-click…") teaches nothing.
      const keyword = g.how.split(/[\s(]/)[0].toLowerCase();
      assert.ok(
        text.toLowerCase().includes(keyword),
        `and the action for it ("${keyword}") — for "${g.what}"`,
      );
    }

    // THE SIX the track committed to in AC-2(a), asserted by the words a user sees.
    for (const needle of [
      "Drag it",                    // move
      "corner",                     // resize
      "rotation handle",            // rotate
      "Double-click",               // extract
      "Right-click",                // layer menu
      "Ctrl+Z",                     // undo shortcut
    ]) {
      assert.ok(text.includes(needle), `the surface teaches "${needle}"`);
    }
  });

  it("the undo control names the KEYBOARD route, which was never announced before (AC-2b)", async function () {
    window.createControls();
    const live = await window.captureLiveLayout();
    window.pushUndo(live, 'Toggle "Actions"', "layer-flag");
    window.dispatchEvent(new window.Event("be-undo-stack-changed"));

    const btn = document.getElementById("be-btn-undo");
    const title = btn.getAttribute("title") || "";
    assert.ok(/Ctrl\+Z/.test(title), `the tooltip names the shortcut — got "${title}"`);
    assert.ok(/Cmd\+Z/.test(title), `…and the platform variant — got "${title}"`);
    assert.ok(
      /Ctrl\+Z/.test(btn.getAttribute("aria-label") || ""),
      "…and so does the accessible name",
    );
  });

  it("the surface also settles WHERE the undo history went (AC-3's distinction, where the user looks)", async function () {
    window.createControls();
    window.showHelpSurface();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const text = document.querySelector(".be-modal-overlay").textContent;
    assert.ok(/current session/i.test(text), "it says undo is session-scoped");
    assert.ok(/Restore backup/.test(text), "…and points at the durable history");
  });

  it("the first-run hint still exists and is unchanged in purpose (this surface ADDS, it does not replace)", async function () {
    // The hint is measured and its dismissal persists; a help surface that had replaced it
    // would be a regression in the one-time teaching path, not an addition.
    window.createControls();
    // `mountOnboardingHint` defers through a promise when a dismissal read is already in
    // flight, so the card is not synchronously present — wait for it rather than racing it.
    await waitFor(() => document.getElementById("be-onboarding-hint") !== null);
    const card = document.getElementById("be-onboarding-hint");
    assert.ok(card, "the first-run card is still mounted");
    assert.ok(
      /Drag to move/.test(card.textContent),
      "…and still teaches the three primary gestures",
    );
  });
});
