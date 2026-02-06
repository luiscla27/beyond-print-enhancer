const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Drag-and-Drop Reordering Logic', function() {
  let window, document;

  before(async function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container" id="item-1" style="width: 200px; height: 100px; display: inline-block;">
                <div class="print-section-header" draggable="true">Item 1 Header</div>
                <div class="print-section-content">Item 1</div>
            </div>
            <div class="print-section-container" id="item-2" style="width: 200px; height: 100px; display: inline-block;">
                <div class="print-section-header" draggable="true">Item 2 Header</div>
                <div class="print-section-content">Item 2</div>
            </div>
          </div>
        </body>
      </html>
    `;
    const dom = new JSDOM(htmlContent, {
      url: "https://www.dndbeyond.com/characters/12345",
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
    
    // Initialize DND
    window.initDragAndDrop();
  });

  it('should reorder items after horizontal drag', function() {
      const container = document.getElementById('print-layout-wrapper');
      const item1 = document.getElementById('item-1');
      const item2 = document.getElementById('item-2');
      
      // Mock getBoundingClientRect for item2
      item2.getBoundingClientRect = () => ({
          left: 210, right: 410, top: 0, bottom: 100, width: 200, height: 100
      });
      
      // Simulate Drag Start on Item 1 Header
      const header1 = item1.querySelector('.print-section-header');
      const startEvent = new window.MouseEvent('dragstart', { bubbles: true });
      header1.dispatchEvent(startEvent);
      
      // Simulate Drop on Item 2 (Right Half)
      // clientX = 350 (Right half of 210-410)
      const dropEvent = new window.MouseEvent('drop', { 
          bubbles: true,
          clientX: 350,
          clientY: 50
      });
      // We must stop propagation in main.js, so we trigger on container but target item2
      Object.defineProperty(dropEvent, 'target', { value: item2 });
      container.dispatchEvent(dropEvent);
      
      // Verification: item1 should now be AFTER item2 in parent
      const children = Array.from(container.children);
      assert.strictEqual(children[1].id, 'item-1', 'Item 1 should be moved to position 2');
      assert.strictEqual(children[0].id, 'item-2', 'Item 2 should be at position 1');
  });

  it('should reorder items before horizontal drag', function() {
      const container = document.getElementById('print-layout-wrapper');
      // Current order: item-2, item-1
      const item1 = document.getElementById('item-1');
      const item2 = document.getElementById('item-2');
      
      // Mock getBoundingClientRect for item2
      item2.getBoundingClientRect = () => ({
          left: 0, right: 200, top: 0, bottom: 100, width: 200, height: 100
      });
      
      // Simulate Drag Start on Item 1 Header
      const header1 = item1.querySelector('.print-section-header');
      const startEvent = new window.MouseEvent('dragstart', { bubbles: true });
      header1.dispatchEvent(startEvent);
      
      // Simulate Drop on Item 2 (Left Half)
      // clientX = 50 (Left half of 0-200)
      const dropEvent = new window.MouseEvent('drop', { 
          bubbles: true,
          clientX: 50,
          clientY: 50
      });
      Object.defineProperty(dropEvent, 'target', { value: item2 });
      container.dispatchEvent(dropEvent);
      
      // Verification: item1 should be BEFORE item2 again
      const children = Array.from(container.children);
      assert.strictEqual(children[0].id, 'item-1', 'Item 1 should be back at position 1');
      assert.strictEqual(children[1].id, 'item-2', 'Item 2 should be at position 2');
  });
});
