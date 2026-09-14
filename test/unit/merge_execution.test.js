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




describe('Merge Execution & Rollback', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container be-extracted-section" id="source-section" data-original-id="orig-source">
                <div class="print-section-header"><span>Source</span></div>
                <div class="print-section-content">
                    <p>Source Content</p>
                </div>
            </div>
            <div class="print-section-container be-extracted-section" id="target-section" data-original-id="orig-target">
                <div class="print-section-header"><span>Target</span></div>
                <div class="print-section-content">
                    <p>Target Content</p>
                </div>
            </div>
          </div>
          <div id="orig-source" style="display:none">Original Source</div>
          <div id="orig-target" style="display:none">Original Target</div>
        </body>
      </html>
    `, {
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

  it('should merge sections and track associated IDs', function() {
    const source = document.getElementById('source-section');
    const target = document.getElementById('target-section');
    
    // Add dummy classes to target to test mimicking
    target.classList.add('ct-actions-group');
    // Add identification class to source
    source.dataset.beExtClass = 'be-ext-source';

    window.handleMergeSections(source, { type: 'section', id: 'target-section', element: target, name: 'Target' });
    
    // Source should be removed
    assert.strictEqual(document.getElementById('source-section'), null);
    
    // Target should have source content
    assert.ok(target.textContent.includes('Source Content'));
    
    // Verify wrapper classes
    const wrapper = target.querySelector('.print-section-content > div');
    assert.ok(wrapper.classList.contains('ct-actions-group'), 'Wrapper should mimic target visual classes');
    assert.ok(wrapper.classList.contains('be-extractable'), 'Wrapper should be extractable');
    assert.ok(wrapper.classList.contains('be-ext-source'), 'Wrapper should have source ID class');
    assert.strictEqual(typeof wrapper.ondblclick, 'function', 'Wrapper should have double click handler');

    // Target should track orig-source
    const associated = JSON.parse(target.dataset.associatedIds);
    assert.ok(associated.includes('orig-source'));
  });

  it('should rollback all associated elements on close', function() {
    const source = document.getElementById('source-section');
    const target = document.getElementById('target-section');
    
    window.handleMergeSections(source, { type: 'section', id: 'target-section', element: target, name: 'Target' });
    
    // Trigger rollback on target
    window.rollbackSection(target);
    
    // Both originals should be visible
    assert.strictEqual(document.getElementById('orig-source').style.display, '');
    assert.strictEqual(document.getElementById('orig-target').style.display, '');
    
    // Target should be removed
    assert.strictEqual(document.getElementById('target-section'), null);
  });
});
