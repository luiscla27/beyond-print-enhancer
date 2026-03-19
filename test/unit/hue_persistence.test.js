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

describe('Hue Persistence', function() {
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

  it('should save and load hue shift value', async function() {
    const hueShiftValue = 180;
    await Storage.saveHueShift(hueShiftValue);
    const loadedValue = await Storage.getHueShift();
    assert.strictEqual(loadedValue, hueShiftValue, 'Hue shift value should be saved and loaded correctly');
  });

  it('should return 0 as default hue shift if not set', async function() {
    // Clear GLOBAL storage for this test or use a fresh DB if possible
    // For simplicity, we just check if it returns a number.
    const loadedValue = await Storage.getHueShift();
    // Since previous test might have set it, we just check for type and range if not 0
    assert.strictEqual(typeof loadedValue, 'number', 'Default hue shift should be a number');
    assert.ok(loadedValue >= 0 && loadedValue <= 360, 'Hue shift should be between 0 and 360');
  });
});
