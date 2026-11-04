---
type: checkpoint
title: "track-08 checkpoint — feature_08_layout_operations"
description: "missing → tested: declared certs published, REVIEW_APPROVED, board updated"
tags: [track-08, checkpoint, fleet, layout-ops]
status: done
generated: 2026-10-29T05:35:05Z
sources: [js/layout_scan.js, js/layout_apply.js, js/layout_ops.js, test/unit/layout_scan.test.js, test/unit/layout_apply.test.js]
---

# track-08 checkpoint

## Instance

- instance_id: track-08-orchestrator-1793251800
- track: track-08 / js/layout_ops
- unit: feature_08_layout_operations — Layout Operations (Scan/Apply/Mutate)

## Disposition

- done: 1  pending: 0  deferred: 0  blockers: 0
- code: feature_08_layout_operations
- status: tested
- test_path (progress, primary certificate): test/unit/layout_scan.test.js
- co-certificate (also exists): test/unit/layout_apply.test.js
- sha: (SHA: integrator) — tracks never commit
- batch: batch-js_layout_ops
- reviewer: reviewer-track08-batch-js_layout_ops (distinct from orchestrator/implementer; both certificates re-run green)
- trace reviewer ref: layout_scan 16/16 + layout_apply 8/8 → 24/24 REVIEW_APPROVED

## Reconcile

- reconcile-report.json: missing 1 for track-08 (no test artifacts on disk)
- Action: missing → tested — created BOTH declared certs (test_paths declared at scaffold) + verified green

## Evidence

- js/layout_scan.js: migrateLayout (wrapped unwrap, gif→webp 1.4.0, merges init, associatedExtractions lift/dedup), scanLayout (sections with left/top/width/height/zIndex/printZIndex/fontSize/minimized/compact/noAutoScale/printHidden/borderStyle/borderSvg/innerWidths, clones via SectionUtils.getSanitizedContent + AiBorder.readBorderSvg choke, spell_details, shapes legacy, shapeLayers, spell_cache with safeLog guard, transient ghost skip, isRecordedExtraction precedence, merges group/spell)
- js/layout_apply.js: applyLayout (migrateLayout entry guard, skillsSplit, shapeLayers/layers restore, flagExtractableElements, spell_cache saveSpells, clone/extraction dedup, spell_details via createSpellDetailSection, shapeLayers with LayerManager + legacy shapes fallback, section presence-clear for zIndex/width/height, AiBorder.renderBorderSvg choke with ??null clear, fontSize via applyFontSize, noAutoScale/scalingFloorAutoOff, minimized display toggle, compact be-compact-mode, printHidden dataset flag (outside has() group — FLAG semantics), innerWidths DOM-iteration clear-absent, merges spell→group with selector fallback + handleMergeSections, updateLayoutBounds/refreshLayers/updatePrintStyles tail)
- js/layout_ops.js: movePortrait (avatar→primary-box), moveDefenses (defenses clone+svg strip), moveQuickInfo (CtQuickInfo→draggable), separateAbilities (ability→draggable + ability_border), separateQuickInfoBoxes (box→draggable + box_border + health), removeSearchBoxes (filter/input/search removal with spells preserve), adjustInnerContentWidth (row-header/content children width sync)
- test artefacts atomically published: test/unit/layout_scan.test.js (15037 bytes), test/unit/layout_apply.test.js (12999 bytes)
- Progress: runtime/progress/track-08.jsonl (layout_scan.test.js as declared test_path)
- Traceability: traceability/track-08.jsonl
- Units timing: runtime/units/track-08.jsonl (start+end paired, batch-js_layout_ops)
- Batch report: runtime/out/track-08/batch-js_layout_ops/report.md + report.json
- Review: runtime/out/track-08/batch-js_layout_ops/review.md (distinct reviewer, VERDICT REVIEW_APPROVED, 24/24 re-run)

## Deferrals

- deferrals/track-08.jsonl: empty (no contention; single component lock claimed and released)
- DEFERRED-UNRESOLVED: none

## Blockers

- BLOCKED_PRODUCTION_DEFECT: none
- BLK-SHARED-TREE: none — browser extension track; mocha+jsdom sufficient (no Godot shadow)

## Suite results

- Declared certs: test/unit/layout_scan.test.js 16/16 + test/unit/layout_apply.test.js 8/8 = 24/24 green (npx mocha --timeout 10000)
- Related suites still green: filters 35/35, image_processor 23/23 (82 total with layout certs)
- No production mutation — read-only certs; js/layout_scan.js, js/layout_apply.js, js/layout_ops.js hashes unchanged

## Locks

- a39cf1c06f215d526081514a8ebfe5e8326d7391.lock — claimed 1793251832, released after REVIEW_APPROVED
- board lock eb666e8ab9b8a1a5dc67abb93ad39728f50a98e8 — claimed for board.md row update, released

## Final heartbeat

- status: done will be written after this checkpoint (per protocol: progress+traceability+review+board → checkpoint → final heartbeat done)
