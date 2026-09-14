const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
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




describe('UI Wrapper Fix', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;

    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    
    global.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://id/${path}`
        }
    };
    window.chrome = global.chrome;

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
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
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
  });

  describe('createDraggableContainer structure', function() {
    it('should return a wrapper containing container and data-title', function() {
        const content = document.createElement('div');
        content.textContent = 'Test Content';
        const wrapper = window.createDraggableContainer('Test Title', content, 'test-id');
        
        assert.ok(wrapper.classList.contains('be-section-wrapper'), 'Should have be-section-wrapper class');
        assert.strictEqual(wrapper.dataset.title, 'Test Title', 'Should have data-title');
        
        const header = wrapper.querySelector('.print-section-header');
        assert.strictEqual(header, null, 'Header should be removed');
        
        const container = wrapper.querySelector('.print-section-container');
        assert.ok(container, 'Container should be inside wrapper');
        assert.strictEqual(container.parentElement, wrapper, 'Container should be direct child of wrapper');
        assert.strictEqual(container.id, 'test-id', 'Container should have the provided ID');
        
        const contentArea = container.querySelector('.print-section-content');
        assert.ok(contentArea, 'Content area should be inside container');
        assert.ok(contentArea.contains(content), 'Content should be inside content area');
    });
  });

  describe('getOrCreateActionContainer', function() {
    it('should append actions to the wrapper, not the container', function() {
        const content = document.createElement('div');
        const wrapper = window.createDraggableContainer('Test', content, 'test-id');
        const container = wrapper.querySelector('.print-section-container');
        
        const actionContainer = window.getOrCreateActionContainer(container);
        
        assert.ok(actionContainer.classList.contains('be-section-actions'), 'Should have be-section-actions class');
        assert.strictEqual(actionContainer.parentElement, wrapper, 'Action container should be child of wrapper');
        assert.ok(!container.contains(actionContainer), 'Action container should NOT be child of container');
    });
  });
});
