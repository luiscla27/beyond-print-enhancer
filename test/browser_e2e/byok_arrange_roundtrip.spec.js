/**
 * Browser E2E — track byok_ai_layout_20260915, Phase 4: the arrange flow's apply round-trip in the
 * REAL page, with ZERO network.
 *
 * WHAT THE UNIT SUITE CANNOT CLAIM
 * -------------------------------
 * `test/unit/ai_arrange.test.js` proves the flow's control flow over a jsdom sheet: reject ⇒
 * byte-identical record, accept ⇒ the A/B/C undo triple. Three of its claims are properties of the
 * real page and cannot be made there at all:
 *
 *  1. the wiring loads. `js/ai_layout.js` and `js/ai_arrange.js` are injected by the worker's
 *     `chrome.scripting.executeScript` file list, so a module that throws at evaluation on a live
 *     sheet is invisible to every unit case (a top-level `chrome.*` touch, a CSP restriction, the
 *     injection order relative to `js/section_utils.js`). Case 1 reads the seams off the live world.
 *  2. the product's OWN Ctrl+Z path reverts an accepted patch. The unit suite calls `applyUndo()`;
 *     plan.md names that as the trap — "AC-3's claim is 'one undo click', so Phase 4's case must
 *     press the key or name in its title that it called the function instead". Case 4 presses
 *     `Control+z` at the keyboard and its title says so.
 *  3. the ghost preview is invisible to a live `scanLayout()` ON THE REAL SHEET, where the host page
 *     contributes dozens of nodes and the extension's own drag ghosts already occupy the transient
 *     selector (`js/layout_scan.js:35`). Case 3 reads the layout WHILE the preview is open.
 *
 * ZERO NETWORK — and why the stub goes where it goes
 * -------------------------------------------------
 * Phase 3's relay reaches the provider with ONE call: `fetch(target.url, …)` in the SERVICE WORKER's
 * global scope (`js/background.js:509`). Playwright's `page.route` covers page requests, not
 * service-worker fetches, so intercepting at the page would prove nothing about the worker. What
 * DOES reach that global is `serviceWorker.evaluate`, whose function body runs IN the worker:
 * replacing `self.fetch` there replaces the very binding the relay calls. The stub
 *   - records every URL/body it is handed (that record IS AC-4's wire claim, measured),
 *   - answers with the OpenAI-shaped JSON the case needs, and
 *   - is restored in `after()`, so a leaked stub cannot make a later spec in the same run a fiction.
 * The sentinel in case 1 proves the stub was reached at all: without that, "no network" would be
 * indistinguishable from "the flow never ran", which is how a vacuous green gets written.
 *
 * WHY `undoRead` AND NOT A NEW COMPARE (plan.md's Phase 0 box, still open at time of writing)
 * ------------------------------------------------------------------------------------------
 * Every layout observation below goes through the EXISTING vacuity-proof helper —
 * `contentCall(ctx, "undoRead")` at `_helpers/inject.js`, `{depth, label, hasOffer, state}` where
 * `state` is `JSON.stringify(await window.scanLayout())` minus `spell_cache` — the same one
 * `undo_stack_class_verification.spec.js` drives. AC-2's reject probe is that helper with the
 * equality direction FLIPPED plus a zero-save claim, which no case in the repo asserted before
 * this file. The two traps that box names are both taken: settles POLL the `beginMutation` /
 * `pushMutation` settle rather than sleeping a fixed 900 ms, and the undo is a keystroke.
 *
 * Run: npm run test:e2e:byokarrange
 */

"use strict";

const assert = require("assert");
const { bootPage, launchExtensionContext } = require("./_helpers/dom.js");
const { contentCall } = require("./_helpers/inject.js");

const EXT_ROOT = require("path").resolve(__dirname, "..", "..");

/** A key whose bytes are recognisable, so a leak anywhere in the record would be findable. */
const KEY = "sk-probe-material-0123456789abcdef";
/** Where the stored config should send a request, per `js/ai_layout.js`'s OpenAI adapter. */
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

describe("BYOK arrange — the apply round-trip in the real page, zero network (Phase 4)", function () {
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

  /**
   * Replace the worker's `fetch`, answering with `bodyText` (or the sentinel echo when it is
   * "__ECHO__"), and returning proof the binding was really swapped. `installed` is asserted by the
   * CALLER against a live request — a stub that silently never took would otherwise read as
   * "no network" while the flow dialed the real provider.
   */
  async function installFetchStub(bodyText) {
    const out = await worker().evaluate(async (body) => {
      if (!self.__byokProbe) self.__byokProbe = { calls: [], real: self.fetch, body: "", stub: null };
      // The ANSWER is read off the probe object at CALL time, not closed over: the first draft
      // captured `body` in the closure and installed the stub only once, so every case after the
      // first re-ran against case 1's patch (measured: five failures, all `envelope_empty`). The
      // original `fetch` is still held for `restoreFetch()`, and `stub` identity is what says
      // "this binding is ours".
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

  async function stubCalls() {
    return worker().evaluate(() =>
      JSON.parse(JSON.stringify((self.__byokProbe || {}).calls || [])),
    );
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

  /**
   * The patch AC-V1 photographs. The +24px form of `livePatch()` is correct for the functional
   * round-trip cases — it proves the record changes — but it is NOT photographable, and the first
   * round of this gate was scored on exactly that and failed G1/G5 ("frame 3 sheet geometry is
   * pixel-identical to frame 1"). MEASURED with `temp/scratch/p4v/diff_frames.py` on the frames that
   * run produced: before-vs-after differ over a bbox spanning x 5..710, y 13..454, and that whole
   * cloud is the modal backdrop's dimming ramp — the 24px displacement contributes a pixel band
   * smaller than the overlay's own gradient. A reviewer cannot see 24px, and asking it to is a
   * measurement question the visual scope explicitly blocks.
   *
   * So the visual run asks the page for a target it can actually show: a section with no tool
   * chrome over it, a destination at least 300px away that is inside the viewport AND clear of both
   * the fixed surfaces and the preview dialog's modelled footprint. That geometry is chosen by
   * `aiArrangeEvidenceTarget` in `_helpers/inject.js`, which is the same record-space→viewport
   * arithmetic `js/ai_arrange.js`'s ghost layer performs.
   */
  async function evidencePatch() {
    const t = await contentCall(ctx, "aiArrangeEvidenceTarget", [{ minDist: 300 }]);
    assert.ok(t.ok, "no section on the live sheet is both unobstructed and movable >=300px: " + JSON.stringify(t.why || t));
    return {
      id: t.id,
      hideId: t.hideId,
      hideBox: t.hideBox,
      from: t.from,
      to: t.to,
      dist: t.dist,
      viewport: t.viewport,
      patch: {
        // NO `width`: the validator's derived-width guard (`js/ai_layout.js`, GATE-3's D2) refuses a
        // width that is not one the record itself derives, and `collectSections` reports the MEASURED
        // box, not the stored string. The functional `livePatch()` moves `left`/`top` only for the
        // same reason, so a visual patch that wrote a width would be refused before any preview —
        // and "the ghost moved but the section didn't" is worse than no gate at all.
        moves: {
          [t.id]: {
            left: Math.round(t.to.left),
            top: Math.round(t.to.top),
          },
        },
        hide: t.hideId ? [t.hideId] : [],
      },
    };
  }

  /** The OpenAI-shaped envelope a real provider would have sent for this patch. */
  const envelope = (patch) =>
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(patch) } }] });

  /**
   * A patch the LIVE sheet can accept, aimed at a section that exists on it. The id is read through
   * the flow's own `collectSections` so a fixture can never name a node this sheet lacks — that
   * would turn the accept cases into `section_id_unknown` refusals and the reject case into a
   * duplicate of them. `+24px` is inside the sheet's clamp, an integer, and cannot collide with a
   * recorded inner width (asserted below, because the derived-width guard is real and would fire).
   */
  async function livePatch() {
    const info = await contentCall(ctx, "aiArrangeFirstSection", []);
    assert.ok(info.ok, "the live sheet exposes no arrangeable section: " + JSON.stringify(info));
    assert.ok(info.rowCount > 0, "collectSections returned no rows on the real page");
    assert.ok(
      !info.innerWidths || info.innerWidths.indexOf(String(info.left + 24)) === -1,
      "the chosen left collides with a recorded inner width: " + info.innerWidths,
    );
    return { moves: { [info.id]: { left: info.left + 24, top: info.top + 24 } }, hide: [] };
  }

  /** Poll the page for a layout state that differs (or matches) — never a fixed sleep. */
  async function readUntil(predicate, { timeout = 12000 } = {}) {
    const t0 = Date.now();
    let last = await contentCall(ctx, "undoRead", []);
    while (Date.now() - t0 < timeout) {
      if (predicate(last)) return last;
      await page.waitForTimeout(150);
      last = await contentCall(ctx, "undoRead", []);
    }
    return last;
  }

  const clearOverlays = () => contentCall(ctx, "aiArrangeProbe", [{ action: "clear" }]);
  /** Store provider+model only — which honestly leaves `keyPresent` false (`js/ai_settings.js:313`). */
  const settingsOnly = () => contentCall(ctx, "aiArrangeProbe", [{ action: "settings" }]);
  /** Store a key through the module's own writer, WITHOUT running the flow. */
  const seedKey = () => contentCall(ctx, "aiArrangeProbe", [{ action: "seed", key: KEY }]);
  const unseed = () => contentCall(ctx, "aiArrangeProbe", [{ action: "unseed" }]);

  /** Run the flow to its preview (or its refusal) and answer it. One pair, used by every case. */
  async function runArrange(instruction, { accept }) {
    await clearOverlays();
    const started = await contentCall(ctx, "aiArrangeProbe", [
      { action: "start", key: KEY, instruction },
    ]);
    if (started.seen === "returned") {
      return { started, answered: started, out: started.out };
    }
    const answered = await contentCall(ctx, "aiArrangeProbe", [{ action: "answer", accept }]);
    return { started, answered, out: answered.out };
  }

  // -----------------------------------------------------------------------------------------
  // 1 — the wiring, and the one request it dials (proving the stub is what answered)
  // -----------------------------------------------------------------------------------------

  it("the flow is WIRED in the live page, and its single request is served by the worker stub — so nothing leaves the machine", async function () {
    const modules = await contentCall(ctx, "aiArrangeModuleRead", []);
    assert.strictEqual(modules.aiLayout, true, "window.AiLayout is not on the page");
    assert.strictEqual(modules.aiArrange, true, "window.AiArrange is not on the page");
    assert.strictEqual(modules.arrangeFn, "function", "arrangeWithAi is missing from the seam");
    assert.strictEqual(modules.surfaceFn, "function", "showAiArrangeSurface is missing from the seam");
    // The four seams AC-3 depends on must exist in THIS world, or the flow silently no-ops.
    for (const k of ["applyLayout", "beginMutation", "pushMutation", "handleSaveBrowser"]) {
      assert.strictEqual(modules[k], "function", "the live page has no window." + k);
    }
    assert.ok(Array.isArray(modules.mutationClasses) && modules.mutationClasses.includes("POSITION"));

    await settingsOnly();
    // An EMPTY patch: the flow must reach the validator and refuse it at the preview stage, which
    // exercises the whole wire (prompt → worker → stub → parse) without touching the sheet.
    await installFetchStub(envelope({ moves: {}, hide: [] }));
    const { started, out } = await runArrange("arrange nothing at all", { accept: false });
    assert.strictEqual(started.seen, "returned", "an empty patch opened a preview: " + JSON.stringify(started));
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.stage, "preview", "an empty patch was refused somewhere else: " + JSON.stringify(out));
    assert.strictEqual(out.code, "envelope_empty");

    const calls = await stubCalls();
    assert.strictEqual(calls.length, 1, "expected exactly one provider call, got " + JSON.stringify(calls.map((c) => c.url)));
    assert.strictEqual(calls[0].url, OPENAI_URL, "the stub was not reached at the provider URL: " + calls[0].url);
    // THE WIRE, measured: the body the worker assembled must carry the prompt and nothing secret.
    assert.ok(calls[0].body.length > 100, "the request body is empty — the stub saw a different call");
    assert.ok(calls[0].body.indexOf(KEY) === -1, "the credential reached the PROMPT body — it would have been sent to the model as context");
    assert.ok(!/"api_?key"/.test(calls[0].body), "a credential-shaped FIELD reached the request body");
    // AC-4 measured on the RIGHT surface. The claim is NOT "the key never leaves the browser":
    // BYOK means the user's own key goes to the user's own provider, and Phase 3's
    // `provider_origin_lock` is what limits WHERE. So the honest assertion is that the credential
    // appears in EXACTLY ONE place — the `Authorization` header — and that the origin it is sent to
    // is one `manifest.json` publishes. A test that demanded a header-free request would have
    // failed on correct code (measured: `"Authorization: Bearer sk-probe-material-…"`), which is
    // the wrong kind of green to chase.
    const headerDump = JSON.stringify(calls[0].headers);
    assert.strictEqual(
      headerDump.split(KEY).length - 1,
      1,
      "the credential appears in the headers exactly once (as the bearer token): " + headerDump,
    );
    assert.match(headerDump, new RegExp("Authorization: Bearer " + KEY), "the stored key was not attached to the provider request: " + headerDump);
    const hosted = JSON.parse(require("fs").readFileSync(require("path").join(EXT_ROOT, "manifest.json"), "utf8")).host_permissions;
    assert.ok(
      hosted.some((h) => calls[0].url.startsWith(h.replace(/\/\*.*$/, "").replace("://*", "://"))),
      "the request went to an origin the manifest does not publish: " + calls[0].url + " vs " + hosted.join(", "),
    );
    await unseed();
  });

  // -----------------------------------------------------------------------------------------
  // 2 — AC-2 in the browser: a rejected patch is byte-identical, and one reject class ≠ another
  // -----------------------------------------------------------------------------------------

  it("AC-2: a rejected patch leaves the live record byte-identical, gains no undo entry, saves nothing, and applies nothing", async function () {
    await settingsOnly();
    await installFetchStub(envelope({ moves: { "section-does-not-exist-here": { left: 5 } }, hide: [] }));
    await clearOverlays();
    await contentCall(ctx, "undoClear", []);
    const before = await contentCall(ctx, "undoRead", []);
    assert.ok(before.state, "the live layout must be readable — " + JSON.stringify(before));

    const { started, out } = await runArrange("rearrange everything", { accept: false });
    assert.strictEqual(out && out.ok, false, "a patch naming a nonexistent section was accepted: " + JSON.stringify(out));
    assert.strictEqual(out.code, "section_id_unknown", "wrong refusal code: " + JSON.stringify(out));
    assert.strictEqual(out.stage, "validate");
    assert.strictEqual(started.previewOpen, false, "a refusal opened a preview dialog");

    const after = await contentCall(ctx, "undoRead", []);
    assert.strictEqual(after.state, before.state, "the rejected patch changed the LIVE layout");
    assert.strictEqual(after.depth, before.depth, "the rejected patch pushed an undo entry");
    assert.strictEqual(started.applies, 0, "applyLayout ran for a rejected patch");
    assert.strictEqual(started.saves, 0, "a save ran for a rejected patch");
    assert.strictEqual(started.ghosts, 0, "a refusal left ghost nodes on the sheet");
    // The distinct-message half of AC-6, in the real toast system rather than a captured array.
    assert.ok(/section/i.test(started.toast), "no toast names the refusal: " + JSON.stringify(started.toast));
    assert.strictEqual((await stubCalls()).length, 1, "a refusal cost more than its one request");
    await unseed();
  });

  it("AC-2's other half: Cancel on a VALID patch touches nothing, and the ghosts are gone", async function () {
    await settingsOnly();
    const patch = await livePatch();
    await installFetchStub(envelope(patch));
    await clearOverlays();
    await contentCall(ctx, "undoClear", []);
    const before = await contentCall(ctx, "undoRead", []);

    const { started, answered, out } = await runArrange("nudge the first section", { accept: false });
    assert.strictEqual(started.seen, "preview", "a valid patch never opened a preview: " + JSON.stringify(started));
    assert.strictEqual(started.ghosts >= 1, true, "the preview drew no ghost layer");
    assert.strictEqual(started.ghostBoxes >= 1, true, "the ghost layer was empty — a vacuous invisibility claim");
    assert.strictEqual(out.stage, "cancelled", "Cancel reported " + JSON.stringify(out));

    const after = await contentCall(ctx, "undoRead", []);
    assert.strictEqual(after.state, before.state, "Cancel touched the live layout");
    assert.strictEqual(after.depth, before.depth, "Cancel pushed an undo entry");
    assert.strictEqual(answered.applies, 0, "Cancel applied the patch");
    assert.strictEqual(answered.saves, 0, "Cancel saved");
    assert.strictEqual(answered.ghosts, 0, "the ghost layer survived the cancel");
    await unseed();
  });

  // -----------------------------------------------------------------------------------------
  // 3 — the preview is invisible to a LIVE scan, mid-flight
  // -----------------------------------------------------------------------------------------

  it("the ghost preview is INVISIBLE to a live scanLayout: the layout is read while the overlay is on screen", async function () {
    await settingsOnly();
    const patch = await livePatch();
    await installFetchStub(envelope(patch));
    await clearOverlays();
    await contentCall(ctx, "undoClear", []);
    const before = await contentCall(ctx, "undoRead", []);

    const started = await contentCall(ctx, "aiArrangeProbe", [
      { action: "start", key: KEY, instruction: "nudge the first section" },
    ]);
    assert.strictEqual(started.seen, "preview", "no preview to read through: " + JSON.stringify(started));
    assert.ok(started.previewOpen, "the preview's Accept button is not in the DOM");
    // THE READ — the whole point of the case: `scanLayout()` runs with the ghosts mounted.
    const during = await contentCall(ctx, "undoRead", []);
    assert.strictEqual(during.state, before.state, "the ghosts were scanned as layout while the preview was open");

    // …and the busy marker is gone by the time the dialog is up, so the two cannot stack.
    const busy = await contentCall(ctx, "aiArrangeProbe", [{ action: "clear" }]).then(() =>
      page.evaluate(() => document.querySelectorAll(".be-ai-busy").length),
    );
    assert.strictEqual(busy, 0, "the busy marker outlived the request");
    await unseed();
  });

  // -----------------------------------------------------------------------------------------
  // 4 — AC-3 in the browser: accept, apply, ONE real Ctrl+Z, restored
  // -----------------------------------------------------------------------------------------

  it("AC-3: an accepted patch applies once, saves once, and ONE real Ctrl+Z keystroke restores the pre-AI layout byte for byte", async function () {
    await settingsOnly();
    const patch = await livePatch();
    await installFetchStub(envelope(patch));
    await clearOverlays();
    await contentCall(ctx, "undoClear", []);

    const A = await contentCall(ctx, "undoRead", []);
    assert.ok(A.state, "the live layout must be readable before the ask — " + JSON.stringify(A));

    const { started, answered, out } = await runArrange("nudge the first section", { accept: true });
    assert.strictEqual(out && out.ok, true, "the valid patch was refused in the real page: " + JSON.stringify(out));
    assert.strictEqual(out.stage, "applied");
    assert.strictEqual(started.ghosts >= 1, true, "the patch was applied without ever being previewed");

    // B — poll for the entry rather than sleeping: the record is repaired from an async capture.
    const B = await readUntil((r) => r.depth > A.depth && r.state !== A.state);
    // 1. A != B — the mutation must CHANGE the layout, or the round trip below is vacuous.
    assert.notStrictEqual(B.state, A.state, "the accepted patch did not change the live layout");
    assert.ok(B.depth > A.depth, "no undo entry was pushed (depth " + A.depth + " -> " + B.depth + ")");
    assert.ok(B.label, "the record must name what it will undo");
    assert.match(String(B.label), /AI arrange/i, "the undo label does not name the gesture: " + B.label);
    assert.strictEqual(answered.applies, 1, "applyLayout ran " + answered.applies + " times for one accepted patch");
    assert.strictEqual(answered.saves, 1, "an accepted patch must save exactly once, got " + answered.saves);

    // C — ONE keystroke, through the product's own AC-8 binding (`js/undo.js:257`). The page must
    // have focus for a key event to reach it, and no text field may hold focus: the binding is
    // deliberately inert in a text entry (`isTextEntryTarget`), which is the other half of why
    // pressing the key rather than calling the function is the claim worth making.
    await clearOverlays();
    await page.bringToFront();
    await page.evaluate(() => {
      const a = document.activeElement;
      if (a && typeof a.blur === "function") a.blur();
    });
    await page.keyboard.press("Control+z");

    const C = await readUntil((r) => r.state === A.state);
    // 2. A == C, then 3. B != C — in that order, so a test comparing a snapshot to itself fails.
    assert.strictEqual(C.state, A.state, "one Ctrl+Z did not restore the pre-AI layout");
    assert.notStrictEqual(JSON.stringify(B), JSON.stringify(C), "B and C are the same string — the classic self-compare");
    assert.strictEqual(C.depth, A.depth, "the undo left an entry behind");
    assert.strictEqual(answered.ghosts, 0, "the preview's ghosts survived the apply");

    // AC-4's persistence half against the record the product WROTE: `handleSaveBrowser` ran for
    // real, so this is the actual store, not a fixture's idea of one.
    const stored = await contentCall(ctx, "aiLayoutRecordRead", []);
    assert.ok(stored.stored, "the layout store had nothing for this sheet — the save did not land");
    assert.ok(stored.stored.indexOf(KEY) === -1, "the credential reached a saved layout record");
    assert.ok(!/api_?key/i.test(stored.stored), "a credential-shaped field is in the saved layout record");
    await unseed();
  });

  // -----------------------------------------------------------------------------------------
  // 5 — O-2 in the real panel: the control's state comes from the store
  // -----------------------------------------------------------------------------------------

  it("O-2: the AI Arrange row is present and DISABLED with no key, its click dials nothing, and storing a key enables it without a reload", async function () {
    await unseed();
    await installFetchStub("__ECHO__");
    await clearOverlays();

    const state = await contentCall(ctx, "aiArrangePanelRead", []);
    assert.ok(state.rowExists, "the panel has no #be-btn-ai-arrange row");
    assert.strictEqual(state.disabled, true, "the row is enabled with no stored key");
    assert.match(String(state.title), /key/i, "a disabled row with no reason is a dead button: " + state.title);
    assert.match(String(state.ariaLabel), /key/i, "the reason must be announced, not only shown: " + state.ariaLabel);
    assert.strictEqual(state.settingsEnabled, true, "the row that ADDS the key is disabled too — a dead end");

    const clicked = await contentCall(ctx, "aiArrangePanelClick", []);
    assert.strictEqual((await stubCalls()).length, 0, "a click reached the provider with no stored key");
    // A real browser does not fire a click on a disabled button, so no dialog may have opened.
    assert.strictEqual(clicked.promptOpen, false, "the disabled row still opened the prompt surface");

    await seedKey();
    let enabled = false;
    for (let i = 0; i < 30 && !enabled; i += 1) {
      enabled = (await contentCall(ctx, "aiArrangePanelRead", [])).disabled === false;
      if (!enabled) await page.waitForTimeout(150);
    }
    assert.ok(enabled, "the row stayed disabled after a key was stored — the event does not reach the panel");
    const after = await contentCall(ctx, "aiArrangePanelRead", []);
    assert.ok(!/add your ai key/i.test(String(after.title)), "the tooltip still asks for a key: " + after.title);
    await unseed();
  });

  // -----------------------------------------------------------------------------------------
  // 6 — AC-V1's frames: the same arrangement, before / preview / after, on the real sheet
  // -----------------------------------------------------------------------------------------

  it("AC-V1 evidence: one real arrangement photographed before, with its ghosts, and after", async function () {
    const dir = process.env.BYOK_SHOTS_DIR || (EXT_ROOT + "/temp/visual_logs/byok_ai_layout_20260915");
    require("fs").mkdirSync(dir, { recursive: true });
    const clip = await page.evaluate(() => {
      const el = document.getElementById("print-layout-wrapper");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(1400, r.width), height: Math.min(1100, r.height) };
    });
    assert.ok(clip && clip.width > 200 && clip.height > 200, "the sheet has no clip box: " + JSON.stringify(clip));

    await settingsOnly();

    // G7 is a claim about the TOOL'S PANEL, which lives OUTSIDE the sheet clip
    // (`#print-layout-wrapper` starts at x 32.5 and the crop follows section geometry), so the strip
    // cannot carry it. Round 2 handled that honestly — the brief said NOT APPLICABLE-BY-FRAME rather
    // than guessing — but declining to judge is not the same as leaving it unphotographed. So the
    // panel gets its own frame, captured HERE, at the moment the criterion is about: `settingsOnly()`
    // has stored a provider and a model but NO key, which is precisely the O-2 state G7 names. After
    // the flow runs, a key IS stored and the row is legitimately enabled, so a later capture could
    // not be judged against G7 at all.
    const panelClip = await page.evaluate(() => {
      const el = document.getElementById("print-enhance-controls");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 };
    });
    assert.ok(panelClip, "the control panel is not on the live page, so G7 cannot be photographed");
    await page.screenshot({ path: dir + "/04-panel-nokey.png", clip: panelClip });
    const panelState = await page.evaluate(() => {
      const row = document.getElementById("be-btn-ai-arrange");
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return {
        disabled: row.disabled === true || row.getAttribute("aria-disabled") === "true",
        title: row.title,
        box: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      };
    });
    require("fs").writeFileSync(
      dir + "/acv1-panel-state.json",
      JSON.stringify({ panelState, captured: "after settingsOnly(), before any key was stored" }, null, 2),
    );
    assert.ok(panelState, "the AI arrange row is not in the panel on the live page");
    assert.strictEqual(panelState.disabled, true, "G7's frame would photograph an ENABLED row: " + JSON.stringify(panelState));

    const target = await evidencePatch();
    const patch = target.patch;
    await installFetchStub(envelope(patch));
    await clearOverlays();
    await contentCall(ctx, "undoClear", []);

    const before = await contentCall(ctx, "undoRead", []);
    await page.screenshot({ path: dir + "/01-before.png", clip });

    const started = await contentCall(ctx, "aiArrangeProbe", [
      { action: "start", key: KEY, instruction: "move the section far to the right" },
    ]);
    assert.strictEqual(started.seen, "preview", "no preview to photograph: " + JSON.stringify(started));
    // The dialog is dismissed by the screenshot? No — capture the sheet WITH the ghosts and the
    // dialog up: that is the state a user actually sees, and what a reviewer must judge.
    await page.screenshot({ path: dir + "/02-preview-ghosts.png", clip });
    const answered = await contentCall(ctx, "aiArrangeProbe", [{ action: "answer", accept: true }]);
    assert.strictEqual(answered.out && answered.out.ok, true, "the visual run needs a real apply: " + JSON.stringify(answered));

    const after = await readUntil((r) => r.state !== before.state);
    await page.screenshot({ path: dir + "/03-after.png", clip });
    assert.notStrictEqual(after.state, before.state, "the arrangement did not change the sheet — the collage would be vacuous");
    assert.ok(!/sk-/.test(after.state), "the credential appears in the live layout record");

    // THE GEOMETRY THE BRIEF WILL CLAIM, measured rather than asserted. A visual gate that
    // describes a displacement it never measured is how round 1 came to certify "+24px" as
    // something a reviewer should see. This file is what the brief is written from.
    const geom = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const wrap = document.getElementById("print-layout-wrapper");
      if (!el || !wrap) return null;
      const r = el.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      return { id, left: Math.round(r.x - w.x), top: Math.round(r.y - w.y), width: Math.round(r.width), height: Math.round(r.height) };
    }, target.id);
    require("fs").writeFileSync(
      dir + "/acv1-geometry.json",
      JSON.stringify(
        {
          captured_at: new Date().toISOString(),
          section: target.id,
          hidden_section: target.hideId,
          proposed_from: { left: target.from.left, top: target.from.top },
          proposed_to: { left: target.to.left, top: target.to.top },
          travel_px: target.dist,
          hidden_box: target.hideBox,
          viewport: target.viewport,
          clip,
          live_box_after_apply: geom,
          record_before_sha: before.state.slice(0, 16),
          record_after_sha: after.state.slice(0, 16),
        },
        null,
        2,
      ),
    );
    // The move is REAL in the record, and the frame is the same subject: without these two the
    // strip could be a before/after of two different things and still look fine.
    assert.ok(geom, "the photographed section vanished from the live DOM: " + target.id);
    assert.strictEqual(geom.id, target.id);
    assert.ok(
      Math.abs(geom.left - target.to.left) <= 2 && Math.abs(geom.top - target.to.top) <= 2,
      "the applied position is not the photographed one: " + JSON.stringify({ geom, to: target.to }),
    );
    assert.ok(
      target.dist >= 300,
      "the travel is too small to photograph, which is exactly how G1/G5 failed round 1: " + target.dist,
    );

    await clearOverlays();
    await restoreFetch();
    await unseed();
    console.log(
      "  [AC-V1] frames: " + dir + "/01-before.png, 02-preview-ghosts.png, 03-after.png" +
        " (section " + target.id + " travels " + target.dist + "px)",
    );
  });
});
