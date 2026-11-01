# Counterfactual ledger — every candidate that was NOT delivered, and what would bring it back

Each section below registers a candidate that was NOT delivered, and states the measurement that would
re-open it. A rejection here is re-openable when its recall condition is MEASURED — never because
someone prefers the other shape.

## C — screen-media hide (rejected)

**Recall condition:** a `Print only` layer is measured rendering in print with a `display` that differs
from its own natural display — i.e. the emitted `#id { display: block !important }` stops being a no-op.
The observation point already exists: the AC-2 case compares the Print-only print-media reading against
the `Both` reading (`naturalScreen.display`), so if those two ever disagree, this candidate is the fix.

Second limb of the same condition: a container type is added whose natural display is not `block` (a
grid or flex layer container). Today neither `#print-enhance-sections-layer` nor
`.be-shape-layer-container` carries a `display` declaration in `js/print_styles.js` or
`js/ui_theme.js`, so both are block boxes by default — that measurement is what made the substitution
harmless.

Cost of recall is stated so the re-open is priced: three existing cases in
`layer_print_visibility.spec.js` (`inlineDisplay === "none"`, "print CSS UNDOES the inline hide", "and
it emits no hide rule") have to be re-expressed against a class-based hide.

## A — verify only (inadmissible, premise nonetheless recallable)

**Recall condition:** the product ships an explicit, always-visible per-layer save affordance (a Save
button in the layer panel, or a per-row commit). In that world "the user saves" is a real user flow and
AC-3 could be satisfied without writer-side autosave.

Measured today against that condition: the panel's OUTPUT section does expose Save, but it saves the
whole sheet from a different surface, and every other layer-panel edit (drag, nudge, property) autosaves
with no such click — so the panel would still be internally inconsistent even with a Save button added.

## D — a fourth persisted `visibilityMode` field (inadmissible)

**Recall condition:** the "storage schema unchanged" decision is re-opened for an unrelated reason, OR a
FOURTH visibility state becomes a product requirement. The current two flags can express a state the
three-mode strip cannot — hidden on screen AND skipped on print, the legacy corner pinned by its own
case — so at that point the derivation is genuinely too small and a first-class field with a migration
is the honest answer.

## Not carried as candidates (no alternative existed — stated, not implied)

**Recall condition:** someone produces a second defensible ordering for the two print rules. The order
(`data-print-disabled` hide emitted before the `data-print-only` un-hide) is not a deliberated choice: a
layer can be in exactly one mode, so the two selectors can never target the same element in the same
render — a one-answer fact, which is why it was not padded into a candidate.
