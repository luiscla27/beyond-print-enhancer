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




describe('Skill Box Splitting', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="be-section-wrapper" id="section-skills-wrapper" data-title="Skills">
                <div class="print-section-container" id="section-skills">
                    <div class="print-section-content">
                        <div class="ct-skills__box">
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Acrobatics</span>
                                <span class="ct-skills__col--stat">DEX</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Athletics</span>
                                <span class="ct-skills__item--stat">STR</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Arcana</span>
                                <span class="ct-skills__col--stat">INT</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Insight</span>
                                <span class="ct-skills__item--stat">WIS</span>
                            </div>
                            <div class="ct-skills__item">
                                <span class="ct-skills__item--label">Deception</span>
                                <span class="ct-skills__col--stat">CHA</span>
                            </div>
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

    // Mock chrome
    window.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://mock/${path}`
        },
        storage: {
            local: { get: () => {}, set: () => {} }
        }
    };

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

  it('should split the skills box into 5 sections and filter items', async function() {
    if (typeof window.splitSkillsBox !== 'function') {
      assert.fail('window.splitSkillsBox is not defined');
    }

    // Initial state
    assert.strictEqual(window.skillsSplit, false);
    assert.ok(document.querySelector('.ct-skills__box'), 'Original skills box should exist');

    // Execute split
    await window.splitSkillsBox(true);

    // Verify original removed
    assert.strictEqual(document.getElementById('section-skills-wrapper'), null, 'Original section wrapper should be removed');
    
    // Verify 5 clones created (and each contains a skills box)
    const skillsBoxes = document.querySelectorAll('.ct-skills__box');
    assert.strictEqual(skillsBoxes.length, 5, 'Should have created 5 clones, each with its own skills box');

    const clones = document.querySelectorAll('.be-clone');
    assert.strictEqual(clones.length, 5, 'Should have created 5 clones');

    const expectedStats = ["STR", "INT", "WIS", "CHA", "DEX"];
    expectedStats.forEach(stat => {
        const clone = Array.from(document.querySelectorAll('.be-section-wrapper'))
            .find(el => el.dataset.title === stat);
        assert.ok(clone, `Clone for ${stat} should exist`);

        // Check filtering
        const items = clone.querySelectorAll('.ct-skills__item');
        assert.strictEqual(items.length, 1, `Clone for ${stat} should have exactly 1 skill item`);
        const statEl = items[0].querySelector('.ct-skills__item--stat') || items[0].querySelector('.ct-skills__col--stat');
        const itemStat = statEl.textContent.trim();
        assert.strictEqual(itemStat, stat, `Skill item in ${stat} clone should match the stat`);
    });

    // Verify flag
    assert.strictEqual(window.skillsSplit, true);
  });

  it('should persist the skillsSplit flag in scanLayout', async function() {
    window.skillsSplit = true;
    const layout = await window.scanLayout();
    assert.strictEqual(layout.skillsSplit, true, 'skillsSplit flag should be persisted in scanLayout');
  });

  it('should restore the skillsSplit flag in applyLayout', async function() {
    const layout = {
      version: 1,
      skillsSplit: true,
      sections: {}
    };

    // Initially false
    window.skillsSplit = false;

    // Apply layout
    await window.applyLayout(layout);

    assert.strictEqual(window.skillsSplit, true, 'skillsSplit flag should be restored in applyLayout');
  });
});
