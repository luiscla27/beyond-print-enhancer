# Candidate A — ARIA remediation cluster

Focus on adding missing ARIA attributes across sidebar, modals, print preview, controls panel.

- `role` for interactive regions
- `aria-label` for icon-only controls
- `aria-expanded`/`aria-controls` for collapsible sections
- `aria-live` for dynamic content updates

## Pros

- Directly addresses screen-reader gaps
- Well-scoped to DOM attributes
- Low risk of behavioral changes

## Cons

- Does not address focus or contrast
- May require many small touch points