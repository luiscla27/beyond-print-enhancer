const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Full Integration - Image Filters', function() {
  let window, document, Storage;

  before(async function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
        <div id="print-layout-wrapper"></div>
        <div id="print-enhance-controls-container"></div>
        <div class="print-section-container _border-test">Border</div>
    </body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.chrome = { runtime: { getURL: (path) => path } };
    

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

  it('should initialize UI from storage and apply filters', async function() {
    // 1. Set values in storage
    await Storage.saveFilter('contrast', 180);
    await Storage.saveFilter('sepia', 40);
    
    // 2. Initialize UI
    window.createControls();
    
    // Wait for async initialization in createControls
    await new Promise(r => setTimeout(r, 100));
    
    // 3. Verify sliders are set correctly
    const controls = document.getElementById('print-enhance-controls');
    const sliders = controls.querySelectorAll('input[type="range"]');
    const labels = Array.from(controls.querySelectorAll('label')).map(l => l.textContent);
    
    const contrastIdx = labels.findIndex(l => l.includes('Contrast'));
    const sepiaIdx = labels.findIndex(l => l.includes('Sepia'));
    
    assert.strictEqual(sliders[contrastIdx].value, '180', 'Contrast slider should match storage');
    assert.strictEqual(sliders[sepiaIdx].value, '40', 'Sepia slider should match storage');
    
    // 4. Verify CSS filter variables
    const rootStyle = document.documentElement.style;
    assert.ok(rootStyle.getPropertyValue('--be-full-filter').includes('contrast(180%)'), 'Variable should match initial storage');
    assert.ok(rootStyle.getPropertyValue('--be-full-filter').includes('sepia(40%)'), 'Variable should match initial storage');
  });

  it('should update filter variables in real-time when sliders move', async function() {
    const controls = document.getElementById('print-enhance-controls');
    const sliders = controls.querySelectorAll('input[type="range"]');
    const labels = Array.from(controls.querySelectorAll('label')).map(l => l.textContent);
    
    const saturateIdx = labels.findIndex(l => l.includes('Saturate'));
    const saturateSlider = sliders[saturateIdx];
    
    // Simulate user input
    saturateSlider.value = '150';
    saturateSlider.dispatchEvent(new window.Event('input'));
    
    // Wait for async update
    await new Promise(r => setTimeout(r, 50));
    
    const rootStyle = document.documentElement.style;
    assert.ok(rootStyle.getPropertyValue('--be-full-filter').includes('saturate(150%)'), 'Variable should update on slider input');
  });
});
