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

describe('Filters Persistence', function() {
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

  it('should return default filters if none are set', async function() {
    // Clear global layout for a clean test
    await Storage.saveGlobalLayout({ version: '1.4.0', sections: {} });
    
    const filters = await Storage.getFilters();
    assert.strictEqual(filters.hue, 0, 'Default hue should be 0');
    assert.strictEqual(filters.contrast, 100, 'Default contrast should be 100');
    assert.strictEqual(filters.greyscale, 0, 'Default greyscale should be 0');
    assert.strictEqual(filters.saturate, 100, 'Default saturate should be 100');
    assert.strictEqual(filters.sepia, 0, 'Default sepia should be 0');
  });

  it('should save and load individual filters', async function() {
    await Storage.saveFilter('contrast', 150);
    await Storage.saveFilter('sepia', 50);
    
    const filters = await Storage.getFilters();
    assert.strictEqual(filters.contrast, 150, 'Contrast should be 150');
    assert.strictEqual(filters.sepia, 50, 'Sepia should be 50');
    assert.strictEqual(filters.hue, 0, 'Hue should remain 0');
  });

  it('should preserve existing hue shift when saving new filters', async function() {
    await Storage.saveHueShift(90);
    await Storage.saveFilter('greyscale', 80);
    
    const filters = await Storage.getFilters();
    assert.strictEqual(filters.hue, 90, 'Hue should be 90');
    assert.strictEqual(filters.greyscale, 80, 'Greyscale should be 80');
    
    const hue = await Storage.getHueShift();
    assert.strictEqual(hue, 90, 'getHueShift should still return 90');
  });
});
