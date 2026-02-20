const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Spells Exclusion Logic', function() {
  let window, document;

  before(async function() {
    // Mock HTML with tabs
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <body>
        <div class="ct-character-sheet-desktop">
          <nav>
            <button class="styles_tabButton__12345" role="button">Actions</button>
            <button class="styles_tabButton__12345" role="button" data-testid="SPELLS">Spells</button>
            <button class="styles_tabButton__12345" role="button">Inventory</button>
          </nav>
          <div class="sheet-body">
             <section class="ct-primary-box">
                <div class="content">Placeholder Content</div>
             </section>
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

    // Mock navToSection to simulate content changing
    window.navToSection = (name) => {
        // Mock finding content for everything
        return document.querySelector('.ct-primary-box');
    };

    // Inject main.js logic (it self-exposes window.extractAndWrapSections)
    let mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
    let elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
    let domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
    
    // Inject script
    const scriptEl = document.createElement('script');
    scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
    document.body.appendChild(scriptEl);
    await new Promise(r => setTimeout(r, 100));
  });

  it('should explicitly SKIP the tab with data-testid="SPELLS"', async function() {
    if (typeof window.extractAndWrapSections !== 'function') {
        throw new Error('extractAndWrapSections not exposed to window');
    }
    const containers = await window.extractAndWrapSections();
    
    // Debug: Log all containers
    console.log('Containers found:', containers.map(c => c.textContent.trim()));

    // Check if any container matches Spells
    const spellsContainer = containers.find(c => c.textContent.includes('Spells'));
    
    // It should NOT be in the extracted list
    assert.strictEqual(spellsContainer, undefined, 'Spells tab should NOT be in extracted containers');
  });

  it('should skip even if text content is weird but testid matches', async function() {
    // Modify DOM to simulate weird text
    const spellsTab = document.querySelector('[data-testid="SPELLS"]');
    spellsTab.textContent = "Spells (Reordered)"; // Change text to potentially break exact name match
    
    // Rerun extraction
    const containers = await window.extractAndWrapSections();
    const spellsContainer = containers.find(c => c.textContent.includes('Spells'));
    
    // If logic relies ONLY on name being "Spells", this assertion might FAIL (meaning we cloned it)
    // We want it to PASS (meaning we skipped it because of testid)
    assert.strictEqual(spellsContainer, undefined, 'Spells tab should be skipped by data-testid even if name differs');
  });
});
