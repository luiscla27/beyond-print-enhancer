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
