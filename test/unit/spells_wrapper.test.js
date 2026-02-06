const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Spells Node Wrapping Logic', function() {
  let window, document;

  before(async function() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-desktop">
            <nav><button class="styles_tabButton--active">Spells</button></nav>
            <div class="sheet-body">
              <div class="ct-subsections">
                <div class="ct-primary-box">
                  <button>Manage Spells</button>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    const dom = new JSDOM(htmlContent, {
      url: "https://www.dndbeyond.com/characters/12345",
      runScripts: "dangerously", 
      resources: "usable"
    });
    window = dom.window;
    document = window.document;

    // Inject main.js logic
    window.__DDB_TEST_MODE__ = true;
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    
    const scriptEl = document.createElement('script');
    scriptEl.textContent = mainJs;
    document.body.appendChild(scriptEl);
    
    // Mock navToSection to do nothing (we already have the DOM in Spells state)
    window.navToSection = () => Promise.resolve();
    
    // Ensure visibility for getComputedStyle
    const box = document.querySelector('.ct-primary-box');
    box.style.display = 'block';
    
    await new Promise(r => setTimeout(r, 100));
  });

  it('should wrap the live Spells node in a draggable container', async function() {
      // Trigger injection
      await window.injectClonesIntoSpellsView();
      
      const spellsContainer = document.querySelector('#section-Spells');
      assert.ok(spellsContainer, 'Should create a container with ID section-Spells');
      assert.ok(spellsContainer.classList.contains('print-section-container'), 'Should have print-section-container class');
      
      const spellsNode = spellsContainer.querySelector('.ct-primary-box');
      assert.ok(spellsNode, 'Spells node should be inside the container');
      assert.ok(spellsNode.innerHTML.includes('Manage Spells'), 'Spells content should be preserved');
      
      const header = spellsContainer.querySelector('.print-section-header');
      assert.strictEqual(header.getAttribute('draggable'), 'true', 'Header should be draggable');
      assert.strictEqual(spellsContainer.getAttribute('draggable'), null, 'Container itself should not be draggable to avoid resize conflict');
  });
});
