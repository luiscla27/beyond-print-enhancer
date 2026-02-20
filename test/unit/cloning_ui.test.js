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

describe('Cloning UI Injection', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-desktop">
             <div class="ct-character-sheet__inner">
                <div class="ct-subsection" id="section-Actions">
                    <div class="ct-subsection__header">Actions</div>
                </div>
                <div class="ct-subsection" id="section-Spells">
                    <div class="ct-subsection__header">Spells</div>
                </div>
             </div>
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
    
    // Mock standard APIs
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  it('should inject a clone button into each subsection', function() {
    if (typeof window.injectCloneButtons !== 'function') {
        assert.fail('window.injectCloneButtons is not defined');
    }
    
    window.injectCloneButtons();
    
    const sections = document.querySelectorAll('.ct-subsection');
    sections.forEach(section => {
        const cloneBtn = section.querySelector('.be-clone-button');
        assert.ok(cloneBtn, `Clone button missing in section ${section.id}`);
        assert.strictEqual(cloneBtn.tagName, 'BUTTON');
    });
  });

  describe('Custom Modal', function() {
    it('should show a modal and resolve with the input value', async function() {
        if (typeof window.showInputModal !== 'function') {
            assert.fail('window.showInputModal is not defined');
        }

        // We need to simulate user interaction
        const promise = window.showInputModal('Title', 'Message', 'Default');
        
        const modal = document.querySelector('.be-modal-overlay');
        assert.ok(modal, 'Modal overlay not found');
        
        const input = modal.querySelector('input');
        assert.strictEqual(input.value, 'Default');
        
        input.value = 'New Title';
        const okBtn = modal.querySelector('.be-modal-ok');
        okBtn.click();
        
        const result = await promise;
        assert.strictEqual(result, 'New Title');
        assert.strictEqual(document.querySelector('.be-modal-overlay'), null, 'Modal not removed');
    });

    it('should resolve with null when cancelled', async function() {
        const promise = window.showInputModal('Title', 'Message', 'Default');
        const cancelBtn = document.querySelector('.be-modal-cancel');
        cancelBtn.click();
        
        const result = await promise;
        assert.strictEqual(result, null);
    });
  });
});
