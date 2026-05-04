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

describe('Properties Panel Compact Mode Toggle', function() {
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

  it('should show a compact mode toggle when a section is active', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const selectBtn = section1.querySelector('.be-select-section-button');
    
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const toggle = propPanel.querySelector('input[type="checkbox"]');
    assert.ok(toggle, 'Compact mode toggle missing in properties panel');
  });

  it('should update the section compact mode when the toggle is clicked', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    
    const selectBtn = section1.querySelector('.be-select-section-button');
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const toggle = propPanel.querySelector('input[type="checkbox"]');
    
    toggle.checked = true;
    const changeEvent = new window.Event('change', { bubbles: true });
    toggle.dispatchEvent(changeEvent);
    
    assert.ok(section1.classList.contains('be-compact-mode'), 'Section 1 should be in compact mode');
    
    toggle.checked = false;
    toggle.dispatchEvent(changeEvent);
    assert.ok(!section1.classList.contains('be-compact-mode'), 'Section 1 should NOT be in compact mode');
  });

  it('should sync the toggle with the section compact mode when activated', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    section1.classList.add('be-compact-mode');
    
    const selectBtn = section1.querySelector('.be-select-section-button');
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const toggle = propPanel.querySelector('input[type="checkbox"]');
    
    assert.strictEqual(toggle.checked, true);
  });
});
