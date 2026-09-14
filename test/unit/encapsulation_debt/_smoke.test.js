const assert = require('assert');
const { boot } = require('./debt_harness.js');

describe('harness smoke', function () {
  it('boots main.js and exposes handles', function () {
    const { window, cleanup } = boot();
    try {
      assert.ok(window.__DDB_PRINT_ENHANCE_INITIALIZED__);
      assert.strictEqual(typeof window.injectCloneButtons, 'function');
      assert.strictEqual(typeof window.splitSkillsBox, 'function');
      assert.strictEqual(typeof window.createContextMenu, 'function');
      assert.strictEqual(typeof window.setActiveSection, 'function');
      assert.strictEqual(typeof window.createShape, 'function');
    } finally {
      cleanup();
    }
  });
});
