# Track: E2E feature-inventory verification with MiniMax-3.1-Flash video certification (e2e_feature_inventory_minimax_20261029)

**Status:** IN PROGRESS — spec/plan/deliberation authored; execution is delegated to a SEPARATE
Reasonix session (see LAUNCH-PROMPT.md), so the certifier's context is preserved across 82
suite launches and 432 tests' worth of video upload.

**Operator directive (verbatim):** "Create a track to test all features inventory on e2e tests,
make minimax 3.1 flash as the one to certify that is working by sending him visual evidence of
each one. Send him full videos, use the official minimax api."

**What this track is:** an e2e verification fleet over the ENTIRE browser_e2e inventory
(82 spec files / 432 tests / 88 loaded js files — `test/browser_e2e/spec_inventory.json`), run
live against the unpacked MV3 extension with FULL-VIDEO capture per suite, then certified by the
MiniMax model ("minimax 3.1 flash", pinned to the exact id the official api.minimax.ai accepts)
via the OFFICIAL MiniMax API, which receives each feature's full video(s) as visual evidence.

**What it is NOT:** not a re-run of the unit suite (f96349a already verdicted that); not a
re-authoring of certificates; not a pixel/golden-image comparison — the certification is the
model's own video-grounded judgment, recorded verbatim with API provenance.

## Operating picture

**Component:** the e2e surface of DDB Print Enhance + the MiniMax first-party API.
**Primary obligations:** run all 82 suites live with video; send each feature's full video to
MiniMax via the official API; record mocha + MiniMax verdict per feature.
**Supporting:** the committed inventory gate (collection already proven green by f96349a:
432/82, zero drift); units.json's feature→spec mapping; the relay's existing MiniMax provider
family (vendor/relay/model_catalog.py) for the official-API credential path.
**Verification owner:** the delegated session's live runs (primary), the guard + commit check
(secondary).
**Interface:** LAUNCH-PROMPT.md / track_launcher.json (operator-facing); verdict.md +
progress.jsonl + execution/evidence + execution/minimax (output-facing).
**Required integration evidence:** the committed verdict with per-feature mocha counts, video
paths, MiniMax verdicts, and the model-id resolution record; the guard's OK at close-out.

## Novelty disclosed

No prior audit evidence exists for "MiniMax-3.1-Flash certifies e2e videos of this extension" —
the model-id resolution and the video-grounded API verdict are both first-of-kind here, which is
why the acceptance criteria are written falsifiable-with-fail-condition (spec.md).
