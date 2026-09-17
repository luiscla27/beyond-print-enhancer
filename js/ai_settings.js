/**
 * AI settings: the BYOK config store (AC-4) and its dialog — track byok_ai_layout_20260915,
 * Phase 2. Everything else this feature does (transport, patch, apply) lives in Phases 3/4;
 * this file owns exactly two things: where the user's provider config is PERSISTED, and how
 * it is EDITED.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * - No chat call, no layout mutation. It stores configuration and renders a form. The
 *   provider origin list it exposes (`ALLOWED_COMPAT_ORIGINS`) is DATA for the transport's
 *   guard (Phase 3) and the pure core's allow-list (`js/ai_layout.js` `buildRequest`).
 * - No raw `chrome.*` anywhere in this file: every access goes through `aiStore()`, which
 *   resolves lazily at CALL time. Two reasons, both load-bearing: the module is loaded
 *   before `js/main.js` (so no seam may be captured at eval time), and AC-4 forbids this
 *   project's failure mode from recurring — `js/controls.js:878-890` documents the onboarding
 *   hint whose test passed on a STUBBED `chrome.storage` while the feature silently did not
 *   work in production. So `test/unit/byok_ai_settings.test.js` asserts the real
 *   `getApiKey()` ran in EVERY successful read (a spy, not a stub round-trip), and there is
 *   a unit case that runs the whole module with NO chrome at all: no throw, no network,
 *   just `ok:false, error:'storage_unavailable'` (that is also the no-permission path AC-4's
 *   gate box demands).
 *
 * THE TWO-STORE SHAPE — WHY THE KEY AND THE SETTINGS ARE SEPARATE KEYS
 * --------------------------------------------------------------------
 * AC-4: "the key is never written to chrome.storage.sync, never logged, never placed in
 * the prompt, never persisted into a layout record or telemetry." One store would make
 * every settings read a key read. Instead:
 *   `be.ai`      → { provider, model, baseUrl, keyPresent }   — the whole object is SAFE
 *                  to hold, to render, and to hand around. `keyPresent` is a boolean the
 *                  modal and (Phase 4) the arrange button read; it is derived from storage
 *                  on every load, never trusted from the page.
 *   `be.ai.key`  → the credential, alone. Read ONLY through `getApiKey()`, needed ONLY
 *                  where the transport runs (the service worker, Phase 3). The UI writes
 *                  it and reads back only `keyPresent` — `renderKeyState` asserts it never
 *                  received a key string, so a "masked" field that actually round-tripped
 *                  the value cannot pass.
 * The object form of `chrome.storage.local.set/get` (NOT `sessionStorage`-style strings)
 * is deliberate: a whole-value write can never carry a stale key field, and `clearApiKey`
 * deletes the second key outright rather than blanking it.
 *
 * HOW THE DIALOG IS OPENED — AND HOW IT IS DELIBERATELY NOT OPENED. Phase 2 ships NO opener:
 * this file exposes `showAiSettingsModal()`, and Phase 4 wires it to the panel's AI button.
 * What it does NOT do is add a `message` listener (or any other window-event opener) for that:
 * a listener would make a page-reachable opener out of a credential editor, and this track's
 * Phase 0 measured that a message handler plus a stored credential is exactly the class
 * `js/background.js:195` is a trap for (L-3: the fetch relay has no sender gate because no
 * content-script surface reaches it today — adding the first listener here is the edit that
 * would change that). AC-5's browser probe `no_sender_check_inheritance` is the falsifiable
 * half of this claim: it asserts this file installs no window-message listener at all.
 * The panel is extension chrome inside the SAME isolated world as this script, so Phase 4's
 * click handler can call the seam directly — no bridge needed, and none added.
 *
 * NOTE FOR PHASE 4: `saveSettings` REFUSES a key-shaped `baseUrl`
 * (`base_url_contains_credential`), which mirrors `buildMessages`' refusal of a key-shaped
 * instruction. A user who pastes their key into the base-URL field is stopped before it
 * reaches a request header built out of that string.
 *
 * TEST / SEAM CONVENTIONS: helpers are uniquely named per file (the monolith-extraction
 * rule), cross-module seams resolve through `window.*` at call time, and the one published
 * namespace below carries `Test seam` — the annotation the re-rot guard
 * (`scripts/check_dead_exports.js`) requires of a surface whose product caller arrives in
 * Phase 4.
 */
"use strict";

/** The namespaced keys AC-4 asks for: one safe record, one lone credential. */
const AI_SETTINGS_STORE_KEY = "be.ai";
const AI_KEY_STORE_KEY = "be.ai.key";

/**
 * What a saved record is allowed to hold, pinned as a vocabulary rather than prose.
 * `key` deliberately does NOT appear: a key-shaped property inside `be.ai` is AC-4's
 * failure mode, and `sanitizeSettings` cannot persist one (pinned by a unit case that
 * plants exactly that smuggled field).
 */
const AI_SETTINGS_FIELDS = Object.freeze({
  provider: "provider",
  model: "model",
  baseUrl: "baseUrl",
  keyPresent: "keyPresent",
});

/**
 * The providers O-1 ratified for v1, with their UI labels.
 *
 * WHY THIS IS A LOCAL LIST AND NOT `AiLayout.PROVIDERS`: the pure core publishes its
 * provider table through `module.exports` only, and it deliberately has no `window.AiLayout`
 * seam (that seam's first product caller is Phase 4 — see the core's header and
 * `scripts/check_dead_exports.js`). This file is loaded into the PAGE by
 * `js/background.js`'s `executeScript` `files` list, where `require` does not exist, so
 * reading the core's table here would mean publishing the seam early with no reader — the
 * exact thing the re-rot guard fails on. The pair is therefore pinned instead by a case in
 * `test/unit/byok_ai_settings.test.js` that asserts these ids are EXACTLY the core's, so the
 * drift this comment is about cannot happen quietly. The published ORIGINS are not listed
 * here at all: they live in the core, which is the only place that builds a request URL, and
 * Phase 3's manifest probe reads them from there.
 */
const AI_PROVIDER_LABELS = Object.freeze({
  openai: "OpenAI",
  anthropic: "Anthropic",
});

const AI_PROVIDERS = Object.freeze(
  Object.keys(AI_PROVIDER_LABELS).map((id) =>
    Object.freeze({ id, label: AI_PROVIDER_LABELS[id] }),
  ),
);

/**
 * The OpenAI-compatible hosts O-1's optional base URL may point at. An EMPTY list is the
 * honest starting state: "add on demand" (O-1) means a name has to arrive here AND in the
 * manifest's `host_permissions` before the transport will dial it, and Phase 3's
 * `provider_origin_lock` probe is what pins that pair together. A URL outside this list is
 * rejected at SAVE time (`base_url_not_allowed`), and `buildRequest` independently refuses
 * to route it.
 */
const AI_COMPAT_BASE_ORIGINS = Object.freeze([]);

/** A compatible base URL must be https, carry no credentials, and be a real origin. */
const AI_BASE_URL_MAX = 200;

/** Provider defaults for the model field — a hint the user may overwrite. */
const AI_MODEL_DEFAULTS = Object.freeze({
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
});

// ---------------------------------------------------------------------------
// The store boundary (AC-4's "where the key lives")
// ---------------------------------------------------------------------------

/**
 * Lazily resolved `chrome.storage.local`, or null. Call-time resolution on purpose —
 * see the header's first block. The try/catch is not decoration: `js/controls.js`'s
 * `hintStore()` precedent shows the accessor can THROW (a blocked store) rather than be
 * merely undefined, and a settings panel must never take the sheet down with it.
 */
function aiStore() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch {
    /* not an extension context */
  }
  return null;
}

/**
 * Read ONE extension-storage key → Promise<value|undefined>. Swallows an unavailable
 * store into `undefined` rather than throwing: every caller is UI code that must degrade
 * to "not configured". The failure is still LOUD where it matters — `loadSettings`
 * reports `storage_unavailable` so the modal can say so instead of pretending the user
 * never configured anything.
 */
function aiStorageGet(key) {
  const store = aiStore();
  if (!store || typeof store.get !== "function") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    try {
      const maybe = store.get(key);
      if (maybe && typeof maybe.then === "function") {
        maybe.then((res) => resolve(res && res[key]), () => resolve(undefined));
        return;
      }
      store.get(key, (res) => resolve(res && res[key]));
    } catch {
      resolve(undefined);
    }
  });
}

/** Write one key. Resolves false when nothing could be written. */
function aiStorageSet(key, value) {
  const store = aiStore();
  if (!store || typeof store.set !== "function") return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const maybe = store.set({ [key]: value });
      if (maybe && typeof maybe.then === "function") {
        maybe.then(() => resolve(true), () => resolve(false));
        return;
      }
      store.set({ [key]: value }, () => resolve(true));
    } catch {
      resolve(false);
    }
  });
}

/** Delete one key (`remove` is the API; an absent method is handled, not assumed). */
function aiStorageRemove(key) {
  const store = aiStore();
  if (!store) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      if (typeof store.remove === "function") {
        const maybe = store.remove(key);
        if (maybe && typeof maybe.then === "function") {
          maybe.then(() => resolve(true), () => resolve(false));
          return;
        }
        store.remove(key, () => resolve(true));
        return;
      }
      // The fallback is a DELETE, not a blank: overwriting `be.ai.key` with "" would leave
      // a value-shaped slot the rest of the feature must keep special-casing.
      const maybe = store.set({ [key]: undefined });
      if (maybe && typeof maybe.then === "function") {
        maybe.then(() => resolve(true), () => resolve(false));
      } else {
        resolve(true);
      }
    } catch {
      resolve(false);
    }
  });
}

// ---------------------------------------------------------------------------
// The read/write API
// ---------------------------------------------------------------------------

/**
 * Coerce anything read out of storage into the record this feature can trust. Unknown
 * providers, smuggled key fields and oversized strings are all dropped here, because every
 * downstream reader (the button's disabled state, the modal's fields, the transport's
 * config) must not have to re-derive the rules.
 */
function sanitizeSettings(raw) {
  // Built FROM `AI_SETTINGS_FIELDS` rather than re-typed: the frozen map is the claim that
  // these four names are the whole safe record, and a literal that happens to agree with it
  // is not that claim. `key` cannot appear because it is not in the map — which is the
  // reason the map exists and the reason it is written here rather than beside it.
  const out = {
    [AI_SETTINGS_FIELDS.provider]: "",
    [AI_SETTINGS_FIELDS.model]: "",
    [AI_SETTINGS_FIELDS.baseUrl]: "",
    [AI_SETTINGS_FIELDS.keyPresent]: false,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const provider = typeof raw.provider === "string" ? raw.provider.trim().toLowerCase() : "";
  out.provider = Object.prototype.hasOwnProperty.call(AI_PROVIDER_LABELS, provider) ? provider : "";
  out.model = clampString(raw.model, 120);
  out.baseUrl = clampString(raw.baseUrl, AI_BASE_URL_MAX);
  // The flag is DERIVED from the credential store, never trusted from the record: a hand
  // edited `be.ai` that claims `keyPresent: true` must not enable the arrange button.
  out.keyPresent = raw.keyPresent === true;
  return out;
}

/** Trim to a bounded string, or "" for anything that is not a string. */
function clampString(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * `{ provider, model, baseUrl, keyPresent }` — never the key. `storage: false` on an
 * unreadable store, so the modal can distinguish "you have not configured this" from
 * "the extension cannot persist anything" (the latter is a permission problem, AC-V0's
 * no-permission path).
 */
function loadSettings() {
  return Promise.all([aiStorageGet(AI_SETTINGS_STORE_KEY), hasStoredKey()]).then(
    ([raw, keyPresent]) => {
      const settings = sanitizeSettings(raw);
      settings.keyPresent = keyPresent;
      settings.storage = aiStore() !== null;
      return settings;
    },
  );
}

/** The ONLY accessor for the credential. UI must not call it — see the header. */
function getApiKey() {
  return aiStorageGet(AI_KEY_STORE_KEY).then((key) => (typeof key === "string" && key ? key : ""));
}

/** Does a credential exist? Reads the key store, reports a BOOLEAN only. */
function hasStoredKey() {
  return getApiKey().then((key) => key.length > 0);
}

/**
 * Save the settings record. Writes `be.ai` ONLY — this function physically cannot touch
 * `be.ai.key`, which is what makes "no settings write can leak the key into the safe
 * record" a property of the code rather than of a test fixture.
 * @return {Promise<{ok: boolean, error?: string, settings: object}>}
 */
function saveSettings(settings) {
  const candidate = sanitizeSettings(settings);
  if (candidate.baseUrl) {
    const problem = aiBaseUrlProblem(candidate.baseUrl);
    if (problem) {
      return Promise.resolve({ ok: false, error: problem, settings: loadSettingsFrom(candidate) });
    }
  }
  // The flag is RE-DERIVED here rather than taken from the caller, for two reasons that
  // are one rule: `keyPresent` describes the credential store, so no caller may set it.
  // (a) A saved record must not claim a key that was never written, and (b) — the reason
  // this also fixes a real bug — the dialog's save path calls setApiKey() FIRST, so a
  // caller-shaped record with `keyPresent: false` would otherwise overwrite the flag the
  // key write just set, leaving `be.ai` lying about a credential that exists.
  return hasStoredKey().then((keyPresent) => {
    candidate.keyPresent = keyPresent;
    return aiStorageSet(AI_SETTINGS_STORE_KEY, candidate).then((wrote) =>
      wrote
        ? { ok: true, settings: loadSettingsFrom(candidate) }
        : { ok: false, error: "storage_unavailable", settings: loadSettingsFrom(candidate) },
    );
  });
}

/** The record shape `saveSettings` reports back (before a reload, so the UI is not async). */
function loadSettingsFrom(settings) {
  const out = Object.assign({}, settings);
  delete out.storage;
  return out;
}

/**
 * Store (or replace) the credential, and flip `keyPresent` in the safe record.
 *
 * THE SEQUENCE IS THE SECURITY, SO IT IS COMMENTED AS ONE: the key write happens FIRST and
 * the flag write only after it succeeds, so a half-saved state is always "no key" (safe
 * direction) and never "key present" pointing at nothing (which would let the arrange
 * button fire with no credential). The key is never logged, never returned, and never
 * placed in `be.ai`.
 */
function setApiKey(key) {
  const value = typeof key === "string" ? key.trim() : "";
  if (!value) {
    return Promise.resolve({ ok: false, error: "key_empty" });
  }
  return aiStorageSet(AI_KEY_STORE_KEY, value)
    .then((wrote) =>
      wrote
        ? // flagWrite() is ASYNC (it reads the current record to preserve provider/model),
          // so it must be awaited before its value is handed to set(): passing the promise
          // itself would store a thenable under `be.ai` and silently erase the record.
          flagWrite().then((settings) => aiStorageSet(AI_SETTINGS_STORE_KEY, settings))
        : Promise.resolve(false),
    )
    .then((wrote) => (wrote ? { ok: true } : { ok: false, error: "storage_unavailable" }));
}

/**
 * Remove the credential AND the whole settings record. Deleting `be.ai` too is not tidiness:
 * the record is harmless without a key, but leaving a configured provider behind after the
 * user said "remove my key" invites the next boot to look configured when it is not. The
 * user re-enters provider/model/key together — an explicit removal must not be half-done.
 */
function clearApiKey() {
  return aiStorageRemove(AI_KEY_STORE_KEY).then(() => aiStorageRemove(AI_SETTINGS_STORE_KEY));
}

/** The minimal flag-only merge used by setApiKey: preserve what is configured, flip the flag. */
function flagWrite() {
  return aiStorageGet(AI_SETTINGS_STORE_KEY).then((raw) => {
    const settings = sanitizeSettings(raw);
    settings.keyPresent = true;
    return settings;
  });
}

/**
 * Validate a compatible base URL against the PUBLISHED allow-list, returning an error code
 * or "". Shared by the save path and the modal, so the form cannot accept what storage will
 * later refuse to route. The credential-in-URL case is checked FIRST: `https://sk-a...@host`
 * is a well-formed URL that would otherwise store a key in a field the UI renders in clear.
 */
function aiBaseUrlProblem(rawUrl) {
  // "" is the LEGAL default (O-1 makes the field optional), and it is settled here rather
  // than at each caller so the form check and the store check cannot disagree about what
  // "no base URL" means. Whitespace-only is the same thing.
  if (!String(rawUrl == null ? "" : rawUrl).trim()) return "";
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return "base_url_invalid";
  }
  if (url.protocol !== "https:") return "base_url_insecure";
  if (url.username || url.password) return "base_url_contains_credential";
  const origin = url.origin;
  if (!AI_COMPAT_BASE_ORIGINS.includes(origin)) return "base_url_not_allowed";
  return "";
}

// ---------------------------------------------------------------------------
// The dialog (L-5: the shared `createModal` shell, theme classes only)
// ---------------------------------------------------------------------------

/**
 * Open the AI settings dialog. Resolves the `Modals` seam at CALL time for the same reason
 * as `aiStore()` — this file is loaded before `js/modals.js` in the injected list, and a
 * capture-at-eval-time reference is the exact hazard every module header in this directory
 * warns about. Returns null (rather than throwing) when the shell is unavailable: a missing
 * dialog is a degraded panel, not a dead sheet.
 *
 * `overrides` is the seam for the browser probe + the unit case: `{ ping }` swaps the
 * 1-token connection test's transport (Phase 2 ships the default refusal — the real relay
 * is Phase 3 — so "test connection" honestly says "transport not available" until then), and
 * `{ settings }` injects a pre-resolved record so the masked-render assertion never depends
 * on a stubbed store being what makes it pass.
 */
function showAiSettingsModal(overrides) {
  const opts = overrides || {};
  const api = typeof window !== "undefined" ? window.Modals : null;
  if (!api || typeof api.__createModal !== "function") return null;

  const handle = api.__createModal({
    title: "AI layout settings",
    body(ctx) {
      aiRenderSettingsBody(ctx, opts);
    },
  });
  return handle;
}

/**
 * The form body, in its own function so the unit suite can boot the dialog and query real
 * nodes. Every read goes through loadSettings() unless `overrides.settings` was injected,
 * and NOTHING here ever receives a key string: `renderKeyState` is called with the
 * `keyPresent` flag only, and the case asserts the rendered field's value is "" — a masked
 * input that held the real key would fail that assertion.
 */
function aiRenderSettingsBody(ctx, opts) {
  const lead = document.createElement("p");
  lead.className = "be-modal-hint";
  lead.textContent =
    "Bring your own key: the arrangement is proposed by a model you choose, using your " +
    "own provider account and API key. Nothing is proxied through us - requests go " +
    "straight from this browser to the provider you pick. The key stays in this " +
    "browser's extension storage; it is never synced, never sent to us, and never " +
    "included in a layout save.";
  ctx.bodyEl.appendChild(lead);

  const providerRow = document.createElement("label");
  providerRow.className = "be-field";
  const providerLabel = document.createElement("span");
  providerLabel.className = "be-field-label";
  providerLabel.textContent = "Provider";
  const providerSelect = document.createElement("select");
  providerSelect.className = "be-modal-input be-ai-provider";
  providerSelect.id = "be-ai-provider";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "- choose -";
  providerSelect.appendChild(blank);
  AI_PROVIDERS.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    providerSelect.appendChild(opt);
  });
  providerRow.appendChild(providerLabel);
  providerRow.appendChild(providerSelect);
  ctx.bodyEl.appendChild(providerRow);

  const modelInput = aiLabeledInput(
    ctx,
    "Model",
    "be-ai-model",
    "text",
    AI_MODEL_DEFAULTS.openai,
  ).input;
  const baseInput = aiLabeledInput(
    ctx,
    "Compatible base URL (optional)",
    "be-ai-baseurl",
    "text",
    "https://api.openai.com/v1",
  ).input;
  const baseHint = document.createElement("p");
  baseHint.className = "be-modal-hint";
  baseHint.textContent =
    "Only an https origin this extension publishes is accepted; a URL outside that list " +
    "is refused here and again before any request is built.";
  ctx.bodyEl.appendChild(baseHint);

  const keyRow = document.createElement("div");
  keyRow.className = "be-field";
  const keyLabel = document.createElement("span");
  keyLabel.className = "be-field-label";
  keyLabel.textContent = "API key";
  const keyWrap = document.createElement("div");
  keyWrap.className = "be-ai-key-row";
  const keyInput = document.createElement("input");
  // AC-4's masked field. type=password from the first render: flipping the attribute
  // after the fact still leaves the value in the accessibility tree as plain text, which
  // is the half a reveal toggle can never win back.
  keyInput.type = "password";
  keyInput.className = "be-modal-input be-ai-key";
  keyInput.id = "be-ai-key";
  keyInput.autocomplete = "off";
  keyInput.spellcheck = false;
  const reveal = document.createElement("button");
  reveal.type = "button";
  // Theme classes only, per the design language. The sheet's button recipe is a THREE-way
  // selector list (`.be-modal-actions button, .be-modal-cancel, .be-modal-ok,
  // .be-modal-button` — js/ui_theme.js:1323-1326), so any ONE of those classes carries the
  // T1 height and the radius; `be-modal-cancel` alone is what every other dialog's Cancel
  // uses (js/catalog_service.js:355, js/controls.js:1302). `be-ai-key-reveal` is the probe
  // hook, never a style hook.
  reveal.className = "be-modal-cancel be-ai-key-reveal";
  reveal.textContent = "Reveal";
  reveal.setAttribute("aria-pressed", "false");
  reveal.addEventListener("click", () => {
    const shown = keyInput.type === "password";
    keyInput.type = shown ? "text" : "password";
    reveal.textContent = shown ? "Hide" : "Reveal";
    reveal.setAttribute("aria-pressed", shown ? "true" : "false");
  });
  const keyState = document.createElement("span");
  keyState.className = "be-ai-key-state";
  keyState.setAttribute("role", "status");
  keyWrap.appendChild(keyInput);
  keyWrap.appendChild(reveal);
  keyRow.appendChild(keyLabel);
  keyRow.appendChild(keyWrap);
  keyRow.appendChild(keyState);
  ctx.bodyEl.appendChild(keyRow);

  const testBtn = document.createElement("button");
  testBtn.type = "button";
  testBtn.className = "be-modal-cancel be-ai-test";
  testBtn.textContent = "Test connection";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "be-modal-cancel be-ai-remove-key";
  removeBtn.textContent = "Remove key";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "be-modal-cancel be-ai-cancel";
  cancelBtn.textContent = "Cancel";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "be-modal-ok be-ai-save";
  saveBtn.textContent = "Save";
  // Straight into the shell's action row, the way every other dialog here does it
  // (js/modals.js:263-270, :353-360): .be-modal-actions owns the 8px gap and the T1
  // button recipe, so a nested wrapper would inherit the recipe and LOSE the gap.
  ctx.actionsRow.appendChild(testBtn);
  ctx.actionsRow.appendChild(removeBtn);
  ctx.actionsRow.appendChild(cancelBtn);
  ctx.actionsRow.appendChild(saveBtn);

  const status = document.createElement("p");
  status.className = "be-modal-hint be-ai-status";
  status.setAttribute("role", "status");
  ctx.bodyEl.appendChild(status);

  // ---- state + wiring ------------------------------------------------------
  // One in-memory copy drives the button states, and it is refreshed from storage after
  // every write. `keyPresent` is the ONLY key-shaped fact the UI ever holds.
  let current = { provider: "", model: "", baseUrl: "", keyPresent: false };

  // `opts.settings` injects the RECORD (so the masked-render case never depends on a
  // stubbed store), but the storage FLAG is still derived from the real store: it is the
  // one field whose whole job is "can this browser persist anything", and a record handed
  // in by a caller cannot answer it. Getting this wrong made an injected settings object
  // claim the browser had blocked storage.
  const settingsPromise = opts.settings
    ? Promise.resolve(withStorageFlag(sanitizeSettings(opts.settings)))
    : loadSettings();

  const render = (settings) => {
    current = settings;
    providerSelect.value = settings.provider || "";
    modelInput.value = settings.model || "";
    baseInput.value = settings.baseUrl || "";
    aiRenderKeyState(keyState, settings.keyPresent);
    aiRenderActionStates({ testBtn, removeBtn, saveBtn, keyInput }, settings);
    if (!settings.storage) {
      ctx.setMessage(
        "This browser blocked the extension's storage, so nothing can be saved here.",
        "error",
        null,
      );
    }
  };

  settingsPromise.then(render);

  providerSelect.addEventListener("change", () => {
    // A provider switch fills the model default ONLY over an empty field: the user may
    // already have typed an id, and silently replacing it is how settings UIs lose trust.
    if (!modelInput.value.trim()) {
      const def = AI_MODEL_DEFAULTS[providerSelect.value];
      if (def) modelInput.value = def;
    }
    aiRenderActionStates({ testBtn, removeBtn, saveBtn, keyInput }, Object.assign({}, current, {
      provider: providerSelect.value,
    }));
  });

  saveBtn.addEventListener("click", () => {
    const candidate = {
      provider: providerSelect.value,
      model: modelInput.value,
      baseUrl: baseInput.value,
    };
    if (!candidate.provider) {
      ctx.setMessage("Choose a provider first.", "error", providerSelect);
      return;
    }
    const rawKey = keyInput.value.trim();
    const keyStep = rawKey ? setApiKey(rawKey) : Promise.resolve({ ok: true });
    keyStep.then((saved) => {
      if (!saved.ok) {
        // A failed key write must NOT be followed by a settings write: the record would
        // then claim a key that was never stored.
        ctx.setMessage(
          aiSaveErrorMessage(saved.error),
          "error",
          aiErrorTarget(saved.error, { baseInput, keyInput }),
        );
        return;
      }
      if (rawKey) keyInput.value = "";
      return saveSettings(candidate).then((result) => {
        if (!result.ok) {
          ctx.setMessage(
            aiSaveErrorMessage(result.error),
            "error",
            aiErrorTarget(result.error, { baseInput, keyInput }),
          );
          return;
        }
        ctx.clearMessage();
        status.textContent = rawKey
          ? "Saved. Your key is stored in this browser only."
          : "Saved.";
        loadSettings().then(render);
      });
    });
  });

  removeBtn.addEventListener("click", () => {
    clearApiKey().then(() => {
      keyInput.value = "";
      status.textContent = "Key removed. AI arrange is off until you add one.";
      loadSettings().then(render);
    });
  });

  testBtn.addEventListener("click", () => {
    const candidate = { provider: providerSelect.value, model: modelInput.value, baseUrl: baseInput.value };
    const key = keyInput.value.trim();
    testBtn.disabled = true;
    status.textContent = "Testing with a 1-token request...";
    const ping = opts.ping || aiDefaultPing();
    Promise.resolve()
      .then(() => (key ? setApiKey(key) : { ok: true }))
      // A failed credential write is reported, not walked past: silently continuing to
      // "test the connection" would tell the user the PROVIDER failed when it was their own
      // browser refusing to store anything, and AC-6's distinct-copy rule is about exactly
      // that confusion.
      .then((stored) => {
        if (!stored.ok) throw new Error("settings:" + stored.error);
        return saveSettings(candidate);
      })
      .then((saved) => {
        if (!saved.ok) throw new Error("settings:" + saved.error);
        return ping(candidate.provider);
      })
      .then((result) => {
        if (result && result.ok) {
          status.textContent = "Connection OK.";
          loadSettings().then(render);
        } else {
          status.textContent = "Connection failed: " + aiPingMessage(result && result.errorClass);
        }
      })
      .catch((err) => {
        const code = String(err && err.message ? err.message : "").replace("settings:", "");
        status.textContent =
          code && aiSaveErrorMessage(code) !== "Could not save the settings."
            ? "Connection failed: " + aiSaveErrorMessage(code)
            : "Connection failed: settings are not valid yet.";
      })
      .then(() => {
        testBtn.disabled = false;
      });
  });

  cancelBtn.addEventListener("click", () => handle$Close(ctx));
}

/** Close through whatever the shell gave us; the shared modal owns the focus handback. */
function handle$Close(ctx) {
  if (ctx && typeof ctx.close === "function") ctx.close(null);
}

/** Re-attach the derived storage flag to a record that arrived without one. */
function withStorageFlag(settings) {
  const out = Object.assign({}, settings);
  out.storage = aiStore() !== null;
  return out;
}

/** Build one labelled text input and hand back its parts. */
function aiLabeledInput(ctx, labelText, className, type, placeholder) {
  const row = document.createElement("label");
  row.className = "be-field";
  const label = document.createElement("span");
  label.className = "be-field-label";
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.className = "be-modal-input " + className;
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  row.appendChild(label);
  row.appendChild(input);
  ctx.bodyEl.appendChild(row);
  return { row, input };
}

/**
 * The key line's state text. It receives the BOOLEAN only — never a key string — which is
 * what lets the unit case assert that the value in the field is "" while the dialog still
 * truthfully says a key exists.
 */
function aiRenderKeyState(node, keyPresent) {
  node.textContent = keyPresent
    ? "A key is stored on this device."
    : "No key stored yet - AI arrange stays off until you add one.";
}

/** O-2: the feature is off until a key exists, and the dialog says so in its controls. */
function aiRenderActionStates(nodes, settings) {
  const hasProvider = !!settings.provider;
  nodes.removeBtn.disabled = !settings.keyPresent;
  nodes.testBtn.disabled = !hasProvider;
  nodes.saveBtn.disabled = !hasProvider;
  if (!hasProvider) {
    nodes.keyInput.placeholder = "Paste your API key";
  } else {
    nodes.keyInput.placeholder = settings.keyPresent
      ? "Stored - paste a new one to replace it"
      : "Paste your " + (AI_PROVIDER_LABELS[settings.provider] || settings.provider) + " key";
  }
}

/**
 * WHICH field an error is about, so `aria-invalid` marks the truth rather than the first
 * input in the DOM. The shell's default (no third argument) is "the dialog's first input",
 * which is correct for a one-field dialog and would have marked the MODEL input for a bad
 * BASE URL here — three inputs precede the message's subject otherwise. Anything that is
 * not the user's typo (a blocked store) gets `null`, which marks nothing.
 */
function aiErrorTarget(code, nodes) {
  if (typeof code === "string" && code.indexOf("base_url_") === 0) return nodes.baseInput;
  if (code === "key_empty") return nodes.keyInput;
  return null;
}

/** The save-path errors, in user words, with no echoed value (AC-4: never log the key). */
function aiSaveErrorMessage(code) {
  switch (code) {
    case "base_url_invalid":
      return "That base URL is not a valid address.";
    case "base_url_insecure":
      return "The base URL must be https.";
    case "base_url_contains_credential":
      return "Put the key in the API key field - not inside the base URL.";
    case "base_url_not_allowed":
      return "That base URL is not one of the hosts this extension publishes.";
    case "storage_unavailable":
      return "The extension cannot write to its own storage, so nothing was saved.";
    default:
      return "Could not save the settings.";
  }
}

/** AC-6's error classes, mapped to distinct copy (the typed errors come from js/ai_layout.js). */
function aiPingMessage(errorClass) {
  switch (errorClass) {
    case "auth":
      return "the provider rejected the key.";
    case "rate_limit":
      return "the provider is rate-limiting this key.";
    case "network":
      return "the browser could not reach the provider.";
    case "malformed":
      return "the provider's reply was not a readable response.";
    default:
      return "the transport is not available yet (or the settings are incomplete).";
  }
}

/**
 * The default 1-token ping, as of Phase 2: it REFUSES. Phase 3 owns the `BYOK_CHAT`
 * relay, and shipping a second, ungated fetch here would be the exact pattern trap the
 * spec's L-3 correction exists to warn about. The button therefore says
 * "not available yet" rather than pretending to have tested something.
 */
function aiDefaultPing() {
  return () => Promise.resolve({ ok: false, errorClass: "unavailable" });
}

// ---------------------------------------------------------------------------
// The module surface
// ---------------------------------------------------------------------------

/**
 * The module surface. Members are annotated per the re-rot guard
 * (`scripts/check_dead_exports.js`, track dead_exports_20260910 AC-5) wherever they have no
 * product caller yet: that guard searches the eight lines above a declaration, so the marker
 * has to sit INSIDE the object literal beside the name it explains, not in this block above
 * it. `AI_SETTINGS_FIELDS` is reached by `sanitizeSettings` (its only writer of the record
 * shape); `showAiSettingsModal` is Phase 4's panel-button caller.
 */
const AiSettings = {
  AI_SETTINGS_STORE_KEY,
  AI_KEY_STORE_KEY,
  // Test seam (track byok_ai_layout_20260915 Phase 2 — KEEP): the frozen field vocabulary is
  // read by `sanitizeSettings` (which builds the record FROM it) and asserted by
  // test/unit/byok_ai_settings.test.js, so the field set cannot drift silently.
  AI_SETTINGS_FIELDS,
  AI_PROVIDERS,
  AI_COMPAT_BASE_ORIGINS,
  AI_MODEL_DEFAULTS,
  loadSettings,
  saveSettings,
  getApiKey,
  hasStoredKey,
  setApiKey,
  clearApiKey,
  aiBaseUrlProblem,
  // Test seam (track byok_ai_layout_20260915 Phase 2 — KEEP): Phase 4's panel button opens this
  // dialog. Nothing in `js/` calls it yet, which is the honest state of a feature whose transport
  // lands later; its readers today are test/unit/byok_ai_settings.test.js and Phase 4's browser
  // probe. Delete this line only by deleting the dialog.
  showAiSettingsModal,
};
if (typeof module !== "undefined" && module.exports) {
  module.exports = AiSettings;
}
if (typeof window !== "undefined") {
  // Test seam: `test/unit/byok_ai_settings.test.js` reaches the store API and the dialog
  // through this (the unit boot evaluates the file into a jsdom window, so `require` is not
  // what production uses), and Phase 4's arrange flow reads `showAiSettingsModal` from it.
  window.AiSettings = AiSettings;
}
