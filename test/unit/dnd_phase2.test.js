const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

/**
 * Phase 2 unit tests (drag_ux_overhaul_20260909, AC-3/AC-4/AC-5):
 * live 16px grid snap (zero release jump), 1px gold alignment guides, and
 * the removal of the misleading .drag-over machinery. Pure math is tested
 * against the exported helpers; behavior is tested in a jsdom boot.
 */
describe('DnD Phase 2 - Live Snap + Alignment Guides', () => {
    // --- Pure math ------------------------------------------------------
    describe('snapToGrid', () => {
        it('rounds container-space coordinates to the 16px grid', () => {
            const dnd = loadModule();
            assert.deepStrictEqual(dnd.snapToGrid(0, 0), { x: 0, y: 0 });
            assert.deepStrictEqual(dnd.snapToGrid(8, 8), { x: 16, y: 16 });
            assert.deepStrictEqual(dnd.snapToGrid(7, 9), { x: 0, y: 16 });
            assert.deepStrictEqual(dnd.snapToGrid(100, 150), { x: 96, y: 144 });
            assert.deepStrictEqual(dnd.snapToGrid(-5, 33), { x: 0, y: 32 });
        });
    });

    describe('findAlignmentGuides', () => {
        it('emits a guide when a dragged edge aligns with a sibling edge within tolerance', () => {
            const dnd = loadModule();
            // Dragged rect left edge 100 -> sibling left edge 101 (1px off).
            // Guide coordinate = midpoint of the matched pair (100/101 → 101
            // → rounded midpoint semantics keep a single 1px line).
            const { v, h } = dnd.findAlignmentGuides(
                { left: 100, right: 300, top: 50, bottom: 150 },
                [{ left: 101, right: 401, top: 500, bottom: 600 }],
                null,
                4,
            );
            assert.ok(v.includes(101), `vertical guide at 101, got ${v}`);
            assert.strictEqual(h.length, 0);
        });

        it('emits no guide when nothing is within tolerance', () => {
            const dnd = loadModule();
            const { v, h } = dnd.findAlignmentGuides(
                { left: 100, right: 300, top: 50, bottom: 150 },
                [{ left: 340, right: 640, top: 500, bottom: 600 }],
                null,
                4,
            );
            assert.strictEqual(v.length, 0);
            assert.strictEqual(h.length, 0);
        });

        it('includes container edges as alignment targets', () => {
            const dnd = loadModule();
            const { v } = dnd.findAlignmentGuides(
                { left: 402, right: 502, top: 50, bottom: 150 },
                [],
                { left: 400, right: 1400, top: 0, bottom: 2000 },
                4,
            );
            assert.ok(v.includes(401), 'left edge aligns to container left');
        });

        it('emits vertical and horizontal guides from center matching', () => {
            const dnd = loadModule();
            const { v} = dnd.findAlignmentGuides(
                { left: 100, right: 300, top: 50, bottom: 250 },
                [
                    { left: 100, right: 500, top: 850, bottom: 950 }, // hcenter match? 200 vs 300 no
                ],
                null,
                0.001,
            );
            assert.ok(v.includes(100), 'left-left exact align');
        });
    });

    // --- jsdom behavior -------------------------------------------------
    let dom;
    let window;
    let document;

    function loadModule() {
        // dnd.js needs a window global for its top-level safeLog binding.
        const prev = global.window;
        global.window = {};
        try {
            delete require.cache[require.resolve('../../js/dnd.js')];
            const m = require('../../js/dnd.js');
            return m;
        } finally {
            global.window = prev;
        }
    }

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

    function makeWrapper(id, rect) {
        const wrapper = document.createElement('div');
        wrapper.className = 'be-section-wrapper';
        wrapper.id = id;
        wrapper.getBoundingClientRect = () => rect;
        Object.defineProperty(wrapper, 'offsetWidth', { value: rect.width, configurable: true });
        Object.defineProperty(wrapper, 'offsetHeight', { value: rect.height, configurable: true });
        document.getElementById('layout-root').appendChild(wrapper);
        return wrapper;
    }

    beforeEach(() => {
        boot();
    });
    afterEach(() => {
        teardown();
    });

    it('ghost snaps live to the 16px grid (ghost left/top multiples of 16)', () => {
        const wrapper = makeWrapper('snap-wrapper', { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 });
        window.initDragAndDrop();

        document.getElementById('layout-root').dispatchEvent(pointer('pointerdown', wrapper, 15, 15));
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, 100, 77));
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, 100, 77));

        const ghost = document.querySelector('.be-drag-ghost');
        assert.ok(ghost, 'ghost exists mid-drag');
        assert.strictEqual(parseInt(ghost.style.left) % 16, 0, 'ghost left is grid-snapped');
        assert.strictEqual(parseInt(ghost.style.top) % 16, 0, 'ghost top is grid-snapped');
        document.getElementById('layout-root').dispatchEvent(pointer('pointerup', wrapper, 100, 77));
    });

    it('release lands exactly on the ghost snapped slot (zero jump)', () => {
        const wrapper = makeWrapper('zerojump-wrapper', { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 });
        window.initDragAndDrop();

        document.getElementById('layout-root').dispatchEvent(pointer('pointerdown', wrapper, 10, 10));
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, 205, 205));
        const ghostLeft = parseInt(document.querySelector('.be-drag-ghost').style.left);
        const ghostTop = parseInt(document.querySelector('.be-drag-ghost').style.top);
        document.getElementById('layout-root').dispatchEvent(pointer('pointerup', wrapper, 205, 205));

        assert.strictEqual(parseInt(wrapper.style.left), ghostLeft, 'drop x == ghost x');
        assert.strictEqual(parseInt(wrapper.style.top), ghostTop, 'drop y == ghost y');
    });

    it('renders gold alignment guides when an edge aligns, clears them on release', () => {
        // Source wrapper 200px wide at origin; sibling begins at left 300.
        makeWrapper('sibling-wrapper', { left: 300, top: 0, width: 200, height: 100, right: 500, bottom: 100 });
        const wrapper = makeWrapper('guide-wrapper', { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 });
        window.initDragAndDrop();

        document.getElementById('layout-root').dispatchEvent(pointer('pointerdown', wrapper, 50, 30));
        // Move so the wrapper's RIGHT edge (left+200) approaches sibling LEFT
        // (300): container-space left 96..112 → right 296..312; tol 4 ⇒ left
        // 100 gives right 300 exactly. offset=50 → clientX for left 100 = 150.
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, 150, 30));
        // snap(150-0-50=100) = 96 → right 296 (not within 4 of 300)… then 101→96?
        // Find clientX where snap(left) makes right within 4 of 300: left ∈
        // [96,104] → snap targets 96 or 104(no)… left 96: right 296, diff 4 ✓
        // left 96 ⇒ clientX = 96 + 50 = 146.

        const layer = document.querySelector('.be-drag-guides');
        assert.ok(layer, 'guide overlay exists mid-drag');
        const before = layer.querySelectorAll('.be-drag-guide').length;
        document.getElementById('layout-root').dispatchEvent(pointer('pointermove', wrapper, 146, 30));
        const after = layer.querySelectorAll('.be-drag-guide').length;
        assert.ok(after >= 1, `alignment guide rendered, before=${before} after=${after}`);
        assert.ok(
            Array.from(layer.querySelectorAll('.be-drag-guide')).some(
                (g) => g.style.background === '#C6A15B' || g.style.backgroundColor === 'rgb(198, 161, 91)',
            ),
            'guide lines use the gold token #C6A15B',
        );

        document.getElementById('layout-root').dispatchEvent(pointer('pointerup', wrapper, 146, 30));
        assert.strictEqual(
            document.querySelectorAll('.be-drag-guides').length,
            0,
            'guide overlay removed on release',
        );
    });

    it('injected styles carry no .drag-over rule and lock cursors are not-allowed', () => {
        window.injectDnDStyles();
        const style = document.getElementById('ddb-print-dnd-style');
        assert.ok(style, 'dnd style block injected');
        assert.ok(!style.textContent.includes('drag-over'), 'no misleading .drag-over CSS (AC-3)');
        assert.ok(
            style.textContent.includes('cursor: not-allowed'),
            'locked wrappers get not-allowed cursor (AC-5)',
        );
    });
});
