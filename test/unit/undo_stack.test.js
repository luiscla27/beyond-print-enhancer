/**
 * The undo stack — Phase 1 of track undo_stack_20260911.
 *
 * Scope: the STACK itself and the ten destructive sites that already produce a
 * (record, label) pair. Phase 2 (the non-destructive mutation classes) is separate.
 *
 * The assertions here follow `conductor/tracks/undo_stack_20260911/contract.md` §2.1,
 * which fixed them AFTER the Muse gate. The rules that matter:
 *   - the inverse is UNIFORM (applyLayout(entry.before)), so the interesting assertions
 *     are about the RECORD and the ORDER, not about per-class inverse code;
 *   - undo is invoked through the stack, never by calling the inverse directly;
 *   - the after-state must DIFFER from the before-state, or the test halts as vacuous;
 *   - the old single-slot mechanism must be ABSENT from the tree, not merely unused.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");
const LayerManager = require("../../js/dom/layer_manager.js");

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <div class="be-section-wrapper" id="wrapper-main">
        <div class="ct-subsection" id="section-main">
          <div class="print-section-header"><span>Main</span></div>
        </div>
      </div>
    </div>
    <div id="print-enhance-shapes-layer">
      <div class="be-shape-layer-container" id="shapes-default">
        <div class="be-shape-wrapper" id="shape-wrapper">
          <div class="print-section-container be-shape-container be-shape" id="shape-x"><img src="a.png" /></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

/** Boot with the layer panel built (the row controls live in it). */
function bootWithPanel() {
  const b = boot(SHEET);
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

const PERSISTENCE_SRC = fs.readFileSync(
  path.join(__dirname, "..", "..", "js", "persistence.js"),
  "utf8",
);

/** The old single-slot identifier, assembled so this file does not itself contain it. */
const OLD_SLOT = "_undo" + "State";

/**
 * A deterministic, comparable view of the layout state.
 *
 * `scanLayout` carries `spell_cache`, which is read from IndexedDB and is not layout
 * state — comparing it would make every assertion here about the spell store rather
 * than about the mutation. The deterministic-serialization case below proves the raw
 * shape is stable too.
 */
async function layoutState(window) {
  const layout = await window.scanLayout();
  const copy = JSON.parse(JSON.stringify(layout));
  delete copy.spell_cache;
  return copy;
}

describe("undo stack — the recorded state is the LIVE layout (AC-6)", function () {
  this.timeout(20000);
  let window, cleanup;

  beforeEach(async function () {
    const b = bootWithPanel();
    window = b.window;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("serializes deterministically, so round-trip equality is sound (contract §2.1 B)", async function () {
    // Without this, every downstream equality assertion is unsound: two scans of an
    // UNCHANGED dom must agree, or "state equals the captured state" proves nothing.
    const a = await window.scanLayout();
    const b = await window.scanLayout();
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(a)),
      JSON.parse(JSON.stringify(b)),
      "two scans with no mutation in between must deep-equal",
    );
  });

  it("records the LIVE layout, and refuses rather than recording a phantom", async function () {
    const live = await window.captureLiveLayout();
    assert.ok(live && typeof live === "object", "the live capture returns the layout");
    assert.ok(
      Object.prototype.hasOwnProperty.call(live, "shapeLayers"),
      "it is the scanLayout shape, not the last-saved backup payload",
    );
    // pushUndo refuses a missing before-state instead of pushing a null record — a
    // phantom entry would make an undo that restores nothing look like success.
    assert.strictEqual(window.pushUndo(null, "nothing", "probe"), null, "no record, no push");
    assert.strictEqual(window.undoDepth(), 0, "the stack is still empty");
  });
});

describe("undo stack — it is a stack, bounded, and it survives the toast (AC-4)", function () {
  this.timeout(30000);
  let window, cleanup;

  beforeEach(async function () {
    const b = bootWithPanel();
    window = b.window;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("walks three distinct mutations back in REVERSE order, by EXACT state equality", async function () {
    const lm = window.DomManager.getInstance().getLayerManager();

    // EXACT equality of the whole serialized layout — the AC-3 wording — compared as
    // JSON strings so the check is realm-independent (the harness boots the product in
    // a vm context, so an Array allocated there is not prototype-identical to the test
    // realm's and `deepStrictEqual` refuses it even when the content is byte-identical).
    const state = async () => JSON.stringify(await window.scanLayout());

    const s0 = await state();

    window.pushUndo(await window.captureLiveLayout(), "Add layer", "structural");
    lm.addShapeLayer();
    lm.refreshLayerContents();
    const s1 = await state();
    assert.notStrictEqual(s1, s0, "mutation 1 must CHANGE the state, or this is vacuous");

    window.pushUndo(await window.captureLiveLayout(), "Add layer", "structural");
    lm.addShapeLayer();
    lm.refreshLayerContents();
    const s2 = await state();
    assert.notStrictEqual(s2, s1, "mutation 2 must CHANGE the state");

    window.pushUndo(await window.captureLiveLayout(), "Add layer", "structural");
    lm.addShapeLayer();
    lm.refreshLayerContents();
    const s3 = await state();
    assert.notStrictEqual(s3, s2, "mutation 3 must CHANGE the state");

    assert.strictEqual(window.undoDepth(), 3, "three reversible records");

    // Pop through them: each step must land EXACTLY on the recorded state.
    assert.strictEqual((await window.applyUndo()).ok, true, "undo 3 -> 2");
    assert.strictEqual(await state(), s2, "EXACTLY the state before mutation 3");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo 2 -> 1");
    assert.strictEqual(await state(), s1, "EXACTLY the state before mutation 2");
    assert.strictEqual((await window.applyUndo()).ok, true, "undo 1 -> 0");
    assert.strictEqual(await state(), s0, "EXACTLY the very beginning");

    assert.strictEqual(window.undoDepth(), 0, "the stack is drained");
  });

  it("is idempotent: undoing with an empty stack changes nothing (contract §2.1 D)", async function () {
    const before = await layoutState(window);
    window.clearUndoStack();
    const res = await window.applyUndo();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, "none", "it reports 'none', not a silent success");
    assert.deepStrictEqual(await layoutState(window), before, "nothing moved");
  });

  it("evicts the OLDEST first once the bound is passed, and never exceeds it (O-1)", async function () {
    const max = window.UNDO_STACK_MAX;
    assert.strictEqual(max, 25, "O-1 ratified the bound at 25");
    const live = await window.captureLiveLayout();
    const labels = [];
    for (let i = 0; i < max + 1; i += 1) {
      // AC-3 (track refactor_surface_20260911): an UNDECLARED tag is rejected in test mode, so
      // this fixture pushes no class at all — it resolves to the DECLARED no-class value.
      // The case asserts labels and depth, never `.class`.
      window.pushUndo(live, "mutation " + i);
      assert.ok(
        window.undoDepth() <= max,
        "depth never exceeds the bound (after push " + i + ")",
      );
    }
    assert.strictEqual(window.undoDepth(), max, "the bound holds");
    // Read the stack without applying anything: peek then drop the top via clear-free
    // bookkeeping — the public pop is applyUndo, which also mutates the DOM, so the
    // ORDER is read by re-pushing into a fresh stack instead.
    assert.strictEqual(window.peekUndo().label, "mutation " + max, "newest is on top");
    window.clearUndoStack();
    assert.strictEqual(window.undoDepth(), 0, "clear empties it");

    // FIFO, proven by what SURVIVES: push bound+1, then walk down and collect labels.
    for (let i = 0; i < max + 1; i += 1) window.pushUndo(live, "mutation " + i);
    let guard = 0;
    while (window.undoDepth() > 0 && guard < max + 5) {
      labels.push(window.peekUndo().label);
      window.applyUndoSyncForTest ? window.applyUndoSyncForTest() : null;
      // pop one without applying: there is no public non-applying pop by design, so
      // drain by applyUndo (the before-state is the real live layout, harmless).
      await window.applyUndo();
      guard += 1;
    }
    assert.strictEqual(labels.length, max, "exactly the bound was retained");
    assert.ok(
      !labels.includes("mutation 0"),
      "the FIRST push was evicted — FIFO, not LIFO eviction",
    );
    assert.ok(labels.includes("mutation " + max), "the LAST push survived");
  });

  it("keeps the record when the TOAST expires — the slot's old failure mode is gone", async function () {
    const live = await window.captureLiveLayout();
    window.pushUndo(live, 'Deleted layer "Shapes"', "destructive");
    assert.strictEqual(window.undoDepth(), 1, "the record is on the stack");

    window.clearUndoOffer("expired");
    assert.strictEqual(window.hasUndoOffer(), false, "the toast is closed");
    assert.strictEqual(
      window.undoDepth(),
      1,
      "but the ABILITY to undo survives the toast — clearing the offer must not drop " +
        "the record (that was the single-level slot's failure mode)",
    );
    assert.strictEqual(window.canUndo(), true, "and it is still reachable");
  });
});

describe("undo stack — one mechanism, and the failure modes are excluded (AC-5)", function () {
  this.timeout(20000);
  let window, cleanup;

  beforeEach(async function () {
    const b = bootWithPanel();
    window = b.window;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("the OLD single-slot mechanism is ABSENT from the tree, not merely unused (AC-5)", function () {
    // Converge, do not coexist: a leftover slot beside the stack is exactly the
    // dual-mechanism divergence this track exists to prevent, so the assertion is a
    // source search for the old identifier rather than a behavioural proxy.
    assert.strictEqual(
      PERSISTENCE_SRC.includes(OLD_SLOT),
      false,
      "no trace of the old single-slot identifier remains in js/persistence.js",
    );
    assert.ok(
      !/one offer at a time/i.test(PERSISTENCE_SRC),
      "the single-offer comment is gone too",
    );
  });

  it("the restore path NEVER pushes — the feedback-loop exclusion (contract §2.1 A)", async function () {
    // applyLayout mutates every recorded field. If it pushed, undo would grow the stack
    // without bound WHILE reverting, and the bound would be a lie.
    const live = await window.captureLiveLayout();
    window.pushUndo(live, "before restore");
    const depth = window.undoDepth();
    await window.applyLayout(live);
    assert.strictEqual(window.undoDepth(), depth, "an applyLayout call must not add a record");
    await window.applyLayout(live);
    assert.strictEqual(window.undoDepth(), depth, "and not on a second call either");
  });

  it("keeps the two record collections independent (O-4: both are kept)", async function () {
    // The MAX_BACKUPS FIFO (10 since ux_gaps_20260911 Phase 3; it was 3) is the cross-reload net; the stack is the in-session
    // one. Neither may prune the other.
    await window.createBackupSnapshot("probe one");
    await window.createBackupSnapshot("probe two");
    const backupsBefore = (await window.listBackups()).length;
    assert.ok(backupsBefore > 0, "there were backups to observe");

    const live = await window.captureLiveLayout();
    for (let i = 0; i < 30; i += 1) window.pushUndo(live, "m" + i);
    assert.strictEqual(window.undoDepth(), window.UNDO_STACK_MAX, "the stack bounded itself");

    assert.strictEqual(
      (await window.listBackups()).length,
      backupsBefore,
      "stack eviction must not touch the backup FIFO",
    );
    const depthBefore = window.undoDepth();
    await window.pruneBackups();
    assert.strictEqual(window.undoDepth(), depthBefore, "pruneBackups must not touch the stack");
  });
});

/**
 * The round-trip is lossless — PROVEN, and a claim of mine was FALSIFIED getting here.
 *
 * Phase 1 first reported TWO defects (contract.md §3). Re-measurement against
 * PRODUCTION-SHAPED data falsified one and narrowed the other, and the correction is
 * recorded rather than quietly dropped:
 *
 *   D-1 RETRACTED. "applyLayout re-classes the shape into the legacy shapes[] array"
 *   was an ARTIFACT OF MY OWN FIXTURE: it gave the shape `be-shape-container` without
 *   `print-section-container`, a class set `createShape` NEVER produces (measured: a
 *   real shape's container is `print-section-container be-shape-container be-shape
 *   <border>`). With a shape built by the real creator, `shapes[]` is populated
 *   consistently and the round trip is exact. The lesson is kept here because it is the
 *   one worth carrying: a hand-written fixture that does not match what the production
 *   creator emits can manufacture a defect that does not exist.
 *
 *   D-2 CONFIRMED, NARROWED. The restore guards are truthiness checks, so a recorded
 *   FALSY value is never written back — real, but reachable only when a stored value is
 *   falsy AND the creation path's default is truthy. Measured to bite for `zIndex: ""`
 *   (the scan can emit it; no production creator writes it). Pinned below with the exact
 *   input that triggers it, so a fix turns it red.
 *
 * Net: `scanLayout` → `applyLayout` is EXACT for every layout the product produces
 * today, which is what AC-3's wording requires.
 */
describe("undo stack — the inverse is a lossless round trip (AC-3)", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = bootWithPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("is EXACT for a production-shaped layout (shapes + layers, through the real creator)", async function () {
    const state = async () => JSON.stringify(await window.scanLayout());

    // A shape built by the REAL createShape — not hand-written markup, which is exactly
    // the mistake that produced the retracted D-1.
    window.createShape("assets/ornament.webp");
    window.createShape("assets/shapes/corner_spikes.webp");
    const lm = window.DomManager.getInstance().getLayerManager();
    lm.addShapeLayer();
    lm.refreshLayerContents();

    const before = await state();
    assert.ok(
      /"shapes":\[\{/.test(before),
      "the fixture must actually contain a shape, or this proves nothing",
    );
    await window.applyLayout(JSON.parse(before));
    assert.strictEqual(
      await state(),
      before,
      "scanLayout -> applyLayout must be an EXACT round trip for a production layout",
    );

    // And idempotent: a second pass must not drift either.
    await window.applyLayout(JSON.parse(await state()));
    assert.strictEqual(await state(), before, "a second restore is also exact");
  });

  it("D-2 FIXED: a recorded FALSY value IS written back (presence, not truthiness)", async function () {
    /** The recorded zIndex of ONE shape id, across every layer. */
    const zIndexOf = async (id) => {
      const L = await window.scanLayout();
      for (const layer of L.shapeLayers || []) {
        for (const el of layer.elements || []) if (el.id === id) return el.zIndex;
      }
      return "(absent)";
    };

    const sh = window.createShape("assets/ornament.webp");
    const id = sh.querySelector(".print-section-container").id;
    // The exact condition D-2 named: the scan CAN emit "" (no inline zIndex) while the
    // creation path's default is a computed `maxZ + 1` (truthy).
    sh.style.zIndex = "";
    assert.strictEqual(await zIndexOf(id), "", "the record holds the falsy value");

    const before = JSON.stringify(await window.scanLayout());
    await window.applyLayout(JSON.parse(before));

    // THIS IS THE FIX. The pin that used to assert the opposite — it pinned the wrong
    // behaviour so that a fix would force it red — went red exactly here when the guards
    // in js/main.js became presence checks, which is how this assertion came to exist.
    assert.strictEqual(
      await zIndexOf(id),
      "",
      "the recorded falsy value is restored faithfully — not replaced by the default",
    );
    assert.strictEqual(
      JSON.stringify(await window.scanLayout()),
      before,
      "so the whole round trip is EXACT even for a falsy recorded value",
    );
  });

  it("D-3 FIXED: an ABSENT assetPath stays absent (it is not written back as \"undefined\")", async function () {
    // The second half of what Phase 1's probe found. `container.dataset.assetPath =
    // assetPath` coerced a missing path to the STRING "undefined", so a restore of a
    // record with no assetPath produced one — invisible in saved-payload comparisons,
    // visible at scan level.
    const shape = document.getElementById("shape-x");
    assert.ok(shape, "the fixture shape exists");
    shape.removeAttribute("data-asset-path");

    const before = await window.scanLayout();
    const el = ((before.shapeLayers || [])[0] || {}).elements.find(
      (e) => e.id === "shape-x",
    );
    assert.ok(el, "the fixture shape is in the record");
    // The property EXISTS with the value `undefined` (scanLayout assigns it directly);
    // what matters is that it is not the STRING, which is what the defect produced.
    assert.strictEqual(el.assetPath, undefined, "the record's assetPath is undefined");
    assert.notStrictEqual(el.assetPath, "undefined", "and not the string");

    await window.applyLayout(JSON.parse(JSON.stringify(before)));
    assert.strictEqual(
      document.getElementById("shape-x").dataset.assetPath,
      undefined,
      "the restore did not invent one (it used to write the string \"undefined\")",
    );

    // And the record is unchanged by the round trip, which is the point.
    const after = await window.scanLayout();
    const el2 = ((after.shapeLayers || [])[0] || {}).elements.find((e) => e.id === "shape-x");
    assert.strictEqual(el2.assetPath, undefined, "still absent after the restore");
  });
});

describe("undo stack — the destructive sites converge onto it (AC-5)", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = bootWithPanel();
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.injectCloneButtons();
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("a real layer delete PUSHES a record carrying the live before-state", async function () {
    const lm = window.DomManager.getInstance().getLayerManager();
    const extra = lm.addShapeLayer();
    assert.ok(extra && extra.id, "a second shape layer exists");
    lm.refreshLayerContents();

    const row = document.querySelector('.be-layer-row[data-layer-id="shapes-default"]');
    assert.ok(row, "row for the default layer");
    row.querySelector(".be-delete-layer-btn").click();
    await confirmDialog(document);

    await waitFor(() => window.undoDepth() > 0, { timeout: 5000 });
    const top = window.peekUndo();
    assert.ok(top, "the delete pushed a record");
    assert.strictEqual(top.class, "destructive", "tagged with its class");
    assert.ok(top.at > 0, "and timestamped for the eviction audit");
    assert.ok(
      top.before && Object.prototype.hasOwnProperty.call(top.before, "shapeLayers"),
      "the recorded before-state is a LIVE layout scan (AC-6), not a backup payload",
    );
    assert.ok(/layer/i.test(top.label), "the label names the action: " + top.label);
    window.clearUndoStack();
  });
});
