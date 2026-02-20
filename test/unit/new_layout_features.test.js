const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
require("fake-indexeddb/auto");

// Read the main.js file content to evaluate in JSDOM context
const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Recent Layout Features', function() {
  let window, document;

  beforeEach(function() {
    // Mock a DOM that represents the D&D Beyond character sheet
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div class="ct-character-sheet-desktop">
             <div class="ct-quick-info" style="display: flex;">
                <span>Quick Info Content</span>
             </div>
             
             <div class="ct-character-sheet__inner">
                <!-- Portrait -->
                <div class="ddbc-character-avatar__portrait">PortraitImg</div>
                
                <!-- Primary Box Target -->
                <div class="ct-subsection ct-subsection--primary-box"></div>

                <!-- Section with preserved SVGs -->
                <section class="ct-section">
                    <div class="ct-primary-box">
                        <div class="ddbc-box-background">
                            <svg class="ddbc-armor-class-box-svg"></svg>
                        </div>
                        <div class="content">Armor Class</div>
                    </div>
                </section>
                
                <!-- Section with removable SVGs -->
                <section class="ct-section">
                     <div class="ct-primary-box">
                        <div class="ddbc-box-background">
                            <svg class="removable-svg"></svg>
                        </div>
                        <div class="content">Other Content</div>
                    </div>
                </section>
                
                <!-- Unnamed sections for auto-naming -->
                <div class="ct-subsections">
                     <div class="ct-subsection"><div>Unnamed Content 1</div></div>
                     <div class="ct-subsection"><div>Unnamed Content 2</div></div>
                </div>
                
                <!-- Sections for Default Layouts -->
                <div id="section-Section-1"></div>
                <div id="section-Actions"></div>
             </div>
          </div>
          <div id="print-layout-wrapper"></div>
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
    global.confirm = () => true; // Mock confirm to true
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    // Mock scroll methods
    window.scrollTo = () => {};
    window.scrollBy = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    
    window.indexedDB = global.indexedDB;
    // We need to evaluate the script. 
    // Since main.js wraps itself in an IIFE, we can just execute it.
    // However, we want to test specific functions.
    // main.js exposes functions to window at the end.
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
    return window.Storage.init();
  });

  describe('SVG Exclusions', function() {
      it('should NOT hide ddbc-armor-class-box-svg', function() {
          const acSvg = document.querySelector('.ddbc-armor-class-box-svg');
          // Simulate the removal logic explicitly to test the function logic
          // But main.js runs on load. So let's check if it ran.
          // Wait, main.js runs extractAndWrapSections which operates on clones.
          // So the DOM in document might not be modified in place yet for main sections?
          // Actually, `injectClonesIntoSpellsView` does modifying in place for the Spells view
          // but mainly creates clones.
          
          // Let's test `removeSpecificSvgs` directly since it's exposed.
          const container = document.querySelector('.ct-section');
          window.removeSpecificSvgs(container);
          
          assert.notStrictEqual(acSvg.style.display, 'none', 'AC SVG should be preserved');
      });

      it('should hide other SVGs', function() {
          const otherSection = document.querySelectorAll('.ct-section')[1];
          const svg = otherSection.querySelector('.removable-svg');
          window.removeSpecificSvgs(otherSection);
          
          // Note: our logic hides .ddbc-box-background mostly, or section > div > svg
          // The structure in mock might need to match exactly what `removeSpecificSvgs` targets
          // Logic: 
          // 1. .ddbc-box-background (first one)
          // 2. section > div > svg
          
          const bg = otherSection.querySelector('.ddbc-box-background');
          assert.strictEqual(bg.style.display, 'none', 'Background should be hidden for non-AC elements');
      });
  });

  describe('Quick Info', function() {
      it('should be moved to print layout and wrapped', function() {
          // Setup with Health
          const quickInfo = document.querySelector('.ct-quick-info');
          const health = document.createElement('div');
          health.className = 'ct-quick-info__health';
          health.textContent = 'Health: 10/10';
          quickInfo.appendChild(health);

          // Mock Quick Info Boxes for separation logic
          const box = document.createElement('div');
          box.className = 'ct-quick-info__box';
          const label = document.createElement('div');
          label.className = 'ct-quick-info__box-label';
          label.textContent = 'Armor Class';
          box.appendChild(label);
          quickInfo.appendChild(box);

          // Trigger the separation logic that user claims destroys the parent
          window.separateQuickInfoBoxes();
          
          // Original "moveQuickInfo" might be redundant or part of the same flow?
          // User says line 1822 removes parent. logic at 1822 is inside separateQuickInfoBoxes

          const layout = document.getElementById('print-layout-wrapper');
          // Verify Health is extracted as a section
          const healthSection = layout.querySelector('#section-Quick-Info-Health');
          assert.ok(healthSection, 'Health should be extracted into its own section');
          assert.ok(healthSection.querySelector('.ct-quick-info__health'), 'Health element should be inside the new section');

          // Verify parent is removed (optional, but requested by user)
          // The original quickInfo might be removed from its original place or empty
          assert.strictEqual(quickInfo.parentElement, null, 'Original parent should be removed');
          // Check default layout application (needs wait or manual check of style)
      });
  });

  describe('Character Portrait', function() {
      it('should move portrait to primary box', function() {
          window.movePortrait();
          const target = document.querySelector('.ct-subsection--primary-box');
          const portrait = target.querySelector('.ddbc-character-avatar__portrait');
          
          assert.ok(portrait, 'Portrait should be inside the primary box');
      });
  });

  describe('Page Separators', function() {
      it('should draw separators based on content width scaling', function() {
          // Mock layout dimensions
          const wrapper = document.getElementById('print-layout-wrapper');
          
          // Force a width that triggers scaling (e.g. 1632px = 2 * 816px, so 50% scale)
          // Since we can't easily mock layout/rendering in JSDOM, we pass arguments manually to `drawPageSeparators`
          // which `updateLayoutBounds` would normally do.
          
          // Test Normal Width (816px) -> Scale 1 -> Page Height 960px
          window.drawPageSeparators(2000, 816);
          let separators = wrapper.querySelectorAll('.print-page-separator');
          assert.ok(separators.length > 0);
          assert.strictEqual(separators[0].style.top, '960px');

          // Test Double Width (1632px) -> Scale 0.5 -> Page Height 960 / 0.5 = 1920px
          window.drawPageSeparators(4000, 1632);
          separators = wrapper.querySelectorAll('.print-page-separator');
          assert.strictEqual(separators[0].style.top, '1920px');
      });
  });
  
  describe('Default Layouts', function() {
      it('should apply confirmed default coordinates', function() {
           // Arrange
           const actionSection = document.getElementById('section-Actions');
           
           // Act
           window.applyDefaultLayout();

           // Assert
           // DEFAULT_LAYOUTS['section-Actions'] = { left: '512px', top: '352px', ... }
           assert.strictEqual(actionSection.style.left, '512px');
           assert.strictEqual(actionSection.style.top, '352px');
      });
  });

  describe('Inner Content Resize', function() {
      it('should adjust width of immediate children in target containers', function() {
          // Setup
          const section = document.createElement('section');
          
          // Master parent content
          const parentContent = document.createElement('div');
          parentContent.className = 'print-section-content';
          // Mock clientWidth since JSDOM doesn't calculate layout
          Object.defineProperty(parentContent, 'clientWidth', { value: 150, configurable: true });
          section.appendChild(parentContent);

          // Container 1: ends in -row-header
          const header = document.createElement('div');
          header.className = 'some-component-row-header';
          const child1 = document.createElement('div');
          child1.style.width = '100px';
          header.appendChild(child1);
          section.appendChild(header);
          
          // Container 2: ends in -content
          const content = document.createElement('div');
          content.className = 'some-component-content';
          const child2 = document.createElement('div');
          child2.style.width = '200px';
          const child3 = document.createElement('span'); // Should be ignored
          child3.style.width = '50px';
          content.appendChild(child2);
          content.appendChild(child3);
          section.appendChild(content);
          
          // Container 3: ignored
          const ignored = document.createElement('div');
          ignored.className = 'ignored-container';
          const child4 = document.createElement('div');
          child4.style.width = '300px';
          ignored.appendChild(child4);
          section.appendChild(ignored);
          
          document.body.appendChild(section);
          
          // Act: Trigger resize (deltaX is ignored by implementation now, it matches parent)
          window.adjustInnerContentWidth(section, 50);
          
          // Assert
          assert.strictEqual(child1.style.width, '150px', 'Header child should match parent content width');
          assert.strictEqual(child2.style.width, '150px', 'Content child should match parent content width');
          assert.strictEqual(child3.style.width, '50px', 'Span child should be ignored');
          assert.strictEqual(child4.style.width, '300px', 'Ignored container child should be unchanged');
          
          // Act: Change parent width and re-trigger
          Object.defineProperty(parentContent, 'clientWidth', { value: 130 });
          window.adjustInnerContentWidth(section, -20);
          
          // Assert
          assert.strictEqual(child1.style.width, '130px', 'Header child should match new parent content width');
      });
  });

  describe('Z-Index Application', function() {
      it('should apply zIndex correctly from default layout', function() {
          // Setup a section that exists in DEFAULT_LAYOUTS with a known zIndex
          // section-Section-6 has zIndex: "65"
          const section6 = document.createElement('div');
          section6.id = 'section-Section-6';
          section6.className = 'print-section-container';
          document.body.appendChild(section6);

          // Act
          window.applyDefaultLayout();

          // Assert
          // We check the style property. Note: JSDOM might be lenient, but we suspect setProperty('zIndex') is the issue vs 'z-index'
          assert.strictEqual(section6.style.zIndex, '65', 'Z-Index should be applied');
      });
  });

  describe('Layout Scanner', function() {
      it('should extract coordinates, sizes and inner widths', async function() {
          // Setup
          const wrapper = document.getElementById('print-layout-wrapper');
          const section = document.createElement('div');
          section.className = 'print-section-container';
          section.id = 'section-Test';
          section.style.left = '100px';
          section.style.top = '200px';
          section.style.width = '300px';
          section.style.height = '400px';

          const content = document.createElement('div');
          content.className = 'test-content';
          const innerDiv = document.createElement('div');
          innerDiv.style.width = '150px';
          content.appendChild(innerDiv);
          section.appendChild(content);
          wrapper.appendChild(section);

          // Act
          const layout = await window.scanLayout();

          // Assert
          assert.ok(layout.sections['section-Test']);
          assert.strictEqual(layout.sections['section-Test'].left, '100px');
          assert.strictEqual(layout.sections['section-Test'].top, '200px');
          assert.strictEqual(layout.sections['section-Test'].width, '300px');
          assert.strictEqual(layout.sections['section-Test'].height, '400px');
          // Note: innerWidths depends on class matching "-content" or "-row-header"
          // Let's refine the test for innerWidths
          content.className = 'some-content';
          const layout2 = await window.scanLayout();
          assert.ok(layout2.sections['section-Test'].innerWidths);
          // We need a way to identify the inner div, maybe index?
          // The spec says "immediate div children within containers ending in -row-header or -content"
      });
  });

  describe('Layout Applier', function() {
      it('should apply coordinates, sizes and inner widths', async function() {
          const wrapper = document.getElementById('print-layout-wrapper');
          const section = document.createElement('div');
          section.className = 'print-section-container';
          section.id = 'section-ApplyTest';
          wrapper.appendChild(section);

          const content = document.createElement('div');
          content.className = 'test-content';
          const innerDiv = document.createElement('div');
          content.appendChild(innerDiv);
          section.appendChild(content);

          const layout = {
              version: "1.0.0",
              sections: {
                  "section-ApplyTest": {
                      left: "150px",
                      top: "250px",
                      width: "350px",
                      height: "450px",
                      zIndex: "20",
                      innerWidths: {
                          "0-0": "180px"
                      }
                  }
              }
          };

          // Act
          await window.applyLayout(layout);

          // Assert
          assert.strictEqual(section.style.left, '150px');
          assert.strictEqual(section.style.top, '250px');
          assert.strictEqual(section.style.width, '350px');
          assert.strictEqual(section.style.height, '450px');
          assert.strictEqual(section.style.zIndex, '20');
          assert.strictEqual(innerDiv.style.width, '180px');
      });
  });

  describe('Control Panel UI', function() {
      it('should create a vertical control panel in the top-left', function() {
          // Act
          window.createControls();
          
          const controls = document.getElementById('print-enhance-controls');
          assert.ok(controls, 'Controls container should exist');
          assert.strictEqual(controls.style.position, 'fixed');
          assert.strictEqual(controls.style.left, '10px');
          assert.strictEqual(controls.style.top, '10px');
          assert.strictEqual(controls.style.display, 'flex');
          assert.strictEqual(controls.style.flexDirection, 'column');
          
          // Verify buttons
          const buttons = controls.querySelectorAll('button');
          const labels = Array.from(buttons).map(b => b.textContent.trim());
          assert.ok(labels.some(l => l.includes('Save to Browser')));
          assert.ok(labels.some(l => l.includes('Save to PC')));
          assert.ok(labels.some(l => l.includes('Reset to Default')));
          assert.ok(labels.some(l => l.includes('Load')));
          assert.ok(labels.some(l => l.includes('Contribute')));
      });
  });

  describe('Fallback Modal', function() {
      it('should create an overlay and modal with textarea', function() {
          const testJson = '{"test": true}';
          window.showFallbackModal(testJson);
          
          const overlay = document.getElementById('print-enhance-overlay');
          assert.ok(overlay, 'Overlay should exist');
          
          const textarea = overlay.querySelector('textarea');
          assert.ok(textarea, 'Textarea should exist');
          assert.strictEqual(textarea.value, testJson);
          
          const closeBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent === 'Close');
          assert.ok(closeBtn, 'Close button should exist');
          
          // Close it
          closeBtn.click();
          assert.ok(!document.getElementById('print-enhance-overlay'), 'Overlay should be removed');
      });
  });

});
