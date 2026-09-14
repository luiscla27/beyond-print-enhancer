/**
 * Destructive-action recovery — Phase 1: the snapshot gate (AC-1, AC-2, AC-6).
 *
 * Track: destructive_recovery_20260911.
 *
 * WHAT THIS PROVES, and why each part is here:
 *
 *  * AC-1 — the gate is INVOKED by the destructive paths (driven as a spy, so this
 *    is behavioural: the action reaches the gate), a backup record is written with a
 *    reason naming that action, and — the part that matters — a FAILED snapshot
 *    REFUSES the action, asserted by the element SURVIVING. The negative control is
 *    falsified in-place (see the last describe) rather than trusted.
 *  * AC-2 — the reason is specific (names the action and its subject), not "manual".
 *  * AC-6 — each classified failure produces its OWN actionable sentence, and no
 *    refusal is generic.
 *
 * The fail-OPEN seam is pinned too: `js/dom/layer_manager.js` and
 * `js/section_cloning.js` are evaluated BEFORE `js/persistence.js`, so they resolve
 * `window.gateDestructive` per call. If that binding ever disappeared, every gate
 * would silently pass — so its presence after a full boot is asserted here. (This
 * is the lesson from the hint-dismissal defect on the sibling track, where a test
 * that stubbed a seam hid the fact that the seam never existed in production.)
 */
"use strict";

const assert = require("assert");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

/**
 * The harness eval's `js/dom/layer_manager.js` in a scope where `module` exists, so
 * the file takes its `module.exports` branch and `window.LayerManager` stays
 * UNDEFINED — which makes `DomManager.getLayerManager()` return null and no layer
 * panel is ever built. In a real browser `module` is absent and the file sets
 * `window.LayerManager` itself, so this is a harness quirk, not a product defect:
 * bind it here so the layer panel (and therefore the layer/row controls this suite
 * drives) can be built at all.
 */
const LayerManager = require("../../js/dom/layer_manager.js");

/** Boot the fixture AND build the layer panel, which the row controls live in. */
function bootWithPanel(window) {
  window.LayerManager = window.LayerManager || LayerManager;
  const lm = window.DomManager.getInstance().getLayerManager();
  assert.ok(lm && lm.panel, "the layer panel must exist for these paths to be drivable");
  return lm;
}

const DELETE_HTML = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <!-- The WRAPPER carries the id: the layer panel keys its chips on the wrapper
           (data-target-id = el.id), so a wrapper without an id produces an empty
           chip id and the batch delete has nothing addressable to remove. -->
      <div class="be-section-wrapper" id="wrapper-main">
        <div class="ct-subsection" id="section-main">
          <div class="print-section-header"><span>Main</span></div>
        </div>
      </div>
      <div class="be-section-wrapper" id="wrapper-clone">
        <div class="ct-subsection" id="clone-42">
          <div class="print-section-header"><span>Clone</span></div>
        </div>
      </div>
    </div>
    <div id="print-enhance-shapes-layer">
      <div class="be-shape-layer-container" id="shapes-default">
        <div class="be-shape-wrapper" id="shape-wrapper">
          <div class="be-shape-container" id="shape-x"><img src="a.png" /></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

/** A spy over the real gate: records the reasons, delegates to the real thing. */
function spyOnGate(window) {
  const calls = [];
  const real = window.gateDestructive;
  window.gateDestructive = async (reason) => {
    calls.push(reason);
    return real(reason);
  };
  return calls;
}

/** Force every snapshot to fail, so the refusal path can be observed. */
function failSnapshots(window, error = "quota") {
  window.createBackupSnapshot = async () => ({ ok: false, error });
}

/** The last feedback message the product raised (the refusal copy). */
function captureFeedback(window) {
  const seen = [];
  window.showFeedback = (msg, type) => seen.push({ msg, type });
  return seen;
}

async function driveConfirmDialog(document) {
  await new Promise((r) => setTimeout(r, 0));
  const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
  assert.ok(ok, "the in-app confirm should be shown");
  ok.click();
  await new Promise((r) => setTimeout(r, 0));
}

describe("destructive recovery — the gate is wired where it must be (AC-1)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(DELETE_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("binds window.gateDestructive in a full boot (the seam the early modules need)", function () {
    // js/dom/layer_manager.js and js/section_cloning.js resolve this at call time;
    // without the binding their gates fail OPEN, so its existence is load-bearing.
    assert.strictEqual(
      typeof window.gateDestructive,
      "function",
      "window.gateDestructive must exist after a full boot — the destructive paths in " +
        "layer_manager/section_cloning depend on it",
    );
    assert.strictEqual(
      typeof window.Persistence.gateDestructive,
      "function",
      "…and the namespace export must expose it too",
    );
  });

  it("gates the LAYER delete, writing a backup whose reason names the layer", async function () {
    bootWithPanel(window);
    const calls = spyOnGate(window);
    window.injectCloneButtons();
    const row = document.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
    assert.ok(row, "a shape-layer row exists");

    const before = (await window.listBackups()).length;
    row.querySelector(".be-delete-layer-btn").click();
    await driveConfirmDialog(document);

    assert.strictEqual(calls.length, 1, "the gate was invoked exactly once");
    assert.ok(
      /Delete layer/.test(calls[0]),
      `the reason names the action: ${calls[0]}`,
    );
    const after = await window.listBackups();
    assert.strictEqual(after.length, before + 1, "exactly one backup was written");
    assert.ok(
      /Delete layer/.test(after[0].reason),
      `the stored reason is the rendered one: ${after[0].reason}`,
    );
    // Wait for the EFFECT: the delete runs after the gate's storage round-trip, so
    // asserting on a single tick observes the pre-delete DOM. (The same mistake was
    // fixed in three older suites in Phase 1 — it is worth remembering that a
    // durability step lengthens every destructive action's async tail.)
    await waitFor(() => document.getElementById("print-enhance-shapes-layer") === null);
    assert.strictEqual(
      document.getElementById("print-enhance-shapes-layer"),
      null,
      "the layer container really was deleted (the gate did not block a good snapshot)",
    );
  });

  it("gates the in-sheet SHAPE delete", async function () {
    const calls = spyOnGate(window);
    window.injectCloneButtons();
    const wrapper = document.getElementById("shape-wrapper");
    wrapper.querySelector(".be-shape-delete").click();
    await driveConfirmDialog(document);

    assert.strictEqual(calls.length, 1, "the gate was invoked once for the shape delete");
    assert.strictEqual(calls[0], "Delete shape", `reason is specific: ${calls[0]}`);
    await waitFor(() => document.getElementById("shape-wrapper") === null);
    assert.strictEqual(document.getElementById("shape-wrapper"), null, "shape removed");
  });

  it("gates the CLONE delete", async function () {
    const calls = spyOnGate(window);
    const snapshot = {
      id: "clone-delete-test",
      originalId: "section-main",
      title: "To Delete",
      html: "<p>Content</p>",
    };
    const wrapper = window.renderClonedSection(snapshot);
    assert.ok(wrapper, "renderClonedSection produced a wrapper");
    wrapper.querySelector(".be-clone-delete").click();
    await driveConfirmDialog(document);

    assert.strictEqual(calls.length, 1, "the gate was invoked once for the clone delete");
    assert.ok(
      /Delete/.test(calls[0]) && /To Delete|clone/i.test(calls[0]),
      `the reason names the clone: ${calls[0]}`,
    );
    await waitFor(() => document.getElementById("clone-delete-test") === null);
    assert.strictEqual(
      document.getElementById("clone-delete-test"),
      null,
      "the clone was removed",
    );
  });

  it("gates the BATCH delete of selected chips (reason carries the count)", async function () {
    const lm = bootWithPanel(window);
    lm.refreshLayerContents();
    const chipIds = Array.from(
      document.querySelectorAll("#print-enhance-layer-manager [data-target-id]"),
    ).map((c) => c.dataset.targetId);
    assert.ok(chipIds.length >= 2, `need 2 chips, got ${chipIds.length}`);

    const calls = spyOnGate(window);
    lm.toggleChipSelection(chipIds[0], true);
    lm.toggleChipSelection(chipIds[1], true);
    assert.strictEqual(
      lm.selectedChipIds().length,
      2,
      `precondition: two chips selected (got ${JSON.stringify(lm.selectedChipIds())})`,
    );
    const done = lm.deleteSelectedChips(); // drives its own confirm
    await driveConfirmDialog(document);
    await done;

    assert.strictEqual(calls.length, 1, "the gate was invoked once for the batch");
    assert.ok(
      /Delete 2 selected shapes/.test(calls[0]),
      `the reason names the count: ${calls[0]}`,
    );
  });
});

describe("destructive recovery — a failed snapshot REFUSES the action (AC-1, AC-6)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(DELETE_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("refuses the LAYER delete when no backup can be written, and says why", async function () {
    bootWithPanel(window);
    failSnapshots(window, "quota");
    const feedback = captureFeedback(window);
    window.injectCloneButtons();

    const row = document.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
    row.querySelector(".be-delete-layer-btn").click();
    await driveConfirmDialog(document);
    await waitFor(() => feedback.length > 0);

    // THE point of AC-1: the destructive action did NOT happen.
    assert.ok(
      document.getElementById("print-enhance-shapes-layer"),
      "the layer container MUST survive when the backup cannot be written",
    );
    assert.strictEqual(feedback.length, 1, "the user was told once");
    assert.strictEqual(feedback[0].type, "error", "…as an error, not a success");
    assert.ok(
      /storage is full/i.test(feedback[0].msg),
      `the message names the real cause and the next step: ${feedback[0].msg}`,
    );
  });

  it("refuses the SHAPE delete when no backup can be written", async function () {
    failSnapshots(window, "unavailable");
    const feedback = captureFeedback(window);
    window.injectCloneButtons();

    document.getElementById("shape-wrapper").querySelector(".be-shape-delete").click();
    await driveConfirmDialog(document);
    await waitFor(() => feedback.length > 0);

    assert.ok(
      document.getElementById("shape-wrapper"),
      "the shape MUST survive when the backup cannot be written",
    );
    assert.ok(
      /Reload the page and try again/i.test(feedback[0].msg),
      `the 'unavailable' cause is named specifically: ${feedback[0].msg}`,
    );
  });

  it("names each cause differently and never generically (AC-6)", async function () {
    for (const [error, expected] of [
      ["quota", /storage is full/i],
      ["serialization", /could not be serialized/i],
      ["unavailable", /storage unavailable/i],
    ]) {
      failSnapshots(window, error);
      const res = await window.gateDestructive(`probe ${error}`);
      assert.strictEqual(res.ok, false, `${error}: the gate must refuse`);
      assert.strictEqual(res.error, error, `${error}: the cause is passed through`);
      assert.ok(
        expected.test(res.message),
        `${error}: its own actionable sentence — got "${res.message}"`,
      );
      assert.ok(
        /nothing was changed/i.test(res.message),
        `${error}: the message says the action did not happen`,
      );
    }
  });

  it("a successful snapshot does NOT block, and reports the record", async function () {
    const res = await window.gateDestructive("Delete shape");
    assert.strictEqual(res.ok, true, "a good snapshot must not block the action");
    assert.ok(res.record && res.record.reason === "Delete shape", "the record rides back");
  });
});

describe("destructive recovery — the negative control is falsifiable (AC-1)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = boot(DELETE_HTML);
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("demonstrates the abort assertion can FAIL: bypass the gate and the layer dies", async function () {
    // If the gate were removed (or failed open), the delete would proceed even with a
    // broken snapshot — that is the defect this AC exists to prevent. This case makes
    // the abort assertion falsifiable by REVERSING it deliberately: disable the gate,
    // drive the same action, and observe the element DISAPPEAR.
    bootWithPanel(window);
    failSnapshots(window, "quota");
    window.gateDestructive = async () => ({ ok: true, missing: false }); // the "regression"

    window.injectCloneButtons();
    const row = document.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
    row.querySelector(".be-delete-layer-btn").click();
    await driveConfirmDialog(document);
    await waitFor(() => document.getElementById("print-enhance-shapes-layer") === null);

    assert.strictEqual(
      document.getElementById("print-enhance-shapes-layer"),
      null,
      "with the gate disarmed the layer IS deleted — proving the abort assertions " +
        "above are not vacuous (they fail when the protection is gone)",
    );
  });
});
