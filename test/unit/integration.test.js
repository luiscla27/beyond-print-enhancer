const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
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




describe('Full Integration - Image Filters', function() {
  let window, document, Storage;

  before(async function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
        <div id="print-layout-wrapper"></div>
        <div id="print-enhance-controls-container"></div>
        <div class="print-section-container _border-test">Border</div>
    </body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.chrome = { runtime: { getURL: (path) => path } };
    

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
    Storage = window.Storage;
    await Storage.init();
  });

  it('should initialize UI from storage and apply filters', async function() {
    // 1. Set values in storage
    await Storage.saveFilter('contrast', 180);
    await Storage.saveFilter('sepia', 40);
    
    // 2. Initialize UI
    window.createControls();
    
    // Wait for async initialization in createControls
    await new Promise(r => setTimeout(r, 100));
    
    // 3. Verify sliders are set correctly
    const controls = document.getElementById('print-enhance-controls');
    const sliders = controls.querySelectorAll('input[type="range"]');
    const labels = Array.from(controls.querySelectorAll('label')).map(l => l.textContent);
    
    const contrastIdx = labels.findIndex(l => l.includes('Contrast'));
    const sepiaIdx = labels.findIndex(l => l.includes('Sepia'));
    
    assert.strictEqual(sliders[contrastIdx].value, '180', 'Contrast slider should match storage');
    assert.strictEqual(sliders[sepiaIdx].value, '40', 'Sepia slider should match storage');
    
    // 4. Verify CSS filter variables
    const rootStyle = document.documentElement.style;
    assert.ok(rootStyle.getPropertyValue('--be-full-filter').includes('contrast(180%)'), 'Variable should match initial storage');
    assert.ok(rootStyle.getPropertyValue('--be-full-filter').includes('sepia(40%)'), 'Variable should match initial storage');
  });

  it('should update filter variables in real-time when sliders move', async function() {
    const controls = document.getElementById('print-enhance-controls');
    const sliders = controls.querySelectorAll('input[type="range"]');
    const labels = Array.from(controls.querySelectorAll('label')).map(l => l.textContent);
    
    const saturateIdx = labels.findIndex(l => l.includes('Saturate'));
    const saturateSlider = sliders[saturateIdx];
    
    // Simulate user input
    saturateSlider.value = '150';
    saturateSlider.dispatchEvent(new window.Event('input'));
    
    // Wait for async update
    await new Promise(r => setTimeout(r, 50));
    
    const rootStyle = document.documentElement.style;
    assert.ok(rootStyle.getPropertyValue('--be-full-filter').includes('saturate(150%)'), 'Variable should update on slider input');
  });
});
