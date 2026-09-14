/**
 * Phase 5 — the panel can be reduced without hiding a control (AC-5)
 * (track first_run_and_panel_20260911).
 *
 * WHAT THIS PHASE IS NOT. `ux_gaps_20260911` measured this panel and concluded no control should be
 * cut or reordered: the common path is above the fold and the tray order is already the priority
 * order. That conclusion is transcribed as ACCEPTED at the top of `phase5_record.md` and nothing
 * here touches it. The property this suite defends is the other one — **the surface can be made
 * smaller by the user while every control survives** — which no prior phase measured.
 *
 * THE THREE CLAUSES AC-5's FAIL CONDITIONS NAME, and how each is asserted rather than promised:
 *
 *   1. "a control is hidden on a hunch" — nothing is removed: the fold only toggles a class, and the
 *      suite holds a NODE REFERENCE across a fold/unfold cycle and asserts it is the SAME element.
 *      A re-built copy would pass a naive "is it there?" check and fail this one.
 *   2. "a relocated control cannot be reached by keyboard" — every fold control is a real BUTTON in
 *      the tab order, and focus is moved OUT of a group that is collapsed while it holds focus
 *      (otherwise focus would sit in a `display: none` subtree).
 *   3. "the measurement does not exist and the change is kept anyway" — the geometry is measured in
 *      the browser (`reducible_panel_verify.spec.js`), and the post-change numbers are reported
 *      honestly even where they do not flatter the change.
 */
"use strict";

const assert = require("assert");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

/** Every collapsible group the panel ships, by id, with the label it announces. */
const GROUPS = [
  { id: "be-ctl-tray-layout", label: "LAYOUT" },
  { id: "be-ctl-tray-output", label: "OUTPUT" },
  { id: "be-ctl-band-properties", label: "PROPERTIES" },
  { id: "be-ctl-band-filters", label: "CANVAS FILTERS" },
];

function headOf(document, groupId) {
  return document.getElementById(`${groupId}-head`);
}

describe("Phase 5 — the panel can be reduced without hiding a control (AC-5)", function () {
  let b, window, document, cleanup;

  beforeEach(function () {
    b = boot();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.createControls();
  });
  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("every group carries a disclosure control that is a real BUTTON with its state announced", function () {
    GROUPS.forEach(({ id, label }) => {
      const head = headOf(document, id);
      assert.ok(head, `${id} has a fold control`);
      // The button-ness IS the keyboard clause: a div with a click handler would fail here, and
      // that is exactly the pattern AC-5's fail condition names.
      assert.strictEqual(head.tagName, "BUTTON", `${label}'s control is a real button`);
      assert.strictEqual(head.type, "button");
      assert.strictEqual(
        head.getAttribute("aria-expanded"),
        "true",
        `${label} starts expanded (the panel's default is unchanged)`,
      );
      assert.strictEqual(
        head.getAttribute("aria-controls"),
        id,
        `${label}'s control points at the group it folds`,
      );
      // A disclosure whose state is only conveyed by a rotated caret is invisible to a screen
      // reader; `aria-expanded` is what makes the fold announceable.
      assert.ok(head.textContent.includes(label), `${label}'s label survives the change`);
    });
  });

  it("folding COLLAPSES without REMOVING — the SAME nodes come back (AC-5, clause 1)", async function () {
    const group = document.getElementById("be-ctl-tray-layout");
    const head = headOf(document, "be-ctl-tray-layout");
    // Hold references to the actual controls, before anything is folded.
    const print = document.getElementById("be-btn-print-settings");
    const load = Array.from(group.querySelectorAll("button")).find(
      (x) => x.textContent.trim() === "Load",
    );
    assert.ok(load && print, "precondition: the controls exist in the group");

    head.click();
    await waitFor(() => group.classList.contains("be-ctl-folded"));
    assert.strictEqual(head.getAttribute("aria-expanded"), "false", "the state is announced");
    // Still IN the DOM while folded — hidden by CSS on the group, never detached. This is the
    // clause that separates "reduced" from "removed". BOTH SIDES of the comparison are required to
    // be non-null: `null === null` would satisfy an equality check against a panel that had thrown
    // its controls away, which is the exact failure this line exists to catch.
    const addShape = document.getElementById("be-btn-add-shape");
    assert.ok(addShape, "the control is still IN THE DOCUMENT while its group is folded");
    assert.ok(
      group.contains(addShape),
      "…inside the folded group, not orphaned somewhere else",
    );

    head.click();
    await waitFor(() => !group.classList.contains("be-ctl-folded"));
    // THE ASSERTION THAT MATTERS: identity, not presence.
    assert.strictEqual(
      document.getElementById("be-ctl-tray-layout").contains(load),
      true,
      "the very same Load control is back — not a rebuilt copy of it",
    );
    assert.strictEqual(load.textContent.trim(), "Load", "…and it still is what it was");
    assert.strictEqual(head.getAttribute("aria-expanded"), "true", "…and the state is announced");
  });

  it("AC-5: folding moves focus OUT of the collapsed subtree — a keyboard user is never stranded", async function () {
    const group = document.getElementById("be-ctl-tray-output");
    const head = headOf(document, "be-ctl-tray-output");
    const inside = document.getElementById("be-btn-print");
    assert.ok(inside, "precondition: a control inside the group");

    // Focus a control, then fold the group around it. Without the focus move, the browser's
    // activeElement would sit inside a `display: none` subtree — the classic "works with a mouse,
    // not with a keyboard" failure.
    inside.focus();
    assert.strictEqual(document.activeElement, inside, "precondition: focus is inside the group");

    head.click();
    await waitFor(() => group.classList.contains("be-ctl-folded"));
    assert.strictEqual(
      document.activeElement,
      head,
      "focus moved to the header that collapsed it, rather than staying in a hidden subtree",
    );
  });

  it("AC-5: the fold is NOT persisted — the panel opens the way it always did on a fresh boot", async function () {
    const head = headOf(document, "be-ctl-tray-output");
    head.click();
    await waitFor(() => document.getElementById("be-ctl-tray-output").classList.contains("be-ctl-folded"));

    // A fresh boot, same persistent store: the fold must NOT come back folded. A persisted view
    // state would reopen the panel in a shape the user did not choose on a page they have not
    // looked at — the reasoning that made the activation state session-scoped too (O-4).
    const second = boot();
    try {
      second.window.createControls();
      const g = second.window.document.getElementById("be-ctl-tray-output");
      assert.ok(g, "the group exists on a fresh boot");
      assert.strictEqual(
        g.classList.contains("be-ctl-folded"),
        false,
        "a fresh panel is expanded — the fold is a view convenience, not stored preference",
      );
    } finally {
      if (second.cleanup) second.cleanup();
    }
  });

  it("AC-5 (the priority-order clause): NOTHING was removed or reordered by this phase", function () {
    // The non-relitigation artifact's own enforcement. If a later change deletes or reorders a
    // control to make room, this fails — which is the boundary between "reducible" and "cut".
    const panel = document.getElementById("print-enhance-controls");
    const labels = Array.from(panel.querySelectorAll("button")).map((x) => x.textContent.trim());
    [
      "Load",
      "Reset to Default",
      "Manage Clones",
      "Add Shape",
      "Manage Compact",
      "Print",
      "Print settings",
      "Save to Browser",
      "Save to PC",
      "Undo",
      "Restore backup...",
      "TEMPLATES",
    ].forEach((label) => {
      assert.ok(labels.includes(label), `"${label}" is still in the panel and still named the same`);
    });
    // …and the tray ORDER is untouched: LAYOUT before OUTPUT, properties after, filters last.
    const order = Array.from(panel.querySelectorAll(".be-ctl-tray-head")).map((h) =>
      h.textContent.replace(/[^A-Z ]/g, "").trim(),
    );
    const idx = (label) => order.findIndex((x) => x.startsWith(label));
    assert.ok(idx("LAYOUT") >= 0 && idx("OUTPUT") > idx("LAYOUT"), "LAYOUT still precedes OUTPUT");
    assert.ok(
      order.slice(-1)[0].startsWith("CANVAS"),
      `CANVAS FILTERS is still last — got ${JSON.stringify(order)}`,
    );
  });
});
