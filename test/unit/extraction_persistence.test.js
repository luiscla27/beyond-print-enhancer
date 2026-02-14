const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Extraction Persistence', function() {
  let window, document;

  beforeEach(async function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
          <div class="ct-actions-group" id="target-1">
            <h3 class="head">Actions</h3>
            <p>Content 1</p>
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

  it('should include extractions in scanLayout', async function() {
    const target = document.getElementById('target-1');
    window.flagExtractableElements();
    
    // Perform extraction
    const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
    target.dispatchEvent(dblClickEvent);
    
    const layout = await window.scanLayout();
    assert.ok(layout.extractions, 'Layout should have extractions array');
    assert.strictEqual(layout.extractions.length, 1, 'Should have one extraction');
    assert.strictEqual(layout.extractions[0].originalId, 'target-1');
    assert.ok(layout.extractions[0].html.includes('Content 1'));
  });

  it('should restore extractions in applyLayout', async function() {
    const layout = {
        version: '1.2.0',
        sections: {},
        clones: [],
        extractions: [{
            id: 'ext-123',
            originalId: 'target-1',
            title: 'Saved Extraction',
            html: '<div class="ct-content-group__header">Saved Extraction</div><div id="target-1">Restored Content</div>',
            left: '100px',
            top: '200px'
        }]
    };

    await window.applyLayout(layout);
    
    const extraction = document.getElementById('ext-123');
    assert.ok(extraction, 'Extraction should be rendered');
    assert.strictEqual(extraction.style.left, '100px');
    
    const original = document.getElementById('target-1');
    // Note: In JSDOM, if we replace the body or have multiple elements with same ID it might be tricky.
    // But renderExtractedSection looks for originalId in document.
    assert.strictEqual(original.style.display, 'none', 'Original element should be hidden on restore');
  });
});
