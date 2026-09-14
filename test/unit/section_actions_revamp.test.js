const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

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




describe('Section Actions Revamp', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-container">
            <div id="section-1" class="ct-subsection">
              <div class="print-section-container"></div>
            </div>
            <div id="clone-1" class="ct-subsection">
              <div class="print-section-container"></div>
            </div>
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

  it('should only show primary buttons in the action bar for regular sections', function() {
    window.injectCloneButtons();
    const section = document.getElementById('section-1');
    const actionContainer = section.querySelector('.be-section-actions');
    
    const visibleButtons = Array.from(actionContainer.children).filter(el => 
      el.tagName === 'BUTTON' && !el.classList.contains('be-context-menu') && window.getComputedStyle(el).display !== 'none'
    );
    
    // Primary: select-section-button, more-options-button
    assert.strictEqual(visibleButtons.length, 2, 'Should only have 2 visible buttons in action bar');
    assert.ok(actionContainer.querySelector('.be-select-section-button'), 'Should have select-section button');
    assert.ok(actionContainer.querySelector('.be-more-options-button'), 'Should have more-options button');
    
    // Should NOT have secondary buttons in main action bar (direct children)
    const topLevelCloneButton = Array.from(actionContainer.children).find(el => el.classList.contains('be-clone-button'));
    const topLevelBorderButton = Array.from(actionContainer.children).find(el => el.classList.contains('be-border-button'));
    
    assert.ok(!topLevelCloneButton, 'Should NOT have clone button in main bar');
    assert.ok(!topLevelBorderButton, 'Should NOT have border button in main bar');
  });

  it('should show delete button for clones in the main action bar', function() {
    window.injectCloneButtons();
    const clone = document.getElementById('clone-1');
    const actionContainer = clone.querySelector('.be-section-actions');
    
    assert.ok(actionContainer.querySelector('.be-clone-delete'), 'Clones should still have delete button in main bar');
  });

  it('should have secondary buttons inside the context menu', function() {
    window.injectCloneButtons();
    const section = document.getElementById('section-1');
    const menu = section.querySelector('.be-context-menu');
    
    assert.ok(menu, 'Should have a context menu');
    assert.ok(menu.querySelector('.be-clone-button'), 'Should have clone button in menu');
    assert.ok(menu.querySelector('.be-border-button'), 'Should have border button in menu');
    assert.ok(menu.querySelector('.be-compact-button'), 'Should have compact button in menu');
  });

  it('should toggle be-compact-mode when compact button is clicked', function() {
    window.injectCloneButtons();
    const section = document.getElementById('section-1');
    const container = section.querySelector('.print-section-container');
    const menu = section.querySelector('.be-context-menu');
    const compactBtn = menu.querySelector('.be-compact-button');
    
    compactBtn.click();
    assert.ok(container.classList.contains('be-compact-mode'), 'Container should have be-compact-mode class');
    
    compactBtn.click();
    assert.ok(!container.classList.contains('be-compact-mode'), 'Container should NOT have be-compact-mode class');
  });
});
