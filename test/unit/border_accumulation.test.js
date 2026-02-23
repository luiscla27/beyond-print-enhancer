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

describe('Border Style Accumulation Bug', function() {
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
    window.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://mock/${path}`
        }
    };

    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  it('should remove previous border style when applying a new one', async function() {
    window.injectCloneButtons();
    const section = document.getElementById('section-Actions');
    const borderBtn = section.querySelector('.be-border-button');
    
    // 1. Apply 'dwarf_border'
    section.classList.add('dwarf_border');
    assert.ok(section.classList.contains('dwarf_border'), 'Should have dwarf_border');

    // 2. Click border button to open modal
    borderBtn.click();
    
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Modal should be shown');
    
    // 3. Select 'spiky_border' option
    const spikyOpt = Array.from(modal.querySelectorAll('.be-border-option')).find(opt => 
        opt.querySelector('.spiky_border')
    );
    assert.ok(spikyOpt, 'Spiky option missing');
    spikyOpt.click();
    
    const okBtn = modal.querySelector('.be-modal-ok');
    okBtn.click();
    
    // Wait for promise resolution
    await new Promise(r => setTimeout(r, 100));
    
    assert.ok(section.classList.contains('spiky_border'), 'Should have spiky_border');
    assert.ok(!section.classList.contains('dwarf_border'), 'Should NOT have dwarf_border anymore');
  });

  it('should remove multiple previous border styles when applyLayout is called', async function() {
    const section = document.getElementById('section-Actions');
    section.classList.add('ability_border', 'dwarf_border', 'vine_border');
    
    const layout = {
        sections: {
            'section-Actions': {
                borderStyle: 'spiky_border'
            }
        }
    };
    
    await window.applyLayout(layout);
    
    assert.ok(section.classList.contains('spiky_border'), 'Should have spiky_border');
    assert.ok(!section.classList.contains('ability_border'), 'Should NOT have ability_border');
    assert.ok(!section.classList.contains('dwarf_border'), 'Should NOT have dwarf_border');
    assert.ok(!section.classList.contains('vine_border'), 'Should NOT have vine_border');
  });
});
