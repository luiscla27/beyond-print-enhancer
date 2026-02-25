const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Minimize/Restore Feature', function() {
  let window, document;

  before(function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="test-container"></div>
        </body>
      </html>
    `;
    const dom = new JSDOM(htmlContent, {
      runScripts: "dangerously",
      resources: "usable"
    });
    window = dom.window;
    document = window.document;

    // Inject main.js logic
    window.__DDB_TEST_MODE__ = true;
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);

    // If main.js uses an IIFE that doesn't expose everything to window, 
    // we need to make sure createDraggableContainer is actually on window.
    // In main.js it is exposed at the end: window.createDraggableContainer = createDraggableContainer; (indirectly via exposing some functions)
    // Wait for script execution if necessary (though JSDOM with dangerously runs it sync)
  });

  it('should create minimize and restore buttons in the wrapper', function() {
    const content = document.createElement('div');
    content.textContent = 'Section Content';
    const wrapper = window.createDraggableContainer('Test Section', content, 'test-section');
    
    const minimizeBtn = wrapper.querySelector('.print-section-minimize');
    const restoreBtn = wrapper.querySelector('.print-section-restore');
    
    assert.ok(minimizeBtn, 'Minimize button should exist');
    assert.ok(restoreBtn, 'Restore button should exist');
    assert.strictEqual(minimizeBtn.textContent, 'X');
    assert.strictEqual(restoreBtn.textContent, 'R');
  });

  it('should add .minimized class to container when minimize button is clicked', function() {
    const content = document.createElement('div');
    const wrapper = window.createDraggableContainer('Test Section', content, 'test-section');
    const container = wrapper.querySelector('.print-section-container');
    const minimizeBtn = wrapper.querySelector('.print-section-minimize');
    
    assert.strictEqual(container.classList.contains('minimized'), false);
    
    minimizeBtn.click();
    
    assert.strictEqual(container.classList.contains('minimized'), true);
  });

  it('should remove .minimized class from container when restore button is clicked', function() {
    const content = document.createElement('div');
    const wrapper = window.createDraggableContainer('Test Section', content, 'test-section');
    const container = wrapper.querySelector('.print-section-container');
    const restoreBtn = wrapper.querySelector('.print-section-restore');
    
    container.classList.add('minimized');
    assert.strictEqual(container.classList.contains('minimized'), true);
    
    restoreBtn.click();
    
    assert.strictEqual(container.classList.contains('minimized'), false);
  });
});
