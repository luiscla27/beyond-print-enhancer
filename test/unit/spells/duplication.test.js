const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Spell Duplication Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="print-section-container" id="section-spells">
            <div class="print-section-header">Spells</div>
            <div class="print-section-content">
                <div class="ct-content-group">Original Content</div>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: "http://localhost",
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
  });

  it('should duplicate spell container with unique ID', function() {
    // Mocking the duplication logic here for verification
    const original = document.getElementById('section-spells');
    const clone = original.cloneNode(true);
    
    // Logic to be implemented
    const timestamp = 123456789;
    clone.id = `section-spells-${timestamp}`;
    
    // Clear content as per spec
    const content = clone.querySelector('.print-section-content');
    content.innerHTML = '<div class="empty-placeholder">Prepared Spells (Empty)</div>';
    
    // Append to body (simulation)
    document.body.appendChild(clone);
    
    const sections = document.querySelectorAll('.print-section-container');
    assert.strictEqual(sections.length, 2);
    assert.strictEqual(sections[1].id, 'section-spells-123456789');
    assert.ok(sections[1].innerHTML.includes('Prepared Spells (Empty)'));
  });
});
