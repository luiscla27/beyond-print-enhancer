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



require("fake-indexeddb/auto");

describe('Extraction Core & Lifecycle', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-element">
            <h3 class="head">My Actions</h3>
            <p>Some content</p>
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
    
    // Flag elements
    window.flagExtractableElements();
  });

  it('should extract element on double click', function() {
    const target = document.getElementById('target-element');
    
    // Simulate double click
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    // Original should be hidden
    assert.strictEqual(target.style.display, 'none', 'Original element should be hidden');
    
    // New section should exist in print-layout-wrapper
    const sections = document.querySelectorAll('.print-section-container.be-extracted-section');
    assert.strictEqual(sections.length, 1, 'One extracted section should be created');
    
    const section = sections[0];
    const wrapper = section.closest('.be-section-wrapper');
    assert.ok(wrapper, 'Wrapper should exist');
    assert.ok(wrapper.textContent.includes('My Actions'), 'Section should contain original title');
    assert.ok(section.textContent.includes('Some content'), 'Section should contain original content');
    
    // Link tracking
    assert.strictEqual(section.dataset.originalId, 'target-element', 'Section should track original ID');

    // Resize handle
    assert.ok(section.querySelector('.print-section-resize-handle'), 'Should have a resize handle');

    // Compact button
    const actionContainer = wrapper.querySelector('.be-section-actions');
    assert.ok(actionContainer.querySelector('.be-compact-button'), 'Should have a compact mode button');

    // Original header inside clone should be hidden
    const clonedHeader = section.querySelector('.ct-actions-group h3.head');
    assert.ok(clonedHeader, 'Cloned header should exist');
    assert.strictEqual(clonedHeader.style.display, 'none', 'Original header inside clone should be hidden');
  });

  it('should rollback extraction when section is closed', function() {
    const target = document.getElementById('target-element');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    const section = document.querySelector('.be-extracted-section');
    const wrapper = section.closest('.be-section-wrapper');
    
    // Manually add delete button since we mocked injectCloneButtons
    const actions = document.createElement('div');
    actions.className = 'be-section-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'be-delete-button';
    actions.appendChild(deleteBtn);
    wrapper.appendChild(actions);
    
    // The handleElementExtraction logic expects the deleteBtn to have its onclick set up for rollback
    // but in the test we just want to verify the click triggers it.
    // Actually, let's just set the onclick manually to match how it would be in live code
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        window.rollbackSection(section);
    };
    
    // Mock confirm for deletion
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    deleteBtn.click();
    
    // Section should be removed
    assert.strictEqual(document.querySelector('.be-section-wrapper'), null, 'Wrapper should be removed');
    
    // Original should be visible
    assert.notStrictEqual(target.style.display, 'none', 'Original element should be restored');
    
    window.confirm = originalConfirm;
  });

  it('should rollback all extractions during handleLoadDefault', async function() {
    const target = document.getElementById('target-element');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    const section = document.querySelector('.be-extracted-section');
    const wrapper = section.closest('.be-section-wrapper');
    assert.strictEqual(target.style.display, 'none', 'Should be hidden after extraction');
    assert.ok(wrapper, 'Extracted wrapper should exist');

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
    
    assert.strictEqual(document.querySelector('.be-section-wrapper'), null, 'Extracted wrapper should be removed');
    assert.notStrictEqual(target.style.display, 'none', 'Original should be restored');
  });
});
