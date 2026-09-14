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




describe('Cloning Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="be-section-wrapper" id="section-Actions-wrapper" data-title="Actions">
                <div class="print-section-container" id="section-Actions" style="width: 100px; height: 100px;">
                    <div class="print-section-content">
                        <div class="content">
                            <button class="interactive">Click Me</button>
                            <menu>Menu</menu>
                            <div class="ct-spell-manager__button">Manage</div>
                            <p>Snapshot Content</p>
                        </div>
                    </div>
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

  describe('captureSectionSnapshot', function() {
    it('should capture the content and remove interactive elements', function() {
        if (typeof window.captureSectionSnapshot !== 'function') {
            assert.fail('window.captureSectionSnapshot is not defined');
        }
        
        const snapshot = window.captureSectionSnapshot('section-Actions');
        
        assert.ok(snapshot.html, 'HTML content missing');
        assert.strictEqual(snapshot.originalId, 'section-Actions');
        
        // Verify sanitization in the snapshot (using a temporary div to parse HTML)
        const temp = document.createElement('div');
        temp.innerHTML = snapshot.html;
        
        assert.ok(temp.querySelector('button'), 'Buttons should be preserved');
        assert.strictEqual(temp.querySelector('menu'), null, 'Menu should still be removed');
        assert.ok(temp.querySelector('p'), 'Non-interactive content should be preserved');
    });

    it('should capture border style', function() {
        const section = document.getElementById('section-Actions');
        section.classList.add('ability_border');
        
        const snapshot = window.captureSectionSnapshot('section-Actions');
        assert.strictEqual(snapshot.borderStyle, 'ability_border');
    });
  });

  describe('renderClonedSection', function() {
    it('should apply border style from snapshot', function() {
        const snapshot = {
            id: 'clone-123',
            originalId: 'section-Actions',
            title: 'Action Clone',
            html: '<p>Content</p>',
            borderStyle: 'spikes_border'
        };
        
        const wrapper = window.renderClonedSection(snapshot);
        const container = wrapper.querySelector('.print-section-container');
        assert.ok(container.classList.contains('spikes_border'));
    });

    it('should create a new section container from snapshot data', function() {
        if (typeof window.renderClonedSection !== 'function') {
            assert.fail('window.renderClonedSection is not defined');
        }
        
        const snapshot = {
            id: 'clone-123',
            originalId: 'section-Actions',
            title: 'Action Clone',
            html: '<p>Snapshot Content</p>',
            styles: {
                width: '200px',
                height: '300px'
            },
            width: '200px',
            height: '300px'
        };
        
        const wrapper = window.renderClonedSection(snapshot);
        const container = wrapper.querySelector('.print-section-container');
        
        assert.strictEqual(container.id, 'clone-123');
        assert.ok(container.classList.contains('print-section-container'), 'Should have container class');
        assert.ok(container.classList.contains('be-clone'), 'Should have clone class');
        
        assert.strictEqual(wrapper.dataset.title, 'Action Clone');

        const staticTitle = container.querySelector('.ct-content-group__header-content');
        assert.ok(staticTitle, 'Static header content missing');
        assert.strictEqual(staticTitle.textContent, 'Action Clone');
        
        const content = container.querySelector('.print-section-content');
        assert.ok(content.innerHTML.includes('Snapshot Content'));
        
        assert.strictEqual(container.style.width, '200px');
        assert.strictEqual(container.style.height, '300px');
    });
  });
});
