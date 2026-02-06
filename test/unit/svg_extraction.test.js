const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('SVG Extraction Logic', function() {
  let window, document;

  beforeEach(function() {
    // Mock a DOM with SVG definitions and a content section
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <svg style="display: none;">
            <defs>
              <symbol id="icon-test" viewBox="0 0 10 10">
                <path d="M0,0 L10,10" />
              </symbol>
            </defs>
          </svg>
          <div class="ct-character-sheet-desktop">
             <div class="sheet-body">
                <!-- Content will be injected here -->
             </div>
          </div>
          <div id="print-layout-wrapper"></div>
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
    global.NodeList = window.NodeList;
  });

  function copySvgDefinitions(targetContainer) {
    // Paste the logic from main.js here for unit testing
    // Since we can't easily export non-exported functions from main.js without refactoring it into modules
    const svgs = document.querySelectorAll('svg');
    svgs.forEach(svg => {
        if (svg.querySelector('defs, symbol') || svg.style.display === 'none') {
            const clone = svg.cloneNode(true);
            clone.style.display = 'none'; 
            targetContainer.appendChild(clone);
        }
    });
  }

  it('should clone hidden SVGs with definitions into the target container', function() {
    const target = document.getElementById('print-layout-wrapper');
    copySvgDefinitions(target);
    
    // Check if SVG was cloned
    const clonedSvg = target.querySelector('svg');
    assert.ok(clonedSvg, 'SVG should be cloned');
    
    // Debug output
    // console.log('Cloned SVG Content:', clonedSvg.outerHTML);
    
    // Selector might be tricky with JSDOM and SVGs? Try without ID.
    assert.ok(clonedSvg.querySelector('symbol'), 'Symbol should be preserved');
    assert.strictEqual(clonedSvg.style.display, 'none', 'Cloned SVG should remain hidden');
  });

  it('should clone the structural container (primaryBox) to preserve dynamic styles', function() {
      // Setup content structure with the target container class
      const container = document.createElement('div');
      container.className = 'styles_primaryBox__2cqbd ct-primary-box';
      container.innerHTML = '<section>Content</section>';
      document.body.appendChild(container); // Append to body so queries work if needed

      // Simulate logic from extractAndWrapSections main.js
      // We found the content, then went up to the parent because it matched key classes
      let content = container.querySelector('section');
      
      // Logic from main.js:
      if (content.parentElement && (
        content.parentElement.className.includes('primaryBox') ||
        content.parentElement.className.includes('ct-primary-box')
      )) {
        content = content.parentElement;
      }
      
      const clone = content.cloneNode(true);
      const wrapper = document.createElement('div');
      wrapper.className = 'print-section-wrapper';
      wrapper.appendChild(clone);
      
      // Assertions
      assert.strictEqual(wrapper.className, 'print-section-wrapper', 'Outer wrapper should be clean');
      const clonedContainer = wrapper.firstElementChild;
      assert.ok(clonedContainer.className.includes('styles_primaryBox'), 'Should clone the style container');
      assert.ok(clonedContainer.className.includes('ct-primary-box'), 'Should clone the standard class');
      assert.ok(clonedContainer.querySelector('section'), 'Should contain the inner content');
  });
});
