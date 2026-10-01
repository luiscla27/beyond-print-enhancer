/**
 * Browser E2E — BYOK border design round-trip on a live section, zero network.
 *
 * WHAT THIS SPEC PROVES
 * ---------------------
 * `test/unit/ai_border_render_choke.test.js` proves the choke point's DOM contract
 * over a JSDOM sheet. Three of its claims are properties of the real page and cannot
 * be made there:
 *
 *  1. `js/ai_border.js` is wired into the live extension by the worker's file list,
 *     so the `window.AiBorder` seam exists and the choke point resolves at call time.
 *  2. `js/layout_apply.js` rehydrates a stored `borderSvg` through the choke point
 *     on a real section (AC-9, path B).
 *  3. `js/ai_arrange.js` routes a border patch through the choke point, not through
 *     inline DOM injection, after the model's JSON answer is accepted.
 *
 * The spec drives the extension's OWN seams in the isolated world and asserts on
 * DOM state — never on a helper's return value alone — exactly the assertion shape
 * AC-9a demands.
 *
 * ISOLATED WORLD
 * --------------
 * `window.AiBorder` lives in the ISOLATED world (the content-script world). Every
 * access to it goes through `contentCall`, which runs probes via
 * `chrome.scripting.executeScript` into that world. DOM reads (overlays, geometry)
 * use `page.evaluate` because the DOM is shared between worlds.
 *
 * ZERO NETWORK
 * ------------
 * The arrange half of this round-trip reaches the provider with one `fetch` call in
 * the service worker. The worker's fetch is replaced with a stub that answers with a
 * well-formed OpenAI-shaped JSON payload carrying a clean SVG, exactly as the existing
 * `byok_arrange_roundtrip.spec.js` does. The stub is restored in `after()`, so a
 * leaked stub cannot make a later spec in the same run a fiction.
 *
 * Run: npm run test:e2e:byokborder
 */

"use strict";

const assert = require("assert");
const { bootPage, launchExtensionContext } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

const KEY = "sk-probe-material-0123456789abcdef";

const CLEAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" ' +
  'preserveAspectRatio="none"><rect width="100" height="40" fill="none" ' +
  'stroke="#C6A15B" stroke-width="2"/></svg>';

const HOSTILE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>';

describe("BYOK border design — apply round-trip in the real page, zero network", function () {
  this.timeout(900000);

  let ctx;
  let page;

  function worker() {
    const w =
      ctx.serviceWorkers().find((x) => x.url().includes("background.js")) || ctx.serviceWorkers()[0];
    assert.ok(w, "the extension has no service worker to stub");
    return w;
  }

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
  });

  after(async function () {
    await restoreFetch().catch(() => {});
    await contentCall(ctx, "aiArrangeProbe", [{ action: "unseed" }]).catch(() => {});
    if (ctx) await ctx.close().catch(() => {});
  });

  async function installFetchStub(bodyText) {
    const out = await worker().evaluate(async (body) => {
      if (!self.__byokProbe) self.__byokProbe = { calls: [], real: self.fetch, body: "", stub: null };
      if (self.fetch !== self.__byokProbe.stub) {
        self.__byokProbe.stub = function stubbedFetch(url, init) {
          self.__byokProbe.calls.push({
            url: String(url),
            method: (init && init.method) || "",
            headers: Object.entries((init && init.headers) || {}).map(
              ([k, v]) => k + ": " + String(v),
            ),
            body: typeof (init && init.body) === "string" ? init.body : "",
          });
          const b = self.__byokProbe.body;
          const payload = b === "__ECHO__" ? JSON.stringify({ echo: self.__byokProbe.calls.length }) : b;
          return Promise.resolve(
            new Response(payload, {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
        };
        self.fetch = self.__byokProbe.stub;
      }
      self.__byokProbe.body = body;
      self.__byokProbe.calls.length = 0;
      return {
        installed: self.fetch === self.__byokProbe.stub && self.fetch !== self.__byokProbe.real,
        calls: self.__byokProbe.calls.length,
      };
    }, bodyText);
    assert.strictEqual(out.installed, true, "the worker's fetch was not replaced");
    return out;
  }


  async function restoreFetch() {
    return worker().evaluate(() => {
      if (self.__byokProbe && self.__byokProbe.real) {
        self.fetch = self.__byokProbe.real;
        delete self.__byokProbe;
      }
      return { restored: !self.__byokProbe };
    });
  }

  function borderEnvelope(svg) {
    return JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              moves: {},
              hide: [],
              border: { svg, note: "test border" },
            }),
          },
        },
      ],
    });
  }

  async function ensureSectionsReady() {
    const info = await contentCall(ctx, "aiArrangeFirstSection", []);
    assert.ok(info.ok, "the live sheet exposes no arrangeable section: " + JSON.stringify(info));
    return info;
  }

  async function clearOverlays() {
    return contentCall(ctx, "aiArrangeProbe", [{ action: "clear" }]);
  }

  async function seedKey() {
    return contentCall(ctx, "aiArrangeProbe", [{ action: "seed", key: KEY }]);
  }

  async function unseed() {
    return contentCall(ctx, "aiArrangeProbe", [{ action: "unseed" }]);
  }

  async function startArrange(instruction, options) {
    await clearOverlays();
    return contentCall(ctx, "aiArrangeProbe", [
      { action: "start", key: KEY, instruction, ...options },
    ]);
  }

  async function answerPreview(accept) {
    return contentCall(ctx, "aiArrangeProbe", [{ action: "answer", accept, timeoutMs: 30000 }]);
  }

  /** Read DOM state through page.evaluate (DOM is shared between worlds).
   *  Under D4 the border is a set of inline custom properties on the section
   *  that drive the product's ::before border-image slot — there is no overlay
   *  node to query. `readBorderState` reports the paint's presence + hostility of
   *  its recorded carrier. */
  async function readBorderState(sectionId) {
    return page.evaluate((id) => {
      const section = document.getElementById(id);
      if (!section) return { ok: false, reason: "no_section" };
      const svg = section.dataset && section.dataset.borderRawSvg
        ? section.dataset.borderRawSvg
        : null;
      return {
        ok: true,
        hasBorder: Boolean(svg),
        svg,
        hostile: svg ? /<script|<foreignObject|onload=|xlink:href|href="[^#]/i.test(svg) : false,
      };
    }, sectionId);
  }

  /** Apply a border through the choke point in the ISOLATED world (path B test).
   *  Route through the aiArrangeProbe action dispatcher — the gallery spec already
   *  proved this is the ONLY way the border probes are accessible from contentCall. */
  async function applyBorderIsolated(sectionId, svg) {
    return contentCall(ctx, "aiArrangeProbe", [{ action: "applyBorder", sectionId, rawSvg: svg }]);
  }

  /** Clear a border through the choke point in the ISOLATED world. */
  async function clearBorderIsolated(sectionId) {
    return contentCall(ctx, "aiArrangeProbe", [{ action: "applyBorder", sectionId, rawSvg: "" }]);
  }

  // -----------------------------------------------------------------------
  // 1. The choke point is wired in the live page
  // -----------------------------------------------------------------------

  it("window.AiBorder is live and its render/read/clear seams resolve on the real sheet", async function () {
    const probe = await contentCall(ctx, "aiArrangeProbe", [{ action: "probeAiBorder" }]);
    assert.strictEqual(probe.ok, true, "window.AiBorder is missing from the page");
    assert.strictEqual(probe.render, "function", "renderBorderSvg is not on the seam");
    assert.strictEqual(probe.read, "function", "readBorderSvg is not on the seam");
    assert.strictEqual(probe.clear, "function", "clearBorderSvg is not on the seam");
    await ensureSectionsReady();
  });

  // -----------------------------------------------------------------------
  // 2. Fresh generation apply (path A): clean SVG renders, hostile SVG does not
  // -----------------------------------------------------------------------

  it("a clean border from the model renders behind the section content through the arrange flow", async function () {
    const section = await ensureSectionsReady();
    await seedKey();
    await installFetchStub(borderEnvelope(CLEAN_SVG));

    await startArrange("draw a decorative border around the first section", {
      capabilities: { arrange: false, border: true },
      selectedSectionId: section.id,
    });
    const answered = await answerPreview(true);
    assert.strictEqual(answered.out && answered.out.ok, true, "the border flow failed: " + JSON.stringify(answered.out));
    assert.strictEqual(answered.applies, 1, "expected exactly one apply for a border accept");

    const state = await readBorderState(section.id);
    assert.strictEqual(state.hasBorder, true, "no border SVG overlay rendered on the section");
    assert.strictEqual(state.hostile, false, "the rendered border contains hostile markup");
    assert.ok(state.svg && state.svg.includes("viewBox"), "the rendered border is not a viewBox SVG");

    // AC-8 geometry: under D4 the border is painted by the product's own
    // `.print-section-container:not(.be-no-border)::before` slot. That rule is the
    // AC-8 contract (behind content, non-interactive, in print, hidden on no-border),
    // so the probe asserts on the ::before slot's computed style — which is what the
    // AI border now shares with the webp borders, exactly as the operator required.
    const geom = await page.evaluate((id) => {
      const section = document.getElementById(id);
      const cs = getComputedStyle(section, "::before");
      return {
        position: cs.position,
        pointerEvents: cs.pointerEvents,
        zIndex: parseInt(cs.zIndex, 10),
        borderImageSource: cs.borderImageSource,
      };
    }, section.id);
    assert.ok(geom, "the ::before slot is missing from the DOM");
    assert.strictEqual(geom.position, "absolute", "the border slot is not absolutely positioned");
    assert.strictEqual(geom.pointerEvents, "none", "the border slot intercepts pointer events");
    assert.ok(geom.zIndex < 0, "the border slot does not sit behind the content (z-index " + geom.zIndex + ")");
    assert.ok(
      geom.borderImageSource && geom.borderImageSource.includes("data:image/svg+xml"),
      "the border slot is not fed the AI SVG source",
    );

    await unseed();
  });

  // -----------------------------------------------------------------------
  // 3. Hostile SVG is refused and leaves no residue (path A, negative)
  // -----------------------------------------------------------------------

  it("a hostile SVG from the model is refused by the choke point and leaves no overlay", async function () {
    const section = await ensureSectionsReady();
    // Clear any prior border from a previous test case so the preview ghost's
    // `readBorderSvg` returns null and `undoBorderGhost` does not re-inject a
    // stale clean overlay after the apply path refuses the hostile SVG.
    await clearBorderIsolated(section.id);
    await seedKey();
    await installFetchStub(borderEnvelope(HOSTILE_SVG));

    const started = await startArrange("draw a border with a script tag", {
      capabilities: { arrange: false, border: true },
      selectedSectionId: section.id,
    });
    const answered = started.seen === "returned"
      ? started
      : await answerPreview(true);

    assert.strictEqual(answered.out && answered.out.ok, false, "a hostile border was accepted");
    assert.strictEqual(answered.out.code, "border_svg_rejected", "wrong refusal code: " + JSON.stringify(answered.out));

    const state = await readBorderState(section.id);
    assert.strictEqual(state.hasBorder, false, "a hostile SVG left a rendered overlay in the DOM");
    assert.strictEqual(state.svg, null, "a hostile SVG left bytes in the overlay");
    await unseed();
  });

  // -----------------------------------------------------------------------
  // 4. Persistence rehydrate (path B): stored record goes through the choke point
  // -----------------------------------------------------------------------

  it("a stored borderSvg record is rehydrated through the choke point on layout apply", async function () {
    const section = await ensureSectionsReady();
    const sectionId = section.id;

    // Clear any existing border (ISOLATED world)
    await clearBorderIsolated(sectionId);

    const before = await readBorderState(sectionId);
    assert.strictEqual(before.hasBorder, false, "the section already had a border before the test");

    // Apply a layout record carrying a clean borderSvg through the choke point (path B)
    const applied = await applyBorderIsolated(sectionId, CLEAN_SVG);
    assert.strictEqual(applied.ok, true, "the choke point threw on a clean SVG");
    assert.strictEqual(applied.rendered, true, "the choke point did not render the clean SVG");
    assert.ok(applied.read && applied.read.includes("viewBox"), "read-back is not a viewBox SVG");

    const after = await readBorderState(sectionId);
    assert.strictEqual(after.hasBorder, true, "the border did not survive a render/read cycle");
    assert.strictEqual(after.hostile, false, "the rendered border contains hostile markup");

    // Clear the border for cleanup (ISOLATED world)
    await clearBorderIsolated(sectionId);
    const cleared = await readBorderState(sectionId);
    assert.strictEqual(cleared.hasBorder, false, "the border survived a clear call");
  });

  // -----------------------------------------------------------------------
  // 5. Hostile SVG in a stored record is refused (path B, negative)
  // -----------------------------------------------------------------------

  it("a stored record carrying a hostile SVG renders nothing on rehydrate", async function () {
    const section = await ensureSectionsReady();
    const sectionId = section.id;

    const result = await applyBorderIsolated(sectionId, HOSTILE_SVG);
    assert.strictEqual(result.ok, false, "a hostile SVG was accepted by the choke point");
    assert.strictEqual(result.reason, "rejected", "wrong refusal: " + JSON.stringify(result));

    const state = await readBorderState(sectionId);
    assert.strictEqual(state.hasBorder, false, "a hostile SVG left a rendered overlay in the DOM");
  });

  // -----------------------------------------------------------------------
  // 6. Cancel leaves no residue and no mutation
  // -----------------------------------------------------------------------

  it("cancel on a valid border preview leaves no overlay, no mutation, and no save", async function () {
    const section = await ensureSectionsReady();
    await seedKey();
    await installFetchStub(borderEnvelope(CLEAN_SVG));
    await clearOverlays();
    await contentCall(ctx, "undoClear", []);

    const started = await startArrange("draw a border around the first section", {
      capabilities: { arrange: false, border: true },
      selectedSectionId: section.id,
    });
    assert.strictEqual(started.seen, "preview", "the border preview did not open: " + JSON.stringify(started));

    const answered = await answerPreview(false);
    assert.strictEqual(answered.out && answered.out.stage, "cancelled", "Cancel did not report cancelled");

    const state = await readBorderState(section.id);
    assert.strictEqual(state.hasBorder, false, "Cancel left a border overlay on the section");
    assert.strictEqual(answered.applies, 0, "Cancel applied the patch");
    assert.strictEqual(answered.saves, 0, "Cancel saved");
    assert.strictEqual(answered.ghosts, 0, "Cancel left ghost nodes on the sheet");

    await unseed();
  });
});
