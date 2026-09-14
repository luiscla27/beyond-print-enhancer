const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

/**
 * Phase 3 unit tests (drag_ux_overhaul_20260909, AC-6/AC-7/AC-8):
 * always-completing clamped drops (never off-sheet negative), no margin
 * mutation on drop, pointercancel aborts without moving, and debounced
 * auto-persist through the existing save seam with a 'Layout saved' toast.
 */
describe('DnD Phase 3 - Bounds, Cancel & Autosave', function () {
    this.timeout(5000);
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
                    getLayerForElement: () => ({ isLocked: false })
                })
            })
        };
        window.getComputedStyle = () => ({ transform: 'none' });
        // No save seam by default → autosave must silently skip.
        delete window.scanLayout;
        delete window.__DDBStorage;

        const code = fs.readFileSync(path.join(__dirname, '../../js/dnd.js'), 'utf8');
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
    }

    function teardown() {
        delete global.window;
        delete global.document;
        delete global.Image;
        delete global.Node;
    }

    function pointer(type, target, x, y) {
        const ev = new window.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        Object.defineProperty(ev, 'target', { value: target, enumerable: true });
        return ev;
    }

    function makeWrapper(id) {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = id;
        wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 60, right: 100, bottom: 60 });
        Object.defineProperty(wrapper, 'offsetWidth', { value: 100, configurable: true });
        Object.defineProperty(wrapper, 'offsetHeight', { value: 60, configurable: true });
        document.getElementById('layout-root').appendChild(wrapper);
        return wrapper;
    }

    function drag(wrapper, fromX, fromY, toX, toY, cancel = false) {
        document.getElementById('layout-root').dispatchEvent(pointer('pointerdown', wrapper, fromX, fromY));
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, toX + 20, toY + 10));
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, toX, toY));
        document.getElementById('layout-root').dispatchEvent(
            pointer(cancel ? 'pointercancel' : 'pointerup', wrapper, toX, toY)
        );
    }

    beforeEach(() => {
        boot();
    });
    afterEach(() => {
        teardown();
    });

    it('clamps a drop above/left of the sheet origin to 0 (never negative)', () => {
        const wrapper = makeWrapper('clamp-wrapper');
        window.initDragAndDrop();
        // Pointerdown at (10,10) grabs with offset (10,10); a move to -80,-40
        // would compute negative container coords — must clamp to 0 and snap.
        drag(wrapper, 10, 10, -200, -120);
        assert.strictEqual(wrapper.style.left, '0px', 'left clamped to the sheet origin');
        assert.strictEqual(wrapper.style.top, '0px', 'top clamped to the sheet origin');
    });

    it('drop no longer mutates the wrapper margin', () => {
        const wrapper = makeWrapper('margin-wrapper');
        wrapper.style.margin = '5px 12px'; // pre-existing value must survive
        window.initDragAndDrop();
        drag(wrapper, 10, 10, 300, 200);
        assert.strictEqual(wrapper.style.margin, '5px 12px', 'margin untouched by the drop (AC-7)');
    });

    it('pointercancel aborts without moving the wrapper and cleans up', () => {
        const wrapper = makeWrapper('cancel-wrapper');
        window.initDragAndDrop();
        drag(wrapper, 10, 10, 300, 200, true);
        assert.strictEqual(wrapper.style.left, '', 'no move on pointercancel');
        assert.strictEqual(wrapper.style.top, '', 'no move on pointercancel');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0, 'ghost cleaned up');
        assert.ok(!wrapper.classList.contains('dragging'));
    });

    it('debounced autosave persists once through the save seam and toasts', async () => {
        const saved = [];
        const feedback = [];
        window.scanLayout = async () => ({ layout: 1 });
        window.__DDBStorage = {
            saveLayout: async (id, layout) => { saved.push(['char', id, layout]); },
            saveGlobalLayout: async (layout) => { saved.push(['global', layout]); }
        };
        window.getCharacterId = () => 'char-1';
        window.showFeedback = (m) => feedback.push(m);

        window.initDragAndDrop();
        const wrapper = makeWrapper('autosave-wrapper');
        // Two drops within the debounce window must collapse into one save.
        drag(wrapper, 10, 10, 120, 80);
        drag(wrapper, 10, 10, 140, 100);

        await new Promise((r) => setTimeout(r, 1400));
        assert.strictEqual(saved.length, 2, 'saveLayout(char) + saveGlobalLayout exactly once each after debounce');
        assert.deepStrictEqual(saved[0], ['char', 'char-1', { layout: 1 }]);
        assert.ok(feedback.includes('Layout saved'), 'toast shown after autosave');
    });
});
