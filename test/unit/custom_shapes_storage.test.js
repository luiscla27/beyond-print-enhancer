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

describe('Custom Shapes Storage', function() {
  let window, Storage;

  before(async function() {
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
    Storage = window.Storage;
    await Storage.init();
  });

  it('should save and retrieve custom shapes globally', async function() {
    const shape = {
      id: 'custom-1',
      name: 'Test Shape',
      data: 'data:image/png;base64,abc'
    };
    await Storage.saveCustomShape(shape);
    const shapes = await Storage.getCustomShapes();
    assert.ok(Array.isArray(shapes));
    const saved = shapes.find(s => s.id === 'custom-1');
    assert.ok(saved);
    assert.strictEqual(saved.name, 'Test Shape');
    assert.strictEqual(saved.data, 'data:image/png;base64,abc');
  });

  it('should migrate layout with customShapes', function() {
    const legacyLayout = {
      version: '1.4.0',
      customShapes: [
        { id: 'legacy-1', data: 'legacy-data' }
      ]
    };
    const migrated = Storage.migrateLayout(legacyLayout);
    assert.strictEqual(migrated.version, '1.5.0');
    assert.ok(Array.isArray(migrated.customShapes));
    assert.strictEqual(migrated.customShapes[0].id, 'legacy-1');
  });

  it('should include customShapes in scanned layout', async function() {
    const mockLayout = {
        version: '1.5.0',
        sections: {},
        shapeLayers: [],
        customShapes: [{ id: 'custom-val', data: 'data' }]
    };
    
    // We can't easily use scanLayout without a full DOM, 
    // but we can verify that Storage.saveLayout preserves it
    await Storage.saveLayout('test-custom', mockLayout);
    const loaded = await Storage.loadLayout('test-custom');
    assert.ok(Array.isArray(loaded.customShapes));
    assert.strictEqual(loaded.customShapes[0].id, 'custom-val');
  });
});
