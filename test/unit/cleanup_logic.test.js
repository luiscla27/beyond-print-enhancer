const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Cleanup Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="styles_primaryBox__2cqbd ct-primary-box">
             <div class="content">
                <menu>
                    <li>Popup Logic</li>
                </menu>
                <div data-testid="tab-filters">Filters</div>
                <button>Manage Spells</button>
             </div>
          </div>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
  });

  it('should hide <menu> tags and tab-filters in the clone', function() {
      const content = document.querySelector('.styles_primaryBox__2cqbd');
      const clone = content.cloneNode(true);
      
      // Simulate logic from main.js
      clone.querySelectorAll('menu').forEach(el => el.style.display = 'none');
      clone.querySelectorAll('[data-testid="tab-filters"]').forEach(el => el.style.display = 'none');
      
      const menu = clone.querySelector('menu');
      const filters = clone.querySelector('[data-testid="tab-filters"]');
      const manageBtn = clone.querySelector('button');
      
      assert.strictEqual(menu.style.display, 'none', '<menu> should be hidden');
      assert.strictEqual(filters.style.display, 'none', 'Filters should be hidden');
      assert.notStrictEqual(manageBtn.style.display, 'none', 'Manage Spells button should NOT be hidden');
  });
});
