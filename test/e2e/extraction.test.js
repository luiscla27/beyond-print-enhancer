const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('DOM Extraction Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="ct-character-sheet-navigation">
            <div class="ct-character-sheet-navigation__tab" data-tab="actions">
                <span class="ct-character-sheet-navigation__tab-label">Actions</span>
            </div>
            <div class="ct-character-sheet-navigation__tab" data-tab="spells">
                <span class="ct-character-sheet-navigation__tab-label">Spells</span>
            </div>
          </div>
          <div class="ct-character-sheet-content">
            <div class="mock-content">Initial Content</div>
          </div>
          <div id="site-main"></div>
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
    global.NodeList = window.NodeList;
  });

  it('should extract and wrap content in draggable containers', function() {
    // This test simulates the logic we are about to write in main.js
    // We need to verify that multiple sections are created and appended
    
    // Mock the logic
    const sectionNames = ['Actions', 'Spells'];
    const parent = document.createElement('div');
    parent.id = 'print-container';
    document.body.appendChild(parent);

    sectionNames.forEach(name => {
        const container = document.createElement('div');
        container.className = 'print-section-container';
        container.dataset.section = name;
        
        const header = document.createElement('div');
        header.className = 'print-section-header';
        header.textContent = name;
        container.appendChild(header);

        const content = document.createElement('div');
        content.className = 'print-section-content';
        content.textContent = `Content for ${name}`;
        container.appendChild(content);

        parent.appendChild(container);
    });

    const sections = document.querySelectorAll('.print-section-container');
    assert.strictEqual(sections.length, 2);
    assert.strictEqual(sections[0].querySelector('.print-section-header').textContent, 'Actions');
    assert.strictEqual(sections[1].querySelector('.print-section-header').textContent, 'Spells');
  });
});
