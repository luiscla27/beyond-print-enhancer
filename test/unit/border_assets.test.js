const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Border Asset Extension', function() {
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

    // Inject scripts
    const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    await new Promise(r => setTimeout(r, 100));
  });

  const newBorderClasses = [
    'dwarf_border', 
    'dwarf_hollow_border',
    'sticks_border', 
    'ornament_border', 
    'ornament2_border', 
    'ornament_bold_border', 
    'ornament_bold2_border', 
    'ornament_simple_border', 
    'spike_hollow_border', 
    'spiky_border', 
    'spiky_bold_border', 
    'vine_border'
  ];

  newBorderClasses.forEach(className => {
    it(`should have .${className} class defined in CSS`, function() {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      assert.ok(styleTag, 'Style tag should be created');
      const css = styleTag.textContent;
      assert.ok(css.includes(`.${className}`), `Should have .${className} class`);
    });
  });
});
