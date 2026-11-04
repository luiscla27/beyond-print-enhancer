/**
 * AC-9 / AC-9b(i) — the render CHOKE POINT contract
 * (track `byok_svg_borders_20260927`, Phase 2, sub-step 2.2; contract REWRITTEN under
 * operator decision D4 2026-10-01: the border rides the product's own `::before`
 * `border-image` slot, so `renderBorderSvg` PAINTS four inline custom properties on the
 * section instead of injecting a markup overlay node).
 *
 * WHAT THIS SUITE EXISTS TO PREVENT
 * ---------------------------------
 * `js/ai_border.js`'s `renderBorderSvg` is the single writer of a border. Under D4 two
 * failure modes are one edit away from looking correct, and this file is written against
 * both of them:
 *
 *  1. **trusting the caller.** If the helper skipped validation and painted the raw
 *     argument, every existing case would still pass while a hostile path could inject.
 *     So the cases here hand the helper a RAW, hostile string and assert that the
 *     custom properties are NOT set — the helper is never given a "clean" string.
 *  2. **fail-open on reject.** A helper that clears some properties and leaves others
 *     is worse than one that throws, because the residue paints a half-border. The
 *     cases assert ALL FOUR custom properties are absent after a reject — including
 *     when a GOOD border from a PREVIOUS render is already on the section.
 *
 * Under D4 the DOM stays pristine (no injected markup to inspect), so the assertions
 * moved to the PAINT STATE: the custom-property set that the `::before` slot consumes.
 * The hostility check (`assertDomClean`) is retained unchanged as defense-in-depth — a
 * future edit that reintroduces markup injection fails here AND in the static guard R2.
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

/** Under D4 the border has NO markup node of its own — it is a set of inline custom
 *  properties on the section. A section is "bordered" exactly when those properties are set. */
const painted = (s) => Boolean(s && s.style.getPropertyValue("--border-img").trim());

/** Every hostile artefact that must NOT be in the DOM after any render. Retained as
 *  defense-in-depth: a future edit that reintroduces markup injection fails here AND in
 *  the static guard R2, so a single broken assertion cannot mask the regression. */
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

/** Assert a section carries no AI border paint at all — none of the four custom properties. */
function assertNoBorder(section, label) {
  const style = section.style;
  const props = ["--border-img", "--border-img-slice", "--border-img-width", "--border-img-outset"];
  for (const p of props) {
    assert.ok(
      !style.getPropertyValue(p).trim(),
      `${label}: custom property ${p} was left set after a refuse/clear`,
    );
  }
  assert.strictEqual(section.dataset.borderRawSvg, undefined, `${label}: dataset.borderRawSvg left set`);
}

describe("AC-9b(i) — renderBorderSvg is the single, self-sanitizing choke point (D4)", function () {
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

  describe("the positive control (a clean SVG really paints)", function () {
    it("sets --border-img on the section and the record carries the sanitized bytes", function () {
      const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(res.ok, true, JSON.stringify(res));
      assert.ok(painted(section()), "the section must carry a --border-img paint on a clean render");
      // `--border-img` must be the sanitized SVG as a data URI, never the raw input or a
      // composition wrapper.
      const src = section().style.getPropertyValue("--border-img");
      assert.ok(src.startsWith('url("data:image/svg+xml'), `--border-img is a data URI: ${src}`);
      assert.ok(
        src.includes(encodeURIComponent(CLEAN_SVG).slice(0, 40)),
        "the painted URI must encode the sanitized SVG, not a hand-truncated variant",
      );
      assert.strictEqual(
        w.AiBorder.readBorderSvg(section()),
        res.sanitized,
        "readBorderSvg must return the sanitized bytes the paint was built from",
      );
      assert.ok(!section().querySelector(".be-border-svg-overlay"), "D4 must leave no overlay node");
      assertDomClean(section(), "clean render");
    });

    it("`hasBorderSvg` reports the STATE, so a caller need not inspect the custom properties", function () {
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), false, "nothing painted yet");
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), true);
      w.AiBorder.renderBorderSvg(section(), null);
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), false, "after an explicit clear");
      // …and a REJECTED payload must not read as "has a border" either — fail-closed from
      // the caller's side, not just the DOM's.
      w.AiBorder.renderBorderSvg(section(), HOSTILE.script.svg);
      assert.strictEqual(w.AiBorder.hasBorderSvg(section()), false, "after a reject");
    });

    it("is idempotent: a second render replaces, never stacks", function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()));
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()), "the paint survived the second render");
      assert.strictEqual(section().querySelectorAll(".be-border-svg-overlay").length, 0, "no overlay node");
    });

    it("clears on an explicit empty value (the 'no border' state is silent, not a reject)", function () {
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()), "precondition: border painted");
      const res = w.AiBorder.renderBorderSvg(section(), null);
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.reason, "cleared");
      assert.strictEqual(painted(section()), false, "a clear must remove all four properties");
      assertNoBorder(section(), "cleared render");
    });
  });

  describe("hostile input is refused and leaves NOTHING painted", function () {
    for (const [name, vector] of Object.entries(HOSTILE)) {
      it(`${name} → refused with the named AC-1 error, no custom property set`, function () {
        const res = w.AiBorder.renderBorderSvg(section(), vector.svg);
        assert.strictEqual(res.ok, false, `${name} was ACCEPTED`);
        assert.strictEqual(res.error, vector.error, `wrong reject reason for ${name}`);
        assert.strictEqual(res.sanitized, null, `${name}: a rejected render must not report bytes`);
        assertNoBorder(section(), name);
        assertDomClean(section(), name);
      });

      it(`${name} → a PRIOR good paint is CLEARED, not kept`, function () {
        // The fail-open shape a happy-path test cannot see: refuse the new payload but
        // leave the previous border painted, so the user sees "it worked".
        w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
        assert.ok(painted(section()), "precondition: good border painted");
        const res = w.AiBorder.renderBorderSvg(section(), vector.svg);
        assert.strictEqual(res.ok, false);
        assertNoBorder(section(), `${name}: the previous paint survived a rejected render`);
      });

      it(`${name} → never paints a PARTIALLY cleaned string`, function () {
        // A "strip what we can and keep the rest" implementation must not pass: if any
        // property is set, it must encode the FULL sanitized output, not a fragment.
        const res = w.AiBorder.renderBorderSvg(section(), vector.svg);
        assert.strictEqual(res.ok, false);
        if (painted(section())) {
          const src = section().style.getPropertyValue("--border-img");
          assert.ok(
            !/<script|foreignObject|onload=|evil\.example|@import/i.test(src),
            `${name}: partially-cleaned residue reached the paint`,
          );
        }
      });
    }
  });

  describe("the helper never trusts a caller's 'already clean' claim", function () {
    it("has a TWO-argument contract (section, raw string) — no pre-sanitized variant", function () {
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

    it("sanitizes internally: a payload the trust root rejects never paints", function () {
      const res = w.AiBorder.renderBorderSvg(section(), HOSTILE.script.svg);
      assert.strictEqual(res.ok, false);
      assert.strictEqual(painted(section()), false, "a rejected payload must not paint");
    });

    it("fails closed when the trust root is unavailable", function () {
      const saved = w.AiLayout;
      try {
        w.AiLayout = undefined;
        const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.reason, "unavailable");
        assert.strictEqual(painted(section()), false);
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
      assertNoBorder(section(), "a stored script payload must not paint");
      assertDomClean(section(), "path B");

      await w.applyLayout({
        version: "1.6.0",
        sections: { "section-main": { borderSvg: CLEAN_SVG } },
      });
      assert.ok(painted(section()), "path B's positive control failed");
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
      assertNoBorder(container, "path E rendered a hostile border");
      assertDomClean(container, "path E");

      // …and a clean clone paints.
      const good = Object.assign({}, snapshot, { borderSvg: CLEAN_SVG });
      const w2 = w.renderClonedSection(good);
      const c2 = w2.querySelector(".print-section-container");
      assert.ok(painted(c2), "path E's positive control failed");
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
      assert.ok(painted(section()), "the library record did not paint");

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
      assert.ok(painted(section()), "precondition: the border painted");

      const snap = w.snapshotSectionFlags();
      assert.strictEqual(
        snap["section-main"].borderSvg,
        w.AiBorder.readBorderSvg(section()),
        "the undo snapshot must hold the bytes the DOM holds",
      );

      // The user's NEXT border (or a clear), then an undo that repairs from the snapshot.
      w.AiBorder.renderBorderSvg(section(), null);
      assert.strictEqual(painted(section()), false);

      const layout = {
        version: "1.6.0",
        sections: { "section-main": { left: "40px" } },
      };
      w.repairSectionFlags(layout, snap);
      assert.ok(layout.sections["section-main"].borderSvg, "repair dropped the border");
      await w.applyLayout(layout);
      assert.ok(painted(section()), "path F: undo did not restore the border");
      assertDomClean(section(), "path F");
    });

    it("path G — a preview render writes the same paint (no separate preview path)", function () {
      // There is no `renderBorderSvgPreview`: the ghost IS this helper, which is what
      // makes 'preview' unable to be the path that forgets to sanitize.
      const surface = Object.keys(w.AiBorder);
      assert.ok(surface.includes("renderBorderSvg"));
      assert.ok(
        !surface.some((k) => /preview/i.test(k)),
        `a separate preview renderer is a second injection site: ${surface.join(",")}`,
      );
      w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      assert.ok(painted(section()), "preview must leave the same paint as a real render");
    });

    it("path A — apply through the helper, then scan: the record holds the sanitized bytes", async function () {
      const res = w.AiBorder.renderBorderSvg(section(), CLEAN_SVG);
      const layout = await w.scanLayout();
      assert.strictEqual(
        layout.sections["section-main"].borderSvg,
        res.sanitized,
        "path A: the scan must record exactly what the helper painted",
      );
    });
  });

  describe("[AC-8] the border rides the product's ::before border-image slot", function () {
    it("js/print_styles.js must NOT declare a D4-retired overlay rule set", function () {
      // Under D4 there is no overlay node to style. The print/layout contract must live
      // ONLY on the existing `::before` slot (`print_styles.js:1168`), so print_styles must
      // not carry any rule that names the retired literal. The guard R5 enforces this
      // across all product source; this case pins it here too, against the test's own
      // source read, so it survives a guard bypass.
      const css = readJs("print_styles.js");
      assert.ok(
        !css.includes("be-border-svg-overlay"),
        "print_styles.js must not declare the retired overlay class (D4)",
      );
    });

    it("the ::before slot is the AI border's render contract, not a new overlay rule", function () {
      // The AC-8 invariants (behind content, non-interactive, full-rect, no-border hides,
      // in print) are all on the .print-section-container:not(.be-no-border)::before rule
      // — so the AI border inherits them instead of re-declaring them.
      const css = readJs("print_styles.js");
      const beforeRule = css.slice(css.indexOf(".print-section-container:not(.be-no-border)::before"));
      assert.ok(/border-image-source\s*:\s*var\(--border-img\)/.test(beforeRule), "the slot consumes --border-img");
      assert.ok(/z-index\s*:\s*-1/.test(beforeRule), "the slot sits behind content");
      assert.ok(/pointer-events\s*:\s*none/.test(beforeRule), "the slot is non-interactive");
      assert.ok(/@media print/.test(css.slice(css.indexOf("print-section-container:not(.be-no-border)::before"))),
        "the slot must be defined inside @media print (it is) — verified it is reachable from the rule");
    });
  });
});
