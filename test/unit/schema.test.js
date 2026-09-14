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




describe('Data Schema & Versioning', function() {
  let window;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;

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

  it('should have a current version constant', function() {
    assert.ok(window.Storage.SCHEMA_VERSION, 'SCHEMA_VERSION should be defined');
    assert.strictEqual(window.Storage.SCHEMA_VERSION, '1.5.0', 'SCHEMA_VERSION should be 1.5.0');
  });

  it('should handle version mismatch in handleLoadFile', async function() {
    // AC-1/U-14 (ui_ux_review_20260910): the version notice is no longer a
    // native alert() popped from handleLoadFile — it is folded into the in-app
    // confirm, and the copy is accurate for newer files too. Capture the
    // confirm's message instead and drive the new backup/confirm seams.
    let confirmMessage = '';
    window.confirmDestructive = async (opts) => {
      confirmMessage = (opts && opts.message) || '';
      return false; // cancel: we only assert the message here
    };
    window.createBackupSnapshot = async () => ({ ok: true, record: { id: 'backup_test' } });
    
    // Mock FileReader
    class MockFileReader {
      readAsText() {
        const layout = { version: "1.0.0", sections: {} };
        this.onload({ target: { result: JSON.stringify(layout) } });
      }
    }
    window.FileReader = MockFileReader;

    // Trigger load
    // We need to mock the file input click
    const originalCreateElement = window.document.createElement;
    window.document.createElement = function(tagName) {
        const el = originalCreateElement.call(window.document, tagName);
        if (tagName === 'input') {
            setTimeout(() => {
                if (el.onchange) {
                    el.onchange({ target: { files: [new window.Blob(['{}'], { type: 'application/json' })] } });
                }
            }, 0);
        }
        return el;
    };

    window.handleLoadFile();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    assert.ok(
      /older version \(1\.0\.0\)/.test(confirmMessage),
      'Should state the file is from an older version, got: ' + confirmMessage,
    );
    // AC-1: the load is gated on the in-app confirm (it replaces the old alert)
    assert.ok(confirmMessage.includes('REPLACES your current layout'), 'confirm warns about replacement');
    
    // Clean up
    window.document.createElement = originalCreateElement;
  });

  it('should define a valid layout schema structure', function() {
    const validLayout = {
        version: "1.0.0",
        sections: {
            "section-Actions": {
                left: "10px",
                top: "20px",
                width: "300px",
                height: "400px",
                innerWidths: {
                    "div-1": "100px"
                }
            }
        }
    };

    assert.ok(window.Storage.validateLayout(validLayout), 'Should validate a correct layout object');
    
    const invalidLayout = { version: "1.0.0" }; // Missing sections
    assert.strictEqual(window.Storage.validateLayout(invalidLayout), false, 'Should fail validation if sections are missing');
  });

  describe('migrateLayout', function() {
    it('should unwrap data property from PREMADE templates', function() {
        const wrapped = {
            version: '1.4.0',
            name: 'Test Template',
            data: {
                sections: { "s1": { left: '10px' } },
                shapes: [{ id: 'sh1', assetPath: 'a.webp' }]
            }
        };
        const migrated = window.migrateLayout(wrapped);
        assert.ok(migrated.sections, 'Sections should be promoted to top level');
        assert.ok(migrated.shapes, 'Shapes should be promoted to top level');
        assert.strictEqual(migrated.sections.s1.left, '10px');
        assert.strictEqual(migrated.data, undefined, 'data property should be removed');
    });

    it('should migrate .gif to .webp for versions older than 1.4.0', function() {
        const old = {
            version: '1.3.0',
            sections: { "s1": { borderStyle: 'spikes_border' } },
            shapes: [
                { id: 'sh1', assetPath: 'assets/shapes/corner.gif' },
                { id: 'sh2', assetPath: 'assets/ornament.webp' } // already webp
            ]
        };
        const migrated = window.migrateLayout(old);
        assert.strictEqual(migrated.version, '1.4.0');
        assert.strictEqual(migrated.shapes[0].assetPath, 'assets/shapes/corner.webp', 'gif should be webp');
        assert.strictEqual(migrated.shapes[1].assetPath, 'assets/ornament.webp', 'webp should remain webp');
    });

    it('should initialize merges array if missing', function() {
        const data = { version: '1.4.0', sections: {} };
        const migrated = window.migrateLayout(data);
        assert.ok(Array.isArray(migrated.merges), 'merges should be initialized');
    });

    it('should handle non-object input gracefully', function() {
        assert.strictEqual(window.migrateLayout(null), null);
        assert.strictEqual(window.migrateLayout(undefined), undefined);
        assert.strictEqual(window.migrateLayout("string"), "string");
    });
  });
});
