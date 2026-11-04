/**
 * AC-9 / AC-9b(ii) — the BLOCKING border-SVG injection guard
 * (track `byok_svg_borders_20260927`, Phase 2, sub-step 2.3; RULES REWRITTEN under
 * operator decision D4 — the AI border rides the product's own `::before`
 * `border-image` slot, so the choke point PAINTS a CSS custom property instead of
 * injecting markup).
 *
 * WHAT THIS SUITE EXISTS TO PREVENT
 * ---------------------------------
 * A guard that only ever runs over the clean tree proves that the tree is clean TODAY.
 * AC-9's claim is stronger and it is a claim about the BUILD: "a bypass fails the
 * build/lint, never an advisory note". Two properties have to hold, and they are
 * independent:
 *
 *  1. the guard is CORRECT — it fails on a crafted bypass fixture, per rule;
 *  2. the guard is WIRED — it runs inside the `lint`/`pretest` chain, so `npm test`
 *     cannot be green while a bypass exists.
 *
 * (1) is tested here by handing `checkSources()` hand-written source maps that inject
 * each falsification vector rather than by editing the repo (which the concurrent
 * suite would see). (2) is tested by reading `package.json` — an unwired guard is the
 * "green while broken" failure this case exists to make impossible.
 *
 * The last case is the anti-vacuity control: the CLEAN tree passes AND re-injecting a
 * bypass makes the SAME guard fail, so a guard stuck on `return []` cannot read as
 * green.
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

/**
 * A minimal, rule-satisfying choke point for the D4 shape: the border is PAINTED as a
 * `data:` URI in the `--border-img` custom property, built only from the trust root's
 * output. The value passes `encodeURIComponent` exactly as the product does, so the
 * fixture mirrors the shipped call rather than approximating it.
 */
const GOOD_CHOKE = `
function renderBorderSvg(section, rawSvg) {
  const v = sanitizeSvg(rawSvg);
  if (!v.ok) return { ok: false, error: v.error };
  section.style.setProperty("--border-img", "url(\\"data:image/svg+xml;utf8," + encodeURIComponent(v.sanitized) + "\\")");
  section.dataset.borderRawSvg = v.sanitized;
  return { ok: true, sanitized: v.sanitized };
}
`;

/** A clean 2-file world: the choke point + a CSS consumer that never names the retired literal. */
function cleanWorld(extra = {}) {
  return {
    [CHOKE_POINT]: GOOD_CHOKE,
    "js/print_styles.js": ".print-section-container::before { border-image-source: var(--border-img); }\n",
    ...extra,
  };
}

function rules(findings) {
  return findings.map((f) => f.rule);
}

describe("AC-9b(ii) — border-SVG injection guard is blocking and falsifiable (D4 rules)", function () {
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
  section.style.setProperty("--border-img", rawSvg);
}
`,
    });
    const found = rules(checkSources(sources).findings);
    assert.ok(found.includes("R2"), `expected R2, got ${found.join(",")}`);
  });

  it("R2 FAILS when the choke point injects markup (innerHTML is a second render surface)", function () {
    // The exact shape D4 exists to forbid: the choke point calling the validator but
    // still injecting markup. Under D4 the border never becomes DOM markup at all.
    const sources = cleanWorld({
      [CHOKE_POINT]: `
function renderBorderSvg(section, rawSvg) {
  const v = window.AiLayout.validateSvg(rawSvg);
  if (!v.ok) return { ok: false, error: v.error };
  section.innerHTML = v.sanitized;
}
`,
    });
    assert.ok(
      rules(checkSources(sources).findings).includes("R2"),
      "an innerHTML in the choke point must fail R2 under D4",
    );
  });

  it("R2 FAILS when the choke point paints from a caller-supplied string", function () {
    // It DOES call the validator — but paints the raw argument anyway. This is the
    // exact `inject-if-caller-says-clean` shape AC-9b(i) names, in its D4 spelling.
    const sources = cleanWorld({
      [CHOKE_POINT]: `
function renderBorderSvg(section, rawSvg) {
  const v = window.AiLayout.validateSvg(rawSvg);
  if (!v.ok) return { ok: false, error: v.error };
  section.style.setProperty("--border-img", "url(\\"data:image/svg+xml;utf8," + encodeURIComponent(rawSvg) + "\\")");
}
`,
    });
    assert.ok(
      rules(checkSources(sources).findings).includes("R2"),
      "painting the raw argument while the validator exists must fail R2",
    );
  });

  it("R2 FAILS when the choke point never paints --border-img at all", function () {
    const sources = cleanWorld({
      [CHOKE_POINT]: `
function renderBorderSvg(section, rawSvg) {
  const v = sanitizeSvg(rawSvg);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, sanitized: v.sanitized };
}
`,
    });
    assert.ok(
      rules(checkSources(sources).findings).includes("R2"),
      "a choke point that never paints --border-img is decorative; it must fail R2",
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

  it("R4 FAILS on a data:/url( payload fed to a CSS image sink outside the choke point", function () {
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

  it("R4 FAILS on a second writer of --border-img from an SVG source", function () {
    // The D4-specific tripwire: the choke point is the ONE sanctioned site for the
    // custom-property write. Any other file doing it is a second render surface.
    const sources = cleanWorld({
      "js/undo.js": `
function restore(el, borderSvg) {
  el.style.setProperty("--border-img", "url(\\"data:image/svg+xml;utf8," + encodeURIComponent(borderSvg) + "\\")");
}
`,
    });
    const found = rules(checkSources(sources).findings);
    assert.ok(found.includes("R4"), `expected R4 on a --border-img second writer, got ${found.join(",")}`);
  });

  it("R5 FAILS on ANY file mentioning the retired overlay literal", function () {
    // Under D4 the overlay node is deleted; the literal may appear in ZERO product
    // files. Any reappearance — including in the CSS file that used to style it — is
    // a second renderer being rebuilt.
    for (const file of ["js/main.js", "js/print_styles.js", "js/ai_arrange.js"]) {
      const sources = cleanWorld({
        [file]: `const CLS = "${OVERLAY_CLASS}";\n`,
      });
      const found = rules(checkSources(sources).findings);
      assert.ok(found.includes("R5"), `R5 must fire on ${file}, got ${found.join(",")}`);
    }
  });

  it("comments quoting the banned patterns do not trip the guard", function () {
    const sources = cleanWorld({
      "js/main.js": `/**
 * Never do this: el.innerHTML = borderSvg;  // nor document.write(borderSvg)
 * and never style.backgroundImage = "url(" + borderSvg + ")".
 * The overlay class is ${OVERLAY_CLASS}.  // quoted in prose only
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

    // (c) and a retired-literal resurrection fails it too (R5)
    const resurrected = { ...readProductSources(ROOT) };
    resurrected["js/filters.js"] =
      (resurrected["js/filters.js"] || "") +
      `\nconst _old = "${OVERLAY_CLASS}";\n`;
    const afterR5 = checkSources(resurrected);
    assert.ok(
      rules(afterR5.findings).includes("R5"),
      "reintroducing the retired overlay literal must FAIL the guard",
    );
  });
});
