# Phase 2B — Go Digit Private Car SATP Adapter

This package consumes the serialized Phase 2A `GridDocumentIR` inventory and
produces an insurer-specific draft. It does not open XLSX/PDF source documents,
recalculate formulas, emit approved `CommissionRule` objects, or implement a
rating engine.

## Input and command

Run from this directory after generating the Phase 2A inventory:

```bash
npm run typecheck
npm test
npm run normalize -- ../phase-2a/artifacts/phase-2a-real-corpus/phase-2a-inventory.json ./artifacts/go-digit-satp
```

The normalize command writes `go-digit-satp-adapter-draft.json` and
`GO-DIGIT-ADAPTER-REPORT.md` under the requested output directory.

## Boundaries and unresolved semantics

- Only Go Digit Private Car SATP is normalized.
- SATP RTO lookup uses the `4WTP` column on the exact `4W  RTO` sheet.
- Source rows and citations are retained; duplicate/conflicting RTO mappings
  are surfaced rather than deduplicated.
- `Max CD2` is preserved as an unresolved raw metric. It is never a TP
  commission rate or an approved commission rule.
- `All_India_Decline` mappings/rows are explicit decline candidates, never a
  normal zero commission.
- Note text is preserved as unresolved exception candidates; vague notes are
  not broadened into blanket exclusions.
- Grid effective dates remain unknown. The `march-2026` directory label is
  recorded as a source-period label only.
- Phase 1 contracts, Phase 0 documents and original corpus files are not
  modified.

The Phase 2A JSON stores numeric cell values as JSON numbers, not original
OOXML numeric lexemes. The adapter preserves that available number as a
decimal string (for example `0.295`) and records the lexeme limitation; it
does not reopen the workbook to recover a different textual representation.
