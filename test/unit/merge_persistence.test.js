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




describe('Merged Persistence', function() {
  let window, document;

  beforeEach(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-1">
            <h3 class="head">Actions</h3>
            <p>Action Content</p>
          </div>
          <div class="ct-character-sheet__traits" id="target-2">
            <h3 class="head">Traits</h3>
            <p>Trait Content</p>
          </div>
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
    await window.Storage.init();
  });

  it('should save and restore merged sections', async function() {
    window.flagExtractableElements();
    
    // 1. Extract Target 1
    const t1 = document.getElementById('target-1');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    t1.dispatchEvent(dblClickEvent);
    
    // 2. Extract Target 2
    const t2 = document.getElementById('target-2');
    t2.dispatchEvent(dblClickEvent);
    
    const sections = Array.from(document.querySelectorAll('.be-extracted-section'));
    const s1 = sections.find(s => s.dataset.originalId === 'target-1');
    const s2 = sections.find(s => s.dataset.originalId === 'target-2');
    
    // 3. Merge S2 into S1
    window.handleMergeSections(s2, { type: 'section', id: s1.id, element: s1, name: 'S1' });
    
    // 4. Scan
    const layout = await window.scanLayout();
    console.log('Merges:', JSON.stringify(layout.merges, null, 2));
    assert.ok(layout.merges.length >= 1, 'Should have at least one merge operation');
    const m = layout.merges.find(x => x.source.originalId === 'target-2');
    assert.ok(m, 'Should find merge for target-2');
    assert.strictEqual(m.target.type, 'section');

    // 5. Apply to fresh DOM
    // Clear wrapper
    document.getElementById('print-layout-wrapper').innerHTML = '';
    // Restore originals
    document.getElementById('target-1').style.display = '';
    document.getElementById('target-2').style.display = '';
    
    await window.applyLayout(layout);
    
    // 6. Verify restoration
    const restored = document.querySelector('.be-extracted-section');
    assert.ok(restored, 'Restored section should exist');
    assert.ok(restored.textContent.includes('Action Content'), 'Should have action content');
    assert.ok(restored.textContent.includes('Trait Content'), 'Should have merged trait content');
    
    assert.strictEqual(document.getElementById('target-1').style.display, 'none', 'Original 1 should be hidden');
    assert.strictEqual(document.getElementById('target-2').style.display, 'none', 'Original 2 should be hidden');
  });

  it('should save and restore merged spell details', async function() {
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
    const spellSection = document.querySelector('.be-spell-detail');
    
    // 2. Create Group Section
    const t1 = document.getElementById('target-1');
    window.flagExtractableElements();
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    t1.dispatchEvent(dblClickEvent);
    const groupSection = Array.from(document.querySelectorAll('.be-extracted-section'))
                              .find(s => s.dataset.originalId === 'target-1');

    // 3. Merge Spell into Group
    window.handleMergeSections(spellSection, { type: 'section', id: groupSection.id, element: groupSection, name: 'Group' });

    // 4. Scan
    const layout = await window.scanLayout();
    const m = layout.merges.find(x => x.source.type === 'spell' && x.source.spellName === 'Shield');
    assert.ok(m, 'Should find spell merge operation');

    // 5. Restore
    document.getElementById('print-layout-wrapper').innerHTML = '';
    await window.applyLayout(layout);
    
    // Wait for systematic merges to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    const restored = document.querySelector('.be-extracted-section');
    assert.ok(restored.textContent.includes('Invisible barrier'), 'Should have restored spell content from cache');
  });
});
