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
    files: ['js/main.js']
  });
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
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
});
