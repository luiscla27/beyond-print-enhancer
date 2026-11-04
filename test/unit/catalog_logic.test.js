const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock chrome API
global.chrome = {
    runtime: {
        getURL: (path) => path
    }
};

// Mock fetch
const ARCHER_FETCH = async (url) => {
    // catalog_service.js uses chrome.runtime.getURL which we mocked to return the path as is
    if (url === 'catalog.json' || url.endsWith('/catalog.json')) {
        return {
            ok: true,
            json: async () => ({
                templates: [
                    { id: 'archer', name: 'Archer', path: 'assets/templates/archer_template.json', thumbnail: 'assets/thumbnails/archer.webp' }
                ]
            })
        };
    }
    if (url === 'assets/templates/archer_template.json' || url.endsWith('/archer_template.json')) {
        return {
            ok: true,
            json: async () => ({
                name: 'Archer',
                data: {
                    sections: {
                        'ability-scores': { borderStyle: 'archer_ability' }
                    },
                    shapes: [
                        { id: 'shape-archer-icon', assetPath: 'assets/shapes/archer_main.webp', left: '100px', top: '100px' }
                    ]
                }
            })
        };
    }
    if (url === 'malformed.json' || url.endsWith('/malformed.json')) {
        return { ok: true, json: async () => ({ name: 'Bad' }) };
    }
    if (url === 'empty.json' || url.endsWith('/empty.json')) {
        return { ok: true, json: async () => ({ name: 'Empty', data: {} }) };
    }
    return { ok: false };
};
global.fetch = ARCHER_FETCH;

/**
 * AC-9a PATH C — template import (track `byok_svg_borders_20260927`, operator option 2
 * 2026-10-03). A template's section config carries `borderSvg`, the SAME raw-SVG carrier
 * a layout record uses, and `applyTemplate` hands it to the choke point — so a template
 * is now a real route by which an SVG reaches the DOM, and this suite treats it as
 * hostile input surface: a payload that fails ANY AC-1 vector must paint NOTHING, and
 * the clean control must paint through the same `::before` slot.
 *
 * Reuses the catalog_logic.test.js fetch mocking so the REAL `CatalogService.applyTemplate`
 * is the flow under test — a hand-built record would prove nothing about the import half.
 */
describe("AC-9a path C — template import carries borderSvg through the choke point", function () {
    let CatalogService;
    let dom;

    const CLEAN_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" ' +
        'preserveAspectRatio="none"><rect width="100" height="40" fill="none" ' +
        'stroke="#C6A15B" stroke-width="2"/></svg>';
    const HOSTILE_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
        "<script>alert(1)</script></svg>";

    before(function () {
        const dom0 = new JSDOM("<!DOCTYPE html><html><body></body></html>");
        global.document = dom0.window.document;
        global.window = dom0.window;
        global.HTMLElement = dom0.window.HTMLElement;
        const code = fs.readFileSync(
            path.join(__dirname, "../../js/catalog_service.js"),
            "utf8",
        );
        const wrappedCode = code + "\nmodule.exports = { CatalogService };";
        const m = new module.constructor();
        m._compile(wrappedCode, "catalog_service.js");
        CatalogService = m.exports.CatalogService;
    });

    beforeEach(function () {
        dom = new JSDOM(
            '<!DOCTYPE html><html><body>' +
            '<div class="be-section-wrapper" id="wrapper-main">' +
            '<div class="print-section-container" id="section-main" ' +
            'style="width: 200px; height: 120px;"></div></div>' +
            "</body></html>",
            { url: "http://localhost", runScripts: "dangerously", pretendToBeVisual: true },
        );
        global.document = dom.window.document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;
        // The TRUST ROOT boots with the sheet: `js/ai_layout.js` (its `validateSvg`) is what
        // makes the choke point able to prove bytes are clean, and `js/ai_border.js` reads it
        // through `window.AiLayout` at call time. Measured (temp/scratch/pathc_probe.js):
        // without ai_layout.js the choke point fails CLOSED with reason "unavailable" — so a
        // path-C suite that skips it would pass for the WRONG reason (no paint at all).
        dom.window.eval(fs.readFileSync(path.join(__dirname, "../../js/ai_layout.js"), "utf8"));
        dom.window.eval(fs.readFileSync(path.join(__dirname, "../../js/ai_border.js"), "utf8"));
        global.clearBorderStyles = () => {};
        global.createShape = () => {};
        global.updateLayoutBounds = () => {};
        global.updatePrintStyles = () => {};
        global.window.confirm = () => true;
        global.confirm = () => true;
        global.window.safeLog = () => {};
        global.safeLog = () => {};
    });

    afterEach(function () {
        // Restore the FILE-LEVEL archer mock (the `global.fetch` defined at the top of
        // this file), not a snapshot taken in beforeEach — my suite and the legacy suite
        // share one process-global, so each suite must restore that shared baseline.
        global.fetch = ARCHER_FETCH;
    });

    /** Mock the runtime fetch so applyTemplate loads a template with ONE section whose
     *  config carries the given borderSvg value (or lacks the key entirely). */
    function withTemplate(borderSvg, hasKey = true) {
        const sections = {
            "section-main": { left: "10px", top: "20px", borderStyle: null },
        };
        if (hasKey) sections["section-main"].borderSvg = borderSvg;
        global.fetch = async (url) => {
            if (url === "catalog.json") {
                return {
                    ok: true,
                    json: async () => ({
                        templates: [{ id: "bordered", name: "Bordered", path: "bordered_template.json" }],
                    }),
                };
            }
            if (url === "bordered_template.json") {
                return {
                    ok: true,
                    json: async () => ({
                        name: "Bordered",
                        data: { sections, shapes: [] },
                    }),
                };
            }
            return { ok: false };
        };
    }

    it("a CLEAN borderSvg in a template paints through the choke point (positive control)", async function () {
        withTemplate(CLEAN_SVG);
        const ok = await CatalogService.applyTemplate("bordered");
        assert.strictEqual(ok, true, "applyTemplate refused a clean template");
        const section = document.getElementById("section-main");
        assert.ok(
            section.style.getPropertyValue("--border-img"),
            "the clean template border never painted",
        );
        assert.match(
            section.style.getPropertyValue("--border-img"),
            /^url\("data:image\/svg\+xml/,
            "the paint is not the choke point's data-URI composition",
        );
        // The dataset carries the SANITIZED bytes the trust root emitted, which for a
        // clean payload is byte-equal to its input — the record half of the carrier.
        assert.strictEqual(section.dataset.borderRawSvg, CLEAN_SVG);
    });

    it("a HOSTILE borderSvg in a template paints NOTHING (fail-closed, not fail-open)", async function () {
        withTemplate(HOSTILE_SVG);
        const ok = await CatalogService.applyTemplate("bordered");
        assert.strictEqual(ok, true, "a hostile border must refuse the BORDER, not the import");
        const section = document.getElementById("section-main");
        // ALL FOUR custom properties absent — the choke point's fail-closed contract.
        assert.strictEqual(section.style.getPropertyValue("--border-img"), "", "hostile border painted");
        assert.strictEqual(section.style.getPropertyValue("--border-img-slice"), "", "slice leaked");
        assert.strictEqual(section.style.getPropertyValue("--border-img-width"), "", "width leaked");
        assert.strictEqual(section.style.getPropertyValue("--border-img-outset"), "", "outset leaked");
        // No record, no markup: the DOM must be pristine.
        assert.strictEqual(section.dataset.borderRawSvg, undefined, "hostile bytes reached the record");
        assert.strictEqual(section.querySelector("script"), null, "a script node reached the DOM");
    });

    it("a template WITHOUT the borderSvg key does not touch an existing border (partial-patch contract)", async function () {
        // Simulate a border already painted (as an AI border earlier in the session would
        // have left it), then import a legacy template that predates AI borders.
        withTemplate(CLEAN_SVG);
        const section = document.getElementById("section-main");
        section.dataset.borderRawSvg = CLEAN_SVG;
        section.style.setProperty("--border-img", "url(\"data:image/svg+xml;utf8,already\")");
        // Re-mock to a template whose section config LACKS the key entirely.
        global.fetch = async (url) => {
            if (url === "catalog.json") {
                return {
                    ok: true,
                    json: async () => ({
                        templates: [{ id: "legacy", name: "Legacy", path: "legacy_template.json" }],
                    }),
                };
            }
            if (url === "legacy_template.json") {
                return {
                    ok: true,
                    json: async () => ({
                        name: "Legacy",
                        data: { sections: { "section-main": { left: "1px" } }, shapes: [] },
                    }),
                };
            }
            return { ok: false };
        };
        const ok = await CatalogService.applyTemplate("legacy");
        assert.strictEqual(ok, true);
        assert.strictEqual(
            section.style.getPropertyValue("--border-img"),
            "url(\"data:image/svg+xml;utf8,already\")",
            "a template without borderSvg cleared an existing border — the key is what the gate reads",
        );
    });

    it("borderSvg: null in a template CLEARS an existing border (explicit no-border)", async function () {
        const section = document.getElementById("section-main");
        section.dataset.borderRawSvg = CLEAN_SVG;
        section.style.setProperty("--border-img", "url(\"data:image/svg+xml;utf8,already\")");
        withTemplate(null);
        const ok = await CatalogService.applyTemplate("bordered");
        assert.strictEqual(ok, true);
        assert.strictEqual(section.style.getPropertyValue("--border-img"), "", "an explicit null must clear");
        assert.strictEqual(section.dataset.borderRawSvg, undefined, "the record must clear with the paint");
    });
});


describe('Catalog Service', function() {
    let CatalogService;

    before(function() {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.document = dom.window.document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;

        // Load the service.
        const code = fs.readFileSync(path.join(__dirname, '../../js/catalog_service.js'), 'utf8');
        // Simple way to get the object out for testing
        const wrappedCode = code + '\nmodule.exports = { CatalogService };';
        
        // Use a temporary module to export the service
        const m = new module.constructor();
        m._compile(wrappedCode, 'catalog_service.js');
        CatalogService = m.exports.CatalogService;
    });

    it('should load the catalog JSON', async function() {
        const catalog = await CatalogService.loadCatalog();
        assert.strictEqual(catalog.templates.length, 1);
        assert.strictEqual(catalog.templates[0].id, 'archer');
    });

    it('should load a specific template', async function() {
        const template = await CatalogService.loadTemplate('assets/templates/archer_template.json');
        assert.strictEqual(template.name, 'Archer');
        assert.ok(template.data.sections);
    });

    describe('applyTemplate', function() {
        let dom;
        beforeEach(function() {
            dom = new JSDOM('<!DOCTYPE html><html><body><div id="ability-scores"></div></body></html>');
            global.document = dom.window.document;
            global.window = dom.window;
            global.HTMLElement = dom.window.HTMLElement;
            
            // Mock global functions used by applyTemplate
            global.clearBorderStyles = (el) => { el.className = ''; };
            global.createShape = () => {};
            global.updateLayoutBounds = () => {};
            global.alert = () => {};
        });

        it('should apply border styles to matching sections', async function() {
            // Mock confirm
            global.confirm = () => true;
            global.window.confirm = global.confirm;

            const success = await CatalogService.applyTemplate('archer');
            assert.ok(success);
            
            const section = document.getElementById('ability-scores');
            assert.ok(section.classList.contains('archer_ability'));
        });

        it('should prevent duplicate shapes if IDs match', async function() {
            global.confirm = () => true;
            global.window.confirm = global.confirm;
            let shapeCreateCount = 0;
            global.createShape = () => { shapeCreateCount++; };
            
            // First apply
            await CatalogService.applyTemplate('archer');
            assert.strictEqual(shapeCreateCount, 1);
            
            // Mock the shape element existing in DOM
            const shapeEl = document.createElement('div');
            shapeEl.id = 'shape-archer-icon';
            const wrapper = document.createElement('div');
            wrapper.className = 'be-section-wrapper';
            wrapper.appendChild(shapeEl);
            document.body.appendChild(wrapper);
            
            // Second apply
            await CatalogService.applyTemplate('archer');
            assert.strictEqual(shapeCreateCount, 2); // Should call createShape again
            assert.strictEqual(document.getElementById('shape-archer-icon'), null); // Should have removed the old one
        });

        it('should return false for non-existent template', async function() {
            const success = await CatalogService.applyTemplate('unknown');
            assert.strictEqual(success, false);
        });

        it('should handle malformed template JSON (missing data)', async function() {
            // Mock fetch to return malformed JSON
            const oldFetch = global.fetch;
            global.fetch = async (url) => {
                if (url === 'malformed.json') {
                    return { ok: true, json: async () => ({ name: 'Bad' }) }; // Missing 'data'
                }
                return oldFetch(url);
            };

            const template = await CatalogService.loadTemplate('malformed.json');
            assert.strictEqual(template, null);
            global.fetch = oldFetch;
        });

        it('should handle template with no sections or shapes', async function() {
            const oldFetch = global.fetch;
            global.fetch = async (url) => {
                if (url === 'empty.json') {
                    return { ok: true, json: async () => ({ name: 'Empty', data: {} }) };
                }
                return oldFetch(url);
            };
            
            // We need to add 'empty' to the catalog first
            const oldLoadCatalog = CatalogService.loadCatalog;
            CatalogService.loadCatalog = async () => ({
                templates: [{ id: 'empty', path: 'empty.json' }]
            });

            const success = await CatalogService.applyTemplate('empty');
            assert.strictEqual(success, false);

            CatalogService.loadCatalog = oldLoadCatalog;
            global.fetch = oldFetch;
        });
    });
});
