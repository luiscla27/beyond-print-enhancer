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
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    
    // Call enforcement manually as auto-execution is disabled
    window.enforceFullHeight();
    
    await new Promise(r => setTimeout(r, 100));
  });

  it('should have absolute containers in CSS', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      
      const css = styleTag.textContent;
      
      assert.ok(css.includes('position: absolute !important'), 'Should have absolute positioning');
      assert.ok(css.includes('overflow: hidden !important'), 'Should have overflow hidden');
      
      // Check for global font and wrapping
      assert.ok(css.includes('font-size: 8px !important'), 'Should have global 8px font size');
      assert.ok(css.includes('white-space: normal !important'), 'Should have text wrapping');
  });
  
  it('should apply move cursor to headers', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      assert.ok(css.includes('.print-section-header'), 'Should have header styling');
      assert.ok(css.includes('cursor: move'), 'Should have move cursor for drag signal');
      assert.ok(css.includes('opacity: 0'), 'Header should be hidden by default');
      assert.ok(css.includes('.print-section-container:hover .print-section-header'), 'Header should show on hover');
  });
});
