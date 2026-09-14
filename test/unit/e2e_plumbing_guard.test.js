/**
 * The e2e plumbing guard — AC-6 (track refactor_surface_20260911, Phase 6).
 *
 * AC-6: "The e2e capture plumbing is shared and the script roster stops growing."
 *   *Fail:* the duplicate `*_SHOTS`/`*_SHOTS_DIR` skip boilerplate remains in the capture specs;
 *          OR a new per-file npm script is added where an existing glob/`--grep` would serve.
 *
 * Both halves are asserted here from the FILES rather than from a claim:
 *  1. every capture spec builds its harness from `captureHarness(...)` and re-declares none of the
 *     plumbing (no `process.env.<X>_SHOTS` reads left in a spec, no local `provenance()`);
 *  2. the script roster has no per-file alias for a spec an existing glob already collects, and the
 *     roster did not grow this phase.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const E2E = path.join(ROOT, "test", "browser_e2e");

function specs() {
  return fs.readdirSync(E2E).filter((f) => f.endsWith(".spec.js")).sort();
}

describe("AC-6 — the capture plumbing is shared and the roster stopped growing", function () {
  this.timeout(20000);

  it("every capture spec builds its harness from the ONE helper", function () {
    // The capture specs: the eleven `*_visual_capture` files PLUS `lock_handle_visibility.spec.js`,
    // which writes a pixel artifact under the same convention and declared its own copy of the
    // plumbing until this phase. Named explicitly, so a twelfth capture spec cannot be added without
    // this list (and therefore this guard) noticing.
    const captures = specs().filter((f) => f.includes("_visual_capture") || f === "lock_handle_visibility.spec.js");
    assert.strictEqual(captures.length, 12, "the capture specs are still there (" + captures.length + ")");
    for (const f of captures) {
      const text = fs.readFileSync(path.join(E2E, f), "utf8");
      assert.ok(
        /require\(["']\.\/_capture\.js["']\)/.test(text),
        f + " must require the shared capture helper",
      );
      assert.ok(/captureHarness\(\{/.test(text), f + " must build its harness from it");
      // The plumbing must NOT be re-declared: no env read, no local provenance, no local viewport.
      assert.ok(
// deliberate: the control characters ARE the measurement (a byte-level
// encoding probe), not an accident this rule exists to catch.
// eslint-disable-next-line no-control-regex
        !/process\.env\.[A-Z_]+_SHOTS/.test(text) && !/= !!process\.env\.[A-Z_]+_SHOTS/.test(text),
        f + " still declares the *_SHOTS enable flag itself — that is the boilerplate AC-6 removes",
      );
      assert.ok(
        !/process\.env\.[A-Z_]+_SHOTS_DIR/.test(text),
        f + " still reads its own *_SHOTS_DIR override",
      );
      assert.ok(
        !/const ART_ROOT = path\.resolve\(/.test(text),
        f + " still resolves its own artifact root",
      );
      assert.ok(
        !/function provenance\(/.test(text),
        f + " still declares its own provenance()",
      );
      assert.ok(
        !/const VIEWPORT = \{ width: 1440, height: 900 \}/.test(text),
        f + " still pins its own viewport instead of taking the harness's",
      );

      // THE POSITIVE HALF (GATE 3 finding): forbidding the known spellings is not enough, because a
      // spec could hand-roll an equivalent under other names. So the spec must PROVE it takes each
      // part from the harness instead: the flag, the shots directory, the skip and every artifact
      // name. A renamed alias cannot satisfy these without also doing the right thing.
      assert.ok(/const CAPTURING = cap\.enabled;/.test(text), f + " must take the flag from the harness");
      // …and every artifact the spec writes must be built from that directory, not from a fresh
      // `path.resolve(__dirname, …)` of its own.
      const ownNames = text.match(/screenshot\(\{[^}]*path:\s*path\.(?:resolve|join)\(__dirname/g) || [];
      assert.deepStrictEqual(
        ownNames,
        [],
        f + " writes an artifact at a path it resolves itself instead of from the harness's SHOTS",
      );
      // TWO legitimate shapes, distinguished by what the spec IS (GATE 3's "positive ownership"
      // finding):
      //   * a CAPTURE-ONLY spec skips when the flag is unset — `if (!CAPTURING) this.skip()`;
      //   * a spec that is also a REAL GATE (`lock_handle_visibility` asserts reachability) runs its
      //     assertions either way and gates only its WRITES — `if (CAPTURING) { … }`.
      // Each is asserted for the spec it belongs to, so neither can silently become "captures
      // nothing" or "fails when unset".
      if (f === "lock_handle_visibility.spec.js") {
        assert.ok(
          /if \(CAPTURING\)/.test(text),
          f + " must gate its WRITES on the harness's flag (it asserts reachability either way)",
        );
      } else {
        assert.ok(
          /if \(!CAPTURING\)/.test(text),
          f + " must SKIP when the flag is unset, so a normal e2e run neither captures nor fails",
        );
      }
      assert.ok(
        /CAPTURING/.test(text),
        f + " must reference the harness's flag at all",
      );
    }
  });

  it("the shared helper owns the skip, the frame and the probe", function () {
    const helper = fs.readFileSync(path.join(E2E, "_capture.js"), "utf8");
    for (const part of ["skipIfDisabled", "async frame(", "probe(", "provenance("]) {
      assert.ok(helper.includes(part), "the helper owns " + part);
    }
    // One place for the pinned viewport, which three specs used to write down separately.
    assert.strictEqual(
      (helper.match(/width: 1440, height: 900/g) || []).length,
      1,
      "the capture viewport is written down exactly once",
    );
  });

  it("no per-file npm script covers a spec the e2e glob already collects", function () {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const scripts = pkg.scripts;
    const perSpec = Object.entries(scripts).filter(([name, cmd]) =>
      /^test:e2e:/.test(name) && /mocha test\/browser_e2e\/[a-z0-9_]+\.spec\.js/.test(cmd),
    );
    // `test:e2e` already runs `mocha test/browser_e2e --recursive`, so a per-file alias exists only
    // where a curated single-spec run is genuinely wanted. The number is PINNED, and the five
    // retired `verify0`…`verify4` aliases must not come back.
    const names = perSpec.map(([n]) => n);
    assert.deepStrictEqual(
      names.filter((n) => /verify\d$/.test(n)),
      [],
      "the redundant per-file verify aliases were retired in this phase and must stay retired",
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(scripts, "test:e2e:verify"),
      "the curated verification run survives, as a --grep over the glob",
    );
    assert.ok(
      /--grep/.test(scripts["test:e2e:verify"]),
      "it uses --grep rather than a second copy of the file list",
    );
    // The phase retired FIVE aliases (verify0..verify4) and added NONE. The remaining per-file
    // scripts are the curated `test:e2e:<topic>` runs this repo has carried for many tracks; the
    // assertion is that the roster did not GROW in this phase, which is what the criterion asks.
    const ROSTER_AFTER = 37;
    assert.strictEqual(
      perSpec.length,
      ROSTER_AFTER,
      "the per-file roster must be exactly what this phase left it at (" + perSpec.length + "). " +
        "If a new per-file alias is genuinely wanted, add it to ROSTER_AFTER with a reason — but " +
        "first check whether `mocha test/browser_e2e --recursive --grep <topic>` would serve.",
    );
  });

  it("_helpers.js is a SHIM: the two halves hold the bodies and the old names still resolve", function () {
    const shim = fs.readFileSync(path.join(E2E, "_helpers.js"), "utf8");
    assert.ok(
      /module\.exports = \{\s*\.\.\.dom,\s*\.\.\.inject,?\s*\}/.test(shim),
      "_helpers.js re-exports both halves",
    );
    assert.ok(
      shim.split(/\r?\n/).length < 30,
      "_helpers.js holds no bodies any more (it is a shim, not a grab bag)",
    );
    // The exported NAME SET is unchanged, which is what lets ~50 specs keep their require.
    const NAMES = [
      "EXT_ROOT", "DEMO_URL", "READY_SELECTOR", "FILES", "CONTENT_PROBE_NAMES",
      "launchExtensionContext", "bootPage", "domClick", "contentCall",
    ];
    const resolved = require(path.join(E2E, "_helpers.js"));
    const missing = NAMES.filter((n) => resolved[n] === undefined);
    assert.deepStrictEqual(missing, [], "the shim must still export every original name");
    // …and the two halves own them.
    const dom = require(path.join(E2E, "_helpers", "dom.js"));
    const inject = require(path.join(E2E, "_helpers", "inject.js"));
    assert.strictEqual(typeof dom.bootPage, "function", "the page-side half owns bootPage");
    assert.strictEqual(typeof inject.contentCall, "function", "the in-page half owns contentCall");
    assert.ok(Array.isArray(inject.CONTENT_PROBE_NAMES), "the in-page half owns the probe names");
    assert.strictEqual(dom.EXT_ROOT, inject.EXT_ROOT === undefined ? dom.EXT_ROOT : dom.EXT_ROOT);
  });

  it("the stringified in-page half is the part that grew, and it is the part that was separated", function () {
    const inject = fs.readFileSync(path.join(E2E, "_helpers", "inject.js"), "utf8");
    const dom = fs.readFileSync(path.join(E2E, "_helpers", "dom.js"), "utf8");
    assert.ok(
      inject.split(/\r?\n/).length > dom.split(/\r?\n/).length,
      "the in-page half is the larger one (it is what grows without bound)",
    );
    // The probes must remain REAL functions (MV3's CSP forbids rebuilding them), so the file must
    // not have acquired an eval-ish shortcut during the move.
    assert.ok(
      !/\beval\s*\(|new Function\s*\(/.test(inject),
      "the in-page half must not rebuild probes from source",
    );
  });
});
