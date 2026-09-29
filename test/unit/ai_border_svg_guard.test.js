/**
 * AC-9 / AC-9b(ii) — the BLOCKING border-SVG injection guard
 * (track `byok_svg_borders_20260927`, Phase 2, sub-step 2.3).
 *
 * WHAT THIS SUITE EXISTS TO PREVENT
 * ---------------------------------
 * A guard that only ever runs over the clean tree proves that the tree is clean TODAY.
 * AC-9's claim is stronger and it is a claim about the BUILD: "a bypass fails the
 * build/lint, never an advisory note". Two properties have to hold, and they are
 * independent:
 *
 *  1. the guard is CORRECT — it fails on a crafted direct-injection fixture, per rule;
 *  2. the guard is WIRED — it runs inside the `lint`/`pretest` chain, so `npm test`
 *     cannot be green while a bypass exists.
 *
 * (1) is tested here by handing `checkSources()` hand-written source maps that inject
 * each falsification vector rather than by editing the repo (which the concurrent
 * suite would see). (2) is tested by reading `package.json` — an unwired guard is the
 * "green while broken" failure this case exists to make impossible.
 *
 * The last case is the anti-vacuity control AC-6 of the original track established:
 * re-inject a direct assignment, assert FAIL, and assert the CLEAN tree PASSES in the
 * same run, so a guard stuck on `return []` cannot read as green.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  checkSources,
  check,
  readProductSources,
  CHOKE_POINT,
  OVERLAY_CLASS,
} = require("../../scripts/check_border_svg_injection.js");

const ROOT = path.resolve(__dirname, "..", "..");

/** A minimal, rule-satisfying choke point, so each fixture can vary exactly one thing. */
const GOOD_CHOKE = `
function renderBorderSvg(section, rawSvg) {
  const v = sanitizeSvg(rawSvg);
  if (!v.ok) return { ok: false, error: v.error };
  const overlay = document.createElement("div");
  overlay.className = "${OVERLAY_CLASS}";
  overlay.innerHTML = v.sanitized;
  section.appendChild(overlay);
  return { ok: true, sanitized: v.sanitized };
}
`;

/** A clean 2-file world: the choke point + a print-styles CSS consumer. */
function cleanWorld(extra = {}) {
  return {
    [CHOKE_POINT]: GOOD_CHOKE,
    "js/print_styles.js": `.${OVERLAY_CLASS} { position: absolute; z-index: -1; }\n`,
    ...extra,
  };
}

function rules(findings) {
  return findings.map((f) => f.rule);
}

describe("AC-9b(ii) — border-SVG injection guard is blocking and falsifiable", function () {
  it("passes on a clean world", function () {
    const { findings } = checkSources(cleanWorld());
    assert.deepStrictEqual(rules(findings), [], JSON.stringify(findings, null, 2));
  });

  it("R1 FAILS when the choke point is missing (no vacuous pass)", function () {
    const sources = cleanWorld();
    delete sources[CHOKE_POINT];
    const { findings } = checkSources(sources);
    assert.ok(rules(findings).includes("R1"), "a missing choke point must be a finding");
  });

  it("R1 FAILS when the choke point exports no renderBorderSvg", function () {
    const sources = cleanWorld({
      [CHOKE_POINT]: `function somethingElse(s, raw) { return raw; }\n`,
    });
    assert.ok(rules(checkSources(sources).findings).includes("R1"));
  });

  it("R2 FAILS when the choke point never calls the AC-1 trust root", function () {
    const sources = cleanWorld({
      [CHOKE_POINT]: `
function renderBorderSvg(section, rawSvg) {
  const overlay = document.createElement("div");
  overlay.className = "${OVERLAY_CLASS}";
  overlay.innerHTML = rawSvg;
  section.appendChild(overlay);
}
`,
    });
    const found = rules(checkSources(sources).findings);
    assert.ok(found.includes("R2"), `expected R2, got ${found.join(",")}`);
  });

  it("R2 FAILS when the choke point injects a caller-supplied string", function () {
    // It DOES call the validator — but injects the raw argument anyway. This is the
    // exact `inject-if-caller-says-clean` shape AC-9b(i) names.
    const sources = cleanWorld({
      [CHOKE_POINT]: `
function renderBorderSvg(section, rawSvg) {
  const v = window.AiLayout.validateSvg(rawSvg);
  if (!v.ok) return { ok: false, error: v.error };
  const overlay = document.createElement("div");
  overlay.className = "${OVERLAY_CLASS}";
  overlay.innerHTML = rawSvg;
  section.appendChild(overlay);
}
`,
    });
    assert.ok(
      rules(checkSources(sources).findings).includes("R2"),
      "injecting the raw argument while the validator exists must fail R2",
    );
  });

  it("R3 FAILS on a second file doing innerHTML with an SVG source", function () {
    const sources = cleanWorld({
      "js/layout_apply.js": `
function applyBorder(section, borderSvg) {
  section.innerHTML = borderSvg;
}
`,
    });
    const found = rules(checkSources(sources).findings);
    assert.ok(found.includes("R3"), `expected R3, got ${found.join(",")}`);
  });

  it("R3 FAILS on insertAdjacentHTML and on document.write too", function () {
    for (const line of [
      `  el.insertAdjacentHTML("beforeend", borderSvg);`,
      `  document.write(borderSvg);`,
    ]) {
      const sources = cleanWorld({ "js/main.js": `function x(borderSvg) {\n${line}\n}\n` });
      assert.ok(
        rules(checkSources(sources).findings).includes("R3"),
        `R3 must fire on: ${line.trim()}`,
      );
    }
  });

  it("R4 FAILS on a data:/url( payload fed to a CSS image sink", function () {
    const sources = cleanWorld({
      "js/layout_apply.js": `
function paint(el, borderSvg) {
  el.style.backgroundImage = "url(" + borderSvg + ")";
}
`,
    });
    const found = rules(checkSources(sources).findings);
    assert.ok(found.includes("R4"), `expected R4, got ${found.join(",")}`);
  });

  it("R5 FAILS when a third file mentions the overlay node class", function () {
    const sources = cleanWorld({
      "js/main.js": `const CLS = "${OVERLAY_CLASS}";\n`,
    });
    const found = rules(checkSources(sources).findings);
    assert.ok(found.includes("R5"), `expected R5, got ${found.join(",")}`);
  });

  it("comments quoting the banned patterns do not trip the guard", function () {
    const sources = cleanWorld({
      "js/main.js": `/**
 * Never do this: el.innerHTML = borderSvg;  // nor document.write(borderSvg)
 * and never style.backgroundImage = "url(" + borderSvg + ")".
 * The overlay class is ${OVERLAY_CLASS}.
 */
function safe() { return 1; }
`,
    });
    const { findings } = checkSources(sources);
    assert.deepStrictEqual(rules(findings), [], JSON.stringify(findings, null, 2));
  });

  it("the guard is WIRED INTO the build, not an advisory", function () {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const chain = [pkg.scripts.lint, pkg.scripts.test, pkg.scripts.pretest]
      .filter(Boolean)
      .join(" ");
    assert.ok(
      /check_border_svg_injection/.test(chain),
      `the guard must appear in the lint/pretest chain; chain was: ${chain}`,
    );
  });

  it("the real tree is CLEAN, and re-injecting a bypass makes it FAIL", function () {
    // (a) the shipped tree passes
    const real = check();
    assert.deepStrictEqual(
      rules(real.findings),
      [],
      JSON.stringify(real.findings, null, 2),
    );
    assert.ok(real.checked.length > 0, "the guard must actually scan something");

    // (b) the SAME guard, on the real tree plus one injected bypass, fails
    const poisoned = { ...readProductSources(ROOT) };
    poisoned["js/undo.js"] =
      (poisoned["js/undo.js"] || "") +
      `\nfunction _legacyInject(el, borderSvg) { el.innerHTML = borderSvg; }\n`;
    const after = checkSources(poisoned);
    assert.ok(
      rules(after.findings).includes("R3"),
      "an injected legacy direct-injection path must FAIL the guard",
    );
  });
});
