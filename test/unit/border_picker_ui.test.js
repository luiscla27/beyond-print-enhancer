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

describe('Border Picker UI', function() {
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

  it('should inject a border button into each subsection', function() {
    window.injectCloneButtons();
    
    const section = document.getElementById('section-Actions');
    const borderBtn = section.querySelector('.be-border-button');
    assert.ok(borderBtn, 'Border button missing');
    assert.strictEqual(borderBtn.innerHTML, '🖼️');
  });

  it('should show border picker modal and return selected style', async function() {
    const promise = window.showBorderPickerModal('default-border');
    
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Modal not shown');
    
    const options = modal.querySelectorAll('.be-border-option');
    assert.strictEqual(options.length, 8, 'Should have 8 style options');
    
    // Select ability_border
    const abilityOpt = Array.from(options).find(opt => opt.querySelector('.ability_border'));
    assert.ok(abilityOpt, 'Ability option missing');
    abilityOpt.click();
    
    const okBtn = modal.querySelector('.be-modal-ok');
    okBtn.click();
    
    const result = await promise;
    assert.strictEqual(result.style, 'ability_border');
  });

  it('should apply style to section when button clicked', async function() {
    window.injectCloneButtons();
    const section = document.getElementById('section-Actions');
    const borderBtn = section.querySelector('.be-border-button');
    
    // Trigger click
    borderBtn.click();
    
    const modal = document.querySelector('.be-modal-overlay');
    assert.ok(modal, 'Modal not shown on button click');
    
    // Select spikes
    const spikesOpt = Array.from(modal.querySelectorAll('.be-border-option')).find(opt => opt.querySelector('.spikes_border'));
    spikesOpt.click();
    
    const okBtn = modal.querySelector('.be-modal-ok');
    okBtn.click();
    
    // Wait for promise resolution in main.js
    await new Promise(r => setTimeout(r, 50));
    
    assert.ok(section.classList.contains('spikes_border'), 'Section should have spikes_border class');
  });
});
