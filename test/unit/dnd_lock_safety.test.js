const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

describe('DnD Lock Safety', () => {
    let dom;
    let window;
    let document;
    let dnd;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body><div id="layout-root"></div></body></html>', {
            url: 'http://localhost',
            runScripts: 'dangerously',
            resources: 'usable'
        });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.Image = window.Image;
        global.Node = window.Node;
        global.HTMLElement = window.HTMLElement;

        // Mock DomManager and LayerManager
        const mockLayerManager = {
            getLayerForElement: (id) => {
                if (id === 'locked-wrapper') return { isLocked: true };
                if (id === 'unlocked-wrapper') return { isLocked: false };
                return null;
            }
        };

        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({
                    element: document.getElementById('layout-root')
                }),
                getLayerManager: () => mockLayerManager
            })
        };

        // Load DnD logic
        const dndCode = fs.readFileSync(path.join(__dirname, '../../js/dnd.js'), 'utf8');
        const script = document.createElement('script');
        script.textContent = dndCode;
        document.head.appendChild(script);
        dnd = window;
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.Image;
        delete global.Node;
        delete global.HTMLElement;
    });

    function createMouseEvent(type, target) {
        const event = new window.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: 10,
            clientY: 10
        });
        Object.defineProperty(event, 'target', { value: target, enumerable: true });
        return event;
    }

    it('should NOT allow dragging a locked element (via mousedown -> draggable=false)', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = 'locked-wrapper';
        wrapper.draggable = true; // Initial state
        document.getElementById('layout-root').appendChild(wrapper);

        dnd.initDragAndDrop();

        // Simulate mousedown
        const mousedown = createMouseEvent('mousedown', wrapper);
        document.getElementById('layout-root').dispatchEvent(mousedown);
        
        assert.strictEqual(wrapper.draggable, false, 'Draggable should be set to false for locked layer on mousedown');
    });

    it('should allow dragging an unlocked element', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = 'unlocked-wrapper';
        wrapper.draggable = false; // Initial state
        document.getElementById('layout-root').appendChild(wrapper);

        dnd.initDragAndDrop();

        // Simulate mousedown
        const mousedown = createMouseEvent('mousedown', wrapper);
        document.getElementById('layout-root').dispatchEvent(mousedown);
        
        assert.strictEqual(wrapper.draggable, true, 'Draggable should be set to true for unlocked layer on mousedown');
    });
});
