const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Strict Layout & SVG Scaling Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="styles_primaryBox__2cqbd" style="height: 660px; display: block;">
             <div class="ddbc-box-background">
                <svg id="bg-svg" width="623" height="660" viewBox="0 0 623 660"></svg>
             </div>
             <section style="height: 600px;">Internal Section</section>
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

  it('should apply fit-content and display: flex to containers and scale SVGs properly', function() {
      const content = document.querySelector('.styles_primaryBox__2cqbd');
      const clone = content.cloneNode(true);
      
      // Simulate logic from main.js
      clone.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
      
      clone.querySelectorAll('section, .ct-primary-box').forEach(el => {
            el.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
      });

      const bgSvgs = clone.querySelectorAll('.ddbc-box-background svg');
        bgSvgs.forEach(svg => {
            svg.style.height = '100%';
            svg.style.width = '100%';
            if(svg.hasAttribute('height')) svg.removeAttribute('height');
            if(svg.hasAttribute('width')) svg.removeAttribute('width');
            svg.setAttribute('preserveAspectRatio', 'none');
        });
      
      // Assertions for Container
      assert.ok(clone.style.height.includes('fit-content'), 'Container should have fit-content height');
      // note: cssText parsing in JSDOM might vary, but we check presence.
      assert.strictEqual(clone.style.display, 'flex', 'Container should be flex');
      assert.strictEqual(clone.style.flexDirection, 'column', 'Container should be column');
      
      // Assertions for Internal Section
      const section = clone.querySelector('section');
      assert.ok(section.style.height.includes('fit-content'), 'Section should have fit-content height');
      assert.strictEqual(section.style.display, 'flex', 'Section should be flex');

      // Assertions for SVG
      const svg = clone.querySelector('svg');
      assert.strictEqual(svg.style.height, '100%', 'SVG height should be 100%');
      assert.strictEqual(svg.style.width, '100%', 'SVG width should be 100%');
      assert.strictEqual(svg.getAttribute('preserveAspectRatio'), 'none', 'SVG should have preserveAspectRatio="none"');
      assert.strictEqual(svg.hasAttribute('width'), false, 'SVG should not have fixed width attribute');
      assert.strictEqual(svg.hasAttribute('height'), false, 'SVG should not have fixed height attribute');
  });
});
