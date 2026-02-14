const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Extraction Triggers', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div class="ct-actions-group" id="parent-group">
            <div class="styles_actionsList__123" id="nested-list"></div>
          </div>
          <div class="ct-snippet--class" id="snippet"></div>
          <div class="styles_attackTable__abc" id="attack-table"></div>
          <div class="ct-character-sheet__traits" id="traits"></div>
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
    if (window.injectCompactStyles) window.injectCompactStyles();
  });

  it('should flag top-level extractable elements', function() {
    if (typeof window.flagExtractableElements !== 'function') {
        assert.fail('flagExtractableElements is not defined');
    }
    
    window.flagExtractableElements();
    
    assert.ok(document.getElementById('parent-group').classList.contains('be-extractable'), 'Parent group should be flagged');
    assert.ok(document.getElementById('snippet').classList.contains('be-extractable'), 'Snippet should be flagged');
    assert.ok(document.getElementById('attack-table').classList.contains('be-extractable'), 'Attack table should be flagged');
    assert.ok(document.getElementById('traits').classList.contains('be-extractable'), 'Traits should be flagged');
  });

  it('should ignore nested extractable elements', function() {
    window.flagExtractableElements();
    
    assert.ok(document.getElementById('parent-group').classList.contains('be-extractable'), 'Parent group should be flagged');
    assert.ok(!document.getElementById('nested-list').classList.contains('be-extractable'), 'Nested list should NOT be flagged');
  });

  it('should inject CSS for be-extractable', function() {
    const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    assert.ok(styles.includes('.be-extractable:hover'), 'CSS should include hover rule for be-extractable');
    assert.ok(styles.includes('outline: 2px dashed black'), 'CSS should include dashed outline');
    assert.ok(styles.includes('Extract content with double click'), 'CSS should include tooltip text');
  });
});
