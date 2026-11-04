# Candidate C — Default-state tuning

**Space**: Zero-click preview gate improvement (make the FIRST open print-safe, so no user adjustment is ever needed).

**Thesis**: Most "requires adjustment" outcomes are not exotic defects; they are the print-safe state not being the DEFAULT. Pagination, margins, scale, colour handling, border rendering and the saved-preference application path all decide what the user sees on first open. Set those defaults correctly and a whole class of adjustments disappears without touching any sheet-specific defect.

**What it does**:
- Audits `js/print_styles.js` and the print-preview initialisation path for the defaults actually applied on first open.
- Makes the print-safe value the default (page break behaviour, margin/scale defaults, `print-color-adjust`, border rendering) and applies saved preferences on top rather than instead.
- Verifies the defaults with the existing print-style unit tests plus the three print E2E specs.

**Why it may win**: It is the cheapest possible lever per adjustment avoided — a default is one change that applies to every sheet at once, and it needs no per-sheet diagnosis.

**Risk**:
- **It cannot show that it worked.** The gate is a measured rate, and default-state changes move the rate only where the defaults were the binding cause; without an inventory you cannot tell an improvement from a reclassification. A defaults change asserted against a proxy rate is exactly the assertion the spec forbids.
- Defaults are also a user-visible behaviour change on the print path, so a wrong guess regresses sheets that currently pass — and the same missing evidence would not catch it.

**Requirements covered**: R5 (no regression of existing print certs) is testable here; R1 and R2 are not.
