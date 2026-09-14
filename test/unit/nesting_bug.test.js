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




describe('Bug Fix: Recursive DIV Nesting', function() {
  let window, document;

  beforeEach(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-1">
            <h3 class="head">My Actions</h3>
            <p>Action Content</p>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    // Mock ResizeObserver
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
    await window.Storage.init();
  });

  it('should not wrap content in extra DIV when re-extracting merged content', async function() {
    window.flagExtractableElements();
    
    // 1. Initial Extraction of Target 1
    const t1 = document.getElementById('target-1');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    t1.dispatchEvent(dblClickEvent);
    
    const s1 = document.querySelector('.be-extracted-section');
    assert.ok(s1, 'First section should exist');

    // 2. Merge S1 into the sheet (append after target-1)
    const targetInfo = { type: 'sheet', element: t1, id: 'target-1', name: 'Sheet' };
    window.handleMergeSections(s1, targetInfo);
    
    const mergeWrapper = document.querySelector('.be-merge-wrapper');
    if (!mergeWrapper) {
        console.log('Body:', document.body.innerHTML);
    }
    assert.ok(mergeWrapper, 'Merge wrapper should exist on sheet');
    assert.ok(mergeWrapper.classList.contains('be-extractable'), 'Wrapper should be extractable');

    // 3. Re-Extract the wrapper
    mergeWrapper.dispatchEvent(dblClickEvent);
    
    const s2 = document.querySelector('.be-extracted-section');
    assert.ok(s2, 'Second section should exist');
    const w2 = s2.closest('.be-section-wrapper');
    assert.ok(w2, 'Second wrapper should exist');
    
    // Check structure of s2 content
    // Expected: .print-section-content -> [header, children of original wrapper]
    const contentArea = s2.querySelector('.print-section-content');
    
    // If it had been double-wrapped, there would be a div between contentArea and header/originalContent
    const topLevelChildren = Array.from(contentArea.children);
    
    // Should have: 1. ct-content-group__header, 2. h3 (hidden), 3. p
    assert.strictEqual(topLevelChildren[0].className, 'ct-content-group__header');
    
    // Ensure be-merge-wrapper div is NOT among the top-level children (it should have been flattened)
    const hasMergeWrapperChild = topLevelChildren.some(c => c.classList.contains('be-merge-wrapper'));
    assert.strictEqual(hasMergeWrapperChild, false, 'Should not contain a be-merge-wrapper as a direct child');
    
    assert.ok(s2.textContent.includes('Action Content'), 'Content should be preserved');
  });

  it('should destroy the source element instead of hiding it for spells during extraction', async function() {
    const spellName = 'Shield';
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'Invisible barrier',
      range: 'Self',
      school: 'Abjuration'
    };
    await window.Storage.saveSpells([spellData]);

    // 1. Create Spell Section
    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    const s1 = document.querySelector('.be-spell-detail');
    
    // 2. Append/Merge it somewhere (e.g. into the sheet after target-1)
    const t1 = document.getElementById('target-1');
    window.handleMergeSections(s1, { type: 'sheet', element: t1, id: 'target-1', name: 'Sheet' });
    
    const mergeWrapper = document.querySelector('.be-merge-wrapper');
    assert.ok(mergeWrapper, 'Spell wrapper should exist');
    
    // 3. Double click to re-extract
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    mergeWrapper.dispatchEvent(dblClickEvent);
    
    // 4. Verify original wrapper is DESTROYED (removed), not just hidden
    assert.strictEqual(document.querySelector('.be-merge-wrapper'), null, 'Source spell wrapper should be removed from DOM');
    
    const s2 = document.querySelector('.be-extracted-section');
    assert.ok(s2, 'New extraction should exist');
    assert.ok(s2.textContent.includes('Shield'), 'Content should be in the new section');
  });
});
