/**
 * template_border_svg.test.js — leg B's AC-B2/AC-B3' embed pin (track
 * byok_template_tuning_20261014).
 *
 * WHY THIS SUITE READS THE REAL TEMPLATE FILES
 * -------------------------------------------
 * A fixture copy of the embedded bytes would pass while the real templates drift: the
 * suite reads `assets/templates/{basic,archer}_template.json` directly, so any change to
 * the embedded borderSvg — oversize, a disallowed element/attribute, a byte flip — fails
 * here first. (Same discipline the plan's AC-B2 clause declares: "reads the ACTUAL
 * template files (no fixture copies)".)
 *
 * WHAT IS PINNED
 * --------------
 * AC-B1  — exactly the sections whose borderStyle is null/"no-border" (13 basic, 10
 *          archer) carry borderSvg; NO other section carries it; borderStyle values are
 *          unchanged (asserted per section, not as a count).
 * AC-B2  — every embedded borderSvg passes the REAL product trust root
 *          (`AiLayout.validateSvg`, js/ai_layout.js) with `ok: true`, and the raw string
 *          is <= MAX_SVG_CHARS (16000) — the same ceiling the choke point enforces.
 * AC-B3' — every embedded borderSvg is THE certified lite artifact, byte-for-byte
 *          (fixture `test/fixtures/thornvine_lite_border.svg` is asserted equal to the
 *          template bytes; the certification record names it), and the fixture itself is
 *          pinned by size + root element so it cannot silently become something else.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const aiLayout = require("../../js/ai_layout.js");

const LITE_FIXTURE = path.join(__dirname, "..", "fixtures", "thornvine_lite_border.svg");
const TEMPLATES = {
  basic: path.join(__dirname, "..", "..", "assets", "templates", "basic_template.json"),
  archer: path.join(__dirname, "..", "..", "assets", "templates", "archer_template.json"),
};
const EXPECTED_STAMPED = { basic: 13, archer: 10 };

function sectionsOf(tpl) {
  return Array.isArray(tpl.sections) ? tpl.sections : Object.values(tpl.sections);
}

describe("template borderSvg embed — leg B (byok_template_tuning_20261014)", function () {
  // jsdom DOMParser parses ~13.7 KB x 23 embedded blobs; the schema suite's 2s default
  // measured too tight for the 13-section template (462ms measured for basic alone, but
  // the margin is thin) — 10s keeps the suite deterministic without hiding a hang.
  this.timeout(10000);
  let liteFixture = null;

  before(function () {
    liteFixture = fs.readFileSync(LITE_FIXTURE, "utf8");
  });

  for (const [name, file] of Object.entries(TEMPLATES)) {
    describe(`${name}_template.json`, function () {
      let tpl = null;
      before(function () {
        tpl = JSON.parse(fs.readFileSync(file, "utf8"));
      });

      it(`stamps borderSvg on EXACTLY the ${EXPECTED_STAMPED[name]} borderStyle null/no-border sections, and NO others (AC-B1)`, function () {
        const sections = sectionsOf(tpl);
        let stamped = 0;
        for (const s of sections) {
          const expected = s.borderStyle === null || s.borderStyle === "no-border";
          if (expected) {
            assert.ok(typeof s.borderSvg === "string" && s.borderSvg.length > 0,
              `stamped section must carry borderSvg (borderStyle=${s.borderStyle})`);
            stamped++;
          } else {
            assert.ok(!("borderSvg" in s),
              `non-stamped section (borderStyle=${s.borderStyle}) must NOT carry borderSvg`);
          }
        }
        assert.strictEqual(stamped, EXPECTED_STAMPED[name]);
      });

      it("every embedded borderSvg passes the REAL trust root, and is <= MAX_SVG_CHARS (AC-B2)", function () {
        for (const s of sectionsOf(tpl)) {
          if (!("borderSvg" in s)) continue;
          assert.ok(s.borderSvg.length <= aiLayout.MAX_SVG_CHARS,
            `embedded borderSvg ${s.borderSvg.length} exceeds MAX_SVG_CHARS ${aiLayout.MAX_SVG_CHARS}`);
          const v = aiLayout.validateSvg(s.borderSvg);
          assert.strictEqual(v.ok, true, `trust root rejected the embedded bytes: ${v.error}`);
          assert.ok(typeof v.sanitized === "string" && v.sanitized.length > 0);
        }
      });

      it("embedded bytes are THE certified 03-thornvine-lite artifact, byte-for-byte (AC-B3')", function () {
        const sections = sectionsOf(tpl);
        const stamped = sections.filter((s) => "borderSvg" in s);
        assert.ok(stamped.length > 0);
        for (const s of stamped) {
          assert.strictEqual(s.borderSvg, liteFixture,
            "embedded borderSvg drifted from the certified lite fixture");
        }
      });
    });
  }

  describe("thornvine_lite_border.svg fixture — the certification artifact itself", function () {
    it("is under the cap and survives the trust root (the cert claim, re-checked at test time)", function () {
      assert.ok(liteFixture.length <= aiLayout.MAX_SVG_CHARS,
        `certified artifact ${liteFixture.length} exceeds MAX_SVG_CHARS ${aiLayout.MAX_SVG_CHARS}`);
      const v = aiLayout.validateSvg(liteFixture);
      assert.strictEqual(v.ok, true, `trust root rejected the certified artifact: ${v.error}`);
    });

    it("carries the certification's declared shape (single svg root, #8D2A2F ink)", function () {
      assert.ok(liteFixture.trim().startsWith("<svg"), "root must be <svg>");
      assert.ok(liteFixture.includes('stroke="#8D2A2F"'), "certified ink color missing");
      assert.strictEqual((liteFixture.match(/<svg\b/g) || []).length, 1, "exactly one svg root");
    });
  });
});
