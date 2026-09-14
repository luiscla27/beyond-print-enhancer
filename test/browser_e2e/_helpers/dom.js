/**
 * The page-side half of the browser-e2e harness (track refactor_surface_20260911, Phase 6, AC-6).
 *
 * The split is BY ROLE and its own precondition was that it be mechanical — so this file holds only
 * what the previous single `_helpers.js` already had, moved verbatim:
 *   * the demo URL, the readiness selector and the injected-file list (parsed from
 *     `js/background.js`, so the harness follows the extension rather than a second copy of it);
 *   * `launchExtensionContext()` — the persistent Chromium context with the unpacked extension;
 *   * `bootPage()` — navigate, dismiss consent, inject, wait for the enhancer's chrome;
 *   * `domClick()` — a real click.
 *
 * The STRINGIFIED in-page functions live in `./.._helpers/inject.js` instead: they are a different
 * kind of asset (real function objects, because MV3's CSP forbids rebuilding them from source) and
 * they are the part that grows without bound.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// The harness directory moved one level down (`_helpers/`), so the repo root is THREE levels up.
const EXT_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEMO_URL = "https://www.dndbeyond.com/characters/151911403";
const READY_SELECTOR =
  "#print-layout-wrapper, #print-enhance-sections-layer, #print-enhance-shapes-layer";

function productionInjectFiles() {
  const bg = fs.readFileSync(path.join(EXT_ROOT, "js", "background.js"), "utf8");
  const m = /files:\s*\[([\s\S]*?)\]/.exec(bg);
  if (!m) throw new Error("Could not parse files array from js/background.js");
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
}
const FILES = productionInjectFiles();

/** Launch one persistent Chromium context with the extension loaded. */
async function launchExtensionContext() {
  const profile = path.join(EXT_ROOT, "temp", ".pw-e2e-" + Date.now());
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: chromium.executablePath(),
    args: [
      `--disable-extensions-except=${EXT_ROOT}`,
      `--load-extension=${EXT_ROOT}`,
      "--disable-blink-features=AutomationControlled",
      "--headless=new",
    ],
  });
  // A persistent context needs a real user-data dir, and each one is ~48MB of
  // throwaway Chromium cache. NOTHING removed them, so temp/ had accumulated 270
  // of them (~13GB) by the time this was measured — a leak that every e2e run
  // made worse. The dir is released when the context closes, which every spec
  // already does in its `after` hook. Best-effort: a crashed run may leave one
  // behind (locked files on Windows), and that is preferable to throwing in a
  // teardown. The path stays gitignored (temp/.pw-e2e-*/) either way.
  const close = ctx.close.bind(ctx);
  ctx.close = async (...args) => {
    try {
      return await close(...args);
    } finally {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {
        /* a locked file just leaves one stale profile dir behind */
      }
    }
  };
  return ctx;
}

/**
 * The page errors the DEMO HOST's own network is allowed to produce while a page is booting.
 *
 * WHY THIS EXISTS (ISSUE_browser_e2e_gate_drift_20260912, F2). `bootPage` treated every page
 * error as a product error. The live demo sheet (`dndbeyond.com`) makes its own third-party
 * requests and they fail intermittently — reproduced in this session, verbatim:
 * `AssertionError: page errors during boot: Failed to fetch`. Nothing in the run distinguished
 * extension-originated errors from the page's own, so ONE slow host fetch cost a whole spec
 * file's cases, in a MOVING set — which is what made the failure set look like dozens of
 * unrelated product defects.
 *
 * "Make it green by ignoring everything" would be worse than a red gate, so the tolerance is
 * narrow on four axes, each of which is checkable rather than asserted:
 *
 *   1. CLASS — only a NETWORK failure, as a named list (below), not a pattern that grows. A
 *      TypeError, ReferenceError, syntax error or anything else still fails the boot.
 *   2. AUTHOR — an UNHANDLED `Failed to fetch` cannot be the extension's. Every `fetch` in
 *      `js/` is rejection-guarded (measured: 3 call sites — `js/background.js` `.catch(`,
 *      `js/catalog_service.js` x2 inside `try`), and that invariant is pinned by
 *      `test/unit/browser_harness_boot_tolerance.test.js`, so a future unguarded fetch turns
 *      this tolerance into a test failure instead of a silent mask.
 *   3. BOOT OUTCOME — the readiness gates (`READY_SELECTOR` + the action-bar count) have
 *      already passed by the time this runs, so a tolerated message cannot hide a boot that
 *      did not actually bring the enhancer up.
 *   4. COUNT — at most `MAX_HOST_ERRORS`. More than a couple means the host is not merely
 *      flaky, and the boot fails.
 *
 * It is MARKED rather than swallowed: the tolerated messages are left on the returned page
 * (`page.__bootHostErrors`) and PRINTED, so residual flakiness stays visible and countable in
 * the run output. Phase is recorded too, because it is the diagnostic that matters: the one
 * occurrence measured this session (1 boot in 19) arrived BEFORE injection — in the phase
 * where the extension has not run a single line on the page. A tolerated entry tagged `[live]`
 * would be a different story, and the marker says so.
 */
const HOST_NETWORK_ERROR = [
  /^Failed to fetch$/, // Chromium — the measured one
  /^Load failed$/, // WebKit
  /^NetworkError when attempting to fetch resource\.?$/, // Firefox
  /^net::ERR_[A-Z_]+/, // Chromium network-stack failures
];
const MAX_HOST_ERRORS = 3;

const isHostNetworkError = (message) =>
  HOST_NETWORK_ERROR.some((re) => re.test(message));

/**
 * The boot-error policy, as a PURE function so it can be unit-tested without a browser
 * (`test/unit/browser_harness_boot_tolerance.test.js`). Splits the page errors collected during
 * one boot into the tolerated host-network ones and the FATAL rest.
 *
 * @param {{message: string, phase: string}[]} pageErrors
 * @returns {{tolerated: object[], fatal: object[]}}
 */
function classifyBootErrors(pageErrors) {
  return {
    tolerated: pageErrors.filter((e) => isHostNetworkError(e.message)),
    fatal: pageErrors.filter((e) => !isHostNetworkError(e.message)),
  };
}

/**
 * Open a fresh tab in `ctx`, navigate to the demo sheet, dismiss the consent
 * banner, inject the extension, and wait until the enhancer has laid out the
 * action bars. Fails on any page error — except the host's own network failures
 * documented above.
 */
async function bootPage(ctx) {
  const page = await ctx.newPage();
  const pageErrors = []; // { message, phase }
  page.on("pageerror", (e) => pageErrors.push({ message: e.message, phase }));
  page.on("dialog", (d) => d.accept().catch(() => {}));

  let phase = "host"; // no extension code is running on this page yet

  await page.goto(DEMO_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);

  // Dismiss the Ketch consent banner (its fixed backdrop intercepts clicks).
  await page
    .evaluate(() => {
      const bs = Array.from(document.querySelectorAll("#lanyard_root button"));
      const b = bs.find(
        (x) =>
          (x.textContent || "").trim() === "Accept All" ||
          (x.getAttribute("aria-label") || "").includes("Accept All"),
      );
      if (b) b.click();
    })
    .catch(() => {});
  await page.waitForTimeout(1500);

  let sw = null;
  try {
    sw = await ctx.waitForEvent("serviceworker", { timeout: 20000 });
  } catch {
    const list = ctx.serviceWorkers();
    sw = list.find((w) => w.url().includes("background.js")) || list[0] || null;
  }
  if (!sw) throw new Error("Extension service worker not found");

  const inj = await sw.evaluate(
    async ({ files }) => {
      const tabs = await chrome.tabs.query({});
      const tab =
        tabs
          .filter((t) => t.url && t.url.includes("dndbeyond.com/characters/"))
          .pop() || tabs[0];
      if (!tab) return { ok: false, error: "no tab" };
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
      return { ok: true };
    },
    { files: FILES },
  );
  assert.ok(inj && inj.ok, "extension injection failed: " + JSON.stringify(inj));

  phase = "live"; // from here on the extension's own code runs on this page

  await page.waitForSelector(READY_SELECTOR, { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".be-more-options-button").length > 0,
    { timeout: 60000 },
  );
  await page.waitForTimeout(2500);

  const { tolerated, fatal } = classifyBootErrors(pageErrors);
  assert.deepStrictEqual(
    fatal.map((e) => `${e.message} [${e.phase}]`),
    [],
    "page errors during boot: " + pageErrors.map((e) => `${e.message} [${e.phase}]`).join(" | "),
  );
  assert.ok(
    tolerated.length <= MAX_HOST_ERRORS,
    `the demo host produced ${tolerated.length} network errors during boot ` +
      `(max ${MAX_HOST_ERRORS}) — that is not a flaky fetch, it is a broken host: ` +
      tolerated.map((e) => `${e.message} [${e.phase}]`).join(" | "),
  );
  if (tolerated.length) {
    // The MARKER. Deliberately loud: a boot that needed this would have failed before the
    // tolerance existed, and the gate is only honest if that stays countable. `[live]` entries
    // are the ones to look at — they arrived after the extension was injected.
    page.__bootHostErrors = tolerated.map((e) => ({ message: e.message, phase: e.phase }));
    console.log(
      `  [boot] tolerated ${tolerated.length} HOST network error(s) — ` +
        tolerated.map((e) => `${e.message} [${e.phase}]`).join(" | "),
    );
  }
  return page;
}

/**
 * Re-inject the extension into an ALREADY-LOADED page.
 *
 * WHY THIS EXISTS (track first_run_and_panel_20260911, Phase 1 GATE 3 defect D2). The extension is
 * not a page script: `chrome.action.onClicked` is what injects it, so after a RELOAD the page has
 * no panel, no styles and no listeners until the user clicks the toolbar icon again. A reload test
 * that expects the panel to still be there is testing a product that does not exist — measured:
 * after `page.reload()`, `panel: false`.
 *
 * So a reload test must reproduce the user's next action, which is exactly what this does: the same
 * `chrome.scripting.executeScript` over the same production file list that `bootPage` uses. It is
 * the harness's honest stand-in for "click the toolbar icon", and it exists so a reload path can be
 * asserted without inventing a second injection mechanism.
 */
async function reinject(ctx, page) {
  const sw =
    ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
    ctx.serviceWorkers()[0];
  if (!sw) throw new Error("reinject: no extension service worker");
  const inj = await sw.evaluate(
    async ({ files }) => {
      const tabs = await chrome.tabs.query({});
      const tab =
        tabs.filter((t) => t.url && t.url.includes("dndbeyond.com/characters/")).pop() ||
        tabs[0];
      if (!tab) return { ok: false, error: "no tab" };
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
      return { ok: true };
    },
    { files: FILES },
  );
  assert.ok(inj && inj.ok, "re-injection failed: " + JSON.stringify(inj));
  await page.waitForSelector(READY_SELECTOR, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return page;
}

/**
 * Synthetic click. Real pointer clicks can be swallowed by fixed page
 * overlays; an untrusted `el.click()` reliably reaches the element's own
 * listener (the enhancer does not gate on isTrusted).
 */
async function domClick(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("domClick: no element for " + sel);
    el.click();
  }, selector);
}

/**
 * Names of the probes the isolated-world injector understands. The
 * implementations live INSIDE the injector's own function body (see
 * `contentCall`): they must be real function objects, because the extension's
 * MV3 CSP forbids `eval`/`new Function` in the service worker, so a probe cannot
 * be rebuilt from source at call time.
 */

module.exports = {
  EXT_ROOT,
  DEMO_URL,
  READY_SELECTOR,
  FILES,
  launchExtensionContext,
  bootPage,
  reinject,
  domClick,
  // The boot-error policy, exported so its limits are unit-testable without a browser
  // (see `test/unit/browser_harness_boot_tolerance.test.js`).
  HOST_NETWORK_ERROR,
  MAX_HOST_ERRORS,
  isHostNetworkError,
  classifyBootErrors,
};
