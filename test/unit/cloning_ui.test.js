const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

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
});
