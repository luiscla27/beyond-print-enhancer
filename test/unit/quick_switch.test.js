const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

describe('Quick Switch Feature', function() {
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

        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const contextMenu = fs.readFileSync(path.resolve(__dirname, '../../js/context_menu.js'), 'utf8');
        const assetCatalog = fs.readFileSync(path.resolve(__dirname, '../../js/asset_catalog.js'), 'utf8');
        const storage = fs.readFileSync(path.resolve(__dirname, '../../js/storage.js'), 'utf8');
        const imageProcessor = fs.readFileSync(path.resolve(__dirname, '../../js/image_processor.js'), 'utf8');
        const sectionUtils = fs.readFileSync(path.resolve(__dirname, '../../js/section_utils.js'), 'utf8');
        const printStyles = fs.readFileSync(path.resolve(__dirname, '../../js/print_styles.js'), 'utf8');
        const dnd = fs.readFileSync(path.resolve(__dirname, '../../js/dnd.js'), 'utf8');
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


        window.eval(elementWrapper);
        window.eval(domManager);
        window.eval(dnd);
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

    it('should switch shape asset while preserving transforms', function() {
        // 1. Create a shape with specific transforms
        const initialAsset = 'assets/shapes/corner_spikes.webp';
        const shapeWrapper = window.createShape(initialAsset, {
            left: '123px',
            top: '456px',
            width: '100px',
            height: '100px',
            rotation: '45'
        });

        const container = shapeWrapper.querySelector('.be-shape-container');
        assert.ok(container, 'Container should exist');
        
        // Verify initial state
        assert.strictEqual(shapeWrapper.style.left, '123px');
        assert.strictEqual(shapeWrapper.style.top, '456px');
        assert.strictEqual(container.style.width, '100px');
        assert.strictEqual(shapeWrapper.dataset.rotation, '45');

        // 2. Switch to a new asset
        const newAsset = 'assets/shapes/corner_dwarf.webp';
        window.applyShapeAsset(container, newAsset);
        
        // 3. Verify transforms are preserved
        // applyShapeAsset only touches the inner container styles and classes,
        // it shouldn't touch the wrapper's top/left/transform.
        assert.strictEqual(shapeWrapper.style.left, '123px', 'Left should be preserved');
        assert.strictEqual(shapeWrapper.style.top, '456px', 'Top should be preserved');
        assert.strictEqual(container.style.width, '100px', 'Width should be preserved');
        assert.strictEqual(shapeWrapper.dataset.rotation, '45', 'Rotation dataset should be preserved');
        
        // Check if the asset was actually updated (e.g. img src changed)
        const img = container.querySelector('img');
        assert.ok(img, 'Img should exist');
        assert.ok(img.src.includes(newAsset), 'Img src should be updated to new asset');
    });
});
