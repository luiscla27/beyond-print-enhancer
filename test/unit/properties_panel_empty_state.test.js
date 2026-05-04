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

describe('Properties Panel Empty State', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-desktop">
             <div class="ct-character-sheet__inner">
                <div class="ct-subsection" id="section-1"></div>
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

  it('should show empty state when no section is active', function() {
    window.createControls();
    const propPanel = document.getElementById('print-enhance-properties-panel');
    
    // console.log('DEBUG:', propPanel.innerHTML);
    // Should have an empty state message
    assert.ok(propPanel.textContent.includes('Select a section to edit'), 'Empty state message missing. Current content: ' + propPanel.textContent);
  });

  it('should update state when a section becomes active', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const selectBtn = section1.querySelector('.be-select-section-button');
    
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    // Once active, the "Select a section" message should be gone
    assert.ok(!propPanel.textContent.includes('Select a section to edit'), 'Empty state message should be removed');
  });
});
