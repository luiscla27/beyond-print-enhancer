const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Merge Execution & Rollback', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
            <div class="print-section-container be-extracted-section" id="source-section" data-original-id="orig-source">
                <div class="print-section-header"><span>Source</span></div>
                <div class="print-section-content">
                    <p>Source Content</p>
                </div>
            </div>
            <div class="print-section-container be-extracted-section" id="target-section" data-original-id="orig-target">
                <div class="print-section-header"><span>Target</span></div>
                <div class="print-section-content">
                    <p>Target Content</p>
                </div>
            </div>
          </div>
          <div id="orig-source" style="display:none">Original Source</div>
          <div id="orig-target" style="display:none">Original Target</div>
        </body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should merge sections and track associated IDs', function() {
    const source = document.getElementById('source-section');
    const target = document.getElementById('target-section');
    
    window.handleMergeSections(source, { type: 'section', id: 'target-section', element: target, name: 'Target' });
    
    // Source should be removed
    assert.strictEqual(document.getElementById('source-section'), null);
    
    // Target should have source content
    assert.ok(target.textContent.includes('Source Content'));
    
    // Target should track orig-source
    const associated = JSON.parse(target.dataset.associatedIds);
    assert.ok(associated.includes('orig-source'));
  });

  it('should rollback all associated elements on close', function() {
    const source = document.getElementById('source-section');
    const target = document.getElementById('target-section');
    
    window.handleMergeSections(source, { type: 'section', id: 'target-section', element: target, name: 'Target' });
    
    // Trigger rollback on target
    window.rollbackSection(target);
    
    // Both originals should be visible
    assert.strictEqual(document.getElementById('orig-source').style.display, '');
    assert.strictEqual(document.getElementById('orig-target').style.display, '');
    
    // Target should be removed
    assert.strictEqual(document.getElementById('target-section'), null);
  });
});
