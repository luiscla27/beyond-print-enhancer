# Candidate A — VERIFY ONLY: trust the shipped mechanism, add measurement cases, change no product code

**Claim.** The mechanism shipped in `ac3c72f` (track `ux_quick_wins_20261025`). The card's premises
are stale, so the whole of BEYOND-9 is a certification pass: add the three missing measurement cases
(per-layer strip, rendered print media, a real reload) and close the card with them green. Any
residual gap the new cases expose is recorded as a follow-up rather than fixed here, and the AC-3
case carries an explicit note that persisting a mode pick needs the Save button.

**How it would have measured.** AC-1 / AC-4 / AC-5 green with no product change. AC-2 green once the
case reads computed style under emulated print media (measured: it already passes — the shipped
`!important` rules render correctly). AC-3 **amber**: the case would have to persist explicitly
(`persistLayoutNow`) before the reload, which is exactly what the sibling BEYOND-14 case
(`byok_settings_persistence_types.spec.js` case 3) does — and its own comment says why: *"Probe-driven
mutations are not one of the autosave's trigger events … persist explicitly BEFORE the reload."* A
green case bought that way answers "does a stored mode survive a reload", not the card's
"does the user's selection survive a reload".

**Cost.** Zero product risk, zero new code. The honest price is that AC-3 stays true only for a user
who clicks Save — and nothing in the layer panel tells them they must.
