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




describe('UI - Spell Detail Section', function() {
  this.timeout(10000);
  let window, document;

  before(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
        </body>
      </html>
    `, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    // Mock chrome.runtime.sendMessage for MV3 background fetch
    window.chrome = {
      runtime: {
        sendMessage: (message, callback) => {
          if (message.type === 'FETCH_CHARACTER_DATA') {
            if (message.url.includes('NonExistent')) {
              callback({ success: false, error: 'Not Found' });
            } else {
              callback({
                success: true,
                data: {
                  data: {
                    classSpells: [],
                    spells: { race: [], class: [], feat: [], item: [] }
                  }
                }
              });
            }
          }
        }
      }
    };

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

  it('should create a floating section shell at click coordinates', async function() {
    const spellName = 'Fireball';
    const coords = { x: 100, y: 200 };
    
    // We don't await here to check the intermediate state (spinner)
    window.createSpellDetailSection(spellName, coords);
    
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(el => el.dataset.title === spellName);
    assert.ok(wrapper, 'Wrapper should be found');
    assert.strictEqual(wrapper.style.left, '100px');
    assert.strictEqual(wrapper.style.top, '200px');
    assert.ok(wrapper.querySelector('.be-spinner'), 'Should show loading spinner initially');
  });

  it('should populate data after successful fetch', async function() {
    const spellName = 'Shield';
    const spellData = {
      name: 'Shield',
      level: 1,
      description: 'An invisible barrier...',
      range: 'Self',
      school: 'Abjuration'
    };

    // Mock Storage to return our spell
    await window.Storage.saveSpells([spellData]);

    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => w.dataset.title === 'Shield');
    assert.ok(wrapper.textContent.includes('Abjuration'), 'Should display school');
    assert.ok(wrapper.textContent.includes('An invisible barrier'), 'Should display description');
    assert.strictEqual(wrapper.querySelector('.be-spinner'), null, 'Spinner should be removed');
  });

  it('should show error state on fetch failure', async function() {
    // Force cache miss and fetch failure
    const spellName = 'NonExistent';
    window.fetch = async () => ({ ok: false });

    await window.createSpellDetailSection(spellName, { x: 0, y: 0 });
    
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => w.dataset.title === 'NonExistent');
    
    assert.ok(wrapper, 'Section for NonExistent should be found');
    // AC-4 (U-18), track feedback_lifecycle_a11y_20260910: this assertion used to
    // require the word "available", i.e. it PINNED the misattributed copy — the
    // old card blamed the manage-spells button for every failure, including a
    // fetch that simply failed. A failed fetch must now name the load failure and
    // must NOT send the user to a button that cannot help.
    const text = wrapper.textContent.toLowerCase();
    assert.ok(
      text.includes('failed') || text.includes('not in this character'),
      'Should name the actual failure, got: ' + text.slice(0, 200),
    );
    assert.ok(
      !text.includes('manage spells') || text.includes('not in this character'),
      'The manage-spells instruction must only appear when it is actionable',
    );
    assert.ok(wrapper.querySelector('.be-retry-button'), 'Should have retry button');
  });

  it('should reposition to left:0 and spell Y during handleLoadDefault', async function() {
    const spellName = 'Cure Wounds';
    
    // Create a mock spell label in the DOM
    const spellsContainer = document.createElement('div');
    spellsContainer.innerHTML = `
        <div class="ct-spells-spell">
            <div class="ct-spells-spell__label">Cure Wounds</div>
        </div>
    `;
    // Position it at Y=500
    spellsContainer.style.position = 'absolute';
    spellsContainer.style.top = '500px';
    document.body.appendChild(spellsContainer);
    
    // Mock getBoundingClientRect for the label
    const label = spellsContainer.querySelector('.ct-spells-spell__label');
    label.getBoundingClientRect = () => ({
        top: 500,
        left: 100,
        width: 100,
        height: 20
    });

    // Mock layout wrapper Rect
    const layoutRoot = document.getElementById('print-layout-wrapper');
    layoutRoot.getBoundingClientRect = () => ({ top: 0, left: 0, width: 1200 });

    // Create the detail section
    await window.createSpellDetailSection(spellName, { x: 400, y: 400 });
    const wrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => w.dataset.title === spellName);
    assert.ok(wrapper, 'Wrapper not found');
    const detail = wrapper.querySelector('.print-section-container');
    assert.ok(detail, 'Detail container not found');
    
    // Initial position and size
    wrapper.style.left = '400px';
    detail.style.width = '500px';
    
    // Trigger Load Default
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
    
    // RE-QUERY live elements after reset
    const finalWrapper = Array.from(document.querySelectorAll('.be-section-wrapper'))
                         .find(w => w.dataset.title === spellName);
    assert.ok(finalWrapper, 'Wrapper missing after reset');
    const finalDetail = finalWrapper.querySelector('.print-section-container');

    // Should be at left: 1200, top: 500, and width: 300px
    assert.strictEqual(finalWrapper.style.left, '1200px');
    assert.strictEqual(finalWrapper.style.top, '500px');
    assert.strictEqual(finalDetail.style.width, '300px');
  });
});
