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




describe('Border Picker UI', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-desktop">
             <div class="ct-character-sheet__inner">
                <div class="ct-subsection" id="section-Actions">
                    <div class="ct-subsection__header">Actions</div>
                </div>
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
    
    // Mock standard APIs
    window.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://mock/${path}`
        }
    };

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

  it('should inject a border button into each subsection', function() {
    window.injectCloneButtons();
    
    const section = document.getElementById('section-Actions');
    const borderBtn = section.querySelector('.be-border-button');
    assert.ok(borderBtn, 'Border button missing');
    assert.strictEqual(borderBtn.innerHTML, '🖼️');
  });

  it('should show the unified style picker (style mode) and return selected style', async function() {
    const promise = window.showAssetPickerModal({ mode: 'style', current: 'default-border' });
    
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Modal not shown');
    
    const options = modal.querySelectorAll('.be-border-option');
    assert.strictEqual(options.length, 20, 'Should have 20 style options');
    
    // Select ability_border
    const abilityOpt = Array.from(options).find(opt => opt.querySelector('.ability_border'));
    assert.ok(abilityOpt, 'Ability option missing');
    abilityOpt.click();
    
    const okBtn = modal.querySelector('.be-modal-ok');
    okBtn.click();
    
    const result = await promise;
    assert.strictEqual(result.style, 'ability_border');
  });

  it('should apply style to section when button clicked', async function() {
    window.injectCloneButtons();
    const section = document.getElementById('section-Actions');
    const borderBtn = section.querySelector('.be-border-button');
    
    // Trigger click
    borderBtn.click();
    
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Modal not shown on button click');
    
    // Select spikes
    const spikesOpt = Array.from(modal.querySelectorAll('.be-border-option')).find(opt => opt.querySelector('.spikes_border'));
    spikesOpt.click();
    
    const okBtn = modal.querySelector('.be-modal-ok');
    okBtn.click();
    
    // Wait for promise resolution in main.js
    await new Promise(r => setTimeout(r, 50));
    
    assert.ok(section.classList.contains('spikes_border'), 'Section should have spikes_border class');
  });
});
