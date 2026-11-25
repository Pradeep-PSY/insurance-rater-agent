# Go Digit Private Car SATP Adapter Draft

This is a source-cited adapter draft, not an approved commission rule or rating result.

## Source

- Workbook: Large Insurance Brokers Mar'26 - Shared.xlsx
- Path: `raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx`
- SHA-256: `6efb7ca43e7dae72339601e4daebef015f0b486cde0cbb5a0f6524356e3ac034`
- Byte size: 468080
- Source-period label: march-2026 (path label only)
- Effective-date status: UNKNOWN

## Inventory

- 4WTP RTO mapping rows: 1722
- SATP rows: 326
- All_India_Decline RTO mappings: 80
- All_India_Decline SATP rows: 6
- Unresolved note exceptions: 10
- Conflicting normalized RTO codes: 0
- SATP composite-key formulas preserved: 119
- Approved commission rules emitted: 0

## Sample lookup trace

- Status: AMBIGUOUS
- Reason: MAX_CD2_SEMANTICS_UNRESOLVED
- RTO: UP78 → UP_Bad
- RTO evidence: `B1609:C1609`
- Segment label: `Petrol>1000`
- Age condition: `All` (required: false)
- Candidate row(s): B293:F293 (row 293)
- Raw metric: 0.295 (Max CD2; semantic status UNRESOLVED)
- TP commission rate: withheld
- OD applicability: NOT_APPLICABLE

## Warnings

- SOURCE_PERIOD_LABEL_ONLY: The March 2026 directory label is preserved as a source-period label only; effective date bounds remain unknown.
- OOXML_NUMERIC_LEXEME_NOT_AVAILABLE: Phase 2A stores numeric cell values as JSON numbers; original OOXML numeric text cannot be recovered from this IR.
- UNRESOLVED_EXCEPTION_NOTES: SATP notes are preserved as unresolved exception candidates and are not generalized into blanket exclusions.
- CONFLICTING_RTO_MAPPINGS: Conflicting normalized RTO codes are surfaced with all source rows; none are silently deduplicated.

## Unresolved note exceptions

- `4W SATP!F27` (row 27): More than 1500CC and 10+age is declined
- `4W SATP!F67` (row 67): Few RTOs for 10+ age are declined
- `4W SATP!F68` (row 68): Few RTOs for all age are declined
- `4W SATP!F69` (row 69): Few RTOs for all age are declined
- `4W SATP!F70` (row 70): Few RTOs for <10 age are declined
- `4W SATP!F120` (row 120): 1000-1500CC and <10 age is declined
- `4W SATP!F163` (row 163): 1000-1500CC and <10 age is declined
- `4W SATP!F180` (row 180): Few RTOs for 1000-1500CC segment are declined
- `4W SATP!F244` (row 244): Few RTOs for more than 1500CC and 10+age are declined
- `4W SATP!F324` (row 324): Few RTOs for 1000-1500CC segment are declined
