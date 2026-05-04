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

describe('Properties Panel Shell', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-desktop"></div>
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
    
    // Mock standard APIs
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
    window.eval(mainJsContent);
  });

  it('should inject the properties panel shell into the control panel', function() {
    window.createControls();
    const controls = document.getElementById('print-enhance-controls');
    assert.ok(controls, 'Control panel missing');
    
    const propPanel = controls.querySelector('#print-enhance-properties-panel');
    assert.ok(propPanel, 'Properties panel shell missing');
  });

  it('should position the properties panel above the filters', function() {
    window.createControls();
    const controls = document.getElementById('print-enhance-controls');
    const children = Array.from(controls.children);
    
    const propPanelIndex = children.findIndex(el => el.id === 'print-enhance-properties-panel');
    const filtersIndex = children.findIndex(el => el.classList.contains('be-filters-container') || (el.style && el.borderTop === '1px solid #444'));
    
    assert.ok(propPanelIndex !== -1, 'Prop panel not found in children');
    assert.ok(filtersIndex !== -1, 'Filters container not found in children');
    assert.ok(propPanelIndex < filtersIndex, 'Prop panel should be above filters');
  });
});
