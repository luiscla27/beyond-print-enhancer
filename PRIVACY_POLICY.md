# Privacy Policy for Beyond Print Enhancer

"Beyond Print Enhancer" ("the Extension") is an open-source browser extension designed to improve the layout of D&D Beyond character sheets for printing.

This Privacy Policy describes how the Extension collects, uses, and handles your data. The Extension is designed with privacy in mind and operates almost entirely locally on your device.

## 1. Data Collection and Usage

**We do not collect, store, or transmit any of your personal data to external servers.**

*   **Character Data**: The Extension reads the HTML content of the D&D Beyond character sheet tab you are viewing to rearrange elements for printing. This processing happens entirely within your browser's local memory. No character data is sent to the developer or any third party.
*   **Settings and Preferences**: The Extension may save your layout preferences (e.g., custom coordinates for sections) locally using your browser's `IndexedDB` or `localStorage`. This data never leaves your device and is only used to restore your preferred layout.
*   **Web Browsing Activity**: The Extension only activates on pages matching `dndbeyond.com`. It does not track, collect, or store your browsing history on any other websites.

## 2. Permissions

The Extension requests the minimum permissions necessary to function:

*   `declarativeContent`: To enable the extension icon only when you are on a D&D Beyond page.
*   `activeTab`: To analyze and modify the specific tab you are viewing when you click the extension action, enabling the print layout features.
*   `scripting`: To execute the layout adjustment scripts on the page you are viewing.
*   `contextMenus`: To provide a "Donate" link in the right-click menu. This only opens a URL and does not access page content.
*   `storage`: To save your AI arrangement settings — the provider you choose, the model id, and your API key — in this browser's extension storage (`chrome.storage.local`). **This data stays on your device. It is never synced, never sent to us, and never included in a layout save.** The API key is used only to relay requests from the browser extension's own service worker to the provider you picked (OpenAI or Anthropic); it is read from storage by that worker and never placed in a message body.
*   `host_permissions`: Host permissions let the Extension send requests to specific sites. It declares four origins, and each one exists for a named feature:
    *   `https://www.dndbeyond.com/characters/*` and `https://character-service.dndbeyond.com/character/v5/character/*` — to read the character sheet you are viewing and to fetch consolidated spell data, which is not available on the primary character view. Spell details are read for the printable layout only.
    *   `https://api.openai.com/*` and `https://api.anthropic.com/*` — ONLY for the AI arrange feature, and only when you turn it on. These are the two providers you can pick, and the requests go **directly from this extension on your machine to that provider**: there is no server of ours in the path, and we cannot see the request or the answer. The provider receives the API key **you** stored (that is what "bring your own key" means) plus the section titles, positions and sizes needed to propose a layout. Requests to any origin other than the one you configured are refused by the Extension itself.

## 3. Third-Party Services

The Extension does not integrate with any third-party analytics, tracking, or advertising services.

*   **GitHub**: The source code is hosted on GitHub. If you choose to visit the repository or the "Donate" link, your interactions with GitHub are subject to [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

## 4. Limited Use Disclosure

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/user-data-faqs/), including the Limited Use requirements.

The Extension complies with the Chrome Web Store policy by:
*   Limiting its use of data (reading page content) solely to providing the user-facing feature of rearranging the print layout.
*   Not transferring any user data to third parties.
*   Not using any data for advertising or creditworthiness purposes.

## 5. Changes to this Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page and reflected in the extension's documentation.

## 6. Contact

If you have questions about this privacy policy, you can open an issue on the project's [GitHub repository](https://github.com/luiscla27/beyond-print-enhancer/issues).
