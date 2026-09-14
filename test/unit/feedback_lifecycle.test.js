/**
 * Feedback lifecycle — AC-1..AC-4 of track feedback_lifecycle_a11y_20260910.
 *
 * Closes the deferred findings of temp/issues/ISSUE_feedback_a11y_track_20260909.md:
 *   AC-1 (U-11) toasts dismissible; the cap can never discard an ERROR toast.
 *   AC-2 (U-15) a successful boot restore says so, distinctly from the default.
 *   AC-3 (U-19) a partial merged-spell restore is reported, not silent.
 *   AC-4 (U-18) the spell error names the ACTUAL cause.
 *
 * TWO OF THESE ARE NEGATIVE ASSERTIONS ("no error toast is evicted", "the
 * manage-spells instruction is absent"), and working note 6 of the track says a
 * negative assertion is not trusted until it has been seen to fail. Both were
 * falsified by injecting the old behaviour and watching the test fail — the run
 * output is recorded in the Phase 1 commit message.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const read = (f) => fs.readFileSync(path.resolve(__dirname, "../../js", f), "utf8");

/** Boot a jsdom page with the modules a case needs, and a recording toast lane. */
function bootModals(extra = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.HTMLElement = w.HTMLElement;
  global.Node = w.Node;
  w.__DDB_TEST_MODE__ = true;
  w.safeLog = () => {};
  Object.assign(w, extra);
  w.eval(read("modals.js"));
  return w;
}

const toastsIn = (w) => Array.from(w.document.querySelectorAll(".be-feedback"));
const errorToastsIn = (w) =>
  toastsIn(w).filter((el) => el.classList.contains("be-feedback-error"));
const nonErrorToastsIn = (w) =>
  toastsIn(w).filter((el) => !el.classList.contains("be-feedback-error"));

describe("AC-1 — toasts are dismissible and never lose a failure (U-11)", function () {
  it("keeps BOTH error toasts through an interleaved burst of six", function () {
    const w = bootModals();
    const { showFeedback } = w.Modals;
    // save → error → save → error → save → success: the shape that used to
    // discard a failure, because the cap sliced from the FRONT (the oldest).
    showFeedback("Layout saved", "success");
    showFeedback("Template could not be applied", "error");
    showFeedback("Layer added", "info");
    showFeedback("Backup failed (quota)", "error");
    showFeedback("Layout saved", "success");
    showFeedback("Clone created", "success");

    const errors = errorToastsIn(w);
    assert.strictEqual(errors.length, 2, "no error toast may be evicted by the cap");
    const errorText = errors.map((el) => el.textContent).join(" | ");
    assert.match(errorText, /Template could not be applied/, "the first error survives");
    assert.match(errorText, /Backup failed \(quota\)/, "the second error survives");
  });

  it("still caps the stack of NON-error toasts (the cap is not removed, it is re-aimed)", function () {
    const w = bootModals();
    const { showFeedback } = w.Modals;
    for (let i = 1; i <= 6; i++) showFeedback(`saved ${i}`, "success");

    const nonErrors = nonErrorToastsIn(w);
    assert.ok(nonErrors.length <= 3, `non-error stack capped, got ${nonErrors.length}`);
    assert.strictEqual(nonErrors.length, 3, "the cap is exactly 3");
    // The NEWEST survive: the oldest are the ones evicted, as before.
    const text = nonErrors.map((el) => el.textContent).join(" | ");
    assert.match(text, /saved 6/, "the newest toast is present");
    assert.ok(!/saved 1\b/.test(text), "the oldest non-error toast was evicted");
  });

  it("bounds the total DOM even when every toast is an error (errors yield to nothing)", function () {
    const w = bootModals();
    const { showFeedback } = w.Modals;
    for (let i = 1; i <= 5; i++) showFeedback(`failure ${i}`, "error");
    // Errors are not evicted by the cap, so 5 stay visible; the honest bound is
    // "one element per raised toast, no duplicates, and nothing else".
    assert.strictEqual(toastsIn(w).length, 5, "one element per error toast");
    assert.strictEqual(
      w.document.querySelectorAll(".be-feedback").length,
      errorToastsIn(w).length,
      "every element really is an error toast",
    );
  });

  it("gives every toast a keyboard-reachable dismiss control that is announced", function () {
    const w = bootModals();
    w.Modals.showFeedback("Layout saved", "success");
    const toast = toastsIn(w)[0];
    const dismiss = toast.querySelector(".be-feedback-dismiss");
    assert.ok(dismiss, "a dismiss control exists");
    assert.strictEqual(dismiss.tagName, "BUTTON", "a real button, so Tab reaches it");
    assert.notStrictEqual(dismiss.getAttribute("tabindex"), "-1", "not removed from tab order");
    assert.match(
      dismiss.getAttribute("aria-label") || "",
      /dismiss/i,
      "it is labelled for assistive tech (and the label names the toast)",
    );
    assert.match(dismiss.getAttribute("aria-label"), /Layout saved/);
  });

  it("activating the dismiss control removes THAT toast, leaves the others, and announces it", function () {
    const w = bootModals();
    const { showFeedback } = w.Modals;
    showFeedback("first", "info");
    showFeedback("SECOND — the one to dismiss", "info");
    showFeedback("third", "info");
    assert.strictEqual(toastsIn(w).length, 3);

    const target = toastsIn(w).find((el) =>
      el.textContent.includes("the one to dismiss"),
    );
    target.querySelector(".be-feedback-dismiss").click();

    const left = toastsIn(w).map((el) => el.textContent);
    assert.strictEqual(left.length, 2, "exactly one toast was removed");
    assert.ok(!left.some((t) => t.includes("the one to dismiss")), "the dismissed one is gone");
    assert.ok(left.some((t) => t.includes("first")), "the others are untouched");
    assert.ok(left.some((t) => t.includes("third")), "the others are untouched");

    const lane = w.document.getElementById("be-feedback-announcer");
    assert.ok(lane, "a polite live region exists to report the dismissal");
    assert.strictEqual(lane.getAttribute("role"), "status");
    assert.strictEqual(lane.getAttribute("aria-live"), "polite");
    assert.match(lane.textContent, /dismissed/i, "the dismissal is announced");
    assert.match(lane.textContent, /the one to dismiss/, "and it says WHAT was dismissed");
    // The announcer must not be reachable as a toast, or it would corrupt the cap.
    assert.strictEqual(
      toastsIn(w).some((el) => el.id === "be-feedback-announcer"),
      false,
      "the announcer is not itself a toast",
    );
  });

  it("stacks the lane so no toast covers another's dismiss control (measured defect)", function () {
    const w = bootModals();
    const { showFeedback } = w.Modals;
    showFeedback("first", "info");
    showFeedback("second", "error");
    showFeedback("third", "success");

    const toasts = toastsIn(w);
    assert.strictEqual(toasts.length, 3);
    // Every toast used to share top:36, so they were painted on top of one
    // another: only the last was fully visible and the earlier ones' dismiss
    // controls could not be clicked at all.
    const tops = toasts.map((t) => t.style.top);
    assert.strictEqual(new Set(tops).size, 3, "each toast has its own lane slot: " + tops);
    const numeric = toasts.map((t) => parseFloat(t.style.top));
    assert.deepStrictEqual(
      numeric.slice().sort((a, b) => a - b),
      numeric,
      "the slots are ordered top-to-bottom in DOM order",
    );
    // ...and the offsets are real, not 0/garbage.
    assert.ok(numeric[1] > numeric[0], "second row sits below the first");
    assert.ok(numeric[2] > numeric[1], "third row sits below the second");
    // Removing one re-lays the lane so the survivors close the gap.
    toasts[0].querySelector(".be-feedback-dismiss").click();
    const after = toastsIn(w).map((t) => parseFloat(t.style.top));
    assert.strictEqual(after.length, 2);
    assert.strictEqual(after[0], 36, "the new first toast returns to the lane anchor");
  });

  it("Escape dismisses the toast that has focus (keyboard parity with the ✕)", function () {
    const w = bootModals();
    w.Modals.showFeedback("Escape me", "info");
    const toast = toastsIn(w)[0];
    const evt = new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    toast.dispatchEvent(evt);
    assert.strictEqual(toastsIn(w).length, 0, "Escape removed it");
    assert.match(
      w.document.getElementById("be-feedback-announcer").textContent,
      /dismissed/i,
    );
  });
});

describe("AC-2 — a successful boot restore says so (U-15)", function () {
  function bootPersistence() {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      runScripts: "dangerously",
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    w.__DDB_TEST_MODE__ = true;
    w.safeLog = () => {};
    const toasts = [];
    w.showFeedback = (msg, type) => toasts.push({ msg, type: type || "info" });
    w.eval(read("persistence.js"));
    return { w, toasts, P: w.Persistence };
  }

  it("names the layout source, and the default-applied case reads differently", function () {
    const { w, toasts } = bootPersistence();
    assert.strictEqual(typeof w.announceBootRestore, "function", "the seam exists");

    assert.strictEqual(w.announceBootRestore({ restored: true }), "restored");
    const restoredCopy = toasts[0];
    assert.ok(restoredCopy, "the restored path announces something");
    assert.strictEqual(restoredCopy.type, "success", "a restore is a success");
    assert.match(restoredCopy.msg, /restor/i, "it says the layout was restored");

    w.announceBootRestore({ restored: false, reason: "empty" });
    const defaultCopy = toasts[1];
    assert.ok(defaultCopy, "the default path announces something");
    assert.notStrictEqual(
      defaultCopy.msg,
      restoredCopy.msg,
      "the two outcomes must not read the same — that was the whole defect",
    );
    assert.match(defaultCopy.msg, /no saved layout/i, "it says there was nothing to restore");
    assert.match(defaultCopy.msg, /default/i, "and that the default is showing");
  });

  it("stays SILENT when the restore failed — the recovery card owns that message", function () {
    const { w, toasts } = bootPersistence();
    assert.strictEqual(
      w.announceBootRestore({ restored: false, reason: "invalid" }),
      "silent",
    );
    assert.strictEqual(
      w.announceBootRestore({ restored: false, reason: "error", detail: "boom" }),
      "silent",
    );
    assert.deepStrictEqual(toasts, [], "no toast for a failure (no double-reporting)");
  });

  it("fires exactly once per boot (one call site, one announcement)", function () {
    const main = read("main.js");
    const calls = main.match(/announceBootRestore\(/g) || [];
    assert.strictEqual(
      calls.length,
      1,
      "the boot glue calls it once — a second call site would double-fire on a " +
        "restore followed by an autosave",
    );
    // ...and one call produces exactly one toast, so one call site == one message.
    const { w, toasts } = bootPersistence();
    w.announceBootRestore({ restored: true });
    assert.strictEqual(toasts.length, 1);
  });
});

describe("AC-3 — a partial merged-spell restore is reported (U-19)", function () {
  async function bootWithBackups() {
    const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
    const dom = new JSDOM(
      '<!doctype html><html><body><div id="print-layout-wrapper"></div></body></html>',
      { runScripts: "dangerously" },
    );
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    w.indexedDB = indexedDB;
    w.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    w.__DDB_TEST_MODE__ = true;
    const toasts = [];
    w.showFeedback = (msg, type) => toasts.push({ msg, type: type || "info" });
    w.safeLog = () => {};
    w.getCharacterId = () => "char-1";
    w.applyDefaultLayout = async () => {};
    w.updateLayoutBounds = () => {};
    w.eval(read("storage.js"));
    w.eval(read("modals.js"));
    w.eval(read("persistence.js"));
    // These two MUST be stubbed AFTER the eval: js/persistence.js re-exports
    // `createBackupSnapshot` / `confirmDestructive` onto `window` as it loads, so
    // a pre-eval stub is silently overwritten and the real backup runs against
    // IndexedDB (which is what made the first draft of this test hang rather than
    // fail — a silent harness bug, not a product one).
    w.createBackupSnapshot = async () => ({ ok: true, record: { id: "bk-1" } });
    w.confirmDestructive = async () => true;
    await w.__DDBStorage.init();
    return { w, toasts };
  }

  it("continues past a throwing spell and reports ONE aggregated message", async function () {
    const { w, toasts } = await bootWithBackups();
    // Three merged spells; the middle one throws when recreated.
    for (const name of ["Fireball", "Booming Blade", "Cure Wounds"]) {
      const el = w.document.createElement("div");
      el.setAttribute("data-be-spell-merge", name);
      w.document.body.appendChild(el);
    }
    const attempted = [];
    w.createSpellDetailSection = async (name) => {
      attempted.push(name);
      if (name === "Booming Blade") throw new Error("fetch exploded");
    };

    await w.Persistence.handleLoadDefault();

    assert.deepStrictEqual(
      attempted.slice().sort(),
      ["Booming Blade", "Cure Wounds", "Fireball"],
      "every merged spell is still attempted — one failure must not abort the rest",
    );
    const errors = toasts.filter((t) => t.type === "error");
    assert.strictEqual(errors.length, 1, "exactly ONE aggregated message, not one per failure");
    assert.match(errors[0].msg, /Booming Blade/, "it names what did not come back");
    assert.ok(
      !errors[0].msg.includes("Fireball") && !errors[0].msg.includes("Cure Wounds"),
      "it does not name the spells that DID restore: " + errors[0].msg,
    );
  });

  it("says nothing when every merged spell came back", async function () {
    const { w, toasts } = await bootWithBackups();
    const el = w.document.createElement("div");
    el.setAttribute("data-be-spell-merge", "Fireball");
    w.document.body.appendChild(el);
    w.createSpellDetailSection = async () => {};

    await w.Persistence.handleLoadDefault();
    assert.deepStrictEqual(
      toasts.filter((t) => t.type === "error"),
      [],
      "no failure message when there was no failure",
    );
  });
});

describe("AC-4 — the spell error names the actual cause (U-18)", function () {
  /**
   * Boot spells_ui with the seams the real module needs, plus a controllable
   * character-fetch. The DEFAULT fetch seam is the module's own
   * fetchSpellWithCache, so the reason codes under test come from real code
   * rather than from a hand-set flag.
   */
  function bootSpells({ charId = "12345", spellList = null, failFetch = false } = {}) {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: `https://www.dndbeyond.com/characters/${charId}`,
      runScripts: "dangerously",
    });
    const w = dom.window;
    global.window = w;
    global.document = w.document;
    global.HTMLElement = w.HTMLElement;
    global.Node = w.Node;
    w.__DDB_TEST_MODE__ = true;
    w.safeLog = () => {};
    w.showFeedback = () => {};

    // Storage seam: always a cache miss.
    w.__DDBStorage = {
      init: async () => {},
      getSpell: async () => null,
      saveSpells: async () => {},
    };

    // The character-data transport (chrome.runtime.sendMessage in MV3).
    w.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          if (failFetch) return cb(null); // transport failure → transient
          cb({
            success: true,
            data: {
              data: {
                classSpells: [],
                spells: {
                  race: [],
                  class: (spellList || []).map((definition) => ({ definition })),
                  feat: [],
                  item: [],
                },
              },
            },
          });
        },
      },
    };

    // Container seams for createSpellDetailSection.
    w.createDraggableContainer = (cls, content, id) => {
      const wrapper = w.document.createElement("div");
      wrapper.className = "be-section-wrapper";
      wrapper.dataset.title = cls;
      const container = w.document.createElement("div");
      container.className = "print-section-container be-spell-detail";
      container.id = id;
      container.appendChild(content);
      wrapper.appendChild(container);
      w.document.body.appendChild(wrapper);
      return wrapper;
    };
    w.applyFontSize = () => {};
    w.initResizeLogic = () => {};
    w.updateLayoutBounds = () => {};
    w.refreshLayers = () => {};
    w.injectSpellDetailTriggers = () => {};
    const layoutRoot = w.document.createElement("div");
    layoutRoot.id = "print-layout-wrapper";
    w.document.body.appendChild(layoutRoot);
    const sectionsLayer = w.document.createElement("div");
    sectionsLayer.id = "print-enhance-sections-layer";
    w.document.body.appendChild(sectionsLayer);
    w.DomManager = {
      getInstance: () => ({
        getLayoutRoot: () => ({ element: layoutRoot }),
        getSectionsLayer: () => ({ element: sectionsLayer }),
        getShapesLayer: () => ({ element: sectionsLayer }),
        getActiveShapesLayer: () => ({ element: sectionsLayer }),
      }),
    };
    // AC-5 (track refactor_surface_20260911): spells_ui.js reads the ONE z-index declaration at
    // CALL time, and in the extension every module shares one scope, so the declaring module is
    // loaded with it here too — the harness mirrors the script order rather than stubbing the map.
    w.eval(read("section_utils.js"));
    w.eval(read("spells_ui.js"));
    // main.js mirrors the module's fetch onto window; do the same so the module
    // resolves its own implementation (as it does in the extension).
    w.fetchSpellWithCache = w.SpellsUi.fetchSpellWithCache;
    return w;
  }

  const spellDef = (name) => ({
    name,
    level: 1,
    description: "<p>a description</p>",
    range: { rangeValue: 60, origin: "Feet" },
    school: "Evocation",
  });

  it("classifies a spell the character does NOT have as 'not-in-list' (real fetch path)", async function () {
    const w = bootSpells({ spellList: [spellDef("Fireball")] });
    const result = await w.fetchSpellWithCache("Wish");
    assert.strictEqual(result, null, "the spell is not available");
    assert.strictEqual(
      w.SpellsUi.getLastSpellLoadFailure(),
      "not-in-list",
      "the character's list DID load — the spell is genuinely absent",
    );
  });

  it("classifies a broken character fetch as 'fetch-error', not a missing spell", async function () {
    const w = bootSpells({ failFetch: true });
    const result = await w.fetchSpellWithCache("Fireball");
    assert.strictEqual(result, null);
    assert.strictEqual(
      w.SpellsUi.getLastSpellLoadFailure(),
      "fetch-error",
      "a transient/unknown failure must NOT be reported as an absent spell",
    );
  });

  it("clears the reason on a successful load (no stale classification)", async function () {
    const w = bootSpells({ spellList: [spellDef("Fireball")] });
    await w.fetchSpellWithCache("Wish"); // sets 'not-in-list'
    const ok = await w.fetchSpellWithCache("Fireball");
    assert.ok(ok, "the spell loaded");
    assert.strictEqual(w.SpellsUi.getLastSpellLoadFailure(), null, "reason cleared");
  });

  it("renders DISTINCT copy per cause, with the manage-spells instruction only when actionable", async function () {
    // absent → actionable
    const absent = bootSpells({ spellList: [spellDef("Fireball")] });
    await absent.SpellsUi.createSpellDetailSection("Wish", { x: 0, y: 0 });
    const absentText = absent.document.querySelector(".be-spell-detail").textContent;

    // transient → NOT actionable
    const transient = bootSpells({ failFetch: true });
    await transient.SpellsUi.createSpellDetailSection("Fireball", { x: 0, y: 0 });
    const transientText = transient.document.querySelector(".be-spell-detail").textContent;

    assert.notStrictEqual(
      absentText.replace(/\s+/g, " ").trim(),
      transientText.replace(/\s+/g, " ").trim(),
      "the two failure paths must not share one message",
    );
    assert.match(
      absentText,
      /not in this character/i,
      "the absent case says the spell is not the character's: " + absentText,
    );
    assert.match(
      absentText,
      /manage spells/i,
      "…and only there is the manage-spells instruction offered",
    );
    // THE NEGATIVE ASSERTION (falsified by probe 2 — see the Phase 1 commit):
    // a transient failure must not send the user to the manage-spells button.
    assert.ok(
      !/manage spells/i.test(transientText),
      "the transient case must NOT blame the manage-spells button: " + transientText,
    );
    assert.match(
      transientText,
      /failed/i,
      "the transient case names the load failure: " + transientText,
    );
    assert.match(transientText, /retry/i, "and it points at the action that can help");
  });
});
