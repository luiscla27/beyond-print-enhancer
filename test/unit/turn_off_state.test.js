/**
 * Phase 4 — the tool can be turned off, and says whether it is on
 * (track first_run_and_panel_20260911, AC-4).
 *
 * WHY THIS SUITE EXISTS. Measured in Phase 0 (F-4): activation was ONE-WAY, by construction —
 * `chrome.action.onClicked` injects, `js/main.js:12-17` sets a one-way init guard and returns early
 * on any later run, and `js/controls.js:28-31` absorbs a second click as a duplicate-panel guard.
 * There was NO teardown anywhere (`grep -rn "print-enhance-controls" js/ | grep -c remove` -> 0),
 * and the only escape was `be-ctl-collapse`, whose own title is "Minimize panel". So declining the
 * tool meant reloading the page by hand — and "is the tool on?" could only be answered by hunting
 * for the panel, because `setBadgeText` was called nowhere and the manifest declares no badge.
 *
 * WHAT THIS SUITE CAN AND CANNOT PROVE, stated because the split is deliberate. jsdom shares ONE
 * `window`, so the interception assertions (did it save first? did it notify the worker?) are exact
 * here — which is why they live here rather than in the browser, where the extension's isolated
 * world cannot be stubbed from `page.evaluate` (the trap Phase 2 hit: a stubbed `window.print`
 * recorded ZERO calls while the extension was really printing). But jsdom CANNOT observe the
 * reload: `window.location.reload` is read-only there, assignment silently no-ops, and calling it
 * trips jsdom's own "navigation not implemented". So **the reload itself is asserted in the
 * browser**, where it is a real navigation that really does produce a clean page —
 * `test/browser_e2e/turn_off_verify.spec.js`, which asserts the reloaded document carries none of
 * the extension. Neither suite claims the other's half.
 *
 * (One incidental confirmation, noticed while running this suite: jsdom prints "Not implemented:
 * navigation to another Document" on the cases that confirm the turn-off. That warning appears only
 * because the handler really does call `window.location.reload()` — the read-only property silently
 * ignores assignment, so a product that never reached the reload would produce no warning at all.)
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKGROUND = fs.readFileSync(path.join(ROOT, "js", "background.js"), "utf8");
const ICONS = fs.readFileSync(path.join(ROOT, "js", "icons.js"), "utf8");

/** Open the turn-off dialog and hand back the overlay. */
async function openTurnOff(window, document) {
  window.showTurnOffSurface();
  await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
  return document.querySelector(".be-modal-overlay");
}

describe("Phase 4 — turn off, and read the state (AC-4)", function () {
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

  it("AC-4: the panel carries a turn-off control, and it opens the SHARED dialog shell", async function () {
    window.createControls();
    const btn = document.getElementById("be-ctl-off");
    assert.ok(btn, "the panel header carries a turn-off control");
    assert.ok(
      /turn off/i.test(btn.getAttribute("aria-label") || ""),
      `it is named for what it does — got "${btn.getAttribute("aria-label")}"`,
    );
    // In the HEADER, not a tray: the header is outside the scrollport, so this costs no vertical
    // pixels — which matters because AC-5 has to absorb this track's added height.
    assert.ok(
      btn.closest(".be-ctl-topbar-row"),
      "it sits in the panel header, outside the scrolled body",
    );

    btn.click();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const overlay = document.querySelector(".be-modal-overlay");
    assert.ok(overlay.querySelector(".be-modal"), "the SHARED modal element is used");
    assert.ok(overlay.querySelector('[aria-modal="true"]'), "…a modal dialog");
    assert.ok(overlay.querySelector("[aria-labelledby]"), "…with an accessible name");
    assert.ok(
      document.getElementById("be-turn-off-confirm"),
      "…with an explicit confirm control (the turn-off is not a stray Enter away)",
    );
  });

  it("AC-4: turning off SAVES and notifies BEFORE it deactivates — it cannot cost the user their arrangement", async function () {
    window.createControls();
    const order = [];
    window.handleSaveBrowser = async () => { order.push("save"); };
    window.chrome.runtime.sendMessage = () => { order.push("notify"); };

    await openTurnOff(window, document);
    document.getElementById("be-turn-off-confirm").click();
    // The dialog closes first, then the save and the notification run — both of which are the
    // observable work that must happen BEFORE the reload (which the browser asserts).
    await waitFor(() => document.querySelector(".be-modal-overlay") === null);
    await waitFor(() => order.length >= 2);

    assert.deepStrictEqual(
      order,
      ["save", "notify"],
      "the arrangement is saved FIRST, then the worker is told — a reload that raced the save " +
        "would lose the user's work",
    );
  });

  it("AC-4: a FAILED save still completes the turn-off — it must not trap the user inside the tool", async function () {
    window.createControls();
    const order = [];
    window.handleSaveBrowser = async () => { order.push("save-failed"); throw new Error("indexedDB unavailable"); };
    window.chrome.runtime.sendMessage = () => { order.push("notify"); };

    await openTurnOff(window, document);
    document.getElementById("be-turn-off-confirm").click();
    await waitFor(() => order.includes("notify"));

    // The user asked to be let out. Refusing because a save failed would trap them in a tool they
    // are trying to dismiss — a worse outcome than a save that did not happen.
    assert.ok(
      order.includes("notify"),
      "the handler carried on past the failed save rather than refusing to turn off",
    );
  });

  it("AC-4: it tells the extension's service worker the tab is off, so the badge stops claiming ON", async function () {
    window.createControls();
    const sent = [];
    window.chrome.runtime.sendMessage = (msg) => { sent.push(msg); };
    window.handleSaveBrowser = async () => {};

    await openTurnOff(window, document);
    document.getElementById("be-turn-off-confirm").click();
    await waitFor(() => sent.length > 0);

    assert.deepStrictEqual(
      sent.map((m) => m.type),
      ["DDB_TURNED_OFF"],
      "the in-page control reports the turn-off, so the badge clears the instant the user chooses " +
        "it rather than when the reload reaches 'loading'",
    );
  });

  it("AC-4: Cancel closes the dialog and changes NOTHING", async function () {
    window.createControls();
    const done = [];
    window.handleSaveBrowser = async () => { done.push("save"); };
    window.chrome.runtime.sendMessage = () => { done.push("notify"); };

    await openTurnOff(window, document);
    document.querySelector(".be-modal-cancel").click();
    await waitFor(() => document.querySelector(".be-modal-overlay") === null);
    // Give a wrongly-wired handler time to misbehave, so this case cannot pass by winning a race.
    await new Promise((r) => setTimeout(r, 30));

    // A confirmation that acts on dismissal is not a confirmation, and the product's own rule is
    // that a dismissed dialog counts as "no".
    assert.deepStrictEqual(done, [], "nothing was saved and no state message was sent");
  });

  it("AC-4 (the state half): the badge is SET when the content script boots, CLEARED on navigation, and is NOT persisted", function () {
    // Read the shipped service worker rather than re-typing its behaviour. These edges are what
    // make the badge trustworthy: one that only ever turns on would be decoration.
    assert.match(BACKGROUND, /setBadgeText/, "the icon can show state at all");
    // SET by the content script's own boot announcement, not by the click handler: a click handler
    // knows an injection was REQUESTED, not that it happened. Measured — the click-handler version
    // reported "" instead of "ON" in the browser suite, because the harness injects without going
    // through chrome.action.onClicked at all.
    assert.match(BACKGROUND, /DDB_IS_ON/, "…the boot announcement exists");
    assert.match(
      BACKGROUND,
      /DDB_IS_ON["']\) markOn\(/,
      "…and it is what sets the badge",
    );
    assert.ok(
      !/\.then\(function \(\) \{[\s\S]{0,200}markOn/.test(BACKGROUND),
      "the click handler does NOT set it — that would report a request, not a fact",
    );
    assert.match(
      BACKGROUND,
      /chrome\.tabs\.onUpdated\.addListener/,
      "…and navigation CLEARS it, which IS the off state",
    );
    assert.match(
      BACKGROUND,
      /changeInfo\.status === "loading"[\s\S]{0,120}clearState/,
      "…cleared while the reload is still in progress, so the icon is never briefly lying",
    );
    assert.match(BACKGROUND, /DDB_TURNED_OFF/, "…and the in-page control clears it directly too");
    // NOT persisted: the state answers "what is happening on this page", and a stored "off" would
    // answer a different question (a preference) — which is O-4's session-scoped choice.
    assert.ok(
      !/storage\.local[\s\S]{0,200}badge|badge[\s\S]{0,200}storage\.local/i.test(BACKGROUND),
      "the badge state is not persisted anywhere",
    );
    // The power icon exists in the shipped set, so the control is not a text fallback in production.
    assert.match(ICONS, /^\s*power:/m, "the icon language carries a power symbol");
  });
});
