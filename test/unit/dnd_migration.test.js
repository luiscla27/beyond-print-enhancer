const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

/**
 * Pointer-engine unit tests (track drag_ux_overhaul_20260909, Phase 1).
 * Replaces the native-HTML5 `dragstart` migration tests: the wrapper is no
 * longer a native drag source; a pointerdown + >=4px move commits a drag with
 * a custom ghost (AC-1/AC-2), interactive content never arms a drag, and a
 * release applies the drop and cleans up the ghost.
 */
describe('DnD Pointer Engine - Wrapper Level Dragging', () => {
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
        // Deterministic scale read (no transform).
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

    function makeWrapper(id, withActions = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = id;
        if (withActions) {
            const actions = document.createElement('div');
            actions.className = 'be-section-actions';
            const button = document.createElement('button');
            button.className = 'be-delete-button';
            actions.appendChild(button);
            wrapper.appendChild(actions);
        }
        wrapper.getBoundingClientRect = () => ({ left: 10, top: 10, width: 100, height: 100, right: 110, bottom: 110 });
        document.getElementById('layout-root').appendChild(wrapper);
        return wrapper;
    }

    it('should commit a pointer drag on the wrapper background after the movement threshold', () => {
        const wrapper = makeWrapper('test-wrapper');
        dnd.initDragAndDrop();

        // pointerdown on the wrapper background arms tracking.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerdown', wrapper, 15, 15)
        );
        // Below threshold: nothing yet.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 16, 16)
        );
        assert.ok(!wrapper.classList.contains('dragging'), 'No drag below the threshold');

        // Cross the 4px threshold -> commit: dimmed source + custom ghost.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 30, 30)
        );
        assert.ok(wrapper.classList.contains('dragging'), 'Wrapper should have dragging class');
        assert.strictEqual(wrapper.style.opacity, '0.4');
        assert.strictEqual(
            document.querySelectorAll('.be-drag-ghost').length,
            1,
            'A custom ghost should be present while dragging'
        );

        // Release: ghost removed, source restored.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerup', wrapper, 40, 40)
        );
        assert.strictEqual(
            document.querySelectorAll('.be-drag-ghost').length,
            0,
            'Ghost removed on release'
        );
        assert.strictEqual(wrapper.style.opacity, '1');
        assert.ok(!wrapper.classList.contains('dragging'));
    });

    it('should NOT commit a drag below the movement threshold (click/selection intact)', () => {
        const wrapper = makeWrapper('test-wrapper-subthreshold');
        dnd.initDragAndDrop();

        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerdown', wrapper, 15, 15)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 16, 17)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerup', wrapper, 16, 17)
        );

        assert.ok(!wrapper.classList.contains('dragging'), 'No drag class below threshold');
        assert.strictEqual(wrapper.style.opacity, '', 'Source opacity untouched');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0);
    });

    it('should NOT initiate a drag when pressing an action-bar button (interactive content)', () => {
        const wrapper = makeWrapper('test-wrapper-actions', true);
        const button = wrapper.querySelector('.be-delete-button');
        dnd.initDragAndDrop();

        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerdown', button, 15, 15)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', button, 200, 200)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerup', button, 200, 200)
        );

        assert.ok(!wrapper.classList.contains('dragging'), 'Drag must not start on action buttons');
        assert.strictEqual(wrapper.style.left, '', 'Wrapper must not move');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0);
    });

    it('should move the wrapper to grid-snapped coordinates on release', () => {
        const wrapper = makeWrapper('test-wrapper-drop');
        dnd.initDragAndDrop();

        // pointerdown at (15,15); rect left/top = 10 -> grab offset 5,5.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerdown', wrapper, 15, 15)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 60, 60)
        );
        // Release at (205,205): the last move determines the snapped slot
        // (zero-jump contract) — x = 205 - 0(container) - 5 = 200 -> 208.
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointermove', wrapper, 205, 205)
        );
        document.getElementById('layout-root').dispatchEvent(
            createPointerEvent('pointerup', wrapper, 205, 205)
        );

        assert.strictEqual(wrapper.style.left, '208px');
        assert.strictEqual(wrapper.style.top, '208px');
    });
});
