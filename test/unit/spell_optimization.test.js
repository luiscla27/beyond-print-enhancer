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




describe('Spell Detail Optimization', function() {
  let window, document;

  beforeEach(async function() {
      const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="print-layout-wrapper"></div>
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

  it('should not store HTML for spell details in scanLayout', async function() {
    const spellName = 'Shield';
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier...',
      range: 'Self',
      school: 'Abjuration'
    };

    await window.Storage.saveSpells([spellData]);
    await window.createSpellDetailSection(spellName, { x: 100, y: 100 });
    
    const layout = await window.scanLayout();
    assert.ok(layout.spell_details, 'Should have spell_details array');
    assert.strictEqual(layout.spell_details.length, 1, 'Should have one spell detail');
    assert.strictEqual(layout.spell_details[0].spellName, 'Shield');
    assert.strictEqual(layout.spell_details[0].html, undefined, 'Should NOT have html attribute');
  });

  it('should reconstruct spell detail content from cache in applyLayout', async function() {
    const spellData = {
      name: 'Misty Step',
      level: 2,
      description: 'Briefly surrounded by silvery mist...',
      range: 'Self',
      school: 'Conjuration'
    };

    // Save to cache FIRST
    await window.Storage.saveSpells([spellData]);

    const layout = {
        version: '1.4.0',
        sections: {},
        clones: [],
        extractions: [],
        spell_details: [{
            id: 'saved-spell-1',
            spellName: 'Misty Step',
            left: '150px',
            top: '250px'
        }]
    };

    await window.applyLayout(layout);
    
    // Wait for async reconstruction
    await new Promise(resolve => setTimeout(resolve, 50));

    const section = document.getElementById('saved-spell-1');
    assert.ok(section, 'Spell detail section should be restored');
    assert.ok(section.textContent.includes('Conjuration'), 'Should show school from cache');
    assert.ok(section.textContent.includes('silvery mist'), 'Should show description from cache');
    const wrapper = section.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper missing for restored spell detail');
    assert.strictEqual(wrapper.style.left, '150px');
  });
});
