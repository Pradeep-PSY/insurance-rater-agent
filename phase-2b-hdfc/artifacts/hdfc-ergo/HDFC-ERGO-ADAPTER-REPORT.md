# HDFC ERGO Private Car Grid Adapter Draft

This is a deterministic, coordinate-reconstructed adapter draft from Phase 2A IR. It is not an approved commission rule or a final rating.

## Source identity

- PDF: Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf
- Path: `raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf`
- SHA-256: `d0900bf67631151ac5a9b398402279a56e5bc75a13659de6f294a3b298712bf9`
- Bytes: 638132
- Phase 2A manifest verification: PASS
- Printed effective date: Effective from 1st Feb'25 → 2025-02-01
- Phase 2A effective-date status: UNKNOWN

## Reconstructed inventory

- Pages: 2
- Coordinate-bearing text items retained: 365 (page 1: 311, page 2: 54)
- Rate tables: 4
- Slab rows: 20
- Rate cells: 60
- Geography rows / grouped table lines: 36
- Relevant footnotes: 4
- Approved commission rules emitted: 0

## Table scope

- ZONE_1 / Package (PACKAGE): 5 slabs; 15 cells.
- ZONE_1 / SAOD (OD_COMPONENT): 5 slabs; 15 cells.
- ZONE_2 / Package (PACKAGE): 5 slabs; 15 cells.
- ZONE_2 / SAOD (OD_COMPONENT): 5 slabs; 15 cells.
- Slab endpoint/inclusivity semantics are not inferred; exact source labels are retained as non-executable strings.

## Lookup and payout bases

- Lookup/slab basis (insurer PDF): Slab will be calculated basis comprehensive + SAOD GWP on PVT CAR (SATP premium is excluded for slab achievement)
- Payout basis (project-owner clarification): total net package premium (OD + TP/liability), GST excluded; a Package Rate is applied once.
- Lookup basis and payout basis are separately represented.
- OD and TP component rates for a Package table are `NOT_SEPARATELY_SPECIFIED`, not zero and not separate percentages.

## Sample trace

- Decision status: **AMBIGUOUS** (FUEL_EVIDENCE_MISSING_OR_UNAPPROVED)
- Policy issue-date anchor: 2026-03-26; grid effective from 2025-02-01.
- Policy product: Private Car Comprehensive; table: Package; location: Haryana → Zone 2.
- Current NCB: 35%; net OD: ₹8053; net liability: ₹3816; package net: ₹11869; GST: ₹2136.
- Fuel: MISSING; Diesel is externally corroborated in the rulebook, but no approved vehicle-master source is configured.
- Conditional candidates only: Petrol/NCB & N-NCB: 17.50% at >10-50k (slab page 1, item 136; rate page 1, item 138); Non - Petrol/NCB: 17.50% at >10-50k (slab page 1, item 136; rate page 1, item 140)
- Final commission rate: withheld (null). Final payout: withheld (null).
- Withholding reason: Fuel is required by the grid's Petrol/Non-Petrol header and is missing from policy evidence; the available Diesel corroboration is external and unapproved. Candidate values are conditional only and are not an approved or final commission rate.

## Source footnotes

- Slab will be calculated basis comprehensive + SAOD GWP on PVT CAR (SATP premium is excluded for slab achievement) (page 1, item 192)
- *Non Petrol includes Diesel, CNG, LPG (page 1, item 193)
- #New Business will be considered as NCB (page 1, item 195)
- # EV and Hybrid is to be considered in Petrol Grid (page 1, item 197)

## Phase 2A IR limitation

- Phase 2A IR preserves text items and bounding boxes but not PDF vector rules, fills, or native table objects; row/column associations are deterministic geometric reconstructions, not original PDF table metadata.
- PDF page 2 and the lower page-1 geography table use merged visual context; repeated state/region context is preserved with the source locator from the last directly printed label.
- No original spreadsheet-style row numbers exist for PDF tables; citations use page number, text-item index, exact text, and bounding box only.

## Warnings

- PHASE2A_EFFECTIVE_DATE_NOT_NORMALIZED: Phase 2A reports effectiveDateStatus UNKNOWN and null bounds; this adapter separately preserves the PDF's exact printed effective-date text and deterministic 2025-02-01 extraction.
- SAMPLE_FUEL_MISSING_OR_UNAPPROVED: The sample's fuel is not printed in its policy evidence; the external Diesel corroboration cited by Phase 0 is not an approved vehicle-master source.
- SAMPLE_FINAL_RATE_WITHHELD: No final sample rate or payout is emitted. Conditional table values remain candidates only because a required fuel dimension is unresolved.

