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

describe('Border Picker UI Expansion', function() {
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

  const expectedNewStyles = [
    { id: 'dwarf_border', label: 'Dwarf' },
    { id: 'sticks_border', label: 'Sticks' },
    { id: 'ornament_border', label: 'Ornament 1' },
    { id: 'ornament2_border', label: 'Ornament 2' },
    { id: 'ornament_bold_border', label: 'Ornament Bold' },
    { id: 'ornament_bold2_border', label: 'Ornament Bold 2' },
    { id: 'ornament_simple_border', label: 'Ornament Simple' },
    { id: 'spike_hollow_border', label: 'Spike Hollow' },
    { id: 'spiky_border', label: 'Spiky' },
    { id: 'spiky_bold_border', label: 'Spiky Bold' },
    { id: 'vine_border', label: 'Vine' }
  ];

  it('should include all new border options in the modal', async function() {
    // We don't need to await the promise if we just want to inspect the modal DOM
    window.showBorderPickerModal('default-border');
    
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Modal not shown');
    
    const options = modal.querySelectorAll('.be-border-option');
    // Existing 8 + new 11 = 19
    assert.strictEqual(options.length, 19, 'Should have 19 style options');
    
    expectedNewStyles.forEach(style => {
        const opt = Array.from(options).find(opt => 
            opt.textContent.includes(style.label) && 
            opt.querySelector(`.be-border-preview.${style.id}`)
        );
        assert.ok(opt, `Option for ${style.label} (${style.id}) missing or incorrect`);
    });
  });
});
