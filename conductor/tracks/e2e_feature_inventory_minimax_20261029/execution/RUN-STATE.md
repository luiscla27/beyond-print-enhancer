# RUN STATE — e2e_feature_inventory_minimax_20261029 (resume record, 2026-10-30)

Session interrupted mid-Phase-2 (sequential e2e run). This file records what was DONE, what is
LEFT, and the pinning/solve results so a relaunch never re-derives them.

## DONE
- Track authored (spec/plan/metadata/deliberation/LAUNCH-PROMPT) — commit 19a4552.
- Reusable skill authored + committed (cc88292) + resume-set video-bytes rule pinned (c066678):
  `vendor/.reasonix/skills/e2e-feature-inventory-minimax/SKILL.md`.
- Two tracked-excluded harness helpers on disk (gitignored, durable record = CHANGELOG.md):
  `scripts/e2e_inventory_runner.js` (mocha child-per-suite + resume) and
  `scripts/e2e_video_preload.js` (mocha --require patch that adds page-level screencast capture
  WITHOUT editing js/ or _helpers/dom.js — Playwright 1.63.0 context-level video:{} silently
  produces nothing; page.screencast is the only mechanism that works).
- Phase 2 in progress: **30 unique suites run, 208/432 tests, ZERO failures** (all passed or
  pending). progress.jsonl rows committed up to `color_picker.spec.js` (ts 1793336879504).
- 9 curated `.webm` retained (largest-page-per-suite picker) + raw page videos under
  `execution/evidence/cross-cutting/video-*`.
- Feature dirs exist: cross-cutting/, feature_01_ai_arrange/, feature_02_ai_borders/,
  feature_07_persistence/ (the latter two still EMPTY of .webm — gaps to retry).

## PHASE 0 RESULT — MODEL-ID PINNING (resolved, live-verified 2026-10-30)
- Operator phrase "minimax 3.1 flash" -> the official model is **MiniMax-M3.1-Flash**
  (announced 2026-10-19; 1M-context frontier multimodal coding model; supports text + image +
  VIDEO input). Verified in platform.minimax.io docs + a live smoke call.
- LIVE host is `https://api.minimax.io` (**.io**) NOT `api.minimax.ai` (.ai). MEASURED:
  `api.minimax.ai` does NOT resolve from this network (curl 000 / DNS fail); `api.minimax.io`
  returns 200 and a real completion. base_url (OpenAI-compatible) = https://api.minimax.io/v1 ;
  Anthropic-compatible = https://api.minimax.io/anthropic.
- **ACTION REQUIRED:** correct the host in track spec.md/README.md/LAUNCH-PROMPT.md and in the
  SKILL.md (they all say api.minimax.ai). Record the .ai->.io resolution in verdict.md appendix.
- Credential: env `MINIMAX_API_KEY` is set and live-verified (smoke call returned
  "MINIMAX_API_OK", usage accounted). NEVER commit the key.

## PHASE 4 PIPELINE — SOLVED & LIVE-TESTED (the blocker for certification)
Playwright screencast => `.webm` (VP8/VP9). MiniMax video input accepts ONLY MP4/AVI/MOV/MKV
(docs: MessageContentPart.video_url; Upload File purpose=video_understanding supports
"MP4, AVI, MOV, MKV"). `.webm` is NOT accepted by either path. Both were tested live:
- Transcoder: NO system ffmpeg on PATH. USE the static binary inside Python 3.12's
  `imageio-ffmpeg` package (already installed):
  `imageio_ffmpeg.get_ffmpeg_exe()` =>
  `...\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe` (ffmpeg 7.1).
  It DECODES vp8/vp9 and ENCODES libx264 + aac. Verified webm->mp4 transcode:
  `ffmpeg -y -i in.webm -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p
  -movflags +faststart -an out.mp4` (rc 0; 2.8MB webm -> 1.16MB mp4; sizes 48KB..1MB mp4).
- Two MINIMAX-ACCEPTED delivery forms (both return a genuine verdict):
  (a) Files API: POST /v1/files/upload multipart {purpose:"video_understanding", file} ->
      returns {file:{file_id}}; then reference it as `mm_file://{file_id}` in a chat
      content video_url part. Supports video up to 512MB; file retained 7 days.
      VERIFIED LIVE: uploaded color_picker.mp4 -> file_id 457885394072006, and the
      subsequent chat call returned a real video-grounded verdict via mm_file:// reference.
  (b) Base64 data URL: `data:video/mp4;base64,<B64>` in a video_url part; request body <=64MB,
      video <=50MB. VERIFIED LIVE (smallest video 48KB mp4 -> verdict).
  **Recommended for the run: Files API (mm_file://)** — avoids multi-MB base64 bodies for the
  ~1MB feature videos; the 512MB ceiling is far above anything here.
- MiniMax call shape (OpenAI-compatible), VERIFIED returning verdicts:
  POST /v1/chat/completions, model MiniMax-M3.1-Flash, reasoning_effort low|medium,
  messages[].content[] = [{type:"text",text:PROMPT},{type:"video_url",video_url:{url:REF,
  "detail":"low","fps":1}}]. fps default 1, range [0.2,5]; detail low|default|high.
- Honest-evidence note (measured, do not hide): on color_picker, fps=1/detail=low sampled too
  sparsely to see the click sequence -> verdict "NOT-VISIBLE" although the suite passed 4/4.
  The certification prompt must therefore (1) ask the model to describe what it ACTUALLY sees
  and only then give a verdict, and (2) the run should use fps>=2 (and possibly detail=default)
  for click-interaction suites so the interaction is actually sampled — a "NOT-VISIBLE" verdict
  on a green suite is real evidence about VIDEO SAMPLING, not proof the feature is broken.

## LEFT TO DO
- Phase 2: run remaining **52 suites** (224 tests). Resume with:
  E2E runner: `node scripts/e2e_inventory_runner.js --outdir
  conductor/tracks/e2e_feature_inventory_minimax_20261029/execution --resume`
  (resume set = suites whose LATEST row has failing>=0 AND video AND video_bytes>0; a video
  GAP is retried, so the 20 gap-row suites from the early runs MUST be re-run to fill AC-2).
- Phase 3: confirm a .webm exists per feature (18 units + cross-cutting). Currently only
  cross-cutting/ has curated videos; feature_01/02/07 dirs are empty; the other 15 feature
  dirs never created. Mapping source: conductor/tracks/ux_feature_fleet_20261029/units.json.
- Phase 4: per-feature bundle: transcode each .webm -> .mp4, upload via Files API,
  chat with a per-feature prompt (read the spec's describe blocks), record verbatim in
  execution/minimax/<feature>.json {endpoint, model, request (key redacted), file_id, verdict}.
- Phase 5: verdict.md — per-feature table (mocha counts, video path, MiniMax verdict quote,
  regression flag), model-id resolution appendix (with the .ai->.io note), overall line.
- Phase 6: close-out — git status -- js/ manifest.json test/ MUST be empty; housekeeping guard;
  commit verdict artifacts with explicit paths, msg `docs(e2e-minimax): ...`, NEVER push.

## COST/BUDGET WATCH
metadata bounds: max_judge_calls=18, max_cost_usd=60. Per-call usage measured ~4-5k
prompt tokens (a ~1MB mp4 at fps=1) + ~400 completion. 18 features ~5-6 calls/feature-bundle =>
well under budget; log every call's usage into execution/minimax/<feature>.json.
