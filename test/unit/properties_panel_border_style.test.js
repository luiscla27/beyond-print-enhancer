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

describe('Properties Panel Border Style Button', function() {
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

  it('should show a border style button when a section is active', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const selectBtn = section1.querySelector('.be-select-section-button');
    
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const borderBtn = propPanel.querySelector('.be-prop-border-button');
    assert.ok(borderBtn, 'Border style button missing in properties panel');
  });

  it('should open the border picker modal when clicked', async function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const selectBtn = section1.querySelector('.be-select-section-button');
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const borderBtn = propPanel.querySelector('.be-prop-border-button');
    
    // Simulate click
    borderBtn.click();
    
    // Wait for modal
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Border picker modal not found');
    assert.ok(modal.querySelector('.be-border-options'), 'Border options grid not found in modal');
  });

  it('should sync the button preview with the section border style', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    section1.classList.add('barbarian_border');
    
    const selectBtn = section1.querySelector('.be-select-section-button');
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const borderPreview = propPanel.querySelector('.be-border-preview');
    
    assert.ok(borderPreview.classList.contains('barbarian_border'), 'Border preview should match section border');
  });
});
