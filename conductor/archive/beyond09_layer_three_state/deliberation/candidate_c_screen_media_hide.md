# Candidate C — SCREEN-MEDIA HIDE: make the print-time UNDO unnecessary instead of adding a persist

**Claim.** The shipped mechanism hides a `Print only` layer with an INLINE `display:none` (because
`isHidden` means hidden on screen), then UN-hides it at print time with a generated
`#id { display: block !important }`. That inverse is the fragile half: it substitutes a display value
rather than restoring the container's own, and it has to be emitted in the right order relative to the
`data-print-disabled` hide rule. The alternative removes the need for an undo entirely — hide
`Print only` layers inside `@media screen { … display:none !important }` instead of inline, so the print
media never applies the hide in the first place and no `!important` print rule is owed.

**What it would touch.** `js/dom/layer_manager.js` (the on-screen hide becomes a class instead of
`el.style.display`), `js/print_styles.js` (drop the `data-print-only` → `display:block` block), and the
existing cases in `layer_print_visibility.spec.js` that assert `el.style.display === "none"` and that
the print CSS "UNDOES the inline hide" — those assertions *are* the shipped contract, so rewriting the
mechanism means rewriting three already-certified cases.

**Not chosen.** Two measured reasons: (1) the substituted value was MEASURED to be correct today —
the print-media pass reads the rendered box of the sections layer as `block` in both `Both` and
`Print only`, i.e. the same value, so the "fragile half" has no observable defect to justify the
rewrite; (2) a mechanism rewrite inside a certification pass enlarges the blast radius of a card whose
own gap is a missing write. It stays the better long-term shape for a future refactor — see the
counterfactual ledger for its recall condition.
