const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Sidebar Styles Injection', function() {
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
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    
    // Create a script that runs the IIFE (which triggers enforceFullHeight)
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    await new Promise(r => setTimeout(r, 100));
  });

  it('should inject correct styles for .ct-sidebar__portal', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      
      const css = styleTag.textContent;
      assert.ok(css.includes('.ct-sidebar__portal'), 'Should target sidebar portal');
      assert.ok(css.includes('position: fixed !important'), 'Should be fixed position');
      assert.ok(css.includes('top: 0 !important'), 'Should be top 0');
      assert.ok(css.includes('right: 0 !important'), 'Should be right 0');
      assert.ok(css.includes('height: 100% !important'), 'Should be full height');
  });

  it('should inject correct styles for .ct-spell-manager', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      
      assert.ok(css.includes('.ct-spell-manager'), 'Should target spell manager');
      assert.ok(css.includes('overflow-y: auto !important'), 'Should be scrollable');
      assert.ok(css.includes('max-height: 100% !important'), 'Should have max height');
  });

  it('should inject correct styles for .ct-sidebar and .ct-sidebar__inner', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      
      assert.ok(css.includes('.ct-sidebar'), 'Should target sidebar');
      assert.ok(css.includes('position: static !important'), 'Sidebar should be static');
      
      assert.ok(css.includes('.ct-sidebar__inner'), 'Should target sidebar inner');
      assert.ok(css.includes('overflow-y: auto !important'), 'Inner should be scrollable y');
      assert.ok(css.includes('overflow-x: hidden !important'), 'Inner should hide scroll x');
  });
});
