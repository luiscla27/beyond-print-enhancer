# Index — e2e_feature_inventory_minimax_20261029

**Scope:** run the FULL browser_e2e inventory (82 spec files / 432 tests / 88 loaded js files —
`test/browser_e2e/spec_inventory.json`) live against the unpacked MV3 extension, capture a
FULL video of every suite's context, then certify each of the 18 fleet features (plus the
cross-cutting suites) by sending its full video to **MiniMax 3.1 flash** through the **official
MiniMax API** (api.minimax.io) — the ONE certifier seat per the operator directive.

**Goals:**
- Prove every e2e feature runs green on the current tree (post-fleet-integration snapshot HEAD).
- Produce retained, full-video evidence per feature (not screenshots).
- Record MiniMax's own video-grounded verdict per feature, verbatim, with API provenance.

**Operating picture:** verification-only; no js/, manifest.json, or existing test file is
touched (AC-4). The videography launcher and MiniMax uploader are NEW code confined to this
track's `execution/` directory. Product = `verdict.md` + `progress.jsonl` + evidence pointers.

**Key decisions (see deliberation/):** single delegated session, POOL_SIZE=1 (candidate A) —
the operator's "the ONE to certify" binds the certifier to one seat; a fleet pool (candidate B)
was eliminated at admissibility on AC-6 + AC-2. Evidence class = full video (operator: "Send
him full videos"). Certifier = official MiniMax API only.

**Model-id pinning (operative):** "minimax 3.1 flash" is pinned at Phase 0 to the exact model
id the official api.minimax.io accepts; resolution or mismatch is recorded in the verdict.
MiniMax is an already-integrated provider family in this fleet's relay
(`vendor/relay/model_catalog.py`, `"minimax": ("of-",)` official-first-party prefix).
