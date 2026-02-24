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

describe('Shapes Mode Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-enhance-controls">
              <button class="be-shapes-mode-btn">Shapes Mode</button>
          </div>
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

  describe('toggleShapesMode', function() {
    it('should toggle the be-shapes-mode-active class on body', function() {
        if (typeof window.toggleShapesMode !== 'function') {
            assert.fail('window.toggleShapesMode is not defined');
        }
        
        // Initial state (assuming off for now, we'll implement default ON later)
        document.body.classList.remove('be-shapes-mode-active');
        
        window.toggleShapesMode();
        assert.ok(document.body.classList.contains('be-shapes-mode-active'), 'Class should be added');
        
        window.toggleShapesMode();
        assert.ok(!document.body.classList.contains('be-shapes-mode-active'), 'Class should be removed');
    });

    it('should force state if forceState is provided', function() {
        window.toggleShapesMode(true);
        assert.ok(document.body.classList.contains('be-shapes-mode-active'));
        
        window.toggleShapesMode(true); // Should stay on
        assert.ok(document.body.classList.contains('be-shapes-mode-active'));
        
        window.toggleShapesMode(false);
        assert.ok(!document.body.classList.contains('be-shapes-mode-active'));
    });
  });
});
