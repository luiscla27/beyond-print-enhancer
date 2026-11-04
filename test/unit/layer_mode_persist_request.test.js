/**
 * BEYOND-9 AC-3 — a layer-panel edit must request the product's own persist.
 *
 * The e2e case (`layer_print_visibility.spec.js`, "AC-3: the mode a user picks survives a RELOAD
 * with no Save click") is the user-visible proof. This is the CONTRACT half: which writer asks for
 * the write, and that the ask is fail-open where the seam does not exist.
 *
 * WHY A UNIT CASE, given the e2e already covers it: the e2e takes ~30s of browser boot per case and
 * needs the network. The regression this pins is one deleted line in a writer, and that can be
 * caught in milliseconds — the e2e would catch it too, but only if it happens to run.
 *
 * Track `beyond09_layer_three_state` (2026-11-01).
 */
const assert = require('assert');
const { JSDOM } = require('jsdom');

const LAYER_MANAGER_PATH = '../../js/dom/layer_manager.js';

describe('LayerManager — layer-flag edits request the product persist (BEYOND-9 AC-3)', function () {
    let dom, window, document, LayerManager;

    beforeEach(function () {
        dom = new JSDOM(
            '<!DOCTYPE html><html><body>' +
            '<div id="print-enhance-shapes-layer"></div>' +
            '<div id="print-enhance-sections-layer"></div>' +
            '</body></html>'
        );
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.HTMLElement = window.HTMLElement;
        global.NodeList = window.NodeList;

        window.DomManager = {
            getInstance: () => ({
                getLayoutRoot: () => ({ element: document.body }),
                getShapesContainer: () => ({ element: document.body }),
            }),
        };

        LayerManager = require(LAYER_MANAGER_PATH);
    });

    afterEach(function () {
        delete global.document;
        delete global.window;
        delete global.HTMLElement;
        delete global.NodeList;
        delete require.cache[require.resolve(LAYER_MANAGER_PATH)];
    });

    /** Arm the seam the panel asks for, and count the asks. */
    const armPersistSeam = () => {
        const calls = [];
        window.scheduleAutosave = () => calls.push(calls.length + 1);
        return calls;
    };

    it('each of the three modes asks for one persist, and writes the flags that mode means', function () {
        const lm = new LayerManager();
        lm.createPanel();
        const calls = armPersistSeam();
        const layer = lm.sectionsLayer;

        const expected = {
            // mode -> [isHidden, isDisabledOnPrint]
            print: [true, false],
            both: [false, false],
            screen: [false, true],
        };

        for (const mode of ['print', 'screen', 'both']) {
            const before = calls.length;
            const got = lm.setLayerMode(layer, mode);
            assert.strictEqual(got, mode, `setLayerMode accepted "${mode}"`);
            assert.strictEqual(
                calls.length,
                before + 1,
                `choosing "${mode}" asked for exactly one persist ` +
                    `(asked ${calls.length - before}) — this is AC-3's product half`,
            );
            assert.deepStrictEqual(
                [layer.isHidden, layer.isDisabledOnPrint],
                expected[mode],
                `"${mode}" is the flag pair [isHidden, isDisabledOnPrint]`,
            );
        }
    });

    it('the three legacy row toggles ask too — the mode strip is not a special case', function () {
        const lm = new LayerManager();
        lm.createPanel();
        const calls = armPersistSeam();
        const layer = lm.shapeLayers[0];
        const row = lm.panel.querySelector(`[data-layer-id="${layer.id}"]`);
        const printBtn = row.querySelector('button[title="Skip when printing"]');
        const lockBtn = row.querySelector('button[title="Toggle Edit Mode"]');

        lm.toggleLayerPrint(layer, printBtn);
        assert.strictEqual(calls.length, 1, 'the print toggle asked for a persist');

        lm.toggleLayerVisibility(layer);
        assert.strictEqual(calls.length, 2, 'the hide toggle asked for a persist');

        lm.toggleLayerLock(layer, lockBtn);
        assert.strictEqual(calls.length, 3, 'the lock toggle asked for a persist');
    });

    it('a mode change does not throw when the persist seam is absent (bare unit boot)', function () {
        const lm = new LayerManager();
        lm.createPanel();
        // The unit harnesses boot `js/dom/layer_manager.js` WITHOUT `js/dnd.js`, which is where
        // `scheduleAutosave` lives. The ask must therefore be fail-open, not a hard dependency.
        assert.strictEqual(
            typeof window.scheduleAutosave,
            'undefined',
            'precondition: no persist seam in this harness',
        );
        assert.doesNotThrow(() => lm.setLayerMode(lm.sectionsLayer, 'print'));
        assert.strictEqual(lm.sectionsLayer.isHidden, true, 'the flag still moved');
    });

    it('a mode change carries the undo record it always carried (the persist ask did not replace it)', function () {
        const lm = new LayerManager();
        lm.createPanel();
        armPersistSeam();
        const pushed = [];
        window.MUTATION_CLASSES = { LAYER_FLAG: 'layer-flag' };
        window.beginMutation = (snap) => ({ snap, settled: { layers: {} } });
        window.pushMutation = (mut, label, klass) => pushed.push({ label, klass });

        lm.setLayerMode(lm.sectionsLayer, 'screen');

        assert.strictEqual(pushed.length, 1, 'one undo record per mode change');
        assert.strictEqual(pushed[0].klass, 'layer-flag', 'recorded in the LAYER_FLAG class');
        assert.ok(
            /Screen only/.test(pushed[0].label),
            `the label names the mode ("${pushed[0].label}")`,
        );
    });
});
