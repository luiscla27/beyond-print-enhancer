const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Production content-script load list integrity', function() {
  const bgPath = path.resolve(__dirname, '../../js/background.js');
  const bg = fs.readFileSync(bgPath, 'utf8');

  const m = /files:\s*\[([\s\S]*?)\]/.exec(bg);
  assert.ok(m, 'js/background.js must contain a chrome.scripting.executeScript files array');

  const files = Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);

  it('parses a non-empty files array from js/background.js', function() {
    assert.ok(files.length >= 3, `expected several files, got ${files.length}`);
  });

  it('lists js/main.js last (orchestrator loads after every module)', function() {
    assert.strictEqual(files[files.length - 1], 'js/main.js');
    assert.ok(!files.slice(0, -1).includes('js/main.js'), 'main.js must appear only at the end');
  });

  it('every listed file exists on disk and is a JS file', function() {
    const missing = files.filter((f) => !fs.existsSync(path.resolve(__dirname, '../../', f)));
    assert.deepStrictEqual(missing, [], 'files referenced by background.js do not exist: ' + missing.join(', '));
    const notJs = files.filter((f) => !f.endsWith('.js'));
    assert.deepStrictEqual(notJs, [], 'non-JS entries in background.js files array: ' + notJs.join(', '));
  });

  it('lists no file more than once', function() {
    const dupes = files.filter((f, i) => files.indexOf(f) !== i);
    assert.deepStrictEqual([...new Set(dupes)], [], 'duplicate entries in background.js files array');
  });

  it('keeps the same relative order as the shared debt-harness boot', function() {
    // The harness mirrors the production list for the modules it evals
    // (dnd.js / layer_manager.js / catalog_service.js / spells.js are
    // exercised by their own suites and legitimately absent there). The
    // order of the shared modules must still match production.
    const harnessPath = path.resolve(
      __dirname,
      '../unit/encapsulation_debt/debt_harness.js',
    );
    if (!fs.existsSync(harnessPath)) return; // harness not present -> skip
    const harness = fs.readFileSync(harnessPath, 'utf8');
    const harnessStems = Array.from(
      harness.matchAll(/window\.eval\(([A-Z_]+_JS)\)/g),
      (x) => x[1].replace(/_JS$/, '').toLowerCase(),
    );
    // Files whose harness placement legitimately differs from production:
    // catalog_service is opt-in (eval'd last only when opts.catalogService),
    // spells / layer_manager / dnd are exercised by their own suites and not
    // part of the harness eval list at all. Everything else must agree.
    const EXCLUDED = new Set([
      'catalog_service', 'spells', 'layer_manager', 'dnd', 'main',
    ]);
    const productionStems = files
      .map((f) => path.basename(f, '.js'))
      .map((s) => s.replace(/[.-]/g, '_').toLowerCase());
    const shared = productionStems.filter(
      (s) => !EXCLUDED.has(s) && harnessStems.includes(s),
    );
    const prodIdx = shared.map((s) => productionStems.indexOf(s));
    const harIdx = shared.map((s) => harnessStems.indexOf(s));
    const relProd = shared.map((_, i) => prodIdx[i] > prodIdx[i - 1]);
    const relHar = shared.map((_, i) => harIdx[i] > harIdx[i - 1]);
    relProd.forEach((v, i) => {
      if (i === 0) return;
      assert.strictEqual(
        relHar[i],
        v,
        `relative order mismatch between background.js and debt_harness for '${shared[i]}'`,
      );
    });
  });
});
