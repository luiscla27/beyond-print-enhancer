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

describe('UI Wrapper Fix', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper"></div>
        </body>
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
    global.HTMLElement = window.HTMLElement;
    
    global.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://id/${path}`
        }
    };
    window.chrome = global.chrome;

    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  describe('createDraggableContainer structure', function() {
    it('should return a wrapper containing header and container', function() {
        const content = document.createElement('div');
        content.textContent = 'Test Content';
        const wrapper = window.createDraggableContainer('Test Title', content, 'test-id');
        
        assert.ok(wrapper.classList.contains('be-section-wrapper'), 'Should have be-section-wrapper class');
        
        const header = wrapper.querySelector('.print-section-header');
        assert.ok(header, 'Header should be inside wrapper');
        assert.strictEqual(header.parentElement, wrapper, 'Header should be direct child of wrapper');
        
        const container = wrapper.querySelector('.print-section-container');
        assert.ok(container, 'Container should be inside wrapper');
        assert.strictEqual(container.parentElement, wrapper, 'Container should be direct child of wrapper');
        assert.strictEqual(container.id, 'test-id', 'Container should have the provided ID');
        
        const contentArea = container.querySelector('.print-section-content');
        assert.ok(contentArea, 'Content area should be inside container');
        assert.ok(contentArea.contains(content), 'Content should be inside content area');
    });
  });

  describe('getOrCreateActionContainer', function() {
    it('should append actions to the wrapper, not the container', function() {
        const content = document.createElement('div');
        const wrapper = window.createDraggableContainer('Test', content, 'test-id');
        const container = wrapper.querySelector('.print-section-container');
        
        const actionContainer = window.getOrCreateActionContainer(container);
        
        assert.ok(actionContainer.classList.contains('be-section-actions'), 'Should have be-section-actions class');
        assert.strictEqual(actionContainer.parentElement, wrapper, 'Action container should be child of wrapper');
        assert.ok(!container.contains(actionContainer), 'Action container should NOT be child of container');
    });
  });
});
