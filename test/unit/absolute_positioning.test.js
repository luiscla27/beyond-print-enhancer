const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

// Read the main.js file content to evaluate in JSDOM context
const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Absolute Positioning Engine', function() {
  let window, document;

  beforeEach(function() {
    // Mock a DOM that represents the D&D Beyond character sheet
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="print-layout-wrapper">
            <div class="be-section-wrapper" id="item-1-wrapper" style="position: absolute; left: 0px; top: 0px;">
                <div class="print-section-header">Header</div>
                <div class="print-section-container" id="item-1">
                    <div class="print-section-content">Content</div>
                </div>
            </div>
            <div class="be-section-wrapper" id="item-2-wrapper" style="position: absolute; left: 200px; top: 0px;">
                <div class="print-section-header">Header 2</div>
                <div class="print-section-container" id="item-2">
                    <div class="print-section-content">Content 2</div>
                </div>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;
    window.indexedDB = global.indexedDB;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.NodeList = window.NodeList;
    
    // We need to evaluate the scripts. 
    window.__DDB_TEST_MODE__ = true;
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);

    // Mock requestAnimationFrame to execute callback immediately
    window.requestAnimationFrame = (cb) => cb();

    // Initialize drag and drop
    window.initDragAndDrop();
  });

  it('should update element coordinates on drop', function() {
    const item = document.getElementById('item-1');
    const wrapper = item.closest('.be-section-wrapper');
    const header = wrapper.querySelector('.print-section-header');
    
    // Simulate drag start
    const startEvent = new window.MouseEvent('dragstart', { bubbles: true, clientX: 10, clientY: 10 });
    startEvent.dataTransfer = { 
        effectAllowed: '', 
        setData: () => {},
        setDragImage: () => {} 
    };
    header.dispatchEvent(startEvent);
    
    // Simulate drop at new location
    const dropEvent = new window.MouseEvent('drop', { 
        bubbles: true, 
        clientX: 100, 
        clientY: 150 
    });
    
    document.getElementById('print-layout-wrapper').dispatchEvent(dropEvent);
    
    const dropWrapper = item.closest('.be-section-wrapper');
    assert.strictEqual(dropWrapper.style.left, '96px');
    assert.strictEqual(dropWrapper.style.top, '144px');
  });

  it('should set custom drag image on dragstart', function(done) {
    const item = document.getElementById('item-1');
    const wrapper = item.closest('.be-section-wrapper');
    let setDragImageCalled = false;
    const mockSetDragImage = (img, x, y) => {
        setDragImageCalled = true;
        assert.ok(img instanceof window.HTMLElement);
    };

    const startEvent = new window.MouseEvent('dragstart', { bubbles: true, clientX: 15, clientY: 15 });
    startEvent.dataTransfer = { 
        effectAllowed: '', 
        setData: () => {},
        setDragImage: mockSetDragImage 
    };
    
    // Dispatch
    wrapper.querySelector('.print-section-header').dispatchEvent(startEvent);
    
    assert.ok(setDragImageCalled, 'setDragImage should be called');
    
    // Opacity should be set immediately because of our requestAnimationFrame mock
    assert.strictEqual(wrapper.style.opacity, '0.98');
    done();
  });

  describe('Persistence Integration', function() {
    it('should save and restore coordinates using real Storage', async function() {
        // Setup
        await window.Storage.init();
        
        const item = document.getElementById('item-1');
        const wrapper = item.closest('.be-section-wrapper');
        wrapper.style.left = '123px';
        wrapper.style.top = '456px';
        
        // Mock global dependencies
        window.location.pathname = '/characters/12345';
        window.alert = () => {};
        
        // Act: Save
        await window.handleSaveBrowser();
        
        // Verify in DB (Internal check)
        const saved = await window.Storage.loadGlobalLayout();
        assert.strictEqual(saved.sections['item-1'].left, '123px');

        // Reset positions
        wrapper.style.left = '0px';
        wrapper.style.top = '0px';

        // Act: Restore
        await window.restoreLayout();
        
        // Assert
        assert.strictEqual(wrapper.style.left, '123px');
        assert.strictEqual(wrapper.style.top, '456px');
    });
  });
});
