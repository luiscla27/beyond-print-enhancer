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

describe('Active Section State', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-desktop">
             <div class="ct-character-sheet__inner">
                <div class="ct-subsection" id="section-1">
                    <div class="ct-subsection__header">Section 1</div>
                </div>
                <div class="ct-subsection" id="section-2">
                    <div class="ct-subsection__header">Section 2</div>
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

  it('should allow marking a section as active', function() {
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    
    // Simulate activation (e.g., clicking a new 'Select' button)
    const selectBtn = section1.querySelector('.be-select-section-button');
    assert.ok(selectBtn, 'Select button missing');
    
    selectBtn.click();
    assert.ok(section1.classList.contains('be-active-section'), 'Section 1 should be active');
  });

  it('should only allow one active section at a time', function() {
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const section2 = document.getElementById('section-2');
    
    const selectBtn1 = section1.querySelector('.be-select-section-button');
    const selectBtn2 = section2.querySelector('.be-select-section-button');
    
    selectBtn1.click();
    assert.ok(section1.classList.contains('be-active-section'), 'Section 1 should be active');
    
    selectBtn2.click();
    assert.ok(section2.classList.contains('be-active-section'), 'Section 2 should be active');
    assert.ok(!section1.classList.contains('be-active-section'), 'Section 1 should NOT be active anymore');
  });

  it('should provide a way to access the active section', function() {
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const selectBtn1 = section1.querySelector('.be-select-section-button');
    
    selectBtn1.click();
    assert.strictEqual(window.getActiveSection(), section1);
  });
});
