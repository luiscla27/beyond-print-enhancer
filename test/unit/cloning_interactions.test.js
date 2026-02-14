const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Cloning Interactions', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="print-layout-wrapper">
             <div class="print-section-container be-clone" id="clone-123">
                <div class="print-section-header"><span>My Clone</span></div>
                <div class="print-section-content"><p>Content</p></div>
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
    
    // Mock standard APIs
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.eval(mainJsContent);
  });

  describe('Title Editing', function() {
    it('should update title on double-click', async function() {
        if (typeof window.renderClonedSection !== 'function') {
            assert.fail('window.renderClonedSection is not defined');
        }

        const snapshot = {
            id: 'clone-123',
            originalId: 'section-Actions',
            title: 'Original Title',
            html: '<p>Content</p>'
        };

        const clone = window.renderClonedSection(snapshot);
        const header = clone.querySelector('.print-section-header');
        
        // Mock showInputModal to return new title
        const originalShowInputModal = window.showInputModal;
        window.showInputModal = () => Promise.resolve('Updated Title');
        
        // Simulate double click
        const dblClickEvent = new window.MouseEvent('dblclick', { bubbles: true });
        header.dispatchEvent(dblClickEvent);
        
        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const titleSpan = clone.querySelector('.print-section-header span');
        assert.ok(titleSpan, 'Title span not found in draggable header');
        assert.strictEqual(titleSpan.textContent, 'Updated Title');

        const headerContent = clone.querySelector('.ct-content-group__header-content');
        assert.ok(headerContent.textContent.includes('Updated Title'), 'Header content should contain title');
        
        window.showInputModal = originalShowInputModal;
    });
  });

  describe('Deletion', function() {
    it('should remove section when delete button is clicked', function() {
        const snapshot = {
            id: 'clone-delete-test',
            originalId: 'section-Actions',
            title: 'To Delete',
            html: '<p>Content</p>'
        };

        const clone = window.renderClonedSection(snapshot);
        const deleteBtn = clone.querySelector('.be-clone-delete');
        assert.ok(deleteBtn, 'Delete button not found');

        // Mock confirm
        const originalConfirm = window.confirm;
        window.confirm = () => true;

        assert.ok(document.getElementById('clone-delete-test'));
        deleteBtn.click();
        assert.strictEqual(document.getElementById('clone-delete-test'), null);
        
        window.confirm = originalConfirm;
    });
  });
});
