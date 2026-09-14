/**
 * Phase 1 — the two gesture surfaces converge, and the first points at the second
 * (track first_run_and_panel_20260911, AC-1a / AC-1b / AC-1c).
 *
 * WHY THIS SUITE EXISTS. The product taught the gesture model TWICE and differently. The first-run
 * card named three gestures in one sentence; the `?` reference listed eight; and five of the eight
 * were taught nowhere at first contact. Worse, the two surfaces had no path between them: the
 * card's only control was its PERMANENT dismiss, so the product's single moment of instruction
 * ended by deleting itself and pointing nowhere. Measured before this was written
 * (`phase0_remeasurement.md` §F-1):
 *
 *   grep -c "{ what:" js/controls.js   ->  8     (the reference list)
 *   the card's sentence                 ->  3     (the taught set)
 *
 * WHY THE ASSERTION IS AN EXACT EQUALITY AND NOT AN `includes`. Every existing label assertion in
 * this project is a substring match (`test/unit/filters_ui.test.js:125,132,211,229`), which is why
 * the standing rule this track adopted says a string assertion must not be satisfiable by
 * corruption. `assert(text.includes("Drag"))` passes on
 * "Please do not Drag anything" and would also pass on a mojibake'd label. The central assertion
 * here compares the card's rendered text to the product's OWN derivation, character for character,
 * so it can only pass when the card says exactly what `HELP_GESTURES` says it should.
 *
 * THE ANTI-VACUITY PROPERTY. Deriving the card's content makes `card ⊆ HELP_GESTURES` structurally
 * true — which would make a test of that relation worthless. What is NOT structurally true, and is
 * therefore what this suite actually asserts, is that the card's rendered text is EXACTLY the
 * derivation. Hardcoding a phrase back onto the card (the regression that caused the original drift)
 * turns it red, and that falsification was RUN before this suite was trusted.
 */
"use strict";

const assert = require("assert");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

/** Mount a fresh card and hand back the live nodes. */
async function mountCard(window, document) {
  await window.Controls.mountOnboardingHint();
  await waitFor(() => document.getElementById("be-onboarding-hint"));
  const card = document.getElementById("be-onboarding-hint");
  assert.ok(card, "precondition: the first-run card is mounted on a fresh state");
  return card;
}

describe("Phase 1 — gesture surfaces converge (AC-1)", function () {
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

  it("AC-1a: the card's rendered text is EXACTLY what HELP_GESTURES derives — not merely compatible with it", async function () {
    const card = await mountCard(window, document);
    const rendered = card.querySelector(".be-onboarding-hint-text").textContent;

    // Both sides are the SHIPPED product: the rendered DOM node, and the product's own derivation
    // read off its seam. Nothing here is re-typed, so a change to the list moves both together and
    // this test cannot pass against a stale copy of the content.
    const expected = window.cardHintText();
    assert.strictEqual(
      rendered,
      expected,
      "the card must render the derivation from HELP_GESTURES, character for character",
    );

    // …and the derivation must actually be doing work: a card that rendered an empty string would
    // satisfy the equality above if the list ever lost its phrases.
    assert.ok(
      expected.length > 20,
      `the derivation must produce a real sentence, got: "${expected}"`,
    );
  });

  it("AC-1a: every gesture the card teaches EXISTS in the reference list, matched as whole phrases", async function () {
    const card = await mountCard(window, document);
    const rendered = card.querySelector(".be-onboarding-hint-text").textContent;
    const listed = window.HELP_GESTURES;

    const taught = window.cardGesturePhrases();
    assert.strictEqual(taught.length, 3, `the card teaches three gestures, got ${taught.length}`);

    // The invariant AC-1a names, checked as whole phrases rather than as loose substrings: each
    // phrase the card teaches must come from an entry that is IN the list the reference renders.
    taught.forEach((phrase) => {
      const owner = listed.find((g) => g.card === phrase);
      assert.ok(
        owner,
        `the card teaches "${phrase}" but no HELP_GESTURES entry owns it — ` +
          `the two surfaces have drifted`,
      );
      assert.ok(
        rendered.includes(phrase),
        `"${phrase}" is owned by HELP_GESTURES ("${owner.what}") but the card does not render it`,
      );
    });

    // The other direction, and the one that would have caught the original defect: no phrase may
    // reach the card without an entry behind it.
    const explained = taught.join(" ");
    rendered.split(/, or |, /).forEach((fragment) => {
      const piece = fragment.trim();
      assert.ok(
        piece === "" || explained.toLowerCase().includes(piece.toLowerCase()),
        `the card renders "${piece}", which no HELP_GESTURES entry accounts for`,
      );
    });
  });

  it("AC-1b: the card carries a keyboard-reachable control that opens the SHARED help surface", async function () {
    const card = await mountCard(window, document);
    const more = card.querySelector(".be-onboarding-hint-more");
    // GATE 3 defect D1: the existence assertion comes FIRST and NAMES the control, so removing it
    // fails on a diagnostic message rather than on a null dereference (`more.focus()`). Phase 5 is
    // held to an explicit "the failure must name the offender" standard; a test that dies on a
    // TypeError does not meet it, so it does not meet it here either.
    assert.ok(
      more,
      "the card must carry a path to the gestures reference (`.be-onboarding-hint-more`), " +
        "which is what makes the taught gestures open into the full list instead of a dead end",
    );

    // Keyboard reachability is a property of the ELEMENT, not a claim about intent: a real button
    // is focusable and Enter/Space activate it. A div with a click handler would fail here.
    assert.strictEqual(more.tagName, "BUTTON", "it is a real button, so the keyboard can reach it");
    assert.strictEqual(more.type, "button");
    assert.ok(
      !more.disabled,
      "it is enabled — a disabled control is not a path",
    );
    more.focus();
    assert.strictEqual(
      document.activeElement,
      more,
      "focus() must actually land on it (an unlit path is not a path)",
    );
    assert.ok(
      /gesture|shortcut/i.test(more.getAttribute("aria-label") || ""),
      `it is named for what it opens — got "${more.getAttribute("aria-label")}"`,
    );

    more.click();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    const overlay = document.querySelector(".be-modal-overlay");
    assert.ok(overlay, "clicking it opens the reference");
    // The SHARED shell, not a second bespoke overlay — that is what supplies the dialog role, the
    // accessible name, Escape, the backdrop and the focus trap (track modal_primitive_20260910).
    assert.ok(overlay.querySelector(".be-modal"), "the shared modal element is used");
    assert.ok(
      overlay.querySelector('[aria-modal="true"]'),
      "…and it is a modal dialog",
    );
  });

  it("AC-1b: the card SURVIVES opening the reference — teaching it does not delete it", async function () {
    const card = await mountCard(window, document);
    card.querySelector(".be-onboarding-hint-more").click();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);

    assert.strictEqual(
      document.getElementById("be-onboarding-hint"),
      card,
      "the card is still mounted after the reference is opened",
    );
    assert.strictEqual(
      await window.Controls.hintDismissed(),
      false,
      "…and opening the reference does NOT count as a dismissal",
    );
  });

  it("AC-1c: the card's accessible name no longer claims to cover the sheet's gestures as a set", async function () {
    const card = await mountCard(window, document);
    const label = card.getAttribute("aria-label") || "";

    assert.notStrictEqual(
      label,
      "How to arrange this sheet",
      "the old label claimed the whole gesture set while the card teaches three of eight",
    );
    assert.ok(
      /^(a few|few|some|three|3)\b/i.test(label),
      `the name must SCOPE itself to the subset it teaches — got "${label}"`,
    );
    // A scoped name is only honest if it is also accurate: the "three" it names must match the
    // number of gestures the card actually renders.
    if (/\b(three|3)\b/i.test(label)) {
      assert.strictEqual(
        window.cardGesturePhrases().length,
        3,
        "the name says three, so the card must teach exactly three",
      );
    }
  });
});
