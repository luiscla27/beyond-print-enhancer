const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Layout Flexibility Logic', function() {
  let window, document;

  before(async function() {
    const htmlContent = '<!DOCTYPE html><html><head></head><body></body></html>';
    const dom = new JSDOM(htmlContent, {
      url: "https://www.dndbeyond.com/characters/12345",
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
    
    // Call enforcement manually as auto-execution is disabled
    window.enforceFullHeight();
    
    await new Promise(r => setTimeout(r, 100));
  });

  it('should have resizable and inline-block containers in CSS', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      
      const css = styleTag.textContent;
      
      // Check for resizable property
      assert.ok(css.includes('resize: horizontal !important'), 'Should have horizontal resize');
      assert.ok(css.includes('display: inline-block'), 'Should have inline-block display');
      assert.ok(css.includes('overflow: auto !important'), 'Should have overflow auto for resize to work');
      assert.ok(css.includes('scrollbar-width: none !important'), 'Should hide scrollbars (Firefox)');
      assert.ok(css.includes('display: none !important'), 'Should hide scrollbars (WebKit)');
      
      // Check for global font and wrapping
      assert.ok(css.includes('font-size: 8px !important'), 'Should have global 8px font size');
      assert.ok(css.includes('white-space: normal !important'), 'Should have text wrapping');
      
      assert.ok(css.includes('position: relative !important'), 'Should have position relative');
  });
  
  it('should apply move cursor to headers', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      assert.ok(css.includes('.print-section-header'), 'Should have header styling');
      assert.ok(css.includes('cursor: move'), 'Should have move cursor for drag signal');
  });
});
