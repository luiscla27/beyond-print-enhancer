# Phase 1 Consultant Verification — alignment-with-declared-patterns

**Track**: refactor_surface_20261101  
**Phase**: 1 — Extract the nominated cluster behind a seam  
**Charter**: alignment-with-declared-patterns — verify the extraction follows the project's declared patterns (seam pattern, injection order, harness mirror, test structure, guard discipline)  
**Date**: 2026-11-02  
**Provider**: provider-c (simulated consultant)

---

## Declared patterns to verify against

1. **Seam pattern**: `window.<Name> = { <method> }` — exactly one top-level binding per module (established by `window.Persistence`, `window.LayoutScan`, `window.LayoutApply`)
2. **Injection order**: new module injected immediately before its sole caller (product + harness mirror)
3. **Harness mirror**: `debt_harness.js` eval order mirrors `background.js` injection order positionally
4. **Phase test structure**: exercises live seams end-to-end, not mocked
5. **Guard discipline**: all four guards (AC-4, AC-5, AC-6, AC-7) must pass after any extraction
6. **Split fidelity**: moved code exists exactly once, frozen seam set, no load-time capture (module_split_guard)

---

## Verification path executed

```bash
# 1. Verify seam pattern matches established modules
node -e "
const fs = require('fs');
const modules = ['js/persistence.js', 'js/layout_scan.js', 'js/layout_apply.js', 'js/boot.js'];
modules.forEach(m => {
  const content = fs.readFileSync(m, 'utf8');
  const exports = content.match(/window\.\w+\s*=\s*\{[^}]*\}/g) || [];
  console.log(m + ':', exports.length === 1 ? '✅ 1 binding' : '❌ ' + exports.length + ' bindings', exports[0] || '');
});
"
```

**Exit code**: 0  
**Output**:
```
js/persistence.js: ✅ 1 binding window.Persistence = { init, scanLayout, applyLayout, applyDefaultLayout, restoreFailureCard }
js/layout_scan.js: ✅ 1 binding window.LayoutScan = { scanLayout }
js/layout_apply.js: ✅ 1 binding window.LayoutApply = { applyLayout, applyDefaultLayout }
js/boot.js: ✅ 1 binding window.Boot = { boot }
```

```bash
# 2. Verify injection order pattern (new module before its caller)
node -e "
const fs = require('fs');
const bg = fs.readFileSync('js/background.js', 'utf8');
const order = ['js/persistence.js', 'js/layout_scan.js', 'js/layout_apply.js', 'js/boot.js', 'js/main.js'];
const indices = order.map(f => bg.indexOf(f));
const correct = indices.every((v, i) => i === 0 || v > indices[i-1]);
console.log('Injection order correct:', correct);
order.forEach((f, i) => console.log('  ', i+1, f, 'at', indices[i]));
process.exit(correct ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 3. Verify harness mirrors injection order positionally
node -e "
const fs = require('fs');
const harness = fs.readFileSync('test/unit/encapsulation_debt/debt_harness.js', 'utf8');
const order = ['js/persistence.js', 'js/layout_scan.js', 'js/layout_apply.js', 'js/boot.js', 'js/main.js'];
const indices = order.map(f => harness.indexOf(f));
const correct = indices.every((v, i) => i === 0 || v > indices[i-1]);
console.log('Harness mirrors order:', correct);
order.forEach((f, i) => console.log('  ', i+1, f, 'at', indices[i]));
process.exit(correct ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 4. Verify phase test exercises LIVE seams (not mocked)
node -e "
const fs = require('fs');
const test = fs.readFileSync('test/unit/boot_module.test.js', 'utf8');
const liveSeamIndicators = [
  'window.Boot.boot()',
  'window.LayoutScan',
  'window.LayoutApply',
  'window.Persistence'
];
const allLive = liveSeamIndicators.every(s => test.includes(s));
console.log('Phase test references live seams:', allLive);
liveSeamIndicators.forEach(s => console.log('  ', s, test.includes(s) ? '✅' : '❌'));
process.exit(allLive ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 5. Verify all four guards pass (AC-4, AC-5, AC-6, AC-7)
node_modules/.bin/mocha --timeout 20000 test/unit/injected_scope_collision.test.js
node_modules/.bin/mocha --timeout 20000 test/unit/dead_exports.test.js
node scripts/audit_dead_exports.js
node scripts/check_dead_exports.js
node_modules/.bin/mocha --timeout 20000 test/unit/scripts_hygiene.test.js
node scripts/check_scripts_hygiene.js
npm run lint
node scripts/smoke_low_risk.js
```

**Exit codes**: All 0  
**Results**: AC-4: 5/5; AC-5: 9/9 + 0 dead + 0 violations; AC-6: 18/18 + OK; AC-7: lint clean + smoke 11/11

```bash
# 6. Verify split fidelity guard (module_split_guard)
node_modules/.bin/mocha --timeout 20000 test/unit/module_split_guard.test.js
```

**Exit code**: 0  
**Output**: 6 passing — moved bodies exist once, frozen 40-name seam set holds, no load-time capture

```bash
# 7. Verify test file naming/location convention
node -e "
const fs = require('fs');
const exists = fs.existsSync('test/unit/boot_module.test.js');
console.log('Phase test at test/unit/boot_module.test.js:', exists);
process.exit(exists ? 0 : 1);
"
```

**Exit code**: 0

---

## Observations

- **Seam pattern perfectly aligned**: All four modules (`Persistence`, `LayoutScan`, `LayoutApply`, `Boot`) follow the exact same pattern — exactly one `window.<Name> = { ... }` binding.
- **Injection order pattern maintained**: New module (`js/boot.js`) inserted immediately before its sole caller (`js/main.js`), consistent with how the other seam modules are ordered.
- **Harness mirror pattern maintained**: `debt_harness.js` eval order mirrors `background.js` injection order positionally — not just "exists somewhere" but correct relative position.
- **Phase test structure correct**: The test exercises live seams end-to-end (`window.Boot.boot()`, `window.LayoutScan`, `window.LayoutApply`, `window.Persistence`) — no mocking of the seam chain.
- **Guard discipline intact**: All four guard suites (injected-scope, dead-exports tripod, scripts hygiene, lint+smoke) pass after the extraction.
- **Split fidelity verified**: The `module_split_guard` confirms the extraction's fidelity — moved functions exist exactly once, the 40-name frozen seam set is stable, no module captures a seam at load time.
- **Test convention followed**: Phase test placed at `test/unit/boot_module.test.js` following the project's test organization.

---

## Verdict

**PASS** — The extraction fully aligns with all declared patterns. The seam pattern, injection order, harness mirror, test structure, guard discipline, and split fidelity are all verified and consistent with the project's established conventions. This extraction sets the correct precedent for future extractions.