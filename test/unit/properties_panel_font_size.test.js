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

describe('Properties Panel Font Size Slider', function() {
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

  it('should show a font size slider when a section is active', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    const selectBtn = section1.querySelector('.be-select-section-button');
    
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const slider = propPanel.querySelector('input[type="range"]');
    assert.ok(slider, 'Font size slider missing in properties panel');
  });

  it('should update the section font size when the slider is moved', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    
    // Ensure it's wrapped
    const mockWrapper = document.createElement('div');
    mockWrapper.className = 'be-section-wrapper';
    section1.parentNode.insertBefore(mockWrapper, section1);
    mockWrapper.appendChild(section1);
    
    const selectBtn = section1.querySelector('.be-select-section-button');
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const slider = propPanel.querySelector('input[type="range"]');
    
    slider.value = '120';
    const inputEvent = new window.Event('input', { bubbles: true });
    slider.dispatchEvent(inputEvent);
    
    assert.strictEqual(mockWrapper.style.fontSize, '120%');
  });

  it('should sync the slider with the section font size when activated', function() {
    window.createControls();
    window.injectCloneButtons();
    const section1 = document.getElementById('section-1');
    
    const mockWrapper = document.createElement('div');
    mockWrapper.className = 'be-section-wrapper';
    mockWrapper.style.fontSize = '80%';
    section1.parentNode.insertBefore(mockWrapper, section1);
    mockWrapper.appendChild(section1);
    
    const selectBtn = section1.querySelector('.be-select-section-button');
    selectBtn.click();
    
    const propPanel = document.getElementById('print-enhance-properties-panel');
    const slider = propPanel.querySelector('input[type="range"]');
    
    assert.strictEqual(slider.value, '80');
  });
});
