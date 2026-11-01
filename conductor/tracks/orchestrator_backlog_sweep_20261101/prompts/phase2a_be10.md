# Phase 2a — BEYOND-10 · SC-D2 AI border refinement loop (orchestrator-issued launch card)

You are an external reasonix coding session cloned from the orchestrator: same workspace plumbing
(this repo's `reasonix.toml` resolves the relay 127.0.0.1:38116, the vendor skills, yolo default),
same house rules (AGENTS.md, vendor/AGENTS.md), write access to the repo `C:\luiscla27\projects\dndbeyond-printenhance`.
You are NOT the orchestrator; you are the working seat. The orchestrator spawned you for ONE card.

## 0. The one mandatory read
Read `conductor/tracks/orchestrator_backlog_sweep_20261101/prompts/LAUNCH-PROMPT-TEMPLATE.md`
FIRST — it defines the execution discipline, the track-record format, the orchestrator report, and
the token-handoff rules. This file is the CARD for your phase; that template is the RULES.

## 1. Your card (verbatim from the tracker, BEYOND-10, state Triage, automation Manual)
SUMMARY: [UX Gap] SC-D2: AI border refinement loop missing — gallery shows variants but no weight/style adjustment
DESCRIPTION: UX Gap from e2e test matrix (approved scores 2026-10-25). Scenario SC-D2 (UC-05: AI
Layout Assist). Composite UX Score 2.7 (weak). Evidence: `byok_border_gallery.spec.js` shows border
variants exist; no refinement loop for adjusting border weight, style, or parameters; users cannot
iteratively refine AI-generated borders; core AI assist feature incomplete. Gap classification:
Feature incomplete — gallery exists but refinement loop absent. Priority P2. Quick win YES —
parameter adjustment UI + refinement loop, leverages existing gallery.
Acceptance criteria:
1. Border gallery UI exposes weight/style adjustment controls
2. Refinement loop: select variant -> adjust parameters -> regenerate -> compare
3. Adjustments persist in session and settings
4. E2E test `byok_border_gallery.spec.js` extended with refinement flow
5. Gate G-DETECT passes for refined border output

## 2. RECON ALREADY DONE FOR YOU (verify, don't trust — the card's framing is stale, like BEYOND-9's was)
- `js/ai_border.js` (556 lines) ALREADY contains the client-side refinement transform:
  `transformBorderSvg(svg, {weight, styleIndex})` (weight ×0.5/0.75/1/1.25/1.5 multiplicative on
  stroke-width; styleIndex 0=solid / 1=dashed / 2=dotted via DASH_CYCLE; `weight<=0` refused),
  `canAdjustBorder(svg)` (AC-2 capability gate: needs stroke-width, refuses <filter>), and an
  `adjustBorder` seam. The pure-function discipline is documented in the file header: a
  weight/style control can only reach the art by rewriting the SVG's own `stroke-width` /
  `stroke-dasharray` presentation attributes.
- `test/browser_e2e/byok_border_gallery.spec.js` ALREADY has seam-level cases: "exposes
  adjust/transform/canAdjust on the isolated-world AiBorder seam", "adjusts a stroke-bearing
  border in place: weight +1.5x increases the painted stroke-width, original preserved", and
  "DISABLES refinement on a fill-only border: adjustBorder returns not_adjustable and paints
  NOTHING new". There is also a separate `border_render_refine.spec.js` (PR #8 rendering
  refinement — NOT this loop; don't confuse them).
- THEREFORE your job is likely: (a) certify what exists vs each AC, (b) build the missing UI
  refinement loop (gallery variant selection -> weight/style controls -> regenerate/adjust ->
  compare), (c) wire persistence of adjustments into session + settings storage, (d) extend the
  gallery e2e spec with the refinement FLOW (not just the seam), (e) prove G-DETECT on refined
  output. If you find an AC is already fully met, say so with evidence — a certification pass with
  one or two real gaps fixed is a valid outcome (BEYOND-9 was exactly that).
- The BEYOND-9 session already landed the persistence seam pattern you should mirror:
  `LayerManager.requestLayerPersist()` in `js/dom/layer_manager.js` calls the product's own
  debounced `scheduleAutosave()` from every flag writer (commit e20a02c, now at HEAD; track record
  `conductor/archive/beyond09_layer_three_state/`). For AI borders, find the product's own persist
  seam (settings store / autosave) and call it from the refinement writers the same way.

## 3. Execution discipline (non-negotiable)
- Conductor protocol: create your track record under
  `conductor/tracks/beyond10_ai_border_refine_loop/` FIRST (spec.md from the card verbatim,
  plan.md, metadata.json with `"deliberation": "required"`), then reproduce, then TDD.
- TDD Red→Green→Refactor with REAL tests only (no stubs, no scanning, no production edits to make
  a test pass — record BLOCKED_PRODUCTION_DEFECT instead). Prove RED before GREEN for each new
  behavior (the BEYOND-9 worker proved its RED control by stashing the fix and re-running).
- Harness rule you MUST obey (BEYOND-9 finding, binding for this fleet): NEVER batch two e2e spec
  files in ONE mocha process — `reinject()` breaks after `page.reload()` and reload cases fail
  cross-file. Run ONE spec file per mocha process. Also: `test/unit/input_budget_alignment.test.js`
  is red on a CLEAN tree (2 pre-existing failures, F4/F8 framework findings, proven by stash) —
  treat those 2 as the known baseline when reading `npm test`.
- Gates: the card names G-DETECT. Read how G-DETECT is defined/measured in this repo (grep the
  conductor archive + test helpers; BEYOND-9's verification.md shows the gate-evidence format).
  Produce the measured pass.
- Coverage >80% for new/changed code; OKF YAML frontmatter on every .md you write; lint +
  `node --check` clean; housekeeping_guard OK before commit; deliberation ADMITTED (the guard
  checks citation format — read its error text carefully and iterate; BEYOND-9's worker landed this
  with an evaluation matrix + counterfactual ledger).
- WIP under gitignored `temp/wip/beyond10_ai_border_refine_loop/` until commit. Commit locally
  ONLY (NEVER push — fleet hard rule; manifests carry noPushPerformed:true). Commit message cites
  BEYOND-10. Keep product code and the track record in SEPARATE commits (implementation first,
  docs second — the evidence chain compares the implementation commit's own tree).

## 4. What the orchestrator does with your work (so you know the bar)
The orchestrator (a) re-runs your owning e2e spec independently at HEAD, (b) submits an evidence
manifest as the consultant-challenger verifier seat (broker re-measures git ancestry + tree),
(c) walks the tracker lifecycle `Triage→Open→In Progress→Done/Fixed` via accept.py +
transition_issue + close.py. Your evidence must therefore name: the implementation commit SHA, the
owning spec file + pass counts, gate measurements (G-DETECT), and the exact AC-to-proof mapping.
Your close-out set (mirroring BEYOND-9, archived under conductor/archive/): spec.md, plan.md,
metadata.json, verification.md, final_report.md, deliberation/ candidate records.

## 5. Report back to the orchestrator (this IS your deliverable besides code)
Write `conductor/tracks/orchestrator_backlog_sweep_20261101/reports/phase2a_be10.md` with:
- What you found vs each AC (already-implemented vs genuinely missing, with file:line evidence)
- What you changed (new code, architecture decisions, why)
- Amendments to the plan (if the card's framing was stale, say so plainly)
- Struggles (what failed, what you tried, measured results — cumulative)
- Knowledge to document for future sessions (harness gotchas, seams, patterns discovered)
- Final gate results with exact commands + pass counts
- Token handoff: if you approach the YELLOW budget band (oracle budget) and cannot finish, STOP
  and write `ORCHESTRATOR_HANDOFF.md` in your track dir with: what's done, what remains, exact
  next commands, and the state of temp/wip/. Do NOT silently degrade quality to finish.

## 6. Hard rules (restated — they bind you)
- Real tests only. Never modify production to make a test pass.
- No stubs, no mocks pretending to be product behavior in e2e; the isolated-world AiBorder seam
  is the product's own code and IS fair to drive.
- Local commits only, never push. Collision protocol: check `git status` before every commit; if
  HEAD moved (another seat landed work), rebase your WIP before committing.
- Gemini paid seat is the VERIFIER only — you are not it; do not spend budget on vision loops
  beyond what the gates need.
- Escalation: after 6 identical failures on the same target, consult the external consultant
  (DeepSeek Pro via the fleet escalation path) per the Muse-First Fix Protocol, and record the
  exchange in your track record.

Begin now. Read the template, read the card's code reality, certify before building, and land
honest TDD-verified work. When done, report.
