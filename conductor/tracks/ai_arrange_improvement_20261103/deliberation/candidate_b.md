# Candidate B — Undo granularity cluster

Replace all-or-nothing undo with per-move undo stack; each AI-proposed move is independently reversible.

## Pros

- Directly addresses user control (can undo individual moves)
- Builds on existing undo system (`window.Undo`)
- Lower UI surface than preview

## Cons

- Doesn't address "usefulness" (preview/explanation)
- Undo stack complexity (nested state)