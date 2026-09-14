/**
 * Phase 3 — the two recovery models, made distinguishable, and the backup depth RAISED
 * (track ux_gaps_20260911, AC-3; operator decision O-3).
 *
 * WHY THIS SUITE EXISTS. The 25-deep undo stack is SESSION-scoped, so after a reload the
 * backup store is the only way back — and it was three records deep, chosen when it was the
 * only net at all ("bounded so IndexedDB cannot grow forever"). The operator's O-3 was
 * "definitely raise it", which overrode the spec's own "re-decide, keeping 3 allowed"
 * recommendation, so the raise is mandatory rather than discretionary. What is NOT
 * mandatory is the number: 10 is this track's choice and the assertions below pin the
 * PROPERTY (a deep-enough, still-bounded FIFO) rather than only the literal, so a future
 * deliberate change to the constant does not have to fight a test that only knows "10".
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");

describe("Phase 3 — recovery depth and model clarity (AC-3)", function () {
  let b, window, document, cleanup;

  beforeEach(async function () {
    b = boot();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: { keep: 1 } });
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("RAISES the backup depth past the old 3, and keeps it bounded (O-3)", function () {
    const cap = window.Persistence.MAX_BACKUPS;
    assert.ok(cap > 3, `the depth must be RAISED from the old 3 (got ${cap}) — O-3 made this mandatory`);
    assert.ok(cap <= 25, `…and still bounded, not unbounded (got ${cap})`);
    // The undo stack is the in-session net; the backup store is the cross-reload one.
    // Parity with the undo depth is NOT required (each backup is a whole-layout copy),
    // but the store must reach far enough back to be worth a reload.
    assert.ok(cap >= 5, `a cross-reload net of ${cap} is not a history`);
    // The literal, pinned so a silent edit is visible in the diff rather than inferred.
    assert.strictEqual(cap, 10, "the number this track chose; change it deliberately, with the cost measured");
  });

  it("honours the new depth: N writes keep exactly the newest N, oldest evicted first", async function () {
    const cap = window.Persistence.MAX_BACKUPS;
    const ids = [];
    for (let i = 0; i < cap + 4; i += 1) {
      const r = await window.createBackupSnapshot("depth probe " + i);
      assert.strictEqual(r.ok, true, "the write must succeed");
      ids.push(r.record.id);
    }
    const listed = await window.listBackups();
    assert.strictEqual(listed.length, cap, `the FIFO holds exactly ${cap}`);
    // newest first, compared through JSON: the records come from the jsdom realm, so
    // cross-realm prototype equality would false-fail (the same trap the isolation
    // guard documents).
    const seqs = Array.from(listed, (r) => r.seq);
    assert.strictEqual(
      JSON.stringify(seqs),
      JSON.stringify([...seqs].sort((x, y) => y - x)),
      "newest-first ordering holds at the new depth",
    );
    // the four oldest are gone, and NOT one of the newest is
    for (const gone of ids.slice(0, 4)) {
      assert.ok(!listed.some((r) => r.id === gone), `evicted: ${gone}`);
    }
    for (const kept of ids.slice(-cap)) {
      assert.ok(listed.some((r) => r.id === kept), `kept: ${kept}`);
    }
  });

  it("the restore surface says how far back it reaches AND contrasts itself with undo (AC-3a)", async function () {
    // Two backups, so the populated state (not the empty one) is what is measured.
    await window.createBackupSnapshot('Delete layer "a"');
    await window.createBackupSnapshot("Merge sections");
    window.showRestoreSurface();
    await waitFor(() => document.querySelector(".be-restore-status") !== null);
    await new Promise((r) => setTimeout(r, 30));

    const status = document.querySelector(".be-restore-status").textContent;
    const flat = status.replace(/\s+/g, " ");
    // the count and the ordering survive (the pre-existing claim, unchanged)
    assert.ok(/2 backups - newest first/.test(flat), `count + order kept: "${flat}"`);
    // …and the distinguishing facts a user can ACT on:
    assert.ok(/still here after a reload/.test(flat), `says these survive a reload: "${flat}"`);
    assert.ok(/undo covers the current session only/.test(flat), `contrasts with undo: "${flat}"`);
  });

  it("the undo control names its session scope, and points at the older history (AC-3a)", async function () {
    // The harness sets `__DDB_TEST_MODE__`, so main.js skips the production boot and the
    // panel is never built. Build it explicitly — the same step
    // test/unit/filters_ui.test.js:113 takes for the same reason.
    window.createControls();

    // Put one record on the stack so the control is ENABLED — the scope sentence only
    // makes sense when there is something to undo.
    const live = await window.captureLiveLayout();
    window.pushUndo(live, 'Toggle "Actions"', "layer-flag");
    window.dispatchEvent(new window.Event("be-undo-stack-changed"));

    const btn = document.getElementById("be-btn-undo");
    assert.ok(btn, "the undo control exists");
    const title = btn.getAttribute("title") || "";
    assert.ok(
      /this session only/.test(title),
      `the tooltip must say the history is session-scoped — got "${title}"`,
    );
    assert.ok(
      /Restore backup/.test(title),
      `…and point at where the older history lives — got "${title}"`,
    );
    const aria = btn.getAttribute("aria-label") || "";
    assert.ok(
      /this session only/.test(aria),
      `the accessible name must carry it too (a tooltip alone is not "where the controls are") — got "${aria}"`,
    );
    // The VISIBLE label must NOT grow the scope: AC-V1 round 1 measured the panel
    // ellipsizing this control, which is why the subject was cut off once before.
    const shown = btn.querySelector(".be-ctl-label").textContent;
    assert.ok(
      !/session/.test(shown),
      `the visible label stays short — the scope rides the tooltip; got "${shown}"`,
    );
  });

  it("the depth's cost is RECORDED in the source, with the number measured (AC-3b)", function () {
    // The old comment justified 3 by "bounded so IndexedDB cannot grow forever" and
    // never revisited it. The replacement must carry the reasoning AND the measurement,
    // or the next reader re-derives the same arbitrary bound.
    const src = fs.readFileSync(path.join(ROOT, "js", "persistence.js"), "utf8");
    const m = /\/\*\*([\s\S]*?)\*\/\s*\nconst MAX_BACKUPS = (\d+);/.exec(src);
    assert.ok(m, "the constant must carry a docblock immediately above it");
    const doc = m[1];
    assert.ok(/RAISED from 3/.test(doc), "the docblock must say it was raised, and from what");
    assert.ok(/O-3/.test(doc), "…and name the decision that made the raise mandatory");
    assert.ok(/\b5,?183\b/.test(doc), "…and carry the MEASURED per-record cost, not an estimate");
    assert.ok(/session/i.test(doc), "…and explain the session-vs-reload distinction that justifies it");
  });
});
