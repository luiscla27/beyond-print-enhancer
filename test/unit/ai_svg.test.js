"use strict";

const assert = require("assert");

/**
 * SVG sanitizer + validator (track byok_svg_borders_20260927, Phase 1 / AC-1).
 *
 * WHERE THE CODE LIVES, AND WHY (a Phase 1 execution note)
 * --------------------------------------------------------
 * An earlier draft of this phase shipped the sanitizer as a NEW module `js/ai_svg.js` with its
 * own `window.AiSvg` seam. That was reverted: `spec.md` `[AC-1]` names `js/ai_layout.js` ("exposes
 * a pure `validateSvg(svg)`"), the plan's GREEN box repeats it, and the new module would have
 * needed a second `window.*` seam plus an `executeScript` registration and a lint global for the
 * SAME trust root `js/ai_border.js` is already scheduled to read in Phase 2. One trust root, one
 * module: the sanitizer is a member of `AiLayout` (this suite asserts it), so `AiSvg` never exists.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 * ---------------------------------
 * A pure, headless SVG sanitizer that removes every element and attribute the spec's
 * "fixed SVG" contract forbids, bounded by a maximum character count.  It does NOT read the
 * network and does NOT trust a caller that claims a string is already clean.  The choke-point
 * module (`js/ai_border.js`, Phase 2) will call `sanitizeSvg` INTERNALLY — no other module may
 * implement its own ad-hoc SVG checks.
 *
 * The tests below are logged as PARTIAL for `[AC-9]`: they prove the sanitizer's own
 * correctness, NOT that every render path is single-sourced through it.  That invariant
 * is proven by Phase 2's choke-point + static guard and Phase 3's per-path DOM tests.
 */

const {
  validateSvg,
  sanitizeSvg,
  MAX_SVG_CHARS,
} = require("../../js/ai_layout.js");

// ---------------------------------------------------------------------------
// AC-1 — the sanitizer
// ---------------------------------------------------------------------------
describe("ai_svg — SVG sanitizer + validator (AC-1)", function () {
  // Positive control: a clean, viewBox-carrying, single-root SVG MUST be accepted.
  const CLEAN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';

  it("accepts a well-formed single-root SVG with a viewBox", function () {
    this.timeout(5000);
    const v = validateSvg(CLEAN);
    assert.strictEqual(v.ok, true);
    assert.strictEqual(v.error, null);
    assert.strictEqual(typeof v.sanitized, "string");
    assert.ok(v.sanitized.includes("<svg"), "sanitized string is still an SVG");
  });

  // --- rejection vectors (each AC-1 FAIL condition) -----------------------------

  it("rejects a non-svg root", function () {
    const v = validateSvg('<div viewBox="0 0 100 100"></div>');
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "non_svg_root");
  });

  it("rejects a missing viewBox", function () {
    const v = validateSvg("<svg></svg>");
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "missing_viewbox");
  });

  it("rejects <script>", function () {
    const v = validateSvg(
      '<svg viewBox="0 0 100 100"><script>alert(1)</script></svg>'
    );
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "script");
  });

  it("rejects <foreignObject>", function () {
    const v = validateSvg(
      '<svg viewBox="0 0 100 100"><foreignObject><body></body></foreignObject></svg>'
    );
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "foreign_object");
  });

  it("rejects on* event-handler attributes", function () {
    this.timeout(5000);
    const v = validateSvg(
      '<svg viewBox="0 0 100 100" onload="alert(1)"></svg>'
    );
    assert.strictEqual(typeof v.ok, "boolean", "ok must be boolean");
    assert.strictEqual(v.error, "event_handler");
  });

  it("rejects external references via <use>", function () {
    this.timeout(5000);
    const v = validateSvg(
      '<svg viewBox="0 0 100 100"><use href="evil.svg#x"></use></svg>'
    );
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "external_reference");
  });

  it("rejects <image href='...'> to any URL", function () {
    this.timeout(5000);
    const v = validateSvg(
      '<svg viewBox="0 0 100 100"><image href="https://evil.example/img.png"></image></svg>'
    );
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "external_reference");
  });

  it("rejects <style> containing @import", function () {
    const v = validateSvg(
      '<svg viewBox="0 0 100 100"><style>@import url(evil.css)</style></svg>'
    );
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "css_import");
  });

  it("rejects animation elements", function () {
    this.timeout(5000);
    const v = validateSvg(
      '<svg viewBox="0 0 100 100"><animate attributeName="x" from="0" to="100"></animate></svg>'
    );
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "animation");
  });

  it("rejects markup over MAX_SVG_CHARS", function () {
    const big = '<svg viewBox="0 0 100 100"><!--' + "x".repeat(MAX_SVG_CHARS + 10) + '--></svg>';
    const v = validateSvg(big);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.error, "oversize");
  });

  it("rejects null / non-string input", function () {
    assert.strictEqual(validateSvg(null).ok, false);
    assert.strictEqual(validateSvg(123).ok, false);
    assert.strictEqual(validateSvg(undefined).ok, false);
  });

  // --- sanitizeSvg: the stripped-down variant for the choke-point contract --------

  it("sanitizeSvg returns a string or empty string, never the raw input when rejected", function () {
    const bad = '<svg viewBox="0 0 100 100"><script>x</script></svg>';
    const out = sanitizeSvg(bad);
    assert.strictEqual(typeof out, "string");
    assert.ok(!out.includes("<script"), "script must be removed");
    assert.ok(out.includes("<svg"), "root SVG is preserved");
  });

  it("sanitizeSvg is idempotent on clean input", function () {
    const a = sanitizeSvg(CLEAN);
    const b = sanitizeSvg(a);
    assert.strictEqual(a, b, "running twice must not change the bytes");
  });

  // --- the SVG NAMESPACE normalisation (track byok_border_prompt_adoption_20261006) ---
  //
  // WHY: the product paints the border as an IMAGE (`url("data:image/svg+xml;utf8,…")`).
  // Chromium's image decoder requires a valid XML document, so an <svg> WITHOUT the
  // xmlns binding is not an SVG root to it and paints NOTHING — while the trust root
  // (an XML/html parse, not an image decode) accepted it. MEASURED on gallery round 30:
  // 41/41 correlation between "no xmlns" and "no paint" (6 frames byte-identical, no
  // border pigment), 0 violations. The trust root therefore stamps the binding and
  // re-parses, so EVERY downstream painter receives a decodable document.

  it("stamps the SVG namespace on an xmlns-less root (the image decoder requires it)", function () {
    this.timeout(5000);
    const v = validateSvg('<svg viewBox="0 0 100 100"><rect width="50" height="50"/></svg>');
    assert.strictEqual(v.ok, true, "an xmlns-less SVG is still a legal SVG document to accept");
    assert.ok(
      v.sanitized.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'),
      "the sanitized output must carry the SVG namespace binding: " + v.sanitized.slice(0, 80),
    );
    // The re-parse must re-anchor DESCENDANTS too — a root-only DOM re-anchor serializes
    // them with xmlns="" (measured in jsdom), which is again non-SVG to the decoder.
    assert.ok(!v.sanitized.includes('xmlns=""'), "no dangling empty namespace bindings");
    assert.ok(v.sanitized.includes("<rect"), "content survives the re-parse");
  });

  it("leaves an explicit xmlns untouched and keeps sanitizeSvg idempotent on it", function () {
    this.timeout(5000);
    const once = sanitizeSvg('<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="9" height="9"/></svg>');
    assert.ok(once.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), once.slice(0, 80));
    const twice = sanitizeSvg(once);
    assert.strictEqual(twice, once, "a stamped document re-sanitizes byte-identically");
    // And the explicit-xmlns form is untouched (no double binding).
    const explicit = validateSvg(CLEAN);
    assert.strictEqual(explicit.ok, true);
    assert.strictEqual(
      (explicit.sanitized.match(/xmlns=/g) || []).length, 1,
      "an explicit xmlns must not be duplicated",
    );
  });
});