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




describe('Cloning Persistence', function() {
  let window, document, Storage;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="be-section-wrapper" id="section-Actions-wrapper" style="left: 10px; top: 10px;" data-title="Actions">
                <div class="print-section-container" id="section-Actions" style="width: 100px; height: 100px;">
                    <div class="print-section-content"><p>Actions Content</p></div>
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
                const action = document.getElementById('section-Actions-wrapper');
                if (action) {
                    action.style.left = '512px';
                    action.style.top = '336px';
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
    Storage = window.Storage;
    await Storage.init();
  });

  it('should include clones in scanLayout', async function() {
    // Manually add a clone to the DOM
    const wrapper = document.createElement('div');
    wrapper.className = 'be-section-wrapper';
    wrapper.dataset.title = 'My Clone';
    
    const clone = document.createElement('div');
    clone.id = 'clone-123';
    clone.className = 'print-section-container be-clone';
    clone.style.width = '150px';
    clone.style.height = '150px';
    wrapper.style.left = '50px';
    wrapper.style.top = '50px';
    
    const content = document.createElement('div');
    content.className = 'print-section-content';
    content.innerHTML = '<p>Clone Content</p>';
    clone.appendChild(content);
    wrapper.appendChild(clone);
    
    document.getElementById('print-layout-wrapper').appendChild(wrapper);
    
    const layout = await window.scanLayout();
    
    assert.ok(layout.clones, 'Clones array missing in layout');
    const savedClone = layout.clones.find(c => c.id === 'clone-123');
    assert.ok(savedClone, 'Clone 123 not found in saved layout');
    assert.strictEqual(savedClone.title, 'My Clone');
    assert.strictEqual(savedClone.html, '<p>Clone Content</p>');
    assert.strictEqual(savedClone.left, '50px');
    assert.strictEqual(savedClone.top, '50px');
  });

    it('should restore clones in applyLayout', async function() {
      const layout = {
          version: '1.4.0',
          sections: {
              'section-Actions': { left: '20px', top: '20px' }
          },
          clones: [
              {
                  id: 'clone-456',
                  originalId: 'section-Actions',
                  title: 'Restored Clone',
                  html: '<p>Restored Content</p>',
                  left: '100px',
                  top: '100px',
                  width: '200px',
                  height: '200px'
              }
          ]
      };
  
      await window.applyLayout(layout);
      const restoredClone = document.getElementById('clone-456');
    assert.ok(restoredClone, 'Clone 456 not restored in DOM');
    assert.ok(restoredClone.classList.contains('be-clone'), 'Missing be-clone class');
    const wrapper = restoredClone.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper missing for restored clone');
    assert.strictEqual(wrapper.dataset.title, 'Restored Clone');
    assert.ok(restoredClone.querySelector('.print-section-content').innerHTML.includes('Restored Content'));
    assert.strictEqual(wrapper.style.left, '100px');
    assert.strictEqual(wrapper.style.top, '100px');
  });

  it('should reposition clones relative to parents during handleLoadDefault', async function() {
    // section-Actions is at 20,20 from previous test
    const clone = document.getElementById('clone-456');
    clone.dataset.originalId = 'section-Actions';
    const cloneWrapper = clone.closest('.be-section-wrapper');
    
    // Mock DEFAULT_LAYOUTS for section-Actions (manually in the test context if needed, 
    // but main.js already has it)
    
    // AC-1 (ui_ux_review_20260910): Reset now writes a backup and gates on
    // an in-app confirm. Drive both seams and assert they ran.
    window.__backupCalls = [];
    window.createBackupSnapshot = async (reason) => {
      window.__backupCalls.push(reason);
      return { ok: true, record: { id: 'backup_test' } };
    };
    window.__confirmCalls = [];
    window.confirmDestructive = async (opts) => {
      window.__confirmCalls.push(opts && opts.title);
      return true;
    };
    await window.handleLoadDefault();
    assert.ok(window.__backupCalls.includes('pre-reset'), 'backup written BEFORE erasing');
    assert.ok(window.__confirmCalls.length === 1, 'in-app confirm used');
    
    // In main.js, section-Actions default is left: '512px', top: '336px'
    // Clone should be at 512+32 = 544, 336+32 = 368
    assert.strictEqual(cloneWrapper.style.left, '544px');
    assert.strictEqual(cloneWrapper.style.top, '368px');
  });
});
