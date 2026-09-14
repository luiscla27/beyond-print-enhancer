/**
 * Harness isolation guard — one boot() must not see another boot()'s IndexedDB rows.
 *
 * WHY THIS EXISTS (temp/archived/ISSUE_mocha_subset_backup_count_pollution_20260911.md):
 * `require("fake-indexeddb")` exports a MODULE-LEVEL singleton whose databases live for
 * the life of the PROCESS. The shared harness handed that one object to every boot, so
 * rows written by an earlier suite were still present in a later one. The real damage was
 * not cosmetic: the backup store is capped at `MAX_BACKUPS` (3 at the time; 10 since
 * ux_gaps_20260911 Phase 3 — the arithmetic is the same either way), so once the store was
 * left behind, a case that wrote one more could never reach `before + 1`, and
 * `destructive_recovery.test.js` failed with `3 !== 4` — but ONLY when the suites were
 * run in the offending ORDER in one process, which is why the full `npm test` run was
 * green while a hand-picked subset was not.
 *
 * The defect survived because nothing asserted the isolation itself: every suite tested
 * its own behaviour and none tested the shared precondition. This guard does, and it is
 * deliberately falsifiable in BOTH directions — if a future change re-shares the factory,
 * the first case fails; if a future change breaks the documented opt-in (the way a suite
 * models a real reload, where IndexedDB genuinely DOES persist), the second case fails.
 */
"use strict";

const assert = require("assert");
const { boot } = require("./encapsulation_debt/debt_harness.js");

describe("test harness — each boot gets its OWN IndexedDB (isolation guard)", function () {
  const boots = [];
  const bootOnce = (html, opts) => {
    const b = boot(html, opts);
    boots.push(b);
    return b;
  };

  afterEach(function () {
    while (boots.length) boots.pop().cleanup();
  });

  it("a later boot starts from an EMPTY store, whatever an earlier boot wrote", async function () {
    const first = bootOnce();
    const wrote = await first.window.createBackupSnapshot("isolation guard: written in boot 1");
    assert.strictEqual(wrote.ok, true, "the guard needs a real write to leak in the first place");
    assert.strictEqual(
      (await first.window.listBackups()).length,
      1,
      "boot 1 sees its own row",
    );

    const second = bootOnce();
    // NOTE: `Array.from` is load-bearing, not style. `listBackups()` returns an array
    // built in the jsdom REALM (js/persistence.js is eval'd there), and `deepStrictEqual`
    // compares prototypes — so the same value from another realm fails
    // ("expected [] actual []", which is how this guard's first draft lied). Copying it
    // into this realm makes the comparison about the CONTENT.
    assert.deepStrictEqual(
      Array.from(await second.window.listBackups(), (r) => r.reason),
      [],
      "boot 2 must NOT see boot 1's backup — a shared process-lived factory is the defect",
    );
  });

  it("…and the store being fresh is what makes an exact count assertable (the recorded 3 !== 4)", async function () {
    // Reproduce the ISSUE's arithmetic: fill the store to its MAX_BACKUPS cap in one
    // boot, then have a LATER boot do the "one backup was written" check. With a shared
    // store this is `cap !== cap + 1` (the prune keeps the store at the cap); with
    // isolation the later boot starts at 0 and the same assertion holds.
    // NOTE: the fill count is derived from the constant, not hardcoded — this test
    // used to write 3 literals, which broke the moment Phase 3 raised the depth to 10.
    // A test that knows the NUMBER rather than the PROPERTY is the next stale claim.
    const filler = bootOnce();
    const cap = filler.window.Persistence.MAX_BACKUPS;
    for (let i = 0; i < cap; i += 1) {
      await filler.window.createBackupSnapshot(`filler ${i}`);
    }
    assert.strictEqual(
      (await filler.window.listBackups()).length,
      filler.window.Persistence.MAX_BACKUPS,
      "the store is at its documented cap — the precondition the defect needed",
    );

    const later = bootOnce();
    const before = (await later.window.listBackups()).length;
    await later.window.createBackupSnapshot("the one this case writes");
    const after = (await later.window.listBackups()).length;
    assert.strictEqual(
      after,
      before + 1,
      `"exactly one backup was written" must hold from a fresh store (was the issue's ` +
        `${after} !== ${before + 1} when the store arrived already full)`,
    );
  });

  it("the opt-in that models a RELOAD still carries data over (so this guard can fail the other way)", async function () {
    // A real reload keeps IndexedDB. A suite that means that passes the same factory to
    // both boots instead of relying on the old accident.
    const first = bootOnce();
    await first.window.createBackupSnapshot("survives the reload");
    const afterReload = bootOnce(undefined, { indexedDB: first.indexedDB });
    await afterReload.window.__DDBStorage.init();
    assert.deepStrictEqual(
      Array.from(await afterReload.window.listBackups(), (r) => r.reason),
      ["survives the reload"],
      "reusing a factory IS the reload model and must keep working",
    );
  });

  it("the factories are separate objects, and each boot publishes its own", function () {
    const a = bootOnce();
    const b = bootOnce();
    assert.notStrictEqual(a.indexedDB, b.indexedDB, "each boot gets a distinct factory");
    assert.strictEqual(a.indexedDB, a.window.indexedDB, "…and it is the one on the window");
    assert.notStrictEqual(
      a.indexedDB,
      require("fake-indexeddb").indexedDB,
      "the module-level singleton must not be what a boot installs (that was the defect)",
    );
  });
});
