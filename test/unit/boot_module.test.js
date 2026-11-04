/**
 * The extracted boot module — track `refactor_surface_20261101`, Phase 1 (AC-1/AC-2 proof).
 *
 * WHAT THIS PINS. `js/main.js`'s async IIFE body (Storage.init -> suppressResizeEvents -> the
 * init mutations -> createControls -> DDB_IS_ON -> restoreLayout's three branches ->
 * dismissActivationOverlay -> toggleShapesMode(false)) now lives in `js/boot.js` behind
 * `window.Boot.boot()`. That is a MOVE, so the risk is not "does the new code work" but "does the
 * sequence still run, in order, against seams that still EXIST".
 *
 * The second half is the one that would rot silently, and it has already bitten once: `boot()`
 * resolves every step through `window` at CALL time and SKIPS an absent seam by design (fail-open,
 * the range's convention). So a step whose `window.*` export nobody publishes does not throw — it
 * vanishes. Extracting the IIFE dropped `addInteractiveTidbitSection` for exactly that reason (it
 * was the one mutation the IIFE called as a LOCAL, so it had never been published), and the
 * `window.addInteractiveTidbitSection` export in `js/main.js` is the fix. The inventory case below
 * is what stops a second one: it compares the step list boot() actually calls against the exports
 * the injected modules actually publish, in BOTH directions.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BOOT_SRC = fs.readFileSync(path.join(ROOT, "js", "boot.js"), "utf8");
const MAIN_SRC = fs.readFileSync(path.join(ROOT, "js", "main.js"), "utf8");

/** The step names `boot()` drives through `bootStep("…")`, in the order the file declares them. */
function stepsFromSource() {
  const body = BOOT_SRC.slice(BOOT_SRC.indexOf("async function boot("));
  return Array.from(body.matchAll(/bootStep\(\s*"([^"]+)"/g), (m) => m[1]);
}

/** The `window.<name> = ` exports of one injected source file. */
function windowExportsOf(src) {
  return Array.from(src.matchAll(/^\s*window\.([A-Za-z_$][\w$]*)\s*=/gm), (m) => m[1]);
}

/**
 * Every `window.<name>` export across the injected file list — the same list the browser executes in
 * one shared scope (`js/background.js`), which is what makes "is this seam published" answerable
 * statically. Read from the product's own list rather than a copy: a copy is the drift this case is
 * meant to catch.
 */
function publishedSeams() {
  const background = fs.readFileSync(path.join(ROOT, "js", "background.js"), "utf8");
  const match = /files:\s*\[([\s\S]*?)\]/.exec(background);
  assert.ok(match, "could not parse the injected file list from js/background.js");
  const files = Array.from(match[1].matchAll(/'([^']+)'/g), (x) => x[1]);
  const published = new Set();
  for (const rel of files) {
    for (const name of windowExportsOf(fs.readFileSync(path.join(ROOT, rel), "utf8"))) {
      published.add(name);
    }
  }
  return { published, files };
}

/* ------------------------------------------------------------------ */
/* The seam itself (AC-1 / AC-2)                                       */
/* ------------------------------------------------------------------ */
describe("AC-1/AC-2 — js/boot.js exposes the orchestration seam and nothing else", function () {
  it("publishes exactly ONE top-level binding: window.Boot", function () {
    assert.deepStrictEqual(windowExportsOf(BOOT_SRC), ["Boot"]);
  });

  it("window.Boot carries a callable boot and nothing else", function () {
    const assign = /window\.Boot\s*=\s*\{([^}]*)\}/.exec(BOOT_SRC);
    assert.ok(assign, "window.Boot is assigned an object literal");
    const keys = Array.from(assign[1].matchAll(/([A-Za-z_$][\w$]*)\s*[,:}]/g), (m) => m[1]).filter(
      (k) => k !== "boot",
    );
    assert.deepStrictEqual(keys, [], "the seam is ONE function, not a surface of many");
    assert.ok(/window\.Boot\s*=\s*\{\s*boot\s*\}/.test(BOOT_SRC), "and that function is `boot`");
  });

  it("is idempotent across re-injection (the browser can inject twice)", function () {
    assert.ok(
      /if\s*\(\s*window\.Boot\s*\)\s*return;/.test(BOOT_SRC),
      "boot.js returns early when window.Boot already exists",
    );
  });

  it("is loaded by the product AFTER its seams and BEFORE its one caller", function () {
    const background = fs.readFileSync(path.join(ROOT, "js", "background.js"), "utf8");
    const match = /files:\s*\[([\s\S]*?)\]/.exec(background);
    const files = Array.from(match[1].matchAll(/'([^']+)'/g), (x) => x[1]);
    const iBoot = files.indexOf("js/boot.js");
    assert.ok(iBoot > 0, "js/boot.js is in the injected list");
    assert.strictEqual(files[iBoot + 1], "js/main.js", "it sits immediately before its only caller");
  });

  it("main.js delegates instead of keeping a second copy of the sequence", function () {
    assert.ok(
      /await window\.Boot\.boot\(/.test(MAIN_SRC),
      "main.js calls the seam (defined AND used in the same track)",
    );
    // A duplicated inline fallback is the failure this direction forbids: it would run a stale
    // startup path that no test covers. main.js keeps ONLY the mount + the re-run gate.
    assert.ok(
      !/await restoreLayout\(\)/.test(MAIN_SRC),
      "the restore branch no longer lives in main.js",
    );
    assert.ok(
      !/await Storage\.init\(\)/.test(MAIN_SRC),
      "storage init no longer lives in main.js",
    );
  });
});

/* ------------------------------------------------------------------ */
/* The seam inventory (the durable half of AC-1)                       */
/* ------------------------------------------------------------------ */
describe("AC-1 — every step boot() drives is a published window seam", function () {
  const steps = stepsFromSource();

  it("finds a real step list (not vacuous)", function () {
    assert.ok(steps.length >= 20, "boot() drives the whole startup sequence, got " + steps.length);
    for (const required of [
      "suppressResizeEvents",
      "enforceFullHeight",
      "movePortrait",
      "addInteractiveTidbitSection",
      "initDragAndDrop",
      "createControls",
      "updateLayoutBounds",
      "dismissActivationOverlay",
      "toggleShapesMode",
    ]) {
      assert.ok(steps.includes(required), "boot() still drives " + required);
    }
  });

  it("publishes EVERY step it calls — a skipped step is a silent no-op, not an error", function () {
    const { published } = publishedSeams();
    const missing = steps.filter((s) => !published.has(s));
    assert.deepStrictEqual(
      missing,
      [],
      "boot() would silently skip these: " + missing.join(", "),
    );
  });

  it("names the exact defect this case was written for", function () {
    // addInteractiveTidbitSection was the ONE mutation the IIFE called as a LOCAL, so extracting
    // the IIFE dropped it without a single failing test. It is published now, and this asserts the
    // reason is stated at the declaring site rather than re-derived from a passing run.
    const { published } = publishedSeams();
    assert.ok(published.has("addInteractiveTidbitSection"));
    assert.ok(
      /window\.addInteractiveTidbitSection\s*=\s*addInteractiveTidbitSection/.test(MAIN_SRC),
      "main.js publishes it",
    );
    assert.ok(
      /Track refactor_surface_20261101 \(Phase 1\)[\s\S]{0,700}window\.addInteractiveTidbitSection/.test(
        MAIN_SRC,
      ),
      "and says why at the declaring site",
    );
  });
});

/* ------------------------------------------------------------------ */
/* The ordering contract, with real behaviour                          */
/* ------------------------------------------------------------------ */
describe("AC-1 — boot() runs the sequence in order, against live seams", function () {
  const { boot } = require("./encapsulation_debt/debt_harness.js");

  /**
   * Drive `window.Boot.boot()` against a page whose seams are RECORDERS, so the assertion is the
   * call order the product depends on (a restore before its announcement, the overlay dismissed
   * after the sheet is enhanced, shapes mode last) rather than "the function returned".
   */
  async function runWithRecorders(setup) {
    const b = boot();
    const w = b.window;
    const calls = [];
    const stepNames = stepsFromSource();
    for (const name of stepNames) {
      w[name] = (...args) => {
        calls.push({ name, args });
      };
    }
    // The overlay is driven with the restore RESULT, so keep the restore seam honest too.
    w.dismissActivationOverlay = (result) => {
      calls.push({ name: "dismissActivationOverlay", args: [result] });
    };
    w.toggleShapesMode = (force) => {
      calls.push({ name: "toggleShapesMode", args: [force] });
    };
    w.Persistence = {
      restoreLayout: async () => ({ restored: true }),
      applyDefaultLayout: async () => {
        calls.push({ name: "applyDefaultLayout", args: [] });
      },
      restoreFailureCard: () => {
        calls.push({ name: "restoreFailureCard", args: [] });
      },
      announceBootRestore: (result) => {
        calls.push({ name: "announceBootRestore", args: [result] });
      },
    };
    w.chrome = { runtime: { sendMessage: (msg) => calls.push({ name: "sendMessage", args: [msg] }) } };
    if (setup) setup(w, calls);
    const completed = await w.Boot.boot();
    return { w, calls, completed, cleanup: b.cleanup };
  }

  it("calls the mutations in the declared order and finishes with shapes mode OFF", async function () {
    const { calls, completed, cleanup } = await runWithRecorders();
    try {
      assert.strictEqual(completed, true, "boot() reports completion");
      const order = calls.map((c) => c.name);
      const revisit = stepsFromSource().filter((s) => order.includes(s));
      assert.deepStrictEqual(
        order.filter((n) => revisit.includes(n)),
        revisit,
        "the observed order equals the declared order",
      );
      assert.deepStrictEqual(calls[calls.length - 1], {
        name: "toggleShapesMode",
        args: [false],
      }, "default-off is the LAST thing boot does");
      assert.ok(
        order.indexOf("announceBootRestore") > order.indexOf("updateLayoutBounds"),
        "the restore announcement comes AFTER the restored branch's bounds update",
      );
      assert.ok(
        order.indexOf("dismissActivationOverlay") > order.indexOf("announceBootRestore"),
        "the overlay is dismissed LAST-but-one — never before the announcement",
      );
      // The message object is built INSIDE the jsdom realm, so its prototype is that realm's
      // `Object.prototype` — `deepStrictEqual` would compare prototypes and fail on a correct value.
      assert.strictEqual(
        calls.find((c) => c.name === "sendMessage").args[0].type,
        "DDB_IS_ON",
        "the badge claim is announced from the boot that actually happened",
      );
    } finally {
      cleanup();
    }
  });

  it("a restore that FAILED surfaces the recovery card and still announces", async function () {
    const result = { restored: false, reason: "parse-error" };
    const { calls, cleanup } = await runWithRecorders((w, c) => {
      w.Persistence.restoreLayout = async () => result;
      w.Persistence.applyDefaultLayout = async () => c.push({ name: "applyDefaultLayout" });
      w.Persistence.restoreFailureCard = (r) => c.push({ name: "restoreFailureCard", args: [r] });
    });
    try {
      const names = calls.map((c) => c.name);
      assert.ok(
        names.includes("applyDefaultLayout"),
        "a usable default is established before explaining what happened",
      );
      assert.ok(names.includes("restoreFailureCard"), "and the failure is never a silent downgrade");
      assert.deepStrictEqual(
        calls.find((c) => c.name === "restoreFailureCard").args[0],
        result,
        "the card is handed the reason",
      );
      assert.ok(names.includes("announceBootRestore"));
    } finally {
      cleanup();
    }
  });

  it("an EMPTY layout applies the default and raises no failure card", async function () {
    const { calls, cleanup } = await runWithRecorders((w, c) => {
      w.Persistence.restoreLayout = async () => ({ restored: false, reason: "empty" });
      w.Persistence.applyDefaultLayout = async () => c.push({ name: "applyDefaultLayout" });
    });
    try {
      const names = calls.map((c) => c.name);
      assert.ok(names.includes("applyDefaultLayout"));
      assert.ok(
        !names.includes("restoreFailureCard"),
        "nothing failed, so nothing claims it did",
      );
    } finally {
      cleanup();
    }
  });

  it("a missing seam is SKIPPED, not fatal — and a throwing seam cannot abort the boot", async function () {
    const { calls, completed, cleanup } = await runWithRecorders((w) => {
      delete w.movePortrait;
      w.enforceFullHeight = () => {
        throw new Error("boom");
      };
    });
    try {
      assert.strictEqual(completed, true, "boot still completes (fail-open is the convention)");
      const names = calls.map((c) => c.name);
      assert.ok(!names.includes("movePortrait"), "the absent seam made no call");
      assert.ok(names.includes("moveDefenses"), "and the step AFTER it still ran");
      assert.ok(names.includes("toggleShapesMode"), "the tail of the sequence is reached");
    } finally {
      cleanup();
    }
  });

  it("the caller's gate halts boot at exactly the original point and resumes nothing", async function () {
    const b = boot();
    const w = b.window;
    const calls = [];
    for (const name of stepsFromSource()) w[name] = () => calls.push(name);
    w.Persistence = { restoreLayout: async () => ({ restored: true }) };
    try {
      let gateSaw = null;
      const completed = await w.Boot.boot(async () => {
        // The gate must observe a storage-initialised, resize-suppressed page, and NOT one
        // mutation — that is the original IIFE's order, which this hook replaced.
        gateSaw = calls.slice();
        return false;
      });
      assert.strictEqual(completed, false, "returning false halts the boot");
      assert.deepStrictEqual(
        gateSaw,
        ["suppressResizeEvents"],
        "storage init + resize suppression ran; no mutation had started",
      );
      assert.deepStrictEqual(calls, ["suppressResizeEvents"], "and nothing ran after the gate");
    } finally {
      b.cleanup();
    }
  });
});
