const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

/**
 * Phase 4 unit tests (drag_ux_overhaul_20260909, AC-9): precision path —
 * arrow-key nudge (1px, Shift=16px), origin clamp, active-wrapper gating,
 * locked/no-selection inertness, and the layout-moved notification.
 */
describe('DnD Phase 4 - Precision Nudge', () => {
    let dom;
    let window;
    let document;

    function boot() {
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

        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({
                    element: document.getElementById('layout-root')
                }),
                getLayerManager: () => ({
                    getLayerForElement: (id) =>
                        id === 'locked-wrapper' ? { isLocked: true } : { isLocked: false }
                })
            })
        };
        window.getComputedStyle = () => ({ transform: 'none' });

        const dndCode = fs.readFileSync(path.join(__dirname, '../../js/dnd.js'), 'utf8');
        const script = document.createElement('script');
        script.textContent = dndCode;
        document.head.appendChild(script);
        window.initDragAndDrop();
    }

    function teardown() {
        delete global.window;
        delete global.document;
        delete global.Image;
        delete global.Node;
    }

    function wrapper(id, left, top, active = true) {
        const w = document.createElement('div');
        w.className = 'be-section-wrapper';
        w.id = id;
        w.style.left = left + 'px';
        w.style.top = top + 'px';
        if (active) w.classList.add('be-active-wrapper');
        document.getElementById('layout-root').appendChild(w);
        return w;
    }

    function key(key, shift = false) {
        const e = new window.KeyboardEvent('keydown', {
            key,
            shiftKey: shift,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(e);
        return e;
    }

    beforeEach(() => {
        boot();
    });
    afterEach(() => {
        teardown();
    });

    it('nudges the active wrapper 1px with arrow keys', () => {
        const w = wrapper('n1', 100, 200);
        key('ArrowRight');
        key('ArrowDown');
        assert.strictEqual(w.style.left, '101px');
        assert.strictEqual(w.style.top, '201px');
    });

    it('nudges one full grid step (16px) with Shift', () => {
        const w = wrapper('n2', 100, 200);
        key('ArrowRight', true);
        key('ArrowUp', true);
        assert.strictEqual(w.style.left, '116px');
        assert.strictEqual(w.style.top, '184px');
    });

    it('clamps nudge at the sheet origin (never negative)', () => {
        const w = wrapper('n3', 3, 4);
        key('ArrowLeft');
        key('ArrowUp');
        assert.strictEqual(w.style.left, '2px');
        assert.strictEqual(w.style.top, '3px');
        key('ArrowLeft');
        key('ArrowUp');
        key('ArrowLeft');
        key('ArrowUp');
        key('ArrowLeft');
        key('ArrowUp');
        assert.strictEqual(w.style.left, '0px');
        assert.strictEqual(w.style.top, '0px');
    });

    it('does nothing without an active wrapper or on a locked wrapper', () => {
        wrapper('inert', 50, 50, false); // no active selection
        key('ArrowRight');
        const inert = document.getElementById('inert');
        assert.strictEqual(inert.style.left, '50px', 'no active wrapper -> no nudge');

        const locked = wrapper('locked-wrapper', 60, 60, true);
        key('ArrowRight');
        assert.strictEqual(locked.style.left, '60px', 'locked wrapper never nudges');
    });

    it('ignores arrow keys while typing in an input', () => {
        const w = wrapper('n4', 90, 90);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        const e = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
        input.dispatchEvent(e);
        assert.strictEqual(w.style.left, '90px', 'no nudge while typing');
    });

    it('fires a be-layout-moved notification after a nudge', () => {
        wrapper('n5', 10, 10);
        let events = 0;
        window.addEventListener('be-layout-moved', () => events++);
        key('ArrowRight');
        assert.strictEqual(events, 1);
    });
});
