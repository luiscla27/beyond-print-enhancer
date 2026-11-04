# Candidate B — Focus management cluster

Focus on visible focus outlines, focus trapping in modals, logical tab order in drag-reorder, focus restoration after print/close.

- `focus-visible` outlines for all interactive elements
- Focus trap in modals (inert outside)
- Logical tab order through drag handles
- Restore focus to trigger after modal close / print complete

## Pros

- Addresses keyboard operability holistically
- Single architectural pattern (focus management)
- WCAG 2.4.3, 2.4.7 coverage

## Cons

- More invasive (behavioral changes)
- Drag-reorder focus is complex