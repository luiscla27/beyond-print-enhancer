const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Z-Index Management', function() {
  let window, document;

  before(function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container" id="section-1" style="z-index: 10;">
                <div class="print-section-content">Content 1</div>
            </div>
            <div class="print-section-container" id="section-2" style="z-index: 20;">
                <div class="print-section-content">Content 2</div>
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

    // Mock getComputedStyle if needed, but JSDOM implementation should suffice for basic z-index
  });

  it('should bring clicked section to front', function() {
    const section1 = document.getElementById('section-1');
    const section2 = document.getElementById('section-2');

    // Initialize Z-Index logic
    window.initZIndexManagement();

    // Verify initial state
    assert.strictEqual(section1.style.zIndex, '10');
    assert.strictEqual(section2.style.zIndex, '20');

    // Click section 1
    const clickEvent = new window.MouseEvent('mousedown', { bubbles: true });
    section1.dispatchEvent(clickEvent);

    // Section 1 should now be higher than 20 (likely 21)
    assert.strictEqual(section1.style.zIndex, '21');
    
    // Click section 2
    section2.dispatchEvent(clickEvent);
    
    // Section 2 should now be higher than 21 (likely 22)
    assert.strictEqual(section2.style.zIndex, '22');
  });
});
