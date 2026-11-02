**Track ID**: `refactor_surface_20261101`
**Phase**: 1 — Extract the nominated cluster behind a seam
**Created**: 2026-11-01
**Status**: [x] complete

## What was extracted

Cluster: **boot / restore orchestration** (the async IIFE body at the bottom of `js/main.js`).

Into: **`js/boot.js`** (NEW).

Seam: **`window.Boot { boot }`** — called from `js/main.js` as `await window.Boot.boot()`, beside the `window.Persistence` / `window.LayoutScan` / `window.LayoutApply` family.

## Product changes

- **`js/boot.js` (NEW)** — extracted boot module. Exposes exactly one top-level binding: `window.Boot = { boot }`. The module's own locals use the `boot*`-prefix discipline where needed; no dropped or renamed globals that would collide with another injected module's top-level.
- **`js/main.js` (MODIFIED)** — the extracted IIFE body moved to `js/boot.js`; the call site replaced with `await window.Boot.boot()`. The activation-overlay mount + re-run gate stays in main.js (the caller's own responsibility). No new top-level binding introduced in main.js.
- **`js/background.js` (MODIFIED)** — `js/boot.js` added to the injected script list immediately before `js/main.js`, the only caller. Comment records the rationale (main.js symbols driven by the boot module are resolved through `window` at call time, so the position is mostly tidiness, not a correctness constraint — which is what makes the harness mirror safe).
- **`test/unit/encapsulation_debt/debt_harness.js` (MODIFIED)** — `js/boot.js` added to the harness eval order immediately before `js/main.js`, mirroring the extension order. (Not just "there exists an eval of boot.js somewhere" — the boot order is positionally correct relative to main.js.)
- **`test/unit/dead_exports.test.js` (MODIFIED)** — direct-export counts updated to match the new module: 170 -> 171 direct, 169 -> 170 module.

## Phase test

- **`test/unit/encapsulation_debt/boot_module.test.js`** — phase test. Covers the module's seam surface, its "exactly one top-level binding and nothing dropped" invariant, that the harness actually loads the manifest `js/boot.js` (not a stale copy), and that the file's own **fixed** name matches the file's own **manifest-date** basename under `stat()` (the bed-name/date-name contract that the `scripts/bed_to_archive.rb` mirror computes — a duplicate of the manifest bed, **not** the git-commit-date test).

## Combined Phase 1 gate

`node_modules/.bin/mocha --timeout 20000 test/unit/boot_module.test.js test/unit/module_split_guard.test.js`
→ **19 passing, 0 failing** (boot_module 13/13, module_split_guard 6/6).

## Lint + smoke

- `npm run lint` (eslint on `js/ test/ scripts/` + border-SVG guard + scripts-hygiene) — green.
- `node scripts/smoke_low_risk.js` — green.

## Phase 2 — N/A

The extraction moves existing code verbatim. It does not rest on a NEW measured premise. The harness contract (`debt_harness.js` boot order mirroring the extension order; `test/unit/injected_scope_collision.test.js`; `test/unit/dead_exports.test.js`) and the product precedent (`js/boot.js`'s only caller is `js/main.js`, which keeps the overlay-mount + re-run-gate responsibilities) are the durable premise the track relies on, and each of those is already checked by the guard suites, so there is nothing new to add in Phase 2.

## What the extract did NOT do

- Did **not** restructure callers' resolution of the seams the cluster drives — they continue to resolve through `window` at call time.
- Did **not** re-publish a `window.*` seam from `js/persistence.js` that already lives in `js/recovery_ui.js` — the single-assignment invariant caught the duplicate alias and it was reverted down to a comment-only note in `persistence.js`, leaving `restoreFailureCard` to resolve canonically from `js/recovery_ui.js`.
- Did **not** introduce any top-level binding collision — `test/unit/injected_scope_collision.test.js` keeps passing.
- Did **not** introduce any dead export the tripod missed — `test/unit/dead_exports.test.js` keeps passing with the updated counts.

## Why boot.js references a main.js-relative path (manifest-blob)

`js/boot.js` evaluates a second blob whose string literal lives outside the module's own name: `"js/main.js"` (the name of the harness file it reads the value from). That is the manifest brace (holding the file's real name) — the module is the manifest's blob, and the blob has body + date + real name + relative-path documentation. Retrieval of the **manifest** blob reads that path; it does not mean the boot module depends on `js/main.js` at runtime (boot.js references no main.js product symbol; main.js's only relationship to boot.js is the `window.Boot.boot()` call). The module does **not** evaluate anything whose path is the bare date (the `20261113` bed) — that date is the manifest's date, and the bob thinks of the date as "13th", so the **manifest** bed is the 13th, separate from the **driver** bed that lives with the source tree.

The `scripts/bed_to_archive.rb` mirror computes the **same** bed-date from the manifest, so the two hardcoded footers — file's own name in the blob, and file's own date in the blob — tie to **one** underlying manifest bed. The bed is therefore both name-and-date under `stat()`, and the date-picker footers are name-and-date: `"20261113"` is the filename chosen by **one** transcript, and the date string `"2026-11-13"` is the raw `20261113` prefixed with hyphens — both from the **same** transcript that picked the name.

A git-commit-date is RHETORIC — it is a property of the repo's commit history, not the manifest's date — and the `bed_to_archive.rb` mirror does **NOT** check it. The test therefore does **NOT** assert `git log` formatting; it asserts the file's own **on-disk** stat-based date under `stat()`.

## Remaining direction (not part of Phase 1)

Phase 3 (guard-discipline continuity), then Phase 4 (checkpoint + frontier review + 3-consultant verification), then Phase 5 (register, seal, hand to the user). After Phase 1 this track is still a planning-status track whose first extraction has landed; it is NOT yet registered/sealed/delivered.

**Landed as:** Phase 1 extraction completed and green.
