const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
require("fake-indexeddb/auto");

describe('Asset Migration (GIF to WebP)', function() {
    it('manifest.json should not have .png in web_accessible_resources for assets/', function() {
        const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf8'));
        const resources = manifest.web_accessible_resources[0].resources;
        const pngAssets = resources.filter(r => r.startsWith('assets/') && r.endsWith('.png'));
        assert.strictEqual(pngAssets.length, 0, 'Found .png assets in manifest.json: ' + pngAssets.join(', '));
    });

    it('js/main.js should not have .png references for internal assets', function() {
        const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');
        // We look for chrome.runtime.getURL('assets/.*\.png')
        const pngRegex = /chrome\.runtime\.getURL\(['"]assets\/.*?\.png['"]\)/g;
        const matches = mainJs.match(pngRegex);
        assert.strictEqual(matches, null, 'Found .png asset references in js/main.js: ' + (matches ? matches.join(', ') : ''));
    });

    it('injected CSS should use .webp for default-border', async function() {
        const htmlContent = '<!DOCTYPE html><html><head></head><body></body></html>';
        const dom = new JSDOM(htmlContent, {
            url: "https://www.dndbeyond.com/characters/12345",
            runScripts: "dangerously",
            resources: "usable"
        });
        const { window } = dom;
    const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    global.indexedDB = indexedDB;
    global.IDBKeyRange = IDBKeyRange;
        const { document } = window;

        // Mock chrome.runtime.getURL
        window.chrome = {
            runtime: {
                getURL: (path) => `chrome-extension://mock-id/${path}`
            }
        };

        // Inject scripts
        const elementWrapper = fs.readFileSync(path.resolve(__dirname, '../../js/dom/element_wrapper.js'), 'utf8');
        const domManager = fs.readFileSync(path.resolve(__dirname, '../../js/dom/dom_manager.js'), 'utf8');
        const mainJs = fs.readFileSync(path.resolve(__dirname, '../../js/main.js'), 'utf8');

        const scriptEl = document.createElement('script');
        scriptEl.textContent = elementWrapper + '\n' + domManager + '\n' + mainJs;
        document.body.appendChild(scriptEl);

        // Wait for script execution
        await new Promise(r => setTimeout(r, 100));

        // Trigger CSS injection if needed (usually happens on init or DOMContentLoaded)
        // main.js usually has an init or listener.
        // Let's manually trigger enforceFullHeight if it's not automatic
        if (window.enforceFullHeight) {
            window.enforceFullHeight();
        }

        const styleTag = document.getElementById('ddb-print-enhance-style');
        assert.ok(styleTag, 'Style tag should be created');
        const css = styleTag.textContent;

        assert.ok(!css.includes('assets/') || !css.match(/assets\/.*\.png/), 'CSS should not contain internal .png references');
        assert.ok(css.includes('border_default.webp'), 'CSS should contain border_default.webp');
    });
});
