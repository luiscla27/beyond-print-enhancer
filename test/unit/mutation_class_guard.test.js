/**
 * The mutation-class vocabulary guard — AC-3 (track refactor_surface_20260911, Phase 3).
 *
 * AC-3 has three fail conditions and this file asserts each of them directly:
 *
 *   "any tag literal exists outside the declaration"
 *        -> the vocabulary is READ BACK from the source (`MUTATION_CLASSES` in js/persistence.js)
 *           and the extractor is asked for every bare literal it can still see at a
 *           class-bearing call site. That bucket must be EMPTY, and the extractor's own report
 *           is where it would show up.
 *   "ignoring an arbitrary tag still yields a passing suite"
 *        -> pushed at RUNTIME: an undeclared tag must be REJECTED in test mode (thrown), and no
 *           suite may be able to record one.
 *   "the declared set no longer matches the tags the suite asserts per class"
 *        -> every declared class (except the declared `UNKNOWN`, which no site pushes) is
 *           asserted by at least one unit case, and every declared class is pushed by at least
 *           one real product site.
 *
 * WHY THE EXTRACTOR IS THE INPUT, not a copy of the list: the count was transcribed wrong TWICE
 * (11, then 13; measured 14) before `scripts/inventory_mutation_tags.py` existed, and both wrong
 * counts came from enumerating a word list instead of reading the call sites. So the assertion
 * compares the DECLARATION against the EXTRACTOR — if either drifts, this fails.
 */
const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { boot } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");

function inventory() {
  return JSON.parse(
    execFileSync(
      process.platform === "win32" ? "python" : "python3",
      ["scripts/inventory_mutation_tags.py", "--json"],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
}

/** The declaration, read from the product source (never re-typed here). */
function declaration() {
  // The declaration moved WITH the stack in Phase 4 (AC-4): js/undo.js is the module that owns
  // both, and this guard follows it — the extractor is pointed at the same file, so the
  // declaration-vs-extractor comparison stays meaningful.
  const src = fs.readFileSync(path.join(ROOT, "js", "undo.js"), "utf8");
  const block = /const\s+MUTATION_CLASSES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(src);
  assert.ok(block, "the ONE declaration exists in js/undo.js");
  const map = {};
  for (const m of block[1].matchAll(/([A-Z][A-Z0-9_]*)\s*:\s*"([a-z][a-z0-9-]*)"/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

const DECLARED = declaration();
/** Every declared class a SITE is expected to push; `UNKNOWN` is the declared no-class value. */
const PUSHED_BY_A_SITE = Object.keys(DECLARED).filter((k) => k !== "UNKNOWN");

describe("AC-3 — the vocabulary is declared once and no bare literal survives", function () {
  this.timeout(30000);

  it("the declaration and the extractor agree, tag for tag", function () {
    const inv = inventory();
    assert.ok(inv.declaration_file, "the extractor names the file it read the declaration from");
    const declaredTags = Object.values(DECLARED).sort();
    const extractedTags = Object.keys(inv.tags).sort();
    assert.deepStrictEqual(
      extractedTags,
      declaredTags.filter((t) => t !== DECLARED.UNKNOWN),
      "the tags the SITES actually push must be exactly the declared classes minus the no-class " +
        "value; a difference means a class was declared but never pushed, or pushed but never " +
        "declared",
    );
    assert.deepStrictEqual(
      Object.values(inv.declaration).sort(),
      declaredTags,
      "the extractor parsed the same declaration this guard read (if these disagree, one of them " +
        "is reading a different map)",
    );
  });

  it("NO bare tag literal remains at any class-bearing call site", function () {
    const inv = inventory();
    assert.deepStrictEqual(
      inv.bare_literal_tags,
      {},
      "AC-3's first fail condition: a tag written as a literal instead of a reference to the " +
        "declaration.\n" + JSON.stringify(inv.bare_literal_tags, null, 2),
    );
    assert.deepStrictEqual(
      inv.unknown_references,
      {},
      "a site references a declaration KEY the map does not contain (a typo in the key, or a " +
        "class removed from the map without its site):\n" +
        JSON.stringify(inv.unknown_references, null, 2),
    );
  });

  it("every declared class is pushed by at least one real product site", function () {
    const inv = inventory();
    const missing = PUSHED_BY_A_SITE.filter(
      (key) => !inv.tags[DECLARED[key]] || inv.tags[DECLARED[key]].length === 0,
    );
    assert.deepStrictEqual(
      missing,
      [],
      "a declared class that no site pushes is a dead entry in the vocabulary: " + missing.join(", "),
    );
    for (const [tag, where] of Object.entries(inv.tags)) {
      for (const site of where) {
        assert.ok(
          /^js\//.test(site),
          "a tag site must be product source: " + site + " (" + tag + ")",
        );
      }
    }
  });

  it("every declared class is asserted per class by a unit case (the vocabulary the suite knows)", function () {
    const dir = path.join(ROOT, "test", "unit");
    const asserted = new Set();
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".test.js")) continue;
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      for (const m of text.matchAll(/\.class,\s*"([a-z][a-z0-9-]*)"/g)) asserted.add(m[1]);
      for (const m of text.matchAll(/class:\s*"([a-z][a-z0-9-]*)"/g)) asserted.add(m[1]);
    }
    const missing = PUSHED_BY_A_SITE.map((k) => DECLARED[k]).filter((t) => !asserted.has(t));
    assert.deepStrictEqual(
      missing,
      [],
      "AC-3's third fail condition: a declared class that no case asserts — either the class is " +
        "not really exercised, or the case covers it under a different name: " + missing.join(", "),
    );
  });

  it("a tag that is not in the declaration is REJECTED, not silently defaulted", async function () {
    // The runtime half of AC-3's second fail condition. Driven through the REAL seam, so this is
    // about `pushUndo`'s behaviour and not about a helper the guard calls directly.
    const b = boot();
    const { window } = b;
    try {
      await window.__DDBStorage.init();
      await window.__DDBStorage.saveGlobalLayout({ version: "1.5.0", sections: {} });
      window.clearUndoStack();
      const live = await window.captureLiveLayout();
      assert.ok(live, "the harness can capture a layout");

      // (a) a declared class is accepted.
      window.pushUndo(live, "declared", window.MUTATION_CLASSES.ROTATE);
      assert.strictEqual(window.peekUndo().class, "rotate", "a declared class is recorded as-is");

      // (b) an UNDECLARED tag is rejected loudly in test mode.
      assert.throws(
        () => window.pushUndo(live, "undeclared", "invented-class"),
        /Undeclared mutation class/,
        "an undeclared tag must THROW in test mode — a suite that could record one is exactly the " +
          "silent-miss AC-3 forbids",
      );
      assert.strictEqual(
        window.undoDepth(),
        1,
        "and the rejected push left no record behind (the throw happens before the push)",
      );

      // (c) the declared no-class value is what an ABSENT tag resolves to — declared, not a
      //     literal default hidden in an expression.
      window.pushUndo(live, "no class at all");
      assert.strictEqual(
        window.peekUndo().class,
        window.MUTATION_CLASSES.UNKNOWN,
        "an absent tag resolves to the DECLARED no-class value",
      );
      assert.strictEqual(
        window.MUTATION_CLASSES.UNKNOWN,
        "unknown",
        "and that value is the one the vocabulary declares",
      );
    } finally {
      b.cleanup();
    }
  });

  it("the declaration is FROZEN, and the window seam is the same object", function () {
    const b = boot();
    const { window } = b;
    try {
      assert.ok(Object.isFrozen(window.MUTATION_CLASSES), "the declaration is frozen");
      // The VALUES list is internal (no seam of its own — the dead-export re-rot guard deletes a
      // seam with no reader), so the guard derives it, which is also what makes this assertion about
      // the MAP rather than about a second copy of the list.
      // CROSS-REALM: the array `Object.values` returns here is allocated by the jsdom realm, so its
      // prototype is that realm's `Array.prototype` and a direct `deepStrictEqual` against a
      // Node-realm array fails on the prototype ALONE. `Array.from` (Node's) makes this an assertion
      // about the values rather than about which realm allocated the container.
      assert.deepStrictEqual(
        Array.from(Object.values(window.MUTATION_CLASSES)),
        Object.values(DECLARED),
        "the map's values are the declaration's own values, in declaration order",
      );
      // A frozen map is what makes "declared once" enforceable rather than aspirational: a later
      // assignment cannot quietly add a class.
      assert.throws(
        () => {
          "use strict";
          window.MUTATION_CLASSES.INVENTED = "invented";
        },
        TypeError,
        "adding a class at runtime is refused",
      );
    } finally {
      b.cleanup();
    }
  });
});

describe("AC-3 hardening (GATE 3 recommendation) — indirect class arguments and the anchor", function () {
  this.timeout(30000);

  it("the ONLY calls whose class is not resolvable statically are the recorded forwarding helpers", function () {
    // The gap the Phase 3 GATE 3 review named: a call could pass a VARIABLE
    // (`pushUndo(live, "x", someVar)`) — neither a bare literal (bucket 1) nor a reference (bucket
    // 2) — and slip past both static buckets, with the runtime throw only firing if that site
    // happens to be exercised. The extractor already reports such calls as UNCLASSIFIED; this
    // asserts the set is EXACTLY the known forwards, so a NEW indirect site fails here instead of
    // being invisible. `klass` in the arguments is the forwarding parameter, and each entry is
    // pinned by file:line so a moved helper is visible too.
    const inv = inventory();
    // The protocol's own internals moved to js/undo.js in Phase 4 (AC-4); the forwarding
    // wrapper in js/main.js stayed. The SET is unchanged, so a new indirect site still fails.
    const RECORDED = [
      "js/main.js (captureUndo) args: label, klass",
      "js/undo.js (pushUndo) args: before, label, klass",
      "js/undo.js (pushUndo) args: mut.settled, label, klass",
      "js/undo.js (pushUndo) args: layout, label, klass",
    ];
    const normalised = inv.unclassified_calls.map((e) => e.replace(/^([^ ]+):\d+/, "$1"));
    assert.deepStrictEqual(
      normalised.sort(),
      RECORDED.slice().sort(),
      "an UNCLASSIFIED tag-bearing call is one whose class this tool cannot see. If a NEW one " +
        "appears, a site is passing its class indirectly — one declaration is no longer referenced " +
        "by every push site:\n" + inv.unclassified_calls.join("\n"),
    );
    for (const entry of inv.unclassified_calls) {
      assert.ok(
        /klass/.test(entry),
        "every indirect call must be a helper FORWARDING a `klass` parameter: " + entry,
      );
    }
  });

  it("the per-class expectations in the suite are LITERAL, not derived from the declaration", function () {
    // The review's second recommendation: the declaration ≡ extractor assertion is satisfied by
    // construction, so the guard needs an EXTERNAL anchor. The per-class unit assertions ARE that
    // anchor — but only while they spell the class out. If a case ever wrote
    // `assert.strictEqual(top.class, window.MUTATION_CLASSES.ROTATE)`, the expectation would be
    // derived from the thing under test and the anchor would be gone.
    const dir = path.join(ROOT, "test", "unit");
    const derived = [];
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".test.js")) continue;
      // This file necessarily CONTAINS the pattern (it is the thing being searched for), so it is
      // excluded by name — the assertion is about the suites that assert classes, not about the
      // guard that reads them.
      if (name === "mutation_class_guard.test.js") continue;
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      for (const m of text.matchAll(/\.class,\s*window\.MUTATION_CLASSES/g)) {
        derived.push(name + " :: " + m[0]);
      }
    }
    assert.deepStrictEqual(
      derived,
      [],
      "a per-class expectation was derived from the declaration, which destroys the external " +
        "anchor the declaration-vs-extractor check relies on:\n" + derived.join("\n"),
    );
  });

  it("the resolver can only ever yield a DECLARED class (or throw) — driven through the real seam", function () {
    // The runtime half of the hardening: whatever a site passes, a record can only carry a declared
    // value. This is asserted over a spread of input SHAPES, so "membership by construction" is
    // measured rather than argued.
    const b = boot();
    const { window } = b;
    try {
      assert.ok(window.MUTATION_CLASSES, "the declaration is on the window");
      const declared = new Set(Object.values(window.MUTATION_CLASSES));
      const cases = [
        ["declared", window.MUTATION_CLASSES.ROTATE],
        ["absent", undefined],
        ["null", null],
        ["empty", ""],
      ];
      for (const [name, klass] of cases) {
        window.pushUndo({ sections: {} }, "probe " + name, klass);
        const got = window.peekUndo().class;
        assert.ok(
          declared.has(got),
          name + ": a record's class must be a DECLARED member, got " + JSON.stringify(got),
        );
      }
      for (const [name, klass] of [
        ["typo", "rotat"],
        ["other-type", 7],
        ["object", {}],
      ]) {
        assert.throws(
          () => window.pushUndo({ sections: {} }, "probe " + name, klass),
          /Undeclared mutation class/,
          name + ": a non-declared class must be refused in test mode",
        );
      }
    } finally {
      b.cleanup();
    }
  });
});
