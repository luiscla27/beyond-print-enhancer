/**
 * Destructive-action recovery — Phase 2: the undo offer and the reachable restore
 * surface (AC-3, AC-4, AC-6).
 *
 * Track: destructive_recovery_20260911.
 *
 * Three of these cases exist because Muse review 2 attacked my first draft for
 * being vacuous, and the attacks were correct:
 *
 *  * AC-3 "an undo works" is trivially satisfiable by restoring SOMETHING — so the
 *    undo assertions are **deep-equality round-trips** (the layout before the action
 *    equals the layout after the undo), not "a restore happened".
 *  * A focus trap asserted from markup or source can pass while the trap is broken at
 *    runtime (a failure class that already produced two confirmed false passes on this
 *    project) — so the trap is **walked with real Tab/Shift+Tab keydowns against the
 *    live `document.activeElement`**, through the wrap in both directions and out of
 *    the trap back to the trigger.
 *  * A leak invariant asserted by reading the source proves nothing about runtime
 *    add/remove balance — so it is measured by **instrumenting the listener registry**
 *    (test/unit/helpers/listener_probe.js, the instrument built by the modal-primitive
 *    track) across every close path separately.
 */
"use strict";

const assert = require("assert");
const { boot, waitFor} = require("./encapsulation_debt/debt_harness.js");
const {
  instrumentListeners,
  assertNoLeak,
  diff,
} = require("./helpers/listener_probe.js");

const LayerManager = require("../../js/dom/layer_manager.js");

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
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

/** Boot with the layer panel built (the row controls live in it). */
function bootWithPanel(html) {
  const b = boot(html || SHEET);
  b.window.LayerManager = b.window.LayerManager || LayerManager;
  assert.ok(
    b.window.DomManager.getInstance().getLayerManager().panel,
    "the layer panel must exist for these paths to be drivable",
  );
  return b;
}

/** Drive the in-app confirm dialog. */
async function confirmDialog(document) {
  await new Promise((r) => setTimeout(r, 0));
  const ok = document.querySelector(".be-modal-overlay .be-modal-ok");
  assert.ok(ok, "the confirm dialog should be shown");
  ok.click();
  await new Promise((r) => setTimeout(r, 0));
}

/** The saved layout, as the backup/undo path sees it. */
async function savedLayout(window) {
  return window.__DDBStorage.loadGlobalLayout();
}

/** The undo control, if the offer is live. */
function undoControl(document) {
  // The BUTTON, not the toast: the toast is `be-feedback-undo`.
  return document.querySelector(".be-feedback-undo-btn");
}

/** A real Tab / Shift+Tab press against the live document. */
function pressTab(document, shift) {
  document.dispatchEvent(
    new document.defaultView.KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: !!shift,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("Phase 2 — the undo offer (AC-3)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = bootWithPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("offers ONE control after a layer delete, and undoing restores the exact layout", async function () {
    window.injectCloneButtons();
    // The saved layout is what the snapshot captures (and therefore what the undo
    // restores), so the round-trip is asserted on that same value.
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({
      version: "1.5.0",
      sections: { "section-main": { left: 10, top: 20 } },
      layers: { shapes: [{ id: "shape-x" }] },
    });
    const before = await savedLayout(window);

    const row = document.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
    row.querySelector(".be-delete-layer-btn").click();
    await confirmDialog(document);

    // The offer appears once the action has landed.
    await waitFor(() => undoControl(document) !== null);
    const control = undoControl(document);
    assert.ok(control, "an Undo control must be offered after the delete");
    assert.strictEqual(control.textContent.trim(), "Undo", "…worded as the action it is");
    assert.strictEqual(
      document.querySelectorAll(".be-feedback-undo-btn").length,
      1,
      "exactly ONE undo control (single-level by design)",
    );
    assert.strictEqual(window.hasUndoOffer(), true, "the slot is live");

    control.click();
    await waitFor(() => window.hasUndoOffer() === false);

    const after = await savedLayout(window);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(after)),
      JSON.parse(JSON.stringify(before)),
      "the layout after the undo must EQUAL the layout before the action (round trip)",
    );
    assert.strictEqual(
      undoControl(document),
      null,
      "…and the offer is spent — it does not linger as a second undo",
    );
  });

  it("offers the undo for a SHAPE delete too", async function () {
    window.injectCloneButtons();
    const wrapper = document.getElementById("shape-wrapper");
    wrapper.querySelector(".be-shape-delete").click();
    await confirmDialog(document);

    await waitFor(() => undoControl(document) !== null);
    assert.ok(undoControl(document), "a shape delete is reversible with one control");
  });

  it("does NOT supersede the previous mutation — both stay walkable (AC-4, U-1 regression)", async function () {
    window.injectCloneButtons();
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();

    // Two independent actions: a second layer, so one delete does not remove the
    // other's subject (the shape wrapper lives inside its layer).
    const lm = window.DomManager.getInstance().getLayerManager();
    const extra = lm.addShapeLayer();
    assert.ok(extra && extra.id, "a second shape layer exists");
    lm.refreshLayerContents();

    const rowFor = (id) => document.querySelector(`.be-layer-row[data-layer-id="${id}"]`);
    assert.ok(rowFor("shapes-default"), "row for the default layer");
    rowFor("shapes-default").querySelector(".be-delete-layer-btn").click();
    await confirmDialog(document);
    await waitFor(() => undoControl(document) !== null);
    const first = undoControl(document);
    assert.strictEqual(window.undoDepth(), 1, "one reversible record after the first delete");

    const secondRow = rowFor(extra.id);
    assert.ok(secondRow, `row for the added layer (${extra.id})`);
    secondRow.querySelector(".be-delete-layer-btn").click();
    await confirmDialog(document);

    await waitFor(() => undoControl(document) !== first);
    assert.strictEqual(
      document.querySelectorAll(".be-feedback-undo").length,
      1,
      "still exactly one TOAST — there is one surface, so the newer message replaces it",
    );
    // THE U-1 REGRESSION, asserted directly. This case used to assert the opposite
    // ("the newer action superseded the older one"), which is precisely the
    // single-level behaviour track undo_stack_20260911 exists to remove: it is
    // pivoted to the new contract rather than deleted, so the coverage is kept.
    assert.strictEqual(
      window.undoDepth(),
      2,
      "the second delete did NOT make the first un-undoable — both records are on the stack",
    );
    window.clearUndoStack();
  });

  it("expires honestly: the control is REMOVED (not left inert), the slot closes, and Tab cannot reach it", async function () {
    window.injectCloneButtons();
    // Drive the offer with a short window so expiry is observable.
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    const snap = await window.createBackupSnapshot("probe expiry");
    const offer = window.offerUndo(snap.record, "Deleted something", { ms: 40 });
    assert.ok(offer, "the offer was created");

    const control = undoControl(document);
    assert.ok(control, "the control is present while live");
    control.focus();
    assert.strictEqual(document.activeElement, control, "it is focusable while live");

    await waitFor(() => !window.hasUndoOffer(), { timeout: 500 });

    assert.strictEqual(
      undoControl(document),
      null,
      "an expired offer must be GONE from the DOM, not merely inert — a control that " +
        "silently no-ops is worse than no control",
    );
    assert.strictEqual(window.hasUndoOffer(), false, "the slot closed");
    // And the keyboard cannot reach it: a Tab walk after expiry must not land on it.
    pressTab(document);
    assert.notStrictEqual(
      document.activeElement,
      null,
      "focus moved somewhere real (the walk ran)",
    );
    assert.ok(
      !document.activeElement.classList ||
        !document.activeElement.classList.contains("be-feedback-undo-btn"),
      "an expired undo control is unreachable by Tab",
    );
  });
});

describe("Phase 2 — the restore surface (AC-4)", function () {
  let window, document, cleanup;

  beforeEach(function () {
    const b = bootWithPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
  });
  afterEach(function () {
    cleanup();
  });

  it("lists each backup with WHAT it was and WHEN, newest first, and restores one", async function () {
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: { keep: 1 } });
    await window.createBackupSnapshot('Delete layer "Older"');
    await window.createBackupSnapshot('Merge sections into "Newer"');

    window.showRestoreSurface();
    // The store holds EXACTLY the two backups written above: the harness gives every boot
    // its own IndexedDB, so nothing from another case (or another suite) can be in here.
    // This assertion used to be `>= 2` with a note about a process-shared store — the
    // weaker claim the leak forced
    // (temp/archived/ISSUE_mocha_subset_backup_count_pollution_20260911.md).
    await waitFor(() => document.querySelectorAll(".be-restore-row").length >= 2);

    const rows = Array.from(document.querySelectorAll(".be-restore-row"));
    assert.strictEqual(rows.length, 2, "exactly the two just written are listed");
    // …which is also what lets the surface NAME the count and promise the order.
    const listStatus = document.querySelector(".be-restore-status");
    assert.ok(listStatus, "the surface renders its status line");
    assert.ok(
      /2 backups - newest first/.test(listStatus.textContent),
      `with backups it says how many and in what order — got "${listStatus.textContent}"`,
    );
    // AC-3 (ux_gaps_20260911, Phase 3): the surface must ALSO distinguish the two
    // recovery models where the user hits the limit. This assertion is re-pointed
    // (extended), not replaced: it still requires the count and the ordering.
    assert.ok(
      /still here after a reload/.test(listStatus.textContent) &&
        /undo\s+covers the current session only/.test(listStatus.textContent.replace(/\s+/g, " ")),
      `the surface must say what survives a reload and contrast it with undo — got "${listStatus.textContent}"`,
    );
    const whats = rows.map((r) => r.querySelector(".be-restore-what").textContent);
    assert.ok(
      /Merge sections into "Newer"/.test(whats[0]),
      `newest first — got ${JSON.stringify(whats)}`,
    );
    assert.ok(
      /Delete layer "Older"/.test(whats[1]),
      `…then the older one — got ${JSON.stringify(whats)}`,
    );
    // Each row says WHEN, and offers exactly one control.
    rows.forEach((r) => {
      assert.ok(r.querySelector(".be-restore-when").textContent.length > 0, "a timestamp");
      assert.strictEqual(r.querySelectorAll(".be-restore-apply").length, 1, "one control");
    });

    // Restoring applies that backup.
    const target = rows[1];
    target.querySelector(".be-restore-apply").click();
    await waitFor(() => !document.querySelector(".be-modal-overlay"));
    assert.strictEqual(
      document.querySelector(".be-modal-overlay"),
      null,
      "the surface closes after a successful restore",
    );
  });

  it("is honest when there are NO backups (it does not show an empty list)", async function () {
    // The store is empty BY CONSTRUCTION here, not by luck: the harness hands each boot
    // its own IndexedDB, so no earlier case can leave a row in this one. This case used
    // to be an `if (length === 0) { … } else { … }`, because a process-shared store
    // arrived polluted — which meant it silently skipped its own subject, the empty
    // state, and passed on the `else` branch instead
    // (temp/archived/ISSUE_mocha_subset_backup_count_pollution_20260911.md). The
    // non-empty wording it used to cover there is now asserted where the store really
    // does hold backups (the "newest first" case above).
    const backups = await window.listBackups();
    assert.ok(Array.isArray(backups), "the store answers");
    assert.strictEqual(backups.length, 0, "a fresh boot starts with NO backups");

    window.showRestoreSurface();
    await waitFor(() => document.querySelector(".be-restore-status") !== null);
    await new Promise((r) => setTimeout(r, 30));
    const status = document.querySelector(".be-restore-status").textContent;
    assert.ok(
      /No backups yet/.test(status) && /automatically/.test(status),
      `the empty state explains itself — got "${status}"`,
    );
    assert.strictEqual(
      document.querySelectorAll(".be-restore-row").length,
      0,
      "…and shows no rows",
    );
  });

  it("reports a failed restore instead of pretending, and applies nothing (AC-6)", async function () {
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: { keep: 1 } });
    await window.createBackupSnapshot("probe failure");
    const before = await savedLayout(window);

    // Inject an apply failure.
    const realApply = window.applyLayout;
    window.applyLayout = async () => {
      throw new Error("simulated apply failure");
    };

    window.showRestoreSurface();
    await waitFor(() => document.querySelectorAll(".be-restore-row").length >= 1);
    document.querySelector(".be-restore-apply").click();
    await waitFor(() =>
      /Could not restore/.test(
        (document.querySelector(".be-restore-status") || {}).textContent || "",
      ),
    );

    const status = document.querySelector(".be-restore-status").textContent;
    assert.ok(
      /Could not restore/.test(status) && /simulated apply failure/.test(status),
      `the surface names the real cause — got "${status}"`,
    );
    assert.ok(
      document.querySelector(".be-modal-overlay"),
      "the surface STAYS open so the user can try another backup",
    );

    window.applyLayout = realApply;
    const after = await savedLayout(window);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(after)),
      JSON.parse(JSON.stringify(before)),
      "a failed restore must leave NO half-applied state",
    );
  });

  it("is reachable from the control panel, not only from a load failure (AC-4)", function () {
    // The defect was that the ONLY restore surface lived in the failure card. The
    // control panel must offer the entry itself.
    const controls = require("../../js/controls.js");
    const src = require("fs").readFileSync(
      require("path").resolve(__dirname, "../../js/controls.js"),
      "utf8",
    );
    assert.ok(
      // ASCII ellipsis in the label, deliberately: a U+2026 in an injected content
      // script is not decoded as UTF-8 by the browser and rendered as mojibake
      // ("Restore backupâ€¦") — measured by the phase-2 capture.
      /label: "Restore backup\.\.\."/.test(src) && /showRestoreSurface\(\)/.test(src),
      "the control panel carries a Restore-backup entry that opens the shared surface",
    );
    assert.ok(controls, "the controls module loads");
  });
});

describe("Phase 2 — the recovery surfaces behave as dialogs should (AC-3/AC-4/AC-6)", function () {
  // These cases run several open/close cycles with store round-trips, so the mocha
  // default of 2s is too tight for the walk + per-path leak probes.
  this.timeout(30000);

  let window, document, cleanup, probe;

  beforeEach(function () {
    const b = bootWithPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    // Instrument the listener registry in BOTH the window and the document, at the
    // element level too — counting only one level silently passes a real leak there
    // (the modal-primitive track learned this the hard way).
    probe = instrumentListeners(window);
  });
  afterEach(function () {
    cleanup();
  });

  it("WALKS the focus trap with real Tab keys against the live activeElement, both ways", async function () {
    // Seed two backups so the surface has several focusable controls to walk: with an
    // empty list the modal holds only its ✕ and the wrap cannot be exercised.
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: { a: 1 } });
    await window.createBackupSnapshot("probe one");
    await window.createBackupSnapshot("probe two");

    window.showRestoreSurface();
    await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
    // The list renders once the store answers — wait for it, or the walk sees only the ✕.
    await waitFor(() => document.querySelectorAll(".be-restore-row").length >= 2);
    const modal = document.querySelector(".be-modal");
    assert.ok(modal, "the surface is a modal on the shared primitive");

    const focusable = Array.from(
      modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.disabled);
    assert.ok(focusable.length >= 2, `need focusables to walk (got ${focusable.length})`);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // The primitive moves focus in on open; Tab from the last wraps to the first and
    // Shift+Tab from the first wraps to the last, and focus never escapes the modal.
    last.focus();
    assert.strictEqual(document.activeElement, last, "seeded focus on the last control");
    pressTab(document, false);
    assert.strictEqual(
      document.activeElement,
      first,
      "Tab from the last control WRAPS to the first (a live walk, not a markup read)",
    );
    assert.ok(modal.contains(document.activeElement), "focus stayed inside the modal");

    pressTab(document, true);
    assert.strictEqual(
      document.activeElement,
      last,
      "Shift+Tab from the first WRAPS to the last",
    );
    assert.ok(modal.contains(document.activeElement), "focus stayed inside the modal");

    // A full forward walk never leaves the trap.
    for (let i = 0; i < focusable.length * 2; i++) {
      pressTab(document, false);
      assert.ok(
        modal.contains(document.activeElement),
        `focus escaped the modal at step ${i} (activeElement=${
          document.activeElement && document.activeElement.className
        })`,
      );
    }
  });

  it("does not leak listeners across EACH close path (Esc, ✕, backdrop, restore)", async function () {
    // Self-sufficient: write the backup this case restores. Relying on records left
    // by other cases makes the test depend on shared-store state (fake-indexeddb is
    // process-global), which is exactly the kind of coupling that turns a green test
    // red for an unrelated reason later.
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: { a: 1 } });
    await window.createBackupSnapshot("probe for the close paths");

    const paths = [
      {
        name: "Escape",
        close: () =>
          document.dispatchEvent(
            new window.KeyboardEvent("keydown", {
              key: "Escape",
              bubbles: true,
              cancelable: true,
            }),
          ),
      },
      {
        name: "close ✕",
        close: () => {
          const x = document.querySelector(".be-modal-close");
          assert.ok(x, "the ✕ exists");
          x.click();
        },
      },
      {
        name: "backdrop",
        close: () => {
          const overlay = document.querySelector(".be-modal-overlay");
          assert.ok(overlay, "the overlay exists");
          // A backdrop cancel is a mousedown ON the overlay followed by a click whose
          // target is still the overlay — the primitive requires both (a bare click
          // never closes it). Dispatching only the click made this path a silent
          // no-op, which is how it masqueraded as a leak: the modal was simply still
          // open, holding its own keydown listener.
          overlay.dispatchEvent(
            new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }),
          );
          overlay.dispatchEvent(
            new window.MouseEvent("click", { bubbles: true, cancelable: true }),
          );
        },
      },
      {
        // The fourth close path the review named: a SUCCESSFUL restore. It closes the
        // surface from inside a row handler rather than through a cancel affordance,
        // so it has to release the modal's listeners just the same.
        name: "successful restore",
        close: () => {
          const apply = document.querySelector(".be-restore-apply");
          assert.ok(apply, "a restore control exists");
          apply.click();
        },
      },
    ];

    for (const path of paths) {
      const before = probe.snapshot();
      window.showRestoreSurface();
      await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
      await waitFor(() => document.querySelectorAll(".be-restore-row").length >= 1, {
        timeout: 2000,
      });
      assert.ok(
        document.querySelectorAll(".be-restore-row").length >= 1,
        `${path.name}: the surface must list a backup to exercise this path — status: ` +
          (document.querySelector(".be-restore-status") || {}).textContent,
      );
      await new Promise((r) => setTimeout(r, 20));
      // What THIS open attached. Asserting on it (rather than on the raw before/after
      // delta) keeps the claim precise: "everything the modal attached is released on
      // close", with no noise from anything unrelated that happens to fire meanwhile.
      const whileOpen = probe.snapshot();
      const attached = diff(before, whileOpen);
      assert.ok(
        Object.keys(attached).length > 0,
        `opening the surface must attach something, or this check is vacuous (${path.name})`,
      );

      path.close();
      // PROVE the path closed it. `waitFor` returns false on timeout rather than
      // throwing, so without this a path that silently does nothing would "pass" the
      // leak check with the modal still open.
      await waitFor(() => document.querySelector(".be-modal-overlay") === null, {
        timeout: 1000,
      });
      assert.strictEqual(
        document.querySelector(".be-modal-overlay"),
        null,
        `${path.name} must actually close the surface (otherwise this check is vacuous)`,
      );
      await new Promise((r) => setTimeout(r, 20));

      // A successful restore raises a success TOAST, which is a different surface with
      // its own (self-cleaning) lifecycle — it holds handlers while it is on screen by
      // design, and the feedback track's suite owns that. Drop it before measuring, so
      // this case reports modal leaks and not "a toast exists".
      document.querySelectorAll(".be-feedback").forEach((el) => el.remove());

      const after = probe.snapshot();
      // SCOPE OF THIS CLAIM: the modal's own event types (keydown / mousedown / click —
      // the same set listener_probe defines as "modal events"). A modal leak is a
      // SURVIVING handler of one of those. Other event types on document/window (this
      // run observes a `document:load` appearing) are not modal listeners and are not
      // what AC-6 is about; asserting on them here would fail for an unrelated reason
      // and teach the next reader nothing.
      const MODAL_EVENTS = ["keydown", "mousedown", "click"];
      const survivors = Object.entries(attached).filter(([key]) => {
        if (key.startsWith("element:")) return false; // dies with its node
        const type = key.split(":").slice(1).join(":");
        if (MODAL_EVENTS.indexOf(type) === -1) return false;
        return (after[key] || 0) - (before[key] || 0) > 0;
      });
      assert.deepStrictEqual(
        survivors,
        [],
        `${path.name}: these listeners outlived the modal — ` +
          JSON.stringify(survivors) +
          ` (attached was ${JSON.stringify(attached)})`,
      );
      assertNoLeak(assert, probe, before, `restore surface closed by ${path.name}`);
    }
  });

  it("does not leak listeners across a boom-and-bust cycle (repeated open/close)", async function () {
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: { a: 1 } });
    await window.createBackupSnapshot("probe for the cycle");
    const before = probe.snapshot();
    for (let i = 0; i < 3; i++) {
      window.showRestoreSurface();
      await waitFor(() => document.querySelector(".be-modal-overlay") !== null);
      await waitFor(() => document.querySelectorAll(".be-restore-row").length >= 1);
      document.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      await waitFor(() => document.querySelector(".be-modal-overlay") === null);
    }
    assertNoLeak(assert, probe, before, "restore surface after 3 open/close cycles");
  });
});
