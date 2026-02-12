const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Absolute Positioning Engine', function() {
  let window, document;

  before(function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper" style="position: relative; width: 1000px; height: 1000px;">
            <div class="print-section-container" id="item-1" style="position: absolute; width: 100px; height: 100px;">
                <div class="print-section-header">Header</div>
            </div>
          </div>
        </body>
      </html>
    `;
    const dom = new JSDOM(htmlContent, {
      runScripts: "dangerously",
      resources: "usable"
    });
    window = dom.window;
    document = window.document;

    // Inject main.js logic
    window.__DDB_TEST_MODE__ = true;
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = mainJs;
    document.body.appendChild(scriptEl);
    
    window.initDragAndDrop();
    
    // Global Mock for requestAnimationFrame
    window.requestAnimationFrame = (cb) => cb();
  });

  it('should update element coordinates on drop', function() {
    const container = document.getElementById('print-layout-wrapper');
    const item = document.getElementById('item-1');
    
    // Mock getBoundingClientRect
    container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 1000 });
    item.getBoundingClientRect = () => ({ left: 10, top: 10, right: 110, bottom: 110 });
    
    // 1. Drag Start (click at 15, 15 - offset is 5, 5)
    const startEvent = new window.MouseEvent('dragstart', { bubbles: true, clientX: 15, clientY: 15 });
    startEvent.dataTransfer = { effectAllowed: '', setData: () => {} };
    item.querySelector('.print-section-header').dispatchEvent(startEvent);
    
    // 2. Drop (drop at 105, 105)
    // New position should be: 105 - container.left(0) - offset.x(5) = 100
    const dropEvent = new window.MouseEvent('drop', { 
        bubbles: true, 
        clientX: 105, 
        clientY: 105 
    });
    container.dispatchEvent(dropEvent);
    
    assert.strictEqual(item.style.left, '96px');
    assert.strictEqual(item.style.top, '96px');
  });

  it('should set custom drag image on dragstart', function(done) {
    const item = document.getElementById('item-1');
    
    // Mock setDragImage
    let setDragImageCalled = false;
    const mockSetDragImage = (img, x, y) => {
        setDragImageCalled = true;
        assert.strictEqual(img, item);
        assert.ok(typeof x === 'number');
        assert.ok(typeof y === 'number');
    };

    // Mock requestAnimationFrame
    window.requestAnimationFrame = (cb) => cb();

    const startEvent = new window.MouseEvent('dragstart', { bubbles: true, clientX: 15, clientY: 15 });
    startEvent.dataTransfer = { 
        effectAllowed: '', 
        setData: () => {},
        setDragImage: mockSetDragImage 
    };
    
    // Dispatch
    item.querySelector('.print-section-header').dispatchEvent(startEvent);
    
    assert.ok(setDragImageCalled, 'setDragImage should be called');
    
    // Opacity should be set immediately because of our requestAnimationFrame mock
    assert.strictEqual(item.style.opacity, '0.98');
    done();
  });

  describe('Persistence', function() {
    it('should collect coordinates in handleSaveLayout', async function() {
        // Mocking Storage for test
        window.Storage = {
            init: () => Promise.resolve(),
            saveLayout: (id, data) => {
                window.__LAST_SAVED_DATA__ = data;
                return Promise.resolve();
            }
        };
        
        // Mock global handleSaveLayout dependencies
        window.location.pathname = '/characters/12345';
        window.alert = () => {};
        
        // Load controls.js
        let controlsJs = fs.readFileSync(path.resolve(__dirname, '../../js/controls.js'), 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = controlsJs;
        document.body.appendChild(scriptEl);
        
        const item = document.getElementById('item-1');
        item.style.left = '123px';
        item.style.top = '456px';
        
        await window.handleSaveLayout();
        
        const savedItem = window.__LAST_SAVED_DATA__.sectionOrder.find(s => s.id === 'item-1');
        assert.strictEqual(savedItem.left, '123px');
        assert.strictEqual(savedItem.top, '456px');
    });

    it('should restore coordinates in restoreLayout', async function() {
        window.Storage.loadLayout = () => Promise.resolve({
            sectionOrder: [
                { id: 'item-1', left: '789px', top: '321px' }
            ]
        });
        
        await window.restoreLayout();
        
        const item = document.getElementById('item-1');
        assert.strictEqual(item.style.left, '789px');
        assert.strictEqual(item.style.top, '321px');
    });
  });
});
