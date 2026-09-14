const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const sectionUtilsPath = path.resolve(__dirname, '../../js/section_utils.js');
const sectionUtilsContent = fs.readFileSync(sectionUtilsPath, 'utf8');
const sectionCloningPath = path.resolve(__dirname, '../../js/section_cloning.js');
const sectionCloningContent = fs.readFileSync(sectionCloningPath, 'utf8');
const layoutOpsPath = path.resolve(__dirname, '../../js/layout_ops.js');
const layoutOpsContent = fs.readFileSync(layoutOpsPath, 'utf8');
const filtersPath = path.resolve(__dirname, '../../js/filters.js');
const filtersContent = fs.readFileSync(filtersPath, 'utf8');
const spellsUiPath = path.resolve(__dirname, '../../js/spells_ui.js');
const spellsUiContent = fs.readFileSync(spellsUiPath, 'utf8');
const modalsPath = path.resolve(__dirname, '../../js/modals.js');
const modalsContent = fs.readFileSync(modalsPath, 'utf8');
const shapePickerPath = path.resolve(__dirname, '../../js/shape_picker.js');
const shapePickerContent = fs.readFileSync(shapePickerPath, 'utf8');
const propertiesPanelPath = path.resolve(__dirname, '../../js/properties_panel.js');
const propertiesPanelContent = fs.readFileSync(propertiesPanelPath, 'utf8');
const controlsPath = path.resolve(__dirname, '../../js/controls.js');
const controlsContent = fs.readFileSync(controlsPath, 'utf8');
const layoutScanPath = path.resolve(__dirname, '../../js/layout_scan.js');
const layoutScanContent = fs.readFileSync(layoutScanPath, 'utf8');
const layoutApplyPath = path.resolve(__dirname, '../../js/layout_apply.js');
const layoutApplyContent = fs.readFileSync(layoutApplyPath, 'utf8');
const persistencePath = path.resolve(__dirname, '../../js/persistence.js');
const persistenceContent = fs.readFileSync(persistencePath, 'utf8');

const printStylesPath = path.resolve(__dirname, '../../js/print_styles.js');
const printStylesContent = fs.readFileSync(printStylesPath, 'utf8');

describe('Composite Filters Logic', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
        <div class="print-section-container _border-test">Border</div>
        <div class="print-section-content">Content</div>
    </body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;

    document = window.document;

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    window.__DDB_TEST_MODE__ = true;
    window.eval(printStylesContent);
    window.eval(sectionUtilsContent);
    window.eval(modalsContent);
    window.eval(propertiesPanelContent);
    window.eval(layoutScanContent);
    window.eval(layoutApplyContent);
    window.eval(persistenceContent);
    window.eval(controlsContent);
    window.eval(shapePickerContent);
    window.eval(spellsUiContent);
    window.eval(filtersContent);
    window.eval(layoutOpsContent);
    window.eval(sectionCloningContent);
    window.eval(mainJsContent);
  });

  it('should apply composite filter string to decorative elements', function() {
    const filters = {
        hue: 90,
        contrast: 150,
        greyscale: 50,
        saturate: 120,
        sepia: 30
    };
    
    window.applyGlobalFilters(filters);
    
    // Check CSS variables on root
    const rootStyle = document.documentElement.style;
    const fullFilter = rootStyle.getPropertyValue('--be-full-filter');
    
    assert.ok(fullFilter.includes('hue-rotate(90deg)'), 'Hue missing from variable');
    assert.ok(fullFilter.includes('contrast(150%)'), 'Contrast missing from variable');
    assert.ok(fullFilter.includes('grayscale(50%)'), 'Greyscale missing from variable');
    assert.ok(fullFilter.includes('saturate(120%)'), 'Saturate missing from variable');
    assert.ok(fullFilter.includes('sepia(30%)'), 'Sepia missing from variable');

    const decFilter = rootStyle.getPropertyValue('--be-decoration-filter');
    assert.ok(!decFilter.includes('hue-rotate'), 'Decoration filter should NOT contain hue-rotate');
    assert.ok(decFilter.includes('contrast(150%)'), 'Decoration filter missing contrast');
  });

  it('should apply inverse filters to excluded elements', function() {
    const filters = {
        hue: 100,
        contrast: 200,
        greyscale: 0,
        saturate: 100,
        sepia: 0
    };
    
    window.applyGlobalFilters(filters);
    
    // Check CSS variables on root
    const rootStyle = document.documentElement.style;
    const invHueFilter = rootStyle.getPropertyValue('--be-inv-hue-filter');
    
    assert.strictEqual(invHueFilter, 'hue-rotate(-100deg)', 'Inverse hue variable mismatch');
    
    // The CSS rule should now reference the variable
    const css = document.getElementById('be-global-filters-style').textContent;
    assert.ok(css.includes('var(--be-inv-hue-filter)'), 'Content rule should use variable');
  });

  it('should exclude control panel from all filters', function() {
    const filters = { hue: 10, contrast: 110, greyscale: 10, saturate: 110, sepia: 10 };
    window.applyGlobalFilters(filters);
    
    const css = document.getElementById('be-global-filters-style').textContent;
    assert.ok(css.includes('#print-enhance-controls'), 'Control panel selector missing');
    assert.ok(css.includes('filter: none !important'), 'Filter none missing for control panel');
  });
});
