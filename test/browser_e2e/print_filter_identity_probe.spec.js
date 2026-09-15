/**
 * PRINT FILTER IDENTITY PROBE — the two measurements the rasterisation fix was decided on.
 * (issue `print_sheet_rasterised_20260911`, fixed in 1.17.2)
 *
 * WHY THIS EXISTS SEPARATELY FROM THE AUDIT SUITE. `print_output_audit.spec.js` answers "what does the
 * printed sheet look like" and now REQUIRES the text layer. It cannot answer the two questions the fix
 * itself turned on, because both need a SECOND sheet to compare against:
 *
 *   1. **Is a chain with every slider at its DEFAULT value neutral?** No — and that is the whole
 *      decision. The product's default `greyscale` is 100% (`js/storage.js` `getFilters`, the panel's
 *      slider default, Reset Filters) and `grayscale(100%)` is NOT an identity, so the reading
 *      "all sliders at their defaults -> `none`" would un-grey the sheet's ornaments. Substituting the
 *      custom properties by hand measures exactly that reading (`all-defaults-none`) against the rule
 *      that shipped (`strict-identity`) on the same sheet, in the same session.
 *   2. **Does a setting the user actually made still reach the paper?** Driven through the panel's OWN
 *      slider input events: `greyscale 0%` must put colour back — and must reproduce the hand-written
 *      `all-defaults-none` render, which is what proves the difference is the greyscale and nothing
 *      else — and `hue 90` must be emitted again rather than neutralised.
 *
 * IT IS A PROBE, NOT A GATE, like the other `*_capture` / `panel_measure` suites: it self-skips unless
 * `PRINT_FILTER_PROBE=1`, it prints what it measured, and it writes `probe-measurements.json` next to
 * the report. It still ASSERTS the properties it is measuring — a probe whose claims are never checked
 * is how a wrong "measured" number gets committed.
 *
 * Run:  PRINT_FILTER_PROBE=1 npx mocha test/browser_e2e/print_filter_identity_probe.spec.js --timeout 1800000
 * Evidence: vendor/docs/print-sheet-text-layer-20260911/ (FIX_REPORT.md, evidence/*.txt)
 *
 * `page.emulateMedia` is NEVER called (see the landmine note in `print_output_audit.spec.js`): pinning
 * the media type makes `page.pdf()` skip the `@media print` stylesheet and the SCREEN layout prints,
 * which would silently invalidate every number here.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { measurePdf, startStaticServer, EXT_ROOT } = require("./_helpers/pdf.js");

const ENABLED = process.env.PRINT_FILTER_PROBE === "1";
const ART = path.resolve(EXT_ROOT, process.env.PRINT_FILTER_PROBE_DIR || "vendor/docs/print-sheet-text-layer-20260911");
const WORK = path.resolve(EXT_ROOT, "temp/print-filter-probe");
const PDFJS = "/node_modules/pdfjs-dist/legacy/build";

/** The four custom properties the tool writes on :root. */
const VARS = ["--be-full-filter", "--be-decoration-filter", "--be-hue-filter", "--be-inv-hue-filter"];

/** The post-fix state written BY HAND, to measure the rule that was NOT taken (see the header). */
const ALL_DEFAULTS_NONE = {
  "--be-full-filter": "none",
  "--be-decoration-filter": "none",
  "--be-hue-filter": "none",
  "--be-inv-hue-filter": "none",
};

const FACTS_HTML = `<!doctype html><html><body><script type="module">
import * as pdfjs from '${PDFJS}/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.mjs';
window.__facts = async function (url) {
  const doc = await pdfjs.getDocument({ url }).promise;
  const out = { pages: doc.numPages, textOps: 0, imageOps: 0, pathOps: 0, chars: 0, perPage: [] };
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const o = await p.getOperatorList();
    let t = 0;
    for (const f of o.fnArray) {
      if (f === pdfjs.OPS.showText || f === pdfjs.OPS.showSpacedText) { out.textOps++; t++; }
      if (f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject) out.imageOps++;
      if (f === pdfjs.OPS.fill || f === pdfjs.OPS.stroke) out.pathOps++;
    }
    const txt = (await p.getTextContent()).items.map((x) => x.str).join("").replace(/\\s+/g, " ").trim();
    out.chars += txt.length;
    out.perPage.push({ page: i, textOps: t, chars: txt.length, head: txt.slice(0, 60) });
  }
  return out;
};
window.__factsReady = true;
</script></body></html>`;

describe("print filter identity probe — what the rasterisation fix decided (issue print_sheet_rasterised_20260911)", function () {
  this.timeout(1800000);
  let ctx, page, raster;
  const measured = {};

  before(async function () {
    if (!ENABLED) this.skip();
    fs.mkdirSync(WORK, { recursive: true });
    fs.mkdirSync(ART, { recursive: true });
    fs.writeFileSync(path.join(WORK, "facts.html"), FACTS_HTML);
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
    raster = await ctx.newPage();
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    if (!ENABLED) return;
    fs.writeFileSync(path.join(ART, "probe-measurements.json"), JSON.stringify(measured, null, 2));
    console.log(`\nwrote ${path.join(ART, "probe-measurements.json")}`);
  });

  /**
   * Count the operators in a produced PDF. This MUST run in the `raster` tab: the pdf.js driver page
   * replaces whatever is in the tab it loads in, and measuring from the SHEET's tab would navigate the
   * sheet away — which silently produces blank prints and empty slider queries for every case after it.
   */
  async function pdfFacts(pdfPath) {
    const { server, port } = await startStaticServer();
    try {
      await raster.goto(`http://127.0.0.1:${port}/temp/print-filter-probe/facts.html`, { waitUntil: "load" });
      await raster.waitForFunction(() => window.__factsReady, { timeout: 60000 });
      const rel = "/" + path.relative(EXT_ROOT, pdfPath).split(path.sep).join("/");
      return await raster.evaluate((u) => window.__facts(u), `http://127.0.0.1:${port}${rel}`);
    } finally {
      server.close();
    }
  }

  /** The four custom properties, and the filter each named element then computes. */
  async function readState() {
    return await page.evaluate((names) => {
      const s = document.documentElement.style;
      const computed = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).filter : "(absent)";
      };
      return {
        vars: Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n)])),
        computed: {
          ".print-section-container": computed(".print-section-container"),
          "img.be-shape-asset": computed("img.be-shape-asset"),
          "img:not(.be-shape-asset)": computed("img:not(.be-shape-asset)"),
        },
      };
    }, VARS);
  }

  /**
   * Write the four custom properties exactly where `applyGlobalFilters` writes them — inline, on
   * documentElement. NOT through a stylesheet: an inline custom property is what the product's own
   * writes are, and a `!important` rule in a later stylesheet does not win against one.
   */
  async function writeVars(vars) {
    await page.evaluate((v) => {
      for (const [k, val] of Object.entries(v)) document.documentElement.style.setProperty(k, val);
    }, vars);
  }

  /** Drive one of the panel's own filter sliders, the way a user does (a real `input` event). */
  async function driveSlider(label, value) {
    const out = await page.evaluate(
      ({ label, value }) => {
        const ranges = Array.from(document.querySelectorAll("#print-enhance-controls input[type=range]"));
        const el = ranges.find((r) => (r.parentElement ? r.parentElement.innerText.includes(label) : false));
        if (!el) return { ok: false, ranges: ranges.length };
        el.value = String(value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true, value: el.value };
      },
      { label, value },
    );
    assert.ok(
      out.ok,
      `precondition: the panel must have a "${label}" slider (${out.ranges} range inputs found) — a ` +
        "user's setting has to be driven THROUGH the product, not written into the CSS on its behalf",
    );
    return out;
  }

  /** Print the live sheet and measure the PDF the printer would receive. `vars` is written first. */
  async function printAndMeasure(label, vars) {
    if (vars) await writeVars(vars);
    const state = await readState();
    // PRECONDITION, and it is not decoration: a probe that measures a page with no sheet on it reports
    // a blank PDF as if it were the product's output. (This cost one run: the pdf.js driver page was
    // loading into the sheet's own tab, so every case after the first measured an empty document.)
    assert.ok(
      await page.evaluate(() => document.querySelectorAll(".print-section-container").length > 0),
      `precondition for "${label}": the sheet must still be on the page before printing it`,
    );
    const file = path.join(WORK, `${label}.pdf`);
    await page.pdf({ path: file, scale: 1, printBackground: false, displayHeaderFooter: false, preferCSSPageSize: true });
    const facts = await pdfFacts(file);
    const geo = await measurePdf(raster, {
      pdfPath: file,
      outDir: path.join(WORK, "pages", label),
      pixelRatio: 1,
      prefix: "page",
    });
    const row = {
      label,
      state,
      bytes: fs.statSync(file).size,
      pages: facts.pages,
      textOps: facts.textOps,
      imageOps: facts.imageOps,
      pathOps: facts.pathOps,
      chars: facts.chars,
      coverage: geo.pages.map((p) => p.coverage),
      maxChroma: geo.pages.map((p) => p.maxChroma),
      saturatedPx: geo.pages.map((p) => p.saturatedPx),
      head: facts.perPage.map((p) => p.head),
    };
    console.log(
      `\n== ${label}: bytes=${row.bytes} textOps=${row.textOps} imageOps=${row.imageOps} ` +
        `pathOps=${row.pathOps} chars=${row.chars}\n   coverage=${row.coverage.join("/")} ` +
        `maxChroma=${row.maxChroma.join("/")} saturatedPx=${row.saturatedPx.join("/")}`,
    );
    assert.ok(
      row.pages === 4 && row.bytes > 1000000,
      `"${label}" must be a real four-page sheet (got ${row.pages} pages, ${row.bytes} bytes) — a ` +
        "blank or truncated capture must never be recorded as a measurement",
    );
    measured[label] = row;
    return row;
  }

  it("the rule that shipped: the identity chains are `none` and the sheet's own type reaches the paper", async function () {
    const state = await readState();
    console.log("\n-- the REAL extension, after a real boot (shipped defaults) --\n" + JSON.stringify(state, null, 1));
    assert.strictEqual(state.vars["--be-hue-filter"], "none", "the identity hue chain must not be emitted");
    assert.strictEqual(state.vars["--be-inv-hue-filter"], "none", "…nor its inverse");
    assert.ok(
      state.vars["--be-decoration-filter"].includes("grayscale(100%)"),
      "the product's default greyscale is NOT an identity and must still be applied; got " +
        `"${state.vars["--be-decoration-filter"]}"`,
    );

    const row = await printAndMeasure("real-defaults");
    assert.ok(
      row.textOps > 0 && row.chars > 1000,
      `the printed sheet must carry its own TEXT: textOps=${row.textOps} chars=${row.chars}. If this ` +
        "fails, an identity filter chain is being emitted again (js/filters.js).",
    );
    assert.ok(row.pathOps > 1000, `the ornaments must be VECTOR: pathOps=${row.pathOps}`);
  });

  it("the rule that was REJECTED: all sliders at their defaults is not neutral, and it costs colour", async function () {
    // Substitute the hand-written post-fix state for the rejected reading, on the same sheet, in the
    // same session — the only way to say what that reading WOULD have put on the paper.
    const before = measured["real-defaults"];
    const row = await printAndMeasure("all-defaults-none", ALL_DEFAULTS_NONE);
    assert.ok(row.textOps > 0, "both rules restore the text layer — that is not what separates them");
    assert.ok(
      row.saturatedPx[0] > before.saturatedPx[0] * 3,
      `dropping the default grayscale(100%) un-greys the sheet: page-1 saturated pixels ` +
        `${before.saturatedPx[0]} -> ${row.saturatedPx[0]}. That is a behaviour change on screen and ` +
        "on paper, which is why the fix is decided per chain on provable identities.",
    );
  });

  it("a user's own setting still reaches the paper: Greyscale 0% through the panel's own slider", async function () {
    await driveSlider("Greyscale", 0);
    const row = await printAndMeasure("panel-greyscale-0");
    assert.ok(
      row.saturatedPx[0] > measured["real-defaults"].saturatedPx[0] * 3,
      `with Greyscale 0% the ornaments must be in colour: saturated pixels ` +
        `${measured["real-defaults"].saturatedPx[0]} -> ${row.saturatedPx[0]}`,
    );
    // The cross-check that makes the case above mean something: the user's own setting reproduces the
    // hand-written render, so the difference between the two rules IS the greyscale and nothing else.
    assert.strictEqual(
      row.saturatedPx.join("/"),
      measured["all-defaults-none"].saturatedPx.join("/"),
      "the panel's Greyscale 0% must reproduce the hand-written all-defaults-none render exactly " +
        `(got ${row.saturatedPx.join("/")} vs ${measured["all-defaults-none"].saturatedPx.join("/")})`,
    );
  });

  it("a real hue is emitted again rather than neutralised, and the defaults come back byte-identical", async function () {
    await driveSlider("Hue Shift", 90);
    const colour = await printAndMeasure("panel-hue-90");
    assert.strictEqual(
      colour.state.vars["--be-hue-filter"],
      "hue-rotate(90deg)",
      "a real hue must be emitted verbatim, or the fix would be silently disabling the user's filter",
    );
    assert.strictEqual(colour.state.vars["--be-inv-hue-filter"], "hue-rotate(-90deg)");
    assert.strictEqual(
      colour.state.computed[".print-section-container"],
      "hue-rotate(90deg)",
      "…and it must be the filter the container actually computes — a rasterised sheet is the price " +
        "of a real filter, and that price is stated rather than hidden (FIX_REPORT.md §5)",
    );
    console.log(
      `   (the sheet is rasterised again while a real hue is set: textOps=${colour.textOps}, ` +
        `chars=${colour.chars} — recorded, expected, and not a regression)`,
    );

    await driveSlider("Hue Shift", 0);
    await driveSlider("Greyscale", 100);
    const back = await printAndMeasure("panel-back-to-defaults");
    assert.strictEqual(
      back.bytes,
      measured["real-defaults"].bytes,
      "returning the sliders to their defaults must give the same file as a fresh boot",
    );
    assert.strictEqual(back.textOps, measured["real-defaults"].textOps);
  });
});
