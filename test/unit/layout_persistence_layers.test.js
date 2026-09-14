const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const layerManagerPath = path.resolve(__dirname, '../../js/dom/layer_manager.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');

const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const layerManagerContent = fs.readFileSync(layerManagerPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');
const contextMenuPath = path.resolve(__dirname, '../../js/context_menu.js');
const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
const assetCatalogPath = path.resolve(__dirname, '../../js/asset_catalog.js');
const assetCatalogContent = fs.readFileSync(assetCatalogPath, 'utf8');
const storagePath = path.resolve(__dirname, '../../js/storage.js');
const storageContent = fs.readFileSync(storagePath, 'utf8');
const imageProcessorPath = path.resolve(__dirname, '../../js/image_processor.js');
const imageProcessorContent = fs.readFileSync(imageProcessorPath, 'utf8');
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



const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');

describe('Layer Persistence', function() {
    let window, document, lm;

    before(async function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="print-layout-wrapper"></div><div id="print-enhance-shapes-layer"></div><div id="print-enhance-sections-layer"></div></body></html>', {
            url: "http://localhost",
            runScripts: "dangerously",
            resources: "usable"
        });
        
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;
        global.Node = window.Node;
        global.navigator = window.navigator;

        global.ResizeObserver = class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        };

        const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
        window.indexedDB = indexedDB;
        window.IDBKeyRange = IDBKeyRange;
        global.indexedDB = indexedDB;
        global.IDBKeyRange = IDBKeyRange;
        window.__DDB_TEST_MODE__ = true;

        // Mock safeLog
        window.safeLog = () => {};

        // Load dependencies in order
        window.eval(elementWrapperContent);
        window.eval(domManagerContent);
        window.eval(layerManagerContent);
        
        // Use DomManager to get the LayerManager instance
        lm = window.DomManager.getInstance().getLayerManager();
        window.PeDom = () => window.DomManager.getInstance();

        window.eval(contextMenuContent);
        window.eval(assetCatalogContent);
        window.eval(storageContent);
        window.eval(imageProcessorContent);
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
        await window.Storage.init();
    });

    after(function() {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.NodeList;
        delete global.Node;
        delete global.navigator;
        delete global.indexedDB;
        delete global.IDBKeyRange;
        delete global.ResizeObserver;
    });

    it('should include layer states in scanLayout', async function() {
        lm.shapeLayers.find(l => l.id === 'shapes-default').isDisabledOnPrint = true;
        lm.sectionsLayer.isLocked = true;
        
        const layout = await window.scanLayout();
        // console.log('DEBUG layout.layers:', JSON.stringify(layout.layers, null, 2));
        
        assert.ok(layout.layers, 'Layers should be included in layout');
        assert.strictEqual(layout.layers['shapes-default'].isDisabledOnPrint, true, 'shapes-default should be disabled on print');
        assert.strictEqual(layout.layers.sections.isLocked, true, 'sections should be locked');
    });

    it('should restore layer states in applyLayout', async function() {
        const testLayout = {
            version: '1.5.0',
            sections: {}, // Needed to pass the guard clause
            shapeLayers: [
                { id: 'shapes-default', name: 'Shapes (Default)', isDisabledOnPrint: false, isLocked: true, isHidden: true }
            ],
            layers: {
                'shapes-default': { isDisabledOnPrint: false, isLocked: true, isHidden: true },
                sections: { isDisabledOnPrint: true, isLocked: false, isHidden: false }
            }
        };

        await window.applyLayout(testLayout);

        // Re-fetch lm as it might have been re-instantiated during applyLayout
        lm = window.PeDom().getLayerManager();

        const shapes = lm.shapeLayers.find(l => l.id === 'shapes-default');
        const sections = lm.sectionsLayer;

        assert.strictEqual(shapes.isLocked, true);
        assert.strictEqual(shapes.isHidden, true);
        assert.strictEqual(shapes.isDisabledOnPrint, false);

        assert.strictEqual(sections.isLocked, false);
        assert.strictEqual(sections.isHidden, false);
        assert.strictEqual(sections.isDisabledOnPrint, true);
        
        // Verify DOM sync
        assert.strictEqual(document.getElementById('print-enhance-sections-layer').dataset.printDisabled, 'true');
        assert.ok(document.body.classList.contains('be-lock-shapes-default'));
    });
});
