const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Custom Resize Logic with Snapping', function() {
  let window, document;

  before(async function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container" id="s1" style="width: 100px; height: 100px;">
                <div class="print-section-content">Content</div>
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
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    
    // Mock getComputedStyle for JSDOM
    // JSDOM doesn't layout, so we need to mock it
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (el) => {
        if (el.id === 's1') {
            return {
                width: el.style.width,
                height: el.style.height
            };
        }
        return originalGetComputedStyle(el);
    };

    // Initialize resize logic
    window.initResizeLogic();
  });

  it('should snap width and height to 8px grid', function() {
    const s1 = document.getElementById('s1');
    const handle = s1.querySelector('.print-section-resize-handle');
    assert.ok(handle, 'Resize handle should be created');

    // Simulate mousedown
    const mouseDown = new window.MouseEvent('mousedown', {
        bubbles: true,
        clientX: 100, // Starting at "right edge" logically
        clientY: 100
    });
    handle.dispatchEvent(mouseDown);

    // Simulate mousemove + 5px (100 -> 105)
    // 100 + 5 = 105. Round(105/16)*16 = 7*16 = 112
    let mouseMove = new window.MouseEvent('mousemove', {
        bubbles: true,
        clientX: 105,
        clientY: 105
    });
    document.documentElement.dispatchEvent(mouseMove);
    
    assert.strictEqual(s1.style.width, '112px');
    assert.strictEqual(s1.style.height, '112px');

    // Simulate mousemove + 20px (100 -> 120)
    // 100 + 20 = 120. Round(120/16)*16 = 8*16 = 128
    mouseMove = new window.MouseEvent('mousemove', {
        bubbles: true,
        clientX: 120,
        clientY: 120
    });
    document.documentElement.dispatchEvent(mouseMove);

    assert.strictEqual(s1.style.width, '128px');
    assert.strictEqual(s1.style.height, '128px');

    // Cleanup
    const mouseUp = new window.MouseEvent('mouseup', { bubbles: true });
    document.documentElement.dispatchEvent(mouseUp);
  });
});
