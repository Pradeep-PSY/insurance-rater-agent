# Insurance Rater Agent – Phase 0 Rulebooks

This folder contains insurer-specific research rulebooks prepared from the supplied Vaatun challenge ZIP and project-owner clarifications shared on 23-Nov-2026.

## Files

| File | Scope |
|---|---|
| `hdfc-ergo-rulebook.md` | HDFC ERGO private-car comprehensive / Package grid |
| `go-digit-rulebook.md` | Go Digit private-car stand-alone TP grid |
| `reliance-rulebook.md` | Reliance IndusInd private-car comprehensive grid |
| `tata-aig-rulebook.md` | Tata AIG private-car stand-alone TP grid |
| `phase-0-final-report.md` | Cross-insurer findings, owner clarifications, open items and Phase 1 implications |

## Evidence labels used

- **Source fact:** Directly visible in the supplied policy PDF or insurer grid, with page/sheet/cell reference.
- **Project-owner clarification:** Business interpretation supplied by the project owner in chat. It is documented separately from the insurer's original source wording.
- **External corroboration:** Information from an external reference, not printed in the supplied policy. It must never be passed off as a policy citation.
- **Unresolved:** The supplied evidence and owner clarifications do not establish the required meaning/value. The runtime must not guess.

## Important implementation guardrails

1. Do not equate a raw percentage-formatted field with broker commission unless its meaning is established. In Go Digit, `Max CD2` is preserved but deliberately not approved as TP commission.
2. Support a **Package** rate applied to total Net Premium (OD + TP/liability, GST excluded). Do not force it into separate OD and TP rates when the grid does not publish separate component rates.
3. Select commission-grid versions using the policy issuance date, or an insurer-defined login date where that is the required anchor. Do not apply a later grid retroactively without explicit authority.
4. Store rate adjustments as typed operations. Reliance's `<1000 CC` adjustment is a relative 5% reduction (`base_rate × 0.95`), not a five-percentage-point subtraction.
5. For Tata AIG, keep base commission, incremental COA, gross payout, settlement adjustments and net payable as separate concepts.
6. Keep every normalized rule linked to its original source page/sheet/cell/range. Keep owner clarifications labelled as owner clarifications.
7. A missing or undefined rule must produce an evidence-backed ambiguous/unsupported result, not a guessed percentage.

## Phase 0 status

The four insurer research rulebooks have been prepared. Some final rate semantics and source inputs remain unresolved; see `phase-0-final-report.md`. This is intentional and should be carried into Phase 1 contracts and tests.
