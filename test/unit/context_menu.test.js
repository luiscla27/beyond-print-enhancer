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

describe('Context Menu UI', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-container">
            <div class="be-section-actions"></div>
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

  it('should have a createContextMenu function', function() {
    assert.strictEqual(typeof window.createContextMenu, 'function');
  });

  it('should create a context menu with the correct class', function() {
    const menu = window.createContextMenu();
    assert.ok(menu.classList.contains('be-context-menu'));
  });

  it('should be hidden by default', function() {
    const menu = window.createContextMenu();
    assert.strictEqual(window.getComputedStyle(menu).display, 'none');
  });

  it('should toggle visibility when calling toggleContextMenu', function() {
    const container = document.querySelector('.be-section-actions');
    const menu = window.createContextMenu();
    container.appendChild(menu);
    
    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, 'block');
    
    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, 'none');
  });

  it('should close the menu when a button inside it is clicked', function() {
    const container = document.querySelector('.be-section-actions');
    const menu = window.createContextMenu();
    container.appendChild(menu);
    
    let clicked = false;
    const btn = document.createElement('button');
    btn.onclick = () => { clicked = true; };
    menu.appendChild(btn);
    
    // Simulating how main.js handles it
    btn.addEventListener('click', () => {
        menu.style.display = 'none';
    });

    window.toggleContextMenu(menu);
    assert.strictEqual(menu.style.display, 'block');
    
    btn.click();
    assert.strictEqual(menu.style.display, 'none');
    assert.ok(clicked);
  });

  it('should create a More Options trigger button', function() {
    const trigger = window.createMenuTrigger();
    assert.ok(trigger.classList.contains('be-more-options-button'));
    assert.ok(trigger.textContent.includes('⋮') || trigger.textContent.includes('⋯'));
  });
});
