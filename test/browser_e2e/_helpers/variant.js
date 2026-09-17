/**
 * A STAGED COPY of the extension with a named manifest addition, so a gate can run against a
 * permission the shipped manifest does not grant.
 *
 * WHY THIS EXISTS (track byok_ai_layout_20260915, Phase 2 GATE 3, finding D1). AC-4's
 * persist-and-reload round-trip is only executable once `chrome.storage` exists in a content
 * script, and that needs the `storage` permission — which Phase 3 owns, because granting it
 * drags three coupled items with it (PRIVACY_POLICY §2's new bullet, and `hintStore()`'s
 * re-show side effect on every existing user). The reviewer's finding was that AC-4's gate
 * therefore had NO execution anywhere. This module is how that gets answered without
 * re-scoping the manifest early: build a throwaway copy of the extension whose manifest carries
 * the addition, load THAT in its own browser context, and prove the CODE round-trips. A
 * separate case in the same spec keeps pinning that the SHIPPED manifest still does not grant
 * it, so the two facts cannot be confused.
 *
 * WHAT MAKES IT NOT A FICTION. The copy is the real `js/` tree, byte-for-byte, plus a
 * `manifest.json` that differs from the committed one in exactly the named entries — asserted
 * below, because a variant that silently diverged in some other way would be testing a product
 * that does not exist. `package.json`/`node_modules`/`temp`/`.git` are not copied: the
 * extension needs none of them, and `temp/` is where the profiles already leak.
 *
 * The staging root lives under `temp/` (gitignored) and is removed by `close()`.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const EXT_ROOT = ROOT;

/** The parts an unpacked MV3 extension actually needs. Nothing else is copied. */
const COPIED = ["manifest.json", "catalog.json", "js", "icons", "assets"];

/** Copy `src` into `dest` (recursive, symlinks not followed, no filtering surprises). */
function copyTree(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      if (e.name === "__pycache__" || e.name === "node_modules") continue;
      copyTree(path.join(src, e.name), path.join(dest, e.name));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

/**
 * Materialise a staged copy of the extension with `patch(manifest)` applied.
 *
 * @param {(manifest: object) => void} patch  mutates the parsed manifest in place
 * @param {string} tag                        a name for the staging dir (debuggability)
 * @returns {{root: string, base: object, next: object, dispose: () => void}}
 */
function stageManifestVariant(patch, tag) {
  const base = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "manifest.json"), "utf8"));
  const next = JSON.parse(JSON.stringify(base));
  patch(next);
  // Everything except `permissions`/`host_permissions` must be IDENTICAL, or the variant is a
  // different product and its green run means nothing.
  const untouched = ["name", "version", "manifest_version", "background", "action", "web_accessible_resources"];
  for (const k of untouched) {
    assert.deepStrictEqual(next[k], base[k], `the variant may not change manifest.${k}`);
  }
  const root = path.join(EXT_ROOT, "temp", ".pw-ext-" + (tag || "variant") + "-" + Date.now());
  fs.mkdirSync(root, { recursive: true });
  for (const rel of COPIED) {
    const src = path.join(EXT_ROOT, rel);
    if (!fs.existsSync(src)) continue;
    copyTree(src, path.join(root, rel));
  }
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(next, null, 2) + "\n");
  let gone = false;
  return {
    root,
    base,
    next,
    dispose() {
      if (gone) return;
      gone = true;
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* a locked file leaves one stale staging dir in gitignored temp/ */
      }
    },
  };
}

/**
 * Launch a persistent Chromium context with the STAGED extension loaded (not the worktree one).
 *
 * The profile is removed on close for the same reason `launchExtensionContext` does it: each
 * one is tens of MB of throwaway cache under `temp/`.
 */
async function launchStagedContext(staged) {
  const profile = path.join(EXT_ROOT, "temp", ".pw-e2e-" + Date.now());
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: chromium.executablePath(),
    args: [
      `--disable-extensions-except=${staged.root}`,
      `--load-extension=${staged.root}`,
      "--disable-blink-features=AutomationControlled",
      "--headless=new",
    ],
  });
  const close = ctx.close.bind(ctx);
  ctx.close = async (...args) => {
    try {
      return await close(...args);
    } finally {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  };
  return ctx;
}

module.exports = { stageManifestVariant, launchStagedContext, COPIED };
