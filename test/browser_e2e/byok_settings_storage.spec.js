/**
 * Browser E2E — track byok_ai_layout_20260915, Phase 2: the BYOK config store and its
 * dialog, in the REAL extension rather than a fixture.
 *
 * WHY THIS FILE EXISTS. AC-4 says the key is stored only in `chrome.storage.local`, never
 * synced, never inside a layout record, and never rendered unmasked. Phase 2's unit suite
 * covers all four against a JSDOM window with a hand-built store — and a hand-built store
 * can only prove the code agrees with the store the test chose to give it. The spec that
 * matters more asks what the extension ACTUALLY has. Two of this track's known failure
 * classes live at exactly that seam:
 *
 *   1. `hintStore()` (`js/controls.js:884-896`) — that feature read `chrome.storage` and its
 *      test passed, because the suite had STUBBED an API production does not have, so the
 *      hint reappeared on every real boot. The comment at that site is the project's own
 *      record of what a stubbed store cost.
 *   2. The two-world problem — `page.evaluate` runs in the page's MAIN world while the
 *      enhancer is injected into the ISOLATED world, so `window.AiSettings` reads as
 *      `undefined` from there and an assertion written that way CANNOT fail.
 *      `contentCall` (`_helpers/inject.js:57-77`) exists precisely because of it, and every
 *      world-sensitive claim below goes through it.
 *
 * WHAT THIS SPEC CAN PROVE TODAY, MEASURED (and it is more than the unit suite can). The
 * manifest does NOT yet request `storage` — that entry is Phase 3's coupled change, together
 * with PRIVACY_POLICY §2 and `hintStore()`'s re-show side effect — so in the real extension
 * `chrome.storage` is UNDEFINED and `loadSettings()` reports `storage: false`. That is not a
 * weakened run: it is AC-4's **no-permission path executing against the real permission set**
 * instead of against a fixture's idea of it, and it is the path every current install takes
 * until Phase 3 lands. The persist-and-reload half of the round-trip is therefore written
 * down as Phase 3's gate (it becomes executable the moment the permission exists). The first
 * case asserts this spec's own premise so the swap cannot be forgotten: if
 * `probe.chromeStoragePresent` ever comes back `true`, this file FAILS with instructions.
 *
 * ONE MORE THING IT MEASURED, AND IT COSTS AC-4 A QUALIFIER. Content scripts share the
 * page's DOM and isolate only its JS globals. Read from the MAIN world while the dialog was
 * open, `document.querySelector(".be-ai-key").value` returned the string the user had typed,
 * verbatim, to dndbeyond.com's own page scripts (MEASURED:
 * `{seesTheDialogMarkup: true, inputValueFromPageWorld: "sk-typed-by-user-material-…"}`).
 * So the defensible claim is that the credential never enters the page world AS DATA THIS
 * EXTENSION WRITES THERE — no global, no storage, no attribute, nothing persisted — while a
 * key the user is CURRENTLY TYPING is readable from the shared DOM for as long as the dialog
 * is open. AC-4's mask, the empty-at-first-paint field, the clear-on-save, and Phase 3's
 * worker-side read (the stored key never crosses into the content script's send path) are the
 * mitigations; the residual is inherent to a form field in a shared DOM, and it is asserted
 * below as what it is rather than argued away.
 *
 * Run: npm run test:e2e:byoksettings
 */

"use strict";

const assert = require("assert");
const { launchExtensionContext, bootPage } = require("./_helpers.js");
const { contentCall } = require("./_helpers/inject.js");

/** Shaped like a real credential so a leak cannot hide behind a placeholder-looking value. */
const KEY_SHAPE = /sk-[A-Za-z0-9_-]{8,}/;
const PROBE_KEY = "sk-probe-material-0123456789abcdef";

describe("BYOK settings store + dialog in the real extension (byok_ai_layout_20260915 Phase 2)", function () {
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

  it("js/ai_settings.js is injected, and the real permission set is the one this spec describes", async function () {
    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(probe.moduleType, "object", "window.AiSettings exists in the content world");
    assert.ok(Array.isArray(probe.keys) && probe.keys.length >= 14, "…with its full export table");
    for (const fn of ["loadSettings", "saveSettings", "getApiKey", "hasStoredKey", "showAiSettingsModal"]) {
      assert.ok(probe.keys.includes(fn), `${fn} is on the seam`);
    }

    // THE PREMISE OF EVERY CASE BELOW, asserted rather than assumed. Granting `storage`
    // (Phase 3) flips this to true, and then this file's no-permission assertions stop
    // describing production — the exact rot that made hintStore()'s test worthless. It fails
    // LOUDLY and says what to do.
    assert.strictEqual(
      probe.chromeStoragePresent,
      false,
      "manifest.json still declares 4 permissions and no `storage`, so chrome.storage is " +
        "undefined in a content script. If Phase 3 granted it: change THIS assertion to " +
        "true and replace the no-permission cases with the persist-and-reload round trip " +
        "(set -> close -> reopen -> persists -> clear -> gone) the plan names.",
    );
    assert.strictEqual(probe.settings.storage, false, "loadSettings reports the store is unavailable");
    assert.strictEqual(probe.settings.provider, "", "…and degrades to an empty record, not a guess");
    assert.strictEqual(probe.hasKey, false, "hasStoredKey is false, so the arrange control stays off (O-2)");
    assert.strictEqual(probe.key, "", "getApiKey returns \"\", and never a placeholder");
  });

  it("the real dialog is the shared shell, masked at first paint, and states the storage limit", async function () {
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

    // The message must be SHOWN here. `display: none` on an explanation is how a dialog ends
    // up claiming nothing while looking untouched.
    assert.match(probe.message.text, /blocked|storage/i);
    assert.notStrictEqual(probe.message.display, "none", "…and it is actually visible");
    assert.strictEqual(probe.message.isError, true, "error styling, not hint copy");
    assert.deepStrictEqual(
      probe.message.ariaInvalid,
      [],
      "a blocked store is not the user's typo, so NO field may be marked invalid for it",
    );

    // O-2's gate, read off the real controls.
    assert.strictEqual(probe.disabledWithoutProvider, true, "Save and Test are both dead with no provider");
    assert.strictEqual(
      probe.buttons.find((b) => /Remove key/.test(b.label)).disabled,
      true,
      "and Remove key is dead with nothing stored",
    );
  });

  it("the reveal toggle masks and unmasks, and never reveals a stored value", async function () {
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY }]);
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

  it("a save against the real (ungranted) store reports failure instead of lying", async function () {
    // The user-facing consequence of the no-permission path: Save must say it did not
    // persist. A silently-"successful" save is the hintStore() bug in a new costume — state
    // that looks stored and is gone on the next boot.
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
    // AC-4's never-logged half, against the REAL sink: neither the message node nor the
    // status line may echo the value. (`afterSave.keyFieldValue` DOES hold it — that is a
    // separate, deliberate assertion below — so this check is scoped to the two strings the
    // extension produces, which is where a leak would actually be written.)
    const echoed = probe.afterSave.message.text + " " + probe.afterSave.status;
    assert.ok(!echoed.includes(PROBE_KEY), "the error copy must not quote the credential back");
    assert.ok(!KEY_SHAPE.test(echoed), "…and carries no key-shaped value at all");
    // The field is NOT cleared on a failed save — clearing the user's typo-free input would
    // lose their work — but nothing was persisted either.
    assert.strictEqual(probe.afterSave.keyFieldValue, PROBE_KEY, "a failed save keeps the typed value");
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
    // AC-4's "never persisted into a layout record" against the REAL writer: the product's
    // own scanLayout output plus whatever IndexedDB holds for this sheet.
    const layout = await contentCall(ctx, "aiLayoutRecordRead", []);
    assert.strictEqual(layout.error, null, "the live scan + store read ran clean: " + layout.error);
    assert.ok(layout.scan && layout.scan.length > 20, "the live layout record is a real record");
    assert.ok(!/apiKey|be\.ai/i.test(layout.scan), "the scanned layout has no credential field");
    if (layout.stored !== null) {
      assert.ok(!/apiKey|be\.ai/i.test(layout.stored), "the stored layout has no credential field");
    }

    const probe = await contentCall(ctx, "aiSettingsWorldRead", []);
    assert.strictEqual(probe.key, "", "and the store holds nothing to leak into it");
  });

  it("the store is invisible to the page world; the dialog's live DOM is NOT, and that is the recorded residual", async function () {
    // TWO claims, deliberately separated because MEASUREMENT split them.
    //
    // (1) The JS seam is isolated: `window.AiSettings` is undefined in the MAIN world, so a
    //     page script cannot call getApiKey() — that is the "key reaches exactly one
    //     consumer" invariant, asserted at runtime rather than by reading the source.
    // (2) The DOM is SHARED. A key currently sitting in the field is readable from the page
    //     world, because content scripts isolate globals and not markup. Asserting the
    //     opposite would make this case a lie; asserting it as-is makes the residual
    //     visible, which is what a gate is for.
    await contentCall(ctx, "aiSettingsDialogProbe", [{ typeKey: PROBE_KEY, leaveOpen: true }]);
    const pageSide = await page.evaluate(() => {
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
    assert.strictEqual(pageSide.aiSettingsGlobal, "undefined", "the module is invisible to MAIN-world JS");
    assert.strictEqual(pageSide.getApiKeyGlobal, "undefined", "so is its only credential accessor");
    assert.strictEqual(pageSide.cookieHasKey, false, "no credential in a cookie");
    assert.ok(
      !pageSide.localStorageKeys.some((k) => /^be\.ai(\.|$)/.test(k) || /api[_-]?key/i.test(k)),
      "no AI settings or credential in host localStorage",
    );
    assert.ok(!KEY_SHAPE.test(pageSide.localStorageBlob), "…and no key-shaped value anywhere in it");

    // The residual, pinned as a REGRESSION CANARY: it is true today, and if the dialog ever
    // moves into a shadow root / web component with a closed mode, or the field is renamed,
    // this flips and the track's privacy note must be re-read. That is the point of writing
    // it down instead of leaving it as prose in an issue.
    assert.strictEqual(pageSide.fieldVisible, true, "the dialog's markup is in the shared DOM");
    assert.strictEqual(pageSide.fieldType, "password", "…masked, which stops shoulder-surfing, not script");
    assert.strictEqual(
      pageSide.fieldValue,
      PROBE_KEY,
      "KNOWN RESIDUAL (AC-V0 option (i)): a key being typed is readable from the page world. " +
        "If this stops matching, the residual changed — update PRIVACY_POLICY §2 and the spec's AC-4 wording.",
    );
    await contentCall(ctx, "closeOverlays", []);
  });

  it("closing the dialog removes it, and a second open does not stack", async function () {
    const probe = await contentCall(ctx, "aiSettingsDialogProbe", [{}]);
    assert.strictEqual(probe.closedAndRemoved, true, "the overlay node is gone after close()");
    const after = await page.evaluate(() => document.querySelectorAll(".be-modal-overlay").length);
    assert.strictEqual(after, 0, "no orphan overlay is left in the shared DOM");
  });
});
