const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

/**
 * Phase 1 (sheet_autoscroll_20260909, AC-S1): the fixed editor overlay's
 * sections layer must become the sheet's INTERNAL vertical scrollport on
 * screen only, while the shapes layer keeps its current non-scrolling
 * styling and print output never inherits the scroll container.
 *
 * These tests are authored RED against current behaviour (js/print_styles.js
 * enforces `.pe-layer { overflow: visible !important }` and has no
 * screen/print scroll rules for #print-enhance-sections-layer).
 */
describe('Sheet auto-scroll - Phase 1 CSS contract (AC-S1)', function () {
    this.timeout(5000);
    let window;
    let document;

    function boot() {
        const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
            url: 'https://www.dndbeyond.com/characters/12345',
            runScripts: 'dangerously',
            resources: 'usable'
        });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;

        // chrome stub needed by enforceFullHeight()'s template literals.
        window.chrome = {
            runtime: { getURL: (p) => `chrome-extension://mock/${p}` }
        };
        window.DomManager = {
            getInstance: () => ({})
        };

        const printStyles = fs.readFileSync(
            path.join(__dirname, '../../js/print_styles.js'),
            'utf8'
        );
        const script = document.createElement('script');
        script.textContent = printStyles;
        document.head.appendChild(script);
        // print_styles.js exposes window.PrintStyles (module.exports branch is
        // not taken inside the jsdom <script>).
        window.PrintStyles.enforceFullHeight();
    }

    function teardown() {
        delete global.window;
        delete global.document;
    }

    function injectedCss() {
        const style = document.getElementById('ddb-print-enhance-style');
        assert.ok(style, '#ddb-print-enhance-style injected by enforceFullHeight()');
        return style.textContent;
    }

    beforeEach(boot);
    afterEach(teardown);

    it('gives #print-enhance-sections-layer a vertical scrollport on screen', () => {
        const css = injectedCss();
        // The scrollport rule must exist AND sit under @media screen (the
        // nearest preceding media keyword is screen, not print), so the
        // scroll container never applies to print or other media.
        const m = /#print-enhance-sections-layer\s*\{[^}]*?overflow-y\s*:\s*auto\s*!important/i.exec(css);
        assert.ok(m, 'expected a rule setting #print-enhance-sections-layer overflow-y: auto !important in:\n' + css.slice(0, 400));
        const nearestMedia = css.lastIndexOf('@media', m.index);
        assert.ok(nearestMedia !== -1, 'rule must sit inside a media block');
        assert.strictEqual(
            css.slice(nearestMedia).startsWith('@media screen'),
            true,
            'the sections-layer scrollport must be declared under @media screen (screen-only)'
        );
    });

    it('does not turn #print-enhance-shapes-layer into a scrollport', () => {
        const css = injectedCss();
        // Any sections-layer scrollport rule must be scoped by its own id and
        // must not also (or instead) apply overflow to the shapes layer.
        const shapesWithAutoOverflow =
            /#print-enhance-shapes-layer\s*\{[^}]*overflow(-y)?\s*:\s*auto\s*!important/i
                .exec(css);
        assert.ok(
            !shapesWithAutoOverflow,
            '#print-enhance-shapes-layer must not get overflow-y: auto (shapes stay non-scrolled):\n' +
            (shapesWithAutoOverflow ? shapesWithAutoOverflow[0] : css.slice(0, 400))
        );
    });

    it('resets the sections-layer scrollport to overflow: visible under @media print', () => {
        const css = injectedCss();
        // The print reset must exist and sit inside a @media print block, so
        // printed output behaves as before the fix (no scroll container).
        const m = /#print-enhance-sections-layer\s*\{[^}]*?overflow\s*:\s*visible\s*!important/i.exec(css);
        assert.ok(m, 'expected #print-enhance-sections-layer { overflow: visible !important } in the print CSS:\n' + css.slice(-600));
        const nearestMedia = css.lastIndexOf('@media', m.index);
        assert.ok(nearestMedia !== -1, 'print reset must sit inside a media block');
        assert.strictEqual(
            css.slice(nearestMedia).startsWith('@media print'),
            true,
            'the overflow reset must be declared under @media print'
        );
    });
});
