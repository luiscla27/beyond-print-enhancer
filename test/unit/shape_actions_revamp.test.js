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

describe('Shape Actions Revamp', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-container">
            <div id="shape-1" class="be-shape-container"></div>
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

  it('should only show primary buttons in the action bar for shapes', function() {
    window.injectCloneButtons();
    const shape = document.getElementById('shape-1');
    const actionContainer = shape.querySelector('.be-section-actions');
    
    const visibleButtons = Array.from(actionContainer.children).filter(el => 
      el.tagName === 'BUTTON' && !el.classList.contains('be-context-menu') && window.getComputedStyle(el).display !== 'none'
    );
    
    // Primary: delete-shape, rotate-shape, more-options-button
    assert.strictEqual(visibleButtons.length, 3, 'Should only have 3 visible buttons in action bar for shapes');
    assert.ok(actionContainer.querySelector('.be-shape-delete'), 'Should have delete button');
    assert.ok(actionContainer.querySelector('.be-shape-rotate'), 'Should have rotate button');
    assert.ok(actionContainer.querySelector('.be-more-options-button'), 'Should have more-options button');
  });

  it('should have secondary shape buttons inside the context menu', function() {
    window.injectCloneButtons();
    const shape = document.getElementById('shape-1');
    const menu = shape.querySelector('.be-context-menu');
    
    assert.ok(menu, 'Should have a context menu');
    assert.ok(menu.querySelector('.be-shape-switch'), 'Should have switch shape button in menu');
    assert.ok(menu.querySelector('.be-shape-clone'), 'Should have clone shape button in menu');
  });
});
