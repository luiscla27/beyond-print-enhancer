const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Dynamic Layout Bounds', function() {
  let window, document;

  before(async function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper" style="min-height: 100vh; min-width: 100vw;">
            <div class="be-section-wrapper" style="top: 0px; left: 0px;">
                <div class="print-section-container" id="s1" style="width: 100px; height: 100px;"></div>
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
    
    // Mock window dimensions
    window.innerWidth = 800;
    window.innerHeight = 600;

    // Inject main.js logic
    window.__DDB_TEST_MODE__ = true;
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);

    // Mock offsets
    Object.defineProperty(document.getElementById('s1'), 'offsetWidth', { value: 100 });
    Object.defineProperty(document.getElementById('s1'), 'offsetHeight', { value: 100 });
  });

  it('should expand layout bounds when section moves down/right', function() {
    const wrapper = document.getElementById('print-layout-wrapper');
    const s1 = document.getElementById('s1');
    const s1Wrapper = s1.closest('.be-section-wrapper');

    // Mock offsets on the wrapper
    Object.defineProperty(s1Wrapper, 'offsetWidth', { value: 100 });
    Object.defineProperty(s1Wrapper, 'offsetHeight', { value: 100 });

    // Initial check (should be viewport size presumably, or base size)
    window.updateLayoutBounds();
    
    // Move section wrapper WAY out
    s1Wrapper.style.top = '1000px';
    s1Wrapper.style.left = '1200px';
    
    window.updateLayoutBounds();
    
    // Bottom: 1000 + 100 = 1100. +50 = 1150.
    // Right: 1200 + 100 = 1300. +50 = 1350.
    
    assert.strictEqual(wrapper.style.minHeight, '1150px');
    assert.strictEqual(wrapper.style.minWidth, '1350px');
  });
});
