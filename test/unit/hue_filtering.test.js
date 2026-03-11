const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Hue Filtering Logic', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should set CSS variables for hue-rotate filter', function() {
    const deg = 120;
    window.applyGlobalFilters({ hue: deg, contrast: 100, greyscale: 0, saturate: 100, sepia: 0 });
    
    const rootStyle = document.documentElement.style;
    const hueFilter = rootStyle.getPropertyValue('--be-hue-filter');
    assert.ok(hueFilter.includes(`hue-rotate(${deg}deg)`), 'Variable should contain the correct hue-rotate value');
    
    const style = document.getElementById('be-global-filters-style');
    assert.ok(style, 'Style tag should be created');
  });

  it('should apply inverse hue-rotate variable to content', function() {
    const deg = 120;
    window.applyGlobalFilters({ hue: deg, contrast: 100, greyscale: 0, saturate: 100, sepia: 0 });
    
    const rootStyle = document.documentElement.style;
    const invFilter = rootStyle.getPropertyValue('--be-inv-hue-filter');
    assert.strictEqual(invFilter, `hue-rotate(-${deg}deg)`, 'Variable should contain the inverse hue-rotate value');
    
    const style = document.getElementById('be-global-filters-style');
    assert.ok(style.textContent.includes('var(--be-inv-hue-filter)'), 'Style should reference the inverse variable');
  });

  it('should target shape assets and non-shape images correctly', function() {
    const deg = 120;
    window.applyGlobalFilters({ hue: deg, contrast: 100, greyscale: 0, saturate: 100, sepia: 0 });
    
    const style = document.getElementById('be-global-filters-style');
    assert.ok(style.textContent.includes('img.be-shape-asset'), 'Style should target img.be-shape-asset');
    assert.ok(style.textContent.includes('img:not(.be-shape-asset)'), 'Style should target non-shape images');
  });
});
