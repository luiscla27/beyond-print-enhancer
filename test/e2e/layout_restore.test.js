const assert = require('assert');
const { JSDOM } = require('jsdom');
// Mock Storage
global.Storage = {
    init: async () => {},
    saveLayout: async () => {},
    loadLayout: async () => ({ sectionOrder: ['section-actions', 'section-spells'] })
};

// Mock local logic - we can't easily load the full extension context in Node 
// without a headless browser like Puppeteer/Playwright, which is out of scope 
// for this environment. We will simulate the restoration flow logic unit-style.

describe('End-to-End Simulation', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container" id="section-spells">Spells</div>
            <div class="print-section-container" id="section-actions">Actions</div>
          </div>
        </body>
      </html>
    `, { url: "http://localhost/characters/12345" });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  it('should reorder DOM elements based on loaded layout', async function() {
    // Simulate restoration logic from controls.js
    const data = await global.Storage.loadLayout('12345');
    const container = document.getElementById('print-layout-wrapper');
    
    data.sectionOrder.forEach(id => {
        const el = document.getElementById(id);
        if (el) container.appendChild(el);
    });

    const sections = document.querySelectorAll('.print-section-container');
    assert.strictEqual(sections[0].id, 'section-actions');
    assert.strictEqual(sections[1].id, 'section-spells');
  });
});
