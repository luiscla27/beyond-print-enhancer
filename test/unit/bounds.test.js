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
            <div class="print-section-container" id="s1" style="top: 0px; left: 0px; width: 100px; height: 100px;"></div>
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
    const scriptEl = document.createElement('script');
    scriptEl.textContent = mainJs;
    document.body.appendChild(scriptEl);

    // Mock offsets
    Object.defineProperty(document.getElementById('s1'), 'offsetWidth', { value: 100 });
    Object.defineProperty(document.getElementById('s1'), 'offsetHeight', { value: 100 });
  });

  it('should expand layout bounds when section moves down/right', function() {
    const wrapper = document.getElementById('print-layout-wrapper');
    const s1 = document.getElementById('s1');

    // Initial check (should be viewport size presumably, or base size)
    window.updateLayoutBounds();
    // 800x600 is min
    // S1 at 0,0 100x100 -> Bottom 100, Right 100.
    // +50 padding -> 150.
    // Math.max(150, 600) -> 600.
    
    // Move section WAY out
    s1.style.top = '1000px';
    s1.style.left = '1200px';
    
    window.updateLayoutBounds();
    
    // Bottom: 1000 + 100 = 1100. +50 = 1150.
    // Right: 1200 + 100 = 1300. +50 = 1350.
    
    assert.strictEqual(wrapper.style.minHeight, '1150px');
    assert.strictEqual(wrapper.style.minWidth, '1350px');
  });
});
