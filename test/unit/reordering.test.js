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
            <div class="be-section-wrapper" id="item-1-wrapper" style="position: absolute; left: 0px; top: 0px;">
                <div class="print-section-header" draggable="true">Item 1 Header</div>
                <div class="print-section-container" id="item-1" style="width: 200px; height: 100px;">
                    <div class="print-section-content">Item 1</div>
                </div>
            </div>
            <div class="be-section-wrapper" id="item-2-wrapper" style="position: absolute; left: 200px; top: 0px;">
                <div class="print-section-header" draggable="true">Item 2 Header</div>
                <div class="print-section-container" id="item-2" style="width: 200px; height: 100px;">
                    <div class="print-section-content">Item 2</div>
                </div>
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
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    
    // Initialize DND
    window.initDragAndDrop();
  });

  it('should update coordinates after drag and drop', function() {
      const container = document.getElementById('print-layout-wrapper');
      const item1 = document.getElementById('item-1');
      const wrapper1 = item1.closest('.be-section-wrapper');
      
      // Mock getBoundingClientRect
      container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 1000 });
      wrapper1.getBoundingClientRect = () => ({ left: 10, top: 10, right: 110, bottom: 110 });
      
      // Simulate Drag Start on Item 1 Header (click at 15, 15 - offset 5, 5)
      const header1 = wrapper1.querySelector('.print-section-header');
      const startEvent = new window.MouseEvent('dragstart', { bubbles: true, clientX: 15, clientY: 15 });
      startEvent.dataTransfer = { effectAllowed: '', setData: () => {} };
      header1.dispatchEvent(startEvent);
      
      // Simulate Drop at 205, 205
      // New position: 205 - 0 - 5 = 200
      const dropEvent = new window.MouseEvent('drop', { 
          bubbles: true,
          clientX: 205,
          clientY: 205
      });
      container.dispatchEvent(dropEvent);
      
      // Verification: wrapper1 should have new coordinates
      assert.strictEqual(wrapper1.style.left, '208px');
      assert.strictEqual(wrapper1.style.top, '208px');
  });
});
