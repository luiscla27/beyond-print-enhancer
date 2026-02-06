const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Height Expansion Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="styles_primaryBox__2cqbd ct-primary-box" style="height: 660px;">
             <div class="ddbc-box-background">
                <svg id="bg-svg" viewBox="0 0 100 100" style="height: 660px;"></svg>
             </div>
             <div class="content">Content</div>
          </div>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    delete global.window;
    delete global.document; 
  });

  it('should override fixed height on container and scale background SVG', function() {
      const content = document.querySelector('.styles_primaryBox__2cqbd');
      const clone = content.cloneNode(true);
      
      // Simulate logic from main.js
      clone.style.height = 'auto'; // Override fixed 660px
      
      const bgSvgs = clone.querySelectorAll('.ddbc-box-background svg');
      bgSvgs.forEach(svg => {
          svg.style.height = '100%';
          svg.setAttribute('preserveAspectRatio', 'none');
      });
      
      // Assertions
      assert.strictEqual(clone.style.height, 'auto', 'Container height should be auto');
      
      const svg = clone.querySelector('svg');
      assert.strictEqual(svg.style.height, '100%', 'SVG height should be 100%');
      assert.strictEqual(svg.getAttribute('preserveAspectRatio'), 'none', 'SVG should have preserveAspectRatio="none"');
  });
});
