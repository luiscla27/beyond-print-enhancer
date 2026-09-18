/**
 * Browser E2E — track byok_ai_layout_20260915: the BYOK config store and its dialog, in the
 * REAL extension rather than a fixture. Phase 2 wrote this file; Phase 3's `storage` grant
 * flipped its central premise, so it now runs in TWO halves — one per manifest state — because
 * both facts are load-bearing and neither may be mistaken for the other.
 *
 * WHY THIS FILE EXISTS. AC-4 says the key is stored only in `chrome.storage.local`, never
 * synced, never inside a layout record, and never rendered unmasked. The unit suite covers all
 * four against a JSDOM window with a hand-built store — and a hand-built store can only prove
 * the code agrees with the store the test chose to give it. The spec that matters more asks what
 * the extension ACTUALLY has. Two of this track's known failure classes live at exactly that
 * seam:
 *
 *   1. `hintStore()` (`js/controls.js`) — that feature read `chrome.storage` and its test
 *      passed, because the suite had STUBBED an API production does not have, so the hint
 *      reappeared on every real boot. The comment at that site is the project's own record of
 *      what a stubbed store cost.
 *   2. The two-world problem — `page.evaluate` runs in the page's MAIN world while the enhancer
 *      is injected into the ISOLATED world, so `window.AiSettings` reads as `undefined` from
 *      there and an assertion written that way CANNOT fail. `contentCall`
 *      (`_helpers/inject.js`) exists precisely because of it, and every world-sensitive claim
 *      below goes through it.
 *
 * THE HALF THAT SHIPS (describe 1). Phase 3 granted `storage` — `manifest.json` now declares
 * five permissions — so `chrome.storage` IS defined in a content script, `loadSettings()`
 * reports `storage: true`, and a save persists. This half is the production path, and it owns
 * AC-4's runtime claims: the mask at first paint, the reveal toggle, the never-populated field,
 * the credential's absence from the layout record and from host storage, and the RECORDED
 * RESIDUAL below.
 *
 * THE HALF THAT NO LONGER SHIPS, AND WHY IT STILL RUNS (describe 2). AC-4's gate box names a
 * "no-permission path" as a required case. Before Phase 3 that was simply what the extension
 * did; now it is a configuration the shipped manifest cannot produce, so it runs against a
 * STAGED COPY whose manifest differs from the committed one by exactly the removal of
 * `storage` (see `_helpers/variant.js`, which asserts no other manifest key may change and
 * copies the real `js/` tree byte-for-byte). A user who revokes the permission, or a build that
 * loses the grant, gets that path — and the important half of the claim is not the message
 * string but that the dialog REFUSES TO LIE: it reports failure instead of showing "Saved".
 *
 * ONE RESIDUAL, MEASURED TWICE AND NARROWED RATHER THAN WIDENED. Content scripts share the
 * page's DOM and isolate only its JS globals, so a key the user is CURRENTLY TYPING is readable
 * from dndbeyond.com's own scripts while the dialog is open (MEASURED, Phase 2:
 * `{seesTheDialogMarkup: true, inputValueFromPageWorld: "sk-typed-by-user-material-…"}`).
 * Phase 3's re-measure narrowed it: after a SUCCESSFUL save the field is cleared, so the page
 * world reads `""` — the exposure window is "while typing, before the save lands", not
 * "whenever a key is configured". Both halves are asserted below as what they are: the residual
 * as a canary, and the clear-on-save as the mitigation. The defensible claim remains that the
 * credential never enters the page world AS DATA THIS EXTENSION WRITES THERE — no global, no
 * storage, no attribute, nothing persisted.
 *
 * Run: npm run test:e2e:byoksettings   (and npm run test:e2e:byokpersist for the round trip)
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");
const { stageManifestVariant, launchStagedContext } = require("./_helpers/variant.js");

/** Shaped like a real credential so a leak cannot hide behind a placeholder-looking value. */
const KEY_SHAPE = /sk-[A-Za-z0-9_-]{8,}/;
const PROBE_KEY = "sk-probe-material-0123456789abcdef";

/**
 * Start every case from a DOM with NO enhancer dialog in it. Without this the orphan-overlay
 * assertion below measures whatever the previous case happened to leave behind, which is an
 * order dependency, not a property of the dialog.
 */
async function assertNoStrayModals(ctx, page, where) {
  await contentCall(ctx, "closeOverlays", []);
  const left = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
  assert.strictEqual(left, 0, `clean-start premise broken at ${where}: ${left} overlay(s) already mounted`);
}

/** The extension's own store, cleared from the worker — the source of truth for "nothing stored". */
async function clearExtStore(ctx) {
  const sw = ctx.serviceWorkers().find((w) => w.url().includes("background.js"));
  assert.ok(sw, "the extension has a service worker");
  await sw.evaluate(async () => {
    await chrome.storage.local.remove(["be.ai", "be.ai.key"]);
  });
}

describe("BYOK store + dialog in the real extension, as the shipped manifest grants it (Phase 3)", function () {
  this.timeout(900000);

  let ctx;
  let page;

  before(async function () {
    ctx = await launchExtensionContext();
    page = await bootPage(ctx);
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
  });

  beforeEach(async function () {
    await assertNoStrayModals(ctx, page, this.currentTest.title);
    await clearExtStore(ctx);
  });

  it("js/ai_settings.js is injected, and the real permission set is the one this spec describes", async function () {
    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(probe.moduleType, "object", "window.AiSettings exists in the content world");
    assert.ok(Array.isArray(probe.keys) && probe.keys.length >= 14, "…with its full export table");
    for (const fn of ["loadSettings", "saveSettings", "getApiKey", "hasStoredKey", "showAiSettingsModal"]) {
      assert.ok(probe.keys.includes(fn), `${fn} is on the seam`);
    }

    // THE PREMISE OF EVERY CASE BELOW, asserted rather than assumed. Phase 3 granted `storage`
    // (manifest.json now declares 5 permissions), so `chrome.storage` IS defined in a content
    // script and `loadSettings()` reports `storage: true`. Flipping this back to `false` is not
    // a test edit — it means the grant was removed from the shipped manifest, and the
    // hintStore() read-through + PRIVACY_POLICY §2 that came with it would need re-reading.
    assert.strictEqual(
      probe.chromeStoragePresent,
      true,
      "manifest.json declares `storage`, so chrome.storage is defined in a content script. If " +
        "this ever comes back false: the grant was lost, and describe(2) below becomes the " +
        "production path — update this file's header and PRIVACY_POLICY §2 in the same change.",
    );
    assert.strictEqual(probe.settings.storage, true, "loadSettings reports the store is available");
    assert.strictEqual(probe.settings.provider, "", "…and degrades to an empty record, not a guess");
    assert.strictEqual(probe.hasKey, false, "hasStoredKey is false, so the arrange control stays off (O-2)");
    assert.strictEqual(probe.key, "", 'getApiKey returns "", and never a placeholder');
  });

  it("the real dialog is the shared shell, masked at first paint, and says nothing alarming", async function () {
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{}]);
    assert.strictEqual(probe.ok, true, "showAiSettingsModal returned a handle");
    assert.strictEqual(probe.title, "AI layout settings");
    assert.strictEqual(probe.role, "dialog", "it is the shared primitive, not a hand-rolled overlay");
    assert.strictEqual(probe.ariaModal, "true");
    assert.strictEqual(probe.accessibleName, "AI layout settings", "the title IS the accessible name");

    // AC-4's mask, read off the real DOM. `type` at FIRST PAINT is the load-bearing half:
    // flipping the attribute later still leaves the value in the a11y tree as plain text.
    assert.strictEqual(probe.keyFieldTypeAtFirstPaint, "password");
    assert.strictEqual(probe.keyFieldValueAtFirstPaint, "", "the dialog never populates the credential");

    // The store WORKS here, so the shell's message node must be EMPTY and unstyled. Phase 2
    // asserted the opposite (a blocked store, error-styled, VISIBLE — `display !== "none"`)
    // because that copy was the point of the dialog then. The claims that survive the grant are
    // these three: no error copy, no error styling, and no field marked invalid. The node's
    // `display` is deliberately NOT asserted — the shell leaves an empty message at its
    // stylesheet default, which is a cosmetic detail of `js/modals.js`, not an AC-4 property,
    // and pinning it here would make this case fail for someone else's layout change.
    assert.strictEqual(probe.message.text, "", "a working store shows no error copy");
    assert.strictEqual(probe.message.isError, false, "…and is not error-styled");
    assert.deepStrictEqual(probe.message.ariaInvalid, [], "nothing is marked invalid");

    // O-2's gate, read off the real controls.
    assert.strictEqual(probe.disabledWithoutProvider, true, "Save and Test are both dead with no provider");
    assert.strictEqual(
      probe.buttons.find((b) => /Remove key/.test(b.label)).disabled,
      true,
      "and Remove key is dead with nothing stored",
    );
  });

  it("the reveal toggle masks and unmasks, and never reveals a stored value", async function () {
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY, noSave: true }]);
    assert.strictEqual(probe.reveal.type, "password", "starts masked");
    assert.strictEqual(probe.reveal.afterFirstClick.type, "text", "Reveal flips the type");
    assert.strictEqual(probe.reveal.afterFirstClick.label, "Hide", "…and says so");
    assert.strictEqual(probe.reveal.afterFirstClick.pressed, "true", "…and reports it to AT");
    assert.strictEqual(probe.reveal.afterSecondClick.type, "password", "Hide flips it back");
    assert.strictEqual(probe.reveal.afterSecondClick.pressed, "false");
    // The theme-vocabulary claim: the toggle is a theme control, not a new style.
    assert.ok(
      /be-modal-cancel/.test(probe.reveal.className),
      "it reuses the sheet's button recipe: " + probe.reveal.className,
    );
  });

  it("a save against the real store PERSISTS, clears the field, and marks nothing invalid", async function () {
    // The mirror image of describe(2)'s refusal case, in the configuration that ships: the
    // store is writable, so a save must (a) land in `chrome.storage.local`, (b) empty the
    // credential out of the DOM, and (c) raise no error. Each half is a different failure:
    // a save that lies about persisting is the hintStore() bug; a save that leaves the key
    // sitting in a shared-DOM input is a leak this track's own residual note depends on.
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY }]);
    assert.strictEqual(probe.afterSave.storedKey, PROBE_KEY, "the credential reached the real store");
    assert.strictEqual(probe.afterSave.settings.storage, true);
    assert.strictEqual(probe.afterSave.hasKey, true, "…and keyPresent says so on a fresh read");
    assert.strictEqual(probe.afterSave.settings.keyPresent, true);
    assert.strictEqual(probe.afterSave.keyFieldValue, "", "the field is emptied after a successful save");
    assert.strictEqual(probe.afterSave.message.text, "", "no error copy on a save that worked");
    assert.deepStrictEqual(probe.afterSave.message.ariaInvalid, []);
    assert.match(probe.afterSave.status, /saved/i, "and it tells the user, in the status line");
    // The safe record holds the flag, never the credential — AC-4's split-store invariant, read
    // out of the REAL store rather than out of a fixture's object. The field set is asserted by
    // NAME (the vocabulary `sanitizeSettings` builds from), because a regex over a serialized
    // object cannot tell `keyPresent` from `key` and would either lie or need a pattern.
    const sw = ctx.serviceWorkers().find((w) => w.url().includes("background.js"));
    const raw = await sw.evaluate(async () => JSON.stringify(await chrome.storage.local.get(["be.ai", "be.ai.key"])));
    assert.match(raw, /"be\.ai\.key"/, "the credential lives under its own key");
    const store = JSON.parse(raw);
    const safe = store["be.ai"];
    assert.deepStrictEqual(
      Object.keys(safe).sort(),
      ["baseUrl", "keyPresent", "model", "provider"],
      "the safe record is exactly the four published fields — no key of any shape: " + JSON.stringify(safe),
    );
    assert.strictEqual(safe.keyPresent, true, "…only the derived flag");
    assert.ok(!JSON.stringify(safe).includes(PROBE_KEY), "and no copy of the credential");
  });

  it("a rejected base URL marks the BASE field, not the first input it finds", async function () {
    // The multi-field dialog bug class: the shell's default "first input" rule marks the
    // MODEL field for a BASE URL error. Three inputs sit before the message's subject here.
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{ tryBadBaseUrl: "http://insecure.example/v1" }]);
    assert.match(probe.afterSave.message.text, /https/i, "it says what is wrong");
    assert.deepStrictEqual(
      probe.afterSave.message.ariaInvalid,
      ["be-modal-input be-ai-baseurl"],
      "and marks exactly the field at fault",
    );
  });

  it("the credential stays out of the layout record and out of host storage", async function () {
    // AC-4's "never persisted into a layout record" against the REAL writer: the product's own
    // scanLayout output plus whatever IndexedDB holds for this sheet. The store is populated
    // FIRST here — Phase 3's grant means a key CAN be stored, so checking the layout record
    // against an empty store would prove nothing about where a stored key ends up.
    await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY }]);
    const layout = await contentCall(ctx, "aiLayoutRecordRead", []);
    assert.strictEqual(layout.error, null, "the live scan + store read ran clean: " + layout.error);
    assert.ok(layout.scan && layout.scan.length > 20, "the live layout record is a real record");
    assert.ok(!/apiKey|be\.ai/i.test(layout.scan), "the scanned layout has no credential field");
    assert.ok(!layout.scan.includes(PROBE_KEY), "…and no copy of the stored key");
    if (layout.stored !== null) {
      assert.ok(!/apiKey|be\.ai/i.test(layout.stored), "the stored layout has no credential field");
      assert.ok(!layout.stored.includes(PROBE_KEY), "…nor the key");
    }
    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(probe.hasKey, true, "the key IS stored — this case is about where else it is NOT");
  });

  it("the store is invisible to the page world; a key being TYPED is NOT, and that is the recorded residual", async function () {
    // TWO claims, deliberately separated because MEASUREMENT split them.
    //
    // (1) The JS seam is isolated: `window.AiSettings` is undefined in the MAIN world, so a
    //     page script cannot call getApiKey() — the "key reaches exactly one consumer"
    //     invariant, asserted at runtime rather than by reading the source.
    // (2) The DOM is SHARED. A key sitting in the field BEFORE a save is readable from the page
    //     world, because content scripts isolate globals and not markup. Asserting the opposite
    //     would make this case a lie; asserting it as-is keeps the residual visible, which is
    //     what a gate is for. `noSave` is what makes this the typing state rather than the
    //     saved state — see the case below for the difference.
    await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY, noSave: true, leaveOpen: true }]);
    const readPage = () =>
      page.evaluate(() => {
        const field = document.querySelector(".be-ai-key");
        const ls = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          ls[k] = String(localStorage.getItem(k)).slice(0, 120);
        }
        return {
          aiSettingsGlobal: typeof window.AiSettings,
          getApiKeyGlobal: typeof (window.AiSettings && window.AiSettings.getApiKey),
          fieldVisible: !!field,
          fieldValue: field ? field.value : null,
          fieldType: field ? field.type : null,
          localStorageKeys: Object.keys(ls),
          localStorageBlob: JSON.stringify(ls),
          cookieHasKey: /sk-[A-Za-z0-9_-]{8,}/.test(document.cookie || ""),
        };
      });
    const pageSide = await readPage();
    assert.strictEqual(pageSide.aiSettingsGlobal, "undefined", "the module is invisible to MAIN-world JS");
    assert.strictEqual(pageSide.getApiKeyGlobal, "undefined", "so is its only credential accessor");
    assert.strictEqual(pageSide.cookieHasKey, false, "no credential in a cookie");
    assert.ok(
      !pageSide.localStorageKeys.some((k) => /^be\.ai(\.|$)/.test(k) || /api[_-]?key/i.test(k)),
      "no AI settings or credential in host localStorage",
    );
    assert.ok(!KEY_SHAPE.test(pageSide.localStorageBlob), "…and no key-shaped value anywhere in it");

    // The residual, pinned as a REGRESSION CANARY: it is true today while the user types, and
    // if the dialog ever moves into a shadow root / closed-mode web component, or the field is
    // renamed, this flips and the track's privacy note must be re-read. That is the point of
    // writing it down instead of leaving it as prose in an issue.
    assert.strictEqual(pageSide.fieldVisible, true, "the dialog's markup is in the shared DOM");
    assert.strictEqual(pageSide.fieldType, "password", "…masked, which stops shoulder-surfing, not script");
    assert.strictEqual(
      pageSide.fieldValue,
      PROBE_KEY,
      "KNOWN RESIDUAL (AC-V0 option (i)): a key being typed is readable from the page world. " +
        "If this stops matching, the residual changed — update PRIVACY_POLICY §2 and this file's header.",
    );
    await contentCall(ctx, "closeOverlays", []);
  });

  it("…but after a successful save the shared DOM holds NOTHING credential-shaped", async function () {
    // The narrowing Phase 3 measured, asserted as its own case because it is the mitigation the
    // residual note leans on: the exposure is the TYPING window, not the configured state. Same
    // store, same key, dialog reopened — the field is empty at first paint and the page world
    // cannot read a value that is not there.
    await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY }]);
    const reopened = await contentCall(ctx, "aiSettingsDialogProbe", [{ leaveOpen: true }]);
    assert.strictEqual(reopened.keyFieldValueAtFirstPaint, "", "a stored key is never re-typed into the field");
    const pageSide = await page.evaluate((key) => {
      const field = document.querySelector(".be-ai-key");
      const html = document.body.innerHTML;
      // The generic key-shaped scan is kept as DIAGNOSIS, not as the assertion, because it has a
      // MEASURED false positive that is not this extension's: dndbeyond.com's own Datadog RUM
      // snippet carries `defaultPrivacyLevel: 'mask-user-input'`, which matches
      // /sk-[A-Za-z0-9_-]{8,}/ (`sk-user-input`). Asserting "no key-shaped string in the host's
      // DOM" would therefore be an assertion about a third party's markup, and it would have
      // failed this case for a value the extension never wrote. So the claim is about THE KEY:
      // the literal stored credential must be nowhere in the shared DOM.
      const shapeHits = (html.match(/sk-[A-Za-z0-9_-]{8,}/g) || []).filter(
        (v) => v === key || v.includes("material"),
      );
      return {
        value: field ? field.value : null,
        htmlHasKey: html.includes(key),
        credentialShapedHits: shapeHits,
      };
    }, PROBE_KEY);
    assert.strictEqual(pageSide.value, "", "and the page world reads an empty field");
    assert.strictEqual(pageSide.htmlHasKey, false, "the stored key is nowhere in the shared DOM");
    assert.deepStrictEqual(
      pageSide.credentialShapedHits,
      [],
      "…and nothing credential-shaped from this feature is either: " + JSON.stringify(pageSide),
    );
    await contentCall(ctx, "closeOverlays", []);
  });

  it("closing the dialog removes it, and a second open does not stack", async function () {
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{}]);
    assert.strictEqual(probe.closedAndRemoved, true, "the overlay node is gone after close()");
    const after = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
    assert.strictEqual(after, 0, "no orphan overlay is left in the shared DOM");
    // `leaveOpen` so the count below is measured WHILE the second dialog is up — without it the
    // probe closes its own dialog and the case would assert against an empty body.
    const two = await contentCall(ctx, "aiSettingsDialogProbe", [{ leaveOpen: true }]);
    assert.strictEqual(two.ok, true, "a second open works");
    const whileOpen = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
    assert.strictEqual(whileOpen, 1, "…and mounts exactly one overlay, not a stack");
    await contentCall(ctx, "closeOverlays", []);
  });
});

// ---------------------------------------------------------------------------
// Describe 2 — AC-4's NO-PERMISSION path, against a staged copy whose manifest
// REMOVES the `storage` grant. This is not what ships; it is what a user with the
// permission revoked, or a build that lost the grant, gets. It stays executable
// because AC-4's gate box names it, and because "reports failure instead of lying"
// is a claim about the degraded path, not about the good one.
// ---------------------------------------------------------------------------

/** The one manifest difference this variant is allowed to have. */
const revokeStorage = (m) => {
  const i = m.permissions.indexOf("storage");
  assert.ok(i >= 0, "the committed manifest grants `storage` — Phase 3's AC-V0 answer");
  m.permissions.splice(i, 1);
};

describe("BYOK store + dialog with `storage` REVOKED (the AC-4 no-permission path, staged)", function () {
  this.timeout(900000);

  let staged;
  let ctx;
  let page;

  before(async function () {
    staged = stageManifestVariant(revokeStorage, "byok-nostorage");
    assert.deepStrictEqual(
      staged.next.permissions,
      staged.base.permissions.filter((p) => p !== "storage"),
      "the staged manifest removes `storage` and changes nothing else",
    );
    assert.strictEqual(staged.next.permissions.length, 4, "5 -> 4, the pre-Phase-3 set");
    ctx = await launchStagedContext(staged);
    page = await bootPage(ctx);
  });

  after(async function () {
    if (ctx) await ctx.close().catch(() => {});
    if (staged) staged.dispose();
  });

  beforeEach(async function () {
    await assertNoStrayModals(ctx, page, this.currentTest.title);
  });

  it("chrome.storage is absent, and loadSettings says so instead of guessing", async function () {
    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(probe.chromeStoragePresent, false, "the grant is what the staged copy removes");
    assert.strictEqual(probe.settings.storage, false, "loadSettings reports the store is unavailable");
    assert.strictEqual(probe.hasKey, false, "…and no credential exists, so nothing is claimed");
    assert.strictEqual(probe.key, "");
  });

  it("a save against the ungranted store reports failure instead of lying", async function () {
    // The user-facing consequence: Save must say it did not persist. A silently-"successful"
    // save is the hintStore() bug in a new costume — state that looks stored and is gone on the
    // next boot.
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY }]);
    assert.strictEqual(probe.afterSave.storedKey, "", "nothing was stored, because nothing CAN be");
    assert.strictEqual(probe.afterSave.settings.storage, false, "the store still reports unavailable");
    assert.strictEqual(probe.afterSave.hasKey, false, "…and holds no credential");
    assert.match(
      probe.afterSave.message.text,
      /cannot write|blocked/i,
      "the dialog says so, in the shell's message node",
    );
    assert.strictEqual(probe.afterSave.message.isError, true);
    assert.deepStrictEqual(
      probe.afterSave.message.ariaInvalid,
      [],
      "a blocked store is not the user's typo, so NO field may be marked invalid for it",
    );
    // AC-4's never-logged half, against the REAL sink: neither the message node nor the status
    // line may echo the value. (`afterSave.keyFieldValue` DOES hold it — that is the residual
    // case in describe 1 — so this check is scoped to the two strings the extension produces,
    // which is where a leak would actually be written.)
    const echoed = probe.afterSave.message.text + " " + probe.afterSave.status;
    assert.ok(!echoed.includes(PROBE_KEY), "the error copy must not quote the credential back");
    assert.ok(!KEY_SHAPE.test(echoed), "…and carries no key-shaped value at all");
    // The field is NOT cleared on a failed save — clearing the user's typo-free input would
    // lose their work — but nothing was persisted either.
    assert.strictEqual(probe.afterSave.keyFieldValue, PROBE_KEY, "a failed save keeps the typed value");
  });
});
