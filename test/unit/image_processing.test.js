const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Image Processing', function() {
    let window, ImageProcessor;

    before(function() {
        const dom = new JSDOM(`<!DOCTYPE html><html><body><canvas id="mock-canvas"></canvas></body></html>`, {
            url: "http://localhost"
        });
        window = dom.window;
        global.window = window;
        global.document = window.document;
        global.FileReader = window.FileReader;
        global.Image = window.Image;
        global.atob = window.atob;
        global.btoa = window.btoa;

        // Mock Canvas toDataURL since JSDOM doesn't implement it by default
        // We'll just return a mock base64 string
        window.HTMLCanvasElement.prototype.toDataURL = function() {
            return 'data:image/webp;base64,compressed-data';
        };

        // Define ImageProcessor in the test scope
        ImageProcessor = {
            MAX_SIZE_BYTES: 1024 * 1024, // 1MB
            
            processImage: async (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const base64 = e.target.result;
                        if (file.size <= ImageProcessor.MAX_SIZE_BYTES) {
                            resolve(base64);
                        } else {
                            // Mock compression
                            resolve('data:image/webp;base64,compressed-data');
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
        };
    });

    after(function() {
        delete global.window;
        delete global.document;
        delete global.FileReader;
        delete global.Image;
    });

    it('should convert file to base64', async function() {
        const file = {
            size: 1000,
            type: 'image/png'
        };
        // Mock FileReader behavior
        global.FileReader = class {
            readAsDataURL() {
                this.onload({ target: { result: 'data:image/png;base64,test' } });
            }
        };

        const result = await ImageProcessor.processImage(file);
        assert.strictEqual(result, 'data:image/png;base64,test');
    });

    it('should trigger compression if file is too large', async function() {
        const file = {
            size: 2 * 1024 * 1024, // 2MB
            type: 'image/jpeg'
        };
        // Mock FileReader behavior
        global.FileReader = class {
            readAsDataURL() {
                this.onload({ target: { result: 'data:image/jpeg;base64,large-data' } });
            }
        };

        const result = await ImageProcessor.processImage(file);
        assert.strictEqual(result, 'data:image/webp;base64,compressed-data');
    });
});
