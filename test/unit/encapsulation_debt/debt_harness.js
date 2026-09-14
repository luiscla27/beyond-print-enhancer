/**
 * Shared test harness for the Encapsulation Code-Debt TDD suite.
 *
 * Boots a fresh jsdom window with the real production files eval'd in the
 * order the extension uses them, exactly like the pre-existing suites:
 *   js/dom/element_wrapper.js -> js/dom/dom_manager.js -> js/main.js
 * plus js/catalog_service.js on demand.
 *
 * `window.__DDB_TEST_MODE__ = true` is set BEFORE eval so main.js skips its
 * async production boot (IIFE tail: `if (window.__DDB_TEST_MODE__) return;`)
 * while still exposing all ~60 `window.*` handles under test.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const MAIN_JS_PATH = path.resolve(__dirname, "../../../js/main.js");
const ELEMENT_WRAPPER_PATH = path.resolve(
  __dirname,
  "../../../js/dom/element_wrapper.js",
);
const DOM_MANAGER_PATH = path.resolve(__dirname, "../../../js/dom/dom_manager.js");
const CATALOG_SERVICE_PATH = path.resolve(
  __dirname,
  "../../../js/catalog_service.js",
);
const CONTEXT_MENU_PATH = path.resolve(__dirname, "../../../js/context_menu.js");
const ASSET_CATALOG_PATH = path.resolve(__dirname, "../../../js/asset_catalog.js");
const STORAGE_PATH = path.resolve(__dirname, "../../../js/storage.js");
const IMAGE_PROCESSOR_PATH = path.resolve(__dirname, "../../../js/image_processor.js");
const SECTION_UTILS_PATH = path.resolve(__dirname, "../../../js/section_utils.js");
const PRINT_STYLES_PATH = path.resolve(__dirname, "../../../js/print_styles.js");
const UI_THEME_PATH = path.resolve(__dirname, "../../../js/ui_theme.js");
const ICONS_PATH = path.resolve(__dirname, "../../../js/icons.js");
const SECTION_CLONING_PATH = path.resolve(__dirname, "../../../js/section_cloning.js");
const LAYOUT_OPS_PATH = path.resolve(__dirname, "../../../js/layout_ops.js");
const FILTERS_PATH = path.resolve(__dirname, "../../../js/filters.js");
const SPELLS_UI_PATH = path.resolve(__dirname, "../../../js/spells_ui.js");
const MODALS_PATH = path.resolve(__dirname, "../../../js/modals.js");
const SHAPE_PICKER_PATH = path.resolve(__dirname, "../../../js/shape_picker.js");
const PROPERTIES_PANEL_PATH = path.resolve(__dirname, "../../../js/properties_panel.js");
const CONTROLS_PATH = path.resolve(__dirname, "../../../js/controls.js");
const PERSISTENCE_PATH = path.resolve(__dirname, "../../../js/persistence.js");
// Split out of js/persistence.js (track refactor_surface_20260911, AC-4). This harness mirrors
// the extension's own script order, so the two new modules are booted in the position
// js/persistence.js used to occupy for their seams. No CASE is touched.
const UNDO_PATH = path.resolve(__dirname, "../../../js/undo.js");
const RECOVERY_UI_PATH = path.resolve(__dirname, "../../../js/recovery_ui.js");
const LAYOUT_SCAN_PATH = path.resolve(__dirname, "../../../js/layout_scan.js");
const LAYOUT_APPLY_PATH = path.resolve(__dirname, "../../../js/layout_apply.js");

const MAIN_JS = fs.readFileSync(MAIN_JS_PATH, "utf8");
const ELEMENT_WRAPPER_JS = fs.readFileSync(ELEMENT_WRAPPER_PATH, "utf8");
const DOM_MANAGER_JS = fs.readFileSync(DOM_MANAGER_PATH, "utf8");
const CATALOG_SERVICE_JS = fs.readFileSync(CATALOG_SERVICE_PATH, "utf8");
const CONTEXT_MENU_JS = fs.readFileSync(CONTEXT_MENU_PATH, "utf8");
const ASSET_CATALOG_JS = fs.readFileSync(ASSET_CATALOG_PATH, "utf8");
const STORAGE_JS = fs.readFileSync(STORAGE_PATH, "utf8");
const IMAGE_PROCESSOR_JS = fs.readFileSync(IMAGE_PROCESSOR_PATH, "utf8");
const SECTION_UTILS_JS = fs.readFileSync(SECTION_UTILS_PATH, "utf8");
const PRINT_STYLES_JS = fs.readFileSync(PRINT_STYLES_PATH, "utf8");
const UI_THEME_JS = fs.readFileSync(UI_THEME_PATH, "utf8");
const ICONS_JS = fs.readFileSync(ICONS_PATH, "utf8");
const SECTION_CLONING_JS = fs.readFileSync(SECTION_CLONING_PATH, "utf8");
const LAYOUT_OPS_JS = fs.readFileSync(LAYOUT_OPS_PATH, "utf8");
const FILTERS_JS = fs.readFileSync(FILTERS_PATH, "utf8");
const SPELLS_UI_JS = fs.readFileSync(SPELLS_UI_PATH, "utf8");
const MODALS_JS = fs.readFileSync(MODALS_PATH, "utf8");
const SHAPE_PICKER_JS = fs.readFileSync(SHAPE_PICKER_PATH, "utf8");
const PROPERTIES_PANEL_JS = fs.readFileSync(PROPERTIES_PANEL_PATH, "utf8");
const CONTROLS_JS = fs.readFileSync(CONTROLS_PATH, "utf8");
const PERSISTENCE_JS = fs.readFileSync(PERSISTENCE_PATH, "utf8");
const UNDO_JS = fs.readFileSync(UNDO_PATH, "utf8");
const RECOVERY_UI_JS = fs.readFileSync(RECOVERY_UI_PATH, "utf8");
const LAYOUT_SCAN_JS = fs.readFileSync(LAYOUT_SCAN_PATH, "utf8");
const LAYOUT_APPLY_JS = fs.readFileSync(LAYOUT_APPLY_PATH, "utf8");

/** Standard D&D Beyond character-sheet skeleton used by most fixture builders. */
const DDB_SHEET_HTML = `<!DOCTYPE html>
<html>
  <body>
    <div id="site-main">
      <div id="site-main-body">
        <div class="ct-character-sheet-desktop">
          <div class="ct-character-sheet__inner">
            <div class="ct-section" id="ct-section-navigation"></div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

/** Minimal skills box used by splitSkillsBox tests. */
function skillsBoxHtml() {
  const row = (stat, skillName) => `
    <div class="ct-skills__item">
      <div class="ct-skills__item--stat">${stat}</div>
      <div class="ct-skills__name">${skillName}</div>
    </div>`;
  return `<!DOCTYPE html><html><body>
    <div class="ct-character-sheet-desktop">
      <div class="ct-character-sheet__inner">
        <div id="print-layout-wrapper">
          <div class="be-section-wrapper" id="section-skills-wrapper" data-title="Skills">
            <div class="print-section-container" id="section-skills">
              <div class="print-section-content">
                <div class="ct-skills__box">
                  ${row("STR", "Athletics")}
                  ${row("STR", "Intimidation")}
                  ${row("DEX", "Acrobatics")}
                  ${row("DEX", "Stealth")}
                  ${row("INT", "Arcana")}
                  ${row("INT", "History")}
                  ${row("WIS", "Perception")}
                  ${row("CHA", "Persuasion")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body></html>`;
}

/**
 * Boots a fresh jsdom window with the monolith eval'd.
 * @param {string} [html] HTML to load (defaults to DDB sheet skeleton).
 * @param {object} [opts]
 * @param {boolean} [opts.catalogService] also eval js/catalog_service.js.
 * @param {object} [opts.indexedDB] reuse another boot's IndexedDB factory, for the cases
 *   that genuinely mean "the same browser across a reload" (IndexedDB persists there).
 *   Omitted (the normal case) = a private, EMPTY factory, so no boot can see another's rows.
 * @returns {{window: Window, document: Document, cleanup: () => void, indexedDB: object}}
 */
function boot(html = DDB_SHEET_HTML, opts = {}) {
  const dom = new JSDOM(html, {
    url: "http://localhost",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });

  const window = dom.window;
  const document = window.document;

  // --- global plumbing mirroring the existing suites ---------------------
  global.window = window;
  global.document = document;
  global.HTMLElement = window.HTMLElement;
  global.NodeList = window.NodeList;
  global.Element = window.Element;
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // --- IndexedDB: ONE PRIVATE FACTORY PER BOOT ---------------------------
  // `require("fake-indexeddb")` exports a MODULE-LEVEL singleton whose databases live
  // for the life of the PROCESS, so handing that one object to every boot made one
  // boot's rows visible to the next. The damage is not cosmetic: the backup store is
  // capped at `MAX_BACKUPS` (3), so once earlier suites had left three rows behind, a
  // case that wrote one more could never reach `before + 1` — the recorded `3 !== 4`
  // (temp/archived/ISSUE_mocha_subset_backup_count_pollution_20260911.md), which only
  // reproduced when the suite was run in the right ORDER in one process. A fresh
  // `IDBFactory` per boot makes the isolation STRUCTURAL: every boot starts from an
  // empty store, whatever ran before it in the same process. Worse than the flaky red,
  // the leak had also weakened assertions in suites that had to guard against it
  // (`>= 2` instead of `=== 2`; an empty-state case that skipped itself when polluted),
  // so this is the precondition for those claims being exact again.
  //
  // A suite that means "the SAME browser across a reload" — where IndexedDB really DOES
  // persist — must now say so instead of relying on the accident: pass the first boot's
  // factory to the second, `boot(html, { indexedDB: first.indexedDB })`.
  const { IDBFactory, IDBKeyRange } = require("fake-indexeddb");
  const indexedDB = opts.indexedDB || new IDBFactory();
  window.indexedDB = indexedDB;
  window.IDBKeyRange = IDBKeyRange;
  global.indexedDB = indexedDB;
  global.IDBKeyRange = IDBKeyRange;

  window.confirm = () => true;
  window.alert = () => {};
  window.chrome = {
    runtime: { getURL: (p) => (p ? String(p) : "") },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  };

  window.__DDB_TEST_MODE__ = true;

  // --- eval production files in extension order --------------------------
  window.eval(ELEMENT_WRAPPER_JS);
  window.eval(DOM_MANAGER_JS);
  window.eval(STORAGE_JS);
  window.eval(IMAGE_PROCESSOR_JS);
  window.eval(SECTION_UTILS_JS);
  window.eval(PRINT_STYLES_JS);
  window.eval(UI_THEME_JS);
  window.eval(ICONS_JS);
  window.eval(ASSET_CATALOG_JS);
  window.eval(CONTEXT_MENU_JS);
  window.eval(SECTION_CLONING_JS);
  window.eval(LAYOUT_OPS_JS);
  window.eval(FILTERS_JS);
  window.eval(SPELLS_UI_JS);
  window.eval(MODALS_JS);
  window.eval(SHAPE_PICKER_JS);
  window.eval(PROPERTIES_PANEL_JS);
  window.eval(CONTROLS_JS);
  window.eval(LAYOUT_SCAN_JS);
  window.eval(LAYOUT_APPLY_JS);
  window.eval(UNDO_JS);
  window.eval(RECOVERY_UI_JS);
  window.eval(PERSISTENCE_JS);
  window.eval(MAIN_JS);
  if (opts.catalogService) {
    window.eval(CATALOG_SERVICE_JS);
  }

  function cleanup() {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.NodeList;
    delete global.Element;
    delete global.indexedDB;
    delete global.IDBKeyRange;
  }

  return { window, document, cleanup, indexedDB };
}

/** Adds a `.be-section-wrapper` around every `.ct-subsection` (post-boot). */
function wrapSections(document) {
  document.querySelectorAll(".ct-subsection, .ct-section").forEach((section) => {
    if (!section.closest(".be-section-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.className = "be-section-wrapper";
      section.parentNode.insertBefore(wrapper, section);
      wrapper.appendChild(section);
    }
  });
}

/**
 * Wait until `predicate()` is true (or the timeout expires).
 *
 * WHY THIS EXISTS (track destructive_recovery_20260911, AC-1): a destructive
 * action now writes a BACKUP before it mutates, so its effect lands after a storage
 * round-trip instead of on the next tick. Polling for the effect is a STRONGER
 * assertion than a fixed `setTimeout(0)`, and it does not encode how long the
 * durability step happens to take.
 */
async function waitFor(predicate, { timeout = 2000, interval = 5 } = {}) {
  const started = Date.now();
  for (;;) {
    if (predicate()) return true;
    if (Date.now() - started > timeout) return predicate();
    await new Promise((r) => setTimeout(r, interval));
  }
}

module.exports = { boot, wrapSections, waitFor, DDB_SHEET_HTML, skillsBoxHtml };
