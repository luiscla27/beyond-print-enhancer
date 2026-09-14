const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Layout Stabilization', () => {
    let window, document;

    beforeEach(() => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
            url: 'https://www.dndbeyond.com/characters/123',
            runScripts: "dangerously",
            resources: "usable"
        });
        window = dom.window;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.navigator = window.navigator;

        const mainJsCode = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
        const sectionUtilsCode = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
        const printStylesCode = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
        const sectionCloningCode = fs.readFileSync(path.resolve(__dirname, '../../js/section_cloning.js'), 'utf8');
        const layoutOpsCode = fs.readFileSync(path.resolve(__dirname, '../../js/layout_ops.js'), 'utf8');
        const filtersCode = fs.readFileSync(path.resolve(__dirname, '../../js/filters.js'), 'utf8');
        const spellsUiCode = fs.readFileSync(path.resolve(__dirname, '../../js/spells_ui.js'), 'utf8');
        const modalsCode = fs.readFileSync(path.resolve(__dirname, '../../js/modals.js'), 'utf8');
        const shapePickerCode = fs.readFileSync(path.resolve(__dirname, '../../js/shape_picker.js'), 'utf8');
        const propertiesPanelCode = fs.readFileSync(path.resolve(__dirname, '../../js/properties_panel.js'), 'utf8');
        const controlsCode = fs.readFileSync(path.resolve(__dirname, '../../js/controls.js'), 'utf8');
        const layoutScanCode = fs.readFileSync(path.resolve(__dirname, '../../js/layout_scan.js'), 'utf8');
        const layoutApplyCode = fs.readFileSync(path.resolve(__dirname, '../../js/layout_apply.js'), 'utf8');
        const persistenceCode = fs.readFileSync(path.resolve(__dirname, '../../js/persistence.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = `
            window.__DDB_TEST_MODE__ = true;
            ${modalsCode}
            ${propertiesPanelCode}
            ${layoutScanCode}
            ${layoutApplyCode}
            ${persistenceCode}
            ${controlsCode}
            ${shapePickerCode}
            ${spellsUiCode}
            ${filtersCode}
            ${layoutOpsCode}
            ${sectionCloningCode}
            ${sectionUtilsCode}
            ${printStylesCode}
            ${mainJsCode}
        `;
        document.body.appendChild(scriptEl);
    });

    it('should suppress window.onresize', () => {
        window.onresize = () => { window.__RESIZED = true; };
        window.suppressResizeEvents();
        assert.strictEqual(window.onresize, null, 'window.onresize should be nullified');
    });

    it('should intercept and block NEW resize event listeners', () => {
        window.suppressResizeEvents();

        let resizeTriggered = false;
        window.addEventListener('resize', () => {
            resizeTriggered = true;
        });

        window.dispatchEvent(new window.Event('resize'));
        assert.strictEqual(resizeTriggered, false, 'NEW resize event should have been blocked');
    });

    it('should block EXISTING resize event listeners added before suppression', () => {
        let existingTriggered = false;
        // Simulating React listener added before extension
        window.addEventListener('resize', () => {
            existingTriggered = true;
        });

        window.suppressResizeEvents();

        window.dispatchEvent(new window.Event('resize'));
        assert.strictEqual(existingTriggered, false, 'EXISTING resize event should have been blocked');
    });
});
