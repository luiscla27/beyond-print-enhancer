# PHASE 2b TASK — BEYOND-11: SC-H3 High-contrast accessibility mode

You are an external reasonix session spawned by an orchestrator to execute ONE YouTrack card as a
conductor track. Read `prompts/LAUNCH-PROMPT-TEMPLATE.md` in this fleet dir FIRST (track record,
reproduce-before-fix, TDD, gates, local commits only, close-out, report, token handoff,
failure-loop escalation). The binding rules are restated at the bottom; the template is the
source of truth.

You are the FIRST session on this card. The tree is clean at HEAD `6cac0e5`.

## YOUR CARD (verbatim from the tracker, project BEYOND)

**BEYOND-11 — [UX Gap] SC-H3: High contrast accessibility mode missing — no dedicated spec,
feature not implemented**

UX Gap from e2e test matrix (approved scores 2026-10-25). Scenario SC-H3 (UC-15: Accessibility -
High Contrast). Composite UX Score 1.5 (critical — feature absent).

Evidence from matrix & specs (the card's own claims — the orchestrator VERIFIED them for you,
see "premises" below):
- No dedicated E2E spec for high contrast
- Grep for `highContrast|high-contrast` in `js/` returns 0 hits
- WCAG 2.1 AA contrast minimum (4.5:1) not verified
- Feature does not exist in codebase

Gap classification: Feature entirely absent. Priority P2 (Medium) — accessibility compliance gap.
Quick win: NO — requires CSS variable system, toggle, and full contrast audit.

### Acceptance criteria (the card's own words — all five must be met and measured)
1. High contrast mode toggle in settings panel
2. All UI elements meet WCAG 2.1 AA (4.5:1) in high contrast mode
3. Print output maintains high contrast when enabled
4. New E2E spec `high_contrast_accessibility.spec.js` created
5. Gate G-CONTRAST passes with measured 4.5:1 minimum ratio

## PREMISES THE ORCHESTRATOR ALREADY MEASURED — do not re-derive, do not take on faith either

Re-measure anything you rely on, but do not spend turns rediscovering these (each is a real
measurement against this tree at `6cac0e5`, 2026-11-01):

1. **The feature is genuinely absent.** `grep -rin "high.contrast|highcontrast" js/` → **0 hits**
   (the only hits in the repo are `test/fixtures/byok_border_corpus.json` and
   `scripts/border_designs.json`, both unrelated SVG design names). The card's evidence is TRUE.
2. **The card's "requires CSS variable system" is STALE — the variable system already exists.**
   `js/ui_theme.js` (2280 lines) is the locked design-token layer: `const TOKENS = {…}` (28 colour
   tokens + radii/shadow/fonts) renders a `const THEME_CSS` template literal whose FIRST block is
   `:root { --be-*: …; }` (27 vars), followed by the component "skin" rules for every chrome
   surface. It is injected as one `<style id="ddb-print-ui-theme">`. So AC-1/AC-2 are a TOKEN-SET
   plus a TOGGLE, not a CSS-variable retrofit. Say this plainly in your report — it changes the
   card's cost estimate, which is exactly the kind of stale premise BEYOND-9 and BEYOND-10 both
   found and recorded.
3. **The base theme is NOT already AA — measured, so AC-2 has real work behind it.** The orchestrator
   ran a WCAG relative-luminance audit of the current palette (`scripts/contrast_probe.py` in this
   fleet dir; standalone, 60 lines, read it): **8 of 32 text-on-ground pairs sit below 4.5:1.**
   The two failure families are `goldShadow` (2.52–2.89:1 on every ground) and `taupeFaint`
   (3.66–4.19:1), and `js/ui_theme.js`'s own token comments already forbid exactly those two as
   text ("goldShadow — never 11px text", "taupeFaint — icons/ticks/reset only — never 11px
   text"). Everything else passes in the base theme (`bone` 14.3:1 on `groundWell`,
   `taupe` 6.45:1, `ember` 4.86:1). **Read that list before deciding anything**: it says the
   high-contrast mode's job is (a) to lift the two deliberately-dim token families to ≥4.5:1
   *wherever they are used as text or meaningful glyph*, and (b) to prove it per element, not to
   re-colour a palette that mostly already passes.
4. **`G-CONTRAST` DOES NOT EXIST anywhere in this repo** — `grep -rl G-CONTRAST js/ test/ scripts/
   conductor/ docs/ vendor/` → **0 files**. (Same class as BEYOND-10's G-DETECT, which also existed
   nowhere and became `scripts/border_refine_gdetect.js`.) The card cites gate vocabulary the
   harness never named. **Do NOT fabricate a gate that cannot fail.** Build the real one: a
   `scripts/high_contrast_gcontrast.js` that MEASURES rendered contrast in real Chromium
   (Playwright is installed; `pngjs` is available), states its pass rule in code (≥4.5:1 on the
   measured text pairs, refusing a vacuous "everything was skipped" run), writes
   `temp/visual_logs/beyond11_gcontrast/report.json` with the per-pair numbers, and exits non-zero
   when the rule fails. Then record in your report that the card's gate name was unregistered and
   that this script is the equivalent real assertion that replaced it — the BEYOND-10 precedent,
   verbatim.
5. **There is no extension options page.** `manifest.json` has no `options_page` / `options_ui` /
   `default_popup`. The product's settings surface is the injected control panel's trays
   (`js/controls.js`: `trayDefs = { layout: "LAYOUT", output: "OUTPUT" }`). "Settings panel" in
   AC-1 therefore means **a row in the OUTPUT tray**, and the precedent row is
   `Print settings` (`id: be-btn-print-settings`) which opens a modal through
   `Modals.__createModal` (see `showPrintSettingsSurface()` in `js/controls.js`). The tray is
   **232px wide** and `js/controls.js` records that constraint as the reason several labels were
   shortened — a label that wraps is a defect, not a preference.
6. **Storage precedent.** Content-script-durable prefs live in `chrome.storage.local` under the
   `be.*` key family (`js/ai_settings.js`: `AI_SETTINGS_STORE_KEY = "be.ai"`), with
   `js/controls.js`'s `hintStore()` showing the house pattern for resolving
   `chrome.storage.local` at CALL time with a `localStorage` fallback. There is **no `be.ui` /
   `be.prefs` record yet** — you are creating the first one, so name it deliberately and record
   the choice.
7. **One matrix tension you must disposition, not silently drop.** The card's AC-2/AC-5 say
   **4.5:1 (WCAG AA)**, while the scored matrix's scenario text for SC-H3
   (`temp/e2e_test_matrix_scored.md:373-385`) says "text contrast **≥ 7:1**" (AAA) and
   "borders darken, backgrounds simplify". Gate at 4.5:1 because that is the AC's own floor, and
   **report the measured 7:1 status per pair** — if AAA is not reachable on a pairing, say which
   one and why (a 7:1 requirement against leather-black grounds is usually satisfied by bone text
   at 14:1, but not by mid-tone golds). Do not quietly re-score the matrix; record the delta.

## CONTEXT PACK — the files, and what each one is for

**The theme (AC-1, AC-2, AC-3 all land here):**
- `js/ui_theme.js` — READ THE TOP 240 LINES AND THE `:root` BLOCK FIRST. `TOKENS` (line 26),
  `TIERS` (227), `THEME_CSS` (239). Your high-contrast token values must be added to `TOKENS`
  and the override block must consume them. Note `@media (max-width: 900/700/560px)` blocks near
  the end (1774–1795) as the house pattern for a conditional block; the file already contains
  `@media print` rules (~1576, ~1672) that hide chrome surfaces.
- **HARD CONSTRAINT — the theme's own unit tests will fail you if you hand-edit around them.**
  `test/unit/ui_theme.test.js` (291 lines) pins, exactly:
  * `TOKENS` must equal `EXPECTED_TOKENS` **key-for-key** (`deepStrictEqual` on sorted keys) and
    every colour token must match `^#[0-9A-F]{6}$` (uppercase, 6-digit).
  * **`no-new-hex discipline`: EVERY hex anywhere in the emitted CSS and in the source must be a
    `TOKENS` value.** A literal `#FFFFFF` in your override block is a RED test. New colours go
    into `TOKENS` (and therefore into `EXPECTED_TOKENS` in that test, in the same commit).
  * `:root exact set` reads only the **first** `:root {…}` block. Put the high-contrast overrides
    in their **own selector block** (e.g. `body.be-high-contrast { --be-bone: …; }`) — do not add
    vars to the first `:root`, and do not put the new tokens in the first `:root` either.
  * `test/unit/ui_theme_source.test.js` + `scripts/check_theme_backticks.js` +
    `test/unit/css_template_backticks.test.js`: **no stray backtick inside the `THEME_CSS`
    template literal** — including inside CSS comments. That trap has bitten this file three
    times; write comments with no backticks at all.
- `js/print_styles.js` (1878 lines) — generates the injected `@media print` CSS. AC-3 lives here
  and/or in the theme's print block: whatever the high-contrast mode changes on screen must still
  be true on paper. Read line 51 (`@media print {` assembly) and the
  `[data-print-disabled="true"]` rule at line 32 as the precedent for a print-time hook.

**The panel (AC-1):**
- `js/controls.js` — `buttons` array (the rows; each carries `label`, `title`, `iconKey`, `tray`,
  optional `id`, `kind`, `action`) and `trayDefs` (line 405). The `Print settings` row at ~247 and
  the `Export/Import Settings` rows at ~262–282 are your closest structural precedent. Read the
  232px tray constraint comments before choosing the label.
- `js/modals.js` — `__createModal` (line 844) is the modal primitive; `showPrintSettingsSurface()`
  in `js/controls.js` is a complete worked example of a tray row opening a themed modal with a
  body builder and an `actionsRow`.
- `js/ui_theme.js` — the modal skin already exists; a new control inside it inherits the tokens.
  If you need new component styling, it goes in `THEME_CSS` (the house rule: the theme layer is
  the single writer of the surface language), never inline at the call site.
- `js/properties_panel.js` — carries the house pattern for a real checkbox toggle
  (`compactToggle`, line 426) with a label row; note it currently uses inline `style.fontSize`
  and a literal `#ccc` colour — do NOT copy that style; themed classes are the standard the theme
  layer enforces.

**Persistence (AC-1's "settings" + AC-3):**
- `js/ai_settings.js` — the `chrome.storage.local` record precedent (`be.ai`), including the
  comment block on why call-time resolution matters and why a stubbed store once hid a dead
  feature. Mirror that discipline.
- `js/controls.js` `hintStore()` / `hintDismissed()` (~line 1050–1110) — the read-through pattern
  with an explicit "an empty store is not proof the user never chose" rule. Your pref record needs
  the same care: a store that answers empty must NOT read as "high contrast is off forever" for a
  user who turned it on under a fallback.

**The e2e harness (AC-2, AC-3, AC-4):**
- `test/browser_e2e/_helpers/dom.js` — `launchExtensionContext` / `bootPage` / `reinject`. **The
  injected file list is PARSED OUT OF `js/background.js`** (line 30: it scans that array for
  single-quoted tokens). Consequence, recorded in `js/background.js` itself: **no quote marks of
  any kind inside comments in that file** — a stray quote becomes a bogus "file" and every e2e
  boot dies with "Could not load file".
- `test/browser_e2e/_helpers/inject.js` (2415 lines) — `contentCall(ctx, name, args)` runs a probe
  in the extension's isolated world; `CONTENT_PROBE_NAMES` at line 16 is the registry. A new probe
  must be added there and to the dispatch. Read the BEYOND-10 `refineBorder` probe (~line 555 and
  the `window.__AI_E2E` state note at ~786) as the closest worked example.
- `test/browser_e2e/layer_print_visibility.spec.js` — BEYOND-9's spec. **The AC-2/AC-3
  measurement vehicle you should copy**: it uses `page.emulateMedia({ media: "print" })` +
  `getComputedStyle` to assert what a printed layer actually renders, instead of grepping
  stylesheet text. Its 14 cases pass at HEAD.
- `test/browser_e2e/print_output_audit.spec.js` — the repo's PDF measurement suite, with
  `_helpers/pdf.js` (`measurePdf`) and the pdf.js rasteriser. **THREE WARNINGS in its header are
  binding if you use it**: (1) NEVER call `page.emulateMedia({media:"screen"})` (or `null`) before
  `page.pdf()` — it makes `page.pdf()` skip the `@media print` stylesheet entirely and you measure
  the screen layout; (2) there is no poppler/ghostscript on this host — the rasteriser is pdf.js;
  (3) a print measurement is only valid if the media type was never pinned.
- **ONE SPEC FILE PER MOCHA PROCESS.** Two e2e spec files in one mocha process break
  `reinject()` after `page.reload()` (measured, BEYOND-9; all 5 reload cases failed batched, each
  file alone passes). The project's `package.json` scripts already run one spec per process.
- `test/browser_e2e/spec_inventory.json` + `spec_pending.json` — regenerate with
  `node scripts/gen_spec_inventory.js` after adding the new spec (`--reload`-free; the pending map
  needs a real `--reporter json` run, so `spec_pending.json` may legitimately be left as collected
  if you cannot produce one — say which you did).

**Gates and inventory:**
- `scripts/border_refine_gdetect.js` — **the exact shape your G-CONTRAST script should take**: a
  header stating the claim and the pass rule, Playwright Chromium dialing, `pngjs` pixel reads,
  a `report.json` + artifacts under `temp/visual_logs/`, `main()` wired to argv, `process.exit`
  with the verdict. Read it before writing yours.
- `TECH_DEBT_SCRIPTS.md` — a NEW tracked script owes a row (purpose / invocation / deps / risk)
  and the executable bit (`git update-index --chmod=+x scripts/<file>.js`). See commit `5684221`
  for the exact shape. `npm run lint` runs `scripts/check_scripts_hygiene.js`, which enforces it.
- `test/unit/injected_scope_collision.test.js` (5 cases, BEYOND-10's guard) — **if you add a new
  injected module, every top-level binding in it must be uniquely named.** The injected files
  share ONE global scope as classic scripts; a `const state` in your new file killed `js/dnd.js`
  at parse time in BEYOND-10 and presented as a 60s boot timeout. Run this guard.
- `test/unit/dead_exports.test.js` + `scripts/check_dead_exports.js` — a new module's exports must
  be live or retired, not allowlisted (BEYOND-10 retired two genuinely dead exports rather than
  allowlist them).
- `test/unit/encapsulation_debt/debt_harness.js` — **mirrors the extension's own script order.**
  A new injected file must be added there too, in the position it occupies in
  `js/background.js`'s file list.

## Prior art — match this quality bar

- `conductor/archive/beyond10_ai_border_refine_loop/` — the previous card (spec/plan/metadata +
  `deliberation/` + verification + final_report). Its §8 "what the first record got wrong" is the
  honest-record standard: a session that misdiagnosed a host failure and later falsified its own
  claim in writing. Its `metadata.json` shows the `evidence` block shape the sweep uses.
- `conductor/archive/state-feedback-be19/` — the house example the template points at.
- `vendor/conductor/workflow.md` — the deliberation rule: `"deliberation": "required"` in
  `metadata.json` at creation; a single-answer decision is recorded as an **inadmissible
  candidate** rather than padded with a straw rival; no retro-declaration.

## WHAT REMAINS — in this order

1. **Track record FIRST**: `conductor/tracks/beyond11_high_contrast_a11y/` — `spec.md` (card
   verbatim + the five ACs + the measured premises above, including the stale one), `plan.md`
   (steps, verification vehicles, checkpoints), `metadata.json` (`"deliberation": "required"`,
   `parent`/`tracked_issue` = BEYOND-11), `deliberation/` (candidates + `evaluation_matrix.md` +
   `counterfactual_ledger.md`).
2. **Reproduce the gap before touching `js/`** — three RED proofs, recorded verbatim:
   a. the grep that finds no high-contrast surface (`grep -rin "high.contrast" js/` → 0);
   b. the font-size/geometry fact that no tray row or modal offers the toggle (name the row ids
      that DO exist in the OUTPUT tray);
   c. the contrast audit: run the orchestrator's probe
      (`python conductor/tracks/orchestrator_backlog_sweep_20261101/scripts/contrast_probe.py`)
      AND, once your G-CONTRAST script exists, its
      RED run against the current tree — a gate that has never failed is not evidence.
   TDD where it is behavioral: write the new spec case first and watch it fail for the RIGHT
   reason (no control / no `body.be-high-contrast` / no restored pref), not a selector typo.
3. **Implement**, scoped: high-contrast token set + override block in `js/ui_theme.js`; the
   toggle row in the OUTPUT tray (`js/controls.js`) with its pref record (call-time
   `chrome.storage.local` + `localStorage` fallback) and the body class that turns the mode on;
   the print-time half in `js/print_styles.js` (AC-3); theme the new control in `THEME_CSS`. Keep
   `js/background.js`'s file list and the debt harness in step if you add a module (and remember:
   **no quote characters in comments in `js/background.js`**).
4. **AC-4**: the new spec `test/browser_e2e/high_contrast_accessibility.spec.js` — real Chromium,
   real boot, no stubs. It must cover: the toggle exists and is reachable; turning it on changes
   the measured rendered contrast; the pref survives a reload (one spec process, one `reinject()`);
   the print-media reading still clears the floor; and off restores the base theme exactly.
   Regenerate the inventory.
5. **AC-5**: `scripts/high_contrast_gcontrast.js` — measures, states its rule in code, writes
   `report.json`, exits non-zero on failure, and refuses to report a pass when it measured nothing.
   Register it in `TECH_DEBT_SCRIPTS.md` + executable bit.
6. **Gates** — exact commands and exact counts, before and after, in `verification.md` and your
   report: `npm run lint`; `node --check` on every touched `js/` file;
   `npx mocha test/unit/ui_theme.test.js test/unit/ui_theme_source.test.js --reporter dot`;
   the new guard suites you touched; the new spec in its own process
   (`npx mocha test/browser_e2e/high_contrast_accessibility.spec.js --timeout 900000 --reporter spec`);
   `npx mocha test/browser_e2e/layer_print_visibility.spec.js` as an untouched control (14/14 at
   HEAD — it must stay green, your work touches the same theme the print path reads);
   `npm test` (composite). **KNOWN BASELINE: `test/unit/input_budget_alignment.test.js` has 2
   PRE-EXISTING failures (framework findings F4/F8), proven on a clean tree — do not chase them,
   do not count them as yours.** `PYTHONDONTWRITEBYTECODE=1 python vendor/housekeeping_guard.py
   check` must read OK with deliberation ADMITTED.
7. **Commits — LOCAL ONLY, never push.** Commit A (product + spec + gate script + the unit-test
   updates the token set forces) and Commit B (the track record). Record both SHAs; the evidence
   chain needs the IMPLEMENTATION commit's own tree (BEYOND-9/10 both measured the AT-26
   tree-mismatch refusal when the head tree was cited instead).
8. **Close-out**: flip `plan.md` checkboxes to `[x]`, write `verification.md` + `final_report.md`
   under the track dir, then ARCHIVE the track to
   `conductor/archive/beyond11_high_contrast_a11y/`.
9. **Orchestrator report** (mandatory):
   `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase2b_be11.md` — per AC:
   already-shipped vs real gap (file:line evidence), what you changed, architecture decisions (the
   token-set shape, the override selector, the pref record's name and read-through rule, the gate's
   pass rule), plan amendments, struggles with cumulative measured results, knowledge for future
   sessions, final gate results with exact commands and counts, both SHAs, and the G-CONTRAST
   per-pair numbers.
10. **Token handoff**: this card is bigger than BEYOND-9. If you go YELLOW (looping, ~120k+ tokens,
    no verdict, or two failed attempts on the same target), STOP and write
    `conductor/tracks/orchestrator_backlog_sweep_20261101/handoffs/phase2b_be11.md` with: the exact
    tree state, everything tried with measured results (cumulative — the Muse-First rule), what the
    next attempt should be and why, the ACs still unmet, and the files a successor must read first.
    Do not degrade quality to finish.

## HARD RULES (restated)

- Real tests only. Never modify production code to make a test pass — a real test exposing a real
  defect is a recorded blocker (`BLOCKED_PRODUCTION_DEFECT`).
- No stubs in e2e; the isolated-world `window.*` seams are the product's own code.
- **`git push` never.** Local commits only.
- Do NOT edit `vendor/` (drift_check must stay green) and do NOT call `vendor/youtrack/*.py`
  writers — the tracker close is the orchestrator's act with verifier evidence.
- Other projects' trees are read-only; findings about them go to THEIR `temp/issues/`.
- The housekeeping guard must stay green: any `temp/issues/*.md` you create needs a
  `**Status:**` line; `PYTHONDONTWRITEBYTECODE=1` when importing `vendor/` modules.
- 6 identical failures on one target → STOP, consult Muse (`vendor/.reasonix/skills/muse-loop` or
  `conductor-with-refactor`) with the CUMULATIVE approach list, record the exchange and its
  per-approach dispositions, THEN attempt the 7th. Never iterate silently.
- This project's e2e harness boots a real D&D Beyond sheet in Chromium. If the harness cannot
  boot HERE, that is a STRUGGLE to report with the exact failure — never fake an e2e result; fall
  back to unit-level contract tests and say plainly which vehicle ran.

Begin: create the track record, then reproduce the gap (all three RED proofs), then fix.
