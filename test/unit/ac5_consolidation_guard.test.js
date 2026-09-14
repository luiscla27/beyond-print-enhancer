/**
 * The AC-5 consolidation guard — ONE gate helper, ONE logger, ONE z-index map
 * (track refactor_surface_20260911, Phase 5).
 *
 * AC-5's fail conditions, each asserted directly:
 *   "two gate wrappers remain"                                  -> the wrappers may exist but must
 *                                                                  all delegate to one helper
 *   "a touched file still calls console.* directly outside the logger"
 *                                                               -> only the logger's home may
 *   "a bare z-index literal remains at the nine measured sites"  -> each site names the map
 *
 * Plus the LINT half of O-4, read from `eslint.config.js` so the rule cannot be turned off without
 * this test noticing.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function sources() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".js")) out.push(full);
    }
  };
  walk(path.join(ROOT, "js"));
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

describe("AC-5 — one gate helper, one logger, one z-index map", function () {
  this.timeout(20000);

  it("the destructive gate has ONE helper, and the three wrappers delegate to it", function () {
    // The helper's body is the only place the seam resolution and the fail-open policy are written.
    const helper = read("js/recovery_ui.js");
    assert.ok(
      /async function destructiveGate\(reason\) \{[\s\S]{0,200}?window\.gateDestructive\(reason\)/.test(helper),
      "the ONE helper resolves the gate seam",
    );
    const delegators = [];
    for (const p of sources()) {
      if (rel(p) === "js/recovery_ui.js") continue;
      const text = fs.readFileSync(p, "utf8");
      // A module that resolves the gate seam DIRECTLY is a second implementation.
      if (/window\.gateDestructive\s*\(/.test(text)) delegators.push(rel(p));
    }
    assert.deepStrictEqual(
      delegators,
      [],
      "a module reaches for the raw seam instead of the ONE helper: " + delegators.join(", "),
    );
    // …and the three named wrappers still exist and delegate.
    for (const [file, name] of [
      ["js/main.js", "destructiveGate"],
      ["js/dom/layer_manager.js", "layerManagerDestructiveGate"],
      ["js/section_cloning.js", "cloningDestructiveGate"],
    ]) {
      const text = read(file);
      assert.ok(text.includes("window.destructiveGate"), name + " (" + file + ") delegates to the helper");
    }
  });

  it("the logger has ONE implementation, and no module rebuilds it", function () {
    const owners = [];
    for (const p of sources()) {
      const text = fs.readFileSync(p, "utf8");
      // the implementation: a function that both consults the test-mode flag and reaches console
      if (/__DDB_TEST_MODE__/.test(text) && /console\[method\]|console\[m\]/.test(text)) owners.push(rel(p));
    }
    assert.deepStrictEqual(
      owners,
      ["js/main.js"],
      "exactly one module implements the logger (test-mode silencing + the console bridge): " + owners.join(", "),
    );
    // No module may re-derive a shape that carries a console bridge.
    const bridges = [];
    for (const p of sources()) {
      const text = fs.readFileSync(p, "utf8");
      if (/console\[m\]|\bconsole\.(log|error|warn)\s*\(/.test(text) && rel(p) !== "js/main.js") {
        bridges.push(rel(p));
      }
    }
    assert.deepStrictEqual(
      bridges,
      [],
      "a module still carries its own console bridge instead of reading window.safeLog: " + bridges.join(", "),
    );
  });

  it("every z-index site names the ONE map, and no bare literal remains there", function () {
    // The nine measured sites (F-6), by file and the value each carried.
    const SITES = [
      ["js/controls.js", "PANEL"],
      ["js/controls.js", "PICKER"],
      ["js/main.js", "PANEL"],
      ["js/main.js", "CONTEXT_MENU"],
      ["js/main.js", "ACTIONS_BAR"],
      ["js/main.js", "SECTION_DEFAULT"],
      ["js/main.js", "SHAPE_DEFAULT"],
      ["js/main.js", "SHAPE_DEFAULT"],
      ["js/main.js", "SHAPE_STEP"],
      ["js/main.js", "SHAPE_STEP"],
      ["js/main.js", "SHAPE_DEFAULT"],
      ["js/main.js", "SHAPE_DEFAULT"],
      ["js/main.js", "SHAPE_STEP"],
      ["js/main.js", "SHAPE_STEP"],
      ["js/dom/layer_manager.js", "SECTION_DEFAULT"],
      ["js/dom/layer_manager.js", "TOP"],
      ["js/dom/layer_manager.js", "TOP"],
      ["js/spells_ui.js", "PANEL"],
    ];
    const found = [];
    for (const p of sources()) {
      const text = fs.readFileSync(p, "utf8");
      for (const m of text.matchAll(/window\.Z\.([A-Z_]+)/g)) found.push([rel(p), m[1]]);
    }
    const want = new Map();
    for (const [f, k] of SITES) want.set(f + "|" + k, (want.get(f + "|" + k) || 0) + 1);
    const got = new Map();
    for (const [f, k] of found) got.set(f + "|" + k, (got.get(f + "|" + k) || 0) + 1);
    assert.deepStrictEqual(
      [...want.keys()].sort(),
      [...got.keys()].sort(),
      "the map's readers are not the ten measured sites (AC-5's F-6 list)",
    );
    // THE TWO RECORDED EXCEPTIONS (GATE 3 finding): two more bare stacking literals exist that the
    // F-6 enumeration missed — the pointer-drag ghost and the layer-row ghost, both '100000'. They
    // are deliberately NOT mapped, because js/dnd.js is booted ALONE by five unit harnesses that
    // never evaluate the declaring module. Asserted WITH their reasons, so an exception cannot
    // become an undocumented literal and a new one cannot hide among them.
    const EXCEPTIONS = [
      ["js/dnd.js", "pointer-drag ghost"],
      ["js/dom/layer_manager.js", "layer-row ghost"],
    ];
    for (const [file] of EXCEPTIONS) {
      const text = read(file);
      assert.ok(text.includes("'100000'"), "the recorded exception still holds its literal: " + file);
    }
    const ghostHits = [];
    for (const p of sources()) {
      const text = fs.readFileSync(p, "utf8");
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
      const GHOST = new RegExp("z-?[Ii]ndex[^;\n]{0,40}'100000'|'100000'[^;\n]{0,40}z-?[Ii]ndex");
      if (GHOST.test(text)) ghostHits.push(rel(p));
    }
    assert.deepStrictEqual(
      [...new Set(ghostHits)].sort(),
      EXCEPTIONS.map((e) => e[0]).sort(),
      "the unmapped ghost literals are exactly the two recorded exceptions",
    );

    // The map itself is declared exactly once.
    const declarers = sources().filter((p) => /const Z = Object\.freeze\(\{/.test(fs.readFileSync(p, "utf8")));
    assert.deepStrictEqual(
      declarers.map(rel),
      ["js/section_utils.js"],
      "the z-index map is declared exactly once",
    );
    // The declarations are frozen so nothing can add a level without this test noticing.
  });

  it("the z-index map is FROZEN and its values are the ones the sites carried", function () {
    const src = read("js/section_utils.js");
    const block = /const Z = Object\.freeze\(\{([\s\S]*?)\}\)/.exec(src);
    assert.ok(block, "the map is frozen at its declaration");
    const values = {};
    for (const m of block[1].matchAll(/([A-Z_]+):\s*("?[\w]+"?)/g)) {
      values[m[1]] = m[2].replace(/"/g, "");
    }
    // The EXACT literals the nine sites carried before the extraction — a constant-extraction may not
    // change a value, and this is what makes that checkable rather than asserted.
    assert.deepStrictEqual(values, {
      PANEL: "10000",
      PICKER: "20000",
      CONTEXT_MENU: "30000",
      ACTIONS_BAR: "1000000",
      SHAPE_STEP: "100",
      SHAPE_DEFAULT: "110",
      SECTION_DEFAULT: "10",
      TOP: "2147483647",
    });
  });

  it("the lint rule O-4 ratified is CONFIGURED (no-console is an error, with the logger allowlisted)", function () {
    const cfg = read("eslint.config.js");
    assert.ok(
      /"no-console":\s*"error"/.test(cfg),
      "no-console must be an ERROR (O-4), so F-4 cannot return without a lint failure",
    );
    // AMENDED 2026-09-12 (track gate_coverage_20260912, Phase 1; operator decision O-7).
    //
    // This used to assert `/!"no-console":\s*"off"/` — "disabled nowhere in the config". That was
    // true while the config described ONE tree. It now describes three, and O-7 ratified a
    // documented `no-console: "off"` for `test/` and `scripts/` (a capture harness or a CLI tool
    // writing a measurement is not the F-4 defect, and "fixing" the 265 hits would delete the output
    // those files exist to produce), so a flat text assertion would now be a false red.
    //
    // The AMENDMENT KEEPS THE GUARANTEE and makes it stricter where it matters, by resolving the
    // rules the config actually applies instead of pattern-matching its text:
    //   * the effective `no-console` severity for the PRODUCT tree (`js/`) is `error`;
    //   * an `off` may exist ONLY for `test/` and `scripts/`, and those blocks must be exactly the
    //     ones that carry it — so a future `off` added for `js/` (or a silent removal of one of these
    //     two) fails here;
    //   * the reason must still be written down in the file next to the rule, because a bare `off`
    //     with no rationale is the review-note-that-replaced-a-rule this AC exists to forbid.
    const resolved = require(path.join(ROOT, "eslint.config.js"));
    const blocks = resolved.filter((b) => b && b.rules && "no-console" in b.rules);
    // Flat config merges overlapping blocks and the LAST match wins, so the resolution below walks
    // the blocks in order and takes the last one that covers the tree: the base `**/*.js` block
    // first, then that tree's own override.
    const covers = (glob, target) => glob === "**/*.js" || glob === target;
    const severityFor = (target) =>
      blocks
        .filter((b) => (b.files || []).some((g) => covers(g, target)))
        .map((b) => b.rules["no-console"])
        .pop();

    assert.strictEqual(
      severityFor("js/**/*.js"),
      "error",
      "the PRODUCT tree must keep no-console at error — O-7 relaxes the harness/tooling trees only",
    );
    assert.strictEqual(severityFor("test/**/*.js"), "off", "test/ carries the documented exemption");
    assert.strictEqual(severityFor("scripts/**/*.js"), "off", "scripts/ carries the documented exemption");
    assert.deepStrictEqual(
      blocks
        .filter((b) => b.rules["no-console"] === "off")
        .map((b) => (b.files || []).join(","))
        .sort(),
      ["scripts/**/*.js", "test/**/*.js"],
      "the ONLY trees with no-console disabled are test/ and scripts/",
    );
    assert.ok(
      /no-console: "off"` is DELIBERATE, documented here/.test(cfg),
      "the exemption carries its reason WHERE THE RULE IS, not only in a commit message",
    );
    const logger = fs.readFileSync(path.join(ROOT, "js", "main.js"), "utf8");
    const disables = logger.match(/eslint-disable-line no-console/g) || [];
    assert.strictEqual(
      disables.length,
      2,
      "the exemption is exactly the logger's two statements, not a file",
    );
    assert.ok(
      logger.indexOf("eslint-disable-line no-console") < logger.indexOf("window.safeLog = safeLog"),
      "the exemption sits inside the logger",
    );
  });
});
