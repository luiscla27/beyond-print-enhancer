const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

describe('DnD Migration - Wrapper Level Dragging', () => {
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

        // Mock DomManager
        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({
                    element: document.getElementById('layout-root')
                }),
                getLayerManager: () => ({
                    getLayerForElement: () => ({ isLocked: false })
                })
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
    });

    function createDragEvent(type, target) {
        const event = new window.CustomEvent(type, {
            bubbles: true,
            cancelable: true
        });
        event.dataTransfer = {
            setData: () => {},
            setDragImage: () => {},
            effectAllowed: 'move'
        };
        event.clientX = 10;
        event.clientY = 10;
        Object.defineProperty(event, 'target', { value: target, enumerable: true });
        return event;
    }

    it('should identify draggable wrapper when clicking directly on it', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = 'test-wrapper';
        wrapper.draggable = true;
        document.getElementById('layout-root').appendChild(wrapper);

        dnd.initDragAndDrop();

        // Mock getBoundingClientRect
        wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
        // Mock getComputedStyle for scale
        window.getComputedStyle = () => ({ transform: 'none' });

        const event = createDragEvent('dragstart', wrapper);
        document.getElementById('layout-root').dispatchEvent(event);
        
        assert.ok(wrapper.classList.contains('dragging'), 'Wrapper should have dragging class');
    });

    it('should NOT initiate drag when clicking on an action button', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = 'test-wrapper';
        wrapper.draggable = true;
        
        const actions = document.createElement('div');
        actions.className = 'be-section-actions';
        const button = document.createElement('button');
        button.className = 'be-delete-button';
        actions.appendChild(button);
        wrapper.appendChild(actions);
        
        document.getElementById('layout-root').appendChild(wrapper);

        dnd.initDragAndDrop();

        const event = createDragEvent('dragstart', button);
        document.getElementById('layout-root').dispatchEvent(event);
        
        // This test is expected to FAIL currently because we haven't implemented the block logic
        assert.ok(!wrapper.classList.contains('dragging'), 'Drag should not start when clicking a button');
    });
});
