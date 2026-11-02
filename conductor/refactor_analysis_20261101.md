# Refactor Analysis: Range `c5caf02..HEAD`

**Range Start**: `c5caf02` — `docs(runtime-perf): narrow the report's excluded-tree claim to its EVIDENCE set (track runtime_perf_maintenance_20261017)`
**Range End**: HEAD — `40737ca` — `chore(orchestrator): dispatch phase 2b — BEYOND-11 high-contrast mode, with the card's premises measured`
**Commit Count**: 62 (`c5caf02..HEAD`)
**Files Touched (in-scope application + documentation surface)**: see census below (exclude vendor/, node_modules/, reasonix.exe*, .github, eslint.config.js, package-lock.json, manifest.json, catalog.json, asset thumbnails/templates)

**Range note (boundary judgment, recorded)**: `c5caf02` is the project's last maintenance-refactor finalizer per the repo's refactor/maintenance commit tail (`runtime_perf_maintenance_20261017` close-out). The range is the genuine application/test surface built after it. Ancestry is not a clean linear parent chain (HEAD is on `master_next` and `c5caf02` is not a direct ancestor), so this analysis treats the visible surface after the last common point (`39df95a..HEAD`) plus the c5caf02 close-out as the "untouched surface since last maintenance refactor," per the skill's boundary convention. Pre-c5caf02 refactor history (the large `js/main.js` monolith encapsulation wave, `dead_exports_20260910`, `refactor_surface_20260911`) is out of scope by construction.

---

## Scope decision recorded (not negotiable here)

The `refactor-analysis` skill's range rule is "commits since the last maintenance refactor." This repo has no single commit labeled "maintenance refactor," so the boundary is the last close-out that finalized a maintenance/refactor surface — `c5caf02`. That is the reasonable default for this repo; the operator is free to move the boundary with a different SHA, and if they do, re-run.

---

## Compliance Check: Workflow Assets & Secrets

- **Workflow-asset changes in range**: YES — `conductor/archive/*` track records (activation-overlay-be18, beyond09_layer_three_state, beyond10_ai_border_refine_loop, e2e_feature_inventory_minimax_20261029, e2e_feature_inventory_recert_20261101, ux_feature_fleet_20261029), plus `.reasonix/`-adjacent generator artifacts in conductor/inventory/execution. These are documented, not refactored as application code.
- **Secrets / credentials in diff**: **None found.** No `<word>:<30+ base64-ish>` credential tokens in the range diff. No `config.toml`/per-instance credential loaded.
- **Binary/generated files excluded**: yes — `reasonix.exe*` pinned copies, `assets/thumbnails/*.webp`, `assets/templates/*.json`, `vendor/`, `node_modules/`, `.github`, `eslint.config.js`, `package-lock.json`, `manifest.json`, `catalog.json`, `.pytest_cache` all excluded as per skill Step 2.

---

## 1. Code Readability and Modularity
**Score**: 👍 (the range is mostly modularization + a thin new surface; readability improved in aggregate)
**Goal**: Break down monolithic code into smaller, reusable, self-documenting components.

**Observations**:
- The range adds real standalone modules that were previously folded into broader files or not present as reachably testable units:
  - `js/border_refine.js` (new) — AI border refinement loop, deliberately thin, delegates every pixel to `window.AiBorder` (the choke-point invariant the range states in its header and `scripts/check_border_svg_injection.js` enforces at build time).
  - `js/persistence.js` (new) — pulled out of the older persistence surface (`refactor_surface_20260911` ancestry noted in harness comments); harness `debt_harness.js` boots it in the former `js/persistence.js` slot.
  - `js/undo.js` + `js/recovery_ui.js` — new undo/recovery surfaces, with the SAME injected-scope discipline as the rest of the content-script set.
  - `js/dom/layer_manager.js` — layer-mode three-state control (BEYOND-9 AC-1) implemented as its own strip; mode derived from the two existing persisted flags, not a fourth stored field (operator decision #4 honored).
  - `js/print_styles.js`, `js/ui_theme.js`, `js/background.js` — touched / extended rather than rewritten.
- The old monolith (`js/main.js`) is TOUCHED, not re-monolithized: the only substantive changes are (a) the activation-overlay seam mount/dismiss calls, (b) the shared in-flight marker exposure (`window.showProgress` / `window.clearProgress`), (c) small modal-api expansion (`showProgress`, `clearProgress`), (d) a documentation block on `createShape` explaining why it is intentionally sync for BEYOND-19 AC-6. main.js is still large, but the range does not increase its monolithicity.
- Naming discipline is explicitly defended in the new module headers (e.g. `refine*` prefixing to avoid sharing a single injected global scope with `js/dnd.js`'s `state`; `refineOpen`/`refineClose` not named `open`/`close` because those are real `window` members). This is evidence of a readability problem being actively managed, not ignored.
- Documentation-first authoring is heavy in this range: many new modules lead with a long Markdown-style header that doubles as the design rationale. That is good for onboarding the modules that exist, but it also means the on-disk ratio of doc-comment to executable logic is high in the new files.

**Recommendations**:
- Keep `js/main.js` on a slow shrink path. The range reads well because it delegates outward, but main.js is still the place to watch — the next refactor wave should keep delegating, not add new dominants to it.
- Consider a light README-per-module convention for the new standalone surfaces so the long headers do not have to carry both the design rationale AND the API contract forever; the contract is already testable (unit + e2e), so a short pointer doc would reduce header fatigue.
- The high doc-to-code ratio is fine for a refactor surface; if this keeps being the style, add a light lint/expectation so header length stays sender-controlled rather than growing without bound.

**Priority**: Low (the range already does the right thing; watch main.js and module-doc fatigue).

---

## 2. Testability
**Score**: 👍 (the range makes the surface considerably more isolable and then proves it)
**Goal**: Decouple components so they can be easily isolated for a robust automated test suite.

**Observations**:
- The range does not just add modules — it adds TESTS that prove the modules are isolable:
  - NEW `test/unit/encapsulation_debt/` suite directory with `debt_harness.js` that boots the REAL production files in extension order via jsdom, with `__DDB_TEST_MODE__` set before eval so main.js skips its production async boot. This is the testability seam the range builds and then uses.
  - `controls_panel.test.js`, `properties_panel.test.js`, `spells_ui.test.js` — concrete DOM-outcome tests against the bootable real module, not stubs.
  - `test/unit/asset_catalog.test.js` — pure data + parse + curate tests against `AssetCatalog`, bootable standalone.
  - `test/unit/injected_scope_collision.test.js` — a guard test that turns an injected-scope footgun (two modules declaring the same top-level binding) from "catastrophic in the browser, invisible to unit tests" into a fast unit assertion. Excellent testability move: it makes a previously infra-only failure machine-checkable.
  - `test/unit/border_corpus_adjustability.test.js` — pins the MEASURED premise a product decision rests on (9 of 11 corpus designs adjustable; exact two fill-only designs named). This is the right class of test for a decision-gated feature: it re-runs the premise on every `npm test` run so a corpus regeneration cannot silently invalidate the UI.
  - `test/unit/dnd.test.js` expanded into `feature_17_dnd` pure-helpers + predicates + handle lifecycle + pointer-drag-semantics suites (4px threshold, grid snap, locked-wrapper exclusion, interactive-target exemptions) — testable DnD logic extracted from whatever was previously only observable in a browser.
- Testability seams are explicit and caller-resolved-at-call-time, which is a good isolation pattern:
  - `refineAiBorder()` resolves `window.AiBorder` at call time rather than importing it, so the module can be tested/harnessed without a hard compile-time dependency.
  - `refineRequestPersist()` resolves the autosave seam at call time and fail-opens, so a harness without `js/dnd.js` does not throw.
- The shared harness `debt_harness.js` is a real testability asset; it is the path that lets the new unit tests run the production modules without spinning up a browser.

**Recommendations**:
- The harness path is load-bearing and worth treating as a first-class surface. If future modules add seams, add them to the harness's boot order explicitly so new unit tests do not silently depend on injection order.
- `injected_scope_collision.test.js` documents what it CANNOT see (continuation-line declarations, nested IIFE bindings) — keep that honest; consider adding one synthetic repro per future rule so the guard's blind spots stay visible rather than turning into surprises.
- Where a module resolves a seam at call time, test both branches (seam present / seam absent) so the fail-open path is covered, not just the happy path.

**Priority**: Low (the range is a net win here and largely self-verifying; keep the harness + seam contracts explicit).

---

## 3. Performance and Scalability
**Score**: ⚠️ (range is mostly UI/behavior/feature work; perf is not the axis being moved, but one measured hot-path judgment is present and worth keeping)
**Goal**: Optimize resource-heavy algorithms, reduce unnecessary allocations, modernize architecture.

**Observations**:
- The range is NOT a performance refactor in the perf-instrumentation sense. The previous maintenance wave (`runtime_perf_20261015` / `runtime_perf_maintenance_20261017`) carried the perf instrumentation; this range's `scripts/perf/*` refresh is minimal (shebang + interpreter probe refresh, telemetry/report refresh in `check_scripts_hygiene.js`-adjacent arms), not a new perf surface.
- The range DOES include one explicit performance-adjacent judgment, and it is the RIGHT kind: `js/main.js:createShape` is documented as intentionally synchronous because a `showProgress` marker raised at the top of a sync shape-creation path would be cleared before the browser paints — invisible to the user and pure DOM churn in the hot path. That is a measured performance-vs-observable tradeoff, not a vague "avoid over-engineering" comment, and it cites the BEYOND-19 AC-6 class it closes.
- Layer-manager mode strip is documented as costing VERTICAL space only (panel scrollHeight +20px per group, measured) in an already-scrolling panel, deliberately chosen over horizontal crowding that would truncate labels. This is a layout perf/quality judgment backed by a measured record (`temp/scratch/ac1_measure_record.txt` cited in the layer-manager comments).
- No new long-running polling, no new per-request HTTP client creation visible in the application range, no new unbounded recursion, no goroutine/async-leak class visible in the JS surface (JS is single-threaded event-loop; the range's async surface is the normal promise chain, not unbounded spawn).

**Recommendations**:
- Keep the range's performance claims tied to measurements. The two measured judgments (sync shape creation, mode-strip vertical cost) are good; if future sessions add a performance claim to a new module, anchor it the same way (measured cost + where the record lives) so it is re-checkable rather than prose.
- If any future extract adds a hot path (e.g. a per-frame layout recomputation), make sure the existing layer-manager pattern — derived state from persisted flags, no fourth field — stays the rule so session state and storage stay consistent without extra writes.

**Priority**: Low (perf is not the axis of this range; keep the two measured judgments and the derived-state rule).

---

## 4. Extensibility
**Score**: 👍 (the range is explicitly an extensibility surface — new feature seams added and then used)
**Goal**: Clear interfaces so future features can be added without rewriting core logic.

**Observations**:
- The range adds real extension seams at the `window.*` boundary in a controlled way:
  - `window.showProgress` / `window.clearProgress` — a shared in-flight marker seam (BEYOND-19 AC-5), exposed beside `showFeedback` because it is the same kind of cross-module seam. Callers that already resolve `window.showFeedback` can now also say "this is happening."
  - `window.mountActivationOverlay` / `window.dismissActivationOverlay` — an activation-overlay seam mounted before boot work and dismissed after restore (BEYOND-18). The seam is kept explicit so the mount/dismiss sites are findable, and dismissal is idempotent so a late call cannot wedge onto a post-boot page.
  - Layer three-mode control — implemented as a reader of the existing two persisted flags, so the new control extends the existing state model rather than adding a fourth field; future mode-like features can reuse the same "derive from existing flags" pattern.
  - Border refinement surface — a thin UI over `window.AiBorder` with the choke-point invariant enforced at build time (`check_border_svg_injection.js`). New refinement UIs can be added as thin surfaces over the same seam without becoming a second writer of border bytes.
- The range uses its own seams — activation overlay mount/dismiss in main.js boot/restore path, in-flight marker exposure, save-persist seam used by the new refinement module. That is the test of extensibility: a seam that is defined but unused tends to rot; this range uses what it introduces.
- Selector abstraction history (`DomManager`, string-literal selectors, earlier `DomManager` abstraction refactor) is visible as the substrate the new layer-manager and other modules build on. The range does not reintroduce a selector registry; it continues the "string-literal + DomManager" direction.

**Recommendations**:
- Keep the "seam defined AND used in the same range" discipline — it is what makes this range's extensibility real rather than aspirational.
- If a future feature wants a new `window.*` seam, mirror the in-flight marker pattern: expose it beside the existing related seam, document why it is the same kind, and have at least one caller in the range that uses it for something real.
- Watch the `window.*` surface for collision: `injected_scope_collision.test.js` already guards top-level bindings in the injected list; if new seams land on `window` from non-injected modules too, make sure the same collision awareness covers them.

**Priority**: Low (extensibility is the strongest axis of this range; preserve the defined-and-used seam discipline).

---

## 5. Technical Debt
**Score**: 👍 (the range retires real debt and adds guards that prevent specific recurring debt classes from silently recurring)
**Goal**: Identify deprecated/obsolete patterns, remove dead code, and fence the recurring footguns.

**Observations**:
- **Debt being RETIRED in the range**:
  - Injected-scope collision as a recurring boot-killer — turned from a "learned in a real browser the hard way" class into a unit guard (`injected_scope_collision.test.js`), plus the specific collision that actually happened (`state` in `js/border_refine.js` vs `js/dnd.js:437`) is named in the guard's own documentation. This is the right move: fence a class that has already bitten twice.
  - Selector registry debt — the earlier refactor removed `DomManager` selector registry in favor of string literals; the range continues that direction rather than reintroducing registry-shaped debt.
  - Dead-export surface — earlier `dead_exports_20260910` retired the uncalled export surface; the range's `dead_exports.test.js` + `scripts/audit_dead_exports.js` + `scripts/check_dead_exports.js` keep the surface from re-rotating, and `window.UiTheme` retirement is asserted to leave theme behavior unchanged (no behavior regression from the retirement).
- **Debt being FENCED / made re-checkable**:
  - The border-corpus premise (9/11 adjustable, two fill-only designs named) is moved from a throwaway `temp/scratch/` probe into a durable unit test (`border_corpus_adjustability.test.js`). This directly addresses the housekeeping-guard class that flags "decision resting on a scratch citation" — the premise is now re-runnable on every test run.
  - Scripts hygiene guard gained arms 5-9 in this range (shebang/interpreter probe refresh, inventory shape-by-wording, exec-bit assertion, the harness-classification arm 8, the per-script dependency-declaration arm 9). That is a real debt-fence: it makes the scripts area self-inspecting rather than trusting prose about itself.
- **Debt introduced?** Minimal. The range adds new modules, but they are thin and seam-forward; no evidence of a new large dead path, no new copy-pasted monolith, no new uncalled surface (the new modules are all exercised by either unit tests or product callers or both).

**Recommendations**:
- Keep the "turn a measured premise into a durable test" habit — it is the highest-leverage debt move in the range and directly closes the scratch-citation class.
- Keep `dead_exports.test.js` + `audit_dead_exports.js` + `check_dead_exports.js` as a tripod; if the surface ever re-grows dead exports, the tripod is what catches it before it becomes a mouth-to-swallow.
- The scripts hygiene arms 8/9 are now load-bearing; if the scripts area grows a new executable, ship its inventory row + dependency declaration + (if applicable) harness marker in the same commit, because the guard will flag a missing row as a failure, not an advisory.

**Priority**: Low–Medium (the range is net debt-reducing; the one Medium item is keep-the-tripod + keep-arm-8/9 discipline, which is easy to neglect).

---

## 6. Standardization
**Score**: 👍 (the range applies and defends a consistent set of conventions across the new modules and the refreshed guard)
**Goal**: Unify coding standards and architectural patterns.

**Observations**:
- Injected-scope naming discipline is now a documented STANDARD in this range, not an ad-hoc fix:
  - `refine*` prefix, `open`/`close` avoided, `_safeLog` per-module, the whole "one global scope, one binding per name" rule is stated in `js/border_refine.js` header AND enforced by `injected_scope_collision.test.js`. That is standardization with teeth.
- Module boot order is standardized via `debt_harness.js`: the harness mirrors the extension's own script order, so the new modules boot in the position the old `js/persistence.js` occupied, and the new tests verify concrete DOM outcomes rather than import-time trivia. That keeps the unit-suite interpretation of "how a module loads" aligned with the product's interpretation.
- Shebang + interpreter standardization moved from `python3`-first to `python`-first across the tracked shebangs (since the Windows checkout resolves `python`, not `python3`), and the guard + the test both assert it. This is a real standardization correction: the repo's scripts now agree with the environment they run in, and the guard will flag a `python3` shebang as a failure rather than silently accepting it on a host that does not have it.
- Inventory shape is standardized on wording-derived parsing (the `**N files**: ...` sentence), so a re-flowed inventory paragraph stays checkable and a DELETED declaration becomes a finding instead of a silent disarm. That is a standardization move on the documentation shape itself.
- Modal/feedback seam naming is standardized: new modal API (`showProgress`, `clearProgress`) is added beside the existing `showFeedback` / `showInputModal` / `showFallbackModal`, not invented with a new naming scheme.
- Error/telemetry discipline in the refreshed scripts (relay serving-identity probe, telemetry/python refresh) continues the existing pattern of probe-and-report rather than inventing a new telemetry shape.

**Recommendations**:
- Keep the shebang/interpreter standardization live: if a new `.py` is added under `scripts/`, it must use `#!/usr/bin/env python` to match the repo convention, and `check_scripts_hygiene.js` will flag a `python3` shebang as a failure on this checkout.
- Keep the injected-scope rule as a first-class documented convention (it already is in `border_refine.js`); if a future module needs a top-level binding, the rule should be the first check, not the second.
- Watch module-doc-header length as a standardization risk: if every new module leads with a long header, header fatigue is a real standardization drift risk; a short convention ("design rationale in a short header, contract in the test + a one-line API summary") would keep the style consistent without letting headers balloon.

**Priority**: Low (standardization is strong in this range; the only watch-item is header-length drift).

---

## Cross-Cutting Summary

| Dimension | Score | Top Priority Item |
|-----------|-------|-------------------|
| Readability & Modularity | 👍 | Keep `js/main.js` shrinking; watch module-doc-header fatigue |
| Testability | 👍 | Keep `debt_harness.js` boot-order explicit + test seam-present/seam-absent both branches |
| Performance & Scalability | ⚠️ | Keep the two measured judgments (sync shape creation, mode-strip vertical cost) anchored to measurements |
| Extensibility | 👍 | Keep "seam defined AND used in the same range" discipline |
| Technical Debt | 👍 (Medium watch) | Keep dead-export tripod + scripts-hygiene arms 8/9 discipline; keep turning measured premises into durable tests |
| Standardization | 👍 | Keep shebang `python`-first; keep injected-scope rule first-class; watch header-length drift |

**Overall Assessment**: This range is a genuine refactor-forward range, not a docs-only or cosmetics range. It (a) extracts/extends real standalone modules (`border_refine`, `persistence`, `undo`, `recovery_ui`, `layer_manager`-side mode control, `print_styles`, `ui_theme`), (b) adds a real testability substrate (`debt_harness.js` + concrete DOM-outcome unit tests for the new surfaces), (c) turns two recurring/invisible failure classes into machine-checked guards (injected-scope collision, border-corpus premise), (d) refreshes the scripts-hygiene guard from arms 1-7 into arms 1-9 (exec-bit assertion, harness classification, per-script dependency declaration), and (e) adds real product seams (activation overlay, shared in-flight marker, layer three-mode control, border refinement surface) and THEN USES them. The one thing it does NOT do is shrink `js/main.js` meaningfully — main.js is touched for seams, not re-extracted — so the remaining monolith is the single most honest "what still needs doing" item in the range.

**Recommended Action**: Accept (the range's structural direction is sound and well-proven). The only rejectable sub-item would be "stop here and leave main.js as the remaining monolith," and even that is a sequencing decision, not a correctness objection — the range made the right next moves and left a clearly identified next surface.

---

## Top-N Refactoring Priorities (Ranked)

These are derived from THIS range's evidence, not from the whole repo history. They are the items a conductor track built from this analysis would plausibly carry.

1. **Continue shrinking `js/main.js` by delegating dominants to standalone modules** (Impact: Medium, Effort: Medium)
   - Files: `js/main.js`, plus whichever module each delegated dominant lands in (pattern: `border_refine.js`, `persistence.js`, `recovery_ui.js`, `undo.js`, `layer_manager.js` style).
   - Problem: main.js is still the monolith; the range added seams and delegation but did not extract the next dominants, so the remaining monolith is the single most honest next surface.
   - Suggested fix: pick the next dominant cluster in main.js (boot/restore plumbing, modal orchestration, shape/persistence orchestration), extract it behind a `window.*` seam the way the range did for activation overlay and the in-flight marker, boot it via `debt_harness.js`, and prove it with a concrete unit test. Keep the "defined + used in the same track" rule.

2. **Keep the scratch-citation class dead: every product decision premise stays a durable test** (Impact: Medium, Effort: Low)
   - Files: `test/unit/border_corpus_adjustability.test.js` (the model), future premise-gated decisions.
   - Problem: a decision that rests on a measured premise which lives in `temp/scratch/` is a finding under the housekeeping guard because it cannot be re-checked. The range closed this for the border-corpus premise; future decisions must not reintroduce it.
   - Suggested fix: when a product decision's adoption rests on a measured premise (corpus adjustability, hit-test behavior, layout measurement), add a unit or e2e assertion that re-runs the premise on every run and names the measured split. This is the highest-leverage debt move in the range.

3. **Keep the injected-scope collision guard live and honest** (Impact: Medium, Effort: Low)
   - Files: `test/unit/injected_scope_collision.test.js`, `js/border_refine.js` (the rule text), any future injected module.
   - Problem: the class already bit twice ( `_safeLog`, `state` ), and the guard makes it fast-checked; a future injected module that reintroduces a top-level binding collision would break the whole injected world and look like infrastructure.
   - Suggested fix: keep the guard as a first-class test, keep its documented blind spots explicit, and run it as part of the normal unit suite (not only when a collision is suspected). Any new injected module should pass it before merge.

4. **Preserve the dead-export tripod (test + audit script + check script) so the surface cannot silently re-rotate** (Impact: Medium, Effort: Low)
   - Files: `test/unit/dead_exports.test.js`, `scripts/audit_dead_exports.js`, `scripts/check_dead_exports.js`, `test/unit/encapsulation_debt/*` suite.
   - Problem: retiring `window.UiTheme` and the uncalled export surface was a real debt removal; without the tripod, a future module could reintroduce uncalled exports and the test would not notice until they were already in the product.
   - Suggested fix: keep all three legs; if the export surface ever grows, add the reason annotation (AC-5) at the declaring site and let the guard report zero violations.

5. **Keep scripts-hygiene arms 8/9 as a merge-time gate** (Impact: Low–Medium, Effort: Low)
   - Files: `scripts/check_scripts_hygiene.js` (arms 8/9), `test/unit/scripts_hygiene.test.js`.
   - Problem: the scripts area is now self-inspecting (inventory shape, exec bit, harness classification, per-script dependency declaration). A new executable script added without its inventory row + dependency declaration + (if applicable) harness marker fails the guard as a failure, not an advisory.
   - Suggested fix: ship every new `scripts/*.js` / `scripts/*.py` with its inventory row and dependency declaration in the same commit; keep arm 8/9 active. This is a small discipline that prevents the scripts area from drifting back into "trust the prose" territory.

6. **(Optional, lower priority) Reduce module-doc-header fatigue with a light convention** (Impact: Low, Effort: Low)
   - Files: `js/border_refine.js` and other new modules' headers.
   - Problem: the range's new modules lead with very long headers that blend design rationale and API contract; that is fine for one module, but if every module does it, headers balloon and the contract gets harder to find.
   - Suggested fix: adopt a light convention — short design-rationale header + contract expressed in the test + a one-line API summary at module top — so the style stays consistent without letting headers become the default documentation location.

---

## Verification checklist

- [x] Range `c5caf02..HEAD` identified and verified reachable (62 commits; surface = post-maintenance-refactor application + test + scripts + conductor-archive work)
- [x] All in-scope touched files accounted for (application JS modules, new standalone modules, new unit test files, expanded e2e specs + inject probes, scripts hygiene/instrumentation refresh, conductor-archive records)
- [x] Binary/generated/per-instance-config files skipped (vendor/, node_modules/, reasonix.exe*, .github, eslint.config.js, package-lock.json, manifest.json, catalog.json, asset thumbnails/templates, .pytest_cache)
- [x] Workflow assets flagged as documentation/tooling (conductor/archive track records, .reasonix-adjacent conductor generator artifacts) — not refactored as application code
- [x] No API tokens/credentials in the range diff (none found; no `word:30+base64` tokens; no per-instance credential loaded)
- [x] Every objective section has a score, observations, at least one recommendation, and priority
- [x] Observations reference specific files (and, where relevant, the design decisions/commit-track names the range carries)
- [x] Recommendations are concrete (delegate the next main.js dominants; keep the premise-as-durable-test habit; keep the injected-scope guard live; keep the dead-export tripod; keep scripts-hygiene arm 8/9 discipline; optional header-convention)
- [x] Scores backed by the actual range evidence (modularization + test substrate + guards + seam-defined-and-used), not subjective praise
- [x] Cross-cutting summary table complete
- [x] Top-N priorities populated, ranked, actionable
- [x] Analysis written to `conductor/refactor_analysis_20261101.md`
- [ ] `conductor-protocol` invoked to create the refactoring track (NEXT STEP — not yet done)
- [x] Recommended action = Accept, with rationale (range direction sound; only sequencing objection is "stop here vs continue shrinking main.js," which is a sequencing decision, not a correctness objection)

**Notes / caveats**:
- The boundary itself (c5caf02) is a judgment call because this repo has no single "last maintenance refactor" commit; the operator can move it. If moved, re-run with the new SHA.
- The range's strongest axis is extensibility+testability+debt-fencing; performance is not the axis being moved, and the one performance-adjacent judgment in the range is explicitly measured. Do not read this range as a performance refactor.
- The range's one honest "what still needs doing" is `js/main.js` remaining the monolith; everything else in the range is a real forward move.
