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
    window.eval(mainJsContent);
  });

  it('should have a current version constant', function() {
    assert.ok(window.Storage.SCHEMA_VERSION, 'SCHEMA_VERSION should be defined');
    assert.strictEqual(window.Storage.SCHEMA_VERSION, '1.4.0', 'SCHEMA_VERSION should be 1.4.0');
  });

  it('should handle version mismatch in handleLoadFile', async function() {
    let alertMessage = '';
    window.alert = (msg) => { alertMessage = msg; };
    
    // Mock FileReader
    class MockFileReader {
      readAsText(file) {
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
    
    assert.ok(alertMessage.includes('older than the current version'), 'Should alert about older version');
    
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
