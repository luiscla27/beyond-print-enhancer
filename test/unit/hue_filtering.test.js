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

  it('should inject a style tag with hue-rotate filter', function() {
    const deg = 120;
    window.applyGlobalHueShift(deg);
    
    const style = document.getElementById('be-hue-shift-style');
    assert.ok(style, 'Style tag should be created');
    assert.ok(style.textContent.includes(`hue-rotate(${deg}deg)`), 'Style should contain the correct hue-rotate value');
    assert.ok(style.textContent.includes('.print-section-container'), 'Style should target .print-section-container');
  });

  it('should apply inverse hue-rotate to content to exclude it', function() {
    const deg = 120;
    window.applyGlobalHueShift(deg);
    
    const style = document.getElementById('be-hue-shift-style');
    assert.ok(style.textContent.includes(`hue-rotate(-${deg}deg)`), 'Style should contain the inverse hue-rotate value for exclusion');
    assert.ok(style.textContent.includes('.print-section-content'), 'Style should target .print-section-content with inverse filter');
  });
});
