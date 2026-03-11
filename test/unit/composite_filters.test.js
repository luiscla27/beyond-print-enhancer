const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Composite Filters Logic', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
        <div class="print-section-container _border-test">Border</div>
        <div class="print-section-content">Content</div>
    </body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should apply composite filter string to decorative elements', function() {
    const filters = {
        hue: 90,
        contrast: 150,
        greyscale: 50,
        saturate: 120,
        sepia: 30
    };
    
    window.applyGlobalFilters(filters);
    
    const styleEl = document.getElementById('be-global-filters-style');
    assert.ok(styleEl, 'Style element should exist');
    
    const css = styleEl.textContent;
    assert.ok(css.includes('hue-rotate(90deg)'), 'Hue missing');
    assert.ok(css.includes('contrast(150%)'), 'Contrast missing');
    assert.ok(css.includes('grayscale(50%)'), 'Greyscale missing');
    assert.ok(css.includes('saturate(120%)'), 'Saturate missing');
    assert.ok(css.includes('sepia(30%)'), 'Sepia missing');
  });

  it('should apply inverse filters to excluded elements', function() {
    const filters = {
        hue: 100,
        contrast: 200,
        greyscale: 0,
        saturate: 100,
        sepia: 0
    };
    
    window.applyGlobalFilters(filters);
    
    const css = document.getElementById('be-global-filters-style').textContent;
    
    // Check for presence of the exclusion selector
    assert.ok(css.includes('.print-section-content'), 'Content selector missing');
    
    // Check for inversion of hue
    assert.ok(css.includes('hue-rotate(-100deg)'), 'Inverse hue missing');
    
    // Check that contrast is NOT inverted (it shouldn't be in any inverse filter)
    // We check the inverse filter block specifically
    const inverseBlock = css.split('!important;').find(b => b.includes('hue-rotate(-100deg)'));
    assert.ok(inverseBlock, 'Inverse filter block not found');
    assert.ok(!inverseBlock.includes('contrast('), 'Contrast should not be in the inverse filter string');
  });

  it('should exclude control panel from all filters', function() {
    const filters = { hue: 10, contrast: 110, greyscale: 10, saturate: 110, sepia: 10 };
    window.applyGlobalFilters(filters);
    
    const css = document.getElementById('be-global-filters-style').textContent;
    assert.ok(css.includes('#print-enhance-controls'), 'Control panel selector missing');
    assert.ok(css.includes('filter: none !important'), 'Filter none missing for control panel');
  });
});
