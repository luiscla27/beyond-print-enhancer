const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Border Styles Injection', function() {
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

  it('should have .default-border class defined', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      
      const css = styleTag.textContent;
      assert.ok(css.includes('.default-border'), 'Should have .default-border class');
      assert.ok(css.includes('--border-img: url('), 'Should define --border-img');
  });

  it('should have .ability_border class defined', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      assert.ok(css.includes('.ability_border'), 'Should have .ability_border class');
  });

  it('should have .spikes_border class defined', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      assert.ok(css.includes('.spikes_border'), 'Should have .spikes_border class');
  });

  it('should have modal border picker styles defined', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      assert.ok(css.includes('.be-border-options'), 'Should have .be-border-options class');
      assert.ok(css.includes('.be-border-option'), 'Should have .be-border-option class');
      assert.ok(css.includes('.be-border-preview'), 'Should have .be-border-preview class');
  });
});
