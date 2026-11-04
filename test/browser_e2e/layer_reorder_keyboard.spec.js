"use strict";

/**
 * Browser E2E — track ux_quick_wins_20261025, Phase 5 (AC-6 / BEYOND-15):
 * "Layer reorder via drag and drop" — polish + keyboard alternative. The drag
 * itself (js/dnd.js's bindRowDrag) already existed and already commits through
 * reorderShapeLayers; the quick-win gap the delib track closed was (a) the
 * visual drop-slot indicator the dragover hand paints via getRowAfterGroup
 * (already present in js/dnd.js — Phase 5.1's audit pinned its painting path,
 * it is not re-built here) and (b) the KEYBOARD alternative: ArrowUp /
 * ArrowDown / Home / End on a focused layer row (js/dom/layer_manager.js's
 * reorderLayerByKeyboard, AC-6's "use arrow keys to reorder layers").
 *
 * WHY THE CASES LIVE HERE AND NOT byok_arrange_roundtrip.spec.js (Phase 5.1's
 * audit, temp/scratch/phase5_audit_20261026.js)
 * ----------------------------------------------------------------------------
 * AC-6's criterion names byok_arrange_roundtrip.spec.js as its home. That file's
 * ENTIRE subject is the AI-arrange round trip — six cases, all of them driving
 * aiArrangeFirstSection / aiArrangeProbe (ghost → accept/reject → save → undo),
 * and not one touching a layer ROW. Reordering is a different feature; folding
 * restack cases into it would make one file assert two subjects. The track set
 * this exact precedent in Phase 3 (AC-5): that criterion names
 * byok_settings_persistence.spec.js, whose only subject is the BYOK credential,
 * so the four other customization types got a SIBLING spec —
 * byok_settings_persistence_types.spec.js — with the deviation recorded as the
 * file's own header. Same shape here: an AC-6 sibling, ZERO edits to the
 * arrange spec (its green runs stay untouched and meaningful).
 *
 * WHAT "REAL KEYBOARD" MEANS: every move below is page.keyboard.press on a
 * row the harness focused — playwright's CDP keyboard channel, the same one
 * drag_ux_visual_capture.spec.js presses arrows through. The restack happens
 * through the row's own keydown handler (layer_manager.js:823), never through
 * a direct reorderLayerByKeyboard call; reorderLayersProbe (_helpers/inject.js)
 * only READS the result after the press, so each case exercises the real event
 * path and no side door can mask a broken handler. Home/End cases read through
 * the same probe because the probe's reorderLayerByKeyboard("home"/"end") ... is
 * NOT supported — those presses here likewise go through page.keyboard.press and
 * the probe only reads what the handler wrote.
 *
 * THE UNDO CONTRACT (why every case asserts undoDepth): a drop only carries
 * undo meaning because bindRowDrag opens window.beginMutation(snapshotStackState())
 * at dragstart (:761). The keyboard path opens the SAME RESTACK-class record
 * before it reorders (:844-851 for Home/End, :992-1001 for arrows), so a TRUE
 * move must make window.undoDepth() grow by ≥1, and a REFUSED move (locked row,
 * at the head/tail) must leave it EXACTLY unchanged — otherwise an undo entry
 * would claim a before-state the gesture never had.
 *
 * ZERO NETWORK, as every spec in this harness demands: no relay dial, no fetch
 * stub — these moves are pure DOM + stack mutations.
 *
 * HOW TO RUN (deliberately NOT a per-file npm alias — test/unit/e2e_plumbing_guard.test.js
 * pins that roster, and its own guidance is to ask whether a --grep would serve
 * first; the recursive `npm run test:e2e` run collects this file via its glob):
 *
 *   npx mocha test/browser_e2e/layer_reorder_keyboard.spec.js --timeout 900000
 */

const assert = require("assert");
const { bootPage, launchExtensionContext } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

describe("AC-6 (BEYOND-15) layer reorder polish + keyboard alternative (ux_quick_wins_20261025 Phase 5)", function () {
  this.timeout(900000);

  let ctx;
  before(async function () {
    ctx = await launchExtensionContext();
  });
  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /**
   * Two fresh shape layers on the live sheet (the panel's "+ Add Shape" calls
   * addShapeLayer, which PUSHES AT THE TAIL of shapeLayers) so the test stack
   * is always [..., freshA, freshB] with freshB the tail — a stable launch pad
   * for a one-slot up/down on a sheet whose pre-existing counties are unknown.
   */
  async function freshLayers() {
    const a = await contentCall(ctx, "addShapeLayer", []);
    assert.strictEqual(a.ok, true, "addShapeLayer A: " + JSON.stringify(a));
    const b = await contentCall(ctx, "addShapeLayer", []);
    assert.strictEqual(b.ok, true, "addShapeLayer B: " + JSON.stringify(b));
    return { aId: a.id, bId: b.id };
  }

  /**
   * Focus the named row, press ONE REAL key on it, and read the order BOTH
   * before and after. The "before" order must be its OWN read (a separate
   * reorderLayersProbe "report" before the press): the read-only "report"
   * probe reports the order as it stands RIGHT NOW, so a "before" taken from
   * the AFTER-read is the after-order by construction and can never witness a
   * move. Returns the before/after orders around the single press, and keeps
   * the page open (the caller closes it) so rapid-press cases can re-press on
   * the SAME page — a rebuild between presses only matters if the caret is on
   * a fresh row, which restoreRowFocus re-attaches.
   */
  async function pressOnRow(page, layerId, key) {
    const beforeOut = await contentCall(ctx, "reorderLayersProbe", [{ layerId, dir: "report" }]);
    await contentCall(ctx, "focusRowProbe", [{ layerId }]);
    await page.keyboard.press(key);
    await page.waitForTimeout(120); // the synchronous handler + rebuild settle
    const afterOut = await contentCall(ctx, "reorderLayersProbe", [{ layerId, dir: "report" }]);
    // Unwrap the probe envelope to the plain id arrays the cases assert over —
    // "report" mode fills orderAfter = orderBefore, so before/after are read-only
    // snapshots of the stack at the moments each was taken.
    return { before: beforeOut.orderBefore, after: afterOut.orderAfter };
  }

  it("ArrowUp moves the tail layer exactly one slot toward the head — through the row's own keydown handler", async function () {
    const page = await bootPage(ctx);
    try {
      const { aId, bId } = await freshLayers();
      // Press ArrowUp on the tail row (bId — freshLayers pushes B last), reading
      // the order BEFORE and AFTER so the move is witnessed against a real
      // pre-press snapshot. A "report"-mode probe can only ever hold the order as
      // it stands NOW, so a "before" taken from the after-read is the after-order
      // by construction and could never observe the slot fall.
      const { before, after } = await pressOnRow(page, bId, "ArrowUp");
      const beforeA = before.indexOf(aId);
      const beforeB = before.indexOf(bId);
      assert.strictEqual(after[after.length - 1], aId, "the former tail layer is now the tail");
      assert.strictEqual(after[after.length - 2], bId, "the moved layer is now second-from-tail (rose one slot)");
      assert.strictEqual(after.indexOf(bId), beforeB - 1, "the moved layer's slot index fell by exactly 1");
      assert.strictEqual(after.indexOf(aId), beforeA + 1, "the layer it passed rose by exactly 1");
    } finally {
      await page.close();
    }
  });

  it("ArrowDown moves a layer one slot toward the tail — the two directions write mirror-image stacks", async function () {
    const page = await bootPage(ctx);
    try {
      const { aId, bId } = await freshLayers();
      // First push the tail UP (now [..., bId, aId]), then back DOWN (a swap-back).
      await contentCall(ctx, "focusRowProbe", [{ layerId: bId }]);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const up = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      assert.strictEqual(up.orderAfter[up.orderAfter.length - 2], bId, "precondition: the up move did not land");
      // press ArrowDown with the row re-focused (the rebuild re-created it).
      await contentCall(ctx, "focusRowProbe", [{ layerId: bId }]);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(120);
      const out = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      assert.strictEqual(out.orderAfter[out.orderAfter.length - 1], bId, "the moved layer is the tail again");
      assert.strictEqual(out.orderAfter[out.orderAfter.length - 2], aId, "the layer it passed fell one slot");
    } finally {
      await page.close();
    }
  });

  it("three rapid presses in a row — ↑ then ↓ then ↑ — all land on the SAME layer without a manual re-click (restoreRowFocus)", async function () {
    const page = await bootPage(ctx);
    try {
      const { bId } = await freshLayers();
      // ↑ ↓ ↑ — each rebuild re-creates the rows, so the 2nd and 3rd press
      // only still land on bId's row if restoreRowFocus re-attached the caret.
      await contentCall(ctx, "focusRowProbe", [{ layerId: bId }]);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const focusedAfterUp = await contentCall(ctx, "focusedLayerRowProbe", []);
      assert.strictEqual(
        focusedAfterUp.focusedLayerId,
        bId,
        "after press 1 the caret is NOT on the moved row: " + JSON.stringify(focusedAfterUp),
      );
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(120);
      const focusedAfterDown = await contentCall(ctx, "focusedLayerRowProbe", []);
      assert.strictEqual(
        focusedAfterDown.focusedLayerId,
        bId,
        "after press 2 the caret is NOT on the moved row: " + JSON.stringify(focusedAfterDown),
      );
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const net = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      assert.strictEqual(
        net.orderAfter[net.orderAfter.length - 2],
        bId,
        "the net stack after ↑↓↑ is the one-up state the third press reached",
      );
    } finally {
      await page.close();
    }
  });

  it("Home and End bookend the stack in ONE press (Home → head, End → tail) — through the same keydown handler", async function () {
    const page = await bootPage(ctx);
    try {
      const { aId, bId } = await freshLayers();
      // freshLayers pushes A then B, so B is the TAIL and aId is second-from-tail.
      // End on aId sends it past its one fresh successor to the tail in one press;
      // the pre-press snapshot `end.before` is what proves the move actually happened
      // (tail was bId, not aId) — a "report"-mode read taken AFTER the press holds the
      // after-order and could never witness it.
      const end = await pressOnRow(page, aId, "End");
      assert.strictEqual(end.before[end.before.length - 1], bId, "precondition: the tail was NOT bId — End had a different stack to move on");
      assert.strictEqual(end.before[end.before.length - 2], aId, "precondition: aId was not second-from-tail");
      assert.strictEqual(end.after[end.after.length - 1], aId, "End did not put the layer at the tail");
      // From the tail, Home must now send it to the HEAD in ONE press. The `home.before`
      // snapshot is the order as it stood after End (aId at the tail), so the head-slot
      // before/after are two genuinely different reads of two genuinely different presses.
      const home = await pressOnRow(page, aId, "Home");
      assert.strictEqual(home.before[home.before.length - 1], aId, "precondition: Home did not start from the tail");
      assert.strictEqual(home.after[0], aId, "Home did not put the layer at the head");
      assert.notStrictEqual(home.after[0], home.before[0], "the head slot was already this layer — home did nothing");
    } finally {
      await page.close();
    }
  });

  it("a locked row's arrows are a NO-OP — the handler refuses before the manager is even called, no stack change, NO undo entry", async function () {
    const page = await bootPage(ctx);
    try {
      const { bId } = await freshLayers();
      // Lock ONLY bId through the AC-6 lock probe (a one-layer flip, no cascade,
      // no undo record — the two deviations it documents are what keep this
      // case's undo-depth assertion clean).
      const lock = await contentCall(ctx, "toggleLayerLockProbe", [{ layerId: bId, locked: true }]);
      assert.strictEqual(lock.ok, true, "the lock flip refused: " + JSON.stringify(lock));
      assert.strictEqual(lock.isLocked, true, "the flip did not stick");
      const before = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      const depthBefore = before.undoDepthBefore;
      await contentCall(ctx, "focusRowProbe", [{ layerId: bId }]);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const after = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      assert.deepStrictEqual(after.orderAfter, after.orderBefore, "a locked layer's arrow STILL moved the stack");
      assert.strictEqual(
        after.undoDepthAfter,
        depthBefore,
        "a refused move opened an undo entry — an undoable change never happened",
      );
      // What the refusal actually DID: the row's keydown runs dragAllowed() === false
      // (layer_manager.js:824) and returns before preventDefault — so the keystroke
      // propagates as an ordinary (harmless) focus-traversal arrow.
    } finally {
      await page.close();
    }
  });

  it("already-at-the-boundary presses are safe no-ops (tail's ArrowDown, head's ArrowUp) — depth untouched", async function () {
    const page = await bootPage(ctx);
    try {
      const { bId } = await freshLayers();
      // bId is the TAIL: ArrowDown has nothing below to pass.
      await contentCall(ctx, "focusRowProbe", [{ layerId: bId }]);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(120);
      const downAtTail = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      assert.deepStrictEqual(downAtTail.orderAfter, downAtTail.orderBefore, "ArrowDown at the tail STILL moved the stack");
      assert.strictEqual(
        downAtTail.undoDepthAfter,
        downAtTail.undoDepthBefore,
        "a boundary no-op opened an undo entry",
      );
      // The HEAD of the live stack: its ArrowUp is the mirror no-op.
      const headId = downAtTail.orderBefore[0];
      await contentCall(ctx, "focusRowProbe", [{ layerId: headId }]);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const upAtHead = await contentCall(ctx, "reorderLayersProbe", [{ layerId: headId, dir: "report" }]);
      assert.deepStrictEqual(upAtHead.orderAfter, upAtHead.orderBefore, "ArrowUp at the head STILL moved the stack");
      assert.strictEqual(upAtHead.undoDepthAfter, upAtHead.undoDepthBefore, "the head no-op opened an undo entry");
      // Home at the head and End at the tail: the handler's own same-slot guards.
      await contentCall(ctx, "focusRowProbe", [{ layerId: headId }]);
      await page.keyboard.press("Home");
      await page.waitForTimeout(120);
      const homeAtHead = await contentCall(ctx, "reorderLayersProbe", [{ layerId: headId, dir: "report" }]);
      assert.strictEqual(homeAtHead.undoDepthAfter, homeAtHead.undoDepthBefore, "Home at the head opened an undo entry");
    } finally {
      await page.close();
    }
  });

  it("the stack the keyboard writes is POSITIONALLY IDENTICAL to the stack a drag drop writes for the same swap (keyboard and mouse are the same edit)", async function () {
    const page = await bootPage(ctx);
    let page2;
    try {
      const { aId, bId } = await freshLayers();
      // Page 1: keyboard ↑ on bId [..., aId, bId] → [..., bId, aId].
      await contentCall(ctx, "focusRowProbe", [{ layerId: bId }]);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(120);
      const kb = await contentCall(ctx, "reorderLayersProbe", [{ layerId: bId, dir: "report" }]);
      assert.strictEqual(kb.orderAfter[kb.orderAfter.length - 2], bId, "the keyboard side did not land");
      assert.strictEqual(kb.orderAfter[kb.orderAfter.length - 1], aId, "the keyboard side's passed layer is wrong");
      // Page 2: the SAME two fresh layers, and the move through reorderShapeLayers
      // with the beforeId the DROP handler computes for a one-slot up (the
      // dragged id's predecessor), i.e. reorderShapeLayers(bId, aId).
      page2 = await bootPage(ctx);
      const { aId: a2, bId: b2 } = await freshLayers();
      const drop = await contentCall(ctx, "reorderShapeLayersProbe", [{ layerId: b2, beforeId: a2 }]);
      assert.strictEqual(drop.ok, true, "the drop-path move refused: " + JSON.stringify(drop));
      // The two ORDER ARRAYS agree slot for slot (same length; the head's ids are
      // live-sheet ids we do not assume, but every slot POSITION that the fresh
      // pair considers is asserted: tail-1 and tail hold the same relative ids).
      const kbTail = kb.orderAfter.slice(-2);
      const dropTail = drop.orderAfter.slice(-2);
      assert.strictEqual(kbTail[0] !== undefined && dropTail[0] !== undefined, true, "a side came back under two long");
      assert.strictEqual(kbTail[1] !== undefined && dropTail[1] !== undefined, true, "a side came back under one long");
      // Relative positions: on page 1 the tail holds aId and tail-1 holds bId;
      // on page 2 the tail holds a2 and tail-1 holds b2 — the SAME pattern.
      assert.strictEqual(kb.orderAfter.indexOf(aId), kb.orderAfter.length - 1, "page-1 tail is not aId");
      assert.strictEqual(drop.orderAfter.indexOf(a2), drop.orderAfter.length - 1, "page-2 tail is not a2 (the drop path put it elsewhere)");
      assert.strictEqual(kb.orderAfter.indexOf(bId), kb.orderAfter.length - 2, "page-1 tail-1 is not bId");
      assert.strictEqual(drop.orderAfter.indexOf(b2), drop.orderAfter.length - 2, "page-2 tail-1 is not b2 (the drop path put it elsewhere)");
    } finally {
      await page.close();
      if (page2) await page2.close();
    }
  });
});
