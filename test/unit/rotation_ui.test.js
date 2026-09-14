const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Rotation UI Injection', function() {
    let window, document;

    before(async function() {
        const html = '<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div></body></html>';
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

        // Load dependencies
        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const contextMenu = fs.readFileSync(path.resolve(__dirname, '../../js/context_menu.js'), 'utf8');
        const assetCatalog = fs.readFileSync(path.resolve(__dirname, '../../js/asset_catalog.js'), 'utf8');
        const storage = fs.readFileSync(path.resolve(__dirname, '../../js/storage.js'), 'utf8');
        const imageProcessor = fs.readFileSync(path.resolve(__dirname, '../../js/image_processor.js'), 'utf8');
        const sectionUtils = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
        const printStyles = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
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


        // Execute scripts in JSDOM context
        window.eval(elementWrapper);
        window.eval(domManager);
        window.eval(printStyles);
        window.eval(sectionUtils);
        window.eval(imageProcessor);
        window.eval(storage);
        window.eval(assetCatalog);
        window.eval(contextMenu);
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
    });

    it('should inject a rotation handle when a shape is clicked in Shapes Mode', function() {
        // Enable Shapes Mode
        if (window.toggleShapesMode) {
            window.toggleShapesMode(true);
        } else {
            document.body.classList.add('be-shapes-mode-active');
        }

        // Create a shape
        const shapeWrapper = window.createShape('assets/shapes/corner_spikes.webp');
        assert.ok(shapeWrapper, 'Shape should be created');

        // Initially no handle
        let handle = shapeWrapper.querySelector('.be-rotation-handle');
        assert.strictEqual(handle, null, 'Handle should not exist initially');

        // Click the Rotate button to toggle the tool
        const rotateBtn = shapeWrapper.querySelector('.be-shape-rotate');
        assert.ok(rotateBtn, 'Rotate button should exist');
        rotateBtn.click();

        // Handle should now exist
        handle = shapeWrapper.querySelector('.be-rotation-handle');
        assert.ok(handle, 'Rotation handle should be injected after toggle in Shapes Mode');
    });

    it('should NOT inject a rotation handle when NOT in Shapes Mode', function() {
        // Disable Shapes Mode
        if (window.toggleShapesMode) {
            window.toggleShapesMode(false);
        } else {
            document.body.classList.remove('be-shapes-mode-active');
        }

        // Create another shape
        const shapeWrapper = window.createShape('assets/border_default.webp');
        
        // Click it
        const clickEvent = new window.MouseEvent('click', { bubbles: true });
        shapeWrapper.dispatchEvent(clickEvent);

        // Handle should NOT exist
        const handle = shapeWrapper.querySelector('.be-rotation-handle');
        assert.strictEqual(handle, null, 'Rotation handle should NOT be injected when Shapes Mode is OFF');
    });
});
