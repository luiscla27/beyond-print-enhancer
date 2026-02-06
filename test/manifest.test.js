const fs = require('fs');
const assert = require('assert');

describe('Manifest V3 Validation', function() {
  let manifest;

  before(function() {
    const manifestContent = fs.readFileSync('manifest.json', 'utf8');
    manifest = JSON.parse(manifestContent);
  });

  it('should be manifest version 3', function() {
    assert.strictEqual(manifest.manifest_version, 3);
  });

  it('should use service_worker for background', function() {
    assert.ok(manifest.background);
    assert.ok(manifest.background.service_worker);
    assert.strictEqual(typeof manifest.background.service_worker, 'string');
  });

  it('should have required permissions', function() {
    const requiredPermissions = ['declarativeContent', 'activeTab', 'scripting'];
    requiredPermissions.forEach(perm => {
      assert.ok(manifest.permissions.includes(perm), `Missing permission: ${perm}`);
    });
  });

  it('should use action instead of browser_action or page_action', function() {
    assert.ok(manifest.action);
    assert.strictEqual(manifest.browser_action, undefined);
    assert.strictEqual(manifest.page_action, undefined);
  });
});
