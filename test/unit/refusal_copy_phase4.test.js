/**
 * Phase 4 — the refusal copy fits the window it is read in (track ux_gaps_20260911, AC-4).
 *
 * WHAT THIS PINS. The refusal toast is on screen for 3000 ms + a 500 ms fade (`js/modals.js`).
 * The copy it used to carry ran 21 words, which needs ~5.0 s at 250 wpm and ~6.3 s at 200 wpm —
 * an overrun of 1.4-1.8x under EITHER rate, measured in Phase 0. The message now leads with the
 * OUTCOME, names the cause, and ends with the next step.
 *
 * WHAT IT GUARDS AGAINST. The lazy way to pass a "make the copy shorter" criterion is to delete
 * a clause, which loses the answer to "why was my delete refused because of a BACKUP?" — AC-4
 * makes that a fail condition, so this suite asserts the long form SURVIVED, in a dialog that
 * stays, with a `showDetail` route that opens it.
 */
"use strict";

const assert = require("assert");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

/** The measured window, from js/modals.js: dwell + fade. Kept here as the budget. */
const TOAST_MS = 3000 + 500;
/** Conservative adult reading rate for short UI copy (words per minute). */
const WPM = 200;

const words = (s) => s.trim().split(/\s+/).length;
/** Seconds needed to READ a string, against the seconds it is on screen. */
const secondsToRead = (s) => (words(s) / WPM) * 60;

describe("Phase 4 — refusal copy fits its reading window (AC-4)", function () {
  let b, window, cleanup;
  const failSnapshots = (error) => {
    // Drive the gate through a failing snapshot, exactly as destructive_recovery.test.js does.
    window.createBackupSnapshot = async () => ({ ok: false, error });
  };

  beforeEach(function () {
    b = boot();
    window = b.window;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("every refusal message is SHORT ENOUGH to read in the window it has, under the slow rate", async function () {
    for (const error of ["quota", "serialization", "unavailable"]) {
      const msg = window.gateRefusalMessage(error);
      const need = secondsToRead(msg);
      const has = TOAST_MS / 1000;
      assert.ok(
        need <= has,
        `${error}: "${msg}" needs ~${need.toFixed(1)}s to read but is on screen ~${has.toFixed(1)}s ` +
          `(${words(msg)} words at ${WPM} wpm)`,
      );
      // and it is genuinely a sentence, not a fragment
      assert.ok(words(msg) >= 5, `${error}: still says something (${words(msg)} words)`);
    }
  });

  it("each one LEADS with the outcome — the user's first question is 'did my delete happen?'", function () {
    for (const error of ["quota", "serialization", "unavailable"]) {
      const msg = window.gateRefusalMessage(error);
      assert.ok(
        /^Nothing was changed/i.test(msg),
        `${error}: the outcome must be the first thing read — got "${msg}"`,
      );
      // and the cause still rides along, after the outcome
      const cause = error === "quota" ? /storage is full/i
        : error === "serialization" ? /could not be serialized/i : /storage unavailable/i;
      assert.ok(cause.test(msg), `${error}: names its own cause — got "${msg}"`);
    }
  });

  it("the REASONING IS MOVED, not deleted: the long form survives and answers the real question (AC-4)", function () {
    for (const error of ["quota", "serialization", "unavailable"]) {
      const detail = window.gateRefusalDetail(error);
      assert.ok(detail && detail.length > 0, `${error}: a long form exists`);
      // THE question the short form cannot answer: why is a BACKUP involved in my delete?
      assert.ok(/backup/i.test(detail), `${error}: explains the backup's role — got "${detail}"`);
      assert.ok(
        /refused, not applied|never made/i.test(detail),
        `${error}: says the refusal is deliberate, not a failure — got "${detail}"`,
      );
      assert.ok(
        /[Nn]othing in your sheet was altered/.test(detail),
        `${error}: reassures about the sheet's state — got "${detail}"`,
      );
      // It is LONGER than the toast — i.e. it is the part that was moved, not a copy.
      assert.ok(
        words(detail) > words(window.gateRefusalMessage(error)),
        `${error}: the detail is the fuller form`,
      );
    }
  });

  it("the long form is reachable as a dialog that STAYS, with its own title", async function () {
    failSnapshots("quota");
    const res = await window.gateDestructive("Delete layer");
    assert.strictEqual(res.ok, false, "the gate RefUSES (the action must not happen)");
    assert.ok(typeof res.showDetail === "function", "the refusal carries a route to the detail");

    res.showDetail();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const overlay = document.querySelector(".be-modal-overlay");
    assert.ok(overlay, "the detail opened in a modal");
    // The dialog says the OUTCOME as its title, and carries the long form as its body.
    assert.ok(
      /Nothing was changed/.test(overlay.textContent),
      `the dialog states the outcome — got "${overlay.textContent.slice(0, 120)}"`,
    );
    assert.ok(
      /backup/i.test(overlay.textContent) && /refused, not applied/i.test(overlay.textContent),
      "…and carries the moved reasoning",
    );
    // It uses the SHARED shell, so the standard close paths work (not a bespoke overlay).
    assert.ok(
      overlay.querySelector("button"),
      "the shared shell renders its own controls (Escape / close / backdrop)",
    );
  });

  it("nothing in the refusal path lost a cause it used to name (the re-cut was not a truncation)", async function () {
    // The pre-Phase-4 text named a cause for each of the three errors and said the action did
    // not happen. Both must still be true after the re-cut — this is the assertion that would
    // catch a "shorten it" edit which quietly dropped one.
    for (const error of ["quota", "serialization", "unavailable"]) {
      const msg = window.gateRefusalMessage(error);
      assert.ok(/Nothing was changed/i.test(msg), `${error}: outcome kept`);
      assert.ok(
        /retry|try again|serialized/i.test(msg),
        `${error}: a next step or a terminal explanation survives — got "${msg}"`,
      );
    }
  });
});
