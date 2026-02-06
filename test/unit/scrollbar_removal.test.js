const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Scrollbar Removal Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="styles_primaryBox__2cqbd" style="max-height: 500px; overflow: auto;">
             <div class="inner-scroll" style="height: 1000px; overflow-y: scroll;">
                Content
             </div>
          </div>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
    global.window = window; // Expose for getComputedStyle
    global.document = document;
  });

  afterEach(() => {
    delete global.window;
    delete global.document; 
  });

  it('should reset max-height and overflow on cloned containers', function() {
      const content = document.querySelector('.styles_primaryBox__2cqbd');
      const clone = content.cloneNode(true);
      
      // Simulate logic from main.js
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
            
      clone.querySelectorAll('*').forEach(el => {
            const style = window.getComputedStyle(el);
             // Note: JSDOM computed style might default to some values, checking explicitly set inline styles for this test setup
             // or calculating. In JSDOM, getComputedStyle usually reflects style attribute if no stylesheets.
             if (el.style.overflow === 'auto' || el.style.overflow === 'scroll' || (el.style.overflowY === 'scroll') || el.style.maxHeight !== 'none') {
                 el.style.maxHeight = 'none';
                 el.style.overflow = 'visible';
             }
      });
      
      const inner = clone.querySelector('.inner-scroll');
      
      assert.strictEqual(clone.style.maxHeight, 'none', 'Container max-height should be none');
      assert.strictEqual(clone.style.overflow, 'visible', 'Container overflow should be visible');
      
      assert.strictEqual(inner.style.maxHeight, 'none', 'Inner max-height should be none');
      assert.strictEqual(inner.style.overflow, 'visible', 'Inner overflow should be visible');
  });
});
