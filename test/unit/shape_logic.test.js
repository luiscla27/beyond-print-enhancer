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

describe('Shape Logic', function() {
  let window, document;

  beforeEach(function() {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
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
    
    global.chrome = {
        runtime: {
            getURL: (path) => `chrome-extension://id/${path}`
        }
    };
    window.chrome = global.chrome;

    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    
    window.eval(elementWrapperContent);
    window.eval(domManagerContent);
    window.eval(mainJsContent);
  });

  describe('createShape', function() {
    it('should create a shape container with correct classes', function() {
        if (typeof window.createShape !== 'function') {
            assert.fail('window.createShape is not defined');
        }
        
        const assetPath = 'assets/shapes/test-shape.png';
        const shape = window.createShape(assetPath);
        
        assert.ok(shape.classList.contains('print-shape-container'), 'Should have print-shape-container class');
        assert.ok(shape.classList.contains('be-shape'), 'Should have be-shape class');
        assert.ok(shape.id.startsWith('shape-'), 'Should have an id starting with shape-');
    });

    it('should apply the correct border-image style', function() {
        const assetPath = 'assets/shapes/test-shape.png';
        const shape = window.createShape(assetPath);
        
        // border-image-source is the most direct way to check
        // Note: browser might normalize the style, we'll check what we can.
        assert.ok(shape.style.borderImageSource.includes('test-shape.png'), 'Border image source should include asset path');
        assert.strictEqual(shape.style.borderStyle, 'solid', 'Border style should be solid');
    });

    it('should be appended to the layout wrapper', function() {
        const assetPath = 'assets/shapes/test-shape.png';
        const shape = window.createShape(assetPath);
        
        const wrapper = document.getElementById('print-layout-wrapper');
        assert.strictEqual(shape.parentElement, wrapper, 'Shape should be child of layout wrapper');
        assert.strictEqual(shape.style.left, '50px', 'Initial left should be 50px');
        assert.strictEqual(shape.style.top, '160px', 'Initial top should be 160px');
    });

    it('should restore from data if provided', function() {
        const restoreData = {
            id: 'shape-123',
            assetPath: 'assets/shapes/old-shape.png',
            styles: {
                width: '150px',
                height: '150px',
                left: '100px',
                top: '100px',
                zIndex: '200'
            }
        };
        
        const shape = window.createShape(restoreData.assetPath, restoreData);
        
        assert.strictEqual(shape.id, 'shape-123');
        assert.strictEqual(shape.style.width, '150px');
        assert.strictEqual(shape.style.height, '150px');
        assert.strictEqual(shape.style.left, '100px');
        assert.strictEqual(shape.style.top, '100px');
        assert.strictEqual(shape.style.zIndex, '200');
    });

    it('should remove the shape when delete button is clicked and confirmed', function() {
        // Mock confirm
        window.confirm = () => true;
        
        const shape = window.createShape('assets/shapes/test.png');
        const deleteBtn = shape.querySelector('.be-shape-delete');
        
        assert.ok(deleteBtn, 'Delete button missing');
        
        deleteBtn.click();
        
        assert.strictEqual(shape.parentElement, null, 'Shape should be removed from DOM');
    });
  });

  describe('Z-Index Management', function() {
    it('should keep shapes above sections when a section is clicked', function() {
        if (typeof window.initZIndexManagement !== 'function') {
            assert.fail('window.initZIndexManagement is not defined');
        }

        const wrapper = document.getElementById('print-layout-wrapper');
        
        // Create a section
        const section = document.createElement('div');
        section.className = 'print-section-container';
        section.style.zIndex = '10';
        wrapper.appendChild(section);
        
        // Create a shape
        const shape = window.createShape('assets/shapes/test.png');
        shape.style.zIndex = '111'; // createShape should have set it high, but let's be explicit
        
        window.initZIndexManagement();
        
        // Simulate click on section
        const event = new window.MouseEvent('mousedown', { bubbles: true });
        section.dispatchEvent(event);
        
        const sectionZ = parseInt(section.style.zIndex);
        const shapeZ = parseInt(shape.style.zIndex);
        
        assert.ok(sectionZ > 10, 'Section Z-Index should have increased');
        assert.ok(shapeZ > sectionZ, 'Shape should still be above section');
    });

    it('should bring clicked shape to the very front', function() {
        const wrapper = document.getElementById('print-layout-wrapper');
        
        const shape1 = window.createShape('assets/shapes/1.png');
        shape1.style.zIndex = '111';
        
        const shape2 = window.createShape('assets/shapes/2.png');
        shape2.style.zIndex = '112';
        
        window.initZIndexManagement();
        
        // Click shape 1
        const event = new window.MouseEvent('mousedown', { bubbles: true });
        shape1.dispatchEvent(event);
        
        assert.ok(parseInt(shape1.style.zIndex) > parseInt(shape2.style.zIndex), 'Shape 1 should now be in front of Shape 2');
    });
  });

  describe('showShapePickerModal', function() {
    it('should open a modal and resolve with selected asset', async function() {
        if (typeof window.showShapePickerModal !== 'function') {
            assert.fail('window.showShapePickerModal is not defined');
        }

        const promise = window.showShapePickerModal();
        
        // Check if modal exists in DOM
        const overlay = document.querySelector('.be-modal-overlay');
        assert.ok(overlay, 'Modal overlay not found');
        
        const okBtn = overlay.querySelector('.be-modal-ok');
        assert.ok(okBtn, 'OK button not found');
        
        // Select an option (first one)
        const option = overlay.querySelector('.be-border-option');
        assert.ok(option, 'Border options not found');
        option.click();
        
        okBtn.click();
        
        const result = await promise;
        assert.ok(result && result.assetPath, 'Result should contain assetPath');
    });
  });

  describe('Persistence', function() {
    beforeEach(() => {
        // Mock Storage
        window.Storage = {
            SCHEMA_VERSION: '1.4.0',
            init: () => Promise.resolve(),
            getAllSpells: () => Promise.resolve([])
        };
    });

    it('should capture shape data in scanLayout', async function() {
        if (typeof window.scanLayout !== 'function') {
            assert.fail('window.scanLayout is not defined');
        }

        const shape = window.createShape('assets/shapes/scan-test.png');
        shape.style.left = '123px';
        shape.style.top = '456px';
        shape.style.width = '100px';
        shape.style.height = '100px';
        shape.style.zIndex = '250';
        
        const layout = await window.scanLayout();
        
        assert.ok(layout.shapes, 'Layout should contain shapes array');
        const captured = layout.shapes.find(s => s.id === shape.id);
        assert.ok(captured, 'Shape not found in scanned layout');
        assert.strictEqual(captured.assetPath, 'assets/shapes/scan-test.png');
        assert.strictEqual(captured.left, '123px');
        assert.strictEqual(captured.top, '456px');
        assert.strictEqual(captured.zIndex, '250');
    });

    it('should restore shapes in applyLayout', async function() {
        if (typeof window.applyLayout !== 'function') {
            assert.fail('window.applyLayout is not defined');
        }

        const layout = {
            version: '1.4.0',
            sections: {},
            shapes: [
                {
                    id: 'shape-restored',
                    assetPath: 'assets/shapes/restore-test.png',
                    left: '10px',
                    top: '20px',
                    width: '50px',
                    height: '50px',
                    zIndex: '300'
                }
            ]
        };
        
        // Clear existing
        document.querySelectorAll('.print-shape-container').forEach(el => el.remove());
        
        await window.applyLayout(layout);
        
        const restored = document.getElementById('shape-restored');
        assert.ok(restored, 'Shape not restored');
        assert.ok(restored.classList.contains('print-shape-container'));
        assert.strictEqual(restored.style.left, '10px');
        assert.strictEqual(restored.style.zIndex, '300');
    });
  });
});
