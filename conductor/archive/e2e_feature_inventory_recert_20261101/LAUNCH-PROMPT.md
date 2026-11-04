# Launch Prompt — e2e_feature_inventory_recert_20261101

You are the certifier agent for this re-certification track. Your job:

1. **Verify the evidence** (Phase 0): Read the archived track's `progress.jsonl` and confirm all 82 suites have `video_bytes > 0`. Confirm every feature dir under `execution/evidence/` has at least one `.webm`. Pin the MiniMax model id: resolve "minimax 3.1 flash" to the exact official API model name (query the model list), record verbatim.

2. **Verify AC-1 counts** (Phase 1): Cross-check the archived per-suite pass/fail against the fresh post-closure result. The 5 visual-capture suites now read 45/45 (was 34/45). Record both the archived and the fresh counts.

3. **Re-certify all 19 bundles** (Phase 2): For each of the 18 fleet features + cross-cutting:
   - Get its `.webm` videos from the archived track's `execution/evidence/<feature>/`
   - Transcode each → mp4 (H.264, 5 fps, using imageio_ffmpeg)
   - Upload to official MiniMax Files API (`api.minimax.io/v1/files/upload`)
   - Make ONE chat completion call with ALL of that bundle's video parts (FPS=5, detail=default)
   - Write `execution/minimax/<feature>.json` with: endpoint, model id, redacted request, file ids, usage, verbatim verdict text, parsed verdict, ts

4. **Produce verdict.md with before/after** (Phase 3): Per-feature table (mocha counts, video path, new MiniMax verdict quote) + **explicit before/after comparison table** against the archived verdict, highlighting the 5 visual-capture bundles and their improvement from 34/45 → 45/45.

5. **Close-out** (Phase 4): `git status -- js/ manifest.json test/` empty. Explicit-path local commit. Guard green.

**Critical invariants:**
- Single certifier seat: MiniMax-M3.1-Flash ONLY via official api.minimax.io (no proxy/relay)
- FULL VIDEO per feature (already captured, just re-submit)
- No test runs, no product code changes
- Per-feature JSONs written as they complete (resume-safe)
- Deliberation was declared at track creation (required)

**Key files to read:**
- Archive evidence: `conductor/archive/e2e_feature_inventory_minimax_20261029/execution/evidence/`
- Archive minimax verdicts: `conductor/archive/e2e_feature_inventory_minimax_20261029/execution/minimax/*.json`
- Feature mapping: `conductor/tracks/ux_feature_fleet_20261029/units.json`
- Spec inventory: `test/browser_e2e/spec_inventory.json`

**Model id resolution (operative clause from spec.md):**
The phrase "minimax 3.1 flash" MUST be resolved to the exact model name the official api.minimax.io accepts at the start of this run. If the phrase does not resolve, record the mismatch verbatim and name the closest official id. NEVER silently substitute; the verdict must show the resolution.

**Run the certification script now.** It's at `conductor/tracks/e2e_feature_inventory_recert_20261101/certify.py`.