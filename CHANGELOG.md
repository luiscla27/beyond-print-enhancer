# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **On a short section the action bar no longer covers the centred grip — the bar yields.**
  `section-extra-tidbits-wrapper` (151×62) was the 2.0.1 census failure recorded under Known issues
  below: the bar carries an inline `z-index: 1000000` (`js/main.js:2512`, via `window.Z.ACTIONS_BAR`)
  against the grip's 700002, so on a section short enough for the bar's band to reach the vertical
  centre the revealed buttons sat ON the drag area and a press there landed on
  `be-select-section-button` instead of the grip. `js/print_styles.js` now drops the bar to
  `700001` on exactly the arms that reveal the grip (`.be-active-layer` + `:hover` /
  `:focus-within` on the wrapper, `!important` because an inline level outranks a non-important
  stylesheet rule), so inside the hovered wrapper's own stacking context the ladder reads
  hover-raise 700000 < yielded bar 700001 < grip 700002: the grip wins its own pixel, the bar stays
  fully revealed and usable, and with the grip off screen nothing has moved at all. Two
  alternatives were implemented and MEASURED on the live sheet before this one was kept — hoisting
  the grip over the bar also reaches 22/22 but covers 60% of the Select button including its own
  centre, and nudging the grip clear of the bar puts it 10px off the literal centre the grip was
  promised at. The census assertion no longer allows any exception (it asserts
  `grabbed === probeable`, and `KNOWN_BAR_OVERLAP_EXCEPTIONS` is deleted), and its follow-up block
  checks what the yield must NOT cost: the bar still revealed, `barZ < gripZ`, the Select button
  still reachable at a point of its own box. `test/unit/hover_refactor.test.js` pins the ladder
  (falsified against the pre-fix pair) and adds a LOCKSTEP case that parses the grip reveal's
  selector arms out of `js/dnd.js` and the yield's out of `js/print_styles.js` and requires the two
  sets to be EQUAL — the one check that keeps "the grip is shown" and "the bar has yielded" from
  ever becoming two definitions of one fact. Measured: census 21/22 → **22/22**; the three
  Option-3 browser suites (`affordance_drag_hover_shadows`, `lock_handle_visibility`,
  `drag_glow_layers`) **19 passing / 0 failing**. Reported and resolved in
  `temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md` (option 3 chosen
  by the operator; Muse consulted on the loop, all five of his suggestions dispositioned there).
- **The grip no longer sits on top of a short section's action-bar button.** The residual the entry
  above left behind — the yield fixed the stacking and nothing else could — was pure geometry: on
  `section-extra-tidbits-wrapper` (151×62) the grip's 34×26 plate is centred at (75.8, 31) and the
  🎯 Select button's 39×32 box at (74.5, 24), so the two centres are 1.3px apart across and 7px down
  and the boxes overlap over 34×22 = 60% of the button, INCLUDING its centre. Whoever is stacked on
  top takes the other one's centre pixel, which is why hoisting the grip and yielding the bar produced
  the same residual. The fix shrinks the grip's plate to the box its nine dots actually paint
  (18×18 — a 12px `gripVertical` glyph plus a 3px ring, so the pointer never reaches further than the
  user can see) and steps it off any control centre it would swallow. Both come from a MEASUREMENT,
  not a constant: `gripBandFor` in `js/dnd.js` is handed the wrapper's box and the boxes of the
  controls inside it (the action bar's buttons, the rotation handle, the resize handle — exactly the
  nodes `isInteractiveTarget` refuses) and scores its candidates (1) no control loses its centre,
  (2) the smallest step from the wrapper's middle, (3) the least box area covered; on the measured
  section that pays **4px of shift, not 22**, and the plate lands at (66.75, 26) 18×18 — the button's
  centre comes back to the button and 20% of its bottom edge stays the grip's.
  `measureGripBands` runs it per wrapper and writes the answer as three custom properties on the
  handle, with the shipped 34×26/zero-shift as the stylesheet's FALLBACKS, so a wrapper that never
  collides is not touched at all: on the live sheet **1 of 22 sections bands** and 21 paint exactly
  what 2.0.1 painted. The decision follows the geometry rather than a call site — a `ResizeObserver`
  is subscribed to every box the pass reads (the layout root's own size does not change when one
  section resizes, and an absolutely-positioned bar that wraps to a second row does not grow its
  wrapper), including a control the cascade hides with `display:none` — a locked layer's rotate/resize
  handle has no box to reason about but is exactly what appears over the centre when the user unlocks,
  and starting to render is the only notification such an element can send (measured in Chromium:
  `0x0` while hidden, then a real box on unlock). The pass is coalesced into a frame because
  `fitContainer` writes a transform inside the boxes it watches, it is re-armed by `cleanupDrag`
  because it refuses to run while `body.be-dragging` is up, and it RELEASES whatever a pass no longer
  reads (`unobserve`) because an observer pins its targets for the life of the tab — otherwise every
  section deleted from the sheet, and every button of every bar the paints rebuild, would leak.
  The offset rides on `translate`, not `top`: with `inset:0; margin:auto`
  both edges are pinned, so a written `top` is split with the leftover space (measured: `top:
  calc(50% + 9px)` rendered at y 38, not 40). Options ruled out with pixels before this was written:
  a transparent `::after` over the dots takes hits but the plate still wins `elementFromPoint`
  THROUGH it, so it buys the button nothing; `clip-path` trims honestly but only a clipped element's
  own border-box, i.e. it is exactly "shrink the plate" — which is what this is.
  `test/unit/grip_geometry.test.js` (10 cases) pins the rule and the cascade, starting from a case that
  reproduces the reported collision from the issue's own numbers so the fixture cannot rot, and
  falsifying the 80px-height estimate with a 104px two-row bar that an 80px rule calls safe. Two of
  them run against a fake observer that counts subscriptions — the only way to see that a deleted
  section releases its boxes, or that a hidden control is watched without being counted — and both
  were falsified (a short-circuited release, and moving the two watch calls below the hidden-skip)
  before being reverted.
  `test/browser_e2e/affordance_drag_hover_shadows.spec.js` now ASSERTS the pixel it previously
  documented as unobtainable — `buttonOwnsItsCentre`, alongside the grip still winning its own
  (smaller) centre and staying inside its wrapper — and the census stays at 22/22. Reported and
  resolved in `temp/archived/ISSUE_grip_box_overlaps_actions_bar_on_short_sections_20260914.md`.

### Known issues
- **The per-section "Auto-scale to fit" switch does nothing until the section is resized, and two
  scaling cases still pin the pre-floor scale — filed, not fixed, and PRE-EXISTING (unrelated to the
  affordances above; found by running the whole suite).** `initResponsiveScaling()` is idempotent
  and `updateLayoutBounds()` does not change a section's content box, so the properties panel's
  toggle never schedules the re-measure that the observer's size record then suppresses
  (`js/main.js:1884,1958`, `js/properties_panel.js:467-475`); and
  `test/unit/responsive_scaling.test.js` expects `scale(0.5)` / `scale(0.25)` where the shipped
  `MIN_SCALE_FLOOR = 0.60` returns `0.6` — **6 passing / 3 failing** on a clean HEAD, reproducible
  with one mocha command and proven pre-existing by stashing this diff. Fix options, and why the
  third failure is a real defect rather than a stale number:
  `temp/issues/ISSUE_scaling_offswitch_no_remeasure_and_stale_floor_expectations_20260914.md`.

## [2.0.1] - 2026-09-14

### Changed
- **Hovering a section no longer washes it in green.** A hovered, draggable section used to carry
  `filter: drop-shadow(0 0 15px #28a745)` twice, animated over 300ms. A `filter` on the wrapper
  repaints the whole subtree — every border, background and piece of artwork in the section — so it
  did not decorate the section, it washed it. The rule is deleted; the stacking raise it shared a
  block with (`z-index: 700000`) stays, because that is the part other rules depend on and it costs
  nothing to paint.
- **Dragging is now done from a handle, not from anywhere.** `button.be-drag-handle` — a nine-dot
  grip (`Icons.svg("gripVertical", 12)`, a new entry in the existing 16px icon set, filled circles so
  a 12px render reads as dots and not rings) — sits at the **centre of each section**, is revealed
  only on the active layer, and is the one control the drag engine accepts as a grab target
  (`isInteractiveTarget` would otherwise have refused it as a `button`; the exemption is checked
  first, so there is exactly one statement of which control is the handle). Invisible *and*
  unhittable at rest — `visibility`, not `opacity`, so it cannot be tabbed to, clicked through, or
  read out by assistive tech — hidden on locked layers, hidden while a drag is held, hidden in print,
  and excluded from the sheet's hue-rotate filters so a recoloured section cannot carry the grip off
  palette.
- **`#print-enhance-controls` casts no shadow.** Four separate declarations piled blurred black onto
  that one panel, each `!important`, so the last one in the sheet won and calming any earlier one
  changed nothing — including an inline `boxShadow` in `js/controls.js` that outranked everything the
  theme layer tried to do about it. All four are gone for this panel. What it keeps is not shadow:
  a `box-shadow` with zero offset-blur is a **frame**, so the blind-tool ring, the leather border, the
  inner hairline and the corner marks of the ornament treatment all stand. The layer manager keeps
  its lift — it was not part of the complaint, and a fix aimed at one tray must not re-tier the pair.

### Fixed
- **Section action buttons appear on the ACTIVE layer only.** `be-section-actions` used to reveal on
  hover for *every* section, "regardless of their status": two of the three reveal rules keyed off the
  LOCK state (`.be-layer-locked`, and `body[class*="be-lock-"]` which is true whenever any layer is
  locked — and this product keeps every layer but one locked), so between them they matched almost
  everywhere. Both are deleted and `.be-active-layer` is now the single mechanism. Because that class
  is written independently of `isLocked`, an active-and-locked layer still reveals its bar, so the
  reachability the deleted rules were written for (a locked layer's own unlock control) is preserved.
- **…and a hidden action bar is no longer clickable.** The bar is created with an inline
  `pointerEvents = "all"`, which outranks a *non-important* stylesheet rule at any specificity, so the
  rest-state `pointer-events: none` did nothing: every inactive section carried invisible 25×32px dead
  buttons over its content, eating clicks. The rest-state rule is now `!important`.

### Internal
- **The backtick-in-a-CSS-comment trap now has a guard that covers every module, not one.** Three of
  this project's files were simultaneously broken by the same mistake while this work was in
  progress: a backtick inside a CSS comment inside the template literal that emits the stylesheet
  *terminates the literal*, so the module throws a `SyntaxError` at load in the browser, with a
  message pointing at prose. `scripts/check_theme_backticks.js` already existed for that hazard but
  only for `js/ui_theme.js`. `test/unit/js_source_syntax.test.js` compiles every file under `js/`
  (parse-only, so no boot code runs), asserts the four stylesheet-injecting modules it exists for are
  actually in the walk so it cannot pass vacuously, and carries a planted copy of the defect to prove
  it reports it.
- **Browser coverage for the three affordances above, added after the release (no version bump — it
  changes no product code, so it belongs to 2.0.1's behaviour rather than to a new one).**
  `test/browser_e2e/affordance_drag_hover_shadows.spec.js` drives a real MV3 extension in Chromium at
  the pinned `SHEET_VIEWPORT` 1920×1080 and covers everything the unit suite structurally cannot: a
  COMPUTED `box-shadow` on the composed page rather than a grep of the emitted CSS, a revealed grip
  probed with a real pointer at its own pixel, and the `:hover` reveal of `.be-section-actions` on the
  active layer versus its absence on a locked one. 13 cases, all green.
  The hue-isolation case calls the product's own seam,
  `test/browser_e2e/_helpers/inject.js` → `setGlobalFilters`, because `window.applyGlobalFilters`
  lives in the extension's ISOLATED world and is invisible to `page.evaluate` — MEASURED: a direct
  call there was `undefined` and the case failed on its own vacuity guard while the product was
  correct. The suite is runnable by name as `npm run test:e2e:affordances`, which raises the pinned
  per-file roster in `test/unit/e2e_plumbing_guard.test.js` from 37 to 38 (the reason is recorded
  there: 13 cases at ~32 s is a 7-minute run worth naming while iterating on the affordances, exactly
  like `test:e2e:glow` beside it). `test/browser_e2e/spec_inventory.json` is regenerated to match —
  69 spec files / 289 collected tests (was 68 / 276) — verified collection-only, without executing a
  browser case, since the gate runner diffs this manifest against the live enumeration.
- **A grip-reachability CENSUS instead of a first-candidate assertion.** The suite walks every
  active-layer section, hides the non-test layers through the panel's own "Hide on sheet" control, and
  counts how many revealed grips win the hit test at their own centre: **21 of 22**. The one that does
  not is recorded rather than hidden — see Known issues.
  Four of the 13 cases carry a conditional `this.skip()` when the live host sheet offers no reachable
  candidate for them (no locked-and-not-active section, no second layer row to flip); that is the
  existing practice across 24 of this suite's spec files, and it is why the pending map
  (`spec_pending.json`) is deliberately untouched — those skips are runtime host conditions, not
  flag-gated captures, so they never enter it.

### Known issues
- **On a section short enough for its action bar to reach the centre, the bar covers the grip —
  filed, not fixed.** `section-extra-tidbits-wrapper` (151×62) fails the census above: the bar carries
  an inline `z-index: 1000000` (`js/main.js:2512`, via `window.Z.ACTIONS_BAR`) and the grip 700002
  (`js/dnd.js`), so on a small section the revealed buttons sit ON the drag area and a press there
  lands on `be-select-section-button` instead of the grip. This is a real regression in reachability
  introduced by the 2.0.1 grip — the grip's pixel used to be section content, which drags — so it is
  recorded honestly rather than asserted away:
  `temp/archived/ISSUE_grip_covered_by_actions_bar_on_small_sections_20260914.md` (three concrete fix
  options, all re-stacking, none attempted here — **option 3 was taken after this release; see
  [Unreleased]**). The census assertion is a **ratchet on the count**
  (`KNOWN_BAR_OVERLAP_EXCEPTIONS = 1`) with the miss list printed, so a stacking regression that makes
  ordinary section content beat the grip blows far past the bound and goes red.


## [2.0.0] - 2026-09-14

### Added
- **A property surface the extension actually owns.** The `1.4.3` extraction of `js/main.js` into
  named modules is the basis for everything above it, and `1.4.8` puts the properties panel on top:
  a pixel font-size slider (8–30px), compact mode, and border style, all live-synced to the active
  section.
- **Real shape layers.** Shapes behave as layers (`1.4.6`, `1.4.18`): split and move flows, a flat
  restackable stack, chip multi-select with batch operations, glow wrappers that drag as one unit,
  uploads from disk that keep their context (`1.4.20`), and per-layer print output (`1.4.7`).
- **A general undo, and a recoverable path for every destructive action** (`1.4.13`, `1.4.14`). One
  reversible-mutation contract — declared once, and loud when a mutation does not declare itself —
  plus a snapshot gate and a newest-first restore surface so a destructive action is recoverable
  after the fact, not only undoable before it.
- **A browser gate that runs by itself** (`1.4.28`): a Playwright suite covering every shipped
  surface (`1.4.10`, 75 specs) turned into a collection-bound, cause-bound gate that refuses to
  overlap, alongside the lint, unit and print-output gates.
- **Evidence, not opinions.** Every criterion above is gated on captured frames or measurements,
  committed under `vendor/docs/` per track.

### Changed
- **`js/main.js` is no longer the application.** Twenty-one modules now own what used to be one
  file; `js/main.js` keeps the boot sequence and the wiring, and the load order is asserted by a
  test rather than by convention.
- **The interface is rebuilt against a token layer** (`1.4.12`) and then re-skinned as "3.5 Codex on
  the Workbench" — engraved display type, blind-tooled band ornament — instead of starting from
  browser defaults and patching them.
- **Drag & drop is a pointer-events engine** (`1.4.9`) with live grid snap, alignment guides, lock
  cursors, clamped always-completing drops, arrow-key nudge and numeric position fields.
- **The picker is one shell** (`1.4.19`) shared by every surface, with grouped families, live
  search, and OK disabled until there is a genuine selection.
- **Modals are ours** (`1.4.15`): 16 native `confirm`/`alert`/`prompt` call sites — 10 of them
  destructive — moved onto a single shared primitive, so the extension asks the user, not the
  browser.
- **The printed sheet is text, not an image of text** (`1.4.27`, 0 → 11,632 characters of real text
  layer), and the extension's own notices no longer print onto the page.

### Fixed
- **Sections that do not fit are scaled into view instead of clipped.** The responsive scaler built
  a `ResizeObserver` and never called `observe()` — measured on the default demo sheet, 8 of 22
  sections overflowed and their content was silently cut off by `overflow: hidden`; ~1,600px of
  content is recovered (`1.4.29`).
- **Panel and header defects from the UX review** (`1.4.17`): unreachable panel bottoms, headers
  that wrapped at every other width, and a slider modal that leaked its `keydown` listener on a
  mouse close.
- **The print layout no longer hides content or the layer manager** (`1.4.7`).

### Notes
- **The 1.4.x numbering is this line's patch chain, not upstream history.** It renumbers the work
  that followed `1.4.2` — the tracks that were originally released as `1.6.0`–`1.17.3` — so the
  sequence is monotonic and every step is a patch. The feature set is the one described above.
- **Nothing outside the extension is tracked.** The self-maintenance harness this project was
  scaffolded with, the runtime unit it pins, its pin file and the gates and reviewer transcripts
  that only police that harness are gitignored (see `.gitignore`), as is `temp/`. They remain on
  disk and the harness still works against them; they are simply not this project's history.

## [1.17.3] - 2026-09-13

### Fixed
- **A section that is too tall for its box now shrinks to fit instead of losing content.** The
  feature that does this has been in the product since it was scaffolded and had **never once run**:
  it built a `ResizeObserver`, wrote 35 lines of scaling logic, and never called `observe()` on it —
  and an observer that observes nothing never fires. Every section whose content was taller or wider
  than its box therefore had the overflow silently cut off (`.print-section-content` is
  `overflow: hidden`). Measured on the default layout of the real demo sheet: **8 of 22 sections
  overflowed**, the worst being Spells — 1,661 px of content in a 736 px box. Now **about 1,600 px of
  content that used to be cut off is scaled into view instead** (summed over those 8 sections), and the
  printed sheet carries **11,632 → 11,884 characters** of text. Still four US-Letter pages, still a
  real text layer, page count unchanged (`vendor/docs/responsive-scaling-wiring-20260913/`, with the
  before/after rasters of every page).
- **…and it keeps working as the sheet changes.** Sections do not exist when the extension boots —
  they are built afterwards, by the layout pass — so watching only what is on the page at startup
  would have left the feature as dead as it was. Sections created later are picked up, and editing a
  section's content re-measures it even when the section's own box did not move (an explicitly-sized
  section does not resize when its overflow grows, so the observer would otherwise never be told).

### Internal
- **The test that "covered" this feature proved a copy of the algorithm, not the product.**
  `test/unit/responsive_scaling.test.js` re-implemented the callback inside the test file and
  triggered *that*, so a missing `observe()` could not make it fail — the same vacuity class as the
  guard that checked the wrong root and the lint gate that had never run. It is rewritten to drive
  the **product's** callback through the **product's** own observer instance, asserting first that
  the wire exists at all. 2 → 8 cases.
- **The gate caught a second defect the wiring created, and this release fixes that too.** Shrinking
  a section compensates by widening its content, and it did so by writing an **inline width** — on
  `.print-section-content`, whose class name ends in `-content` and therefore MATCHES the selector the
  layout record reads (`innerWidths`). A value the FEATURE derived was being persisted as a USER width
  choice, replayed by `applyLayout` at every later sheet size, and restored by undo as something the
  user never set. The sharded browser gate found it as a red undo round trip
  (`innerWidths["0-0"]` `110.469% → 110.392%`, i.e. `100 / scale`); the compensation now travels as the
  `--be-scale` custom property, applied as a `min-width` rule keyed on the same `data-scaling`
  attribute, and a **RECORD SAFETY** unit case re-runs the scan's own selector and fails if scaling
  ever leaves a width there again. The 12-class undo suite is 12/12 in a real browser again.
- **A browser case now asserts the effect, so a missing wire cannot survive again.** New
  `test/browser_e2e/responsive_scaling.spec.js` (3 cases) checks the live sheet in Chromium: that the
  precondition holds (sections really do overflow — otherwise the suite proves nothing), that a
  section carries `data-scaling`, a scale in (0,1) and the top-left origin the CSS rule supplies, that
  the drawn box fits, and that no `ResizeObserver loop` page error was reported. The browser gate's
  inventory is regenerated for it (67 → 68 spec files, 273 → 276 collected).
- **Falsified at both layers, and with the loop guard shown to be load-bearing.** Removing the wiring
  fails 2 unit cases and the browser case (`{"containers":22,"scaledCount":0}` — a real browser sees
  an absent `observe()` with no mock involved); dropping the mutation pass fails 2 unit cases;
  removing the per-container size record fails the stability case. Each plant was watched failing and
  then reverted.
- **Filed for its own decision, not silently tuned:** Spells now scales to **0.443** on the default
  layout — it fits, and it is small on paper. A floor on the scale, or a per-section switch, is a
  product call that needs a legibility measurement rather than a hunch; the committed page rasters are
  the material for it. Filed as its own decision, with the measurements and the four options:
  `temp/issues/ISSUE_scaling_floor_spells_0443_20260913.md`. See §5 of the fix report.

## [1.17.2] - 2026-09-12

### Internal
- **The gates run by themselves now, and one command cannot miss them.** `npm test` runs **lint
  first**, then unit, integration and the manifest check — a `console.log` outside the logger exits
  non-zero and names the file and line. Before this, **nothing in the repository ran any gate except a
  person**: `.github/` held one file (`FUNDING.yml`, so no CI), no script invoked the suite, and
  `package.json` had no `pretest`. That is how the browser suite sat **22 cases red across several
  releases** while every always-run gate stayed green.
- **`eslint` now runs on the tree it lints — and it had never run on a single file.** The ratified
  `no-console` rule was documented as a hard failure and enforced by nothing; worse, the config could
  not express the tree (`js/` is not an ES-module tree, so the CommonJS guard alone produced 52 false
  `no-undef`). Measured: `js/` **145 → 0**, `test/` **6491 → 0**, `scripts/` **291 → 0**. The
  `no-console` rule itself would have PASSED on `js/` all along (**0 violations**), so that convention
  had been holding by review discipline, not by a gate.
- **Three product defects fell out of the first lint run**, two of them filed rather than silently
  fixed: responsive scaling is **inert** (its `ResizeObserver` is constructed and never `observe()`d,
  so the feature has never worked and its test asserts a *copy* of the logic instead of the wiring —
  `temp/issues/ISSUE_responsive_scaling_observer_never_observed_20260912.md` — **wired in 1.17.3, now
  archived to `temp/archived/`**), and
  `ENABLE_PREMADE_TEMPLATES` is a **dead feature flag** this CHANGELOG documents as controlling the
  Templates menu while nothing reads it
  (`temp/issues/ISSUE_dead_feature_flag_premade_templates_20260912.md` — the flag WAS removed by this
  track's Phase 1; the report was only left marked OPEN, and it is archived now too). Three
  `if (<string>)` guards
  left by the selector refactor were conditions that could never fail; they were rewritten to the
  branch that was always taken, which is behaviour-preserving.
- **The browser gate exists, and it cannot pass by skipping.** `npm run test:browser-gate` (and, once
  the operator registers it, a scheduled task) runs the real extension in Chromium and writes a
  machine-readable artifact. It **fails** — with no green artifact — if a spec file drops out of
  collection (naming it), if the pending set stops matching its committed cause map, if collection is
  **empty**, if any case fails, if another run holds the guard file, or if the executed set does not
  account for the collected set. The exit code is derived from collection *and* execution, so "the
  script finished" is not a pass.
- **Sharded runs are set-identical, not just faster.** 4 shards diffed case-by-case against one full
  serial run: same passing, same failing, same pending. Measured **88.5 min serial → 23.4 min sharded
  (3.78×)**; the bound is the demo host and disk, not CPU, and the `[boot] tolerated` host marker is
  carried in every artifact as the canary.
- **It found a regression on its first unsupervised run**, which is the best argument for it existing:
  a lint edit had deleted a `page.evaluate` whose *call* was the test (it clicked "Add Shape"), so
  adding a shape by that path silently stopped working. Lint was clean *because* the deletion was a
  lint fix, `npm test` was green, and dead-export tracking saw nothing — only a browser run could
  tell.


### Fixed
- **Your printed sheet is now real text you can search, copy and select.** It was being printed as
  **images**: the whole PDF carried **zero** text and just 17 vector paths for four pages, so
  "Shillelagh" was not findable in the printout and nothing could be copied out of it. The cause was
  measured: the tool wrote its filter chains as CSS custom properties on `:root`, and at the default
  settings those chains were *identity* filter strings (`hue-rotate(0deg)`,
  `contrast(100%) saturate(100%) …`) — an identity filter is still a filter, so Chromium rasterised
  every section. Neutral chains are now written as `none`. Measured on the live sheet: **0 → 3,263
  text-showing operators, 0 → 11,632 characters, 17 → 12,613 vector paths.**
- **Your own filter settings still reach the paper, exactly as before.** A filter that can change a
  pixel is emitted verbatim, so the fix is invisible unless every part of a chain is provably a no-op —
  including the default Greyscale of 100%, which is *not* a no-op and would have un-greyed the
  ornaments had the fix been written as "all sliders at their defaults". Verified with the panel's own
  sliders: setting Greyscale to 0% puts colour on the paper, setting Hue to 90 rotates it, and putting
  them back gives a byte-identical file to the default run.

### Internal
- Also fixed while verifying: running the print-audit suite *without* its flag overwrote its own
  committed evidence (`vendor/docs/print-output-audit-20260911/measurements.json`) with `{}`, because mocha
  still runs an `after` hook for a skipped suite. The write is guarded now, and a skipped run is
  proven to leave the file untouched.
- The print audit's last case used to *record* the sheet's operator inventory and deliberately not
  assert it, because a suite requiring `textOps === 0` would have failed this fix for fixing it. It now
  **requires** the text layer (`textOps > 0 && chars > 1000`), so a regression that starts rasterising
  the sheet fails the audit instead of being discovered in the next one. Cause pinned at unit level by
  `test/unit/print_identity_filters.test.js` (7 cases; 4 of them fail against the pre-fix code).
- A second self-skipping probe measures what the audit cannot: whether a chain with every filter
  slider at its DEFAULT value is really neutral, and whether a setting the user makes still reaches
  the paper. It drives the panel's own sliders and asserts both:
  `PRINT_FILTER_PROBE=1 npx mocha test/browser_e2e/print_filter_identity_probe.spec.js`.
- `vendor/docs/print-sheet-text-layer-20260911/FIX_REPORT.md` carries the before/after numbers, the two
  candidate rules measured against each other, and the limits this fix states rather than hides
  (the file is *bigger* now — 5.98 MB → 8.08 MB — and a filtered sheet is still rasterised).
- **The one item the gate track left to the operator is now assigned in writing, to the project that
  owns the fleet's Task Scheduler surface.** Handoff filed 2026-09-13 to that project's issue inbox:
  author the wrapper script there and register the browser-gate task as a **SYSTEM** task
  (operator's choice, a deliberate
  override of the "run only when user is logged on" shape our own fragment recommends), daily, 2 h
  limit, wrapper **must** set `PLAYWRIGHT_BROWSERS_PATH` (a SYSTEM task's `%USERPROFILE%` is the
  systemprofile, so Playwright's browsers would otherwise not be found). Nothing on our side runs or
  registers anything — the no-manual-deploy rule stands — and **the schedule is still absent until ORCH
  reports a green first run** (verified in both places: `LastTaskResult` *and* a
  `green`/`collection.status: ok`/`execution.status: pass` artifact, with a documented fallback to the
  interactive logon type if session 0 cannot launch Chromium). The annotation in
  `vendor/conductor/archive/gate_coverage_20260912/final_report.md` §6.1 records this against the open item it
  leaves standing, and `temp/scratch/probe_handoff_claims.py` checks every request-side fact the
  handoff asserts (26 checks, all pass).

## [1.17.1] - 2026-09-11

### Fixed
- **The tool's own messages no longer print onto your sheet.** If a notice was on screen when you
  printed — the "No saved layout yet" note after a fresh load, a save confirmation, an undo offer, an
  error — it was printed at the top of **every page**, because the notice is pinned to the window and
  the print stylesheet never hid it. Measured on the real printed output: that sentence was the only
  text in the whole PDF, on all four pages. The same gap meant a dialog left open would print its dark
  backdrop over every page. All of the tool's own surfaces are now hidden when printing.
- The print stylesheet hid exactly one dialog **by its id**, which only one dialog in the product
  carries; every other dialog was hidden by luck rather than by rule. They are now hidden by their
  shared class, so a dialog added tomorrow cannot print over a sheet.

### Internal
- **The printed output is now looked at, not just described.** A new gated suite prints the live
  sheet through the real extension and measures the PDF the printer receives — page box, where the
  ink actually sits on the page, per-page coverage, and what the file carries — so "does the printout
  look right" has an answer that is not a screenshot of the page it came from. It found the defect
  above on its first run, and reports (without asserting) that the sheet reaches the paper as images
  rather than text, which is filed separately. Reading a PDF back to pixels needs a rasteriser and
  this machine has none (no poppler, no ghostscript, no ImageMagick; `sharp`'s libvips has no PDF
  input, and headless Chromium downloads a PDF instead of rendering it), so `pdfjs-dist` is pinned as
  a devDependency and driven in a page served by a dependency-free static server.
- The margins claim of the README is re-confirmed on the printed page rather than on the file size,
  with a control proving the measurement can see a margin at all. The earlier track's "noise floor"
  of 37,200 bytes is corrected: that was the boot notice disappearing between two renders, not PDF
  metadata noise.
- `vendor/docs/print-output-audit-20260911/audit_report.md` carries the method, the page-by-page numbers,
  the two visual-gate verdicts and the limits this audit states rather than hides.

## [1.15.1] - 2026-09-11

### Fixed
- **Rotating a shape and then undoing no longer re-applies the angle you just undid.** The undo
  record for a rotation was taken from a reading that could land *after* the rotation was written,
  so undoing it put the new angle back instead of the old one. The record is now taken from the
  value the shape had when the gesture started, which is what an undo is supposed to restore.

### Internal
- One capture-and-push protocol for the undo stack, where three copies (one a verbatim duplicate)
  had drifted apart; the shared helper now repairs a record taken mid-gesture, and a guard fails if
  a second implementation reappears.
- The mutation-class vocabulary is declared once, and an undeclared class is now reported instead
  of silently recorded as `unknown`.
- `js/persistence.js` (which owned the backup store, the undo stack, the restore surfaces and the
  destructive gate in 1,583 lines) is split into `js/undo.js`, `js/recovery_ui.js` and itself. No
  user-visible behaviour changes; the window-level seams keep their names.
- One destructive-gate helper, one logger and one z-index declaration instead of three, three and
  eleven scattered copies; `no-console` is now a lint error outside the logger.
- The browser test harness shares one capture helper across twelve specs, and the duplicated
  per-file npm scripts were retired. No product code is involved.

## [1.16.0] - 2026-09-11

### Added
- **A "?" in the control panel's header opens a gestures-and-shortcuts reference.** Until now the
  extension taught three gestures — drag to move, drag a corner to resize, use the handle to
  rotate — once, in a card that never came back, while its other interactions were discoverable
  only by accident: **double-click** a block to extract it, **right-click** a layer for its menu,
  and **Ctrl+Z / Cmd+Z** to undo. All of them, plus selecting and nudging, are now named in one
  place that is always a click away. It opens the extension's own dialog, so Escape, the close
  control and a click outside all dismiss it.
- **The undo control says how to undo from the keyboard.** `Ctrl+Z` / `Cmd+Z` has been bound for
  a while and was never announced anywhere in the interface.

### Changed
- **More restore points, and the two kinds of "go back" are now told apart.** The automatic
  backups taken before destructive actions kept only the **newest 3**; they keep the **newest
  10** now. The restore dialog says what they are for — the copies are saved in this browser, so
  they are still there after a reload — and the Undo control's tooltip says its history covers
  **the current session only**. They do different jobs and no longer look alike: Undo steps back
  through what you just did, the backups are where you go after a reload or for anything older.
- **The message shown when a change is refused is short enough to actually read.** It used to
  spend its first clause on an explanation; it now leads with what happened ("Nothing was
  changed"), names the cause, and ends with the next step. The full explanation — including why
  a delete needs a backup at all — is still there, in a dialog that stays open.

### Notes
- **One reported defect was withdrawn after measurement.** The project had recorded that a
  non-ASCII character in an injected script renders as mojibake, on the strength of an earlier
  visual capture. Measuring it in a real browser through the real injection path — the ellipsis
  itself, the degree sign, the emoji, the close glyph — showed every one of them rendering
  **correctly**, so the claim is retracted and nothing was changed for it. The record is in
  `vendor/conductor/tracks/ux_gaps_20260911/phase1_classification.md`.
- **The panel's layout was measured and deliberately left alone.** Print, both Save controls,
  Undo and Restore backup are already above the fold at the standard window size, and the
  occasional-use colour filters are below it. No control was moved.

## [1.17.0] - 2026-09-11

### Changed
- **The first-run card now points at the gestures reference instead of being a dead end.** The
  card teaches three gestures and, until now, its **only** control was its permanent dismiss — so
  the product's single moment of instruction ended by deleting itself, while five of the eight
  gestures the reference lists were taught nowhere at first contact. The card now carries a **?**
  (keyboard-reachable, on the icon height tier) that opens the same gestures-and-shortcuts dialog
  the panel header opens, and its sentence is **derived from that same list**, so the two surfaces
  cannot drift apart again. Its accessible name is now scoped to what it teaches
  (`"Three gestures to get started"`) rather than claiming to cover the sheet's gestures as a set.
  *Cost, measured:* the extra control narrows the hint's text column, so the card goes from three
  lines to four — first-run panel content 1194 → 1210px. The card is removed from the DOM once
  dismissed, so the panel a returning user works in is unaffected.
- **The print settings are named in-app, at the moment you print.** The README had always told you to
  set six things by hand in the browser's print dialog, and the extension itself said none of them —
  so the step that most decides whether the printout is right was documented only where you are not
  looking. A **Print settings** control now sits beside **Print** and lists what to set. **Print
  itself is unchanged**: it still opens the print dialog immediately, with nothing in front of it.
  *Measured, and it cut the list:* the extension's own print CSS declares `@page { margin: 0 }`, which
  **overrides the dialog's margin setting** — so the four manual margin values you were asked for did
  nothing, and they disagreed with the CSS anyway. They are gone, and the guidance says so. The other
  four settings stay, because the measurement showed they still change what prints (scale 18×, and
  background graphics 8×, the render-to-render noise floor). Headers and footers were kept too: their
  effect was *below* that noise floor, and a setting is only dropped on a measurement that resolves
  it. Method, numbers and limits: `vendor/docs/first-run-and-panel-20260911/phase2_print_settings.md`.
  *Cost, measured:* one more control takes the panel to 24 controls and its content 1210 → 1246px.
- **The funding and feedback links moved out of the panel, into the extension's own menu.** The
  panel used to carry **Feedback** (a bug-report link) and **Contribute** (a fundraising link) as two
  rows of a tray labelled **HELP**, side by side. They now live on the extension's toolbar-icon menu,
  where the sponsorship links already were, so the panel is only ever about arranging and printing
  your sheet. **Nothing was removed**: the bug tracker, the project page and all three funding
  destinations are reachable from that menu — verified in the browser against Chrome's own menu
  registrar, not by reading source. The now-empty **HELP** tray is gone with them, and the panel is
  **smaller than it was before this release** as a result (−74px of content, two rows and a heading).
- **The extension can be turned off, and it now says when it is on.** There was no way to switch it
  off from inside the page: activating it was one-way, and the only escape was minimizing a panel
  that cannot actually be dismissed — so getting a clean sheet meant reloading the tab by hand
  without being told that. A **power control** in the panel header now does it: it saves your layout
  first, then reloads, and the page that comes back carries **none of the extension** (verified in
  the browser: not one of the seven stylesheets, layers, wrappers or listeners survives). The
  toolbar icon shows **ON** while the tool is running and clears the moment you turn it off or the
  page navigates — which is also how you tell, at a glance, whether the extension is active on the
  page you are looking at. Turning it back on is a click on that icon.
- **The panel can be folded, so it stops covering the sheet.** Each of the panel's four sections —
  **LAYOUT**, **OUTPUT**, **PROPERTIES** and **CANVAS FILTERS** — now has a header you can click (or
  reach with the keyboard) to fold it away. Folding every one takes the panel's content from
  **1120px to 323px** and its overflow from **+534px to zero**: it fits, and every control is still
  there when you unfold it. The headings state their state for screen readers, keyboard focus is
  never left inside a folded section, and **nothing was removed or moved to make room** — the order
  and the controls are exactly as they were. The fold is deliberately not remembered between visits.

### The track's acceptance criteria, and what happened to each

Nothing was dropped and nothing was retracted: every criterion was measured rather than assumed, and
two produced *corrections* to the claims that motivated them. Each phase's GATE 3 record is beside
its plan (`vendor/conductor/archive/first_run_and_panel_20260911/`).

| Criterion | Disposition |
|---|---|
| **AC-1** two gesture surfaces that cannot disagree | **SHIPPED** — the card's sentence is *derived* from the reference list, and the card gained a keyboard-reachable `?` |
| **AC-2** print settings named at the moment of printing | **SHIPPED**, and it **cut one of six instruction groups**: the extension's own `@page` rule overrides the dialog's margins, so the four manual margin values were provably no-ops (measured against a noise floor with a control). The other four stay and headers/footers was kept because the probe could not resolve it |
| **AC-3** funding asks separated from the help surface | **SHIPPED** — moved to the extension's own menu, verified as *relocation* at runtime through Chrome's menu registrar; nothing deleted, ask count unchanged |
| **AC-4** turn it off, and say whether it is on | **SHIPPED** — a header power control (saves first, then deactivates) and an **ON** badge cleared on navigation. It also **corrected F-4's mechanism**: the injection adds 7 stylesheets, 4,058 nodes and removes 20 site nodes, so "off" is a reload rather than an in-place unwrap |
| **AC-5** the panel can be reduced without hiding a control | **SHIPPED** — foldable groups take the content 1120 → 323px and the overflow +534 → 0px, with 28/28 controls reachable and the inventory unchanged |
| **AC-6** release and record | **MET** — this entry, with every criterion's disposition, and the gate list green |
| **AC-7** truth before action | **MET** — all six findings re-measured before anything was built; **zero retractions, two corrections, one added sub-finding**, reported plainly here |
| **AC-V1 / AC-V2** browser evidence and the geometry rule | **MET** — four browser suites (14 cases) against the real unpacked extension with committed frames, and the archived viewport-label defect closed by rule |

### Fixed
- **Corner resize and rotate work again.** Both handles were being hidden on *every* element
  whenever any layer was locked — and the editor always keeps all but one layer locked — so
  dragging a corner to resize, or using the rotate handle, silently did nothing for most users.
  The rule now applies only to the layer that is actually locked; a locked layer still hides
  its own handles exactly as before.
- **Undo now covers moving several shapes at once.** Batch "Move selected to layer..." recorded
  nothing at all (the recording step ran after the function had already returned), so a
  multi-shape move could not be taken back. It records once for the whole batch, and an undo
  puts every shape back.
- **Switching a shape's art is undoable correctly.** The undo used to restore the new artwork
  together with the *old* border and decoration, i.e. a shape that was neither state. The
  previous artwork is now recorded before the switch, so an undo really goes back.
- **Undoing a move no longer leaves the element brought to the front.** Clicking an element to
  start a move also raises it above the others; the undo restored the position but left the new
  stacking, so the element stayed in front. Stacking is recorded and restored too.
- An undo can no longer leave a value it could not clear: restoring now writes back empty values
  (for example a cleared z-order) instead of skipping them and leaving the newer value behind.

## [1.15.0] - 2026-09-11

### Added
- **Undo now covers every change, not just deletes.** Until this release only the LAST
  destructive action could be reversed, and nothing else could be reversed at all. There
  is now a real **undo stack**: drag to move, resize a corner, rotate, reorder layers,
  move a shape to another layer, toggle compact mode, change a border or a shape, flip a
  layer's lock / print / visibility, rename a layer, add or clone things — all of it can
  be taken back, newest first, one change at a time.
- **Ctrl+Z / Cmd+Z.** The keyboard route, alongside the panel control. It deliberately
  does nothing while you are typing in a text field, so your typing keeps the browser's
  own undo.
- **An "Undo: ..." control that says what it will undo.** The control panel entry names
  the action and its subject ("Undo: Toggle \"Actions\"") instead of a bare "Undo", and
  it is disabled — not silently inert — when there is nothing to undo.

### Fixed
- **Undoing no longer reverts edits you made since the last save.** The old undo restored
  the layout as it was last *saved*, so anything you had changed since — a drag, a resize
  — was thrown away with it. The undo record is now taken from the live sheet.
- **A shape dragged while a ghost was on screen could be recorded wrongly.** The drag
  mirror is a clone of the dragged element, so a layout snapshot taken mid-drag could
  capture the clone instead of the real thing. Snapshots now ignore transient drag
  artefacts — this also affects a save that fired mid-drag.
- **A recorded empty value was not restored.** Restoring used truthiness checks, so an
  element whose recorded size or z-order was empty came back with a computed value
  instead. It now restores what was recorded. The same fix stops a missing asset path
  coming back as the literal text "undefined".

### Notes
- The undo history is **per session**: reloading starts fresh. Recovery across a reload
  stays the job of the automatic backups behind **Restore backup...**, which are
  unchanged (and are written before every destructive action exactly as before).
- Canvas filters (hue / contrast / saturation) are **not** part of the saved layout, so
  they are not on the undo stack; see `vendor/docs/undo-stack-20260911/` for the measurement.

## [1.14.0] - 2026-09-11

### Added
- **Undo.** After a destructive action the editor now offers one **Undo** control with
  the message telling you what happened, so a mis-click on Delete Layer no longer costs
  you the layer and every shape in it. The offer is single-use and expires on its own —
  when it is gone it is really gone, not a button that quietly does nothing.
- **"Restore backup..." in the control panel.** A backup is written automatically just
  before any destructive action, and this entry lists them — what each one was and when
  — so you can go back to the state before it. Until now the only way to restore a
  backup was to have a saved layout *fail* to load first, which is not a recovery you
  can plan around.

### Changed
- **A backup is written before every destructive action, not just Reset.** Deleting a
  layer, deleting a shape, deleting a batch of shapes, deleting a clone, merging two
  sections, splitting a skills box, and loading a layout file all snapshot the layout
  first. If the backup cannot be written the action is **refused** and you are told why,
  rather than proceeding with no way back.

### Fixed
- **Deleting a layer now says what it is about to do and can be undone.** It was the
  easiest destructive action to trigger — the button sits in every layer row — and one
  click took the layer and all its shapes.
- **Merging sections and splitting a skills box can be undone.** These two changed your
  layout irretrievably and did not even ask for confirmation; they are now reversible
  (and snapshotted) like the deletes.
- **The control panel's new entry no longer renders a broken character** (an ellipsis in
  an injected script is not decoded as UTF-8 by the browser; the same class of defect
  fixed on the previous release).

## [1.13.3] - 2026-09-10

### Added
- **A first-run hint that the sheet is yours to arrange.** Drag-to-move,
  corner-resize and the rotate handle only appeared on hover, so a new sheet
  looked like a static printout. One small card names the three gestures the
  first time you open the editor; press "Got it" and it never comes back. It lives
  inside the control panel, so it never covers what you are arranging.
- **A selected shape is now as obvious as a selected section.** Choosing a shape
  outlines it exactly the way choosing a section does, and the layer panel's
  highlight follows your selection rather than the layer new shapes would land in.

### Changed
- **The layer row's two controls say what they do.** "Toggle Print Visibility" and
  "Toggle Layer Visibility" were two names for one question; they are now
  **Skip when printing** (print exclusion) and **Hide on sheet** (on-screen
  visibility), each announced to assistive technology as well.
- **One verb per kind of action.** Destructive dialogs say **Delete**, dialogs that
  carry an action through say **Continue**, dismissals say **Cancel**, and a
  dialog that opens another step now always ends in an ellipsis (`Continue…`).
  The engraved small-caps headings and the sentence-case tool labels are unchanged
  — that contrast is deliberate.
- **Smaller windows are usable.** On a narrow window the two docked panels used to
  march across the sheet; they now narrow in stages and the layer panel collapses to
  its header — which always carries a **Restore** control, so rows are never
  stranded — leaving the sheet most of the width at every size.
- **Dialogs always fit the window.** The shape picker and the template catalog
  forced their own pixel width and could overflow a narrow window; both now follow
  the shared dialog rule.

### Fixed
- **The selection is one thing now.** Before, "what is selected" was tracked
  separately by the sheet, the layer panel and the properties panel, and they could
  disagree: selecting a section did not mark its layer row, and clearing the
  selection left the row highlighted. Selecting on the sheet, selecting by layer
  row and clearing now move all three together, and clearing genuinely clears.
- **Colours from outside the palette are gone.** The delete/context-menu red and
  the compact toggle's green-and-red came from outside this product's palette; every
  such value (33 of them in the three files that carried most) now uses the locked
  tokens, so the editor's chrome is one consistent system.
- **A layer's own delete confirmation could be skipped.** The delete test relied on
  a native browser confirm that this product stopped using in 1.13.0 — the dialog was
  never accepted, so nothing was deleted and the check passed anyway. It now
  confirms in-app, which is what it always claimed to test.

## [1.13.2] - 2026-09-10

### Added
- **Every notification can be dismissed.** Each toast now carries a small ✕ —
  click it, or press Escape while it has focus — and dismissing one is announced
  to screen readers. The toasts also no longer pile up on top of each other: they
  stack down the top of the sheet, so each one is readable and its ✕ is actually
  clickable (they used to be drawn at the same spot, one covering the next).
- **"Nothing found" now explains itself and waits for you.** "No clones found",
  "No available targets found" and "No compact-compatible sections found" used to
  be toasts that vanished after three seconds — look away and you were left with
  an unchanged sheet and no idea why. Each is now a dialog that stays until you
  dismiss it, and each suggests the next step.
- **The layer right-click menu works from the keyboard.** It is a real menu now:
  it opens with focus inside, the arrow keys move between items (wrapping), Home
  and End jump, Enter activates, and Escape closes it and puts focus back on the
  layer you right-clicked. It also stays on screen: right-clicking near the right
  or bottom edge used to open it partly or wholly off the edge, where the items
  could not be reached at all.

### Changed
- **The extension now tells you that your saved layout loaded.** Starting a
  session used to be silent, so "my layout is back" and "we loaded the default"
  looked identical. Each boot now confirms which one it was, in one line.
- **Toasts can no longer drop a failure on the floor.** The stack cap used to
  remove the OLDEST notification whatever it was, so a rapid save/error sequence
  could discard an error before it was read. Errors are now kept, and the cap
  applies only to the ordinary ones.
- **"Rename layer" says when nothing changed.** Submitting the same name used to
  close the dialog in silence; it now reports that the name is already the
  layer's.

### Fixed
- **A spell detail that could not be restored now says so.** If recreating a
  merged spell fails, the remaining spells are still restored and you get one
  message naming the ones that did not come back — previously they simply did not
  appear, and the layout quietly differed from what you saved.
- **The spell error no longer blames the wrong thing.** It used to tell you to
  "add the spell from the manage spells button" for every failure, including a
  temporary network problem. That instruction now appears only when it can
  actually help (the spell really is not on this character's list); a temporary
  failure says so and points at Retry.

## [1.13.1] - 2026-09-10

### Changed
- **Internal only — no change to anything the extension does in the browser.**
  The cross-module export surface was audited end to end and trimmed: six dead
  exports are gone (`window.UiTheme`, `Modals.showSliderModal`, `Icons.iconEl`,
  `Icons.names`, `ShapePicker.handleUploadFromDisk`,
  `ShapePicker.SECTION_STYLES_TAB_LABEL`), each with zero callers anywhere in
  `js/`, `test/` or `scripts/`. The exports kept although nothing in `js/` calls
  them now document why at their declaring site (`window.__lastUploadInput`,
  `window.CatalogService`, `window.restoreFailureCard`) — these are test seams,
  and a comment is cheaper than re-litigating them next time.
- The audit is now a committed tool, not a one-off: `scripts/audit_dead_exports.js`
  prints every export on both surfaces (the `window.*` assignments *and* the
  members of every exported namespace object) with per-area reference counts and
  one of three verdicts, and `scripts/check_dead_exports.js` fails the suite when
  a new export appears with no caller and no explanation. The U-22 listener-leak
  test was re-pointed from the retired slider dialog onto the input dialog, so the
  invariant is asserted against a dialog the product actually opens.
- Full suite 853 → 852 passing, 0 failing (−10 cases that existed only to drive
  the retired dialog, +9 for the audit, the annotation rule and the new guard);
  encapsulation debt oracle unchanged at 299. See
  `vendor/docs/dead-exports-20260910/notes.md`.

## [1.13.0] - 2026-09-10

### Changed
- **Every confirmation in the extension is now an in-app dialog.** Deleting a
  layer and its contents, deleting several selected shapes at once, deleting a
  section, a clone or a shape, applying a template over your existing shapes, and
  the reload prompt all used the browser's own blocking `confirm()` — unstyled,
  announced as browser chrome, and **silently skipped altogether** if you had
  ticked "prevent this page from creating additional dialogs", which could leave
  a destructive action looking like it simply did not run. They now use the same
  themed dialog as the rest of the extension, and a dialog you dismiss is always
  read as "no".
- **Error alerts are now the extension's own toast** rather than a blocking
  browser alert: failed template loads and applies, failed image processing, and
  the "close other D&D Beyond tabs" database message. They are announced to
  screen readers and no longer stop you mid-action.
- **The last three dialogs without proper affordances are converted**: the append
  target picker, Manage Clones and Manage Compact now have a ✕, backdrop
  dismissal, Escape, and move focus in when they open (they could previously
  only be left via their own Close button).

### Fixed
- **The shape picker and templates catalog now put focus inside themselves when
  they open.** They were keyboard-reachable only after tabbing in from the page
  behind them; the picker lands on its search field and the catalog on its first
  card, and both return focus when closed.
- **The "Delete clone" confirmation named the wrong thing** — it read the page's
  `window.name` instead of the clone's title.

## [1.12.0] - 2026-09-10

### Added
- **Dialogs are now real dialogs.** The name prompt, the value slider and the
  layout-JSON fallback all open as proper dialogs: they are announced as dialogs
  to screen readers by name, they can be closed with a **✕**, by **clicking the
  backdrop**, or with **Escape**, and **focus moves into them when they open and
  returns to wherever you were when they close**. Previously only some of the
  extension's dialogs could be dismissed any way other than their own buttons,
  and the three above had none of it.
- **The recovery card shown when a saved layout fails to restore is now
  dismissible** (✕ / backdrop / Escape) instead of forcing you to pick one of
  its two recovery actions.
- **A rejected empty name now says so.** Clearing the name field and pressing OK
  used to close the dialog and do nothing at all — no message, no change, and no
  way to tell whether the app had ignored you or refused the value. The dialog
  now stays open, marks the field, and shows **"Enter a name to continue — the
  field cannot be empty."** in the warning colour.

### Changed
- **The layout-JSON fallback card tells the truth about why it is there.** It now
  says the download **failed** and that nothing was saved, instead of implying a
  generic problem — and its copy button no longer claims "Copied!" when the
  browser refused the copy; it selects the text and tells you to press
  Ctrl/Cmd+C.

### Fixed
- **The name field in dialogs no longer appears as a white box** on the dark
  panel. The D&D Beyond page's own stylesheet was overriding the field's
  background; the extension's styling now wins.
- **Dialogs no longer leak key/click handlers.** Every way out of a dialog now
  cleans up after itself, so a later Enter cannot re-trigger a dialog that is
  already gone. A slider dialog that leaked this way was fixed in 1.11.3; this
  release makes it a guarantee across all of them, enforced by a test that
  counts attached handlers rather than trusting the code.

## [1.11.3] - 2026-09-10

### Fixed
- **The value slider dialog no longer leaves a stray keyboard listener behind.**
  Closing it with the mouse (Cancel or Apply) used to leave its Enter/Escape
  handler attached to the page permanently, so pressing Enter later could
  re-trigger the dialog's Apply action on a dialog that was already gone — and
  every time you opened it again another handler piled up. All four ways out of
  the dialog (Cancel, Apply, Enter, Escape) now clean up after themselves.

## [1.11.2] - 2026-09-10

### Fixed
- **The bottom of the left control panel is now reachable.** The panel's content
  is taller than most screens (1156px against a 900px window) and the panel is
  pinned to the viewport, so the bottom third — the **CANVAS FILTERS** sliders and
  **Reset Filters**, and the **Contribute** link — fell below the fold and could
  not be scrolled to at all. The panel header stays pinned and the rest of the
  panel now scrolls, so every control is reachable on a laptop screen. The same
  cap was applied to the right-hand layer panel, which had the same problem on
  shorter windows. Both scrollbars are styled to match the extension rather than
  showing the browser default.

## [1.11.1] - 2026-09-10

### Fixed
- **The "Beyond Print" panel header no longer wraps onto two lines.** It was
  being given 80px of width for 131px of text — the same row also held the
  TEMPLATES chip and the minimise button — so it broke onto two lines and looked
  cramped. The panel's title now owns its own line, with the minimise control at
  its right and TEMPLATES on a row beneath it.
- **All headers are now the same size.** They had drifted across 12px, 13px,
  14px and 18px (the layer-panel header, the panel title, the tray and section
  headers, and the modal title respectively). They now share one recipe —
  Cinzel at 14px, weight 700, the same tracking and casing — and none of them
  can wrap any more, whatever the label.
- **More breathing room around headers**, and consistent spacing between them
  (group headers, the panel header and the modal title all got padding and
  margins they did not have before).
- **The modal title's bottom padding was being silently squeezed away** inside
  the shape picker, which let the golden rule under a modal title paint across
  the title text itself. The title's box is now unshrinkable.

## [1.11.0] - 2026-09-10

### Added
- **Golden ornamental double borders on the panels and modals** (track
  `ornament_symmetry_20260910`). The control panel, the layer manager and every
  modal now carry a **double hairline with a leather gap**: a 1px blind tool, a
  1px stamped gold-brown hairline directly inside it, then 5px of bare leather
  and a second hairline 6px in. It is deliberately **not** a filled gold frame —
  antique gold stays light, never fill, and the Print row is still the only gold
  fill in the chrome.
- **Spiky golden corner terminations** on those same three surfaces: a 12px
  corner L in 1px antique gold with a 1px cream inner highlight, four on a modal
  and the top two on each docked panel (the bottom pair would clash with the
  12px workbench buffer at the sheet edge). They are drawn as pure CSS layers —
  no images, no extra elements, and nothing reaches the printer.
- **A centre diamond ornament on the modal header**, matching the one the
  panels already carried, so every ornamented surface has the same primary
  ornament.
- **One consistent height for every clickable control, per tier.** The nine
  different button heights the chrome used to mix (20/22/24/26/27/30/32/34/36px,
  plus a layer row that rendered at 32px next to one at 39.6px) are now four
  fixed tiers: **action buttons 32px**, **icon-only controls 28×28px**,
  **chips and pills 22px**, **text inputs 32px**, and **list rows 40px**. Width
  still fits the content.

### Changed
- **The Print button is no longer taller than its neighbours.** It was 36px
  against everyone else's 32px; it now shares the 32px tier and stays the
  obvious primary action through its gold fill, weight and padding instead of
  its size.
- **A long label can no longer change a button's height.** Labels no longer
  wrap inside the panel; they clip with an ellipsis and the full text is
  available as a tooltip. Two labels that could not fit at the new width were
  shortened — **"Bugs & Feature Request" → "Feedback"** and **"Reset All
  Filters (excl. Hue)" → "Reset Filters"** — each keeping its full text in the
  tooltip.
- The ornament is deliberately **restrained**: context menus and the colour
  picker keep a single quiet rule, and the toasts, in-sheet action buttons,
  cards, pills, tabs and inputs get no ornament at all — the character sheet is
  the thing being looked at, not the tool chrome.

### Fixed
- **The shape-picker search field rendered at 17px instead of its intended
  height** when the asset grid overflowed the modal (the modal is a column flex
  container capped at 86vh, which was compressing the field). Tiered controls
  are now exempt from that compression.

## [1.10.1] - 2026-09-09

### Fixed
- **Reset to Default no longer destroys your saved layout silently** (track
  `ui_ux_review_20260910`). It writes a **timestamped backup before erasing
  anything** (the newest 3 are kept), and the confirmation is now an in-app
  dialog that states exactly what is deleted and that the backup is the only
  way back — replacing a vague native `confirm()`. If the backup cannot be
  written (e.g. storage full) the reset is **aborted** rather than proceeding.
- **A saved layout that fails to load is no longer replaced by the default
  template in silence.** You now get an explicit card naming the failure and
  offering **Restore a backup** / **Start fresh**, with the default applied
  only so the sheet stays printable (nothing is overwritten).
- **Load now warns before it replaces your layout** (naming the file), and the
  version notice is accurate for newer files too instead of always claiming
  the file is "older".
- **Save to PC can no longer fail in silence** — the layout scan runs inside
  its error path and reports a typed error instead of throwing.
- **Legacy layout files fail loudly** instead of loading a broken sheet with
  no explanation.
- **Error toasts are now visually distinct from success toasts** (warning
  glyph + danger accent, and announced to screen readers) so a failure can
  never be mistaken for a success.
- **Grabbing the rotate or resize handle no longer drags the element** as well
  as transforming it.
- **"Locked" no longer means "unreachable".** Adding a shape used to lock every
  other layer and hide all section controls; and a locked layer was made
  completely inert, so its own unlock/hide/delete controls could not be
  reached. Locking now means *not draggable/resizable/rotatable* while the
  layer's controls stay visible and usable.
- **The spell-detail "Retry" button retries** instead of deleting the section
  (it previously re-entered a duplicate guard, said "already open", then
  removed the panel).
- **A chip click no longer clears a multi-selection** in the layer panel — it
  toggles the clicked chip.
- **The rotation handle is themed** (it had shipped with a debug hot-pink
  border and arrow).

### Notes
- Scope was set by a full-surface UX audit (35 findings) reviewed against this
  project's "click once, then print" contract; the remaining findings are
  tracked as follow-up work rather than half-fixed here.

## [1.10.0] - 2026-09-09

### Changed
- **Shape layers — Photoshop-style flat stack & split flows** (track
  `shape_layer_ps_ux_20260909`) — the layer panel now behaves like a flat
  layer list you build by splitting, instead of one giant "Shapes (Default)".
  Gated on the full mocha suite (737/0), the 299-test debt oracle, touched
  Playwright e2e, and a per-phase visual-model gate (MiniMax-M3 verdicts under
  `vendor/docs/shape-layer-ps-ux-20260909/`).
  - **Split & move** (`js/dom/layer_manager.js`): a shape's right-click menu
    gains **Move to New Layer…** (the new layer is named after the shape) and
    **Move to Layer…** (a chooser listing every other layer). Moving reparents
    the real shape between layer containers, so it persists with the existing
    per-layer save format — no schema change. The chip menu is also visible
    now (it had been silently hidden by a global CSS rule).
  - **Flat restack**: layer rows are draggable (gold ghost + gold insertion
    marker) and dropping restacks the layer list, which drives the print
    z-order. The Sections row stays a distinct band always below the shape
    layers, and rows only drag while their layer is unlocked.
  - **Identity**: shape chips show their curated name (not a filename), every
    layer row shows a live item count, empty layers say "Empty — drag a shape
    here", and renaming uses the app's own modal.
  - **Multi-select**: Ctrl/Shift-click to select several shapes, then
    **Split N into their own layers**, **Move selected to layer…**, or
    **Delete N selected** — applied as one atomic batch (a mid-batch failure
    rolls back rather than leaving shapes half-moved).

## [1.9.2] - 2026-09-09

### Changed
- **Custom upload & templates catalog UX** (track
  `custom_upload_templates_ux_20260909`) — two deferred picker-track
  follow-ups, gated on the full mocha suite (711/0), the 299-test debt
  oracle, touched Playwright e2e, and per-phase visual-model gates
  (MiniMax-M3 verdicts under `vendor/docs/custom-upload-templates-ux-20260909/`).
  - **Custom-tab upload no longer closes the picker or drops a shape**
    (`js/shape_picker.js`): uploading saves the shape to your library and
    the picker stays open with the uploaded shape preselected — OK (Add
    Shape / Switch Asset) places it, Cancel is save-to-library only, and a
    toast tells you which verb places it. Double-click/uploads-in-flight are
    guarded; a dismissed file dialog never leaves the button stuck; the
    layer manager refreshes exactly once.
  - **Templates catalog upgraded** (`js/catalog_service.js`): one modal
    shell (the stacked double overlay is gone) with in-modal grid ⇄ detail
    ⇄ confirm views; ✕ / backdrop / Esc cancel (Esc steps back one view
    first); focusable cards with arrow-key navigation; the apply step is an
    **in-modal confirm** (no more native browser dialog).
  - **Real template thumbnails**: `assets/thumbnails/basic.webp` was missing
    and `archer.webp` was a solid-white stub — both regenerated from live
    captures of the applied templates, and every catalog thumbnail now falls
    back to a neutral placeholder instead of rendering broken-dark.

## [1.9.1] - 2026-09-09

### Changed
- **Border & shape picker UX** (track `border_shape_picker_ux_20260909`) —
  the selector surfaces were unified and reworked end to end, with every
  phase gated on the full mocha suite (697/0), the 299-test debt oracle,
  touched Playwright e2e, and a per-phase visual-model gate (screenshots →
  collage design doc → MiniMax-M3 verdicts under
  `vendor/docs/border-shape-picker-ux-20260909/`).
  - **One picker shell** (`showAssetPickerModal`, `js/shape_picker.js`): the
    separate section-border modal is gone (its 20 hard-coded styles moved to
    the single `SECTION_BORDER_STYLES` catalog in `js/asset_catalog.js`);
    add/switch/style flows share one modal; the legacy entry point is a thin
    add/switch alias.
  - **Honest commit control**: per-flow title + verb (Add Shape / Switch
    Asset / Apply Border Style) and an OK that stays disabled until the
    selection genuinely changes — add mode preselects nothing, so a stray
    Enter can never commit an unintended shape.
  - **Keyboard/cancel integrity + a11y**: Enter activates the focused
    control (focused Cancel cancels — the old trap is gone), Esc/✕/
    backdrop cancel, zero listener leaks across open/close cycles; option
    cells are focusable with arrow-key navigation, `aria-selected` and a
    visible focus ring.
  - **Curated catalog**: 54 assets get human display names + family-group
    headers, with a live search field (name/group/tags) and a proper empty
    state.
  - **Live hover "try it"**: hovering a style or asset tile previews it on
    the real section/shape (dashed-gold outline) with an exact, byte-
    identical restore on leave and on every cancel/commit path; add mode
    shows an enlarged in-modal preview instead. Category-aware preview
    geometry (frame panes vs transparent art panes).
  - Gate hygiene: generated shape-layer ids are now collision-proof (the
    `debt_e9` full-suite flake root cause).

## [1.9.0] - 2026-09-09

### Changed
- **Drag & Drop UX overhaul** (track `drag_ux_overhaul_20260909`) — the
  sheet-positioning drag and the layer-panel reorder were reworked end to
  end, with every phase gated on the full mocha suite, the 299-test debt
  oracle, touched Playwright e2e, and a per-phase visual-model gate
  (screenshots → collage design doc → MiniMax-M3 verdicts under
  `vendor/docs/drag-ux-20260909/`).
  - **Pointer drag engine** (`js/dnd.js`): native HTML5 DnD replaced by a
    pointer-events engine — mouse/touch/pen unified, ~4px movement
    threshold keeps click/text selection intact, locked layers and
    interactive content never arm. Wrappers are no longer native drag
    sources.
  - **Live grid snap + alignment guides**: the drag ghost snaps to the 16px
    grid while dragging (zero release jump) and 1px gold `#C6A15B` hairlines
    render when an edge/center aligns with another section or the sheet
    edge. The misleading green `.drag-over` outline is gone.
  - **Drag feedback**: the custom ghost is near-opaque with a gold frame and
    the source is dimmed with a dashed-gold origin outline; the green hover
    glow is suppressed while dragging and on locked wrappers; locked layers
    show `cursor: not-allowed`.
  - **Always-completing clamped drops**: releases resolve anywhere and clamp
    to the sheet origin (never negative); `pointercancel` aborts cleanly;
    the historical `margin: 0` mutation on drop is removed. Debounced
    auto-save (~1s after the last drop) persists through the existing save
    seam with a "Layout saved" toast. *(Viewport auto-scroll deferred —
    follow-up issue `temp/issues/ISSUE_sheet_overlay_autoscroll_20260909.md`.)*
  - **Precision path**: arrow keys nudge the active section (1px; Shift =
    16px grid step) and the properties panel gains numeric Position X/Y
    inputs, kept in sync after every drop/nudge.
  - **Layer-panel reorder polish**: chips re-sized to the 1.8.0 row language
    (11px bone labels / 34px thumbs), custom mirrored gold-framed ghost, and
    a gold insertion marker at the drop slot.

## [1.8.0] - 2026-09-08

### Changed
- **"3.5 Codex on the Workbench" visual identity** — second-generation
  chrome identity evoking D&D 3.5 nostalgia (2003–07 core-rulebook warmth)
  without cosplay. Implements the design system locked by the 3-round art
  direction consult (`vendor/docs/dnd35-nostalgia-20260908/consult`). Visual chrome
  only; no behavior change (AC-0), gated on the 626-test full suite +
  299-test debt oracle + 3-round Muse visual gate on live captures.
  - Design tokens: `js/ui_theme.js` now injects the leather-and-bone set —
    leather-black grounds (panel `#191410` / tray `#221C16` / well `#120D0A` /
    modal `#1E1813`), blind-tooled seams, bone `#E9DDC2` as text only,
    antique gold `#C6A15B` as light, oxblood `#5E1F1E` / ember `#D86A3D`
    retained for selected/destructive semantics. All 1.7.0 chrome hexes
    retired.
  - Signet Print: the Print action is a flat-gold beveled plaque in a
    ground-well socket — the chrome's only gold fill.
  - Engraved display type: Cinzel→system-serif fallback small-caps with a
    single dark-incise engraving at ≥13px (band titles, modal h3); flat
    11–12px tool labels. Group headers as quiet engraved serif 14px with
    blind-tooled seams; nail-dot group markers.
  - Sheet-edge buffer: 12px ground-well strip + 1px gold hairline where
    chrome meets the bone sheet (never butts leather to bone).
  - Unified range chrome (3px leather track, ringed bone thumbs), ghost
    TEMPLATES / Add Shape actions, Reset All Filters demoted off the gold
    modal-ok fill, PROPERTIES empty state warmed.

## [1.7.0] - 2026-09-08

### Changed
- **UI/UX overhaul (fantasy print-shop design system)** — implements the
  design system locked by the 6-round UI/UX consultant iteration
  (`vendor/docs/ui-ux-review-20260908/consult`). Visual chrome only; no behavior
  change (AC-0), gated on the 626-test full suite + 299-test debt oracle.
  - Design tokens: `js/ui_theme.js` injects the charcoal/parchment/brass/
    oxblood palette as CSS custom properties + a component skin for the
    control panel, properties, sliders, color picker, layer manager,
    context menus, modals and the feedback toast.
  - Icon language: `js/icons.js` 16px SVG line-icon set replaces emoji
    glyphs across control-panel actions, in-sheet action bars/menus and
    layer toggles; layer toggles now expose semantic `data-state`,
    `aria-label`, `aria-pressed` (e2e/unit suites migrated in-commit).
  - Control panel: tray IA (LAYOUT/OUTPUT/HELP) with a top bar
    (title/TEMPLATES chip/collapse), 44px brass PRINT hero in a charcoal
    surround, Contribute as a quiet footer link, PROPERTIES and CANVAS
    FILTERS bands with seam headers.
  - Layer manager: SECTIONS (1)/SHAPES (n) count headers, 32px rows with a
    Print→Show/Hide→Lock→Delete cluster, hide-state dims the whole row,
    lock stays brass-solid, labeled "+ Add Shape" ghost button.
  - In-sheet chrome: destructive actions carry `data-danger` (ember on
    hover only, seam divider above the group); all action glyphs are the
    icon set.
  - Modals/pickers: 640px shared shell with pinned action footer, brass
    underline tabs, brass ring on the selected grid cell, localized 45%
    scrim + blur; color picker gains a "Tint" title card.
  - Toast: charcoal pill over the canvas at y=38 with a brass tick +
    drain bar, pause-on-hover, max 3 stacked (message text preserved for
    e2e).

### Added
- `js/ui_theme.js`, `js/icons.js` (loaded before `js/main.js`).

## [1.6.0] - 2026-09-07

### Changed
- **Encapsulation refactor (behavior-preserving):** the 8,759-line
  `js/main.js` monolith was decomposed into cohesive modules (storage,
  assets, section utils, print styles, section cloning, layout ops,
  filters, spells UI, modals, shape picker, properties panel, controls,
  layout scan/apply, persistence) loaded in dependency order before
  `js/main.js`, which is now an orchestrator. No user-visible behavior
  changed; pinned by the 299-test encapsulation-debt oracle plus the full
  mocha suite.
- **Idempotency fixes:** `createControls()` no longer duplicates the panel
  on a second call; the configured `be-btn-add-shape` id is honored so
  `updateControlsState()` can target it; `injectDnDStyles()` no longer
  appends duplicate style blocks.

## [1.5.0] - 2026-05-03

### Added
- **Centralized Properties Panel:** Introduced a dedicated UI panel above the hue sliders to manage individual section attributes.
- **Active Section Management:** New selection model via '🎯' button to target specific sections for editing.
- **Pixel-based Font Slider:** Granular font size control (8px to 30px) replacing the old percentage-based modal.
- **Proportional Scaling:** Implemented a CSS variable system (`--be-font-scale`) ensuring headers and icons scale proportionally with the body text.
- **Live UI Sync:** Properties panel controls (Font Size, Compact Mode, Border Style) now automatically sync with the active section's current state.

### Changed
- **Persistence Architecture:** Refactored font size storage to include a centralized `applyFontSize` helper, ensuring consistent scaling across all section types (clones, shapes, etc.).
- **UI Refresh:** Replaced text-based property inputs with interactive sliders and live thumbnail buttons.

## [1.4.3] - 2026-05-03

### Added
- **Font Size Slider (Preliminary):** Initial implementation of the font size range slider.
- **Persistence:** Added basic `fontSize` saving for all section types.

## [1.4.2] - 2026-03-24

### Added
- **Templates:** Introduced a new "TEMPLATES" system allowing users to apply professional character sheet layouts instantly.
- **Archer Template:** Full replication of the classic Archer-themed sheet, including custom borders, accents, and dividers.
- **Catalog Service:** Centralized management for template definitions and application logic.
- **New Shape Assets:** Expanded the asset library with `dwarf.webp`, `dwarf_hollow_hand.webp`, and `shield_stats.webp`.
- **Feature Flagging:** Added `ENABLE_PREMADE_TEMPLATES` flag to toggle the template menu (currently disabled for final polish).
- **Color Picker Expansion:** Integrated the **Grayscale** attribute into the 2D Color Picker, allowing simultaneous selection of Hue, Saturation, and Grayscale.

### Changed
- **Asset Compression:** Migrated all image assets from GIF to WebP, reducing the package size from 14.5MB to ~2.1MB (85% reduction).
- **Performance Optimization:** Downscaled high-resolution decorative assets to a maximum of 512px for better loading performance.
- **Metadata Synchronization:** Synchronized `ASSET_METADATA` and `ASSET_LIST` with the `assets/shapes/` directory to ensure all new graphical elements are available in the UI.
- **Workflow Security:** Mandated that all `mocha` tests must pass before any `git commit` is allowed.
- **Grayscale Default:** Changed the default `greyscale` filter value from 0% to **100%** for better out-of-the-box print compatibility.
- **Template Compatibility:** Enabled support for "flat" template formats in `CatalogService`, allowing JSON files from "Save to PC" to be used directly as official templates.
- **Automatic Migration:** Implemented a version-based migration engine that automatically converts legacy GIF paths to WebP and normalizes old layout schemas.

### Fixed
- **Asset Path Integrity:** Resolved missing metadata for several Archer-themed shapes and borders.
- **Template Application:** Fixed a bug where applying a template would sometimes conflict with existing manual element placements.
- **Border Saving Bug:** Fixed a critical issue in `scanLayout` where newer border styles (like "Ornament 1") were not being captured during saving due to a hardcoded check.
- **Shape ID Duplication:** Fixed "undefined" ID issues in the Archer template to ensure correct shape management.

## [1.4.1] - 2026-03-11

### Fixed
- **Hue Filter Color Mismatch:** Resolved a double-hue-rotation bug where borders and shapes were receiving cumulative hue filters (e.g., 114deg + 114deg = 228deg), causing colors to look different from the color picker preview.
- **Standalone Shapes Saturation:** Fixed an issue where shapes added via \"Add Shape\" (not nested in a character section) were missing saturation and hue filters.
- **Saturation Cap:** Reduced the maximum saturation from 250% (or 300% in sliders) to 200% for better visual consistency.
- **Global Filters Architecture:** Refactored `applyGlobalFilters` to separate hue rotation from other visual enhancements using a new `--be-decoration-filter` CSS variable, while correctly identifying nested vs. standalone assets.

## [1.4.0] - 2026-03-07

### Added
- **Shape Transformation:** Persistent 15-degree incremental rotation for all decorative shapes with visual handles.
- **Enhanced Shapes Modal:** New tabbed navigation (Borders vs. Shapes) and tag-based filtering for the asset library.
- **Quick Switch:** Dedicated 🔄 button on shapes to swap assets while perfectly preserving position, size, and rotation.
- **Shape Interaction Lockdown:** Shapes are now non-interactive and dimmed (0.5 opacity) when "Shapes Mode" is inactive to prevent misclicks on standard sections.
- **Improved Shape Actions:** Consolidated Delete, Clone, and Rotate buttons into a unified hover-based actions container.

### Changed
- **Drag-and-Drop Overhaul:** Complete rewrite of the DnD engine in `js/dnd.js`. Replaced native `setDragImage` with a custom "Manual Ghost" system for perfect rotation and scaling support.
- **Print Optimization:** Migrated standalone shapes to `<img>` tags to ensure visibility when "Background Graphics" are disabled in browser print settings.
- **Asset Migration:** All internal `.png` assets migrated to `.gif` for better compression and consistency.
- **CSS Architecture:** Refined print specificity to ensure full content opacity regardless of interactive lockdown state.

### Fixed
- **Drag Ghost Offset:** Resolved the 16px vertical drift issue in the custom drag ghost.
- **Double Rotation Bug:** Fixed a cumulative transform error where rotation was being applied to both wrapper and container.
- **Layout Reset:** "Reset to Default" now correctly purges all non-default shapes and extractions.
- **Initialization Scope:** Fixed `ReferenceError` issues related to `ASSET_METADATA` and `parseAssets` by re-organizing script initialization order.

## [1.3.2] - 2026-03-07

### Added
- **Shapes Mode:** A new toggleable mode to decorate character sheets with custom graphical elements.
- **Shape Decoration Tool:** "Add Shape" button in the control panel to place decorative assets (Dwarf, Goth, Plants, etc.).
- **New Assets:** Added 17 new corner and vertical shape assets for the border picker.
- **Enhanced Border Picker:** Support for the new shape assets in the section border customization.
- **Persistence:** Shapes and decorations are now saved/loaded as part of the character layout.

### Changed
- **UI Architecture:** Introduced `.be-section-wrapper` to encapsulate sheet sections, preventing content clipping and improving button accessibility.
- **Robust Selectors:** Refactored `DomManager` to use attribute-based and context-aware selectors, making it resilient to D&D Beyond's obfuscated class names.
- **Initialization Logging:** Added detailed tracing for the extension's initialization lifecycle.
- **Button Handling:** Replaced simple `.onclick` handlers with `addEventListener` for better reliability on the live site.

### Fixed
- **Critical Layout Support:** Fixed the bug where the entire character sheet (`#site-main`) was hidden due to D&D Beyond's recent layout updates (e.g., the mobile navigation `<dialog>`).
- **"Deep Clean" Logic:** Refined the `DIALOG_SIBLING` selector to explicitly exclude extension-added UI (modals, feedback, controls) from being hidden during printing.
- **Save to PC:** Fixed cross-browser compatibility for downloading layout JSON files.
- **Control Panel Visibility:** Ensured the floating control panel remains visible even when aggressive "Deep Clean" styles are applied.

### Security
- Protected all extension-added DOM elements from being accidentally manipulated or hidden by site-wide CSS injections.

## [1.3.0] - Earlier 2026
- Initial release of the "Shapes" branch features (internal).
