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




describe('Data Service & Cache Logic', function() {
  let window, Storage;

  before(async function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously"
    });
    window = dom.window;
    // Mock chrome.runtime.sendMessage for MV3 background fetch
    window.chrome = {
      runtime: {
        sendMessage: (message, callback) => {
          if (message.type === 'FETCH_CHARACTER_DATA') {
            callback({
              success: true,
              data: {
                data: {
                  classSpells: [],
                  spells: {
                    race: [],
                    class: [{ 
                      definition: { 
                        name: 'Misty Step', 
                        level: 2, 
                        description: 'Briefly surrounded by silvery mist...', 
                        range: { origin: 'Self' }, 
                        school: 'Conjuration' 
                      } 
                    }],
                    feat: [],
                    item: []
                  }
                }
              }
            });
          }
        }
      }
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
    Storage = window.Storage;
    await Storage.init();
  });

  it('should retrieve from cache if available', async function() {
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier...',
      range: 'Self',
      school: 'Abjuration'
    };
    await Storage.saveSpells([spellData]);

    // Mock getCharacterId
    window.getCharacterId = () => '12345';
    // Mock fetch to ensure it's NOT called
    window.fetch = () => { throw new Error('Fetch should not be called on cache hit'); };

    const result = await window.fetchSpellWithCache('Shield');
    assert.deepStrictEqual(result, spellData);
  });

  it('should fetch from API and update cache on miss', async function() {

    // Clear cache for this spell
    const db = await Storage.init();
    const transaction = db.transaction(['spell_cache'], 'readwrite');
    transaction.objectStore('spell_cache').delete('Misty Step');
    await new Promise(resolve => transaction.oncomplete = resolve);

    // Mock getCharacterId
    window.getCharacterId = () => '12345';
    
    // Mock fetch
    window.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: {
          classSpells: [],
          spells: {
            race: [],
            class: [{ definition: { name: 'Misty Step', level: 2, description: 'Briefly surrounded by silvery mist...', range: { origin: 'Self' }, school: 'Conjuration' } }],
            feat: [],
            item: []
          }
        }
      })
    });

    const result = await window.fetchSpellWithCache('Misty Step');
    assert.strictEqual(result.name, 'Misty Step');

    // Verify it was cached
    const cached = await Storage.getSpell('Misty Step');
    assert.strictEqual(cached.name, 'Misty Step');
  });
});
