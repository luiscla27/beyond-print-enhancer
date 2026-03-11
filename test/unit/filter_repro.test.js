const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Filter Inversion Reproduction', function() {
  let window, document;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
        <div class="print-section-container">
            <img class="character-portrait" src="portrait.jpg">
            <img class="be-shape-asset" src="shape.png">
        </div>
    </body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should apply valid inverse filter to portrait and NOT to shape asset', function() {
    const filters = {
        hue: 90,
        contrast: 150,
        greyscale: 50,
        saturate: 120,
        sepia: 30
    };
    
    window.applyGlobalFilters(filters);
    
    // Check CSS variables
    const rootStyle = document.documentElement.style;
    const invFilter = rootStyle.getPropertyValue('--be-inv-hue-filter');
    
    // Hue rotate should be in the variable
    assert.ok(invFilter.includes('hue-rotate(-90deg)'), 'Inverse hue missing in variable');
    
    const styleEl = document.getElementById('be-global-filters-style');
    const css = styleEl.textContent;

    // Check if the inverse filter variable is used for img:not(.be-shape-asset)
    assert.ok(css.includes('img:not(.be-shape-asset)'), 'Missing selector for non-shape images');
    assert.ok(css.includes('var(--be-inv-hue-filter)'), 'Should use inverse hue variable');
  });
});
