/**
 * The action menu is registered ONCE, and stays registered across worker starts
 * (defect: `temp/archived/ISSUE_ctxmenu_duplicate_id_invisible_to_gates_20260921.md`).
 *
 * WHAT THIS GUARDS, AND WHY NO OTHER CASE COULD. The operator's five lines —
 * `Unchecked runtime.lastError: Cannot create item with duplicate id sponsor|donate|
 * buy-me-a-coffee|contribute|feedback` — came from `js/background.js` registering the five
 * action-menu entries at the TOP LEVEL of an MV3 service worker. Chrome persists those items in the
 * profile, and MV3 re-runs the worker script on EVERY worker start, so from the second start onward
 * every `create` asked for an id that already existed.
 *
 * Both halves of that are invisible to a single-boot case, and for two different reasons:
 *   * the ERROR needs a second worker start, and every launcher in this harness hands out a FRESH
 *     profile (deleted on close), which is exactly one start — so the second registration never
 *     happens in a run;
 *   * `funding_placement_verify.spec.js` (AC-3) asks `chrome.contextMenus.update(id, {})`, and the
 *     answer to that is IDENTICAL whether the id was created once or created five times and errored
 *     four times. It counts PRESENCE; nothing counted CREATIONS.
 *
 * So this spec does the two things the collection could not: it boots ONE profile TWICE, and it reads
 * `chrome.runtime.lastError` inside the callback, which is the only channel measured to observe these
 * errors (`chrome.developerPrivate` has no runtime-error getter in this Chromium, and
 * `getExtensionsInfo().runtimeErrors` read `[]` even with a duplicate `create` deliberately planted
 * into a throwaway copy with Developer Mode on).
 *
 * FALSIFICATION — MEASURED, AND IT DID NOT GO THE WAY THIS FILE WAS FIRST WRITTEN. The fix was
 * reverted in a throwaway copy of the tree (`temp/.pw-falsify`, never the worktree: the five creates
 * hoisted back to the worker's top level) and the suite was run against it. Result:
 *
 *   ✗ registers the five entries from onInstalled, and NOTHING from the worker's top level  <-- FAILS
 *   ✓ the FIRST worker start leaves all five present …
 *   ✓ a SECOND start of the same profile registers NOTHING new …
 *   ✓ a THIRD start is still quiet …
 *
 * The STRUCTURAL case is the one that catches the defect; the runtime cases pass on a reverted tree
 * and saying otherwise would be a lie the next reader would repeat. The measured reason:
 *
 *   * a duplicate `create` ERRORS and removes nothing, so after any number of worker starts the five
 *     ids are still present — `update(id, {})` cannot tell "created once" from "created and errored
 *     four times" (this is also why `funding_placement_verify.spec.js` was blind to it);
 *   * the ONLY channel that reports the duplicate is the `lastError` of a `create` CALL, and issuing
 *     that call is itself a mutation — it registers the id when the id is absent. So a read-only
 *     probe cannot see the error, and a mutating one corrupts the state the next case reads. That
 *     is not a theory: the first draft of this file asserted on the probe's own `create` and went red
 *     on boots 2 and 3 for exactly that reason.
 *
 * So the division of labour is explicit: the structural case is the guard against THIS defect
 * (registration running again on every worker start), and the runtime cases guard the opposite
 * regression (a start that leaves an id ABSENT — a `removeAll` without a chained re-create, or a
 * create moved into a callback that never fires). Neither is allowed to claim the other's half.
 *
 * Run: npx mocha test/browser_e2e/action_menu_registration.spec.js --timeout 900000
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  launchExtensionContext,
  launchProfileAgain,
  serviceWorkerOf,
  probeActionMenu,
} = require("./_helpers.js");

const IDS = ["sponsor", "donate", "buy-me-a-coffee", "contribute", "feedback"];

const BACKGROUND = fs.readFileSync(
  path.join(__dirname, "..", "..", "js", "background.js"),
  "utf8",
);

describe("the action menu is registered once and survives a worker start", function () {
  this.timeout(900000);
  let profile, ctx;

  before(async function () {
    ctx = await launchExtensionContext();
    // `close()` deletes the profile — correct for every other spec, and precisely what makes the
    // second boot impossible. Drop the wrapper for THIS context and own the directory instead, so
    // the cleanup below is explicit rather than accidental.
    profile = ctx.__profilePath;
    delete ctx.close;
  });

  after(async function () {
    try {
      if (ctx) await ctx.close().catch(() => {});
    } finally {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {
        /* a locked file leaves one stale dir under gitignored temp/ */
      }
    }
  });

  it("registers the five entries from onInstalled, and NOTHING from the worker's top level", function () {
    // The structural half of the contract: the only `create` calls live inside the function the
    // onInstalled listener calls. This is what makes the second boot quiet, and it is asserted
    // rather than inferred because the runtime half below cannot see a future sixth top-level call
    // for an id that happens not to exist yet.
    const body = /function createActionMenu\(\)\s*\{([\s\S]*?)\n\}/.exec(BACKGROUND);
    assert.ok(body, "js/background.js declares createActionMenu()");

    const inFn = Array.from(body[1].matchAll(/id:\s*"([^"]+)"/g), (m) => m[1]);
    assert.deepStrictEqual(
      inFn,
      IDS,
      "the five asks, in the order the funding entries stay above: " + JSON.stringify(inFn),
    );

    // Every `create` in the whole file must be inside that function's declaration range — a count
    // alone would pass with a sixth call added at the top level.
    const fnStart = BACKGROUND.indexOf("function createActionMenu()");
    const fnEnd = BACKGROUND.indexOf("\n}", fnStart);
    const callSites = Array.from(
      BACKGROUND.matchAll(/chrome\.contextMenus\.create\(/g),
      (m) => m.index,
    );
    assert.strictEqual(callSites.length, 5, "five create calls in the file, got " + callSites.length);
    callSites.forEach((at) => {
      assert.ok(
        at > fnStart && at < fnEnd,
        "a chrome.contextMenus.create call sits OUTSIDE createActionMenu() (offset " +
          at +
          "). At the worker's top level it would be re-run on every worker start, which is the " +
          "duplicate-id defect this file exists to prevent.",
      );
    });

    // …and the listener actually invokes it, or the menu would never be built at all.
    assert.match(
      BACKGROUND,
      /chrome\.runtime\.onInstalled\.addListener\(function\(\)\s*\{\s*\n\s*createActionMenu\(\);/,
      "chrome.runtime.onInstalled is what creates the menu",
    );

    // THE REVERT ITSELF MUST FAIL HERE, not merely a create left outside the function. Hoisting a
    // bare `createActionMenu();` call back to the top level is the exact pre-fix shape and the exact
    // falsification that was run against a throwaway copy of this tree; it would re-run the five
    // creates on every worker start while leaving every `create` syntactically inside the function,
    // so a range check alone would pass it. Exactly ONE call site is allowed, and it is the one in
    // the listener.
    const invocations = Array.from(BACKGROUND.matchAll(/createActionMenu\(\);/g), (m) => m.index);
    assert.strictEqual(
      invocations.length,
      1,
      "createActionMenu() must be CALLED exactly once, from chrome.runtime.onInstalled — found " +
        invocations.length +
        " call sites. A second call anywhere (the top level especially) re-registers the five ids " +
        "on every worker start, which is the duplicate-id defect this file exists to prevent.",
    );
    const listenerAt = BACKGROUND.indexOf("chrome.runtime.onInstalled.addListener");
    assert.ok(
      invocations[0] > listenerAt,
      "the single createActionMenu() call sits after the onInstalled listener declaration",
    );

    // The click dispatch is untouched by the move — five ids, five handlers.
    IDS.forEach((id) => {
      assert.ok(
        BACKGROUND.includes(`menuItemId === "${id}"`),
        `"${id}" still has a click handler`,
      );
    });
  });

  it("the FIRST worker start leaves all five present, and its own registration is the one that created them", async function () {
    const sw = await serviceWorkerOf(ctx);
    const { present, created } = await probeActionMenu(sw, IDS);

    assert.deepStrictEqual(
      IDS.filter((id) => !present[id]),
      [],
      "all five action-menu entries exist after the first start: " + JSON.stringify(present),
    );

    // The control: the probe's OWN create of an id that exists. It MUST report the duplicate error,
    // because that is the very string the operator saw and the thing the fix removed from the
    // product's path. Asserting it here is what proves the probe can see the condition at all — a
    // probe that always answered "" would make every assertion in this file vacuous, and this is the
    // falsification-of-the-probe half that keeps that from happening silently.
    assert.strictEqual(
      created,
      "Cannot create item with duplicate id sponsor",
      "the probe must be able to OBSERVE a duplicate-id error; it reported " + JSON.stringify(created),
    );
    // NOTE, and it is load-bearing: that control REGISTERS nothing (the id existed, so the create
    // failed and left the registrar exactly as it was), so case 1 cannot disturb the two boots below.
    // See the ordering note on those cases.
  });

  // THE NEXT TWO CASES ARE DELIBERATELY BOOT-ONLY, AND THE ORDER IS NOT COSMETIC. `probeActionMenu`
  // itself calls `contextMenus.create` with a fixed id; when that id is ABSENT the call SUCCEEDS and
  // registers it, so a probe run makes the following call of the same id report a duplicate error
  // that the PRODUCT did not cause. (That is exactly how the first draft of this file went red on
  // boots 2 and 3.) So each boot asks only the READ-ONLY question — the same `update` probe AC-3
  // uses, which registers nothing and cannot create one. The positive control lives on boot 1, where
  // the id exists and the failing create is provably inert.
  const readOnlyPresence = (sw) => probeActionMenu(sw, IDS).then(({ present }) => present);

  it("a SECOND start of the same profile registers NOTHING new — asked without registering anything", async function () {
    // Close without deleting the profile, then boot the very same user-data dir. This is the MV3
    // worker lifecycle in miniature: the script runs again, the items are already there.
    await ctx.close();
    ctx = await launchProfileAgain(profile);

    const sw = await serviceWorkerOf(ctx);
    const present = await readOnlyPresence(sw);

    assert.deepStrictEqual(
      IDS.filter((id) => !present[id]),
      [],
      "the five entries survived the second start: " + JSON.stringify(present),
    );

    // WHAT THIS CASE DOES AND DOES NOT PROVE — measured, not assumed. Both boots of a reverted tree
    // (the five creates hoisted back to the worker's top level, `temp/.pw-falsify`) still leave all
    // five ids PRESENT, because a duplicate `create` errors and changes nothing. So this assertion
    // is NOT what catches the defect, and the file must not pretend otherwise: the case that fails
    // on a reverted tree is the structural one above, which requires every `create` to sit inside
    // `createActionMenu()`. This case guards the OPPOSITE regression — it catches a fix that makes
    // the registration run somewhere it does not normally reach (a `removeAll` without a chained
    // re-create, a create moved inside a callback that never fires), which would leave an id ABSENT.
    //
    // The measured reason no read-only probe can see the duplicate: the only way Chrome reports it is
    // the `lastError` of a `create` CALL, and issuing that call is itself a mutation (it registers
    // the id when absent). A probe that reads the error is a probe that changes what the next case
    // observes — which is exactly how the first draft of this file went red on boots 2 and 3.
    const absent = IDS.filter((id) => !present[id]);
    assert.deepStrictEqual(
      absent,
      [],
      "the second worker start left an id ABSENT — absent after boot 2: " +
        JSON.stringify(absent) +
        " (the entries must exist after every start, created from chrome.runtime.onInstalled)",
    );
  });

  it("a THIRD start is still quiet — the guard is not a two-boot artefact", async function () {
    await ctx.close();
    ctx = await launchProfileAgain(profile);

    const sw = await serviceWorkerOf(ctx);
    const present = await readOnlyPresence(sw);
    assert.deepStrictEqual(
      IDS.filter((id) => !present[id]),
      [],
      "all five still present on the third start: " + JSON.stringify(present),
    );
  });
});
