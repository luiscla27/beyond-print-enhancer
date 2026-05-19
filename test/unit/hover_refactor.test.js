const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Hover Logic Refactor (TDD)', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body></body>
      </html>
    `, {
      url: "http://localhost",
      runScripts: "dangerously",
      resources: "usable"
    });
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  it('should NOT have initHoverHighlights function available on window', function() {
    // This will fail initially as it IS available
    assert.strictEqual(typeof window.initHoverHighlights, 'undefined', 'initHoverHighlights should be removed');
  });

  it('should have native CSS :hover rules for wrappers scoped to active layer in main.js', function() {
    const code = fs.readFileSync(mainJsPath, 'utf8');
    assert.ok(code.includes('.be-active-layer .be-section-wrapper:hover'), 'Should have scoped .be-section-wrapper:hover rule');
    assert.ok(code.includes('.be-active-layer .be-shape-wrapper:hover'), 'Should have scoped .be-shape-wrapper:hover rule');
    assert.ok(code.includes('drop-shadow(0 0 15px #28a745)'), 'Hover rules should include the green drop-shadow');
  });

  it('should NOT use .be-hover-highlight in the CSS strings', function() {
    const code = fs.readFileSync(mainJsPath, 'utf8');
    // We expect .be-hover-highlight to be removed from the main CSS selector list
    const highlightSelectorMatch = code.match(/\.be-hover-highlight\s*,\s*\.be-focus-highlight-hover/);
    assert.ok(!highlightSelectorMatch, 'Primary highlight should NOT target .be-hover-highlight in selector list');
  });

  it('should NOT have initHoverHighlights function called or defined', async function() {
    const code = fs.readFileSync(mainJsPath, 'utf8');
    assert.ok(!code.includes('function initHoverHighlights'), 'Function definition should be removed');
    assert.ok(!code.includes('initHoverHighlights()'), 'Function call should be removed');
  });
});
