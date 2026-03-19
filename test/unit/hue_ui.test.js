const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Hue UI', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;

    document = window.document;
    
    // Mock Storage since createControls might call it
    window.Storage = {
        getHueShift: () => Promise.resolve(0),
        saveHueShift: () => Promise.resolve(),
        init: () => Promise.resolve()
    };
    
    // Mock other things needed by main.js if any

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should create a hue slider in the controls panel', function() {
    // createControls is called at the end of main.js if not in test mode, 
    // but we might need to call it manually if main.js checks for test mode.
    // Let's check if it's already there
    let controls = document.getElementById('print-enhance-controls');
    if (!controls) {
        window.createControls();
        controls = document.getElementById('print-enhance-controls');
    }
    
    assert.ok(controls, 'Controls panel should exist');
    
    const hueSlider = controls.querySelector('input[type="range"]');
    assert.ok(hueSlider, 'Hue slider should exist');
    assert.strictEqual(hueSlider.min, '0');
    assert.strictEqual(hueSlider.max, '360');
  });
});
