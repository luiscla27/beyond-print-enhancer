# Specification: Border Asset Migration & Optimization

## 1. Overview
This track replaces hardcoded base64-encoded border images with reference links to the extension's local `assets/` directory. It also includes necessary security permissions for the manifest and pre-calculated CSS variables (`--border-img-width`, `--border-img-slice`) to ensure optimal rendering without runtime overhead.

## 2. Functional Requirements
- **Asset Migration:**
  - Remove all base64-encoded border strings from the codebase (e.g., in `js/main.js` or `js/dom/dom_manager.js`).
  - Update the CSS injection logic to use `chrome.runtime.getURL('assets/<filename>.gif')` for each border style.
- **Manifest Updates:**
  - Add `web_accessible_resources` to `manifest.json` for `assets/*.gif` to allow the content script to load these images.
- **Variable Optimization:**
  - For each border style, calculate the correct values for `--border-img-width` and `--border-img-slice`.
  - These values must be derived from the image dimensions (metadata) to ensure pixel-perfect alignment.
  - Store these values as static constants in the code to avoid runtime calculations.
- **Legacy Logic Preservation:**
  - Keep the existing mechanism for toggling borders via CSS classes (e.g., `.border-goth1`, `.border-spikes`).

## 3. Non-Functional Requirements
- **Performance:** Removing large base64 strings reduces script size and memory usage.
- **Security:** Use restrictive glob patterns in the manifest (`assets/*.gif`) as per user preference.
- **Maintainability:** Static constants for border dimensions make it easier to add new styles in the future.

## 4. Acceptance Criteria
- [ ] All borders render correctly when selected in the UI.
- [ ] No base64 strings remain in the JavaScript or CSS files.
- [ ] `manifest.json` includes the correct `web_accessible_resources` entry.
- [ ] Border styling (slicing and width) matches the original design exactly.
- [ ] The extension loads and runs without console errors related to resource permissions.

## 5. Out of Scope
- Migrating `.png` files (e.g., `border_default.png`) unless specifically requested later.
- Adding new border styles not already present in the `assets/` directory.
- Runtime image analysis or metadata extraction during extension execution.
