# Candidate B — PERSIST FROM THE WRITERS: a layer-flag edit asks for the product's own debounced save

**Claim.** AC-3 is not a storage-shape problem (the two per-layer flags ride the existing record, no
new key, no migration) — it is a *trigger* problem. The two places that persist today are
trigger-based: `js/dnd.js:654` (a drop) and `:1195` (a keyboard nudge), plus
`js/properties_panel.js:234` (a property commit). A layer-panel click is none of those, so a mode pick
mutates the live layer object, repaints everything correctly, and is never written. Fix: every writer
of a persisted layer flag asks for the same debounced persist the property panel already asks for,
through the same `window.scheduleAutosave()` seam — resolved at call time and fail-open, because the
unit harnesses boot `layer_manager.js` without `js/dnd.js`.

**Scope of the ask.** `_setLayerModeNow` (the strip), `_toggleLayerPrintNow` (the printer row button),
`toggleLayerVisibility` (the eye row button), and the `toggleLayerLock` wrapper. All four write fields
`scanLayout` persists, so leaving three of them unsaved would have made the strip look like a special
case to the user.

**Measured.** Before the change: the AC-3 e2e case came back RED in the way that matters — the live
in-memory record said `isHidden:true` while the **stored** record still said both-visible, and the
reloaded page rendered `Both`, i.e. the user's pick was silently thrown away. The unit contract
(`test/unit/layer_mode_persist_request.test.js`) measured `asked 0` persists for a mode change and for
the printer toggle. After the change: 4/4 unit cases green, and the reload returns `Print only`.

**Cost / risk.** Four one-line asks plus one guarded helper. No schema change, no new key family, no
change to the print rules. The one new behaviour is that a panel click now schedules a write 1s later —
the same behaviour property edits and drags already had, which is what makes it consistent rather than
novel.
