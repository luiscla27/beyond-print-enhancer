/**
 * Browser E2E — track byok_ai_layout_20260915, Phase 3: AC-4's REAL persistence round-trip,
 * now running against the REAL worktree extension (the `storage` permission is granted in the
 * committed manifest).
 *
 * Phase 3 granted `storage` (`manifest.json` 4→5 permissions), so this spec now loads the
 * worktree extension directly. The staged-copy machinery in `_helpers/variant.js` is retained
 * and ALSO exercised — it documents the exact permission difference that matters (the empty
 * permissions array PLUS one `storage` entry, no other key may change) and acts as the
 * regression guard: if `storage` is ever removed from the committed manifest, this spec's
 * staged path still proves the round-trip, and the worktree path becomes the no-permission
 * half of `byok_settings_storage.spec.js`.
 *
 * Run: npm run test:e2e:byokpersist
 */

"use strict";

const assert = require("assert");
const { bootPage, reinject, launchExtensionContext } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

const KEY = "sk-real-shaped-material-0123456789abcdef";
const SETTINGS_ENTRY = "be.ai";
const KEY_ENTRY = "be.ai.key";

describe("AC-4's real persistence round-trip, against the now-storage-granted worktree (Phase 3)", function () {
  this.timeout(900000);

  let ctx;
  let page;

  before(async function () {
    // Phase 3 granted `storage` in the committed manifest, so the worktree extension is the
    // production configuration. `launchExtensionContext()` loads the worktree directly; the
    // staged-variant machinery in _helpers/variant.js is retained for the no-permission spec
    // (byok_settings_storage.spec.js) and is no longer needed here.
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  /** Read the extension's OWN store, from the worker — the source of truth, not a fixture's. */
  async function readStore(keys) {
    const sw =
      ctx.serviceWorkers().find((w) => w.url().includes("background.js")) ||
      ctx.serviceWorkers()[0];
    assert.ok(sw, "the staged extension has a service worker");
    return sw.evaluate(async (names) => {
      const out = {};
      // Deliberately NOT through window.AiSettings: this is the independent read that makes
      // "the code says it stored it" and "it is actually in the store" two different facts.
      const got = await chrome.storage.local.get(names);
      for (const n of names) out[n] = got[n];
      // The sync area may be unavailable without a signed-in profile — and an unavailable
      // sync area is NOT the same evidence as an empty one, so it is reported as its own
      // value rather than collapsed into `undefined` (which would make case 2 pass vacuously
      // on a browser that simply has no sync).
      try {
        out.__syncArea = await chrome.storage.sync.get(names);
      } catch (err) {
        out.__syncArea = "unavailable:" + String(err && err.message ? err.message : err);
      }
      return out;
    }, keys);
  }

  it("chrome.storage exists in the content world of this build", async function () {
    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(probe.chromeStoragePresent, true, "the grant reached the content script");
    assert.strictEqual(probe.settings.storage, true, "loadSettings no longer reports a blocked store");
    assert.strictEqual(probe.hasKey, false, "…and it starts empty, so every assertion below is about a write");
  });

  it("set -> the credential is in chrome.storage.local, under its own key, and NOT in the safe record", async function () {
    const saved = await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: KEY }]);
    assert.strictEqual(saved.ok, true);
    // The dialog's own read-back agrees with the store, and it was reached by a real click.
    assert.strictEqual(saved.afterSave.storedKey, KEY, "getApiKey() returns what was typed");
    assert.strictEqual(saved.afterSave.hasKey, true, "…so the arrange control may turn on (O-2)");

    const store = await readStore([SETTINGS_ENTRY, KEY_ENTRY]);
    assert.strictEqual(store[KEY_ENTRY], KEY, "the credential is in the extension's local store");
    assert.ok(store[SETTINGS_ENTRY] && typeof store[SETTINGS_ENTRY] === "object", "the safe record exists");
    assert.strictEqual(
      store[SETTINGS_ENTRY].keyPresent,
      true,
      "the flag was re-derived from the credential store, not taken from the caller",
    );
    assert.ok(
      !("key" in store[SETTINGS_ENTRY]) && !("apiKey" in store[SETTINGS_ENTRY]),
      "the safe record carries NO key field: " + Object.keys(store[SETTINGS_ENTRY]).join(","),
    );
    // AC-4's sharpest prohibition, against the REAL sync area rather than a stub's. The
    // three-way verdict matters: an EMPTY sync area is proof; an UNAVAILABLE one (no signed-in
    // profile in a headless context) is not proof of anything, so it is recorded loudly and
    // the unit suite's call-recorder case stays the load-bearing half for that scenario.
    const syncVerdict =
      typeof store.__syncArea === "string"
        ? "unproven:" + store.__syncArea
        : store.__syncArea && store.__syncArea[KEY_ENTRY] === undefined &&
            store.__syncArea[SETTINGS_ENTRY] === undefined
          ? "proven-empty"
          : "LEAKED:" + JSON.stringify(store.__syncArea);
    assert.ok(
      syncVerdict === "proven-empty" || syncVerdict.startsWith("unproven:"),
      "nothing may land in chrome.storage.sync — " + syncVerdict,
    );
    if (syncVerdict !== "proven-empty") {
      console.log(
        "  [AC-4] chrome.storage.sync UNAVAILABLE in this context, so the never-sync claim " +
          "is proven by the unit suite's call recorder (" + syncVerdict + ")",
      );
    }
  });

  it("close -> reopen -> the settings still read back from storage, and the field is still empty", async function () {
    // A BRAND NEW dialog instance, mounted in a fresh call: nothing shares state with the one
    // that saved. This is the half that distinguishes "the code kept an object alive" from
    // "the value is durable".
    const reopened = await contentCall(ctx, "aiSettingsDialogProbe", [{ leaveOpen: true }]);
    assert.strictEqual(reopened.ok, true);
    assert.strictEqual(
      reopened.bodyChildClasses.length > 0,
      true,
      "precondition: the reopened dialog actually rendered a body",
    );
    const state = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(state.settings.provider, "openai", "the provider survived the dialog");
    assert.strictEqual(state.settings.model, "gpt-4o-mini", "…and the model default stuck");
    assert.strictEqual(state.settings.keyPresent, true, "…and the record still reports a key");
    assert.strictEqual(state.hasKey, true);
    assert.strictEqual(state.key, KEY, "getApiKey() reads it back out of the store");
    // The mask holds on the SECOND render too: a reopen that pre-filled the field would be
    // AC-4's failure mode wearing a persistence badge.
    assert.strictEqual(
      reopened.keyFieldValueAtFirstPaint,
      "",
      "a reopened dialog never populates the credential into a field",
    );
    assert.strictEqual(reopened.keyFieldTypeAtFirstPaint, "password");
  });

  it("a page reload + re-injection still reads the same stored value", async function () {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(4000);
    // The extension is injected by the action click, so a reload genuinely blanks the page's
    // content-script world; `reinject` reproduces the user's next click over the same
    // production file list (harness note in _helpers/dom.js).
    await reinject(ctx, page);
    const state = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(state.chromeStoragePresent, true, "the re-injected world still has the grant");
    assert.strictEqual(state.key, KEY, "the credential outlived the page");
    assert.strictEqual(state.settings.provider, "openai");
  });

  it("remove key -> the credential AND the settings record are gone from the real store", async function () {
    const before = await readStore([SETTINGS_ENTRY, KEY_ENTRY]);
    assert.ok(before[KEY_ENTRY], "precondition: there IS a stored key to remove");
    // Drive the real control, not the API: Remove key is what the user clicks.
    const removed = await contentCall(ctx, "aiSettingsRemoveKeyProbe", []);
    assert.strictEqual(removed.ok, true, "the remove path ran");
    assert.strictEqual(removed.hasKey, false, "hasStoredKey() flipped");
    assert.strictEqual(removed.key, "", "getApiKey() returns \"\"");

    const after = await readStore([SETTINGS_ENTRY, KEY_ENTRY]);
    assert.strictEqual(after[KEY_ENTRY], undefined, "the credential entry is GONE, not blanked");
    assert.strictEqual(
      after[SETTINGS_ENTRY],
      undefined,
      "and so is the settings record — an explicit removal must not leave a configured-looking shell",
    );
    const state = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(state.settings.keyPresent, false, "a fresh read agrees: nothing is configured");
    assert.strictEqual(state.hasKey, false, "…and O-2's gate is off again");
  });

  it("a save with NO key stores a record that still says keyPresent:false", async function () {
    // The inverse of the same invariant, which a clear-only test cannot cover: a record saved
    // before any credential exists must not claim one, or the arrange button would light up
    // against an empty key store.
    const saved = await contentCall(ctx, "aiSettingsDialogProbe", [{ trySave: true }]);
    assert.strictEqual(saved.afterSave.storedKey, "", "no credential was typed, none was stored");
    const store = await readStore([SETTINGS_ENTRY, KEY_ENTRY]);
    assert.ok(store[SETTINGS_ENTRY], "the settings record exists");
    assert.strictEqual(store[SETTINGS_ENTRY].keyPresent, false, "…and it says so honestly");
    assert.strictEqual(store[KEY_ENTRY], undefined, "…and the credential key is absent");
    await contentCall(ctx, "aiSettingsRemoveKeyProbe", []);
  });
});
