const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

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




describe('Shape Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div id="print-enhance-shapes-layer"></div>
          </div>
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
    
    // Explicitly set on window because eval might not do it due to module.exports check
    window.ElementWrapper = require('../../js/dom/element_wrapper.js');
    window.DomManager = require('../../js/dom/dom_manager.js');
    window.LayerManager = require('../../js/dom/layer_manager.js');
    
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

  describe('createShape', function() {
    it('should create a shape with correct classes on wrapper and container', function() {
        if (typeof window.createShape !== 'function') {
            assert.fail('window.createShape is not defined');
        }
        
        const assetPath = 'assets/shapes/test-shape.webp';
        const wrapper = window.createShape(assetPath);
        
        assert.ok(wrapper.classList.contains('be-section-wrapper'), 'Should have be-section-wrapper class');
        assert.ok(wrapper.classList.contains('be-shape-wrapper'), 'Should have be-shape-wrapper class');
        
        const container = wrapper.querySelector('.be-shape-container');
        assert.ok(container.classList.contains('be-shape-container'), 'Should have be-shape-container class');
        assert.ok(container.classList.contains('be-shape'), 'Should have be-shape class');
        assert.ok(container.id.startsWith('shape-'), 'Should have an id starting with shape-');
    });

    it('should apply the correct border-image style to container', function() {
        const assetPath = 'assets/shapes/test-shape.webp';
        const wrapper = window.createShape(assetPath);
        const container = wrapper.querySelector('.be-shape-container');
        
        assert.ok(container.style.borderImageSource.includes('test-shape.webp'), 'Border image source should include asset path');
        assert.strictEqual(container.style.borderStyle, 'solid', 'Border style should be solid');
    });

    it('should be appended to the layout wrapper', function() {
        const assetPath = 'assets/shapes/test-shape.webp';
        const wrapper = window.createShape(assetPath);
        
        const shapesLayer = document.getElementById('print-enhance-shapes-layer');
        assert.ok(shapesLayer, 'Shapes layer should exist');
        assert.strictEqual(wrapper.parentElement, shapesLayer, 'Wrapper should be child of shapes layer');
        assert.strictEqual(wrapper.style.left, '50px', 'Initial left should be 50px');
        assert.strictEqual(wrapper.style.top, '160px', 'Initial top should be 160px');
    });

    it('should restore from data if provided', function() {
        const restoreData = {
            id: 'shape-123',
            assetPath: 'assets/shapes/old-shape.webp',
            styles: {
                width: '150px',
                height: '150px',
                left: '100px',
                top: '100px',
                zIndex: '200'
            },
            width: '150px',
            height: '150px',
            left: '100px',
            top: '100px',
            zIndex: '200'
        };
        
        const wrapper = window.createShape(restoreData.assetPath, restoreData);
        const container = wrapper.querySelector('.be-shape-container');
        
        assert.strictEqual(container.id, 'shape-123');
        assert.strictEqual(container.style.width, '150px');
        assert.strictEqual(container.style.height, '150px');
        assert.strictEqual(wrapper.style.left, '100px');
        assert.strictEqual(wrapper.style.top, '100px');
        assert.strictEqual(wrapper.style.zIndex, '200');
    });

    it('should remove the shape when delete button is clicked and confirmed', async function() {
        // Mock confirm
        window.confirm = () => true;
        
        const wrapper = window.createShape('assets/shapes/test.webp');
        const deleteBtn = wrapper.querySelector('.be-shape-delete');
        
        assert.ok(deleteBtn, 'Delete button missing');
        
        deleteBtn.click();
        // U-36: deletion now confirms through the in-app dialog; drive it.
        await new Promise((r) => setTimeout(r, 0));
        const dlgOk = document.querySelector('.be-modal-overlay .be-modal-ok');
        assert.ok(dlgOk, 'a confirmation dialog should be shown');
        dlgOk.click();
        // DELIBERATELY UPDATED (AC-1): the delete writes a backup BEFORE removing, so
        // the removal lands after a storage round-trip. Wait for the effect rather
        // than for a fixed number of ticks.
        const deadline = Date.now() + 2000;
        while (wrapper.parentElement !== null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 5));
        }
        assert.strictEqual(wrapper.parentElement, null, 'Wrapper should be removed from DOM');
    });
  });

  describe('Z-Index Management', function() {
    it('should keep shapes above sections when a section is clicked', function() {
        if (typeof window.initZIndexManagement !== 'function') {
            assert.fail('window.initZIndexManagement is not defined');
        }

        const layoutRoot = document.getElementById('print-layout-wrapper');
        
        // Create a section wrapper
        const sectionWrapper = document.createElement('div');
        sectionWrapper.className = 'be-section-wrapper';
        sectionWrapper.style.zIndex = '10';
        const section = document.createElement('div');
        section.className = 'print-section-container';
        sectionWrapper.appendChild(section);
        layoutRoot.appendChild(sectionWrapper);
        
        // Create a shape
        const shapeWrapper = window.createShape('assets/shapes/test.webp');
        shapeWrapper.style.zIndex = '111';
        
        window.initZIndexManagement();
        
        // Simulate click on section
        const event = new window.MouseEvent('mousedown', { bubbles: true });
        section.dispatchEvent(event);
        
        const sectionZ = parseInt(sectionWrapper.style.zIndex);
        const shapeZ = parseInt(shapeWrapper.style.zIndex);
        
        assert.ok(sectionZ > 10, 'Section Z-Index should have increased');
        assert.ok(shapeZ > sectionZ, 'Shape should still be above section');
    });

    it('should bring clicked shape to the very front', function() {
        const shapeWrapper1 = window.createShape('assets/shapes/1.webp');
        shapeWrapper1.style.zIndex = '111';
        
        const shapeWrapper2 = window.createShape('assets/shapes/2.webp');
        shapeWrapper2.style.zIndex = '112';
        
        window.initZIndexManagement();
        
        // Click shape 1
        const event = new window.MouseEvent('mousedown', { bubbles: true });
        shapeWrapper1.querySelector('.print-section-container').dispatchEvent(event);
        
        assert.ok(parseInt(shapeWrapper1.style.zIndex) > parseInt(shapeWrapper2.style.zIndex), 'Shape 1 should now be in front of Shape 2');
    });
  });

  describe('showShapePickerModal', function() {
    it('should open a modal and resolve with selected asset', async function() {
        if (typeof window.showShapePickerModal !== 'function') {
            assert.fail('window.showShapePickerModal is not defined');
        }

        // Must activate a layer first
        const lm = window.DomManager.getInstance().getLayerManager();
        lm.activeLayerId = 'shapes-default';

        const promise = window.showShapePickerModal();
        
        // Check if modal exists in DOM
        const overlay = document.querySelector('.be-modal-overlay');
        assert.ok(overlay, 'Modal overlay not found');
        
        const okBtn = overlay.querySelector('.be-modal-ok');
        assert.ok(okBtn, 'OK button not found');
        
        // Select an option (first one)
        const option = overlay.querySelector('.be-border-option');
        assert.ok(option, 'Border options not found');
        option.click();
        
        okBtn.click();
        
        const result = await promise;
        assert.ok(result && result.assetPath, 'Result should contain assetPath');
    });
  });

  describe('Persistence', function() {
    beforeEach(() => {
        // Mock Storage
        window.Storage = {
            SCHEMA_VERSION: '1.4.0',
            init: () => Promise.resolve(),
            getAllSpells: () => Promise.resolve([])
        };
    });

    it('should capture shape data in scanLayout', async function() {
        if (typeof window.scanLayout !== 'function') {
            assert.fail('window.scanLayout is not defined');
        }

        const wrapper = window.createShape('assets/shapes/scan-test.webp');
        const container = wrapper.querySelector('.print-section-container');
        wrapper.style.left = '123px';
        wrapper.style.top = '456px';
        container.style.width = '100px';
        container.style.height = '100px';
        wrapper.style.zIndex = '250';
        
        const layout = await window.scanLayout();
        
        assert.ok(layout.shapes, 'Layout should contain shapes array');
        const captured = layout.shapes.find(s => s.id === container.id);
        assert.ok(captured, 'Shape not found in scanned layout');
        assert.strictEqual(captured.assetPath, 'assets/shapes/scan-test.webp');
        assert.strictEqual(captured.left, '123px');
        assert.strictEqual(captured.top, '456px');
        assert.strictEqual(captured.zIndex, '250');
    });

    it('should restore shapes in applyLayout', async function() {
        if (typeof window.applyLayout !== 'function') {
            assert.fail('window.applyLayout is not defined');
        }

        const layout = {
            version: '1.4.0',
            sections: {},
            shapes: [
                {
                    id: 'shape-restored',
                    assetPath: 'assets/shapes/restore-test.webp',
                    left: '10px',
                    top: '20px',
                    width: '50px',
                    height: '50px',
                    zIndex: '300'
                }
            ]
        };
        
        // Clear existing
        document.querySelectorAll('.be-section-wrapper').forEach(el => el.remove());
        
        await window.applyLayout(layout);
        
        const restoredContainer = document.getElementById('shape-restored');
        assert.ok(restoredContainer, 'Shape container not restored');
        const restoredWrapper = restoredContainer.closest('.be-section-wrapper');
        assert.ok(restoredWrapper, 'Wrapper not found for restored shape');
        
        assert.strictEqual(restoredWrapper.style.left, '10px');
        assert.strictEqual(restoredWrapper.style.zIndex, '300');
        assert.strictEqual(restoredContainer.style.width, '50px');
    });
  });
});
