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




describe('Ability Persistence', function() {
  let window, document;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
          </div>
          <div class="ct-quick-info">
              <div class="ct-quick-info__ability ct-quick-info__ability--str">
                  <div class="ct-quick-info__ability-name">Ability 1</div>
                  <div class="ct-quick-info__ability-value">18</div>
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
    window.confirm = () => true;
    
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
    window.CatalogService = {
        applyTemplate: async (id) => {
            if (id === 'archer') {
                const s1 = document.getElementById('section-Ability-Ability 1');
                if (s1) {
                    const w1 = s1.closest('.be-section-wrapper');
                    if (w1) {
                        w1.style.left = '16px';
                        w1.style.top = '16px';
                    }
                    s1.classList.add('ability_border');
                }
            }
            return true;
        }
    };
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

  it('should separate abilities and include them in scanLayout', async function() {
    window.separateAbilities();
    const strSection = document.getElementById('section-Ability-Ability 1');
    assert.ok(strSection, 'Ability 1 section should exist');
    const wrapper = strSection.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper should exist');
    
    // Set custom position
    wrapper.style.left = '500px';
    wrapper.style.top = '500px';
    
    const layout = await window.scanLayout();
    assert.ok(layout.sections['section-Ability-Ability 1'], 'Ability 1 section missing in scanLayout');
    assert.strictEqual(layout.sections['section-Ability-Ability 1'].left, '500px');
    assert.strictEqual(layout.sections['section-Ability-Ability 1'].borderStyle, 'ability_border');
  });

  it('should restore ability sections in applyLayout', async function() {
    const layout = {
        version: '1.4.0',
        sections: {
            'section-Ability-Ability 1': { 
                left: '123px', 
                top: '456px',
                borderStyle: 'spikes_border'
            }
        },
        clones: []
    };

    await window.applyLayout(layout);
    const strSection = document.getElementById('section-Ability-Ability 1');
    const wrapper = strSection.closest('.be-section-wrapper');
    assert.strictEqual(wrapper.style.left, '123px');
    assert.strictEqual(wrapper.style.top, '456px');
    assert.ok(strSection.classList.contains('spikes_border'), 'Should have restored custom border style');
    assert.ok(!strSection.classList.contains('ability_border'), 'Default border should have been removed');
  });

  it('should apply defaults to ability sections in applyDefaultLayout', async function() {
      // Clear styles from previous test
      const strSection = document.getElementById('section-Ability-Ability 1');
      const wrapper = strSection.closest('.be-section-wrapper');
      wrapper.style.left = '0px';
      strSection.classList.remove('spikes_border');
      
      await window.applyDefaultLayout();
      
      // Default for Ability 1 is left: 16px, top: 16px, border: ability_border
      assert.strictEqual(wrapper.style.left, '16px');
      assert.strictEqual(wrapper.style.top, '16px');
      assert.ok(strSection.classList.contains('ability_border'), 'Default border should be applied');
  });
});
