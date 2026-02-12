const assert = require('assert');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../../js/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

describe('Data Schema & Versioning', function() {
  let window;

  before(function() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost",
      runScripts: "dangerously"
    });
    window = dom.window;
    window.indexedDB = global.indexedDB;
    window.__DDB_TEST_MODE__ = true;
    window.eval(mainJsContent);
  });

  it('should have a current version constant', function() {
    assert.ok(window.Storage.SCHEMA_VERSION, 'SCHEMA_VERSION should be defined');
    assert.strictEqual(typeof window.Storage.SCHEMA_VERSION, 'string', 'SCHEMA_VERSION should be a string');
  });

  it('should define a valid layout schema structure', function() {
    const validLayout = {
        version: "1.0.0",
        sections: {
            "section-Actions": {
                left: "10px",
                top: "20px",
                width: "300px",
                height: "400px",
                innerWidths: {
                    "div-1": "100px"
                }
            }
        }
    };

    assert.ok(window.Storage.validateLayout(validLayout), 'Should validate a correct layout object');
    
    const invalidLayout = { version: "1.0.0" }; // Missing sections
    assert.strictEqual(window.Storage.validateLayout(invalidLayout), false, 'Should fail validation if sections are missing');
  });
});
