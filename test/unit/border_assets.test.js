const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Border Assets and Variables', function() {
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

    // Inject dependencies - FORCE RE-READ
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    await new Promise(r => setTimeout(r, 200)); // Increased wait
  });

  function getCSSRule(className) {
      const styleTag = document.getElementById('ddb-print-enhance-style');
      if (!styleTag) return null;
      const css = styleTag.textContent;
      // Use more flexible regex for escaped characters in JSDOM if needed
      const regex = new RegExp(`${className.replace(':', '\\:')}\\s*{([^}]*)}`, 'm');
      const match = css.match(regex);
      return match ? match[1] : null;
  }

  it('should use chrome-extension URL for default border', function() {
      const css = getCSSRule(':root');
      assert.ok(css && css.includes('chrome-extension://mock-id/assets/border_default.png'), 'Default border should use mock chrome-extension URL');
      assert.ok(css && !css.includes('data:image/'), 'Default border should NOT use data URL');
  });

  it('should have correct variables for ability_border', function() {
      const css = getCSSRule('.ability_border');
      assert.ok(css && css.includes('chrome-extension://mock-id/assets/border_ability.gif'), 'ability_border should use mock chrome-extension URL');
      assert.ok(css && css.includes('--border-img-slice: 51'), 'ability_border should have slice 51');
      assert.ok(css && css.includes('--border-img-width: 34px'), 'ability_border should have width 34px');
  });

  it('should have correct variables for spikes_border', function() {
      const css = getCSSRule('.spikes_border');
      assert.ok(css && css.includes('chrome-extension://mock-id/assets/border_spikes.gif'), 'spikes_border should use mock chrome-extension URL');
      assert.ok(css && css.includes('--border-img-slice: 177'), 'spikes_border should have slice 177');
      assert.ok(css && css.includes('--border-img-width: 118px'), 'spikes_border should have width 118px');
  });

  it('should have correct variables for barbarian_border', function() {
      const css = getCSSRule('.barbarian_border');
      assert.ok(css && css.includes('chrome-extension://mock-id/assets/border_barbarian.gif'), 'barbarian_border should use mock chrome-extension URL');
      assert.ok(css && css.includes('--border-img-slice: 311'), 'barbarian_border should have slice 311');
      assert.ok(css && css.includes('--border-img-width: 208px'), 'barbarian_border should have width 208px');
  });
});
