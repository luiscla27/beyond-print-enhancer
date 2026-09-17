// Track byok_ai_layout_20260915 (Phase 3): the worker owns the credential and the only
// outbound AI request. MV3 service workers load their dependencies with `importScripts`, and
// BOTH files below are written to be loadable two ways — the content-script injection list
// evaluates them into the isolated world, and the worker's own global scope gets their
// top-level bindings here. Which names each one declares was checked for collision against
// this file's before wiring it (`markOn` / `clearState`): the three sets are disjoint.
//
// `js/ai_layout.js` is the pure core (request builder + response parser, no `chrome.*`, no
// `document`), and `js/ai_settings.js` is the store — which is how the key is read HERE and
// only here: `getApiKey()` resolves `chrome.storage.local`, and a service worker has that
// API whether or not a content script does. Nothing in the message body carries a credential
// or a URL, so the two origins the manifest hosts are the only places a request can go.
importScripts("js/ai_layout.js", "js/ai_settings.js");

// When the extension is installed or upgraded ...
chrome.runtime.onInstalled.addListener(function() {
  // Replace all rules ...
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    // With a new rule ...
    chrome.declarativeContent.onPageChanged.addRules([{
      // That fires when a page's URL contains a 'dndbeyond' ...
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlContains: 'dndbeyond' },
        })
      ],
      // And shows the extension's page action.
      actions: [ new chrome.declarativeContent.ShowAction() ]
    }]);
  });
});



chrome.action.onClicked.addListener(function(tab) {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      'js/catalog_service.js',
      'js/spells.js',
      'js/dom/element_wrapper.js',
      'js/dom/dom_manager.js',
      'js/dom/layer_manager.js',
      'js/storage.js',
      'js/image_processor.js',
      'js/section_utils.js',
      'js/print_styles.js',
      'js/ui_theme.js',
      'js/icons.js',
      'js/asset_catalog.js',
      'js/context_menu.js',
      'js/section_cloning.js',
      'js/layout_ops.js',
      'js/filters.js',
      'js/spells_ui.js',
      'js/modals.js',
      // Track byok_ai_layout_20260915 (Phase 2): the BYOK config store and its dialog. Placed
      // AFTER js/modals.js because the dialog resolves the `Modals.__createModal` seam — at CALL
      // time, not at load — so this is tidiness, not a correctness constraint. The other new AI
      // module, js/ai_layout.js, is deliberately NOT listed: it is the pure core (no DOM, no
      // chrome.*) with no `window.*` seam yet, and Phase 4 adds that seam in the same commit that
      // gives it its first product caller, which is also when it joins this list. Shipping it
      // here now would inject bytes nothing can reach.
      'js/ai_settings.js',
      'js/shape_picker.js',
      'js/properties_panel.js',
      'js/controls.js',
      'js/layout_scan.js',
      'js/layout_apply.js',
      // Split out of js/persistence.js (track refactor_surface_20260911, AC-4): the undo
      // stack + capture protocol, then the recovery surfaces. The seams did not move name-,
      // only hands, and every cross-module call resolves through window.* at CALL time.
      'js/undo.js',
      'js/recovery_ui.js',
      'js/persistence.js',
      'js/dnd.js',
      'js/main.js'
    ]
  }).then(function () {
    // Registration is left to the content script's own "DDB_IS_ON" message (see below) rather than
    // being assumed here: this callback knows the injection was REQUESTED, and the badge's whole job
    // is to report whether it actually took effect.
  });
});

// ---------------------------------------------------------------------------
// The on/off state on the toolbar icon (AC-4, track first_run_and_panel_20260911).
//
// WHY IT IS SESSION-SCOPED, AND WHY IT LIVES HERE. The operator's O-4 chose a session-scoped
// teardown re-activated by the icon, so the state is exactly "is the extension's script injected
// into this tab right now" — which only the service worker knows. It is NOT persisted, because a
// persisted "off" would answer a different question (a preference) than the one the user asks by
// glancing at the icon (what is happening on this page).
//
// THE CLEARING EDGE IS THE WHOLE POINT. A badge set on injection would otherwise keep claiming ON
// after the user switched tabs, navigated, or reloaded — the three ways the injected scripts
// actually disappear. So navigation clears it: that IS the off state, and it is what makes the
// badge trustworthy rather than decorative.
// The clearing edge is the whole point: a badge set on injection would otherwise keep claiming ON
// after the user switched tabs, navigated or reloaded — the three ways the injected scripts actually
// disappear. So navigation clears it. That IS the off state, and it is what makes the badge
// trustworthy rather than decorative.
function markOn(tabId) {  if (typeof tabId !== "number") return;
  try {
    chrome.action.setBadgeText({ tabId: tabId, text: "ON" });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#4A3E2B" });
  } catch {
    /* a closed tab racing the injection is not an error worth surfacing */
  }
}

function clearState(tabId) {
  if (typeof tabId !== "number") return;
  try {
    chrome.action.setBadgeText({ tabId: tabId, text: "" });
  } catch {
    /* as above */
  }
}

// A navigation means the injected scripts are gone, so the badge must stop claiming they are there.
// `loading` (not `complete`) so the icon is honest for the whole reload rather than only after it.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
  if (changeInfo.status === "loading") clearState(tabId);
});

// The in-page control tells us directly, so the badge clears the instant the user chooses it rather
// than when the reload gets as far as `loading`. And the content script announces its own boot, which
// is what SETS the badge — see the note in markOn's call site for why the click handler is not the
// right place to learn that.
chrome.runtime.onMessage.addListener(function(request, sender) {
  if (!request) return;
  const fromTab = sender && sender.tab && sender.tab.id;
  if (request.type === "DDB_IS_ON") markOn(fromTab);
  if (request.type === "DDB_TURNED_OFF") clearState(fromTab);
});

// Create the context menu
chrome.contextMenus.create({
  id: "sponsor",
  title: "Sponsor",
  contexts: ["action"]
});
// Create the context menu
chrome.contextMenus.create({
  id: "donate",
  title: "Donate",
  contexts: ["action"]
});
chrome.contextMenus.create({
  id: "buy-me-a-coffee",
  title: "Buy me a coffee",
  contexts: ["action"]
});

// AC-3 (track first_run_and_panel_20260911): the panel's two HELP-tray rows moved HERE, to the
// extension's own action-icon menu, where the funding destinations already live.
//
// WHY THEY MOVED. The panel carried "Feedback" (a bug-report link) and "Contribute" (a fundraising
// link) in a tray labelled HELP, on equal footing with each other. The measurement that framed the
// finding is worth keeping: BOTH rows were already BELOW THE FOLD (tops 728 and 764 against a 586px
// scrollport), so they never crowded the working surface and no user cost was evidenced. The
// narrower complaint is the one this fixes — a tray named HELP whose second row raises money. The
// operator chose the move over AC-3's other legitimate outcome ("measured, no change").
//
// WHAT MUST STAY TRUE (AC-3b/c/d, each verified rather than asserted):
//   * nothing is DELETED — both destinations are still reachable, from here;
//   * no monetisation channel becomes unreachable — sponsor, donate and coffee were already here,
//     and "Contribute" (the project's repository page) joins them;
//   * the total number of ASKS does not increase: two rows left the panel and two entries arrived
//     here, so the count is unchanged at five.
// They are the LAST two entries on purpose: the funding destinations stay grouped above them.
chrome.contextMenus.create({
  id: "contribute",
  title: "Contribute",
  contexts: ["action"]
});
chrome.contextMenus.create({
  id: "feedback",
  title: "Report a bug or request a feature",
  contexts: ["action"]
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "sponsor") {
    // Open the funding page in a new tab
    chrome.tabs.create({
      url: "https://github.com/sponsors/luiscla27"
    });
  }
  if (info.menuItemId === "donate") {
    // Open the funding page in a new tab
    chrome.tabs.create({
      url: "https://www.paypal.com/paypalme/luiscla27"
    });
  }
  if (info.menuItemId === "buy-me-a-coffee") {
    // Open the funding page in a new tab
    chrome.tabs.create({
      url: "https://buymeacoffee.com/luiscla27"
    });
  }
  if (info.menuItemId === "contribute") {
    chrome.tabs.create({
      url: "https://github.com/luiscla27/beyond-print-enhancer"
    });
  }
  if (info.menuItemId === "feedback") {
    chrome.tabs.create({
      url: "https://github.com/luiscla27/beyond-print-enhancer/issues"
    });
  }
});

// Handle cross-origin fetch for character data
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_CHARACTER_DATA') {
    fetch(request.url)
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

// ---------------------------------------------------------------------------
// BYOK_CHAT — the AI relay (track byok_ai_layout_20260915, Phase 3, AC-5).
//
// WHAT THIS IS. The arrange flow needs a provider request, and MV3 says the request must be
// made from the worker (a content script's fetch is bound by the page's CORS). So the content
// script asks the worker, the worker reads the credential OUT OF STORAGE ITSELF, and the only
// thing that crosses the message boundary is a provider, a model id, and the messages the pure
// core already built. AC-5's whole claim is about that direction of travel: the key goes from
// storage to one `fetch`, never from a message body to anywhere.
//
// WHY IT COPIES `FETCH_CHARACTER_DATA`'S SHAPE AND NOT ITS GATE. `:195-204` above is the
// async shape that works — `fetch` → `sendResponse`, `return true` to keep the channel open.
// Its URL handling is the thing NOT to copy: it dials `request.url`, whatever the caller
// supplied, with no sender check at all. Phase 0 measured that there is no sender gate
// anywhere in this worker (`chrome.runtime.id` 0 hits) and that no hostile page can reach the
// existing handler today (no `content_scripts` entry, no `externally_connectable`, no
// `world: "MAIN"`), so the existing relay is a pattern trap rather than a live hole. This
// handler is the moment the trap would snap shut — a handler attached to a stored credential —
// so the gate is written here, from scratch, and the URL is NEVER taken from the body. The
// cross-project handoff for the pre-existing pattern lives in telegram_orchestrator's
// temp/issues/ISSUE_dndb_relay_un_gated_arbitrary_url_byok_20260915.md; fixing THAT is not
// this track's business and this handler does not depend on it.
//
// WHAT IS REFUSED, and each refusal is a named probe rather than a comment:
//   * a sender that is not this extension's own content script on dndbeyond.com
//     (`sender_identity`, `sender_origin`) — probe `no_sender_check_inheritance`;
//   * a body that smuggles its own `apiKey`, `url`, `baseUrl` or `allowedBaseOrigins`
//     (`request_smuggling`) — probe `key_shape`. It is refused rather than IGNORED on
//     purpose: silently dropping a smuggled key would let a caller believe it had sent one,
//     and the field would rot into "optional" in someone's head;
//   * a target origin that the manifest does not host (`provider_origin_lock`) — probe of the
//     same name. `buildRequest` already resolves the base through `resolveBase`; the check
//     below runs AGAINST THE FINISHED URL, because the property worth pinning is "the string
//     we are about to hand to fetch has an approved origin", which is the last moment it is
//     still checkable.
//
// NOTHING HERE LOGS A REQUEST. There is no `console` in this file and no `safeLog` (that sink
// lives in the content script), and the refusal/telemetry payloads are built from an explicit
// field list rather than from `...request`, so an unexpected body key cannot ride out of the
// worker in a response. The one counter that does accumulate (`byokRelayStats`) counts
// decisions and records origins, never a header, a body, or a key.
// ---------------------------------------------------------------------------

/** The one page origin this relay answers. Trailing slash is part of the prefix. */
const BYOK_PAGE_ORIGIN_PREFIX = "https://www.dndbeyond.com/";

/** The fields a legitimate body may carry. Anything else is a smuggling attempt. */
const BYOK_ALLOWED_REQUEST_KEYS = Object.freeze([
  "type",
  "provider",
  "model",
  "messages",
  "maxTokens",
]);

/** The names whose presence in a body is itself the refusal reason. */
const BYOK_SMUGGLED_KEYS = Object.freeze([
  "apikey",
  "api_key",
  "key",
  "token",
  "url",
  "baseurl",
  "base_url",
  "allowedbaseorigins",
  "headers",
  "host",
  "origin",
]);

/**
 * Per-decision counts, kept in the worker for the browser probes to read. Deliberately NOT
 * a log: an origin string and a tally, and no request content of any kind.
 */
const byokRelayStats = {
  handled: 0,
  refused: { sender_identity: 0, sender_origin: 0, request_smuggling: 0, provider_origin_lock: 0 },
  lastTargetOrigin: "",
};

/** A stable error shape. `message` is user-facing copy and never contains a credential. */
function byokRefusal(code, message) {
  return { ok: false, transport: code, errorClass: code, message: message || "" };
}

/**
 * THE SENDER GATE, written from scratch (see the header: there is no sibling to imitate).
 * Two independent conditions, both required:
 *   1. `sender.id` is THIS extension. The badge listener above does not check it, because a
 *      wrong answer there costs a stale icon; a wrong answer here costs a drained account.
 *   2. the tab's URL is a dndbeyond.com page. A worker can be reached from a popup or an
 *      options page eventually; an AI request must not ride in from one of those.
 */
function byokSenderProblem(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return "sender_identity";
  const url = sender.tab && typeof sender.tab.url === "string" ? sender.tab.url : "";
  if (url.indexOf(BYOK_PAGE_ORIGIN_PREFIX) !== 0) return "sender_origin";
  return "";
}

/**
 * The body gate. Case-folded suffix match, so `apiKey`, `API_KEY` and `api_key` are the same
 * attempt, and the check runs over the TOP-LEVEL keys only — the messages themselves are
 * opaque strings this worker must not parse, and a provider payload inside `messages` is the
 * content script's business, not an instruction to the transport.
 */
function byokSmuggledKeys(request) {
  const found = [];
  for (const key of Object.keys(request)) {
    const flat = String(key).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (BYOK_SMUGGLED_KEYS.includes(flat)) found.push(String(key));
    else if (!BYOK_ALLOWED_REQUEST_KEYS.includes(String(key))) found.push(String(key));
  }
  return found;
}

/** The origin of a built target, or "" — one parse site so the tally and the lock agree. */
function byokOriginOf(rawUrl) {
  try {
    return new URL(String(rawUrl)).origin;
  } catch {
    return "";
  }
}

/**
 * The origin lock — the indirect-leak case. A relayed request whose FINISHED url is not an
 * origin the manifest hosts would let an attacker-driven POST carry an `Authorization` header
 * built from the stored key to a host of theirs: the key never transits the boundary and the
 * account is still drained. `buildRequest` refuses an unapproved base URL upstream, and this
 * is the second check, on the string that is actually about to leave.
 */
function byokTargetProblem(target) {
  const url = target && typeof target.url === "string" ? target.url : "";
  const origin = byokOriginOf(url);
  if (!origin) return "the relayed target is not a URL";
  const published = Object.keys(PROVIDERS).map((id) => byokOriginOf(PROVIDERS[id].base));
  const listed = (Array.isArray(AI_COMPAT_BASE_ORIGINS) ? AI_COMPAT_BASE_ORIGINS : []).map(
    byokOriginOf,
  );
  if (published.includes(origin) || listed.includes(origin)) return "";
  return "refused: " + origin + " is not an origin this extension hosts";
}

/**
 * `chrome.runtime.sendMessage` never resolves when the worker closes or the handler forgets to
 * answer, and a settings dialog cannot hang on that. The timeout is a refusal, not a crash:
 * the caller gets `transport_timeout` and says so.
 */
const BYOK_REQUEST_TIMEOUT_MS = 45000;

function byokChatReply(request) {
  const senderProblem = byokSenderProblem(byokChatReply._sender);
  if (senderProblem) {
    byokRelayStats.refused[senderProblem] += 1;
    return Promise.resolve(
      byokRefusal(
        senderProblem,
        senderProblem === "sender_identity"
          ? "The request did not come from this extension."
          : "AI arrange only runs on a dndbeyond.com character sheet.",
      ),
    );
  }
  if (!request || typeof request !== "object") {
    return Promise.resolve(byokRefusal("request_shape", "The request carries no settings."));
  }
  const smuggled = byokSmuggledKeys(request);
  if (smuggled.length) {
    byokRelayStats.refused.request_smuggling += 1;
    // The refusal names the FIELDS, never their values: echoing a smuggled key would be the
    // one way for this handler to put a credential in a response body.
    return Promise.resolve(
      byokRefusal(
        "request_smuggling",
        "The request must not carry " + smuggled.join(", ") + " — the worker reads storage itself.",
      ),
    );
  }

  const provider = typeof request.provider === "string" ? request.provider : "";
  // The credential and the stored base URL are read from STORAGE, in the worker, in one go.
  // O-1's sentence — "the URL may be read only from stored config, never from a message body" —
  // is satisfied structurally here: the body's only keys are the four the gate allows, and the
  // two values that decide WHERE the request goes are both storage-side.
  return Promise.all([getApiKey(), loadSettings()]).then(([apiKey, settings]) => {
    if (!apiKey) {
      // Not an error to invent copy for: the arrange flow gates on hasStoredKey() before it
      // gets here (O-2), so this path answers "no key" honestly instead of dialing a provider
      // with an empty Authorization header.
      return byokRefusal("api_key_required", ERROR_CLASSES.unknown);
    }
    let target;
    try {
      target = buildRequest({
        provider,
        model: request.model,
        messages: request.messages,
        maxTokens: request.maxTokens,
        apiKey,
        baseUrl: settings.baseUrl,
        // The published compatible list, from the CODE — never from the body.
        allowedBaseOrigins: AI_COMPAT_BASE_ORIGINS,
      });
    } catch (err) {
      // `buildRequest` throws TYPED errors (unknown_provider / api_key_required /
      // base_url_not_allowed / …). The message is redacted because a provider-shaped value
      // could otherwise be echoed back.
      const code = err && err.code ? String(err.code) : "request_shape";
      return byokRefusal(code, redactCredentials(err && err.message ? err.message : ""));
    }

    const lockProblem = byokTargetProblem(target);
    if (lockProblem) {
      byokRelayStats.refused.provider_origin_lock += 1;
      return byokRefusal("provider_origin_lock", lockProblem);
    }
    byokRelayStats.handled += 1;
    byokRelayStats.lastTargetOrigin = byokOriginOf(target.url);

    const dialed = fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: JSON.stringify(target.body),
    })
      .then((response) =>
        response
          .text()
          .then((text) => ({ status: response.status, body: text, headers: response.headers })),
      )
      // ONE decode site, and it is the pure core's: `parseResponse` accepts a parsed object OR
      // a string, so this worker never hand-rolls a `.json()` that could throw.
      .then((raw) => parseResponse(provider, raw))
      .catch((err) => parseResponse(provider, err));

    // The timeout is a REFUSAL with its own class, not a crash and not a silent hang: a
    // settings dialog or an arrange bar that never gets an answer is indistinguishable from a
    // dead extension from the user's side. `parseResponse` already types an AbortError as
    // `aborted`, so the copy is consistent with a user cancelling.
    let timer = null;
    const deadline = new Promise((resolve) => {
      timer = setTimeout(
        () => resolve(byokRefusal("aborted", ERROR_CLASSES.aborted)),
        BYOK_REQUEST_TIMEOUT_MS,
      );
    });
    return Promise.race([dialed, deadline]).then((reply) => {
      clearTimeout(timer);
      return reply;
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || request.type !== "BYOK_CHAT") return;
  // The sender is threaded through the call rather than passed down every layer: the value must
  // come from the runtime's own `sender` argument and nowhere else, so a body cannot carry one.
  byokChatReply._sender = sender;
  const settle = (reply) => {
    // Never hand back the request's own shape — build the reply from the verdict's fields.
    const out = {
      ok: reply && reply.ok === true,
      transport: (reply && reply.transport) || "",
      errorClass: (reply && reply.errorClass) || "",
      message: reply && reply.message ? redactCredentials(reply.message) : "",
    };
    if (out.ok) out.text = String(reply.text || "");
    if (reply && typeof reply.status === "number") out.status = reply.status;
    if (reply && typeof reply.retryAfterSeconds === "number") {
      out.retryAfterSeconds = reply.retryAfterSeconds;
    }
    sendResponse(out);
  };
  Promise.resolve()
    .then(() => byokChatReply(request))
    .then(settle)
    .catch((err) =>
      settle({
        ok: false,
        transport: "worker_failure",
        errorClass: "unknown",
        message: redactCredentials(err && err.message ? err.message : ""),
      }),
    );
  return true; // Keep channel open for async response — the shape `:195` proved works.
});

