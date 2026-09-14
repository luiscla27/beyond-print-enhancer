const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Print Opacity Verification', function() {
    let window, document;

    before(async function() {
        const html = '<!DOCTYPE html><html><body class="be-lock-shapes"><div id="print-layout-wrapper"></div></body></html>';
        const dom = new JSDOM(html, { url: 'https://www.dndbeyond.com/characters/1' });
        window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
        document = window.document;
        global.window = window;
        global.document = document;
        global.chrome = { runtime: { getURL: (p) => p } };
        global.navigator = window.navigator;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.CustomEvent = window.CustomEvent;

        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
        const sectionCloning = fs.readFileSync(path.resolve(__dirname, '../../js/section_cloning.js'), 'utf8');
        const layoutOps = fs.readFileSync(path.resolve(__dirname, '../../js/layout_ops.js'), 'utf8');
        const filters = fs.readFileSync(path.resolve(__dirname, '../../js/filters.js'), 'utf8');
        const spellsUi = fs.readFileSync(path.resolve(__dirname, '../../js/spells_ui.js'), 'utf8');
        const modals = fs.readFileSync(path.resolve(__dirname, '../../js/modals.js'), 'utf8');
        const shapePicker = fs.readFileSync(path.resolve(__dirname, '../../js/shape_picker.js'), 'utf8');
        const propertiesPanel = fs.readFileSync(path.resolve(__dirname, '../../js/properties_panel.js'), 'utf8');
        const controls = fs.readFileSync(path.resolve(__dirname, '../../js/controls.js'), 'utf8');
        const layoutScan = fs.readFileSync(path.resolve(__dirname, '../../js/layout_scan.js'), 'utf8');
        const layoutApply = fs.readFileSync(path.resolve(__dirname, '../../js/layout_apply.js'), 'utf8');
        const persistence = fs.readFileSync(path.resolve(__dirname, '../../js/persistence.js'), 'utf8');

        const sectionUtils = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
        const printStyles = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
        
        window.eval(elementWrapper);
        window.eval(domManager);
        window.eval(printStyles);
        window.eval(sectionUtils);
                window.eval(modals);
                window.eval(propertiesPanel);
                window.eval(layoutScan);
                window.eval(layoutApply);
                window.eval(persistence);
                window.eval(controls);
                window.eval(shapePicker);
                window.eval(spellsUi);
                window.eval(filters);
                window.eval(layoutOps);
        window.eval(sectionCloning);
window.eval(mainJs);

        if (window.enforceFullHeight) {
            window.enforceFullHeight();
        }
    });

    it('should have CSS rules ensuring full opacity during print for locked shapes', function() {
        const styleTag = document.getElementById('ddb-print-enhance-style');
        assert.ok(styleTag, 'Style tag should exist');
        const css = styleTag.textContent;
        
        // Check for shapes opacity in print (high specificity)
        assert.ok(css.includes('html body.be-lock-shapes .be-shape-wrapper'), 'CSS should explicitly override be-lock-shapes with high specificity');
        assert.ok(css.includes('opacity: 1 !important'), 'CSS should force opacity: 1');
    });

    it('should have CSS rules ensuring full opacity during print for locked sections', function() {
        const styleTag = document.getElementById('ddb-print-enhance-style');
        const css = styleTag.textContent;

        // Check for sections opacity in print (high specificity)
        assert.ok(css.includes('html body.be-lock-sections .be-section-wrapper'), 'CSS should explicitly override be-lock-sections with high specificity');
    });
});
