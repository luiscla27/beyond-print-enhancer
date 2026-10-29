# Spec — E2E feature-inventory verification fleet with MiniMax-3.1-Flash visual certification (e2e_feature_inventory_minimax_20261029)

**Status:** IN PROGRESS — spec/plan authored; execution is delegated to a SEPARATE Reasonix session
(LAUNCH-PROMPT.md beside this file) so the certifier seat's context is not burned by 82 e2e
suite launches + 432 tests' worth of video upload.

**Operator directive (verbatim):** "Create a track to test all features inventory on e2e tests,
make minimax 3.1 flash as the one to certify that is working by sending him visual evidence of
each one. Send him full videos, use the official minimax api"

## Audit evidence (mandatory section)

- `test/browser_e2e/spec_inventory.json` — the committed inventory gate: **82 spec files, 432
  tests**, `expected.loaded_js_files: 88`. This is "all features inventory" — the full e2e
  surface, not the 18 unit tracks' subset.
- `test/browser_e2e/_helpers/dom.js` (`launchExtensionContext`, lines ~37-85) — the harness boots
  a REAL persistent Chromium context with the UNPACKED MV3 extension loaded
  (`--disable-extensions-except` + `--load-extension`). Headless works (`headless: true,
  --headless=new`). Evidence class prior: the sequencer run (commit `f96349a`) recorded the
  browser-gate EXECUTION phase "not runnable headless" — this track exists to actually RUN it.
- `conductor/tracks/ux_feature_fleet_20261029/units.json` — the 18 fleet features with their
  `test_paths` (browser_e2e + unit certificates per feature). This is the per-feature grouping
  the verdict table is keyed on; the remaining ~20 spec files not mapped to a fleet unit are
  inventoried as cross-cutting/fixture suites (manual_verification_phase0-4, visual_capture
  family, release_*).
- `vendor/relay/model_catalog.py` (line ~1450) — MiniMax is an ALREADY-INTEGRATED provider family
  in this fleet's relay (`"minimax": ("of-",)` official-first-party prefix). No new integration
  is needed to reach the official API; the certifier seat rides the project's existing
  first-party credential path.
- Playwright's `launchPersistentContext` supports `video: "on"` (or "retain-on-failure"/"on"),
  collected per context on close — full-video evidence of each suite is feasible. A dedicated
  launcher harness (NEW file, scoped under this track's own execution directory) replays the
  82 inventory specs in video-capturing contexts WITHOUT editing any existing spec file.
- No prior audit evidence exists for "MiniMax-3.1-Flash certifies e2e videos of this extension" —
  that is the novel claim this track's criteria are built to test.

## Scope boundary

- **IN:** (a) a fresh launcher that runs all 82 spec files / 432 tests against the unpacked
  extension with full-video capture per suite; (b) per-suite → per-feature video evidence
  artifacts; (c) certification of every feature by the MiniMax model via the OFFICIAL MiniMax
  API, receiving the full videos as visual evidence; (d) a verdict recording mocha result +
  MiniMax verdict + evidence pointer per feature.
- **OUT:** re-running the unit suite (already covered by f96349a); modifying any existing spec
  file, js/**, or manifest.json; patching a failing certificate (RED is reported, never repaired).

## Acceptance criteria (to be SEALED before execution via `housekeeping_guard.py seal`)

**Model-id pinning (operative clause):** The requested id "minimax 3.1 flash" is pinned at
execution start to the exact model name the OFFICIAL MiniMax API accepts (the fleet's relay
integrates the MiniMax provider family, `vendor/relay/model_catalog.py:~1450`, and the concrete
model id is resolved against api.minimax.ai's published model list at run time — the actual id
string, e.g. the M-series variant the docs expose, is recorded in the verdict with the API
response proving resolution). If "3.1 flash" does not resolve to a real MiniMax model id, the
run records the mismatch and names the closest official id instead of silently substituting.

- **[AC-1]** — every one of the 82 spec files in `test/browser_e2e/spec_inventory.json` executes
  live against the unpacked extension (mocha, per-suite timeout 900 s per `package.json`'s
  `test:e2e`), and each suite's result (pass/fail counts) is recorded. Falsifiable: a suite that
  is missing from the run, or a count that disagrees with mocha's own stats, fails AC-1.
- **[AC-2]** — a full video (Playwright `video` capture of the entire suite context) is produced
  and retained for EVERY feature in the inventory, not screenshots; videos live under this
  track's evidence directory. Falsifiable: any feature with no video artifact on disk fails AC-2.
- **[AC-3]** — each feature is certified by the MiniMax model through the OFFICIAL MiniMax API
  (api.minimax.ai), which receives the full video(s) of that feature as visual evidence; the API
  call, the resolved model id, and the verdict text are recorded per feature. Falsifiable: a
  feature with no recorded API verdict, or a verdict not backed by an API response body, fails
  AC-3.
- **[AC-4]** — no file under `js/**`, no `manifest.json`, and no EXISTING test file is modified by
  the run (`git status -- js/` empty at close). New launcher/videography code is confined to this
  track's execution scope. Falsifiable: any mutation outside the track directory aborts the run.
- **[AC-5]** — the track's product is `verdict.md` + `progress.jsonl` (+ evidence pointers) inside
  this track directory; close-out follows the house guard (sealed criteria, explicit-path commit,
  local-only, never push).
- **[AC-6]** — the certifier seat is MiniMax-3.1-Flash (pinned id) and only MiniMax — no Gemini/
  Muse/DeepSeek seat substitutes for it in AC-3's verdicts, and each verdict cites the video
  artifact it judged. Falsifiable: a verdict row whose certifier is a different provider fails
  AC-6.

## Non-goals

- Re-authoring or re-landing any certificate.
- Re-litigating the 18 unit tracks' verdicts (f96349a stands).
- Certifying anything by pixel-comparison against a golden image — the certification is the
  model's video-grounded judgment, recorded verbatim with its provenance.
