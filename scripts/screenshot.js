#!/usr/bin/env node
/**
 * screenshot.js — Capture a D&D Beyond character sheet with the Beyond Print
 * Enhancer extension ACTIVE, using Playwright + Chromium.
 *
 * The extension (MV3) injects its content scripts only on a toolbar click
 * (chrome.action.onClicked -> chrome.scripting.executeScript). There is no
 * browser UI to click from Playwright, so this script replays that exact
 * injection from the extension's service worker instead.
 *
 * Usage:
 *   node scripts/screenshot.js <url> [options]
 *
 * Options:
 *   --out <path>          Output PNG path (default: shots/<slug>-<timestamp>.png)
 *   --viewport <WxH>      Viewport size (default: 1440x1600)
 *   --full-page           Capture the full scrollable page (default: true)
 *   --no-full-page        Capture only the viewport
 *   --wait-ms <ms>        Extra settle time after the enhancer is ready (default: 3000)
 *   --timeout-ms <ms>     Max wait for the enhancer UI to appear (default: 30000)
 *   --headless            Prefer headless (full chromium + --headless=new).
 *                         Defaults to headful (required for extensions in most setups);
 *                         falls back to headless automatically if headful fails.
 *   --profile <dir>       Chromium user-data dir (default: temp/.pw-profile, cleaned up)
 *   --keep-profile        Do not delete the user-data dir afterwards
 *   --verbose             Log milestones
 */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXT_ROOT = path.resolve(__dirname, '..'); // repo root holds manifest.json
// Single source of truth for module load order: js/background.js
// chrome.scripting.executeScript files array (kept in sync with the
// production content-script list — do NOT hard-code a parallel list here).
function productionInjectFiles() {
  const bg = fs.readFileSync(path.join(EXT_ROOT, 'js', 'background.js'), 'utf8');
  const m = /files:\s*\[([\s\S]*?)\]/.exec(bg);
  if (!m) throw new Error('Could not parse files array from js/background.js');
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
}
const INJECT_FILES = productionInjectFiles();
// Elements that appear once the enhancer has laid out the sheet.
const READY_SELECTOR = '#print-layout-wrapper, #print-enhance-sections-layer, #print-enhance-shapes-layer';

function parseArgs(argv) {
  const a = { url: null, out: null, viewport: [1440, 1600], fullPage: true, waitMs: 3000, timeoutMs: 30000, headless: false, profile: null, keepProfile: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--out') a.out = argv[++i];
    else if (v === '--viewport') {
      const m = /^(\d+)x(\d+)$/.exec(argv[++i]);
      if (!m) throw new Error('--viewport must be WxH, e.g. 1440x1600');
      a.viewport = [+m[1], +m[2]];
    } else if (v === '--full-page') a.fullPage = true;
    else if (v === '--no-full-page') a.fullPage = false;
    else if (v === '--wait-ms') a.waitMs = parseInt(argv[++i], 10);
    else if (v === '--timeout-ms') a.timeoutMs = parseInt(argv[++i], 10);
    else if (v === '--headless') a.headless = true;
    else if (v === '--profile') a.profile = argv[++i];
    else if (v === '--keep-profile') a.keepProfile = true;
    else if (v === '--verbose') a.verbose = true;
    else if (v.startsWith('-')) throw new Error('Unknown option: ' + v);
    else if (!a.url) a.url = v;
    else throw new Error('Unexpected argument: ' + v);
  }
  if (!a.url) throw new Error('Usage: node scripts/screenshot.js <url> [options]');
  return a;
}

function slugify(url) {
  const m = /characters\/([\w-]+)/.exec(url);
  return (m ? m[1] : url.replace(/^https?:\/\//, '').replace(/[^\w-]+/g, '_')).slice(0, 60);
}

const log = (a, ...msg) => { if (a.verbose) console.log('[shot]', ...msg); };

async function launchWithExtensions(a, profileDir) {
  const args = [
    `--disable-extensions-except=${EXT_ROOT}`,
    `--load-extension=${EXT_ROOT}`,
    '--disable-blink-features=AutomationControlled',
  ];
  const common = { viewport: { width: a.viewport[0], height: a.viewport[1] } };

  // Attempt 1: headful (extensions always supported).
  if (!a.headless) {
    try {
      const ctx = await chromium.launchPersistentContext(profileDir, { ...common, headless: false, args });
      log(a, 'headful launch OK');
      return ctx;
    } catch (e) {
      log(a, 'headful launch failed:', e.message.split('\n')[0], '— falling back to headless=new');
    }
  }
  // Attempt 2: full chromium in new-headless mode (supports extensions on modern builds).
  try {
    const exe = chromium.executablePath();
    const ctx = await chromium.launchPersistentContext(profileDir, {
      ...common, headless: true, executablePath: exe,
      args: [...args, '--headless=new'],
    });
    log(a, 'headless(new) launch OK with', exe);
    return ctx;
  } catch (e) {
    throw new Error('Could not launch Chromium with the extension loaded (tried headful and headless=new): ' + e.message.split('\n')[0]);
  }
}

async function injectExtension(ctx, url, a) {
  let sw = null;
  try {
    sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  } catch {
    const list = ctx.serviceWorkers();
    sw = list.find(w => w.url().includes('background.js')) || list[0] || null;
  }
  if (!sw) throw new Error('Extension service worker not found — is the extension really loaded?');
  log(a, 'service worker:', sw.url());

  const result = await sw.evaluate(async ({ files }) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => t.url && t.url.includes('dndbeyond.com/characters/')) || tabs.find(t => t.url && !t.url.startsWith('chrome')) || tabs[0];
    if (!tab) return { ok: false, error: 'no tab found', tabs: tabs.map(t => t.url) };
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    return { ok: true, tabId: tab.id, url: tab.url };
  }, { files: INJECT_FILES, targetUrl: url });
  log(a, 'injection result:', JSON.stringify(result));
  return result;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const profileDir = a.profile || path.join(EXT_ROOT, 'temp', '.pw-profile');
  if (!a.out) {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const dir = path.join(EXT_ROOT, 'shots');
    fs.mkdirSync(dir, { recursive: true });
    a.out = path.join(dir, `${slugify(a.url)}-${stamp}.png`);
  }
  fs.mkdirSync(path.dirname(a.out), { recursive: true });

  let ctx;
  try {
    ctx = await launchWithExtensions(a, profileDir);

    const page = ctx.pages()[0] || (await ctx.newPage());
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));

    log(a, 'navigating to', a.url);
    const resp = await page.goto(a.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    log(a, 'HTTP', resp && resp.status());

    const inj = await injectExtension(ctx, a.url, a);
    if (!inj || !inj.ok) throw new Error('Extension injection failed: ' + JSON.stringify(inj));

    let ready = false;
    try {
      await page.waitForSelector(READY_SELECTOR, { timeout: a.timeoutMs });
      ready = true;
    } catch {
      // Reported as a failure below (never silently succeed on a broken page).
    }
    if (a.waitMs > 0) await page.waitForTimeout(a.waitMs);

    await page.screenshot({ path: a.out, fullPage: a.fullPage });
    const kb = (fs.statSync(a.out).size / 1024).toFixed(0);
    console.log('SAVED ' + a.out + ' (' + kb + ' KB, enhancer-ready=' + ready + ')');

    // Fail loudly: a capture that never reached the enhancer-ready state or
    // that raised page errors is a broken run, not a green screenshot. Without
    // this, a stale injection list silently produced a stock-page PNG with
    // exit 0 (the pre-refactor hard-coded 7-file bug).
    const errs = [...new Set(pageErrors)];
    if (errs.length) console.log('page errors:', errs.slice(0, 10));
    if (errs.length) {
      console.error('FAILED: page errors detected during capture (' + errs.length + '): ' + errs.slice(0, 3).join(' | '));
      process.exitCode = 1;
    } else if (!ready) {
      console.error('FAILED: enhancer did not become ready (missing ' + READY_SELECTOR + ') within ' + a.timeoutMs + 'ms');
      process.exitCode = 1;
    }
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    if (!a.keepProfile && (!a.profile || a.profile.startsWith(path.join(EXT_ROOT, 'temp')))) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
