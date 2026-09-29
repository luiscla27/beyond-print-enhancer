/**
 * AC-9 / AC-9b(i) — the render CHOKE POINT contract
 * (track `byok_svg_borders_20260927`, Phase 2, sub-step 2.2).
 *
 * WHAT THIS SUITE EXISTS TO PREVENT
 * ---------------------------------
 * `js/ai_border.js`'s `renderBorderSvg` is the single writer of a border overlay. Two
 * failure modes are one edit away from looking correct, and this file is written against
 * both of them:
 *
 *  1. **trusting the caller.** If the helper's signature were `renderBorderSvg(section,
 *     sanitizedSvg)` and the callers sanitized first, every existing case would still pass
 *     while a new path could inject freely. So the cases here hand the helper a RAW,
 *     hostile string and assert on the DOM that nothing hostile arrived — the helper is
 *     never given a "clean" string it could have been told about.
 *  2. **fail-open on reject.** A helper that strips what it can and injects the rest is
 *     worse than one that throws, because the residue looks like a working border. The
 *     cases assert the overlay is ABSENT after a reject — including the case where an
 *     overlay from a PREVIOUS good render is already in the DOM, since "clear the old one
 *     before refusing the new one" is the part a happy-path test skips.
 *
 * PATHS COVERED HERE (`[AC-9]` A–H), all driven through the real product functions:
 *   B  persistence rehydrate   — `window.applyLayout(storedRecord)`
 *   D  library reuse           — `AiBorder.getBorder(id)` → `renderBorderSvg`
 *   E  section clone           — `window.renderClonedSection(snapshot)`
 *   F  undo restore            — `snapshotSectionFlags` → `repairSectionFlags` → `applyLayout`
 *   G  preview ghost           — the same helper with no persistence (that is the contract)
 *   A  fresh generation apply  — patch → helper → record → scan (the apply half is Phase 3;
 *                                the record/scan half is asserted here and in the AC-7 file)
 * The full per-path DOM payload matrix (C template import, H print) is Phase 3's
 * `test/browser_e2e/byok_border_sanitize_paths.spec.js`, per the plan.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { boot } = require("./encapsulation_debt/debt_harness.js");

const ROOT = path.resolve(__dirname, "..", "..");
const readJs = (p) => fs.readFileSync(path.join(ROOT, "js", p), "utf8");

const CLEAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" ' +
  'preserveAspectRatio="none"><rect width="100" height="40" fill="none" ' +
  'stroke="#C6A15B" stroke-width="2"/></svg>';

/**
 * One hostile payload per AC-1 rejection vector. Each MUST be refused, and the returned
 * `error` is the named vector — asserting the name (not just `ok:false`) is what stops a
 * later refactor from collapsing every refusal into one generic branch.
 */
const HOSTILE = {
  script: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>',
    error: "script",
  },
  foreign_object: {
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      "<foreignObject><div>hi</div></foreignObject></svg>",
    error: "foreign_object",
  },
  event_handler: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"></svg>',
    error: "event_handler",
  },
  external_reference: {
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      '<use href="https://evil.example/x.svg#a"></use></svg>',
    error: "external_reference",
  },
  non_svg_root: {
    svg: "<div>not an svg</div>",
    error: "non_svg_root",
  },
  missing_viewbox: {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    error: "missing_viewbox",
  },
  oversize: {
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc>' +
      "x".repeat(20000) +
      "</desc></svg>",
    error: "oversize",
  },
};

const SHEET = `<!DOCTYPE html><html><body>
  <div id="print-layout-wrapper">
    <div id="print-enhance-sections-layer">
      <div class="be-section-wrapper" id="wrapper-main" data-title="main box"
           style="left: 40px; top: 20px; z-index: 10">
        <div class="print-section-container" id="section-main"
             style="width: 200px; height: 120px;">
          <div class="print-section-header"><span>main heading</span></div>
          <div class="print-section-content"><div style="width: 190px;">body</div></div>
        </div>
      </div>
    </div>
    <div id="print-enhance-shapes-layer">
      <div class="be-shape-layer-container" id="shapes-default"></div>
    </div>
    <div id="print-enhance-properties-panel"></div>
  </div>
</body></html>`;

function bootStack() {
  const b = boot(SHEET);
  const w = b.window;
  w.eval(readJs("ai_layout.js"));
  w.eval(readJs("ai_border.js"));
  return b;
}

/** Every hostile artefact that must NOT be in the DOM after any render. */
function assertDomClean(root, label) {
  const html = root.innerHTML;
  assert.strictEqual(root.querySelectorAll("script").length, 0, `${label}: <script> in DOM`);
  assert.strictEqual(
    root.querySelectorAll("foreignObject").length,
    0,
    `${label}: <foreignObject> in DOM`,
  );
  for (const el of root.querySelectorAll("*")) {
    for (const attr of Array.from(el.attributes || [])) {
      assert.ok(
        !/^on/i.test(attr.name),
        `${label}: event-handler attribute ${attr.name} survived`,
      );
      if (/^(xlink:)?href$/i.test(attr.name) && attr.value) {
        assert.ok(
          attr.value.startsWith("#"),
          `${label}: external reference survived (${attr.name}=${attr.value})`,
        );
      }
    }
  }
  assert.ok(!/@import/.test(html), `${label}: @import survived`);
  assert.strictEqual(
    root.querySelectorAll("animate, animateTransform, set").length,
    0,
    `${label}: animation element in DOM`,
  );
}

describe("AC-9b(i) — renderBorderSvg is the single, self-sanitizing choke point", function () {
  this.timeout(10000);

  let b;
  let w;

  beforeEach(function () {
    b = bootStack();
    w = b.window;
  });

  afterEach(function () {
    b.cleanup();
  });

  const section = () => w.document.getElementById("section-main");
  const overlayOf = (s) => s.querySelector(".be-border-svg-overlay");

  describe("the positive control (a clean SVG really renders)", function () {
    it("creates one overlay holding one svg, behind the content", function () {
      const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(res.ok, true, JSON.stringify(res));
      const overlay = overlayOf(section());
      assert.ok(overlay, "overlay node must exist");
      assert.strictEqual(overlay.querySelectorAll("svg").length, 1);
      // AC-8 geometry contract.
      assert.strictEqual(overlay.style.zIndex, "-1");
      assert.strictEqual(overlay.style.pointerEvents, "none");
      assert.strictEqual(overlay.style.position, "absolute");
      // …and it is NOT inside the content (so a clone's html can never carry it).
      assert.ok(!section().querySelector(".print-section-content .be-border-svg-overlay"));
      assertDomClean(section(), "clean render");
    });

    it("`hasBorderSvg` reports the STATE, so a caller need not read the DOM itself", function () {
      // The dialog's "is there a border here already?" query (Phase 3) must be answerable
      // without a second DOM inspection that could drift from the overlay contract — and
      // the answer must flip for the SILENT clear case too, since that is the path a
      // "no border" record takes on rehydrate (a truthy-looking empty node would make the
      // dialog claim a border that is not there).
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), false, "nothing rendered yet");
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), true);
      w.AiBorder.renderBorderSvg(section(), null);
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), false, "after an explicit clear");
      // …and a REJECTED payload must not read as "has a border" either: that is the
      // fail-closed claim seen from the caller's side rather than the DOM's.
      w.AiBorder.renderBorderSvg(section(), HOSTILE.script.svg);
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), false, "after a reject");
    });

    it("is idempotent: a second render replaces, never stacks", function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(section().querySelectorAll(".be-border-svg-overlay").length, 1);
    });

    it("clears on an explicit empty value (the 'no border' state is silent, not a reject)", function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      const res = w.AiBorder.renderBorderSvg(section(), null);
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.reason, "cleared");
      assert.strictEqual(overlayOf(section()), null);
    });
  });

  describe("hostile input is refused and leaves NOTHING in the DOM", function () {
    for (const [name, vector] of Object.entries(HOSTILE)) {
      it(`${name} → refused with the named AC-1 error, overlay absent`, function () {
        const res = w.AiBorder.renderBorderSvg(section(), vector.svg);
        assert.strictEqual(res.ok, false, `${name} was ACCEPTED`);
        assert.strictEqual(res.error, vector.error, `wrong reject reason for ${name}`);
        assert.strictEqual(overlayOf(section()), null, `${name}: an overlay was left behind`);
        assertDomClean(section(), name);
      });

      it(`${name} → a PRIOR good overlay is CLEARED, not kept`, function () {
        // The fail-open shape that a happy-path test cannot see: refuse the new payload
        // but leave the previous border painted, so the user sees "it worked".
        w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
        assert.ok(overlayOf(section()), "precondition");
        const res = w.AiBorder.renderBorderSvg(section(), vector.svg);
        assert.strictEqual(res.ok, false);
        assert.strictEqual(
          overlayOf(section()),
          null,
          `${name}: the previous overlay survived a rejected render`,
        );
      });

      it(`${name} → never injects a PARTIALLY cleaned string`, function () {
        // A "strip what we can and keep the rest" implementation must not pass: the
        // overlay, if one exists at all, may not contain the vector's marker.
        const res = w.AiBorder.renderBorderSvg(section(), vector.svg);
        const overlay = overlayOf(section());
        if (overlay) {
          assert.ok(
            !/<script|foreignObject|onload=|evil\.example|@import/i.test(overlay.innerHTML),
            `${name}: partially-cleaned residue reached the DOM`,
          );
        }
        assert.strictEqual(res.sanitized, null, `${name}: a rejected render must not report bytes`);
      });
    }
  });

  describe("the helper never trusts a caller's 'already clean' claim", function () {
    it("has a TWO-argument contract (section, raw string) — no pre-sanitized variant", function () {
      // Read the source, so the claim is about the shipped signature and not about a
      // coincidentally-matching call in a test.
      const src = readJs("ai_border.js").replace(/\/\*[\s\S]*?\*\//g, "");
      const m = src.match(/function\s+renderBorderSvg\s*\(([^)]*)\)/);
      assert.ok(m, "renderBorderSvg must be declared");
      const params = m[1].split(",").map((p) => p.trim());
      assert.strictEqual(params.length, 2, `expected (section, rawSvg), got (${m[1]})`);
      assert.ok(
        !/sanitiz/i.test(params[1]),
        "the second parameter must be the RAW string; a `sanitizedSvg` parameter is the " +
          "inject-if-caller-says-clean shape AC-9 forbids",
      );
    });

    it("sanitizes internally: a payload the trust root rejects never renders", function () {
      // Called with a string that is NOT clean, by a caller that claims nothing. If the
      // helper skipped validation this case would render a script tag.
      const res = w.AiBorder.renderBorderSvg(section(), HOSTILE.script.svg);
      assert.strictEqual(res.ok, false);
      assert.strictEqual(overlayOf(section()), null);
    });

    it("fails closed when the trust root is unavailable", function () {
      const saved = w.AiLayout;
      try {
        w.AiLayout = undefined;
        const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.reason, "unavailable");
        assert.strictEqual(overlayOf(section()), null);
      } finally {
        w.AiLayout = saved;
      }
    });
  });

  describe("the real product paths delegate to it", function () {
    it("path B — applyLayout rehydrates through the helper (hostile record is refused)", async function () {
      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { borderSvg: HOSTILE.script.svg } },
      });
      assert.strictEqual(overlayOf(section()), null, "a stored script payload rendered");
      assertDomClean(section(), "path B");

      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { borderSvg: CLEAN_SVG } },
      });
      assert.ok(overlayOf(section()), "path B's positive control failed");
    });

    it("path E — a cloned section re-renders through the helper", function () {
      // The snapshot is HAND-BUILT with a hostile field: a clone source can be a saved
      // record, so the snapshot's `borderSvg` is untrusted by contract.
      const snapshot = {
        id: "clone-1",
        title: "clone",
        html: "<div>body</div>",
        left: "10px",
        top: "10px",
        width: "200px",
        height: "120px",
        borderSvg: HOSTILE.event_handler.svg,
      };
      const wrapper = w.renderClonedSection(snapshot);
      assert.ok(wrapper, "the clone must still render (only the border is refused)");
      const container = wrapper.querySelector(".print-section-container");
      assertDomClean(container, "path E");
      assert.strictEqual(
        container.querySelector(".be-border-svg-overlay"),
        null,
        "path E rendered a hostile border",
      );
    });

    it("path D — the library round-trips through the helper and refuses on save", async function () {
      await w.__DDBStorage.init();
      const good = await w.AiBorder.saveBorder({
        id: "b1",
        prompt: "gothic arch",
        svg: CLEAN_SVG,
      });
      assert.strictEqual(good.ok, true, JSON.stringify(good));
      const rec = await w.AiBorder.getBorder("b1");
      assert.ok(rec, "the library record must be readable");
      assert.strictEqual(
        w.AiBorder.renderBorderSvg(section(), rec.svg).ok,
        true,
        "a library record must render through the helper",
      );

      // …and the library refuses to STORE a hostile payload, so it cannot become a
      // laundering channel that a later render would have to reject.
      const bad = await w.AiBorder.saveBorder({
        id: "b2",
        prompt: "evil",
        svg: HOSTILE.script.svg,
      });
      assert.strictEqual(bad.ok, false);
      assert.strictEqual(await w.AiBorder.getBorder("b2"), null);

      // …and the library's DELETE half is driven through the same module (path D's
      // cleanup), because a picker that can only add is a library that grows forever.
      assert.ok(await w.AiBorder.deleteBorder("b1"));
      assert.strictEqual(await w.AiBorder.getBorder("b1"), null, "delete must remove the row");
      assert.strictEqual(
        (await w.AiBorder.listBorders()).some((r) => r && r.id === "b1"),
        false,
      );
    });

    it("path F — the undo snapshot carries the border, and repair puts it back", async function () {
      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { left: "40px", borderSvg: CLEAN_SVG } },
      });
      assert.ok(overlayOf(section()), "precondition: the border rendered");

      const snap = w.snapshotSectionFlags();
      assert.strictEqual(
        snap["section-main"].borderSvg,
        w.AiBorder.readBorderSvg(section()),
        "the undo snapshot must hold the bytes the DOM holds",
      );

      // The user's NEXT border (or a clear), then an undo that repairs from the snapshot.
      w.AiBorder.renderBorderSvg(section(), null);
      assert.strictEqual(overlayOf(section()), null);

      const layout = {
        version: "1.6.0",
        sections: { "section-main": { left: "40px" } },
      };
      w.repairSectionFlags(layout, snap);
      assert.ok(layout.sections["section-main"].borderSvg, "repair dropped the border");
      await w.applyLayout(layout);
      assert.ok(overlayOf(section()), "path F: undo did not restore the border");
      assertDomClean(section(), "path F");
    });

    it("path G — a preview render writes the same node shape (no separate preview path)", function () {
      // There is no `renderBorderSvgPreview`: the ghost IS this helper, which is what
      // makes 'preview' unable to be the path that forgets to sanitize.
      const surface = Object.keys(w.AiBorder);
      assert.ok(surface.includes("renderBorderSvg"));
      assert.ok(
        !surface.some((k) => /preview/i.test(k)),
        `a separate preview renderer is a second injection site: ${surface.join(",")}`,
      );
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(section().querySelectorAll(".be-border-svg-overlay").length, 1);
    });

    it("path A — apply through the helper, then scan: the record holds the sanitized bytes", async function () {
      const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      const layout = await w.scanLayout();
      assert.strictEqual(
        layout.sections["section-main"].borderSvg,
        res.sanitized,
        "path A: the scan must record exactly what the helper rendered",
      );
    });
  });

  describe("[AC-8] the overlay's CSS/print contract is declared", function () {
    it("js/print_styles.js sizes and prints the overlay node", function () {
      const css = readJs("print_styles.js");
      assert.ok(
        css.includes("be-border-svg-overlay"),
        "print_styles must style the overlay (it is the only other file allowed to name it)",
      );
      // The print block must keep the border visible. Stated precisely, because the
      // overlay HAS one legitimate `display: none`: the `.be-no-border` rule (AC-8 says a
      // no-border section shows neither border slot). So the check is per-RULE — every
      // overlay rule that hides the node must be scoped to `be-no-border` — rather than a
      // substring search, which would either pass a blanket `display:none` added by a
      // later edit or fail on the legitimate scoped one.
      const printBlock = css.slice(css.indexOf("@media print"));
      const rules = printBlock.match(/[^{}]+\{[^}]*\}/g) || [];
      const overlayRules = rules.filter((r) => r.includes("be-border-svg-overlay"));
      assert.ok(overlayRules.length > 0, "the overlay must have a rule in the print block");
      for (const rule of overlayRules) {
        const selector = rule.slice(0, rule.indexOf("{"));
        if (/display\s*:\s*none/.test(rule)) {
          assert.ok(
            selector.includes("be-no-border"),
            `only a .be-no-border selector may hide the overlay; got: ${selector.trim()}`,
          );
        }
      }
      assert.ok(
        overlayRules.some((r) => /width\s*:\s*100%/.test(r)),
        "the overlay's svg must be scaled to the section rect (width: 100%)",
      );
    });
  });
});
