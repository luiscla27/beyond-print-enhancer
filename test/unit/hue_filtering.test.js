const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

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

    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
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
    window.applyGlobalFilters({ hue: deg, contrast: 150, greyscale: 0, saturate: 100, sepia: 0 });
    
    const rootStyle = document.documentElement.style;
    const invFilter = rootStyle.getPropertyValue('--be-inv-hue-filter');
    assert.strictEqual(invFilter, `hue-rotate(-${deg}deg)`, 'Variable should contain the inverse hue-rotate value');
    
    const decFilter = rootStyle.getPropertyValue('--be-decoration-filter');
    assert.ok(decFilter.includes('contrast(150%)'), 'Decoration filter should contain contrast');
    assert.ok(!decFilter.includes('hue-rotate'), 'Decoration filter should NOT contain hue-rotate');
    
    const style = document.getElementById('be-global-filters-style');
    assert.ok(style.textContent.includes('var(--be-inv-hue-filter)'), 'Style should reference the inverse variable');
  });

  it('should target shape assets and non-shape images correctly', function() {
    const deg = 120;
    window.applyGlobalFilters({ hue: deg, contrast: 100, greyscale: 0, saturate: 100, sepia: 0 });
    
    const style = document.getElementById('be-global-filters-style');
    assert.ok(style.textContent.includes('img.be-shape-asset'), 'Style should target img.be-shape-asset');
    assert.ok(style.textContent.includes('var(--be-decoration-filter)'), 'Style should use decoration filter for shape assets');
    assert.ok(style.textContent.includes('img:not(.be-shape-asset)'), 'Style should target non-shape images');
  });

  it('should ensure the border pseudo-element uses the decoration filter in the main style block', function() {
    // We need to trigger or find the style block created by enforceFullHeight
    // In our test environment, we can check if applyGlobalFilters or the initialization
    // created the correct rule for .print-section-container::before
    const style = document.getElementById('be-global-filters-style');
    
    // Although enforceFullHeight creates its own style block, 
    // we should verify the rule we added to applyGlobalFilters style block
    // and also check the main style block if possible.
    
    const globalStyle = document.getElementById('be-global-filters-style');
    assert.ok(globalStyle.textContent.includes('.print-shape-container'), 'Should target shape containers');
    
    // Search for the border rule in all style tags
    const allStyles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    assert.ok(allStyles.includes('filter: var(--be-decoration-filter) !important'), 'Border/Shape rule should use decoration filter');
    assert.ok(!allStyles.includes('.print-section-container::before { filter: var(--be-full-filter)'), 'Border should NOT use full filter');
  });

  it('should differentiate between standalone and nested shapes', function() {
    window.applyGlobalFilters({ hue: 90, contrast: 100, greyscale: 0, saturate: 200, sepia: 0 });
    
    const style = document.getElementById('be-global-filters-style');
    const css = style.textContent;
    
    // Standalone shapes should use full filter
    assert.ok(css.includes('.be-shape-container,'), 'Should target be-shape-container');
    assert.ok(css.includes('filter: var(--be-full-filter) !important'), 'Standalone shapes should use full filter');
    
    // Nested shapes should use decoration filter
    assert.ok(css.includes('.print-section-container .be-shape-container'), 'Should target nested shapes');
    assert.ok(css.includes('filter: var(--be-decoration-filter) !important'), 'Nested shapes should use decoration filter');
  });
});
