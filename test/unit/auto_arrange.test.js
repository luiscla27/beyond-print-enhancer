const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Auto-Arrangement Logic', function() {
  let window, document;

  before(function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container" id="s1"></div>
            <div class="print-section-container" id="s2"></div>
            <div class="print-section-container" id="s3"></div>
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

    // Mock viewport
    window.innerWidth = 800;
  });

  it('should arrange sections in a grid', function() {
    const s1 = document.getElementById('s1');
    const s2 = document.getElementById('s2');
    const s3 = document.getElementById('s3');

    // Mock dimensions
    // Width 300, Gap 15 -> 300+15 = 315 per item
    // 800 width -> 2 items fit (630), 3rd item (945) wraps
    Object.defineProperty(s1, 'offsetWidth', { value: 300 });
    Object.defineProperty(s1, 'offsetHeight', { value: 100 });
    Object.defineProperty(s2, 'offsetWidth', { value: 300 });
    Object.defineProperty(s2, 'offsetHeight', { value: 100 });
    Object.defineProperty(s3, 'offsetWidth', { value: 300 });
    Object.defineProperty(s3, 'offsetHeight', { value: 100 });

    window.autoArrangeSections();

    // Check s1 (Row 1, Col 1)
    // Starts at 10,10. Snaps to 16,16 (nearest 16).
    assert.strictEqual(s1.style.left, '16px');
    assert.strictEqual(s1.style.top, '16px');

    // Check s2 (Row 1, Col 2)
    // 10 + 300 + 15 = 325. Snaps to 320 (20*16)
    assert.strictEqual(s2.style.left, '320px');
    assert.strictEqual(s2.style.top, '16px');

    // Check s3 (Row 2, Col 1) -> Wrapped
    // Row height was 100. New Y = 10 + 100 + 15 = 125. Snaps to 128 (8*16)
    assert.strictEqual(s3.style.left, '16px');
    assert.strictEqual(s3.style.top, '128px');
  });
});
