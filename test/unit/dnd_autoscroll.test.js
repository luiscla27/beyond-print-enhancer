const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

/**
 * Phase 2 (sheet_autoscroll_20260909, AC-S2..AC-S5): the pointer drag engine
 * must (a) auto-scroll the sheet-internal scroll host (#print-enhance-
 * sections-layer, a .pe-layer) while a committed drag is held in the
 * bottom/top edge band, (b) stop on release/cancel, and (c) convert drop
 * coordinates to CONTENT space (client + scrollTop) while the ghost stays
 * locked to the pointer in CLIENT space.
 *
 * Authored RED against current js/dnd.js: Phase 3 deferred auto-scroll
 * (lines ~160-166) — no ticker, no scroll compensation in placeGhost, and
 * drops are purely client-space.
 */
describe('Sheet auto-scroll - Phase 2 drag engine (AC-S2..AC-S5)', function () {
    this.timeout(5000);
    let dom;
    let window;
    let document;
    let host;
    let layoutRoot;

    const STEP = 16; // AUTOSCROLL_STEP_PX
    const TICK_MS = 16; // AUTOSCROLL_INTERVAL_MS

    function boot() {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
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

        // Real product anatomy: #print-layout-wrapper contains the sections
        // layer (a .pe-layer, the future scroll host); wrappers live inside it.
        layoutRoot = document.createElement('div');
        layoutRoot.id = 'print-layout-wrapper';
        layoutRoot.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
        document.body.appendChild(layoutRoot);

        host = document.createElement('div');
        host.id = 'print-enhance-sections-layer';
        host.className = 'pe-layer';
        Object.defineProperty(host, 'clientHeight', { value: 600, configurable: true });
        Object.defineProperty(host, 'scrollHeight', { value: 2400, configurable: true });
        host.scrollTop = 0;
        host.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
        layoutRoot.appendChild(host);

        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: layoutRoot }),
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

    function makeWrapper(id) {
        const w = document.createElement('div');
        w.className = 'be-section-wrapper';
        w.id = id;
        // Wrapper sits at content y=300 (top), 60px tall.
        w.getBoundingClientRect = () => ({ left: 0, top: 300, right: 100, bottom: 360, width: 100, height: 60 });
        Object.defineProperty(w, 'offsetWidth', { value: 100, configurable: true });
        Object.defineProperty(w, 'offsetHeight', { value: 60, configurable: true });
        host.appendChild(w);
        return w;
    }

    function pointer(type, target, x, y) {
        const ev = new window.MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
        });
        Object.defineProperty(ev, 'target', { value: target, enumerable: true });
        Object.defineProperty(ev, 'pointerId', { value: 1, enumerable: true });
        return ev;
    }

    // Committed drag of `wrapper`: grab at (gx, gy), move (commit + position)
    // to (mx, my). Returns once the move events were dispatched.
    function committedDrag(wrapper, gx, gy, mx, my) {
        layoutRoot.dispatchEvent(pointer('pointerdown', wrapper, gx, gy));
        document.dispatchEvent(pointer('pointermove', wrapper, mx + 20, my + 10));
        document.dispatchEvent(pointer('pointermove', wrapper, mx, my));
        return wrapper;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    beforeEach(boot);
    afterEach(() => {
        // Safety: if a drag is somehow still live (failed assertion), cancel
        // it so no auto-scroll interval survives into the next test.
        if (document.querySelector('.be-drag-ghost')) {
            document.dispatchEvent(pointer('pointercancel', document.body, -100, -100));
        }
        teardown();
    });

    // --- AC-S2: pure auto-scroll tick -------------------------------------

    it('AC-S2 pure tick: bottom band scrolls down by one step, clamped at max', () => {
        const tick = window.autoscrollTick;
        assert.strictEqual(typeof tick, 'function', 'autoscrollTick exported on window');
        // Pointer inside the bottom band (bottom 600 - edge 48 = 552).
        assert.strictEqual(tick(host, 590), STEP, 'one +STEP in the bottom band');
        assert.strictEqual(host.scrollTop, STEP);
        // Accumulates.
        assert.strictEqual(tick(host, 599), STEP);
        assert.strictEqual(host.scrollTop, 2 * STEP);
        // Clamped at scrollHeight - clientHeight = 1800.
        host.scrollTop = 1796;
        assert.strictEqual(tick(host, 599), 4, 'only the remaining 4px are applied at the max');
        assert.strictEqual(host.scrollTop, 1800);
        assert.strictEqual(tick(host, 599), 0, 'no movement past the max');
    });

    it('AC-S2 pure tick: top band scrolls up by one step, floored at 0', () => {
        const tick = window.autoscrollTick;
        host.scrollTop = 200;
        assert.strictEqual(tick(host, 5), -STEP, 'one -STEP in the top band');
        assert.strictEqual(host.scrollTop, 200 - STEP);
        host.scrollTop = 10;
        assert.strictEqual(tick(host, 0), -10, 'floored at 0 (only 10px remain)');
        assert.strictEqual(host.scrollTop, 0);
        assert.strictEqual(tick(host, 0), 0, 'no movement below 0');
    });

    it('AC-S2 pure tick: middle of the viewport never scrolls', () => {
        const tick = window.autoscrollTick;
        host.scrollTop = 0;
        assert.strictEqual(tick(host, 300), 0);
        assert.strictEqual(tick(host, 500), 0, '500 is outside the 48px bottom band (552)');
        assert.strictEqual(host.scrollTop, 0);
    });

    // --- AC-S3: drag wiring (real ticker) ----------------------------------

    it('AC-S3: holding a committed drag in the bottom band auto-scrolls the host, then stops on release', async () => {
        const w = makeWrapper('autoscroll-wrapper');
        committedDrag(w, 200, 320, 200, 570);
        assert.strictEqual(host.scrollTop, 0, 'no scroll before any tick elapses');
        await sleep(5 * TICK_MS); // let the 16ms ticker run while held
        assert.ok(
            host.scrollTop > 0,
            'host.scrollTop grew while the drag was held in the bottom band (got ' + host.scrollTop + ')'
        );
        const scrolled = host.scrollTop;
        document.dispatchEvent(pointer('pointerup', w, 200, 570));
        await sleep(3 * TICK_MS);
        assert.strictEqual(host.scrollTop, scrolled, 'no further scroll after pointerup (ticker stopped)');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0, 'drag cleaned up');
    });

    it('AC-S5: pointercancel stops the ticker (abort path)', async () => {
        const w = makeWrapper('cancel-scroll-wrapper');
        committedDrag(w, 200, 320, 200, 570);
        await sleep(4 * TICK_MS);
        assert.ok(host.scrollTop > 0, 'ticker ran before the cancel');
        const scrolled = host.scrollTop;
        document.dispatchEvent(pointer('pointercancel', w, 200, 570));
        await sleep(3 * TICK_MS);
        assert.strictEqual(host.scrollTop, scrolled, 'no scroll after pointercancel');
        assert.strictEqual(document.querySelectorAll('.be-drag-ghost').length, 0);
    });

    it('AC-S3: dragging in the middle of the viewport never auto-scrolls', async () => {
        const w = makeWrapper('noedge-wrapper');
        committedDrag(w, 200, 320, 300, 400);
        await sleep(4 * TICK_MS);
        assert.strictEqual(host.scrollTop, 0, 'middle-of-viewport drag must not scroll');
        document.dispatchEvent(pointer('pointerup', w, 300, 400));
    });

    // --- AC-S4: scroll-aware drop ------------------------------------------

    it('AC-S4: drop on a pre-scrolled host stores CONTENT-space coords while the ghost stays at the pointer', () => {
        const w = makeWrapper('content-space-wrapper');
        // Grab inside the wrapper: (16, 316) → offsets (16, 20) (wrapper is at
        // content top 300, left 0, 100x60). Drop pointer at (208, 560).
        host.scrollTop = 512; // sheet already scrolled 512px of content
        committedDrag(w, 16, 316, 208, 560);
        const ghost = document.querySelector('.be-drag-ghost');
        assert.ok(ghost, 'ghost exists during the committed drag');
        // While the drag is live only the ghost is placed, in CLIENT space:
        // raw client y under the pointer = 560 - 0 (container top) - 20
        // (offset) = 540 → snapped 544 at scroll 0. With the host at
        // scrollTop 512 the content-space snap is 544 + 512 = 1056, and the
        // ghost renders at content − scroll = 1056 − 512 = 544 client.
        const ghostTop = parseInt(ghost.style.top, 10);
        const ghostLeft = parseInt(ghost.style.left, 10);
        assert.strictEqual(ghostTop, 544, 'ghost stays in client space under the pointer (got ' + ghostTop + ')');
        assert.strictEqual(ghostLeft, 192, 'ghost x stays in client space (208 - 16 = 192, snapped)');
        // Release: the drop must persist CONTENT-space coordinates (raw
        // client 540 + 512 scroll → 1052 → 1056 on-grid), NOT the client
        // value 544 — otherwise the section would jump up by the scroll
        // amount on the next scroll reset.
        document.dispatchEvent(pointer('pointerup', w, 208, 560));
        assert.strictEqual(w.style.top, '1056px', 'drop stores content-space top (client + scrollTop, snapped)');
        assert.strictEqual(w.style.left, '192px', 'drop stores content-space left (unchanged axis: 208 - 16 = 192)');
    });

    it('AC-S4: with scrollTop = 0 placement is unchanged (no regression at the origin)', () => {
        const w = makeWrapper('zero-scroll-wrapper');
        committedDrag(w, 16, 316, 208, 560);
        const ghost = document.querySelector('.be-drag-ghost');
        assert.strictEqual(parseInt(ghost.style.top, 10), 544);
        assert.strictEqual(parseInt(ghost.style.left, 10), 192);
        // No scroll: raw y 540 snaps to 544, x 192 — identical to pre-fix
        // behaviour (client space == content space at the origin).
        document.dispatchEvent(pointer('pointerup', w, 208, 560));
        assert.strictEqual(w.style.top, '544px');
        assert.strictEqual(w.style.left, '192px');
    });
});
