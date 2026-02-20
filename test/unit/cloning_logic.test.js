const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const elementWrapperPath = path.resolve(__dirname, '../../js/dom/element_wrapper.js');
const domManagerPath = path.resolve(__dirname, '../../js/dom/dom_manager.js');
const elementWrapperContent = fs.readFileSync(elementWrapperPath, 'utf8');
const domManagerContent = fs.readFileSync(domManagerPath, 'utf8');

describe('Cloning Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="print-section-container" id="section-Actions" style="width: 100px; height: 100px;">
                <div class="print-section-header"><span>Actions</span></div>
                <div class="print-section-content">
                    <div class="content">
                        <button class="interactive">Click Me</button>
                        <menu>Menu</menu>
                        <div class="ct-spell-manager__button">Manage</div>
                        <p>Snapshot Content</p>
                    </div>
                </div>
             </div>
          </div>
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
    
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  describe('captureSectionSnapshot', function() {
    it('should capture the content and remove interactive elements', function() {
        if (typeof window.captureSectionSnapshot !== 'function') {
            assert.fail('window.captureSectionSnapshot is not defined');
        }
        
        const snapshot = window.captureSectionSnapshot('section-Actions');
        
        assert.ok(snapshot.html, 'HTML content missing');
        assert.strictEqual(snapshot.originalId, 'section-Actions');
        
        // Verify sanitization in the snapshot (using a temporary div to parse HTML)
        const temp = document.createElement('div');
        temp.innerHTML = snapshot.html;
        
        assert.ok(temp.querySelector('button'), 'Buttons should be preserved');
        assert.strictEqual(temp.querySelector('menu'), null, 'Menu should still be removed');
        assert.ok(temp.querySelector('p'), 'Non-interactive content should be preserved');
    });

    it('should capture border style', function() {
        const section = document.getElementById('section-Actions');
        section.classList.add('ability_border');
        
        const snapshot = window.captureSectionSnapshot('section-Actions');
        assert.strictEqual(snapshot.borderStyle, 'ability_border');
    });
  });

  describe('renderClonedSection', function() {
    it('should apply border style from snapshot', function() {
        const snapshot = {
            id: 'clone-123',
            originalId: 'section-Actions',
            title: 'Action Clone',
            html: '<p>Content</p>',
            borderStyle: 'spikes_border'
        };
        
        const clone = window.renderClonedSection(snapshot);
        assert.ok(clone.classList.contains('spikes_border'));
    });

    it('should create a new section container from snapshot data', function() {
        if (typeof window.renderClonedSection !== 'function') {
            assert.fail('window.renderClonedSection is not defined');
        }
        
        const snapshot = {
            id: 'clone-123',
            originalId: 'section-Actions',
            title: 'Action Clone',
            html: '<p>Snapshot Content</p>',
            styles: {
                width: '200px',
                height: '300px'
            }
        };
        
        const clone = window.renderClonedSection(snapshot);
        
        assert.strictEqual(clone.id, 'clone-123');
        assert.ok(clone.classList.contains('print-section-container'), 'Should have container class');
        assert.ok(clone.classList.contains('be-clone'), 'Should have clone class');
        
        const titleSpan = clone.querySelector('.print-section-header span');
        assert.strictEqual(titleSpan.textContent, 'Action Clone');

        const staticTitle = clone.querySelector('.ct-content-group__header-content');
        assert.ok(staticTitle, 'Static header content missing');
        assert.strictEqual(staticTitle.textContent, 'Action Clone');
        
        const content = clone.querySelector('.print-section-content');
        assert.ok(content.innerHTML.includes('Snapshot Content'));
        
        assert.strictEqual(clone.style.width, '200px');
        assert.strictEqual(clone.style.height, '300px');
    });
  });
});
