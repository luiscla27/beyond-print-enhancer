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




describe('Cloning Interactions', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="be-section-wrapper" id="clone-123-wrapper" data-title="My Clone">
                <div class="print-section-container be-clone" id="clone-123">
                    <div class="print-section-content"><p>Content</p></div>
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

  describe('Title Editing', function() {
    it('should update title on double-click', async function() {
        if (typeof window.renderClonedSection !== 'function') {
            assert.fail('window.renderClonedSection is not defined');
        }

        const snapshot = {
            id: 'clone-123',
            originalId: 'section-Actions',
            title: 'Original Title',
            html: '<p>Content</p>'
        };

        const wrapper = window.renderClonedSection(snapshot);
        
        // Mock showInputModal to return new title
        const originalShowInputModal = window.showInputModal;
        window.showInputModal = () => Promise.resolve('Updated Title');
        
        // Simulate double click on wrapper
        const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
        wrapper.dispatchEvent(dblClickEvent);
        
        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 50));
        
        assert.strictEqual(wrapper.dataset.title, 'Updated Title');

        const headerContent = wrapper.querySelector('.ct-content-group__header-content');
        assert.ok(headerContent.textContent.includes('Updated Title'), 'Header content should contain title');
        
        window.showInputModal = originalShowInputModal;
    });
  });

  describe('Deletion', function() {
    it('should remove section when delete button is clicked', async function() {
        const snapshot = {
            id: 'clone-delete-test',
            originalId: 'section-Actions',
            title: 'To Delete',
            html: '<p>Content</p>'
        };

        const wrapper = window.renderClonedSection(snapshot);
        const deleteBtn = wrapper.querySelector('.be-clone-delete');
        assert.ok(deleteBtn, 'Delete button not found');

        // Mock confirm
        const originalConfirm = window.confirm;
        window.confirm = () => true;

        assert.ok(document.getElementById('clone-delete-test'));
        deleteBtn.click();
        // U-36: deletion now confirms through the in-app dialog. Drive it for
        // real — clicking the confirm button asserts more than stubbing the
        // native confirm() ever did.
        await new Promise((r) => setTimeout(r, 0));
        const dlgOk = document.querySelector('.be-modal-overlay .be-modal-ok');
        assert.ok(dlgOk, 'a confirmation dialog should be shown');
        dlgOk.click();
        // DELIBERATELY UPDATED (AC-1): the clone delete writes a backup BEFORE
        // removing, so the removal lands after a storage round-trip. Wait for the
        // effect rather than for a fixed number of ticks.
        const deadline = Date.now() + 2000;
        while (document.getElementById('clone-delete-test') !== null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 5));
        }
        assert.strictEqual(document.getElementById('clone-delete-test'), null);
        
        window.confirm = originalConfirm;
    });
  });
});
