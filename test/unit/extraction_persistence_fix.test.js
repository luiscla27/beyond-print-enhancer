const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Extraction Persistence Regression', function() {
  let window, document;

  beforeEach(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-1">
            <h3 class="head">Actions</h3>
            <p>Action Content</p>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.indexedDB = global.indexedDB;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
    await window.Storage.init();
  });

  it('should save and restore root-level extractions correctly', async function() {
    window.flagExtractableElements();
    
    // 1. Extract Target 1
    const t1 = document.getElementById('target-1');
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    t1.dispatchEvent(dblClickEvent);
    
    const s1 = document.querySelector('.be-extracted-section');
    assert.ok(s1, 'Extracted section should exist');
    const savedId = s1.id;

    // 2. Scan
    const layout = await window.scanLayout();
    assert.strictEqual(layout.extractions.length, 1, 'Should have 1 extraction');
    assert.strictEqual(layout.extractions[0].id, savedId, 'Should preserve ID');

    // 3. Clear and Restore
    document.getElementById('print-layout-wrapper').innerHTML = '';
    t1.style.display = '';
    
    await window.applyLayout(layout);
    
    // 4. Verify
    const restored = document.querySelector('.be-extracted-section');
    assert.ok(restored, 'Restored section should exist');
    assert.strictEqual(restored.id, savedId, 'Restored ID should match');
    assert.ok(restored.textContent.includes('Action Content'), 'Content should be restored');
    assert.strictEqual(t1.style.display, 'none', 'Original should be hidden');
  });
});
