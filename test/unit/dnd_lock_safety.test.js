const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

/**
 * Pointer-engine lock-safety tests (track drag_ux_overhaul_20260909, Phase 1).
 * Locked layers must never arm a pointer drag (AC-1); unlocked wrappers drag
 * normally. Replaces the native `mousedown -> draggable` arm/unarm contract —
 * the wrapper is no longer a native drag source, so the assertion is on
 * movement/ghost state instead of the draggable attribute.
 */
describe('DnD Pointer Engine - Lock Safety', () => {
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

        // Mock DomManager and LayerManager (locked by wrapper id).
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
        window.getComputedStyle = () => ({ transform: 'none' });

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

    function createPointerEvent(type, target, x, y) {
        const event = new window.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        Object.defineProperty(event, 'target', { value: target, enumerable: true });
        return event;
    }

    function makeWrapper(id) {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = id;
        document.getElementById('layout-root').appendChild(wrapper);
        return wrapper;
    }

    function dragSequence(target, fromX, fromY, midX, midY, toX, toY) {
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerdown', target, fromX, fromY)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', target, midX, midY)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerup', target, toX, toY)
        );
    }

    it('should NOT drag a locked layer (never arms, never moves)', () => {
        const wrapper = makeWrapper('locked-wrapper');
        dnd.initDragAndDrop();

        dragSequence(wrapper, 10, 10, 40, 40, 60, 60);

        assert.ok(!wrapper.classList.contains('dragging'), 'Locked wrapper must not enter dragging state');
        assert.strictEqual(wrapper.style.left, '', 'Locked wrapper must not be moved');
        assert.strictEqual(wrapper.style.top, '', 'Locked wrapper must not be moved');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0);
    });

    it('should drag an unlocked layer (commits, moves, cleans up)', () => {
        const wrapper = makeWrapper('unlocked-wrapper');
        dnd.initDragAndDrop();

        // rect is 0,0 in jsdom -> grab offset = pointerdown coords (10,10).
        // Last move at (40,40): x = 40 - 0 - 10 = 30 -> grid snap 32.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerdown', wrapper, 10, 10)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 30, 30)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 40, 40)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerup', wrapper, 40, 40)
        );

        assert.strictEqual(wrapper.style.left, '32px', 'Unlocked wrapper moves on drop');
        assert.strictEqual(wrapper.style.top, '32px');
        assert.ok(!wrapper.classList.contains('dragging'), 'dragging class cleared on release');
        assert.strictEqual(wrapper.style.opacity, '1', 'Source opacity restored');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0);
    });
});
