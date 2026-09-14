const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

// Read the main.js file content to evaluate in JSDOM context
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



const dndContent = fs.readFileSync(path.resolve(__dirname, '../../js/dnd.js'), 'utf8');

describe('Absolute Positioning Engine', function() {
  let window, document;

  beforeEach(function() {
    // Mock a DOM that represents the D&D Beyond character sheet
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="print-layout-wrapper">
            <div class="be-section-wrapper" id="item-1-wrapper" style="position: absolute; left: 0px; top: 0px;" data-title="Item 1" draggable="true">
                <div class="print-section-container" id="item-1">
                    <div class="print-section-content">Content</div>
                </div>
            </div>
            <div class="be-section-wrapper" id="item-2-wrapper" style="position: absolute; left: 200px; top: 0px;" data-title="Item 2" draggable="true">
                <div class="print-section-container" id="item-2">
                    <div class="print-section-content">Content 2</div>
                </div>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.NodeList = window.NodeList;
    
    // We need to evaluate the scripts. 

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(dndContent);
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

    // Mock requestAnimationFrame to execute callback immediately
    window.requestAnimationFrame = (cb) => cb();

    // Initialize drag and drop
    window.initDragAndDrop();
  });

  it('should update element coordinates on pointer drag-and-drop', function() {
    const item = document.getElementById('item-1');
    const wrapper = item.closest('.be-section-wrapper');

    // Pointer sequence: down at (10,10) -> commit move -> release at (100,150).
    // jsdom wrapper/container rects are 0,0, so the grab offset is (10,10):
    // x = 100 - 0 - 10 = 90 -> grid snap 96; y = 150 - 10 = 140 -> 144.
    const down = new window.MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 });
    wrapper.dispatchEvent(down);

    const move = new window.MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 60 });
    wrapper.dispatchEvent(move);

    // Last move sets the snapped slot (zero-jump contract): release happens
    // from the ghost position, so move to the final coordinates first.
    const lastMove = new window.MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 150 });
    wrapper.dispatchEvent(lastMove);

    const up = new window.MouseEvent('pointerup', { bubbles: true, clientX: 100, clientY: 150 });
    wrapper.dispatchEvent(up);

    const dropWrapper = item.closest('.be-section-wrapper');
    assert.strictEqual(dropWrapper.style.left, '96px');
    assert.strictEqual(dropWrapper.style.top, '144px');
  });

  it('should mirror a custom ghost while dragging and restore the source on release', function(done) {
    const item = document.getElementById('item-1');
    const wrapper = item.closest('.be-section-wrapper');

    const down = new window.MouseEvent('pointerdown', { bubbles: true, clientX: 15, clientY: 15 });
    wrapper.dispatchEvent(down);

    const move = new window.MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 40 });
    wrapper.dispatchEvent(move);

    assert.strictEqual(wrapper.style.opacity, '0.4');
    assert.ok(
      document.querySelector('.be-drag-ghost'),
      'a custom ghost should be present mid-drag',
    );

    const up = new window.MouseEvent('pointerup', { bubbles: true, clientX: 60, clientY: 60 });
    wrapper.dispatchEvent(up);

    assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0);
    assert.strictEqual(wrapper.style.opacity, '1');
    done();
  });

  describe('Persistence Integration', function() {
    it('should save and restore coordinates using real Storage', async function() {
        // Setup
        await window.Storage.init();
        
        const item = document.getElementById('item-1');
        const wrapper = item.closest('.be-section-wrapper');
        wrapper.style.left = '123px';
        wrapper.style.top = '456px';
        
        // Mock global dependencies
        window.location.pathname = '/characters/12345';
        window.alert = () => {};
        
        // Act: Save
        await window.handleSaveBrowser();
        
        // Verify in DB (Internal check)
        const saved = await window.Storage.loadGlobalLayout();
        assert.strictEqual(saved.sections['item-1'].left, '123px');

        // Reset positions
        wrapper.style.left = '0px';
        wrapper.style.top = '0px';

        // Act: Restore
        await window.restoreLayout();
        
        // Assert
        assert.strictEqual(wrapper.style.left, '123px');
        assert.strictEqual(wrapper.style.top, '456px');
    });
  });
});
