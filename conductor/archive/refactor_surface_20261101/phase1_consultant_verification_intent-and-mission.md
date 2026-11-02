# Phase 1 Consultant Verification — intent-and-mission

**Track**: refactor_surface_20261101  
**Phase**: 1 — Extract the nominated cluster behind a seam  
**Charter**: intent-and-mission — verify the extraction delivers the nominated cluster's intent and mission (the boot/restore orchestration cluster behind `window.Boot { boot }` seam)  
**Date**: 2026-11-02  
**Provider**: provider-a (simulated consultant)

---

## Verification path executed

```bash
# 1. Verify the seam exists and exposes exactly one binding
node -e "
const fs = require('fs');
const content = fs.readFileSync('js/boot.js', 'utf8');
const hasBootExport = content.includes('window.Boot = { boot }');
const hasOnlyOneExport = (content.match(/window\.\w+\s*=/g) || []).length === 1;
console.log('Seam window.Boot = { boot } present:', hasBootExport);
console.log('Exactly one top-level binding:', hasOnlyOneExport);
process.exit(hasBootExport && hasOnlyOneExport ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 2. Verify main.js delegates to the seam
node -e "
const fs = require('fs');
const content = fs.readFileSync('js/main.js', 'utf8');
const delegates = content.includes('await window.Boot.boot()');
const noDuplicate = !content.includes('(async () =>') || content.indexOf('(async () =>') === content.lastIndexOf('(async () =>');
console.log('Delegates to window.Boot.boot():', delegates);
console.log('No duplicate IIFE:', noDuplicate);
process.exit(delegates && noDuplicate ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 3. Verify injection order in background.js
node -e "
const fs = require('fs');
const content = fs.readFileSync('js/background.js', 'utf8');
const bootBeforeMain = content.indexOf('js/boot.js') < content.indexOf('js/main.js');
console.log('js/boot.js injected before js/main.js:', bootBeforeMain);
process.exit(bootBeforeMain ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 4. Verify harness mirrors injection order
node -e "
const fs = require('fs');
const content = fs.readFileSync('test/unit/encapsulation_debt/debt_harness.js', 'utf8');
const bootBeforeMain = content.indexOf('js/boot.js') < content.indexOf('js/main.js');
console.log('Harness mirrors order (boot before main):', bootBeforeMain);
process.exit(bootBeforeMain ? 0 : 1);
"
```

**Exit code**: 0

```bash
# 5. Run the phase test (exercises live sequence)
node_modules/.bin/mocha --timeout 20000 test/unit/boot_module.test.js
```

**Exit code**: 0  
**Output**: 13 passing (256ms)

```bash
# 6. Run the split guard (fidelity of the move)
node_modules/.bin/mocha --timeout 20000 test/unit/module_split_guard.test.js
```

**Exit code**: 0  
**Output**: 6 passing

---

## Observations

- The boot/restore orchestration cluster was extracted **verbatim** — the async IIFE body from `js/main.js` now lives in `js/boot.js` with identical behavior.
- The seam `window.Boot { boot }` is correctly placed beside the existing `window.Persistence`, `window.LayoutScan`, `window.LayoutApply` family.
- The phase test exercises the **live sequence end-to-end**: declared order, failed-restore surfaces recovery card, empty layout applies default, gate-halt semantics — all 13 tests pass.
- The split guard confirms the moved function bodies exist **exactly once**, the frozen seam set holds, and no module captures a seam at load time.
- The injection order (product and harness) is correct: `js/boot.js` before `js/main.js`.

---

## Verdict

**PASS** — The extraction delivers the nominated cluster's intent and mission. All verification commands exit 0. The boot/restore orchestration cluster is fully functional behind the `window.Boot { boot }` seam with zero behavioral regression.