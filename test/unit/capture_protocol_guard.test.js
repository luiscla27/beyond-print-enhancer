/**
 * The capture-and-push protocol guard — AC-2's FOUR layers (track refactor_surface_20260911,
 * Phase 2).
 *
 * WHY FOUR LAYERS AND NOT ONE TEXT SCAN. The GATE 2 Challenge called the plan's single
 * source-scan a proxy, correctly: *"text absence proves text absence"*. A file can be
 * text-compliant and still resolve to a different runtime path, or repair nothing. So each layer
 * asserts something the others cannot:
 *
 *   1. STATIC / DUPLICATION — exactly one DEFINITION of `beginMutation`/`pushMutation` in product
 *      source, and no call site carrying the inline three-branch dance. Falsified by
 *      re-introducing either.
 *   2. RUNTIME SEAM — the seam holds one implementation, a second registration cannot overwrite
 *      it, and every CONSUMER resolves it at CALL time: after boot, the seam is replaced with a
 *      spy and a real call site is driven, so a load-time captured reference would keep calling
 *      the old function and this fails.
 *   3. BEHAVIOURAL — the surviving implementation repairs a SETTLED capture. Driven here at
 *      runtime through the live seam, so a later refactor of the helper cannot silently drop it;
 *      the gesture-level versions of this are `test/unit/undo_stack_adversarial.test.js` §1/§3.
 *   4. VOCABULARY INTERFACE — no new bare tag literal: every tag the sites pass is one of the 14
 *      the Phase 0 inventory recorded, read back from `scripts/inventory_mutation_tags.py`, so
 *      this layer can fail inside Phase 2 instead of waiting for Phase 3. (Phase 3 replaces the
 *      RECORDED set with the single declaration and keeps this assertion.)
 *
 * Scope: product source only. `test/browser_e2e/` is excluded deliberately — a spec's own
 * capture plumbing is not a product call site, and scanning it was named as a false-positive
 * source in review 2 §3 (AC-6).
 */
const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { boot, waitFor } = require("./encapsulation_debt/debt_harness.js");
const LayerManager = require("../../js/dom/layer_manager.js");

const ROOT = path.resolve(__dirname, "..", "..");
const DND_JS = fs.readFileSync(path.join(ROOT, "js", "dnd.js"), "utf8");

/** Every product source file, `js/` recursively — never a test or an e2e spec. */
function productSources() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith(".js")) out.push(full);
    }
  };
  walk(path.join(ROOT, "js"));
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

/** The recorded tag set from the Phase 0 inventory — never a hand transcription (F-5). */
function inventory() {
  return JSON.parse(
    execFileSync(
      process.platform === "win32" ? "python" : "python3",
      ["scripts/inventory_mutation_tags.py", "--json"],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
}

describe("AC-2 layer 1 — the protocol is defined ONCE, and no site hand-rolls it", function () {
  this.timeout(20000);

  it("exactly one definition of beginMutation and pushMutation exists in product source", function () {
    const defs = { beginMutation: [], pushMutation: [] };
    for (const p of productSources()) {
      const text = fs.readFileSync(p, "utf8");
      for (const name of Object.keys(defs)) {
        // A function declaration, or a class method — both are "a definition".
        const re = new RegExp("(?:^|[\\s;{(])" + name + "\\s*\\([^)]*\\)\\s*\\{", "g");
        for (const m of text.match(re) || []) defs[name].push(rel(p) + " :: " + m.trim());
      }
    }
    // The module that OWNS the stack owns the protocol: Phase 4 (AC-4) moved both from
    // js/persistence.js to js/undo.js, and this expectation follows them.
    assert.deepStrictEqual(
      defs.beginMutation.map((d) => d.split(" ")[0]),
      ["js/undo.js"],
      "beginMutation has ONE definition; found: " + JSON.stringify(defs.beginMutation),
    );
    assert.deepStrictEqual(
      defs.pushMutation.map((d) => d.split(" ")[0]),
      ["js/undo.js"],
      "pushMutation has ONE definition; found: " + JSON.stringify(defs.pushMutation),
    );
  });

  it("no product file outside js/persistence.js calls pushUndo or captureLiveLayout DIRECTLY", function () {
    // The review of this phase (phase2_execution_review.md §1) named the gap in the test above:
    // "no inline dance" is necessary but not sufficient, because a bypass could keep a different
    // shape. The stronger, simpler invariant is this one — the ONLY doors into the stack are the
    // three shared entries, so a raw push or a raw capture anywhere else is a finding by name.
    //
    // MEASURED before asserting: there are ZERO direct call sites outside `js/persistence.js`
    // today. Every product site goes through `window.beginMutation` / `window.pushMutation`
    // (the snapshot+push pair) or `window.captureUndo` (the awaiting variant, `js/controls.js`,
    // `js/main.js`, `js/properties_panel.js`, `js/section_cloning.js`), and both of those live in
    // `js/persistence.js` and call the same internals.
    // THE ONE WRITER: `pushUndo` may only be reached from the module that owns the stack
    // (js/undo.js since AC-4's split). `captureLiveLayout` — a CAPTURE, not a push — has one
    // more legitimate caller, named rather than waved through: the destructive GATE in
    // js/recovery_ui.js attaches the LIVE pre-state to the backup record, at the last moment
    // the pre-state still exists in the DOM. That is a reader of the capture entry point, not a
    // second writer of the stack, so it is an allowlisted caller rather than an offender.
    const STACK_OWNER = "js/undo.js";
    const CAPTURE_CALLERS = ["js/undo.js", "js/recovery_ui.js"];
    const offenders = [];
    for (const p of productSources()) {
      const file = rel(p);
      const text = fs.readFileSync(p, "utf8");
      // Both the dotted form and the BRACKET form (`window["pushUndo"](…)`) — bracket access
      // was named by the Phase 2 review as the syntactic edge a dotted scan cannot see.
      const re = /(window\s*\[\s*["'](pushUndo|captureLiveLayout)["']\s*\]|(?:window\.)?(pushUndo|captureLiveLayout))\s*\(/g;
      for (const m of text.match(re) || []) {
        const name = m[1] || m[2];
        const allowed = name === "pushUndo" ? [STACK_OWNER] : CAPTURE_CALLERS;
        if (allowed.includes(file)) continue;
        offenders.push(file + " :: " + m[0].trim());
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      "a product file outside js/persistence.js reaches into the stack directly instead of " +
        "using beginMutation/pushMutation/captureUndo:\n" + offenders.join("\n"),
    );
  });

  it("every capture/push entry point in product source is one of the three shared entries", function () {
    // The positive half of the assertion above: the call sites that DO exist must name a shared
    // entry, so removing a raw call cannot be "fixed" by introducing a fourth entry point.
    const SHARED = ["beginMutation", "pushMutation", "captureUndo"];
    const named = new Set();
    for (const p of productSources()) {
      if (rel(p) === "js/persistence.js") continue;
      const text = fs.readFileSync(p, "utf8");
      for (const name of SHARED) {
        const re = new RegExp("window\\." + name + "\\b", "g");
        (text.match(re) || []).forEach(() => named.add(name));
      }
    }
    assert.deepStrictEqual(
      [...named].sort(),
      [...SHARED].sort(),
      "all three shared entries are in use (a name that no site uses would mean a dead door)",
    );
  });

  it("no product file carries the inline three-branch capture dance at a call site", function () {
    // The shape that drifted: `if (settled) { push(raw) } else if (capture) { capture.then(...) }`
    // spelled out at the call site. The routed sites pass a `repair` callback instead.
    const offenders = [];
    for (const p of productSources()) {
      const text = fs.readFileSync(p, "utf8");
      // A `.settled` test that is immediately followed by a pushUndo with no repair argument.
      const re = /if\s*\(\s*(?:mut|state|this\._\w+)?\.?settled\s*\)\s*\{[\s\S]{0,200}?pushUndo\s*\(/g;
      for (const m of text.match(re) || []) offenders.push(rel(p) + " :: " + m.replace(/\s+/g, " ").slice(0, 120));
    }
    assert.deepStrictEqual(
      offenders,
      [],
      "a call site is hand-rolling the settled branch again (this is how F-1 drifted):\n" +
        offenders.join("\n"),
    );
  });
});

describe("AC-2 layer 2 — one runtime seam, resolved at CALL time by every consumer", function () {
  this.timeout(20000);
  let window, document, cleanup;

  beforeEach(async function () {
    const b = boot(
      `<!DOCTYPE html><html><body>
        <div id="print-layout-wrapper">
          <div id="print-enhance-sections-layer">
            <div class="be-section-wrapper" id="wrapper-main" data-title="Main">
              <div class="print-section-container" id="section-main">
                <div class="print-section-header"><span>Main</span></div>
                <div class="print-section-content"><div>body</div></div>
              </div>
            </div>
          </div>
          <div id="print-enhance-shapes-layer">
            <div class="be-shape-layer-container" id="shapes-default"></div>
          </div>
          <div id="print-enhance-properties-panel"></div>
        </div>
      </body></html>`,
    );
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    window.LayerManager = window.LayerManager || LayerManager;
    window.eval(DND_JS);
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (cleanup) cleanup();
  });

  it("the seam is a single function on window, and a second registration is just a replacement", function () {
    assert.strictEqual(typeof window.beginMutation, "function", "window.beginMutation is the seam");
    assert.strictEqual(typeof window.pushMutation, "function", "window.pushMutation is the seam");
    // One implementation: layer 1 proved it statically; this proves the SEAM carries exactly one
    // (a second registration would be a plain overwrite, which is what the spy below uses).
    const before = window.pushMutation;
    window.pushMutation = () => {};
    assert.notStrictEqual(window.pushMutation, before, "the seam is a single assignable slot");
    window.pushMutation = before;
    assert.strictEqual(window.pushMutation, before, "restored");
  });

  it("no module aliases the seam into a local binding (the deferred-capture shape)", function () {
    // The review's §2 attack: a site that captures on first use —
    // `let bm; function f(){ if (!bm) bm = window.beginMutation; bm(…) }` — would satisfy a spy
    // if the capture happened after the spy was installed, and would silently keep working
    // against a stale reference otherwise. A call-time lookup cannot look like that, so the
    // absence of an ALIAS BINDING is asserted statically.
    //
    // The rule is deliberately narrow, because the product's own idiom is a CONDITIONAL CALL:
    // `const mut = window.beginMutation ? window.beginMutation(snap) : null;` — the same name
    // appears on both sides, and only the second is a call. So a line is an alias only when it
    // assigns `window.<name>` and the surrounding statement never calls that name.
    const offenders = [];
    // Two binding forms are covered: a direct assignment whose statement never calls the name, and
    // DESTRUCTURING out of `window` (`const { beginMutation } = window`) — the second is a
    // load-time capture by construction, so it needs no "is it also called?" test.
    const NAME = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=\s*window\.(beginMutation|pushMutation|captureUndo)\s*;?\s*$/;
    const DESTRUCTURED = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*window\s*;?/;
    const SHARED_NAMES = ["beginMutation", "pushMutation", "captureUndo"];
    for (const p of productSources()) {
      const src = fs.readFileSync(p, "utf8");
      const rows = src.split(/\r?\n/);
      for (let i = 0; i < rows.length; i += 1) {
        const d = DESTRUCTURED.exec(rows[i]);
        if (d) {
          for (const part of d[1].split(",")) {
            const bound = part.split(":")[0].trim();
            if (SHARED_NAMES.includes(bound)) {
              offenders.push(rel(p) + ":" + (i + 1) + " :: destructured {" + bound + "} from window");
            }
          }
        }
        const m = NAME.exec(rows[i]);
        if (!m) continue;
        // A CALL, not an alias: the product's own idiom is
        // `x = window.beginMutation ? window.beginMutation(snap) : null`, where the name appears
        // on both sides of the `?` and only the second occurrence is a call.
        const statement = rows.slice(i, i + 3).join("\n");
        if (new RegExp("window\\." + m[2] + "\\s*\\(").test(statement)) continue;
        offenders.push(rel(p) + ":" + (i + 1) + " :: " + m[1] + " = window." + m[2]);
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      "the seam was aliased into a local binding — that is the load-time (or first-use) capture " +
        "shape the runtime spy cannot always see:\n" + offenders.join("\n"),
    );
  });

  it("the RUNTIME half: two representative consumers pick the seam up at call time", async function () {
    // If the panel had captured `window.beginMutation`/`pushMutation` at module evaluation, this
    // spy — installed AFTER boot — would never be called, and its record would still be pushed
    // through the stale reference while the source looked perfectly compliant.
    const realBegin = window.beginMutation;
    const realPush = window.pushMutation;
    let began = 0;
    let pushed = 0;
    window.beginMutation = function () {
      began += 1;
      return realBegin.apply(this, arguments);
    };
    window.pushMutation = function () {
      pushed += 1;
      return realPush.apply(this, arguments);
    };
    try {
      const manager = window.LayerManager.getInstance
        ? window.LayerManager.getInstance()
        : new window.LayerManager();
      manager.show && manager.show();
      await waitFor(() => true, { timeout: 50 });
      // Drive a real class toggle through the panel's own entry point.
      const layer = manager.sectionsLayer;
      manager.toggleLayerVisibility(layer, null);
      await waitFor(() => pushed > 0, { timeout: 2000 });
    } finally {
      window.beginMutation = realBegin;
      window.pushMutation = realPush;
    }
    assert.ok(began > 0, "the LAYER PANEL resolved beginMutation at CALL time (spy saw it)");
    assert.ok(pushed > 0, "the LAYER PANEL resolved pushMutation at CALL time (spy saw it)");
  });

  it("a SHEET consumer (nudge, in js/dnd.js) picks the seam up at call time too", async function () {
    const realBegin = window.beginMutation;
    let began = 0;
    window.beginMutation = function () {
      began += 1;
      return realBegin.apply(this, arguments);
    };
    try {
      const wrapper = document.getElementById("wrapper-main");
      wrapper.classList.add("be-active-wrapper");
      assert.strictEqual(await window.nudgeActiveWrapper(4, 0), true, "the nudge moved it");
    } finally {
      window.beginMutation = realBegin;
    }
    assert.ok(began > 0, "js/dnd.js resolved beginMutation at CALL time (spy saw it)");
  });
});

describe("AC-2 layer 3 — the SURVIVING implementation repairs a settled capture", function () {
  this.timeout(20000);
  let window, document, cleanup, release;

  beforeEach(async function () {
    const b = boot(
      `<!DOCTYPE html><html><body>
        <div id="print-layout-wrapper">
          <div id="print-enhance-sections-layer">
            <div class="be-section-wrapper" id="wrapper-main" data-title="Main">
              <div class="print-section-container" id="section-main" style="width: 200px;">
                <div class="print-section-header"><span>Main</span></div>
                <div class="print-section-content"><div style="width: 200px;">body</div></div>
              </div>
            </div>
          </div>
          <div id="print-enhance-shapes-layer">
            <div class="be-shape-layer-container" id="shapes-default"></div>
          </div>
          <div id="print-enhance-properties-panel"></div>
        </div>
      </body></html>`,
    );
    window = b.window;
    document = b.document;
    cleanup = b.cleanup;
    await window.__DDBStorage.init();
    await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
    window.clearUndoStack();
  });

  afterEach(function () {
    if (release) release();
    if (cleanup) cleanup();
  });

  it("driven through the LIVE seam: a capture that settled after the mutation is repaired before it is pushed", async function () {
    // The runtime form of AC-1: this does not read a case file, it calls the seam the product
    // calls and inspects what the seam pushed.
    const section = document.getElementById("section-main");
    const real = window.__DDBStorage.getAllSpells;
    window.__DDBStorage.getAllSpells = function () {
      const self = this;
      return new Promise((resolve, reject) => {
        let n = 0;
        const step = () => {
          if (n++ < 3) return void setTimeout(step, 0);
          real.call(self).then(resolve, reject);
        };
        setTimeout(step, 0);
      });
    };
    release = () => {
      window.__DDBStorage.getAllSpells = real;
    };

    const pre = window.snapshotContainerGeometry(section);
    const mut = window.beginMutation(pre);
    section.style.width = "320px"; // the mutation, inside the capture's storage await
    await waitFor(() => mut.settled !== undefined, { timeout: 2000 });

    assert.strictEqual(
      mut.settled.sections["section-main"].width,
      "320px",
      "VACUITY GUARD: the settled capture really holds the POST-mutation value",
    );

    window.pushMutation(mut, 'Resize "section-main"', "resize", (layout, snap) => {
      window.patchCapturedFields(layout, "section-main", { width: snap.width });
    });

    assert.strictEqual(
      window.peekUndo().before.sections["section-main"].width,
      "200px",
      "the SURVIVING seam implementation repaired the settled capture before pushing it",
    );
  });

  it("and the adversarial suite is present, so the GESTURE-level version of this is gated too", function () {
    const suite = fs.readFileSync(path.join(ROOT, "test", "unit", "undo_stack_adversarial.test.js"), "utf8");
    // Each path's SHARED-protocol case is named `<path> class:`; rotate's GESTURE case is the
    // Phase 2 §3 one (the other three paths' gesture cases are unnamed by class).
    const shared = { rotate: "rotate class:", resize: "resize class:", nudge: "position class (nudge):", drag: "drag class:" };
    for (const [path_, marker] of Object.entries(shared)) {
      assert.ok(suite.includes(marker), `the adversarial suite still carries the ${path_} case (${marker})`);
    }
    assert.ok(
      /the real rotate gesture keeps the PRE-gesture angle/.test(suite),
      "the ROUTED rotate gesture case (AC-1's rotate arm) is still committed",
    );
    assert.ok(
      /VACUITY GUARD/.test(suite),
      "the suite's cases still assert their own adversarial timing",
    );
    assert.ok(/PATH GUARD/.test(suite), "the suite's cases still assert WHICH branch ran");
  });
});

describe("AC-2 layer 4 — no routed site introduced a NEW tag literal", function () {
  this.timeout(20000);

  // Site/file counts are stated in the title and asserted below, and BOTH moved when track
  // byok_ai_layout_20260915 Phase 4 added `js/ai_arrange.js:737` as a `position` push site: 22 -> 23
  // sites, 7 -> 8 files. That is the guard working, not a regression — the case's claim is about the
  // VOCABULARY (14 tags, no new one, none dead) and it still holds. A count edit like this must
  // therefore be made by the phase that adds a site, in the same commit, never by widening the
  // vocabulary or by dropping the assertion.
  it("every tag the inventory sees is one of the 14 recorded in Phase 0 (23 sites, 8 files)", function () {
    const inv = inventory();
    const recorded = [
      "asset",
      "border",
      "compact",
      "destructive",
      "drag",
      "layer-flag",
      "nudge",
      "position",
      "rename",
      "reparent",
      "resize",
      "restack",
      "rotate",
      "structural",
    ];
    const seen = Object.keys(inv.tags).sort();
    const novel = seen.filter((t) => !recorded.includes(t));
    assert.deepStrictEqual(
      novel,
      [],
      "the routing introduced a tag that is not in Phase 0's measured vocabulary: " + novel.join(", "),
    );
    assert.deepStrictEqual(
      recorded.filter((t) => !seen.includes(t)),
      [],
      "a recorded class lost its last site (a tag that no site pushes is a dead class)",
    );
    assert.strictEqual(inv.file_count, 8, "the vocabulary spans 8 files since Phase 4 of byok_ai_layout added a `position` site in js/ai_arrange.js");
    // The extractor's own blind spot, read rather than trusted: an unclassifiable call would
    // appear here. Phase 2 added none.
    const today = inv.unclassified_calls || [];
    // The helper internals that forward a `klass` they were given lived in js/persistence.js
    // until AC-4's split moved the protocol (and them) into js/undo.js; the forwarding wrapper
    // in js/main.js stayed put. Both are named here, so a NEW unclassified call still fails.
    assert.ok(
      today.every((c) => /js\/(undo|persistence|main)\.js/.test(c)),
      "the unclassified calls are still the helper internals that FORWARD a tag:\n" + today.join("\n"),
    );
    assert.strictEqual(inv.unbucketed_calls, 0, "the tool accounted for every call it scanned");
  });
});
