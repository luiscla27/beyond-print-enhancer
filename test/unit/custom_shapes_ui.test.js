const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
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

const storageJsPath = path.resolve(__dirname, '../../js/storage.js');
const storageJsContent = fs.readFileSync(storageJsPath, 'utf8');
const imageProcessorJsPath = path.resolve(__dirname, '../../js/image_processor.js');
const imageProcessorJsContent = fs.readFileSync(imageProcessorJsPath, 'utf8');
const sectionUtilsJsPath = path.resolve(__dirname, '../../js/section_utils.js');
const sectionUtilsJsContent = fs.readFileSync(sectionUtilsJsPath, 'utf8');
const printStylesJsPath = path.resolve(__dirname, '../../js/print_styles.js');
const printStylesJsContent = fs.readFileSync(printStylesJsPath, 'utf8');

describe('Custom Shapes UI', function() {
    let window;

    before(function() {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
            url: "http://localhost",
            runScripts: "dangerously"
        });
        window = dom.window;
        global.window = window;
        global.document = window.document;
        global.navigator = window.navigator;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;

        // Mock dependencies
        const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
        window.indexedDB = indexedDB;
        window.IDBKeyRange = IDBKeyRange;
        global.indexedDB = indexedDB;
        global.IDBKeyRange = IDBKeyRange;

        window.Storage = {
            getCustomShapes: async () => [
                { id: 'custom-1', name: 'Test Shape', data: 'data:image/png;base64,abc' }
            ],
            init: async () => {}
        };
        window.ASSET_LIST = [];
        window.ASSET_METADATA = {};
        window.chrome = {
            runtime: {
                getURL: (path) => path
            }
        };
        window.PeDom = () => ({
            getLayerManager: () => ({ 
                refreshUI: () => {},
                activeLayerId: 'shapes-default' 
            })
        });
        window.SCHEMA_VERSION = '1.5.0';
        window.getCharacterId = () => '12345';
        window.Storage.loadLayout = async () => ({ version: '1.5.0', sections: {} });
        window.Storage.saveLayout = async () => {};

        // Load main.js (js/storage.js first so window.__DDBStorage exists;
        // the window.Storage stub below is vestigial — main's internals read
        // the module instance through __DDBStorage).
        window.eval(printStylesJsContent);
        window.eval(sectionUtilsJsContent);
        window.eval(imageProcessorJsContent);
        window.eval(storageJsContent);
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

    after(function() {
        delete global.window;
        delete global.document;
    });

    it('should show "Custom" tab in shape picker modal', async function() {
        // Trigger modal - don't await because it waits for user interaction (OK/Cancel)
        window.showShapePickerModal();
        await new Promise(r => setTimeout(r, 100));

        const tabs = document.querySelectorAll('.be-modal-tab');
        const customTab = Array.from(tabs).find(t => t.textContent === 'Custom');
        
        assert.ok(customTab, 'Custom tab should be present');
    });

    it('should show "Upload from disk" button in Custom tab', async function() {
        window.showShapePickerModal();
        await new Promise(r => setTimeout(r, 100));

        const tabs = document.querySelectorAll('.be-modal-tab');
        const customTab = Array.from(tabs).find(t => t.textContent === 'Custom');
        customTab.click();
        
        await new Promise(r => setTimeout(r, 100));

        const buttons = document.querySelectorAll('button');
        const uploadBtn = Array.from(buttons).find(b => b.textContent === 'Upload from disk');
        
        assert.ok(uploadBtn, 'Upload from disk button should be present in Custom tab');
    });

    it('should render custom shapes when "Custom" tab is clicked', async function() {
        window.showShapePickerModal();
        
        // Wait for modal to init
        await new Promise(r => setTimeout(r, 100));

        const tabs = document.querySelectorAll('.be-modal-tab');
        const customTab = Array.from(tabs).find(t => t.textContent === 'Custom');
        
        // Simulate click
        customTab.click();

        // In our implementation, we expect a thumb with specific data-id or title
        // We'll wait a bit for async Storage.getCustomShapes to resolve and render
        await new Promise(r => setTimeout(r, 500));

        const thumbs = document.querySelectorAll('.be-border-option');
        const customThumb = Array.from(thumbs).find(t => t.title === 'Test Shape');
        assert.ok(customThumb, 'Custom shape thumbnail should be rendered');
    });
});
