const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Ability Summary CSS Injection', function() {
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

    // Mock chrome.runtime.getURL
    window.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://mock-id/${path}`
        }
    };

    // Inject dependencies
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    await new Promise(r => setTimeout(r, 200));
  });

  it('should have .ddbc-ability-summary styles defined', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      
      const css = styleTag.textContent;
      assert.ok(css.includes('.ddbc-ability-summary'), 'Should have .ddbc-ability-summary class');
      assert.ok(css.includes('display: contents;'), 'Should have display: contents');
  });

  it('should have .ddbc-ability-summary__secondary styles defined', function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      const css = styleTag.textContent;
      assert.ok(css.includes('.ddbc-ability-summary__secondary'), 'Should have .ddbc-ability-summary__secondary class');
      assert.ok(css.includes('border: 2px solid var(--btn-color);'), 'Should use var(--btn-color)');
      assert.ok(css.includes('border-radius: 150px;'), 'Should have border-radius');
      assert.ok(css.includes('padding: 8px 13px;'), 'Should have padding');
      assert.ok(css.includes('background: white;'), 'Should have background: white');
  });
});
